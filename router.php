<?php

declare(strict_types=1);

$root = __DIR__;
$requestUri = (string)($_SERVER['REQUEST_URI'] ?? '/');
$path = (string)(parse_url($requestUri, PHP_URL_PATH) ?? '/');
if ($path === '') {
    $path = '/';
}

function catn8_router_is_local_vite_enabled(string $root): bool
{
    if (is_file($root . '/.disable-vite-dev')) {
        return false;
    }
    $env = strtolower(trim((string)(getenv('CATN8_VITE_DISABLE_DEV') ?: '')));
    return !in_array($env, ['1', 'true', 'yes', 'on'], true);
}

function catn8_router_vite_origin(string $root): string
{
    $hotPath = $root . '/hot';
    if (is_file($hotPath)) {
        $hot = trim((string)file_get_contents($hotPath));
        if ($hot !== '') {
            return rtrim($hot, '/');
        }
    }
    $envOrigin = trim((string)(getenv('CATN8_VITE_ORIGIN') ?: ''));
    if ($envOrigin !== '') {
        return rtrim($envOrigin, '/');
    }
    return 'http://localhost:5178';
}

function catn8_router_respond_file(string $file): void
{
    if (!is_file($file)) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=UTF-8');
        echo 'Not found';
        exit;
    }
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    // Prefer extension map for web assets: mime_content_type often returns
    // text/plain for .js/.css on minimal hosts, which breaks ES modules.
    $mimeMap = [
        'html' => 'text/html; charset=UTF-8',
        'css' => 'text/css; charset=UTF-8',
        'js' => 'application/javascript; charset=UTF-8',
        'mjs' => 'application/javascript; charset=UTF-8',
        'json' => 'application/json; charset=UTF-8',
        'svg' => 'image/svg+xml',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'webmanifest' => 'application/manifest+json',
    ];
    $mime = $mimeMap[$ext] ?? '';
    if ($mime === '') {
        $detected = function_exists('mime_content_type') ? (string)(mime_content_type($file) ?: '') : '';
        $mime = $detected !== '' ? $detected : 'application/octet-stream';
    }
    header('Content-Type: ' . $mime);
    readfile($file);
    exit;
}

$isApiRoute = strncmp($path, '/api/', 5) === 0;
$isPhpRoute = $isApiRoute || substr($path, -4) === '.php';

// Product subdomain Host simulation (e.g. Host: medic8.catn8.us) for local PHP server.
$routerHost = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
if (str_contains($routerHost, ':')) {
    $routerHost = explode(':', $routerHost, 2)[0];
}
$routerDnsMap = [
    'elucid8' => 'elucid8.php',
    'activ8' => 'activ8.php',
    'recre8' => 'recre8.php',
    'illumin8' => 'illumin8.php',
    'stimul8' => 'stimul8.php',
    'narr8' => 'narr8.php',
    'loc8' => 'loc8.php',
    'investig8' => 'investig8.php',
    'sheriff-station' => 'sheriff_station.php',
    'fabric8' => 'fabric8.php',
    'photo-m8' => 'photo-m8.php',
    'accumul8' => 'accumul8.php',
    'valid8' => 'valid8.php',
    'celebr8' => 'celebr8.php',
    'tabul8' => 'tabul8.php',
    'medic8' => 'medic8.php',
    'litig8' => 'litig8.php',
    'rel8d' => 'rel8d.php',
];
if (str_ends_with($routerHost, '.catn8.us')) {
    $routerLabel = substr($routerHost, 0, -strlen('.catn8.us'));
    $shared = preg_match('#^/(api/|dist/|images/|css/|assets/|emojis/|vendor/|login|settings|verify|reset|favicon)#i', $path) === 1;
    if (!$shared && $routerLabel !== '' && $routerLabel !== 'www' && isset($routerDnsMap[$routerLabel])) {
        require $root . '/' . $routerDnsMap[$routerLabel];
        exit;
    }
}

