<?php
/**
 * Align item_size_assignments.item_sku with items.sku and recreate FK.
 * Usage: php scripts/db/fix_item_size_fk.php
 */
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../includes/database.php';

function out($msg) {
    echo $msg . "\n";
}

try {
    $db = Database::getInstance();
} catch (Throwable $e) {
    fwrite(STDERR, "[ERR] DB connection failed: " . $e->getMessage() . "\n");
    exit(1);
}

try {
    out("=== Inspecting items.sku definition ===");
    $col = Database::queryOne(
        "SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLLATION_NAME, CHARACTER_SET_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items' AND COLUMN_NAME = 'sku'"
    );

    if (!$col) {
        throw new RuntimeException("items.sku column not found; aborting");
    }

    $columnType = $col['COLUMN_TYPE']; // e.g., varchar(50)
    $nullable   = strtoupper($col['IS_NULLABLE']) === 'YES';
    $default    = $col['COLUMN_DEFAULT'];
    $collation  = $col['COLLATION_NAME'];
    $charset    = $col['CHARACTER_SET_NAME'];

    $parts = [];
    $parts[] = strtoupper($columnType);
    if ($charset) {
        $parts[] = "CHARACTER SET {$charset}";
    }
    if ($collation) {
        $parts[] = "COLLATE {$collation}";
    }
    $parts[] = $nullable ? 'NULL' : 'NOT NULL';

    // Default handling: if nullable and default null, explicit DEFAULT NULL; if non-null and default defined, include it.
    if ($default !== null) {
        $parts[] = "DEFAULT " . Database::quote($default);
    } elseif ($nullable) {
        $parts[] = "DEFAULT NULL";
    }

    $itemSkuDefinition = implode(' ', $parts);
    out("items.sku definition reconstructed as: {$itemSkuDefinition}");

    // Drop existing FKs referencing items.sku from item_size_assignments
    out("=== Dropping existing FKs on item_size_assignments(item_sku) referencing items.sku ===");
    $fks = Database::queryAll(
        "SELECT CONSTRAINT_NAME
         FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'item_size_assignments'
           AND COLUMN_NAME = 'item_sku'
           AND REFERENCED_TABLE_NAME = 'items'
           AND REFERENCED_COLUMN_NAME = 'sku'"
    );
    foreach ($fks as $fk) {
        $name = $fk['CONSTRAINT_NAME'];
        out("Dropping FK {$name}...");
        Database::execute("ALTER TABLE item_size_assignments DROP FOREIGN KEY `{$name}`");
    }

    // Align column definition
    out("=== Modifying item_size_assignments.item_sku to match items.sku ===");
    Database::execute("ALTER TABLE item_size_assignments MODIFY item_sku {$itemSkuDefinition}");

    // Recreate FK with a consistent name
    $newFkName = 'item_size_assignments_fk_items_sku';
    out("=== Adding FK {$newFkName} ===");
    Database::execute(
        "ALTER TABLE item_size_assignments
         ADD CONSTRAINT `{$newFkName}` FOREIGN KEY (`item_sku`) REFERENCES `items`(`sku`)
         ON DELETE CASCADE ON UPDATE CASCADE"
    );

    out("=== Completed successfully ===");
} catch (Throwable $e) {
    fwrite(STDERR, "[ERR] " . $e->getMessage() . "\n");
    exit(1);
}
