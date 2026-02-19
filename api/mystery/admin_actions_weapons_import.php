<?php
if ($action === 'import_master_weapons_to_global') {
    catn8_mystery_require_admin($isAdmin);
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $mysteryId = (int)($body['mystery_id'] ?? 0);
    if ($mysteryId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'mystery_id is required'], 400);
    }

    $masterRows = Database::queryAll(
        'SELECT id, slug, name, description, is_archived FROM mystery_master_weapons WHERE mystery_id = ? ORDER BY updated_at DESC, id DESC',
        [$mysteryId]
    );

    $imported = 0;
    $skipped = 0;
    foreach ($masterRows as $mr) {
        $name = trim((string)($mr['name'] ?? ''));
        if ($name === '') {
            $skipped++;
            continue;
        }

        $dup = Database::queryOne('SELECT id FROM mystery_weapons WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1', [$name]);
        if ($dup) {
            $skipped++;
            continue;
        }

        $description = (string)($mr['description'] ?? '');
        $isArchived = (int)($mr['is_archived'] ?? 0) ? 1 : 0;
        $slugInput = trim((string)($mr['slug'] ?? ''));
        $slugSeed = ($slugInput !== '') ? $slugInput : $name;
        $slug = catn8_mystery_unique_slug($slugSeed, static function (string $candidate): bool {
            return Database::queryOne('SELECT id FROM mystery_weapons WHERE slug = ? LIMIT 1', [$candidate]) !== null;
        });

        Database::execute(
            'INSERT INTO mystery_weapons (slug, name, description, is_archived) VALUES (?, ?, ?, ?)',
            [$slug, $name, $description, $isArchived]
        );
        $row = Database::queryOne('SELECT id FROM mystery_weapons WHERE slug = ? LIMIT 1', [$slug]);
        $newId = (int)($row['id'] ?? 0);
        if ($newId > 0) {
            $masterId = (int)($mr['id'] ?? 0);
            $img = Database::queryOne(
                'SELECT title, url, alt_text, prompt_text, negative_prompt_text, provider, model FROM mystery_master_asset_images WHERE mystery_id = ? AND asset_type = ? AND asset_id = ? LIMIT 1',
                [$mysteryId, 'weapon', $masterId]
            );
            if ($img) {
                Database::execute(
                    'INSERT INTO mystery_weapon_images (weapon_id, title, url, alt_text, prompt_text, negative_prompt_text, provider, model) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title), url = VALUES(url), alt_text = VALUES(alt_text), prompt_text = VALUES(prompt_text), negative_prompt_text = VALUES(negative_prompt_text), provider = VALUES(provider), model = VALUES(model)',
                    [
                        $newId,
                        (string)($img['title'] ?? ''),
                        (string)($img['url'] ?? ''),
                        (string)($img['alt_text'] ?? ''),
                        (string)($img['prompt_text'] ?? ''),
                        (string)($img['negative_prompt_text'] ?? ''),
                        (string)($img['provider'] ?? ''),
                        (string)($img['model'] ?? ''),
                    ]
                );
            }
            $imported++;
        }
    }

    catn8_json_response(['success' => true, 'imported' => $imported, 'skipped' => $skipped]);
}
