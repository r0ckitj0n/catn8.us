<?php
declare(strict_types=1);

if ($action === 'save_location') {
    catn8_mystery_require_admin($isAdmin);
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $slugInput = trim((string)($body['slug'] ?? ''));
    $name = trim((string)($body['name'] ?? ''));
    if ($name === '') catn8_json_response(['success' => false, 'error' => 'name is required'], 400);

    $description = (string)($body['description'] ?? '');
    $locationId = trim((string)($body['location_id'] ?? ''));
    $addressLine1 = trim((string)($body['address_line1'] ?? ''));
    $addressLine2 = trim((string)($body['address_line2'] ?? ''));
    $city = trim((string)($body['city'] ?? ''));
    $region = trim((string)($body['region'] ?? ''));
    $postalCode = trim((string)($body['postal_code'] ?? ''));
    $country = trim((string)($body['country'] ?? ''));
    $isArchived = (int)($body['is_archived'] ?? 0) ? 1 : 0;

    $lockedIds = array_flip(array_map('intval', catn8_mystery_collect_locked_location_ids()));

    if ($id > 0) {
        if (isset($lockedIds[$id])) catn8_json_response(['success' => false, 'error' => 'Location is locked'], 409);
        $dupId = catn8_mystery_location_find_duplicate_id($name, $region, $city, $id);
        if ($dupId > 0) catn8_json_response(['success' => false, 'error' => 'Duplicate exists', 'duplicate_id' => $dupId], 409);

        $row = Database::queryOne('SELECT slug FROM mystery_locations WHERE id = ? LIMIT 1', [$id]);
        if (!$row) catn8_json_response(['success' => false, 'error' => 'Not found'], 404);
        $slug = $slugInput !== '' ? catn8_mystery_unique_slug($slugInput, fn($c) => Database::queryOne('SELECT id FROM mystery_locations WHERE slug = ? AND id <> ? LIMIT 1', [$c, $id]) !== null) : (string)$row['slug'];

        Database::execute('UPDATE mystery_locations SET slug = ?, name = ?, description = ?, location_id = ?, address_line1 = ?, address_line2 = ?, city = ?, region = ?, postal_code = ?, country = ?, is_archived = ? WHERE id = ? LIMIT 1', [$slug, $name, $description, $locationId, $addressLine1, $addressLine2, $city, $region, $postalCode, $country, $isArchived, $id]);
        catn8_json_response(['success' => true, 'id' => $id, 'image' => catn8_mystery_location_image_load($id)]);
    }

    $dupId = catn8_mystery_location_find_duplicate_id($name, $region, $city, 0);
    if ($dupId > 0) catn8_json_response(['success' => false, 'error' => 'Duplicate exists', 'duplicate_id' => $dupId], 409);

    $slug = catn8_mystery_unique_slug($slugInput ?: $name, fn($c) => Database::queryOne('SELECT id FROM mystery_locations WHERE slug = ? LIMIT 1', [$c]) !== null);
    Database::execute('INSERT INTO mystery_locations (slug, name, description, location_id, address_line1, address_line2, city, region, postal_code, country, is_archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [$slug, $name, $description, $locationId, $addressLine1, $addressLine2, $city, $region, $postalCode, $country, $isArchived]);
    $newId = (int)Database::lastInsertId();
    catn8_json_response(['success' => true, 'id' => $newId, 'image' => catn8_mystery_location_image_load($newId)]);
}

if ($action === 'delete_location') {
    catn8_mystery_require_admin($isAdmin);
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    $lockedIds = array_flip(array_map('intval', catn8_mystery_collect_locked_location_ids()));
    if (isset($lockedIds[$id])) catn8_json_response(['success' => false, 'error' => 'Location is locked'], 409);
    Database::execute('DELETE FROM mystery_locations WHERE id = ? LIMIT 1', [$id]);
    catn8_json_response(['success' => true]);
}
