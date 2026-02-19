<?php
if ($provider === 'huggingface') {
    $apiKey = secret_get(catn8_settings_ai_image_secret_key($provider, 'api_key'));
    if (!is_string($apiKey) || trim($apiKey) === '') {
        $fail(500, 'Missing AI image API token (huggingface)');
    }
    if ($model === '') {
        $fail(500, 'Missing Hugging Face model in AI Image config');
    }

    $url = 'https://api-inference.huggingface.co/models/' . rawurlencode($model);

    $ch = curl_init();
    if ($ch === false) {
        throw new RuntimeException('Failed to init curl');
    }

    $payload = json_encode(['inputs' => $prompt], JSON_UNESCAPED_SLASHES);
    if (!is_string($payload)) {
        throw new RuntimeException('Failed to encode JSON payload');
    }

    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . trim((string)$apiKey),
        'Content-Type: application/json',
        'Accept: */*',
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_TIMEOUT, 90);

    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $contentType = (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);

    if (!is_string($raw) || $raw === '') {
        throw new RuntimeException('HTTP request failed: ' . ($err !== '' ? $err : 'unknown error'));
    }
    if ($status < 200 || $status >= 300) {
        $fail(500, 'HTTP ' . $status . ': ' . substr($raw, 0, 200), ['http_status' => $status]);
    }

    if (stripos($contentType, 'image/') !== 0) {
        $fail(500, 'Hugging Face returned non-image response', ['http_status' => $status]);
    }

    catn8_json_response([
        'success' => true,
        'ai_image' => $meta,
        'http_status' => $status,
        'sample' => 'OK',
    ]);
}
