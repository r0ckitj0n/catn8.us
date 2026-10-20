<?php

declare(strict_types=1);

function catn8_mfa_device_signing_key(): string
{
    $existing = secret_get('catn8.mfa.device_signing_key');
    if (is_string($existing) && strlen($existing) >= 32) {
        return $existing;
    }
    $created = catn8_mfa_base64url_encode(random_bytes(32));
    if (!secret_set('catn8.mfa.device_signing_key', $created)) {
        throw new RuntimeException('MFA device signing key is unavailable');
    }
    return $created;
}
function catn8_mfa_set_device_cookie(string $value, int $expiresAt): void
{
    $params = [
        'expires' => $expiresAt,
        'path' => '/',
        'secure' => catn8_mfa_cookie_secure(),
        'httponly' => true,
        'samesite' => 'Lax',
    ];
    $cookieDomain = function_exists('catn8_cookie_domain') ? catn8_cookie_domain() : '';
    if ($cookieDomain !== '') {
        $params['domain'] = $cookieDomain;
    }
    setcookie(CATN8_MFA_DEVICE_COOKIE, $value, $params);
}
function catn8_mfa_trusted_user_id(): int
{
    catn8_mfa_tables_ensure();
    $raw = (string)($_COOKIE[CATN8_MFA_DEVICE_COOKIE] ?? '');
    $parsed = catn8_mfa_parse_device_cookie($raw);
    if ($parsed === null) {
        return 0;
    }
    try {
        $key = catn8_mfa_device_signing_key();
    } catch (Throwable $e) {
        return 0;
    }
    if (!catn8_mfa_device_cookie_signature_ok($parsed, $key, time())) {
        return 0;
    }
    $selector = (string)$parsed['selector'];
    $verifier = catn8_mfa_base64url_decode((string)$parsed['verifier']);
    if ($verifier === null) {
        return 0;
    }
    $row = Database::queryOne(
        'SELECT id, user_id, token_hash, expires_at, revoked_at FROM auth_trusted_devices WHERE selector = ? LIMIT 1',
        [$selector]
    );
    if (!$row || $row['revoked_at'] !== null) {
        return 0;
    }
    $expires = strtotime((string)$row['expires_at']);
    if ($expires === false || $expires <= time()) {
        return 0;
    }
    $stored = (string)$row['token_hash'];
    $calc = hash('sha256', $verifier, true);
    if (!hash_equals($stored, $calc)) {
        return 0;
    }
    Database::execute('UPDATE auth_trusted_devices SET last_used_at = NOW() WHERE id = ?', [(int)$row['id']]);
    return (int)$row['user_id'];
}
function catn8_mfa_issue_trusted_device(int $userId): bool
{
    catn8_mfa_tables_ensure();
    $selector = catn8_mfa_base64url_encode(random_bytes(18));
    $verifierRaw = random_bytes(32);
    $verifier = catn8_mfa_base64url_encode($verifierRaw);
    $expiresAt = time() + CATN8_MFA_TRUST_SECONDS;
    $key = catn8_mfa_device_signing_key();
    $ua = substr(trim((string)($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 255);
    Database::execute(
        'INSERT INTO auth_trusted_devices (user_id, selector, token_hash, expires_at, user_agent) VALUES (?, ?, ?, FROM_UNIXTIME(?), ?)',
        [$userId, $selector, hash('sha256', $verifierRaw, true), $expiresAt, $ua !== '' ? $ua : null]
    );
    catn8_mfa_set_device_cookie(catn8_mfa_device_cookie_value($selector, $verifier, $expiresAt, $key), $expiresAt);
    catn8_mfa_audit('trusted_device_issued', true, 200, 'Trusted device cookie issued', ['user_id' => $userId]);
    return true;
}
function catn8_mfa_revoke_devices_for_user(int $userId): int
{
    catn8_mfa_tables_ensure();
    $count = Database::execute(
        'UPDATE auth_trusted_devices SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
        [$userId]
    );
    catn8_mfa_audit('trusted_device_revoked', true, 200, 'Trusted devices revoked', ['user_id' => $userId, 'count' => $count]);
    return $count;
}
