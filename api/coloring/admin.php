<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../settings/ai_test_functions.php';
require_once __DIR__ . '/../../includes/google_oauth_service_account.php';

catn8_session_start();
catn8_require_admin();

$viewerId = catn8_auth_user_id();
if ($viewerId === null) {
    catn8_json_response(['success' => false, 'error' => 'Not authenticated'], 401);
}

function catn8_coloring_table_ensure(): void
{
    Database::execute("CREATE TABLE IF NOT EXISTS coloring_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(96) NOT NULL UNIQUE,
        name VARCHAR(191) NOT NULL,
        description TEXT NOT NULL,
        sort_order INT NOT NULL DEFAULT 10,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_coloring_categories_sort (sort_order, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS coloring_themes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category_id INT NOT NULL,
        slug VARCHAR(96) NOT NULL UNIQUE,
        name VARCHAR(191) NOT NULL,
        description TEXT NOT NULL,
        sort_order INT NOT NULL DEFAULT 10,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_coloring_themes_category_sort (category_id, sort_order, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS coloring_difficulties (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(64) NOT NULL UNIQUE,
        name VARCHAR(128) NOT NULL,
        description TEXT NOT NULL,
        complexity_level INT NOT NULL DEFAULT 2,
        sort_order INT NOT NULL DEFAULT 10,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_coloring_difficulties_sort (sort_order, complexity_level, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS coloring_pages_library (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(191) NOT NULL,
        description TEXT NOT NULL,
        category_id INT NOT NULL,
        theme_id INT NOT NULL,
        difficulty_id INT NOT NULL,
        image_url VARCHAR(500) NOT NULL,
        image_prompt TEXT NOT NULL,
        palette_json MEDIUMTEXT NOT NULL,
        regions_json MEDIUMTEXT NOT NULL,
        metadata_json MEDIUMTEXT NOT NULL,
        ai_provider VARCHAR(64) NOT NULL DEFAULT '',
        ai_model VARCHAR(191) NOT NULL DEFAULT '',
        created_by_user_id INT NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_coloring_pages_theme (theme_id),
        KEY idx_coloring_pages_category (category_id),
        KEY idx_coloring_pages_difficulty (difficulty_id),
        KEY idx_coloring_pages_active (is_active, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function catn8_coloring_slug(string $value): string
{
    $value = strtolower(trim($value));
    $value = preg_replace('/[^a-z0-9]+/', '-', $value);
    $value = trim((string)$value, '-');
    return substr($value, 0, 96);
}

function catn8_coloring_clean_text(string $value, int $maxLen): string
{
    $value = trim($value);
    if ($value === '') return '';
    $value = preg_replace('/\s+/', ' ', $value);
    return substr((string)$value, 0, $maxLen);
}

function catn8_coloring_seed_defaults(): void
{
    $row = Database::queryOne('SELECT COUNT(*) AS c FROM coloring_categories');
    $count = (int)($row['c'] ?? 0);
    if ($count === 0) {
        $categorySeeds = [
            ['animals', 'Animals', 'Pets and wildlife scenes', 10],
            ['nature', 'Nature', 'Landscapes, plants, and scenic environments', 20],
            ['space', 'Space', 'Outer space and astronomy pages', 30],
            ['ocean', 'Ocean', 'Sea life and underwater adventure pages', 40],
            ['dinosaurs', 'Dinosaurs', 'Prehistoric dinosaur-themed pages', 50],
            ['fantasy', 'Fantasy', 'Magical creatures and fantasy worlds', 60],
            ['vehicles', 'Vehicles', 'Cars, trucks, trains, boats, and aircraft', 70],
            ['holidays', 'Holidays', 'Seasonal and celebration pages', 80],
            ['farm', 'Farm', 'Farm life and country scenes', 90],
            ['weather', 'Weather', 'Weather patterns and sky scenes', 100],
        ];
        foreach ($categorySeeds as $seed) {
            Database::execute(
                'INSERT INTO coloring_categories (slug, name, description, sort_order, is_active) VALUES (?, ?, ?, ?, 1)',
                [$seed[0], $seed[1], $seed[2], (int)$seed[3]]
            );
        }
    }

    $row = Database::queryOne('SELECT COUNT(*) AS c FROM coloring_difficulties');
    $difficultyCount = (int)($row['c'] ?? 0);
    if ($difficultyCount === 0) {
        $diffSeeds = [
            ['simple', 'Simple', 'Large easy-to-fill areas for younger kids', 1, 10],
            ['medium', 'Medium', 'Balanced detail level', 2, 20],
            ['difficult', 'Difficult', 'More detailed and smaller fill regions', 3, 30],
        ];
        foreach ($diffSeeds as $seed) {
            Database::execute(
                'INSERT INTO coloring_difficulties (slug, name, description, complexity_level, sort_order, is_active) VALUES (?, ?, ?, ?, ?, 1)',
                [$seed[0], $seed[1], $seed[2], (int)$seed[3], (int)$seed[4]]
            );
        }
    }

    $row = Database::queryOne('SELECT COUNT(*) AS c FROM coloring_themes');
    $themeCount = (int)($row['c'] ?? 0);
    if ($themeCount === 0) {
        $categories = Database::queryAll('SELECT id, slug, name FROM coloring_categories');
        foreach ($categories as $cat) {
            $catId = (int)($cat['id'] ?? 0);
            $catSlug = (string)($cat['slug'] ?? '');
            if ($catId <= 0 || $catSlug === '') continue;
            Database::execute(
                'INSERT INTO coloring_themes (category_id, slug, name, description, sort_order, is_active) VALUES (?, ?, ?, ?, ?, 1)',
                [$catId, $catSlug, (string)($cat['name'] ?? ''), 'Default ' . (string)($cat['name'] ?? '') . ' theme', 10]
            );
        }
    }
}

function catn8_coloring_list_payload(): array
{
    $categories = Database::queryAll('SELECT id, slug, name, description, sort_order, is_active FROM coloring_categories ORDER BY sort_order ASC, name ASC');
    $themes = Database::queryAll('SELECT id, category_id, slug, name, description, sort_order, is_active FROM coloring_themes ORDER BY sort_order ASC, name ASC');
    $difficulties = Database::queryAll('SELECT id, slug, name, description, complexity_level, sort_order, is_active FROM coloring_difficulties ORDER BY sort_order ASC, complexity_level ASC, name ASC');
    $pages = Database::queryAll('SELECT id, title, description, category_id, theme_id, difficulty_id, image_url, image_prompt, palette_json, regions_json, is_active, created_at, updated_at FROM coloring_pages_library ORDER BY updated_at DESC, id DESC LIMIT 500');

    $castFn = static function (array $rows): array {
        return array_map(static function ($row) {
            $out = [];
            foreach ($row as $k => $v) {
                if (in_array($k, ['id', 'category_id', 'theme_id', 'difficulty_id', 'sort_order', 'is_active', 'complexity_level'], true)) {
                    $out[$k] = (int)$v;
                } else {
                    $out[$k] = (string)$v;
                }
            }
            return $out;
        }, $rows);
    };

    return [
        'categories' => $castFn($categories),
        'themes' => $castFn($themes),
        'difficulties' => $castFn($difficulties),
        'pages' => $castFn($pages),
    ];
}

function catn8_coloring_download_b64_from_url(string $url): string
{
    $url = trim($url);
    if ($url === '') throw new RuntimeException('Generated image URL was empty');
    $parts = parse_url($url);
    if (!is_array($parts)) throw new RuntimeException('Generated image URL was invalid');
    $scheme = strtolower((string)($parts['scheme'] ?? ''));
    if ($scheme !== 'https' && $scheme !== 'http') throw new RuntimeException('Generated image URL scheme was invalid');

    $binary = @file_get_contents($url);
    if (!is_string($binary) || $binary === '') throw new RuntimeException('Failed to download generated image URL');
    $b64 = base64_encode($binary);
    if (!is_string($b64) || trim($b64) === '') throw new RuntimeException('Failed to encode generated image URL data');
    return trim($b64);
}

function catn8_coloring_theme_palette(string $themeSlug): array
{
    $map = [
        'animals' => [
            ['id' => 'fur_brown', 'name' => 'Fur Brown', 'hex' => '#9C6644'],
            ['id' => 'grass_green', 'name' => 'Grass Green', 'hex' => '#6A994E'],
            ['id' => 'sky_blue', 'name' => 'Sky Blue', 'hex' => '#8ECAE6'],
            ['id' => 'sun_gold', 'name' => 'Sun Gold', 'hex' => '#FFB703'],
            ['id' => 'cream', 'name' => 'Cream', 'hex' => '#F8EDE3'],
        ],
        'nature' => [
            ['id' => 'leaf', 'name' => 'Leaf Green', 'hex' => '#588157'],
            ['id' => 'water', 'name' => 'Water Blue', 'hex' => '#219EBC'],
            ['id' => 'soil', 'name' => 'Soil Brown', 'hex' => '#7F5539'],
            ['id' => 'sun', 'name' => 'Sun Yellow', 'hex' => '#FFB703'],
            ['id' => 'cloud', 'name' => 'Cloud White', 'hex' => '#F8F9FA'],
        ],
        'space' => [
            ['id' => 'space_navy', 'name' => 'Space Navy', 'hex' => '#14213D'],
            ['id' => 'star', 'name' => 'Star Gold', 'hex' => '#F4D35E'],
            ['id' => 'planet_blue', 'name' => 'Planet Blue', 'hex' => '#00A6FB'],
            ['id' => 'rocket_red', 'name' => 'Rocket Red', 'hex' => '#E63946'],
            ['id' => 'moon_gray', 'name' => 'Moon Gray', 'hex' => '#E5E5E5'],
        ],
        'ocean' => [
            ['id' => 'deep', 'name' => 'Deep Blue', 'hex' => '#023E8A'],
            ['id' => 'wave', 'name' => 'Wave Blue', 'hex' => '#00B4D8'],
            ['id' => 'reef', 'name' => 'Reef Coral', 'hex' => '#FF6B6B'],
            ['id' => 'sand', 'name' => 'Sand', 'hex' => '#E9C46A'],
            ['id' => 'foam', 'name' => 'Foam White', 'hex' => '#F1FAEE'],
        ],
        'dinosaurs' => [
            ['id' => 'fern', 'name' => 'Fern', 'hex' => '#52B788'],
            ['id' => 'lava', 'name' => 'Lava', 'hex' => '#E76F51'],
            ['id' => 'stone', 'name' => 'Stone', 'hex' => '#6C757D'],
            ['id' => 'mud', 'name' => 'Mud', 'hex' => '#8D5524'],
            ['id' => 'sun', 'name' => 'Sun', 'hex' => '#F4A261'],
        ],
        'fantasy' => [
            ['id' => 'pink', 'name' => 'Pink', 'hex' => '#FF70A6'],
            ['id' => 'mint', 'name' => 'Mint', 'hex' => '#70D6FF'],
            ['id' => 'sunbeam', 'name' => 'Sunbeam', 'hex' => '#FFD670'],
            ['id' => 'lavender', 'name' => 'Lavender', 'hex' => '#B388EB'],
            ['id' => 'silver', 'name' => 'Silver', 'hex' => '#E9ECEF'],
        ],
        'vehicles' => [
            ['id' => 'red', 'name' => 'Red', 'hex' => '#E63946'],
            ['id' => 'blue', 'name' => 'Blue', 'hex' => '#457B9D'],
            ['id' => 'yellow', 'name' => 'Yellow', 'hex' => '#FFB703'],
            ['id' => 'steel', 'name' => 'Steel', 'hex' => '#6C757D'],
            ['id' => 'glass', 'name' => 'Glass', 'hex' => '#CAF0F8'],
        ],
        'holidays' => [
            ['id' => 'berry', 'name' => 'Berry', 'hex' => '#D00000'],
            ['id' => 'pine', 'name' => 'Pine', 'hex' => '#2D6A4F'],
            ['id' => 'gold', 'name' => 'Gold', 'hex' => '#FFC300'],
            ['id' => 'snow', 'name' => 'Snow', 'hex' => '#F8F9FA'],
            ['id' => 'party', 'name' => 'Party', 'hex' => '#7B2CBF'],
        ],
        'farm' => [
            ['id' => 'barn', 'name' => 'Barn Red', 'hex' => '#BC4749'],
            ['id' => 'hay', 'name' => 'Hay', 'hex' => '#E9C46A'],
            ['id' => 'field', 'name' => 'Field', 'hex' => '#6A994E'],
            ['id' => 'sky', 'name' => 'Sky', 'hex' => '#8ECAE6'],
            ['id' => 'dirt', 'name' => 'Dirt', 'hex' => '#7F5539'],
        ],
        'weather' => [
            ['id' => 'sun', 'name' => 'Sunshine', 'hex' => '#FFB703'],
            ['id' => 'rain', 'name' => 'Rain', 'hex' => '#219EBC'],
            ['id' => 'storm', 'name' => 'Storm', 'hex' => '#5C677D'],
            ['id' => 'cloud', 'name' => 'Cloud', 'hex' => '#E9ECEF'],
            ['id' => 'wind', 'name' => 'Wind', 'hex' => '#A8DADC'],
        ],
    ];

    return $map[$themeSlug] ?? [
        ['id' => 'primary', 'name' => 'Primary', 'hex' => '#6A994E'],
        ['id' => 'secondary', 'name' => 'Secondary', 'hex' => '#8ECAE6'],
        ['id' => 'accent', 'name' => 'Accent', 'hex' => '#FFB703'],
        ['id' => 'neutral', 'name' => 'Neutral', 'hex' => '#E9ECEF'],
    ];
}

function catn8_coloring_regions_blueprint(string $pageIdPrefix, string $themeSlug, int $complexity, array $palette): array
{
    $complexity = max(1, min(3, $complexity));
    $detailCount = $complexity === 1 ? 3 : ($complexity === 2 ? 7 : 12);

    $regions = [
        ['label' => 'Sky', 'shapeType' => 'rect', 'cx' => 500, 'cy' => 190, 'width' => 1000, 'height' => 380],
        ['label' => 'Ground', 'shapeType' => 'rect', 'cx' => 500, 'cy' => 560, 'width' => 1000, 'height' => 280],
        ['label' => 'Main Subject Body', 'shapeType' => 'circle', 'cx' => 500, 'cy' => 410, 'width' => 280, 'height' => 220],
        ['label' => 'Main Subject Head', 'shapeType' => 'circle', 'cx' => 650, 'cy' => 330, 'width' => 140, 'height' => 120],
        ['label' => 'Feature Left', 'shapeType' => 'triangle', 'cx' => 430, 'cy' => 370, 'width' => 95, 'height' => 100],
        ['label' => 'Feature Right', 'shapeType' => 'triangle', 'cx' => 575, 'cy' => 370, 'width' => 95, 'height' => 100],
    ];

    if ($themeSlug === 'vehicles') {
        $regions[2] = ['label' => 'Vehicle Body', 'shapeType' => 'rect', 'cx' => 500, 'cy' => 440, 'width' => 420, 'height' => 180];
        $regions[] = ['label' => 'Left Wheel', 'shapeType' => 'circle', 'cx' => 380, 'cy' => 545, 'width' => 110, 'height' => 110];
        $regions[] = ['label' => 'Right Wheel', 'shapeType' => 'circle', 'cx' => 620, 'cy' => 545, 'width' => 110, 'height' => 110];
    }

    if ($themeSlug === 'space') {
        $regions[0] = ['label' => 'Space Background', 'shapeType' => 'rect', 'cx' => 500, 'cy' => 350, 'width' => 1000, 'height' => 700];
        $regions[1] = ['label' => 'Planet Surface', 'shapeType' => 'circle', 'cx' => 220, 'cy' => 500, 'width' => 240, 'height' => 240];
    }

    $paletteCount = max(1, count($palette));
    $out = [];
    $seq = 1;

    foreach ($regions as $index => $region) {
        $out[] = [
            'id' => $pageIdPrefix . '-r' . $seq,
            'label' => $region['label'],
            'targetColorId' => (string)$palette[$index % $paletteCount]['id'],
            'shapeType' => $region['shapeType'],
            'cx' => (float)$region['cx'],
            'cy' => (float)$region['cy'],
            'width' => (float)$region['width'],
            'height' => (float)$region['height'],
        ];
        $seq++;
    }

    for ($i = 0; $i < $detailCount; $i++) {
        $out[] = [
            'id' => $pageIdPrefix . '-r' . $seq,
            'label' => 'Detail ' . ($i + 1),
            'targetColorId' => (string)$palette[($i + 2) % $paletteCount]['id'],
            'shapeType' => ($i % 2 === 0 ? 'diamond' : 'circle'),
            'cx' => (float)(130 + (($i % 6) * 130)),
            'cy' => (float)(560 - (floor($i / 6) * 64)),
            'width' => 36.0,
            'height' => 36.0,
        ];
        $seq++;
    }

    return $out;
}

function catn8_coloring_generate_image_b64(string $prompt): array
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
            $b64 = catn8_coloring_download_b64_from_url((string)$resp->data[0]->url);
        }

        if ($b64 === '') {
            throw new RuntimeException('AI image provider returned no image data');
        }

        return ['provider' => $provider, 'model' => (string)($payload['model'] ?? ''), 'b64' => $b64];
    }

    if ($provider === 'google_vertex_ai') {
        $saJson = secret_get(catn8_settings_ai_image_secret_key($provider, 'service_account_json'));
        if (!is_string($saJson) || trim($saJson) === '') {
            throw new RuntimeException('Missing AI image service account JSON (google_vertex_ai)');
        }

        $sa = json_decode((string)$saJson, true);
        if (!is_array($sa)) {
            throw new RuntimeException('AI image Vertex service account JSON is not valid JSON');
        }

        $projectId = trim((string)($providerConfig['gcp_project_id'] ?? ''));
        if ($projectId === '') $projectId = trim((string)($sa['project_id'] ?? ''));
        $location = trim((string)($providerConfig['gcp_region'] ?? 'us-central1'));
        $modelName = $model !== '' ? $model : 'imagen-3.0-generate-001';
        if ($projectId === '') throw new RuntimeException('Missing GCP project id for Vertex AI image provider');

        $token = catn8_google_service_account_access_token((string)$saJson, 'https://www.googleapis.com/auth/cloud-platform');
        $host = strtolower($location) === 'global' ? 'aiplatform.googleapis.com' : ($location . '-aiplatform.googleapis.com');

        $modelPath = $modelName;
        if (strpos($modelPath, 'publishers/') !== 0 && strpos($modelPath, '/') === false) {
            $modelPath = 'publishers/google/models/' . $modelPath;
        }

        $url = 'https://' . $host . '/v1/projects/' . rawurlencode($projectId) . '/locations/' . rawurlencode($location) . '/' . $modelPath . ':predict';

        $payload = [
            'instances' => [['prompt' => $prompt]],
            'parameters' => ['sampleCount' => 1],
        ];

        $res = catn8_http_json_with_status('POST', $url, ['Authorization' => 'Bearer ' . $token], $payload, 10, 60);
        $status = (int)($res['status'] ?? 0);
        $json = $res['json'] ?? null;
        if (!is_array($json) || $status < 200 || $status >= 300 || isset($json['error'])) {
            $msg = is_array($json) && isset($json['error']['message']) ? (string)$json['error']['message'] : ('HTTP ' . $status);
            throw new RuntimeException('Vertex AI image generation failed: ' . $msg);
        }

        $preds = $json['predictions'] ?? null;
        if (!is_array($preds) || !isset($preds[0]) || !is_array($preds[0])) {
            throw new RuntimeException('Vertex AI image response missing predictions');
        }

        $b64 = trim((string)($preds[0]['bytesBase64Encoded'] ?? ''));
        if ($b64 === '' && isset($preds[0]['image']['bytesBase64Encoded'])) {
            $b64 = trim((string)$preds[0]['image']['bytesBase64Encoded']);
        }
        if ($b64 === '') throw new RuntimeException('Vertex AI image response missing bytesBase64Encoded');

        return ['provider' => $provider, 'model' => $modelName, 'b64' => $b64];
    }

    throw new RuntimeException('Unsupported AI image provider for coloring generation: ' . $provider);
}

catn8_coloring_table_ensure();
catn8_coloring_seed_defaults();

$action = trim((string)($_GET['action'] ?? 'list_all'));

if ($action === 'list_all') {
    catn8_json_response(['success' => true] + catn8_coloring_list_payload());
}

$postActions = [
    'create_category', 'update_category', 'delete_category',
    'create_theme', 'update_theme', 'delete_theme',
    'create_difficulty', 'update_difficulty', 'delete_difficulty',
    'create_page', 'update_page', 'delete_page',
    'generate_page',
];

if (!in_array($action, $postActions, true)) {
    catn8_json_response(['success' => false, 'error' => 'Unknown action'], 400);
}

catn8_require_method('POST');
$body = catn8_read_json_body();

if ($action === 'create_category' || $action === 'update_category') {
    $id = (int)($body['id'] ?? 0);
    $name = catn8_coloring_clean_text((string)($body['name'] ?? ''), 191);
    $slug = catn8_coloring_slug((string)($body['slug'] ?? ''));
    if ($slug === '' && $name !== '') $slug = catn8_coloring_slug($name);
    $description = catn8_coloring_clean_text((string)($body['description'] ?? ''), 1200);
    $sortOrder = (int)($body['sort_order'] ?? 10);
    $isActive = ((int)($body['is_active'] ?? 1) === 1) ? 1 : 0;

    if ($name === '' || $slug === '') {
        catn8_json_response(['success' => false, 'error' => 'Category name and slug are required'], 400);
    }

    if ($action === 'create_category') {
        Database::execute('INSERT INTO coloring_categories (slug, name, description, sort_order, is_active) VALUES (?, ?, ?, ?, ?)', [$slug, $name, $description, $sortOrder, $isActive]);
    } else {
        if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid category id'], 400);
        Database::execute('UPDATE coloring_categories SET slug = ?, name = ?, description = ?, sort_order = ?, is_active = ? WHERE id = ? LIMIT 1', [$slug, $name, $description, $sortOrder, $isActive, $id]);
    }

    catn8_json_response(['success' => true] + catn8_coloring_list_payload());
}

if ($action === 'delete_category') {
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid category id'], 400);

    $useCount = Database::queryOne('SELECT COUNT(*) AS c FROM coloring_themes WHERE category_id = ?', [$id]);
    if ((int)($useCount['c'] ?? 0) > 0) {
        catn8_json_response(['success' => false, 'error' => 'Cannot delete category with attached themes'], 409);
    }
    Database::execute('DELETE FROM coloring_categories WHERE id = ? LIMIT 1', [$id]);
    catn8_json_response(['success' => true] + catn8_coloring_list_payload());
}

if ($action === 'create_theme' || $action === 'update_theme') {
    $id = (int)($body['id'] ?? 0);
    $categoryId = (int)($body['category_id'] ?? 0);
    $name = catn8_coloring_clean_text((string)($body['name'] ?? ''), 191);
    $slug = catn8_coloring_slug((string)($body['slug'] ?? ''));
    if ($slug === '' && $name !== '') $slug = catn8_coloring_slug($name);
    $description = catn8_coloring_clean_text((string)($body['description'] ?? ''), 1200);
    $sortOrder = (int)($body['sort_order'] ?? 10);
    $isActive = ((int)($body['is_active'] ?? 1) === 1) ? 1 : 0;

    if ($categoryId <= 0 || $name === '' || $slug === '') {
        catn8_json_response(['success' => false, 'error' => 'Theme category, name, and slug are required'], 400);
    }

    $catRow = Database::queryOne('SELECT id FROM coloring_categories WHERE id = ? LIMIT 1', [$categoryId]);
    if (!$catRow) catn8_json_response(['success' => false, 'error' => 'Category not found'], 404);

    if ($action === 'create_theme') {
        Database::execute('INSERT INTO coloring_themes (category_id, slug, name, description, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)', [$categoryId, $slug, $name, $description, $sortOrder, $isActive]);
    } else {
        if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid theme id'], 400);
        Database::execute('UPDATE coloring_themes SET category_id = ?, slug = ?, name = ?, description = ?, sort_order = ?, is_active = ? WHERE id = ? LIMIT 1', [$categoryId, $slug, $name, $description, $sortOrder, $isActive, $id]);
    }

    catn8_json_response(['success' => true] + catn8_coloring_list_payload());
}

if ($action === 'delete_theme') {
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid theme id'], 400);

    $useCount = Database::queryOne('SELECT COUNT(*) AS c FROM coloring_pages_library WHERE theme_id = ?', [$id]);
    if ((int)($useCount['c'] ?? 0) > 0) {
        catn8_json_response(['success' => false, 'error' => 'Cannot delete theme with attached pages'], 409);
    }

    Database::execute('DELETE FROM coloring_themes WHERE id = ? LIMIT 1', [$id]);
    catn8_json_response(['success' => true] + catn8_coloring_list_payload());
}

if ($action === 'create_difficulty' || $action === 'update_difficulty') {
    $id = (int)($body['id'] ?? 0);
    $name = catn8_coloring_clean_text((string)($body['name'] ?? ''), 128);
    $slug = catn8_coloring_slug((string)($body['slug'] ?? ''));
    if ($slug === '' && $name !== '') $slug = catn8_coloring_slug($name);
    $description = catn8_coloring_clean_text((string)($body['description'] ?? ''), 1200);
    $complexityLevel = (int)($body['complexity_level'] ?? 2);
    $sortOrder = (int)($body['sort_order'] ?? 10);
    $isActive = ((int)($body['is_active'] ?? 1) === 1) ? 1 : 0;

    if ($name === '' || $slug === '') {
        catn8_json_response(['success' => false, 'error' => 'Difficulty name and slug are required'], 400);
    }

    if ($complexityLevel < 1) $complexityLevel = 1;
    if ($complexityLevel > 3) $complexityLevel = 3;

    if ($action === 'create_difficulty') {
        Database::execute('INSERT INTO coloring_difficulties (slug, name, description, complexity_level, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)', [$slug, $name, $description, $complexityLevel, $sortOrder, $isActive]);
    } else {
        if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid difficulty id'], 400);
        Database::execute('UPDATE coloring_difficulties SET slug = ?, name = ?, description = ?, complexity_level = ?, sort_order = ?, is_active = ? WHERE id = ? LIMIT 1', [$slug, $name, $description, $complexityLevel, $sortOrder, $isActive, $id]);
    }

    catn8_json_response(['success' => true] + catn8_coloring_list_payload());
}

if ($action === 'delete_difficulty') {
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid difficulty id'], 400);

    $useCount = Database::queryOne('SELECT COUNT(*) AS c FROM coloring_pages_library WHERE difficulty_id = ?', [$id]);
    if ((int)($useCount['c'] ?? 0) > 0) {
        catn8_json_response(['success' => false, 'error' => 'Cannot delete difficulty with attached pages'], 409);
    }

    Database::execute('DELETE FROM coloring_difficulties WHERE id = ? LIMIT 1', [$id]);
    catn8_json_response(['success' => true] + catn8_coloring_list_payload());
}

if ($action === 'create_page' || $action === 'update_page') {
    $id = (int)($body['id'] ?? 0);
    $title = catn8_coloring_clean_text((string)($body['title'] ?? ''), 191);
    $description = catn8_coloring_clean_text((string)($body['description'] ?? ''), 3000);
    $categoryId = (int)($body['category_id'] ?? 0);
    $themeId = (int)($body['theme_id'] ?? 0);
    $difficultyId = (int)($body['difficulty_id'] ?? 0);
    $imageUrl = catn8_coloring_clean_text((string)($body['image_url'] ?? ''), 500);
    $isActive = ((int)($body['is_active'] ?? 1) === 1) ? 1 : 0;

    if ($title === '' || $categoryId <= 0 || $themeId <= 0 || $difficultyId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Page title/category/theme/difficulty are required'], 400);
    }

    if ($action === 'create_page') {
        Database::execute(
            'INSERT INTO coloring_pages_library (title, description, category_id, theme_id, difficulty_id, image_url, image_prompt, palette_json, regions_json, metadata_json, ai_provider, ai_model, created_by_user_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$title, $description, $categoryId, $themeId, $difficultyId, $imageUrl, '', '[]', '[]', '{}', '', '', $viewerId, $isActive]
        );
    } else {
        if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid page id'], 400);
        Database::execute(
            'UPDATE coloring_pages_library SET title = ?, description = ?, category_id = ?, theme_id = ?, difficulty_id = ?, image_url = ?, is_active = ? WHERE id = ? LIMIT 1',
            [$title, $description, $categoryId, $themeId, $difficultyId, $imageUrl, $isActive, $id]
        );
    }

    catn8_json_response(['success' => true] + catn8_coloring_list_payload());
}

if ($action === 'delete_page') {
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid page id'], 400);
    Database::execute('DELETE FROM coloring_pages_library WHERE id = ? LIMIT 1', [$id]);
    catn8_json_response(['success' => true] + catn8_coloring_list_payload());
}

if ($action === 'generate_page') {
    catn8_rate_limit_require('coloring.generate.' . $viewerId, 20, 3600);

    $title = catn8_coloring_clean_text((string)($body['title'] ?? ''), 191);
    $description = catn8_coloring_clean_text((string)($body['description'] ?? ''), 2500);
    $categoryId = (int)($body['category_id'] ?? 0);
    $themeId = (int)($body['theme_id'] ?? 0);
    $difficultyId = (int)($body['difficulty_id'] ?? 0);

    if ($title === '' || $description === '' || $categoryId <= 0 || $themeId <= 0 || $difficultyId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Title, description, category, theme, and difficulty are required'], 400);
    }

    $category = Database::queryOne('SELECT id, slug, name FROM coloring_categories WHERE id = ? LIMIT 1', [$categoryId]);
    $theme = Database::queryOne('SELECT id, slug, name FROM coloring_themes WHERE id = ? LIMIT 1', [$themeId]);
    $difficulty = Database::queryOne('SELECT id, slug, name, complexity_level FROM coloring_difficulties WHERE id = ? LIMIT 1', [$difficultyId]);

    if (!$category || !$theme || !$difficulty) {
        catn8_json_response(['success' => false, 'error' => 'Invalid category, theme, or difficulty selection'], 400);
    }

    $themeSlug = (string)($theme['slug'] ?? '');
    $difficultyName = (string)($difficulty['name'] ?? '');
    $complexity = (int)($difficulty['complexity_level'] ?? 2);

    $prompt = 'Create a black-and-white printable coloring page illustration with clean, thick outlines and fully enclosed fill areas. '; 
    $prompt .= 'No grayscale shading, no text, no watermark, no logo. '; 
    $prompt .= 'Title concept: ' . $title . '. '; 
    $prompt .= 'Theme: ' . (string)($theme['name'] ?? '') . '. '; 
    $prompt .= 'Difficulty: ' . $difficultyName . '. '; 
    $prompt .= 'Scene details: ' . $description . '. '; 
    $prompt .= 'Composition should be kid-friendly, centered, and easy to color.';

    try {
        $img = catn8_coloring_generate_image_b64($prompt);
        $b64 = trim((string)($img['b64'] ?? ''));
        if ($b64 === '') throw new RuntimeException('AI provider did not return image data');

        $decoded = base64_decode($b64, true);
        if (!is_string($decoded) || $decoded === '') {
            throw new RuntimeException('Generated image base64 could not be decoded');
        }

        $dir = dirname(__DIR__, 2) . '/images/coloring/generated';
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new RuntimeException('Failed to create coloring image directory');
        }

        $fileName = 'coloring_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.png';
        $fullPath = $dir . '/' . $fileName;
        if (@file_put_contents($fullPath, $decoded) === false) {
            throw new RuntimeException('Failed to save generated coloring image');
        }

        $imageUrl = '/images/coloring/generated/' . $fileName;
        $palette = catn8_coloring_theme_palette($themeSlug);
        $regions = catn8_coloring_regions_blueprint('db-' . date('YmdHis'), $themeSlug, $complexity, $palette);

        $metadata = [
            'source' => 'ai_generated',
            'generated_at' => gmdate('c'),
            'theme_slug' => $themeSlug,
            'difficulty_slug' => (string)($difficulty['slug'] ?? ''),
            'complexity_level' => $complexity,
            'notes' => 'Regions and palette are generated metadata for color-fill gameplay.',
        ];

        Database::execute(
            'INSERT INTO coloring_pages_library (title, description, category_id, theme_id, difficulty_id, image_url, image_prompt, palette_json, regions_json, metadata_json, ai_provider, ai_model, created_by_user_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
            [
                $title,
                $description,
                $categoryId,
                $themeId,
                $difficultyId,
                $imageUrl,
                $prompt,
                json_encode($palette, JSON_UNESCAPED_SLASHES),
                json_encode($regions, JSON_UNESCAPED_SLASHES),
                json_encode($metadata, JSON_UNESCAPED_SLASHES),
                (string)($img['provider'] ?? ''),
                (string)($img['model'] ?? ''),
                $viewerId,
            ]
        );

        catn8_json_response(['success' => true, 'image_url' => $imageUrl] + catn8_coloring_list_payload());
    } catch (Throwable $e) {
        catn8_json_response(['success' => false, 'error' => 'AI page generation failed: ' . $e->getMessage()], 500);
    }
}

catn8_json_response(['success' => false, 'error' => 'Unhandled action'], 400);
