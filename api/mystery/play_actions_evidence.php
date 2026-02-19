<?php
declare(strict_types=1);

if ($action === 'list_case_notes') {
    catn8_require_method('GET');
    $sid = (int)($_GET['scenario_id'] ?? 0);
    if ($sid <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid scenario_id'], 400);
    $rows = Database::queryAll('SELECT id, scenario_id, title, note_type, clue_count, is_archived, created_at, updated_at FROM mystery_case_notes WHERE scenario_id = ? AND is_archived = 0 ORDER BY updated_at DESC, id DESC', [$sid]);
    catn8_json_response(['success' => true, 'case_notes' => array_map(static fn($r) => ['id' => (int)$r['id'], 'scenario_id' => (int)$r['scenario_id'], 'title' => (string)$r['title'], 'note_type' => (string)$r['note_type'], 'clue_count' => (int)$r['clue_count'], 'is_archived' => (int)$r['is_archived'], 'created_at' => (string)$r['created_at'], 'updated_at' => (string)$r['updated_at']], $rows)]);
}

if ($action === 'list_lies') {
    catn8_require_method('GET');
    $sid = (int)($_GET['scenario_id'] ?? 0);
    if ($sid <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid scenario_id'], 400);
    $rows = Database::queryAll('SELECT * FROM mystery_scenario_lies WHERE scenario_id = ? ORDER BY id DESC', [$sid]);
    catn8_json_response(['success' => true, 'lies' => array_map(static fn($r) => ['id' => (int)$r['id'], 'scenario_id' => (int)$r['scenario_id'], 'entity_id' => (int)$r['entity_id'], 'lie_type' => (string)$r['lie_type'], 'topic_key' => (string)$r['topic_key'], 'lie_text' => (string)$r['lie_text'], 'truth_text' => (string)$r['truth_text'], 'trigger_questions' => json_decode((string)$r['trigger_questions_json'], true) ?: [], 'relevance' => (string)$r['relevance'], 'notes' => (string)$r['notes'], 'created_at' => (string)$r['created_at'], 'updated_at' => (string)$r['updated_at']], $rows)]);
}

if ($action === 'list_evidence') {
    catn8_require_method('GET');
    $sid = (int)($_GET['scenario_id'] ?? 0);
    if ($sid <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid scenario_id'], 400);
    
    // Fetch evidence
    $rows = Database::queryAll('SELECT * FROM mystery_evidence WHERE scenario_id = ? AND is_archived = 0 ORDER BY id ASC', [$sid]);
    
    // Fetch all notes for these evidence items in one go
    $evidenceIds = array_column($rows, 'id');
    $notesByEvidence = [];
    if (!empty($evidenceIds)) {
        $placeholders = implode(',', array_fill(0, count($evidenceIds), '?'));
        $noteRows = Database::queryAll("SELECT * FROM mystery_evidence_notes WHERE evidence_id IN ($placeholders) ORDER BY created_at ASC", $evidenceIds);
        foreach ($noteRows as $nr) {
            $notesByEvidence[(int)$nr['evidence_id']][] = [
                'id' => (int)$nr['id'],
                'author_role' => (string)$nr['author_role'],
                'note_text' => (string)$nr['note_text'],
                'created_at' => (string)$nr['created_at']
            ];
        }
    }

    $evidence = array_map(static fn($r) => [
        'id' => (int)$r['id'],
        'scenario_id' => (int)$r['scenario_id'],
        'evidence_type' => (string)($r['evidence_type'] ?? 'physical'),
        'title' => (string)$r['title'],
        'description' => (string)$r['description'],
        'image_url' => (string)($r['image_url'] ?? ''),
        'meta' => json_decode((string)($r['meta_json'] ?? '{}'), true) ?: new stdClass(),
        'notes' => $notesByEvidence[(int)$r['id']] ?? [],
        'created_at' => (string)$r['created_at'],
        'updated_at' => (string)$r['updated_at']
    ], $rows);

    catn8_json_response(['success' => true, 'evidence' => $evidence]);
}

if ($action === 'add_evidence_note') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0); 
    $noteText = trim((string)($body['note_text'] ?? $body['notes'] ?? ''));
    $authorRole = trim((string)($body['author_role'] ?? 'Detective'));

    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    if ($noteText === '') catn8_json_response(['success' => false, 'error' => 'Note text is empty'], 400);

    Database::execute(
        'INSERT INTO mystery_evidence_notes (evidence_id, author_role, note_text) VALUES (?, ?, ?)', 
        [$id, $authorRole, $noteText]
    );

    catn8_json_response(['success' => true]);
}

if ($action === 'get_cold_hard_facts') {
    catn8_require_method('GET');
    $sid = (int)($_GET['scenario_id'] ?? 0);
    if ($sid <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid scenario_id'], 400);
    $row = Database::queryOne('SELECT * FROM mystery_scenario_cold_hard_facts WHERE scenario_id = ? LIMIT 1', [$sid]);
    catn8_json_response(['success' => true, 'facts' => $row ? ['id' => (int)$row['id'], 'scenario_id' => (int)$row['scenario_id'], 'facts_json' => json_decode((string)$row['facts_json'], true) ?: [], 'annotations_json' => json_decode((string)$row['annotations_json'], true) ?: []] : null]);
}

if ($action === 'list_entities') {
    catn8_require_method('GET');
    $caseId = (int)($_GET['case_id'] ?? 0);
    if ($caseId <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid case_id'], 400);
    $type = trim((string)($_GET['entity_type'] ?? ''));
    $sql = 'SELECT id, game_id, entity_type, slug, name, roles_json, is_archived, accent_preference, created_at, updated_at FROM mystery_entities WHERE game_id = ?';
    $params = [$caseId];
    if ($type !== '') { $sql .= ' AND entity_type = ?'; $params[] = $type; }
    $rows = Database::queryAll($sql . ' ORDER BY updated_at DESC, id DESC', $params);
    catn8_json_response(['success' => true, 'entities' => array_map(static fn($r) => ['id' => (int)$r['id'], 'case_id' => (int)$r['game_id'], 'entity_type' => (string)$r['entity_type'], 'slug' => (string)$r['slug'], 'name' => (string)$r['name'], 'roles' => json_decode((string)$r['roles_json'], true) ?: [], 'is_archived' => (int)$r['is_archived'], 'accent_preference' => (string)$r['accent_preference'], 'created_at' => (string)$r['created_at'], 'updated_at' => (string)$r['updated_at']], $rows)]);
}
