<?php
// scripts/db/import_mystery_instructions.php
// Import Mystery game content from Mystery/Instructions into MySQL (idempotent)

declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');

require_once __DIR__ . '/../../api/config.php';

function catn8_import_json_respond(bool $ok, array $data = []): void
{
    echo json_encode(($ok ? ['success' => true] : ['success' => false]) + $data);
    exit;
}

function catn8_import_read_json_file(string $path): array
{
    if (!is_file($path)) {
        throw new RuntimeException('Missing file: ' . $path);
    }
    $raw = file_get_contents($path);
    if (!is_string($raw)) {
        throw new RuntimeException('Failed to read file: ' . $path);
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        throw new RuntimeException('Invalid JSON in file: ' . $path);
    }
    return $data;
}

function catn8_import_slugify(string $s): string
{
    $s = strtolower(trim($s));
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    $s = trim((string)$s, '-');
    return $s !== '' ? $s : 'item';
}

function catn8_import_require_table(string $table): void
{
    $cfg = function_exists('catn8_get_db_config') ? catn8_get_db_config('current') : [];
    $dbName = (string)($cfg['db'] ?? '');
    if ($dbName === '') {
        $dbName = (string)(getenv('CATN8_DB_LOCAL_NAME') ?: '');
    }
    if ($dbName === '') {
        throw new RuntimeException('DB name not configured (cannot validate table existence)');
    }

    $row = Database::queryOne(
        'SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1',
        [$dbName, $table]
    );
    if (!$row) {
        throw new RuntimeException(
            'Missing required table: ' . $table . '. Visit /api/mystery/admin.php?action=list_cases once (while logged in) to ensure tables are created.'
        );
    }
}

function catn8_import_get_admin_owner_user_id(): int
{
    catn8_import_require_table('users');

    $row = Database::queryOne('SELECT id FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1');
    if (!$row) {
        throw new RuntimeException('No admin user found in users table. Create/login as an admin user first.');
    }
    return (int)($row['id'] ?? 0);
}

function catn8_import_upsert_mystery(int $ownerUserId, string $slug, string $title, array $settings): int
{
    $row = Database::queryOne('SELECT id FROM mystery_mysteries WHERE owner_user_id = ? AND slug = ? LIMIT 1', [$ownerUserId, $slug]);
    $settingsJson = json_encode($settings);
    if (!is_string($settingsJson)) {
        $settingsJson = json_encode(new stdClass());
    }

    if ($row) {
        $id = (int)($row['id'] ?? 0);
        Database::execute(
            'UPDATE mystery_mysteries SET title = ?, settings_json = ?, is_archived = 0 WHERE id = ?',
            [$title, $settingsJson, $id]
        );
        return $id;
    }

    Database::execute(
        'INSERT INTO mystery_mysteries (owner_user_id, slug, title, settings_json, is_archived) VALUES (?, ?, ?, ?, 0)',
        [$ownerUserId, $slug, $title, $settingsJson]
    );
    $row2 = Database::queryOne('SELECT id FROM mystery_mysteries WHERE owner_user_id = ? AND slug = ? LIMIT 1', [$ownerUserId, $slug]);
    return (int)($row2['id'] ?? 0);
}

function catn8_import_upsert_voice_profile(int $mysteryId, string $voiceId): int
{
    $vid = trim($voiceId);
    if ($mysteryId <= 0 || $vid === '') return 0;

    Database::execute(
        'INSERT IGNORE INTO mystery_voice_profiles (mystery_id, voice_id, display_name, provider, language_code, ssml_gender, notes, is_archived) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
        [$mysteryId, $vid, $vid, '', '', '', '']
    );
    $row = Database::queryOne('SELECT id FROM mystery_voice_profiles WHERE mystery_id = ? AND voice_id = ? LIMIT 1', [$mysteryId, $vid]);
    return (int)($row['id'] ?? 0);
}

function catn8_import_upsert_game(int $ownerUserId, int $mysteryId, string $slug, string $title, string $description, array $globalSpecs): int
{
    $row = Database::queryOne('SELECT id FROM mystery_games WHERE owner_user_id = ? AND slug = ? LIMIT 1', [$ownerUserId, $slug]);
    $specsJson = json_encode($globalSpecs);
    if (!is_string($specsJson)) {
        $specsJson = json_encode(new stdClass());
    }

    if ($row) {
        $id = (int)($row['id'] ?? 0);
        Database::execute(
            'UPDATE mystery_games SET mystery_id = ?, title = ?, description = ?, global_specs_json = ?, is_archived = 0 WHERE id = ?',
            [$mysteryId > 0 ? $mysteryId : null, $title, $description, $specsJson, $id]
        );
        return $id;
    }

    Database::execute(
        'INSERT INTO mystery_games (owner_user_id, mystery_id, slug, title, description, global_specs_json, is_archived) VALUES (?, ?, ?, ?, ?, ?, 0)',
        [$ownerUserId, $mysteryId > 0 ? $mysteryId : null, $slug, $title, $description, $specsJson]
    );

    $row2 = Database::queryOne('SELECT id FROM mystery_games WHERE owner_user_id = ? AND slug = ? LIMIT 1', [$ownerUserId, $slug]);
    return (int)($row2['id'] ?? 0);
}

