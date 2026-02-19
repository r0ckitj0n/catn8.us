<?php
/**
 * admin_actions_master_assets_upsert.php - Upserting master characters/locations/weapons/motives
 */
declare(strict_types=1);

if ($action === 'upsert_master_character') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $mysteryId = (int)($body['mystery_id'] ?? 0);
    $requireMystery($mysteryId);

    $id = (int)($body['id'] ?? 0);
    $name = trim((string)($body['name'] ?? ''));
    $slugInput = trim((string)($body['slug'] ?? ''));
    $isArchived = (int)($body['is_archived'] ?? 0) ? 1 : 0;

    if ($name === '') catn8_json_response(['success' => false, 'error' => 'Name is required'], 400);

    $slug = $slugInput ?: catn8_mystery_unique_slug($name, function($c) use ($mysteryId, $id) {
        return Database::queryOne('SELECT id FROM mystery_master_characters WHERE mystery_id = ? AND slug = ? AND id <> ? LIMIT 1', [$mysteryId, $c, $id]) !== null;
    });

    // Extracting fields from body for character
    $voiceProfileId = (int)($body['voice_profile_id'] ?? 0);
    $dob = trim((string)($body['dob'] ?? ''));
    $age = (int)($body['age'] ?? 0);
    $hometown = trim((string)($body['hometown'] ?? ''));
    $address = trim((string)($body['address'] ?? ''));
    $ethnicity = trim((string)($body['ethnicity'] ?? ''));
    $zodiac = trim((string)($body['zodiac'] ?? ''));
    $mbti = trim((string)($body['mbti'] ?? ''));
    $height = trim((string)($body['height'] ?? ''));
    $weight = trim((string)($body['weight'] ?? ''));
    $eyeColor = trim((string)($body['eye_color'] ?? ''));
    $hairColor = trim((string)($body['hair_color'] ?? ''));
    $distMarks = trim((string)($body['distinguishing_marks'] ?? ''));
    $education = trim((string)($body['education'] ?? ''));
    $criminalRecord = trim((string)($body['criminal_record'] ?? ''));
    
    $employmentJson = json_encode($body['employment'] ?? []);
    $aliasesJson = json_encode($body['aliases'] ?? []);
    
    // New individual columns for rapport
    $rapportLikesJson = json_encode($body['rapport_likes'] ?? []);
    $rapportDislikesJson = json_encode($body['rapport_dislikes'] ?? []);
    $rapportQuirksJson = json_encode($body['rapport_quirks'] ?? []);
    $rapportFunFactsJson = json_encode($body['rapport_fun_facts'] ?? []);
    
    // Legacy JSON blobs (preserving for compatibility)
    $rapportJson = json_encode($body['rapport'] ?? []);
    $favoritesJson = json_encode($body['favorites'] ?? []);

    if ($id <= 0) {
        Database::execute(
            'INSERT INTO mystery_master_characters (
                mystery_id, slug, name, voice_profile_id, dob, age, hometown, address, aliases_json, ethnicity, zodiac, mbti, height, weight, eye_color, hair_color, 
                distinguishing_marks, education, employment_json, criminal_record, 
                fav_color, fav_snack, fav_drink, fav_music, fav_hobby, fav_pet,
                rapport_likes_json, rapport_dislikes_json, rapport_quirks_json, rapport_fun_facts_json,
                rapport_json, favorites_json, is_archived
            ) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $mysteryId, $slug, $name, $voiceProfileId ?: null, $dob ?: null, $age, $hometown, $address, $aliasesJson, $ethnicity, $zodiac, $mbti, $height, $weight, $eyeColor, $hairColor, 
                $distMarks, $education, $employmentJson, $criminalRecord, 
                $body['fav_color'] ?? '', $body['fav_snack'] ?? '', $body['fav_drink'] ?? '', $body['fav_music'] ?? '', $body['fav_hobby'] ?? '', $body['fav_pet'] ?? '',
                $rapportLikesJson, $rapportDislikesJson, $rapportQuirksJson, $rapportFunFactsJson,
                $rapportJson, $favoritesJson, $isArchived
            ]
        );
        $id = (int)Database::lastInsertId();
    } else {
        Database::execute(
            'UPDATE mystery_master_characters SET 
                slug = ?, name = ?, voice_profile_id = ?, dob = ?, age = ?, hometown = ?, address = ?, aliases_json = ?, ethnicity = ?, zodiac = ?, mbti = ?, height = ?, weight = ?, eye_color = ?, hair_color = ?, 
                distinguishing_marks = ?, education = ?, employment_json = ?, criminal_record = ?, 
                fav_color = ?, fav_snack = ?, fav_drink = ?, fav_music = ?, fav_hobby = ?, fav_pet = ?,
                rapport_likes_json = ?, rapport_dislikes_json = ?, rapport_quirks_json = ?, rapport_fun_facts_json = ?,
                rapport_json = ?, favorites_json = ?, is_archived = ? 
             WHERE id = ? AND mystery_id = ? LIMIT 1',
            [
                $slug, $name, $voiceProfileId ?: null, $dob ?: null, $age, $hometown, $address, $aliasesJson, $ethnicity, $zodiac, $mbti, $height, $weight, $eyeColor, $hairColor, 
                $distMarks, $education, $employmentJson, $criminalRecord, 
                $body['fav_color'] ?? '', $body['fav_snack'] ?? '', $body['fav_drink'] ?? '', $body['fav_music'] ?? '', $body['fav_hobby'] ?? '', $body['fav_pet'] ?? '',
                $rapportLikesJson, $rapportDislikesJson, $rapportQuirksJson, $rapportFunFactsJson,
                $rapportJson, $favoritesJson, $isArchived, $id, $mysteryId
            ]
        );
    }
    catn8_json_response(['success' => true, 'id' => $id]);
}

