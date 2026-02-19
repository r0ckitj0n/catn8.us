<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/settings/ai_test_functions.php';
require_once __DIR__ . '/../includes/vertex_ai_gemini.php';

function catn8_build_wizard_tables_ensure(): void
{
    Database::execute("CREATE TABLE IF NOT EXISTS build_wizard_projects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
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
        'What is the parcel and lot status (owned, under contract, or pending)?',
        'Has the land survey been completed and boundary pins verified?',
        'How many square feet, bedrooms, bathrooms, and stories are planned?',
        'Will this build use septic, well, or public utility connections?',
        'Upload blueprint, survey, and permitting documents required for Dawson County review.',
        'Track required inspections through final certificate of occupancy.',
    ];
}

function catn8_build_wizard_seed_data_path(): string
{
    return dirname(__DIR__) . '/Build Wizard/seed/build_wizard_seed.json';
}

function catn8_build_wizard_dawsonville_template_steps(): array
{
    return [
        ['phase_key' => 'land_due_diligence', 'title' => 'Secure land purchase contract and title review', 'description' => 'Confirm deed restrictions, easements, access rights, and legal parcel description before construction planning.', 'permit_required' => 0, 'permit_name' => null, 'expected_duration_days' => 14],
        ['phase_key' => 'land_due_diligence', 'title' => 'Complete boundary and topographic land survey', 'description' => 'Establish boundary pins, elevations, and site constraints for house placement, drainage, and utilities.', 'permit_required' => 0, 'permit_name' => null, 'expected_duration_days' => 10],
        ['phase_key' => 'land_due_diligence', 'title' => 'Perform soil/percolation evaluation and utility feasibility', 'description' => 'Verify septic feasibility or sewer availability, power access, and water source planning before final design.', 'permit_required' => 0, 'permit_name' => null, 'expected_duration_days' => 14],
        ['phase_key' => 'design_preconstruction', 'title' => 'Finalize house plans and engineered documents', 'description' => 'Prepare stamped plans, framing details, and supporting documents for permit submittals.', 'permit_required' => 0, 'permit_name' => null, 'expected_duration_days' => 21],
        ['phase_key' => 'dawson_county_permits', 'title' => 'Submit Dawson County residential building permit application', 'description' => 'Submit site plan, construction drawings, and permit packet to Dawson County for review and approval.', 'permit_required' => 1, 'permit_name' => 'Dawson County Residential Building Permit', 'expected_duration_days' => 21],
        ['phase_key' => 'dawson_county_permits', 'title' => 'Obtain erosion-control or land disturbance approval (if required)', 'description' => 'Secure grading/erosion authorization before significant site disturbance and install required controls.', 'permit_required' => 1, 'permit_name' => 'Land Disturbance / Erosion Control', 'expected_duration_days' => 14],
        ['phase_key' => 'dawson_county_permits', 'title' => 'Obtain driveway access approval', 'description' => 'Coordinate county road driveway permit or state-route encroachment permit where applicable.', 'permit_required' => 1, 'permit_name' => 'Driveway Permit / Encroachment', 'expected_duration_days' => 14],
        ['phase_key' => 'dawson_county_permits', 'title' => 'Obtain septic permit or sewer utility approval', 'description' => 'Coordinate with Environmental Health for septic permit and final approval, or utility provider for sewer service acceptance.', 'permit_required' => 1, 'permit_name' => 'Septic Permit or Sewer Approval', 'expected_duration_days' => 21],
        ['phase_key' => 'site_preparation', 'title' => 'Install erosion controls and clear/grade homesite', 'description' => 'Install approved controls, clear vegetation, and grade the site to approved elevations.', 'permit_required' => 0, 'permit_name' => null, 'expected_duration_days' => 10],
        ['phase_key' => 'foundation', 'title' => 'Excavate footings and complete footing inspection', 'description' => 'Complete footing excavation, rebar placement, and required inspection prior to concrete placement.', 'permit_required' => 1, 'permit_name' => 'Footing Inspection', 'expected_duration_days' => 7],
        ['phase_key' => 'foundation', 'title' => 'Complete foundation/slab and foundation inspection', 'description' => 'Install slab/foundation components and pass foundation inspection before framing.', 'permit_required' => 1, 'permit_name' => 'Foundation Inspection', 'expected_duration_days' => 10],
        ['phase_key' => 'framing_shell', 'title' => 'Frame structure and dry-in exterior envelope', 'description' => 'Complete framing, roof sheathing, and weatherproofing to prepare for rough-ins.', 'permit_required' => 0, 'permit_name' => null, 'expected_duration_days' => 21],
        ['phase_key' => 'framing_shell', 'title' => 'Pass framing inspection', 'description' => 'Schedule and pass framing inspection prior to insulation and finish work.', 'permit_required' => 1, 'permit_name' => 'Framing Inspection', 'expected_duration_days' => 3],
        ['phase_key' => 'mep_rough_in', 'title' => 'Complete rough electrical/plumbing/mechanical and inspections', 'description' => 'Install MEP rough-ins and pass required rough inspections before insulation and drywall.', 'permit_required' => 1, 'permit_name' => 'Rough MEP Inspections', 'expected_duration_days' => 14],
        ['phase_key' => 'interior_finishes', 'title' => 'Install insulation and drywall after approval', 'description' => 'Complete insulation inspection if required, then hang and finish drywall.', 'permit_required' => 1, 'permit_name' => 'Insulation Inspection', 'expected_duration_days' => 10],
        ['phase_key' => 'interior_finishes', 'title' => 'Complete interior and exterior finishes', 'description' => 'Install flooring, cabinetry, trim, fixtures, and exterior finish scope.', 'permit_required' => 0, 'permit_name' => null, 'expected_duration_days' => 30],
        ['phase_key' => 'inspections_closeout', 'title' => 'Pass final building and trade inspections', 'description' => 'Complete punch list and pass final county inspections for all applicable trades.', 'permit_required' => 1, 'permit_name' => 'Final Inspections', 'expected_duration_days' => 7],
        ['phase_key' => 'inspections_closeout', 'title' => 'Receive certificate of occupancy', 'description' => 'Obtain final occupancy approval before move-in.', 'permit_required' => 1, 'permit_name' => 'Certificate of Occupancy', 'expected_duration_days' => 3],
        ['phase_key' => 'move_in', 'title' => 'Complete move-in and warranty documentation', 'description' => 'Transfer utility accounts, finalize lien waivers, and store closeout/warranty documents.', 'permit_required' => 0, 'permit_name' => null, 'expected_duration_days' => 5],
    ];
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

function catn8_build_wizard_normalize_phase_key($value): string
{
    $raw = strtolower(trim((string)$value));
    if ($raw === '') {
        return 'general';
    }
    $raw = preg_replace('/[^a-z0-9_ -]+/', '', $raw);
    if (!is_string($raw)) {
        return 'general';
    }
    $raw = str_replace(' ', '_', trim($raw));
    if ($raw === '') {
        return 'general';
    }
    if (strlen($raw) > 64) {
        $raw = substr($raw, 0, 64);
    }
    return $raw;
}

function catn8_build_wizard_insert_steps(int $projectId, array $steps, bool $skipExistingTitles = false): int
{
    if ($projectId <= 0 || !$steps) {
        return 0;
    }

    $maxOrderRow = Database::queryOne('SELECT MAX(step_order) AS max_order FROM build_wizard_steps WHERE project_id = ?', [$projectId]);
    $stepOrder = (int)($maxOrderRow['max_order'] ?? 0);
    $inserted = 0;

    $existingTitles = [];
    if ($skipExistingTitles) {
        $rows = Database::queryAll('SELECT title FROM build_wizard_steps WHERE project_id = ?', [$projectId]);
        foreach ($rows as $r) {
            $key = strtolower(trim((string)($r['title'] ?? '')));
            if ($key !== '') {
                $existingTitles[$key] = true;
            }
        }
    }

    foreach ($steps as $s) {
        if (!is_array($s)) {
            continue;
        }

        $title = trim((string)($s['title'] ?? ''));
        if ($title === '') {
            continue;
        }

        if ($skipExistingTitles && isset($existingTitles[strtolower($title)])) {
            continue;
        }

        $stepOrder++;
        $duration = isset($s['expected_duration_days']) && is_numeric($s['expected_duration_days'])
            ? (int)$s['expected_duration_days']
            : null;

        Database::execute(
            'INSERT INTO build_wizard_steps
                (project_id, step_order, phase_key, title, description, permit_required, permit_name, expected_start_date, expected_end_date, expected_duration_days, estimated_cost, actual_cost, is_completed, completed_at, ai_generated, source_ref)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, 0, ?)',
            [
                $projectId,
                $stepOrder,
                catn8_build_wizard_normalize_phase_key($s['phase_key'] ?? 'general'),
                $title,
                trim((string)($s['description'] ?? '')),
                !empty($s['permit_required']) ? 1 : 0,
                isset($s['permit_name']) ? trim((string)$s['permit_name']) : null,
                catn8_build_wizard_parse_date_or_null($s['expected_start_date'] ?? null),
                catn8_build_wizard_parse_date_or_null($s['expected_end_date'] ?? null),
                $duration,
                catn8_build_wizard_to_decimal_or_null($s['estimated_cost'] ?? null),
                trim((string)($s['source_ref'] ?? 'Dawson County residential template')),
            ]
        );
        $inserted++;
    }

    return $inserted;
}

