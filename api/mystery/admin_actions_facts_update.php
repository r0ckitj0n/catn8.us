<?php
if ($action === 'update_scenario_cold_hard_facts') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $scenarioId = (int)($body['scenario_id'] ?? 0);
    $requireScenario($scenarioId);

    $coldHardFactsText = (string)($body['cold_hard_facts_text'] ?? '');
    $annotations = $body['annotations'] ?? [];
    if (!is_array($annotations)) {
        catn8_json_response(['success' => false, 'error' => 'annotations must be an array'], 400);
    }

    $annotationsJson = json_encode($annotations, JSON_UNESCAPED_SLASHES);
    if (!is_string($annotationsJson)) {
        $annotationsJson = json_encode([]);
    }

    Database::execute(
        'INSERT IGNORE INTO mystery_scenario_cold_hard_facts (scenario_id, cold_hard_facts_text, annotations_json) VALUES (?, ?, ?)',
        [$scenarioId, '', json_encode([])]
    );
    Database::execute(
        'UPDATE mystery_scenario_cold_hard_facts SET cold_hard_facts_text = ?, annotations_json = ? WHERE scenario_id = ?',
        [$coldHardFactsText, $annotationsJson, $scenarioId]
    );

    $row = Database::queryOne('SELECT id, updated_at FROM mystery_scenario_cold_hard_facts WHERE scenario_id = ?', [$scenarioId]);
    catn8_json_response([
        'success' => true,
        'scenario_id' => $scenarioId,
        'id' => (int)($row['id'] ?? 0),
        'updated_at' => $row['updated_at'] ?? null,
    ]);
}
