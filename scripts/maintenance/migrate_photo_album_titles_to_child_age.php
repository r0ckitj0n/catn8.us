<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/config.php';

function pa_title_migration_usage(): void
{
    echo "Usage:\n";
    echo "  php scripts/maintenance/migrate_photo_album_titles_to_child_age.php [--apply] [--db-env=local|live|current]\n";
    echo "\n";
    echo "Notes:\n";
    echo "  - Dry-run by default.\n";
    echo "  - Renames legacy \"... Memories N\" album titles to child age format.\n";
    echo "  - Child format: \"Name's 1st Month\" ... \"Name's 36th Month\", then \"Name's 3rd Year\" ...\n";
    echo "  - Writes planned SQL artifact to .local/state/ for traceability.\n";
}

function pa_title_migration_parse_args(array $argv): array
{
    $opts = [
        'apply' => false,
        'db_env' => 'current',
    ];

    foreach ($argv as $arg) {
        if ($arg === '--apply') {
            $opts['apply'] = true;
            continue;
        }
        if ($arg === '--help' || $arg === '-h') {
            pa_title_migration_usage();
            exit(0);
        }
        if (str_starts_with($arg, '--db-env=')) {
            $value = strtolower(trim((string)substr($arg, 9)));
            if (in_array($value, ['local', 'live', 'current'], true)) {
                $opts['db_env'] = $value;
            }
            continue;
        }
    }

    return $opts;
}

function pa_title_migration_connect(string $dbEnv): PDO
{
    if ($dbEnv === 'current') {
        return Database::getInstance();
    }

    $cfg = catn8_get_db_config($dbEnv);
    $host = trim((string)($cfg['host'] ?? ''));
    $db = trim((string)($cfg['db'] ?? ''));
    $user = trim((string)($cfg['user'] ?? ''));
    $pass = (string)($cfg['pass'] ?? '');
    $port = (int)($cfg['port'] ?? 3306);
    $socket = trim((string)($cfg['socket'] ?? ''));

    if ($db === '' || $user === '' || ($host === '' && $socket === '')) {
        throw new RuntimeException('DB config for --db-env=' . $dbEnv . ' is incomplete');
    }

    return Database::createConnection($host, $db, $user, $pass, $port, $socket);
}

function pa_title_migration_ordinal(int $value): string
{
    $n = max(1, $value);
    $mod100 = $n % 100;
    if ($mod100 >= 10 && $mod100 <= 20) {
        return $n . 'th';
    }
    $mod10 = $n % 10;
    if ($mod10 === 1) return $n . 'st';
    if ($mod10 === 2) return $n . 'nd';
    if ($mod10 === 3) return $n . 'rd';
    return $n . 'th';
}

function pa_title_migration_resolve_child_name(string $token): string
{
    $normalized = strtolower(trim($token));
    if ($normalized === '') {
        return '';
    }
    if (preg_match('/lyra|lyrielle/', $normalized)) {
        return 'Lyrielle';
    }
    if (preg_match('/eleanor/', $normalized)) {
        return 'Eleanor';
    }
    if (preg_match('/violet/', $normalized)) {
        return 'Violet';
    }
    if (preg_match('/trinity/', $normalized)) {
        return 'Violet';
    }
    return '';
}

function pa_title_migration_base_title(string $childName, int $oneBasedIndex): string
{
    $monthIndex = max(0, $oneBasedIndex - 1);
    if ($monthIndex < 36) {
        return $childName . "'s " . pa_title_migration_ordinal($monthIndex + 1) . ' Month';
    }
    $yearNo = 3 + intdiv(($monthIndex - 36), 12);
    return $childName . "'s " . pa_title_migration_ordinal($yearNo) . ' Year';
}

function pa_title_migration_sql_quote(string $value): string
{
    return "'" . str_replace(["\\", "'"], ["\\\\", "''"], $value) . "'";
}

function pa_title_migration_write_sql_artifact(string $sql): string
{
    $stateDir = dirname(__DIR__, 2) . '/.local/state';
    if (!is_dir($stateDir)) {
        mkdir($stateDir, 0775, true);
    }
    $path = $stateDir . '/photo_album_title_migration_' . date('Ymd_His') . '.sql';
    file_put_contents($path, $sql);
    return $path;
}

$opts = pa_title_migration_parse_args($argv ?? []);
$apply = (bool)$opts['apply'];
$dbEnv = (string)$opts['db_env'];

try {
    $pdo = pa_title_migration_connect($dbEnv);
} catch (Throwable $e) {
    fwrite(STDERR, "DB connect failed: {$e->getMessage()}\n");
    exit(1);
}

$dbNameRow = $pdo->query('SELECT DATABASE() AS db_name')->fetch(PDO::FETCH_ASSOC);
$dbName = (string)($dbNameRow['db_name'] ?? '');

