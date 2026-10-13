<?php

declare(strict_types=1);

/**
 * Project-level Fabric8 / build-wizard photo sections (albums).
 * Additive only — does not repurpose build steps.
 */

function catn8_build_wizard_photo_sections_ensure(): void
{
    Database::execute("CREATE TABLE IF NOT EXISTS build_wizard_photo_sections (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        title VARCHAR(191) NOT NULL,
        slug VARCHAR(120) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_bw_photo_section_project_slug (project_id, slug),
        KEY idx_bw_photo_section_project (project_id, sort_order, id),
        CONSTRAINT fk_bw_photo_sections_project FOREIGN KEY (project_id) REFERENCES build_wizard_projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $cols = [
        'photo_section_id' => 'ALTER TABLE build_wizard_documents ADD COLUMN photo_section_id INT NULL AFTER step_id',
        'content_hash' => 'ALTER TABLE build_wizard_documents ADD COLUMN content_hash CHAR(64) NULL AFTER caption',
        'meta_json' => 'ALTER TABLE build_wizard_documents ADD COLUMN meta_json LONGTEXT NULL AFTER content_hash',
    ];
    foreach ($cols as $column => $sql) {
        $has = Database::queryOne(
            'SELECT 1 AS ok FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
            ['build_wizard_documents', $column]
        );
        if (!$has) {
            Database::execute($sql);
        }
    }

    $idx = Database::queryOne(
        "SELECT 1 AS ok FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'build_wizard_documents'
           AND INDEX_NAME = 'idx_bw_docs_photo_section' LIMIT 1"
    );
    if (!$idx) {
        Database::execute('ALTER TABLE build_wizard_documents ADD KEY idx_bw_docs_photo_section (photo_section_id)');
    }

    // Non-unique index: idempotency is enforced in PHP (NULL content_hash on legacy rows).
    $hashIdx = Database::queryOne(
        "SELECT 1 AS ok FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'build_wizard_documents'
           AND INDEX_NAME = 'idx_bw_docs_project_content_hash' LIMIT 1"
    );
    if (!$hashIdx) {
        Database::execute(
            'ALTER TABLE build_wizard_documents
             ADD KEY idx_bw_docs_project_content_hash (project_id, content_hash)'
        );
    }

    $fk = Database::queryOne(
        "SELECT 1 AS ok FROM information_schema.TABLE_CONSTRAINTS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'build_wizard_documents'
           AND CONSTRAINT_NAME = 'fk_bw_docs_photo_section' LIMIT 1"
    );
    if (!$fk) {
        try {
            Database::execute(
                'ALTER TABLE build_wizard_documents
                 ADD CONSTRAINT fk_bw_docs_photo_section
                 FOREIGN KEY (photo_section_id) REFERENCES build_wizard_photo_sections(id) ON DELETE SET NULL'
            );
        } catch (Throwable $e) {
            // ignore if engine/state prevents FK (column still usable)
        }
    }

    $privateDir = dirname(__DIR__) . '/private/build-wizard';
    if (!is_dir($privateDir)) {
        @mkdir($privateDir, 0750, true);
    }
    $htaccess = $privateDir . '/.htaccess';
    if (!is_file($htaccess)) {
        @file_put_contents($htaccess, "Require all denied\n");
    }
}

function catn8_build_wizard_photo_section_slug(string $title): string
{
    $slug = strtolower(trim($title));
    $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? '';
    $slug = trim($slug, '-');
    if ($slug === '') {
        $slug = 'section';
    }
    return substr($slug, 0, 120);
}

/**
 * @return array{id:int,project_id:int,title:string,slug:string,sort_order:int,notes:?string,document_count:int,created_at:string,updated_at:string}
 */
function catn8_build_wizard_photo_section_row(array $row): array
{
    return [
        'id' => (int)($row['id'] ?? 0),
        'project_id' => (int)($row['project_id'] ?? 0),
        'title' => (string)($row['title'] ?? ''),
        'slug' => (string)($row['slug'] ?? ''),
        'sort_order' => (int)($row['sort_order'] ?? 0),
        'notes' => isset($row['notes']) && $row['notes'] !== null ? (string)$row['notes'] : null,
        'document_count' => (int)($row['document_count'] ?? 0),
        'created_at' => (string)($row['created_at'] ?? ''),
        'updated_at' => (string)($row['updated_at'] ?? ''),
    ];
}

/**
 * @return list<array<string,mixed>>
 */
function catn8_build_wizard_list_photo_sections(int $projectId): array
{
    catn8_build_wizard_photo_sections_ensure();
    $rows = Database::queryAll(
        'SELECT s.*,
                (SELECT COUNT(*) FROM build_wizard_documents d WHERE d.photo_section_id = s.id) AS document_count
         FROM build_wizard_photo_sections s
         WHERE s.project_id = ?
         ORDER BY s.sort_order ASC, s.id ASC',
        [$projectId]
    );
    return array_map('catn8_build_wizard_photo_section_row', $rows);
}

/**
 * @return array<string,mixed>
 */
function catn8_build_wizard_ensure_photo_section(int $projectId, string $title, ?string $notes = null, ?int $sortOrder = null): array
{
    catn8_build_wizard_photo_sections_ensure();
    $title = trim($title);
    if ($title === '') {
        throw new InvalidArgumentException('title required');
    }
    $slug = catn8_build_wizard_photo_section_slug($title);
    $existing = Database::queryOne(
        'SELECT * FROM build_wizard_photo_sections WHERE project_id = ? AND slug = ? LIMIT 1',
        [$projectId, $slug]
    );
    if ($existing) {
        if ($notes !== null || $sortOrder !== null) {
            Database::execute(
                'UPDATE build_wizard_photo_sections
                 SET notes = COALESCE(?, notes),
                     sort_order = COALESCE(?, sort_order),
                     title = ?
                 WHERE id = ?',
                [$notes, $sortOrder, $title, (int)$existing['id']]
            );
            $existing = Database::queryOne(
                'SELECT * FROM build_wizard_photo_sections WHERE id = ? LIMIT 1',
                [(int)$existing['id']]
            ) ?: $existing;
        }
        $existing['document_count'] = (int)(Database::queryOne(
            'SELECT COUNT(*) AS c FROM build_wizard_documents WHERE photo_section_id = ?',
            [(int)$existing['id']]
        )['c'] ?? 0);
        return catn8_build_wizard_photo_section_row($existing);
    }

    if ($sortOrder === null) {
        $max = Database::queryOne(
            'SELECT COALESCE(MAX(sort_order), 0) AS m FROM build_wizard_photo_sections WHERE project_id = ?',
            [$projectId]
        );
        $sortOrder = (int)($max['m'] ?? 0) + 10;
    }

    Database::execute(
        'INSERT INTO build_wizard_photo_sections (project_id, title, slug, sort_order, notes)
         VALUES (?, ?, ?, ?, ?)',
        [$projectId, $title, $slug, $sortOrder, $notes]
    );
    $id = (int)Database::lastInsertId();
    $row = Database::queryOne('SELECT * FROM build_wizard_photo_sections WHERE id = ?', [$id]);
    if (!$row) {
        throw new RuntimeException('Failed to create photo section');
    }
    $row['document_count'] = 0;
    return catn8_build_wizard_photo_section_row($row);
}

function catn8_build_wizard_get_photo_section(int $sectionId, int $projectId = 0): ?array
{
    catn8_build_wizard_photo_sections_ensure();
    if ($sectionId <= 0) {
        return null;
    }
    if ($projectId > 0) {
        $row = Database::queryOne(
            'SELECT * FROM build_wizard_photo_sections WHERE id = ? AND project_id = ? LIMIT 1',
            [$sectionId, $projectId]
        );
    } else {
        $row = Database::queryOne(
            'SELECT * FROM build_wizard_photo_sections WHERE id = ? LIMIT 1',
            [$sectionId]
        );
    }
    if (!$row) {
        return null;
    }
    $row['document_count'] = (int)(Database::queryOne(
        'SELECT COUNT(*) AS c FROM build_wizard_documents WHERE photo_section_id = ?',
        [(int)$row['id']]
    )['c'] ?? 0);
    return catn8_build_wizard_photo_section_row($row);
}

/**
 * Store a file into a project photo section (private storage). Idempotent on content_hash.
 *
 * @param array{tmp_name:string,name?:string,type?:string,size?:int}|string $file Or absolute path string
 * @param array<string,mixed>|null $meta
 * @return array{document:array<string,mixed>,deduped:bool,created:bool}
 */
function catn8_build_wizard_upload_to_photo_section(
    int $projectId,
    int $sectionId,
    $file,
    string $kind,
    ?string $caption,
    ?array $meta,
    string $actorLabel = 'agent:fabric8'
): array {
    catn8_build_wizard_photo_sections_ensure();
    $section = catn8_build_wizard_get_photo_section($sectionId, $projectId);
    if (!$section) {
        throw new InvalidArgumentException('Photo section not found for project');
    }

    $kind = function_exists('catn8_build_wizard_document_kind')
        ? catn8_build_wizard_document_kind($kind)
        : (in_array($kind, ['photo', 'site_photo', 'home_photo', 'progress_photo', 'document', 'other'], true) ? $kind : 'photo');

    if (is_string($file)) {
        $srcPath = $file;
        if ($srcPath === '' || !is_file($srcPath)) {
            throw new InvalidArgumentException('File not found');
        }
        $origName = basename($srcPath);
        $size = (int)filesize($srcPath);
        $bytes = file_get_contents($srcPath);
    } else {
        if (!is_array($file)) {
            throw new InvalidArgumentException('Invalid file');
        }
        $tmp = (string)($file['tmp_name'] ?? '');
        if ($tmp === '' || !(is_uploaded_file($tmp) || is_file($tmp))) {
            throw new InvalidArgumentException('Invalid upload');
        }
        $srcPath = $tmp;
        $origName = trim((string)($file['name'] ?? 'document'));
        $size = (int)($file['size'] ?? filesize($tmp));
        $bytes = file_get_contents($tmp);
    }

    if (!is_string($bytes) || $bytes === '') {
        throw new InvalidArgumentException('Uploaded file is empty');
    }
    if ($size <= 0) {
        $size = strlen($bytes);
    }
    if ($size > 40 * 1024 * 1024) {
        throw new InvalidArgumentException('Uploaded file exceeds 40MB');
    }

    $contentHash = hash('sha256', $bytes);
    $existing = Database::queryOne(
        'SELECT id FROM build_wizard_documents WHERE project_id = ? AND content_hash = ? LIMIT 1',
        [$projectId, $contentHash]
    );
    if ($existing) {
        $docId = (int)$existing['id'];
        // Keep section/caption/meta in sync on rerun without duplicating bytes.
        Database::execute(
            'UPDATE build_wizard_documents
             SET photo_section_id = ?,
                 step_id = NULL,
                 kind = ?,
                 caption = COALESCE(?, caption),
                 meta_json = COALESCE(?, meta_json)
             WHERE id = ?',
            [
                $sectionId,
                $kind,
                $caption !== null && $caption !== '' ? $caption : null,
                $meta !== null ? json_encode($meta, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null,
                $docId,
            ]
        );
        return [
            'document' => catn8_build_wizard_photo_section_document_payload($docId),
            'deduped' => true,
            'created' => false,
        ];
    }

    $finfo = function_exists('finfo_open') ? finfo_open(FILEINFO_MIME_TYPE) : false;
    $detectedMime = $finfo ? finfo_buffer($finfo, $bytes) : false;
    if ($finfo) {
        finfo_close($finfo);
    }
    $mime = trim((string)($detectedMime ?: (is_array($file) ? ($file['type'] ?? '') : '') ?: 'application/octet-stream'));
    if ($mime === '') {
        $mime = 'application/octet-stream';
    }

    $safeName = preg_replace('/[^A-Za-z0-9._-]+/', '_', $origName);
    if (!is_string($safeName) || $safeName === '') {
        $safeName = 'document';
    }

    $uploadDir = dirname(__DIR__) . '/private/build-wizard/' . $projectId;
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0750, true) && !is_dir($uploadDir)) {
        throw new RuntimeException('Failed to prepare private upload directory');
    }
    $storedName = date('Ymd_His') . '_' . substr($contentHash, 0, 12) . '_' . $safeName;
    $destPath = $uploadDir . '/' . $storedName;
    if (file_put_contents($destPath, $bytes) === false) {
        throw new RuntimeException('Failed to store uploaded file');
    }
    @chmod($destPath, 0640);

    $metaJson = $meta !== null
        ? json_encode($meta, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
        : null;
    if ($caption === '') {
        $caption = null;
    }

    Database::execute(
        'INSERT INTO build_wizard_documents (
            project_id, step_id, photo_section_id, receipt_parent_document_id, kind, original_name, mime_type,
            storage_path, file_size_bytes, caption, content_hash, meta_json
         ) VALUES (?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $projectId,
            $sectionId,
            $kind,
            $origName,
            $mime,
            $destPath,
            $size,
            $caption,
            $contentHash,
            $metaJson,
        ]
    );
    $docId = (int)Database::lastInsertId();

    if (function_exists('catn8_build_wizard_upsert_document_blob')) {
        catn8_build_wizard_upsert_document_blob($docId, $mime, $bytes);
    } else {
        Database::execute(
            'INSERT INTO build_wizard_document_blobs (document_id, mime_type, file_blob, file_size_bytes)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), file_blob = VALUES(file_blob), file_size_bytes = VALUES(file_size_bytes)',
            [$docId, $mime, $bytes, strlen($bytes)]
        );
    }

    if (str_starts_with(strtolower($mime), 'image/')) {
        $sizeInfo = @getimagesizefromstring($bytes);
        $width = is_array($sizeInfo) && isset($sizeInfo[0]) ? (int)$sizeInfo[0] : null;
        $height = is_array($sizeInfo) && isset($sizeInfo[1]) ? (int)$sizeInfo[1] : null;
        Database::execute(
            'INSERT INTO build_wizard_document_images (document_id, mime_type, image_blob, width_px, height_px, file_size_bytes)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), image_blob = VALUES(image_blob),
               width_px = VALUES(width_px), height_px = VALUES(height_px), file_size_bytes = VALUES(file_size_bytes)',
            [$docId, $mime, $bytes, $width, $height, strlen($bytes)]
        );
    }

    try {
        if (function_exists('catn8_build_wizard_index_document_for_search')) {
            catn8_build_wizard_index_document_for_search($docId);
        }
    } catch (Throwable $e) {
        error_log('[fabric8] index failed doc ' . $docId . ': ' . $e->getMessage());
    }

    catn8_log_error('fabric8 photo section upload', [
        'project_id' => $projectId,
        'section_id' => $sectionId,
        'document_id' => $docId,
        'actor' => $actorLabel,
        'original_name' => $origName,
        'deduped' => false,
    ]);

    return [
        'document' => catn8_build_wizard_photo_section_document_payload($docId),
        'deduped' => false,
        'created' => true,
    ];
}