if ($action === 'upsert_master_location') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $mysteryId = (int)($body['mystery_id'] ?? 0);
    $requireMystery($mysteryId);

    $id = (int)($body['id'] ?? 0);
    $name = trim((string)($body['name'] ?? ''));
    $slugInput = trim((string)($body['slug'] ?? ''));
    $desc = trim((string)($body['description'] ?? ''));
    $locId = trim((string)($body['location_id'] ?? ''));
    $addr1 = trim((string)($body['address_line1'] ?? ''));
    $addr2 = trim((string)($body['address_line2'] ?? ''));
    $city = trim((string)($body['city'] ?? ''));
    $region = trim((string)($body['region'] ?? ''));
    $postal = trim((string)($body['postal_code'] ?? ''));
    $country = trim((string)($body['country'] ?? ''));
    $basePrompt = trim((string)($body['base_image_prompt'] ?? ''));
    $overlayPrompt = trim((string)($body['overlay_asset_prompt'] ?? ''));
    $overlayTrigger = trim((string)($body['overlay_trigger'] ?? ''));
    $isArchived = (int)($body['is_archived'] ?? 0) ? 1 : 0;

    if ($name === '') catn8_json_response(['success' => false, 'error' => 'Name is required'], 400);

    $slug = $slugInput ?: catn8_mystery_unique_slug($name, function($c) use ($mysteryId, $id) {
        return Database::queryOne('SELECT id FROM mystery_master_locations WHERE mystery_id = ? AND slug = ? AND id <> ? LIMIT 1', [$mysteryId, $c, $id]) !== null;
    });

    if ($id <= 0) {
        Database::execute(
            'INSERT INTO mystery_master_locations (mystery_id, slug, name, description, location_id, address_line1, address_line2, city, region, postal_code, country, base_image_prompt, overlay_asset_prompt, overlay_trigger, is_archived) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$mysteryId, $slug, $name, $desc, $locId, $addr1, $addr2, $city, $region, $postal, $country, $basePrompt, $overlayPrompt, $overlayTrigger, $isArchived]
        );
        $id = (int)Database::lastInsertId();
    } else {
        Database::execute(
            'UPDATE mystery_master_locations SET slug = ?, name = ?, description = ?, location_id = ?, address_line1 = ?, address_line2 = ?, city = ?, region = ?, postal_code = ?, country = ?, base_image_prompt = ?, overlay_asset_prompt = ?, overlay_trigger = ?, is_archived = ? WHERE id = ? AND mystery_id = ? LIMIT 1',
            [$slug, $name, $desc, $locId, $addr1, $addr2, $city, $region, $postal, $country, $basePrompt, $overlayPrompt, $overlayTrigger, $isArchived, $id, $mysteryId]
        );
    }

    // Sync clues/items if provided
    if (isset($body['items']) && is_array($body['items'])) {
        Database::execute('DELETE FROM mystery_master_location_clues WHERE mystery_id = ? AND location_id = ?', [$mysteryId, $id]);
        foreach ($body['items'] as $it) {
            $txt = trim((string)$it);
            if ($txt !== '') {
                Database::execute(
                    'INSERT INTO mystery_master_location_clues (mystery_id, location_id, text) VALUES (?, ?, ?)',
                    [$mysteryId, $id, $txt]
                );
            }
        }
    }

    catn8_json_response(['success' => true, 'id' => $id]);
}

