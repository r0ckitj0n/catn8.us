<?php

declare(strict_types=1);

require_once __DIR__ . '/../../api/bootstrap.php';

if (PHP_SAPI !== 'cli') {
    catn8_require_admin();
}

function catn8_db_table_exists(string $tableName): bool
{
    $row = Database::queryOne(
        "SELECT 1 AS ok FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1",
        [$tableName]
    );
    return $row !== null;
}

function catn8_db_column_exists(string $tableName, string $columnName): bool
{
    $row = Database::queryOne(
        "SELECT 1 AS ok FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1",
        [$tableName, $columnName]
    );
    return $row !== null;
}

function catn8_db_index_exists(string $tableName, string $indexName): bool
{
    $row = Database::queryOne(
        "SELECT 1 AS ok FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1",
        [$tableName, $indexName]
    );
    return $row !== null;
}

$addedColumns = 0;
$addedIndexes = 0;

// 1) Backstory: store the canonical master location for the case foundation
$backstoryTable = 'mystery_backstories';
if (!catn8_db_table_exists($backstoryTable)) {
    catn8_json_response(['success' => false, 'error' => 'Missing table: mystery_backstories'], 500);
}

$backstoryColumns = [
    'location_master_id' => "ALTER TABLE mystery_backstories ADD COLUMN location_master_id INT NULL",
];
foreach ($backstoryColumns as $col => $ddl) {
    if (!catn8_db_column_exists($backstoryTable, $col)) {
        Database::execute($ddl);
        $addedColumns += 1;
    }
}

if (!catn8_db_index_exists($backstoryTable, 'idx_mystery_backstories_location_master_id')) {
    Database::execute('CREATE INDEX idx_mystery_backstories_location_master_id ON mystery_backstories (location_master_id)');
    $addedIndexes += 1;
}

// 2) Scenario: canonical references + CSI report fields
$scenarioTable = 'mystery_scenarios';
if (!catn8_db_table_exists($scenarioTable)) {
    catn8_json_response(['success' => false, 'error' => 'Missing table: mystery_scenarios'], 500);
}

$scenarioColumns = [
    'crime_scene_location_master_id' => "ALTER TABLE mystery_scenarios ADD COLUMN crime_scene_location_master_id INT NULL",
    'csi_detective_entity_id' => "ALTER TABLE mystery_scenarios ADD COLUMN csi_detective_entity_id INT NULL",
    'csi_report_text' => "ALTER TABLE mystery_scenarios ADD COLUMN csi_report_text LONGTEXT NULL",
    'csi_report_json' => "ALTER TABLE mystery_scenarios ADD COLUMN csi_report_json LONGTEXT NULL",
];
foreach ($scenarioColumns as $col => $ddl) {
    if (!catn8_db_column_exists($scenarioTable, $col)) {
        Database::execute($ddl);
        $addedColumns += 1;
    }
}

if (!catn8_db_index_exists($scenarioTable, 'idx_mystery_scenarios_crime_scene_location_master_id')) {
    Database::execute('CREATE INDEX idx_mystery_scenarios_crime_scene_location_master_id ON mystery_scenarios (crime_scene_location_master_id)');
    $addedIndexes += 1;
}

if (!catn8_db_index_exists($scenarioTable, 'idx_mystery_scenarios_csi_detective_entity_id')) {
    Database::execute('CREATE INDEX idx_mystery_scenarios_csi_detective_entity_id ON mystery_scenarios (csi_detective_entity_id)');
    $addedIndexes += 1;
}

catn8_json_response([
    'success' => true,
    'added_columns' => $addedColumns,
    'added_indexes' => $addedIndexes,
]);
