<?php
/**
 * Fix live DB collation/type mismatch for items.sku and item_size_assignments.item_sku.
 * - Connects using CATN8_DB_LIVE_* env vars
 * - Alters database default to utf8mb4_unicode_ci
 * - Converts items and item_size_assignments tables and columns to utf8mb4_unicode_ci
 *   with VARCHAR(50) NOT NULL
 * - Drops/recreates the FK with CASCADE
 *
 * Usage:
 *   CATN8_DB_LIVE_HOST=... CATN8_DB_LIVE_NAME=... CATN8_DB_LIVE_USER=... CATN8_DB_LIVE_PASS=... \
 *   php scripts/db/fix_live_item_fk_collation.php
 */
$host = getenv('CATN8_DB_LIVE_HOST') ?: '';
$db   = getenv('CATN8_DB_LIVE_NAME') ?: '';
$user = getenv('CATN8_DB_LIVE_USER') ?: '';
$pass = getenv('CATN8_DB_LIVE_PASS') ?: '';
$port = getenv('CATN8_DB_LIVE_PORT') ?: 3306;

if (!$host || !$db || !$user) {
    fwrite(STDERR, "Missing CATN8_DB_LIVE_HOST/NAME/USER env vars.\n");
    exit(1);
}

$dsn = "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4";

function logline($msg) { echo $msg . "\n"; }
function execSql(PDO $pdo, string $sql) {
    $pdo->exec($sql);
    logline("[OK] {$sql}");
}

try {
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (Throwable $e) {
    fwrite(STDERR, "[ERR] Connection failed: {$e->getMessage()}\n");
    exit(1);
}

try {
    $targetDef = "VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL";

    // Set DB default
    logline("=== Setting database default collation to utf8mb4_unicode_ci ===");
    execSql($pdo, "ALTER DATABASE `{$db}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

    // Drop FK(s)
    logline("=== Dropping FKs on item_size_assignments.item_sku -> items.sku ===");
    $stmt = $pdo->query(
        "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'item_size_assignments'
           AND COLUMN_NAME = 'item_sku' AND REFERENCED_TABLE_NAME = 'items' AND REFERENCED_COLUMN_NAME = 'sku'"
    );
    $fks = $stmt->fetchAll();
    foreach ($fks as $fk) {
        $name = $fk['CONSTRAINT_NAME'];
        logline("Dropping FK {$name}...");
        execSql($pdo, "ALTER TABLE item_size_assignments DROP FOREIGN KEY `{$name}`");
    }

    // Convert tables
    logline("=== Converting tables to utf8mb4_unicode_ci ===");
    execSql($pdo, "ALTER TABLE items CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    execSql($pdo, "ALTER TABLE item_size_assignments CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

    // Align column definitions explicitly
    logline("=== Aligning columns to {$targetDef} ===");
    execSql($pdo, "ALTER TABLE items MODIFY sku {$targetDef}");
    execSql($pdo, "ALTER TABLE item_size_assignments MODIFY item_sku {$targetDef}");

    // Recreate FK
    $fkName = 'item_size_assignments_fk_items_sku';
    logline("=== Adding FK {$fkName} ===");
    execSql(
        $pdo,
        "ALTER TABLE item_size_assignments
         ADD CONSTRAINT `{$fkName}` FOREIGN KEY (`item_sku`) REFERENCES `items`(`sku`)
         ON DELETE CASCADE ON UPDATE CASCADE"
    );

    logline("=== Live collation/fk fix complete ===");
} catch (Throwable $e) {
    fwrite(STDERR, "[ERR] {$e->getMessage()}\n");
    exit(1);
}
