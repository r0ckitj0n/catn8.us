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

$safeTable = static function (string $table): string {
    return '`' . str_replace('`', '``', $table) . '`';
};

$sqlValue = static function (PDO $pdo, $value): string {
    if ($value === null) return 'NULL';
    if (is_bool($value)) return $value ? '1' : '0';
    if (is_int($value) || is_float($value)) return (string)$value;
    return $pdo->quote((string)$value);
};

$getAllBaseTables = static function (PDO $pdo): array {
    $out = [];
    try {
        $rows = $pdo->query('SHOW FULL TABLES')->fetchAll(PDO::FETCH_NUM);
        foreach ($rows as $row) {
            $name = isset($row[0]) ? trim((string)$row[0]) : '';
            $kind = isset($row[1]) ? strtoupper(trim((string)$row[1])) : 'BASE TABLE';
            if ($name === '' || $kind !== 'BASE TABLE') {
                continue;
            }
            $out[] = $name;
        }
    } catch (Throwable $e) {
        $rows = Database::queryAll(
            'SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = DATABASE() AND TABLE_TYPE = "BASE TABLE"'
        );
        foreach ($rows as $row) {
            $name = trim((string)($row['TABLE_NAME'] ?? ''));
            if ($name !== '') {
                $out[] = $name;
            }
        }
    }
    $out = array_values(array_unique($out));
    sort($out);
    return $out;
};

$dumpTablesToSqlGz = static function (PDO $pdo, array $tables, string $destPath) use ($safeTable, $sqlValue, $fail): array {
    $h = gzopen($destPath, 'wb9');
    if (!$h) {
        $fail('database_maintenance.export_secure_backup', 500, 'Failed to open secure backup SQL output file');
    }

    $write = static function (string $line) use ($h): void {
        gzwrite($h, $line);
    };

    $write("-- Secure backup\n");
    $write("-- Generated at " . gmdate('c') . "\n\n");
    $write("SET FOREIGN_KEY_CHECKS=0;\n\n");

    $tablesDumped = 0;
    $rowsDumped = 0;

    foreach ($tables as $table) {
        $tableSql = $safeTable($table);
        try {
            $createRes = $pdo->query('SHOW CREATE TABLE ' . $tableSql)->fetch(PDO::FETCH_ASSOC);
            if (!$createRes || !isset($createRes['Create Table'])) {
                continue;
            }

            $write("--\n-- Table structure for " . $table . "\n--\n\n");
            $write('DROP TABLE IF EXISTS ' . $tableSql . ";\n");
            $write((string)$createRes['Create Table'] . ";\n\n");

            $countRow = $pdo->query('SELECT COUNT(*) AS c FROM ' . $tableSql)->fetch(PDO::FETCH_ASSOC);
            $rowCount = (int)($countRow['c'] ?? 0);
            $write("--\n-- Data for " . $table . "\n--\n");
            if ($rowCount <= 0) {
                $write("\n");
                $tablesDumped++;
                continue;
            }

            $colRows = $pdo->query('SHOW COLUMNS FROM ' . $tableSql)->fetchAll(PDO::FETCH_ASSOC);
            $cols = [];
            foreach ($colRows as $c) {
                $name = (string)($c['Field'] ?? '');
                if ($name !== '') {
                    $cols[] = $name;
                }
            }
            if ($cols === []) {
                $tablesDumped++;
                continue;
            }

            $colList = '(' . implode(', ', array_map($safeTable, $cols)) . ')';
            $batchSize = 1000;
            $offset = 0;
            while ($offset < $rowCount) {
                $stmt = $pdo->query('SELECT * FROM ' . $tableSql . ' LIMIT ' . (int)$batchSize . ' OFFSET ' . (int)$offset);
                $valueSets = [];
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $vals = [];
                    foreach ($cols as $col) {
                        $vals[] = $sqlValue($pdo, $row[$col] ?? null);
                    }
                    $valueSets[] = '(' . implode(', ', $vals) . ')';
                    if (count($valueSets) >= 200) {
                        $write('INSERT INTO ' . $tableSql . ' ' . $colList . " VALUES\n  " . implode(",\n  ", $valueSets) . ";\n");
                        $rowsDumped += count($valueSets);
                        $valueSets = [];
                    }
                }
                if ($valueSets !== []) {
                    $write('INSERT INTO ' . $tableSql . ' ' . $colList . " VALUES\n  " . implode(",\n  ", $valueSets) . ";\n");
                    $rowsDumped += count($valueSets);
                }
                $offset += $batchSize;
            }

            $write("\n");
            $tablesDumped++;
        } catch (Throwable $e) {
            $write("-- Skipped table " . $table . " due to error: " . str_replace(["\n", "\r"], ' ', (string)$e->getMessage()) . "\n\n");
        }
    }

    $write("SET FOREIGN_KEY_CHECKS=1;\n");
    gzclose($h);

    return ['tables' => $tablesDumped, 'rows' => $rowsDumped];
};

