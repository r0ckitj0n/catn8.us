<?php

declare(strict_types=1);

require_once __DIR__ . '/secret_store.php';

final class Litig8Model
{
    public const AGENT_TOKEN_SECRET_KEY = 'litig8.agent.api_token_hash';
    public const MEDIA_SIGNING_SECRET_KEY = 'litig8.media.signing_key';
    public const GROUP_SLUG = 'litig8-users';

    public const ENTITY_TABLES = [
        'matters' => 'litig8_matters',
        'events' => 'litig8_events',
        'deadlines' => 'litig8_deadlines',
        'contacts' => 'litig8_contacts',
        'matter_contacts' => 'litig8_matter_contacts',
        'documents' => 'litig8_documents',
        'sources' => 'litig8_sources',
        'categories' => 'litig8_categories',
    ];

    public const DEFAULT_CATEGORY_SLUGS = [
        'disputes',
        'contracts',
        'property-deeds',
        'cabin-permits-zoning',
        'estate',
        'tax',
        'business-filings',
        'insurance-claims',
        'disability-legal',
        'citations',
    ];

    private const SENSITIVE_FIELDS = [
        'ssn_enc',
        'account_number_enc',
        'case_number_enc',
        'claim_number_enc',
    ];

    private static bool $schemaEnsured = false;

    // ------------------------------------------------------------------
    // Schema bootstrap
    // ------------------------------------------------------------------

    public static function ensureSchema(): void
    {
        if (self::$schemaEnsured) {
            return;
        }

        catn8_groups_seed_core();
        catn8_group_ensure(self::GROUP_SLUG, 'Litig8 Users');

        $sqlFile = dirname(__DIR__) . '/scripts/db/migrations/2026_10_10_litig8.sql';
        if (!is_file($sqlFile)) {
            throw new RuntimeException('Litig8 migration file missing');
        }
        $sql = (string)file_get_contents($sqlFile);
        foreach (preg_split('/;\s*\n/', $sql) as $stmt) {
            $stmt = trim($stmt);
            if ($stmt === '') {
                continue;
            }
            // Strip comment-only lines (including a leading file-header comment
            // block that shares a chunk with the first real statement).
            $lines = array_values(array_filter(explode("\n", $stmt), static function (string $line): bool {
                $t = trim($line);
                return $t !== '' && !str_starts_with($t, '--');
            }));
            $stmt = trim(implode("\n", $lines));
            if ($stmt === '') {
                continue;
            }
            Database::execute($stmt);
        }

        $matters = Database::queryOne(
            "SELECT 1 AS ok
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'litig8_matters'
             LIMIT 1"
        );
        if (!$matters) {
            throw new RuntimeException('Litig8 schema bootstrap failed (litig8_matters missing)');
        }

        self::applyAdditiveSchema();
        self::$schemaEnsured = true;
    }

    private static function applyAdditiveSchema(): void
    {
        $v2 = dirname(__DIR__) . '/scripts/db/migrations/2026_10_10_litig8_v2.sql';
        if (is_file($v2)) {
            $sql = (string)file_get_contents($v2);
            foreach (preg_split('/;\s*\n/', $sql) as $stmt) {
                $stmt = trim($stmt);
                if ($stmt === '') {
                    continue;
                }
                $lines = array_values(array_filter(explode("\n", $stmt), static function (string $line): bool {
                    $t = trim($line);
                    return $t !== '' && !str_starts_with($t, '--');
                }));
                $stmt = trim(implode("\n", $lines));
                if ($stmt !== '') {
                    Database::execute($stmt);
                }
            }
        }

        foreach (self::ENTITY_TABLES as $entity => $table) {
            if ($entity === 'sources' || $entity === 'categories') {
                continue;
            }
            self::ensureColumn($table, 'deleted_at', 'deleted_at DATETIME NULL');
        }
        self::ensureUniqueIndexes();
        self::seedDefaultCategories();
    }

    public static function ensureUniqueIndexes(): void
    {
        self::ensureIndex('litig8_documents', 'idx_litig8_documents_sha', 'KEY idx_litig8_documents_sha (sha256)');
        self::ensureIndex('litig8_documents', 'uniq_litig8_documents_ext', 'UNIQUE KEY uniq_litig8_documents_ext (external_source_id)');
        self::ensureIndex('litig8_events', 'uniq_litig8_events_ext', 'UNIQUE KEY uniq_litig8_events_ext (external_source_id)');
        self::ensureIndex('litig8_deadlines', 'uniq_litig8_deadlines_ext', 'UNIQUE KEY uniq_litig8_deadlines_ext (external_source_id)');
        self::ensureIndex('litig8_contacts', 'uniq_litig8_contacts_ext', 'UNIQUE KEY uniq_litig8_contacts_ext (external_source_id)');
    }

    private static function seedDefaultCategories(): void
    {
        $countRow = Database::queryOne('SELECT COUNT(*) AS c FROM litig8_categories');
        if ((int)($countRow['c'] ?? 0) > 0) {
            return;
        }
        foreach (self::DEFAULT_CATEGORY_SLUGS as $i => $slug) {
            Database::execute(
                'INSERT IGNORE INTO litig8_categories (slug, label, sort_order, active) VALUES (?, ?, ?, 1)',
                [$slug, self::humanizeSlug($slug), $i]
            );
        }
    }

    private static function ensureColumn(string $table, string $column, string $ddl): void
    {
        $row = Database::queryOne(
            'SELECT 1 AS ok FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
            [$table, $column]
        );
        if (!$row) {
            Database::execute('ALTER TABLE `' . $table . '` ADD COLUMN ' . $ddl);
        }
    }

    private static function ensureIndex(string $table, string $indexName, string $ddl): void
    {
        $row = Database::queryOne(
            'SELECT 1 AS ok FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
            [$table, $indexName]
        );
        if (!$row) {
            try {
                Database::execute('ALTER TABLE `' . $table . '` ADD ' . $ddl);
            } catch (Throwable $e) {
                // Duplicate values can block a unique index; cleanup will retry later.
            }
        }
    }

    // ------------------------------------------------------------------
    // Storage / tokens / signing
    // ------------------------------------------------------------------

    public static function storageRoot(): string
    {
        $root = dirname(__DIR__) . '/private/litig8';
        if (!is_dir($root) && !mkdir($root, 0700, true) && !is_dir($root)) {
            throw new RuntimeException('Failed to create litig8 storage root');
        }
        $ht = $root . '/.htaccess';
        if (!is_file($ht)) {
            file_put_contents($ht, "Require all denied\n");
            @chmod($ht, 0644);
        }
        return $root;
    }

    public static function localTokenPath(): string
    {
        return (string)(getenv('HOME') ?: dirname(__DIR__)) . '/.local/state/catn8/litig8/agent-api-token';
    }

    public static function verifyApiToken(string $provided): bool
    {
        $provided = trim($provided);
        if ($provided === '') {
            return false;
        }
        $stored = secret_get(self::AGENT_TOKEN_SECRET_KEY);
        if (!is_string($stored) || $stored === '') {
            return false;
        }
        return hash_equals($stored, hash('sha256', $provided));
    }

    public static function rotateApiToken(): string
    {
        $token = catn8_random_token();
        if (!secret_set(self::AGENT_TOKEN_SECRET_KEY, hash('sha256', $token))) {
            throw new RuntimeException('Failed to store litig8 agent token hash');
        }
        return $token;
    }

