<?php
/**
 * Clés API PayDunya (paiements). Copier ce fichier en "paydunya.php"
 * (ignoré par git) et renseigner les vraies valeurs depuis le
 * tableau de bord PayDunya (Intégration API > Clés API).
 *
 * "mode" contrôle test vs live : master_key et token restent les
 * mêmes dans les deux cas, seules les clés publique/privée
 * changent. Rester en 'test' tant que les paiements fictifs n'ont
 * pas été vérifiés de bout en bout ; passer à 'live' seulement
 * une fois prêt pour de vrais paiements.
 */

return [
    'mode' => 'test',
    'master_key' => 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    'token' => 'xxxxxxxxxxxxxxxxxxxx',
    'test' => [
        'public_key'  => 'test_public_xxxxxxxxxxxxxxxxxxxxxxxx',
        'private_key' => 'test_private_xxxxxxxxxxxxxxxxxxxxxxxx',
    ],
    'live' => [
        'public_key'  => 'live_public_xxxxxxxxxxxxxxxxxxxxxxxx',
        'private_key' => 'live_private_xxxxxxxxxxxxxxxxxxxxxxxx',
    ],
];
