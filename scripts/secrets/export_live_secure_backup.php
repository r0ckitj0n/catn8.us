#!/usr/bin/env php
<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Run from CLI only.\n");
    exit(1);
}

$root = dirname(__DIR__, 2);
require_once $root . '/api/config.php';

function secure_backup_usage(): void
{
    $msg = <<<TXT
Usage: php scripts/secrets/export_live_secure_backup.php --passphrase="..." [--base-url=https://catn8.us] [--secret-store-only|--database-only]

Downloads an encrypted live backup that includes:
- the full live database dump
- the live secrets table
- the live config/secret.key

Environment fallbacks:
- CATN8_DEPLOY_BASE_URL or CATN8_BASE_URL for --base-url
- CATN8_ADMIN_TOKEN for admin access
- CATN8_SECURE_BACKUP_PASSPHRASE for --passphrase
TXT;
    fwrite(STDOUT, $msg . "\n");
}

function secure_backup_opt(array $argv, string $prefix, ?string $default = null): ?string
{
    foreach ($argv as $arg) {
        if (str_starts_with($arg, $prefix)) {
            return substr($arg, strlen($prefix));
        }
    }
    return $default;
}

$argvList = $argv;
$passphrase = (string)(secure_backup_opt($argvList, '--passphrase=', (string)catn8_env('CATN8_SECURE_BACKUP_PASSPHRASE', '')) ?? '');
if (in_array('--help', $argvList, true) || in_array('-h', $argvList, true)) {
    secure_backup_usage();
    exit(0);
}
if (strlen($passphrase) < 12) {
    secure_backup_usage();
    fwrite(STDERR, "Missing or weak passphrase. Use --passphrase or CATN8_SECURE_BACKUP_PASSPHRASE.\n");
    exit(2);
}
$secretStoreOnly = in_array('--secret-store-only', $argvList, true);
$databaseOnly = in_array('--database-only', $argvList, true);
if ($secretStoreOnly && $databaseOnly) {
    fwrite(STDERR, "Use either --secret-store-only or --database-only, not both.\n");
    exit(2);
}

$baseUrl = rtrim((string)(secure_backup_opt(
    $argvList,
    '--base-url=',
    (string)(catn8_env('CATN8_DEPLOY_BASE_URL', catn8_env('CATN8_BASE_URL', 'https://catn8.us')))
) ?? 'https://catn8.us'), '/');
$adminToken = trim((string)catn8_env('CATN8_ADMIN_TOKEN', ''));
if ($adminToken === '') {
    fwrite(STDERR, "Missing CATN8_ADMIN_TOKEN.\n");
    exit(2);
}

$outDir = $root . '/.local/state/secure-backups/' . date('Ymd_His');
if (!is_dir($outDir) && !mkdir($outDir, 0777, true) && !is_dir($outDir)) {
    fwrite(STDERR, "Failed to create output directory: {$outDir}\n");
    exit(1);
}

$url = $baseUrl . '/api/database_maintenance.php?action=export_secure_backup&admin_token=' . rawurlencode($adminToken);
$body = json_encode([
    'passphrase' => $passphrase,
    'include_database' => $secretStoreOnly ? 0 : 1,
    'include_secret_store' => $databaseOnly ? 0 : 1,
], JSON_UNESCAPED_SLASHES);
if (!is_string($body)) {
    fwrite(STDERR, "Failed to encode request body.\n");
    exit(1);
}

$responseHeaders = [];
$ch = curl_init($url);
if ($ch === false) {
    fwrite(STDERR, "Failed to initialize curl.\n");
    exit(1);
}

curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Accept: application/json',
    ],
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_CONNECTTIMEOUT => 15,
    CURLOPT_TIMEOUT => 300,
    CURLOPT_HEADERFUNCTION => static function ($ch, string $header) use (&$responseHeaders): int {
        $len = strlen($header);
        $parts = explode(':', $header, 2);
        if (count($parts) === 2) {
            $responseHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
        }
        return $len;
    },
]);

$raw = curl_exec($ch);
$error = curl_error($ch);
$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (!is_string($raw)) {
    fwrite(STDERR, "Secure backup export failed: " . ($error !== '' ? $error : 'unknown error') . "\n");
    exit(1);
}
if ($status < 200 || $status >= 300) {
    fwrite(STDERR, "Secure backup export failed with HTTP {$status}: {$raw}\n");
    exit(1);
}

$fileName = 'live-secure-backup.json';
$disposition = (string)($responseHeaders['content-disposition'] ?? '');
if (preg_match('/filename=\"?([^\";]+)\"?/i', $disposition, $m) === 1) {
    $candidate = trim((string)$m[1]);
    if ($candidate !== '') {
        $fileName = $candidate;
    }
}

$outPath = $outDir . '/' . $fileName;
if (file_put_contents($outPath, $raw) === false) {
    fwrite(STDERR, "Failed to write secure backup artifact.\n");
    exit(1);
}

fwrite(STDOUT, "Saved secure backup to {$outPath}\n");
