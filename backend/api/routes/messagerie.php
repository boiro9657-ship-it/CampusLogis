<?php
/**
 * Espace de discussion entre un propriétaire et un locataire —
 * une conversation par binôme d'utilisateurs (pas par réservation
 * individuelle) : si un locataire réserve plusieurs fois le même
 * logement, ou plusieurs logements du même propriétaire, tous les
 * messages restent dans un seul fil continu. L'accès à la
 * discussion reste conditionné à l'existence d'au moins une vraie
 * réservation entre les deux personnes ("après réservation").
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
    $autreUserId = $segments[0] ?? null;
    $action = $segments[1] ?? null;

    if ($method === 'GET' && is_numeric($autreUserId) && $action === null) {
        listerMessages((int) $autreUserId);
        return;
    }

    if ($method === 'POST' && is_numeric($autreUserId) && $action === null) {
        envoyerMessage((int) $autreUserId);
        return;
    }

    if ($method === 'PUT' && is_numeric($autreUserId) && $action === 'lu') {
        marquerMessagesLus((int) $autreUserId);
        return;
    }

    jsonError('Route introuvable.', 404);
}

/**
 * Vérifie qu'une vraie réservation lie ces deux utilisateurs (dans
 * un sens ou dans l'autre) avant d'autoriser la discussion —
 * n'importe qui ne peut pas juste écrire à n'importe qui.
 */
function verifierRelationReservation(int $userId, int $autreUserId): void
{
    if ($userId === $autreUserId) {
        jsonError('Réservation introuvable.', 404);
    }

    $stmt = getPdo()->prepare('
        SELECT COUNT(*) FROM reservations r
        JOIN logements l ON l.id = r.logement_id
        WHERE (r.locataire_id = ? AND l.owner_id = ?)
           OR (r.locataire_id = ? AND l.owner_id = ?)
    ');
    $stmt->execute([$userId, $autreUserId, $autreUserId, $userId]);

    if ((int) $stmt->fetchColumn() === 0) {
        jsonError('Aucune réservation ne vous lie à cet utilisateur.', 403);
    }
}

function listerMessages(int $autreUserId): void
{
    $userId = requireAuth();

    verifierRelationReservation($userId, $autreUserId);

    $stmt = getPdo()->prepare("
        SELECT id, nom_complet, photo_url, telephone,
               (derniere_activite IS NOT NULL AND derniere_activite >= NOW() - INTERVAL " . SECONDES_EN_LIGNE . " SECOND) AS en_ligne
        FROM utilisateurs
        WHERE id = ?
    ");
    $stmt->execute([$autreUserId]);
    $autreParticipant = $stmt->fetch();

    if (!$autreParticipant) {
        jsonError('Utilisateur introuvable.', 404);
    }

    $stmt = getPdo()->prepare('
        SELECT id, sender_id, message, created_at
        FROM messages
        WHERE (sender_id = ? AND destinataire_id = ?)
           OR (sender_id = ? AND destinataire_id = ?)
        ORDER BY created_at ASC
    ');
    $stmt->execute([$userId, $autreUserId, $autreUserId, $userId]);
    $messages = $stmt->fetchAll();

    foreach ($messages as &$message) {
        $message['est_moi'] = (int) $message['sender_id'] === $userId;
    }

    jsonResponse([
        'participant' => [
            'id'          => (int) $autreParticipant['id'],
            'nom_complet' => $autreParticipant['nom_complet'],
            'photo_url'   => $autreParticipant['photo_url'],
            'telephone'   => $autreParticipant['telephone'],
            'en_ligne'    => (bool) $autreParticipant['en_ligne'],
        ],
        'messages' => $messages,
    ]);
}

function envoyerMessage(int $autreUserId): void
{
    $userId = requireAuth();

    verifierRelationReservation($userId, $autreUserId);

    $body = getJsonBody();
    $message = trim($body['message'] ?? '');

    if (!$message) {
        jsonError('Le message ne peut pas être vide.');
    }

    if (strlen($message) > 1000) {
        jsonError('Le message est trop long (1000 caractères maximum).');
    }

    getPdo()->prepare('
        INSERT INTO messages (sender_id, destinataire_id, message)
        VALUES (?, ?, ?)
    ')->execute([$userId, $autreUserId, $message]);

    jsonResponse(['message' => 'Message envoyé.'], 201);
}

function marquerMessagesLus(int $autreUserId): void
{
    $userId = requireAuth();

    verifierRelationReservation($userId, $autreUserId);

    getPdo()->prepare('
        UPDATE messages SET lu = 1
        WHERE sender_id = ? AND destinataire_id = ? AND lu = 0
    ')->execute([$autreUserId, $userId]);

    jsonResponse(['message' => 'Messages marqués comme lus.']);
}
