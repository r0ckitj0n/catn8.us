<?php
declare(strict_types=1);

if ($action === 'cleanup_case_character_master_only_fields') {
    catn8_mystery_require_admin($isAdmin);
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $caseId = (int)($body['case_id'] ?? 0);
    $case = catn8_mystery_require_case($caseId, $viewerId, $isAdmin);
    $mysteryId = (int)($case['mystery_id'] ?? 0);
    catn8_mystery_require_mystery($mysteryId, $viewerId, $isAdmin);

    $rows = Database::queryAll(
        "SELECT id, data_json FROM mystery_entities WHERE game_id = ? AND entity_type = 'character' AND is_archived = 0",
        [$caseId]
    );
    $updated = 0;
    $scanned = 0;

    foreach ($rows as $r) {
        $scanned += 1;
        $eid = (int)($r['id'] ?? 0);
        if ($eid <= 0) continue;
        $data = json_decode((string)($r['data_json'] ?? '{}'), true);
        if (!is_array($data)) continue;

        $before = json_encode($data, JSON_UNESCAPED_SLASHES);

        if (isset($data['static_profile']) && is_array($data['static_profile'])) {
            if (isset($data['static_profile']['demographics']) && is_array($data['static_profile']['demographics'])) {
                unset($data['static_profile']['demographics']['address']);
            }
            if (isset($data['static_profile']['appearance']) && is_array($data['static_profile']['appearance'])) {
                unset($data['static_profile']['appearance']['weight']);
                unset($data['static_profile']['appearance']['eye_color']);
                unset($data['static_profile']['appearance']['hair_color']);
                unset($data['static_profile']['appearance']['hair']);
            }
            if (isset($data['static_profile']['background']) && is_array($data['static_profile']['background'])) {
                unset($data['static_profile']['background']['aliases']);
            }
        }

        $after = json_encode($data, JSON_UNESCAPED_SLASHES);
        if (!is_string($before) || !is_string($after) || $before === $after) {
            continue;
        }

        Database::execute('UPDATE mystery_entities SET data_json = ? WHERE id = ? AND game_id = ?', [$after, $eid, $caseId]);
        $updated += 1;
    }

    catn8_json_response(['success' => true, 'case_id' => $caseId, 'scanned' => $scanned, 'updated' => $updated]);
}
