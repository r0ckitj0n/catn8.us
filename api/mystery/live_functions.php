<?php

declare(strict_types=1);

/**
 * Loads and merges mystery, case, and run settings.
 */
function catn8_mystery_load_merged_settings(int $mysteryId, int $caseId, int $viewerId): array {
    $mysteryRow = Database::queryOne('SELECT settings_json FROM mystery_mysteries WHERE id = ?', [$mysteryId]);
    if (!$mysteryRow) {
        return [];
    }
    $settings = json_decode((string)($mysteryRow['settings_json'] ?? '{}'), true) ?: [];

    require_once __DIR__ . '/interrogate_functions.php';
    
    // Auth storage sync: merge structured database data into settings array
    if (!isset($settings['tts'])) $settings['tts'] = [];
    if (!isset($settings['tts']['voice_maps'])) {
        $settings['tts']['voice_maps'] = [
            'google' => ['voice_map' => [], 'voice_map_locks' => []],
            'live' => ['voice_map' => [], 'voice_map_locks' => []]
        ];
    }

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

    $runRow = Database::queryOne(
        "SELECT run_settings_json
         FROM mystery_run_sessions
         WHERE case_id = ? AND owner_user_id = ? AND status = 'active'
         ORDER BY updated_at DESC, id DESC
         LIMIT 1",
        [$caseId, $viewerId]
    );
    $runSettings = json_decode((string)($runRow['run_settings_json'] ?? '{}'), true) ?: [];
    $settings = catn8_interrogate_merge_deep($settings, $runSettings);

    return $settings;
}

/**
 * Requests an ephemeral token from Gemini for Live sessions.
 */
function catn8_mystery_gemini_live_token(string $model, string $systemInstruction): array {
    $apiKey = (string)secret_get('CATN8_MYSTERY_GEMINI_API_KEY');
    if ($apiKey === '') {
        throw new RuntimeException('Gemini API key is not configured (CATN8_MYSTERY_GEMINI_API_KEY).', 400);
    }

    $expireTime = gmdate('c', time() + (30 * 60));
    $newSessionExpireTime = gmdate('c', time() + 60);

    $tokenPayload = [
        'uses' => 1,
        'expireTime' => $expireTime,
        'newSessionExpireTime' => $newSessionExpireTime,
        'bidiGenerateContentSetup' => [
            'model' => $model,
            'generationConfig' => [
                'responseModalities' => ['AUDIO'],
            ],
            'systemInstruction' => [
                'parts' => [['text' => $systemInstruction]],
            ],
            'inputAudioTranscription' => new stdClass(),
            'outputAudioTranscription' => new stdClass(),
        ],
    ];

    $url = 'https://generativelanguage.googleapis.com/v1alpha/auth_tokens';
    $respInfo = catn8_http_json_with_status('POST', $url, ['x-goog-api-key' => $apiKey], $tokenPayload, 10, 20);

    $status = (int)($respInfo['status'] ?? 0);
    $data = $respInfo['json'] ?? null;

    if ($status >= 400 || !is_array($data) || isset($data['error'])) {
        $msg = $data['error']['message'] ?? 'HTTP ' . $status;
        catn8_log_error('Gemini ephemeral token request failed', ['status' => $status, 'message' => $msg]);
        throw new RuntimeException('Gemini ephemeral token request failed: ' . $msg, 500);
    }

    $name = (string)($data['name'] ?? '');
    if ($name === '') {
        throw new RuntimeException('Gemini ephemeral token response missing name', 500);
    }

    return [
        'name' => $name,
        'expireTime' => (string)($data['expireTime'] ?? ''),
        'newSessionExpireTime' => (string)($data['newSessionExpireTime'] ?? ''),
        'uses' => (int)($data['uses'] ?? 0),
    ];
}
