<?php

declare(strict_types=1);

header('Content-Type: application/json');

require_once __DIR__ . '/../../api/config.php';

function respond(bool $ok, array $data = []): void {
    echo json_encode($ok ? (['success' => true] + $data) : (['success' => false] + $data));
    exit;
}

try {
    Database::getInstance();
} catch (Throwable $e) {
    respond(false, ['message' => 'DB connection failed', 'error' => $e->getMessage()]);
}

$from = 'Voice Settings';
$to = 'Communications';

$updates = [];

$tableExists = static function (string $tableName): bool {
    try {
        $row = Database::queryOne(
            'SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
            [$tableName]
        );
        return (int)($row['c'] ?? 0) > 0;
    } catch (Throwable $_e) {
        return false;
    }
};

$runReplace = static function (string $table, string $column) use ($from, $to, &$updates, $tableExists): void {
    $exists = $tableExists($table);
    if (!$exists) return;

    $sql = "UPDATE {$table} SET {$column} = REPLACE({$column}, ?, ?) WHERE {$column} LIKE ?";
    $rowsAffected = Database::execute($sql, [$from, $to, '%' . $from . '%']);

    $updates[] = [
        'table' => $table,
        'column' => $column,
        'rows_affected' => (int)$rowsAffected,
    ];
};

try {
    $runReplace('mystery_game_settings', 'settings_json');
    $runReplace('mystery_case_settings', 'settings_json');

    respond(true, [
        'message' => 'Rename applied (idempotent).',
        'from' => $from,
        'to' => $to,
        'updates' => $updates,
    ]);
} catch (Throwable $e) {
    respond(false, ['message' => 'Rename failed', 'error' => $e->getMessage(), 'updates' => $updates]);
}
