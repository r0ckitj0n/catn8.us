<?php

declare(strict_types=1);

/**
 * Per-party Celebr8 photo albums (private storage + short-lived media URLs).
 */
final class Celebr8AlbumModel
{
    private static bool $schemaEnsured = false;

    public const MAX_UPLOAD_BYTES = 26214400; // 25 MiB
    public const SIGNED_URL_TTL_SEC = 900; // 15 minutes
    public const SIGNING_SECRET_KEY = 'celebr8.media.signing_key';

    public const VARIANTS = ['thumb', 'web', 'original'];

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

        Database::execute("CREATE TABLE IF NOT EXISTS celebr8_albums (
            id INT AUTO_INCREMENT PRIMARY KEY,
            party_id INT NOT NULL,
            title VARCHAR(191) NOT NULL DEFAULT '',
            cover_photo_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_celebr8_albums_party (party_id),
            CONSTRAINT fk_celebr8_albums_party FOREIGN KEY (party_id) REFERENCES celebr8_events(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        Database::execute("CREATE TABLE IF NOT EXISTS celebr8_photos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            album_id INT NOT NULL,
            party_id INT NOT NULL,
            filename VARCHAR(255) NOT NULL,
            relative_path VARCHAR(512) NOT NULL,
            thumb_path VARCHAR(512) NOT NULL DEFAULT '',
            web_path VARCHAR(512) NOT NULL DEFAULT '',
            caption TEXT NULL,
            capture_time DATETIME NULL,
            uploaded_at DATETIME NOT NULL,
            source_uuid VARCHAR(64) NULL,
            width INT NOT NULL DEFAULT 0,
            height INT NOT NULL DEFAULT 0,
            content_hash CHAR(64) NOT NULL,
            byte_size INT NOT NULL DEFAULT 0,
            mime_type VARCHAR(64) NOT NULL DEFAULT '',
            uploaded_by VARCHAR(64) NOT NULL DEFAULT '',
            sort_order INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_celebr8_photos_album_hash (album_id, content_hash),
            UNIQUE KEY uniq_celebr8_photos_album_source (album_id, source_uuid),
            KEY idx_celebr8_photos_party (party_id, id),
            KEY idx_celebr8_photos_album (album_id, id),
            KEY idx_celebr8_photos_album_sort (album_id, sort_order, id),
            CONSTRAINT fk_celebr8_photos_album FOREIGN KEY (album_id) REFERENCES celebr8_albums(id) ON DELETE CASCADE,
            CONSTRAINT fk_celebr8_photos_party FOREIGN KEY (party_id) REFERENCES celebr8_events(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        // Additive columns for albums created before cover/sort existed.
        self::ensureColumn('celebr8_albums', 'cover_photo_id', 'INT NULL AFTER title');
        self::ensureColumn('celebr8_photos', 'sort_order', 'INT NOT NULL DEFAULT 0 AFTER uploaded_by');
        // Person / contest tags — photo still belongs to the party album.
        self::ensureColumn('celebr8_photos', 'tagged_guest_id', 'INT NULL AFTER sort_order');
        self::ensureColumn('celebr8_photos', 'tagged_identity_id', 'INT NULL AFTER tagged_guest_id');
        self::ensureColumn('celebr8_photos', 'contest_id', 'INT NULL AFTER tagged_identity_id');
        self::ensureIndex('celebr8_photos', 'idx_celebr8_photos_album_sort', 'album_id, sort_order, id');
        self::ensureIndex('celebr8_photos', 'idx_celebr8_photos_guest', 'tagged_guest_id');

        self::$schemaEnsured = true;
    }

    public static function tagPhoto(int $photoId, ?int $guestId = null, ?int $identityId = null, ?int $contestId = null): ?array
    {
        self::ensureSchema();
        $row = Database::queryOne('SELECT * FROM celebr8_photos WHERE id = ?', [$photoId]);
        if (!$row) {
            return null;
        }
        Database::execute(
            'UPDATE celebr8_photos SET
                tagged_guest_id = COALESCE(?, tagged_guest_id),
                tagged_identity_id = COALESCE(?, tagged_identity_id),
                contest_id = COALESCE(?, contest_id)
             WHERE id = ?',
            [
                $guestId && $guestId > 0 ? $guestId : null,
                $identityId && $identityId > 0 ? $identityId : null,
                $contestId && $contestId > 0 ? $contestId : null,
                $photoId,
            ]
        );
        return self::getPhoto($photoId);
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

    private static function ensureIndex(string $table, string $indexName, string $columns): void
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
        Database::execute("ALTER TABLE `{$table}` ADD INDEX `{$indexName}` ({$columns})");
    }

    public static function albumsRoot(): string
    {
        return dirname(__DIR__) . '/private/celebr8/albums';
    }

    public static function ensureAlbumsRoot(): void
    {
        $root = self::albumsRoot();
        if (!is_dir($root) && !mkdir($root, 0700, true) && !is_dir($root)) {
            throw new RuntimeException('Failed to create album storage directory');
        }
        $ht = dirname(__DIR__) . '/private/celebr8/albums/.htaccess';
        if (!is_file($ht)) {
            @file_put_contents($ht, "Require all denied\n");
            @chmod($ht, 0644);
        }
    }

    public static function signingKey(): string
    {
        $existing = secret_get(self::SIGNING_SECRET_KEY);
        if (is_string($existing) && strlen($existing) >= 32) {
            return $existing;
        }
        $key = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
        if (!secret_set(self::SIGNING_SECRET_KEY, $key)) {
            throw new RuntimeException('Failed to store media signing key');
        }
        return $key;
    }

    public static function toAlbum(array $row, ?int $photoCount = null): array
    {
        $coverId = isset($row['cover_photo_id']) && $row['cover_photo_id'] !== null
            ? (int)$row['cover_photo_id']
            : null;
        return [
            'id' => (int)($row['id'] ?? 0),
            'party_id' => (int)($row['party_id'] ?? 0),
            'title' => (string)($row['title'] ?? ''),
            'cover_photo_id' => $coverId && $coverId > 0 ? $coverId : null,
            'cover_url' => ($coverId && $coverId > 0) ? self::sessionMediaUrl($coverId, 'web') : null,
            'photo_count' => $photoCount !== null
                ? $photoCount
                : (int)($row['photo_count'] ?? 0),
            'created_at' => (string)($row['created_at'] ?? ''),
            'updated_at' => (string)($row['updated_at'] ?? ''),
        ];
    }

    public static function toPhoto(array $row, bool $withUrls = true, ?int $coverPhotoId = null): array
    {
        $id = (int)($row['id'] ?? 0);
        $out = [
            'id' => $id,
            'album_id' => (int)($row['album_id'] ?? 0),
            'party_id' => (int)($row['party_id'] ?? 0),
            'filename' => (string)($row['filename'] ?? ''),
            'caption' => (string)($row['caption'] ?? ''),
            'capture_time' => $row['capture_time'] !== null ? (string)$row['capture_time'] : null,
            'uploaded_at' => (string)($row['uploaded_at'] ?? ''),
            'source_uuid' => $row['source_uuid'] !== null ? (string)$row['source_uuid'] : null,
            'width' => (int)($row['width'] ?? 0),
            'height' => (int)($row['height'] ?? 0),
            'content_hash' => (string)($row['content_hash'] ?? ''),
            'byte_size' => (int)($row['byte_size'] ?? 0),
            'mime_type' => (string)($row['mime_type'] ?? ''),
            'uploaded_by' => (string)($row['uploaded_by'] ?? ''),
            'sort_order' => (int)($row['sort_order'] ?? 0),
            'is_cover' => $coverPhotoId !== null && $id > 0 && $id === $coverPhotoId,
            'created_at' => (string)($row['created_at'] ?? ''),
            'updated_at' => (string)($row['updated_at'] ?? ''),
        ];
        if ($withUrls && $id > 0) {
            $out['thumb_url'] = self::signedPhotoUrl($id, 'thumb');
            $out['url'] = self::signedPhotoUrl($id, 'web');
            $out['original_url'] = self::signedPhotoUrl($id, 'original');
            $out['url_expires_at'] = gmdate('c', time() + self::SIGNED_URL_TTL_SEC);
        }
        return $out;
    }

    /** Session-auth media URL (no expiry); used for party card covers while logged in. */
    public static function sessionMediaUrl(int $photoId, string $variant = 'web'): string
    {
        $variant = strtolower(trim($variant));
        if (!in_array($variant, self::VARIANTS, true)) {
            $variant = 'web';
        }
        return '/api/celebr8_media.php?photo=' . $photoId . '&v=' . rawurlencode($variant);
    }

    public static function signedPhotoUrl(int $photoId, string $variant = 'web', ?int $ttlSec = null): string
    {
        $variant = strtolower(trim($variant));
        if (!in_array($variant, self::VARIANTS, true)) {
            $variant = 'web';
        }
        $ttl = $ttlSec !== null ? max(60, min(3600, $ttlSec)) : self::SIGNED_URL_TTL_SEC;
        $exp = time() + $ttl;
        $sig = self::signPhotoAccess($photoId, $variant, $exp);
        return '/api/celebr8_media.php?photo=' . $photoId
            . '&v=' . rawurlencode($variant)
            . '&exp=' . $exp
            . '&sig=' . rawurlencode($sig);
    }

    public static function coverMediaUrlForParty(int $partyId): ?string
    {
        $coverId = self::coverPhotoIdForParty($partyId);
        return $coverId ? self::sessionMediaUrl($coverId, 'web') : null;
    }

    public static function coverPhotoIdForParty(int $partyId): ?int
    {
        self::ensureSchema();
        if ($partyId <= 0) {
            return null;
        }
        $row = Database::queryOne(
            'SELECT cover_photo_id FROM celebr8_albums WHERE party_id = ?',
            [$partyId]
        );
        $id = (int)($row['cover_photo_id'] ?? 0);
        return $id > 0 ? $id : null;
    }

    public static function signPhotoAccess(int $photoId, string $variant, int $exp): string
    {
        $payload = $photoId . '|' . $variant . '|' . $exp;
        return hash_hmac('sha256', $payload, self::signingKey());
    }

    public static function verifyPhotoAccess(int $photoId, string $variant, int $exp, string $sig): bool
    {
        if ($photoId <= 0 || $exp < time() || $sig === '') {
            return false;
        }
        if (!in_array($variant, self::VARIANTS, true)) {
            return false;
        }
        $expected = self::signPhotoAccess($photoId, $variant, $exp);
        return hash_equals($expected, $sig);
    }

    public static function getAlbum(int $albumId): ?array
    {
        self::ensureSchema();
        $row = Database::queryOne(
            'SELECT a.*,
                    (SELECT COUNT(*) FROM celebr8_photos p WHERE p.album_id = a.id) AS photo_count
             FROM celebr8_albums a
             WHERE a.id = ?',
            [$albumId]
        );
        return $row ? self::toAlbum($row) : null;
    }

    public static function getAlbumByParty(int $partyId): ?array
    {
        self::ensureSchema();
        $row = Database::queryOne(
            'SELECT a.*,
                    (SELECT COUNT(*) FROM celebr8_photos p WHERE p.album_id = a.id) AS photo_count
             FROM celebr8_albums a
             WHERE a.party_id = ?',
            [$partyId]
        );
        return $row ? self::toAlbum($row) : null;
    }

    public static function getOrCreateAlbumForParty(int $partyId, string $title = ''): array
    {
        self::ensureSchema();
        $event = Celebr8Model::getEvent($partyId);
        if (!$event) {
            throw new InvalidArgumentException('Party not found');
        }
        $existing = self::getAlbumByParty($partyId);
        if ($existing) {
            return $existing;
        }
        $title = trim($title);
        if ($title === '') {
            $title = (string)($event['title'] ?? 'Party') . ' photos';
        }
        if (strlen($title) > 191) {
            $title = substr($title, 0, 191);
        }
        try {
            Database::execute(
                'INSERT INTO celebr8_albums (party_id, title) VALUES (?, ?)',
                [$partyId, $title]
            );
        } catch (Throwable $e) {
            // Race: unique party_id.
            $again = self::getAlbumByParty($partyId);
            if ($again) {
                return $again;
            }
            throw $e;
        }
        $album = self::getAlbumByParty($partyId);
        if (!$album) {
            throw new RuntimeException('Failed to create album');
        }
        return $album;
    }

    public static function getPhoto(int $photoId): ?array
    {
        self::ensureSchema();
        $row = Database::queryOne('SELECT * FROM celebr8_photos WHERE id = ?', [$photoId]);
        return $row ?: null;
    }

    public static function listPhotos(int $partyId = 0, int $albumId = 0, int $limit = 200): array
    {
        self::ensureSchema();
        $limit = max(1, min(500, $limit));
        $coverPhotoId = null;
        if ($albumId > 0) {
            $album = self::getAlbum($albumId);
            $coverPhotoId = $album['cover_photo_id'] ?? null;
            $rows = Database::queryAll(
                'SELECT * FROM celebr8_photos WHERE album_id = ?
                 ORDER BY sort_order ASC, COALESCE(capture_time, uploaded_at) ASC, id ASC
                 LIMIT ' . $limit,
                [$albumId]
            );
        } elseif ($partyId > 0) {
            $coverPhotoId = self::coverPhotoIdForParty($partyId);
            $rows = Database::queryAll(
                'SELECT * FROM celebr8_photos WHERE party_id = ?
                 ORDER BY sort_order ASC, COALESCE(capture_time, uploaded_at) ASC, id ASC
                 LIMIT ' . $limit,
                [$partyId]
            );
        } else {
            throw new InvalidArgumentException('party_id or album_id required');
        }
        $coverId = is_int($coverPhotoId) ? $coverPhotoId : null;
        return array_map(
            static fn (array $row): array => self::toPhoto($row, true, $coverId),
            $rows
        );
    }

    private static function nextSortOrder(int $albumId): int
    {
        $row = Database::queryOne(
            'SELECT COALESCE(MAX(sort_order), -1) AS m FROM celebr8_photos WHERE album_id = ?',
            [$albumId]
        );
        return ((int)($row['m'] ?? -1)) + 1;
    }

    public static function resolveVariantPath(array $photoRow, string $variant): ?string
    {
        $variant = strtolower(trim($variant));
        $rel = '';
        if ($variant === 'thumb') {
            $rel = (string)($photoRow['thumb_path'] ?? '');
            if ($rel === '') {
                $rel = (string)($photoRow['web_path'] ?? '');
            }
            if ($rel === '') {
                $rel = (string)($photoRow['relative_path'] ?? '');
            }
        } elseif ($variant === 'web') {
            $rel = (string)($photoRow['web_path'] ?? '');
            if ($rel === '') {
                $rel = (string)($photoRow['relative_path'] ?? '');
            }
        } else {
            $rel = (string)($photoRow['relative_path'] ?? '');
        }
        return self::resolveStoredPath($rel);
    }

    public static function resolveStoredPath(string $relativePath): ?string
    {
        $relativePath = ltrim(str_replace('\\', '/', $relativePath), '/');
        if ($relativePath === '' || str_contains($relativePath, '..')) {
            return null;
        }
        if (!preg_match('#^albums/[0-9]+/[a-z0-9._/-]+\\.(webp|jpg|jpeg|png|gif)$#i', $relativePath)) {
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
    /**
     * Store raw image bytes into the party album (server-side; not an HTTP upload).
     *
     * @return array{photo:array,deduped:bool,dedupe_reason:?string,album:?array}
     */
    public static function uploadPhotoFromBytes(
        int $partyId,
        int $albumId,
        string $bytes,
        string $caption,
        string $uploadedBy,
        ?string $sourceUuid = null,
        string $clientName = 'kiosk-frame.jpg'
    ): array {
        if ($bytes === '') {
            throw new InvalidArgumentException('Empty image bytes');
        }
        if (strlen($bytes) > self::MAX_UPLOAD_BYTES) {
            throw new InvalidArgumentException('File too large (max 25 MB)');
        }
        $tmp = tempnam(sys_get_temp_dir(), 'c8ph');
        if ($tmp === false) {
            throw new RuntimeException('Failed to create tempfile');
        }
        try {
            if (file_put_contents($tmp, $bytes) === false) {
                throw new RuntimeException('Failed to write tempfile');
            }
            return self::uploadPhoto(
                $partyId,
                $albumId,
                [
                    'tmp_name' => $tmp,
                    'name' => $clientName,
                    'size' => strlen($bytes),
                    'error' => UPLOAD_ERR_OK,
                    'type' => 'image/jpeg',
                    '_server_tmp' => true,
                ],
                $caption,
                null,
                $sourceUuid,
                $uploadedBy
            );
        } finally {
            @unlink($tmp);
        }
    }

    public static function uploadPhoto(
        int $partyId,
        int $albumId,
        array $file,
        string $caption,
        ?string $captureTime,
        ?string $sourceUuid,
        string $uploadedBy
    ): array {
        self::ensureSchema();
        self::ensureAlbumsRoot();

        if ($partyId <= 0 && $albumId <= 0) {
            throw new InvalidArgumentException('party_id or album_id required');
        }

        if ($albumId > 0) {
            $album = self::getAlbum($albumId);
            if (!$album) {
                throw new InvalidArgumentException('Album not found');
            }
            $partyId = (int)$album['party_id'];
        } else {
            $album = self::getOrCreateAlbumForParty($partyId);
            $albumId = (int)$album['id'];
        }

        $error = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($error !== UPLOAD_ERR_OK) {
            throw new InvalidArgumentException('Upload failed (error ' . $error . ')');
        }
        $tmp = (string)($file['tmp_name'] ?? '');
        $isHttpUpload = $tmp !== '' && is_uploaded_file($tmp);
        $isCliTestFile = PHP_SAPI === 'cli' && $tmp !== '' && is_file($tmp);
        // Trusted server-written temp (kiosk frame → Celebr8r costume suggest, etc.).
        $isServerTmp = !empty($file['_server_tmp']) && $tmp !== '' && is_file($tmp);
        if (!$isHttpUpload && !$isCliTestFile && !$isServerTmp) {
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

        $sourceUuid = $sourceUuid !== null ? trim($sourceUuid) : '';
        if ($sourceUuid !== '') {
            if (strlen($sourceUuid) > 64 || !preg_match('/^[A-Za-z0-9._:-]+$/', $sourceUuid)) {
                throw new InvalidArgumentException('Invalid source_uuid');
            }
            $byUuid = Database::queryOne(
                'SELECT * FROM celebr8_photos WHERE album_id = ? AND source_uuid = ? LIMIT 1',
                [$albumId, $sourceUuid]
            );
            if ($byUuid) {
                return [
                    'photo' => self::toPhoto($byUuid, true),
                    'deduped' => true,
                    'dedupe_reason' => 'source_uuid',
                    'album' => self::getAlbum($albumId),
                ];
            }
        } else {
            $sourceUuid = null;
        }

        $byHash = Database::queryOne(
            'SELECT * FROM celebr8_photos WHERE album_id = ? AND content_hash = ? LIMIT 1',
            [$albumId, $hash]
        );
        if ($byHash) {
            return [
                'photo' => self::toPhoto($byHash, true),
                'deduped' => true,
                'dedupe_reason' => 'content_hash',
                'album' => self::getAlbum($albumId),
            ];
        }

        $capture = self::normalizeCaptureTime($captureTime, $tmp, $mime);
        $caption = trim($caption);
        if (strlen($caption) > 2000) {
            $caption = substr($caption, 0, 2000);
        }

        $partyDir = self::albumsRoot() . '/' . $partyId;
        if (!is_dir($partyDir) && !mkdir($partyDir, 0700, true) && !is_dir($partyDir)) {
            throw new RuntimeException('Failed to create party album directory');
        }

        $stem = bin2hex(random_bytes(16));
        $origName = $stem . '_orig.' . $ext;
        $origAbs = $partyDir . '/' . $origName;
        $origRel = 'albums/' . $partyId . '/' . $origName;

        // Re-encode to strip EXIF/GPS while preserving pixels; keep capture_time in DB.
        self::writeStrippedOriginal($tmp, $origAbs, $mime);
        @chmod($origAbs, 0600);

        $thumbRel = '';
        $webRel = '';
        try {
            $webName = $stem . '_web.jpg';
            $thumbName = $stem . '_thumb.jpg';
            $webAbs = $partyDir . '/' . $webName;
            $thumbAbs = $partyDir . '/' . $thumbName;
            self::writeResizedJpeg($origAbs, $webAbs, 1600);
            self::writeResizedJpeg($origAbs, $thumbAbs, 400);
            @chmod($webAbs, 0600);
            @chmod($thumbAbs, 0600);
            $webRel = 'albums/' . $partyId . '/' . $webName;
            $thumbRel = 'albums/' . $partyId . '/' . $thumbName;
        } catch (Throwable $e) {
            // Derivatives are best-effort; original still usable.
            $webRel = $origRel;
            $thumbRel = $origRel;
        }

        $clientName = basename((string)($file['name'] ?? $origName));
        if ($clientName === '' || $clientName === '.' || $clientName === '..') {
            $clientName = $origName;
        }
        if (strlen($clientName) > 255) {
            $clientName = substr($clientName, 0, 255);
        }

        $byteSize = (int)filesize($origAbs);
        $sortOrder = self::nextSortOrder($albumId);
        Database::execute(
            'INSERT INTO celebr8_photos (
                album_id, party_id, filename, relative_path, thumb_path, web_path,
                caption, capture_time, uploaded_at, source_uuid, width, height,
                content_hash, byte_size, mime_type, uploaded_by, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $albumId,
                $partyId,
                $clientName,
                $origRel,
                $thumbRel,
                $webRel,
                $caption,
                $capture,
                $sourceUuid,
                $width,
                $height,
                $hash,
                $byteSize,
                $mime,
                substr(trim($uploadedBy), 0, 64),
                $sortOrder,
            ]
        );
        $id = (int)Database::getInstance()->lastInsertId();
        $row = self::getPhoto($id);
        if (!$row) {
            throw new RuntimeException('Failed to load uploaded photo');
        }
        $album = self::getAlbum($albumId);
        $coverId = is_array($album) ? ($album['cover_photo_id'] ?? null) : null;
        return [
            'photo' => self::toPhoto($row, true, is_int($coverId) ? $coverId : null),
            'deduped' => false,
            'dedupe_reason' => null,
            'album' => $album,
        ];
    }

    public static function updatePhoto(int $photoId, array $fields): array
    {
        self::ensureSchema();
        $row = self::getPhoto($photoId);
        if (!$row) {
            throw new InvalidArgumentException('Photo not found');
        }
        $caption = array_key_exists('caption', $fields)
            ? trim((string)$fields['caption'])
            : (string)($row['caption'] ?? '');
        if (strlen($caption) > 2000) {
            $caption = substr($caption, 0, 2000);
        }
        $capture = array_key_exists('capture_time', $fields)
            ? self::normalizeCaptureTime(
                $fields['capture_time'] !== null ? (string)$fields['capture_time'] : null,
                null,
                null
            )
            : ($row['capture_time'] !== null ? (string)$row['capture_time'] : null);

        Database::execute(
            'UPDATE celebr8_photos SET caption = ?, capture_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [$caption, $capture, $photoId]
        );
        $fresh = self::getPhoto($photoId);
        if (!$fresh) {
            throw new RuntimeException('Failed to reload photo');
        }
        $coverId = self::coverPhotoIdForParty((int)$fresh['party_id']);
        return self::toPhoto($fresh, true, $coverId);
    }

    public static function setCoverPhoto(int $photoId): array
    {
        self::ensureSchema();
        $row = self::getPhoto($photoId);
        if (!$row) {
            throw new InvalidArgumentException('Photo not found');
        }
        $albumId = (int)$row['album_id'];
        $partyId = (int)$row['party_id'];
        Database::execute(
            'UPDATE celebr8_albums SET cover_photo_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [$photoId, $albumId]
        );
        return [
            'album' => self::getAlbum($albumId),
            'photo' => self::toPhoto($row, true, $photoId),
            'party_id' => $partyId,
            'cover_url' => self::sessionMediaUrl($photoId, 'web'),
        ];
    }

    public static function clearCoverPhoto(int $partyId = 0, int $albumId = 0): array
    {
        self::ensureSchema();
        $album = null;
        if ($albumId > 0) {
            $album = self::getAlbum($albumId);
        } elseif ($partyId > 0) {
            $album = self::getAlbumByParty($partyId);
        }
        if (!$album) {
            throw new InvalidArgumentException('Album not found');
        }
        Database::execute(
            'UPDATE celebr8_albums SET cover_photo_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [(int)$album['id']]
        );
        return ['album' => self::getAlbum((int)$album['id'])];
    }

    /**
     * @param list<int> $photoIds ordered list of photo ids for one album/party
     */
    public static function reorderPhotos(array $photoIds, int $partyId = 0, int $albumId = 0): array
    {
        self::ensureSchema();
        $ids = [];
        foreach ($photoIds as $raw) {
            $id = (int)$raw;
            if ($id > 0) {
                $ids[] = $id;
            }
        }
        $ids = array_values(array_unique($ids));
        if ($ids === []) {
            throw new InvalidArgumentException('photo_ids required');
        }

        if ($albumId <= 0 && $partyId <= 0) {
            $first = self::getPhoto($ids[0]);
            if (!$first) {
                throw new InvalidArgumentException('Photo not found');
            }
            $albumId = (int)$first['album_id'];
            $partyId = (int)$first['party_id'];
        }

        $album = $albumId > 0 ? self::getAlbum($albumId) : self::getAlbumByParty($partyId);
        if (!$album) {
            throw new InvalidArgumentException('Album not found');
        }
        $albumId = (int)$album['id'];
        $partyId = (int)$album['party_id'];

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $owned = Database::queryAll(
            "SELECT id FROM celebr8_photos WHERE album_id = ? AND id IN ({$placeholders})",
            array_merge([$albumId], $ids)
        );
        $ownedIds = array_map(static fn (array $r): int => (int)$r['id'], $owned);
        if (count($ownedIds) !== count($ids)) {
            throw new InvalidArgumentException('All photo_ids must belong to the same album');
        }

        $order = 0;
        foreach ($ids as $id) {
            Database::execute(
                'UPDATE celebr8_photos SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND album_id = ?',
                [$order, $id, $albumId]
            );
            $order++;
        }

        return [
            'album' => self::getAlbum($albumId),
            'photos' => self::listPhotos($partyId, $albumId),
        ];
    }

    /**
     * @param list<int> $photoIds
     */
    public static function movePhotos(array $photoIds, int $toPartyId): array
    {
        self::ensureSchema();
        self::ensureAlbumsRoot();
        $ids = [];
        foreach ($photoIds as $raw) {
            $id = (int)$raw;
            if ($id > 0) {
                $ids[] = $id;
            }
        }
        $ids = array_values(array_unique($ids));
        if ($ids === []) {
            throw new InvalidArgumentException('photo_id or photo_ids required');
        }
        if ($toPartyId <= 0) {
            throw new InvalidArgumentException('to_party_id required');
        }
        $destAlbum = self::getOrCreateAlbumForParty($toPartyId);
        $destAlbumId = (int)$destAlbum['id'];
        $destDir = self::albumsRoot() . '/' . $toPartyId;
        if (!is_dir($destDir) && !mkdir($destDir, 0700, true) && !is_dir($destDir)) {
            throw new RuntimeException('Failed to create destination album directory');
        }

        $moved = [];
        foreach ($ids as $photoId) {
            $row = self::getPhoto($photoId);
            if (!$row) {
                throw new InvalidArgumentException('Photo not found: ' . $photoId);
            }
            $fromParty = (int)$row['party_id'];
            $fromAlbum = (int)$row['album_id'];
            if ($fromParty === $toPartyId && $fromAlbum === $destAlbumId) {
                $moved[] = self::toPhoto($row, true, self::coverPhotoIdForParty($toPartyId));
                continue;
            }

            // Dedupe collision in destination album.
            $hash = (string)$row['content_hash'];
            $collision = Database::queryOne(
                'SELECT id FROM celebr8_photos WHERE album_id = ? AND content_hash = ? LIMIT 1',
                [$destAlbumId, $hash]
            );
            if ($collision) {
                throw new InvalidArgumentException(
                    'A photo with the same content already exists in the destination album'
                );
            }
            $srcUuid = $row['source_uuid'] !== null ? (string)$row['source_uuid'] : '';
            if ($srcUuid !== '') {
                $uuidHit = Database::queryOne(
                    'SELECT id FROM celebr8_photos WHERE album_id = ? AND source_uuid = ? LIMIT 1',
                    [$destAlbumId, $srcUuid]
                );
                if ($uuidHit) {
                    throw new InvalidArgumentException(
                        'A photo with the same source_uuid already exists in the destination album'
                    );
                }
            }

            $pathMap = [];
            foreach (['relative_path', 'thumb_path', 'web_path'] as $key) {
                $rel = (string)($row[$key] ?? '');
                if ($rel === '') {
                    $pathMap[$key] = '';
                    continue;
                }
                $abs = self::resolveStoredPath($rel);
                if ($abs === null || !is_file($abs)) {
                    $pathMap[$key] = $rel;
                    continue;
                }
                $base = basename($abs);
                $newAbs = $destDir . '/' . $base;
                if ($abs !== $newAbs) {
                    if (!@rename($abs, $newAbs) && !(@copy($abs, $newAbs) && @unlink($abs))) {
                        throw new RuntimeException('Failed to move photo file');
                    }
                    @chmod($newAbs, 0600);
                }
                $pathMap[$key] = 'albums/' . $toPartyId . '/' . $base;
            }

            // If variants shared the same path, keep them consistent after move.
            if ($pathMap['thumb_path'] === '' && $pathMap['relative_path'] !== '') {
                $pathMap['thumb_path'] = $pathMap['relative_path'];
            }
            if ($pathMap['web_path'] === '' && $pathMap['relative_path'] !== '') {
                $pathMap['web_path'] = $pathMap['relative_path'];
            }

            $sortOrder = self::nextSortOrder($destAlbumId);
            Database::execute(
                'UPDATE celebr8_photos SET
                    album_id = ?, party_id = ?, relative_path = ?, thumb_path = ?, web_path = ?,
                    sort_order = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?',
                [
                    $destAlbumId,
                    $toPartyId,
                    $pathMap['relative_path'],
                    $pathMap['thumb_path'],
                    $pathMap['web_path'],
                    $sortOrder,
                    $photoId,
                ]
            );

            // Clear cover on source album if this was the cover.
            Database::execute(
                'UPDATE celebr8_albums SET cover_photo_id = NULL, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND cover_photo_id = ?',
                [$fromAlbum, $photoId]
            );

            $fresh = self::getPhoto($photoId);
            if ($fresh) {
                $moved[] = self::toPhoto($fresh, true, self::coverPhotoIdForParty($toPartyId));
            }
        }

        return [
            'album' => self::getAlbum($destAlbumId),
            'photos' => $moved,
            'to_party_id' => $toPartyId,
        ];
    }

    public static function deletePhoto(int $photoId): bool
    {
        $result = self::deletePhotos([$photoId]);
        return $result['deleted'] > 0;
    }

    /**
     * @param list<int> $photoIds
     * @return array{deleted:int, photo_ids:list<int>}
     */
    public static function deletePhotos(array $photoIds): array
    {
        self::ensureSchema();
        $ids = [];
        foreach ($photoIds as $raw) {
            $id = (int)$raw;
            if ($id > 0) {
                $ids[] = $id;
            }
        }
        $ids = array_values(array_unique($ids));
        $deleted = [];
        foreach ($ids as $photoId) {
            $row = self::getPhoto($photoId);
            if (!$row) {
                continue;
            }
            $albumId = (int)$row['album_id'];
            foreach (['relative_path', 'thumb_path', 'web_path'] as $key) {
                $rel = (string)($row[$key] ?? '');
                $abs = self::resolveStoredPath($rel);
                if ($abs !== null && is_file($abs)) {
                    @unlink($abs);
                }
            }
            Database::execute(
                'UPDATE celebr8_albums SET cover_photo_id = NULL, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND cover_photo_id = ?',
                [$albumId, $photoId]
            );
            Database::execute('DELETE FROM celebr8_photos WHERE id = ?', [$photoId]);
            $deleted[] = $photoId;
        }
        return ['deleted' => count($deleted), 'photo_ids' => $deleted];
    }

    private static function normalizeCaptureTime(?string $raw, ?string $tmpPath, ?string $mime): ?string
    {
        $raw = $raw !== null ? trim($raw) : '';
        if ($raw !== '') {
            $ts = strtotime($raw);
            if ($ts !== false) {
                return gmdate('Y-m-d H:i:s', $ts);
            }
            // Also accept already-normalized MySQL datetimes.
            if (preg_match('/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/', $raw)) {
                return str_replace('T', ' ', $raw);
            }
            throw new InvalidArgumentException('Invalid capture_time');
        }
        if ($tmpPath && $mime === 'image/jpeg' && function_exists('exif_read_data')) {
            $exif = @exif_read_data($tmpPath, 'EXIF', true);
            $dt = '';
            if (is_array($exif)) {
                $dt = (string)($exif['EXIF']['DateTimeOriginal'] ?? $exif['IFD0']['DateTime'] ?? '');
            }
            if ($dt !== '') {
                // EXIF is typically "YYYY:MM:DD HH:MM:SS"
                $dt = preg_replace('/^(\d{4}):(\d{2}):(\d{2})/', '$1-$2-$3', $dt) ?? $dt;
                $ts = strtotime($dt);
                if ($ts !== false) {
                    return date('Y-m-d H:i:s', $ts);
                }
            }
        }
        return null;
    }

    private static function loadGdImage(string $path, string $mime)
    {
        return match ($mime) {
            'image/jpeg' => @imagecreatefromjpeg($path),
            'image/png' => @imagecreatefrompng($path),
            'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($path) : false,
            'image/gif' => @imagecreatefromgif($path),
            default => false,
        };
    }

    private static function writeStrippedOriginal(string $src, string $dest, string $mime): void
    {
        $img = self::loadGdImage($src, $mime);
        if ($img === false) {
            // Fallback: copy bytes (GPS may remain in JPEG EXIF). Prefer fail closed for non-images already.
            if (!@copy($src, $dest)) {
                throw new RuntimeException('Failed to store original');
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
        // Do not call imagedestroy(): deprecated no-op on PHP 8.5+ and our error handler promotes it.
        unset($img);
        if (!$ok) {
            throw new RuntimeException('Failed to write stripped original');
        }
    }

    private static function writeResizedJpeg(string $src, string $dest, int $maxEdge): void
    {
        $info = @getimagesize($src);
        if (!is_array($info)) {
            throw new RuntimeException('Cannot read image for resize');
        }
        $mime = (string)($info['mime'] ?? 'image/jpeg');
        $w = (int)$info[0];
        $h = (int)$info[1];
        if ($w <= 0 || $h <= 0) {
            throw new RuntimeException('Invalid image dimensions');
        }
        $scale = min(1.0, $maxEdge / max($w, $h));
        $nw = max(1, (int)round($w * $scale));
        $nh = max(1, (int)round($h * $scale));

        $srcImg = self::loadGdImage($src, $mime);
        if ($srcImg === false) {
            throw new RuntimeException('Cannot decode image for resize');
        }
        $dst = imagecreatetruecolor($nw, $nh);
        if ($dst === false) {
            unset($srcImg);
            throw new RuntimeException('Cannot allocate resized image');
        }
        imagecopyresampled($dst, $srcImg, 0, 0, 0, 0, $nw, $nh, $w, $h);
        $ok = @imagejpeg($dst, $dest, 85);
        unset($srcImg, $dst);
        if (!$ok) {
            throw new RuntimeException('Failed to write resized jpeg');
        }
    }
}
