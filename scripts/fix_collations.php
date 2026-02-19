<?php
/**
 * Fix area_mappings-related collation mismatches (utf8mb4_unicode_ci vs utf8mb4_0900_ai_ci).
 * Run via CLI: php scripts/fix_collations.php
 * Assumes config.php sets up Database connection.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/database.php';

$tables = [
    'area_mappings',
    'room_settings',
    'items',
    'item_images',
    'item_color_assignments',
    'item_marketing_preferences',
    'item_size_assignments',
];

// Optional per-column adjustments (skip missing columns gracefully)
$columnsByTable = [
    'area_mappings' => [
        'room_number'    => 'VARCHAR(50)',
        'area_selector'  => 'VARCHAR(255)',
        'item_sku'       => 'VARCHAR(100)',
        'category_id'    => 'VARCHAR(100)',
        'link_url'       => 'TEXT',
        'link_label'     => 'VARCHAR(255)',
        'link_icon'      => 'VARCHAR(255)',
        'link_image'     => 'VARCHAR(255)',
        'content_target' => 'VARCHAR(255)',
        'content_image'  => 'VARCHAR(255)',
    ],
    'room_settings' => [
        'room_number' => 'VARCHAR(50)',
        'room_name'   => 'VARCHAR(255)',
        'door_label'  => 'VARCHAR(255)',
    ],
    'items' => [
        'sku'      => 'VARCHAR(100)',
        'name'     => 'VARCHAR(255)',
        'category' => 'VARCHAR(255)',
        'imageUrl' => 'VARCHAR(255)',
    ],
    'item_images' => [
        'sku'        => 'VARCHAR(100)',
        'image_path' => 'VARCHAR(255)',
    ],
    'item_color_assignments' => [
        'item_sku'    => 'VARCHAR(100)',
    ],
    'item_marketing_preferences' => [
        // columns discovered dynamically below
    ],
    'item_size_assignments' => [
        // columns discovered dynamically below
    ],
];

function currentDbName()
{
    // Prefer env or config constants if present
    if (defined('DB_NAME')) {
        return DB_NAME;
    }
    $env = getenv('DB_NAME');
    if ($env) return $env;
    // Fallback: ask the DB
    try {
        $row = Database::queryOne("SELECT DATABASE() AS dbname");
        if ($row && !empty($row['dbname'])) {
            return $row['dbname'];
        }
    } catch (Throwable $e) {
    }
    return null;
}

function runQuery($sql, $params = [])
{
    try {
        Database::execute($sql, $params);
        echo "[OK] $sql\n";
    } catch (Throwable $e) {
        echo "[ERR] $sql\n";
        echo "      " . $e->getMessage() . "\n";
    }
}

$dbName = currentDbName();
if ($dbName) {
    echo "=== Fixing database default collation to utf8mb4_unicode_ci for {$dbName} ===\n";
    runQuery("ALTER DATABASE `{$dbName}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
} else {
    echo "[WARN] Could not detect DB name; skipping ALTER DATABASE. Table/column alters will still run.\n";
}

// Handle FK on item_color_assignments -> items.sku to allow conversion
echo "=== Dropping FKs referencing items.sku (auto-discovered) ===\n";
$fkRows = [];
try {
    $fkRows = Database::queryAll(
        "SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME
         FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
         WHERE REFERENCED_TABLE_NAME = 'items' AND REFERENCED_COLUMN_NAME = 'sku' AND CONSTRAINT_SCHEMA = DATABASE()"
    );
} catch (Throwable $e) {
    echo "[WARN] Could not query INFORMATION_SCHEMA: " . $e->getMessage() . "\n";
}
foreach ($fkRows as $fk) {
    $c = $fk['CONSTRAINT_NAME'];
    $t = $fk['TABLE_NAME'];
    echo "Dropping FK $c on $t\n";
    runQuery("ALTER TABLE `$t` DROP FOREIGN KEY `$c`");
}

foreach ($tables as $table) {
    echo "=== Converting table $table ===\n";
    runQuery("ALTER TABLE $table CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    if (isset($columnsByTable[$table])) {
        foreach ($columnsByTable[$table] as $col => $type) {
            $sql = "ALTER TABLE $table MODIFY $col $type CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci";
            runQuery($sql);
        }
    }
}

// Recreate FKs we dropped
echo "=== Recreating FKs referencing items.sku ===\n";
foreach ($fkRows as $fk) {
    $c = $fk['CONSTRAINT_NAME'];
    $t = $fk['TABLE_NAME'];
    $col = $fk['COLUMN_NAME'];
    echo "Recreating FK $c on $t($col) -> items(sku)\n";
    runQuery("ALTER TABLE `$t` ADD CONSTRAINT `$c` FOREIGN KEY (`$col`) REFERENCES `items`(`sku`) ON DELETE CASCADE ON UPDATE CASCADE");
}

echo "=== Collation fix complete ===\n";
