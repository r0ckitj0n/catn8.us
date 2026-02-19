<?php
/**
 * play.php - Conductor for Mystery Player API
 * COMPLIANCE: File size < 300 lines
 */

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/shared_functions.php';
require_once __DIR__ . '/play_functions.php';

catn8_session_start();
$viewerId = catn8_require_group_or_admin('mystery-game-users');

$action = strtolower(trim((string)($_GET['action'] ?? $_POST['action'] ?? '')));
if ($action === '') {
    catn8_json_response(['success' => false, 'error' => 'Missing action'], 400);
}

// Health check for tables
try {
    Database::queryOne('SELECT id FROM mystery_games LIMIT 1');
    Database::queryOne('SELECT id FROM mystery_scenarios LIMIT 1');
    Database::queryOne('SELECT id FROM mystery_run_sessions LIMIT 1');
} catch (Throwable $e) {
    catn8_json_response(['success' => false, 'error' => 'Mystery tables are not initialized'], 500);
}

// Route to modular action files
$action_files = [
    'list_templates' => 'catalogs',
    'list_mysteries' => 'catalogs',
    'list_cases' => 'catalogs',
    'list_backstories' => 'catalogs',
    'list_story_book_entries' => 'catalogs',
    
    'get_backstory' => 'details',
    'get_backstory_full' => 'details',
    'get_story_book_entry' => 'details',
    
    'list_resumable' => 'runs',
    'get_active_run' => 'runs',
    'mark_game_won' => 'runs',
    'update_active_run' => 'runs',
    'enqueue_job' => 'runs',
    'list_jobs' => 'runs',
    
    'ensure_default_scenario_for_case' => 'scenarios',
    'list_scenarios' => 'scenarios',
    'get_scenario' => 'scenarios',
    'list_scenario_entities' => 'scenarios',
    'get_scenario_briefing' => 'scenarios',
    'get_entity_deposition' => 'scenarios',
    'list_depositions' => 'scenarios',
    
    'list_case_notes' => 'evidence',
    'list_lies' => 'evidence',
    'list_evidence' => 'evidence',
    'add_evidence_note' => 'evidence',
    'get_cold_hard_facts' => 'evidence',
    'list_entities' => 'evidence'
];

if (isset($action_files[$action])) {
    require_once __DIR__ . '/play_actions_' . $action_files[$action] . '.php';
    exit;
}

catn8_json_response(['success' => false, 'error' => "Unknown action: $action"], 400);
