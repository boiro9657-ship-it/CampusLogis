<?php
/**
 * Routes des logements : liste (avec filtres), détail,
 * création (avec upload photo), modification, suppression,
 * et liste des logements du propriétaire connecté.
 */

require_once __DIR__ . '/../../includes/session.php';

function handleLogementsRoute(array $segments, string $method): void
{
    $first = $segments[0] ?? null;

    if ($method === 'GET' && $first === 'mine') {
        listMesLogements();
        return;
    }

    if ($method === 'GET' && $first === 'stats') {
        statsPubliques();
        return;
    }

    if ($method === 'GET' && $first === null) {
        listLogements();
        return;
    }

    if ($method === 'GET' && is_numeric($first) && ($segments[1] ?? null) === 'commentaires') {
        listCommentaires((int) $first);
        return;
    }

    if ($method === 'POST' && is_numeric($first) && ($segments[1] ?? null) === 'commentaires') {
        creerCommentaire((int) $first);
        return;
    }

    if ($method === 'GET' && is_numeric($first)) {
        getLogement((int) $first);
        return;
    }

    if ($method === 'POST' && $first === null) {
        createLogement();
        return;
    }

    if ($method === 'PUT' && is_numeric($first)) {
        updateLogement((int) $first);
        return;
    }

    if ($method === 'DELETE' && is_numeric($first)) {
        deleteLogement((int) $first);
        return;
    }

    jsonError('Route introuvable.', 404);
}

function listLogements(): void
{
    // "owner_id IS NOT NULL" garantit que toute annonce publique
    // a un vrai propriétaire contactable — aucune annonce fictive
    // ou orpheline ne doit apparaître sur le site. Les logements
    // déjà réservés sont exclus des résultats de recherche par
    // défaut (ils restent consultables via leur lien direct) ;
    // "tous=1" permet de les inclure quand même (ex. suggestions).
    $conditions = ["statut_validation = 'approuve'", "owner_id IS NOT NULL"];
    $params = [];

    if (empty($_GET['tous'])) {
        $conditions[] = "statut = 'disponible'";
    }

    if (!empty($_GET['ville'])) {
        $conditions[] = 'ville LIKE ?';
        $params[] = '%' . $_GET['ville'] . '%';
    }

    if (!empty($_GET['type'])) {
        $conditions[] = 'type = ?';
        $params[] = $_GET['type'];
    }

    if (!empty($_GET['budget'])) {
        $conditions[] = 'prix <= ?';
        $params[] = (float) $_GET['budget'];
    }

    $sql = "
        SELECT l.*,
            (SELECT GROUP_CONCAT(url ORDER BY position SEPARATOR '|')
             FROM logement_medias m WHERE m.logement_id = l.id AND m.type = 'image') AS photos
        FROM logements l
    ";

    if ($conditions) {
        $sql .= ' WHERE ' . implode(' AND ', $conditions);
    }

    $sql .= ' ORDER BY premium DESC, created_at DESC';

    $stmt = getPdo()->prepare($sql);
    $stmt->execute($params);

    jsonResponse($stmt->fetchAll());
}

/**
 * Statistiques publiques réelles pour l'accueil (nombre de
 * logements publiés, de propriétaires actifs, de villes
 * couvertes) — aucun chiffre inventé, uniquement des annonces
 * réelles et approuvées.
 */
