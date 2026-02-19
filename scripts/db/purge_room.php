<?php
declare(strict_types=1);
// Safe purge for a given room_number across known tables.
// Usage (dry-run default): /scripts/db/purge_room.php?room=6
// Execute: /scripts/db/purge_room.php?room=6&confirm=1&dry_run=0

error_reporting(E_ALL);
ini_set('display_errors', '1');
header('Content-Type: text/plain');

require_once __DIR__ . '/../../api/config.php';
require_once __DIR__ . '/../../includes/response.php';

try { Database::getInstance(); } catch (Throwable $e) { http_response_code(500); echo "DB connect failed: {$e->getMessage()}\n"; exit; }

$room = isset($_GET['room']) ? trim((string)$_GET['room']) : '';
$confirm = isset($_GET['confirm']) ? (int)$_GET['confirm'] : 0;
$dryRun = isset($_GET['dry_run']) ? (int)$_GET['dry_run'] : 1; // default dry-run

if ($room === '') { echo "Missing ?room= parameter (e.g., 6, 0, A)\n"; exit; }

function hasTable(string $name): bool {
    try {
        $rows = Database::queryAll('SHOW TABLES');
        foreach ($rows as $row) { if (in_array($name, array_values($row), true)) return true; }
    } catch (Throwable $e) {}
    return false;
}

$tables = [
    'room_maps' => 'room_number',
    'room_category_assignments' => 'room_number',
    'room_status' => 'room_number',
    'area_mappings' => 'room_number',
    'room_settings' => 'room_number',
];

$existing = [];
foreach ($tables as $t => $_col) { if (hasTable($t)) $existing[] = $t; }

echo "Purging references for room '{$room}' (dry_run=" . ($dryRun ? '1' : '0') . ")\n";
if (!$confirm && !$dryRun) {
    echo "Refusing to run without &confirm=1 when dry_run=0.\n";
    exit;
}

$ops = [];
foreach ($existing as $t) {
    // Build operation per table
    if ($t === 'room_settings') {
        // Remove room_settings row entirely
        $ops[] = ["DELETE FROM room_settings WHERE room_number = ?", [$room]];
    } else {
        // Generic delete by room_number
        $ops[] = ["DELETE FROM {$t} WHERE room_number = ?", [$room]];
    }
}

if ($dryRun) {
    echo "-- DRY RUN --\n";
    foreach ($ops as [$sql, $params]) {
        echo $sql . ' | params=' . json_encode($params) . "\n";
        try {
            $count = Database::queryOne("SELECT COUNT(*) AS c FROM (" . str_replace('DELETE', 'SELECT *', $sql) . ") sub", $params)['c'] ?? null;
        } catch (Throwable $e) { $count = '?'; }
        echo "would affect: {$count} rows\n";
    }
    echo "No changes applied. Append &dry_run=0&confirm=1 to execute.\n";
    exit;
}

try {
    Database::beginTransaction();
    foreach ($ops as [$sql, $params]) {
        $affected = Database::execute($sql, $params);
        echo $sql . ' | params=' . json_encode($params) . " => affected={$affected}\n";
    }
    Database::commit();
    echo "Done.\n";
} catch (Throwable $e) {
    try { if (Database::inTransaction()) Database::rollBack(); } catch (Throwable $t) {}
    http_response_code(500);
    echo "Error: {$e->getMessage()}\n";
}
