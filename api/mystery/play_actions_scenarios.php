<?php
declare(strict_types=1);

if ($action === 'ensure_default_scenario_for_case') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $caseId = (int)($body['case_id'] ?? 0);
    if ($caseId <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid case_id'], 400);
    $caseRow = Database::queryOne('SELECT id, mystery_id, title FROM mystery_games WHERE id = ? LIMIT 1', [$caseId]);
    if (!$caseRow) catn8_json_response(['success' => false, 'error' => 'Case not found'], 404);
    $existing = Database::queryOne('SELECT id FROM mystery_scenarios WHERE game_id = ? AND is_archived = 0 ORDER BY id ASC LIMIT 1', [$caseId]);
    $sid = (int)($existing['id'] ?? 0);
    if ($sid <= 0) {
        $title = trim((string)$caseRow['title']) ?: 'Scenario';
        $slug = catn8_mystery_slugify($title);
        Database::execute('INSERT INTO mystery_scenarios (game_id, slug, title, status, specs_json, constraints_json) VALUES (?, ?, ?, ?, ?, ?)', [$caseId, $slug, $title, 'draft', json_encode(new stdClass()), json_encode(new stdClass())]);
        $row = Database::queryOne('SELECT id FROM mystery_scenarios WHERE game_id = ? AND slug = ? LIMIT 1', [$caseId, $slug]);
        $sid = (int)($row['id'] ?? 0);
        
        if ($sid > 0) {
            $mid = (int)$caseRow['mystery_id'];
            require_once __DIR__ . '/admin_functions_scenarios.php';
            // Also bootstrap locations and reports on play-side if scenario is created
            $locs = catn8_mystery_bootstrap_ensure_locations($caseId, $mid);
            catn8_mystery_bootstrap_attach_locations($sid, $caseId, $locs);
        }
    }
    catn8_json_response(['success' => true, 'scenario_id' => $sid, 'case_id' => $caseId]);
}

/**
 * Centralized briefing extraction logic to ensure consistency across endpoints.
 * Prioritizes rich narrative content from JSON fields over flat columns.
 */
$extractBriefing = static function(array $r): string {
    $constraints = json_decode((string)($r['constraints_json'] ?? '{}'), true) ?: [];
    $specs = json_decode((string)($r['specs_json'] ?? '{}'), true) ?: [];
    
    $candidates = [];

    // 1. Try rich narrative from constraints_json (Scenario Editor output)
    if (!empty($constraints['briefing'])) {
        $b = $constraints['briefing'];
        if (is_array($b)) {
            // Priority: narrative_text > story_text > story > script.briefing > script.logline
            $candidates[] = $b['narrative_text'] ?? null;
            $candidates[] = $b['story_text'] ?? null;
            $candidates[] = $b['story'] ?? null;
            if (!empty($b['script'])) {
                $candidates[] = $b['script']['briefing'] ?? null;
                $candidates[] = $b['script']['logline'] ?? null;
            }
        } else if (is_string($b)) {
            $candidates[] = $b;
        }
    }

    // 2. Try rich narrative from specs_json (Generator output)
    $candidates[] = $specs['narrative_summary'] ?? null;
    $candidates[] = $specs['description'] ?? null;
    $candidates[] = $specs['mission_brief'] ?? null;

    // 3. Check for mission_brief in difficulty configs
    if (!empty($constraints['difficulty_configs'])) {
        foreach (['hard', 'medium', 'easy'] as $diff) {
            if (!empty($constraints['difficulty_configs'][$diff]['initial_game_state']['mission_brief'])) {
                $candidates[] = $constraints['difficulty_configs'][$diff]['initial_game_state']['mission_brief'];
            }
        }
    }

    foreach ($candidates as $c) {
        $txt = trim((string)$c);
        // Ignore known setting placeholders and very short strings
        if ($txt !== '' && 
            $txt !== 'Dawsonville, GA' && 
            $txt !== 'Amicalola Falls State Park' && 
            $txt !== 'Amicalola Falls Visitor Center' &&
            strlen($txt) > 20) {
            return $txt;
        }
    }

    // 4. Final fallbacks from description column
    $fallback = trim((string)($r['description'] ?? ''));
    if ($fallback === '' || 
        $fallback === 'Dawsonville, GA' || 
        $fallback === 'Amicalola Falls State Park' ||
        $fallback === 'Amicalola Falls Visitor Center') {
        return '';
    }
    return $fallback;
};

