<?php
/**
 * Routes des logements : liste (avec filtres), détail,
 * création (avec upload photo), modification, suppression,
 * et liste des logements du propriétaire connecté.
 */

require_once __DIR__ . '/../../includes/session.php';
require_once __DIR__ . '/../../includes/uploads.php';

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

    if ($method === 'GET' && $first === 'temoignages') {
        listTemoignages();
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
    // déjà réservés restent affichés (avec un badge "Déjà réservé"
    // côté client) plutôt que d'être masqués : le propriétaire ne
    // perd pas la visibilité de son annonce, et un locataire tombant
    // dessus comprend pourquoi il ne peut pas la réserver.
    $conditions = ["statut_validation = 'approuve'", "owner_id IS NOT NULL"];
    $params = [];

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
        SELECT l.*, u.plan AS owner_plan,
            (SELECT GROUP_CONCAT(url ORDER BY position SEPARATOR '|')
             FROM logement_medias m WHERE m.logement_id = l.id AND m.type = 'image') AS photos,
            (SELECT GROUP_CONCAT(url ORDER BY position SEPARATOR '|')
             FROM logement_medias m WHERE m.logement_id = l.id AND m.type = 'video') AS videos
        FROM logements l
        LEFT JOIN utilisateurs u ON u.id = l.owner_id
    ";

    if ($conditions) {
        $sql .= ' WHERE ' . implode(' AND ', $conditions);
    }

    // Les logements encore disponibles passent toujours avant les
    // déjà réservés, indépendamment de la date de publication. La
    // mise en avant Pro/Premium se base sur le plan ACTUEL du
    // propriétaire (pas un indicateur figé sur l'annonce) : un
    // abonnement souscrit après coup profite immédiatement à toutes
    // ses annonces existantes, et s'arrête dès que le plan change.
    $sql .= "
        ORDER BY (l.statut = 'disponible') DESC,
            (CASE u.plan WHEN 'pro' THEN 2 WHEN 'premium' THEN 1 ELSE 0 END) DESC,
            l.created_at DESC
    ";

    $stmt = getPdo()->prepare($sql);
    $stmt->execute($params);

    jsonResponse($stmt->fetchAll());
}

/**
 * Derniers vrais commentaires laissés sur des annonces, réutilisés
 * comme témoignages sur la page d'accueil — jamais d'avis inventé,
 * uniquement de vrais commentaires de vrais utilisateurs, avec leur
 * vraie photo de profil. Les messages très courts (ex. "ok") sont
 * écartés : pas pertinents à mettre en avant, sans rien inventer
 * pour autant.
 */
