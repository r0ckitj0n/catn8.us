<?php

declare(strict_types=1);

function catn8_http_json_with_status(string $method, string $url, array $headers, $body, int $connectTimeoutSeconds = 10, int $timeoutSeconds = 30): array
{
    $method = strtoupper(trim($method));
    if ($method === '') {
        throw new RuntimeException('HTTP method is empty');
    }
    $url = trim($url);
    if ($url === '') {
        throw new RuntimeException('HTTP URL is empty');
    }

    $payload = null;
    if ($body !== null) {
        $payload = json_encode($body, JSON_UNESCAPED_SLASHES);
        if (!is_string($payload)) {
            throw new RuntimeException('Failed to encode JSON payload');
        }
    }

    $ch = curl_init();
    if ($ch === false) {
        throw new RuntimeException('Failed to init curl');
    }

    $flatHeaders = ['Accept: application/json'];
    foreach ($headers as $k => $v) {
        $key = trim((string)$k);
        $val = trim((string)$v);
        if ($key === '') continue;
        $flatHeaders[] = $key . ': ' . $val;
    }
    if ($payload !== null) {
        $flatHeaders[] = 'Content-Type: application/json';
    }

    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $flatHeaders);
    if ($payload !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    }
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $connectTimeoutSeconds);
    curl_setopt($ch, CURLOPT_TIMEOUT, $timeoutSeconds);

    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if (!is_string($raw)) {
        throw new RuntimeException('HTTP request failed: ' . ($err !== '' ? $err : 'unknown error'));
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        $decoded = null;
    }

    return [
        'status' => $status,
        'json' => $decoded,
        'raw' => $raw,
    ];
}

function catn8_json_response(array $payload, int $status = 200): void
{
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=UTF-8');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: no-store');
    }
    echo json_encode($payload);
    exit;
}

function catn8_read_json_body(): array
{
    if (catn8_is_mutation_method((string)($_SERVER['REQUEST_METHOD'] ?? ''))) {
        catn8_require_csrf();
    }
    $raw = file_get_contents('php://input');

    $rawStr = is_string($raw) ? $raw : '';
    $GLOBALS['catn8_json_body_raw_len'] = strlen($rawStr);
    $GLOBALS['catn8_json_body_raw_prefix'] = substr($rawStr, 0, 500);

    if (!is_string($raw) || trim($raw) === '') {
        $GLOBALS['catn8_json_body_json_error'] = 0;
        $GLOBALS['catn8_json_body_json_error_msg'] = '';
        return [];
    }

    $data = json_decode($raw, true);
    $GLOBALS['catn8_json_body_json_error'] = json_last_error();
    $GLOBALS['catn8_json_body_json_error_msg'] = function_exists('json_last_error_msg') ? json_last_error_msg() : '';
    return is_array($data) ? $data : [];
}

function catn8_require_method(string $method): void
{
    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? '') !== strtoupper($method)) {
        catn8_json_response(['success' => false, 'error' => 'Method not allowed'], 405);
    }
    if (catn8_is_mutation_method($method)) {
        catn8_require_csrf();
    }
}

function catn8_is_mutation_method(string $method): bool
{
    $m = strtoupper(trim($method));
    return $m !== 'GET' && $m !== 'HEAD' && $m !== 'OPTIONS';
}
