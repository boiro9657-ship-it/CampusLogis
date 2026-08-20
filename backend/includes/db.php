<?php
/**
 * Fournit une connexion PDO à MySQL. `withDatabase = false` est
 * utilisé uniquement par install.php, avant que la base
 * "afrihome" n'existe encore.
 *
 * Une seule connexion est ouverte par requête et réutilisée pour
 * tous les appels (requireAdmin(), le gestionnaire de route, etc.)
 * — auparavant chaque appel à getPdo() ouvrait une NOUVELLE
 * connexion MySQL, si bien qu'une seule requête HTTP pouvait à elle
 * seule en ouvrir 2 ou 3. Sur une page comme un tableau de bord qui
 * déclenche une dizaine d'appels API en parallèle, ça faisait
 * facilement 20+ connexions simultanées — largement au-dessus de la
 * limite d'un hébergement mutualisé, d'où des échecs intermittents
 * qui se résolvaient tout seuls après quelques rechargements (le
 * temps que d'anciennes connexions se libèrent).
 */

function getPdo(bool $withDatabase = true): PDO
{
    static $connexion = null;
    static $connexionSansBase = null;

    if (!$withDatabase) {

        if ($connexionSansBase === null) {

            $config = require __DIR__ . '/../config/database.php';

            $dsn = "mysql:host={$config['host']};port={$config['port']};charset={$config['charset']}";

            $connexionSansBase = new PDO($dsn, $config['user'], $config['password'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
        }

        return $connexionSansBase;
    }

    if ($connexion === null) {

        $config = require __DIR__ . '/../config/database.php';

        $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['database']};charset={$config['charset']}";

        $connexion = new PDO($dsn, $config['user'], $config['password'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }

    return $connexion;
}
