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
 * facilement 20+ connexions simultanées.
 *
 * Connexion PDO::ATTR_PERSISTENT : PHP réutilise une connexion TCP
 * déjà ouverte vers MySQL au lieu d'en établir une nouvelle à
 * chaque requête HTTP — sur un hébergement mutualisé (Hostinger),
 * ouvrir trop de nouvelles connexions en rafale déclenche une
 * limite anti-abus côté hébergeur ("SQLSTATE[HY000] [2002]
 * Operation not permitted"), pas une vraie limite MySQL. C'est ce
 * qui causait les statistiques/pages qui "disparaissent puis
 * reviennent après plusieurs rechargements" : ça finissait par
 * réussir une fois assez d'anciennes connexions libérées. En plus
 * du connexions persistantes, quelques tentatives avec une courte
 * pause absorbent les rares échecs encore possibles pendant une
 * rafale, au lieu de les répercuter jusqu'à l'utilisateur.
 */

function connecterAvecRetries(string $dsn, string $user, string $password, array $options): PDO
{
    $tentatives = 0;

    while (true) {

        try {

            return new PDO($dsn, $user, $password, $options);

        } catch (PDOException $e) {

            $tentatives++;

            if ($tentatives >= 3) {
                throw $e;
            }

            usleep(150000 * $tentatives);
        }
    }
}

function getPdo(bool $withDatabase = true): PDO
{
    static $connexion = null;
    static $connexionSansBase = null;

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_PERSISTENT         => true,
    ];

    if (!$withDatabase) {

        if ($connexionSansBase === null) {

            $config = require __DIR__ . '/../config/database.php';

            $dsn = "mysql:host={$config['host']};port={$config['port']};charset={$config['charset']}";

            $connexionSansBase = connecterAvecRetries($dsn, $config['user'], $config['password'], $options);
        }

        return $connexionSansBase;
    }

    if ($connexion === null) {

        $config = require __DIR__ . '/../config/database.php';

        $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['database']};charset={$config['charset']}";

        $connexion = connecterAvecRetries($dsn, $config['user'], $config['password'], $options);
    }

    return $connexion;
}
