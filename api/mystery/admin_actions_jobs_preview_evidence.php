<?php
if ($jobAction === 'generate_evidence') {
    if ($scenarioId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'generate_evidence requires scenario_id'], 400);
    }
    $scenarioRow = Database::queryOne(
        'SELECT id, game_id, slug, title, specs_json, constraints_json, crime_scene_weapon, crime_scene_location, crime_scene_motive FROM mystery_scenarios WHERE id = ?',
        [$scenarioId]
    );
    if (!$scenarioRow) {
        catn8_json_response(['success' => false, 'error' => 'Scenario not found'], 404);
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

    $userPrompt = json_encode([
        'task' => 'Generate a list of physical and digital evidence items for the current murder mystery case.',
        'requirements' => [
            'Return JSON only. Output must match schema exactly.',
            'Evidence must be consistent with the briefing and cold hard facts.',
            'Include at least 3-5 distinct items of evidence.',
            'Provide a title, description, and type (physical, digital, forensic) for each item.',
            'Propose an initial csi_note and detective_note for each item.',
        ],
        'schema' => [
            'evidence' => [
                [
                    'title' => 'string',
                    'description' => 'string',
                    'type' => 'physical|digital|forensic',
                    'csi_note' => 'string',
                    'detective_note' => 'string',
                ]
            ]
        ],
        'context' => [
            'scenario' => [
                'id' => (int)($scenarioRow['id'] ?? 0),
                'title' => (string)($scenarioRow['title'] ?? ''),
                'weapon' => (string)($scenarioRow['crime_scene_weapon'] ?? ''),
                'location' => (string)($scenarioRow['crime_scene_location'] ?? ''),
                'motive' => (string)($scenarioRow['crime_scene_motive'] ?? ''),
            ],
            'briefing' => $briefing,
            'cold_hard_facts' => $coldHardFacts,
        ],
    ], JSON_UNESCAPED_SLASHES);

    catn8_json_response([
        'success' => true,
        'provider' => (string)$provider,
        'model' => (string)$model,
        'action' => $jobAction,
        'system_prompt' => $systemPrompt,
        'user_prompt' => $userPrompt,
    ]);
}