if ($action === 'upsert_master_weapon') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $mysteryId = (int)($body['mystery_id'] ?? 0);
    $requireMystery($mysteryId);

    $id = (int)($body['id'] ?? 0);
    $name = trim((string)($body['name'] ?? ''));
    $slugInput = trim((string)($body['slug'] ?? ''));
    $desc = trim((string)($body['description'] ?? ''));
    $isArchived = (int)($body['is_archived'] ?? 0) ? 1 : 0;

    if ($name === '') catn8_json_response(['success' => false, 'error' => 'Name is required'], 400);

    $slug = $slugInput ?: catn8_mystery_unique_slug($name, function($c) use ($mysteryId, $id) {
        return Database::queryOne('SELECT id FROM mystery_master_weapons WHERE mystery_id = ? AND slug = ? AND id <> ? LIMIT 1', [$mysteryId, $c, $id]) !== null;
    });

    if ($id <= 0) {
        Database::execute(
            'INSERT INTO mystery_master_weapons (mystery_id, slug, name, description, is_archived) VALUES (?, ?, ?, ?, ?)',
            [$mysteryId, $slug, $name, $desc, $isArchived]
        );
        $id = (int)Database::lastInsertId();
    } else {
        Database::execute(
            'UPDATE mystery_master_weapons SET slug = ?, name = ?, description = ?, is_archived = ? WHERE id = ? AND mystery_id = ? LIMIT 1',
            [$slug, $name, $desc, $isArchived, $id, $mysteryId]
        );
    }

    // Sync fingerprints if provided
    if (isset($body['fingerprints']) && is_array($body['fingerprints'])) {
        Database::execute('DELETE FROM mystery_master_weapon_fingerprints WHERE mystery_id = ? AND weapon_id = ?', [$mysteryId, $id]);
        foreach ($body['fingerprints'] as $idx => $fp) {
            $fpText = trim((string)$fp);
            if ($fpText !== '') {
                Database::execute(
                    'INSERT INTO mystery_master_weapon_fingerprints (mystery_id, weapon_id, fingerprint, sort_order) VALUES (?, ?, ?, ?)',
                    [$mysteryId, $id, $fpText, $idx]
                );
            }
        }
    }

    catn8_json_response(['success' => true, 'id' => $id]);
}

if ($action === 'upsert_master_motive') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $mysteryId = (int)($body['mystery_id'] ?? 0);
    $requireMystery($mysteryId);

    $id = (int)($body['id'] ?? 0);
    $name = trim((string)($body['name'] ?? ''));
    $slugInput = trim((string)($body['slug'] ?? ''));
    $desc = trim((string)($body['description'] ?? ''));
    $isArchived = (int)($body['is_archived'] ?? 0) ? 1 : 0;

    if ($name === '') catn8_json_response(['success' => false, 'error' => 'Name is required'], 400);

    $slug = $slugInput ?: catn8_mystery_unique_slug($name, function($c) use ($mysteryId, $id) {
        return Database::queryOne('SELECT id FROM mystery_master_motives WHERE mystery_id = ? AND slug = ? AND id <> ? LIMIT 1', [$mysteryId, $c, $id]) !== null;
    });

    if ($id <= 0) {
        Database::execute(
            'INSERT INTO mystery_master_motives (mystery_id, slug, name, description, is_archived) VALUES (?, ?, ?, ?, ?)',
            [$mysteryId, $slug, $name, $desc, $isArchived]
        );
        $id = (int)Database::lastInsertId();
    } else {
        Database::execute(
            'UPDATE mystery_master_motives SET slug = ?, name = ?, description = ?, is_archived = ? WHERE id = ? AND mystery_id = ? LIMIT 1',
            [$slug, $name, $desc, $isArchived, $id, $mysteryId]
        );
    }
    catn8_json_response(['success' => true, 'id' => $id]);
}
