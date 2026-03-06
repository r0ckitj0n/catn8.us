<?php

declare(strict_types=1);

final class Valid8VaultEntryModel
{
    private const TABLE_NAME = 'vault_entries';
    private const ATTACHMENT_TABLE_NAME = 'vault_entry_attachments';
    private const OWNER_TABLE_NAME = 'valid8_owners';
    private const CATEGORY_TABLE_NAME = 'valid8_categories';
    private const KEY_SECRET_NAME = 'catn8.valid8.data_key';
    private const KEY_ENV_NAME = 'CATN8_VALID8_DATA_KEY';

    public static function ensureSchema(): void
    {
        self::ensureUsersUuidColumn();

        Database::execute("CREATE TABLE IF NOT EXISTS vault_entries (
            id CHAR(36) NOT NULL PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            title VARCHAR(191) NOT NULL,
            url VARCHAR(2048) NULL,
            email_address VARCHAR(191) NULL,
            username_encrypted LONGBLOB NOT NULL,
            username_auth_tag VARBINARY(16) NOT NULL,
            password_encrypted LONGBLOB NOT NULL,
            password_auth_tag VARBINARY(16) NOT NULL,
            encryption_iv VARBINARY(12) NOT NULL,
            notes_encrypted LONGBLOB NULL,
            notes_auth_tag VARBINARY(16) NULL,
            category VARCHAR(64) NOT NULL,
            owner_name VARCHAR(120) NOT NULL DEFAULT 'Unassigned',
            is_favorite TINYINT(1) NOT NULL DEFAULT 0,
            password_strength TINYINT UNSIGNED NOT NULL DEFAULT 1,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            replaced_by_entry_id CHAR(36) NULL,
            source_tab VARCHAR(191) NULL,
            source_document VARCHAR(191) NULL,
            account_fingerprint CHAR(64) NOT NULL,
            entry_fingerprint CHAR(64) NOT NULL,
            last_changed_at DATETIME NOT NULL,
            deactivated_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_vault_entries_user_id (user_id),
            KEY idx_vault_entries_user_active (user_id, is_active, updated_at),
            KEY idx_vault_entries_user_category_active (user_id, category, is_active),
            KEY idx_vault_entries_user_owner_active (user_id, owner_name, is_active),
            KEY idx_vault_entries_user_account_active (user_id, account_fingerprint, is_active),
            UNIQUE KEY uniq_vault_entries_user_entry_fp (user_id, entry_fingerprint),
            CONSTRAINT fk_vault_entries_user_uuid FOREIGN KEY (user_id) REFERENCES users(uuid) ON DELETE CASCADE,
            CONSTRAINT fk_vault_entries_replaced_by FOREIGN KEY (replaced_by_entry_id) REFERENCES vault_entries(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        self::ensureAddedColumns();
        self::ensureAttachmentSchema();
        self::ensureOwnerCategorySchema();
    }

    private static function ensureAttachmentSchema(): void
    {
        Database::execute("CREATE TABLE IF NOT EXISTS vault_entry_attachments (
            id CHAR(36) NOT NULL PRIMARY KEY,
            entry_id CHAR(36) NOT NULL,
            user_id CHAR(36) NOT NULL,
            original_filename VARCHAR(191) NOT NULL,
            mime_type VARCHAR(120) NOT NULL,
            size_bytes INT UNSIGNED NOT NULL,
            image_encrypted LONGBLOB NOT NULL,
            image_auth_tag VARBINARY(16) NOT NULL,
            encryption_iv VARBINARY(12) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_vault_attach_user_entry_created (user_id, entry_id, created_at),
            KEY idx_vault_attach_entry_created (entry_id, created_at),
            CONSTRAINT fk_vault_attach_entry FOREIGN KEY (entry_id) REFERENCES vault_entries(id) ON DELETE CASCADE,
            CONSTRAINT fk_vault_attach_user_uuid FOREIGN KEY (user_id) REFERENCES users(uuid) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    }

    private static function ensureOwnerCategorySchema(): void
    {
        Database::execute("CREATE TABLE IF NOT EXISTS " . self::OWNER_TABLE_NAME . " (
            id CHAR(36) NOT NULL PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            name VARCHAR(120) NOT NULL,
            is_archived TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_valid8_owner_user_name (user_id, name),
            KEY idx_valid8_owner_user_archived_name (user_id, is_archived, name),
            CONSTRAINT fk_valid8_owner_user_uuid FOREIGN KEY (user_id) REFERENCES users(uuid) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        Database::execute("CREATE TABLE IF NOT EXISTS " . self::CATEGORY_TABLE_NAME . " (
            id CHAR(36) NOT NULL PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            name VARCHAR(64) NOT NULL,
            is_archived TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_valid8_category_user_name (user_id, name),
            KEY idx_valid8_category_user_archived_name (user_id, is_archived, name),
            CONSTRAINT fk_valid8_category_user_uuid FOREIGN KEY (user_id) REFERENCES users(uuid) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    }

    public static function createEntry(array $input): array
    {
        self::ensureSchema();

        $userUuid = self::normalizeUuid((string)($input['user_id'] ?? ''));
        $title = self::normalizeText((string)($input['title'] ?? ''), 191);
        if ($title === '') {
            throw new RuntimeException('Title is required');
        }

        $url = self::normalizeNullableUrl($input['url'] ?? null);
        $emailAddress = self::normalizeNullableEmail($input['email_address'] ?? null);
        $username = self::requireNonEmptyText((string)($input['username'] ?? ''), 'Username is required');
        $password = self::requireNonEmptyText((string)($input['password'] ?? ''), 'Password is required');
        $notes = self::normalizeNullableText($input['notes'] ?? null, 65535);
        $category = self::normalizeText((string)($input['category'] ?? ''), 64);
        if ($category === '') {
            throw new RuntimeException('Category is required');
        }
        $ownerName = self::normalizeOwnerName($input['owner_name'] ?? null);

        $sourceTab = self::normalizeNullableText($input['source_tab'] ?? null, 191);
        $sourceDocument = self::normalizeNullableText($input['source_document'] ?? null, 191);
        $isFavorite = self::normalizeBool($input['is_favorite'] ?? false);
        $passwordStrength = self::normalizePasswordStrength($input['password_strength'] ?? 1);
        $lastChangedAt = self::normalizeDatetime($input['last_changed_at'] ?? date('c'));
        $isActive = self::normalizeBool($input['is_active'] ?? true);

        $accountFingerprint = self::computeAccountFingerprint($title, $url, $username, $ownerName);
        $entryFingerprint = self::computeEntryFingerprint($title, $url, $username, $password, $notes, $ownerName);

        $existing = Database::queryOne(
            'SELECT id, user_id, title, url, email_address, username_encrypted, username_auth_tag, password_encrypted, password_auth_tag, encryption_iv, notes_encrypted, notes_auth_tag, category, owner_name, is_favorite, password_strength, is_active, replaced_by_entry_id, source_tab, source_document, account_fingerprint, entry_fingerprint, last_changed_at, deactivated_at, created_at, updated_at
             FROM vault_entries
             WHERE user_id = ? AND entry_fingerprint = ?
             LIMIT 1',
            [$userUuid, $entryFingerprint]
        );
        if ($existing !== null) {
            $model = self::toEntryModel($existing);
            $model['_import_status'] = 'duplicate';
            return $model;
        }

        $encrypted = self::encryptCredentials($username, $password, $notes);
        $id = self::generateUuidV4();

        Database::beginTransaction();
        try {
            Database::execute(
                'INSERT INTO vault_entries
                    (id, user_id, title, url, email_address, username_encrypted, username_auth_tag, password_encrypted, password_auth_tag, encryption_iv, notes_encrypted, notes_auth_tag, category, owner_name, is_favorite, password_strength, is_active, replaced_by_entry_id, source_tab, source_document, account_fingerprint, entry_fingerprint, last_changed_at, deactivated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)',
                [
                    $id,
                    $userUuid,
                    $title,
                    $url,
                    $emailAddress,
                    $encrypted['username_encrypted'],
                    $encrypted['username_auth_tag'],
                    $encrypted['password_encrypted'],
                    $encrypted['password_auth_tag'],
                    $encrypted['encryption_iv'],
                    $encrypted['notes_encrypted'],
                    $encrypted['notes_auth_tag'],
                    $category,
                    $ownerName,
                    $isFavorite,
                    $passwordStrength,
                    $isActive,
                    $sourceTab,
                    $sourceDocument,
                    $accountFingerprint,
                    $entryFingerprint,
                    $lastChangedAt,
                    $isActive === 1 ? null : $lastChangedAt,
                ]
            );

            if ($isActive === 1) {
                Database::execute(
                    'UPDATE vault_entries
                     SET is_active = 0,
                         deactivated_at = COALESCE(deactivated_at, NOW()),
                         replaced_by_entry_id = ?
                     WHERE user_id = ?
                       AND account_fingerprint = ?
                       AND is_active = 1
                       AND id <> ?',
                    [$id, $userUuid, $accountFingerprint, $id]
                );
            }

            $row = self::getEntryRow($id, $userUuid);
            if ($row === null) {
                throw new RuntimeException('Vault entry was created but could not be reloaded');
            }

            Database::commit();
            $model = self::toEntryModel($row);
            $model['_import_status'] = 'inserted';
            return $model;
        } catch (Throwable $error) {
            if (Database::inTransaction()) {
                Database::rollBack();
            }
            throw $error;
        }
    }

    public static function listEntries(string $userUuid, bool $includeInactive = false): array
    {
        self::ensureSchema();
        $userUuid = self::normalizeUuid($userUuid);

        $sql = 'SELECT id, user_id, title, url, email_address, username_encrypted, username_auth_tag, password_encrypted, password_auth_tag, encryption_iv, notes_encrypted, notes_auth_tag, category, owner_name, is_favorite, password_strength, is_active, replaced_by_entry_id, source_tab, source_document, account_fingerprint, entry_fingerprint, last_changed_at, deactivated_at, created_at, updated_at
                FROM vault_entries
                WHERE user_id = ?';
        $params = [$userUuid];
        if (!$includeInactive) {
            $sql .= ' AND is_active = 1';
        }
        $sql .= ' ORDER BY is_active DESC, updated_at DESC, created_at DESC';

        return Database::queryAll($sql, $params);
    }

    public static function updateEntry(string $userUuid, string $entryId, array $input): array
    {
        self::ensureSchema();
        $userUuid = self::normalizeUuid($userUuid);
        $entryId = self::normalizeUuid($entryId);

        $row = self::getEntryRow($entryId, $userUuid);
        if ($row === null) {
            throw new RuntimeException('Vault entry not found');
        }
        $secret = self::decryptCredentials($row);

        $title = array_key_exists('title', $input)
            ? self::normalizeText((string)$input['title'], 191)
            : self::normalizeText((string)($row['title'] ?? ''), 191);
        if ($title === '') {
            throw new RuntimeException('Title is required');
        }

        $url = array_key_exists('url', $input)
            ? self::normalizeNullableUrl($input['url'] ?? null)
            : self::normalizeNullableUrl($row['url'] ?? null);
        $emailAddress = array_key_exists('email_address', $input)
            ? self::normalizeNullableEmail($input['email_address'] ?? null)
            : self::normalizeNullableEmail($row['email_address'] ?? null);

        $username = array_key_exists('username', $input)
            ? self::requireNonEmptyText((string)$input['username'], 'Username is required')
            : self::requireNonEmptyText((string)($secret['username'] ?? ''), 'Username is required');
        $password = array_key_exists('password', $input)
            ? self::requireNonEmptyText((string)$input['password'], 'Password is required')
            : self::requireNonEmptyText((string)($secret['password'] ?? ''), 'Password is required');
        $notes = array_key_exists('notes', $input)
            ? self::normalizeNullableText($input['notes'] ?? null, 65535)
            : ($secret['notes'] ?? null);
        $sourceTab = array_key_exists('source_tab', $input)
            ? self::normalizeNullableText($input['source_tab'] ?? null, 191)
            : self::normalizeNullableText($row['source_tab'] ?? null, 191);
        $sourceDocument = array_key_exists('source_document', $input)
            ? self::normalizeNullableText($input['source_document'] ?? null, 191)
            : self::normalizeNullableText($row['source_document'] ?? null, 191);

        $category = array_key_exists('category', $input)
            ? self::normalizeCategoryName($input['category'] ?? null)
            : self::normalizeCategoryName($row['category'] ?? null);
        $ownerName = array_key_exists('owner_name', $input)
            ? self::normalizeOwnerName($input['owner_name'] ?? null)
            : self::normalizeOwnerName($row['owner_name'] ?? null);
        $isActive = array_key_exists('is_active', $input)
            ? self::normalizeBool($input['is_active'])
            : self::normalizeBool($row['is_active'] ?? 1);

        $accountFingerprint = self::computeAccountFingerprint($title, $url, $username, $ownerName);
        $entryFingerprint = self::computeEntryFingerprint($title, $url, $username, $password, $notes, $ownerName);
        $encrypted = self::encryptCredentials($username, $password, $notes);
        $deactivatedAt = $isActive === 1 ? null : gmdate('Y-m-d H:i:s');

        Database::beginTransaction();
        try {
            Database::execute(
                'UPDATE ' . self::TABLE_NAME . '
                 SET title = ?,
                     url = ?,
                     email_address = ?,
                     category = ?,
                     owner_name = ?,
                     username_encrypted = ?,
                     username_auth_tag = ?,
                     password_encrypted = ?,
                     password_auth_tag = ?,
                     encryption_iv = ?,
                     notes_encrypted = ?,
                     notes_auth_tag = ?,
                     is_active = ?,
                     replaced_by_entry_id = NULL,
                     source_tab = ?,
                     source_document = ?,
                     account_fingerprint = ?,
                     entry_fingerprint = ?,
                     last_changed_at = ?,
                     deactivated_at = ?
                 WHERE id = ? AND user_id = ?
                 LIMIT 1',
                [
                    $title,
                    $url,
                    $emailAddress,
                    $category,
                    $ownerName,
                    $encrypted['username_encrypted'],
                    $encrypted['username_auth_tag'],
                    $encrypted['password_encrypted'],
                    $encrypted['password_auth_tag'],
                    $encrypted['encryption_iv'],
                    $encrypted['notes_encrypted'],
                    $encrypted['notes_auth_tag'],
                    $isActive,
                    $sourceTab,
                    $sourceDocument,
                    $accountFingerprint,
                    $entryFingerprint,
                    gmdate('Y-m-d H:i:s'),
                    $deactivatedAt,
                    $entryId,
                    $userUuid,
                ]
            );

            if ($isActive === 1) {
                Database::execute(
                    'UPDATE ' . self::TABLE_NAME . '
                     SET is_active = 0,
                         deactivated_at = COALESCE(deactivated_at, NOW()),
                         replaced_by_entry_id = ?
                     WHERE user_id = ?
                       AND account_fingerprint = ?
                       AND is_active = 1
                       AND id <> ?',
                    [$entryId, $userUuid, $accountFingerprint, $entryId]
                );
            }

            $updated = self::getEntryRow($entryId, $userUuid);
            if ($updated === null) {
                throw new RuntimeException('Vault entry was updated but could not be reloaded');
            }
            Database::commit();
            return $updated;
        } catch (Throwable $error) {
            if (Database::inTransaction()) {
                Database::rollBack();
            }
            throw $error;
        }
    }

    public static function archiveEntry(string $userUuid, string $entryId): bool
    {
        self::ensureSchema();
        $userUuid = self::normalizeUuid($userUuid);
        $entryId = self::normalizeUuid($entryId);
        $affected = Database::execute(
            'UPDATE ' . self::TABLE_NAME . '
             SET is_active = 0,
                 deactivated_at = COALESCE(deactivated_at, NOW()),
                 replaced_by_entry_id = NULL
             WHERE id = ? AND user_id = ?
             LIMIT 1',
            [$entryId, $userUuid]
        );
        return $affected > 0;
    }

    public static function deleteEntry(string $userUuid, string $entryId): bool
    {
        self::ensureSchema();
        $userUuid = self::normalizeUuid($userUuid);
        $entryId = self::normalizeUuid($entryId);
        $affected = Database::execute(
            'DELETE FROM ' . self::TABLE_NAME . '
             WHERE id = ? AND user_id = ?
             LIMIT 1',
            [$entryId, $userUuid]
        );
        return $affected > 0;
    }

    public static function decryptEntry(array $row): array
    {
        $plaintext = self::decryptCredentials($row);
        return [
            'username' => $plaintext['username'],
            'password' => $plaintext['password'],
            'notes' => $plaintext['notes'],
        ];
    }

    public static function toEntryModel(array $row): array
    {
        return [
            'id' => (string)($row['id'] ?? ''),
            'user_id' => (string)($row['user_id'] ?? ''),
            'title' => (string)($row['title'] ?? ''),
            'url' => self::nullableString($row['url'] ?? null),
            'email_address' => self::normalizeNullableEmail($row['email_address'] ?? null),
            'category' => (string)($row['category'] ?? ''),
            'owner_name' => self::normalizeOwnerName($row['owner_name'] ?? null),
            'is_favorite' => (int)($row['is_favorite'] ?? 0),
            'password_strength' => (int)($row['password_strength'] ?? 1),
            'is_active' => (int)($row['is_active'] ?? 1),
            'replaced_by_entry_id' => self::nullableString($row['replaced_by_entry_id'] ?? null),
            'source_tab' => self::nullableString($row['source_tab'] ?? null),
            'source_document' => self::nullableString($row['source_document'] ?? null),
            'last_changed_at' => (string)($row['last_changed_at'] ?? ''),
            'deactivated_at' => self::nullableString($row['deactivated_at'] ?? null),
            'created_at' => (string)($row['created_at'] ?? ''),
            'updated_at' => (string)($row['updated_at'] ?? ''),
        ];
    }

    public static function userUuidForUserId(int $userId): string
    {
        if ($userId <= 0) {
            throw new RuntimeException('Invalid user id');
        }
        self::ensureUsersUuidColumn();
        $row = Database::queryOne('SELECT uuid FROM users WHERE id = ? LIMIT 1', [$userId]);
        $uuid = strtolower(trim((string)($row['uuid'] ?? '')));
        if (!self::isUuid($uuid)) {
            throw new RuntimeException('User UUID not found');
        }
        return $uuid;
    }

    public static function encryptCredentials(string $username, string $password, ?string $notes = null): array
    {
        $iv = random_bytes(12);
        $usernameEncrypted = self::encryptField($username, $iv, 'username');
        $passwordEncrypted = self::encryptField($password, $iv, 'password');
        $notesEncrypted = ($notes !== null && $notes !== '') ? self::encryptField($notes, $iv, 'notes') : null;

        return [
            'encryption_iv' => $iv,
            'username_encrypted' => $usernameEncrypted['ciphertext'],
            'username_auth_tag' => $usernameEncrypted['tag'],
            'password_encrypted' => $passwordEncrypted['ciphertext'],
            'password_auth_tag' => $passwordEncrypted['tag'],
            'notes_encrypted' => $notesEncrypted['ciphertext'] ?? null,
            'notes_auth_tag' => $notesEncrypted['tag'] ?? null,
        ];
    }

    public static function decryptCredentials(array $row): array
    {
        $iv = (string)($row['encryption_iv'] ?? '');
        if (strlen($iv) !== 12) {
            throw new RuntimeException('Invalid encryption IV');
        }

        $username = self::decryptField(
            (string)($row['username_encrypted'] ?? ''),
            (string)($row['username_auth_tag'] ?? ''),
            $iv,
            'username'
        );
        $password = self::decryptField(
            (string)($row['password_encrypted'] ?? ''),
            (string)($row['password_auth_tag'] ?? ''),
            $iv,
            'password'
        );

        $notes = null;
        $notesEncrypted = $row['notes_encrypted'] ?? null;
        $notesTag = $row['notes_auth_tag'] ?? null;
        if (is_string($notesEncrypted) && $notesEncrypted !== '' && is_string($notesTag) && $notesTag !== '') {
            $notes = self::decryptField($notesEncrypted, $notesTag, $iv, 'notes');
        }

        return [
            'username' => $username,
            'password' => $password,
            'notes' => $notes,
        ];
    }

    public static function getEntryRow(string $entryId, string $userUuid): ?array
    {
        $entryId = self::normalizeUuid($entryId);
        $userUuid = self::normalizeUuid($userUuid);
        return Database::queryOne(
            'SELECT id, user_id, title, url, email_address, username_encrypted, username_auth_tag, password_encrypted, password_auth_tag, encryption_iv, notes_encrypted, notes_auth_tag, category, owner_name, is_favorite, password_strength, is_active, replaced_by_entry_id, source_tab, source_document, account_fingerprint, entry_fingerprint, last_changed_at, deactivated_at, created_at, updated_at
             FROM vault_entries
             WHERE id = ? AND user_id = ?
             LIMIT 1',
            [$entryId, $userUuid]
        );
    }

    public static function listAttachments(string $userUuid, ?string $entryId = null): array
    {
        self::ensureSchema();
        $userUuid = self::normalizeUuid($userUuid);

        $sql = 'SELECT id, entry_id, user_id, original_filename, mime_type, size_bytes, created_at
                FROM ' . self::ATTACHMENT_TABLE_NAME . '
                WHERE user_id = ?';
        $params = [$userUuid];
        if ($entryId !== null && trim($entryId) !== '') {
            $sql .= ' AND entry_id = ?';
            $params[] = self::normalizeUuid($entryId);
        }
        $sql .= ' ORDER BY created_at DESC, id DESC';

        return Database::queryAll($sql, $params);
    }

    public static function addAttachment(
        string $userUuid,
        string $entryId,
        string $originalFilename,
        string $mimeType,
        string $imageBytes
    ): array {
        self::ensureSchema();
        $userUuid = self::normalizeUuid($userUuid);
        $entryId = self::normalizeUuid($entryId);

        $filename = self::normalizeText($originalFilename, 191);
        if ($filename === '') {
            $filename = 'attachment';
        }
        $mime = strtolower(self::normalizeText($mimeType, 120));
        if ($mime === '') {
            throw new RuntimeException('Attachment mime_type is required');
        }
        if (strpos($mime, 'image/') !== 0) {
            throw new RuntimeException('Only image attachments are allowed');
        }
        $sizeBytes = strlen($imageBytes);
        if ($sizeBytes <= 0) {
            throw new RuntimeException('Attachment payload is empty');
        }

        $entry = self::getEntryRow($entryId, $userUuid);
        if ($entry === null) {
            throw new RuntimeException('Vault entry not found');
        }

        $iv = random_bytes(12);
        $encrypted = self::encryptField($imageBytes, $iv, 'attachment-image');
        $attachmentId = self::generateUuidV4();

        Database::execute(
            'INSERT INTO ' . self::ATTACHMENT_TABLE_NAME . '
                (id, entry_id, user_id, original_filename, mime_type, size_bytes, image_encrypted, image_auth_tag, encryption_iv)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $attachmentId,
                $entryId,
                $userUuid,
                $filename,
                $mime,
                $sizeBytes,
                $encrypted['ciphertext'],
                $encrypted['tag'],
                $iv,
            ]
        );

        $row = Database::queryOne(
            'SELECT id, entry_id, user_id, original_filename, mime_type, size_bytes, created_at
             FROM ' . self::ATTACHMENT_TABLE_NAME . '
             WHERE id = ? AND user_id = ?
             LIMIT 1',
            [$attachmentId, $userUuid]
        );
        if ($row === null) {
            throw new RuntimeException('Attachment was stored but could not be reloaded');
        }

        return self::toAttachmentModel($row);
    }

    public static function getAttachmentContent(string $userUuid, string $attachmentId): array
    {
        self::ensureSchema();
        $userUuid = self::normalizeUuid($userUuid);
        $attachmentId = self::normalizeUuid($attachmentId);

        $row = Database::queryOne(
            'SELECT id, entry_id, user_id, original_filename, mime_type, size_bytes, image_encrypted, image_auth_tag, encryption_iv, created_at
             FROM ' . self::ATTACHMENT_TABLE_NAME . '
             WHERE id = ? AND user_id = ?
             LIMIT 1',
            [$attachmentId, $userUuid]
        );
        if ($row === null) {
            throw new RuntimeException('Attachment not found');
        }

        $iv = (string)($row['encryption_iv'] ?? '');
        $ciphertext = (string)($row['image_encrypted'] ?? '');
        $authTag = (string)($row['image_auth_tag'] ?? '');
        $bytes = self::decryptField($ciphertext, $authTag, $iv, 'attachment-image');

        return [
            'attachment' => self::toAttachmentModel($row),
            'bytes' => $bytes,
            'mime_type' => (string)($row['mime_type'] ?? 'application/octet-stream'),
            'filename' => self::normalizeText((string)($row['original_filename'] ?? 'attachment'), 191) ?: 'attachment',
        ];
    }

    public static function deleteAttachment(string $userUuid, string $attachmentId): bool
    {
        self::ensureSchema();
        $userUuid = self::normalizeUuid($userUuid);
        $attachmentId = self::normalizeUuid($attachmentId);
        $deleted = Database::execute(
            'DELETE FROM ' . self::ATTACHMENT_TABLE_NAME . '
             WHERE id = ? AND user_id = ?
             LIMIT 1',
            [$attachmentId, $userUuid]
        );
        return $deleted > 0;
    }

    public static function toAttachmentModel(array $row): array
    {
        return [
            'id' => (string)($row['id'] ?? ''),
            'entry_id' => (string)($row['entry_id'] ?? ''),
            'user_id' => (string)($row['user_id'] ?? ''),
            'original_filename' => self::normalizeText((string)($row['original_filename'] ?? ''), 191),
            'mime_type' => self::normalizeText((string)($row['mime_type'] ?? ''), 120),
            'size_bytes' => (int)($row['size_bytes'] ?? 0),
            'created_at' => (string)($row['created_at'] ?? ''),
        ];
    }

    public static function listOwners(string $userUuid, bool $includeArchived = false): array
    {
        self::ensureSchema();
        $userUuid = self::normalizeUuid($userUuid);
        $sql = 'SELECT id, user_id, name, is_archived, created_at, updated_at
                FROM ' . self::OWNER_TABLE_NAME . '
                WHERE user_id = ?';
        $params = [$userUuid];
        if (!$includeArchived) {
            $sql .= ' AND is_archived = 0';
        }
        $sql .= ' ORDER BY name ASC, id ASC';
        $rows = Database::queryAll($sql, $params);

        $nameMap = [];
        foreach ($rows as $row) {
            $name = self::normalizeOwnerName($row['name'] ?? null);
            $nameMap[strtolower($name)] = self::toLookupModel($row, 120);
        }

        $entryRows = Database::queryAll(
            'SELECT DISTINCT owner_name AS name
             FROM ' . self::TABLE_NAME . '
             WHERE user_id = ?
             ORDER BY owner_name ASC',
            [$userUuid]
        );
        foreach ($entryRows as $row) {
            $name = self::normalizeOwnerName($row['name'] ?? null);
            $key = strtolower($name);
            if (!isset($nameMap[$key])) {
                $nameMap[$key] = [
                    'id' => '',
                    'user_id' => $userUuid,
                    'name' => $name,
                    'is_archived' => 0,
                    'created_at' => '',
                    'updated_at' => '',
                ];
            }
        }

        $list = array_values($nameMap);
        usort($list, static fn(array $a, array $b): int => strcasecmp((string)$a['name'], (string)$b['name']));
        return $list;
    }

    public static function listCategories(string $userUuid, bool $includeArchived = false): array
    {
        self::ensureSchema();
        $userUuid = self::normalizeUuid($userUuid);
        $sql = 'SELECT id, user_id, name, is_archived, created_at, updated_at
                FROM ' . self::CATEGORY_TABLE_NAME . '
                WHERE user_id = ?';
        $params = [$userUuid];
        if (!$includeArchived) {
            $sql .= ' AND is_archived = 0';
        }
        $sql .= ' ORDER BY name ASC, id ASC';
        $rows = Database::queryAll($sql, $params);

        $nameMap = [];
        foreach ($rows as $row) {
            $name = self::normalizeCategoryName($row['name'] ?? null);
            $nameMap[strtolower($name)] = self::toLookupModel($row, 64);
        }

        $entryRows = Database::queryAll(
            'SELECT DISTINCT category AS name
             FROM ' . self::TABLE_NAME . '
             WHERE user_id = ?
             ORDER BY category ASC',
            [$userUuid]
        );
        foreach ($entryRows as $row) {
            $name = self::normalizeCategoryName($row['name'] ?? null);
            $key = strtolower($name);
            if (!isset($nameMap[$key])) {
                $nameMap[$key] = [
                    'id' => '',
                    'user_id' => $userUuid,
                    'name' => $name,
                    'is_archived' => 0,
                    'created_at' => '',
                    'updated_at' => '',
                ];
            }
        }

        $list = array_values($nameMap);
        usort($list, static fn(array $a, array $b): int => strcasecmp((string)$a['name'], (string)$b['name']));
        return $list;
    }

    public static function createOwner(string $userUuid, string $name): array
    {
        self::ensureSchema();
        $userUuid = self::normalizeUuid($userUuid);
        $normalized = self::normalizeOwnerName($name);
        $id = self::generateUuidV4();
        Database::execute(
            'INSERT INTO ' . self::OWNER_TABLE_NAME . ' (id, user_id, name, is_archived) VALUES (?, ?, ?, 0)',
            [$id, $userUuid, $normalized]
        );
        $row = Database::queryOne(
            'SELECT id, user_id, name, is_archived, created_at, updated_at
             FROM ' . self::OWNER_TABLE_NAME . '
             WHERE id = ? AND user_id = ?
             LIMIT 1',
            [$id, $userUuid]
        );
        if ($row === null) {
            throw new RuntimeException('Owner created but could not be reloaded');
        }
        return self::toLookupModel($row, 120);
    }

    public static function createCategory(string $userUuid, string $name): array
    {
        self::ensureSchema();
        $userUuid = self::normalizeUuid($userUuid);
        $normalized = self::normalizeCategoryName($name);
        $id = self::generateUuidV4();
        Database::execute(
            'INSERT INTO ' . self::CATEGORY_TABLE_NAME . ' (id, user_id, name, is_archived) VALUES (?, ?, ?, 0)',
            [$id, $userUuid, $normalized]
        );
        $row = Database::queryOne(
            'SELECT id, user_id, name, is_archived, created_at, updated_at
             FROM ' . self::CATEGORY_TABLE_NAME . '
             WHERE id = ? AND user_id = ?
             LIMIT 1',
            [$id, $userUuid]
        );
        if ($row === null) {
            throw new RuntimeException('Category created but could not be reloaded');
        }
        return self::toLookupModel($row, 64);
    }

    public static function updateOwner(string $userUuid, string $ownerId, string $name): array
    {
        self::ensureSchema();
        $userUuid = self::normalizeUuid($userUuid);
        $ownerId = self::normalizeUuid($ownerId);
        $row = Database::queryOne(
            'SELECT id, user_id, name, is_archived, created_at, updated_at
             FROM ' . self::OWNER_TABLE_NAME . '
             WHERE id = ? AND user_id = ?
             LIMIT 1',
            [$ownerId, $userUuid]
        );
        if ($row === null) {
            throw new RuntimeException('Owner not found');
        }
        $oldName = self::normalizeOwnerName($row['name'] ?? null);
        $newName = self::normalizeOwnerName($name);

        Database::beginTransaction();
        try {
            Database::execute(
                'UPDATE ' . self::OWNER_TABLE_NAME . '
                 SET name = ?
                 WHERE id = ? AND user_id = ?
                 LIMIT 1',
                [$newName, $ownerId, $userUuid]
            );
            Database::execute(
                'UPDATE ' . self::TABLE_NAME . '
                 SET owner_name = ?
                 WHERE user_id = ? AND owner_name = ?',
                [$newName, $userUuid, $oldName]
            );
            $updated = Database::queryOne(
                'SELECT id, user_id, name, is_archived, created_at, updated_at
                 FROM ' . self::OWNER_TABLE_NAME . '
                 WHERE id = ? AND user_id = ?
                 LIMIT 1',
                [$ownerId, $userUuid]
            );
            if ($updated === null) {
                throw new RuntimeException('Owner was updated but could not be reloaded');
            }
            Database::commit();
            return self::toLookupModel($updated, 120);
        } catch (Throwable $error) {
            if (Database::inTransaction()) {
                Database::rollBack();
            }
            throw $error;
        }
    }

    public static function updateCategory(string $userUuid, string $categoryId, string $name): array
    {
        self::ensureSchema();
        $userUuid = self::normalizeUuid($userUuid);
        $categoryId = self::normalizeUuid($categoryId);
        $row = Database::queryOne(
            'SELECT id, user_id, name, is_archived, created_at, updated_at
             FROM ' . self::CATEGORY_TABLE_NAME . '
             WHERE id = ? AND user_id = ?
             LIMIT 1',
            [$categoryId, $userUuid]
        );
        if ($row === null) {
            throw new RuntimeException('Category not found');
        }
        $oldName = self::normalizeCategoryName($row['name'] ?? null);
        $newName = self::normalizeCategoryName($name);

        Database::beginTransaction();
        try {
            Database::execute(
                'UPDATE ' . self::CATEGORY_TABLE_NAME . '
                 SET name = ?
                 WHERE id = ? AND user_id = ?
                 LIMIT 1',
                [$newName, $categoryId, $userUuid]
            );
            Database::execute(
                'UPDATE ' . self::TABLE_NAME . '
                 SET category = ?
                 WHERE user_id = ? AND category = ?',
                [$newName, $userUuid, $oldName]
            );
            $updated = Database::queryOne(
                'SELECT id, user_id, name, is_archived, created_at, updated_at
                 FROM ' . self::CATEGORY_TABLE_NAME . '
                 WHERE id = ? AND user_id = ?
                 LIMIT 1',
                [$categoryId, $userUuid]
            );
            if ($updated === null) {
                throw new RuntimeException('Category was updated but could not be reloaded');
            }
            Database::commit();
            return self::toLookupModel($updated, 64);
        } catch (Throwable $error) {
            if (Database::inTransaction()) {
                Database::rollBack();
            }
            throw $error;
        }
    }

    public static function archiveOwner(string $userUuid, string $ownerId): bool
    {
        self::ensureSchema();
        $userUuid = self::normalizeUuid($userUuid);
        $ownerId = self::normalizeUuid($ownerId);
        $affected = Database::execute(
            'UPDATE ' . self::OWNER_TABLE_NAME . '
             SET is_archived = 1
             WHERE id = ? AND user_id = ?
             LIMIT 1',
            [$ownerId, $userUuid]
        );
        return $affected > 0;
    }

    public static function archiveCategory(string $userUuid, string $categoryId): bool
    {
        self::ensureSchema();
        $userUuid = self::normalizeUuid($userUuid);
        $categoryId = self::normalizeUuid($categoryId);
        $affected = Database::execute(
            'UPDATE ' . self::CATEGORY_TABLE_NAME . '
             SET is_archived = 1
             WHERE id = ? AND user_id = ?
             LIMIT 1',
            [$categoryId, $userUuid]
        );
        return $affected > 0;
    }

    public static function deleteOwner(string $userUuid, string $ownerId): bool
    {
        self::ensureSchema();
        $userUuid = self::normalizeUuid($userUuid);
        $ownerId = self::normalizeUuid($ownerId);
        $row = Database::queryOne(
            'SELECT name FROM ' . self::OWNER_TABLE_NAME . ' WHERE id = ? AND user_id = ? LIMIT 1',
            [$ownerId, $userUuid]
        );
        if ($row === null) {
            return false;
        }
        $name = self::normalizeOwnerName($row['name'] ?? null);
        Database::beginTransaction();
        try {
            Database::execute(
                'UPDATE ' . self::TABLE_NAME . '
                 SET owner_name = "Unassigned"
                 WHERE user_id = ? AND owner_name = ?',
                [$userUuid, $name]
            );
            $affected = Database::execute(
                'DELETE FROM ' . self::OWNER_TABLE_NAME . '
                 WHERE id = ? AND user_id = ?
                 LIMIT 1',
                [$ownerId, $userUuid]
            );
            Database::commit();
            return $affected > 0;
        } catch (Throwable $error) {
            if (Database::inTransaction()) {
                Database::rollBack();
            }
            throw $error;
        }
    }

    public static function deleteCategory(string $userUuid, string $categoryId): bool
    {
        self::ensureSchema();
        $userUuid = self::normalizeUuid($userUuid);
        $categoryId = self::normalizeUuid($categoryId);
        $row = Database::queryOne(
            'SELECT name FROM ' . self::CATEGORY_TABLE_NAME . ' WHERE id = ? AND user_id = ? LIMIT 1',
            [$categoryId, $userUuid]
        );
        if ($row === null) {
            return false;
        }
        $name = self::normalizeCategoryName($row['name'] ?? null);
        Database::beginTransaction();
        try {
            Database::execute(
                'UPDATE ' . self::TABLE_NAME . '
                 SET category = "General"
                 WHERE user_id = ? AND category = ?',
                [$userUuid, $name]
            );
            $affected = Database::execute(
                'DELETE FROM ' . self::CATEGORY_TABLE_NAME . '
                 WHERE id = ? AND user_id = ?
                 LIMIT 1',
                [$categoryId, $userUuid]
            );
            Database::commit();
            return $affected > 0;
        } catch (Throwable $error) {
            if (Database::inTransaction()) {
                Database::rollBack();
            }
            throw $error;
        }
    }

    private static function ensureUsersUuidColumn(): void
    {
        if (function_exists('catn8_users_table_ensure')) {
            catn8_users_table_ensure();
        }

        $column = Database::queryOne(
            "SELECT IS_NULLABLE
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'users'
               AND COLUMN_NAME = 'uuid'
             LIMIT 1"
        );

        if ($column === null) {
            Database::execute('ALTER TABLE users ADD COLUMN uuid CHAR(36) NULL AFTER id');
        }

        Database::execute("UPDATE users SET uuid = LOWER(UUID()) WHERE uuid IS NULL OR TRIM(uuid) = ''");

        if (!self::tableHasIndex('users', 'uniq_users_uuid')) {
            Database::execute('ALTER TABLE users ADD UNIQUE KEY uniq_users_uuid (uuid)');
        }

        $column = Database::queryOne(
            "SELECT IS_NULLABLE
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'users'
               AND COLUMN_NAME = 'uuid'
             LIMIT 1"
        );
        $isNullable = strtoupper((string)($column['IS_NULLABLE'] ?? 'YES')) === 'YES';
        if ($isNullable) {
            Database::execute('ALTER TABLE users MODIFY COLUMN uuid CHAR(36) NOT NULL');
        }
    }

    private static function ensureAddedColumns(): void
    {
        if (!self::tableHasColumn(self::TABLE_NAME, 'username_auth_tag')) {
            Database::execute('ALTER TABLE vault_entries ADD COLUMN username_auth_tag VARBINARY(16) NULL AFTER username_encrypted');
        }
        if (!self::tableHasColumn(self::TABLE_NAME, 'password_auth_tag')) {
            Database::execute('ALTER TABLE vault_entries ADD COLUMN password_auth_tag VARBINARY(16) NULL AFTER password_encrypted');
        }
        if (!self::tableHasColumn(self::TABLE_NAME, 'notes_auth_tag')) {
            Database::execute('ALTER TABLE vault_entries ADD COLUMN notes_auth_tag VARBINARY(16) NULL AFTER notes_encrypted');
        }
        if (!self::tableHasColumn(self::TABLE_NAME, 'is_active')) {
            Database::execute('ALTER TABLE vault_entries ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER password_strength');
        }
        if (!self::tableHasColumn(self::TABLE_NAME, 'replaced_by_entry_id')) {
            Database::execute('ALTER TABLE vault_entries ADD COLUMN replaced_by_entry_id CHAR(36) NULL AFTER is_active');
        }
        if (!self::tableHasColumn(self::TABLE_NAME, 'source_tab')) {
            Database::execute('ALTER TABLE vault_entries ADD COLUMN source_tab VARCHAR(191) NULL AFTER replaced_by_entry_id');
        }
        if (!self::tableHasColumn(self::TABLE_NAME, 'source_document')) {
            Database::execute('ALTER TABLE vault_entries ADD COLUMN source_document VARCHAR(191) NULL AFTER source_tab');
        }
        if (!self::tableHasColumn(self::TABLE_NAME, 'account_fingerprint')) {
            Database::execute('ALTER TABLE vault_entries ADD COLUMN account_fingerprint CHAR(64) NULL AFTER source_document');
        }
        if (!self::tableHasColumn(self::TABLE_NAME, 'entry_fingerprint')) {
            Database::execute('ALTER TABLE vault_entries ADD COLUMN entry_fingerprint CHAR(64) NULL AFTER account_fingerprint');
        }
        if (!self::tableHasColumn(self::TABLE_NAME, 'deactivated_at')) {
            Database::execute('ALTER TABLE vault_entries ADD COLUMN deactivated_at DATETIME NULL AFTER last_changed_at');
        }
        if (!self::tableHasColumn(self::TABLE_NAME, 'owner_name')) {
            Database::execute("ALTER TABLE vault_entries ADD COLUMN owner_name VARCHAR(120) NOT NULL DEFAULT 'Unassigned' AFTER category");
        }
        if (!self::tableHasColumn(self::TABLE_NAME, 'email_address')) {
            Database::execute('ALTER TABLE vault_entries ADD COLUMN email_address VARCHAR(191) NULL AFTER url');
        }

        if (!self::tableHasIndex(self::TABLE_NAME, 'idx_vault_entries_user_active')) {
            Database::execute('ALTER TABLE vault_entries ADD KEY idx_vault_entries_user_active (user_id, is_active, updated_at)');
        }
        if (!self::tableHasIndex(self::TABLE_NAME, 'idx_vault_entries_user_category_active')) {
            Database::execute('ALTER TABLE vault_entries ADD KEY idx_vault_entries_user_category_active (user_id, category, is_active)');
        }
        if (!self::tableHasIndex(self::TABLE_NAME, 'idx_vault_entries_user_owner_active')) {
            Database::execute('ALTER TABLE vault_entries ADD KEY idx_vault_entries_user_owner_active (user_id, owner_name, is_active)');
        }
        if (!self::tableHasIndex(self::TABLE_NAME, 'idx_vault_entries_user_account_active')) {
            Database::execute('ALTER TABLE vault_entries ADD KEY idx_vault_entries_user_account_active (user_id, account_fingerprint, is_active)');
        }
        if (!self::tableHasIndex(self::TABLE_NAME, 'uniq_vault_entries_user_entry_fp')) {
            Database::execute('ALTER TABLE vault_entries ADD UNIQUE KEY uniq_vault_entries_user_entry_fp (user_id, entry_fingerprint)');
        }

        Database::execute(
            'UPDATE vault_entries
             SET owner_name = CASE WHEN owner_name IS NULL OR TRIM(owner_name) = "" THEN "Unassigned" ELSE owner_name END,
                 account_fingerprint = COALESCE(account_fingerprint, LOWER(SHA2(CONCAT_WS("|", COALESCE(title, ""), COALESCE(url, ""), COALESCE(owner_name, ""), COALESCE(HEX(username_encrypted), "")), 256))),
                 entry_fingerprint = COALESCE(entry_fingerprint, LOWER(SHA2(CONCAT_WS("|", COALESCE(title, ""), COALESCE(url, ""), COALESCE(owner_name, ""), COALESCE(HEX(username_encrypted), ""), COALESCE(HEX(password_encrypted), "")), 256)))
             WHERE account_fingerprint IS NULL OR entry_fingerprint IS NULL'
        );

        Database::execute('ALTER TABLE vault_entries MODIFY COLUMN account_fingerprint CHAR(64) NOT NULL');
        Database::execute('ALTER TABLE vault_entries MODIFY COLUMN entry_fingerprint CHAR(64) NOT NULL');
    }

    private static function tableHasColumn(string $tableName, string $columnName): bool
    {
        $row = Database::queryOne(
            'SELECT 1
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = ?
               AND COLUMN_NAME = ?
             LIMIT 1',
            [$tableName, $columnName]
        );
        return $row !== null;
    }

    private static function tableHasIndex(string $tableName, string $indexName): bool
    {
        $row = Database::queryOne(
            'SELECT 1
             FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = ?
               AND INDEX_NAME = ?
             LIMIT 1',
            [$tableName, $indexName]
        );
        return $row !== null;
    }

    private static function normalizeUuid(string $value): string
    {
        $uuid = strtolower(trim($value));
        if (!self::isUuid($uuid)) {
            throw new RuntimeException('Invalid UUID format');
        }
        return $uuid;
    }

    private static function isUuid(string $value): bool
    {
        return (bool)preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/', $value);
    }

    private static function generateUuidV4(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        $hex = bin2hex($bytes);
        return sprintf(
            '%s-%s-%s-%s-%s',
            substr($hex, 0, 8),
            substr($hex, 8, 4),
            substr($hex, 12, 4),
            substr($hex, 16, 4),
            substr($hex, 20, 12)
        );
    }

    private static function normalizeText(string $value, int $maxLen): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }
        $value = preg_replace('/\s+/', ' ', $value) ?? '';
        if ($maxLen > 0 && strlen($value) > $maxLen) {
            $value = substr($value, 0, $maxLen);
        }
        return trim($value);
    }

    private static function requireNonEmptyText(string $value, string $error): string
    {
        $normalized = self::normalizeText($value, 8192);
        if ($normalized === '') {
            throw new RuntimeException($error);
        }
        return $normalized;
    }

    private static function normalizeNullableText($value, int $maxLen): ?string
    {
        if ($value === null) {
            return null;
        }
        $normalized = self::normalizeText((string)$value, $maxLen);
        return $normalized === '' ? null : $normalized;
    }

    private static function normalizeOwnerName($value): string
    {
        $owner = self::normalizeText((string)($value ?? ''), 120);
        return $owner === '' ? 'Unassigned' : $owner;
    }

    private static function normalizeCategoryName($value): string
    {
        $category = self::normalizeText((string)($value ?? ''), 64);
        return $category === '' ? 'General' : $category;
    }

    private static function normalizeNullableUrl($value): ?string
    {
        $url = self::normalizeNullableText($value, 2048);
        if ($url === null) {
            return null;
        }
        if (filter_var($url, FILTER_VALIDATE_URL) !== false) {
            return $url;
        }

        $candidate = trim($url);
        if (strpos($candidate, '://') === false && preg_match('/^[^\\s]+\\.[^\\s]+$/', $candidate)) {
            $withScheme = 'https://' . $candidate;
            if (filter_var($withScheme, FILTER_VALIDATE_URL) !== false) {
                return $withScheme;
            }
        }
        return null;
    }

    private static function normalizeNullableEmail($value): ?string
    {
        $email = self::normalizeNullableText($value, 191);
        if ($email === null) {
            return null;
        }
        $lowered = strtolower($email);
        return filter_var($lowered, FILTER_VALIDATE_EMAIL) !== false ? $lowered : null;
    }

    private static function toLookupModel(array $row, int $nameMaxLen): array
    {
        return [
            'id' => (string)($row['id'] ?? ''),
            'user_id' => (string)($row['user_id'] ?? ''),
            'name' => self::normalizeText((string)($row['name'] ?? ''), $nameMaxLen),
            'is_archived' => (int)($row['is_archived'] ?? 0),
            'created_at' => (string)($row['created_at'] ?? ''),
            'updated_at' => (string)($row['updated_at'] ?? ''),
        ];
    }

    private static function normalizeBool($value): int
    {
        if ($value === true || $value === 1 || $value === '1' || $value === 'true' || $value === 'yes' || $value === 'on') {
            return 1;
        }
        return 0;
    }

    private static function normalizePasswordStrength($value): int
    {
        $score = (int)$value;
        if ($score < 1) {
            $score = 1;
        }
        if ($score > 5) {
            $score = 5;
        }
        return $score;
    }

    private static function normalizeDatetime($value): string
    {
        $raw = trim((string)$value);
        if ($raw === '') {
            return gmdate('Y-m-d H:i:s');
        }
        $ts = strtotime($raw);
        if ($ts === false) {
            throw new RuntimeException('Invalid last_changed_at');
        }
        return gmdate('Y-m-d H:i:s', $ts);
    }

    private static function nullableString($value): ?string
    {
        if ($value === null) {
            return null;
        }
        $text = trim((string)$value);
        return $text === '' ? null : $text;
    }

    private static function canonicalize(?string $value): string
    {
        $v = strtolower(trim((string)$value));
        $v = preg_replace('/\s+/', ' ', $v) ?? '';
        return trim($v);
    }

    private static function computeAccountFingerprint(string $title, ?string $url, string $username, string $ownerName): string
    {
        $payload = implode('|', [
            self::canonicalize($title),
            self::canonicalize($url),
            self::canonicalize($ownerName),
            self::canonicalize($username),
        ]);
        return self::hmacFingerprint($payload, 'account-fingerprint');
    }

    private static function computeEntryFingerprint(string $title, ?string $url, string $username, string $password, ?string $notes, string $ownerName): string
    {
        $payload = implode('|', [
            self::canonicalize($title),
            self::canonicalize($url),
            self::canonicalize($ownerName),
            self::canonicalize($username),
            self::canonicalize($password),
            self::canonicalize($notes),
        ]);
        return self::hmacFingerprint($payload, 'entry-fingerprint');
    }

    private static function hmacFingerprint(string $payload, string $context): string
    {
        $key = self::deriveFieldKey($context);
        return hash_hmac('sha256', $payload, $key);
    }

    private static function encryptField(string $plaintext, string $iv, string $fieldName): array
    {
        $key = self::deriveFieldKey($fieldName);
        $tag = '';
        $ciphertext = openssl_encrypt(
            $plaintext,
            'aes-256-gcm',
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            'valid8:' . $fieldName
        );
        if ($ciphertext === false || $tag === '') {
            throw new RuntimeException('Encryption failed for ' . $fieldName);
        }
        return ['ciphertext' => $ciphertext, 'tag' => $tag];
    }

    private static function decryptField(string $ciphertext, string $tag, string $iv, string $fieldName): string
    {
        if ($ciphertext === '') {
            throw new RuntimeException('Encrypted payload missing for ' . $fieldName);
        }
        if (strlen($tag) !== 16) {
            throw new RuntimeException('Invalid auth tag for ' . $fieldName);
        }

        $key = self::deriveFieldKey($fieldName);
        $plaintext = openssl_decrypt(
            $ciphertext,
            'aes-256-gcm',
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            'valid8:' . $fieldName
        );
        if ($plaintext === false) {
            throw new RuntimeException('Decryption failed for ' . $fieldName);
        }
        return $plaintext;
    }

    private static function deriveFieldKey(string $fieldName): string
    {
        $masterKey = self::loadMasterKey();
        $key = hash_hkdf('sha256', $masterKey, 32, 'valid8:' . $fieldName, '');
        if (!is_string($key) || strlen($key) !== 32) {
            throw new RuntimeException('Could not derive encryption key');
        }
        return $key;
    }

    private static function loadMasterKey(): string
    {
        $envRaw = getenv(self::KEY_ENV_NAME);
        if (is_string($envRaw) && trim($envRaw) !== '') {
            return self::normalizeKeyMaterial($envRaw);
        }

        $stored = secret_get(self::KEY_SECRET_NAME);
        if (is_string($stored) && trim($stored) !== '') {
            return self::normalizeKeyMaterial($stored);
        }

        $generated = random_bytes(32);
        $encoded = base64_encode($generated);
        if (!secret_set(self::KEY_SECRET_NAME, $encoded)) {
            throw new RuntimeException('Failed to persist VALID8 encryption key');
        }
        return $generated;
    }

    private static function normalizeKeyMaterial(string $raw): string
    {
        $value = trim($raw);
        if ($value === '') {
            throw new RuntimeException('Encryption key is empty');
        }

        $base64Decoded = base64_decode($value, true);
        if (is_string($base64Decoded) && strlen($base64Decoded) === 32) {
            return $base64Decoded;
        }

        if (preg_match('/^[a-f0-9]{64}$/i', $value)) {
            $hexDecoded = hex2bin($value);
            if (is_string($hexDecoded) && strlen($hexDecoded) === 32) {
                return $hexDecoded;
            }
        }

        if (strlen($value) === 32) {
            return $value;
        }

        throw new RuntimeException('VALID8 encryption key must resolve to 32 bytes');
    }
}
