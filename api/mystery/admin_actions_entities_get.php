<?php
if ($action === 'get_entity') {
    $entityId = (int)($_GET['entity_id'] ?? 0);
    $row = $requireEntity($entityId);

    $data = json_decode((string)($row['data_json'] ?? '{}'), true);
    if (!is_array($data)) $data = [];

    $roles = json_decode((string)($row['roles_json'] ?? '[]'), true);
    if (!is_array($roles)) $roles = [];
    $roles = array_values(array_filter(array_map(static fn($v) => trim((string)$v), $roles), static fn($v) => $v !== ''));

    catn8_json_response(['success' => true, 'entity' => [
        'id' => (int)($row['id'] ?? 0),
        'case_id' => (int)($row['game_id'] ?? 0),
        'entity_type' => (string)($row['entity_type'] ?? ''),
        'slug' => (string)($row['slug'] ?? ''),
        'name' => (string)($row['name'] ?? ''),
        'data' => $data,
        'roles' => $roles,
        'is_archived' => (int)($row['is_archived'] ?? 0),
        'accent_preference' => (string)($row['accent_preference'] ?? ''),
        'created_at' => (string)($row['created_at'] ?? ''),
        'updated_at' => (string)($row['updated_at'] ?? ''),
    ]]);
}
