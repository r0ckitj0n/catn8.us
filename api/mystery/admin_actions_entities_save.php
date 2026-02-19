<?php
if ($action === 'create_entity') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $caseId = (int)($body['case_id'] ?? 0);
    $requireCase($caseId);

    $entityType = trim((string)($body['entity_type'] ?? ''));
    $slug = trim((string)($body['slug'] ?? ''));
    $name = trim((string)($body['name'] ?? ''));
    $data = $body['data'] ?? [];
    $rolesInput = $body['roles'] ?? [];
    $accentPreference = trim((string)($body['accent_preference'] ?? ''));

    if ($entityType === '' || $name === '') {
        catn8_json_response(['success' => false, 'error' => 'entity_type and name are required'], 400);
    }
    if (!is_array($data)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid data'], 400);
    }

    if (!is_array($rolesInput)) {
        catn8_json_response(['success' => false, 'error' => 'roles must be an array'], 400);
    }
    $roles = array_values(array_unique(array_filter(array_map(static fn($v) => trim((string)$v), $rolesInput), static fn($v) => $v !== '')));
    $rolesJson = json_encode($roles);
    if (!is_string($rolesJson)) {
        $rolesJson = json_encode([]);
    }

    $slug = ($slug === '')
        ? catn8_mystery_unique_slug($name, static function (string $candidate) use ($caseId, $entityType): bool {
            return Database::queryOne(
                'SELECT id FROM mystery_entities WHERE game_id = ? AND entity_type = ? AND slug = ? LIMIT 1',
                [$caseId, $entityType, $candidate]
            ) !== null;
        })
        : catn8_mystery_unique_slug($slug, static function (string $candidate) use ($caseId, $entityType): bool {
            return Database::queryOne(
                'SELECT id FROM mystery_entities WHERE game_id = ? AND entity_type = ? AND slug = ? LIMIT 1',
                [$caseId, $entityType, $candidate]
            ) !== null;
        });

    Database::execute(
        'INSERT INTO mystery_entities (game_id, entity_type, slug, name, data_json, roles_json, is_archived, accent_preference) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
        [$caseId, $entityType, $slug, $name, json_encode($data), $rolesJson, $accentPreference]
    );
    $row = Database::queryOne('SELECT id FROM mystery_entities WHERE game_id = ? AND entity_type = ? AND slug = ?', [$caseId, $entityType, $slug]);
    catn8_json_response(['success' => true, 'id' => (int)($row['id'] ?? 0)]);
}

if ($action === 'update_entity') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $existing = $requireEntity($id);

    $slugInput = trim((string)($body['slug'] ?? ''));
    $slug = trim((string)($existing['slug'] ?? ''));
    $name = trim((string)($body['name'] ?? $existing['name'] ?? ''));
    $isArchived = (int)($body['is_archived'] ?? $existing['is_archived'] ?? 0) ? 1 : 0;
    $accentPreference = trim((string)($body['accent_preference'] ?? $existing['accent_preference'] ?? ''));

    if ($name === '') {
        catn8_json_response(['success' => false, 'error' => 'name is required'], 400);
    }

    if ($slugInput !== '') {
        $caseId = (int)($existing['game_id'] ?? 0);
        $entityType = (string)($existing['entity_type'] ?? '');
        $slug = catn8_mystery_unique_slug($slugInput, static function (string $candidate) use ($caseId, $entityType, $id): bool {
            return Database::queryOne(
                'SELECT id FROM mystery_entities WHERE game_id = ? AND entity_type = ? AND slug = ? AND id <> ? LIMIT 1',
                [$caseId, $entityType, $candidate, $id]
            ) !== null;
        });
    }

    $data = $body['data'] ?? null;
    if ($data !== null && !is_array($data)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid data'], 400);
    }

    $rolesInput = $body['roles'] ?? null;
    if ($rolesInput !== null && !is_array($rolesInput)) {
        catn8_json_response(['success' => false, 'error' => 'roles must be an array'], 400);
    }

    $dataJson = ($data !== null) ? json_encode($data) : (string)($existing['data_json'] ?? '{}');
    $rolesJson = ($rolesInput !== null)
        ? (function (array $rolesInput): string {
            $roles = array_values(array_unique(array_filter(array_map(static fn($v) => trim((string)$v), $rolesInput), static fn($v) => $v !== '')));
            $j = json_encode($roles);
            if (!is_string($j)) $j = json_encode([]);
            return (string)$j;
        })($rolesInput)
        : (string)($existing['roles_json'] ?? '[]');

    Database::execute('UPDATE mystery_entities SET slug = ?, name = ?, data_json = ?, roles_json = ?, is_archived = ?, accent_preference = ? WHERE id = ?', [$slug, $name, $dataJson, $rolesJson, $isArchived, $accentPreference, $id]);
    catn8_json_response(['success' => true]);
}

if ($action === 'bulk_update_entity_accent_preference') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $caseId = (int)($body['case_id'] ?? 0);
    $requireCase($caseId);

    $entityIdsRaw = $body['entity_ids'] ?? [];
    if (!is_array($entityIdsRaw)) {
        catn8_json_response(['success' => false, 'error' => 'entity_ids must be an array'], 400);
    }
    $accentPreference = trim((string)($body['accent_preference'] ?? ''));

    $count = 0;
    foreach ($entityIdsRaw as $eidRaw) {
        $eid = (int)$eidRaw;
        if ($eid <= 0) continue;
        Database::execute(
            "UPDATE mystery_entities SET accent_preference = ? WHERE id = ? AND game_id = ? AND entity_type = 'character'",
            [$accentPreference, $eid, $caseId]
        );
        $count += 1;
    }

    catn8_json_response(['success' => true, 'updated' => $count]);
}

if ($action === 'delete_entity') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $requireEntity($id);
    Database::execute('DELETE FROM mystery_entities WHERE id = ?', [$id]);
    catn8_json_response(['success' => true]);
}
