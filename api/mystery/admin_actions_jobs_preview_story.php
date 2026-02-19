<?php
if ($jobAction === 'generate_story_narrative') {
    if ($scenarioId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'generate_story_narrative requires scenario_id'], 400);
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

    $caseSetup = $specs['case_setup'] ?? null;
    if (!is_array($caseSetup)) $caseSetup = [];

    $allowedLocationIds = is_array($caseSetup['available_master_location_ids'] ?? null) ? $caseSetup['available_master_location_ids'] : [];

    $allowedWeaponIds = is_array($caseSetup['available_weapon_ids'] ?? null) ? $caseSetup['available_weapon_ids'] : [];
    if (!count($allowedWeaponIds)) {
        $allowedWeaponIds = is_array($caseSetup['available_master_weapon_ids'] ?? null) ? $caseSetup['available_master_weapon_ids'] : [];
    }

    $allowedMotiveIds = is_array($caseSetup['available_motive_ids'] ?? null) ? $caseSetup['available_motive_ids'] : [];
    if (!count($allowedMotiveIds)) {
        $allowedMotiveIds = is_array($caseSetup['available_master_motive_ids'] ?? null) ? $caseSetup['available_master_motive_ids'] : [];
    }

    $allowedWeapons = $fetchGlobalNames('mystery_weapons', $allowedWeaponIds);
    $allowedMotives = $fetchGlobalNames('mystery_motives', $allowedMotiveIds);
    $allowedLocations = catn8_mystery_fetch_master_names('mystery_master_locations', $mysteryId, $allowedLocationIds);

    $storyBookEntryId = (int)($spec['story_book_entry_id'] ?? ($body['story_book_entry_id'] ?? 0));
    if ($storyBookEntryId < 0) $storyBookEntryId = 0;
    $storyBook = null;
    if ($storyBookEntryId > 0) {
        $sbRow = $isAdmin
            ? Database::queryOne(
                'SELECT id, owner_user_id, slug, title, source_text, meta_json FROM mystery_story_book_entries WHERE id = ? LIMIT 1',
                [$storyBookEntryId]
            )
            : Database::queryOne(
                'SELECT id, owner_user_id, slug, title, source_text, meta_json ' .
                    'FROM mystery_story_book_entries ' .
                    'WHERE id = ? AND (owner_user_id = 0 OR owner_user_id = ?) LIMIT 1',
                [$storyBookEntryId, $viewerId]
            );
        if (!$sbRow) {
            catn8_json_response(['success' => false, 'error' => 'Story Book entry not found'], 404);
        }
        $meta = json_decode((string)($sbRow['meta_json'] ?? '{}'), true);
        if (!is_array($meta)) $meta = [];
        $storyBook = [
            'id' => (int)($sbRow['id'] ?? 0),
            'slug' => (string)($sbRow['slug'] ?? ''),
            'title' => (string)($sbRow['title'] ?? ''),
            'source_text' => (string)($sbRow['source_text'] ?? ''),
            'meta' => $meta,
        ];
    }

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
        'task' => 'Generate a Murder-She-Wrote-style murder mystery narrative with a script-like structure, plus per-character knowledge packets and lies.',
        'requirements' => [
            'Return JSON only. Output must match schema exactly.',
            'Ensure there is at least 1 witness role in the story, chosen from the existing cast list (use an existing cast entity_id). Do not invent or create new characters.',
            'Story should be detailed but not overly verbose.',
            'Write story like a movie script so it is clear who knows what.',
            'Each character should know only their part of the story.',
            'Provide per-character interrogation guidance: truths, evasions, and lies with why.',
            'If a Story Book entry is provided, treat it as a reference mystery to adapt. Do not keep its original character/location names: replace them with this case\'s cast and locations.',
            'Map reference characters/locations to existing case entities/locations as best you can. Do not introduce any new named characters; any witness must be an existing cast member.',
            'Weapons and motives are different: you may use an existing allowed weapon/motive if it matches; otherwise propose a NEW weapon/motive name that fits the story. The system may add it to the master roster.',
        ],
        'schema' => [
            'story' => [
                'title' => 'string',
                'logline' => 'string',
                'briefing' => 'string',
                'weapon' => 'string',
                'motive' => 'string',
                'timeline' => [
                    ['time' => 'string', 'beat' => 'string', 'public_summary' => 'string'],
                ],
                'scenes' => [
                    [
                        'scene_id' => 'string',
                        'setting' => 'string',
                        'summary' => 'string',
                        'dialogue_snippets' => [
                            ['speaker' => 'string', 'line' => 'string'],
                        ],
                    ],
                ],
            ],
            'per_entity' => [
                [
                    'entity_id' => 'int',
                    'role' => 'string',
                    'public_context' => [
                        'why_here' => 'string',
                        'relationship_to_victim' => 'string',
                        'what_others_think' => 'string',
                    ],
                    'private_knowledge' => [
                        'what_i_did' => 'string',
                        'what_i_saw' => 'string',
                        'secrets' => ['string'],
                        'who_i_suspect' => 'string',
                    ],
                    'interrogation' => [
                        'truths' => ['string'],
                        'evasions' => ['string'],
                    ],
                    'lies' => [
                        [
                            'topic_key' => 'string',
                            'lie_type' => 'omission|white_lie|direct',
                            'lie_text' => 'string',
                            'truth_text' => 'string',
                            'why_lie' => 'string',
                            'trigger_questions' => ['string'],
                            'relevance' => 'low|medium|high',
                        ],
                    ],
                    'profile_patch' => [
                        'static_profile' => 'object',
                    ],
                ],
            ],
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
            'allowed' => [
                'weapons' => $allowedWeapons,
                'motives' => $allowedMotives,
                'locations' => $allowedLocations,
            ],
            'story_book' => $storyBook,
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
