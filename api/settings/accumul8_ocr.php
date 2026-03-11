<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_session_start();
catn8_require_admin();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$secretKey = catn8_secret_key('accumul8.ocr.google.service_account_json');

$summarize = static function (?string $serviceAccountJson): array {
    $decoded = is_string($serviceAccountJson) && trim($serviceAccountJson) !== ''
        ? json_decode($serviceAccountJson, true)
        : null;
    $decoded = is_array($decoded) ? $decoded : [];
    $clientEmail = trim((string)($decoded['client_email'] ?? ''));
    return [
        'has_service_account_json' => $decoded !== [] ? 1 : 0,
        'project_id' => trim((string)($decoded['project_id'] ?? '')),
        'client_email' => $clientEmail,
        'client_email_hint' => $clientEmail !== '' ? preg_replace('/(^.).+(@.+$)/', '$1***$2', $clientEmail) : '',
    ];
};

if ($method === 'GET') {
    catn8_json_response([
        'success' => true,
        'settings' => $summarize(secret_get($secretKey)),
    ]);
}

if ($method !== 'POST') {
    catn8_json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

$body = catn8_read_json_body();
$clear = isset($body['clear']) && (int)$body['clear'] === 1;

if ($clear) {
    if (!secret_delete($secretKey)) {
        catn8_json_response(['success' => false, 'error' => 'Failed to remove stored OCR credential'], 500);
    }
    catn8_json_response([
        'success' => true,
        'settings' => $summarize(null),
    ]);
}

$serviceAccountJson = (string)($body['service_account_json'] ?? '');
if (trim($serviceAccountJson) === '') {
    catn8_json_response(['success' => false, 'error' => 'service_account_json is required'], 400);
}

$decoded = json_decode($serviceAccountJson, true);
if (!is_array($decoded)) {
    catn8_json_response(['success' => false, 'error' => 'service_account_json is not valid JSON'], 400);
}

$projectId = trim((string)($decoded['project_id'] ?? ''));
$clientEmail = trim((string)($decoded['client_email'] ?? ''));
$privateKey = trim((string)($decoded['private_key'] ?? ''));
$type = trim((string)($decoded['type'] ?? ''));

if ($type !== 'service_account') {
    catn8_json_response(['success' => false, 'error' => 'service_account_json must be a Google service account credential'], 400);
}
if ($projectId === '') {
    catn8_json_response(['success' => false, 'error' => 'service_account_json missing project_id'], 400);
}
if ($clientEmail === '') {
    catn8_json_response(['success' => false, 'error' => 'service_account_json missing client_email'], 400);
}
if ($privateKey === '') {
    catn8_json_response(['success' => false, 'error' => 'service_account_json missing private_key'], 400);
}

if (!secret_set($secretKey, $serviceAccountJson)) {
    catn8_json_response(['success' => false, 'error' => 'Failed to store OCR credential'], 500);
}

catn8_json_response([
    'success' => true,
    'settings' => $summarize($serviceAccountJson),
]);
