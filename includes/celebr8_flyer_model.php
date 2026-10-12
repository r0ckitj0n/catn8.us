<?php

declare(strict_types=1);

/**
 * Per-party Celebr8 printable flyers (private storage + short-lived media URLs).
 */
final class Celebr8FlyerModel
{
    private static bool $schemaEnsured = false;

    public const MAX_UPLOAD_BYTES = 26214400; // 25 MiB
    public const SIGNED_URL_TTL_SEC = 900;

    private const ALLOWED_MIME = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];

    public static function ensureSchema(): void
    {
        if (self::$schemaEnsured) {
            return;
        }

        Database::execute("CREATE TABLE IF NOT EXISTS celebr8_flyers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            party_id INT NOT NULL,
            version INT NOT NULL DEFAULT 1,
            is_current TINYINT(1) NOT NULL DEFAULT 1,
            filename VARCHAR(255) NOT NULL DEFAULT '',
            relative_path VARCHAR(512) NOT NULL DEFAULT '',
            web_path VARCHAR(512) NOT NULL DEFAULT '',
            external_url VARCHAR(512) NOT NULL DEFAULT '',
            width INT NOT NULL DEFAULT 0,
            height INT NOT NULL DEFAULT 0,
            content_hash CHAR(64) NOT NULL DEFAULT '',
            byte_size INT NOT NULL DEFAULT 0,
            mime_type VARCHAR(64) NOT NULL DEFAULT '',
            uploaded_by VARCHAR(64) NOT NULL DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_celebr8_flyers_party (party_id, is_current, version),
            CONSTRAINT fk_celebr8_flyers_party FOREIGN KEY (party_id) REFERENCES celebr8_events(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        self::ensureColumn('celebr8_flyers', 'external_url', "VARCHAR(512) NOT NULL DEFAULT '' AFTER web_path");
        self::ensureColumn('celebr8_events', 'flyer_brief', 'TEXT NULL');
        self::ensureColumn('celebr8_events', 'flyer_style_notes', 'TEXT NULL');

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

    public static function flyersRoot(): string
    {
        return dirname(__DIR__) . '/private/celebr8/flyers';
    }

    public static function ensureFlyersRoot(): void
    {
        $root = self::flyersRoot();
        if (!is_dir($root) && !mkdir($root, 0700, true) && !is_dir($root)) {
            throw new RuntimeException('Failed to create flyer storage directory');
        }
        $ht = $root . '/.htaccess';
        if (!is_file($ht)) {
            @file_put_contents($ht, "Require all denied\n");
            @chmod($ht, 0644);
        }
    }

    public static function toFlyer(array $row, bool $withUrl = true): array
    {
        $id = (int)($row['id'] ?? 0);
        $external = trim((string)($row['external_url'] ?? ''));
        $rel = trim((string)($row['relative_path'] ?? ''));
        $source = $external !== '' && $rel === '' ? 'legacy_archive' : 'private';
        $out = [
            'id' => $id,
            'party_id' => (int)($row['party_id'] ?? 0),
            'version' => (int)($row['version'] ?? 1),
            'is_current' => (int)($row['is_current'] ?? 0) === 1,
            'filename' => (string)($row['filename'] ?? ''),
            'width' => (int)($row['width'] ?? 0),
            'height' => (int)($row['height'] ?? 0),
            'content_hash' => (string)($row['content_hash'] ?? ''),
            'byte_size' => (int)($row['byte_size'] ?? 0),
            'mime_type' => (string)($row['mime_type'] ?? ''),
            'uploaded_by' => (string)($row['uploaded_by'] ?? ''),
            'created_at' => (string)($row['created_at'] ?? ''),
            'external_url' => $external !== '' ? $external : null,
            'source' => $source,
        ];
        if ($withUrl && $id > 0) {
            if ($source === 'legacy_archive') {
                $out['url'] = $external;
                $out['original_url'] = $external;
                $out['url_expires_at'] = null;
            } else {
                $out['url'] = self::signedFlyerUrl($id, 'web');
                $out['original_url'] = self::signedFlyerUrl($id, 'original');
                $out['url_expires_at'] = gmdate('c', time() + self::SIGNED_URL_TTL_SEC);
            }
        }
        return $out;
    }

    public static function signedFlyerUrl(int $flyerId, string $variant = 'web', ?int $ttlSec = null): string
    {
        $variant = $variant === 'original' ? 'original' : 'web';
        $ttl = $ttlSec !== null ? max(60, min(3600, $ttlSec)) : self::SIGNED_URL_TTL_SEC;
        $exp = time() + $ttl;
        $sig = self::signFlyerAccess($flyerId, $variant, $exp);
        return '/api/celebr8_media.php?flyer=' . $flyerId
            . '&v=' . rawurlencode($variant)
            . '&exp=' . $exp
            . '&sig=' . rawurlencode($sig);
    }

    public static function sessionFlyerUrl(int $flyerId, string $variant = 'web'): string
    {
        $variant = $variant === 'original' ? 'original' : 'web';
        return '/api/celebr8_media.php?flyer=' . $flyerId . '&v=' . rawurlencode($variant);
    }

    public static function signFlyerAccess(int $flyerId, string $variant, int $exp): string
    {
        require_once __DIR__ . '/celebr8_album_model.php';
        $payload = 'flyer|' . $flyerId . '|' . $variant . '|' . $exp;
        return hash_hmac('sha256', $payload, Celebr8AlbumModel::signingKey());
    }

    public static function verifyFlyerAccess(int $flyerId, string $variant, int $exp, string $sig): bool
    {
        if ($flyerId <= 0 || $exp < time() || $sig === '') {
            return false;
        }
        $variant = $variant === 'original' ? 'original' : 'web';
        $expected = self::signFlyerAccess($flyerId, $variant, $exp);
        return hash_equals($expected, $sig);
    }

    public static function getFlyer(int $flyerId): ?array
    {
        self::ensureSchema();
        $row = Database::queryOne('SELECT * FROM celebr8_flyers WHERE id = ?', [$flyerId]);
        return $row ?: null;
    }

    public static function getCurrentFlyerRow(int $partyId): ?array
    {
        self::ensureSchema();
        return Database::queryOne(
            'SELECT * FROM celebr8_flyers WHERE party_id = ? AND is_current = 1 ORDER BY version DESC, id DESC LIMIT 1',
            [$partyId]
        ) ?: null;
    }

    /**
     * Legacy flyer_image_url from the events table (ignores album cover override).
     */
    public static function legacyFlyerUrl(int $partyId): string
    {
        $row = Database::queryOne('SELECT flyer_image_url FROM celebr8_events WHERE id = ?', [$partyId]);
        return trim((string)($row['flyer_image_url'] ?? ''));
    }

    /**
     * Usable legacy invite URL on the event (ignores stale private-media pointers).
     */
    public static function usableLegacyFlyerUrl(int $partyId): string
    {
        $legacy = self::legacyFlyerUrl($partyId);
        if ($legacy === '') {
            return '';
        }
        // After a private flyer was deleted, flyer_image_url may still point at media.php?flyer=
        if (str_contains($legacy, 'celebr8_media.php?flyer=')) {
            return '';
        }
        return $legacy;
    }

    public static function partyFlyerMeta(int $partyId): array
    {
        $row = Database::queryOne(
            'SELECT flyer_brief, flyer_style_notes FROM celebr8_events WHERE id = ?',
            [$partyId]
        );
        return [
            'flyer_brief' => (string)($row['flyer_brief'] ?? ''),
            'flyer_style_notes' => (string)($row['flyer_style_notes'] ?? ''),
        ];
    }

    /**
     * @return array{
     *   has_flyer:bool,
     *   flyer:?array,
     *   history:list<array>,
     *   versions:list<array>,
     *   legacy_url:?string,
     *   active_flyer_request:?array,
     *   flyer_brief:string,
     *   flyer_style_notes:string
     * }
     */
    public static function getFlyerForParty(int $partyId, bool $withHistory = true): array
    {
        self::ensureSchema();
        if ($partyId <= 0 || !Celebr8Model::getEvent($partyId)) {
            throw new InvalidArgumentException('Party not found');
        }

        $current = self::getCurrentFlyerRow($partyId);
        $legacy = self::usableLegacyFlyerUrl($partyId);
        $flyer = null;
        if ($current) {
            $flyer = self::toFlyer($current, true);
        } elseif ($legacy !== '') {
            $flyer = [
                'id' => null,
                'party_id' => $partyId,
                'version' => 0,
                'is_current' => true,
                'filename' => basename(parse_url($legacy, PHP_URL_PATH) ?: $legacy),
                'width' => 0,
                'height' => 0,
                'content_hash' => '',
                'byte_size' => 0,
                'mime_type' => '',
                'uploaded_by' => 'legacy',
                'created_at' => '',
                'external_url' => $legacy,
                'source' => 'legacy',
                'url' => $legacy,
                'original_url' => $legacy,
                'url_expires_at' => null,
            ];
        }

        $versions = self::listFlyerVersions($partyId);
        $history = $withHistory ? $versions : [];
        $meta = self::partyFlyerMeta($partyId);

        require_once __DIR__ . '/celebr8_agent_model.php';
        $active = Celebr8AgentModel::findActiveFlyerRequest($partyId);

        return [
            'has_flyer' => $flyer !== null,
            'flyer' => $flyer,
            'history' => $history,
            'versions' => $versions,
            'legacy_url' => $legacy !== '' ? $legacy : null,
            'active_flyer_request' => $active,
            'flyer_brief' => $meta['flyer_brief'],
            'flyer_style_notes' => $meta['flyer_style_notes'],
        ];
    }

    /** @return list<array> */
    public static function listFlyerVersions(int $partyId): array
    {
        self::ensureSchema();
        if ($partyId <= 0) {
            throw new InvalidArgumentException('party_id required');
        }
        $rows = Database::queryAll(
            'SELECT * FROM celebr8_flyers WHERE party_id = ? ORDER BY version DESC, id DESC LIMIT 50',
            [$partyId]
        );
        return array_map(static fn (array $r): array => self::toFlyer($r, true), $rows);
    }

    public static function saveFlyerBrief(int $partyId, ?string $brief, ?string $styleNotes): array
    {
        self::ensureSchema();
        if ($partyId <= 0 || !Celebr8Model::getEvent($partyId)) {
            throw new InvalidArgumentException('Party not found');
        }
        $fields = [];
        if ($brief !== null) {
            $brief = trim($brief);
            if (strlen($brief) > 12000) {
                $brief = substr($brief, 0, 12000);
            }
            $fields['flyer_brief'] = $brief;
        }
        if ($styleNotes !== null) {
            $styleNotes = trim($styleNotes);
            if (strlen($styleNotes) > 4000) {
                $styleNotes = substr($styleNotes, 0, 4000);
            }
            $fields['flyer_style_notes'] = $styleNotes;
        }
        if ($fields !== []) {
            Celebr8Model::updateEvent($partyId, $fields);
        }
        return self::getFlyerForParty($partyId, true);
    }

    public static function deleteCurrentFlyer(int $partyId): array
    {
        self::ensureSchema();
        if ($partyId <= 0 || !Celebr8Model::getEvent($partyId)) {
            throw new InvalidArgumentException('Party not found');
        }

        $current = self::getCurrentFlyerRow($partyId);
        $legacy = self::usableLegacyFlyerUrl($partyId);

        if ($current) {
            Database::execute(
                'UPDATE celebr8_flyers SET is_current = 0 WHERE id = ?',
                [(int)$current['id']]
            );
        } elseif ($legacy !== '') {
            // Archive legacy invite URL so it can be restored later.
            $prev = Database::queryOne(
                'SELECT COALESCE(MAX(version), 0) AS v FROM celebr8_flyers WHERE party_id = ?',
                [$partyId]
            );
            $version = ((int)($prev['v'] ?? 0)) + 1;
            Database::execute(
                'INSERT INTO celebr8_flyers (
                    party_id, version, is_current, filename, relative_path, web_path, external_url,
                    uploaded_by
                ) VALUES (?, ?, 0, ?, ?, ?, ?, ?)',
                [
                    $partyId,
                    $version,
                    basename(parse_url($legacy, PHP_URL_PATH) ?: 'legacy-flyer'),
                    '',
                    '',
                    $legacy,
                    'legacy-archive',
                ]
            );
        } else {
            throw new InvalidArgumentException('No current flyer to delete');
        }

        Database::execute(
            "UPDATE celebr8_events SET flyer_image_url = '', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [$partyId]
        );

        return self::getFlyerForParty($partyId, true);
    }

    public static function restoreFlyerVersion(int $flyerId): array
    {
        self::ensureSchema();
        $row = self::getFlyer($flyerId);
        if (!$row) {
            throw new InvalidArgumentException('Flyer version not found');
        }
        $partyId = (int)$row['party_id'];

        Database::execute(
            'UPDATE celebr8_flyers SET is_current = 0 WHERE party_id = ? AND is_current = 1',
            [$partyId]
        );
        Database::execute(
            'UPDATE celebr8_flyers SET is_current = 1 WHERE id = ?',
            [$flyerId]
        );

        $external = trim((string)($row['external_url'] ?? ''));
        $rel = trim((string)($row['relative_path'] ?? ''));
        if ($external !== '' && $rel === '') {
            $url = $external;
        } else {
            $url = self::sessionFlyerUrl($flyerId, 'web');
        }
        Database::execute(
            'UPDATE celebr8_events SET flyer_image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [$url, $partyId]
        );

        return self::getFlyerForParty($partyId, true);
    }

    public static function resolveFlyerPath(array $row, string $variant = 'web'): ?string
    {
        $variant = $variant === 'original' ? 'original' : 'web';
        $rel = $variant === 'web'
            ? (string)($row['web_path'] ?? '')
            : (string)($row['relative_path'] ?? '');
        if ($rel === '') {
            $rel = (string)($row['relative_path'] ?? '');
        }
        return self::resolveStoredPath($rel);
    }

    public static function resolveStoredPath(string $relativePath): ?string
    {
        $relativePath = ltrim(str_replace('\\', '/', $relativePath), '/');
        if ($relativePath === '' || str_contains($relativePath, '..')) {
            return null;
        }
        if (!preg_match('#^flyers/[0-9]+/[a-z0-9._/-]+\\.(webp|jpg|jpeg|png|gif)$#i', $relativePath)) {
            return null;
        }
        $full = dirname(__DIR__) . '/private/celebr8/' . $relativePath;
        $realRoot = realpath(dirname(__DIR__) . '/private/celebr8');
        $realFile = realpath($full);
        if ($realRoot === false || $realFile === false) {
            return null;
        }
        if (!str_starts_with($realFile, $realRoot . DIRECTORY_SEPARATOR)) {
            return null;
        }
        return is_file($realFile) ? $realFile : null;
    }

    /**
     * @param array{tmp_name:string,name?:string,size?:int,error?:int,type?:string} $file
     */
    public static function uploadFlyer(int $partyId, array $file, string $uploadedBy): array
    {
        self::ensureSchema();
        self::ensureFlyersRoot();
        require_once __DIR__ . '/celebr8_album_model.php';

        $event = Celebr8Model::getEvent($partyId);
        if (!$event) {
            throw new InvalidArgumentException('Party not found');
        }

        $error = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($error !== UPLOAD_ERR_OK) {
            throw new InvalidArgumentException('Upload failed (error ' . $error . ')');
        }
        $tmp = (string)($file['tmp_name'] ?? '');
        $isHttpUpload = $tmp !== '' && is_uploaded_file($tmp);
        $isCliTestFile = PHP_SAPI === 'cli' && $tmp !== '' && is_file($tmp);
        if (!$isHttpUpload && !$isCliTestFile) {
            throw new InvalidArgumentException('Missing upload tempfile');
        }
        $size = (int)($file['size'] ?? filesize($tmp));
        if ($size <= 0) {
            throw new InvalidArgumentException('Empty upload');
        }
        if ($size > self::MAX_UPLOAD_BYTES) {
            throw new InvalidArgumentException('File too large (max 25 MB)');
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = (string)$finfo->file($tmp);
        if (!isset(self::ALLOWED_MIME[$mime])) {
            throw new InvalidArgumentException('Only image uploads are allowed');
        }
        $ext = self::ALLOWED_MIME[$mime];
        $info = @getimagesize($tmp);
        if (!is_array($info) || empty($info[0]) || empty($info[1])) {
            throw new InvalidArgumentException('Invalid image file');
        }
        $width = (int)$info[0];
        $height = (int)$info[1];
        $hash = hash_file('sha256', $tmp);
        if (!is_string($hash) || strlen($hash) !== 64) {
            throw new RuntimeException('Failed to hash upload');
        }

        $partyDir = self::flyersRoot() . '/' . $partyId;
        if (!is_dir($partyDir) && !mkdir($partyDir, 0700, true) && !is_dir($partyDir)) {
            throw new RuntimeException('Failed to create party flyer directory');
        }

        $prev = Database::queryOne(
            'SELECT COALESCE(MAX(version), 0) AS v FROM celebr8_flyers WHERE party_id = ?',
            [$partyId]
        );
        $version = ((int)($prev['v'] ?? 0)) + 1;

        $stem = bin2hex(random_bytes(12));
        $origName = $stem . '_v' . $version . '_orig.' . $ext;
        $origAbs = $partyDir . '/' . $origName;
        $origRel = 'flyers/' . $partyId . '/' . $origName;

        // Reuse album stripper via a small local GD path (same as albums).
        self::writeStrippedOriginal($tmp, $origAbs, $mime);
        @chmod($origAbs, 0600);

        $webRel = $origRel;
        try {
            $webName = $stem . '_v' . $version . '_web.jpg';
            $webAbs = $partyDir . '/' . $webName;
            self::writeResizedJpeg($origAbs, $webAbs, 2400);
            @chmod($webAbs, 0600);
            $webRel = 'flyers/' . $partyId . '/' . $webName;
        } catch (Throwable $e) {
            $webRel = $origRel;
        }

        $clientName = basename((string)($file['name'] ?? $origName));
        if ($clientName === '' || $clientName === '.' || $clientName === '..') {
            $clientName = $origName;
        }
        if (strlen($clientName) > 255) {
            $clientName = substr($clientName, 0, 255);
        }

        Database::execute(
            'UPDATE celebr8_flyers SET is_current = 0 WHERE party_id = ? AND is_current = 1',
            [$partyId]
        );
        Database::execute(
            'INSERT INTO celebr8_flyers (
                party_id, version, is_current, filename, relative_path, web_path,
                width, height, content_hash, byte_size, mime_type, uploaded_by
            ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $partyId,
                $version,
                $clientName,
                $origRel,
                $webRel,
                $width,
                $height,
                $hash,
                (int)filesize($origAbs),
                $mime,
                substr(trim($uploadedBy), 0, 64),
            ]
        );
        $id = (int)Database::getInstance()->lastInsertId();

        // Point event flyer_image_url at session media so cards/print use the private flyer.
        $sessionUrl = self::sessionFlyerUrl($id, 'web');
        Database::execute(
            'UPDATE celebr8_events SET flyer_image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [$sessionUrl, $partyId]
        );

        // Mark matching flyer asks done when a flyer lands.
        require_once __DIR__ . '/celebr8_agent_model.php';
        Celebr8AgentModel::completeActiveFlyerRequests($partyId, 'Flyer uploaded (version ' . $version . ').');

        $row = self::getFlyer($id);
        if (!$row) {
            throw new RuntimeException('Failed to load uploaded flyer');
        }
        return [
            'flyer' => self::toFlyer($row, true),
            'history' => self::getFlyerForParty($partyId, true)['history'],
        ];
    }

    private static function writeStrippedOriginal(string $src, string $dest, string $mime): void
    {
        require_once __DIR__ . '/celebr8_album_model.php';
        // Delegate to album helpers via reflection-free copy of the GD path:
        $img = match ($mime) {
            'image/jpeg' => @imagecreatefromjpeg($src),
            'image/png' => @imagecreatefrompng($src),
            'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($src) : false,
            'image/gif' => @imagecreatefromgif($src),
            default => false,
        };
        if ($img === false) {
            if (!@copy($src, $dest)) {
                throw new RuntimeException('Failed to store flyer original');
            }
            return;
        }
        $ok = false;
        if ($mime === 'image/png') {
            imagesavealpha($img, true);
            $ok = @imagepng($img, $dest, 6);
        } elseif ($mime === 'image/webp' && function_exists('imagewebp')) {
            $ok = @imagewebp($img, $dest, 85);
        } elseif ($mime === 'image/gif') {
            $ok = @imagegif($img, $dest);
        } else {
            $ok = @imagejpeg($img, $dest, 92);
        }
        unset($img);
        if (!$ok) {
            throw new RuntimeException('Failed to write stripped flyer');
        }
    }

    private static function writeResizedJpeg(string $src, string $dest, int $maxEdge): void
    {
        $info = @getimagesize($src);
        if (!is_array($info)) {
            throw new RuntimeException('Cannot read flyer for resize');
        }
        $mime = (string)($info['mime'] ?? 'image/jpeg');
        $w = (int)$info[0];
        $h = (int)$info[1];
        if ($w <= 0 || $h <= 0) {
            throw new RuntimeException('Invalid flyer dimensions');
        }
        $scale = min(1.0, $maxEdge / max($w, $h));
        $nw = max(1, (int)round($w * $scale));
        $nh = max(1, (int)round($h * $scale));
        $srcImg = match ($mime) {
            'image/jpeg' => @imagecreatefromjpeg($src),
            'image/png' => @imagecreatefrompng($src),
            'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($src) : false,
            'image/gif' => @imagecreatefromgif($src),
            default => false,
        };
        if ($srcImg === false) {
            throw new RuntimeException('Cannot decode flyer for resize');
        }
        $dst = imagecreatetruecolor($nw, $nh);
        if ($dst === false) {
            unset($srcImg);
            throw new RuntimeException('Cannot allocate resized flyer');
        }
        imagecopyresampled($dst, $srcImg, 0, 0, 0, 0, $nw, $nh, $w, $h);
        $ok = @imagejpeg($dst, $dest, 88);
        unset($srcImg, $dst);
        if (!$ok) {
            throw new RuntimeException('Failed to write resized flyer');
        }
    }
}
