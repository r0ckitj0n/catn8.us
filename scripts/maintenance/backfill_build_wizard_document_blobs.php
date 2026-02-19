<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/bootstrap.php';

function bw_blob_usage(): void
{
    echo "Usage: php scripts/maintenance/backfill_build_wizard_document_blobs.php [--apply]\n";
    echo "  --apply  Write missing file blobs into build_wizard_document_blobs.\n";
}

function bw_blob_resolve_path(string $storagePath, string $projectRoot): string
{
    $rawPath = trim($storagePath);
    if ($rawPath === '') {
        return '';
    }

    if (is_file($rawPath)) {
        return $rawPath;
    }

    $normalized = str_replace('\\', '/', $rawPath);
    $uploadRoot = $projectRoot . '/uploads/build-wizard';
    $stageRoot = $projectRoot . '/.local/state/build_wizard_import/stage_docs';

    if ($normalized !== '' && $normalized[0] !== '/') {
        $candidate = $projectRoot . '/' . ltrim($normalized, '/');
        if (is_file($candidate)) {
            return $candidate;
        }
    }

    foreach (['/uploads/build-wizard/', '/.local/state/build_wizard_import/stage_docs/'] as $marker) {
        $markerPos = strpos($normalized, $marker);
        if ($markerPos === false) {
            continue;
        }
        $relative = substr($normalized, $markerPos + 1);
        if (!is_string($relative) || $relative === '') {
            continue;
        }
        $candidate = $projectRoot . '/' . $relative;
        if (is_file($candidate)) {
            return $candidate;
        }
    }

    $baseName = basename($normalized);
    if ($baseName !== '' && $baseName !== '.' && $baseName !== '..') {
        foreach ([$uploadRoot, $stageRoot] as $root) {
            $candidate = $root . '/' . $baseName;
            if (is_file($candidate)) {
                return $candidate;
            }
        }
    }

    return '';
}

$args = $argv;
array_shift($args);
if (in_array('--help', $args, true) || in_array('-h', $args, true)) {
    bw_blob_usage();
    exit(0);
}
$apply = in_array('--apply', $args, true);

$projectRoot = dirname(__DIR__, 2);

$hasDocumentsTable = Database::queryOne(
    'SELECT 1 AS ok
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     LIMIT 1',
    ['build_wizard_documents']
);
if (!$hasDocumentsTable) {
    fwrite(STDERR, "[backfill-build-wizard-document-blobs] build_wizard_documents table not found in current DB.\n");
    exit(1);
}

Database::execute("CREATE TABLE IF NOT EXISTS build_wizard_document_blobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    mime_type VARCHAR(120) NOT NULL DEFAULT 'application/octet-stream',
    file_blob LONGBLOB NOT NULL,
    file_size_bytes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_document_id (document_id),
    CONSTRAINT fk_build_wizard_document_blobs_document FOREIGN KEY (document_id) REFERENCES build_wizard_documents(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

$rows = Database::queryAll(
    'SELECT d.id, d.original_name, d.mime_type, d.storage_path, d.file_size_bytes,
            b.document_id AS has_blob,
            bi.image_blob, bi.mime_type AS image_blob_mime_type
     FROM build_wizard_documents d
     LEFT JOIN build_wizard_document_blobs b ON b.document_id = d.id
     LEFT JOIN build_wizard_document_images bi ON bi.document_id = d.id
     ORDER BY d.id ASC'
);

$total = count($rows);
$alreadyBlob = 0;
$fromImageBlob = 0;
$fromFilePath = 0;
$missing = 0;
$written = 0;

foreach ($rows as $row) {
    $id = (int)($row['id'] ?? 0);
    if ($id <= 0) {
        continue;
    }
    if (!empty($row['has_blob'])) {
        $alreadyBlob++;
        continue;
    }

    $bytes = null;
    $mime = trim((string)($row['mime_type'] ?? 'application/octet-stream'));
    if ($mime === '') {
        $mime = 'application/octet-stream';
    }
    $source = '';

    $imageBlob = $row['image_blob'] ?? null;
    if (is_string($imageBlob) && $imageBlob !== '') {
        $bytes = $imageBlob;
        $imgMime = trim((string)($row['image_blob_mime_type'] ?? ''));
        if ($imgMime !== '') {
            $mime = $imgMime;
        }
        $source = 'image_blob';
    } else {
        $resolved = bw_blob_resolve_path((string)($row['storage_path'] ?? ''), $projectRoot);
        if ($resolved !== '') {
            $data = @file_get_contents($resolved);
            if (is_string($data) && $data !== '') {
                $bytes = $data;
                $source = 'file_path';
            }
        }
    }

    if (!is_string($bytes) || $bytes === '') {
        $missing++;
        echo "[MISSING] id=$id name=\"" . (string)($row['original_name'] ?? '') . "\"\n";
        continue;
    }

    if ($source === 'image_blob') {
        $fromImageBlob++;
    } else {
        $fromFilePath++;
    }
    echo "[READY] id=$id source=$source name=\"" . (string)($row['original_name'] ?? '') . "\" bytes=" . strlen($bytes) . "\n";

    if (!$apply) {
        continue;
    }

    Database::execute(
        'INSERT INTO build_wizard_document_blobs (document_id, mime_type, file_blob, file_size_bytes)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), file_blob = VALUES(file_blob), file_size_bytes = VALUES(file_size_bytes)',
        [$id, $mime, $bytes, strlen($bytes)]
    );
    $written++;
}

echo "\n";
echo "[backfill-build-wizard-document-blobs] total=$total already_blob=$alreadyBlob from_image_blob=$fromImageBlob from_file_path=$fromFilePath missing=$missing written=$written apply=" . ($apply ? '1' : '0') . "\n";
