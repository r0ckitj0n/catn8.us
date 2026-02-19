<?php
/**
 * rap_sheet.php - Mystery Character Rap Sheet API
 * COMPLIANCE: File size < 300 lines
 */

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/rap_sheet_data.php';
require_once __DIR__ . '/rap_sheet_functions.php';

catn8_session_start();
$viewerId = catn8_require_group_or_admin('mystery-game-users');
$isAdmin = catn8_user_is_admin($viewerId);

catn8_require_method('GET');

$scenarioId = (int)($_GET['scenario_id'] ?? 0);
$entityId = (int)($_GET['entity_id'] ?? 0);

if ($scenarioId <= 0 || $entityId <= 0) {
    catn8_json_response(['success' => false, 'error' => 'Invalid params'], 400);
}

$scenarioRow = Database::queryOne(
    'SELECT s.id, s.game_id, s.title, s.specs_json, s.constraints_json, g.owner_user_id, g.title AS case_title, g.mystery_id
     FROM mystery_scenarios s INNER JOIN mystery_games g ON g.id = s.game_id
     WHERE s.id = ? LIMIT 1',
    [$scenarioId]
);
if (!$scenarioRow) catn8_json_response(['success' => false, 'error' => 'Scenario not found'], 404);

if (!$isAdmin && (int)($scenarioRow['owner_user_id'] ?? 0) !== $viewerId) {
    catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
}

$ownerUserId = (int)$scenarioRow['owner_user_id'];
$mysteryId = (int)$scenarioRow['mystery_id'];
$caseId = (int)$scenarioRow['game_id'];
$gameWon = catn8_mystery_is_game_won($caseId, $viewerId);

$specs = json_decode((string)($scenarioRow['specs_json'] ?? '{}'), true) ?: [];
$timeOfDeath = trim((string)($specs['victim']['time_of_death'] ?? ''));

$entityRow = Database::queryOne('SELECT * FROM mystery_entities WHERE id = ? LIMIT 1', [$entityId]);
if (!$entityRow || (int)$entityRow['game_id'] !== $caseId || $entityRow['entity_type'] !== 'character') {
    catn8_json_response(['success' => false, 'error' => 'Invalid character'], 400);
}

$data = json_decode((string)($entityRow['data_json'] ?? '{}'), true) ?: [];
$mid = (int)($data['master_id'] ?? 0);
$mslug = trim((string)($data['master_slug'] ?? ''));

$masterRow = Database::queryOne(
    'SELECT * FROM mystery_master_characters WHERE mystery_id = ? AND (id = ? OR slug = ?) LIMIT 1',
    [$mysteryId, $mid, $mslug]
);
if (!$masterRow) catn8_json_response(['success' => false, 'error' => 'Master character not found'], 404);

$aliases = json_decode((string)($masterRow['aliases_json'] ?? '[]'), true) ?: [];
$booking = [
    'full_name' => (string)$entityRow['name'], 'date_of_birth' => (string)$masterRow['dob'],
    'age' => (string)$masterRow['age'], 'height' => (string)$masterRow['height'],
    'weight' => (string)$masterRow['weight'], 'eye_color' => (string)$masterRow['eye_color'],
    'hometown' => (string)$masterRow['hometown'], 'address' => (string)$masterRow['address'] ?: (string)$masterRow['hometown'],
    'aliases' => implode(' | ', $aliases), 'distinguishing_marks' => (string)$masterRow['distinguishing_marks'],
    'education' => (string)$masterRow['education'], 'criminal_record' => (string)$masterRow['criminal_record']
];

$alibiRow = Database::queryOne('SELECT * FROM mystery_scenario_lies WHERE scenario_id = ? AND entity_id = ? AND topic_key = ? LIMIT 1', [$scenarioId, $entityId, 'timeline.alibi']);
$alibi = $alibiRow ? [
    'id' => (int)$alibiRow['id'], 'topic_key' => 'timeline.alibi', 'lie_text' => (string)$alibiRow['lie_text'],
    'truth_text' => ($isAdmin || $gameWon) ? (string)$alibiRow['truth_text'] : '',
    'trigger_questions' => json_decode((string)$alibiRow['trigger_questions_json'], true) ?: []
] : null;

$seed = "$scenarioId|$entityId|{$entityRow['slug']}|{$entityRow['name']}";
$flavor = catn8_rap_sheet_get_flavor($seed);
$kidCtx = array_merge($booking, ['flavor' => $flavor, 'todText' => $timeOfDeath ?: 'time of death', 'whereAtTod' => $alibi['lie_text'] ?? 'I was away.']);

$kidNamed = fn($s) => trim((string)$s) ?: $entityRow['name'];
$bank = catn8_rap_sheet_get_bank($kidNamed);
$kidDetective = array_map(fn($item) => ['question' => $item['question'], 'answer' => $item['answer_fn']($kidCtx)], array_slice($bank, 0, 10));

$interrogations = Database::queryAll(
    'SELECT ie.*, s.title AS scenario_title, g.title AS case_title 
     FROM mystery_interrogation_events ie
     INNER JOIN mystery_entities e ON e.id = ie.entity_id
     INNER JOIN mystery_scenarios s ON s.id = ie.scenario_id
     INNER JOIN mystery_games g ON g.id = s.game_id
     WHERE g.owner_user_id = ? AND e.id = ? ORDER BY ie.id ASC LIMIT 500',
    [$ownerUserId, $entityId]
);

catn8_json_response(['success' => true, 'rap_sheet' => [
    'suspect' => ['entity_id' => $entityId, 'slug' => $entityRow['slug'], 'name' => $entityRow['name']],
    'booking' => $booking, 'prior_arrests' => [], 'time_of_death' => $timeOfDeath,
    'alibi' => $alibi, 'kid_detective' => $kidDetective,
    'interrogations' => array_map(fn($r) => [
        'id' => (int)$r['id'], 'asked_at' => $r['asked_at'], 'question_text' => $r['question_text'],
        'answer_text' => $r['answer_text'], 'scenario_title' => $r['scenario_title'], 'case_title' => $r['case_title']
    ], $interrogations)
]]);
