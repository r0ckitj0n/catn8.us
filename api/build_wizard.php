<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function catn8_build_wizard_tables_ensure(): void
{
    Database::execute("CREATE TABLE IF NOT EXISTS build_wizard_projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NULL,
        title VARCHAR(191) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'planning',
        square_feet INT NULL,
        home_style VARCHAR(120) NOT NULL DEFAULT '',
        room_count INT NULL,
        bathroom_count INT NULL,
        stories_count INT NULL,
        lot_address VARCHAR(255) NOT NULL DEFAULT '',
        target_start_date DATE NULL,
        target_completion_date DATE NULL,
        wizard_notes TEXT NULL,
        blueprint_document_id INT NULL,
        ai_prompt_text LONGTEXT NULL,
        ai_payload_json LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_owner_user_id (owner_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS build_wizard_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        kind VARCHAR(32) NOT NULL DEFAULT 'other',
        original_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(120) NOT NULL DEFAULT '',
        storage_path VARCHAR(255) NOT NULL,
        file_size_bytes INT NOT NULL DEFAULT 0,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_project_id (project_id),
        CONSTRAINT fk_build_wizard_documents_project FOREIGN KEY (project_id) REFERENCES build_wizard_projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS build_wizard_steps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        step_order INT NOT NULL,
        phase_key VARCHAR(64) NOT NULL DEFAULT 'general',
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        permit_required TINYINT(1) NOT NULL DEFAULT 0,
        permit_name VARCHAR(191) NULL,
        expected_start_date DATE NULL,
        expected_end_date DATE NULL,
        expected_duration_days INT NULL,
        estimated_cost DECIMAL(10,2) NULL,
        actual_cost DECIMAL(10,2) NULL,
        is_completed TINYINT(1) NOT NULL DEFAULT 0,
        completed_at DATETIME NULL,
        ai_generated TINYINT(1) NOT NULL DEFAULT 0,
        source_ref VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_project_step_order (project_id, step_order),
        KEY idx_project_id (project_id),
        KEY idx_is_completed (is_completed),
        CONSTRAINT fk_build_wizard_steps_project FOREIGN KEY (project_id) REFERENCES build_wizard_projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS build_wizard_step_notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        step_id INT NOT NULL,
        note_text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_step_id (step_id),
        CONSTRAINT fk_build_wizard_step_notes_step FOREIGN KEY (step_id) REFERENCES build_wizard_steps(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function catn8_build_wizard_default_questions(): array
{
    return [
        'How many square feet is the home?',
        'What style of home is this (ranch, modern, cabin, farmhouse, etc.)?',
        'How many bedrooms and bathrooms are planned?',
        'How many floors/stories will be built?',
        'What start date and target completion date do you want?',
        'Upload blueprint and any permit/survey/specification documents.',
    ];
}

function catn8_build_wizard_seed_data_path(): string
{
    return dirname(__DIR__) . '/Build Wizard/seed/build_wizard_seed.json';
}

function catn8_build_wizard_parse_date_or_null($value): ?string
{
    if (!is_string($value)) {
        return null;
    }
    $v = trim($value);
    if ($v === '') {
        return null;
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) {
        return null;
    }
    return $v;
}

function catn8_build_wizard_to_decimal_or_null($value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }
    if (!is_numeric($value)) {
        return null;
    }
    return number_format((float)$value, 2, '.', '');
}

function catn8_build_wizard_seed_project_from_file(int $projectId): void
{
    $seedPath = catn8_build_wizard_seed_data_path();
    if (!is_file($seedPath)) {
        return;
    }

    $raw = file_get_contents($seedPath);
    if (!is_string($raw) || trim($raw) === '') {
        return;
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        return;
    }

    $seedProject = is_array($data['project'] ?? null) ? $data['project'] : [];
    if ($seedProject) {
        Database::execute(
            'UPDATE build_wizard_projects
             SET title = ?, status = ?, square_feet = ?, home_style = ?, room_count = ?, bathroom_count = ?, stories_count = ?, lot_address = ?, target_start_date = ?, target_completion_date = ?, wizard_notes = ?
             WHERE id = ?',
            [
                trim((string)($seedProject['title'] ?? 'Build Wizard Project')),
                trim((string)($seedProject['status'] ?? 'planning')),
                isset($seedProject['square_feet']) && is_numeric($seedProject['square_feet']) ? (int)$seedProject['square_feet'] : null,
                trim((string)($seedProject['home_style'] ?? '')),
                isset($seedProject['room_count']) && is_numeric($seedProject['room_count']) ? (int)$seedProject['room_count'] : null,
                isset($seedProject['bathroom_count']) && is_numeric($seedProject['bathroom_count']) ? (int)$seedProject['bathroom_count'] : null,
                isset($seedProject['stories_count']) && is_numeric($seedProject['stories_count']) ? (int)$seedProject['stories_count'] : null,
                trim((string)($seedProject['lot_address'] ?? '')),
                catn8_build_wizard_parse_date_or_null($seedProject['target_start_date'] ?? null),
                catn8_build_wizard_parse_date_or_null($seedProject['target_completion_date'] ?? null),
                trim((string)($seedProject['wizard_notes'] ?? '')),
                $projectId,
            ]
        );
    }

    $steps = $data['steps'] ?? null;
    if (!is_array($steps)) {
        return;
    }

    foreach ($steps as $s) {
        if (!is_array($s)) {
            continue;
        }

        $stepOrder = isset($s['step_order']) && is_numeric($s['step_order']) ? (int)$s['step_order'] : 0;
        $title = trim((string)($s['title'] ?? ''));
        if ($stepOrder <= 0 || $title === '') {
            continue;
        }

        Database::execute(
            'INSERT INTO build_wizard_steps
                (project_id, step_order, phase_key, title, description, permit_required, permit_name, expected_start_date, expected_end_date, expected_duration_days, estimated_cost, actual_cost, is_completed, completed_at, ai_generated, source_ref)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, 0, ?)',
            [
                $projectId,
                $stepOrder,
                trim((string)($s['phase_key'] ?? 'general')),
                $title,
                trim((string)($s['description'] ?? '')),
                !empty($s['permit_required']) ? 1 : 0,
                isset($s['permit_name']) ? trim((string)$s['permit_name']) : null,
                catn8_build_wizard_parse_date_or_null($s['expected_start_date'] ?? null),
                catn8_build_wizard_parse_date_or_null($s['expected_end_date'] ?? null),
                isset($s['expected_duration_days']) && is_numeric($s['expected_duration_days']) ? (int)$s['expected_duration_days'] : null,
                catn8_build_wizard_to_decimal_or_null($s['estimated_cost'] ?? null),
                trim((string)($s['source_ref'] ?? '')),
            ]
        );
    }
}

function catn8_build_wizard_get_or_create_project(?int $uid): array
{
    if ($uid !== null) {
        $row = Database::queryOne('SELECT * FROM build_wizard_projects WHERE owner_user_id = ? ORDER BY id DESC LIMIT 1', [$uid]);
        if ($row) {
            return $row;
        }
    }

    $row = Database::queryOne('SELECT * FROM build_wizard_projects WHERE owner_user_id IS NULL ORDER BY id ASC LIMIT 1');
    if ($row) {
        return $row;
    }

    Database::execute(
        'INSERT INTO build_wizard_projects (owner_user_id, title, status, home_style, lot_address, wizard_notes) VALUES (?, ?, ?, ?, ?, ?)',
        [$uid, 'Build Wizard Project', 'planning', '', '', '']
    );
    $id = (int)Database::lastInsertId();

    catn8_build_wizard_seed_project_from_file($id);

    $created = Database::queryOne('SELECT * FROM build_wizard_projects WHERE id = ?', [$id]);
    if (!$created) {
        throw new RuntimeException('Failed to create build wizard project');
    }
    return $created;
}

function catn8_build_wizard_step_notes_by_step_ids(array $stepIds): array
{
    if (!$stepIds) {
        return [];
    }
    $cleanIds = [];
    foreach ($stepIds as $id) {
        $n = (int)$id;
        if ($n > 0) {
            $cleanIds[] = $n;
        }
    }
    if (!$cleanIds) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($cleanIds), '?'));
    $rows = Database::queryAll(
        'SELECT id, step_id, note_text, created_at
         FROM build_wizard_step_notes
         WHERE step_id IN (' . $placeholders . ')
         ORDER BY created_at ASC, id ASC',
        $cleanIds
    );

    $map = [];
    foreach ($rows as $r) {
        $sid = (int)($r['step_id'] ?? 0);
        if (!isset($map[$sid])) {
            $map[$sid] = [];
        }
        $map[$sid][] = [
            'id' => (int)($r['id'] ?? 0),
            'step_id' => $sid,
            'note_text' => (string)($r['note_text'] ?? ''),
            'created_at' => (string)($r['created_at'] ?? ''),
        ];
    }
    return $map;
}

