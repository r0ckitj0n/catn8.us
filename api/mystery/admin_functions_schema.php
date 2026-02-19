<?php
declare(strict_types=1);

function catn8_mystery_require_admin(bool $isAdmin): void {
    if (!$isAdmin) {
        catn8_json_response(['success' => false, 'error' => 'Admin required'], 403);
    }
}

function catn8_mystery_tables_ensure(): void {
    // Core Mystery Tables
    Database::execute("CREATE TABLE IF NOT EXISTS mystery_mysteries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT,
        slug VARCHAR(191) NOT NULL UNIQUE,
        title VARCHAR(191) NOT NULL,
        settings_json LONGTEXT,
        is_archived TINYINT(1) DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_games (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT,
        mystery_id INT NOT NULL,
        backstory_id INT,
        slug VARCHAR(191) NOT NULL,
        title VARCHAR(191) NOT NULL,
        description TEXT,
        is_template TINYINT(1) DEFAULT 0,
        is_archived TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_scenarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        game_id INT NOT NULL,
        backstory_id INT,
        slug VARCHAR(191) NOT NULL,
        title VARCHAR(191) NOT NULL,
        status VARCHAR(64) DEFAULT 'draft',
        specs_json JSON NULL,
        constraints_json JSON NULL,
        briefing_text TEXT,
        csi_report_text TEXT,
        csi_report_json JSON NULL,
        csi_detective_entity_id INT,
        crime_scene_weapon VARCHAR(191),
        crime_scene_motive VARCHAR(191),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_entities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        game_id INT NOT NULL,
        entity_type VARCHAR(64) NOT NULL,
        slug VARCHAR(191) NOT NULL,
        name VARCHAR(191) NOT NULL,
        data_json JSON NULL,
        roles_json JSON NULL,
        accent_preference VARCHAR(191),
        is_archived TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_game_slug (game_id, slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_scenario_entities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        scenario_id INT NOT NULL,
        entity_id INT NOT NULL,
        role VARCHAR(64) NOT NULL,
        override_json JSON NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_scenario_lies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        scenario_id INT NOT NULL,
        entity_id INT NOT NULL,
        lie_type VARCHAR(64),
        topic_key VARCHAR(191),
        lie_text TEXT,
        truth_text TEXT,
        trigger_questions_json JSON NULL,
        relevance VARCHAR(64),
        notes TEXT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_scenario_depositions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        scenario_id INT NOT NULL,
        entity_id INT NOT NULL,
        deposition_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_scenario_murderers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        scenario_id INT NOT NULL,
        entity_id INT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_scenario_cold_hard_facts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        scenario_id INT NOT NULL,
        facts_json JSON NULL,
        annotations_json JSON NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_run_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        case_id INT NOT NULL,
        scenario_id INT NOT NULL,
        owner_user_id INT NOT NULL,
        status VARCHAR(64) DEFAULT 'active',
        run_settings_json JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_generation_jobs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        game_id INT,
        scenario_id INT,
        entity_id INT,
        action VARCHAR(191) NOT NULL,
        spec_json JSON NULL,
        status VARCHAR(64) DEFAULT 'queued',
        result_json JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_interrogation_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        scenario_id INT NOT NULL,
        entity_id INT NOT NULL,
        question_text TEXT,
        answer_text TEXT,
        meta_json JSON NULL,
        asked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_conversation_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        scenario_id INT NOT NULL,
        entity_id INT NOT NULL,
        channel VARCHAR(64),
        provider VARCHAR(64),
        role VARCHAR(64),
        content_text TEXT,
        meta_json JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_case_notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        scenario_id INT NOT NULL,
        title VARCHAR(191),
        note_type VARCHAR(64),
        content_rich_json JSON NULL,
        clue_count INT DEFAULT 0,
        is_archived TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_evidence (
        id INT AUTO_INCREMENT PRIMARY KEY,
        case_id INT NOT NULL,
        scenario_id INT NOT NULL,
        slug VARCHAR(191) NOT NULL,
        title VARCHAR(191) NOT NULL,
        description TEXT,
        image_url TEXT,
        evidence_type VARCHAR(64) DEFAULT 'physical',
        is_archived TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_story_book_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        slug VARCHAR(191) NOT NULL UNIQUE,
        title VARCHAR(191) NOT NULL,
        theme VARCHAR(191),
        source_text TEXT,
        meta_json JSON NULL,
        is_archived TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_voice_profiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        display_name VARCHAR(191) NOT NULL,
        notes TEXT,
        provider VARCHAR(64),
        language_code VARCHAR(64),
        ssml_gender VARCHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_locations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(191) NOT NULL UNIQUE,
        name VARCHAR(191) NOT NULL,
        description TEXT,
        location_id VARCHAR(191),
        address_line1 VARCHAR(191),
        address_line2 VARCHAR(191),
        city VARCHAR(191),
        region VARCHAR(191),
        postal_code VARCHAR(191),
        country VARCHAR(191),
        is_archived TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_location_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        location_id INT NOT NULL,
        title VARCHAR(191) NULL,
        url VARCHAR(255) NOT NULL,
        alt_text TEXT NULL,
        prompt_text TEXT NULL,
        negative_prompt_text TEXT NULL,
        provider VARCHAR(64) NULL,
        model VARCHAR(64) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_mystery_location_image_location FOREIGN KEY (location_id) REFERENCES mystery_locations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_motives (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(191) NOT NULL UNIQUE,
        name VARCHAR(191) NOT NULL,
        description TEXT,
        is_archived TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_motive_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        motive_id INT NOT NULL,
        title VARCHAR(191) NULL,
        url VARCHAR(255) NOT NULL,
        alt_text TEXT NULL,
        prompt_text TEXT NULL,
        negative_prompt_text TEXT NULL,
        provider VARCHAR(64) NULL,
        model VARCHAR(64) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_mystery_motive_image_motive FOREIGN KEY (motive_id) REFERENCES mystery_motives(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_weapons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(191) NOT NULL UNIQUE,
        name VARCHAR(191) NOT NULL,
        description TEXT,
        is_archived TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_weapon_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        weapon_id INT NOT NULL,
        title VARCHAR(191) NULL,
        url VARCHAR(255) NOT NULL,
        alt_text TEXT NULL,
        prompt_text TEXT NULL,
        negative_prompt_text TEXT NULL,
        provider VARCHAR(64) NULL,
        model VARCHAR(64) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_mystery_weapon_image_weapon FOREIGN KEY (weapon_id) REFERENCES mystery_weapons(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");


    // Master Asset Tables
    Database::execute("CREATE TABLE IF NOT EXISTS mystery_master_characters (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mystery_id INT NOT NULL,
        slug VARCHAR(191) NOT NULL,
        name VARCHAR(191) NOT NULL,
        agent_id INT,
        is_law_enforcement TINYINT(1) DEFAULT 0,
        voice_profile_id INT,
        character_image_path VARCHAR(255),
        image_path VARCHAR(255),
        dob DATE,
        age INT,
        hometown VARCHAR(191),
        address VARCHAR(191),
        aliases_json JSON,
        ethnicity VARCHAR(191),
        zodiac VARCHAR(64),
        mbti VARCHAR(64),
        height VARCHAR(64),
        weight VARCHAR(64),
        eye_color VARCHAR(64),
        hair_color VARCHAR(64),
        distinguishing_marks TEXT,
        education TEXT,
        employment_json JSON,
        criminal_record TEXT,
        fav_color VARCHAR(64),
        fav_snack VARCHAR(191),
        fav_drink VARCHAR(191),
        fav_music VARCHAR(191),
        fav_hobby VARCHAR(191),
        fav_pet VARCHAR(191),
        voice_id VARCHAR(191),
        data_json JSON NULL,
        is_archived TINYINT(1) DEFAULT 0,
        is_regen_locked TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_mystery_slug (mystery_id, slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_master_locations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mystery_id INT NOT NULL,
        slug VARCHAR(191) NOT NULL,
        name VARCHAR(191) NOT NULL,
        description TEXT,
        location_id INT,
        data_json JSON NULL,
        address_line1 VARCHAR(191),
        address_line2 VARCHAR(191),
        city VARCHAR(191),
        region VARCHAR(191),
        postal_code VARCHAR(191),
        country VARCHAR(191),
        base_image_prompt TEXT,
        overlay_asset_prompt TEXT,
        overlay_trigger VARCHAR(191),
        is_archived TINYINT(1) DEFAULT 0,
        is_regen_locked TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_mystery_slug (mystery_id, slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_master_weapons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mystery_id INT NOT NULL,
        slug VARCHAR(191) NOT NULL,
        name VARCHAR(191) NOT NULL,
        description TEXT,
        data_json JSON NULL,
        is_archived TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_mystery_slug (mystery_id, slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_master_motives (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mystery_id INT NOT NULL,
        slug VARCHAR(191) NOT NULL,
        name VARCHAR(191) NOT NULL,
        description TEXT,
        data_json JSON NULL,
        is_archived TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_mystery_slug (mystery_id, slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Master Asset Related Tables
    Database::execute("CREATE TABLE IF NOT EXISTS mystery_master_character_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mystery_id INT NOT NULL,
        character_id INT NOT NULL,
        url VARCHAR(255) NOT NULL,
        kind VARCHAR(64),
        emotion VARCHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_master_char_img_char FOREIGN KEY (character_id) REFERENCES mystery_master_characters(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_master_location_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mystery_id INT NOT NULL,
        location_id INT NOT NULL,
        url VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_master_loc_img_loc FOREIGN KEY (location_id) REFERENCES mystery_master_locations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_master_weapon_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mystery_id INT NOT NULL,
        weapon_id INT NOT NULL,
        url VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_master_weap_img_weap FOREIGN KEY (weapon_id) REFERENCES mystery_master_weapons(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_master_motive_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mystery_id INT NOT NULL,
        motive_id INT NOT NULL,
        url VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_master_mot_img_mot FOREIGN KEY (motive_id) REFERENCES mystery_master_motives(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_master_asset_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mystery_id INT NOT NULL,
        asset_type VARCHAR(64) NOT NULL,
        asset_id INT NOT NULL,
        title VARCHAR(191) NULL,
        url VARCHAR(255) NOT NULL,
        alt_text TEXT NULL,
        prompt_text TEXT NULL,
        negative_prompt_text TEXT NULL,
        provider VARCHAR(64) NULL,
        model VARCHAR(64) NULL,
        meta_json JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_master_asset_field_locks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mystery_id INT NOT NULL,
        asset_type VARCHAR(64) NOT NULL,
        asset_id INT NOT NULL,
        field_name VARCHAR(191) NOT NULL,
        lock_key VARCHAR(191) NULL,
        is_locked TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_mystery_asset_field (mystery_id, asset_type, asset_id, field_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Master Asset Items / Clues
    Database::execute("CREATE TABLE IF NOT EXISTS mystery_master_asset_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mystery_id INT NOT NULL,
        asset_type VARCHAR(64) NOT NULL,
        asset_id INT NOT NULL,
        text TEXT NOT NULL,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_master_weapon_fingerprints (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mystery_id INT NOT NULL,
        weapon_id INT NOT NULL,
        fingerprint VARCHAR(191) NOT NULL,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_master_weap_fp_weap FOREIGN KEY (weapon_id) REFERENCES mystery_master_weapons(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS mystery_master_character_rapport_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mystery_id INT NOT NULL,
        master_character_id INT NOT NULL,
        kind VARCHAR(64) NOT NULL,
        value TEXT NOT NULL,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_master_char_rapport_char FOREIGN KEY (master_character_id) REFERENCES mystery_master_characters(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Ensure specific columns exist
    catn8_mystery_require_db_column('mystery_entities', 'data_json', "ALTER TABLE mystery_entities ADD COLUMN data_json JSON NULL AFTER name");
    
    // Ensure mystery_master_characters has voice_id before adding data_json relative to it
    catn8_mystery_require_db_column('mystery_master_characters', 'voice_id', "ALTER TABLE mystery_master_characters ADD COLUMN voice_id VARCHAR(191) AFTER fav_pet");
    catn8_mystery_require_db_column('mystery_master_characters', 'data_json', "ALTER TABLE mystery_master_characters ADD COLUMN data_json JSON NULL AFTER voice_id");
    catn8_mystery_require_db_column('mystery_master_locations', 'data_json', "ALTER TABLE mystery_master_locations ADD COLUMN data_json JSON NULL AFTER location_id");
    catn8_mystery_require_db_column('mystery_master_weapons', 'data_json', "ALTER TABLE mystery_master_weapons ADD COLUMN data_json JSON NULL AFTER description");
    catn8_mystery_require_db_column('mystery_master_motives', 'data_json', "ALTER TABLE mystery_master_motives ADD COLUMN data_json JSON NULL AFTER description");
    catn8_mystery_require_db_column('mystery_master_characters', 'is_regen_locked', "ALTER TABLE mystery_master_characters ADD COLUMN is_regen_locked TINYINT(1) DEFAULT 0 AFTER is_archived");
    catn8_mystery_require_db_column('mystery_master_locations', 'is_regen_locked', "ALTER TABLE mystery_master_locations ADD COLUMN is_regen_locked TINYINT(1) DEFAULT 0 AFTER is_archived");
    
    catn8_mystery_require_db_column('mystery_master_asset_field_locks', 'field_name', "ALTER TABLE mystery_master_asset_field_locks ADD COLUMN field_name VARCHAR(191) NOT NULL AFTER asset_id");
    catn8_mystery_require_db_column('mystery_master_asset_field_locks', 'lock_key', "ALTER TABLE mystery_master_asset_field_locks ADD COLUMN lock_key VARCHAR(191) NULL AFTER field_name");
    catn8_mystery_require_db_column('mystery_master_asset_field_locks', 'is_locked', "ALTER TABLE mystery_master_asset_field_locks ADD COLUMN is_locked TINYINT(1) DEFAULT 1 AFTER lock_key");
    catn8_mystery_require_db_column('mystery_master_asset_field_locks', 'updated_at', "ALTER TABLE mystery_master_asset_field_locks ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at");
    
    // Correct mystery_scenarios columns to use INT for ID references to catalog tables
    catn8_mystery_require_db_column('mystery_scenarios', 'crime_scene_location_id', "ALTER TABLE mystery_scenarios ADD COLUMN crime_scene_location_id INT NULL AFTER csi_detective_entity_id");
    catn8_mystery_require_db_column('mystery_scenarios', 'crime_scene_weapon_id', "ALTER TABLE mystery_scenarios ADD COLUMN crime_scene_weapon_id INT NULL AFTER crime_scene_location_id");
    catn8_mystery_require_db_column('mystery_scenarios', 'crime_scene_motive_id', "ALTER TABLE mystery_scenarios ADD COLUMN crime_scene_motive_id INT NULL AFTER crime_scene_weapon_id");

    // Fix column types if they were created as VARCHAR (from previous legacy schema)
    $res = Database::queryOne("SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_NAME = 'mystery_scenarios' AND COLUMN_NAME = 'crime_scene_weapon_id' AND TABLE_SCHEMA = DATABASE()");
    if ($res && $res['DATA_TYPE'] !== 'int') {
        Database::execute("ALTER TABLE mystery_scenarios MODIFY COLUMN crime_scene_location_id INT NULL");
        Database::execute("ALTER TABLE mystery_scenarios MODIFY COLUMN crime_scene_weapon_id INT NULL");
        Database::execute("ALTER TABLE mystery_scenarios MODIFY COLUMN crime_scene_motive_id INT NULL");
    }
    
    // Fix nullability of JSON columns safely
    $jsonTables = [
        'mystery_backstories' => ['meta_json'],
        'mystery_scenarios' => ['specs_json', 'constraints_json', 'csi_report_json'],
        'mystery_entities' => ['data_json', 'roles_json'],
        'mystery_scenario_entities' => ['override_json'],
        'mystery_scenario_lies' => ['trigger_questions_json'],
        'mystery_scenario_cold_hard_facts' => ['facts_json', 'annotations_json'],
        'mystery_run_sessions' => ['run_settings_json'],
        'mystery_generation_jobs' => ['spec_json', 'result_json'],
        'mystery_interrogation_events' => ['meta_json'],
        'mystery_conversation_events' => ['meta_json'],
        'mystery_case_notes' => ['content_rich_json'],
        'mystery_story_book_entries' => ['meta_json'],
        'mystery_master_asset_images' => ['meta_json'],
    ];

    foreach ($jsonTables as $tableName => $columns) {
        foreach ($columns as $columnName) {
            $colExists = Database::queryOne(
                "SELECT COLUMN_NAME FROM information_schema.COLUMNS 
                 WHERE TABLE_NAME = ? AND COLUMN_NAME = ? AND TABLE_SCHEMA = DATABASE() LIMIT 1",
                [$tableName, $columnName]
            );
            if ($colExists) {
                Database::execute("ALTER TABLE $tableName MODIFY COLUMN $columnName JSON NULL");
            }
        }
    }
    
    // Backstories table
    Database::execute("CREATE TABLE IF NOT EXISTS mystery_backstories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        mystery_id INT NOT NULL,
        owner_user_id INT NOT NULL,
        slug VARCHAR(191) NOT NULL,
        title VARCHAR(191) NOT NULL,
        backstory_summary TEXT,
        backstory_text TEXT,
        location_master_id INT,
        meta_json JSON NULL,
        spawned_case_id INT,
        is_archived TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_mystery_slug (mystery_id, slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Scenario specific tables
    require_once __DIR__ . '/admin_functions_csi.php';
    catn8_mystery_require_csi_columns();
}

function catn8_mystery_require_db_column(string $tableName, string $columnName, string $migrationScript): void {
    $row = Database::queryOne(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS 
         WHERE TABLE_NAME = ? AND COLUMN_NAME = ? AND TABLE_SCHEMA = DATABASE() LIMIT 1",
        [$tableName, $columnName]
    );
    if (!$row) {
        Database::execute($migrationScript);
    }
}
