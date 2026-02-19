<?php
if ($action === 'clear_master_asset_fields') {
    catn8_mystery_require_admin($isAdmin);
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $mysteryId = (int)($body['mystery_id'] ?? 0);
    $requireMystery($mysteryId);

    $type = trim((string)($body['type'] ?? ''));
    $id = (int)($body['id'] ?? 0);
    if ($type === '' || $id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'type and id are required'], 400);
    }

    $type = strtolower(trim($type));
    if ($type !== 'character' && $type !== 'location' && $type !== 'weapon' && $type !== 'motive') {
        catn8_json_response(['success' => false, 'error' => 'Invalid type'], 400);
    }

    if ($type === 'weapon' || $type === 'motive') {
        catn8_json_response(['success' => false, 'error' => 'Deprecated: weapons and motives are global now.'], 410);
    }

    if ($type === 'character') {
        $row = Database::queryOne(
            'SELECT id, is_regen_locked FROM mystery_master_characters WHERE id = ? AND mystery_id = ? LIMIT 1',
            [$id, $mysteryId]
        );
        if (!$row) {
            catn8_json_response(['success' => false, 'error' => 'Asset not found'], 404);
        }

        Database::execute('DELETE FROM mystery_master_character_rapport_items WHERE mystery_id = ? AND master_character_id = ?', [$mysteryId, $id]);

        Database::execute(
            "UPDATE mystery_master_characters\n" .
            "SET dob = NULL, age = 0, hometown = '', address = '', aliases_json = '[]', ethnicity = '', zodiac = '', mbti = '', height = '', weight = '', eye_color = '', hair_color = '', distinguishing_marks = '', education = '', employment_json = '[]', criminal_record = '', 
            fav_color = '', fav_snack = '', fav_drink = '', fav_music = '', fav_hobby = '', fav_pet = '', 
            rapport_likes_json = '[]', rapport_dislikes_json = '[]', rapport_quirks_json = '[]', rapport_fun_facts_json = '[]',
            is_regen_locked = 0\n" .
            "WHERE id = ? AND mystery_id = ?",
            [$id, $mysteryId]
        );
    } else {
        $table = '';
        if ($type === 'location') $table = 'mystery_master_locations';
        if ($type === 'weapon') $table = 'mystery_master_weapons';
        if ($type === 'motive') $table = 'mystery_master_motives';

        $row = Database::queryOne('SELECT id FROM ' . $table . ' WHERE id = ? AND mystery_id = ? LIMIT 1', [$id, $mysteryId]);
        if (!$row) {
            catn8_json_response(['success' => false, 'error' => 'Asset not found'], 404);
        }

        Database::execute('DELETE FROM mystery_master_asset_items WHERE mystery_id = ? AND asset_type = ? AND asset_id = ?', [$mysteryId, $type, $id]);
        if ($type === 'weapon') {
            Database::execute('DELETE FROM mystery_master_weapon_fingerprints WHERE mystery_id = ? AND weapon_id = ?', [$mysteryId, $id]);
        }

        $root = dirname(__DIR__, 2);
        $dir = $root . '/images/mystery';
        if (!is_dir($dir)) {
            catn8_json_response(['success' => false, 'error' => 'Image directory missing'], 500);
        }
        $prefix = 'master_' . $type . '_' . (string)$id;
        $candidates = [
            $prefix . '.png',
            $prefix . '.jpg',
            $prefix . '.jpeg',
            $prefix . '.webp',
        ];
        foreach ($candidates as $fn) {
            $p = $dir . '/' . $fn;
            if (!is_file($p)) continue;
            if (@unlink($p) === false) {
                catn8_json_response(['success' => false, 'error' => 'Failed to delete image file'], 500);
            }
        }
        Database::execute(
            "UPDATE mystery_master_asset_images\n" .
            "SET title = '', url = '', alt_text = '', prompt_text = '', negative_prompt_text = '', provider = '', model = ''\n" .
            "WHERE mystery_id = ? AND asset_type = ? AND asset_id = ?",
            [$mysteryId, $type, $id]
        );

        if ($type === 'location') {
            Database::execute(
                "UPDATE mystery_master_locations\n" .
                "SET description = '', location_id = '', address_line1 = '', address_line2 = '', city = '', region = '', postal_code = '', country = '', base_image_prompt = '', overlay_asset_prompt = '', overlay_trigger = '', is_regen_locked = 0\n" .
                "WHERE id = ? AND mystery_id = ?",
                [$id, $mysteryId]
            );
        } elseif ($type === 'weapon') {
            Database::execute(
                "UPDATE mystery_master_weapons\n" .
                "SET description = '', is_regen_locked = 0\n" .
                "WHERE id = ? AND mystery_id = ?",
                [$id, $mysteryId]
            );
        } else {
            Database::execute(
                "UPDATE mystery_master_motives\n" .
                "SET description = '', is_regen_locked = 0\n" .
                "WHERE id = ? AND mystery_id = ?",
                [$id, $mysteryId]
            );
        }
    }

    catn8_json_response(['success' => true]);
}
