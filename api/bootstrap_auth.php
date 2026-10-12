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
        $secure = false;
        if (function_exists('catn8_request_is_https')) {
            $secure = catn8_request_is_https()
                || (function_exists('catn8_is_local_request') && !catn8_is_local_request());
        } else {
            $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
        }
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
            'secure' => $secure,
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
 * Extract a presented admin API token from common agent headers/params.
 * Does not validate — callers compare with hash_equals against CATN8_ADMIN_TOKEN.
 */
function catn8_presented_admin_api_token(): string
{
    // 1. X-Api-Key (Accumul8r / agent convention)
    $apiKey = trim((string)($_SERVER['HTTP_X_API_KEY'] ?? ''));
    if ($apiKey === '' && function_exists('getallheaders')) {
        $headers = getallheaders();
        if (is_array($headers)) {
            foreach ($headers as $name => $value) {
                if (strtolower((string)$name) === 'x-api-key') {
                    $apiKey = trim((string)$value);
                    break;
                }
            }
        }
    }
    if ($apiKey !== '') {
        return $apiKey;
    }

    // 2. Authorization: Bearer <token>
    $authHeader = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (preg_match('/^\s*Bearer\s+(\S+)\s*$/i', $authHeader, $matches)) {
        $got = trim((string)($matches[1] ?? ''));
        if ($got !== '') {
            return $got;
        }
    }

    return '';
}

/**
 * Resolve the primary site-admin user id for API-token impersonation.
 */
function catn8_primary_admin_user_id(): ?int
{
    try {
        $row = Database::queryOne('SELECT id FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1');
        if ($row && (int)($row['id'] ?? 0) > 0) {
            return (int)$row['id'];
        }
    } catch (Throwable $e) {
        // fall through
    }
    return null;
}

/**
 * Session group/admin auth, or CATN8_ADMIN_TOKEN via X-Api-Key / Bearer.
 * Used by Accumul8 agent/bootstrap callers (Accumul8r).
 */
function catn8_require_group_or_admin_or_api_token(string $groupSlug): int
{
    catn8_session_start();

    $uid = catn8_auth_user_id();
    if ($uid !== null) {
        if (catn8_user_is_admin($uid)) {
            return $uid;
        }
        if (catn8_user_in_group($uid, $groupSlug)) {
            return $uid;
        }
        catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
    }

    $expected = trim((string)catn8_env('CATN8_ADMIN_TOKEN', ''));
    $got = catn8_presented_admin_api_token();
    if ($expected !== '' && $got !== '' && hash_equals($expected, $got)) {
        $adminId = catn8_primary_admin_user_id();
        if ($adminId !== null) {
            return $adminId;
        }
    }

    catn8_json_response(['success' => false, 'error' => 'Not authenticated'], 401);
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
 * Validate the admin token from X-Api-Key / Authorization: Bearer.
 * For backward compatibility, also accepts admin_token in JSON body
 * or query string.
 *
 * @return string The validated token (empty string if none matched).
 */
function catn8_admin_token_from_request(): string
{
    $expected = trim((string)catn8_env('CATN8_ADMIN_TOKEN', ''));
    if ($expected === '') {
        return '';
    }

    $headerToken = catn8_presented_admin_api_token();
    if ($headerToken !== '' && hash_equals($expected, $headerToken)) {
        return $headerToken;
    }

    // JSON body field (for POST endpoints)
    $bodyToken = '';
    $raw = file_get_contents('php://input');
    if (is_string($raw) && trim($raw) !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded) && isset($decoded['admin_token'])) {
            $bodyToken = trim((string)$decoded['admin_token']);
        }
    }
    if ($bodyToken !== '' && hash_equals($expected, $bodyToken)) {
        return $bodyToken;
    }

    // Query string (backward compat — least secure)
    $queryToken = trim((string)($_GET['admin_token'] ?? ''));
    if ($queryToken !== '' && hash_equals($expected, $queryToken)) {
        return $queryToken;
    }

    return '';
}

/**
 * Require a valid admin token via X-Api-Key / Authorization: Bearer (preferred)
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
