<?php
/**
 * admin_actions_master_assets_maintenance.php - Mystery-wide asset maintenance
 */
declare(strict_types=1);

if ($action === 'cleanup_master_only_fields_for_mystery') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $mysteryId = (int)($body['mystery_id'] ?? 0);
    $requireMystery($mysteryId);
    
    // Logic to scan all cases for this mystery and remove master-only fields from their character JSON
    $cases = Database::queryAll('SELECT id FROM mystery_games WHERE mystery_id = ?', [$mysteryId]);
    $scanned = 0;
    $updated = 0;
    
    $masterOnlyFields = ['dob', 'age', 'hometown', 'address', 'ethnicity', 'zodiac', 'mbti', 'height', 'weight', 'eye_color', 'hair_color', 'distinguishing_marks', 'education', 'employment', 'aliases', 'criminal_record'];

    foreach ($cases as $case) {
        $entities = Database::queryAll("SELECT id, data_json FROM mystery_entities WHERE game_id = ? AND entity_type = 'character'", [$case['id']]);
        foreach ($entities as $entity) {
            $scanned++;
            $data = json_decode((string)$entity['data_json'], true) ?: [];
            $changed = false;
            
            // Also check static_profile structure
            if (isset($data['static_profile'])) {
                foreach (['demographics', 'appearance', 'background'] as $sub) {
                    if (isset($data['static_profile'][$sub])) {
                        foreach ($data['static_profile'][$sub] as $key => $val) {
                            // If it matches a master field, we could remove it, but let's be conservative
                        }
                    }
                }
            }

            // Remove direct top-level fields that should be master-only
            foreach ($masterOnlyFields as $f) {
                if (isset($data[$f])) {
                    unset($data[$f]);
                    $changed = true;
                }
            }

            if ($changed) {
                Database::execute('UPDATE mystery_entities SET data_json = ? WHERE id = ?', [json_encode($data), $entity['id']]);
                $updated++;
            }
        }
    }
    
    catn8_json_response(['success' => true, 'report' => ['entities_scanned' => $scanned, 'entities_updated' => $updated]]);
}

if ($action === 'link_and_import_case_character_details_for_mystery') {
    require_once __DIR__ . '/admin_actions_cleanup_mystery_link_import.php';
    exit;
}

