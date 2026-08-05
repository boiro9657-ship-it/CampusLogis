<?php
/**
 * Routes d'authentification : inscription, connexion,
 * déconnexion, utilisateur courant.
 */

require_once __DIR__ . '/../../includes/session.php';
require_once __DIR__ . '/../../includes/mail.php';

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

    if ($action === 'forgot-password' && $method === 'POST') {
        demanderReinitialisation();
        return;
    }

    if ($action === 'reset-password' && $method === 'POST') {
        reinitialiserMotDePasse();
        return;
    }

    if ($action === 'google' && $method === 'GET' && ($segments[1] ?? null) === null) {
        redirectionGoogle();
        return;
    }

    if ($action === 'google' && $method === 'GET' && ($segments[1] ?? null) === 'callback') {
        callbackGoogle();
        return;
    }

    if ($action === 'profil' && $method === 'PUT' && ($segments[1] ?? null) === null) {
        modifierProfil();
        return;
    }

    if ($action === 'profil' && $method === 'POST' && ($segments[1] ?? null) === 'photo') {
        modifierPhotoProfil();
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
    $role = $body['role'] ?? 'locataire';

    if (!$nom || !$email || !$motDePasse) {
        jsonError('Nom, email et mot de passe sont obligatoires.');
    }

    if (!in_array($role, ['locataire', 'proprietaire'], true)) {
        $role = 'locataire';
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

    if (!$utilisateur || !$utilisateur['mot_de_passe'] || !password_verify($motDePasse, $utilisateur['mot_de_passe'])) {
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

/**
 * Envoie un email de réinitialisation si l'adresse correspond à
 * un compte. Répond toujours avec le même message de succès,
 * même si l'email est inconnu, pour ne pas révéler quels emails
 * sont inscrits sur la plateforme.
 */
function demanderReinitialisation(): void
{
    $body = getJsonBody();
    $email = trim($body['email'] ?? '');

    if (!$email) {
        jsonError('Email obligatoire.');
    }

    $pdo = getPdo();

    $stmt = $pdo->prepare('SELECT id, nom_complet FROM utilisateurs WHERE email = ?');
    $stmt->execute([$email]);
    $utilisateur = $stmt->fetch();

    if ($utilisateur) {

        $token = bin2hex(random_bytes(32));
        $expiration = date('Y-m-d H:i:s', time() + 3600);

        // Un seul lien de réinitialisation valide à la fois par
        // compte : les anciens tokens sont invalidés.
        $pdo->prepare('DELETE FROM password_resets WHERE user_id = ?')->execute([$utilisateur['id']]);

        $pdo->prepare('
            INSERT INTO password_resets (user_id, token, expires_at)
            VALUES (?, ?, ?)
        ')->execute([$utilisateur['id'], $token, $expiration]);

        $appConfig = require __DIR__ . '/../../config/app.php';

        $lien = $appConfig['site_url'] . '/pages/reinitialiser-mot-de-passe/reinitialiser-mot-de-passe.html?token=' . $token;

        $corps = '
            <p>Bonjour ' . htmlspecialchars($utilisateur['nom_complet']) . ',</p>
            <p>Vous avez demandé à réinitialiser votre mot de passe TerangaHome.</p>
            <p><a href="' . $lien . '">Cliquez ici pour choisir un nouveau mot de passe</a></p>
            <p>Ce lien expire dans 1 heure. Si vous n\'êtes pas à l\'origine de cette demande, ignorez cet email.</p>
        ';

        envoyerEmail($email, 'Réinitialisation de votre mot de passe TerangaHome', $corps);

    }

    jsonResponse(['message' => 'Si cet email correspond à un compte, un lien de réinitialisation a été envoyé.']);
}

function reinitialiserMotDePasse(): void
{
    $body = getJsonBody();
    $token = trim($body['token'] ?? '');
    $motDePasse = $body['mot_de_passe'] ?? '';

    if (!$token || !$motDePasse) {
        jsonError('Token et nouveau mot de passe sont obligatoires.');
    }

    if (strlen($motDePasse) < 8) {
        jsonError('Le mot de passe doit contenir au moins 8 caractères.');
    }

    $pdo = getPdo();

    $stmt = $pdo->prepare('
        SELECT * FROM password_resets
        WHERE token = ? AND expires_at > NOW()
    ');
    $stmt->execute([$token]);
    $reset = $stmt->fetch();

    if (!$reset) {
        jsonError('Ce lien de réinitialisation est invalide ou a expiré.', 400);
    }

    $hash = password_hash($motDePasse, PASSWORD_DEFAULT);

    $pdo->prepare('UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?')
        ->execute([$hash, $reset['user_id']]);

    $pdo->prepare('DELETE FROM password_resets WHERE user_id = ?')
        ->execute([$reset['user_id']]);

    jsonResponse(['message' => 'Mot de passe mis à jour avec succès.']);
}

function currentUser(): void
{
    if (empty($_SESSION['user_id'])) {
        jsonError('Non connecté.', 401);
    }

    $stmt = getPdo()->prepare('
        SELECT id, nom_complet, email, telephone, photo_url, role
        FROM utilisateurs WHERE id = ?
    ');
    $stmt->execute([$_SESSION['user_id']]);
    $utilisateur = $stmt->fetch();

    if (!$utilisateur) {
        jsonError('Non connecté.', 401);
    }

    jsonResponse($utilisateur);
}

/**
 * Met à jour les coordonnées du compte connecté (nom, téléphone,
 * email). L'email reste unique en base — vérifié en excluant le
 * compte courant.
 */
function modifierProfil(): void
{
    $userId = requireAuth();

    $body = getJsonBody();

    $nom = trim($body['nom_complet'] ?? '');
    $telephone = trim($body['telephone'] ?? '');
    $email = trim($body['email'] ?? '');

    if (!$nom || !$email) {
        jsonError('Nom et email sont obligatoires.');
    }

    $pdo = getPdo();

    $stmt = $pdo->prepare('SELECT id FROM utilisateurs WHERE email = ? AND id != ?');
    $stmt->execute([$email, $userId]);

    if ($stmt->fetch()) {
        jsonError('Un autre compte utilise déjà cet email.', 409);
    }

    $pdo->prepare('
        UPDATE utilisateurs SET nom_complet = ?, telephone = ?, email = ?
        WHERE id = ?
    ')->execute([$nom, $telephone, $email, $userId]);

    jsonResponse(['message' => 'Profil mis à jour avec succès.']);
}

/**
 * Remplace la photo de profil du compte connecté. Un seul
 * fichier ("photo"), image uniquement.
 */
function modifierPhotoProfil(): void
{
    $userId = requireAuth();

    if (empty($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
        jsonError('Aucune photo valide reçue.');
    }

    $extension = strtolower(pathinfo($_FILES['photo']['name'], PATHINFO_EXTENSION));

    if (!in_array($extension, ['jpg', 'jpeg', 'png', 'webp'], true)) {
        jsonError('Formats acceptés : jpg, png, webp.');
    }

    $nomFichier = 'avatar_' . $userId . '_' . uniqid() . '.' . $extension;
    $dossier = __DIR__ . '/../../uploads/avatars/';

    if (!is_dir($dossier)) {
        mkdir($dossier, 0755, true);
    }

    move_uploaded_file($_FILES['photo']['tmp_name'], $dossier . $nomFichier);

    // Chemin public calculé depuis l'emplacement réel du front
    // controller, comme pour les photos de logements.
    $baseDossier = str_replace('\\', '/', dirname(dirname($_SERVER['SCRIPT_NAME'])));
    $url = $baseDossier . '/uploads/avatars/' . $nomFichier;

    getPdo()->prepare('UPDATE utilisateurs SET photo_url = ? WHERE id = ?')
        ->execute([$url, $userId]);

    jsonResponse(['message' => 'Photo de profil mise à jour.', 'photo_url' => $url]);
}

/**
 * Redirige vers l'écran de consentement Google. Simple lien
 * <a href="..."> côté frontend (pas d'appel apiFetch), donc
 * réponse en redirection HTTP classique, pas en JSON.
 */
function redirectionGoogle(): void
{
    $config = require __DIR__ . '/../../config/google.php';

    $params = http_build_query([
        'client_id'     => $config['client_id'],
        'redirect_uri'  => $config['redirect_uri'],
        'response_type' => 'code',
        'scope'         => 'email profile',
        'access_type'   => 'online',
        'prompt'        => 'select_account',
    ]);

    header('Location: https://accounts.google.com/o/oauth2/v2/auth?' . $params);
    exit;
}

/**
 * Reçoit le code d'autorisation de Google, l'échange contre un
 * token, récupère le profil (email, nom), puis crée ou relie le
 * compte local et ouvre la session — exactement comme loginUser(),
 * mais sans mot de passe.
 */
function callbackGoogle(): void
{
    $config = require __DIR__ . '/../../config/google.php';
    $appConfig = require __DIR__ . '/../../config/app.php';

    $urlConnexion = $appConfig['site_url'] . '/pages/connexion/connexion.html';

    $code = $_GET['code'] ?? null;

    if (!$code) {
        header('Location: ' . $urlConnexion . '?erreur=google');
        exit;
    }

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'code'          => $code,
        'client_id'     => $config['client_id'],
        'client_secret' => $config['client_secret'],
        'redirect_uri'  => $config['redirect_uri'],
        'grant_type'    => 'authorization_code',
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $tokenResponse = curl_exec($ch);
    $tokenCurlError = curl_error($ch);
    curl_close($ch);

    $tokenData = json_decode($tokenResponse, true);

    if (empty($tokenData['access_token'])) {
        error_log('Google OAuth - échange du code échoué. Erreur cURL : ' . $tokenCurlError . ' | Réponse : ' . $tokenResponse);
        header('Location: ' . $urlConnexion . '?erreur=google');
        exit;
    }

    $ch = curl_init('https://www.googleapis.com/oauth2/v3/userinfo');
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Bearer ' . $tokenData['access_token']]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $profileResponse = curl_exec($ch);
    $profileCurlError = curl_error($ch);
    curl_close($ch);

    $profile = json_decode($profileResponse, true);

    $googleId = $profile['sub'] ?? null;
    $email = $profile['email'] ?? null;
    $nom = $profile['name'] ?? $email;

    if (!$googleId || !$email) {
        error_log('Google OAuth - récupération du profil échouée. Erreur cURL : ' . $profileCurlError . ' | Réponse : ' . $profileResponse);
        header('Location: ' . $urlConnexion . '?erreur=google');
        exit;
    }

    $pdo = getPdo();

    $stmt = $pdo->prepare('SELECT * FROM utilisateurs WHERE google_id = ?');
    $stmt->execute([$googleId]);
    $utilisateur = $stmt->fetch();

    if (!$utilisateur) {

        // Un compte existe peut-être déjà avec cet email (créé
        // via inscription classique) : on le relie à Google au
        // lieu d'en créer un second.
        $stmt = $pdo->prepare('SELECT * FROM utilisateurs WHERE email = ?');
        $stmt->execute([$email]);
        $utilisateur = $stmt->fetch();

        if ($utilisateur) {

            $pdo->prepare('UPDATE utilisateurs SET google_id = ? WHERE id = ?')
                ->execute([$googleId, $utilisateur['id']]);

        } else {

            $stmt = $pdo->prepare('
                INSERT INTO utilisateurs (nom_complet, email, mot_de_passe, google_id, role)
                VALUES (?, ?, NULL, ?, ?)
            ');
            $stmt->execute([$nom, $email, $googleId, 'locataire']);

            $stmt = $pdo->prepare('SELECT * FROM utilisateurs WHERE id = ?');
            $stmt->execute([$pdo->lastInsertId()]);
            $utilisateur = $stmt->fetch();

        }
    }

    $_SESSION['user_id'] = $utilisateur['id'];

    header('Location: ' . $appConfig['site_url'] . '/index.html');
    exit;
}
