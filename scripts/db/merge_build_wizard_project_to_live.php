<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/config.php';

function usage(): void
{
    echo "Usage:\n";
    echo "  php scripts/db/merge_build_wizard_project_to_live.php [--project-id=ID | --project-title=TITLE] [--owner-user-id=ID] [--dry-run]\n";
    echo "\n";
    echo "Examples:\n";
    echo "  php scripts/db/merge_build_wizard_project_to_live.php --project-title='Cabin - 91 Singletree Ln'\n";
    echo "  php scripts/db/merge_build_wizard_project_to_live.php --project-id=1 --dry-run\n";
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

function execStmt(PDO $pdo, string $sql, array $params = []): int
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->rowCount();
}

function tableExists(PDO $pdo, string $tableName): bool
{
    $row = queryOne(
        $pdo,
        'SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1',
        [$tableName]
    );
    return $row !== null;
}

$args = $argv;
array_shift($args);

$projectId = null;
$projectTitle = '';
$ownerUserId = null;
$dryRun = false;

foreach ($args as $arg) {
    if ($arg === '--help' || $arg === '-h') {
        usage();
        exit(0);
    }
    if ($arg === '--dry-run') {
        $dryRun = true;
        continue;
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
}

if ($projectId === null && $projectTitle === '') {
    $projectTitle = 'Cabin - 91 Singletree Ln';
}

$localCfg = catn8_get_db_config('local');
$liveCfg = catn8_get_db_config('live');

$localPdo = Database::createConnection(
    (string)($localCfg['host'] ?? ''),
    (string)($localCfg['db'] ?? ''),
    (string)($localCfg['user'] ?? ''),
    (string)($localCfg['pass'] ?? ''),
    (int)($localCfg['port'] ?? 3306),
    (string)($localCfg['socket'] ?? '')
);

$livePdo = Database::createConnection(
    (string)($liveCfg['host'] ?? ''),
    (string)($liveCfg['db'] ?? ''),
    (string)($liveCfg['user'] ?? ''),
    (string)($liveCfg['pass'] ?? ''),
    (int)($liveCfg['port'] ?? 3306),
    (string)($liveCfg['socket'] ?? '')
);

foreach (['build_wizard_projects', 'build_wizard_documents', 'build_wizard_document_blobs', 'build_wizard_document_images'] as $table) {
    if (!tableExists($localPdo, $table)) {
        throw new RuntimeException('Local table missing: ' . $table);
    }
    if (!tableExists($livePdo, $table)) {
        throw new RuntimeException('Live table missing: ' . $table);
    }
}

$sourceProject = null;
if ($projectId !== null && $projectId > 0) {
    $sourceProject = queryOne($localPdo, 'SELECT * FROM build_wizard_projects WHERE id = ? LIMIT 1', [$projectId]);
}
if ($sourceProject === null && $projectTitle !== '') {
    $sql = 'SELECT * FROM build_wizard_projects WHERE title = ?';
    $params = [$projectTitle];
    if ($ownerUserId !== null && $ownerUserId > 0) {
        $sql .= ' AND owner_user_id = ?';
        $params[] = $ownerUserId;
    }
    $sql .= ' ORDER BY id DESC LIMIT 1';
    $sourceProject = queryOne($localPdo, $sql, $params);
}

if ($sourceProject === null) {
    throw new RuntimeException('Source project not found in local DB.');
}

$sourceProjectId = (int)($sourceProject['id'] ?? 0);
if ($sourceProjectId <= 0) {
    throw new RuntimeException('Source project id is invalid.');
}

$sourceOwnerUserId = (int)($sourceProject['owner_user_id'] ?? 0);
$sourceTitle = trim((string)($sourceProject['title'] ?? ''));
if ($sourceOwnerUserId <= 0 || $sourceTitle === '') {
    throw new RuntimeException('Source project is missing owner/title.');
}

$documents = queryAll(
    $localPdo,
    'SELECT d.*, b.mime_type AS blob_mime_type, b.file_blob, b.file_size_bytes AS blob_size_bytes,
            bi.mime_type AS image_blob_mime_type, bi.image_blob, bi.width_px, bi.height_px, bi.file_size_bytes AS image_blob_size_bytes
     FROM build_wizard_documents d
     LEFT JOIN build_wizard_document_blobs b ON b.document_id = d.id
     LEFT JOIN build_wizard_document_images bi ON bi.document_id = d.id
     WHERE d.project_id = ?
     ORDER BY d.id ASC',
    [$sourceProjectId]
);

$summary = [
    'dry_run' => $dryRun ? 1 : 0,
    'source_project_id' => $sourceProjectId,
    'source_project_title' => $sourceTitle,
    'source_documents' => count($documents),
    'live_project_created' => 0,
    'live_project_id' => 0,
    'documents_inserted' => 0,
    'documents_matched_existing' => 0,
    'document_blobs_written' => 0,
    'document_image_blobs_written' => 0,
    'blueprint_document_id_updated' => 0,
];

$localToLiveDocId = [];

if (!$dryRun) {
    $livePdo->beginTransaction();
}

try {
    $targetProject = queryOne(
        $livePdo,
        'SELECT * FROM build_wizard_projects WHERE owner_user_id = ? AND title = ? ORDER BY id DESC LIMIT 1',
        [$sourceOwnerUserId, $sourceTitle]
    );

    if ($targetProject === null) {
        $summary['live_project_created'] = 1;
        if (!$dryRun) {
            execStmt(
                $livePdo,
                'INSERT INTO build_wizard_projects (owner_user_id, title, status, square_feet, home_style, room_count, bathroom_count, stories_count, lot_address, target_start_date, target_completion_date, wizard_notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $sourceOwnerUserId,
                    $sourceTitle,
                    (string)($sourceProject['status'] ?? 'planning'),
                    isset($sourceProject['square_feet']) ? (int)$sourceProject['square_feet'] : null,
                    (string)($sourceProject['home_style'] ?? ''),
                    isset($sourceProject['room_count']) ? (int)$sourceProject['room_count'] : null,
                    isset($sourceProject['bathroom_count']) ? (int)$sourceProject['bathroom_count'] : null,
                    isset($sourceProject['stories_count']) ? (int)$sourceProject['stories_count'] : null,
                    (string)($sourceProject['lot_address'] ?? ''),
                    $sourceProject['target_start_date'] ?? null,
                    $sourceProject['target_completion_date'] ?? null,
                    $sourceProject['wizard_notes'] ?? null,
                ]
            );
            $targetProjectId = (int)$livePdo->lastInsertId();
        } else {
            $targetProjectId = -1;
        }
    } else {
        $targetProjectId = (int)($targetProject['id'] ?? 0);
    }

    if ($targetProjectId === 0) {
        throw new RuntimeException('Failed resolving target live project id.');
    }
    $summary['live_project_id'] = $targetProjectId;

    foreach ($documents as $doc) {
        $sourceDocId = (int)($doc['id'] ?? 0);
        if ($sourceDocId <= 0) {
            continue;
        }

        $originalName = trim((string)($doc['original_name'] ?? ''));
        if ($originalName === '') {
            continue;
        }

        $targetDoc = ($targetProjectId > 0)
            ? queryOne(
                $livePdo,
                'SELECT id FROM build_wizard_documents WHERE project_id = ? AND original_name = ? ORDER BY id ASC LIMIT 1',
                [$targetProjectId, $originalName]
            )
            : null;

        if ($targetDoc !== null) {
            $targetDocId = (int)($targetDoc['id'] ?? 0);
            $summary['documents_matched_existing']++;
        } else {
            $summary['documents_inserted']++;
            if (!$dryRun) {
                execStmt(
                    $livePdo,
                    'INSERT INTO build_wizard_documents (project_id, step_id, kind, original_name, mime_type, storage_path, file_size_bytes, caption)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        $targetProjectId,
                        null,
                        (string)($doc['kind'] ?? 'other'),
                        $originalName,
                        (string)($doc['mime_type'] ?? 'application/octet-stream'),
                        (string)($doc['storage_path'] ?? ''),
                        (int)($doc['file_size_bytes'] ?? 0),
                        $doc['caption'] ?? null,
                    ]
                );
                $targetDocId = (int)$livePdo->lastInsertId();
            } else {
                $targetDocId = -1;
            }
        }

        if ($targetDocId === 0) {
            continue;
        }

        $localToLiveDocId[$sourceDocId] = $targetDocId;

        $blobBytes = $doc['file_blob'] ?? null;
        if (is_string($blobBytes) && $blobBytes !== '') {
            $summary['document_blobs_written']++;
            if (!$dryRun) {
                execStmt(
                    $livePdo,
                    'INSERT INTO build_wizard_document_blobs (document_id, mime_type, file_blob, file_size_bytes)
                     VALUES (?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), file_blob = VALUES(file_blob), file_size_bytes = VALUES(file_size_bytes)',
                    [
                        $targetDocId,
                        (string)($doc['blob_mime_type'] ?? $doc['mime_type'] ?? 'application/octet-stream'),
                        $blobBytes,
                        (int)($doc['blob_size_bytes'] ?? strlen($blobBytes)),
                    ]
                );
            }
        }

        $imageBlobBytes = $doc['image_blob'] ?? null;
        if (is_string($imageBlobBytes) && $imageBlobBytes !== '') {
            $summary['document_image_blobs_written']++;
            if (!$dryRun) {
                execStmt(
                    $livePdo,
                    'INSERT INTO build_wizard_document_images (document_id, mime_type, image_blob, width_px, height_px, file_size_bytes)
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), image_blob = VALUES(image_blob), width_px = VALUES(width_px), height_px = VALUES(height_px), file_size_bytes = VALUES(file_size_bytes)',
                    [
                        $targetDocId,
                        (string)($doc['image_blob_mime_type'] ?? $doc['mime_type'] ?? 'image/jpeg'),
                        $imageBlobBytes,
                        isset($doc['width_px']) ? (int)$doc['width_px'] : null,
                        isset($doc['height_px']) ? (int)$doc['height_px'] : null,
                        (int)($doc['image_blob_size_bytes'] ?? strlen($imageBlobBytes)),
                    ]
                );
            }
        }
    }

    $sourceBlueprintId = (int)($sourceProject['blueprint_document_id'] ?? 0);
    if ($sourceBlueprintId > 0 && isset($localToLiveDocId[$sourceBlueprintId])) {
        $targetBlueprintId = (int)$localToLiveDocId[$sourceBlueprintId];
        if ($targetBlueprintId > 0) {
            $summary['blueprint_document_id_updated'] = 1;
            if (!$dryRun) {
                execStmt(
                    $livePdo,
                    'UPDATE build_wizard_projects SET blueprint_document_id = ? WHERE id = ?',
                    [$targetBlueprintId, $targetProjectId]
                );
            }
        }
    }

    if (!$dryRun && $livePdo->inTransaction()) {
        $livePdo->commit();
    }
} catch (Throwable $e) {
    if (!$dryRun && $livePdo->inTransaction()) {
        $livePdo->rollBack();
    }
    throw $e;
}

echo json_encode(['success' => true, 'summary' => $summary], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
