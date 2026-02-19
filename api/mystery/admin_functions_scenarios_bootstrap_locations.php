<?php
/**
 * admin_functions_scenarios_bootstrap_locations.php - Scenario location bootstrap utilities
 * COMPLIANCE: File size < 300 lines
 */

/**
 * Ensures the target number of locations exist for a case by importing from master.
 */
function catn8_mystery_bootstrap_ensure_locations(int $caseId, int $mysteryId, int $targetCount = 3): array {
    $locations = Database::queryAll(
        "SELECT id, slug, name, data_json\n" .
        "FROM mystery_entities\n" .
        "WHERE game_id = ? AND entity_type = 'location' AND is_archived = 0\n" .
        "ORDER BY id ASC",
        [$caseId]
    );

    if (count($locations) < $targetCount) {
        $existingSlugSet = [];
        foreach ($locations as $r) {
            $slug = trim((string)($r['slug'] ?? ''));
            if ($slug !== '') $existingSlugSet[$slug] = true;
        }

        $master = Database::queryAll(
            "SELECT id, slug, name\n" .
            "FROM mystery_master_locations\n" .
            "WHERE mystery_id = ? AND is_archived = 0\n" .
            "ORDER BY id ASC\n" .
            "LIMIT 50",
            [$mysteryId]
        );

        $needed = $targetCount - count($locations);
        foreach ($master as $r) {
            if ($needed <= 0) break;
            $slug = trim((string)($r['slug'] ?? ''));
            if ($slug === '' || isset($existingSlugSet[$slug])) continue;

            $slug = catn8_mystery_unique_slug($slug, static function (string $candidate) use ($caseId): bool {
                return Database::queryOne(
                    'SELECT id FROM mystery_entities WHERE game_id = ? AND entity_type = ? AND slug = ? LIMIT 1',
                    [$caseId, 'location', $candidate]
                ) !== null;
            });

            $data = catn8_mystery_master_location_build_derived_json($mysteryId, (int)($r['id'] ?? 0), false);
            if (!is_array($data)) $data = [];
            $data['master_id'] = (int)($r['id'] ?? 0);
            $data['master_slug'] = (string)($r['slug'] ?? '');

            Database::execute(
                'INSERT INTO mystery_entities (game_id, entity_type, slug, name, data_json, roles_json, is_archived) VALUES (?, ?, ?, ?, ?, ?, 0)',
                [$caseId, 'location', $slug, $r['name'], json_encode($data, JSON_UNESCAPED_SLASHES), json_encode([])]
            );
            $existingSlugSet[$slug] = true;
            $needed -= 1;
        }
        $locations = Database::queryAll(
            "SELECT id, slug, name, data_json\n" .
            "FROM mystery_entities\n" .
            "WHERE game_id = ? AND entity_type = 'location' AND is_archived = 0\n" .
            "ORDER BY id ASC",
            [$caseId]
        );
    }
    return $locations;
}

/**
 * Attaches locations to a scenario and ensures they have reports.
 */
function catn8_mystery_bootstrap_attach_locations(int $scenarioId, int $caseId, array $locations): void {
    foreach ($locations as $loc) {
        $entityId = (int)($loc['id'] ?? 0);
        if ($entityId <= 0) continue;

        $existing = Database::queryOne(
            'SELECT id, override_json FROM mystery_scenario_entities WHERE scenario_id = ? AND entity_id = ? AND role = ?',
            [$scenarioId, $entityId, 'location']
        );

        if (!$existing) {
            Database::execute(
                'INSERT INTO mystery_scenario_entities (scenario_id, entity_id, role, override_json) VALUES (?, ?, ?, ?)',
                [$scenarioId, $entityId, 'location', json_encode(new stdClass())]
            );
            $existing = ['override_json' => '{}'];
        }

        $override = json_decode((string)($existing['override_json'] ?? '{}'), true);
        if (!is_array($override)) $override = [];

        // Generate report if missing
        if (empty($override['report']) || empty($override['hidden_clue'])) {
            $reportData = catn8_mystery_generate_location_report($scenarioId, $loc);
            $override['report'] = $reportData['report'] ?? 'CSI has processed this location. No significant findings noted.';
            $override['hidden_clue'] = $reportData['hidden_clue'] ?? 'Nothing out of the ordinary was missed.';
            
            Database::execute(
                'UPDATE mystery_scenario_entities SET override_json = ? WHERE scenario_id = ? AND entity_id = ? AND role = ?',
                [json_encode($override, JSON_UNESCAPED_SLASHES), $scenarioId, $entityId, 'location']
            );
        }
    }
}

/**
 * Generates a location report and a hidden clue using AI.
 */
function catn8_mystery_generate_location_report(int $scenarioId, array $locationEntity): array {
    $locData = json_decode((string)($locationEntity['data_json'] ?? '{}'), true);
    $locName = $locationEntity['name'] ?? 'Unknown Location';
    $locDesc = $locData['description'] ?? '';

    // Get scenario context if available
    $scenario = Database::queryOne('SELECT title, description FROM mystery_scenarios WHERE id = ?', [$scenarioId]);
    $scenarioTitle = $scenario['title'] ?? 'The Mystery';
    
    $systemPrompt = "You are a CSI lead investigator. Write a brief, professional forensic report for a location in a murder mystery case.\n" .
                    "The case is: $scenarioTitle\n" .
                    "Location: $locName ($locDesc)\n" .
                    "Return a JSON object with two fields:\n" .
                    "1. 'report': A summary of what CSI found (fingerprints, signs of struggle, etc.). Keep it noir and atmospheric.\n" .
                    "2. 'hidden_clue': One specific, subtle detail that CSI initially MISSED, which could be a vital clue. It should be something small like a scrap of paper, a specific scent, or a misplaced item.";

    try {
        $params = [
            'provider' => 'google_ai_studio', // Defaulting to Google
            'model' => 'gemini-1.5-flash',
            'system_prompt' => $systemPrompt,
            'user_prompt' => "Generate the forensic report for $locName.",
            'temperature' => 0.7
        ];
        $res = catn8_ai_chat_json($params);
        return $res['json'] ?? [];
    } catch (Throwable $e) {
        return [
            'report' => "CSI team has swept the area. Standard forensic markers have been collected. The scene remains secured.",
            'hidden_clue' => "Upon a second look, you notice a small, torn corner of a business card tucked into the floorboards."
        ];
    }
}
