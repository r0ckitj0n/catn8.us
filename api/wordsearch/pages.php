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

$action = trim((string)($_GET['action'] ?? 'list'));

$requirePuzzle = static function (int $puzzleId): array {
    $row = Database::queryOne('SELECT id, owner_user_id FROM wordsearch_puzzles WHERE id = ?', [$puzzleId]);
    if (!$row) {
        catn8_json_response(['success' => false, 'error' => 'Puzzle not found'], 404);
    }
    return $row;
};

$canWrite = static function (array $puzzleRow): bool {
    $uid = catn8_auth_user_id();
    if ($uid === null) return false;
    $isAdmin = catn8_wordsearch_is_admin($uid);
    $ownerId = (int)($puzzleRow['owner_user_id'] ?? 0);
    return $isAdmin || $ownerId === $uid;
};

if ($action === 'list') {
    $puzzleId = (int)($_GET['puzzle_id'] ?? 0);
    if ($puzzleId <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid puzzle_id'], 400);

    $requirePuzzle($puzzleId);

    $rows = Database::queryAll(
        'SELECT id, puzzle_id, page_number, seed, words_json, grid_json, description_text, summary_text, created_at, updated_at
         FROM wordsearch_puzzle_pages
         WHERE puzzle_id = ?
         ORDER BY page_number ASC',
        [$puzzleId]
    );

    $pages = array_map(static function ($r) {
        $words = json_decode((string)($r['words_json'] ?? '[]'), true);
        if (!is_array($words)) $words = [];
        $grid = json_decode((string)($r['grid_json'] ?? '[]'), true);
        if (!is_array($grid)) $grid = [];
        return [
            'id' => (int)($r['id'] ?? 0),
            'puzzle_id' => (int)($r['puzzle_id'] ?? 0),
            'page_number' => (int)($r['page_number'] ?? 0),
            'seed' => (string)($r['seed'] ?? '0'),
            'words' => array_values(array_map('strval', $words)),
            'grid' => $grid,
            'description' => (string)($r['description_text'] ?? ''),
            'summary' => (string)($r['summary_text'] ?? ''),
            'created_at' => (string)($r['created_at'] ?? ''),
            'updated_at' => (string)($r['updated_at'] ?? ''),
        ];
    }, $rows);

    catn8_json_response(['success' => true, 'pages' => $pages]);
}

if ($action === 'get') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);

    $r = Database::queryOne(
        'SELECT id, puzzle_id, page_number, seed, words_json, grid_json, description_text, summary_text, created_at, updated_at
         FROM wordsearch_puzzle_pages
         WHERE id = ?',
        [$id]
    );
    if (!$r) catn8_json_response(['success' => false, 'error' => 'Not found'], 404);

    $words = json_decode((string)($r['words_json'] ?? '[]'), true);
    if (!is_array($words)) $words = [];
    $grid = json_decode((string)($r['grid_json'] ?? '[]'), true);
    if (!is_array($grid)) $grid = [];

    catn8_json_response(['success' => true, 'page' => [
        'id' => (int)($r['id'] ?? 0),
        'puzzle_id' => (int)($r['puzzle_id'] ?? 0),
        'page_number' => (int)($r['page_number'] ?? 0),
        'seed' => (string)($r['seed'] ?? '0'),
        'words' => array_values(array_map('strval', $words)),
        'grid' => $grid,
        'description' => (string)($r['description_text'] ?? ''),
        'summary' => (string)($r['summary_text'] ?? ''),
        'created_at' => (string)($r['created_at'] ?? ''),
        'updated_at' => (string)($r['updated_at'] ?? ''),
    ]]);
}

$uid = catn8_wordsearch_require_login();

if ($action === 'upsert') {
    catn8_require_method('POST');

    $body = catn8_read_json_body();
    $puzzleId = (int)($body['puzzle_id'] ?? 0);
    $pageNumber = (int)($body['page_number'] ?? 0);
    $seed = (string)($body['seed'] ?? '0');
    $words = $body['words'] ?? [];
    $grid = $body['grid'] ?? [];
    $desc = (string)($body['description'] ?? '');
    $summary = (string)($body['summary'] ?? '');

    if ($puzzleId <= 0 || $pageNumber <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid puzzle_id or page_number'], 400);
    }

    $puzzle = $requirePuzzle($puzzleId);
    if (!$canWrite($puzzle)) {
        catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
    }

    if (!is_array($words)) $words = [];
    $words = array_values(array_filter(array_map('strval', $words), static fn ($w) => trim($w) !== ''));

    if (!is_array($grid)) $grid = [];

    $wordsJson = json_encode($words);
    $gridJson = json_encode($grid);

    Database::execute(
        'INSERT INTO wordsearch_puzzle_pages (puzzle_id, page_number, seed, words_json, grid_json, description_text, summary_text) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE seed = VALUES(seed), words_json = VALUES(words_json), grid_json = VALUES(grid_json), description_text = VALUES(description_text), summary_text = VALUES(summary_text), updated_at = CURRENT_TIMESTAMP',
        [$puzzleId, $pageNumber, $seed, $wordsJson, $gridJson, $desc, $summary]
    );

    $row = Database::queryOne('SELECT id FROM wordsearch_puzzle_pages WHERE puzzle_id = ? AND page_number = ?', [$puzzleId, $pageNumber]);
    catn8_json_response(['success' => true, 'page_id' => (int)($row['id'] ?? 0)]);
}

if ($action === 'delete') {
    catn8_require_method('POST');

    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);

    $row = Database::queryOne('SELECT puzzle_id FROM wordsearch_puzzle_pages WHERE id = ?', [$id]);
    if (!$row) catn8_json_response(['success' => false, 'error' => 'Not found'], 404);

    $puzzle = $requirePuzzle((int)($row['puzzle_id'] ?? 0));
    if (!$canWrite($puzzle)) {
        catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
    }

    Database::execute('DELETE FROM wordsearch_puzzle_pages WHERE id = ?', [$id]);
    catn8_json_response(['success' => true]);
}

catn8_json_response(['success' => false, 'error' => 'Unknown action'], 400);
