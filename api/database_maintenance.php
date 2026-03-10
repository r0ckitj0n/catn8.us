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

$readJsonBody = static function () use ($fail): array {
    $ct = strtolower(trim((string)($_SERVER['CONTENT_TYPE'] ?? '')));
    if ($ct !== '' && strpos($ct, 'application/json') !== 0) {
        $fail('database_maintenance', 415, 'Unsupported content type. Expected application/json');
    }
    $raw = file_get_contents('php://input');
    if (!is_string($raw) || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        $fail('database_maintenance', 400, 'Invalid JSON body');
    }
    return $decoded;
};

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

if ($action === 'inspect_accumul8') {
    if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? '')) !== 'GET') {
        $fail('database_maintenance.inspect_accumul8', 405, 'Method not allowed');
    }

    try {
        $pdo = Database::getInstance();
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        $users = $pdo->query(
            "SELECT
                u.id,
                u.username,
                u.email,
                u.is_active,
                (SELECT COUNT(*) FROM accumul8_accounts a WHERE a.owner_user_id = u.id) AS account_count,
                (SELECT COUNT(*) FROM accumul8_account_groups ag WHERE ag.owner_user_id = u.id) AS account_group_count,
                (SELECT COUNT(*) FROM accumul8_contacts c WHERE c.owner_user_id = u.id) AS contact_count,
                (SELECT COUNT(*) FROM accumul8_transactions t WHERE t.owner_user_id = u.id) AS transaction_count,
                (SELECT COUNT(*) FROM accumul8_transactions t WHERE t.owner_user_id = u.id AND t.source_kind = 'statement_pdf') AS statement_transaction_count
             FROM users u
             WHERE u.is_active = 1
               AND (
                    EXISTS (SELECT 1 FROM accumul8_transactions t WHERE t.owner_user_id = u.id)
                    OR EXISTS (SELECT 1 FROM accumul8_accounts a WHERE a.owner_user_id = u.id)
               )
             ORDER BY statement_transaction_count DESC, transaction_count DESC, u.id ASC"
        )->fetchAll(PDO::FETCH_ASSOC);

        $grants = $pdo->query(
            "SELECT
                g.id,
                g.grantee_user_id,
                gu.username AS grantee_username,
                g.owner_user_id,
                ou.username AS owner_username,
                g.is_active
             FROM accumul8_user_access_grants g
             INNER JOIN users gu ON gu.id = g.grantee_user_id
             INNER JOIN users ou ON ou.id = g.owner_user_id
             ORDER BY g.owner_user_id ASC, g.grantee_user_id ASC, g.id ASC"
        )->fetchAll(PDO::FETCH_ASSOC);

        $accounts = $pdo->query(
            "SELECT
                a.owner_user_id,
                u.username,
                a.id,
                a.account_name,
                COALESCE(a.institution_name, '') AS institution_name,
                COALESCE(a.mask_last4, '') AS mask_last4,
                COALESCE(ag.group_name, '') AS account_group_name,
                COALESCE(a.current_balance, 0.00) AS current_balance
             FROM accumul8_accounts a
             INNER JOIN users u ON u.id = a.owner_user_id
             LEFT JOIN accumul8_account_groups ag ON ag.id = a.account_group_id
             ORDER BY a.owner_user_id ASC, ag.group_name ASC, a.account_name ASC, a.id ASC"
        )->fetchAll(PDO::FETCH_ASSOC);

        $statementSummary = $pdo->query(
            "SELECT
                t.owner_user_id,
                u.username,
                COALESCE(ag.group_name, '') AS account_group_name,
                COALESCE(a.account_name, '') AS account_name,
                COUNT(*) AS count_rows,
                ROUND(COALESCE(SUM(t.amount), 0), 2) AS amount_total,
                MIN(t.transaction_date) AS min_date,
                MAX(t.transaction_date) AS max_date
             FROM accumul8_transactions t
             INNER JOIN users u ON u.id = t.owner_user_id
             LEFT JOIN accumul8_accounts a
               ON a.id = t.account_id
              AND a.owner_user_id = t.owner_user_id
             LEFT JOIN accumul8_account_groups ag
               ON ag.id = a.account_group_id
              AND ag.owner_user_id = t.owner_user_id
             WHERE t.source_kind = 'statement_pdf'
             GROUP BY t.owner_user_id, u.username, COALESCE(ag.group_name, ''), COALESCE(a.account_name, '')
             ORDER BY t.owner_user_id ASC, account_group_name ASC, account_name ASC"
        )->fetchAll(PDO::FETCH_ASSOC);

        catn8_json_response([
            'success' => true,
            'users' => $users,
            'grants' => $grants,
            'accounts' => $accounts,
            'statement_summary' => $statementSummary,
        ]);
    } catch (Throwable $e) {
        $fail('database_maintenance.inspect_accumul8', 500, (string)$e->getMessage());
    }
}

