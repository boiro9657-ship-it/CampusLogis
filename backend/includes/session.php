<?php
/**
 * Démarre la session PHP et expose les gardes d'accès utilisées
 * par les routes protégées de l'API.
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/response.php';

session_start();

/**
 * Bloque l'accès (401) si aucun utilisateur n'est connecté.
 * Retourne l'id de l'utilisateur connecté sinon.
 */
function requireAuth(): int
{
    if (empty($_SESSION['user_id'])) {
        jsonError('Authentification requise.', 401);
    }

    return (int) $_SESSION['user_id'];
}

/**
 * Bloque l'accès si l'utilisateur connecté n'est pas le
 * propriétaire du logement ciblé (401 si non connecté,
 * 404 si le logement n'existe pas, 403 si ce n'est pas le sien).
 */
function requireOwner(int $logementId): int
{
    $userId = requireAuth();

    $stmt = getPdo()->prepare('SELECT owner_id FROM logements WHERE id = ?');
    $stmt->execute([$logementId]);
    $logement = $stmt->fetch();

    if (!$logement) {
        jsonError('Logement introuvable.', 404);
    }

    if ((int) $logement['owner_id'] !== $userId) {
        jsonError('Action non autorisée.', 403);
    }

    return $userId;
}
