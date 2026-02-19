<?php

declare(strict_types=1);

function catn8_diagnostics_log_event(string $eventKey, bool $ok, ?int $httpStatus, string $message, array $meta = []): void
{
    $eventKey = trim($eventKey);
    if ($eventKey === '') {
        $eventKey = 'unknown';
    }

    $endpoint = trim((string)($_SERVER['SCRIPT_NAME'] ?? ''));
    if ($endpoint === '') {
        $endpoint = trim((string)($_SERVER['REQUEST_URI'] ?? ''));
    }

    $uid = null;
    if (function_exists('catn8_auth_user_id')) {
        $uid = catn8_auth_user_id();
        if (!is_int($uid) || $uid <= 0) {
            $uid = null;
        }
    }

    $ip = trim((string)($_SERVER['REMOTE_ADDR'] ?? ''));
    $ua = trim((string)($_SERVER['HTTP_USER_AGENT'] ?? ''));

    if (function_exists('catn8_ai_sanitize_user_text')) {
        $message = catn8_ai_sanitize_user_text($message, 512);
        $endpoint = catn8_ai_sanitize_user_text($endpoint, 191);
        $eventKey = catn8_ai_sanitize_user_text($eventKey, 191);
        $ip = catn8_ai_sanitize_user_text($ip, 64);
        $ua = catn8_ai_sanitize_user_text($ua, 255);
    } else {
        $message = substr(trim((string)$message), 0, 512);
        $endpoint = substr(trim((string)$endpoint), 0, 191);
        $eventKey = substr(trim((string)$eventKey), 0, 191);
        $ip = substr(trim((string)$ip), 0, 64);
        $ua = substr(trim((string)$ua), 0, 255);
    }

    $metaJson = null;
    if (!empty($meta)) {
        $encoded = json_encode($meta, JSON_UNESCAPED_SLASHES);
        if (is_string($encoded) && $encoded !== '') {
            if (strlen($encoded) > 8000) {
                $encoded = substr($encoded, 0, 8000);
            }
            $metaJson = $encoded;
        }
    }

    try {
        Database::execute(
            'INSERT INTO catn8_diagnostics_events (user_id, endpoint, event_key, ok, http_status, message, meta_json, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $uid,
                $endpoint,
                $eventKey,
                $ok ? 1 : 0,
                $httpStatus,
                $message,
                $metaJson,
                $ip,
                $ua,
            ]
        );
    } catch (Throwable $e) {
        if (function_exists('catn8_log_error')) {
            catn8_log_error('Diagnostics log insert failed', ['event_key' => $eventKey, 'error' => $e->getMessage()]);
            return;
        }
        error_log('Diagnostics log insert failed: ' . $e->getMessage());
    }
}
