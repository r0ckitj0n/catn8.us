<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/config.php';

function usage(): void
{
    echo "Usage:\n";
    echo "  php scripts/db/export_build_wizard_project_merge_sql.php [--project-id=ID | --project-title=TITLE] [--owner-user-id=ID] [--out=PATH]\n";
}

function queryOne(PDO $pdo, string $sql, array $params = []): ?array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row === false ? null : $row;
}

function queryAll(PDO $pdo, string $sql, array $params = []): array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

function esc(?string $value): string
{
    if ($value === null) {
        return 'NULL';
    }
    return "'" . str_replace("'", "''", $value) . "'";
}

$args = $argv;
array_shift($args);

$projectId = null;
$projectTitle = '';
$ownerUserId = null;
$outPath = '';

foreach ($args as $arg) {
    if ($arg === '--help' || $arg === '-h') {
        usage();
        exit(0);
    }
    if (str_starts_with($arg, '--project-id=')) {
        $v = (int)trim((string)substr($arg, 13));
        if ($v > 0) {
            $projectId = $v;
        }
        continue;
    }
    if (str_starts_with($arg, '--project-title=')) {
        $v = trim((string)substr($arg, 16));
        if ($v !== '') {
            $projectTitle = $v;
        }
        continue;
    }
    if (str_starts_with($arg, '--owner-user-id=')) {
        $v = (int)trim((string)substr($arg, 16));
        if ($v > 0) {
            $ownerUserId = $v;
        }
        continue;
    }
    if (str_starts_with($arg, '--out=')) {
        $v = trim((string)substr($arg, 6));
        if ($v !== '') {
            $outPath = $v;
        }
        continue;
    }
}

if ($projectId === null && $projectTitle === '') {
    $projectTitle = 'Cabin - 91 Singletree Ln';
}

if ($outPath === '') {
    $safe = preg_replace('/[^A-Za-z0-9._-]+/', '_', $projectTitle !== '' ? $projectTitle : ('project_' . (string)$projectId));
    if (!is_string($safe) || $safe === '') {
        $safe = 'build_wizard_project';
    }
    $outPath = dirname(__DIR__, 2) . '/backups/sql/build_wizard_merge_' . $safe . '_' . gmdate('Ymd_His') . '.sql';
}

$localCfg = catn8_get_db_config('local');
$pdo = Database::createConnection(
    (string)($localCfg['host'] ?? ''),
    (string)($localCfg['db'] ?? ''),
    (string)($localCfg['user'] ?? ''),
    (string)($localCfg['pass'] ?? ''),
    (int)($localCfg['port'] ?? 3306),
    (string)($localCfg['socket'] ?? '')
);

$project = null;
if ($projectId !== null && $projectId > 0) {
    $project = queryOne($pdo, 'SELECT * FROM build_wizard_projects WHERE id = ? LIMIT 1', [$projectId]);
}
if ($project === null && $projectTitle !== '') {
    $sql = 'SELECT * FROM build_wizard_projects WHERE title = ?';
    $params = [$projectTitle];
    if ($ownerUserId !== null && $ownerUserId > 0) {
        $sql .= ' AND owner_user_id = ?';
        $params[] = $ownerUserId;
    }
    $sql .= ' ORDER BY id DESC LIMIT 1';
    $project = queryOne($pdo, $sql, $params);
}
if ($project === null) {
    throw new RuntimeException('Project not found in local DB.');
}

$sourceProjectId = (int)($project['id'] ?? 0);
$sourceOwnerUserId = (int)($project['owner_user_id'] ?? 0);
$sourceTitle = trim((string)($project['title'] ?? ''));
if ($sourceProjectId <= 0 || $sourceOwnerUserId <= 0 || $sourceTitle === '') {
    throw new RuntimeException('Invalid project values.');
}

$docs = queryAll(
    $pdo,
    'SELECT d.*
     FROM build_wizard_documents d
     WHERE d.project_id = ?
     ORDER BY d.id ASC',
    [$sourceProjectId]
);

