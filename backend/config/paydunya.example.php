<?php
/**
 * Clés API PayDunya (paiements). Copier ce fichier en "paydunya.php"
 * (ignoré par git) et renseigner les vraies valeurs depuis le
 * tableau de bord PayDunya (Intégrez notre API), sections "Clés API
 * Sandbox" (test) et "Clés API de Production" (live).
 *
 * "mode" contrôle test vs live : master_key est propre au compte et
 * reste le même dans les deux cas ; public_key, private_key et
 * token sont en revanche spécifiques à chaque mode. Rester en
 * 'test' tant que les paiements fictifs n'ont pas été vérifiés de
 * bout en bout ; passer à 'live' seulement une fois prêt pour de
 * vrais paiements.
 */

return [
    'mode' => 'test',
    'master_key' => 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    'test' => [
        'public_key'  => 'test_public_xxxxxxxxxxxxxxxxxxxxxxxx',
        'private_key' => 'test_private_xxxxxxxxxxxxxxxxxxxxxxxx',
        'token'       => 'xxxxxxxxxxxxxxxxxxxx',
    ],
    'live' => [
        'public_key'  => 'live_public_xxxxxxxxxxxxxxxxxxxxxxxx',
        'private_key' => 'live_private_xxxxxxxxxxxxxxxxxxxxxxxx',
        'token'       => 'xxxxxxxxxxxxxxxxxxxx',
    ],
];
