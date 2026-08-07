<?php
/**
 * Front controller de l'API REST. Toutes les requêtes vers
 * backend/api/... arrivent ici (voir .htaccess) et sont
 * redirigées vers le bon fichier de routes/ selon le premier
 * segment de l'URL et la méthode HTTP.
 */

require_once __DIR__ . '/../includes/response.php';

// Calcule le chemin de base à partir de l'emplacement réel de ce
// fichier (dirname(SCRIPT_NAME)) plutôt que de le coder en dur,
// pour que l'API fonctionne quel que soit le dossier de montage
// du site (jonction htdocs, sous-dossier, etc.).
$scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME']));
$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$route = trim(substr($requestPath, strlen($scriptDir)), '/');
$segments = $route === '' ? [] : explode('/', $route);
$method = $_SERVER['REQUEST_METHOD'];

$resource = $segments[0] ?? null;
$rest = array_slice($segments, 1);

try {

    switch ($resource) {

        case 'auth':
            require __DIR__ . '/routes/auth.php';
            handleAuthRoute($rest, $method);
            break;

        case 'logements':
            require __DIR__ . '/routes/logements.php';
            handleLogementsRoute($rest, $method);
            break;

        case 'favoris':
            require __DIR__ . '/routes/favoris.php';
            handleFavorisRoute($rest, $method);
            break;

        case 'reservations':
            require __DIR__ . '/routes/reservations.php';
            handleReservationsRoute($rest, $method);
            break;

        case 'contact':
            require __DIR__ . '/routes/contact.php';
            handleContactRoute($rest, $method);
            break;

        case 'admin':
            require __DIR__ . '/routes/admin.php';
            handleAdminRoute($rest, $method);
            break;

        case 'visites':
            require __DIR__ . '/routes/visites.php';
            handleVisitesRoute($rest, $method);
            break;

        case 'notifications':
            require __DIR__ . '/routes/notifications.php';
            handleNotificationsRoute($rest, $method);
            break;

        case 'colocations':
            require __DIR__ . '/routes/colocations.php';
            handleColocationsRoute($rest, $method);
            break;

        case 'messagerie':
            require __DIR__ . '/routes/messagerie.php';
            handleMessagerieRoute($rest, $method);
            break;

        default:
            jsonError('Route introuvable.', 404);

    }

} catch (Throwable $e) {

    jsonError('Erreur serveur : ' . $e->getMessage(), 500);

}