function catn8_build_wizard_seed_dawsonville_checklist(int $projectId): void
{
    $templateSteps = catn8_build_wizard_dawsonville_template_steps();
    catn8_build_wizard_insert_steps($projectId, $templateSteps, true);
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

    $normalizedSeedSteps = [];
    foreach ($steps as $s) {
        if (!is_array($s)) {
            continue;
        }
        $title = trim((string)($s['title'] ?? ''));
        if ($title === '') {
            continue;
        }
        $normalizedSeedSteps[] = $s;
    }

    catn8_build_wizard_insert_steps($projectId, $normalizedSeedSteps, false);
    catn8_build_wizard_seed_dawsonville_checklist($projectId);
}

function catn8_build_wizard_list_projects(int $uid): array
{
    $rows = Database::queryAll(
        'SELECT p.id, p.title, p.status, p.created_at, p.updated_at,
                COUNT(s.id) AS step_count,
                SUM(CASE WHEN s.is_completed = 1 THEN 1 ELSE 0 END) AS completed_step_count
         FROM build_wizard_projects p
         LEFT JOIN build_wizard_steps s ON s.project_id = p.id
         WHERE p.owner_user_id = ?
         GROUP BY p.id, p.title, p.status, p.created_at, p.updated_at
         ORDER BY p.updated_at DESC, p.id DESC',
        [$uid]
    );

    $list = [];
    foreach ($rows as $r) {
        $list[] = [
            'id' => (int)($r['id'] ?? 0),
            'title' => (string)($r['title'] ?? ''),
            'status' => (string)($r['status'] ?? 'planning'),
            'created_at' => (string)($r['created_at'] ?? ''),
            'updated_at' => (string)($r['updated_at'] ?? ''),
            'step_count' => (int)($r['step_count'] ?? 0),
            'completed_step_count' => (int)($r['completed_step_count'] ?? 0),
        ];
    }

    return $list;
}

