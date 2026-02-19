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

$createdTables = 0;
$addedColumns = 0;
$addedIndexes = 0;
$backfilled = 0;
$insertedMurderers = 0;

// 1) Add canonical crime scene columns to mystery_scenarios
$scenarioTable = 'mystery_scenarios';
$columnsToAdd = [
    'crime_scene_weapon' => "ALTER TABLE mystery_scenarios ADD COLUMN crime_scene_weapon VARCHAR(255) NULL",
    'crime_scene_motive' => "ALTER TABLE mystery_scenarios ADD COLUMN crime_scene_motive VARCHAR(255) NULL",
    'crime_scene_location' => "ALTER TABLE mystery_scenarios ADD COLUMN crime_scene_location VARCHAR(255) NULL",
];

foreach ($columnsToAdd as $col => $ddl) {
    if (!catn8_db_column_exists($scenarioTable, $col)) {
        Database::execute($ddl);
        $addedColumns += 1;
    }
}

// Helpful index for filtering/search
if (!catn8_db_index_exists($scenarioTable, 'idx_mystery_scenarios_crime_scene_location')) {
    Database::execute('CREATE INDEX idx_mystery_scenarios_crime_scene_location ON mystery_scenarios (crime_scene_location)');
    $addedIndexes += 1;
}

// 2) Create join table for murderer entity IDs per scenario
$murdererTable = 'mystery_scenario_murderers';
if (!catn8_db_table_exists($murdererTable)) {
    Database::execute(
        "CREATE TABLE mystery_scenario_murderers (\n" .
        "  id INT AUTO_INCREMENT PRIMARY KEY,\n" .
        "  scenario_id INT NOT NULL,\n" .
        "  entity_id INT NOT NULL,\n" .
        "  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n" .
        "  UNIQUE KEY uniq_scenario_entity (scenario_id, entity_id),\n" .
        "  KEY idx_scenario_id (scenario_id),\n" .
        "  KEY idx_entity_id (entity_id),\n" .
        "  CONSTRAINT fk_mystery_scenario_murderers_scenario FOREIGN KEY (scenario_id) REFERENCES mystery_scenarios(id) ON DELETE CASCADE,\n" .
        "  CONSTRAINT fk_mystery_scenario_murderers_entity FOREIGN KEY (entity_id) REFERENCES mystery_entities(id) ON DELETE CASCADE\n" .
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $createdTables += 1;
}

// 3) Backfill values from constraints_json.winning_criteria (DB JSON) into new canonical columns
$rows = Database::queryAll('SELECT id, game_id, constraints_json FROM mystery_scenarios ORDER BY id ASC');

Database::beginTransaction();
try {
    foreach ($rows as $r) {
        $scenarioId = (int)($r['id'] ?? 0);
        if ($scenarioId <= 0) continue;

        $constraintsRaw = (string)($r['constraints_json'] ?? '{}');
        $constraints = json_decode($constraintsRaw, true);
        if (!is_array($constraints)) {
            $constraints = [];
        }

        $wc = $constraints['winning_criteria'] ?? null;
        if (!is_array($wc)) {
            continue;
        }

        $weapon = trim((string)($wc['weapon'] ?? ''));
        $motive = trim((string)($wc['motive'] ?? ''));
        $location = trim((string)($wc['location'] ?? ''));

        // Only write if at least one exists, and avoid overwriting if already set.
        $current = Database::queryOne(
            'SELECT crime_scene_weapon, crime_scene_motive, crime_scene_location FROM mystery_scenarios WHERE id = ? LIMIT 1',
            [$scenarioId]
        );
        if ($current) {
            $curWeapon = trim((string)($current['crime_scene_weapon'] ?? ''));
            $curMotive = trim((string)($current['crime_scene_motive'] ?? ''));
            $curLocation = trim((string)($current['crime_scene_location'] ?? ''));

            $nextWeapon = $curWeapon !== '' ? $curWeapon : ($weapon !== '' ? $weapon : null);
            $nextMotive = $curMotive !== '' ? $curMotive : ($motive !== '' ? $motive : null);
            $nextLocation = $curLocation !== '' ? $curLocation : ($location !== '' ? $location : null);

            if ($nextWeapon !== $curWeapon || $nextMotive !== $curMotive || $nextLocation !== $curLocation) {
                Database::execute(
                    'UPDATE mystery_scenarios SET crime_scene_weapon = ?, crime_scene_motive = ?, crime_scene_location = ? WHERE id = ?',
                    [$nextWeapon, $nextMotive, $nextLocation, $scenarioId]
                );
                $backfilled += 1;
            }
        }

        $murdererIds = [];
        if (isset($wc['murderer_ids']) && is_array($wc['murderer_ids'])) {
            $murdererIds = array_map('intval', $wc['murderer_ids']);
        } elseif (isset($wc['murderer_id'])) {
            $murdererIds = [(int)($wc['murderer_id'] ?? 0)];
        }
        $murdererIds = array_values(array_filter($murdererIds, static fn($n) => (int)$n > 0));

        foreach ($murdererIds as $eid) {
            // Only insert if the entity belongs to the same case as the scenario.
            $entity = Database::queryOne('SELECT id, game_id FROM mystery_entities WHERE id = ? LIMIT 1', [(int)$eid]);
            if (!$entity) continue;
            $entityCaseId = (int)($entity['game_id'] ?? 0);
            $scenarioCaseId = (int)($r['game_id'] ?? 0);
            if ($entityCaseId <= 0 || $scenarioCaseId <= 0 || $entityCaseId !== $scenarioCaseId) {
                continue;
            }

            $n = Database::execute(
                'INSERT IGNORE INTO mystery_scenario_murderers (scenario_id, entity_id) VALUES (?, ?)',
                [$scenarioId, (int)$eid]
            );
            if ($n > 0) {
                $insertedMurderers += 1;
            }
        }
    }

    Database::commit();
} catch (Throwable $e) {
    try {
        Database::getInstance()->rollBack();
    } catch (Throwable $_e2) {
    }
    throw $e;
}

catn8_json_response([
    'success' => true,
    'created_tables' => $createdTables,
    'added_columns' => $addedColumns,
    'added_indexes' => $addedIndexes,
    'scenarios_backfilled' => $backfilled,
    'murderers_inserted' => $insertedMurderers,
]);
