<?php
if ($provider === 'together_ai' || $provider === 'fireworks_ai' || $provider === 'huggingface') {
    $apiKey = secret_get(catn8_settings_ai_secret_key($provider, 'api_key'));
    if (!is_string($apiKey) || trim($apiKey) === '') {
        $fail(500, 'Missing AI API key (' . $provider . ')');
    }
    if ($baseUrl === '') {
        $fail(500, 'Missing base_url in AI config for provider ' . $provider);
    }

    $root = rtrim(catn8_validate_external_base_url($baseUrl), '/');
    $url = preg_match('#/v1$#', $root) ? ($root . '/chat/completions') : ($root . '/v1/chat/completions');

    $res = catn8_http_json_with_status('POST', $url, ['Authorization' => 'Bearer ' . trim((string)$apiKey)], [
        'model' => $model,
        'messages' => [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $userPrompt],
        ],
        'temperature' => 0.0,
        'max_tokens' => 16,
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
        if ($msg === '' && is_array($json) && isset($json['message']) && is_string($json['message'])) {
            $msg = (string)$json['message'];
        }
        $fail(500, 'HTTP ' . $status . ($msg !== '' ? ': ' . $msg : ''), ['http_status' => $status]);
    }

    $text = '';
    if (is_array($json)) {
        $choices = $json['choices'] ?? null;
        if (is_array($choices) && isset($choices[0]) && is_array($choices[0])) {
            $msg = $choices[0]['message'] ?? null;
            if (is_array($msg) && isset($msg['content']) && is_string($msg['content'])) {
                $text = (string)$msg['content'];
            }
        }
    }

    catn8_json_response([
        'success' => true,
        'ai' => $aiMeta,
        'http_status' => $status,
        'sample' => mb_substr(trim($text), 0, 80),
    ]);
}
