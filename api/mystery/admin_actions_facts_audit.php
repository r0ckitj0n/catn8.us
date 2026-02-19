<?php
if ($action === 'audit_scenario_cold_hard_facts') {
    $scenarioId = (int)($_GET['scenario_id'] ?? 0);
    $scenarioRow = $requireScenario($scenarioId);
    $caseId = (int)($scenarioRow['game_id'] ?? 0);

    $errors = [];
    $warnings = [];
    $info = [];

    $constraints = json_decode((string)($scenarioRow['constraints_json'] ?? '{}'), true);
    if (!is_array($constraints)) {
        $constraints = [];
        $warnings[] = 'Scenario constraints_json is not valid JSON.';
    }

    $winning = [
        'weapon' => trim((string)($scenarioRow['crime_scene_weapon'] ?? '')),
        'motive' => trim((string)($scenarioRow['crime_scene_motive'] ?? '')),
        'location' => trim((string)($scenarioRow['crime_scene_location'] ?? '')),
        'murderer_ids' => [],
    ];
    $murdererRows = Database::queryAll('SELECT entity_id FROM mystery_scenario_murderers WHERE scenario_id = ? ORDER BY id ASC', [$scenarioId]);
    foreach ($murdererRows as $mr) {
        $eid = (int)($mr['entity_id'] ?? 0);
        if ($eid > 0) {
            $winning['murderer_ids'][] = $eid;
        }
    }

    $storyRow = Database::queryOne(
        'SELECT cold_hard_facts_text, annotations_json, updated_at FROM mystery_scenario_cold_hard_facts WHERE scenario_id = ?',
        [$scenarioId]
    );
    $storyLongText = trim((string)($storyRow['cold_hard_facts_text'] ?? ''));
    if ($storyLongText === '') {
        $warnings[] = 'Cold Hard Facts (long) is empty.';
    }
    $annotationsRaw = (string)($storyRow['annotations_json'] ?? '[]');
    $annotations = json_decode($annotationsRaw, true);
    if (!is_array($annotations)) {
        $annotations = [];
        $errors[] = 'Cold Hard Facts annotations_json is not a JSON array.';
    }

    $scenarioEntities = Database::queryAll(
        'SELECT id, entity_id, role FROM mystery_scenario_entities WHERE scenario_id = ? ORDER BY id ASC',
        [$scenarioId]
    );
    $scenarioEntityIdSet = [];
    foreach ($scenarioEntities as $se) {
        $eid = (int)($se['entity_id'] ?? 0);
        if ($eid > 0) {
            $scenarioEntityIdSet[$eid] = true;
        }
    }

    $lieRows = Database::queryAll('SELECT id FROM mystery_scenario_lies WHERE scenario_id = ?', [$scenarioId]);
    $lieIdSet = [];
    foreach ($lieRows as $r) {
        $lid = (int)($r['id'] ?? 0);
        if ($lid > 0) $lieIdSet[$lid] = true;
    }

    $noteRows = Database::queryAll('SELECT id FROM mystery_case_notes WHERE scenario_id = ? AND is_archived = 0', [$scenarioId]);
    $noteIdSet = [];
    foreach ($noteRows as $r) {
        $nid = (int)($r['id'] ?? 0);
        if ($nid > 0) $noteIdSet[$nid] = true;
    }

    $typeCounts = [];
    $fixes = [];
    $covered = [
        'weapon' => false,
        'motive' => false,
        'location' => false,
        'killer' => false,
        'witness' => false,
    ];

    $audit = catn8_mystery_audit_annotations($annotations, $scenarioEntityIdSet, $lieIdSet, $noteIdSet, $winning);
    $errors = array_merge($errors, $audit['errors']);
    $warnings = array_merge($warnings, $audit['warnings']);
    $fixes = array_merge($fixes, $audit['fixes']);
    $covered = $audit['covered'];
    $typeCounts = $audit['type_counts'];

    $murdererIds = [];
    if (isset($winning['murderer_ids']) && is_array($winning['murderer_ids'])) {
        $murdererIds = array_values(array_filter(array_map('intval', $winning['murderer_ids']), static fn($n) => (int)$n > 0));
    }

    if (count($murdererIds) > 0) {
        $murdererEntityId = (int)$murdererIds[0];
        if ($murdererEntityId > 0 && !isset($scenarioEntityIdSet[$murdererEntityId])) {
            $fixes[] = [
                'id' => 'attach_murderer_' . (string)$murdererEntityId,
                'label' => 'Attach murderer entity #' . (string)$murdererEntityId . ' to scenario as killer',
                'action' => 'attach_entity',
                'payload' => [
                    'entity_id' => $murdererEntityId,
                    'role' => 'killer',
                ],
            ];
        }
    }

    if (count($murdererIds) > 0 && !$covered['killer']) {
        $warnings[] = 'Crime scene has murderer_id(s), but there are no killer annotations.';
        $eid = (int)$murdererIds[0];
        if ($eid > 0) {
            $fixes[] = [
                'id' => 'add_killer_annotation_' . (string)$eid,
                'label' => 'Add killer annotation (paragraph 1) for murderer entity #' . (string)$eid,
                'action' => 'append_annotation',
                'payload' => [
                    'annotation' => [
                        'paragraph' => 1,
                        'type' => 'killer',
                        'entity_id' => $eid,
                        'note' => 'Auto-added from canonical crime scene fields',
                    ],
                ],
            ];
        }
    }
    if (trim((string)($winning['weapon'] ?? '')) !== '' && !$covered['weapon']) {
        $warnings[] = 'Crime scene has weapon, but there are no weapon annotations.';
        $fixes[] = [
            'id' => 'add_weapon_annotation',
            'label' => 'Add weapon annotation (paragraph 1) from crime_scene_weapon',
            'action' => 'append_annotation',
            'payload' => [
                'annotation' => [
                    'paragraph' => 1,
                    'type' => 'weapon',
                    'weapon' => (string)($winning['weapon'] ?? ''),
                    'note' => 'Auto-added from canonical crime scene fields',
                ],
            ],
        ];
    }
    if (trim((string)($winning['motive'] ?? '')) !== '' && !$covered['motive']) {
        $warnings[] = 'Crime scene has motive, but there are no motive annotations.';
        $fixes[] = [
            'id' => 'add_motive_annotation',
            'label' => 'Add motive annotation (paragraph 1) from crime_scene_motive',
            'action' => 'append_annotation',
            'payload' => [
                'annotation' => [
                    'paragraph' => 1,
                    'type' => 'motive',
                    'motive' => (string)($winning['motive'] ?? ''),
                    'note' => 'Auto-added from canonical crime scene fields',
                ],
            ],
        ];
    }
    if (trim((string)($winning['location'] ?? '')) !== '' && !$covered['location']) {
        $warnings[] = 'Crime scene has location, but there are no location annotations.';
        $fixes[] = [
            'id' => 'add_location_annotation',
            'label' => 'Add location annotation (paragraph 1) from crime_scene_location',
            'action' => 'append_annotation',
            'payload' => [
                'annotation' => [
                    'paragraph' => 1,
                    'type' => 'location',
                    'location' => (string)($winning['location'] ?? ''),
                    'note' => 'Auto-added from canonical crime scene fields',
                ],
            ],
        ];
    }

    $info[] = 'Case ID: ' . (string)$caseId;
    $info[] = 'Scenario ID: ' . (string)$scenarioId;

    catn8_json_response([
        'success' => true,
        'scenario_id' => $scenarioId,
        'report' => [
            'errors' => $errors,
            'warnings' => $warnings,
            'info' => $info,
            'quick_fixes' => $fixes,
            'stats' => [
                'annotation_count' => count($annotations),
                'annotation_type_counts' => $typeCounts,
                'scenario_entity_count' => count($scenarioEntities),
                'lie_count' => count($lieRows),
                'case_note_count' => count($noteRows),
                'story_updated_at' => $storyRow['updated_at'] ?? null,
            ],
        ],
    ]);
}
