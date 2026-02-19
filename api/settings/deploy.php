<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../includes/diagnostics_log.php';

catn8_session_start();
catn8_require_admin();

$action = trim((string)($_GET['action'] ?? ''));

$fail = static function (string $eventKey, int $status, string $error, array $meta = []): void {
    catn8_diagnostics_log_event($eventKey, false, $status, $error, $meta);
    catn8_json_response(['success' => false, 'error' => $error], $status);
};

if ($action === 'test') {
    catn8_require_method('POST');

    if (!catn8_is_local_request()) {
        $fail('settings.deploy.test', 403, 'Testing deploy config is only allowed on local requests');
    }

    $body = catn8_read_json_body();
    $cfgIn = is_array($body['cfg'] ?? null) ? $body['cfg'] : [];
    $secretsIn = is_array($body['secrets'] ?? null) ? $body['secrets'] : [];

    $deployHost = trim((string)($cfgIn['deploy_host'] ?? (string)catn8_env('CATN8_DEPLOY_HOST', '')));
    $deployUser = trim((string)($cfgIn['deploy_user'] ?? (string)catn8_env('CATN8_DEPLOY_USER', '')));
    $deployBaseUrl = trim((string)($cfgIn['deploy_base_url'] ?? (string)catn8_env('CATN8_DEPLOY_BASE_URL', '')));
    $publicBase = trim((string)($cfgIn['public_base'] ?? (string)catn8_env('CATN8_PUBLIC_BASE', '')));

    $deployPass = (string)($secretsIn['deploy_pass'] ?? (string)catn8_env('CATN8_DEPLOY_PASS', ''));
    $adminToken = (string)($secretsIn['admin_token'] ?? (string)catn8_env('CATN8_ADMIN_TOKEN', ''));

    $checks = [];
    $add = static function (string $key, bool $ok, string $message, array $meta = []) use (&$checks): void {
        $checks[] = [
            'key' => $key,
            'ok' => $ok,
            'message' => $message,
            'meta' => (object)$meta,
        ];
    };

    $add('CATN8_DEPLOY_HOST', $deployHost !== '', $deployHost !== '' ? 'Set' : 'Missing');
    $add('CATN8_DEPLOY_USER', $deployUser !== '', $deployUser !== '' ? 'Set' : 'Missing');
    $add('CATN8_DEPLOY_PASS', $deployPass !== '', $deployPass !== '' ? 'Set' : 'Missing');
    $add('CATN8_ADMIN_TOKEN', $adminToken !== '', $adminToken !== '' ? 'Set' : 'Missing');

    $baseUrl = $deployBaseUrl !== '' ? $deployBaseUrl : 'https://catn8.us';
    $fullBase = rtrim($baseUrl, '/') . ($publicBase !== '' ? '/' . ltrim($publicBase, '/') : '');
    $validUrl = filter_var($fullBase, FILTER_VALIDATE_URL) !== false;
    $add('base_url_format', $validUrl, $validUrl ? 'OK' : 'Invalid URL', ['base_url' => $fullBase]);

    if ($validUrl) {
        $status = 0;
        $error = '';
        try {
            if (function_exists('curl_init')) {
                $ch = curl_init($fullBase);
                curl_setopt($ch, CURLOPT_NOBODY, true);
                curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
                curl_setopt($ch, CURLOPT_MAXREDIRS, 3);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 6);
                curl_exec($ch);
                $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $err = curl_error($ch);
                curl_close($ch);
                $error = is_string($err) ? $err : '';
            } else {
                $ctx = stream_context_create([
                    'http' => [
                        'method' => 'HEAD',
                        'timeout' => 6,
                        'follow_location' => 1,
                        'max_redirects' => 3,
                    ],
                ]);
                $fp = @fopen($fullBase, 'r', false, $ctx);
                if ($fp) {
                    fclose($fp);
                    $status = 200;
                }
            }
        } catch (Throwable $e) {
            $error = (string)$e->getMessage();
        }

        $ok = $status >= 200 && $status < 500;
        $add('http_reachability', $ok, $ok ? "HTTP reachable (${status})" : 'HTTP unreachable', ['status' => $status, 'error' => $error]);
    }

    if ($deployHost !== '') {
        $port = 22;
        $errno = 0;
        $errstr = '';
        $connOk = false;
        $t0 = microtime(true);
        $fp = @fsockopen($deployHost, $port, $errno, $errstr, 4.0);
        if (is_resource($fp)) {
            $connOk = true;
            fclose($fp);
        }
        $ms = (int)round((microtime(true) - $t0) * 1000);
        $add('sftp_port_22', $connOk, $connOk ? "TCP connect OK (${ms}ms)" : 'TCP connect failed', ['host' => $deployHost, 'port' => $port, 'errno' => $errno, 'error' => $errstr, 'ms' => $ms]);
    }

    $allOk = true;
    foreach ($checks as $c) {
        if (!($c['ok'] ?? false)) {
            $allOk = false;
            break;
        }
    }

    catn8_diagnostics_log_event('settings.deploy.test', $allOk, 200, $allOk ? 'Deploy config test OK' : 'Deploy config test failed', [
        'base_url' => $fullBase,
    ]);

    catn8_json_response([
        'success' => true,
        'ok' => $allOk,
        'checks' => $checks,
    ]);
}

