<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_require_method('POST');
catn8_session_start();

$body = catn8_read_json_body();
$username = trim((string)($body['username'] ?? ''));
$password = (string)($body['password'] ?? '');

if ($username === '' || $password === '') {
    catn8_json_response(['success' => false, 'error' => 'Username and password are required'], 400);
}

catn8_users_table_ensure();

$requireVerify = catn8_setting_bool('auth.require_email_verification', false);

$user = Database::queryOne('SELECT id, password_hash, is_admin, is_active, email_verified FROM users WHERE username = ?', [$username]);
if (!$user) {
    catn8_json_response(['success' => false, 'error' => 'Invalid credentials'], 401);
}

if ((int)($user['is_active'] ?? 0) !== 1 && (int)($user['is_admin'] ?? 0) !== 1) {
    catn8_json_response(['success' => false, 'error' => 'Account is pending admin approval'], 403);
}

if ($requireVerify && (int)($user['email_verified'] ?? 0) !== 1) {
    catn8_json_response(['success' => false, 'error' => 'Account is not verified yet'], 403);
}

if (!password_verify($password, (string)$user['password_hash'])) {
    catn8_json_response(['success' => false, 'error' => 'Invalid credentials'], 401);
}

$_SESSION['catn8_user_id'] = (int)$user['id'];

catn8_json_response(['success' => true]);
