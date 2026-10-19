<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../includes/diagnostics_log.php';

catn8_session_start();
catn8_require_admin();

$action = trim((string)($_GET['action'] ?? ''));

$allowedEnvs = ['sandbox', 'production'];
$keyClientId = catn8_secret_key('accumul8.plaid.client_id');
$keySecret = catn8_secret_key('accumul8.plaid.secret');
$keyEnv = catn8_secret_key('accumul8.plaid.env');
$keyProducts = catn8_secret_key('accumul8.plaid.products');
$keyCountryCodes = catn8_secret_key('accumul8.plaid.country_codes');
$keyRedirectUri = catn8_secret_key('accumul8.plaid.redirect_uri');

$normalizeEnv = static function ($value) use ($allowedEnvs): string {
    $env = strtolower(trim((string)$value));
    if (!in_array($env, $allowedEnvs, true)) {
        $env = 'sandbox';
    }
    return $env;
};

$normalizeCsv = static function ($value, string $fallback): string {
    $raw = trim((string)$value);
    if ($raw === '') {
        return $fallback;
    }
    $parts = array_values(array_filter(array_map(static function ($part): string {
        return trim($part);
    }, explode(',', $raw))));
    return $parts === [] ? $fallback : implode(',', $parts);
};

$requireJsonContentType = static function (): void {
    $contentType = strtolower(trim((string)($_SERVER['CONTENT_TYPE'] ?? '')));
    if ($contentType === '' || strpos($contentType, 'application/json') !== 0) {
        catn8_json_response(['success' => false, 'error' => 'Unsupported content type; expected application/json'], 415);
    }
};

