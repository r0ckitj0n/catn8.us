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
            tagline VARCHAR(255) NOT NULL DEFAULT '',
            theme VARCHAR(255) NOT NULL DEFAULT '',
            event_date VARCHAR(255) NOT NULL DEFAULT '',
            event_time VARCHAR(128) NOT NULL DEFAULT '',
            arrival_time_kids VARCHAR(128) NOT NULL DEFAULT '',
            arrival_time_adults VARCHAR(128) NOT NULL DEFAULT '',
            location VARCHAR(512) NOT NULL DEFAULT '',
            food TEXT NULL,
            schedule TEXT NULL,
            rsvp_deadline VARCHAR(64) NOT NULL DEFAULT '',
            invite_text TEXT NULL,
            flyer_image_url VARCHAR(512) NOT NULL DEFAULT '',
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
            invited_via VARCHAR(191) NOT NULL DEFAULT '',
            relation_label VARCHAR(255) NOT NULL DEFAULT '',
            bringing_chili TINYINT(1) NOT NULL DEFAULT 0,
            bringing VARCHAR(255) NOT NULL DEFAULT '',
            phone_unverified TINYINT(1) NOT NULL DEFAULT 0,
            invite_send_status VARCHAR(32) NOT NULL DEFAULT 'none',
            invite_send_error TEXT NULL,
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

        self::ensureEventColumns();
        self::ensureGuestColumns();
        // Mark ensured before seed so updateEvent/getEvent do not recurse.
        self::$schemaEnsured = true;
        require_once __DIR__ . '/celebr8_catalog_model.php';
        Celebr8CatalogModel::ensureSchema();
        self::seedHalloween2026IfNeeded();
    }

    private static function ensureEventColumns(): void
    {
        $cols = [
            'tagline' => "VARCHAR(255) NOT NULL DEFAULT ''",
            'arrival_time_kids' => "VARCHAR(64) NOT NULL DEFAULT ''",
            'arrival_time_adults' => "VARCHAR(64) NOT NULL DEFAULT ''",
            'invite_text' => 'TEXT NULL',
            'flyer_image_url' => "VARCHAR(512) NOT NULL DEFAULT ''",
            'template_id' => 'INT NULL DEFAULT NULL',
            'starts_on' => 'DATE NULL DEFAULT NULL',
        ];
        foreach ($cols as $name => $ddl) {
            self::ensureColumn('celebr8_events', $name, $ddl);
        }
        // Widen timing fields for template-sourced wording.
        self::widenColumn('celebr8_events', 'event_date', "VARCHAR(255) NOT NULL DEFAULT ''");
        self::widenColumn('celebr8_events', 'arrival_time_kids', "VARCHAR(128) NOT NULL DEFAULT ''");
        self::widenColumn('celebr8_events', 'arrival_time_adults', "VARCHAR(128) NOT NULL DEFAULT ''");
        self::backfillStartsOn();
    }

    private static function backfillStartsOn(): void
    {
        $rows = Database::queryAll(
            "SELECT id, event_date FROM celebr8_events WHERE starts_on IS NULL AND event_date <> ''"
        );
        foreach ($rows as $row) {
            $parsed = self::parseStartsOn((string)($row['event_date'] ?? ''));
            if ($parsed === null) {
                continue;
            }
            Database::execute('UPDATE celebr8_events SET starts_on = ? WHERE id = ?', [$parsed, (int)$row['id']]);
        }
    }

    private static function widenColumn(string $table, string $column, string $ddl): void
    {
        $row = Database::queryOne(
            'SELECT CHARACTER_MAXIMUM_LENGTH AS len
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
            [$table, $column]
        );
        $len = (int)($row['len'] ?? 0);
        $want = 0;
        if (preg_match('/VARCHAR\((\d+)\)/i', $ddl, $m)) {
            $want = (int)$m[1];
        }
        if ($want > 0 && $len > 0 && $len < $want) {
            Database::execute("ALTER TABLE `{$table}` MODIFY COLUMN `{$column}` {$ddl}");
        }
    }

    private static function ensureGuestColumns(): void
    {
        $cols = [
            'invited_via' => "VARCHAR(191) NOT NULL DEFAULT ''",
            'relation_label' => "VARCHAR(255) NOT NULL DEFAULT ''",
            'bringing_chili' => 'TINYINT(1) NOT NULL DEFAULT 0',
            'bringing' => "VARCHAR(255) NOT NULL DEFAULT ''",
            'phone_unverified' => 'TINYINT(1) NOT NULL DEFAULT 0',
            'invite_send_status' => "VARCHAR(32) NOT NULL DEFAULT 'none'",
            'invite_send_error' => 'TEXT NULL',
        ];
        foreach ($cols as $name => $ddl) {
            self::ensureColumn('celebr8_guests', $name, $ddl);
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

    public static function halloweenEventDefaults(): array
    {
        return [
            'slug' => 'halloween-party-2026',
            'title' => 'Annual Halloween Bash',
            'tagline' => 'A Graveyard Smash!',
            'theme' => 'Annual Halloween Bash — costumes, chili, karaoke',
            'event_date' => 'Friday, Oct 30, 2026',
            'event_time' => '6 PM little bats / 7 PM big monsters',
            'arrival_time_kids' => '6 PM (little bats — kids with early bedtimes)',
            'arrival_time_adults' => '7 PM (big monsters)',
            'location' => '',
            'food' => "Chili Cook-Off: bring a pot — one is crowned champion.\nNot a Chili Chef?: bring an appetizer or dessert for the Monster Munchies table.",
            'schedule' => "Activities:\n- Chili Cook-Off\n- Costume Contest (scariest, funniest, most creative)\n- Karaoke Kraziness (off-key screams encouraged)\n- Monster Munchies table",
            'rsvp_deadline' => '',
            'invite_text' => "🎃 The Graves Are Rising Again for Our Annual HALLOWEEN BASH! 👻",
            'flyer_image_url' => '/images/celebr8/halloween-bash-2026.webp',
            'notes' => 'Jon throws this every year. Location TBD (editable). RSVP deadline / full menu schedule not set yet.',
        ];
    }

    private static function seedHalloween2026IfNeeded(): void
    {
        $defaults = self::halloweenEventDefaults();
        $existing = Database::queryOne(
            'SELECT id, title, event_date, location, flyer_image_url, arrival_time_kids
             FROM celebr8_events WHERE slug = ? LIMIT 1',
            [$defaults['slug']]
        );
        if (!$existing) {
            Database::execute(
                'INSERT INTO celebr8_events (
                    slug, title, tagline, theme, event_date, event_time, arrival_time_kids, arrival_time_adults,
                    location, food, schedule, rsvp_deadline, invite_text, flyer_image_url, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $defaults['slug'], $defaults['title'], $defaults['tagline'], $defaults['theme'],
                    $defaults['event_date'], $defaults['event_time'], $defaults['arrival_time_kids'],
                    $defaults['arrival_time_adults'], $defaults['location'], $defaults['food'],
                    $defaults['schedule'], $defaults['rsvp_deadline'], $defaults['invite_text'],
                    $defaults['flyer_image_url'], $defaults['notes'],
                ]
            );
            return;
        }

        // Upgrade placeholder / prior seed rows to the confirmed 2026 details.
        // Explicit inbox seed / agent update_event owns later edits.
        $title = (string)($existing['title'] ?? '');
        $date = (string)($existing['event_date'] ?? '');
        $flyer = (string)($existing['flyer_image_url'] ?? '');
        $kidsArrival = (string)($existing['arrival_time_kids'] ?? '');
        $needsUpgrade = str_contains($title, 'PLACEHOLDER')
            || $title === 'Halloween Party 2026'
            || str_contains($date, 'PLACEHOLDER')
            || $date === ''
            || $flyer === ''
            || $kidsArrival === '';
        if ($needsUpgrade) {
            $patch = $defaults;
            if (trim((string)($existing['location'] ?? '')) !== '') {
                unset($patch['location']);
            }
            self::updateEvent((int)$existing['id'], $patch);
        }
    }

    public static function isBlockedGuestName(string $name): bool
    {
        $normalized = strtolower(trim(preg_replace('/\s+/', ' ', $name) ?? ''));
        $normalized = str_replace(['.', '-', '_'], '', $normalized);
        $blocked = [
            'jt whetstone',
            'j t whetstone',
            'jtwhetstone',
            'jaytee whetstone',
            'jay tee whetstone',
        ];
        foreach ($blocked as $bad) {
            $badNorm = str_replace(' ', '', $bad);
            if ($normalized === $bad || str_replace(' ', '', $normalized) === $badNorm) {
                return true;
            }
            if (str_contains($normalized, 'whetstone') && (str_contains($normalized, 'jt') || str_contains($normalized, 'jaytee') || str_contains($normalized, 'jay tee'))) {
                return true;
            }
        }
        return false;
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
            'tagline' => (string)($row['tagline'] ?? ''),
            'theme' => (string)($row['theme'] ?? ''),
            'event_date' => (string)($row['event_date'] ?? ''),
            'event_time' => (string)($row['event_time'] ?? ''),
            'arrival_time_kids' => (string)($row['arrival_time_kids'] ?? ''),
            'arrival_time_adults' => (string)($row['arrival_time_adults'] ?? ''),
            'location' => (string)($row['location'] ?? ''),
            'food' => (string)($row['food'] ?? ''),
            'schedule' => (string)($row['schedule'] ?? ''),
            'rsvp_deadline' => (string)($row['rsvp_deadline'] ?? ''),
            'invite_text' => (string)($row['invite_text'] ?? ''),
            'flyer_image_url' => (string)($row['flyer_image_url'] ?? ''),
            'notes' => (string)($row['notes'] ?? ''),
            'template_id' => isset($row['template_id']) && $row['template_id'] !== null ? (int)$row['template_id'] : null,
            'starts_on' => isset($row['starts_on']) && $row['starts_on'] !== null && $row['starts_on'] !== ''
                ? (string)$row['starts_on']
                : null,
            'is_past' => self::eventIsPast($row),
            'totals' => isset($row['going_count']) ? [
                'going' => (int)($row['going_count'] ?? 0),
                'maybe' => (int)($row['maybe_count'] ?? 0),
                'not_going' => (int)($row['not_going_count'] ?? 0),
                'no_reply' => (int)($row['no_reply_count'] ?? 0),
            ] : null,
            'created_at' => (string)($row['created_at'] ?? ''),
            'updated_at' => (string)($row['updated_at'] ?? ''),
        ];
    }

    public static function parseStartsOn(string $eventDate): ?string
    {
        $eventDate = trim($eventDate);
        if ($eventDate === '') {
            return null;
        }
        $t = strtotime($eventDate);
        if ($t === false) {
            return null;
        }
        return date('Y-m-d', $t);
    }

    /** @param array<string,mixed> $row */
    private static function eventIsPast(array $row): bool
    {
        $starts = (string)($row['starts_on'] ?? '');
        if ($starts === '') {
            $parsed = self::parseStartsOn((string)($row['event_date'] ?? ''));
            $starts = $parsed ?? '';
        }
        if ($starts === '') {
            return false;
        }
        return $starts < date('Y-m-d');
    }

    public static function uniqueEventSlug(string $base): string
    {
        $slug = strtolower((string)preg_replace('/[^a-z0-9]+/i', '-', $base));
        $slug = trim($slug, '-') ?: 'party';
        $try = $slug;
        $n = 2;
        while (self::getEventBySlug($try)) {
            $try = $slug . '-' . $n;
            $n++;
        }
        return $try;
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
            'invited_via' => (string)($row['invited_via'] ?? ''),
            'relation_label' => (string)($row['relation_label'] ?? ''),
            'bringing_chili' => (int)($row['bringing_chili'] ?? 0),
            'bringing' => (string)($row['bringing'] ?? ''),
            'phone_unverified' => (int)($row['phone_unverified'] ?? 0),
            'invite_send_status' => (string)($row['invite_send_status'] ?? 'none'),
            'invite_send_error' => $row['invite_send_error'] !== null ? (string)$row['invite_send_error'] : null,
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
        $rows = Database::queryAll(
            'SELECT e.*,
                    COALESCE(SUM(g.rsvp_status = "going"), 0) AS going_count,
                    COALESCE(SUM(g.rsvp_status = "maybe"), 0) AS maybe_count,
                    COALESCE(SUM(g.rsvp_status = "not_going"), 0) AS not_going_count,
                    COALESCE(SUM(g.rsvp_status = "no_reply"), 0) AS no_reply_count
             FROM celebr8_events e
             LEFT JOIN celebr8_guests g ON g.event_id = e.id
             GROUP BY e.id
             ORDER BY (e.starts_on IS NULL) ASC, e.starts_on ASC, e.id ASC'
        );
        $events = array_map([self::class, 'toEvent'], $rows);
        usort($events, static function (array $a, array $b): int {
            $ap = !empty($a['is_past']) ? 1 : 0;
            $bp = !empty($b['is_past']) ? 1 : 0;
            if ($ap !== $bp) {
                return $ap <=> $bp;
            }
            $ad = (string)($a['starts_on'] ?? '');
            $bd = (string)($b['starts_on'] ?? '');
            if ($ap === 1) {
                return $bd <=> $ad;
            }
            if ($ad !== '' && $bd !== '') {
                return $ad <=> $bd;
            }
            return ((int)$a['id']) <=> ((int)$b['id']);
        });
        return $events;
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
            'title', 'tagline', 'theme', 'event_date', 'event_time',
            'arrival_time_kids', 'arrival_time_adults', 'location',
            'food', 'schedule', 'rsvp_deadline', 'invite_text', 'flyer_image_url', 'notes',
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
        if (array_key_exists('event_date', $fields)) {
            $sets[] = '`starts_on` = ?';
            $params[] = self::parseStartsOn((string)$fields['event_date']);
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

    public static function createEvent(array $fields): array
    {
        self::ensureSchema();
        $title = trim((string)($fields['title'] ?? ''));
        if ($title === '') {
            throw new InvalidArgumentException('title is required');
        }
        $slug = trim((string)($fields['slug'] ?? ''));
        if ($slug === '') {
            $slug = self::uniqueEventSlug($title);
        } else {
            $slug = self::uniqueEventSlug($slug);
        }
        $eventDate = (string)($fields['event_date'] ?? '');
        Database::execute(
            'INSERT INTO celebr8_events (
                slug, title, tagline, theme, event_date, event_time, arrival_time_kids, arrival_time_adults,
                location, food, schedule, rsvp_deadline, invite_text, flyer_image_url, notes, template_id, starts_on
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $slug,
                $title,
                (string)($fields['tagline'] ?? ''),
                (string)($fields['theme'] ?? ''),
                $eventDate,
                (string)($fields['event_time'] ?? ''),
                (string)($fields['arrival_time_kids'] ?? ''),
                (string)($fields['arrival_time_adults'] ?? ''),
                (string)($fields['location'] ?? ''),
                (string)($fields['food'] ?? ''),
                (string)($fields['schedule'] ?? ''),
                (string)($fields['rsvp_deadline'] ?? ''),
                (string)($fields['invite_text'] ?? ''),
                (string)($fields['flyer_image_url'] ?? ''),
                (string)($fields['notes'] ?? ''),
                isset($fields['template_id']) && (int)$fields['template_id'] > 0 ? (int)$fields['template_id'] : null,
                self::parseStartsOn($eventDate),
            ]
        );
        $event = self::getEvent((int)Database::getInstance()->lastInsertId());
        if (!$event) {
            throw new RuntimeException('Failed to create party');
        }
        return $event;
    }

    public static function deleteEvent(int $eventId): bool
    {
        self::ensureSchema();
        return Database::execute('DELETE FROM celebr8_events WHERE id = ?', [$eventId]) > 0;
    }

    /**
     * Duplicate a party for reuse next year: copies details and activity picks, not guests.
     *
     * @return array{event: array<string,mixed>, activities: list<array<string,mixed>>}
     */
    public static function duplicateEvent(int $eventId): array
    {
        self::ensureSchema();
        require_once __DIR__ . '/celebr8_catalog_model.php';
        $src = Database::queryOne('SELECT * FROM celebr8_events WHERE id = ? LIMIT 1', [$eventId]);
        if (!$src) {
            throw new InvalidArgumentException('Event not found');
        }
        $title = trim((string)$src['title']);
        if (!preg_match('/\(copy/i', $title)) {
            $title .= ' (copy)';
        }
        $created = self::createEvent([
            'title' => $title,
            'slug' => (string)$src['slug'] . '-copy',
            'tagline' => (string)($src['tagline'] ?? ''),
            'theme' => (string)($src['theme'] ?? ''),
            'event_date' => (string)($src['event_date'] ?? ''),
            'event_time' => (string)($src['event_time'] ?? ''),
            'arrival_time_kids' => (string)($src['arrival_time_kids'] ?? ''),
            'arrival_time_adults' => (string)($src['arrival_time_adults'] ?? ''),
            'location' => (string)($src['location'] ?? ''),
            'food' => (string)($src['food'] ?? ''),
            'schedule' => (string)($src['schedule'] ?? ''),
            'rsvp_deadline' => '',
            'invite_text' => (string)($src['invite_text'] ?? ''),
            'flyer_image_url' => (string)($src['flyer_image_url'] ?? ''),
            'notes' => (string)($src['notes'] ?? ''),
            'template_id' => $src['template_id'] ?? null,
        ]);
        $newId = (int)$created['id'];
        foreach (Celebr8CatalogModel::listEventActivities($eventId) as $ea) {
            Celebr8CatalogModel::attachActivityToEvent($newId, (int)$ea['activity_id'], [
                'time_slot' => $ea['time_slot'],
                'run_by' => $ea['run_by'],
                'prizes' => $ea['prizes'],
                'supplies_checklist' => $ea['supplies_checklist'],
                'sort_order' => $ea['sort_order'],
                'notes' => $ea['notes'],
            ]);
        }
        return [
            'event' => $created,
            'activities' => Celebr8CatalogModel::listEventActivities($newId),
        ];
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

    public static function findGuestByName(int $eventId, string $name): ?array
    {
        self::ensureSchema();
        $name = trim($name);
        if ($name === '') {
            return null;
        }
        $row = Database::queryOne(
            'SELECT * FROM celebr8_guests WHERE event_id = ? AND name = ? LIMIT 1',
            [$eventId, $name]
        );
        return $row ? self::toGuest($row) : null;
    }

    public static function recordHistoricalInvite(
        int $eventId,
        int $guestId,
        string $toAddress,
        string $body,
        string $status,
        string $errorText = ''
    ): void {
        self::ensureSchema();
        if (!in_array($status, ['sent', 'failed'], true)) {
            throw new InvalidArgumentException('Historical invite status must be sent or failed');
        }
        $existing = Database::queryOne(
            'SELECT id FROM celebr8_text_messages
             WHERE event_id = ? AND guest_id = ? AND claimed_by = ? LIMIT 1',
            [$eventId, $guestId, 'seed:invite-2026']
        );
        if ($existing) {
            if ($status === 'sent') {
                Database::execute(
                    'UPDATE celebr8_text_messages
                     SET to_address = ?, body = ?, status = ?, sent_at = COALESCE(sent_at, NOW()),
                         failed_at = NULL, error_text = NULL, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?',
                    [$toAddress, $body, 'sent', (int)$existing['id']]
                );
            } else {
                Database::execute(
                    'UPDATE celebr8_text_messages
                     SET to_address = ?, body = ?, status = ?, failed_at = COALESCE(failed_at, NOW()),
                         error_text = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?',
                    [$toAddress, $body, 'failed', $errorText, (int)$existing['id']]
                );
            }
            return;
        }
        if ($status === 'sent') {
            Database::execute(
                'INSERT INTO celebr8_text_messages (
                    event_id, guest_id, to_address, body, status, claimed_by, sent_at
                ) VALUES (?, ?, ?, ?, ?, ?, NOW())',
                [$eventId, $guestId, $toAddress, $body, 'sent', 'seed:invite-2026']
            );
        } else {
            Database::execute(
                'INSERT INTO celebr8_text_messages (
                    event_id, guest_id, to_address, body, status, claimed_by, failed_at, error_text
                ) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)',
                [$eventId, $guestId, $toAddress, $body, 'failed', 'seed:invite-2026', $errorText]
            );
        }
    }

    public static function upsertGuest(int $eventId, array $fields, string $actorLabel, bool $touchRsvp = false): array
    {
        self::ensureSchema();
        if (!self::getEvent($eventId)) {
            throw new InvalidArgumentException('Event not found');
        }

        $guestId = isset($fields['id']) ? (int)$fields['id'] : 0;
        $name = trim((string)($fields['name'] ?? ''));
        if ($name !== '' && self::isBlockedGuestName($name)) {
            throw new InvalidArgumentException('Guest name is blocked');
        }
        $phone = array_key_exists('phone', $fields) ? self::normalizePhone((string)$fields['phone']) : null;
        $email = array_key_exists('email', $fields) ? trim((string)$fields['email']) : null;
        $notes = array_key_exists('notes', $fields) ? (string)$fields['notes'] : null;
        $partySize = array_key_exists('party_size', $fields) ? max(1, (int)$fields['party_size']) : null;
        $kidsCount = array_key_exists('kids_count', $fields) ? max(0, (int)$fields['kids_count']) : null;
        $invitedVia = array_key_exists('invited_via', $fields) ? trim((string)$fields['invited_via']) : null;
        $relation = array_key_exists('relation_label', $fields) ? trim((string)$fields['relation_label']) : null;
        $bringingChili = array_key_exists('bringing_chili', $fields) ? ((int)$fields['bringing_chili'] ? 1 : 0) : null;
        $bringing = array_key_exists('bringing', $fields) ? trim((string)$fields['bringing']) : null;
        $phoneUnverified = array_key_exists('phone_unverified', $fields) ? ((int)$fields['phone_unverified'] ? 1 : 0) : null;
        $inviteSendStatus = array_key_exists('invite_send_status', $fields) ? trim((string)$fields['invite_send_status']) : null;
        $inviteSendError = array_key_exists('invite_send_error', $fields) ? (string)$fields['invite_send_error'] : null;
        $rsvpProvided = array_key_exists('rsvp_status', $fields);
        $rsvp = $rsvpProvided
            ? (self::normalizeRsvpStatus((string)$fields['rsvp_status']) ?? 'no_reply')
            : null;

        if ($email !== null && $email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('Invalid email');
        }
        if ($phone !== null && $phone !== '' && !self::isValidPhoneOrEmail($phone)) {
            throw new InvalidArgumentException('Invalid phone');
        }
        if ($inviteSendStatus !== null && !in_array($inviteSendStatus, ['none', 'sent', 'failed'], true)) {
            throw new InvalidArgumentException('Invalid invite_send_status');
        }

        if ($guestId <= 0 && $phone) {
            $existingByPhone = self::findGuestByPhone($eventId, $phone);
            if ($existingByPhone) {
                $guestId = (int)$existingByPhone['id'];
            }
        }
        if ($guestId <= 0 && $name !== '') {
            $existingByName = self::findGuestByName($eventId, $name);
            if ($existingByName) {
                $guestId = (int)$existingByName['id'];
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
            if (self::isBlockedGuestName($name)) {
                throw new InvalidArgumentException('Guest name is blocked');
            }
            $phone = $phone ?? (string)$existing['phone'];
            $email = $email ?? (string)$existing['email'];
            $notes = $notes ?? (string)$existing['notes'];
            $partySize = $partySize ?? (int)$existing['party_size'];
            $kidsCount = $kidsCount ?? (int)$existing['kids_count'];
            $invitedVia = $invitedVia ?? (string)$existing['invited_via'];
            $relation = $relation ?? (string)$existing['relation_label'];
            $bringingChili = $bringingChili ?? (int)$existing['bringing_chili'];
            $bringing = $bringing ?? (string)$existing['bringing'];
            $phoneUnverified = $phoneUnverified ?? (int)$existing['phone_unverified'];
            $inviteSendStatus = $inviteSendStatus ?? (string)$existing['invite_send_status'];
            $inviteSendError = $inviteSendError ?? (string)($existing['invite_send_error'] ?? '');
            $rsvpChanged = $rsvpProvided || $touchRsvp;
            $rsvp = $rsvpChanged ? ($rsvp ?? (string)$existing['rsvp_status']) : (string)$existing['rsvp_status'];

            if ($rsvpChanged) {
                Database::execute(
                    'UPDATE celebr8_guests SET
                        name = ?, phone = ?, email = ?, rsvp_status = ?, party_size = ?, kids_count = ?,
                        invited_via = ?, relation_label = ?, bringing_chili = ?, bringing = ?,
                        phone_unverified = ?, invite_send_status = ?, invite_send_error = ?, notes = ?,
                        rsvp_updated_at = NOW(), rsvp_updated_by = ?
                     WHERE id = ? AND event_id = ?',
                    [
                        $name, $phone, $email, $rsvp, $partySize, $kidsCount,
                        $invitedVia, $relation, $bringingChili, $bringing,
                        $phoneUnverified, $inviteSendStatus, $inviteSendError, $notes,
                        $actorLabel, $guestId, $eventId,
                    ]
                );
            } else {
                Database::execute(
                    'UPDATE celebr8_guests SET
                        name = ?, phone = ?, email = ?, party_size = ?, kids_count = ?,
                        invited_via = ?, relation_label = ?, bringing_chili = ?, bringing = ?,
                        phone_unverified = ?, invite_send_status = ?, invite_send_error = ?, notes = ?
                     WHERE id = ? AND event_id = ?',
                    [
                        $name, $phone, $email, $partySize, $kidsCount,
                        $invitedVia, $relation, $bringingChili, $bringing,
                        $phoneUnverified, $inviteSendStatus, $inviteSendError, $notes,
                        $guestId, $eventId,
                    ]
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
                event_id, name, phone, email, rsvp_status, party_size, kids_count,
                invited_via, relation_label, bringing_chili, bringing, phone_unverified,
                invite_send_status, invite_send_error, notes, rsvp_updated_at, rsvp_updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)',
            [
                $eventId,
                $name,
                $phone ?? '',
                $email ?? '',
                $rsvp ?? 'no_reply',
                $partySize ?? 1,
                $kidsCount ?? 0,
                $invitedVia ?? '',
                $relation ?? '',
                $bringingChili ?? 0,
                $bringing ?? '',
                $phoneUnverified ?? 0,
                $inviteSendStatus ?? 'none',
                $inviteSendError,
                $notes ?? '',
                $actorLabel,
            ]
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
