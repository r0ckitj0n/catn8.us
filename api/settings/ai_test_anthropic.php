<?php
if ($provider === 'anthropic') {
    $apiKey = secret_get(catn8_settings_ai_secret_key($provider, 'api_key'));
    if (!is_string($apiKey) || trim($apiKey) === '') {
        $fail(500, 'Missing AI API key (anthropic)');
    }
    if ($model === '') {
        $fail(500, 'Missing Anthropic model in AI config');
    }

    $res = catn8_http_json_with_status('POST', 'https://api.anthropic.com/v1/messages', [
        'x-api-key' => trim((string)$apiKey),
        'anthropic-version' => '2023-06-01',
        'Content-Type' => 'application/json',
    ], [
        'model' => $model,
        'max_tokens' => 16,
        'temperature' => 0.0,
        'system' => $systemPrompt,
        'messages' => [
            ['role' => 'user', 'content' => $userPrompt],
        ],
    ]);

    $status = (int)($res['status'] ?? 0);
    $json = $res['json'] ?? null;
    if ($status < 200 || $status >= 300) {
        $msg = '';
        if (is_array($json) && isset($json['error'])) {
            if (is_string($json['error'])) {
                $msg = $json['error'];
            } elseif (is_array($json['error']) && isset($json['error']['message']) && is_string($json['error']['message'])) {
                $msg = (string)$json['error']['message'];
            }
        }
        $fail(500, 'HTTP ' . $status . ($msg !== '' ? ': ' . $msg : ''), ['http_status' => $status]);
    }

    $text = '';
    if (is_array($json)) {
        $parts = $json['content'] ?? null;
        if (is_array($parts) && isset($parts[0]) && is_array($parts[0]) && isset($parts[0]['text']) && is_string($parts[0]['text'])) {
            $text = (string)$parts[0]['text'];
        }
    }

    catn8_json_response([
        'success' => true,
        'ai' => $aiMeta,
        'http_status' => $status,
        'sample' => mb_substr(trim($text), 0, 80),
    ]);
}
