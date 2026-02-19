<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_session_start();
catn8_require_admin();
catn8_users_table_ensure();

$action = (string)($_GET['action'] ?? '');
$action = trim($action);

if ($action === 'list') {
    $rows = Database::queryAll('SELECT id, username, email, is_admin, is_active, email_verified FROM users ORDER BY id ASC');
    $users = array_map(static function ($r) {
        return [
            'id' => (int)($r['id'] ?? 0),
            'username' => (string)($r['username'] ?? ''),
            'email' => (string)($r['email'] ?? ''),
            'is_admin' => (int)($r['is_admin'] ?? 0),
            'is_active' => (int)($r['is_active'] ?? 0),
            'email_verified' => (int)($r['email_verified'] ?? 0),
        ];
    }, $rows);
    catn8_json_response(['success' => true, 'users' => $users]);
}

if ($action === 'update') {
    catn8_require_method('POST');

    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    $field = (string)($body['field'] ?? '');
    $value = (int)($body['value'] ?? 0);

    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid user id'], 400);
    }

    if ($field !== 'is_admin' && $field !== 'is_active') {
        catn8_json_response(['success' => false, 'error' => 'Invalid field'], 400);
    }

    $value = ($value ? 1 : 0);

    $uid = catn8_auth_user_id();
    if ($uid !== null && $uid === $id && $field === 'is_admin' && $value === 0) {
        catn8_json_response(['success' => false, 'error' => 'You cannot remove your own admin access'], 400);
    }

    Database::execute("UPDATE users SET {$field} = ? WHERE id = ?", [$value, $id]);
    catn8_json_response(['success' => true]);
}

if ($action === 'create_user') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $username = trim((string)($body['username'] ?? ''));
    $email = trim((string)($body['email'] ?? ''));
    $password = (string)($body['password'] ?? '');
    $isAdmin = (int)($body['is_admin'] ?? 0) ? 1 : 0;
    $isActive = (int)($body['is_active'] ?? 0) ? 1 : 0;

    if ($username === '' || $email === '' || $password === '') {
        catn8_json_response(['success' => false, 'error' => 'username, email, and password are required'], 400);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid email'], 400);
    }

    $existing = Database::queryOne('SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1', [$username, $email]);
    if ($existing) {
        catn8_json_response(['success' => false, 'error' => 'Username or email already exists'], 409);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    Database::execute(
        'INSERT INTO users (username, email, password_hash, is_admin, is_active, email_verified) VALUES (?, ?, ?, ?, ?, 1)',
        [$username, $email, $hash, $isAdmin, $isActive]
    );
    $row = Database::queryOne('SELECT id FROM users WHERE username = ? LIMIT 1', [$username]);
    catn8_json_response(['success' => true, 'id' => (int)($row['id'] ?? 0)]);
}

if ($action === 'update_user') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $username = trim((string)($body['username'] ?? ''));
    $email = trim((string)($body['email'] ?? ''));

    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid user id'], 400);
    }
    if ($username === '' || $email === '') {
        catn8_json_response(['success' => false, 'error' => 'username and email are required'], 400);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid email'], 400);
    }

    $existing = Database::queryOne('SELECT id FROM users WHERE id = ? LIMIT 1', [$id]);
    if (!$existing) {
        catn8_json_response(['success' => false, 'error' => 'User not found'], 404);
    }

    $dup = Database::queryOne('SELECT id FROM users WHERE (username = ? OR email = ?) AND id <> ? LIMIT 1', [$username, $email, $id]);
    if ($dup) {
        catn8_json_response(['success' => false, 'error' => 'Username or email already exists'], 409);
    }

    Database::execute('UPDATE users SET username = ?, email = ? WHERE id = ?', [$username, $email, $id]);
    catn8_json_response(['success' => true]);
}

if ($action === 'set_password') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $password = (string)($body['password'] ?? '');
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid user id'], 400);
    }
    if ($password === '') {
        catn8_json_response(['success' => false, 'error' => 'password is required'], 400);
    }

    $existing = Database::queryOne('SELECT id FROM users WHERE id = ? LIMIT 1', [$id]);
    if (!$existing) {
        catn8_json_response(['success' => false, 'error' => 'User not found'], 404);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);
    Database::execute('UPDATE users SET password_hash = ? WHERE id = ?', [$hash, $id]);
    catn8_json_response(['success' => true]);
}

if ($action === 'delete_user') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid user id'], 400);
    }

    $row = Database::queryOne('SELECT id, is_admin FROM users WHERE id = ? LIMIT 1', [$id]);
    if (!$row) {
        catn8_json_response(['success' => false, 'error' => 'User not found'], 404);
    }

    $uid = catn8_auth_user_id();
    if ($uid !== null && $uid === $id) {
        catn8_json_response(['success' => false, 'error' => 'You cannot delete your own account from this screen'], 400);
    }

    if ((int)($row['is_admin'] ?? 0) === 1) {
        $otherAdmin = Database::queryOne('SELECT id FROM users WHERE is_admin = 1 AND id <> ? LIMIT 1', [$id]);
        if (!$otherAdmin) {
            catn8_json_response(['success' => false, 'error' => 'Cannot delete the last admin account'], 400);
        }
    }

    Database::execute('DELETE FROM users WHERE id = ?', [$id]);
    catn8_json_response(['success' => true]);
}

catn8_json_response(['success' => false, 'error' => 'Unknown action'], 400);
