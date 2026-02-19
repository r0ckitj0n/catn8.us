<?php
declare(strict_types=1);

if ($action === 'list_templates') {
    catn8_require_method('GET');
    $rows = Database::queryAll('SELECT id, owner_user_id, mystery_id, slug, title, description, global_specs_json, is_template, is_archived, created_at, updated_at FROM mystery_games WHERE is_template = 1 AND is_archived = 0 ORDER BY updated_at DESC, id DESC');
    $templates = array_map(static fn($r) => [
        'id' => (int)$r['id'], 'owner_user_id' => (int)$r['owner_user_id'], 'mystery_id' => (int)$r['mystery_id'],
        'slug' => (string)$r['slug'], 'title' => (string)$r['title'], 'description' => (string)$r['description'],
        'global_specs' => json_decode((string)$r['global_specs_json'], true) ?: new stdClass(),
        'created_at' => (string)$r['created_at'], 'updated_at' => (string)$r['updated_at']
    ], $rows);
    catn8_json_response(['success' => true, 'templates' => $templates]);
}

if ($action === 'list_mysteries') {
    catn8_require_method('GET');
    $rows = Database::queryAll('SELECT id, slug, title, is_archived, created_at, updated_at FROM mystery_mysteries WHERE is_archived = 0 ORDER BY updated_at DESC, id DESC');
    $items = array_map(static fn($r) => [
        'id' => (int)$r['id'], 'slug' => (string)$r['slug'], 'title' => (string)$r['title'],
        'is_archived' => (int)$r['is_archived'], 'created_at' => (string)$r['created_at'], 'updated_at' => (string)$r['updated_at']
    ], $rows);
    catn8_json_response(['success' => true, 'mysteries' => $items]);
}

if ($action === 'list_cases') {
    catn8_require_method('GET');
    $mysteryId = (int)($_GET['mystery_id'] ?? 0);
    if ($mysteryId <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid mystery_id'], 400);
    $rows = Database::queryAll('SELECT g.id, g.mystery_id, g.owner_user_id, g.slug, g.title, g.description, g.is_template, g.is_archived, g.created_at, g.updated_at, b.title AS backstory_title, b.backstory_summary, img.url AS location_image_url FROM mystery_games g LEFT JOIN mystery_backstories b ON b.id = g.backstory_id LEFT JOIN mystery_images img ON img.game_id = g.id AND img.image_type = "location" AND img.scenario_id IS NULL WHERE g.mystery_id = ? AND g.is_template = 0 AND g.is_archived = 0 ORDER BY g.updated_at DESC, g.id DESC', [$mysteryId]);
    $items = array_map(static fn($r) => [
        'id' => (int)$r['id'], 'mystery_id' => (int)$r['mystery_id'], 'owner_user_id' => (int)$r['owner_user_id'],
        'slug' => (string)$r['slug'], 'title' => (string)$r['title'], 'description' => (string)$r['description'],
        'is_template' => (bool)$r['is_template'], 'backstory_title' => (string)$r['backstory_title'],
        'backstory_summary' => (string)$r['backstory_summary'], 'location_image_url' => (string)$r['location_image_url'],
        'created_at' => (string)$r['created_at'], 'updated_at' => (string)$r['updated_at']
    ], $rows);
    catn8_json_response(['success' => true, 'cases' => $items]);
}

if ($action === 'list_backstories') {
    catn8_require_method('GET');
    $mysteryId = (int)($_GET['mystery_id'] ?? 0);
    $where = 'is_archived = 0'; $params = [];
    if ($mysteryId > 0) { $where .= ' AND mystery_id = ?'; $params[] = $mysteryId; }
    $rows = Database::queryAll("SELECT id, mystery_id, slug, title, backstory_summary, created_at, updated_at FROM mystery_backstories WHERE $where ORDER BY updated_at DESC, id DESC", $params);
    $items = array_map(static fn($r) => [
        'id' => (int)$r['id'], 'mystery_id' => (int)$r['mystery_id'], 'slug' => (string)$r['slug'],
        'title' => (string)$r['title'], 'backstory_summary' => (string)$r['backstory_summary'],
        'created_at' => (string)$r['created_at'], 'updated_at' => (string)$r['updated_at']
    ], $rows);
    catn8_json_response(['success' => true, 'backstories' => $items]);
}

if ($action === 'list_story_book_entries') {
    catn8_require_method('GET');
    $includeArchived = (int)($_GET['include_archived'] ?? 0);
    $where = $includeArchived ? '1' : 'is_archived = 0';
    $rows = Database::queryAll("SELECT id, owner_user_id, slug, title, theme, meta_json, is_archived, created_at, updated_at FROM mystery_story_book_entries WHERE $where ORDER BY updated_at DESC, id DESC");
    $items = array_map(static fn($r) => [
        'id' => (int)$r['id'], 'owner_user_id' => (int)$r['owner_user_id'], 'slug' => (string)$r['slug'],
        'title' => (string)$r['title'], 'theme' => (string)$r['theme'], 'is_archived' => (int)$r['is_archived'],
        'meta' => json_decode((string)$r['meta_json'], true) ?: new stdClass(),
        'created_at' => (string)$r['created_at'], 'updated_at' => (string)$r['updated_at']
    ], $rows);
    catn8_json_response(['success' => true, 'entries' => $items]);
}