$appPhpRoutes = [
    '/elucid8' => '/elucid8.php',
    '/activ8' => '/activ8.php',
    '/recre8' => '/recre8.php',
    '/illumin8' => '/illumin8.php',
    '/stimul8' => '/stimul8.php',
    '/narr8' => '/narr8.php',
    '/loc8' => '/loc8.php',
    '/investig8' => '/investig8.php',
    '/fabric8' => '/fabric8.php',
    '/photo-m8' => '/photo-m8.php',
    '/accumul8' => '/accumul8.php',
    '/valid8' => '/valid8.php',
    '/celebr8' => '/celebr8.php',
    '/tabul8' => '/tabul8.php',
    '/medic8' => '/medic8.php',
    '/litig8' => '/litig8.php',
    '/rel8d' => '/rel8d.php',
    '/rel8ed' => '/rel8ed.php',
    '/login' => '/login.php',
    '/sheriff_station' => '/sheriff_station.php',
    '/settings' => '/settings.php',
    '/frogger' => '/frogger-game.php',
    '/pacman' => '/pacman-game.php',
    '/asteroids' => '/asteroids-game.php',
    '/tetris' => '/tetris-game.php',
    '/verify' => '/verify.php',
    '/reset' => '/reset.php',
];

$retiredPaths = [
    '/about',
    '/activities',
    '/arcade',
    '/coloring',
    '/games',
    '/stories',
    '/wordsearch',
    '/mystery',
    '/photo-albums',
    '/build-wizard',
    '/build_wizard',
];

if (!$isPhpRoute) {
    $canonical = rtrim($path, '/');
    if ($canonical === '') {
        $canonical = '/';
    }
    if (in_array($canonical, $retiredPaths, true)) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=UTF-8');
        echo 'Not found';
        exit;
    }
    if (isset($appPhpRoutes[$canonical])) {
        require $root . $appPhpRoutes[$canonical];
        exit;
    }
    if ($canonical === '/celebr8/templates' || $canonical === '/celebr8/activities'
        || preg_match('#^/celebr8/activities/[0-9]+$#', $canonical) === 1
        || preg_match('#^/celebr8/party(?:/[0-9]+)?$#', $canonical) === 1) {
        require $root . '/celebr8.php';
        exit;
    }
    if ($canonical === '/tabul8'
        || preg_match('#^/tabul8/party/[0-9]+(?:/(?:camera|display|vote))?$#', $canonical) === 1
        || preg_match('#^/tabul8/vote/[^/]+$#', $canonical) === 1) {
        require $root . '/tabul8.php';
        exit;
    }
    if ($canonical === '/medic8' || preg_match('#^/medic8/#', $canonical) === 1) {
        require $root . '/medic8.php';
        exit;
    }
    if ($canonical === '/litig8' || preg_match('#^/litig8/#', $canonical) === 1) {
        require $root . '/litig8.php';
        exit;
    }
    if ($canonical === '/rel8d' || preg_match('#^/rel8d/#', $canonical) === 1) {
        require $root . '/rel8d.php';
        exit;
    }
    if ($canonical === '/rel8ed' || preg_match('#^/rel8ed/#', $canonical) === 1) {
        require $root . '/rel8ed.php';
        exit;
    }
}

if ($isPhpRoute) {
    $candidate = $path === '/' ? '/index.php' : $path;
    $target = $root . '/' . ltrim($candidate, '/');
    if (!is_file($target)) {
        http_response_code(404);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(['success' => false, 'error' => 'Not found']);
        exit;
    }
    require $target;
    exit;
}

$requestMethod = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$viteEnabled = catn8_router_is_local_vite_enabled($root);

if ($viteEnabled) {
    $origin = catn8_router_vite_origin($root);
    $target = $origin . $requestUri;
    header('Location: ' . $target, true, ($requestMethod === 'GET' ? 302 : 307));
    exit;
}

$directPath = $root . '/' . ltrim($path, '/');
if (is_file($directPath)) {
    catn8_router_respond_file($directPath);
}

$distIndex = $root . '/dist/index.html';
if (is_file($distIndex)) {
    catn8_router_respond_file($distIndex);
}

catn8_router_respond_file($root . '/index.html');
