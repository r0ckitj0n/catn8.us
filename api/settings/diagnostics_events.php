<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../includes/diagnostics_log.php';

catn8_session_start();
catn8_require_admin();

catn8_require_method('GET');

$limit = (int)($_GET['limit'] ?? 50);
if ($limit < 1) $limit = 1;
if ($limit > 200) $limit = 200;

$eventKey = trim((string)($_GET['event_key'] ?? ''));
$onlyFailures = (string)($_GET['only_failures'] ?? '1');
$onlyFailures = ($onlyFailures === '1' || strtolower($onlyFailures) === 'true');

$where = [];
$params = [];

if ($eventKey !== '') {
    $where[] = 'event_key = ?';
    $params[] = $eventKey;
}

if ($onlyFailures) {
    $where[] = 'ok = 0';
}

$sql = 'SELECT id, created_at, user_id, endpoint, event_key, ok, http_status, message, meta_json, ip, user_agent FROM catn8_diagnostics_events';
if ($where) {
    $sql .= ' WHERE ' . implode(' AND ', $where);
}
$sql .= ' ORDER BY id DESC LIMIT ' . $limit;

try {
    $rows = Database::queryAll($sql, $params);
    catn8_json_response(['success' => true, 'events' => $rows]);
} catch (Throwable $e) {
    catn8_json_response(['success' => false, 'error' => 'Failed to load diagnostic events'], 500);
}
