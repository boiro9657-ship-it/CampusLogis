<?php
/**
 * Identifiants OAuth Google ("Se connecter avec Google").
 * Copier ce fichier en "google.php" (ignoré par git) et
 * renseigner les vraies valeurs depuis Google Cloud Console
 * (APIs & Services > Identifiants).
 */

return [
    'client_id'     => 'xxxxxxxx.apps.googleusercontent.com',
    'client_secret' => 'GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx',
    'redirect_uri'  => 'http://localhost/terangahome/backend/api/auth/google/callback',
];
