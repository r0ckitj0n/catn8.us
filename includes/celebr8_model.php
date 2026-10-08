<?php

declare(strict_types=1);

final class Celebr8Model
{
    private static bool $schemaEnsured = false;

    public const RSVP_STATUSES = ['going', 'not_going', 'maybe', 'no_reply'];
    public const MESSAGE_STATUSES = ['queued', 'claimed', 'sent', 'failed'];

    public const AGENT_TOKEN_SECRET_KEY = 'celebr8.agent.api_token_hash';
    public const RELAY_TOKEN_SECRET_KEY = 'celebr8.relay.api_token_hash';

    public static function ensureSchema(): void
    {
        if (self::$schemaEnsured) {
            return;
        }

        Database::execute("CREATE TABLE IF NOT EXISTS celebr8_events (
            id INT AUTO_INCREMENT PRIMARY KEY,
            slug VARCHAR(96) NOT NULL,
            title VARCHAR(191) NOT NULL,
            theme VARCHAR(255) NOT NULL DEFAULT '',
            event_date VARCHAR(64) NOT NULL DEFAULT '[PLACEHOLDER: date]',
            event_time VARCHAR(64) NOT NULL DEFAULT '[PLACEHOLDER: time]',
            location VARCHAR(512) NOT NULL DEFAULT '[PLACEHOLDER: location]',
            food TEXT NULL,
            schedule TEXT NULL,
            rsvp_deadline VARCHAR(64) NOT NULL DEFAULT '[PLACEHOLDER: RSVP deadline]',
            notes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_celebr8_events_slug (slug)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        Database::execute("CREATE TABLE IF NOT EXISTS celebr8_guests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            event_id INT NOT NULL,
            name VARCHAR(191) NOT NULL,
            phone VARCHAR(64) NOT NULL DEFAULT '',
            email VARCHAR(191) NOT NULL DEFAULT '',
            rsvp_status VARCHAR(32) NOT NULL DEFAULT 'no_reply',
            party_size INT NOT NULL DEFAULT 1,
            kids_count INT NOT NULL DEFAULT 0,
            notes TEXT NULL,
            rsvp_updated_at DATETIME NULL,
            rsvp_updated_by VARCHAR(191) NOT NULL DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_celebr8_guests_event (event_id),
            KEY idx_celebr8_guests_phone (phone),
            KEY idx_celebr8_guests_rsvp (event_id, rsvp_status),
            CONSTRAINT fk_celebr8_guests_event FOREIGN KEY (event_id) REFERENCES celebr8_events(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        Database::execute("CREATE TABLE IF NOT EXISTS celebr8_text_messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            event_id INT NOT NULL,
            guest_id INT NULL,
            to_address VARCHAR(191) NOT NULL,
            body TEXT NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'queued',
            claimed_at DATETIME NULL,
            claimed_by VARCHAR(191) NOT NULL DEFAULT '',
            sent_at DATETIME NULL,
            failed_at DATETIME NULL,
            error_text TEXT NULL,
            created_by_user_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_celebr8_text_status (status, id),
            KEY idx_celebr8_text_event (event_id),
            KEY idx_celebr8_text_guest (guest_id),
            CONSTRAINT fk_celebr8_text_event FOREIGN KEY (event_id) REFERENCES celebr8_events(id) ON DELETE CASCADE,
            CONSTRAINT fk_celebr8_text_guest FOREIGN KEY (guest_id) REFERENCES celebr8_guests(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        self::seedHalloween2026IfNeeded();
        self::$schemaEnsured = true;
    }

    private static function seedHalloween2026IfNeeded(): void
    {
        $existing = Database::queryOne(
            'SELECT id FROM celebr8_events WHERE slug = ? LIMIT 1',
            ['halloween-party-2026']
        );
        if ($existing) {
            return;
        }

        Database::execute(
            'INSERT INTO celebr8_events (
                slug, title, theme, event_date, event_time, location, food, schedule, rsvp_deadline, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                'halloween-party-2026',
                'Halloween Party 2026',
                '[PLACEHOLDER: theme — e.g. costume contest, haunted hayride]',
                '[PLACEHOLDER: date — TBD from party agent]',
                '[PLACEHOLDER: time — TBD from party agent]',
                '[PLACEHOLDER: location — TBD from party agent]',
                "[PLACEHOLDER: food — menu / potluck notes from party agent]",
                "[PLACEHOLDER: schedule — arrival, activities, wrap-up from party agent]",
                '[PLACEHOLDER: RSVP deadline — TBD from party agent]',
                "[PLACEHOLDER: notes — anything else Jon's party agent will fill in]",
            ]
        );
    }

    public static function normalizeRsvpStatus(string $status): ?string
    {
        $status = strtolower(trim($status));
        $aliases = [
            'yes' => 'going',
            'going' => 'going',
            'attending' => 'going',
            'no' => 'not_going',
            'not_going' => 'not_going',
            'not-going' => 'not_going',
            'declined' => 'not_going',
            'maybe' => 'maybe',
            'undecided' => 'maybe',
            'no_reply' => 'no_reply',
            'no-reply' => 'no_reply',
            'noreply' => 'no_reply',
            'pending' => 'no_reply',
        ];
        if (!isset($aliases[$status])) {
            return null;
        }
        return $aliases[$status];
    }

    public static function normalizePhone(string $raw): string
    {
        $raw = trim($raw);
        if ($raw === '') {
            return '';
        }
        $digits = preg_replace('/\D+/', '', $raw) ?? '';
        if ($digits === '') {
            return '';
        }
        if (strlen($digits) === 10) {
            return '+1' . $digits;
        }
        if (strlen($digits) === 11 && $digits[0] === '1') {
            return '+' . $digits;
        }
        if ($raw[0] === '+') {
            return '+' . $digits;
        }
        return '+' . $digits;
    }

    public static function isValidPhoneOrEmail(string $address): bool
    {
        $address = trim($address);
        if ($address === '') {
            return false;
        }
        if (strpos($address, '@') !== false) {
            return (bool)filter_var($address, FILTER_VALIDATE_EMAIL);
        }
        $normalized = self::normalizePhone($address);
        return (bool)preg_match('/^\+[1-9]\d{7,14}$/', $normalized);
    }

    public static function toEvent(array $row): array
    {
        return [
            'id' => (int)($row['id'] ?? 0),
            'slug' => (string)($row['slug'] ?? ''),
            'title' => (string)($row['title'] ?? ''),
            'theme' => (string)($row['theme'] ?? ''),
            'event_date' => (string)($row['event_date'] ?? ''),
            'event_time' => (string)($row['event_time'] ?? ''),
            'location' => (string)($row['location'] ?? ''),
            'food' => (string)($row['food'] ?? ''),
            'schedule' => (string)($row['schedule'] ?? ''),
            'rsvp_deadline' => (string)($row['rsvp_deadline'] ?? ''),
            'notes' => (string)($row['notes'] ?? ''),
            'created_at' => (string)($row['created_at'] ?? ''),
            'updated_at' => (string)($row['updated_at'] ?? ''),
        ];
    }

    public static function toGuest(array $row): array
    {
        return [
            'id' => (int)($row['id'] ?? 0),
            'event_id' => (int)($row['event_id'] ?? 0),
            'name' => (string)($row['name'] ?? ''),
            'phone' => (string)($row['phone'] ?? ''),
            'email' => (string)($row['email'] ?? ''),
            'rsvp_status' => (string)($row['rsvp_status'] ?? 'no_reply'),
            'party_size' => (int)($row['party_size'] ?? 1),
            'kids_count' => (int)($row['kids_count'] ?? 0),
            'notes' => (string)($row['notes'] ?? ''),
            'rsvp_updated_at' => $row['rsvp_updated_at'] !== null ? (string)$row['rsvp_updated_at'] : null,
            'rsvp_updated_by' => (string)($row['rsvp_updated_by'] ?? ''),
            'created_at' => (string)($row['created_at'] ?? ''),
            'updated_at' => (string)($row['updated_at'] ?? ''),
        ];
    }

    public static function toMessage(array $row): array
    {
        return [
            'id' => (int)($row['id'] ?? 0),
            'event_id' => (int)($row['event_id'] ?? 0),
            'guest_id' => isset($row['guest_id']) && $row['guest_id'] !== null ? (int)$row['guest_id'] : null,
            'to_address' => (string)($row['to_address'] ?? ''),
            'body' => (string)($row['body'] ?? ''),
            'status' => (string)($row['status'] ?? 'queued'),
            'claimed_at' => $row['claimed_at'] !== null ? (string)$row['claimed_at'] : null,
            'claimed_by' => (string)($row['claimed_by'] ?? ''),
            'sent_at' => $row['sent_at'] !== null ? (string)$row['sent_at'] : null,
            'failed_at' => $row['failed_at'] !== null ? (string)$row['failed_at'] : null,
            'error_text' => $row['error_text'] !== null ? (string)$row['error_text'] : null,
            'created_by_user_id' => isset($row['created_by_user_id']) && $row['created_by_user_id'] !== null
                ? (int)$row['created_by_user_id'] : null,
            'created_at' => (string)($row['created_at'] ?? ''),
            'updated_at' => (string)($row['updated_at'] ?? ''),
        ];
    }

    public static function listEvents(): array
    {
        self::ensureSchema();
        $rows = Database::queryAll('SELECT * FROM celebr8_events ORDER BY id ASC');
        return array_map([self::class, 'toEvent'], $rows);
    }

    public static function getEvent(int $eventId): ?array
    {
        self::ensureSchema();
        $row = Database::queryOne('SELECT * FROM celebr8_events WHERE id = ?', [$eventId]);
        return $row ? self::toEvent($row) : null;
    }

    public static function getEventBySlug(string $slug): ?array
    {
        self::ensureSchema();
        $row = Database::queryOne('SELECT * FROM celebr8_events WHERE slug = ?', [$slug]);
        return $row ? self::toEvent($row) : null;
    }

    public static function updateEvent(int $eventId, array $fields): ?array
    {
        self::ensureSchema();
        $allowed = [
            'title', 'theme', 'event_date', 'event_time', 'location',
            'food', 'schedule', 'rsvp_deadline', 'notes',
        ];
        $sets = [];
        $params = [];
        foreach ($allowed as $key) {
            if (!array_key_exists($key, $fields)) {
                continue;
            }
            $sets[] = "`{$key}` = ?";
            $params[] = (string)$fields[$key];
        }
        if ($sets === []) {
            return self::getEvent($eventId);
        }
        $params[] = $eventId;
        Database::execute(
            'UPDATE celebr8_events SET ' . implode(', ', $sets) . ' WHERE id = ?',
            $params
        );
        return self::getEvent($eventId);
    }

    public static function listGuests(int $eventId, ?string $rsvpFilter = null): array
    {
        self::ensureSchema();
        if ($rsvpFilter !== null && $rsvpFilter !== '') {
            $status = self::normalizeRsvpStatus($rsvpFilter);
            if ($status === null) {
                throw new InvalidArgumentException('Invalid rsvp_status filter');
            }
            $rows = Database::queryAll(
                'SELECT * FROM celebr8_guests WHERE event_id = ? AND rsvp_status = ? ORDER BY name ASC, id ASC',
                [$eventId, $status]
            );
        } else {
            $rows = Database::queryAll(
                'SELECT * FROM celebr8_guests WHERE event_id = ? ORDER BY name ASC, id ASC',
                [$eventId]
            );
        }
        return array_map([self::class, 'toGuest'], $rows);
    }

    public static function guestTotals(int $eventId): array
    {
        self::ensureSchema();
        $rows = Database::queryAll(
            'SELECT rsvp_status,
                    COUNT(*) AS guest_count,
                    COALESCE(SUM(party_size), 0) AS headcount,
                    COALESCE(SUM(kids_count), 0) AS kids
             FROM celebr8_guests
             WHERE event_id = ?
             GROUP BY rsvp_status',
            [$eventId]
        );
        $byStatus = [
            'going' => ['guest_count' => 0, 'headcount' => 0, 'kids' => 0],
            'not_going' => ['guest_count' => 0, 'headcount' => 0, 'kids' => 0],
            'maybe' => ['guest_count' => 0, 'headcount' => 0, 'kids' => 0],
            'no_reply' => ['guest_count' => 0, 'headcount' => 0, 'kids' => 0],
        ];
        $totalGuests = 0;
        $totalHeadcount = 0;
        $totalKids = 0;
        foreach ($rows as $row) {
            $status = (string)($row['rsvp_status'] ?? 'no_reply');
            if (!isset($byStatus[$status])) {
                $byStatus[$status] = ['guest_count' => 0, 'headcount' => 0, 'kids' => 0];
            }
            $gc = (int)$row['guest_count'];
            $hc = (int)$row['headcount'];
            $kids = (int)$row['kids'];
            $byStatus[$status] = [
                'guest_count' => $gc,
                'headcount' => $hc,
                'kids' => $kids,
            ];
            $totalGuests += $gc;
            $totalHeadcount += $hc;
            $totalKids += $kids;
        }
        return [
            'by_status' => $byStatus,
            'total_guests' => $totalGuests,
            'total_headcount' => $totalHeadcount,
            'total_kids' => $totalKids,
            'going_headcount' => (int)($byStatus['going']['headcount'] ?? 0),
        ];
    }

    public static function getGuest(int $guestId): ?array
    {
        self::ensureSchema();
        $row = Database::queryOne('SELECT * FROM celebr8_guests WHERE id = ?', [$guestId]);
        return $row ? self::toGuest($row) : null;
    }

    public static function findGuestByPhone(int $eventId, string $phone): ?array
    {
        self::ensureSchema();
        $normalized = self::normalizePhone($phone);
        if ($normalized === '') {
            return null;
        }
        $row = Database::queryOne(
            'SELECT * FROM celebr8_guests WHERE event_id = ? AND phone = ? LIMIT 1',
            [$eventId, $normalized]
        );
        return $row ? self::toGuest($row) : null;
    }

    public static function upsertGuest(int $eventId, array $fields, string $actorLabel, bool $touchRsvp = false): array
    {
        self::ensureSchema();
        if (!self::getEvent($eventId)) {
            throw new InvalidArgumentException('Event not found');
        }

        $guestId = isset($fields['id']) ? (int)$fields['id'] : 0;
        $name = trim((string)($fields['name'] ?? ''));
        $phone = self::normalizePhone((string)($fields['phone'] ?? ''));
        $email = trim((string)($fields['email'] ?? ''));
        $notes = (string)($fields['notes'] ?? '');
        $partySize = max(1, (int)($fields['party_size'] ?? 1));
        $kidsCount = max(0, (int)($fields['kids_count'] ?? 0));
        $rsvp = self::normalizeRsvpStatus((string)($fields['rsvp_status'] ?? 'no_reply')) ?? 'no_reply';

        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('Invalid email');
        }
        if ($phone !== '' && !self::isValidPhoneOrEmail($phone)) {
            throw new InvalidArgumentException('Invalid phone');
        }

        if ($guestId <= 0 && $phone !== '') {
            $existingByPhone = self::findGuestByPhone($eventId, $phone);
            if ($existingByPhone) {
                $guestId = (int)$existingByPhone['id'];
            }
        }

        if ($guestId > 0) {
            $existing = self::getGuest($guestId);
            if (!$existing || (int)$existing['event_id'] !== $eventId) {
                throw new InvalidArgumentException('Guest not found for event');
            }
            if ($name === '') {
                $name = $existing['name'];
            }
            if (!array_key_exists('phone', $fields)) {
                $phone = (string)$existing['phone'];
            }
            if (!array_key_exists('email', $fields)) {
                $email = (string)$existing['email'];
            }
            if (!array_key_exists('notes', $fields)) {
                $notes = (string)$existing['notes'];
            }
            if (!array_key_exists('party_size', $fields)) {
                $partySize = (int)$existing['party_size'];
            }
            if (!array_key_exists('kids_count', $fields)) {
                $kidsCount = (int)$existing['kids_count'];
            }

            $rsvpChanged = false;
            if (array_key_exists('rsvp_status', $fields) || $touchRsvp) {
                $rsvpChanged = true;
            } else {
                $rsvp = (string)$existing['rsvp_status'];
            }

            if ($rsvpChanged) {
                Database::execute(
                    'UPDATE celebr8_guests SET
                        name = ?, phone = ?, email = ?, rsvp_status = ?, party_size = ?, kids_count = ?, notes = ?,
                        rsvp_updated_at = NOW(), rsvp_updated_by = ?
                     WHERE id = ? AND event_id = ?',
                    [$name, $phone, $email, $rsvp, $partySize, $kidsCount, $notes, $actorLabel, $guestId, $eventId]
                );
            } else {
                Database::execute(
                    'UPDATE celebr8_guests SET
                        name = ?, phone = ?, email = ?, party_size = ?, kids_count = ?, notes = ?
                     WHERE id = ? AND event_id = ?',
                    [$name, $phone, $email, $partySize, $kidsCount, $notes, $guestId, $eventId]
                );
            }
            $guest = self::getGuest($guestId);
            if (!$guest) {
                throw new RuntimeException('Failed to load updated guest');
            }
            return $guest;
        }

        if ($name === '') {
            throw new InvalidArgumentException('name is required');
        }

        Database::execute(
            'INSERT INTO celebr8_guests (
                event_id, name, phone, email, rsvp_status, party_size, kids_count, notes,
                rsvp_updated_at, rsvp_updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)',
            [$eventId, $name, $phone, $email, $rsvp, $partySize, $kidsCount, $notes, $actorLabel]
        );
        $id = (int)Database::getInstance()->lastInsertId();
        $guest = self::getGuest($id);
        if (!$guest) {
            throw new RuntimeException('Failed to load created guest');
        }
        return $guest;
    }

    public static function deleteGuest(int $eventId, int $guestId): bool
    {
        self::ensureSchema();
        $affected = Database::execute(
            'DELETE FROM celebr8_guests WHERE id = ? AND event_id = ?',
            [$guestId, $eventId]
        );
        return $affected > 0;
    }

    public static function setRsvp(int $eventId, array $lookup, string $status, string $actorLabel, ?int $partySize = null, ?int $kidsCount = null): array
    {
        self::ensureSchema();
        $normalized = self::normalizeRsvpStatus($status);
        if ($normalized === null) {
            throw new InvalidArgumentException('Invalid rsvp_status');
        }

        $guest = null;
        if (isset($lookup['guest_id']) && (int)$lookup['guest_id'] > 0) {
            $guest = self::getGuest((int)$lookup['guest_id']);
            if (!$guest || (int)$guest['event_id'] !== $eventId) {
                throw new InvalidArgumentException('Guest not found');
            }
        } elseif (!empty($lookup['phone'])) {
            $guest = self::findGuestByPhone($eventId, (string)$lookup['phone']);
            if (!$guest) {
                throw new InvalidArgumentException('Guest not found by phone');
            }
        } else {
            throw new InvalidArgumentException('guest_id or phone required');
        }

        $fields = [
            'id' => $guest['id'],
            'name' => $guest['name'],
            'phone' => $guest['phone'],
            'email' => $guest['email'],
            'notes' => $guest['notes'],
            'party_size' => $partySize !== null ? $partySize : $guest['party_size'],
            'kids_count' => $kidsCount !== null ? $kidsCount : $guest['kids_count'],
            'rsvp_status' => $normalized,
        ];
        return self::upsertGuest($eventId, $fields, $actorLabel, true);
    }

    public static function queueTexts(
        int $eventId,
        string $body,
        array $guestIds,
        ?string $rsvpFilter,
        bool $allGuests,
        int $createdByUserId
    ): array {
        self::ensureSchema();
        $body = trim($body);
        if ($body === '') {
            throw new InvalidArgumentException('Message body is required');
        }
        if (strlen($body) > 4000) {
            throw new InvalidArgumentException('Message body too long');
        }
        if (!self::getEvent($eventId)) {
            throw new InvalidArgumentException('Event not found');
        }

        $guests = self::listGuests($eventId, $rsvpFilter);
        if (!$allGuests) {
            $wanted = array_fill_keys(array_map('intval', $guestIds), true);
            $guests = array_values(array_filter($guests, static function (array $g) use ($wanted): bool {
                return isset($wanted[(int)$g['id']]);
            }));
        }
        if ($guests === []) {
            throw new InvalidArgumentException('No guests selected');
        }

        $queued = [];
        $skipped = [];
        foreach ($guests as $guest) {
            $to = trim((string)$guest['phone']);
            if ($to === '' || !self::isValidPhoneOrEmail($to)) {
                $skipped[] = [
                    'guest_id' => (int)$guest['id'],
                    'name' => (string)$guest['name'],
                    'reason' => 'missing_or_invalid_phone',
                ];
                continue;
            }
            Database::execute(
                'INSERT INTO celebr8_text_messages (
                    event_id, guest_id, to_address, body, status, created_by_user_id
                ) VALUES (?, ?, ?, ?, ?, ?)',
                [$eventId, (int)$guest['id'], $to, $body, 'queued', $createdByUserId]
            );
            $id = (int)Database::getInstance()->lastInsertId();
            $msg = Database::queryOne('SELECT * FROM celebr8_text_messages WHERE id = ?', [$id]);
            if ($msg) {
                $queued[] = self::toMessage($msg);
            }
        }
        return ['queued' => $queued, 'skipped' => $skipped];
    }

    public static function listMessages(int $eventId, ?string $status = null, int $limit = 200): array
    {
        self::ensureSchema();
        $limit = max(1, min(500, $limit));
        if ($status !== null && $status !== '') {
            if (!in_array($status, self::MESSAGE_STATUSES, true)) {
                throw new InvalidArgumentException('Invalid message status');
            }
            $rows = Database::queryAll(
                'SELECT * FROM celebr8_text_messages WHERE event_id = ? AND status = ? ORDER BY id DESC LIMIT ' . $limit,
                [$eventId, $status]
            );
        } else {
            $rows = Database::queryAll(
                'SELECT * FROM celebr8_text_messages WHERE event_id = ? ORDER BY id DESC LIMIT ' . $limit,
                [$eventId]
            );
        }
        return array_map([self::class, 'toMessage'], $rows);
    }

    public static function fetchQueuedForRelay(int $limit = 20): array
    {
        self::ensureSchema();
        $limit = max(1, min(100, $limit));
        $rows = Database::queryAll(
            'SELECT * FROM celebr8_text_messages WHERE status = ? ORDER BY id ASC LIMIT ' . $limit,
            ['queued']
        );
        return array_map([self::class, 'toMessage'], $rows);
    }

    public static function claimMessages(array $ids, string $claimedBy): array
    {
        self::ensureSchema();
        $claimedBy = trim($claimedBy);
        if ($claimedBy === '') {
            $claimedBy = 'relay';
        }
        $claimed = [];
        $pdo = Database::getInstance();
        $pdo->beginTransaction();
        try {
            foreach ($ids as $rawId) {
                $id = (int)$rawId;
                if ($id <= 0) {
                    continue;
                }
                $stmt = $pdo->prepare(
                    'UPDATE celebr8_text_messages
                     SET status = ?, claimed_at = NOW(), claimed_by = ?
                     WHERE id = ? AND status = ?'
                );
                $stmt->execute(['claimed', $claimedBy, $id, 'queued']);
                if ($stmt->rowCount() === 1) {
                    $row = Database::queryOne('SELECT * FROM celebr8_text_messages WHERE id = ?', [$id]);
                    if ($row) {
                        $claimed[] = self::toMessage($row);
                    }
                }
            }
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        return $claimed;
    }

    public static function markMessageSent(int $id): ?array
    {
        self::ensureSchema();
        Database::execute(
            'UPDATE celebr8_text_messages
             SET status = ?, sent_at = NOW(), failed_at = NULL, error_text = NULL
             WHERE id = ? AND status IN (?, ?)',
            ['sent', $id, 'claimed', 'queued']
        );
        $row = Database::queryOne('SELECT * FROM celebr8_text_messages WHERE id = ?', [$id]);
        return $row ? self::toMessage($row) : null;
    }

    public static function markMessageFailed(int $id, string $error): ?array
    {
        self::ensureSchema();
        $error = substr(trim($error), 0, 2000);
        Database::execute(
            'UPDATE celebr8_text_messages
             SET status = ?, failed_at = NOW(), error_text = ?
             WHERE id = ? AND status IN (?, ?)',
            ['failed', $error, $id, 'claimed', 'queued']
        );
        $row = Database::queryOne('SELECT * FROM celebr8_text_messages WHERE id = ?', [$id]);
        return $row ? self::toMessage($row) : null;
    }

    public static function verifyApiToken(string $provided, string $secretKey): bool
    {
        $provided = trim($provided);
        if ($provided === '') {
            return false;
        }
        $stored = secret_get($secretKey);
        if (!is_string($stored) || $stored === '') {
            return false;
        }
        $providedHash = hash('sha256', $provided);
        return hash_equals($stored, $providedHash);
    }

    public static function rotateApiToken(string $secretKey): string
    {
        $token = catn8_random_token();
        $hash = hash('sha256', $token);
        if (!secret_set($secretKey, $hash)) {
            throw new RuntimeException('Failed to store token hash');
        }
        return $token;
    }

    public static function localTokenPath(string $kind): string
    {
        $root = dirname(__DIR__) . '/.local/state/celebr8';
        if ($kind === 'relay') {
            return $root . '/relay-api-token';
        }
        return $root . '/agent-api-token';
    }

    public static function writeLocalTokenFile(string $kind, string $token): string
    {
        $path = self::localTokenPath($kind);
        $dir = dirname($path);
        if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
            throw new RuntimeException('Failed to create token directory');
        }
        if (file_put_contents($path, $token . "\n") === false) {
            throw new RuntimeException('Failed to write token file');
        }
        @chmod($path, 0600);
        return $path;
    }
}