function catn8_build_wizard_create_project(int $uid, string $title, bool $seedFromSpreadsheet): array
{
    $cleanTitle = trim($title);
    if ($cleanTitle === '') {
        $cleanTitle = 'Build Wizard Project';
    }

    Database::execute(
        'INSERT INTO build_wizard_projects (owner_user_id, title, status, home_style, lot_address, wizard_notes) VALUES (?, ?, ?, ?, ?, ?)',
        [$uid, $cleanTitle, 'planning', '', '', '']
    );
    $id = (int)Database::lastInsertId();
    if ($id <= 0) {
        throw new RuntimeException('Failed to create build project');
    }

    if ($seedFromSpreadsheet) {
        catn8_build_wizard_seed_project_from_file($id);
    } else {
        catn8_build_wizard_insert_steps($id, catn8_build_wizard_dawsonville_template_steps(), false);
    }

    $created = Database::queryOne('SELECT * FROM build_wizard_projects WHERE id = ?', [$id]);
    if (!$created) {
        throw new RuntimeException('Failed to load created project');
    }
    return $created;
}

function catn8_build_wizard_get_or_create_project(int $uid, ?int $requestedProjectId = null): array
{
    $list = catn8_build_wizard_list_projects($uid);
    if (!$list) {
        return catn8_build_wizard_create_project($uid, 'Cabin Build Wizard (Seed)', true);
    }

    if ($requestedProjectId !== null && $requestedProjectId > 0) {
        $requested = Database::queryOne('SELECT * FROM build_wizard_projects WHERE id = ? AND owner_user_id = ? LIMIT 1', [$requestedProjectId, $uid]);
        if ($requested) {
            return $requested;
        }
    }

    $firstId = (int)($list[0]['id'] ?? 0);
    if ($firstId <= 0) {
        throw new RuntimeException('No build projects available');
    }

    $project = Database::queryOne('SELECT * FROM build_wizard_projects WHERE id = ? AND owner_user_id = ? LIMIT 1', [$firstId, $uid]);
    if (!$project) {
        throw new RuntimeException('Build project not found');
    }
    return $project;
}

