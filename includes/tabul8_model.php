<?php

declare(strict_types=1);

/**
 * Tabul8 — live party voting (categories, camera entries, face-deduped votes).
 */
final class Tabul8Model
{
    private static bool $schemaEnsured = false;

    /** Cosine similarity at/above this → treat as same face (party-grade). */
    public const FACE_SIMILARITY_THRESHOLD = 0.82;

    public const EMBEDDING_DIMS_MIN = 64;
    public const EMBEDDING_DIMS_MAX = 512;

    /** @deprecated use DEFAULT_CONTESTS — kept for older call sites */
    public const DEFAULT_CATEGORIES = [
        'Scariest',
        'Funniest',
        'Most Creative',
        'Best Chili',
    ];

    /** Default party contests (replaces flat "categories" concept). */
    public const DEFAULT_CONTESTS = [
        ['name' => 'Scariest', 'contest_type' => 'costume'],
        ['name' => 'Funniest', 'contest_type' => 'costume'],
        ['name' => 'Most Creative', 'contest_type' => 'costume'],
        ['name' => 'Best Chili', 'contest_type' => 'chili'],
    ];

    public const CONTEST_TYPES = ['costume', 'chili', 'dish', 'custom'];
    public const ENTRY_KINDS = ['person', 'thing'];

    public const VOTE_TOKEN_BYTES = 24; // → 32-char hex-ish url-safe
    public const DEVICE_TOKEN_MAX = 64;
    public const RATE_LIMIT_PER_HOUR = 40;

    /** Default TTL for phone/QR vote links (seconds). */
    public const PHONE_VOTE_TTL_SEC = 900;

