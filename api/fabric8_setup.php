<?php

declare(strict_types=1);

/**
 * Admin-token protected Fabric8 bootstrap:
 * - action=rotate_token (default): rotates agent API token (SHA-256 in secrets)
 * - action=mint_session: starts a PHP session as the first active admin (for headless checks)
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/fabric8_reminders_sync.php';

catn8_require_method('POST', false);

$expected = trim((string)catn8_env('CATN8_ADMIN_TOKEN', ''));
$got = trim((string)($_GET['admin_token'] ?? $_POST['admin_token'] ?? $_SERVER['HTTP_X_API_KEY'] ?? ''));
if ($expected === '' || $got === '' || !hash_equals($expected, $got)) {
    catn8_json_response(['success' => false, 'error' => 'Invalid admin token'], 403);
}

$action = strtolower(trim((string)($_GET['action'] ?? $_POST['action'] ?? 'rotate_token')));
if ($action === '') {
    $action = 'rotate_token';
}

if ($action === 'mint_session') {
    catn8_session_start();
    catn8_users_table_ensure();
    $admin = Database::queryOne(
        'SELECT id FROM users WHERE is_admin = 1 AND COALESCE(is_active, 1) = 1 ORDER BY id ASC LIMIT 1'
    );
    if (!$admin) {
        catn8_json_response(['success' => false, 'error' => 'No active admin user found'], 500);
    }
    $uid = (int)$admin['id'];
    $_SESSION['catn8_user_id'] = $uid;
    catn8_json_response([
        'success' => true,
        'action' => 'mint_session',
        'user_id' => $uid,
        'reminders_sync_enabled' => fabric8_reminders_sync_enabled(),
        'note' => 'PHP session cookie set; use for short-lived headless/browser checks only.',
    ]);
}

if ($action !== 'rotate_token') {
    catn8_json_response(['success' => false, 'error' => 'Unknown action'], 400);
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
    'action' => 'rotate_token',
    'tokens' => [
        'agent' => $token,
    ],
    'secret_keys' => [
        'agent' => $secretKey,
    ],
    'reminders_sync_enabled' => fabric8_reminders_sync_enabled(),
    'note' => 'Store plaintext token on Compil8r only; server stores SHA-256 hash in secrets.',
]);