function catn8_build_wizard_require_project_access(int $projectId, int $uid): array
{
    if ($projectId <= 0) {
        throw new RuntimeException('Missing project_id');
    }
    $project = Database::queryOne('SELECT * FROM build_wizard_projects WHERE id = ? AND owner_user_id = ?', [$projectId, $uid]);
    if (!$project) {
        throw new RuntimeException('Project not found or not authorized');
    }
    return $project;
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

function catn8_build_wizard_build_ai_package(array $project, array $steps, array $documents): array
{
    $projectId = (int)($project['id'] ?? 0);

    $payload = [
        'context' => [
            'generated_at' => gmdate('c'),
            'project_id' => $projectId,
            'source' => 'catn8_build_wizard_framework_v2',
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
            'Generate/optimize the full house-build timeline including permits and inspections.',
            'Return strict JSON only.',
            'Keep step_order contiguous from 1..N.',
            'Each step should include expected dates, duration, and estimated cost where possible.',
        ],
    ];

    $promptText = 'Analyze this house build package and return an optimized construction timeline including permits, inspections, prerequisites, expected durations, and budget by step. Respond with JSON only.';

    return [$promptText, $payload];
}

function catn8_build_wizard_extract_json_from_text(string $text): string
{
    $raw = trim($text);
    if ($raw === '') {
        return '';
    }

    $start = strpos($raw, '{');
    $end = strrpos($raw, '}');
    if ($start !== false && $end !== false && $end > $start) {
        $candidate = substr($raw, $start, $end - $start + 1);
        $decoded = json_decode($candidate, true);
        if (is_array($decoded)) {
            return $candidate;
        }
    }

    return '';
}

function catn8_build_wizard_ai_generate_text(array $cfg, string $systemPrompt, string $userPrompt): string
{
    $provider = strtolower(trim((string)($cfg['provider'] ?? 'openai')));
    $model = trim((string)($cfg['model'] ?? 'gpt-4o-mini'));
    $baseUrl = trim((string)($cfg['base_url'] ?? ''));
    $location = trim((string)($cfg['location'] ?? 'us-central1'));
    $providerConfig = is_array($cfg['provider_config'] ?? null) ? $cfg['provider_config'] : [];

    if ($provider === 'google_vertex_ai') {
        $saJson = secret_get(catn8_settings_ai_secret_key($provider, 'service_account_json'));
        if (!is_string($saJson) || trim($saJson) === '') {
            throw new RuntimeException('Missing AI service account JSON (google_vertex_ai)');
        }
        $sa = json_decode((string)$saJson, true);
        if (!is_array($sa)) {
            throw new RuntimeException('AI Vertex service account JSON is invalid');
        }
        $projectId = trim((string)($sa['project_id'] ?? ''));
        if ($projectId === '') {
            throw new RuntimeException('AI Vertex service account missing project_id');
        }
        if ($model === '') {
            $model = 'gemini-1.5-pro';
        }

        return catn8_vertex_ai_gemini_generate_text([
            'service_account_json' => (string)$saJson,
            'project_id' => $projectId,
            'location' => ($location !== '' ? $location : 'us-central1'),
            'model' => $model,
            'system_prompt' => $systemPrompt,
            'user_prompt' => $userPrompt,
            'temperature' => 0.1,
            'max_output_tokens' => 4096,
        ]);
    }

    if ($provider === 'openai') {
        $apiKey = secret_get(catn8_settings_ai_secret_key($provider, 'api_key'));
        if (!is_string($apiKey) || trim($apiKey) === '') {
            throw new RuntimeException('Missing AI API key (openai)');
        }

        $factory = OpenAI::factory()->withApiKey(trim((string)$apiKey));
        if ($baseUrl !== '') {
            $factory = $factory->withBaseUri(catn8_validate_external_base_url($baseUrl));
        }
        $client = $factory->make();

        $resp = $client->chat()->create([
            'model' => ($model !== '' ? $model : 'gpt-4o-mini'),
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $userPrompt],
            ],
            'temperature' => 0.1,
            'max_tokens' => 4096,
            'response_format' => ['type' => 'json_object'],
        ]);

        return (string)($resp->choices[0]->message->content ?? '');
    }

    if ($provider === 'google_ai_studio') {
        $apiKey = secret_get(catn8_settings_ai_secret_key($provider, 'api_key'));
        if (!is_string($apiKey) || trim($apiKey) === '') {
            throw new RuntimeException('Missing AI API key (google_ai_studio)');
        }
        if ($model === '') {
            throw new RuntimeException('Missing Google AI Studio model in AI config');
        }

        $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent';
        $res = catn8_http_json_with_status('POST', $url, ['x-goog-api-key' => trim((string)$apiKey)], [
            'contents' => [
                ['role' => 'user', 'parts' => [['text' => $userPrompt]]],
            ],
            'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
            'generationConfig' => [
                'temperature' => 0.1,
            ],
        ], 10, 60);

        $status = (int)($res['status'] ?? 0);
        $json = $res['json'] ?? null;
        if ($status < 200 || $status >= 300 || !is_array($json)) {
            throw new RuntimeException('AI request failed for google_ai_studio');
        }

        return (string)($json['candidates'][0]['content']['parts'][0]['text'] ?? '');
    }

    if ($provider === 'anthropic') {
        $apiKey = secret_get(catn8_settings_ai_secret_key($provider, 'api_key'));
        if (!is_string($apiKey) || trim($apiKey) === '') {
            throw new RuntimeException('Missing AI API key (anthropic)');
        }
        if ($model === '') {
            throw new RuntimeException('Missing Anthropic model in AI config');
        }

        $res = catn8_http_json_with_status('POST', 'https://api.anthropic.com/v1/messages', [
            'x-api-key' => trim((string)$apiKey),
            'anthropic-version' => '2023-06-01',
            'Content-Type' => 'application/json',
        ], [
            'model' => $model,
            'max_tokens' => 4096,
            'temperature' => 0.1,
            'system' => $systemPrompt,
            'messages' => [
                ['role' => 'user', 'content' => $userPrompt],
            ],
        ], 10, 60);

        $status = (int)($res['status'] ?? 0);
        $json = $res['json'] ?? null;
        if ($status < 200 || $status >= 300 || !is_array($json)) {
            throw new RuntimeException('AI request failed for anthropic');
        }

        return (string)($json['content'][0]['text'] ?? '');
    }

    if ($provider === 'azure_openai') {
        $apiKey = secret_get(catn8_settings_ai_secret_key($provider, 'api_key'));
        if (!is_string($apiKey) || trim($apiKey) === '') {
            throw new RuntimeException('Missing AI API key (azure_openai)');
        }

        $endpoint = trim((string)($providerConfig['azure_endpoint'] ?? ''));
        $deployment = trim((string)($providerConfig['azure_deployment'] ?? ''));
        $apiVersion = trim((string)($providerConfig['azure_api_version'] ?? ''));
        if ($endpoint === '' || $deployment === '' || $apiVersion === '') {
            throw new RuntimeException('Azure OpenAI provider_config is incomplete');
        }

        $endpoint = rtrim(catn8_validate_external_base_url($endpoint), '/');
        $url = $endpoint . '/openai/deployments/' . rawurlencode($deployment) . '/chat/completions?api-version=' . rawurlencode($apiVersion);

        $res = catn8_http_json_with_status('POST', $url, ['api-key' => trim((string)$apiKey)], [
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $userPrompt],
            ],
            'temperature' => 0.1,
            'max_tokens' => 4096,
        ], 10, 60);

        $status = (int)($res['status'] ?? 0);
        $json = $res['json'] ?? null;
        if ($status < 200 || $status >= 300 || !is_array($json)) {
            throw new RuntimeException('AI request failed for azure_openai');
        }

        return (string)($json['choices'][0]['message']['content'] ?? '');
    }

    if (in_array($provider, ['together_ai', 'fireworks_ai', 'huggingface'], true)) {
        $apiKey = secret_get(catn8_settings_ai_secret_key($provider, 'api_key'));
        if (!is_string($apiKey) || trim($apiKey) === '') {
            throw new RuntimeException('Missing AI API key (' . $provider . ')');
        }
        if ($baseUrl === '') {
            throw new RuntimeException('Missing base_url in AI config for provider ' . $provider);
        }

        $root = rtrim(catn8_validate_external_base_url($baseUrl), '/');
        $url = preg_match('#/v1$#', $root) ? ($root . '/chat/completions') : ($root . '/v1/chat/completions');

        $res = catn8_http_json_with_status('POST', $url, ['Authorization' => 'Bearer ' . trim((string)$apiKey)], [
            'model' => $model,
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $userPrompt],
            ],
            'temperature' => 0.1,
            'max_tokens' => 4096,
        ], 10, 60);

        $status = (int)($res['status'] ?? 0);
        $json = $res['json'] ?? null;
        if ($status < 200 || $status >= 300 || !is_array($json)) {
            throw new RuntimeException('AI request failed for ' . $provider);
        }

        return (string)($json['choices'][0]['message']['content'] ?? '');
    }

    throw new RuntimeException('Unsupported AI provider: ' . $provider);
}