function listTemoignages(): void
{
    $limite = isset($_GET['limite']) ? min(20, max(1, (int) $_GET['limite'])) : 10;

    $stmt = getPdo()->prepare("
        SELECT c.id, c.message, c.created_at,
               u.nom_complet AS auteur_nom, u.photo_url AS auteur_photo,
               l.titre AS logement_titre, l.id AS logement_id
        FROM commentaires c
        JOIN utilisateurs u ON u.id = c.user_id
        JOIN logements l ON l.id = c.logement_id
        WHERE CHAR_LENGTH(c.message) >= 20
        AND l.statut_validation = 'approuve'
        ORDER BY c.created_at DESC
        LIMIT " . $limite . "
    ");
    $stmt->execute();

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
        SELECT l.*, u.plan AS owner_plan,
            (SELECT COUNT(*) FROM logement_medias m WHERE m.logement_id = l.id AND m.type = "image") AS nb_photos,
            (SELECT COUNT(*) FROM logement_medias m WHERE m.logement_id = l.id AND m.type = "video") AS nb_videos
        FROM logements l
        LEFT JOIN utilisateurs u ON u.id = l.owner_id
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
            u.plan AS owner_plan,
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

    // Compteur de consultations, affiché au propriétaire dans son
    // tableau de bord (argument réel derrière "Statistiques de
    // consultation", vendu comme avantage Premium/Pro).
    getPdo()->prepare('UPDATE logements SET vues = vues + 1 WHERE id = ?')->execute([$id]);
    $logement['vues'] = (int) $logement['vues'] + 1;

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
const MAX_VIDEOS_GRATUIT = 2;
const MAX_VIDEOS_PREMIUM = 5;
const MAX_VIDEOS_PRO = 8;

// Nombre maximum d'annonces qu'un compte au plan Gratuit peut
// publier par jour calendaire — Premium et Pro n'ont pas cette
// limite. Tant que les paiements ne sont pas branchés, tous les
// comptes sont au plan Gratuit par défaut.
const LIMITE_ANNONCES_GRATUIT_PAR_JOUR = 2;

// Le temps que les paiements PayDunya soient validés, aucun compte
// n'est facturé : toutes les limites liées au plan (annonces/jour,
// vidéos, publicité vocale) sont désactivées pour attirer un
// maximum d'utilisateurs sans donner l'impression de frais cachés.
// Repasser à false une fois les paiements activés pour revenir aux
// limites normales par plan — voir aussi publier-logement.js
// (FONCTIONNALITES_LIBRES_LANCEMENT) côté client.
const FONCTIONNALITES_LIBRES_LANCEMENT = true;

/**
 * Bloque la publication si le compte est au plan Gratuit et a déjà
 * atteint la limite du jour — Premium/Pro ne sont pas limités.
 */
function verifierLimitePlanGratuit(int $userId): void
{
    if (FONCTIONNALITES_LIBRES_LANCEMENT) {
        return;
    }

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
    $profils = extraireProfils($_POST['profils'] ?? []);

    // Durée de location : détermine à quelle période correspond le
    // prix saisi (à la nuitée, à la semaine, au mois, à l'année...).
    $dureeLocation = $_POST['duree_location'] ?? '1_mois';

    if (!in_array($dureeLocation, DUREES_LOCATION_VALIDES, true)) {
        jsonError('Durée de location invalide.');
    }

    $dureeLocationAutre = trim($_POST['duree_location_autre'] ?? '');

    if ($dureeLocation === 'autre' && !$dureeLocationAutre) {
        jsonError('Merci de préciser la durée de location.');
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

    // Capacité facultative (nombre de personnes que le logement
    // peut accueillir).
    $nombrePersonnesBrute = trim($_POST['nombre_personnes'] ?? '');
    $nombrePersonnes = null;

    if ($nombrePersonnesBrute !== '') {

        if (!ctype_digit($nombrePersonnesBrute) || (int) $nombrePersonnesBrute < 1) {
            jsonError('Le nombre de personnes doit être un nombre valide.');
        }

        $nombrePersonnes = (int) $nombrePersonnesBrute;
    }

    // Un immeuble se décrit par son nombre total d'étages ; les
    // autres types de logement se décrivent par le niveau d'étage
    // auquel se trouve le logement (rez-de-chaussée, 1er...).
    $nombreEtages = null;
    $niveauEtage = null;

    if ($type === 'Immeuble') {

        $nombreEtagesBrute = trim($_POST['nombre_etages'] ?? '');

        if ($nombreEtagesBrute !== '') {

            if (!ctype_digit($nombreEtagesBrute) || (int) $nombreEtagesBrute < 1) {
                jsonError('Le nombre d\'étages doit être un nombre valide.');
            }

            $nombreEtages = (int) $nombreEtagesBrute;
        }

    } else {

        $niveauEtageBrute = $_POST['niveau_etage'] ?? '';

        if ($niveauEtageBrute !== '') {

            if (!in_array($niveauEtageBrute, NIVEAUX_ETAGE_VALIDES, true)) {
                jsonError('Niveau d\'étage invalide.');
            }

            $niveauEtage = $niveauEtageBrute;
        }
    }

    if (!$titre || !$ville || !$prix) {
        jsonError('Titre, ville et prix sont obligatoires.');
    }

    if ((float) $prix < 10000) {
        jsonError('Le prix minimum est de 10 000 FCFA.');
    }

    $photos = extraireFichiers($_FILES['photos'] ?? null);
    $videos = extraireFichiers($_FILES['videos'] ?? null);

    $stmt = getPdo()->prepare('SELECT plan FROM utilisateurs WHERE id = ?');
    $stmt->execute([$userId]);
    $planActuel = $stmt->fetchColumn() ?: 'gratuit';

    // Pendant le lancement (voir FONCTIONNALITES_LIBRES_LANCEMENT),
    // tous les comptes sont traités comme le plan Pro pour les
    // limites ci-dessous, même si leur plan enregistré reste Gratuit.
    $planEffectif = FONCTIONNALITES_LIBRES_LANCEMENT ? 'pro' : $planActuel;

    // Publicité vocale : réservée aux plans Premium et Pro. Le
    // champ est masqué/désactivé côté client pour un compte
    // Gratuit, mais revérifié ici pour ne pas dépendre uniquement
    // du frontend.
    $audioUrl = null;
    $fichierAudio = $_FILES['audio'] ?? null;

    if ($fichierAudio && ($fichierAudio['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK) {

        if ($planEffectif === 'gratuit') {
            jsonError('La publicité vocale est réservée aux plans Premium et Pro.', 403);
        }

        // "webm" et "mp4" en plus des formats classiques : ce sont
        // les formats produits par l'enregistrement vocal directement
        // dans le navigateur (MediaRecorder), qui remplace l'upload
        // d'un fichier audio existant.
        $audioUrl = enregistrerMedia(
            ['name' => $fichierAudio['name'], 'tmp_name' => $fichierAudio['tmp_name']],
            ['mp3', 'wav', 'm4a', 'ogg', 'webm', 'mp4']
        );

        if (!$audioUrl) {
            jsonError('L\'enregistrement audio fourni est invalide.');
        }
    }

    if (count($photos) === 0) {
        jsonError('Au moins une photo est obligatoire.');
    }

    $maxVideosParPlan = [
        'gratuit' => MAX_VIDEOS_GRATUIT,
        'premium' => MAX_VIDEOS_PREMIUM,
        'pro'     => MAX_VIDEOS_PRO,
    ];

    $maxVideos = $maxVideosParPlan[$planEffectif] ?? MAX_VIDEOS_GRATUIT;

    $photos = array_slice($photos, 0, MAX_PHOTOS);
    $videos = array_slice($videos, 0, $maxVideos);

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
                duree_location, duree_location_autre, caution, nombre_personnes, nombre_etages, niveau_etage,
                equip_wifi, equip_parking, equip_cuisine, equip_douche, equip_salon, equip_balcon,
                equip_eau, equip_electricite, equip_climatisation,
                profil_celibataire, profil_marie, profil_etudiant, profil_travailleur,
                profil_senegalais, profil_etranger, audio_url
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $userId, $titre, $ville, $type, $prix, $chambres, $description, $imageUrl,
            $contactTelephone, $contactWhatsapp, $contactEmail,
            $dureeLocation, ($dureeLocation === 'autre' ? $dureeLocationAutre : null), $caution, $nombrePersonnes, $nombreEtages, $niveauEtage,
            $equipements['wifi'], $equipements['parking'], $equipements['cuisine'],
            $equipements['douche'], $equipements['salon'], $equipements['balcon'],
            $equipements['eau'], $equipements['electricite'], $equipements['climatisation'],
            $profils['celibataire'], $profils['marie'], $profils['etudiant'], $profils['travailleur'],
            $profils['senegalais'], $profils['etranger'], $audioUrl,
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

const DUREES_LOCATION_VALIDES = ['24h', 'nuit', 'journee', 'semaine', '1_mois', '3_mois', '6_mois', '1_an', 'autre'];
const NIVEAUX_ETAGE_VALIDES = ['rdc', '1', '2', '3', '4_plus'];

/**
 * Normalise le "profil recherché" coché par le propriétaire
 * (equipements[] côté HTML, mais un champ indépendant) — même
 * logique que extraireEquipements().
 */
function extraireProfils($profilsBruts): array
{
    $liste = is_array($profilsBruts) ? $profilsBruts : [];

    $disponibles = ['celibataire', 'marie', 'etudiant', 'travailleur', 'senegalais', 'etranger'];
    $resultat = [];

    foreach ($disponibles as $cle) {
        $resultat[$cle] = in_array($cle, $liste, true) ? 1 : 0;
    }

    return $resultat;
}

function updateLogement(int $id): void
{
    requireOwner($id);

    $body = getJsonBody();

    $champs = [];
    $params = [];

    $champsAutorises = [
        'titre', 'ville', 'type', 'prix', 'chambres', 'description', 'statut',
        'contact_telephone', 'contact_whatsapp', 'contact_email',
        'duree_location', 'duree_location_autre', 'caution', 'nombre_personnes', 'nombre_etages', 'niveau_etage',
        'equip_wifi', 'equip_parking', 'equip_cuisine', 'equip_douche', 'equip_salon', 'equip_balcon',
        'equip_eau', 'equip_electricite', 'equip_climatisation',
        'profil_celibataire', 'profil_marie', 'profil_etudiant', 'profil_travailleur',
        'profil_senegalais', 'profil_etranger', 'audio_url',
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
