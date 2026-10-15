<?php

declare(strict_types=1);

/**
 * Admin-token protected Fabric8 bootstrap:
 * - rotates agent API token (SHA-256 stored in secrets; plaintext returned once)
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/fabric8_reminders_sync.php';

catn8_require_method('POST', false);

$expected = trim((string)catn8_env('CATN8_ADMIN_TOKEN', ''));
$got = trim((string)($_GET['admin_token'] ?? $_POST['admin_token'] ?? $_SERVER['HTTP_X_API_KEY'] ?? ''));
if ($expected === '' || $got === '' || !hash_equals($expected, $got)) {
    catn8_json_response(['success' => false, 'error' => 'Invalid admin token'], 403);
}

$secretKey = 'fabric8.agent.api_token_hash';
$token = function_exists('catn8_random_token')
    ? catn8_random_token()
    : bin2hex(random_bytes(32));
if (!secret_set($secretKey, hash('sha256', $token))) {
    catn8_json_response(['success' => false, 'error' => 'Failed to store agent token hash'], 500);
}

catn8_json_response([
    'success' => true,
    'tokens' => [
        'agent' => $token,
    ],
    'secret_keys' => [
        'agent' => $secretKey,
    ],
    'reminders_sync_enabled' => fabric8_reminders_sync_enabled(),
    'note' => 'Store plaintext token on Compil8r only; server stores SHA-256 hash in secrets.',
]);