$blueprintLocalId = (int)($project['blueprint_document_id'] ?? 0);

$dir = dirname($outPath);
if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
    throw new RuntimeException('Failed to create output dir: ' . $dir);
}

$fh = fopen($outPath, 'wb');
if ($fh === false) {
    throw new RuntimeException('Failed to open output file: ' . $outPath);
}

fwrite($fh, "-- Build Wizard merge export generated at " . gmdate('c') . " UTC\n");
fwrite($fh, "SET NAMES utf8mb4;\n");
fwrite($fh, "SET FOREIGN_KEY_CHECKS=0;\n\n");

fwrite($fh, "SET @bw_owner_user_id := " . $sourceOwnerUserId . ";\n");
fwrite($fh, "SET @bw_project_title := " . esc($sourceTitle) . ";\n\n");

fwrite($fh, "INSERT INTO build_wizard_projects (owner_user_id, title, status, square_feet, home_style, room_count, bathroom_count, stories_count, lot_address, target_start_date, target_completion_date, wizard_notes)\n");
fwrite($fh, "SELECT @bw_owner_user_id, @bw_project_title, " . esc((string)($project['status'] ?? 'planning')) . ", ");
fwrite($fh, ($project['square_feet'] !== null ? (int)$project['square_feet'] : 'NULL') . ", ");
fwrite($fh, esc((string)($project['home_style'] ?? '')) . ", ");
fwrite($fh, ($project['room_count'] !== null ? (int)$project['room_count'] : 'NULL') . ", ");
fwrite($fh, ($project['bathroom_count'] !== null ? (int)$project['bathroom_count'] : 'NULL') . ", ");
fwrite($fh, ($project['stories_count'] !== null ? (int)$project['stories_count'] : 'NULL') . ", ");
fwrite($fh, esc((string)($project['lot_address'] ?? '')) . ", ");
fwrite($fh, ($project['target_start_date'] !== null ? esc((string)$project['target_start_date']) : 'NULL') . ", ");
fwrite($fh, ($project['target_completion_date'] !== null ? esc((string)$project['target_completion_date']) : 'NULL') . ", ");
fwrite($fh, ($project['wizard_notes'] !== null ? esc((string)$project['wizard_notes']) : 'NULL') . "\n");
fwrite($fh, "WHERE NOT EXISTS (SELECT 1 FROM build_wizard_projects WHERE owner_user_id=@bw_owner_user_id AND BINARY title = BINARY @bw_project_title);\n");
fwrite($fh, "SET @bw_project_id := (SELECT id FROM build_wizard_projects WHERE owner_user_id=@bw_owner_user_id AND BINARY title = BINARY @bw_project_title ORDER BY id DESC LIMIT 1);\n\n");

