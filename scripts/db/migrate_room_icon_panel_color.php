<?php
declare(strict_types=1);
// Migration helper to add the icon_panel_color column to room_settings and seed defaults.
// Usage (dry run – default): /scripts/db/migrate_room_icon_panel_color.php
// Execute changes:           /scripts/db/migrate_room_icon_panel_color.php?confirm=1&dry_run=0

error_reporting(E_ALL);
ini_set('display_errors', '1');
header('Content-Type: text/plain');

require_once __DIR__ . '/../../api/config.php';

try {
    Database::getInstance();
} catch (Throwable $e) {
    http_response_code(500);
    echo "DB connection failed: {$e->getMessage()}\n";
    exit;
}

$confirm = isset($_GET['confirm']) ? (int)$_GET['confirm'] : 0;
$dryRun = isset($_GET['dry_run']) ? (int)$_GET['dry_run'] : 1; // default: dry run

function hasColumn(string $table, string $column): bool
{
    try {
        $rows = Database::queryAll('DESCRIBE ' . $table);
        foreach ($rows as $row) {
            if (!empty($row['Field']) && $row['Field'] === $column) {
                return true;
            }
        }
    } catch (Throwable $e) {
        echo "Failed to inspect {$table}: {$e->getMessage()}\n";
    }
    return false;
}

$table = 'room_settings';
$ops = [];
$needsColumn = !hasColumn($table, 'icon_panel_color');

if ($needsColumn) {
    $ops[] = 'ALTER TABLE room_settings ADD COLUMN icon_panel_color VARCHAR(20) NULL DEFAULT NULL AFTER icons_white_background';
}

// Seed sensible defaults once the column exists
$ops[] = "UPDATE room_settings SET icon_panel_color = 'transparent' WHERE icon_panel_color IS NULL AND room_number = '1'";
$ops[] = "UPDATE room_settings SET icon_panel_color = '#FFFFFF' WHERE icon_panel_color IS NULL";

if (empty($ops)) {
    echo "No migration required – column already present and seeded.\n";
    exit;
}

echo "Migration plan (dry_run=" . ($dryRun ? '1' : '0') . ")\n";
foreach ($ops as $sql) {
    echo $sql . "\n";
}

if ($dryRun) {
    echo "-- DRY RUN -- No changes applied. Use ?confirm=1&dry_run=0 to execute.\n";
    exit;
}

if (!$confirm) {
    echo "-- CONFIRMATION REQUIRED -- Re-run with ?confirm=1&dry_run=0 to apply changes.\n";
    exit;
}

try {
    foreach ($ops as $sql) {
        Database::execute($sql);
    }
    echo "Migration completed successfully.\n";
} catch (Throwable $e) {
    http_response_code(500);
    echo "Migration failed: {$e->getMessage()}\n";
}
