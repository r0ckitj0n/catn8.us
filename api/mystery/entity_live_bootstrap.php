<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/live_functions.php';

catn8_session_start();
$viewerId = catn8_require_group_or_admin('mystery-game-users');
$isAdmin = catn8_user_is_admin($viewerId);
catn8_require_method('GET');

catn8_rate_limit_require('mystery.entity_live_bootstrap.' . $viewerId, 30, 600);

$scenarioId = (int)($_GET['scenario_id'] ?? 0);
$entityId = (int)($_GET['entity_id'] ?? 0);

if ($scenarioId <= 0 || $entityId <= 0) {
    catn8_json_response(['success' => false, 'error' => 'Invalid request parameters'], 400);
}

try {
    // 1. Load scenario and case info
    $scenarioRow = Database::queryOne(
        'SELECT s.id, s.game_id, s.title, s.specs_json, g.owner_user_id, g.mystery_id
         FROM mystery_scenarios s
         INNER JOIN mystery_games g ON g.id = s.game_id
         WHERE s.id = ?
         LIMIT 1',
        [$scenarioId]
    );
    if (!$scenarioRow) {
        catn8_json_response(['success' => false, 'error' => 'Scenario not found'], 404);
    }

    if (!$isAdmin && (int)($scenarioRow['owner_user_id'] ?? 0) !== $viewerId) {
        catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
    }

    $mysteryId = (int)($scenarioRow['mystery_id'] ?? 0);
    $caseId = (int)($scenarioRow['game_id'] ?? 0);

    // 2. Load merged settings
    $settings = catn8_mystery_load_merged_settings($mysteryId, $caseId, $viewerId);

    // 3. Load entity and override
    $entityRow = Database::queryOne(
        'SELECT id, game_id, entity_type, slug, name, data_json FROM mystery_entities WHERE id = ? LIMIT 1',
        [$entityId]
    );
    if (!$entityRow || (int)($entityRow['game_id'] ?? 0) !== $caseId) {
        catn8_json_response(['success' => false, 'error' => 'Entity not found or mismatch'], 404);
    }

    $seRow = Database::queryOne(
        'SELECT role, override_json FROM mystery_scenario_entities WHERE scenario_id = ? AND entity_id = ? LIMIT 1',
        [$scenarioId, $entityId]
    );
    if (!$seRow) {
        catn8_json_response(['success' => false, 'error' => 'Entity is not attached to this scenario'], 404);
    }

    $entityData = json_decode((string)($entityRow['data_json'] ?? '{}'), true) ?: [];
    $override = json_decode((string)($seRow['override_json'] ?? '{}'), true) ?: [];
    
    require_once __DIR__ . '/interrogate_functions.php';
    $mergedEntity = catn8_interrogate_merge_deep($entityData, $override);
    $profile = $mergedEntity['static_profile'] ?? [];
    $role = trim((string)($seRow['role'] ?? ''));

    // 4. Enrich profile from master character if needed
    $masterId = (int)($mergedEntity['master_id'] ?? 0);
    $masterSlug = trim((string)($mergedEntity['master_slug'] ?? ''));
    if ($masterId > 0 || $masterSlug !== '') {
        $masterRow = $masterId > 0 
            ? Database::queryOne('SELECT * FROM mystery_master_characters WHERE mystery_id = ? AND id = ? LIMIT 1', [$mysteryId, $masterId])
            : Database::queryOne('SELECT * FROM mystery_master_characters WHERE mystery_id = ? AND slug = ? LIMIT 1', [$mysteryId, $masterSlug]);

        if ($masterRow) {
            if (!isset($profile['demographics'])) $profile['demographics'] = [];
            if (!isset($profile['appearance'])) $profile['appearance'] = [];
            if (!isset($profile['background'])) $profile['background'] = [];

            if ($addr = trim((string)($masterRow['address'] ?? ''))) $profile['demographics']['address'] = $addr;
            if ($wt = trim((string)($masterRow['weight'] ?? ''))) $profile['appearance']['weight'] = $wt;
            if ($ec = trim((string)($masterRow['eye_color'] ?? ''))) $profile['appearance']['eye_color'] = $ec;
            if ($hc = trim((string)($masterRow['hair_color'] ?? ''))) $profile['appearance']['hair_color'] = $hc;
            
            $aliases = json_decode((string)($masterRow['aliases_json'] ?? '[]'), true);
            if (is_array($aliases) && $aliases) {
                $profile['background']['aliases'] = array_values(array_filter(array_map('trim', array_map('strval', $aliases))));
            }
        }
    }

    // 5. Load lies
    $lies = Database::queryAll(
        'SELECT lie_type, topic_key, lie_text, truth_text, trigger_questions_json, relevance, notes
         FROM mystery_scenario_lies
         WHERE scenario_id = ? AND entity_id = ?
         ORDER BY id ASC',
        [$scenarioId, $entityId]
    );
    $liePack = [];
    foreach ($lies as $r) {
        $liePack[] = [
            'lie_type' => (string)($r['lie_type'] ?? ''),
            'topic_key' => (string)($r['topic_key'] ?? ''),
            'lie_text' => (string)($r['lie_text'] ?? ''),
            'truth_text' => '',
            'trigger_questions' => json_decode((string)($r['trigger_questions_json'] ?? '[]'), true) ?: [],
            'relevance' => (string)($r['relevance'] ?? ''),
            'notes' => (string)($r['notes'] ?? ''),
        ];
    }

    // 6. Build system instruction
    $liveSettings = $settings['suspect_live'] ?? [];
    $model = trim((string)($liveSettings['model'] ?? 'gemini-2.5-flash-native-audio-preview-12-2025'));
    $baseInstruction = (string)($liveSettings['system_instruction'] ?? 'You are roleplaying as a character in a murder investigation. Stay in character.');

    $systemInstruction = trim(
        $baseInstruction . "\n\n" .
        'Scenario: ' . (string)$scenarioRow['title'] . "\n" .
        'You are: ' . (string)$entityRow['name'] . "\n" .
        'Role: ' . $role . "\n\n" .
        'Character Profile JSON:' . "\n" . json_encode($profile, JSON_UNESCAPED_SLASHES) . "\n\n" .
        'Lie Pack JSON:' . "\n" . json_encode($liePack, JSON_UNESCAPED_SLASHES)
    );

    // 7. Get Gemini token
    $token = catn8_mystery_gemini_live_token($model, $systemInstruction);

    catn8_json_response([
        'success' => true,
        'model' => $model,
        'entity_id' => $entityId,
        'role' => $role,
        'system_instruction' => $systemInstruction,
        'token' => $token,
    ]);

} catch (Throwable $e) {
    catn8_log_error('Entity live bootstrap failed', ['message' => $e->getMessage()]);
    catn8_json_response(['success' => false, 'error' => $e->getMessage()], $e->getCode() ?: 500);
}
