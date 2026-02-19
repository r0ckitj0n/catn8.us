<?php
/**
 * admin_functions_scenarios_bootstrap_roles.php - Scenario role bootstrap utilities
 * COMPLIANCE: File size < 300 lines
 */

/**
 * Attaches needed suspects to a scenario.
 */
function catn8_mystery_bootstrap_attach_suspects(int $scenarioId, int $caseId, int $sheriffId, int $minSuspects, array $chars): void {
    $existingSuspects = Database::queryAll(
        'SELECT entity_id FROM mystery_scenario_entities WHERE scenario_id = ? AND role = ?',
        [$scenarioId, 'suspect']
    );
    $haveSuspects = [];
    foreach ($existingSuspects as $r) {
        $eid = (int)($r['entity_id'] ?? 0);
        if ($eid > 0) $haveSuspects[$eid] = true;
    }

    $haveCount = count($haveSuspects);
    if ($haveCount < $minSuspects) {
        foreach ($chars as $r) {
            if ($haveCount >= $minSuspects) break;
            $eid = (int)($r['id'] ?? 0);
            if ($eid <= 0) continue;
            if ($sheriffId > 0 && $eid === $sheriffId) continue;
            if (isset($haveSuspects[$eid])) continue;

            // Never attach sheriff-like entities as suspects.
            $slug = strtolower(trim((string)($r['slug'] ?? '')));
            $name = strtolower(trim((string)($r['name'] ?? '')));
            $data = json_decode((string)($r['data_json'] ?? '{}'), true);
            if (!is_array($data)) $data = [];
            $ms = strtolower(trim((string)($data['master_slug'] ?? '')));
            $agentId = (int)($data['agent_id'] ?? 0);
            if ($slug === 'sheriff_hank_mercer' || $ms === 'sheriff_hank_mercer' || $name === 'sheriff hank mercer' || $agentId === 100 || $slug === 'sheriff' || $name === 'sheriff') {
                continue;
            }

            Database::execute(
                'INSERT IGNORE INTO mystery_scenario_entities (scenario_id, entity_id, role, override_json) VALUES (?, ?, ?, ?)',
                [$scenarioId, $eid, 'suspect', json_encode(new stdClass())]
            );
            $haveSuspects[$eid] = true;
            $haveCount += 1;
        }
    }
}

/**
 * Seeds the initial case file note for a scenario.
 */
function catn8_mystery_bootstrap_seed_case_file(int $scenarioId, string $scenarioTitle): void {
    if ($scenarioId <= 0) return;
    
    $logTitle = 'Case File: ' . $scenarioTitle;
    $logType = 'case_file';
    $rich = [
        'blocks' => [
            ['style' => 'typed', 'text' => 'CASE FILE: ' . strtoupper($scenarioTitle)],
            ['style' => 'typed', 'text' => 'Investigation initialized.'],
            ['style' => 'typed', 'text' => 'Initial evidence and suspect profiles attached.']
        ],
        'tags' => ['OFFICIAL', 'CONFIDENTIAL'],
        'annotations' => []
    ];
    
    $existing = Database::queryOne(
        'SELECT id FROM mystery_case_notes WHERE scenario_id = ? AND title = ? AND note_type = ? LIMIT 1',
        [$scenarioId, $logTitle, $logType]
    );
    
    if (!$existing) {
        Database::execute(
            'INSERT INTO mystery_case_notes (scenario_id, title, note_type, content_rich_json, clue_count, is_archived) VALUES (?, ?, ?, ?, 0, 0)',
            [$scenarioId, $logTitle, $logType, json_encode($rich)]
        );
    }
}

/**
 * Ensures victim, witness, and bystander roles are filled.
 */
