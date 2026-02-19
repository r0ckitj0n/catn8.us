<?php
if ($action === 'update_scenario') {
    $catn8_require_csi_columns();
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $existing = $requireScenario($id);

    $slugInput = trim((string)($body['slug'] ?? ''));
    $slug = trim((string)($existing['slug'] ?? ''));
    $title = trim((string)($body['title'] ?? $existing['title'] ?? ''));
    $status = trim((string)($body['status'] ?? $existing['status'] ?? 'draft'));

    if ($title === '') {
        catn8_json_response(['success' => false, 'error' => 'Title is required'], 400);
    }

    if ($slugInput !== '') {
        $caseId = (int)($existing['game_id'] ?? 0);
        $slug = catn8_mystery_unique_slug($slugInput, static function (string $candidate) use ($caseId, $id): bool {
            return Database::queryOne(
                'SELECT id FROM mystery_scenarios WHERE game_id = ? AND slug = ? AND id <> ? LIMIT 1',
                [$caseId, $candidate, $id]
            ) !== null;
        });
    }

    $specs = $body['specs'] ?? null;
    if ($specs !== null && !is_array($specs)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid specs'], 400);
    }

    $constraints = $body['constraints'] ?? null;
    if ($constraints !== null && !is_array($constraints)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid constraints'], 400);
    }

    $crimeWeapon = $body['crime_scene_weapon'] ?? null;
    if ($crimeWeapon !== null && !is_string($crimeWeapon)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid crime_scene_weapon'], 400);
    }
    $crimeMotive = $body['crime_scene_motive'] ?? null;
    if ($crimeMotive !== null && !is_string($crimeMotive)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid crime_scene_motive'], 400);
    }
    $crimeLocation = $body['crime_scene_location'] ?? null;
    if ($crimeLocation !== null && !is_string($crimeLocation)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid crime_scene_location'], 400);
    }

    $crimeLocationId = $body['crime_scene_location_id'] ?? null;
    if ($crimeLocationId !== null && $crimeLocationId !== '' && !is_int($crimeLocationId) && !is_numeric($crimeLocationId)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid crime_scene_location_id'], 400);
    }

    $crimeLocationMasterId = $body['crime_scene_location_master_id'] ?? null;
    if ($crimeLocationMasterId !== null && $crimeLocationMasterId !== '' && !is_int($crimeLocationMasterId) && !is_numeric($crimeLocationMasterId)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid crime_scene_location_master_id'], 400);
    }

    $csiDetectiveEntityId = $body['csi_detective_entity_id'] ?? null;
    if ($csiDetectiveEntityId !== null && $csiDetectiveEntityId !== '' && !is_int($csiDetectiveEntityId) && !is_numeric($csiDetectiveEntityId)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid csi_detective_entity_id'], 400);
    }

    $csiReportText = $body['csi_report_text'] ?? null;
    if ($csiReportText !== null && !is_string($csiReportText)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid csi_report_text'], 400);
    }

    $csiReportJson = $body['csi_report_json'] ?? null;
    if ($csiReportJson !== null && !is_array($csiReportJson)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid csi_report_json'], 400);
    }
    $murdererIdsInput = $body['murderer_ids'] ?? null;
    if ($murdererIdsInput !== null && !is_array($murdererIdsInput)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid murderer_ids'], 400);
    }

    $specsJson = ($specs !== null) ? json_encode($specs) : (string)($existing['specs_json'] ?? '{}');
    $constraintsJson = ($constraints !== null) ? json_encode($constraints) : (string)($existing['constraints_json'] ?? '{}');

    $nextWeapon = ($crimeWeapon !== null) ? trim((string)$crimeWeapon) : (string)($existing['crime_scene_weapon'] ?? '');
    $nextMotive = ($crimeMotive !== null) ? trim((string)$crimeMotive) : (string)($existing['crime_scene_motive'] ?? '');
    $nextLocation = ($crimeLocation !== null) ? trim((string)$crimeLocation) : (string)($existing['crime_scene_location'] ?? '');

    $nextLocationId = null;
    if ($crimeLocationId !== null) {
        $val = (int)$crimeLocationId;
        $nextLocationId = $val > 0 ? $val : null;
    } else {
        $cur = (int)($existing['crime_scene_location_id'] ?? 0);
        $nextLocationId = $cur > 0 ? $cur : null;
    }

    if ($nextLocationId !== null && $nextLocationId > 0) {
        $locRow = Database::queryOne('SELECT id, name FROM mystery_locations WHERE id = ? AND is_archived = 0 LIMIT 1', [$nextLocationId]);
        if (!$locRow) {
            catn8_json_response(['success' => false, 'error' => 'Global location not found (or archived)'], 400);
        }
        $locName = trim((string)($locRow['name'] ?? ''));
        if ($locName !== '') {
            $nextLocation = $locName;
        }
    }

    $nextLocationMasterId = null;
    if ($crimeLocationMasterId !== null) {
        $val = (int)$crimeLocationMasterId;
        $nextLocationMasterId = $val > 0 ? $val : null;
    } else {
        $cur = (int)($existing['crime_scene_location_master_id'] ?? 0);
        $nextLocationMasterId = $cur > 0 ? $cur : null;
    }

    $nextCsiDetectiveEntityId = null;
    if ($csiDetectiveEntityId !== null) {
        $val = (int)$csiDetectiveEntityId;
        $nextCsiDetectiveEntityId = $val > 0 ? $val : null;
    } else {
        $cur = (int)($existing['csi_detective_entity_id'] ?? 0);
        $nextCsiDetectiveEntityId = $cur > 0 ? $cur : null;
    }

    $nextCsiReportText = ($csiReportText !== null) ? (string)$csiReportText : (string)($existing['csi_report_text'] ?? '');
    $nextCsiReportText = trim($nextCsiReportText) !== '' ? $nextCsiReportText : null;

    $nextCsiReportJson = null;
    if ($csiReportJson !== null) {
        $encoded = json_encode($csiReportJson);
        if (!is_string($encoded)) {
            $encoded = json_encode(new stdClass());
        }
        $nextCsiReportJson = $encoded;
    } else {
        $raw = (string)($existing['csi_report_json'] ?? '');
        $nextCsiReportJson = trim($raw) !== '' ? $raw : null;
    }

    if ($nextCsiDetectiveEntityId !== null && $nextCsiDetectiveEntityId > 0) {
        $entityRow = $requireEntity($nextCsiDetectiveEntityId);
        if ((int)($entityRow['game_id'] ?? 0) !== (int)($existing['game_id'] ?? 0)) {
            catn8_json_response(['success' => false, 'error' => 'CSI Detective entity does not belong to this case'], 400);
        }
        $caseRow = $requireCase((int)($existing['game_id'] ?? 0));
        $mysteryIdForCase = (int)($caseRow['mystery_id'] ?? 0);
        $catn8_require_csi_law_enforcement_character($mysteryIdForCase, $entityRow);
    }

    Database::execute(
        'UPDATE mystery_scenarios SET slug = ?, title = ?, status = ?, specs_json = ?, constraints_json = ?, crime_scene_weapon = ?, crime_scene_motive = ?, crime_scene_location = ?, crime_scene_location_id = ?, crime_scene_location_master_id = ?, csi_detective_entity_id = ?, csi_report_text = ?, csi_report_json = ? WHERE id = ?',
        [$slug, $title, $status, $specsJson, $constraintsJson, $nextWeapon !== '' ? $nextWeapon : null, $nextMotive !== '' ? $nextMotive : null, $nextLocation !== '' ? $nextLocation : null, $nextLocationId, $nextLocationMasterId, $nextCsiDetectiveEntityId, $nextCsiReportText, $nextCsiReportJson, $id]
    );

    if ($murdererIdsInput !== null) {
        $ids = array_values(array_filter(array_map('intval', $murdererIdsInput), static fn($n) => (int)$n > 0));
        Database::execute('DELETE FROM mystery_scenario_murderers WHERE scenario_id = ?', [$id]);
        foreach ($ids as $eid) {
            // enforce same-case entity
            $entity = Database::queryOne('SELECT id, game_id FROM mystery_entities WHERE id = ? LIMIT 1', [(int)$eid]);
            if (!$entity) continue;
            if ((int)($entity['game_id'] ?? 0) !== (int)($existing['game_id'] ?? 0)) continue;
            Database::execute('INSERT IGNORE INTO mystery_scenario_murderers (scenario_id, entity_id) VALUES (?, ?)', [$id, (int)$eid]);
        }
    }

    catn8_json_response(['success' => true]);
}
