<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/celebr8_model.php';
require_once __DIR__ . '/../includes/celebr8_catalog_model.php';
require_once __DIR__ . '/../includes/celebr8_album_model.php';
require_once __DIR__ . '/../includes/celebr8_flyer_model.php';

catn8_session_start();
Celebr8Model::ensureSchema();
Celebr8AlbumModel::ensureSchema();
Celebr8FlyerModel::ensureSchema();

function celebr8_media_agent_token(): string
{
    $header = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (preg_match('/^\s*Bearer\s+(\S+)\s*$/i', $header, $m)) {
        return trim($m[1]);
    }
    return trim((string)($_SERVER['HTTP_X_CELEBR8_AGENT_TOKEN'] ?? ''));
}

function celebr8_media_serve_file(string $full): void
{
    $ext = strtolower(pathinfo($full, PATHINFO_EXTENSION));
    $types = [
        'webp' => 'image/webp',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'gif' => 'image/gif',
    ];
    $mime = $types[$ext] ?? 'application/octet-stream';
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . (string)filesize($full));
    header('Cache-Control: private, max-age=300, no-transform');
    header('X-Content-Type-Options: nosniff');
    header('X-Robots-Tag: noindex, nofollow');
    readfile($full);
    exit;
}

$uid = catn8_auth_user_id();
$agentOk = Celebr8Model::verifyApiToken(celebr8_media_agent_token(), Celebr8Model::AGENT_TOKEN_SECRET_KEY);

$flyerId = (int)($_GET['flyer'] ?? $_GET['flyer_id'] ?? 0);
if ($flyerId > 0) {
    $variant = strtolower(trim((string)($_GET['v'] ?? $_GET['variant'] ?? 'web')));
    if ($variant !== 'original') {
        $variant = 'web';
    }
    $exp = (int)($_GET['exp'] ?? 0);
    $sig = trim((string)($_GET['sig'] ?? ''));
    $signedOk = Celebr8FlyerModel::verifyFlyerAccess($flyerId, $variant, $exp, $sig);

    if ($uid === null && !$agentOk && !$signedOk) {
        http_response_code(401);
        header('Content-Type: text/plain; charset=UTF-8');
        echo 'Not authenticated';
        exit;
    }

    $row = Celebr8FlyerModel::getFlyer($flyerId);
    if (!$row) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=UTF-8');
        echo 'Not found';
        exit;
    }
    $full = Celebr8FlyerModel::resolveFlyerPath($row, $variant);
    if ($full === null) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=UTF-8');
        echo 'Not found';
        exit;
    }
    celebr8_media_serve_file($full);
}

$photoId = (int)($_GET['photo'] ?? $_GET['photo_id'] ?? 0);
if ($photoId > 0) {
    $variant = strtolower(trim((string)($_GET['v'] ?? $_GET['variant'] ?? 'web')));
    if (!in_array($variant, Celebr8AlbumModel::VARIANTS, true)) {
        $variant = 'web';
    }
    $exp = (int)($_GET['exp'] ?? 0);
    $sig = trim((string)($_GET['sig'] ?? ''));
    $signedOk = Celebr8AlbumModel::verifyPhotoAccess($photoId, $variant, $exp, $sig);

    if ($uid === null && !$agentOk && !$signedOk) {
        http_response_code(401);
        header('Content-Type: text/plain; charset=UTF-8');
        echo 'Not authenticated';
        exit;
    }

    $row = Celebr8AlbumModel::getPhoto($photoId);
    if (!$row) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=UTF-8');
        echo 'Not found';
        exit;
    }
    $full = Celebr8AlbumModel::resolveVariantPath($row, $variant);
    if ($full === null) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=UTF-8');
        echo 'Not found';
        exit;
    }
    celebr8_media_serve_file($full);
}

// Legacy catalog media (?f=relative/path.webp) — session or agent only (no permanent public links).
if ($uid === null && !$agentOk) {
    http_response_code(401);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Not authenticated';
    exit;
}

$rel = trim((string)($_GET['f'] ?? $_GET['path'] ?? ''));
$full = Celebr8CatalogModel::resolveMediaPath($rel);
if ($full === null) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Not found';
    exit;
}

celebr8_media_serve_file($full);
