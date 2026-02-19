<?php

declare(strict_types=1);

require_once __DIR__ . '/../../api/bootstrap.php';

// CLI-only script.
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    echo "Forbidden\n";
    exit(1);
}

$path = $argv[1] ?? '';
$path = is_string($path) ? trim($path) : '';

if ($path === '' || !is_file($path)) {
    fwrite(STDERR, "Usage: php scripts/dev/import-wordsearch-generated-html.php /absolute/path/to/wordsearch.generated.html\n");
    exit(1);
}

// Ensure tables exist.
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

// Choose an owner: first admin, else first user.
catn8_users_table_ensure();
$ownerRow = Database::queryOne('SELECT id FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1');
if (!$ownerRow) {
    $ownerRow = Database::queryOne('SELECT id FROM users ORDER BY id ASC LIMIT 1');
}
$ownerId = (int)($ownerRow['id'] ?? 0);
if ($ownerId <= 0) {
    fwrite(STDERR, "No users found. Create at least one user (admin preferred) before importing.\n");
    exit(1);
}

$normalizeSlug = static function (string $s): string {
    $s = strtolower(trim($s));
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    $s = trim((string)$s, '-');
    return $s === '' ? 'imported' : $s;
};

$readAll = static function (string $p): string {
    $raw = file_get_contents($p);
    return is_string($raw) ? $raw : '';
};

$html = $readAll($path);
if ($html === '') {
    fwrite(STDERR, "Failed to read HTML.\n");
    exit(1);
}

// Extract each puzzle page.
// Expected shape:
// <h1>2010: Age 72</h1>
// <div class="description">...</div>
// <div class="year-summary">...</div>
// <div class="words-container"><span class="word-item">WORD</span> ...</div>
// <div class="puzzle-grid" aria-label="Word search grid for 2010"> <div class="grid-cell">R</div> ...</div>

$re = '/<div\s+class="puzzle-page".*?<h1>(?<h1>[^<]+)<\/h1>.*?(?:<div\s+class="description">(?<desc>.*?)<\/div>)?.*?(?:<div\s+class="year-summary">(?<summary>.*?)<\/div>)?.*?<div\s+class="words-container">(?<words>.*?)<\/div>\s*<\/div>.*?<div\s+class="puzzle-grid"[^>]*>(?<grid>.*?)<\/div>\s*<\/div>\s*<\/div>/si';

if (!preg_match_all($re, $html, $matches, PREG_SET_ORDER)) {
    fwrite(STDERR, "No puzzles found in HTML (pattern mismatch).\n");
    exit(1);
}

$imported = 0;
$skipped = 0;
$errors = 0;

