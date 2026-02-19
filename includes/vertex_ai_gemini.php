<?php

declare(strict_types=1);

require_once __DIR__ . '/google_oauth_service_account.php';

function catn8_vertex_ai_gemini_generate_text(array $opts): string
{
    $serviceAccountJson = (string)($opts['service_account_json'] ?? '');
    $projectId = trim((string)($opts['project_id'] ?? ''));
    $location = trim((string)($opts['location'] ?? ''));
    $model = trim((string)($opts['model'] ?? ''));

    $systemPrompt = (string)($opts['system_prompt'] ?? '');
    $userPrompt = (string)($opts['user_prompt'] ?? '');

    $temperature = $opts['temperature'] ?? 0.2;
    if (!is_numeric($temperature)) $temperature = 0.2;
    $temperature = (float)$temperature;

    $maxOutputTokens = $opts['max_output_tokens'] ?? null;
    if ($maxOutputTokens !== null && !is_numeric($maxOutputTokens)) $maxOutputTokens = null;

    if (trim($serviceAccountJson) === '') {
        throw new RuntimeException('Missing service_account_json');
    }
    if ($projectId === '') {
        throw new RuntimeException('Missing project_id');
    }
    if ($location === '') {
        throw new RuntimeException('Missing location');
    }
    if ($model === '') {
        throw new RuntimeException('Missing model');
    }
    if (trim($userPrompt) === '') {
        throw new RuntimeException('Missing user_prompt');
    }

    $token = catn8_google_service_account_access_token($serviceAccountJson, 'https://www.googleapis.com/auth/cloud-platform');

    $host = '';
    $locLower = strtolower(trim($location));
    if ($locLower === 'global') {
        $host = 'aiplatform.googleapis.com';
    } else {
        $host = $location . '-aiplatform.googleapis.com';
    }

    $modelPath = $model;
    if (strpos($modelPath, 'publishers/') === 0) {
        // ok, full publisher model path
    } elseif (strpos($modelPath, '/') !== false) {
        // assume caller provided a full-ish path already
    } else {
        $modelPath = 'publishers/google/models/' . $modelPath;
    }

    $fullModel = 'projects/' . $projectId . '/locations/' . $location . '/' . $modelPath;
    $url = 'https://' . $host . '/v1/' . $fullModel . ':generateContent';

    $payload = [
        'contents' => [
            [
                'role' => 'user',
                'parts' => [
                    ['text' => $userPrompt],
                ],
            ],
        ],
        'generationConfig' => [
            'temperature' => $temperature,
        ],
    ];

    if (trim($systemPrompt) !== '') {
        $payload['systemInstruction'] = [
            'parts' => [
                ['text' => $systemPrompt],
            ],
        ];
    }

    if ($maxOutputTokens !== null) {
        $payload['generationConfig']['maxOutputTokens'] = (int)$maxOutputTokens;
    }

    $headers = "Content-Type: application/json\r\nAccept: application/json\r\nAuthorization: Bearer {$token}\r\n";

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => $headers,
            'content' => json_encode($payload, JSON_UNESCAPED_SLASHES),
            'ignore_errors' => true,
            'timeout' => 30,
        ],
    ]);

    $resp = @file_get_contents($url, false, $context);

    $status = 0;
    if (isset($http_response_header) && is_array($http_response_header)) {
        foreach ($http_response_header as $h) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) {
                $status = (int)$m[1];
                break;
            }
        }
    }

    if (!is_string($resp) || $resp === '') {
        $last = error_get_last();
        $details = is_array($last) ? (string)($last['message'] ?? '') : '';
        if ($details !== '') {
            throw new RuntimeException('Vertex AI request failed: ' . $details);
        }
        throw new RuntimeException('Vertex AI request failed (model=' . $model . ', location=' . $location . ')');
    }

    $data = json_decode($resp, true);
    if (!is_array($data)) {
        throw new RuntimeException('Vertex AI response was not valid JSON');
    }

    if ($status >= 400 || isset($data['error'])) {
        $msg = '';
        if (isset($data['error']['message'])) {
            $msg = (string)$data['error']['message'];
        }
        if ($msg === '') {
            $msg = 'HTTP ' . $status;
        }
        throw new RuntimeException('Vertex AI error: ' . $msg);
    }

    $candidates = $data['candidates'] ?? null;
    if (!is_array($candidates) || !isset($candidates[0]['content']['parts']) || !is_array($candidates[0]['content']['parts'])) {
        throw new RuntimeException('Vertex AI response missing candidates');
    }

    $parts = $candidates[0]['content']['parts'];
    $text = '';
    foreach ($parts as $p) {
        if (is_array($p) && isset($p['text'])) {
            $text .= (string)$p['text'];
        }
    }

    $text = trim($text);
    if ($text === '') {
        throw new RuntimeException('Vertex AI returned empty text');
    }

    return $text;
}
