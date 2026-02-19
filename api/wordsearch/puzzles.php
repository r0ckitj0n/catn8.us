<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_session_start();
$viewerId = catn8_require_group_or_admin('wordsearch-users');

function catn8_wordsearch_puzzles_table_ensure(): void
{
    Database::execute("CREATE TABLE IF NOT EXISTS wordsearch_puzzles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        title VARCHAR(191) NOT NULL,
        topic_id INT NOT NULL,
        grid_size INT NOT NULL,
        difficulty VARCHAR(16) NOT NULL,
        pages_count INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_owner_user_id (owner_user_id),
        KEY idx_topic_id (topic_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function catn8_wordsearch_pages_table_ensure(): void
{
    Database::execute("CREATE TABLE IF NOT EXISTS wordsearch_puzzle_pages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        puzzle_id INT NOT NULL,
        page_number INT NOT NULL,
        seed BIGINT NOT NULL,
        words_json MEDIUMTEXT NOT NULL,
        grid_json MEDIUMTEXT NOT NULL,
        description_text MEDIUMTEXT NOT NULL,
        summary_text MEDIUMTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_puzzle_page (puzzle_id, page_number),
        KEY idx_puzzle_id (puzzle_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function catn8_wordsearch_pages_table_upgrade(): void
{
    $cols = Database::queryAll('SHOW COLUMNS FROM wordsearch_puzzle_pages');
    $have = [];
    foreach ($cols as $c) {
        $name = (string)($c['Field'] ?? '');
        if ($name !== '') $have[$name] = true;
    }

    if (!isset($have['description_text'])) {
        Database::execute("ALTER TABLE wordsearch_puzzle_pages ADD COLUMN description_text MEDIUMTEXT NOT NULL");
    }
    if (!isset($have['summary_text'])) {
        Database::execute("ALTER TABLE wordsearch_puzzle_pages ADD COLUMN summary_text MEDIUMTEXT NOT NULL");
    }
}

function catn8_wordsearch_is_admin(?int $uid): bool
{
    if ($uid === null) return false;
    catn8_users_table_ensure();
    $row = Database::queryOne('SELECT is_admin FROM users WHERE id = ?', [$uid]);
    return $row && (int)($row['is_admin'] ?? 0) === 1;
}

function catn8_wordsearch_require_login(): int
{
    $uid = catn8_auth_user_id();
    if ($uid === null) {
        catn8_json_response(['success' => false, 'error' => 'Not authenticated'], 401);
    }
    return $uid;
}

catn8_wordsearch_puzzles_table_ensure();
catn8_wordsearch_pages_table_ensure();
catn8_wordsearch_pages_table_upgrade();

// Ensure topics table exists (minimal copy to avoid including a request handler file).
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

$action = trim((string)($_GET['action'] ?? 'list'));

if ($action === 'list') {
    $rows = Database::queryAll(
        'SELECT p.id, p.owner_user_id, u.username AS owner_username, p.title, p.topic_id, t.title AS topic_title, p.grid_size, p.difficulty, p.pages_count, p.created_at, p.updated_at
         FROM wordsearch_puzzles p
         LEFT JOIN users u ON u.id = p.owner_user_id
         LEFT JOIN wordsearch_topics t ON t.id = p.topic_id
         ORDER BY p.updated_at DESC, p.id DESC'
    );

    $out = array_map(static function ($r) {
        return [
            'id' => (int)($r['id'] ?? 0),
            'owner_user_id' => (int)($r['owner_user_id'] ?? 0),
            'owner_username' => (string)($r['owner_username'] ?? ''),
            'title' => (string)($r['title'] ?? ''),
            'topic_id' => (int)($r['topic_id'] ?? 0),
            'topic_title' => (string)($r['topic_title'] ?? ''),
            'grid_size' => (int)($r['grid_size'] ?? 12),
            'difficulty' => (string)($r['difficulty'] ?? 'easy'),
            'pages_count' => (int)($r['pages_count'] ?? 1),
            'created_at' => (string)($r['created_at'] ?? ''),
            'updated_at' => (string)($r['updated_at'] ?? ''),
        ];
    }, $rows);

    $uid = catn8_auth_user_id();
    catn8_json_response([
        'success' => true,
        'puzzles' => $out,
        'viewer' => [
            'user_id' => $uid,
            'is_admin' => catn8_wordsearch_is_admin($uid) ? 1 : 0,
        ],
    ]);
}

if ($action === 'get') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);

    $row = Database::queryOne(
        'SELECT p.id, p.owner_user_id, u.username AS owner_username, p.title, p.topic_id, t.title AS topic_title, p.grid_size, p.difficulty, p.pages_count, p.created_at, p.updated_at
         FROM wordsearch_puzzles p
         LEFT JOIN users u ON u.id = p.owner_user_id
         LEFT JOIN wordsearch_topics t ON t.id = p.topic_id
         WHERE p.id = ?'
        , [$id]
    );

    if (!$row) catn8_json_response(['success' => false, 'error' => 'Not found'], 404);

    catn8_json_response(['success' => true, 'puzzle' => [
        'id' => (int)($row['id'] ?? 0),
        'owner_user_id' => (int)($row['owner_user_id'] ?? 0),
        'owner_username' => (string)($row['owner_username'] ?? ''),
        'title' => (string)($row['title'] ?? ''),
        'topic_id' => (int)($row['topic_id'] ?? 0),
        'topic_title' => (string)($row['topic_title'] ?? ''),
        'grid_size' => (int)($row['grid_size'] ?? 12),
        'difficulty' => (string)($row['difficulty'] ?? 'easy'),
        'pages_count' => (int)($row['pages_count'] ?? 1),
        'created_at' => (string)($row['created_at'] ?? ''),
        'updated_at' => (string)($row['updated_at'] ?? ''),
    ]]);
}

$uid = catn8_wordsearch_require_login();
$isAdmin = catn8_wordsearch_is_admin($uid);

if ($action === 'create') {
    catn8_require_method('POST');

    $body = catn8_read_json_body();
    $title = trim((string)($body['title'] ?? ''));
    $topicId = (int)($body['topic_id'] ?? 0);
    $gridSize = (int)($body['grid_size'] ?? 12);
    $difficulty = strtolower(trim((string)($body['difficulty'] ?? 'easy')));
    $pagesCount = (int)($body['pages_count'] ?? 1);

    if ($title === '' || $topicId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Title and topic are required'], 400);
    }

    if ($gridSize < 8) $gridSize = 8;
    if ($gridSize > 30) $gridSize = 30;

    if ($difficulty !== 'easy' && $difficulty !== 'medium' && $difficulty !== 'hard') $difficulty = 'easy';

    if ($pagesCount < 1) $pagesCount = 1;
    if ($pagesCount > 200) $pagesCount = 200;

    $topic = Database::queryOne('SELECT id FROM wordsearch_topics WHERE id = ? AND is_active = 1', [$topicId]);
    if (!$topic) {
        catn8_json_response(['success' => false, 'error' => 'Topic not found'], 404);
    }

    Database::execute(
        'INSERT INTO wordsearch_puzzles (owner_user_id, title, topic_id, grid_size, difficulty, pages_count) VALUES (?, ?, ?, ?, ?, ?)',
        [$uid, $title, $topicId, $gridSize, $difficulty, $pagesCount]
    );

    $row = Database::queryOne('SELECT LAST_INSERT_ID() AS id');
    $pid = (int)($row['id'] ?? 0);

    catn8_json_response(['success' => true, 'puzzle_id' => $pid]);
}

if ($action === 'update') {
    catn8_require_method('POST');

    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);

    $row = Database::queryOne('SELECT owner_user_id FROM wordsearch_puzzles WHERE id = ?', [$id]);
    if (!$row) catn8_json_response(['success' => false, 'error' => 'Not found'], 404);

    $ownerId = (int)($row['owner_user_id'] ?? 0);
    if (!$isAdmin && $ownerId !== $uid) {
        catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
    }

    $title = trim((string)($body['title'] ?? ''));
    if ($title === '') catn8_json_response(['success' => false, 'error' => 'Title is required'], 400);

    $pagesCount = isset($body['pages_count']) ? (int)$body['pages_count'] : null;
    if ($pagesCount !== null) {
        if ($pagesCount < 1) $pagesCount = 1;
        if ($pagesCount > 200) $pagesCount = 200;
        Database::execute('UPDATE wordsearch_puzzles SET title = ?, pages_count = ? WHERE id = ?', [$title, $pagesCount, $id]);
    } else {
        Database::execute('UPDATE wordsearch_puzzles SET title = ? WHERE id = ?', [$title, $id]);
    }
    catn8_json_response(['success' => true]);
}

if ($action === 'resize') {
    catn8_require_method('POST');

    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    $pagesCount = (int)($body['pages_count'] ?? 0);

    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    if ($pagesCount < 1) $pagesCount = 1;
    if ($pagesCount > 200) $pagesCount = 200;

    $row = Database::queryOne('SELECT owner_user_id FROM wordsearch_puzzles WHERE id = ?', [$id]);
    if (!$row) catn8_json_response(['success' => false, 'error' => 'Not found'], 404);

    $ownerId = (int)($row['owner_user_id'] ?? 0);
    if (!$isAdmin && $ownerId !== $uid) {
        catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
    }

    Database::beginTransaction();
    try {
        Database::execute('UPDATE wordsearch_puzzles SET pages_count = ? WHERE id = ?', [$pagesCount, $id]);
        Database::execute('DELETE FROM wordsearch_puzzle_pages WHERE puzzle_id = ? AND page_number > ?', [$id, $pagesCount]);
        Database::commit();
    } catch (Throwable $e) {
        if (Database::inTransaction()) Database::rollBack();
        catn8_json_response(['success' => false, 'error' => 'Resize failed'], 500);
    }

    catn8_json_response(['success' => true, 'pages_count' => $pagesCount]);
}

if ($action === 'delete') {
    catn8_require_method('POST');

    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);

    $row = Database::queryOne('SELECT owner_user_id FROM wordsearch_puzzles WHERE id = ?', [$id]);
    if (!$row) catn8_json_response(['success' => false, 'error' => 'Not found'], 404);

    $ownerId = (int)($row['owner_user_id'] ?? 0);
    if (!$isAdmin && $ownerId !== $uid) {
        catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
    }

    Database::beginTransaction();
    try {
        Database::execute('DELETE FROM wordsearch_puzzle_pages WHERE puzzle_id = ?', [$id]);
        Database::execute('DELETE FROM wordsearch_puzzles WHERE id = ?', [$id]);
        Database::commit();
    } catch (Throwable $e) {
        if (Database::inTransaction()) Database::rollBack();
        catn8_json_response(['success' => false, 'error' => 'Delete failed'], 500);
    }

    catn8_json_response(['success' => true]);
}

catn8_json_response(['success' => false, 'error' => 'Unknown action'], 400);
