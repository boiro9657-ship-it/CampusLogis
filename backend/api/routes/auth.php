<?php
/**
 * Routes d'authentification : inscription, connexion,
 * déconnexion, utilisateur courant.
 */

require_once __DIR__ . '/../../includes/session.php';

function handleAuthRoute(array $segments, string $method): void
{
    $action = $segments[0] ?? null;

    if ($action === 'register' && $method === 'POST') {
        registerUser();
        return;
    }

    if ($action === 'login' && $method === 'POST') {
        loginUser();
        return;
    }

    if ($action === 'logout' && $method === 'POST') {
        logoutUser();
        return;
    }

    if ($action === 'me' && $method === 'GET') {
        currentUser();
        return;
    }

    jsonError('Route introuvable.', 404);
}

function registerUser(): void
{
    $body = getJsonBody();

    $nom = trim($body['nom_complet'] ?? '');
    $email = trim($body['email'] ?? '');
    $telephone = trim($body['telephone'] ?? '');
    $motDePasse = $body['mot_de_passe'] ?? '';
    $role = $body['role'] ?? 'etudiant';

    if (!$nom || !$email || !$motDePasse) {
        jsonError('Nom, email et mot de passe sont obligatoires.');
    }

    if (!in_array($role, ['etudiant', 'proprietaire'], true)) {
        $role = 'etudiant';
    }

    $pdo = getPdo();

    $stmt = $pdo->prepare('SELECT id FROM utilisateurs WHERE email = ?');
    $stmt->execute([$email]);

    if ($stmt->fetch()) {
        jsonError('Un compte existe déjà avec cet email.', 409);
    }

    $hash = password_hash($motDePasse, PASSWORD_DEFAULT);

    $stmt = $pdo->prepare('
        INSERT INTO utilisateurs (nom_complet, email, telephone, mot_de_passe, role)
        VALUES (?, ?, ?, ?, ?)
    ');
    $stmt->execute([$nom, $email, $telephone, $hash, $role]);

    jsonResponse(['message' => 'Compte créé avec succès.'], 201);
}

function loginUser(): void
{
    $body = getJsonBody();

    $email = trim($body['email'] ?? '');
    $motDePasse = $body['mot_de_passe'] ?? '';

    if (!$email || !$motDePasse) {
        jsonError('Email et mot de passe sont obligatoires.');
    }

    $stmt = getPdo()->prepare('SELECT * FROM utilisateurs WHERE email = ?');
    $stmt->execute([$email]);
    $utilisateur = $stmt->fetch();

    if (!$utilisateur || !password_verify($motDePasse, $utilisateur['mot_de_passe'])) {
        jsonError('Email ou mot de passe incorrect.', 401);
    }

    $_SESSION['user_id'] = $utilisateur['id'];

    jsonResponse([
        'id'          => $utilisateur['id'],
        'nom_complet' => $utilisateur['nom_complet'],
        'email'       => $utilisateur['email'],
        'role'        => $utilisateur['role'],
    ]);
}

function logoutUser(): void
{
    $_SESSION = [];
    session_destroy();

    jsonResponse(['message' => 'Déconnecté.']);
}

function currentUser(): void
{
    if (empty($_SESSION['user_id'])) {
        jsonError('Non connecté.', 401);
    }

    $stmt = getPdo()->prepare('
        SELECT id, nom_complet, email, telephone, role
        FROM utilisateurs WHERE id = ?
    ');
    $stmt->execute([$_SESSION['user_id']]);
    $utilisateur = $stmt->fetch();

    if (!$utilisateur) {
        jsonError('Non connecté.', 401);
    }

    jsonResponse($utilisateur);
}
