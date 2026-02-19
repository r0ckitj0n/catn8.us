<?php

if ($action === 'ensure_default_scenario_for_case') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $caseId = (int)($body['case_id'] ?? 0);
    $caseRow = $requireCase($caseId);

    $mysteryId = (int)($caseRow['mystery_id'] ?? 0);
    if ($mysteryId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Case mystery_id is invalid'], 500);
    }

    $hankMaster = catn8_mystery_ensure_hank_master($mysteryId);

    $minSuspects = (int)($body['min_suspects'] ?? 8);
    if ($minSuspects < 2) $minSuspects = 2;
    if ($minSuspects > 20) $minSuspects = 20;

    $requestedScenarioId = (int)($body['scenario_id'] ?? 0);

    $existingScenario = null;
    if ($requestedScenarioId > 0) {
        $row = Database::queryOne(
            'SELECT id, game_id, slug, title, status, specs_json, constraints_json, created_at, updated_at FROM mystery_scenarios WHERE id = ? AND game_id = ? LIMIT 1',
            [$requestedScenarioId, $caseId]
        );
        if (!$row) {
            catn8_json_response(['success' => false, 'error' => 'Scenario not found for this case'], 404);
        }
        $existingScenario = $row;
    }

    if (!$existingScenario) {
        $existingScenario = Database::queryOne(
            'SELECT id, game_id, slug, title, status, specs_json, constraints_json, created_at, updated_at FROM mystery_scenarios WHERE game_id = ? ORDER BY id ASC LIMIT 1',
            [$caseId]
        );
    }

    $constraintsForBootstrap = json_decode((string)($existingScenario['constraints_json'] ?? '{}'), true);
    if (!is_array($constraintsForBootstrap)) $constraintsForBootstrap = [];

    $constraintsSheriff = $constraintsForBootstrap['sheriff'] ?? null;
    if (!is_array($constraintsSheriff)) $constraintsSheriff = [];
    $constraintsSheriffEntityId = (int)($constraintsSheriff['entity_id'] ?? 0);
    $constraintsSheriffLocked = (int)($constraintsSheriff['locked'] ?? 0) ? 1 : 0;

    $scenarioId = (int)($existingScenario['id'] ?? 0);
    if ($scenarioId <= 0) {
        $caseTitle = trim((string)($caseRow['title'] ?? ''));
        $scenarioTitle = $caseTitle !== '' ? $caseTitle : 'Scenario';
        $slug = catn8_mystery_unique_slug($scenarioTitle, static function (string $candidate) use ($caseId): bool {
            return Database::queryOne('SELECT id FROM mystery_scenarios WHERE game_id = ? AND slug = ? LIMIT 1', [$caseId, $candidate]) !== null;
        });

        Database::execute(
            'INSERT INTO mystery_scenarios (game_id, slug, title, status, specs_json, constraints_json) VALUES (?, ?, ?, ?, ?, ?)',
            [$caseId, $slug, $scenarioTitle, 'draft', json_encode(new stdClass()), json_encode(new stdClass())]
        );
        $row = Database::queryOne('SELECT id FROM mystery_scenarios WHERE game_id = ? AND slug = ? LIMIT 1', [$caseId, $slug]);
        $scenarioId = (int)($row['id'] ?? 0);
        if ($scenarioId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'Failed to create scenario'], 500);
        }
    }

    $chars = catn8_mystery_bootstrap_ensure_cast($caseId, $mysteryId, $minSuspects + 1);
    $sheriffId = catn8_mystery_bootstrap_find_sheriff($caseId, $mysteryId, $constraintsSheriffEntityId, $chars, $hankMaster);

    if ($sheriffId > 0) {
        catn8_mystery_bootstrap_assign_sheriff_role($scenarioId, $caseId, $sheriffId, $constraintsForBootstrap);
    }

    catn8_mystery_bootstrap_attach_suspects($scenarioId, $caseId, $sheriffId, $minSuspects, $chars);
    catn8_mystery_bootstrap_ensure_extra_roles($scenarioId, $caseId, $sheriffId, $minSuspects, $chars);
    
    // Bootstrap locations and reports
    $locs = catn8_mystery_bootstrap_ensure_locations($caseId, $mysteryId);
    catn8_mystery_bootstrap_attach_locations($scenarioId, $caseId, $locs);

    catn8_mystery_bootstrap_seed_case_file($scenarioId, (string)($existingScenario['title'] ?? $caseRow['title'] ?? ''));

    // Automatically generate CSI report if missing
    $scenarioRow = Database::queryOne('SELECT csi_report_text FROM mystery_scenarios WHERE id = ?', [$scenarioId]);
    if (empty($scenarioRow['csi_report_text'])) {
        error_log("TRACE: Auto-generating CSI report for scenario $scenarioId");
        try {
            catn8_mystery_generate_csi_report($scenarioId);
        } catch (Throwable $e) {
            error_log("TRACE ERROR: Auto-CSI generation failed: " . $e->getMessage());
        }
    }

    catn8_json_response([
        'success' => true,
        'scenario_id' => $scenarioId,
        'case_id' => $caseId,
        'min_suspects' => $minSuspects,
    ]);
}