if ($action === 'accumul8_rescan_statements') {
    if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? '')) !== 'POST') {
        $fail('database_maintenance.accumul8_rescan_statements', 405, 'Method not allowed');
    }

    $body = $readJsonBody();
    $ownerUserId = isset($body['owner_user_id']) ? (int)$body['owner_user_id'] : null;
    if ($ownerUserId !== null && $ownerUserId <= 0) {
        $fail('database_maintenance.accumul8_rescan_statements', 400, 'Invalid owner_user_id');
    }

    $limit = isset($body['limit']) ? (int)$body['limit'] : 25;
    if ($limit <= 0 || $limit > 500) {
        $fail('database_maintenance.accumul8_rescan_statements', 400, 'limit must be between 1 and 500');
    }

    $options = [
        'dry_run' => !empty($body['dry_run']),
        'force' => !empty($body['force']),
        'limit' => $limit,
        'only_missing_successful_scan' => array_key_exists('only_missing_successful_scan', $body)
            ? (bool)$body['only_missing_successful_scan']
            : true,
        'include_missing_catalog' => array_key_exists('include_missing_catalog', $body)
            ? (bool)$body['include_missing_catalog']
            : true,
    ];

    if (!$options['force'] && !$options['only_missing_successful_scan'] && !$options['include_missing_catalog']) {
        $fail('database_maintenance.accumul8_rescan_statements', 400, 'Select at least one candidate filter or enable force');
    }

    try {
        if (!defined('CATN8_ACCUMUL8_LIBRARY_ONLY')) {
            define('CATN8_ACCUMUL8_LIBRARY_ONLY', true);
        }
        require_once __DIR__ . '/accumul8.php';

        $result = accumul8_statement_batch_rescan($ownerUserId, $options);
        catn8_diagnostics_log_event(
            'database_maintenance.accumul8_rescan_statements',
            true,
            200,
            $options['dry_run'] ? 'Accumul8 statement rescan dry run completed' : 'Accumul8 statement rescan completed',
            [
                'owner_user_id' => $ownerUserId,
                'limit' => $limit,
                'dry_run' => $options['dry_run'],
                'force' => $options['force'],
                'candidate_count' => (int)($result['candidate_count'] ?? 0),
                'success_count' => (int)($result['success_count'] ?? 0),
                'failure_count' => (int)($result['failure_count'] ?? 0),
            ]
        );

        catn8_json_response([
            'success' => true,
            'message' => $options['dry_run'] ? 'Accumul8 statement dry run completed' : 'Accumul8 statement rescan completed',
            'result' => $result,
        ]);
    } catch (Throwable $e) {
        $fail('database_maintenance.accumul8_rescan_statements', 500, (string)$e->getMessage(), [
            'owner_user_id' => $ownerUserId,
            'limit' => $limit,
        ]);
    }
}

$fail('database_maintenance', 400, 'Unknown action');
