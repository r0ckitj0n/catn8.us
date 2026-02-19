<?php
if ($jobAction === 'generate_deposition') {
    if ($scenarioId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'generate_deposition requires scenario_id'], 400);
    }
    if ($entityId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'generate_deposition requires entity_id'], 400);
    }
    $scenarioRow = Database::queryOne(
        'SELECT id, game_id, slug, title, specs_json, constraints_json, crime_scene_weapon, crime_scene_location, crime_scene_motive FROM mystery_scenarios WHERE id = ?',
        [$scenarioId]
    );
    if (!$scenarioRow) {
        catn8_json_response(['success' => false, 'error' => 'Scenario not found'], 404);
    }
    $entityRow = Database::queryOne(
        'SELECT id, game_id, entity_type, slug, name, data_json FROM mystery_entities WHERE id = ?',
        [$entityId]
    );
    if (!$entityRow) {
        catn8_json_response(['success' => false, 'error' => 'Entity not found'], 404);
    }
    if ((int)($entityRow['game_id'] ?? 0) !== (int)($scenarioRow['game_id'] ?? 0)) {
        catn8_json_response(['success' => false, 'error' => 'Entity does not belong to scenario case'], 400);
    }
    $seRow = Database::queryOne(
        'SELECT role, override_json FROM mystery_scenario_entities WHERE scenario_id = ? AND entity_id = ? LIMIT 1',
        [$scenarioId, $entityId]
    );
    if (!$seRow) {
        catn8_json_response(['success' => false, 'error' => 'Entity is not attached to this scenario'], 404);
    }
    $storyRow = Database::queryOne('SELECT cold_hard_facts_text FROM mystery_scenario_cold_hard_facts WHERE scenario_id = ? LIMIT 1', [$scenarioId]);

    $specs = json_decode((string)($scenarioRow['specs_json'] ?? '{}'), true);
    if (!is_array($specs)) $specs = [];
    $constraints = json_decode((string)($scenarioRow['constraints_json'] ?? '{}'), true);
    if (!is_array($constraints)) $constraints = [];

    $briefing = '';
    if (isset($constraints['briefing']) && is_array($constraints['briefing'])) {
        $sb = $constraints['briefing'];
        $briefing = trim((string)($sb['narrative_text'] ?? $sb['story_text'] ?? $sb['story'] ?? ''));
    }
    $coldHardFacts = trim((string)($storyRow['cold_hard_facts_text'] ?? ''));

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
        'task' => 'Write a sworn deposition and supporting character constraints (alibi, objective, relevance) for the given character in the current murder mystery case.',
        'requirements' => [
            'Return JSON only. Output must match schema exactly.',
            'Deposition must stay consistent with the current case guardrails (crime scene fields, cast, briefing, cold hard facts).',
            'Write as an official statement to investigators, in first person, with specific claims that can later be contradicted by lies/interrogation.',
            'Do not invent a different killer, weapon, motive, or location than provided.',
            'Every character must have a claimed alibi/location, a short objective, and a short relevance statement.',
        ],
        'schema' => [
            'deposition_text' => 'string',
            'claimed_alibi_text' => 'string',
            'alibi_truth_text' => 'string',
            'objective_text' => 'string',
            'relevance_text' => 'string',
        ],
        'context' => [
            'scenario' => [
                'id' => (int)($scenarioRow['id'] ?? 0),
                'slug' => (string)($scenarioRow['slug'] ?? ''),
                'title' => (string)($scenarioRow['title'] ?? ''),
                'specs' => $specs,
                'constraints' => $constraints,
            ],
            'crime_scene' => [
                'weapon' => (string)($scenarioRow['crime_scene_weapon'] ?? ''),
                'location' => (string)($scenarioRow['crime_scene_location'] ?? ''),
                'motive' => (string)($scenarioRow['crime_scene_motive'] ?? ''),
            ],
            'briefing' => $briefing,
            'cold_hard_facts' => $coldHardFacts,
            'cast' => $cast,
            'entity' => [
                'id' => (int)($entityRow['id'] ?? 0),
                'slug' => (string)($entityRow['slug'] ?? ''),
                'name' => (string)($entityRow['name'] ?? ''),
                'role' => (string)($seRow['role'] ?? ''),
                'data' => json_decode((string)($entityRow['data_json'] ?? '{}'), true) ?: new stdClass(),
                'override' => json_decode((string)($seRow['override_json'] ?? '{}'), true) ?: new stdClass(),
            ],
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
