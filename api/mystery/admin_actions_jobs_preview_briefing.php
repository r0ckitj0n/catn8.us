<?php
if ($jobAction === 'generate_briefing') {
    if ($scenarioId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'generate_briefing requires scenario_id'], 400);
    }
    $scenarioRow = Database::queryOne(
        'SELECT id, game_id, slug, title, specs_json, constraints_json, crime_scene_weapon, crime_scene_location, crime_scene_motive FROM mystery_scenarios WHERE id = ?',
        [$scenarioId]
    );
    if (!$scenarioRow) {
        catn8_json_response(['success' => false, 'error' => 'Scenario not found'], 404);
    }
    $caseId2 = (int)($scenarioRow['game_id'] ?? 0);
    if ($caseId <= 0) {
        $caseId = $caseId2;
    }
    $caseRow = Database::queryOne('SELECT mystery_id FROM mystery_games WHERE id = ? LIMIT 1', [$caseId2]);
    $mysteryId = (int)($caseRow['mystery_id'] ?? 0);
    if ($mysteryId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Case is missing mystery_id'], 500);
    }

    $specs = json_decode((string)($scenarioRow['specs_json'] ?? '{}'), true);
    if (!is_array($specs)) $specs = [];
    $constraints = json_decode((string)($scenarioRow['constraints_json'] ?? '{}'), true);
    if (!is_array($constraints)) $constraints = [];

    $murdererRows = Database::queryAll('SELECT entity_id FROM mystery_scenario_murderers WHERE scenario_id = ? ORDER BY id ASC', [$scenarioId]);
    $killerIds = [];
    foreach ($murdererRows as $mr) {
        $eid = (int)($mr['entity_id'] ?? 0);
        if ($eid > 0) $killerIds[] = $eid;
    }
    $killerId = (int)($killerIds[0] ?? 0);

    $castRows = Database::queryAll(
        'SELECT se.role, se.override_json, e.id AS entity_id, e.slug, e.name, e.data_json
         FROM mystery_scenario_entities se
         INNER JOIN mystery_entities e ON e.id = se.entity_id
         WHERE se.scenario_id = ?
         ORDER BY se.id ASC',
        [$scenarioId]
    );
    $cast = [];
    foreach ($castRows as $r) {
        $data = json_decode((string)($r['data_json'] ?? '{}'), true);
        if (!is_array($data)) $data = [];
        $override = json_decode((string)($r['override_json'] ?? '{}'), true);
        if (!is_array($override)) $override = [];
        $cast[] = [
            'entity_id' => (int)($r['entity_id'] ?? 0),
            'slug' => (string)($r['slug'] ?? ''),
            'name' => (string)($r['name'] ?? ''),
            'role' => (string)($r['role'] ?? ''),
            'data' => $data,
            'override' => $override,
        ];
    }

    $userPrompt = json_encode([
        'task' => 'Write a short detective briefing for the scenario. This is a concise, readable summary presented to investigators.',
        'requirements' => [
            'Return JSON only. Output must match schema exactly.',
            'Briefing should be short (1-3 paragraphs) and should not include a full screenplay or long timeline.',
            'Do not contradict the crime scene fields (weapon, motive, location) and do not contradict the known killer entity_id if provided.',
            'Do not introduce new named characters; only refer to characters from cast.',
        ],
        'schema' => [
            'briefing' => 'string',
        ],
        'context' => [
            'scenario' => [
                'id' => (int)($scenarioRow['id'] ?? 0),
                'title' => (string)($scenarioRow['title'] ?? ''),
                'specs' => $specs,
                'constraints' => $constraints,
            ],
            'crime_scene' => [
                'killer_entity_id' => $killerId,
                'weapon' => (string)($scenarioRow['crime_scene_weapon'] ?? ''),
                'location' => (string)($scenarioRow['crime_scene_location'] ?? ''),
                'motive' => (string)($scenarioRow['crime_scene_motive'] ?? ''),
            ],
            'cast' => $cast,
        ],
    ], JSON_UNESCAPED_SLASHES);
    if (!is_string($userPrompt)) {
        catn8_json_response(['success' => false, 'error' => 'Failed to encode user prompt'], 500);
    }

    catn8_json_response([
        'success' => true,
        'provider' => (string)$provider,
        'model' => (string)$model,
        'action' => $jobAction,
        'system_prompt' => $systemPrompt,
        'user_prompt' => $userPrompt,
    ]);
}