function catn8_build_wizard_ai_generate_json(array $cfg, string $systemPrompt, string $userPrompt): array
{
    $raw = catn8_build_wizard_ai_generate_text($cfg, $systemPrompt, $userPrompt);
    $jsonText = catn8_build_wizard_extract_json_from_text($raw);
    if ($jsonText === '') {
        throw new RuntimeException('AI returned non-JSON content');
    }

    $decoded = json_decode($jsonText, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('AI returned invalid JSON');
    }

    return $decoded;
}

function catn8_build_wizard_normalize_ai_steps($steps): array
{
    if (!is_array($steps)) {
        return [];
    }

    $normalized = [];
    $order = 1;
    foreach ($steps as $step) {
        if (!is_array($step)) {
            continue;
        }
        $title = trim((string)($step['title'] ?? ''));
        if ($title === '') {
            continue;
        }

        $stepOrder = isset($step['step_order']) && is_numeric($step['step_order']) ? (int)$step['step_order'] : $order;
        if ($stepOrder <= 0) {
            $stepOrder = $order;
        }

        $duration = isset($step['expected_duration_days']) && is_numeric($step['expected_duration_days'])
            ? (int)$step['expected_duration_days']
            : null;
        if ($duration !== null && ($duration < 1 || $duration > 3650)) {
            $duration = null;
        }

        $normalized[] = [
            'step_order' => $stepOrder,
            'phase_key' => catn8_build_wizard_normalize_phase_key($step['phase_key'] ?? 'general'),
            'title' => $title,
            'description' => trim((string)($step['description'] ?? '')),
            'permit_required' => !empty($step['permit_required']) ? 1 : 0,
            'permit_name' => (($step['permit_name'] ?? null) !== null) ? trim((string)$step['permit_name']) : null,
            'expected_start_date' => catn8_build_wizard_parse_date_or_null($step['expected_start_date'] ?? null),
            'expected_end_date' => catn8_build_wizard_parse_date_or_null($step['expected_end_date'] ?? null),
            'expected_duration_days' => $duration,
            'estimated_cost' => catn8_build_wizard_to_decimal_or_null($step['estimated_cost'] ?? null),
        ];

        $order++;
    }

    usort($normalized, static fn(array $a, array $b): int => ($a['step_order'] <=> $b['step_order']));

    $reordered = [];
    foreach ($normalized as $idx => $row) {
        $row['step_order'] = $idx + 1;
        $reordered[] = $row;
    }

    return $reordered;
}