if ($action === 'list_scenarios') {
    catn8_require_method('GET');
    $caseId = (int)($_GET['case_id'] ?? 0);
    if ($caseId <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid case_id'], 400);

    $rows = Database::queryAll(
        'SELECT id, game_id, backstory_id, slug, title, status, description, specs_json, constraints_json, created_at, updated_at ' .
        'FROM mystery_scenarios ' .
        'WHERE game_id = ? AND is_archived = 0 ' .
        'ORDER BY updated_at DESC, id DESC',
        [$caseId]
    );

    $items = array_map(static function (array $r) use ($extractBriefing): array {
        return [
            'id' => (int)($r['id'] ?? 0),
            'case_id' => (int)($r['game_id'] ?? 0),
            'backstory_id' => (int)($r['backstory_id'] ?? 0),
            'slug' => (string)($r['slug'] ?? ''),
            'title' => (string)($r['title'] ?? ''),
            'status' => (string)($r['status'] ?? 'draft'),
            'briefing_text' => $extractBriefing($r),
            'created_at' => (string)$r['created_at'],
            'updated_at' => (string)$r['updated_at'],
        ];
    }, $rows);

    catn8_json_response(['success' => true, 'scenarios' => $items]);
}

if ($action === 'get_scenario') {
    catn8_require_method('GET');
    $sid = (int)($_GET['id'] ?? $_GET['scenario_id'] ?? 0);
    if ($sid <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid scenario id'], 400);
    $row = Database::queryOne('SELECT * FROM mystery_scenarios WHERE id = ? LIMIT 1', [$sid]);
    if (!$row) catn8_json_response(['success' => false, 'error' => 'Scenario not found'], 404);
    $caseId = (int)$row['game_id'];
    $isWon = false;
    if ($caseId > 0) {
        $run = Database::queryOne("SELECT run_settings_json FROM mystery_run_sessions WHERE case_id = ? AND owner_user_id = ? AND status = 'active' LIMIT 1", [$caseId, $viewerId]);
        if ($run) { $s = json_decode((string)$run['run_settings_json'], true); $isWon = !empty($s['game_won']); }
    }
    
    $res = [
        'id' => $sid, 'case_id' => $caseId, 'backstory_id' => (int)$row['backstory_id'], 'slug' => (string)$row['slug'],
        'title' => (string)$row['title'], 'status' => (string)$row['status'], 'briefing_text' => $extractBriefing($row), 
        'description' => (string)($row['description'] ?? ''),
        'crime_scene_location' => (string)$row['crime_scene_location'],
        'crime_scene_location_id' => (int)$row['crime_scene_location_id'], 'crime_scene_location_master_id' => (int)$row['crime_scene_location_master_id'],
        'csi_detective_entity_id' => (int)$row['csi_detective_entity_id'], 'csi_report_text' => (string)$row['csi_report_text'],
        'csi_report_json' => json_decode((string)$row['csi_report_json'], true),
        'specs' => json_decode((string)$row['specs_json'], true) ?: new stdClass(),
        'constraints' => json_decode((string)$row['constraints_json'], true) ?: new stdClass(),
        'created_at' => (string)$row['created_at'], 'updated_at' => (string)$row['updated_at']
    ];
    if ($isWon) {
        $res['crime_scene_weapon'] = (string)$row['crime_scene_weapon'];
        $res['crime_scene_motive'] = (string)$row['crime_scene_motive'];
        $res['murderer_ids'] = array_column(Database::queryAll('SELECT entity_id FROM mystery_scenario_murderers WHERE scenario_id = ?', [$sid]), 'entity_id');
    } else {
        $res['crime_scene_weapon'] = 'REDACTED'; $res['crime_scene_motive'] = 'REDACTED'; $res['murderer_ids'] = [];
    }
    catn8_json_response(['success' => true, 'scenario' => $res]);
}

if ($action === 'list_scenario_entities') {
    catn8_require_method('GET');
    $sid = (int)($_GET['scenario_id'] ?? 0);
    if ($sid <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid scenario_id'], 400);
    
    $rows = Database::queryAll(
        'SELECT se.*, e.entity_type, e.slug, e.name, e.data_json, e.roles_json,
                (SELECT mc.agent_id 
                 FROM mystery_master_characters mc 
                 WHERE mc.slug = e.slug OR mc.id = JSON_UNQUOTE(JSON_EXTRACT(e.data_json, "$.master_id"))
                 LIMIT 1) as master_agent_id
         FROM mystery_scenario_entities se 
         INNER JOIN mystery_entities e ON e.id = se.entity_id 
         WHERE se.scenario_id = ? 
         ORDER BY e.entity_type ASC, e.name ASC', 
        [$sid]
    );

    catn8_json_response(['success' => true, 'scenario_entities' => array_map(static function ($r) {
        $data = json_decode((string)$r['data_json'], true) ?: [];
        $agentId = (int)($data['agent_id'] ?? 0);
        if ($agentId <= 0 && isset($r['master_agent_id'])) {
            $agentId = (int)$r['master_agent_id'];
        }
        return [
            'id' => (int)$r['id'], 'scenario_id' => (int)$r['scenario_id'], 'entity_id' => (int)$r['entity_id'],
            'role' => (string)$r['role'], 'roles' => json_decode((string)$r['roles_json'], true) ?: [],
            'override' => json_decode((string)$r['override_json'], true) ?: new stdClass(),
            'entity_type' => (string)$r['entity_type'], 'entity_slug' => (string)$r['slug'], 'entity_name' => (string)$r['name'],
            'agent_id' => $agentId,
            'data' => $data
        ];
    }, $rows)]);
}

if ($action === 'get_scenario_briefing') {
    catn8_require_method('GET');
    $sid = (int)($_GET['id'] ?? 0);
    if ($sid <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    $row = Database::queryOne('SELECT constraints_json FROM mystery_scenarios WHERE id = ? LIMIT 1', [$sid]);
    if (!$row) catn8_json_response(['success' => false, 'error' => 'Scenario not found'], 404);
    $c = json_decode((string)$row['constraints_json'], true) ?: [];
    $b = $c['briefing'] ?? null;
    catn8_json_response(['success' => true, 'briefing_text' => is_array($b) ? trim((string)($b['narrative_text'] ?? $b['story_text'] ?? $b['story'] ?? '')) : '', 'snapshot' => $c['snapshot'] ?? null, 'entities' => $c['entities'] ?? []]);
}

if ($action === 'get_entity_deposition') {
    catn8_require_method('GET');
    $sid = (int)($_GET['scenario_id'] ?? 0); $eid = (int)($_GET['entity_id'] ?? 0);
    if ($sid <= 0 || $eid <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid params'], 400);
    $row = Database::queryOne('SELECT * FROM mystery_scenario_depositions WHERE scenario_id = ? AND entity_id = ? LIMIT 1', [$sid, $eid]);
    catn8_json_response(['success' => true, 'deposition' => $row ? ['id' => (int)$row['id'], 'deposition_text' => (string)$row['deposition_text'], 'created_at' => (string)$row['created_at'], 'updated_at' => (string)$row['updated_at']] : null]);
}

if ($action === 'list_depositions') {
    catn8_require_method('GET');
    $sid = (int)($_GET['scenario_id'] ?? 0);
    if ($sid <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid scenario_id'], 400);
    $rows = Database::queryAll('SELECT * FROM mystery_scenario_depositions WHERE scenario_id = ? ORDER BY id ASC', [$sid]);
    catn8_json_response(['success' => true, 'depositions' => array_map(static fn($r) => ['id' => (int)$r['id'], 'entity_id' => (int)$r['entity_id'], 'deposition_text' => (string)$r['deposition_text'], 'created_at' => (string)$r['created_at'], 'updated_at' => (string)$r['updated_at']], $rows)]);
}
