<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_session_start();
catn8_require_admin();
catn8_groups_seed_core();

$action = trim((string)($_GET['action'] ?? ''));

if ($action === 'list_groups') {
    $rows = Database::queryAll('SELECT id, slug, title, created_at, updated_at FROM catn8_groups ORDER BY title ASC');
    $groups = array_map(static function (array $r): array {
        return [
            'id' => (int)($r['id'] ?? 0),
            'slug' => (string)($r['slug'] ?? ''),
            'title' => (string)($r['title'] ?? ''),
            'created_at' => (string)($r['created_at'] ?? ''),
            'updated_at' => (string)($r['updated_at'] ?? ''),
        ];
    }, $rows);

    catn8_json_response(['success' => true, 'groups' => $groups]);
}

if ($action === 'create_group') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $slug = trim((string)($body['slug'] ?? ''));
    $title = trim((string)($body['title'] ?? ''));
    if ($slug === '' || $title === '') {
        catn8_json_response(['success' => false, 'error' => 'slug and title are required'], 400);
    }

    $existing = Database::queryOne('SELECT id FROM catn8_groups WHERE slug = ? LIMIT 1', [$slug]);
    if ($existing) {
        catn8_json_response(['success' => false, 'error' => 'Group slug already exists'], 409);
    }

    Database::execute('INSERT INTO catn8_groups (slug, title) VALUES (?, ?)', [$slug, $title]);
    $row = Database::queryOne('SELECT id FROM catn8_groups WHERE slug = ? LIMIT 1', [$slug]);
    catn8_json_response(['success' => true, 'id' => (int)($row['id'] ?? 0)]);
}

if ($action === 'update_group') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $slug = trim((string)($body['slug'] ?? ''));
    $title = trim((string)($body['title'] ?? ''));
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    if ($slug === '' || $title === '') {
        catn8_json_response(['success' => false, 'error' => 'slug and title are required'], 400);
    }

    $existing = Database::queryOne('SELECT id FROM catn8_groups WHERE id = ? LIMIT 1', [$id]);
    if (!$existing) {
        catn8_json_response(['success' => false, 'error' => 'Group not found'], 404);
    }

    $dup = Database::queryOne('SELECT id FROM catn8_groups WHERE slug = ? AND id <> ? LIMIT 1', [$slug, $id]);
    if ($dup) {
        catn8_json_response(['success' => false, 'error' => 'Group slug already exists'], 409);
    }

    Database::execute('UPDATE catn8_groups SET slug = ?, title = ? WHERE id = ?', [$slug, $title, $id]);
    catn8_json_response(['success' => true]);
}

if ($action === 'delete_group') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    $g = Database::queryOne('SELECT slug FROM catn8_groups WHERE id = ? LIMIT 1', [$id]);
    if (!$g) {
        catn8_json_response(['success' => false, 'error' => 'Group not found'], 404);
    }
    $slug = (string)($g['slug'] ?? '');
    if ($slug === 'administrators') {
        catn8_json_response(['success' => false, 'error' => 'Cannot delete administrators group'], 400);
    }

    Database::execute('DELETE FROM catn8_groups WHERE id = ?', [$id]);
    catn8_json_response(['success' => true]);
}

if ($action === 'list_members') {
    $slug = trim((string)($_GET['group_slug'] ?? ''));
    if ($slug === '') {
        catn8_json_response(['success' => false, 'error' => 'Missing group_slug'], 400);
    }

    $group = Database::queryOne('SELECT id, slug, title FROM catn8_groups WHERE slug = ?', [$slug]);
    if (!$group) {
        catn8_json_response(['success' => false, 'error' => 'Group not found'], 404);
    }

    $rows = Database::queryAll(
        'SELECT u.id, u.username, u.email, u.is_admin, u.is_active, u.email_verified
         FROM group_memberships gm
         INNER JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = ?
         ORDER BY u.username ASC, u.id ASC',
        [(int)($group['id'] ?? 0)]
    );

    $members = array_map(static function (array $r): array {
        return [
            'id' => (int)($r['id'] ?? 0),
            'username' => (string)($r['username'] ?? ''),
            'email' => (string)($r['email'] ?? ''),
            'is_admin' => (int)($r['is_admin'] ?? 0),
            'is_active' => (int)($r['is_active'] ?? 0),
            'email_verified' => (int)($r['email_verified'] ?? 0),
        ];
    }, $rows);

    catn8_json_response([
        'success' => true,
        'group' => [
            'id' => (int)($group['id'] ?? 0),
            'slug' => (string)($group['slug'] ?? ''),
            'title' => (string)($group['title'] ?? ''),
        ],
        'members' => $members,
    ]);
}

if ($action === 'add_member') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $slug = trim((string)($body['group_slug'] ?? ''));
    $userId = (int)($body['user_id'] ?? 0);

    if ($slug === '') {
        catn8_json_response(['success' => false, 'error' => 'Missing group_slug'], 400);
    }
    if ($userId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid user_id'], 400);
    }

    $group = Database::queryOne('SELECT id FROM catn8_groups WHERE slug = ?', [$slug]);
    if (!$group) {
        catn8_json_response(['success' => false, 'error' => 'Group not found'], 404);
    }

    catn8_users_table_ensure();
    $user = Database::queryOne('SELECT id FROM users WHERE id = ?', [$userId]);
    if (!$user) {
        catn8_json_response(['success' => false, 'error' => 'User not found'], 404);
    }

    $groupId = (int)($group['id'] ?? 0);

    $existing = Database::queryOne('SELECT id FROM group_memberships WHERE group_id = ? AND user_id = ?', [$groupId, $userId]);
    if (!$existing) {
        Database::execute('INSERT INTO group_memberships (group_id, user_id) VALUES (?, ?)', [$groupId, $userId]);
    }

    catn8_json_response(['success' => true]);
}

if ($action === 'remove_member') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $slug = trim((string)($body['group_slug'] ?? ''));
    $userId = (int)($body['user_id'] ?? 0);

    if ($slug === '') {
        catn8_json_response(['success' => false, 'error' => 'Missing group_slug'], 400);
    }
    if ($userId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid user_id'], 400);
    }

    $group = Database::queryOne('SELECT id FROM catn8_groups WHERE slug = ?', [$slug]);
    if (!$group) {
        catn8_json_response(['success' => false, 'error' => 'Group not found'], 404);
    }

    $groupId = (int)($group['id'] ?? 0);
    Database::execute('DELETE FROM group_memberships WHERE group_id = ? AND user_id = ?', [$groupId, $userId]);

    catn8_json_response(['success' => true]);
}

catn8_json_response(['success' => false, 'error' => 'Unknown action'], 400);
