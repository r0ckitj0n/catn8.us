<?php
declare(strict_types=1);

if ($action === 'list_locations') {
    catn8_require_method('GET');

    $includeArchived = (string)($_GET['include_archived'] ?? '') === '1';
    $caseId = (int)($_GET['case_id'] ?? 0);
    $lockedIds = [];
    foreach (catn8_mystery_collect_locked_location_ids() as $lid) {
        $lockedIds[(int)$lid] = true;
    }

    $where = $includeArchived ? '1=1' : 'is_archived = 0';
    $params = [];

    // NOTE: Non-admins can see ALL active assets to choose from for their case.
    // The previous logic restricted them to ONLY what was already assigned to the case, 
    // which caused an empty list if nothing was assigned yet.
    
    $rows = Database::queryAll(
        "SELECT id, slug, name, description, location_id, address_line1, address_line2, city, region, postal_code, country, is_archived, created_at, updated_at " .
        "FROM mystery_locations " .
        "WHERE $where " .
        "ORDER BY updated_at DESC, id DESC",
        $params
    );

    catn8_json_response(['success' => true, 'locations' => array_map(static function (array $r) use ($lockedIds): array {
        $id = (int)$r['id'];
        return [
            'id' => $id,
            'slug' => (string)$r['slug'],
            'name' => (string)$r['name'],
            'description' => (string)$r['description'],
            'location_id' => (string)$r['location_id'],
            'address_line1' => (string)$r['address_line1'],
            'address_line2' => (string)$r['address_line2'],
            'city' => (string)$r['city'],
            'region' => (string)$r['region'],
            'postal_code' => (string)$r['postal_code'],
            'country' => (string)$r['country'],
            'is_archived' => (int)$r['is_archived'] ? 1 : 0,
            'is_locked' => isset($lockedIds[$id]) ? 1 : 0,
            'image' => catn8_mystery_location_image_load($id),
            'created_at' => (string)$r['created_at'],
            'updated_at' => (string)$r['updated_at'],
        ];
    }, $rows)]);
}
