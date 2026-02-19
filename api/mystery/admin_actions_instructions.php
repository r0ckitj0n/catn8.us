<?php
if ($action === 'import_mystery_instructions') {
    catn8_require_method('POST');
    // NOTE: This importer is intended as a one-time bootstrap (idempotent upserts).
    // Runtime gameplay should not depend on Mystery/Instructions JSON files.
    require __DIR__ . '/../../scripts/db/import_mystery_instructions.php';
    exit;
}

if ($action === 'validate_db_only_mode') {
    catn8_require_method('GET');

    $patterns = [
        'Mystery/Instructions',
        'Mystery\\Instructions',
        '/Mystery/Instructions',
    ];

    $targets = [
        __DIR__ . '/play.php',
        __DIR__ . '/conversation_log.php',
        __DIR__ . '/csi_live_bootstrap.php',
        __DIR__ . '/sheriff_live_bootstrap.php',
        __DIR__ . '/../auth/account.php',
        __DIR__ . '/../../includes/functions.php',
        __DIR__ . '/../../includes/database.php',
        __DIR__ . '/../../includes/secret_store.php',
    ];

    $matches = [];
    foreach ($targets as $path) {
        if (!is_string($path) || $path === '' || !file_exists($path)) {
            $matches[] = [
                'file' => (string)$path,
                'line' => 0,
                'snippet' => 'Target file missing',
            ];
            continue;
        }
        $content = @file_get_contents($path);
        if (!is_string($content)) {
            $matches[] = [
                'file' => (string)$path,
                'line' => 0,
                'snippet' => 'Unable to read file',
            ];
            continue;
        }

        $lines = preg_split('/\R/', $content);
        if (!is_array($lines)) $lines = [];
        foreach ($lines as $i => $line) {
            $lineStr = (string)$line;
            foreach ($patterns as $p) {
                if ($p !== '' && stripos($lineStr, $p) !== false) {
                    $matches[] = [
                        'file' => (string)$path,
                        'line' => (int)$i + 1,
                        'snippet' => trim($lineStr),
                    ];
                    break;
                }
            }
        }
    }

    $ok = true;
    foreach ($matches as $m) {
        $snip = trim((string)($m['snippet'] ?? ''));
        if ($snip === 'Target file missing' || $snip === 'Unable to read file') {
            $ok = false;
            break;
        }
    }
    if (count($matches) > 0) $ok = false;

    if (!$ok) {
        catn8_json_response([
            'success' => false,
            'error' => 'DB-only validation failed: detected Mystery/Instructions usage (or missing/ unreadable target files). Remove file-based reads from gameplay-critical code paths.',
            'matches' => $matches,
        ], 500);
    }

    catn8_json_response([
        'success' => true,
        'message' => 'DB-only validation passed: no Mystery/Instructions usage detected in scanned gameplay-critical targets.',
        'targets_scanned' => $targets,
        'patterns' => $patterns,
    ]);
}

$requireMystery = static function (int $mysteryId) use ($viewerId, $isAdmin): array {
    if ($mysteryId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid mystery_id'], 400);
    }

    $row = Database::queryOne('SELECT id, owner_user_id, slug, title, settings_json, is_archived, created_at, updated_at FROM mystery_mysteries WHERE id = ?', [$mysteryId]);
    if (!$row) {
        catn8_json_response(['success' => false, 'error' => 'Mystery not found'], 404);
    }

    if (!$isAdmin && (int)($row['owner_user_id'] ?? 0) !== $viewerId) {
        catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
    }

    return $row;
};

$requireCase = static function (int $caseId) use ($viewerId, $isAdmin): array {
    if ($caseId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid case_id'], 400);
    }

    $row = Database::queryOne(
        'SELECT id, owner_user_id, mystery_id, slug, title, description, global_specs_json, is_template, is_archived, created_at, updated_at FROM mystery_games WHERE id = ?',
        [$caseId]
    );
    if (!$row) {
        catn8_json_response(['success' => false, 'error' => 'Case not found'], 404);
    }

    if (!$isAdmin && (int)($row['owner_user_id'] ?? 0) !== $viewerId) {
        catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
    }

    return $row;
};

$requireScenario = static function (int $scenarioId) use ($requireCase): array {
    if ($scenarioId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid scenario_id'], 400);
    }

    $row = Database::queryOne(
        'SELECT id, game_id, backstory_id, slug, title, status, specs_json, constraints_json, crime_scene_weapon, crime_scene_motive, crime_scene_location, crime_scene_location_master_id, csi_detective_entity_id, csi_report_text, csi_report_json, created_at, updated_at FROM mystery_scenarios WHERE id = ?',
        [$scenarioId]
    );
    if (!$row) {
        catn8_json_response(['success' => false, 'error' => 'Scenario not found'], 404);
    }

    $requireCase((int)($row['game_id'] ?? 0));
    return $row;
};

$catn8_mystery_ensure_default_csi_detective = static function (int $scenarioId) use ($requireScenario, $requireCase, $catn8_require_csi_columns, $catn8_is_csi_law_enforcement_character): void {
    $catn8_require_csi_columns();

    $scenario = $requireScenario($scenarioId);
    $cur = (int)($scenario['csi_detective_entity_id'] ?? 0);
    if ($cur > 0) return;

    $caseRow = $requireCase((int)($scenario['game_id'] ?? 0));
    $mysteryId = (int)($caseRow['mystery_id'] ?? 0);
    if ($mysteryId <= 0) return;

    $rows = Database::queryAll(
        'SELECT se.entity_id, se.role, e.entity_type, e.data_json
         FROM mystery_scenario_entities se
         INNER JOIN mystery_entities e ON e.id = se.entity_id
         WHERE se.scenario_id = ? AND e.entity_type = ?
         ORDER BY se.id ASC',
        [$scenarioId, 'character']
    );

    $sheriffEntityId = 0;
    foreach ($rows as $r) {
        if ((string)($r['role'] ?? '') === 'sheriff') {
            $sheriffEntityId = (int)($r['entity_id'] ?? 0);
            break;
        }
    }

    $pick = 0;
    foreach ($rows as $r) {
        $eid = (int)($r['entity_id'] ?? 0);
        if ($eid <= 0) continue;
        if ((string)($r['role'] ?? '') === 'sheriff') continue;

        $entityRow = [
            'id' => $eid,
            'entity_type' => (string)($r['entity_type'] ?? ''),
            'data_json' => (string)($r['data_json'] ?? '{}'),
        ];
        if (!$catn8_is_csi_law_enforcement_character($mysteryId, $entityRow)) continue;
        $pick = $eid;
        break;
    }

    if ($pick <= 0 && $sheriffEntityId > 0) {
        foreach ($rows as $r) {
            $eid = (int)($r['entity_id'] ?? 0);
            if ($eid !== $sheriffEntityId) continue;

            $entityRow = [
                'id' => $eid,
                'entity_type' => (string)($r['entity_type'] ?? ''),
                'data_json' => (string)($r['data_json'] ?? '{}'),
            ];
            if ($catn8_is_csi_law_enforcement_character($mysteryId, $entityRow)) {
                $pick = $eid;
            }
            break;
        }
    }

    if ($pick > 0) {
        Database::execute('UPDATE mystery_scenarios SET csi_detective_entity_id = ? WHERE id = ? LIMIT 1', [$pick, $scenarioId]);
    }
};

