<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_session_start();
$viewerId = catn8_require_group_or_admin('wordsearch-users');

function catn8_is_direct_script(string $path): bool
{
    $script = (string)($_SERVER['SCRIPT_FILENAME'] ?? '');
    if ($script === '') return true;
    return realpath($script) === realpath($path);
}

function catn8_wordsearch_topics_table_ensure(): void
{
    Database::execute("CREATE TABLE IF NOT EXISTS wordsearch_topics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(96) NOT NULL UNIQUE,
        title VARCHAR(191) NOT NULL,
        description TEXT NOT NULL,
        words_json MEDIUMTEXT NOT NULL,
        words_per_page INT NOT NULL DEFAULT 15,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    try {
        $cols = Database::queryAll('SHOW COLUMNS FROM wordsearch_topics');
        $has = false;
        foreach ($cols as $c) {
            if ((string)($c['Field'] ?? '') === 'words_per_page') {
                $has = true;
                break;
            }
        }
        if (!$has) {
            Database::execute('ALTER TABLE wordsearch_topics ADD COLUMN words_per_page INT NOT NULL DEFAULT 15');
        }
    } catch (Throwable $e) {
        // Best effort migration; do not break requests.
    }
}

function catn8_wordsearch_seed_default_topics(): void
{
    $row = Database::queryOne('SELECT COUNT(*) AS c FROM wordsearch_topics');
    $count = (int)($row['c'] ?? 0);
    if ($count > 0) return;

    $words = [
        'FAMILY','LOVE','HOME','FAITH','PRAYER','CHURCH','BIBLE','HOPE','KIND','SMILE','HELP','JOY',
        'GEORGIA','DAWSONVILLE','DAHLONEGA','GAINESVILLE','WOOLWORTH','GARDEN','CHICKEN','BISCUIT','HONEY','PEACH',
        'MEMORY','STORY','GRATEFUL','TOGETHER','FRIEND','COMMUNITY','TRADITION','MUSIC','SUNDAY','GATHER',
    ];

    $payload = json_encode(array_values($words));
    Database::execute(
        'INSERT INTO wordsearch_topics (slug, title, description, words_json, words_per_page, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        ['ellon-baseline', 'Ellon Baseline', 'A warm baseline topic with family, faith, and North Georgia roots.', $payload, 15]
    );
}

$action = trim((string)($_GET['action'] ?? 'list'));
catn8_wordsearch_topics_table_ensure();
catn8_wordsearch_seed_default_topics();

if (!catn8_is_direct_script(__FILE__)) {
    return;
}

if ($action === 'list') {
    $rows = Database::queryAll('SELECT id, slug, title, description, words_per_page, is_active FROM wordsearch_topics WHERE is_active = 1 ORDER BY title ASC');
    $topics = array_map(static function ($r) {
        return [
            'id' => (int)($r['id'] ?? 0),
            'slug' => (string)($r['slug'] ?? ''),
            'title' => (string)($r['title'] ?? ''),
            'description' => (string)($r['description'] ?? ''),
            'words_per_page' => (int)($r['words_per_page'] ?? 15),
            'is_active' => (int)($r['is_active'] ?? 0),
        ];
    }, $rows);
    catn8_json_response(['success' => true, 'topics' => $topics]);
}

if ($action === 'get') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);

    $row = Database::queryOne('SELECT id, slug, title, description, words_json, words_per_page, is_active FROM wordsearch_topics WHERE id = ?', [$id]);
    if (!$row) catn8_json_response(['success' => false, 'error' => 'Not found'], 404);

    $words = json_decode((string)($row['words_json'] ?? '[]'), true);
    if (!is_array($words)) $words = [];
    $words = array_values(array_filter(array_map('strval', $words), static fn ($w) => trim($w) !== ''));

    catn8_json_response(['success' => true, 'topic' => [
        'id' => (int)$row['id'],
        'slug' => (string)$row['slug'],
        'title' => (string)$row['title'],
        'description' => (string)$row['description'],
        'words_per_page' => (int)($row['words_per_page'] ?? 15),
        'is_active' => (int)$row['is_active'],
        'words' => $words,
    ]]);
}

catn8_require_admin();

if ($action === 'create') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $slug = trim((string)($body['slug'] ?? ''));
    $title = trim((string)($body['title'] ?? ''));
    $description = trim((string)($body['description'] ?? ''));
    $wordsPerPage = (int)($body['words_per_page'] ?? 15);
    $words = $body['words'] ?? [];

    if ($slug === '' || $title === '') {
        catn8_json_response(['success' => false, 'error' => 'Slug and title are required'], 400);
    }

    if ($wordsPerPage < 5) $wordsPerPage = 5;
    if ($wordsPerPage > 60) $wordsPerPage = 60;

    if (!is_array($words)) $words = [];
    $words = array_values(array_filter(array_map(static fn ($w) => strtoupper(preg_replace('/[^A-Z]/', '', (string)$w)), $words), static fn ($w) => strlen($w) >= 3));

    Database::execute(
        'INSERT INTO wordsearch_topics (slug, title, description, words_json, words_per_page, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        [$slug, $title, $description, json_encode($words), $wordsPerPage]
    );
    catn8_json_response(['success' => true]);
}

if ($action === 'update') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);

    $slug = trim((string)($body['slug'] ?? ''));
    $title = trim((string)($body['title'] ?? ''));
    $description = trim((string)($body['description'] ?? ''));
    $isActive = (int)($body['is_active'] ?? 1) ? 1 : 0;
    $wordsPerPage = (int)($body['words_per_page'] ?? 15);
    $words = $body['words'] ?? [];

    if ($slug === '' || $title === '') {
        catn8_json_response(['success' => false, 'error' => 'Slug and title are required'], 400);
    }

    if ($wordsPerPage < 5) $wordsPerPage = 5;
    if ($wordsPerPage > 60) $wordsPerPage = 60;

    if (!is_array($words)) $words = [];
    $words = array_values(array_filter(array_map(static fn ($w) => strtoupper(preg_replace('/[^A-Z]/', '', (string)$w)), $words), static fn ($w) => strlen($w) >= 3));

    Database::execute(
        'UPDATE wordsearch_topics SET slug = ?, title = ?, description = ?, words_json = ?, words_per_page = ?, is_active = ? WHERE id = ?',
        [$slug, $title, $description, json_encode($words), $wordsPerPage, $isActive, $id]
    );
    catn8_json_response(['success' => true]);
}

if ($action === 'delete') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);

    Database::execute('DELETE FROM wordsearch_topics WHERE id = ?', [$id]);
    catn8_json_response(['success' => true]);
}

catn8_json_response(['success' => false, 'error' => 'Unknown action'], 400);
