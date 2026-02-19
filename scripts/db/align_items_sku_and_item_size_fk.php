<?php
/**
 * Normalize items.sku and item_size_assignments.item_sku to VARCHAR(50) utf8mb4_unicode_ci
 * and recreate FK. Run on the DB that will be dumped (e.g., local dev) before deploy_full.
 * Usage: php scripts/db/align_items_sku_and_item_size_fk.php
 */
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../includes/database.php';

function logline($msg) { echo $msg . "\n"; }

try {
    $db = Database::getInstance();
} catch (Throwable $e) {
    fwrite(STDERR, "[ERR] DB connection failed: " . $e->getMessage() . "\n");
    exit(1);
}

try {
    $targetDef = "VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL";

    logline("=== Dropping FKs on item_size_assignments.item_sku -> items.sku ===");
    $fks = Database::queryAll(
        "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'item_size_assignments'
           AND COLUMN_NAME = 'item_sku' AND REFERENCED_TABLE_NAME = 'items' AND REFERENCED_COLUMN_NAME = 'sku'"
    );
    foreach ($fks as $fk) {
        $name = $fk['CONSTRAINT_NAME'];
        logline("Dropping FK {$name}...");
        Database::execute("ALTER TABLE item_size_assignments DROP FOREIGN KEY `{$name}`");
    }

    logline("=== Aligning items.sku to {$targetDef} ===");
    Database::execute("ALTER TABLE items MODIFY sku {$targetDef}");

    logline("=== Aligning item_size_assignments.item_sku to {$targetDef} ===");
    Database::execute("ALTER TABLE item_size_assignments MODIFY item_sku {$targetDef}");

    $fkName = 'item_size_assignments_fk_items_sku';
    logline("=== Adding FK {$fkName} ===");
    Database::execute(
        "ALTER TABLE item_size_assignments
         ADD CONSTRAINT `{$fkName}` FOREIGN KEY (`item_sku`) REFERENCES `items`(`sku`)
         ON DELETE CASCADE ON UPDATE CASCADE"
    );

    logline("=== Done ===");
} catch (Throwable $e) {
    fwrite(STDERR, "[ERR] " . $e->getMessage() . "\n");
    exit(1);
}
