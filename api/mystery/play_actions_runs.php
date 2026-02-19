<?php
declare(strict_types=1);

if ($action === 'list_resumable') {
    catn8_require_method('GET');
    $rows = Database::queryAll("SELECT s.id AS scenario_id, s.game_id AS case_id, s.slug AS scenario_slug, s.title AS scenario_title, s.status AS scenario_status, g.slug AS case_slug, g.title AS case_title, g.description AS case_description, g.created_at AS case_created_at, g.updated_at AS case_updated_at, s.created_at AS scenario_created_at, s.updated_at AS scenario_updated_at FROM mystery_scenarios s INNER JOIN mystery_games g ON g.id = s.game_id WHERE g.owner_user_id = ? AND g.is_archived = 0 ORDER BY s.updated_at DESC, s.id DESC", [$viewerId]);
    $items = array_map(static fn($r) => [
        'scenario_id' => (int)$r['scenario_id'], 'scenario_slug' => (string)$r['scenario_slug'],
        'scenario_title' => (string)$r['scenario_title'], 'scenario_status' => (string)$r['scenario_status'],
        'scenario_created_at' => (string)$r['scenario_created_at'], 'scenario_updated_at' => (string)$r['scenario_updated_at'],
        'case_id' => (int)$r['case_id'], 'case_slug' => (string)$r['case_slug'], 'case_title' => (string)$r['case_title'],
        'case_description' => (string)$r['case_description'], 'case_created_at' => (string)$r['case_created_at'],
        'case_updated_at' => (string)$r['case_updated_at']
    ], $rows);
    catn8_json_response(['success' => true, 'resumables' => $items]);
}

