<?php

declare(strict_types=1);

putenv('CATN8_DB_LOCAL_SOCKET=/run/mysqld/mysqld.sock');
$_ENV['CATN8_DB_LOCAL_SOCKET'] = '/run/mysqld/mysqld.sock';
$_SERVER['CATN8_DB_LOCAL_SOCKET'] = '/run/mysqld/mysqld.sock';

require_once dirname(__DIR__, 2) . '/api/config.php';
require_once dirname(__DIR__, 2) . '/includes/build_wizard_cabin_relink.php';

function assert_true(bool $cond, string $message): void
{
    if (!$cond) {
        throw new RuntimeException('ASSERT FAIL: ' . $message);
    }
}

Database::execute("CREATE TABLE IF NOT EXISTS build_wizard_projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_user_id INT NOT NULL,
    title VARCHAR(191) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'planning',
    is_template TINYINT(1) NOT NULL DEFAULT 0,
    square_feet INT NULL,
    home_style VARCHAR(120) NOT NULL DEFAULT '',
    home_type VARCHAR(64) NOT NULL DEFAULT '',
    room_count INT NULL,
    bedrooms_count INT NULL,
    kitchens_count INT NULL,
    bathroom_count INT NULL,
    stories_count INT NULL,
    lot_size_sqft INT NULL,
    garage_spaces INT NULL,
    parking_spaces INT NULL,
    year_built INT NULL,
    hoa_fee_monthly DECIMAL(10,2) NULL,
    lot_address VARCHAR(255) NOT NULL DEFAULT '',
    target_start_date DATE NULL,
    target_completion_date DATE NULL,
    wizard_notes TEXT NULL,
    blueprint_document_id INT NULL,
    primary_photo_document_id INT NULL,
    ai_prompt_text LONGTEXT NULL,
    ai_payload_json LONGTEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_owner_user_id (owner_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

Database::execute("CREATE TABLE IF NOT EXISTS build_wizard_steps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    step_order INT NOT NULL,
    template_step_key VARCHAR(128) NULL,
    phase_key VARCHAR(64) NOT NULL DEFAULT 'general',
    parent_step_id INT NULL,
    depends_on_step_ids_json LONGTEXT NULL,
    step_type VARCHAR(32) NOT NULL DEFAULT 'construction',
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    permit_required TINYINT(1) NOT NULL DEFAULT 0,
    is_completed TINYINT(1) NOT NULL DEFAULT 0,
    expected_start_date DATE NULL,
    expected_end_date DATE NULL,
    estimated_cost DECIMAL(10,2) NULL,
    actual_cost DECIMAL(10,2) NULL,
    source_ref VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_project_step_order (project_id, step_order),
    KEY idx_project_id (project_id),
    CONSTRAINT fk_test_bw_steps_project FOREIGN KEY (project_id) REFERENCES build_wizard_projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

Database::execute("CREATE TABLE IF NOT EXISTS build_wizard_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    step_id INT NULL,
    receipt_parent_document_id INT NULL,
    kind VARCHAR(32) NOT NULL DEFAULT 'other',
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(120) NOT NULL DEFAULT '',
    storage_path VARCHAR(255) NOT NULL,
    file_size_bytes INT NOT NULL DEFAULT 0,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY idx_project_id (project_id),
    KEY idx_step_id (step_id),
    CONSTRAINT fk_test_bw_docs_project FOREIGN KEY (project_id) REFERENCES build_wizard_projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

Database::execute("CREATE TABLE IF NOT EXISTS build_wizard_document_search_index (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    project_id INT NOT NULL,
    source_mime VARCHAR(120) NOT NULL DEFAULT 'application/octet-stream',
    extraction_method VARCHAR(32) NOT NULL DEFAULT 'none',
    content_hash CHAR(64) NOT NULL DEFAULT '',
    extracted_text LONGTEXT NULL,
    UNIQUE KEY uniq_document_id (document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

Database::execute("CREATE TABLE IF NOT EXISTS build_wizard_contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_user_id INT NOT NULL,
    project_id INT NULL,
    display_name VARCHAR(191) NOT NULL,
    contact_type VARCHAR(32) NOT NULL DEFAULT 'contact',
    KEY idx_project_id (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

Database::execute("CREATE TABLE IF NOT EXISTS build_wizard_contact_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    contact_id INT NOT NULL,
    step_id INT NULL,
    phase_key VARCHAR(64) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

Database::execute("CREATE TABLE IF NOT EXISTS build_wizard_phase_date_ranges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    phase_tab VARCHAR(32) NOT NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_project_phase_tab (project_id, phase_tab)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

$ownerId = 9001;
Database::execute('DELETE FROM users WHERE id = ?', [$ownerId]);
Database::execute(
    'INSERT INTO users (id, username, email, password_hash, is_admin, is_active, email_verified)
     VALUES (?, ?, ?, ?, 1, 1, 1)',
    [$ownerId, 'cabin_relink_test', 'cabin-relink-test@example.com', password_hash('test', PASSWORD_DEFAULT)]
);

$oldIds = Database::queryAll('SELECT id FROM build_wizard_projects WHERE owner_user_id = ?', [$ownerId]);
foreach ($oldIds as $row) {
    Database::execute('DELETE FROM build_wizard_projects WHERE id = ?', [(int)$row['id']]);
}

Database::execute(
    'INSERT INTO build_wizard_projects (owner_user_id, title, status, home_style, lot_address, wizard_notes)
     VALUES (?, ?, ?, ?, ?, ?)',
    [$ownerId, 'Cabin - 91 Singletree Ln', 'active', 'Cabin', '91 Singletree Ln', 'Original Papa cabin data']
);
$oldProjectId = (int)Database::lastInsertId();

Database::execute(
    'INSERT INTO build_wizard_steps (project_id, step_order, phase_key, step_type, title, source_ref, expected_start_date, is_completed)
     VALUES (?, 1, ?, ?, ?, ?, ?, ?), (?, 2, ?, ?, ?, ?, ?, ?), (?, 3, ?, ?, ?, ?, ?, ?)',
    [
        $oldProjectId, 'land_due_diligence', 'documentation', 'Complete boundary and topographic survey', 'Cabin Timeline.xlsx', '2018-09-01', 1,
        $oldProjectId, 'framing_shell', 'construction', 'Frame walls and install cabin gable', 'Cabin Timeline.xlsx', '2019-04-01', 0,
        $oldProjectId, 'mep_rough_in', 'purchase', 'Purchase: Blinds - electrical', 'Cabin_Expenses_Merged_With_Shopping.xlsx', '2025-01-01', 0,
    ]
);
$oldSurveyStepId = (int)(Database::queryOne('SELECT id FROM build_wizard_steps WHERE project_id = ? AND step_order = 1', [$oldProjectId])['id'] ?? 0);
$oldFramingStepId = (int)(Database::queryOne('SELECT id FROM build_wizard_steps WHERE project_id = ? AND step_order = 2', [$oldProjectId])['id'] ?? 0);

Database::execute(
    'INSERT INTO build_wizard_phase_date_ranges (project_id, phase_tab, start_date, end_date)
     VALUES (?, ?, ?, ?)',
    [$oldProjectId, 'land', '2018-08-01', '2018-12-31']
);

Database::execute(
    'INSERT INTO build_wizard_documents (project_id, step_id, kind, original_name, mime_type, storage_path, file_size_bytes)
     VALUES (?, ?, ?, ?, ?, ?, 10), (?, ?, ?, ?, ?, ?, 10), (?, ?, ?, ?, ?, ?, 10)',
    [
        $oldProjectId, $oldSurveyStepId, 'survey', 'JGraves Plat.pdf', 'application/pdf', 'uploads/build-wizard/JGraves_Plat.pdf',
        $oldProjectId, $oldFramingStepId, 'blueprint', 'Cabin Framing Dimensions - B.pdf', 'application/pdf', 'uploads/build-wizard/Cabin_Framing.pdf',
        $oldProjectId, $oldFramingStepId, 'receipt', 'Cabin Expenses.xlsx', 'application/vnd.ms-excel', 'uploads/build-wizard/Cabin_Expenses.xlsx',
    ]
);

Database::execute(
    'INSERT INTO build_wizard_projects (owner_user_id, title, status, home_style, lot_address, wizard_notes)
     VALUES (?, ?, ?, ?, ?, ?)',
    [$ownerId, "Papa's Cabin", 'planning', 'Cabin', '91 Singletree Ln', 'New 65 template shell']
);
$newProjectId = (int)Database::lastInsertId();
Database::execute(
    'INSERT INTO build_wizard_steps (project_id, step_order, phase_key, step_type, title, source_ref)
     VALUES (?, 1, ?, ?, ?, ?), (?, 2, ?, ?, ?, ?), (?, 3, ?, ?, ?, ?)',
    [
        $newProjectId, 'land_due_diligence', 'documentation', 'Complete boundary and topographic survey', 'House template v4',
        $newProjectId, 'design_preconstruction', 'blueprints', 'Finalize architectural and engineered plan set', 'House template v4',
        $newProjectId, 'framing_shell', 'construction', 'Frame walls and install cabin gable', 'House template v4',
    ]
);

$chosenDefault = catn8_build_wizard_choose_cabin_project($ownerId, null);
assert_true((int)($chosenDefault['id'] ?? 0) === $oldProjectId, 'chooser should prefer the project that still has the documents');

$chosenExplicit = catn8_build_wizard_choose_cabin_project($ownerId, $newProjectId);
assert_true((int)($chosenExplicit['id'] ?? 0) === $newProjectId, 'explicit Papa\'s Cabin id should still be honored');

$repair = catn8_build_wizard_repair_cabin_references($ownerId, $newProjectId);
assert_true((int)$repair['moved_documents'] === 3, 'repair should move the 3 cabin documents onto Papa\'s Cabin');
assert_true((int)$repair['merged_steps'] >= 2, 'repair should merge overlapping sibling steps onto Papa\'s Cabin');
assert_true((int)$repair['moved_steps'] >= 1, 'repair should move unique sibling steps onto Papa\'s Cabin');
assert_true((int)$repair['merged_phase_ranges'] >= 1, 'repair should merge phase date ranges onto Papa\'s Cabin');

$canonicalSteps = Database::queryAll(
    'SELECT id, title, expected_start_date, is_completed FROM build_wizard_steps WHERE project_id = ? ORDER BY step_order ASC',
    [$newProjectId]
);
assert_true(count($canonicalSteps) >= 4, 'Papa\'s Cabin should retain template steps plus moved legacy steps');

$surveyStep = Database::queryOne(
    "SELECT expected_start_date, is_completed FROM build_wizard_steps WHERE project_id = ? AND title = 'Complete boundary and topographic survey'",
    [$newProjectId]
);
assert_true((string)($surveyStep['expected_start_date'] ?? '') === '2018-09-01', 'merged step should keep sibling dates');
assert_true((int)($surveyStep['is_completed'] ?? 0) === 1, 'merged step should keep sibling completion');

$blindsStep = Database::queryOne(
    "SELECT id FROM build_wizard_steps WHERE project_id = ? AND title = 'Purchase: Blinds - electrical'",
    [$newProjectId]
);
assert_true((int)($blindsStep['id'] ?? 0) > 0, 'unique sibling steps should move onto Papa\'s Cabin');

$phaseRange = Database::queryOne(
    "SELECT start_date, end_date FROM build_wizard_phase_date_ranges WHERE project_id = ? AND phase_tab = 'land'",
    [$newProjectId]
);
assert_true((string)($phaseRange['start_date'] ?? '') === '2018-08-01', 'phase date ranges should merge onto Papa\'s Cabin');

assert_true(((int)$repair['remapped_step_ids'] + (int)$repair['remapped_step_references']) >= 3, 'repair should relink documents/tasks onto canonical steps');

$docs = Database::queryAll(
    'SELECT d.original_name, d.project_id, d.step_id, s.title AS step_title, s.project_id AS step_project_id
     FROM build_wizard_documents d
     LEFT JOIN build_wizard_steps s ON s.id = d.step_id AND s.project_id = d.project_id
     WHERE d.project_id = ?
     ORDER BY d.id',
    [$newProjectId]
);
assert_true(count($docs) === 3, 'Papa\'s Cabin should now own all 3 documents');

$leftBehind = Database::queryAll('SELECT id FROM build_wizard_documents WHERE project_id = ?', [$oldProjectId]);
assert_true(count($leftBehind) === 0, 'old cabin project should no longer hold the documents');

foreach ($docs as $doc) {
    assert_true((int)($doc['step_id'] ?? 0) > 0, 'each recovered document should have a step_id');
    assert_true((int)($doc['step_project_id'] ?? 0) === $newProjectId, 'step_id must belong to Papa\'s Cabin, not the old project');
    assert_true(trim((string)($doc['step_title'] ?? '')) !== '', 'document listing join should resolve a step title');
}

$plat = Database::queryOne(
    "SELECT s.phase_key FROM build_wizard_documents d
     JOIN build_wizard_steps s ON s.id = d.step_id
     WHERE d.project_id = ? AND d.original_name = 'JGraves Plat.pdf'",
    [$newProjectId]
);
assert_true(($plat['phase_key'] ?? '') === 'land_due_diligence', 'plat should land on a land-due-diligence step');

echo json_encode([
    'success' => true,
    'old_project_id' => $oldProjectId,
    'new_project_id' => $newProjectId,
    'auto_selected_project_id' => (int)$chosenDefault['id'],
    'repair' => $repair,
    'documents' => $docs,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