function catn8_build_wizard_steps_for_project(int $projectId): array
{
    $rows = Database::queryAll(
        'SELECT id, project_id, step_order, phase_key, title, description, permit_required, permit_name, expected_start_date, expected_end_date, expected_duration_days, estimated_cost, actual_cost, is_completed, completed_at, ai_generated, source_ref
         FROM build_wizard_steps
         WHERE project_id = ?
         ORDER BY step_order ASC, id ASC',
        [$projectId]
    );

    $stepIds = array_map(static fn($r) => (int)($r['id'] ?? 0), $rows);
    $notesByStep = catn8_build_wizard_step_notes_by_step_ids($stepIds);

    $steps = [];
    foreach ($rows as $r) {
        $sid = (int)($r['id'] ?? 0);
        $steps[] = [
            'id' => $sid,
            'project_id' => (int)($r['project_id'] ?? 0),
            'step_order' => (int)($r['step_order'] ?? 0),
            'phase_key' => (string)($r['phase_key'] ?? ''),
            'title' => (string)($r['title'] ?? ''),
            'description' => (string)($r['description'] ?? ''),
            'permit_required' => (int)($r['permit_required'] ?? 0),
            'permit_name' => $r['permit_name'] !== null ? (string)$r['permit_name'] : null,
            'expected_start_date' => $r['expected_start_date'] !== null ? (string)$r['expected_start_date'] : null,
            'expected_end_date' => $r['expected_end_date'] !== null ? (string)$r['expected_end_date'] : null,
            'expected_duration_days' => $r['expected_duration_days'] !== null ? (int)$r['expected_duration_days'] : null,
            'estimated_cost' => $r['estimated_cost'] !== null ? (float)$r['estimated_cost'] : null,
            'actual_cost' => $r['actual_cost'] !== null ? (float)$r['actual_cost'] : null,
            'is_completed' => (int)($r['is_completed'] ?? 0),
            'completed_at' => $r['completed_at'] !== null ? (string)$r['completed_at'] : null,
            'ai_generated' => (int)($r['ai_generated'] ?? 0),
            'source_ref' => $r['source_ref'] !== null ? (string)$r['source_ref'] : null,
            'notes' => $notesByStep[$sid] ?? [],
        ];
    }

    return $steps;
}

