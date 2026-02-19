<?php
/**
 * admin_actions_backstories.php - Backstory management for Admins
 * VERSION: 2025-12-31-0510-FINAL
 */

declare(strict_types=1);

require_once __DIR__ . '/admin_functions.php';

if ($action === 'save_backstory_details') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    $title = trim((string)($body['title'] ?? ''));
    $slug = trim((string)($body['slug'] ?? ''));
    $summary = trim((string)($body['backstory_summary'] ?? ''));
    $locationId = (int)($body['location_master_id'] ?? 0);
    $metaJson = trim((string)($body['meta_json'] ?? '{}'));

    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    Database::execute(
        'UPDATE mystery_backstories SET title = ?, slug = ?, backstory_summary = ?, location_master_id = ?, meta_json = ?, updated_at = NOW() WHERE id = ? LIMIT 1',
        [$title, $slug, $summary, $locationId, $metaJson, $id]
    );

    catn8_json_response(['success' => true]);
}

if ($action === 'save_backstory_full') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    $fullStory = trim((string)($body['full_story'] ?? ''));

    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    Database::execute(
        'UPDATE mystery_backstories SET backstory_text = ?, updated_at = NOW() WHERE id = ? LIMIT 1',
        [$fullStory, $id]
    );

    catn8_json_response(['success' => true]);
}

if ($action === 'toggle_backstory_archived') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);

    $row = Database::queryOne('SELECT is_archived FROM mystery_backstories WHERE id = ? LIMIT 1', [$id]);
    if (!$row) catn8_json_response(['success' => false, 'error' => 'Not found'], 404);

    $newVal = ((int)$row['is_archived'] === 1) ? 0 : 1;
    Database::execute('UPDATE mystery_backstories SET is_archived = ?, updated_at = NOW() WHERE id = ? LIMIT 1', [$newVal, $id]);

    catn8_json_response(['success' => true, 'is_archived' => $newVal]);
}

if ($action === 'spawn_case_from_backstory') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $mid = (int)($body['mystery_id'] ?? 0);
    $bid = (int)($body['backstory_id'] ?? 0);

    if ($mid <= 0 || $bid <= 0) {
        catn8_json_response(['success' => false, 'error' => 'mystery_id and backstory_id are required'], 400);
    }

    // Load backstory to get defaults
    $backstory = Database::queryOne('SELECT title, backstory_summary FROM mystery_backstories WHERE id = ? LIMIT 1', [$bid]);
    if (!$backstory) catn8_json_response(['success' => false, 'error' => 'Backstory not found'], 404);

    $title = (string)$backstory['title'];
    $slug = strtolower(trim(preg_replace('/[^a-z0-9]+/', '-', $title), '-'));
    $desc = (string)$backstory['backstory_summary'];

    Database::execute(
        'INSERT INTO mystery_games (owner_user_id, mystery_id, backstory_id, slug, title, description, is_template, is_archived) VALUES (?, ?, ?, ?, ?, ?, 0, 0)',
        [$viewerId, $mid, $bid, $slug, $title, $desc]
    );
    $newCaseId = (int)Database::lastInsertId();

    catn8_json_response(['success' => true, 'case_id' => $newCaseId]);
}

if ($action === 'generate_backstory') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $mid = (int)($body['mystery_id'] ?? 0);
    $title = trim((string)($body['title'] ?? ''));
    $sourceText = trim((string)($body['source_text'] ?? ''));
    $locationId = (int)($body['location_master_id'] ?? 0);

    if ($mid <= 0) {
        catn8_json_response(['success' => false, 'error' => 'mystery_id is required'], 400);
    }
    if ($title === '') {
        catn8_json_response(['success' => false, 'error' => 'Title is required'], 400);
    }

    // Load mystery details for context
    $mystery = Database::queryOne('SELECT title, slug FROM mystery_mysteries WHERE id = ? LIMIT 1', [$mid]);
    if (!$mystery) {
        catn8_json_response(['success' => false, 'error' => 'Mystery not found'], 404);
    }

    // Define prompts
    $systemPrompt = "You are an expert mystery writer and game designer. Your task is to generate a compelling noir-style murder mystery backstory based on a given title and optional source material.\n\n" .
        "The backstory should include:\n" .
        "1. A 'backstory_summary': A concise 2-3 sentence overview of the crime and setup.\n" .
        "2. A 'backstory_text': A detailed, immersive narrative (4-6 paragraphs) describing the victim, the crime scene, the initial discovery, and the high-stakes atmosphere.\n" .
        "3. A 'suggested_slug': A URL-friendly version of the title.\n\n" .
        "Format your response as a valid JSON object.";

    $userPrompt = "Mystery Title: \"{$title}\"\n";
    $userPrompt .= "Project Context: Part of the \"{$mystery['title']}\" mystery series.\n";
    if ($sourceText !== '') {
        $userPrompt .= "Source/Seed Text:\n{$sourceText}\n";
    }
    $userPrompt .= "\nGenerate the backstory JSON now.";

    // Load AI Config
    $aiCfg = catn8_mystery_get_ai_config();
    $provider = strtolower((string)($aiCfg['provider'] ?? ''));

    try {
        $res = catn8_ai_chat_json([
            'provider' => $provider,
            'model' => $aiCfg['model'] ?: 'gemini-1.5-pro',
            'system_prompt' => $systemPrompt,
            'user_prompt' => $userPrompt,
            'temperature' => 0.7,
            'max_output_tokens' => 2048,
            'location' => $aiCfg['location'] ?: 'us-central1'
        ]);

        $data = $res['json'] ?? [];
        if (!is_array($data)) {
            throw new RuntimeException("AI returned invalid JSON structure");
        }

        $summary = trim((string)($data['backstory_summary'] ?? ''));
        $fullText = trim((string)($data['backstory_text'] ?? ''));
        $slug = trim((string)($data['suggested_slug'] ?? ''));
        if ($slug === '') {
            $slug = strtolower(trim(preg_replace('/[^a-z0-9]+/', '-', $title), '-'));
        }

        // Insert into database
        Database::execute(
            'INSERT INTO mystery_backstories (mystery_id, owner_user_id, slug, title, backstory_summary, backstory_text, location_master_id, meta_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
            [$mid, $viewerId, $slug, $title, $summary, $fullText, $locationId > 0 ? $locationId : null, '{}']
        );
        $bid = (int)Database::lastInsertId();

        catn8_json_response([
            'success' => true,
            'backstory_id' => $bid,
            'title' => $title,
            'slug' => $slug,
            'summary' => $summary,
            'full_text' => $fullText
        ]);

    } catch (Throwable $e) {
        catn8_json_response(['success' => false, 'error' => 'AI Generation failed: ' . $e->getMessage()], 500);
    }
}
