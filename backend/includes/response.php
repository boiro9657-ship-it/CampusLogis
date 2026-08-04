<?php
/**
 * Petits helpers pour renvoyer des réponses JSON cohérentes
 * depuis n'importe quel endpoint de l'API.
 */

function jsonResponse($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError(string $message, int $status = 400): void
{
    jsonResponse(['error' => $message], $status);
}

/**
 * Lit le corps JSON de la requête et le retourne en tableau
 * associatif (tableau vide si le corps est absent ou invalide).
 */
function getJsonBody(): array
{
    $raw = file_get_contents('php://input');

    if (!$raw) {
        return [];
    }

    $data = json_decode($raw, true);

    return is_array($data) ? $data : [];
}
