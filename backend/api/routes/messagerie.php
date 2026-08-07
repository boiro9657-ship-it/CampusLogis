<?php
/**
 * Espace de discussion entre le propriétaire et le locataire d'une
 * réservation donnée — chaque réservation est sa propre
 * conversation (ses deux seuls participants se déduisent d'elle).
 * Basé sur des requêtes courtes (pas de websocket, non disponible
 * sur cet hébergement) : le frontend interroge à intervalle
 * régulier pendant que la discussion est ouverte.
 */

require_once __DIR__ . '/../../includes/session.php';

// Une personne est considérée "en ligne" si elle a envoyé un signal
// d'activité (voir enregistrerActivite() dans auth.php) au cours
// des 60 dernières secondes.
const SECONDES_EN_LIGNE = 60;

function handleMessagerieRoute(array $segments, string $method): void
{
    $reservationId = $segments[0] ?? null;
    $action = $segments[1] ?? null;

    if ($method === 'GET' && is_numeric($reservationId) && $action === null) {
        listerMessages((int) $reservationId);
        return;
    }

    if ($method === 'POST' && is_numeric($reservationId) && $action === null) {
        envoyerMessage((int) $reservationId);
        return;
    }

    if ($method === 'PUT' && is_numeric($reservationId) && $action === 'lu') {
        marquerMessagesLus((int) $reservationId);
        return;
    }

    jsonError('Route introuvable.', 404);
}

/**
 * Vérifie que l'utilisateur connecté est bien le propriétaire ou
 * le locataire de cette réservation, et renvoie les deux
 * identifiants ainsi que l'id de l'autre participant.
 */
function verifierParticipant(int $reservationId, int $userId): array
{
    $stmt = getPdo()->prepare('
        SELECT r.id, r.locataire_id, l.owner_id
        FROM reservations r
        JOIN logements l ON l.id = r.logement_id
        WHERE r.id = ?
    ');
    $stmt->execute([$reservationId]);
    $reservation = $stmt->fetch();

    if (!$reservation) {
        jsonError('Réservation introuvable.', 404);
    }

    $locataireId = (int) $reservation['locataire_id'];
    $ownerId = (int) $reservation['owner_id'];

    if ($userId !== $locataireId && $userId !== $ownerId) {
        jsonError('Vous ne faites pas partie de cette discussion.', 403);
    }

    $autreId = $userId === $locataireId ? $ownerId : $locataireId;

    return ['locataire_id' => $locataireId, 'owner_id' => $ownerId, 'autre_id' => $autreId];
}

function listerMessages(int $reservationId): void
{
    $userId = requireAuth();

    $participants = verifierParticipant($reservationId, $userId);

    $stmt = getPdo()->prepare("
        SELECT id, nom_complet, photo_url, telephone,
               (derniere_activite IS NOT NULL AND derniere_activite >= NOW() - INTERVAL " . SECONDES_EN_LIGNE . " SECOND) AS en_ligne
        FROM utilisateurs
        WHERE id = ?
    ");
    $stmt->execute([$participants['autre_id']]);
    $autreParticipant = $stmt->fetch();

    $stmt = getPdo()->prepare('
        SELECT id, sender_id, message, created_at
        FROM messages
        WHERE reservation_id = ?
        ORDER BY created_at ASC
    ');
    $stmt->execute([$reservationId]);
    $messages = $stmt->fetchAll();

    foreach ($messages as &$message) {
        $message['est_moi'] = (int) $message['sender_id'] === $userId;
    }

    jsonResponse([
        'participant' => $autreParticipant ? [
            'id'          => (int) $autreParticipant['id'],
            'nom_complet' => $autreParticipant['nom_complet'],
            'photo_url'   => $autreParticipant['photo_url'],
            'telephone'   => $autreParticipant['telephone'],
            'en_ligne'    => (bool) $autreParticipant['en_ligne'],
        ] : null,
        'messages' => $messages,
    ]);
}

function envoyerMessage(int $reservationId): void
{
    $userId = requireAuth();

    verifierParticipant($reservationId, $userId);

    $body = getJsonBody();
    $message = trim($body['message'] ?? '');

    if (!$message) {
        jsonError('Le message ne peut pas être vide.');
    }

    if (strlen($message) > 1000) {
        jsonError('Le message est trop long (1000 caractères maximum).');
    }

    getPdo()->prepare('
        INSERT INTO messages (reservation_id, sender_id, message)
        VALUES (?, ?, ?)
    ')->execute([$reservationId, $userId, $message]);

    jsonResponse(['message' => 'Message envoyé.'], 201);
}

function marquerMessagesLus(int $reservationId): void
{
    $userId = requireAuth();

    verifierParticipant($reservationId, $userId);

    getPdo()->prepare('
        UPDATE messages SET lu = 1
        WHERE reservation_id = ? AND sender_id != ? AND lu = 0
    ')->execute([$reservationId, $userId]);

    jsonResponse(['message' => 'Messages marqués comme lus.']);
}
