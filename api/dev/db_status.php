<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_session_start();

if (!catn8_is_local_request()) {
    catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
}

catn8_require_admin();

try {
    $cfg = catn8_get_db_config('current');
    $dbName = (string)($cfg['db'] ?? '');

    $tables = Database::queryAll('SHOW TABLES');

    $usersCount = 0;
    try {
        catn8_users_table_ensure();
        $row = Database::queryOne('SELECT COUNT(*) AS c FROM users');
        $usersCount = (int)($row['c'] ?? 0);
    } catch (Throwable $e) {
        // ignore
    }

    catn8_json_response([
        'success' => true,
        'db' => [
            'host' => (string)($cfg['host'] ?? ''),
            'db' => $dbName,
            'user' => (string)($cfg['user'] ?? ''),
            'port' => (int)($cfg['port'] ?? 0),
            'socket' => (string)($cfg['socket'] ?? ''),
        ],
        'tables' => $tables,
        'users_count' => $usersCount,
    ]);
} catch (Throwable $e) {
    catn8_json_response(['success' => false, 'error' => $e->getMessage()], 500);
}
