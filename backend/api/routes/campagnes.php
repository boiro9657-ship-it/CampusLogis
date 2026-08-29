<?php
/**
 * Publicité / sponsoring : un propriétaire choisit une de ses
 * annonces, une offre, un objectif et une durée, puis paie via le
 * même circuit PayDunya que les abonnements Premium/Pro (voir
 * paiements.php) — jamais de paiement fictif, jamais de montant
 * envoyé par le client repris tel quel.
 */

require_once __DIR__ . '/../../includes/session.php';

// Chaque offre définit son tarif journalier (jamais transmis par le
// client, toujours recalculé ici) et les emplacements où les
// annonces sponsorisées de ce niveau ont le droit d'apparaître —
// c'est ce qui permet d'ajouter facilement un futur niveau ou un
// nouvel emplacement sans toucher au reste du système.
const OFFRES_PUBLICITAIRES = [
    'mise_en_avant' => [
        'nom'           => 'Mise en avant',
        'description'   => "Votre annonce mieux placée dans les résultats de recherche.",
        'prix_jour'     => 1000,
        'emplacements'  => ['recherche'],
        'badge'         => 'Mise en avant',
    ],
    'sponsorisee' => [
        'nom'           => 'Annonce sponsorisée',
        'description'   => "Votre annonce mise en avant sur l'accueil ET dans les résultats de recherche.",
        'prix_jour'     => 2000,
        'emplacements'  => ['accueil', 'recherche'],
        'badge'         => 'Sponsorisé',
    ],
    'pack_premium' => [
        'nom'           => 'Pack Premium',
        'description'   => "Visibilité maximale : accueil, recherche et catégories, avec badge Premium.",
        'prix_jour'     => 3500,
        'emplacements'  => ['accueil', 'recherche', 'categories'],
        'badge'         => 'Sponsorisé Premium',
    ],
];

const OBJECTIFS_CAMPAGNE = ['vues', 'contacts', 'whatsapp', 'reservations'];

const DUREES_CAMPAGNE_VALIDES = [7, 15, 30];

function handleCampagnesRoute(array $segments, string $method): void
{
    $first = $segments[0] ?? null;

    if ($method === 'GET' && $first === 'offres') {
        listOffresPublicitaires();
        return;
    }

    if ($method === 'GET' && $first === 'mine') {
        listMesCampagnes();
        return;
    }

    if ($method === 'GET' && $first === 'actives') {
        listCampagnesActives();
        return;
    }

    if ($method === 'POST' && $first === null) {
        creerCampagne();
        return;
    }

    if ($method === 'POST' && is_numeric($first) && ($segments[1] ?? null) === 'impression') {
        enregistrerImpressionCampagne((int) $first);
        return;
    }

    if ($method === 'POST' && is_numeric($first) && ($segments[1] ?? null) === 'clic') {
        enregistrerClicCampagne((int) $first);
        return;
    }

    jsonError('Route introuvable.', 404);
}

function listOffresPublicitaires(): void
{
    $reponse = [];

    foreach (OFFRES_PUBLICITAIRES as $cle => $offre) {
        $reponse[] = array_merge(['id' => $cle], $offre);
    }

    jsonResponse($reponse);
}

/**
 * Crée une campagne en attente de paiement — pas encore active tant
 * que le paiement n'est pas confirmé (voir appliquerPaiementConfirme
 * dans paiements.php). Le budget est toujours calculé ici à partir
 * du tarif réel de l'offre, jamais transmis par le client.
 */
