#!/usr/bin/env php
<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Run from CLI only.\n");
    exit(1);
}

$root = dirname(__DIR__, 2);
require_once $root . '/api/config.php';
require_once $root . '/includes/database.php';

function secure_import_usage(): void
{
    $msg = <<<TXT
Usage: php scripts/secrets/import_secure_backup_to_local.php --file=/path/to/live-secure-backup.json --passphrase="..."

Decrypts an exported live secure backup and overwrites the local database, local secrets table,
and local config/secret.key so local secret_get() uses the live secret store.
TXT;
    fwrite(STDOUT, $msg . "\n");
}

function secure_import_opt(array $argv, string $prefix, ?string $default = null): ?string
{
    foreach ($argv as $arg) {
        if (str_starts_with($arg, $prefix)) {
            return substr($arg, strlen($prefix));
        }
    }
    return $default;
}

function secure_import_open_stream(string $path): array
{
    if (preg_match('/\.gz$/i', $path)) {
        $h = gzopen($path, 'rb');
        return ['type' => 'gz', 'handle' => $h];
    }
    $h = fopen($path, 'rb');
    return ['type' => 'plain', 'handle' => $h];
}

function secure_import_read_chunk(array $stream, int $len): string
{
    $h = $stream['handle'] ?? null;
    if (!$h) return '';
    if (($stream['type'] ?? '') === 'gz') {
        $s = gzread($h, $len);
        return is_string($s) ? $s : '';
    }
    $s = fread($h, $len);
    return is_string($s) ? $s : '';
}

function secure_import_close_stream(array $stream): void
{
    $h = $stream['handle'] ?? null;
    if (!$h) return;
    if (($stream['type'] ?? '') === 'gz') {
        @gzclose($h);
        return;
    }
    @fclose($h);
}

function secure_import_stream_sql(PDO $pdo, array $stream): void
{
    $stmt = '';
    $inSingle = false;
    $inDouble = false;
    $inBacktick = false;
    $inLineComment = false;
    $inBlockComment = false;

    $execStmt = static function (PDO $pdo, string $sql): void {
        $sql = trim($sql);
        if ($sql === '') return;
        $pdo->exec($sql);
    };

    while (true) {
        $chunk = secure_import_read_chunk($stream, 1024 * 1024);
        if ($chunk === '') {
            break;
        }

        $len = strlen($chunk);
        for ($i = 0; $i < $len; $i++) {
            $c = $chunk[$i];
            $n = $i + 1 < $len ? $chunk[$i + 1] : '';

            if ($inLineComment) {
                if ($c === "\n") {
                    $inLineComment = false;
                }
                $stmt .= $c;
                continue;
            }
            if ($inBlockComment) {
                if ($c === '*' && $n === '/') {
                    $inBlockComment = false;
                    $stmt .= '*/';
                    $i++;
                    continue;
                }
                $stmt .= $c;
                continue;
            }
            if (!$inSingle && !$inDouble && !$inBacktick) {
                if ($c === '-' && $n === '-') {
                    $inLineComment = true;
                    $stmt .= $c;
                    continue;
                }
                if ($c === '#') {
                    $inLineComment = true;
                    $stmt .= $c;
                    continue;
                }
                if ($c === '/' && $n === '*') {
                    $inBlockComment = true;
                    $stmt .= '/*';
                    $i++;
                    continue;
                }
            }
            if ($c === "'" && !$inDouble && !$inBacktick) {
                $prev = $i > 0 ? $chunk[$i - 1] : '';
                if ($prev !== '\\') {
                    $inSingle = !$inSingle;
                }
                $stmt .= $c;
                continue;
            }
            if ($c === '"' && !$inSingle && !$inBacktick) {
                $prev = $i > 0 ? $chunk[$i - 1] : '';
                if ($prev !== '\\') {
                    $inDouble = !$inDouble;
                }
                $stmt .= $c;
                continue;
            }
            if ($c === '`' && !$inSingle && !$inDouble) {
                $inBacktick = !$inBacktick;
                $stmt .= $c;
                continue;
            }
            if ($c === ';' && !$inSingle && !$inDouble && !$inBacktick) {
                $stmt .= $c;
                $execStmt($pdo, $stmt);
                $stmt = '';
                continue;
            }
            $stmt .= $c;
        }
    }

    if (trim($stmt) !== '') {
        $execStmt($pdo, $stmt);
    }
}

