<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/settings/ai_test_functions.php';
require_once __DIR__ . '/../includes/google_oauth_service_account.php';

function catn8_photo_albums_table_ensure(): void
{
    Database::execute("CREATE TABLE IF NOT EXISTS photo_albums (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(191) NOT NULL,
        slug VARCHAR(120) NOT NULL UNIQUE,
        summary TEXT NOT NULL,
        cover_image_url MEDIUMTEXT NOT NULL,
        cover_prompt TEXT NOT NULL,
        spec_json LONGTEXT NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        is_locked TINYINT(1) NOT NULL DEFAULT 0,
        created_by_user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_photo_albums_active (is_active, updated_at),
        KEY idx_photo_albums_slug (slug),
        KEY idx_photo_albums_locked (is_locked, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $cols = Database::queryAll('SHOW COLUMNS FROM photo_albums');
    $hasLocked = false;
    foreach ($cols as $col) {
        $name = strtolower(trim((string)($col['Field'] ?? '')));
        if ($name === 'is_locked') {
            $hasLocked = true;
            break;
        }
    }
    if (!$hasLocked) {
        Database::execute('ALTER TABLE photo_albums ADD COLUMN is_locked TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active');
        Database::execute('ALTER TABLE photo_albums ADD INDEX idx_photo_albums_locked (is_locked, updated_at)');
    }
}

function catn8_photo_album_page_favorites_table_ensure(): void
{
    Database::execute("CREATE TABLE IF NOT EXISTS photo_album_page_favorites (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        album_id INT NOT NULL,
        spread_index INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_album_spread (user_id, album_id, spread_index),
        KEY idx_photo_album_page_favorites_user_created (user_id, created_at),
        KEY idx_photo_album_page_favorites_album (album_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function catn8_photo_album_media_favorites_table_ensure(): void
{
    Database::execute("CREATE TABLE IF NOT EXISTS photo_album_media_favorites (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        album_id INT NOT NULL,
        spread_index INT NOT NULL,
        media_source_index INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_album_spread_media (user_id, album_id, spread_index, media_source_index),
        KEY idx_photo_album_media_favorites_user_created (user_id, created_at),
        KEY idx_photo_album_media_favorites_album (album_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function catn8_photo_album_text_favorites_table_ensure(): void
{
    Database::execute("CREATE TABLE IF NOT EXISTS photo_album_text_favorites (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        album_id INT NOT NULL,
        spread_index INT NOT NULL,
        text_item_id VARCHAR(191) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_album_spread_text (user_id, album_id, spread_index, text_item_id),
        KEY idx_photo_album_text_favorites_user_created (user_id, created_at),
        KEY idx_photo_album_text_favorites_album (album_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function catn8_photo_albums_slug(string $value): string
{
    $value = strtolower(trim($value));
    $value = preg_replace('/[^a-z0-9]+/', '-', $value);
    $value = trim((string)$value, '-');
    return substr($value, 0, 120);
}

function catn8_photo_albums_clean_text($value, int $maxLen): string
{
    $value = preg_replace('/\s+/', ' ', trim((string)$value));
    if (!is_string($value)) {
        return '';
    }
    if ($maxLen > 0 && strlen($value) > $maxLen) {
        $value = substr($value, 0, $maxLen);
    }
    return $value;
}

function catn8_photo_albums_require_json_request(): void
{
    $contentType = strtolower(trim((string)($_SERVER['CONTENT_TYPE'] ?? '')));
    if ($contentType === '') {
        $contentType = strtolower(trim((string)($_SERVER['HTTP_CONTENT_TYPE'] ?? '')));
    }
    if ($contentType === '' || strpos($contentType, 'application/json') === false) {
        catn8_json_response(['success' => false, 'error' => 'Content-Type must be application/json'], 415);
    }
}

function catn8_photo_albums_parse_spec($raw, string $title): array
{
    $decoded = json_decode((string)$raw, true);
    if (!is_array($decoded)) {
        return [
            'schema_version' => 'catn8_scrapbook_spec_v1',
            'dimensions' => [
                'width_px' => 1400,
                'height_px' => 1050,
                'aspect_ratio' => '4:3',
                'safe_margin_px' => 56,
                'bleed_px' => 24,
            ],
            'controls' => [
                'page_turn_style' => 'ribbon-tabs',
                'zoom' => ['min' => 0.75, 'max' => 2.5, 'step' => 0.25, 'initial' => 1],
                'downloads' => [
                    'allow_cover_download' => true,
                    'allow_page_download' => true,
                    'formats' => ['png', 'jpg', 'webp'],
                    'default_format' => 'png',
                ],
            ],
            'style_guide' => [
                'memory_era' => 'family timeline',
                'mood' => 'warm and nostalgic',
                'palette' => ['rose', 'cream', 'sage'],
                'materials' => ['linen', 'postcards', 'paper tape'],
                'motifs' => ['postmarks', 'handwriting'],
                'scrapbook_feel' => 'A deeply personal, handcrafted scrapbook assembled over months or years.',
            ],
            'spreads' => [
                [
                    'spread_number' => 1,
                    'title' => 'Opening Notes',
                    'caption' => 'Setting the tone of this chapter.',
                    'photo_slots' => 3,
                    'embellishments' => ['handwritten notes'],
                    'background_prompt' => '[CATN8_SCRAPBOOK_SPREAD_BG_V1] Spread: 1/1 | Mood: warm and nostalgic',
                ],
            ],
            'title_hint' => $title,
        ];
    }

    return $decoded;
}

function catn8_photo_albums_row_to_payload(array $row): array
{
    return [
        'id' => (int)($row['id'] ?? 0),
        'title' => (string)($row['title'] ?? ''),
        'slug' => (string)($row['slug'] ?? ''),
        'summary' => (string)($row['summary'] ?? ''),
        'cover_image_url' => (string)($row['cover_image_url'] ?? ''),
        'cover_prompt' => (string)($row['cover_prompt'] ?? ''),
        'spec' => catn8_photo_albums_parse_spec((string)($row['spec_json'] ?? '{}'), (string)($row['title'] ?? '')),
        'is_active' => (int)($row['is_active'] ?? 0),
        'is_locked' => (int)($row['is_locked'] ?? 0),
        'created_by_user_id' => (int)($row['created_by_user_id'] ?? 0),
        'created_by_username' => (string)($row['created_by_username'] ?? ''),
        'created_at' => (string)($row['created_at'] ?? ''),
        'updated_at' => (string)($row['updated_at'] ?? ''),
        'is_virtual' => (int)($row['is_virtual'] ?? 0) === 1,
        'virtual_kind' => (string)($row['virtual_kind'] ?? ''),
    ];
}

function catn8_photo_albums_as_list(array $value): array
{
    return array_values(array_filter(array_map(static fn ($item) => trim((string)$item), $value), static fn ($item) => $item !== ''));
}

function catn8_photo_albums_split_lines(string $text): array
{
    $normalized = preg_replace('/\r\n?/', "\n", (string)$text);
    if (!is_string($normalized)) {
        return [];
    }
    $rawLines = explode("\n", $normalized);
    $lines = [];
    foreach ($rawLines as $line) {
        $clean = trim((string)$line);
        if ($clean !== '') {
            $lines[] = $clean;
        }
    }
    return $lines;
}

function catn8_photo_albums_is_message_like_line(string $line): bool
{
    return preg_match('/^([A-Za-z][A-Za-z\' -]{0,30}|Contact|Unknown)\s*(?:\([0-9]{1,2}:[0-9]{2}\s*[AP]M\)|\[[0-9]{1,2}:[0-9]{2}\s*[AP]M\])?\s*:/i', trim($line)) === 1;
}

function catn8_photo_albums_note_ids_for_spread(array $spread): array
{
    $ids = [];
    $seen = [];

    $addId = static function (string $id) use (&$ids, &$seen): void {
        $safe = trim($id);
        if ($safe === '' || isset($seen[$safe])) {
            return;
        }
        $seen[$safe] = true;
        $ids[] = $safe;
    };

    $images = is_array($spread['images'] ?? null) ? $spread['images'] : [];
    foreach ($images as $mediaIndex => $image) {
        if (!is_array($image)) {
            continue;
        }
        $captionLines = catn8_photo_albums_split_lines((string)($image['caption'] ?? ''));
        foreach ($captionLines as $lineIndex => $line) {
            if (!catn8_photo_albums_is_message_like_line($line)) {
                continue;
            }
            $addId('media-note-' . ((int)$mediaIndex) . '-' . ((int)$lineIndex));
        }
    }

    $textItems = is_array($spread['text_items'] ?? null) ? $spread['text_items'] : [];
    foreach ($textItems as $textIndex => $textItem) {
        if (!is_array($textItem)) {
            continue;
        }
        $candidateId = trim((string)($textItem['id'] ?? ''));
        if ($candidateId === '') {
            $candidateId = 'text-' . ((int)$textIndex);
        }
        $addId($candidateId);
    }

    $spreadLines = catn8_photo_albums_split_lines((string)($spread['caption'] ?? ''));
    foreach ($spreadLines as $lineIndex => $line) {
        if (!catn8_photo_albums_is_message_like_line($line)) {
            continue;
        }
        $addId('spread-note-' . ((int)$lineIndex));
    }

    return $ids;
}

function catn8_photo_albums_favorites_payload(int $viewerId): array
{
    $pageRows = Database::queryAll(
        'SELECT album_id, spread_index
           FROM photo_album_page_favorites
          WHERE user_id = ?
          ORDER BY created_at ASC, id ASC',
        [$viewerId]
    );
    $mediaRows = Database::queryAll(
        'SELECT album_id, spread_index, media_source_index
           FROM photo_album_media_favorites
          WHERE user_id = ?
          ORDER BY created_at ASC, id ASC',
        [$viewerId]
    );
    $textRows = Database::queryAll(
        'SELECT album_id, spread_index, text_item_id
           FROM photo_album_text_favorites
          WHERE user_id = ?
          ORDER BY created_at ASC, id ASC',
        [$viewerId]
    );

    $pages = array_map(static fn ($row) => [
        'album_id' => (int)($row['album_id'] ?? 0),
        'spread_index' => (int)($row['spread_index'] ?? 0),
    ], $pageRows);
    $media = array_map(static fn ($row) => [
        'album_id' => (int)($row['album_id'] ?? 0),
        'spread_index' => (int)($row['spread_index'] ?? 0),
        'media_source_index' => (int)($row['media_source_index'] ?? 0),
    ], $mediaRows);
    $text = array_map(static fn ($row) => [
        'album_id' => (int)($row['album_id'] ?? 0),
        'spread_index' => (int)($row['spread_index'] ?? 0),
        'text_item_id' => trim((string)($row['text_item_id'] ?? '')),
    ], $textRows);

    return [
        'pages' => $pages,
        'media' => $media,
        'text' => $text,
    ];
}

function catn8_photo_albums_virtual_payload(int $id, string $title, string $summary, string $coverImageUrl, array $spreads, string $kind): array
{
    return [
        'id' => $id,
        'title' => $title,
        'slug' => $kind,
        'summary' => $summary,
        'cover_image_url' => $coverImageUrl,
        'cover_prompt' => '',
        'is_active' => 1,
        'created_by_user_id' => 0,
        'created_by_username' => '',
        'created_at' => gmdate('Y-m-d H:i:s'),
        'updated_at' => gmdate('Y-m-d H:i:s'),
        'spec' => [
            'schema_version' => 'catn8_scrapbook_spec_v1',
            'dimensions' => [
                'width_px' => 1400,
                'height_px' => 1050,
                'aspect_ratio' => '4:3',
                'safe_margin_px' => 56,
                'bleed_px' => 24,
            ],
            'controls' => [
                'page_turn_style' => 'ribbon-tabs',
                'zoom' => ['min' => 0.75, 'max' => 2.5, 'step' => 0.25, 'initial' => 1],
                'downloads' => [
                    'allow_cover_download' => false,
                    'allow_page_download' => false,
                    'formats' => ['png'],
                    'default_format' => 'png',
                ],
            ],
            'style_guide' => [
                'memory_era' => 'favorites',
                'mood' => 'warm and nostalgic',
                'palette' => ['gold', 'cream', 'sage'],
                'materials' => ['paper tape', 'linen', 'postcards'],
                'motifs' => ['stars', 'hearts', 'bookmarks'],
                'scrapbook_feel' => 'A curated set of favorite memories.',
            ],
            'spreads' => $spreads,
        ],
        'is_virtual' => true,
        'virtual_kind' => $kind,
    ];
}

function catn8_photo_albums_download_b64_from_url(string $url): string
{
    $url = trim($url);
    if ($url === '') {
        throw new RuntimeException('Generated image URL was empty');
    }
    $parts = parse_url($url);
    if (!is_array($parts)) {
        throw new RuntimeException('Generated image URL was invalid');
    }
    $scheme = strtolower((string)($parts['scheme'] ?? ''));
    if ($scheme !== 'https' && $scheme !== 'http') {
        throw new RuntimeException('Generated image URL scheme was invalid');
    }

    $binary = @file_get_contents($url);
    if (!is_string($binary) || $binary === '') {
        throw new RuntimeException('Failed to download generated image URL');
    }

    $b64 = base64_encode($binary);
    if (!is_string($b64) || trim($b64) === '') {
        throw new RuntimeException('Failed to encode generated image URL data');
    }

    return trim($b64);
}

function catn8_photo_albums_generate_cover_b64(string $prompt): array
{
    $cfg = catn8_settings_ai_image_get_config();
    $provider = strtolower(trim((string)($cfg['provider'] ?? 'openai')));
    $model = trim((string)($cfg['model'] ?? ''));
    $baseUrl = trim((string)($cfg['base_url'] ?? ''));
    $providerConfig = is_array($cfg['provider_config'] ?? null) ? $cfg['provider_config'] : [];
    $params = is_array($cfg['params'] ?? null) ? $cfg['params'] : [];

    if ($provider === 'openai') {
        $apiKey = secret_get(catn8_settings_ai_image_secret_key($provider, 'api_key'));
        if (!is_string($apiKey) || trim($apiKey) === '') {
            throw new RuntimeException('Missing AI image API key (openai)');
        }

        $factory = OpenAI::factory()->withApiKey(trim((string)$apiKey));
        if ($baseUrl !== '') {
            $factory = $factory->withBaseUri(catn8_validate_external_base_url($baseUrl));
        }
        $client = $factory->make();

        $payload = array_merge(['model' => ($model !== '' ? $model : 'gpt-image-1'), 'prompt' => $prompt], $params);
        $payload['n'] = 1;
        if (!isset($payload['response_format'])) {
            $payload['response_format'] = 'b64_json';
        }

        $resp = $client->images()->create($payload);

        $b64 = '';
        if (isset($resp->data[0]->b64_json)) {
            $b64 = trim((string)$resp->data[0]->b64_json);
        } elseif (isset($resp->data[0]->url)) {
            $b64 = catn8_photo_albums_download_b64_from_url((string)$resp->data[0]->url);
        }

        if ($b64 === '') {
            throw new RuntimeException('AI image provider returned no image data');
        }

        return [
            'b64' => $b64,
            'provider' => $provider,
            'model' => (string)($payload['model'] ?? 'gpt-image-1'),
        ];
    }

    if ($provider === 'google_vertex_ai') {
        $saJson = secret_get(catn8_settings_ai_image_secret_key($provider, 'service_account_json'));
        if (!is_string($saJson) || trim($saJson) === '') {
            throw new RuntimeException('Missing AI image service account (google_vertex_ai)');
        }

        $projectId = trim((string)($providerConfig['gcp_project_id'] ?? ''));
        if ($projectId === '') {
            throw new RuntimeException('Missing GCP project id in AI image provider config');
        }
        $region = trim((string)($providerConfig['gcp_region'] ?? 'us-central1'));
        if ($region === '') {
            $region = 'us-central1';
        }

        $modelId = $model !== '' ? $model : 'imagen-3.0-generate-001';

        $tokenData = catn8_google_oauth_service_account_token_from_json($saJson);
        $token = trim((string)($tokenData['access_token'] ?? ''));
        if ($token === '') {
            throw new RuntimeException('Failed to obtain Google access token');
        }

        $payload = [
            'instances' => [
                ['prompt' => $prompt],
            ],
            'parameters' => [
                'sampleCount' => 1,
            ],
        ];

        $aspectRatio = trim((string)($params['aspect_ratio'] ?? ''));
        if ($aspectRatio !== '') {
            $payload['parameters']['aspectRatio'] = $aspectRatio;
        }

        $endpoint = sprintf(
            'https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:predict',
            rawurlencode($region),
            rawurlencode($projectId),
            rawurlencode($region),
            rawurlencode($modelId)
        );

        $res = catn8_http_json_with_status('POST', $endpoint, [
            'Authorization' => 'Bearer ' . $token,
            'Content-Type' => 'application/json',
        ], $payload, 12, 60);

        if ((int)$res['status'] < 200 || (int)$res['status'] >= 300) {
            $raw = trim((string)($res['raw'] ?? ''));
            $tail = substr($raw, 0, 700);
            throw new RuntimeException('Vertex image request failed (' . (int)$res['status'] . '): ' . $tail);
        }

        $pred = $res['json']['predictions'][0] ?? null;
        $b64 = '';
        if (is_array($pred)) {
            $b64 = trim((string)($pred['bytesBase64Encoded'] ?? ''));
            if ($b64 === '' && isset($pred['image']['bytesBase64Encoded'])) {
                $b64 = trim((string)$pred['image']['bytesBase64Encoded']);
            }
        }

        if ($b64 === '') {
            throw new RuntimeException('Vertex returned no image bytes');
        }

        return [
            'b64' => $b64,
            'provider' => $provider,
            'model' => $modelId,
        ];
    }

    throw new RuntimeException('Unsupported AI image provider for photo albums: ' . $provider);
}

function catn8_photo_albums_build_ai_prompt(array $input): string
{
    $title = catn8_photo_albums_clean_text((string)($input['title'] ?? 'Untitled Album'), 191);
    $summary = catn8_photo_albums_clean_text((string)($input['summary'] ?? ''), 500);
    $memoryEra = catn8_photo_albums_clean_text((string)($input['memory_era'] ?? 'family timeline'), 120);
    $mood = catn8_photo_albums_clean_text((string)($input['mood'] ?? 'warm and nostalgic'), 120);
    $palette = catn8_photo_albums_clean_text((string)($input['dominant_palette'] ?? 'rose, cream, sage'), 220);
    $materials = catn8_photo_albums_clean_text((string)($input['scrapbook_materials'] ?? 'linen, torn paper, tape'), 220);
    $motifs = catn8_photo_albums_clean_text((string)($input['motif_keywords'] ?? 'postmarks, doodles, pressed flowers'), 220);
    $cameraStyle = catn8_photo_albums_clean_text((string)($input['camera_style'] ?? '35mm candid'), 120);
    $texture = catn8_photo_albums_clean_text((string)($input['texture_intensity'] ?? 'balanced'), 40);

    return implode("\n", [
        '[CATN8_SCRAPBOOK_COVER_PROMPT_V1]',
        'Create a scrapbook album cover with a handcrafted look.',
        'Style constraints:',
        '- Endearing memory-focused design, never futuristic UI.',
        '- Tactile materials and layered paper textures.',
        '- Keep text readable for title and subtitle areas.',
        'Album title: ' . $title,
        'Album summary: ' . $summary,
        'Memory era: ' . $memoryEra,
        'Mood: ' . $mood,
        'Dominant palette: ' . $palette,
        'Materials: ' . $materials,
        'Motifs: ' . $motifs,
        'Camera style inspiration: ' . $cameraStyle,
        'Texture intensity: ' . $texture,
        'Output intent: one hero cover graphic suitable for a digital scrapbook viewer.',
    ]);
}

function catn8_photo_albums_build_standard_spec(array $input): array
{
    $aspect = (string)($input['aspect_ratio'] ?? '4:3');
    $dims = ['width_px' => 1400, 'height_px' => 1050, 'aspect_ratio' => '4:3'];
    if ($aspect === '16:9') {
        $dims = ['width_px' => 1600, 'height_px' => 900, 'aspect_ratio' => '16:9'];
    } elseif ($aspect === '3:2') {
        $dims = ['width_px' => 1500, 'height_px' => 1000, 'aspect_ratio' => '3:2'];
    } elseif ($aspect === '1:1') {
        $dims = ['width_px' => 1200, 'height_px' => 1200, 'aspect_ratio' => '1:1'];
    }

    $spreadCount = (int)($input['spread_count'] ?? 10);
    $spreadCount = max(6, min(30, $spreadCount));

    $toList = static function (string $value, array $fallback): array {
        $parts = array_values(array_filter(array_map('trim', explode(',', $value)), static fn ($v) => $v !== ''));
        if (!$parts) {
            return $fallback;
        }
        return array_slice($parts, 0, 8);
    };

    $palette = $toList((string)($input['dominant_palette'] ?? ''), ['rose', 'cream', 'sage']);
    $materials = $toList((string)($input['scrapbook_materials'] ?? ''), ['linen', 'tape', 'postcards']);
    $motifs = $toList((string)($input['motif_keywords'] ?? ''), ['postmarks', 'ribbons', 'handwriting']);

    $spreads = [];
    for ($i = 1; $i <= $spreadCount; $i++) {
        $spreads[] = [
            'spread_number' => $i,
            'title' => $i === 1 ? 'Opening Notes' : ('Memory Spread ' . $i),
            'caption' => $i === 1 ? 'Setting the tone of this chapter.' : ('Highlights from spread ' . $i . '.'),
            'photo_slots' => ($i % 3 === 0 ? 4 : 3),
            'embellishments' => [
                $motifs[$i % max(1, count($motifs))] ?? 'handwritten notes',
                $materials[$i % max(1, count($materials))] ?? 'paper clippings',
            ],
            'background_prompt' => implode(' | ', [
                '[CATN8_SCRAPBOOK_SPREAD_BG_V1]',
                'Spread: ' . $i . '/' . $spreadCount,
                'Mood: ' . catn8_photo_albums_clean_text((string)($input['mood'] ?? 'warm and nostalgic'), 120),
                'Memory era: ' . catn8_photo_albums_clean_text((string)($input['memory_era'] ?? 'family timeline'), 120),
                'Palette: ' . implode(', ', $palette),
                'Materials: ' . implode(', ', $materials),
                'Motifs: ' . implode(', ', $motifs),
            ]),
        ];
    }

    $allowedPageStyles = ['ribbon-tabs', 'classic-book', 'spiral-notebook'];
    $pageTurnStyle = (string)($input['page_turn_style'] ?? 'ribbon-tabs');
    if (!in_array($pageTurnStyle, $allowedPageStyles, true)) {
        $pageTurnStyle = 'ribbon-tabs';
    }

    return [
        'schema_version' => 'catn8_scrapbook_spec_v1',
        'dimensions' => [
            'width_px' => (int)$dims['width_px'],
            'height_px' => (int)$dims['height_px'],
            'aspect_ratio' => (string)$dims['aspect_ratio'],
            'safe_margin_px' => 56,
            'bleed_px' => 24,
        ],
        'controls' => [
            'page_turn_style' => $pageTurnStyle,
            'zoom' => ['min' => 0.75, 'max' => 2.5, 'step' => 0.25, 'initial' => 1],
            'downloads' => [
                'allow_cover_download' => true,
                'allow_page_download' => true,
                'formats' => ['png', 'jpg', 'webp'],
                'default_format' => 'png',
            ],
        ],
        'style_guide' => [
            'memory_era' => catn8_photo_albums_clean_text((string)($input['memory_era'] ?? 'family timeline'), 120),
            'mood' => catn8_photo_albums_clean_text((string)($input['mood'] ?? 'warm and nostalgic'), 120),
            'palette' => $palette,
            'materials' => $materials,
            'motifs' => $motifs,
            'scrapbook_feel' => 'A deeply personal, handcrafted scrapbook assembled over months or years.',
        ],
        'spreads' => $spreads,
    ];
}

function catn8_photo_albums_get_viewer(int $viewerId): array
{
    return [
        'can_view' => true,
        'is_admin' => catn8_user_is_admin($viewerId) ? 1 : 0,
        'is_photo_albums_user' => catn8_user_in_group($viewerId, 'photo-albums-users') ? 1 : 0,
    ];
}

function catn8_photo_albums_spread_is_locked(array $spread): bool
{
    return (int)($spread['is_locked'] ?? 0) === 1;
}

function catn8_photo_albums_merge_locked_spreads(array $existingSpec, array $incomingSpec): array
{
    $existingSpreads = is_array($existingSpec['spreads'] ?? null) ? $existingSpec['spreads'] : [];
    $incomingSpreads = is_array($incomingSpec['spreads'] ?? null) ? $incomingSpec['spreads'] : [];
    foreach ($existingSpreads as $idx => $existingSpread) {
        if (!is_array($existingSpread) || !catn8_photo_albums_spread_is_locked($existingSpread)) {
            continue;
        }
        if (!isset($incomingSpreads[$idx]) || !is_array($incomingSpreads[$idx])) {
            $incomingSpreads[$idx] = $existingSpread;
            continue;
        }
        $incomingSpreads[$idx] = $existingSpread;
    }
    $incomingSpec['spreads'] = array_values($incomingSpreads);
    return $incomingSpec;
}

function catn8_photo_albums_theme_emojis(string $seed): array
{
    $base = ['✨', '🌟', '💖', '📌', '🎀', '🧵', '📷', '🌸', '🍃', '🎉', '🕊️', '🫶'];
    $lower = strtolower($seed);
    if (strpos($lower, 'beach') !== false || strpos($lower, 'summer') !== false) {
        return ['☀️', '🌊', '🏖️', '🐚', '✨', '📷'];
    }
    if (strpos($lower, 'winter') !== false || strpos($lower, 'christmas') !== false) {
        return ['❄️', '🎄', '✨', '🧣', '🕯️', '📷'];
    }
    if (strpos($lower, 'birthday') !== false || strpos($lower, 'party') !== false) {
        return ['🎉', '🎈', '✨', '🎂', '📸', '💫'];
    }
    if (strpos($lower, 'garden') !== false || strpos($lower, 'spring') !== false) {
        return ['🌸', '🌼', '🍃', '🦋', '✨', '📷'];
    }
    return $base;
}

function catn8_photo_albums_load_album_row_for_write(int $id): array
{
    $row = Database::queryOne(
        'SELECT id, title, slug, summary, cover_image_url, cover_prompt, spec_json, is_active, is_locked, created_by_user_id, (SELECT username FROM users WHERE id = created_by_user_id LIMIT 1) AS created_by_username, created_at, updated_at
         FROM photo_albums
         WHERE id = ?
         LIMIT 1',
        [$id]
    );
    if (!$row) {
        catn8_json_response(['success' => false, 'error' => 'Album not found'], 404);
    }
    if ((int)($row['is_locked'] ?? 0) === 1) {
        catn8_json_response(['success' => false, 'error' => 'Album is locked'], 423);
    }
    return is_array($row) ? $row : [];
}

function catn8_photo_albums_save_spec_and_fetch(array $row, array $spec): array
{
    $id = (int)($row['id'] ?? 0);
    $specJson = json_encode($spec, JSON_UNESCAPED_SLASHES);
    if (!is_string($specJson) || $specJson === '') {
        catn8_json_response(['success' => false, 'error' => 'Failed to encode album spec'], 500);
    }
    Database::execute('UPDATE photo_albums SET spec_json = ? WHERE id = ?', [$specJson, $id]);
    $updated = Database::queryOne(
        'SELECT id, title, slug, summary, cover_image_url, cover_prompt, spec_json, is_active, is_locked, created_by_user_id, (SELECT username FROM users WHERE id = created_by_user_id LIMIT 1) AS created_by_username, created_at, updated_at
         FROM photo_albums
         WHERE id = ?
         LIMIT 1',
        [$id]
    );
    return catn8_photo_albums_row_to_payload($updated ?: []);
}

function catn8_photo_albums_spread_theme_text(array $spread): string
{
    $parts = [];
    $parts[] = catn8_photo_albums_clean_text((string)($spread['title'] ?? ''), 220);
    $parts[] = catn8_photo_albums_clean_text((string)($spread['caption'] ?? ''), 450);
    $parts[] = catn8_photo_albums_clean_text((string)($spread['background_prompt'] ?? ''), 450);

    $embellishments = is_array($spread['embellishments'] ?? null) ? $spread['embellishments'] : [];
    if ($embellishments) {
        $parts[] = implode(', ', array_slice(catn8_photo_albums_as_list($embellishments), 0, 10));
    }
    $images = is_array($spread['images'] ?? null) ? $spread['images'] : [];
    foreach (array_slice($images, 0, 8) as $image) {
        if (!is_array($image)) {
            continue;
        }
        $parts[] = catn8_photo_albums_clean_text((string)($image['caption'] ?? ''), 160);
        $parts[] = catn8_photo_albums_clean_text((string)($image['memory_text'] ?? ''), 160);
    }

    $joined = trim(implode(' | ', array_values(array_filter($parts, static fn ($v) => is_string($v) && trim($v) !== ''))));
    if ($joined === '') {
        return 'family memories, warm scrapbook aesthetic';
    }
    return substr($joined, 0, 1400);
}

function catn8_photo_albums_position_slot(int $seed, int $maxW): array
{
    $x = 4 + (($seed * 13) % max(6, (88 - $maxW)));
    $y = 8 + (($seed * 17) % 72);
    return ['x' => (float)$x, 'y' => (float)$y];
}

function catn8_photo_albums_build_virtual_favorites(array $albums, array $favorites): array
{
    $byId = [];
    foreach ($albums as $album) {
        $aid = (int)($album['id'] ?? 0);
        if ($aid > 0) {
            $byId[$aid] = $album;
        }
    }

    $mediaItems = [];
    foreach (($favorites['media'] ?? []) as $fav) {
        $albumId = (int)($fav['album_id'] ?? 0);
        $spreadIndex = (int)($fav['spread_index'] ?? -1);
        $mediaSourceIndex = (int)($fav['media_source_index'] ?? -1);
        if ($albumId <= 0 || $spreadIndex < 0 || $mediaSourceIndex < 0 || !isset($byId[$albumId])) {
            continue;
        }
        $album = $byId[$albumId];
        $spreads = is_array($album['spec']['spreads'] ?? null) ? $album['spec']['spreads'] : [];
        $spread = $spreads[$spreadIndex] ?? null;
        if (!is_array($spread)) {
            continue;
        }
        $images = is_array($spread['images'] ?? null) ? $spread['images'] : [];
        $image = $images[$mediaSourceIndex] ?? null;
        if (!is_array($image)) {
            continue;
        }
        $src = trim((string)($image['display_src'] ?? $image['src'] ?? ''));
        if ($src === '') {
            continue;
        }
        $capturedRaw = trim((string)($image['captured_at'] ?? ''));
        $capturedMs = $capturedRaw !== '' ? strtotime($capturedRaw) : false;
        $capturedAt = $capturedMs !== false ? gmdate('c', (int)$capturedMs) : '';
        $mediaItems[] = [
            'order_ms' => $capturedMs !== false ? (int)$capturedMs : PHP_INT_MAX,
            'album_title' => (string)($album['title'] ?? ''),
            'spread_index' => $spreadIndex,
            'caption' => trim((string)($image['caption'] ?? $spread['caption'] ?? '')),
            'image' => [
                'src' => $src,
                'media_type' => (string)($image['media_type'] ?? 'image'),
                'display_src' => (string)($image['display_src'] ?? ''),
                'original_src' => (string)($image['original_src'] ?? ''),
                'live_video_src' => (string)($image['live_video_src'] ?? ''),
                'live_photo_available' => (int)($image['live_photo_available'] ?? 0) === 1,
                'captured_at' => $capturedAt !== '' ? $capturedAt : ($capturedRaw !== '' ? $capturedRaw : null),
                'source_filename' => (string)($image['source_filename'] ?? ''),
                'caption' => (string)($image['caption'] ?? ''),
                'memory_text' => (string)($image['memory_text'] ?? ''),
                'speaker_label' => (string)($image['speaker_label'] ?? ''),
                'speaker_handle_id' => (string)($image['speaker_handle_id'] ?? ''),
            ],
        ];
    }
    usort($mediaItems, static function (array $a, array $b): int {
        if ((int)$a['order_ms'] === (int)$b['order_ms']) {
            return strcmp((string)$a['album_title'], (string)$b['album_title']);
        }
        return ((int)$a['order_ms'] < (int)$b['order_ms']) ? -1 : 1;
    });

    $mediaSpreads = [];
    foreach ($mediaItems as $index => $item) {
        $dateLabel = ((int)$item['order_ms'] < PHP_INT_MAX) ? gmdate('Y-m-d', (int)$item['order_ms']) : 'Undated';
        $mediaSpreads[] = [
            'spread_number' => $index + 1,
            'title' => $dateLabel,
            'caption' => trim((string)$item['album_title']) . ' (Spread ' . ((int)$item['spread_index'] + 1) . ')',
            'photo_slots' => 1,
            'embellishments' => ['favorites', 'bookmarks'],
            'background_prompt' => '[CATN8_SCRAPBOOK_SPREAD_BG_V1] Favorites media',
            'images' => [$item['image']],
        ];
    }
    if (!$mediaSpreads) {
        $mediaSpreads[] = [
            'spread_number' => 1,
            'title' => 'No Favorite Media Yet',
            'caption' => 'Tap the star on any image or video to add it here.',
            'photo_slots' => 0,
            'embellishments' => ['favorites'],
            'background_prompt' => '[CATN8_SCRAPBOOK_SPREAD_BG_V1] Favorites media empty',
            'images' => [],
        ];
    }

    $pageItems = [];
    foreach (($favorites['pages'] ?? []) as $fav) {
        $albumId = (int)($fav['album_id'] ?? 0);
        $spreadIndex = (int)($fav['spread_index'] ?? -1);
        if ($albumId <= 0 || $spreadIndex < 0 || !isset($byId[$albumId])) {
            continue;
        }
        $album = $byId[$albumId];
        $spreads = is_array($album['spec']['spreads'] ?? null) ? $album['spec']['spreads'] : [];
        $spread = $spreads[$spreadIndex] ?? null;
        if (!is_array($spread)) {
            continue;
        }
        $images = is_array($spread['images'] ?? null) ? $spread['images'] : [];
        $capturedMs = false;
        foreach ($images as $image) {
            if (!is_array($image)) {
                continue;
            }
            $capturedRaw = trim((string)($image['captured_at'] ?? ''));
            if ($capturedRaw === '') {
                continue;
            }
            $next = strtotime($capturedRaw);
            if ($next === false) {
                continue;
            }
            if ($capturedMs === false || $next < $capturedMs) {
                $capturedMs = $next;
            }
        }
        $pageItems[] = [
            'order_ms' => $capturedMs !== false ? (int)$capturedMs : PHP_INT_MAX,
            'album_title' => (string)($album['title'] ?? ''),
            'spread_index' => $spreadIndex,
            'spread' => $spread,
        ];
    }
    usort($pageItems, static function (array $a, array $b): int {
        if ((int)$a['order_ms'] === (int)$b['order_ms']) {
            return strcmp((string)$a['album_title'], (string)$b['album_title']);
        }
        return ((int)$a['order_ms'] < (int)$b['order_ms']) ? -1 : 1;
    });

    $pageSpreads = [];
    foreach ($pageItems as $index => $item) {
        $spread = is_array($item['spread']) ? $item['spread'] : [];
        $spread['spread_number'] = $index + 1;
        $spread['caption'] = trim((string)($item['album_title'] ?? '')) . ': ' . trim((string)($spread['caption'] ?? ''));
        $pageSpreads[] = $spread;
    }
    if (!$pageSpreads) {
        $pageSpreads[] = [
            'spread_number' => 1,
            'title' => 'No Favorite Pages Yet',
            'caption' => 'Tap the star on any page to add it here.',
            'photo_slots' => 0,
            'embellishments' => ['favorites'],
            'background_prompt' => '[CATN8_SCRAPBOOK_SPREAD_BG_V1] Favorites pages empty',
            'images' => [],
        ];
    }

    $textItems = [];
    foreach (($favorites['text'] ?? []) as $fav) {
        $albumId = (int)($fav['album_id'] ?? 0);
        $spreadIndex = (int)($fav['spread_index'] ?? -1);
        $textItemId = trim((string)($fav['text_item_id'] ?? ''));
        if ($albumId <= 0 || $spreadIndex < 0 || $textItemId === '' || !isset($byId[$albumId])) {
            continue;
        }
        $album = $byId[$albumId];
        $spreads = is_array($album['spec']['spreads'] ?? null) ? $album['spec']['spreads'] : [];
        $spread = $spreads[$spreadIndex] ?? null;
        if (!is_array($spread)) {
            continue;
        }
        $availableNoteIds = catn8_photo_albums_note_ids_for_spread($spread);
        if (!in_array($textItemId, $availableNoteIds, true)) {
            continue;
        }

        $resolvedText = '';
        $textItemsInSpread = is_array($spread['text_items'] ?? null) ? $spread['text_items'] : [];
        foreach ($textItemsInSpread as $textIndex => $textItem) {
            if (!is_array($textItem)) {
                continue;
            }
            $candidateId = trim((string)($textItem['id'] ?? ''));
            if ($candidateId === '') {
                $candidateId = 'text-' . ((int)$textIndex);
            }
            if ($candidateId === $textItemId) {
                $resolvedText = trim((string)($textItem['text'] ?? ''));
                break;
            }
        }

        if ($resolvedText === '' && preg_match('/^spread-note-([0-9]+)$/', $textItemId, $match) === 1) {
            $lineIndex = (int)($match[1] ?? 0);
            $spreadLines = catn8_photo_albums_split_lines((string)($spread['caption'] ?? ''));
            $resolvedText = trim((string)($spreadLines[$lineIndex] ?? ''));
        }

        if ($resolvedText === '' && preg_match('/^media-note-([0-9]+)-([0-9]+)$/', $textItemId, $match) === 1) {
            $mediaIndex = (int)($match[1] ?? 0);
            $lineIndex = (int)($match[2] ?? 0);
            $images = is_array($spread['images'] ?? null) ? $spread['images'] : [];
            $image = is_array($images[$mediaIndex] ?? null) ? $images[$mediaIndex] : [];
            $mediaLines = catn8_photo_albums_split_lines((string)($image['caption'] ?? ''));
            $resolvedText = trim((string)($mediaLines[$lineIndex] ?? ''));
        }

        if ($resolvedText === '') {
            continue;
        }

        $capturedMs = false;
        $images = is_array($spread['images'] ?? null) ? $spread['images'] : [];
        foreach ($images as $image) {
            if (!is_array($image)) {
                continue;
            }
            $capturedRaw = trim((string)($image['captured_at'] ?? ''));
            if ($capturedRaw === '') {
                continue;
            }
            $next = strtotime($capturedRaw);
            if ($next === false) {
                continue;
            }
            if ($capturedMs === false || $next < $capturedMs) {
                $capturedMs = $next;
            }
        }

        $textItems[] = [
            'order_ms' => $capturedMs !== false ? (int)$capturedMs : PHP_INT_MAX,
            'album_title' => (string)($album['title'] ?? ''),
            'spread_index' => $spreadIndex,
            'text' => $resolvedText,
            'id' => $textItemId,
        ];
    }
    usort($textItems, static function (array $a, array $b): int {
        if ((int)$a['order_ms'] === (int)$b['order_ms']) {
            return strcmp((string)$a['album_title'], (string)$b['album_title']);
        }
        return ((int)$a['order_ms'] < (int)$b['order_ms']) ? -1 : 1;
    });

    $textSpreads = [];
    foreach ($textItems as $index => $item) {
        $dateLabel = ((int)$item['order_ms'] < PHP_INT_MAX) ? gmdate('Y-m-d', (int)$item['order_ms']) : 'Undated';
        $textSpreads[] = [
            'spread_number' => $index + 1,
            'title' => $dateLabel,
            'caption' => trim((string)$item['album_title']) . ' (Spread ' . ((int)$item['spread_index'] + 1) . ')',
            'photo_slots' => 0,
            'embellishments' => ['favorites', 'notes'],
            'background_prompt' => '[CATN8_SCRAPBOOK_SPREAD_BG_V1] Favorites text',
            'images' => [],
            'text_items' => [[
                'id' => (string)$item['id'],
                'text' => (string)$item['text'],
            ]],
        ];
    }
    if (!$textSpreads) {
        $textSpreads[] = [
            'spread_number' => 1,
            'title' => 'No Favorite Text Yet',
            'caption' => 'Tap the heart on any text note to add it here.',
            'photo_slots' => 0,
            'embellishments' => ['favorites'],
            'background_prompt' => '[CATN8_SCRAPBOOK_SPREAD_BG_V1] Favorites text empty',
            'images' => [],
            'text_items' => [],
        ];
    }

    $firstMediaImage = is_array($mediaSpreads[0]['images'] ?? null) ? ($mediaSpreads[0]['images'][0] ?? null) : null;
    $mediaCover = is_array($firstMediaImage) ? trim((string)($firstMediaImage['display_src'] ?? $firstMediaImage['src'] ?? '')) : '';

    $firstPageSpreadImages = is_array($pageSpreads[0]['images'] ?? null) ? $pageSpreads[0]['images'] : [];
    $firstPageImage = is_array($firstPageSpreadImages[0] ?? null) ? $firstPageSpreadImages[0] : null;
    $pageCover = is_array($firstPageImage) ? trim((string)($firstPageImage['display_src'] ?? $firstPageImage['src'] ?? '')) : '';

    return [
        catn8_photo_albums_virtual_payload(
            -1001,
            'Favorite Media',
            count($mediaItems) . ' items favorited.',
            $mediaCover,
            $mediaSpreads,
            'favorite_media'
        ),
        catn8_photo_albums_virtual_payload(
            -1002,
            'Favorite Pages',
            count($pageItems) . ' pages favorited.',
            $pageCover,
            $pageSpreads,
            'favorite_pages'
        ),
        catn8_photo_albums_virtual_payload(
            -1003,
            'Favorite Text',
            count($textItems) . ' messages favorited.',
            '',
            $textSpreads,
            'favorite_text'
        ),
    ];
}

function catn8_photo_albums_layout_hash_fraction(string $seed): float
{
    $hash = crc32($seed);
    if (!is_int($hash)) {
        $hash = 0;
    }
    $unsigned = (float)sprintf('%u', $hash);
    return fmod($unsigned, 1000000.0) / 1000000.0;
}

function catn8_photo_albums_layout_clamp(float $value, float $min, float $max): float
{
    if ($value < $min) {
        return $min;
    }
    if ($value > $max) {
        return $max;
    }
    return $value;
}

function catn8_photo_albums_layout_parse_clock_to_minutes(string $value): ?int
{
    $trimmed = trim($value);
    if ($trimmed === '') {
        return null;
    }
    if (!preg_match('/^([0-9]{1,2}):([0-9]{2})\s*([AP]M)$/i', $trimmed, $m)) {
        return null;
    }
    $hour = (int)$m[1];
    $minute = (int)$m[2];
    $period = strtoupper((string)$m[3]);
    if ($hour < 1 || $hour > 12 || $minute < 0 || $minute > 59) {
        return null;
    }
    if ($period === 'AM') {
        if ($hour === 12) {
            $hour = 0;
        }
    } elseif ($hour !== 12) {
        $hour += 12;
    }
    return ($hour * 60) + $minute;
}

function catn8_photo_albums_layout_estimate_lines(string $text, float $widthPct, float $charScale, int $minCharsPerLine): int
{
    $chars = max(0, strlen(trim($text)));
    $charsPerLine = max($minCharsPerLine, (int)floor($widthPct * $charScale));
    if ($charsPerLine <= 0) {
        $charsPerLine = $minCharsPerLine;
    }
    return max(1, (int)ceil($chars / $charsPerLine));
}

function catn8_photo_albums_layout_estimate_note_height(string $text, float $widthPct): float
{
    $lines = catn8_photo_albums_layout_estimate_lines($text, $widthPct, 1.5, 10);
    return catn8_photo_albums_layout_clamp(9.2 + ($lines * 4.2), 12.0, 62.0);
}

function catn8_photo_albums_layout_estimate_media_height(string $caption, float $widthPct): float
{
    $lines = catn8_photo_albums_layout_estimate_lines($caption, $widthPct, 1.65, 12);
    $imageHeight = $widthPct * 0.76;
    return catn8_photo_albums_layout_clamp($imageHeight + 5.8 + ($lines * 3.4), 14.0, 70.0);
}

function catn8_photo_albums_layout_overlap(array $a, array $b): bool
{
    $gap = 1.35;
    $aX1 = ((float)$a['x']) - $gap;
    $aY1 = ((float)$a['y']) - $gap;
    $aX2 = ((float)$a['x']) + ((float)$a['w']) + $gap;
    $aY2 = ((float)$a['y']) + ((float)$a['h']) + $gap;
    $bX1 = ((float)$b['x']) - $gap;
    $bY1 = ((float)$b['y']) - $gap;
    $bX2 = ((float)$b['x']) + ((float)$b['w']) + $gap;
    $bY2 = ((float)$b['y']) + ((float)$b['h']) + $gap;
    return !($aX2 <= $bX1 || $bX2 <= $aX1 || $aY2 <= $bY1 || $bY2 <= $aY1);
}

function catn8_photo_albums_layout_place_item(array $item, array $placed, string $seed, array $reservedRects = []): array
{
    $minX = 2.0;
    $maxX = 98.0;
    $minY = 4.0;
    $maxY = 94.0;

    $baseX = catn8_photo_albums_layout_clamp((float)$item['preferred_x'], $minX, $maxX - (float)$item['w']);
    $baseY = catn8_photo_albums_layout_clamp((float)$item['preferred_y'], $minY, $maxY - (float)$item['h']);

    $candidate = $item;
    $candidate['x'] = $baseX;
    $candidate['y'] = $baseY;

    $fits = static function (array $next) use ($placed, $reservedRects): bool {
        foreach ($reservedRects as $reserved) {
            if (!is_array($reserved)) {
                continue;
            }
            if (catn8_photo_albums_layout_overlap($next, [
                'x' => (float)($reserved['x'] ?? 0.0),
                'y' => (float)($reserved['y'] ?? 0.0),
                'w' => (float)($reserved['w'] ?? 0.0),
                'h' => (float)($reserved['h'] ?? 0.0),
            ])) {
                return false;
            }
        }
        foreach ($placed as $other) {
            if (catn8_photo_albums_layout_overlap($next, $other)) {
                return false;
            }
        }
        return true;
    };

    if ($fits($candidate)) {
        return $candidate;
    }

    $w = (float)$candidate['w'];
    $h = (float)$candidate['h'];
    for ($shrinkPass = 0; $shrinkPass < 24; $shrinkPass++) {
        $ringStep = 1.05 + ($shrinkPass * 0.1);
        for ($attempt = 0; $attempt < 320; $attempt++) {
            $ring = (int)floor($attempt / 16);
            $angle = (catn8_photo_albums_layout_hash_fraction($seed . '-a-' . $shrinkPass . '-' . $attempt) * 2.0 * M_PI);
            $dx = cos($angle) * $ring * $ringStep;
            $dy = sin($angle) * $ring * $ringStep;
            $test = $candidate;
            $test['w'] = $w;
            $test['h'] = $h;
            $test['x'] = catn8_photo_albums_layout_clamp($baseX + $dx, $minX, $maxX - $w);
            $test['y'] = catn8_photo_albums_layout_clamp($baseY + $dy, $minY, $maxY - $h);
            if ($fits($test)) {
                return $test;
            }
        }
        $minW = $item['kind'] === 'media' ? 9.5 : 10.5;
        $minH = $item['kind'] === 'media' ? 9.5 : 8.2;
        $w = max($minW, $w * 0.97);
        $h = max($minH, $h * 0.97);
        $candidate['w'] = $w;
        $candidate['h'] = $h;
        $candidate['x'] = catn8_photo_albums_layout_clamp($baseX, $minX, $maxX - $w);
        $candidate['y'] = catn8_photo_albums_layout_clamp($baseY, $minY, $maxY - $h);
        if ($fits($candidate)) {
            return $candidate;
        }
    }

    return $candidate;
}

function catn8_photo_albums_auto_layout_spread(array $spread, int $albumId, int $spreadIndex): array
{
    $images = is_array($spread['images'] ?? null) ? $spread['images'] : [];
    $textItems = is_array($spread['text_items'] ?? null) ? $spread['text_items'] : [];
    $noteLayout = is_array($spread['note_layout'] ?? null) ? $spread['note_layout'] : [];
    $items = [];
    $fallbackOrder = 0;

    foreach ($images as $mediaIndex => $image) {
        if (!is_array($image)) {
            continue;
        }
        $src = trim((string)($image['display_src'] ?? $image['src'] ?? ''));
        if ($src === '') {
            continue;
        }
        $caption = trim((string)($image['caption'] ?? $image['memory_text'] ?? ''));
        $capturedRaw = trim((string)($image['captured_at'] ?? ''));
        $capturedTs = $capturedRaw !== '' ? strtotime($capturedRaw) : false;
        $orderKey = ($capturedTs !== false) ? ((int)$capturedTs * 1000) : (900000000000 + $fallbackOrder);
        $fallbackOrder += 1;
        $items[] = [
            'kind' => 'media',
            'media_index' => (int)$mediaIndex,
            'note_id' => '',
            'text' => $caption,
            'order_key' => $orderKey,
        ];

        $captionLines = catn8_photo_albums_split_lines($caption);
        foreach ($captionLines as $lineIndex => $line) {
            if (!catn8_photo_albums_is_message_like_line($line)) {
                continue;
            }
            $noteOrder = $orderKey + (($lineIndex + 1) * 60);
            $items[] = [
                'kind' => 'note',
                'media_index' => -1,
                'note_id' => 'media-note-' . ((int)$mediaIndex) . '-' . ((int)$lineIndex),
                'text' => $line,
                'order_key' => $noteOrder,
            ];
        }
    }

    foreach ($textItems as $textIndex => $textItem) {
        if (!is_array($textItem)) {
            continue;
        }
        $noteId = trim((string)($textItem['id'] ?? ''));
        if ($noteId === '') {
            $noteId = 'text-' . ((int)$textIndex);
        }
        $text = trim((string)($textItem['text'] ?? ''));
        if ($text === '') {
            continue;
        }
        $timeMinutes = catn8_photo_albums_layout_parse_clock_to_minutes((string)($textItem['time'] ?? ''));
        $orderKey = $timeMinutes !== null ? (500000000000 + ($timeMinutes * 60) + $textIndex) : (910000000000 + $fallbackOrder);
        $fallbackOrder += 1;
        $items[] = [
            'kind' => 'note',
            'media_index' => -1,
            'note_id' => $noteId,
            'text' => $text,
            'order_key' => $orderKey,
        ];
    }

    $spreadCaptionLines = catn8_photo_albums_split_lines((string)($spread['caption'] ?? ''));
    foreach ($spreadCaptionLines as $lineIndex => $line) {
        if (!catn8_photo_albums_is_message_like_line($line)) {
            continue;
        }
        $items[] = [
            'kind' => 'note',
            'media_index' => -1,
            'note_id' => 'spread-note-' . ((int)$lineIndex),
            'text' => $line,
            'order_key' => 920000000000 + $fallbackOrder + $lineIndex,
        ];
    }

    usort($items, static function (array $a, array $b): int {
        $ak = (int)($a['order_key'] ?? 0);
        $bk = (int)($b['order_key'] ?? 0);
        if ($ak !== $bk) {
            return $ak < $bk ? -1 : 1;
        }
        return strcmp((string)($a['kind'] ?? ''), (string)($b['kind'] ?? ''));
    });

    $count = max(1, count($items));
    $density = $count;
    $baseMediaW = $density <= 2 ? 42.0 : ($density <= 4 ? 30.0 : ($density <= 8 ? 21.0 : ($density >= 14 ? 12.0 : 15.0)));
    $baseNoteW = $density <= 2 ? 38.0 : ($density <= 4 ? 27.0 : ($density <= 8 ? 19.0 : ($density >= 14 ? 11.0 : 14.0)));

    $minimumItems = [];
    $totalMinArea = 0.0;
    foreach ($items as $idx => $item) {
        $seed = $albumId . '-' . $spreadIndex . '-' . $idx . '-' . (string)($item['kind'] ?? 'item');
        $variation = 0.84 + (catn8_photo_albums_layout_hash_fraction($seed) * 0.34);
        if ($item['kind'] === 'media') {
            $w = catn8_photo_albums_layout_clamp($baseMediaW * $variation, 9.5, 40.0);
            $h = catn8_photo_albums_layout_estimate_media_height((string)($item['text'] ?? ''), $w);
        } else {
            $w = catn8_photo_albums_layout_clamp($baseNoteW * $variation, 10.5, 44.0);
            $h = catn8_photo_albums_layout_estimate_note_height((string)($item['text'] ?? ''), $w);
        }
        $entry = $item;
        $entry['w'] = $w;
        $entry['h'] = $h;
        $minimumItems[] = $entry;
        $totalMinArea += ($w * $h);
    }

    $reservedRects = [
        ['x' => 2.0, 'y' => 4.0, 'w' => 23.0, 'h' => 16.0],   // page tag + date card area
        ['x' => 92.0, 'y' => 4.0, 'w' => 6.0, 'h' => 9.0],    // favorite button area
    ];
    $canvasArea = (98.0 - 2.0) * (94.0 - 4.0);
    $reservedArea = 0.0;
    foreach ($reservedRects as $reserved) {
        $reservedArea += max(0.0, ((float)$reserved['w']) * ((float)$reserved['h']));
    }
    $usableArea = max(1.0, $canvasArea - $reservedArea);
    $targetCoverage = 0.78;
    $targetArea = $usableArea * $targetCoverage;
    $scale = $totalMinArea > 0 ? sqrt($targetArea / $totalMinArea) : 1.0;
    $scale = catn8_photo_albums_layout_clamp($scale, 0.92, 2.2);

    $placed = [];
    $placedItems = [];
    foreach ($minimumItems as $index => $item) {
        $w = catn8_photo_albums_layout_clamp(((float)$item['w']) * $scale, $item['kind'] === 'media' ? 9.5 : 10.5, 52.0);
        $hBase = $item['kind'] === 'media'
            ? catn8_photo_albums_layout_estimate_media_height((string)($item['text'] ?? ''), $w)
            : catn8_photo_albums_layout_estimate_note_height((string)($item['text'] ?? ''), $w);
        $h = catn8_photo_albums_layout_clamp($hBase, $item['kind'] === 'media' ? 10.0 : 8.2, 72.0);
        $progress = ($count <= 1) ? 0.5 : ($index / ($count - 1));
        $preferredY = 6.0 + ($progress * 82.0) + ((catn8_photo_albums_layout_hash_fraction('y-' . $albumId . '-' . $spreadIndex . '-' . $index) - 0.5) * 4.0);
        $preferredX = 6.0 + (catn8_photo_albums_layout_hash_fraction('x-' . $albumId . '-' . $spreadIndex . '-' . $index) * 86.0);
        $rotation = (((catn8_photo_albums_layout_hash_fraction('r-' . $albumId . '-' . $spreadIndex . '-' . $index) * 13.0) - 6.0));

        $placeRequest = [
            'kind' => (string)$item['kind'],
            'w' => $w,
            'h' => $h,
            'preferred_x' => $preferredX,
            'preferred_y' => $preferredY,
            'rotation' => $rotation,
        ];
        $placedItem = catn8_photo_albums_layout_place_item($placeRequest, $placed, (string)($albumId . '-' . $spreadIndex . '-' . $index), $reservedRects);
        $placed[] = $placedItem;
        $item['x'] = $placedItem['x'];
        $item['y'] = $placedItem['y'];
        $item['w'] = $placedItem['w'];
        $item['h'] = $placedItem['h'];
        $item['rotation'] = $rotation;
        $placedItems[] = $item;
    }

    foreach ($placedItems as $item) {
        if (($item['kind'] ?? '') === 'media') {
            $mediaIndex = (int)($item['media_index'] ?? -1);
            if ($mediaIndex >= 0 && isset($images[$mediaIndex]) && is_array($images[$mediaIndex])) {
                $images[$mediaIndex]['x'] = (float)$item['x'];
                $images[$mediaIndex]['y'] = (float)$item['y'];
                $images[$mediaIndex]['w'] = (float)$item['w'];
                $images[$mediaIndex]['h'] = (float)$item['h'];
                $images[$mediaIndex]['rotation'] = (float)$item['rotation'];
            }
            continue;
        }
        $noteId = trim((string)($item['note_id'] ?? ''));
        if ($noteId === '') {
            continue;
        }
        $noteLayout[$noteId] = [
            'x' => (float)$item['x'],
            'y' => (float)$item['y'],
            'w' => (float)$item['w'],
            'h' => (float)$item['h'],
            'rotation' => (float)$item['rotation'],
        ];
    }

    foreach ($textItems as $textIndex => $textItem) {
        if (!is_array($textItem)) {
            continue;
        }
        $noteId = trim((string)($textItem['id'] ?? ''));
        if ($noteId === '') {
            $noteId = 'text-' . ((int)$textIndex);
        }
        $layout = is_array($noteLayout[$noteId] ?? null) ? $noteLayout[$noteId] : null;
        if ($layout === null) {
            continue;
        }
        $textItems[$textIndex]['x'] = (float)($layout['x'] ?? 0.0);
        $textItems[$textIndex]['y'] = (float)($layout['y'] ?? 0.0);
        $textItems[$textIndex]['w'] = (float)($layout['w'] ?? 0.0);
        $textItems[$textIndex]['h'] = (float)($layout['h'] ?? 0.0);
        $textItems[$textIndex]['rotation'] = (float)($layout['rotation'] ?? 0.0);
    }

    $spread['images'] = $images;
    $spread['text_items'] = $textItems;
    $spread['note_layout'] = $noteLayout;
    return $spread;
}

function catn8_photo_albums_pid_running(int $pid): bool
{
    if ($pid <= 0) {
        return false;
    }
    if (function_exists('posix_kill')) {
        return @posix_kill($pid, 0);
    }
    if (!function_exists('shell_exec')) {
        return false;
    }
    $out = shell_exec('ps -p ' . (int)$pid . ' -o pid= 2>/dev/null');
    return is_string($out) && trim($out) !== '';
}

function catn8_photo_albums_tail_file(string $path, int $maxBytes = 3000): string
{
    if ($path === '' || !is_file($path)) {
        return '';
    }
    $size = @filesize($path);
    if (!is_int($size) || $size <= 0) {
        return '';
    }
    $readLen = max(1, min($maxBytes, $size));
    $fh = @fopen($path, 'rb');
    if (!is_resource($fh)) {
        return '';
    }
    if ($size > $readLen) {
        @fseek($fh, -$readLen, SEEK_END);
    }
    $data = @fread($fh, $readLen);
    @fclose($fh);
    if (!is_string($data)) {
        return '';
    }
    return trim($data);
}

function catn8_photo_albums_start_capture_messages_import(): array
{
    $repoRoot = dirname(__DIR__);
    $cwd = (string)(getcwd() ?: '');
    $scriptCandidates = [
        $repoRoot . '/scripts/import_photos.sh',
        __DIR__ . '/../scripts/import_photos.sh',
        ($cwd !== '' ? $cwd . '/scripts/import_photos.sh' : ''),
    ];
    $scriptPath = '';
    foreach ($scriptCandidates as $candidate) {
        $safeCandidate = trim((string)$candidate);
        if ($safeCandidate === '') {
            continue;
        }
        if (is_file($safeCandidate)) {
            $scriptPath = $safeCandidate;
            break;
        }
    }
    if ($scriptPath === '') {
        $checked = array_values(array_filter(array_map(static fn ($p) => trim((string)$p), $scriptCandidates), static fn ($p) => $p !== ''));
        throw new RuntimeException('Import script not found. Checked: ' . implode(', ', $checked));
    }
    $repoRoot = dirname($scriptPath, 2);
    if (!is_executable($scriptPath)) {
        @chmod($scriptPath, 0755);
    }

    $stateDir = $repoRoot . '/.local/state';
    if (!is_dir($stateDir) && !@mkdir($stateDir, 0775, true) && !is_dir($stateDir)) {
        throw new RuntimeException('Failed to create state directory');
    }
    $pidPath = $stateDir . '/import_photos.pid';
    $logPath = $stateDir . '/import_photos_web.log';

    if (is_file($pidPath)) {
        $existingRaw = @file_get_contents($pidPath);
        $existing = json_decode(is_string($existingRaw) ? $existingRaw : '', true);
        $existingPid = (int)($existing['pid'] ?? 0);
        if ($existingPid > 0 && catn8_photo_albums_pid_running($existingPid)) {
            return [
                'started' => false,
                'already_running' => true,
                'pid' => $existingPid,
                'log_file' => '.local/state/import_photos_web.log',
            ];
        }
        @unlink($pidPath);
    }

    if (!function_exists('shell_exec')) {
        throw new RuntimeException('shell_exec is unavailable on this server');
    }

    $cmd = sprintf(
        'cd %s && nohup bash %s >> %s 2>&1 & echo $!',
        escapeshellarg($repoRoot),
        escapeshellarg($scriptPath),
        escapeshellarg($logPath)
    );
    $pidRaw = shell_exec($cmd);
    $pid = (int)trim((string)$pidRaw);
    if ($pid <= 0) {
        throw new RuntimeException('Failed to start import process');
    }

    $payload = [
        'pid' => $pid,
        'started_at' => gmdate('Y-m-d H:i:s'),
        'script' => 'scripts/import_photos.sh',
        'log_file' => '.local/state/import_photos_web.log',
    ];
    @file_put_contents($pidPath, json_encode($payload, JSON_UNESCAPED_SLASHES));

    usleep(350000);
    if (!catn8_photo_albums_pid_running($pid)) {
        @unlink($pidPath);
        $tail = catn8_photo_albums_tail_file($logPath);
        $suffix = $tail !== '' ? (' | log_tail=' . str_replace(["\r", "\n"], ' ', $tail)) : '';
        throw new RuntimeException('Import process exited immediately' . $suffix);
    }

    return [
        'started' => true,
        'already_running' => false,
        'pid' => $pid,
        'log_file' => '.local/state/import_photos_web.log',
    ];
}

catn8_groups_seed_core();
catn8_photo_albums_table_ensure();
catn8_photo_album_page_favorites_table_ensure();
catn8_photo_album_media_favorites_table_ensure();
catn8_photo_album_text_favorites_table_ensure();

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$action = strtolower(trim((string)($_GET['action'] ?? 'list')));

$viewerId = catn8_require_group_or_admin('photo-albums-users');
$viewerPayload = catn8_photo_albums_get_viewer($viewerId);

if ($method === 'GET') {
    if ($action === 'list') {
        $isAdminViewer = (int)($viewerPayload['is_admin'] ?? 0) === 1;
        $sql = 'SELECT id, title, slug, summary, cover_image_url, cover_prompt, spec_json, is_active, is_locked, created_by_user_id, (SELECT username FROM users WHERE id = created_by_user_id LIMIT 1) AS created_by_username, created_at, updated_at
                FROM photo_albums';
        if (!$isAdminViewer) {
            $sql .= ' WHERE is_active = 1';
        }
        $sql .= ' ORDER BY updated_at DESC, id DESC LIMIT 300';
        $rows = Database::queryAll($sql);

        $albums = array_map('catn8_photo_albums_row_to_payload', $rows);
        $favorites = catn8_photo_albums_favorites_payload($viewerId);
        $virtualAlbums = catn8_photo_albums_build_virtual_favorites($albums, $favorites);
        catn8_json_response(['success' => true, 'viewer' => $viewerPayload, 'albums' => array_merge($virtualAlbums, $albums), 'favorites' => $favorites]);
    }

    if ($action === 'get') {
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) {
            catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
        }

        $row = Database::queryOne(
            'SELECT id, title, slug, summary, cover_image_url, cover_prompt, spec_json, is_active, is_locked, created_by_user_id, (SELECT username FROM users WHERE id = created_by_user_id LIMIT 1) AS created_by_username, created_at, updated_at
             FROM photo_albums
             WHERE id = ?
             LIMIT 1',
            [$id]
        );

        if (!$row) {
            catn8_json_response(['success' => false, 'error' => 'Album not found'], 404);
        }
        $isAdminViewer = (int)($viewerPayload['is_admin'] ?? 0) === 1;
        if (!$isAdminViewer && (int)($row['is_active'] ?? 0) !== 1) {
            catn8_json_response(['success' => false, 'error' => 'Album not found'], 404);
        }

        catn8_json_response([
            'success' => true,
            'viewer' => $viewerPayload,
            'album' => catn8_photo_albums_row_to_payload($row),
        ]);
    }

    catn8_json_response(['success' => false, 'error' => 'Unsupported action'], 400);
}

if ($method !== 'POST') {
    catn8_json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

catn8_photo_albums_require_json_request();
$body = catn8_read_json_body();

if ($action === 'capture_new_messages') {
    if ((int)($viewerPayload['is_admin'] ?? 0) !== 1) {
        catn8_json_response(['success' => false, 'error' => 'Admin access required'], 403);
    }
    if (!catn8_is_local_request()) {
        catn8_json_response([
            'success' => false,
            'error' => 'Capture New Messages is local-only. Open Photo Albums on your local site (http://localhost:8888) to run scripts/import_photos.sh on your computer.',
        ], 400);
    }
    try {
        $run = catn8_photo_albums_start_capture_messages_import();
    } catch (Throwable $e) {
        error_log('[photo_albums:capture_new_messages] start_error=' . $e->getMessage());
        catn8_json_response(['success' => false, 'error' => 'Failed to start import process: ' . $e->getMessage()], 500);
    }
    if (!empty($run['already_running'])) {
        catn8_json_response([
            'success' => false,
            'error' => 'Capture process is already running',
            'pid' => (int)($run['pid'] ?? 0),
            'log_file' => (string)($run['log_file'] ?? ''),
        ], 409);
    }
    catn8_json_response([
        'success' => true,
        'started' => true,
        'pid' => (int)($run['pid'] ?? 0),
        'log_file' => (string)($run['log_file'] ?? ''),
    ]);
}

if ($action === 'toggle_page_favorite') {
    $albumId = (int)($body['album_id'] ?? 0);
    $spreadIndex = (int)($body['spread_index'] ?? -1);
    $isFavorite = (int)($body['is_favorite'] ?? 0) === 1;

    if ($albumId <= 0 || $spreadIndex < 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid album_id or spread_index'], 400);
    }

    $albumRow = Database::queryOne('SELECT id, spec_json, is_active, is_locked FROM photo_albums WHERE id = ? LIMIT 1', [$albumId]);
    if (!$albumRow) {
        catn8_json_response(['success' => false, 'error' => 'Album not found'], 404);
    }
    $isAdminViewer = (int)($viewerPayload['is_admin'] ?? 0) === 1;
    if (!$isAdminViewer && (int)($albumRow['is_active'] ?? 0) !== 1) {
        catn8_json_response(['success' => false, 'error' => 'Album not found'], 404);
    }
    if ((int)($albumRow['is_locked'] ?? 0) === 1) {
        catn8_json_response(['success' => false, 'error' => 'Album is locked'], 423);
    }

    $spec = catn8_photo_albums_parse_spec((string)($albumRow['spec_json'] ?? '{}'), '');
    $spreads = is_array($spec['spreads'] ?? null) ? $spec['spreads'] : [];
    if (!isset($spreads[$spreadIndex])) {
        catn8_json_response(['success' => false, 'error' => 'Spread not found'], 404);
    }

    if ($isFavorite) {
        Database::execute(
            'INSERT INTO photo_album_page_favorites (user_id, album_id, spread_index) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE created_at = created_at',
            [$viewerId, $albumId, $spreadIndex]
        );
    } else {
        Database::execute(
            'DELETE FROM photo_album_page_favorites WHERE user_id = ? AND album_id = ? AND spread_index = ?',
            [$viewerId, $albumId, $spreadIndex]
        );
    }

    catn8_json_response(['success' => true, 'favorites' => catn8_photo_albums_favorites_payload($viewerId)]);
}

if ($action === 'toggle_media_favorite') {
    $albumId = (int)($body['album_id'] ?? 0);
    $spreadIndex = (int)($body['spread_index'] ?? -1);
    $mediaSourceIndex = (int)($body['media_source_index'] ?? -1);
    $isFavorite = (int)($body['is_favorite'] ?? 0) === 1;

    if ($albumId <= 0 || $spreadIndex < 0 || $mediaSourceIndex < 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid favorite media payload'], 400);
    }

    $albumRow = Database::queryOne('SELECT id, spec_json, is_active, is_locked FROM photo_albums WHERE id = ? LIMIT 1', [$albumId]);
    if (!$albumRow) {
        catn8_json_response(['success' => false, 'error' => 'Album not found'], 404);
    }
    $isAdminViewer = (int)($viewerPayload['is_admin'] ?? 0) === 1;
    if (!$isAdminViewer && (int)($albumRow['is_active'] ?? 0) !== 1) {
        catn8_json_response(['success' => false, 'error' => 'Album not found'], 404);
    }
    if ((int)($albumRow['is_locked'] ?? 0) === 1) {
        catn8_json_response(['success' => false, 'error' => 'Album is locked'], 423);
    }

    $spec = catn8_photo_albums_parse_spec((string)($albumRow['spec_json'] ?? '{}'), '');
    $spreads = is_array($spec['spreads'] ?? null) ? $spec['spreads'] : [];
    $spread = $spreads[$spreadIndex] ?? null;
    $images = is_array($spread['images'] ?? null) ? $spread['images'] : [];
    if (!isset($images[$mediaSourceIndex])) {
        catn8_json_response(['success' => false, 'error' => 'Media not found'], 404);
    }

    if ($isFavorite) {
        Database::execute(
            'INSERT INTO photo_album_media_favorites (user_id, album_id, spread_index, media_source_index) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE created_at = created_at',
            [$viewerId, $albumId, $spreadIndex, $mediaSourceIndex]
        );
    } else {
        Database::execute(
            'DELETE FROM photo_album_media_favorites
              WHERE user_id = ? AND album_id = ? AND spread_index = ? AND media_source_index = ?',
            [$viewerId, $albumId, $spreadIndex, $mediaSourceIndex]
        );
    }

    catn8_json_response(['success' => true, 'favorites' => catn8_photo_albums_favorites_payload($viewerId)]);
}

if ($action === 'toggle_text_favorite') {
    $albumId = (int)($body['album_id'] ?? 0);
    $spreadIndex = (int)($body['spread_index'] ?? -1);
    $textItemId = trim((string)($body['text_item_id'] ?? ''));
    $isFavorite = (int)($body['is_favorite'] ?? 0) === 1;

    if ($albumId <= 0 || $spreadIndex < 0 || $textItemId === '') {
        catn8_json_response(['success' => false, 'error' => 'Invalid favorite text payload'], 400);
    }
    if (strlen($textItemId) > 191) {
        catn8_json_response(['success' => false, 'error' => 'Invalid text_item_id'], 400);
    }

    $albumRow = Database::queryOne('SELECT id, spec_json, is_active, is_locked FROM photo_albums WHERE id = ? LIMIT 1', [$albumId]);
    if (!$albumRow) {
        catn8_json_response(['success' => false, 'error' => 'Album not found'], 404);
    }
    $isAdminViewer = (int)($viewerPayload['is_admin'] ?? 0) === 1;
    if (!$isAdminViewer && (int)($albumRow['is_active'] ?? 0) !== 1) {
        catn8_json_response(['success' => false, 'error' => 'Album not found'], 404);
    }
    if ((int)($albumRow['is_locked'] ?? 0) === 1) {
        catn8_json_response(['success' => false, 'error' => 'Album is locked'], 423);
    }

    $spec = catn8_photo_albums_parse_spec((string)($albumRow['spec_json'] ?? '{}'), '');
    $spreads = is_array($spec['spreads'] ?? null) ? $spec['spreads'] : [];
    $spread = $spreads[$spreadIndex] ?? null;
    if (!is_array($spread)) {
        catn8_json_response(['success' => false, 'error' => 'Spread not found'], 404);
    }
    $availableNoteIds = catn8_photo_albums_note_ids_for_spread($spread);
    if (!in_array($textItemId, $availableNoteIds, true)) {
        catn8_json_response(['success' => false, 'error' => 'Text item not found'], 404);
    }

    if ($isFavorite) {
        Database::execute(
            'INSERT INTO photo_album_text_favorites (user_id, album_id, spread_index, text_item_id) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE created_at = created_at',
            [$viewerId, $albumId, $spreadIndex, $textItemId]
        );
    } else {
        Database::execute(
            'DELETE FROM photo_album_text_favorites
              WHERE user_id = ? AND album_id = ? AND spread_index = ? AND text_item_id = ?',
            [$viewerId, $albumId, $spreadIndex, $textItemId]
        );
    }

    catn8_json_response(['success' => true, 'favorites' => catn8_photo_albums_favorites_payload($viewerId)]);
}

catn8_require_admin();

if ($action === 'create') {
    $title = catn8_photo_albums_clean_text((string)($body['title'] ?? ''), 191);
    $summary = catn8_photo_albums_clean_text((string)($body['summary'] ?? ''), 1500);
    $coverImageUrl = trim((string)($body['cover_image_url'] ?? ''));
    $coverPrompt = catn8_photo_albums_clean_text((string)($body['cover_prompt'] ?? ''), 3000);
    $spec = $body['spec'] ?? null;

    if ($title === '') {
        catn8_json_response(['success' => false, 'error' => 'Title is required'], 400);
    }
    if (!is_array($spec)) {
        catn8_json_response(['success' => false, 'error' => 'spec is required'], 400);
    }

    $isActive = (int)($body['is_active'] ?? 1) === 1 ? 1 : 0;
    $baseSlug = catn8_photo_albums_slug($title);
    if ($baseSlug === '') {
        $baseSlug = 'album';
    }

    $slug = $baseSlug;
    $seq = 2;
    while (Database::queryOne('SELECT id FROM photo_albums WHERE slug = ? LIMIT 1', [$slug])) {
        $slug = substr($baseSlug, 0, 110) . '-' . $seq;
        $seq++;
    }

    $specJson = json_encode($spec, JSON_UNESCAPED_SLASHES);
    if (!is_string($specJson) || $specJson === '') {
        catn8_json_response(['success' => false, 'error' => 'Invalid spec payload'], 400);
    }

    Database::execute(
        'INSERT INTO photo_albums (title, slug, summary, cover_image_url, cover_prompt, spec_json, is_active, is_locked, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)',
        [$title, $slug, $summary, $coverImageUrl, $coverPrompt, $specJson, $isActive, $viewerId]
    );

    $newId = (int)Database::lastInsertId();
    $row = Database::queryOne(
        'SELECT id, title, slug, summary, cover_image_url, cover_prompt, spec_json, is_active, is_locked, created_by_user_id, (SELECT username FROM users WHERE id = created_by_user_id LIMIT 1) AS created_by_username, created_at, updated_at
         FROM photo_albums
         WHERE id = ?
         LIMIT 1',
        [$newId]
    );

    catn8_json_response(['success' => true, 'album' => catn8_photo_albums_row_to_payload($row ?: [])]);
}

if ($action === 'update') {
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    $existing = Database::queryOne('SELECT id, title, spec_json, is_locked FROM photo_albums WHERE id = ? LIMIT 1', [$id]);
    if (!$existing) {
        catn8_json_response(['success' => false, 'error' => 'Album not found'], 404);
    }
    if ((int)($existing['is_locked'] ?? 0) === 1) {
        catn8_json_response(['success' => false, 'error' => 'Album is locked'], 423);
    }

    $title = catn8_photo_albums_clean_text((string)($body['title'] ?? ''), 191);
    $summary = catn8_photo_albums_clean_text((string)($body['summary'] ?? ''), 1500);
    $coverImageUrl = trim((string)($body['cover_image_url'] ?? ''));
    $coverPrompt = catn8_photo_albums_clean_text((string)($body['cover_prompt'] ?? ''), 3000);
    $spec = $body['spec'] ?? null;

    if ($title === '' || !is_array($spec)) {
        catn8_json_response(['success' => false, 'error' => 'Title and spec are required'], 400);
    }
    $existingSpec = catn8_photo_albums_parse_spec((string)($existing['spec_json'] ?? '{}'), (string)($existing['title'] ?? ''));
    $spec = catn8_photo_albums_merge_locked_spreads($existingSpec, $spec);

    $isActive = (int)($body['is_active'] ?? 1) === 1 ? 1 : 0;
    $specJson = json_encode($spec, JSON_UNESCAPED_SLASHES);
    if (!is_string($specJson) || $specJson === '') {
        catn8_json_response(['success' => false, 'error' => 'Invalid spec payload'], 400);
    }

    Database::execute(
        'UPDATE photo_albums
         SET title = ?, summary = ?, cover_image_url = ?, cover_prompt = ?, spec_json = ?, is_active = ?
         WHERE id = ?',
        [$title, $summary, $coverImageUrl, $coverPrompt, $specJson, $isActive, $id]
    );

    $row = Database::queryOne(
        'SELECT id, title, slug, summary, cover_image_url, cover_prompt, spec_json, is_active, is_locked, created_by_user_id, (SELECT username FROM users WHERE id = created_by_user_id LIMIT 1) AS created_by_username, created_at, updated_at
         FROM photo_albums
         WHERE id = ?
         LIMIT 1',
        [$id]
    );

    catn8_json_response(['success' => true, 'album' => catn8_photo_albums_row_to_payload($row ?: [])]);
}

if ($action === 'auto_layout') {
    if ((int)($viewerPayload['is_admin'] ?? 0) !== 1) {
        catn8_json_response(['success' => false, 'error' => 'Admin access required'], 403);
    }
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    $row = Database::queryOne(
        'SELECT id, title, slug, summary, cover_image_url, cover_prompt, spec_json, is_active, is_locked, created_by_user_id, (SELECT username FROM users WHERE id = created_by_user_id LIMIT 1) AS created_by_username, created_at, updated_at
         FROM photo_albums
         WHERE id = ?
         LIMIT 1',
        [$id]
    );
    if (!$row) {
        catn8_json_response(['success' => false, 'error' => 'Album not found'], 404);
    }
    if ((int)($row['is_locked'] ?? 0) === 1) {
        catn8_json_response(['success' => false, 'error' => 'Album is locked'], 423);
    }

    $spec = catn8_photo_albums_parse_spec((string)($row['spec_json'] ?? '{}'), (string)($row['title'] ?? ''));
    $spreads = is_array($spec['spreads'] ?? null) ? $spec['spreads'] : [];
    foreach ($spreads as $spreadIndex => $spread) {
        if (!is_array($spread) || catn8_photo_albums_spread_is_locked($spread)) {
            continue;
        }
        $spreads[$spreadIndex] = catn8_photo_albums_auto_layout_spread($spread, $id, (int)$spreadIndex);
    }
    $spec['spreads'] = array_values($spreads);
    $specJson = json_encode($spec, JSON_UNESCAPED_SLASHES);
    if (!is_string($specJson) || $specJson === '') {
        catn8_json_response(['success' => false, 'error' => 'Failed to encode album spec'], 500);
    }

    Database::execute('UPDATE photo_albums SET spec_json = ? WHERE id = ?', [$specJson, $id]);

    $updated = Database::queryOne(
        'SELECT id, title, slug, summary, cover_image_url, cover_prompt, spec_json, is_active, is_locked, created_by_user_id, (SELECT username FROM users WHERE id = created_by_user_id LIMIT 1) AS created_by_username, created_at, updated_at
         FROM photo_albums
         WHERE id = ?
         LIMIT 1',
        [$id]
    );
    catn8_json_response(['success' => true, 'album' => catn8_photo_albums_row_to_payload($updated ?: [])]);
}

if ($action === 'auto_layout_spread') {
    if ((int)($viewerPayload['is_admin'] ?? 0) !== 1) {
        catn8_json_response(['success' => false, 'error' => 'Admin access required'], 403);
    }
    $id = (int)($body['id'] ?? 0);
    $spreadIndex = (int)($body['spread_index'] ?? -1);
    if ($id <= 0 || $spreadIndex < 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id or spread_index'], 400);
    }

    $row = Database::queryOne(
        'SELECT id, title, slug, summary, cover_image_url, cover_prompt, spec_json, is_active, is_locked, created_by_user_id, (SELECT username FROM users WHERE id = created_by_user_id LIMIT 1) AS created_by_username, created_at, updated_at
         FROM photo_albums
         WHERE id = ?
         LIMIT 1',
        [$id]
    );
    if (!$row) {
        catn8_json_response(['success' => false, 'error' => 'Album not found'], 404);
    }
    if ((int)($row['is_locked'] ?? 0) === 1) {
        catn8_json_response(['success' => false, 'error' => 'Album is locked'], 423);
    }
    $spec = catn8_photo_albums_parse_spec((string)($row['spec_json'] ?? '{}'), (string)($row['title'] ?? ''));
    $spreads = is_array($spec['spreads'] ?? null) ? $spec['spreads'] : [];
    $spread = $spreads[$spreadIndex] ?? null;
    if (!is_array($spread)) {
        catn8_json_response(['success' => false, 'error' => 'Spread not found'], 404);
    }
    if (catn8_photo_albums_spread_is_locked($spread)) {
        catn8_json_response(['success' => false, 'error' => 'Spread is locked'], 423);
    }
    $spreads[$spreadIndex] = catn8_photo_albums_auto_layout_spread($spread, $id, $spreadIndex);
    $spec['spreads'] = array_values($spreads);
    $specJson = json_encode($spec, JSON_UNESCAPED_SLASHES);
    if (!is_string($specJson) || $specJson === '') {
        catn8_json_response(['success' => false, 'error' => 'Failed to encode album spec'], 500);
    }
    Database::execute('UPDATE photo_albums SET spec_json = ? WHERE id = ?', [$specJson, $id]);
    $updated = Database::queryOne(
        'SELECT id, title, slug, summary, cover_image_url, cover_prompt, spec_json, is_active, is_locked, created_by_user_id, (SELECT username FROM users WHERE id = created_by_user_id LIMIT 1) AS created_by_username, created_at, updated_at
         FROM photo_albums
         WHERE id = ?
         LIMIT 1',
        [$id]
    );
    catn8_json_response(['success' => true, 'album' => catn8_photo_albums_row_to_payload($updated ?: [])]);
}

if ($action === 'auto_layout_all') {
    if ((int)($viewerPayload['is_admin'] ?? 0) !== 1) {
        catn8_json_response(['success' => false, 'error' => 'Admin access required'], 403);
    }
    if (function_exists('set_time_limit')) {
        @set_time_limit(120);
    }
    $startAfterId = max(0, (int)($body['start_after_id'] ?? 0));
    $batchSize = (int)($body['batch_size'] ?? 8);
    if ($batchSize < 1) {
        $batchSize = 1;
    } elseif ($batchSize > 20) {
        $batchSize = 20;
    }

    $updatedCount = 0;
    $failedCount = 0;
    $processedCount = 0;
    $nextStartAfterId = $startAfterId;
    $maxSpecChars = 1000000;

    try {
        $rows = Database::queryAll(
            'SELECT id, title, CHAR_LENGTH(spec_json) AS spec_chars
               FROM photo_albums
              WHERE is_locked = 0
                AND id > ?
              ORDER BY id ASC
              LIMIT ' . (int)$batchSize,
            [$startAfterId]
        );
    } catch (Throwable $e) {
        error_log('[photo_albums:auto_layout_all] fetch_error=' . $e->getMessage());
        catn8_json_response(['success' => false, 'error' => 'Auto layout failed while fetching albums'], 500);
    }

    foreach ($rows as $row) {
        $albumId = (int)($row['id'] ?? 0);
        if ($albumId <= 0) {
            continue;
        }
        $processedCount += 1;
        $nextStartAfterId = max($nextStartAfterId, $albumId);

        $specChars = (int)($row['spec_chars'] ?? 0);
        if ($specChars > $maxSpecChars) {
            $failedCount += 1;
            error_log('[photo_albums:auto_layout_all] album_id=' . $albumId . ' skipped_large_spec_chars=' . $specChars);
            continue;
        }

        try {
            $specRow = Database::queryOne(
                'SELECT title, spec_json
                   FROM photo_albums
                  WHERE id = ?
                  LIMIT 1',
                [$albumId]
            );
            $title = (string)($specRow['title'] ?? $row['title'] ?? '');
            $rawSpec = (string)($specRow['spec_json'] ?? '{}');
            $spec = catn8_photo_albums_parse_spec($rawSpec, $title);
            $spreads = is_array($spec['spreads'] ?? null) ? $spec['spreads'] : [];
            foreach ($spreads as $spreadIndex => $spread) {
                if (!is_array($spread) || catn8_photo_albums_spread_is_locked($spread)) {
                    continue;
                }
                $spreads[$spreadIndex] = catn8_photo_albums_auto_layout_spread($spread, $albumId, (int)$spreadIndex);
            }
            $spec['spreads'] = array_values($spreads);
            $specJson = json_encode($spec, JSON_UNESCAPED_SLASHES);
            if (!is_string($specJson) || $specJson === '') {
                $failedCount += 1;
                error_log('[photo_albums:auto_layout_all] Failed to encode album spec for album_id=' . $albumId);
                continue;
            }
            Database::execute('UPDATE photo_albums SET spec_json = ? WHERE id = ?', [$specJson, $albumId]);
            $updatedCount += 1;
        } catch (Throwable $e) {
            $failedCount += 1;
            error_log('[photo_albums:auto_layout_all] album_id=' . $albumId . ' error=' . $e->getMessage());
        }

        if (function_exists('set_time_limit')) {
            @set_time_limit(120);
        }
        if (function_exists('gc_collect_cycles')) {
            gc_collect_cycles();
        }
    }

    $hasMore = false;
    if ($processedCount > 0) {
        try {
            $moreRow = Database::queryOne(
                'SELECT id
                   FROM photo_albums
                  WHERE is_locked = 0
                    AND id > ?
                  LIMIT 1',
                [$nextStartAfterId]
            );
            $hasMore = is_array($moreRow) && (int)($moreRow['id'] ?? 0) > 0;
        } catch (Throwable $e) {
            error_log('[photo_albums:auto_layout_all] has_more_check_error=' . $e->getMessage());
            $hasMore = false;
        }
    }

    catn8_json_response([
        'success' => true,
        'updated_albums' => $updatedCount,
        'failed_albums' => $failedCount,
        'processed_albums' => $processedCount,
        'has_more' => $hasMore,
        'next_start_after_id' => $nextStartAfterId,
    ]);
}

if ($action === 'toggle_album_lock') {
    if ((int)($viewerPayload['is_admin'] ?? 0) !== 1) {
        catn8_json_response(['success' => false, 'error' => 'Admin access required'], 403);
    }
    $id = (int)($body['id'] ?? 0);
    $isLocked = (int)($body['is_locked'] ?? 0) === 1 ? 1 : 0;
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    $existing = Database::queryOne('SELECT id FROM photo_albums WHERE id = ? LIMIT 1', [$id]);
    if (!$existing) {
        catn8_json_response(['success' => false, 'error' => 'Album not found'], 404);
    }
    Database::execute('UPDATE photo_albums SET is_locked = ? WHERE id = ?', [$isLocked, $id]);
    $updated = Database::queryOne(
        'SELECT id, title, slug, summary, cover_image_url, cover_prompt, spec_json, is_active, is_locked, created_by_user_id, (SELECT username FROM users WHERE id = created_by_user_id LIMIT 1) AS created_by_username, created_at, updated_at
         FROM photo_albums
         WHERE id = ?
         LIMIT 1',
        [$id]
    );
    catn8_json_response(['success' => true, 'album' => catn8_photo_albums_row_to_payload($updated ?: [])]);
}

if ($action === 'toggle_spread_lock') {
    if ((int)($viewerPayload['is_admin'] ?? 0) !== 1) {
        catn8_json_response(['success' => false, 'error' => 'Admin access required'], 403);
    }
    $id = (int)($body['id'] ?? 0);
    $spreadIndex = (int)($body['spread_index'] ?? -1);
    $isLocked = (int)($body['is_locked'] ?? 0) === 1;
    if ($id <= 0 || $spreadIndex < 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id or spread_index'], 400);
    }
    $row = Database::queryOne(
        'SELECT id, title, spec_json, is_locked
         FROM photo_albums
         WHERE id = ?
         LIMIT 1',
        [$id]
    );
    if (!$row) {
        catn8_json_response(['success' => false, 'error' => 'Album not found'], 404);
    }
    if ((int)($row['is_locked'] ?? 0) === 1) {
        catn8_json_response(['success' => false, 'error' => 'Album is locked'], 423);
    }
    $spec = catn8_photo_albums_parse_spec((string)($row['spec_json'] ?? '{}'), (string)($row['title'] ?? ''));
    $spreads = is_array($spec['spreads'] ?? null) ? $spec['spreads'] : [];
    if (!isset($spreads[$spreadIndex]) || !is_array($spreads[$spreadIndex])) {
        catn8_json_response(['success' => false, 'error' => 'Spread not found'], 404);
    }
    $spreads[$spreadIndex]['is_locked'] = $isLocked ? 1 : 0;
    $spec['spreads'] = array_values($spreads);
    $specJson = json_encode($spec, JSON_UNESCAPED_SLASHES);
    if (!is_string($specJson) || $specJson === '') {
        catn8_json_response(['success' => false, 'error' => 'Failed to encode album spec'], 500);
    }
    Database::execute('UPDATE photo_albums SET spec_json = ? WHERE id = ?', [$specJson, $id]);
    $updated = Database::queryOne(
        'SELECT id, title, slug, summary, cover_image_url, cover_prompt, spec_json, is_active, is_locked, created_by_user_id, (SELECT username FROM users WHERE id = created_by_user_id LIMIT 1) AS created_by_username, created_at, updated_at
         FROM photo_albums
         WHERE id = ?
         LIMIT 1',
        [$id]
    );
    catn8_json_response(['success' => true, 'album' => catn8_photo_albums_row_to_payload($updated ?: [])]);
}

if ($action === 'delete') {
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    $row = Database::queryOne('SELECT id, is_locked FROM photo_albums WHERE id = ? LIMIT 1', [$id]);
    if (!$row) {
        catn8_json_response(['success' => false, 'error' => 'Album not found'], 404);
    }
    if ((int)($row['is_locked'] ?? 0) === 1) {
        catn8_json_response(['success' => false, 'error' => 'Album is locked'], 423);
    }

    Database::execute('DELETE FROM photo_albums WHERE id = ?', [$id]);
    catn8_json_response(['success' => true]);
}

if ($action === 'ai_generate_background') {
    $id = (int)($body['id'] ?? 0);
    $spreadIndex = (int)($body['spread_index'] ?? -1);
    $scope = strtolower(trim((string)($body['scope'] ?? 'page')));
    $customPrompt = catn8_photo_albums_clean_text((string)($body['prompt'] ?? ''), 2000);
    if ($id <= 0 || $spreadIndex < 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id or spread_index'], 400);
    }
    if ($scope !== 'page' && $scope !== 'album') {
        catn8_json_response(['success' => false, 'error' => 'Invalid scope'], 400);
    }

    $row = catn8_photo_albums_load_album_row_for_write($id);
    $spec = catn8_photo_albums_parse_spec((string)($row['spec_json'] ?? '{}'), (string)($row['title'] ?? ''));
    $spreads = is_array($spec['spreads'] ?? null) ? $spec['spreads'] : [];
    if (!isset($spreads[$spreadIndex]) || !is_array($spreads[$spreadIndex])) {
        catn8_json_response(['success' => false, 'error' => 'Spread not found'], 404);
    }

    $themeText = catn8_photo_albums_spread_theme_text($spreads[$spreadIndex]);
    $styleGuide = is_array($spec['style_guide'] ?? null) ? $spec['style_guide'] : [];
    $palette = implode(', ', catn8_photo_albums_as_list(is_array($styleGuide['palette'] ?? null) ? $styleGuide['palette'] : []));
    $materials = implode(', ', catn8_photo_albums_as_list(is_array($styleGuide['materials'] ?? null) ? $styleGuide['materials'] : []));
    $promptBase = implode("\n", [
        '[CATN8_SCRAPBOOK_BG_PROMPT_V1]',
        'Create a high-resolution scrapbook paper background image.',
        'No readable text, no logos, no watermarks, no people faces.',
        'Layered handmade paper texture with subtle depth and gentle vignette.',
        'Theme context: ' . $themeText,
        'Palette: ' . ($palette !== '' ? $palette : 'warm neutrals'),
        'Materials: ' . ($materials !== '' ? $materials : 'linen, cardstock, tape'),
        'Keep center area less busy for media and notes.',
        'Output one background image.',
    ]);
    $prompt = $customPrompt !== '' ? ($promptBase . "\nRequested adjustment: " . $customPrompt) : $promptBase;

    $img = catn8_photo_albums_generate_cover_b64($prompt);
    $bgDataUrl = 'data:image/png;base64,' . $img['b64'];

    if ($scope === 'album') {
        foreach ($spreads as $idx => $spread) {
            if (!is_array($spread) || catn8_photo_albums_spread_is_locked($spread)) {
                continue;
            }
            $spreads[$idx]['background_image_url'] = $bgDataUrl;
            $spreads[$idx]['background_prompt'] = $prompt;
        }
    } else {
        if (catn8_photo_albums_spread_is_locked($spreads[$spreadIndex])) {
            catn8_json_response(['success' => false, 'error' => 'Spread is locked'], 423);
        }
        $spreads[$spreadIndex]['background_image_url'] = $bgDataUrl;
        $spreads[$spreadIndex]['background_prompt'] = $prompt;
    }

    $spec['spreads'] = array_values($spreads);
    $album = catn8_photo_albums_save_spec_and_fetch($row, $spec);
    catn8_json_response([
        'success' => true,
        'album' => $album,
        'ai' => ['provider' => (string)($img['provider'] ?? ''), 'model' => (string)($img['model'] ?? ''), 'scope' => $scope],
    ]);
}

if ($action === 'ai_generate_clipart') {
    $id = (int)($body['id'] ?? 0);
    $spreadIndex = (int)($body['spread_index'] ?? -1);
    $customPrompt = catn8_photo_albums_clean_text((string)($body['prompt'] ?? ''), 1000);
    if ($id <= 0 || $spreadIndex < 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id or spread_index'], 400);
    }

    $row = catn8_photo_albums_load_album_row_for_write($id);
    $spec = catn8_photo_albums_parse_spec((string)($row['spec_json'] ?? '{}'), (string)($row['title'] ?? ''));
    $spreads = is_array($spec['spreads'] ?? null) ? $spec['spreads'] : [];
    $spread = $spreads[$spreadIndex] ?? null;
    if (!is_array($spread)) {
        catn8_json_response(['success' => false, 'error' => 'Spread not found'], 404);
    }
    if (catn8_photo_albums_spread_is_locked($spread)) {
        catn8_json_response(['success' => false, 'error' => 'Spread is locked'], 423);
    }

    $themeText = catn8_photo_albums_spread_theme_text($spread);
    $prompt = implode("\n", [
        '[CATN8_SCRAPBOOK_CLIPART_PROMPT_V1]',
        'Create a transparent-background scrapbook clipart sticker.',
        'Single subject, clean silhouette, playful handcrafted style.',
        'No text, no watermark.',
        'Theme context: ' . $themeText,
        ($customPrompt !== '' ? ('Requested subject: ' . $customPrompt) : 'Subject: memory-themed decorative sticker'),
        'Output one PNG-style artwork suitable for a small page accent.',
    ]);
    $img = catn8_photo_albums_generate_cover_b64($prompt);
    $src = 'data:image/png;base64,' . $img['b64'];

    if (!is_array($spread['images'] ?? null)) {
        $spread['images'] = [];
    }
    $nextIndex = count($spread['images']);
    $pos = catn8_photo_albums_position_slot($nextIndex + 3, 18);
    $spread['images'][] = [
        'src' => $src,
        'media_type' => 'image',
        'caption' => 'AI clipart',
        'memory_text' => '',
        'x' => $pos['x'],
        'y' => $pos['y'],
        'w' => 16,
    ];
    $spreads[$spreadIndex] = $spread;
    $spec['spreads'] = array_values($spreads);
    $album = catn8_photo_albums_save_spec_and_fetch($row, $spec);
    catn8_json_response([
        'success' => true,
        'album' => $album,
        'ai' => ['provider' => (string)($img['provider'] ?? ''), 'model' => (string)($img['model'] ?? '')],
    ]);
}

if ($action === 'ai_generate_accent_image') {
    $id = (int)($body['id'] ?? 0);
    $spreadIndex = (int)($body['spread_index'] ?? -1);
    $customPrompt = catn8_photo_albums_clean_text((string)($body['prompt'] ?? ''), 1000);
    if ($id <= 0 || $spreadIndex < 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id or spread_index'], 400);
    }

    $row = catn8_photo_albums_load_album_row_for_write($id);
    $spec = catn8_photo_albums_parse_spec((string)($row['spec_json'] ?? '{}'), (string)($row['title'] ?? ''));
    $spreads = is_array($spec['spreads'] ?? null) ? $spec['spreads'] : [];
    $spread = $spreads[$spreadIndex] ?? null;
    if (!is_array($spread)) {
        catn8_json_response(['success' => false, 'error' => 'Spread not found'], 404);
    }
    if (catn8_photo_albums_spread_is_locked($spread)) {
        catn8_json_response(['success' => false, 'error' => 'Spread is locked'], 423);
    }

    $themeText = catn8_photo_albums_spread_theme_text($spread);
    $prompt = implode("\n", [
        '[CATN8_SCRAPBOOK_ACCENT_PROMPT_V1]',
        'Create a subtle scrapbook accent image for background layering.',
        'No text, no logos, no watermark.',
        'Soft edges and low visual dominance.',
        'Theme context: ' . $themeText,
        ($customPrompt !== '' ? ('Requested accent concept: ' . $customPrompt) : 'Accent concept: tapes, florals, abstract paper marks'),
        'Output one image suitable as a small accent tile.',
    ]);
    $img = catn8_photo_albums_generate_cover_b64($prompt);
    $src = 'data:image/png;base64,' . $img['b64'];

    if (!is_array($spread['images'] ?? null)) {
        $spread['images'] = [];
    }
    $nextIndex = count($spread['images']);
    $pos = catn8_photo_albums_position_slot($nextIndex + 9, 28);
    $spread['images'][] = [
        'src' => $src,
        'media_type' => 'image',
        'caption' => 'AI accent',
        'memory_text' => '',
        'x' => $pos['x'],
        'y' => $pos['y'],
        'w' => 24,
    ];
    $spreads[$spreadIndex] = $spread;
    $spec['spreads'] = array_values($spreads);
    $album = catn8_photo_albums_save_spec_and_fetch($row, $spec);
    catn8_json_response([
        'success' => true,
        'album' => $album,
        'ai' => ['provider' => (string)($img['provider'] ?? ''), 'model' => (string)($img['model'] ?? '')],
    ]);
}

if ($action === 'ai_generate_cover_from_favorites') {
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    $row = catn8_photo_albums_load_album_row_for_write($id);
    $spec = catn8_photo_albums_parse_spec((string)($row['spec_json'] ?? '{}'), (string)($row['title'] ?? ''));
    $spreads = is_array($spec['spreads'] ?? null) ? $spec['spreads'] : [];

    $favoriteRows = Database::queryAll(
        'SELECT spread_index, media_source_index
           FROM photo_album_media_favorites
          WHERE album_id = ?
          ORDER BY created_at DESC
          LIMIT 24',
        [$id]
    );

    $themeLines = [];
    foreach ($favoriteRows as $fav) {
        $spreadIndex = (int)($fav['spread_index'] ?? -1);
        $mediaIndex = (int)($fav['media_source_index'] ?? -1);
        $spread = $spreads[$spreadIndex] ?? null;
        if (!is_array($spread)) {
            continue;
        }
        $images = is_array($spread['images'] ?? null) ? $spread['images'] : [];
        $image = $images[$mediaIndex] ?? null;
        if (!is_array($image)) {
            continue;
        }
        $caption = catn8_photo_albums_clean_text((string)($image['caption'] ?? ''), 160);
        $memory = catn8_photo_albums_clean_text((string)($image['memory_text'] ?? ''), 160);
        $fileHint = catn8_photo_albums_clean_text((string)($image['source_filename'] ?? ''), 120);
        $line = trim(implode(' | ', array_values(array_filter([$caption, $memory, $fileHint], static fn ($v) => $v !== ''))));
        if ($line !== '') {
            $themeLines[] = $line;
        }
    }

    if (count($themeLines) === 0) {
        foreach (array_slice($spreads, 0, 12) as $spread) {
            if (!is_array($spread)) {
                continue;
            }
            $themeLines[] = catn8_photo_albums_spread_theme_text($spread);
        }
    }
    $themeLines = array_slice(array_values(array_unique(array_filter($themeLines, static fn ($v) => trim((string)$v) !== ''))), 0, 14);

    $prompt = implode("\n", [
        '[CATN8_SCRAPBOOK_COVER_FROM_FAVORITES_V1]',
        'Create a representative scrapbook album cover.',
        'Use recurring themes inferred from favorited media metadata.',
        'No text baked into image; leave space for title overlay.',
        'Album title: ' . catn8_photo_albums_clean_text((string)($row['title'] ?? 'Photo Album'), 191),
        'Album summary: ' . catn8_photo_albums_clean_text((string)($row['summary'] ?? ''), 800),
        'Theme evidence:',
        implode("\n", array_map(static fn ($line) => '- ' . $line, $themeLines)),
        'Output one hero cover image.',
    ]);
    $coverPrompt = substr($prompt, 0, 3500);
    $img = catn8_photo_albums_generate_cover_b64($coverPrompt);
    $coverImageUrl = 'data:image/png;base64,' . $img['b64'];

    Database::execute('UPDATE photo_albums SET cover_image_url = ?, cover_prompt = ? WHERE id = ?', [$coverImageUrl, $coverPrompt, $id]);
    $updated = Database::queryOne(
        'SELECT id, title, slug, summary, cover_image_url, cover_prompt, spec_json, is_active, is_locked, created_by_user_id, (SELECT username FROM users WHERE id = created_by_user_id LIMIT 1) AS created_by_username, created_at, updated_at
         FROM photo_albums
         WHERE id = ?
         LIMIT 1',
        [$id]
    );
    catn8_json_response([
        'success' => true,
        'album' => catn8_photo_albums_row_to_payload($updated ?: []),
        'ai' => ['provider' => (string)($img['provider'] ?? ''), 'model' => (string)($img['model'] ?? '')],
    ]);
}

if ($action === 'ai_redesign_spread') {
    $id = (int)($body['id'] ?? 0);
    $spreadIndex = (int)($body['spread_index'] ?? -1);
    if ($id <= 0 || $spreadIndex < 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id or spread_index'], 400);
    }

    $row = catn8_photo_albums_load_album_row_for_write($id);
    $spec = catn8_photo_albums_parse_spec((string)($row['spec_json'] ?? '{}'), (string)($row['title'] ?? ''));
    $spreads = is_array($spec['spreads'] ?? null) ? $spec['spreads'] : [];
    $spread = $spreads[$spreadIndex] ?? null;
    if (!is_array($spread)) {
        catn8_json_response(['success' => false, 'error' => 'Spread not found'], 404);
    }
    if (catn8_photo_albums_spread_is_locked($spread)) {
        catn8_json_response(['success' => false, 'error' => 'Spread is locked'], 423);
    }

    $images = is_array($spread['images'] ?? null) ? $spread['images'] : [];
    $textItems = is_array($spread['text_items'] ?? null) ? $spread['text_items'] : [];
    $seedText = catn8_photo_albums_spread_theme_text($spread);
    $emojiPool = catn8_photo_albums_theme_emojis($seedText);

    $maxDecor = 8;
    $existingDecor = is_array($spread['decor_items'] ?? null) ? $spread['decor_items'] : [];
    $nextDecor = [];
    foreach (array_slice($existingDecor, 0, $maxDecor) as $idx => $decor) {
        if (!is_array($decor)) {
            continue;
        }
        $fallback = catn8_photo_albums_position_slot($idx + 2, 6);
        $nextDecor[] = [
            'id' => (string)($decor['id'] ?? ('decor-' . $spreadIndex . '-' . $idx)),
            'emoji' => catn8_photo_albums_clean_text((string)($decor['emoji'] ?? ($emojiPool[$idx % count($emojiPool)] ?? '✨')), 12),
            'x' => isset($decor['x']) ? (float)$decor['x'] : (float)$fallback['x'],
            'y' => isset($decor['y']) ? (float)$decor['y'] : (float)$fallback['y'],
            'size' => isset($decor['size']) ? (float)$decor['size'] : (1 + (($idx % 3) * 0.1)),
            'rotation' => isset($decor['rotation']) ? (float)$decor['rotation'] : (($idx % 2 === 0) ? -3 : 3),
        ];
    }
    $targetDecorCount = min($maxDecor, max(4, 2 + (int)ceil(count($images) / 2) + (int)ceil(count($textItems) / 2)));
    while (count($nextDecor) < $targetDecorCount) {
        $idx = count($nextDecor);
        $fallback = catn8_photo_albums_position_slot($idx + 11, 6);
        $nextDecor[] = [
            'id' => 'decor-auto-' . $spreadIndex . '-' . $idx . '-' . time(),
            'emoji' => $emojiPool[$idx % max(1, count($emojiPool))] ?? '✨',
            'x' => (float)$fallback['x'],
            'y' => (float)$fallback['y'],
            'size' => 0.95 + (($idx % 4) * 0.12),
            'rotation' => ($idx % 2 === 0) ? -4 : 4,
        ];
    }

    $spread['decor_items'] = $nextDecor;
    if (!is_array($spread['embellishments'] ?? null)) {
        $spread['embellishments'] = [];
    }
    $spread['embellishments'] = array_values(array_unique(array_slice(array_merge(
        catn8_photo_albums_as_list($spread['embellishments']),
        ['balanced-layout', 'ai-redesign']
    ), 0, 12)));
    $spread['background_prompt'] = catn8_photo_albums_clean_text(
        (string)($spread['background_prompt'] ?? 'Scrapbook background') . ' | AI redesign tuned for balanced composition',
        3000
    );

    $spreads[$spreadIndex] = $spread;
    $spec['spreads'] = array_values($spreads);
    $album = catn8_photo_albums_save_spec_and_fetch($row, $spec);
    catn8_json_response(['success' => true, 'album' => $album]);
}

if ($action === 'create_with_ai') {
    $title = catn8_photo_albums_clean_text((string)($body['title'] ?? ''), 191);
    $summary = catn8_photo_albums_clean_text((string)($body['summary'] ?? ''), 1500);
    if ($title === '') {
        catn8_json_response(['success' => false, 'error' => 'Title is required'], 400);
    }

    $memoryEra = catn8_photo_albums_clean_text((string)($body['memory_era'] ?? ''), 120);
    $mood = catn8_photo_albums_clean_text((string)($body['mood'] ?? ''), 120);
    $dominantPalette = catn8_photo_albums_clean_text((string)($body['dominant_palette'] ?? ''), 220);
    $materials = catn8_photo_albums_clean_text((string)($body['scrapbook_materials'] ?? ''), 220);
    $motifs = catn8_photo_albums_clean_text((string)($body['motif_keywords'] ?? ''), 220);
    $cameraStyle = catn8_photo_albums_clean_text((string)($body['camera_style'] ?? ''), 120);

    if ($memoryEra === '' || $mood === '' || $dominantPalette === '' || $materials === '' || $motifs === '') {
        catn8_json_response(['success' => false, 'error' => 'memory_era, mood, dominant_palette, scrapbook_materials, and motif_keywords are required'], 400);
    }

    $allowedAspectRatios = ['4:3', '3:2', '16:9', '1:1'];
    $aspectRatio = (string)($body['aspect_ratio'] ?? '4:3');
    if (!in_array($aspectRatio, $allowedAspectRatios, true)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid aspect_ratio'], 400);
    }

    $spreadCount = (int)($body['spread_count'] ?? 10);
    if ($spreadCount < 6 || $spreadCount > 30) {
        catn8_json_response(['success' => false, 'error' => 'spread_count must be between 6 and 30'], 400);
    }

    $allowedPageStyles = ['ribbon-tabs', 'classic-book', 'spiral-notebook'];
    $pageTurnStyle = (string)($body['page_turn_style'] ?? 'ribbon-tabs');
    if (!in_array($pageTurnStyle, $allowedPageStyles, true)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid page_turn_style'], 400);
    }

    $textureIntensity = catn8_photo_albums_clean_text((string)($body['texture_intensity'] ?? 'balanced'), 20);
    if (!in_array($textureIntensity, ['soft', 'balanced', 'rich'], true)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid texture_intensity'], 400);
    }

    $specInput = [
        'title' => $title,
        'summary' => $summary,
        'memory_era' => $memoryEra,
        'mood' => $mood,
        'dominant_palette' => $dominantPalette,
        'scrapbook_materials' => $materials,
        'motif_keywords' => $motifs,
        'camera_style' => $cameraStyle,
        'aspect_ratio' => $aspectRatio,
        'spread_count' => $spreadCount,
        'page_turn_style' => $pageTurnStyle,
        'texture_intensity' => $textureIntensity,
    ];

    $coverPrompt = catn8_photo_albums_build_ai_prompt($specInput);
    $img = catn8_photo_albums_generate_cover_b64($coverPrompt);

    $coverImageUrl = 'data:image/png;base64,' . $img['b64'];
    $spec = catn8_photo_albums_build_standard_spec($specInput);
    $specJson = json_encode($spec, JSON_UNESCAPED_SLASHES);
    if (!is_string($specJson) || $specJson === '') {
        catn8_json_response(['success' => false, 'error' => 'Failed to encode generated album spec'], 500);
    }

    $baseSlug = catn8_photo_albums_slug($title);
    if ($baseSlug === '') {
        $baseSlug = 'album';
    }

    $slug = $baseSlug;
    $seq = 2;
    while (Database::queryOne('SELECT id FROM photo_albums WHERE slug = ? LIMIT 1', [$slug])) {
        $slug = substr($baseSlug, 0, 110) . '-' . $seq;
        $seq++;
    }

    Database::execute(
        'INSERT INTO photo_albums (title, slug, summary, cover_image_url, cover_prompt, spec_json, is_active, is_locked, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?)',
        [$title, $slug, $summary, $coverImageUrl, $coverPrompt, $specJson, $viewerId]
    );

    $newId = (int)Database::lastInsertId();
    $row = Database::queryOne(
        'SELECT id, title, slug, summary, cover_image_url, cover_prompt, spec_json, is_active, is_locked, created_by_user_id, (SELECT username FROM users WHERE id = created_by_user_id LIMIT 1) AS created_by_username, created_at, updated_at
         FROM photo_albums
         WHERE id = ?
         LIMIT 1',
        [$newId]
    );

    catn8_json_response([
        'success' => true,
        'album' => catn8_photo_albums_row_to_payload($row ?: []),
        'ai' => [
            'provider' => (string)($img['provider'] ?? ''),
            'model' => (string)($img['model'] ?? ''),
            'prompt_syntax' => 'CATN8_SCRAPBOOK_COVER_PROMPT_V1',
            'spec_syntax' => 'catn8_scrapbook_spec_v1',
        ],
    ]);
}

catn8_json_response(['success' => false, 'error' => 'Unsupported action'], 400);