function catn8_mystery_bootstrap_ensure_extra_roles(int $scenarioId, int $caseId, int $sheriffId, int $minSuspects, array $chars): void {
    $existingEntitiesAll = Database::queryAll(
        'SELECT entity_id, role FROM mystery_scenario_entities WHERE scenario_id = ? ORDER BY id ASC',
        [$scenarioId]
    );
    $haveAny = [];
    $haveByRole = [
        'victim' => [],
        'witness' => [],
        'bystander' => [],
        'suspect' => [],
        'sheriff' => [],
    ];
    foreach ($existingEntitiesAll as $r) {
        $eid = (int)($r['entity_id'] ?? 0);
        if ($eid <= 0) continue;
        $haveAny[$eid] = true;
        $role = trim((string)($r['role'] ?? ''));
        if ($role !== '' && isset($haveByRole[$role])) {
            $haveByRole[$role][$eid] = true;
        }
    }

    // Ensure a victim exists.
    if (count($haveByRole['victim']) === 0) {
        $victimId = 0;
        foreach ($haveByRole['suspect'] as $eid => $_v) {
            $eid = (int)$eid;
            if ($eid <= 0) continue;
            if ($sheriffId > 0 && $eid === $sheriffId) continue;
            $victimId = $eid;
            break;
        }

        $victimConverted = false;
        if ($victimId > 0) {
            Database::execute(
                'UPDATE mystery_scenario_entities SET role = ? WHERE scenario_id = ? AND entity_id = ? LIMIT 1',
                ['victim', $scenarioId, $victimId]
            );
            $victimConverted = true;
            catn8_mystery_merge_entity_role($caseId, $victimId, 'victim');
            $haveAny[$victimId] = true;
            $haveByRole['victim'][$victimId] = true;
            unset($haveByRole['suspect'][$victimId]);
        } else {
            $exclude = $haveAny;
            if ($sheriffId > 0) $exclude[$sheriffId] = true;
            $victimId = catn8_mystery_pick_role_candidate($chars, $exclude);
            if ($victimId > 0) {
                catn8_mystery_ensure_scenario_entity_role($scenarioId, $victimId, 'victim');
                catn8_mystery_merge_entity_role($caseId, $victimId, 'victim');
                $haveAny[$victimId] = true;
                $haveByRole['victim'][$victimId] = true;
            }
        }

        if ($victimConverted) {
            $suspectCount = count($haveByRole['suspect']);
            if ($suspectCount < $minSuspects) {
                $exclude2 = $haveAny;
                if ($sheriffId > 0) $exclude2[$sheriffId] = true;
                if ($victimId > 0) $exclude2[$victimId] = true;
                $newSuspectId = catn8_mystery_pick_role_candidate($chars, $exclude2);
                if ($newSuspectId > 0) {
                    catn8_mystery_ensure_scenario_entity_role($scenarioId, $newSuspectId, 'suspect');
                    catn8_mystery_merge_entity_role($caseId, $newSuspectId, 'suspect');
                    $haveAny[$newSuspectId] = true;
                    $haveByRole['suspect'][$newSuspectId] = true;
                }
            }
        }
    }

    // Add one witness and one bystander if possible.
    foreach (['witness', 'bystander'] as $extraRole) {
        if (count($haveByRole[$extraRole]) > 0) continue;
        $exclude = $haveAny;
        if ($sheriffId > 0) $exclude[$sheriffId] = true;
        foreach ($haveByRole['victim'] as $eid => $_v) $exclude[$eid] = true;
        foreach ($haveByRole['witness'] as $eid => $_v) $exclude[$eid] = true;
        foreach ($haveByRole['bystander'] as $eid => $_v) $exclude[$eid] = true;
        $eid = catn8_mystery_pick_role_candidate($chars, $exclude);
        if ($eid > 0) {
            catn8_mystery_ensure_scenario_entity_role($scenarioId, $eid, $extraRole);
            catn8_mystery_merge_entity_role($caseId, $eid, $extraRole);
            $haveAny[$eid] = true;
            $haveByRole[$extraRole][$eid] = true;
        }
    }
}
