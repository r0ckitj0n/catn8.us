<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_session_start();
$viewerId = catn8_require_group_or_admin('mystery-game-users');
$isAdmin = catn8_user_is_admin($viewerId);
catn8_require_method('GET');

catn8_rate_limit_require('mystery.sheriff_live_bootstrap.' . $viewerId, 20, 600);

$scenarioId = (int)($_GET['scenario_id'] ?? 0);
if ($scenarioId <= 0) {
    catn8_json_response(['success' => false, 'error' => 'Invalid scenario_id'], 400);
}

try {
    Database::queryOne('SELECT id FROM mystery_game_settings LIMIT 1');
} catch (Throwable $e) {
    catn8_json_response(['success' => false, 'error' => 'Mystery settings table is not initialized'], 500);
}

$scenarioRow = Database::queryOne(
    'SELECT s.id, s.game_id, s.title, s.specs_json, g.owner_user_id, g.mystery_id
     FROM mystery_scenarios s
     INNER JOIN mystery_games g ON g.id = s.game_id
     WHERE s.id = ?
     LIMIT 1',
    [$scenarioId]
);
if (!$scenarioRow) {
    catn8_json_response(['success' => false, 'error' => 'Scenario not found'], 404);
}

if (!$isAdmin && (int)($scenarioRow['owner_user_id'] ?? 0) !== $viewerId) {
    catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
}

$mysteryId = (int)($scenarioRow['mystery_id'] ?? 0);
if ($mysteryId <= 0) {
    catn8_json_response(['success' => false, 'error' => 'Scenario mystery_id is invalid'], 500);
}

require_once __DIR__ . '/live_functions.php';

$caseId = (int)($scenarioRow['game_id'] ?? 0);
$settings = catn8_mystery_load_merged_settings($mysteryId, $caseId, $viewerId);

$sheriffRow = Database::queryOne(
    'SELECT se.entity_id, se.override_json, e.slug, e.name, e.data_json
     FROM mystery_scenario_entities se
     INNER JOIN mystery_entities e ON e.id = se.entity_id
     WHERE se.scenario_id = ? AND se.role = ?
     LIMIT 1',
    [$scenarioId, 'sheriff']
);
if (!$sheriffRow) {
    catn8_json_response(['success' => false, 'error' => 'Sheriff is not attached to this scenario'], 404);
}

$sheriffEntityId = (int)($sheriffRow['entity_id'] ?? 0);

require_once __DIR__ . '/interrogate_functions.php';
$interrogationState = catn8_interrogate_load_state($scenarioId, $sheriffEntityId, $viewerId, $isAdmin);

$model = trim((string)($settings['sheriff_live']['model'] ?? 'gemini-2.0-flash-exp'));
$baseInstruction = (string)($settings['sheriff_live']['system_instruction'] ?? 'You are Sheriff Hank Mercer. You are calm, direct, and helpful. Stay in character.');

$scenarioTitle = $interrogationState['scenario_title'];
$sheriffName = $interrogationState['entity_name'];
$profile = $interrogationState['profile'];

$profileJson = json_encode($profile, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
if (!is_string($profileJson)) $profileJson = '{}';

$systemInstruction = trim(
    $baseInstruction . "\n\n" .
    'Scenario: ' . $scenarioTitle . "\n" .
    'You are: ' . $sheriffName . "\n\n" .
    'Character Profile JSON:' . "\n" . $profileJson
);

$apiKey = secret_get('CATN8_MYSTERY_GEMINI_API_KEY');
if (!is_string($apiKey) || trim($apiKey) === '') {
    catn8_json_response([
        'success' => false,
        'error' => 'Gemini API key is not configured (CATN8_MYSTERY_GEMINI_API_KEY). Set it in Settings → Mystery → Gemini.',
        'missing_secret' => 'CATN8_MYSTERY_GEMINI_API_KEY',
    ], 400);
}
$apiKey = trim($apiKey);

$expireTime = gmdate('c', time() + (30 * 60));
$newSessionExpireTime = gmdate('c', time() + 60);

$tokenPayload = [
    'uses' => 1,
    'expireTime' => $expireTime,
    'newSessionExpireTime' => $newSessionExpireTime,
    'bidiGenerateContentSetup' => [
        'model' => $model,
        'generationConfig' => [
            'responseModalities' => ['AUDIO'],
        ],
        'systemInstruction' => [
            'parts' => [
                ['text' => $systemInstruction],
            ],
        ],
        'inputAudioTranscription' => new stdClass(),
        'outputAudioTranscription' => new stdClass(),
    ],
];

$url = 'https://generativelanguage.googleapis.com/v1alpha/auth_tokens';
$respInfo = catn8_http_json_with_status(
    'POST',
    $url,
    ['x-goog-api-key' => $apiKey],
    $tokenPayload,
    10,
    20
);

$status = (int)($respInfo['status'] ?? 0);
$resp = (string)($respInfo['raw'] ?? '');
$data = $respInfo['json'] ?? null;

if (!is_string($resp) || $resp === '') {
    catn8_log_error('Gemini ephemeral token request failed (sheriff)', ['http_status' => $status]);
    $payload = ['success' => false, 'error' => 'Gemini ephemeral token request failed'];
    if (catn8_is_local_request()) {
        $payload['gemini_http_status'] = $status;
    }
    catn8_json_response($payload, 500);
}

if (!is_array($data)) {
    catn8_log_error('Gemini ephemeral token response was not valid JSON (sheriff)', ['http_status' => $status, 'raw' => substr((string)$resp, 0, 2000)]);
    $payload = ['success' => false, 'error' => 'Gemini ephemeral token response was not valid JSON'];
    if (catn8_is_local_request()) {
        $payload['gemini_http_status'] = $status;
        $payload['gemini_raw'] = substr($resp, 0, 2000);
    }
    catn8_json_response($payload, 500);
}

if ($status >= 400 || isset($data['error'])) {
    $msg = '';
    if (isset($data['error']['message'])) {
        $msg = (string)$data['error']['message'];
    }
    if ($msg === '') {
        $msg = 'HTTP ' . $status;
    }
    catn8_log_error('Gemini ephemeral token error (sheriff)', ['http_status' => $status, 'message' => $msg, 'raw' => substr((string)$resp, 0, 2000)]);
    $payload = ['success' => false, 'error' => 'Gemini ephemeral token error'];
    if (catn8_is_local_request()) {
        $payload['error'] = 'Gemini ephemeral token error: ' . $msg;
        $payload['gemini_http_status'] = $status;
        $payload['gemini_raw'] = substr($resp, 0, 2000);
    }
    catn8_json_response($payload, 500);
}

$name = (string)($data['name'] ?? '');
if ($name === '') {
    catn8_json_response(['success' => false, 'error' => 'Gemini ephemeral token response missing name'], 500);
}

catn8_json_response([
    'success' => true,
    'model' => $model,
    'entity_id' => $sheriffEntityId,
    'system_instruction' => $systemInstruction,
    'token' => [
        'name' => $name,
        'expireTime' => (string)($data['expireTime'] ?? ''),
        'newSessionExpireTime' => (string)($data['newSessionExpireTime'] ?? ''),
        'uses' => (int)($data['uses'] ?? 0),
    ],
]);
