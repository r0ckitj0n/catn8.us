<?php
if ($action === 'list_case_notes') {
    $scenarioId = (int)($_GET['scenario_id'] ?? 0);
    $requireScenario($scenarioId);

    $rows = Database::queryAll(
        'SELECT id, scenario_id, title, note_type, clue_count, is_archived, created_at, updated_at
         FROM mystery_case_notes
         WHERE scenario_id = ? AND is_archived = 0
         ORDER BY updated_at DESC, id DESC',
        [$scenarioId]
    );
    $notes = array_map(static function (array $r): array {
        return [
            'id' => (int)($r['id'] ?? 0),
            'scenario_id' => (int)($r['scenario_id'] ?? 0),
            'title' => (string)($r['title'] ?? ''),
            'note_type' => (string)($r['note_type'] ?? ''),
            'clue_count' => (int)($r['clue_count'] ?? 0),
            'is_archived' => (int)($r['is_archived'] ?? 0),
            'created_at' => (string)($r['created_at'] ?? ''),
            'updated_at' => (string)($r['updated_at'] ?? ''),
        ];
    }, $rows);
    catn8_json_response(['success' => true, 'case_notes' => $notes]);
}

if ($action === 'create_case_note') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $scenarioId = (int)($body['scenario_id'] ?? 0);
    $requireScenario($scenarioId);

    $title = trim((string)($body['title'] ?? ''));
    $noteType = trim((string)($body['note_type'] ?? 'case_file'));
    $content = $body['content_rich'] ?? null;
    $clueCount = (int)($body['clue_count'] ?? 0);

    if ($title === '') {
        catn8_json_response(['success' => false, 'error' => 'title is required'], 400);
    }
    if ($noteType === '') {
        catn8_json_response(['success' => false, 'error' => 'note_type is required'], 400);
    }
    if ($content === null || !is_array($content)) {
        catn8_json_response(['success' => false, 'error' => 'content_rich is required'], 400);
    }
    if ($clueCount < 0) {
        $clueCount = 0;
    }

    Database::execute(
        'INSERT INTO mystery_case_notes (scenario_id, title, note_type, content_rich_json, clue_count, is_archived) VALUES (?, ?, ?, ?, ?, 0)',
        [$scenarioId, $title, $noteType, json_encode($content), $clueCount]
    );
    $row = Database::queryOne('SELECT id FROM mystery_case_notes WHERE scenario_id = ? ORDER BY id DESC LIMIT 1', [$scenarioId]);
    catn8_json_response(['success' => true, 'id' => (int)($row['id'] ?? 0)]);
}

if ($action === 'get_case_note') {
    $noteId = (int)($_GET['id'] ?? 0);
    $row = $requireCaseNote($noteId);

    $contentRich = json_decode((string)($row['content_rich_json'] ?? '{}'), true);
    if (!is_array($contentRich)) {
        $contentRich = [];
    }

    catn8_json_response(['success' => true, 'case_note' => [
        'id' => (int)($row['id'] ?? 0),
        'scenario_id' => (int)($row['scenario_id'] ?? 0),
        'title' => (string)($row['title'] ?? ''),
        'note_type' => (string)($row['note_type'] ?? ''),
        'content_rich' => $contentRich,
        'clue_count' => (int)($row['clue_count'] ?? 0),
        'is_archived' => (int)($row['is_archived'] ?? 0),
        'created_at' => (string)($row['created_at'] ?? ''),
        'updated_at' => (string)($row['updated_at'] ?? ''),
    ]]);
}

if ($action === 'update_case_note') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $existing = $requireCaseNote($id);

    $title = trim((string)($body['title'] ?? (string)($existing['title'] ?? '')));
    $noteType = trim((string)($body['note_type'] ?? (string)($existing['note_type'] ?? '')));
    $isArchived = (int)($body['is_archived'] ?? (int)($existing['is_archived'] ?? 0)) ? 1 : 0;
    $clueCount = isset($body['clue_count']) ? (int)($body['clue_count'] ?? 0) : (int)($existing['clue_count'] ?? 0);

    if ($title === '') {
        catn8_json_response(['success' => false, 'error' => 'title is required'], 400);
    }
    if ($noteType === '') {
        catn8_json_response(['success' => false, 'error' => 'note_type is required'], 400);
    }
    if ($clueCount < 0) {
        $clueCount = 0;
    }

    $content = $body['content_rich'] ?? null;
    if ($content !== null && !is_array($content)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid content_rich'], 400);
    }
    $contentJson = ($content !== null) ? json_encode($content) : (string)($existing['content_rich_json'] ?? '{}');

    Database::execute(
        'UPDATE mystery_case_notes SET title = ?, note_type = ?, content_rich_json = ?, clue_count = ?, is_archived = ? WHERE id = ?',
        [$title, $noteType, $contentJson, $clueCount, $isArchived, $id]
    );
    catn8_json_response(['success' => true]);
}

if ($action === 'delete_case_note') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $requireCaseNote($id);

    Database::execute('DELETE FROM mystery_case_notes WHERE id = ?', [$id]);
    catn8_json_response(['success' => true]);
}

