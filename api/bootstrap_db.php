<?php

declare(strict_types=1);

function catn8_users_table_ensure(): void
{
    Database::execute("CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(64) NOT NULL UNIQUE,
        email VARCHAR(191) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        is_admin TINYINT(1) NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 0,
        email_verified TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $hasColumn = static function (string $column): bool {
        $row = Database::queryOne(
            "SELECT 1
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'users'
               AND COLUMN_NAME = ?
             LIMIT 1",
            [$column]
        );
        return (bool)$row;
    };

    // Live environments may have a legacy users schema; heal missing auth columns in-place.
    if (!$hasColumn('is_admin')) {
        Database::execute("ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0");
    }
    if (!$hasColumn('is_active')) {
        Database::execute("ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1");
    }
    if (!$hasColumn('email_verified')) {
        Database::execute("ALTER TABLE users ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 1");
    }
    if (!$hasColumn('updated_at')) {
        Database::execute("ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
    }
}

function catn8_groups_table_ensure(): void
{
    try {
        Database::execute('RENAME TABLE `groups` TO `catn8_groups`');
    } catch (Throwable $e) {
        // ignore if `groups` does not exist (or rename not needed)
    }

    Database::execute("CREATE TABLE IF NOT EXISTS `catn8_groups` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(96) NOT NULL UNIQUE,
        title VARCHAR(191) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function catn8_group_memberships_table_ensure(): void
{
    Database::execute("CREATE TABLE IF NOT EXISTS group_memberships (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_group_user (group_id, user_id),
        KEY idx_user_id (user_id),
        CONSTRAINT fk_group_membership_group FOREIGN KEY (group_id) REFERENCES catn8_groups(id) ON DELETE CASCADE,
        CONSTRAINT fk_group_membership_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function catn8_group_ensure(string $slug, string $title): int
{
    $slug = trim($slug);
    if ($slug === '') {
        throw new RuntimeException('Missing group slug');
    }
    $title = trim($title);
    if ($title === '') {
        throw new RuntimeException('Missing group title');
    }

    catn8_groups_table_ensure();
    $row = Database::queryOne('SELECT id FROM catn8_groups WHERE slug = ?', [$slug]);
    if ($row) return (int)($row['id'] ?? 0);

    Database::execute('INSERT INTO catn8_groups (slug, title) VALUES (?, ?)', [$slug, $title]);
    $row2 = Database::queryOne('SELECT id FROM catn8_groups WHERE slug = ?', [$slug]);
    if (!$row2) {
        throw new RuntimeException('Failed to create group');
    }
    return (int)($row2['id'] ?? 0);
}

function catn8_groups_seed_core(): void
{
    catn8_users_table_ensure();
    catn8_groups_table_ensure();
    catn8_group_memberships_table_ensure();
    $adminsGroupId = catn8_group_ensure('administrators', 'Administrators');
    catn8_group_ensure('wordsearch-users', 'Wordsearch Users');
    catn8_group_ensure('mystery-game-users', 'Mystery Game Users');

    $adminUsers = Database::queryAll('SELECT id FROM users WHERE is_admin = 1');
    foreach ($adminUsers as $r) {
        $uid = (int)($r['id'] ?? 0);
        if ($uid <= 0) continue;
        $existing = Database::queryOne(
            'SELECT id FROM group_memberships WHERE group_id = ? AND user_id = ?',
            [$adminsGroupId, $uid]
        );
        if (!$existing) {
            Database::execute(
                'INSERT INTO group_memberships (group_id, user_id) VALUES (?, ?)',
                [$adminsGroupId, $uid]
            );
        }
    }
}

function catn8_user_in_group(?int $uid, string $groupSlug): bool
{
    if ($uid === null) return false;
    $groupSlug = trim($groupSlug);
    if ($groupSlug === '') return false;

    catn8_groups_seed_core();

    $row = Database::queryOne(
        'SELECT gm.id
         FROM group_memberships gm
         INNER JOIN catn8_groups g ON g.id = gm.group_id
         WHERE gm.user_id = ? AND g.slug = ?
         LIMIT 1',
        [$uid, $groupSlug]
    );
    return (bool)$row;
}

function catn8_email_verify_table_ensure(): void
{
    Database::execute("CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token_hash VARBINARY(32) NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_token_hash (token_hash),
        KEY idx_user_id (user_id),
        CONSTRAINT fk_email_verification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function catn8_password_reset_table_ensure(): void
{
    Database::execute("CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token_hash VARBINARY(32) NOT NULL,
        pending_password_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_token_hash (token_hash),
        KEY idx_user_id (user_id),
        CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}
