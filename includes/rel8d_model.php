<?php

declare(strict_types=1);

require_once __DIR__ . '/secret_store.php';
require_once __DIR__ . '/rel8d_gedcom.php';

final class Rel8dModel
{
    public const AGENT_TOKEN_SECRET_KEY = 'rel8d.agent.api_token_hash';
    public const MEDIA_SIGNING_SECRET_KEY = 'rel8d.media.signing_key';
    public const GROUP_SLUG = 'rel8d-users';
    public const DEFAULT_TREE_SLUG = 'graves';
    public const LIVING_YEARS = 100;

    public const ALLOWED_UPLOAD_MIME = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'application/pdf', 'text/plain', 'application/octet-stream',
    ];
    public const MAX_UPLOAD_BYTES = 15728640; // 15 MiB

    private static bool $schemaEnsured = false;

    public static function ensureSchema(): void
    {
        if (self::$schemaEnsured) {
            return;
        }

        catn8_groups_seed_core();
        catn8_group_ensure(self::GROUP_SLUG, 'Rel8d Users');

        $sqlFile = dirname(__DIR__) . '/scripts/db/migrations/2026_10_20_rel8d.sql';
        if (!is_file($sqlFile)) {
            throw new RuntimeException('Rel8d migration file missing');
        }
        $sql = (string)file_get_contents($sqlFile);
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
            if ($stmt === '') {
                continue;
            }
            Database::execute($stmt);
        }

        $people = Database::queryOne(
            "SELECT 1 AS ok FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rel8d_people' LIMIT 1"
        );
        if (!$people) {
            throw new RuntimeException('Rel8d schema bootstrap failed (rel8d_people missing)');
        }

        self::ensureDefaultTree();
        self::storageRoot();
        self::$schemaEnsured = true;
    }

    public static function ensureDefaultTree(): int
    {
        $row = Database::queryOne('SELECT id FROM rel8d_trees WHERE slug = ? LIMIT 1', [self::DEFAULT_TREE_SLUG]);
        if ($row) {
            return (int)$row['id'];
        }
        $owner = self::privilegedUserId();
        Database::execute(
            'INSERT INTO rel8d_trees (slug, title, description, owner_user_id) VALUES (?, ?, ?, ?)',
            [self::DEFAULT_TREE_SLUG, 'Graves Family Tree', 'Private Rel8d tree', max(1, $owner)]
        );
        return (int)Database::lastInsertId();
    }

    public static function defaultTreeId(): int
    {
        return self::ensureDefaultTree();
    }

    // ------------------------------------------------------------------
    // Storage / tokens
    // ------------------------------------------------------------------

    public static function storageRoot(): string
    {
        $root = dirname(__DIR__) . '/private/rel8d';
        self::ensureStorageDir($root, 'rel8d storage root');
        $ht = $root . '/.htaccess';
        if (!is_file($ht)) {
            if (@file_put_contents($ht, "Require all denied\n") === false) {
                throw new RuntimeException('Failed to write rel8d deny-all .htaccess at ' . $ht);
            }
            @chmod($ht, 0644);
        }
        foreach (['media', 'imports', 'geocode'] as $sub) {
            self::ensureStorageDir($root . '/' . $sub, $sub);
        }
        return $root;
    }

    private static function ensureStorageDir(string $path, string $label): void
    {
        if (is_dir($path)) {
            if (!is_writable($path)) {
                throw new RuntimeException('Rel8d ' . $label . ' is not writable: ' . $path);
            }
            return;
        }
        $ok = @mkdir($path, 0750, true);
        if (!$ok && !is_dir($path)) {
            $ok = @mkdir($path, 0700, true);
        }
        if (!$ok && !is_dir($path)) {
            throw new RuntimeException('Failed to create rel8d ' . $label . ': ' . $path);
        }
        @chmod($path, 0750);
    }

    public static function localTokenPath(): string
    {
        return (string)(getenv('HOME') ?: dirname(__DIR__)) . '/.local/state/catn8/rel8d/agent-api-token';
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
            throw new RuntimeException('Failed to store rel8d agent token hash');
        }
        return $token;
    }

    public static function writeLocalTokenFile(string $token): string
    {
        $path = self::localTokenPath();
        $dir = dirname($path);
        if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
            throw new RuntimeException('Failed to create rel8d token directory');
        }
        if (file_put_contents($path, $token . "\n") === false) {
            throw new RuntimeException('Failed to write rel8d token file');
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
                throw new RuntimeException('Failed to store rel8d media signing key');
            }
        }
        return $key;
    }

    public static function signDocumentAccess(int $mediaId, int $exp): string
    {
        return hash_hmac('sha256', 'rel8d-media|' . $mediaId . '|' . $exp, self::signingKey());
    }

    public static function verifyDocumentAccess(int $mediaId, int $exp, string $sig): bool
    {
        if ($mediaId <= 0 || $exp < time() || $sig === '') {
            return false;
        }
        return hash_equals(self::signDocumentAccess($mediaId, $exp), $sig);
    }

    public static function mediaSignedUrl(int $mediaId, int $ttlSeconds = 300): string
    {
        $exp = time() + max(30, min(3600, $ttlSeconds));
        $sig = self::signDocumentAccess($mediaId, $exp);
        return '/api/rel8d_media.php?media_id=' . $mediaId . '&exp=' . $exp . '&sig=' . rawurlencode($sig);
    }

    public static function resolveMediaPath(array $row): ?string
    {
        $stored = (string)($row['stored_path'] ?? '');
        if ($stored === '') {
            return null;
        }
        $full = self::storageRoot() . '/' . ltrim($stored, '/');
        $realRoot = realpath(self::storageRoot());
        $realFile = realpath($full);
        if ($realRoot === false || $realFile === false || !str_starts_with($realFile, $realRoot)) {
            return null;
        }
        return $realFile;
    }

    // ------------------------------------------------------------------
    // Access / audit
    // ------------------------------------------------------------------

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
            'INSERT INTO rel8d_audit_log (actor_user_id, actor_label, action, table_name, record_id, person_id, before_json, after_json, ip, ua)
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

    public static function privilegedUserId(): int
    {
        $admin = Database::queryOne('SELECT id FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1');
        return (int)($admin['id'] ?? 0);
    }

    public static function canViewLiving(int $uid): bool
    {
        return self::isSiteAdmin($uid);
    }

    public static function livingPrivacySql(string $alias, int $uid): string
    {
        if (self::canViewLiving($uid)) {
            return '';
        }
        // Living people (and explicit private) are admin-only.
        return ' AND ' . $alias . '.is_living = 0 AND ' . $alias . '.is_private = 0';
    }

    /** Non-admin: hide living (no death + born within 100y) and explicitly private. */
    public static function personVisibleTo(array $person, int $uid): bool
    {
        if (self::canViewLiving($uid)) {
            return true;
        }
        if ((int)($person['is_private'] ?? 0) === 1) {
            return false;
        }
        if ((int)($person['is_living'] ?? 0) === 1) {
            return false;
        }
        return true;
    }

    public static function computeLivingFlags(?string $birthSort, ?string $deathRaw, ?string $deathSort): array
    {
        $hasDeath = ($deathRaw !== null && trim($deathRaw) !== '') || ($deathSort !== null && $deathSort !== '');
        $isLiving = false;
        if (!$hasDeath && $birthSort) {
            $cutoff = (new DateTimeImmutable('today'))->modify('-' . self::LIVING_YEARS . ' years')->format('Y-m-d');
            if ($birthSort >= $cutoff) {
                $isLiving = true;
            }
        }
        return [
            'is_living' => $isLiving ? 1 : 0,
            'is_private' => $isLiving ? 1 : 0,
        ];
    }

    // ------------------------------------------------------------------
    // Escape helper for any GEDCOM text rendered to clients
    // ------------------------------------------------------------------

    public static function safeText(?string $value): string
    {
        return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    // ------------------------------------------------------------------
    // Bootstrap / dashboard
    // ------------------------------------------------------------------

    public static function bootstrap(int $uid): array
    {
        self::ensureSchema();
        $treeId = self::defaultTreeId();
        $tree = Database::queryOne('SELECT * FROM rel8d_trees WHERE id = ?', [$treeId]);
        $peopleTotal = (int)(Database::queryOne(
            'SELECT COUNT(*) AS c FROM rel8d_people WHERE tree_id = ? AND deleted_at IS NULL' . self::livingPrivacySql('rel8d_people', $uid),
            [$treeId]
        )['c'] ?? 0);
        $familiesTotal = (int)(Database::queryOne(
            'SELECT COUNT(*) AS c FROM rel8d_families WHERE tree_id = ? AND deleted_at IS NULL',
            [$treeId]
        )['c'] ?? 0);
        $sourcesTotal = (int)(Database::queryOne(
            'SELECT COUNT(*) AS c FROM rel8d_sources WHERE tree_id = ? AND deleted_at IS NULL',
            [$treeId]
        )['c'] ?? 0);
        $mediaTotal = (int)(Database::queryOne(
            'SELECT COUNT(*) AS c FROM rel8d_media WHERE tree_id = ? AND deleted_at IS NULL',
            [$treeId]
        )['c'] ?? 0);
        $flagsTotal = (int)(Database::queryOne(
            'SELECT COUNT(*) AS c FROM rel8d_quality_flags WHERE tree_id = ? AND resolved_at IS NULL',
            [$treeId]
        )['c'] ?? 0);

        return [
            'is_admin' => self::isSiteAdmin($uid) ? 1 : 0,
            'can_view_living' => self::canViewLiving($uid) ? 1 : 0,
            'tree' => $tree,
            'counts' => [
                'people' => $peopleTotal,
                'families' => $familiesTotal,
                'sources' => $sourcesTotal,
                'media' => $mediaTotal,
                'quality_flags' => $flagsTotal,
            ],
        ];
    }

    public static function dashboard(int $uid): array
    {
        $boot = self::bootstrap($uid);
        $treeId = (int)$boot['tree']['id'];
        $onThisDay = self::onThisDay($uid, (int)date('n'), (int)date('j'));
        $recentPeople = Database::queryAll(
            'SELECT id, name_display, birth_date_raw, death_date_raw, has_sources, is_living, is_private
             FROM rel8d_people
             WHERE tree_id = ? AND deleted_at IS NULL' . self::livingPrivacySql('rel8d_people', $uid) . '
             ORDER BY updated_at DESC LIMIT 12',
            [$treeId]
        );
        $surnameIndex = self::surnameIndex($uid, 30);
        return $boot + [
            'on_this_day' => $onThisDay,
            'recent_people' => $recentPeople,
            'surname_preview' => $surnameIndex,
        ];
    }

    // ------------------------------------------------------------------
    // People CRUD / search
    // ------------------------------------------------------------------

    public static function listPeople(int $uid, int $limit = 100, int $offset = 0, ?string $q = null, ?string $surname = null): array
    {
        self::ensureSchema();
        $treeId = self::defaultTreeId();
        $limit = max(1, min(1000, $limit));
        $offset = max(0, $offset);
        $where = 'tree_id = ? AND deleted_at IS NULL' . self::livingPrivacySql('rel8d_people', $uid);
        $params = [$treeId];
        if ($surname !== null && trim($surname) !== '') {
            $where .= ' AND name_surname = ?';
            $params[] = trim($surname);
        }
        if ($q !== null && trim($q) !== '') {
            $where .= ' AND (name_display LIKE ? OR name_given LIKE ? OR name_surname LIKE ? OR birth_place LIKE ? OR death_place LIKE ?)';
            $like = '%' . trim($q) . '%';
            array_push($params, $like, $like, $like, $like, $like);
        }
        $total = (int)(Database::queryOne('SELECT COUNT(*) AS c FROM rel8d_people WHERE ' . $where, $params)['c'] ?? 0);
        $rows = Database::queryAll(
            'SELECT id, gedcom_xref, name_display, name_given, name_surname, sex,
                    birth_date_raw, birth_date_sort, birth_place,
                    death_date_raw, death_date_sort, death_place,
                    is_living, is_private, has_sources
             FROM rel8d_people WHERE ' . $where . '
             ORDER BY name_surname ASC, name_given ASC, id ASC
             LIMIT ' . $limit . ' OFFSET ' . $offset,
            $params
        );
        return [
            'records' => $rows,
            'total' => $total,
            'limit' => $limit,
            'offset' => $offset,
            'next' => ($offset + $limit) < $total ? $offset + $limit : null,
        ];
    }

    public static function getPerson(int $uid, int $id): ?array
    {
        self::ensureSchema();
        $row = Database::queryOne('SELECT * FROM rel8d_people WHERE id = ? AND deleted_at IS NULL', [$id]);
        if (!$row || !self::personVisibleTo($row, $uid)) {
            return null;
        }
        $personId = (int)$row['id'];
        $names = Database::queryAll('SELECT * FROM rel8d_names WHERE person_id = ? ORDER BY is_primary DESC, sort_order ASC, id ASC', [$personId]);
        $events = Database::queryAll(
            'SELECT * FROM rel8d_events WHERE person_id = ? ORDER BY COALESCE(date_sort, \'9999-12-31\') ASC, sort_order ASC, id ASC',
            [$personId]
        );
        $attrs = Database::queryAll('SELECT * FROM rel8d_attributes WHERE person_id = ? ORDER BY sort_order ASC, id ASC', [$personId]);
        $citations = Database::queryAll(
            'SELECT c.*, s.title AS source_title, s.gedcom_xref AS source_xref
             FROM rel8d_citations c
             LEFT JOIN rel8d_sources s ON s.id = c.source_id
             WHERE c.person_id = ?
             ORDER BY c.id ASC',
            [$personId]
        );
        $notes = Database::queryAll(
            'SELECT id, title, body, is_story, created_at, updated_at FROM rel8d_notes
             WHERE person_id = ? AND deleted_at IS NULL ORDER BY is_story DESC, id DESC',
            [$personId]
        );
        $media = Database::queryAll(
            'SELECT id, title, file_name, mime, media_type, size_bytes, created_at FROM rel8d_media
             WHERE person_id = ? AND deleted_at IS NULL ORDER BY id DESC',
            [$personId]
        );
        foreach ($media as &$m) {
            $m['media_url'] = self::mediaSignedUrl((int)$m['id']);
        }
        unset($m);

        $childOf = Database::queryAll(
            'SELECT f.id AS family_id, f.gedcom_xref, f.husband_person_id, f.wife_person_id, fc.pedigree,
                    h.name_display AS husband_name, w.name_display AS wife_name
             FROM rel8d_family_children fc
             JOIN rel8d_families f ON f.id = fc.family_id AND f.deleted_at IS NULL
             LEFT JOIN rel8d_people h ON h.id = f.husband_person_id
             LEFT JOIN rel8d_people w ON w.id = f.wife_person_id
             WHERE fc.person_id = ?',
            [$personId]
        );
        $spouseFamilies = Database::queryAll(
            'SELECT f.*, 
                    (SELECT COUNT(*) FROM rel8d_family_children fc WHERE fc.family_id = f.id) AS child_count
             FROM rel8d_families f
             WHERE f.deleted_at IS NULL AND (f.husband_person_id = ? OR f.wife_person_id = ?)',
            [$personId, $personId]
        );

        // Strip raw_json for non-admin to keep payloads smaller; admin can request full.
        if (!self::isSiteAdmin($uid)) {
            unset($row['raw_json']);
            foreach ($events as &$e) {
                unset($e['raw_json']);
            }
            unset($e);
        }

        $row['names'] = $names;
        $row['events'] = $events;
        $row['attributes'] = $attrs;
        $row['citations'] = $citations;
        $row['notes'] = $notes;
        $row['media'] = $media;
        $row['child_of_families'] = $childOf;
        $row['spouse_families'] = $spouseFamilies;
        $row['sourced_badge'] = (int)($row['has_sources'] ?? 0) === 1 ? 'sourced' : 'unsourced';
        return $row;
    }

    public static function upsertPerson(array $record, int $actorUid, bool $dryRun = false, ?string $actorLabel = null): array
    {
        self::ensureSchema();
        $treeId = self::defaultTreeId();
        $id = (int)($record['id'] ?? 0);
        $ext = trim((string)($record['external_source_id'] ?? $record['gedcom_xref'] ?? ''));
        $existing = null;
        if ($id > 0) {
            $existing = Database::queryOne('SELECT * FROM rel8d_people WHERE id = ?', [$id]);
        } elseif ($ext !== '') {
            $existing = Database::queryOne(
                'SELECT * FROM rel8d_people WHERE tree_id = ? AND (external_source_id = ? OR gedcom_xref = ?) LIMIT 1',
                [$treeId, $ext, $ext]
            );
        }

        $nameDisplay = trim((string)($record['name_display'] ?? $record['name'] ?? ''));
        if ($nameDisplay === '' && $existing) {
            $nameDisplay = (string)$existing['name_display'];
        }
        if ($nameDisplay === '') {
            throw new InvalidArgumentException('name_display required');
        }

        $birthRaw = array_key_exists('birth_date_raw', $record) ? (string)$record['birth_date_raw'] : ($existing['birth_date_raw'] ?? null);
        $deathRaw = array_key_exists('death_date_raw', $record) ? (string)$record['death_date_raw'] : ($existing['death_date_raw'] ?? null);
        $birthSort = Rel8dGedcom::parseDateSort($birthRaw !== null ? (string)$birthRaw : null);
        $deathSort = Rel8dGedcom::parseDateSort($deathRaw !== null ? (string)$deathRaw : null);
        $flags = self::computeLivingFlags($birthSort, $deathRaw !== null ? (string)$deathRaw : null, $deathSort);

        $payload = [
            'tree_id' => $treeId,
            'gedcom_xref' => $record['gedcom_xref'] ?? ($existing['gedcom_xref'] ?? null),
            'name_display' => $nameDisplay,
            'name_given' => $record['name_given'] ?? ($existing['name_given'] ?? null),
            'name_surname' => $record['name_surname'] ?? ($existing['name_surname'] ?? null),
            'name_prefix' => $record['name_prefix'] ?? ($existing['name_prefix'] ?? null),
            'name_suffix' => $record['name_suffix'] ?? ($existing['name_suffix'] ?? null),
            'sex' => isset($record['sex']) ? strtoupper(substr((string)$record['sex'], 0, 1)) : ($existing['sex'] ?? null),
            'birth_date_raw' => $birthRaw,
            'birth_date_sort' => $birthSort,
            'birth_place' => $record['birth_place'] ?? ($existing['birth_place'] ?? null),
            'death_date_raw' => $deathRaw,
            'death_date_sort' => $deathSort,
            'death_place' => $record['death_place'] ?? ($existing['death_place'] ?? null),
            'is_living' => $flags['is_living'],
            'is_private' => array_key_exists('is_private', $record) ? ((int)$record['is_private'] ? 1 : 0) : $flags['is_private'],
            'has_sources' => array_key_exists('has_sources', $record) ? ((int)$record['has_sources'] ? 1 : 0) : (int)($existing['has_sources'] ?? 0),
            'notes_text' => $record['notes_text'] ?? ($existing['notes_text'] ?? null),
            'external_source_id' => $ext !== '' ? $ext : ($existing['external_source_id'] ?? null),
        ];

        if ($dryRun) {
            return [
                'dry_run' => true,
                'action' => $existing ? 'update' : 'create',
                'id' => $existing ? (int)$existing['id'] : null,
                'record' => $payload,
            ];
        }

        if ($existing) {
            Database::execute(
                'UPDATE rel8d_people SET gedcom_xref=?, name_display=?, name_given=?, name_surname=?, name_prefix=?, name_suffix=?,
                 sex=?, birth_date_raw=?, birth_date_sort=?, birth_place=?, death_date_raw=?, death_date_sort=?, death_place=?,
                 is_living=?, is_private=?, has_sources=?, notes_text=?, external_source_id=?, deleted_at=NULL
                 WHERE id=?',
                [
                    $payload['gedcom_xref'], $payload['name_display'], $payload['name_given'], $payload['name_surname'],
                    $payload['name_prefix'], $payload['name_suffix'], $payload['sex'], $payload['birth_date_raw'],
                    $payload['birth_date_sort'], $payload['birth_place'], $payload['death_date_raw'], $payload['death_date_sort'],
                    $payload['death_place'], $payload['is_living'], $payload['is_private'], $payload['has_sources'],
                    $payload['notes_text'], $payload['external_source_id'], (int)$existing['id'],
                ]
            );
            $newId = (int)$existing['id'];
            self::audit($actorUid, 'update_person', 'rel8d_people', $newId, $newId, ['id' => $newId], ['id' => $newId], $actorLabel);
            return ['action' => 'update', 'id' => $newId, 'created' => 0, 'updated' => 1];
        }

        Database::execute(
            'INSERT INTO rel8d_people
             (tree_id, gedcom_xref, name_display, name_given, name_surname, name_prefix, name_suffix, sex,
              birth_date_raw, birth_date_sort, birth_place, death_date_raw, death_date_sort, death_place,
              is_living, is_private, has_sources, notes_text, external_source_id)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [
                $payload['tree_id'], $payload['gedcom_xref'], $payload['name_display'], $payload['name_given'],
                $payload['name_surname'], $payload['name_prefix'], $payload['name_suffix'], $payload['sex'],
                $payload['birth_date_raw'], $payload['birth_date_sort'], $payload['birth_place'],
                $payload['death_date_raw'], $payload['death_date_sort'], $payload['death_place'],
                $payload['is_living'], $payload['is_private'], $payload['has_sources'], $payload['notes_text'],
                $payload['external_source_id'],
            ]
        );
        $newId = (int)Database::lastInsertId();
        self::audit($actorUid, 'create_person', 'rel8d_people', $newId, $newId, null, ['id' => $newId], $actorLabel);
        return ['action' => 'create', 'id' => $newId, 'created' => 1, 'updated' => 0];
    }

    public static function addNote(array $record, int $actorUid, bool $dryRun = false, ?string $actorLabel = null): array
    {
        self::ensureSchema();
        $treeId = self::defaultTreeId();
        $personId = (int)($record['person_id'] ?? 0);
        $body = trim((string)($record['body'] ?? $record['note'] ?? ''));
        if ($body === '') {
            throw new InvalidArgumentException('body required');
        }
        $payload = [
            'tree_id' => $treeId,
            'person_id' => $personId > 0 ? $personId : null,
            'family_id' => isset($record['family_id']) ? (int)$record['family_id'] : null,
            'title' => trim((string)($record['title'] ?? '')) ?: null,
            'body' => $body,
            'is_story' => !empty($record['is_story']) ? 1 : 0,
            'external_source_id' => trim((string)($record['external_source_id'] ?? '')) ?: null,
            'created_by' => $actorUid > 0 ? $actorUid : null,
        ];
        if ($dryRun) {
            return ['dry_run' => true, 'action' => 'create', 'record' => $payload];
        }
        Database::execute(
            'INSERT INTO rel8d_notes (tree_id, person_id, family_id, title, body, is_story, external_source_id, created_by)
             VALUES (?,?,?,?,?,?,?,?)',
            [
                $payload['tree_id'], $payload['person_id'], $payload['family_id'], $payload['title'],
                $payload['body'], $payload['is_story'], $payload['external_source_id'], $payload['created_by'],
            ]
        );
        $id = (int)Database::lastInsertId();
        self::audit($actorUid, 'add_note', 'rel8d_notes', $id, $personId > 0 ? $personId : null, null, ['id' => $id], $actorLabel);
        return ['action' => 'create', 'id' => $id, 'created' => 1, 'updated' => 0];
    }

    public static function addSource(array $record, int $actorUid, bool $dryRun = false, ?string $actorLabel = null): array
    {
        self::ensureSchema();
        $treeId = self::defaultTreeId();
        $title = trim((string)($record['title'] ?? ''));
        if ($title === '') {
            throw new InvalidArgumentException('title required');
        }
        $ext = trim((string)($record['external_source_id'] ?? $record['gedcom_xref'] ?? ''));
        $existing = null;
        if ($ext !== '') {
            $existing = Database::queryOne(
                'SELECT * FROM rel8d_sources WHERE tree_id = ? AND (external_source_id = ? OR gedcom_xref = ?) LIMIT 1',
                [$treeId, $ext, $ext]
            );
        }
        $payload = [
            'tree_id' => $treeId,
            'gedcom_xref' => $record['gedcom_xref'] ?? ($existing['gedcom_xref'] ?? null),
            'title' => $title,
            'author' => $record['author'] ?? ($existing['author'] ?? null),
            'publication' => $record['publication'] ?? ($existing['publication'] ?? null),
            'repository' => $record['repository'] ?? ($existing['repository'] ?? null),
            'text_body' => $record['text_body'] ?? $record['text'] ?? ($existing['text_body'] ?? null),
            'external_source_id' => $ext !== '' ? $ext : ($existing['external_source_id'] ?? null),
        ];
        if ($dryRun) {
            return ['dry_run' => true, 'action' => $existing ? 'update' : 'create', 'id' => $existing ? (int)$existing['id'] : null, 'record' => $payload];
        }
        if ($existing) {
            Database::execute(
                'UPDATE rel8d_sources SET title=?, author=?, publication=?, repository=?, text_body=?, external_source_id=?, deleted_at=NULL WHERE id=?',
                [$payload['title'], $payload['author'], $payload['publication'], $payload['repository'], $payload['text_body'], $payload['external_source_id'], (int)$existing['id']]
            );
            $id = (int)$existing['id'];
            self::audit($actorUid, 'update_source', 'rel8d_sources', $id, null, null, ['id' => $id], $actorLabel);
            return ['action' => 'update', 'id' => $id, 'created' => 0, 'updated' => 1];
        }
        Database::execute(
            'INSERT INTO rel8d_sources (tree_id, gedcom_xref, title, author, publication, repository, text_body, external_source_id)
             VALUES (?,?,?,?,?,?,?,?)',
            [$payload['tree_id'], $payload['gedcom_xref'], $payload['title'], $payload['author'], $payload['publication'], $payload['repository'], $payload['text_body'], $payload['external_source_id']]
        );
        $id = (int)Database::lastInsertId();
        self::audit($actorUid, 'add_source', 'rel8d_sources', $id, null, null, ['id' => $id], $actorLabel);

        $personId = (int)($record['person_id'] ?? 0);
        if ($personId > 0) {
            Database::execute(
                'INSERT INTO rel8d_citations (tree_id, source_id, person_id, page, quality, note) VALUES (?,?,?,?,?,?)',
                [$treeId, $id, $personId, $record['page'] ?? null, $record['quality'] ?? null, $record['note'] ?? null]
            );
            Database::execute('UPDATE rel8d_people SET has_sources = 1 WHERE id = ?', [$personId]);
        }
        return ['action' => 'create', 'id' => $id, 'created' => 1, 'updated' => 0];
    }

    public static function surnameIndex(int $uid, int $limit = 500): array
    {
        self::ensureSchema();
        $treeId = self::defaultTreeId();
        $limit = max(1, min(2000, $limit));
        return Database::queryAll(
            'SELECT name_surname AS surname, COUNT(*) AS person_count
             FROM rel8d_people
             WHERE tree_id = ? AND deleted_at IS NULL AND name_surname IS NOT NULL AND name_surname <> \'\''
            . self::livingPrivacySql('rel8d_people', $uid) . '
             GROUP BY name_surname
             ORDER BY person_count DESC, name_surname ASC
             LIMIT ' . $limit,
            [$treeId]
        );
    }

    public static function onThisDay(int $uid, int $month, int $day): array
    {
        self::ensureSchema();
        $treeId = self::defaultTreeId();
        $month = max(1, min(12, $month));
        $day = max(1, min(31, $day));
        $like = sprintf('%% %02d', $day); // rough; also match month names via PHP filter
        $rows = Database::queryAll(
            'SELECT id, name_display, birth_date_raw, death_date_raw, birth_date_sort, death_date_sort
             FROM rel8d_people
             WHERE tree_id = ? AND deleted_at IS NULL' . self::livingPrivacySql('rel8d_people', $uid) . '
               AND (
                 (birth_date_sort IS NOT NULL AND MONTH(birth_date_sort) = ? AND DAY(birth_date_sort) = ?)
                 OR (death_date_sort IS NOT NULL AND MONTH(death_date_sort) = ? AND DAY(death_date_sort) = ?)
               )
             ORDER BY name_surname ASC, name_given ASC
             LIMIT 100',
            [$treeId, $month, $day, $month, $day]
        );
        $out = [];
        foreach ($rows as $r) {
            $kind = [];
            if (!empty($r['birth_date_sort']) && (int)date('n', strtotime((string)$r['birth_date_sort'])) === $month
                && (int)date('j', strtotime((string)$r['birth_date_sort'])) === $day) {
                $kind[] = 'birth';
            }
            if (!empty($r['death_date_sort']) && (int)date('n', strtotime((string)$r['death_date_sort'])) === $month
                && (int)date('j', strtotime((string)$r['death_date_sort'])) === $day) {
                $kind[] = 'death';
            }
            $r['kinds'] = $kind;
            $out[] = $r;
        }
        return $out;
    }

    // ------------------------------------------------------------------
    // Tree charts
    // ------------------------------------------------------------------

    public static function pedigree(int $uid, int $rootPersonId, int $generations = 5): ?array
    {
        $root = self::getPerson($uid, $rootPersonId);
        if (!$root) {
            return null;
        }
        $generations = max(1, min(10, $generations));
        $build = function (int $personId, int $gen, int $ahn) use (&$build, $uid, $generations): ?array {
            if ($gen > $generations) {
                return null;
            }
            $p = Database::queryOne(
                'SELECT id, name_display, birth_date_raw, death_date_raw, sex, is_living, is_private, has_sources
                 FROM rel8d_people WHERE id = ? AND deleted_at IS NULL',
                [$personId]
            );
            if (!$p || !self::personVisibleTo($p, $uid)) {
                return null;
            }
            $node = [
                'id' => (int)$p['id'],
                'name' => (string)$p['name_display'],
                'birth' => $p['birth_date_raw'],
                'death' => $p['death_date_raw'],
                'sex' => $p['sex'],
                'ahnentafel' => $ahn,
                'generation' => $gen,
                'has_sources' => (int)$p['has_sources'],
                'father' => null,
                'mother' => null,
            ];
            if ($gen < $generations) {
                $fam = Database::queryOne(
                    'SELECT f.husband_person_id, f.wife_person_id
                     FROM rel8d_family_children fc
                     JOIN rel8d_families f ON f.id = fc.family_id AND f.deleted_at IS NULL
                     WHERE fc.person_id = ?
                     ORDER BY fc.id ASC LIMIT 1',
                    [$personId]
                );
                if ($fam) {
                    if (!empty($fam['husband_person_id'])) {
                        $node['father'] = $build((int)$fam['husband_person_id'], $gen + 1, $ahn * 2);
                    }
                    if (!empty($fam['wife_person_id'])) {
                        $node['mother'] = $build((int)$fam['wife_person_id'], $gen + 1, $ahn * 2 + 1);
                    }
                }
            }
            return $node;
        };
        return $build($rootPersonId, 0, 1);
    }

    public static function familyGroup(int $uid, int $familyId): ?array
    {
        self::ensureSchema();
        $fam = Database::queryOne('SELECT * FROM rel8d_families WHERE id = ? AND deleted_at IS NULL', [$familyId]);
        if (!$fam) {
            return null;
        }
        $load = function (?int $pid) use ($uid): ?array {
            if (!$pid) {
                return null;
            }
            $p = Database::queryOne(
                'SELECT id, name_display, birth_date_raw, death_date_raw, sex, has_sources, is_living, is_private
                 FROM rel8d_people WHERE id = ? AND deleted_at IS NULL',
                [$pid]
            );
            if (!$p || !self::personVisibleTo($p, $uid)) {
                return null;
            }
            return $p;
        };
        $children = Database::queryAll(
            'SELECT p.id, p.name_display, p.birth_date_raw, p.death_date_raw, p.sex, p.has_sources, p.is_living, p.is_private, fc.pedigree
             FROM rel8d_family_children fc
             JOIN rel8d_people p ON p.id = fc.person_id AND p.deleted_at IS NULL
             WHERE fc.family_id = ?
             ORDER BY COALESCE(p.birth_date_sort, \'9999-12-31\') ASC, fc.sort_order ASC, fc.id ASC',
            [$familyId]
        );
        $children = array_values(array_filter($children, fn($c) => self::personVisibleTo($c, $uid)));
        $events = Database::queryAll(
            'SELECT * FROM rel8d_events WHERE family_id = ? ORDER BY COALESCE(date_sort, \'9999-12-31\') ASC, id ASC',
            [$familyId]
        );
        return [
            'family' => $fam,
            'husband' => $load(isset($fam['husband_person_id']) ? (int)$fam['husband_person_id'] : null),
            'wife' => $load(isset($fam['wife_person_id']) ? (int)$fam['wife_person_id'] : null),
            'children' => $children,
            'events' => $events,
        ];
    }

    public static function descendants(int $uid, int $rootPersonId, int $generations = 4): ?array
    {
        $root = Database::queryOne(
            'SELECT id, name_display, birth_date_raw, death_date_raw, sex, has_sources, is_living, is_private
             FROM rel8d_people WHERE id = ? AND deleted_at IS NULL',
            [$rootPersonId]
        );
        if (!$root || !self::personVisibleTo($root, $uid)) {
            return null;
        }
        $generations = max(1, min(8, $generations));
        $walk = function (int $personId, int $gen) use (&$walk, $uid, $generations): array {
            if ($gen >= $generations) {
                return [];
            }
            $families = Database::queryAll(
                'SELECT id FROM rel8d_families WHERE deleted_at IS NULL AND (husband_person_id = ? OR wife_person_id = ?)',
                [$personId, $personId]
            );
            $kids = [];
            foreach ($families as $f) {
                $children = Database::queryAll(
                    'SELECT p.id, p.name_display, p.birth_date_raw, p.death_date_raw, p.sex, p.has_sources, p.is_living, p.is_private
                     FROM rel8d_family_children fc
                     JOIN rel8d_people p ON p.id = fc.person_id AND p.deleted_at IS NULL
                     WHERE fc.family_id = ?
                     ORDER BY COALESCE(p.birth_date_sort, \'9999-12-31\') ASC',
                    [(int)$f['id']]
                );
                foreach ($children as $c) {
                    if (!self::personVisibleTo($c, $uid)) {
                        continue;
                    }
                    $c['children'] = $walk((int)$c['id'], $gen + 1);
                    $kids[] = $c;
                }
            }
            return $kids;
        };
        $root['children'] = $walk($rootPersonId, 0);
        return $root;
    }

    // ------------------------------------------------------------------
    // Relationship calculator
    // ------------------------------------------------------------------

    public static function relationship(int $uid, int $fromId, int $toId): array
    {
        self::ensureSchema();
        if ($fromId === $toId) {
            return ['relation' => 'same person', 'path' => []];
        }
        $from = self::getPerson($uid, $fromId);
        $to = self::getPerson($uid, $toId);
        if (!$from || !$to) {
            throw new RuntimeException('Person not found');
        }

        // BFS over parent/child/spouse edges
        $neighbors = function (int $pid): array {
            $out = [];
            $famc = Database::queryAll(
                'SELECT f.husband_person_id, f.wife_person_id FROM rel8d_family_children fc
                 JOIN rel8d_families f ON f.id = fc.family_id AND f.deleted_at IS NULL
                 WHERE fc.person_id = ?',
                [$pid]
            );
            foreach ($famc as $f) {
                if (!empty($f['husband_person_id'])) {
                    $out[(int)$f['husband_person_id']] = 'parent';
                }
                if (!empty($f['wife_person_id'])) {
                    $out[(int)$f['wife_person_id']] = 'parent';
                }
            }
            $asParent = Database::queryAll(
                'SELECT fc.person_id FROM rel8d_families f
                 JOIN rel8d_family_children fc ON fc.family_id = f.id
                 WHERE f.deleted_at IS NULL AND (f.husband_person_id = ? OR f.wife_person_id = ?)',
                [$pid, $pid]
            );
            foreach ($asParent as $c) {
                $out[(int)$c['person_id']] = 'child';
            }
            $spouses = Database::queryAll(
                'SELECT husband_person_id, wife_person_id FROM rel8d_families
                 WHERE deleted_at IS NULL AND (husband_person_id = ? OR wife_person_id = ?)',
                [$pid, $pid]
            );
            foreach ($spouses as $s) {
                $h = (int)($s['husband_person_id'] ?? 0);
                $w = (int)($s['wife_person_id'] ?? 0);
                if ($h === $pid && $w > 0) {
                    $out[$w] = 'spouse';
                }
                if ($w === $pid && $h > 0) {
                    $out[$h] = 'spouse';
                }
            }
            return $out;
        };

        $queue = [[$fromId]];
        $seen = [$fromId => true];
        $edgeType = [];
        $found = null;
        while ($queue) {
            $path = array_shift($queue);
            $last = $path[count($path) - 1];
            if (count($path) > 16) {
                continue;
            }
            foreach ($neighbors($last) as $next => $etype) {
                if (isset($seen[$next])) {
                    continue;
                }
                $seen[$next] = true;
                $edgeType[$next] = $etype;
                $newPath = array_merge($path, [$next]);
                if ($next === $toId) {
                    $found = $newPath;
                    break 2;
                }
                $queue[] = $newPath;
            }
        }
        if (!$found) {
            return ['relation' => 'unrelated (no path within depth)', 'path' => []];
        }

        $labels = [];
        $names = [];
        foreach ($found as $i => $pid) {
            $p = Database::queryOne('SELECT name_display FROM rel8d_people WHERE id = ?', [$pid]);
            $names[] = (string)($p['name_display'] ?? ('#' . $pid));
            if ($i > 0) {
                $labels[] = $edgeType[$pid] ?? 'related';
            }
        }
        $relation = self::describeRelation($labels);
        return [
            'relation' => $relation,
            'path' => $found,
            'path_names' => $names,
            'edge_types' => $labels,
        ];
    }

    private static function describeRelation(array $edges): string
    {
        if ($edges === ['parent']) {
            return 'parent';
        }
        if ($edges === ['child']) {
            return 'child';
        }
        if ($edges === ['spouse']) {
            return 'spouse';
        }
        if ($edges === ['parent', 'parent']) {
            return 'grandparent';
        }
        if ($edges === ['child', 'child']) {
            return 'grandchild';
        }
        if ($edges === ['parent', 'child']) {
            return 'sibling';
        }
        if ($edges === ['parent', 'parent', 'child']) {
            return 'uncle/aunt';
        }
        if ($edges === ['parent', 'child', 'child']) {
            return 'niece/nephew';
        }
        if ($edges === ['parent', 'parent', 'child', 'child']) {
            return 'first cousin';
        }
        $up = 0;
        $down = 0;
        foreach ($edges as $e) {
            if ($e === 'parent') {
                $up++;
            } elseif ($e === 'child') {
                $down++;
            } elseif ($e === 'spouse') {
                return 'related by marriage (' . implode(' → ', $edges) . ')';
            }
        }
        if ($up > 0 && $down === 0) {
            return $up === 1 ? 'parent' : str_repeat('great-', max(0, $up - 2)) . ($up >= 2 ? 'grandparent' : 'parent');
        }
        if ($down > 0 && $up === 0) {
            return $down === 1 ? 'child' : str_repeat('great-', max(0, $down - 2)) . ($down >= 2 ? 'grandchild' : 'child');
        }
        if ($up > 0 && $down > 0) {
            $removed = abs($up - $down);
            $cousin = min($up, $down) - 1;
            if ($cousin <= 0) {
                return $removed === 0 ? 'sibling' : ($up > $down ? 'uncle/aunt' : 'niece/nephew');
            }
            $ord = $cousin === 1 ? 'first' : ($cousin === 2 ? 'second' : ($cousin === 3 ? 'third' : $cousin . 'th'));
            return $ord . ' cousin' . ($removed > 0 ? (' ' . $removed . 'x removed') : '');
        }
        return implode(' → ', $edges);
    }

    // ------------------------------------------------------------------
    // Quality flags
    // ------------------------------------------------------------------

    public static function rebuildQualityFlags(int $treeId): int
    {
        self::ensureSchema();
        Database::execute('DELETE FROM rel8d_quality_flags WHERE tree_id = ?', [$treeId]);
        $people = Database::queryAll(
            'SELECT id, name_display, birth_date_sort, death_date_sort, birth_date_raw, death_date_raw
             FROM rel8d_people WHERE tree_id = ? AND deleted_at IS NULL',
            [$treeId]
        );
        $count = 0;
        foreach ($people as $p) {
            $pid = (int)$p['id'];
            $b = $p['birth_date_sort'] ?? null;
            $d = $p['death_date_sort'] ?? null;
            if ($b && $d && $d < $b) {
                self::insertFlag($treeId, $pid, null, 'death_before_birth', 'error', 'Death date is before birth date');
                $count++;
            }
            if ($b && $d) {
                $age = (int)((strtotime((string)$d) - strtotime((string)$b)) / 31557600);
                if ($age > 120) {
                    self::insertFlag($treeId, $pid, null, 'impossible_age', 'error', 'Implied age over 120');
                    $count++;
                }
            }
            $events = Database::queryAll(
                'SELECT id, tag, date_sort FROM rel8d_events WHERE person_id = ? AND date_sort IS NOT NULL',
                [$pid]
            );
            if ($d) {
                foreach ($events as $e) {
                    if (in_array($e['tag'], ['BIRT', 'CHR', 'BAPM'], true)) {
                        continue;
                    }
                    if (!empty($e['date_sort']) && (string)$e['date_sort'] > (string)$d) {
                        self::insertFlag($treeId, $pid, null, 'event_after_death', 'warn', 'Event ' . $e['tag'] . ' after death');
                        $count++;
                    }
                }
            }
            // Parents too young / too old
            $parents = Database::queryOne(
                'SELECT f.husband_person_id, f.wife_person_id FROM rel8d_family_children fc
                 JOIN rel8d_families f ON f.id = fc.family_id
                 WHERE fc.person_id = ? LIMIT 1',
                [$pid]
            );
            if ($parents && $b) {
                foreach (['husband_person_id', 'wife_person_id'] as $col) {
                    $ppid = (int)($parents[$col] ?? 0);
                    if ($ppid <= 0) {
                        continue;
                    }
                    $par = Database::queryOne('SELECT birth_date_sort FROM rel8d_people WHERE id = ?', [$ppid]);
                    $pb = $par['birth_date_sort'] ?? null;
                    if (!$pb) {
                        continue;
                    }
                    $parentAge = (int)((strtotime((string)$b) - strtotime((string)$pb)) / 31557600);
                    if ($parentAge < 12) {
                        self::insertFlag($treeId, $pid, null, 'parent_too_young', 'error', 'Parent younger than 12 at birth');
                        $count++;
                    } elseif ($parentAge > 70) {
                        self::insertFlag($treeId, $pid, null, 'parent_too_old', 'warn', 'Parent older than 70 at birth');
                        $count++;
                    }
                }
            }
            // Conflicting birth/death facts (multiple BIRT/DEAT with different dates)
            foreach (['BIRT' => 'conflicting_birth', 'DEAT' => 'conflicting_death'] as $tag => $flag) {
                $dates = Database::queryAll(
                    'SELECT DISTINCT date_raw FROM rel8d_events WHERE person_id = ? AND tag = ? AND date_raw IS NOT NULL AND date_raw <> \'\'',
                    [$pid, $tag]
                );
                if (count($dates) > 1) {
                    self::insertFlag($treeId, $pid, null, $flag, 'warn', 'Multiple conflicting ' . $tag . ' dates');
                    $count++;
                }
            }
        }
        return $count;
    }

    private static function insertFlag(int $treeId, ?int $personId, ?int $familyId, string $type, string $severity, string $message): void
    {
        Database::execute(
            'INSERT INTO rel8d_quality_flags (tree_id, person_id, family_id, flag_type, severity, message) VALUES (?,?,?,?,?,?)',
            [$treeId, $personId, $familyId, $type, $severity, $message]
        );
    }

    public static function listQualityFlags(int $uid, int $limit = 200): array
    {
        self::ensureSchema();
        $treeId = self::defaultTreeId();
        $limit = max(1, min(1000, $limit));
        $rows = Database::queryAll(
            'SELECT q.*, p.name_display
             FROM rel8d_quality_flags q
             LEFT JOIN rel8d_people p ON p.id = q.person_id
             WHERE q.tree_id = ? AND q.resolved_at IS NULL
             ORDER BY FIELD(q.severity, \'error\', \'warn\', \'info\'), q.id DESC
             LIMIT ' . $limit,
            [$treeId]
        );
        if (!self::canViewLiving($uid)) {
            $rows = array_values(array_filter($rows, static function ($r) use ($uid) {
                if (empty($r['person_id'])) {
                    return true;
                }
                $p = Database::queryOne('SELECT is_living, is_private FROM rel8d_people WHERE id = ?', [(int)$r['person_id']]);
                return $p ? Rel8dModel::personVisibleTo($p, $uid) : false;
            }));
        }
        return $rows;
    }

    // ------------------------------------------------------------------
    // Places / geocode / map
    // ------------------------------------------------------------------

    public static function syncPlaces(int $treeId): int
    {
        $places = Database::queryAll(
            'SELECT place, COUNT(*) AS c FROM rel8d_events
             WHERE tree_id = ? AND place IS NOT NULL AND place <> \'\'
             GROUP BY place',
            [$treeId]
        );
        $peoplePlaces = Database::queryAll(
            'SELECT birth_place AS place FROM rel8d_people WHERE tree_id = ? AND birth_place IS NOT NULL AND birth_place <> \'\'
             UNION
             SELECT death_place AS place FROM rel8d_people WHERE tree_id = ? AND death_place IS NOT NULL AND death_place <> \'\'',
            [$treeId, $treeId]
        );
        $map = [];
        foreach ($places as $p) {
            $name = trim((string)$p['place']);
            if ($name === '') {
                continue;
            }
            $map[$name] = ($map[$name] ?? 0) + (int)$p['c'];
        }
        foreach ($peoplePlaces as $p) {
            $name = trim((string)$p['place']);
            if ($name === '') {
                continue;
            }
            $map[$name] = ($map[$name] ?? 0) + 1;
        }
        $n = 0;
        foreach ($map as $name => $c) {
            $norm = mb_strtolower($name);
            $existing = Database::queryOne(
                'SELECT id, event_count FROM rel8d_places WHERE tree_id = ? AND normalized = ?',
                [$treeId, $norm]
            );
            if ($existing) {
                Database::execute('UPDATE rel8d_places SET place_name = ?, event_count = ? WHERE id = ?', [$name, $c, (int)$existing['id']]);
            } else {
                Database::execute(
                    'INSERT INTO rel8d_places (tree_id, place_name, normalized, event_count, geocode_status) VALUES (?,?,?,?,?)',
                    [$treeId, $name, $norm, $c, 'pending']
                );
                $n++;
            }
        }
        return $n;
    }

    public static function geocodePending(int $limit = 20): array
    {
        self::ensureSchema();
        $treeId = self::defaultTreeId();
        $limit = max(1, min(50, $limit));
        $rows = Database::queryAll(
            'SELECT * FROM rel8d_places WHERE tree_id = ? AND geocode_status = ? ORDER BY event_count DESC, id ASC LIMIT ' . $limit,
            [$treeId, 'pending']
        );
        $done = 0;
        $failed = 0;
        foreach ($rows as $row) {
            usleep(1100000); // Nominatim usage policy ~1 req/sec
            $result = self::nominatimGeocode((string)$row['place_name']);
            if ($result) {
                Database::execute(
                    'UPDATE rel8d_places SET lat=?, lng=?, geocode_status=?, geocode_raw=?, geocoded_at=NOW() WHERE id=?',
                    [$result['lat'], $result['lng'], 'ok', json_encode($result['raw']), (int)$row['id']]
                );
                $done++;
            } else {
                Database::execute(
                    'UPDATE rel8d_places SET geocode_status=?, geocoded_at=NOW() WHERE id=?',
                    ['failed', (int)$row['id']]
                );
                $failed++;
            }
        }
        return ['geocoded' => $done, 'failed' => $failed, 'attempted' => count($rows)];
    }

    private static function nominatimGeocode(string $place): ?array
    {
        $url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' . rawurlencode($place);
        $ctx = stream_context_create([
            'http' => [
                'method' => 'GET',
                'header' => "User-Agent: Rel8d/catn8.us (private genealogy; contact admin@catn8.us)\r\nAccept: application/json\r\n",
                'timeout' => 12,
            ],
        ]);
        $body = @file_get_contents($url, false, $ctx);
        if ($body === false) {
            return null;
        }
        $json = json_decode($body, true);
        if (!is_array($json) || !isset($json[0]['lat'], $json[0]['lon'])) {
            return null;
        }
        return [
            'lat' => (float)$json[0]['lat'],
            'lng' => (float)$json[0]['lon'],
            'raw' => $json[0],
        ];
    }

    public static function mapPlaces(int $uid): array
    {
        self::ensureSchema();
        $treeId = self::defaultTreeId();
        self::syncPlaces($treeId);
        $rows = Database::queryAll(
            'SELECT id, place_name, event_count, lat, lng, geocode_status FROM rel8d_places
             WHERE tree_id = ? ORDER BY event_count DESC, place_name ASC LIMIT 500',
            [$treeId]
        );
        return [
            'places' => $rows,
            'geocoded' => count(array_filter($rows, static fn($r) => $r['lat'] !== null && $r['lng'] !== null)),
            'pending' => count(array_filter($rows, static fn($r) => ($r['geocode_status'] ?? '') === 'pending')),
        ];
    }

    // ------------------------------------------------------------------
    // DNA
    // ------------------------------------------------------------------

    public static function ensureDnaSeed(): void
    {
        self::ensureSchema();
        $treeId = self::defaultTreeId();
        $existing = Database::queryOne('SELECT id FROM rel8d_dna_profiles WHERE tree_id = ? LIMIT 1', [$treeId]);
        if ($existing) {
            return;
        }
        Database::execute(
            'INSERT INTO rel8d_dna_profiles (tree_id, label, notes) VALUES (?,?,?)',
            [$treeId, 'Primary ethnicity estimate', 'Editable admin DNA summary']
        );
        $profileId = (int)Database::lastInsertId();

        $regions = [
            ['England', 70.0, [
                ['SE England', 16.0],
                ['West Midlands', 14.0],
                ['East Midlands & Yorkshire', 13.0],
                ['Northern England', 12.0],
                ['Devon & Somerset', 9.0],
                ['Cornwall', 6.0],
            ]],
            ['Celtic & Gaelic', 19.0, [
                ['Scottish Lowlands', 7.0],
                ['Ulster', 4.0],
                ['N Wales & NW England', 3.0],
                ['S Wales', 3.0],
                ['Brittany', 2.0],
            ]],
            ['Western Europe', 8.0, [
                ['Bavaria & W Austria', 3.0],
                ['Belgium', 2.0],
                ['Switzerland', 2.0],
                ['NW Germany', 1.0],
            ]],
            ['Denmark', 3.0, []],
        ];
        $order = 0;
        foreach ($regions as $region) {
            Database::execute(
                'INSERT INTO rel8d_dna_regions (profile_id, parent_region_id, region_name, percent, sort_order) VALUES (?,?,?,?,?)',
                [$profileId, null, $region[0], $region[1], $order++]
            );
            $parentId = (int)Database::lastInsertId();
            $subOrder = 0;
            foreach ($region[2] as $sub) {
                Database::execute(
                    'INSERT INTO rel8d_dna_regions (profile_id, parent_region_id, region_name, percent, sort_order) VALUES (?,?,?,?,?)',
                    [$profileId, $parentId, $sub[0], $sub[1], $subOrder++]
                );
            }
        }
        foreach (['Georgia & Florida Settlers', 'Southern Backcountry to OK & TX'] as $i => $community) {
            Database::execute(
                'INSERT INTO rel8d_dna_communities (profile_id, community_name, sort_order) VALUES (?,?,?)',
                [$profileId, $community, $i]
            );
        }
    }

    public static function getDna(int $uid): array
    {
        self::ensureDnaSeed();
        $treeId = self::defaultTreeId();
        $profile = Database::queryOne('SELECT * FROM rel8d_dna_profiles WHERE tree_id = ? ORDER BY id ASC LIMIT 1', [$treeId]);
        if (!$profile) {
            return ['profile' => null, 'regions' => [], 'communities' => []];
        }
        $regions = Database::queryAll(
            'SELECT * FROM rel8d_dna_regions WHERE profile_id = ? ORDER BY parent_region_id IS NOT NULL, sort_order ASC, id ASC',
            [(int)$profile['id']]
        );
        $communities = Database::queryAll(
            'SELECT * FROM rel8d_dna_communities WHERE profile_id = ? ORDER BY sort_order ASC, id ASC',
            [(int)$profile['id']]
        );
        return ['profile' => $profile, 'regions' => $regions, 'communities' => $communities, 'can_edit' => self::isSiteAdmin($uid) ? 1 : 0];
    }

    public static function saveDna(array $payload, int $actorUid): array
    {
        if (!self::isSiteAdmin($actorUid)) {
            throw new RuntimeException('Not authorized');
        }
        self::ensureDnaSeed();
        $treeId = self::defaultTreeId();
        $profile = Database::queryOne('SELECT * FROM rel8d_dna_profiles WHERE tree_id = ? ORDER BY id ASC LIMIT 1', [$treeId]);
        $profileId = (int)$profile['id'];
        if (isset($payload['label']) || isset($payload['notes'])) {
            Database::execute(
                'UPDATE rel8d_dna_profiles SET label = COALESCE(?, label), notes = COALESCE(?, notes), updated_by = ? WHERE id = ?',
                [$payload['label'] ?? null, $payload['notes'] ?? null, $actorUid, $profileId]
            );
        }
        if (isset($payload['regions']) && is_array($payload['regions'])) {
            Database::execute('DELETE FROM rel8d_dna_regions WHERE profile_id = ?', [$profileId]);
            $order = 0;
            $idMap = [];
            foreach ($payload['regions'] as $region) {
                if (!is_array($region)) {
                    continue;
                }
                $parentKey = $region['parent_key'] ?? null;
                $parentId = ($parentKey !== null && isset($idMap[$parentKey])) ? $idMap[$parentKey] : null;
                Database::execute(
                    'INSERT INTO rel8d_dna_regions (profile_id, parent_region_id, region_name, percent, sort_order) VALUES (?,?,?,?,?)',
                    [$profileId, $parentId, (string)($region['region_name'] ?? ''), (float)($region['percent'] ?? 0), $order++]
                );
                if (isset($region['key'])) {
                    $idMap[(string)$region['key']] = (int)Database::lastInsertId();
                }
            }
        }
        if (isset($payload['communities']) && is_array($payload['communities'])) {
            Database::execute('DELETE FROM rel8d_dna_communities WHERE profile_id = ?', [$profileId]);
            foreach ($payload['communities'] as $i => $c) {
                $name = is_array($c) ? (string)($c['community_name'] ?? $c['name'] ?? '') : (string)$c;
                if ($name === '') {
                    continue;
                }
                Database::execute(
                    'INSERT INTO rel8d_dna_communities (profile_id, community_name, sort_order) VALUES (?,?,?)',
                    [$profileId, $name, (int)$i]
                );
            }
        }
        self::audit($actorUid, 'save_dna', 'rel8d_dna_profiles', $profileId, null, null, ['id' => $profileId]);
        return self::getDna($actorUid);
    }

    // ------------------------------------------------------------------
    // Media upload
    // ------------------------------------------------------------------

    public static function storeUploadedMedia(array $file, array $meta, int $actorUid, ?string $actorLabel = null): array
    {
        self::ensureSchema();
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            throw new InvalidArgumentException('Upload failed');
        }
        $size = (int)($file['size'] ?? 0);
        if ($size <= 0 || $size > self::MAX_UPLOAD_BYTES) {
            throw new InvalidArgumentException('File too large or empty');
        }
        $tmp = (string)($file['tmp_name'] ?? '');
        if ($tmp === '' || !is_uploaded_file($tmp)) {
            throw new InvalidArgumentException('Invalid upload');
        }
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = (string)$finfo->file($tmp);
        $origName = (string)($file['name'] ?? 'upload');
        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        $allowedExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'txt', 'ged'];
        if (!in_array($mime, self::ALLOWED_UPLOAD_MIME, true) && !in_array($ext, $allowedExt, true)) {
            throw new InvalidArgumentException('Unsupported file type');
        }
        $sha = hash_file('sha256', $tmp);
        $treeId = self::defaultTreeId();
        $year = date('Y');
        $month = date('m');
        $dirRel = 'media/' . $year . '/' . $month;
        $dir = self::storageRoot() . '/' . $dirRel;
        self::ensureStorageDir($dir, 'media month');
        $safeExt = preg_replace('/[^a-z0-9]/', '', $ext) ?: 'bin';
        $storedName = bin2hex(random_bytes(16)) . '.' . $safeExt;
        $dest = $dir . '/' . $storedName;
        if (!move_uploaded_file($tmp, $dest)) {
            throw new RuntimeException('Failed to store upload');
        }
        @chmod($dest, 0640);
        $title = trim((string)($meta['title'] ?? $origName));
        $personId = (int)($meta['person_id'] ?? 0);
        Database::execute(
            'INSERT INTO rel8d_media (tree_id, person_id, title, file_name, stored_path, mime, size_bytes, sha256, media_type, uploaded_by, external_source_id)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            [
                $treeId,
                $personId > 0 ? $personId : null,
                $title !== '' ? $title : $origName,
                $origName,
                $dirRel . '/' . $storedName,
                $mime,
                $size,
                $sha,
                (string)($meta['media_type'] ?? (str_starts_with($mime, 'image/') ? 'photo' : 'document')),
                $actorUid > 0 ? $actorUid : null,
                trim((string)($meta['external_source_id'] ?? '')) ?: null,
            ]
        );
        $id = (int)Database::lastInsertId();
        self::audit($actorUid, 'upload_media', 'rel8d_media', $id, $personId > 0 ? $personId : null, null, ['id' => $id, 'sha256' => $sha], $actorLabel);
        return [
            'id' => $id,
            'media_url' => self::mediaSignedUrl($id),
            'sha256' => $sha,
            'mime' => $mime,
            'size_bytes' => $size,
        ];
    }

    public static function listMedia(int $uid, int $limit = 100, int $offset = 0): array
    {
        self::ensureSchema();
        $treeId = self::defaultTreeId();
        $limit = max(1, min(500, $limit));
        $offset = max(0, $offset);
        $total = (int)(Database::queryOne('SELECT COUNT(*) AS c FROM rel8d_media WHERE tree_id = ? AND deleted_at IS NULL', [$treeId])['c'] ?? 0);
        $rows = Database::queryAll(
            'SELECT m.id, m.title, m.file_name, m.mime, m.media_type, m.size_bytes, m.person_id, m.created_at, p.name_display
             FROM rel8d_media m
             LEFT JOIN rel8d_people p ON p.id = m.person_id
             WHERE m.tree_id = ? AND m.deleted_at IS NULL
             ORDER BY m.id DESC
             LIMIT ' . $limit . ' OFFSET ' . $offset,
            [$treeId]
        );
        foreach ($rows as &$r) {
            $r['media_url'] = self::mediaSignedUrl((int)$r['id']);
        }
        unset($r);
        return ['records' => $rows, 'total' => $total, 'limit' => $limit, 'offset' => $offset];
    }

    // ------------------------------------------------------------------
    // GEDCOM import / export / diff
    // ------------------------------------------------------------------

    public static function previewImport(string $gedcomText, ?string $fileName = null): array
    {
        self::ensureSchema();
        $treeId = self::defaultTreeId();
        $parsed = Rel8dGedcom::parse($gedcomText);
        $sha = hash('sha256', $gedcomText);

        // Build synthetic old parse from DB raw_json where available
        $oldRecords = [];
        $people = Database::queryAll('SELECT gedcom_xref, raw_json FROM rel8d_people WHERE tree_id = ? AND deleted_at IS NULL AND gedcom_xref IS NOT NULL', [$treeId]);
        foreach ($people as $p) {
            $raw = json_decode((string)($p['raw_json'] ?? ''), true);
            if (is_array($raw)) {
                $oldRecords[(string)$p['gedcom_xref']] = $raw;
            }
        }
        $fams = Database::queryAll('SELECT gedcom_xref, raw_json FROM rel8d_families WHERE tree_id = ? AND deleted_at IS NULL AND gedcom_xref IS NOT NULL', [$treeId]);
        foreach ($fams as $f) {
            $raw = json_decode((string)($f['raw_json'] ?? ''), true);
            if (is_array($raw)) {
                $oldRecords[(string)$f['gedcom_xref']] = $raw;
            }
        }
        $oldParsed = [
            'records' => $oldRecords,
            'counts' => [
                'INDI' => count($people),
                'FAM' => count($fams),
                'SOUR' => (int)(Database::queryOne('SELECT COUNT(*) AS c FROM rel8d_sources WHERE tree_id = ? AND deleted_at IS NULL', [$treeId])['c'] ?? 0),
                'NOTE' => 0,
                'OBJE' => 0,
                'REPO' => 0,
                'SUBM' => 0,
                'other' => 0,
            ],
        ];
        $diff = Rel8dGedcom::diff($oldParsed, $parsed);

        Database::execute(
            'INSERT INTO rel8d_imports (tree_id, file_name, sha256, status, counts_json, diff_json, created_by)
             VALUES (?,?,?,?,?,?,?)',
            [
                $treeId,
                $fileName,
                $sha,
                'preview',
                json_encode($parsed['counts']),
                json_encode($diff),
                null,
            ]
        );
        $importId = (int)Database::lastInsertId();

        // Stash gedcom for apply (outside webroot)
        $path = self::storageRoot() . '/imports/import_' . $importId . '.ged';
        file_put_contents($path, $gedcomText);
        @chmod($path, 0640);

        return [
            'import_id' => $importId,
            'sha256' => $sha,
            'counts' => $parsed['counts'],
            'diff' => $diff,
        ];
    }

    public static function applyImport(int $importId, int $actorUid, ?string $actorLabel = null): array
    {
        self::ensureSchema();
        $row = Database::queryOne('SELECT * FROM rel8d_imports WHERE id = ?', [$importId]);
        if (!$row) {
            throw new InvalidArgumentException('import not found');
        }
        $path = self::storageRoot() . '/imports/import_' . $importId . '.ged';
        if (!is_file($path)) {
            throw new RuntimeException('Import file missing');
        }
        $text = (string)file_get_contents($path);
        $result = self::importGedcomText($text, $actorUid, $actorLabel);
        Database::execute(
            'UPDATE rel8d_imports SET status = ?, applied_at = NOW(), created_by = ?, counts_json = ? WHERE id = ?',
            ['applied', $actorUid > 0 ? $actorUid : null, json_encode($result['counts']), $importId]
        );
        self::audit($actorUid, 'apply_import', 'rel8d_imports', $importId, null, null, ['counts' => $result['counts']], $actorLabel);
        return $result + ['import_id' => $importId];
    }

    public static function importGedcomText(string $gedcomText, int $actorUid, ?string $actorLabel = null): array
    {
        self::ensureSchema();
        $treeId = self::defaultTreeId();
        $parsed = Rel8dGedcom::parse($gedcomText);

        $xrefToPersonId = [];
        $xrefToFamilyId = [];
        $xrefToSourceId = [];
        $peopleN = 0;
        $famN = 0;
        $sourN = 0;
        $noteN = 0;
        $objeN = 0;

        // Pass 1: sources
        foreach ($parsed['records'] as $xref => $rec) {
            if (($rec['tag'] ?? '') !== 'SOUR') {
                continue;
            }
            $title = Rel8dGedcom::firstChildValue($rec, 'TITL') ?: Rel8dGedcom::concatContConc($rec);
            $author = Rel8dGedcom::firstChildValue($rec, 'AUTH');
            $pub = Rel8dGedcom::firstChildValue($rec, 'PUBL');
            $existing = Database::queryOne(
                'SELECT id FROM rel8d_sources WHERE tree_id = ? AND gedcom_xref = ? LIMIT 1',
                [$treeId, $xref]
            );
            $raw = json_encode($rec, JSON_UNESCAPED_UNICODE);
            if ($existing) {
                Database::execute(
                    'UPDATE rel8d_sources SET title=?, author=?, publication=?, raw_json=?, deleted_at=NULL WHERE id=?',
                    [$title !== '' ? $title : 'Source ' . $xref, $author ?: null, $pub ?: null, $raw, (int)$existing['id']]
                );
                $xrefToSourceId[$xref] = (int)$existing['id'];
            } else {
                Database::execute(
                    'INSERT INTO rel8d_sources (tree_id, gedcom_xref, title, author, publication, raw_json, external_source_id)
                     VALUES (?,?,?,?,?,?,?)',
                    [$treeId, $xref, $title !== '' ? $title : 'Source ' . $xref, $author ?: null, $pub ?: null, $raw, $xref]
                );
                $xrefToSourceId[$xref] = (int)Database::lastInsertId();
            }
            $sourN++;
        }

        // Pass 2: individuals
        foreach ($parsed['records'] as $xref => $rec) {
            if (($rec['tag'] ?? '') !== 'INDI') {
                continue;
            }
            $nameNodes = Rel8dGedcom::childValues($rec, 'NAME');
            $primaryName = isset($nameNodes[0]) ? Rel8dGedcom::parseName((string)($nameNodes[0]['value'] ?? '')) : [
                'display' => 'Unknown', 'given' => null, 'surname' => null, 'prefix' => null, 'suffix' => null,
            ];
            if (isset($nameNodes[0])) {
                $givn = Rel8dGedcom::firstChildValue($nameNodes[0], 'GIVN');
                $surn = Rel8dGedcom::firstChildValue($nameNodes[0], 'SURN');
                $npfx = Rel8dGedcom::firstChildValue($nameNodes[0], 'NPFX');
                $nsfx = Rel8dGedcom::firstChildValue($nameNodes[0], 'NSFX');
                if ($givn !== '') {
                    $primaryName['given'] = $givn;
                }
                if ($surn !== '') {
                    $primaryName['surname'] = $surn;
                }
                if ($npfx !== '') {
                    $primaryName['prefix'] = $npfx;
                }
                if ($nsfx !== '') {
                    $primaryName['suffix'] = $nsfx;
                }
                if ($primaryName['given'] || $primaryName['surname']) {
                    $primaryName['display'] = trim(($primaryName['given'] ?? '') . ' ' . ($primaryName['surname'] ?? '') . ' ' . ($primaryName['suffix'] ?? ''));
                }
            }
            $sex = Rel8dGedcom::firstChildValue($rec, 'SEX');
            $birt = Rel8dGedcom::firstChild($rec, 'BIRT');
            $deat = Rel8dGedcom::firstChild($rec, 'DEAT');
            $birthRaw = $birt ? Rel8dGedcom::firstChildValue($birt, 'DATE') : '';
            $birthPlace = $birt ? Rel8dGedcom::firstChildValue($birt, 'PLAC') : '';
            $deathRaw = $deat ? Rel8dGedcom::firstChildValue($deat, 'DATE') : '';
            $deathPlace = $deat ? Rel8dGedcom::firstChildValue($deat, 'PLAC') : '';
            $birthSort = Rel8dGedcom::parseDateSort($birthRaw !== '' ? $birthRaw : null);
            $deathSort = Rel8dGedcom::parseDateSort($deathRaw !== '' ? $deathRaw : null);
            $live = self::computeLivingFlags($birthSort, $deathRaw !== '' ? $deathRaw : null, $deathSort);

            $hasSources = 0;
            foreach ($rec['children'] ?? [] as $ch) {
                if (($ch['tag'] ?? '') === 'SOUR') {
                    $hasSources = 1;
                    break;
                }
                foreach ($ch['children'] ?? [] as $g2) {
                    if (($g2['tag'] ?? '') === 'SOUR') {
                        $hasSources = 1;
                        break 2;
                    }
                }
            }

            $raw = json_encode($rec, JSON_UNESCAPED_UNICODE);
            $existing = Database::queryOne(
                'SELECT id FROM rel8d_people WHERE tree_id = ? AND gedcom_xref = ? LIMIT 1',
                [$treeId, $xref]
            );
            $fields = [
                $primaryName['display'], $primaryName['given'], $primaryName['surname'], $primaryName['prefix'], $primaryName['suffix'],
                $sex !== '' ? strtoupper(substr($sex, 0, 1)) : null,
                $birthRaw !== '' ? $birthRaw : null, $birthSort, $birthPlace !== '' ? $birthPlace : null,
                $deathRaw !== '' ? $deathRaw : null, $deathSort, $deathPlace !== '' ? $deathPlace : null,
                $live['is_living'], $live['is_private'], $hasSources, $raw, $xref,
            ];
            if ($existing) {
                Database::execute(
                    'UPDATE rel8d_people SET name_display=?, name_given=?, name_surname=?, name_prefix=?, name_suffix=?, sex=?,
                     birth_date_raw=?, birth_date_sort=?, birth_place=?, death_date_raw=?, death_date_sort=?, death_place=?,
                     is_living=?, is_private=?, has_sources=?, raw_json=?, external_source_id=?, deleted_at=NULL WHERE id=?',
                    array_merge($fields, [(int)$existing['id']])
                );
                $personId = (int)$existing['id'];
                Database::execute('DELETE FROM rel8d_names WHERE person_id = ?', [$personId]);
                Database::execute('DELETE FROM rel8d_events WHERE person_id = ?', [$personId]);
                Database::execute('DELETE FROM rel8d_attributes WHERE person_id = ?', [$personId]);
                Database::execute('DELETE FROM rel8d_citations WHERE person_id = ?', [$personId]);
            } else {
                Database::execute(
                    'INSERT INTO rel8d_people
                     (tree_id, gedcom_xref, name_display, name_given, name_surname, name_prefix, name_suffix, sex,
                      birth_date_raw, birth_date_sort, birth_place, death_date_raw, death_date_sort, death_place,
                      is_living, is_private, has_sources, raw_json, external_source_id)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                    array_merge([$treeId, $xref], $fields)
                );
                $personId = (int)Database::lastInsertId();
            }
            $xrefToPersonId[$xref] = $personId;

            foreach ($nameNodes as $i => $nn) {
                $parsedName = Rel8dGedcom::parseName((string)($nn['value'] ?? ''));
                $givn = Rel8dGedcom::firstChildValue($nn, 'GIVN');
                $surn = Rel8dGedcom::firstChildValue($nn, 'SURN');
                if ($givn !== '') {
                    $parsedName['given'] = $givn;
                }
                if ($surn !== '') {
                    $parsedName['surname'] = $surn;
                }
                Database::execute(
                    'INSERT INTO rel8d_names (person_id, name_type, name_display, name_given, name_surname, name_prefix, name_suffix, is_primary, sort_order)
                     VALUES (?,?,?,?,?,?,?,?,?)',
                    [
                        $personId,
                        Rel8dGedcom::firstChildValue($nn, 'TYPE') ?: ($i === 0 ? 'primary' : 'aka'),
                        $parsedName['display'], $parsedName['given'], $parsedName['surname'],
                        Rel8dGedcom::firstChildValue($nn, 'NPFX') ?: null,
                        Rel8dGedcom::firstChildValue($nn, 'NSFX') ?: null,
                        $i === 0 ? 1 : 0,
                        $i,
                    ]
                );
            }

            $sort = 0;
            foreach ($rec['children'] ?? [] as $ch) {
                $tag = strtoupper((string)($ch['tag'] ?? ''));
                if ($tag === 'NAME' || $tag === 'SEX' || $tag === 'FAMC' || $tag === 'FAMS' || $tag === 'OBJE') {
                    continue;
                }
                if ($tag === 'NOTE') {
                    $body = Rel8dGedcom::concatContConc($ch);
                    if ($body !== '') {
                        Database::execute(
                            'INSERT INTO rel8d_notes (tree_id, person_id, body, is_story, raw_json) VALUES (?,?,?,?,?)',
                            [$treeId, $personId, $body, 0, json_encode($ch, JSON_UNESCAPED_UNICODE)]
                        );
                        $noteN++;
                    }
                    continue;
                }
                if ($tag === 'SOUR') {
                    $sourX = trim((string)($ch['value'] ?? ''));
                    $sid = $xrefToSourceId[$sourX] ?? null;
                    Database::execute(
                        'INSERT INTO rel8d_citations (tree_id, source_id, person_id, page, quality, raw_json) VALUES (?,?,?,?,?,?)',
                        [
                            $treeId, $sid, $personId,
                            Rel8dGedcom::firstChildValue($ch, 'PAGE') ?: null,
                            Rel8dGedcom::firstChildValue($ch, 'QUAY') ?: null,
                            json_encode($ch, JSON_UNESCAPED_UNICODE),
                        ]
                    );
                    continue;
                }
                if (in_array($tag, Rel8dGedcom::EVENT_TAGS, true) || Rel8dGedcom::isEventTag($tag)) {
                    if (in_array($tag, Rel8dGedcom::ATTR_TAGS, true) && !in_array($tag, ['RESI', 'OCCU', 'MILI', '_MILT'], true)) {
                        // fall through to attrs for pure attributes; RESI/OCCU/MILI also as events
                    }
                    $dateRaw = Rel8dGedcom::firstChildValue($ch, 'DATE');
                    $place = Rel8dGedcom::firstChildValue($ch, 'PLAC');
                    $type = Rel8dGedcom::firstChildValue($ch, 'TYPE');
                    $desc = Rel8dGedcom::concatContConc($ch);
                    $hasEvSource = Rel8dGedcom::firstChild($ch, 'SOUR') ? 1 : 0;
                    Database::execute(
                        'INSERT INTO rel8d_events
                         (tree_id, person_id, tag, type_label, date_raw, date_sort, place, description, age_text, cause, raw_json, has_sources, sort_order)
                         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
                        [
                            $treeId, $personId, $tag, $type !== '' ? $type : null,
                            $dateRaw !== '' ? $dateRaw : null, Rel8dGedcom::parseDateSort($dateRaw !== '' ? $dateRaw : null),
                            $place !== '' ? $place : null, $desc !== '' ? $desc : null,
                            Rel8dGedcom::firstChildValue($ch, 'AGE') ?: null,
                            Rel8dGedcom::firstChildValue($ch, 'CAUS') ?: null,
                            json_encode($ch, JSON_UNESCAPED_UNICODE), $hasEvSource, $sort++,
                        ]
                    );
                    $eventId = (int)Database::lastInsertId();
                    foreach (Rel8dGedcom::childValues($ch, 'SOUR') as $sc) {
                        $sx = trim((string)($sc['value'] ?? ''));
                        Database::execute(
                            'INSERT INTO rel8d_citations (tree_id, source_id, person_id, event_id, page, quality, raw_json) VALUES (?,?,?,?,?,?,?)',
                            [
                                $treeId, $xrefToSourceId[$sx] ?? null, $personId, $eventId,
                                Rel8dGedcom::firstChildValue($sc, 'PAGE') ?: null,
                                Rel8dGedcom::firstChildValue($sc, 'QUAY') ?: null,
                                json_encode($sc, JSON_UNESCAPED_UNICODE),
                            ]
                        );
                    }
                }
                if (in_array($tag, Rel8dGedcom::ATTR_TAGS, true)) {
                    Database::execute(
                        'INSERT INTO rel8d_attributes (tree_id, person_id, tag, value_text, date_raw, place, raw_json, sort_order)
                         VALUES (?,?,?,?,?,?,?,?)',
                        [
                            $treeId, $personId, $tag,
                            Rel8dGedcom::concatContConc($ch) ?: null,
                            Rel8dGedcom::firstChildValue($ch, 'DATE') ?: null,
                            Rel8dGedcom::firstChildValue($ch, 'PLAC') ?: null,
                            json_encode($ch, JSON_UNESCAPED_UNICODE), $sort++,
                        ]
                    );
                }
            }
            $peopleN++;
        }

        // Pass 3: families
        foreach ($parsed['records'] as $xref => $rec) {
            if (($rec['tag'] ?? '') !== 'FAM') {
                continue;
            }
            $husb = Rel8dGedcom::firstChildValue($rec, 'HUSB');
            $wife = Rel8dGedcom::firstChildValue($rec, 'WIFE');
            $marr = Rel8dGedcom::firstChild($rec, 'MARR');
            $marrDate = $marr ? Rel8dGedcom::firstChildValue($marr, 'DATE') : '';
            $marrPlace = $marr ? Rel8dGedcom::firstChildValue($marr, 'PLAC') : '';
            $raw = json_encode($rec, JSON_UNESCAPED_UNICODE);
            $existing = Database::queryOne(
                'SELECT id FROM rel8d_families WHERE tree_id = ? AND gedcom_xref = ? LIMIT 1',
                [$treeId, $xref]
            );
            $husbId = $xrefToPersonId[$husb] ?? null;
            $wifeId = $xrefToPersonId[$wife] ?? null;
            if ($existing) {
                Database::execute(
                    'UPDATE rel8d_families SET husband_person_id=?, wife_person_id=?, marriage_date_raw=?, marriage_date_sort=?, marriage_place=?, raw_json=?, deleted_at=NULL WHERE id=?',
                    [
                        $husbId, $wifeId,
                        $marrDate !== '' ? $marrDate : null, Rel8dGedcom::parseDateSort($marrDate !== '' ? $marrDate : null),
                        $marrPlace !== '' ? $marrPlace : null, $raw, (int)$existing['id'],
                    ]
                );
                $famId = (int)$existing['id'];
                Database::execute('DELETE FROM rel8d_family_children WHERE family_id = ?', [$famId]);
                Database::execute('DELETE FROM rel8d_events WHERE family_id = ?', [$famId]);
            } else {
                Database::execute(
                    'INSERT INTO rel8d_families
                     (tree_id, gedcom_xref, husband_person_id, wife_person_id, marriage_date_raw, marriage_date_sort, marriage_place, raw_json, external_source_id)
                     VALUES (?,?,?,?,?,?,?,?,?)',
                    [
                        $treeId, $xref, $husbId, $wifeId,
                        $marrDate !== '' ? $marrDate : null, Rel8dGedcom::parseDateSort($marrDate !== '' ? $marrDate : null),
                        $marrPlace !== '' ? $marrPlace : null, $raw, $xref,
                    ]
                );
                $famId = (int)Database::lastInsertId();
            }
            $xrefToFamilyId[$xref] = $famId;
            $ci = 0;
            foreach (Rel8dGedcom::childValues($rec, 'CHIL') as $ch) {
                $cx = trim((string)($ch['value'] ?? ''));
                $pid = $xrefToPersonId[$cx] ?? null;
                if (!$pid) {
                    continue;
                }
                $pedigree = Rel8dGedcom::firstChildValue($ch, 'PEDI') ?: null;
                Database::execute(
                    'INSERT INTO rel8d_family_children (family_id, person_id, pedigree, sort_order) VALUES (?,?,?,?)',
                    [$famId, $pid, $pedigree, $ci++]
                );
            }
            foreach ($rec['children'] ?? [] as $ch) {
                $tag = strtoupper((string)($ch['tag'] ?? ''));
                if (in_array($tag, Rel8dGedcom::EVENT_TAGS, true)) {
                    Database::execute(
                        'INSERT INTO rel8d_events (tree_id, family_id, tag, type_label, date_raw, date_sort, place, description, raw_json, has_sources, sort_order)
                         VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                        [
                            $treeId, $famId, $tag,
                            Rel8dGedcom::firstChildValue($ch, 'TYPE') ?: null,
                            Rel8dGedcom::firstChildValue($ch, 'DATE') ?: null,
                            Rel8dGedcom::parseDateSort(Rel8dGedcom::firstChildValue($ch, 'DATE') ?: null),
                            Rel8dGedcom::firstChildValue($ch, 'PLAC') ?: null,
                            Rel8dGedcom::concatContConc($ch) ?: null,
                            json_encode($ch, JSON_UNESCAPED_UNICODE),
                            Rel8dGedcom::firstChild($ch, 'SOUR') ? 1 : 0,
                            0,
                        ]
                    );
                }
            }
            $famN++;
        }

        // Pass 4: media object stubs (references only; binary files uploaded separately)
        foreach ($parsed['records'] as $xref => $rec) {
            if (($rec['tag'] ?? '') !== 'OBJE') {
                continue;
            }
            $title = Rel8dGedcom::firstChildValue($rec, 'TITL');
            $file = '';
            $fileNode = Rel8dGedcom::firstChild($rec, 'FILE');
            if ($fileNode) {
                $file = (string)($fileNode['value'] ?? '');
            }
            $existing = Database::queryOne(
                'SELECT id FROM rel8d_media WHERE tree_id = ? AND gedcom_xref = ? LIMIT 1',
                [$treeId, $xref]
            );
            if ($existing) {
                Database::execute(
                    'UPDATE rel8d_media SET title=?, file_name=?, raw_json=?, deleted_at=NULL WHERE id=?',
                    [$title ?: null, $file !== '' ? $file : null, json_encode($rec, JSON_UNESCAPED_UNICODE), (int)$existing['id']]
                );
            } else {
                Database::execute(
                    'INSERT INTO rel8d_media (tree_id, gedcom_xref, title, file_name, media_type, raw_json, external_source_id)
                     VALUES (?,?,?,?,?,?,?)',
                    [$treeId, $xref, $title ?: null, $file !== '' ? $file : null, 'reference', json_encode($rec, JSON_UNESCAPED_UNICODE), $xref]
                );
            }
            $objeN++;
        }

        // Set tree root if empty: prefer person with most ancestors (ahnentafel) or first
        $tree = Database::queryOne('SELECT root_person_id FROM rel8d_trees WHERE id = ?', [$treeId]);
        if (empty($tree['root_person_id']) && $xrefToPersonId) {
            $firstId = (int)reset($xrefToPersonId);
            Database::execute('UPDATE rel8d_trees SET root_person_id = ? WHERE id = ?', [$firstId, $treeId]);
        }

        self::syncPlaces($treeId);
        $flags = self::rebuildQualityFlags($treeId);
        self::ensureDnaSeed();

        $counts = [
            'people' => $peopleN,
            'families' => $famN,
            'sources' => $sourN,
            'notes' => $noteN,
            'media_refs' => $objeN,
            'quality_flags' => $flags,
            'gedcom' => $parsed['counts'],
        ];
        self::audit($actorUid, 'import_gedcom', 'rel8d_trees', $treeId, null, null, ['counts' => $counts], $actorLabel);
        return ['counts' => $counts];
    }

    public static function exportGedcom(): string
    {
        self::ensureSchema();
        $treeId = self::defaultTreeId();
        $records = [];
        $people = Database::queryAll('SELECT raw_json, gedcom_xref FROM rel8d_people WHERE tree_id = ? AND deleted_at IS NULL AND raw_json IS NOT NULL', [$treeId]);
        foreach ($people as $p) {
            $raw = json_decode((string)$p['raw_json'], true);
            if (is_array($raw)) {
                $records[] = $raw;
            }
        }
        $fams = Database::queryAll('SELECT raw_json FROM rel8d_families WHERE tree_id = ? AND deleted_at IS NULL AND raw_json IS NOT NULL', [$treeId]);
        foreach ($fams as $f) {
            $raw = json_decode((string)$f['raw_json'], true);
            if (is_array($raw)) {
                $records[] = $raw;
            }
        }
        $sources = Database::queryAll('SELECT raw_json FROM rel8d_sources WHERE tree_id = ? AND deleted_at IS NULL AND raw_json IS NOT NULL', [$treeId]);
        foreach ($sources as $s) {
            $raw = json_decode((string)$s['raw_json'], true);
            if (is_array($raw)) {
                $records[] = $raw;
            }
        }
        $media = Database::queryAll('SELECT raw_json FROM rel8d_media WHERE tree_id = ? AND deleted_at IS NULL AND raw_json IS NOT NULL AND gedcom_xref IS NOT NULL', [$treeId]);
        foreach ($media as $m) {
            $raw = json_decode((string)$m['raw_json'], true);
            if (is_array($raw)) {
                $records[] = $raw;
            }
        }
        return Rel8dGedcom::buildDocument($records);
    }

    public static function listStories(int $uid): array
    {
        self::ensureSchema();
        $treeId = self::defaultTreeId();
        return Database::queryAll(
            'SELECT n.id, n.title, n.body, n.is_story, n.person_id, n.created_at, p.name_display
             FROM rel8d_notes n
             LEFT JOIN rel8d_people p ON p.id = n.person_id
             WHERE n.tree_id = ? AND n.deleted_at IS NULL AND n.is_story = 1
             ORDER BY n.id DESC LIMIT 200',
            [$treeId]
        );
    }

    public static function listAudit(int $limit = 100): array
    {
        self::ensureSchema();
        $limit = max(1, min(500, $limit));
        return Database::queryAll('SELECT * FROM rel8d_audit_log ORDER BY id DESC LIMIT ' . $limit);
    }

    public static function setRootPerson(int $personId, int $actorUid): void
    {
        $treeId = self::defaultTreeId();
        $p = Database::queryOne('SELECT id FROM rel8d_people WHERE id = ? AND tree_id = ?', [$personId, $treeId]);
        if (!$p) {
            throw new InvalidArgumentException('person not found');
        }
        Database::execute('UPDATE rel8d_trees SET root_person_id = ? WHERE id = ?', [$personId, $treeId]);
        self::audit($actorUid, 'set_root', 'rel8d_trees', $treeId, $personId, null, ['root_person_id' => $personId]);
    }

    public static function findRootCandidate(int $uid): ?int
    {
        $tree = Database::queryOne('SELECT root_person_id FROM rel8d_trees WHERE id = ?', [self::defaultTreeId()]);
        if (!empty($tree['root_person_id'])) {
            $id = (int)$tree['root_person_id'];
            $p = Database::queryOne('SELECT * FROM rel8d_people WHERE id = ?', [$id]);
            if ($p && self::personVisibleTo($p, $uid)) {
                return $id;
            }
        }
        $row = Database::queryOne(
            'SELECT id FROM rel8d_people WHERE tree_id = ? AND deleted_at IS NULL' . self::livingPrivacySql('rel8d_people', $uid) . ' ORDER BY id ASC LIMIT 1',
            [self::defaultTreeId()]
        );
        return $row ? (int)$row['id'] : null;
    }
}
