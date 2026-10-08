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
        $out = [
            'id' => (int)($row['id'] ?? 0),
            'party_id' => isset($row['party_id']) && $row['party_id'] !== null ? (int)$row['party_id'] : null,
            'request_text' => (string)($row['request_text'] ?? ''),
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

        $showBefore = array_key_exists('show_before_sending', $fields)
            ? (!empty($fields['show_before_sending']) ? 1 : 0)
            : 1;

        $audienceType = strtolower(trim((string)($fields['audience_type'] ?? 'none')));
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

        Database::execute(
            'INSERT INTO celebr8_requests (
                party_id, request_text, show_before_sending, audience_type,
                audience_guest_ids, audience_rsvp_status, audience_group_id,
                status, created_by_user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $partyId,
                $text,
                $showBefore,
                $audienceType,
                $guestIds === [] ? null : json_encode($guestIds, JSON_UNESCAPED_SLASHES),
                $rsvp,
                $groupId,
                'pending',
                $userId,
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

    public static function listRequests(?int $partyId = null, ?array $statuses = null, int $limit = 50): array
    {
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
