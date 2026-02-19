<?php
/**
 * admin_actions_master_assets_list.php - Listing master assets for Admins
 */
declare(strict_types=1);

if ($action === 'list_master_characters') {
    catn8_require_method('GET');
    $mysteryId = (int)($_GET['mystery_id'] ?? 0);
    $caseId = (int)($_GET['case_id'] ?? 0);
    $requireMystery($mysteryId);
    $includeArchived = (int)($_GET['include_archived'] ?? 0) === 1;

    $where = 'mystery_id = ?';
    $params = [$mysteryId];

    if (!$isAdmin) {
        if ($caseId <= 0) {
            catn8_json_response(['success' => true, 'characters' => []]);
        }
        $where .= ' AND id IN (SELECT master_character_id FROM mystery_entities WHERE game_id = ? AND master_character_id IS NOT NULL)';
        $params[] = $caseId;
    }

    if (!$includeArchived) {
        $where .= ' AND is_archived = 0';
    }

    $rows = Database::queryAll(
        "SELECT * FROM mystery_master_characters WHERE $where ORDER BY name ASC, id ASC",
        $params
    );

    catn8_json_response(['success' => true, 'characters' => $rows]);
}

if ($action === 'list_master_locations') {
    catn8_require_method('GET');
    $mysteryId = (int)($_GET['mystery_id'] ?? 0);
    $caseId = (int)($_GET['case_id'] ?? 0);
    $requireMystery($mysteryId);
    $includeArchived = (int)($_GET['include_archived'] ?? 0) === 1;

    $where = 'mystery_id = ?';
    $params = [$mysteryId];

    if (!$isAdmin) {
        if ($caseId <= 0) {
            catn8_json_response(['success' => true, 'locations' => []]);
        }
        $where .= ' AND id IN (SELECT master_location_id FROM mystery_scenarios WHERE game_id = ? AND master_location_id IS NOT NULL)';
        $params[] = $caseId;
    }

    if (!$includeArchived) {
        $where .= ' AND is_archived = 0';
    }

    $rows = Database::queryAll(
        "SELECT * FROM mystery_master_locations WHERE $where ORDER BY name ASC, id ASC",
        $params
    );

    // Fetch clues for each location using consolidated table
    foreach ($rows as &$row) {
        $items = catn8_mystery_master_asset_items_load($mysteryId, 'location', (int)$row['id']);
        $row['items'] = array_column($items, 'text');
    }

    catn8_json_response(['success' => true, 'locations' => $rows]);
}

if ($action === 'list_master_weapons') {
    catn8_require_method('GET');
    $mysteryId = (int)($_GET['mystery_id'] ?? 0);
    $caseId = (int)($_GET['case_id'] ?? 0);
    $requireMystery($mysteryId);
    $includeArchived = (int)($_GET['include_archived'] ?? 0) === 1;

    $where = 'mystery_id = ?';
    $params = [$mysteryId];

    if (!$isAdmin) {
        if ($caseId <= 0) {
            catn8_json_response(['success' => true, 'weapons' => []]);
        }
        $where .= ' AND id IN (SELECT crime_scene_weapon_id FROM mystery_scenarios WHERE game_id = ? AND crime_scene_weapon_id IS NOT NULL)';
        $params[] = $caseId;
    }

    if (!$includeArchived) {
        $where .= ' AND is_archived = 0';
    }

    $rows = Database::queryAll(
        "SELECT * FROM mystery_master_weapons WHERE $where ORDER BY name ASC, id ASC",
        $params
    );

    // Fetch fingerprints for each weapon using consolidated helper
    foreach ($rows as &$row) {
        $items = catn8_mystery_master_asset_items_load($mysteryId, 'weapon', (int)$row['id']);
        $row['fingerprints'] = array_column($items, 'fingerprint');
        if (empty($row['fingerprints'])) {
            // Check if they are in the 'text' column of the new table
            $row['fingerprints'] = array_column($items, 'text');
        }
    }

    catn8_json_response(['success' => true, 'weapons' => $rows]);
}

if ($action === 'list_master_motives') {
    catn8_require_method('GET');
    $mysteryId = (int)($_GET['mystery_id'] ?? 0);
    $caseId = (int)($_GET['case_id'] ?? 0);
    $requireMystery($mysteryId);
    $includeArchived = (int)($_GET['include_archived'] ?? 0) === 1;

    $where = 'mystery_id = ?';
    $params = [$mysteryId];

    if (!$isAdmin) {
        if ($caseId <= 0) {
            catn8_json_response(['success' => true, 'motives' => []]);
        }
        $where .= ' AND id IN (SELECT crime_scene_motive_id FROM mystery_scenarios WHERE game_id = ? AND crime_scene_motive_id IS NOT NULL)';
        $params[] = $caseId;
    }

    if (!$includeArchived) {
        $where .= ' AND is_archived = 0';
    }

    $rows = Database::queryAll(
        "SELECT * FROM mystery_master_motives WHERE $where ORDER BY name ASC, id ASC",
        $params
    );

    catn8_json_response(['success' => true, 'motives' => $rows]);
}
