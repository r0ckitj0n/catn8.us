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

        $people = Database::queryOne("SHOW TABLES LIKE 'medic8_people'");
        if (!$people) {
            throw new RuntimeException('Medic8 schema bootstrap failed (medic8_people missing)');
        }

        self::$schemaEnsured = true;
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
        $row = Database::queryOne('SELECT * FROM medic8_people WHERE id = ?', [$personId]);
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
        if (self::isSiteAdmin($uid)) {
            return Database::queryAll('SELECT * FROM medic8_people ORDER BY display_name ASC');
        }
        return Database::queryAll(
            'SELECT DISTINCT p.*
             FROM medic8_people p
             LEFT JOIN medic8_shares s
               ON s.owner_person_id = p.id
              AND s.grantee_user_id = ?
              AND s.revoked_at IS NULL
              AND (s.expires_at IS NULL OR s.expires_at > NOW())
             WHERE p.owner_user_id = ?
                OR p.catn8_user_id = ?
                OR s.id IS NOT NULL
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

    public static function upsertSource(array $input): int
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
            Database::execute(
                'UPDATE medic8_sources
                 SET message_date = COALESCE(?, message_date), file_path = COALESCE(?, file_path), note = COALESCE(?, note)
                 WHERE id = ?',
                [$messageDate, $filePath, $note, $id]
            );
            return $id;
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
        self::ensureSchema();
        if (!isset(self::ENTITY_TABLES[$entity])) {
            throw new InvalidArgumentException('Unknown entity');
        }
        $table = self::ENTITY_TABLES[$entity];
        $limit = max(1, min(500, $limit));
        $category = self::CATEGORY_FOR_ENTITY[$entity] ?? 'all';

        if ($entity === 'people') {
            return array_map(static fn(array $r) => self::publicizeRow('people', $r), self::listAccessiblePeople($uid));
        }
        if ($entity === 'sources') {
            if (!self::isSiteAdmin($uid)) {
                throw new RuntimeException('Not authorized');
            }
            return Database::queryAll("SELECT * FROM {$table} ORDER BY id DESC LIMIT {$limit}");
        }
        if ($entity === 'shares') {
            if (!self::isSiteAdmin($uid)) {
                throw new RuntimeException('Not authorized');
            }
            return Database::queryAll("SELECT * FROM {$table} ORDER BY id DESC LIMIT {$limit}");
        }
        if ($entity === 'med_fills') {
            $rows = Database::queryAll(
                "SELECT f.*
                 FROM medic8_med_fills f
                 INNER JOIN medic8_medications m ON m.id = f.medication_id
                 WHERE (? IS NULL OR m.person_id = ?)
                 ORDER BY f.fill_date DESC, f.id DESC
                 LIMIT {$limit}",
                [$personId, $personId]
            );
            $out = [];
            foreach ($rows as $row) {
                $med = Database::queryOne('SELECT person_id FROM medic8_medications WHERE id = ?', [(int)$row['medication_id']]);
                $pid = (int)($med['person_id'] ?? 0);
                if ($pid > 0 && self::userCanAccessPerson($uid, $pid, 'meds', false)) {
                    $out[] = self::publicizeRow($entity, $row);
                }
            }
            return $out;
        }
        if ($entity === 'providers') {
            $rows = Database::queryAll(
                "SELECT * FROM {$table}
                 WHERE (? IS NULL OR person_id IS NULL OR person_id = ?)
                 ORDER BY name ASC
                 LIMIT {$limit}",
                [$personId, $personId]
            );
            $out = [];
            foreach ($rows as $row) {
                $pid = $row['person_id'] !== null ? (int)$row['person_id'] : null;
                if ($pid === null || self::userCanAccessPerson($uid, $pid, 'providers', false)) {
                    $out[] = self::publicizeRow($entity, $row);
                }
            }
            return $out;
        }

        if ($personId === null) {
            $people = self::listAccessiblePeople($uid);
            $out = [];
            foreach ($people as $person) {
                $pid = (int)$person['id'];
                if (!self::userCanAccessPerson($uid, $pid, $category, false)) {
                    continue;
                }
                $rows = Database::queryAll(
                    "SELECT * FROM {$table} WHERE person_id = ? ORDER BY id DESC LIMIT {$limit}",
                    [$pid]
                );
                foreach ($rows as $row) {
                    if (self::rowBlockedBySensitivity($uid, $pid, $row)) {
                        continue;
                    }
                    $out[] = self::publicizeRow($entity, $row);
                }
            }
            return $out;
        }

        if (!self::userCanAccessPerson($uid, $personId, $category, false)) {
            throw new RuntimeException('Not authorized');
        }
        $rows = Database::queryAll(
            "SELECT * FROM {$table} WHERE person_id = ? ORDER BY id DESC LIMIT {$limit}",
            [$personId]
        );
        $out = [];
        foreach ($rows as $row) {
            if (self::rowBlockedBySensitivity($uid, $personId, $row)) {
                continue;
            }
            $out[] = self::publicizeRow($entity, $row);
        }
        return $out;
    }

    public static function getEntity(string $entity, int $id, int $uid, bool $revealSensitive = false): ?array
    {
        self::ensureSchema();
        if (!isset(self::ENTITY_TABLES[$entity])) {
            throw new InvalidArgumentException('Unknown entity');
        }
        $table = self::ENTITY_TABLES[$entity];
        $row = Database::queryOne("SELECT * FROM {$table} WHERE id = ?", [$id]);
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
        return self::publicizeRow($entity, $row, $revealSensitive);
    }

    public static function deleteEntity(string $entity, int $id, int $uid, ?string $actorLabel = null): void
    {
        self::ensureSchema();
        if (!isset(self::ENTITY_TABLES[$entity]) || $entity === 'sources') {
            throw new InvalidArgumentException('Unknown or protected entity');
        }
        $table = self::ENTITY_TABLES[$entity];
        $row = Database::queryOne("SELECT * FROM {$table} WHERE id = ?", [$id]);
        if (!$row) {
            throw new InvalidArgumentException('Not found');
        }
        $personId = self::personIdForRow($entity, $row);
        $category = self::CATEGORY_FOR_ENTITY[$entity] ?? 'all';
        if ($personId !== null && !self::userCanAccessPerson($uid, $personId, $category, true) && !self::isSiteAdmin($uid)) {
            throw new RuntimeException('Not authorized');
        }
        if ($entity === 'documents') {
            $full = self::resolveDocumentPath($row);
            if ($full !== null && is_file($full)) {
                @unlink($full);
            }
        }
        Database::execute("DELETE FROM {$table} WHERE id = ?", [$id]);
        self::audit($uid, 'delete', $table, $id, $personId, self::publicizeRow($entity, $row), null, $actorLabel);
    }

    public static function upsertEntity(string $entity, array $input, int $uid, bool $dryRun = false, ?string $actorLabel = null): array
    {
        self::ensureSchema();
        if (!isset(self::ENTITY_TABLES[$entity])) {
            throw new InvalidArgumentException('Unknown entity');
        }
        if ($entity === 'sources') {
            $sourceId = self::upsertSource($input);
            return ['id' => $sourceId, 'created' => false, 'updated' => true, 'dry_run' => $dryRun];
        }

        $externalId = self::nullableClip($input['external_source_id'] ?? $input['source_id'] ?? null, 191);
        $table = self::ENTITY_TABLES[$entity];
        $existing = null;
        if ($externalId !== null) {
            $existing = Database::queryOne("SELECT * FROM {$table} WHERE external_source_id = ?", [$externalId]);
        } elseif (!empty($input['id'])) {
            $existing = Database::queryOne("SELECT * FROM {$table} WHERE id = ?", [(int)$input['id']]);
        }

        $normalized = self::normalizeEntityInput($entity, $input, $existing);
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
            return [
                'id' => $existing ? (int)$existing['id'] : null,
                'created' => $existing === null,
                'updated' => $existing !== null,
                'dry_run' => true,
                'preview' => self::publicizeRow($entity, array_merge($existing ?: [], $normalized)),
            ];
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
            return ['id' => $id, 'created' => false, 'updated' => true, 'dry_run' => false, 'record' => self::publicizeRow($entity, $after ?: [])];
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
        return ['id' => $id, 'created' => true, 'updated' => false, 'dry_run' => false, 'record' => self::publicizeRow($entity, $after ?: [])];
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
            'lab_trends' => self::labTrends($uid, $personId),
            'procedures' => self::listEntity('procedures', $uid, $personId, 50),
            'encounters' => self::listEntity('encounters', $uid, $personId, 50),
            'insurance' => self::listEntity('insurance', $uid, $personId, 20),
            'disability_events' => self::listEntity('disability_events', $uid, $personId, 100),
            'documents' => self::listEntity('documents', $uid, $personId, 50),
            'portal_messages' => self::listEntity('portal_messages', $uid, $personId, 30),
            'invoices' => self::listEntity('invoices', $uid, $personId, 30),
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
        if ($actorLabel === null && !self::userCanAccessPerson($uid, $personId, 'documents', true) && !self::isSiteAdmin($uid)) {
            throw new RuntimeException('Not authorized');
        }
        if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            // allow non-HTTP upload path for agent/tests when rename/move used
            if (!isset($file['tmp_name']) || !is_file($file['tmp_name'])) {
                throw new InvalidArgumentException('upload file missing');
            }
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
            'external_source_id' => self::nullableClip($meta['external_source_id'] ?? $meta['source_id'] ?? null, 191),
        ];
        return self::upsertEntity('documents', $payload, $uid, false, $actorLabel);
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

    private static function normalizeEntityInput(string $entity, array $input, ?array $existing): array
    {
        $sourceRefId = null;
        if (!empty($input['source']) && is_array($input['source'])) {
            $sourceRefId = self::upsertSource($input['source']);
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
            ]);
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

        if ($sourceRefId !== null) {
            $out['source_ref_id'] = $sourceRefId;
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
}