try {
    $tableExistsStmt = $pdo->prepare(
        "SELECT 1
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'photo_albums'
         LIMIT 1"
    );
    $tableExistsStmt->execute();
    $tableExists = (bool)$tableExistsStmt->fetch(PDO::FETCH_ASSOC);
} catch (Throwable $e) {
    fwrite(STDERR, "Failed to check photo_albums table existence: {$e->getMessage()}\n");
    exit(1);
}

if (!$tableExists) {
    echo json_encode([
        'success' => false,
        'mode' => $apply ? 'apply' : 'dry-run',
        'db_env' => $dbEnv,
        'database' => $dbName,
        'error' => 'photo_albums table not found in selected database',
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
    exit(1);
}

$rowsStmt = $pdo->query(
    'SELECT id, title, created_at
     FROM photo_albums
     ORDER BY created_at ASC, id ASC'
);
$rows = $rowsStmt ? ($rowsStmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];

$legacyMatches = [];
$renameIds = [];
foreach ($rows as $row) {
    $id = (int)($row['id'] ?? 0);
    $title = trim((string)($row['title'] ?? ''));
    if ($id <= 0 || $title === '') {
        continue;
    }
    if (!preg_match('/^(.+?)\s+Memories(?:\s+(Violet|Eleanor|Lyra|Lyrielle))?\s+([0-9]{1,3})$/i', $title, $m)) {
        continue;
    }

    $explicitToken = trim((string)($m[2] ?? ''));
    $baseToken = trim((string)($m[1] ?? ''));
    $childName = pa_title_migration_resolve_child_name($explicitToken !== '' ? $explicitToken : $baseToken);
    $index = (int)($m[3] ?? 0);
    if ($childName === '' || $index <= 0) {
        continue;
    }

    $baseTitle = pa_title_migration_base_title($childName, $index);
    $legacyMatches[] = [
        'id' => $id,
        'title' => $title,
        'created_at' => (string)($row['created_at'] ?? ''),
        'base_title' => $baseTitle,
    ];
    $renameIds[$id] = true;
}

$usedTitles = [];
foreach ($rows as $row) {
    $id = (int)($row['id'] ?? 0);
    $title = trim((string)($row['title'] ?? ''));
    if ($title === '' || isset($renameIds[$id])) {
        continue;
    }
    $usedTitles[strtolower($title)] = true;
}

$grouped = [];
foreach ($legacyMatches as $match) {
    $grouped[$match['base_title']][] = $match;
}
ksort($grouped);

$updates = [];
foreach ($grouped as $baseTitle => $items) {
    usort($items, static function (array $a, array $b): int {
        $ac = strtotime((string)($a['created_at'] ?? ''));
        $bc = strtotime((string)($b['created_at'] ?? ''));
        if ($ac !== $bc) {
            return $ac <=> $bc;
        }
        return ((int)$a['id']) <=> ((int)$b['id']);
    });

    $part = 1;
    foreach ($items as $item) {
        $target = $part === 1 ? $baseTitle : ($baseTitle . ' Part ' . $part);
        while (isset($usedTitles[strtolower($target)])) {
            $part += 1;
            $target = $baseTitle . ' Part ' . $part;
        }
        $usedTitles[strtolower($target)] = true;
        $part += 1;

        if (strcasecmp((string)$item['title'], $target) === 0) {
            continue;
        }
        $updates[] = [
            'id' => (int)$item['id'],
            'old_title' => (string)$item['title'],
            'new_title' => $target,
        ];
    }
}

$sqlParts = [];
foreach ($updates as $update) {
    $sqlParts[] = sprintf(
        "UPDATE photo_albums SET title = %s, updated_at = NOW() WHERE id = %d;",
        pa_title_migration_sql_quote($update['new_title']),
        (int)$update['id']
    );
}
$sqlArtifact = pa_title_migration_write_sql_artifact(implode("\n", $sqlParts) . "\n");

$summary = [
    'success' => true,
    'mode' => $apply ? 'apply' : 'dry-run',
    'db_env' => $dbEnv,
    'database' => $dbName,
    'rows_scanned' => count($rows),
    'legacy_rows_matched' => count($legacyMatches),
    'rows_to_rename' => count($updates),
    'sql_artifact' => $sqlArtifact,
    'sample' => array_slice($updates, 0, 80),
];

if (!$apply) {
    echo json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
    exit(0);
}

if (!$updates) {
    echo json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
    exit(0);
}

try {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('UPDATE photo_albums SET title = ?, updated_at = NOW() WHERE id = ?');
    foreach ($updates as $update) {
        $stmt->execute([(string)$update['new_title'], (int)$update['id']]);
    }
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, "Migration failed: {$e->getMessage()}\n");
    exit(1);
}

echo json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
