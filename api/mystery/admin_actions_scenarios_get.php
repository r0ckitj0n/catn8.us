<?php
if ($action === 'get_scenario') {
    $catn8_require_csi_columns();
    $scenarioId = (int)($_GET['scenario_id'] ?? 0);
    $catn8_mystery_ensure_default_csi_detective($scenarioId);
    $row = $requireScenario($scenarioId);

    $murdererRows = Database::queryAll('SELECT entity_id FROM mystery_scenario_murderers WHERE scenario_id = ? ORDER BY id ASC', [$scenarioId]);
    $murdererIds = [];
    foreach ($murdererRows as $mr) {
        $eid = (int)($mr['entity_id'] ?? 0);
        if ($eid > 0) $murdererIds[] = $eid;
    }

    $specs = json_decode((string)($row['specs_json'] ?? '{}'), true);
    if (!is_array($specs)) $specs = [];
    $constraints = json_decode((string)($row['constraints_json'] ?? '{}'), true);
    if (!is_array($constraints)) $constraints = [];

    catn8_json_response(['success' => true, 'scenario' => [
        'id' => (int)($row['id'] ?? 0),
        'case_id' => (int)($row['game_id'] ?? 0),
        'backstory_id' => (int)($row['backstory_id'] ?? 0),
        'slug' => (string)($row['slug'] ?? ''),
        'title' => (string)($row['title'] ?? ''),
        'status' => (string)($row['status'] ?? 'draft'),
        'crime_scene_weapon' => (string)($row['crime_scene_weapon'] ?? ''),
        'crime_scene_motive' => (string)($row['crime_scene_motive'] ?? ''),
        'crime_scene_location' => (string)($row['crime_scene_location'] ?? ''),
        'crime_scene_location_id' => (int)($row['crime_scene_location_id'] ?? 0),
        'crime_scene_location_master_id' => (int)($row['crime_scene_location_master_id'] ?? 0),
        'csi_detective_entity_id' => (int)($row['csi_detective_entity_id'] ?? 0),
        'csi_report_text' => (string)($row['csi_report_text'] ?? ''),
        'csi_report_json' => json_decode((string)($row['csi_report_json'] ?? 'null'), true),
        'murderer_ids' => $murdererIds,
        'specs' => $specs,
        'constraints' => $constraints,
        'created_at' => (string)($row['created_at'] ?? ''),
        'updated_at' => (string)($row['updated_at'] ?? ''),
    ]]);
}
