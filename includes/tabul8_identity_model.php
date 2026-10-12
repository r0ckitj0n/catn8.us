<?php

declare(strict_types=1);

/**
 * Persistent Tabul8 face identities (cross-party).
 * Embeddings encrypted at rest via secret_encrypt; never returned to clients except
 * the short-lived party kiosk pack (session-only, signed).
 */
final class Tabul8IdentityModel
{
    private static bool $schemaEnsured = false;

    /** Canonical embedding model — same ONNX on Compil8r (Python) and browser (onnxruntime-web). */
    /** InsightFace buffalo_s `w600k_mbf.onnx` (MobileFaceNet), 512-d + ArcFace 5-pt align. */
    public const MODEL_NAME = 'mobilefacenet';
    /** Bump when alignment pipeline changes — older embeddings are ignored/replaced. */
    public const MODEL_VERSION = '2.0-arcface';
    public const PIPELINE_ID = 'arcface5';
    public const EMBEDDING_DIMS = 512;
    public const INPUT_SIZE = 112;

    /**
     * Cosine similarity thresholds (L2-normalized, ArcFace-aligned).
     * Tuned from measured same/different gap — see scripts/tabul8/README.md.
     * GREET: show "Hi {name}!" when at/above (greetable identities only).
     * MATCH: accept identity for voting / enrollment link.
     */
    /** Photos-aligned SCRFD: same median ~0.44, diff max ~0.20 → greet 0.40 / match 0.35 */
    public const GREET_THRESHOLD = 0.40;
    public const MATCH_THRESHOLD = 0.35;

    public const SOURCES = ['photos', 'checkin', 'vote', 'manual', 'agent'];

    public const PACK_TTL_SEC = 900;
    public const MAX_EMBEDDINGS_PER_IDENTITY_IN_PACK = 3;

