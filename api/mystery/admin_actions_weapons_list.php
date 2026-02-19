<?php
if ($action === 'list_weapons') {
    catn8_require_method('GET');

    $includeArchived = (string)($_GET['include_archived'] ?? '') === '1';
    $caseId = (int)($_GET['case_id'] ?? 0);

    $lockedIds = [];
    foreach (catn8_mystery_collect_locked_weapon_ids() as $wid) {
        $lockedIds[(int)$wid] = true;
    }

    $where = $includeArchived ? '1=1' : 'is_archived = 0';
    $params = [];

    // NOTE: Non-admins can see ALL active assets to choose from for their case.
    // The previous logic restricted them to ONLY what was already assigned to the case, 
    // which caused an empty list if nothing was assigned yet.

    $rows = Database::queryAll(
        "SELECT id, slug, name, description, is_archived, created_at, updated_at " .
        "FROM mystery_weapons " .
        "WHERE $where " .
        "ORDER BY updated_at DESC, id DESC",
        $params
    );

    // DEBUG: error_log("list_weapons: found " . count($rows) . " rows");

    $weapons = array_map(static function (array $r) use ($lockedIds): array {
        $id = (int)($r['id'] ?? 0);
        $img = catn8_mystery_weapon_image_load($id);
        return [
            'id' => $id,
            'slug' => (string)($r['slug'] ?? ''),
            'name' => (string)($r['name'] ?? ''),
            'description' => (string)($r['description'] ?? ''),
            'is_archived' => (int)($r['is_archived'] ?? 0) ? 1 : 0,
            'is_locked' => isset($lockedIds[$id]) ? 1 : 0,
            'image' => $img,
            'created_at' => (string)($r['created_at'] ?? ''),
            'updated_at' => (string)($r['updated_at'] ?? ''),
        ];
    }, $rows);

    catn8_json_response(['success' => true, 'weapons' => $weapons]);
}
