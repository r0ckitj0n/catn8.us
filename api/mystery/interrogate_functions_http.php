<?php

declare(strict_types=1);

/**
 * Performs a JSON HTTP request.
 */
function catn8_http_json(string $method, string $url, array $headers, array $body): array
{
    $method = strtoupper(trim($method));
    if ($method === '') {
        throw new RuntimeException('HTTP method is empty');
    }
    $url = trim($url);
    if ($url === '') {
        throw new RuntimeException('HTTP URL is empty');
    }

    $payload = json_encode($body, JSON_UNESCAPED_SLASHES);
    if (!is_string($payload)) {
        throw new RuntimeException('Failed to encode JSON payload');
    }

    $ch = curl_init();
    if ($ch === false) {
        throw new RuntimeException('Failed to init curl');
    }

    $flatHeaders = ['Accept: application/json', 'Content-Type: application/json'];
    foreach ($headers as $k => $v) {
        $key = trim((string)$k);
        $val = trim((string)$v);
        if ($key === '') continue;
        $flatHeaders[] = $key . ': ' . $val;
    }

    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $flatHeaders);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);

    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if (!is_string($raw)) {
        throw new RuntimeException('HTTP request failed: ' . ($err !== '' ? $err : 'unknown error'));
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('HTTP ' . $code . ' returned non-JSON response');
    }
    if ($code < 200 || $code >= 300) {
        $msg = '';
        if (isset($decoded['error'])) {
            if (is_string($decoded['error'])) $msg = $decoded['error'];
            if (is_array($decoded['error']) && isset($decoded['error']['message']) && is_string($decoded['error']['message'])) {
                $msg = $decoded['error']['message'];
            }
        }
        if ($msg === '' && isset($decoded['message']) && is_string($decoded['message'])) {
            $msg = $decoded['message'];
        }
        throw new RuntimeException('HTTP ' . $code . ' error' . ($msg !== '' ? ': ' . $msg : ''));
    }
    return $decoded;
}
