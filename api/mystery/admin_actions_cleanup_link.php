<?php
declare(strict_types=1);

if ($action === 'link_case_characters_to_master') {
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
        'entities_updated' => 0,
        'linked_by' => ['by_master_id' => 0, 'by_master_slug' => 0, 'by_case_slug' => 0, 'by_name' => 0],
        'unmatched' => [],
        'ambiguous' => [],
    ];

    $findMasterBySlug = static function (int $mysteryId, string $slug): ?array {
        if ($slug === '') return null;
        $row = Database::queryOne(
            'SELECT id, slug, name FROM mystery_master_characters WHERE mystery_id = ? AND slug = ? AND is_archived = 0 LIMIT 1',
            [$mysteryId, $slug]
        );
        return $row ? $row : null;
    };

    $findUniqueMasterByName = static function (int $mysteryId, string $name): array {
        $name = trim($name);
        if ($name === '') return ['ok' => false, 'row' => null, 'count' => 0];
        $rows2 = Database::queryAll(
            'SELECT id, slug, name FROM mystery_master_characters WHERE mystery_id = ? AND name = ? AND is_archived = 0 ORDER BY id ASC LIMIT 3',
            [$mysteryId, $name]
        );
        $n = count($rows2);
        if ($n === 1) return ['ok' => true, 'row' => $rows2[0], 'count' => 1];
        return ['ok' => false, 'row' => null, 'count' => $n];
    };

    foreach ($rows as $r) {
        $report['entities_scanned'] += 1;
        $eid = (int)($r['id'] ?? 0);
        if ($eid <= 0) continue;
        $caseSlug = trim((string)($r['slug'] ?? ''));
        $caseName = trim((string)($r['name'] ?? ''));

        $data = json_decode((string)($r['data_json'] ?? '{}'), true);
        if (!is_array($data)) $data = [];

        $masterId = (int)($data['master_id'] ?? 0);
        $masterSlug = trim((string)($data['master_slug'] ?? ''));
        if ($masterId > 0 || $masterSlug !== '') {
            if ($masterId > 0) $report['linked_by']['by_master_id'] += 1;
            else $report['linked_by']['by_master_slug'] += 1;
            continue;
        }

        $masterRow = null;
        $linkedBy = '';

        if ($caseSlug !== '') {
            $masterRow = $findMasterBySlug($mysteryId, $caseSlug);
            if ($masterRow) $linkedBy = 'by_case_slug';
        }

        if (!$masterRow && $caseName !== '') {
            $res = $findUniqueMasterByName($mysteryId, $caseName);
            if (($res['count'] ?? 0) > 1) {
                if (count($report['ambiguous']) < 50) {
                    $report['ambiguous'][] = ['entity_id' => $eid, 'case_slug' => $caseSlug, 'case_name' => $caseName, 'master_name_matches' => (int)($res['count'] ?? 0)];
                }
            } elseif (($res['ok'] ?? false) && is_array($res['row'])) {
                $masterRow = $res['row'];
                $linkedBy = 'by_name';
            }
        }

        if (!$masterRow) {
            if (count($report['unmatched']) < 50) {
                $report['unmatched'][] = ['entity_id' => $eid, 'case_slug' => $caseSlug, 'case_name' => $caseName];
            }
            continue;
        }

        $data['master_id'] = (int)($masterRow['id'] ?? 0);
        $data['master_slug'] = (string)($masterRow['slug'] ?? '');
        $json = json_encode($data, JSON_UNESCAPED_SLASHES);
        if (!is_string($json)) continue;

        Database::execute(
            'UPDATE mystery_entities SET data_json = ? WHERE id = ? AND game_id = ? AND entity_type = ? AND is_archived = 0',
            [$json, $eid, $caseId, 'character']
        );
        $report['entities_updated'] += 1;
        if ($linkedBy !== '' && isset($report['linked_by'][$linkedBy])) {
            $report['linked_by'][$linkedBy] += 1;
        }
    }

    catn8_json_response(['success' => true, 'report' => $report]);
}
