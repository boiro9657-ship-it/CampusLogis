<?php
/**
 * Fournit une connexion PDO à MySQL. `withDatabase = false` est
 * utilisé uniquement par install.php, avant que la base
 * "afrihome" n'existe encore.
 */

function getPdo(bool $withDatabase = true): PDO
{
    $config = require __DIR__ . '/../config/database.php';

    $dsn = "mysql:host={$config['host']};port={$config['port']}";

    if ($withDatabase) {
        $dsn .= ";dbname={$config['database']}";
    }

    $dsn .= ";charset={$config['charset']}";

    return new PDO($dsn, $config['user'], $config['password'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}
