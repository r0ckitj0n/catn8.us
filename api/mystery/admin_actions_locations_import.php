<?php
declare(strict_types=1);

if ($action === 'import_master_locations_to_global') {
    catn8_mystery_require_admin($isAdmin);
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $mysteryId = (int)($body['mystery_id'] ?? 0);
    if ($mysteryId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid mystery_id'], 400);
    }

    $rows = Database::queryAll(
        'SELECT id, slug, name, description, location_id, address_line1, address_line2, city, region, postal_code, country, is_archived
         FROM mystery_master_locations
         WHERE mystery_id = ?
         ORDER BY updated_at DESC, id DESC',
        [$mysteryId]
    );

    $created = 0; $skipped = 0; $imageCopied = 0;
    $skippedMissingName = 0; $skippedDuplicate = 0; $skippedInsertFailed = 0;

    foreach ($rows as $r) {
        $name = trim((string)($r['name'] ?? ''));
        $region = trim((string)($r['region'] ?? '')) ?: 'Unknown';
        $city = trim((string)($r['city'] ?? ''));
        if ($name === '') {
            $skipped++; $skippedMissingName++;
            continue;
        }

        $dupId = 0;
        if (strtolower($region) !== 'unknown') {
            $dupId = catn8_mystery_location_find_duplicate_id($name, $region, $city, 0);
        } else {
            $n = strtolower(trim($name));
            $c = strtolower(trim($city));
            if ($c !== '') {
                $rowDup = Database::queryOne('SELECT id FROM mystery_locations WHERE LOWER(TRIM(name)) = ? AND LOWER(TRIM(city)) = ? LIMIT 1', [$n, $c]);
                if ($rowDup) $dupId = (int)$rowDup['id'];
            }
            if ($dupId <= 0) {
                $rowDup2 = Database::queryOne('SELECT id FROM mystery_locations WHERE LOWER(TRIM(name)) = ? LIMIT 1', [$n]);
                if ($rowDup2) $dupId = (int)$rowDup2['id'];
            }
        }

        if ($dupId > 0) {
            $skipped++; $skippedDuplicate++;
            continue;
        }

        $slugBase = trim((string)($r['slug'] ?? '')) ?: $name;
        $slug = catn8_mystery_unique_slug($slugBase, fn($c) => Database::queryOne('SELECT id FROM mystery_locations WHERE slug = ? LIMIT 1', [$c]) !== null);

        Database::execute(
            'INSERT INTO mystery_locations (slug, name, description, location_id, address_line1, address_line2, city, region, postal_code, country, is_archived)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$slug, $name, (string)$r['description'], (string)$r['location_id'], (string)$r['address_line1'], (string)$r['address_line2'], $city, $region, (string)$r['postal_code'], (string)$r['country'], (int)$r['is_archived']]
        );
        $newId = (int)Database::lastInsertId();
        if ($newId <= 0) { $skipped++; $skippedInsertFailed++; continue; }
        $created++;

        $masterId = (int)$r['id'];
        $imgRow = Database::queryOne('SELECT * FROM mystery_master_asset_images WHERE mystery_id = ? AND asset_type = ? AND asset_id = ? LIMIT 1', [$mysteryId, 'location', $masterId]);
        if ($imgRow && !empty($imgRow['url'])) {
            Database::execute(
                'INSERT INTO mystery_location_images (location_id, url, prompt_text, negative_prompt_text, provider, model)
                 VALUES (?, ?, ?, ?, ?, ?)',
                [$newId, $imgRow['url'], (string)$imgRow['prompt_text'], (string)$imgRow['negative_prompt_text'], (string)$imgRow['provider'], (string)$imgRow['model']]
            );
            $imageCopied++;
        }
    }

    catn8_json_response([
        'success' => true, 'mystery_id' => $mysteryId, 'total_master_locations' => count($rows),
        'created' => $created, 'skipped' => $skipped, 'skipped_missing_name' => $skippedMissingName,
        'skipped_duplicate' => $skippedDuplicate, 'skipped_insert_failed' => $skippedInsertFailed,
        'images_copied' => $imageCopied,
    ]);
}
