<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_session_start();
catn8_require_admin();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

$defaults = [
    'provider' => 'openai',
    'model' => 'gpt-4o-mini',
    'base_url' => '',
    'location' => '',
    'temperature' => 0.2,
    'system_prompt' => '',
    'provider_config' => [],
];

$keyCfg = catn8_secret_key('ai.config');
$keyApiKey = catn8_secret_key('ai.api_key');

$providers = [
    'openai',
    'anthropic',
    'google_ai_studio',
    'google_vertex_ai',
    'azure_openai',
    'aws_bedrock',
    'together_ai',
    'fireworks_ai',
    'huggingface',
];

$secretKey = static function (string $provider, string $name): string {
    $p = strtolower(trim($provider));
    $n = strtolower(trim($name));
    if ($p === '' || $n === '') {
        throw new RuntimeException('Invalid secret key request');
    }
    return catn8_secret_key('ai.secret.' . $p . '.' . $n);
};

$computeHasSecrets = static function () use ($providers, $secretKey): array {
    $out = [];
    foreach ($providers as $p) {
        $row = [
            'api_key' => 0,
            'service_account_json' => 0,
            'aws_access_key_id' => 0,
            'aws_secret_access_key' => 0,
            'aws_session_token' => 0,
        ];

        $v = secret_get($secretKey($p, 'api_key'));
        if (is_string($v) && trim($v) !== '') $row['api_key'] = 1;

        if ($p === 'google_vertex_ai') {
            $v = secret_get($secretKey($p, 'service_account_json'));
            if (is_string($v) && trim($v) !== '') $row['service_account_json'] = 1;
        }

        if ($p === 'aws_bedrock') {
            $v = secret_get($secretKey($p, 'aws_access_key_id'));
            if (is_string($v) && trim($v) !== '') $row['aws_access_key_id'] = 1;
            $v = secret_get($secretKey($p, 'aws_secret_access_key'));
            if (is_string($v) && trim($v) !== '') $row['aws_secret_access_key'] = 1;
            $v = secret_get($secretKey($p, 'aws_session_token'));
            if (is_string($v) && trim($v) !== '') $row['aws_session_token'] = 1;
        }

        $out[$p] = $row;
    }
    return $out;
};

$readConfig = static function () use ($keyCfg, $defaults): array {
    $raw = secret_get($keyCfg);
    $cfg = [];
    if (is_string($raw) && $raw !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) $cfg = $decoded;
    }

    $temperature = $cfg['temperature'] ?? $defaults['temperature'];
    if (!is_numeric($temperature)) $temperature = $defaults['temperature'];

    $providerConfig = $cfg['provider_config'] ?? $defaults['provider_config'];
    if (!is_array($providerConfig)) {
        $providerConfig = $defaults['provider_config'];
    }

    return [
        'provider' => (string)($cfg['provider'] ?? $defaults['provider']),
        'model' => (string)($cfg['model'] ?? $defaults['model']),
        'base_url' => (string)($cfg['base_url'] ?? $defaults['base_url']),
        'location' => (string)($cfg['location'] ?? $defaults['location']),
        'temperature' => (float)$temperature,
        'system_prompt' => (string)($cfg['system_prompt'] ?? $defaults['system_prompt']),
        'provider_config' => $providerConfig,
    ];
};

if ($method === 'GET') {
    $cfg = $readConfig();
    $hasKey = secret_get($keyApiKey);

    catn8_json_response([
        'success' => true,
        'config' => $cfg,
        'has_secrets' => $computeHasSecrets(),
        'legacy_has_api_key' => (is_string($hasKey) && trim($hasKey) !== '') ? 1 : 0,
    ]);
}

if ($method !== 'POST') {
    catn8_json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

$body = catn8_read_json_body();

$provider = trim((string)($body['provider'] ?? $defaults['provider']));
$model = trim((string)($body['model'] ?? $defaults['model']));
$baseUrl = trim((string)($body['base_url'] ?? $defaults['base_url']));
$location = trim((string)($body['location'] ?? $defaults['location']));
$systemPrompt = (string)($body['system_prompt'] ?? $defaults['system_prompt']);

$providerConfig = $body['provider_config'] ?? $defaults['provider_config'];
if (!is_array($providerConfig)) {
    catn8_json_response(['success' => false, 'error' => 'Invalid provider_config'], 400);
}

$secrets = $body['secrets'] ?? null;
if ($secrets !== null && !is_array($secrets)) {
    catn8_json_response(['success' => false, 'error' => 'Invalid secrets'], 400);
}

$temperature = $body['temperature'] ?? $defaults['temperature'];
if (!is_numeric($temperature)) {
    $temperature = $defaults['temperature'];
}
$temperature = (float)$temperature;

$cfg = [
    'provider' => $provider !== '' ? $provider : $defaults['provider'],
    'model' => $model !== '' ? $model : $defaults['model'],
    'base_url' => $baseUrl,
    'location' => $location,
    'temperature' => $temperature,
    'system_prompt' => $systemPrompt,
    'provider_config' => $providerConfig,
];

secret_set($keyCfg, json_encode($cfg));

$providerNorm = strtolower(trim((string)($cfg['provider'] ?? '')));
if ($providerNorm !== '' && is_array($secrets)) {
    $apiKey = (string)($secrets['api_key'] ?? '');
    if (trim($apiKey) !== '') {
        secret_set($secretKey($providerNorm, 'api_key'), $apiKey);
    }

    if ($providerNorm === 'google_vertex_ai') {
        $sa = (string)($secrets['service_account_json'] ?? '');
        if (trim($sa) !== '') {
            secret_set($secretKey($providerNorm, 'service_account_json'), $sa);
        }
    }

    if ($providerNorm === 'aws_bedrock') {
        $ak = (string)($secrets['aws_access_key_id'] ?? '');
        $sk = (string)($secrets['aws_secret_access_key'] ?? '');
        $st = (string)($secrets['aws_session_token'] ?? '');
        if (trim($ak) !== '') secret_set($secretKey($providerNorm, 'aws_access_key_id'), $ak);
        if (trim($sk) !== '') secret_set($secretKey($providerNorm, 'aws_secret_access_key'), $sk);
        if (trim($st) !== '') secret_set($secretKey($providerNorm, 'aws_session_token'), $st);
    }
}

catn8_json_response([
    'success' => true,
    'config' => $readConfig(),
    'has_secrets' => $computeHasSecrets(),
]);
