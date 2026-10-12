<?php

declare(strict_types=1);

/**
 * Admin-token protected Medic8 bootstrap:
 * - ensures schema
 * - ensures medic8-users group
 * - ensures admin person row
 * - rotates agent API token (returned once for Mac-side storage)
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/medic8_model.php';

catn8_require_method('POST', false);

$expected = trim((string)catn8_env('CATN8_ADMIN_TOKEN', ''));
$got = trim((string)($_GET['admin_token'] ?? $_POST['admin_token'] ?? ''));
if ($expected === '' || $got === '' || !hash_equals($expected, $got)) {
    catn8_json_response(['success' => false, 'error' => 'Invalid admin token'], 403);
}

Medic8Model::ensureSchema();

$admin = Database::queryOne('SELECT id FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1');
$adminUid = (int)($admin['id'] ?? 0);
$person = null;
if ($adminUid > 0) {
    $person = Medic8Model::ensureAdminPerson($adminUid, 'Jon Graves');
    $groupId = catn8_group_ensure(Medic8Model::GROUP_SLUG, 'Medic8 Users');
    $existing = Database::queryOne(
        'SELECT id FROM group_memberships WHERE group_id = ? AND user_id = ?',
        [$groupId, $adminUid]
    );
    if (!$existing) {
        Database::execute('INSERT INTO group_memberships (group_id, user_id) VALUES (?, ?)', [$groupId, $adminUid]);
    }
}

$agentToken = Medic8Model::rotateApiToken();

catn8_json_response([
    'success' => true,
    'person_id' => $person ? (int)$person['id'] : null,
    'group' => Medic8Model::GROUP_SLUG,
    'tokens' => [
        'agent' => $agentToken,
    ],
    'secret_keys' => [
        'agent' => Medic8Model::AGENT_TOKEN_SECRET_KEY,
    ],
    'note' => 'Store plaintext token on the Mac only; server stores SHA-256 hash in secrets.',
]);
