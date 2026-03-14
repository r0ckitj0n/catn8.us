<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/diagnostics_log.php';

$fail = static function (string $eventKey, int $status, string $error, array $meta = []): void {
    catn8_diagnostics_log_event($eventKey, false, $status, $error, $meta);
    catn8_json_response(['success' => false, 'error' => $error], $status);
};

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if (!in_array($method, ['GET', 'POST'], true)) {
    $fail('accumul8_housekeeping', 405, 'Method not allowed');
}

$body = [];
if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    if (is_string($raw) && trim($raw) !== '') {
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            $fail('accumul8_housekeeping', 400, 'Invalid JSON body');
        }
        $body = $decoded;
    }
} else {
    $body = $_GET;
}

$authHeader = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? '');
$headerToken = '';
if (preg_match('/^\s*Bearer\s+(.+)\s*$/i', $authHeader, $matches)) {
    $headerToken = trim((string)($matches[1] ?? ''));
}

$expected = (string)catn8_env('CATN8_ADMIN_TOKEN', '');
$got = (string)($body['admin_token'] ?? $_GET['admin_token'] ?? $headerToken);
if ($expected === '' || $got === '' || !hash_equals($expected, $got)) {
    $fail('accumul8_housekeeping', 403, 'Invalid admin token');
}

if ($method === 'GET') {
    header('Warning: 299 - "Deprecated: use POST with JSON body or Authorization header for accumul8_housekeeping."');
}

$ownerUserId = (int)($body['owner_user_id'] ?? 0);
if ($ownerUserId <= 0) {
    $fail('accumul8_housekeeping', 400, 'owner_user_id is required');
}

define('CATN8_ACCUMUL8_LIBRARY_ONLY', true);
require_once __DIR__ . '/accumul8.php';

try {
    accumul8_get_or_create_default_account($ownerUserId);
    $result = accumul8_run_aicountant_housekeeping($ownerUserId, $ownerUserId, [
        'send_email' => $body['send_email'] ?? 1,
        'create_notification_rule' => $body['create_notification_rule'] ?? 1,
        'email_on_attention_only' => $body['email_on_attention_only'] ?? 1,
        'run_entity_maintenance' => $body['run_entity_maintenance'] ?? 1,
    ]);
    catn8_diagnostics_log_event('accumul8_housekeeping', true, 200, 'AIcountant housekeeping completed', [
        'owner_user_id' => $ownerUserId,
        'attention_needed' => (int)($result['attention_needed'] ?? 0),
        'request_method' => $method,
    ]);
    catn8_json_response(array_merge(['success' => true], $result));
} catch (Throwable $exception) {
    $fail('accumul8_housekeeping', 500, (string)$exception->getMessage(), [
        'owner_user_id' => $ownerUserId,
    ]);
}
