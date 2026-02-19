<?php
declare(strict_types=1);

require_once __DIR__ . '/../../api/config.php';

/**
 * Migration script to consolidate mystery settings.
 * Pulls from legacy mystery_settings table and character definitions.
 */

try {
    $db = Database::getInstance();

    // 0. Ensure schema is updated
    echo "Checking schema updates...\n";
    $cols = $db->query("SHOW COLUMNS FROM mystery_voice_profiles")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('voice_name', $cols)) {
        echo "Adding voice_name to mystery_voice_profiles...\n";
        Database::execute("ALTER TABLE mystery_voice_profiles ADD COLUMN voice_name VARCHAR(191) AFTER voice_id");
    }
    if (!in_array('live_voice_name', $cols)) {
        echo "Adding live_voice_name to mystery_voice_profiles...\n";
        Database::execute("ALTER TABLE mystery_voice_profiles ADD COLUMN live_voice_name VARCHAR(191) AFTER voice_name");
    }
    if (!in_array('speaking_rate', $cols)) {
        echo "Adding speaking_rate to mystery_voice_profiles...\n";
        Database::execute("ALTER TABLE mystery_voice_profiles ADD COLUMN speaking_rate FLOAT DEFAULT 1.0 AFTER ssml_gender");
    }
    if (!in_array('pitch', $cols)) {
        echo "Adding pitch to mystery_voice_profiles...\n";
        Database::execute("ALTER TABLE mystery_voice_profiles ADD COLUMN pitch FLOAT DEFAULT 0.0 AFTER speaking_rate");
    }
    if (!in_array('is_locked', $cols)) {
        echo "Adding is_locked to mystery_voice_profiles...\n";
        Database::execute("ALTER TABLE mystery_voice_profiles ADD COLUMN is_locked TINYINT(1) DEFAULT 0 AFTER pitch");
    }

    $mcCols = $db->query("SHOW COLUMNS FROM mystery_master_characters")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('style', $mcCols)) {
        echo "Adding style to mystery_master_characters...\n";
        Database::execute("ALTER TABLE mystery_master_characters ADD COLUMN style TEXT AFTER distinguishing_marks");
    }
    if (!in_array('financials_json', $mcCols)) {
        echo "Adding financials_json to mystery_master_characters...\n";
        Database::execute("ALTER TABLE mystery_master_characters ADD COLUMN financials_json TEXT AFTER employment_json");
    }
    if (!in_array('plot_hooks_json', $mcCols)) {
        echo "Adding plot_hooks_json to mystery_master_characters...\n";
        Database::execute("ALTER TABLE mystery_master_characters ADD COLUMN plot_hooks_json TEXT AFTER criminal_record");
    }

    // 1. Load legacy global settings
    $legacyRow = $db->query("SELECT settings_json FROM mystery_settings WHERE id = 1")->fetch(PDO::FETCH_ASSOC);
    $legacySettings = json_decode($legacyRow['settings_json'] ?? '{}', true);
    
    // 2. Get all non-archived mysteries
    $mysteriesRes = $db->query("SELECT id, slug, settings_json FROM mystery_mysteries WHERE is_archived = 0");
    
    while ($mRow = $mysteriesRes->fetch(PDO::FETCH_ASSOC)) {
        $mysteryId = (int)$mRow['id'];
        $mysterySlug = $mRow['slug'];
        echo "--- Processing Mystery ID: {$mysteryId} ({$mysterySlug}) ---\n";

        $currentSettings = json_decode($mRow['settings_json'] ?? '{}', true);

        // 3. Initialize or merge settings (JSON cached version)
        $newSettings = $currentSettings;
        if (!isset($newSettings['tts'])) {
            $newSettings['tts'] = [
                'language_code' => 'en-US',
                'voice_map_active' => 'live',
                'voice_maps' => [
                    'google' => ['voice_map' => [], 'voice_map_locks' => []],
                    'live' => ['voice_map' => [], 'voice_map_locks' => []]
                ]
            ];
        } else {
            $newSettings['tts']['voice_map_active'] = 'live';
            if (!isset($newSettings['tts']['voice_maps'])) {
                $newSettings['tts']['voice_maps'] = [
                    'google' => ['voice_map' => [], 'voice_map_locks' => []],
                    'live' => ['voice_map' => [], 'voice_map_locks' => []]
                ];
            }
        }

        // 4. Populate voice maps from legacy data and structured profiles
        $voiceMapLegacy = $legacySettings['tts']['voice_maps']['google']['voice_map'] ?? $legacySettings['tts']['voice_map'] ?? [];
        $googleLocksLegacy = $legacySettings['tts']['voice_maps']['google']['voice_map_locks'] ?? $legacySettings['tts']['voice_map_locks'] ?? [];
        $liveMapLegacy = $legacySettings['tts']['voice_maps']['live']['voice_map'] ?? [];
        $liveLocksLegacy = $legacySettings['tts']['voice_maps']['live']['voice_map_locks'] ?? [];
        $aiSyncLegacy = $legacySettings['ai_model_sync']['voice_ids'] ?? [];
        
        $charRes = $db->query("SELECT id, slug, name, is_law_enforcement, voice_profile_id FROM mystery_master_characters WHERE mystery_id = {$mysteryId}");
        while ($char = $charRes->fetch(PDO::FETCH_ASSOC)) {
            $slug = $char['slug'];
            $prefix = $char['is_law_enforcement'] ? 'sheriff_' : 'suspect_';
            $fullKey = $prefix . $slug;
            $masterId = (int)$char['id'];

            // Structured Voice Data Migration
            if (!empty($char['voice_profile_id'])) {
                $vpid = (int)$char['voice_profile_id'];
                
                // Try to find best legacy settings with flexible matching
                $searchKeys = [$fullKey, $slug, str_replace('_', '-', $fullKey), str_replace('-', '_', $fullKey), str_replace('_', '-', $slug), str_replace('-', '_', $slug)];
                if ($char['is_law_enforcement']) {
                    $searchKeys[] = 'sheriff_sheriff-hank-mercer';
                    $searchKeys[] = 'sheriff_sheriff_hank_mercer';
                }
                
                $legacyEntry = null;
                $legacyLive = null;
                $legacySync = null;
                
                foreach ($searchKeys as $sk) {
                    if (isset($voiceMapLegacy[$sk])) { $legacyEntry = $voiceMapLegacy[$sk]; break; }
                }
                foreach ($searchKeys as $sk) {
                    if (isset($liveMapLegacy[$sk])) { $legacyLive = $liveMapLegacy[$sk]; break; }
                }
                foreach ($searchKeys as $sk) {
                    if (isset($aiSyncLegacy[$sk])) { $legacySync = $aiSyncLegacy[$sk]; break; }
                }

                $isLocked = false;
                foreach ($searchKeys as $sk) {
                    if (in_array($sk, $googleLocksLegacy) || in_array($sk, $liveLocksLegacy)) {
                        $isLocked = true;
                        break;
                    }
                }

                // Update the authoritative table mystery_voice_profiles
                $updates = [];
                $params = [];

                if ($legacyEntry) {
                    $updates[] = "voice_name = COALESCE(NULLIF(voice_name, ''), ?)";
                    $params[] = $legacyEntry['voice_name'] ?? '';
                    $updates[] = "language_code = COALESCE(NULLIF(language_code, ''), ?)";
                    $params[] = $legacyEntry['language_code'] ?? 'en-US';
                    $updates[] = "speaking_rate = IF(speaking_rate = 1.0 AND ? != 0, ?, speaking_rate)";
                    $params[] = $legacyEntry['speaking_rate'] ?? 0;
                    $params[] = $legacyEntry['speaking_rate'] ?? 1.0;
                    $updates[] = "pitch = IF(pitch = 0.0 AND ? != 0, ?, pitch)";
                    $params[] = $legacyEntry['pitch'] ?? 0;
                    $params[] = $legacyEntry['pitch'] ?? 0.0;
                }

                if ($legacySync && !empty($legacySync['foundation_id'])) {
                    $updates[] = "foundation_id = IF(foundation_id IS NULL OR foundation_id = 0, ?, foundation_id)";
                    $params[] = (int)$legacySync['foundation_id'];
                }

                // Handle Live Voice Name
                if ($char['is_law_enforcement']) {
                    $liveName = $legacyLive['voice_name'] ?? 'Gemini 2.0 Flash';
                    $updates[] = "live_voice_name = COALESCE(NULLIF(live_voice_name, ''), ?)";
                    $params[] = $liveName;
                }

                if ($isLocked) {
                    $updates[] = "is_locked = 1";
                }

                if (!empty($updates)) {
                    $sql = "UPDATE mystery_voice_profiles SET " . implode(', ', $updates) . " WHERE id = ?";
                    $params[] = $vpid;
                    $db->prepare($sql)->execute($params);
                }
            }
        }

        // 5. Ensure all characters in this mystery have entries and provide Live defaults
        $charRes = $db->query("SELECT id, slug, name, is_law_enforcement, voice_profile_id FROM mystery_master_characters WHERE mystery_id = {$mysteryId}");
        while ($char = $charRes->fetch(PDO::FETCH_ASSOC)) {
            $slug = $char['slug'];
            $prefix = $char['is_law_enforcement'] ? 'sheriff_' : 'suspect_';
            $fullKey = $prefix . $slug;
            $masterId = (int)$char['id'];

            // If character has no voice_profile_id, try to find or create one
            if (empty($char['voice_profile_id'])) {
                // Try to find a voice_id in mystery_entities for this character
                $eRow = $db->query("SELECT data_json FROM mystery_entities WHERE (slug = '$slug' OR slug = '" . str_replace('_', '-', $slug) . "') AND game_id = (SELECT id FROM mystery_games WHERE mystery_id = $mysteryId LIMIT 1)")->fetch(PDO::FETCH_ASSOC);
                $vid = '';
                if ($eRow) {
                    $eData = json_decode($eRow['data_json'], true);
                    $vid = $eData['voice_id'] ?? '';
                }
                
                if (empty($vid)) {
                    // Default based on slug if possible
                    $vid = $fullKey;
                }

                echo "Creating voice profile for character: $slug (vid: $vid)\n";
                $db->prepare("INSERT INTO mystery_voice_profiles (mystery_id, voice_id, display_name) VALUES (?, ?, ?)")
                   ->execute([$mysteryId, $vid, $char['name'] . ' Voice']);
                $newVpid = (int)Database::lastInsertId();
                $db->prepare("UPDATE mystery_master_characters SET voice_profile_id = ? WHERE id = ?")
                   ->execute([$newVpid, $masterId]);
                $char['voice_profile_id'] = $newVpid;
            }

            // Sync legacy mappings to the profile
            $vpid = (int)$char['voice_profile_id'];
            $legacyEntry = $voiceMapLegacy[$fullKey] ?? $voiceMapLegacy[$slug] ?? null;
            $legacyLive = $liveMapLegacy[$fullKey] ?? $liveMapLegacy[$slug] ?? null;
            $isLocked = in_array($fullKey, $googleLocksLegacy) || in_array($slug, $googleLocksLegacy) || in_array($fullKey, $liveLocksLegacy) || in_array($slug, $liveLocksLegacy);

            $updates = [];
            $params = [];

            if ($legacyEntry) {
                $updates[] = "voice_name = COALESCE(NULLIF(voice_name, ''), ?)";
                $params[] = $legacyEntry['voice_name'] ?? '';
                $updates[] = "language_code = COALESCE(NULLIF(language_code, ''), ?)";
                $params[] = $legacyEntry['language_code'] ?? 'en-US';
                $updates[] = "speaking_rate = IF(speaking_rate = 1.0 AND ? != 0, ?, speaking_rate)";
                $params[] = $legacyEntry['speaking_rate'] ?? 0;
                $params[] = $legacyEntry['speaking_rate'] ?? 1.0;
                $updates[] = "pitch = IF(pitch = 0.0 AND ? != 0, ?, pitch)";
                $params[] = $legacyEntry['pitch'] ?? 0;
                $params[] = $legacyEntry['pitch'] ?? 0.0;
            }

            if ($char['is_law_enforcement']) {
                $liveName = $legacyLive['voice_name'] ?? 'Gemini 2.0 Flash';
                $updates[] = "live_voice_name = COALESCE(NULLIF(live_voice_name, ''), ?)";
                $params[] = $liveName;
            }

            if ($isLocked) {
                $updates[] = "is_locked = 1";
            }

            if (!empty($updates)) {
                $sql = "UPDATE mystery_voice_profiles SET " . implode(', ', $updates) . " WHERE id = ?";
                $params[] = $vpid;
                $db->prepare($sql)->execute($params);
            }
        }

        // 6. Migrate character details from mystery_entities if missing
        $entityRes = $db->query("SELECT me.slug, me.data_json, mc.id as master_id 
                                 FROM mystery_entities me 
                                 JOIN mystery_master_characters mc ON mc.mystery_id = {$mysteryId} AND (mc.slug = me.slug OR REPLACE(mc.slug, '-', '_') = REPLACE(me.slug, '-', '_'))
                                 WHERE me.entity_type = 'character'");
        while ($eRow = $entityRes->fetch(PDO::FETCH_ASSOC)) {
            $data = json_decode($eRow['data_json'] ?? '{}', true);
            $static = $data['static_profile'] ?? [];
            $masterId = (int)$eRow['master_id'];

            $updates = [];
            $params = [];

            $addUpdate = function($col, $val) use (&$updates, &$params) {
                if ($val !== null && $val !== '' && $val !== 'Unknown') {
                    // Use IF to only update if currently empty or default
                    if ($col === 'dob') {
                        $updates[] = "$col = IF($col IS NULL, ?, $col)";
                    } elseif ($col === 'age' || $col === 'agent_id') {
                        $updates[] = "$col = IF($col = 0, ?, $col)";
                    } else {
                        $updates[] = "$col = IF($col IS NULL OR $col = '', ?, $col)";
                    }
                    $params[] = $val;
                }
            };

            $mapping = [
                'age' => $static['demographics']['age'] ?? null,
                'dob' => (!empty($static['demographics']['birthday']) && $static['demographics']['birthday'] !== '') ? $static['demographics']['birthday'] : null,
                'hometown' => $static['demographics']['hometown'] ?? null,
                'ethnicity' => $static['demographics']['ethnicity'] ?? null,
                'zodiac' => $static['demographics']['zodiac'] ?? null,
                'height' => $static['appearance']['height'] ?? null,
                'weight' => $static['appearance']['weight'] ?? null,
                'eye_color' => $static['appearance']['eye_color'] ?? null,
                'hair_color' => $static['appearance']['hair_color'] ?? null,
                'style' => $static['appearance']['style'] ?? null,
                'distinguishing_marks' => $static['appearance']['distinguishing_marks'] ?? null,
                'mbti' => $static['psychology']['mbti'] ?? null,
                'education' => $static['background']['education'] ?? null,
                'criminal_record' => $static['background']['criminal_record'] ?? null,
                'address' => $static['background']['address'] ?? null,
                'employment_json' => isset($static['background']['employment']) ? json_encode($static['background']['employment']) : null,
                'financials_json' => isset($static['background']['financials']) ? json_encode($static['background']['financials']) : null,
            ];

            if (isset($static['plot_hooks'])) {
                $addUpdate('plot_hooks_json', json_encode($static['plot_hooks']));
            } elseif (isset($data['plot_hooks'])) {
                $addUpdate('plot_hooks_json', json_encode($data['plot_hooks']));
            }

            foreach ($mapping as $col => $val) {
                $addUpdate($col, $val);
            }

            if (!empty($static['favorites'])) {
                $favs = $static['favorites'];
                $addUpdate('fav_color', $favs['color'] ?? null);
                $addUpdate('fav_snack', $favs['food'] ?? $favs['snack'] ?? null);
                $addUpdate('fav_drink', $favs['drink'] ?? null);
                $addUpdate('fav_music', $favs['music'] ?? null);
                $addUpdate('fav_hobby', $favs['hobby'] ?? null);
                $addUpdate('fav_pet', $favs['pet'] ?? null);
            }

            if (!empty($updates)) {
                $sql = "UPDATE mystery_master_characters SET " . implode(', ', $updates) . " WHERE id = ?";
                $params[] = $masterId;
                $db->prepare($sql)->execute($params);
            }

            // Rapport Items
            if (!empty($static['rapport'])) {
                foreach ($static['rapport'] as $kind => $items) {
                    if (!is_array($items)) continue;
                    foreach ($items as $idx => $val) {
                        if (empty($val)) continue;
                        // Check if already exists
                        $check = $db->prepare("SELECT id FROM mystery_master_character_rapport_items WHERE master_character_id = ? AND kind = ? AND value = ?");
                        $check->execute([$masterId, $kind, $val]);
                        if (!$check->fetch()) {
                            $db->prepare("INSERT INTO mystery_master_character_rapport_items (mystery_id, master_character_id, kind, value, sort_order) VALUES (?, ?, ?, ?, ?)")
                            ->execute([$mysteryId, $masterId, $kind, $val, $idx]);
                        }
                    }
                }
            }
            
            // Psychology/Routine as rapport if no specific column exists
            $extraRapport = [
                'phobia' => $static['psychology']['phobia'] ?? null,
                'tech_literacy' => $static['psychology']['tech_literacy'] ?? null,
                'political_leaning' => $static['psychology']['political_leaning'] ?? null,
                'childhood_memory' => $static['psychology']['childhood_memory'] ?? null,
                'daily_routine' => $static['daily_routine'] ?? null,
            ];
            foreach ($extraRapport as $kind => $val) {
                if (!empty($val)) {
                    $check = $db->prepare("SELECT id FROM mystery_master_character_rapport_items WHERE master_character_id = ? AND kind = ? AND value = ?");
                    $check->execute([$masterId, $kind, $val]);
                    if (!$check->fetch()) {
                        $db->prepare("INSERT INTO mystery_master_character_rapport_items (mystery_id, master_character_id, kind, value, sort_order) VALUES (?, ?, ?, ?, ?)")
                        ->execute([$mysteryId, $masterId, $kind, $val, 0]);
                    }
                }
            }
        }

        // 7. Migrate location clues to mystery_master_asset_items if missing
        $entityRes = $db->query("SELECT me.id, me.slug, me.data_json, ml.id as master_location_id 
                                 FROM mystery_entities me 
                                 JOIN mystery_master_locations ml ON ml.mystery_id = {$mysteryId} AND (ml.slug = me.slug OR REPLACE(ml.slug, '-', '_') = REPLACE(me.slug, '-', '_'))
                                 WHERE me.entity_type = 'location' AND me.game_id = (SELECT id FROM mystery_games WHERE mystery_id = {$mysteryId} LIMIT 1)");
        while ($eRow = $entityRes->fetch(PDO::FETCH_ASSOC)) {
            $data = json_decode($eRow['data_json'] ?? '{}', true);
            $clues = $data['static_profile']['rapport']['clues'] ?? $data['clues'] ?? [];
            $masterLocId = (int)$eRow['master_location_id'];
            if (is_array($clues)) {
                foreach ($clues as $idx => $val) {
                    if (empty($val)) continue;
                    $check = $db->prepare("SELECT id FROM mystery_master_asset_items WHERE mystery_id = ? AND asset_type = 'location' AND asset_id = ? AND text = ?");
                    $check->execute([$mysteryId, $masterLocId, $val]);
                    if (!$check->fetch()) {
                        $db->prepare("INSERT INTO mystery_master_asset_items (mystery_id, asset_type, asset_id, text, sort_order) VALUES (?, 'location', ?, ?, ?)")
                        ->execute([$mysteryId, $masterLocId, $val, $idx]);
                    }
                }
            }
        }

        // 8. Migrate Locations, Weapons, Motives descriptions if missing in master tables
        $locRes = $db->query("SELECT slug, description FROM mystery_locations");
        while ($lRow = $locRes->fetch(PDO::FETCH_ASSOC)) {
            if (!empty($lRow['description'])) {
                $stmt = $db->prepare("UPDATE mystery_master_locations SET description = COALESCE(NULLIF(description, ''), ?) WHERE mystery_id = ? AND slug = ?");
                $stmt->execute([$lRow['description'], $mysteryId, $lRow['slug']]);
            }
        }

        $weapRes = $db->query("SELECT slug, description FROM mystery_weapons");
        while ($wRow = $weapRes->fetch(PDO::FETCH_ASSOC)) {
            if (!empty($wRow['description'])) {
                $stmt = $db->prepare("UPDATE mystery_master_weapons SET description = COALESCE(NULLIF(description, ''), ?) WHERE mystery_id = ? AND slug = ?");
                $stmt->execute([$wRow['description'], $mysteryId, $wRow['slug']]);
            }
        }

        $motRes = $db->query("SELECT slug, description FROM mystery_motives");
        while ($mRow = $motRes->fetch(PDO::FETCH_ASSOC)) {
            if (!empty($mRow['description'])) {
                $stmt = $db->prepare("UPDATE mystery_master_motives SET description = COALESCE(NULLIF(description, ''), ?) WHERE mystery_id = ? AND slug = ?");
                $stmt->execute([$mRow['description'], $mysteryId, $mRow['slug']]);
            }
        }

        // 9. Sync image paths if missing in master characters
        // We use COALESCE and IF to ensure we never try to insert NULL into a NOT NULL column
        Database::execute("UPDATE mystery_master_characters mc 
                      JOIN mystery_entities me ON (me.slug = mc.slug OR REPLACE(me.slug, '-', '_') = REPLACE(mc.slug, '-', '_'))
                      SET mc.image_path = IF(mc.image_path = '' OR mc.image_path IS NULL, 
                                             COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(me.data_json, '$.image_path')), 'null'), ''), 
                                             mc.image_path),
                          mc.character_image_path = IF(mc.character_image_path = '' OR mc.character_image_path IS NULL, 
                                                       COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(me.data_json, '$.image_path')), 'null'), ''), 
                                                       mc.character_image_path)
                      WHERE mc.mystery_id = $mysteryId AND me.entity_type = 'character'");

        // 10. Save back to the database
        $json = json_encode($newSettings, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        $stmt = $db->prepare("UPDATE mystery_mysteries SET settings_json = ? WHERE id = ?");
        $stmt->execute([$json, $mysteryId]);

        echo "Mystery ID: {$mysteryId} consolidated.\n";
    }

    echo "Global migration complete.\n";

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
