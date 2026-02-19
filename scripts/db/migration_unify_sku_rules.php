<?php
// scripts/db/migration_unify_sku_rules.php

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../includes/database.php';

echo "Starting migration: Unify SKU Rules into Categories table...\n";

try {
    // 1. Cleanup: Drop sku_prefix if I added it, use 'code' instead.
    try {
        Database::queryOne("SELECT sku_prefix FROM categories LIMIT 1");
        echo " - Dropping redundant 'sku_prefix' column (using existing 'code' column instead)...\n";
        Database::execute("ALTER TABLE categories DROP COLUMN sku_prefix");
    } catch (Exception $e) {
        // Column doesn't exist, good.
    }

    // 2. Migrate data from sku_rules to categories.code
    echo " - Migrating data from 'sku_rules' to 'categories.code'...\n";
    $rules = Database::queryAll("SELECT category_name, sku_prefix FROM sku_rules");
    $count = 0;
    $missing = 0;

    foreach ($rules as $rule) {
        $name = $rule['category_name'];
        $prefix = $rule['sku_prefix'];

        // Check if category exists
        $cat = Database::queryOne("SELECT id FROM categories WHERE name = ?", [$name]);
        
        if ($cat) {
            Database::execute("UPDATE categories SET code = ? WHERE id = ?", [$prefix, $cat['id']]);
            $count++;
        } else {
            echo "   ! Category '$name' not found in 'categories' table. Creating it.\n";
            try {
                // 'code' is required, so we use the prefix.
                Database::execute("INSERT INTO categories (name, code) VALUES (?, ?)", [$name, $prefix]);
                $missing++;
            } catch (Exception $e) {
                if (strpos($e->getMessage(), 'Duplicate entry') !== false) {
                    echo "     - SKIPPING: Code '$prefix' is already in use. Cannot create duplicate category '$name'.\n";
                } else {
                    throw $e;
                }
            }
        }
    }

    echo " - Migrated $count existing categories.\n";
    echo " - Created $missing new categories from orphaned SKU rules.\n";

    // 3. Verify
    $totalCats = Database::queryOne("SELECT COUNT(*) as c FROM categories")['c'];
    echo " - Total categories: $totalCats\n";

    echo "Migration complete. 'sku_rules' table can now be dropped manually or by script after verification.\n";

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
