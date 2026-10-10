<?php

declare(strict_types=1);

require_once __DIR__ . '/secret_store.php';

final class Medic8Model
{
    public const AGENT_TOKEN_SECRET_KEY = 'medic8.agent.api_token_hash';
    public const MEDIA_SIGNING_SECRET_KEY = 'medic8.media.signing_key';
    public const GROUP_SLUG = 'medic8-users';

    public const ENTITY_TABLES = [
        'people' => 'medic8_people',
        'providers' => 'medic8_providers',
        'medications' => 'medic8_medications',
        'med_fills' => 'medic8_med_fills',
        'appointments' => 'medic8_appointments',
        'conditions' => 'medic8_conditions',
        'allergies' => 'medic8_allergies',
        'labs' => 'medic8_labs',
        'procedures' => 'medic8_procedures',
        'encounters' => 'medic8_encounters',
        'disability_events' => 'medic8_disability_events',
        'insurance' => 'medic8_insurance',
        'documents' => 'medic8_documents',
        'portal_messages' => 'medic8_portal_messages',
        'invoices' => 'medic8_invoices',
        'sources' => 'medic8_sources',
        'shares' => 'medic8_shares',
    ];

    public const CATEGORY_FOR_ENTITY = [
        'medications' => 'meds',
        'med_fills' => 'meds',
        'appointments' => 'appointments',
        'providers' => 'providers',
        'conditions' => 'conditions',
        'disability_events' => 'disability',
        'insurance' => 'insurance',
        'documents' => 'documents',
        'allergies' => 'conditions',
        'labs' => 'documents',
        'procedures' => 'documents',
        'encounters' => 'documents',
        'portal_messages' => 'documents',
        'invoices' => 'documents',
        'people' => 'all',
    ];

    private const SENSITIVE_FIELDS = [
        'rx_number_enc',
        'case_number_enc',
        'member_id_enc',
        'group_no_enc',
        'medicare_number_enc',
        'ssn_enc',
    ];

    private static bool $schemaEnsured = false;

