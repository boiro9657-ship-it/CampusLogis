<?php
/**
 * Paramètres d'envoi d'email (SMTP). Copier ce fichier en
 * "mail.php" (ignoré par git) et renseigner les vrais identifiants
 * de la boîte mail utilisée pour l'envoi.
 *
 * 'encryption' vaut 'ssl' (port 465, chiffrement implicite dès la
 * connexion — ex. Hostinger) ou 'tls' (port 587, STARTTLS — ex.
 * Gmail avec un mot de passe d'application :
 * https://myaccount.google.com/apppasswords).
 */

return [
    'host'       => 'smtp.hostinger.com',
    'port'       => 465,
    'encryption' => 'ssl',
    'username'   => 'contact@exemple.com',
    'password'   => 'mot-de-passe-de-la-boite-mail',
    'from_name'  => 'TerangaHome',
];
