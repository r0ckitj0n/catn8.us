<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../includes/diagnostics_log.php';

catn8_session_start();
catn8_require_admin();

$action = trim((string)($_GET['action'] ?? ''));
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

$rootDir = dirname(__DIR__, 2);
$backupsRoot = $rootDir . '/backups';
$websiteBackupDir = $backupsRoot . '/website';
$sqlBackupDir = $backupsRoot . '/sql';
$stateRoot = $rootDir . '/.local/state/site-maintenance';
$uploadDir = $stateRoot . '/uploads';
$tmpDir = $stateRoot . '/tmp';

@mkdir($websiteBackupDir, 0755, true);
@mkdir($sqlBackupDir, 0755, true);
@mkdir($uploadDir, 0755, true);
@mkdir($tmpDir, 0755, true);

const CATN8_IMAGE_GROUPS = [
    'all' => ['label' => 'All image folders', 'prefixes' => ['images/']],
    'backgrounds' => ['label' => 'Backgrounds', 'prefixes' => ['images/backgrounds/']],
    'mystery' => ['label' => 'Mystery', 'prefixes' => ['images/mystery/']],
    'build_wizard' => ['label' => 'Build Wizard', 'prefixes' => ['images/build-wizard/']],
    'wordsearch' => ['label' => 'Wordsearch', 'prefixes' => ['images/wordsearch/']],
    'products' => ['label' => 'Products', 'prefixes' => ['images/products/', 'images/items/']],
];

const CATN8_DB_GROUPS = [
    'analytics_receipts' => [
        'label' => 'Analytics Receipts',
        'tables' => ['analytics_logs', 'analytics_sessions', 'item_analytics', 'receipt_settings'],
    ],
    'business_config' => [
        'label' => 'Business Config',
        'tables' => ['business_settings', 'discount_codes', 'sales'],
    ],
    'content_data' => [
        'label' => 'Content Data',
        'tables' => ['newsletter_groups', 'optimization_suggestions', 'pricing_explanations'],
    ],
    'core_ecommerce' => [
        'label' => 'Core Ecommerce',
        'tables' => ['item_colors', 'item_images', 'items', 'order_items', 'orders'],
    ],
    'email_system' => [
        'label' => 'Email System',
        'tables' => ['email_campaigns', 'email_logs', 'email_subscribers', 'email_template_assignments', 'email_templates'],
    ],
    'help_system' => [
        'label' => 'Help System',
        'tables' => ['help_tooltips'],
    ],
    'integrations' => [
        'label' => 'Integrations',
        'tables' => ['ai_generation_cost_events', 'ai_generation_history', 'ai_job_pricing_rates', 'ai_models'],
    ],
    'inventory_cost' => [
        'label' => 'Inventory Cost',
        'tables' => ['cost_breakdown_templates', 'cost_factors', 'cost_suggestions', 'inventory_energies'],
    ],
    'item_categories' => [
        'label' => 'Item Categories',
        'tables' => ['categories', 'theme_word_categories'],
    ],
];

$fail = static function (string $eventKey, int $status, string $error, array $meta = []): void {
    catn8_diagnostics_log_event($eventKey, false, $status, $error, $meta);
    catn8_json_response(['success' => false, 'error' => $error], $status);
};

$requireMethod = static function (string $expected) use ($method, $fail): void {
    if ($method !== strtoupper($expected)) {
        $fail('settings.site_maintenance.method', 405, 'Method not allowed');
    }
    if ($method !== 'GET') {
        catn8_require_csrf();
    }
};

$requireJsonBody = static function () use ($fail): array {
    $ct = strtolower(trim((string)($_SERVER['CONTENT_TYPE'] ?? '')));
    if ($ct !== '' && strpos($ct, 'application/json') !== 0) {
        $fail('settings.site_maintenance.content_type', 415, 'Unsupported content type. Expected application/json');
    }
    $raw = file_get_contents('php://input');
    if (!is_string($raw) || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        $fail('settings.site_maintenance.json', 400, 'Invalid JSON body');
    }
    return $decoded;
};

$sanitizeRelPath = static function (string $rel): string {
    $rel = str_replace('\\', '/', trim($rel));
    $rel = ltrim($rel, '/');
    $parts = array_values(array_filter(explode('/', $rel), static fn($p) => $p !== '' && $p !== '.'));
    $clean = [];
    foreach ($parts as $p) {
        if ($p === '..') {
            return '';
        }
        $clean[] = $p;
    }
    return implode('/', $clean);
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
    $rows = $pdo->query('SHOW FULL TABLES')->fetchAll(PDO::FETCH_NUM);
    $out = [];
    foreach ($rows as $row) {
        $name = isset($row[0]) ? trim((string)$row[0]) : '';
        $kind = isset($row[1]) ? strtoupper(trim((string)$row[1])) : 'BASE TABLE';
        if ($name === '' || $kind !== 'BASE TABLE') continue;
        $out[] = $name;
    }
    sort($out);
    return $out;
};

