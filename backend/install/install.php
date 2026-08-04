<?php
/**
 * Script d'installation : crée la base "afrihome" et toutes ses
 * tables si elles n'existent pas encore, puis insère quelques
 * annonces de démonstration. Sans danger à relancer plusieurs
 * fois (tout est en IF NOT EXISTS / vérifié avant insertion).
 *
 * À visiter une seule fois dans le navigateur, par exemple :
 * http://localhost/terangahome/backend/install/install.php
 */

require_once __DIR__ . '/../includes/db.php';

header('Content-Type: text/html; charset=utf-8');

$etapes = [];

try {
    $config = require __DIR__ . '/../config/database.php';

    // Connexion sans base sélectionnée pour pouvoir la créer.
    $pdo = getPdo(withDatabase: false);

    $pdo->exec(
        "CREATE DATABASE IF NOT EXISTS `{$config['database']}`
         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
    );

    $etapes[] = "Base \"{$config['database']}\" prête.";

    // Reconnexion, cette fois avec la base sélectionnée.
    $pdo = getPdo(withDatabase: true);

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS utilisateurs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nom_complet VARCHAR(150) NOT NULL,
            email VARCHAR(150) NOT NULL UNIQUE,
            telephone VARCHAR(30),
            mot_de_passe VARCHAR(255) NOT NULL,
            role ENUM('etudiant','proprietaire') NOT NULL DEFAULT 'etudiant',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $etapes[] = 'Table "utilisateurs" prête.';

    // Élargit la colonne role si elle a été créée avant l'ajout
    // du rôle admin (sans danger à rejouer, même si déjà à jour).
    $pdo->exec("
        ALTER TABLE utilisateurs
        MODIFY role ENUM('etudiant','proprietaire','admin') NOT NULL DEFAULT 'etudiant'
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS logements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            owner_id INT NULL,
            titre VARCHAR(150) NOT NULL,
            ville VARCHAR(100),
            type ENUM('Chambre','Studio','Appartement','Villa','Bureau'),
            prix DECIMAL(10,2),
            chambres INT,
            description TEXT,
            image_url VARCHAR(255),
            statut ENUM('disponible','reserve') DEFAULT 'disponible',
            premium TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $etapes[] = 'Table "logements" prête.';

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS logement_medias (
            id INT AUTO_INCREMENT PRIMARY KEY,
            logement_id INT NOT NULL,
            type ENUM('image','video') NOT NULL,
            url VARCHAR(255) NOT NULL,
            position INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (logement_id) REFERENCES logements(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $etapes[] = 'Table "logement_medias" prête.';

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS favoris (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            logement_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_favori (user_id, logement_id),
            FOREIGN KEY (user_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
            FOREIGN KEY (logement_id) REFERENCES logements(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $etapes[] = 'Table "favoris" prête.';

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS reservations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            logement_id INT NOT NULL,
            locataire_id INT NOT NULL,
            message TEXT,
            statut ENUM('en_attente','confirmee','annulee') DEFAULT 'en_attente',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (logement_id) REFERENCES logements(id) ON DELETE CASCADE,
            FOREIGN KEY (locataire_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $etapes[] = 'Table "reservations" prête.';

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS messages_contact (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nom VARCHAR(150) NOT NULL,
            email VARCHAR(150) NOT NULL,
            sujet VARCHAR(200),
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $etapes[] = 'Table "messages_contact" prête.';

    // Annonces de démonstration, une seule fois (si la table
    // est encore vide), pour que le site ne parte pas sans rien
    // à afficher avant les premières vraies publications.
    $nbLogements = $pdo->query('SELECT COUNT(*) FROM logements')->fetchColumn();

    if ($nbLogements == 0) {

        $stmt = $pdo->prepare('
            INSERT INTO logements (titre, ville, type, prix, chambres, description, image_url, premium)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ');

        $demo = [
            ['Studio Moderne', 'Dakar - Point E', 'Studio', 95000, 1, 'Studio moderne, calme et bien situé.', null, 1],
            ['Résidence Fann', 'Fann, Dakar', 'Appartement', 75000, 2, 'Appartement lumineux proche du centre.', null, 0],
            ['Studio Ouakam', 'Ouakam, Dakar', 'Studio', 60000, 1, 'Studio avec wifi, idéal pour un début rapide.', null, 0],
            ['Appartement Amitié', 'Amitié, Dakar', 'Appartement', 90000, 3, 'Grand appartement avec wifi.', null, 1],
        ];

        foreach ($demo as $logement) {
            $stmt->execute($logement);
        }

        $etapes[] = count($demo) . ' annonces de démonstration ajoutées.';

    } else {

        $etapes[] = 'Annonces de démonstration déjà présentes, rien ajouté.';

    }

    // Compte administrateur par défaut, créé une seule fois (si
    // aucun admin n'existe encore). Pas d'auto-inscription admin
    // possible depuis le site pour des raisons de sécurité.
    $nbAdmins = $pdo->query("SELECT COUNT(*) FROM utilisateurs WHERE role = 'admin'")->fetchColumn();

    if ($nbAdmins == 0) {

        $stmt = $pdo->prepare('
            INSERT INTO utilisateurs (nom_complet, email, mot_de_passe, role)
            VALUES (?, ?, ?, ?)
        ');

        $stmt->execute([
            'Administrateur',
            'admin@terangahome.sn',
            password_hash('Admin123!', PASSWORD_DEFAULT),
            'admin',
        ]);

        $etapes[] = 'Compte administrateur créé : admin@terangahome.sn / Admin123!';

    } else {

        $etapes[] = 'Compte administrateur déjà présent, rien créé.';

    }

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
    <title>Installation TerangaHome</title>
    <style>
        body{font-family:system-ui,sans-serif;max-width:640px;margin:60px auto;padding:0 20px;color:#0F172A;}
        h1{color:#145C3D;}
        li{margin-bottom:8px;}
        .erreur{background:#FEF2F2;color:#B91C1C;padding:16px 20px;border-radius:10px;}
        .ok{background:#E7F5EC;color:#145C3D;padding:16px 20px;border-radius:10px;}
    </style>
</head>
<body>

<h1>Installation TerangaHome</h1>

<?php if ($succes): ?>

    <div class="ok">Installation terminée avec succès.</div>

    <ul>
        <?php foreach ($etapes as $etape): ?>
            <li><?= htmlspecialchars($etape) ?></li>
        <?php endforeach; ?>
    </ul>

    <p>Tu peux maintenant utiliser le site normalement. Cette page peut être relancée sans risque.</p>

<?php else: ?>

    <div class="erreur">
        Échec de l'installation : <?= htmlspecialchars($erreur) ?>
    </div>

    <p>Vérifie que MySQL est démarré dans le panneau de contrôle XAMPP, et que
    <code>backend/config/database.php</code> contient les bons identifiants.</p>

<?php endif; ?>

</body>
</html>