$readSettings = static function () use (
    $keyClientId,
    $keySecret,
    $keyEnv,
    $keyProducts,
    $keyCountryCodes,
    $keyRedirectUri,
    $normalizeEnv,
    $normalizeCsv
): array {
    $clientId = trim((string)(secret_get($keyClientId) ?? getenv('PLAID_CLIENT_ID') ?? ''));
    $secret = trim((string)(secret_get($keySecret) ?? getenv('PLAID_SECRET') ?? ''));
    $env = $normalizeEnv(secret_get($keyEnv) ?? getenv('PLAID_ENV') ?? 'sandbox');
    $products = $normalizeCsv(secret_get($keyProducts) ?? getenv('PLAID_PRODUCTS') ?? 'transactions', 'transactions');
    $countryCodes = $normalizeCsv(secret_get($keyCountryCodes) ?? getenv('PLAID_COUNTRY_CODES') ?? 'US', 'US');
    $redirectUri = trim((string)(secret_get($keyRedirectUri) ?? getenv('PLAID_REDIRECT_URI') ?? ''));

    return [
        'source' => 'secret_store',
        'config' => [
            'env' => $env,
            'client_id' => $clientId,
            'products' => $products,
            'country_codes' => $countryCodes,
            'redirect_uri' => $redirectUri,
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
    $products = $normalizeCsv($body['products'] ?? 'transactions', 'transactions');
    $countryCodes = $normalizeCsv($body['country_codes'] ?? 'US', 'US');
    $redirectUri = trim((string)($body['redirect_uri'] ?? ''));

    if (strlen($clientId) > 191) {
        $fail('settings.plaid.save', 400, 'client_id must be 191 characters or fewer');
    }
    if (strlen($secret) > 191) {
        $fail('settings.plaid.save', 400, 'secret must be 191 characters or fewer');
    }
    if (strlen($products) > 191) {
        $fail('settings.plaid.save', 400, 'products must be 191 characters or fewer');
    }
    if (strlen($countryCodes) > 64) {
        $fail('settings.plaid.save', 400, 'country_codes must be 64 characters or fewer');
    }
    if (strlen($redirectUri) > 255) {
        $fail('settings.plaid.save', 400, 'redirect_uri must be 255 characters or fewer');
    }
    if ($redirectUri !== '' && !preg_match('#^https://#i', $redirectUri)) {
        $fail('settings.plaid.save', 400, 'redirect_uri must be an https URL');
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
    if (!secret_set($keyProducts, $products)) {
        $fail('settings.plaid.save', 500, 'Failed to save Plaid products', ['env' => $env]);
    }
    if (!secret_set($keyCountryCodes, $countryCodes)) {
        $fail('settings.plaid.save', 500, 'Failed to save Plaid country_codes', ['env' => $env]);
    }
    if ($redirectUri !== '' && !secret_set($keyRedirectUri, $redirectUri)) {
        $fail('settings.plaid.save', 500, 'Failed to save Plaid redirect_uri', ['env' => $env]);
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

    if (($field === 'client_id' || $field === 'all') && !secret_delete($keyClientId)) {
        $fail('settings.plaid.delete', 500, 'Failed to delete client_id');
    }
    if (($field === 'secret' || $field === 'all') && !secret_delete($keySecret)) {
        $fail('settings.plaid.delete', 500, 'Failed to delete secret');
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
        $fail('settings.plaid.test', 400, 'Client ID and secret are required for testing', ['env' => $env]);
    }

    $host = $env === 'production' ? 'https://production.plaid.com' : 'https://sandbox.plaid.com';
    $payload = json_encode([
        'client_id' => $clientId,
        'secret' => $secret,
        'count' => 1,
        'offset' => 0,
        'country_codes' => ['US'],
    ], JSON_UNESCAPED_SLASHES);
    if (!is_string($payload)) {
        $fail('settings.plaid.test', 500, 'Failed to encode Plaid test payload', ['env' => $env]);
    }

    $ch = curl_init($host . '/institutions/get');
    if ($ch === false) {
        $fail('settings.plaid.test', 500, 'Failed to init curl for Plaid test', ['env' => $env]);
    }
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Accept: application/json',
        'Plaid-Version: 2020-09-14',
    ]);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false) {
        $fail('settings.plaid.test', 500, 'Plaid test failed: ' . ($err !== '' ? $err : 'unknown error'), ['env' => $env]);
    }
    $decoded = json_decode((string)$raw, true);
    if ($status < 200 || $status >= 300) {
        $message = is_array($decoded)
            ? (string)($decoded['error_message'] ?? $decoded['error_code'] ?? ('HTTP ' . $status))
            : ('HTTP ' . $status);
        $fail('settings.plaid.test', 500, 'Plaid test failed: ' . $message, ['env' => $env]);
    }

    $savedFromTest = 0;
    if ($clientIdInput !== '' || $secretInput !== '') {
        if (!secret_set($keyEnv, $env)) {
            $fail('settings.plaid.test', 500, 'Plaid test succeeded but failed to save environment', ['env' => $env]);
        }
        if ($clientIdInput !== '' && !secret_set($keyClientId, $clientIdInput)) {
            $fail('settings.plaid.test', 500, 'Plaid test succeeded but failed to save client_id', ['env' => $env]);
        }
        if ($secretInput !== '' && !secret_set($keySecret, $secretInput)) {
            $fail('settings.plaid.test', 500, 'Plaid test succeeded but failed to save secret', ['env' => $env]);
        }
        $savedFromTest = 1;
    }

    catn8_diagnostics_log_event('settings.plaid.test', true, 200, 'Plaid test OK', [
        'env' => $env,
        'saved_from_test' => $savedFromTest,
    ]);

    catn8_json_response([
        'success' => true,
        'ok' => true,
        'message' => $savedFromTest === 1
            ? 'Plaid credentials were validated and saved. Use Connect Bank via Plaid to complete Link.'
            : 'Plaid credentials were validated. Use Connect Bank via Plaid to complete Link.',
        'plaid_env' => $env,
    ]);
}

catn8_json_response(['success' => false, 'error' => 'Unknown action'], 400);
