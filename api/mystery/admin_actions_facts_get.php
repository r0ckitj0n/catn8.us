<?php
if ($action === 'get_scenario_cold_hard_facts') {
    $scenarioId = (int)($_GET['scenario_id'] ?? 0);
    $requireScenario($scenarioId);

    $row = Database::queryOne(
        'SELECT id, scenario_id, cold_hard_facts_text, annotations_json, updated_at FROM mystery_scenario_cold_hard_facts WHERE scenario_id = ?',
        [$scenarioId]
    );
    if (!$row) {
        Database::execute(
            'INSERT IGNORE INTO mystery_scenario_cold_hard_facts (scenario_id, cold_hard_facts_text, annotations_json) VALUES (?, ?, ?)',
            [$scenarioId, '', json_encode(new stdClass())]
        );
        $row = Database::queryOne(
            'SELECT id, scenario_id, cold_hard_facts_text, annotations_json, updated_at FROM mystery_scenario_cold_hard_facts WHERE scenario_id = ?',
            [$scenarioId]
        );
    }

    $annotations = json_decode((string)($row['annotations_json'] ?? '[]'), true);
    if (!is_array($annotations)) {
        $annotations = [];
    }

    catn8_json_response([
        'success' => true,
        'scenario_id' => $scenarioId,
        'cold_hard_facts' => [
            'id' => (int)($row['id'] ?? 0),
            'cold_hard_facts_text' => (string)($row['cold_hard_facts_text'] ?? ''),
            'annotations' => $annotations,
            'updated_at' => $row['updated_at'] ?? null,
        ],
    ]);
}