if ($action === 'get_active_run') {
    catn8_require_method('GET');
    $caseId = (int)($_GET['case_id'] ?? 0);
    if ($caseId <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid case_id'], 400);
    $caseRow = Database::queryOne('SELECT id, owner_user_id FROM mystery_games WHERE id = ? LIMIT 1', [$caseId]);
    if (!$caseRow) catn8_json_response(['success' => false, 'error' => 'Case not found'], 404);
    
    $isAdmin = catn8_user_is_admin($viewerId);
    if (!$isAdmin && (int)$caseRow['owner_user_id'] !== $viewerId) {
        catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
    }

    $runRow = Database::queryOne("SELECT id, case_id, scenario_id, owner_user_id, status, run_settings_json, created_at, updated_at FROM mystery_run_sessions WHERE case_id = ? AND owner_user_id = ? AND status = 'active' ORDER BY updated_at DESC, id DESC LIMIT 1", [$caseId, $viewerId]);
    if (!$runRow) {
        Database::execute("INSERT INTO mystery_run_sessions (case_id, scenario_id, owner_user_id, status, run_settings_json) VALUES (?, NULL, ?, 'active', ?)", [$caseId, $viewerId, json_encode(new stdClass())]);
        $runRow = Database::queryOne("SELECT id, case_id, scenario_id, owner_user_id, status, run_settings_json, created_at, updated_at FROM mystery_run_sessions WHERE case_id = ? AND owner_user_id = ? AND status = 'active' ORDER BY updated_at DESC, id DESC LIMIT 1", [$caseId, $viewerId]);
    }
    $settings = json_decode((string)$runRow['run_settings_json'], true) ?: [];
    catn8_json_response(['success' => true, 'run' => [
        'id' => (int)$runRow['id'], 'case_id' => (int)$runRow['case_id'], 'scenario_id' => $runRow['scenario_id'] ? (int)$runRow['scenario_id'] : null,
        'status' => (string)$runRow['status'], 'settings' => $settings, 'game_won' => !empty($settings['game_won']),
        'created_at' => (string)$runRow['created_at'], 'updated_at' => (string)$runRow['updated_at']
    ]]);
}

if ($action === 'mark_game_won') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $caseId = (int)($body['case_id'] ?? 0);
    if ($caseId <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid case_id'], 400);
    $caseRow = Database::queryOne('SELECT id, owner_user_id FROM mystery_games WHERE id = ? LIMIT 1', [$caseId]);
    if (!$caseRow) catn8_json_response(['success' => false, 'error' => 'Case not found'], 404);
    
    $isAdmin = catn8_user_is_admin($viewerId);
    if (!$isAdmin && (int)$caseRow['owner_user_id'] !== $viewerId) {
        catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
    }

    $runRow = Database::queryOne("SELECT id, run_settings_json FROM mystery_run_sessions WHERE case_id = ? AND owner_user_id = ? AND status = 'active' ORDER BY updated_at DESC, id DESC LIMIT 1", [$caseId, $viewerId]);
    if (!$runRow) catn8_json_response(['success' => false, 'error' => 'No active run'], 400);
    $settings = json_decode((string)$runRow['run_settings_json'], true) ?: [];
    $settings['game_won'] = true;
    Database::execute('UPDATE mystery_run_sessions SET run_settings_json = ? WHERE id = ? LIMIT 1', [json_encode($settings), (int)$runRow['id']]);
    catn8_json_response(['success' => true, 'game_won' => true]);
}

if ($action === 'update_active_run') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $caseId = (int)($body['case_id'] ?? 0);
    if ($caseId <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid case_id'], 400);
    $caseRow = Database::queryOne('SELECT id, owner_user_id FROM mystery_games WHERE id = ? LIMIT 1', [$caseId]);
    if (!$caseRow) catn8_json_response(['success' => false, 'error' => 'Case not found'], 404);
    
    $isAdmin = catn8_user_is_admin($viewerId);
    if (!$isAdmin && (int)$caseRow['owner_user_id'] !== $viewerId) {
        catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
    }

    $sid = isset($body['scenario_id']) ? (int)$body['scenario_id'] : null;
    $settings = $body['settings'] ?? null;
    Database::beginTransaction();
    try {
        $runRow = Database::queryOne("SELECT id FROM mystery_run_sessions WHERE case_id = ? AND owner_user_id = ? AND status = 'active' ORDER BY updated_at DESC, id DESC LIMIT 1", [$caseId, $viewerId]);
        if (!$runRow) {
            Database::execute("INSERT INTO mystery_run_sessions (case_id, scenario_id, owner_user_id, status, run_settings_json) VALUES (?, ?, ?, 'active', ?)", [$caseId, $sid, $viewerId, json_encode($settings ?: new stdClass())]);
        } else {
            $rid = (int)$runRow['id'];
            if ($sid !== null) Database::execute('UPDATE mystery_run_sessions SET scenario_id = ? WHERE id = ?', [$sid, $rid]);
            if ($settings !== null) Database::execute('UPDATE mystery_run_sessions SET run_settings_json = ? WHERE id = ?', [json_encode($settings), $rid]);
        }
        Database::commit();
        catn8_json_response(['success' => true]);
    } catch (Throwable $e) { Database::rollBack(); throw $e; }
}

if ($action === 'enqueue_job') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $caseId = (int)($body['case_id'] ?? 0);
    $jobAction = trim((string)($body['job_action'] ?? ''));
    if ($caseId <= 0 || $jobAction === '') catn8_json_response(['success' => false, 'error' => 'Missing fields'], 400);
    $caseRow = Database::queryOne('SELECT id, owner_user_id FROM mystery_games WHERE id = ? LIMIT 1', [$caseId]);
    if (!$caseRow) catn8_json_response(['success' => false, 'error' => 'Case not found'], 404);
    
    $isAdmin = catn8_user_is_admin($viewerId);
    if (!$isAdmin && (int)$caseRow['owner_user_id'] !== $viewerId) {
        catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
    }

    $allowed = ['generate_deposition', 'generate_briefing', 'generate_story_narrative', 'generate_evidence', 'generate_master_asset_content'];
    if (!in_array($jobAction, $allowed, true)) catn8_json_response(['success' => false, 'error' => 'Action not permitted'], 403);
    
    Database::execute(
        "INSERT INTO mystery_generation_jobs (game_id, scenario_id, entity_id, action, spec_json, status, result_json, error_text) VALUES (?, ?, ?, ?, ?, 'queued', '{}', '')",
        [$caseId, $body['scenario_id'] ?? null, $body['entity_id'] ?? null, $jobAction, json_encode($body['job_spec'] ?? new stdClass())]
    );
    
    $jobId = (int)Database::lastInsertId();
    catn8_json_response(['success' => true, 'id' => $jobId]);
}

if ($action === 'list_jobs') {
    catn8_require_method('GET');
    $caseId = (int)($_GET['case_id'] ?? 0);
    if ($caseId <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid case_id'], 400);
    $caseRow = Database::queryOne('SELECT id, owner_user_id FROM mystery_games WHERE id = ? LIMIT 1', [$caseId]);
    if (!$caseRow) catn8_json_response(['success' => false, 'error' => 'Case not found'], 404);
    
    $isAdmin = catn8_user_is_admin($viewerId);
    if (!$isAdmin && (int)$caseRow['owner_user_id'] !== $viewerId) {
        catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
    }
    $rows = Database::queryAll('SELECT id, scenario_id, entity_id, action, status, error_text, result_json, created_at, updated_at FROM mystery_generation_jobs WHERE game_id = ? ORDER BY id DESC LIMIT 50', [$caseId]);
    catn8_json_response(['success' => true, 'jobs' => array_map(static fn($r) => [
        'id' => (int)$r['id'], 'scenario_id' => $r['scenario_id'] ? (int)$r['scenario_id'] : null,
        'entity_id' => $r['entity_id'] ? (int)$r['entity_id'] : null, 'action' => (string)$r['action'],
        'status' => (string)$r['status'], 'error_text' => (string)($r['error_text'] ?? ''),
        'result' => json_decode((string)$r['result_json'], true) ?: null,
        'created_at' => (string)$r['created_at'], 'updated_at' => (string)$r['updated_at']
    ], $rows)]);
}
