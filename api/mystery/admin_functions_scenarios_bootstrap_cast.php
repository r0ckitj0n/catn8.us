<?php
/**
 * admin_functions_scenarios_bootstrap_cast.php - Scenario character bootstrap utilities
 * COMPLIANCE: File size < 300 lines
 */

/**
 * Ensures the target number of characters exist for a case by importing from master.
 */
function catn8_mystery_bootstrap_ensure_cast(int $caseId, int $mysteryId, int $targetCount): array {
    $chars = catn8_mystery_load_case_characters($caseId);
    if (count($chars) < $targetCount) {
        $existingSlugSet = [];
        foreach ($chars as $r) {
            $slug = trim((string)($r['slug'] ?? ''));
            if ($slug !== '') $existingSlugSet[$slug] = true;
        }

        $master = Database::queryAll(
            "SELECT id, slug, name\n" .
            "FROM mystery_master_characters\n" .
            "WHERE mystery_id = ? AND is_archived = 0\n" .
            "ORDER BY updated_at DESC, id DESC\n" .
            "LIMIT 200",
            [$mysteryId]
        );

        $needed = $targetCount - count($chars);
        foreach ($master as $r) {
            if ($needed <= 0) break;
            $name = trim((string)($r['name'] ?? ''));
            $slug = trim((string)($r['slug'] ?? ''));
            if ($name === '' || $slug === '') continue;
            if (isset($existingSlugSet[$slug])) continue;

            $slug = catn8_mystery_unique_slug($slug, static function (string $candidate) use ($caseId): bool {
                return Database::queryOne(
                    'SELECT id FROM mystery_entities WHERE game_id = ? AND entity_type = ? AND slug = ? LIMIT 1',
                    [$caseId, 'character', $candidate]
                ) !== null;
            });

            $data = catn8_mystery_master_character_build_derived_json($mysteryId, (int)($r['id'] ?? 0), false);
            if (!is_array($data)) $data = [];
            $data['master_id'] = (int)($r['id'] ?? 0);
            $data['master_slug'] = (string)($r['slug'] ?? '');

            $rolesJson = json_encode([], JSON_UNESCAPED_SLASHES);
            Database::execute(
                'INSERT INTO mystery_entities (game_id, entity_type, slug, name, data_json, roles_json, is_archived) VALUES (?, ?, ?, ?, ?, ?, 0)',
                [$caseId, 'character', $slug, $name, json_encode($data, JSON_UNESCAPED_SLASHES), $rolesJson]
            );
            $existingSlugSet[$slug] = true;
            $needed -= 1;
        }
        $chars = catn8_mystery_load_case_characters($caseId);
    }
    return $chars;
}

/**
 * Finds or ensures the sheriff entity for a case.
 */
