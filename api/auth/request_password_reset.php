<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../emailer.php';

catn8_require_method('POST');

$body = catn8_read_json_body();
$email = trim((string)($body['email'] ?? ''));
$newPassword = (string)($body['new_password'] ?? '');

if ($email === '' || $newPassword === '') {
    catn8_json_response(['success' => false, 'error' => 'Email and new password are required'], 400);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    catn8_json_response(['success' => false, 'error' => 'Invalid email'], 400);
}

catn8_users_table_ensure();
catn8_password_reset_table_ensure();

$user = Database::queryOne('SELECT id, username, is_active, email_verified FROM users WHERE email = ?', [$email]);
if (!$user) {
    catn8_json_response(['success' => true]);
}

if ((int)($user['is_active'] ?? 0) !== 1 || (int)($user['email_verified'] ?? 0) !== 1) {
    catn8_json_response(['success' => true]);
}

$pendingHash = password_hash($newPassword, PASSWORD_DEFAULT);
$token = catn8_random_token();
$tokenHash = catn8_token_hash($token);
$expires = (new DateTimeImmutable('+2 hours'))->format('Y-m-d H:i:s');
Database::execute(
    'INSERT INTO password_reset_tokens (user_id, token_hash, pending_password_hash, expires_at) VALUES (?, ?, ?, ?)',
    [(int)$user['id'], $tokenHash, $pendingHash, $expires]
);

$origin = (catn8_is_local_request() ? 'http://localhost:8888' : ((isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? ''));
$link = rtrim($origin, '/') . '/reset.php?token=' . urlencode($token);

$html = '<p>A password reset was requested for your catn8.us account.</p>'
    . '<p><strong>Username:</strong> ' . htmlspecialchars((string)$user['username']) . '</p>'
    . '<p>Click this link to confirm your new password:</p>'
    . '<p><a href="' . htmlspecialchars($link) . '">' . htmlspecialchars($link) . '</a></p>';

try {
    if (!catn8_smtp_is_configured() && catn8_is_local_request()) {
        catn8_json_response(['success' => true, 'reset_link' => $link]);
    }
    if (!catn8_smtp_is_configured()) {
        catn8_json_response(['success' => false, 'error' => 'Email is not configured yet. Please try again later.'], 503);
    }
    catn8_send_email($email, (string)$user['username'], 'Confirm your catn8.us password reset', $html);
} catch (Throwable $e) {
    catn8_json_response(['success' => false, 'error' => 'Failed to send password reset email'], 500);
}

catn8_json_response(['success' => true]);
