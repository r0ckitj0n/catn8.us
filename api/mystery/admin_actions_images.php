<?php
if ($action === 'list_images') {
    $caseId = (int)($_GET['case_id'] ?? 0);
    $scenarioId = isset($_GET['scenario_id']) ? (int)($_GET['scenario_id'] ?? 0) : null;
    $entityId = isset($_GET['entity_id']) ? (int)($_GET['entity_id'] ?? 0) : null;
    $imageType = trim((string)($_GET['image_type'] ?? ''));

    $requireCase($caseId);
    if ($scenarioId !== null && $scenarioId > 0) {
        $scenario = $requireScenario($scenarioId);
        if ((int)($scenario['game_id'] ?? 0) !== $caseId) {
            catn8_json_response(['success' => false, 'error' => 'Scenario does not belong to this case'], 400);
        }
    }
    if ($entityId !== null && $entityId > 0) {
        $entity = $requireEntity($entityId);
        if ((int)($entity['game_id'] ?? 0) !== $caseId) {
            catn8_json_response(['success' => false, 'error' => 'Entity does not belong to this case'], 400);
        }
    }

    $sql = 'SELECT id, game_id, scenario_id, entity_id, image_type, title, prompt_text, negative_prompt_text, provider, model, params_json, status, uploads_file_id, url, alt_text, clue_notes, created_at, updated_at FROM mystery_images WHERE game_id = ?';
    $params = [$caseId];
    if ($scenarioId !== null) {
        $sql .= ' AND scenario_id = ?';
        $params[] = ($scenarioId > 0) ? $scenarioId : null;
    }
    if ($entityId !== null) {
        $sql .= ' AND entity_id = ?';
        $params[] = ($entityId > 0) ? $entityId : null;
    }
    if ($imageType !== '') {
        $sql .= ' AND image_type = ?';
        $params[] = $imageType;
    }
    $sql .= ' ORDER BY updated_at DESC, id DESC';

    $rows = Database::queryAll($sql, $params);
    $images = array_map(static function (array $r): array {
        $paramsObj = json_decode((string)($r['params_json'] ?? '{}'), true);
        if (!is_array($paramsObj)) {
            $paramsObj = [];
        }
        return [
            'id' => (int)($r['id'] ?? 0),
            'case_id' => (int)($r['game_id'] ?? 0),
            'scenario_id' => (int)($r['scenario_id'] ?? 0),
            'entity_id' => (int)($r['entity_id'] ?? 0),
            'image_type' => (string)($r['image_type'] ?? ''),
            'title' => (string)($r['title'] ?? ''),
            'prompt_text' => (string)($r['prompt_text'] ?? ''),
            'negative_prompt_text' => (string)($r['negative_prompt_text'] ?? ''),
            'provider' => (string)($r['provider'] ?? ''),
            'model' => (string)($r['model'] ?? ''),
            'params' => $paramsObj,
            'status' => (string)($r['status'] ?? ''),
            'uploads_file_id' => (int)($r['uploads_file_id'] ?? 0),
            'url' => (string)($r['url'] ?? ''),
            'alt_text' => (string)($r['alt_text'] ?? ''),
            'clue_notes' => (string)($r['clue_notes'] ?? ''),
            'created_at' => (string)($r['created_at'] ?? ''),
            'updated_at' => (string)($r['updated_at'] ?? ''),
        ];
    }, $rows);
    catn8_json_response(['success' => true, 'images' => $images]);
}

if ($action === 'list_agent_images') {
    $agentId = (int)($_GET['agent_id'] ?? 0);
    if ($agentId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid agent_id'], 400);
    }
    require_once __DIR__ . '/admin_functions_images.php';
    $res = catn8_mystery_list_agent_images($agentId);
    catn8_json_response([
        'success' => true,
        'character_url' => $res['character_url'],
        'mugshot_url' => $res['mugshot_url'],
        'ir_urls' => $res['ir_urls']
    ]);
}

