<?php
if ($provider === 'google_vertex_ai') {
    require_once __DIR__ . '/../../includes/vertex_ai_gemini.php';

    $saJson = secret_get(catn8_settings_ai_secret_key($provider, 'service_account_json'));
    if (!is_string($saJson) || trim($saJson) === '') {
        $fail(500, 'Missing AI service account JSON (google_vertex_ai)');
    }
    $sa = json_decode((string)$saJson, true);
    if (!is_array($sa)) {
        $fail(500, 'AI Vertex service account JSON is not valid JSON');
    }
    $projectId = trim((string)($sa['project_id'] ?? ''));
    if ($projectId === '') {
        $fail(500, 'AI Vertex service account JSON missing project_id');
    }
    if ($location === '') {
        $fail(500, 'Missing Vertex AI location in AI config');
    }
    if ($model === '') {
        $fail(500, 'Missing Vertex AI model in AI config');
    }

    $text = catn8_vertex_ai_gemini_generate_text([
        'service_account_json' => (string)$saJson,
        'project_id' => $projectId,
        'location' => $location,
        'model' => $model,
        'system_prompt' => $systemPrompt,
        'user_prompt' => $userPrompt,
        'temperature' => 0.0,
        'max_output_tokens' => 16,
    ]);

    catn8_json_response([
        'success' => true,
        'ai' => $aiMeta,
        'sample' => mb_substr(trim($text), 0, 80),
    ]);
}
