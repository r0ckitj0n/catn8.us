<?php
declare(strict_types=1);
// Migration: add render_context + target_aspect_ratio to room_settings and seed values.
// Usage dry-run (default): /scripts/db/migrate_room_render_meta.php
// Execute: /scripts/db/migrate_room_render_meta.php?confirm=1&dry_run=0

error_reporting(E_ALL);
ini_set('display_errors', '1');
header('Content-Type: text/plain');

require_once __DIR__ . '/../../api/config.php';

try { Database::getInstance(); } catch (Throwable $e) { http_response_code(500); echo "DB connect failed: {$e->getMessage()}\n"; exit; }

$confirm = isset($_GET['confirm']) ? (int)$_GET['confirm'] : 0;
$dryRun = isset($_GET['dry_run']) ? (int)$_GET['dry_run'] : 1; // default dry run

function hasColumn(string $table, string $column): bool {
    try {
        $rows = Database::queryAll('DESCRIBE ' . $table);
        foreach ($rows as $r) {
            if (isset($r['Field']) && $r['Field'] === $column) return true;
        }
    } catch (Throwable $e) {}
    return false;
}

function getColumnType(string $table, string $column): ?string {
    try {
        $rows = Database::queryAll('DESCRIBE ' . $table);
        foreach ($rows as $r) {
            if (isset($r['Field']) && $r['Field'] === $column) {
                return isset($r['Type']) ? strtolower((string)$r['Type']) : null;
            }
        }
    } catch (Throwable $e) {}
    return null;
}

$table = 'room_settings';
$ops = [];

if (!hasColumn($table, 'render_context')) {
    $ops[] = 'ALTER TABLE room_settings ADD COLUMN render_context VARCHAR(10) NOT NULL DEFAULT "modal" AFTER room_name';
}
if (!hasColumn($table, 'target_aspect_ratio')) {
    $ops[] = 'ALTER TABLE room_settings ADD COLUMN target_aspect_ratio DECIMAL(8,5) NULL DEFAULT NULL AFTER render_context';
}

// Seed values
// Full pages: Landing A, Main 0, and B (marketing/landing) to 'page'
$colType = getColumnType('room_settings', 'room_number');
$isNumeric = $colType && preg_match('/int|decimal|float|double|bigint|smallint|tinyint/', $colType);
if ($isNumeric) {
    // Numeric room_number: only 0 is a page; letters aren't stored here
    $ops[] = "UPDATE room_settings SET render_context = 'page', target_aspect_ratio = NULL WHERE room_number = 0";
    $ops[] = "UPDATE room_settings SET render_context = 'modal', target_aspect_ratio = 1.42857 WHERE room_number <> 0";
} else {
    // String room_number: set A/0/B as page; numbers as modal
    $ops[] = "UPDATE room_settings SET render_context = 'page', target_aspect_ratio = NULL WHERE room_number IN ('A','0','B')";
    $ops[] = "UPDATE room_settings SET render_context = 'modal', target_aspect_ratio = 1.42857 WHERE room_number REGEXP '^[0-9]+$' AND room_number <> '0'";
}

// Report plan
echo "Migration plan (dry_run=" . ($dryRun ? '1' : '0') . ")\n";
foreach ($ops as $sql) echo $sql . "\n";

if ($dryRun) {
    echo "-- DRY RUN -- No changes applied. Use ?confirm=1&dry_run=0 to execute.\n";
    exit;
}

if (!$confirm) {
    echo "Refusing to run without &confirm=1 when dry_run=0.\n";
    exit;
}

try {
    Database::beginTransaction();
    foreach ($ops as $sql) {
        $affected = Database::execute($sql);
        echo $sql . " => OK (affected=" . (int)$affected . ")\n";
    }
    Database::commit();
    echo "Done.\n";
} catch (Throwable $e) {
    try { if (Database::inTransaction()) Database::rollBack(); } catch (Throwable $t) {}
    echo "Error: {$e->getMessage()}\n";
}
