<?php
declare(strict_types=1);

function catn8_mystery_master_asset_table_for_entity_type(string $entityType): string {
    $t = strtolower(trim($entityType));
    if ($t === 'character') return 'mystery_master_characters';
    if ($t === 'location') return 'mystery_master_locations';
    return '';
}

function catn8_mystery_resolve_master_asset_id(int $mysteryId, string $entityType, string $masterSlug): int {
    $mid = (int)$mysteryId;
    if ($mid <= 0) return 0;
    $slug = trim($masterSlug);
    if ($slug === '') return 0;
    $table = catn8_mystery_master_asset_table_for_entity_type($entityType);
    if ($table === '') return 0;
    $row = Database::queryOne('SELECT id FROM ' . $table . ' WHERE mystery_id = ? AND slug = ? LIMIT 1', [$mid, $slug]);
    return (int)($row['id'] ?? 0);
}

function catn8_mystery_master_character_fix_agent_id_from_instructions(int $mysteryId, int $masterCharacterId, string $name, int $agentId): int {
    $mid = (int)$mysteryId; $cid = (int)$masterCharacterId;
    if ($mid <= 0 || $cid <= 0) return (int)$agentId;
    $aid = (int)$agentId; if ($aid > 0) return $aid;
    $n = trim($name); if ($n === '') return 0;
    $path = dirname(__DIR__, 2) . '/Mystery/Instructions/agents_profiles.json';
    if (!is_file($path)) return 0;
    $decoded = json_decode((string)file_get_contents($path), true);
    if (!is_array($decoded)) return 0;
    $found = 0; $imagePath = '';
    foreach ($decoded as $row) {
        if (!is_array($row)) continue;
        if (trim((string)($row['name'] ?? '')) === $n) {
            $found = (int)($row['id'] ?? 0);
            $imagePath = trim((string)($row['image_path'] ?? ''));
            break;
        }
    }
    if ($found <= 0) return 0;
    $img = $imagePath;
    if ($img === '' && $found >= 1 && $found <= 99) $img = 'agent' . $found . '.png';
    Database::execute('UPDATE mystery_master_characters SET agent_id = ?, image_path = CASE WHEN image_path = \'\' OR image_path IS NULL THEN ? ELSE image_path END WHERE id = ? AND mystery_id = ? LIMIT 1', [$found, $img, $cid, $mid]);
    return $found;
}

function catn8_mystery_master_character_image_facts_block(array $row): string {
    $parts = [];
    $fields = ['name' => 'Name', 'dob' => 'DOB', 'age' => 'Age', 'hometown' => 'Hometown', 'ethnicity' => 'Ethnicity', 'mbti' => 'MBTI', 'height' => 'Height', 'weight' => 'Weight', 'eye_color' => 'Eye color', 'hair_color' => 'Hair color'];
    foreach ($fields as $k => $label) {
        $v = trim((string)($row[$k] ?? ''));
        if ($v !== '' && $v !== '0') $parts[] = "$label: $v";
    }
    if (!count($parts)) return '';
    return 'Identity/appearance constraints (do not render as visible text): ' . implode('; ', $parts) . '. No readable text, captions, logos, or watermarks.';
}

function catn8_mystery_master_character_missing_required_image_fields(array $row): array {
    $missing = [];
    $reqs = ['dob' => 'DOB', 'age' => 'Age', 'hometown' => 'Hometown', 'ethnicity' => 'Ethnicity', 'mbti' => 'MBTI', 'height' => 'Height', 'weight' => 'Weight', 'eye_color' => 'Eye color', 'hair_color' => 'Hair color'];
    foreach ($reqs as $k => $label) {
        if ($k === 'age') { if ((int)($row[$k] ?? 0) <= 0) $missing[] = $label; }
        elseif (trim((string)($row[$k] ?? '')) === '') $missing[] = $label;
    }
    return $missing;
}

function catn8_mystery_master_asset_image_file_url(string $assetType, int $assetId): string {
    $t = strtolower(trim($assetType)); $id = (int)$assetId;
    if ($id <= 0) return '';
    $table = $t === 'character' ? 'mystery_master_character_images' : ($t === 'location' ? 'mystery_master_location_images' : ($t === 'weapon' ? 'mystery_master_weapon_images' : ($t === 'motive' ? 'mystery_master_motive_images' : '')));
    if ($table === '') return '';
    $col = $t . '_id';
    $row = Database::queryOne("SELECT url FROM $table WHERE $col = ? LIMIT 1", [$id]);
    return (string)($row['url'] ?? '');
}

