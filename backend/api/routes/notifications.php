<?php
/**
 * Routes des notifications in-app : liste des notifications de
 * l'utilisateur connecté, marquage comme lues. La création des
 * notifications (nouveau logement approuvé) est déclenchée depuis
 * admin.php via creerNotificationsNouveauLogement().
 */

require_once __DIR__ . '/../../includes/session.php';

function handleNotificationsRoute(array $segments, string $method): void
{
    $first = $segments[0] ?? null;

    if ($method === 'GET' && $first === null) {
        mesNotifications();
        return;
    }

    if ($method === 'PUT' && $first === 'lu') {
        marquerNotificationsLues();
        return;
    }

    jsonError('Route introuvable.', 404);
}

function mesNotifications(): void
{
    $userId = requireAuth();

    $stmt = getPdo()->prepare('
        SELECT id, message, lien, lu, created_at
        FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 30
    ');
    $stmt->execute([$userId]);

    jsonResponse($stmt->fetchAll());
}

function marquerNotificationsLues(): void
{
    $userId = requireAuth();

    getPdo()->prepare('UPDATE notifications SET lu = 1 WHERE user_id = ? AND lu = 0')
        ->execute([$userId]);

    jsonResponse(['message' => 'Notifications marquées comme lues.']);
}

/**
 * Crée une notification pour chaque utilisateur ayant activé les
 * notifications (hors propriétaire de l'annonce), lorsqu'un
 * logement vient d'être approuvé par l'admin.
 */
function creerNotificationsNouveauLogement(int $logementId, int $ownerId, string $titre, ?string $ville): void
{
    $pdo = getPdo();

    $stmt = $pdo->prepare('
        SELECT id FROM utilisateurs
        WHERE notifications_actives = 1 AND id != ?
    ');
    $stmt->execute([$ownerId]);
    $destinataires = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (!$destinataires) {
        return;
    }

    $message = $ville
        ? "Nouveau logement publié : {$titre} à {$ville}"
        : "Nouveau logement publié : {$titre}";

    $lien = 'pages/details-logement/details-logement.html?id=' . $logementId;

    $insert = $pdo->prepare('
        INSERT INTO notifications (user_id, logement_id, message, lien)
        VALUES (?, ?, ?, ?)
    ');

    foreach ($destinataires as $destinataireId) {
        $insert->execute([$destinataireId, $logementId, $message, $lien]);
    }
}
