<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../emailer.php';

catn8_require_method('POST');

$body = catn8_read_json_body();
$username = trim((string)($body['username'] ?? ''));
$email = trim((string)($body['email'] ?? ''));
$password = (string)($body['password'] ?? '');

if ($username === '' || $email === '' || $password === '') {
    catn8_json_response(['success' => false, 'error' => 'Username, email, and password are required'], 400);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    catn8_json_response(['success' => false, 'error' => 'Invalid email'], 400);
}

catn8_users_table_ensure();

$requireVerify = catn8_setting_bool('auth.require_email_verification', false);
$allowPublicSignup = catn8_setting_bool('auth.allow_public_signup', true);

if (!$allowPublicSignup) {
    // Public signups create a disabled account until an admin enables it.
    $requireVerify = false;
}

$existing = Database::queryOne('SELECT id FROM users WHERE username = ? OR email = ?', [$username, $email]);
if ($existing) {
    catn8_json_response(['success' => false, 'error' => 'Username or email already exists'], 409);
}

$hash = password_hash($password, PASSWORD_DEFAULT);
Database::execute(
    'INSERT INTO users (username, email, password_hash, is_active, email_verified) VALUES (?, ?, ?, ?, ?)',
    [$username, $email, $hash, ($allowPublicSignup ? ($requireVerify ? 0 : 1) : 0), ($requireVerify ? 0 : 1)]
);
$user = Database::queryOne('SELECT id FROM users WHERE username = ?', [$username]);
$uid = (int)($user['id'] ?? 0);
if ($uid <= 0) {
    catn8_json_response(['success' => false, 'error' => 'Failed to create user'], 500);
}

if (!$allowPublicSignup) {
    catn8_json_response(['success' => true, 'status' => 'pending_admin_approval']);
}

if (!$requireVerify) {
    catn8_json_response(['success' => true, 'status' => 'active']);
}

catn8_email_verify_table_ensure();

$token = catn8_random_token();
$tokenHash = catn8_token_hash($token);
$expires = (new DateTimeImmutable('+2 days'))->format('Y-m-d H:i:s');
Database::execute(
    'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [$uid, $tokenHash, $expires]
);

$origin = (catn8_is_local_request() ? 'http://localhost:8888' : ((isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? ''));
$link = rtrim($origin, '/') . '/verify.php?token=' . urlencode($token);

$html = '<p>Your catn8.us account was created.</p>'
    . '<p><strong>Username:</strong> ' . htmlspecialchars($username) . '</p>'
    . '<p>Please verify your email to activate your account:</p>'
    . '<p><a href="' . htmlspecialchars($link) . '">' . htmlspecialchars($link) . '</a></p>';

try {
    if (!catn8_smtp_is_configured() && catn8_is_local_request()) {
        catn8_json_response(['success' => true, 'status' => 'verification_required', 'verify_link' => $link]);
    }
    if (!catn8_smtp_is_configured()) {
        catn8_json_response(['success' => false, 'error' => 'Email is not configured yet. Please try again later.'], 503);
    }
    catn8_send_email($email, $username, 'Verify your catn8.us account', $html);
} catch (Throwable $e) {
    catn8_json_response(['success' => false, 'error' => 'Failed to send verification email'], 500);
}

catn8_json_response(['success' => true, 'status' => 'verification_required']);