$getExistingTables = static function (PDO $pdo, array $tables): array {
    $all = $getAllBaseTables($pdo);
    $set = array_flip($all);
    $out = [];
    foreach ($tables as $t) {
        $t = trim((string)$t);
        if ($t === '' || !isset($set[$t])) continue;
        $out[] = $t;
    }
    return array_values(array_unique($out));
};

$getSelectedImagePrefixes = static function (array $groupIds): array {
    $out = [];
    foreach ($groupIds as $id) {
        $key = trim((string)$id);
        if ($key === '' || !isset(CATN8_IMAGE_GROUPS[$key])) continue;
        foreach (CATN8_IMAGE_GROUPS[$key]['prefixes'] as $p) {
            $out[] = $p;
        }
    }
    if (empty($out)) {
        return ['images/'];
    }
    return array_values(array_unique($out));
};

$getSelectedDbTables = static function (PDO $pdo, array $groupIds): array {
    $wanted = [];
    foreach ($groupIds as $id) {
        $key = trim((string)$id);
        if ($key === '' || !isset(CATN8_DB_GROUPS[$key])) continue;
        foreach (CATN8_DB_GROUPS[$key]['tables'] as $table) {
            $wanted[] = $table;
        }
    }
    $wanted = array_values(array_unique($wanted));
    if (empty($wanted)) return [];
    return $getExistingTables($pdo, $wanted);
};

$normalizeBackupFile = static function (string $baseDir, string $relativePath) use ($sanitizeRelPath, $fail): string {
    $clean = $sanitizeRelPath($relativePath);
    if ($clean === '') {
        $fail('settings.site_maintenance.path', 400, 'Invalid backup path');
    }
    $full = realpath($baseDir . '/' . $clean);
    $base = realpath($baseDir);
    if ($full === false || $base === false || strpos($full, $base) !== 0 || !is_file($full)) {
        $fail('settings.site_maintenance.path', 400, 'Backup file not found');
    }
    return $full;
};

$listBackupFiles = static function (string $baseDir): array {
    $base = realpath($baseDir);
    if ($base === false) return [];
    $out = [];
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $path => $info) {
        if (!$info->isFile()) continue;
        $full = (string)$path;
        $rel = ltrim(str_replace('\\', '/', substr($full, strlen($base))), '/');
        $out[] = [
            'path' => $rel,
            'name' => basename($full),
            'size_bytes' => (int)$info->getSize(),
            'modified_at' => date('c', (int)$info->getMTime()),
        ];
    }
    usort($out, static function (array $a, array $b): int {
        return strcmp((string)$b['modified_at'], (string)$a['modified_at']);
    });
    return $out;
};

$createWebsiteBackup = static function (string $mode, array $imageGroupIds) use ($rootDir, $websiteBackupDir, $fail, $getSelectedImagePrefixes): array {
    if (!class_exists('ZipArchive')) {
        $fail('settings.site_maintenance.website_backup', 500, 'ZipArchive is not available');
    }

    $prefixes = $mode === 'images' ? $getSelectedImagePrefixes($imageGroupIds) : [];

    $ts = date('Y-m-d_H-i-s');
    $fileName = 'site_' . ($mode === 'images' ? 'images_' : 'full_') . $ts . '.zip';
    $outPath = $websiteBackupDir . '/' . $fileName;

    $zip = new ZipArchive();
    $open = $zip->open($outPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);
    if ($open !== true) {
        $fail('settings.site_maintenance.website_backup', 500, 'Failed to create website backup archive');
    }

    $excludePrefixes = ['.git/', 'node_modules/', 'backups/', 'logs/', '.local/state/'];
    $excludeExact = ['.env', '.env.local', '.env.live', 'config/secret.key'];

    $files = 0;
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($rootDir, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $path => $info) {
        if (!$info->isFile()) continue;
        $full = (string)$path;
        $rel = ltrim(str_replace('\\', '/', substr($full, strlen($rootDir))), '/');
        if ($rel === '') continue;

        $skip = false;
        foreach ($excludeExact as $ex) {
            if ($rel === $ex) {
                $skip = true;
                break;
            }
        }
        if ($skip) continue;

        if (strpos($rel, '.env.') === 0) continue;

        foreach ($excludePrefixes as $prefix) {
            if (strpos($rel, $prefix) === 0) {
                $skip = true;
                break;
            }
        }
        if ($skip) continue;

        if ($mode === 'images') {
            $ok = false;
            foreach ($prefixes as $prefix) {
                if (strpos($rel, $prefix) === 0) {
                    $ok = true;
                    break;
                }
            }
            if (!$ok) continue;
        }

        if ($zip->addFile($full, $rel)) {
            $files++;
        }
    }

    $zip->close();

    return ['path' => 'website/' . $fileName, 'files' => $files];
};

