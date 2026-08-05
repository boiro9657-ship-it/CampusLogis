<?php
/**
 * Suivi des visites du site : chaque page appelle POST /visites
 * à son chargement (voir global.js). Aucune donnée personnelle
 * stockée — seule une empreinte de l'IP (hachée, non réversible)
 * permet de distinguer les visiteurs uniques.
 */

require_once __DIR__ . '/../../includes/session.php';

function handleVisitesRoute(array $segments, string $method): void
{
    if ($method === 'POST' && ($segments[0] ?? null) === null) {
        enregistrerVisite();
        return;
    }

    jsonError('Route introuvable.', 404);
}

function enregistrerVisite(): void
{
    $body = getJsonBody();
    $page = trim($body['page'] ?? '/');

    if (strlen($page) > 255) {
        $page = substr($page, 0, 255);
    }

    $ip = $_SERVER['REMOTE_ADDR'] ?? 'inconnu';
    $ipHash = hash('sha256', $ip . 'terangahome_sel_visite');

    getPdo()->prepare('
        INSERT INTO visites (page, ip_hash) VALUES (?, ?)
    ')->execute([$page, $ipHash]);

    jsonResponse(['message' => 'ok'], 201);
}
