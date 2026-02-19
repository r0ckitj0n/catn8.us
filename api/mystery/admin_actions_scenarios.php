<?php
/**
 * admin_actions_scenarios.php - Conductor for Scenario Admin Actions
 * VERSION: 2025-12-31-0510-FINAL
 */
declare(strict_types=1);

require_once __DIR__ . '/admin_functions.php';
require_once __DIR__ . '/admin_functions_scenarios.php';

if ($action === 'create_scenario') {
    require __DIR__ . '/admin_actions_scenarios_create.php';
}
if ($action === 'ensure_default_scenario_for_case') {
    require __DIR__ . '/admin_actions_scenarios_bootstrap.php';
}
if ($action === 'get_scenario') {
    require __DIR__ . '/admin_actions_scenarios_get.php';
}
if ($action === 'update_scenario') {
    require __DIR__ . '/admin_actions_scenarios_update.php';
}
if ($action === 'generate_scenario_csi_report' || $action === 'save_scenario_csi_report') {
    require __DIR__ . '/admin_actions_scenarios_csi.php';
}

if ($action === 'reassign_scenario_case') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $scenarioId = (int)($body['scenario_id'] ?? 0);
    $newCaseId = (int)($body['case_id'] ?? 0);
    if ($scenarioId <= 0 || $newCaseId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'scenario_id and case_id are required'], 400);
    }

    $existing = $requireScenario($scenarioId);
    $requireCase($newCaseId);

    $currentCaseId = (int)($existing['game_id'] ?? 0);
    if ($currentCaseId === $newCaseId) {
        catn8_json_response(['success' => true, 'changed' => 0]);
    }

    $slug = trim((string)($existing['slug'] ?? ''));
    if ($slug !== '') {
        $slug = catn8_mystery_unique_slug($slug, static function (string $candidate) use ($newCaseId, $scenarioId): bool {
            return Database::queryOne(
                'SELECT id FROM mystery_scenarios WHERE game_id = ? AND slug = ? AND id <> ? LIMIT 1',
                [$newCaseId, $candidate, $scenarioId]
            ) !== null;
        });
    }

    Database::execute(
        'UPDATE mystery_scenarios SET game_id = ?, slug = ? WHERE id = ?',
        [$newCaseId, $slug, $scenarioId]
    );
    catn8_json_response(['success' => true, 'changed' => 1]);
}

if ($action === 'delete_scenario') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $requireScenario($id);
    Database::execute('DELETE FROM mystery_scenarios WHERE id = ?', [$id]);
    catn8_json_response(['success' => true]);
}