/**
 * @return array<string,mixed>
 */
function catn8_build_wizard_photo_section_document_payload(int $docId): array
{
    $r = Database::queryOne(
        'SELECT d.id, d.project_id, d.step_id, d.photo_section_id, d.receipt_parent_document_id,
                d.kind, d.original_name, d.mime_type, d.storage_path, d.file_size_bytes, d.caption,
                d.content_hash, d.meta_json, d.receipt_amount, d.receipt_title, d.receipt_vendor,
                d.receipt_date, d.receipt_notes, d.uploaded_at,
                s.title AS photo_section_title,
                CASE WHEN bi.document_id IS NULL THEN 0 ELSE 1 END AS has_image_blob
         FROM build_wizard_documents d
         LEFT JOIN build_wizard_photo_sections s ON s.id = d.photo_section_id
         LEFT JOIN build_wizard_document_images bi ON bi.document_id = d.id
         WHERE d.id = ?
         LIMIT 1',
        [$docId]
    );
    if (!$r) {
        throw new RuntimeException('Saved document not found');
    }
    $mimeType = (string)($r['mime_type'] ?? '');
    $meta = null;
    if (!empty($r['meta_json'])) {
        $decoded = json_decode((string)$r['meta_json'], true);
        if (is_array($decoded)) {
            $meta = $decoded;
        }
    }
    return [
        'id' => (int)$r['id'],
        'project_id' => (int)$r['project_id'],
        'step_id' => $r['step_id'] !== null ? (int)$r['step_id'] : null,
        'photo_section_id' => $r['photo_section_id'] !== null ? (int)$r['photo_section_id'] : null,
        'photo_section_title' => $r['photo_section_title'] !== null ? (string)$r['photo_section_title'] : null,
        'receipt_parent_document_id' => $r['receipt_parent_document_id'] !== null ? (int)$r['receipt_parent_document_id'] : null,
        'kind' => (string)($r['kind'] ?? ''),
        'original_name' => (string)($r['original_name'] ?? ''),
        'mime_type' => $mimeType,
        'storage_path' => (string)($r['storage_path'] ?? ''),
        'file_size_bytes' => (int)($r['file_size_bytes'] ?? 0),
        'caption' => $r['caption'] !== null ? (string)$r['caption'] : null,
        'content_hash' => $r['content_hash'] !== null ? (string)$r['content_hash'] : null,
        'meta' => $meta,
        'meta_json' => $r['meta_json'] !== null ? (string)$r['meta_json'] : null,
        'receipt_amount' => $r['receipt_amount'] !== null ? (float)$r['receipt_amount'] : null,
        'receipt_title' => $r['receipt_title'] !== null ? (string)$r['receipt_title'] : null,
        'receipt_vendor' => $r['receipt_vendor'] !== null ? (string)$r['receipt_vendor'] : null,
        'receipt_date' => $r['receipt_date'] !== null ? (string)$r['receipt_date'] : null,
        'receipt_notes' => $r['receipt_notes'] !== null ? (string)$r['receipt_notes'] : null,
        'uploaded_at' => (string)($r['uploaded_at'] ?? ''),
        'public_url' => '/api/build_wizard.php?action=get_document&document_id=' . (int)$r['id'],
        'thumbnail_url' => '/api/build_wizard.php?action=get_document&document_id=' . (int)$r['id'] . '&thumb=1',
        'is_image' => ((int)($r['has_image_blob'] ?? 0) === 1 || str_starts_with(strtolower($mimeType), 'image/')) ? 1 : 0,
    ];
}

/**
 * Enrich a documents_for_project row array in place / return extra fields from DB row.
 *
 * @param array<string,mixed> $r
 * @return array<string,mixed>
 */
function catn8_build_wizard_document_section_fields(array $r): array
{
    $meta = null;
    if (!empty($r['meta_json'])) {
        $decoded = json_decode((string)$r['meta_json'], true);
        if (is_array($decoded)) {
            $meta = $decoded;
        }
    }
    return [
        'photo_section_id' => isset($r['photo_section_id']) && $r['photo_section_id'] !== null ? (int)$r['photo_section_id'] : null,
        'photo_section_title' => isset($r['photo_section_title']) && $r['photo_section_title'] !== null
            ? (string)$r['photo_section_title'] : null,
        'content_hash' => isset($r['content_hash']) && $r['content_hash'] !== null ? (string)$r['content_hash'] : null,
        'meta' => $meta,
        'meta_json' => isset($r['meta_json']) && $r['meta_json'] !== null ? (string)$r['meta_json'] : null,
    ];
}
