<?php
/**
 * admin_functions_csi.php - Shared CSI generation logic
 */
declare(strict_types=1);

/**
 * Ensures CSI columns exist in mystery_scenarios table.
 */
function catn8_mystery_require_csi_columns(): void {
    static $checked = false;
    if ($checked) return;
    
    $cols = Database::queryAll("SHOW COLUMNS FROM mystery_scenarios");
    $names = array_column($cols, 'Field');
    
    if (!in_array('csi_report_text', $names)) {
        Database::execute("ALTER TABLE mystery_scenarios ADD COLUMN csi_report_text TEXT NULL AFTER briefing_text");
    }
    if (!in_array('csi_report_json', $names)) {
        Database::execute("ALTER TABLE mystery_scenarios ADD COLUMN csi_report_json JSON NULL AFTER csi_report_text");
    }
    if (!in_array('csi_detective_entity_id', $names)) {
        Database::execute("ALTER TABLE mystery_scenarios ADD COLUMN csi_detective_entity_id INT NULL AFTER csi_report_json");
    }
    $checked = true;
}

/**
 * Generates an AI CSI report for a scenario, burying location clues.
 */
function catn8_mystery_generate_csi_report(int $scenarioId): array {
    // 1. Load Scenario and Backstory Context
    $scenario = Database::queryOne('
        SELECT s.title as scenario_title, s.briefing_text, b.backstory_text, b.backstory_summary, m.title as mystery_title
        FROM mystery_scenarios s
        JOIN mystery_backstories b ON s.backstory_id = b.id
        JOIN mystery_games g ON s.game_id = g.id
        JOIN mystery_mysteries m ON g.mystery_id = m.id
        WHERE s.id = ?
    ', [$scenarioId]);

    if (!$scenario) {
        throw new RuntimeException("Scenario context not found for ID: $scenarioId");
    }

    // 2. Load Clues/Locations for this scenario to "bury" them
    $entities = Database::queryAll('
        SELECT se.entity_id, e.name as entity_name, se.role, se.override_json
        FROM mystery_scenario_entities se
        JOIN mystery_entities e ON se.entity_id = e.id
        WHERE se.scenario_id = ? AND (se.role = "location" OR e.entity_type = "location")
    ', [$scenarioId]);

    $locationsContext = "";
    foreach ($entities as $loc) {
        $override = json_decode((string)($loc['override_json'] ?? '{}'), true);
        $clue = $override['hidden_clue'] ?? '';
        if ($clue) {
            $locationsContext .= "- Location: {$loc['entity_name']}. Hidden Clue to bury: \"{$clue}\"\n";
        }
    }

    // 3. Define AI Prompt
    $systemPrompt = "You are a Senior CSI Forensic Pathologist and Lead Investigator. Your task is to write an exhaustive, clinical, and technically-detailed Forensic Crime Scene Analysis Report.\n\n" .
        "TONE AND STYLE:\n" .
        "- Use clinical, detached, and highly technical language (e.g., 'epithelial cells', 'hemosiderin staining', 'striation patterns', 'ambient temperature equilibrium', 'latent papillary ridges').\n" .
        "- The report must be dense and professional, reading like a formal document submitted to a court of law or a chief medical examiner.\n" .
        "- Avoid dramatic flourishes; rely on cold, hard observation and procedural detail.\n\n" .
        "CRITICAL REQUIREMENT (CLUE BURYING):\n" .
        "- You MUST 'bury' the specific clues found at various locations within the technical descriptions.\n" .
        "- The clues should NOT be prominent. They should be mentioned as minor anomalies or incidental findings within a larger paragraph of forensic jargon.\n" .
        "- For example, instead of 'I found a scrap of paper with a phone number', use 'During the application of cyanoacrylate fuming to the peripheral surfaces, a minor cellulose-based fragment was recovered, exhibiting localized carbon-based inscriptions consistent with a sequence of numeric characters...'.\n\n" .
        "THE REPORT STRUCTURE:\n" .
        "1. 'report_text': A multi-section narrative (4-6 detailed paragraphs) including:\n" .
        "   - Scene Arrival & Environmental Observations (weather, lighting, temperature, initial perimeter assessment).\n" .
        "   - Physical Evidence Recovery (trace evidence, biological samples, ballistic analysis if applicable).\n" .
        "   - Systematic Search Methodology (grid search, spiral search patterns used).\n" .
        "   - Preliminary Conclusions & Chain of Custody notes.\n" .
        "2. 'report_json': A structured summary including:\n" .
        "   - 'summary': A high-level technical summary.\n" .
        "   - 'key_findings': A list of specific, technically described findings (including the buried clues, but described clinically).\n" .
        "   - 'status': Current status of the forensic processing.\n" .
        "   - 'evidence_log': A clinical list of items tagged for further lab analysis.\n\n" .
        "Format your response as valid JSON.";

    $userPrompt = "Mystery: {$scenario['mystery_title']}\n" .
        "Scenario: {$scenario['scenario_title']}\n" .
        "Backstory: {$scenario['backstory_text']}\n\n" .
        "LOCATIONS AND CLUES TO WEAVE IN (OBLIGATORY):\n" .
        "{$locationsContext}\n" .
        "\nProvide the complete, exhaustive Forensic Analysis Report in JSON format.";

    // 4. Load AI Config and Generate
    $aiCfg = catn8_mystery_get_ai_config();
    
    $res = catn8_ai_chat_json([
        'provider' => strtolower((string)($aiCfg['provider'] ?? 'google_ai_studio')),
        'model' => $aiCfg['model'] ?: 'gemini-1.5-pro',
        'system_prompt' => $systemPrompt,
        'user_prompt' => $userPrompt,
        'temperature' => 0.7,
        'max_output_tokens' => 2048
    ]);

    $data = $res['json'] ?? [];
    $reportText = trim((string)($data['report_text'] ?? ''));
    $reportJson = json_encode($data['report_json'] ?? new stdClass());

    // 5. Update Database
    catn8_mystery_require_csi_columns();
    Database::execute(
        'UPDATE mystery_scenarios SET csi_report_text = ?, csi_report_json = ? WHERE id = ?',
        [$reportText, $reportJson, $scenarioId]
    );

    return [
        'success' => true,
        'report_text' => $reportText,
        'report_json' => $reportJson
    ];
}
