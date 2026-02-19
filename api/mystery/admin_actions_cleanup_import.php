<?php
declare(strict_types=1);

if ($action === 'import_case_character_details_to_master') {
    catn8_mystery_require_admin($isAdmin);
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $caseId = (int)($body['case_id'] ?? 0);
    $case = catn8_mystery_require_case($caseId, $viewerId, $isAdmin);
    $mysteryId = (int)($case['mystery_id'] ?? 0);
    catn8_mystery_require_mystery($mysteryId, $viewerId, $isAdmin);

    $rows = Database::queryAll(
        "SELECT id, slug, name, data_json FROM mystery_entities WHERE game_id = ? AND entity_type = 'character' AND is_archived = 0 ORDER BY id ASC",
        [$caseId]
    );

    $report = [
        'case_id' => $caseId,
        'mystery_id' => $mysteryId,
        'entities_scanned' => 0,
        'entities_skipped_unlinked' => 0,
        'masters_updated' => 0,
        'masters_noop' => 0,
        'updated_fields_counts' => [
            'dob' => 0, 'age' => 0, 'hometown' => 0, 'height' => 0,
            'distinguishing_marks' => 0, 'education' => 0,
            'employment' => 0, 'criminal_record' => 0,
        ],
        'skipped' => [],
    ];

    $safeStr = fn($v) => is_scalar($v) ? trim((string)$v) : '';

    foreach ($rows as $r) {
        $report['entities_scanned']++;
        $eid = (int)$r['id'];
        $data = json_decode((string)$r['data_json'], true) ?: [];
        $mid = (int)($data['master_id'] ?? 0);
        $mslug = trim((string)($data['master_slug'] ?? ''));

        if ($mid <= 0 && $mslug === '') {
            $report['entities_skipped_unlinked']++;
            continue;
        }

        $masterRow = Database::queryOne('SELECT * FROM mystery_master_characters WHERE mystery_id = ? AND (id = ? OR slug = ?) LIMIT 1', [$mysteryId, $mid, $mslug]);
        if (!$masterRow) continue;

        $sp = $data['static_profile'] ?? [];
        $demo = $sp['demographics'] ?? [];
        $app = $sp['appearance'] ?? [];
        $bg = $sp['background'] ?? [];

        $updates = []; $params = [];

        $srcDob = $safeStr($demo['dob'] ?? $demo['date_of_birth'] ?? '');
        if ($srcDob !== '' && empty($masterRow['dob'])) {
            $dt = date_create($srcDob);
            if ($dt) { $updates[] = 'dob = ?'; $params[] = $dt->format('Y-m-d'); $report['updated_fields_counts']['dob']++; }
        }

        $srcAge = (int)($demo['age'] ?? 0);
        if ($srcAge > 0 && (int)($masterRow['age'] ?? 0) <= 0) {
            $updates[] = 'age = ?'; $params[] = $srcAge; $report['updated_fields_counts']['age']++;
        }

        $srcHome = $safeStr($demo['hometown'] ?? $bg['hometown'] ?? '');
        if ($srcHome !== '' && empty($masterRow['hometown'])) {
            $updates[] = 'hometown = ?'; $params[] = $srcHome; $report['updated_fields_counts']['hometown']++;
        }

        $srcHeight = $safeStr($app['height'] ?? '');
        if ($srcHeight !== '' && empty($masterRow['height'])) {
            $updates[] = 'height = ?'; $params[] = $srcHeight; $report['updated_fields_counts']['height']++;
        }

        $srcMarks = $safeStr($app['distinguishing_marks'] ?? $app['marks'] ?? $bg['distinguishing_marks'] ?? '');
        if ($srcMarks !== '' && empty($masterRow['distinguishing_marks'])) {
            $updates[] = 'distinguishing_marks = ?'; $params[] = $srcMarks; $report['updated_fields_counts']['distinguishing_marks']++;
        }

        $srcEdu = $safeStr($bg['education'] ?? $demo['education'] ?? '');
        if ($srcEdu !== '' && empty($masterRow['education'])) {
            $updates[] = 'education = ?'; $params[] = $srcEdu; $report['updated_fields_counts']['education']++;
        }

        if (empty($updates)) { $report['masters_noop']++; continue; }

        $params[] = (int)$masterRow['id']; $params[] = $mysteryId;
        Database::execute('UPDATE mystery_master_characters SET ' . implode(', ', $updates) . ' WHERE id = ? AND mystery_id = ?', $params);
        $report['masters_updated']++;
    }

    catn8_json_response(['success' => true, 'report' => $report]);
}
