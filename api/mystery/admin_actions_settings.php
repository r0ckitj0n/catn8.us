<?php
declare(strict_types=1);

if ($action === 'get_mystery_settings') {
    catn8_require_method('GET');
    $mysteryId = (int)($_GET['mystery_id'] ?? 0);
    if ($mysteryId <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid mystery_id'], 400);

    $row = Database::queryOne('SELECT settings_json, voice_map_active, updated_at FROM mystery_mysteries WHERE id = ?', [$mysteryId]);
    if (!$row) catn8_json_response(['success' => false, 'error' => 'Mystery not found'], 404);

    $settings = json_decode((string)($row['settings_json'] ?? '{}'), true) ?: [];
    
    // Authoritative Voice Map Active Source
    if (!isset($settings['tts'])) $settings['tts'] = [];
    $settings['tts']['voice_map_active'] = $row['voice_map_active'] ?: 'google';

    // Auth storage sync: merge structured database data into settings JSON for the UI
    $settings['tts']['voice_maps'] = [
        'google' => ['voice_map' => [], 'voice_map_locks' => []],
        'live' => ['voice_map' => [], 'voice_map_locks' => []]
    ];
    
    // 1. Fetch all voice profiles for this mystery
    $vpRows = Database::queryAll('SELECT * FROM mystery_voice_profiles WHERE mystery_id = ?', [$mysteryId]);
    $voiceProfilesById = [];
    foreach ($vpRows as $vp) {
        $vpid = (int)$vp['id'];
        $voiceProfilesById[$vpid] = $vp;
        
        $vid = !empty($vp['voice_id']) ? $vp['voice_id'] : null;
        if ($vid) {
            // Google Map
            $settings['tts']['voice_maps']['google']['voice_map'][$vid] = [
                'voice_name' => $vp['voice_name'] ?: '',
                'language_code' => $vp['language_code'] ?: 'en-US',
                'speaking_rate' => (float)($vp['speaking_rate'] ?: 1.0),
                'pitch' => (float)($vp['pitch'] ?: 0.0),
            ];
            if ($vp['is_locked']) {
                $settings['tts']['voice_maps']['google']['voice_map_locks'][] = $vid;
            }

            // Live Map
            if (!empty($vp['live_voice_name'])) {
                $settings['tts']['voice_maps']['live']['voice_map'][$vid] = [
                    'voice_name' => $vp['live_voice_name'],
                    'language_code' => $vp['language_code'] ?: 'en-US',
                ];
                if ($vp['is_locked']) {
                    $settings['tts']['voice_maps']['live']['voice_map_locks'][] = $vid;
                }
            }
        }
    }

    // 2. Fetch all master characters to sync their specific voice keys (prefixed)
    $charRows = Database::queryAll('SELECT id, slug, name, is_law_enforcement, voice_profile_id FROM mystery_master_characters WHERE mystery_id = ?', [$mysteryId]);
    foreach ($charRows as $char) {
        $prefix = $char['is_law_enforcement'] ? 'sheriff_' : 'suspect_';
        $fullKey = $prefix . $char['slug'];
        
        if (!empty($char['voice_profile_id']) && isset($voiceProfilesById[(int)$char['voice_profile_id']])) {
            $vp = $voiceProfilesById[(int)$char['voice_profile_id']];
            
            // Google Map (Prefixed Key)
            $settings['tts']['voice_maps']['google']['voice_map'][$fullKey] = [
                'voice_name' => $vp['voice_name'] ?: '',
                'language_code' => $vp['language_code'] ?: 'en-US',
                'speaking_rate' => (float)($vp['speaking_rate'] ?: 1.0),
                'pitch' => (float)($vp['pitch'] ?: 0.0),
            ];
            if ($vp['is_locked']) {
                $settings['tts']['voice_maps']['google']['voice_map_locks'][] = $fullKey;
            }

            // Live Map (Prefixed Key)
            if (!empty($vp['live_voice_name'])) {
                $settings['tts']['voice_maps']['live']['voice_map'][$fullKey] = [
                    'voice_name' => $vp['live_voice_name'],
                    'language_code' => $vp['language_code'] ?: 'en-US',
                ];
                if ($vp['is_locked']) {
                    $settings['tts']['voice_maps']['live']['voice_map_locks'][] = $fullKey;
                }
            }
        }
    }

    catn8_json_response([
        'success' => true,
        'settings' => $settings,
        'updated_at' => (string)$row['updated_at']
    ]);
}

if ($action === 'save_mystery_settings') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $mysteryId = (int)($body['mystery_id'] ?? 0);
    $settings = $body['settings'] ?? null;

    if ($mysteryId <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid mystery_id'], 400);
    if ($settings === null) catn8_json_response(['success' => false, 'error' => 'Settings required'], 400);

    // Auth storage: write structured changes back to structured tables
    $modes = ['google', 'live'];
    $voiceMapActive = $settings['tts']['voice_map_active'] ?? 'google';
    
    foreach ($modes as $mode) {
        if (isset($settings['tts']['voice_maps'][$mode]['voice_map'])) {
            $vm = $settings['tts']['voice_maps'][$mode]['voice_map'];
            $locks = $settings['tts']['voice_maps'][$mode]['voice_map_locks'] ?? [];
            
            foreach ($vm as $key => $data) {
                // Key can be a raw voice_id or a prefixed character slug
                $isLocked = in_array($key, $locks) ? 1 : 0;
                
                // Find potential profile IDs
                $profileIds = [];
                
                // 1. Check by voice_id
                $vp = Database::queryOne('SELECT id FROM mystery_voice_profiles WHERE mystery_id = ? AND voice_id = ?', [$mysteryId, $key]);
                if ($vp) $profileIds[] = (int)$vp['id'];
                
                // 2. Check by character slug
                $slug = preg_replace('/^(suspect_|sheriff_|witness_)/', '', $key);
                $char = Database::queryOne('SELECT voice_profile_id FROM mystery_master_characters WHERE mystery_id = ? AND (slug = ? OR REPLACE(slug, "-", "_") = ?)', [$mysteryId, $slug, str_replace('-', '_', $slug)]);
                if ($char && !empty($char['voice_profile_id'])) $profileIds[] = (int)$char['voice_profile_id'];
                
                foreach (array_unique($profileIds) as $vpid) {
                    $updates = [];
                    $params = [];
                    if ($mode === 'google') {
                        if (isset($data['voice_name'])) { $updates[] = "voice_name = ?"; $params[] = $data['voice_name']; }
                        if (isset($data['language_code'])) { $updates[] = "language_code = ?"; $params[] = $data['language_code']; }
                        if (isset($data['speaking_rate'])) { $updates[] = "speaking_rate = ?"; $params[] = (float)$data['speaking_rate']; }
                        if (isset($data['pitch'])) { $updates[] = "pitch = ?"; $params[] = (float)$data['pitch']; }
                    } else {
                        if (isset($data['voice_name'])) { $updates[] = "live_voice_name = ?"; $params[] = $data['voice_name']; }
                    }
                    
                    $updates[] = "is_locked = ?";
                    $params[] = $isLocked;

                    if (!empty($updates)) {
                        $sql = "UPDATE mystery_voice_profiles SET " . implode(', ', $updates) . " WHERE id = ?";
                        $params[] = $vpid;
                        Database::execute($sql, $params);
                    }
                }
            }
        }
    }

    Database::execute(
        'UPDATE mystery_mysteries SET settings_json = ?, voice_map_active = ? WHERE id = ?',
        [json_encode($settings), $voiceMapActive, $mysteryId]
    );

    catn8_json_response(['success' => true]);
}

if ($action === 'list_tts_voices') {
    catn8_require_method('GET');
    $lang = (string)($_GET['lang'] ?? 'en-US');
    // Using the existing include for TTS if needed, but for now we might just return an empty list or mock
    // if the underlying provider logic is not fully wired here yet.
    // However, the hook expects a list.
    $voices = []; 
    if (function_exists('google_cloud_tts_list_voices')) {
        try {
            $voices = google_cloud_tts_list_voices($lang);
        } catch (Throwable $e) {
            // Log but don't fail the whole request
            error_log('TTS voice list failed: ' . $e->getMessage());
        }
    }
    catn8_json_response(['success' => true, 'voices' => $voices]);
}

if ($action === 'list_agent_profiles') {
    catn8_require_method('GET');
    // Profiles for AI personas
    $rows = Database::queryAll('SELECT id, display_name, notes, provider, language_code, ssml_gender FROM mystery_voice_profiles ORDER BY display_name ASC');
    $profiles = array_map(static fn($r) => [
        'id' => (int)$r['id'],
        'name' => (string)$r['display_name'],
        'description' => (string)$r['notes'],
        'provider' => (string)$r['provider'],
        'language_code' => (string)$r['language_code'],
        'ssml_gender' => (string)$r['ssml_gender']
    ], $rows);
    catn8_json_response(['success' => true, 'profiles' => $profiles]);
}

if ($action === 'save_case_details') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    $title = trim((string)($body['title'] ?? ''));
    $slug = trim((string)($body['slug'] ?? ''));
    $description = trim((string)($body['description'] ?? ''));
    $isArchived = (int)($body['is_archived'] ?? 0);
    $isTemplate = (int)($body['is_template'] ?? 0);

    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);

    Database::execute(
        'UPDATE mystery_games SET title = ?, slug = ?, description = ?, is_archived = ?, is_template = ? WHERE id = ?',
        [$title, $slug, $description, $isArchived, $isTemplate, $id]
    );

    catn8_json_response(['success' => true]);
}

