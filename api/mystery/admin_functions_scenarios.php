<?php

require_once __DIR__ . '/admin_functions_scenarios_bootstrap_cast.php';
require_once __DIR__ . '/admin_functions_scenarios_bootstrap_roles.php';
require_once __DIR__ . '/admin_functions_scenarios_bootstrap_locations.php';

/**
 * Ensures Sheriff Hank Mercer exists in the master characters table.
 */
function catn8_mystery_ensure_hank_master(int $mysteryId): array {
    $row = Database::queryOne(
        'SELECT id, slug, name, is_law_enforcement FROM mystery_master_characters WHERE mystery_id = ? AND slug = ? LIMIT 1',
        [$mysteryId, 'sheriff_hank_mercer']
    );
    if ($row) {
        if ((int)($row['is_law_enforcement'] ?? 0) !== 1) {
            Database::execute(
                'UPDATE mystery_master_characters SET is_law_enforcement = 1 WHERE id = ? AND mystery_id = ? LIMIT 1',
                [(int)($row['id'] ?? 0), $mysteryId]
            );
            $row['is_law_enforcement'] = 1;
        }
        return $row;
    }

    // Create a minimal master character record for Hank (required NOT NULL columns).
    Database::execute(
        "INSERT INTO mystery_master_characters (mystery_id, slug, name, agent_id, is_law_enforcement, voice_profile_id, character_image_path, image_path, dob, age, hometown, address, aliases_json, ethnicity, zodiac, mbti, height, weight, eye_color, hair_color, distinguishing_marks, education, employment_json, criminal_record, fav_color, fav_snack, fav_drink, fav_music, fav_hobby, fav_pet, is_archived, is_regen_locked)\n" .
        "VALUES (?, ?, ?, 0, 1, NULL, '', '', NULL, 0, '', '', ?, '', '', '', '', '', '', '', '', '', ?, '', '', '', '', '', '', '', 0, 0)",
        [$mysteryId, 'sheriff_hank_mercer', 'Sheriff Hank Mercer', json_encode([], JSON_UNESCAPED_SLASHES), json_encode([], JSON_UNESCAPED_SLASHES)]
    );
    $row2 = Database::queryOne(
        'SELECT id, slug, name, is_law_enforcement FROM mystery_master_characters WHERE mystery_id = ? AND slug = ? LIMIT 1',
        [$mysteryId, 'sheriff_hank_mercer']
    );
    return $row2 ?: ['id' => 0, 'slug' => 'sheriff_hank_mercer', 'name' => 'Sheriff Hank Mercer', 'is_law_enforcement' => 1];
}

/**
 * Normalizes an array of roles.
 */
function catn8_mystery_normalize_roles($rolesInput): array {
    $arr = is_array($rolesInput) ? $rolesInput : [];
    $arr = array_map(static fn($v) => trim((string)$v), $arr);
    $arr = array_filter($arr, static fn($v) => $v !== '');
    $arr = array_values(array_unique($arr));
    return $arr;
}

/**
 * Merges a role into a character's roles_json in mystery_entities.
 */
function catn8_mystery_merge_entity_role(int $caseId, int $entityId, string $role): void {
    $eid = (int)$entityId;
    $cid = (int)$caseId;
    $r = strtolower(trim((string)$role));
    if ($cid <= 0 || $eid <= 0 || $r === '') return;

    $row = Database::queryOne(
        "SELECT roles_json FROM mystery_entities WHERE id = ? AND game_id = ? AND entity_type = 'character' LIMIT 1",
        [$eid, $cid]
    );
    $existing = json_decode((string)(($row && isset($row['roles_json'])) ? $row['roles_json'] : '[]'), true);
    $existing = catn8_mystery_normalize_roles($existing);
    $existing[] = $r;
    $next = catn8_mystery_normalize_roles($existing);
    $json = json_encode($next, JSON_UNESCAPED_SLASHES);
    if (!is_string($json)) $json = json_encode([], JSON_UNESCAPED_SLASHES);
    Database::execute(
        'UPDATE mystery_entities SET roles_json = ? WHERE id = ? AND game_id = ? AND entity_type = \'character\' LIMIT 1',
        [$json, $eid, $cid]
    );
}

/**
 * Loads non-archived characters for a case.
 */
function catn8_mystery_load_case_characters(int $caseId): array {
    return Database::queryAll(
        "SELECT id, slug, name, data_json, roles_json\n" .
        "FROM mystery_entities\n" .
        "WHERE game_id = ? AND entity_type = 'character' AND is_archived = 0\n" .
        "ORDER BY id ASC",
        [$caseId]
    );
}

/**
 * Picks a candidate character ID from a list that is not in the exclude list.
 */
function catn8_mystery_pick_role_candidate(array $chars, array $exclude): int {
    foreach ($chars as $r) {
        $eid = (int)$r['id'] ?? 0;
        if ($eid <= 0) continue;
        if (isset($exclude[$eid])) continue;
        return $eid;
    }
    return 0;
}

/**
 * Ensures a character has a specific role in a scenario.
 */
function catn8_mystery_ensure_scenario_entity_role(int $scenarioId, int $entityId, string $role): void {
    if ($scenarioId <= 0 || $entityId <= 0 || $role === '') return;
    Database::execute(
        'INSERT IGNORE INTO mystery_scenario_entities (scenario_id, entity_id, role, override_json) VALUES (?, ?, ?, ?)',
        [$scenarioId, $entityId, $role, json_encode(new stdClass())]
    );
}

/**
 * Cleans up Hank Mercer duplicates/legacy entities in a scenario.
 */
function catn8_mystery_cleanup_hank_duplicates(int $scenarioId, int $sheriffId, int $caseId): void {
    try {
        $dupRows = Database::queryAll(
            'SELECT se.entity_id, e.slug, e.name, e.data_json
             FROM mystery_scenario_entities se
             INNER JOIN mystery_entities e ON e.id = se.entity_id
             WHERE se.scenario_id = ? AND se.entity_id <> ?',
            [$scenarioId, $sheriffId]
        );
        foreach ($dupRows as $dr) {
            $eid = (int)($dr['entity_id'] ?? 0);
            if ($eid <= 0) continue;
            $slug = strtolower(trim((string)($dr['slug'] ?? '')));
            $name = strtolower(trim((string)($dr['name'] ?? '')));
            $data = json_decode((string)($dr['data_json'] ?? '{}'), true);
            if (!is_array($data)) $data = [];
            $ms = strtolower(trim((string)($data['master_slug'] ?? '')));
            $agentId = (int)($data['agent_id'] ?? 0);

            $isHankLike = ($slug === 'sheriff_hank_mercer' || $ms === 'sheriff_hank_mercer' || $name === 'sheriff hank mercer');
            $isLegacySheriffLike = ($agentId === 100 || $slug === 'sheriff' || $name === 'sheriff');

            if ($isHankLike || $isLegacySheriffLike) {
                Database::execute(
                    'DELETE FROM mystery_scenario_entities WHERE scenario_id = ? AND entity_id = ? LIMIT 1',
                    [$scenarioId, $eid]
                );

                if ($isLegacySheriffLike) {
                    Database::execute(
                        "UPDATE mystery_entities SET is_archived = 1 WHERE id = ? AND game_id = ? AND entity_type = 'character' LIMIT 1",
                        [$eid, $caseId]
                    );
                }
            }
        }
    } catch (Throwable $e) {}
}
