<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/config.php';

function bw_recover_usage(): void
{
    echo "Usage:\n";
    echo "  php scripts/maintenance/recover_build_wizard_singletree_documents.php [--apply] [--db-env=live|local]\n";
    echo "      [--project-title=\"Cabin - 91 Singletree Ln\"] [--source-root=\"/Users/jongraves/Documents/Home/91 Singletree Ln\"]\n";
    echo "      [--owner-user-id=<id>] [--include-archives]\n";
    echo "\n";
    echo "Notes:\n";
    echo "  - Dry-run by default. Use --apply to write.\n";
    echo "  - Matches existing docs first by filename normalization.\n";
    echo "  - Inserts missing docs, assigns kind/step, and backfills blobs.\n";
}

function bw_recover_parse_args(array $argv): array
{
    $opts = [
        'apply' => false,
        'db_env' => 'live',
        'project_title' => 'Cabin - 91 Singletree Ln',
        'source_root' => '/Users/jongraves/Documents/Home/91 Singletree Ln',
        'owner_user_id' => null,
        'include_archives' => false,
    ];

    foreach ($argv as $arg) {
        if ($arg === '--apply') {
            $opts['apply'] = true;
            continue;
        }
        if ($arg === '--include-archives') {
            $opts['include_archives'] = true;
            continue;
        }
        if ($arg === '--help' || $arg === '-h') {
            bw_recover_usage();
            exit(0);
        }
        if (str_starts_with($arg, '--db-env=')) {
            $v = strtolower(trim((string)substr($arg, 9)));
            if (in_array($v, ['live', 'local'], true)) {
                $opts['db_env'] = $v;
            }
            continue;
        }
        if (str_starts_with($arg, '--project-title=')) {
            $v = trim((string)substr($arg, 16));
            if ($v !== '') {
                $opts['project_title'] = $v;
            }
            continue;
        }
        if (str_starts_with($arg, '--source-root=')) {
            $v = trim((string)substr($arg, 14));
            if ($v !== '') {
                $opts['source_root'] = $v;
            }
            continue;
        }
        if (str_starts_with($arg, '--owner-user-id=')) {
            $v = (int)trim((string)substr($arg, 16));
            $opts['owner_user_id'] = $v > 0 ? $v : null;
            continue;
        }
    }

    return $opts;
}

function bw_recover_connect(string $dbEnv): PDO
{
    $cfg = catn8_get_db_config($dbEnv);
    $host = trim((string)($cfg['host'] ?? ''));
    $db = trim((string)($cfg['db'] ?? ''));
    $user = trim((string)($cfg['user'] ?? ''));
    $pass = (string)($cfg['pass'] ?? '');
    $port = (int)($cfg['port'] ?? 3306);
    $socket = trim((string)($cfg['socket'] ?? ''));

    if ($db === '' || $user === '' || ($host === '' && $socket === '')) {
        throw new RuntimeException('DB config for --db-env=' . $dbEnv . ' is incomplete');
    }
    return Database::createConnection($host, $db, $user, $pass, $port, $socket);
}

function bw_recover_query_all(PDO $pdo, string $sql, array $params = []): array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

function bw_recover_query_one(PDO $pdo, string $sql, array $params = []): ?array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row === false ? null : $row;
}

function bw_recover_exec(PDO $pdo, string $sql, array $params = []): int
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->rowCount();
}

function bw_recover_table_exists(PDO $pdo, string $tableName): bool
{
    $row = bw_recover_query_one(
        $pdo,
        'SELECT 1 AS ok
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
         LIMIT 1',
        [$tableName]
    );
    return $row !== null;
}

