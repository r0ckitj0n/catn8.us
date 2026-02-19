<?php
if ($action === 'list_lies') {
    $scenarioId = (int)($_GET['scenario_id'] ?? 0);
    $requireScenario($scenarioId);

    $rows = Database::queryAll(
        'SELECT id, scenario_id, entity_id, lie_type, topic_key, lie_text, truth_text, trigger_questions_json, relevance, notes, created_at, updated_at
         FROM mystery_scenario_lies
         WHERE scenario_id = ?
         ORDER BY id DESC',
        [$scenarioId]
    );
    $lies = array_map(static function (array $r): array {
        $trigger = json_decode((string)($r['trigger_questions_json'] ?? '[]'), true);
        if (!is_array($trigger)) {
            $trigger = [];
        }
        return [
            'id' => (int)($r['id'] ?? 0),
            'scenario_id' => (int)($r['scenario_id'] ?? 0),
            'entity_id' => (int)($r['entity_id'] ?? 0),
            'lie_type' => (string)($r['lie_type'] ?? ''),
            'topic_key' => (string)($r['topic_key'] ?? ''),
            'lie_text' => (string)($r['lie_text'] ?? ''),
            'truth_text' => (string)($r['truth_text'] ?? ''),
            'trigger_questions' => $trigger,
            'relevance' => (string)($r['relevance'] ?? ''),
            'notes' => (string)($r['notes'] ?? ''),
            'created_at' => (string)($r['created_at'] ?? ''),
            'updated_at' => (string)($r['updated_at'] ?? ''),
        ];
    }, $rows);
    catn8_json_response(['success' => true, 'lies' => $lies]);
}

if ($action === 'create_lie') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $scenarioId = (int)($body['scenario_id'] ?? 0);
    $entityId = (int)($body['entity_id'] ?? 0);
    $lieType = trim((string)($body['lie_type'] ?? ''));
    $topicKey = trim((string)($body['topic_key'] ?? ''));
    $lieText = (string)($body['lie_text'] ?? '');
    $truthText = (string)($body['truth_text'] ?? '');
    $triggerQuestions = $body['trigger_questions'] ?? [];
    $relevance = trim((string)($body['relevance'] ?? 'low'));
    $notes = (string)($body['notes'] ?? '');

    $scenario = $requireScenario($scenarioId);
    $entity = $requireEntity($entityId);

    if ((int)($scenario['game_id'] ?? 0) !== (int)($entity['game_id'] ?? 0)) {
        catn8_json_response(['success' => false, 'error' => 'Entity does not belong to this game'], 400);
    }
    if ($lieType === '' || $topicKey === '') {
        catn8_json_response(['success' => false, 'error' => 'lie_type and topic_key are required'], 400);
    }
    if (!is_array($triggerQuestions)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid trigger_questions'], 400);
    }

    Database::execute(
        'INSERT INTO mystery_scenario_lies (scenario_id, entity_id, lie_type, topic_key, lie_text, truth_text, trigger_questions_json, relevance, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [$scenarioId, $entityId, $lieType, $topicKey, $lieText, $truthText, json_encode($triggerQuestions), ($relevance !== '' ? $relevance : 'low'), $notes]
    );
    $row = Database::queryOne('SELECT id FROM mystery_scenario_lies WHERE scenario_id = ? ORDER BY id DESC LIMIT 1', [$scenarioId]);
    catn8_json_response(['success' => true, 'id' => (int)($row['id'] ?? 0)]);
}

if ($action === 'update_lie') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $existing = $requireLie($id);

    $entityId = isset($body['entity_id']) ? (int)($body['entity_id'] ?? 0) : (int)($existing['entity_id'] ?? 0);
    $lieType = trim((string)($body['lie_type'] ?? (string)($existing['lie_type'] ?? '')));
    $topicKey = trim((string)($body['topic_key'] ?? (string)($existing['topic_key'] ?? '')));
    $lieText = (string)($body['lie_text'] ?? (string)($existing['lie_text'] ?? ''));
    $truthText = (string)($body['truth_text'] ?? (string)($existing['truth_text'] ?? ''));
    $relevance = trim((string)($body['relevance'] ?? (string)($existing['relevance'] ?? 'low')));
    $notes = (string)($body['notes'] ?? (string)($existing['notes'] ?? ''));

    if ($entityId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'entity_id is required'], 400);
    }
    if ($lieType === '' || $topicKey === '') {
        catn8_json_response(['success' => false, 'error' => 'lie_type and topic_key are required'], 400);
    }

    $scenario = $requireScenario((int)($existing['scenario_id'] ?? 0));
    $entity = $requireEntity($entityId);
    if ((int)($scenario['game_id'] ?? 0) !== (int)($entity['game_id'] ?? 0)) {
        catn8_json_response(['success' => false, 'error' => 'Entity does not belong to this game'], 400);
    }

    $triggerQuestions = $body['trigger_questions'] ?? null;
    if ($triggerQuestions !== null && !is_array($triggerQuestions)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid trigger_questions'], 400);
    }
    $triggerJson = ($triggerQuestions !== null) ? json_encode($triggerQuestions) : (string)($existing['trigger_questions_json'] ?? '[]');

    Database::execute(
        'UPDATE mystery_scenario_lies SET entity_id = ?, lie_type = ?, topic_key = ?, lie_text = ?, truth_text = ?, trigger_questions_json = ?, relevance = ?, notes = ? WHERE id = ?',
        [$entityId, $lieType, $topicKey, $lieText, $truthText, $triggerJson, ($relevance !== '' ? $relevance : 'low'), $notes, $id]
    );
    catn8_json_response(['success' => true]);
}

if ($action === 'delete_lie') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $requireLie($id);
    Database::execute('DELETE FROM mystery_scenario_lies WHERE id = ?', [$id]);
    catn8_json_response(['success' => true]);
}