if ($action === 'get') {
    $out = [
        'deploy_host' => (string)catn8_env('CATN8_DEPLOY_HOST', ''),
        'deploy_user' => (string)catn8_env('CATN8_DEPLOY_USER', ''),
        'deploy_base_url' => (string)catn8_env('CATN8_DEPLOY_BASE_URL', ''),
        'public_base' => (string)catn8_env('CATN8_PUBLIC_BASE', ''),
        'remote_sql_dir' => (string)catn8_env('CATN8_REMOTE_SQL_DIR', ''),
        'confirm_full_db_overwrite' => (string)catn8_env('CATN8_CONFIRM_FULL_DB_OVERWRITE', ''),
        'dry_run' => (string)catn8_env('CATN8_DRY_RUN', ''),
        'skip_release_build' => (string)catn8_env('CATN8_SKIP_RELEASE_BUILD', ''),
        'full_replace' => (string)catn8_env('CATN8_FULL_REPLACE', ''),
        'include_vendor' => (string)catn8_env('CATN8_INCLUDE_VENDOR', ''),
        'upload_live_env' => (string)catn8_env('CATN8_UPLOAD_LIVE_ENV', ''),
    ];

    catn8_json_response([
        'success' => true,
        'source' => 'env',
        'cfg' => $out,
        'secrets' => [
            'CATN8_DEPLOY_PASS_set' => ((string)catn8_env('CATN8_DEPLOY_PASS', '')) !== '',
            'CATN8_ADMIN_TOKEN_set' => ((string)catn8_env('CATN8_ADMIN_TOKEN', '')) !== '',
        ],
    ]);
}

