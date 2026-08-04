<?php
/**
 * Routes des réservations : création par un locataire, liste
 * côté locataire, liste côté propriétaire (réservations reçues
 * sur ses logements).
 */

require_once __DIR__ . '/../../includes/session.php';

function handleReservationsRoute(array $segments, string $method): void
{
    $first = $segments[0] ?? null;

    if ($method === 'POST' && $first === null) {
        creerReservation();
        return;
    }

    if ($method === 'GET' && $first === 'mine') {
        mesReservations();
        return;
    }

    if ($method === 'GET' && $first === 'owner') {
        reservationsRecues();
        return;
    }

    jsonError('Route introuvable.', 404);
}

function creerReservation(): void
{
    $userId = requireAuth();

    $body = getJsonBody();
    $logementId = $body['logement_id'] ?? null;
    $message = trim($body['message'] ?? '');

    if (!$logementId) {
        jsonError('logement_id est obligatoire.');
    }

    $stmt = getPdo()->prepare('
        INSERT INTO reservations (logement_id, locataire_id, message)
        VALUES (?, ?, ?)
    ');
    $stmt->execute([$logementId, $userId, $message]);

    jsonResponse(['message' => 'Demande de réservation envoyée.'], 201);
}

function mesReservations(): void
{
    $userId = requireAuth();

    $stmt = getPdo()->prepare('
        SELECT r.*, l.titre, l.ville, l.image_url
        FROM reservations r
        JOIN logements l ON l.id = r.logement_id
        WHERE r.locataire_id = ?
        ORDER BY r.created_at DESC
    ');
    $stmt->execute([$userId]);

    jsonResponse($stmt->fetchAll());
}

function reservationsRecues(): void
{
    $userId = requireAuth();

    $stmt = getPdo()->prepare('
        SELECT r.*, l.titre, l.ville,
               u.nom_complet AS locataire_nom, u.telephone AS locataire_telephone
        FROM reservations r
        JOIN logements l ON l.id = r.logement_id
        JOIN utilisateurs u ON u.id = r.locataire_id
        WHERE l.owner_id = ?
        ORDER BY r.created_at DESC
    ');
    $stmt->execute([$userId]);

    jsonResponse($stmt->fetchAll());
}
