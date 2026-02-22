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

    Database::execute("CREATE TABLE IF NOT EXISTS build_wizard_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        step_id INT NULL,
        kind VARCHAR(32) NOT NULL DEFAULT 'other',
        original_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(120) NOT NULL DEFAULT '',
        storage_path VARCHAR(255) NOT NULL,
        file_size_bytes INT NOT NULL DEFAULT 0,
        caption VARCHAR(255) NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_project_id (project_id),
        KEY idx_step_id (step_id),
        CONSTRAINT fk_build_wizard_documents_project FOREIGN KEY (project_id) REFERENCES build_wizard_projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS build_wizard_document_images (
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

    Database::execute("CREATE TABLE IF NOT EXISTS build_wizard_document_search_index (
        id INT AUTO_INCREMENT PRIMARY KEY,
        document_id INT NOT NULL,
        project_id INT NOT NULL,
        source_mime VARCHAR(120) NOT NULL DEFAULT 'application/octet-stream',
        extraction_method VARCHAR(32) NOT NULL DEFAULT 'none',
        content_hash CHAR(64) NOT NULL DEFAULT '',
        extracted_text LONGTEXT NULL,
        indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_document_id (document_id),
        KEY idx_project_id (project_id),
        FULLTEXT KEY ft_extracted_text (extracted_text),
        CONSTRAINT fk_build_wizard_document_search_document FOREIGN KEY (document_id) REFERENCES build_wizard_documents(id) ON DELETE CASCADE,
        CONSTRAINT fk_build_wizard_document_search_project FOREIGN KEY (project_id) REFERENCES build_wizard_projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS build_wizard_steps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        step_order INT NOT NULL,
        phase_key VARCHAR(64) NOT NULL DEFAULT 'general',
        parent_step_id INT NULL,
        depends_on_step_ids_json LONGTEXT NULL,
        step_type VARCHAR(32) NOT NULL DEFAULT 'construction',
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        permit_required TINYINT(1) NOT NULL DEFAULT 0,
        permit_document_id INT NULL,
        permit_name VARCHAR(191) NULL,
        permit_authority VARCHAR(191) NULL,
        permit_status VARCHAR(32) NULL,
        permit_application_url VARCHAR(500) NULL,
        purchase_category VARCHAR(120) NULL,
        purchase_brand VARCHAR(120) NULL,
        purchase_model VARCHAR(191) NULL,
        purchase_sku VARCHAR(120) NULL,
        purchase_unit VARCHAR(32) NULL,
        purchase_qty DECIMAL(10,2) NULL,
        purchase_unit_price DECIMAL(10,2) NULL,
        purchase_vendor VARCHAR(191) NULL,
        purchase_url VARCHAR(500) NULL,
        expected_start_date DATE NULL,
        expected_end_date DATE NULL,
        expected_duration_days INT NULL,
        estimated_cost DECIMAL(10,2) NULL,
        actual_cost DECIMAL(10,2) NULL,
        ai_estimated_fields_json LONGTEXT NULL,
        is_completed TINYINT(1) NOT NULL DEFAULT 0,
        completed_at DATETIME NULL,
        ai_generated TINYINT(1) NOT NULL DEFAULT 0,
        source_ref VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_project_step_order (project_id, step_order),
        KEY idx_project_id (project_id),
        KEY idx_parent_step_id (parent_step_id),
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

    Database::execute("CREATE TABLE IF NOT EXISTS build_wizard_step_audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        step_id INT NOT NULL,
        actor_user_id INT NULL,
        action_key VARCHAR(40) NOT NULL DEFAULT 'updated',
        changes_json LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_project_step_created (project_id, step_id, created_at),
        KEY idx_step_id (step_id),
        CONSTRAINT fk_build_wizard_step_audit_step FOREIGN KEY (step_id) REFERENCES build_wizard_steps(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS build_wizard_contacts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        project_id INT NULL,
        display_name VARCHAR(191) NOT NULL,
        contact_type VARCHAR(32) NOT NULL DEFAULT 'contact',
        email VARCHAR(191) NULL,
        phone VARCHAR(64) NULL,
        company VARCHAR(191) NULL,
        role_title VARCHAR(120) NULL,
        notes TEXT NULL,
        is_vendor TINYINT(1) NOT NULL DEFAULT 0,
        vendor_type VARCHAR(64) NULL,
        vendor_license VARCHAR(120) NULL,
        vendor_trade VARCHAR(120) NULL,
        vendor_website VARCHAR(500) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_owner_user_id (owner_user_id),
        KEY idx_project_id (project_id),
        KEY idx_contact_type (contact_type),
        KEY idx_is_vendor (is_vendor),
        CONSTRAINT fk_build_wizard_contacts_project FOREIGN KEY (project_id) REFERENCES build_wizard_projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS build_wizard_contact_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        contact_id INT NOT NULL,
        step_id INT NULL,
        phase_key VARCHAR(64) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_project_id (project_id),
        KEY idx_contact_id (contact_id),
        KEY idx_step_id (step_id),
        KEY idx_phase_key (phase_key),
        UNIQUE KEY uniq_contact_scope (project_id, contact_id, step_id, phase_key),
        CONSTRAINT fk_build_wizard_contact_assignments_project FOREIGN KEY (project_id) REFERENCES build_wizard_projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_build_wizard_contact_assignments_contact FOREIGN KEY (contact_id) REFERENCES build_wizard_contacts(id) ON DELETE CASCADE,
        CONSTRAINT fk_build_wizard_contact_assignments_step FOREIGN KEY (step_id) REFERENCES build_wizard_steps(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS build_wizard_phase_date_ranges (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        phase_tab VARCHAR(32) NOT NULL,
        start_date DATE NULL,
        end_date DATE NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_project_phase_tab (project_id, phase_tab),
        KEY idx_project_id (project_id),
        CONSTRAINT fk_build_wizard_phase_date_ranges_project FOREIGN KEY (project_id) REFERENCES build_wizard_projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $hasStepId = Database::queryOne(
        'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
        ['build_wizard_documents', 'step_id']
    );
    if (!$hasStepId) {
        Database::execute('ALTER TABLE build_wizard_documents ADD COLUMN step_id INT NULL AFTER project_id');
        Database::execute('ALTER TABLE build_wizard_documents ADD KEY idx_step_id (step_id)');
    }

    $hasCaption = Database::queryOne(
        'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
        ['build_wizard_documents', 'caption']
    );
    if (!$hasCaption) {
        Database::execute('ALTER TABLE build_wizard_documents ADD COLUMN caption VARCHAR(255) NULL AFTER file_size_bytes');
    }

    $hasPrimaryPhotoDocumentId = Database::queryOne(
        'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
        ['build_wizard_projects', 'primary_photo_document_id']
    );
    if (!$hasPrimaryPhotoDocumentId) {
        Database::execute('ALTER TABLE build_wizard_projects ADD COLUMN primary_photo_document_id INT NULL AFTER blueprint_document_id');
    }

    $projectColumns = [
        'home_type' => "ALTER TABLE build_wizard_projects ADD COLUMN home_type VARCHAR(64) NOT NULL DEFAULT '' AFTER home_style",
        'bedrooms_count' => 'ALTER TABLE build_wizard_projects ADD COLUMN bedrooms_count INT NULL AFTER room_count',
        'kitchens_count' => 'ALTER TABLE build_wizard_projects ADD COLUMN kitchens_count INT NULL AFTER bedrooms_count',
        'lot_size_sqft' => 'ALTER TABLE build_wizard_projects ADD COLUMN lot_size_sqft INT NULL AFTER stories_count',
        'garage_spaces' => 'ALTER TABLE build_wizard_projects ADD COLUMN garage_spaces INT NULL AFTER lot_size_sqft',
        'parking_spaces' => 'ALTER TABLE build_wizard_projects ADD COLUMN parking_spaces INT NULL AFTER garage_spaces',
        'year_built' => 'ALTER TABLE build_wizard_projects ADD COLUMN year_built INT NULL AFTER parking_spaces',
        'hoa_fee_monthly' => 'ALTER TABLE build_wizard_projects ADD COLUMN hoa_fee_monthly DECIMAL(10,2) NULL AFTER year_built',
    ];
    foreach ($projectColumns as $column => $alterSql) {
        $exists = Database::queryOne(
            'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
            ['build_wizard_projects', $column]
        );
        if (!$exists) {
            Database::execute($alterSql);
        }
    }

    $stepColumns = [
        'parent_step_id' => "ALTER TABLE build_wizard_steps ADD COLUMN parent_step_id INT NULL AFTER phase_key",
        'depends_on_step_ids_json' => "ALTER TABLE build_wizard_steps ADD COLUMN depends_on_step_ids_json LONGTEXT NULL AFTER phase_key",
        'step_type' => "ALTER TABLE build_wizard_steps ADD COLUMN step_type VARCHAR(32) NOT NULL DEFAULT 'construction' AFTER phase_key",
        'permit_document_id' => "ALTER TABLE build_wizard_steps ADD COLUMN permit_document_id INT NULL AFTER permit_required",
        'permit_authority' => "ALTER TABLE build_wizard_steps ADD COLUMN permit_authority VARCHAR(191) NULL AFTER permit_name",
        'permit_status' => "ALTER TABLE build_wizard_steps ADD COLUMN permit_status VARCHAR(32) NULL AFTER permit_authority",
        'permit_application_url' => "ALTER TABLE build_wizard_steps ADD COLUMN permit_application_url VARCHAR(500) NULL AFTER permit_status",
        'purchase_category' => "ALTER TABLE build_wizard_steps ADD COLUMN purchase_category VARCHAR(120) NULL AFTER permit_application_url",
        'purchase_brand' => "ALTER TABLE build_wizard_steps ADD COLUMN purchase_brand VARCHAR(120) NULL AFTER purchase_category",
        'purchase_model' => "ALTER TABLE build_wizard_steps ADD COLUMN purchase_model VARCHAR(191) NULL AFTER purchase_brand",
        'purchase_sku' => "ALTER TABLE build_wizard_steps ADD COLUMN purchase_sku VARCHAR(120) NULL AFTER purchase_model",
        'purchase_unit' => "ALTER TABLE build_wizard_steps ADD COLUMN purchase_unit VARCHAR(32) NULL AFTER purchase_sku",
        'purchase_qty' => "ALTER TABLE build_wizard_steps ADD COLUMN purchase_qty DECIMAL(10,2) NULL AFTER purchase_unit",
        'purchase_unit_price' => "ALTER TABLE build_wizard_steps ADD COLUMN purchase_unit_price DECIMAL(10,2) NULL AFTER purchase_qty",
        'purchase_vendor' => "ALTER TABLE build_wizard_steps ADD COLUMN purchase_vendor VARCHAR(191) NULL AFTER purchase_unit_price",
        'purchase_url' => "ALTER TABLE build_wizard_steps ADD COLUMN purchase_url VARCHAR(500) NULL AFTER purchase_vendor",
        'ai_estimated_fields_json' => "ALTER TABLE build_wizard_steps ADD COLUMN ai_estimated_fields_json LONGTEXT NULL AFTER actual_cost",
    ];
    foreach ($stepColumns as $column => $alterSql) {
        $exists = Database::queryOne(
            'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
            ['build_wizard_steps', $column]
        );
        if (!$exists) {
            Database::execute($alterSql);
        }
    }

    $contactColumns = [
        'project_id' => 'ALTER TABLE build_wizard_contacts ADD COLUMN project_id INT NULL AFTER owner_user_id',
        'display_name' => 'ALTER TABLE build_wizard_contacts ADD COLUMN display_name VARCHAR(191) NOT NULL DEFAULT \'\' AFTER project_id',
        'contact_type' => "ALTER TABLE build_wizard_contacts ADD COLUMN contact_type VARCHAR(32) NOT NULL DEFAULT 'contact' AFTER display_name",
        'email' => 'ALTER TABLE build_wizard_contacts ADD COLUMN email VARCHAR(191) NULL AFTER contact_type',
        'phone' => 'ALTER TABLE build_wizard_contacts ADD COLUMN phone VARCHAR(64) NULL AFTER email',
        'company' => 'ALTER TABLE build_wizard_contacts ADD COLUMN company VARCHAR(191) NULL AFTER phone',
        'role_title' => 'ALTER TABLE build_wizard_contacts ADD COLUMN role_title VARCHAR(120) NULL AFTER company',
        'notes' => 'ALTER TABLE build_wizard_contacts ADD COLUMN notes TEXT NULL AFTER role_title',
        'is_vendor' => 'ALTER TABLE build_wizard_contacts ADD COLUMN is_vendor TINYINT(1) NOT NULL DEFAULT 0 AFTER notes',
        'vendor_type' => 'ALTER TABLE build_wizard_contacts ADD COLUMN vendor_type VARCHAR(64) NULL AFTER is_vendor',
        'vendor_license' => 'ALTER TABLE build_wizard_contacts ADD COLUMN vendor_license VARCHAR(120) NULL AFTER vendor_type',
        'vendor_trade' => 'ALTER TABLE build_wizard_contacts ADD COLUMN vendor_trade VARCHAR(120) NULL AFTER vendor_license',
        'vendor_website' => 'ALTER TABLE build_wizard_contacts ADD COLUMN vendor_website VARCHAR(500) NULL AFTER vendor_trade',
        'updated_at' => 'ALTER TABLE build_wizard_contacts ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
    ];
    foreach ($contactColumns as $column => $alterSql) {
        $exists = Database::queryOne(
            'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
            ['build_wizard_contacts', $column]
        );
        if (!$exists) {
            Database::execute($alterSql);
        }
    }

    $contactIndexes = [
        'idx_owner_user_id' => 'ALTER TABLE build_wizard_contacts ADD KEY idx_owner_user_id (owner_user_id)',
        'idx_project_id' => 'ALTER TABLE build_wizard_contacts ADD KEY idx_project_id (project_id)',
        'idx_contact_type' => 'ALTER TABLE build_wizard_contacts ADD KEY idx_contact_type (contact_type)',
        'idx_is_vendor' => 'ALTER TABLE build_wizard_contacts ADD KEY idx_is_vendor (is_vendor)',
    ];
    foreach ($contactIndexes as $indexName => $indexSql) {
        $exists = Database::queryOne(
            'SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
            ['build_wizard_contacts', $indexName]
        );
        if (!$exists) {
            Database::execute($indexSql);
        }
    }

    $assignmentColumns = [
        'project_id' => 'ALTER TABLE build_wizard_contact_assignments ADD COLUMN project_id INT NOT NULL AFTER id',
        'contact_id' => 'ALTER TABLE build_wizard_contact_assignments ADD COLUMN contact_id INT NOT NULL AFTER project_id',
        'step_id' => 'ALTER TABLE build_wizard_contact_assignments ADD COLUMN step_id INT NULL AFTER contact_id',
        'phase_key' => "ALTER TABLE build_wizard_contact_assignments ADD COLUMN phase_key VARCHAR(64) NULL AFTER step_id",
        'created_at' => 'ALTER TABLE build_wizard_contact_assignments ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER phase_key',
    ];
    foreach ($assignmentColumns as $column => $alterSql) {
        $exists = Database::queryOne(
            'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
            ['build_wizard_contact_assignments', $column]
        );
        if (!$exists) {
            Database::execute($alterSql);
        }
    }

    $assignmentIndexes = [
        'idx_project_id' => 'ALTER TABLE build_wizard_contact_assignments ADD KEY idx_project_id (project_id)',
        'idx_contact_id' => 'ALTER TABLE build_wizard_contact_assignments ADD KEY idx_contact_id (contact_id)',
        'idx_step_id' => 'ALTER TABLE build_wizard_contact_assignments ADD KEY idx_step_id (step_id)',
        'idx_phase_key' => 'ALTER TABLE build_wizard_contact_assignments ADD KEY idx_phase_key (phase_key)',
        'uniq_contact_scope' => 'ALTER TABLE build_wizard_contact_assignments ADD UNIQUE KEY uniq_contact_scope (project_id, contact_id, step_id, phase_key)',
    ];
    foreach ($assignmentIndexes as $indexName => $indexSql) {
        $exists = Database::queryOne(
            'SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
            ['build_wizard_contact_assignments', $indexName]
        );
        if (!$exists) {
            Database::execute($indexSql);
        }
    }

    $phaseRangeColumns = [
        'project_id' => 'ALTER TABLE build_wizard_phase_date_ranges ADD COLUMN project_id INT NOT NULL AFTER id',
        'phase_tab' => 'ALTER TABLE build_wizard_phase_date_ranges ADD COLUMN phase_tab VARCHAR(32) NOT NULL AFTER project_id',
        'start_date' => 'ALTER TABLE build_wizard_phase_date_ranges ADD COLUMN start_date DATE NULL AFTER phase_tab',
        'end_date' => 'ALTER TABLE build_wizard_phase_date_ranges ADD COLUMN end_date DATE NULL AFTER start_date',
        'updated_at' => 'ALTER TABLE build_wizard_phase_date_ranges ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
    ];
    foreach ($phaseRangeColumns as $column => $alterSql) {
        $exists = Database::queryOne(
            'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
            ['build_wizard_phase_date_ranges', $column]
        );
        if (!$exists) {
            Database::execute($alterSql);
        }
    }

    $phaseRangeIndexes = [
        'uniq_project_phase_tab' => 'ALTER TABLE build_wizard_phase_date_ranges ADD UNIQUE KEY uniq_project_phase_tab (project_id, phase_tab)',
        'idx_project_id' => 'ALTER TABLE build_wizard_phase_date_ranges ADD KEY idx_project_id (project_id)',
    ];
    foreach ($phaseRangeIndexes as $indexName => $indexSql) {
        $exists = Database::queryOne(
            'SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
            ['build_wizard_phase_date_ranges', $indexName]
        );
        if (!$exists) {
            Database::execute($indexSql);
        }
    }

    $hasParentStepIndex = Database::queryOne(
        'SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
        ['build_wizard_steps', 'idx_parent_step_id']
    );
    if (!$hasParentStepIndex) {
        Database::execute('ALTER TABLE build_wizard_steps ADD KEY idx_parent_step_id (parent_step_id)');
    }

    $hasDocSearchFulltext = Database::queryOne(
        'SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
        ['build_wizard_document_search_index', 'ft_extracted_text']
    );
    if (!$hasDocSearchFulltext) {
        Database::execute('ALTER TABLE build_wizard_document_search_index ADD FULLTEXT KEY ft_extracted_text (extracted_text)');
    }

    $stepAuditIndexes = [
        'idx_project_step_created' => 'ALTER TABLE build_wizard_step_audit_logs ADD KEY idx_project_step_created (project_id, step_id, created_at)',
        'idx_step_id' => 'ALTER TABLE build_wizard_step_audit_logs ADD KEY idx_step_id (step_id)',
    ];
    foreach ($stepAuditIndexes as $indexName => $indexSql) {
        $exists = Database::queryOne(
            'SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
            ['build_wizard_step_audit_logs', $indexName]
        );
        if (!$exists) {
            Database::execute($indexSql);
        }
    }
}

function catn8_build_wizard_step_type(string $value): string
{
    $t = strtolower(trim($value));
    return match ($t) {
        'permit', 'purchase', 'inspection', 'documentation', 'construction', 'photos', 'blueprints', 'utility', 'delivery', 'milestone', 'closeout', 'other' => $t,
        default => 'construction',
    };
}

function catn8_build_wizard_document_kind($value): string
{
    $raw = strtolower(trim((string)$value));
    return match ($raw) {
        'blueprint', 'document', 'home_photo', 'other', 'permit', 'photo', 'progress_photo', 'receipt', 'site_photo', 'spec_sheet', 'survey' => $raw,
        default => 'other',
    };
}

function catn8_build_wizard_infer_step_type(string $title, string $phaseKey = '', int $permitRequired = 0): string
{
    $t = strtolower(trim($title . ' ' . $phaseKey));
    if (str_contains($t, 'blueprint') || str_contains($t, 'plan set') || str_contains($t, 'architect')) {
        return 'blueprints';
    }
    if (str_contains($t, 'photo') || str_contains($t, 'images') || str_contains($t, 'gallery')) {
        return 'photos';
    }
    if (str_contains($t, 'utility') || str_contains($t, 'power') || str_contains($t, 'water') || str_contains($t, 'gas')) {
        return 'utility';
    }
    if (str_contains($t, 'delivery') || str_contains($t, 'dropoff') || str_contains($t, 'shipment')) {
        return 'delivery';
    }
    if (str_contains($t, 'closeout') || str_contains($t, 'warranty') || str_contains($t, 'handoff')) {
        return 'closeout';
    }
    if (str_contains($t, 'milestone')) {
        return 'milestone';
    }
    if ($permitRequired === 1 || str_contains($t, 'permit') || str_contains($t, 'approval') || str_contains($t, 'application')) {
        return 'permit';
    }
    if (str_contains($t, 'inspect')) {
        return 'inspection';
    }
    if (str_contains($t, 'purchase') || str_contains($t, 'buy') || str_contains($t, 'order') || str_contains($t, 'material')) {
        return 'purchase';
    }
    if (str_contains($t, 'document') || str_contains($t, 'packet') || str_contains($t, 'plans') || str_contains($t, 'plat')) {
        return 'documentation';
    }
    if (
        str_contains($t, 'install') || str_contains($t, 'frame') || str_contains($t, 'pour') || str_contains($t, 'rough')
        || str_contains($t, 'grade') || str_contains($t, 'slab') || str_contains($t, 'excavat') || str_contains($t, 'finish')
    ) {
        return 'construction';
    }
    return 'other';
}

function catn8_build_wizard_normalize_int_array($value): array
{
    if (!is_array($value)) {
        return [];
    }
    $out = [];
    foreach ($value as $v) {
        $n = (int)$v;
        if ($n > 0) {
            $out[] = $n;
        }
    }
    $out = array_values(array_unique($out));
    sort($out);
    return $out;
}

function catn8_build_wizard_normalize_ai_estimated_fields($value): array
{
    if (!is_array($value)) {
        return [];
    }
    $allowed = [
        'expected_start_date' => true,
        'expected_end_date' => true,
        'expected_duration_days' => true,
        'estimated_cost' => true,
        'permit_name' => true,
    ];
    $out = [];
    foreach ($value as $field) {
        $clean = trim((string)$field);
        if ($clean !== '' && isset($allowed[$clean])) {
            $out[] = $clean;
        }
    }
    return array_values(array_unique($out));
}

function catn8_build_wizard_decode_json_array($raw): array
{
    if (!is_string($raw) || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function catn8_build_wizard_title_key(string $title): string
{
    $normalized = preg_replace('/\s+/', ' ', trim($title));
    if (!is_string($normalized)) {
        return '';
    }
    return strtolower(trim($normalized));
}

function catn8_build_wizard_text_or_null($value, int $maxLen = 500): ?string
{
    $v = trim((string)$value);
    if ($v === '') {
        return null;
    }
    if (strlen($v) > $maxLen) {
        $v = substr($v, 0, $maxLen);
    }
    return $v;
}

function catn8_build_wizard_normalize_contact_type($value, int $isVendor = 0): string
{
    $raw = strtolower(trim((string)$value));
    return match ($raw) {
        'vendor' => 'vendor',
        'authority' => 'authority',
        'contact' => 'contact',
        default => ($isVendor === 1 ? 'vendor' : 'contact'),
    };
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

function catn8_build_wizard_house_template_path(): string
{
    return dirname(__DIR__) . '/Build Wizard/seed/house_template.json';
}

function catn8_build_wizard_default_house_template_steps(): array
{
    return [
        ['template_step_key' => 'land_contract', 'phase_key' => 'land_due_diligence', 'step_type' => 'documentation', 'title' => 'Confirm lot ownership, zoning, setbacks, and deed restrictions', 'description' => 'Verify legal build rights before spending on design and permitting.', 'permit_required' => 0, 'expected_duration_days' => 5],
        ['template_step_key' => 'survey_topo', 'phase_key' => 'land_due_diligence', 'step_type' => 'documentation', 'title' => 'Complete boundary and topographic survey', 'description' => 'Establish buildable area, elevations, and utility tie-in constraints.', 'permit_required' => 0, 'expected_duration_days' => 7, 'depends_on_keys' => ['land_contract']],
        ['template_step_key' => 'soil_eval', 'phase_key' => 'land_due_diligence', 'step_type' => 'inspection', 'title' => 'Perform soil/percolation and geotechnical checks', 'description' => 'Validate foundation strategy and septic feasibility.', 'permit_required' => 0, 'expected_duration_days' => 7, 'depends_on_keys' => ['survey_topo']],
        ['template_step_key' => 'plans_engineering', 'phase_key' => 'design_preconstruction', 'step_type' => 'blueprints', 'title' => 'Finalize architectural and engineered plan set', 'description' => 'Stamped plans with site plan, structural schedule, and MEP intent.', 'permit_required' => 0, 'expected_duration_days' => 14, 'depends_on_keys' => ['soil_eval']],
        ['template_step_key' => 'permit_packet', 'phase_key' => 'dawson_county_permits', 'step_type' => 'permit', 'title' => 'Obtain municipal and state permits', 'description' => 'Submit complete package to local authority having jurisdiction.', 'permit_required' => 1, 'permit_name' => 'Residential Building Permit', 'expected_duration_days' => 14, 'depends_on_keys' => ['plans_engineering']],
        ['template_step_key' => 'driveway_approval', 'phase_key' => 'dawson_county_permits', 'step_type' => 'permit', 'title' => 'Obtain driveway/right-of-way approval', 'description' => 'Secure transportation access permits where required.', 'permit_required' => 1, 'permit_name' => 'Driveway / Encroachment Permit', 'expected_duration_days' => 7, 'depends_on_keys' => ['plans_engineering']],
        ['template_step_key' => 'utility_approvals', 'phase_key' => 'dawson_county_permits', 'step_type' => 'permit', 'title' => 'Obtain utility and septic/sewer approvals', 'description' => 'Finalize utility letters and environmental approvals before excavation.', 'permit_required' => 1, 'permit_name' => 'Utility/Septic Approval', 'expected_duration_days' => 10, 'depends_on_keys' => ['plans_engineering']],
        ['template_step_key' => 'erosion_plan', 'phase_key' => 'site_preparation', 'step_type' => 'permit', 'title' => 'Erosion controls in place.', 'description' => 'Install BMPs and get approval before grading and excavation.', 'permit_required' => 1, 'permit_name' => 'Erosion / Land Disturbance Approval', 'expected_duration_days' => 5, 'depends_on_keys' => ['permit_packet', 'utility_approvals']],
        ['template_step_key' => 'site_clear_grade', 'phase_key' => 'site_preparation', 'step_type' => 'construction', 'title' => 'Begin site work and excavation', 'description' => 'Prepare pad and verify finished floor elevations.', 'permit_required' => 0, 'expected_duration_days' => 7, 'depends_on_keys' => ['erosion_plan']],
        ['template_step_key' => 'footings', 'phase_key' => 'foundation', 'step_type' => 'construction', 'title' => 'Excavate and pour footings', 'description' => 'Footing trenching, reinforcement, and concrete placement.', 'permit_required' => 0, 'expected_duration_days' => 4, 'depends_on_keys' => ['site_clear_grade']],
        ['template_step_key' => 'footing_inspection', 'phase_key' => 'foundation', 'step_type' => 'inspection', 'title' => 'Pass footing inspection', 'description' => 'Required inspection before foundation walls/slab progression.', 'permit_required' => 1, 'permit_name' => 'Footing Inspection', 'expected_duration_days' => 2, 'depends_on_keys' => ['footings']],
        ['template_step_key' => 'foundation_pour', 'phase_key' => 'foundation', 'step_type' => 'construction', 'title' => 'Slab poured.', 'description' => 'Walls/slab, moisture barrier, and anchor details.', 'permit_required' => 0, 'expected_duration_days' => 7, 'depends_on_keys' => ['footing_inspection']],
        ['template_step_key' => 'foundation_inspection', 'phase_key' => 'foundation', 'step_type' => 'inspection', 'title' => 'Pass foundation inspection', 'description' => 'Approval required before framing starts.', 'permit_required' => 1, 'permit_name' => 'Foundation Inspection', 'expected_duration_days' => 2, 'depends_on_keys' => ['foundation_pour']],
        ['template_step_key' => 'framing_shell', 'phase_key' => 'framing_shell', 'step_type' => 'construction', 'title' => 'Frame walls, roof and ceilings, including all door and window rough openings', 'description' => 'Structural frame, roof deck, windows, weather barrier.', 'permit_required' => 0, 'expected_duration_days' => 14, 'depends_on_keys' => ['foundation_inspection']],
        ['template_step_key' => 'roofing_material_order', 'phase_key' => 'framing_shell', 'step_type' => 'purchase', 'title' => 'Order roofing materials after foundation completion', 'description' => 'Procure shingles/metal, underlayment, and flashing.', 'permit_required' => 0, 'expected_duration_days' => 2, 'depends_on_keys' => ['foundation_inspection']],
        ['template_step_key' => 'framing_inspection', 'phase_key' => 'framing_shell', 'step_type' => 'inspection', 'title' => 'Rough frame inspections (municipal inspections: mechanical, plumbing, electrical and frame) completed.', 'description' => 'Inspection gate before rough-in trades.', 'permit_required' => 1, 'permit_name' => 'Framing Inspection', 'expected_duration_days' => 2, 'depends_on_keys' => ['framing_shell']],
        ['template_step_key' => 'mep_rough', 'phase_key' => 'mep_rough_in', 'step_type' => 'construction', 'title' => 'Rough-in remaining electrical and plumbing lines in wall, ceiling and floor cavities', 'description' => 'Install all rough-ins to code and plan.', 'permit_required' => 0, 'expected_duration_days' => 14, 'depends_on_keys' => ['framing_inspection']],
        ['template_step_key' => 'mep_inspection', 'phase_key' => 'mep_rough_in', 'step_type' => 'inspection', 'title' => 'Pre-drywall Inspections', 'description' => 'Required before insulation and drywall.', 'permit_required' => 1, 'permit_name' => 'Rough MEP Inspection', 'expected_duration_days' => 3, 'depends_on_keys' => ['mep_rough']],
        ['template_step_key' => 'insulation_drywall', 'phase_key' => 'interior_finishes', 'step_type' => 'construction', 'title' => 'Drywall installed throughout the home.', 'description' => 'Thermal envelope and drywall finish sequence.', 'permit_required' => 0, 'expected_duration_days' => 10, 'depends_on_keys' => ['mep_inspection']],
        ['template_step_key' => 'interior_finishes', 'phase_key' => 'interior_finishes', 'step_type' => 'construction', 'title' => 'Finish plumbing and electrical work', 'description' => 'Cabinets, flooring, trim, paint, and final fixture installation.', 'permit_required' => 0, 'expected_duration_days' => 21, 'depends_on_keys' => ['insulation_drywall']],
        ['template_step_key' => 'exterior_site_finishes', 'phase_key' => 'move_in', 'step_type' => 'construction', 'title' => 'Exterior finishes will be started (brick, cementatious finish, stone or siding).', 'description' => 'Siding/paint/touch-up, driveway, drainage, and landscaping minimums.', 'permit_required' => 0, 'expected_duration_days' => 8, 'depends_on_keys' => ['roofing_material_order', 'interior_finishes']],
        ['template_step_key' => 'final_inspections', 'phase_key' => 'inspections_closeout', 'step_type' => 'inspection', 'title' => 'Final Inspection', 'description' => 'Clear punch items and obtain all trade finals.', 'permit_required' => 1, 'permit_name' => 'Final Inspections', 'expected_duration_days' => 4, 'depends_on_keys' => ['exterior_site_finishes']],
        ['template_step_key' => 'certificate_occupancy', 'phase_key' => 'inspections_closeout', 'step_type' => 'permit', 'title' => 'Receive certificate of occupancy', 'description' => 'Legal occupancy approval after final inspection.', 'permit_required' => 1, 'permit_name' => 'Certificate of Occupancy', 'expected_duration_days' => 2, 'depends_on_keys' => ['final_inspections']],
        ['template_step_key' => 'closeout_docs', 'phase_key' => 'move_in', 'step_type' => 'closeout', 'title' => 'Owner final walk-through', 'description' => 'Store permits, inspection records, manuals, and warranty data.', 'permit_required' => 0, 'expected_duration_days' => 3, 'depends_on_keys' => ['certificate_occupancy']],
    ];
}

function catn8_build_wizard_dawsonville_template_steps(): array
{
    $path = catn8_build_wizard_house_template_path();
    if (!is_file($path)) {
        return catn8_build_wizard_default_house_template_steps();
    }

    $raw = file_get_contents($path);
    if (!is_string($raw) || trim($raw) === '') {
        return catn8_build_wizard_default_house_template_steps();
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return catn8_build_wizard_default_house_template_steps();
    }
    $steps = $decoded['steps'] ?? null;
    if (!is_array($steps) || !$steps) {
        return catn8_build_wizard_default_house_template_steps();
    }

    $normalized = [];
    foreach ($steps as $step) {
        if (!is_array($step)) {
            continue;
        }
        $title = trim((string)($step['title'] ?? ''));
        if ($title === '') {
            continue;
        }
        $templateStepKey = trim((string)($step['template_step_key'] ?? ''));
        $dependsOnKeys = [];
        if (is_array($step['depends_on_keys'] ?? null)) {
            foreach ($step['depends_on_keys'] as $k) {
                $kk = trim((string)$k);
                if ($kk !== '') {
                    $dependsOnKeys[] = $kk;
                }
            }
        }
        $normalized[] = [
            'template_step_key' => $templateStepKey,
            'phase_key' => catn8_build_wizard_normalize_phase_key($step['phase_key'] ?? 'general'),
            'step_type' => catn8_build_wizard_step_type((string)($step['step_type'] ?? catn8_build_wizard_infer_step_type($title, (string)($step['phase_key'] ?? ''), !empty($step['permit_required']) ? 1 : 0))),
            'title' => $title,
            'description' => trim((string)($step['description'] ?? '')),
            'permit_required' => !empty($step['permit_required']) ? 1 : 0,
            'permit_name' => isset($step['permit_name']) ? catn8_build_wizard_text_or_null($step['permit_name'], 191) : null,
            'expected_start_date' => catn8_build_wizard_parse_date_or_null($step['expected_start_date'] ?? null),
            'expected_end_date' => catn8_build_wizard_parse_date_or_null($step['expected_end_date'] ?? null),
            'expected_duration_days' => isset($step['expected_duration_days']) && is_numeric($step['expected_duration_days']) ? max(1, min(3650, (int)$step['expected_duration_days'])) : null,
            'estimated_cost' => catn8_build_wizard_to_decimal_or_null($step['estimated_cost'] ?? null),
            'depends_on_keys' => array_values(array_unique($dependsOnKeys)),
            'source_ref' => catn8_build_wizard_text_or_null($step['source_ref'] ?? 'House template v3', 255),
        ];
    }

    return $normalized ?: catn8_build_wizard_default_house_template_steps();
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

function catn8_build_wizard_normalize_phase_tab($value): string
{
    $phaseTab = strtolower(trim((string)$value));
    return match ($phaseTab) {
        'land', 'permits', 'site', 'framing', 'mep', 'finishes' => $phaseTab,
        default => '',
    };
}

function catn8_build_wizard_default_phase_for_kind(string $kind): string
{
    return match (catn8_build_wizard_document_kind($kind)) {
        'survey' => 'land_due_diligence',
        'permit' => 'dawson_county_permits',
        'blueprint', 'spec_sheet' => 'design_preconstruction',
        'photo', 'site_photo', 'home_photo', 'progress_photo' => 'site_preparation',
        default => 'general',
    };
}

function catn8_build_wizard_pick_step_for_phase(int $projectId, string $phaseKey): ?int
{
    if ($projectId <= 0) {
        return null;
    }

    $normalized = catn8_build_wizard_normalize_phase_key($phaseKey);
    $params = [$projectId];
    $sql = 'SELECT id
            FROM build_wizard_steps
            WHERE project_id = ?';
    if ($normalized !== '' && $normalized !== 'general') {
        $sql .= ' AND phase_key = ?';
        $params[] = $normalized;
    }
    $sql .= ' ORDER BY is_completed ASC, step_order ASC, id ASC LIMIT 1';

    $row = Database::queryOne($sql, $params);
    if (!$row) {
        return null;
    }
    $stepId = (int)($row['id'] ?? 0);
    return $stepId > 0 ? $stepId : null;
}

function catn8_build_wizard_resequence_step_orders(int $projectId): void
{
    if ($projectId <= 0) {
        return;
    }

    $rows = Database::queryAll(
        'SELECT id, step_order
         FROM build_wizard_steps
         WHERE project_id = ?
         ORDER BY step_order ASC, id ASC',
        [$projectId]
    );

    foreach ($rows as $idx => $r) {
        $stepId = (int)($r['id'] ?? 0);
        if ($stepId <= 0) {
            continue;
        }
        $nextOrder = $idx + 1;
        $currentOrder = (int)($r['step_order'] ?? 0);
        if ($currentOrder !== $nextOrder) {
            Database::execute(
                'UPDATE build_wizard_steps SET step_order = ? WHERE id = ?',
                [$nextOrder, $stepId]
            );
        }
    }
}

function catn8_build_wizard_reorder_phase_steps(int $projectId, string $phaseKey, array $orderedStepIds): void
{
    if ($projectId <= 0) {
        throw new RuntimeException('Invalid project for reorder');
    }
    $normalizedPhase = catn8_build_wizard_normalize_phase_key($phaseKey);

    $allRows = Database::queryAll(
        'SELECT id, phase_key, step_order
         FROM build_wizard_steps
         WHERE project_id = ?
         ORDER BY step_order ASC, id ASC',
        [$projectId]
    );
    if (!$allRows) {
        return;
    }

    $phaseStepIds = [];
    foreach ($allRows as $row) {
        $stepId = (int)($row['id'] ?? 0);
        $rowPhase = catn8_build_wizard_normalize_phase_key((string)($row['phase_key'] ?? 'general'));
        if ($stepId > 0 && $rowPhase === $normalizedPhase) {
            $phaseStepIds[] = $stepId;
        }
    }
    sort($phaseStepIds);

    $requested = [];
    foreach ($orderedStepIds as $stepId) {
        $n = (int)$stepId;
        if ($n > 0) {
            $requested[] = $n;
        }
    }
    $requested = array_values(array_unique($requested));
    sort($requested);

    if ($phaseStepIds !== $requested) {
        throw new RuntimeException('ordered_step_ids must contain all and only steps in the selected phase');
    }

    $phaseQueue = array_values($orderedStepIds);
    $finalOrderedIds = [];
    foreach ($allRows as $row) {
        $rowPhase = catn8_build_wizard_normalize_phase_key((string)($row['phase_key'] ?? 'general'));
        if ($rowPhase === $normalizedPhase) {
            $nextId = (int)array_shift($phaseQueue);
            if ($nextId > 0) {
                $finalOrderedIds[] = $nextId;
            }
            continue;
        }
        $stepId = (int)($row['id'] ?? 0);
        if ($stepId > 0) {
            $finalOrderedIds[] = $stepId;
        }
    }

    if (!$finalOrderedIds) {
        return;
    }

    Database::execute(
        'UPDATE build_wizard_steps SET step_order = step_order + 10000 WHERE project_id = ?',
        [$projectId]
    );
    foreach ($finalOrderedIds as $index => $stepId) {
        Database::execute(
            'UPDATE build_wizard_steps SET step_order = ? WHERE id = ? AND project_id = ?',
            [$index + 1, (int)$stepId, $projectId]
        );
    }
}

function catn8_build_wizard_reorder_phase_steps_by_timeline(int $projectId, string $phaseKey): bool
{
    if ($projectId <= 0) {
        return false;
    }

    $normalizedPhase = catn8_build_wizard_normalize_phase_key($phaseKey);
    $rows = Database::queryAll(
        'SELECT id, phase_key, step_order, expected_start_date, expected_end_date
         FROM build_wizard_steps
         WHERE project_id = ?
         ORDER BY step_order ASC, id ASC',
        [$projectId]
    );
    if (!$rows) {
        return false;
    }

    $phaseRows = [];
    foreach ($rows as $row) {
        $rowPhase = catn8_build_wizard_normalize_phase_key((string)($row['phase_key'] ?? 'general'));
        if ($rowPhase === $normalizedPhase) {
            $phaseRows[] = $row;
        }
    }
    if (count($phaseRows) <= 1) {
        return false;
    }

    $currentOrderIds = array_map(static fn(array $row): int => (int)($row['id'] ?? 0), $phaseRows);
    $sortedRows = $phaseRows;
    usort($sortedRows, static function (array $a, array $b): int {
        $aAnchor = $a['expected_start_date'] !== null ? (string)$a['expected_start_date'] : ($a['expected_end_date'] !== null ? (string)$a['expected_end_date'] : null);
        $bAnchor = $b['expected_start_date'] !== null ? (string)$b['expected_start_date'] : ($b['expected_end_date'] !== null ? (string)$b['expected_end_date'] : null);
        if ($aAnchor === null && $bAnchor !== null) {
            return 1;
        }
        if ($aAnchor !== null && $bAnchor === null) {
            return -1;
        }
        if ($aAnchor !== null && $bAnchor !== null) {
            $anchorCmp = strcmp($aAnchor, $bAnchor);
            if ($anchorCmp !== 0) {
                return $anchorCmp;
            }
        }

        $aStart = $a['expected_start_date'] !== null ? (string)$a['expected_start_date'] : null;
        $bStart = $b['expected_start_date'] !== null ? (string)$b['expected_start_date'] : null;
        if ($aStart === null && $bStart !== null) {
            return 1;
        }
        if ($aStart !== null && $bStart === null) {
            return -1;
        }
        if ($aStart !== null && $bStart !== null) {
            $startCmp = strcmp($aStart, $bStart);
            if ($startCmp !== 0) {
                return $startCmp;
            }
        }

        $aEnd = $a['expected_end_date'] !== null ? (string)$a['expected_end_date'] : null;
        $bEnd = $b['expected_end_date'] !== null ? (string)$b['expected_end_date'] : null;
        if ($aEnd === null && $bEnd !== null) {
            return 1;
        }
        if ($aEnd !== null && $bEnd === null) {
            return -1;
        }
        if ($aEnd !== null && $bEnd !== null) {
            $endCmp = strcmp($aEnd, $bEnd);
            if ($endCmp !== 0) {
                return $endCmp;
            }
        }

        $orderCmp = ((int)($a['step_order'] ?? 0)) <=> ((int)($b['step_order'] ?? 0));
        if ($orderCmp !== 0) {
            return $orderCmp;
        }
        return ((int)($a['id'] ?? 0)) <=> ((int)($b['id'] ?? 0));
    });

    $sortedIds = array_map(static fn(array $row): int => (int)($row['id'] ?? 0), $sortedRows);
    if ($sortedIds === $currentOrderIds) {
        return false;
    }

    catn8_build_wizard_reorder_phase_steps($projectId, $normalizedPhase, $sortedIds);
    return true;
}

function catn8_build_wizard_validate_parent_step(int $projectId, int $stepId, $candidateParentStepId): ?int
{
    $parentStepId = (int)$candidateParentStepId;
    if ($parentStepId <= 0) {
        return null;
    }
    if ($parentStepId === $stepId) {
        throw new RuntimeException('A step cannot be its own parent');
    }

    $stepRow = Database::queryOne(
        'SELECT id, phase_key FROM build_wizard_steps WHERE id = ? AND project_id = ? LIMIT 1',
        [$stepId, $projectId]
    );
    if (!$stepRow) {
        throw new RuntimeException('Step not found');
    }

    $parentRow = Database::queryOne(
        'SELECT id, phase_key FROM build_wizard_steps WHERE id = ? AND project_id = ? LIMIT 1',
        [$parentStepId, $projectId]
    );
    if (!$parentRow) {
        throw new RuntimeException('Parent step not found for this project');
    }

    $stepPhase = catn8_build_wizard_normalize_phase_key((string)($stepRow['phase_key'] ?? 'general'));
    $parentPhase = catn8_build_wizard_normalize_phase_key((string)($parentRow['phase_key'] ?? 'general'));
    if ($stepPhase !== $parentPhase) {
        throw new RuntimeException('Parent step must be in the same phase');
    }

    $cursor = $parentStepId;
    $safety = 0;
    while ($cursor > 0 && $safety < 10000) {
        $safety++;
        if ($cursor === $stepId) {
            throw new RuntimeException('Parent assignment would create a cycle');
        }
        $cursorRow = Database::queryOne(
            'SELECT parent_step_id FROM build_wizard_steps WHERE id = ? AND project_id = ? LIMIT 1',
            [$cursor, $projectId]
        );
        if (!$cursorRow || $cursorRow['parent_step_id'] === null) {
            break;
        }
        $cursor = (int)$cursorRow['parent_step_id'];
    }

    return $parentStepId;
}

function catn8_build_wizard_validate_child_dates_with_parent(int $projectId, int $stepId, ?string $expectedStartDate, ?string $expectedEndDate): void
{
    $row = Database::queryOne(
        'SELECT s.parent_step_id, p.expected_start_date AS parent_start_date, p.expected_end_date AS parent_end_date
         FROM build_wizard_steps s
         LEFT JOIN build_wizard_steps p ON p.id = s.parent_step_id
         WHERE s.id = ? AND s.project_id = ?
         LIMIT 1',
        [$stepId, $projectId]
    );
    if (!$row) {
        throw new RuntimeException('Step not found for date validation');
    }
    $parentStepId = isset($row['parent_step_id']) ? (int)$row['parent_step_id'] : 0;
    if ($parentStepId <= 0) {
        return;
    }

    $parentStart = $row['parent_start_date'] !== null ? (string)$row['parent_start_date'] : null;
    $parentEnd = $row['parent_end_date'] !== null ? (string)$row['parent_end_date'] : null;

    if ($expectedStartDate !== null && $parentStart !== null && strcmp($expectedStartDate, $parentStart) < 0) {
        throw new RuntimeException('Child start date must be on or after parent start date');
    }
    if ($expectedStartDate !== null && $parentEnd !== null && strcmp($expectedStartDate, $parentEnd) > 0) {
        throw new RuntimeException('Child start date must be on or before parent end date');
    }
    if ($expectedEndDate !== null && $parentStart !== null && strcmp($expectedEndDate, $parentStart) < 0) {
        throw new RuntimeException('Child end date must be on or after parent start date');
    }
    if ($expectedEndDate !== null && $parentEnd !== null && strcmp($expectedEndDate, $parentEnd) > 0) {
        throw new RuntimeException('Child end date must be on or before parent end date');
    }
}

function catn8_build_wizard_has_incomplete_descendants(int $projectId, int $stepId): bool
{
    if ($projectId <= 0 || $stepId <= 0) {
        return false;
    }

    $rows = Database::queryAll(
        'SELECT id, parent_step_id, is_completed
         FROM build_wizard_steps
         WHERE project_id = ?',
        [$projectId]
    );
    if (!$rows) {
        return false;
    }

    $childrenByParent = [];
    $completionById = [];
    foreach ($rows as $row) {
        $id = (int)($row['id'] ?? 0);
        if ($id <= 0) {
            continue;
        }
        $completionById[$id] = ((int)($row['is_completed'] ?? 0) === 1);
        $parentId = isset($row['parent_step_id']) ? (int)$row['parent_step_id'] : 0;
        if ($parentId > 0) {
            if (!isset($childrenByParent[$parentId])) {
                $childrenByParent[$parentId] = [];
            }
            $childrenByParent[$parentId][] = $id;
        }
    }

    $queue = $childrenByParent[$stepId] ?? [];
    $visited = [];
    while ($queue) {
        $childId = (int)array_shift($queue);
        if ($childId <= 0 || isset($visited[$childId])) {
            continue;
        }
        $visited[$childId] = true;
        if (!($completionById[$childId] ?? false)) {
            return true;
        }
        foreach (($childrenByParent[$childId] ?? []) as $grandChildId) {
            $queue[] = (int)$grandChildId;
        }
    }
    return false;
}

function catn8_build_wizard_insert_steps(int $projectId, array $steps, bool $skipExistingTitles = false): int
{
    if ($projectId <= 0 || !$steps) {
        return 0;
    }

    $maxOrderRow = Database::queryOne('SELECT MAX(step_order) AS max_order FROM build_wizard_steps WHERE project_id = ?', [$projectId]);
    $stepOrder = (int)($maxOrderRow['max_order'] ?? 0);
    $inserted = 0;
    $insertedStepIdByTemplateKey = [];
    $pendingDependencyKeysByStepId = [];

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
                (project_id, step_order, phase_key, depends_on_step_ids_json, step_type, title, description, permit_required, permit_name, expected_start_date, expected_end_date, expected_duration_days, estimated_cost, actual_cost, ai_estimated_fields_json, is_completed, completed_at, ai_generated, source_ref)
             VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, NULL, 0, ?)',
            [
                $projectId,
                $stepOrder,
                $phaseKey = catn8_build_wizard_normalize_phase_key($s['phase_key'] ?? 'general'),
                catn8_build_wizard_step_type((string)($s['step_type'] ?? catn8_build_wizard_infer_step_type($title, $phaseKey, !empty($s['permit_required']) ? 1 : 0))),
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
        $insertedStepId = (int)Database::lastInsertId();
        if ($insertedStepId > 0) {
            $templateStepKey = trim((string)($s['template_step_key'] ?? ''));
            if ($templateStepKey !== '') {
                $insertedStepIdByTemplateKey[$templateStepKey] = $insertedStepId;
            }
            $dependsOnKeys = is_array($s['depends_on_keys'] ?? null) ? $s['depends_on_keys'] : [];
            if ($dependsOnKeys) {
                $pendingDependencyKeysByStepId[$insertedStepId] = $dependsOnKeys;
            }
        }
        $inserted++;
    }

    foreach ($pendingDependencyKeysByStepId as $insertedStepId => $dependsOnKeys) {
        $depIds = [];
        foreach ($dependsOnKeys as $depKey) {
            $cleanKey = trim((string)$depKey);
            if ($cleanKey === '' || !isset($insertedStepIdByTemplateKey[$cleanKey])) {
                continue;
            }
            $depId = (int)$insertedStepIdByTemplateKey[$cleanKey];
            if ($depId > 0 && $depId !== (int)$insertedStepId) {
                $depIds[] = $depId;
            }
        }
        $depIds = array_values(array_unique($depIds));
        if ($depIds) {
            Database::execute(
                'UPDATE build_wizard_steps SET depends_on_step_ids_json = ? WHERE id = ?',
                [json_encode($depIds, JSON_UNESCAPED_SLASHES), (int)$insertedStepId]
            );
        }
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
             SET title = ?, status = ?, square_feet = ?, home_style = ?, home_type = ?, room_count = ?, bedrooms_count = ?, kitchens_count = ?, bathroom_count = ?, stories_count = ?, lot_size_sqft = ?, garage_spaces = ?, parking_spaces = ?, year_built = ?, hoa_fee_monthly = ?, lot_address = ?, target_start_date = ?, target_completion_date = ?, wizard_notes = ?
             WHERE id = ?',
            [
                trim((string)($seedProject['title'] ?? 'Build Wizard Project')),
                trim((string)($seedProject['status'] ?? 'planning')),
                isset($seedProject['square_feet']) && is_numeric($seedProject['square_feet']) ? (int)$seedProject['square_feet'] : null,
                trim((string)($seedProject['home_style'] ?? '')),
                trim((string)($seedProject['home_type'] ?? '')),
                isset($seedProject['room_count']) && is_numeric($seedProject['room_count']) ? (int)$seedProject['room_count'] : null,
                isset($seedProject['bedrooms_count']) && is_numeric($seedProject['bedrooms_count']) ? (int)$seedProject['bedrooms_count'] : null,
                isset($seedProject['kitchens_count']) && is_numeric($seedProject['kitchens_count']) ? (int)$seedProject['kitchens_count'] : null,
                isset($seedProject['bathroom_count']) && is_numeric($seedProject['bathroom_count']) ? (int)$seedProject['bathroom_count'] : null,
                isset($seedProject['stories_count']) && is_numeric($seedProject['stories_count']) ? (int)$seedProject['stories_count'] : null,
                isset($seedProject['lot_size_sqft']) && is_numeric($seedProject['lot_size_sqft']) ? (int)$seedProject['lot_size_sqft'] : null,
                isset($seedProject['garage_spaces']) && is_numeric($seedProject['garage_spaces']) ? (int)$seedProject['garage_spaces'] : null,
                isset($seedProject['parking_spaces']) && is_numeric($seedProject['parking_spaces']) ? (int)$seedProject['parking_spaces'] : null,
                isset($seedProject['year_built']) && is_numeric($seedProject['year_built']) ? (int)$seedProject['year_built'] : null,
                catn8_build_wizard_to_decimal_or_null($seedProject['hoa_fee_monthly'] ?? null),
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
                p.blueprint_document_id, p.primary_photo_document_id,
                COUNT(s.id) AS step_count,
                SUM(CASE WHEN s.is_completed = 1 THEN 1 ELSE 0 END) AS completed_step_count
         FROM build_wizard_projects p
         LEFT JOIN build_wizard_steps s ON s.project_id = p.id
         WHERE p.owner_user_id = ?
         GROUP BY p.id, p.title, p.status, p.created_at, p.updated_at, p.blueprint_document_id, p.primary_photo_document_id
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
            'blueprint_document_id' => isset($r['blueprint_document_id']) && $r['blueprint_document_id'] !== null ? (int)$r['blueprint_document_id'] : null,
            'primary_photo_document_id' => isset($r['primary_photo_document_id']) && $r['primary_photo_document_id'] !== null ? (int)$r['primary_photo_document_id'] : null,
            'primary_blueprint_thumbnail_url' => isset($r['blueprint_document_id']) && (int)$r['blueprint_document_id'] > 0
                ? '/api/build_wizard.php?action=get_document&document_id=' . (int)$r['blueprint_document_id'] . '&thumb=1'
                : null,
            'primary_photo_thumbnail_url' => isset($r['primary_photo_document_id']) && (int)$r['primary_photo_document_id'] > 0
                ? '/api/build_wizard.php?action=get_document&document_id=' . (int)$r['primary_photo_document_id'] . '&thumb=1'
                : null,
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

function catn8_build_wizard_contacts_for_project(int $projectId, int $uid): array
{
    if ($projectId <= 0 || $uid <= 0) {
        return [];
    }

    $rows = Database::queryAll(
        'SELECT id, owner_user_id, project_id, display_name, contact_type, email, phone, company, role_title, notes, is_vendor, vendor_type, vendor_license, vendor_trade, vendor_website, created_at, updated_at
         FROM build_wizard_contacts
         WHERE owner_user_id = ?
           AND (project_id IS NULL OR project_id = ?)
         ORDER BY display_name ASC, id ASC',
        [$uid, $projectId]
    );

    $contacts = [];
    foreach ($rows as $row) {
        $contacts[] = [
            'id' => (int)($row['id'] ?? 0),
            'owner_user_id' => (int)($row['owner_user_id'] ?? 0),
            'project_id' => $row['project_id'] !== null ? (int)$row['project_id'] : null,
            'display_name' => (string)($row['display_name'] ?? ''),
            'contact_type' => catn8_build_wizard_normalize_contact_type($row['contact_type'] ?? null, (int)($row['is_vendor'] ?? 0)),
            'email' => $row['email'] !== null ? (string)$row['email'] : null,
            'phone' => $row['phone'] !== null ? (string)$row['phone'] : null,
            'company' => $row['company'] !== null ? (string)$row['company'] : null,
            'role_title' => $row['role_title'] !== null ? (string)$row['role_title'] : null,
            'notes' => $row['notes'] !== null ? (string)$row['notes'] : null,
            'is_vendor' => (int)($row['is_vendor'] ?? 0),
            'vendor_type' => $row['vendor_type'] !== null ? (string)$row['vendor_type'] : null,
            'vendor_license' => $row['vendor_license'] !== null ? (string)$row['vendor_license'] : null,
            'vendor_trade' => $row['vendor_trade'] !== null ? (string)$row['vendor_trade'] : null,
            'vendor_website' => $row['vendor_website'] !== null ? (string)$row['vendor_website'] : null,
            'created_at' => (string)($row['created_at'] ?? ''),
            'updated_at' => (string)($row['updated_at'] ?? ''),
        ];
    }
    return $contacts;
}

function catn8_build_wizard_contact_assignments_for_project(int $projectId, int $uid): array
{
    if ($projectId <= 0 || $uid <= 0) {
        return [];
    }

    $rows = Database::queryAll(
        'SELECT a.id, a.project_id, a.contact_id, a.step_id, a.phase_key, a.created_at
         FROM build_wizard_contact_assignments a
         INNER JOIN build_wizard_contacts c ON c.id = a.contact_id
         WHERE a.project_id = ?
           AND c.owner_user_id = ?
         ORDER BY a.id ASC',
        [$projectId, $uid]
    );

    $assignments = [];
    foreach ($rows as $row) {
        $assignments[] = [
            'id' => (int)($row['id'] ?? 0),
            'project_id' => (int)($row['project_id'] ?? 0),
            'contact_id' => (int)($row['contact_id'] ?? 0),
            'step_id' => $row['step_id'] !== null ? (int)$row['step_id'] : null,
            'phase_key' => $row['phase_key'] !== null ? (string)$row['phase_key'] : null,
            'created_at' => (string)($row['created_at'] ?? ''),
        ];
    }
    return $assignments;
}

function catn8_build_wizard_phase_date_ranges_for_project(int $projectId): array
{
    if ($projectId <= 0) {
        return [];
    }

    $rows = Database::queryAll(
        'SELECT id, project_id, phase_tab, start_date, end_date, created_at, updated_at
         FROM build_wizard_phase_date_ranges
         WHERE project_id = ?
         ORDER BY phase_tab ASC, id ASC',
        [$projectId]
    );

    $ranges = [];
    foreach ($rows as $row) {
        $phaseTab = catn8_build_wizard_normalize_phase_tab($row['phase_tab'] ?? '');
        if ($phaseTab === '') {
            continue;
        }
        $ranges[] = [
            'id' => (int)($row['id'] ?? 0),
            'project_id' => (int)($row['project_id'] ?? 0),
            'phase_tab' => $phaseTab,
            'start_date' => $row['start_date'] !== null ? (string)$row['start_date'] : null,
            'end_date' => $row['end_date'] !== null ? (string)$row['end_date'] : null,
            'created_at' => (string)($row['created_at'] ?? ''),
            'updated_at' => (string)($row['updated_at'] ?? ''),
        ];
    }
    return $ranges;
}

function catn8_build_wizard_contact_for_project(int $contactId, int $projectId, int $uid): ?array
{
    if ($contactId <= 0 || $projectId <= 0 || $uid <= 0) {
        return null;
    }
    $row = Database::queryOne(
        'SELECT id, owner_user_id, project_id, display_name, contact_type, email, phone, company, role_title, notes, is_vendor, vendor_type, vendor_license, vendor_trade, vendor_website, created_at, updated_at
         FROM build_wizard_contacts
         WHERE id = ?
           AND owner_user_id = ?
           AND (project_id IS NULL OR project_id = ?)
         LIMIT 1',
        [$contactId, $uid, $projectId]
    );
    if (!$row) {
        return null;
    }
    return [
        'id' => (int)($row['id'] ?? 0),
        'owner_user_id' => (int)($row['owner_user_id'] ?? 0),
        'project_id' => $row['project_id'] !== null ? (int)$row['project_id'] : null,
        'display_name' => (string)($row['display_name'] ?? ''),
        'contact_type' => catn8_build_wizard_normalize_contact_type($row['contact_type'] ?? null, (int)($row['is_vendor'] ?? 0)),
        'email' => $row['email'] !== null ? (string)$row['email'] : null,
        'phone' => $row['phone'] !== null ? (string)$row['phone'] : null,
        'company' => $row['company'] !== null ? (string)$row['company'] : null,
        'role_title' => $row['role_title'] !== null ? (string)$row['role_title'] : null,
        'notes' => $row['notes'] !== null ? (string)$row['notes'] : null,
        'is_vendor' => (int)($row['is_vendor'] ?? 0),
        'vendor_type' => $row['vendor_type'] !== null ? (string)$row['vendor_type'] : null,
        'vendor_license' => $row['vendor_license'] !== null ? (string)$row['vendor_license'] : null,
        'vendor_trade' => $row['vendor_trade'] !== null ? (string)$row['vendor_trade'] : null,
        'vendor_website' => $row['vendor_website'] !== null ? (string)$row['vendor_website'] : null,
        'created_at' => (string)($row['created_at'] ?? ''),
        'updated_at' => (string)($row['updated_at'] ?? ''),
    ];
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

function catn8_build_wizard_step_audit_logs_by_step_ids(array $stepIds, int $limitPerStep = 150): array
{
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
        'SELECT id, project_id, step_id, actor_user_id, action_key, changes_json, created_at
         FROM build_wizard_step_audit_logs
         WHERE step_id IN (' . $placeholders . ')
         ORDER BY created_at DESC, id DESC',
        $cleanIds
    );

    $map = [];
    foreach ($rows as $r) {
        $sid = (int)($r['step_id'] ?? 0);
        if (!isset($map[$sid])) {
            $map[$sid] = [];
        }
        if (count($map[$sid]) >= $limitPerStep) {
            continue;
        }
        $decoded = catn8_build_wizard_decode_json_array($r['changes_json'] ?? null);
        $map[$sid][] = [
            'id' => (int)($r['id'] ?? 0),
            'project_id' => (int)($r['project_id'] ?? 0),
            'step_id' => $sid,
            'actor_user_id' => $r['actor_user_id'] !== null ? (int)$r['actor_user_id'] : null,
            'action_key' => trim((string)($r['action_key'] ?? '')) ?: 'updated',
            'changes' => $decoded !== [] ? $decoded : null,
            'created_at' => (string)($r['created_at'] ?? ''),
        ];
    }
    return $map;
}

function catn8_build_wizard_step_change_payload(?array $beforeStep, ?array $afterStep): array
{
    if (!$beforeStep || !$afterStep) {
        return [];
    }

    $trackFields = [
        'phase_key',
        'parent_step_id',
        'depends_on_step_ids',
        'step_type',
        'title',
        'description',
        'permit_required',
        'permit_document_id',
        'permit_name',
        'permit_authority',
        'permit_status',
        'permit_application_url',
        'purchase_category',
        'purchase_brand',
        'purchase_model',
        'purchase_sku',
        'purchase_unit',
        'purchase_qty',
        'purchase_unit_price',
        'purchase_vendor',
        'purchase_url',
        'expected_start_date',
        'expected_end_date',
        'expected_duration_days',
        'estimated_cost',
        'actual_cost',
        'ai_estimated_fields',
        'is_completed',
        'completed_at',
        'source_ref',
        'step_order',
    ];

    $changes = [];
    foreach ($trackFields as $field) {
        $beforeValue = $beforeStep[$field] ?? null;
        $afterValue = $afterStep[$field] ?? null;
        if ($beforeValue === $afterValue) {
            continue;
        }

        if (is_array($beforeValue) || is_array($afterValue)) {
            $beforeJson = json_encode($beforeValue, JSON_UNESCAPED_SLASHES);
            $afterJson = json_encode($afterValue, JSON_UNESCAPED_SLASHES);
            if ($beforeJson === $afterJson) {
                continue;
            }
        }

        $changes[$field] = [
            'before' => $beforeValue,
            'after' => $afterValue,
        ];
    }

    return $changes;
}

function catn8_build_wizard_insert_step_audit_log(int $projectId, int $stepId, string $actionKey, ?int $actorUserId, ?array $changes = null): void
{
    if ($projectId <= 0 || $stepId <= 0) {
        return;
    }

    $normalizedAction = strtolower(trim($actionKey));
    if ($normalizedAction === '') {
        $normalizedAction = 'updated';
    }

    Database::execute(
        'INSERT INTO build_wizard_step_audit_logs (project_id, step_id, actor_user_id, action_key, changes_json)
         VALUES (?, ?, ?, ?, ?)',
        [
            $projectId,
            $stepId,
            ($actorUserId !== null && $actorUserId > 0) ? $actorUserId : null,
            $normalizedAction,
            ($changes && count($changes) > 0) ? json_encode($changes, JSON_UNESCAPED_SLASHES) : null,
        ]
    );
}

function catn8_build_wizard_steps_for_project(int $projectId): array
{
    $rows = Database::queryAll(
        'SELECT id, project_id, step_order, phase_key, parent_step_id, depends_on_step_ids_json, step_type, title, description, permit_required, permit_document_id, permit_name, permit_authority, permit_status, permit_application_url,
                purchase_category, purchase_brand, purchase_model, purchase_sku, purchase_unit, purchase_qty, purchase_unit_price, purchase_vendor, purchase_url,
                expected_start_date, expected_end_date, expected_duration_days, estimated_cost, actual_cost, ai_estimated_fields_json, is_completed, completed_at, ai_generated, source_ref,
                created_at, updated_at
         FROM build_wizard_steps
         WHERE project_id = ?
         ORDER BY step_order ASC, id ASC',
        [$projectId]
    );

    $stepIds = array_map(static fn($r) => (int)($r['id'] ?? 0), $rows);
    $notesByStep = catn8_build_wizard_step_notes_by_step_ids($stepIds);
    $auditLogsByStep = catn8_build_wizard_step_audit_logs_by_step_ids($stepIds);

    $steps = [];
    foreach ($rows as $r) {
        $sid = (int)($r['id'] ?? 0);
        $steps[] = [
            'id' => $sid,
            'project_id' => (int)($r['project_id'] ?? 0),
            'step_order' => (int)($r['step_order'] ?? 0),
            'phase_key' => (string)($r['phase_key'] ?? ''),
            'parent_step_id' => $r['parent_step_id'] !== null ? (int)$r['parent_step_id'] : null,
            'depends_on_step_ids' => catn8_build_wizard_normalize_int_array(catn8_build_wizard_decode_json_array($r['depends_on_step_ids_json'] ?? null)),
            'step_type' => catn8_build_wizard_step_type((string)($r['step_type'] ?? '')),
            'title' => (string)($r['title'] ?? ''),
            'description' => (string)($r['description'] ?? ''),
            'permit_required' => (int)($r['permit_required'] ?? 0),
            'permit_document_id' => $r['permit_document_id'] !== null ? (int)$r['permit_document_id'] : null,
            'permit_name' => $r['permit_name'] !== null ? (string)$r['permit_name'] : null,
            'permit_authority' => $r['permit_authority'] !== null ? (string)$r['permit_authority'] : null,
            'permit_status' => $r['permit_status'] !== null ? (string)$r['permit_status'] : null,
            'permit_application_url' => $r['permit_application_url'] !== null ? (string)$r['permit_application_url'] : null,
            'purchase_category' => $r['purchase_category'] !== null ? (string)$r['purchase_category'] : null,
            'purchase_brand' => $r['purchase_brand'] !== null ? (string)$r['purchase_brand'] : null,
            'purchase_model' => $r['purchase_model'] !== null ? (string)$r['purchase_model'] : null,
            'purchase_sku' => $r['purchase_sku'] !== null ? (string)$r['purchase_sku'] : null,
            'purchase_unit' => $r['purchase_unit'] !== null ? (string)$r['purchase_unit'] : null,
            'purchase_qty' => $r['purchase_qty'] !== null ? (float)$r['purchase_qty'] : null,
            'purchase_unit_price' => $r['purchase_unit_price'] !== null ? (float)$r['purchase_unit_price'] : null,
            'purchase_vendor' => $r['purchase_vendor'] !== null ? (string)$r['purchase_vendor'] : null,
            'purchase_url' => $r['purchase_url'] !== null ? (string)$r['purchase_url'] : null,
            'expected_start_date' => $r['expected_start_date'] !== null ? (string)$r['expected_start_date'] : null,
            'expected_end_date' => $r['expected_end_date'] !== null ? (string)$r['expected_end_date'] : null,
            'expected_duration_days' => $r['expected_duration_days'] !== null ? (int)$r['expected_duration_days'] : null,
            'estimated_cost' => $r['estimated_cost'] !== null ? (float)$r['estimated_cost'] : null,
            'actual_cost' => $r['actual_cost'] !== null ? (float)$r['actual_cost'] : null,
            'ai_estimated_fields' => catn8_build_wizard_normalize_ai_estimated_fields(catn8_build_wizard_decode_json_array($r['ai_estimated_fields_json'] ?? null)),
            'is_completed' => (int)($r['is_completed'] ?? 0),
            'completed_at' => $r['completed_at'] !== null ? (string)$r['completed_at'] : null,
            'ai_generated' => (int)($r['ai_generated'] ?? 0),
            'source_ref' => $r['source_ref'] !== null ? (string)$r['source_ref'] : null,
            'created_at' => $r['created_at'] !== null ? (string)$r['created_at'] : null,
            'updated_at' => $r['updated_at'] !== null ? (string)$r['updated_at'] : null,
            'notes' => $notesByStep[$sid] ?? [],
            'audit_logs' => $auditLogsByStep[$sid] ?? [],
        ];
    }

    return $steps;
}

function catn8_build_wizard_documents_for_project(int $projectId): array
{
    $rows = Database::queryAll(
        'SELECT d.id, d.project_id, d.step_id, s.phase_key AS step_phase_key, s.title AS step_title,
                d.kind, d.original_name, d.mime_type, d.storage_path, d.file_size_bytes, d.caption, d.uploaded_at,
                CASE WHEN bi.document_id IS NULL THEN 0 ELSE 1 END AS has_image_blob
         FROM build_wizard_documents d
         LEFT JOIN build_wizard_steps s ON s.id = d.step_id
         LEFT JOIN build_wizard_document_images bi ON bi.document_id = d.id
         WHERE d.project_id = ?
         ORDER BY d.uploaded_at DESC, d.id DESC',
        [$projectId]
    );

    $docs = [];
    foreach ($rows as $r) {
        $docId = (int)($r['id'] ?? 0);
        $mimeType = (string)($r['mime_type'] ?? '');
        $docs[] = [
            'id' => $docId,
            'project_id' => (int)($r['project_id'] ?? 0),
            'step_id' => $r['step_id'] !== null ? (int)$r['step_id'] : null,
            'step_phase_key' => $r['step_phase_key'] !== null ? (string)$r['step_phase_key'] : null,
            'step_title' => $r['step_title'] !== null ? (string)$r['step_title'] : null,
            'kind' => (string)($r['kind'] ?? ''),
            'original_name' => (string)($r['original_name'] ?? ''),
            'mime_type' => $mimeType,
            'storage_path' => (string)($r['storage_path'] ?? ''),
            'file_size_bytes' => (int)($r['file_size_bytes'] ?? 0),
            'caption' => $r['caption'] !== null ? (string)$r['caption'] : null,
            'uploaded_at' => (string)($r['uploaded_at'] ?? ''),
            'public_url' => '/api/build_wizard.php?action=get_document&document_id=' . $docId,
            'thumbnail_url' => '/api/build_wizard.php?action=get_document&document_id=' . $docId . '&thumb=1',
            'is_image' => ((int)($r['has_image_blob'] ?? 0) === 1 || strpos(strtolower($mimeType), 'image/') === 0) ? 1 : 0,
        ];
    }
    return $docs;
}

function catn8_build_wizard_document_for_user(int $documentId, int $uid): ?array
{
    if ($documentId <= 0) {
        return null;
    }

    return Database::queryOne(
        'SELECT d.id, d.project_id, d.kind, d.original_name, d.mime_type, d.storage_path, d.file_size_bytes,
                db.file_blob, db.mime_type AS file_blob_mime_type,
                bi.image_blob, bi.mime_type AS blob_mime_type
         FROM build_wizard_documents d
         INNER JOIN build_wizard_projects p ON p.id = d.project_id
         LEFT JOIN build_wizard_document_blobs db ON db.document_id = d.id
         LEFT JOIN build_wizard_document_images bi ON bi.document_id = d.id
         WHERE d.id = ? AND p.owner_user_id = ?
         LIMIT 1',
        [$documentId, $uid]
    );
}

function catn8_build_wizard_resolve_document_path(string $storagePath): string
{
    $rawPath = trim($storagePath);
    if ($rawPath === '') {
        return '';
    }

    if (is_file($rawPath)) {
        return $rawPath;
    }

    $normalized = str_replace('\\', '/', $rawPath);
    $projectRoot = dirname(__DIR__);
    $uploadRoot = $projectRoot . '/images/build-wizard';
    $importStageRoot = $projectRoot . '/.local/state/build_wizard_import/stage_docs';

    if ($normalized !== '' && $normalized[0] !== '/') {
        $candidate = $projectRoot . '/' . ltrim($normalized, '/');
        if (is_file($candidate)) {
            return $candidate;
        }
    }

    $uploadsMarker = '/images/build-wizard/';
    $markerPos = strpos($normalized, $uploadsMarker);
    if ($markerPos !== false) {
        $relativeFromUploads = substr($normalized, $markerPos + 1); // remove leading slash
        if (is_string($relativeFromUploads) && $relativeFromUploads !== '') {
            $candidate = $projectRoot . '/' . $relativeFromUploads;
            if (is_file($candidate)) {
                return $candidate;
            }
        }
    }

    $importStageMarker = '/.local/state/build_wizard_import/stage_docs/';
    $stagePos = strpos($normalized, $importStageMarker);
    if ($stagePos !== false) {
        $relativeFromStage = substr($normalized, $stagePos + 1); // remove leading slash
        if (is_string($relativeFromStage) && $relativeFromStage !== '') {
            $candidate = $projectRoot . '/' . $relativeFromStage;
            if (is_file($candidate)) {
                return $candidate;
            }
        }
    }

    $baseName = basename($normalized);
    if ($baseName !== '' && $baseName !== '.' && $baseName !== '..') {
        foreach ([$uploadRoot, $importStageRoot] as $root) {
            $candidate = $root . '/' . $baseName;
            if (is_file($candidate)) {
                return $candidate;
            }
        }
    }

    return '';
}

function catn8_build_wizard_is_pdf_document(array $doc): bool
{
    $mime = strtolower(trim((string)($doc['mime_type'] ?? '')));
    if ($mime === 'application/pdf') {
        return true;
    }
    $name = strtolower(trim((string)($doc['original_name'] ?? '')));
    return str_ends_with($name, '.pdf');
}

function catn8_build_wizard_document_thumb_label(array $doc): string
{
    $name = trim((string)($doc['original_name'] ?? ''));
    if ($name !== '' && str_contains($name, '.')) {
        $parts = explode('.', $name);
        $ext = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)end($parts)) ?? '');
        if ($ext !== '') {
            return substr($ext, 0, 5);
        }
    }

    $mime = strtolower(trim((string)($doc['mime_type'] ?? '')));
    if (str_contains($mime, 'pdf')) {
        return 'PDF';
    }
    if (str_contains($mime, 'sheet') || str_contains($mime, 'excel') || str_contains($mime, 'csv')) {
        return 'SHEET';
    }
    if (str_contains($mime, 'word') || str_contains($mime, 'text')) {
        return 'DOC';
    }
    return 'FILE';
}

function catn8_build_wizard_send_thumb_placeholder(string $label): void
{
    $clean = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $label) ?? 'FILE', 0, 5));
    if ($clean === '') {
        $clean = 'FILE';
    }
    $svg = '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">'
        . '<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#ecf4ff"/><stop offset="100%" stop-color="#dce9fa"/></linearGradient></defs>'
        . '<rect width="480" height="360" rx="16" fill="url(#g)"/>'
        . '<rect x="160" y="72" width="160" height="208" rx="12" fill="#f8fbff" stroke="#7f9dc6" stroke-width="6"/>'
        . '<path d="M272 72v44h48" fill="none" stroke="#7f9dc6" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
        . '<text x="240" y="318" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" font-weight="700" fill="#1e467c">' . htmlspecialchars($clean, ENT_QUOTES, 'UTF-8') . '</text>'
        . '</svg>';
    header('Content-Type: image/svg+xml; charset=UTF-8');
    header('Cache-Control: private, max-age=600');
    echo $svg;
}

function catn8_build_wizard_pdf_thumb_cache_path(int $documentId, int $fileSizeBytes): string
{
    $root = dirname(__DIR__) . '/.local/state/build_wizard/pdf_thumbs';
    if (!is_dir($root) && !mkdir($root, 0755, true) && !is_dir($root)) {
        return '';
    }
    $docPart = max(1, $documentId);
    $sizePart = max(0, $fileSizeBytes);
    return $root . '/doc_' . $docPart . '_' . $sizePart . '.png';
}

function catn8_build_wizard_clear_pdf_thumb_cache(int $documentId): void
{
    if ($documentId <= 0) {
        return;
    }
    $root = dirname(__DIR__) . '/.local/state/build_wizard/pdf_thumbs';
    if (!is_dir($root)) {
        return;
    }
    $pattern = $root . '/doc_' . $documentId . '_*.png';
    $matches = glob($pattern);
    if (!is_array($matches)) {
        return;
    }
    foreach ($matches as $path) {
        if (is_string($path) && is_file($path)) {
            unlink($path);
        }
    }
}

function catn8_build_wizard_find_ghostscript_binary(): ?string
{
    if (function_exists('shell_exec')) {
        $rawPath = shell_exec('command -v gs 2>/dev/null');
        $resolved = trim((string)$rawPath);
        if ($resolved !== '' && is_executable($resolved)) {
            return $resolved;
        }
    }

    $candidates = [
        '/bin/gs',
        '/usr/bin/gs',
        '/usr/local/bin/gs',
        '/opt/homebrew/bin/gs',
    ];
    foreach ($candidates as $path) {
        if (is_executable($path)) {
            return $path;
        }
    }

    return null;
}

function catn8_build_wizard_generate_pdf_thumb_with_ghostscript(string $pdfPath): ?string
{
    if ($pdfPath === '' || !is_file($pdfPath)) {
        return null;
    }

    $ghostscript = catn8_build_wizard_find_ghostscript_binary();
    if ($ghostscript === null) {
        return null;
    }

    $outputPath = tempnam(sys_get_temp_dir(), 'bw_pdf_png_');
    if (!is_string($outputPath) || $outputPath === '') {
        return null;
    }

    $cmd = escapeshellarg($ghostscript)
        . ' -dSAFER -dBATCH -dNOPAUSE'
        . ' -sDEVICE=png16m'
        . ' -dFirstPage=1 -dLastPage=1'
        . ' -r120'
        . ' -dTextAlphaBits=4 -dGraphicsAlphaBits=4'
        . ' -g480x360 -dPDFFitPage'
        . ' -sOutputFile=' . escapeshellarg($outputPath)
        . ' ' . escapeshellarg($pdfPath)
        . ' 2>&1';

    $shellOutput = function_exists('shell_exec') ? shell_exec($cmd) : null;
    if (!is_file($outputPath) || filesize($outputPath) <= 0) {
        if (is_string($shellOutput) && trim($shellOutput) !== '') {
            error_log('Build Wizard PDF Ghostscript thumbnail generation failed: ' . trim($shellOutput));
        }
        if (is_file($outputPath)) {
            unlink($outputPath);
        }
        return null;
    }

    $bytes = file_get_contents($outputPath);
    unlink($outputPath);
    return (is_string($bytes) && $bytes !== '') ? $bytes : null;
}

function catn8_build_wizard_generate_pdf_thumb_from_path(string $pdfPath): ?string
{
    if ($pdfPath === '' || !is_file($pdfPath)) {
        return null;
    }

    if (class_exists('Imagick')) {
        try {
            $im = new Imagick();
            $im->setResolution(144, 144);
            $im->readImage($pdfPath . '[0]');
            $im->setImageFormat('png');
            $im->setImageBackgroundColor('white');
            $im->thumbnailImage(480, 360, true, true);
            if (method_exists($im, 'stripImage')) {
                $im->stripImage();
            }
            $bytes = $im->getImageBlob();
            $im->clear();
            $im->destroy();
            if (is_string($bytes) && $bytes !== '') {
                return $bytes;
            }
        } catch (Throwable $e) {
            error_log('Build Wizard PDF Imagick thumbnail generation failed: ' . $e->getMessage());
        }
    }

    return catn8_build_wizard_generate_pdf_thumb_with_ghostscript($pdfPath);
}

function catn8_build_wizard_generate_pdf_thumb_from_blob(string $pdfBytes): ?string
{
    if ($pdfBytes === '') {
        return null;
    }
    $tmp = tempnam(sys_get_temp_dir(), 'bw_pdf_');
    if (!is_string($tmp) || $tmp === '') {
        return null;
    }

    $written = file_put_contents($tmp, $pdfBytes);
    if ($written === false || $written <= 0) {
        if (is_file($tmp)) {
            unlink($tmp);
        }
        return null;
    }

    $thumb = catn8_build_wizard_generate_pdf_thumb_from_path($tmp);
    if (is_file($tmp)) {
        unlink($tmp);
    }
    return $thumb;
}

function catn8_build_wizard_pdf_thumbnail_diagnostics(): array
{
    $imagickLoaded = class_exists('Imagick');
    $imagickVersion = null;
    $pdfFormatAvailable = false;
    $pdfaFormatAvailable = false;
    $delegateContainsGhostscript = false;
    $delegatesSummary = null;
    $shellExecAvailable = function_exists('shell_exec');
    $ghostscriptBinaryPath = catn8_build_wizard_find_ghostscript_binary();
    $ghostscriptRenderSupported = $ghostscriptBinaryPath !== null;

    if ($imagickLoaded) {
        try {
            $ver = Imagick::getVersion();
            if (is_array($ver)) {
                $imagickVersion = isset($ver['versionString']) ? (string)$ver['versionString'] : null;
            } else {
                $imagickVersion = is_string($ver) ? $ver : null;
            }
        } catch (Throwable $e) {
            error_log('Build Wizard diagnostics: failed to read Imagick version: ' . $e->getMessage());
        }

        try {
            $pdfFormats = Imagick::queryFormats('PDF');
            $pdfFormatAvailable = is_array($pdfFormats) && count($pdfFormats) > 0;
        } catch (Throwable $e) {
            error_log('Build Wizard diagnostics: failed to query Imagick PDF formats: ' . $e->getMessage());
        }

        try {
            $pdfaFormats = Imagick::queryFormats('PDFA');
            $pdfaFormatAvailable = is_array($pdfaFormats) && count($pdfaFormats) > 0;
        } catch (Throwable $e) {
            error_log('Build Wizard diagnostics: failed to query Imagick PDFA formats: ' . $e->getMessage());
        }

        try {
            $delegateOptions = Imagick::getConfigureOptions('delegates');
            $delegates = trim((string)($delegateOptions['DELEGATES'] ?? ''));
            if ($delegates !== '') {
                $delegatesSummary = $delegates;
                $delegateContainsGhostscript = str_contains(strtolower($delegates), 'ghostscript')
                    || str_contains(strtolower($delegates), 'gs');
            }
        } catch (Throwable $e) {
            error_log('Build Wizard diagnostics: failed to read Imagick delegates: ' . $e->getMessage());
        }
    }

    $imagickPdfSupported = $imagickLoaded
        && ($pdfFormatAvailable || $pdfaFormatAvailable)
        && ($delegateContainsGhostscript || $ghostscriptBinaryPath !== null);
    $supported = $imagickPdfSupported || $ghostscriptRenderSupported;

    return [
        'imagick_loaded' => $imagickLoaded,
        'imagick_version' => $imagickVersion,
        'imagick_pdf_format_available' => $pdfFormatAvailable,
        'imagick_pdfa_format_available' => $pdfaFormatAvailable,
        'imagick_delegate_contains_ghostscript' => $delegateContainsGhostscript,
        'imagick_delegates_summary' => $delegatesSummary,
        'shell_exec_available' => $shellExecAvailable,
        'ghostscript_binary_path' => $ghostscriptBinaryPath,
        'ghostscript_render_supported' => $ghostscriptRenderSupported,
        'pdf_thumbnail_supported' => $supported,
        'checked_at_utc' => gmdate('c'),
    ];
}

function catn8_build_wizard_backfill_document_blobs(bool $apply, ?int $projectId = null, int $limit = 0): array
{
    $effectiveProjectId = ($projectId !== null && $projectId > 0) ? $projectId : null;
    $effectiveLimit = max(0, min(5000, $limit));

    $sql = 'SELECT d.id, d.project_id, d.original_name, d.mime_type, d.storage_path, d.file_size_bytes,
                   b.document_id AS has_blob,
                   bi.image_blob, bi.mime_type AS image_blob_mime_type
            FROM build_wizard_documents d
            LEFT JOIN build_wizard_document_blobs b ON b.document_id = d.id
            LEFT JOIN build_wizard_document_images bi ON bi.document_id = d.id';
    $params = [];
    if ($effectiveProjectId !== null) {
        $sql .= ' WHERE d.project_id = ?';
        $params[] = $effectiveProjectId;
    }
    $sql .= ' ORDER BY d.id ASC';
    if ($effectiveLimit > 0) {
        $sql .= ' LIMIT ' . $effectiveLimit;
    }

    $rows = Database::queryAll($sql, $params);

    $total = count($rows);
    $alreadyBlob = 0;
    $fromImageBlob = 0;
    $fromFilePath = 0;
    $missing = 0;
    $written = 0;
    $missingDocs = [];

    foreach ($rows as $row) {
        $docId = (int)($row['id'] ?? 0);
        if ($docId <= 0) {
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
            $resolvedPath = catn8_build_wizard_resolve_document_path((string)($row['storage_path'] ?? ''));
            if ($resolvedPath !== '') {
                $fileBytes = @file_get_contents($resolvedPath);
                if (is_string($fileBytes) && $fileBytes !== '') {
                    $bytes = $fileBytes;
                    $source = 'file_path';
                }
            }
        }

        if (!is_string($bytes) || $bytes === '') {
            $missing++;
            if (count($missingDocs) < 25) {
                $missingDocs[] = [
                    'document_id' => $docId,
                    'project_id' => (int)($row['project_id'] ?? 0),
                    'original_name' => (string)($row['original_name'] ?? ''),
                    'storage_path' => (string)($row['storage_path'] ?? ''),
                ];
            }
            continue;
        }

        if ($source === 'image_blob') {
            $fromImageBlob++;
        } else {
            $fromFilePath++;
        }

        if (!$apply) {
            continue;
        }

        Database::execute(
            'INSERT INTO build_wizard_document_blobs (document_id, mime_type, file_blob, file_size_bytes)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), file_blob = VALUES(file_blob), file_size_bytes = VALUES(file_size_bytes)',
            [$docId, $mime, $bytes, strlen($bytes)]
        );
        try {
            catn8_build_wizard_index_document_for_search($docId);
        } catch (Throwable $e) {
            error_log('[build_wizard] failed to index document for search (backfill doc ' . $docId . '): ' . $e->getMessage());
        }
        $written++;
    }

    return [
        'project_id' => $effectiveProjectId,
        'apply' => $apply ? 1 : 0,
        'limit' => $effectiveLimit,
        'total' => $total,
        'already_blob' => $alreadyBlob,
        'from_image_blob' => $fromImageBlob,
        'from_file_path' => $fromFilePath,
        'missing' => $missing,
        'written' => $written,
        'missing_docs' => $missingDocs,
    ];
}

function catn8_build_wizard_upsert_document_blob(int $documentId, string $mime, string $bytes): void
{
    if ($documentId <= 0 || $bytes === '') {
        return;
    }
    $safeMime = trim($mime);
    if ($safeMime === '') {
        $safeMime = 'application/octet-stream';
    }
    Database::execute(
        'INSERT INTO build_wizard_document_blobs (document_id, mime_type, file_blob, file_size_bytes)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), file_blob = VALUES(file_blob), file_size_bytes = VALUES(file_size_bytes)',
        [$documentId, $safeMime, $bytes, strlen($bytes)]
    );
}

function catn8_build_wizard_find_binary(string $command, array $fallbackPaths = []): ?string
{
    if (function_exists('shell_exec')) {
        $rawPath = shell_exec('command -v ' . escapeshellarg($command) . ' 2>/dev/null');
        $resolved = trim((string)$rawPath);
        if ($resolved !== '' && is_executable($resolved)) {
            return $resolved;
        }
    }
    foreach ($fallbackPaths as $path) {
        $candidate = trim((string)$path);
        if ($candidate !== '' && is_executable($candidate)) {
            return $candidate;
        }
    }
    return null;
}

function catn8_build_wizard_normalize_search_text(string $text, int $maxLen = 800000): string
{
    if ($text === '') {
        return '';
    }
    $clean = str_replace("\0", ' ', $text);
    $clean = preg_replace('/\s+/u', ' ', $clean);
    if (!is_string($clean)) {
        return '';
    }
    $clean = trim($clean);
    if ($clean === '') {
        return '';
    }
    if (strlen($clean) > $maxLen) {
        $clean = substr($clean, 0, $maxLen);
    }
    return $clean;
}

function catn8_build_wizard_text_from_bytes(string $bytes): string
{
    if ($bytes === '') {
        return '';
    }
    if (function_exists('mb_convert_encoding')) {
        $detected = function_exists('mb_detect_encoding')
            ? mb_detect_encoding($bytes, ['UTF-8', 'ISO-8859-1', 'WINDOWS-1252', 'ASCII'], true)
            : false;
        if (is_string($detected) && $detected !== '' && strtoupper($detected) !== 'UTF-8') {
            $bytes = mb_convert_encoding($bytes, 'UTF-8', $detected);
        } elseif (!mb_check_encoding($bytes, 'UTF-8')) {
            $bytes = mb_convert_encoding($bytes, 'UTF-8', 'UTF-8,ISO-8859-1,WINDOWS-1252,ASCII');
        }
    }
    return catn8_build_wizard_normalize_search_text($bytes, 900000);
}

function catn8_build_wizard_extract_zip_xml_text(string $path, int $maxLen = 700000): string
{
    if ($path === '' || !is_file($path) || !class_exists('ZipArchive')) {
        return '';
    }
    $zip = new ZipArchive();
    if ($zip->open($path) !== true) {
        return '';
    }
    $parts = [];
    $total = 0;
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $name = strtolower((string)$zip->getNameIndex($i));
        if ($name === '' || !str_ends_with($name, '.xml')) {
            continue;
        }
        if (
            !str_starts_with($name, 'word/')
            && !str_starts_with($name, 'xl/')
            && !str_starts_with($name, 'ppt/')
            && !str_starts_with($name, 'content.xml')
        ) {
            continue;
        }
        $xml = $zip->getFromIndex($i);
        if (!is_string($xml) || $xml === '') {
            continue;
        }
        $text = html_entity_decode(strip_tags($xml), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = catn8_build_wizard_normalize_search_text($text, 120000);
        if ($text === '') {
            continue;
        }
        $parts[] = $text;
        $total += strlen($text);
        if ($total >= $maxLen) {
            break;
        }
    }
    $zip->close();
    return catn8_build_wizard_normalize_search_text(implode(' ', $parts), $maxLen);
}

function catn8_build_wizard_extract_pdf_text_from_path(string $pdfPath): string
{
    if ($pdfPath === '' || !is_file($pdfPath)) {
        return '';
    }
    $bin = catn8_build_wizard_find_binary('pdftotext', [
        '/usr/bin/pdftotext',
        '/usr/local/bin/pdftotext',
        '/opt/homebrew/bin/pdftotext',
    ]);
    if ($bin === null || !function_exists('shell_exec')) {
        return '';
    }
    $tmpOut = tempnam(sys_get_temp_dir(), 'bw_pdf_txt_');
    if (!is_string($tmpOut) || $tmpOut === '') {
        return '';
    }
    $cmd = escapeshellarg($bin)
        . ' -enc UTF-8 -layout -q '
        . escapeshellarg($pdfPath) . ' '
        . escapeshellarg($tmpOut)
        . ' 2>/dev/null';
    shell_exec($cmd);
    $txt = is_file($tmpOut) ? (string)file_get_contents($tmpOut) : '';
    if (is_file($tmpOut)) {
        @unlink($tmpOut);
    }
    return catn8_build_wizard_text_from_bytes($txt);
}

function catn8_build_wizard_extract_image_text_with_tesseract(string $imagePath): string
{
    if ($imagePath === '' || !is_file($imagePath) || !function_exists('shell_exec')) {
        return '';
    }
    $bin = catn8_build_wizard_find_binary('tesseract', [
        '/usr/bin/tesseract',
        '/usr/local/bin/tesseract',
        '/opt/homebrew/bin/tesseract',
    ]);
    if ($bin === null) {
        return '';
    }
    $tmpOutBase = tempnam(sys_get_temp_dir(), 'bw_ocr_');
    if (!is_string($tmpOutBase) || $tmpOutBase === '') {
        return '';
    }
    @unlink($tmpOutBase);
    $cmd = escapeshellarg($bin)
        . ' ' . escapeshellarg($imagePath)
        . ' ' . escapeshellarg($tmpOutBase)
        . ' -l eng --psm 6 txt 2>/dev/null';
    shell_exec($cmd);
    $txtPath = $tmpOutBase . '.txt';
    $txt = is_file($txtPath) ? (string)file_get_contents($txtPath) : '';
    if (is_file($txtPath)) {
        @unlink($txtPath);
    }
    return catn8_build_wizard_text_from_bytes($txt);
}

function catn8_build_wizard_extract_pdf_text_with_ocr_fallback(string $pdfPath): string
{
    $pdftoppm = catn8_build_wizard_find_binary('pdftoppm', [
        '/usr/bin/pdftoppm',
        '/usr/local/bin/pdftoppm',
        '/opt/homebrew/bin/pdftoppm',
    ]);
    if ($pdftoppm === null || !function_exists('shell_exec') || $pdfPath === '' || !is_file($pdfPath)) {
        return '';
    }
    $base = tempnam(sys_get_temp_dir(), 'bw_pdf_ocr_');
    if (!is_string($base) || $base === '') {
        return '';
    }
    @unlink($base);
    $cmd = escapeshellarg($pdftoppm)
        . ' -f 1 -singlefile -png '
        . escapeshellarg($pdfPath) . ' '
        . escapeshellarg($base)
        . ' 2>/dev/null';
    shell_exec($cmd);
    $pngPath = $base . '.png';
    $text = is_file($pngPath) ? catn8_build_wizard_extract_image_text_with_tesseract($pngPath) : '';
    if (is_file($pngPath)) {
        @unlink($pngPath);
    }
    return $text;
}

function catn8_build_wizard_pdf_unescape_literal(string $input): string
{
    $out = '';
    $len = strlen($input);
    for ($i = 0; $i < $len; $i++) {
        $ch = $input[$i];
        if ($ch !== '\\') {
            $out .= $ch;
            continue;
        }
        $i++;
        if ($i >= $len) {
            break;
        }
        $next = $input[$i];
        if ($next === 'n') {
            $out .= "\n";
        } elseif ($next === 'r') {
            $out .= "\r";
        } elseif ($next === 't') {
            $out .= "\t";
        } elseif ($next === 'b') {
            $out .= "\b";
        } elseif ($next === 'f') {
            $out .= "\f";
        } elseif ($next === '\\' || $next === '(' || $next === ')') {
            $out .= $next;
        } elseif (preg_match('/[0-7]/', $next)) {
            $oct = $next;
            for ($k = 0; $k < 2 && ($i + 1) < $len; $k++) {
                $peek = $input[$i + 1];
                if (!preg_match('/[0-7]/', $peek)) {
                    break;
                }
                $oct .= $peek;
                $i++;
            }
            $out .= chr(octdec($oct));
        } else {
            $out .= $next;
        }
    }
    return $out;
}

function catn8_build_wizard_extract_pdf_text_basic_from_bytes(string $pdfBytes): string
{
    if ($pdfBytes === '' || !str_starts_with($pdfBytes, '%PDF')) {
        return '';
    }

    $chunks = [];
    if (preg_match_all('/stream[\r\n]+(.*?)endstream/s', $pdfBytes, $matches) && isset($matches[1]) && is_array($matches[1])) {
        $chunks = $matches[1];
    }
    if (!$chunks) {
        $chunks = [$pdfBytes];
    }

    $parts = [];
    $maxParts = 250;
    foreach ($chunks as $rawChunk) {
        if (!is_string($rawChunk) || $rawChunk === '') {
            continue;
        }
        $candidateTexts = [$rawChunk];

        $zlibDecoded = @zlib_decode($rawChunk);
        if (is_string($zlibDecoded) && $zlibDecoded !== '') {
            $candidateTexts[] = $zlibDecoded;
        }
        $gzUncompress = @gzuncompress($rawChunk);
        if (is_string($gzUncompress) && $gzUncompress !== '') {
            $candidateTexts[] = $gzUncompress;
        }
        $gzInflate = @gzinflate($rawChunk);
        if (is_string($gzInflate) && $gzInflate !== '') {
            $candidateTexts[] = $gzInflate;
        }

        foreach ($candidateTexts as $content) {
            if (!is_string($content) || $content === '') {
                continue;
            }

            if (preg_match_all('/\((?:\\\\.|[^\\\\)])*\)\s*Tj/s', $content, $tjMatches) && isset($tjMatches[0])) {
                foreach ($tjMatches[0] as $expr) {
                    if (!is_string($expr) || $expr === '') {
                        continue;
                    }
                    if (preg_match('/^\((.*)\)\s*Tj$/s', trim($expr), $m) && isset($m[1])) {
                        $parts[] = catn8_build_wizard_pdf_unescape_literal((string)$m[1]);
                    }
                }
            }

            if (preg_match_all('/\[(.*?)\]\s*TJ/s', $content, $tjArrayMatches) && isset($tjArrayMatches[1])) {
                foreach ($tjArrayMatches[1] as $arr) {
                    if (!is_string($arr) || $arr === '') {
                        continue;
                    }
                    if (preg_match_all('/\((?:\\\\.|[^\\\\)])*\)/s', $arr, $strMatches) && isset($strMatches[0])) {
                        foreach ($strMatches[0] as $literal) {
                            $literal = trim((string)$literal);
                            if (strlen($literal) >= 2 && $literal[0] === '(' && $literal[strlen($literal) - 1] === ')') {
                                $parts[] = catn8_build_wizard_pdf_unescape_literal(substr($literal, 1, -1));
                            }
                        }
                    }
                    if (preg_match_all('/<([0-9A-Fa-f]+)>/s', $arr, $hexMatches) && isset($hexMatches[1])) {
                        foreach ($hexMatches[1] as $hexText) {
                            $hexText = preg_replace('/[^0-9A-Fa-f]/', '', (string)$hexText);
                            if (!is_string($hexText) || $hexText === '') {
                                continue;
                            }
                            if (strlen($hexText) % 2 !== 0) {
                                $hexText .= '0';
                            }
                            $decoded = @hex2bin($hexText);
                            if (is_string($decoded) && $decoded !== '') {
                                $parts[] = $decoded;
                            }
                        }
                    }
                }
            }

            if (count($parts) >= $maxParts) {
                break 2;
            }
        }
    }

    if (!$parts) {
        return '';
    }
    return catn8_build_wizard_text_from_bytes(implode(' ', $parts));
}

function catn8_build_wizard_extract_document_text(string $bytes, string $mimeType, string $originalName): array
{
    $mime = strtolower(trim($mimeType));
    $name = strtolower(trim($originalName));
    $ext = strtolower((string)pathinfo($name, PATHINFO_EXTENSION));

    $tempPath = '';
    $writeTemp = static function () use (&$tempPath, $bytes): string {
        if ($tempPath !== '') {
            return $tempPath;
        }
        $tmp = tempnam(sys_get_temp_dir(), 'bw_doc_');
        if (!is_string($tmp) || $tmp === '') {
            return '';
        }
        $ok = file_put_contents($tmp, $bytes);
        if ($ok === false || $ok <= 0) {
            @unlink($tmp);
            return '';
        }
        $tempPath = $tmp;
        return $tempPath;
    };

    $method = 'none';
    $text = '';

    if ($mime !== '' && (str_starts_with($mime, 'text/') || str_contains($mime, 'json') || str_contains($mime, 'xml') || str_contains($mime, 'yaml') || str_contains($mime, 'csv'))) {
        $method = 'plain_text';
        $text = catn8_build_wizard_text_from_bytes($bytes);
    } elseif (in_array($ext, ['txt', 'md', 'csv', 'json', 'xml', 'yaml', 'yml', 'log', 'plan', 'ini', 'sql'], true)) {
        $method = 'plain_text';
        $text = catn8_build_wizard_text_from_bytes($bytes);
    } elseif (str_contains($mime, 'html') || in_array($ext, ['html', 'htm'], true)) {
        $method = 'html_strip';
        $text = catn8_build_wizard_html_to_text(catn8_build_wizard_text_from_bytes($bytes), 800000);
    } elseif ($mime === 'application/pdf' || $ext === 'pdf') {
        $tmpPath = $writeTemp();
        if ($tmpPath !== '') {
            $method = 'pdf_text';
            $text = catn8_build_wizard_extract_pdf_text_from_path($tmpPath);
            if ($text === '') {
                $method = 'pdf_ocr';
                $text = catn8_build_wizard_extract_pdf_text_with_ocr_fallback($tmpPath);
            }
            if ($text === '') {
                $method = 'pdf_php_fallback';
                $text = catn8_build_wizard_extract_pdf_text_basic_from_bytes($bytes);
            }
        }
    } elseif (in_array($ext, ['docx', 'pptx', 'xlsx', 'odt', 'odp', 'ods'], true) || str_contains($mime, 'officedocument') || str_contains($mime, 'opendocument')) {
        $tmpPath = $writeTemp();
        if ($tmpPath !== '') {
            $method = 'zip_xml';
            $text = catn8_build_wizard_extract_zip_xml_text($tmpPath);
        }
    } elseif (str_starts_with($mime, 'image/') || in_array($ext, ['png', 'jpg', 'jpeg', 'tif', 'tiff', 'bmp', 'gif', 'webp'], true)) {
        $tmpPath = $writeTemp();
        if ($tmpPath !== '') {
            $method = 'ocr_image';
            $text = catn8_build_wizard_extract_image_text_with_tesseract($tmpPath);
        }
    }

    if ($text === '') {
        $method = ($method === 'none') ? 'metadata_only' : $method;
    }

    if ($tempPath !== '' && is_file($tempPath)) {
        @unlink($tempPath);
    }

    return [
        'method' => $method,
        'text' => catn8_build_wizard_normalize_search_text($text, 800000),
    ];
}

function catn8_build_wizard_document_blob_row(int $documentId): ?array
{
    if ($documentId <= 0) {
        return null;
    }
    return Database::queryOne(
        'SELECT d.id, d.project_id, d.original_name, d.mime_type, d.caption, d.storage_path,
                db.file_blob, db.mime_type AS file_blob_mime_type,
                bi.image_blob, bi.mime_type AS image_blob_mime_type
         FROM build_wizard_documents d
         LEFT JOIN build_wizard_document_blobs db ON db.document_id = d.id
         LEFT JOIN build_wizard_document_images bi ON bi.document_id = d.id
         WHERE d.id = ?
         LIMIT 1',
        [$documentId]
    );
}

function catn8_build_wizard_document_bytes_from_row(array $row): array
{
    $mime = trim((string)($row['file_blob_mime_type'] ?? $row['mime_type'] ?? 'application/octet-stream'));
    if ($mime === '') {
        $mime = 'application/octet-stream';
    }
    $bytes = $row['file_blob'] ?? null;
    if (is_string($bytes) && $bytes !== '') {
        return [$bytes, $mime];
    }
    $imageBytes = $row['image_blob'] ?? null;
    if (is_string($imageBytes) && $imageBytes !== '') {
        $imageMime = trim((string)($row['image_blob_mime_type'] ?? ''));
        if ($imageMime !== '') {
            $mime = $imageMime;
        }
        return [$imageBytes, $mime];
    }
    $path = catn8_build_wizard_resolve_document_path((string)($row['storage_path'] ?? ''));
    if ($path !== '' && is_file($path)) {
        $fileBytes = @file_get_contents($path);
        if (is_string($fileBytes) && $fileBytes !== '') {
            return [$fileBytes, $mime];
        }
    }
    return ['', $mime];
}

function catn8_build_wizard_index_document_for_search(int $documentId): void
{
    $row = catn8_build_wizard_document_blob_row($documentId);
    if (!$row) {
        return;
    }
    [$bytes, $mime] = catn8_build_wizard_document_bytes_from_row($row);
    $originalName = (string)($row['original_name'] ?? '');
    $caption = (string)($row['caption'] ?? '');

    $extracted = '';
    $method = 'metadata_only';
    if ($bytes !== '') {
        $payload = catn8_build_wizard_extract_document_text($bytes, $mime, $originalName);
        $method = (string)($payload['method'] ?? 'metadata_only');
        $extracted = (string)($payload['text'] ?? '');
    }

    $hashInput = implode('|', [
        (string)($row['id'] ?? ''),
        (string)($row['project_id'] ?? ''),
        $mime,
        $originalName,
        $caption,
        hash('sha256', $bytes !== '' ? $bytes : ''),
        'extractor_v1',
    ]);
    $contentHash = hash('sha256', $hashInput);

    Database::execute(
        'INSERT INTO build_wizard_document_search_index (document_id, project_id, source_mime, extraction_method, content_hash, extracted_text)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           project_id = VALUES(project_id),
           source_mime = VALUES(source_mime),
           extraction_method = VALUES(extraction_method),
           content_hash = VALUES(content_hash),
           extracted_text = VALUES(extracted_text),
           indexed_at = CURRENT_TIMESTAMP',
        [
            (int)($row['id'] ?? 0),
            (int)($row['project_id'] ?? 0),
            $mime,
            substr($method, 0, 32),
            $contentHash,
            $extracted !== '' ? $extracted : null,
        ]
    );
}

function catn8_build_wizard_index_documents_for_project(int $projectId, int $limit = 250): array
{
    if ($projectId <= 0) {
        return ['indexed' => 0, 'errors' => 0];
    }
    $boundedLimit = max(1, min(1000, $limit));
    $rows = Database::queryAll(
        'SELECT d.id
         FROM build_wizard_documents d
         LEFT JOIN build_wizard_document_search_index si ON si.document_id = d.id
         WHERE d.project_id = ? AND si.document_id IS NULL
         ORDER BY d.id DESC
         LIMIT ' . $boundedLimit,
        [$projectId]
    );
    $indexed = 0;
    $errors = 0;
    foreach ($rows as $row) {
        $docId = (int)($row['id'] ?? 0);
        if ($docId <= 0) {
            continue;
        }
        try {
            catn8_build_wizard_index_document_for_search($docId);
            $indexed++;
        } catch (Throwable $e) {
            $errors++;
            error_log('[build_wizard] document indexing failed for doc ' . $docId . ': ' . $e->getMessage());
        }
    }
    return ['indexed' => $indexed, 'errors' => $errors];
}

function catn8_build_wizard_search_documents(int $projectId, string $query, int $limit = 20): array
{
    $q = trim($query);
    if ($projectId <= 0 || $q === '') {
        return [];
    }
    $safeLimit = max(1, min(50, $limit));
    $like = '%' . $q . '%';
    $rows = Database::queryAll(
        'SELECT d.id, d.project_id, d.step_id, s.phase_key AS step_phase_key, s.title AS step_title,
                d.kind, d.original_name, d.mime_type, d.storage_path, d.file_size_bytes, d.caption, d.uploaded_at,
                si.extraction_method, si.indexed_at,
                MATCH(si.extracted_text) AGAINST (? IN NATURAL LANGUAGE MODE) AS ft_score,
                si.extracted_text
         FROM build_wizard_documents d
         INNER JOIN build_wizard_projects p ON p.id = d.project_id
         LEFT JOIN build_wizard_steps s ON s.id = d.step_id
         LEFT JOIN build_wizard_document_search_index si ON si.document_id = d.id
         WHERE d.project_id = ?
           AND p.owner_user_id IS NOT NULL
           AND (
               d.original_name LIKE ?
               OR COALESCE(d.caption, \'\') LIKE ?
               OR COALESCE(s.title, \'\') LIKE ?
               OR COALESCE(s.phase_key, \'\') LIKE ?
               OR (si.extracted_text IS NOT NULL AND MATCH(si.extracted_text) AGAINST (? IN NATURAL LANGUAGE MODE))
               OR COALESCE(si.extracted_text, \'\') LIKE ?
           )
         ORDER BY COALESCE(ft_score, 0) DESC, d.uploaded_at DESC, d.id DESC
         LIMIT ' . $safeLimit,
        [$q, $projectId, $like, $like, $like, $like, $q, $like]
    );

    $results = [];
    foreach ($rows as $row) {
        $docId = (int)($row['id'] ?? 0);
        $snippet = '';
        $indexedText = (string)($row['extracted_text'] ?? '');
        if ($indexedText !== '') {
            $index = stripos($indexedText, $q);
            if ($index === false) {
                $snippet = substr($indexedText, 0, 200);
            } else {
                $start = max(0, $index - 80);
                $snippet = substr($indexedText, $start, 220);
            }
            $snippet = catn8_build_wizard_normalize_search_text($snippet, 240);
        }
        $mimeType = (string)($row['mime_type'] ?? '');
        $results[] = [
            'id' => $docId,
            'project_id' => (int)($row['project_id'] ?? 0),
            'step_id' => $row['step_id'] !== null ? (int)$row['step_id'] : null,
            'step_phase_key' => $row['step_phase_key'] !== null ? (string)$row['step_phase_key'] : null,
            'step_title' => $row['step_title'] !== null ? (string)$row['step_title'] : null,
            'kind' => (string)($row['kind'] ?? ''),
            'original_name' => (string)($row['original_name'] ?? ''),
            'mime_type' => $mimeType,
            'storage_path' => (string)($row['storage_path'] ?? ''),
            'file_size_bytes' => (int)($row['file_size_bytes'] ?? 0),
            'caption' => $row['caption'] !== null ? (string)$row['caption'] : null,
            'uploaded_at' => (string)($row['uploaded_at'] ?? ''),
            'public_url' => '/api/build_wizard.php?action=get_document&document_id=' . $docId,
            'thumbnail_url' => '/api/build_wizard.php?action=get_document&document_id=' . $docId . '&thumb=1',
            'is_image' => strpos(strtolower($mimeType), 'image/') === 0 ? 1 : 0,
            'snippet' => $snippet,
            'score' => isset($row['ft_score']) ? (float)$row['ft_score'] : 0.0,
            'extraction_method' => (string)($row['extraction_method'] ?? 'none'),
            'indexed_at' => (string)($row['indexed_at'] ?? ''),
        ];
    }
    return $results;
}

function catn8_build_wizard_normalize_upload_files(string $field): array
{
    if (!isset($_FILES[$field]) || !is_array($_FILES[$field])) {
        return [];
    }
    $raw = $_FILES[$field];
    $names = $raw['name'] ?? null;
    $tmpNames = $raw['tmp_name'] ?? null;
    $sizes = $raw['size'] ?? null;
    $types = $raw['type'] ?? null;
    $errors = $raw['error'] ?? null;

    if (!is_array($names)) {
        return [$raw];
    }

    $out = [];
    $count = count($names);
    for ($i = 0; $i < $count; $i++) {
        $out[] = [
            'name' => (string)($names[$i] ?? ''),
            'tmp_name' => (string)($tmpNames[$i] ?? ''),
            'size' => (int)($sizes[$i] ?? 0),
            'type' => (string)($types[$i] ?? ''),
            'error' => (int)($errors[$i] ?? UPLOAD_ERR_NO_FILE),
        ];
    }
    return $out;
}

function catn8_build_wizard_filename_parts(string $name): array
{
    $trimmed = trim($name);
    $lower = strtolower($trimmed);
    $ext = strtolower((string)pathinfo($trimmed, PATHINFO_EXTENSION));
    $stem = strtolower((string)pathinfo($trimmed, PATHINFO_FILENAME));
    $canonical = preg_replace('/[^a-z0-9]+/', '', $lower);
    if (!is_string($canonical)) {
        $canonical = '';
    }
    $stemCanonical = preg_replace('/[^a-z0-9]+/', '', $stem);
    if (!is_string($stemCanonical)) {
        $stemCanonical = '';
    }
    return [
        'raw' => $trimmed,
        'lower' => $lower,
        'ext' => $ext,
        'stem' => $stem,
        'canonical' => $canonical,
        'stem_canonical' => $stemCanonical,
    ];
}

function catn8_build_wizard_filename_match_score(string $targetName, string $candidateName): int
{
    $t = catn8_build_wizard_filename_parts($targetName);
    $c = catn8_build_wizard_filename_parts($candidateName);

    if ($t['lower'] !== '' && $t['lower'] === $c['lower']) {
        return 100;
    }
    if ($t['ext'] !== '' && $t['ext'] === $c['ext'] && $t['canonical'] !== '' && $t['canonical'] === $c['canonical']) {
        return 90;
    }
    if ($t['ext'] !== '' && $t['ext'] === $c['ext'] && $t['stem_canonical'] !== '' && $t['stem_canonical'] === $c['stem_canonical']) {
        return 80;
    }
    if ($t['ext'] !== '' && $t['ext'] === $c['ext']) {
        $a = (string)$t['stem_canonical'];
        $b = (string)$c['stem_canonical'];
        if ($a !== '' && $b !== '') {
            if (function_exists('levenshtein')) {
                $dist = levenshtein($a, $b);
                if ($dist >= 0 && $dist <= 2) {
                    return 60 - ($dist * 5);
                }
            }
            if (str_contains($a, $b) || str_contains($b, $a)) {
                return 52;
            }
        }
    }

    return 0;
}

function catn8_build_wizard_additional_source_roots(): array
{
    $projectRoot = dirname(__DIR__);
    $roots = [
        $projectRoot . '/.local/state/build_wizard_import/stage_docs',
        '/Users/jongraves/Documents/Home/91 Singletree Ln',
    ];

    $envRoots = trim((string)getenv('BUILD_WIZARD_BLOB_SOURCE_ROOTS'));
    if ($envRoots !== '') {
        foreach (explode(',', $envRoots) as $raw) {
            $candidate = trim($raw);
            if ($candidate !== '') {
                $roots[] = $candidate;
            }
        }
    }

    $out = [];
    foreach ($roots as $r) {
        $path = trim((string)$r);
        if ($path === '' || !is_dir($path)) {
            continue;
        }
        if (!in_array($path, $out, true)) {
            $out[] = $path;
        }
    }
    return $out;
}

function catn8_build_wizard_collect_source_files(array $roots, int $maxFiles = 10000): array
{
    $files = [];
    $seen = [];
    foreach ($roots as $root) {
        $r = trim((string)$root);
        if ($r === '' || !is_dir($r)) {
            continue;
        }
        try {
            $iter = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($r, FilesystemIterator::SKIP_DOTS)
            );
            foreach ($iter as $info) {
                if (count($files) >= $maxFiles) {
                    break 2;
                }
                if (!$info instanceof SplFileInfo || !$info->isFile()) {
                    continue;
                }
                $path = $info->getPathname();
                if ($path === '' || isset($seen[$path])) {
                    continue;
                }
                $seen[$path] = true;
                $files[] = [
                    'path' => $path,
                    'name' => $info->getBasename(),
                ];
            }
        } catch (Throwable $e) {
            error_log('[build_wizard] source scan skipped: ' . $e->getMessage());
        }
    }
    return $files;
}

function catn8_build_wizard_find_source_file_path_for_name(string $originalName): string
{
    static $cachedFiles = null;
    if ($cachedFiles === null) {
        $cachedFiles = catn8_build_wizard_collect_source_files(catn8_build_wizard_additional_source_roots(), 12000);
    }

    $target = trim($originalName);
    if ($target === '' || !is_array($cachedFiles) || !$cachedFiles) {
        return '';
    }

    $bestScore = 0;
    $bestPath = '';
    $tieCount = 0;
    foreach ($cachedFiles as $sf) {
        $candidateName = (string)($sf['name'] ?? '');
        $candidatePath = (string)($sf['path'] ?? '');
        if ($candidateName === '' || $candidatePath === '') {
            continue;
        }
        $score = catn8_build_wizard_filename_match_score($target, $candidateName);
        if ($score <= 0) {
            continue;
        }
        if ($score > $bestScore) {
            $bestScore = $score;
            $bestPath = $candidatePath;
            $tieCount = 1;
        } elseif ($score === $bestScore) {
            $tieCount++;
        }
    }

    if ($bestScore < 70) {
        return '';
    }
    if ($bestScore < 90 && $tieCount > 1) {
        return '';
    }
    return (is_file($bestPath) ? $bestPath : '');
}

function catn8_build_wizard_step_by_id(int $stepId): ?array
{
    $row = Database::queryOne(
        'SELECT id, project_id, step_order, phase_key, parent_step_id, depends_on_step_ids_json, step_type, title, description, permit_required, permit_document_id, permit_name, permit_authority, permit_status, permit_application_url,
                purchase_category, purchase_brand, purchase_model, purchase_sku, purchase_unit, purchase_qty, purchase_unit_price, purchase_vendor, purchase_url,
                expected_start_date, expected_end_date, expected_duration_days, estimated_cost, actual_cost, ai_estimated_fields_json, is_completed, completed_at, ai_generated, source_ref,
                created_at, updated_at
         FROM build_wizard_steps
         WHERE id = ?
         LIMIT 1',
        [$stepId]
    );
    if (!$row) {
        return null;
    }

    $notesByStep = catn8_build_wizard_step_notes_by_step_ids([$stepId]);
    $auditLogsByStep = catn8_build_wizard_step_audit_logs_by_step_ids([$stepId]);

    return [
        'id' => (int)($row['id'] ?? 0),
        'project_id' => (int)($row['project_id'] ?? 0),
        'step_order' => (int)($row['step_order'] ?? 0),
        'phase_key' => (string)($row['phase_key'] ?? ''),
        'parent_step_id' => $row['parent_step_id'] !== null ? (int)$row['parent_step_id'] : null,
        'depends_on_step_ids' => catn8_build_wizard_normalize_int_array(catn8_build_wizard_decode_json_array($row['depends_on_step_ids_json'] ?? null)),
        'step_type' => catn8_build_wizard_step_type((string)($row['step_type'] ?? '')),
        'title' => (string)($row['title'] ?? ''),
        'description' => (string)($row['description'] ?? ''),
        'permit_required' => (int)($row['permit_required'] ?? 0),
        'permit_document_id' => $row['permit_document_id'] !== null ? (int)$row['permit_document_id'] : null,
        'permit_name' => $row['permit_name'] !== null ? (string)$row['permit_name'] : null,
        'permit_authority' => $row['permit_authority'] !== null ? (string)$row['permit_authority'] : null,
        'permit_status' => $row['permit_status'] !== null ? (string)$row['permit_status'] : null,
        'permit_application_url' => $row['permit_application_url'] !== null ? (string)$row['permit_application_url'] : null,
        'purchase_category' => $row['purchase_category'] !== null ? (string)$row['purchase_category'] : null,
        'purchase_brand' => $row['purchase_brand'] !== null ? (string)$row['purchase_brand'] : null,
        'purchase_model' => $row['purchase_model'] !== null ? (string)$row['purchase_model'] : null,
        'purchase_sku' => $row['purchase_sku'] !== null ? (string)$row['purchase_sku'] : null,
        'purchase_unit' => $row['purchase_unit'] !== null ? (string)$row['purchase_unit'] : null,
        'purchase_qty' => $row['purchase_qty'] !== null ? (float)$row['purchase_qty'] : null,
        'purchase_unit_price' => $row['purchase_unit_price'] !== null ? (float)$row['purchase_unit_price'] : null,
        'purchase_vendor' => $row['purchase_vendor'] !== null ? (string)$row['purchase_vendor'] : null,
        'purchase_url' => $row['purchase_url'] !== null ? (string)$row['purchase_url'] : null,
        'expected_start_date' => $row['expected_start_date'] !== null ? (string)$row['expected_start_date'] : null,
        'expected_end_date' => $row['expected_end_date'] !== null ? (string)$row['expected_end_date'] : null,
        'expected_duration_days' => $row['expected_duration_days'] !== null ? (int)$row['expected_duration_days'] : null,
        'estimated_cost' => $row['estimated_cost'] !== null ? (float)$row['estimated_cost'] : null,
        'actual_cost' => $row['actual_cost'] !== null ? (float)$row['actual_cost'] : null,
        'ai_estimated_fields' => catn8_build_wizard_normalize_ai_estimated_fields(catn8_build_wizard_decode_json_array($row['ai_estimated_fields_json'] ?? null)),
        'is_completed' => (int)($row['is_completed'] ?? 0),
        'completed_at' => $row['completed_at'] !== null ? (string)$row['completed_at'] : null,
        'ai_generated' => (int)($row['ai_generated'] ?? 0),
        'source_ref' => $row['source_ref'] !== null ? (string)$row['source_ref'] : null,
        'created_at' => $row['created_at'] !== null ? (string)$row['created_at'] : null,
        'updated_at' => $row['updated_at'] !== null ? (string)$row['updated_at'] : null,
        'notes' => $notesByStep[$stepId] ?? [],
        'audit_logs' => $auditLogsByStep[$stepId] ?? [],
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
            'home_type' => (string)($project['home_type'] ?? ''),
            'room_count' => $project['room_count'] !== null ? (int)$project['room_count'] : null,
            'bedrooms_count' => $project['bedrooms_count'] !== null ? (int)$project['bedrooms_count'] : null,
            'kitchens_count' => $project['kitchens_count'] !== null ? (int)$project['kitchens_count'] : null,
            'bathroom_count' => $project['bathroom_count'] !== null ? (int)$project['bathroom_count'] : null,
            'stories_count' => $project['stories_count'] !== null ? (int)$project['stories_count'] : null,
            'lot_size_sqft' => $project['lot_size_sqft'] !== null ? (int)$project['lot_size_sqft'] : null,
            'garage_spaces' => $project['garage_spaces'] !== null ? (int)$project['garage_spaces'] : null,
            'parking_spaces' => $project['parking_spaces'] !== null ? (int)$project['parking_spaces'] : null,
            'year_built' => $project['year_built'] !== null ? (int)$project['year_built'] : null,
            'hoa_fee_monthly' => $project['hoa_fee_monthly'] !== null ? (float)$project['hoa_fee_monthly'] : null,
            'lot_address' => (string)($project['lot_address'] ?? ''),
            'target_start_date' => $project['target_start_date'] !== null ? (string)$project['target_start_date'] : null,
            'target_completion_date' => $project['target_completion_date'] !== null ? (string)$project['target_completion_date'] : null,
            'wizard_notes' => (string)($project['wizard_notes'] ?? ''),
        ],
        'documents' => $documents,
        'timeline_steps' => $steps,
        'house_template_steps' => catn8_build_wizard_dawsonville_template_steps(),
        'leading_questions' => catn8_build_wizard_default_questions(),
        'instructions_for_ai' => [
            'Generate/optimize the full house-build timeline including permits and inspections.',
            'Always respect build dependencies (permits before work, foundation before framing, framing before rough-ins, rough-ins before finishes).',
            'For material pricing, prefer realistic current retail ranges from common stores (Lowes, Home Depot, regional suppliers) and mark estimated fields.',
            'Return strict JSON only.',
            'Keep step_order contiguous from 1..N.',
            'Each step should include expected dates, duration, and estimated cost where possible.',
            'If values are estimated, include ai_estimated_fields for those fields.',
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

function catn8_build_wizard_safe_external_url(?string $url): ?string
{
    $u = trim((string)$url);
    if ($u === '' || strlen($u) > 1000) {
        return null;
    }
    if (!preg_match('#^https?://#i', $u)) {
        return null;
    }
    $parts = parse_url($u);
    if (!is_array($parts) || empty($parts['host'])) {
        return null;
    }
    return $u;
}

function catn8_build_wizard_http_get_text(string $url, int $timeout = 15): string
{
    $ctx = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => $timeout,
            'follow_location' => 1,
            'max_redirects' => 5,
            'header' => "User-Agent: catn8-build-wizard/1.0\r\nAccept: text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8\r\n",
        ],
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
        ],
    ]);
    $raw = @file_get_contents($url, false, $ctx);
    if (!is_string($raw) || $raw === '') {
        return '';
    }
    if (strlen($raw) > 1_500_000) {
        $raw = substr($raw, 0, 1_500_000);
    }
    return $raw;
}

function catn8_build_wizard_html_to_text(string $html, int $maxLen = 8000): string
{
    if ($html === '') {
        return '';
    }
    $txt = preg_replace('#<script[^>]*>.*?</script>#is', ' ', $html);
    if (!is_string($txt)) {
        $txt = $html;
    }
    $txt = preg_replace('#<style[^>]*>.*?</style>#is', ' ', $txt);
    if (!is_string($txt)) {
        $txt = $html;
    }
    $txt = html_entity_decode(strip_tags($txt), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $txt = preg_replace('/\s+/u', ' ', $txt);
    if (!is_string($txt)) {
        return '';
    }
    $txt = trim($txt);
    if ($txt === '') {
        return '';
    }
    if (strlen($txt) > $maxLen) {
        $txt = substr($txt, 0, $maxLen);
    }
    return $txt;
}

function catn8_build_wizard_extract_html_title(string $html): string
{
    if (preg_match('#<title[^>]*>(.*?)</title>#is', $html, $m) && isset($m[1])) {
        $title = html_entity_decode(trim(strip_tags((string)$m[1])), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        return trim($title);
    }
    return '';
}

function catn8_build_wizard_decode_duckduckgo_href(string $href): string
{
    $h = html_entity_decode(trim($href), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    if ($h === '') {
        return '';
    }
    if (str_starts_with($h, '//')) {
        $h = 'https:' . $h;
    }
    if (preg_match('#^https?://duckduckgo\.com/l/\?(.+)$#i', $h, $m)) {
        parse_str($m[1], $params);
        $uddg = isset($params['uddg']) ? urldecode((string)$params['uddg']) : '';
        if ($uddg !== '') {
            return $uddg;
        }
    }
    return $h;
}

function catn8_build_wizard_search_shopping_options(string $query, int $limit = 6): array
{
    $q = trim($query);
    if ($q === '') {
        return [];
    }
    $url = 'https://duckduckgo.com/html/?q=' . rawurlencode($q);
    $html = catn8_build_wizard_http_get_text($url, 15);
    if ($html === '') {
        return [];
    }

    $results = [];
    if (preg_match_all('#<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>#is', $html, $matches, PREG_SET_ORDER)) {
        foreach ($matches as $m) {
            $href = catn8_build_wizard_decode_duckduckgo_href((string)($m[1] ?? ''));
            if ($href === '' || !preg_match('#^https?://#i', $href)) {
                continue;
            }
            $title = trim(html_entity_decode(strip_tags((string)($m[2] ?? '')), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            if ($title === '') {
                continue;
            }
            $results[] = [
                'title' => $title,
                'url' => $href,
                'snippet' => '',
            ];
            if (count($results) >= $limit) {
                break;
            }
        }
    }
    return $results;
}

function catn8_build_wizard_extract_price_guess(string $text): ?float
{
    if ($text === '') {
        return null;
    }
    if (preg_match('/\\$\\s*([0-9]{1,6}(?:,[0-9]{3})*(?:\\.[0-9]{2})?)/', $text, $m) && isset($m[1])) {
        $raw = str_replace(',', '', (string)$m[1]);
        if ($raw !== '' && is_numeric($raw)) {
            $value = (float)$raw;
            if ($value > 0) {
                return $value;
            }
        }
    }
    return null;
}

function catn8_build_wizard_apply_option_tiers(array $options): array
{
    if (!$options) {
        return [];
    }

    $indexed = [];
    foreach ($options as $i => $opt) {
        if (!is_array($opt)) {
            continue;
        }
        $price = null;
        if (isset($opt['unit_price']) && is_numeric($opt['unit_price'])) {
            $p = (float)$opt['unit_price'];
            if ($p > 0) {
                $price = $p;
            }
        }
        $opt['unit_price'] = $price;
        $indexed[] = [
            'index' => $i,
            'option' => $opt,
        ];
    }
    if (!$indexed) {
        return [];
    }

    $priced = array_values(array_filter($indexed, static function ($row): bool {
        return isset($row['option']['unit_price']) && is_numeric($row['option']['unit_price']) && (float)$row['option']['unit_price'] > 0;
    }));

    usort($priced, static function (array $a, array $b): int {
        $pa = (float)($a['option']['unit_price'] ?? 0);
        $pb = (float)($b['option']['unit_price'] ?? 0);
        if ($pa === $pb) {
            return ($a['index'] <=> $b['index']);
        }
        return ($pa <=> $pb);
    });

    $pickByIndex = static function (array $rows, int $idx): ?array {
        if (!isset($rows[$idx]) || !is_array($rows[$idx]) || !isset($rows[$idx]['option']) || !is_array($rows[$idx]['option'])) {
            return null;
        }
        return $rows[$idx];
    };

    $conservative = null;
    $premium = null;
    $standard = null;

    if (count($priced) >= 1) {
        $conservative = $pickByIndex($priced, 0);
        $premium = $pickByIndex($priced, count($priced) - 1);
        $standard = $pickByIndex($priced, intdiv(count($priced) - 1, 2));
    }

    if ($conservative === null) {
        $conservative = $indexed[0];
    }
    if ($premium === null) {
        $premium = $indexed[count($indexed) - 1];
    }

    if ($standard === null || (($standard['index'] ?? -1) === ($conservative['index'] ?? -2)) || (($standard['index'] ?? -1) === ($premium['index'] ?? -3))) {
        foreach ($indexed as $row) {
            $idx = (int)($row['index'] ?? -1);
            if ($idx !== (int)($conservative['index'] ?? -1) && $idx !== (int)($premium['index'] ?? -1)) {
                $standard = $row;
                break;
            }
        }
        if ($standard === null) {
            $standard = $conservative;
        }
    }

    $tierRows = [
        'conservative' => $conservative,
        'standard' => $standard,
        'premium' => $premium,
    ];
    $labels = [
        'conservative' => 'Conservative',
        'standard' => 'Standard',
        'premium' => 'Premium',
    ];

    $out = [];
    foreach ($tierRows as $tier => $row) {
        if (!is_array($row) || !isset($row['option']) || !is_array($row['option'])) {
            continue;
        }
        $opt = $row['option'];
        $opt['tier'] = $tier;
        $opt['tier_label'] = $labels[$tier] ?? ucfirst($tier);
        $out[] = $opt;
    }

    return $out;
}

function catn8_build_wizard_step_for_owner(int $stepId, int $uid): ?array
{
    if ($stepId <= 0) {
        return null;
    }
    return Database::queryOne(
        'SELECT s.*
         FROM build_wizard_steps s
         INNER JOIN build_wizard_projects p ON p.id = s.project_id
         WHERE s.id = ? AND p.owner_user_id = ?
         LIMIT 1',
        [$stepId, $uid]
    );
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
            'phase_key' => $phaseKey = catn8_build_wizard_normalize_phase_key($step['phase_key'] ?? 'general'),
            'step_type' => catn8_build_wizard_step_type((string)($step['step_type'] ?? catn8_build_wizard_infer_step_type($title, $phaseKey, !empty($step['permit_required']) ? 1 : 0))),
            'title' => $title,
            'description' => trim((string)($step['description'] ?? '')),
            'permit_required' => !empty($step['permit_required']) ? 1 : 0,
            'permit_name' => (($step['permit_name'] ?? null) !== null) ? trim((string)$step['permit_name']) : null,
            'expected_start_date' => catn8_build_wizard_parse_date_or_null($step['expected_start_date'] ?? null),
            'expected_end_date' => catn8_build_wizard_parse_date_or_null($step['expected_end_date'] ?? null),
            'expected_duration_days' => $duration,
            'estimated_cost' => catn8_build_wizard_to_decimal_or_null($step['estimated_cost'] ?? null),
            'depends_on_step_orders' => catn8_build_wizard_normalize_int_array($step['depends_on_step_orders'] ?? []),
            'ai_estimated_fields' => catn8_build_wizard_normalize_ai_estimated_fields($step['ai_estimated_fields'] ?? []),
            'source_ref' => catn8_build_wizard_text_or_null($step['source_ref'] ?? null, 255),
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

function catn8_build_wizard_upsert_ai_steps(int $projectId, array $normalizedSteps, string $sourceRef, bool $replaceAll = false): array
{
    $inserted = 0;
    $updated = 0;
    $stepIdByOrder = [];
    $pendingDependencies = [];

    foreach ($normalizedSteps as $s) {
        $stepOrder = (int)$s['step_order'];
        $existing = Database::queryOne(
            'SELECT id FROM build_wizard_steps WHERE project_id = ? AND step_order = ? LIMIT 1',
            [$projectId, $stepOrder]
        );
        $effectiveSourceRef = trim((string)($s['source_ref'] ?? '')) !== '' ? (string)$s['source_ref'] : $sourceRef;
        $aiEstimatedJson = null;
        if (is_array($s['ai_estimated_fields'] ?? null)) {
            $cleanEstimated = catn8_build_wizard_normalize_ai_estimated_fields($s['ai_estimated_fields']);
            if ($cleanEstimated) {
                $aiEstimatedJson = json_encode($cleanEstimated, JSON_UNESCAPED_SLASHES);
            }
        }

        if ($existing) {
            Database::execute(
                'UPDATE build_wizard_steps
                 SET phase_key = ?, step_type = ?, title = ?, description = ?, permit_required = ?, permit_name = ?, expected_start_date = ?, expected_end_date = ?, expected_duration_days = ?, estimated_cost = ?, ai_estimated_fields_json = ?, ai_generated = 1, source_ref = ?
                 WHERE id = ?',
                [
                    $s['phase_key'],
                    $s['step_type'],
                    $s['title'],
                    $s['description'],
                    $s['permit_required'],
                    $s['permit_name'],
                    $s['expected_start_date'],
                    $s['expected_end_date'],
                    $s['expected_duration_days'],
                    $s['estimated_cost'],
                    $aiEstimatedJson,
                    $effectiveSourceRef,
                    (int)$existing['id'],
                ]
            );
            $stepIdByOrder[$stepOrder] = (int)$existing['id'];
            $pendingDependencies[$stepOrder] = $s['depends_on_step_orders'] ?? [];
            $updated++;
        } else {
            Database::execute(
                'INSERT INTO build_wizard_steps
                    (project_id, step_order, phase_key, depends_on_step_ids_json, step_type, title, description, permit_required, permit_name, expected_start_date, expected_end_date, expected_duration_days, estimated_cost, actual_cost, ai_estimated_fields_json, is_completed, completed_at, ai_generated, source_ref)
                 VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 0, NULL, 1, ?)',
                [
                    $projectId,
                    $stepOrder,
                    $s['phase_key'],
                    $s['step_type'],
                    $s['title'],
                    $s['description'],
                    $s['permit_required'],
                    $s['permit_name'],
                    $s['expected_start_date'],
                    $s['expected_end_date'],
                    $s['expected_duration_days'],
                    $s['estimated_cost'],
                    $aiEstimatedJson,
                    $effectiveSourceRef,
                ]
            );
            $stepIdByOrder[$stepOrder] = (int)Database::lastInsertId();
            $pendingDependencies[$stepOrder] = $s['depends_on_step_orders'] ?? [];
            $inserted++;
        }
    }

    foreach ($pendingDependencies as $order => $dependencyOrders) {
        $stepId = (int)($stepIdByOrder[(int)$order] ?? 0);
        if ($stepId <= 0) {
            continue;
        }
        $depIds = [];
        foreach (catn8_build_wizard_normalize_int_array($dependencyOrders) as $depOrder) {
            $depId = (int)($stepIdByOrder[$depOrder] ?? 0);
            if ($depId > 0 && $depId !== $stepId) {
                $depIds[] = $depId;
            }
        }
        $depIds = array_values(array_unique($depIds));
        Database::execute(
            'UPDATE build_wizard_steps SET depends_on_step_ids_json = ? WHERE id = ?',
            [$depIds ? json_encode($depIds, JSON_UNESCAPED_SLASHES) : null, $stepId]
        );
    }

    if ($replaceAll) {
        $maxOrder = count($normalizedSteps);
        $rowsToDelete = Database::queryAll(
            'SELECT id FROM build_wizard_steps WHERE project_id = ? AND step_order > ?',
            [$projectId, $maxOrder]
        );
        $deleteIds = [];
        foreach ($rowsToDelete as $r) {
            $deleteIds[] = (int)($r['id'] ?? 0);
        }
        $deleteIds = array_values(array_filter(array_unique($deleteIds), static fn($id): bool => $id > 0));
        if ($deleteIds) {
            $placeholders = implode(',', array_fill(0, count($deleteIds), '?'));
            Database::execute(
                'UPDATE build_wizard_documents SET step_id = NULL WHERE project_id = ? AND step_id IN (' . $placeholders . ')',
                array_merge([$projectId], $deleteIds)
            );
        }
        Database::execute(
            'DELETE FROM build_wizard_steps WHERE project_id = ? AND step_order > ?',
            [$projectId, $maxOrder]
        );
    }

    return ['inserted' => $inserted, 'updated' => $updated];
}

function catn8_build_wizard_fetch_steps_minimal(int $projectId): array
{
    return Database::queryAll(
        'SELECT id, project_id, step_order, phase_key, depends_on_step_ids_json, step_type, title, description, permit_required, permit_name, source_ref
         FROM build_wizard_steps
         WHERE project_id = ?
         ORDER BY step_order ASC, id ASC',
        [$projectId]
    );
}

function catn8_build_wizard_phase_review(array $steps): array
{
    $stepById = [];
    foreach ($steps as $step) {
        $sid = (int)($step['id'] ?? 0);
        if ($sid > 0) {
            $stepById[$sid] = $step;
        }
    }

    $byPhase = [];
    foreach ($steps as $step) {
        $phaseKey = (string)($step['phase_key'] ?? 'general');
        if (!isset($byPhase[$phaseKey])) {
            $byPhase[$phaseKey] = [];
        }
        $byPhase[$phaseKey][] = $step;
    }

    $review = [];
    foreach ($byPhase as $phaseKey => $phaseSteps) {
        $rows = [];
        foreach ($phaseSteps as $step) {
            $sid = (int)($step['id'] ?? 0);
            $stepOrder = (int)($step['step_order'] ?? 0);
            $depIds = catn8_build_wizard_normalize_int_array(catn8_build_wizard_decode_json_array($step['depends_on_step_ids_json'] ?? null));
            $deps = [];
            $issues = [];

            foreach ($depIds as $depId) {
                $dep = $stepById[$depId] ?? null;
                if (!is_array($dep)) {
                    $issues[] = 'missing_dep_step_id:' . $depId;
                    continue;
                }
                $depOrder = (int)($dep['step_order'] ?? 0);
                if ($depOrder >= $stepOrder) {
                    $issues[] = 'dep_after_or_same_order:#' . $depOrder . '->#' . $stepOrder;
                }
                $deps[] = [
                    'step_id' => $depId,
                    'step_order' => $depOrder,
                    'title' => (string)($dep['title'] ?? ''),
                    'phase_key' => (string)($dep['phase_key'] ?? ''),
                ];
            }

            $rows[] = [
                'step_id' => $sid,
                'step_order' => $stepOrder,
                'title' => (string)($step['title'] ?? ''),
                'step_type' => catn8_build_wizard_step_type((string)($step['step_type'] ?? '')),
                'dependency_count' => count($deps),
                'depends_on' => $deps,
                'ordering_issues' => $issues,
            ];
        }

        usort($rows, static fn(array $a, array $b): int => ($a['step_order'] <=> $b['step_order']));

        $review[] = [
            'phase_key' => $phaseKey,
            'step_count' => count($rows),
            'dependency_issue_count' => array_reduce($rows, static fn(int $carry, array $row): int => $carry + count($row['ordering_issues']), 0),
            'steps' => $rows,
        ];
    }

    usort($review, static fn(array $a, array $b): int => strcmp((string)($a['phase_key'] ?? ''), (string)($b['phase_key'] ?? '')));
    return $review;
}

function catn8_build_wizard_align_project_to_template(int $projectId): array
{
    if ($projectId <= 0) {
        throw new RuntimeException('Invalid project id for alignment');
    }

    $templateSteps = catn8_build_wizard_dawsonville_template_steps();
    if (!$templateSteps) {
        throw new RuntimeException('House template has no steps');
    }

    $existingSteps = catn8_build_wizard_fetch_steps_minimal($projectId);
    $existingByTitle = [];
    foreach ($existingSteps as $step) {
        $titleKey = catn8_build_wizard_title_key((string)($step['title'] ?? ''));
        if ($titleKey === '') {
            continue;
        }
        if (!isset($existingByTitle[$titleKey])) {
            $existingByTitle[$titleKey] = [];
        }
        $existingByTitle[$titleKey][] = $step;
    }

    $matchedExistingIds = [];
    $assignments = [];
    foreach ($templateSteps as $idx => $tpl) {
        if (!is_array($tpl)) {
            continue;
        }
        $templateStepKey = trim((string)($tpl['template_step_key'] ?? ''));
        if ($templateStepKey === '') {
            $templateStepKey = 'template_step_' . ($idx + 1);
            $tpl['template_step_key'] = $templateStepKey;
        }

        $picked = null;
        $titleKey = catn8_build_wizard_title_key((string)($tpl['title'] ?? ''));
        if ($titleKey !== '' && isset($existingByTitle[$titleKey])) {
            foreach ($existingByTitle[$titleKey] as $candidate) {
                $cid = (int)($candidate['id'] ?? 0);
                if ($cid > 0 && !isset($matchedExistingIds[$cid])) {
                    $picked = $candidate;
                    break;
                }
            }
        }

        if (!$picked) {
            foreach ($existingSteps as $candidate) {
                $cid = (int)($candidate['id'] ?? 0);
                if ($cid <= 0 || isset($matchedExistingIds[$cid])) {
                    continue;
                }
                if (
                    catn8_build_wizard_normalize_phase_key((string)($candidate['phase_key'] ?? '')) === catn8_build_wizard_normalize_phase_key((string)($tpl['phase_key'] ?? 'general'))
                    && catn8_build_wizard_step_type((string)($candidate['step_type'] ?? 'construction')) === catn8_build_wizard_step_type((string)($tpl['step_type'] ?? 'construction'))
                ) {
                    $picked = $candidate;
                    break;
                }
            }
        }

        if ($picked) {
            $pickedId = (int)($picked['id'] ?? 0);
            if ($pickedId > 0) {
                $matchedExistingIds[$pickedId] = true;
            }
            $assignments[] = ['template' => $tpl, 'existing_id' => $pickedId];
        } else {
            $assignments[] = ['template' => $tpl, 'existing_id' => 0];
        }
    }

    $legacyStepIds = [];
    foreach ($existingSteps as $step) {
        $sid = (int)($step['id'] ?? 0);
        if ($sid > 0 && !isset($matchedExistingIds[$sid])) {
            $legacyStepIds[] = $sid;
        }
    }

    $inserted = 0;
    $updated = 0;
    $dependencyUpdates = 0;
    $templateStepIdByKey = [];

    Database::beginTransaction();
    try {
        Database::execute('UPDATE build_wizard_steps SET step_order = step_order + 1000 WHERE project_id = ?', [$projectId]);

        $order = 1;
        foreach ($assignments as $assignment) {
            $tpl = is_array($assignment['template'] ?? null) ? $assignment['template'] : [];
            $existingId = (int)($assignment['existing_id'] ?? 0);
            $phaseKey = catn8_build_wizard_normalize_phase_key($tpl['phase_key'] ?? 'general');
            $stepType = catn8_build_wizard_step_type((string)($tpl['step_type'] ?? catn8_build_wizard_infer_step_type((string)($tpl['title'] ?? ''), $phaseKey, !empty($tpl['permit_required']) ? 1 : 0)));
            $title = trim((string)($tpl['title'] ?? ''));
            if ($title === '') {
                $title = 'Template Step';
            }
            $description = trim((string)($tpl['description'] ?? ''));
            $permitRequired = !empty($tpl['permit_required']) ? 1 : 0;
            $permitName = catn8_build_wizard_text_or_null($tpl['permit_name'] ?? null, 191);
            $sourceRef = catn8_build_wizard_text_or_null($tpl['source_ref'] ?? ('House template align ' . gmdate('c')), 255);

            if ($existingId > 0) {
                Database::execute(
                    'UPDATE build_wizard_steps
                     SET step_order = ?, phase_key = ?, step_type = ?, title = ?, description = ?, permit_required = ?, permit_name = ?, source_ref = ?
                     WHERE id = ?',
                    [$order, $phaseKey, $stepType, $title, $description, $permitRequired, $permitName, $sourceRef, $existingId]
                );
                $updated++;
                $stepId = $existingId;
            } else {
                Database::execute(
                    'INSERT INTO build_wizard_steps
                        (project_id, step_order, phase_key, depends_on_step_ids_json, step_type, title, description, permit_required, permit_name, expected_start_date, expected_end_date, expected_duration_days, estimated_cost, actual_cost, ai_estimated_fields_json, is_completed, completed_at, ai_generated, source_ref)
                     VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 0, ?)',
                    [$projectId, $order, $phaseKey, $stepType, $title, $description, $permitRequired, $permitName, $sourceRef]
                );
                $inserted++;
                $stepId = (int)Database::lastInsertId();
            }

            $templateKey = trim((string)($tpl['template_step_key'] ?? ''));
            if ($templateKey !== '' && $stepId > 0) {
                $templateStepIdByKey[$templateKey] = $stepId;
            }
            $order++;
        }

        foreach ($legacyStepIds as $legacyId) {
            $sourceRow = Database::queryOne('SELECT source_ref FROM build_wizard_steps WHERE id = ? LIMIT 1', [$legacyId]);
            $legacySource = trim((string)($sourceRow['source_ref'] ?? ''));
            if ($legacySource !== '') {
                $legacySource .= ' | ';
            }
            $legacySource .= 'legacy_before_template_align_' . gmdate('Ymd_His');
            Database::execute(
                'UPDATE build_wizard_steps
                 SET step_order = ?, phase_key = ?, depends_on_step_ids_json = NULL, source_ref = ?
                 WHERE id = ?',
                [$order, 'general', $legacySource, $legacyId]
            );
            $order++;
        }

        foreach ($assignments as $assignment) {
            $tpl = is_array($assignment['template'] ?? null) ? $assignment['template'] : [];
            $templateKey = trim((string)($tpl['template_step_key'] ?? ''));
            $stepId = (int)($templateStepIdByKey[$templateKey] ?? 0);
            if ($stepId <= 0) {
                continue;
            }
            $depIds = [];
            $depKeys = is_array($tpl['depends_on_keys'] ?? null) ? $tpl['depends_on_keys'] : [];
            foreach ($depKeys as $depKey) {
                $cleanKey = trim((string)$depKey);
                if ($cleanKey === '') {
                    continue;
                }
                $depId = (int)($templateStepIdByKey[$cleanKey] ?? 0);
                if ($depId > 0 && $depId !== $stepId) {
                    $depIds[] = $depId;
                }
            }
            $depIds = array_values(array_unique($depIds));
            Database::execute(
                'UPDATE build_wizard_steps SET depends_on_step_ids_json = ? WHERE id = ?',
                [$depIds ? json_encode($depIds, JSON_UNESCAPED_SLASHES) : null, $stepId]
            );
            $dependencyUpdates++;
        }

        Database::commit();
    } catch (Throwable $e) {
        if (Database::inTransaction()) {
            Database::rollBack();
        }
        throw $e;
    }

    $finalSteps = catn8_build_wizard_fetch_steps_minimal($projectId);
    $phaseReview = catn8_build_wizard_phase_review($finalSteps);

    return [
        'summary' => [
            'project_id' => $projectId,
            'template_step_count' => count($templateSteps),
            'existing_step_count' => count($existingSteps),
            'matched_existing_count' => count($matchedExistingIds),
            'legacy_step_count' => count($legacyStepIds),
            'inserted_count' => $inserted,
            'updated_count' => $updated,
            'dependency_updates' => $dependencyUpdates,
        ],
        'phase_review' => $phaseReview,
        'steps' => catn8_build_wizard_steps_for_project($projectId),
    ];
}

function catn8_build_wizard_refine_phase_order(): array
{
    return [
        'land_due_diligence',
        'design_preconstruction',
        'dawson_county_permits',
        'site_preparation',
        'foundation',
        'framing_shell',
        'mep_rough_in',
        'interior_finishes',
        'move_in',
        'inspections_closeout',
        'general',
    ];
}

function catn8_build_wizard_refine_legacy_phase_key(array $step): string
{
    $title = strtolower(trim((string)($step['title'] ?? '')));
    $description = strtolower(trim((string)($step['description'] ?? '')));
    $phase = strtolower(trim((string)($step['phase_key'] ?? '')));
    $stepType = catn8_build_wizard_step_type((string)($step['step_type'] ?? 'construction'));
    $permitRequired = !empty($step['permit_required']) ? 1 : 0;
    $text = trim($title . ' ' . $description . ' ' . $phase);

    $isLikelyChore = str_contains($text, 'tammy')
        || str_contains($text, 'angela')
        || str_contains($text, 'barn')
        || str_contains($text, 'lawn mower')
        || str_contains($text, 'firewood')
        || str_contains($text, 'pressure wash')
        || str_contains($text, 'delivery box')
        || str_contains($text, 'camper')
        || str_contains($text, 'trail')
        || str_contains($text, 'burn pile');
    if ($isLikelyChore) {
        return 'general';
    }

    if (
        str_contains($text, 'ownership')
        || str_contains($text, 'zoning')
        || str_contains($text, 'setback')
        || str_contains($text, 'survey')
        || str_contains($text, 'topographic')
        || str_contains($text, 'soil')
        || str_contains($text, 'percolation')
        || str_contains($text, 'geotechnical')
    ) {
        return 'land_due_diligence';
    }

    if (
        str_contains($text, 'architect')
        || str_contains($text, 'engineer')
        || str_contains($text, 'blueprint')
        || str_contains($text, 'plan set')
        || str_contains($text, 'structural')
        || str_contains($text, 'design')
    ) {
        return 'design_preconstruction';
    }

    if (
        $stepType === 'permit'
        || $permitRequired === 1
        || str_contains($text, 'permit')
        || str_contains($text, 'certificate of occupancy')
        || str_contains($text, 'co ')
        || str_contains($text, 'approval')
        || str_contains($text, 'inspection')
    ) {
        if (str_contains($text, 'final') || str_contains($text, 'certificate of occupancy') || str_contains($text, 'co ')) {
            return 'inspections_closeout';
        }
        return 'dawson_county_permits';
    }

    if (
        str_contains($text, 'erosion')
        || str_contains($text, 'site work')
        || str_contains($text, 'scraped')
        || str_contains($text, 'leveled')
        || str_contains($text, 'rough grade')
        || str_contains($text, 'stake')
        || str_contains($text, 'excavat')
        || str_contains($text, 'clear')
    ) {
        return 'site_preparation';
    }

    if (
        str_contains($text, 'foundation')
        || str_contains($text, 'footing')
        || str_contains($text, 'slab')
        || str_contains($text, 'rebar')
        || str_contains($text, 'vapor barrier')
        || str_contains($text, 'concrete')
    ) {
        return 'foundation';
    }

    if (
        str_contains($text, 'frame')
        || str_contains($text, 'roof')
        || str_contains($text, 'sheathing')
        || str_contains($text, 'shingle')
        || str_contains($text, 'window')
        || str_contains($text, 'exterior door')
    ) {
        return 'framing_shell';
    }

    if (
        str_contains($text, 'mep')
        || str_contains($text, 'rough plumbing')
        || str_contains($text, 'rough electrical')
        || str_contains($text, 'rough hvac')
        || str_contains($text, 'electrical')
        || str_contains($text, 'plumbing')
        || str_contains($text, 'hvac')
        || str_contains($text, 'breaker')
        || str_contains($text, 'mini-split')
        || str_contains($text, 'septic')
        || str_contains($text, 'utility')
    ) {
        return 'mep_rough_in';
    }

    if (
        str_contains($text, 'insulation')
        || str_contains($text, 'drywall')
        || str_contains($text, 'flooring')
        || str_contains($text, 'paint')
        || str_contains($text, 'tile')
        || str_contains($text, 'trim')
        || str_contains($text, 'cabinet')
        || str_contains($text, 'fixture')
        || str_contains($text, 'countertop')
        || str_contains($text, 'appliance')
        || str_contains($text, 'door casing')
    ) {
        return 'interior_finishes';
    }

    if (
        str_contains($text, 'move in')
        || str_contains($text, 'walk-through')
        || str_contains($text, 'closeout')
        || str_contains($text, 'warranty')
        || str_contains($text, 'handoff')
        || str_contains($text, 'final grading')
        || str_contains($text, 'landscap')
        || str_contains($text, 'driveway')
        || str_contains($text, 'closing')
    ) {
        return 'move_in';
    }

    return 'general';
}

function catn8_build_wizard_refine_legacy_steps(int $projectId): array
{
    if ($projectId <= 0) {
        throw new RuntimeException('Invalid project id for legacy refinement');
    }

    $templateSteps = catn8_build_wizard_dawsonville_template_steps();
    $templateCount = count($templateSteps);
    $allSteps = catn8_build_wizard_fetch_steps_minimal($projectId);
    if (!$allSteps) {
        return [
            'summary' => [
                'project_id' => $projectId,
                'template_step_count' => $templateCount,
                'legacy_step_count_before' => 0,
                'legacy_step_count_after' => 0,
                'deduplicated_count' => 0,
                'phase_reclassified_count' => 0,
                'dependency_updates' => 0,
                'updated_count' => 0,
            ],
            'phase_review' => [],
            'steps' => [],
        ];
    }

    usort($allSteps, static fn(array $a, array $b): int => ((int)($a['step_order'] ?? 0) <=> (int)($b['step_order'] ?? 0)));

    $templateStepIds = [];
    foreach ($allSteps as $row) {
        $sid = (int)($row['id'] ?? 0);
        $order = (int)($row['step_order'] ?? 0);
        if ($sid > 0 && $order > 0 && $order <= $templateCount) {
            $templateStepIds[$sid] = true;
        }
    }

    $legacyRows = [];
    foreach ($allSteps as $row) {
        $sid = (int)($row['id'] ?? 0);
        if ($sid > 0 && !isset($templateStepIds[$sid])) {
            $legacyRows[] = $row;
        }
    }

    $legacyCountBefore = count($legacyRows);
    if ($legacyCountBefore === 0) {
        return [
            'summary' => [
                'project_id' => $projectId,
                'template_step_count' => $templateCount,
                'legacy_step_count_before' => 0,
                'legacy_step_count_after' => 0,
                'deduplicated_count' => 0,
                'phase_reclassified_count' => 0,
                'dependency_updates' => 0,
                'updated_count' => 0,
            ],
            'phase_review' => catn8_build_wizard_phase_review($allSteps),
            'steps' => catn8_build_wizard_steps_for_project($projectId),
        ];
    }

    $seenTitleKeys = [];
    $duplicateToKeeper = [];
    $legacySurvivors = [];
    foreach ($legacyRows as $row) {
        $sid = (int)($row['id'] ?? 0);
        if ($sid <= 0) {
            continue;
        }
        $titleKey = catn8_build_wizard_title_key((string)($row['title'] ?? ''));
        if ($titleKey === '') {
            $titleKey = 'legacy_step_' . $sid;
        }
        if (isset($seenTitleKeys[$titleKey])) {
            $duplicateToKeeper[$sid] = (int)$seenTitleKeys[$titleKey];
            continue;
        }
        $seenTitleKeys[$titleKey] = $sid;
        $legacySurvivors[$sid] = $row;
    }

    $deduplicatedCount = count($duplicateToKeeper);
    $phaseOrder = catn8_build_wizard_refine_phase_order();
    $phaseRank = [];
    foreach ($phaseOrder as $idx => $phaseKey) {
        $phaseRank[$phaseKey] = $idx;
    }

    $legacyMetaById = [];
    $phaseReclassifiedCount = 0;
    foreach ($legacySurvivors as $sid => $row) {
        $refinedPhase = catn8_build_wizard_refine_legacy_phase_key($row);
        $currentPhase = catn8_build_wizard_normalize_phase_key((string)($row['phase_key'] ?? 'general'));
        if ($refinedPhase !== $currentPhase) {
            $phaseReclassifiedCount++;
        }
        $legacyMetaById[$sid] = [
            'id' => $sid,
            'old_order' => (int)($row['step_order'] ?? 0),
            'phase_key' => $refinedPhase,
            'step_type' => catn8_build_wizard_step_type((string)($row['step_type'] ?? catn8_build_wizard_infer_step_type((string)($row['title'] ?? ''), $refinedPhase, !empty($row['permit_required']) ? 1 : 0))),
            'source_ref' => trim((string)($row['source_ref'] ?? '')),
        ];
    }

    uasort($legacyMetaById, static function (array $a, array $b) use ($phaseRank): int {
        $aRank = $phaseRank[$a['phase_key']] ?? 999;
        $bRank = $phaseRank[$b['phase_key']] ?? 999;
        if ($aRank !== $bRank) {
            return $aRank <=> $bRank;
        }
        if ($a['old_order'] !== $b['old_order']) {
            return $a['old_order'] <=> $b['old_order'];
        }
        return $a['id'] <=> $b['id'];
    });

    $templatePhaseLastStepId = [];
    foreach ($allSteps as $row) {
        $sid = (int)($row['id'] ?? 0);
        if ($sid <= 0 || !isset($templateStepIds[$sid])) {
            continue;
        }
        $phaseKey = catn8_build_wizard_normalize_phase_key((string)($row['phase_key'] ?? 'general'));
        $templatePhaseLastStepId[$phaseKey] = $sid;
    }

    $phaseGateway = [
        'design_preconstruction' => 'land_due_diligence',
        'dawson_county_permits' => 'design_preconstruction',
        'site_preparation' => 'dawson_county_permits',
        'foundation' => 'site_preparation',
        'framing_shell' => 'foundation',
        'mep_rough_in' => 'framing_shell',
        'interior_finishes' => 'mep_rough_in',
        'move_in' => 'interior_finishes',
        'inspections_closeout' => 'move_in',
    ];

    $newOrderByStepId = [];
    $newDepsByStepId = [];
    $lastByPhase = [];
    $phaseLastStepId = $templatePhaseLastStepId;
    $order = $templateCount + 1;
    foreach ($legacyMetaById as $sid => $meta) {
        $phaseKey = (string)$meta['phase_key'];
        $depIds = [];
        if (isset($lastByPhase[$phaseKey])) {
            $depIds[] = (int)$lastByPhase[$phaseKey];
        } elseif (isset($phaseGateway[$phaseKey])) {
            $gatewayPhase = $phaseGateway[$phaseKey];
            $gatewayId = (int)($phaseLastStepId[$gatewayPhase] ?? 0);
            if ($gatewayId > 0) {
                $depIds[] = $gatewayId;
            }
        }
        $depIds = array_values(array_unique(array_filter($depIds, static fn($id): bool => (int)$id > 0)));

        $newOrderByStepId[$sid] = $order;
        $newDepsByStepId[$sid] = $depIds;
        $lastByPhase[$phaseKey] = $sid;
        $phaseLastStepId[$phaseKey] = $sid;
        $order++;
    }

    $dependencyUpdates = 0;
    $updatedCount = 0;
    $refineTag = 'legacy_refined_' . gmdate('Ymd_His');

    Database::beginTransaction();
    try {
        // Avoid unique(project_id, step_order) collisions while resequencing legacy rows.
        Database::execute(
            'UPDATE build_wizard_steps SET step_order = step_order + 1000 WHERE project_id = ? AND step_order > ?',
            [$projectId, $templateCount]
        );

        if ($duplicateToKeeper) {
            foreach ($duplicateToKeeper as $duplicateId => $keeperId) {
                Database::execute(
                    'UPDATE build_wizard_documents SET step_id = ? WHERE project_id = ? AND step_id = ?',
                    [(int)$keeperId, $projectId, (int)$duplicateId]
                );
            }
        }

        $rowsForDeps = Database::queryAll(
            'SELECT id, depends_on_step_ids_json FROM build_wizard_steps WHERE project_id = ?',
            [$projectId]
        );
        foreach ($rowsForDeps as $row) {
            $sid = (int)($row['id'] ?? 0);
            if ($sid <= 0) {
                continue;
            }
            $deps = catn8_build_wizard_normalize_int_array(catn8_build_wizard_decode_json_array($row['depends_on_step_ids_json'] ?? null));
            $changed = false;
            $rewritten = [];
            foreach ($deps as $depId) {
                $nextDepId = (int)($duplicateToKeeper[$depId] ?? $depId);
                if ($nextDepId !== $depId) {
                    $changed = true;
                }
                if ($nextDepId > 0 && $nextDepId !== $sid) {
                    $rewritten[] = $nextDepId;
                }
            }
            $rewritten = array_values(array_unique($rewritten));
            if ($changed || $rewritten !== $deps) {
                Database::execute(
                    'UPDATE build_wizard_steps SET depends_on_step_ids_json = ? WHERE id = ?',
                    [$rewritten ? json_encode($rewritten, JSON_UNESCAPED_SLASHES) : null, $sid]
                );
                $dependencyUpdates++;
            }
        }

        if ($duplicateToKeeper) {
            $deleteIds = array_values(array_map('intval', array_keys($duplicateToKeeper)));
            $deleteIds = array_values(array_filter($deleteIds, static fn($id): bool => $id > 0));
            if ($deleteIds) {
                $placeholders = implode(',', array_fill(0, count($deleteIds), '?'));
                Database::execute(
                    'DELETE FROM build_wizard_steps WHERE project_id = ? AND id IN (' . $placeholders . ')',
                    array_merge([$projectId], $deleteIds)
                );
            }
        }

        foreach ($legacyMetaById as $sid => $meta) {
            $sourceRef = trim((string)($meta['source_ref'] ?? ''));
            if ($sourceRef !== '') {
                $sourceRef .= ' | ';
            }
            $sourceRef .= $refineTag;
            $depIds = $newDepsByStepId[$sid] ?? [];
            Database::execute(
                'UPDATE build_wizard_steps
                 SET step_order = ?, phase_key = ?, step_type = ?, depends_on_step_ids_json = ?, source_ref = ?
                 WHERE id = ? AND project_id = ?',
                [
                    (int)($newOrderByStepId[$sid] ?? 0),
                    (string)$meta['phase_key'],
                    (string)$meta['step_type'],
                    $depIds ? json_encode($depIds, JSON_UNESCAPED_SLASHES) : null,
                    $sourceRef,
                    (int)$sid,
                    $projectId,
                ]
            );
            $updatedCount++;
            $dependencyUpdates++;
        }

        Database::commit();
    } catch (Throwable $e) {
        if (Database::inTransaction()) {
            Database::rollBack();
        }
        throw $e;
    }

    $finalSteps = catn8_build_wizard_fetch_steps_minimal($projectId);
    $phaseReview = catn8_build_wizard_phase_review($finalSteps);

    return [
        'summary' => [
            'project_id' => $projectId,
            'template_step_count' => $templateCount,
            'legacy_step_count_before' => $legacyCountBefore,
            'legacy_step_count_after' => count($legacyMetaById),
            'deduplicated_count' => $deduplicatedCount,
            'phase_reclassified_count' => $phaseReclassifiedCount,
            'dependency_updates' => $dependencyUpdates,
            'updated_count' => $updatedCount,
        ],
        'phase_review' => $phaseReview,
        'steps' => catn8_build_wizard_steps_for_project($projectId),
    ];
}

try {
    catn8_build_wizard_tables_ensure();

    catn8_session_start();
    $viewerId = catn8_require_group_or_admin('build-wizard-users');

    $action = trim((string)($_GET['action'] ?? 'bootstrap'));

    if ($action === 'get_document') {
        catn8_require_method('GET');
        $documentId = isset($_GET['document_id']) ? (int)$_GET['document_id'] : 0;
        $download = ((int)($_GET['download'] ?? 0) === 1);
        $thumb = ((int)($_GET['thumb'] ?? 0) === 1);
        $doc = catn8_build_wizard_document_for_user($documentId, $viewerId);
        if (!$doc) {
            http_response_code(404);
            header('Content-Type: text/plain; charset=UTF-8');
            echo 'Document not found';
            exit;
        }

        if ($thumb) {
            $imageBlob = $doc['image_blob'] ?? null;
            if (is_string($imageBlob) && $imageBlob !== '') {
                $imageMime = trim((string)($doc['blob_mime_type'] ?? $doc['mime_type'] ?? 'image/jpeg'));
                if ($imageMime === '') {
                    $imageMime = 'image/jpeg';
                }
                header('Content-Type: ' . $imageMime);
                header('Content-Length: ' . strlen($imageBlob));
                header('Cache-Control: private, max-age=600');
                echo $imageBlob;
                exit;
            }

            $docMime = strtolower(trim((string)($doc['mime_type'] ?? '')));
            $fileBlob = $doc['file_blob'] ?? null;
            if (strpos($docMime, 'image/') === 0 && is_string($fileBlob) && $fileBlob !== '') {
                header('Content-Type: ' . $docMime);
                header('Content-Length: ' . strlen($fileBlob));
                header('Cache-Control: private, max-age=600');
                echo $fileBlob;
                exit;
            }

            if (catn8_build_wizard_is_pdf_document($doc)) {
                $cachePath = catn8_build_wizard_pdf_thumb_cache_path((int)($doc['id'] ?? 0), (int)($doc['file_size_bytes'] ?? 0));
                if ($cachePath !== '' && is_file($cachePath)) {
                    $cached = file_get_contents($cachePath);
                    if (is_string($cached) && $cached !== '') {
                        header('Content-Type: image/png');
                        header('Content-Length: ' . strlen($cached));
                        header('Cache-Control: private, max-age=600');
                        echo $cached;
                        exit;
                    }
                }

                $pdfThumb = null;
                if (is_string($fileBlob) && $fileBlob !== '') {
                    $pdfThumb = catn8_build_wizard_generate_pdf_thumb_from_blob($fileBlob);
                }
                if (!is_string($pdfThumb) || $pdfThumb === '') {
                    $path = catn8_build_wizard_resolve_document_path((string)($doc['storage_path'] ?? ''));
                    if ($path === '') {
                        $sourcePath = catn8_build_wizard_find_source_file_path_for_name((string)($doc['original_name'] ?? ''));
                        if ($sourcePath !== '') {
                            $recoveredBytes = file_get_contents($sourcePath);
                            if (is_string($recoveredBytes) && $recoveredBytes !== '') {
                                $recoveredMime = trim((string)($doc['mime_type'] ?? 'application/pdf'));
                                if ($recoveredMime === '') {
                                    $recoveredMime = 'application/pdf';
                                }
                                catn8_build_wizard_upsert_document_blob((int)($doc['id'] ?? 0), $recoveredMime, $recoveredBytes);
                                $pdfThumb = catn8_build_wizard_generate_pdf_thumb_from_blob($recoveredBytes);
                            }
                        }
                    } else {
                        $pdfThumb = catn8_build_wizard_generate_pdf_thumb_from_path($path);
                    }
                }

                if (is_string($pdfThumb) && $pdfThumb !== '') {
                    if ($cachePath !== '') {
                        file_put_contents($cachePath, $pdfThumb);
                    }
                    header('Content-Type: image/png');
                    header('Content-Length: ' . strlen($pdfThumb));
                    header('Cache-Control: private, max-age=600');
                    echo $pdfThumb;
                    exit;
                }
            }

            catn8_build_wizard_send_thumb_placeholder(catn8_build_wizard_document_thumb_label($doc));
            exit;
        }

        $blob = $doc['file_blob'] ?? null;
        if (is_string($blob) && $blob !== '') {
            $mime = trim((string)($doc['file_blob_mime_type'] ?? $doc['mime_type'] ?? 'application/octet-stream'));
            if ($mime === '') {
                $mime = 'application/octet-stream';
            }
            $originalName = trim((string)($doc['original_name'] ?? 'download'));
            if ($originalName === '') {
                $originalName = 'download';
            }
            $safeName = str_replace(["\r", "\n", '"'], [' ', ' ', "'"], $originalName);
            header('Content-Type: ' . $mime);
            if ($download) {
                header('Content-Disposition: attachment; filename="' . $safeName . '"');
            }
            header('Content-Length: ' . strlen($blob));
            header('Cache-Control: private, max-age=600');
            echo $blob;
            exit;
        }

        $blob = $doc['image_blob'] ?? null;
        if (is_string($blob) && $blob !== '') {
            $mime = trim((string)($doc['blob_mime_type'] ?? $doc['mime_type'] ?? 'application/octet-stream'));
            if ($mime === '') {
                $mime = 'application/octet-stream';
            }
            $originalName = trim((string)($doc['original_name'] ?? 'download'));
            if ($originalName === '') {
                $originalName = 'download';
            }
            $safeName = str_replace(["\r", "\n", '"'], [' ', ' ', "'"], $originalName);
            header('Content-Type: ' . $mime);
            if ($download) {
                header('Content-Disposition: attachment; filename="' . $safeName . '"');
            }
            header('Content-Length: ' . strlen($blob));
            header('Cache-Control: private, max-age=600');
            echo $blob;
            exit;
        }

        $path = catn8_build_wizard_resolve_document_path((string)($doc['storage_path'] ?? ''));
        if ($path === '') {
            $sourcePath = catn8_build_wizard_find_source_file_path_for_name((string)($doc['original_name'] ?? ''));
            if ($sourcePath !== '') {
                $recoveredBytes = @file_get_contents($sourcePath);
                if (is_string($recoveredBytes) && $recoveredBytes !== '') {
                    $recoveredMime = trim((string)($doc['mime_type'] ?? 'application/octet-stream'));
                    if ($recoveredMime === '') {
                        $recoveredMime = 'application/octet-stream';
                    }
                    catn8_build_wizard_upsert_document_blob((int)($doc['id'] ?? 0), $recoveredMime, $recoveredBytes);
                    $safeName = str_replace(["\r", "\n", '"'], [' ', ' ', "'"], trim((string)($doc['original_name'] ?? 'download')) ?: 'download');
                    header('Content-Type: ' . $recoveredMime);
                    if ($download) {
                        header('Content-Disposition: attachment; filename="' . $safeName . '"');
                    }
                    header('Content-Length: ' . strlen($recoveredBytes));
                    header('Cache-Control: private, max-age=600');
                    echo $recoveredBytes;
                    exit;
                }
            }
        }
        if ($path === '') {
            http_response_code(404);
            header('Content-Type: text/plain; charset=UTF-8');
            echo 'Document file missing';
            exit;
        }

        $mime = trim((string)($doc['mime_type'] ?? 'application/octet-stream'));
        if ($mime === '') {
            $mime = 'application/octet-stream';
        }
        $originalName = trim((string)($doc['original_name'] ?? basename($path)));
        if ($originalName === '') {
            $originalName = basename($path);
        }
        $safeName = str_replace(["\r", "\n", '"'], [' ', ' ', "'"], $originalName);
        header('Content-Type: ' . $mime);
        if ($download) {
            header('Content-Disposition: attachment; filename="' . $safeName . '"');
        }
        header('Content-Length: ' . filesize($path));
        header('Cache-Control: private, max-age=600');
        readfile($path);
        exit;
    }

    if ($action === 'bootstrap') {
        catn8_require_method('GET');

        $requestedProjectId = isset($_GET['project_id']) ? (int)$_GET['project_id'] : null;
        $project = catn8_build_wizard_get_or_create_project($viewerId, $requestedProjectId);
        $projectId = (int)($project['id'] ?? 0);
        if ($projectId <= 0) {
            throw new RuntimeException('Build wizard project missing id');
        }

        $project = Database::queryOne('SELECT * FROM build_wizard_projects WHERE id = ?', [$projectId]) ?: $project;

        catn8_json_response([
            'success' => true,
            'selected_project_id' => $projectId,
            'projects' => catn8_build_wizard_list_projects($viewerId),
            'project' => $project,
            'steps' => catn8_build_wizard_steps_for_project($projectId),
            'documents' => catn8_build_wizard_documents_for_project($projectId),
            'contacts' => catn8_build_wizard_contacts_for_project($projectId, $viewerId),
            'contact_assignments' => catn8_build_wizard_contact_assignments_for_project($projectId, $viewerId),
            'phase_date_ranges' => catn8_build_wizard_phase_date_ranges_for_project($projectId),
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

        $blueprintDocumentId = null;
        if (array_key_exists('blueprint_document_id', $body)) {
            $nextBlueprintId = (int)($body['blueprint_document_id'] ?? 0);
            if ($nextBlueprintId > 0) {
                $docRow = Database::queryOne(
                    'SELECT id, kind FROM build_wizard_documents WHERE id = ? AND project_id = ? LIMIT 1',
                    [$nextBlueprintId, $projectId]
                );
                if (!$docRow || strtolower(trim((string)($docRow['kind'] ?? ''))) !== 'blueprint') {
                    throw new RuntimeException('Invalid blueprint_document_id for this project');
                }
                $blueprintDocumentId = $nextBlueprintId;
            }
        } else {
            $existingBlueprint = Database::queryOne('SELECT blueprint_document_id FROM build_wizard_projects WHERE id = ? LIMIT 1', [$projectId]);
            $blueprintDocumentId = isset($existingBlueprint['blueprint_document_id']) && $existingBlueprint['blueprint_document_id'] !== null
                ? (int)$existingBlueprint['blueprint_document_id']
                : null;
        }

        $primaryPhotoDocumentId = null;
        if (array_key_exists('primary_photo_document_id', $body)) {
            $nextPhotoId = (int)($body['primary_photo_document_id'] ?? 0);
            if ($nextPhotoId > 0) {
                $docRow = Database::queryOne(
                    'SELECT id, kind, mime_type FROM build_wizard_documents WHERE id = ? AND project_id = ? LIMIT 1',
                    [$nextPhotoId, $projectId]
                );
                if (!$docRow) {
                    throw new RuntimeException('Invalid primary_photo_document_id for this project');
                }
                $docKind = strtolower(trim((string)($docRow['kind'] ?? '')));
                $docMime = strtolower(trim((string)($docRow['mime_type'] ?? '')));
                $allowedKinds = ['photo', 'site_photo', 'home_photo', 'progress_photo'];
                if (!in_array($docKind, $allowedKinds, true) || strpos($docMime, 'image/') !== 0) {
                    throw new RuntimeException('Primary photo must be an image from a photo kind');
                }
                $primaryPhotoDocumentId = $nextPhotoId;
            }
        } else {
            $existingPhoto = Database::queryOne('SELECT primary_photo_document_id FROM build_wizard_projects WHERE id = ? LIMIT 1', [$projectId]);
            $primaryPhotoDocumentId = isset($existingPhoto['primary_photo_document_id']) && $existingPhoto['primary_photo_document_id'] !== null
                ? (int)$existingPhoto['primary_photo_document_id']
                : null;
        }

        Database::execute(
            'UPDATE build_wizard_projects
             SET title = ?, status = ?, square_feet = ?, home_style = ?, home_type = ?, room_count = ?, bedrooms_count = ?, kitchens_count = ?, bathroom_count = ?, stories_count = ?, lot_size_sqft = ?, garage_spaces = ?, parking_spaces = ?, year_built = ?, hoa_fee_monthly = ?, lot_address = ?, target_start_date = ?, target_completion_date = ?, wizard_notes = ?, blueprint_document_id = ?, primary_photo_document_id = ?
             WHERE id = ?',
            [
                trim((string)($body['title'] ?? 'Build Wizard Project')),
                $status,
                isset($body['square_feet']) && is_numeric($body['square_feet']) ? (int)$body['square_feet'] : null,
                trim((string)($body['home_style'] ?? '')),
                trim((string)($body['home_type'] ?? '')),
                isset($body['room_count']) && is_numeric($body['room_count']) ? (int)$body['room_count'] : null,
                isset($body['bedrooms_count']) && is_numeric($body['bedrooms_count']) ? (int)$body['bedrooms_count'] : null,
                isset($body['kitchens_count']) && is_numeric($body['kitchens_count']) ? (int)$body['kitchens_count'] : null,
                isset($body['bathroom_count']) && is_numeric($body['bathroom_count']) ? (int)$body['bathroom_count'] : null,
                isset($body['stories_count']) && is_numeric($body['stories_count']) ? (int)$body['stories_count'] : null,
                isset($body['lot_size_sqft']) && is_numeric($body['lot_size_sqft']) ? (int)$body['lot_size_sqft'] : null,
                isset($body['garage_spaces']) && is_numeric($body['garage_spaces']) ? (int)$body['garage_spaces'] : null,
                isset($body['parking_spaces']) && is_numeric($body['parking_spaces']) ? (int)$body['parking_spaces'] : null,
                isset($body['year_built']) && is_numeric($body['year_built']) ? (int)$body['year_built'] : null,
                catn8_build_wizard_to_decimal_or_null($body['hoa_fee_monthly'] ?? null),
                trim((string)($body['lot_address'] ?? '')),
                catn8_build_wizard_parse_date_or_null($body['target_start_date'] ?? null),
                catn8_build_wizard_parse_date_or_null($body['target_completion_date'] ?? null),
                trim((string)($body['wizard_notes'] ?? '')),
                $blueprintDocumentId,
                $primaryPhotoDocumentId,
                $projectId,
            ]
        );

        $project = Database::queryOne('SELECT * FROM build_wizard_projects WHERE id = ?', [$projectId]);
        catn8_json_response(['success' => true, 'project' => $project]);
    }

    if ($action === 'save_phase_date_range') {
        catn8_require_method('POST');

        $body = catn8_read_json_body();
        $projectId = isset($body['project_id']) ? (int)$body['project_id'] : 0;
        if ($projectId <= 0) {
            throw new RuntimeException('Missing project_id');
        }
        catn8_build_wizard_require_project_access($projectId, $viewerId);

        $phaseTab = catn8_build_wizard_normalize_phase_tab($body['phase_tab'] ?? '');
        if ($phaseTab === '') {
            throw new RuntimeException('Invalid phase_tab');
        }

        $startDate = catn8_build_wizard_parse_date_or_null($body['start_date'] ?? null);
        $endDate = catn8_build_wizard_parse_date_or_null($body['end_date'] ?? null);
        if ($startDate !== null && $endDate !== null && strcmp($startDate, $endDate) > 0) {
            throw new RuntimeException('Phase start_date must be on or before end_date');
        }

        if ($startDate === null && $endDate === null) {
            Database::execute(
                'DELETE FROM build_wizard_phase_date_ranges WHERE project_id = ? AND phase_tab = ? LIMIT 1',
                [$projectId, $phaseTab]
            );
        } else {
            Database::execute(
                'INSERT INTO build_wizard_phase_date_ranges (project_id, phase_tab, start_date, end_date)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE start_date = VALUES(start_date), end_date = VALUES(end_date)',
                [$projectId, $phaseTab, $startDate, $endDate]
            );
        }

        catn8_json_response([
            'success' => true,
            'phase_date_ranges' => catn8_build_wizard_phase_date_ranges_for_project($projectId),
        ]);
    }

    if ($action === 'delete_project') {
        catn8_require_method('POST');

        $body = catn8_read_json_body();
        $projectId = isset($body['project_id']) ? (int)$body['project_id'] : 0;
        if ($projectId <= 0) {
            throw new RuntimeException('Missing project_id');
        }

        catn8_build_wizard_require_project_access($projectId, $viewerId);
        $docRows = Database::queryAll('SELECT storage_path FROM build_wizard_documents WHERE project_id = ?', [$projectId]);

        $paths = [];
        foreach ($docRows as $row) {
            $storagePath = trim((string)($row['storage_path'] ?? ''));
            if ($storagePath !== '') {
                $paths[$storagePath] = true;
            }
        }

        Database::beginTransaction();
        try {
            Database::execute('DELETE FROM build_wizard_projects WHERE id = ? AND owner_user_id = ? LIMIT 1', [$projectId, $viewerId]);
            Database::commit();
        } catch (Throwable $e) {
            if (Database::inTransaction()) {
                Database::rollBack();
            }
            throw $e;
        }

        $deletedFileCount = 0;
        $fileDeleteErrorCount = 0;
        $uploadRoot = realpath(dirname(__DIR__) . '/images/build-wizard');
        if ($uploadRoot !== false) {
            foreach (array_keys($paths) as $storagePath) {
                if (!is_file($storagePath)) {
                    continue;
                }
                $realStoragePath = realpath($storagePath);
                if (
                    $realStoragePath === false
                    || !str_starts_with($realStoragePath, $uploadRoot . DIRECTORY_SEPARATOR)
                ) {
                    continue;
                }
                if (@unlink($realStoragePath)) {
                    $deletedFileCount++;
                } else {
                    $fileDeleteErrorCount++;
                }
            }
        }

        $projects = catn8_build_wizard_list_projects($viewerId);
        $selectedProjectId = (int)($projects[0]['id'] ?? 0);

        catn8_json_response([
            'success' => true,
            'deleted_project_id' => $projectId,
            'deleted_file_count' => $deletedFileCount,
            'file_delete_error_count' => $fileDeleteErrorCount,
            'projects' => $projects,
            'selected_project_id' => $selectedProjectId > 0 ? $selectedProjectId : null,
        ]);
    }

    if ($action === 'update_step') {
        catn8_require_method('POST');

        $body = catn8_read_json_body();
        $stepId = isset($body['step_id']) ? (int)$body['step_id'] : 0;
        if ($stepId <= 0) {
            throw new RuntimeException('Missing step_id');
        }

        $stepRow = Database::queryOne(
            'SELECT s.id, s.project_id, s.step_type, s.expected_start_date, s.expected_end_date,
                    s.phase_key, s.parent_step_id, s.depends_on_step_ids_json, s.title, s.description,
                    s.permit_required, s.permit_document_id, s.permit_name, s.permit_authority, s.permit_status, s.permit_application_url,
                    s.purchase_category, s.purchase_brand, s.purchase_model, s.purchase_sku, s.purchase_unit, s.purchase_qty, s.purchase_unit_price, s.purchase_vendor, s.purchase_url,
                    s.expected_duration_days, s.estimated_cost, s.actual_cost, s.ai_estimated_fields_json, s.is_completed, s.completed_at, s.source_ref, s.step_order
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
        if (array_key_exists('parent_step_id', $body)) {
            $validatedParentStepId = catn8_build_wizard_validate_parent_step((int)$stepRow['project_id'], $stepId, $body['parent_step_id']);
            $updates[] = 'parent_step_id = ?';
            $params[] = $validatedParentStepId;
        }
        if (array_key_exists('depends_on_step_ids', $body)) {
            $candidateIds = catn8_build_wizard_normalize_int_array($body['depends_on_step_ids']);
            if ($candidateIds) {
                $placeholders = implode(',', array_fill(0, count($candidateIds), '?'));
                $validatedRows = Database::queryAll(
                    'SELECT id FROM build_wizard_steps WHERE project_id = ? AND id IN (' . $placeholders . ')',
                    array_merge([(int)$stepRow['project_id']], $candidateIds)
                );
                $valid = [];
                foreach ($validatedRows as $vr) {
                    $valid[] = (int)($vr['id'] ?? 0);
                }
                $valid = array_values(array_filter(array_unique($valid), static fn($id): bool => $id > 0 && $id !== $stepId));
                $updates[] = 'depends_on_step_ids_json = ?';
                $params[] = $valid ? json_encode($valid, JSON_UNESCAPED_SLASHES) : null;
            } else {
                $updates[] = 'depends_on_step_ids_json = NULL';
            }
        }
        if (array_key_exists('step_type', $body)) {
            $updates[] = 'step_type = ?';
            $params[] = catn8_build_wizard_step_type((string)($body['step_type'] ?? 'construction'));
        }
        $effectiveStepType = array_key_exists('step_type', $body)
            ? catn8_build_wizard_step_type((string)($body['step_type'] ?? 'construction'))
            : catn8_build_wizard_step_type((string)($stepRow['step_type'] ?? 'construction'));

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
            if (((int)$body['permit_required'] !== 1)) {
                $updates[] = 'permit_document_id = NULL';
                $updates[] = 'permit_name = NULL';
                $updates[] = 'permit_authority = NULL';
                $updates[] = 'permit_status = NULL';
                $updates[] = 'permit_application_url = NULL';
            }
        }

        if (array_key_exists('permit_document_id', $body)) {
            $permitDocumentId = (int)($body['permit_document_id'] ?? 0);
            if ($permitDocumentId > 0) {
                $docRow = Database::queryOne(
                    'SELECT id, kind
                     FROM build_wizard_documents
                     WHERE id = ? AND project_id = ?
                     LIMIT 1',
                    [$permitDocumentId, (int)$stepRow['project_id']]
                );
                if (!$docRow || strtolower(trim((string)($docRow['kind'] ?? ''))) !== 'permit') {
                    throw new RuntimeException('Invalid permit_document_id for this project');
                }
                $updates[] = 'permit_document_id = ?';
                $params[] = $permitDocumentId;
            } else {
                $updates[] = 'permit_document_id = NULL';
            }
        }

        if (array_key_exists('permit_name', $body)) {
            $permitName = trim((string)($body['permit_name'] ?? ''));
            $updates[] = 'permit_name = ?';
            $params[] = ($permitName !== '' ? $permitName : null);
        }
        if (array_key_exists('permit_authority', $body)) {
            $updates[] = 'permit_authority = ?';
            $params[] = catn8_build_wizard_text_or_null($body['permit_authority'] ?? null, 191);
        }
        if (array_key_exists('permit_status', $body)) {
            $updates[] = 'permit_status = ?';
            $params[] = catn8_build_wizard_text_or_null($body['permit_status'] ?? null, 32);
        }
        if (array_key_exists('permit_application_url', $body)) {
            $updates[] = 'permit_application_url = ?';
            $params[] = catn8_build_wizard_text_or_null($body['permit_application_url'] ?? null, 500);
        }

        if ($effectiveStepType === 'permit') {
            $updates[] = 'permit_required = 1';
        } else {
            $updates[] = 'permit_required = 0';
            $updates[] = 'permit_document_id = NULL';
            $updates[] = 'permit_name = NULL';
            $updates[] = 'permit_authority = NULL';
            $updates[] = 'permit_status = NULL';
            $updates[] = 'permit_application_url = NULL';
        }
        if (array_key_exists('purchase_category', $body)) {
            $updates[] = 'purchase_category = ?';
            $params[] = catn8_build_wizard_text_or_null($body['purchase_category'] ?? null, 120);
        }
        if (array_key_exists('purchase_brand', $body)) {
            $updates[] = 'purchase_brand = ?';
            $params[] = catn8_build_wizard_text_or_null($body['purchase_brand'] ?? null, 120);
        }
        if (array_key_exists('purchase_model', $body)) {
            $updates[] = 'purchase_model = ?';
            $params[] = catn8_build_wizard_text_or_null($body['purchase_model'] ?? null, 191);
        }
        if (array_key_exists('purchase_sku', $body)) {
            $updates[] = 'purchase_sku = ?';
            $params[] = catn8_build_wizard_text_or_null($body['purchase_sku'] ?? null, 120);
        }
        if (array_key_exists('purchase_unit', $body)) {
            $updates[] = 'purchase_unit = ?';
            $params[] = catn8_build_wizard_text_or_null($body['purchase_unit'] ?? null, 32);
        }
        if (array_key_exists('purchase_qty', $body)) {
            $updates[] = 'purchase_qty = ?';
            $params[] = catn8_build_wizard_to_decimal_or_null($body['purchase_qty'] ?? null);
        }
        if (array_key_exists('purchase_unit_price', $body)) {
            $updates[] = 'purchase_unit_price = ?';
            $params[] = catn8_build_wizard_to_decimal_or_null($body['purchase_unit_price'] ?? null);
        }
        if (array_key_exists('purchase_vendor', $body)) {
            $updates[] = 'purchase_vendor = ?';
            $params[] = catn8_build_wizard_text_or_null($body['purchase_vendor'] ?? null, 191);
        }
        if (array_key_exists('purchase_url', $body)) {
            $updates[] = 'purchase_url = ?';
            $params[] = catn8_build_wizard_text_or_null($body['purchase_url'] ?? null, 500);
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
        if (array_key_exists('ai_estimated_fields', $body)) {
            $fields = catn8_build_wizard_normalize_ai_estimated_fields($body['ai_estimated_fields'] ?? []);
            $updates[] = 'ai_estimated_fields_json = ?';
            $params[] = $fields ? json_encode($fields, JSON_UNESCAPED_SLASHES) : null;
        }

        if (array_key_exists('source_ref', $body)) {
            $sourceRef = trim((string)($body['source_ref'] ?? ''));
            $updates[] = 'source_ref = ?';
            $params[] = ($sourceRef !== '' ? $sourceRef : null);
        }

        if (array_key_exists('is_completed', $body)) {
            $isCompleted = ((int)$body['is_completed'] === 1) ? 1 : 0;
            if ($isCompleted === 1 && catn8_build_wizard_has_incomplete_descendants((int)$stepRow['project_id'], $stepId)) {
                throw new RuntimeException('Complete all child steps before completing this parent step');
            }
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

        $nextExpectedStartDate = array_key_exists('expected_start_date', $body)
            ? catn8_build_wizard_parse_date_or_null($body['expected_start_date'] ?? null)
            : catn8_build_wizard_parse_date_or_null($stepRow['expected_start_date'] ?? null);
        $nextExpectedEndDate = array_key_exists('expected_end_date', $body)
            ? catn8_build_wizard_parse_date_or_null($body['expected_end_date'] ?? null)
            : catn8_build_wizard_parse_date_or_null($stepRow['expected_end_date'] ?? null);
        catn8_build_wizard_validate_child_dates_with_parent((int)$stepRow['project_id'], $stepId, $nextExpectedStartDate, $nextExpectedEndDate);
        $autoReorderByTimeline = array_key_exists('expected_start_date', $body) || array_key_exists('expected_end_date', $body);
        $autoReordered = false;

        Database::beginTransaction();
        try {
            $beforeStep = catn8_build_wizard_step_by_id($stepId);
            $params[] = $stepId;
            Database::execute('UPDATE build_wizard_steps SET ' . implode(', ', $updates) . ' WHERE id = ?', $params);

            if ($autoReorderByTimeline) {
                $phaseRow = Database::queryOne(
                    'SELECT phase_key FROM build_wizard_steps WHERE id = ? LIMIT 1',
                    [$stepId]
                );
                $phaseKey = catn8_build_wizard_normalize_phase_key((string)($phaseRow['phase_key'] ?? 'general'));
                $autoReordered = catn8_build_wizard_reorder_phase_steps_by_timeline((int)$stepRow['project_id'], $phaseKey);
            }

            $step = catn8_build_wizard_step_by_id($stepId);
            if (!$step) {
                throw new RuntimeException('Step not found after update');
            }

            $changes = catn8_build_wizard_step_change_payload($beforeStep, $step);
            if ($changes) {
                catn8_build_wizard_insert_step_audit_log((int)$stepRow['project_id'], $stepId, 'updated', $viewerId, $changes);
                $step = catn8_build_wizard_step_by_id($stepId) ?: $step;
            }

            $response = ['success' => true, 'step' => $step];
            if ($autoReordered) {
                $response['steps'] = catn8_build_wizard_steps_for_project((int)$stepRow['project_id']);
            }

            Database::commit();
            catn8_json_response($response);
        } catch (Throwable $e) {
            if (Database::inTransaction()) {
                Database::rollBack();
            }
            throw $e;
        }
    }

    if ($action === 'find_purchase_options') {
        catn8_require_method('POST');

        $body = catn8_read_json_body();
        $stepId = isset($body['step_id']) ? (int)$body['step_id'] : 0;
        if ($stepId <= 0) {
            throw new RuntimeException('Missing step_id');
        }

        $step = catn8_build_wizard_step_for_owner($stepId, $viewerId);
        if (!$step) {
            throw new RuntimeException('Step not found or not authorized');
        }

        $stepType = catn8_build_wizard_step_type((string)($step['step_type'] ?? ''));
        if ($stepType !== 'purchase') {
            throw new RuntimeException('Find is only available for purchase steps');
        }

        $providedUrl = catn8_build_wizard_safe_external_url((string)($body['product_url'] ?? ($step['purchase_url'] ?? '')));
        $urlDetails = null;
        if ($providedUrl !== null) {
            $html = catn8_build_wizard_http_get_text($providedUrl, 15);
            if ($html !== '') {
                $title = catn8_build_wizard_extract_html_title($html);
                $text = catn8_build_wizard_html_to_text($html, 4000);
                $brandGuess = null;
                if (is_string($text) && preg_match('/\b(Brand|Manufacturer)\b[:\s-]{1,8}([A-Za-z0-9 ._-]{2,50})/i', $text, $bm) && isset($bm[2])) {
                    $brandGuess = trim((string)$bm[2]);
                }
                $priceGuess = null;
                if (preg_match('/\\$\\s*([0-9]{1,5}(?:\\.[0-9]{2})?)/', $text, $pm) && isset($pm[1]) && is_numeric($pm[1])) {
                    $priceGuess = (float)$pm[1];
                }
                $urlDetails = [
                    'title' => $title !== '' ? $title : (string)($step['title'] ?? ''),
                    'url' => $providedUrl,
                    'brand' => $brandGuess,
                    'model' => catn8_build_wizard_text_or_null((string)($step['purchase_model'] ?? ''), 191),
                    'vendor' => parse_url($providedUrl, PHP_URL_HOST) ?: null,
                    'unit_price' => $priceGuess,
                    'summary' => substr($text, 0, 280),
                ];

                Database::execute(
                    'UPDATE build_wizard_steps
                     SET purchase_url = COALESCE(NULLIF(?, \'\'), purchase_url),
                         purchase_brand = COALESCE(NULLIF(?, \'\'), purchase_brand),
                         purchase_vendor = COALESCE(NULLIF(?, \'\'), purchase_vendor),
                         purchase_unit_price = COALESCE(?, purchase_unit_price)
                     WHERE id = ?',
                    [
                        $providedUrl,
                        (string)($urlDetails['brand'] ?? ''),
                        (string)($urlDetails['vendor'] ?? ''),
                        (isset($urlDetails['unit_price']) && is_numeric($urlDetails['unit_price'])) ? catn8_build_wizard_to_decimal_or_null($urlDetails['unit_price']) : null,
                        $stepId,
                    ]
                );
            }
        }

        $queryParts = [
            (string)($step['title'] ?? ''),
            (string)($step['purchase_category'] ?? ''),
            (string)($step['purchase_brand'] ?? ''),
            (string)($step['purchase_model'] ?? ''),
            (string)($step['purchase_sku'] ?? ''),
            (string)($step['description'] ?? ''),
        ];
        if ($urlDetails && !empty($urlDetails['title'])) {
            $queryParts[] = (string)$urlDetails['title'];
        }
        $query = trim(preg_replace('/\s+/', ' ', implode(' ', array_filter($queryParts, static fn($x) => trim((string)$x) !== ''))) ?? '');
        if ($query === '') {
            $query = 'home building material purchase';
        }

        $rawOptions = catn8_build_wizard_search_shopping_options($query . ' buy', 8);
        $options = [];
        if (is_array($urlDetails)) {
            $options[] = [
                'title' => (string)($urlDetails['title'] ?? ''),
                'url' => (string)($urlDetails['url'] ?? ''),
                'vendor' => $urlDetails['vendor'] ?? null,
                'unit_price' => $urlDetails['unit_price'] ?? null,
                'summary' => (string)($urlDetails['summary'] ?? 'Extracted from provided URL'),
                'source' => 'provided_url',
            ];
        }
        foreach ($rawOptions as $opt) {
            if (!is_array($opt)) {
                continue;
            }
            $u = catn8_build_wizard_safe_external_url((string)($opt['url'] ?? ''));
            if ($u === null) {
                continue;
            }
            $title = trim((string)($opt['title'] ?? ''));
            if ($title === '') {
                continue;
            }
            $dup = false;
            foreach ($options as $e) {
                if (isset($e['url']) && (string)$e['url'] === $u) {
                    $dup = true;
                    break;
                }
            }
            if ($dup) {
                continue;
            }
            $options[] = [
                'title' => $title,
                'url' => $u,
                'vendor' => parse_url($u, PHP_URL_HOST) ?: null,
                'unit_price' => catn8_build_wizard_extract_price_guess(trim((string)($title . ' ' . ((string)($opt['snippet'] ?? ''))))),
                'summary' => (string)($opt['snippet'] ?? ''),
                'source' => 'web_search',
            ];
            if (count($options) >= 10) {
                break;
            }
        }

        $tieredOptions = catn8_build_wizard_apply_option_tiers($options);

        catn8_json_response([
            'success' => true,
            'step_id' => $stepId,
            'step_type' => $stepType,
            'query' => $query,
            'options' => array_slice($tieredOptions, 0, 3),
            'step' => catn8_build_wizard_step_by_id($stepId),
        ]);
    }

    if ($action === 'add_step') {
        catn8_require_method('POST');

        $body = catn8_read_json_body();
        $projectId = isset($body['project_id']) ? (int)$body['project_id'] : 0;
        catn8_build_wizard_require_project_access($projectId, $viewerId);

        $phaseKey = catn8_build_wizard_normalize_phase_key($body['phase_key'] ?? 'general');
        $title = trim((string)($body['title'] ?? ''));
        if ($title === '') {
            $title = 'New Step';
        }

        $permitRequired = ((int)($body['permit_required'] ?? 0) === 1) ? 1 : 0;
        $description = trim((string)($body['description'] ?? ''));
        $stepType = catn8_build_wizard_step_type((string)($body['step_type'] ?? catn8_build_wizard_infer_step_type($title, $phaseKey, $permitRequired)));
        $permitName = trim((string)($body['permit_name'] ?? ''));
        $permitDocumentId = (int)($body['permit_document_id'] ?? 0);
        if ($stepType === 'permit') {
            $permitRequired = 1;
        } else {
            $permitRequired = 0;
            $permitDocumentId = 0;
            $permitName = '';
        }
        if ($permitDocumentId > 0) {
            $permitDocRow = Database::queryOne(
                'SELECT id, kind
                 FROM build_wizard_documents
                 WHERE id = ? AND project_id = ?
                 LIMIT 1',
                [$permitDocumentId, $projectId]
            );
            if (!$permitDocRow || strtolower(trim((string)($permitDocRow['kind'] ?? ''))) !== 'permit') {
                throw new RuntimeException('Invalid permit_document_id for this project');
            }
        }
        $duration = (isset($body['expected_duration_days']) && is_numeric($body['expected_duration_days']))
            ? (int)$body['expected_duration_days']
            : null;
        if ($duration !== null && ($duration < 1 || $duration > 3650)) {
            $duration = null;
        }
        $dependsOnStepIds = catn8_build_wizard_normalize_int_array($body['depends_on_step_ids'] ?? []);
        if ($dependsOnStepIds) {
            $placeholders = implode(',', array_fill(0, count($dependsOnStepIds), '?'));
            $validRows = Database::queryAll(
                'SELECT id FROM build_wizard_steps WHERE project_id = ? AND id IN (' . $placeholders . ')',
                array_merge([$projectId], $dependsOnStepIds)
            );
            $validDepIds = [];
            foreach ($validRows as $vr) {
                $validDepIds[] = (int)($vr['id'] ?? 0);
            }
            $dependsOnStepIds = array_values(array_filter(array_unique($validDepIds), static fn($n): bool => $n > 0));
        }

        $maxOrderRow = Database::queryOne('SELECT MAX(step_order) AS max_order FROM build_wizard_steps WHERE project_id = ?', [$projectId]);
        $nextOrder = (int)($maxOrderRow['max_order'] ?? 0) + 1;

        Database::execute(
            'INSERT INTO build_wizard_steps
                (project_id, step_order, phase_key, depends_on_step_ids_json, step_type, title, description, permit_required, permit_document_id, permit_name, permit_authority, permit_status, permit_application_url,
                 purchase_category, purchase_brand, purchase_model, purchase_sku, purchase_unit, purchase_qty, purchase_unit_price, purchase_vendor, purchase_url,
                 expected_start_date, expected_end_date, expected_duration_days, estimated_cost, actual_cost, ai_estimated_fields_json, is_completed, completed_at, ai_generated, source_ref)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 0, NULL, 0, ?)',
            [
                $projectId,
                $nextOrder,
                $phaseKey,
                $dependsOnStepIds ? json_encode($dependsOnStepIds, JSON_UNESCAPED_SLASHES) : null,
                $stepType,
                $title,
                $description,
                $permitRequired,
                ($permitDocumentId > 0 ? $permitDocumentId : null),
                ($permitName !== '' ? $permitName : null),
                catn8_build_wizard_text_or_null($body['permit_authority'] ?? null, 191),
                catn8_build_wizard_text_or_null($body['permit_status'] ?? null, 32),
                catn8_build_wizard_text_or_null($body['permit_application_url'] ?? null, 500),
                catn8_build_wizard_text_or_null($body['purchase_category'] ?? null, 120),
                catn8_build_wizard_text_or_null($body['purchase_brand'] ?? null, 120),
                catn8_build_wizard_text_or_null($body['purchase_model'] ?? null, 191),
                catn8_build_wizard_text_or_null($body['purchase_sku'] ?? null, 120),
                catn8_build_wizard_text_or_null($body['purchase_unit'] ?? null, 32),
                catn8_build_wizard_to_decimal_or_null($body['purchase_qty'] ?? null),
                catn8_build_wizard_to_decimal_or_null($body['purchase_unit_price'] ?? null),
                catn8_build_wizard_text_or_null($body['purchase_vendor'] ?? null, 191),
                catn8_build_wizard_text_or_null($body['purchase_url'] ?? null, 500),
                catn8_build_wizard_parse_date_or_null($body['expected_start_date'] ?? null),
                catn8_build_wizard_parse_date_or_null($body['expected_end_date'] ?? null),
                $duration,
                catn8_build_wizard_to_decimal_or_null($body['estimated_cost'] ?? null),
                null,
                'user_added_step',
            ]
        );

        $stepId = (int)Database::lastInsertId();
        $step = catn8_build_wizard_step_by_id($stepId);
        if (!$step) {
            throw new RuntimeException('Step not found after insert');
        }

        catn8_build_wizard_insert_step_audit_log(
            $projectId,
            $stepId,
            'created',
            $viewerId,
            ['after' => $step]
        );
        $step = catn8_build_wizard_step_by_id($stepId) ?: $step;

        catn8_json_response(['success' => true, 'step' => $step]);
    }

    if ($action === 'delete_step') {
        catn8_require_method('POST');

        $body = catn8_read_json_body();
        $stepId = isset($body['step_id']) ? (int)$body['step_id'] : 0;
        if ($stepId <= 0) {
            throw new RuntimeException('Missing step_id');
        }

        $stepRow = Database::queryOne(
            'SELECT s.id, s.project_id, s.source_ref
             FROM build_wizard_steps s
             INNER JOIN build_wizard_projects p ON p.id = s.project_id
             WHERE s.id = ? AND p.owner_user_id = ?
             LIMIT 1',
            [$stepId, $viewerId]
        );
        if (!$stepRow) {
            throw new RuntimeException('Step not found or not authorized');
        }
        $projectId = (int)($stepRow['project_id'] ?? 0);
        $deletedStepSnapshot = catn8_build_wizard_step_by_id($stepId);
        Database::beginTransaction();
        try {
            if ($deletedStepSnapshot) {
                catn8_build_wizard_insert_step_audit_log(
                    $projectId,
                    $stepId,
                    'deleted',
                    $viewerId,
                    ['before' => $deletedStepSnapshot]
                );
            }
            Database::execute(
                'UPDATE build_wizard_steps
                 SET parent_step_id = NULL
                 WHERE project_id = ? AND parent_step_id = ?',
                [$projectId, $stepId]
            );
            Database::execute('DELETE FROM build_wizard_steps WHERE id = ?', [$stepId]);
            catn8_build_wizard_resequence_step_orders($projectId);
            Database::commit();
        } catch (Throwable $e) {
            if (Database::inTransaction()) {
                Database::rollBack();
            }
            throw $e;
        }

        catn8_json_response([
            'success' => true,
            'deleted_step_id' => $stepId,
            'steps' => catn8_build_wizard_steps_for_project($projectId),
        ]);
    }

    if ($action === 'reorder_steps') {
        catn8_require_method('POST');

        $body = catn8_read_json_body();
        $projectId = isset($body['project_id']) ? (int)$body['project_id'] : 0;
        catn8_build_wizard_require_project_access($projectId, $viewerId);
        $phaseKey = catn8_build_wizard_normalize_phase_key($body['phase_key'] ?? 'general');
        $orderedStepIds = is_array($body['ordered_step_ids'] ?? null) ? $body['ordered_step_ids'] : [];
        if (!$orderedStepIds) {
            throw new RuntimeException('ordered_step_ids is required');
        }

        Database::beginTransaction();
        try {
            catn8_build_wizard_reorder_phase_steps($projectId, $phaseKey, $orderedStepIds);
            Database::commit();
        } catch (Throwable $e) {
            if (Database::inTransaction()) {
                Database::rollBack();
            }
            throw $e;
        }

        catn8_json_response([
            'success' => true,
            'steps' => catn8_build_wizard_steps_for_project($projectId),
        ]);
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

        Database::execute(
            'INSERT INTO build_wizard_step_notes (step_id, note_text) VALUES (?, ?)',
            [$stepId, $noteText]
        );

        $noteRow = Database::queryOne(
            'SELECT id, created_at FROM build_wizard_step_notes WHERE step_id = ? ORDER BY id DESC LIMIT 1',
            [$stepId]
        );
        catn8_build_wizard_insert_step_audit_log(
            (int)($stepRow['project_id'] ?? 0),
            $stepId,
            'note_added',
            $viewerId,
            [
                'note' => [
                    'id' => (int)($noteRow['id'] ?? 0),
                    'note_text' => $noteText,
                    'created_at' => (string)($noteRow['created_at'] ?? ''),
                ],
            ]
        );

        $step = catn8_build_wizard_step_by_id($stepId);
        if (!$step) {
            throw new RuntimeException('Step not found after note insert');
        }

        catn8_json_response(['success' => true, 'step' => $step]);
    }

    if ($action === 'save_contact') {
        catn8_require_method('POST');

        $body = catn8_read_json_body();
        $projectId = isset($body['project_id']) ? (int)$body['project_id'] : 0;
        catn8_build_wizard_require_project_access($projectId, $viewerId);

        $contactId = isset($body['contact_id']) ? (int)$body['contact_id'] : 0;
        $displayName = trim((string)($body['display_name'] ?? ''));
        if ($displayName === '') {
            throw new RuntimeException('display_name is required');
        }
        if (strlen($displayName) > 191) {
            $displayName = substr($displayName, 0, 191);
        }

        $isProjectOnly = ((int)($body['is_project_only'] ?? 1) === 1) ? 1 : 0;
        $scopeProjectId = $isProjectOnly === 1 ? $projectId : null;
        $requestedContactType = catn8_build_wizard_normalize_contact_type($body['contact_type'] ?? null, ((int)($body['is_vendor'] ?? 0) === 1) ? 1 : 0);
        $isVendor = $requestedContactType === 'vendor' ? 1 : 0;

        if ($contactId > 0) {
            $existing = catn8_build_wizard_contact_for_project($contactId, $projectId, $viewerId);
            if (!$existing) {
                throw new RuntimeException('Contact not found or not authorized');
            }

            Database::execute(
                'UPDATE build_wizard_contacts
                 SET project_id = ?, display_name = ?, contact_type = ?, email = ?, phone = ?, company = ?, role_title = ?, notes = ?, is_vendor = ?, vendor_type = ?, vendor_license = ?, vendor_trade = ?, vendor_website = ?
                 WHERE id = ? AND owner_user_id = ?',
                [
                    $scopeProjectId,
                    $displayName,
                    $requestedContactType,
                    catn8_build_wizard_text_or_null($body['email'] ?? null, 191),
                    catn8_build_wizard_text_or_null($body['phone'] ?? null, 64),
                    catn8_build_wizard_text_or_null($body['company'] ?? null, 191),
                    catn8_build_wizard_text_or_null($body['role_title'] ?? null, 120),
                    catn8_build_wizard_text_or_null($body['notes'] ?? null, 4000),
                    $isVendor,
                    $isVendor === 1 ? catn8_build_wizard_text_or_null($body['vendor_type'] ?? null, 64) : null,
                    $isVendor === 1 ? catn8_build_wizard_text_or_null($body['vendor_license'] ?? null, 120) : null,
                    $isVendor === 1 ? catn8_build_wizard_text_or_null($body['vendor_trade'] ?? null, 120) : null,
                    $isVendor === 1 ? catn8_build_wizard_text_or_null($body['vendor_website'] ?? null, 500) : null,
                    $contactId,
                    $viewerId,
                ]
            );
        } else {
            Database::execute(
                'INSERT INTO build_wizard_contacts
                    (owner_user_id, project_id, display_name, contact_type, email, phone, company, role_title, notes, is_vendor, vendor_type, vendor_license, vendor_trade, vendor_website)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $viewerId,
                    $scopeProjectId,
                    $displayName,
                    $requestedContactType,
                    catn8_build_wizard_text_or_null($body['email'] ?? null, 191),
                    catn8_build_wizard_text_or_null($body['phone'] ?? null, 64),
                    catn8_build_wizard_text_or_null($body['company'] ?? null, 191),
                    catn8_build_wizard_text_or_null($body['role_title'] ?? null, 120),
                    catn8_build_wizard_text_or_null($body['notes'] ?? null, 4000),
                    $isVendor,
                    $isVendor === 1 ? catn8_build_wizard_text_or_null($body['vendor_type'] ?? null, 64) : null,
                    $isVendor === 1 ? catn8_build_wizard_text_or_null($body['vendor_license'] ?? null, 120) : null,
                    $isVendor === 1 ? catn8_build_wizard_text_or_null($body['vendor_trade'] ?? null, 120) : null,
                    $isVendor === 1 ? catn8_build_wizard_text_or_null($body['vendor_website'] ?? null, 500) : null,
                ]
            );
            $contactId = (int)Database::lastInsertId();
        }

        $contact = catn8_build_wizard_contact_for_project($contactId, $projectId, $viewerId);
        if (!$contact) {
            throw new RuntimeException('Contact could not be loaded');
        }
        catn8_json_response(['success' => true, 'contact' => $contact]);
    }

    if ($action === 'delete_contact') {
        catn8_require_method('POST');

        $body = catn8_read_json_body();
        $projectId = isset($body['project_id']) ? (int)$body['project_id'] : 0;
        catn8_build_wizard_require_project_access($projectId, $viewerId);
        $contactId = isset($body['contact_id']) ? (int)$body['contact_id'] : 0;
        if ($contactId <= 0) {
            throw new RuntimeException('Missing contact_id');
        }
        $contact = catn8_build_wizard_contact_for_project($contactId, $projectId, $viewerId);
        if (!$contact) {
            throw new RuntimeException('Contact not found or not authorized');
        }

        Database::execute('DELETE FROM build_wizard_contacts WHERE id = ? AND owner_user_id = ? LIMIT 1', [$contactId, $viewerId]);
        catn8_json_response(['success' => true, 'deleted_contact_id' => $contactId]);
    }

    if ($action === 'add_contact_assignment') {
        catn8_require_method('POST');

        $body = catn8_read_json_body();
        $projectId = isset($body['project_id']) ? (int)$body['project_id'] : 0;
        catn8_build_wizard_require_project_access($projectId, $viewerId);

        $contactId = isset($body['contact_id']) ? (int)$body['contact_id'] : 0;
        if ($contactId <= 0) {
            throw new RuntimeException('Missing contact_id');
        }
        $contact = catn8_build_wizard_contact_for_project($contactId, $projectId, $viewerId);
        if (!$contact) {
            throw new RuntimeException('Contact not found or not authorized');
        }

        $stepId = isset($body['step_id']) ? (int)$body['step_id'] : 0;
        $phaseKey = isset($body['phase_key']) ? catn8_build_wizard_normalize_phase_key($body['phase_key']) : null;
        if ($phaseKey === 'general') {
            $phaseKey = null;
        }
        if ($stepId > 0) {
            $stepRow = Database::queryOne(
                'SELECT id, phase_key FROM build_wizard_steps WHERE id = ? AND project_id = ? LIMIT 1',
                [$stepId, $projectId]
            );
            if (!$stepRow) {
                throw new RuntimeException('Invalid step_id for this project');
            }
            if ($phaseKey === null) {
                $phaseKey = catn8_build_wizard_normalize_phase_key((string)($stepRow['phase_key'] ?? 'general'));
            }
        }

        if ($stepId <= 0 && $phaseKey === null) {
            throw new RuntimeException('Provide step_id and/or phase_key for assignment');
        }

        $existingAssignment = Database::queryOne(
            'SELECT id
             FROM build_wizard_contact_assignments
             WHERE project_id = ?
               AND contact_id = ?
               AND ((step_id IS NULL AND ? IS NULL) OR step_id = ?)
               AND ((phase_key IS NULL AND ? IS NULL) OR phase_key = ?)
             LIMIT 1',
            [$projectId, $contactId, ($stepId > 0 ? $stepId : null), ($stepId > 0 ? $stepId : null), $phaseKey, $phaseKey]
        );
        if ($existingAssignment) {
            throw new RuntimeException('That assignment already exists');
        }

        Database::execute(
            'INSERT INTO build_wizard_contact_assignments (project_id, contact_id, step_id, phase_key)
             VALUES (?, ?, ?, ?)',
            [$projectId, $contactId, ($stepId > 0 ? $stepId : null), $phaseKey]
        );
        $assignmentId = (int)Database::lastInsertId();
        $assignment = Database::queryOne(
            'SELECT id, project_id, contact_id, step_id, phase_key, created_at
             FROM build_wizard_contact_assignments
             WHERE id = ?
             LIMIT 1',
            [$assignmentId]
        );
        if (!$assignment) {
            throw new RuntimeException('Assignment could not be loaded');
        }
        catn8_json_response([
            'success' => true,
            'assignment' => [
                'id' => (int)($assignment['id'] ?? 0),
                'project_id' => (int)($assignment['project_id'] ?? 0),
                'contact_id' => (int)($assignment['contact_id'] ?? 0),
                'step_id' => $assignment['step_id'] !== null ? (int)$assignment['step_id'] : null,
                'phase_key' => $assignment['phase_key'] !== null ? (string)$assignment['phase_key'] : null,
                'created_at' => (string)($assignment['created_at'] ?? ''),
            ],
        ]);
    }

    if ($action === 'delete_contact_assignment') {
        catn8_require_method('POST');

        $body = catn8_read_json_body();
        $projectId = isset($body['project_id']) ? (int)$body['project_id'] : 0;
        catn8_build_wizard_require_project_access($projectId, $viewerId);
        $assignmentId = isset($body['assignment_id']) ? (int)$body['assignment_id'] : 0;
        if ($assignmentId <= 0) {
            throw new RuntimeException('Missing assignment_id');
        }

        $assignment = Database::queryOne(
            'SELECT a.id
             FROM build_wizard_contact_assignments a
             INNER JOIN build_wizard_contacts c ON c.id = a.contact_id
             WHERE a.id = ? AND a.project_id = ? AND c.owner_user_id = ?
             LIMIT 1',
            [$assignmentId, $projectId, $viewerId]
        );
        if (!$assignment) {
            throw new RuntimeException('Assignment not found or not authorized');
        }

        Database::execute('DELETE FROM build_wizard_contact_assignments WHERE id = ? LIMIT 1', [$assignmentId]);
        catn8_json_response(['success' => true, 'deleted_assignment_id' => $assignmentId]);
    }

    if ($action === 'upload_document') {
        catn8_require_method('POST');

        $projectId = isset($_POST['project_id']) ? (int)$_POST['project_id'] : 0;
        catn8_build_wizard_require_project_access($projectId, $viewerId);
        $stepId = isset($_POST['step_id']) ? (int)$_POST['step_id'] : 0;
        $phaseKey = catn8_build_wizard_normalize_phase_key($_POST['phase_key'] ?? '');
        if ($stepId > 0) {
            $stepRow = Database::queryOne(
                'SELECT id FROM build_wizard_steps WHERE id = ? AND project_id = ? LIMIT 1',
                [$stepId, $projectId]
            );
            if (!$stepRow) {
                throw new RuntimeException('Invalid step_id for this project');
            }
        } else {
            $stepId = 0;
        }

        $kind = catn8_build_wizard_document_kind($_POST['kind'] ?? 'other');
        if ($stepId <= 0) {
            if ($phaseKey === 'general') {
                $phaseKey = catn8_build_wizard_default_phase_for_kind($kind);
            }
            $inferredStepId = catn8_build_wizard_pick_step_for_phase($projectId, $phaseKey);
            if ($inferredStepId !== null && $inferredStepId > 0) {
                $stepId = $inferredStepId;
            }
        }
        $caption = trim((string)($_POST['caption'] ?? ''));
        if ($caption === '') {
            $caption = null;
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

        $finfo = function_exists('finfo_open') ? finfo_open(FILEINFO_MIME_TYPE) : false;
        $detectedMime = $finfo ? finfo_file($finfo, $tmp) : false;
        if ($finfo) {
            finfo_close($finfo);
        }
        $mime = trim((string)($detectedMime ?: ($file['type'] ?? 'application/octet-stream')));
        if ($mime === '') {
            $mime = 'application/octet-stream';
        }
        $uploadDir = dirname(__DIR__) . '/images/build-wizard';
        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
            throw new RuntimeException('Failed to prepare upload directory');
        }

        $storedName = date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '_' . $safeName;
        $destPath = $uploadDir . '/' . $storedName;
        if (!move_uploaded_file($tmp, $destPath)) {
            throw new RuntimeException('Failed to store uploaded file');
        }

        Database::execute(
            'INSERT INTO build_wizard_documents (project_id, step_id, kind, original_name, mime_type, storage_path, file_size_bytes, caption) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$projectId, ($stepId > 0 ? $stepId : null), $kind, $origName, $mime, $destPath, $size, $caption]
        );

        $docId = (int)Database::lastInsertId();
        if ($kind === 'blueprint') {
            Database::execute(
                'UPDATE build_wizard_projects
                 SET blueprint_document_id = COALESCE(blueprint_document_id, ?)
                 WHERE id = ?',
                [$docId, $projectId]
            );
        }

        $bytes = file_get_contents($destPath);
        if (!is_string($bytes) || $bytes === '') {
            throw new RuntimeException('Failed to read uploaded file');
        }
        catn8_build_wizard_upsert_document_blob($docId, $mime, $bytes);
        try {
            catn8_build_wizard_index_document_for_search($docId);
        } catch (Throwable $e) {
            error_log('[build_wizard] failed to index uploaded document ' . $docId . ': ' . $e->getMessage());
        }

        if (strpos(strtolower($mime), 'image/') === 0) {
            $sizeInfo = @getimagesize($destPath);
            $width = is_array($sizeInfo) && isset($sizeInfo[0]) ? (int)$sizeInfo[0] : null;
            $height = is_array($sizeInfo) && isset($sizeInfo[1]) ? (int)$sizeInfo[1] : null;
            Database::execute(
                'INSERT INTO build_wizard_document_images (document_id, mime_type, image_blob, width_px, height_px, file_size_bytes)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), image_blob = VALUES(image_blob), width_px = VALUES(width_px), height_px = VALUES(height_px), file_size_bytes = VALUES(file_size_bytes)',
                [$docId, $mime, $bytes, $width, $height, strlen($bytes)]
            );

            if (in_array($kind, ['photo', 'site_photo', 'home_photo', 'progress_photo'], true)) {
                Database::execute(
                    'UPDATE build_wizard_projects
                     SET primary_photo_document_id = COALESCE(primary_photo_document_id, ?)
                     WHERE id = ?',
                    [$docId, $projectId]
                );
            }
        }

        $doc = Database::queryOne(
            'SELECT d.id, d.project_id, d.step_id, s.phase_key AS step_phase_key, s.title AS step_title,
                    d.kind, d.original_name, d.mime_type, d.storage_path, d.file_size_bytes, d.caption, d.uploaded_at
             FROM build_wizard_documents d
             LEFT JOIN build_wizard_steps s ON s.id = d.step_id
             WHERE d.id = ?',
            [$docId]
        );
        if (!$doc) {
            throw new RuntimeException('Saved document not found');
        }

        $doc['public_url'] = '/api/build_wizard.php?action=get_document&document_id=' . $docId;
        $doc['thumbnail_url'] = '/api/build_wizard.php?action=get_document&document_id=' . $docId . '&thumb=1';
        $doc['is_image'] = (strpos(strtolower((string)($doc['mime_type'] ?? '')), 'image/') === 0) ? 1 : 0;
        catn8_json_response(['success' => true, 'document' => $doc]);
    }

    if ($action === 'update_document') {
        catn8_require_method('POST');

        $body = catn8_read_json_body();
        $documentId = isset($body['document_id']) ? (int)$body['document_id'] : 0;
        if ($documentId <= 0) {
            throw new RuntimeException('Missing document_id');
        }

        $doc = catn8_build_wizard_document_for_user($documentId, $viewerId);
        if (!$doc) {
            throw new RuntimeException('Document not found or not authorized');
        }
        $projectId = (int)($doc['project_id'] ?? 0);
        if ($projectId <= 0) {
            throw new RuntimeException('Invalid document project');
        }

        $updates = [];
        $params = [];

        if (array_key_exists('kind', $body)) {
            $updates[] = 'kind = ?';
            $params[] = catn8_build_wizard_document_kind($body['kind'] ?? 'other');
        }

        if (array_key_exists('caption', $body)) {
            $caption = trim((string)($body['caption'] ?? ''));
            $updates[] = 'caption = ?';
            $params[] = ($caption !== '' ? substr($caption, 0, 255) : null);
        }

        if (array_key_exists('step_id', $body)) {
            $nextStepId = (int)($body['step_id'] ?? 0);
            if ($nextStepId > 0) {
                $stepRow = Database::queryOne(
                    'SELECT id FROM build_wizard_steps WHERE id = ? AND project_id = ? LIMIT 1',
                    [$nextStepId, $projectId]
                );
                if (!$stepRow) {
                    throw new RuntimeException('Invalid step_id for this project');
                }
                $updates[] = 'step_id = ?';
                $params[] = $nextStepId;
            } else {
                $updates[] = 'step_id = NULL';
            }
        }

        if (!$updates) {
            throw new RuntimeException('No document fields provided');
        }

        $params[] = $documentId;
        Database::execute('UPDATE build_wizard_documents SET ' . implode(', ', $updates) . ' WHERE id = ?', $params);

        $updated = Database::queryOne(
            'SELECT d.id, d.project_id, d.step_id, s.phase_key AS step_phase_key, s.title AS step_title,
                    d.kind, d.original_name, d.mime_type, d.storage_path, d.file_size_bytes, d.caption, d.uploaded_at
             FROM build_wizard_documents d
             LEFT JOIN build_wizard_steps s ON s.id = d.step_id
             WHERE d.id = ? LIMIT 1',
            [$documentId]
        );
        if (!$updated) {
            throw new RuntimeException('Updated document not found');
        }
        $updated['public_url'] = '/api/build_wizard.php?action=get_document&document_id=' . $documentId;
        $updated['thumbnail_url'] = '/api/build_wizard.php?action=get_document&document_id=' . $documentId . '&thumb=1';
        $updated['is_image'] = (strpos(strtolower((string)($updated['mime_type'] ?? '')), 'image/') === 0) ? 1 : 0;

        catn8_json_response(['success' => true, 'document' => $updated]);
    }

    if ($action === 'replace_document') {
        catn8_require_method('POST');

        $documentId = isset($_POST['document_id']) ? (int)$_POST['document_id'] : 0;
        if ($documentId <= 0) {
            throw new RuntimeException('Missing document_id');
        }

        $doc = catn8_build_wizard_document_for_user($documentId, $viewerId);
        if (!$doc) {
            throw new RuntimeException('Document not found or not authorized');
        }
        $projectId = (int)($doc['project_id'] ?? 0);
        if ($projectId <= 0) {
            throw new RuntimeException('Invalid document project');
        }

        if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
            throw new RuntimeException('No replacement file uploaded');
        }
        $file = $_FILES['file'];
        $tmp = (string)($file['tmp_name'] ?? '');
        if ($tmp === '' || !is_uploaded_file($tmp)) {
            throw new RuntimeException('Invalid replacement upload');
        }

        $size = (int)($file['size'] ?? 0);
        if ($size <= 0) {
            throw new RuntimeException('Replacement file is empty');
        }
        if ($size > 25 * 1024 * 1024) {
            throw new RuntimeException('Replacement file exceeds 25MB');
        }

        $origName = trim((string)($file['name'] ?? 'document'));
        $safeName = preg_replace('/[^A-Za-z0-9._-]+/', '_', $origName);
        if (!is_string($safeName) || $safeName === '') {
            $safeName = 'document';
        }

        $finfo = function_exists('finfo_open') ? finfo_open(FILEINFO_MIME_TYPE) : false;
        $detectedMime = $finfo ? finfo_file($finfo, $tmp) : false;
        if ($finfo) {
            finfo_close($finfo);
        }
        $mime = trim((string)($detectedMime ?: ($file['type'] ?? 'application/octet-stream')));
        if ($mime === '') {
            $mime = 'application/octet-stream';
        }

        $uploadDir = dirname(__DIR__) . '/images/build-wizard';
        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true) && !is_dir($uploadDir)) {
            throw new RuntimeException('Failed to prepare upload directory');
        }

        $storedName = date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '_' . $safeName;
        $destPath = $uploadDir . '/' . $storedName;
        if (!move_uploaded_file($tmp, $destPath)) {
            throw new RuntimeException('Failed to store replacement file');
        }

        $bytes = file_get_contents($destPath);
        if (!is_string($bytes) || $bytes === '') {
            throw new RuntimeException('Failed to read replacement file');
        }

        $oldStoragePath = trim((string)($doc['storage_path'] ?? ''));
        catn8_build_wizard_clear_pdf_thumb_cache($documentId);

        Database::beginTransaction();
        try {
            Database::execute(
                'UPDATE build_wizard_documents
                 SET original_name = ?, mime_type = ?, storage_path = ?, file_size_bytes = ?, uploaded_at = CURRENT_TIMESTAMP
                 WHERE id = ?',
                [$origName, $mime, $destPath, $size, $documentId]
            );

            catn8_build_wizard_upsert_document_blob($documentId, $mime, $bytes);

            if (strpos(strtolower($mime), 'image/') === 0) {
                $sizeInfo = @getimagesize($destPath);
                $width = is_array($sizeInfo) && isset($sizeInfo[0]) ? (int)$sizeInfo[0] : null;
                $height = is_array($sizeInfo) && isset($sizeInfo[1]) ? (int)$sizeInfo[1] : null;
                Database::execute(
                    'INSERT INTO build_wizard_document_images (document_id, mime_type, image_blob, width_px, height_px, file_size_bytes)
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), image_blob = VALUES(image_blob), width_px = VALUES(width_px), height_px = VALUES(height_px), file_size_bytes = VALUES(file_size_bytes)',
                    [$documentId, $mime, $bytes, $width, $height, strlen($bytes)]
                );
            } else {
                Database::execute('DELETE FROM build_wizard_document_images WHERE document_id = ?', [$documentId]);
            }

            Database::commit();
        } catch (Throwable $e) {
            if (Database::inTransaction()) {
                Database::rollBack();
            }
            throw $e;
        }

        try {
            catn8_build_wizard_index_document_for_search($documentId);
        } catch (Throwable $e) {
            error_log('[build_wizard] failed to index replaced document ' . $documentId . ': ' . $e->getMessage());
        }

        if ($oldStoragePath !== '' && is_file($oldStoragePath)) {
            $uploadRoot = realpath(dirname(__DIR__) . '/images/build-wizard');
            $realStoragePath = realpath($oldStoragePath);
            if (
                $uploadRoot !== false
                && $realStoragePath !== false
                && str_starts_with($realStoragePath, $uploadRoot . DIRECTORY_SEPARATOR)
            ) {
                unlink($realStoragePath);
            }
        }

        $updated = Database::queryOne(
            'SELECT d.id, d.project_id, d.step_id, s.phase_key AS step_phase_key, s.title AS step_title,
                    d.kind, d.original_name, d.mime_type, d.storage_path, d.file_size_bytes, d.caption, d.uploaded_at
             FROM build_wizard_documents d
             LEFT JOIN build_wizard_steps s ON s.id = d.step_id
             WHERE d.id = ? LIMIT 1',
            [$documentId]
        );
        if (!$updated) {
            throw new RuntimeException('Updated document not found');
        }
        $updated['public_url'] = '/api/build_wizard.php?action=get_document&document_id=' . $documentId;
        $updated['thumbnail_url'] = '/api/build_wizard.php?action=get_document&document_id=' . $documentId . '&thumb=1';
        $updated['is_image'] = (strpos(strtolower((string)($updated['mime_type'] ?? '')), 'image/') === 0) ? 1 : 0;

        catn8_json_response(['success' => true, 'document' => $updated]);
    }

    if ($action === 'delete_document') {
        catn8_require_method('POST');

        $body = catn8_read_json_body();
        $documentId = isset($body['document_id']) ? (int)$body['document_id'] : 0;
        if ($documentId <= 0) {
            throw new RuntimeException('Missing document_id');
        }

        $doc = catn8_build_wizard_document_for_user($documentId, $viewerId);
        if (!$doc) {
            throw new RuntimeException('Document not found or not authorized');
        }

        $projectId = (int)($doc['project_id'] ?? 0);
        $storagePath = trim((string)($doc['storage_path'] ?? ''));
        Database::execute('DELETE FROM build_wizard_documents WHERE id = ?', [$documentId]);
        if ($projectId > 0) {
            Database::execute(
                'UPDATE build_wizard_projects
                 SET blueprint_document_id = CASE WHEN blueprint_document_id = ? THEN NULL ELSE blueprint_document_id END,
                     primary_photo_document_id = CASE WHEN primary_photo_document_id = ? THEN NULL ELSE primary_photo_document_id END
                 WHERE id = ?',
                [$documentId, $documentId, $projectId]
            );
        }

        if ($storagePath !== '' && is_file($storagePath)) {
            $uploadRoot = realpath(dirname(__DIR__) . '/images/build-wizard');
            $realStoragePath = realpath($storagePath);
            if (
                $uploadRoot !== false
                && $realStoragePath !== false
                && str_starts_with($realStoragePath, $uploadRoot . DIRECTORY_SEPARATOR)
            ) {
                @unlink($realStoragePath);
            }
        }

        catn8_json_response([
            'success' => true,
            'deleted_document_id' => $documentId,
            'documents' => ($projectId > 0 ? catn8_build_wizard_documents_for_project($projectId) : []),
        ]);
    }

    if ($action === 'backfill_document_blobs') {
        catn8_require_method('POST');
        catn8_require_admin();

        $body = catn8_read_json_body();
        $apply = ((int)($body['apply'] ?? 0) === 1);
        $requestedProjectId = isset($body['project_id']) ? (int)$body['project_id'] : 0;
        $limit = isset($body['limit']) ? (int)$body['limit'] : 0;
        if ($limit < 0) {
            $limit = 0;
        }
        if ($limit > 5000) {
            $limit = 5000;
        }

        $projectIdForRun = $requestedProjectId > 0 ? $requestedProjectId : null;
        $report = catn8_build_wizard_backfill_document_blobs($apply, $projectIdForRun, $limit);
        catn8_json_response([
            'success' => true,
            'report' => $report,
        ]);
    }

    if ($action === 'pdf_thumbnail_diagnostics') {
        catn8_require_method('GET');
        catn8_require_admin();

        catn8_json_response([
            'success' => true,
            'diagnostics' => catn8_build_wizard_pdf_thumbnail_diagnostics(),
        ]);
    }

    if ($action === 'hydrate_missing_document_blobs') {
        catn8_require_method('POST');
        catn8_require_admin();

        $requestedProjectId = isset($_POST['project_id']) ? (int)$_POST['project_id'] : 0;
        $projectId = $requestedProjectId > 0 ? $requestedProjectId : null;

        $files = catn8_build_wizard_normalize_upload_files('files');
        if (!$files) {
            throw new RuntimeException('No files uploaded');
        }

        $params = [];
        $sql = 'SELECT d.id, d.project_id, d.original_name, d.mime_type
                FROM build_wizard_documents d
                LEFT JOIN build_wizard_document_blobs b ON b.document_id = d.id
                WHERE b.document_id IS NULL';
        if ($projectId !== null) {
            $sql .= ' AND d.project_id = ?';
            $params[] = $projectId;
        }
        $rows = Database::queryAll($sql . ' ORDER BY d.id ASC', $params);

        $remainingRows = [];
        foreach ($rows as $r) {
            $docId = (int)($r['id'] ?? 0);
            if ($docId > 0) {
                $remainingRows[$docId] = $r;
            }
        }

        $finfo = function_exists('finfo_open') ? finfo_open(FILEINFO_MIME_TYPE) : false;
        $processed = 0;
        $matched = 0;
        $written = 0;
        $unmatched = [];
        $ambiguous = [];

        foreach ($files as $file) {
            $err = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
            if ($err !== UPLOAD_ERR_OK) {
                continue;
            }
            $tmp = (string)($file['tmp_name'] ?? '');
            $origName = trim((string)($file['name'] ?? ''));
            $size = (int)($file['size'] ?? 0);
            if ($tmp === '' || !is_uploaded_file($tmp) || $size <= 0 || $origName === '') {
                continue;
            }
            $processed++;

            $bestScore = 0;
            $candidateIds = [];
            foreach ($remainingRows as $rowDocId => $row) {
                $score = catn8_build_wizard_filename_match_score((string)($row['original_name'] ?? ''), $origName);
                if ($score <= 0) {
                    continue;
                }
                if ($score > $bestScore) {
                    $bestScore = $score;
                    $candidateIds = [$rowDocId];
                } elseif ($score === $bestScore) {
                    $candidateIds[] = $rowDocId;
                }
            }

            if ($bestScore < 70 || !$candidateIds) {
                $unmatched[] = $origName;
                continue;
            }

            $bytes = file_get_contents($tmp);
            if (!is_string($bytes) || $bytes === '') {
                continue;
            }

            $detectedMime = $finfo ? finfo_file($finfo, $tmp) : false;
            $uploadMime = trim((string)($detectedMime ?: ($file['type'] ?? 'application/octet-stream')));
            if ($uploadMime === '') {
                $uploadMime = 'application/octet-stream';
            }

            if ($bestScore < 90 && count($candidateIds) > 1) {
                $ambiguous[] = $origName;
                continue;
            }

            $matched += count($candidateIds);
            foreach ($candidateIds as $rowDocId) {
                $target = $remainingRows[$rowDocId] ?? null;
                if (!is_array($target)) {
                    continue;
                }
                $docId = (int)($target['id'] ?? 0);
                if ($docId <= 0) {
                    continue;
                }
                $targetMime = trim((string)($target['mime_type'] ?? ''));
                catn8_build_wizard_upsert_document_blob($docId, $targetMime !== '' ? $targetMime : $uploadMime, $bytes);
                try {
                    catn8_build_wizard_index_document_for_search($docId);
                } catch (Throwable $e) {
                    error_log('[build_wizard] failed to index hydrated document ' . $docId . ': ' . $e->getMessage());
                }
                $written++;
                unset($remainingRows[$rowDocId]);
            }
        }

        if ($finfo) {
            finfo_close($finfo);
        }

        catn8_json_response([
            'success' => true,
            'processed_files' => $processed,
            'matched_documents' => $matched,
            'written_blobs' => $written,
            'unmatched_filenames' => array_values(array_unique($unmatched)),
            'ambiguous_filenames' => array_values(array_unique($ambiguous)),
        ]);
    }

    if ($action === 'hydrate_missing_document_blobs_from_sources') {
        catn8_require_method('POST');
        catn8_require_admin();

        $body = catn8_read_json_body();
        $requestedProjectId = isset($body['project_id']) ? (int)$body['project_id'] : 0;
        $projectId = $requestedProjectId > 0 ? $requestedProjectId : null;
        $scanLimit = isset($body['scan_limit']) ? (int)$body['scan_limit'] : 10000;
        if ($scanLimit <= 0) {
            $scanLimit = 10000;
        }
        if ($scanLimit > 25000) {
            $scanLimit = 25000;
        }

        $params = [];
        $sql = 'SELECT d.id, d.project_id, d.original_name, d.mime_type
                FROM build_wizard_documents d
                LEFT JOIN build_wizard_document_blobs b ON b.document_id = d.id
                WHERE b.document_id IS NULL';
        if ($projectId !== null) {
            $sql .= ' AND d.project_id = ?';
            $params[] = $projectId;
        }
        $rows = Database::queryAll($sql . ' ORDER BY d.id ASC', $params);
        $remainingRows = [];
        foreach ($rows as $r) {
            $docId = (int)($r['id'] ?? 0);
            if ($docId > 0) {
                $remainingRows[$docId] = $r;
            }
        }

        $roots = catn8_build_wizard_additional_source_roots();
        $sourceFiles = catn8_build_wizard_collect_source_files($roots, $scanLimit);
        $matched = 0;
        $written = 0;
        $ambiguousDocs = [];

        foreach ($remainingRows as $rowDocId => $row) {
            $targetName = (string)($row['original_name'] ?? '');
            $bestScore = 0;
            $bestPaths = [];
            foreach ($sourceFiles as $sf) {
                $candidateName = (string)($sf['name'] ?? '');
                $score = catn8_build_wizard_filename_match_score($targetName, $candidateName);
                if ($score <= 0) {
                    continue;
                }
                if ($score > $bestScore) {
                    $bestScore = $score;
                    $bestPaths = [(string)($sf['path'] ?? '')];
                } elseif ($score === $bestScore) {
                    $bestPaths[] = (string)($sf['path'] ?? '');
                }
            }

            if ($bestScore < 70 || !$bestPaths) {
                continue;
            }
            $bestPaths = array_values(array_filter(array_unique($bestPaths), static fn($p) => $p !== ''));
            if ($bestScore < 90 && count($bestPaths) > 1) {
                if (count($ambiguousDocs) < 25) {
                    $ambiguousDocs[] = [
                        'document_id' => $rowDocId,
                        'original_name' => $targetName,
                    ];
                }
                continue;
            }

            $pickedPath = $bestPaths[0] ?? '';
            if ($pickedPath === '' || !is_file($pickedPath)) {
                continue;
            }

            $bytes = @file_get_contents($pickedPath);
            if (!is_string($bytes) || $bytes === '') {
                continue;
            }
            $mime = trim((string)($row['mime_type'] ?? ''));
            if ($mime === '') {
                $mime = 'application/octet-stream';
            }
            catn8_build_wizard_upsert_document_blob($rowDocId, $mime, $bytes);
            try {
                catn8_build_wizard_index_document_for_search($rowDocId);
            } catch (Throwable $e) {
                error_log('[build_wizard] failed to index source-hydrated document ' . $rowDocId . ': ' . $e->getMessage());
            }
            $matched++;
            $written++;
        }

        catn8_json_response([
            'success' => true,
            'source_roots' => $roots,
            'source_files_scanned' => count($sourceFiles),
            'missing_documents_considered' => count($remainingRows),
            'matched_documents' => $matched,
            'written_blobs' => $written,
            'ambiguous_documents' => $ambiguousDocs,
        ]);
    }

    if ($action === 'search_content') {
        catn8_require_method('POST');

        $body = catn8_read_json_body();
        $projectId = isset($body['project_id']) ? (int)$body['project_id'] : 0;
        catn8_build_wizard_require_project_access($projectId, $viewerId);

        $query = trim((string)($body['query'] ?? ''));
        if ($query === '') {
            throw new RuntimeException('Missing search query');
        }
        if (strlen($query) > 200) {
            $query = substr($query, 0, 200);
        }
        $limit = isset($body['limit']) ? (int)$body['limit'] : 20;
        $limit = max(1, min(50, $limit));

        $indexing = catn8_build_wizard_index_documents_for_project($projectId, 400);
        $results = catn8_build_wizard_search_documents($projectId, $query, $limit);
        $capabilities = [
            'shell_exec' => function_exists('shell_exec'),
            'pdftotext' => catn8_build_wizard_find_binary('pdftotext', [
                '/usr/bin/pdftotext',
                '/usr/local/bin/pdftotext',
                '/opt/homebrew/bin/pdftotext',
            ]) !== null,
            'pdftoppm' => catn8_build_wizard_find_binary('pdftoppm', [
                '/usr/bin/pdftoppm',
                '/usr/local/bin/pdftoppm',
                '/opt/homebrew/bin/pdftoppm',
            ]) !== null,
            'tesseract' => catn8_build_wizard_find_binary('tesseract', [
                '/usr/bin/tesseract',
                '/usr/local/bin/tesseract',
                '/opt/homebrew/bin/tesseract',
            ]) !== null,
            'pdf_php_fallback' => true,
        ];

        catn8_json_response([
            'success' => true,
            'query' => $query,
            'project_id' => $projectId,
            'results' => $results,
            'indexing' => [
                'indexed' => (int)($indexing['indexed'] ?? 0),
                'errors' => (int)($indexing['errors'] ?? 0),
            ],
            'capabilities' => $capabilities,
        ]);
    }

    if ($action === 'reindex_document_search') {
        catn8_require_method('POST');
        catn8_require_admin();

        $body = catn8_read_json_body();
        $projectId = isset($body['project_id']) ? (int)$body['project_id'] : 0;
        if ($projectId <= 0) {
            throw new RuntimeException('Missing project_id');
        }
        $project = Database::queryOne('SELECT id FROM build_wizard_projects WHERE id = ? LIMIT 1', [$projectId]);
        if (!$project) {
            throw new RuntimeException('Project not found');
        }

        $docRows = Database::queryAll('SELECT id FROM build_wizard_documents WHERE project_id = ? ORDER BY id ASC', [$projectId]);
        $indexed = 0;
        $errors = 0;
        foreach ($docRows as $row) {
            $docId = (int)($row['id'] ?? 0);
            if ($docId <= 0) {
                continue;
            }
            try {
                catn8_build_wizard_index_document_for_search($docId);
                $indexed++;
            } catch (Throwable $e) {
                $errors++;
                error_log('[build_wizard] failed reindex doc ' . $docId . ': ' . $e->getMessage());
            }
        }

        catn8_json_response([
            'success' => true,
            'project_id' => $projectId,
            'indexed' => $indexed,
            'errors' => $errors,
        ]);
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
        $mode = strtolower(trim((string)($body['mode'] ?? 'optimize')));
        if (!in_array($mode, ['optimize', 'fill_missing', 'complete'], true)) {
            $mode = 'optimize';
        }

        $steps = catn8_build_wizard_steps_for_project($projectId);
        $documents = catn8_build_wizard_documents_for_project($projectId);
        [$promptText, $payload] = catn8_build_wizard_build_ai_package($project, $steps, $documents);

        $cfg = catn8_settings_ai_get_config();
        $provider = strtolower(trim((string)($cfg['provider'] ?? 'openai')));
        $model = trim((string)($cfg['model'] ?? ''));
        $systemPrompt = 'You are an expert house construction planner and permit workflow architect. Return strict JSON only. '
            . 'Schema: {"project_updates":{"home_style":string|null,"home_type":string|null,"square_feet":number|null,"room_count":number|null,"bedrooms_count":number|null,"kitchens_count":number|null,"bathroom_count":number|null,"stories_count":number|null,"lot_size_sqft":number|null,"garage_spaces":number|null,"parking_spaces":number|null,"year_built":number|null,"hoa_fee_monthly":number|null,"target_start_date":"YYYY-MM-DD|null","target_completion_date":"YYYY-MM-DD|null","wizard_notes_append":string},"missing_fields":[string],"steps":[{"step_order":number,"phase_key":string,"step_type":"permit|purchase|inspection|documentation|construction|photos|blueprints|utility|delivery|milestone|closeout|other","title":string,"description":string,"permit_required":boolean,"permit_name":string|null,"expected_start_date":"YYYY-MM-DD|null","expected_end_date":"YYYY-MM-DD|null","expected_duration_days":number|null,"estimated_cost":number|null,"depends_on_step_orders":[number],"ai_estimated_fields":[string],"source_ref":string|null}]}. '
            . 'Never return markdown.';
        $modeInstruction = match ($mode) {
            'fill_missing' => 'Only fill missing values or obviously incomplete steps. Keep existing step order and titles unless required for safety/compliance.',
            'complete' => 'Fully complete and optimize the project plan. You may add/reorder/remove steps across phases to create a realistic house-build sequence.',
            default => 'Optimize the existing timeline and improve sequencing, permit coverage, and budget realism.',
        };
        $userPrompt = $promptText
            . "\n\nMODE:\n" . $modeInstruction
            . "\n\nCritical ordering rules:\n"
            . "- Permits/approvals before dependent physical work.\n"
            . "- Foundation steps before framing/roof material ordering.\n"
            . "- Framing inspection before rough MEP.\n"
            . "- Rough MEP inspections before insulation/drywall.\n"
            . "- Final inspections before CO/occupancy.\n"
            . "- For material pricing estimates, prefer Lowes/Home Depot and common regional suppliers.\n"
            . "\nBUILD PACKAGE JSON:\n" . json_encode($payload, JSON_UNESCAPED_SLASHES);

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
                     SET home_style = ?, home_type = ?, square_feet = ?, room_count = ?, bedrooms_count = ?, kitchens_count = ?, bathroom_count = ?, stories_count = ?, lot_size_sqft = ?, garage_spaces = ?, parking_spaces = ?, year_built = ?, hoa_fee_monthly = ?, target_start_date = ?, target_completion_date = ?, wizard_notes = CONCAT(COALESCE(wizard_notes, ""), ?)
                     WHERE id = ?',
                    [
                        trim((string)($projectUpdates['home_style'] ?? ($project['home_style'] ?? ''))),
                        trim((string)($projectUpdates['home_type'] ?? ($project['home_type'] ?? ''))),
                        isset($projectUpdates['square_feet']) && is_numeric($projectUpdates['square_feet']) ? (int)$projectUpdates['square_feet'] : ($project['square_feet'] !== null ? (int)$project['square_feet'] : null),
                        isset($projectUpdates['room_count']) && is_numeric($projectUpdates['room_count']) ? (int)$projectUpdates['room_count'] : ($project['room_count'] !== null ? (int)$project['room_count'] : null),
                        isset($projectUpdates['bedrooms_count']) && is_numeric($projectUpdates['bedrooms_count']) ? (int)$projectUpdates['bedrooms_count'] : ($project['bedrooms_count'] !== null ? (int)$project['bedrooms_count'] : null),
                        isset($projectUpdates['kitchens_count']) && is_numeric($projectUpdates['kitchens_count']) ? (int)$projectUpdates['kitchens_count'] : ($project['kitchens_count'] !== null ? (int)$project['kitchens_count'] : null),
                        isset($projectUpdates['bathroom_count']) && is_numeric($projectUpdates['bathroom_count']) ? (int)$projectUpdates['bathroom_count'] : ($project['bathroom_count'] !== null ? (int)$project['bathroom_count'] : null),
                        isset($projectUpdates['stories_count']) && is_numeric($projectUpdates['stories_count']) ? (int)$projectUpdates['stories_count'] : ($project['stories_count'] !== null ? (int)$project['stories_count'] : null),
                        isset($projectUpdates['lot_size_sqft']) && is_numeric($projectUpdates['lot_size_sqft']) ? (int)$projectUpdates['lot_size_sqft'] : ($project['lot_size_sqft'] !== null ? (int)$project['lot_size_sqft'] : null),
                        isset($projectUpdates['garage_spaces']) && is_numeric($projectUpdates['garage_spaces']) ? (int)$projectUpdates['garage_spaces'] : ($project['garage_spaces'] !== null ? (int)$project['garage_spaces'] : null),
                        isset($projectUpdates['parking_spaces']) && is_numeric($projectUpdates['parking_spaces']) ? (int)$projectUpdates['parking_spaces'] : ($project['parking_spaces'] !== null ? (int)$project['parking_spaces'] : null),
                        isset($projectUpdates['year_built']) && is_numeric($projectUpdates['year_built']) ? (int)$projectUpdates['year_built'] : ($project['year_built'] !== null ? (int)$project['year_built'] : null),
                        isset($projectUpdates['hoa_fee_monthly']) && is_numeric($projectUpdates['hoa_fee_monthly']) ? (float)$projectUpdates['hoa_fee_monthly'] : ($project['hoa_fee_monthly'] !== null ? (float)$project['hoa_fee_monthly'] : null),
                        catn8_build_wizard_parse_date_or_null($projectUpdates['target_start_date'] ?? ($project['target_start_date'] ?? null)),
                        catn8_build_wizard_parse_date_or_null($projectUpdates['target_completion_date'] ?? ($project['target_completion_date'] ?? null)),
                        "\n\n[AI update " . gmdate('c') . "] " . trim((string)($projectUpdates['wizard_notes_append'] ?? '')),
                        $projectId,
                    ]
                );
            }

            $sourceRef = 'AI generated [' . $mode . '] (' . $provider . ($model !== '' ? ':' . $model : '') . ') ' . gmdate('c');
            $changes = catn8_build_wizard_upsert_ai_steps($projectId, $normalizedSteps, $sourceRef, $mode === 'complete');

            Database::execute(
                'UPDATE build_wizard_projects SET ai_prompt_text = ?, ai_payload_json = ? WHERE id = ?',
                [$promptText, json_encode($payload, JSON_UNESCAPED_SLASHES), $projectId]
            );

            Database::commit();

            catn8_json_response([
                'success' => true,
                'provider' => $provider,
                'model' => $model,
                'mode' => $mode,
                'parsed_step_count' => count($normalizedSteps),
                'inserted_count' => (int)$changes['inserted'],
                'updated_count' => (int)$changes['updated'],
                'missing_fields' => is_array($aiJson['missing_fields'] ?? null) ? array_values($aiJson['missing_fields']) : [],
                'steps' => catn8_build_wizard_steps_for_project($projectId),
            ]);
        } catch (Throwable $txe) {
            if (Database::inTransaction()) {
                Database::rollBack();
            }
            throw $txe;
        }
    }

    if ($action === 'align_to_template') {
        catn8_require_method('POST');

        $body = catn8_read_json_body();
        $projectId = isset($body['project_id']) ? (int)$body['project_id'] : 0;
        catn8_build_wizard_require_project_access($projectId, $viewerId);

        $result = catn8_build_wizard_align_project_to_template($projectId);
        catn8_json_response([
            'success' => true,
            'summary' => $result['summary'] ?? null,
            'phase_review' => $result['phase_review'] ?? [],
            'steps' => $result['steps'] ?? [],
        ]);
    }

    if ($action === 'refine_legacy_steps') {
        catn8_require_method('POST');

        $body = catn8_read_json_body();
        $projectId = isset($body['project_id']) ? (int)$body['project_id'] : 0;
        catn8_build_wizard_require_project_access($projectId, $viewerId);

        $result = catn8_build_wizard_refine_legacy_steps($projectId);
        catn8_json_response([
            'success' => true,
            'summary' => $result['summary'] ?? null,
            'phase_review' => $result['phase_review'] ?? [],
            'steps' => $result['steps'] ?? [],
        ]);
    }

    catn8_json_response(['success' => false, 'error' => 'Unknown action'], 404);
} catch (Throwable $e) {
    catn8_json_response([
        'success' => false,
        'error' => $e->getMessage(),
    ], 500);
}
