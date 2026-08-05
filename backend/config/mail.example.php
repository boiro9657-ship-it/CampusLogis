<?php
/**
 * Paramètres d'envoi d'email (SMTP Gmail). Copier ce fichier en
 * "mail.php" (ignoré par git) et renseigner un vrai mot de passe
 * d'application Gmail — jamais le mot de passe du compte lui-même.
 * Génération : https://myaccount.google.com/apppasswords
 */

return [
    'host'      => 'smtp.gmail.com',
    'port'      => 587,
    'username'  => 'exemple@gmail.com',
    'password'  => 'mot-de-passe-application-16-caracteres',
    'from_name' => 'TerangaHome',
];