$localDocToVar = [];
$idx = 0;
foreach ($docs as $doc) {
    $idx++;
    $localDocId = (int)($doc['id'] ?? 0);
    if ($localDocId <= 0) {
        continue;
    }

    $var = '@bw_doc_id_' . $idx;
    $localDocToVar[$localDocId] = $var;

    $originalName = (string)($doc['original_name'] ?? '');
    if ($originalName === '') {
        continue;
    }

    fwrite($fh, "-- document: " . str_replace(["\r", "\n"], [' ', ' '], $originalName) . "\n");
    fwrite($fh, "INSERT INTO build_wizard_documents (project_id, step_id, kind, original_name, mime_type, storage_path, file_size_bytes, caption)\n");
    fwrite($fh, "SELECT @bw_project_id, NULL, " . esc((string)($doc['kind'] ?? 'other')) . ", " . esc($originalName) . ", ");
    fwrite($fh, esc((string)($doc['mime_type'] ?? 'application/octet-stream')) . ", ");
    fwrite($fh, esc((string)($doc['storage_path'] ?? '')) . ", ");
    fwrite($fh, (int)($doc['file_size_bytes'] ?? 0) . ", ");
    fwrite($fh, ($doc['caption'] !== null ? esc((string)$doc['caption']) : 'NULL') . "\n");
    fwrite($fh, "WHERE NOT EXISTS (SELECT 1 FROM build_wizard_documents WHERE project_id=@bw_project_id AND BINARY original_name = BINARY " . esc($originalName) . ");\n");
    fwrite($fh, "SET {$var} := (SELECT id FROM build_wizard_documents WHERE project_id=@bw_project_id AND BINARY original_name = BINARY " . esc($originalName) . " ORDER BY id ASC LIMIT 1);\n");

    $blobRow = queryOne(
        $pdo,
        'SELECT mime_type, file_blob, file_size_bytes FROM build_wizard_document_blobs WHERE document_id = ? LIMIT 1',
        [$localDocId]
    );
    $blob = $blobRow['file_blob'] ?? null;
    if (is_string($blob) && $blob !== '') {
        $hex = strtoupper(bin2hex($blob));
        $blobMime = (string)($blobRow['mime_type'] ?? $doc['mime_type'] ?? 'application/octet-stream');
        $blobSize = (int)($blobRow['file_size_bytes'] ?? strlen($blob));
        fwrite($fh, "INSERT INTO build_wizard_document_blobs (document_id, mime_type, file_blob, file_size_bytes)\n");
        fwrite($fh, "VALUES ({$var}, " . esc($blobMime) . ", 0x{$hex}, {$blobSize})\n");
        fwrite($fh, "ON DUPLICATE KEY UPDATE mime_type=VALUES(mime_type), file_blob=VALUES(file_blob), file_size_bytes=VALUES(file_size_bytes);\n");
    }

    $imgRow = queryOne(
        $pdo,
        'SELECT mime_type, image_blob, width_px, height_px, file_size_bytes FROM build_wizard_document_images WHERE document_id = ? LIMIT 1',
        [$localDocId]
    );
    $imgBlob = $imgRow['image_blob'] ?? null;
    if (is_string($imgBlob) && $imgBlob !== '') {
        $hex = strtoupper(bin2hex($imgBlob));
        $imgMime = (string)($imgRow['mime_type'] ?? $doc['mime_type'] ?? 'image/jpeg');
        $imgSize = (int)($imgRow['file_size_bytes'] ?? strlen($imgBlob));
        $width = ($imgRow !== null && array_key_exists('width_px', $imgRow) && $imgRow['width_px'] !== null) ? (int)$imgRow['width_px'] : 'NULL';
        $height = ($imgRow !== null && array_key_exists('height_px', $imgRow) && $imgRow['height_px'] !== null) ? (int)$imgRow['height_px'] : 'NULL';
        fwrite($fh, "INSERT INTO build_wizard_document_images (document_id, mime_type, image_blob, width_px, height_px, file_size_bytes)\n");
        fwrite($fh, "VALUES ({$var}, " . esc($imgMime) . ", 0x{$hex}, {$width}, {$height}, {$imgSize})\n");
        fwrite($fh, "ON DUPLICATE KEY UPDATE mime_type=VALUES(mime_type), image_blob=VALUES(image_blob), width_px=VALUES(width_px), height_px=VALUES(height_px), file_size_bytes=VALUES(file_size_bytes);\n");
    }

    fwrite($fh, "\n");
}

if ($blueprintLocalId > 0 && isset($localDocToVar[$blueprintLocalId])) {
    fwrite($fh, "UPDATE build_wizard_projects SET blueprint_document_id = " . $localDocToVar[$blueprintLocalId] . " WHERE id = @bw_project_id;\n\n");
}

fwrite($fh, "SET FOREIGN_KEY_CHECKS=1;\n");

fclose($fh);

echo json_encode([
    'success' => true,
    'project_id' => $sourceProjectId,
    'project_title' => $sourceTitle,
    'documents' => count($docs),
    'blueprint_document_id' => $blueprintLocalId,
    'out' => $outPath,
    'bytes' => filesize($outPath),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