    public static function ensureSchema(): void
    {
        if (self::$schemaEnsured) {
            return;
        }
        require_once __DIR__ . '/celebr8_model.php';
        require_once __DIR__ . '/secret_store.php';
        Celebr8Model::ensureSchema();

        Database::execute("CREATE TABLE IF NOT EXISTS tabul8_identities (
            id INT AUTO_INCREMENT PRIMARY KEY,
            display_name VARCHAR(191) NOT NULL,
            guest_id INT NULL,
            pending_guest_id INT NULL,
            admin_named TINYINT(1) NOT NULL DEFAULT 0,
            source VARCHAR(32) NOT NULL DEFAULT 'manual',
            photos_person_uuid VARCHAR(64) NULL,
            unknown_seq INT NULL,
            notes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_tabul8_ident_guest (guest_id),
            KEY idx_tabul8_ident_name (display_name),
            UNIQUE KEY uniq_tabul8_ident_photos_uuid (photos_person_uuid),
            CONSTRAINT fk_tabul8_ident_guest FOREIGN KEY (guest_id) REFERENCES celebr8_guests(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        Database::execute("CREATE TABLE IF NOT EXISTS tabul8_identity_embeddings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            identity_id INT NOT NULL,
            vector_enc LONGTEXT NOT NULL,
            dims INT NOT NULL DEFAULT 0,
            model_name VARCHAR(64) NOT NULL DEFAULT 'mobilefacenet',
            model_version VARCHAR(32) NOT NULL DEFAULT '1.0',
            quality FLOAT NULL,
            source VARCHAR(32) NOT NULL DEFAULT 'manual',
            source_face_uuid VARCHAR(64) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_tabul8_idemb_identity (identity_id),
            UNIQUE KEY uniq_tabul8_idemb_face (source_face_uuid),
            CONSTRAINT fk_tabul8_idemb_ident FOREIGN KEY (identity_id) REFERENCES tabul8_identities(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        self::ensureColumn('tabul8_identities', 'pending_guest_id', 'INT NULL AFTER guest_id');
        self::ensureColumn('tabul8_identities', 'admin_named', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER pending_guest_id');

        self::$schemaEnsured = true;
    }

    private static function ensureColumn(string $table, string $column, string $ddl): void
    {
        $row = Database::queryOne(
            'SELECT COUNT(*) AS c
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
            [$table, $column]
        );
        if ((int)($row['c'] ?? 0) > 0) {
            return;
        }
        Database::execute("ALTER TABLE `{$table}` ADD COLUMN `{$column}` {$ddl}");
    }

    /** @param array<string,mixed> $row */
    public static function toIdentity(array $row, bool $withCounts = true): array
    {
        $id = (int)($row['id'] ?? 0);
        $guestId = isset($row['guest_id']) && $row['guest_id'] !== null ? (int)$row['guest_id'] : null;
        $pendingGuestId = isset($row['pending_guest_id']) && $row['pending_guest_id'] !== null
            ? (int)$row['pending_guest_id'] : null;
        $adminNamed = (int)($row['admin_named'] ?? 0) === 1 ? 1 : 0;
        $source = (string)($row['source'] ?? 'manual');
        $photosUuid = $row['photos_person_uuid'] !== null ? (string)$row['photos_person_uuid'] : null;
        $greetable = ($guestId !== null && $guestId > 0) || $adminNamed === 1 ? 1 : 0;
        $fromPhotosUnlinked = $photosUuid !== null && $photosUuid !== '' && !$greetable ? 1 : 0;
        $out = [
            'id' => $id,
            'display_name' => (string)($row['display_name'] ?? ''),
            'guest_id' => $guestId,
            'pending_guest_id' => $pendingGuestId,
            'admin_named' => $adminNamed,
            'greetable' => $greetable,
            'from_photos_unlinked' => $fromPhotosUnlinked,
            'label' => $fromPhotosUnlinked
                ? ('From Photos (unlinked): ' . (string)($row['display_name'] ?? ''))
                : (string)($row['display_name'] ?? ''),
            'source' => $source,
            'photos_person_uuid' => $photosUuid,
            'unknown_seq' => isset($row['unknown_seq']) && $row['unknown_seq'] !== null ? (int)$row['unknown_seq'] : null,
            'notes' => (string)($row['notes'] ?? ''),
            'created_at' => (string)($row['created_at'] ?? ''),
            'updated_at' => (string)($row['updated_at'] ?? ''),
        ];
        if ($withCounts && $id > 0) {
            $c = Database::queryOne(
                'SELECT COUNT(*) AS c FROM tabul8_identity_embeddings
                 WHERE identity_id = ? AND model_name = ? AND model_version = ?',
                [$id, self::MODEL_NAME, self::MODEL_VERSION]
            );
            $out['embedding_count'] = (int)($c['c'] ?? 0);
            $old = Database::queryOne(
                'SELECT COUNT(*) AS c FROM tabul8_identity_embeddings
                 WHERE identity_id = ? AND NOT (model_name = ? AND model_version = ?)',
                [$id, self::MODEL_NAME, self::MODEL_VERSION]
            );
            $out['stale_embedding_count'] = (int)($old['c'] ?? 0);
        }
        return $out;
    }

    /** Whether this identity may be greeted by display_name on the kiosk. */
    public static function isGreetable(array $identity): bool
    {
        if (!empty($identity['guest_id'])) {
            return true;
        }
        return !empty($identity['admin_named']);
    }

    public static function getIdentity(int $id): ?array
    {
        self::ensureSchema();
        if ($id <= 0) {
            return null;
        }
        $row = Database::queryOne('SELECT * FROM tabul8_identities WHERE id = ?', [$id]);
        return $row ? self::toIdentity($row) : null;
    }

    /** @return list<array> */
    public static function listIdentities(?int $guestId = null, ?string $q = null, int $limit = 200): array
    {
        self::ensureSchema();
        $limit = max(1, min(1000, $limit));
        $where = ['1=1'];
        $params = [];
        if ($guestId !== null && $guestId > 0) {
            $where[] = 'guest_id = ?';
            $params[] = $guestId;
        }
        if ($q !== null && trim($q) !== '') {
            $where[] = 'display_name LIKE ?';
            $params[] = '%' . trim($q) . '%';
        }
        $sql = 'SELECT * FROM tabul8_identities WHERE ' . implode(' AND ', $where)
            . ' ORDER BY display_name ASC, id ASC LIMIT ' . $limit;
        $rows = Database::queryAll($sql, $params);
        return array_map(static fn (array $r): array => self::toIdentity($r), $rows);
    }

    public static function nextUnknownSeq(): int
    {
        self::ensureSchema();
        $row = Database::queryOne('SELECT MAX(unknown_seq) AS m FROM tabul8_identities');
        return ((int)($row['m'] ?? 0)) + 1;
    }

    /**
     * @param array<string,mixed> $fields
     */
    public static function createIdentity(array $fields): array
    {
        self::ensureSchema();
        $source = strtolower(trim((string)($fields['source'] ?? 'manual')));
        if (!in_array($source, self::SOURCES, true)) {
            $source = 'manual';
        }
        $name = trim((string)($fields['display_name'] ?? ''));
        $unknownSeq = null;
        if ($name === '' || str_starts_with(strtolower($name), 'unknown')) {
            $unknownSeq = isset($fields['unknown_seq']) ? (int)$fields['unknown_seq'] : self::nextUnknownSeq();
            $name = 'Unknown #' . $unknownSeq;
        }
        if (Celebr8Model::isBlockedGuestName($name)) {
            throw new InvalidArgumentException('That name cannot be linked');
        }
        $guestId = isset($fields['guest_id']) && $fields['guest_id'] !== null && $fields['guest_id'] !== ''
            ? (int)$fields['guest_id'] : null;
        if ($guestId !== null && $guestId > 0) {
            $guest = Celebr8Model::getGuest($guestId);
            if (!$guest) {
                throw new InvalidArgumentException('Guest not found');
            }
            if (Celebr8Model::isBlockedGuestName((string)$guest['name'])) {
                throw new InvalidArgumentException('That guest cannot be linked');
            }
        } else {
            $guestId = null;
        }
        $photosUuid = isset($fields['photos_person_uuid']) ? trim((string)$fields['photos_person_uuid']) : '';
        if ($photosUuid === '') {
            $photosUuid = null;
        }
        $pendingGuestId = isset($fields['pending_guest_id']) && $fields['pending_guest_id'] !== null
            && $fields['pending_guest_id'] !== ''
            ? (int)$fields['pending_guest_id'] : null;
        if ($pendingGuestId !== null && $pendingGuestId <= 0) {
            $pendingGuestId = null;
        }
        $adminNamed = !empty($fields['admin_named']) ? 1 : 0;
        // Manual / check-in / agent names from Jon count as explicitly named for greeting.
        if (in_array($source, ['manual', 'checkin', 'agent'], true) && $name !== '' && !str_starts_with(strtolower($name), 'unknown')) {
            $adminNamed = 1;
        }
        Database::execute(
            'INSERT INTO tabul8_identities
                (display_name, guest_id, pending_guest_id, admin_named, source, photos_person_uuid, unknown_seq, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $name,
                $guestId,
                $pendingGuestId,
                $adminNamed,
                $source,
                $photosUuid,
                $unknownSeq,
                trim((string)($fields['notes'] ?? '')),
            ]
        );
        return self::getIdentity((int)Database::lastInsertId());
    }

    /**
     * @param array<string,mixed> $fields
     */
    public static function updateIdentity(int $id, array $fields): array
    {
        self::ensureSchema();
        $existing = self::getIdentity($id);
        if (!$existing) {
            throw new InvalidArgumentException('Identity not found');
        }
        $name = array_key_exists('display_name', $fields)
            ? trim((string)$fields['display_name']) : (string)$existing['display_name'];
        if ($name === '') {
            throw new InvalidArgumentException('display_name required');
        }
        if (Celebr8Model::isBlockedGuestName($name)) {
            throw new InvalidArgumentException('That name cannot be linked');
        }
        $guestId = $existing['guest_id'];
        if (array_key_exists('guest_id', $fields)) {
            if ($fields['guest_id'] === null || $fields['guest_id'] === '') {
                $guestId = null;
            } else {
                $guestId = (int)$fields['guest_id'];
                $guest = Celebr8Model::getGuest($guestId);
                if (!$guest) {
                    throw new InvalidArgumentException('Guest not found');
                }
                if (Celebr8Model::isBlockedGuestName((string)$guest['name'])) {
                    throw new InvalidArgumentException('That guest cannot be linked');
                }
            }
        }
        $notes = array_key_exists('notes', $fields)
            ? trim((string)$fields['notes']) : (string)($existing['notes'] ?? '');
        $pendingGuestId = $existing['pending_guest_id'] ?? null;
        if (array_key_exists('pending_guest_id', $fields)) {
            if ($fields['pending_guest_id'] === null || $fields['pending_guest_id'] === '') {
                $pendingGuestId = null;
            } else {
                $pendingGuestId = (int)$fields['pending_guest_id'];
            }
        }
        $adminNamed = (int)($existing['admin_named'] ?? 0);
        if (array_key_exists('admin_named', $fields)) {
            $adminNamed = !empty($fields['admin_named']) ? 1 : 0;
        }
        // Saving a display name from admin marks the identity as explicitly named (greetable).
        if (array_key_exists('display_name', $fields) && $name !== '' && !str_starts_with(strtolower($name), 'unknown')) {
            $adminNamed = 1;
        }
        // Linking a guest clears pending and enables greeting.
        if ($guestId !== null && $guestId > 0) {
            $pendingGuestId = null;
        }
        Database::execute(
            'UPDATE tabul8_identities
             SET display_name = ?, guest_id = ?, pending_guest_id = ?, admin_named = ?, notes = ?, unknown_seq = NULL
             WHERE id = ?',
            [$name, $guestId, $pendingGuestId, $adminNamed, $notes, $id]
        );
        return self::getIdentity($id);
    }

    /** Confirm a pending Photos→guest link (e.g. Ian Pilsbury). */
    public static function confirmPendingGuestLink(int $identityId, ?int $guestId = null): array
    {
        self::ensureSchema();
        $ident = self::getIdentity($identityId);
        if (!$ident) {
            throw new InvalidArgumentException('Identity not found');
        }
        $gid = $guestId !== null && $guestId > 0
            ? $guestId
            : (int)($ident['pending_guest_id'] ?? 0);
        if ($gid <= 0) {
            throw new InvalidArgumentException('No pending guest to confirm');
        }
        return self::updateIdentity($identityId, [
            'guest_id' => $gid,
            'pending_guest_id' => null,
            'admin_named' => 1,
        ]);
    }

    public static function unlinkGuest(int $identityId): array
    {
        return self::updateIdentity($identityId, [
            'guest_id' => null,
            'pending_guest_id' => null,
        ]);
    }

    public static function mergeIdentities(int $keepId, int $absorbId): array
    {
        self::ensureSchema();
        if ($keepId <= 0 || $absorbId <= 0 || $keepId === $absorbId) {
            throw new InvalidArgumentException('Invalid merge ids');
        }
        $keep = self::getIdentity($keepId);
        $absorb = self::getIdentity($absorbId);
        if (!$keep || !$absorb) {
            throw new InvalidArgumentException('Identity not found');
        }
        Database::execute(
            'UPDATE tabul8_identity_embeddings SET identity_id = ? WHERE identity_id = ?',
            [$keepId, $absorbId]
        );
        Database::execute(
            'UPDATE tabul8_votes SET identity_id = ? WHERE identity_id = ?',
            [$keepId, $absorbId]
        );
        if ($keep['guest_id'] === null && $absorb['guest_id'] !== null) {
            Database::execute(
                'UPDATE tabul8_identities SET guest_id = ? WHERE id = ?',
                [(int)$absorb['guest_id'], $keepId]
            );
        }
        if (
            ($keep['photos_person_uuid'] === null || $keep['photos_person_uuid'] === '')
            && !empty($absorb['photos_person_uuid'])
        ) {
            Database::execute(
                'UPDATE tabul8_identities SET photos_person_uuid = ? WHERE id = ?',
                [(string)$absorb['photos_person_uuid'], $keepId]
            );
        }
        Database::execute('DELETE FROM tabul8_identities WHERE id = ?', [$absorbId]);
        return self::getIdentity($keepId);
    }

    public static function purgeIdentity(int $id): bool
    {
        self::ensureSchema();
        if ($id <= 0) {
            return false;
        }
        Database::execute('UPDATE tabul8_votes SET identity_id = NULL WHERE identity_id = ?', [$id]);
        Database::execute('DELETE FROM tabul8_identities WHERE id = ?', [$id]);
        return true;
    }

    public static function purgeAllIdentities(): int
    {
        self::ensureSchema();
        $row = Database::queryOne('SELECT COUNT(*) AS c FROM tabul8_identities');
        $count = (int)($row['c'] ?? 0);
        Database::execute('UPDATE tabul8_votes SET identity_id = NULL WHERE identity_id IS NOT NULL');
        Database::execute('DELETE FROM tabul8_identity_embeddings');
        Database::execute('DELETE FROM tabul8_identities');
        return $count;
    }

    /**
     * Encrypt and store an embedding. Idempotent when source_face_uuid is set.
     *
     * @param list<float|int> $vector
     * @return array{embedding_id:int,identity_id:int,created:bool}
     */
    public static function addEmbedding(
        int $identityId,
        array $vector,
        string $source = 'manual',
        ?float $quality = null,
        ?string $sourceFaceUuid = null,
        ?string $modelName = null,
        ?string $modelVersion = null
    ): array {
        self::ensureSchema();
        if (!self::getIdentity($identityId)) {
            throw new InvalidArgumentException('Identity not found');
        }
        $source = strtolower(trim($source));
        if (!in_array($source, self::SOURCES, true)) {
            $source = 'manual';
        }
        $faceUuid = $sourceFaceUuid !== null ? trim($sourceFaceUuid) : '';
        $modelName = $modelName !== null && trim($modelName) !== '' ? trim($modelName) : self::MODEL_NAME;
        $modelVersion = $modelVersion !== null && trim($modelVersion) !== '' ? trim($modelVersion) : self::MODEL_VERSION;
        if ($faceUuid !== '') {
            $existing = Database::queryOne(
                'SELECT id, identity_id, model_name, model_version FROM tabul8_identity_embeddings
                 WHERE source_face_uuid = ?',
                [$faceUuid]
            );
            if ($existing) {
                $samePipeline = (string)$existing['model_name'] === $modelName
                    && (string)$existing['model_version'] === $modelVersion;
                if ($samePipeline) {
                    return [
                        'embedding_id' => (int)$existing['id'],
                        'identity_id' => (int)$existing['identity_id'],
                        'created' => false,
                        'replaced' => false,
                    ];
                }
                // Old unaligned / different pipeline — replace in place.
                Database::execute('DELETE FROM tabul8_identity_embeddings WHERE id = ?', [(int)$existing['id']]);
            }
        }
        $norm = self::normalizeVector($vector);
        $enc = secret_encrypt((string)json_encode($norm, JSON_UNESCAPED_UNICODE));
        if (!is_string($enc) || $enc === '') {
            throw new RuntimeException('Failed to encrypt embedding');
        }
        Database::execute(
            'INSERT INTO tabul8_identity_embeddings
                (identity_id, vector_enc, dims, model_name, model_version, quality, source, source_face_uuid)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $identityId,
                $enc,
                count($norm),
                $modelName,
                $modelVersion,
                $quality,
                $source,
                $faceUuid !== '' ? $faceUuid : null,
            ]
        );
        return [
            'embedding_id' => (int)Database::lastInsertId(),
            'identity_id' => $identityId,
            'created' => true,
            'replaced' => $faceUuid !== '',
        ];
    }

    /**
     * Upsert identity by Photos person uuid or display name, then add embeddings.
     * Skips JT Whetstone. Idempotent on source_face_uuid.
     *
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public static function upsertIdentityEmbeddings(array $payload): array
    {
        self::ensureSchema();
        $name = trim((string)($payload['display_name'] ?? $payload['name'] ?? ''));
        if ($name === '') {
            throw new InvalidArgumentException('display_name required');
        }
        if (Celebr8Model::isBlockedGuestName($name)) {
            return [
                'skipped' => true,
                'reason' => 'blocked_name',
                'display_name' => $name,
            ];
        }
        $photosUuid = trim((string)($payload['photos_person_uuid'] ?? $payload['person_uuid'] ?? ''));
        $partyId = (int)($payload['party_id'] ?? 0);
        $guestId = isset($payload['guest_id']) && $payload['guest_id'] !== '' && $payload['guest_id'] !== null
            ? (int)$payload['guest_id'] : null;
        $pendingGuestId = isset($payload['pending_guest_id']) && $payload['pending_guest_id'] !== ''
            && $payload['pending_guest_id'] !== null
            ? (int)$payload['pending_guest_id'] : null;
        $matchInfo = null;

        $identity = null;
        if ($photosUuid !== '') {
            $row = Database::queryOne(
                'SELECT * FROM tabul8_identities WHERE photos_person_uuid = ?',
                [$photosUuid]
            );
            if ($row) {
                $identity = self::toIdentity($row);
            }
        }
        if (!$identity) {
            // Prefer explicit guest_id / pending from Compil8r; else run server match.
            if ($guestId === null && $pendingGuestId === null) {
                $linked = self::matchNameToGuest($name, $partyId > 0 ? $partyId : null);
                $matchInfo = $linked;
                if (($linked['status'] ?? '') === 'exact') {
                    $guestId = (int)$linked['guest_id'];
                } elseif (($linked['status'] ?? '') === 'fuzzy') {
                    // Fuzzy → pending admin confirm (never auto-greet).
                    $pendingGuestId = (int)$linked['guest_id'];
                    $guestId = null;
                } elseif (($linked['status'] ?? '') === 'ambiguous') {
                    $guestId = null;
                }
            }
            if ($guestId && Celebr8Model::isBlockedGuestName(
                (string)(Celebr8Model::getGuest($guestId)['name'] ?? '')
            )) {
                $guestId = null;
            }
            $identity = self::createIdentity([
                'display_name' => $name,
                'guest_id' => $guestId,
                'pending_guest_id' => $pendingGuestId,
                'admin_named' => 0,
                'source' => 'photos',
                'photos_person_uuid' => $photosUuid !== '' ? $photosUuid : null,
            ]);
        } else {
            $patch = [];
            if ($identity['guest_id'] === null && $guestId) {
                $patch['guest_id'] = $guestId;
            }
            if (empty($identity['pending_guest_id']) && $pendingGuestId && empty($identity['guest_id'])) {
                $patch['pending_guest_id'] = $pendingGuestId;
            }
            if ($patch !== []) {
                $identity = self::updateIdentity((int)$identity['id'], $patch);
            }
        }

        $embeddings = $payload['embeddings'] ?? [];
        if (!is_array($embeddings)) {
            $embeddings = [];
        }
        $added = 0;
        $skipped = 0;
        foreach ($embeddings as $emb) {
            if (!is_array($emb)) {
                continue;
            }
            $vector = $emb['vector'] ?? $emb['embedding'] ?? null;
            if (!is_array($vector)) {
                continue;
            }
            $faceUuid = isset($emb['source_face_uuid']) ? (string)$emb['source_face_uuid']
                : (isset($emb['face_uuid']) ? (string)$emb['face_uuid'] : null);
            $quality = isset($emb['quality']) ? (float)$emb['quality'] : null;
            $res = self::addEmbedding(
                (int)$identity['id'],
                $vector,
                'photos',
                $quality,
                $faceUuid,
                isset($emb['model_name']) ? (string)$emb['model_name'] : self::MODEL_NAME,
                isset($emb['model_version']) ? (string)$emb['model_version'] : self::MODEL_VERSION
            );
            if (!empty($res['created'])) {
                $added++;
            } else {
                $skipped++;
            }
        }

        return [
            'skipped' => false,
            'identity' => self::getIdentity((int)$identity['id']),
            'guest_match' => $matchInfo,
            'embeddings_added' => $added,
            'embeddings_deduped' => $skipped,
        ];
    }

    /**
     * Match Photos/display name to Celebr8 guest. Never guesses on ambiguous.
     * Never links JT Whetstone.
     *
     * @return array{status:string,guest_id?:int,guest_name?:string,candidates?:list<array>}
     */
    public static function matchNameToGuest(string $name, ?int $partyId = null): array
    {
        require_once __DIR__ . '/celebr8_model.php';
        $name = trim($name);
        if ($name === '' || Celebr8Model::isBlockedGuestName($name)) {
            return ['status' => 'blocked'];
        }
        $norm = self::normalizePersonName($name);
        $guests = [];
        if ($partyId !== null && $partyId > 0) {
            $guests = Celebr8Model::listGuests($partyId);
        } else {
            // Fall back: search recent events' guests is expensive; require party for fuzzy.
            return ['status' => 'no_party'];
        }
        $takenGuestIds = [];
        $linkedRows = Database::queryAll(
            'SELECT DISTINCT guest_id FROM tabul8_identities WHERE guest_id IS NOT NULL AND guest_id > 0'
        );
        foreach ($linkedRows as $lr) {
            $takenGuestIds[(int)$lr['guest_id']] = true;
        }

        $exact = [];
        $fuzzy = [];
        foreach ($guests as $g) {
            $gName = (string)($g['name'] ?? '');
            if ($gName === '' || Celebr8Model::isBlockedGuestName($gName)) {
                continue;
            }
            $gid = (int)($g['id'] ?? 0);
            $gNorm = self::normalizePersonName($gName);
            if ($gNorm === $norm) {
                $exact[] = $g;
                continue;
            }
            // Never fuzzy-propose a guest who already has an exact/confirmed identity link.
            if ($gid > 0 && isset($takenGuestIds[$gid])) {
                continue;
            }
            $score = Celebr8Model::fuzzyFirstLastScore($norm, $gNorm);
            if ($score !== null && $score >= 85.0) {
                $fuzzy[] = ['guest' => $g, 'score' => $score];
            }
        }
        if (count($exact) === 1) {
            return [
                'status' => 'exact',
                'guest_id' => (int)$exact[0]['id'],
                'guest_name' => (string)$exact[0]['name'],
            ];
        }
        if (count($exact) > 1) {
            return [
                'status' => 'ambiguous',
                'candidates' => array_map(static fn ($g) => [
                    'guest_id' => (int)$g['id'],
                    'guest_name' => (string)$g['name'],
                ], $exact),
            ];
        }
        usort($fuzzy, static fn ($a, $b) => $b['score'] <=> $a['score']);
        if (count($fuzzy) === 1 && $fuzzy[0]['score'] >= 88.0) {
            $g = $fuzzy[0]['guest'];
            return [
                'status' => 'fuzzy',
                'guest_id' => (int)$g['id'],
                'guest_name' => (string)$g['name'],
                'score' => $fuzzy[0]['score'],
            ];
        }
        if (count($fuzzy) > 0) {
            return [
                'status' => 'ambiguous',
                'candidates' => array_map(static fn ($f) => [
                    'guest_id' => (int)$f['guest']['id'],
                    'guest_name' => (string)$f['guest']['name'],
                    'score' => $f['score'],
                ], array_slice($fuzzy, 0, 5)),
            ];
        }
        return ['status' => 'unmatched'];
    }

    public static function normalizePersonName(string $name): string
    {
        $n = strtolower(trim(preg_replace('/\s+/', ' ', $name) ?? ''));
        $n = preg_replace('/[^a-z0-9 ]/', '', $n) ?? $n;
        return trim($n);
    }

    private static function tokenOverlap(string $a, string $b): float
    {
        $ta = array_filter(explode(' ', $a));
        $tb = array_filter(explode(' ', $b));
        if ($ta === [] || $tb === []) {
            return 0.0;
        }
        $inter = count(array_intersect($ta, $tb));
        return $inter / max(count($ta), count($tb));
    }

    /**
     * @param list<float|int> $vector
     * @return list<float>
     */
    public static function normalizeVector(array $vector): array
    {
        $out = [];
        foreach ($vector as $v) {
            if (!is_numeric($v)) {
                continue;
            }
            $out[] = (float)$v;
        }
        $n = count($out);
        if ($n < 64 || $n > 1024) {
            throw new InvalidArgumentException('Invalid embedding dimensions');
        }
        $sum = 0.0;
        foreach ($out as $v) {
            $sum += $v * $v;
        }
        $norm = sqrt($sum);
        if ($norm < 1e-12) {
            throw new InvalidArgumentException('Zero embedding');
        }
        foreach ($out as $i => $v) {
            $out[$i] = $v / $norm;
        }
        return $out;
    }

    /**
     * @param list<float> $a
     * @param list<float> $b
     */
    public static function cosineSimilarity(array $a, array $b): float
    {
        $n = min(count($a), count($b));
        if ($n <= 0) {
            return 0.0;
        }
        $dot = 0.0;
        for ($i = 0; $i < $n; $i++) {
            $dot += $a[$i] * $b[$i];
        }
        return $dot;
    }

    /**
     * Match a probe embedding against the persistent store.
     *
     * @param list<float|int> $vector
     * @return array{matched:bool,identity:?array,similarity:float,threshold:float,embedding_id:?int}
     */
    public static function matchEmbedding(array $vector, ?float $threshold = null): array
    {
        self::ensureSchema();
        $thresh = $threshold ?? self::MATCH_THRESHOLD;
        $probe = self::normalizeVector($vector);
        $rows = Database::queryAll(
            'SELECT e.id AS embedding_id, e.identity_id, e.vector_enc, i.display_name, i.guest_id, i.source,
                    i.admin_named, i.pending_guest_id
             FROM tabul8_identity_embeddings e
             INNER JOIN tabul8_identities i ON i.id = e.identity_id
             WHERE e.model_name = ? AND e.model_version = ?',
            [self::MODEL_NAME, self::MODEL_VERSION]
        );
        $bestSim = -1.0;
        $best = null;
        foreach ($rows as $row) {
            $plain = secret_decrypt((string)$row['vector_enc']);
            if (!is_string($plain) || $plain === '') {
                continue;
            }
            $decoded = json_decode($plain, true);
            if (!is_array($decoded)) {
                continue;
            }
            try {
                $other = self::normalizeVector($decoded);
            } catch (Throwable $e) {
                continue;
            }
            $sim = self::cosineSimilarity($probe, $other);
            if ($sim > $bestSim) {
                $bestSim = $sim;
                $best = $row;
            }
        }
        $matched = $best !== null && $bestSim >= $thresh;
        return [
            'matched' => $matched,
            'identity' => $matched ? [
                'id' => (int)$best['identity_id'],
                'display_name' => (string)$best['display_name'],
                'guest_id' => $best['guest_id'] !== null ? (int)$best['guest_id'] : null,
                'source' => (string)$best['source'],
            ] : null,
            'similarity' => round($bestSim, 4),
            'threshold' => $thresh,
            'embedding_id' => $matched ? (int)$best['embedding_id'] : null,
        ];
    }

    /**
     * Resolve or create identity for a vote embedding.
     *
     * @param list<float|int> $vector
     * @return array{identity:array,similarity:float,created:bool}
     */
    public static function resolveIdentityForVote(array $vector): array
    {
        $match = self::matchEmbedding($vector, self::MATCH_THRESHOLD);
        if ($match['matched'] && $match['identity']) {
            return [
                'identity' => $match['identity'],
                'similarity' => (float)$match['similarity'],
                'created' => false,
            ];
        }
        $created = self::createIdentity(['source' => 'vote', 'display_name' => '']);
        self::addEmbedding((int)$created['id'], $vector, 'vote', null, null);
        return [
            'identity' => [
                'id' => (int)$created['id'],
                'display_name' => (string)$created['display_name'],
                'guest_id' => $created['guest_id'],
                'source' => 'vote',
            ],
            'similarity' => (float)$match['similarity'],
            'created' => true,
        ];
    }

    /**
     * Short-lived pack of party-linked identity embeddings for kiosk browser match.
     * Admin/kiosk session only — never for anonymous clients.
     *
     * @return array<string,mixed>
     */
    public static function partyIdentityPack(int $partyId, ?int $ttlSec = null): array
    {
        self::ensureSchema();
        require_once __DIR__ . '/celebr8_model.php';
        if ($partyId <= 0 || !Celebr8Model::getEvent($partyId)) {
            throw new InvalidArgumentException('Party not found');
        }
        $ttl = $ttlSec !== null ? max(60, min(3600, $ttlSec)) : self::PACK_TTL_SEC;
        $guests = Celebr8Model::listGuests($partyId);
        $guestIds = [];
        foreach ($guests as $g) {
            if (Celebr8Model::isBlockedGuestName((string)($g['name'] ?? ''))) {
                continue;
            }
            $guestIds[] = (int)$g['id'];
        }
        // Greet pack: ONLY identities linked to a Celebr8 guest OR explicitly named by admin.
        // Unlinked Photos persons (Dad/Mom/pets/places) must never be greeted by that name.
        $rows = Database::queryAll(
            'SELECT * FROM tabul8_identities
             WHERE (guest_id IS NOT NULL AND guest_id > 0) OR admin_named = 1
             ORDER BY display_name ASC
             LIMIT 400'
        );
        $identities = [];
        $seen = [];
        foreach ($rows as $row) {
            $ident = self::toIdentity($row, false);
            // Prefer party guests when guest-linked.
            if (!empty($ident['guest_id']) && $guestIds !== [] && !in_array((int)$ident['guest_id'], $guestIds, true)) {
                // Still greetable if admin_named, or guest from another party — allow admin_named.
                if (empty($ident['admin_named'])) {
                    continue;
                }
            }
            $seen[(int)$ident['id']] = true;
            $identities[] = $ident;
        }

        $packIdentities = [];
        foreach ($identities as $ident) {
            if (!self::isGreetable($ident)) {
                continue;
            }
            $embRows = Database::queryAll(
                'SELECT id, vector_enc, quality FROM tabul8_identity_embeddings
                 WHERE identity_id = ? AND model_name = ? AND model_version = ?
                 ORDER BY (quality IS NULL), quality DESC, id DESC
                 LIMIT ' . self::MAX_EMBEDDINGS_PER_IDENTITY_IN_PACK,
                [(int)$ident['id'], self::MODEL_NAME, self::MODEL_VERSION]
            );
            $vectors = [];
            foreach ($embRows as $er) {
                $plain = secret_decrypt((string)$er['vector_enc']);
                if (!is_string($plain)) {
                    continue;
                }
                $decoded = json_decode($plain, true);
                if (!is_array($decoded)) {
                    continue;
                }
                try {
                    $vectors[] = self::normalizeVector($decoded);
                } catch (Throwable $e) {
                    continue;
                }
            }
            if ($vectors === []) {
                continue;
            }
            $packIdentities[] = [
                'identity_id' => (int)$ident['id'],
                'display_name' => (string)$ident['display_name'],
                'guest_id' => $ident['guest_id'],
                'admin_named' => (int)($ident['admin_named'] ?? 0),
                'greetable' => 1,
                'embeddings' => $vectors,
            ];
        }

        $exp = time() + $ttl;
        $payload = [
            'party_id' => $partyId,
            'exp' => $exp,
            'model_name' => self::MODEL_NAME,
            'model_version' => self::MODEL_VERSION,
            'greet_threshold' => self::GREET_THRESHOLD,
            'match_threshold' => self::MATCH_THRESHOLD,
            'identities' => $packIdentities,
        ];
        $sig = self::signPack($partyId, $exp, count($packIdentities));
        $payload['sig'] = $sig;
        return $payload;
    }

    public static function signPack(int $partyId, int $exp, int $count): string
    {
        require_once __DIR__ . '/celebr8_album_model.php';
        return hash_hmac(
            'sha256',
            'tabul8_pack|' . $partyId . '|' . $exp . '|' . $count,
            Celebr8AlbumModel::signingKey()
        );
    }

    /**
     * Check-in: enroll embedding under guest or Unknown.
     *
     * @param list<float|int> $vector
     * @return array<string,mixed>
     */
    public static function checkInEnroll(
        int $partyId,
        array $vector,
        ?int $guestId = null,
        ?string $displayName = null
    ): array {
        self::ensureSchema();
        require_once __DIR__ . '/celebr8_model.php';
        if ($partyId <= 0 || !Celebr8Model::getEvent($partyId)) {
            throw new InvalidArgumentException('Party not found');
        }
        $match = self::matchEmbedding($vector, self::MATCH_THRESHOLD);
        if ($match['matched'] && $match['identity']) {
            $id = (int)$match['identity']['id'];
            if ($guestId && empty($match['identity']['guest_id'])) {
                self::updateIdentity($id, ['guest_id' => $guestId]);
            }
            if ($displayName !== null && trim($displayName) !== '') {
                self::updateIdentity($id, ['display_name' => trim($displayName)]);
            }
            self::addEmbedding($id, $vector, 'checkin', null, null);
            return [
                'created' => false,
                'identity' => self::getIdentity($id),
                'similarity' => $match['similarity'],
            ];
        }
        $name = $displayName !== null ? trim($displayName) : '';
        if ($guestId) {
            $guest = Celebr8Model::getGuest($guestId);
            if (!$guest || (int)$guest['event_id'] !== $partyId) {
                throw new InvalidArgumentException('Guest not on this party');
            }
            if (Celebr8Model::isBlockedGuestName((string)$guest['name'])) {
                throw new InvalidArgumentException('That guest cannot be enrolled');
            }
            $name = $name !== '' ? $name : (string)$guest['name'];
        }
        $identity = self::createIdentity([
            'display_name' => $name,
            'guest_id' => $guestId,
            'source' => 'checkin',
        ]);
        self::addEmbedding((int)$identity['id'], $vector, 'checkin', null, null);
        return [
            'created' => true,
            'identity' => $identity,
            'similarity' => $match['similarity'],
        ];
    }
}
