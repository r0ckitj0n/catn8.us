<?php
if ($action === 'apply_scenario_cold_hard_facts_fix') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $scenarioId = (int)($body['scenario_id'] ?? 0);
    $requireScenario($scenarioId);

    $fixAction = trim((string)($body['action'] ?? ''));
    $payload = $body['payload'] ?? null;
    if ($fixAction === '' || !is_array($payload)) {
        catn8_json_response(['success' => false, 'error' => 'action and payload are required'], 400);
    }

    if ($fixAction === 'attach_entity') {
        $entityId = (int)($payload['entity_id'] ?? 0);
        $role = trim((string)($payload['role'] ?? 'suspect'));
        if ($entityId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'Invalid entity_id'], 400);
        }
        if ($role === '') $role = 'suspect';

        $entity = $requireEntity($entityId);
        $caseId = (int)($entity['game_id'] ?? 0);
        $scenario = $requireScenario($scenarioId);
        if ((int)($scenario['game_id'] ?? 0) !== $caseId) {
            catn8_json_response(['success' => false, 'error' => 'Entity does not belong to this scenario case'], 400);
        }

        Database::execute(
            'INSERT IGNORE INTO mystery_scenario_entities (scenario_id, entity_id, role, override_json) VALUES (?, ?, ?, ?)',
            [$scenarioId, $entityId, $role, json_encode(new stdClass())]
        );
        catn8_json_response(['success' => true]);
    }

    if ($fixAction === 'set_story_long_text') {
        $text = (string)($payload['text'] ?? '');
        Database::execute(
            'INSERT IGNORE INTO mystery_scenario_cold_hard_facts (scenario_id, cold_hard_facts_text, annotations_json) VALUES (?, ?, ?)',
            [$scenarioId, '', json_encode([])]
        );
        Database::execute(
            'UPDATE mystery_scenario_cold_hard_facts SET cold_hard_facts_text = ? WHERE scenario_id = ?',
            [$text, $scenarioId]
        );
        catn8_json_response(['success' => true]);
    }

    if ($fixAction === 'append_annotation') {
        $a = $payload['annotation'] ?? null;
        if (!is_array($a)) {
            catn8_json_response(['success' => false, 'error' => 'annotation is required'], 400);
        }
        $paragraph = (int)($a['paragraph'] ?? 0);
        $type = trim((string)($a['type'] ?? ''));
        if ($paragraph <= 0 || $type === '') {
            catn8_json_response(['success' => false, 'error' => 'annotation paragraph and type are required'], 400);
        }

        $row = Database::queryOne('SELECT annotations_json FROM mystery_scenario_cold_hard_facts WHERE scenario_id = ?', [$scenarioId]);
        if (!$row) {
            Database::execute(
                'INSERT IGNORE INTO mystery_scenario_cold_hard_facts (scenario_id, cold_hard_facts_text, annotations_json) VALUES (?, ?, ?)',
                [$scenarioId, '', json_encode([])]
            );
            $row = Database::queryOne('SELECT annotations_json FROM mystery_scenario_cold_hard_facts WHERE scenario_id = ?', [$scenarioId]);
        }

        $annotations = json_decode((string)($row['annotations_json'] ?? '[]'), true);
        if (!is_array($annotations)) $annotations = [];
        $annotations[] = $a;
        Database::execute(
            'UPDATE mystery_scenario_cold_hard_facts SET annotations_json = ? WHERE scenario_id = ?',
            [json_encode($annotations, JSON_UNESCAPED_SLASHES), $scenarioId]
        );
        catn8_json_response(['success' => true]);
    }

    if ($fixAction === 'update_annotation') {
        $index = (int)($payload['index'] ?? -1);
        $patch = $payload['patch'] ?? null;
        if ($index < 0 || !is_array($patch)) {
            catn8_json_response(['success' => false, 'error' => 'index and patch are required'], 400);
        }

        $row = Database::queryOne('SELECT annotations_json FROM mystery_scenario_cold_hard_facts WHERE scenario_id = ?', [$scenarioId]);
        if (!$row) {
            catn8_json_response(['success' => false, 'error' => 'Cold Hard Facts not found'], 404);
        }
        $annotations = json_decode((string)($row['annotations_json'] ?? '[]'), true);
        if (!is_array($annotations)) {
            catn8_json_response(['success' => false, 'error' => 'Cold Hard Facts annotations JSON is invalid'], 500);
        }
        if (!isset($annotations[$index]) || !is_array($annotations[$index])) {
            catn8_json_response(['success' => false, 'error' => 'Annotation index out of range'], 400);
        }

        foreach ($patch as $k => $v) {
            $key = trim((string)$k);
            if ($key === '') continue;
            if ($v === null) {
                unset($annotations[$index][$key]);
            } else {
                $annotations[$index][$key] = $v;
            }
        }

        Database::execute(
            'UPDATE mystery_scenario_cold_hard_facts SET annotations_json = ? WHERE scenario_id = ?',
            [json_encode($annotations, JSON_UNESCAPED_SLASHES), $scenarioId]
        );
        catn8_json_response(['success' => true]);
    }

    catn8_json_response(['success' => false, 'error' => 'Unknown fix action'], 400);
}
