<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/medic8_model.php';

catn8_session_start();
Medic8Model::ensureSchema();

function medic8_media_agent_token(): string
{
    $header = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (preg_match('/^\s*Bearer\s+(\S+)\s*$/i', $header, $m)) {
        return trim($m[1]);
    }
    return trim((string)($_SERVER['HTTP_X_MEDIC8_AGENT_TOKEN'] ?? ''));
}

function medic8_media_serve_file(string $full, ?string $mime, string $downloadName): void
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
$agentOk = Medic8Model::verifyApiToken(medic8_media_agent_token());
$exp = (int)($_GET['exp'] ?? 0);
$sig = trim((string)($_GET['sig'] ?? ''));
$signedOk = Medic8Model::verifyDocumentAccess($documentId, $exp, $sig);

$row = Database::queryOne('SELECT * FROM medic8_documents WHERE id = ?', [$documentId]);
if (!$row) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Not found';
    exit;
}

$personId = (int)($row['person_id'] ?? 0);
$sessionOk = false;
if ($uid !== null) {
    try {
        $sessionOk = Medic8Model::canAccessApp($uid) && Medic8Model::userCanAccessPerson($uid, $personId, 'documents', false);
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

$full = Medic8Model::resolveDocumentPath($row);
if ($full === null || !is_file($full)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Not found';
    exit;
}

Medic8Model::audit(
    $uid,
    'view_document',
    'medic8_documents',
    $documentId,
    $personId,
    null,
    null,
    $agentOk ? 'agent:medic8' : null
);

medic8_media_serve_file($full, isset($row['mime']) ? (string)$row['mime'] : null, (string)($row['title'] ?? 'document'));