function catn8_build_wizard_upsert_ai_steps(int $projectId, array $normalizedSteps, string $sourceRef): array
{
    $inserted = 0;
    $updated = 0;

    foreach ($normalizedSteps as $s) {
        $existing = Database::queryOne(
            'SELECT id FROM build_wizard_steps WHERE project_id = ? AND step_order = ? LIMIT 1',
            [$projectId, (int)$s['step_order']]
        );

        if ($existing) {
            Database::execute(
                'UPDATE build_wizard_steps
                 SET phase_key = ?, title = ?, description = ?, permit_required = ?, permit_name = ?, expected_start_date = ?, expected_end_date = ?, expected_duration_days = ?, estimated_cost = ?, ai_generated = 1, source_ref = ?
                 WHERE id = ?',
                [
                    $s['phase_key'],
                    $s['title'],
                    $s['description'],
                    $s['permit_required'],
                    $s['permit_name'],
                    $s['expected_start_date'],
                    $s['expected_end_date'],
                    $s['expected_duration_days'],
                    $s['estimated_cost'],
                    $sourceRef,
                    (int)$existing['id'],
                ]
            );
            $updated++;
        } else {
            Database::execute(
                'INSERT INTO build_wizard_steps
                    (project_id, step_order, phase_key, title, description, permit_required, permit_name, expected_start_date, expected_end_date, expected_duration_days, estimated_cost, actual_cost, is_completed, completed_at, ai_generated, source_ref)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, 1, ?)',
                [
                    $projectId,
                    (int)$s['step_order'],
                    $s['phase_key'],
                    $s['title'],
                    $s['description'],
                    $s['permit_required'],
                    $s['permit_name'],
                    $s['expected_start_date'],
                    $s['expected_end_date'],
                    $s['expected_duration_days'],
                    $s['estimated_cost'],
                    $sourceRef,
                ]
            );
            $inserted++;
        }
    }

    return ['inserted' => $inserted, 'updated' => $updated];
}

