<?php
/**
 * Routes des favoris : liste (avec les détails du logement),
 * ajout, retrait. Tout est réservé à l'utilisateur connecté.
 */

require_once __DIR__ . '/../../includes/session.php';

function handleFavorisRoute(array $segments, string $method): void
{
    $first = $segments[0] ?? null;

    if ($method === 'GET' && $first === null) {
        listFavoris();
        return;
    }

    if ($method === 'POST' && is_numeric($first)) {
        ajouterFavori((int) $first);
        return;
    }

    if ($method === 'DELETE' && is_numeric($first)) {
        retirerFavori((int) $first);
        return;
    }

    jsonError('Route introuvable.', 404);
}

function listFavoris(): void
{
    $userId = requireAuth();

    $stmt = getPdo()->prepare('
        SELECT l.* FROM favoris f
        JOIN logements l ON l.id = f.logement_id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
    ');
    $stmt->execute([$userId]);

    jsonResponse($stmt->fetchAll());
}

function ajouterFavori(int $logementId): void
{
    $userId = requireAuth();

    $stmt = getPdo()->prepare('
        INSERT IGNORE INTO favoris (user_id, logement_id) VALUES (?, ?)
    ');
    $stmt->execute([$userId, $logementId]);

    jsonResponse(['message' => 'Ajouté aux favoris.'], 201);
}

function retirerFavori(int $logementId): void
{
    $userId = requireAuth();

    $stmt = getPdo()->prepare('
        DELETE FROM favoris WHERE user_id = ? AND logement_id = ?
    ');
    $stmt->execute([$userId, $logementId]);

    jsonResponse(['message' => 'Retiré des favoris.']);
}
