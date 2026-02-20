<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/config.php';

const CATN8_IMPORT_MARKER_TEXTS = [
    'Imported from 91 Singletree Ln source folder.',
    'Imported from 91 Singletree Ln source folder',
];

function catn8_parse_flag(array $argv, string $flag): bool
{
    return in_array($flag, $argv, true);
}

function catn8_safe_identifier(string $value): string
{
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $value)) {
        throw new RuntimeException('Unsafe SQL identifier: ' . $value);
    }
    return '`' . $value . '`';
}

$apply = catn8_parse_flag($argv ?? [], '--apply');

try {
    $pdo = Database::getInstance();
} catch (Throwable $e) {
    fwrite(STDERR, "DB connect failed: {$e->getMessage()}\n");
    exit(1);
}

$schemaRow = $pdo->query('SELECT DATABASE() AS db_name')->fetch(PDO::FETCH_ASSOC);
$dbName = (string)($schemaRow['db_name'] ?? '');
if ($dbName === '') {
    fwrite(STDERR, "No active database selected.\n");
    exit(1);
}

$columnSql = <<<'SQL'
SELECT TABLE_NAME, COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND DATA_TYPE IN ('char','varchar','tinytext','text','mediumtext','longtext')
ORDER BY TABLE_NAME, ORDINAL_POSITION
SQL;

$columns = $pdo->query($columnSql)->fetchAll(PDO::FETCH_ASSOC) ?: [];

$totalMatches = 0;
$totalUpdatedRows = 0;
$changedColumns = [];

foreach ($columns as $column) {
    $tableName = (string)($column['TABLE_NAME'] ?? '');
    $columnName = (string)($column['COLUMN_NAME'] ?? '');
    if ($tableName === '' || $columnName === '') {
        continue;
    }

    $tableSql = catn8_safe_identifier($tableName);
    $columnSqlId = catn8_safe_identifier($columnName);

    $countSql = "SELECT COUNT(*) AS c FROM {$tableSql} WHERE {$columnSqlId} LIKE ? OR {$columnSqlId} LIKE ?";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute(['%' . CATN8_IMPORT_MARKER_TEXTS[0] . '%', '%' . CATN8_IMPORT_MARKER_TEXTS[1] . '%']);
    $matchCount = (int)($countStmt->fetchColumn() ?: 0);

    if ($matchCount <= 0) {
        continue;
    }

    $totalMatches += $matchCount;
    $entry = [
        'table' => $tableName,
        'column' => $columnName,
        'rows_with_marker' => $matchCount,
        'rows_updated' => 0,
    ];

    if ($apply) {
        $updateSql = "UPDATE {$tableSql}
                      SET {$columnSqlId} = TRIM(REPLACE(REPLACE({$columnSqlId}, ?, ''), ?, ''))
                      WHERE {$columnSqlId} LIKE ? OR {$columnSqlId} LIKE ?";
        $updateStmt = $pdo->prepare($updateSql);
        $updateStmt->execute([
            CATN8_IMPORT_MARKER_TEXTS[0],
            CATN8_IMPORT_MARKER_TEXTS[1],
            '%' . CATN8_IMPORT_MARKER_TEXTS[0] . '%',
            '%' . CATN8_IMPORT_MARKER_TEXTS[1] . '%',
        ]);
        $updated = (int)$updateStmt->rowCount();
        $entry['rows_updated'] = $updated;
        $totalUpdatedRows += $updated;
    }

    $changedColumns[] = $entry;
}

$result = [
    'success' => true,
    'mode' => $apply ? 'apply' : 'dry-run',
    'database' => $dbName,
    'marker_texts' => CATN8_IMPORT_MARKER_TEXTS,
    'columns_with_matches' => count($changedColumns),
    'rows_with_marker' => $totalMatches,
    'rows_updated' => $totalUpdatedRows,
    'details' => $changedColumns,
];

echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . PHP_EOL;
