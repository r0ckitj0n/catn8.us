<?php
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../includes/database.php';

echo "Renaming 'code' column to 'sku_rules' in 'categories' table...\n";

try {
    // Check if 'sku_rules' already exists
    try {
        Database::queryOne("SELECT sku_rules FROM categories LIMIT 1");
        echo " - 'sku_rules' column already exists.\n";
    } catch (Exception $e) {
        // Rename 'code' to 'sku_rules'
        // Assuming 'code' is VARCHAR(16) NOT NULL based on previous inspection
        Database::execute("ALTER TABLE categories CHANGE COLUMN code sku_rules VARCHAR(16) NOT NULL");
        echo " - Renamed 'code' to 'sku_rules'.\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    // If 'code' doesn't exist, maybe it was already renamed or dropped?
    if (strpos($e->getMessage(), "Unknown column 'code'") !== false) {
        echo " - Column 'code' not found. Maybe it was already renamed?\n";
    }
}
