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
    $premier = $segments[0] ?? null;
    $action = $segments[1] ?? null;

    if ($method === 'GET' && $premier === null) {
        listerConversations();
        return;
    }

    if ($method === 'GET' && $premier === 'non-lus') {
        compterMessagesNonLus();
        return;
    }

    if ($method === 'DELETE' && $premier === 'message' && is_numeric($action)) {
        supprimerMessage((int) $action);
        return;
    }

    if ($method === 'GET' && is_numeric($premier) && $action === null) {
        listerMessages((int) $premier);
        return;
    }

    if ($method === 'POST' && is_numeric($premier) && $action === null) {
        envoyerMessage((int) $premier);
        return;
    }

    if ($method === 'PUT' && is_numeric($premier) && $action === 'lu') {
        marquerMessagesLus((int) $premier);
        return;
    }

    jsonError('Route introuvable.', 404);
}

/**
 * Liste toutes les conversations de l'utilisateur connecté (une
 * par personne avec qui une réservation le lie), avec le dernier
 * message et le nombre de messages non lus — pour le menu
 * déroulant de l'icône de messagerie et éventuellement une future
 * page dédiée.
 */
function listerConversations(): void
{
    $userId = requireAuth();

    $stmt = getPdo()->prepare('
        SELECT DISTINCT autre_id FROM (
            SELECT l.owner_id AS autre_id
            FROM reservations r
            JOIN logements l ON l.id = r.logement_id
            WHERE r.locataire_id = ?
            UNION
            SELECT r.locataire_id AS autre_id
            FROM reservations r
            JOIN logements l ON l.id = r.logement_id
            WHERE l.owner_id = ?
        ) t
    ');
    $stmt->execute([$userId, $userId]);
    $autresIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $conversations = [];

    $stmtParticipant = getPdo()->prepare('SELECT id, nom_complet, photo_url FROM utilisateurs WHERE id = ?');
    $stmtDernier = getPdo()->prepare('
        SELECT message, created_at FROM messages
        WHERE (sender_id = ? AND destinataire_id = ?) OR (sender_id = ? AND destinataire_id = ?)
        ORDER BY created_at DESC LIMIT 1
    ');
    $stmtNonLus = getPdo()->prepare('
        SELECT COUNT(*) FROM messages WHERE sender_id = ? AND destinataire_id = ? AND lu = 0
    ');

    foreach ($autresIds as $autreId) {

        $stmtParticipant->execute([$autreId]);
        $participant = $stmtParticipant->fetch();

        if (!$participant) {
            continue;
        }

        $stmtDernier->execute([$userId, $autreId, $autreId, $userId]);
        $dernier = $stmtDernier->fetch();

        $stmtNonLus->execute([$autreId, $userId]);
        $nonLus = (int) $stmtNonLus->fetchColumn();

        $conversations[] = [
            'id'                 => (int) $participant['id'],
            'nom_complet'        => $participant['nom_complet'],
            'photo_url'          => $participant['photo_url'],
            'dernier_message'    => $dernier['message'] ?? null,
            'dernier_message_le' => $dernier['created_at'] ?? null,
            'non_lus'            => $nonLus,
        ];
    }

    usort($conversations, function ($a, $b) {
        return strcmp($b['dernier_message_le'] ?? '', $a['dernier_message_le'] ?? '');
    });

    jsonResponse($conversations);
}

function compterMessagesNonLus(): void
{
    $userId = requireAuth();

    $stmt = getPdo()->prepare('SELECT COUNT(*) FROM messages WHERE destinataire_id = ? AND lu = 0');
    $stmt->execute([$userId]);

    jsonResponse(['non_lus' => (int) $stmt->fetchColumn()]);
}

function supprimerMessage(int $messageId): void
{
    $userId = requireAuth();

    $stmt = getPdo()->prepare('SELECT sender_id FROM messages WHERE id = ?');
    $stmt->execute([$messageId]);
    $message = $stmt->fetch();

    if (!$message) {
        jsonError('Message introuvable.', 404);
    }

    if ((int) $message['sender_id'] !== $userId) {
        jsonError('Vous ne pouvez supprimer que vos propres messages.', 403);
    }

    getPdo()->prepare('DELETE FROM messages WHERE id = ?')->execute([$messageId]);

    jsonResponse(['message' => 'Message supprimé.']);
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
