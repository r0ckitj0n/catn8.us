<?php
if ($action === 'import_master_motives_to_global') {
    catn8_mystery_require_admin($isAdmin);
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $mysteryId = (int)($body['mystery_id'] ?? 0);
    if ($mysteryId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'mystery_id is required'], 400);
    }

    $masterRows = Database::queryAll(
        'SELECT id, slug, name, description, is_archived FROM mystery_master_motives WHERE mystery_id = ? ORDER BY updated_at DESC, id DESC',
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

        $dup = Database::queryOne('SELECT id FROM mystery_motives WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1', [$name]);
        if ($dup) {
            $skipped++;
            continue;
        }

        $description = (string)($mr['description'] ?? '');
        $isArchived = (int)($mr['is_archived'] ?? 0) ? 1 : 0;
        $slugInput = trim((string)($mr['slug'] ?? ''));
        $slugSeed = ($slugInput !== '') ? $slugInput : $name;
        $slug = catn8_mystery_unique_slug($slugSeed, static function (string $candidate): bool {
            return Database::queryOne('SELECT id FROM mystery_motives WHERE slug = ? LIMIT 1', [$candidate]) !== null;
        });

        Database::execute(
            'INSERT INTO mystery_motives (slug, name, description, is_archived) VALUES (?, ?, ?, ?)',
            [$slug, $name, $description, $isArchived]
        );
        $imported++;
    }

    catn8_json_response(['success' => true, 'imported' => $imported, 'skipped' => $skipped]);
}
