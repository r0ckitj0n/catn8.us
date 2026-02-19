<?php
if ($action === 'check_scenario_regen_needed') {
    catn8_require_method('GET');
    $scenarioId = (int)($_GET['scenario_id'] ?? 0);
    $scenario = $requireScenario($scenarioId);
    $caseId = (int)($scenario['game_id'] ?? 0);
    $requireCase($caseId);

    $weapon = trim((string)($scenario['crime_scene_weapon'] ?? ''));
    $location = trim((string)($scenario['crime_scene_location'] ?? ''));
    $motive = trim((string)($scenario['crime_scene_motive'] ?? ''));
    $hasCrimeScene = ($weapon !== '' || $location !== '' || $motive !== '');

    $depositionCount = 0;
    $lieCount = 0;
    $murdererCount = 0;
    try {
        $r1 = Database::queryOne('SELECT COUNT(*) AS c FROM mystery_scenario_depositions WHERE scenario_id = ?', [$scenarioId]);
        $depositionCount = (int)($r1['c'] ?? 0);
    } catch (Throwable $e) {}
    try {
        $r2 = Database::queryOne('SELECT COUNT(*) AS c FROM mystery_scenario_lies WHERE scenario_id = ?', [$scenarioId]);
        $lieCount = (int)($r2['c'] ?? 0);
    } catch (Throwable $e) {}
    try {
        $r3 = Database::queryOne('SELECT COUNT(*) AS c FROM mystery_scenario_murderers WHERE scenario_id = ?', [$scenarioId]);
        $murdererCount = (int)($r3['c'] ?? 0);
    } catch (Throwable $e) {}

    $constraints = json_decode((string)($scenario['constraints_json'] ?? '{}'), true);
    if (!is_array($constraints)) $constraints = [];
    $hasBriefing = isset($constraints['briefing']);

    $needsRegen = ($hasCrimeScene || $depositionCount > 0 || $lieCount > 0 || $murdererCount > 0 || $hasBriefing) ? 1 : 0;
    catn8_json_response([
        'success' => true,
        'scenario_id' => $scenarioId,
        'needs_regen' => $needsRegen,
        'debug' => [
            'has_crime_scene' => $hasCrimeScene ? 1 : 0,
            'depositions' => $depositionCount,
            'lies' => $lieCount,
            'murderers' => $murdererCount,
            'has_briefing' => $hasBriefing ? 1 : 0,
        ],
    ]);
}

if ($action === 'attach_entity_to_scenario') {
    $catn8_require_db_column('mystery_scenarios', 'csi_detective_entity_id', 'migrate_mystery_backstory_location_and_csi_report.php');
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $scenarioId = (int)($body['scenario_id'] ?? 0);
    $entityId = (int)($body['entity_id'] ?? 0);
    $role = trim((string)($body['role'] ?? ''));
    $override = $body['override'] ?? [];

    $scenario = $requireScenario($scenarioId);
    $entity = $requireEntity($entityId);

    $constraints = json_decode((string)($scenario['constraints_json'] ?? '{}'), true);
    if (!is_array($constraints)) $constraints = [];
    $sheriffCfg = $constraints['sheriff'] ?? null;
    if (!is_array($sheriffCfg)) $sheriffCfg = [];
    $locked = (int)($sheriffCfg['locked'] ?? 0) ? 1 : 0;
    $lockedEid = (int)($sheriffCfg['entity_id'] ?? 0);

    if ((int)($scenario['game_id'] ?? 0) !== (int)($entity['game_id'] ?? 0)) {
        catn8_json_response(['success' => false, 'error' => 'Entity does not belong to this game'], 400);
    }
    if ($role === '') {
        catn8_json_response(['success' => false, 'error' => 'role is required'], 400);
    }
    if (!is_array($override)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid override'], 400);
    }

    if ($role === 'sheriff') {
        if ($locked && $lockedEid > 0 && $lockedEid !== $entityId) {
            catn8_json_response(['success' => false, 'error' => 'Sheriff is locked for this scenario'], 400);
        }
        Database::execute(
            'UPDATE mystery_scenario_entities SET role = ? WHERE scenario_id = ? AND role = ? AND entity_id <> ?',
            ['suspect', $scenarioId, 'sheriff', $entityId]
        );
        if (!isset($constraints['sheriff']) || !is_array($constraints['sheriff'])) $constraints['sheriff'] = [];
        $constraints['sheriff']['entity_id'] = $entityId;
        if (!isset($constraints['sheriff']['locked'])) $constraints['sheriff']['locked'] = 0;
        Database::execute('UPDATE mystery_scenarios SET constraints_json = ? WHERE id = ? LIMIT 1', [json_encode($constraints), $scenarioId]);
    }

    $existing = Database::queryOne(
        'SELECT id FROM mystery_scenario_entities WHERE scenario_id = ? AND entity_id = ?',
        [$scenarioId, $entityId]
    );
    if ($existing) {
        Database::execute(
            'UPDATE mystery_scenario_entities SET role = ?, override_json = ? WHERE id = ?',
            [$role, json_encode($override), (int)($existing['id'] ?? 0)]
        );
        catn8_json_response(['success' => true, 'id' => (int)($existing['id'] ?? 0), 'updated' => 1]);
    }

    Database::execute(
        'INSERT INTO mystery_scenario_entities (scenario_id, entity_id, role, override_json) VALUES (?, ?, ?, ?)',
        [$scenarioId, $entityId, $role, json_encode($override)]
    );

    $row = Database::queryOne(
        'SELECT id FROM mystery_scenario_entities WHERE scenario_id = ? AND entity_id = ?',
        [$scenarioId, $entityId]
    );
    catn8_json_response(['success' => true, 'id' => (int)($row['id'] ?? 0), 'created' => 1]);
}

