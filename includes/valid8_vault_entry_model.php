<?php

declare(strict_types=1);

final class Valid8VaultEntryModel
{
    private const TABLE_NAME = 'vault_entries';
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
            username_encrypted LONGBLOB NOT NULL,
            username_auth_tag VARBINARY(16) NOT NULL,
            password_encrypted LONGBLOB NOT NULL,
            password_auth_tag VARBINARY(16) NOT NULL,
            encryption_iv VARBINARY(12) NOT NULL,
            notes_encrypted LONGBLOB NULL,
            notes_auth_tag VARBINARY(16) NULL,
            category VARCHAR(64) NOT NULL,
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
            KEY idx_vault_entries_user_account_active (user_id, account_fingerprint, is_active),
            UNIQUE KEY uniq_vault_entries_user_entry_fp (user_id, entry_fingerprint),
            CONSTRAINT fk_vault_entries_user_uuid FOREIGN KEY (user_id) REFERENCES users(uuid) ON DELETE CASCADE,
            CONSTRAINT fk_vault_entries_replaced_by FOREIGN KEY (replaced_by_entry_id) REFERENCES vault_entries(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        self::ensureAddedColumns();
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
        $username = self::requireNonEmptyText((string)($input['username'] ?? ''), 'Username is required');
        $password = self::requireNonEmptyText((string)($input['password'] ?? ''), 'Password is required');
        $notes = self::normalizeNullableText($input['notes'] ?? null, 65535);
        $category = self::normalizeText((string)($input['category'] ?? ''), 64);
        if ($category === '') {
            throw new RuntimeException('Category is required');
        }

        $sourceTab = self::normalizeNullableText($input['source_tab'] ?? null, 191);
        $sourceDocument = self::normalizeNullableText($input['source_document'] ?? null, 191);
        $isFavorite = self::normalizeBool($input['is_favorite'] ?? false);
        $passwordStrength = self::normalizePasswordStrength($input['password_strength'] ?? 1);
        $lastChangedAt = self::normalizeDatetime($input['last_changed_at'] ?? date('c'));
        $isActive = self::normalizeBool($input['is_active'] ?? true);

        $accountFingerprint = self::computeAccountFingerprint($title, $url, $username);
        $entryFingerprint = self::computeEntryFingerprint($title, $url, $username, $password, $notes);

        $existing = Database::queryOne(
            'SELECT id, user_id, title, url, username_encrypted, username_auth_tag, password_encrypted, password_auth_tag, encryption_iv, notes_encrypted, notes_auth_tag, category, is_favorite, password_strength, is_active, replaced_by_entry_id, source_tab, source_document, account_fingerprint, entry_fingerprint, last_changed_at, deactivated_at, created_at, updated_at
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
                    (id, user_id, title, url, username_encrypted, username_auth_tag, password_encrypted, password_auth_tag, encryption_iv, notes_encrypted, notes_auth_tag, category, is_favorite, password_strength, is_active, replaced_by_entry_id, source_tab, source_document, account_fingerprint, entry_fingerprint, last_changed_at, deactivated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)',
                [
                    $id,
                    $userUuid,
                    $title,
                    $url,
                    $encrypted['username_encrypted'],
                    $encrypted['username_auth_tag'],
                    $encrypted['password_encrypted'],
                    $encrypted['password_auth_tag'],
                    $encrypted['encryption_iv'],
                    $encrypted['notes_encrypted'],
                    $encrypted['notes_auth_tag'],
                    $category,
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

        $sql = 'SELECT id, user_id, title, url, username_encrypted, username_auth_tag, password_encrypted, password_auth_tag, encryption_iv, notes_encrypted, notes_auth_tag, category, is_favorite, password_strength, is_active, replaced_by_entry_id, source_tab, source_document, account_fingerprint, entry_fingerprint, last_changed_at, deactivated_at, created_at, updated_at
                FROM vault_entries
                WHERE user_id = ?';
        $params = [$userUuid];
        if (!$includeInactive) {
            $sql .= ' AND is_active = 1';
        }
        $sql .= ' ORDER BY is_active DESC, updated_at DESC, created_at DESC';

        return Database::queryAll($sql, $params);
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
            'category' => (string)($row['category'] ?? ''),
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
            'SELECT id, user_id, title, url, username_encrypted, username_auth_tag, password_encrypted, password_auth_tag, encryption_iv, notes_encrypted, notes_auth_tag, category, is_favorite, password_strength, is_active, replaced_by_entry_id, source_tab, source_document, account_fingerprint, entry_fingerprint, last_changed_at, deactivated_at, created_at, updated_at
             FROM vault_entries
             WHERE id = ? AND user_id = ?
             LIMIT 1',
            [$entryId, $userUuid]
        );
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

        if (!self::tableHasIndex(self::TABLE_NAME, 'idx_vault_entries_user_active')) {
            Database::execute('ALTER TABLE vault_entries ADD KEY idx_vault_entries_user_active (user_id, is_active, updated_at)');
        }
        if (!self::tableHasIndex(self::TABLE_NAME, 'idx_vault_entries_user_category_active')) {
            Database::execute('ALTER TABLE vault_entries ADD KEY idx_vault_entries_user_category_active (user_id, category, is_active)');
        }
        if (!self::tableHasIndex(self::TABLE_NAME, 'idx_vault_entries_user_account_active')) {
            Database::execute('ALTER TABLE vault_entries ADD KEY idx_vault_entries_user_account_active (user_id, account_fingerprint, is_active)');
        }
        if (!self::tableHasIndex(self::TABLE_NAME, 'uniq_vault_entries_user_entry_fp')) {
            Database::execute('ALTER TABLE vault_entries ADD UNIQUE KEY uniq_vault_entries_user_entry_fp (user_id, entry_fingerprint)');
        }

        Database::execute(
            'UPDATE vault_entries
             SET account_fingerprint = COALESCE(account_fingerprint, LOWER(SHA2(CONCAT_WS("|", COALESCE(title, ""), COALESCE(url, ""), COALESCE(HEX(username_encrypted), "")), 256))),
                 entry_fingerprint = COALESCE(entry_fingerprint, LOWER(SHA2(CONCAT_WS("|", COALESCE(title, ""), COALESCE(url, ""), COALESCE(HEX(username_encrypted), ""), COALESCE(HEX(password_encrypted), "")), 256)))
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

    private static function computeAccountFingerprint(string $title, ?string $url, string $username): string
    {
        $payload = implode('|', [
            self::canonicalize($title),
            self::canonicalize($url),
            self::canonicalize($username),
        ]);
        return self::hmacFingerprint($payload, 'account-fingerprint');
    }

    private static function computeEntryFingerprint(string $title, ?string $url, string $username, string $password, ?string $notes): string
    {
        $payload = implode('|', [
            self::canonicalize($title),
            self::canonicalize($url),
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