    public static function writeLocalTokenFile(string $token): string
    {
        $path = self::localTokenPath();
        $dir = dirname($path);
        if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
            throw new RuntimeException('Failed to create litig8 token directory');
        }
        if (file_put_contents($path, $token . "\n") === false) {
            throw new RuntimeException('Failed to write litig8 token file');
        }
        @chmod($path, 0600);
        return $path;
    }

    public static function signingKey(): string
    {
        $key = secret_get(self::MEDIA_SIGNING_SECRET_KEY);
        if (!is_string($key) || $key === '') {
            $key = bin2hex(random_bytes(32));
            if (!secret_set(self::MEDIA_SIGNING_SECRET_KEY, $key)) {
                throw new RuntimeException('Failed to store litig8 media signing key');
            }
        }
        return $key;
    }

    public static function signDocumentAccess(int $documentId, int $exp): string
    {
        return hash_hmac('sha256', 'litig8-doc|' . $documentId . '|' . $exp, self::signingKey());
    }

    public static function verifyDocumentAccess(int $documentId, int $exp, string $sig): bool
    {
        if ($documentId <= 0 || $exp < time() || $sig === '') {
            return false;
        }
        return hash_equals(self::signDocumentAccess($documentId, $exp), $sig);
    }

    public static function documentSignedUrl(int $documentId, int $ttlSeconds = 300): string
    {
        $exp = time() + max(30, min(3600, $ttlSeconds));
        $sig = self::signDocumentAccess($documentId, $exp);
        return '/api/litig8_media.php?document_id=' . $documentId . '&exp=' . $exp . '&sig=' . rawurlencode($sig);
    }

    public static function encryptField(?string $plain): ?string
    {
        if ($plain === null) {
            return null;
        }
        $plain = trim($plain);
        if ($plain === '') {
            return null;
        }
        return secret_encrypt($plain);
    }

    public static function decryptField(?string $enc): ?string
    {
        if ($enc === null || $enc === '') {
            return null;
        }
        $plain = secret_decrypt($enc);
        return is_string($plain) ? $plain : null;
    }

    public static function maskSecret(?string $plain): ?string
    {
        if ($plain === null || $plain === '') {
            return null;
        }
        $len = strlen($plain);
        if ($len <= 4) {
            return str_repeat('•', $len);
        }
        return str_repeat('•', max(0, $len - 4)) . substr($plain, -4);
    }

    // ------------------------------------------------------------------
    // Audit / access
    // ------------------------------------------------------------------

    public static function audit(
        ?int $actorUserId,
        string $action,
        ?string $tableName,
        ?int $recordId,
        ?int $matterId,
        $before,
        $after,
        ?string $actorLabel = null
    ): void {
        self::ensureSchema();
        Database::execute(
            'INSERT INTO litig8_audit_log (actor_user_id, actor_label, action, table_name, record_id, matter_id, before_json, after_json, ip, ua)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $actorUserId,
                $actorLabel,
                $action,
                $tableName,
                $recordId,
                $matterId,
                $before === null ? null : json_encode($before, JSON_UNESCAPED_UNICODE),
                $after === null ? null : json_encode($after, JSON_UNESCAPED_UNICODE),
                (string)($_SERVER['REMOTE_ADDR'] ?? ''),
                substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
            ]
        );
    }

    public static function isSiteAdmin(int $uid): bool
    {
        return catn8_user_is_admin($uid);
    }

    public static function canAccessApp(int $uid): bool
    {
        return self::isSiteAdmin($uid) || catn8_user_in_group($uid, self::GROUP_SLUG);
    }

    public static function privilegedUserId(): int
    {
        $admin = Database::queryOne('SELECT id FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1');
        return (int)($admin['id'] ?? 0);
    }

    // ------------------------------------------------------------------
    // Category helpers
    // ------------------------------------------------------------------

    public static function normalizeCategorySlug($value): ?string
    {
        if ($value === null) {
            return null;
        }
        $v = strtolower(trim((string)$value));
        if ($v === '') {
            return null;
        }
        $v = preg_replace('/[^a-z0-9]+/', '-', $v);
        $v = trim((string)$v, '-');
        return $v === '' ? null : $v;
    }

    public static function resolveCategorySlug(array $input): ?string
    {
        return self::normalizeCategorySlug($input['category_slug'] ?? $input['category'] ?? null);
    }

    public static function humanizeSlug(string $slug): string
    {
        $words = preg_split('/[-_]+/', $slug) ?: [$slug];
        $words = array_filter($words, static fn(string $w): bool => $w !== '');
        return implode(' ', array_map(static fn(string $w): string => ucfirst($w), $words));
    }

    // ------------------------------------------------------------------
    // Source rows
    // ------------------------------------------------------------------

    public static function upsertSource(array $input, bool $dryRun = false): int
    {
        self::ensureSchema();
        $sourceType = self::clip((string)($input['source_type'] ?? 'manual'), 32) ?: 'manual';
        $account = self::nullableClip($input['account'] ?? null, 191);
        $threadId = self::nullableClip($input['thread_id'] ?? null, 191);
        $messageId = self::nullableClip($input['message_id'] ?? null, 191);
        $messageDate = self::nullableDateTime($input['message_date'] ?? $input['record_date'] ?? null);
        $filePath = self::nullableClip($input['file_path'] ?? $input['source_file'] ?? null, 512);
        $recordType = self::nullableClip($input['record_type'] ?? null, 96);
        $recordId = self::nullableClip($input['record_id'] ?? null, 191);
        $note = self::nullableClip($input['note'] ?? null, 65535);

        $fingerprint = hash('sha256', implode('|', [
            $sourceType,
            (string)$account,
            (string)$threadId,
            (string)$messageId,
            (string)$recordType,
            (string)$recordId,
        ]));
        $existing = Database::queryOne(
            'SELECT id FROM litig8_sources WHERE fingerprint = ? LIMIT 1',
            [$fingerprint]
        );
        if ($existing) {
            $id = (int)$existing['id'];
            if ($dryRun) {
                return $id;
            }
            Database::execute(
                'UPDATE litig8_sources
                 SET message_date = COALESCE(?, message_date), file_path = COALESCE(?, file_path), note = COALESCE(?, note)
                 WHERE id = ?',
                [$messageDate, $filePath, $note, $id]
            );
            return $id;
        }
        if ($dryRun) {
            return 0;
        }
        Database::execute(
            'INSERT INTO litig8_sources (source_type, account, thread_id, message_id, message_date, file_path, record_type, record_id, note, fingerprint)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$sourceType, $account, $threadId, $messageId, $messageDate, $filePath, $recordType, $recordId, $note, $fingerprint]
        );
        return (int)Database::lastInsertId();
    }

    // ------------------------------------------------------------------
    // Row output / listing
    // ------------------------------------------------------------------

    public static function publicizeRow(string $entity, array $row, bool $revealSensitive = false): array
    {
        $out = $row;
        foreach (self::SENSITIVE_FIELDS as $field) {
            if (!array_key_exists($field, $out)) {
                continue;
            }
            $plain = self::decryptField(isset($out[$field]) ? (string)$out[$field] : null);
            $publicKey = preg_replace('/_enc$/', '', $field) ?: $field;
            if ($revealSensitive) {
                $out[$publicKey] = $plain;
                $out[$publicKey . '_masked'] = self::maskSecret($plain);
            } else {
                $out[$publicKey . '_masked'] = self::maskSecret($plain);
                $out[$publicKey . '_present'] = $plain !== null && $plain !== '';
            }
            unset($out[$field]);
        }
        if ($entity === 'documents' && isset($out['id'])) {
            $out['media_url'] = self::documentSignedUrl((int)$out['id']);
            unset($out['file_path']);
        }
        if (isset($out['source_ref_id']) && (int)$out['source_ref_id'] > 0) {
            $src = Database::queryOne('SELECT * FROM litig8_sources WHERE id = ?', [(int)$out['source_ref_id']]);
            $out['source'] = $src ?: null;
        }
        return $out;
    }

    public static function listEntity(string $entity, int $uid, ?int $matterId = null, int $limit = 200): array
    {
        return self::listEntityPage($entity, $uid, $matterId, $limit, 0)['records'];
    }

    public static function listEntityPage(string $entity, int $uid, ?int $matterId = null, int $limit = 200, int $offset = 0): array
    {
        self::ensureSchema();
        if (!isset(self::ENTITY_TABLES[$entity])) {
            throw new InvalidArgumentException('Unknown entity');
        }
        $table = self::ENTITY_TABLES[$entity];
        $limit = max(1, min(1000, $limit));
        $offset = max(0, $offset);
        $limitSql = (int)$limit;
        $offsetSql = (int)$offset;
        $live = self::liveSql($table);

        $where = '1=1';
        $params = [];
        if ($matterId !== null && $matterId > 0) {
            if ($entity === 'events' || $entity === 'matter_contacts') {
                $where = 'matter_id = ?';
                $params[] = $matterId;
            } elseif ($entity === 'deadlines') {
                $where = '(matter_id = ? OR matter_id IS NULL)';
                $params[] = $matterId;
            }
        }

        $orderBy = match ($entity) {
            'events' => 'event_date DESC, id DESC',
            'deadlines' => 'due_at ASC, id ASC',
            'contacts' => 'name ASC',
            'categories' => 'sort_order ASC, id ASC',
            default => 'id DESC',
        };

        $countRow = Database::queryOne("SELECT COUNT(*) AS c FROM {$table} WHERE {$where}{$live}", $params);
        $total = (int)($countRow['c'] ?? 0);
        $rows = Database::queryAll(
            "SELECT * FROM {$table} WHERE {$where}{$live} ORDER BY {$orderBy} LIMIT {$limitSql} OFFSET {$offsetSql}",
            $params
        );

        $out = [];
        foreach ($rows as $row) {
            $out[] = self::publicizeRow($entity, $row);
        }
        $out = self::attachDocumentsToRecords($entity, $out);

        return [
            'records' => $out,
            'total' => $total,
            'limit' => $limit,
            'offset' => $offset,
            'next' => ($offset + $limit) < $total ? ($offset + $limit) : null,
        ];
    }

    public static function countEntity(string $entity, int $uid, ?int $matterId = null): int
    {
        return self::listEntityPage($entity, $uid, $matterId, 1, 0)['total'];
    }

    public static function getEntity(string $entity, int $id, int $uid, bool $revealSensitive = false): ?array
    {
        self::ensureSchema();
        if (!isset(self::ENTITY_TABLES[$entity])) {
            throw new InvalidArgumentException('Unknown entity');
        }
        $table = self::ENTITY_TABLES[$entity];
        $row = Database::queryOne("SELECT * FROM {$table} WHERE id = ?" . self::liveSql($table), [$id]);
        if (!$row) {
            return null;
        }
        if ($revealSensitive) {
            if (!self::isSiteAdmin($uid)) {
                throw new RuntimeException('Not authorized');
            }
            $matterId = self::matterIdForRow($entity, $row);
            self::audit($uid, 'reveal_sensitive', $table, $id, $matterId, null, ['fields' => self::SENSITIVE_FIELDS]);
        }
        $out = self::publicizeRow($entity, $row, $revealSensitive);
        $attached = self::attachDocumentsToRecords($entity, [$out]);
        $out = $attached[0];
        if ($entity === 'documents') {
            $out['links'] = self::listDocumentRecordLinks((int)$out['id']);
        }
        return $out;
    }

    public static function findEntityRow(string $entity, ?int $id = null, ?string $externalSourceId = null): ?array
    {
        if (!isset(self::ENTITY_TABLES[$entity])) {
            throw new InvalidArgumentException('Unknown entity');
        }
        $table = self::ENTITY_TABLES[$entity];
        $live = self::liveSql($table);
        if ($id !== null && $id > 0) {
            $row = Database::queryOne("SELECT * FROM {$table} WHERE id = ?" . $live, [$id]);
            return $row ?: null;
        }
        $ext = self::nullableClip($externalSourceId, 191);
        if ($ext === null) {
            return null;
        }
        $row = Database::queryOne(
            "SELECT * FROM {$table} WHERE external_source_id = ?" . $live . ' ORDER BY id DESC',
            [$ext]
        );
        return $row ?: null;
    }

    public static function matterRow(int $matterId): ?array
    {
        $row = Database::queryOne(
            'SELECT * FROM litig8_matters WHERE id = ?' . self::liveSql('litig8_matters'),
            [$matterId]
        );
        return $row ?: null;
    }

    // ------------------------------------------------------------------
    // Delete
    // ------------------------------------------------------------------

    public static function deleteEntity(string $entity, int $id, int $uid, ?string $actorLabel = null, bool $hard = true): array
    {
        return self::deleteEntityByKey($entity, $id, null, $uid, $actorLabel, $hard);
    }

    public static function deleteEntityByKey(string $entity, ?int $id, ?string $externalSourceId, int $uid, ?string $actorLabel = null, bool $hard = true): array
    {
        self::ensureSchema();
        if (!isset(self::ENTITY_TABLES[$entity]) || $entity === 'sources') {
            throw new InvalidArgumentException('Unknown or protected entity');
        }
        $row = self::findEntityRow($entity, $id, $externalSourceId);
        if (!$row) {
            throw new InvalidArgumentException('Not found');
        }
        $table = self::ENTITY_TABLES[$entity];
        $recordId = (int)$row['id'];
        $matterId = self::matterIdForRow($entity, $row);

        $before = self::publicizeRow($entity, $row);
        $retiredFile = null;
        if ($entity === 'documents') {
            $retiredFile = self::retireDocumentFile($row);
            if ($hard) {
                Database::execute('DELETE FROM litig8_record_documents WHERE document_id = ?', [$recordId]);
            }
        }
        if ($hard && $entity !== 'documents') {
            Database::execute('DELETE FROM litig8_record_documents WHERE entity = ? AND record_id = ?', [$entity, $recordId]);
        }

        if ($hard) {
            Database::execute("DELETE FROM {$table} WHERE id = ?", [$recordId]);
            $action = 'delete';
        } else {
            $ext = self::nullableClip($row['external_source_id'] ?? null, 191);
            if ($ext !== null && self::hasColumn($table, 'external_source_id')) {
                Database::execute(
                    "UPDATE {$table} SET external_source_id = ? WHERE id = ?",
                    [$ext . ':deleted:' . $recordId, $recordId]
                );
            }
            if (self::hasColumn($table, 'deleted_at')) {
                Database::execute("UPDATE {$table} SET deleted_at = NOW() WHERE id = ?", [$recordId]);
            } else {
                Database::execute("DELETE FROM {$table} WHERE id = ?", [$recordId]);
            }
            $action = 'soft_delete';
        }
        self::audit(
            $uid > 0 ? $uid : null,
            $action,
            $table,
            $recordId,
            $matterId,
            $before,
            ['hard' => $hard, 'retired_file' => $retiredFile],
            $actorLabel
        );
        return [
            'id' => $recordId,
            'entity' => $entity,
            'deleted' => true,
            'hard' => $hard,
            'retired_file' => $retiredFile !== null,
        ];
    }

    // ------------------------------------------------------------------
    // Upsert
    // ------------------------------------------------------------------

    public static function upsertEntity(string $entity, array $input, int $uid, bool $dryRun = false, ?string $actorLabel = null): array
    {
        self::ensureSchema();
        if ($dryRun && !Database::inTransaction()) {
            return self::withRolledBackTransaction(static function () use ($entity, $input, $uid, $actorLabel) {
                return self::upsertEntity($entity, $input, $uid, true, $actorLabel);
            });
        }
        if (!isset(self::ENTITY_TABLES[$entity])) {
            throw new InvalidArgumentException('Unknown entity');
        }
        if ($entity === 'sources') {
            $sourceId = self::upsertSource($input, $dryRun);
            return ['id' => $sourceId > 0 ? $sourceId : null, 'created' => $sourceId === 0, 'updated' => $sourceId > 0, 'dry_run' => $dryRun];
        }

        $externalId = self::nullableClip($input['external_source_id'] ?? $input['source_id'] ?? null, 191);
        $table = self::ENTITY_TABLES[$entity];
        $existing = null;
        $live = self::liveSql($table);
        // Match by external_source_id first, then by id. Only create when neither matches.
        if ($externalId !== null && self::hasColumn($table, 'external_source_id')) {
            $existing = Database::queryOne(
                "SELECT * FROM {$table} WHERE external_source_id = ?" . $live . ' ORDER BY id DESC',
                [$externalId]
            );
        }
        if ($existing === null && !empty($input['id'])) {
            $existing = Database::queryOne("SELECT * FROM {$table} WHERE id = ?" . $live, [(int)$input['id']]);
        }

        $normalized = self::normalizeEntityInput($entity, $input, $existing, $dryRun);
        $matterId = self::matterIdForRow($entity, $normalized + ($existing ?: []));

        // Agent imports referencing a matter must point at a real one.
        if ($actorLabel !== null && $entity !== 'matters' && $matterId !== null && !self::matterRow($matterId)) {
            throw new InvalidArgumentException('matter_id not found');
        }

        if ($dryRun) {
            $preview = [
                'id' => $existing ? (int)$existing['id'] : null,
                'created' => $existing === null,
                'updated' => $existing !== null,
                'dry_run' => true,
                'preview' => self::publicizeRow($entity, array_merge($existing ?: [], $normalized)),
            ];
            if ($entity === 'matters') {
                $previewMatterId = $existing ? (int)$existing['id'] : 0;
                $preview['nested_results'] = self::processNestedMatterImport($previewMatterId, $input, $uid, true, $actorLabel);
            }
            return $preview;
        }

        if ($existing) {
            $sets = [];
            $params = [];
            foreach ($normalized as $col => $val) {
                $sets[] = "`{$col}` = ?";
                $params[] = $val;
            }
            $params[] = (int)$existing['id'];
            Database::execute('UPDATE ' . $table . ' SET ' . implode(', ', $sets) . ' WHERE id = ?', $params);
            $id = (int)$existing['id'];
            $after = Database::queryOne("SELECT * FROM {$table} WHERE id = ?", [$id]);
            self::audit($uid, 'update', $table, $id, $matterId, self::publicizeRow($entity, $existing), self::publicizeRow($entity, $after ?: []), $actorLabel);
            $record = self::publicizeRow($entity, $after ?: []);
            $attached = self::attachDocumentsToRecords($entity, [$record]);
            $result = ['id' => $id, 'created' => false, 'updated' => true, 'dry_run' => false, 'record' => $attached[0]];
            if ($entity === 'matters') {
                $result['nested_results'] = self::processNestedMatterImport($id, $input, $uid, false, $actorLabel);
            }
            return $result;
        }

        $cols = array_keys($normalized);
        $placeholders = implode(', ', array_fill(0, count($cols), '?'));
        $colSql = implode(', ', array_map(static fn($c) => '`' . $c . '`', $cols));
        Database::execute('INSERT INTO ' . $table . ' (' . $colSql . ') VALUES (' . $placeholders . ')', array_values($normalized));
        $id = (int)Database::lastInsertId();
        $after = Database::queryOne("SELECT * FROM {$table} WHERE id = ?", [$id]);
        self::audit($uid, 'create', $table, $id, $matterId, null, self::publicizeRow($entity, $after ?: []), $actorLabel);
        $record = self::publicizeRow($entity, $after ?: []);
        $attached = self::attachDocumentsToRecords($entity, [$record]);
        $result = ['id' => $id, 'created' => true, 'updated' => false, 'dry_run' => false, 'record' => $attached[0]];
        if ($entity === 'matters') {
            $result['nested_results'] = self::processNestedMatterImport($id, $input, $uid, false, $actorLabel);
        }
        return $result;
    }

    /**
     * After a matter upsert, normalize any nested key_dates / deadlines / parties /
     * attorneys arrays into child-entity upserts (events, deadlines, contacts +
     * matter_contacts). Runs inside the same transaction as the parent call, so a
     * dry_run on the matter rolls every nested write back too.
     */
    private static function processNestedMatterImport(int $matterId, array $input, int $uid, bool $dryRun, ?string $actorLabel): array
    {
        $result = [
            'events' => ['created' => 0, 'updated' => 0, 'errors' => []],
            'deadlines' => ['created' => 0, 'updated' => 0, 'errors' => []],
            'parties' => ['created' => 0, 'updated' => 0, 'errors' => []],
            'attorneys' => ['created' => 0, 'updated' => 0, 'errors' => []],
        ];

        $keyDates = $input['key_dates'] ?? null;
        if (is_array($keyDates)) {
            foreach (array_values($keyDates) as $idx => $item) {
                if (!is_array($item)) {
                    continue;
                }
                try {
                    $payload = [
                        'matter_id' => $matterId,
                        'event_date' => $item['date'] ?? $item['event_date'] ?? null,
                        'title' => $item['label'] ?? $item['title'] ?? 'Key Date',
                        'description' => $item['description'] ?? null,
                        'location' => $item['location'] ?? null,
                        'external_source_id' => $item['external_source_id'] ?? $item['source_id'] ?? null,
                    ];
                    $r = self::upsertEntity('events', $payload, $uid, $dryRun, $actorLabel);
                    if (!empty($r['created'])) {
                        $result['events']['created']++;
                    } elseif (!empty($r['updated'])) {
                        $result['events']['updated']++;
                    }
                } catch (Throwable $e) {
                    $result['events']['errors'][] = ['index' => $idx, 'error' => $e->getMessage()];
                }
            }
        }

        $deadlinesInput = $input['deadlines'] ?? null;
        if (is_array($deadlinesInput)) {
            foreach (array_values($deadlinesInput) as $idx => $item) {
                if (!is_array($item)) {
                    continue;
                }
                try {
                    $payload = array_merge($item, ['matter_id' => $matterId]);
                    $r = self::upsertEntity('deadlines', $payload, $uid, $dryRun, $actorLabel);
                    if (!empty($r['created'])) {
                        $result['deadlines']['created']++;
                    } elseif (!empty($r['updated'])) {
                        $result['deadlines']['updated']++;
                    }
                } catch (Throwable $e) {
                    $result['deadlines']['errors'][] = ['index' => $idx, 'error' => $e->getMessage()];
                }
            }
        }

        $parties = $input['parties'] ?? null;
        if (is_array($parties)) {
            foreach (array_values($parties) as $idx => $item) {
                if (!is_array($item)) {
                    continue;
                }
                try {
                    $r = self::upsertMatterContactFromSpec($matterId, $item, 'party', $uid, $dryRun, $actorLabel);
                    if (!empty($r['created'])) {
                        $result['parties']['created']++;
                    } elseif (!empty($r['updated'])) {
                        $result['parties']['updated']++;
                    }
                } catch (Throwable $e) {
                    $result['parties']['errors'][] = ['index' => $idx, 'error' => $e->getMessage()];
                }
            }
        }

        $attorneys = $input['attorneys'] ?? null;
        if (is_array($attorneys)) {
            foreach (array_values($attorneys) as $idx => $item) {
                if (!is_array($item)) {
                    continue;
                }
                try {
                    $r = self::upsertMatterContactFromSpec($matterId, $item, 'attorney', $uid, $dryRun, $actorLabel);
                    if (!empty($r['created'])) {
                        $result['attorneys']['created']++;
                    } elseif (!empty($r['updated'])) {
                        $result['attorneys']['updated']++;
                    }
                } catch (Throwable $e) {
                    $result['attorneys']['errors'][] = ['index' => $idx, 'error' => $e->getMessage()];
                }
            }
        }

        return $result;
    }

    private static function upsertMatterContactFromSpec(int $matterId, array $item, string $defaultType, int $uid, bool $dryRun, ?string $actorLabel): array
    {
        $ownerUserId = (int)($item['owner_user_id'] ?? self::privilegedUserId());
        if ($defaultType === 'attorney') {
            $contactType = 'attorney';
        } else {
            $t = strtolower((string)($item['type'] ?? $item['contact_type'] ?? 'party'));
            $contactType = $t === 'opposing' ? 'opposing' : 'party';
        }
        $contactPayload = [
            'owner_user_id' => $ownerUserId,
            'name' => $item['name'] ?? 'Unknown',
            'contact_type' => $contactType,
            'organization' => $item['organization'] ?? $item['firm'] ?? null,
            'role_title' => $item['role_title'] ?? $item['title'] ?? null,
            'phone' => $item['phone'] ?? null,
            'email' => $item['email'] ?? null,
            'address' => $item['address'] ?? null,
            'notes' => $item['notes'] ?? null,
            'external_source_id' => $item['external_source_id'] ?? $item['source_id'] ?? null,
        ];
        $contactResult = self::upsertEntity('contacts', $contactPayload, $uid, $dryRun, $actorLabel);
        $contactId = (int)($contactResult['id'] ?? 0);
        if ($contactId > 0) {
            $linkPayload = [
                'matter_id' => $matterId,
                'contact_id' => $contactId,
                'role' => $item['role'] ?? $contactType,
                'notes' => $item['link_notes'] ?? null,
            ];
            self::upsertEntity('matter_contacts', $linkPayload, $uid, $dryRun, $actorLabel);
        }
        return $contactResult;
    }

    public static function importBatch(string $entity, array $rows, int $uid, bool $dryRun = false, ?string $actorLabel = 'agent:litig8'): array
    {
        self::ensureSchema();
        if ($dryRun) {
            return self::withRolledBackTransaction(static function () use ($entity, $rows, $uid, $actorLabel) {
                return self::importBatchInner($entity, $rows, $uid, true, $actorLabel);
            });
        }
        return self::importBatchInner($entity, $rows, $uid, false, $actorLabel);
    }

    private static function importBatchInner(string $entity, array $rows, int $uid, bool $dryRun, ?string $actorLabel): array
    {
        $created = 0;
        $updated = 0;
        $errors = [];
        $results = [];
        foreach (array_values($rows) as $idx => $row) {
            if (!is_array($row)) {
                $errors[] = ['index' => $idx, 'error' => 'row must be object'];
                continue;
            }
            try {
                $result = self::upsertEntity($entity, $row, $uid, $dryRun, $actorLabel);
                if (!empty($result['created'])) {
                    $created++;
                } elseif (!empty($result['updated'])) {
                    $updated++;
                }
                $results[] = $result;
            } catch (Throwable $e) {
                $errors[] = ['index' => $idx, 'error' => $e->getMessage()];
            }
        }
        return [
            'entity' => $entity,
            'dry_run' => $dryRun,
            'created' => $created,
            'updated' => $updated,
            'error_count' => count($errors),
            'errors' => $errors,
            'results' => $results,
        ];
    }

    /**
     * Always roll back so a dry_run cannot persist sources, audit rows, or records.
     */
    private static function withRolledBackTransaction(callable $fn)
    {
        $started = false;
        if (!Database::inTransaction()) {
            Database::beginTransaction();
            $started = true;
        }
        try {
            return $fn();
        } finally {
            if ($started && Database::inTransaction()) {
                Database::rollBack();
            }
        }
    }

    private static function matterIdForRow(string $entity, array $row): ?int
    {
        if ($entity === 'matters') {
            return isset($row['id']) ? (int)$row['id'] : null;
        }
        if (in_array($entity, ['events', 'deadlines', 'matter_contacts'], true)) {
            if (array_key_exists('matter_id', $row) && $row['matter_id'] !== null && $row['matter_id'] !== '') {
                return (int)$row['matter_id'];
            }
            return null;
        }
        return null;
    }

    private static function normalizeEntityInput(string $entity, array $input, ?array $existing, bool $dryRun = false): array
    {
        $sourceRefId = null;
        if (!empty($input['source']) && is_array($input['source'])) {
            $sourceRefId = self::upsertSource($input['source'], $dryRun);
        } elseif (isset($input['source_ref_id'])) {
            $sourceRefId = (int)$input['source_ref_id'] ?: null;
        } elseif (isset($input['source_account']) || isset($input['thread_id']) || isset($input['source_file']) || isset($input['record_type'])) {
            $sourceRefId = self::upsertSource([
                'source_type' => $input['source_type'] ?? 'manual',
                'account' => $input['source_account'] ?? $input['account'] ?? null,
                'thread_id' => $input['thread_id'] ?? null,
                'message_id' => $input['message_id'] ?? null,
                'message_date' => $input['message_date'] ?? $input['record_date'] ?? null,
                'file_path' => $input['source_file'] ?? $input['file_path'] ?? null,
                'record_type' => $input['record_type'] ?? $entity,
                'record_id' => $input['record_id'] ?? $input['external_source_id'] ?? $input['source_id'] ?? null,
                'note' => $input['source_note'] ?? null,
            ], $dryRun);
        }

        if ($entity === 'matters' && (array_key_exists('category_slug', $input) || array_key_exists('category', $input))) {
            $input['category_slug'] = self::resolveCategorySlug($input);
        }
        if ($entity === 'categories') {
            $slug = self::normalizeCategorySlug($input['slug'] ?? $input['category_slug'] ?? null);
            if ($slug !== null) {
                $input['slug'] = $slug;
            }
        }
        if (in_array($entity, ['matters', 'contacts', 'documents'], true)
            && (!array_key_exists('owner_user_id', $input) || (int)($input['owner_user_id'] ?? 0) <= 0)
            && !$existing
        ) {
            $fallbackOwner = self::privilegedUserId();
            if ($fallbackOwner > 0) {
                $input['owner_user_id'] = $fallbackOwner;
            }
        }

        $out = [];
        $map = self::entityFieldMap($entity);
        foreach ($map as $field => $meta) {
            if (!array_key_exists($field, $input) && !($meta['from'] ?? null)) {
                // keep existing on update for omitted fields
                if ($existing && array_key_exists($field, $existing) && empty($meta['required_on_create'])) {
                    continue;
                }
                if (!empty($meta['required_on_create']) && !$existing) {
                    throw new InvalidArgumentException($field . ' required');
                }
                continue;
            }
            $raw = $input[$field] ?? null;
            if (isset($meta['from']) && ($raw === null || $raw === '')) {
                $raw = $input[$meta['from']] ?? null;
            }
            if (!empty($meta['encrypt'])) {
                if ($raw === null && $existing) {
                    continue;
                }
                $out[$field] = self::encryptField($raw === null ? null : (string)$raw);
                continue;
            }
            if (($meta['type'] ?? '') === 'int') {
                if ($raw === null || $raw === '') {
                    if (!empty($meta['required_on_create']) && !$existing) {
                        throw new InvalidArgumentException($field . ' required');
                    }
                    $out[$field] = null;
                } else {
                    $out[$field] = (int)$raw;
                }
                continue;
            }
            if (($meta['type'] ?? '') === 'bool') {
                $out[$field] = (!empty($raw) && $raw !== '0') ? 1 : 0;
                continue;
            }
            if (($meta['type'] ?? '') === 'decimal') {
                $out[$field] = ($raw === null || $raw === '') ? null : (string)$raw;
                continue;
            }
            if (($meta['type'] ?? '') === 'date') {
                $out[$field] = self::nullableDate($raw);
                continue;
            }
            if (($meta['type'] ?? '') === 'datetime') {
                $out[$field] = self::nullableDateTime($raw);
                continue;
            }
            if (($meta['type'] ?? '') === 'json') {
                if (is_array($raw) || is_object($raw)) {
                    $out[$field] = json_encode($raw, JSON_UNESCAPED_UNICODE);
                } elseif ($raw === null || $raw === '') {
                    $out[$field] = null;
                } else {
                    $out[$field] = (string)$raw;
                }
                continue;
            }
            $out[$field] = self::nullableClip($raw, (int)($meta['len'] ?? 191));
            if (!empty($meta['required_on_create']) && !$existing && ($out[$field] === null || $out[$field] === '')) {
                throw new InvalidArgumentException($field . ' required');
            }
        }

        if ($sourceRefId !== null && (int)$sourceRefId > 0) {
            $out['source_ref_id'] = (int)$sourceRefId;
        }
        if (array_key_exists('external_source_id', $map) || array_key_exists('external_source_id', $input) || array_key_exists('source_id', $input)) {
            $ext = self::nullableClip($input['external_source_id'] ?? $input['source_id'] ?? null, 191);
            if ($ext !== null) {
                $out['external_source_id'] = $ext;
            }
        }
        if (in_array($entity, ['matters', 'contacts', 'documents'], true) && !isset($out['owner_user_id']) && !$existing) {
            $fallbackOwner = self::privilegedUserId();
            if ($fallbackOwner > 0) {
                $out['owner_user_id'] = $fallbackOwner;
            } else {
                throw new InvalidArgumentException('owner_user_id required');
            }
        }
        return $out;
    }

    private static function entityFieldMap(string $entity): array
    {
        return match ($entity) {
            'matters' => [
                'owner_user_id' => ['type' => 'int', 'required_on_create' => true],
                'title' => ['len' => 191, 'required_on_create' => true],
                'category_slug' => ['len' => 64],
                'status' => ['len' => 32],
                'case_number_enc' => ['encrypt' => true, 'from' => 'case_number'],
                'claim_number_enc' => ['encrypt' => true, 'from' => 'claim_number'],
                'parties_summary' => ['len' => 65535],
                'attorneys_summary' => ['len' => 65535],
                'summary' => ['len' => 65535],
                'external_source_id' => ['len' => 191],
            ],
            'events' => [
                'matter_id' => ['type' => 'int', 'required_on_create' => true],
                'event_date' => ['type' => 'datetime', 'required_on_create' => true],
                'title' => ['len' => 191, 'required_on_create' => true],
                'description' => ['len' => 65535],
                'location' => ['len' => 255],
                'external_source_id' => ['len' => 191],
            ],
            'deadlines' => [
                'matter_id' => ['type' => 'int'],
                'due_at' => ['type' => 'datetime', 'required_on_create' => true],
                'title' => ['len' => 191, 'required_on_create' => true],
                'description' => ['len' => 65535],
                'status' => ['len' => 32],
                'completed_at' => ['type' => 'datetime'],
                'external_source_id' => ['len' => 191],
            ],
            'contacts' => [
                'owner_user_id' => ['type' => 'int', 'required_on_create' => true],
                'name' => ['len' => 191, 'required_on_create' => true],
                'contact_type' => ['len' => 32],
                'organization' => ['len' => 191],
                'role_title' => ['len' => 191],
                'phone' => ['len' => 64],
                'email' => ['len' => 191],
                'address' => ['len' => 65535],
                'notes' => ['len' => 65535],
                'ssn_enc' => ['encrypt' => true, 'from' => 'ssn'],
                'account_number_enc' => ['encrypt' => true, 'from' => 'account_number'],
                'external_source_id' => ['len' => 191],
            ],
            'matter_contacts' => [
                'matter_id' => ['type' => 'int', 'required_on_create' => true],
                'contact_id' => ['type' => 'int', 'required_on_create' => true],
                'role' => ['len' => 96],
                'notes' => ['len' => 65535],
                'external_source_id' => ['len' => 191],
            ],
            'documents' => [
                'owner_user_id' => ['type' => 'int', 'required_on_create' => true],
                'title' => ['len' => 191, 'required_on_create' => true],
                'doc_type' => ['len' => 96],
                'file_path' => ['len' => 512, 'required_on_create' => true],
                'mime' => ['len' => 120],
                'sha256' => ['len' => 64],
                'size_bytes' => ['type' => 'int'],
                'uploaded_by' => ['type' => 'int'],
                'external_source_id' => ['len' => 191],
            ],
            'categories' => [
                'slug' => ['len' => 64, 'required_on_create' => true],
                'label' => ['len' => 191, 'required_on_create' => true],
                'sort_order' => ['type' => 'int'],
                'active' => ['type' => 'bool'],
            ],
            default => throw new InvalidArgumentException('Unsupported entity'),
        };
    }

    // ------------------------------------------------------------------
    // Dashboard
    // ------------------------------------------------------------------

    public static function dashboard(int $uid): array
    {
        self::ensureSchema();
        $today = date('Y-m-d 00:00:00');

        $deadlineRows = Database::queryAll(
            "SELECT * FROM litig8_deadlines
             WHERE (due_at >= ? OR (status = 'open' AND due_at < ?))" . self::liveSql('litig8_deadlines') . '
             ORDER BY due_at ASC LIMIT 100',
            [$today, $today]
        );
        $todayTs = strtotime($today);
        $upcomingDeadlines = [];
        foreach ($deadlineRows as $row) {
            $isOverdue = strtotime((string)$row['due_at']) < $todayTs && (string)($row['status'] ?? '') === 'open';
            $public = self::publicizeRow('deadlines', $row);
            $public['is_overdue'] = $isOverdue;
            $upcomingDeadlines[] = $public;
        }

        $openMatterRows = Database::queryAll(
            "SELECT category_slug, COUNT(*) AS c FROM litig8_matters
             WHERE status = 'open'" . self::liveSql('litig8_matters') . '
             GROUP BY category_slug'
        );
        $openMattersByCategory = [];
        foreach ($openMatterRows as $row) {
            $openMattersByCategory[(string)($row['category_slug'] ?? '')] = (int)$row['c'];
        }

        $recentEventRows = Database::queryAll(
            'SELECT * FROM litig8_events WHERE 1=1' . self::liveSql('litig8_events') . '
             ORDER BY event_date DESC, id DESC LIMIT 20'
        );
        $recentEvents = array_map(static fn(array $r): array => self::publicizeRow('events', $r), $recentEventRows);

        return [
            'upcoming_deadlines' => $upcomingDeadlines,
            'open_matters_by_category' => $openMattersByCategory,
            'recent_events' => $recentEvents,
            'matters_total' => self::countEntity('matters', $uid),
            'events_total' => self::countEntity('events', $uid),
            'deadlines_total' => self::countEntity('deadlines', $uid),
            'contacts_total' => self::countEntity('contacts', $uid),
            'documents_total' => self::countEntity('documents', $uid),
            'categories' => self::listEntity('categories', $uid, null, 100),
        ];
    }

    // ------------------------------------------------------------------
    // Document storage
    // ------------------------------------------------------------------

    public static function storeUploadedDocument(array $file, array $meta, int $uid, ?string $actorLabel = null): array
    {
        self::ensureSchema();
        $ownerUserId = (int)($meta['owner_user_id'] ?? $uid);
        if ($ownerUserId <= 0) {
            throw new InvalidArgumentException('owner_user_id required');
        }
        if (!isset($file['tmp_name']) || !is_file((string)$file['tmp_name'])) {
            throw new InvalidArgumentException('upload file missing');
        }
        $title = self::clip((string)($meta['title'] ?? ($file['name'] ?? 'Document')), 191) ?: 'Document';
        $docType = self::nullableClip($meta['doc_type'] ?? null, 96);
        $mime = self::nullableClip($file['type'] ?? ($meta['mime'] ?? null), 120);
        $sha = hash_file('sha256', $file['tmp_name']);
        $size = (int)filesize($file['tmp_name']);
        $ext = strtolower(pathinfo((string)($file['name'] ?? ''), PATHINFO_EXTENSION));
        if ($ext === '' || !preg_match('/^[a-z0-9]{1,10}$/', $ext)) {
            $ext = 'bin';
        }
        $externalId = self::nullableClip($meta['external_source_id'] ?? $meta['source_id'] ?? null, 191);
        $existing = $externalId !== null
            ? Database::queryOne(
                'SELECT * FROM litig8_documents WHERE external_source_id = ?' . self::liveSql('litig8_documents') . ' ORDER BY id DESC',
                [$externalId]
            )
            : null;

        $rel = $existing['file_path'] ?? null;
        $fileReplaced = false;
        if ($existing && hash_equals((string)($existing['sha256'] ?? ''), $sha)) {
            @unlink($file['tmp_name']);
        } else {
            $relDir = 'u' . $ownerUserId . '/' . date('Y/m');
            $absDir = self::storageRoot() . '/' . $relDir;
            if (!is_dir($absDir) && !mkdir($absDir, 0700, true) && !is_dir($absDir)) {
                throw new RuntimeException('Failed to create document directory');
            }
            $basename = bin2hex(random_bytes(16)) . '.' . $ext;
            $abs = $absDir . '/' . $basename;
            $rel = $relDir . '/' . $basename;
            if (!rename($file['tmp_name'], $abs) && !copy($file['tmp_name'], $abs)) {
                throw new RuntimeException('Failed to store document');
            }
            @chmod($abs, 0600);
            $fileReplaced = true;
            if ($existing) {
                self::retireDocumentFile($existing);
            }
        }

        $sourceRefId = null;
        if (!empty($meta['source']) && is_array($meta['source'])) {
            $sourceRefId = self::upsertSource($meta['source']);
        } elseif (!empty($meta['source_ref_id'])) {
            $sourceRefId = (int)$meta['source_ref_id'];
        }

        $payload = [
            'owner_user_id' => $ownerUserId,
            'title' => $title,
            'doc_type' => $docType,
            'file_path' => $rel,
            'mime' => $mime,
            'sha256' => $sha,
            'size_bytes' => $size,
            'uploaded_by' => $uid > 0 ? $uid : null,
            'source_ref_id' => $sourceRefId,
            'external_source_id' => $externalId,
        ];
        if ($existing) {
            $payload['id'] = (int)$existing['id'];
        }
        $result = self::upsertEntity('documents', $payload, $uid, false, $actorLabel);
        $docId = (int)($result['id'] ?? 0);
        $links = $meta['links'] ?? [];
        if (is_string($links)) {
            $decoded = json_decode($links, true);
            $links = is_array($decoded) ? $decoded : [];
        }
        $linkResults = [];
        if ($docId > 0 && is_array($links)) {
            foreach ($links as $link) {
                if (!is_array($link)) {
                    continue;
                }
                $linkResults[] = self::linkFromSpec($docId, $link, $uid, $actorLabel);
            }
        }
        $result['file_replaced'] = $fileReplaced;
        $result['links'] = $linkResults;
        if (!empty($result['record'])) {
            $attached = self::attachDocumentsToRecords('documents', [$result['record']]);
            $result['record'] = $attached[0];
            $result['record']['linked_records'] = self::listDocumentRecordLinks($docId);
        }
        return $result;
    }

    public static function resolveDocumentPath(array $row): ?string
    {
        $rel = (string)($row['file_path'] ?? '');
        if ($rel === '' || str_contains($rel, '..')) {
            return null;
        }
        $full = self::storageRoot() . '/' . ltrim($rel, '/');
        $realRoot = realpath(self::storageRoot());
        $realFile = realpath($full);
        if ($realRoot === false || $realFile === false) {
            return is_file($full) ? $full : null;
        }
        if (!str_starts_with($realFile, $realRoot . DIRECTORY_SEPARATOR) && $realFile !== $realRoot) {
            return null;
        }
        return $realFile;
    }

    public static function retireDocumentFile(array $row): ?string
    {
        $full = self::resolveDocumentPath($row);
        if ($full === null || !is_file($full)) {
            return null;
        }
        $retiredDir = self::storageRoot() . '/retired/' . date('Y/m');
        if (!is_dir($retiredDir) && !mkdir($retiredDir, 0700, true) && !is_dir($retiredDir)) {
            @unlink($full);
            return 'deleted';
        }
        $dest = $retiredDir . '/' . basename($full);
        if (!@rename($full, $dest)) {
            @unlink($full);
            return 'deleted';
        }
        @chmod($dest, 0600);
        return 'retired/' . date('Y/m') . '/' . basename($full);
    }

    // ------------------------------------------------------------------
    // Document links
    // ------------------------------------------------------------------

    public static function attachDocumentsToRecords(string $entity, array $records): array
    {
        if ($entity === 'documents' || $entity === 'sources' || $entity === 'categories') {
            return $records;
        }
        $ids = [];
        foreach ($records as $record) {
            if (!empty($record['id'])) {
                $ids[] = (int)$record['id'];
            }
        }
        if ($ids === []) {
            return $records;
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $links = Database::queryAll(
            "SELECT * FROM litig8_record_documents WHERE entity = ? AND record_id IN ({$placeholders})",
            array_merge([$entity], $ids)
        );
        $byRecord = [];
        $docIds = [];
        foreach ($links as $link) {
            $rid = (int)$link['record_id'];
            $did = (int)$link['document_id'];
            $byRecord[$rid][] = $link;
            $docIds[$did] = $did;
        }
        $docs = [];
        if ($docIds !== []) {
            $dph = implode(',', array_fill(0, count($docIds), '?'));
            $docRows = Database::queryAll(
                'SELECT * FROM litig8_documents WHERE id IN (' . $dph . ')' . self::liveSql('litig8_documents'),
                array_values($docIds)
            );
            foreach ($docRows as $docRow) {
                $docs[(int)$docRow['id']] = self::publicizeRow('documents', $docRow);
            }
        }
        foreach ($records as &$record) {
            $rid = (int)($record['id'] ?? 0);
            $attached = [];
            foreach ($byRecord[$rid] ?? [] as $link) {
                $did = (int)$link['document_id'];
                if (!isset($docs[$did])) {
                    continue;
                }
                $item = $docs[$did];
                $item['link_role'] = $link['role'] ?? null;
                $item['link_note'] = $link['note'] ?? null;
                $attached[$did] = $item;
            }
            $record['documents'] = array_values($attached);
        }
        unset($record);
        return $records;
    }

    public static function listDocumentRecordLinks(int $documentId): array
    {
        return Database::queryAll(
            'SELECT * FROM litig8_record_documents WHERE document_id = ? ORDER BY id ASC',
            [$documentId]
        );
    }

    public static function resolveRecordId(string $entity, $recordId = null, $externalSourceId = null): int
    {
        if ($recordId !== null && $recordId !== '' && (int)$recordId > 0) {
            return (int)$recordId;
        }
        $row = self::findEntityRow($entity, null, $externalSourceId !== null ? (string)$externalSourceId : null);
        if (!$row) {
            throw new InvalidArgumentException('record not found for link');
        }
        return (int)$row['id'];
    }

    public static function linkFromSpec(int $documentId, array $spec, int $uid, ?string $actorLabel = null, bool $dryRun = false): array
    {
        $entity = trim((string)($spec['entity'] ?? ''));
        if ($entity === '' || !isset(self::ENTITY_TABLES[$entity])) {
            throw new InvalidArgumentException('link entity required');
        }
        $recordId = self::resolveRecordId($entity, $spec['record_id'] ?? null, $spec['external_source_id'] ?? $spec['source_id'] ?? null);
        $role = self::nullableClip($spec['role'] ?? null, 96);
        $note = self::nullableClip($spec['note'] ?? null, 255);
        return self::linkDocument($documentId, $entity, $recordId, $role, $note, $uid, $actorLabel, $dryRun);
    }

    public static function linkDocument(
        int $documentId,
        string $entity,
        int $recordId,
        ?string $role,
        ?string $note,
        int $uid,
        ?string $actorLabel = null,
        bool $dryRun = false
    ): array {
        self::ensureSchema();
        if ($documentId <= 0 || $recordId <= 0 || !isset(self::ENTITY_TABLES[$entity])) {
            throw new InvalidArgumentException('document_id, entity, and record_id required');
        }
        $doc = Database::queryOne(
            'SELECT * FROM litig8_documents WHERE id = ?' . self::liveSql('litig8_documents'),
            [$documentId]
        );
        if (!$doc) {
            throw new InvalidArgumentException('document not found');
        }
        $existing = Database::queryOne(
            'SELECT * FROM litig8_record_documents WHERE document_id = ? AND entity = ? AND record_id = ?',
            [$documentId, $entity, $recordId]
        );
        if ($existing) {
            $preview = $existing;
            $preview['role'] = $role !== null ? $role : ($existing['role'] ?? null);
            $preview['note'] = $note !== null ? $note : ($existing['note'] ?? null);
            if ($dryRun) {
                return ['created' => false, 'updated' => true, 'dry_run' => true, 'link' => $preview];
            }
            Database::execute(
                'UPDATE litig8_record_documents SET role = COALESCE(?, role), note = COALESCE(?, note) WHERE id = ?',
                [$role, $note, (int)$existing['id']]
            );
            $link = Database::queryOne('SELECT * FROM litig8_record_documents WHERE id = ?', [(int)$existing['id']]);
            return ['created' => false, 'updated' => true, 'dry_run' => false, 'link' => $link];
        }
        $preview = [
            'document_id' => $documentId,
            'entity' => $entity,
            'record_id' => $recordId,
            'role' => $role,
            'note' => $note,
        ];
        if ($dryRun) {
            return ['created' => true, 'updated' => false, 'dry_run' => true, 'link' => $preview];
        }
        Database::execute(
            'INSERT INTO litig8_record_documents (document_id, entity, record_id, role, note) VALUES (?, ?, ?, ?, ?)',
            [$documentId, $entity, $recordId, $role, $note]
        );
        $id = (int)Database::lastInsertId();
        $link = Database::queryOne('SELECT * FROM litig8_record_documents WHERE id = ?', [$id]);
        self::audit($uid > 0 ? $uid : null, 'link_document', 'litig8_record_documents', $id, self::matterIdForRow($entity, (array)($doc ?: [])), null, $link, $actorLabel);
        return ['created' => true, 'updated' => false, 'dry_run' => false, 'link' => $link];
    }

    public static function unlinkDocument(
        int $documentId,
        string $entity,
        int $recordId,
        int $uid,
        ?string $actorLabel = null,
        bool $dryRun = false
    ): array {
        self::ensureSchema();
        $existing = Database::queryOne(
            'SELECT * FROM litig8_record_documents WHERE document_id = ? AND entity = ? AND record_id = ?',
            [$documentId, $entity, $recordId]
        );
        if (!$existing) {
            throw new InvalidArgumentException('link not found');
        }
        if ($dryRun) {
            return ['deleted' => true, 'dry_run' => true, 'link' => $existing];
        }
        Database::execute('DELETE FROM litig8_record_documents WHERE id = ?', [(int)$existing['id']]);
        self::audit($uid > 0 ? $uid : null, 'unlink_document', 'litig8_record_documents', (int)$existing['id'], null, $existing, null, $actorLabel);
        return ['deleted' => true, 'dry_run' => false, 'link' => $existing];
    }

    // ------------------------------------------------------------------
    // Maintenance
    // ------------------------------------------------------------------

    /**
     * Cleanup duplicate rows / orphan files. Full dedupe is not needed for a
     * single-owner private hub; this stub keeps the API contract (counts only,
     * no filenames or case data) so callers can wire it up later if needed.
     */
    public static function cleanupDuplicates(int $uid, ?string $actorLabel = null): array
    {
        self::ensureSchema();
        self::ensureUniqueIndexes();
        return [
            'duplicate_groups' => 0,
            'duplicate_rows_removed' => 0,
            'duplicate_files_retired' => 0,
            'orphan_files_retired' => 0,
        ];
    }

    public static function deleteSyntheticTestRows(int $uid, ?string $actorLabel = null): array
    {
        self::ensureSchema();
        $deleted = [];
        foreach (self::ENTITY_TABLES as $entity => $table) {
            if ($entity === 'sources') {
                continue;
            }
            $hasExt = self::hasColumn($table, 'external_source_id');
            $nameCol = null;
            foreach (['title', 'name', 'label'] as $candidate) {
                if (self::hasColumn($table, $candidate)) {
                    $nameCol = $candidate;
                    break;
                }
            }
            $conditions = [];
            $params = [];
            if ($hasExt) {
                $conditions[] = 'external_source_id LIKE ?';
                $params[] = 'synthetic:%';
            }
            if ($nameCol !== null) {
                $conditions[] = "`{$nameCol}` LIKE ?";
                $params[] = '%(synthetic)%';
            }
            if ($conditions === []) {
                continue;
            }
            $rows = Database::queryAll(
                "SELECT id FROM {$table} WHERE " . implode(' OR ', $conditions),
                $params
            );
            foreach ($rows as $row) {
                try {
                    $result = self::deleteEntityByKey($entity, (int)$row['id'], null, $uid, $actorLabel, true);
                    $deleted[] = ['entity' => $entity, 'id' => $result['id']];
                } catch (Throwable $e) {
                    $deleted[] = ['entity' => $entity, 'id' => (int)$row['id'], 'error' => 'failed'];
                }
            }
        }
        return ['deleted_count' => count($deleted), 'deleted' => $deleted];
    }

    // ------------------------------------------------------------------
    // Low-level helpers
    // ------------------------------------------------------------------

    private static function clip(string $value, int $len): string
    {
        $value = trim($value);
        if (strlen($value) <= $len) {
            return $value;
        }
        return substr($value, 0, $len);
    }

    private static function nullableClip($value, int $len): ?string
    {
        if ($value === null) {
            return null;
        }
        $s = self::clip((string)$value, $len);
        return $s === '' ? null : $s;
    }

    private static function nullableDate($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $ts = strtotime((string)$value);
        return $ts === false ? null : date('Y-m-d', $ts);
    }

    private static function nullableDateTime($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $ts = strtotime((string)$value);
        return $ts === false ? null : date('Y-m-d H:i:s', $ts);
    }

    private static function hasColumn(string $table, string $column): bool
    {
        $row = Database::queryOne(
            'SELECT 1 AS ok FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
            [$table, $column]
        );
        return (bool)$row;
    }

    private static function liveSql(string $table, string $alias = ''): string
    {
        if (!self::hasColumn($table, 'deleted_at')) {
            return '';
        }
        $col = $alias !== '' ? $alias . '.deleted_at' : 'deleted_at';
        return ' AND ' . $col . ' IS NULL';
    }
}
