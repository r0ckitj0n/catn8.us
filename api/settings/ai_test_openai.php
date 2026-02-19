<?php
if ($provider === 'openai') {
    $apiKey = secret_get(catn8_settings_ai_secret_key($provider, 'api_key'));
    if (!is_string($apiKey) || trim($apiKey) === '') {
        $fail(500, 'Missing AI API key (openai)');
    }

    $factory = OpenAI::factory()->withApiKey(trim((string)$apiKey));
    if ($baseUrl !== '') {
        $factory = $factory->withBaseUri(catn8_validate_external_base_url($baseUrl));
    }
    $client = $factory->make();

    $resp = $client->chat()->create([
        'model' => ($model !== '' ? $model : 'gpt-4o-mini'),
        'messages' => [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $userPrompt],
        ],
        'temperature' => 0.0,
        'max_tokens' => 16,
    ]);

    $text = '';
    if (isset($resp->choices[0]->message->content)) {
        $text = (string)$resp->choices[0]->message->content;
    }

    catn8_json_response([
        'success' => true,
        'ai' => $aiMeta,
        'sample' => mb_substr(trim($text), 0, 80),
    ]);
}