function catn8_import_enqueue_job(int $gameId, int $scenarioId, string $action, array $spec): void
{
    $specJson = json_encode($spec);
    if (!is_string($specJson)) {
        $specJson = json_encode(new stdClass());
    }

    $existing = Database::queryOne(
        "SELECT id FROM mystery_generation_jobs WHERE game_id = ? AND scenario_id = ? AND action = ? AND spec_json = ? AND status IN ('queued','running') LIMIT 1",
        [$gameId, $scenarioId, $action, $specJson]
    );
    if ($existing) {
        return;
    }

    Database::execute(
        'INSERT INTO mystery_generation_jobs (game_id, scenario_id, entity_id, action, spec_json, status, result_json, error_text) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)',
        [$gameId, $scenarioId, $action, $specJson, 'queued', json_encode(new stdClass()), '']
    );
}

function catn8_import_upsert_scenario(int $gameId, string $slug, string $title, string $status, array $specs, array $constraints): int
{
    $row = Database::queryOne('SELECT id FROM mystery_scenarios WHERE game_id = ? AND slug = ? LIMIT 1', [$gameId, $slug]);
    $specsJson = json_encode($specs);
    if (!is_string($specsJson)) {
        $specsJson = json_encode(new stdClass());
    }
    $constraintsJson = json_encode($constraints);
    if (!is_string($constraintsJson)) {
        $constraintsJson = json_encode(new stdClass());
    }

    if ($row) {
        $id = (int)($row['id'] ?? 0);
        Database::execute(
            'UPDATE mystery_scenarios SET title = ?, status = ?, specs_json = ?, constraints_json = ? WHERE id = ?',
            [$title, $status, $specsJson, $constraintsJson, $id]
        );
        return $id;
    }

    Database::execute(
        'INSERT INTO mystery_scenarios (game_id, slug, title, status, specs_json, constraints_json) VALUES (?, ?, ?, ?, ?, ?)',
        [$gameId, $slug, $title, $status, $specsJson, $constraintsJson]
    );

    $row2 = Database::queryOne('SELECT id FROM mystery_scenarios WHERE game_id = ? AND slug = ? LIMIT 1', [$gameId, $slug]);
    return (int)($row2['id'] ?? 0);
}

function catn8_import_upsert_entity(int $gameId, string $entityType, string $slug, string $name, array $data, array $roles = []): int
{
    $row = Database::queryOne('SELECT id FROM mystery_entities WHERE game_id = ? AND entity_type = ? AND slug = ? LIMIT 1', [$gameId, $entityType, $slug]);
    $dataJson = json_encode($data);
    if (!is_string($dataJson)) {
        $dataJson = json_encode(new stdClass());
    }

    $roles = array_values(array_unique(array_filter(array_map(static fn($v) => strtolower(trim((string)$v)), is_array($roles) ? $roles : []), static fn($v) => $v !== '')));
    $rolesJson = json_encode($roles);
    if (!is_string($rolesJson)) {
        $rolesJson = json_encode([]);
    }

    if ($row) {
        $id = (int)($row['id'] ?? 0);
        Database::execute('UPDATE mystery_entities SET name = ?, data_json = ?, roles_json = ?, is_archived = 0 WHERE id = ?', [$name, $dataJson, $rolesJson, $id]);
        return $id;
    }

    Database::execute(
        'INSERT INTO mystery_entities (game_id, entity_type, slug, name, data_json, roles_json, is_archived) VALUES (?, ?, ?, ?, ?, ?, 0)',
        [$gameId, $entityType, $slug, $name, $dataJson, $rolesJson]
    );

    $row2 = Database::queryOne('SELECT id FROM mystery_entities WHERE game_id = ? AND entity_type = ? AND slug = ? LIMIT 1', [$gameId, $entityType, $slug]);
    return (int)($row2['id'] ?? 0);
}

function catn8_import_attach_entity(int $scenarioId, int $entityId, string $role, array $override): void
{
    $row = Database::queryOne(
        'SELECT id FROM mystery_scenario_entities WHERE scenario_id = ? AND entity_id = ? LIMIT 1',
        [$scenarioId, $entityId]
    );

    $overrideJson = json_encode($override);
    if (!is_string($overrideJson)) {
        $overrideJson = json_encode(new stdClass());
    }

    if ($row) {
        Database::execute(
            'UPDATE mystery_scenario_entities SET role = ?, override_json = ? WHERE id = ?',
            [$role, $overrideJson, (int)($row['id'] ?? 0)]
        );
        return;
    }

    Database::execute(
        'INSERT INTO mystery_scenario_entities (scenario_id, entity_id, role, override_json) VALUES (?, ?, ?, ?)',
        [$scenarioId, $entityId, $role, $overrideJson]
    );
}

function catn8_import_upsert_case_note(int $scenarioId, string $title, string $noteType, array $contentRich, int $clueCount = 0): int
{
    $row = Database::queryOne(
        'SELECT id FROM mystery_case_notes WHERE scenario_id = ? AND title = ? AND note_type = ? LIMIT 1',
        [$scenarioId, $title, $noteType]
    );

    $contentJson = json_encode($contentRich);
    if (!is_string($contentJson)) {
        $contentJson = json_encode(['blocks' => []]);
    }

    if ($row) {
        $id = (int)($row['id'] ?? 0);
        Database::execute(
            'UPDATE mystery_case_notes SET content_rich_json = ?, clue_count = ?, is_archived = 0 WHERE id = ?',
            [$contentJson, $clueCount, $id]
        );
        return $id;
    }

    Database::execute(
        'INSERT INTO mystery_case_notes (scenario_id, title, note_type, content_rich_json, clue_count, is_archived) VALUES (?, ?, ?, ?, ?, 0)',
        [$scenarioId, $title, $noteType, $contentJson, $clueCount]
    );

    $row2 = Database::queryOne(
        'SELECT id FROM mystery_case_notes WHERE scenario_id = ? AND title = ? AND note_type = ? LIMIT 1',
        [$scenarioId, $title, $noteType]
    );
    return (int)($row2['id'] ?? 0);
}

