<?php

declare(strict_types=1);

require_once __DIR__ . '/interrogate_functions_http.php';
require_once __DIR__ . '/interrogate_functions_ai.php';

/**
 * Loads interrogation-related data for an entity in a scenario.
 */
function catn8_interrogate_load_state(int $scenarioId, int $entityId, int $viewerId, bool $isAdmin): array {
    $entityRow = Database::queryOne(
        'SELECT e.id, e.game_id, e.entity_type, e.slug, e.name, e.data_json,
                mc.id as master_character_id, mc.age, mc.dob, mc.hometown, mc.ethnicity, mc.zodiac, mc.mbti, 
                mc.height, mc.weight, mc.eye_color, mc.hair_color, mc.distinguishing_marks, mc.education, 
                mc.criminal_record, mc.employment_json, mc.fav_color, mc.fav_snack, mc.fav_drink, 
                mc.fav_music, mc.fav_hobby, mc.fav_pet, mc.voice_profile_id, mc.agent_id
         FROM mystery_entities e
         LEFT JOIN mystery_master_characters mc ON (mc.slug = e.slug OR REPLACE(mc.slug, "-", "_") = REPLACE(e.slug, "-", "_")) AND mc.is_archived = 0
         WHERE e.id = ? LIMIT 1',
        [$entityId]
    );
    if (!$entityRow) {
        throw new RuntimeException('Entity not found', 404);
    }

    $scenarioRow = Database::queryOne('SELECT game_id, title FROM mystery_scenarios WHERE id = ? LIMIT 1', [$scenarioId]);
    if (!$scenarioRow) {
        throw new RuntimeException('Scenario not found', 404);
    }

    if ((int)($entityRow['game_id'] ?? 0) !== (int)($scenarioRow['game_id'] ?? 0)) {
        throw new RuntimeException('Entity does not belong to scenario case', 400);
    }

    $entityData = json_decode((string)($entityRow['data_json'] ?? '{}'), true);
    if (!is_array($entityData)) $entityData = [];

    $seRow = Database::queryOne(
        'SELECT role, override_json FROM mystery_scenario_entities WHERE scenario_id = ? AND entity_id = ? LIMIT 1',
        [$scenarioId, $entityId]
    );
    if (!$seRow) {
        throw new RuntimeException('Entity is not attached to this scenario', 404);
    }

    $override = json_decode((string)($seRow['override_json'] ?? '{}'), true);
    if (!is_array($override)) $override = [];

    // Construct structured profile from master table columns
    $masterProfile = [];
    if (!empty($entityRow['master_character_id'])) {
        $masterProfile = [
            'demographics' => [
                'age' => $entityRow['age'],
                'birthday' => $entityRow['dob'],
                'hometown' => $entityRow['hometown'],
                'ethnicity' => $entityRow['ethnicity'],
                'zodiac' => $entityRow['zodiac'],
            ],
            'appearance' => [
                'height' => $entityRow['height'],
                'weight' => $entityRow['weight'],
                'eye_color' => $entityRow['eye_color'],
                'hair_color' => $entityRow['hair_color'],
                'distinguishing_marks' => $entityRow['distinguishing_marks'],
            ],
            'psychology' => [
                'mbti' => $entityRow['mbti'],
            ],
            'background' => [
                'education' => $entityRow['education'],
                'criminal_record' => $entityRow['criminal_record'],
                'employment' => json_decode((string)($entityRow['employment_json'] ?? '[]'), true),
            ],
            'favorites' => [
                'color' => $entityRow['fav_color'],
                'snack' => $entityRow['fav_snack'],
                'drink' => $entityRow['fav_drink'],
                'music' => $entityRow['fav_music'],
                'hobby' => $entityRow['fav_hobby'],
                'pet' => $entityRow['fav_pet'],
            ],
        ];

        // Fetch Rapport Items
        $rapportRes = Database::queryAll(
            'SELECT kind, value FROM mystery_master_character_rapport_items WHERE master_character_id = ? ORDER BY sort_order ASC, id ASC',
            [(int)$entityRow['master_character_id']]
        );
        $rapport = [];
        foreach ($rapportRes as $r) {
            $k = $r['kind'];
            if (!isset($rapport[$k])) $rapport[$k] = [];
            $rapport[$k][] = $r['value'];
        }
        if (!empty($rapport)) {
            $masterProfile['rapport'] = $rapport;
        }
    }

    // Merge: Legacy data_json (base) <- Master Table Columns (over) <- Scenario Overrides (final)
    // This makes master table columns authoritative over what's in data_json.
    $profile = catn8_interrogate_merge_deep($entityData['static_profile'] ?? [], $masterProfile);
    $mergedEntity = catn8_interrogate_merge_deep($entityData, $override);
    
    // Voice ID handling
    $voiceId = trim((string)($mergedEntity['voice_id'] ?? ''));
    if ($voiceId === '' && !empty($entityRow['voice_profile_id'])) {
        $vp = Database::queryOne('SELECT voice_id FROM mystery_voice_profiles WHERE id = ?', [(int)$entityRow['voice_profile_id']]);
        if ($vp) $voiceId = $vp['voice_id'];
    }

    $lies = Database::queryAll(
        'SELECT lie_type, topic_key, lie_text, truth_text, trigger_questions_json, relevance, notes
         FROM mystery_scenario_lies
         WHERE scenario_id = ? AND entity_id = ?
         ORDER BY id ASC',
        [$scenarioId, $entityId]
    );
    
    $gameWon = catn8_mystery_is_game_won((int)$scenarioRow['game_id'], $viewerId);
    $liePack = [];
    foreach ($lies as $r) {
        $trigger = json_decode((string)($r['trigger_questions_json'] ?? '[]'), true);
        if (!is_array($trigger)) $trigger = [];
        $liePack[] = [
            'lie_type' => (string)($r['lie_type'] ?? ''),
            'topic_key' => (string)($r['topic_key'] ?? ''),
            'lie_text' => (string)($r['lie_text'] ?? ''),
            'truth_text' => ($isAdmin || $gameWon) ? (string)($r['truth_text'] ?? '') : '',
            'trigger_questions' => $trigger,
            'relevance' => (string)($r['relevance'] ?? ''),
            'notes' => (string)($r['notes'] ?? ''),
        ];
    }

    return [
        'scenario_title' => (string)$scenarioRow['title'],
        'entity_name' => (string)$entityRow['name'],
        'profile' => $profile,
        'voice_id' => $voiceId,
        'lie_pack' => $liePack,
    ];
}

