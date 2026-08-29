<?php
/**
 * Réglages globaux du site, en lecture publique (aucune donnée
 * sensible dedans — juste des interrupteurs d'affichage comme
 * "statistiques publiques masquées"). L'écriture est réservée à
 * l'admin, voir changerParametreAdmin() dans admin.php.
 */

require_once __DIR__ . '/../../includes/session.php';

function handleParametresRoute(array $segments, string $method): void
{
    if ($method === 'GET' && ($segments[0] ?? null) === null) {
        listParametresPublics();
        return;
    }

    jsonError('Route introuvable.', 404);
}

function listParametresPublics(): void
{
    $stmt = getPdo()->query('SELECT cle, valeur FROM parametres_site');

    $parametres = [];

    foreach ($stmt->fetchAll() as $ligne) {
        $parametres[$ligne['cle']] = $ligne['valeur'];
    }

    jsonResponse($parametres);
}