function catn8_build_wizard_documents_for_project(int $projectId): array
{
    $rows = Database::queryAll(
        'SELECT id, project_id, kind, original_name, mime_type, storage_path, file_size_bytes, uploaded_at
         FROM build_wizard_documents
         WHERE project_id = ?
         ORDER BY uploaded_at DESC, id DESC',
        [$projectId]
    );

    $docs = [];
    foreach ($rows as $r) {
        $path = (string)($r['storage_path'] ?? '');
        $baseName = basename($path);
        $docs[] = [
            'id' => (int)($r['id'] ?? 0),
            'project_id' => (int)($r['project_id'] ?? 0),
            'kind' => (string)($r['kind'] ?? ''),
            'original_name' => (string)($r['original_name'] ?? ''),
            'mime_type' => (string)($r['mime_type'] ?? ''),
            'storage_path' => $path,
            'file_size_bytes' => (int)($r['file_size_bytes'] ?? 0),
            'uploaded_at' => (string)($r['uploaded_at'] ?? ''),
            'public_url' => '/uploads/build-wizard/' . rawurlencode($baseName),
        ];
    }
    return $docs;
}

function catn8_build_wizard_step_by_id(int $stepId): ?array
{
    $row = Database::queryOne(
        'SELECT id, project_id, step_order, phase_key, title, description, permit_required, permit_name, expected_start_date, expected_end_date, expected_duration_days, estimated_cost, actual_cost, is_completed, completed_at, ai_generated, source_ref
         FROM build_wizard_steps
         WHERE id = ?
         LIMIT 1',
        [$stepId]
    );
    if (!$row) {
        return null;
    }

    $notesByStep = catn8_build_wizard_step_notes_by_step_ids([$stepId]);

    return [
        'id' => (int)($row['id'] ?? 0),
        'project_id' => (int)($row['project_id'] ?? 0),
        'step_order' => (int)($row['step_order'] ?? 0),
        'phase_key' => (string)($row['phase_key'] ?? ''),
        'title' => (string)($row['title'] ?? ''),
        'description' => (string)($row['description'] ?? ''),
        'permit_required' => (int)($row['permit_required'] ?? 0),
        'permit_name' => $row['permit_name'] !== null ? (string)$row['permit_name'] : null,
        'expected_start_date' => $row['expected_start_date'] !== null ? (string)$row['expected_start_date'] : null,
        'expected_end_date' => $row['expected_end_date'] !== null ? (string)$row['expected_end_date'] : null,
        'expected_duration_days' => $row['expected_duration_days'] !== null ? (int)$row['expected_duration_days'] : null,
        'estimated_cost' => $row['estimated_cost'] !== null ? (float)$row['estimated_cost'] : null,
        'actual_cost' => $row['actual_cost'] !== null ? (float)$row['actual_cost'] : null,
        'is_completed' => (int)($row['is_completed'] ?? 0),
        'completed_at' => $row['completed_at'] !== null ? (string)$row['completed_at'] : null,
        'ai_generated' => (int)($row['ai_generated'] ?? 0),
        'source_ref' => $row['source_ref'] !== null ? (string)$row['source_ref'] : null,
        'notes' => $notesByStep[$stepId] ?? [],
    ];
}

