<?php
/**
 * Normalize items.sku and item_size_assignments.item_sku to VARCHAR(50) utf8mb4_unicode_ci
 * and recreate the FK using a direct PDO connection (useful for targeting LIVE).
 *
 * Usage:
 *   CATN8_DB_HOST=... CATN8_DB_NAME=... CATN8_DB_USER=... CATN8_DB_PASS=... \
 *   php scripts/db/fix_item_size_fk_remote.php
 */

$host = getenv('CATN8_DB_HOST') ?: '';
$db   = getenv('CATN8_DB_NAME') ?: '';
$user = getenv('CATN8_DB_USER') ?: '';
$pass = getenv('CATN8_DB_PASS') ?: '';
$port = getenv('CATN8_DB_PORT') ?: 3306;

if (!$host || !$db || !$user) {
    fwrite(STDERR, "Missing CATN8_DB_HOST, CATN8_DB_NAME, or CATN8_DB_USER env vars.\n");
    exit(1);
}

$dsn = "mysql:host={$host};port={$port};dbname={$db};charset=utf8mb4";

try {
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (Throwable $e) {
    fwrite(STDERR, "[ERR] Connection failed: {$e->getMessage()}\n");
    exit(1);
}

function logline($msg) { echo $msg . "\n"; }
function execSql(PDO $pdo, string $sql) {
    $pdo->exec($sql);
    logline("[OK] {$sql}");
}

try {
    $targetDef = "VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL";

    logline("=== Dropping FKs on item_size_assignments.item_sku -> items.sku ===");
    $stmt = $pdo->prepare(
        "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'item_size_assignments'
           AND COLUMN_NAME = 'item_sku' AND REFERENCED_TABLE_NAME = 'items' AND REFERENCED_COLUMN_NAME = 'sku'"
    );
    $stmt->execute();
    $fks = $stmt->fetchAll();
    foreach ($fks as $fk) {
        $name = $fk['CONSTRAINT_NAME'];
        logline("Dropping FK {$name}...");
        execSql($pdo, "ALTER TABLE item_size_assignments DROP FOREIGN KEY `{$name}`");
    }

    logline("=== Aligning items.sku to {$targetDef} ===");
    execSql($pdo, "ALTER TABLE items MODIFY sku {$targetDef}");

    logline("=== Aligning item_size_assignments.item_sku to {$targetDef} ===");
    execSql($pdo, "ALTER TABLE item_size_assignments MODIFY item_sku {$targetDef}");

    $fkName = 'item_size_assignments_fk_items_sku';
    logline("=== Adding FK {$fkName} ===");
    execSql(
        $pdo,
        "ALTER TABLE item_size_assignments
         ADD CONSTRAINT `{$fkName}` FOREIGN KEY (`item_sku`) REFERENCES `items`(`sku`)
         ON DELETE CASCADE ON UPDATE CASCADE"
    );

    logline("=== Done (remote) ===");
} catch (Throwable $e) {
    fwrite(STDERR, "[ERR] {$e->getMessage()}\n");
    exit(1);
}