$dumpTablesToSqlGz = static function (PDO $pdo, array $tables, string $destPath) use ($safeTable, $sqlValue, $fail): array {
    $h = gzopen($destPath, 'wb9');
    if (!$h) {
        $fail('settings.site_maintenance.db_backup', 500, 'Failed to open SQL output file');
    }

    $write = static function (string $line) use ($h): void {
        gzwrite($h, $line);
    };

    $write("-- Site Maintenance backup\n");
    $write("-- Generated at " . gmdate('c') . "\n\n");
    $write("SET FOREIGN_KEY_CHECKS=0;\n\n");

    $tablesDumped = 0;
    $rowsDumped = 0;

    foreach ($tables as $table) {
        $tableSql = $safeTable($table);

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
            if ($name !== '') $cols[] = $name;
        }
        if (empty($cols)) {
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
            if (!empty($valueSets)) {
                $write('INSERT INTO ' . $tableSql . ' ' . $colList . " VALUES\n  " . implode(",\n  ", $valueSets) . ";\n");
                $rowsDumped += count($valueSets);
            }
            $offset += $batchSize;
        }

        $write("\n");
        $tablesDumped++;
    }

    $write("SET FOREIGN_KEY_CHECKS=1;\n");
    gzclose($h);

    return ['tables' => $tablesDumped, 'rows' => $rowsDumped];
};

$resolveUploadFile = static function (string $fieldName, array $allowedExt) use ($uploadDir, $fail): string {
    $file = $_FILES[$fieldName] ?? null;
    if (!is_array($file)) {
        $fail('settings.site_maintenance.upload', 400, 'Missing uploaded file');
    }
    $tmp = (string)($file['tmp_name'] ?? '');
    $name = (string)($file['name'] ?? '');
    if ($tmp === '' || !is_uploaded_file($tmp)) {
        $fail('settings.site_maintenance.upload', 400, 'Upload failed');
    }
    $safeName = preg_replace('/[^A-Za-z0-9_\.\-]/', '_', $name);
    if (!is_string($safeName) || $safeName === '') {
        $safeName = 'upload.bin';
    }
    $ext = strtolower(pathinfo($safeName, PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExt, true)) {
        $fail('settings.site_maintenance.upload', 400, 'Unsupported uploaded file type');
    }
    $dest = $uploadDir . '/' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '_' . $safeName;
    if (!move_uploaded_file($tmp, $dest)) {
        $fail('settings.site_maintenance.upload', 500, 'Failed to store uploaded file');
    }
    return $dest;
};

$extractStatementTargetTable = static function (string $sql): ?string {
    $s = trim($sql);
    if ($s === '') return null;

    $patterns = [
        '/^(?:INSERT\s+INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE\s+TABLE|DROP\s+TABLE\s+IF\s+EXISTS|DROP\s+TABLE|CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS|CREATE\s+TABLE|ALTER\s+TABLE)\s+`?([A-Za-z0-9_]+)`?/i',
    ];

    foreach ($patterns as $p) {
        if (preg_match($p, $s, $m)) {
            return strtolower((string)$m[1]);
        }
    }

    return null;
};

$shouldExecuteSqlStatement = static function (string $sql, ?array $allowedTableSet) use ($extractStatementTargetTable): bool {
    if ($allowedTableSet === null) return true;

    $trim = trim($sql);
    if ($trim === '') return false;

    if (preg_match('/^(SET\s+|START\s+TRANSACTION|COMMIT|ROLLBACK|LOCK\s+TABLES|UNLOCK\s+TABLES|\/\*!|--|#)/i', $trim)) {
        return true;
    }

    $table = $extractStatementTargetTable($trim);
    if ($table === null) {
        return false;
    }

    return isset($allowedTableSet[$table]);
};

$openSqlStream = static function (string $path): array {
    if (preg_match('/\.gz$/i', $path)) {
        $h = gzopen($path, 'rb');
        return ['type' => 'gz', 'handle' => $h];
    }
    $h = fopen($path, 'rb');
    return ['type' => 'plain', 'handle' => $h];
};

$readSqlChunk = static function (array $stream, int $len): string {
    $h = $stream['handle'] ?? null;
    if (!$h) return '';
    if (($stream['type'] ?? '') === 'gz') {
        $s = gzread($h, $len);
        return is_string($s) ? $s : '';
    }
    $s = fread($h, $len);
    return is_string($s) ? $s : '';
};

$closeSqlStream = static function (array $stream): void {
    $h = $stream['handle'] ?? null;
    if (!$h) return;
    if (($stream['type'] ?? '') === 'gz') {
        @gzclose($h);
        return;
    }
    @fclose($h);
};

