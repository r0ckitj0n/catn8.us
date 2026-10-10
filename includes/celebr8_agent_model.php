<?php

declare(strict_types=1);

/**
 * Celebr8r agent requests, reply threads, and named guest groups.
 */
final class Celebr8AgentModel
{
    private static bool $schemaEnsured = false;

    public const REQUEST_STATUSES = [
        'pending',
        'notified',
        'working',
        'needs_jon',
        'done',
        'failed',
    ];

    public const AUDIENCE_TYPES = ['none', 'guests', 'rsvp', 'group'];

    /** request_type values: text asks, printable flyer jobs, inbound RSVP reply batches, Tabul8 labels. */
    public const REQUEST_TYPES = ['text', 'flyer', 'rsvp', 'tabul8_label', 'tabul8_costume_name'];

    /** Max inbound reply messages stored on one rsvp request payload. */
    public const RSVP_PAYLOAD_CAP = 40;

    public const MESSAGE_ROLES = ['jon', 'celebr8r', 'system'];

    /** Secret key for optional queue-cap override (integer string). */
    public const QUEUE_CAP_SECRET_KEY = 'celebr8.queue_cap_per_request';

    public const DEFAULT_QUEUE_CAP_PER_REQUEST = 50;

    public static function ensureSchema(): void
    {
        if (self::$schemaEnsured) {
            return;
        }

        Database::execute("CREATE TABLE IF NOT EXISTS celebr8_guest_groups (
            id INT AUTO_INCREMENT PRIMARY KEY,
            event_id INT NOT NULL,
            name VARCHAR(191) NOT NULL,
            notes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_celebr8_guest_groups_event_name (event_id, name),
            KEY idx_celebr8_guest_groups_event (event_id),
            CONSTRAINT fk_celebr8_guest_groups_event FOREIGN KEY (event_id) REFERENCES celebr8_events(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        Database::execute("CREATE TABLE IF NOT EXISTS celebr8_guest_group_members (
            group_id INT NOT NULL,
            guest_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (group_id, guest_id),
            KEY idx_celebr8_ggm_guest (guest_id),
            CONSTRAINT fk_celebr8_ggm_group FOREIGN KEY (group_id) REFERENCES celebr8_guest_groups(id) ON DELETE CASCADE,
            CONSTRAINT fk_celebr8_ggm_guest FOREIGN KEY (guest_id) REFERENCES celebr8_guests(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        Database::execute("CREATE TABLE IF NOT EXISTS celebr8_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            party_id INT NULL,
            request_text TEXT NOT NULL,
            show_before_sending TINYINT(1) NOT NULL DEFAULT 1,
            audience_type VARCHAR(32) NOT NULL DEFAULT 'none',
            audience_guest_ids TEXT NULL,
            audience_rsvp_status VARCHAR(32) NOT NULL DEFAULT '',
            audience_group_id INT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            created_by_user_id INT NULL,
            notify_count INT NOT NULL DEFAULT 0,
            notified_at DATETIME NULL,
            claimed_at DATETIME NULL,
            claimed_by VARCHAR(191) NOT NULL DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_celebr8_requests_status (status, id),
            KEY idx_celebr8_requests_party (party_id),
            KEY idx_celebr8_requests_notified (status, notified_at),
            CONSTRAINT fk_celebr8_requests_party FOREIGN KEY (party_id) REFERENCES celebr8_events(id) ON DELETE SET NULL,
            CONSTRAINT fk_celebr8_requests_group FOREIGN KEY (audience_group_id) REFERENCES celebr8_guest_groups(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        Database::execute("CREATE TABLE IF NOT EXISTS celebr8_request_messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            request_id INT NOT NULL,
            author_role VARCHAR(32) NOT NULL,
            body TEXT NOT NULL,
            created_by_user_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_celebr8_req_msg_request (request_id, id),
            CONSTRAINT fk_celebr8_req_msg_request FOREIGN KEY (request_id) REFERENCES celebr8_requests(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        self::ensureColumn(
            'celebr8_text_messages',
            'request_id',
            'INT NULL DEFAULT NULL'
        );
        self::ensureIndex(
            'celebr8_text_messages',
            'idx_celebr8_text_request',
            'request_id'
        );
        self::ensureColumn(
            'celebr8_requests',
            'request_type',
            "VARCHAR(32) NOT NULL DEFAULT 'text' AFTER party_id"
        );
        self::ensureIndex(
            'celebr8_requests',
            'idx_celebr8_requests_type',
            'request_type'
        );
        self::ensureColumn(
            'celebr8_requests',
            'payload_json',
            'LONGTEXT NULL'
        );

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

    private static function ensureIndex(string $table, string $indexName, string $column): void
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
        Database::execute("ALTER TABLE `{$table}` ADD INDEX `{$indexName}` (`{$column}`)");
    }

    public static function queueCapPerRequest(): int
    {
        $raw = secret_get(self::QUEUE_CAP_SECRET_KEY);
        if (is_string($raw) && trim($raw) !== '' && ctype_digit(trim($raw))) {
            return max(1, min(200, (int)trim($raw)));
        }
        $env = getenv('CELEBR8_QUEUE_CAP_PER_REQUEST');
        if (is_string($env) && trim($env) !== '' && ctype_digit(trim($env))) {
            return max(1, min(200, (int)trim($env)));
        }
        return self::DEFAULT_QUEUE_CAP_PER_REQUEST;
    }

    public static function toRequest(array $row, bool $withExtras = false): array
    {
        $guestIds = [];
        $rawIds = (string)($row['audience_guest_ids'] ?? '');
        if ($rawIds !== '') {
            $decoded = json_decode($rawIds, true);
            if (is_array($decoded)) {
                $guestIds = array_values(array_filter(array_map('intval', $decoded), static fn (int $id): bool => $id > 0));
            }
        }
        $requestType = strtolower(trim((string)($row['request_type'] ?? 'text')));
        if (!in_array($requestType, self::REQUEST_TYPES, true)) {
            $requestType = 'text';
        }
        $payload = null;
        $rawPayload = $row['payload_json'] ?? null;
        if ($rawPayload !== null && $rawPayload !== '') {
            $decoded = json_decode((string)$rawPayload, true);
            if (is_array($decoded)) {
                $payload = $decoded;
            }
        }
        $out = [
            'id' => (int)($row['id'] ?? 0),
            'party_id' => isset($row['party_id']) && $row['party_id'] !== null ? (int)$row['party_id'] : null,
            'request_type' => $requestType,
            'type' => $requestType, // alias for routines that look for "type"
            'request_text' => (string)($row['request_text'] ?? ''),
            'payload' => $payload,
            'show_before_sending' => (int)($row['show_before_sending'] ?? 1),
            'audience_type' => (string)($row['audience_type'] ?? 'none'),
            'audience_guest_ids' => $guestIds,
            'audience_rsvp_status' => (string)($row['audience_rsvp_status'] ?? ''),
            'audience_group_id' => isset($row['audience_group_id']) && $row['audience_group_id'] !== null
                ? (int)$row['audience_group_id'] : null,
            'status' => (string)($row['status'] ?? 'pending'),
            'created_by_user_id' => isset($row['created_by_user_id']) && $row['created_by_user_id'] !== null
                ? (int)$row['created_by_user_id'] : null,
            'notify_count' => (int)($row['notify_count'] ?? 0),
            'notified_at' => $row['notified_at'] !== null ? (string)$row['notified_at'] : null,
            'claimed_at' => $row['claimed_at'] !== null ? (string)$row['claimed_at'] : null,
            'claimed_by' => (string)($row['claimed_by'] ?? ''),
            'created_at' => (string)($row['created_at'] ?? ''),
            'updated_at' => (string)($row['updated_at'] ?? ''),
        ];
        if ($withExtras) {
            $out['party_title'] = (string)($row['party_title'] ?? '');
            $out['preview'] = self::previewText($out['request_text']);
        }
        return $out;
    }

    public static function previewText(string $text, int $max = 160): string
    {
        $text = trim(preg_replace('/\s+/', ' ', $text) ?? '');
        if (strlen($text) <= $max) {
            return $text;
        }
        return substr($text, 0, $max - 1) . '…';
    }

    public static function toThreadMessage(array $row): array
    {
        return [
            'id' => (int)($row['id'] ?? 0),
            'request_id' => (int)($row['request_id'] ?? 0),
            'author_role' => (string)($row['author_role'] ?? ''),
            'body' => (string)($row['body'] ?? ''),
            'created_by_user_id' => isset($row['created_by_user_id']) && $row['created_by_user_id'] !== null
                ? (int)$row['created_by_user_id'] : null,
            'created_at' => (string)($row['created_at'] ?? ''),
        ];
    }

    public static function toGroup(array $row, ?array $memberIds = null): array
    {
        return [
            'id' => (int)($row['id'] ?? 0),
            'event_id' => (int)($row['event_id'] ?? 0),
            'name' => (string)($row['name'] ?? ''),
            'notes' => (string)($row['notes'] ?? ''),
            'guest_ids' => $memberIds ?? [],
            'member_count' => $memberIds !== null ? count($memberIds) : (int)($row['member_count'] ?? 0),
            'created_at' => (string)($row['created_at'] ?? ''),
            'updated_at' => (string)($row['updated_at'] ?? ''),
        ];
    }

    public static function createRequest(array $fields, ?int $userId): array
    {
        self::ensureSchema();
        $text = trim((string)($fields['request_text'] ?? $fields['text'] ?? ''));
        if ($text === '') {
            throw new InvalidArgumentException('request_text is required');
        }
        if (strlen($text) > 8000) {
            throw new InvalidArgumentException('request_text too long');
        }

        $partyId = isset($fields['party_id']) && $fields['party_id'] !== null && $fields['party_id'] !== ''
            ? (int)$fields['party_id'] : null;
        if ($partyId !== null && $partyId > 0) {
            if (!Celebr8Model::getEvent($partyId)) {
                throw new InvalidArgumentException('Party not found');
            }
        } else {
            $partyId = null;
        }

        $requestType = strtolower(trim((string)($fields['request_type'] ?? $fields['type'] ?? 'text')));
        if (!in_array($requestType, self::REQUEST_TYPES, true)) {
            throw new InvalidArgumentException('Invalid request_type (text|flyer|rsvp|tabul8_label|tabul8_costume_name)');
        }

        $showBefore = array_key_exists('show_before_sending', $fields)
            ? (!empty($fields['show_before_sending']) ? 1 : 0)
            : (in_array($requestType, ['flyer', 'rsvp', 'tabul8_label', 'tabul8_costume_name'], true) ? 0 : 1);

        $audienceType = strtolower(trim((string)($fields['audience_type'] ?? 'none')));
        if (in_array($requestType, ['flyer', 'rsvp', 'tabul8_label', 'tabul8_costume_name'], true)) {
            $audienceType = 'none';
        }
        if (!in_array($audienceType, self::AUDIENCE_TYPES, true)) {
            throw new InvalidArgumentException('Invalid audience_type');
        }

        $guestIds = [];
        $rawGuestIds = $fields['audience_guest_ids'] ?? $fields['guest_ids'] ?? [];
        if (is_array($rawGuestIds)) {
            $guestIds = array_values(array_unique(array_filter(array_map('intval', $rawGuestIds), static fn (int $id): bool => $id > 0)));
        }
        $rsvp = trim((string)($fields['audience_rsvp_status'] ?? $fields['rsvp_status'] ?? ''));
        if ($rsvp !== '') {
            $normalized = Celebr8Model::normalizeRsvpStatus($rsvp);
            if ($normalized === null) {
                throw new InvalidArgumentException('Invalid audience_rsvp_status');
            }
            $rsvp = $normalized;
        }
        $groupId = isset($fields['audience_group_id']) && $fields['audience_group_id'] !== null && $fields['audience_group_id'] !== ''
            ? (int)$fields['audience_group_id'] : null;
        if ($groupId !== null && $groupId <= 0) {
            $groupId = null;
        }

        if ($audienceType === 'guests' && $guestIds === []) {
            throw new InvalidArgumentException('audience_guest_ids required for guests audience');
        }
        if ($audienceType === 'rsvp' && $rsvp === '') {
            throw new InvalidArgumentException('audience_rsvp_status required for rsvp audience');
        }
        if ($audienceType === 'group') {
            if ($groupId === null) {
                throw new InvalidArgumentException('audience_group_id required for group audience');
            }
            $group = self::getGroup($groupId);
            if (!$group) {
                throw new InvalidArgumentException('Guest group not found');
            }
            if ($partyId !== null && (int)$group['event_id'] !== $partyId) {
                throw new InvalidArgumentException('Guest group does not belong to this party');
            }
        }
        if ($audienceType !== 'guests') {
            $guestIds = [];
        }
        if ($audienceType !== 'rsvp') {
            $rsvp = '';
        }
        if ($audienceType !== 'group') {
            $groupId = null;
        }

        $payloadJson = null;
        if (array_key_exists('payload', $fields) && $fields['payload'] !== null) {
            if (!is_array($fields['payload'])) {
                throw new InvalidArgumentException('payload must be an array');
            }
            $encoded = json_encode($fields['payload'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($encoded === false) {
                throw new InvalidArgumentException('payload could not be encoded');
            }
            $payloadJson = $encoded;
        } elseif (!empty($fields['payload_json']) && is_string($fields['payload_json'])) {
            $payloadJson = $fields['payload_json'];
        }

        Database::execute(
            'INSERT INTO celebr8_requests (
                party_id, request_type, request_text, show_before_sending, audience_type,
                audience_guest_ids, audience_rsvp_status, audience_group_id,
                status, created_by_user_id, payload_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $partyId,
                $requestType,
                $text,
                $showBefore,
                $audienceType,
                $guestIds === [] ? null : json_encode($guestIds, JSON_UNESCAPED_SLASHES),
                $rsvp,
                $groupId,
                'pending',
                $userId,
                $payloadJson,
            ]
        );
        $id = (int)Database::getInstance()->lastInsertId();
        self::addThreadMessage($id, 'jon', $text, $userId);
        $req = self::getRequest($id);
        if (!$req) {
            throw new RuntimeException('Failed to load created request');
        }
        return $req;
    }

    public static function getRequest(int $id): ?array
    {
        self::ensureSchema();
        $row = Database::queryOne(
            'SELECT r.*, e.title AS party_title
             FROM celebr8_requests r
             LEFT JOIN celebr8_events e ON e.id = r.party_id
             WHERE r.id = ?',
            [$id]
        );
        return $row ? self::toRequest($row, true) : null;
    }

    public static function listRequests(
        ?int $partyId = null,
        ?array $statuses = null,
        int $limit = 50,
        ?string $requestType = null
    ): array {
        self::ensureSchema();
        $limit = max(1, min(200, $limit));
        $params = [];
        $where = ['1=1'];
        if ($partyId !== null) {
            if ($partyId > 0) {
                $where[] = 'r.party_id = ?';
                $params[] = $partyId;
            } else {
                $where[] = 'r.party_id IS NULL';
            }
        }
        if ($requestType !== null && $requestType !== '') {
            $rt = strtolower(trim($requestType));
            if (in_array($rt, self::REQUEST_TYPES, true)) {
                $where[] = 'r.request_type = ?';
                $params[] = $rt;
            }
        }
        if ($statuses !== null && $statuses !== []) {
            $clean = [];
            foreach ($statuses as $st) {
                $st = strtolower(trim((string)$st));
                if (in_array($st, self::REQUEST_STATUSES, true)) {
                    $clean[] = $st;
                }
            }
            if ($clean !== []) {
                $placeholders = implode(',', array_fill(0, count($clean), '?'));
                $where[] = "r.status IN ({$placeholders})";
                foreach ($clean as $st) {
                    $params[] = $st;
                }
            }
        }
        $sql = 'SELECT r.*, e.title AS party_title
                FROM celebr8_requests r
                LEFT JOIN celebr8_events e ON e.id = r.party_id
                WHERE ' . implode(' AND ', $where) . '
                ORDER BY r.id DESC
                LIMIT ' . $limit;
        $rows = Database::queryAll($sql, $params);
        return array_map(static fn (array $row): array => self::toRequest($row, true), $rows);
    }

    public static function findActiveFlyerRequest(int $partyId): ?array
    {
        self::ensureSchema();
        if ($partyId <= 0) {
            return null;
        }
        $row = Database::queryOne(
            "SELECT r.*, e.title AS party_title
             FROM celebr8_requests r
             LEFT JOIN celebr8_events e ON e.id = r.party_id
             WHERE r.party_id = ?
               AND r.request_type = 'flyer'
               AND r.status IN ('pending', 'notified', 'working')
             ORDER BY r.id DESC
             LIMIT 1",
            [$partyId]
        );
        return $row ? self::toRequest($row, true) : null;
    }

    public static function completeActiveFlyerRequests(int $partyId, string $note = ''): void
    {
        self::ensureSchema();
        $rows = Database::queryAll(
            "SELECT id FROM celebr8_requests
             WHERE party_id = ? AND request_type = 'flyer'
               AND status IN ('pending', 'notified', 'working', 'needs_jon')",
            [$partyId]
        );
        foreach ($rows as $row) {
            $id = (int)$row['id'];
            Database::execute(
                "UPDATE celebr8_requests SET status = 'done', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [$id]
            );
            if ($note !== '') {
                self::addThreadMessage($id, 'system', $note, null);
            }
        }
    }

    /**
     * Queue a flyer job for Celebr8r (deduped while pending/notified/working).
     * When $regenerate is true, keeps the current flyer and queues a replacement job.
     *
     * @return array{request:array,created:bool,thread:list<array>}
     */
    public static function requestFlyer(
        int $partyId,
        ?int $userId,
        string $extraNotes = '',
        bool $regenerate = false
    ): array {
        self::ensureSchema();
        require_once __DIR__ . '/celebr8_flyer_model.php';
        require_once __DIR__ . '/celebr8_catalog_model.php';

        $existingFlyer = Celebr8FlyerModel::getFlyerForParty($partyId, false);
        if (!$regenerate && $existingFlyer['has_flyer']) {
            throw new InvalidArgumentException('Party already has a flyer');
        }

        $active = self::findActiveFlyerRequest($partyId);
        if ($active) {
            return [
                'request' => $active,
                'created' => false,
                'thread' => self::listThread((int)$active['id']),
            ];
        }

        $brief = self::buildFlyerBrief($partyId, $extraNotes, $regenerate);
        $req = self::createRequest([
            'party_id' => $partyId,
            'request_type' => 'flyer',
            'type' => 'flyer',
            'request_text' => $brief,
            'show_before_sending' => 0,
            'audience_type' => 'none',
        ], $userId);

        return [
            'request' => $req,
            'created' => true,
            'thread' => self::listThread((int)$req['id']),
        ];
    }

    public static function buildFlyerBrief(int $partyId, string $extraNotes = '', bool $regenerate = false): string
    {
        require_once __DIR__ . '/celebr8_catalog_model.php';
        require_once __DIR__ . '/celebr8_flyer_model.php';

        $event = Celebr8Model::getEvent($partyId);
        if (!$event) {
            throw new InvalidArgumentException('Party not found');
        }
        // Raw DB row for fields that toEvent may rewrite (flyer override).
        $raw = Database::queryOne('SELECT * FROM celebr8_events WHERE id = ?', [$partyId]);
        $activities = Celebr8CatalogModel::listEventActivities($partyId);
        $savedBrief = trim((string)($raw['flyer_brief'] ?? $event['flyer_brief'] ?? ''));
        $savedStyle = trim((string)($raw['flyer_style_notes'] ?? $event['flyer_style_notes'] ?? ''));

        $lines = [];
        if ($savedBrief !== '') {
            $lines[] = $savedBrief;
        } else {
            $lines[] = 'Please create a printable US Letter portrait party flyer (type=flyer).';
            $lines[] = '';
            $lines[] = 'Title: ' . (string)($event['title'] ?? '');
            if (!empty($event['tagline'])) {
                $lines[] = 'Tagline: ' . (string)$event['tagline'];
            }
            if (!empty($event['theme']) || !empty($raw['theme'])) {
                $lines[] = 'Theme: ' . (string)($event['theme'] ?? $raw['theme'] ?? '');
            }
            $lines[] = 'Date: ' . ((string)($event['event_date'] ?? '') ?: 'TBD');
            $kids = trim((string)($event['arrival_time_kids'] ?? ''));
            $adults = trim((string)($event['arrival_time_adults'] ?? ''));
            $time = trim((string)($event['event_time'] ?? ''));
            if ($kids !== '' || $adults !== '') {
                if ($kids !== '') {
                    $lines[] = 'Start (kids): ' . $kids;
                }
                if ($adults !== '') {
                    $lines[] = 'Start (adults): ' . $adults;
                }
            } elseif ($time !== '') {
                $lines[] = 'Start time: ' . $time;
            }
            $venue = trim((string)($event['location'] ?? ''));
            $lines[] = 'Venue / address: ' . ($venue !== '' ? $venue : 'TBD');
            if (!empty($event['food']) || !empty($raw['food'])) {
                $lines[] = 'Food / bring-a-dish: ' . (string)($event['food'] ?? $raw['food'] ?? '');
            }
            if (!empty($event['rsvp_deadline'])) {
                $lines[] = 'RSVP deadline: ' . (string)$event['rsvp_deadline'];
            }
            if (!empty($event['invite_text'])) {
                $lines[] = 'Invite / RSVP notes: ' . (string)$event['invite_text'];
            }
            if (!empty($event['notes'])) {
                $lines[] = 'Other notes: ' . (string)$event['notes'];
            }

            if ($activities !== []) {
                $lines[] = '';
                $lines[] = 'Activities:';
                foreach ($activities as $ea) {
                    $name = (string)($ea['activity']['name'] ?? 'Activity');
                    $desc = trim((string)($ea['activity']['description'] ?? ''));
                    $slot = trim((string)($ea['time_slot'] ?? ''));
                    $bit = '- ' . $name;
                    if ($slot !== '') {
                        $bit .= ' (' . $slot . ')';
                    }
                    if ($desc !== '') {
                        $bit .= ': ' . (strlen($desc) > 180 ? substr($desc, 0, 179) . '…' : $desc);
                    }
                    $lines[] = $bit;
                }
            }
        }

        $legacy = Celebr8FlyerModel::usableLegacyFlyerUrl($partyId);
        $currentPrivate = Celebr8FlyerModel::getCurrentFlyerRow($partyId);
        if ($currentPrivate) {
            $fid = (int)$currentPrivate['id'];
            $lines[] = '';
            $lines[] = 'Style reference (current private flyer id=' . $fid . '): '
                . Celebr8FlyerModel::sessionFlyerUrl($fid, 'web')
                . ' (authed; not public).'
                . ($regenerate ? ' Regenerate a new version; do not leave the party without a flyer.' : '');
        } elseif ($legacy !== '') {
            $lines[] = '';
            $lines[] = 'Style reference (existing invite/flyer image): ' . $legacy
                . ' — use as style reference only if still appropriate.';
        }

        if ($savedStyle !== '') {
            $lines[] = '';
            $lines[] = 'Saved style notes: ' . $savedStyle;
        }
        $extraNotes = trim($extraNotes);
        if ($extraNotes !== '') {
            if (strlen($extraNotes) > 2000) {
                $extraNotes = substr($extraNotes, 0, 2000);
            }
            $lines[] = '';
            $lines[] = ($regenerate ? 'Regenerate notes: ' : 'Jon style notes: ') . $extraNotes;
        }

        $lines[] = '';
        $lines[] = 'When done, upload via agent action upload_flyer (multipart) for party_id=' . $partyId . '.';

        $text = implode("\n", $lines);
        if (strlen($text) > 8000) {
            $text = substr($text, 0, 7999) . '…';
        }
        return $text;
    }

    /**
     * Message guids already queued on any rsvp request (or already stored as notes).
     *
     * @return array<string,true>
     */
    public static function knownRsvpMessageGuids(): array
    {
        self::ensureSchema();
        $known = [];
        $rows = Database::queryAll(
            "SELECT payload_json FROM celebr8_requests WHERE request_type = 'rsvp' AND payload_json IS NOT NULL"
        );
        foreach ($rows as $row) {
            $decoded = json_decode((string)($row['payload_json'] ?? ''), true);
            if (!is_array($decoded)) {
                continue;
            }
            foreach ($decoded as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $guid = trim((string)($item['message_guid'] ?? ''));
                if ($guid !== '') {
                    $known[$guid] = true;
                }
            }
        }
        $noteRows = Database::queryAll(
            'SELECT message_guid FROM celebr8_rsvp_notes WHERE message_guid IS NOT NULL AND message_guid <> \'\''
        );
        foreach ($noteRows as $row) {
            $guid = trim((string)($row['message_guid'] ?? ''));
            if ($guid !== '') {
                $known[$guid] = true;
            }
        }
        return $known;
    }

    /**
     * Normalize one inbound reply item for an rsvp request payload.
     *
     * @param array<string,mixed> $item
     * @return array{guest_id:int,phone:string,message_guid:string,rowid:int,date:string,text:string,is_reaction:bool}|null
     */
    public static function normalizeRsvpPayloadItem(array $item): ?array
    {
        $guestId = (int)($item['guest_id'] ?? 0);
        $phone = Celebr8Model::normalizePhone((string)($item['phone'] ?? ''));
        $guid = trim((string)($item['message_guid'] ?? ''));
        if ($guestId <= 0 || $guid === '') {
            return null;
        }
        $text = (string)($item['text'] ?? '');
        if (strlen($text) > 4000) {
            $text = substr($text, 0, 4000);
        }
        $date = trim((string)($item['date'] ?? ''));
        if ($date !== '') {
            $ts = strtotime($date);
            if ($ts !== false) {
                $date = date('c', $ts);
            }
        }
        return [
            'guest_id' => $guestId,
            'phone' => $phone,
            'message_guid' => $guid,
            'rowid' => (int)($item['rowid'] ?? 0),
            'date' => $date,
            'text' => $text,
            'is_reaction' => !empty($item['is_reaction']),
        ];
    }

    /**
     * Create one pending Ask-Celebr8r request per party for inbound RSVP replies.
     * Dedupes by message_guid across prior rsvp requests and rsvp notes. Caps payload size.
     *
     * Accepts either:
     *   { party_id, messages: [...] }
     * or { parties: [ { party_id, messages: [...] }, ... ] }
     *
     * @return array{created:list<array>,skipped_guids:list<string>,empty_parties:list<int>}
     */
    public static function createRsvpRequests(array $body): array
    {
        self::ensureSchema();
        $batches = [];
        if (isset($body['parties']) && is_array($body['parties'])) {
            foreach ($body['parties'] as $batch) {
                if (is_array($batch)) {
                    $batches[] = $batch;
                }
            }
        } else {
            $batches[] = $body;
        }
        if ($batches === []) {
            throw new InvalidArgumentException('parties or party_id+messages required');
        }

        $known = self::knownRsvpMessageGuids();
        $created = [];
        $skipped = [];
        $emptyParties = [];

        foreach ($batches as $batch) {
            $partyId = (int)($batch['party_id'] ?? $batch['event_id'] ?? 0);
            if ($partyId <= 0) {
                throw new InvalidArgumentException('party_id required');
            }
            if (!Celebr8Model::getEvent($partyId)) {
                throw new InvalidArgumentException('Party not found: ' . $partyId);
            }
            $rawMessages = $batch['messages'] ?? $batch['payload'] ?? [];
            if (!is_array($rawMessages)) {
                throw new InvalidArgumentException('messages must be an array');
            }

            $payload = [];
            foreach ($rawMessages as $raw) {
                if (!is_array($raw)) {
                    continue;
                }
                $item = self::normalizeRsvpPayloadItem($raw);
                if ($item === null) {
                    continue;
                }
                $guid = $item['message_guid'];
                if (isset($known[$guid])) {
                    $skipped[] = $guid;
                    continue;
                }
                // Guest must belong to this party.
                $guest = Celebr8Model::getGuest($item['guest_id']);
                if (!$guest || (int)$guest['event_id'] !== $partyId) {
                    continue;
                }
                if ($item['phone'] === '' && !empty($guest['phone'])) {
                    $item['phone'] = Celebr8Model::normalizePhone((string)$guest['phone']);
                }
                $known[$guid] = true;
                $payload[] = $item;
                if (count($payload) >= self::RSVP_PAYLOAD_CAP) {
                    break;
                }
            }

            if ($payload === []) {
                $emptyParties[] = $partyId;
                continue;
            }

            $count = count($payload);
            $previewNames = [];
            foreach (array_slice($payload, 0, 5) as $p) {
                $g = Celebr8Model::getGuest((int)$p['guest_id']);
                if ($g) {
                    $previewNames[] = (string)$g['name'];
                }
            }
            $requestText = 'Inbound RSVP replies (' . $count . ') for party_id=' . $partyId
                . ($previewNames !== [] ? ': ' . implode(', ', $previewNames) : '')
                . '. Parse each payload item, call set_rsvp_note, then mark this request done.';
            if (strlen($requestText) > 8000) {
                $requestText = substr($requestText, 0, 7999) . '…';
            }

            $req = self::createRequest([
                'party_id' => $partyId,
                'request_type' => 'rsvp',
                'type' => 'rsvp',
                'request_text' => $requestText,
                'show_before_sending' => 0,
                'audience_type' => 'none',
                'payload' => $payload,
            ], null);
            $created[] = $req;
        }

        return [
            'created' => $created,
            'skipped_guids' => array_values(array_unique($skipped)),
            'empty_parties' => $emptyParties,
        ];
    }

    public static function deleteRequest(int $requestId): bool
    {
        self::ensureSchema();
        if ($requestId <= 0) {
            return false;
        }
        $existing = self::getRequest($requestId);
        if (!$existing) {
            return false;
        }
        Database::execute('DELETE FROM celebr8_requests WHERE id = ?', [$requestId]);
        return true;
    }

    public static function listThread(int $requestId): array
    {
        self::ensureSchema();
        $rows = Database::queryAll(
            'SELECT * FROM celebr8_request_messages WHERE request_id = ? ORDER BY id ASC',
            [$requestId]
        );
        return array_map([self::class, 'toThreadMessage'], $rows);
    }

    public static function listOutboxForRequest(int $requestId): array
    {
        self::ensureSchema();
        $rows = Database::queryAll(
            'SELECT * FROM celebr8_text_messages WHERE request_id = ? ORDER BY id ASC',
            [$requestId]
        );
        return array_map([Celebr8Model::class, 'toMessage'], $rows);
    }

    public static function getRequestDetail(int $id): ?array
    {
        $req = self::getRequest($id);
        if (!$req) {
            return null;
        }
        return [
            'request' => $req,
            'thread' => self::listThread($id),
            'outbox' => self::listOutboxForRequest($id),
        ];
    }

    public static function addThreadMessage(int $requestId, string $role, string $body, ?int $userId): array
    {
        self::ensureSchema();
        $role = strtolower(trim($role));
        if (!in_array($role, self::MESSAGE_ROLES, true)) {
            throw new InvalidArgumentException('Invalid author_role');
        }
        $body = trim($body);
        if ($body === '') {
            throw new InvalidArgumentException('Message body is required');
        }
        if (strlen($body) > 8000) {
            throw new InvalidArgumentException('Message body too long');
        }
        if (!self::getRequest($requestId)) {
            throw new InvalidArgumentException('Request not found');
        }
        Database::execute(
            'INSERT INTO celebr8_request_messages (request_id, author_role, body, created_by_user_id)
             VALUES (?, ?, ?, ?)',
            [$requestId, $role, $body, $userId]
        );
        $id = (int)Database::getInstance()->lastInsertId();
        $row = Database::queryOne('SELECT * FROM celebr8_request_messages WHERE id = ?', [$id]);
        if (!$row) {
            throw new RuntimeException('Failed to load thread message');
        }
        return self::toThreadMessage($row);
    }

    public static function postJonFollowUp(int $requestId, string $body, ?int $userId): array
    {
        $msg = self::addThreadMessage($requestId, 'jon', $body, $userId);
        Database::execute(
            "UPDATE celebr8_requests
             SET status = ?, notified_at = NULL, claimed_at = NULL, claimed_by = '',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?",
            ['pending', $requestId]
        );
        $detail = self::getRequestDetail($requestId);
        if (!$detail) {
            throw new RuntimeException('Failed to reload request');
        }
        $detail['message'] = $msg;
        return $detail;
    }

    public static function claimRequest(int $requestId, string $claimedBy = 'celebr8r'): ?array
    {
        self::ensureSchema();
        $claimedBy = trim($claimedBy);
        if ($claimedBy === '') {
            $claimedBy = 'celebr8r';
        }
        $existing = self::getRequest($requestId);
        if (!$existing) {
            return null;
        }
        if ($existing['status'] === 'working' && $existing['claimed_by'] === $claimedBy) {
            return $existing;
        }
        $pdo = Database::getInstance();
        $stmt = $pdo->prepare(
            'UPDATE celebr8_requests
             SET status = ?, claimed_at = NOW(), claimed_by = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND status IN (?, ?)'
        );
        $stmt->execute(['working', $claimedBy, $requestId, 'pending', 'notified']);
        if ($stmt->rowCount() !== 1) {
            $again = self::getRequest($requestId);
            $status = $again['status'] ?? 'missing';
            throw new InvalidArgumentException('Request is not claimable (status=' . $status . ')');
        }
        $req = self::getRequest($requestId);
        if (!$req) {
            throw new RuntimeException('Failed to load claimed request');
        }
        return $req;
    }

    public static function setRequestStatus(int $requestId, string $status): array
    {
        self::ensureSchema();
        $status = strtolower(trim($status));
        if (!in_array($status, self::REQUEST_STATUSES, true)) {
            throw new InvalidArgumentException('Invalid status');
        }
        if (!self::getRequest($requestId)) {
            throw new InvalidArgumentException('Request not found');
        }
        if ($status === 'pending') {
            Database::execute(
                "UPDATE celebr8_requests
                 SET status = ?, notified_at = NULL, claimed_at = NULL, claimed_by = '',
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?",
                [$status, $requestId]
            );
        } elseif ($status === 'notified') {
            Database::execute(
                'UPDATE celebr8_requests
                 SET status = ?, notified_at = NOW(), notify_count = notify_count + 1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?',
                [$status, $requestId]
            );
        } else {
            Database::execute(
                'UPDATE celebr8_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [$status, $requestId]
            );
        }
        $req = self::getRequest($requestId);
        if (!$req) {
            throw new RuntimeException('Failed to reload request');
        }
        return $req;
    }

    /**
     * Requests the relay should wake Celebr8r about.
     * - status=pending (never notified), or
     * - status=notified stuck >15 minutes, notify_count < 3
     */
    public static function listRequestsNeedingNotify(int $limit = 20): array
    {
        self::ensureSchema();
        $limit = max(1, min(50, $limit));
        $rows = Database::queryAll(
            "SELECT r.*, e.title AS party_title
             FROM celebr8_requests r
             LEFT JOIN celebr8_events e ON e.id = r.party_id
             WHERE r.status = 'pending'
                OR (
                    r.status = 'notified'
                    AND r.notify_count < 3
                    AND r.notified_at IS NOT NULL
                    AND r.notified_at < (NOW() - INTERVAL 15 MINUTE)
                )
             ORDER BY r.id ASC
             LIMIT {$limit}"
        );
        return array_map(static fn (array $row): array => self::toRequest($row, true), $rows);
    }

    public static function markRequestNotified(int $requestId): ?array
    {
        self::ensureSchema();
        $req = self::getRequest($requestId);
        if (!$req) {
            return null;
        }
        if (!in_array($req['status'], ['pending', 'notified'], true)) {
            throw new InvalidArgumentException('Request cannot be marked notified from status=' . $req['status']);
        }
        if ($req['status'] === 'notified' && (int)$req['notify_count'] >= 3) {
            throw new InvalidArgumentException('Notify retry limit reached');
        }
        Database::execute(
            'UPDATE celebr8_requests
             SET status = ?, notified_at = NOW(), notify_count = notify_count + 1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND status IN (?, ?)',
            ['notified', $requestId, 'pending', 'notified']
        );
        return self::getRequest($requestId);
    }

    /**
     * Queue outbound texts tied to a Celebr8r request.
     * Each item: guest_id and/or phone, body.
     */
    public static function queueOutboundForRequest(int $requestId, array $messages): array
    {
        self::ensureSchema();
        $req = self::getRequest($requestId);
        if (!$req) {
            throw new InvalidArgumentException('Request not found');
        }
        $partyId = $req['party_id'];
        if ($partyId === null || $partyId <= 0) {
            throw new InvalidArgumentException('Request has no party_id; cannot queue texts');
        }
        if (!is_array($messages) || $messages === []) {
            throw new InvalidArgumentException('messages array required');
        }

        $cap = self::queueCapPerRequest();
        $existingCount = (int)(Database::queryOne(
            'SELECT COUNT(*) AS c FROM celebr8_text_messages WHERE request_id = ?',
            [$requestId]
        )['c'] ?? 0);
        $remaining = $cap - $existingCount;
        if ($remaining <= 0) {
            throw new InvalidArgumentException("Queue cap reached for this request ({$cap})");
        }
        if (count($messages) > $remaining) {
            throw new InvalidArgumentException(
                "Too many messages for this request (remaining {$remaining}, cap {$cap})"
            );
        }

        $queued = [];
        $skipped = [];
        foreach ($messages as $item) {
            if (!is_array($item)) {
                $skipped[] = ['reason' => 'invalid_item'];
                continue;
            }
            $body = trim((string)($item['body'] ?? $item['text'] ?? ''));
            if ($body === '') {
                $skipped[] = ['reason' => 'empty_body'];
                continue;
            }
            if (strlen($body) > 4000) {
                $skipped[] = ['reason' => 'body_too_long'];
                continue;
            }

            $guest = null;
            $guestId = (int)($item['guest_id'] ?? 0);
            if ($guestId > 0) {
                $guest = Celebr8Model::getGuest($guestId);
                if (!$guest || (int)$guest['event_id'] !== $partyId) {
                    $skipped[] = ['guest_id' => $guestId, 'reason' => 'guest_not_found'];
                    continue;
                }
            } elseif (!empty($item['phone'])) {
                $guest = Celebr8Model::findGuestByPhone($partyId, (string)$item['phone']);
            }

            if ($guest && Celebr8Model::isBlockedGuestName((string)$guest['name'])) {
                $skipped[] = [
                    'guest_id' => (int)$guest['id'],
                    'name' => (string)$guest['name'],
                    'reason' => 'blocked_guest',
                ];
                continue;
            }

            $to = '';
            if ($guest) {
                $to = trim((string)$guest['phone']);
            }
            if ($to === '' && !empty($item['phone'])) {
                $to = Celebr8Model::normalizePhone((string)$item['phone']);
            }
            if ($to === '' || !Celebr8Model::isValidPhoneOrEmail($to)) {
                $skipped[] = [
                    'guest_id' => $guest ? (int)$guest['id'] : null,
                    'reason' => 'missing_or_invalid_phone',
                ];
                continue;
            }

            Database::execute(
                'INSERT INTO celebr8_text_messages (
                    event_id, guest_id, to_address, body, status, request_id, created_by_user_id
                ) VALUES (?, ?, ?, ?, ?, ?, NULL)',
                [
                    $partyId,
                    $guest ? (int)$guest['id'] : null,
                    $to,
                    $body,
                    'queued',
                    $requestId,
                ]
            );
            $id = (int)Database::getInstance()->lastInsertId();
            $msg = Database::queryOne('SELECT * FROM celebr8_text_messages WHERE id = ?', [$id]);
            if ($msg) {
                $queued[] = Celebr8Model::toMessage($msg);
            }
        }

        return [
            'queued' => $queued,
            'skipped' => $skipped,
            'queue_cap' => $cap,
            'queued_for_request' => $existingCount + count($queued),
        ];
    }

    // --- Guest groups ---

    public static function listGroups(int $eventId): array
    {
        self::ensureSchema();
        $rows = Database::queryAll(
            'SELECT g.*,
                    (SELECT COUNT(*) FROM celebr8_guest_group_members m WHERE m.group_id = g.id) AS member_count
             FROM celebr8_guest_groups g
             WHERE g.event_id = ?
             ORDER BY g.name ASC',
            [$eventId]
        );
        $out = [];
        foreach ($rows as $row) {
            $ids = self::groupMemberIds((int)$row['id']);
            $out[] = self::toGroup($row, $ids);
        }
        return $out;
    }

    public static function getGroup(int $groupId): ?array
    {
        self::ensureSchema();
        $row = Database::queryOne('SELECT * FROM celebr8_guest_groups WHERE id = ?', [$groupId]);
        if (!$row) {
            return null;
        }
        return self::toGroup($row, self::groupMemberIds($groupId));
    }

    public static function groupMemberIds(int $groupId): array
    {
        $rows = Database::queryAll(
            'SELECT guest_id FROM celebr8_guest_group_members WHERE group_id = ? ORDER BY guest_id ASC',
            [$groupId]
        );
        return array_map(static fn (array $r): int => (int)$r['guest_id'], $rows);
    }

    public static function upsertGroup(int $eventId, array $fields): array
    {
        self::ensureSchema();
        if (!Celebr8Model::getEvent($eventId)) {
            throw new InvalidArgumentException('Event not found');
        }
        $id = isset($fields['id']) ? (int)$fields['id'] : 0;
        $name = trim((string)($fields['name'] ?? ''));
        if ($name === '') {
            throw new InvalidArgumentException('Group name is required');
        }
        if (strlen($name) > 191) {
            throw new InvalidArgumentException('Group name too long');
        }
        $notes = array_key_exists('notes', $fields) ? (string)$fields['notes'] : null;
        $guestIds = $fields['guest_ids'] ?? null;

        if ($id > 0) {
            $existing = self::getGroup($id);
            if (!$existing || (int)$existing['event_id'] !== $eventId) {
                throw new InvalidArgumentException('Group not found for event');
            }
            Database::execute(
                'UPDATE celebr8_guest_groups SET name = ?, notes = COALESCE(?, notes) WHERE id = ? AND event_id = ?',
                [$name, $notes, $id, $eventId]
            );
        } else {
            Database::execute(
                'INSERT INTO celebr8_guest_groups (event_id, name, notes) VALUES (?, ?, ?)',
                [$eventId, $name, $notes ?? '']
            );
            $id = (int)Database::getInstance()->lastInsertId();
        }

        if (is_array($guestIds)) {
            self::setGroupMembers($id, $eventId, $guestIds);
        }

        $group = self::getGroup($id);
        if (!$group) {
            throw new RuntimeException('Failed to load group');
        }
        return $group;
    }

    public static function setGroupMembers(int $groupId, int $eventId, array $guestIds): void
    {
        self::ensureSchema();
        $clean = array_values(array_unique(array_filter(array_map('intval', $guestIds), static fn (int $id): bool => $id > 0)));
        $valid = [];
        foreach ($clean as $guestId) {
            $guest = Celebr8Model::getGuest($guestId);
            if (!$guest || (int)$guest['event_id'] !== $eventId) {
                continue;
            }
            if (Celebr8Model::isBlockedGuestName((string)$guest['name'])) {
                continue;
            }
            $valid[] = $guestId;
        }
        Database::execute('DELETE FROM celebr8_guest_group_members WHERE group_id = ?', [$groupId]);
        foreach ($valid as $guestId) {
            Database::execute(
                'INSERT INTO celebr8_guest_group_members (group_id, guest_id) VALUES (?, ?)',
                [$groupId, $guestId]
            );
        }
    }

    public static function deleteGroup(int $eventId, int $groupId): bool
    {
        self::ensureSchema();
        $affected = Database::execute(
            'DELETE FROM celebr8_guest_groups WHERE id = ? AND event_id = ?',
            [$groupId, $eventId]
        );
        return $affected > 0;
    }

    /** Groups that include a given guest (for UI chips). */
    public static function groupsForGuest(int $eventId, int $guestId): array
    {
        self::ensureSchema();
        $rows = Database::queryAll(
            'SELECT g.*
             FROM celebr8_guest_groups g
             INNER JOIN celebr8_guest_group_members m ON m.group_id = g.id
             WHERE g.event_id = ? AND m.guest_id = ?
             ORDER BY g.name ASC',
            [$eventId, $guestId]
        );
        return array_map(static fn (array $row): array => self::toGroup($row, null), $rows);
    }
}
