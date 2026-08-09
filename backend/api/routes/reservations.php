<?php
/**
 * Routes des réservations : création par un locataire, liste
 * côté locataire, liste côté propriétaire (réservations reçues
 * sur ses logements).
 */

require_once __DIR__ . '/../../includes/session.php';
require_once __DIR__ . '/notifications.php';

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

    if ($method === 'PUT' && is_numeric($first)) {
        modifierStatutReservation((int) $first);
        return;
    }

    jsonError('Route introuvable.', 404);
}

const DUREES_SEJOUR_VALIDES = ['24h', 'nuit', 'journee', 'semaine', '1_mois', '3_mois', '6_mois', '1_an', 'autre'];

function creerReservation(): void
{
    $userId = requireAuth();

    $body = getJsonBody();
    $logementId = $body['logement_id'] ?? null;
    $message = trim($body['message'] ?? '');
    $conditionsAcceptees = !empty($body['conditions_acceptees']);
    $dateSouhaitee = $body['date_souhaitee'] ?? null;
    $heureSouhaitee = $body['heure_souhaitee'] ?? null;
    $dureeSejour = $body['duree_sejour'] ?? null;
    $dureeSejourAutre = trim($body['duree_sejour_autre'] ?? '');

    if (!$logementId) {
        jsonError('logement_id est obligatoire.');
    }

    if (!$conditionsAcceptees) {
        jsonError('Vous devez accepter les conditions d\'utilisation pour réserver.');
    }

    if (!$dateSouhaitee || !$heureSouhaitee || !$dureeSejour) {
        jsonError('Merci de préciser la date, l\'heure et la durée souhaitées.');
    }

    if (!in_array($dureeSejour, DUREES_SEJOUR_VALIDES, true)) {
        jsonError('Durée souhaitée invalide.');
    }

    if ($dureeSejour === 'autre' && !$dureeSejourAutre) {
        jsonError('Merci de préciser la durée souhaitée.');
    }

    $dateValidee = DateTime::createFromFormat('Y-m-d', $dateSouhaitee);

    if (!$dateValidee || $dateValidee->format('Y-m-d') !== $dateSouhaitee) {
        jsonError('Date souhaitée invalide.');
    }

    $stmt = getPdo()->prepare('SELECT statut, owner_id FROM logements WHERE id = ?');
    $stmt->execute([$logementId]);
    $logement = $stmt->fetch();

    if (!$logement) {
        jsonError('Logement introuvable.', 404);
    }

    if ($logement['statut'] === 'reserve') {
        jsonError('Ce logement est déjà réservé.', 409);
    }

    $stmt = getPdo()->prepare('
        INSERT INTO reservations (logement_id, locataire_id, message, conditions_acceptees, date_souhaitee, heure_souhaitee, duree_sejour, duree_sejour_autre)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?)
    ');
    $stmt->execute([$logementId, $userId, $message, $dateSouhaitee, $heureSouhaitee, $dureeSejour, $dureeSejour === 'autre' ? $dureeSejourAutre : null]);

    // Renvoyé pour que le frontend puisse emmener directement le
    // locataire dans l'espace de discussion avec ce propriétaire.
    jsonResponse([
        'message'  => 'Demande de réservation envoyée.',
        'owner_id' => (int) $logement['owner_id'],
    ], 201);
}

function mesReservations(): void
{
    $userId = requireAuth();

    $stmt = getPdo()->prepare('
        SELECT r.*, l.titre, l.ville, l.image_url, l.owner_id
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

/**
 * Accepte ou refuse une demande de réservation — réservé au
 * propriétaire du logement concerné (pas l'admin, ni un autre
 * propriétaire). Une réservation confirmée marque automatiquement
 * le logement comme "réservé" pour qu'il n'apparaisse plus comme
 * disponible.
 */
function modifierStatutReservation(int $id): void
{
    $userId = requireAuth();

    $body = getJsonBody();
    $statut = $body['statut'] ?? null;

    if (!in_array($statut, ['confirmee', 'annulee'], true)) {
        jsonError('Statut invalide.');
    }

    $stmt = getPdo()->prepare('
        SELECT r.id, r.locataire_id, l.id AS logement_id, l.owner_id, l.titre
        FROM reservations r
        JOIN logements l ON l.id = r.logement_id
        WHERE r.id = ?
    ');
    $stmt->execute([$id]);
    $reservation = $stmt->fetch();

    if (!$reservation) {
        jsonError('Réservation introuvable.', 404);
    }

    if ((int) $reservation['owner_id'] !== $userId) {
        jsonError('Vous ne pouvez modifier que les réservations de vos propres logements.', 403);
    }

    getPdo()->prepare('UPDATE reservations SET statut = ? WHERE id = ?')->execute([$statut, $id]);

    if ($statut === 'confirmee') {
        getPdo()->prepare("UPDATE logements SET statut = 'reserve' WHERE id = ?")
            ->execute([$reservation['logement_id']]);
    }

    creerNotificationReservation(
        (int) $reservation['locataire_id'],
        (int) $reservation['logement_id'],
        $reservation['titre'],
        $statut
    );

    jsonResponse(['message' => 'Statut de la réservation mis à jour.']);
}