function catn8_mystery_master_asset_items_load(int $mysteryId, string $assetType, int $assetId): array {
    $mid = (int)$mysteryId; $t = strtolower(trim($assetType)); $id = (int)$assetId;
    if ($mid <= 0 || $id <= 0) return [];
    // Auth storage: prefer mystery_master_asset_items
    $rows = Database::queryAll("SELECT * FROM mystery_master_asset_items WHERE mystery_id = ? AND asset_type = ? AND asset_id = ? ORDER BY sort_order ASC, id ASC", [$mid, $t, $id]);
    if (!empty($rows)) return $rows;

    // Fallback to weapon fingerprints if applicable
    if ($t === 'weapon') {
        return Database::queryAll("SELECT * FROM mystery_master_weapon_fingerprints WHERE mystery_id = ? AND weapon_id = ? ORDER BY sort_order ASC", [$mid, $id]);
    }
    return [];
}

function catn8_mystery_master_asset_image_load(int $mysteryId, string $assetType, int $assetId): ?array {
    $mid = (int)$mysteryId; $t = strtolower(trim($assetType)); $id = (int)$assetId;
    if ($mid <= 0 || $id <= 0) return null;
    $table = 'mystery_master_asset_images';
    return Database::queryOne("SELECT * FROM $table WHERE mystery_id = ? AND asset_type = ? AND asset_id = ? LIMIT 1", [$mid, $t, $id]);
}

function catn8_mystery_master_weapon_fingerprints_load(int $mysteryId, int $weaponId): array {
    return catn8_mystery_master_asset_items_load($mysteryId, 'weapon', $weaponId);
}

function catn8_mystery_master_location_build_derived_json(int $mysteryId, int $id, bool $includeLocks): array {
    $mid = (int)$mysteryId; $id = (int)$id;
    $row = Database::queryOne('SELECT * FROM mystery_master_locations WHERE mystery_id = ? AND id = ? LIMIT 1', [$mid, $id]);
    if (!$row) return [];
    $img = catn8_mystery_master_asset_image_load($mid, 'location', $id);
    
    // Load clues/items from mystery_master_asset_items
    $items = catn8_mystery_master_asset_items_load($mid, 'location', $id);
    $itemsList = array_column($items, 'text');

    $res = [
        'id' => $id, 
        'slug' => $row['slug'], 
        'name' => $row['name'], 
        'description' => $row['description'], 
        'location_id' => $row['location_id'], 
        'address_line1' => $row['address_line1'], 
        'address_line2' => $row['address_line2'], 
        'city' => $row['city'], 
        'region' => $row['region'], 
        'postal_code' => $row['postal_code'], 
        'country' => $row['country'], 
        'base_image_prompt' => $row['base_image_prompt'] ?? '',
        'overlay_asset_prompt' => $row['overlay_asset_prompt'] ?? '',
        'overlay_trigger' => $row['overlay_trigger'] ?? '',
        'is_archived' => (int)$row['is_archived'], 
        'is_regen_locked' => (int)($row['is_regen_locked'] ?? 0),
        'image' => $img,
        'items' => $itemsList
    ];
    if ($includeLocks) $res['locks'] = catn8_mystery_master_asset_field_locks_load($mid, 'location', $id);
    return $res;
}

function catn8_mystery_master_weapon_build_derived_json(int $mysteryId, int $id, bool $includeLocks): array {
    $mid = (int)$mysteryId; $id = (int)$id;
    $row = Database::queryOne('SELECT * FROM mystery_master_weapons WHERE mystery_id = ? AND id = ? LIMIT 1', [$mid, $id]);
    if (!$row) return [];
    $img = catn8_mystery_master_asset_image_load($mid, 'weapon', $id);
    
    // Load fingerprints
    $fps = Database::queryAll('SELECT fingerprint FROM mystery_master_weapon_fingerprints WHERE mystery_id = ? AND weapon_id = ? ORDER BY sort_order ASC', [$mid, $id]);
    $fingerprints = array_column($fps, 'fingerprint');

    $res = [
        'id' => $id,
        'slug' => $row['slug'],
        'name' => $row['name'],
        'description' => $row['description'],
        'is_archived' => (int)$row['is_archived'],
        'image' => $img,
        'fingerprints' => $fingerprints
    ];
    if ($includeLocks) $res['locks'] = catn8_mystery_master_asset_field_locks_load($mid, 'weapon', $id);
    return $res;
}

