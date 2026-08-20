<?php
/**
 * Témoignages sur TerangaHome en tant que plateforme (ex. "Grâce à
 * TerangaHome, j'ai loué mon appartement") — distincts des
 * commentaires laissés sur une annonce précise (voir commentaires.php
 * / logements.php). N'importe quel compte connecté peut en soumettre
 * un ; publié à l'accueil seulement après validation par un admin
 * (voir admin.php), jamais automatiquement.
 */

require_once __DIR__ . '/../../includes/session.php';

function handleTemoignagesRoute(array $segments, string $method): void
{
    $first = $segments[0] ?? null;

    if ($method === 'GET' && $first === null) {
        listTemoignagesApprouves();
        return;
    }

    if ($method === 'POST' && $first === null) {
        creerTemoignage();
        return;
    }

    if ($method === 'GET' && $first === 'mine') {
        monTemoignage();
        return;
    }

    jsonError('Route introuvable.', 404);
}

/**
 * Témoignages publics affichés à l'accueil — uniquement ceux
 * approuvés par un admin, jamais les autres.
 */
function listTemoignagesApprouves(): void
{
    $limite = isset($_GET['limite']) ? min(20, max(1, (int) $_GET['limite'])) : 10;

    $stmt = getPdo()->prepare("
        SELECT t.id, t.message, t.role_auteur, t.created_at,
               u.nom_complet AS auteur_nom, u.photo_url AS auteur_photo
        FROM temoignages_plateforme t
        JOIN utilisateurs u ON u.id = t.user_id
        WHERE t.statut = 'approuve'
        ORDER BY t.created_at DESC
        LIMIT " . $limite . "
    ");
    $stmt->execute();

    jsonResponse($stmt->fetchAll());
}

/**
 * Le témoignage (le plus récent) du compte connecté, quel que soit
 * son statut — utilisé par le tableau de bord pour savoir s'il faut
 * afficher le formulaire ou un message "en attente de validation".
 */
function monTemoignage(): void
{
    $userId = requireAuth();

    $stmt = getPdo()->prepare('
        SELECT id, message, statut, created_at
        FROM temoignages_plateforme
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 1
    ');
    $stmt->execute([$userId]);

    jsonResponse($stmt->fetch() ?: null);
}

function creerTemoignage(): void
{
    $userId = requireAuth();

    $stmt = getPdo()->prepare('SELECT role FROM utilisateurs WHERE id = ?');
    $stmt->execute([$userId]);
    $role = $stmt->fetchColumn();

    if (!in_array($role, ['locataire', 'proprietaire'], true)) {
        jsonError('Seuls les locataires et propriétaires peuvent témoigner.', 403);
    }

    $body = getJsonBody();
    $message = trim($body['message'] ?? '');

    if (mb_strlen($message) < 10) {
        jsonError('Merci de partager votre expérience en quelques mots (10 caractères minimum).');
    }

    if (mb_strlen($message) > 500) {
        jsonError('Votre témoignage est trop long (500 caractères maximum).');
    }

    $pdo = getPdo();

    // Un seul témoignage EN ATTENTE ou APPROUVÉ par compte à la fois —
    // évite le spam sans empêcher un nouvel essai après un rejet.
    $stmt = $pdo->prepare("
        SELECT COUNT(*) FROM temoignages_plateforme
        WHERE user_id = ? AND statut IN ('en_attente', 'approuve')
    ");
    $stmt->execute([$userId]);

    if ((int) $stmt->fetchColumn() > 0) {
        jsonError('Vous avez déjà partagé un témoignage.', 409);
    }

    $stmt = $pdo->prepare('
        INSERT INTO temoignages_plateforme (user_id, message, role_auteur)
        VALUES (?, ?, ?)
    ');
    $stmt->execute([$userId, $message, $role]);

    jsonResponse(['message' => 'Merci ! Votre témoignage sera visible après validation.'], 201);
}