function creerCampagne(): void
{
    $userId = requireAuth();

    $body = getJsonBody();

    $logementId = (int) ($body['logement_id'] ?? 0);
    $offre = $body['offre'] ?? null;
    $objectif = $body['objectif'] ?? 'vues';
    $zoneCiblee = trim($body['zone_ciblee'] ?? '');
    $dureeJours = (int) ($body['duree_jours'] ?? 0);

    if (!isset(OFFRES_PUBLICITAIRES[$offre])) {
        jsonError('Offre publicitaire invalide.');
    }

    if (!in_array($objectif, OBJECTIFS_CAMPAGNE, true)) {
        jsonError('Objectif invalide.');
    }

    if (!in_array($dureeJours, DUREES_CAMPAGNE_VALIDES, true)) {
        jsonError('Durée invalide (7, 15 ou 30 jours).');
    }

    // Seul le propriétaire de l'annonce (ou un admin, via son propre
    // compte) peut lancer une campagne dessus — et l'annonce doit
    // déjà être publique, pas question de sponsoriser une annonce en
    // attente de validation.
    $stmt = getPdo()->prepare('SELECT owner_id, statut_validation FROM logements WHERE id = ?');
    $stmt->execute([$logementId]);
    $logement = $stmt->fetch();

    if (!$logement) {
        jsonError('Logement introuvable.', 404);
    }

    $estAdmin = estAdmin($userId);

    if ((int) $logement['owner_id'] !== $userId && !$estAdmin) {
        jsonError('Vous ne pouvez promouvoir que vos propres annonces.', 403);
    }

    if ($logement['statut_validation'] !== 'approuve') {
        jsonError('Seule une annonce déjà approuvée peut être promue.');
    }

    $budget = OFFRES_PUBLICITAIRES[$offre]['prix_jour'] * $dureeJours;

    $stmt = getPdo()->prepare('
        INSERT INTO campagnes_publicitaires
            (user_id, logement_id, offre, objectif, zone_ciblee, duree_jours, budget)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ');
    $stmt->execute([$userId, $logementId, $offre, $objectif, $zoneCiblee ?: null, $dureeJours, $budget]);

    jsonResponse([
        'id'     => getPdo()->lastInsertId(),
        'budget' => $budget,
    ], 201);
}

function estAdmin(int $userId): bool
{
    $stmt = getPdo()->prepare('SELECT role FROM utilisateurs WHERE id = ?');
    $stmt->execute([$userId]);

    return $stmt->fetchColumn() === 'admin';
}

/**
 * Les campagnes de l'annonceur connecté, avec leurs statistiques
 * réelles (impressions, clics par type) — jamais de chiffre inventé.
 * Le "budget dépensé" est calculé au prorata du temps déjà écoulé
 * sur la durée totale, plafonné au budget (aucun dépassement).
 */
function listMesCampagnes(): void
{
    $userId = requireAuth();

    $stmt = getPdo()->prepare('
        SELECT c.*, l.titre AS logement_titre, l.image_url AS logement_image,
            (SELECT COUNT(*) FROM campagnes_impressions i WHERE i.campagne_id = c.id) AS impressions,
            (SELECT COUNT(*) FROM campagnes_clics cl WHERE cl.campagne_id = c.id) AS clics,
            (SELECT COUNT(*) FROM campagnes_clics cl WHERE cl.campagne_id = c.id AND cl.type = "whatsapp") AS clics_whatsapp,
            GREATEST(0, TIMESTAMPDIFF(DAY, c.date_debut, LEAST(NOW(), IFNULL(c.date_fin, NOW())))) AS jours_ecoules
        FROM campagnes_publicitaires c
        JOIN logements l ON l.id = c.logement_id
        WHERE c.user_id = ?
        ORDER BY c.created_at DESC
    ');
    $stmt->execute([$userId]);
    $campagnes = $stmt->fetchAll();

    foreach ($campagnes as &$campagne) {

        $budget = (float) $campagne['budget'];
        $joursEcoules = (int) $campagne['jours_ecoules'];
        $dureeJours = (int) $campagne['duree_jours'];

        $depense = $dureeJours > 0
            ? min($budget, round($budget * $joursEcoules / $dureeJours, 2))
            : 0;

        $campagne['budget_depense'] = $campagne['statut'] === 'active' || $campagne['statut'] === 'terminee'
            ? $depense
            : 0;
    }
    unset($campagne);

    jsonResponse($campagnes);
}

/**
 * Campagnes actuellement actives pour un emplacement donné (accueil,
 * recherche, categories), avec les données complètes du logement
 * concerné — utilisé par le front pour intercaler des cartes
 * sponsorisées parmi les résultats normaux. Une annonce dont le
 * statut aurait changé depuis (retirée, plus approuvée) ne remonte
 * jamais ici, même si sa campagne est encore techniquement "active".
 */
function listCampagnesActives(): void
{
    $emplacement = $_GET['emplacement'] ?? null;

    if (!in_array($emplacement, ['accueil', 'recherche', 'categories'], true)) {
        jsonError('Emplacement invalide.');
    }

    $offresPourEmplacement = array_keys(array_filter(
        OFFRES_PUBLICITAIRES,
        fn ($offre) => in_array($emplacement, $offre['emplacements'], true)
    ));

    if (!$offresPourEmplacement) {
        jsonResponse([]);
        return;
    }

    $placeholders = implode(',', array_fill(0, count($offresPourEmplacement), '?'));

    $stmt = getPdo()->prepare("
        SELECT c.id AS campagne_id, c.offre, l.*,
            (SELECT GROUP_CONCAT(url ORDER BY position SEPARATOR '|')
             FROM logement_medias m WHERE m.logement_id = l.id AND m.type = 'image') AS photos,
            (SELECT GROUP_CONCAT(url ORDER BY position SEPARATOR '|')
             FROM logement_medias m WHERE m.logement_id = l.id AND m.type = 'video') AS videos
        FROM campagnes_publicitaires c
        JOIN logements l ON l.id = c.logement_id
        WHERE c.statut = 'active'
        AND c.offre IN ($placeholders)
        AND c.date_debut IS NOT NULL AND NOW() BETWEEN c.date_debut AND c.date_fin
        AND l.statut_validation = 'approuve'
        ORDER BY RAND()
        LIMIT 3
    ");
    $stmt->execute($offresPourEmplacement);

    jsonResponse($stmt->fetchAll());
}

function enregistrerImpressionCampagne(int $campagneId): void
{
    $emplacement = trim($_POST['emplacement'] ?? (getJsonBody()['emplacement'] ?? ''));

    if (!in_array($emplacement, ['accueil', 'recherche', 'categories'], true)) {
        jsonResponse(['ok' => false], 200);
        return;
    }

    $ip = $_SERVER['REMOTE_ADDR'] ?? 'inconnu';
    $ipHash = hash('sha256', $ip . 'terangahome_sel_visite');

    getPdo()->prepare('
        INSERT INTO campagnes_impressions (campagne_id, emplacement, ip_hash) VALUES (?, ?, ?)
    ')->execute([$campagneId, $emplacement, $ipHash]);

    jsonResponse(['ok' => true], 201);
}

function enregistrerClicCampagne(int $campagneId): void
{
    $body = getJsonBody();
    $type = $body['type'] ?? 'carte';

    if (!in_array($type, ['carte', 'whatsapp', 'details'], true)) {
        $type = 'carte';
    }

    $ip = $_SERVER['REMOTE_ADDR'] ?? 'inconnu';
    $ipHash = hash('sha256', $ip . 'terangahome_sel_visite');
    $userId = $_SESSION['user_id'] ?? null;

    getPdo()->prepare('
        INSERT INTO campagnes_clics (campagne_id, type, ip_hash, user_id) VALUES (?, ?, ?, ?)
    ')->execute([$campagneId, $type, $ipHash, $userId]);

    jsonResponse(['ok' => true], 201);
}
