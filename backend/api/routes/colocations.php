<?php
/**
 * Routes des annonces de colocation : un locataire (ou
 * propriétaire) publie qu'il cherche un(e) colocataire pour
 * partager une chambre, un studio... Distinct des annonces de
 * logement classiques (pas de propriétaire au sens location, pas
 * de réservation) — juste une petite annonce avec contact direct.
 */

require_once __DIR__ . '/../../includes/session.php';

function handleColocationsRoute(array $segments, string $method): void
{
    $first = $segments[0] ?? null;

    if ($method === 'GET' && $first === 'mine') {
        mesColocations();
        return;
    }

    if ($method === 'GET' && $first === null) {
        listColocations();
        return;
    }

    if ($method === 'POST' && $first === null) {
        creerColocation();
        return;
    }

    if ($method === 'DELETE' && is_numeric($first)) {
        supprimerColocation((int) $first);
        return;
    }

    jsonError('Route introuvable.', 404);
}

function listColocations(): void
{
    $conditions = [];
    $params = [];

    if (!empty($_GET['ville'])) {
        $conditions[] = 'c.ville LIKE ?';
        $params[] = '%' . $_GET['ville'] . '%';
    }

    if (!empty($_GET['budget'])) {
        $conditions[] = '(c.budget IS NULL OR c.budget <= ?)';
        $params[] = (float) $_GET['budget'];
    }

    $sql = '
        SELECT c.*, u.nom_complet AS auteur_nom, u.photo_url AS auteur_photo, u.telephone AS auteur_telephone
        FROM colocations c
        JOIN utilisateurs u ON u.id = c.user_id
    ';

    if ($conditions) {
        $sql .= ' WHERE ' . implode(' AND ', $conditions);
    }

    $sql .= ' ORDER BY c.created_at DESC';

    $stmt = getPdo()->prepare($sql);
    $stmt->execute($params);

    jsonResponse($stmt->fetchAll());
}

function mesColocations(): void
{
    $userId = requireAuth();

    $stmt = getPdo()->prepare('
        SELECT * FROM colocations WHERE user_id = ? ORDER BY created_at DESC
    ');
    $stmt->execute([$userId]);

    jsonResponse($stmt->fetchAll());
}

function creerColocation(): void
{
    $userId = requireAuth();

    $body = getJsonBody();

    $ville = trim($body['ville'] ?? '');
    $typeLogement = $body['type_logement'] ?? null;
    $description = trim($body['description'] ?? '');
    $contactTelephone = trim($body['contact_telephone'] ?? '') ?: null;
    $contactWhatsapp = trim($body['contact_whatsapp'] ?? '') ?: null;

    if (!$ville || !$description) {
        jsonError('La ville et une description sont obligatoires.');
    }

    if (strlen($description) > 1000) {
        jsonError('La description est trop longue (1000 caractères maximum).');
    }

    $budget = null;

    if (!empty($body['budget'])) {

        if (!is_numeric($body['budget']) || (float) $body['budget'] < 0) {
            jsonError('Le budget doit être un montant valide.');
        }

        $budget = (float) $body['budget'];
    }

    $stmt = getPdo()->prepare('
        INSERT INTO colocations (user_id, ville, type_logement, budget, description, contact_telephone, contact_whatsapp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([$userId, $ville, $typeLogement, $budget, $description, $contactTelephone, $contactWhatsapp]);

    jsonResponse(['message' => 'Annonce de colocation publiée.'], 201);
}

function supprimerColocation(int $id): void
{
    $userId = requireAuth();

    $stmt = getPdo()->prepare('SELECT user_id FROM colocations WHERE id = ?');
    $stmt->execute([$id]);
    $colocation = $stmt->fetch();

    if (!$colocation) {
        jsonError('Annonce introuvable.', 404);
    }

    if ((int) $colocation['user_id'] !== $userId) {
        jsonError('Vous ne pouvez supprimer que vos propres annonces.', 403);
    }

    getPdo()->prepare('DELETE FROM colocations WHERE id = ?')->execute([$id]);

    jsonResponse(['message' => 'Annonce supprimée.']);
}