$streamSqlToPdo = static function (PDO $pdo, array $stream, ?array $allowedTables = null) use ($readSqlChunk, $shouldExecuteSqlStatement): array {
    $inSingle = false;
    $inDouble = false;
    $inBacktick = false;
    $inLineComment = false;
    $inBlockComment = false;
    $stmt = '';
    $executed = 0;
    $skipped = 0;

    $allowSet = null;
    if (is_array($allowedTables)) {
        $allowSet = [];
        foreach ($allowedTables as $t) {
            $allowSet[strtolower((string)$t)] = true;
        }
    }

    $flushStmt = static function (string $sql) use ($pdo, $shouldExecuteSqlStatement, $allowSet, &$executed, &$skipped): void {
        $sql = trim($sql);
        if ($sql === '') return;
        if ($shouldExecuteSqlStatement($sql, $allowSet)) {
            $pdo->exec($sql);
            $executed++;
        } else {
            $skipped++;
        }
    };

    while (true) {
        $chunk = $readSqlChunk($stream, 1024 * 1024);
        if ($chunk === '') {
            break;
        }

        $len = strlen($chunk);
        for ($i = 0; $i < $len; $i++) {
            $c = $chunk[$i];
            $n = $i + 1 < $len ? $chunk[$i + 1] : '';

            if ($inLineComment) {
                $stmt .= $c;
                if ($c === "\n") {
                    $inLineComment = false;
                }
                continue;
            }

            if ($inBlockComment) {
                $stmt .= $c;
                if ($c === '*' && $n === '/') {
                    $stmt .= '/';
                    $i++;
                    $inBlockComment = false;
                }
                continue;
            }

            if (!$inSingle && !$inDouble && !$inBacktick) {
                if ($c === '-' && $n === '-') {
                    $stmt .= $c;
                    $inLineComment = true;
                    continue;
                }
                if ($c === '#') {
                    $stmt .= $c;
                    $inLineComment = true;
                    continue;
                }
                if ($c === '/' && $n === '*') {
                    $stmt .= '/*';
                    $i++;
                    $inBlockComment = true;
                    continue;
                }
            }

            if ($c === "'" && !$inDouble && !$inBacktick) {
                $prev = $i > 0 ? $chunk[$i - 1] : '';
                if ($prev !== '\\') $inSingle = !$inSingle;
                $stmt .= $c;
                continue;
            }
            if ($c === '"' && !$inSingle && !$inBacktick) {
                $prev = $i > 0 ? $chunk[$i - 1] : '';
                if ($prev !== '\\') $inDouble = !$inDouble;
                $stmt .= $c;
                continue;
            }
            if ($c === '`' && !$inSingle && !$inDouble) {
                $inBacktick = !$inBacktick;
                $stmt .= $c;
                continue;
            }

            if ($c === ';' && !$inSingle && !$inDouble && !$inBacktick) {
                $stmt .= ';';
                $flushStmt($stmt);
                $stmt = '';
                continue;
            }

            $stmt .= $c;
        }
    }

    if (trim($stmt) !== '') {
        $flushStmt($stmt);
    }

    return ['executed' => $executed, 'skipped' => $skipped];
};

$extractWebsiteArchive = static function (string $archivePath, string $mode, array $imageGroupIds) use ($rootDir, $tmpDir, $sanitizeRelPath, $fail, $getSelectedImagePrefixes): array {
    $prefixes = $mode === 'selected' ? $getSelectedImagePrefixes($imageGroupIds) : [''];

    $allowRestorePath = static function (string $rel) use ($prefixes, $mode): bool {
        if ($rel === '' || $rel[0] === '.') return false;
        if (in_array($rel, ['.env', '.env.local', '.env.live', 'config/secret.key'], true)) return false;

        if ($mode === 'full') return true;

        foreach ($prefixes as $prefix) {
            if ($prefix === '') return true;
            if (strpos($rel, $prefix) === 0) return true;
        }
        return false;
    };

    $moved = 0;

    $lower = strtolower($archivePath);
    if (str_ends_with($lower, '.zip')) {
        if (!class_exists('ZipArchive')) {
            $fail('settings.site_maintenance.website_restore', 500, 'ZipArchive is not available');
        }
        $zip = new ZipArchive();
        $ok = $zip->open($archivePath);
        if ($ok !== true) {
            $fail('settings.site_maintenance.website_restore', 400, 'Failed to open zip archive');
        }

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = (string)$zip->getNameIndex($i);
            if ($name === '' || str_ends_with($name, '/')) continue;
            $rel = $sanitizeRelPath($name);
            if ($rel === '' || !$allowRestorePath($rel)) continue;

            $target = $rootDir . '/' . $rel;
            $dir = dirname($target);
            if (!is_dir($dir)) {
                @mkdir($dir, 0755, true);
            }

            $stream = $zip->getStream($name);
            if (!is_resource($stream)) continue;
            $out = fopen($target, 'wb');
            if (!is_resource($out)) {
                fclose($stream);
                continue;
            }
            while (!feof($stream)) {
                $buf = fread($stream, 8192);
                if (!is_string($buf) || $buf === '') break;
                fwrite($out, $buf);
            }
            fclose($out);
            fclose($stream);
            $moved++;
        }

        $zip->close();
        return ['files_restored' => $moved];
    }

    if (!class_exists('PharData')) {
        $fail('settings.site_maintenance.website_restore', 500, 'PharData is not available for tar archives');
    }

    $tarPath = $archivePath;
    if (str_ends_with($lower, '.tar.gz') || str_ends_with($lower, '.tgz')) {
        $tmpTar = $tmpDir . '/extract_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.tar';
        $guessTar = preg_replace('/\.(tgz|tar\.gz)$/i', '.tar', $archivePath);
        if (!is_string($guessTar)) {
            $fail('settings.site_maintenance.website_restore', 400, 'Invalid tar.gz archive name');
        }
        if (!is_file($guessTar)) {
            $ph = new PharData($archivePath);
            $ph->decompress();
        }
        if (!is_file($guessTar)) {
            $fail('settings.site_maintenance.website_restore', 400, 'Failed to decompress tar.gz archive');
        }
        @rename($guessTar, $tmpTar);
        $tarPath = $tmpTar;
    }

    $phar = new PharData($tarPath);
    $it = new RecursiveIteratorIterator($phar);
    $pharPrefix = 'phar://' . str_replace('\\', '/', $tarPath) . '/';
    foreach ($it as $file) {
        $innerPath = str_replace('\\', '/', (string)$file->getPathName());
        if (str_starts_with($innerPath, $pharPrefix)) {
            $innerPath = substr($innerPath, strlen($pharPrefix));
        }
        $rel = $sanitizeRelPath($innerPath);
        if ($rel === '' || !$allowRestorePath($rel)) continue;

        $target = $rootDir . '/' . $rel;
        $dir = dirname($target);
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }

        $content = @file_get_contents($file->getPathName());
        if (!is_string($content)) continue;
        if (@file_put_contents($target, $content) === false) continue;
        $moved++;
    }

    return ['files_restored' => $moved];
};

