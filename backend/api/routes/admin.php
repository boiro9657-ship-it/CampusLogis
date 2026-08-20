<?php
/**
 * Routes d'administration : vue et gestion complètes des
 * utilisateurs, logements, réservations et messages de contact.
 * Toutes réservées au rôle admin via requireAdmin().
 */

require_once __DIR__ . '/../../includes/session.php';
require_once __DIR__ . '/../../includes/mail.php';
require_once __DIR__ . '/notifications.php';
// Réutilise creerLogementAdmin() et les helpers de traitement des
// médias/équipements (extraireFichiers, enregistrerMedia...) sans
// dupliquer cette logique — voir creerLogementAdmin() plus bas.
// require_once amène aussi includes/uploads.php avec lui.
require_once __DIR__ . '/logements.php';

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

    if ($resource === 'logements' && $method === 'POST' && $id === null) {
        creerLogementAdmin();
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

    if ($resource === 'logements' && $method === 'PUT' && is_numeric($id) && ($segments[2] ?? null) === null) {
        updateLogementAdmin((int) $id);
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

    if ($resource === 'temoignages' && $method === 'GET' && $id === null) {
        listTemoignagesAdmin();
        return;
    }

    if ($resource === 'temoignages' && $method === 'PUT' && is_numeric($id) && ($segments[2] ?? null) === 'valider') {
        validerTemoignageAdmin((int) $id);
        return;
    }

    if ($resource === 'temoignages' && $method === 'DELETE' && is_numeric($id)) {
        supprimerTemoignageAdmin((int) $id);
        return;
    }

    if ($resource === 'visites' && $method === 'GET' && $id === 'stats') {
        statsVisites();
        return;
    }

    if ($resource === 'newsletter' && $method === 'POST') {
        envoyerNewsletter();
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
    // "l.vues" existe déjà (compteur de consultations, incrémenté
    // dans getLogement()) ; "whatsapp_clics_total" est calculé ici
    // pour donner à l'admin, par annonce, le nombre de demandes de
    // contact générées via le bouton WhatsApp (voir
    // enregistrerClicWhatsapp() dans logements.php).
    $stmt = getPdo()->query('
        SELECT l.*, u.nom_complet AS proprietaire_nom,
            (SELECT COUNT(*) FROM whatsapp_clics w WHERE w.logement_id = l.id) AS whatsapp_clics_total
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

/**
 * Modifie N'IMPORTE QUELLE annonce (propriétaire réel ou publiée par
 * l'équipe sans compte) — réutilise la même logique/validation que
 * l'édition côté propriétaire (appliquerMiseAJourLogement(), définie
 * dans logements.php), seule l'autorisation diffère : ici requireAdmin()
 * déjà vérifié en tête de handleAdminRoute(), pas de vérification de
 * propriété.
 */
function updateLogementAdmin(int $id): void
{
    $stmt = getPdo()->prepare('SELECT id FROM logements WHERE id = ?');
    $stmt->execute([$id]);

    if (!$stmt->fetch()) {
        jsonError('Logement introuvable.', 404);
    }

    appliquerMiseAJourLogement($id, getJsonBody());
}

function validerLogementAdmin(int $id): void
{
    $body = getJsonBody();
    $statut = $body['statut_validation'] ?? null;

    if (!in_array($statut, ['approuve', 'rejete'], true)) {
        jsonError('Statut de validation invalide.');
    }

    $pdo = getPdo();

    $stmt = $pdo->prepare('SELECT statut_validation, owner_id, titre, ville FROM logements WHERE id = ?');
    $stmt->execute([$id]);
    $logement = $stmt->fetch();

    if (!$logement) {
        jsonError('Logement introuvable.', 404);
    }

    $pdo->prepare('UPDATE logements SET statut_validation = ? WHERE id = ?')->execute([$statut, $id]);

    // Notifie les utilisateurs uniquement au moment où l'annonce
    // devient réellement publique (pas si elle l'était déjà, pour
    // éviter les doublons si l'admin rejoue l'action).
    if ($statut === 'approuve' && $logement['statut_validation'] !== 'approuve' && $logement['owner_id']) {
        creerNotificationsNouveauLogement((int) $id, (int) $logement['owner_id'], $logement['titre'], $logement['ville']);
    }

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

/**
 * Tous les témoignages plateforme (tous statuts confondus), pour la
 * file de modération admin — voir temoignages.php pour la version
 * publique (approuvés uniquement).
 */
function listTemoignagesAdmin(): void
{
    $stmt = getPdo()->query("
        SELECT t.*, u.nom_complet AS auteur_nom, u.email AS auteur_email
        FROM temoignages_plateforme t
        JOIN utilisateurs u ON u.id = t.user_id
        ORDER BY t.created_at DESC
    ");

    jsonResponse($stmt->fetchAll());
}

function validerTemoignageAdmin(int $id): void
{
    $body = getJsonBody();
    $statut = $body['statut'] ?? null;

    if (!in_array($statut, ['approuve', 'rejete'], true)) {
        jsonError('Statut invalide.');
    }

    getPdo()->prepare('UPDATE temoignages_plateforme SET statut = ? WHERE id = ?')->execute([$statut, $id]);

    jsonResponse(['message' => 'Témoignage mis à jour.']);
}

function supprimerTemoignageAdmin(int $id): void
{
    getPdo()->prepare('DELETE FROM temoignages_plateforme WHERE id = ?')->execute([$id]);

    jsonResponse(['message' => 'Témoignage supprimé.']);
}

/**
 * Statistiques réelles de fréquentation (aucun chiffre inventé) :
 * total de pages vues, visiteurs uniques (par empreinte IP),
 * vues du jour, de la semaine, et détail des 7 derniers jours
 * pour un mini graphique.
 */
function statsVisites(): void
{
    $pdo = getPdo();

    $totalVues = $pdo->query('SELECT COUNT(*) FROM visites')->fetchColumn();
    $visiteursUniques = $pdo->query('SELECT COUNT(DISTINCT ip_hash) FROM visites')->fetchColumn();

    $vuesAujourdhui = $pdo->query("
        SELECT COUNT(*) FROM visites WHERE DATE(created_at) = CURDATE()
    ")->fetchColumn();

    $vuesSemaine = $pdo->query("
        SELECT COUNT(*) FROM visites WHERE created_at >= (CURDATE() - INTERVAL 7 DAY)
    ")->fetchColumn();

    $stmt = $pdo->query("
        SELECT DATE(created_at) AS jour, COUNT(*) AS vues, COUNT(DISTINCT ip_hash) AS uniques
        FROM visites
        WHERE created_at >= (CURDATE() - INTERVAL 6 DAY)
        GROUP BY DATE(created_at)
        ORDER BY jour ASC
    ");
    $derniersJours = $stmt->fetchAll();

    jsonResponse([
        'total_vues'        => (int) $totalVues,
        'visiteurs_uniques' => (int) $visiteursUniques,
        'vues_aujourdhui'   => (int) $vuesAujourdhui,
        'vues_semaine'      => (int) $vuesSemaine,
        'derniers_jours'    => $derniersJours,
    ]);
}

/**
 * Envoie un email de newsletter à tous les utilisateurs inscrits,
 * un par un via le même SMTP Gmail que la réinitialisation de mot
 * de passe. Continue même si un envoi échoue (adresse invalide,
 * etc.) et rapporte le nombre réel d'envois réussis à l'admin —
 * pas de faux "envoyé à tous" si certains ont échoué.
 */
function envoyerNewsletter(): void
{
    $body = getJsonBody();

    $sujet = trim($body['sujet'] ?? '');
    $message = trim($body['message'] ?? '');

    if (!$sujet || !$message) {
        jsonError('Le sujet et le message sont obligatoires.');
    }

    $destinataires = getPdo()->query('SELECT email, nom_complet FROM utilisateurs')->fetchAll();

    $corpsHtml = '<p>' . nl2br(htmlspecialchars($message)) . '</p><p>— L\'équipe TerangaHome</p>';

    $envoyes = 0;

    foreach ($destinataires as $destinataire) {

        if (envoyerEmail($destinataire['email'], $sujet, $corpsHtml)) {
            $envoyes++;
        }
    }

    jsonResponse([
        'message'  => "Newsletter envoyée à {$envoyes} utilisateur(s) sur " . count($destinataires) . '.',
        'envoyes'  => $envoyes,
        'total'    => count($destinataires),
    ]);
}
