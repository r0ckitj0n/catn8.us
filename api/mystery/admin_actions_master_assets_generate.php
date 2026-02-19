<?php
/**
 * admin_actions_master_assets_generate.php - Generating master asset content
 * VERSION: 2025-12-31-0510-FINAL
 */
declare(strict_types=1);

require_once __DIR__ . '/admin_functions.php';
require_once __DIR__ . '/admin_actions_master_assets_generate_helpers.php';

if ($action === 'generate_master_asset_content') {
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

    if ($type !== 'character' && $type !== 'location' && $type !== 'weapon') {
        catn8_json_response(['success' => false, 'error' => 'Generation only supported for characters, locations, and weapons'], 400);
    }

    if ($type === 'character') {
        $row = Database::queryOne(
            'SELECT id, slug, name, dob, age, hometown, address, aliases_json, ethnicity, zodiac, mbti, height, weight, eye_color, hair_color, 
                    distinguishing_marks, education, employment_json, criminal_record, fav_color, fav_snack, fav_drink, fav_music, fav_hobby, fav_pet 
             FROM mystery_master_characters 
             WHERE id = ? AND mystery_id = ? LIMIT 1',
            [$id, $mysteryId]
        );
        if (!$row) {
            catn8_json_response(['success' => false, 'error' => 'Asset not found'], 404);
        }

        $fieldLocks = catn8_mystery_master_character_field_locks_load($mysteryId, $id);
        $cur = catn8_mystery_master_gen_build_profile($row);

        $aiCfg = catn8_mystery_get_ai_config();
        $curRapport = catn8_mystery_master_character_rapport_load($mysteryId, $id);
        $curFavorites = [
            'color' => (string)($row['fav_color'] ?? ''),
            'snack' => (string)($row['fav_snack'] ?? ''),
            'drink' => (string)($row['fav_drink'] ?? ''),
            'music' => (string)($row['fav_music'] ?? ''),
            'hobby' => (string)($row['fav_hobby'] ?? ''),
            'pet' => (string)($row['fav_pet'] ?? ''),
        ];
        
        $prompts = catn8_mystery_master_gen_build_prompts(
            (string)$row['name'], 
            (string)$row['slug'], 
            json_encode($cur, JSON_UNESCAPED_SLASHES), 
            json_encode(['rapport' => $curRapport, 'favorites' => $curFavorites], JSON_UNESCAPED_SLASHES),
            json_encode($fieldLocks, JSON_UNESCAPED_SLASHES),
            (bool)($body['fill_missing_only'] ?? true)
        );

        try {
            $res = catn8_ai_chat_json([
                'provider' => $aiCfg['provider'] ?? 'openai',
                'model' => $aiCfg['model'] ?? 'gpt-4o-mini',
                'system_prompt' => $prompts['system'],
                'user_prompt' => $prompts['user'],
                'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
                'location' => $aiCfg['location'] ?? 'us-central1'
            ]);

            $decoded = $res['json'] ?? [];
            if (!is_array($decoded)) {
                throw new RuntimeException("AI returned invalid JSON structure");
            }

            $fieldsPatch = catn8_mystery_master_gen_normalize_patch($decoded['fields_patch'] ?? [], $cur, $fieldLocks);

            catn8_json_response([
                'success' => true,
                'rapport_patch' => $decoded['rapport_patch'] ?? [],
                'favorites_patch' => $decoded['favorites_patch'] ?? [],
                'fields_patch' => $fieldsPatch,
            ]);
        } catch (Throwable $e) {
            catn8_json_response(['success' => false, 'error' => 'Generate failed: ' . $e->getMessage()], 500);
        }
    } else {
        // Location or Weapon
        $table = ($type === 'location') ? 'mystery_master_locations' : 'mystery_master_weapons';
        $row = Database::queryOne(
            "SELECT id, slug, name, description, data_json FROM $table WHERE id = ? AND mystery_id = ? LIMIT 1",
            [$id, $mysteryId]
        );
        if (!$row) {
            catn8_json_response(['success' => false, 'error' => 'Asset not found'], 404);
        }

        $data = json_decode((string)($row['data_json'] ?? '{}'), true) ?: [];
        
        // Check if we need items
        $needsItems = empty($data['items'] ?? []);
        if ($needsItems) {
            $aiCfg = catn8_mystery_get_ai_config();
            
            $system = "You are a creative writer for a detective mystery game. You generate missing details for master assets.";
            $user = "Generate a plausible description and list of items/details for a mystery game $type named '{$row['name']}'.
            Type: $type
            Slug: {$row['slug']}
            Current Description: " . ($row['description'] ?: '(empty)') . "
            Current Data: " . json_encode($data) . "

            Return ONLY JSON with:
            {
              \"description\": \"(A compelling 2-3 sentence description)\",
              \"items\": [\"(Item 1)\", \"(Item 2)\", ...]
            }";

            try {
                $res = catn8_ai_chat_json([
                    'provider' => $aiCfg['provider'] ?? 'openai',
                    'model' => $aiCfg['model'] ?? 'gpt-4o-mini',
                    'system_prompt' => $system,
                    'user_prompt' => $user,
                    'temperature' => (float)($aiCfg['temperature'] ?? 0.7)
                ]);
                $decoded = $res['json'] ?? [];
                
                $newDescription = $decoded['description'] ?? $row['description'];
                $newItems = $decoded['items'] ?? [];

                // Update DB
                $data['items'] = $newItems;
                Database::execute(
                    "UPDATE $table SET description = ?, data_json = ? WHERE id = ? AND mystery_id = ? LIMIT 1",
                    [$newDescription, json_encode($data), $id, $mysteryId]
                );

                // Also insert into mystery_master_asset_items if table exists and we have items
                if (!empty($newItems)) {
                    // Clear existing items first to avoid duplicates on re-gen
                    Database::execute(
                        "DELETE FROM mystery_master_asset_items WHERE mystery_id = ? AND asset_type = ? AND asset_id = ?",
                        [$mysteryId, $type, $id]
                    );
                    foreach ($newItems as $idx => $txt) {
                        Database::execute(
                            "INSERT INTO mystery_master_asset_items (mystery_id, asset_type, asset_id, text, sort_order) 
                             VALUES (?, ?, ?, ?, ?)",
                            [$mysteryId, $type, $id, $txt, $idx]
                        );
                    }
                }

                catn8_json_response([
                    'success' => true,
                    'fields_patch' => [
                        'description' => $newDescription,
                        'items' => $newItems
                    ]
                ]);
            } catch (Throwable $e) {
                catn8_json_response(['success' => false, 'error' => 'Generate failed: ' . $e->getMessage()], 500);
            }
        } else {
            catn8_json_response([
                'success' => true,
                'fields_patch' => [
                    'description' => $row['description'],
                    'items' => $data['items']
                ]
            ]);
        }
    }
}
