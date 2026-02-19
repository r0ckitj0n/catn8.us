<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/diagnostics_log.php';

@set_time_limit(0);

$fail = static function (string $eventKey, int $status, string $error, array $meta = []): void {
    catn8_diagnostics_log_event($eventKey, false, $status, $error, $meta);
    catn8_json_response(['success' => false, 'error' => $error], $status);
};

$expected = (string)catn8_env('CATN8_ADMIN_TOKEN', '');
$got = (string)($_GET['admin_token'] ?? '');
if ($expected === '' || $got === '' || !hash_equals($expected, $got)) {
    $fail('database_maintenance', 403, 'Invalid admin token');
}

$action = trim((string)($_GET['action'] ?? ''));
if ($action === '') {
    $fail('database_maintenance', 400, 'Missing action');
}

$rootDir = dirname(__DIR__);
$backupsDir = $rootDir . '/backups';
$uploadsDir = __DIR__ . '/uploads';

$ensureDir = static function (string $path): void {
    if (!is_dir($path)) {
        @mkdir($path, 0777, true);
    }
};

$ensureDir($backupsDir);
$ensureDir($uploadsDir);

if ($action === 'create_backup') {
    $ensureDir($backupsDir . '/sql');
    $ensureDir($backupsDir . '/website');
    catn8_json_response(['success' => true, 'message' => 'Backup directories ensured']);
}

$openInputStream = static function (string $path): array {
    if (!is_file($path) || !is_readable($path)) {
        return ['type' => 'none', 'handle' => null];
    }
    if (str_ends_with($path, '.gz')) {
        $h = gzopen($path, 'rb');
        return ['type' => 'gz', 'handle' => $h];
    }
    $h = fopen($path, 'rb');
    return ['type' => 'plain', 'handle' => $h];
};

$readChunk = static function (array $stream, int $len): string {
    $h = $stream['handle'] ?? null;
    if (!$h) return '';
    if (($stream['type'] ?? '') === 'gz') {
        $s = gzread($h, $len);
        return is_string($s) ? $s : '';
    }
    $s = fread($h, $len);
    return is_string($s) ? $s : '';
};

$closeStream = static function (array $stream): void {
    $h = $stream['handle'] ?? null;
    if (!$h) return;
    if (($stream['type'] ?? '') === 'gz') {
        @gzclose($h);
        return;
    }
    @fclose($h);
};

$streamSqlIntoPdo = static function (PDO $pdo, array $stream) use ($readChunk): void {
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
        $chunk = $readChunk($stream, 1024 * 1024);
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
};

if ($action === 'restore_database') {
    if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? '')) !== 'POST') {
        $fail('database_maintenance.restore', 405, 'Method not allowed');
    }

    $serverBackupPath = trim((string)($_POST['server_backup_path'] ?? ''));

    $sqlPath = '';
    if ($serverBackupPath !== '') {
        $serverBackupPath = ltrim(str_replace('\\', '/', $serverBackupPath), '/');
        if (!str_starts_with($serverBackupPath, 'uploads/')) {
            $fail('database_maintenance.restore', 400, 'server_backup_path must be under uploads/');
        }
        $candidate = __DIR__ . '/' . $serverBackupPath;
        $real = realpath($candidate);
        $uploadsReal = realpath($uploadsDir);
        if ($real === false || $uploadsReal === false || !str_starts_with($real, $uploadsReal)) {
            $fail('database_maintenance.restore', 400, 'Invalid server_backup_path');
        }
        $sqlPath = $real;
    } else {
        $file = $_FILES['backup_file'] ?? null;
        if (!is_array($file)) {
            $fail('database_maintenance.restore', 400, 'Missing backup_file upload');
        }
        $tmp = (string)($file['tmp_name'] ?? '');
        $name = (string)($file['name'] ?? '');
        if ($tmp === '' || !is_uploaded_file($tmp)) {
            $fail('database_maintenance.restore', 400, 'Upload missing tmp file');
        }
        if ($name === '') {
            $fail('database_maintenance.restore', 400, 'Upload missing file name');
        }

        $safeName = preg_replace('/[^A-Za-z0-9_\.\-]/', '_', $name);
        if (!is_string($safeName) || $safeName === '') {
            $safeName = 'upload.sql';
        }

        $dest = $uploadsDir . '/restore_' . date('Ymd_His') . '_' . $safeName;
        if (!move_uploaded_file($tmp, $dest)) {
            $fail('database_maintenance.restore', 500, 'Failed to move uploaded file');
        }
        $sqlPath = $dest;
    }

    $ext = strtolower(pathinfo($sqlPath, PATHINFO_EXTENSION));
    if (!in_array($ext, ['sql', 'txt', 'gz'], true)) {
        $fail('database_maintenance.restore', 400, 'Unsupported file type (must be .sql, .txt, or .gz)');
    }

    try {
        $pdo = Database::getInstance();
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->exec('SET FOREIGN_KEY_CHECKS=0');

        $stream = $openInputStream($sqlPath);
        if (!$stream['handle']) {
            $fail('database_maintenance.restore', 500, 'Failed to open SQL stream');
        }

        $streamSqlIntoPdo($pdo, $stream);
        $closeStream($stream);

        $pdo->exec('SET FOREIGN_KEY_CHECKS=1');

        catn8_diagnostics_log_event('database_maintenance.restore', true, 200, 'Database restore completed', [
            'source' => $serverBackupPath !== '' ? 'server_backup_path' : 'upload',
            'path' => $sqlPath,
        ]);

        catn8_json_response([
            'success' => true,
            'message' => 'Database restored',
        ]);
    } catch (Throwable $e) {
        $fail('database_maintenance.restore', 500, (string)$e->getMessage(), ['path' => $sqlPath]);
    }
}

$fail('database_maintenance', 400, 'Unknown action');
