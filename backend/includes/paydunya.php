<?php
/**
 * Intégration PayDunya — paiement par redirection ("Checkout
 * Invoice"). Les clés réelles vivent dans backend/config/paydunya.php
 * (ignoré par git), jamais exposées au frontend ni journalisées.
 *
 * Le mode test utilise un sous-chemin d'API et des URLs de paiement
 * entièrement séparés du mode live (pas seulement des clés
 * différentes sur la même URL) — voir paydunyaBaseUrl().
 */

function paydunyaConfig(): array
{
    $configPath = __DIR__ . '/../config/paydunya.php';

    if (!file_exists($configPath)) {
        throw new RuntimeException('backend/config/paydunya.php introuvable.');
    }

    return require $configPath;
}

function paydunyaEnModeLive(): bool
{
    return paydunyaConfig()['mode'] === 'live';
}

function paydunyaBaseUrl(): string
{
    return paydunyaEnModeLive()
        ? 'https://app.paydunya.com/api/v1'
        : 'https://app.paydunya.com/sandbox-api/v1';
}

function paydunyaHeaders(): array
{
    $config = paydunyaConfig();
    $cles = $config[$config['mode']];

    return [
        'Content-Type: application/json',
        'PAYDUNYA-MASTER-KEY: ' . $config['master_key'],
        'PAYDUNYA-PRIVATE-KEY: ' . $cles['private_key'],
        'PAYDUNYA-TOKEN: ' . $cles['token'],
        'PAYDUNYA-PUBLIC-KEY: ' . $cles['public_key'],
    ];
}

function paydunyaRequete(string $methode, string $chemin, ?array $corps = null): array
{
    $ch = curl_init(paydunyaBaseUrl() . $chemin);

    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, paydunyaHeaders());
    curl_setopt($ch, CURLOPT_TIMEOUT, 25);

    if ($methode === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($corps, JSON_UNESCAPED_UNICODE));
    }

    $reponse = curl_exec($ch);
    $erreurCurl = curl_error($ch);
    curl_close($ch);

    if ($reponse === false) {
        error_log('PayDunya - erreur réseau (' . $chemin . ') : ' . $erreurCurl);
        return ['response_code' => null];
    }

    $donnees = json_decode($reponse, true);

    if (!is_array($donnees)) {
        error_log('PayDunya - réponse invalide (' . $chemin . ') : ' . $reponse);
        return ['response_code' => null];
    }

    return $donnees;
}

/**
 * Crée une facture PayDunya et renvoie l'URL de paiement vers
 * laquelle rediriger le client, ainsi que le jeton de la facture.
 * Lève une exception si la création échoue (clés invalides, montant
 * trop faible, réseau...) — à l'appelant de répondre proprement.
 */
function paydunyaCreerFacture(
    float $montant,
    string $description,
    array $customData,
    string $returnUrl,
    string $cancelUrl,
    string $callbackUrl
): array {

    $appConfig = require __DIR__ . '/../config/app.php';

    $corps = [
        'invoice' => [
            'total_amount' => $montant,
            'description'  => $description,
        ],
        'store' => [
            'name'        => 'TerangaHome',
            'tagline'     => 'La référence des logements au Sénégal',
            'website_url' => $appConfig['site_url'],
        ],
        'actions' => [
            'cancel_url'   => $cancelUrl,
            'return_url'   => $returnUrl,
            'callback_url' => $callbackUrl,
        ],
        'custom_data' => $customData,
    ];

    $reponse = paydunyaRequete('POST', '/checkout-invoice/create', $corps);

    if (($reponse['response_code'] ?? null) !== '00') {
        error_log('PayDunya - création facture échouée : ' . json_encode($reponse));
        throw new RuntimeException($reponse['response_text'] ?? 'Création de la facture PayDunya échouée.');
    }

    return [
        'token'       => $reponse['token'],
        // PayDunya renvoie l'URL de paiement directement dans
        // response_text en cas de succès (pas un champ dédié).
        'invoice_url' => $reponse['response_text'],
    ];
}

/**
 * Vérifie le statut réel d'une facture directement auprès de
 * PayDunya. Ne jamais se fier au seul retour navigateur (return_url)
 * ou au corps brut du webhook (callback_url) : les deux peuvent être
 * falsifiés par un tiers, seule cette vérification serveur fait foi.
 */
function paydunyaVerifierFacture(string $token): array
{
    $reponse = paydunyaRequete('GET', '/checkout-invoice/confirm/' . urlencode($token));

    if (($reponse['response_code'] ?? null) !== '00') {
        return [
            'statut'      => 'echoue',
            'montant'     => null,
            'custom_data' => [],
        ];
    }

    $statutPaydunya = $reponse['status'] ?? 'pending';

    $statut = 'en_attente';
    if ($statutPaydunya === 'completed') $statut = 'complete';
    if ($statutPaydunya === 'cancelled') $statut = 'echoue';

    return [
        'statut'      => $statut,
        'montant'     => $reponse['invoice']['total_amount'] ?? null,
        'custom_data' => $reponse['custom_data'] ?? [],
    ];
}
