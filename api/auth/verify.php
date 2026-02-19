<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_require_method('POST');

$body = catn8_read_json_body();
$token = trim((string)($body['token'] ?? ''));
if ($token === '') {
    catn8_json_response(['success' => false, 'error' => 'Token is required'], 400);
}

catn8_users_table_ensure();
catn8_email_verify_table_ensure();

$tokenHash = catn8_token_hash($token);
$row = Database::queryOne(
    'SELECT id, user_id, expires_at, used_at FROM email_verification_tokens WHERE token_hash = ?',
    [$tokenHash]
);

if (!$row) {
    catn8_json_response(['success' => false, 'error' => 'Invalid token'], 400);
}

if (!empty($row['used_at'])) {
    catn8_json_response(['success' => false, 'error' => 'Token already used'], 400);
}

$expiresAt = new DateTimeImmutable((string)$row['expires_at']);
if ($expiresAt < new DateTimeImmutable('now')) {
    catn8_json_response(['success' => false, 'error' => 'Token expired'], 400);
}

$uid = (int)$row['user_id'];
Database::execute('UPDATE users SET email_verified = 1, is_active = 1 WHERE id = ?', [$uid]);
Database::execute('UPDATE email_verification_tokens SET used_at = NOW() WHERE id = ?', [(int)$row['id']]);

catn8_json_response(['success' => true]);
