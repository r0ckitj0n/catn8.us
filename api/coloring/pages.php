<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

function catn8_coloring_public_tables_ensure(): void
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

catn8_coloring_public_tables_ensure();

$rows = Database::queryAll(
    'SELECT p.id, p.title, p.description, p.image_url, p.palette_json, p.regions_json, p.updated_at,
            t.slug AS theme_slug, t.name AS theme_name,
            d.slug AS difficulty_slug, d.name AS difficulty_name
     FROM coloring_pages_library p
     LEFT JOIN coloring_themes t ON t.id = p.theme_id
     LEFT JOIN coloring_difficulties d ON d.id = p.difficulty_id
     WHERE p.is_active = 1
     ORDER BY p.updated_at DESC, p.id DESC
     LIMIT 400'
);

$pages = [];
foreach ($rows as $row) {
    $palette = json_decode((string)($row['palette_json'] ?? '[]'), true);
    if (!is_array($palette)) $palette = [];

    $regions = json_decode((string)($row['regions_json'] ?? '[]'), true);
    if (!is_array($regions)) $regions = [];

    $pages[] = [
        'id' => (int)($row['id'] ?? 0),
        'title' => (string)($row['title'] ?? ''),
        'description' => (string)($row['description'] ?? ''),
        'image_url' => (string)($row['image_url'] ?? ''),
        'theme_slug' => (string)($row['theme_slug'] ?? ''),
        'theme_name' => (string)($row['theme_name'] ?? ''),
        'difficulty_slug' => (string)($row['difficulty_slug'] ?? 'medium'),
        'difficulty_name' => (string)($row['difficulty_name'] ?? 'Medium'),
        'palette' => $palette,
        'regions' => $regions,
        'updated_at' => (string)($row['updated_at'] ?? ''),
    ];
}

catn8_json_response([
    'success' => true,
    'pages' => $pages,
]);