    public static function ensureSchema(): void
    {
        if (self::$schemaEnsured) {
            return;
        }

        catn8_groups_seed_core();
        catn8_group_ensure(self::GROUP_SLUG, 'Medic8 Users');

        $sqlFile = dirname(__DIR__) . '/scripts/db/migrations/2026_10_10_medic8.sql';
        if (!is_file($sqlFile)) {
            throw new RuntimeException('Medic8 migration file missing');
        }
        $sql = (string)file_get_contents($sqlFile);
        foreach (preg_split('/;\s*\n/', $sql) as $stmt) {
            $stmt = trim($stmt);
            if ($stmt === '' || str_starts_with($stmt, '--')) {
                continue;
            }
            // Strip leading comment lines inside chunk
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

        $people = Database::queryOne(
            "SELECT 1 AS ok
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'medic8_people'
             LIMIT 1"
        );
        if (!$people) {
            throw new RuntimeException('Medic8 schema bootstrap failed (medic8_people missing)');
        }

        self::applyAdditiveSchema();
        self::$schemaEnsured = true;
    }

    private static function applyAdditiveSchema(): void
    {
        $v2 = dirname(__DIR__) . '/scripts/db/migrations/2026_10_10_medic8_v2.sql';
        if (is_file($v2)) {
            $sql = (string)file_get_contents($v2);
            foreach (preg_split('/;\s*\n/', $sql) as $stmt) {
                $stmt = trim($stmt);
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

        self::ensureColumn('medic8_people', 'external_source_id', 'external_source_id VARCHAR(191) NULL');
        self::ensureColumn('medic8_people', 'source_ref_id', 'source_ref_id INT NULL');
        foreach (self::ENTITY_TABLES as $entity => $table) {
            if ($entity === 'sources') {
                continue;
            }
            self::ensureColumn($table, 'deleted_at', 'deleted_at DATETIME NULL');
        }
        self::ensureUniqueIndexes();

        Database::execute(
            "INSERT IGNORE INTO medic8_record_documents (document_id, entity, record_id, role)
             SELECT document_id, 'procedures', id, 'primary'
             FROM medic8_procedures
             WHERE document_id IS NOT NULL AND document_id > 0"
        );
    }

    public static function ensureUniqueIndexes(): void
    {
        self::ensureIndex('medic8_people', 'uniq_medic8_people_ext', 'UNIQUE KEY uniq_medic8_people_ext (external_source_id)');
        self::ensureIndex('medic8_documents', 'idx_medic8_documents_sha', 'KEY idx_medic8_documents_sha (sha256)');
        self::ensureIndex('medic8_documents', 'uniq_medic8_documents_ext', 'UNIQUE KEY uniq_medic8_documents_ext (external_source_id)');
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

    public static function storageRoot(): string
    {
        $root = dirname(__DIR__) . '/private/medic8';
        if (!is_dir($root) && !mkdir($root, 0700, true) && !is_dir($root)) {
            throw new RuntimeException('Failed to create medic8 storage root');
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
        return (string)(getenv('HOME') ?: dirname(__DIR__)) . '/.local/state/catn8/medic8/agent-api-token';
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
            throw new RuntimeException('Failed to store medic8 agent token hash');
        }
        return $token;
    }

    public static function writeLocalTokenFile(string $token): string
    {
        $path = self::localTokenPath();
        $dir = dirname($path);
        if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
            throw new RuntimeException('Failed to create medic8 token directory');
        }
        if (file_put_contents($path, $token . "\n") === false) {
            throw new RuntimeException('Failed to write medic8 token file');
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
                throw new RuntimeException('Failed to store medic8 media signing key');
            }
        }
        return $key;
    }

    public static function signDocumentAccess(int $documentId, int $exp): string
    {
        return hash_hmac('sha256', 'medic8-doc|' . $documentId . '|' . $exp, self::signingKey());
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
        return '/api/medic8_media.php?document_id=' . $documentId . '&exp=' . $exp . '&sig=' . rawurlencode($sig);
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

    public static function audit(
        ?int $actorUserId,
        string $action,
        ?string $tableName,
        ?int $recordId,
        ?int $personId,
        $before,
        $after,
        ?string $actorLabel = null
    ): void {
        self::ensureSchema();
        Database::execute(
            'INSERT INTO medic8_audit_log (actor_user_id, actor_label, action, table_name, record_id, person_id, before_json, after_json, ip, ua)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $actorUserId,
                $actorLabel,
                $action,
                $tableName,
                $recordId,
                $personId,
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

    public static function personRow(int $personId): ?array
    {
        self::ensureSchema();
        $row = Database::queryOne(
            'SELECT * FROM medic8_people WHERE id = ?' . self::liveSql('medic8_people'),
            [$personId]
        );
        return $row ?: null;
    }

    public static function userCanAccessPerson(int $uid, int $personId, string $category = 'all', bool $needEdit = false): bool
    {
        $person = self::personRow($personId);
        if (!$person) {
            return false;
        }
        if (self::isSiteAdmin($uid)) {
            return true;
        }
        if ((int)($person['owner_user_id'] ?? 0) === $uid) {
            return true;
        }
        if ((int)($person['catn8_user_id'] ?? 0) === $uid) {
            return true;
        }

        $shares = Database::queryAll(
            'SELECT category, role, include_high_sensitivity, expires_at, revoked_at
             FROM medic8_shares
             WHERE owner_person_id = ? AND grantee_user_id = ?',
            [$personId, $uid]
        );
        foreach ($shares as $share) {
            if (!empty($share['revoked_at'])) {
                continue;
            }
            if (!empty($share['expires_at']) && strtotime((string)$share['expires_at']) < time()) {
                continue;
            }
            $shareCat = (string)($share['category'] ?? '');
            if ($shareCat !== 'all' && $shareCat !== $category) {
                continue;
            }
            $role = (string)($share['role'] ?? 'viewer');
            if ($needEdit && $role !== 'editor') {
                continue;
            }
            return true;
        }
        return false;
    }

    public static function listAccessiblePeople(int $uid): array
    {
        self::ensureSchema();
        $livePeople = self::liveSql('medic8_people', 'p');
        if (self::isSiteAdmin($uid)) {
            return Database::queryAll(
                'SELECT * FROM medic8_people p WHERE 1=1' . $livePeople . ' ORDER BY display_name ASC'
            );
        }
        return Database::queryAll(
            'SELECT DISTINCT p.*
             FROM medic8_people p
             LEFT JOIN medic8_shares s
               ON s.owner_person_id = p.id
              AND s.grantee_user_id = ?
              AND s.revoked_at IS NULL
              AND (s.expires_at IS NULL OR s.expires_at > NOW())
             WHERE (p.owner_user_id = ?
                OR p.catn8_user_id = ?
                OR s.id IS NOT NULL)' . $livePeople . '
             ORDER BY p.display_name ASC',
            [$uid, $uid, $uid]
        );
    }

    public static function ensureAdminPerson(int $adminUid, string $displayName = 'Jon Graves'): array
    {
        self::ensureSchema();
        $existing = Database::queryOne(
            'SELECT * FROM medic8_people WHERE owner_user_id = ? AND relation_to_admin = ? LIMIT 1',
            [$adminUid, 'self']
        );
        if ($existing) {
            return $existing;
        }
        Database::execute(
            'INSERT INTO medic8_people (catn8_user_id, owner_user_id, display_name, relation_to_admin, sensitivity_default, is_opted_in)
             VALUES (?, ?, ?, ?, ?, 1)',
            [$adminUid, $adminUid, $displayName, 'self', 'normal']
        );
        $id = (int)Database::lastInsertId();
        $row = self::personRow($id);
        self::audit($adminUid, 'create', 'medic8_people', $id, $id, null, ['display_name' => $displayName], null);
        return $row ?: ['id' => $id, 'display_name' => $displayName];
    }

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
            'SELECT id FROM medic8_sources WHERE fingerprint = ? LIMIT 1',
            [$fingerprint]
        );
        if ($existing) {
            $id = (int)$existing['id'];
            if ($dryRun) {
                return $id;
            }
            Database::execute(
                'UPDATE medic8_sources
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
            'INSERT INTO medic8_sources (source_type, account, thread_id, message_id, message_date, file_path, record_type, record_id, note, fingerprint)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$sourceType, $account, $threadId, $messageId, $messageDate, $filePath, $recordType, $recordId, $note, $fingerprint]
        );
        return (int)Database::lastInsertId();
    }

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
            $src = Database::queryOne('SELECT * FROM medic8_sources WHERE id = ?', [(int)$out['source_ref_id']]);
            $out['source'] = $src ?: null;
        }
        return $out;
    }

    public static function listEntity(string $entity, int $uid, ?int $personId = null, int $limit = 200): array
    {
        return self::listEntityPage($entity, $uid, $personId, $limit, 0)['records'];
    }

    public static function listEntityPage(string $entity, int $uid, ?int $personId = null, int $limit = 200, int $offset = 0): array
    {
        self::ensureSchema();
        if (!isset(self::ENTITY_TABLES[$entity])) {
            throw new InvalidArgumentException('Unknown entity');
        }
        $table = self::ENTITY_TABLES[$entity];
        $limit = max(1, min(1000, $limit));
        $offset = max(0, $offset);
        $category = self::CATEGORY_FOR_ENTITY[$entity] ?? 'all';
        $limitSql = (int)$limit;
        $offsetSql = (int)$offset;

        $standardPersonTable = !in_array($entity, ['people', 'sources', 'shares', 'med_fills', 'providers'], true);
        if ($standardPersonTable && $personId !== null) {
            if ($uid > 0 && !self::userCanAccessPerson($uid, $personId, $category, false)) {
                throw new RuntimeException('Not authorized');
            }
            $live = self::liveSql($table);
            $countRow = Database::queryOne("SELECT COUNT(*) AS c FROM {$table} WHERE person_id = ?" . $live, [$personId]);
            $total = (int)($countRow['c'] ?? 0);
            $found = Database::queryAll(
                "SELECT * FROM {$table} WHERE person_id = ?" . $live . " ORDER BY id DESC LIMIT {$limitSql} OFFSET {$offsetSql}",
                [$personId]
            );
            $out = [];
            foreach ($found as $row) {
                if ($uid > 0 && self::rowBlockedBySensitivity($uid, $personId, $row)) {
                    continue;
                }
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

        $rows = [];
        if ($entity === 'people') {
            $rows = self::listAccessiblePeople($uid);
        } elseif ($entity === 'sources' || $entity === 'shares') {
            if ($uid > 0 && !self::isSiteAdmin($uid)) {
                throw new RuntimeException('Not authorized');
            }
            $live = self::liveSql($table);
            $countRow = Database::queryOne("SELECT COUNT(*) AS c FROM {$table} WHERE 1=1" . $live);
            $total = (int)($countRow['c'] ?? 0);
            $found = Database::queryAll("SELECT * FROM {$table} WHERE 1=1" . $live . " ORDER BY id DESC LIMIT {$limitSql} OFFSET {$offsetSql}");
            $out = array_map(static fn(array $r) => self::publicizeRow($entity, $r), $found);
            return [
                'records' => $out,
                'total' => $total,
                'limit' => $limit,
                'offset' => $offset,
                'next' => ($offset + $limit) < $total ? ($offset + $limit) : null,
            ];
        } elseif ($entity === 'med_fills') {
            $all = Database::queryAll(
                'SELECT f.*
                 FROM medic8_med_fills f
                 INNER JOIN medic8_medications m ON m.id = f.medication_id
                 WHERE (? IS NULL OR m.person_id = ?)'
                . self::liveSql('medic8_med_fills', 'f')
                . self::liveSql('medic8_medications', 'm') . '
                 ORDER BY f.fill_date DESC, f.id DESC',
                [$personId, $personId]
            );
            foreach ($all as $row) {
                $pid = self::personIdForRow($entity, $row);
                if ($uid > 0 && $pid !== null && $pid > 0 && !self::userCanAccessPerson($uid, $pid, 'meds', false)) {
                    continue;
                }
                $rows[] = $row;
            }
        } elseif ($entity === 'providers') {
            $all = Database::queryAll(
                "SELECT * FROM {$table}
                 WHERE (? IS NULL OR person_id IS NULL OR person_id = ?)"
                . self::liveSql($table) . '
                 ORDER BY name ASC',
                [$personId, $personId]
            );
            foreach ($all as $row) {
                $pid = $row['person_id'] !== null ? (int)$row['person_id'] : null;
                if ($uid > 0 && $pid !== null && !self::userCanAccessPerson($uid, $pid, 'providers', false)) {
                    continue;
                }
                $rows[] = $row;
            }
        } else {
            foreach (self::listAccessiblePeople($uid) as $person) {
                $pid = (int)$person['id'];
                if ($uid > 0 && !self::userCanAccessPerson($uid, $pid, $category, false)) {
                    continue;
                }
                $found = Database::queryAll(
                    "SELECT * FROM {$table} WHERE person_id = ?" . self::liveSql($table) . ' ORDER BY id DESC',
                    [$pid]
                );
                foreach ($found as $row) {
                    if ($uid > 0 && self::rowBlockedBySensitivity($uid, $pid, $row)) {
                        continue;
                    }
                    $rows[] = $row;
                }
            }
        }

        $total = count($rows);
        $slice = array_slice($rows, $offset, $limit);
        $out = [];
        foreach ($slice as $row) {
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

    public static function countEntity(string $entity, int $uid, ?int $personId = null): int
    {
        if ($personId !== null && isset(self::ENTITY_TABLES[$entity])
            && !in_array($entity, ['people', 'sources', 'shares', 'med_fills'], true)) {
            if ($uid > 0 && !self::userCanAccessPerson($uid, $personId, self::CATEGORY_FOR_ENTITY[$entity] ?? 'all', false)) {
                throw new RuntimeException('Not authorized');
            }
            $table = self::ENTITY_TABLES[$entity];
            $row = Database::queryOne(
                "SELECT COUNT(*) AS c FROM {$table} WHERE person_id = ?" . self::liveSql($table),
                [$personId]
            );
            return (int)($row['c'] ?? 0);
        }
        return self::listEntityPage($entity, $uid, $personId, 1, 0)['total'];
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
        $personId = self::personIdForRow($entity, $row);
        $category = self::CATEGORY_FOR_ENTITY[$entity] ?? 'all';
        if ($personId !== null && !self::userCanAccessPerson($uid, $personId, $category, false)) {
            throw new RuntimeException('Not authorized');
        }
        if ($personId !== null && self::rowBlockedBySensitivity($uid, $personId, $row)) {
            throw new RuntimeException('Not authorized');
        }
        if ($revealSensitive) {
            if (!self::isSiteAdmin($uid)) {
                throw new RuntimeException('Not authorized');
            }
            self::audit($uid, 'reveal_sensitive', $table, $id, $personId, null, ['fields' => self::SENSITIVE_FIELDS]);
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
        $personId = self::personIdForRow($entity, $row);
        $category = self::CATEGORY_FOR_ENTITY[$entity] ?? 'all';
        if ($uid > 0 && $personId !== null && !self::userCanAccessPerson($uid, $personId, $category, true) && !self::isSiteAdmin($uid)) {
            throw new RuntimeException('Not authorized');
        }

        $before = self::publicizeRow($entity, $row);
        $retiredFile = null;
        if ($entity === 'documents') {
            $retiredFile = self::retireDocumentFile($row);
            if ($hard) {
                Database::execute('DELETE FROM medic8_record_documents WHERE document_id = ?', [$recordId]);
            }
        }
        if ($hard && $entity !== 'documents') {
            Database::execute('DELETE FROM medic8_record_documents WHERE entity = ? AND record_id = ?', [$entity, $recordId]);
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
            $personId,
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
        if ($externalId !== null && self::hasColumn($table, 'external_source_id')) {
            $existing = Database::queryOne(
                "SELECT * FROM {$table} WHERE external_source_id = ?" . $live . ' ORDER BY id DESC',
                [$externalId]
            );
        } elseif (!empty($input['id'])) {
            $existing = Database::queryOne("SELECT * FROM {$table} WHERE id = ?" . $live, [(int)$input['id']]);
        }

        $normalized = self::normalizeEntityInput($entity, $input, $existing, $dryRun);
        $personId = self::personIdForRow($entity, $normalized + ($existing ?: []));
        $category = self::CATEGORY_FOR_ENTITY[$entity] ?? 'all';
        if ($personId !== null && !self::userCanAccessPerson($uid, $personId, $category, true) && !self::isSiteAdmin($uid) && $actorLabel === null) {
            // Agent path uses actorLabel and bypasses share checks after token auth; browser path requires access.
            throw new RuntimeException('Not authorized');
        }
        // For agent imports, require person_id to exist.
        if ($actorLabel !== null && $personId !== null && !self::personRow($personId)) {
            throw new InvalidArgumentException('person_id not found');
        }

        if ($dryRun) {
            $preview = [
                'id' => $existing ? (int)$existing['id'] : null,
                'created' => $existing === null,
                'updated' => $existing !== null,
                'dry_run' => true,
                'preview' => self::publicizeRow($entity, array_merge($existing ?: [], $normalized)),
            ];
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
            self::audit($uid, 'update', $table, $id, $personId, self::publicizeRow($entity, $existing), self::publicizeRow($entity, $after ?: []), $actorLabel);
            if ($entity === 'med_fills') {
                self::recomputeNextRefillDue((int)($after['medication_id'] ?? 0));
            }
            if ($entity === 'medications') {
                self::recomputeNextRefillDue($id);
            }
            if ($entity === 'procedures' && !empty($after['document_id'])) {
                self::linkDocument((int)$after['document_id'], 'procedures', $id, 'primary', null, $uid, $actorLabel);
            }
            $record = self::publicizeRow($entity, $after ?: []);
            $attached = self::attachDocumentsToRecords($entity, [$record]);
            return ['id' => $id, 'created' => false, 'updated' => true, 'dry_run' => false, 'record' => $attached[0]];
        }

        $cols = array_keys($normalized);
        $placeholders = implode(', ', array_fill(0, count($cols), '?'));
        $colSql = implode(', ', array_map(static fn($c) => '`' . $c . '`', $cols));
        Database::execute('INSERT INTO ' . $table . ' (' . $colSql . ') VALUES (' . $placeholders . ')', array_values($normalized));
        $id = (int)Database::lastInsertId();
        $after = Database::queryOne("SELECT * FROM {$table} WHERE id = ?", [$id]);
        self::audit($uid, 'create', $table, $id, $personId, null, self::publicizeRow($entity, $after ?: []), $actorLabel);
        if ($entity === 'med_fills') {
            self::recomputeNextRefillDue((int)($after['medication_id'] ?? 0));
        }
        if ($entity === 'medications') {
            self::recomputeNextRefillDue($id);
        }
        if ($entity === 'procedures' && !empty($after['document_id'])) {
            self::linkDocument((int)$after['document_id'], 'procedures', $id, 'primary', null, $uid, $actorLabel);
        }
        $record = self::publicizeRow($entity, $after ?: []);
        $attached = self::attachDocumentsToRecords($entity, [$record]);
        return ['id' => $id, 'created' => true, 'updated' => false, 'dry_run' => false, 'record' => $attached[0]];
    }

    public static function recomputeNextRefillDue(int $medicationId): void
    {
        if ($medicationId <= 0) {
            return;
        }
        $med = Database::queryOne('SELECT * FROM medic8_medications WHERE id = ?', [$medicationId]);
        if (!$med) {
            return;
        }
        $lastFill = $med['last_fill_date'] ?? null;
        $days = $med['days_supply'] !== null ? (int)$med['days_supply'] : null;
        $fill = Database::queryOne(
            'SELECT fill_date, days_supply FROM medic8_med_fills WHERE medication_id = ? ORDER BY fill_date DESC, id DESC LIMIT 1',
            [$medicationId]
        );
        if ($fill) {
            $lastFill = $fill['fill_date'];
            if ($fill['days_supply'] !== null) {
                $days = (int)$fill['days_supply'];
            }
        }
        $next = null;
        if ($lastFill && $days && $days > 0) {
            $next = date('Y-m-d', strtotime((string)$lastFill . ' +' . $days . ' days'));
        }
        Database::execute(
            'UPDATE medic8_medications SET last_fill_date = COALESCE(?, last_fill_date), days_supply = COALESCE(?, days_supply), next_refill_due = ? WHERE id = ?',
            [$lastFill, $days, $next, $medicationId]
        );
    }

    public static function dashboard(int $uid, int $personId): array
    {
        if (!self::userCanAccessPerson($uid, $personId, 'all', false)) {
            throw new RuntimeException('Not authorized');
        }
        $person = self::personRow($personId);
        $meds = self::listEntity('medications', $uid, $personId, 200);
        $currentMeds = array_values(array_filter($meds, static fn($m) => ($m['status'] ?? '') === 'current'));
        $refillSoon = array_values(array_filter($currentMeds, static function ($m) {
            $due = $m['next_refill_due'] ?? null;
            if (!$due) {
                return false;
            }
            $ts = strtotime((string)$due);
            return $ts !== false && $ts <= strtotime('+14 days');
        }));
        return [
            'person' => $person,
            'medications_current' => $currentMeds,
            'refills_due_14d' => $refillSoon,
            'conditions' => self::listEntity('conditions', $uid, $personId, 100),
            'allergies' => self::listEntity('allergies', $uid, $personId, 100),
            'appointments_upcoming' => array_values(array_filter(
                self::listEntity('appointments', $uid, $personId, 100),
                static fn($a) => strtotime((string)($a['starts_at'] ?? '')) >= strtotime('-1 day')
            )),
            'providers' => self::listEntity('providers', $uid, $personId, 100),
            'labs_recent' => self::listEntity('labs', $uid, $personId, 50),
            'labs_total' => self::countEntity('labs', $uid, $personId),
            'lab_trends' => self::labTrends($uid, $personId),
            'procedures' => self::listEntity('procedures', $uid, $personId, 50),
            'procedures_total' => self::countEntity('procedures', $uid, $personId),
            'encounters' => self::listEntity('encounters', $uid, $personId, 50),
            'encounters_total' => self::countEntity('encounters', $uid, $personId),
            'insurance' => self::listEntity('insurance', $uid, $personId, 20),
            'disability_events' => self::listEntity('disability_events', $uid, $personId, 100),
            'documents' => self::listEntity('documents', $uid, $personId, 50),
            'documents_total' => self::countEntity('documents', $uid, $personId),
            'portal_messages' => self::listEntity('portal_messages', $uid, $personId, 30),
            'portal_messages_total' => self::countEntity('portal_messages', $uid, $personId),
            'invoices' => self::listEntity('invoices', $uid, $personId, 30),
            'invoices_total' => self::countEntity('invoices', $uid, $personId),
        ];
    }

    public static function labTrends(int $uid, int $personId): array
    {
        $labs = self::listEntity('labs', $uid, $personId, 200);
        $byTest = [];
        foreach ($labs as $lab) {
            $test = (string)($lab['test'] ?? '');
            if ($test === '') {
                continue;
            }
            $byTest[$test][] = [
                'taken_at' => $lab['taken_at'] ?? null,
                'value' => $lab['value'] ?? null,
                'unit' => $lab['unit'] ?? null,
                'flag' => $lab['flag'] ?? null,
            ];
        }
        foreach ($byTest as &$points) {
            usort($points, static function ($a, $b) {
                return strcmp((string)($a['taken_at'] ?? ''), (string)($b['taken_at'] ?? ''));
            });
        }
        return $byTest;
    }

    public static function emergencySummary(int $uid, int $personId): array
    {
        $dash = self::dashboard($uid, $personId);
        return [
            'person' => $dash['person'],
            'allergies' => $dash['allergies'],
            'conditions' => $dash['conditions'],
            'medications_current' => $dash['medications_current'],
            'providers' => $dash['providers'],
            'insurance' => $dash['insurance'],
            'generated_at' => gmdate('c'),
        ];
    }

    public static function storeUploadedDocument(array $file, array $meta, int $uid, ?string $actorLabel = null): array
    {
        self::ensureSchema();
        $personId = (int)($meta['person_id'] ?? 0);
        if ($personId <= 0) {
            throw new InvalidArgumentException('person_id required');
        }
        if ($actorLabel === null && $uid > 0 && !self::userCanAccessPerson($uid, $personId, 'documents', true) && !self::isSiteAdmin($uid)) {
            throw new RuntimeException('Not authorized');
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
                'SELECT * FROM medic8_documents WHERE external_source_id = ?' . self::liveSql('medic8_documents') . ' ORDER BY id DESC',
                [$externalId]
            )
            : null;

        $rel = $existing['file_path'] ?? null;
        $fileReplaced = false;
        if ($existing && hash_equals((string)($existing['sha256'] ?? ''), $sha)) {
            @unlink($file['tmp_name']);
        } else {
            $relDir = 'p' . $personId . '/' . date('Y/m');
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
            'person_id' => $personId,
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

    public static function importBatch(string $entity, array $rows, int $uid, bool $dryRun = false, ?string $actorLabel = 'agent:medic8'): array
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

    private static function rowBlockedBySensitivity(int $uid, int $personId, array $row): bool
    {
        $sensitivity = strtolower((string)($row['sensitivity'] ?? 'normal'));
        if ($sensitivity !== 'high') {
            return false;
        }
        if (self::isSiteAdmin($uid)) {
            return false;
        }
        $person = self::personRow($personId);
        if ($person && ((int)$person['owner_user_id'] === $uid || (int)($person['catn8_user_id'] ?? 0) === $uid)) {
            return false;
        }
        $share = Database::queryOne(
            'SELECT id FROM medic8_shares
             WHERE owner_person_id = ? AND grantee_user_id = ?
               AND revoked_at IS NULL
               AND (expires_at IS NULL OR expires_at > NOW())
               AND include_high_sensitivity = 1
             LIMIT 1',
            [$personId, $uid]
        );
        return !$share;
    }

    private static function personIdForRow(string $entity, array $row): ?int
    {
        if ($entity === 'people') {
            return isset($row['id']) ? (int)$row['id'] : null;
        }
        if ($entity === 'med_fills') {
            $medId = (int)($row['medication_id'] ?? 0);
            if ($medId <= 0) {
                return null;
            }
            $med = Database::queryOne('SELECT person_id FROM medic8_medications WHERE id = ?', [$medId]);
            return $med ? (int)$med['person_id'] : null;
        }
        if ($entity === 'providers' && ($row['person_id'] ?? null) === null) {
            return null;
        }
        if (array_key_exists('person_id', $row) && $row['person_id'] !== null && $row['person_id'] !== '') {
            return (int)$row['person_id'];
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
        if ($entity === 'people' && !isset($out['owner_user_id']) && !$existing) {
            throw new InvalidArgumentException('owner_user_id required');
        }
        return $out;
    }

    private static function entityFieldMap(string $entity): array
    {
        return match ($entity) {
            'people' => [
                'catn8_user_id' => ['type' => 'int'],
                'owner_user_id' => ['type' => 'int', 'required_on_create' => true],
                'display_name' => ['len' => 191, 'required_on_create' => true],
                'relation_to_admin' => ['len' => 96],
                'dob' => ['type' => 'date'],
                'sensitivity_default' => ['len' => 16],
                'is_opted_in' => ['type' => 'bool'],
                'external_source_id' => ['len' => 191],
            ],
            'providers' => [
                'person_id' => ['type' => 'int'],
                'name' => ['len' => 191, 'required_on_create' => true],
                'specialty' => ['len' => 191],
                'practice' => ['len' => 191],
                'phone' => ['len' => 64],
                'fax' => ['len' => 64],
                'email' => ['len' => 191],
                'address' => ['len' => 65535],
                'portal_name' => ['len' => 191],
                'portal_url' => ['len' => 512],
                'active' => ['type' => 'bool'],
                'external_source_id' => ['len' => 191],
            ],
            'medications' => [
                'person_id' => ['type' => 'int', 'required_on_create' => true],
                'name' => ['len' => 191, 'required_on_create' => true],
                'generic_name' => ['len' => 191],
                'strength' => ['len' => 96],
                'dose_per_admin' => ['len' => 96],
                'frequency' => ['len' => 191],
                'schedule_json' => ['type' => 'json'],
                'route' => ['len' => 64],
                'prn' => ['type' => 'bool'],
                'indication' => ['len' => 255],
                'status' => ['len' => 32],
                'sensitivity' => ['len' => 16],
                'prescriber_provider_id' => ['type' => 'int'],
                'pharmacy_provider_id' => ['type' => 'int'],
                'rx_number_enc' => ['encrypt' => true, 'from' => 'rx_number'],
                'start_date' => ['type' => 'date'],
                'stop_date' => ['type' => 'date'],
                'last_fill_date' => ['type' => 'date'],
                'days_supply' => ['type' => 'int'],
                'qty' => ['type' => 'decimal'],
                'refills_left' => ['type' => 'int'],
                'next_refill_due' => ['type' => 'date'],
                'auto_refill' => ['type' => 'bool'],
                'notes' => ['len' => 65535],
                'confidence' => ['type' => 'decimal'],
                'external_source_id' => ['len' => 191],
            ],
            'med_fills' => [
                'medication_id' => ['type' => 'int', 'required_on_create' => true],
                'fill_date' => ['type' => 'date', 'required_on_create' => true],
                'qty' => ['type' => 'decimal'],
                'days_supply' => ['type' => 'int'],
                'pharmacy_id' => ['type' => 'int'],
                'cost' => ['type' => 'decimal'],
                'external_source_id' => ['len' => 191],
            ],
            'appointments' => [
                'person_id' => ['type' => 'int', 'required_on_create' => true],
                'starts_at' => ['type' => 'datetime', 'required_on_create' => true],
                'provider_id' => ['type' => 'int'],
                'location' => ['len' => 255],
                'purpose' => ['len' => 255],
                'status' => ['len' => 32],
                'telehealth_url' => ['len' => 512],
                'notes' => ['len' => 65535],
                'external_source_id' => ['len' => 191],
            ],
            'conditions' => [
                'person_id' => ['type' => 'int', 'required_on_create' => true],
                'name' => ['len' => 191, 'required_on_create' => true],
                'status' => ['len' => 64],
                'onset_date' => ['type' => 'date'],
                'sensitivity' => ['len' => 16],
                'notes' => ['len' => 65535],
                'confidence' => ['type' => 'decimal'],
                'external_source_id' => ['len' => 191],
            ],
            'allergies' => [
                'person_id' => ['type' => 'int', 'required_on_create' => true],
                'allergen' => ['len' => 191, 'required_on_create' => true],
                'reaction' => ['len' => 255],
                'status' => ['len' => 64],
                'recorded_at' => ['type' => 'datetime'],
                'external_source_id' => ['len' => 191],
            ],
            'labs' => [
                'person_id' => ['type' => 'int', 'required_on_create' => true],
                'category' => ['len' => 32],
                'test' => ['len' => 191, 'required_on_create' => true],
                'taken_at' => ['type' => 'datetime'],
                'value' => ['len' => 96],
                'unit' => ['len' => 64],
                'ref_range' => ['len' => 96],
                'flag' => ['len' => 32],
                'external_source_id' => ['len' => 191],
            ],
            'procedures' => [
                'person_id' => ['type' => 'int', 'required_on_create' => true],
                'name' => ['len' => 191, 'required_on_create' => true],
                'performed_at' => ['type' => 'datetime'],
                'impression' => ['len' => 65535],
                'document_id' => ['type' => 'int'],
                'external_source_id' => ['len' => 191],
            ],
            'encounters' => [
                'person_id' => ['type' => 'int', 'required_on_create' => true],
                'occurred_at' => ['type' => 'datetime'],
                'provider_id' => ['type' => 'int'],
                'encounter_type' => ['len' => 96],
                'summary' => ['len' => 65535],
                'external_source_id' => ['len' => 191],
            ],
            'disability_events' => [
                'person_id' => ['type' => 'int', 'required_on_create' => true],
                'event_date' => ['type' => 'date'],
                'program' => ['len' => 32],
                'event_type' => ['len' => 96],
                'description' => ['len' => 65535],
                'case_number_enc' => ['encrypt' => true, 'from' => 'case_number'],
                'external_source_id' => ['len' => 191],
            ],
            'insurance' => [
                'person_id' => ['type' => 'int', 'required_on_create' => true],
                'plan_name' => ['len' => 191, 'required_on_create' => true],
                'carrier' => ['len' => 191],
                'plan_type' => ['len' => 96],
                'member_id_enc' => ['encrypt' => true, 'from' => 'member_id'],
                'group_no_enc' => ['encrypt' => true, 'from' => 'group_no'],
                'medicare_number_enc' => ['encrypt' => true, 'from' => 'medicare_number'],
                'ssn_enc' => ['encrypt' => true, 'from' => 'ssn'],
                'effective_from' => ['type' => 'date'],
                'effective_to' => ['type' => 'date'],
                'phone' => ['len' => 64],
                'notes' => ['len' => 65535],
                'external_source_id' => ['len' => 191],
            ],
            'documents' => [
                'person_id' => ['type' => 'int', 'required_on_create' => true],
                'title' => ['len' => 191, 'required_on_create' => true],
                'doc_type' => ['len' => 96],
                'file_path' => ['len' => 512, 'required_on_create' => true],
                'mime' => ['len' => 120],
                'sha256' => ['len' => 64],
                'size_bytes' => ['type' => 'int'],
                'uploaded_by' => ['type' => 'int'],
                'external_source_id' => ['len' => 191],
            ],
            'portal_messages' => [
                'person_id' => ['type' => 'int', 'required_on_create' => true],
                'sent_at' => ['type' => 'datetime'],
                'direction' => ['len' => 16],
                'provider_id' => ['type' => 'int'],
                'subject' => ['len' => 255],
                'summary' => ['len' => 65535],
                'external_source_id' => ['len' => 191],
            ],
            'invoices' => [
                'person_id' => ['type' => 'int', 'required_on_create' => true],
                'invoice_date' => ['type' => 'date', 'from' => 'date'],
                'provider_id' => ['type' => 'int'],
                'items_json' => ['type' => 'json'],
                'amount' => ['type' => 'decimal'],
                'status' => ['len' => 64],
                'external_source_id' => ['len' => 191],
            ],
            'shares' => [
                'owner_person_id' => ['type' => 'int', 'required_on_create' => true],
                'grantee_user_id' => ['type' => 'int', 'required_on_create' => true],
                'category' => ['len' => 32],
                'role' => ['len' => 16],
                'include_high_sensitivity' => ['type' => 'bool'],
                'granted_by' => ['type' => 'int'],
                'expires_at' => ['type' => 'datetime'],
                'revoked_at' => ['type' => 'datetime'],
            ],
            default => throw new InvalidArgumentException('Unsupported entity'),
        };
    }

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

    public static function attachDocumentsToRecords(string $entity, array $records): array
    {
        if ($entity === 'documents' || $entity === 'sources' || $entity === 'shares' || $entity === 'people') {
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
            "SELECT * FROM medic8_record_documents WHERE entity = ? AND record_id IN ({$placeholders})",
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
        foreach ($records as $record) {
            if ($entity === 'procedures' && !empty($record['document_id'])) {
                $did = (int)$record['document_id'];
                $docIds[$did] = $did;
            }
        }
        $docs = [];
        if ($docIds !== []) {
            $dph = implode(',', array_fill(0, count($docIds), '?'));
            $docRows = Database::queryAll(
                'SELECT * FROM medic8_documents WHERE id IN (' . $dph . ')' . self::liveSql('medic8_documents'),
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
            if ($entity === 'procedures' && !empty($record['document_id'])) {
                $did = (int)$record['document_id'];
                if (isset($docs[$did]) && !isset($attached[$did])) {
                    $item = $docs[$did];
                    $item['link_role'] = 'primary';
                    $attached[$did] = $item;
                }
            }
            $record['documents'] = array_values($attached);
        }
        unset($record);
        return $records;
    }

    public static function listDocumentRecordLinks(int $documentId): array
    {
        return Database::queryAll(
            'SELECT * FROM medic8_record_documents WHERE document_id = ? ORDER BY id ASC',
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

    public static function linkFromSpec(int $documentId, array $spec, int $uid, ?string $actorLabel = null): array
    {
        $entity = trim((string)($spec['entity'] ?? ''));
        if ($entity === '' || !isset(self::ENTITY_TABLES[$entity])) {
            throw new InvalidArgumentException('link entity required');
        }
        $recordId = self::resolveRecordId($entity, $spec['record_id'] ?? null, $spec['external_source_id'] ?? $spec['source_id'] ?? null);
        $role = self::nullableClip($spec['role'] ?? null, 96);
        $note = self::nullableClip($spec['note'] ?? null, 255);
        return self::linkDocument($documentId, $entity, $recordId, $role, $note, $uid, $actorLabel);
    }

    public static function linkDocument(int $documentId, string $entity, int $recordId, ?string $role, ?string $note, int $uid, ?string $actorLabel = null): array
    {
        self::ensureSchema();
        if ($documentId <= 0 || $recordId <= 0 || !isset(self::ENTITY_TABLES[$entity])) {
            throw new InvalidArgumentException('document_id, entity, and record_id required');
        }
        $doc = Database::queryOne('SELECT * FROM medic8_documents WHERE id = ?', [$documentId]);
        if (!$doc) {
            throw new InvalidArgumentException('document not found');
        }
        $existing = Database::queryOne(
            'SELECT * FROM medic8_record_documents WHERE document_id = ? AND entity = ? AND record_id = ?',
            [$documentId, $entity, $recordId]
        );
        if ($existing) {
            Database::execute(
                'UPDATE medic8_record_documents SET role = COALESCE(?, role), note = COALESCE(?, note) WHERE id = ?',
                [$role, $note, (int)$existing['id']]
            );
            $link = Database::queryOne('SELECT * FROM medic8_record_documents WHERE id = ?', [(int)$existing['id']]);
            return ['created' => false, 'updated' => true, 'link' => $link];
        }
        Database::execute(
            'INSERT INTO medic8_record_documents (document_id, entity, record_id, role, note) VALUES (?, ?, ?, ?, ?)',
            [$documentId, $entity, $recordId, $role, $note]
        );
        $id = (int)Database::lastInsertId();
        $link = Database::queryOne('SELECT * FROM medic8_record_documents WHERE id = ?', [$id]);
        self::audit($uid > 0 ? $uid : null, 'link_document', 'medic8_record_documents', $id, (int)($doc['person_id'] ?? 0) ?: null, null, $link, $actorLabel);
        return ['created' => true, 'updated' => false, 'link' => $link];
    }

    public static function unlinkDocument(int $documentId, string $entity, int $recordId, int $uid, ?string $actorLabel = null): array
    {
        self::ensureSchema();
        $existing = Database::queryOne(
            'SELECT * FROM medic8_record_documents WHERE document_id = ? AND entity = ? AND record_id = ?',
            [$documentId, $entity, $recordId]
        );
        if (!$existing) {
            throw new InvalidArgumentException('link not found');
        }
        Database::execute('DELETE FROM medic8_record_documents WHERE id = ?', [(int)$existing['id']]);
        self::audit($uid > 0 ? $uid : null, 'unlink_document', 'medic8_record_documents', (int)$existing['id'], null, $existing, null, $actorLabel);
        return ['deleted' => true, 'link' => $existing];
    }

    public static function privilegedUserId(): int
    {
        $admin = Database::queryOne('SELECT id FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1');
        return (int)($admin['id'] ?? 0);
    }

    /**
     * Cleanup duplicate document rows (keep newest id per external_source_id)
     * and unreferenced files. Returns counts only — no filenames or PHI.
     */
    public static function cleanupDuplicateDocuments(int $uid, ?string $actorLabel = null): array
    {
        self::ensureSchema();
        $dupGroups = Database::queryAll(
            "SELECT external_source_id, COUNT(*) AS c
             FROM medic8_documents
             WHERE external_source_id IS NOT NULL AND external_source_id <> ''
             GROUP BY external_source_id
             HAVING c > 1"
        );
        $removedRows = 0;
        $retiredFiles = 0;
        $groups = count($dupGroups);
        foreach ($dupGroups as $group) {
            $ext = (string)$group['external_source_id'];
            $rows = Database::queryAll(
                'SELECT id, file_path FROM medic8_documents WHERE external_source_id = ? ORDER BY id DESC',
                [$ext]
            );
            $keepId = (int)($rows[0]['id'] ?? 0);
            foreach (array_slice($rows, 1) as $dup) {
                $dupId = (int)$dup['id'];
                $dupLinks = Database::queryAll('SELECT * FROM medic8_record_documents WHERE document_id = ?', [$dupId]);
                foreach ($dupLinks as $link) {
                    $exists = Database::queryOne(
                        'SELECT id FROM medic8_record_documents WHERE document_id = ? AND entity = ? AND record_id = ?',
                        [$keepId, $link['entity'], $link['record_id']]
                    );
                    if ($exists) {
                        Database::execute('DELETE FROM medic8_record_documents WHERE id = ?', [(int)$link['id']]);
                    } else {
                        Database::execute('UPDATE medic8_record_documents SET document_id = ? WHERE id = ?', [$keepId, (int)$link['id']]);
                    }
                }
                $retired = self::retireDocumentFile($dup);
                if ($retired !== null) {
                    $retiredFiles++;
                }
                Database::execute('DELETE FROM medic8_documents WHERE id = ?', [$dupId]);
                self::audit($uid > 0 ? $uid : null, 'cleanup_duplicate_document', 'medic8_documents', $dupId, null, ['kept_id' => $keepId], null, $actorLabel);
                $removedRows++;
            }
        }

        $referenced = Database::queryAll('SELECT file_path FROM medic8_documents');
        $keep = [];
        foreach ($referenced as $ref) {
            $rel = ltrim((string)($ref['file_path'] ?? ''), '/');
            if ($rel !== '') {
                $keep[$rel] = true;
            }
        }
        $orphanFiles = 0;
        $root = self::storageRoot();
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS)
        );
        foreach ($iterator as $fileInfo) {
            if (!$fileInfo->isFile()) {
                continue;
            }
            $full = $fileInfo->getPathname();
            $rel = ltrim(str_replace($root, '', $full), '/');
            if ($rel === '.htaccess' || str_starts_with($rel, 'retired/')) {
                continue;
            }
            if (!isset($keep[$rel])) {
                $retired = self::retireDocumentFile(['file_path' => $rel]);
                if ($retired !== null) {
                    $orphanFiles++;
                }
            }
        }

        self::ensureUniqueIndexes();
        return [
            'duplicate_groups' => $groups,
            'duplicate_rows_removed' => $removedRows,
            'duplicate_files_retired' => $retiredFiles,
            'orphan_files_retired' => $orphanFiles,
        ];
    }

    /**
     * Merge duplicate people. Groups by external_source_id, then catn8_user_id
     * (only when source ids do not conflict), then owner+display_name when both
     * lack a source id. Returns counts and kept/merged ids only — no PHI.
     */
    public static function cleanupDuplicatePeople(int $uid, ?string $actorLabel = null): array
    {
        self::ensureSchema();
        $people = Database::queryAll(
            'SELECT id, owner_user_id, catn8_user_id, display_name, external_source_id, relation_to_admin
             FROM medic8_people
             WHERE 1=1' . self::liveSql('medic8_people') . '
             ORDER BY id ASC'
        );
        $byId = [];
        foreach ($people as $person) {
            $byId[(int)$person['id']] = $person;
        }
        $groups = [];
        foreach ($people as $person) {
            $ext = trim((string)($person['external_source_id'] ?? ''));
            if ($ext !== '') {
                $groups['ext:' . $ext][] = (int)$person['id'];
            }
            $userId = (int)($person['catn8_user_id'] ?? 0);
            if ($userId > 0) {
                $groups['user:' . $userId][] = (int)$person['id'];
            }
            $nameKey = strtolower(trim((string)($person['display_name'] ?? '')));
            if ($nameKey !== '' && $ext === '' && $userId <= 0) {
                $groups['name:' . (int)$person['owner_user_id'] . ':' . hash('sha256', $nameKey)][] = (int)$person['id'];
            }
        }

        $mergedPairs = [];
        $mergedCount = 0;
        $seenKeep = [];
        foreach ($groups as $ids) {
            $ids = array_values(array_unique($ids));
            if (count($ids) < 2) {
                continue;
            }
            sort($ids);
            $keepId = $ids[0];
            $keepExt = trim((string)($byId[$keepId]['external_source_id'] ?? ''));
            foreach (array_slice($ids, 1) as $fromId) {
                $fromExt = trim((string)($byId[$fromId]['external_source_id'] ?? ''));
                if ($keepExt !== '' && $fromExt !== '' && $keepExt !== $fromExt) {
                    continue;
                }
                $pair = $fromId . '>' . $keepId;
                if (isset($seenKeep[$pair])) {
                    continue;
                }
                $seenKeep[$pair] = true;
                self::mergePersonRecords($fromId, $keepId, $uid, $actorLabel);
                $mergedPairs[] = ['from_id' => $fromId, 'kept_id' => $keepId];
                $mergedCount++;
            }
        }

        self::ensureUniqueIndexes();
        return [
            'people_before' => count($people),
            'people_after' => (int)(Database::queryOne('SELECT COUNT(*) AS c FROM medic8_people WHERE 1=1' . self::liveSql('medic8_people'))['c'] ?? 0),
            'merged' => $mergedCount,
            'merges' => $mergedPairs,
        ];
    }

    public static function mergePersonRecords(int $fromId, int $keepId, int $uid, ?string $actorLabel = null): void
    {
        if ($fromId <= 0 || $keepId <= 0 || $fromId === $keepId) {
            return;
        }
        $from = self::personRow($fromId);
        $keep = self::personRow($keepId);
        if (!$from || !$keep) {
            return;
        }
        $tables = [
            'medic8_medications', 'medic8_appointments', 'medic8_conditions', 'medic8_allergies',
            'medic8_labs', 'medic8_procedures', 'medic8_encounters', 'medic8_disability_events',
            'medic8_insurance', 'medic8_documents', 'medic8_portal_messages', 'medic8_invoices',
            'medic8_providers',
        ];
        foreach ($tables as $table) {
            Database::execute("UPDATE {$table} SET person_id = ? WHERE person_id = ?", [$keepId, $fromId]);
        }
        Database::execute('UPDATE medic8_shares SET owner_person_id = ? WHERE owner_person_id = ?', [$keepId, $fromId]);
        Database::execute('UPDATE medic8_invites SET person_id = ? WHERE person_id = ?', [$keepId, $fromId]);
        Database::execute('UPDATE medic8_audit_log SET person_id = ? WHERE person_id = ?', [$keepId, $fromId]);
        Database::execute('DELETE FROM medic8_people WHERE id = ?', [$fromId]);
        self::audit($uid > 0 ? $uid : null, 'merge_person', 'medic8_people', $fromId, $keepId, ['from_id' => $fromId], ['kept_id' => $keepId], $actorLabel);
    }

    public static function deleteSyntheticTestRows(int $uid, ?string $actorLabel = null): array
    {
        self::ensureSchema();
        $deleted = [];
        foreach (self::ENTITY_TABLES as $entity => $table) {
            if (!self::hasColumn($table, 'external_source_id')) {
                continue;
            }
            $rows = Database::queryAll(
                "SELECT id FROM {$table} WHERE external_source_id LIKE 'synthetic:%'"
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
        $named = Database::queryAll("SELECT id FROM medic8_conditions WHERE name = 'Synthetic Test Condition'");
        foreach ($named as $row) {
            try {
                $result = self::deleteEntityByKey('conditions', (int)$row['id'], null, $uid, $actorLabel, true);
                $deleted[] = ['entity' => 'conditions', 'id' => $result['id']];
            } catch (Throwable $e) {
                // already gone
            }
        }
        return ['deleted_count' => count($deleted), 'deleted' => $deleted];
    }
}