if ($action === 'save') {
    catn8_require_method('POST');

    if (!catn8_is_local_request()) {
        $fail('settings.deploy.save', 403, 'Saving deploy config is only allowed on local requests');
    }

    $envLocalPath = dirname(__DIR__, 2) . '/.env.local';

    $body = catn8_read_json_body();
    $cfg = is_array($body['cfg'] ?? null) ? $body['cfg'] : [];
    $secrets = is_array($body['secrets'] ?? null) ? $body['secrets'] : [];

    $deployHost = trim((string)($cfg['deploy_host'] ?? ''));
    $deployUser = trim((string)($cfg['deploy_user'] ?? ''));
    $deployBaseUrl = trim((string)($cfg['deploy_base_url'] ?? ''));
    $publicBase = trim((string)($cfg['public_base'] ?? ''));
    $remoteSqlDir = trim((string)($cfg['remote_sql_dir'] ?? ''));

    $confirmFullDbOverwrite = trim((string)($cfg['confirm_full_db_overwrite'] ?? ''));
    $dryRun = trim((string)($cfg['dry_run'] ?? ''));
    $skipReleaseBuild = trim((string)($cfg['skip_release_build'] ?? ''));
    $fullReplace = trim((string)($cfg['full_replace'] ?? ''));
    $includeVendor = trim((string)($cfg['include_vendor'] ?? ''));
    $uploadLiveEnv = trim((string)($cfg['upload_live_env'] ?? ''));

    $deployPass = (string)($secrets['deploy_pass'] ?? '');
    $adminToken = (string)($secrets['admin_token'] ?? '');

    if ($deployHost === '') {
        $fail('settings.deploy.save', 400, 'Deploy host is required');
    }
    if ($deployUser === '') {
        $fail('settings.deploy.save', 400, 'Deploy user is required');
    }

    $updates = [
        'CATN8_DEPLOY_HOST' => $deployHost,
        'CATN8_DEPLOY_USER' => $deployUser,
        'CATN8_DEPLOY_BASE_URL' => $deployBaseUrl,
        'CATN8_PUBLIC_BASE' => $publicBase,
        'CATN8_REMOTE_SQL_DIR' => $remoteSqlDir,
        'CATN8_CONFIRM_FULL_DB_OVERWRITE' => $confirmFullDbOverwrite,
        'CATN8_DRY_RUN' => $dryRun,
        'CATN8_SKIP_RELEASE_BUILD' => $skipReleaseBuild,
        'CATN8_FULL_REPLACE' => $fullReplace,
        'CATN8_INCLUDE_VENDOR' => $includeVendor,
        'CATN8_UPLOAD_LIVE_ENV' => $uploadLiveEnv,
    ];

    if ($deployPass !== '') {
        $updates['CATN8_DEPLOY_PASS'] = $deployPass;
    }
    if ($adminToken !== '') {
        $updates['CATN8_ADMIN_TOKEN'] = $adminToken;
    }

    $envQuote = static function (string $value): string {
        $value = str_replace("\r", '', $value);
        $value = str_replace("\n", '', $value);
        if ($value === '') return "''";
        if (preg_match('/^[A-Za-z0-9_\.\-\/]+$/', $value)) {
            return $value;
        }
        return "'" . str_replace("'", "\\'", $value) . "'";
    };

    $readEnvLines = static function (string $path): array {
        if (!is_file($path) || !is_readable($path)) {
            return [];
        }
        $lines = file($path);
        return is_array($lines) ? $lines : [];
    };

    $writeEnvLines = static function (string $path, array $lines): void {
        $out = implode('', $lines);
        if (file_put_contents($path, $out) === false) {
            throw new RuntimeException('Failed to write .env.local');
        }
    };

    $applyUpdatesToEnvLines = static function (array $lines, array $updates, callable $envQuoteFn): array {
        $seen = [];
        $out = [];

        foreach ($lines as $line) {
            $raw = is_string($line) ? $line : '';
            $trimmed = trim($raw);

            if ($trimmed === '' || $trimmed[0] === '#' || strpos($trimmed, '=') === false) {
                $out[] = $raw;
                continue;
            }

            [$k, $v] = array_map('trim', explode('=', $trimmed, 2));
            if ($k === '' || !array_key_exists($k, $updates)) {
                $out[] = $raw;
                continue;
            }

            $seen[$k] = true;
            $out[] = $k . '=' . $envQuoteFn((string)$updates[$k]) . "\n";
        }

        foreach ($updates as $k => $v) {
            if (isset($seen[$k])) continue;
            $out[] = $k . '=' . $envQuoteFn((string)$v) . "\n";
        }

        return $out;
    };

    try {
        $lines = $readEnvLines($envLocalPath);
        $nextLines = $applyUpdatesToEnvLines($lines, $updates, $envQuote);
        $writeEnvLines($envLocalPath, $nextLines);

        catn8_diagnostics_log_event('settings.deploy.save', true, 200, 'Deploy config saved', [
            'path' => $envLocalPath,
        ]);

        catn8_json_response([
            'success' => true,
            'message' => 'Saved to .env.local',
        ]);
    } catch (Throwable $e) {
        $fail('settings.deploy.save', 500, (string)$e->getMessage());
    }
}

$fail('settings.deploy', 400, 'Unknown action');
