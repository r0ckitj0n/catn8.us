<?php
/**
 * admin_functions_ai.php - Core AI generation functions for Mystery Admin
 * VERSION: 2025-12-31-0510-FINAL
 */
declare(strict_types=1);

/**
 * Standard text generation via configured AI provider.
 * Returns the raw text response.
 */
function catn8_mystery_ai_generate_text(array $params): string {
    $provider = strtolower(trim((string)($params['provider'] ?? 'openai')));
    $model = trim((string)($params['model'] ?? ''));
    $systemPrompt = trim((string)($params['system_prompt'] ?? ''));
    $userPrompt = trim((string)($params['user_prompt'] ?? ''));
    $temperature = (float)($params['temperature'] ?? 0.2);

    if ($provider === 'google_vertex_ai') {
        $key = catn8_mystery_ai_secret_key($provider, 'service_account_json');
        $saJson = secret_get($key);
        
        // Fallback to image-specific secret if generic one is missing
        if (!$saJson) {
            $saJson = secret_get(catn8_secret_key('ai_image.secret.' . $provider . '.service_account_json'));
        }

        if (!$saJson) {
            throw new RuntimeException("Missing Google Vertex AI service account JSON (Checked: $key)");
        }
        $sa = json_decode((string)$saJson, true);
        return catn8_vertex_ai_gemini_generate_text([
            'service_account_json' => $saJson,
            'project_id' => trim((string)($sa['project_id'] ?? '')),
            'location' => trim((string)($params['location'] ?? 'us-central1')),
            'model' => $model,
            'system_prompt' => $systemPrompt,
            'user_prompt' => $userPrompt,
            'temperature' => $temperature,
            'max_output_tokens' => 1536,
        ]);
    }

    if ($provider === 'openai') {
        $apiKey = secret_get(catn8_mystery_ai_secret_key($provider, 'api_key'));
        if (!$apiKey) {
            throw new RuntimeException("Missing OpenAI API Key");
        }
        $factory = OpenAI::factory()->withApiKey(trim((string)$apiKey));
        if (!empty($params['base_url'])) {
            $factory = $factory->withBaseUri(catn8_validate_external_base_url($params['base_url']));
        }
        $client = $factory->make();
        $resp = $client->chat()->create([
            'model' => $model ?: 'gpt-4o-mini',
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $userPrompt]
            ],
            'temperature' => $temperature,
            'response_format' => ['type' => 'json_object'],
        ]);
        return (string)($resp->choices[0]->message->content ?? '');
    }

    if ($provider === 'google_ai_studio') {
        $apiKey = secret_get(catn8_mystery_ai_secret_key($provider, 'api_key'));
        if (!$apiKey) {
            throw new RuntimeException("Missing Google AI Studio API Key");
        }
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent';
        $resp = catn8_http_json_with_status('POST', $url, ['x-goog-api-key' => trim((string)$apiKey)], [
            'contents' => [['role' => 'user', 'parts' => [['text' => $userPrompt]]]],
            'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
            'generationConfig' => ['temperature' => $temperature],
        ], 10, 30);
        return (string)($resp['json']['candidates'][0]['content']['parts'][0]['text'] ?? '');
    }

    throw new RuntimeException("Unsupported AI provider: $provider");
}

/**
 * Standard JSON generation via configured AI provider.
 * Returns parsed JSON array inside a 'json' key.
 */
function catn8_ai_chat_json(array $params): array {
    $content = catn8_mystery_ai_generate_text($params);
    if (trim($content) === '') {
        throw new RuntimeException('AI returned empty response');
    }
    
    $jsonText = catn8_mystery_extract_json_from_text($content);
    if ($jsonText === '') {
        throw new RuntimeException('AI returned non-JSON response');
    }
    
    $decoded = json_decode($jsonText, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('AI returned invalid JSON');
    }
    
    return ['json' => $decoded];
}