if ($action === 'backfill_master_asset_columns_from_json') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $mysteryId = (int)($body['mystery_id'] ?? 0);
    $requireMystery($mysteryId);
    
    $report = ['characters_updated' => 0, 'locations_updated' => 0, 'weapons_updated' => 0];
    
    // Backfill characters from data_json if it exists (some legacy might have it)
    // Or from associated entities if linked
    $masters = Database::queryAll('SELECT id, name, slug FROM mystery_master_characters WHERE mystery_id = ?', [$mysteryId]);
    foreach ($masters as $m) {
        // Try to find a case entity to pull data from
        $entity = Database::queryOne("SELECT data_json FROM mystery_entities WHERE entity_type = 'character' AND (slug = ? OR name = ?) ORDER BY id DESC LIMIT 1", [$m['slug'], $m['name']]);
        if ($entity) {
            $data = json_decode((string)$entity['data_json'], true) ?: [];
            $sp = $data['static_profile'] ?? [];
            
            $updates = [];
            $params = [];
            
            // Priority 1: Data already in the master character (from legacy blobs or existing fields)
            $master = Database::queryOne('SELECT * FROM mystery_master_characters WHERE id = ?', [$m['id']]);
            $legacyRapport = json_decode((string)($master['rapport_json'] ?? ''), true) ?: [];
            $legacyFavorites = json_decode((string)($master['favorites_json'] ?? ''), true) ?: [];
            
            $map = [
                'dob' => $master['dob'] ?: $sp['demographics']['birthday'] ?? $data['dob'] ?? '',
                'age' => $master['age'] ?: $sp['demographics']['age'] ?? $data['age'] ?? 0,
                'hometown' => $master['hometown'] ?: $sp['demographics']['hometown'] ?? $data['hometown'] ?? '',
                'ethnicity' => $master['ethnicity'] ?: $sp['demographics']['ethnicity'] ?? $data['ethnicity'] ?? '',
                'zodiac' => $master['zodiac'] ?: $sp['demographics']['zodiac'] ?? $data['zodiac'] ?? '',
                'mbti' => $master['mbti'] ?: $sp['psychology']['mbti'] ?? $data['mbti'] ?? '',
                'height' => $master['height'] ?: $sp['appearance']['height'] ?? $data['height'] ?? '',
                'weight' => $master['weight'] ?: $sp['appearance']['weight'] ?? $data['weight'] ?? '',
                'eye_color' => $master['eye_color'] ?: $sp['appearance']['eye_color'] ?? $data['eye_color'] ?? '',
                'hair_color' => $master['hair_color'] ?: $sp['appearance']['hair_color'] ?? $data['hair_color'] ?? '',
                'distinguishing_marks' => $master['distinguishing_marks'] ?: $sp['appearance']['distinguishing_marks'] ?? $data['distinguishing_marks'] ?? '',
                'education' => $master['education'] ?: $sp['background']['education'] ?? $data['education'] ?? '',
                'criminal_record' => $master['criminal_record'] ?: $sp['background']['criminal_record'] ?? $data['criminal_record'] ?? '',
                'fav_color' => $master['fav_color'] ?: $legacyFavorites['color'] ?? $sp['favorites']['color'] ?? $data['fav_color'] ?? '',
                'fav_snack' => $master['fav_snack'] ?: $legacyFavorites['snack'] ?? $legacyFavorites['food'] ?? $sp['favorites']['snack'] ?? $sp['favorites']['food'] ?? $data['fav_snack'] ?? '',
                'fav_drink' => $master['fav_drink'] ?: $legacyFavorites['drink'] ?? $sp['favorites']['drink'] ?? $data['fav_drink'] ?? '',
                'fav_music' => $master['fav_music'] ?: $legacyFavorites['music'] ?? $sp['favorites']['music'] ?? $data['fav_music'] ?? '',
                'fav_hobby' => $master['fav_hobby'] ?: $legacyFavorites['hobby'] ?? $sp['favorites']['hobby'] ?? $data['fav_hobby'] ?? '',
                'fav_pet' => $master['fav_pet'] ?: $legacyFavorites['pet'] ?? $sp['favorites']['pet'] ?? $data['fav_pet'] ?? '',
            ];

            // Handle rapport traits which are lists
            $rapportMap = [
                'rapport_likes_json' => $master['rapport_likes_json'] ? json_decode($master['rapport_likes_json'], true) : ($legacyRapport['likes'] ?? $data['likes'] ?? []),
                'rapport_dislikes_json' => $master['rapport_dislikes_json'] ? json_decode($master['rapport_dislikes_json'], true) : ($legacyRapport['dislikes'] ?? $data['dislikes'] ?? []),
                'rapport_quirks_json' => $master['rapport_quirks_json'] ? json_decode($master['rapport_quirks_json'], true) : ($legacyRapport['quirks'] ?? $data['quirks'] ?? []),
                'rapport_fun_facts_json' => $master['rapport_fun_facts_json'] ? json_decode($master['rapport_fun_facts_json'], true) : ($legacyRapport['fun_facts'] ?? $data['fun_facts'] ?? []),
            ];
            
            foreach ($map as $col => $val) {
                if ($val) {
                    $updates[] = "$col = ?";
                    $params[] = $val;
                }
            }

            foreach ($rapportMap as $col => $val) {
                if (!empty($val)) {
                    $updates[] = "$col = ?";
                    $params[] = json_encode($val);
                }
            }
            
            if ($updates) {
                $params[] = $m['id'];
                Database::execute("UPDATE mystery_master_characters SET " . implode(', ', $updates) . " WHERE id = ?", $params);
                $report['characters_updated']++;
            }
        }
    }
    
    catn8_json_response(['success' => true, 'report' => $report]);
}

if ($action === 'archive_master_character' || $action === 'archive_master_location' || $action === 'archive_master_weapon' || $action === 'archive_master_motive') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $mysteryId = (int)($body['mystery_id'] ?? 0);
    $requireMystery($mysteryId);
    $id = (int)($body['id'] ?? 0);
    $isArchived = (int)($body['is_archived'] ?? 0) ? 1 : 0;
    
    $tableMap = [
        'archive_master_character' => 'mystery_master_characters',
        'archive_master_location'  => 'mystery_master_locations',
        'archive_master_weapon'    => 'mystery_master_weapons',
        'archive_master_motive'    => 'mystery_master_motives'
    ];
    $table = $tableMap[$action] ?? '';
    if ($table) {
        Database::execute("UPDATE $table SET is_archived = ? WHERE id = ? AND mystery_id = ? LIMIT 1", [$isArchived, $id, $mysteryId]);
    }
    catn8_json_response(['success' => true]);
}
