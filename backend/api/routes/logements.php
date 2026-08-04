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

    if ($method === 'GET' && $first === null) {
        listLogements();
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
    $conditions = [];
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

    $sql = 'SELECT * FROM logements';

    if ($conditions) {
        $sql .= ' WHERE ' . implode(' AND ', $conditions);
    }

    $sql .= ' ORDER BY premium DESC, created_at DESC';

    $stmt = getPdo()->prepare($sql);
    $stmt->execute($params);

    jsonResponse($stmt->fetchAll());
}

function listMesLogements(): void
{
    $userId = requireAuth();

    $stmt = getPdo()->prepare('
        SELECT * FROM logements WHERE owner_id = ? ORDER BY created_at DESC
    ');
    $stmt->execute([$userId]);

    jsonResponse($stmt->fetchAll());
}

function getLogement(int $id): void
{
    $stmt = getPdo()->prepare('SELECT * FROM logements WHERE id = ?');
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

function createLogement(): void
{
    $userId = requireAuth();

    $titre = trim($_POST['titre'] ?? '');
    $ville = trim($_POST['ville'] ?? '');
    $type = $_POST['type'] ?? null;
    $prix = $_POST['prix'] ?? null;
    $chambres = $_POST['chambres'] ?? null;
    $description = trim($_POST['description'] ?? '');

    if (!$titre || !$ville || !$prix) {
        jsonError('Titre, ville et prix sont obligatoires.');
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
            INSERT INTO logements (owner_id, titre, ville, type, prix, chambres, description, image_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([$userId, $titre, $ville, $type, $prix, $chambres, $description, $imageUrl]);

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

function updateLogement(int $id): void
{
    requireOwner($id);

    $body = getJsonBody();

    $champs = [];
    $params = [];

    foreach (['titre', 'ville', 'type', 'prix', 'chambres', 'description', 'statut'] as $champ) {
        if (array_key_exists($champ, $body)) {
            $champs[] = "$champ = ?";
            $params[] = $body[$champ];
        }
    }

    if (!$champs) {
        jsonError('Aucune donnée à mettre à jour.');
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
