<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/litig8_model.php';

catn8_session_start();
Litig8Model::ensureSchema();

function litig8_media_agent_token(): string
{
    $header = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (preg_match('/^\s*Bearer\s+(\S+)\s*$/i', $header, $m)) {
        return trim($m[1]);
    }
    return trim((string)($_SERVER['HTTP_X_LITIG8_AGENT_TOKEN'] ?? ''));
}

function litig8_media_serve_file(string $full, ?string $mime, string $downloadName): void
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

$documentId = (int)($_GET['document_id'] ?? $_GET['document'] ?? 0);
if ($documentId <= 0) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'document_id required';
    exit;
}

$uid = catn8_auth_user_id();
$agentOk = Litig8Model::verifyApiToken(litig8_media_agent_token());
$exp = (int)($_GET['exp'] ?? 0);
$sig = trim((string)($_GET['sig'] ?? ''));
$signedOk = Litig8Model::verifyDocumentAccess($documentId, $exp, $sig);

$row = Database::queryOne('SELECT * FROM litig8_documents WHERE id = ?', [$documentId]);
if (!$row) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Not found';
    exit;
}

$sessionOk = false;
if ($uid !== null) {
    try {
        $sessionOk = Litig8Model::canAccessApp($uid);
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

$full = Litig8Model::resolveDocumentPath($row);
if ($full === null || !is_file($full)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Not found';
    exit;
}

Litig8Model::audit(
    $uid,
    'view_document',
    'litig8_documents',
    $documentId,
    null,
    null,
    null,
    $agentOk ? 'agent:litig8' : null
);

litig8_media_serve_file($full, isset($row['mime']) ? (string)$row['mime'] : null, (string)($row['title'] ?? 'document'));