/**
 * Deep merges two arrays.
 */
function catn8_interrogate_merge_deep($base, $over) {
    if (!is_array($base) || !is_array($over)) return $over;
    $out = $base;
    foreach ($over as $k => $v) {
        if (array_key_exists($k, $out) && is_array($out[$k]) && is_array($v)) {
            $out[$k] = catn8_interrogate_merge_deep($out[$k], $v);
        } else {
            $out[$k] = $v;
        }
    }
    return $out;
}

/**
 * Synthesizes speech via Google Cloud TTS and stores it.
 */
function catn8_interrogate_synth_tts(int $scenarioId, int $entityId, string $text, string $voiceId, int $viewerId): array {
    $globalTtsDefaults = [];
    try {
        $raw = secret_get(catn8_secret_key('mystery.tts_defaults'));
        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) $globalTtsDefaults = $decoded;
        }
    } catch (Throwable $_e) {}

    $mysteryIdRow = Database::queryOne(
        'SELECT g.mystery_id, s.game_id
         FROM mystery_scenarios s
         INNER JOIN mystery_games g ON g.id = s.game_id
         WHERE s.id = ?
         LIMIT 1',
        [$scenarioId]
    );
    $mysteryId = (int)($mysteryIdRow['mystery_id'] ?? 0);
    $caseId = (int)($mysteryIdRow['game_id'] ?? 0);
    if ($mysteryId <= 0) throw new RuntimeException('Scenario is missing mystery_id');

    $mysteryRow = Database::queryOne('SELECT settings_json FROM mystery_mysteries WHERE id = ?', [$mysteryId]);
    if (!$mysteryRow) {
        throw new RuntimeException('Mystery not found');
    }
    $settings = json_decode((string)($mysteryRow['settings_json'] ?? '{}'), true) ?: [];
    
    if (!isset($settings['tts']) || !is_array($settings['tts'])) $settings['tts'] = [];
    if ($globalTtsDefaults) $settings['tts'] = array_merge($settings['tts'], $globalTtsDefaults);

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

    $ttsCfg = $settings['tts'] ?? [];
    $activeProvider = strtolower(trim((string)($ttsCfg['voice_map_active'] ?? 'google')));
    if ($activeProvider === 'live') {
        return [
            'tts_meta' => ['provider' => 'gemini_live', 'voice_id' => $voiceId],
            'tts_error' => 'Active voice map is Gemini Live; server-side synth disabled.',
            'audio_url' => '',
            'audio_encoding' => ''
        ];
    }

    $outputFormat = strtolower(trim((string)($ttsCfg['output_format'] ?? 'mp3')));
    $audioEncoding = strtoupper($outputFormat === 'wav' ? 'LINEAR16' : 'MP3');
    $defaultLang = trim((string)($ttsCfg['language_code'] ?? 'en-US'));
    $defaultVoiceName = trim((string)($ttsCfg['voice_name'] ?? ''));
    $sr = (float)($ttsCfg['speaking_rate'] ?? 1.0);
    $pitch = (float)($ttsCfg['pitch'] ?? 0.0);

    $voiceMap = $ttsCfg['voice_maps']['google']['voice_map'] ?? $ttsCfg['voice_map'] ?? [];
    $voiceEntry = ($voiceId !== '' && isset($voiceMap[$voiceId])) ? $voiceMap[$voiceId] : [];
    
    // Auth storage check: prefer mystery_voice_profiles if available
    $vpRow = null;
    if ($voiceId !== '') {
        $vpRow = Database::queryOne(
            'SELECT voice_name, language_code, speaking_rate, pitch FROM mystery_voice_profiles WHERE voice_id = ? AND mystery_id = ? LIMIT 1',
            [$voiceId, $mysteryId]
        );
    }
    if (!$vpRow && !empty($entityRow['voice_profile_id'])) {
        $vpRow = Database::queryOne(
            'SELECT voice_name, language_code, speaking_rate, pitch FROM mystery_voice_profiles WHERE id = ? LIMIT 1',
            [(int)$entityRow['voice_profile_id']]
        );
    }

    if ($vpRow) {
        if (!empty($vpRow['voice_name'])) $voiceEntry['voice_name'] = $vpRow['voice_name'];
        if (!empty($vpRow['language_code'])) $voiceEntry['language_code'] = $vpRow['language_code'];
        if ($vpRow['speaking_rate'] != 1.0) $voiceEntry['speaking_rate'] = $vpRow['speaking_rate'];
        if ($vpRow['pitch'] != 0.0) $voiceEntry['pitch'] = $vpRow['pitch'];
    }

    $sync = $settings['ai_model_sync'] ?? [];
    $syncEntry = ($voiceId !== '' && isset($sync['voice_ids'][$voiceId])) ? $sync['voice_ids'][$voiceId] : [];
    $foundationId = (int)($syncEntry['foundation_id'] ?? 0);
    $foundationEntry = ($foundationId > 0 && isset($sync['foundations'][(string)$foundationId])) ? $sync['foundations'][(string)$foundationId] : [];
    
    $languageCode = trim((string)($syncEntry['google_cloud_tts']['language_code'] ?? $foundationEntry['google_cloud_tts']['language_code'] ?? $voiceEntry['language_code'] ?? $defaultLang));
    $voiceName = trim((string)($syncEntry['google_cloud_tts']['voice_name'] ?? $foundationEntry['google_cloud_tts']['voice_name'] ?? $voiceEntry['voice_name'] ?? $defaultVoiceName));
    
    $sr = (float)($syncEntry['google_cloud_tts']['speaking_rate'] ?? $foundationEntry['google_cloud_tts']['speaking_rate'] ?? $voiceEntry['speaking_rate'] ?? $sr);
    $pitch = (float)($syncEntry['google_cloud_tts']['pitch'] ?? $foundationEntry['google_cloud_tts']['pitch'] ?? $voiceEntry['pitch'] ?? $pitch);

    $saJson = secret_get('CATN8_MYSTERY_GCP_SERVICE_ACCOUNT_JSON');
    $sa = json_decode((string)$saJson, true);
    $projectId = trim((string)($sa['project_id'] ?? ''));
    if ($projectId === '') throw new RuntimeException('Missing project_id in service account');

    $ttsApiKey = (string)secret_get('CATN8_MYSTERY_GOOGLE_CLOUD_TTS_API_KEY');

    $ttsResp = catn8_google_cloud_tts_synthesize([
        'project_id' => $projectId,
        'api_key' => $ttsApiKey,
        'service_account_json' => $saJson,
        'text' => $text,
        'language_code' => $languageCode ?: 'en-US',
        'voice_name' => $voiceName,
        'audio_encoding' => $audioEncoding,
        'speaking_rate' => $sr,
        'pitch' => $pitch,
    ]);

    $outDir = dirname(__DIR__, 2) . '/uploads/mystery';
    if (!is_dir($outDir)) @mkdir($outDir, 0775, true);

    $ext = ($audioEncoding === 'LINEAR16') ? 'wav' : 'mp3';
    $fileName = 'tts_interrogation_' . $scenarioId . '_' . $entityId . '_' . gmdate('Ymd_His') . '.' . $ext;
    file_put_contents($outDir . '/' . $fileName, (string)($ttsResp['audio_bytes'] ?? ''));

    return [
        'audio_url' => '/uploads/mystery/' . $fileName,
        'audio_encoding' => $audioEncoding,
        'tts_meta' => [
            'provider' => 'google_cloud_tts',
            'voice_id' => $voiceId,
            'language_code' => $languageCode,
            'voice_name' => $voiceName,
            'speaking_rate' => $sr,
            'pitch' => $pitch,
            'audio_encoding' => $audioEncoding,
            'audio_url' => '/uploads/mystery/' . $fileName,
        ]
    ];
}