$getStatusPayload = static function (PDO $pdo): array {
    $tableExists = static function (PDO $pdo, string $table): bool {
        $row = Database::queryOne("SELECT 1 AS ok FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1", [$table]);
        return $row !== null;
    };

    $safeCount = static function (PDO $pdo, string $table, ?string $where = null) use ($tableExists): int {
        if (!$tableExists($pdo, $table)) return 0;
        $sql = 'SELECT COUNT(*) AS c FROM `' . str_replace('`', '``', $table) . '`';
        if ($where !== null && trim($where) !== '') {
            $sql .= ' WHERE ' . $where;
        }
        $row = Database::queryOne($sql);
        return (int)($row['c'] ?? 0);
    };

    $categoriesCount = $safeCount($pdo, 'categories', 'COALESCE(is_active, 1) = 1');
    if ($categoriesCount <= 0) {
        $categoriesCount = $safeCount($pdo, 'categories');
    }

    $orders = [];
    if ($tableExists($pdo, 'orders')) {
        $rows = Database::queryAll('SELECT id FROM orders ORDER BY id DESC LIMIT 3');
        foreach ($rows as $r) {
            $orders[] = 'ORD' . str_pad((string)((int)($r['id'] ?? 0)), 6, '0', STR_PAD_LEFT);
        }
    }

    return [
        'primary_identity' => [
            'identifier' => 'SKU',
            'format' => 'WF-[CATEGORY]-[NUMBER]',
            'entity' => 'Items',
        ],
        'quick_stats' => [
            'total_items' => $safeCount($pdo, 'items'),
            'total_item_images' => $safeCount($pdo, 'item_images'),
            'total_orders' => $safeCount($pdo, 'orders'),
            'active_categories' => $categoriesCount,
        ],
        'recent_activity' => [
            'latest_customers' => ['POS001', 'F14009', 'F14008'],
            'latest_orders' => $orders,
        ],
    ];
};

$getDatabasePayload = static function (PDO $pdo) use ($getExistingTables): array {
    $allTables = $getAllBaseTables($pdo);

    $groupsOut = [];
    foreach (CATN8_DB_GROUPS as $id => $def) {
        $existing = $getExistingTables($pdo, (array)($def['tables'] ?? []));
        $rowsOut = [];
        foreach ($existing as $table) {
            $row = Database::queryOne('SELECT COUNT(*) AS c FROM `' . str_replace('`', '``', $table) . '`');
            $rowsOut[] = [
                'table' => $table,
                'row_count' => (int)($row['c'] ?? 0),
            ];
        }

        $groupsOut[] = [
            'id' => $id,
            'label' => (string)$def['label'],
            'rows' => $rowsOut,
        ];
    }

    $backupTableCount = 0;
    foreach ($allTables as $table) {
        if (preg_match('/(^backup_|_backup$|_bak$|^bak_)/i', $table)) {
            $backupTableCount++;
        }
    }

    $imageGroupsOut = [];
    foreach (CATN8_IMAGE_GROUPS as $id => $def) {
        $imageGroupsOut[] = [
            'id' => $id,
            'label' => (string)$def['label'],
        ];
    }

    return [
        'active_tables' => count($allTables),
        'backup_tables' => $backupTableCount,
        'groups' => $groupsOut,
        'db_group_options' => array_map(static function (array $g): array {
            return ['id' => (string)$g['id'], 'label' => (string)$g['label']];
        }, $groupsOut),
        'image_group_options' => $imageGroupsOut,
    ];
};

