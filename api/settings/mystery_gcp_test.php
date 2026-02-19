<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../includes/diagnostics_log.php';

catn8_session_start();
catn8_require_admin();

catn8_require_method('GET');

$fail = static function (int $status, string $error, array $meta = []): void {
    catn8_diagnostics_log_event('settings.mystery_gcp.test', false, $status, $error, $meta);
    catn8_json_response(['success' => false, 'error' => $error], $status);
};

$mode = strtolower(trim((string)($_GET['mode'] ?? '')));
if ($mode !== 'service_account' && $mode !== 'tts_api_key') {
    $fail(400, 'Invalid mode', ['mode' => $mode]);
}

if ($mode === 'tts_api_key') {
    $fail(400, 'Google Cloud Text-to-Speech does not support API key auth for this API. Use a service account (OAuth) instead.');
}

require_once __DIR__ . '/../../includes/google_cloud_tts.php';

$keySa = 'CATN8_MYSTERY_GCP_SERVICE_ACCOUNT_JSON';
$keyTts = 'CATN8_MYSTERY_GOOGLE_CLOUD_TTS_API_KEY';

$serviceAccountJson = '';
$apiKey = '';

if ($mode === 'service_account') {
    $serviceAccountJson = (string)secret_get($keySa);
    if (trim($serviceAccountJson) === '') {
        $fail(500, 'Missing secret ' . $keySa, ['mode' => $mode]);
    }
}

if ($mode === 'tts_api_key') {
    $apiKey = trim((string)secret_get($keyTts));
    if ($apiKey === '') {
        $fail(500, 'Missing secret ' . $keyTts, ['mode' => $mode]);
    }
}

try {
    $res = catn8_google_cloud_tts_list_voices([
        'api_key' => $apiKey,
        'service_account_json' => $serviceAccountJson,
        'language_code' => 'en-US',
    ]);

    $voices = $res['voices'] ?? [];
    $voiceCount = is_array($voices) ? count($voices) : 0;

    catn8_json_response([
        'success' => true,
        'auth_mode' => (string)($res['auth_mode'] ?? ''),
        'http_status' => (int)($res['http_status'] ?? 0),
        'voice_count' => $voiceCount,
    ]);
} catch (Throwable $e) {
    $fail(500, $e->getMessage(), ['mode' => $mode]);
}
