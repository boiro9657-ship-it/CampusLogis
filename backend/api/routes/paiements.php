<?php
/**
 * Paiement des formules Premium/Pro via PayDunya (paiement par
 * redirection — "Checkout Invoice"). Le statut d'un paiement n'est
 * jamais déduit du seul retour navigateur ni du corps brut du
 * webhook : il est toujours revérifié directement auprès de
 * PayDunya (paydunyaVerifierFacture) avant de mettre à jour le
 * plan d'un compte, pour ne jamais dépendre d'une donnée que
 * quelqu'un pourrait falsifier côté client.
 */

require_once __DIR__ . '/../../includes/session.php';
require_once __DIR__ . '/../../includes/paydunya.php';

const PAIEMENTS_TARIFS_PLAN = [
    'premium' => 5000,
    'pro'     => 15000,
];

function handlePaiementsRoute(array $segments, string $method): void
{
    $premier = $segments[0] ?? null;

    if ($method === 'POST' && $premier === 'creer') {
        creerPaiement();
        return;
    }

    if ($method === 'GET' && $premier === 'retour') {
        gererRetourPaiement();
        return;
    }

    if ($method === 'GET' && $premier === 'annulation') {
        gererAnnulationPaiement();
        return;
    }

    if ($method === 'POST' && $premier === 'callback') {
        gererCallbackPaiement();
        return;
    }

    jsonError('Route introuvable.', 404);
}

function urlsActionsPaiement(): array
{
    $appConfig = require __DIR__ . '/../../config/app.php';
    $base = $appConfig['site_url'] . '/backend/api/paiements';

    return [
        'return_url'   => $base . '/retour',
        'cancel_url'   => $base . '/annulation',
        'callback_url' => $base . '/callback',
    ];
}

function creerPaiement(): void
{
    $userId = requireAuth();

    $body = getJsonBody();
    $plan = $body['plan'] ?? null;

    if (!isset(PAIEMENTS_TARIFS_PLAN[$plan])) {
        jsonError('Formule invalide.');
    }

    $montant = PAIEMENTS_TARIFS_PLAN[$plan];
    $urls = urlsActionsPaiement();

    try {

        $facture = paydunyaCreerFacture(
            $montant,
            'TerangaHome - Abonnement ' . ucfirst($plan) . ' (1 mois)',
            ['user_id' => $userId, 'plan' => $plan],
            $urls['return_url'],
            $urls['cancel_url'],
            $urls['callback_url']
        );

    } catch (Throwable $e) {

        error_log('PayDunya - échec création paiement (user ' . $userId . ') : ' . $e->getMessage());
        jsonError('Impossible de créer le paiement pour le moment. Réessayez dans un instant.', 502);

    }

    $stmt = getPdo()->prepare('
        INSERT INTO paiements (user_id, plan, montant, token, statut)
        VALUES (?, ?, ?, ?, "en_attente")
    ');
    $stmt->execute([$userId, $plan, $montant, $facture['token']]);

    jsonResponse(['invoice_url' => $facture['invoice_url']]);
}

/**
 * Applique le paiement confirmé au compte concerné : passe le plan
 * de l'utilisateur et marque la ligne locale "complete". Idempotent
 * — si la ligne est déjà "complete" (rechargement de la page de
 * retour, appel du webhook après le retour navigateur...), ne
 * refait rien.
 */
function appliquerPaiementConfirme(array $paiement): void
{
    if ($paiement['statut'] === 'complete') {
        return;
    }

    $pdo = getPdo();

    $pdo->prepare('UPDATE paiements SET statut = "complete" WHERE id = ?')
        ->execute([$paiement['id']]);

    $pdo->prepare('UPDATE utilisateurs SET plan = ? WHERE id = ?')
        ->execute([$paiement['plan'], $paiement['user_id']]);
}

function gererRetourPaiement(): void
{
    $appConfig = require __DIR__ . '/../../config/app.php';
    $urlTarifs = $appConfig['site_url'] . '/pages/tarifs/tarifs.html';

    $token = $_GET['token'] ?? null;

    if (!$token) {
        header('Location: ' . $urlTarifs . '?paiement=echec');
        exit;
    }

    $stmt = getPdo()->prepare('SELECT * FROM paiements WHERE token = ?');
    $stmt->execute([$token]);
    $paiement = $stmt->fetch();

    if (!$paiement) {
        header('Location: ' . $urlTarifs . '?paiement=echec');
        exit;
    }

    $verification = paydunyaVerifierFacture($token);

    if ($verification['statut'] === 'complete') {

        appliquerPaiementConfirme($paiement);
        header('Location: ' . $urlTarifs . '?paiement=succes');
        exit;

    }

    if ($verification['statut'] === 'echoue') {
        getPdo()->prepare('UPDATE paiements SET statut = "echoue" WHERE id = ? AND statut = "en_attente"')
            ->execute([$paiement['id']]);
    }

    header('Location: ' . $urlTarifs . '?paiement=' . ($verification['statut'] === 'en_attente' ? 'en_attente' : 'echec'));
    exit;
}

function gererAnnulationPaiement(): void
{
    $appConfig = require __DIR__ . '/../../config/app.php';
    $urlTarifs = $appConfig['site_url'] . '/pages/tarifs/tarifs.html';

    $token = $_GET['token'] ?? null;

    if ($token) {
        getPdo()->prepare('UPDATE paiements SET statut = "echoue" WHERE token = ? AND statut = "en_attente"')
            ->execute([$token]);
    }

    header('Location: ' . $urlTarifs . '?paiement=annule');
    exit;
}

/**
 * Webhook serveur-à-serveur PayDunya (IPN). Le format exact du
 * corps envoyé n'est pas garanti stable ; on en extrait le jeton
 * de facture par tous les moyens raisonnables, mais la seule chose
 * qui compte vraiment est la revérification indépendante ci-dessous
 * — jamais le statut affirmé dans le corps de la requête elle-même.
 */
function gererCallbackPaiement(): void
{
    $token = $_POST['token'] ?? $_GET['token'] ?? null;

    if (!$token && isset($_POST['data'])) {

        $donnees = json_decode($_POST['data'], true);
        $token = $donnees['token'] ?? $donnees['invoice']['token'] ?? null;

    }

    if (!$token) {
        error_log('PayDunya - callback reçu sans jeton exploitable : ' . json_encode($_POST));
        jsonResponse(['ok' => false], 200);
    }

    $stmt = getPdo()->prepare('SELECT * FROM paiements WHERE token = ?');
    $stmt->execute([$token]);
    $paiement = $stmt->fetch();

    if (!$paiement) {
        jsonResponse(['ok' => false], 200);
    }

    $verification = paydunyaVerifierFacture($token);

    if ($verification['statut'] === 'complete') {
        appliquerPaiementConfirme($paiement);
    } elseif ($verification['statut'] === 'echoue') {
        getPdo()->prepare('UPDATE paiements SET statut = "echoue" WHERE id = ? AND statut = "en_attente"')
            ->execute([$paiement['id']]);
    }

    // PayDunya attend une réponse 200 pour considérer le webhook
    // reçu ; le contenu exact du corps n'est pas vérifié par eux.
    jsonResponse(['ok' => true], 200);
}