$argvList = $argv;
if (in_array('--help', $argvList, true) || in_array('-h', $argvList, true)) {
    secure_import_usage();
    exit(0);
}

$filePath = (string)(secure_import_opt($argvList, '--file=', '') ?? '');
$passphrase = (string)(secure_import_opt($argvList, '--passphrase=', (string)catn8_env('CATN8_SECURE_BACKUP_PASSPHRASE', '')) ?? '');
if ($filePath === '' || strlen($passphrase) < 12) {
    secure_import_usage();
    fwrite(STDERR, "Missing --file or strong passphrase.\n");
    exit(2);
}
if (!is_file($filePath)) {
    fwrite(STDERR, "Backup file not found: {$filePath}\n");
    exit(1);
}

$raw = file_get_contents($filePath);
if (!is_string($raw) || $raw === '') {
    fwrite(STDERR, "Failed to read backup file.\n");
    exit(1);
}

$outer = json_decode($raw, true);
if (!is_array($outer) || !is_array($outer['encrypted_payload'] ?? null)) {
    fwrite(STDERR, "Backup file is not a valid secure backup export.\n");
    exit(1);
}
$enc = $outer['encrypted_payload'];

$salt = base64_decode((string)($enc['salt_b64'] ?? ''), true);
$iv = base64_decode((string)($enc['iv_b64'] ?? ''), true);
$tag = base64_decode((string)($enc['tag_b64'] ?? ''), true);
$ciphertext = base64_decode((string)($enc['ciphertext_b64'] ?? ''), true);
$iterations = (int)($enc['iterations'] ?? 0);
if (!is_string($salt) || !is_string($iv) || !is_string($tag) || !is_string($ciphertext) || $iterations <= 0) {
    fwrite(STDERR, "Backup file encryption metadata is invalid.\n");
    exit(1);
}

$key = hash_pbkdf2('sha256', $passphrase, $salt, $iterations, 32, true);
$plaintext = openssl_decrypt($ciphertext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
if (!is_string($plaintext) || $plaintext === '') {
    fwrite(STDERR, "Failed to decrypt backup. Check the passphrase.\n");
    exit(1);
}

$payload = json_decode($plaintext, true);
if (!is_array($payload)) {
    fwrite(STDERR, "Decrypted backup payload is invalid JSON.\n");
    exit(1);
}

$stateDir = $root . '/.local/state/secure-backups/import_' . date('Ymd_His');
if (!is_dir($stateDir) && !mkdir($stateDir, 0777, true) && !is_dir($stateDir)) {
    fwrite(STDERR, "Failed to create state directory.\n");
    exit(1);
}
file_put_contents($stateDir . '/manifest.json', json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

if (is_array($payload['database_backup'] ?? null)) {
    $sqlGz = base64_decode((string)($payload['database_backup']['sql_gz_b64'] ?? ''), true);
    if (!is_string($sqlGz) || $sqlGz === '') {
        fwrite(STDERR, "Database backup payload is missing.\n");
        exit(1);
    }
    $sqlPath = $stateDir . '/database.sql.gz';
    file_put_contents($sqlPath, $sqlGz);

    $pdo = Database::getInstance();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('SET FOREIGN_KEY_CHECKS=0');
    $stream = secure_import_open_stream($sqlPath);
    if (!($stream['handle'] ?? null)) {
        fwrite(STDERR, "Failed to open SQL stream.\n");
        exit(1);
    }
    secure_import_stream_sql($pdo, $stream);
    secure_import_close_stream($stream);
    $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
}

if (is_array($payload['secret_store_backup'] ?? null)) {
    $secretKey = base64_decode((string)($payload['secret_store_backup']['secret_key_b64'] ?? ''), true);
    if (!is_string($secretKey) || $secretKey === '') {
        fwrite(STDERR, "Secret key payload is missing.\n");
        exit(1);
    }
    $secretKeyPath = $root . '/config/secret.key';
    if (!is_dir(dirname($secretKeyPath))) {
        mkdir(dirname($secretKeyPath), 0700, true);
    }
    file_put_contents($secretKeyPath, $secretKey);
    @chmod($secretKeyPath, 0600);
}

fwrite(STDOUT, "Imported secure backup into local environment.\n");
fwrite(STDOUT, "Artifacts saved under {$stateDir}\n");
