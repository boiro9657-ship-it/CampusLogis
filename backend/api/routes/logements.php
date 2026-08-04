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

    jsonResponse($logement);
}

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

    $imageUrl = null;

    if (!empty($_FILES['photo']['tmp_name'])) {
        $imageUrl = enregistrerPhoto($_FILES['photo']);
    }

    $pdo = getPdo();

    $stmt = $pdo->prepare('
        INSERT INTO logements (owner_id, titre, ville, type, prix, chambres, description, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([$userId, $titre, $ville, $type, $prix, $chambres, $description, $imageUrl]);

    jsonResponse([
        'id'      => $pdo->lastInsertId(),
        'message' => 'Logement publié avec succès.',
    ], 201);
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

function enregistrerPhoto(array $fichier): ?string
{
    $extensionsAutorisees = ['jpg', 'jpeg', 'png', 'webp'];
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
