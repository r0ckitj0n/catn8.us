<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/config.php';

function usage(): void
{
    echo "Usage:\n";
    echo "  php scripts/maintenance/migrate_violet_third_year_to_season_year.php [--apply] [--db-env=local|live|current]\n";
    echo "\n";
    echo "Notes:\n";
    echo "  - Dry-run by default.\n";
    echo "  - Renames Violet 3rd year albums to \"Violet's 3rd Year - <Season> <Year>\".\n";
    echo "  - Rewrites summary format to \"YYYY-MM-DD to YYYY-MM-DD (N pages)\".\n";
}

function parse_args(array $argv): array
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
            usage();
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

function connect_db(string $dbEnv): PDO
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

function write_sql_artifact(string $sql): string
{
    $stateDir = dirname(__DIR__, 2) . '/.local/state';
    if (!is_dir($stateDir)) {
        mkdir($stateDir, 0775, true);
    }
    $path = $stateDir . '/violet_3rd_year_season_migration_' . date('Ymd_His') . '.sql';
    file_put_contents($path, $sql);
    return $path;
}

function quote_sql(string $value): string
{
    return "'" . str_replace(["\\", "'"], ["\\\\", "''"], $value) . "'";
}

function try_parse_date(string $value): ?DateTimeImmutable
{
    $trimmed = trim($value);
    if ($trimmed === '') {
        return null;
    }
    $ts = strtotime($trimmed);
    if ($ts === false) {
        return null;
    }
    return (new DateTimeImmutable('@' . $ts))->setTimezone(new DateTimeZone(date_default_timezone_get()));
}

function range_from_summary(string $summary): ?array
{
    if (!preg_match('/([0-9]{4}-[0-9]{2}-[0-9]{2})\s+to\s+([0-9]{4}-[0-9]{2}-[0-9]{2})/i', $summary, $m)) {
        return null;
    }
    $start = try_parse_date((string)$m[1]);
    $end = try_parse_date((string)$m[2]);
    if (!$start || !$end) {
        return null;
    }
    return [$start, $end];
}

function range_from_spec(string $specJson): ?array
{
    $decoded = json_decode($specJson, true);
    if (!is_array($decoded)) {
        return null;
    }
    $spreads = is_array($decoded['spreads'] ?? null) ? $decoded['spreads'] : [];
    $dates = [];
    foreach ($spreads as $spread) {
        if (!is_array($spread)) {
            continue;
        }
        $spreadDate = try_parse_date((string)($spread['title'] ?? ''));
        if ($spreadDate) {
            $dates[] = $spreadDate;
        }
        $images = is_array($spread['images'] ?? null) ? $spread['images'] : [];
        foreach ($images as $image) {
            if (!is_array($image)) {
                continue;
            }
            $captured = try_parse_date((string)($image['captured_at'] ?? ''));
            if ($captured) {
                $dates[] = $captured;
            }
        }
    }
    if (count($dates) === 0) {
        return null;
    }
    usort($dates, static fn(DateTimeImmutable $a, DateTimeImmutable $b): int => $a <=> $b);
    return [$dates[0], $dates[count($dates) - 1]];
}

function page_count_from_spec(string $specJson): int
{
    $decoded = json_decode($specJson, true);
    if (!is_array($decoded)) {
        return 0;
    }
    $spreads = is_array($decoded['spreads'] ?? null) ? $decoded['spreads'] : [];
    return count($spreads);
}

function season_year_from_date(DateTimeImmutable $date): array
{
    $month = (int)$date->format('n');
    $year = (int)$date->format('Y');
    if ($month >= 3 && $month <= 5) {
        return ['Spring', $year];
    }
    if ($month >= 6 && $month <= 8) {
        return ['Summer', $year];
    }
    if ($month >= 9 && $month <= 11) {
        return ['Fall', $year];
    }
    if ($month === 12) {
        return ['Winter', $year + 1];
    }
    return ['Winter', $year];
}

function season_bounds(string $season, int $year): array
{
    if ($season === 'Spring') {
        return [new DateTimeImmutable($year . '-03-01'), new DateTimeImmutable($year . '-05-31')];
    }
    if ($season === 'Summer') {
        return [new DateTimeImmutable($year . '-06-01'), new DateTimeImmutable($year . '-08-31')];
    }
    if ($season === 'Fall') {
        return [new DateTimeImmutable($year . '-09-01'), new DateTimeImmutable($year . '-11-30')];
    }
    return [new DateTimeImmutable(($year - 1) . '-12-01'), new DateTimeImmutable($year . '-02-' . (new DateTimeImmutable($year . '-02-01'))->format('t'))];
}

