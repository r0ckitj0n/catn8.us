<?php
if ($action === 'ai_prompt_preview') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $jobAction = strtolower(trim((string)($body['action'] ?? '')));
    $caseId = isset($body['case_id']) ? (int)($body['case_id'] ?? 0) : 0;
    $scenarioId = isset($body['scenario_id']) ? (int)($body['scenario_id'] ?? 0) : 0;
    $entityId = isset($body['entity_id']) ? (int)($body['entity_id'] ?? 0) : 0;
    $spec = $body['spec'] ?? [];

    if ($jobAction === '') {
        catn8_json_response(['success' => false, 'error' => 'action is required'], 400);
    }
    if (!is_array($spec)) {
        catn8_json_response(['success' => false, 'error' => 'spec must be an object'], 400);
    }

    if ($caseId > 0) {
        $requireCase($caseId);
    }
    if ($scenarioId > 0) {
        $scenario = $requireScenario($scenarioId);
        if ($caseId > 0 && (int)($scenario['game_id'] ?? 0) !== $caseId) {
            catn8_json_response(['success' => false, 'error' => 'Scenario does not belong to this case'], 400);
        }
        if ($caseId <= 0) {
            $caseId = (int)($scenario['game_id'] ?? 0);
            if ($caseId > 0) {
                $requireCase($caseId);
            }
        }
    }
    if ($entityId > 0) {
        $entity = $requireEntity($entityId);
        if ($caseId > 0 && (int)($entity['game_id'] ?? 0) !== $caseId) {
            catn8_json_response(['success' => false, 'error' => 'Entity does not belong to this case'], 400);
        }
    }

    $aiCfg = catn8_mystery_get_ai_config();
    $provider = $aiCfg['provider'];
    $model = $aiCfg['model'];
    $systemPrompt = trim((string)($aiCfg['system_prompt'] ?? ''));

    if ($jobAction === 'generate_story_narrative') {
        require __DIR__ . '/admin_actions_jobs_preview_story.php';
    }
    if ($jobAction === 'generate_briefing') {
        require __DIR__ . '/admin_actions_jobs_preview_briefing.php';
    }
    if ($jobAction === 'generate_evidence') {
        require __DIR__ . '/admin_actions_jobs_preview_evidence.php';
    }
    if ($jobAction === 'generate_deposition') {
        require __DIR__ . '/admin_actions_jobs_preview_deposition.php';
    }

    catn8_json_response([
        'success' => false,
        'error' => 'No AI prompt preview is available for action: ' . $jobAction,
    ], 400);
}
