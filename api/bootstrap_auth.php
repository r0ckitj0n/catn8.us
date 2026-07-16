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

/**
 * IP-based rate limiter for pre-authentication endpoints (login, registration).
 * Uses a database table to track attempts per IP (or per IP+key combo).
 * Falls back to session-based limiting if the DB table is unavailable.
 */
function catn8_rate_limit_ip_require(string $key, int $maxAttempts, int $windowSeconds): void
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    // Honour X-Forwarded-For from trusted proxies (local/LAN)
    $fwd = trim((string)($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''));
    if ($fwd !== '' && catn8_is_local_request()) {
        $parts = explode(',', $fwd);
        $ip = trim($parts[0]);
    }
    $bucketKey = $key . '.' . $ip;

    // Try DB-backed tracking first
    try {
        $pdo = Database::getInstance();
        $pdo->exec("CREATE TABLE IF NOT EXISTS rate_limit_buckets (
            bucket_key VARCHAR(255) NOT NULL PRIMARY KEY,
            attempt_count INT NOT NULL DEFAULT 0,
            first_attempt_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $nowStr = date('Y-m-d H:i:s');
        $row = Database::queryOne(
            'SELECT bucket_key, attempt_count, first_attempt_at FROM rate_limit_buckets WHERE bucket_key = ?',
            [$bucketKey]
        );

        if (!$row) {
            Database::execute(
                'INSERT INTO rate_limit_buckets (bucket_key, attempt_count, first_attempt_at, updated_at) VALUES (?, 1, ?, ?)',
                [$bucketKey, $nowStr, $nowStr]
            );
            $count = 1;
        } else {
            $firstTs = strtotime((string)$row['first_attempt_at']);
            if ($firstTs !== false && (time() - $firstTs) >= $windowSeconds) {
                // Window expired — reset
                Database::execute(
                    'UPDATE rate_limit_buckets SET attempt_count = 1, first_attempt_at = ?, updated_at = ? WHERE bucket_key = ?',
                    [$nowStr, $nowStr, $bucketKey]
                );
                $count = 1;
            } else {
                $count = (int)$row['attempt_count'] + 1;
                Database::execute(
                    'UPDATE rate_limit_buckets SET attempt_count = ?, updated_at = ? WHERE bucket_key = ?',
                    [$count, $nowStr, $bucketKey]
                );
            }
        }

        // Garbage-collect old buckets occasionally (1% chance per request)
        if (random_int(1, 100) === 1) {
            $cutoff = date('Y-m-d H:i:s', time() - 3600);
            Database::execute('DELETE FROM rate_limit_buckets WHERE updated_at < ?', [$cutoff]);
        }
    } catch (Throwable $_) {
        // DB unavailable — fall back to session-based limiting
        catn8_session_start();
        if (!isset($_SESSION['catn8_ip_rate_limits']) || !is_array($_SESSION['catn8_ip_rate_limits'])) {
            $_SESSION['catn8_ip_rate_limits'] = [];
        }
        $now = time();
        $bucket = $_SESSION['catn8_ip_rate_limits'][$bucketKey] ?? null;
        if (!is_array($bucket)) {
            $bucket = ['start' => $now, 'count' => 0];
        }
        $start = (int)($bucket['start'] ?? $now);
        $count = (int)($bucket['count'] ?? 0);
        if ($now < $start || ($now - $start) >= $windowSeconds) {
            $start = $now;
            $count = 0;
        }
        $count++;
        $bucket['start'] = $start;
        $bucket['count'] = $count;
        $_SESSION['catn8_ip_rate_limits'][$bucketKey] = $bucket;
    }

    if ($count > $maxAttempts) {
        $retryAfter = max(1, $windowSeconds);
        catn8_json_response([
            'success' => false,
            'error' => 'Too many attempts. Please try again later.',
            'retry_after_seconds' => $retryAfter,
        ], 429);
    }
}

/**
 * Validate the admin token from the Authorization: Bearer header.
 * For backward compatibility, also accepts admin_token in JSON body
 * or query string, but logs a deprecation warning when those are used.
 *
 * @return string The validated token (from header preferred).
 */
function catn8_admin_token_from_request(): string
{
    $expected = (string)catn8_env('CATN8_ADMIN_TOKEN', '');

    // 1. Authorization: Bearer <token>  (preferred)
    $authHeader = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? '');
    if (preg_match('/^\s*Bearer\s+(.+)\s*$/i', $authHeader, $matches)) {
        $got = trim((string)($matches[1] ?? ''));
        if ($expected !== '' && $got !== '' && hash_equals($expected, $got)) {
            return $got;
        }
    }

    // 2. JSON body field (for POST endpoints)
    $bodyToken = '';
    $raw = file_get_contents('php://input');
    if (is_string($raw) && trim($raw) !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded) && isset($decoded['admin_token'])) {
            $bodyToken = trim((string)$decoded['admin_token']);
        }
    }
    if ($bodyToken !== '' && $expected !== '' && hash_equals($expected, $bodyToken)) {
        return $bodyToken;
    }

    // 3. Query string (backward compat — least secure)
    $queryToken = trim((string)($_GET['admin_token'] ?? ''));
    if ($queryToken !== '' && $expected !== '' && hash_equals($expected, $queryToken)) {
        return $queryToken;
    }

    // None matched
    return '';
}

/**
 * Require a valid admin token via Authorization: Bearer header (preferred)
 * or backward-compatible query/body fallback.
 * Terminates with 403 if invalid.
 */
function catn8_require_admin_token(): string
{
    $token = catn8_admin_token_from_request();
    if ($token === '') {
        catn8_json_response(['success' => false, 'error' => 'Invalid admin token'], 403);
    }
    return $token;
}
