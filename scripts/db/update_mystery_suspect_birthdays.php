<?php

declare(strict_types=1);

require_once __DIR__ . '/../../api/bootstrap.php';

if (PHP_SAPI !== 'cli') {
    catn8_require_admin();
}

$instructionsPath = realpath(__DIR__ . '/../../Mystery/Instructions/agents_profiles.json');
if (!is_string($instructionsPath) || $instructionsPath === '' || !is_file($instructionsPath)) {
    catn8_json_response(['success' => false, 'error' => 'Missing Mystery/Instructions/agents_profiles.json'], 500);
}

$raw = file_get_contents($instructionsPath);
if (!is_string($raw)) {
    catn8_json_response(['success' => false, 'error' => 'Failed to read agents_profiles.json'], 500);
}

$profiles = json_decode($raw, true);
if (!is_array($profiles)) {
    catn8_json_response(['success' => false, 'error' => 'Invalid JSON in agents_profiles.json'], 500);
}

$birthdaysByAgentId = [];
foreach ($profiles as $p) {
    if (!is_array($p)) continue;
    $aid = (int)($p['id'] ?? 0);
    if ($aid <= 0) continue;
    $bday = (string)($p['static_profile']['demographics']['birthday'] ?? '');
    if ($bday === '') continue;
    $birthdaysByAgentId[$aid] = $bday;
}

if (!count($birthdaysByAgentId)) {
    catn8_json_response(['success' => false, 'error' => 'No birthdays found in agents_profiles.json'], 500);
}

$rows = Database::queryAll(
    'SELECT id, game_id, entity_type, name, data_json FROM mystery_entities WHERE entity_type = ?',
    ['character']
);

$updated = 0;
$skipped = 0;
$errors = [];

foreach ($rows as $r) {
    $entityId = (int)($r['id'] ?? 0);
    if ($entityId <= 0) continue;

    $data = json_decode((string)($r['data_json'] ?? ''), true);
    if (!is_array($data)) {
        $errors[] = ['entity_id' => $entityId, 'name' => (string)($r['name'] ?? ''), 'error' => 'Invalid data_json'];
        continue;
    }

    $agentId = (int)($data['agent_id'] ?? 0);
    if ($agentId <= 0) {
        $skipped++;
        continue;
    }

    $birthday = (string)($birthdaysByAgentId[$agentId] ?? '');
    if ($birthday === '') {
        $skipped++;
        continue;
    }

    if (!isset($data['static_profile']) || !is_array($data['static_profile'])) {
        $data['static_profile'] = [];
    }
    if (!isset($data['static_profile']['demographics']) || !is_array($data['static_profile']['demographics'])) {
        $data['static_profile']['demographics'] = [];
    }

    $existing = (string)($data['static_profile']['demographics']['birthday'] ?? '');
    if ($existing === $birthday) {
        $skipped++;
        continue;
    }

    $data['static_profile']['demographics']['birthday'] = $birthday;

    $json = json_encode($data);
    if (!is_string($json)) {
        $errors[] = ['entity_id' => $entityId, 'name' => (string)($r['name'] ?? ''), 'error' => 'Failed to encode updated JSON'];
        continue;
    }

    Database::execute('UPDATE mystery_entities SET data_json = ? WHERE id = ?', [$json, $entityId]);
    $updated++;
}

catn8_json_response([
    'success' => count($errors) === 0,
    'updated' => $updated,
    'skipped' => $skipped,
    'errors' => $errors,
]);
