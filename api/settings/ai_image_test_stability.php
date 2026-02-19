<?php
if ($provider === 'stability_ai') {
    $apiKey = secret_get(catn8_settings_ai_image_secret_key($provider, 'api_key'));
    if (!is_string($apiKey) || trim($apiKey) === '') {
        $fail(500, 'Missing AI image API key (stability_ai)');
    }

    $variant = strtolower(trim($model));
    $endpoint = 'core';
    if ($variant === 'stable-image-ultra') $endpoint = 'ultra';
    if ($variant === 'stable-image-core') $endpoint = 'core';

    $url = 'https://api.stability.ai/v2beta/stable-image/generate/' . $endpoint;

    $ch = curl_init();
    if ($ch === false) {
        throw new RuntimeException('Failed to init curl');
    }

    $fields = [
        'prompt' => $prompt,
        'output_format' => 'png',
        'aspect_ratio' => '1:1',
    ];

    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . trim((string)$apiKey),
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $fields);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);

    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if (!is_string($raw) || $raw === '') {
        throw new RuntimeException('HTTP request failed: ' . ($err !== '' ? $err : 'unknown error'));
    }
    if ($status < 200 || $status >= 300) {
        $fail(500, 'HTTP ' . $status . ': ' . substr($raw, 0, 200), ['http_status' => $status]);
    }

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    $sig = substr($raw, 0, 8);
    if ($sig !== "\x89PNG\r\n\x1a\n") {
        $fail(500, 'Stability returned non-PNG response', ['http_status' => $status]);
    }

    catn8_json_response([
        'success' => true,
        'ai_image' => $meta,
        'http_status' => $status,
        'sample' => 'OK',
    ]);
}
