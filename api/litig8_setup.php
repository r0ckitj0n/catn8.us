<?php

declare(strict_types=1);

/**
 * Admin-token protected Litig8 bootstrap:
 * - ensures schema + litig8-users group
 * - adds Jon (admin) to litig8-users
 * - rotates agent API token (returned once for Mac-side storage)
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/litig8_model.php';

catn8_require_method('POST', false);

$expected = trim((string)catn8_env('CATN8_ADMIN_TOKEN', ''));
$got = trim((string)($_GET['admin_token'] ?? $_POST['admin_token'] ?? ''));
if ($expected === '' || $got === '' || !hash_equals($expected, $got)) {
    catn8_json_response(['success' => false, 'error' => 'Invalid admin token'], 403);
}

Litig8Model::ensureSchema();

$admin = Database::queryOne('SELECT id FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1');
$adminUid = (int)($admin['id'] ?? 0);
if ($adminUid > 0) {
    $groupId = catn8_group_ensure(Litig8Model::GROUP_SLUG, 'Litig8 Users');
    $existing = Database::queryOne(
        'SELECT id FROM group_memberships WHERE group_id = ? AND user_id = ?',
        [$groupId, $adminUid]
    );
    if (!$existing) {
        Database::execute('INSERT INTO group_memberships (group_id, user_id) VALUES (?, ?)', [$groupId, $adminUid]);
    }
}

$agentToken = Litig8Model::rotateApiToken();

catn8_json_response([
    'success' => true,
    'group' => Litig8Model::GROUP_SLUG,
    'tokens' => [
        'agent' => $agentToken,
    ],
    'secret_keys' => [
        'agent' => Litig8Model::AGENT_TOKEN_SECRET_KEY,
    ],
    'note' => 'Store plaintext token on the Mac only; server stores SHA-256 hash in secrets.',
]);