/**
 * Logs the interrogation event and updates case notes.
 */
function catn8_interrogate_log_event(int $scenarioId, int $entityId, string $entityName, string $scenarioTitle, string $question, string $answerText, array $meta, string $audioUrl, string $provider): array {
    $metaJson = json_encode($meta, JSON_UNESCAPED_SLASHES);
    Database::execute(
        'INSERT INTO mystery_interrogation_events (scenario_id, entity_id, question_text, answer_text, meta_json) VALUES (?, ?, ?, ?, ?)',
        [$scenarioId, $entityId, $question, $answerText, $metaJson]
    );

    $erow = Database::queryOne('SELECT id, asked_at FROM mystery_interrogation_events WHERE scenario_id = ? ORDER BY id DESC LIMIT 1', [$scenarioId]);
    $eventId = (int)($erow['id'] ?? 0);
    $askedAt = (string)($erow['asked_at'] ?? '');

    $logTitle = 'Interrogation Log';
    $logType = 'detective_note';
    $noteRow = Database::queryOne('SELECT id, content_rich_json FROM mystery_case_notes WHERE scenario_id = ? AND title = ? AND note_type = ? LIMIT 1', [$scenarioId, $logTitle, $logType]);

    $rich = $noteRow ? json_decode((string)$noteRow['content_rich_json'], true) : [
        'blocks' => [['style' => 'typed', 'text' => 'INTERROGATION LOG'], ['style' => 'typed', 'text' => 'Scenario: ' . $scenarioTitle], ['style' => 'typed', 'text' => 'Entries appended automatically as interviews occur.']],
        'tags' => ['EVIDENCE', 'CHAIN-OF-CUSTODY'],
        'annotations' => [],
    ];

    $rich['blocks'][] = ['style' => 'typed', 'text' => '---'];
    $rich['blocks'][] = ['style' => 'typed', 'text' => 'Interview: ' . ($entityName ?: 'Unknown') . ' · ' . ($askedAt ?: gmdate('c'))];
    $rich['blocks'][] = ['style' => 'typed', 'text' => 'Q: ' . $question];
    $rich['blocks'][] = ['style' => 'typed', 'text' => 'A: ' . $answerText];
    if ($audioUrl) $rich['blocks'][] = ['style' => 'typed', 'text' => 'Audio: ' . $audioUrl];

    if ($noteRow) {
        Database::execute('UPDATE mystery_case_notes SET content_rich_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [json_encode($rich), (int)$noteRow['id']]);
    } else {
        Database::execute('INSERT INTO mystery_case_notes (scenario_id, title, note_type, content_rich_json, clue_count, is_archived) VALUES (?, ?, ?, ?, 0, 0)', [$scenarioId, $logTitle, $logType, json_encode($rich)]);
    }

    $convMetaUser = ['source' => 'interrogate', 'interrogation_event_id' => $eventId];
    Database::execute('INSERT INTO mystery_conversation_events (scenario_id, entity_id, channel, provider, role, content_text, meta_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [$scenarioId, $entityId, 'suspect_chat', $provider ?: 'unknown', 'user', $question, json_encode($convMetaUser)]
    );

    $sentences = preg_split('/(?<=[.!?])\s+/u', $answerText) ?: [$answerText];
    $trimmed = array_values(array_filter(array_map('trim', $sentences)));
    $count = count($trimmed);
    foreach ($trimmed as $i => $s) {
        $m = array_merge($convMetaUser, ['ai' => $meta['ai'], 'tts' => $meta['tts'] ?? [], 'sentence_index' => $i, 'sentence_count' => $count, 'content_kind' => 'sentence']);
        Database::execute('INSERT INTO mystery_conversation_events (scenario_id, entity_id, channel, provider, role, content_text, meta_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [$scenarioId, $entityId, 'suspect_chat', $provider ?: 'unknown', 'assistant', $s, json_encode($m)]
        );
    }

    return ['event_id' => $eventId, 'asked_at' => $askedAt];
}
