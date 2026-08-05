<?php
/**
 * Envoi d'emails via SMTP Gmail (PHPMailer, sans Composer —
 * fichiers sources inclus directement dans includes/phpmailer/).
 */

require_once __DIR__ . '/phpmailer/Exception.php';
require_once __DIR__ . '/phpmailer/PHPMailer.php';
require_once __DIR__ . '/phpmailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as PHPMailerException;

function envoyerEmail(string $destinataire, string $sujet, string $corpsHtml): bool
{
    $configPath = __DIR__ . '/../config/mail.php';

    if (!file_exists($configPath)) {
        error_log('Envoi email impossible : backend/config/mail.php introuvable.');
        return false;
    }

    $config = require $configPath;

    $mail = new PHPMailer(true);

    try {
        $mail->isSMTP();
        $mail->Host = $config['host'];
        $mail->SMTPAuth = true;
        $mail->Username = $config['username'];
        $mail->Password = $config['password'];
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = $config['port'];
        $mail->CharSet = 'UTF-8';

        $mail->setFrom($config['username'], $config['from_name']);
        $mail->addAddress($destinataire);

        $mail->isHTML(true);
        $mail->Subject = $sujet;
        $mail->Body = $corpsHtml;

        $mail->send();

        return true;

    } catch (PHPMailerException $e) {

        error_log('Erreur envoi email : ' . $mail->ErrorInfo);
        return false;

    }
}
