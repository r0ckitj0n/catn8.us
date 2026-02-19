<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_session_start();
catn8_users_table_ensure();

$uid = catn8_auth_user_id();
if ($uid === null) {
    catn8_json_response(['success' => false, 'error' => 'Not authenticated'], 401);
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

if ($method === 'GET') {
    $user = Database::queryOne('SELECT id, username, email, is_admin FROM users WHERE id = ?', [$uid]);
    if (!$user) {
        catn8_json_response(['success' => false, 'error' => 'User not found'], 404);
    }
    catn8_json_response(['success' => true, 'user' => [
        'id' => (int)$user['id'],
        'username' => (string)$user['username'],
        'email' => (string)$user['email'],
        'is_admin' => (int)$user['is_admin'],
    ]]);
}

if ($method !== 'POST') {
    catn8_json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

$body = catn8_read_json_body();
$action = trim((string)($body['action'] ?? ''));

if ($action === 'update_profile') {
    $username = trim((string)($body['username'] ?? ''));
    $email = trim((string)($body['email'] ?? ''));

    if ($username === '' || $email === '') {
        catn8_json_response(['success' => false, 'error' => 'Username and email are required'], 400);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid email'], 400);
    }

    $existing = Database::queryOne('SELECT id FROM users WHERE (username = ? OR email = ?) AND id <> ?', [$username, $email, $uid]);
    if ($existing) {
        catn8_json_response(['success' => false, 'error' => 'Username or email already exists'], 409);
    }

    Database::execute('UPDATE users SET username = ?, email = ? WHERE id = ?', [$username, $email, $uid]);

    catn8_json_response(['success' => true]);
}

if ($action === 'change_password') {
    $current = (string)($body['current_password'] ?? '');
    $next = (string)($body['new_password'] ?? '');

    if ($current === '' || $next === '') {
        catn8_json_response(['success' => false, 'error' => 'Current and new password are required'], 400);
    }

    $row = Database::queryOne('SELECT password_hash FROM users WHERE id = ?', [$uid]);
    if (!$row || !password_verify($current, (string)$row['password_hash'])) {
        catn8_json_response(['success' => false, 'error' => 'Invalid current password'], 403);
    }

    $hash = password_hash($next, PASSWORD_DEFAULT);
    Database::execute('UPDATE users SET password_hash = ? WHERE id = ?', [$hash, $uid]);

    catn8_json_response(['success' => true]);
}

if ($action === 'delete_account') {
    $current = (string)($body['current_password'] ?? '');
    if ($current === '') {
        catn8_json_response(['success' => false, 'error' => 'Current password is required'], 400);
    }

    $row = Database::queryOne('SELECT password_hash, is_admin FROM users WHERE id = ?', [$uid]);
    if (!$row || !password_verify($current, (string)$row['password_hash'])) {
        catn8_json_response(['success' => false, 'error' => 'Invalid current password'], 403);
    }

    if ((int)($row['is_admin'] ?? 0) === 1) {
        $otherAdmin = Database::queryOne('SELECT id FROM users WHERE is_admin = 1 AND id <> ? LIMIT 1', [$uid]);
        if (!$otherAdmin) {
            catn8_json_response(['success' => false, 'error' => 'Cannot delete the last admin account'], 400);
        }
    }

    Database::execute('DELETE FROM users WHERE id = ?', [$uid]);
    unset($_SESSION['catn8_user_id']);

    catn8_json_response(['success' => true]);
}

catn8_json_response(['success' => false, 'error' => 'Unknown action'], 400);
