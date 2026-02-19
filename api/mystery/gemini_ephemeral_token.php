<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../includes/diagnostics_log.php';

catn8_session_start();
$viewerId = catn8_require_group_or_admin('mystery-game-users');

catn8_require_method('GET');

catn8_rate_limit_require('mystery.gemini_ephemeral_token.' . $viewerId, 30, 600);

$fail = static function (int $status, string $publicError, string $logMessage, array $meta = []) use ($viewerId): void {
    catn8_diagnostics_log_event('mystery.gemini_ephemeral_token', false, $status, $logMessage, $meta + ['viewer_id' => $viewerId]);
    catn8_json_response(['success' => false, 'error' => $publicError], $status);
};

$apiKey = secret_get('CATN8_MYSTERY_GEMINI_API_KEY');
if (!is_string($apiKey) || trim($apiKey) === '') {
    $fail(500, 'Missing secret CATN8_MYSTERY_GEMINI_API_KEY', 'Missing secret CATN8_MYSTERY_GEMINI_API_KEY');
}
$apiKey = trim($apiKey);

$expireTime = gmdate('c', time() + (30 * 60));
$newSessionExpireTime = gmdate('c', time() + 60);

$payload = [
    'uses' => 1,
    'expireTime' => $expireTime,
    'newSessionExpireTime' => $newSessionExpireTime,
];

$url = 'https://generativelanguage.googleapis.com/v1alpha/auth_tokens';
$respInfo = catn8_http_json_with_status(
    'POST',
    $url,
    ['x-goog-api-key' => $apiKey],
    $payload,
    10,
    20
);

$status = (int)($respInfo['status'] ?? 0);
$resp = (string)($respInfo['raw'] ?? '');
$data = $respInfo['json'] ?? null;

if (!is_string($resp) || $resp === '') {
    catn8_log_error('Gemini ephemeral token request failed', ['http_status' => $status]);
    $fail(500, 'Gemini ephemeral token request failed', 'Gemini ephemeral token request failed', ['http_status' => $status]);
}

if (!is_array($data)) {
    catn8_log_error('Gemini ephemeral token response was not valid JSON', ['http_status' => $status, 'raw' => substr((string)$resp, 0, 2000)]);
    $fail(500, 'Gemini ephemeral token response was not valid JSON', 'Gemini ephemeral token response was not valid JSON', ['http_status' => $status]);
}

if ($status >= 400 || isset($data['error'])) {
    $msg = '';
    if (isset($data['error']['message'])) {
        $msg = (string)$data['error']['message'];
    }
    if ($msg === '') {
        $msg = 'HTTP ' . $status;
    }
    catn8_log_error('Gemini ephemeral token error', ['http_status' => $status, 'message' => $msg, 'raw' => substr((string)$resp, 0, 2000)]);
    if (catn8_is_local_request()) {
        $fail(500, 'Gemini ephemeral token error: ' . $msg, 'Gemini ephemeral token error: ' . $msg, ['http_status' => $status]);
    }
    $fail(500, 'Gemini ephemeral token error', 'Gemini ephemeral token error: ' . $msg, ['http_status' => $status]);
}

$name = (string)($data['name'] ?? '');
if ($name === '') {
    $fail(500, 'Gemini ephemeral token response missing name', 'Gemini ephemeral token response missing name');
}

catn8_json_response([
    'success' => true,
    'token' => [
        'name' => $name,
        'expireTime' => (string)($data['expireTime'] ?? ''),
        'newSessionExpireTime' => (string)($data['newSessionExpireTime'] ?? ''),
        'uses' => (int)($data['uses'] ?? 0),
    ],
]);
