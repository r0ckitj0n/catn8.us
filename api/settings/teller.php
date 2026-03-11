<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../includes/diagnostics_log.php';

catn8_session_start();
catn8_require_admin();

$action = trim((string)($_GET['action'] ?? ''));

$allowedEnvs = ['sandbox', 'development', 'production'];
$keyApplicationId = catn8_secret_key('accumul8.teller.application_id');
$keyCertificate = catn8_secret_key('accumul8.teller.certificate');
$keyPrivateKey = catn8_secret_key('accumul8.teller.private_key');
$keyEnv = catn8_secret_key('accumul8.teller.env');

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

$normalizePem = static function ($value): string {
    $pem = trim((string)$value);
    return $pem === '' ? '' : str_replace(["\r\n", "\r"], "\n", $pem);
};

$readSettings = static function () use ($keyApplicationId, $keyCertificate, $keyPrivateKey, $keyEnv, $normalizeEnv, $normalizePem): array {
    $applicationId = trim((string)(secret_get($keyApplicationId) ?? getenv('TELLER_APPLICATION_ID') ?? ''));
    $certificate = $normalizePem(secret_get($keyCertificate) ?? getenv('TELLER_CERTIFICATE_PEM') ?? '');
    $privateKey = $normalizePem(secret_get($keyPrivateKey) ?? getenv('TELLER_PRIVATE_KEY_PEM') ?? '');
    $env = $normalizeEnv(secret_get($keyEnv) ?? getenv('TELLER_ENV') ?? 'sandbox');

    return [
        'source' => 'secret_store',
        'config' => [
            'env' => $env,
            'application_id' => $applicationId,
        ],
        'status' => [
            'has_application_id' => $applicationId !== '',
            'has_certificate' => $certificate !== '',
            'has_private_key' => $privateKey !== '',
        ],
        'certificate' => $certificate,
        'private_key' => $privateKey,
    ];
};

$fail = static function (string $eventKey, int $status, string $error, array $meta = []): void {
    catn8_diagnostics_log_event($eventKey, false, $status, $error, $meta);
    catn8_json_response(['success' => false, 'error' => $error], $status);
};

$validatePemPair = static function (string $certificate, string $privateKey): void {
    $certResource = @openssl_x509_read($certificate);
    if ($certResource === false) {
        throw new RuntimeException('Certificate is not valid PEM');
    }
    $keyResource = @openssl_pkey_get_private($privateKey);
    if ($keyResource === false) {
        throw new RuntimeException('Private key is not valid PEM');
    }
    if (!@openssl_x509_check_private_key($certResource, $keyResource)) {
        throw new RuntimeException('Certificate and private key do not match');
    }
};

