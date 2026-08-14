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
            role ENUM('locataire','proprietaire') NOT NULL DEFAULT 'locataire',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $etapes[] = 'Table "utilisateurs" prête.';

    // Le site n'est plus réservé aux étudiants : élargit la
    // colonne pour accepter "locataire" et "admin", migre les
    // anciens comptes "etudiant" vers "locataire", puis retire
    // "etudiant" de la liste. Chaque étape est sans danger à
    // rejouer (y compris si déjà à jour, ou si aucun compte
    // "etudiant" n'existe encore).
    $pdo->exec("
        ALTER TABLE utilisateurs
        MODIFY role ENUM('etudiant','locataire','proprietaire','admin') NOT NULL DEFAULT 'locataire'
    ");

    $pdo->exec("UPDATE utilisateurs SET role = 'locataire' WHERE role = 'etudiant'");

    $pdo->exec("
        ALTER TABLE utilisateurs
        MODIFY role ENUM('locataire','proprietaire','admin') NOT NULL DEFAULT 'locataire'
    ");

    // Mot de passe désormais facultatif : un compte créé via
    // Google Sign-In n'a pas de mot de passe local.
    $pdo->exec("
        ALTER TABLE utilisateurs
        MODIFY mot_de_passe VARCHAR(255) NULL
    ");

    // Colonne d'identifiant Google, ajoutée une seule fois pour
    // les bases déjà existantes avant cette fonctionnalité.
    $colonneGoogleExiste = $pdo->query("
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'utilisateurs'
        AND COLUMN_NAME = 'google_id'
    ")->fetchColumn();

    if ($colonneGoogleExiste == 0) {
        $pdo->exec("ALTER TABLE utilisateurs ADD COLUMN google_id VARCHAR(255) NULL UNIQUE AFTER mot_de_passe");
        $etapes[] = 'Colonne "google_id" ajoutée.';
    }

    // Photo de profil, ajoutée une seule fois pour les bases déjà
    // existantes avant cette fonctionnalité.
    $colonnePhotoExiste = $pdo->query("
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'utilisateurs'
        AND COLUMN_NAME = 'photo_url'
    ")->fetchColumn();

    if ($colonnePhotoExiste == 0) {
        $pdo->exec("ALTER TABLE utilisateurs ADD COLUMN photo_url VARCHAR(255) NULL AFTER telephone");
        $etapes[] = 'Colonne "photo_url" ajoutée.';
    }

    // Préférence de notifications (nouvelles annonces publiées) :
    // activée par défaut, désactivable depuis la page profil.
    $colonneNotifExiste = $pdo->query("
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'utilisateurs'
        AND COLUMN_NAME = 'notifications_actives'
    ")->fetchColumn();

    if ($colonneNotifExiste == 0) {
        $pdo->exec("ALTER TABLE utilisateurs ADD COLUMN notifications_actives TINYINT(1) NOT NULL DEFAULT 1");
        $etapes[] = 'Colonne "notifications_actives" ajoutée.';
    }

    // Formule d'abonnement du propriétaire (Gratuit par défaut tant
    // que les paiements Wave/Orange Money ne sont pas branchés) :
    // conditionne la limite de publications quotidiennes.
    $colonnePlanExiste = $pdo->query("
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'utilisateurs'
        AND COLUMN_NAME = 'plan'
    ")->fetchColumn();

    if ($colonnePlanExiste == 0) {
        $pdo->exec("ALTER TABLE utilisateurs ADD COLUMN plan ENUM('gratuit','premium','pro') NOT NULL DEFAULT 'gratuit'");
        $etapes[] = 'Colonne "plan" ajoutée.';
    }

    // Horodatage de dernière activité, mis à jour par un signal
    // régulier envoyé par le navigateur (voir global.js) tant que
    // l'utilisateur est connecté et a la page ouverte — sert à
    // déterminer qui est "en ligne" dans l'espace de discussion.
    $colonneActiviteExiste = $pdo->query("
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'utilisateurs'
        AND COLUMN_NAME = 'derniere_activite'
    ")->fetchColumn();

    if ($colonneActiviteExiste == 0) {
        $pdo->exec("ALTER TABLE utilisateurs ADD COLUMN derniere_activite TIMESTAMP NULL");
        $etapes[] = 'Colonne "derniere_activite" ajoutée.';
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS password_resets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token VARCHAR(255) NOT NULL UNIQUE,
            expires_at DATETIME NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $etapes[] = 'Table "password_resets" prête.';

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS logements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            owner_id INT NULL,
            titre VARCHAR(150) NOT NULL,
            ville VARCHAR(100),
            type ENUM('Chambre','Studio','Appartement','Villa','Bureau','Immeuble','Passe-temps'),
            prix DECIMAL(10,2),
            chambres INT,
            description TEXT,
            image_url VARCHAR(255),
            statut ENUM('disponible','reserve') DEFAULT 'disponible',
            statut_validation ENUM('en_attente','approuve','rejete') NOT NULL DEFAULT 'en_attente',
            premium TINYINT(1) DEFAULT 0,
            contact_telephone VARCHAR(30) NULL,
            contact_whatsapp VARCHAR(30) NULL,
            contact_email VARCHAR(150) NULL,
            equip_wifi TINYINT(1) NOT NULL DEFAULT 0,
            equip_parking TINYINT(1) NOT NULL DEFAULT 0,
            equip_cuisine TINYINT(1) NOT NULL DEFAULT 0,
            equip_douche TINYINT(1) NOT NULL DEFAULT 0,
            equip_salon TINYINT(1) NOT NULL DEFAULT 0,
            equip_balcon TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $etapes[] = 'Table "logements" prête.';

    // Élargit la liste des types de logement (Immeuble, Passe-temps)
    // sur une base déjà existante — sans danger à rejouer.
    $pdo->exec("
        ALTER TABLE logements
        MODIFY type ENUM('Chambre','Studio','Appartement','Villa','Bureau','Immeuble','Passe-temps') NULL
    ");
    $etapes[] = 'Types de logement "Immeuble" et "Passe-temps" disponibles.';

    // Colonnes de coordonnées de contact (facultatives, propres à
    // chaque annonce) et d'équipements, ajoutées ici pour les
    // bases déjà existantes avant cette fonctionnalité.
    $colonnesAAjouter = [
        'contact_telephone' => "VARCHAR(30) NULL",
        'contact_whatsapp'  => "VARCHAR(30) NULL",
        'contact_email'     => "VARCHAR(150) NULL",
        'equip_wifi'        => "TINYINT(1) NOT NULL DEFAULT 0",
        'equip_parking'     => "TINYINT(1) NOT NULL DEFAULT 0",
        'equip_cuisine'     => "TINYINT(1) NOT NULL DEFAULT 0",
        'equip_douche'      => "TINYINT(1) NOT NULL DEFAULT 0",
        'equip_salon'       => "TINYINT(1) NOT NULL DEFAULT 0",
        'equip_balcon'      => "TINYINT(1) NOT NULL DEFAULT 0",
        'equip_eau'          => "TINYINT(1) NOT NULL DEFAULT 0",
        'equip_electricite'  => "TINYINT(1) NOT NULL DEFAULT 0",
        'equip_climatisation' => "TINYINT(1) NOT NULL DEFAULT 0",
        'duree_location'     => "ENUM('24h','nuit','journee','semaine','1_mois','3_mois','6_mois','1_an') NOT NULL DEFAULT '1_mois'",
        'caution'            => "DECIMAL(10,2) NULL",
        'nombre_personnes'   => "INT NULL",
        'nombre_etages'      => "INT NULL",
        'niveau_etage'       => "VARCHAR(30) NULL",
        'profil_celibataire' => "TINYINT(1) NOT NULL DEFAULT 0",
        'profil_marie'       => "TINYINT(1) NOT NULL DEFAULT 0",
        'profil_etudiant'    => "TINYINT(1) NOT NULL DEFAULT 0",
        'profil_travailleur' => "TINYINT(1) NOT NULL DEFAULT 0",
        'profil_senegalais'  => "TINYINT(1) NOT NULL DEFAULT 0",
        'profil_etranger'    => "TINYINT(1) NOT NULL DEFAULT 0",
        'audio_url'          => "VARCHAR(255) NULL",
        'vues'               => "INT NOT NULL DEFAULT 0",
        'duree_location_autre' => "VARCHAR(100) NULL",
        'salles_bain'        => "INT NULL",
        'toilettes'          => "INT NULL",
        'salons'             => "INT NULL",
        'cuisines'           => "INT NULL",
        'superficie'         => "DECIMAL(8,2) NULL",
        // Renseigné uniquement quand un membre de l'équipe TerangaHome
        // publie une annonce pour un propriétaire sans compte (voir
        // creerLogementAdmin()) — permet de savoir qui a publié quoi,
        // sans confondre avec owner_id (le vrai propriétaire, absent
        // dans ce cas précis).
        'publie_par_admin_id' => "INT NULL",
    ];

    foreach ($colonnesAAjouter as $colonne => $definition) {

        $existe = $pdo->query("
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'logements'
            AND COLUMN_NAME = '$colonne'
        ")->fetchColumn();

        if ($existe == 0) {
            $pdo->exec("ALTER TABLE logements ADD COLUMN $colonne $definition");
            $etapes[] = "Colonne \"$colonne\" ajoutée.";
        }

    }

    // "Autre" permet au propriétaire de préciser une durée de
    // location personnalisée (texte libre dans duree_location_autre)
    // quand aucune des options prédéfinies ne correspond. Sur une
    // base existante, l'ENUM doit être élargi explicitement — une
    // simple ADD COLUMN ne suffit pas à ajouter une valeur d'ENUM.
    $typeActuelDuree = $pdo->query("
        SELECT COLUMN_TYPE FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'logements'
        AND COLUMN_NAME = 'duree_location'
    ")->fetchColumn();

    if ($typeActuelDuree && strpos($typeActuelDuree, "'autre'") === false) {
        $pdo->exec("
            ALTER TABLE logements
            MODIFY COLUMN duree_location ENUM('24h','nuit','journee','semaine','1_mois','3_mois','6_mois','1_an','autre') NOT NULL DEFAULT '1_mois'
        ");
        $etapes[] = 'Colonne "duree_location" : valeur "autre" ajoutée.';
    }

    // "Par heure" : durée courte supplémentaire (ex. logement de
    // passage), même principe d'élargissement d'ENUM que "autre"
    // ci-dessus.
    $typeActuelDuree = $pdo->query("
        SELECT COLUMN_TYPE FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'logements'
        AND COLUMN_NAME = 'duree_location'
    ")->fetchColumn();

    if ($typeActuelDuree && strpos($typeActuelDuree, "'par_heure'") === false) {
        $pdo->exec("
            ALTER TABLE logements
            MODIFY COLUMN duree_location ENUM('24h','nuit','journee','semaine','1_mois','3_mois','6_mois','1_an','autre','par_heure') NOT NULL DEFAULT '1_mois'
        ");
        $etapes[] = 'Colonne "duree_location" : valeur "par_heure" ajoutée.';
    }

    // Ajout de la colonne de validation admin sur une base déjà
    // existante (avant cette fonctionnalité) : les annonces déjà
    // publiées sont approuvées automatiquement pour ne pas les
    // faire disparaître soudainement ; seules les nouvelles
    // publications passeront par la validation.
    $colonneExiste = $pdo->query("
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'logements'
        AND COLUMN_NAME = 'statut_validation'
    ")->fetchColumn();

    if ($colonneExiste == 0) {

        $pdo->exec("
            ALTER TABLE logements
            ADD COLUMN statut_validation ENUM('en_attente','approuve','rejete') NOT NULL DEFAULT 'en_attente' AFTER statut
        ");
        $pdo->exec("UPDATE logements SET statut_validation = 'approuve'");

        $etapes[] = 'Colonne "statut_validation" ajoutée (annonces existantes approuvées automatiquement).';

    } else {

        $etapes[] = 'Colonne "statut_validation" déjà présente.';

    }

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
            conditions_acceptees TINYINT(1) NOT NULL DEFAULT 0,
            statut ENUM('en_attente','confirmee','annulee') DEFAULT 'en_attente',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (logement_id) REFERENCES logements(id) ON DELETE CASCADE,
            FOREIGN KEY (locataire_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $etapes[] = 'Table "reservations" prête.';

    $colonneConditionsExiste = $pdo->query("
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'reservations'
        AND COLUMN_NAME = 'conditions_acceptees'
    ")->fetchColumn();

    if ($colonneConditionsExiste == 0) {
        $pdo->exec("ALTER TABLE reservations ADD COLUMN conditions_acceptees TINYINT(1) NOT NULL DEFAULT 0 AFTER message");
        $etapes[] = 'Colonne "conditions_acceptees" ajoutée.';
    }

    // Le locataire précise désormais la date, l'heure et la durée
    // souhaitées dès la demande de réservation, pour que le
    // propriétaire ait ces informations avant d'accepter ou de
    // refuser (au lieu de devoir les redemander par message).
    $colonnesReservationAAjouter = [
        'date_souhaitee'     => "DATE NULL",
        'heure_souhaitee'    => "TIME NULL",
        'duree_sejour'       => "ENUM('24h','nuit','journee','semaine','1_mois','3_mois','6_mois','1_an') NULL",
        'duree_sejour_autre' => "VARCHAR(100) NULL",
    ];

    foreach ($colonnesReservationAAjouter as $colonne => $definition) {

        $existe = $pdo->query("
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'reservations'
            AND COLUMN_NAME = '$colonne'
        ")->fetchColumn();

        if ($existe == 0) {
            $pdo->exec("ALTER TABLE reservations ADD COLUMN $colonne $definition");
            $etapes[] = "Colonne \"$colonne\" ajoutée à \"reservations\".";
        }

    }

    // Le locataire peut préciser lui-même une durée hors des choix
    // standards (comme le propriétaire peut le faire à la publication).
    $typeDureeSejour = $pdo->query("
        SELECT COLUMN_TYPE FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'reservations'
        AND COLUMN_NAME = 'duree_sejour'
    ")->fetchColumn();

    if ($typeDureeSejour !== false && strpos($typeDureeSejour, "'autre'") === false) {
        $pdo->exec("ALTER TABLE reservations MODIFY COLUMN duree_sejour ENUM('24h','nuit','journee','semaine','1_mois','3_mois','6_mois','1_an','autre') NULL");
        $etapes[] = 'Colonne duree_sejour : valeur "autre" ajoutée.';
    }

    $typeDureeSejour = $pdo->query("
        SELECT COLUMN_TYPE FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'reservations'
        AND COLUMN_NAME = 'duree_sejour'
    ")->fetchColumn();

    if ($typeDureeSejour !== false && strpos($typeDureeSejour, "'par_heure'") === false) {
        $pdo->exec("ALTER TABLE reservations MODIFY COLUMN duree_sejour ENUM('24h','nuit','journee','semaine','1_mois','3_mois','6_mois','1_an','autre','par_heure') NULL");
        $etapes[] = 'Colonne duree_sejour : valeur "par_heure" ajoutée.';
    }

    // Espace de discussion propriétaire/locataire : une conversation
    // par binôme d'utilisateurs (pas par réservation individuelle) —
    // si un locataire réserve plusieurs fois le même logement, ou
    // plusieurs logements du même propriétaire, tous les messages
    // restent dans un seul fil continu au lieu d'être éclatés entre
    // plusieurs conversations vides selon la réservation ouverte de
    // chaque côté.
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sender_id INT NOT NULL,
            destinataire_id INT NOT NULL,
            message TEXT NOT NULL,
            lu TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sender_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
            FOREIGN KEY (destinataire_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
            INDEX idx_paire (sender_id, destinataire_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $etapes[] = 'Table "messages" prête.';

    // Messages vocaux dans la messagerie (comme WhatsApp) — un
    // message a soit du texte, soit un enregistrement audio.
    $colonneAudioMessageExiste = $pdo->query("
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'messages'
        AND COLUMN_NAME = 'audio_url'
    ")->fetchColumn();

    if ($colonneAudioMessageExiste == 0) {
        $pdo->exec("ALTER TABLE messages ADD COLUMN audio_url VARCHAR(255) NULL AFTER message");
        $etapes[] = 'Colonne "audio_url" ajoutée à "messages".';
    }

    // Migration depuis l'ancien schéma (une conversation par
    // réservation) vers le nouveau (une conversation par binôme).
    $colonneDestinataireExiste = $pdo->query("
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'messages'
        AND COLUMN_NAME = 'destinataire_id'
    ")->fetchColumn();

    if ($colonneDestinataireExiste == 0) {

        $pdo->exec("ALTER TABLE messages ADD COLUMN destinataire_id INT NULL AFTER sender_id");

        // Déduit le destinataire de chaque ancien message à partir
        // de la réservation à laquelle il était rattaché (l'autre
        // participant que l'expéditeur).
        $pdo->exec("
            UPDATE messages m
            JOIN reservations r ON r.id = m.reservation_id
            JOIN logements l ON l.id = r.logement_id
            SET m.destinataire_id = IF(m.sender_id = r.locataire_id, l.owner_id, r.locataire_id)
            WHERE m.destinataire_id IS NULL
        ");

        $pdo->exec("ALTER TABLE messages ADD CONSTRAINT fk_messages_destinataire FOREIGN KEY (destinataire_id) REFERENCES utilisateurs(id) ON DELETE CASCADE");
        $pdo->exec("ALTER TABLE messages ADD INDEX idx_paire (sender_id, destinataire_id)");
        $pdo->exec("ALTER TABLE messages MODIFY reservation_id INT NULL");

        $etapes[] = 'Table "messages" migrée vers une conversation par binôme d\'utilisateurs.';
    }

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

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS commentaires (
            id INT AUTO_INCREMENT PRIMARY KEY,
            logement_id INT NOT NULL,
            user_id INT NOT NULL,
            message TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (logement_id) REFERENCES logements(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $etapes[] = 'Table "commentaires" prête.';

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            logement_id INT NULL,
            message VARCHAR(255) NOT NULL,
            lien VARCHAR(255) NULL,
            lu TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
            FOREIGN KEY (logement_id) REFERENCES logements(id) ON DELETE CASCADE,
            INDEX idx_user_lu (user_id, lu)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $etapes[] = 'Table "notifications" prête.';

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS colocations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            ville VARCHAR(100),
            type_logement ENUM('Chambre','Studio','Appartement','Villa'),
            budget DECIMAL(10,2) NULL,
            description TEXT,
            contact_telephone VARCHAR(30) NULL,
            contact_whatsapp VARCHAR(30) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $etapes[] = 'Table "colocations" prête.';

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS visites (
            id INT AUTO_INCREMENT PRIMARY KEY,
            page VARCHAR(255) NOT NULL,
            ip_hash VARCHAR(64) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $etapes[] = 'Table "visites" prête.';

    // Un clic sur "Contacter sur WhatsApp" = une demande de contact
    // générée pour cette annonce. Suit le même principe que
    // "visites" (aucune authentification requise, empreinte IP
    // hachée) mais rattaché à un logement précis, avec en plus
    // l'utilisateur connecté quand il y en a un.
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS whatsapp_clics (
            id INT AUTO_INCREMENT PRIMARY KEY,
            logement_id INT NOT NULL,
            ip_hash VARCHAR(64) NOT NULL,
            user_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (logement_id) REFERENCES logements(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES utilisateurs(id) ON DELETE SET NULL,
            INDEX idx_logement_id (logement_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $etapes[] = 'Table "whatsapp_clics" prête.';

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS paiements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            plan ENUM('premium','pro') NOT NULL,
            origine VARCHAR(30) NOT NULL DEFAULT 'tarifs',
            montant DECIMAL(10,2) NOT NULL,
            token VARCHAR(100) NOT NULL UNIQUE,
            statut ENUM('en_attente','complete','echoue') NOT NULL DEFAULT 'en_attente',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ");
    $etapes[] = 'Table "paiements" prête.';

    // "origine" a été ajoutée après coup — pour les installations où
    // la table "paiements" existait déjà sans cette colonne. Sert à
    // renvoyer l'utilisateur là où il a démarré son paiement
    // (tarifs.html ou publier-logement.html) plutôt que toujours
    // sur tarifs.html.
    $colonneOrigineExiste = $pdo->query("
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'paiements'
        AND COLUMN_NAME = 'origine'
    ")->fetchColumn();

    if ($colonneOrigineExiste == 0) {
        $pdo->exec("
            ALTER TABLE paiements
            ADD COLUMN origine VARCHAR(30) NOT NULL DEFAULT 'tarifs' AFTER plan
        ");
        $etapes[] = 'Colonne "origine" ajoutée à "paiements".';
    }

    // Pas d'annonces de démonstration : seules de vraies annonces
    // contactables doivent apparaître sur le site. Une annonce sans
    // propriétaire (owner_id NULL) reste légitime si l'équipe
    // TerangaHome l'a publiée pour le compte d'un propriétaire sans
    // compte (voir creerLogementAdmin() dans logements.php) — dans
    // ce cas un contact_whatsapp est toujours renseigné. Seules les
    // annonces orphelines SANS AUCUN moyen de contact (résidu d'une
    // version antérieure du site) sont supprimées ici.
    $pdo->exec("DELETE FROM logements WHERE owner_id IS NULL AND (contact_whatsapp IS NULL OR contact_whatsapp = '')");

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
