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
    public const HOLIDAYS = ['Any', 'Halloween', "New Year's Eve", 'Labor Day', 'Birthday', 'Game Night'];
    public const LOCATION_TYPES = ['indoor', 'outdoor', 'both'];
    public const ENERGY_LEVELS = ['low', 'medium', 'high'];
    public const MESS_LEVELS = ['low', 'medium', 'high'];
    public const MOBILITY_LEVELS = ['none', 'low', 'moderate', 'high'];

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
        self::ensureColumn(
            'celebr8_activities',
            'preferred_holiday',
            "VARCHAR(64) NOT NULL DEFAULT 'Any'"
        );
        self::ensureColumn(
            'celebr8_activities',
            'copied_from_activity_id',
            'INT NULL DEFAULT NULL'
        );
        self::ensureActivityDetailColumns();
        self::backfillPreferredHoliday();

        self::$schemaEnsured = true;
    }

    private static function ensureActivityDetailColumns(): void
    {
        $cols = [
            'summary' => 'TEXT NULL',
            'objective' => 'TEXT NULL',
            'how_to_play_json' => 'LONGTEXT NULL',
            'setup_instructions_json' => 'LONGTEXT NULL',
            'teardown_json' => 'LONGTEXT NULL',
            'rules_scoring' => 'TEXT NULL',
            'winning_notes' => 'TEXT NULL',
            'supplies_detail_json' => 'LONGTEXT NULL',
            'estimated_cost_low' => 'DECIMAL(10,2) NULL',
            'estimated_cost_high' => 'DECIMAL(10,2) NULL',
            'setup_minutes' => 'INT NULL',
            'play_minutes' => 'INT NULL',
            'cleanup_minutes' => 'INT NULL',
            'min_players' => 'INT NULL',
            'max_players' => 'INT NULL',
            'age_range' => "VARCHAR(64) NOT NULL DEFAULT ''",
            'kid_friendly' => 'TINYINT(1) NOT NULL DEFAULT 0',
            'location_type' => "VARCHAR(32) NOT NULL DEFAULT 'both'",
            'space_needed' => "VARCHAR(128) NOT NULL DEFAULT ''",
            'energy_level' => "VARCHAR(32) NOT NULL DEFAULT 'medium'",
            'mess_level' => "VARCHAR(32) NOT NULL DEFAULT 'low'",
            'tech_needs' => 'TEXT NULL',
            'volunteers_needed' => "VARCHAR(128) NOT NULL DEFAULT ''",
            'safety_notes' => 'TEXT NULL',
            'variations_json' => 'LONGTEXT NULL',
            'tips' => 'TEXT NULL',
            'printables_json' => 'LONGTEXT NULL',
            'details_filled_at' => 'DATETIME NULL',
            'details_source' => "VARCHAR(191) NOT NULL DEFAULT ''",
            'senior_friendly' => 'TINYINT(1) NOT NULL DEFAULT 0',
            'seated_play' => 'TINYINT(1) NOT NULL DEFAULT 0',
            'mobility_level' => "VARCHAR(32) NOT NULL DEFAULT 'moderate'",
            'hearing_vision_notes' => 'TEXT NULL',
            'senior_role' => 'TEXT NULL',
        ];
        foreach ($cols as $name => $ddl) {
            self::ensureColumn('celebr8_activities', $name, $ddl);
        }
    }

    public static function holidayFromPartyType(string $type): string
    {
        $type = strtolower(trim($type));
        return match ($type) {
            'halloween' => 'Halloween',
            'new-years-eve', 'new_years_eve', 'nye' => "New Year's Eve",
            'labor-day', 'labor_day' => 'Labor Day',
            'milestone-birthday', 'birthday' => 'Birthday',
            'poker-ping-pong', 'game-night', 'game_night' => 'Game Night',
            'any', '' => 'Any',
            default => 'Any',
        };
    }

    public static function normalizeHoliday(string $holiday): string
    {
        $holiday = trim($holiday);
        if ($holiday === '') {
            return 'Any';
        }
        foreach (self::HOLIDAYS as $allowed) {
            if (strcasecmp($allowed, $holiday) === 0) {
                return $allowed;
            }
        }
        return self::holidayFromPartyType($holiday);
    }

    private static function backfillPreferredHoliday(): void
    {
        $rows = Database::queryAll(
            "SELECT id, party_types_json, preferred_holiday
             FROM celebr8_activities
             WHERE preferred_holiday IS NULL OR preferred_holiday = '' OR preferred_holiday = 'Any'"
        );
        foreach ($rows as $row) {
            $current = trim((string)($row['preferred_holiday'] ?? ''));
            if ($current !== '' && $current !== 'Any') {
                continue;
            }
            $types = self::decodeJson($row['party_types_json'] ?? null);
            $first = is_array($types) && isset($types[0]) ? (string)$types[0] : '';
            $holiday = self::holidayFromPartyType($first);
            if ($holiday === 'Any' && ($current === 'Any' || $current === '')) {
                if ($current === 'Any') {
                    continue;
                }
            }
            Database::execute(
                'UPDATE celebr8_activities SET preferred_holiday = ? WHERE id = ?',
                [$holiday, (int)$row['id']]
            );
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

    /** @return list<array{item:string,qty:string,unit_cost_est:?float,notes:string,have:int}> */
    public static function normalizeSuppliesDetail(mixed $raw, array $legacyStrings = []): array
    {
        $out = [];
        if (is_array($raw)) {
            foreach ($raw as $item) {
                if (is_string($item)) {
                    $label = trim($item);
                    if ($label === '') {
                        continue;
                    }
                    $out[] = [
                        'item' => $label,
                        'qty' => '1',
                        'unit_cost_est' => null,
                        'notes' => '',
                        'have' => 0,
                    ];
                    continue;
                }
                if (!is_array($item)) {
                    continue;
                }
                $label = trim((string)($item['item'] ?? $item['name'] ?? ''));
                if ($label === '') {
                    continue;
                }
                $unit = $item['unit_cost_est'] ?? $item['unit_cost'] ?? null;
                $out[] = [
                    'item' => $label,
                    'qty' => trim((string)($item['qty'] ?? $item['quantity'] ?? '1')) ?: '1',
                    'unit_cost_est' => $unit === null || $unit === '' ? null : (float)$unit,
                    'notes' => trim((string)($item['notes'] ?? '')),
                    'have' => !empty($item['have']) ? 1 : 0,
                ];
            }
        }
        if ($out === [] && $legacyStrings !== []) {
            foreach ($legacyStrings as $label) {
                $label = trim((string)$label);
                if ($label === '') {
                    continue;
                }
                $out[] = [
                    'item' => $label,
                    'qty' => '1',
                    'unit_cost_est' => null,
                    'notes' => '',
                    'have' => 0,
                ];
            }
        }
        return $out;
    }

    /** @return list<array{title:string,kind:string,content:string}> */
    public static function normalizePrintables(mixed $raw): array
    {
        $out = [];
        if (!is_array($raw)) {
            return $out;
        }
        foreach ($raw as $item) {
            if (!is_array($item)) {
                continue;
            }
            $title = trim((string)($item['title'] ?? $item['name'] ?? ''));
            $content = (string)($item['content'] ?? '');
            if ($title === '' || trim($content) === '') {
                continue;
            }
            $kind = strtolower(trim((string)($item['kind'] ?? $item['type'] ?? 'sheet')));
            if ($kind === '') {
                $kind = 'sheet';
            }
            $out[] = [
                'title' => $title,
                'kind' => $kind,
                'content' => $content,
            ];
        }
        return $out;
    }

    /** @return list<string> */
    public static function normalizeStepList(mixed $raw): array
    {
        if (!is_array($raw)) {
            if (is_string($raw) && trim($raw) !== '') {
                $parts = preg_split('/\r\n|\r|\n/', $raw) ?: [];
                return array_values(array_filter(array_map('trim', $parts), static fn (string $s): bool => $s !== ''));
            }
            return [];
        }
        $out = [];
        foreach ($raw as $step) {
            if (is_string($step)) {
                $s = trim($step);
                if ($s !== '') {
                    $out[] = $s;
                }
                continue;
            }
            if (is_array($step)) {
                $s = trim((string)($step['text'] ?? $step['step'] ?? $step['body'] ?? ''));
                if ($s !== '') {
                    $out[] = $s;
                }
            }
        }
        return $out;
    }

    public static function toActivity(array $row): array
    {
        $types = self::decodeJson($row['party_types_json'] ?? null);
        $holiday = trim((string)($row['preferred_holiday'] ?? ''));
        if ($holiday === '' && is_array($types) && isset($types[0])) {
            $holiday = self::holidayFromPartyType((string)$types[0]);
        }
        $holiday = self::normalizeHoliday($holiday);
        $copiedFrom = isset($row['copied_from_activity_id']) && $row['copied_from_activity_id'] !== null
            ? (int)$row['copied_from_activity_id']
            : null;
        $supplies = self::decodeJson($row['supplies_json'] ?? null);
        $suppliesLegacy = [];
        foreach ($supplies as $s) {
            if (is_string($s) && trim($s) !== '') {
                $suppliesLegacy[] = trim($s);
            } elseif (is_array($s) && trim((string)($s['item'] ?? '')) !== '') {
                $suppliesLegacy[] = trim((string)$s['item']);
            }
        }
        $location = strtolower(trim((string)($row['location_type'] ?? 'both')));
        if (!in_array($location, self::LOCATION_TYPES, true)) {
            $location = 'both';
        }
        $energy = strtolower(trim((string)($row['energy_level'] ?? 'medium')));
        if (!in_array($energy, self::ENERGY_LEVELS, true)) {
            $energy = 'medium';
        }
        $mess = strtolower(trim((string)($row['mess_level'] ?? 'low')));
        if (!in_array($mess, self::MESS_LEVELS, true)) {
            $mess = 'low';
        }
        $mobility = strtolower(trim((string)($row['mobility_level'] ?? 'moderate')));
        if (!in_array($mobility, self::MOBILITY_LEVELS, true)) {
            $mobility = 'moderate';
        }
        return [
            'id' => (int)($row['id'] ?? 0),
            'name' => (string)($row['name'] ?? ''),
            'preferred_holiday' => $holiday,
            'party_types' => $types,
            'category' => (string)($row['category'] ?? 'other'),
            'description' => (string)($row['description'] ?? ''),
            'ages' => (string)($row['ages'] ?? 'all'),
            'supplies' => $suppliesLegacy,
            'prizes' => $row['prizes'] !== null ? (string)$row['prizes'] : null,
            'setup_notes' => (string)($row['setup_notes'] ?? ''),
            'source' => (string)($row['source'] ?? ''),
            'is_suggested' => (int)($row['is_suggested'] ?? 0),
            'copied_from_activity_id' => $copiedFrom,
            'summary' => (string)($row['summary'] ?? ''),
            'objective' => (string)($row['objective'] ?? ''),
            'how_to_play' => self::normalizeStepList(self::decodeJson($row['how_to_play_json'] ?? null)),
            'setup_instructions' => self::normalizeStepList(self::decodeJson($row['setup_instructions_json'] ?? null)),
            'teardown' => self::normalizeStepList(self::decodeJson($row['teardown_json'] ?? null)),
            'rules_scoring' => (string)($row['rules_scoring'] ?? ''),
            'winning_notes' => (string)($row['winning_notes'] ?? ''),
            'supplies_detail' => self::normalizeSuppliesDetail(
                self::decodeJson($row['supplies_detail_json'] ?? null),
                $suppliesLegacy
            ),
            'estimated_cost_low' => isset($row['estimated_cost_low']) && $row['estimated_cost_low'] !== null
                ? (float)$row['estimated_cost_low'] : null,
            'estimated_cost_high' => isset($row['estimated_cost_high']) && $row['estimated_cost_high'] !== null
                ? (float)$row['estimated_cost_high'] : null,
            'setup_minutes' => isset($row['setup_minutes']) && $row['setup_minutes'] !== null
                ? (int)$row['setup_minutes'] : null,
            'play_minutes' => isset($row['play_minutes']) && $row['play_minutes'] !== null
                ? (int)$row['play_minutes'] : null,
            'cleanup_minutes' => isset($row['cleanup_minutes']) && $row['cleanup_minutes'] !== null
                ? (int)$row['cleanup_minutes'] : null,
            'min_players' => isset($row['min_players']) && $row['min_players'] !== null
                ? (int)$row['min_players'] : null,
            'max_players' => isset($row['max_players']) && $row['max_players'] !== null
                ? (int)$row['max_players'] : null,
            'age_range' => (string)($row['age_range'] ?? ''),
            'kid_friendly' => (int)($row['kid_friendly'] ?? 0),
            'location_type' => $location,
            'space_needed' => (string)($row['space_needed'] ?? ''),
            'energy_level' => $energy,
            'mess_level' => $mess,
            'tech_needs' => (string)($row['tech_needs'] ?? ''),
            'volunteers_needed' => (string)($row['volunteers_needed'] ?? ''),
            'safety_notes' => (string)($row['safety_notes'] ?? ''),
            'variations' => self::decodeJson($row['variations_json'] ?? null),
            'tips' => (string)($row['tips'] ?? ''),
            'printables' => self::normalizePrintables(self::decodeJson($row['printables_json'] ?? null)),
            'details_filled_at' => $row['details_filled_at'] !== null ? (string)$row['details_filled_at'] : null,
            'details_source' => (string)($row['details_source'] ?? ''),
            'senior_friendly' => (int)($row['senior_friendly'] ?? 0),
            'seated_play' => (int)($row['seated_play'] ?? 0),
            'mobility_level' => $mobility,
            'hearing_vision_notes' => (string)($row['hearing_vision_notes'] ?? ''),
            'senior_role' => (string)($row['senior_role'] ?? ''),
            'has_details' => trim((string)($row['summary'] ?? '')) !== ''
                || trim((string)($row['details_filled_at'] ?? '')) !== '',
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
    public static function listActivities(?string $holiday = null, ?string $category = null, ?string $ages = null, ?string $partyType = null): array
    {
        self::ensureSchema();
        $rows = Database::queryAll('SELECT * FROM celebr8_activities ORDER BY name ASC, id ASC');
        $holidayFilter = $holiday;
        if (($holidayFilter === null || $holidayFilter === '') && $partyType) {
            $holidayFilter = self::holidayFromPartyType($partyType);
        }
        if ($holidayFilter !== null && $holidayFilter !== '') {
            $holidayFilter = self::normalizeHoliday($holidayFilter);
        }
        $out = [];
        foreach ($rows as $row) {
            $activity = self::toActivity($row);
            // Preferred holiday is a label/filter only — never a membership constraint.
            if ($holidayFilter !== null && $holidayFilter !== '') {
                if ($activity['preferred_holiday'] !== $holidayFilter) {
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

    /**
     * Merge detail fields from request onto an existing activity (or defaults for insert).
     *
     * @param array<string,mixed> $fields
     * @param array<string,mixed>|null $existing
     * @return array<string,mixed>
     */
    private static function resolveActivityDetailFields(array $fields, ?array $existing): array
    {
        $pick = static function (string $key, mixed $default = '') use ($fields, $existing): mixed {
            if (array_key_exists($key, $fields)) {
                return $fields[$key];
            }
            if ($existing !== null && array_key_exists($key, $existing)) {
                return $existing[$key];
            }
            return $default;
        };

        $legacySupplies = $fields['supplies'] ?? ($existing['supplies'] ?? []);
        if (!is_array($legacySupplies)) {
            $legacySupplies = [];
        }
        $suppliesDetailRaw = $fields['supplies_detail'] ?? $fields['supplies_detail_json'] ?? null;
        if ($suppliesDetailRaw === null && $existing !== null) {
            $suppliesDetailRaw = $existing['supplies_detail'] ?? [];
        }
        $suppliesDetail = self::normalizeSuppliesDetail($suppliesDetailRaw, $legacySupplies);
        if ($suppliesDetail !== [] && $legacySupplies === []) {
            foreach ($suppliesDetail as $row) {
                $legacySupplies[] = (string)$row['item'];
            }
        }

        $howTo = self::normalizeStepList($pick('how_to_play', $pick('how_to_play_json', [])));
        $setupSteps = self::normalizeStepList($pick('setup_instructions', $pick('setup_instructions_json', [])));
        $teardown = self::normalizeStepList($pick('teardown', $pick('teardown_json', [])));
        $variations = $pick('variations', $pick('variations_json', []));
        if (!is_array($variations)) {
            $variations = [];
        }
        $printables = self::normalizePrintables($pick('printables', $pick('printables_json', [])));

        $location = strtolower(trim((string)$pick('location_type', 'both')));
        if (!in_array($location, self::LOCATION_TYPES, true)) {
            $location = 'both';
        }
        $energy = strtolower(trim((string)$pick('energy_level', 'medium')));
        if (!in_array($energy, self::ENERGY_LEVELS, true)) {
            $energy = 'medium';
        }
        $mess = strtolower(trim((string)$pick('mess_level', 'low')));
        if (!in_array($mess, self::MESS_LEVELS, true)) {
            $mess = 'low';
        }
        $mobility = strtolower(trim((string)$pick('mobility_level', 'moderate')));
        if (!in_array($mobility, self::MOBILITY_LEVELS, true)) {
            $mobility = 'moderate';
        }

        $numOrNull = static function (mixed $v): ?float {
            if ($v === null || $v === '') {
                return null;
            }
            return (float)$v;
        };
        $intOrNull = static function (mixed $v): ?int {
            if ($v === null || $v === '') {
                return null;
            }
            return (int)$v;
        };

        $detailsFilledAt = $pick('details_filled_at', null);
        if (array_key_exists('details_filled_at', $fields) && $fields['details_filled_at'] === 'now') {
            $detailsFilledAt = date('Y-m-d H:i:s');
        }

        return [
            'supplies' => $legacySupplies,
            'summary' => (string)$pick('summary', ''),
            'objective' => (string)$pick('objective', ''),
            'how_to_play' => $howTo,
            'setup_instructions' => $setupSteps,
            'teardown' => $teardown,
            'rules_scoring' => (string)$pick('rules_scoring', ''),
            'winning_notes' => (string)$pick('winning_notes', ''),
            'supplies_detail' => $suppliesDetail,
            'estimated_cost_low' => $numOrNull($pick('estimated_cost_low', null)),
            'estimated_cost_high' => $numOrNull($pick('estimated_cost_high', null)),
            'setup_minutes' => $intOrNull($pick('setup_minutes', null)),
            'play_minutes' => $intOrNull($pick('play_minutes', null)),
            'cleanup_minutes' => $intOrNull($pick('cleanup_minutes', null)),
            'min_players' => $intOrNull($pick('min_players', null)),
            'max_players' => $intOrNull($pick('max_players', null)),
            'age_range' => (string)$pick('age_range', ''),
            'kid_friendly' => !empty($pick('kid_friendly', 0)) ? 1 : 0,
            'location_type' => $location,
            'space_needed' => (string)$pick('space_needed', ''),
            'energy_level' => $energy,
            'mess_level' => $mess,
            'tech_needs' => (string)$pick('tech_needs', ''),
            'volunteers_needed' => (string)$pick('volunteers_needed', ''),
            'safety_notes' => (string)$pick('safety_notes', ''),
            'variations' => $variations,
            'tips' => (string)$pick('tips', ''),
            'printables' => $printables,
            'details_filled_at' => $detailsFilledAt !== null && $detailsFilledAt !== ''
                ? (string)$detailsFilledAt : null,
            'details_source' => (string)$pick('details_source', ''),
            'senior_friendly' => !empty($pick('senior_friendly', 0)) ? 1 : 0,
            'seated_play' => !empty($pick('seated_play', 0)) ? 1 : 0,
            'mobility_level' => $mobility,
            'hearing_vision_notes' => (string)$pick('hearing_vision_notes', ''),
            'senior_role' => (string)$pick('senior_role', ''),
        ];
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
        $holiday = '';
        if (array_key_exists('preferred_holiday', $fields)) {
            $holiday = self::normalizeHoliday((string)$fields['preferred_holiday']);
        } elseif ($partyTypes !== []) {
            $holiday = self::holidayFromPartyType((string)$partyTypes[0]);
        }
        $source = (string)($fields['source'] ?? '');
        $isSuggested = !empty($fields['is_suggested']) || strtolower(trim($source)) === 'suggested' ? 1 : 0;
        $prizes = array_key_exists('prizes', $fields) ? ($fields['prizes'] !== null ? (string)$fields['prizes'] : null) : null;
        $copiedFrom = array_key_exists('copied_from_activity_id', $fields)
            ? ((int)$fields['copied_from_activity_id'] ?: null)
            : null;

        $existing = null;
        if ($id > 0) {
            $existing = self::getActivity($id);
            if (!$existing) {
                throw new InvalidArgumentException('Activity not found');
            }
            if ($prizes === null && !array_key_exists('prizes', $fields)) {
                $prizes = $existing['prizes'];
            }
            if ($holiday === '' && !array_key_exists('preferred_holiday', $fields)) {
                $holiday = (string)$existing['preferred_holiday'];
            }
            if ($holiday === '') {
                $holiday = 'Any';
            }
            if ($copiedFrom === null && !array_key_exists('copied_from_activity_id', $fields)) {
                $copiedFrom = $existing['copied_from_activity_id'] ?? null;
            }
            if (!array_key_exists('source', $fields)) {
                $source = (string)$existing['source'];
            }
            if (!array_key_exists('is_suggested', $fields) && strtolower(trim($source)) !== 'suggested') {
                $isSuggested = (int)$existing['is_suggested'];
            }
            if (!array_key_exists('description', $fields)) {
                $fields['description'] = $existing['description'];
            }
            if (!array_key_exists('setup_notes', $fields)) {
                $fields['setup_notes'] = $existing['setup_notes'];
            }
            if (!array_key_exists('party_types', $fields)) {
                $partyTypes = $existing['party_types'];
            }
            if (!array_key_exists('category', $fields)) {
                $category = (string)$existing['category'];
            }
            if (!array_key_exists('ages', $fields)) {
                $ages = (string)$existing['ages'];
            }
        } else {
            if (empty($fields['force_insert'])) {
                $byName = self::getActivityByName($name);
                if ($byName) {
                    $fields['id'] = (int)$byName['id'];
                    return self::upsertActivity($fields);
                }
            }
            if ($holiday === '') {
                $holiday = 'Any';
            }
        }

        $details = self::resolveActivityDetailFields($fields, $existing);

        $coreParams = [
            $name,
            self::encodeJson($partyTypes),
            $holiday,
            $category,
            (string)($fields['description'] ?? ''),
            $ages,
            self::encodeJson($details['supplies']),
            $prizes,
            (string)($fields['setup_notes'] ?? ''),
            $source,
            $isSuggested,
            $copiedFrom,
            (string)$details['summary'],
            (string)$details['objective'],
            self::encodeJson($details['how_to_play']),
            self::encodeJson($details['setup_instructions']),
            self::encodeJson($details['teardown']),
            (string)$details['rules_scoring'],
            (string)$details['winning_notes'],
            self::encodeJson($details['supplies_detail']),
            $details['estimated_cost_low'],
            $details['estimated_cost_high'],
            $details['setup_minutes'],
            $details['play_minutes'],
            $details['cleanup_minutes'],
            $details['min_players'],
            $details['max_players'],
            (string)$details['age_range'],
            (int)$details['kid_friendly'],
            (string)$details['location_type'],
            (string)$details['space_needed'],
            (string)$details['energy_level'],
            (string)$details['mess_level'],
            (string)$details['tech_needs'],
            (string)$details['volunteers_needed'],
            (string)$details['safety_notes'],
            self::encodeJson($details['variations']),
            (string)$details['tips'],
            self::encodeJson($details['printables']),
            $details['details_filled_at'],
            (string)$details['details_source'],
            (int)$details['senior_friendly'],
            (int)$details['seated_play'],
            (string)$details['mobility_level'],
            (string)$details['hearing_vision_notes'],
            (string)$details['senior_role'],
        ];

        if ($id > 0) {
            Database::execute(
                'UPDATE celebr8_activities SET
                    name = ?, party_types_json = ?, preferred_holiday = ?, category = ?, description = ?, ages = ?,
                    supplies_json = ?, prizes = ?, setup_notes = ?, source = ?, is_suggested = ?,
                    copied_from_activity_id = ?,
                    summary = ?, objective = ?, how_to_play_json = ?, setup_instructions_json = ?, teardown_json = ?,
                    rules_scoring = ?, winning_notes = ?, supplies_detail_json = ?,
                    estimated_cost_low = ?, estimated_cost_high = ?,
                    setup_minutes = ?, play_minutes = ?, cleanup_minutes = ?,
                    min_players = ?, max_players = ?, age_range = ?, kid_friendly = ?,
                    location_type = ?, space_needed = ?, energy_level = ?, mess_level = ?,
                    tech_needs = ?, volunteers_needed = ?, safety_notes = ?,
                    variations_json = ?, tips = ?, printables_json = ?,
                    details_filled_at = ?, details_source = ?,
                    senior_friendly = ?, seated_play = ?, mobility_level = ?,
                    hearing_vision_notes = ?, senior_role = ?
                 WHERE id = ?',
                [...$coreParams, $id]
            );
            $out = self::getActivity($id);
        } else {
            Database::execute(
                'INSERT INTO celebr8_activities (
                    name, party_types_json, preferred_holiday, category, description, ages, supplies_json,
                    prizes, setup_notes, source, is_suggested, copied_from_activity_id,
                    summary, objective, how_to_play_json, setup_instructions_json, teardown_json,
                    rules_scoring, winning_notes, supplies_detail_json,
                    estimated_cost_low, estimated_cost_high,
                    setup_minutes, play_minutes, cleanup_minutes,
                    min_players, max_players, age_range, kid_friendly,
                    location_type, space_needed, energy_level, mess_level,
                    tech_needs, volunteers_needed, safety_notes,
                    variations_json, tips, printables_json,
                    details_filled_at, details_source,
                    senior_friendly, seated_play, mobility_level, hearing_vision_notes, senior_role
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                $coreParams
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

    public static function uniqueActivityName(string $base): string
    {
        $base = trim($base) !== '' ? trim($base) : 'Activity copy';
        $name = $base;
        $n = 2;
        while (self::getActivityByName($name)) {
            $name = $base . ' ' . $n;
            $n++;
        }
        return $name;
    }

    public static function copyActivity(int $id, ?string $newName = null): array
    {
        $src = self::getActivity($id);
        if (!$src) {
            throw new InvalidArgumentException('Activity not found');
        }
        $base = $newName !== null && trim($newName) !== ''
            ? trim($newName)
            : ($src['name'] . ' (copy)');
        return self::upsertActivity([
            'name' => self::uniqueActivityName($base),
            'preferred_holiday' => $src['preferred_holiday'],
            'party_types' => $src['party_types'],
            'category' => $src['category'],
            'description' => $src['description'],
            'ages' => $src['ages'],
            'supplies' => $src['supplies'],
            'prizes' => $src['prizes'],
            'setup_notes' => $src['setup_notes'],
            'source' => 'Copied from activity #' . $id . ' (' . $src['name'] . ')',
            'is_suggested' => 0,
            'copied_from_activity_id' => $id,
            'force_insert' => true,
            'summary' => $src['summary'] ?? '',
            'objective' => $src['objective'] ?? '',
            'how_to_play' => $src['how_to_play'] ?? [],
            'setup_instructions' => $src['setup_instructions'] ?? [],
            'teardown' => $src['teardown'] ?? [],
            'rules_scoring' => $src['rules_scoring'] ?? '',
            'winning_notes' => $src['winning_notes'] ?? '',
            'supplies_detail' => $src['supplies_detail'] ?? [],
            'estimated_cost_low' => $src['estimated_cost_low'] ?? null,
            'estimated_cost_high' => $src['estimated_cost_high'] ?? null,
            'setup_minutes' => $src['setup_minutes'] ?? null,
            'play_minutes' => $src['play_minutes'] ?? null,
            'cleanup_minutes' => $src['cleanup_minutes'] ?? null,
            'min_players' => $src['min_players'] ?? null,
            'max_players' => $src['max_players'] ?? null,
            'age_range' => $src['age_range'] ?? '',
            'kid_friendly' => $src['kid_friendly'] ?? 0,
            'location_type' => $src['location_type'] ?? 'both',
            'space_needed' => $src['space_needed'] ?? '',
            'energy_level' => $src['energy_level'] ?? 'medium',
            'mess_level' => $src['mess_level'] ?? 'low',
            'tech_needs' => $src['tech_needs'] ?? '',
            'volunteers_needed' => $src['volunteers_needed'] ?? '',
            'safety_notes' => $src['safety_notes'] ?? '',
            'variations' => $src['variations'] ?? [],
            'tips' => $src['tips'] ?? '',
            'printables' => $src['printables'] ?? [],
            'details_filled_at' => $src['details_filled_at'] ?? null,
            'details_source' => $src['details_source'] ?? '',
            'senior_friendly' => $src['senior_friendly'] ?? 0,
            'seated_play' => $src['seated_play'] ?? 0,
            'mobility_level' => $src['mobility_level'] ?? 'moderate',
            'hearing_vision_notes' => $src['hearing_vision_notes'] ?? '',
            'senior_role' => $src['senior_role'] ?? '',
        ]);
    }

    /**
     * Copy a library activity from within a party: add the copy on the party and remove the original link.
     *
     * @return array{activity: array<string,mixed>, event_activity: array<string,mixed>}
     */
    public static function copyEventActivityInPlace(int $eventId, int $eventActivityId): array
    {
        $current = null;
        foreach (self::listEventActivities($eventId) as $row) {
            if ((int)$row['id'] === $eventActivityId) {
                $current = $row;
                break;
            }
        }
        if (!$current) {
            throw new InvalidArgumentException('Event activity not found');
        }
        $copy = self::copyActivity((int)$current['activity_id']);
        $attached = self::attachActivityToEvent($eventId, (int)$copy['id'], [
            'time_slot' => $current['time_slot'],
            'run_by' => $current['run_by'],
            'prizes' => $current['prizes'],
            'supplies_checklist' => $current['supplies_checklist'],
            'sort_order' => $current['sort_order'],
            'notes' => $current['notes'],
        ]);
        self::detachEventActivity($eventId, $eventActivityId);
        return [
            'activity' => $copy,
            'event_activity' => $attached,
        ];
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

        $event = Celebr8Model::createEvent([
            'slug' => $slug,
            'title' => (string)($overrides['title'] ?? $template['name']),
            'tagline' => $tagline,
            'theme' => (string)($overrides['theme'] ?? $template['theme']),
            'event_date' => (string)($overrides['event_date'] ?? ''),
            'event_time' => (string)($overrides['event_time'] ?? ''),
            'arrival_time_kids' => (string)($overrides['arrival_time_kids'] ?? ''),
            'arrival_time_adults' => (string)($overrides['arrival_time_adults'] ?? ''),
            'location' => '', // never copy past venues into location
            'food' => (string)($overrides['food'] ?? $food),
            'schedule' => (string)($overrides['schedule'] ?? $schedule),
            'invite_text' => (string)($overrides['invite_text'] ?? $tagline),
            'flyer_image_url' => (string)($overrides['flyer_image_url'] ?? ($template['hero_image_url'] ?? '')),
            'notes' => (string)($overrides['notes'] ?? $notes),
            'template_id' => $templateId,
        ]);
        $eventId = (int)$event['id'];

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