$encryptSecureBackup = static function (string $plaintext, string $passphrase): array {
    $salt = random_bytes(16);
    $iterations = 600000;
    $key = hash_pbkdf2('sha256', $passphrase, $salt, $iterations, 32, true);
    $iv = random_bytes(12);
    $tag = '';
    $ciphertext = openssl_encrypt($plaintext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    if (!is_string($ciphertext) || $ciphertext === '') {
        throw new RuntimeException('Failed to encrypt secure backup payload');
    }

    return [
        'version' => 1,
        'cipher' => 'aes-256-gcm',
        'kdf' => 'pbkdf2-sha256',
        'iterations' => $iterations,
        'salt_b64' => base64_encode($salt),
        'iv_b64' => base64_encode($iv),
        'tag_b64' => base64_encode($tag),
        'ciphertext_b64' => base64_encode($ciphertext),
    ];
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

if ($action === 'export_secure_backup') {
    if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? '')) !== 'POST') {
        $fail('database_maintenance.export_secure_backup', 405, 'Method not allowed');
    }

    $body = $readJsonBody();
    $passphrase = trim((string)($body['passphrase'] ?? ''));
    if (strlen($passphrase) < 12) {
        $fail('database_maintenance.export_secure_backup', 400, 'passphrase must be at least 12 characters');
    }

    $includeDatabase = !isset($body['include_database']) || (int)$body['include_database'] === 1;
    $includeSecretStore = !isset($body['include_secret_store']) || (int)$body['include_secret_store'] === 1;
    if (!$includeDatabase && !$includeSecretStore) {
        $fail('database_maintenance.export_secure_backup', 400, 'Select at least one backup component');
    }

    $tmpSqlPath = $uploadsDir . '/secure_backup_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.sql.gz';

    try {
        $pdo = Database::getInstance();
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        $payload = [
            'version' => 1,
            'created_at' => gmdate('c'),
            'database_name' => (string)($pdo->query('SELECT DATABASE()')->fetchColumn() ?: ''),
            'includes' => [
                'database' => $includeDatabase ? 1 : 0,
                'secret_store' => $includeSecretStore ? 1 : 0,
            ],
        ];

        if ($includeDatabase) {
            $tables = $getAllBaseTables($pdo);
            $dumpMeta = $dumpTablesToSqlGz($pdo, $tables, $tmpSqlPath);
            $sqlBytes = @file_get_contents($tmpSqlPath);
            if (!is_string($sqlBytes) || $sqlBytes === '') {
                throw new RuntimeException('Failed to read secure backup SQL dump');
            }
            $payload['database_backup'] = [
                'format' => 'sql.gz',
                'tables_dumped' => (int)($dumpMeta['tables'] ?? 0),
                'rows_dumped' => (int)($dumpMeta['rows'] ?? 0),
                'sql_gz_b64' => base64_encode($sqlBytes),
            ];
        }

        if ($includeSecretStore) {
            $secretKeyPath = $rootDir . '/config/secret.key';
            $secretKeyBytes = @file_get_contents($secretKeyPath);
            if (!is_string($secretKeyBytes) || $secretKeyBytes === '') {
                throw new RuntimeException('Live config/secret.key was not found or is empty');
            }

            $secretRows = Database::queryAll('SELECT `key`, value_enc, created_at, updated_at FROM secrets ORDER BY `key` ASC');
            $payload['secret_store_backup'] = [
                'secret_key_filename' => 'config/secret.key',
                'secret_key_b64' => base64_encode($secretKeyBytes),
                'rows' => array_map(static function (array $row): array {
                    return [
                        'key' => (string)($row['key'] ?? ''),
                        'value_enc_b64' => base64_encode((string)($row['value_enc'] ?? '')),
                        'created_at' => (string)($row['created_at'] ?? ''),
                        'updated_at' => (string)($row['updated_at'] ?? ''),
                    ];
                }, $secretRows),
            ];
        }

        $plaintext = json_encode($payload, JSON_UNESCAPED_SLASHES);
        if (!is_string($plaintext) || $plaintext === '') {
            throw new RuntimeException('Failed to encode secure backup payload');
        }

        $encrypted = $encryptSecureBackup($plaintext, $passphrase);
        $fileName = 'catn8-secure-backup-' . date('Ymd_His') . '.json';

        header('Content-Type: application/json');
        header('Content-Disposition: attachment; filename="' . $fileName . '"');
        header('Cache-Control: private, no-store, max-age=0');
        header('Pragma: no-cache');
        echo json_encode([
            'backup_type' => 'catn8-secure-backup',
            'exported_at' => gmdate('c'),
            'encrypted_payload' => $encrypted,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        exit;
    } catch (Throwable $e) {
        $fail('database_maintenance.export_secure_backup', 500, (string)$e->getMessage());
    } finally {
        @unlink($tmpSqlPath);
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
        'exclude_ids' => is_array($body['exclude_ids'] ?? null) ? $body['exclude_ids'] : [],
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