function catn8_import_upsert_image_record(
    int $gameId,
    ?int $scenarioId,
    ?int $entityId,
    string $imageType,
    string $title,
    string $prompt,
    string $negativePrompt,
    array $params,
    string $status
): int {
    $row = Database::queryOne(
        'SELECT id FROM mystery_images WHERE game_id = ? AND COALESCE(scenario_id,0) = ? AND COALESCE(entity_id,0) = ? AND image_type = ? AND title = ? LIMIT 1',
        [$gameId, (int)($scenarioId ?? 0), (int)($entityId ?? 0), $imageType, $title]
    );

    $paramsJson = json_encode($params);
    if (!is_string($paramsJson)) {
        $paramsJson = json_encode(new stdClass());
    }

    if ($row) {
        $id = (int)($row['id'] ?? 0);
        Database::execute(
            'UPDATE mystery_images SET prompt_text = ?, negative_prompt_text = ?, params_json = ?, status = ? WHERE id = ?',
            [$prompt, $negativePrompt, $paramsJson, $status, $id]
        );
        return $id;
    }

    Database::execute(
        'INSERT INTO mystery_images (game_id, scenario_id, entity_id, image_type, title, prompt_text, negative_prompt_text, provider, model, params_json, status, uploads_file_id, url, alt_text, clue_notes, result_json, error_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)',
        [
            $gameId,
            $scenarioId,
            $entityId,
            $imageType,
            $title,
            $prompt,
            $negativePrompt,
            '',
            '',
            $paramsJson,
            $status,
            '',
            '',
            '',
            json_encode(new stdClass()),
            '',
        ]
    );

    $row2 = Database::queryOne(
        'SELECT id FROM mystery_images WHERE game_id = ? AND COALESCE(scenario_id,0) = ? AND COALESCE(entity_id,0) = ? AND image_type = ? AND title = ? LIMIT 1',
        [$gameId, (int)($scenarioId ?? 0), (int)($entityId ?? 0), $imageType, $title]
    );
    return (int)($row2['id'] ?? 0);
}

function catn8_import_upsert_master_character(int $mysteryId, string $slug, string $name, array $ap): int
{
    $agentId = (int)($ap['id'] ?? 0);
    $voiceId = trim((string)($ap['voice_id'] ?? ''));
    $voiceProfileId = $voiceId !== '' ? catn8_import_upsert_voice_profile($mysteryId, $voiceId) : 0;
    $imagePath = (string)($ap['image_path'] ?? '');
    $profile = $ap['static_profile'] ?? [];
    if (!is_array($profile)) $profile = [];

    $demo = $profile['demographics'] ?? [];
    if (!is_array($demo)) $demo = [];
    $appearance = $profile['appearance'] ?? [];
    if (!is_array($appearance)) $appearance = [];
    $psych = $profile['psychology'] ?? [];
    if (!is_array($psych)) $psych = [];
    $bg = $profile['background'] ?? [];
    if (!is_array($bg)) $bg = [];
    $fav = $profile['favorites'] ?? [];
    if (!is_array($fav)) $fav = [];

    $mbtiRaw = trim((string)($psych['mbti'] ?? ''));
    $mbti = strtoupper(preg_replace('/[^A-Z]/', '', $mbtiRaw) ?? '');
    if (strlen($mbti) > 8) {
        $mbti = substr($mbti, 0, 8);
    }

    $age = (int)($demo['age'] ?? 0);
    if ($age < 0) $age = 0;

    $dobRaw = trim((string)($demo['birthday'] ?? ''));
    $dob = null;
    if ($dobRaw !== '') {
        try {
            $dt = new DateTime($dobRaw);
            $dob = $dt->format('Y-m-d');
        } catch (Throwable $_e) {
            $dob = null;
        }
    }

    $isLaw = (int)($ap['id'] ?? 0) === 100 ? 1 : 0;

    $employment = $bg['employment'] ?? [];
    if (!is_array($employment)) $employment = [];
    $employmentJson = json_encode(array_values(array_map(static fn($v) => trim((string)$v), $employment)), JSON_UNESCAPED_SLASHES);
    if (!is_string($employmentJson)) $employmentJson = json_encode([], JSON_UNESCAPED_SLASHES);

    $aliasesJson = json_encode([], JSON_UNESCAPED_SLASHES);
    if (!is_string($aliasesJson)) $aliasesJson = json_encode([], JSON_UNESCAPED_SLASHES);

    Database::execute(
        'INSERT INTO mystery_master_characters (mystery_id, slug, name, accent_preference, agent_id, is_law_enforcement, voice_profile_id, character_image_path, image_path, dob, age, hometown, address, aliases_json, ethnicity, zodiac, mbti, height, weight, eye_color, hair_color, distinguishing_marks, education, employment_json, criminal_record, fav_color, fav_snack, fav_drink, fav_music, fav_hobby, fav_pet, is_archived, is_regen_locked)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
         ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            agent_id = VALUES(agent_id),
            is_law_enforcement = VALUES(is_law_enforcement),
            voice_profile_id = VALUES(voice_profile_id),
            image_path = VALUES(image_path),
            dob = VALUES(dob),
            age = VALUES(age),
            hometown = VALUES(hometown),
            ethnicity = VALUES(ethnicity),
            zodiac = VALUES(zodiac),
            mbti = VALUES(mbti),
            height = VALUES(height),
            distinguishing_marks = VALUES(distinguishing_marks),
            education = VALUES(education),
            employment_json = VALUES(employment_json),
            criminal_record = VALUES(criminal_record),
            fav_drink = VALUES(fav_drink),
            fav_snack = VALUES(fav_snack),
            fav_hobby = VALUES(fav_hobby),
            is_archived = 0',
        [
            $mysteryId,
            $slug,
            $name,
            '',
            $agentId,
            $isLaw,
            $voiceProfileId > 0 ? $voiceProfileId : null,
            $imagePath,
            $imagePath,
            $dob,
            $age,
            (string)($demo['hometown'] ?? ''),
            '',
            $aliasesJson,
            (string)($demo['ethnicity'] ?? ''),
            (string)($demo['zodiac'] ?? ''),
            $mbti,
            (string)($appearance['height'] ?? ''),
            '',
            '',
            '',
            (string)($appearance['distinguishing_marks'] ?? ''),
            (string)($bg['education'] ?? ''),
            $employmentJson,
            (string)($bg['criminal_record'] ?? ''),
            (string)($fav['color'] ?? ''),
            (string)($fav['snack'] ?? ($fav['food'] ?? '')),
            (string)($fav['drink'] ?? ''),
            (string)($fav['music'] ?? ''),
            (string)($fav['hobby'] ?? ''),
            (string)($fav['pet'] ?? ''),
        ]
    );

    $row = Database::queryOne('SELECT id FROM mystery_master_characters WHERE mystery_id = ? AND slug = ? LIMIT 1', [$mysteryId, $slug]);
    return (int)($row['id'] ?? 0);
}

