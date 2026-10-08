<?php

declare(strict_types=1);

/**
 * Celebr8 party templates + activity library (login-gated catalog).
 */
final class Celebr8CatalogModel
{
    private static bool $schemaEnsured = false;

    public const ACTIVITY_CATEGORIES = ['contest', 'music', 'food', 'game', 'kids', 'other'];
    public const ACTIVITY_AGES = ['all', 'kids', 'adults'];

    public static function ensureSchema(): void
    {
        if (self::$schemaEnsured) {
            return;
        }

        Database::execute("CREATE TABLE IF NOT EXISTS celebr8_party_templates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            slug VARCHAR(96) NOT NULL,
            name VARCHAR(191) NOT NULL,
            description TEXT NULL,
            theme TEXT NULL,
            taglines_json LONGTEXT NULL,
            usual_timing VARCHAR(255) NOT NULL DEFAULT '',
            food_notes TEXT NULL,
            byob_notes TEXT NULL,
            music_playlist_json LONGTEXT NULL,
            hero_image_path VARCHAR(512) NOT NULL DEFAULT '',
            gallery_json LONGTEXT NULL,
            past_venue_notes TEXT NULL,
            default_activity_names_json LONGTEXT NULL,
            is_suggested TINYINT(1) NOT NULL DEFAULT 0,
            notes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_celebr8_templates_slug (slug)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        Database::execute("CREATE TABLE IF NOT EXISTS celebr8_activities (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(191) NOT NULL,
            party_types_json LONGTEXT NULL,
            category VARCHAR(64) NOT NULL DEFAULT 'other',
            description TEXT NULL,
            ages VARCHAR(32) NOT NULL DEFAULT 'all',
            supplies_json LONGTEXT NULL,
            prizes TEXT NULL,
            setup_notes TEXT NULL,
            source VARCHAR(512) NOT NULL DEFAULT '',
            is_suggested TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_celebr8_activities_category (category),
            KEY idx_celebr8_activities_ages (ages),
            UNIQUE KEY uniq_celebr8_activities_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        Database::execute("CREATE TABLE IF NOT EXISTS celebr8_event_activities (
            id INT AUTO_INCREMENT PRIMARY KEY,
            event_id INT NOT NULL,
            activity_id INT NOT NULL,
            time_slot VARCHAR(128) NOT NULL DEFAULT '',
            run_by VARCHAR(191) NOT NULL DEFAULT '',
            prizes TEXT NULL,
            supplies_checklist_json LONGTEXT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            notes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_celebr8_event_activity (event_id, activity_id),
            KEY idx_celebr8_event_activities_event (event_id),
            CONSTRAINT fk_celebr8_ea_event FOREIGN KEY (event_id) REFERENCES celebr8_events(id) ON DELETE CASCADE,
            CONSTRAINT fk_celebr8_ea_activity FOREIGN KEY (activity_id) REFERENCES celebr8_activities(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        self::ensureColumn(
            'celebr8_events',
            'template_id',
            'INT NULL DEFAULT NULL'
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

    public static function mediaUrl(string $relativePath): string
    {
        $relativePath = ltrim(str_replace('\\', '/', $relativePath), '/');
        if ($relativePath === '') {
            return '';
        }
        return '/api/celebr8_media.php?f=' . rawurlencode($relativePath);
    }

    public static function mediaRoot(): string
    {
        return dirname(__DIR__) . '/private/celebr8';
    }

    public static function resolveMediaPath(string $relativePath): ?string
    {
        $relativePath = ltrim(str_replace('\\', '/', $relativePath), '/');
        if ($relativePath === '' || str_contains($relativePath, '..')) {
            return null;
        }
        if (!preg_match('/^[a-z0-9][a-z0-9_\\/-]*\\.(webp|jpg|jpeg|png|gif)$/i', $relativePath)) {
            return null;
        }
        $full = self::mediaRoot() . '/' . $relativePath;
        $realRoot = realpath(self::mediaRoot());
        $realFile = realpath($full);
        if ($realRoot === false || $realFile === false) {
            return null;
        }
        if (!str_starts_with($realFile, $realRoot . DIRECTORY_SEPARATOR) && $realFile !== $realRoot) {
            return null;
        }
        return is_file($realFile) ? $realFile : null;
    }

    /** @param mixed $value */
    public static function encodeJson($value): string
    {
        $json = json_encode($value ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        return $json === false ? '[]' : $json;
    }

    /** @return array<mixed> */
    public static function decodeJson(?string $raw): array
    {
        if ($raw === null || trim($raw) === '') {
            return [];
        }
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    public static function toTemplate(array $row): array
    {
        $hero = (string)($row['hero_image_path'] ?? '');
        $gallery = self::decodeJson($row['gallery_json'] ?? null);
        $galleryOut = [];
        foreach ($gallery as $item) {
            if (is_string($item)) {
                $galleryOut[] = [
                    'path' => $item,
                    'url' => self::mediaUrl($item),
                    'label' => '',
                    'is_suggested' => 0,
                ];
            } elseif (is_array($item)) {
                $path = (string)($item['path'] ?? '');
                $galleryOut[] = [
                    'path' => $path,
                    'url' => $path !== '' ? self::mediaUrl($path) : '',
                    'label' => (string)($item['label'] ?? ''),
                    'is_suggested' => !empty($item['is_suggested']) ? 1 : 0,
                ];
            }
        }

        return [
            'id' => (int)($row['id'] ?? 0),
            'slug' => (string)($row['slug'] ?? ''),
            'name' => (string)($row['name'] ?? ''),
            'description' => (string)($row['description'] ?? ''),
            'theme' => (string)($row['theme'] ?? ''),
            'taglines' => self::decodeJson($row['taglines_json'] ?? null),
            'usual_timing' => (string)($row['usual_timing'] ?? ''),
            'food_notes' => (string)($row['food_notes'] ?? ''),
            'byob_notes' => (string)($row['byob_notes'] ?? ''),
            'music_playlist' => self::decodeJson($row['music_playlist_json'] ?? null),
            'hero_image_path' => $hero,
            'hero_image_url' => $hero !== '' ? self::mediaUrl($hero) : '',
            'gallery' => $galleryOut,
            'past_venue_notes' => (string)($row['past_venue_notes'] ?? ''),
            'default_activity_names' => self::decodeJson($row['default_activity_names_json'] ?? null),
            'is_suggested' => (int)($row['is_suggested'] ?? 0),
            'notes' => (string)($row['notes'] ?? ''),
            'created_at' => (string)($row['created_at'] ?? ''),
            'updated_at' => (string)($row['updated_at'] ?? ''),
        ];
    }

    public static function toActivity(array $row): array
    {
        return [
            'id' => (int)($row['id'] ?? 0),
            'name' => (string)($row['name'] ?? ''),
            'party_types' => self::decodeJson($row['party_types_json'] ?? null),
            'category' => (string)($row['category'] ?? 'other'),
            'description' => (string)($row['description'] ?? ''),
            'ages' => (string)($row['ages'] ?? 'all'),
            'supplies' => self::decodeJson($row['supplies_json'] ?? null),
            'prizes' => $row['prizes'] !== null ? (string)$row['prizes'] : null,
            'setup_notes' => (string)($row['setup_notes'] ?? ''),
            'source' => (string)($row['source'] ?? ''),
            'is_suggested' => (int)($row['is_suggested'] ?? 0),
            'created_at' => (string)($row['created_at'] ?? ''),
            'updated_at' => (string)($row['updated_at'] ?? ''),
        ];
    }

    public static function toEventActivity(array $row): array
    {
        $activity = self::toActivity($row);
        return [
            'id' => (int)($row['ea_id'] ?? $row['id'] ?? 0),
            'event_id' => (int)($row['event_id'] ?? 0),
            'activity_id' => (int)($row['activity_id'] ?? $activity['id']),
            'time_slot' => (string)($row['time_slot'] ?? ''),
            'run_by' => (string)($row['run_by'] ?? ''),
            'prizes' => $row['ea_prizes'] !== null ? (string)$row['ea_prizes'] : ($activity['prizes'] ?? null),
            'supplies_checklist' => self::decodeJson($row['supplies_checklist_json'] ?? null),
            'sort_order' => (int)($row['sort_order'] ?? 0),
            'notes' => (string)($row['ea_notes'] ?? $row['notes'] ?? ''),
            'activity' => $activity,
        ];
    }

    /** @return list<array<string,mixed>> */
    public static function listTemplates(): array
    {
        self::ensureSchema();
        $rows = Database::queryAll('SELECT * FROM celebr8_party_templates ORDER BY name ASC, id ASC');
        return array_map([self::class, 'toTemplate'], $rows);
    }

    public static function getTemplate(int $id): ?array
    {
        self::ensureSchema();
        $row = Database::queryOne('SELECT * FROM celebr8_party_templates WHERE id = ? LIMIT 1', [$id]);
        return $row ? self::toTemplate($row) : null;
    }

    public static function getTemplateBySlug(string $slug): ?array
    {
        self::ensureSchema();
        $row = Database::queryOne('SELECT * FROM celebr8_party_templates WHERE slug = ? LIMIT 1', [$slug]);
        return $row ? self::toTemplate($row) : null;
    }

    public static function upsertTemplate(array $fields): array
    {
        self::ensureSchema();
        $id = (int)($fields['id'] ?? 0);
        $slug = trim((string)($fields['slug'] ?? ''));
        $name = trim((string)($fields['name'] ?? ''));
        if ($name === '') {
            throw new InvalidArgumentException('name is required');
        }
        if ($slug === '') {
            $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $name) ?? 'template');
            $slug = trim($slug, '-') ?: 'template';
        }

        $taglines = $fields['taglines'] ?? self::decodeJson(isset($fields['taglines_json']) ? (string)$fields['taglines_json'] : null);
        $music = $fields['music_playlist'] ?? self::decodeJson(isset($fields['music_playlist_json']) ? (string)$fields['music_playlist_json'] : null);
        $gallery = $fields['gallery'] ?? self::decodeJson(isset($fields['gallery_json']) ? (string)$fields['gallery_json'] : null);
        $defaults = $fields['default_activity_names']
            ?? self::decodeJson(isset($fields['default_activity_names_json']) ? (string)$fields['default_activity_names_json'] : null);

        $payload = [
            $slug,
            $name,
            (string)($fields['description'] ?? ''),
            (string)($fields['theme'] ?? ''),
            self::encodeJson(is_array($taglines) ? $taglines : []),
            (string)($fields['usual_timing'] ?? ''),
            (string)($fields['food_notes'] ?? ''),
            (string)($fields['byob_notes'] ?? ''),
            self::encodeJson(is_array($music) ? $music : []),
            (string)($fields['hero_image_path'] ?? ''),
            self::encodeJson(is_array($gallery) ? $gallery : []),
            (string)($fields['past_venue_notes'] ?? ''),
            self::encodeJson(is_array($defaults) ? $defaults : []),
            !empty($fields['is_suggested']) ? 1 : 0,
            (string)($fields['notes'] ?? ''),
        ];

        if ($id > 0) {
            $existing = self::getTemplate($id);
            if (!$existing) {
                throw new InvalidArgumentException('Template not found');
            }
            Database::execute(
                'UPDATE celebr8_party_templates SET
                    slug = ?, name = ?, description = ?, theme = ?, taglines_json = ?,
                    usual_timing = ?, food_notes = ?, byob_notes = ?, music_playlist_json = ?,
                    hero_image_path = ?, gallery_json = ?, past_venue_notes = ?,
                    default_activity_names_json = ?, is_suggested = ?, notes = ?
                 WHERE id = ?',
                [...$payload, $id]
            );
            $out = self::getTemplate($id);
        } else {
            $bySlug = self::getTemplateBySlug($slug);
            if ($bySlug) {
                $fields['id'] = (int)$bySlug['id'];
                return self::upsertTemplate($fields);
            }
            Database::execute(
                'INSERT INTO celebr8_party_templates (
                    slug, name, description, theme, taglines_json, usual_timing, food_notes, byob_notes,
                    music_playlist_json, hero_image_path, gallery_json, past_venue_notes,
                    default_activity_names_json, is_suggested, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                $payload
            );
            $newId = (int)Database::getInstance()->lastInsertId();
            $out = self::getTemplate($newId);
        }
        if (!$out) {
            throw new RuntimeException('Failed to load template');
        }
        return $out;
    }

    public static function deleteTemplate(int $id): bool
    {
        self::ensureSchema();
        return Database::execute('DELETE FROM celebr8_party_templates WHERE id = ?', [$id]) > 0;
    }

    /**
     * @return list<array<string,mixed>>
     */
    public static function listActivities(?string $partyType = null, ?string $category = null, ?string $ages = null): array
    {
        self::ensureSchema();
        $rows = Database::queryAll('SELECT * FROM celebr8_activities ORDER BY name ASC, id ASC');
        $out = [];
        foreach ($rows as $row) {
            $activity = self::toActivity($row);
            if ($partyType !== null && $partyType !== '') {
                if (!in_array($partyType, $activity['party_types'], true)) {
                    continue;
                }
            }
            if ($category !== null && $category !== '' && $activity['category'] !== $category) {
                continue;
            }
            if ($ages !== null && $ages !== '' && $activity['ages'] !== $ages) {
                continue;
            }
            $out[] = $activity;
        }
        return $out;
    }

    public static function getActivity(int $id): ?array
    {
        self::ensureSchema();
        $row = Database::queryOne('SELECT * FROM celebr8_activities WHERE id = ? LIMIT 1', [$id]);
        return $row ? self::toActivity($row) : null;
    }

    public static function getActivityByName(string $name): ?array
    {
        self::ensureSchema();
        $row = Database::queryOne('SELECT * FROM celebr8_activities WHERE name = ? LIMIT 1', [trim($name)]);
        return $row ? self::toActivity($row) : null;
    }

    public static function upsertActivity(array $fields): array
    {
        self::ensureSchema();
        $id = (int)($fields['id'] ?? 0);
        $name = trim((string)($fields['name'] ?? ''));
        if ($name === '') {
            throw new InvalidArgumentException('name is required');
        }
        $category = trim((string)($fields['category'] ?? 'other'));
        if (!in_array($category, self::ACTIVITY_CATEGORIES, true)) {
            $category = 'other';
        }
        $ages = trim((string)($fields['ages'] ?? 'all'));
        if (!in_array($ages, self::ACTIVITY_AGES, true)) {
            $ages = 'all';
        }
        $partyTypes = $fields['party_types'] ?? [];
        if (!is_array($partyTypes)) {
            $partyTypes = [];
        }
        $supplies = $fields['supplies'] ?? [];
        if (!is_array($supplies)) {
            $supplies = [];
        }
        $source = (string)($fields['source'] ?? '');
        $isSuggested = !empty($fields['is_suggested']) || strtolower(trim($source)) === 'suggested' ? 1 : 0;
        $prizes = array_key_exists('prizes', $fields) ? ($fields['prizes'] !== null ? (string)$fields['prizes'] : null) : null;

        if ($id > 0) {
            $existing = self::getActivity($id);
            if (!$existing) {
                throw new InvalidArgumentException('Activity not found');
            }
            if ($prizes === null && !array_key_exists('prizes', $fields)) {
                $prizes = $existing['prizes'];
            }
            Database::execute(
                'UPDATE celebr8_activities SET
                    name = ?, party_types_json = ?, category = ?, description = ?, ages = ?,
                    supplies_json = ?, prizes = ?, setup_notes = ?, source = ?, is_suggested = ?
                 WHERE id = ?',
                [
                    $name,
                    self::encodeJson($partyTypes),
                    $category,
                    (string)($fields['description'] ?? ''),
                    $ages,
                    self::encodeJson($supplies),
                    $prizes,
                    (string)($fields['setup_notes'] ?? ''),
                    $source,
                    $isSuggested,
                    $id,
                ]
            );
            $out = self::getActivity($id);
        } else {
            $byName = self::getActivityByName($name);
            if ($byName) {
                $fields['id'] = (int)$byName['id'];
                return self::upsertActivity($fields);
            }
            Database::execute(
                'INSERT INTO celebr8_activities (
                    name, party_types_json, category, description, ages, supplies_json,
                    prizes, setup_notes, source, is_suggested
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $name,
                    self::encodeJson($partyTypes),
                    $category,
                    (string)($fields['description'] ?? ''),
                    $ages,
                    self::encodeJson($supplies),
                    $prizes,
                    (string)($fields['setup_notes'] ?? ''),
                    $source,
                    $isSuggested,
                ]
            );
            $out = self::getActivity((int)Database::getInstance()->lastInsertId());
        }
        if (!$out) {
            throw new RuntimeException('Failed to load activity');
        }
        return $out;
    }

    public static function deleteActivity(int $id): bool
    {
        self::ensureSchema();
        return Database::execute('DELETE FROM celebr8_activities WHERE id = ?', [$id]) > 0;
    }

    /** @return list<array<string,mixed>> */
    public static function listEventActivities(int $eventId): array
    {
        self::ensureSchema();
        $rows = Database::queryAll(
            'SELECT ea.id AS ea_id, ea.event_id, ea.activity_id, ea.time_slot, ea.run_by,
                    ea.prizes AS ea_prizes, ea.supplies_checklist_json, ea.sort_order, ea.notes AS ea_notes,
                    a.*
             FROM celebr8_event_activities ea
             INNER JOIN celebr8_activities a ON a.id = ea.activity_id
             WHERE ea.event_id = ?
             ORDER BY ea.sort_order ASC, a.name ASC, ea.id ASC',
            [$eventId]
        );
        return array_map([self::class, 'toEventActivity'], $rows);
    }

    public static function attachActivityToEvent(int $eventId, int $activityId, array $fields = []): array
    {
        self::ensureSchema();
        if (!Celebr8Model::getEvent($eventId)) {
            throw new InvalidArgumentException('Event not found');
        }
        $activity = self::getActivity($activityId);
        if (!$activity) {
            throw new InvalidArgumentException('Activity not found');
        }

        $checklist = $fields['supplies_checklist'] ?? null;
        if ($checklist === null) {
            $checklist = [];
            foreach ($activity['supplies'] as $item) {
                $checklist[] = ['item' => (string)$item, 'done' => 0];
            }
        }
        if (!is_array($checklist)) {
            $checklist = [];
        }

        $existing = Database::queryOne(
            'SELECT id FROM celebr8_event_activities WHERE event_id = ? AND activity_id = ? LIMIT 1',
            [$eventId, $activityId]
        );
        $timeSlot = (string)($fields['time_slot'] ?? '');
        $runBy = (string)($fields['run_by'] ?? '');
        $prizes = array_key_exists('prizes', $fields) ? ($fields['prizes'] !== null ? (string)$fields['prizes'] : null) : ($activity['prizes'] ?? null);
        $sort = (int)($fields['sort_order'] ?? 0);
        $notes = (string)($fields['notes'] ?? '');

        if ($existing) {
            $eaId = (int)$existing['id'];
            Database::execute(
                'UPDATE celebr8_event_activities SET
                    time_slot = ?, run_by = ?, prizes = ?, supplies_checklist_json = ?,
                    sort_order = ?, notes = ?
                 WHERE id = ?',
                [$timeSlot, $runBy, $prizes, self::encodeJson($checklist), $sort, $notes, $eaId]
            );
        } else {
            Database::execute(
                'INSERT INTO celebr8_event_activities (
                    event_id, activity_id, time_slot, run_by, prizes, supplies_checklist_json, sort_order, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [$eventId, $activityId, $timeSlot, $runBy, $prizes, self::encodeJson($checklist), $sort, $notes]
            );
            $eaId = (int)Database::getInstance()->lastInsertId();
        }

        $rows = self::listEventActivities($eventId);
        foreach ($rows as $row) {
            if ((int)$row['id'] === $eaId) {
                return $row;
            }
        }
        throw new RuntimeException('Failed to load event activity');
    }

    public static function updateEventActivity(int $eventId, int $eventActivityId, array $fields): array
    {
        self::ensureSchema();
        $row = Database::queryOne(
            'SELECT * FROM celebr8_event_activities WHERE id = ? AND event_id = ? LIMIT 1',
            [$eventActivityId, $eventId]
        );
        if (!$row) {
            throw new InvalidArgumentException('Event activity not found');
        }
        $timeSlot = array_key_exists('time_slot', $fields) ? (string)$fields['time_slot'] : (string)$row['time_slot'];
        $runBy = array_key_exists('run_by', $fields) ? (string)$fields['run_by'] : (string)$row['run_by'];
        $prizes = array_key_exists('prizes', $fields)
            ? ($fields['prizes'] !== null ? (string)$fields['prizes'] : null)
            : ($row['prizes'] !== null ? (string)$row['prizes'] : null);
        $checklist = array_key_exists('supplies_checklist', $fields)
            ? (is_array($fields['supplies_checklist']) ? $fields['supplies_checklist'] : [])
            : self::decodeJson($row['supplies_checklist_json'] ?? null);
        $sort = array_key_exists('sort_order', $fields) ? (int)$fields['sort_order'] : (int)$row['sort_order'];
        $notes = array_key_exists('notes', $fields) ? (string)$fields['notes'] : (string)($row['notes'] ?? '');

        Database::execute(
            'UPDATE celebr8_event_activities SET
                time_slot = ?, run_by = ?, prizes = ?, supplies_checklist_json = ?,
                sort_order = ?, notes = ?
             WHERE id = ? AND event_id = ?',
            [$timeSlot, $runBy, $prizes, self::encodeJson($checklist), $sort, $notes, $eventActivityId, $eventId]
        );

        foreach (self::listEventActivities($eventId) as $ea) {
            if ((int)$ea['id'] === $eventActivityId) {
                return $ea;
            }
        }
        throw new RuntimeException('Failed to load updated event activity');
    }

    public static function detachEventActivity(int $eventId, int $eventActivityId): bool
    {
        self::ensureSchema();
        return Database::execute(
            'DELETE FROM celebr8_event_activities WHERE id = ? AND event_id = ?',
            [$eventActivityId, $eventId]
        ) > 0;
    }

    /**
     * Create a new event from a template. Never copies past venue addresses into location.
     *
     * @return array{event: array<string,mixed>, activities: list<array<string,mixed>>}
     */
    public static function createEventFromTemplate(int $templateId, array $overrides = []): array
    {
        self::ensureSchema();
        Celebr8Model::ensureSchema();
        $template = self::getTemplate($templateId);
        if (!$template) {
            throw new InvalidArgumentException('Template not found');
        }

        $slugBase = trim((string)($overrides['slug'] ?? ($template['slug'] . '-' . date('Y'))));
        $slug = $slugBase;
        $n = 2;
        while (Celebr8Model::getEventBySlug($slug)) {
            $slug = $slugBase . '-' . $n;
            $n++;
        }

        $tagline = '';
        if (!empty($template['taglines'][0]) && is_string($template['taglines'][0])) {
            $tagline = $template['taglines'][0];
        }
        if (!empty($overrides['tagline'])) {
            $tagline = (string)$overrides['tagline'];
        }

        $food = (string)$template['food_notes'];
        if ($template['byob_notes'] !== '') {
            $food = trim($food . "\n" . $template['byob_notes']);
        }

        $scheduleParts = [];
        foreach ($template['default_activity_names'] as $name) {
            if (is_string($name) && $name !== '') {
                $scheduleParts[] = '- ' . $name;
            }
        }
        $schedule = $scheduleParts !== [] ? ("Activities:\n" . implode("\n", $scheduleParts)) : '';

        $notes = (string)$template['notes'];
        if ($template['past_venue_notes'] !== '') {
            $notes = trim($notes . "\n\nPast venues (do not auto-fill location):\n" . $template['past_venue_notes']);
        }
        if ((int)$template['is_suggested'] === 1) {
            $notes = trim("[Suggested template — edit freely]\n" . $notes);
        }

        Database::execute(
            'INSERT INTO celebr8_events (
                slug, title, tagline, theme, event_date, event_time, arrival_time_kids, arrival_time_adults,
                location, food, schedule, rsvp_deadline, invite_text, flyer_image_url, notes, template_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $slug,
                (string)($overrides['title'] ?? $template['name']),
                $tagline,
                (string)($overrides['theme'] ?? $template['theme']),
                (string)($overrides['event_date'] ?? $template['usual_timing']),
                (string)($overrides['event_time'] ?? ''),
                (string)($overrides['arrival_time_kids'] ?? ''),
                (string)($overrides['arrival_time_adults'] ?? ''),
                '', // never copy past venues into location
                (string)($overrides['food'] ?? $food),
                (string)($overrides['schedule'] ?? $schedule),
                '',
                (string)($overrides['invite_text'] ?? $tagline),
                (string)($overrides['flyer_image_url'] ?? ($template['hero_image_url'] ?? '')),
                (string)($overrides['notes'] ?? $notes),
                $templateId,
            ]
        );
        $eventId = (int)Database::getInstance()->lastInsertId();
        $event = Celebr8Model::getEvent($eventId);
        if (!$event) {
            throw new RuntimeException('Failed to create event from template');
        }

        $sort = 0;
        foreach ($template['default_activity_names'] as $name) {
            if (!is_string($name) || trim($name) === '') {
                continue;
            }
            $activity = self::getActivityByName(trim($name));
            if (!$activity) {
                continue;
            }
            self::attachActivityToEvent($eventId, (int)$activity['id'], ['sort_order' => $sort++]);
        }

        return [
            'event' => $event,
            'activities' => self::listEventActivities($eventId),
        ];
    }

    public static function linkEventToTemplate(int $eventId, int $templateId): ?array
    {
        self::ensureSchema();
        Celebr8Model::ensureSchema();
        if (!self::getTemplate($templateId) || !Celebr8Model::getEvent($eventId)) {
            return null;
        }
        Database::execute('UPDATE celebr8_events SET template_id = ? WHERE id = ?', [$templateId, $eventId]);
        return Celebr8Model::getEvent($eventId);
    }
}
