<?php

declare(strict_types=1);

const CATN8_MFA_CODE_TTL_SECONDS = 600;
const CATN8_MFA_MAX_ATTEMPTS = 5;
const CATN8_MFA_RESEND_COOLDOWN_SECONDS = 60;
const CATN8_MFA_RESEND_MAX_PER_HOUR = 5;
const CATN8_MFA_TRUST_SECONDS = 2592000;
const CATN8_MFA_STEP_UP_SECONDS = 43200;
const CATN8_MFA_DEVICE_COOKIE = 'catn8_mfa_device';

function catn8_mfa_mask_email(string $email): string
{
    $email = strtolower(trim($email));
    $at = strrpos($email, '@');
    if ($at === false || $at < 1) {
        return 'your email';
    }
    $local = substr($email, 0, $at);
    $domain = substr($email, $at + 1);
    if ($local === '' || $domain === '' || strpos($domain, '.') === false) {
        return 'your email';
    }
    return substr($local, 0, 1) . '***@' . $domain;
}

function catn8_mfa_normalize_code(string $code): string
{
    return trim($code);
}

function catn8_mfa_code_is_well_formed(string $code): bool
{
    return preg_match('/^\d{6}$/', $code) === 1;
}

function catn8_mfa_generate_code(): string
{
    return str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
}

function catn8_mfa_hash_code(string $code): string
{
    return password_hash($code, PASSWORD_DEFAULT);
}

function catn8_mfa_code_matches(string $code, string $hash): bool
{
    if (!catn8_mfa_code_is_well_formed($code) || $hash === '') {
        return false;
    }
    return password_verify($code, $hash);
}

function catn8_mfa_attempt_allowed(int $attemptCount): bool
{
    return $attemptCount < CATN8_MFA_MAX_ATTEMPTS;
}

function catn8_mfa_is_expired(int $expiresAtUnix, int $now): bool
{
    return $expiresAtUnix <= $now;
}

function catn8_mfa_verified_at_is_fresh(int $verifiedAt, int $now, int $windowSeconds = CATN8_MFA_STEP_UP_SECONDS): bool
{
    if ($verifiedAt <= 0 || $windowSeconds <= 0) {
        return false;
    }
    if ($verifiedAt > $now + 120) {
        return false;
    }
    return ($now - $verifiedAt) < $windowSeconds;
}

function catn8_mfa_api_token_skips_step_up(bool $hasValidApiToken): bool
{
    return $hasValidApiToken;
}

function catn8_mfa_base64url_encode(string $raw): string
{
    return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
}

function catn8_mfa_base64url_decode(string $encoded): ?string
{
    $encoded = trim($encoded);
    if ($encoded === '' || preg_match('/^[A-Za-z0-9\-_]+$/', $encoded) !== 1) {
        return null;
    }
    $pad = strlen($encoded) % 4;
    if ($pad > 0) {
        $encoded .= str_repeat('=', 4 - $pad);
    }
    $raw = base64_decode(strtr($encoded, '-_', '+/'), true);
    return is_string($raw) && $raw !== '' ? $raw : null;
}

function catn8_mfa_device_mac(string $selector, string $verifier, int $expiresAt, string $key): string
{
    return hash_hmac('sha256', $selector . '|' . $verifier . '|' . $expiresAt, $key);
}

function catn8_mfa_device_cookie_value(string $selector, string $verifier, int $expiresAt, string $key): string
{
    return $selector . '.' . $verifier . '.' . $expiresAt . '.' . catn8_mfa_device_mac($selector, $verifier, $expiresAt, $key);
}

/**
 * @return array{selector:string,verifier:string,expires_at:int,mac:string}|null
 */
function catn8_mfa_parse_device_cookie(string $value): ?array
{
    $parts = explode('.', trim($value));
    if (count($parts) !== 4) {
        return null;
    }
    [$selector, $verifier, $expires, $mac] = $parts;
    if (preg_match('/^[A-Za-z0-9\-_]{16,128}$/', $selector) !== 1) {
        return null;
    }
    if (preg_match('/^[A-Za-z0-9\-_]{20,256}$/', $verifier) !== 1) {
        return null;
    }
    if (preg_match('/^\d{10,12}$/', $expires) !== 1) {
        return null;
    }
    if (preg_match('/^[a-f0-9]{64}$/', $mac) !== 1) {
        return null;
    }
    return [
        'selector' => $selector,
        'verifier' => $verifier,
        'expires_at' => (int)$expires,
        'mac' => $mac,
    ];
}

function catn8_mfa_device_cookie_signature_ok(array $parsed, string $key, int $now): bool
{
    if ($key === '') {
        return false;
    }
    $expiresAt = (int)($parsed['expires_at'] ?? 0);
    if ($expiresAt <= $now) {
        return false;
    }
    $expected = catn8_mfa_device_mac(
        (string)$parsed['selector'],
        (string)$parsed['verifier'],
        $expiresAt,
        $key
    );
    return hash_equals($expected, (string)($parsed['mac'] ?? ''));
}

function catn8_mfa_email_html(string $code, string $username, string $purpose): string
{
    $safeUser = htmlspecialchars($username, ENT_QUOTES, 'UTF-8');
    $safeCode = htmlspecialchars($code, ENT_QUOTES, 'UTF-8');
    $reason = $purpose === 'step_up'
        ? 'connect a bank with Plaid'
        : 'sign in';
    return '<div style="font-family:Comic Neue,Trebuchet MS,sans-serif;background:#f7f9fc;padding:24px">'
        . '<div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #eadcff;border-radius:16px;padding:24px">'
        . '<p style="margin:0 0 8px;color:#9b59b6;font-weight:700">catn8.us</p>'
        . '<h1 style="margin:0 0 12px;color:#1a1630;font-size:22px">Two-factor verification</h1>'
        . '<p style="margin:0 0 12px;color:#121826">Use this code to ' . $reason . ' as <strong>' . $safeUser . '</strong>.</p>'
        . '<p style="margin:0 0 12px;font-size:32px;letter-spacing:6px;font-weight:700;color:#1a1630">' . $safeCode . '</p>'
        . '<p style="margin:0;color:#121826">The code expires in 10 minutes and works once. If you did not request it, you can ignore this email.</p>'
        . '</div></div>';
}

function catn8_mfa_allowlisted_purpose(string $purpose): ?string
{
    $purpose = strtolower(trim($purpose));
    if ($purpose === 'login' || $purpose === 'step_up') {
        return $purpose;
    }
    return null;
}
