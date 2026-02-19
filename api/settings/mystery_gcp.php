<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_session_start();
catn8_require_admin();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

$keySa = 'CATN8_MYSTERY_GCP_SERVICE_ACCOUNT_JSON';
$keyTts = 'CATN8_MYSTERY_GOOGLE_CLOUD_TTS_API_KEY';

if ($method === 'GET') {
    $sa = secret_get($keySa);
    $tts = secret_get($keyTts);

    catn8_json_response([
        'success' => true,
        'has_service_account_json' => (is_string($sa) && trim($sa) !== '') ? 1 : 0,
        'has_tts_api_key' => (is_string($tts) && trim($tts) !== '') ? 1 : 0,
    ]);
}

if ($method !== 'POST') {
    catn8_json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

$body = catn8_read_json_body();

$serviceAccountJson = (string)($body['service_account_json'] ?? '');
$ttsApiKey = (string)($body['tts_api_key'] ?? '');

if (trim($serviceAccountJson) !== '') {
    $decoded = json_decode($serviceAccountJson, true);
    if (!is_array($decoded)) {
        catn8_json_response(['success' => false, 'error' => 'service_account_json is not valid JSON'], 400);
    }
    $projectId = trim((string)($decoded['project_id'] ?? ''));
    if ($projectId === '') {
        catn8_json_response(['success' => false, 'error' => 'service_account_json missing project_id'], 400);
    }
    secret_set($keySa, $serviceAccountJson);
}

if (trim($ttsApiKey) !== '') {
    secret_set($keyTts, $ttsApiKey);
}

$sa = secret_get($keySa);
$tts = secret_get($keyTts);

catn8_json_response([
    'success' => true,
    'has_service_account_json' => (is_string($sa) && trim($sa) !== '') ? 1 : 0,
    'has_tts_api_key' => (is_string($tts) && trim($tts) !== '') ? 1 : 0,
]);