foreach ($matches as $m) {
    $header = trim((string)($m['h1'] ?? ''));
    if ($header === '') continue;

    // Pull year from header if present.
    $year = null;
    if (preg_match('/\b(19\d{2}|20\d{2})\b/', $header, $ym)) {
        $year = (int)$ym[1];
    }

    $descHtml = (string)($m['desc'] ?? '');
    $desc = trim(html_entity_decode(strip_tags($descHtml), ENT_QUOTES | ENT_HTML5));

    $summaryHtml = (string)($m['summary'] ?? '');
    $summary = trim(html_entity_decode(strip_tags($summaryHtml), ENT_QUOTES | ENT_HTML5));

    $wordsHtml = (string)($m['words'] ?? '');
    preg_match_all('/<span\s+class="word-item">\s*([^<]+)\s*<\/span>/i', $wordsHtml, $wm);
    $words = array_values(array_filter(array_map(static function ($w) {
        $w = strtoupper(trim(html_entity_decode((string)$w, ENT_QUOTES | ENT_HTML5)));
        $w = preg_replace('/[^A-Z]/', '', $w);
        return $w;
    }, $wm[1] ?? []), static fn ($w) => is_string($w) && strlen($w) >= 3));

    $gridHtml = (string)($m['grid'] ?? '');
    preg_match_all('/<div\s+class="grid-cell">\s*([^<])\s*<\/div>/i', $gridHtml, $gm);
    $cells = array_values(array_map(static function ($ch) {
        $ch = strtoupper(trim(html_entity_decode((string)$ch, ENT_QUOTES | ENT_HTML5)));
        $ch = preg_replace('/[^A-Z]/', '', $ch);
        return $ch === '' ? 'A' : $ch;
    }, $gm[1] ?? []));

    $cellCount = count($cells);
    if ($cellCount <= 0) {
        $errors += 1;
        continue;
    }

    $size = (int)round(sqrt($cellCount));
    if ($size * $size !== $cellCount) {
        // Fallback to 12 if unexpected.
        $size = 12;
    }

    $grid = [];
    for ($r = 0; $r < $size; $r += 1) {
        $row = [];
        for ($c = 0; $c < $size; $c += 1) {
            $idx = ($r * $size) + $c;
            $row[] = $cells[$idx] ?? 'A';
        }
        $grid[] = $row;
    }

    $topicSlug = $normalizeSlug('imported-' . ($year ? (string)$year : $header));
    $topicTitle = $year ? (string)$year : mb_substr($header, 0, 191);
    $topicDesc = $summary !== '' ? $summary : ($desc !== '' ? $desc : $header);

    $existingTopic = Database::queryOne('SELECT id FROM wordsearch_topics WHERE slug = ? LIMIT 1', [$topicSlug]);
    if ($existingTopic) {
        $topicId = (int)($existingTopic['id'] ?? 0);
    } else {
        Database::execute(
            'INSERT INTO wordsearch_topics (slug, title, description, words_json, words_per_page, is_active) VALUES (?, ?, ?, ?, ?, 1)',
            [$topicSlug, $topicTitle, $topicDesc, json_encode($words), 15]
        );
        $row = Database::queryOne('SELECT LAST_INSERT_ID() AS id');
        $topicId = (int)($row['id'] ?? 0);
    }

    if ($topicId <= 0) {
        $errors += 1;
        continue;
    }

    $puzzleTitle = $header;
    if (mb_strlen($puzzleTitle) > 191) {
        $puzzleTitle = mb_substr($puzzleTitle, 0, 191);
    }

    $existingPuzzle = Database::queryOne(
        'SELECT id FROM wordsearch_puzzles WHERE title = ? AND topic_id = ? LIMIT 1',
        [$puzzleTitle, $topicId]
    );

    if ($existingPuzzle) {
        $puzzleId = (int)($existingPuzzle['id'] ?? 0);
    } else {
        Database::execute(
            'INSERT INTO wordsearch_puzzles (owner_user_id, title, topic_id, grid_size, difficulty, pages_count) VALUES (?, ?, ?, ?, ?, ?)',
            [$ownerId, $puzzleTitle, $topicId, $size, 'easy', 1]
        );
        $row = Database::queryOne('SELECT LAST_INSERT_ID() AS id');
        $puzzleId = (int)($row['id'] ?? 0);
    }

    if ($puzzleId <= 0) {
        $errors += 1;
        continue;
    }

    // Seed is not available in the HTML; set stable seed derived from year/title.
    $seed = 0;
    if ($year) {
        $seed = $year;
    } else {
        $seed = (int)(crc32($puzzleTitle) & 0x7fffffff);
    }

    // Insert page 1 (upsert).
    Database::execute(
        'INSERT INTO wordsearch_puzzle_pages (puzzle_id, page_number, seed, words_json, grid_json, description_text, summary_text) VALUES (?, 1, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE seed = VALUES(seed), words_json = VALUES(words_json), grid_json = VALUES(grid_json), description_text = VALUES(description_text), summary_text = VALUES(summary_text), updated_at = CURRENT_TIMESTAMP',
        [$puzzleId, $seed, json_encode($words), json_encode($grid), $desc, $summary]
    );

    if ($existingPuzzle) {
        $skipped += 1;
    } else {
        $imported += 1;
    }
}

fwrite(STDOUT, "Imported puzzles: {$imported}\n");
fwrite(STDOUT, "Skipped existing: {$skipped}\n");
fwrite(STDOUT, "Errors: {$errors}\n");
exit(0);