if ($action === 'save_scenario_briefing') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    $briefingText = (string)($body['briefing_text'] ?? '');

    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);

    Database::execute(
        'UPDATE mystery_scenarios SET briefing_text = ? WHERE id = ?',
        [$briefingText, $id]
    );

    catn8_json_response(['success' => true]);
}

if ($action === 'save_csi_report') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $sid = (int)($body['scenario_id'] ?? 0);
    $reportText = (string)($body['report_text'] ?? '');
    $reportJson = (string)($body['report_json'] ?? '');
    $detectiveId = (int)($body['detective_entity_id'] ?? 0);

    if ($sid <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid scenario_id'], 400);

    catn8_mystery_require_csi_columns(); // Ensure columns exist

    Database::execute(
        'UPDATE mystery_scenarios SET csi_report_text = ?, csi_report_json = ?, csi_detective_entity_id = ? WHERE id = ?',
        [$reportText, $reportJson, $detectiveId ?: null, $sid]
    );

    catn8_json_response(['success' => true]);
}

if ($action === 'generate_csi_report') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $sid = (int)($body['scenario_id'] ?? 0);

    if ($sid <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid scenario_id'], 400);

    try {
        $result = catn8_mystery_generate_csi_report($sid);
        catn8_json_response($result);
    } catch (Throwable $e) {
        catn8_json_response(['success' => false, 'error' => 'CSI Generation failed: ' . $e->getMessage()], 500);
    }
}
