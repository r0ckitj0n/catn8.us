<?php
if ($action === 'save_weapon') {
    catn8_mystery_require_admin($isAdmin);
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $slugInput = trim((string)($body['slug'] ?? ''));
    $name = trim((string)($body['name'] ?? ''));
    if ($name === '') {
        catn8_json_response(['success' => false, 'error' => 'name is required'], 400);
    }
    $description = (string)($body['description'] ?? '');
    $isArchived = (int)($body['is_archived'] ?? 0) ? 1 : 0;

    $lockedIds = [];
    foreach (catn8_mystery_collect_locked_weapon_ids() as $wid) {
        $lockedIds[(int)$wid] = true;
    }

    if ($id > 0) {
        if (isset($lockedIds[$id])) {
            catn8_json_response(['success' => false, 'error' => 'Weapon is locked (active crime scene)'], 409);
        }
        $dupId = catn8_mystery_weapon_find_duplicate_id($name, $id);
        if ($dupId > 0) {
            catn8_json_response(['success' => false, 'error' => 'Duplicate weapon exists', 'duplicate_id' => $dupId], 409);
        }

        $row = Database::queryOne('SELECT id, slug FROM mystery_weapons WHERE id = ? LIMIT 1', [$id]);
        if (!$row) {
            catn8_json_response(['success' => false, 'error' => 'Weapon not found'], 404);
        }
        $slug = (string)($row['slug'] ?? '');
        if ($slugInput !== '') {
            $slug = catn8_mystery_unique_slug($slugInput, static function (string $candidate) use ($id): bool {
                return Database::queryOne('SELECT id FROM mystery_weapons WHERE slug = ? AND id <> ? LIMIT 1', [$candidate, $id]) !== null;
            });
        }

        Database::execute(
            'UPDATE mystery_weapons SET slug = ?, name = ?, description = ?, is_archived = ? WHERE id = ? LIMIT 1',
            [$slug, $name, $description, $isArchived, $id]
        );
        $img = catn8_mystery_weapon_image_load($id);
        catn8_json_response(['success' => true, 'id' => $id, 'image' => $img]);
    }

    $dupId = catn8_mystery_weapon_find_duplicate_id($name, 0);
    if ($dupId > 0) {
        catn8_json_response(['success' => false, 'error' => 'Duplicate weapon exists', 'duplicate_id' => $dupId], 409);
    }

    $slug = ($slugInput === '')
        ? catn8_mystery_unique_slug($name, static function (string $candidate): bool {
            return Database::queryOne('SELECT id FROM mystery_weapons WHERE slug = ? LIMIT 1', [$candidate]) !== null;
        })
        : catn8_mystery_unique_slug($slugInput, static function (string $candidate): bool {
            return Database::queryOne('SELECT id FROM mystery_weapons WHERE slug = ? LIMIT 1', [$candidate]) !== null;
        });

    Database::execute(
        'INSERT INTO mystery_weapons (slug, name, description, is_archived) VALUES (?, ?, ?, ?)',
        [$slug, $name, $description, $isArchived]
    );
    $row = Database::queryOne('SELECT id FROM mystery_weapons WHERE slug = ? LIMIT 1', [$slug]);
    $newId = (int)($row['id'] ?? 0);
    $img = catn8_mystery_weapon_image_load($newId);
    catn8_json_response(['success' => true, 'id' => $newId, 'image' => $img]);
}
