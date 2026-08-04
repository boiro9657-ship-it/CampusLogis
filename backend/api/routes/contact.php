<?php
/**
 * Route du formulaire de contact : ouverte à tous, pas
 * d'authentification requise.
 */

require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/response.php';

function handleContactRoute(array $segments, string $method): void
{
    if ($method === 'POST') {
        envoyerMessage();
        return;
    }

    jsonError('Route introuvable.', 404);
}

function envoyerMessage(): void
{
    $body = getJsonBody();

    $nom = trim($body['nom'] ?? '');
    $email = trim($body['email'] ?? '');
    $sujet = trim($body['sujet'] ?? '');
    $message = trim($body['message'] ?? '');

    if (!$nom || !$email || !$message) {
        jsonError('Nom, email et message sont obligatoires.');
    }

    $stmt = getPdo()->prepare('
        INSERT INTO messages_contact (nom, email, sujet, message)
        VALUES (?, ?, ?, ?)
    ');
    $stmt->execute([$nom, $email, $sujet, $message]);

    jsonResponse(['message' => 'Message envoyé avec succès.'], 201);
}