function statsPubliques(): void
{
    $pdo = getPdo();

    $nbLogements = $pdo->query("
        SELECT COUNT(*) FROM logements
        WHERE statut_validation = 'approuve' AND owner_id IS NOT NULL
    ")->fetchColumn();

    $nbProprietaires = $pdo->query("
        SELECT COUNT(DISTINCT owner_id) FROM logements
        WHERE statut_validation = 'approuve' AND owner_id IS NOT NULL
    ")->fetchColumn();

    $nbVilles = $pdo->query("
        SELECT COUNT(DISTINCT ville) FROM logements
        WHERE statut_validation = 'approuve' AND owner_id IS NOT NULL AND ville IS NOT NULL AND ville != ''
    ")->fetchColumn();

    jsonResponse([
        'logements'     => (int) $nbLogements,
        'proprietaires' => (int) $nbProprietaires,
        'villes'        => (int) $nbVilles,
    ]);
}

function listMesLogements(): void
{
    $userId = requireAuth();

    $stmt = getPdo()->prepare('
        SELECT l.*,
            (SELECT COUNT(*) FROM logement_medias m WHERE m.logement_id = l.id AND m.type = "image") AS nb_photos,
            (SELECT COUNT(*) FROM logement_medias m WHERE m.logement_id = l.id AND m.type = "video") AS nb_videos
        FROM logements l
        WHERE l.owner_id = ?
        ORDER BY l.created_at DESC
    ');
    $stmt->execute([$userId]);

    jsonResponse($stmt->fetchAll());
}

function getLogement(int $id): void
{
    $stmt = getPdo()->prepare('
        SELECT l.*, u.nom_complet AS proprietaire_nom, u.telephone AS proprietaire_telephone,
            u.photo_url AS proprietaire_photo,
            u.created_at AS proprietaire_membre_depuis,
            (
                SELECT COUNT(*) FROM logements l2
                WHERE l2.owner_id = l.owner_id AND l2.statut_validation = "approuve"
            ) AS proprietaire_nb_annonces
        FROM logements l
        LEFT JOIN utilisateurs u ON u.id = l.owner_id
        WHERE l.id = ?
    ');
    $stmt->execute([$id]);
    $logement = $stmt->fetch();

    if (!$logement) {
        jsonError('Logement introuvable.', 404);
    }

    $stmt = getPdo()->prepare('
        SELECT type, url FROM logement_medias
        WHERE logement_id = ?
        ORDER BY position ASC, id ASC
    ');
    $stmt->execute([$id]);
    $logement['medias'] = $stmt->fetchAll();

    jsonResponse($logement);
}

// Limites côté serveur : au-delà, les fichiers en trop sont
// simplement ignorés (le client valide déjà ces mêmes bornes
// avant l'envoi pour prévenir l'utilisateur).
const MAX_PHOTOS = 8;
const MAX_VIDEOS = 2;

// Nombre maximum d'annonces qu'un compte au plan Gratuit peut
// publier par jour calendaire — Premium et Pro n'ont pas cette
// limite. Tant que les paiements ne sont pas branchés, tous les
// comptes sont au plan Gratuit par défaut.
const LIMITE_ANNONCES_GRATUIT_PAR_JOUR = 2;

/**
 * Bloque la publication si le compte est au plan Gratuit et a déjà
 * atteint la limite du jour — Premium/Pro ne sont pas limités.
 */
function verifierLimitePlanGratuit(int $userId): void
{
    $pdo = getPdo();

    $stmt = $pdo->prepare('SELECT plan FROM utilisateurs WHERE id = ?');
    $stmt->execute([$userId]);
    $plan = $stmt->fetchColumn() ?: 'gratuit';

    if ($plan !== 'gratuit') {
        return;
    }

    $stmt = $pdo->prepare("
        SELECT COUNT(*) FROM logements
        WHERE owner_id = ? AND DATE(created_at) = CURDATE()
    ");
    $stmt->execute([$userId]);
    $nbAujourdhui = (int) $stmt->fetchColumn();

    if ($nbAujourdhui >= LIMITE_ANNONCES_GRATUIT_PAR_JOUR) {
        jsonError(
            'Le plan Gratuit permet de publier ' . LIMITE_ANNONCES_GRATUIT_PAR_JOUR . ' annonces par jour maximum. ' .
            'Passez au plan Premium ou Pro pour publier davantage, ou réessayez demain.',
            403
        );
    }
}

function createLogement(): void
{
    $userId = requireAuth();

    verifierLimitePlanGratuit($userId);

    $titre = trim($_POST['titre'] ?? '');
    $ville = trim($_POST['ville'] ?? '');
    $type = $_POST['type'] ?? null;
    $prix = $_POST['prix'] ?? null;
    $chambres = $_POST['chambres'] ?? null;
    $description = trim($_POST['description'] ?? '');

    // Coordonnées de contact propres à l'annonce : facultatives,
    // le propriétaire peut préférer un numéro/email différent de
    // celui de son compte (ex. gérant, ligne dédiée).
    $contactTelephone = trim($_POST['contact_telephone'] ?? '') ?: null;
    $contactWhatsapp = trim($_POST['contact_whatsapp'] ?? '') ?: null;
    $contactEmail = trim($_POST['contact_email'] ?? '') ?: null;

    if ($contactEmail !== null && !filter_var($contactEmail, FILTER_VALIDATE_EMAIL)) {
        jsonError('L\'email de contact fourni est invalide.');
    }

    $equipements = extraireEquipements($_POST['equipements'] ?? []);

    // Durée de location : détermine à quelle période correspond le
    // prix saisi (à la nuitée, à la semaine, au mois, à l'année...).
    $dureeLocation = $_POST['duree_location'] ?? '1_mois';

    if (!in_array($dureeLocation, DUREES_LOCATION_VALIDES, true)) {
        jsonError('Durée de location invalide.');
    }

    // Caution facultative : vide = pas de caution demandée.
    $cautionBrute = trim($_POST['caution'] ?? '');
    $caution = null;

    if ($cautionBrute !== '') {

        if (!is_numeric($cautionBrute) || (float) $cautionBrute < 0) {
            jsonError('La caution doit être un montant valide.');
        }

        $caution = (float) $cautionBrute;
    }

    if (!$titre || !$ville || !$prix) {
        jsonError('Titre, ville et prix sont obligatoires.');
    }

    if ((float) $prix < 10000) {
        jsonError('Le prix minimum est de 10 000 FCFA.');
    }

    $photos = extraireFichiers($_FILES['photos'] ?? null);
    $videos = extraireFichiers($_FILES['videos'] ?? null);

    if (count($photos) === 0) {
        jsonError('Au moins une photo est obligatoire.');
    }

    $photos = array_slice($photos, 0, MAX_PHOTOS);
    $videos = array_slice($videos, 0, MAX_VIDEOS);

    $medias = [];
    $imageUrl = null;

    foreach ($photos as $fichier) {

        $url = enregistrerMedia($fichier, ['jpg', 'jpeg', 'png', 'webp']);

        if ($url) {
            $medias[] = ['type' => 'image', 'url' => $url];

            if ($imageUrl === null) {
                $imageUrl = $url;
            }
        }
    }

    foreach ($videos as $fichier) {

        $url = enregistrerMedia($fichier, ['mp4', 'webm', 'mov']);

        if ($url) {
            $medias[] = ['type' => 'video', 'url' => $url];
        }
    }

    if ($imageUrl === null) {
        jsonError('La photo fournie est invalide (formats acceptés : jpg, png, webp).');
    }

    $pdo = getPdo();

    // Transaction : le logement et ses médias doivent être créés
    // ensemble, jamais l'un sans l'autre.
    $pdo->beginTransaction();

    try {

        $stmt = $pdo->prepare('
            INSERT INTO logements (
                owner_id, titre, ville, type, prix, chambres, description, image_url,
                contact_telephone, contact_whatsapp, contact_email,
                duree_location, caution,
                equip_wifi, equip_parking, equip_cuisine, equip_douche, equip_salon, equip_balcon,
                equip_eau, equip_electricite, equip_climatisation
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $userId, $titre, $ville, $type, $prix, $chambres, $description, $imageUrl,
            $contactTelephone, $contactWhatsapp, $contactEmail,
            $dureeLocation, $caution,
            $equipements['wifi'], $equipements['parking'], $equipements['cuisine'],
            $equipements['douche'], $equipements['salon'], $equipements['balcon'],
            $equipements['eau'], $equipements['electricite'], $equipements['climatisation'],
        ]);

        $logementId = $pdo->lastInsertId();

        $stmtMedia = $pdo->prepare('
            INSERT INTO logement_medias (logement_id, type, url, position)
            VALUES (?, ?, ?, ?)
        ');

        foreach ($medias as $position => $media) {
            $stmtMedia->execute([$logementId, $media['type'], $media['url'], $position]);
        }

        $pdo->commit();

    } catch (Throwable $e) {

        $pdo->rollBack();
        throw $e;

    }

    jsonResponse([
        'id'      => $logementId,
        'message' => 'Logement publié avec succès.',
    ], 201);
}

/**
 * Reconstruit un tableau de fichiers individuels à partir de la
 * structure $_FILES d'un champ multiple (name="photos[]"), en
 * ignorant les emplacements vides (aucun fichier sélectionné).
 */
function extraireFichiers(?array $champFichiers): array
{
    if (!$champFichiers || !isset($champFichiers['name'])) {
        return [];
    }

    $fichiers = [];

    foreach ($champFichiers['name'] as $i => $nom) {

        if ($nom === '' || $champFichiers['error'][$i] !== UPLOAD_ERR_OK) {
            continue;
        }

        $fichiers[] = [
            'name'     => $champFichiers['name'][$i],
            'tmp_name' => $champFichiers['tmp_name'][$i],
        ];
    }

    return $fichiers;
}

/**
 * Normalise la liste d'équipements cochés (envoyée en
 * "equipements[]") vers un tableau associatif complet 0/1, prêt
 * à être inséré tel quel dans les colonnes equip_*.
 */
function extraireEquipements($equipementsBruts): array
{
    $liste = is_array($equipementsBruts) ? $equipementsBruts : [];

    $disponibles = ['wifi', 'parking', 'cuisine', 'douche', 'salon', 'balcon', 'eau', 'electricite', 'climatisation'];
    $resultat = [];

    foreach ($disponibles as $cle) {
        $resultat[$cle] = in_array($cle, $liste, true) ? 1 : 0;
    }

    return $resultat;
}

const DUREES_LOCATION_VALIDES = ['24h', 'nuit', 'journee', 'semaine', '1_mois', '3_mois', '6_mois', '1_an'];

function updateLogement(int $id): void
{
    requireOwner($id);

    $body = getJsonBody();

    $champs = [];
    $params = [];

    $champsAutorises = [
        'titre', 'ville', 'type', 'prix', 'chambres', 'description', 'statut',
        'contact_telephone', 'contact_whatsapp', 'contact_email',
        'duree_location', 'caution',
        'equip_wifi', 'equip_parking', 'equip_cuisine', 'equip_douche', 'equip_salon', 'equip_balcon',
        'equip_eau', 'equip_electricite', 'equip_climatisation',
    ];

    foreach ($champsAutorises as $champ) {
        if (array_key_exists($champ, $body)) {
            $champs[] = "$champ = ?";
            $params[] = $body[$champ];
        }
    }

    if (!$champs) {
        jsonError('Aucune donnée à mettre à jour.');
    }

    if (array_key_exists('prix', $body) && (float) $body['prix'] < 10000) {
        jsonError('Le prix minimum est de 10 000 FCFA.');
    }

    if (array_key_exists('duree_location', $body) && !in_array($body['duree_location'], DUREES_LOCATION_VALIDES, true)) {
        jsonError('Durée de location invalide.');
    }

    if (array_key_exists('caution', $body) && $body['caution'] !== null && (!is_numeric($body['caution']) || (float) $body['caution'] < 0)) {
        jsonError('La caution doit être un montant valide.');
    }

    $params[] = $id;

    $sql = 'UPDATE logements SET ' . implode(', ', $champs) . ' WHERE id = ?';
    getPdo()->prepare($sql)->execute($params);

    jsonResponse(['message' => 'Logement mis à jour.']);
}

function deleteLogement(int $id): void
{
    requireOwner($id);

    getPdo()->prepare('DELETE FROM logements WHERE id = ?')->execute([$id]);

    jsonResponse(['message' => 'Logement supprimé.']);
}

function enregistrerMedia(array $fichier, array $extensionsAutorisees): ?string
{
    $extension = strtolower(pathinfo($fichier['name'], PATHINFO_EXTENSION));

    if (!in_array($extension, $extensionsAutorisees, true)) {
        return null;
    }

    $nomFichier = uniqid('logement_', true) . '.' . $extension;
    $dossier = __DIR__ . '/../../uploads/logements/';

    if (!is_dir($dossier)) {
        mkdir($dossier, 0755, true);
    }

    move_uploaded_file($fichier['tmp_name'], $dossier . $nomFichier);

    // Chemin public calculé depuis l'emplacement réel du front
    // controller (dirname deux fois : api/ puis backend/) plutôt
    // que codé en dur, pour rester valide quel que soit le
    // dossier de montage du site.
    $baseDossier = str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'])));

    return $baseDossier . '/uploads/logements/' . $nomFichier;
}

/**
 * Liste publique des commentaires d'une annonce, avec le nom et
 * la photo de profil de l'auteur.
 */
function listCommentaires(int $logementId): void
{
    $stmt = getPdo()->prepare('
        SELECT c.id, c.message, c.created_at, c.user_id,
               u.nom_complet AS auteur_nom, u.photo_url AS auteur_photo
        FROM commentaires c
        JOIN utilisateurs u ON u.id = c.user_id
        WHERE c.logement_id = ?
        ORDER BY c.created_at DESC
    ');
    $stmt->execute([$logementId]);

    jsonResponse($stmt->fetchAll());
}

/**
 * Ajoute un commentaire sur une annonce. Ouvert à tout
 * utilisateur connecté (locataire ou propriétaire) — la
 * modération a posteriori (menaces, diffamation) est gérée par
 * l'admin via /admin/commentaires.
 */
function creerCommentaire(int $logementId): void
{
    $userId = requireAuth();

    $body = getJsonBody();
    $message = trim($body['message'] ?? '');

    if (!$message) {
        jsonError('Le commentaire ne peut pas être vide.');
    }

    if (strlen($message) > 1000) {
        jsonError('Le commentaire est trop long (1000 caractères maximum).');
    }

    $stmt = getPdo()->prepare('SELECT id FROM logements WHERE id = ?');
    $stmt->execute([$logementId]);

    if (!$stmt->fetch()) {
        jsonError('Logement introuvable.', 404);
    }

    getPdo()->prepare('
        INSERT INTO commentaires (logement_id, user_id, message)
        VALUES (?, ?, ?)
    ')->execute([$logementId, $userId, $message]);

    jsonResponse(['message' => 'Commentaire publié.'], 201);
}
