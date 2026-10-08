<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/celebr8_model.php';
require_once __DIR__ . '/../includes/celebr8_catalog_model.php';

catn8_session_start();
Celebr8Model::ensureSchema();

function celebr8_media_agent_token(): string
{
    $header = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (preg_match('/^\s*Bearer\s+(\S+)\s*$/i', $header, $m)) {
        return trim($m[1]);
    }
    return trim((string)($_SERVER['HTTP_X_CELEBR8_AGENT_TOKEN'] ?? ''));
}

$uid = catn8_auth_user_id();
$agentOk = Celebr8Model::verifyApiToken(celebr8_media_agent_token(), Celebr8Model::AGENT_TOKEN_SECRET_KEY);
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
header('Cache-Control: private, max-age=3600');
header('X-Content-Type-Options: nosniff');
readfile($full);
exit;