$runImageCleanup = static function (PDO $pdo, bool $dryRun) use ($rootDir): array {
    $imagesRoot = $rootDir . '/images';
    if (!is_dir($imagesRoot)) {
        return ['scanned_files' => 0, 'referenced_files' => 0, 'unreferenced_files' => 0, 'moved_files' => 0, 'moved' => []];
    }

    $extractRefsFromText = static function (string $value): array {
        $refs = [];
        if ($value === '') return $refs;

        if (preg_match_all('/(?:https?:\/\/[^\s"\']+|\/?images\/[A-Za-z0-9_\.\/%\-]+)/i', $value, $m)) {
            foreach ($m[0] as $raw) {
                $path = parse_url((string)$raw, PHP_URL_PATH);
                if (!is_string($path) || $path === '') {
                    $path = (string)$raw;
                }
                $path = ltrim(str_replace('\\', '/', $path), '/');
                if (!str_starts_with($path, 'images/')) continue;
                $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
                if (!in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'], true)) continue;
                $refs[] = strtolower($path);
            }
        }

        return $refs;
    };

    $referencedRel = [];
    $referencedBase = [];

    $schemaRow = Database::queryOne('SELECT DATABASE() AS dbname');
    $schema = trim((string)($schemaRow['dbname'] ?? ''));
    if ($schema !== '') {
        $cols = Database::queryAll(
            'SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND DATA_TYPE IN ("varchar","text","mediumtext","longtext") AND (LOWER(COLUMN_NAME) LIKE "%image%" OR LOWER(COLUMN_NAME) LIKE "%photo%" OR LOWER(COLUMN_NAME) LIKE "%picture%" OR LOWER(COLUMN_NAME) LIKE "%icon%" OR LOWER(COLUMN_NAME) LIKE "%background%" OR LOWER(COLUMN_NAME) LIKE "%logo%" OR LOWER(COLUMN_NAME) LIKE "%path%" OR LOWER(COLUMN_NAME) LIKE "%url%" OR LOWER(COLUMN_NAME) LIKE "%file%")',
            [$schema]
        );

        foreach ($cols as $col) {
            $table = trim((string)($col['TABLE_NAME'] ?? ''));
            $column = trim((string)($col['COLUMN_NAME'] ?? ''));
            if ($table === '' || $column === '') continue;
            if (!preg_match('/^[A-Za-z0-9_]+$/', $table) || !preg_match('/^[A-Za-z0-9_]+$/', $column)) continue;

            $sql = 'SELECT `' . $column . '` AS v FROM `' . $table . '` WHERE `' . $column . '` IS NOT NULL AND `' . $column . '` <> "" LIMIT 50000';
            try {
                $rows = Database::queryAll($sql);
                foreach ($rows as $r) {
                    $v = (string)($r['v'] ?? '');
                    foreach ($extractRefsFromText($v) as $rel) {
                        $referencedRel[$rel] = true;
                        $referencedBase[strtolower(basename($rel))] = true;
                    }
                }
            } catch (Throwable $e) {
            }
        }
    }

    $toMove = [];
    $scanned = 0;

    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($imagesRoot, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $path => $info) {
        if (!$info->isFile()) continue;
        $full = (string)$path;
        $rel = ltrim(str_replace('\\', '/', substr($full, strlen($rootDir))), '/');
        $lowerRel = strtolower($rel);
        $base = strtolower(basename($lowerRel));

        $ext = strtolower(pathinfo($lowerRel, PATHINFO_EXTENSION));
        if (!in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'], true)) continue;

        $scanned++;
        if (isset($referencedRel[$lowerRel]) || isset($referencedBase[$base])) {
            continue;
        }
        $toMove[] = $rel;
    }

    $moved = [];
    if (!$dryRun && !empty($toMove)) {
        $destRoot = $rootDir . '/backups/images_cleanup/' . date('Y-m-d_H-i-s');
        @mkdir($destRoot, 0755, true);

        foreach ($toMove as $rel) {
            $src = $rootDir . '/' . $rel;
            if (!is_file($src)) continue;
            $dest = $destRoot . '/' . $rel;
            $dir = dirname($dest);
            if (!is_dir($dir)) {
                @mkdir($dir, 0755, true);
            }
            if (@rename($src, $dest)) {
                $moved[] = $rel;
            }
        }
    }

    return [
        'scanned_files' => $scanned,
        'referenced_files' => count($referencedRel),
        'unreferenced_files' => count($toMove),
        'moved_files' => $dryRun ? 0 : count($moved),
        'moved' => array_slice($dryRun ? $toMove : $moved, 0, 100),
    ];
};

try {
    $pdo = Database::getInstance();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (Throwable $e) {
    $fail('settings.site_maintenance.db', 500, 'Database connection failed', ['error' => $e->getMessage()]);
}

if ($action === 'status') {
    $requireMethod('GET');
    $status = $getStatusPayload($pdo);
    catn8_json_response(['success' => true, 'status' => $status]);
}

if ($action === 'database') {
    $requireMethod('GET');
    $database = $getDatabasePayload($pdo);
    catn8_json_response(['success' => true, 'database' => $database]);
}

if ($action === 'backups_list') {
    $requireMethod('GET');
    catn8_json_response([
        'success' => true,
        'website_backups' => $listBackupFiles($websiteBackupDir),
        'database_backups' => $listBackupFiles($sqlBackupDir),
    ]);
}

if ($action === 'compact_repair') {
    $requireMethod('POST');
    $tables = $getAllBaseTables($pdo);
    $ran = 0;
    foreach ($tables as $table) {
        $safe = $safeTable($table);
        try {
            $pdo->exec('OPTIMIZE TABLE ' . $safe);
            $ran++;
        } catch (Throwable $e) {
        }
    }
    catn8_diagnostics_log_event('settings.site_maintenance.compact_repair', true, 200, 'Compact & repair completed', ['tables' => $ran]);
    catn8_json_response(['success' => true, 'message' => 'Compact & repair completed', 'tables' => $ran]);
}

if ($action === 'create_website_backup') {
    $requireMethod('POST');
    $body = $requireJsonBody();
    $mode = trim((string)($body['mode'] ?? 'full'));
    if ($mode !== 'full' && $mode !== 'images') {
        $fail('settings.site_maintenance.website_backup', 400, 'Invalid website backup mode');
    }
    $groupIds = is_array($body['image_groups'] ?? null) ? $body['image_groups'] : [];

    $res = $createWebsiteBackup($mode, $groupIds);
    catn8_diagnostics_log_event('settings.site_maintenance.website_backup', true, 200, 'Website backup created', $res + ['mode' => $mode]);
    catn8_json_response(['success' => true, 'message' => 'Website backup created', 'backup' => $res]);
}

if ($action === 'create_database_backup') {
    $requireMethod('POST');
    $body = $requireJsonBody();
    $mode = trim((string)($body['mode'] ?? 'full'));
    if ($mode !== 'full' && $mode !== 'selected') {
        $fail('settings.site_maintenance.db_backup', 400, 'Invalid database backup mode');
    }
    $groupIds = is_array($body['group_ids'] ?? null) ? $body['group_ids'] : [];

    if ($mode === 'full') {
        $tables = array_values(array_filter($getAllBaseTables($pdo), static fn($t) => strtolower((string)$t) !== 'secrets'));
    } else {
        $tables = $getSelectedDbTables($pdo, $groupIds);
        if (empty($tables)) {
            $fail('settings.site_maintenance.db_backup', 400, 'Select at least one valid data group');
        }
    }

    $ts = date('Y-m-d_H-i-s');
    $name = 'db_' . ($mode === 'full' ? 'full_' : 'selected_') . $ts . '.sql.gz';
    $outPath = $sqlBackupDir . '/' . $name;

    $result = $dumpTablesToSqlGz($pdo, $tables, $outPath);

    $meta = [
        'path' => 'sql/' . $name,
        'tables' => $result['tables'],
        'rows' => $result['rows'],
    ];
    catn8_diagnostics_log_event('settings.site_maintenance.db_backup', true, 200, 'Database backup created', $meta + ['mode' => $mode]);
    catn8_json_response(['success' => true, 'message' => 'Database backup created', 'backup' => $meta]);
}

if ($action === 'restore_website_server') {
    $requireMethod('POST');
    $body = $requireJsonBody();
    $mode = trim((string)($body['mode'] ?? 'full'));
    if ($mode !== 'full' && $mode !== 'selected') {
        $fail('settings.site_maintenance.website_restore', 400, 'Invalid website restore mode');
    }
    $groupIds = is_array($body['image_groups'] ?? null) ? $body['image_groups'] : [];
    $backupPath = trim((string)($body['backup_path'] ?? ''));
    if ($backupPath === '') {
        $fail('settings.site_maintenance.website_restore', 400, 'backup_path is required');
    }

    $archivePath = $normalizeBackupFile($websiteBackupDir, $backupPath);
    $res = $extractWebsiteArchive($archivePath, $mode, $groupIds);

    catn8_diagnostics_log_event('settings.site_maintenance.website_restore', true, 200, 'Website restore completed', ['mode' => $mode, 'files_restored' => $res['files_restored']]);
    catn8_json_response(['success' => true, 'message' => 'Website restore completed', 'result' => $res]);
}

if ($action === 'restore_website_upload') {
    $requireMethod('POST');
    $mode = trim((string)($_POST['mode'] ?? 'full'));
    if ($mode !== 'full' && $mode !== 'selected') {
        $fail('settings.site_maintenance.website_restore', 400, 'Invalid website restore mode');
    }
    $groupIds = [];
    if (isset($_POST['image_groups'])) {
        $decoded = json_decode((string)$_POST['image_groups'], true);
        if (is_array($decoded)) {
            $groupIds = $decoded;
        }
    }

    $uploadPath = $resolveUploadFile('backup_file', ['zip', 'tar', 'gz', 'tgz']);
    $res = $extractWebsiteArchive($uploadPath, $mode, $groupIds);

    catn8_diagnostics_log_event('settings.site_maintenance.website_restore_upload', true, 200, 'Website restore upload completed', ['mode' => $mode, 'files_restored' => $res['files_restored']]);
    catn8_json_response(['success' => true, 'message' => 'Website restore completed', 'result' => $res]);
}

if ($action === 'restore_database_server') {
    $requireMethod('POST');
    $body = $requireJsonBody();
    $mode = trim((string)($body['mode'] ?? 'full'));
    if ($mode !== 'full' && $mode !== 'selected') {
        $fail('settings.site_maintenance.db_restore', 400, 'Invalid database restore mode');
    }
    $groupIds = is_array($body['group_ids'] ?? null) ? $body['group_ids'] : [];
    $backupPath = trim((string)($body['backup_path'] ?? ''));
    if ($backupPath === '') {
        $fail('settings.site_maintenance.db_restore', 400, 'backup_path is required');
    }

    $sqlPath = $normalizeBackupFile($sqlBackupDir, $backupPath);
    $tables = $mode === 'full' ? null : $getSelectedDbTables($pdo, $groupIds);
    if ($mode === 'selected' && empty($tables)) {
        $fail('settings.site_maintenance.db_restore', 400, 'Select at least one valid data group');
    }

    $stream = $openSqlStream($sqlPath);
    if (!($stream['handle'] ?? null)) {
        $fail('settings.site_maintenance.db_restore', 400, 'Failed to open SQL backup');
    }

    try {
        $pdo->exec('SET FOREIGN_KEY_CHECKS=0');
        $result = $streamSqlToPdo($pdo, $stream, $tables);
        $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
        $closeSqlStream($stream);
    } catch (Throwable $e) {
        $closeSqlStream($stream);
        $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
        $fail('settings.site_maintenance.db_restore', 500, 'Database restore failed', ['error' => $e->getMessage()]);
    }

    catn8_diagnostics_log_event('settings.site_maintenance.db_restore', true, 200, 'Database restore completed', $result + ['mode' => $mode]);
    catn8_json_response(['success' => true, 'message' => 'Database restore completed', 'result' => $result]);
}

if ($action === 'restore_database_upload') {
    $requireMethod('POST');
    $mode = trim((string)($_POST['mode'] ?? 'full'));
    if ($mode !== 'full' && $mode !== 'selected') {
        $fail('settings.site_maintenance.db_restore_upload', 400, 'Invalid database restore mode');
    }
    $groupIds = [];
    if (isset($_POST['group_ids'])) {
        $decoded = json_decode((string)$_POST['group_ids'], true);
        if (is_array($decoded)) {
            $groupIds = $decoded;
        }
    }

    $uploadPath = $resolveUploadFile('backup_file', ['sql', 'txt', 'gz']);
    $tables = $mode === 'full' ? null : $getSelectedDbTables($pdo, $groupIds);
    if ($mode === 'selected' && empty($tables)) {
        $fail('settings.site_maintenance.db_restore_upload', 400, 'Select at least one valid data group');
    }

    $stream = $openSqlStream($uploadPath);
    if (!($stream['handle'] ?? null)) {
        $fail('settings.site_maintenance.db_restore_upload', 400, 'Failed to open uploaded SQL backup');
    }

    try {
        $pdo->exec('SET FOREIGN_KEY_CHECKS=0');
        $result = $streamSqlToPdo($pdo, $stream, $tables);
        $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
        $closeSqlStream($stream);
    } catch (Throwable $e) {
        $closeSqlStream($stream);
        $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
        $fail('settings.site_maintenance.db_restore_upload', 500, 'Database restore failed', ['error' => $e->getMessage()]);
    }

    catn8_diagnostics_log_event('settings.site_maintenance.db_restore_upload', true, 200, 'Database restore upload completed', $result + ['mode' => $mode]);
    catn8_json_response(['success' => true, 'message' => 'Database restore completed', 'result' => $result]);
}

if ($action === 'cleanup_images') {
    $requireMethod('POST');
    $body = $requireJsonBody();
    $dryRun = !empty($body['dry_run']);
    $res = $runImageCleanup($pdo, $dryRun);
    catn8_diagnostics_log_event('settings.site_maintenance.cleanup_images', true, 200, 'Image cleanup completed', ['dry_run' => $dryRun] + $res);
    catn8_json_response(['success' => true, 'message' => $dryRun ? 'Dry run completed' : 'Cleanup completed', 'result' => $res]);
}

$fail('settings.site_maintenance', 400, 'Unknown action');