try {
    catn8_build_wizard_tables_ensure();

    $action = trim((string)($_GET['action'] ?? 'bootstrap'));
    $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    $uid = catn8_auth_user_id();

    if ($action === 'bootstrap') {
        catn8_require_method('GET');

        $project = catn8_build_wizard_get_or_create_project($uid);
        $projectId = (int)($project['id'] ?? 0);
        if ($projectId <= 0) {
            throw new RuntimeException('Build wizard project missing id');
        }

        $stepCount = Database::queryOne('SELECT COUNT(*) AS c FROM build_wizard_steps WHERE project_id = ?', [$projectId]);
        if ((int)($stepCount['c'] ?? 0) <= 0) {
            catn8_build_wizard_seed_project_from_file($projectId);
        }

        $project = Database::queryOne('SELECT * FROM build_wizard_projects WHERE id = ?', [$projectId]) ?: $project;

        catn8_json_response([
            'success' => true,
            'project' => $project,
            'steps' => catn8_build_wizard_steps_for_project($projectId),
            'documents' => catn8_build_wizard_documents_for_project($projectId),
            'leading_questions' => catn8_build_wizard_default_questions(),
        ]);
    }

    if ($action === 'save_project') {
        catn8_require_method('POST');

        $body = catn8_read_json_body();
        $projectId = isset($body['project_id']) ? (int)$body['project_id'] : 0;
        if ($projectId <= 0) {
            throw new RuntimeException('Missing project_id');
        }

        Database::execute(
            'UPDATE build_wizard_projects
             SET square_feet = ?, home_style = ?, room_count = ?, bathroom_count = ?, stories_count = ?, lot_address = ?, target_start_date = ?, target_completion_date = ?, wizard_notes = ?
             WHERE id = ?',
            [
                isset($body['square_feet']) && is_numeric($body['square_feet']) ? (int)$body['square_feet'] : null,
                trim((string)($body['home_style'] ?? '')),
                isset($body['room_count']) && is_numeric($body['room_count']) ? (int)$body['room_count'] : null,
                isset($body['bathroom_count']) && is_numeric($body['bathroom_count']) ? (int)$body['bathroom_count'] : null,
                isset($body['stories_count']) && is_numeric($body['stories_count']) ? (int)$body['stories_count'] : null,
                trim((string)($body['lot_address'] ?? '')),
                catn8_build_wizard_parse_date_or_null($body['target_start_date'] ?? null),
                catn8_build_wizard_parse_date_or_null($body['target_completion_date'] ?? null),
                trim((string)($body['wizard_notes'] ?? '')),
                $projectId,
            ]
        );

        $project = Database::queryOne('SELECT * FROM build_wizard_projects WHERE id = ?', [$projectId]);
        catn8_json_response(['success' => true, 'project' => $project]);
    }

    if ($action === 'update_step') {
        catn8_require_method('POST');

        $body = catn8_read_json_body();
        $stepId = isset($body['step_id']) ? (int)$body['step_id'] : 0;
        if ($stepId <= 0) {
            throw new RuntimeException('Missing step_id');
        }

        $updates = [];
        $params = [];

        if (array_key_exists('is_completed', $body)) {
            $isCompleted = ((int)$body['is_completed'] === 1) ? 1 : 0;
            $updates[] = 'is_completed = ?';
            $params[] = $isCompleted;
            if ($isCompleted === 1) {
                $updates[] = 'completed_at = NOW()';
            } else {
                $updates[] = 'completed_at = NULL';
            }
        }

        if (array_key_exists('actual_cost', $body)) {
            $updates[] = 'actual_cost = ?';
            $params[] = catn8_build_wizard_to_decimal_or_null($body['actual_cost']);
        }

        if (!$updates) {
            throw new RuntimeException('No step updates provided');
        }

        $params[] = $stepId;
        Database::execute('UPDATE build_wizard_steps SET ' . implode(', ', $updates) . ' WHERE id = ?', $params);

        $step = catn8_build_wizard_step_by_id($stepId);
        if (!$step) {
            throw new RuntimeException('Step not found after update');
        }

        catn8_json_response(['success' => true, 'step' => $step]);
    }

    if ($action === 'add_step_note') {
        catn8_require_method('POST');

        $body = catn8_read_json_body();
        $stepId = isset($body['step_id']) ? (int)$body['step_id'] : 0;
        $noteText = trim((string)($body['note_text'] ?? ''));
        if ($stepId <= 0) {
            throw new RuntimeException('Missing step_id');
        }
        if ($noteText === '') {
            throw new RuntimeException('Missing note_text');
        }

        Database::execute(
            'INSERT INTO build_wizard_step_notes (step_id, note_text) VALUES (?, ?)',
            [$stepId, $noteText]
        );

        $step = catn8_build_wizard_step_by_id($stepId);
        if (!$step) {
            throw new RuntimeException('Step not found after note insert');
        }

        catn8_json_response(['success' => true, 'step' => $step]);
    }

    if ($action === 'upload_document') {
        catn8_require_method('POST');

        $projectId = isset($_POST['project_id']) ? (int)$_POST['project_id'] : 0;
        $kind = trim((string)($_POST['kind'] ?? 'other'));
        if ($projectId <= 0) {
            throw new RuntimeException('Missing project_id');
        }
        if ($kind === '') {
            $kind = 'other';
        }
        if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
            throw new RuntimeException('No file uploaded');
        }

        $file = $_FILES['file'];
        $tmp = (string)($file['tmp_name'] ?? '');
        if ($tmp === '' || !is_uploaded_file($tmp)) {
            throw new RuntimeException('Invalid upload');
        }

        $size = (int)($file['size'] ?? 0);
        if ($size <= 0) {
            throw new RuntimeException('Uploaded file is empty');
        }
        if ($size > 25 * 1024 * 1024) {
            throw new RuntimeException('Uploaded file exceeds 25MB');
        }

        $origName = trim((string)($file['name'] ?? 'document'));
        $safeName = preg_replace('/[^A-Za-z0-9._-]+/', '_', $origName);
        if (!is_string($safeName) || $safeName === '') {
            $safeName = 'document';
        }

        $mime = trim((string)($file['type'] ?? 'application/octet-stream'));
        $uploadDir = dirname(__DIR__) . '/uploads/build-wizard';
        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
            throw new RuntimeException('Failed to prepare upload directory');
        }

        $storedName = date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '_' . $safeName;
        $destPath = $uploadDir . '/' . $storedName;
        if (!move_uploaded_file($tmp, $destPath)) {
            throw new RuntimeException('Failed to store uploaded file');
        }

        Database::execute(
            'INSERT INTO build_wizard_documents (project_id, kind, original_name, mime_type, storage_path, file_size_bytes) VALUES (?, ?, ?, ?, ?, ?)',
            [$projectId, $kind, $origName, $mime, $destPath, $size]
        );

        $docId = (int)Database::lastInsertId();
        if ($kind === 'blueprint') {
            Database::execute('UPDATE build_wizard_projects SET blueprint_document_id = ? WHERE id = ?', [$docId, $projectId]);
        }

        $doc = Database::queryOne('SELECT id, project_id, kind, original_name, mime_type, storage_path, file_size_bytes, uploaded_at FROM build_wizard_documents WHERE id = ?', [$docId]);
        if (!$doc) {
            throw new RuntimeException('Saved document not found');
        }

        $doc['public_url'] = '/uploads/build-wizard/' . rawurlencode(basename((string)$doc['storage_path']));
        catn8_json_response(['success' => true, 'document' => $doc]);
    }

    if ($action === 'build_ai_payload') {
        catn8_require_method('POST');

        $body = catn8_read_json_body();
        $projectId = isset($body['project_id']) ? (int)$body['project_id'] : 0;
        if ($projectId <= 0) {
            throw new RuntimeException('Missing project_id');
        }

        $project = Database::queryOne('SELECT * FROM build_wizard_projects WHERE id = ?', [$projectId]);
        if (!$project) {
            throw new RuntimeException('Project not found');
        }

        $steps = catn8_build_wizard_steps_for_project($projectId);
        $documents = catn8_build_wizard_documents_for_project($projectId);

        $payload = [
            'context' => [
                'generated_at' => gmdate('c'),
                'project_id' => $projectId,
                'source' => 'catn8_build_wizard_framework_v1',
            ],
            'project_profile' => [
                'title' => (string)($project['title'] ?? ''),
                'status' => (string)($project['status'] ?? ''),
                'square_feet' => $project['square_feet'] !== null ? (int)$project['square_feet'] : null,
                'home_style' => (string)($project['home_style'] ?? ''),
                'room_count' => $project['room_count'] !== null ? (int)$project['room_count'] : null,
                'bathroom_count' => $project['bathroom_count'] !== null ? (int)$project['bathroom_count'] : null,
                'stories_count' => $project['stories_count'] !== null ? (int)$project['stories_count'] : null,
                'lot_address' => (string)($project['lot_address'] ?? ''),
                'target_start_date' => $project['target_start_date'] !== null ? (string)$project['target_start_date'] : null,
                'target_completion_date' => $project['target_completion_date'] !== null ? (string)$project['target_completion_date'] : null,
                'wizard_notes' => (string)($project['wizard_notes'] ?? ''),
            ],
            'documents' => $documents,
            'timeline_steps' => $steps,
            'leading_questions' => catn8_build_wizard_default_questions(),
            'instructions_for_ai' => [
                'Use permit and inspection dependencies to reorder steps if needed.',
                'Fill missing dates, durations, and costs with realistic estimates for the specified house profile.',
                'Return machine-readable steps with dependencies and rationale for each phase.',
            ],
        ];

        $promptText = "Analyze this house build package and return an optimized construction timeline including permits, inspections, prerequisites, expected durations, and budget by step. Use the provided blueprint/docs and keep output machine-readable for ingestion by catn8 Build Wizard.";

        Database::execute(
            'UPDATE build_wizard_projects SET ai_prompt_text = ?, ai_payload_json = ? WHERE id = ?',
            [$promptText, json_encode($payload, JSON_UNESCAPED_SLASHES), $projectId]
        );

        catn8_json_response([
            'success' => true,
            'prompt_text' => $promptText,
            'payload' => $payload,
        ]);
    }

    catn8_json_response(['success' => false, 'error' => 'Unknown action'], 404);
} catch (Throwable $e) {
    catn8_json_response([
        'success' => false,
        'error' => $e->getMessage(),
    ], 500);
}
