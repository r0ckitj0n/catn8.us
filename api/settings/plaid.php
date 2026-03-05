<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../includes/diagnostics_log.php';

catn8_session_start();
catn8_require_admin();

$action = trim((string)($_GET['action'] ?? ''));

$allowedEnvs = ['sandbox', 'development', 'production'];
$keyClientId = catn8_secret_key('accumul8.plaid.client_id');
$keySecret = catn8_secret_key('accumul8.plaid.secret');
$keyEnv = catn8_secret_key('accumul8.plaid.env');

$plaidEnvBaseUrl = static function (string $env): string {
    if ($env === 'production') {
        return 'https://production.plaid.com';
    }
    if ($env === 'development') {
        return 'https://development.plaid.com';
    }
    return 'https://sandbox.plaid.com';
};

$normalizeEnv = static function ($value) use ($allowedEnvs): string {
    $env = strtolower(trim((string)$value));
    if (!in_array($env, $allowedEnvs, true)) {
        $env = 'sandbox';
    }
    return $env;
};

$requireJsonContentType = static function (): void {
    $contentType = strtolower(trim((string)($_SERVER['CONTENT_TYPE'] ?? '')));
    if ($contentType === '' || strpos($contentType, 'application/json') !== 0) {
        catn8_json_response(['success' => false, 'error' => 'Unsupported content type; expected application/json'], 415);
    }
};

$readSettings = static function () use ($keyClientId, $keySecret, $keyEnv, $normalizeEnv): array {
    $clientId = trim((string)(secret_get($keyClientId) ?? getenv('PLAID_CLIENT_ID') ?? ''));
    $secret = trim((string)(secret_get($keySecret) ?? getenv('PLAID_SECRET') ?? ''));
    $env = $normalizeEnv(secret_get($keyEnv) ?? getenv('PLAID_ENV') ?? 'sandbox');

    return [
        'source' => 'secret_store',
        'config' => [
            'env' => $env,
            'client_id' => $clientId,
        ],
        'status' => [
            'has_client_id' => $clientId !== '',
            'has_secret' => $secret !== '',
        ],
        'secret' => $secret,
    ];
};

$fail = static function (string $eventKey, int $status, string $error, array $meta = []): void {
    catn8_diagnostics_log_event($eventKey, false, $status, $error, $meta);
    catn8_json_response(['success' => false, 'error' => $error], $status);
};

if ($action === 'get') {
    catn8_require_method('GET');
    $s = $readSettings();
    catn8_json_response([
        'success' => true,
        'source' => $s['source'],
        'config' => $s['config'],
        'status' => $s['status'],
    ]);
}

if ($action === 'save') {
    catn8_require_method('POST');
    $requireJsonContentType();

    $body = catn8_read_json_body();
    $env = $normalizeEnv($body['env'] ?? 'sandbox');
    $clientId = trim((string)($body['client_id'] ?? ''));
    $secret = trim((string)($body['secret'] ?? ''));

    if ($clientId !== '' && strlen($clientId) > 191) {
        $fail('settings.plaid.save', 400, 'client_id must be 191 characters or fewer');
    }

    if ($secret !== '' && strlen($secret) > 512) {
        $fail('settings.plaid.save', 400, 'secret must be 512 characters or fewer');
    }

    if (!secret_set($keyEnv, $env)) {
        $fail('settings.plaid.save', 500, 'Failed to save Plaid environment', ['env' => $env]);
    }

    if ($clientId !== '' && !secret_set($keyClientId, $clientId)) {
        $fail('settings.plaid.save', 500, 'Failed to save Plaid client_id', ['env' => $env]);
    }

    if ($secret !== '' && !secret_set($keySecret, $secret)) {
        $fail('settings.plaid.save', 500, 'Failed to save Plaid secret', ['env' => $env]);
    }

    $s = $readSettings();
    catn8_diagnostics_log_event('settings.plaid.save', true, 200, 'Plaid settings saved', [
        'env' => $env,
        'client_id_updated' => $clientId !== '' ? 1 : 0,
        'secret_updated' => $secret !== '' ? 1 : 0,
    ]);

    catn8_json_response([
        'success' => true,
        'message' => 'Plaid settings saved',
        'config' => $s['config'],
        'status' => $s['status'],
    ]);
}

