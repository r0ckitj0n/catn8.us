<?php
if ($provider === 'openai') {
    $apiKey = secret_get(catn8_settings_ai_secret_key($provider, 'api_key'));
    if (!is_string($apiKey) || trim($apiKey) === '') {
        $fail(500, 'Missing AI API key (openai)');
    }

    $root = $baseUrl !== '' ? rtrim(catn8_validate_external_base_url($baseUrl), '/') : 'https://api.openai.com';
    $headers = ['Authorization' => 'Bearer ' . trim((string)$apiKey)];

    $parseResponseText = static function (?array $json): string {
        if (!is_array($json)) {
            return '';
        }

        foreach (($json['output'] ?? []) as $item) {
            if (!is_array($item)) {
                continue;
            }
            foreach (($item['content'] ?? []) as $content) {
                if (!is_array($content)) {
                    continue;
                }
                $text = trim((string)($content['text'] ?? ''));
                if ($text !== '') {
                    return $text;
                }
            }
        }

        return '';
    };

    $parseErrorMessage = static function (?array $json): string {
        if (!is_array($json)) {
            return '';
        }
        $error = $json['error'] ?? null;
        if (is_string($error) && trim($error) !== '') {
            return trim($error);
        }
        if (is_array($error) && isset($error['message']) && is_string($error['message']) && trim($error['message']) !== '') {
            return trim((string)$error['message']);
        }
        return '';
    };

    $responsesRes = catn8_http_json_with_status('POST', $root . '/v1/responses', $headers, [
        'model' => ($model !== '' ? $model : 'gpt-4o-mini'),
        'instructions' => $systemPrompt,
        'input' => $userPrompt,
        'temperature' => 0.0,
        'max_output_tokens' => 16,
    ], 10, 45);

    $responsesStatus = (int)($responsesRes['status'] ?? 0);
    $responsesJson = is_array($responsesRes['json'] ?? null) ? $responsesRes['json'] : null;
    if ($responsesStatus >= 200 && $responsesStatus < 300) {
        $text = $parseResponseText($responsesJson);
        catn8_json_response([
            'success' => true,
            'ai' => $aiMeta,
            'sample' => mb_substr(trim($text), 0, 80),
        ]);
    }

    $responsesError = $parseErrorMessage($responsesJson);
    $shouldFallbackToChat = $baseUrl !== '' && ($responsesStatus === 404 || $responsesStatus === 405 || $responsesStatus === 501);
    if (!$shouldFallbackToChat) {
        $fail(500, 'HTTP ' . $responsesStatus . ($responsesError !== '' ? ': ' . $responsesError : ''), ['http_status' => $responsesStatus]);
    }

    $chatRes = catn8_http_json_with_status('POST', $root . '/v1/chat/completions', $headers, [
        'model' => ($model !== '' ? $model : 'gpt-4o-mini'),
        'messages' => [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $userPrompt],
        ],
        'temperature' => 0.0,
        'max_tokens' => 16,
    ], 10, 45);

    $chatStatus = (int)($chatRes['status'] ?? 0);
    $chatJson = is_array($chatRes['json'] ?? null) ? $chatRes['json'] : null;
    if ($chatStatus < 200 || $chatStatus >= 300) {
        $chatError = $parseErrorMessage($chatJson);
        $fail(500, 'HTTP ' . $chatStatus . ($chatError !== '' ? ': ' . $chatError : ''), ['http_status' => $chatStatus]);
    }

    $text = '';
    if (is_array($chatJson)) {
        $text = trim((string)($chatJson['choices'][0]['message']['content'] ?? ''));
    }

    catn8_json_response([
        'success' => true,
        'ai' => $aiMeta,
        'sample' => mb_substr(trim($text), 0, 80),
    ]);
}