if ($action === 'create_image_record') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $caseId = (int)($body['case_id'] ?? 0);
    $scenarioId = isset($body['scenario_id']) ? (int)($body['scenario_id'] ?? 0) : null;
    $entityId = isset($body['entity_id']) ? (int)($body['entity_id'] ?? 0) : null;
    $imageType = trim((string)($body['image_type'] ?? ''));
    $title = trim((string)($body['title'] ?? ''));
    $promptText = (string)($body['prompt_text'] ?? '');
    $negativePromptText = (string)($body['negative_prompt_text'] ?? '');
    $provider = trim((string)($body['provider'] ?? ''));
    $model = trim((string)($body['model'] ?? ''));
    $params = $body['params'] ?? [];
    $status = trim((string)($body['status'] ?? 'missing'));
    $uploadsFileId = isset($body['uploads_file_id']) ? (int)($body['uploads_file_id'] ?? 0) : null;
    $url = (string)($body['url'] ?? '');
    $altText = (string)($body['alt_text'] ?? '');
    $clueNotes = (string)($body['clue_notes'] ?? '');

    $requireCase($caseId);
    if ($scenarioId !== null && $scenarioId > 0) {
        $scenario = $requireScenario($scenarioId);
        if ((int)($scenario['game_id'] ?? 0) !== $caseId) {
            catn8_json_response(['success' => false, 'error' => 'Scenario does not belong to this case'], 400);
        }
    }
    if ($entityId !== null && $entityId > 0) {
        $entity = $requireEntity($entityId);
        if ((int)($entity['game_id'] ?? 0) !== $caseId) {
            catn8_json_response(['success' => false, 'error' => 'Entity does not belong to this case'], 400);
        }
    }
    if ($imageType === '' || $title === '') {
        catn8_json_response(['success' => false, 'error' => 'image_type and title are required'], 400);
    }
    if (!is_array($params)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid params'], 400);
    }

    Database::execute(
        'INSERT INTO mystery_images (game_id, scenario_id, entity_id, image_type, title, prompt_text, negative_prompt_text, provider, model, params_json, status, uploads_file_id, url, alt_text, clue_notes, result_json, error_text)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $caseId,
            ($scenarioId && $scenarioId > 0) ? $scenarioId : null,
            ($entityId && $entityId > 0) ? $entityId : null,
            $imageType,
            $title,
            $promptText,
            $negativePromptText,
            $provider,
            $model,
            json_encode($params),
            ($status !== '' ? $status : 'missing'),
            ($uploadsFileId && $uploadsFileId > 0) ? $uploadsFileId : null,
            $url,
            $altText,
            $clueNotes,
            json_encode(new stdClass()),
            '',
        ]
    );
    $row = Database::queryOne('SELECT id FROM mystery_images WHERE game_id = ? ORDER BY id DESC LIMIT 1', [$caseId]);
    catn8_json_response(['success' => true, 'id' => (int)($row['id'] ?? 0)]);
}

if ($action === 'update_image_record') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $existing = $requireImage($id);

    $title = trim((string)($body['title'] ?? (string)($existing['title'] ?? '')));
    $promptText = (string)($body['prompt_text'] ?? (string)($existing['prompt_text'] ?? ''));
    $negativePromptText = (string)($body['negative_prompt_text'] ?? (string)($existing['negative_prompt_text'] ?? ''));
    $provider = trim((string)($body['provider'] ?? (string)($existing['provider'] ?? '')));
    $model = trim((string)($body['model'] ?? (string)($existing['model'] ?? '')));
    $status = trim((string)($body['status'] ?? (string)($existing['status'] ?? 'missing')));
    $uploadsFileId = isset($body['uploads_file_id']) ? (int)($body['uploads_file_id'] ?? 0) : (int)($existing['uploads_file_id'] ?? 0);
    $url = (string)($body['url'] ?? (string)($existing['url'] ?? ''));
    $altText = (string)($body['alt_text'] ?? (string)($existing['alt_text'] ?? ''));
    $clueNotes = (string)($body['clue_notes'] ?? (string)($existing['clue_notes'] ?? ''));

    if ($title === '') {
        catn8_json_response(['success' => false, 'error' => 'title is required'], 400);
    }

    $params = $body['params'] ?? null;
    if ($params !== null && !is_array($params)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid params'], 400);
    }
    $paramsJson = ($params !== null) ? json_encode($params) : (string)($existing['params_json'] ?? '{}');

    Database::execute(
        'UPDATE mystery_images
         SET title = ?, prompt_text = ?, negative_prompt_text = ?, provider = ?, model = ?, params_json = ?, status = ?, uploads_file_id = ?, url = ?, alt_text = ?, clue_notes = ?
         WHERE id = ?',
        [
            $title,
            $promptText,
            $negativePromptText,
            $provider,
            $model,
            $paramsJson,
            ($status !== '' ? $status : 'missing'),
            ($uploadsFileId && $uploadsFileId > 0) ? $uploadsFileId : null,
            $url,
            $altText,
            $clueNotes,
            $id,
        ]
    );
    catn8_json_response(['success' => true]);
}

if ($action === 'delete_image_record') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $requireImage($id);
    Database::execute('DELETE FROM mystery_images WHERE id = ?', [$id]);
    catn8_json_response(['success' => true]);
}

