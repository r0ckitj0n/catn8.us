<?php
/**
 * interrogate_functions_ai.php - AI generation for interrogation
 * VERSION: 2025-12-31-0510-FINAL
 */
declare(strict_types=1);

require_once __DIR__ . '/admin_functions.php';

/**
 * Generates an answer from an AI suspect.
 */
function catn8_interrogate_generate_answer(array $config, string $systemPrompt, string $userPrompt): array {
    $provider = strtolower(trim((string)($config['provider'] ?? 'openai')));
    $model = trim((string)($config['model'] ?? ''));
    $baseUrl = trim((string)($config['base_url'] ?? ''));
    $location = trim((string)($config['location'] ?? ''));
    $providerConfig = $config['provider_config'] ?? [];
    $temperature = (float)($config['temperature'] ?? 0.2);

    $answerText = '';
    
    if ($provider === 'google_vertex_ai') {
        $key = catn8_mystery_ai_secret_key($provider, 'service_account_json');
        $saJson = secret_get($key);
        
        // Fallback to image-specific secret if generic one is missing
        if (!$saJson) {
            $saJson = secret_get(catn8_secret_key('ai_image.secret.' . $provider . '.service_account_json'));
        }

        if (!$saJson) {
            throw new RuntimeException("Missing service account JSON (Checked: $key)");
        }
        $sa = json_decode((string)$saJson, true);
        $projectId = trim((string)($sa['project_id'] ?? ''));
        
        $answerText = catn8_vertex_ai_gemini_generate_text([
            'service_account_json' => $saJson,
            'project_id' => $projectId,
            'location' => $location ?: 'us-central1',
            'model' => $model,
            'system_prompt' => $systemPrompt,
            'user_prompt' => $userPrompt,
            'temperature' => $temperature,
            'max_output_tokens' => 256,
        ]);
    } elseif ($provider === 'openai') {
        $apiKey = (string)secret_get(catn8_mystery_ai_secret_key($provider, 'api_key'));
        if ($apiKey === '') throw new RuntimeException('Missing API key');

        $factory = OpenAI::factory()->withApiKey(trim($apiKey));
        if ($baseUrl !== '') $factory = $factory->withBaseUri(catn8_validate_external_base_url($baseUrl));
        $client = $factory->make();

        $resp = $client->chat()->create([
            'model' => $model ?: 'gpt-4o-mini',
            'messages' => [['role' => 'system', 'content' => $systemPrompt], ['role' => 'user', 'content' => $userPrompt]],
            'temperature' => $temperature,
        ]);
        $answerText = (string)($resp->choices[0]->message->content ?? '');
    } elseif (in_array($provider, ['together_ai', 'fireworks_ai', 'huggingface'])) {
        $apiKey = (string)secret_get(catn8_mystery_ai_secret_key($provider, 'api_key'));
        if ($apiKey === '') throw new RuntimeException('Missing API key');
        if ($baseUrl === '') throw new RuntimeException('Missing base_url');

        $root = rtrim(catn8_validate_external_base_url($baseUrl), '/');
        $url = preg_match('#/v1$#', $root) ? ($root . '/chat/completions') : ($root . '/v1/chat/completions');

        $decoded = catn8_http_json('POST', $url, ['Authorization' => 'Bearer ' . trim($apiKey)], [
            'model' => $model,
            'messages' => [['role' => 'system', 'content' => $systemPrompt], ['role' => 'user', 'content' => $userPrompt]],
            'temperature' => $temperature,
            'max_tokens' => 512,
        ]);
        $answerText = (string)($decoded['choices'][0]['message']['content'] ?? '');
    } elseif ($provider === 'anthropic') {
        $apiKey = (string)secret_get(catn8_mystery_ai_secret_key($provider, 'api_key'));
        if ($apiKey === '') throw new RuntimeException('Missing API key');

        $decoded = catn8_http_json('POST', 'https://api.anthropic.com/v1/messages', [
            'x-api-key' => trim($apiKey),
            'anthropic-version' => '2023-06-01',
        ], [
            'model' => $model,
            'max_tokens' => 512,
            'temperature' => $temperature,
            'system' => $systemPrompt,
            'messages' => [['role' => 'user', 'content' => $userPrompt]],
        ]);
        $answerText = (string)($decoded['content'][0]['text'] ?? '');
    } elseif ($provider === 'google_ai_studio') {
        $apiKey = (string)secret_get(catn8_mystery_ai_secret_key($provider, 'api_key'));
        if ($apiKey === '') throw new RuntimeException('Missing API key');

        $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent';
        $decoded = catn8_http_json('POST', $url, ['x-goog-api-key' => trim($apiKey)], [
            'contents' => [['role' => 'user', 'parts' => [['text' => $userPrompt]]]],
            'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
            'generationConfig' => ['temperature' => $temperature],
        ]);
        $answerText = (string)($decoded['candidates'][0]['content']['parts'][0]['text'] ?? '');
    } elseif ($provider === 'azure_openai') {
        $apiKey = (string)secret_get(catn8_mystery_ai_secret_key($provider, 'api_key'));
        if ($apiKey === '') throw new RuntimeException('Missing API key');

        $endpoint = rtrim(catn8_validate_external_base_url((string)($providerConfig['azure_endpoint'] ?? '')), '/');
        $deployment = (string)($providerConfig['azure_deployment'] ?? '');
        $apiVersion = (string)($providerConfig['azure_api_version'] ?? '');
        $url = $endpoint . '/openai/deployments/' . rawurlencode($deployment) . '/chat/completions?api-version=' . rawurlencode($apiVersion);

        $decoded = catn8_http_json('POST', $url, ['api-key' => trim($apiKey)], [
            'messages' => [['role' => 'system', 'content' => $systemPrompt], ['role' => 'user', 'content' => $userPrompt]],
            'temperature' => $temperature,
            'max_tokens' => 512,
        ]);
        $answerText = (string)($decoded['choices'][0]['message']['content'] ?? '');
    } else {
        throw new RuntimeException('Unsupported AI provider: ' . $provider);
    }

    if ($answerText === '') throw new RuntimeException('AI returned empty answer');

    return [
        'answer_text' => trim($answerText),
        'ai_meta' => [
            'provider' => $provider,
            'model' => $model,
            'temperature' => $temperature,
        ]
    ];
}
