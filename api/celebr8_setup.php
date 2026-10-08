<?php

declare(strict_types=1);

/**
 * One-shot / rotatable Celebr8 token bootstrap.
 * Protected by CATN8_ADMIN_TOKEN (same pattern as database_maintenance).
 * Returns plaintext tokens once so they can be stored on Jon's Mac; server keeps SHA-256 hashes only.
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/celebr8_model.php';

catn8_require_method('POST', false);

$expected = trim((string)catn8_env('CATN8_ADMIN_TOKEN', ''));
$got = trim((string)($_GET['admin_token'] ?? $_POST['admin_token'] ?? ''));
if ($expected === '' || $got === '' || !hash_equals($expected, $got)) {
    catn8_json_response(['success' => false, 'error' => 'Invalid admin token'], 403);
}

Celebr8Model::ensureSchema();

$agentToken = Celebr8Model::rotateApiToken(Celebr8Model::AGENT_TOKEN_SECRET_KEY);
$relayToken = Celebr8Model::rotateApiToken(Celebr8Model::RELAY_TOKEN_SECRET_KEY);

$events = Celebr8Model::listEvents();

catn8_json_response([
    'success' => true,
    'events' => $events,
    'tokens' => [
        'agent' => $agentToken,
        'relay' => $relayToken,
    ],
    'secret_keys' => [
        'agent' => Celebr8Model::AGENT_TOKEN_SECRET_KEY,
        'relay' => Celebr8Model::RELAY_TOKEN_SECRET_KEY,
    ],
    'note' => 'Store plaintext tokens on the Mac only; server stores SHA-256 hashes in secrets.',
]);
