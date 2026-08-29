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

// Pages depuis lesquelles un paiement peut être démarré, et où
// renvoyer l'utilisateur une fois le paiement traité — jamais une
// URL fournie par le client directement (redirection ouverte).
const PAIEMENTS_ORIGINES = [
    'tarifs'           => '/pages/tarifs/tarifs.html',
    'publier-logement' => '/pages/publier-logement/publier-logement.html',
    'publicite'        => '/pages/publicite/publicite.html',
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
    $type = $body['type'] ?? 'abonnement';

    if ($type === 'campagne') {
        creerPaiementCampagne($userId, $body);
        return;
    }

    $plan = $body['plan'] ?? null;

    if (!isset(PAIEMENTS_TARIFS_PLAN[$plan])) {
        jsonError('Formule invalide.');
    }

    $origine = $body['origine'] ?? 'tarifs';

    if (!isset(PAIEMENTS_ORIGINES[$origine])) {
        $origine = 'tarifs';
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
        INSERT INTO paiements (user_id, type, plan, origine, montant, token, statut)
        VALUES (?, "abonnement", ?, ?, ?, ?, "en_attente")
    ');
    $stmt->execute([$userId, $plan, $origine, $montant, $facture['token']]);

    jsonResponse(['invoice_url' => $facture['invoice_url']]);
}

/**
 * Même circuit PayDunya, pour une campagne publicitaire — le montant
 * vient toujours de la campagne déjà créée en base (jamais du
 * client), et la campagne doit appartenir à l'utilisateur connecté
 * et être encore en attente de paiement.
 */
function creerPaiementCampagne(int $userId, array $body): void
{
    $campagneId = (int) ($body['campagne_id'] ?? 0);

    $stmt = getPdo()->prepare('
        SELECT c.*, l.titre AS logement_titre
        FROM campagnes_publicitaires c
        JOIN logements l ON l.id = c.logement_id
        WHERE c.id = ? AND c.user_id = ?
    ');
    $stmt->execute([$campagneId, $userId]);
    $campagne = $stmt->fetch();

    if (!$campagne) {
        jsonError('Campagne introuvable.', 404);
    }

    if ($campagne['statut'] !== 'en_attente_paiement') {
        jsonError('Cette campagne a déjà été payée ou n\'est plus modifiable.');
    }

    $urls = urlsActionsPaiement();

    try {

        $facture = paydunyaCreerFacture(
            (float) $campagne['budget'],
            'TerangaHome - Campagne publicitaire (' . $campagne['logement_titre'] . ')',
            ['user_id' => $userId, 'campagne_id' => $campagneId],
            $urls['return_url'],
            $urls['cancel_url'],
            $urls['callback_url']
        );

    } catch (Throwable $e) {

        error_log('PayDunya - échec création paiement campagne (user ' . $userId . ') : ' . $e->getMessage());
        jsonError('Impossible de créer le paiement pour le moment. Réessayez dans un instant.', 502);

    }

    $stmt = getPdo()->prepare('
        INSERT INTO paiements (user_id, type, campagne_id, origine, montant, token, statut)
        VALUES (?, "campagne", ?, "publicite", ?, ?, "en_attente")
    ');
    $stmt->execute([$userId, $campagneId, $campagne['budget'], $facture['token']]);

    jsonResponse(['invoice_url' => $facture['invoice_url']]);
}

/**
 * URL (relative au site) vers laquelle renvoyer l'utilisateur après
 * un paiement, selon la page depuis laquelle il l'a démarré.
 */
function urlRetourPourOrigine(string $siteUrl, ?string $origine): string
{
    $chemin = PAIEMENTS_ORIGINES[$origine] ?? PAIEMENTS_ORIGINES['tarifs'];

    return $siteUrl . $chemin;
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

    if ($paiement['type'] === 'campagne') {

        // Idempotent comme le reste : si la campagne est déjà active
        // (retour navigateur ET webhook arrivés l'un après l'autre),
        // on ne redémarre pas son décompte de durée depuis le début.
        $stmt = $pdo->prepare("SELECT duree_jours, statut FROM campagnes_publicitaires WHERE id = ?");
        $stmt->execute([$paiement['campagne_id']]);
        $campagne = $stmt->fetch();

        if ($campagne && $campagne['statut'] === 'en_attente_paiement') {

            $pdo->prepare("
                UPDATE campagnes_publicitaires
                SET statut = 'active', date_debut = NOW(), date_fin = DATE_ADD(NOW(), INTERVAL ? DAY)
                WHERE id = ?
            ")->execute([$campagne['duree_jours'], $paiement['campagne_id']]);
        }

        return;
    }

    $pdo->prepare('UPDATE utilisateurs SET plan = ? WHERE id = ?')
        ->execute([$paiement['plan'], $paiement['user_id']]);
}

function gererRetourPaiement(): void
{
    $appConfig = require __DIR__ . '/../../config/app.php';
    $urlParDefaut = $appConfig['site_url'] . PAIEMENTS_ORIGINES['tarifs'];

    $token = $_GET['token'] ?? null;

    if (!$token) {
        header('Location: ' . $urlParDefaut . '?paiement=echec');
        exit;
    }

    $stmt = getPdo()->prepare('SELECT * FROM paiements WHERE token = ?');
    $stmt->execute([$token]);
    $paiement = $stmt->fetch();

    if (!$paiement) {
        header('Location: ' . $urlParDefaut . '?paiement=echec');
        exit;
    }

    $urlRetour = urlRetourPourOrigine($appConfig['site_url'], $paiement['origine']);

    $verification = paydunyaVerifierFacture($token);

    if ($verification['statut'] === 'complete') {

        appliquerPaiementConfirme($paiement);

        $parametre = $paiement['type'] === 'campagne'
            ? 'campagne_id=' . urlencode($paiement['campagne_id'])
            : 'plan=' . urlencode($paiement['plan']);

        header('Location: ' . $urlRetour . '?paiement=succes&' . $parametre);
        exit;

    }

    if ($verification['statut'] === 'echoue') {
        getPdo()->prepare('UPDATE paiements SET statut = "echoue" WHERE id = ? AND statut = "en_attente"')
            ->execute([$paiement['id']]);
    }

    header('Location: ' . $urlRetour . '?paiement=' . ($verification['statut'] === 'en_attente' ? 'en_attente' : 'echec'));
    exit;
}

function gererAnnulationPaiement(): void
{
    $appConfig = require __DIR__ . '/../../config/app.php';
    $urlRetour = $appConfig['site_url'] . PAIEMENTS_ORIGINES['tarifs'];

    $token = $_GET['token'] ?? null;

    if ($token) {

        $stmt = getPdo()->prepare('SELECT * FROM paiements WHERE token = ?');
        $stmt->execute([$token]);
        $paiement = $stmt->fetch();

        if ($paiement) {

            $urlRetour = urlRetourPourOrigine($appConfig['site_url'], $paiement['origine']);

            getPdo()->prepare('UPDATE paiements SET statut = "echoue" WHERE id = ? AND statut = "en_attente"')
                ->execute([$paiement['id']]);

        }

    }

    header('Location: ' . $urlRetour . '?paiement=annule');
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
