<?php
/**
 * Routes d'administration : vue et gestion complètes des
 * utilisateurs, logements, réservations et messages de contact.
 * Toutes réservées au rôle admin via requireAdmin().
 */

require_once __DIR__ . '/../../includes/session.php';

function handleAdminRoute(array $segments, string $method): void
{
    requireAdmin();

    $resource = $segments[0] ?? null;
    $id = $segments[1] ?? null;

    if ($resource === 'utilisateurs' && $method === 'GET' && $id === null) {
        listUtilisateurs();
        return;
    }

    if ($resource === 'utilisateurs' && $method === 'DELETE' && is_numeric($id)) {
        supprimerUtilisateur((int) $id);
        return;
    }

    if ($resource === 'logements' && $method === 'GET' && $id === null) {
        listTousLogements();
        return;
    }

    if ($resource === 'logements' && $method === 'DELETE' && is_numeric($id)) {
        supprimerLogementAdmin((int) $id);
        return;
    }

    if ($resource === 'logements' && $method === 'PUT' && is_numeric($id) && ($segments[2] ?? null) === 'valider') {
        validerLogementAdmin((int) $id);
        return;
    }

    if ($resource === 'reservations' && $method === 'GET' && $id === null) {
        listToutesReservations();
        return;
    }

    if ($resource === 'messages' && $method === 'GET' && $id === null) {
        listMessages();
        return;
    }

    if ($resource === 'messages' && $method === 'DELETE' && is_numeric($id)) {
        supprimerMessage((int) $id);
        return;
    }

    if ($resource === 'commentaires' && $method === 'GET' && $id === null) {
        listCommentairesAdmin();
        return;
    }

    if ($resource === 'commentaires' && $method === 'DELETE' && is_numeric($id)) {
        supprimerCommentaireAdmin((int) $id);
        return;
    }

    jsonError('Route introuvable.', 404);
}

function listUtilisateurs(): void
{
    $stmt = getPdo()->query('
        SELECT id, nom_complet, email, telephone, role, created_at
        FROM utilisateurs
        ORDER BY created_at DESC
    ');

    jsonResponse($stmt->fetchAll());
}

function supprimerUtilisateur(int $id): void
{
    getPdo()->prepare('DELETE FROM utilisateurs WHERE id = ?')->execute([$id]);

    jsonResponse(['message' => 'Utilisateur supprimé.']);
}

function listTousLogements(): void
{
    $stmt = getPdo()->query('
        SELECT l.*, u.nom_complet AS proprietaire_nom
        FROM logements l
        LEFT JOIN utilisateurs u ON u.id = l.owner_id
        ORDER BY l.created_at DESC
    ');

    jsonResponse($stmt->fetchAll());
}

function supprimerLogementAdmin(int $id): void
{
    getPdo()->prepare('DELETE FROM logements WHERE id = ?')->execute([$id]);

    jsonResponse(['message' => 'Logement supprimé.']);
}

function validerLogementAdmin(int $id): void
{
    $body = getJsonBody();
    $statut = $body['statut_validation'] ?? null;

    if (!in_array($statut, ['approuve', 'rejete'], true)) {
        jsonError('Statut de validation invalide.');
    }

    getPdo()->prepare('UPDATE logements SET statut_validation = ? WHERE id = ?')->execute([$statut, $id]);

    jsonResponse(['message' => 'Statut de validation mis à jour.']);
}

function listToutesReservations(): void
{
    $stmt = getPdo()->query('
        SELECT r.*, l.titre AS logement_titre,
               u.nom_complet AS locataire_nom, u.email AS locataire_email
        FROM reservations r
        JOIN logements l ON l.id = r.logement_id
        JOIN utilisateurs u ON u.id = r.locataire_id
        ORDER BY r.created_at DESC
    ');

    jsonResponse($stmt->fetchAll());
}

function listMessages(): void
{
    $stmt = getPdo()->query('
        SELECT * FROM messages_contact ORDER BY created_at DESC
    ');

    jsonResponse($stmt->fetchAll());
}

function supprimerMessage(int $id): void
{
    getPdo()->prepare('DELETE FROM messages_contact WHERE id = ?')->execute([$id]);

    jsonResponse(['message' => 'Message supprimé.']);
}

function listCommentairesAdmin(): void
{
    $stmt = getPdo()->query('
        SELECT c.id, c.message, c.created_at,
               u.nom_complet AS auteur_nom, u.email AS auteur_email,
               l.id AS logement_id, l.titre AS logement_titre
        FROM commentaires c
        JOIN utilisateurs u ON u.id = c.user_id
        JOIN logements l ON l.id = c.logement_id
        ORDER BY c.created_at DESC
    ');

    jsonResponse($stmt->fetchAll());
}

function supprimerCommentaireAdmin(int $id): void
{
    getPdo()->prepare('DELETE FROM commentaires WHERE id = ?')->execute([$id]);

    jsonResponse(['message' => 'Commentaire supprimé.']);
}