if ($action === 'update_scenario_entity') {
    $catn8_require_db_column('mystery_scenarios', 'csi_detective_entity_id', 'migrate_mystery_backstory_location_and_csi_report.php');
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    $row = Database::queryOne('SELECT id, scenario_id, entity_id, role, override_json FROM mystery_scenario_entities WHERE id = ?', [$id]);
    if (!$row) {
        catn8_json_response(['success' => false, 'error' => 'Scenario entity not found'], 404);
    }

    $scenario = $requireScenario((int)($row['scenario_id'] ?? 0));

    $role = trim((string)($body['role'] ?? (string)($row['role'] ?? '')));
    if ($role === '') {
        catn8_json_response(['success' => false, 'error' => 'role is required'], 400);
    }
    $override = $body['override'] ?? null;
    if ($override !== null && !is_array($override)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid override'], 400);
    }

    $overrideJson = ($override !== null) ? json_encode($override) : (string)($row['override_json'] ?? '{}');

    $constraints = json_decode((string)($scenario['constraints_json'] ?? '{}'), true);
    if (!is_array($constraints)) $constraints = [];
    $sheriffCfg = $constraints['sheriff'] ?? null;
    if (!is_array($sheriffCfg)) $sheriffCfg = [];
    $locked = (int)($sheriffCfg['locked'] ?? 0) ? 1 : 0;
    $lockedEid = (int)($sheriffCfg['entity_id'] ?? 0);

    $entityId = (int)($row['entity_id'] ?? 0);
    if ($role === 'sheriff') {
        if ($locked && $lockedEid > 0 && $lockedEid !== $entityId) {
            catn8_json_response(['success' => false, 'error' => 'Sheriff is locked for this scenario'], 400);
        }
        Database::execute(
            'UPDATE mystery_scenario_entities SET role = ? WHERE scenario_id = ? AND role = ? AND entity_id <> ?',
            ['suspect', (int)($row['scenario_id'] ?? 0), 'sheriff', $entityId]
        );
        if (!isset($constraints['sheriff']) || !is_array($constraints['sheriff'])) $constraints['sheriff'] = [];
        $constraints['sheriff']['entity_id'] = $entityId;
        if (!isset($constraints['sheriff']['locked'])) $constraints['sheriff']['locked'] = 0;
        Database::execute('UPDATE mystery_scenarios SET constraints_json = ? WHERE id = ? LIMIT 1', [json_encode($constraints), (int)($row['scenario_id'] ?? 0)]);
    }

    Database::execute(
        'UPDATE mystery_scenario_entities SET role = ?, override_json = ? WHERE id = ?',
        [$role, $overrideJson, $id]
    );
    catn8_json_response(['success' => true]);
}

if ($action === 'detach_entity_from_scenario') {
    $catn8_require_db_column('mystery_scenarios', 'csi_detective_entity_id', 'migrate_mystery_backstory_location_and_csi_report.php');
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $scenarioEntityId = (int)($body['id'] ?? 0);
    if ($scenarioEntityId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    $row = Database::queryOne('SELECT id, scenario_id, entity_id, role FROM mystery_scenario_entities WHERE id = ?', [$scenarioEntityId]);
    if (!$row) {
        catn8_json_response(['success' => false, 'error' => 'Scenario entity not found'], 404);
    }

    $scenarioId = (int)($row['scenario_id'] ?? 0);
    $scenario = $requireScenario($scenarioId);
    $entityId = (int)($row['entity_id'] ?? 0);
    $role = trim((string)($row['role'] ?? ''));
    if ($role === 'csi_detective') {
        $cur = (int)($scenario['csi_detective_entity_id'] ?? 0);
        if ($cur > 0 && $cur === $entityId) {
            Database::execute('UPDATE mystery_scenarios SET csi_detective_entity_id = NULL WHERE id = ? LIMIT 1', [$scenarioId]);
        }
    }
    Database::execute('DELETE FROM mystery_scenario_entities WHERE id = ?', [$scenarioEntityId]);
    catn8_json_response(['success' => true]);
}