try {
    catn8_build_wizard_tables_ensure();

    catn8_session_start();
    $viewerId = catn8_require_group_or_admin('build-wizard-users');

    $action = trim((string)($_GET['action'] ?? 'bootstrap'));

    if ($action === 'bootstrap') {
        catn8_require_method('GET');

        $requestedProjectId = isset($_GET['project_id']) ? (int)$_GET['project_id'] : null;
        $project = catn8_build_wizard_get_or_create_project($viewerId, $requestedProjectId);
        $projectId = (int)($project['id'] ?? 0);
        if ($projectId <= 0) {
            throw new RuntimeException('Build wizard project missing id');
        }

        $stepCount = Database::queryOne('SELECT COUNT(*) AS c FROM build_wizard_steps WHERE project_id = ?', [$projectId]);
        if ((int)($stepCount['c'] ?? 0) <= 0) {
            catn8_build_wizard_seed_project_from_file($projectId);
        }
        catn8_build_wizard_seed_dawsonville_checklist($projectId);

        $project = Database::queryOne('SELECT * FROM build_wizard_projects WHERE id = ?', [$projectId]) ?: $project;

        catn8_json_response([
            'success' => true,
            'selected_project_id' => $projectId,
            'projects' => catn8_build_wizard_list_projects($viewerId),
            'project' => $project,
            'steps' => catn8_build_wizard_steps_for_project($projectId),
            'documents' => catn8_build_wizard_documents_for_project($projectId),
            'leading_questions' => catn8_build_wizard_default_questions(),
        ]);
    }

    if ($action === 'create_project') {
        catn8_require_method('POST');

        $body = catn8_read_json_body();
        $title = trim((string)($body['title'] ?? ''));
        $seedMode = strtolower(trim((string)($body['seed_mode'] ?? 'blank')));
        if (!in_array($seedMode, ['blank', 'spreadsheet'], true)) {
            $seedMode = 'blank';
        }

        $project = catn8_build_wizard_create_project($viewerId, $title, $seedMode === 'spreadsheet');
        $projectId = (int)($project['id'] ?? 0);

        catn8_json_response([
            'success' => true,
            'project_id' => $projectId,
            'project' => $project,
        ]);
    }

    if ($action === 'save_project') {
        catn8_require_method('POST');

        $body = catn8_read_json_body();
        $projectId = isset($body['project_id']) ? (int)$body['project_id'] : 0;
        catn8_build_wizard_require_project_access($projectId, $viewerId);
        $status = trim((string)($body['status'] ?? 'planning'));
        $allowedStatuses = ['planning', 'active', 'on_hold', 'completed'];
        if (!in_array($status, $allowedStatuses, true)) {
            $status = 'planning';
        }

        Database::execute(
            'UPDATE build_wizard_projects
             SET title = ?, status = ?, square_feet = ?, home_style = ?, room_count = ?, bathroom_count = ?, stories_count = ?, lot_address = ?, target_start_date = ?, target_completion_date = ?, wizard_notes = ?
             WHERE id = ?',
            [
                trim((string)($body['title'] ?? 'Build Wizard Project')),
                $status,
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

        $stepRow = Database::queryOne(
            'SELECT s.id, s.project_id
             FROM build_wizard_steps s
             INNER JOIN build_wizard_projects p ON p.id = s.project_id
             WHERE s.id = ? AND p.owner_user_id = ?
             LIMIT 1',
            [$stepId, $viewerId]
        );
        if (!$stepRow) {
            throw new RuntimeException('Step not found or not authorized');
        }

        $updates = [];
        $params = [];

        if (array_key_exists('phase_key', $body)) {
            $updates[] = 'phase_key = ?';
            $params[] = catn8_build_wizard_normalize_phase_key($body['phase_key']);
        }

        if (array_key_exists('title', $body)) {
            $title = trim((string)($body['title'] ?? ''));
            if ($title === '') {
                throw new RuntimeException('Step title is required');
            }
            $updates[] = 'title = ?';
            $params[] = $title;
        }

        if (array_key_exists('description', $body)) {
            $updates[] = 'description = ?';
            $params[] = trim((string)($body['description'] ?? ''));
        }

        if (array_key_exists('permit_required', $body)) {
            $updates[] = 'permit_required = ?';
            $params[] = ((int)$body['permit_required'] === 1) ? 1 : 0;
        }

        if (array_key_exists('permit_name', $body)) {
            $permitName = trim((string)($body['permit_name'] ?? ''));
            $updates[] = 'permit_name = ?';
            $params[] = ($permitName !== '' ? $permitName : null);
        }

        if (array_key_exists('expected_start_date', $body)) {
            $updates[] = 'expected_start_date = ?';
            $params[] = catn8_build_wizard_parse_date_or_null($body['expected_start_date'] ?? null);
        }

        if (array_key_exists('expected_end_date', $body)) {
            $updates[] = 'expected_end_date = ?';
            $params[] = catn8_build_wizard_parse_date_or_null($body['expected_end_date'] ?? null);
        }

        if (array_key_exists('expected_duration_days', $body)) {
            $duration = (isset($body['expected_duration_days']) && is_numeric($body['expected_duration_days']))
                ? (int)$body['expected_duration_days']
                : null;
            if ($duration !== null && ($duration < 1 || $duration > 3650)) {
                $duration = null;
            }
            $updates[] = 'expected_duration_days = ?';
            $params[] = $duration;
        }

        if (array_key_exists('estimated_cost', $body)) {
            $updates[] = 'estimated_cost = ?';
            $params[] = catn8_build_wizard_to_decimal_or_null($body['estimated_cost']);
        }

        if (array_key_exists('source_ref', $body)) {
            $sourceRef = trim((string)($body['source_ref'] ?? ''));
            $updates[] = 'source_ref = ?';
            $params[] = ($sourceRef !== '' ? $sourceRef : null);
        }

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

        $stepRow = Database::queryOne(
            'SELECT s.id
             FROM build_wizard_steps s
             INNER JOIN build_wizard_projects p ON p.id = s.project_id
             WHERE s.id = ? AND p.owner_user_id = ?
             LIMIT 1',
            [$stepId, $viewerId]
        );
        if (!$stepRow) {
            throw new RuntimeException('Step not found or not authorized');
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
        catn8_build_wizard_require_project_access($projectId, $viewerId);

        $kind = trim((string)($_POST['kind'] ?? 'other'));
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
        $project = catn8_build_wizard_require_project_access($projectId, $viewerId);

        $steps = catn8_build_wizard_steps_for_project($projectId);
        $documents = catn8_build_wizard_documents_for_project($projectId);
        [$promptText, $payload] = catn8_build_wizard_build_ai_package($project, $steps, $documents);

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

    if ($action === 'generate_steps_from_ai') {
        catn8_require_method('POST');

        $body = catn8_read_json_body();
        $projectId = isset($body['project_id']) ? (int)$body['project_id'] : 0;
        $project = catn8_build_wizard_require_project_access($projectId, $viewerId);

        $steps = catn8_build_wizard_steps_for_project($projectId);
        $documents = catn8_build_wizard_documents_for_project($projectId);
        [$promptText, $payload] = catn8_build_wizard_build_ai_package($project, $steps, $documents);

        $cfg = catn8_settings_ai_get_config();
        $provider = strtolower(trim((string)($cfg['provider'] ?? 'openai')));
        $model = trim((string)($cfg['model'] ?? ''));

        $systemPrompt = 'You are an expert home construction planner. Return strict JSON only. Shape: {"project_updates":{},"steps":[{"step_order":1,"phase_key":"permits","title":"...","description":"...","permit_required":true,"permit_name":"...","expected_start_date":"YYYY-MM-DD or null","expected_end_date":"YYYY-MM-DD or null","expected_duration_days":number or null,"estimated_cost":number or null}]}. No markdown.';
        $userPrompt = $promptText . "\n\nBUILD PACKAGE JSON:\n" . json_encode($payload, JSON_UNESCAPED_SLASHES);

        $aiJson = catn8_build_wizard_ai_generate_json($cfg, $systemPrompt, $userPrompt);
        $normalizedSteps = catn8_build_wizard_normalize_ai_steps($aiJson['steps'] ?? []);
        if (!$normalizedSteps) {
            throw new RuntimeException('AI did not return usable steps');
        }

        Database::beginTransaction();
        try {
            $projectUpdates = is_array($aiJson['project_updates'] ?? null) ? $aiJson['project_updates'] : [];
            if ($projectUpdates) {
                Database::execute(
                    'UPDATE build_wizard_projects
                     SET home_style = ?, square_feet = ?, room_count = ?, bathroom_count = ?, stories_count = ?, target_start_date = ?, target_completion_date = ?, wizard_notes = CONCAT(COALESCE(wizard_notes, ""), ?)
                     WHERE id = ?',
                    [
                        trim((string)($projectUpdates['home_style'] ?? ($project['home_style'] ?? ''))),
                        isset($projectUpdates['square_feet']) && is_numeric($projectUpdates['square_feet']) ? (int)$projectUpdates['square_feet'] : ($project['square_feet'] !== null ? (int)$project['square_feet'] : null),
                        isset($projectUpdates['room_count']) && is_numeric($projectUpdates['room_count']) ? (int)$projectUpdates['room_count'] : ($project['room_count'] !== null ? (int)$project['room_count'] : null),
                        isset($projectUpdates['bathroom_count']) && is_numeric($projectUpdates['bathroom_count']) ? (int)$projectUpdates['bathroom_count'] : ($project['bathroom_count'] !== null ? (int)$project['bathroom_count'] : null),
                        isset($projectUpdates['stories_count']) && is_numeric($projectUpdates['stories_count']) ? (int)$projectUpdates['stories_count'] : ($project['stories_count'] !== null ? (int)$project['stories_count'] : null),
                        catn8_build_wizard_parse_date_or_null($projectUpdates['target_start_date'] ?? ($project['target_start_date'] ?? null)),
                        catn8_build_wizard_parse_date_or_null($projectUpdates['target_completion_date'] ?? ($project['target_completion_date'] ?? null)),
                        "\n\n[AI update " . gmdate('c') . "] " . trim((string)($projectUpdates['wizard_notes_append'] ?? '')),
                        $projectId,
                    ]
                );
            }

            $sourceRef = 'AI generated (' . $provider . ($model !== '' ? ':' . $model : '') . ') ' . gmdate('c');
            $changes = catn8_build_wizard_upsert_ai_steps($projectId, $normalizedSteps, $sourceRef);

            Database::execute(
                'UPDATE build_wizard_projects SET ai_prompt_text = ?, ai_payload_json = ? WHERE id = ?',
                [$promptText, json_encode($payload, JSON_UNESCAPED_SLASHES), $projectId]
            );

            Database::commit();

            catn8_json_response([
                'success' => true,
                'provider' => $provider,
                'model' => $model,
                'parsed_step_count' => count($normalizedSteps),
                'inserted_count' => (int)$changes['inserted'],
                'updated_count' => (int)$changes['updated'],
                'steps' => catn8_build_wizard_steps_for_project($projectId),
            ]);
        } catch (Throwable $txe) {
            if (Database::inTransaction()) {
                Database::rollBack();
            }
            throw $txe;
        }
    }

    catn8_json_response(['success' => false, 'error' => 'Unknown action'], 404);
} catch (Throwable $e) {
    catn8_json_response([
        'success' => false,
        'error' => $e->getMessage(),
    ], 500);
}
