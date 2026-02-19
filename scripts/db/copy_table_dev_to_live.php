<?php

// scripts/db/copy_table_dev_to_live.php
// Usage: php scripts/db/copy_table_dev_to_live.php items
// Copies a single table schema+data from DEV/local DB to LIVE DB using credentials from api/config.php
// Safe for pre-production mirroring. Requires CLI execution.

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

if (php_sapi_name() !== 'cli') {
    fwrite(STDERR, "Run from CLI only.\n");
    exit(2);
}

$table = $argv[1] ?? null;
if (!$table) {
    fwrite(STDERR, "Usage: php scripts/db/copy_table_dev_to_live.php <table>\n");
    exit(3);
}

require __DIR__ . '/../../api/config.php';

function open_pdo(array $cfg): PDO
{
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $cfg['host'], $cfg['db']);
    $pdo = new PDO($dsn, $cfg['user'], $cfg['pass'], [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

$dev = catn8_get_db_config('local');
$live = catn8_get_db_config('live');

$pdoDev = open_pdo($dev);
$pdoLive = open_pdo($live);

// Verify source exists
$exists = $pdoDev->query("SHOW TABLES LIKE " . $pdoDev->quote($table))->fetchColumn();
if (!$exists) {
    fwrite(STDERR, "Source table not found on DEV: $table\n");
    exit(4);
}

// Get CREATE TABLE from DEV
$createRow = $pdoDev->query("SHOW CREATE TABLE `{$table}`")->fetch(PDO::FETCH_ASSOC);
$createSql = $createRow['Create Table'] ?? null;
if (!$createSql) {
    fwrite(STDERR, "SHOW CREATE TABLE returned nothing for $table\n");
    exit(5);
}

fwrite(STDOUT, "Dropping and recreating $table on LIVE...\n");
$pdoLive->exec('SET FOREIGN_KEY_CHECKS=0');
$pdoLive->exec("DROP TABLE IF EXISTS `{$table}`");
$pdoLive->exec($createSql);

// Copy data in batches
$countRow = $pdoDev->query("SELECT COUNT(*) AS c FROM `{$table}`")->fetch(PDO::FETCH_ASSOC);
$total = (int)($countRow['c'] ?? 0);
fwrite(STDOUT, "DEV {$table} rows: {$total}\n");

if ($total > 0) {
    // Column list
    $cols = [];
    $colStmt = $pdoDev->query("SHOW COLUMNS FROM `{$table}`");
    while ($c = $colStmt->fetch(PDO::FETCH_ASSOC)) {
        $cols[] = $c['Field'];
    }
    $colList = '`' . implode('`,`', $cols) . '`';

    $batch = 500;
    for ($offset = 0; $offset < $total; $offset += $batch) {
        $stmt = $pdoDev->query("SELECT * FROM `{$table}` LIMIT {$batch} OFFSET {$offset}");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        if (!$rows) {
            continue;
        }
        // Build multi-values INSERT
        $values = [];
        foreach ($rows as $r) {
            $vals = [];
            foreach ($cols as $col) {
                $v = $r[$col] ?? null;
                if ($v === null) {
                    $vals[] = 'NULL';
                } else {
                    $vals[] = $pdoLive->quote($v);
                }
            }
            $values[] = '(' . implode(',', $vals) . ')';
            if (count($values) >= 200) {
                $pdoLive->exec("INSERT INTO `{$table}` ({$colList}) VALUES\n" . implode(",\n", $values));
                $values = [];
            }
        }
        if ($values) {
            $pdoLive->exec("INSERT INTO `{$table}` ({$colList}) VALUES\n" . implode(",\n", $values));
        }
        fwrite(STDOUT, "Inserted up to row " . min($offset + $batch, $total) . "\n");
    }
}

$pdoLive->exec('SET FOREIGN_KEY_CHECKS=1');
fwrite(STDOUT, "Copy complete.\n");
