<?php

declare(strict_types=1);

/**
 * Generate/rotate Fabric8 agent API token via live setup endpoint when local DB
 * is unavailable. Writes plaintext to ~/.local/state/catn8/fabric8/agent-api-token
 * (mode 600). Never prints the token value.
 *
 * Usage:
 *   php scripts/fabric8/generate_api_token.php
 *   # or:
 *   CATN8_ADMIN_TOKEN=... BASE_URL=https://catn8.us php scripts/fabric8/generate_api_token.php
 */

$root = dirname(__DIR__, 2);
$envLive = $root . '/.env.live';
$envLocal = $root . '/.env.local';
foreach ([$envLocal, $envLive] as $envFile) {
    if (!is_file($envFile)) {
        continue;
    }
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }
        [$k, $v] = explode('=', $line, 2);
        $k = trim($k);
        $v = trim($v, " \t\"'");
        if ($k !== '' && getenv($k) === false) {
            putenv("{$k}={$v}");
            $_ENV[$k] = $v;
        }
    }
}

$admin = trim((string)(getenv('CATN8_ADMIN_TOKEN') ?: ''));
$base = rtrim((string)(getenv('BASE_URL') ?: 'https://catn8.us'), '/');
if ($admin === '') {
    fwrite(STDERR, "CATN8_ADMIN_TOKEN not set\n");
    exit(2);
}

$url = $base . '/api/fabric8_setup.php';
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'X-Api-Key: ' . $admin,
        'Accept: application/json',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => '{}',
    CURLOPT_TIMEOUT => 60,
]);
$body = curl_exec($ch);
$code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
if (!is_string($body) || $body === '') {
    fwrite(STDERR, "HTTP failed: {$err}\n");
    exit(1);
}
$decoded = json_decode($body, true);
if ($code >= 400 || !is_array($decoded) || empty($decoded['success'])) {
    fwrite(STDERR, "Setup failed HTTP {$code}\n");
    exit(1);
}
$token = trim((string)(($decoded['tokens']['agent'] ?? '')));
if ($token === '') {
    fwrite(STDERR, "No agent token in response\n");
    exit(1);
}

$path = (string)(getenv('HOME') ?: '/tmp') . '/.local/state/catn8/fabric8/agent-api-token';
$dir = dirname($path);
if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
    fwrite(STDERR, "Failed to create token directory\n");
    exit(1);
}
if (file_put_contents($path, $token . "\n") === false) {
    fwrite(STDERR, "Failed to write token file\n");
    exit(1);
}
chmod($path, 0600);

echo "Fabric8 agent API token rotated.\n";
echo "Token hash stored under secrets key: fabric8.agent.api_token_hash\n";
echo "Token file written (mode 600): {$path}\n";
echo "Token value intentionally not printed.\n";
echo "Reminders sync enabled flag on server response: "
    . (!empty($decoded['reminders_sync_enabled']) ? 'true' : 'false') . "\n";
