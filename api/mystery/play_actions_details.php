<?php
declare(strict_types=1);

if ($action === 'get_backstory') {
    catn8_require_method('GET');
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    $row = Database::queryOne('SELECT id, mystery_id, slug, title, backstory_summary, meta_json, spawned_case_id, is_archived, created_at, updated_at FROM mystery_backstories WHERE id = ? LIMIT 1', [$id]);
    if (!$row) catn8_json_response(['success' => false, 'error' => 'Backstory not found'], 404);
    catn8_json_response(['success' => true, 'backstory' => [
        'id' => (int)$row['id'], 'mystery_id' => (int)$row['mystery_id'], 'slug' => (string)$row['slug'],
        'title' => (string)$row['title'], 'backstory_summary' => (string)$row['backstory_summary'],
        'meta' => json_decode((string)$row['meta_json'], true) ?: new stdClass(),
        'spawned_case_id' => (int)$row['spawned_case_id'], 'is_archived' => (int)$row['is_archived'],
        'created_at' => (string)$row['created_at'], 'updated_at' => (string)$row['updated_at']
    ]]);
}

if ($action === 'get_backstory_full') {
    catn8_require_method('GET');
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    $row = Database::queryOne('SELECT id, mystery_id, backstory_text, updated_at FROM mystery_backstories WHERE id = ? LIMIT 1', [$id]);
    if (!$row) catn8_json_response(['success' => false, 'error' => 'Backstory not found'], 404);
    $annotationsJson = '[]';
    $scenario = Database::queryOne('SELECT id FROM mystery_scenarios WHERE backstory_id = ? LIMIT 1', [$id]);
    if ($scenario) {
        $facts = Database::queryOne('SELECT annotations_json FROM mystery_scenario_cold_hard_facts WHERE scenario_id = ? LIMIT 1', [$scenario['id']]);
        if ($facts) $annotationsJson = (string)($facts['annotations_json'] ?? '[]');
    }
    catn8_json_response(['success' => true, 'content_text' => (string)$row['backstory_text'], 'annotations_json' => $annotationsJson, 'updated_at' => (string)$row['updated_at']]);
}

if ($action === 'get_story_book_entry') {
    catn8_require_method('GET');
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    $row = Database::queryOne('SELECT id, owner_user_id, slug, title, theme, source_text, meta_json, is_archived, created_at, updated_at FROM mystery_story_book_entries WHERE id = ? LIMIT 1', [$id]);
    if (!$row) catn8_json_response(['success' => false, 'error' => 'Entry not found'], 404);
    catn8_json_response(['success' => true, 'entry' => [
        'id' => (int)$row['id'], 'owner_user_id' => (int)$row['owner_user_id'], 'slug' => (string)$row['slug'],
        'title' => (string)$row['title'], 'theme' => (string)$row['theme'], 'source_text' => (string)$row['source_text'],
        'meta' => json_decode((string)$row['meta_json'], true) ?: new stdClass(), 'is_archived' => (int)$row['is_archived'],
        'created_at' => (string)$row['created_at'], 'updated_at' => (string)$row['updated_at']
    ]]);
}