$probeTellerApi = static function (string $applicationId, string $certificate, string $privateKey): void {
    $certFile = tempnam(sys_get_temp_dir(), 'catn8_teller_cert_');
    $keyFile = tempnam(sys_get_temp_dir(), 'catn8_teller_key_');
    if ($certFile === false || $keyFile === false) {
        throw new RuntimeException('Failed to create temporary files for Teller credential test');
    }

    try {
        file_put_contents($certFile, $certificate);
        file_put_contents($keyFile, $privateKey);

        $ch = curl_init('https://api.teller.io/accounts');
        if ($ch === false) {
            throw new RuntimeException('Failed to init curl');
        }

        curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
        curl_setopt($ch, CURLOPT_USERPWD, $applicationId . ':credential-test');
        curl_setopt($ch, CURLOPT_SSLCERT, $certFile);
        curl_setopt($ch, CURLOPT_SSLKEY, $keyFile);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
        curl_setopt($ch, CURLOPT_TIMEOUT, 20);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json']);

        $raw = curl_exec($ch);
        $err = curl_error($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($raw === false) {
          throw new RuntimeException('Teller API probe failed: ' . ($err !== '' ? $err : 'unknown error'));
        }

        if ($status === 0) {
            throw new RuntimeException('Teller API probe did not receive an HTTP response');
        }
    } finally {
        @unlink($certFile);
        @unlink($keyFile);
    }
};

$requestOrigin = static function (): string {
    $forwardedProto = strtolower(trim((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')));
    $https = strtolower(trim((string)($_SERVER['HTTPS'] ?? '')));
    $scheme = ($forwardedProto === 'https' || ($forwardedProto === '' && $https !== '' && $https !== 'off'))
        ? 'https'
        : 'http';
    $host = trim((string)($_SERVER['HTTP_HOST'] ?? ''));
    if ($host === '') {
        throw new RuntimeException('Unable to determine the current site origin for Teller Connect validation');
    }
    return $scheme . '://' . $host;
};

$buildConnectProbeQuery = static function (array $params): string {
    $parts = [];
    foreach ($params as $key => $value) {
        if (is_array($value)) {
            foreach ($value as $item) {
                if ($item === null || $item === '') {
                    continue;
                }
                $parts[] = rawurlencode((string)$key) . '[]=' . rawurlencode((string)$item);
            }
            continue;
        }
        if ($value === null || $value === '') {
            continue;
        }
        if (is_bool($value)) {
            $value = $value ? 'true' : 'false';
        }
        $parts[] = rawurlencode((string)$key) . '=' . rawurlencode((string)$value);
    }
    return implode('&', $parts);
};

$probeTellerConnect = static function (string $applicationId, string $env, string $origin) use ($buildConnectProbeQuery): void {
    $query = $buildConnectProbeQuery([
        'origin' => $origin,
        'environment' => $env,
        'products' => ['transactions', 'balance'],
        'skip_picker' => false,
        'loader_id' => 'settings_test_' . bin2hex(random_bytes(8)),
    ]);
    $url = 'https://teller.io/connect/' . rawurlencode($env) . '/' . rawurlencode($applicationId) . '?' . $query;

    $ch = curl_init($url);
    if ($ch === false) {
        throw new RuntimeException('Failed to init curl for Teller Connect validation');
    }

    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 3);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent: catn8-teller-settings-test/1.0',
    ]);

    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if (!is_string($raw)) {
        throw new RuntimeException('Teller Connect probe failed: ' . ($err !== '' ? $err : 'unknown error'));
    }

    if ($status < 200 || $status >= 300) {
        $summary = trim((string)preg_replace('/\s+/', ' ', strip_tags(substr($raw, 0, 400))));
        $message = 'Teller Connect rejected the application ID/origin/environment (HTTP ' . $status . ')';
        if ($summary !== '') {
            $message .= ': ' . $summary;
        }
        throw new RuntimeException($message);
    }
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
    $applicationId = trim((string)($body['application_id'] ?? ''));
    $certificate = $normalizePem($body['certificate'] ?? '');
    $privateKey = $normalizePem($body['private_key'] ?? '');

    if ($applicationId !== '' && strlen($applicationId) > 191) {
        $fail('settings.teller.save', 400, 'application_id must be 191 characters or fewer');
    }
    if ($certificate !== '' && strlen($certificate) > 20000) {
        $fail('settings.teller.save', 400, 'certificate must be 20000 characters or fewer');
    }
    if ($privateKey !== '' && strlen($privateKey) > 20000) {
        $fail('settings.teller.save', 400, 'private_key must be 20000 characters or fewer');
    }

    if (!secret_set($keyEnv, $env)) {
        $fail('settings.teller.save', 500, 'Failed to save Teller environment', ['env' => $env]);
    }
    if ($applicationId !== '' && !secret_set($keyApplicationId, $applicationId)) {
        $fail('settings.teller.save', 500, 'Failed to save Teller application_id', ['env' => $env]);
    }
    if ($certificate !== '' && !secret_set($keyCertificate, $certificate)) {
        $fail('settings.teller.save', 500, 'Failed to save Teller certificate', ['env' => $env]);
    }
    if ($privateKey !== '' && !secret_set($keyPrivateKey, $privateKey)) {
        $fail('settings.teller.save', 500, 'Failed to save Teller private_key', ['env' => $env]);
    }

    $s = $readSettings();
    catn8_diagnostics_log_event('settings.teller.save', true, 200, 'Teller settings saved', [
        'env' => $env,
        'application_id_updated' => $applicationId !== '' ? 1 : 0,
        'certificate_updated' => $certificate !== '' ? 1 : 0,
        'private_key_updated' => $privateKey !== '' ? 1 : 0,
    ]);

    catn8_json_response([
        'success' => true,
        'message' => 'Teller settings saved',
        'config' => $s['config'],
        'status' => $s['status'],
    ]);
}

if ($action === 'delete') {
    catn8_require_method('POST');
    $requireJsonContentType();

    $body = catn8_read_json_body();
    $field = trim((string)($body['field'] ?? ''));
    if (!in_array($field, ['application_id', 'certificate', 'private_key', 'all'], true)) {
        $fail('settings.teller.delete', 400, 'Invalid field; expected application_id, certificate, private_key, or all');
    }

    if (($field === 'application_id' || $field === 'all') && !secret_delete($keyApplicationId)) {
        $fail('settings.teller.delete', 500, 'Failed to delete application_id');
    }
    if (($field === 'certificate' || $field === 'all') && !secret_delete($keyCertificate)) {
        $fail('settings.teller.delete', 500, 'Failed to delete certificate');
    }
    if (($field === 'private_key' || $field === 'all') && !secret_delete($keyPrivateKey)) {
        $fail('settings.teller.delete', 500, 'Failed to delete private_key');
    }

    $s = $readSettings();
    catn8_diagnostics_log_event('settings.teller.delete', true, 200, 'Teller credential deleted', ['field' => $field]);

    catn8_json_response([
        'success' => true,
        'message' => 'Teller credential deleted',
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
    $applicationIdInput = trim((string)($body['application_id'] ?? ''));
    $certificateInput = $normalizePem($body['certificate'] ?? '');
    $privateKeyInput = $normalizePem($body['private_key'] ?? '');

    $applicationId = $applicationIdInput !== '' ? $applicationIdInput : trim((string)($settings['config']['application_id'] ?? ''));
    $certificate = $certificateInput !== '' ? $certificateInput : trim((string)($settings['certificate'] ?? ''));
    $privateKey = $privateKeyInput !== '' ? $privateKeyInput : trim((string)($settings['private_key'] ?? ''));

    if ($applicationId === '' || $certificate === '' || $privateKey === '') {
        $fail('settings.teller.test', 400, 'Application ID, certificate, and private key are required for testing', ['env' => $env]);
    }

    try {
        $validatePemPair($certificate, $privateKey);
        $probeTellerApi($applicationId, $certificate, $privateKey);
        $origin = $requestOrigin();
        $probeTellerConnect($applicationId, $env, $origin);

        $savedFromTest = 0;
        if ($applicationIdInput !== '' || $certificateInput !== '' || $privateKeyInput !== '') {
            if (!secret_set($keyEnv, $env)) {
                $fail('settings.teller.test', 500, 'Teller test succeeded but failed to save environment', ['env' => $env]);
            }
            if ($applicationIdInput !== '' && !secret_set($keyApplicationId, $applicationIdInput)) {
                $fail('settings.teller.test', 500, 'Teller test succeeded but failed to save application_id', ['env' => $env]);
            }
            if ($certificateInput !== '' && !secret_set($keyCertificate, $certificateInput)) {
                $fail('settings.teller.test', 500, 'Teller test succeeded but failed to save certificate', ['env' => $env]);
            }
            if ($privateKeyInput !== '' && !secret_set($keyPrivateKey, $privateKeyInput)) {
                $fail('settings.teller.test', 500, 'Teller test succeeded but failed to save private_key', ['env' => $env]);
            }
            $savedFromTest = 1;
        }

        catn8_diagnostics_log_event('settings.teller.test', true, 200, 'Teller test OK', [
            'env' => $env,
            'origin' => $origin,
            'saved_from_test' => $savedFromTest,
        ]);

        catn8_json_response([
            'success' => true,
            'ok' => true,
            'message' => $savedFromTest === 1
                ? 'Teller credentials and Connect application settings are valid and saved'
                : 'Teller credentials and Connect application settings are valid',
            'teller_env' => $env,
        ]);
    } catch (Throwable $e) {
        $fail('settings.teller.test', 500, 'Teller test failed: ' . $e->getMessage(), ['env' => $env]);
    }
}

catn8_json_response(['success' => false, 'error' => 'Unknown action'], 400);