function bw_recover_ensure_tables(PDO $pdo): void
{
    $pdo->exec("CREATE TABLE IF NOT EXISTS build_wizard_document_blobs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        document_id INT NOT NULL,
        mime_type VARCHAR(120) NOT NULL DEFAULT 'application/octet-stream',
        file_blob LONGBLOB NOT NULL,
        file_size_bytes INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_document_id (document_id),
        CONSTRAINT fk_build_wizard_document_blobs_document FOREIGN KEY (document_id) REFERENCES build_wizard_documents(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS build_wizard_document_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        document_id INT NOT NULL,
        mime_type VARCHAR(120) NOT NULL DEFAULT 'image/jpeg',
        image_blob LONGBLOB NOT NULL,
        width_px INT NULL,
        height_px INT NULL,
        file_size_bytes INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_document_id (document_id),
        CONSTRAINT fk_build_wizard_document_images_document FOREIGN KEY (document_id) REFERENCES build_wizard_documents(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function bw_recover_filename_canonical(string $name): string
{
    $v = strtolower(trim($name));
    $v = preg_replace('/[^a-z0-9]+/', '', $v);
    return is_string($v) ? $v : '';
}

function bw_recover_safe_storage_name(string $baseName): string
{
    $safe = preg_replace('/[^A-Za-z0-9._-]+/', '_', $baseName);
    if (!is_string($safe) || $safe === '') {
        $safe = 'document';
    }
    return gmdate('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '_' . $safe;
}

function bw_recover_guess_kind(string $path): string
{
    $name = strtolower(basename($path));
    $dir = strtolower(dirname($path));
    $ext = strtolower((string)pathinfo($name, PATHINFO_EXTENSION));
    $ctx = $name . ' ' . $dir;

    if (str_contains($ctx, 'plat') || str_contains($ctx, 'survey')) {
        return 'survey';
    }
    if (
        str_contains($ctx, 'permit')
        || str_contains($ctx, 'septic')
        || str_contains($ctx, 'siteplan')
        || str_contains($ctx, 'setback')
        || str_contains($ctx, 'encroachment')
    ) {
        return 'permit';
    }
    if (
        str_contains($ctx, 'elevation')
        || str_contains($ctx, 'foundation')
        || str_contains($ctx, 'framing')
        || str_contains($ctx, 'dimension')
        || $ext === 'plan'
        || $ext === 'dwg'
        || str_contains($ctx, 'cabin-')
    ) {
        return 'blueprint';
    }
    if (
        str_contains($ctx, 'receipt')
        || str_contains($ctx, 'invoice')
        || str_contains($ctx, 'expense')
        || str_contains($ctx, 'shopping')
        || str_contains($ctx, 'materials')
        || str_contains($ctx, 'coupon')
    ) {
        return 'receipt';
    }
    if (
        str_contains($ctx, 'manual')
        || str_contains($ctx, 'catalog')
        || str_contains($ctx, 'submittal')
        || str_contains($ctx, 'engineering')
        || str_contains($ctx, 'load calculation')
        || in_array($ext, ['xlsx', 'xlsm', 'xls', 'csv', 'numbers'], true)
    ) {
        return 'spec_sheet';
    }
    if (in_array($ext, ['png', 'jpg', 'jpeg', 'gif', 'webp'], true)) {
        if (str_contains($ctx, 'site') || str_contains($ctx, 'satellite') || str_contains($ctx, 'outside')) {
            return 'site_photo';
        }
        if (str_contains($ctx, 'progress')) {
            return 'progress_photo';
        }
        return 'home_photo';
    }
    return 'other';
}

function bw_recover_guess_phase_key(string $kind, string $path): string
{
    $ctx = strtolower($path);
    if ($kind === 'survey') {
        return 'land_due_diligence';
    }
    if ($kind === 'permit') {
        return 'dawson_county_permits';
    }
    if ($kind === 'blueprint' || $kind === 'spec_sheet') {
        if (str_contains($ctx, 'foundation')) {
            return 'foundation';
        }
        if (str_contains($ctx, 'framing') || str_contains($ctx, 'gable') || str_contains($ctx, 'dimension')) {
            return 'framing_shell';
        }
        if (str_contains($ctx, 'electric') || str_contains($ctx, 'breaker') || str_contains($ctx, 'hvac') || str_contains($ctx, 'septic')) {
            return 'mep_rough_in';
        }
        return 'design_preconstruction';
    }
    if ($kind === 'site_photo' || $kind === 'home_photo' || $kind === 'progress_photo') {
        return 'site_preparation';
    }
    if ($kind === 'receipt') {
        return 'interior_finishes';
    }
    return 'general';
}

function bw_recover_pick_step_id(PDO $pdo, int $projectId, string $phaseKey): ?int
{
    $params = [$projectId];
    $sql = 'SELECT id
            FROM build_wizard_steps
            WHERE project_id = ?';
    if ($phaseKey !== 'general') {
        $sql .= ' AND phase_key = ?';
        $params[] = $phaseKey;
    }
    $sql .= ' ORDER BY is_completed ASC, step_order ASC, id ASC LIMIT 1';
    $row = bw_recover_query_one($pdo, $sql, $params);
    if (!$row) {
        return null;
    }
    $id = (int)($row['id'] ?? 0);
    return $id > 0 ? $id : null;
}

function bw_recover_detect_mime(string $path): string
{
    $mime = '';
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo) {
            $detected = finfo_file($finfo, $path);
            finfo_close($finfo);
            if (is_string($detected)) {
                $mime = trim($detected);
            }
        }
    }
    if ($mime === '') {
        $mime = 'application/octet-stream';
    }
    return $mime;
}

function bw_recover_is_supported(string $path, bool $includeArchives): bool
{
    $normalized = str_replace('\\', '/', $path);
    if (!$includeArchives && str_contains($normalized, '/~Archives/')) {
        return false;
    }
    if (str_contains($normalized, '/.numbers/')) {
        return false;
    }
    $base = basename($normalized);
    if ($base === '.DS_Store') {
        return false;
    }
    $ext = strtolower((string)pathinfo($base, PATHINFO_EXTENSION));
    $allowed = [
        'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp',
        'xlsx', 'xlsm', 'xls', 'csv', 'numbers',
        'plan', 'dwg', 'doc', 'docx', 'txt',
        'skp', 'sh3d',
    ];
    return in_array($ext, $allowed, true);
}

$args = $argv;
array_shift($args);
$opt = bw_recover_parse_args($args);

$sourceRoot = rtrim((string)$opt['source_root'], '/');
if (!is_dir($sourceRoot)) {
    fwrite(STDERR, "Source root not found: {$sourceRoot}\n");
    exit(1);
}

try {
    $pdo = bw_recover_connect((string)$opt['db_env']);
    foreach (['build_wizard_projects', 'build_wizard_documents', 'build_wizard_steps'] as $requiredTable) {
        if (!bw_recover_table_exists($pdo, $requiredTable)) {
            throw new RuntimeException('Required table missing in selected DB: ' . $requiredTable);
        }
    }
    bw_recover_ensure_tables($pdo);
} catch (Throwable $e) {
    fwrite(STDERR, "DB connect/setup failed: " . $e->getMessage() . "\n");
    exit(1);
}

$projectTitle = (string)$opt['project_title'];
$ownerUserId = $opt['owner_user_id'];

$projectSql = 'SELECT id, owner_user_id, title, blueprint_document_id
               FROM build_wizard_projects
               WHERE title = ?';
$projectParams = [$projectTitle];
if (is_int($ownerUserId) && $ownerUserId > 0) {
    $projectSql .= ' AND owner_user_id = ?';
    $projectParams[] = $ownerUserId;
}
$projectSql .= ' ORDER BY id DESC LIMIT 1';

$project = bw_recover_query_one($pdo, $projectSql, $projectParams);
if (!$project) {
    fwrite(STDERR, "Project not found: {$projectTitle}\n");
    exit(1);
}

$projectId = (int)($project['id'] ?? 0);
if ($projectId <= 0) {
    fwrite(STDERR, "Resolved project_id is invalid.\n");
    exit(1);
}

$existingDocs = bw_recover_query_all(
    $pdo,
    'SELECT d.id, d.project_id, d.step_id, d.kind, d.original_name, d.mime_type, d.storage_path, d.file_size_bytes, d.caption,
            CASE WHEN b.document_id IS NULL THEN 0 ELSE 1 END AS has_blob
     FROM build_wizard_documents d
     LEFT JOIN build_wizard_document_blobs b ON b.document_id = d.id
     WHERE d.project_id = ?
     ORDER BY d.id ASC',
    [$projectId]
);

$existingByCanonical = [];
foreach ($existingDocs as $doc) {
    $canon = bw_recover_filename_canonical((string)($doc['original_name'] ?? ''));
    if ($canon === '') {
        continue;
    }
    if (!isset($existingByCanonical[$canon])) {
        $existingByCanonical[$canon] = [];
    }
    $existingByCanonical[$canon][] = $doc;
}

$sourceFiles = [];
$iter = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($sourceRoot, FilesystemIterator::SKIP_DOTS));
foreach ($iter as $info) {
    if (!$info instanceof SplFileInfo || !$info->isFile()) {
        continue;
    }
    $path = $info->getPathname();
    if (!bw_recover_is_supported($path, (bool)$opt['include_archives'])) {
        continue;
    }
    $sourceFiles[] = $path;
}
sort($sourceFiles, SORT_NATURAL | SORT_FLAG_CASE);

$apply = (bool)$opt['apply'];
$stats = [
    'project_id' => $projectId,
    'project_title' => $projectTitle,
    'apply' => $apply ? 1 : 0,
    'source_root' => $sourceRoot,
    'source_files_considered' => count($sourceFiles),
    'existing_documents_before' => count($existingDocs),
    'matched_existing' => 0,
    'inserted_documents' => 0,
    'updated_mappings' => 0,
    'blob_backfilled' => 0,
    'image_blob_backfilled' => 0,
    'skipped_duplicates' => 0,
    'blueprint_document_id_set' => 0,
];

$projectRoot = dirname(__DIR__, 2);
$uploadDir = $projectRoot . '/images/build-wizard';
if ($apply && !is_dir($uploadDir) && !mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
    fwrite(STDERR, "Failed to create upload directory: {$uploadDir}\n");
    exit(1);
}

$changesPreview = [];

if ($apply) {
    $pdo->beginTransaction();
}

try {
    foreach ($sourceFiles as $path) {
        $baseName = basename($path);
        $canon = bw_recover_filename_canonical($baseName);
        if ($canon === '') {
            continue;
        }

        $kind = bw_recover_guess_kind($path);
        $phaseKey = bw_recover_guess_phase_key($kind, $path);
        $stepId = bw_recover_pick_step_id($pdo, $projectId, $phaseKey);
        $mime = bw_recover_detect_mime($path);
        $size = (int)filesize($path);

        $targetDoc = null;
        if (isset($existingByCanonical[$canon]) && is_array($existingByCanonical[$canon]) && $existingByCanonical[$canon]) {
            $targetDoc = $existingByCanonical[$canon][0];
            $stats['matched_existing']++;
            if (count($existingByCanonical[$canon]) > 1) {
                $stats['skipped_duplicates'] += (count($existingByCanonical[$canon]) - 1);
            }
        }

        if ($targetDoc !== null) {
            $docId = (int)($targetDoc['id'] ?? 0);
            if ($docId <= 0) {
                continue;
            }

            $updateCols = [];
            $updateParams = [];

            $currentKind = (string)($targetDoc['kind'] ?? 'other');
            if ($currentKind !== $kind && $kind !== 'other') {
                $updateCols[] = 'kind = ?';
                $updateParams[] = $kind;
            }

            $currentStep = isset($targetDoc['step_id']) ? (int)$targetDoc['step_id'] : 0;
            if ($stepId !== null && $stepId > 0 && $currentStep !== $stepId) {
                $updateCols[] = 'step_id = ?';
                $updateParams[] = $stepId;
            }

            if ($updateCols) {
                $stats['updated_mappings']++;
                $changesPreview[] = [
                    'action' => 'update_mapping',
                    'document_id' => $docId,
                    'name' => $baseName,
                    'kind' => $kind,
                    'step_id' => $stepId,
                ];
                if ($apply) {
                    $updateParams[] = $docId;
                    bw_recover_exec($pdo, 'UPDATE build_wizard_documents SET ' . implode(', ', $updateCols) . ' WHERE id = ?', $updateParams);
                }
            }

            $hasBlob = (int)($targetDoc['has_blob'] ?? 0) === 1;
            if (!$hasBlob) {
                $bytes = @file_get_contents($path);
                if (is_string($bytes) && $bytes !== '') {
                    $stats['blob_backfilled']++;
                    if (str_starts_with(strtolower($mime), 'image/')) {
                        $stats['image_blob_backfilled']++;
                    }
                    $changesPreview[] = [
                        'action' => 'backfill_blob',
                        'document_id' => $docId,
                        'name' => $baseName,
                        'bytes' => strlen($bytes),
                    ];
                    if ($apply) {
                        bw_recover_exec(
                            $pdo,
                            'INSERT INTO build_wizard_document_blobs (document_id, mime_type, file_blob, file_size_bytes)
                             VALUES (?, ?, ?, ?)
                             ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), file_blob = VALUES(file_blob), file_size_bytes = VALUES(file_size_bytes)',
                            [$docId, $mime, $bytes, strlen($bytes)]
                        );
                        if (str_starts_with(strtolower($mime), 'image/')) {
                            $sizeInfo = @getimagesize($path);
                            $width = is_array($sizeInfo) && isset($sizeInfo[0]) ? (int)$sizeInfo[0] : null;
                            $height = is_array($sizeInfo) && isset($sizeInfo[1]) ? (int)$sizeInfo[1] : null;
                            bw_recover_exec(
                                $pdo,
                                'INSERT INTO build_wizard_document_images (document_id, mime_type, image_blob, width_px, height_px, file_size_bytes)
                                 VALUES (?, ?, ?, ?, ?, ?)
                                 ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), image_blob = VALUES(image_blob), width_px = VALUES(width_px), height_px = VALUES(height_px), file_size_bytes = VALUES(file_size_bytes)',
                                [$docId, $mime, $bytes, $width, $height, strlen($bytes)]
                            );
                        }
                    }
                }
            }

            continue;
        }

        $changesPreview[] = [
            'action' => 'insert_document',
            'name' => $baseName,
            'kind' => $kind,
            'step_id' => $stepId,
            'mime' => $mime,
            'size' => $size,
        ];
        $stats['inserted_documents']++;

        if (!$apply) {
            continue;
        }

        $storedName = bw_recover_safe_storage_name($baseName);
        $destPath = $uploadDir . '/' . $storedName;
        if (!copy($path, $destPath)) {
            throw new RuntimeException('Failed to copy source file into uploads: ' . $path);
        }

        bw_recover_exec(
            $pdo,
            'INSERT INTO build_wizard_documents (project_id, step_id, kind, original_name, mime_type, storage_path, file_size_bytes, caption)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$projectId, ($stepId !== null && $stepId > 0 ? $stepId : null), $kind, $baseName, $mime, $destPath, $size, null]
        );
        $docId = (int)$pdo->lastInsertId();
        if ($docId <= 0) {
            throw new RuntimeException('Failed inserting document row for: ' . $baseName);
        }

        $bytes = @file_get_contents($destPath);
        if (is_string($bytes) && $bytes !== '') {
            bw_recover_exec(
                $pdo,
                'INSERT INTO build_wizard_document_blobs (document_id, mime_type, file_blob, file_size_bytes)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), file_blob = VALUES(file_blob), file_size_bytes = VALUES(file_size_bytes)',
                [$docId, $mime, $bytes, strlen($bytes)]
            );
            $stats['blob_backfilled']++;
            if (str_starts_with(strtolower($mime), 'image/')) {
                $sizeInfo = @getimagesize($destPath);
                $width = is_array($sizeInfo) && isset($sizeInfo[0]) ? (int)$sizeInfo[0] : null;
                $height = is_array($sizeInfo) && isset($sizeInfo[1]) ? (int)$sizeInfo[1] : null;
                bw_recover_exec(
                    $pdo,
                    'INSERT INTO build_wizard_document_images (document_id, mime_type, image_blob, width_px, height_px, file_size_bytes)
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), image_blob = VALUES(image_blob), width_px = VALUES(width_px), height_px = VALUES(height_px), file_size_bytes = VALUES(file_size_bytes)',
                    [$docId, $mime, $bytes, $width, $height, strlen($bytes)]
                );
                $stats['image_blob_backfilled']++;
            }
        }
    }

    $blueprintRow = bw_recover_query_one(
        $pdo,
        "SELECT id
         FROM build_wizard_documents
         WHERE project_id = ? AND kind = 'blueprint'
         ORDER BY
             CASE WHEN LOWER(original_name) LIKE '%main%' THEN 0 ELSE 1 END,
             CASE WHEN LOWER(original_name) LIKE '%cabin%' THEN 0 ELSE 1 END,
             id ASC
         LIMIT 1",
        [$projectId]
    );
    $blueprintDocId = (int)($blueprintRow['id'] ?? 0);
    $existingBlueprintDocId = (int)($project['blueprint_document_id'] ?? 0);
    if ($blueprintDocId > 0 && $blueprintDocId !== $existingBlueprintDocId) {
        $stats['blueprint_document_id_set'] = 1;
        $changesPreview[] = [
            'action' => 'set_blueprint_document_id',
            'project_id' => $projectId,
            'blueprint_document_id' => $blueprintDocId,
        ];
        if ($apply) {
            bw_recover_exec($pdo, 'UPDATE build_wizard_projects SET blueprint_document_id = ? WHERE id = ?', [$blueprintDocId, $projectId]);
        }
    }

    if ($apply) {
        $pdo->commit();
    }
} catch (Throwable $e) {
    if ($apply && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, "Recovery failed: " . $e->getMessage() . "\n");
    exit(1);
}

$stats['existing_documents_after'] = (int)(bw_recover_query_one(
    $pdo,
    'SELECT COUNT(*) AS c FROM build_wizard_documents WHERE project_id = ?',
    [$projectId]
)['c'] ?? 0);

echo json_encode(
    [
        'success' => true,
        'summary' => $stats,
        'preview_sample' => array_slice($changesPreview, 0, 60),
    ],
    JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
) . PHP_EOL;
