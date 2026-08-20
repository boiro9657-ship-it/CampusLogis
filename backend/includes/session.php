<?php
/**
 * Démarre la session PHP et expose les gardes d'accès utilisées
 * par les routes protégées de l'API.
 */

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/response.php';

// PHP verrouille le fichier de session en écriture pendant toute la
// durée d'une requête tant que la session reste ouverte — sur une
// page qui déclenche plusieurs appels API en parallèle (ex. les
// tableaux de bord), ces requêtes finissaient donc par s'exécuter
// une par une côté serveur au lieu d'être vraiment simultanées
// (pages qui s'attardent à charger, requêtes qui expirent parfois).
// La quasi-totalité des routes ne fait que LIRE $_SESSION['user_id']
// (voir requireAuth() ci-dessous) : on referme donc le verrou tout
// de suite après l'avoir lu. Les rares routes qui ÉCRIVENT dans la
// session (connexion, déconnexion, callback Google — voir auth.php)
// rouvrent explicitement la session juste avant d'écrire.
session_start();
session_write_close();

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

/**
 * Bloque l'accès (401 si non connecté, 403 si le compte connecté
 * n'a pas le rôle admin). Retourne l'id de l'admin connecté sinon.
 */
function requireAdmin(): int
{
    $userId = requireAuth();

    $stmt = getPdo()->prepare('SELECT role FROM utilisateurs WHERE id = ?');
    $stmt->execute([$userId]);
    $utilisateur = $stmt->fetch();

    if (!$utilisateur || $utilisateur['role'] !== 'admin') {
        jsonError('Action réservée aux administrateurs.', 403);
    }

    return $userId;
}
