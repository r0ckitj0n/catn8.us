<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

$step = 'init';
try {
    $step = 'require-method';
    catn8_require_method('POST');

    $step = 'session-start';
    catn8_session_start();

    $step = 'read-body';
    $body = catn8_read_json_body();
    $username = trim((string)($body['username'] ?? ''));
    $password = (string)($body['password'] ?? '');

    if ($username === '' || $password === '') {
        catn8_json_response(['success' => false, 'error' => 'Username and password are required'], 400);
    }

    $step = 'ensure-users-table';
    try {
        catn8_users_table_ensure();
    } catch (Throwable $e) {
        catn8_log_error('catn8_users_table_ensure failed in login', ['error' => $e->getMessage()]);
    }

    $step = 'settings';
    $requireVerify = catn8_setting_bool('auth.require_email_verification', false);

    $columnMap = null;
    $loadColumns = static function () use (&$columnMap): void {
        if (is_array($columnMap)) {
            return;
        }
        $columnMap = [];
        try {
            $rows = Database::queryAll('SHOW COLUMNS FROM users');
            foreach ($rows as $row) {
                $field = strtolower((string)($row['Field'] ?? ''));
                if ($field !== '') {
                    $columnMap[$field] = true;
                }
            }
        } catch (Throwable $_) {
            $columnMap = [];
        }
    };
    $hasColumn = static function (string $column) use (&$columnMap, $loadColumns): bool {
        $loadColumns();
        return is_array($columnMap) && !empty($columnMap[strtolower($column)]);
    };

    $firstColumn = static function (array $candidates) use ($hasColumn): ?string {
        foreach ($candidates as $column) {
            if ($hasColumn($column)) {
                return $column;
            }
        }
        return null;
    };

    $step = 'resolve-columns';
    $idColumn = $firstColumn(['id', 'user_id']);
    $loginColumn = $firstColumn(['username', 'user_name', 'user_login', 'email']);
    $passwordColumn = $firstColumn(['password_hash', 'password', 'user_pass']);

    if ($idColumn === null || $loginColumn === null || $passwordColumn === null) {
        catn8_json_response(['success' => false, 'error' => 'Login schema not ready'], 500);
    }

    $step = 'lookup-user';
    $selectFields = [
        '`' . $idColumn . '` AS id',
        '`' . $passwordColumn . '` AS password_hash',
    ];
    if ($hasColumn('is_admin')) {
        $selectFields[] = 'is_admin';
    }
    if ($hasColumn('is_active')) {
        $selectFields[] = 'is_active';
    }
    if ($hasColumn('email_verified')) {
        $selectFields[] = 'email_verified';
    }

    $sql = 'SELECT ' . implode(', ', $selectFields) . ' FROM users WHERE `' . $loginColumn . '` = ?';
    $user = Database::queryOne($sql, [$username]);
    if (!$user) {
        catn8_json_response(['success' => false, 'error' => 'Invalid credentials'], 401);
    }

    $step = 'status-checks';
    if ((int)($user['is_active'] ?? 1) !== 1 && (int)($user['is_admin'] ?? 0) !== 1) {
        catn8_json_response(['success' => false, 'error' => 'Account is pending admin approval'], 403);
    }

    if ($requireVerify && (int)($user['email_verified'] ?? 1) !== 1) {
        catn8_json_response(['success' => false, 'error' => 'Account is not verified yet'], 403);
    }

    $step = 'password-verify';
    if (!password_verify($password, (string)$user['password_hash'])) {
        catn8_json_response(['success' => false, 'error' => 'Invalid credentials'], 401);
    }

    $step = 'session-write';
    $_SESSION['catn8_user_id'] = (int)$user['id'];

    catn8_json_response(['success' => true]);
} catch (Throwable $e) {
    catn8_log_error('login endpoint fatal', [
        'step' => $step,
        'error' => $e->getMessage(),
    ]);
    catn8_json_response([
        'success' => false,
        'error' => 'Internal server error',
        'debug_step' => $step,
    ], 500);
}