    public static function ensureSchema(): void
    {
        if (self::$schemaEnsured) {
            return;
        }

        require_once __DIR__ . '/celebr8_model.php';
        Celebr8Model::ensureSchema();

        Database::execute("CREATE TABLE IF NOT EXISTS tabul8_boards (
            id INT AUTO_INCREMENT PRIMARY KEY,
            party_id INT NOT NULL,
            vote_token VARCHAR(64) NOT NULL,
            voting_open TINYINT(1) NOT NULL DEFAULT 0,
            phone_voting_open TINYINT(1) NOT NULL DEFAULT 0,
            show_bars TINYINT(1) NOT NULL DEFAULT 1,
            reveal_winners TINYINT(1) NOT NULL DEFAULT 0,
            results_json LONGTEXT NULL,
            results_saved_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_tabul8_boards_party (party_id),
            UNIQUE KEY uniq_tabul8_boards_token (vote_token),
            CONSTRAINT fk_tabul8_boards_party FOREIGN KEY (party_id) REFERENCES celebr8_events(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        Database::execute("CREATE TABLE IF NOT EXISTS tabul8_categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            board_id INT NOT NULL,
            party_id INT NOT NULL,
            name VARCHAR(128) NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            voting_open TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_tabul8_cat_board (board_id, sort_order, id),
            KEY idx_tabul8_cat_party (party_id),
            CONSTRAINT fk_tabul8_cat_board FOREIGN KEY (board_id) REFERENCES tabul8_boards(id) ON DELETE CASCADE,
            CONSTRAINT fk_tabul8_cat_party FOREIGN KEY (party_id) REFERENCES celebr8_events(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        Database::execute("CREATE TABLE IF NOT EXISTS tabul8_entries (
            id INT AUTO_INCREMENT PRIMARY KEY,
            board_id INT NOT NULL,
            party_id INT NOT NULL,
            category_id INT NOT NULL,
            label VARCHAR(191) NOT NULL DEFAULT '',
            description TEXT NULL,
            photo_id INT NULL,
            guest_id INT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            label_request_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_tabul8_ent_cat (category_id, sort_order, id),
            KEY idx_tabul8_ent_board (board_id, id),
            KEY idx_tabul8_ent_party (party_id),
            CONSTRAINT fk_tabul8_ent_board FOREIGN KEY (board_id) REFERENCES tabul8_boards(id) ON DELETE CASCADE,
            CONSTRAINT fk_tabul8_ent_cat FOREIGN KEY (category_id) REFERENCES tabul8_categories(id) ON DELETE CASCADE,
            CONSTRAINT fk_tabul8_ent_party FOREIGN KEY (party_id) REFERENCES celebr8_events(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        Database::execute("CREATE TABLE IF NOT EXISTS tabul8_embeddings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            board_id INT NOT NULL,
            party_id INT NOT NULL,
            category_id INT NOT NULL,
            vector_json LONGTEXT NOT NULL,
            dims INT NOT NULL DEFAULT 0,
            guest_id INT NULL,
            device_token VARCHAR(64) NOT NULL DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_tabul8_emb_cat (category_id, id),
            KEY idx_tabul8_emb_party (party_id, id),
            KEY idx_tabul8_emb_board (board_id, id),
            CONSTRAINT fk_tabul8_emb_board FOREIGN KEY (board_id) REFERENCES tabul8_boards(id) ON DELETE CASCADE,
            CONSTRAINT fk_tabul8_emb_cat FOREIGN KEY (category_id) REFERENCES tabul8_categories(id) ON DELETE CASCADE,
            CONSTRAINT fk_tabul8_emb_party FOREIGN KEY (party_id) REFERENCES celebr8_events(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        Database::execute("CREATE TABLE IF NOT EXISTS tabul8_votes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            board_id INT NOT NULL,
            party_id INT NOT NULL,
            category_id INT NOT NULL,
            entry_id INT NOT NULL,
            embedding_id INT NULL,
            identity_id INT NULL,
            device_token VARCHAR(64) NOT NULL DEFAULT '',
            guest_id INT NULL,
            ip_hash CHAR(64) NOT NULL DEFAULT '',
            is_void TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_tabul8_votes_cat (category_id, is_void, id),
            KEY idx_tabul8_votes_entry (entry_id, is_void),
            KEY idx_tabul8_votes_board (board_id, id),
            KEY idx_tabul8_votes_device (category_id, device_token),
            KEY idx_tabul8_votes_identity (identity_id),
            CONSTRAINT fk_tabul8_votes_board FOREIGN KEY (board_id) REFERENCES tabul8_boards(id) ON DELETE CASCADE,
            CONSTRAINT fk_tabul8_votes_cat FOREIGN KEY (category_id) REFERENCES tabul8_categories(id) ON DELETE CASCADE,
            CONSTRAINT fk_tabul8_votes_entry FOREIGN KEY (entry_id) REFERENCES tabul8_entries(id) ON DELETE CASCADE,
            CONSTRAINT fk_tabul8_votes_party FOREIGN KEY (party_id) REFERENCES celebr8_events(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        // Additive migrations for boards created before Addendum 2 / 3 / 4.
        self::ensureColumn('tabul8_boards', 'phone_voting_open', 'TINYINT(1) NOT NULL DEFAULT 0 AFTER voting_open');
        self::ensureColumn('tabul8_votes', 'identity_id', 'INT NULL AFTER embedding_id');
        self::ensureColumn('tabul8_votes', 'match_confidence', 'FLOAT NULL AFTER identity_id');
        self::ensureIndex('tabul8_votes', 'idx_tabul8_votes_identity', '(identity_id)');
        // Contests = categories + type (table kept for FK stability).
        self::ensureColumn('tabul8_categories', 'contest_type', "VARCHAR(32) NOT NULL DEFAULT 'costume' AFTER name");
        self::ensureColumn('tabul8_entries', 'entry_kind', "VARCHAR(32) NOT NULL DEFAULT 'person' AFTER label");
        self::ensureColumn('tabul8_entries', 'owner_guest_id', 'INT NULL AFTER guest_id');
        self::backfillContestTypes();

        require_once __DIR__ . '/tabul8_identity_model.php';
        Tabul8IdentityModel::ensureSchema();

        self::$schemaEnsured = true;
        // Persistent identities are NEVER auto-deleted. Legacy party-scoped
        // tabul8_embeddings rows (pre-identity) may still be cleaned after party+7d.
        self::purgeExpiredFaceData();
    }

    private static function backfillContestTypes(): void
    {
        try {
            Database::execute(
                "UPDATE tabul8_categories SET contest_type = 'chili'
                 WHERE contest_type = 'costume' AND LOWER(name) LIKE '%chili%'"
            );
            Database::execute(
                "UPDATE tabul8_categories SET contest_type = 'dish'
                 WHERE contest_type = 'costume'
                   AND (LOWER(name) LIKE '%dish%' OR LOWER(name) LIKE '%cook%' OR LOWER(name) LIKE '%food%')
                   AND LOWER(name) NOT LIKE '%chili%'"
            );
        } catch (Throwable $e) {
            // ignore on fresh installs
        }
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

    private static function ensureIndex(string $table, string $indexName, string $columnsSql): void
    {
        $row = Database::queryOne(
            'SELECT COUNT(*) AS c
             FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?',
            [$table, $indexName]
        );
        if ((int)($row['c'] ?? 0) > 0) {
            return;
        }
        Database::execute("ALTER TABLE `{$table}` ADD KEY `{$indexName}` {$columnsSql}");
    }

    public static function makeVoteToken(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(self::VOTE_TOKEN_BYTES)), '+/', '-_'), '=');
    }

    /**
     * Ensure a board exists for the party; seed default categories on first create.
     *
     * @return array{board:array,categories:list<array>,created:bool}
     */
    public static function ensureBoard(int $partyId): array
    {
        self::ensureSchema();
        if ($partyId <= 0 || !Celebr8Model::getEvent($partyId)) {
            throw new InvalidArgumentException('Party not found');
        }

        $row = Database::queryOne('SELECT * FROM tabul8_boards WHERE party_id = ?', [$partyId]);
        $created = false;
        if (!$row) {
            $token = self::makeVoteToken();
            Database::execute(
                'INSERT INTO tabul8_boards (party_id, vote_token, voting_open, show_bars, reveal_winners)
                 VALUES (?, ?, 0, 1, 0)',
                [$partyId, $token]
            );
            $boardId = (int)Database::lastInsertId();
            $sort = 0;
            foreach (self::DEFAULT_CONTESTS as $c) {
                Database::execute(
                    'INSERT INTO tabul8_categories (board_id, party_id, name, contest_type, sort_order, voting_open)
                     VALUES (?, ?, ?, ?, ?, 0)',
                    [$boardId, $partyId, $c['name'], $c['contest_type'], $sort]
                );
                $sort++;
            }
            $created = true;
            $row = Database::queryOne('SELECT * FROM tabul8_boards WHERE id = ?', [$boardId]);
        }

        $board = self::toBoard($row);
        $cats = self::listCategories((int)$board['id']);
        if ($cats === []) {
            $sort = 0;
            foreach (self::DEFAULT_CONTESTS as $c) {
                Database::execute(
                    'INSERT INTO tabul8_categories (board_id, party_id, name, contest_type, sort_order, voting_open)
                     VALUES (?, ?, ?, ?, ?, 0)',
                    [(int)$board['id'], $partyId, $c['name'], $c['contest_type'], $sort]
                );
                $sort++;
            }
            $cats = self::listCategories((int)$board['id']);
            $created = true;
        }

        return [
            'board' => $board,
            'categories' => $cats,
            'contests' => $cats,
            'created' => $created,
        ];
    }

    /** @param array<string,mixed> $row */
    public static function toBoard(array $row): array
    {
        $results = null;
        $raw = $row['results_json'] ?? null;
        if (is_string($raw) && $raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $results = $decoded;
            }
        }
        return [
            'id' => (int)($row['id'] ?? 0),
            'party_id' => (int)($row['party_id'] ?? 0),
            'vote_token' => (string)($row['vote_token'] ?? ''),
            'voting_open' => (int)($row['voting_open'] ?? 0),
            'phone_voting_open' => (int)($row['phone_voting_open'] ?? 0),
            'show_bars' => (int)($row['show_bars'] ?? 1),
            'reveal_winners' => (int)($row['reveal_winners'] ?? 0),
            'results' => $results,
            'results_saved_at' => $row['results_saved_at'] !== null ? (string)$row['results_saved_at'] : null,
            'kiosk_vote_path' => '/tabul8/party/' . (int)($row['party_id'] ?? 0) . '/vote',
            'vote_url_path' => '/tabul8/vote/' . rawurlencode((string)($row['vote_token'] ?? '')),
            'created_at' => (string)($row['created_at'] ?? ''),
            'updated_at' => (string)($row['updated_at'] ?? ''),
        ];
    }

    /** @param array<string,mixed> $row */
    public static function toCategory(array $row): array
    {
        $type = strtolower(trim((string)($row['contest_type'] ?? 'costume')));
        if (!in_array($type, self::CONTEST_TYPES, true)) {
            $type = 'costume';
        }
        return [
            'id' => (int)($row['id'] ?? 0),
            'board_id' => (int)($row['board_id'] ?? 0),
            'party_id' => (int)($row['party_id'] ?? 0),
            'name' => (string)($row['name'] ?? ''),
            'contest_type' => $type,
            // Alias for Addendum 4 clients
            'type' => $type,
            'sort_order' => (int)($row['sort_order'] ?? 0),
            'voting_open' => (int)($row['voting_open'] ?? 0),
            'created_at' => (string)($row['created_at'] ?? ''),
            'updated_at' => (string)($row['updated_at'] ?? ''),
        ];
    }

    /** Alias — contests are stored in tabul8_categories. */
    public static function toContest(array $row): array
    {
        return self::toCategory($row);
    }

    /** @return list<array> */
    public static function listContests(int $boardId): array
    {
        return self::listCategories($boardId);
    }

    /** @param array<string,mixed> $row */
    public static function toEntry(array $row, bool $withPhotoUrl = true): array
    {
        $photoId = isset($row['photo_id']) && $row['photo_id'] !== null ? (int)$row['photo_id'] : null;
        $kind = strtolower(trim((string)($row['entry_kind'] ?? 'person')));
        if (!in_array($kind, self::ENTRY_KINDS, true)) {
            $kind = 'person';
        }
        $out = [
            'id' => (int)($row['id'] ?? 0),
            'board_id' => (int)($row['board_id'] ?? 0),
            'party_id' => (int)($row['party_id'] ?? 0),
            'category_id' => (int)($row['category_id'] ?? 0),
            'contest_id' => (int)($row['category_id'] ?? 0),
            'label' => (string)($row['label'] ?? ''),
            'entry_kind' => $kind,
            'description' => (string)($row['description'] ?? ''),
            'photo_id' => $photoId && $photoId > 0 ? $photoId : null,
            'guest_id' => isset($row['guest_id']) && $row['guest_id'] !== null ? (int)$row['guest_id'] : null,
            'owner_guest_id' => isset($row['owner_guest_id']) && $row['owner_guest_id'] !== null
                ? (int)$row['owner_guest_id'] : null,
            'sort_order' => (int)($row['sort_order'] ?? 0),
            'label_request_id' => isset($row['label_request_id']) && $row['label_request_id'] !== null
                ? (int)$row['label_request_id'] : null,
            'vote_count' => isset($row['vote_count']) ? (int)$row['vote_count'] : null,
            'created_at' => (string)($row['created_at'] ?? ''),
            'updated_at' => (string)($row['updated_at'] ?? ''),
        ];
        if ($withPhotoUrl && $photoId && $photoId > 0) {
            require_once __DIR__ . '/celebr8_album_model.php';
            $out['photo_url'] = Celebr8AlbumModel::signedPhotoUrl($photoId, 'web');
            $out['photo_thumb_url'] = Celebr8AlbumModel::signedPhotoUrl($photoId, 'thumb');
        }
        return $out;
    }

    public static function getBoard(int $boardId): ?array
    {
        self::ensureSchema();
        $row = Database::queryOne('SELECT * FROM tabul8_boards WHERE id = ?', [$boardId]);
        return $row ? self::toBoard($row) : null;
    }

    public static function getBoardByParty(int $partyId): ?array
    {
        self::ensureSchema();
        $row = Database::queryOne('SELECT * FROM tabul8_boards WHERE party_id = ?', [$partyId]);
        return $row ? self::toBoard($row) : null;
    }

    public static function getBoardByToken(string $token): ?array
    {
        self::ensureSchema();
        $token = trim($token);
        if ($token === '' || strlen($token) < 16) {
            return null;
        }
        $row = Database::queryOne('SELECT * FROM tabul8_boards WHERE vote_token = ?', [$token]);
        return $row ? self::toBoard($row) : null;
    }

    /** @return list<array> */
    public static function listCategories(int $boardId): array
    {
        self::ensureSchema();
        $rows = Database::queryAll(
            'SELECT * FROM tabul8_categories WHERE board_id = ? ORDER BY sort_order ASC, id ASC',
            [$boardId]
        );
        return array_map(static fn (array $r): array => self::toCategory($r), $rows);
    }

    public static function getCategory(int $categoryId): ?array
    {
        self::ensureSchema();
        $row = Database::queryOne('SELECT * FROM tabul8_categories WHERE id = ?', [$categoryId]);
        return $row ? self::toCategory($row) : null;
    }

    /** @param array<string,mixed> $fields */
    public static function upsertCategory(array $fields): array
    {
        self::ensureSchema();
        $id = (int)($fields['id'] ?? 0);
        $name = trim((string)($fields['name'] ?? ''));
        if ($name === '') {
            throw new InvalidArgumentException('name is required');
        }
        if (strlen($name) > 128) {
            throw new InvalidArgumentException('name too long');
        }

        $contestType = strtolower(trim((string)($fields['contest_type'] ?? $fields['type'] ?? '')));
        if ($contestType !== '' && !in_array($contestType, self::CONTEST_TYPES, true)) {
            throw new InvalidArgumentException('Invalid contest_type');
        }

        if ($id > 0) {
            $existing = self::getCategory($id);
            if (!$existing) {
                throw new InvalidArgumentException('Category not found');
            }
            $sort = array_key_exists('sort_order', $fields)
                ? (int)$fields['sort_order'] : (int)$existing['sort_order'];
            $open = array_key_exists('voting_open', $fields)
                ? (!empty($fields['voting_open']) ? 1 : 0) : (int)$existing['voting_open'];
            $type = $contestType !== '' ? $contestType : (string)$existing['contest_type'];
            Database::execute(
                'UPDATE tabul8_categories SET name = ?, contest_type = ?, sort_order = ?, voting_open = ? WHERE id = ?',
                [$name, $type, $sort, $open, $id]
            );
            return self::getCategory($id);
        }

        $boardId = (int)($fields['board_id'] ?? 0);
        $board = self::getBoard($boardId);
        if (!$board) {
            throw new InvalidArgumentException('Board not found');
        }
        $sort = (int)($fields['sort_order'] ?? 100);
        $open = !empty($fields['voting_open']) ? 1 : 0;
        $type = $contestType !== '' ? $contestType : 'costume';
        Database::execute(
            'INSERT INTO tabul8_categories (board_id, party_id, name, contest_type, sort_order, voting_open)
             VALUES (?, ?, ?, ?, ?, ?)',
            [$boardId, (int)$board['party_id'], $name, $type, $sort, $open]
        );
        return self::getCategory((int)Database::lastInsertId());
    }

    public static function deleteCategory(int $categoryId): bool
    {
        self::ensureSchema();
        if ($categoryId <= 0) {
            return false;
        }
        Database::execute('DELETE FROM tabul8_categories WHERE id = ?', [$categoryId]);
        return true;
    }

    public static function setCategoryVoting(int $categoryId, bool $open): ?array
    {
        return self::upsertCategory(['id' => $categoryId, 'name' => (self::getCategory($categoryId)['name'] ?? ''), 'voting_open' => $open ? 1 : 0]);
    }

    /** @param array<string,mixed> $fields */
    public static function updateBoard(int $boardId, array $fields): array
    {
        self::ensureSchema();
        $board = self::getBoard($boardId);
        if (!$board) {
            throw new InvalidArgumentException('Board not found');
        }
        $votingOpen = array_key_exists('voting_open', $fields)
            ? (!empty($fields['voting_open']) ? 1 : 0) : (int)$board['voting_open'];
        $phoneVoting = array_key_exists('phone_voting_open', $fields)
            ? (!empty($fields['phone_voting_open']) ? 1 : 0) : (int)$board['phone_voting_open'];
        $showBars = array_key_exists('show_bars', $fields)
            ? (!empty($fields['show_bars']) ? 1 : 0) : (int)$board['show_bars'];
        $reveal = array_key_exists('reveal_winners', $fields)
            ? (!empty($fields['reveal_winners']) ? 1 : 0) : (int)$board['reveal_winners'];
        Database::execute(
            'UPDATE tabul8_boards SET voting_open = ?, phone_voting_open = ?, show_bars = ?, reveal_winners = ? WHERE id = ?',
            [$votingOpen, $phoneVoting, $showBars, $reveal, $boardId]
        );
        return self::getBoard($boardId);
    }

    /**
     * Short-lived signed phone/QR vote URL. Empty when phone voting is off.
     *
     * @return array{url_path:string,exp:int,ttl_seconds:int,phone_voting_open:int}
     */
    public static function mintPhoneVoteLink(int $boardId, ?int $ttlSec = null): array
    {
        self::ensureSchema();
        $board = self::getBoard($boardId);
        if (!$board) {
            throw new InvalidArgumentException('Board not found');
        }
        $ttl = $ttlSec !== null ? max(60, min(3600, $ttlSec)) : self::PHONE_VOTE_TTL_SEC;
        $phoneOpen = (int)$board['phone_voting_open'] === 1 ? 1 : 0;
        if ($phoneOpen !== 1) {
            return [
                'url_path' => '',
                'exp' => 0,
                'ttl_seconds' => $ttl,
                'phone_voting_open' => 0,
            ];
        }
        $token = (string)$board['vote_token'];
        $exp = time() + $ttl;
        $sig = self::signPhoneVoteAccess($token, (int)$board['party_id'], $exp);
        $path = '/tabul8/vote/' . rawurlencode($token)
            . '?exp=' . $exp
            . '&sig=' . rawurlencode($sig);
        return [
            'url_path' => $path,
            'exp' => $exp,
            'ttl_seconds' => $ttl,
            'phone_voting_open' => 1,
        ];
    }

    public static function signPhoneVoteAccess(string $voteToken, int $partyId, int $exp): string
    {
        require_once __DIR__ . '/celebr8_album_model.php';
        $payload = 'tabul8_phone|' . $voteToken . '|' . $partyId . '|' . $exp;
        return hash_hmac('sha256', $payload, Celebr8AlbumModel::signingKey());
    }

    public static function verifyPhoneVoteAccess(string $voteToken, int $partyId, int $exp, string $sig): bool
    {
        if ($voteToken === '' || $partyId <= 0 || $exp < time() || $sig === '') {
            return false;
        }
        $expected = self::signPhoneVoteAccess($voteToken, $partyId, $exp);
        return hash_equals($expected, $sig);
    }

    public static function rotateVoteToken(int $boardId): array
    {
        self::ensureSchema();
        $board = self::getBoard($boardId);
        if (!$board) {
            throw new InvalidArgumentException('Board not found');
        }
        $token = self::makeVoteToken();
        Database::execute('UPDATE tabul8_boards SET vote_token = ? WHERE id = ?', [$token, $boardId]);
        return self::getBoard($boardId);
    }

    /** @return list<array> */
    public static function listEntries(int $boardId, ?int $categoryId = null): array
    {
        self::ensureSchema();
        if ($categoryId !== null && $categoryId > 0) {
            $rows = Database::queryAll(
                'SELECT e.*,
                        (SELECT COUNT(*) FROM tabul8_votes v
                          WHERE v.entry_id = e.id AND v.is_void = 0) AS vote_count
                 FROM tabul8_entries e
                 WHERE e.board_id = ? AND e.category_id = ?
                 ORDER BY e.sort_order ASC, e.id ASC',
                [$boardId, $categoryId]
            );
        } else {
            $rows = Database::queryAll(
                'SELECT e.*,
                        (SELECT COUNT(*) FROM tabul8_votes v
                          WHERE v.entry_id = e.id AND v.is_void = 0) AS vote_count
                 FROM tabul8_entries e
                 WHERE e.board_id = ?
                 ORDER BY e.category_id ASC, e.sort_order ASC, e.id ASC',
                [$boardId]
            );
        }
        return array_map(static fn (array $r): array => self::toEntry($r), $rows);
    }

    public static function getEntry(int $entryId): ?array
    {
        self::ensureSchema();
        $row = Database::queryOne(
            'SELECT e.*,
                    (SELECT COUNT(*) FROM tabul8_votes v
                      WHERE v.entry_id = e.id AND v.is_void = 0) AS vote_count
             FROM tabul8_entries e WHERE e.id = ?',
            [$entryId]
        );
        return $row ? self::toEntry($row) : null;
    }

    /**
     * Create entry (+ optional photo already uploaded) and optionally queue tabul8_label request.
     *
     * @param array<string,mixed> $fields
     */
    public static function upsertEntry(array $fields, ?int $userId = null, bool $requestLabel = false): array
    {
        self::ensureSchema();
        $id = (int)($fields['id'] ?? 0);
        $label = trim((string)($fields['label'] ?? ''));
        $description = trim((string)($fields['description'] ?? ''));
        $photoId = isset($fields['photo_id']) && $fields['photo_id'] !== null && $fields['photo_id'] !== ''
            ? (int)$fields['photo_id'] : null;
        $guestId = isset($fields['guest_id']) && $fields['guest_id'] !== null && $fields['guest_id'] !== ''
            ? (int)$fields['guest_id'] : null;
        $ownerGuestId = isset($fields['owner_guest_id']) && $fields['owner_guest_id'] !== null && $fields['owner_guest_id'] !== ''
            ? (int)$fields['owner_guest_id'] : null;
        $entryKind = strtolower(trim((string)($fields['entry_kind'] ?? '')));
        if ($entryKind !== '' && !in_array($entryKind, self::ENTRY_KINDS, true)) {
            throw new InvalidArgumentException('Invalid entry_kind');
        }
        // Accept contest_id as alias for category_id
        if (!isset($fields['category_id']) && isset($fields['contest_id'])) {
            $fields['category_id'] = (int)$fields['contest_id'];
        }

        if ($id > 0) {
            $existing = self::getEntry($id);
            if (!$existing) {
                throw new InvalidArgumentException('Entry not found');
            }
            $categoryId = array_key_exists('category_id', $fields)
                ? (int)$fields['category_id'] : (int)$existing['category_id'];
            $cat = self::getCategory($categoryId);
            if (!$cat || (int)$cat['board_id'] !== (int)$existing['board_id']) {
                throw new InvalidArgumentException('Invalid category');
            }
            if ($label === '' && array_key_exists('label', $fields)) {
                $label = '';
            } elseif ($label === '') {
                $label = (string)$existing['label'];
            }
            if (!array_key_exists('description', $fields)) {
                $description = (string)$existing['description'];
            }
            if (!array_key_exists('photo_id', $fields)) {
                $photoId = $existing['photo_id'];
            }
            if (!array_key_exists('guest_id', $fields)) {
                $guestId = $existing['guest_id'];
            }
            if (!array_key_exists('owner_guest_id', $fields)) {
                $ownerGuestId = $existing['owner_guest_id'];
            }
            if ($entryKind === '') {
                $entryKind = (string)$existing['entry_kind'];
            }
            $sort = array_key_exists('sort_order', $fields)
                ? (int)$fields['sort_order'] : (int)$existing['sort_order'];
            Database::execute(
                'UPDATE tabul8_entries
                 SET category_id = ?, label = ?, entry_kind = ?, description = ?, photo_id = ?,
                     guest_id = ?, owner_guest_id = ?, sort_order = ?
                 WHERE id = ?',
                [
                    $categoryId, $label, $entryKind, $description !== '' ? $description : null,
                    $photoId, $guestId, $ownerGuestId, $sort, $id,
                ]
            );
            $entry = self::getEntry($id);
            if ($requestLabel && $entry) {
                $entry = self::applyLabelPipeline($entry, $userId);
            }
            return $entry;
        }

        $categoryId = (int)($fields['category_id'] ?? 0);
        $cat = self::getCategory($categoryId);
        if (!$cat) {
            throw new InvalidArgumentException('Category not found');
        }
        $sort = (int)($fields['sort_order'] ?? 0);
        if ($entryKind === '') {
            $entryKind = in_array((string)$cat['contest_type'], ['chili', 'dish'], true) ? 'thing' : 'person';
        }
        Database::execute(
            'INSERT INTO tabul8_entries
                (board_id, party_id, category_id, label, entry_kind, description, photo_id, guest_id, owner_guest_id, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                (int)$cat['board_id'],
                (int)$cat['party_id'],
                $categoryId,
                $label,
                $entryKind,
                $description !== '' ? $description : null,
                $photoId,
                $guestId,
                $ownerGuestId,
                $sort,
            ]
        );
        $entry = self::getEntry((int)Database::lastInsertId());
        if ($requestLabel && $entry) {
            $entry = self::applyLabelPipeline($entry, $userId);
        }
        return $entry;
    }

    /**
     * When a guest's costume_name changes, update labels on existing costume-contest
     * person entries for that guest. Does not create photo-less entries.
     */
    public static function syncGuestCostumeLabels(int $partyId, int $guestId, string $costume): void
    {
        self::ensureSchema();
        $costume = trim($costume);
        if ($partyId <= 0 || $guestId <= 0 || $costume === '') {
            return;
        }
        $board = self::getBoardByParty($partyId);
        if (!$board) {
            return;
        }
        foreach (self::listCategories((int)$board['id']) as $c) {
            if (($c['contest_type'] ?? '') !== 'costume') {
                continue;
            }
            foreach (self::listEntries((int)$board['id'], (int)$c['id']) as $e) {
                if ((int)($e['guest_id'] ?? 0) !== $guestId) {
                    continue;
                }
                self::upsertEntry([
                    'id' => (int)$e['id'],
                    'label' => $costume,
                    'guest_id' => $guestId,
                    'entry_kind' => 'person',
                ], null, false);
            }
        }
    }

    /**
     * Kiosk home payload: open contests + which ones this identity already voted.
     *
     * @return array<string,mixed>
     */
    public static function kioskVoterState(int $partyId, ?int $identityId): array
    {
        $ensured = self::ensureBoard($partyId);
        $board = $ensured['board'];
        $tallies = self::getTallies((int)$board['id']);
        $voted = [];
        if ($identityId && $identityId > 0) {
            $rows = Database::queryAll(
                'SELECT category_id FROM tabul8_votes
                 WHERE party_id = ? AND identity_id = ? AND is_void = 0',
                [$partyId, $identityId]
            );
            foreach ($rows as $r) {
                $voted[(int)$r['category_id']] = true;
            }
        }
        $contests = [];
        foreach ($tallies['categories'] as $c) {
            $cid = (int)$c['id'];
            $contests[] = $c + [
                'voted' => !empty($voted[$cid]) ? 1 : 0,
            ];
        }
        return [
            'board' => $tallies['board'],
            'contests' => $contests,
            'categories' => $contests,
            'party' => Celebr8Model::getEvent($partyId),
            'identity_id' => $identityId,
            'voted_contest_ids' => array_map('intval', array_keys($voted)),
        ];
    }

    /**
     * OpenAI vision first (≤8s), then Celebr8r or manual per settings. Soft-fails.
     *
     * @param array<string,mixed> $entry
     * @return array<string,mixed>
     */
    public static function applyLabelPipeline(array $entry, ?int $userId = null): array
    {
        require_once __DIR__ . '/tabul8_ai_label.php';
        $result = Tabul8AiLabel::labelEntry((int)$entry['id'], $userId);
        $out = is_array($result['entry'] ?? null) && $result['entry'] !== []
            ? $result['entry']
            : (self::getEntry((int)$entry['id']) ?: $entry);
        $out['label_source'] = (string)($result['source'] ?? '');
        $out['label_error'] = $result['error'] ?? null;
        return $out;
    }

    /** @param array<string,mixed> $entry */
    public static function queueLabelRequest(array $entry, ?int $userId = null): array
    {
        require_once __DIR__ . '/celebr8_agent_model.php';
        require_once __DIR__ . '/celebr8_album_model.php';
        Celebr8AgentModel::ensureSchema();

        $entryId = (int)$entry['id'];
        $partyId = (int)$entry['party_id'];
        $cat = self::getCategory((int)$entry['category_id']);
        $catName = $cat ? (string)$cat['name'] : 'Contest';
        $photoUrl = null;
        if (!empty($entry['photo_id'])) {
            $photoUrl = Celebr8AlbumModel::signedPhotoUrl((int)$entry['photo_id'], 'web', 1800);
        }

        $requestText = "Tabul8 label needed: invent a short fun contestant label"
            . " for party #{$partyId}, category \"{$catName}\", entry_id={$entryId}."
            . " Reply with set_tabul8_label. Keep it PG and party-friendly.";

        $payload = [
            'entry_id' => $entryId,
            'party_id' => $partyId,
            'category_id' => (int)$entry['category_id'],
            'category' => $catName,
            'photo_url' => $photoUrl,
            'current_label' => (string)($entry['label'] ?? ''),
        ];

        $req = Celebr8AgentModel::createRequest([
            'party_id' => $partyId,
            'request_type' => 'tabul8_label',
            'type' => 'tabul8_label',
            'request_text' => $requestText,
            'show_before_sending' => 0,
            'audience_type' => 'none',
            'payload' => $payload,
        ], $userId);

        Database::execute(
            'UPDATE tabul8_entries SET label_request_id = ? WHERE id = ?',
            [(int)$req['id'], $entryId]
        );

        return self::getEntry($entryId);
    }

    public static function setEntryLabel(int $entryId, string $label, ?string $description = null): array
    {
        self::ensureSchema();
        $entry = self::getEntry($entryId);
        if (!$entry) {
            throw new InvalidArgumentException('Entry not found');
        }
        $label = trim($label);
        if ($label === '') {
            throw new InvalidArgumentException('label is required');
        }
        if (strlen($label) > 191) {
            throw new InvalidArgumentException('label too long');
        }
        $fields = [
            'id' => $entryId,
            'label' => $label,
        ];
        if ($description !== null) {
            $fields['description'] = trim($description);
        }
        return self::upsertEntry($fields);
    }

    public static function deleteEntry(int $entryId): bool
    {
        self::ensureSchema();
        if ($entryId <= 0) {
            return false;
        }
        Database::execute('DELETE FROM tabul8_entries WHERE id = ?', [$entryId]);
        return true;
    }

    /**
     * Merge source entry into target (move votes, then delete source).
     */
    public static function mergeEntries(int $targetId, int $sourceId): array
    {
        self::ensureSchema();
        if ($targetId <= 0 || $sourceId <= 0 || $targetId === $sourceId) {
            throw new InvalidArgumentException('target_id and source_id required and must differ');
        }
        $target = self::getEntry($targetId);
        $source = self::getEntry($sourceId);
        if (!$target || !$source) {
            throw new InvalidArgumentException('Entry not found');
        }
        if ((int)$target['board_id'] !== (int)$source['board_id']) {
            throw new InvalidArgumentException('Entries must be on the same board');
        }
        Database::execute(
            'UPDATE tabul8_votes SET entry_id = ?, category_id = ? WHERE entry_id = ? AND is_void = 0',
            [$targetId, (int)$target['category_id'], $sourceId]
        );
        if ($target['label'] === '' && $source['label'] !== '') {
            Database::execute('UPDATE tabul8_entries SET label = ? WHERE id = ?', [$source['label'], $targetId]);
        }
        if (($target['description'] ?? '') === '' && ($source['description'] ?? '') !== '') {
            Database::execute(
                'UPDATE tabul8_entries SET description = ? WHERE id = ?',
                [$source['description'], $targetId]
            );
        }
        if (empty($target['photo_id']) && !empty($source['photo_id'])) {
            Database::execute(
                'UPDATE tabul8_entries SET photo_id = ? WHERE id = ?',
                [$source['photo_id'], $targetId]
            );
        }
        self::deleteEntry($sourceId);
        return self::getEntry($targetId);
    }

    public static function voidVote(int $voteId): bool
    {
        self::ensureSchema();
        if ($voteId <= 0) {
            return false;
        }
        $row = Database::queryOne('SELECT id FROM tabul8_votes WHERE id = ?', [$voteId]);
        if (!$row) {
            return false;
        }
        Database::execute('UPDATE tabul8_votes SET is_void = 1 WHERE id = ?', [$voteId]);
        return true;
    }

    /** @return list<array> */
    public static function listVotes(int $boardId, ?int $categoryId = null, bool $includeVoid = false): array
    {
        self::ensureSchema();
        $params = [$boardId];
        $sql = 'SELECT * FROM tabul8_votes WHERE board_id = ?';
        if ($categoryId !== null && $categoryId > 0) {
            $sql .= ' AND category_id = ?';
            $params[] = $categoryId;
        }
        if (!$includeVoid) {
            $sql .= ' AND is_void = 0';
        }
        $sql .= ' ORDER BY id DESC LIMIT 500';
        $rows = Database::queryAll($sql, $params);
        $out = [];
        foreach ($rows as $r) {
            $out[] = [
                'id' => (int)$r['id'],
                'board_id' => (int)$r['board_id'],
                'party_id' => (int)$r['party_id'],
                'category_id' => (int)$r['category_id'],
                'entry_id' => (int)$r['entry_id'],
                'embedding_id' => $r['embedding_id'] !== null ? (int)$r['embedding_id'] : null,
                'identity_id' => isset($r['identity_id']) && $r['identity_id'] !== null ? (int)$r['identity_id'] : null,
                'match_confidence' => isset($r['match_confidence']) && $r['match_confidence'] !== null
                    ? (float)$r['match_confidence'] : null,
                'device_token' => (string)$r['device_token'],
                'guest_id' => $r['guest_id'] !== null ? (int)$r['guest_id'] : null,
                'is_void' => (int)$r['is_void'],
                'created_at' => (string)$r['created_at'],
            ];
        }
        return $out;
    }

    /**
     * @return array{categories:list<array>,entries:list<array>,board:array}
     */
    public static function getTallies(int $boardId): array
    {
        $board = self::getBoard($boardId);
        if (!$board) {
            throw new InvalidArgumentException('Board not found');
        }
        $categories = self::listCategories($boardId);
        $entries = self::listEntries($boardId);
        foreach ($categories as &$cat) {
            $cid = (int)$cat['id'];
            $catEntries = array_values(array_filter($entries, static fn (array $e): bool => (int)$e['category_id'] === $cid));
            usort($catEntries, static function (array $a, array $b): int {
                $va = (int)($a['vote_count'] ?? 0);
                $vb = (int)($b['vote_count'] ?? 0);
                if ($va === $vb) {
                    return ((int)$a['id']) <=> ((int)$b['id']);
                }
                return $vb <=> $va;
            });
            $cat['entries'] = $catEntries;
            $cat['total_votes'] = array_sum(array_map(
                static fn (array $e): int => (int)($e['vote_count'] ?? 0),
                $catEntries
            ));
            $cat['leader_entry_id'] = $catEntries !== [] ? (int)$catEntries[0]['id'] : null;
        }
        unset($cat);
        return [
            'board' => $board,
            'categories' => $categories,
            'entries' => $entries,
        ];
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
        $dims = count($out);
        if ($dims < self::EMBEDDING_DIMS_MIN || $dims > self::EMBEDDING_DIMS_MAX) {
            throw new InvalidArgumentException(
                'embedding dims must be between ' . self::EMBEDDING_DIMS_MIN . ' and ' . self::EMBEDDING_DIMS_MAX
            );
        }
        $norm = 0.0;
        foreach ($out as $v) {
            $norm += $v * $v;
        }
        $norm = sqrt($norm);
        if ($norm < 1e-9) {
            throw new InvalidArgumentException('embedding vector is zero');
        }
        foreach ($out as $i => $v) {
            $out[$i] = $v / $norm;
        }
        return $out;
    }

    /** @param list<float> $a @param list<float> $b */
    public static function cosineSimilarity(array $a, array $b): float
    {
        $n = min(count($a), count($b));
        if ($n === 0) {
            return 0.0;
        }
        $dot = 0.0;
        for ($i = 0; $i < $n; $i++) {
            $dot += $a[$i] * $b[$i];
        }
        return $dot;
    }

    /**
     * @param list<float|int> $vector
     * @return array{matched:bool,similarity:float,embedding_id:?int,guest_id:?int}
     */
    public static function findMatchingEmbedding(int $categoryId, array $vector): array
    {
        self::ensureSchema();
        $vec = self::normalizeVector($vector);
        $rows = Database::queryAll(
            'SELECT id, vector_json, guest_id FROM tabul8_embeddings WHERE category_id = ? ORDER BY id ASC',
            [$categoryId]
        );
        $bestSim = -1.0;
        $bestId = null;
        $bestGuest = null;
        foreach ($rows as $row) {
            $decoded = json_decode((string)$row['vector_json'], true);
            if (!is_array($decoded) || $decoded === []) {
                continue;
            }
            try {
                $other = self::normalizeVector($decoded);
            } catch (Throwable $e) {
                continue;
            }
            if (count($other) !== count($vec)) {
                continue;
            }
            $sim = self::cosineSimilarity($vec, $other);
            if ($sim > $bestSim) {
                $bestSim = $sim;
                $bestId = (int)$row['id'];
                $bestGuest = $row['guest_id'] !== null ? (int)$row['guest_id'] : null;
            }
        }
        $matched = $bestSim >= self::FACE_SIMILARITY_THRESHOLD;
        return [
            'matched' => $matched,
            'similarity' => round($bestSim, 4),
            'embedding_id' => $matched ? $bestId : null,
            'guest_id' => $matched ? $bestGuest : null,
            'threshold' => self::FACE_SIMILARITY_THRESHOLD,
        ];
    }

    /**
     * Cast a vote with face embedding + device token backups.
     * Phone path: vote_token + short-lived exp/sig (phone_voting_open required).
     * Kiosk path: board_id (caller must require login).
     *
     * @param array<string,mixed> $fields
     * @return array{vote:array,entry:array,blocked?:bool,reason?:string,match?:array}
     */
    public static function castVote(array $fields, bool $kioskSession = false): array
    {
        self::ensureSchema();
        $board = null;
        $token = trim((string)($fields['vote_token'] ?? ''));
        if ($token !== '') {
            $board = self::getBoardByToken($token);
            if (!$board) {
                throw new InvalidArgumentException('Board not found');
            }
            if ((int)$board['phone_voting_open'] !== 1) {
                throw new InvalidArgumentException('Phone voting is off for this party — use the kiosk');
            }
            $exp = (int)($fields['exp'] ?? 0);
            $sig = trim((string)($fields['sig'] ?? ''));
            if (!self::verifyPhoneVoteAccess($token, (int)$board['party_id'], $exp, $sig)) {
                throw new InvalidArgumentException('Phone vote link expired or invalid — ask for a fresh QR');
            }
        } elseif (!empty($fields['board_id'])) {
            if (!$kioskSession) {
                throw new InvalidArgumentException('Login required for kiosk voting');
            }
            $board = self::getBoard((int)$fields['board_id']);
        }
        if (!$board) {
            throw new InvalidArgumentException('Board not found');
        }
        if ((int)$board['voting_open'] !== 1) {
            throw new InvalidArgumentException('Voting is closed for this party');
        }

        $categoryId = (int)($fields['category_id'] ?? 0);
        $entryId = (int)($fields['entry_id'] ?? 0);
        $cat = self::getCategory($categoryId);
        $entry = self::getEntry($entryId);
        if (!$cat || (int)$cat['board_id'] !== (int)$board['id']) {
            throw new InvalidArgumentException('Category not found');
        }
        if ((int)$cat['voting_open'] !== 1) {
            throw new InvalidArgumentException('Voting is closed for this category');
        }
        if (!$entry || (int)$entry['category_id'] !== $categoryId) {
            throw new InvalidArgumentException('Entry not found in this category');
        }

        $deviceToken = substr(trim((string)($fields['device_token'] ?? '')), 0, self::DEVICE_TOKEN_MAX);
        $ip = (string)($_SERVER['REMOTE_ADDR'] ?? '');
        $ipHash = $ip !== '' ? hash('sha256', $ip . '|tabul8|' . (int)$board['id']) : '';

        // Rate limit by IP hash
        if ($ipHash !== '') {
            $recent = Database::queryOne(
                "SELECT COUNT(*) AS c FROM tabul8_votes
                 WHERE board_id = ? AND ip_hash = ? AND created_at > (NOW() - INTERVAL 1 HOUR)",
                [(int)$board['id'], $ipHash]
            );
            if ((int)($recent['c'] ?? 0) >= self::RATE_LIMIT_PER_HOUR) {
                throw new InvalidArgumentException('Too many votes from this network — try again later');
            }
        }

        // Device backup: one non-void vote per device per category
        if ($deviceToken !== '') {
            $devVote = Database::queryOne(
                'SELECT id FROM tabul8_votes
                 WHERE category_id = ? AND device_token = ? AND is_void = 0 LIMIT 1',
                [$categoryId, $deviceToken]
            );
            if ($devVote) {
                return [
                    'blocked' => true,
                    'reason' => 'already_voted_device',
                    'vote' => null,
                    'entry' => $entry,
                ];
            }
        }

        $vector = $fields['embedding'] ?? $fields['vector'] ?? null;
        if (!is_array($vector)) {
            throw new InvalidArgumentException('embedding vector required');
        }
        $vec = self::normalizeVector($vector);

        require_once __DIR__ . '/tabul8_identity_model.php';
        $resolved = Tabul8IdentityModel::resolveIdentityForVote($vec);
        $identityId = (int)$resolved['identity']['id'];
        $matchConfidence = (float)$resolved['similarity'];
        $guestId = $resolved['identity']['guest_id'] !== null
            ? (int)$resolved['identity']['guest_id'] : null;
        if (isset($fields['guest_id']) && $fields['guest_id'] !== null && $fields['guest_id'] !== '') {
            $guestId = (int)$fields['guest_id'];
        }
        // Client may pass a pre-matched identity_id from kiosk greeting (still verify store).
        if (isset($fields['identity_id']) && (int)$fields['identity_id'] > 0) {
            $claimed = Tabul8IdentityModel::getIdentity((int)$fields['identity_id']);
            if ($claimed) {
                $identityId = (int)$claimed['id'];
                if ($guestId === null && $claimed['guest_id'] !== null) {
                    $guestId = (int)$claimed['guest_id'];
                }
            }
        }

        // One vote per identity per category per party.
        $identVote = Database::queryOne(
            'SELECT id FROM tabul8_votes
             WHERE party_id = ? AND category_id = ? AND identity_id = ? AND is_void = 0 LIMIT 1',
            [(int)$board['party_id'], $categoryId, $identityId]
        );
        if ($identVote) {
            return [
                'blocked' => true,
                'reason' => 'already_voted_identity',
                'identity' => $resolved['identity'],
                'match_confidence' => $matchConfidence,
                'vote' => null,
                'entry' => $entry,
            ];
        }

        // Legacy party-scoped embedding row (audit / backup; identities are source of truth).
        $legacyMatch = self::findMatchingEmbedding($categoryId, $vec);
        Database::execute(
            'INSERT INTO tabul8_embeddings
                (board_id, party_id, category_id, vector_json, dims, guest_id, device_token)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                (int)$board['id'],
                (int)$board['party_id'],
                $categoryId,
                json_encode($vec, JSON_UNESCAPED_UNICODE),
                count($vec),
                $guestId,
                $deviceToken,
            ]
        );
        $embeddingId = (int)Database::lastInsertId();

        Database::execute(
            'INSERT INTO tabul8_votes
                (board_id, party_id, category_id, entry_id, embedding_id, identity_id, match_confidence,
                 device_token, guest_id, ip_hash, is_void)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
            [
                (int)$board['id'],
                (int)$board['party_id'],
                $categoryId,
                $entryId,
                $embeddingId,
                $identityId,
                $matchConfidence,
                $deviceToken,
                $guestId,
                $ipHash,
            ]
        );
        $voteId = (int)Database::lastInsertId();

        return [
            'blocked' => false,
            'vote' => [
                'id' => $voteId,
                'entry_id' => $entryId,
                'category_id' => $categoryId,
                'embedding_id' => $embeddingId,
                'identity_id' => $identityId,
                'match_confidence' => $matchConfidence,
                'guest_id' => $guestId,
                'display_name' => (string)($resolved['identity']['display_name'] ?? ''),
            ],
            'entry' => self::getEntry($entryId),
            'identity' => $resolved['identity'],
            'match' => $legacyMatch,
            'match_confidence' => $matchConfidence,
        ];
    }

    /**
     * Admin audit list of votes with identity + confidence.
     *
     * @return list<array>
     */
    public static function listVoteAudit(int $boardId, ?int $categoryId = null): array
    {
        self::ensureSchema();
        require_once __DIR__ . '/tabul8_identity_model.php';
        Tabul8IdentityModel::ensureSchema();
        $params = [$boardId];
        $sql = 'SELECT v.*, i.display_name AS identity_name, e.label AS entry_label, c.name AS category_name
                FROM tabul8_votes v
                LEFT JOIN tabul8_identities i ON i.id = v.identity_id
                LEFT JOIN tabul8_entries e ON e.id = v.entry_id
                LEFT JOIN tabul8_categories c ON c.id = v.category_id
                WHERE v.board_id = ?';
        if ($categoryId !== null && $categoryId > 0) {
            $sql .= ' AND v.category_id = ?';
            $params[] = $categoryId;
        }
        $sql .= ' ORDER BY v.id DESC LIMIT 500';
        $rows = Database::queryAll($sql, $params);
        $out = [];
        foreach ($rows as $row) {
            $out[] = [
                'id' => (int)$row['id'],
                'board_id' => (int)$row['board_id'],
                'party_id' => (int)$row['party_id'],
                'category_id' => (int)$row['category_id'],
                'category_name' => (string)($row['category_name'] ?? ''),
                'entry_id' => (int)$row['entry_id'],
                'entry_label' => (string)($row['entry_label'] ?? ''),
                'identity_id' => $row['identity_id'] !== null ? (int)$row['identity_id'] : null,
                'identity_name' => (string)($row['identity_name'] ?? ''),
                'match_confidence' => $row['match_confidence'] !== null ? (float)$row['match_confidence'] : null,
                'guest_id' => $row['guest_id'] !== null ? (int)$row['guest_id'] : null,
                'device_token' => (string)($row['device_token'] ?? ''),
                'is_void' => (int)($row['is_void'] ?? 0),
                'created_at' => (string)($row['created_at'] ?? ''),
            ];
        }
        return $out;
    }


    public static function purgeFaceDataForParty(int $partyId): int
    {
        self::ensureSchema();
        if ($partyId <= 0) {
            return 0;
        }
        $row = Database::queryOne(
            'SELECT COUNT(*) AS c FROM tabul8_embeddings WHERE party_id = ?',
            [$partyId]
        );
        $count = (int)($row['c'] ?? 0);
        Database::execute(
            'UPDATE tabul8_votes SET embedding_id = NULL WHERE party_id = ?',
            [$partyId]
        );
        Database::execute('DELETE FROM tabul8_embeddings WHERE party_id = ?', [$partyId]);
        return $count;
    }

    /** Auto-delete embeddings ~7 days after party date (cron-less). */
    public static function purgeExpiredFaceData(): int
    {
        // Called from ensureSchema — avoid recursion flag issues by using raw SQL only.
        try {
            $rows = Database::queryAll(
                "SELECT DISTINCT b.party_id
                 FROM tabul8_boards b
                 INNER JOIN celebr8_events e ON e.id = b.party_id
                 INNER JOIN tabul8_embeddings emb ON emb.party_id = b.party_id
                 WHERE e.event_date IS NOT NULL
                   AND e.event_date <> ''
                   AND e.event_date < (CURDATE() - INTERVAL 7 DAY)"
            );
        } catch (Throwable $e) {
            return 0;
        }
        $purged = 0;
        foreach ($rows as $row) {
            $purged += self::purgeFaceDataForParty((int)$row['party_id']);
        }
        return $purged;
    }

    /**
     * Snapshot winners into board.results_json (also for Celebr8 party display).
     *
     * @return array{board:array,results:array}
     */
    public static function saveResults(int $boardId): array
    {
        $tallies = self::getTallies($boardId);
        $results = [
            'saved_at' => date('c'),
            'categories' => [],
        ];
        foreach ($tallies['categories'] as $cat) {
            $entries = [];
            foreach ($cat['entries'] as $e) {
                $entries[] = [
                    'entry_id' => (int)$e['id'],
                    'label' => (string)$e['label'],
                    'description' => (string)($e['description'] ?? ''),
                    'photo_id' => $e['photo_id'],
                    'votes' => (int)($e['vote_count'] ?? 0),
                ];
            }
            $winner = $entries[0] ?? null;
            $results['categories'][] = [
                'category_id' => (int)$cat['id'],
                'name' => (string)$cat['name'],
                'total_votes' => (int)$cat['total_votes'],
                'winner' => $winner,
                'entries' => $entries,
            ];
        }
        Database::execute(
            'UPDATE tabul8_boards SET results_json = ?, results_saved_at = NOW(), reveal_winners = 1 WHERE id = ?',
            [json_encode($results, JSON_UNESCAPED_UNICODE), $boardId]
        );
        return [
            'board' => self::getBoard($boardId),
            'results' => $results,
        ];
    }

    /**
     * Phone vote payload — requires phone_voting_open + valid short-lived signature.
     *
     * @return array<string,mixed>
     */
    public static function publicBoardState(string $voteToken, int $exp = 0, string $sig = ''): array
    {
        $board = self::getBoardByToken($voteToken);
        if (!$board) {
            throw new InvalidArgumentException('Voting link not found');
        }
        if ((int)$board['phone_voting_open'] !== 1) {
            throw new InvalidArgumentException('Phone voting is off for this party — use the logged-in kiosk');
        }
        if (!self::verifyPhoneVoteAccess($voteToken, (int)$board['party_id'], $exp, $sig)) {
            throw new InvalidArgumentException('Phone vote link expired or invalid — ask for a fresh QR');
        }
        return self::voteBoardState((int)$board['id']);
    }

    /**
     * Shared vote UI payload (kiosk or phone). Hides tallies when show_bars is off.
     *
     * @return array<string,mixed>
     */
    public static function voteBoardState(int $boardId): array
    {
        $board = self::getBoard($boardId);
        if (!$board) {
            throw new InvalidArgumentException('Board not found');
        }
        $party = Celebr8Model::getEvent((int)$board['party_id']);
        $tallies = self::getTallies($boardId);
        $outBoard = $tallies['board'];
        // Hide bars if configured
        if ((int)$outBoard['show_bars'] !== 1) {
            foreach ($tallies['categories'] as &$cat) {
                foreach ($cat['entries'] as &$e) {
                    $e['vote_count'] = null;
                }
                unset($e);
                $cat['total_votes'] = null;
                $cat['leader_entry_id'] = null;
            }
            unset($cat);
        }
        return [
            'board' => $outBoard,
            'party' => $party ? [
                'id' => (int)$party['id'],
                'title' => (string)$party['title'],
                'event_date' => (string)($party['event_date'] ?? ''),
            ] : null,
            'categories' => $tallies['categories'],
            'face_notice' => 'We use a quick face check so everyone votes once.',
            'similarity_threshold' => self::FACE_SIMILARITY_THRESHOLD,
        ];
    }
}
