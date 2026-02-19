<?php
declare(strict_types=1);

if ($action === 'link_and_import_case_character_details_for_mystery') {
    catn8_mystery_require_admin($isAdmin);
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $mysteryId = (int)($body['mystery_id'] ?? 0);
    catn8_mystery_require_mystery($mysteryId, $viewerId, $isAdmin);

    $includeArchived = (int)($body['include_archived_cases'] ?? 0) === 1;
    $includeTemplate = (int)($body['include_template_cases'] ?? 0) === 1;

    $sql = 'SELECT id FROM mystery_games WHERE mystery_id = ?';
    $params = [$mysteryId];
    if (!$includeArchived) $sql .= ' AND is_archived = 0';
    if (!$includeTemplate) $sql .= ' AND is_template = 0';
    $cases = Database::queryAll($sql . ' ORDER BY id ASC', $params);

    $report = [
        'mystery_id' => $mysteryId, 'cases_scanned' => 0, 'entities_scanned' => 0,
        'entities_linked' => 0, 'masters_updated' => 0, 'masters_noop' => 0,
        'updated_fields_counts' => ['dob' => 0, 'age' => 0, 'hometown' => 0, 'height' => 0, 'distinguishing_marks' => 0, 'education' => 0],
        'cases' => []
    ];

    $findMasterBySlug = fn($mid, $slug) => Database::queryOne('SELECT id, slug, name FROM mystery_master_characters WHERE mystery_id = ? AND slug = ? AND is_archived = 0 LIMIT 1', [$mid, $slug]);
    $findUniqueMasterByName = function($mid, $name) {
        $rows = Database::queryAll('SELECT id, slug, name FROM mystery_master_characters WHERE mystery_id = ? AND name = ? AND is_archived = 0 LIMIT 2', [$mid, $name]);
        return count($rows) === 1 ? ['ok' => true, 'row' => $rows[0]] : ['ok' => false];
    };

    foreach ($cases as $cRow) {
        $caseId = (int)$cRow['id'];
        $report['cases_scanned']++;
        $entities = Database::queryAll("SELECT id, slug, name, data_json FROM mystery_entities WHERE game_id = ? AND entity_type = 'character' AND is_archived = 0", [$caseId]);
        
        foreach ($entities as $eRow) {
            $report['entities_scanned']++;
            $data = json_decode((string)$eRow['data_json'], true) ?: [];
            $mid = (int)($data['master_id'] ?? 0);
            $mslug = trim((string)($data['master_slug'] ?? ''));

            if ($mid <= 0 && $mslug === '') {
                $found = $findMasterBySlug($mysteryId, (string)$eRow['slug']) ?: $findUniqueMasterByName($mysteryId, (string)$eRow['name']);
                if (!empty($found['row'] ?? $found)) {
                    $row = $found['row'] ?? $found;
                    $data['master_id'] = $mid = (int)$row['id'];
                    $data['master_slug'] = $mslug = (string)$row['slug'];
                    Database::execute('UPDATE mystery_entities SET data_json = ? WHERE id = ?', [json_encode($data), (int)$eRow['id']]);
                    $report['entities_linked']++;
                }
            }

            if ($mid > 0) {
                $master = Database::queryOne('SELECT * FROM mystery_master_characters WHERE id = ?', [$mid]);
                if ($master) {
                    $sp = $data['static_profile'] ?? [];
                    $updates = []; $uParams = [];
                    $fields = ['dob' => 'dob', 'age' => 'age', 'hometown' => 'hometown', 'height' => 'height', 'marks' => 'distinguishing_marks', 'education' => 'education'];
                    foreach ($fields as $srcK => $dstK) {
                        $v = $sp['demographics'][$srcK] ?? $sp['appearance'][$srcK] ?? $sp['background'][$srcK] ?? '';
                        if ($v && empty($master[$dstK])) {
                            $updates[] = "$dstK = ?"; $uParams[] = $v; $report['updated_fields_counts'][$dstK === 'distinguishing_marks' ? 'marks' : $dstK]++;
                        }
                    }
                    if ($updates) {
                        $uParams[] = $mid;
                        Database::execute('UPDATE mystery_master_characters SET ' . implode(', ', $updates) . ' WHERE id = ?', $uParams);
                        $report['masters_updated']++;
                    } else { $report['masters_noop']++; }
                }
            }
        }
    }
    catn8_json_response(['success' => true, 'report' => $report]);
}
