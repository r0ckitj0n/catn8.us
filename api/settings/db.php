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

if ($action === 'get') {
    $devCfg = function_exists('catn8_get_db_config') ? catn8_get_db_config('local') : [];
    $liveCfg = function_exists('catn8_get_db_config') ? catn8_get_db_config('live') : [];
    $activeProfile = catn8_is_local_request() ? 'dev' : 'live';

    $outDev = [
        'host' => (string)($devCfg['host'] ?? ''),
        'db' => (string)($devCfg['db'] ?? ''),
        'user' => (string)($devCfg['user'] ?? ''),
        'port' => (int)($devCfg['port'] ?? 3306),
        'socket' => (string)($devCfg['socket'] ?? ''),
    ];
    $outLive = [
        'host' => (string)($liveCfg['host'] ?? ''),
        'db' => (string)($liveCfg['db'] ?? ''),
        'user' => (string)($liveCfg['user'] ?? ''),
        'port' => (int)($liveCfg['port'] ?? 3306),
        'socket' => (string)($liveCfg['socket'] ?? ''),
    ];

    catn8_json_response([
        'success' => true,
        'source' => 'env',
        'active_profile' => $activeProfile,
        'profiles' => [
            'dev' => $outDev,
            'live' => $outLive,
        ],
    ]);
}

if ($action === 'test') {
    catn8_require_method('POST');

    $body = catn8_read_json_body();
    $host = trim((string)($body['host'] ?? ''));
    $db = trim((string)($body['db'] ?? ''));
    $user = trim((string)($body['user'] ?? ''));
    $pass = (string)($body['pass'] ?? '');
    $port = (int)($body['port'] ?? 3306);
    $socket = trim((string)($body['socket'] ?? ''));

    if ($host === '' && $socket === '') {
        $fail('settings.db.test', 400, 'Host or socket is required');
    }
    if ($db === '') {
        $fail('settings.db.test', 400, 'Database name is required');
    }
    if ($user === '') {
        $fail('settings.db.test', 400, 'Database user is required');
    }

    try {
        $pdo = Database::createConnection($host, $db, $user, $pass, $port, $socket !== '' ? $socket : null);
        $stmt = $pdo->query('SELECT 1');
        $ok = (bool)$stmt;
        if (!$ok) {
            $fail('settings.db.test', 500, 'Connection test failed');
        }

        catn8_json_response([
            'success' => true,
            'message' => 'Connection successful',
            'active_profile' => catn8_is_local_request() ? 'dev' : 'live',
        ]);
    } catch (Throwable $e) {
        $fail('settings.db.test', 400, (string)$e->getMessage());
    }
}

if ($action === 'save') {
    catn8_require_method('POST');

    if (!catn8_is_local_request()) {
        $fail('settings.db.save', 403, 'Saving DB config is only allowed on local requests');
    }

    $envLocalPath = dirname(__DIR__, 2) . '/.env.local';

    $body = catn8_read_json_body();
    $profile = trim((string)($body['profile'] ?? ''));
    $cfg = is_array($body['cfg'] ?? null) ? $body['cfg'] : [];

    if ($profile !== 'dev' && $profile !== 'live') {
        $fail('settings.db.save', 400, 'Invalid profile');
    }

    $host = trim((string)($cfg['host'] ?? ''));
    $db = trim((string)($cfg['db'] ?? ''));
    $user = trim((string)($cfg['user'] ?? ''));
    $pass = (string)($cfg['pass'] ?? '');
    $port = (int)($cfg['port'] ?? 3306);
    $socket = trim((string)($cfg['socket'] ?? ''));

    if ($host === '' && $socket === '') {
        $fail('settings.db.save', 400, 'Host or socket is required');
    }
    if ($db === '') {
        $fail('settings.db.save', 400, 'Database name is required');
    }
    if ($user === '') {
        $fail('settings.db.save', 400, 'Database user is required');
    }
    if ($port <= 0) {
        $fail('settings.db.save', 400, 'Port must be a positive integer');
    }

    $prefix = $profile === 'dev' ? 'CATN8_DB_LOCAL_' : 'CATN8_DB_LIVE_';
    $updates = [
        $prefix . 'HOST' => $host,
        $prefix . 'NAME' => $db,
        $prefix . 'USER' => $user,
        $prefix . 'PASS' => $pass,
        $prefix . 'PORT' => (string)$port,
        $prefix . 'SOCKET' => $socket,
    ];

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

        catn8_diagnostics_log_event('settings.db.save', true, 200, 'DB config saved', [
            'profile' => $profile,
            'path' => $envLocalPath,
        ]);

        catn8_json_response([
            'success' => true,
            'message' => 'Saved to .env.local',
            'profile' => $profile,
        ]);
    } catch (Throwable $e) {
        $fail('settings.db.save', 500, (string)$e->getMessage());
    }
}

catn8_json_response(['success' => false, 'error' => 'Unknown action'], 400);
