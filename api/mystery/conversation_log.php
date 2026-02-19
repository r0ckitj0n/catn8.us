<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_session_start();
$viewerId = catn8_require_group_or_admin('mystery-game-users');
$isAdmin = catn8_user_is_admin($viewerId);

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

try {
    Database::queryOne('SELECT id FROM mystery_conversation_events LIMIT 1');
} catch (Throwable $e) {
    catn8_json_response([
        'success' => false,
        'error' => 'Mystery conversation log table is not initialized',
    ], 500);
}

if ($method === 'GET') {
    $scenarioId = (int)($_GET['scenario_id'] ?? 0);
    if ($scenarioId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid scenario_id'], 400);
    }

    if (!$isAdmin) {
        $srow = Database::queryOne(
            'SELECT g.owner_user_id
             FROM mystery_scenarios s
             INNER JOIN mystery_games g ON g.id = s.game_id
             WHERE s.id = ?
             LIMIT 1',
            [$scenarioId]
        );
        if (!$srow) {
            catn8_json_response(['success' => false, 'error' => 'Scenario not found'], 404);
        }
        if ((int)($srow['owner_user_id'] ?? 0) !== $viewerId) {
            catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
        }
    }

    $channel = trim((string)($_GET['channel'] ?? ''));
    $entityId = isset($_GET['entity_id']) ? (int)($_GET['entity_id'] ?? 0) : null;
    $limit = (int)($_GET['limit'] ?? 200);
    if ($limit <= 0) $limit = 200;
    if ($limit > 500) $limit = 500;

    $where = 'WHERE scenario_id = ?';
    $params = [$scenarioId];

    if ($channel !== '') {
        $where .= ' AND channel = ?';
        $params[] = $channel;
    }

    if ($entityId !== null && $entityId > 0) {
        $where .= ' AND entity_id = ?';
        $params[] = $entityId;
    }

    $params[] = $limit;

    $rows = Database::queryAll(
        'SELECT id, scenario_id, entity_id, channel, provider, role, content_text, meta_json, created_at ' .
        'FROM mystery_conversation_events ' .
        $where .
        ' ORDER BY id ASC LIMIT ?',
        $params
    );

    $events = array_map(static function (array $r): array {
        $meta = json_decode((string)($r['meta_json'] ?? '{}'), true);
        if (!is_array($meta)) $meta = [];

        return [
            'id' => (int)($r['id'] ?? 0),
            'scenario_id' => (int)($r['scenario_id'] ?? 0),
            'entity_id' => (int)($r['entity_id'] ?? 0),
            'channel' => (string)($r['channel'] ?? ''),
            'provider' => (string)($r['provider'] ?? ''),
            'role' => (string)($r['role'] ?? ''),
            'content_text' => (string)($r['content_text'] ?? ''),
            'meta' => $meta,
            'created_at' => (string)($r['created_at'] ?? ''),
        ];
    }, $rows);

    catn8_json_response([
        'success' => true,
        'events' => $events,
    ]);
}

if ($method !== 'POST') {
    catn8_json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

catn8_rate_limit_require('mystery.conversation_log.post.' . $viewerId, 300, 600);

$body = catn8_read_json_body();

$scenarioId = (int)($body['scenario_id'] ?? 0);
if ($scenarioId <= 0) {
    catn8_json_response(['success' => false, 'error' => 'Invalid scenario_id'], 400);
}

if (!$isAdmin) {
    $srow = Database::queryOne(
        'SELECT g.owner_user_id
         FROM mystery_scenarios s
         INNER JOIN mystery_games g ON g.id = s.game_id
         WHERE s.id = ?
         LIMIT 1',
        [$scenarioId]
    );
    if (!$srow) {
        catn8_json_response(['success' => false, 'error' => 'Scenario not found'], 404);
    }
    if ((int)($srow['owner_user_id'] ?? 0) !== $viewerId) {
        catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
    }
}

$entityIdRaw = $body['entity_id'] ?? null;
$entityId = null;
if ($entityIdRaw !== null) {
    $entityId = (int)$entityIdRaw;
    if ($entityId <= 0) $entityId = null;
}

$channel = trim((string)($body['channel'] ?? ''));
$provider = trim((string)($body['provider'] ?? ''));
$role = trim((string)($body['role'] ?? ''));
$content = trim((string)($body['content_text'] ?? ''));

if ($channel === '' || $provider === '' || $role === '' || $content === '') {
    catn8_json_response([
        'success' => false,
        'error' => 'channel, provider, role, and content_text are required',
    ], 400);
}

$meta = $body['meta'] ?? [];
if (!is_array($meta)) {
    catn8_json_response(['success' => false, 'error' => 'meta must be an object'], 400);
}

$metaJson = json_encode($meta, JSON_UNESCAPED_SLASHES);
if (!is_string($metaJson)) {
    $metaJson = json_encode(new stdClass(), JSON_UNESCAPED_SLASHES);
}

Database::execute(
    'INSERT INTO mystery_conversation_events (scenario_id, entity_id, channel, provider, role, content_text, meta_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [$scenarioId, $entityId, $channel, $provider, $role, $content, $metaJson]
);

$row = Database::queryOne(
    'SELECT id, created_at FROM mystery_conversation_events WHERE scenario_id = ? ORDER BY id DESC LIMIT 1',
    [$scenarioId]
);

catn8_json_response([
    'success' => true,
    'id' => (int)($row['id'] ?? 0),
    'created_at' => (string)($row['created_at'] ?? ''),
]);
