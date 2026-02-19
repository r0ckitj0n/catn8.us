<?php
declare(strict_types=1);

if ($action === 'cleanup_master_only_fields_for_mystery') {
    catn8_mystery_require_admin($isAdmin);
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $mysteryId = (int)($body['mystery_id'] ?? 0);
    catn8_mystery_require_mystery($mysteryId, $viewerId, $isAdmin);

    $includeArchivedCases = (int)($body['include_archived_cases'] ?? 0) === 1;
    $includeTemplateCases = (int)($body['include_template_cases'] ?? 0) === 1;

    $sql = 'SELECT id FROM mystery_games WHERE mystery_id = ?';
    $params = [$mysteryId];
    if (!$includeArchivedCases) $sql .= ' AND is_archived = 0';
    if (!$includeTemplateCases) $sql .= ' AND is_template = 0';
    $sql .= ' ORDER BY id ASC';

    $cases = Database::queryAll($sql, $params);
    $auditKeys = ['address', 'aliases', 'eye_color', 'weight', 'hair_color', 'hair'];

    $report = [
        'mystery_id' => $mysteryId,
        'cases_scanned' => 0, 'cases_updated' => 0,
        'entities_scanned' => 0, 'entities_updated' => 0,
        'include_archived_cases' => $includeArchivedCases ? 1 : 0,
        'include_template_cases' => $includeTemplateCases ? 1 : 0,
        'cases' => [],
    ];

    foreach ($cases as $caseRow) {
        $caseId = (int)($caseRow['id'] ?? 0);
        if ($caseId <= 0) continue;
        $report['cases_scanned'] += 1;

        $rows = Database::queryAll(
            "SELECT id, data_json FROM mystery_entities WHERE game_id = ? AND entity_type = 'character' AND is_archived = 0",
            [$caseId]
        );

        $scanned = 0; $updated = 0;
        foreach ($rows as $r) {
            $scanned += 1;
            $eid = (int)($r['id'] ?? 0);
            $data = json_decode((string)($r['data_json'] ?? '{}'), true);
            if (!is_array($data)) continue;

            $before = json_encode($data, JSON_UNESCAPED_SLASHES);
            if (isset($data['static_profile']) && is_array($data['static_profile'])) {
                if (isset($data['static_profile']['demographics'])) unset($data['static_profile']['demographics']['address']);
                if (isset($data['static_profile']['appearance'])) {
                    unset($data['static_profile']['appearance']['weight'], $data['static_profile']['appearance']['eye_color'], $data['static_profile']['appearance']['hair_color'], $data['static_profile']['appearance']['hair']);
                }
                if (isset($data['static_profile']['background'])) unset($data['static_profile']['background']['aliases']);
            }

            $after = json_encode($data, JSON_UNESCAPED_SLASHES);
            if ($before !== $after) {
                Database::execute('UPDATE mystery_entities SET data_json = ? WHERE id = ? AND game_id = ?', [$after, $eid, $caseId]);
                $updated += 1;
            }
        }

        $report['entities_scanned'] += $scanned;
        $report['entities_updated'] += $updated;
        if ($updated > 0) $report['cases_updated'] += 1;
        $report['cases'][] = ['case_id' => $caseId, 'entities_scanned' => $scanned, 'entities_updated' => $updated];
    }

    catn8_json_response(['success' => true, 'report' => $report]);
}