function catn8_mystery_master_motive_build_derived_json(int $mysteryId, int $id, bool $includeLocks): array {
    $mid = (int)$mysteryId; $id = (int)$id;
    $row = Database::queryOne('SELECT * FROM mystery_master_motives WHERE mystery_id = ? AND id = ? LIMIT 1', [$mid, $id]);
    if (!$row) return [];
    $img = catn8_mystery_master_asset_image_load($mid, 'motive', $id);
    $res = ['id' => $id, 'slug' => $row['slug'], 'name' => $row['name'], 'description' => $row['description'], 'is_archived' => (int)$row['is_archived'], 'image' => $img];
    if ($includeLocks) $res['locks'] = catn8_mystery_master_asset_field_locks_load($mid, 'motive', $id);
    return $res;
}

function catn8_mystery_master_character_rapport_load(int $mysteryId, int $masterCharacterId): array {
    return Database::queryAll('SELECT * FROM mystery_master_character_rapport_items WHERE mystery_id = ? AND master_character_id = ? ORDER BY kind ASC, sort_order ASC', [(int)$mysteryId, (int)$masterCharacterId]);
}

function catn8_mystery_master_character_field_locks_load(int $mysteryId, int $masterCharacterId): array {
    return catn8_mystery_master_asset_field_locks_load($mysteryId, 'character', $masterCharacterId);
}

function catn8_mystery_master_asset_field_locks_load(int $mysteryId, string $assetType, int $assetId): array {
    $rows = Database::queryAll('SELECT field_name FROM mystery_master_asset_field_locks WHERE mystery_id = ? AND asset_type = ? AND asset_id = ?', [(int)$mysteryId, strtolower(trim($assetType)), (int)$assetId]);
    return array_column($rows, 'field_name');
}

function catn8_mystery_master_character_build_derived_json(int $mysteryId, int $masterCharacterId, bool $includeLocks): array {
    $mid = (int)$mysteryId; $cid = (int)$masterCharacterId;
    $row = Database::queryOne('SELECT * FROM mystery_master_characters WHERE mystery_id = ? AND id = ? LIMIT 1', [$mid, $cid]);
    if (!$row) return [];
    $img = catn8_mystery_master_asset_image_load($mid, 'character', $cid);
    
    // Build rapport object
    $rapportItems = catn8_mystery_master_character_rapport_load($mid, $cid);
    $rapport = [
        'likes' => [],
        'dislikes' => [],
        'quirks' => [],
        'fun_facts' => []
    ];
    foreach ($rapportItems as $item) {
        $type = trim($item['kind'] ?? '');
        $val = trim($item['value'] ?? '');
        if ($type === 'like') $rapport['likes'][] = $val;
        elseif ($type === 'dislike') $rapport['dislikes'][] = $val;
        elseif ($type === 'quirk') $rapport['quirks'][] = $val;
        elseif ($type === 'fun_fact') $rapport['fun_facts'][] = $val;
    }

    $res = [
        'id' => $cid,
        'slug' => $row['slug'],
        'name' => $row['name'],
        'agent_id' => (int)$row['agent_id'],
        'dob' => $row['dob'],
        'age' => (int)$row['age'],
        'hometown' => $row['hometown'],
        'ethnicity' => $row['ethnicity'],
        'zodiac' => $row['zodiac'],
        'mbti' => $row['mbti'],
        'height' => $row['height'],
        'weight' => $row['weight'],
        'eye_color' => $row['eye_color'],
        'hair_color' => $row['hair_color'],
        'distinguishing_marks' => $row['distinguishing_marks'],
        'education' => $row['education'],
        'employment' => json_decode($row['employment_json'] ?: '[]', true),
        'aliases' => json_decode($row['aliases_json'] ?: '[]', true),
        'criminal_record' => $row['criminal_record'],
        'address' => $row['address'],
        'voice_id' => $row['voice_id'],
        'voice_profile_id' => (int)$row['voice_profile_id'],
        'is_archived' => (int)$row['is_archived'],
        'is_regen_locked' => (int)$row['is_regen_locked'],
        'image' => $img,
        'rapport' => $rapport,
        'favorites' => [
            'color' => $row['fav_color'],
            'snack' => $row['fav_snack'],
            'drink' => $row['fav_drink'],
            'music' => $row['fav_music'],
            'hobby' => $row['fav_hobby'],
            'pet' => $row['fav_pet']
        ]
    ];
    if ($includeLocks) $res['locks'] = catn8_mystery_master_character_field_locks_load($mid, $cid);
    return $res;
}
