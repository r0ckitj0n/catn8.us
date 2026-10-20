<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/rel8d_model.php';

catn8_session_start();
Rel8dModel::ensureSchema();

function rel8d_media_agent_token(): string
{
    $header = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (preg_match('/^\s*Bearer\s+(\S+)\s*$/i', $header, $m)) {
        return trim($m[1]);
    }
    $alt = trim((string)($_SERVER['HTTP_X_REL8D_AGENT_TOKEN'] ?? ''));
    if ($alt !== '') {
        return $alt;
    }
    return trim((string)($_SERVER['HTTP_X_API_KEY'] ?? ''));
}

function rel8d_media_serve_file(string $full, ?string $mime, string $downloadName): void
{
    $mime = $mime !== null && $mime !== '' ? $mime : 'application/octet-stream';
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . (string)filesize($full));
    header('Content-Disposition: inline; filename="' . str_replace('"', '', $downloadName) . '"');
    header('Cache-Control: private, max-age=120, no-transform');
    header('X-Content-Type-Options: nosniff');
    header('X-Robots-Tag: noindex, nofollow');
    readfile($full);
    exit;
}

$mediaId = (int)($_GET['media_id'] ?? $_GET['document_id'] ?? $_GET['id'] ?? 0);
if ($mediaId <= 0) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'media_id required';
    exit;
}

$uid = catn8_auth_user_id();
$agentOk = Rel8dModel::verifyApiToken(rel8d_media_agent_token());
$exp = (int)($_GET['exp'] ?? 0);
$sig = trim((string)($_GET['sig'] ?? ''));
$signedOk = Rel8dModel::verifyDocumentAccess($mediaId, $exp, $sig);

$row = Database::queryOne('SELECT * FROM rel8d_media WHERE id = ? AND deleted_at IS NULL', [$mediaId]);
if (!$row) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Not found';
    exit;
}

$sessionOk = false;
if ($uid !== null) {
    try {
        $sessionOk = Rel8dModel::canAccessApp($uid);
    } catch (Throwable $e) {
        $sessionOk = false;
    }
}

if (!$sessionOk && !$agentOk && !$signedOk) {
    http_response_code(401);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Not authenticated';
    exit;
}

$full = Rel8dModel::resolveMediaPath($row);
if ($full === null || !is_file($full)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Not found';
    exit;
}

Rel8dModel::audit(
    $uid,
    'view_media',
    'rel8d_media',
    $mediaId,
    isset($row['person_id']) ? (int)$row['person_id'] : null,
    null,
    null,
    $agentOk ? 'agent:rel8d' : null
);

rel8d_media_serve_file($full, isset($row['mime']) ? (string)$row['mime'] : null, (string)($row['title'] ?? $row['file_name'] ?? 'media'));
