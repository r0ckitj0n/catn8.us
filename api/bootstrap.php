<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../includes/secret_store.php';

$autoload = dirname(__DIR__) . '/vendor/autoload.php';
if (is_file($autoload)) {
    require_once $autoload;
}

require_once __DIR__ . '/bootstrap_handlers.php';
require_once __DIR__ . '/bootstrap_http.php';
require_once __DIR__ . '/bootstrap_auth.php';
require_once __DIR__ . '/bootstrap_db.php';

function catn8_user_is_admin(?int $uid): bool
{
    if ($uid === null) return false;
    catn8_users_table_ensure();
    $row = Database::queryOne('SELECT is_admin FROM users WHERE id = ?', [$uid]);
    if ($row && (int)($row['is_admin'] ?? 0) === 1) return true;
    return catn8_user_in_group($uid, 'administrators');
}

function catn8_random_token(): string
{
    return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
}

function catn8_token_hash(string $token): string
{
    return hash('sha256', $token, true);
}

function catn8_secret_key(string $suffix): string
{
    return 'catn8.' . $suffix;
}

function catn8_setting_bool(string $suffix, bool $default = false): bool
{
    $raw = secret_get(catn8_secret_key($suffix));
    if ($raw === null) return $default;
    $v = strtolower(trim((string)$raw));
    if ($v === '1' || $v === 'true' || $v === 'yes' || $v === 'on') return true;
    if ($v === '0' || $v === 'false' || $v === 'no' || $v === 'off') return false;
    return $default;
}

function catn8_setting_set_bool(string $suffix, bool $value): bool
{
    return secret_set(catn8_secret_key($suffix), $value ? '1' : '0');
}

function catn8_ai_sanitize_user_text(string $text, int $maxLen = 2000): string
{
    $raw = (string)$text;
    $raw = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', ' ', $raw);
    if (!is_string($raw)) {
        $raw = '';
    }
    $raw = trim(preg_replace('/\s+/', ' ', $raw));
    if ($raw === '') {
        return '';
    }
    if ($maxLen > 0 && strlen($raw) > $maxLen) {
        $raw = substr($raw, 0, $maxLen);
    }
    return $raw;
}

function catn8_mystery_get_active_run_settings(int $caseId, int $viewerId): array
{
    $cid = (int)$caseId;
    $uid = (int)$viewerId;
    if ($cid <= 0 || $uid <= 0) {
        return [];
    }
    $runRow = Database::queryOne(
        "SELECT run_settings_json
         FROM mystery_run_sessions
         WHERE case_id = ? AND owner_user_id = ? AND status = 'active'
         ORDER BY updated_at DESC, id DESC
         LIMIT 1",
        [$cid, $uid]
    );
    $runSettings = json_decode((string)($runRow['run_settings_json'] ?? '{}'), true);
    return is_array($runSettings) ? $runSettings : [];
}

function catn8_mystery_is_game_won(int $caseId, int $viewerId): bool
{
    $settings = catn8_mystery_get_active_run_settings($caseId, $viewerId);
    $v = $settings['game_won'] ?? null;
    return $v === true || $v === 1 || $v === '1' || $v === 'true';
}

function catn8_mystery_require_game_won(int $caseId, int $viewerId): void
{
    if (!catn8_mystery_is_game_won($caseId, $viewerId)) {
        catn8_json_response(['success' => false, 'error' => 'Game is not won'], 403);
    }
}

function catn8_validate_external_base_url(string $url): string
{
    $url = trim($url);
    if ($url === '') {
        throw new RuntimeException('Base URL is empty');
    }

    $parts = parse_url($url);
    if (!is_array($parts)) {
        throw new RuntimeException('Base URL is not a valid URL');
    }

    $scheme = strtolower((string)($parts['scheme'] ?? ''));
    if ($scheme !== 'https' && $scheme !== 'http') {
        throw new RuntimeException('Base URL must be http or https');
    }

    if (isset($parts['user']) || isset($parts['pass'])) {
        throw new RuntimeException('Base URL must not include credentials');
    }

    $host = strtolower((string)($parts['host'] ?? ''));
    if ($host === '') {
        throw new RuntimeException('Base URL missing host');
    }

    $allowLocalHosts = catn8_is_local_request() || PHP_SAPI === 'cli';
    if (!$allowLocalHosts && ($host === 'localhost' || $host === '127.0.0.1' || $host === '0.0.0.0' || $host === '::1')) {
        throw new RuntimeException('Base URL host is not allowed');
    }

    if (filter_var($host, FILTER_VALIDATE_IP)) {
        $ipLong = ip2long($host);
        if ($ipLong !== false) {
            $private = (
                ($ipLong >= ip2long('10.0.0.0') && $ipLong <= ip2long('10.255.255.255')) ||
                ($ipLong >= ip2long('172.16.0.0') && $ipLong <= ip2long('172.31.255.255')) ||
                ($ipLong >= ip2long('192.168.0.0') && $ipLong <= ip2long('192.168.255.255')) ||
                ($ipLong >= ip2long('127.0.0.0') && $ipLong <= ip2long('127.255.255.255')) ||
                ($ipLong >= ip2long('169.254.0.0') && $ipLong <= ip2long('169.254.255.255'))
            );
            if ($private && !$allowLocalHosts) {
                throw new RuntimeException('Base URL IP is not allowed');
            }
        }
    }

    return $url;
}

function catn8_rate_limit_require(string $key, int $maxRequests, int $windowSeconds): void
{
    $key = trim($key);
    if ($key === '') {
        throw new RuntimeException('Rate limit key is empty');
    }
    if ($maxRequests <= 0) {
        throw new RuntimeException('Rate limit maxRequests must be > 0');
    }
    if ($windowSeconds <= 0) {
        throw new RuntimeException('Rate limit windowSeconds must be > 0');
    }

    catn8_session_start();

    if (!isset($_SESSION['catn8_rate_limits']) || !is_array($_SESSION['catn8_rate_limits'])) {
        $_SESSION['catn8_rate_limits'] = [];
    }

    $now = time();
    $bucket = $_SESSION['catn8_rate_limits'][$key] ?? null;
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
    $_SESSION['catn8_rate_limits'][$key] = $bucket;

    if ($count > $maxRequests) {
        $retryAfter = $windowSeconds - max(0, $now - $start);
        if ($retryAfter < 1) $retryAfter = 1;
        catn8_json_response([
            'success' => false,
            'error' => 'Rate limit exceeded',
            'retry_after_seconds' => $retryAfter,
        ], 429);
    }
}
