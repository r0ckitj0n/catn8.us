<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/config.php';

function accumul8_cleanup_has_flag(array $argv, string $flag): bool
{
    return in_array($flag, $argv, true);
}

function accumul8_cleanup_get_opt(array $argv, string $prefix): ?string
{
    foreach ($argv as $arg) {
        if (str_starts_with($arg, $prefix)) {
            return substr($arg, strlen($prefix));
        }
    }
    return null;
}

function accumul8_cleanup_identifier(string $value): string
{
    if (!preg_match('/^[a-z0-9_]+$/i', $value)) {
        throw new RuntimeException('Unsafe SQL identifier: ' . $value);
    }
    return '`' . $value . '`';
}

function accumul8_cleanup_rules(): array
{
    return [
        [
            'table' => 'accumul8_entities',
            'column' => 'notes',
            'label' => 'entity import notes',
            'where' => "TRIM(COALESCE(notes, '')) REGEXP '^(Imported from Budget\\\\.xlsx.*|Statement import parent(\\\\..*)?)$'",
        ],
        [
            'table' => 'accumul8_contacts',
            'column' => 'notes',
            'label' => 'contact import notes',
            'where' => "TRIM(COALESCE(notes, '')) REGEXP '^Imported from Budget\\\\.xlsx.*$'",
        ],
        [
            'table' => 'accumul8_debtors',
            'column' => 'notes',
            'label' => 'debtor import notes',
            'where' => "TRIM(COALESCE(notes, '')) REGEXP '^Imported from Budget\\\\.xlsx.*$'",
        ],
        [
            'table' => 'accumul8_account_groups',
            'column' => 'notes',
            'label' => 'statement import group notes',
            'where' => "TRIM(COALESCE(notes, '')) = 'Imported from monthly PDF statements'",
        ],
        [
            'table' => 'accumul8_transactions',
            'column' => 'memo',
            'label' => 'transaction import memos',
            'where' => "TRIM(COALESCE(memo, '')) REGEXP '^(Imported from statement opening balance|Imported from .+ sheet.*)$'",
        ],
    ];
}

$apply = accumul8_cleanup_has_flag($argv ?? [], '--apply');
$sqlOut = accumul8_cleanup_get_opt($argv ?? [], '--sql-out=');

try {
    $pdo = Database::getInstance();
    $dbRow = $pdo->query('SELECT DATABASE() AS db_name')->fetch(PDO::FETCH_ASSOC) ?: [];
    $dbName = (string)($dbRow['db_name'] ?? '');
    if ($dbName === '') {
        throw new RuntimeException('No active database selected.');
    }

    $details = [];
    $sqlStatements = [];
    $rowsMatched = 0;
    $rowsUpdated = 0;

    foreach (accumul8_cleanup_rules() as $rule) {
        $table = accumul8_cleanup_identifier((string)$rule['table']);
        $column = accumul8_cleanup_identifier((string)$rule['column']);
        $where = (string)$rule['where'];

        $countSql = "SELECT COUNT(*) AS c FROM {$table} WHERE {$where}";
        $count = (int)($pdo->query($countSql)->fetchColumn() ?: 0);
        if ($count <= 0) {
            continue;
        }

        $rowsMatched += $count;
        $updateSql = "UPDATE {$table} SET {$column} = NULL WHERE {$where};";
        $sqlStatements[] = $updateSql;

        $entry = [
            'label' => (string)$rule['label'],
            'table' => (string)$rule['table'],
            'column' => (string)$rule['column'],
            'rows_matched' => $count,
            'rows_updated' => 0,
        ];

        if ($apply) {
            $updated = $pdo->exec($updateSql);
            $entry['rows_updated'] = (int)$updated;
            $rowsUpdated += (int)$updated;
        }

        $details[] = $entry;
    }

    if ($sqlOut !== null && $sqlOut !== '') {
        $dir = dirname($sqlOut);
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new RuntimeException('Could not create directory for SQL output: ' . $dir);
        }
        $payload = "-- Accumul8 import-note cleanup\nSET FOREIGN_KEY_CHECKS=0;\n" .
            implode("\n", $sqlStatements) .
            "\nSET FOREIGN_KEY_CHECKS=1;\n";
        file_put_contents($sqlOut, $payload);
    }

    echo json_encode([
        'success' => true,
        'mode' => $apply ? 'apply' : 'dry-run',
        'database' => $dbName,
        'rows_matched' => $rowsMatched,
        'rows_updated' => $rowsUpdated,
        'sql_statement_count' => count($sqlStatements),
        'sql_out' => $sqlOut,
        'details' => $details,
    ], JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . PHP_EOL;
} catch (Throwable $e) {
    fwrite(STDERR, $e->getMessage() . PHP_EOL);
    exit(1);
}
