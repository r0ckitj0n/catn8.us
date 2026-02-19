<?php
/**
 * admin_actions_scenarios_csi.php - CSI Report Actions
 */
declare(strict_types=1);

if ($action === 'generate_scenario_csi_report') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $scenarioId = (int)($body['scenario_id'] ?? 0);
    
    if ($scenarioId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'scenario_id is required'], 400);
    }

    require_once __DIR__ . '/admin_functions_csi.php';
    
    try {
        $result = catn8_mystery_generate_csi_report($scenarioId);
        catn8_json_response($result);
    } catch (Throwable $e) {
        catn8_json_response(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($action === 'save_scenario_csi_report') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $scenarioId = (int)($body['scenario_id'] ?? 0);
    $reportText = trim((string)($body['report_text'] ?? ''));
    $reportJson = $body['report_json'] ?? null;

    if ($scenarioId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'scenario_id is required'], 400);
    }

    Database::execute(
        'UPDATE mystery_scenarios SET csi_report_text = ?, csi_report_json = ? WHERE id = ?',
        [$reportText, is_string($reportJson) ? $reportJson : json_encode($reportJson), $scenarioId]
    );

    catn8_json_response(['success' => true]);
}
