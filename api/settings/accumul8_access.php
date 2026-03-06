<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_session_start();
catn8_require_admin();

function accumul8_access_ensure_table(): void
{
    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_user_access_grants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        grantee_user_id INT NOT NULL,
        owner_user_id INT NOT NULL,
        granted_by_user_id INT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_accumul8_access_grantee_owner (grantee_user_id, owner_user_id),
        KEY idx_accumul8_access_owner (owner_user_id),
        CONSTRAINT fk_accumul8_access_grantee FOREIGN KEY (grantee_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_accumul8_access_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_accumul8_access_granted_by FOREIGN KEY (granted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function accumul8_access_list_users(): array
{
    $rows = Database::queryAll(
        'SELECT id, username, email, is_active
         FROM users
         ORDER BY username ASC, id ASC'
    );
    return array_map(static function (array $row): array {
        return [
            'id' => (int)($row['id'] ?? 0),
            'username' => (string)($row['username'] ?? ''),
            'email' => (string)($row['email'] ?? ''),
            'is_active' => (int)($row['is_active'] ?? 0),
        ];
    }, $rows);
}

function accumul8_access_list_grants(): array
{
    $rows = Database::queryAll(
        'SELECT g.id, g.grantee_user_id, g.owner_user_id, g.granted_by_user_id, g.created_at, g.updated_at,
                grantee.username AS grantee_username,
                grantee.email AS grantee_email,
                owner.username AS owner_username,
                owner.email AS owner_email,
                grantor.username AS granted_by_username
         FROM accumul8_user_access_grants g
         INNER JOIN users grantee ON grantee.id = g.grantee_user_id
         INNER JOIN users owner ON owner.id = g.owner_user_id
         LEFT JOIN users grantor ON grantor.id = g.granted_by_user_id
         WHERE g.is_active = 1
         ORDER BY owner.username ASC, grantee.username ASC, g.id ASC'
    );

    return array_map(static function (array $row): array {
        return [
            'id' => (int)($row['id'] ?? 0),
            'grantee_user_id' => (int)($row['grantee_user_id'] ?? 0),
            'owner_user_id' => (int)($row['owner_user_id'] ?? 0),
            'granted_by_user_id' => isset($row['granted_by_user_id']) ? (int)$row['granted_by_user_id'] : null,
            'grantee_username' => (string)($row['grantee_username'] ?? ''),
            'grantee_email' => (string)($row['grantee_email'] ?? ''),
            'owner_username' => (string)($row['owner_username'] ?? ''),
            'owner_email' => (string)($row['owner_email'] ?? ''),
            'granted_by_username' => (string)($row['granted_by_username'] ?? ''),
            'created_at' => (string)($row['created_at'] ?? ''),
            'updated_at' => (string)($row['updated_at'] ?? ''),
        ];
    }, $rows);
}

function accumul8_access_assert_user_exists(int $userId, string $fieldName): void
{
    if ($userId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid ' . $fieldName], 400);
    }
    $row = Database::queryOne('SELECT id FROM users WHERE id = ? LIMIT 1', [$userId]);
    if (!$row) {
        catn8_json_response(['success' => false, 'error' => 'User not found for ' . $fieldName], 404);
    }
}

accumul8_access_ensure_table();

$action = trim((string)($_GET['action'] ?? 'list'));
if ($action === '') {
    $action = 'list';
}

if ($action === 'list') {
    catn8_require_method('GET');
    catn8_json_response([
        'success' => true,
        'users' => accumul8_access_list_users(),
        'grants' => accumul8_access_list_grants(),
    ]);
}

if ($action === 'grant') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $granteeUserId = (int)($body['grantee_user_id'] ?? 0);
    $ownerUserId = (int)($body['owner_user_id'] ?? 0);
    $grantedByUserId = (int)($_SESSION['user_id'] ?? 0);

    if ($granteeUserId === $ownerUserId) {
        catn8_json_response(['success' => false, 'error' => 'Self access does not require a grant'], 400);
    }

    accumul8_access_assert_user_exists($granteeUserId, 'grantee_user_id');
    accumul8_access_assert_user_exists($ownerUserId, 'owner_user_id');

    Database::execute(
        'INSERT INTO accumul8_user_access_grants (grantee_user_id, owner_user_id, granted_by_user_id, is_active)
         VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE is_active = 1, granted_by_user_id = VALUES(granted_by_user_id), updated_at = NOW()',
        [$granteeUserId, $ownerUserId, $grantedByUserId > 0 ? $grantedByUserId : null]
    );

    catn8_json_response(['success' => true]);
}

if ($action === 'revoke') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $grantId = (int)($body['id'] ?? 0);
    if ($grantId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    Database::execute(
        'UPDATE accumul8_user_access_grants
         SET is_active = 0, updated_at = NOW()
         WHERE id = ? AND is_active = 1',
        [$grantId]
    );

    catn8_json_response(['success' => true]);
}

catn8_json_response(['success' => false, 'error' => 'Unknown action'], 400);