if ($action === 'delete') {
    catn8_require_method('POST');
    $requireJsonContentType();

    $body = catn8_read_json_body();
    $field = trim((string)($body['field'] ?? ''));

    if (!in_array($field, ['client_id', 'secret', 'all'], true)) {
        $fail('settings.plaid.delete', 400, 'Invalid field; expected client_id, secret, or all');
    }

    if ($field === 'client_id' || $field === 'all') {
        if (!secret_delete($keyClientId)) {
            $fail('settings.plaid.delete', 500, 'Failed to delete client_id');
        }
    }

    if ($field === 'secret' || $field === 'all') {
        if (!secret_delete($keySecret)) {
            $fail('settings.plaid.delete', 500, 'Failed to delete secret');
        }
    }

    $s = $readSettings();
    catn8_diagnostics_log_event('settings.plaid.delete', true, 200, 'Plaid credential deleted', ['field' => $field]);

    catn8_json_response([
        'success' => true,
        'message' => 'Plaid credential deleted',
        'config' => $s['config'],
        'status' => $s['status'],
    ]);
}

if ($action === 'test') {
    catn8_require_method('POST');
    $requireJsonContentType();

    $body = catn8_read_json_body();

    $settings = $readSettings();
    $env = $normalizeEnv($body['env'] ?? $settings['config']['env']);
    $clientIdInput = trim((string)($body['client_id'] ?? ''));
    $secretInput = trim((string)($body['secret'] ?? ''));
    $clientId = $clientIdInput !== '' ? $clientIdInput : trim((string)($settings['config']['client_id'] ?? ''));
    $secret = $secretInput !== '' ? $secretInput : trim((string)($settings['secret'] ?? ''));

    if ($clientId === '' || $secret === '') {
        $fail('settings.plaid.test', 400, 'Both client_id and secret are required for testing', ['env' => $env]);
    }

    $url = rtrim($plaidEnvBaseUrl($env), '/') . '/link/token/create';
    $payload = [
        'client_id' => $clientId,
        'secret' => $secret,
        'client_name' => 'catn8 Plaid Settings Test',
        'language' => 'en',
        'country_codes' => ['US'],
        'products' => ['transactions'],
        'user' => [
            'client_user_id' => 'catn8-settings-test-' . (string)catn8_auth_user_id(),
        ],
    ];

    try {
        $resp = catn8_http_json_with_status('POST', $url, [], $payload, 10, 45);
        $status = (int)($resp['status'] ?? 0);
        $json = is_array($resp['json'] ?? null) ? $resp['json'] : [];

        if ($status < 200 || $status >= 300) {
            $err = trim((string)($json['error_message'] ?? $json['display_message'] ?? 'Plaid request failed'));
            if ($err === '') {
                $err = 'Plaid request failed';
            }
            $requestId = trim((string)($json['request_id'] ?? ''));
            $meta = ['env' => $env, 'status' => $status];
            if ($requestId !== '') {
                $meta['request_id'] = $requestId;
            }
            $fail('settings.plaid.test', 400, $err . ' (HTTP ' . $status . ')', $meta);
        }

        $linkToken = trim((string)($json['link_token'] ?? ''));
        if ($linkToken === '') {
            $fail('settings.plaid.test', 500, 'Plaid test response missing link_token', ['env' => $env]);
        }

        $requestId = trim((string)($json['request_id'] ?? ''));
        $expiration = trim((string)($json['expiration'] ?? ''));

        catn8_diagnostics_log_event('settings.plaid.test', true, 200, 'Plaid test OK', [
            'env' => $env,
            'request_id' => $requestId,
        ]);

        catn8_json_response([
            'success' => true,
            'ok' => true,
            'message' => 'Plaid credentials are valid',
            'plaid_env' => $env,
            'request_id' => $requestId,
            'expiration' => $expiration,
        ]);
    } catch (Throwable $e) {
        $fail('settings.plaid.test', 500, 'Plaid test failed: ' . $e->getMessage(), ['env' => $env]);
    }
}

catn8_json_response(['success' => false, 'error' => 'Unknown action'], 400);
