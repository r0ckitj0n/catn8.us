<?php
if ($provider === 'google_ai_studio') {
    $apiKey = secret_get(catn8_settings_ai_secret_key($provider, 'api_key'));
    if (!is_string($apiKey) || trim($apiKey) === '') {
        $fail(500, 'Missing AI API key (google_ai_studio)');
    }
    if ($model === '') {
        $fail(500, 'Missing Google AI Studio model in AI config');
    }

    $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent';
    $res = catn8_http_json_with_status('POST', $url, ['x-goog-api-key' => trim((string)$apiKey)], [
        'contents' => [
            ['role' => 'user', 'parts' => [['text' => $userPrompt]]],
        ],
        'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
        'generationConfig' => [
            'temperature' => 0.0,
        ],
    ]);

    $status = (int)($res['status'] ?? 0);
    $json = $res['json'] ?? null;
    if ($status < 200 || $status >= 300) {
        $msg = '';
        if (is_array($json) && isset($json['error']) && is_array($json['error']) && isset($json['error']['message']) && is_string($json['error']['message'])) {
            $msg = (string)$json['error']['message'];
        }
        $fail(500, 'HTTP ' . $status . ($msg !== '' ? ': ' . $msg : ''), ['http_status' => $status]);
    }

    $text = '';
    if (is_array($json)) {
        $candidates = $json['candidates'] ?? null;
        if (is_array($candidates) && isset($candidates[0]) && is_array($candidates[0])) {
            $candContent = $candidates[0]['content'] ?? null;
            $candParts = is_array($candContent) ? ($candContent['parts'] ?? null) : null;
            if (is_array($candParts) && isset($candParts[0]) && is_array($candParts[0]) && isset($candParts[0]['text']) && is_string($candParts[0]['text'])) {
                $text = (string)$candParts[0]['text'];
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
