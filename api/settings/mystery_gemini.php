<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_session_start();
catn8_require_admin();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

$keyGemini = 'CATN8_MYSTERY_GEMINI_API_KEY';
$keyGeminiKeyName = 'CATN8_MYSTERY_GEMINI_KEY_NAME';
$keyGeminiProjectName = 'CATN8_MYSTERY_GEMINI_PROJECT_NAME';
$keyGeminiProjectNumber = 'CATN8_MYSTERY_GEMINI_PROJECT_NUMBER';

if ($method === 'GET') {
    $k = secret_get($keyGemini);
    $keyName = secret_get($keyGeminiKeyName);
    $projectName = secret_get($keyGeminiProjectName);
    $projectNumber = secret_get($keyGeminiProjectNumber);

    catn8_json_response([
        'success' => true,
        'has_api_key' => (is_string($k) && trim($k) !== '') ? 1 : 0,
        'key_name' => is_string($keyName) ? trim($keyName) : '',
        'project_name' => is_string($projectName) ? trim($projectName) : '',
        'project_number' => is_string($projectNumber) ? trim($projectNumber) : '',
    ]);
}

if ($method !== 'POST') {
    catn8_json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

$body = catn8_read_json_body();

$apiKey = (string)($body['api_key'] ?? '');
$keyName = (string)($body['key_name'] ?? '');
$projectName = (string)($body['project_name'] ?? '');
$projectNumber = (string)($body['project_number'] ?? '');

$didSomething = false;

if (trim($apiKey) !== '') {
    secret_set($keyGemini, $apiKey);
    $didSomething = true;
}

if (trim($keyName) !== '') {
    secret_set($keyGeminiKeyName, $keyName);
    $didSomething = true;
}

if (trim($projectName) !== '') {
    secret_set($keyGeminiProjectName, $projectName);
    $didSomething = true;
}

if (trim($projectNumber) !== '') {
    secret_set($keyGeminiProjectNumber, $projectNumber);
    $didSomething = true;
}

if (!$didSomething) {
    catn8_json_response(['success' => false, 'error' => 'No fields to update'], 400);
}

$k = secret_get($keyGemini);
$keyName2 = secret_get($keyGeminiKeyName);
$projectName2 = secret_get($keyGeminiProjectName);
$projectNumber2 = secret_get($keyGeminiProjectNumber);

catn8_json_response([
    'success' => true,
    'has_api_key' => (is_string($k) && trim($k) !== '') ? 1 : 0,
    'key_name' => is_string($keyName2) ? trim($keyName2) : '',
    'project_name' => is_string($projectName2) ? trim($projectName2) : '',
    'project_number' => is_string($projectNumber2) ? trim($projectNumber2) : '',
]);
