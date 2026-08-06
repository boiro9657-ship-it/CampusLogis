<?php
/**
 * Nettoyage des comptes de test créés pendant les vérifications
 * (QA) après le déploiement d'une fonctionnalité. Supprime
 * uniquement les comptes dont l'email suit le motif de test
 * "qa_...@example.com" utilisé exclusivement à cette fin — aucun
 * vrai utilisateur ne peut correspondre à ce motif, donc aucun
 * risque de suppression accidentelle d'un compte réel.
 *
 * Verrouillé par .htaccess comme install.php : à déverrouiller
 * temporairement (suppression FTP du .htaccess), visiter une
 * fois, puis reverrouiller immédiatement après usage.
 */

require_once __DIR__ . '/../includes/db.php';

header('Content-Type: text/html; charset=utf-8');

try {

    $pdo = getPdo();

    // Les logements/réservations/favoris/notifications liés sont
    // supprimés automatiquement par les contraintes ON DELETE
    // CASCADE définies dans install.php.
    $stmt = $pdo->prepare("SELECT id, email FROM utilisateurs WHERE email LIKE 'qa\\_%@example.com'");
    $stmt->execute();
    $comptes = $stmt->fetchAll();

    $pdo->prepare("DELETE FROM utilisateurs WHERE email LIKE 'qa\\_%@example.com'")->execute();

    $succes = true;

} catch (Throwable $e) {

    $succes = false;
    $erreur = $e->getMessage();

}
?>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Nettoyage QA TerangaHome</title>
    <style>
        body{font-family:system-ui,sans-serif;max-width:640px;margin:60px auto;padding:0 20px;color:#0F172A;}
        h1{color:#145C3D;}
        li{margin-bottom:8px;}
        .erreur{background:#FEF2F2;color:#B91C1C;padding:16px 20px;border-radius:10px;}
        .ok{background:#E7F5EC;color:#145C3D;padding:16px 20px;border-radius:10px;}
    </style>
</head>
<body>

<h1>Nettoyage des comptes QA</h1>

<?php if ($succes): ?>

    <div class="ok"><?= count($comptes) ?> compte(s) de test supprimé(s).</div>

    <ul>
        <?php foreach ($comptes as $compte): ?>
            <li><?= htmlspecialchars($compte['email']) ?></li>
        <?php endforeach; ?>
    </ul>

<?php else: ?>

    <div class="erreur">Échec : <?= htmlspecialchars($erreur) ?></div>

<?php endif; ?>

</body>
</html>
