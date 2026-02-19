<?php

declare(strict_types=1);

function catn8_csrf_token(): string
{
    catn8_session_start();
    $t = $_SESSION['catn8_csrf'] ?? null;
    if (is_string($t) && trim($t) !== '') {
        return $t;
    }
    $t = catn8_random_token();
    $_SESSION['catn8_csrf'] = $t;
    return $t;
}

function catn8_require_csrf(): void
{
    catn8_session_start();
    $expected = catn8_csrf_token();
    $got = (string)($_SERVER['HTTP_X_CATN8_CSRF'] ?? '');
    if ($got === '' || !hash_equals($expected, $got)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid CSRF token'], 403);
    }
}

function catn8_session_start(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
            'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
        ]);
        session_start();
    }
}

function catn8_auth_user_id(): ?int
{
    catn8_session_start();
    $id = $_SESSION['catn8_user_id'] ?? null;
    return is_int($id) ? $id : null;
}

function catn8_require_admin(): void
{
    catn8_session_start();

    $uid = catn8_auth_user_id();
    if ($uid === null) {
        catn8_json_response(['success' => false, 'error' => 'Not authenticated'], 401);
    }

    if (!catn8_user_is_admin($uid)) {
        catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
    }
}

function catn8_require_group_or_admin(string $groupSlug): int
{
    catn8_session_start();

    $uid = catn8_auth_user_id();
    if ($uid === null) {
        catn8_json_response(['success' => false, 'error' => 'Not authenticated'], 401);
    }

    if (catn8_user_is_admin($uid)) {
        return $uid;
    }

    if (!catn8_user_in_group($uid, $groupSlug)) {
        catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
    }

    return $uid;
}
