<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../includes/google_cloud_tts.php';
require_once __DIR__ . '/../../includes/vertex_ai_gemini.php';
require_once __DIR__ . '/interrogate_functions.php';

catn8_session_start();
catn8_log_error('Interrogate API called', ['method' => $_SERVER['REQUEST_METHOD']]);

if (!class_exists('OpenAI')) {
    catn8_log_error('OpenAI class not found in interrogate.php');
}

$viewerId = catn8_require_group_or_admin('mystery-game-users');
$isAdmin = catn8_user_is_admin($viewerId);
catn8_require_method('POST');

catn8_rate_limit_require('mystery.interrogate.' . $viewerId, 60, 600);

$body = catn8_read_json_body();

$scenarioId = (int)($body['scenario_id'] ?? 0);
$entityId = (int)($body['entity_id'] ?? 0);
$question = catn8_ai_sanitize_user_text((string)($body['question_text'] ?? ''), 2000);
$ttsEnabled = (int)($body['tts_enabled'] ?? 1) ? 1 : 0;

if ($scenarioId <= 0 || $entityId <= 0 || $question === '') {
    catn8_json_response(['success' => false, 'error' => 'Invalid request parameters'], 400);
}

try {
    // 1. Load state
    $state = catn8_interrogate_load_state($scenarioId, $entityId, $viewerId, $isAdmin);
    
    // 2. Load AI config
    $aiCfg = catn8_mystery_get_ai_config();
    
    // 3. Build prompts
    $systemPrompt = trim(
        'You are roleplaying as a suspect in a murder investigation.' . "\n" .
        'Stay in character as the person described.' . "\n" .
        'Answer as a human would in an interrogation room. Keep answers concise and natural.' . "\n" .
        'If a lie is relevant to the detective\'s question, you must respond with the lie_text for that topic. Otherwise, tell the truth.' . "\n\n" .
        'Scenario: ' . $state['scenario_title'] . "\n" .
        'Character name: ' . $state['entity_name'] . "\n\n" .
        'Character Profile JSON:' . "\n" . json_encode($state['profile'], JSON_UNESCAPED_SLASHES) . "\n\n" .
        'Lie Pack JSON:' . "\n" . json_encode($state['lie_pack'], JSON_UNESCAPED_SLASHES)
    );
    $userPrompt = "Detective question: " . $question;

    // 4. Generate answer
    $gen = catn8_interrogate_generate_answer($aiCfg, $systemPrompt, $userPrompt);
    $answerText = $gen['answer_text'];
    $aiMeta = $gen['ai_meta'];

    // 5. Synthesize TTS if enabled
    $audioUrl = '';
    $audioEncoding = '';
    $ttsMeta = [];
    $ttsError = '';
    
    if ($ttsEnabled) {
        $tts = catn8_interrogate_synth_tts($scenarioId, $entityId, $answerText, $state['voice_id'], $viewerId);
        $audioUrl = $tts['audio_url'];
        $audioEncoding = $tts['audio_encoding'];
        $ttsMeta = $tts['tts_meta'];
        $ttsError = $tts['tts_error'] ?? '';
    }

    // 6. Log event and update notes
    $meta = [
        'ai' => $aiMeta,
        'tts' => $ttsMeta,
    ];
    if ($ttsError) $meta['tts_error'] = $ttsError;

    $log = catn8_interrogate_log_event(
        $scenarioId, 
        $entityId, 
        $state['entity_name'], 
        $state['scenario_title'], 
        $question, 
        $answerText, 
        $meta, 
        $audioUrl, 
        $aiMeta['provider']
    );

    catn8_json_response([
        'success' => true,
        'event_id' => $log['event_id'],
        'asked_at' => $log['asked_at'],
        'answer_text' => $answerText,
        'audio_url' => $audioUrl,
        'audio_encoding' => $audioEncoding,
        'meta' => $meta,
    ]);

} catch (Throwable $e) {
    catn8_log_error('Interrogation failed', [
        'scenario_id' => $scenarioId,
        'entity_id' => $entityId,
        'message' => $e->getMessage(),
    ]);
    $code = $e->getCode() ?: 500;
    catn8_json_response(['success' => false, 'error' => $e->getMessage()], is_int($code) && $code >= 400 && $code < 600 ? $code : 500);
}
