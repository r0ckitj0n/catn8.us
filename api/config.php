<?php

declare(strict_types=1);

$rootDir = dirname(__DIR__);

if (!function_exists('catn8_load_env')) {
    function catn8_load_env(string $path): void
    {
        if (!is_file($path) || !is_readable($path)) {
            return;
        }

        foreach (file($path) as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) {
                continue;
            }

            [$k, $v] = array_map('trim', explode('=', $line, 2));
            $len = strlen($v);
            if ($len >= 2) {
                $first = $v[0];
                $last = $v[$len - 1];
                if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
                    $v = substr($v, 1, -1);
                }
            }

            putenv("{$k}={$v}");
            $_ENV[$k] = $v;
            $_SERVER[$k] = $v;
        }
    }
}

if (!function_exists('catn8_env')) {
    function catn8_env(string $key, $default = null)
    {
        $val = getenv($key);
        return $val !== false ? $val : $default;
    }
}

$envLocal = $rootDir . '/.env.local';
$env = $rootDir . '/.env';
if (is_readable($envLocal)) {
    catn8_load_env($envLocal);
}
if (is_readable($env)) {
    catn8_load_env($env);
}

require_once $rootDir . '/includes/database.php';

$hostHeader = (string)($_SERVER['HTTP_HOST'] ?? '');
$isLocal = (PHP_SAPI === 'cli')
    || (PHP_SAPI === 'cli-server')
    || stripos($hostHeader, 'localhost') !== false
    || stripos($hostHeader, '127.0.0.1') !== false
    || stripos($hostHeader, '192.168.') !== false;

if (!function_exists('catn8_is_local_request')) {
    function catn8_is_local_request(): bool
    {
        global $isLocal;
        return (bool)$isLocal;
    }
}

$localDbName = (string) catn8_env('CATN8_DB_LOCAL_NAME', catn8_env('CATN8_DB_LOCAL_DB', 'catn8'));
$CATN8_DB_CONFIGS = [
    'local' => [
        'host' => (string) catn8_env('CATN8_DB_LOCAL_HOST', '127.0.0.1'),
        'db' => $localDbName,
        'user' => (string) catn8_env('CATN8_DB_LOCAL_USER', 'root'),
        'pass' => (string) catn8_env('CATN8_DB_LOCAL_PASS', ''),
        'port' => (int) catn8_env('CATN8_DB_LOCAL_PORT', 3306),
        'socket' => (string) catn8_env('CATN8_DB_LOCAL_SOCKET', ''),
    ],
    'live' => [
        'host' => (string) catn8_env('CATN8_DB_LIVE_HOST', ''),
        'db' => (string) catn8_env('CATN8_DB_LIVE_NAME', ''),
        'user' => (string) catn8_env('CATN8_DB_LIVE_USER', ''),
        'pass' => (string) catn8_env('CATN8_DB_LIVE_PASS', ''),
        'port' => (int) catn8_env('CATN8_DB_LIVE_PORT', 3306),
        'socket' => (string) catn8_env('CATN8_DB_LIVE_SOCKET', ''),
    ],
];

$CATN8_DB_CONFIGS['current'] = $isLocal ? $CATN8_DB_CONFIGS['local'] : $CATN8_DB_CONFIGS['live'];

if (!function_exists('catn8_get_db_config')) {
    function catn8_get_db_config(string $env = 'current'): array
    {
        global $CATN8_DB_CONFIGS;
        return $CATN8_DB_CONFIGS[$env] ?? $CATN8_DB_CONFIGS['current'];
    }
}