function dominant_season_year(DateTimeImmutable $start, DateTimeImmutable $end): array
{
    $startYear = (int)$start->format('Y');
    $endYear = (int)$end->format('Y');
    $seasons = ['Spring', 'Summer', 'Fall', 'Winter'];
    $bestSeason = 'Winter';
    $bestYear = $startYear;
    $bestDays = -1;
    foreach (range($startYear - 1, $endYear + 1) as $year) {
        foreach ($seasons as $season) {
            [$ss, $se] = season_bounds($season, (int)$year);
            $overlapStart = $start > $ss ? $start : $ss;
            $overlapEnd = $end < $se ? $end : $se;
            if ($overlapEnd < $overlapStart) {
                continue;
            }
            $days = (int)$overlapStart->diff($overlapEnd)->format('%a') + 1;
            if ($days > $bestDays) {
                $bestDays = $days;
                $bestSeason = $season;
                $bestYear = (int)$year;
            }
        }
    }
    if ($bestDays < 0) {
        return season_year_from_date($start);
    }
    return [$bestSeason, $bestYear];
}

function normalize_summary(DateTimeImmutable $start, DateTimeImmutable $end, int $pages): string
{
    $pageCount = max(1, $pages);
    return $start->format('Y-m-d') . ' to ' . $end->format('Y-m-d') . ' (' . $pageCount . ' pages)';
}

$opts = parse_args($argv ?? []);
$apply = (bool)$opts['apply'];
$dbEnv = (string)$opts['db_env'];

try {
    $pdo = connect_db($dbEnv);
} catch (Throwable $e) {
    fwrite(STDERR, "DB connect failed: {$e->getMessage()}\n");
    exit(1);
}

$tableExistsStmt = $pdo->prepare(
    "SELECT 1
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'photo_albums'
      LIMIT 1"
);
$tableExistsStmt->execute();
if (!$tableExistsStmt->fetch(PDO::FETCH_ASSOC)) {
    fwrite(STDERR, "photo_albums table not found in selected database\n");
    exit(1);
}

$rowsStmt = $pdo->query(
    "SELECT id, title, summary, spec_json, created_at
       FROM photo_albums
      WHERE title LIKE 'Violet''s 3rd Year%'
      ORDER BY created_at ASC, id ASC"
);
$rows = $rowsStmt ? ($rowsStmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];

$updates = [];
$usedTitles = [];
foreach ($rows as $row) {
    $usedTitles[strtolower(trim((string)($row['title'] ?? '')))] = true;
}

foreach ($rows as $row) {
    $id = (int)($row['id'] ?? 0);
    $title = trim((string)($row['title'] ?? ''));
    $summary = trim((string)($row['summary'] ?? ''));
    $specJson = (string)($row['spec_json'] ?? '{}');
    if ($id <= 0 || $title === '') {
        continue;
    }
    if (!preg_match('/^Violet\'s\s+3rd\s+Year(?:\s+-\s+(Winter|Spring|Summer|Fall)(?:\s+[0-9]{4})?)?(?:\s+Part\s+[0-9]+)?$/i', $title)) {
        continue;
    }

    $range = range_from_summary($summary);
    if (!$range) {
        $range = range_from_spec($specJson);
    }
    if (!$range) {
        continue;
    }
    [$start, $end] = $range;
    [$season, $seasonYear] = dominant_season_year($start, $end);
    $baseTitle = "Violet's 3rd Year - {$season} {$seasonYear}";
    $candidate = $baseTitle;
    $suffix = 2;
    while (isset($usedTitles[strtolower($candidate)]) && strcasecmp($candidate, $title) !== 0) {
        $candidate = $baseTitle . ' Part ' . $suffix;
        $suffix += 1;
    }
    $usedTitles[strtolower($candidate)] = true;
    $pageCount = page_count_from_spec($specJson);
    $nextSummary = normalize_summary($start, $end, $pageCount);
    if (strcasecmp($title, $candidate) === 0 && $summary === $nextSummary) {
        continue;
    }
    $updates[] = [
        'id' => $id,
        'old_title' => $title,
        'new_title' => $candidate,
        'old_summary' => $summary,
        'new_summary' => $nextSummary,
    ];
}

$sqlParts = [];
foreach ($updates as $update) {
    $sqlParts[] = sprintf(
        "UPDATE photo_albums SET title = %s, summary = %s, updated_at = NOW() WHERE id = %d;",
        quote_sql((string)$update['new_title']),
        quote_sql((string)$update['new_summary']),
        (int)$update['id']
    );
}
$sqlArtifact = write_sql_artifact(implode("\n", $sqlParts) . "\n");

$summary = [
    'success' => true,
    'mode' => $apply ? 'apply' : 'dry-run',
    'db_env' => $dbEnv,
    'rows_scanned' => count($rows),
    'rows_to_update' => count($updates),
    'sql_artifact' => $sqlArtifact,
    'sample' => array_slice($updates, 0, 80),
];

if (!$apply || !$updates) {
    echo json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
    exit(0);
}

try {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('UPDATE photo_albums SET title = ?, summary = ?, updated_at = NOW() WHERE id = ?');
    foreach ($updates as $update) {
        $stmt->execute([(string)$update['new_title'], (string)$update['new_summary'], (int)$update['id']]);
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