function catn8_import_upsert_master_location(int $mysteryId, string $slug, string $name, array $data): int
{
    Database::execute(
        'INSERT INTO mystery_master_locations (mystery_id, slug, name, description, location_id, base_image_prompt, overlay_asset_prompt, overlay_trigger, is_archived, is_regen_locked)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
         ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            description = COALESCE(NULLIF(description, \'\'), VALUES(description)),
            location_id = COALESCE(NULLIF(location_id, \'\'), VALUES(location_id)),
            base_image_prompt = COALESCE(base_image_prompt, VALUES(base_image_prompt)),
            overlay_asset_prompt = COALESCE(overlay_asset_prompt, VALUES(overlay_asset_prompt)),
            overlay_trigger = COALESCE(overlay_trigger, VALUES(overlay_trigger)),
            is_archived = 0',
        [
            $mysteryId,
            $slug,
            $name,
            (string)($data['description'] ?? ''),
            (string)($data['location_id'] ?? ''),
            (string)($data['base_image_prompt'] ?? ''),
            (string)($data['overlay_asset_prompt'] ?? ''),
            (string)($data['overlay_trigger'] ?? ''),
        ]
    );

    $row = Database::queryOne('SELECT id FROM mystery_master_locations WHERE mystery_id = ? AND slug = ? LIMIT 1', [$mysteryId, $slug]);
    return (int)($row['id'] ?? 0);
}

function catn8_import_upsert_master_weapon(int $mysteryId, string $slug, string $name, array $data): int
{
    Database::execute(
        'INSERT INTO mystery_master_weapons (mystery_id, slug, name, description, is_archived, is_regen_locked) VALUES (?, ?, ?, ?, 0, 0)
         ON DUPLICATE KEY UPDATE name = VALUES(name), description = COALESCE(NULLIF(description, \'\'), VALUES(description)), is_archived = 0',
        [$mysteryId, $slug, $name, (string)($data['description'] ?? '')]
    );

    $row = Database::queryOne('SELECT id FROM mystery_master_weapons WHERE mystery_id = ? AND slug = ? LIMIT 1', [$mysteryId, $slug]);
    $weaponId = (int)($row['id'] ?? 0);

    $fps = $data['fingerprints'] ?? [];
    if ($weaponId > 0 && is_array($fps)) {
        Database::execute('DELETE FROM mystery_master_weapon_fingerprints WHERE mystery_id = ? AND weapon_id = ?', [$mysteryId, $weaponId]);
        $i = 0;
        foreach ($fps as $fp) {
            $val = trim((string)$fp);
            if ($val === '') {
                $i++;
                continue;
            }
            Database::execute(
                'INSERT INTO mystery_master_weapon_fingerprints (mystery_id, weapon_id, fingerprint, sort_order) VALUES (?, ?, ?, ?)',
                [$mysteryId, $weaponId, $val, $i]
            );
            $i++;
        }
    }
    return $weaponId;
}

function catn8_import_upsert_master_motive(int $mysteryId, string $slug, string $name, array $data): int
{
    Database::execute(
        'INSERT INTO mystery_master_motives (mystery_id, slug, name, description, is_archived, is_regen_locked) VALUES (?, ?, ?, ?, 0, 0)
         ON DUPLICATE KEY UPDATE name = VALUES(name), description = COALESCE(NULLIF(description, \'\'), VALUES(description)), is_archived = 0',
        [$mysteryId, $slug, $name, (string)($data['description'] ?? '')]
    );

    $row = Database::queryOne('SELECT id FROM mystery_master_motives WHERE mystery_id = ? AND slug = ? LIMIT 1', [$mysteryId, $slug]);
    return (int)($row['id'] ?? 0);
}

try {
    Database::getInstance();
} catch (Throwable $e) {
    catn8_import_json_respond(false, ['error' => 'DB connection failed: ' . $e->getMessage()]);
}

try {
    catn8_import_require_table('mystery_games');
    catn8_import_require_table('mystery_scenarios');
    catn8_import_require_table('mystery_entities');
    catn8_import_require_table('mystery_scenario_entities');
    catn8_import_require_table('mystery_case_notes');
    catn8_import_require_table('mystery_images');
    catn8_import_require_table('mystery_generation_jobs');
    catn8_import_require_table('mystery_master_characters');
    catn8_import_require_table('mystery_master_locations');
    catn8_import_require_table('mystery_master_weapons');
    catn8_import_require_table('mystery_master_motives');
    catn8_import_require_table('mystery_mysteries');
    catn8_import_require_table('mystery_voice_profiles');
    catn8_import_require_table('mystery_master_weapon_fingerprints');

    $root = realpath(__DIR__ . '/../../Mystery/Instructions');
    if (!is_string($root) || $root === '') {
        throw new RuntimeException('Could not resolve Mystery/Instructions path');
    }

    $manifest = catn8_import_read_json_file($root . '/game_manifest.json');
    $scenarioCore = catn8_import_read_json_file($root . '/scenario_core_01.json');
    $solution = catn8_import_read_json_file($root . '/solution_01.json');
    $suspectClues = catn8_import_read_json_file($root . '/suspect_clues_01.json');
    $agentProfiles = catn8_import_read_json_file($root . '/agents_profiles.json');
    $locationImagePrompts = catn8_import_read_json_file($root . '/location_image_prompts.json');
    $motivesList = catn8_import_read_json_file($root . '/motives_list.json');
    $weaponsList = catn8_import_read_json_file($root . '/weapons_list.json');
    $cfgEasy = catn8_import_read_json_file($root . '/config_01_easy.json');
    $cfgMedium = catn8_import_read_json_file($root . '/config_01_medium.json');
    $cfgHard = catn8_import_read_json_file($root . '/config_01_hard.json');

    $ownerUserId = catn8_import_get_admin_owner_user_id();

    $gameTitle = (string)($manifest['project_name'] ?? 'Mystery Game');
    $gameSlug = catn8_import_slugify((string)($manifest['project_name'] ?? 'mystery-game'));
    $gameDesc = (string)($manifest['setting'] ?? '');

    $mysterySlug = $gameSlug;
    $mysterySettings = [
        'manifest_version' => (string)($manifest['manifest_version'] ?? ''),
        'author' => (string)($manifest['author'] ?? ''),
        'setting' => (string)($manifest['setting'] ?? ''),
        'source' => ['type' => 'mystery_instructions', 'path' => 'Mystery/Instructions'],
    ];

    $globalSpecs = [
        'manifest_version' => (string)($manifest['manifest_version'] ?? ''),
        'project_name' => $gameTitle,
        'author' => (string)($manifest['author'] ?? ''),
        'setting' => (string)($manifest['setting'] ?? ''),
        'source' => ['type' => 'mystery_instructions', 'path' => 'Mystery/Instructions'],
    ];

    Database::beginTransaction();

    $mysteryId = catn8_import_upsert_mystery($ownerUserId, $mysterySlug, $gameTitle, $mysterySettings);
    if (!$mysteryId) {
        throw new RuntimeException('Failed to upsert mystery');
    }

    $gameId = catn8_import_upsert_game($ownerUserId, $mysteryId, $gameSlug, $gameTitle, $gameDesc, $globalSpecs);
    if (!$gameId) {
        throw new RuntimeException('Failed to upsert mystery game');
    }

    $masterCharacterIds = [];
    if (is_array($agentProfiles)) {
        foreach ($agentProfiles as $ap) {
            if (!is_array($ap)) continue;
            $agentId = (int)($ap['id'] ?? 0);
            $name = trim((string)($ap['name'] ?? ''));
            if ($agentId <= 0 || $name === '') continue;

            $slug = catn8_import_slugify($name);
            if ($slug === '') continue;

            $mid = catn8_import_upsert_master_character($mysteryId, $slug, $name, $ap);
            if ($mid > 0) {
                $masterCharacterIds[] = $mid;
            }
        }
    }

    $masterLocationIds = [];
    $locationPromptByName = [];
    if (is_array($locationImagePrompts)) {
        foreach ($locationImagePrompts as $lp) {
            if (!is_array($lp)) continue;
            $name = trim((string)($lp['name'] ?? ''));
            if ($name === '') continue;
            $locationPromptByName[$name] = $lp;
        }
    }

    $seenLocationNames = [];
    $scenarioLocations = $scenarioCore['locations'] ?? [];
    if (!is_array($scenarioLocations)) $scenarioLocations = [];

    foreach ($scenarioLocations as $locNameRaw) {
        $locName = trim((string)$locNameRaw);
        if ($locName === '' || isset($seenLocationNames[$locName])) continue;
        $seenLocationNames[$locName] = true;

        $slug = catn8_import_slugify($locName);
        if ($slug === '') continue;

        $lp = $locationPromptByName[$locName] ?? null;
        $data = [
            'source' => ['type' => 'mystery_instructions', 'path' => 'Mystery/Instructions/scenario_core_01.json'],
        ];
        if (is_array($lp)) {
            $data['location_id'] = (string)($lp['location_id'] ?? '');
            $data['base_image_prompt'] = (string)($lp['base_image_prompt'] ?? '');
            $data['overlay_asset_prompt'] = (string)($lp['overlay_asset_prompt'] ?? '');
            $data['overlay_trigger'] = (string)($lp['overlay_trigger'] ?? '');
        }

        $mid = catn8_import_upsert_master_location($mysteryId, $slug, $locName, $data);
        if ($mid > 0) {
            $masterLocationIds[] = $mid;
        }
    }

    if (is_array($locationImagePrompts)) {
        foreach ($locationImagePrompts as $lp) {
            if (!is_array($lp)) continue;
            $locName = trim((string)($lp['name'] ?? ''));
            if ($locName === '' || isset($seenLocationNames[$locName])) continue;
            $seenLocationNames[$locName] = true;

            $slug = catn8_import_slugify($locName);
            if ($slug === '') continue;

            $data = [
                'location_id' => (string)($lp['location_id'] ?? ''),
                'base_image_prompt' => (string)($lp['base_image_prompt'] ?? ''),
                'overlay_asset_prompt' => (string)($lp['overlay_asset_prompt'] ?? ''),
                'overlay_trigger' => (string)($lp['overlay_trigger'] ?? ''),
                'source' => ['type' => 'mystery_instructions', 'path' => 'Mystery/Instructions/location_image_prompts.json'],
            ];

            $mid = catn8_import_upsert_master_location($mysteryId, $slug, $locName, $data);
            if ($mid > 0) {
                $masterLocationIds[] = $mid;
            }
        }
    }

    $masterWeaponIds = [];
    $weaponSpecBySlug = [];

    if (is_array($weaponsList)) {
        foreach ($weaponsList as $w) {
            $name = trim((string)$w);
            if ($name === '') continue;
            $slug = catn8_import_slugify($name);
            if ($slug === '') continue;

            $weaponSpecBySlug[$slug] = [
                'name' => $name,
                'data' => [
                    'source' => ['type' => 'mystery_instructions', 'path' => 'Mystery/Instructions/weapons_list.json'],
                ],
            ];
        }
    }

    $weapon = $scenarioCore['evidence_database']['weapon'] ?? null;
    if (is_array($weapon)) {
        $weaponName = trim((string)($weapon['name'] ?? ''));
        if ($weaponName !== '') {
            $slug = catn8_import_slugify($weaponName);
            if ($slug !== '') {
                $data = [
                    'description' => (string)($weapon['description'] ?? ''),
                    'fingerprints' => $weapon['fingerprints'] ?? [],
                    'source' => ['type' => 'mystery_instructions', 'path' => 'Mystery/Instructions/scenario_core_01.json'],
                ];
                if (!is_array($data['fingerprints'])) $data['fingerprints'] = [];

                $weaponSpecBySlug[$slug] = [
                    'name' => $weaponName,
                    'data' => $data,
                ];
            }
        }
    }

    foreach ($weaponSpecBySlug as $slug => $spec) {
        $name = trim((string)($spec['name'] ?? ''));
        $data = $spec['data'] ?? [];
        if ($name === '' || !is_array($data)) continue;
        $mid = catn8_import_upsert_master_weapon($mysteryId, (string)$slug, $name, $data);
        if ($mid > 0) {
            $masterWeaponIds[] = $mid;
        }
    }

    $masterMotiveIds = [];
    if (is_array($motivesList)) {
        foreach ($motivesList as $m) {
            $name = trim((string)$m);
            if ($name === '') continue;
            $slug = catn8_import_slugify($name);
            if ($slug === '') continue;
            $mid = catn8_import_upsert_master_motive($mysteryId, $slug, $name, []);
            if ($mid > 0) {
                $masterMotiveIds[] = $mid;
            }
        }
    }

    $scenarioSlug = catn8_import_slugify((string)($scenarioCore['scenario_id'] ?? 'core_01'));
    $scenarioTitle = (string)($scenarioCore['title'] ?? 'Scenario');

    $scenarioSpecs = [
        'scenario_id' => (string)($scenarioCore['scenario_id'] ?? ''),
        'setting' => (string)($scenarioCore['setting'] ?? ''),
        'narrative_summary' => (string)($scenarioCore['narrative_summary'] ?? ''),
        'victim' => $scenarioCore['victim'] ?? new stdClass(),
        'evidence_database' => $scenarioCore['evidence_database'] ?? new stdClass(),
        'locations' => $scenarioCore['locations'] ?? [],
        'solution' => $solution,
        'case_setup' => [
            'available_master_character_ids' => array_values(array_unique(array_map('intval', $masterCharacterIds))),
            'available_master_location_ids' => array_values(array_unique(array_map('intval', $masterLocationIds))),
            'available_master_weapon_ids' => array_values(array_unique(array_map('intval', $masterWeaponIds))),
            'available_master_motive_ids' => array_values(array_unique(array_map('intval', $masterMotiveIds))),
        ],
    ];

    $scenarioConstraints = [
        'difficulty_configs' => [
            'easy' => $cfgEasy,
            'medium' => $cfgMedium,
            'hard' => $cfgHard,
        ],
        'winning_criteria' => $solution['winning_criteria'] ?? new stdClass(),
    ];

    $scenarioId = catn8_import_upsert_scenario($gameId, $scenarioSlug, $scenarioTitle, 'draft', $scenarioSpecs, $scenarioConstraints);
    if (!$scenarioId) {
        throw new RuntimeException('Failed to upsert scenario');
    }

    $masterMotivesImported = count($masterMotiveIds);

    // 1) Upsert suspects
    $entityIdsByAgentId = [];
    foreach ($agentProfiles as $ap) {
        if (!is_array($ap)) continue;
        $agentId = (int)($ap['id'] ?? 0);
        $name = (string)($ap['name'] ?? '');
        if ($agentId <= 0 || $name === '') continue;

        $slug = catn8_import_slugify($name);
        $data = [
            'agent_id' => $agentId,
            'voice_id' => (string)($ap['voice_id'] ?? ''),
            'image_path' => (string)($ap['image_path'] ?? ''),
            'static_profile' => $ap['static_profile'] ?? new stdClass(),
            'flags' => [
                'is_suspect' => true,
            ],
        ];

        $eid = catn8_import_upsert_entity($gameId, 'character', $slug, $name, $data, ['suspect']);
        if ($eid) {
            $entityIdsByAgentId[$agentId] = $eid;
            catn8_import_attach_entity($scenarioId, $eid, 'suspect', []);
        }
    }

    // 2) Add Sheriff (non-suspect)
    $chiefName = 'Sheriff Hank Mercer';
    $chiefSlug = catn8_import_slugify($chiefName);
    $chiefProfile = [
        'demographics' => [
            'age' => 58,
            'hometown' => 'Dawsonville, GA',
            'ethnicity' => 'White',
            'zodiac' => 'Leo',
        ],
        'appearance' => [
            'height' => "6'0\"",
            'style' => 'Pressed uniform shirt under a worn leather jacket, badge polished, coffee stains on the cuff.',
            'distinguishing_marks' => 'A thin scar along the right eyebrow from a long-ago bar fight call.',
        ],
        'psychology' => [
            'mbti' => 'ISTJ (The Inspector)',
            'phobia' => 'Loss of control / public scandal',
            'tech_literacy' => 'Moderate (Uses department systems, distrusts new apps).',
            'political_leaning' => 'Law-and-order pragmatist.',
            'childhood_memory' => 'Listening to police radio chatter from his father’s cruiser, swearing he’d “do it right.”',
        ],
        'background' => [
            'education' => 'Criminal Justice, Georgia State (Night school, 1990).',
            'criminal_record' => 'Clean (two internal affairs complaints, both “unsubstantiated”).',
            'employment' => [
                'Patrol Officer (1989–1996)',
                'Detective (1996–2008)',
                'Captain (2008–2018)',
                'Sheriff, Dawsonville (2018–Present)',
            ],
            'financials' => [
                'income' => '$115k/year',
                'assets' => 'A modest home off Hwy 9, a 2006 F-150, a locked filing cabinet no one is allowed to touch.',
                'debt_vulnerability' => 'Medium. College tuition and medical bills make him “motivatable.”',
            ],
        ],
        'favorites' => [
            'drink' => 'Black coffee (burnt, always)',
            'food' => 'Diner meatloaf',
            'hobby' => 'Rebuilding antique radios',
        ],
        'daily_routine' => 'Up at 4:45 AM. Coffee. Reads incident reports. Shows up early so nobody sees what he does in the records room.',
        'plot_hooks' => [
            'accomplice_hook' => 'In a future scenario, Hank may have quietly redirected evidence or slowed paperwork to protect an ally (or himself).',
        ],
    ];

    $chiefData = [
        'agent_id' => 100,
        'voice_id' => 'male_sheriff_gravel',
        'image_path' => 'sheriff.png',
        'static_profile' => $chiefProfile,
        'flags' => [
            'is_suspect' => false,
            'is_sheriff' => true,
            'accomplice_possible' => true,
        ],
    ];

    $chiefEntityId = catn8_import_upsert_entity($gameId, 'character', $chiefSlug, $chiefName, $chiefData, ['sheriff']);
    if ($chiefEntityId) {
        catn8_import_attach_entity($scenarioId, $chiefEntityId, 'sheriff', []);
    }

    // 3) Seed images (records only; generation happens via jobs)
    $queuedImageJobs = 0;
    $queuedCaseJobs = 0;

    foreach ($locationImagePrompts as $lp) {
        if (!is_array($lp)) continue;
        $locName = (string)($lp['name'] ?? 'Location');
        $base = (string)($lp['base_image_prompt'] ?? '');
        if ($base === '') continue;
        $imageId = catn8_import_upsert_image_record($gameId, $scenarioId, null, 'crime_scene', $locName, $base, '', ['location_id' => (string)($lp['location_id'] ?? '')], 'missing');
        if ($imageId) {
            catn8_import_enqueue_job($gameId, $scenarioId, 'generate_crime_scene_image', ['image_id' => $imageId]);
            $queuedImageJobs++;
        }
    }

    // 4) Seed an opening briefing case note (Sheriff)
    $victimName = (string)($scenarioCore['victim']['name'] ?? 'the victim');
    $victimCause = (string)($scenarioCore['victim']['cause_of_death'] ?? 'Unknown');
    $victimTime = (string)($scenarioCore['victim']['time_of_death'] ?? 'Unknown');
    $setting = (string)($scenarioCore['setting'] ?? '');

    $briefingText = "You’re new. I know it. First day on the job and you’ve already drawn blood.\n\nHere’s what you get: the case notes binder, the police report, and the interrogation log. Treat them like evidence — because they are.\n\nEight suspects are in custody downstairs. We’ve got three hours left before we have to start cutting them loose. That’s not a preference — it’s procedure.\n\nHere’s the rule: when someone’s arrested without a warrant, the Constitution requires a prompt determination that we actually had probable cause. Courts have said that usually means within 48 hours. Some states run tighter — 24 hours — and the clock doesn’t care how long booking takes.\n\nSo we work fast, we work clean, and we don’t get cute with someone’s rights. You find me probable cause that sticks, or those doors open.";

    $briefingNote = [
        'blocks' => [
            ['style' => 'typed', 'text' => 'DETECTIVE DIVISION — INITIAL BRIEFING'],
            ['style' => 'typed', 'text' => 'From: Sheriff Hank Mercer'],
            ['style' => 'typed', 'text' => 'To: You'],
            ['style' => 'typed', 'text' => 'Timestamp: 03:00:00 remaining'],
            ['style' => 'typed', 'text' => $briefingText],
            ['style' => 'scribble', 'text' => 'Don’t trust anyone who knows where the paperwork sleeps.'],
        ],
        'tags' => ['CONFIDENTIAL', 'TIME-CRITICAL'],
        'annotations' => [
            ['type' => 'margin_note', 'text' => 'Eight suspects. Three hours. Keep pressure on timelines.'],
        ],
    ];

    catn8_import_upsert_case_note($scenarioId, "Sheriff's Briefing", 'detective_note', $briefingNote, 0);

    // 4.1) Seed Police Report (official facts + mild clues)
    $policeReport = [
        'blocks' => [
            ['style' => 'typed', 'text' => 'POLICE REPORT'],
            ['style' => 'typed', 'text' => 'Agency: Dawson County Police Department'],
            ['style' => 'typed', 'text' => 'Case: Homicide Investigation'],
            ['style' => 'typed', 'text' => 'Location: ' . $setting],
            ['style' => 'typed', 'text' => 'Victim: ' . $victimName],
            ['style' => 'typed', 'text' => 'Cause of death (prelim): ' . $victimCause],
            ['style' => 'typed', 'text' => 'Estimated time of death: ' . $victimTime],
            ['style' => 'typed', 'text' => 'Summary: Victim collapsed during the New Year’s gathering. Scene secured due to weather conditions and safety. Initial witness accounts conflict on who left the Great Room after midnight.'],
            ['style' => 'typed', 'text' => 'Evidence (prelim): A distinctive odor noted at the mouth (reported as “almonds”), and a private drink container handled by multiple parties.'],
            ['style' => 'typed', 'text' => 'Clue (mild): Several staff recall the victim refused champagne and insisted on a personal jar kept under the bar.' ],
            ['style' => 'typed', 'text' => 'Clue (mild): Mud tracked near the deck suggests someone moved between the deck and the river trail close to the estimated time of death.' ],
        ],
        'tags' => ['OFFICIAL', 'EVIDENCE'],
        'annotations' => [
            ['type' => 'stamp', 'text' => 'PRELIMINARY'],
        ],
    ];
    catn8_import_upsert_case_note($scenarioId, 'Police Report', 'forensics_report', $policeReport, 2);

    // 4.2) Seed Interrogation Log (will be appended via API as interviews occur)
    $interrogationLog = [
        'blocks' => [
            ['style' => 'typed', 'text' => 'INTERROGATION LOG'],
            ['style' => 'typed', 'text' => 'Scenario: ' . $scenarioTitle],
            ['style' => 'typed', 'text' => 'Entries appended automatically as interviews occur.'],
        ],
        'tags' => ['EVIDENCE', 'CHAIN-OF-CUSTODY'],
        'annotations' => [],
    ];
    catn8_import_upsert_case_note($scenarioId, 'Interrogation Log', 'detective_note', $interrogationLog, 0);

    catn8_import_enqueue_job($gameId, $scenarioId, 'generate_crime_details', ['scenario_id' => $scenarioId]);
    catn8_import_enqueue_job($gameId, $scenarioId, 'generate_lies', ['scenario_id' => $scenarioId]);

    catn8_import_enqueue_job($gameId, $scenarioId, 'generate_case_notes', ['scenario_id' => $scenarioId]);
    $queuedCaseJobs++;

    // 5) Seed clue notes (from suspect_clues) as basic case notes for now
    foreach ($suspectClues as $c) {
        if (!is_array($c)) continue;
        $name = (string)($c['name'] ?? 'Suspect');
        $clue = (string)($c['clue'] ?? '');
        if ($clue === '') continue;

        $note = [
            'blocks' => [
                ['style' => 'typed', 'text' => 'FIELD NOTE'],
                ['style' => 'typed', 'text' => 'Source: ' . $name],
                ['style' => 'typed', 'text' => 'Trigger topic: ' . (string)($c['trigger_topic'] ?? '')],
                ['style' => 'typed', 'text' => $clue],
                ['style' => 'handwritten', 'text' => 'Why they know it: ' . (string)($c['reason_known'] ?? '')],
            ],
            'tags' => ['EVIDENCE'],
            'annotations' => [],
        ];

        catn8_import_upsert_case_note($scenarioId, 'Clue — ' . $name, 'witness_statement', $note, 1);
    }

    Database::commit();

    catn8_import_json_respond(true, [
        'owner_user_id' => $ownerUserId,
        'mystery' => ['id' => $mysteryId, 'slug' => $mysterySlug, 'title' => $gameTitle],
        'game' => ['id' => $gameId, 'slug' => $gameSlug, 'title' => $gameTitle],
        'scenario' => ['id' => $scenarioId, 'slug' => $scenarioSlug, 'title' => $scenarioTitle],
        'entities_imported' => count($entityIdsByAgentId) + ($chiefEntityId ? 1 : 0),
        'master_motives_imported' => $masterMotivesImported,
        'master_characters_imported' => count($masterCharacterIds),
        'master_locations_imported' => count($masterLocationIds),
        'master_weapons_imported' => count($masterWeaponIds),
        'jobs_queued' => [
            'images' => $queuedImageJobs,
            'case_notes' => $queuedCaseJobs,
        ],
    ]);
} catch (Throwable $e) {
    if (Database::inTransaction()) {
        try {
            Database::rollBack();
        } catch (Throwable $e2) {
            // ignore
        }
    }
    catn8_import_json_respond(false, ['error' => $e->getMessage()]);
}