function catn8_mystery_bootstrap_find_sheriff(int $caseId, int $mysteryId, int $constraintsSheriffEntityId, array $chars, array $hankMaster): int {
    $sheriffId = 0;

    if ($constraintsSheriffEntityId > 0) {
        $row = Database::queryOne(
            "SELECT id FROM mystery_entities WHERE id = ? AND game_id = ? AND entity_type = 'character' AND is_archived = 0 LIMIT 1",
            [$constraintsSheriffEntityId, $caseId]
        );
        if ($row) {
            $sheriffId = (int)($row['id'] ?? 0);
        }
    }

    if ($sheriffId <= 0) {
        foreach ($chars as $r) {
            $eid = (int)($r['id'] ?? 0);
            if ($eid <= 0) continue;
            $slug = strtolower(trim((string)($r['slug'] ?? '')));
            if ($slug === 'sheriff_hank_mercer') {
                $sheriffId = $eid;
                break;
            }
            $data = json_decode((string)($r['data_json'] ?? '{}'), true);
            if (isset($data['master_slug']) && strtolower(trim((string)$data['master_slug'])) === 'sheriff_hank_mercer') {
                $sheriffId = $eid;
                break;
            }
        }
    }

    if ($sheriffId <= 0) {
        $slug = 'sheriff_hank_mercer';
        $name = (string)($hankMaster['name'] ?? 'Sheriff Hank Mercer');
        $data = [];
        $hankMasterId = (int)($hankMaster['id'] ?? 0);
        if ($hankMasterId > 0) {
            $data = catn8_mystery_master_character_build_derived_json($mysteryId, $hankMasterId, false);
            if (!is_array($data)) $data = [];
            $data['master_id'] = $hankMasterId;
            $data['master_slug'] = 'sheriff_hank_mercer';
        }

        $existingSheriff = Database::queryOne(
            'SELECT id FROM mystery_entities WHERE game_id = ? AND entity_type = ? AND slug = ? LIMIT 1',
            [$caseId, 'character', $slug]
        );
        if (!$existingSheriff) {
            $uniqueSlug = catn8_mystery_unique_slug($slug, static function (string $candidate) use ($caseId): bool {
                return Database::queryOne(
                    'SELECT id FROM mystery_entities WHERE game_id = ? AND entity_type = ? AND slug = ? LIMIT 1',
                    [$caseId, 'character', $candidate]
                ) !== null;
            });
            $useSlug = $uniqueSlug !== '' ? $uniqueSlug : $slug;
            $rolesJson = json_encode(['sheriff'], JSON_UNESCAPED_SLASHES);
            Database::execute(
                'INSERT INTO mystery_entities (game_id, entity_type, slug, name, data_json, roles_json, is_archived) VALUES (?, ?, ?, ?, ?, ?, 0)',
                [$caseId, 'character', $useSlug, $name, json_encode($data, JSON_UNESCAPED_SLASHES), $rolesJson]
            );
        }

        $row = Database::queryOne('SELECT id FROM mystery_entities WHERE game_id = ? AND entity_type = ? AND slug = ? LIMIT 1', [$caseId, 'character', $slug]);
        if ($row) {
            $sheriffId = (int)($row['id'] ?? 0);
        } else {
            $recent = catn8_mystery_load_case_characters($caseId);
            foreach ($recent as $r) {
                $d = json_decode((string)($r['data_json'] ?? '{}'), true);
                if (isset($d['master_slug']) && strtolower(trim((string)$d['master_slug'])) === 'sheriff_hank_mercer') {
                    $sheriffId = (int)($r['id'] ?? 0);
                    break;
                }
            }
        }
    }

    return $sheriffId;
}

/**
 * Assigns the sheriff role to an entity in a scenario.
 */
function catn8_mystery_bootstrap_assign_sheriff_role(int $scenarioId, int $caseId, int $sheriffId, array &$constraintsForBootstrap): void {
    Database::execute(
        'UPDATE mystery_scenario_entities SET role = ? WHERE scenario_id = ? AND role = ? AND entity_id <> ?',
        ['suspect', $scenarioId, 'sheriff', $sheriffId]
    );
    Database::execute(
        'INSERT INTO mystery_scenario_entities (scenario_id, entity_id, role, override_json) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE role = VALUES(role)',
        [$scenarioId, $sheriffId, 'sheriff', json_encode(new stdClass())]
    );
    catn8_mystery_merge_entity_role($caseId, $sheriffId, 'sheriff');

    if (!isset($constraintsForBootstrap['sheriff']) || !is_array($constraintsForBootstrap['sheriff'])) {
        $constraintsForBootstrap['sheriff'] = [];
    }
    if (!isset($constraintsForBootstrap['sheriff']['entity_id']) || (int)($constraintsForBootstrap['sheriff']['entity_id'] ?? 0) <= 0) {
        $constraintsForBootstrap['sheriff']['entity_id'] = $sheriffId;
    }
    if (!isset($constraintsForBootstrap['sheriff']['locked'])) {
        $constraintsForBootstrap['sheriff']['locked'] = 0;
    }

    Database::execute(
        'UPDATE mystery_scenarios SET constraints_json = ? WHERE id = ? AND game_id = ? LIMIT 1',
        [json_encode($constraintsForBootstrap), $scenarioId, $caseId]
    );

    catn8_mystery_cleanup_hank_duplicates($scenarioId, $sheriffId, $caseId);
}
