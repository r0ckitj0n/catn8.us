<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/config.php';

function bw_cleanup_usage(): void
{
    echo "Usage:\n";
    echo "  php scripts/maintenance/cleanup_build_wizard_import_artifacts.php [--apply] [--db-env=local|live|current]\n";
    echo "\n";
    echo "Notes:\n";
    echo "  - Dry-run by default.\n";
    echo "  - Cleans import-artifact text from build_wizard_steps.title, description, purchase_category, source_ref.\n";
}

function bw_cleanup_parse_args(array $argv): array
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
            bw_cleanup_usage();
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

function bw_cleanup_connect(string $dbEnv): PDO
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

function bw_cleanup_needs_cleaning(string $raw): bool
{
    if ($raw === '') {
        return false;
    }

    if (preg_match('/\.(xlsx|xls|csv)\b/i', $raw)) {
        return true;
    }
    if (preg_match('/\b(current\s+plan|past|future)\b\s*[<>]\s*\d{2,14}\b/i', $raw)) {
        return true;
    }
    if (preg_match('/>\s*(current\s+plan|past|future)\b/i', $raw)) {
        return true;
    }
    if (preg_match('/\bpurchase item from\b/i', $raw)) {
        return true;
    }

    return false;
}

function bw_cleanup_sanitize_artifact_text(?string $value): ?string
{
    $raw = trim((string)($value ?? ''));
    if ($raw === '' || !bw_cleanup_needs_cleaning($raw)) {
        return $raw === '' ? null : $raw;
    }

    $cleaned = $raw;
    $cleaned = (string)preg_replace('/\b[\w .-]+\.(xlsx|xls|csv)\b\s*>\s*/i', ' ', $cleaned);
    $cleaned = (string)preg_replace('/\bpurchase item from\b/i', ' ', $cleaned);
    $cleaned = (string)preg_replace('/\b(current\s+plan|past|future)\b(\s*[<>]\s*\d{2,14})?/i', ' ', $cleaned);
    $cleaned = (string)preg_replace('/\s*[<>]\s*\d{2,14}\b/', ' ', $cleaned);
    $cleaned = (string)preg_replace('/\s*>\s*/', ' ', $cleaned);
    $cleaned = (string)preg_replace('/\s*\|\s*/', ' ', $cleaned);
    $cleaned = (string)preg_replace('/\s+\./', '.', $cleaned);
    $cleaned = (string)preg_replace('/\s{2,}/', ' ', $cleaned);
    $cleaned = trim((string)preg_replace('/^[\s\-:|>]+|[\s\-:|>]+$/', '', $cleaned));
    $cleaned = trim((string)preg_replace('/\s*[.]+$/', '', $cleaned));

    return $cleaned === '' ? null : $cleaned;
}

function bw_cleanup_fallback_step_title(string $stepType): string
{
    $t = strtolower(trim($stepType));
    if ($t === 'purchase') {
        return 'Purchase Item';
    }
    if ($t === 'utility') {
        return 'Utility Task';
    }
    if ($t === 'delivery') {
        return 'Delivery Task';
    }
    return 'Project Step';
}

function bw_cleanup_sanitize_step_title(?string $title, string $stepType): ?string
{
    $raw = trim((string)($title ?? ''));
    if ($raw === '') {
        return null;
    }

    $cleaned = bw_cleanup_sanitize_artifact_text($raw);
    if ($cleaned !== null && trim($cleaned) !== '') {
        return $cleaned;
    }

    return bw_cleanup_fallback_step_title($stepType);
}

$opts = bw_cleanup_parse_args($argv ?? []);
$apply = (bool)$opts['apply'];
$dbEnv = (string)$opts['db_env'];

try {
    $pdo = bw_cleanup_connect($dbEnv);
} catch (Throwable $e) {
    fwrite(STDERR, "DB connect failed: {$e->getMessage()}\n");
    exit(1);
}

$dbNameRow = $pdo->query('SELECT DATABASE() AS db_name')->fetch(PDO::FETCH_ASSOC);
$dbName = (string)($dbNameRow['db_name'] ?? '');

$rowsStmt = $pdo->query(
    "SELECT id, step_type, title, description, purchase_category, source_ref
     FROM build_wizard_steps
     WHERE COALESCE(title, '') LIKE '%>%'
        OR COALESCE(title, '') LIKE '%.xlsx%'
        OR COALESCE(title, '') LIKE '%.xls%'
        OR COALESCE(title, '') LIKE '%.csv%'
        OR COALESCE(title, '') LIKE '%Purchase item from%'
        OR COALESCE(description, '') LIKE '%>%'
        OR COALESCE(description, '') LIKE '%Purchase item from%'
        OR COALESCE(purchase_category, '') LIKE '%<%'
        OR COALESCE(purchase_category, '') LIKE '%>%'
        OR COALESCE(source_ref, '') LIKE '%<%'
        OR COALESCE(source_ref, '') LIKE '%>%'
        OR COALESCE(source_ref, '') LIKE '%.xlsx%'
        OR COALESCE(source_ref, '') LIKE '%.xls%'
        OR COALESCE(source_ref, '') LIKE '%.csv%'"
);
$rows = $rowsStmt ? ($rowsStmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];

$toUpdate = [];
$samples = [];

foreach ($rows as $row) {
    $id = (int)($row['id'] ?? 0);
    if ($id <= 0) {
        continue;
    }

    $nextTitle = bw_cleanup_sanitize_step_title($row['title'] ?? null, (string)($row['step_type'] ?? ''));
    $nextDescription = bw_cleanup_sanitize_artifact_text($row['description'] ?? null);
    $nextCategory = bw_cleanup_sanitize_artifact_text($row['purchase_category'] ?? null);
    $nextSourceRef = bw_cleanup_sanitize_artifact_text($row['source_ref'] ?? null);

    $currentTitle = trim((string)($row['title'] ?? ''));
    $currentDescription = trim((string)($row['description'] ?? ''));
    $currentCategory = trim((string)($row['purchase_category'] ?? ''));
    $currentSourceRef = trim((string)($row['source_ref'] ?? ''));

    $changed = (
        ((string)($nextTitle ?? '') !== $currentTitle)
        || ((string)($nextDescription ?? '') !== $currentDescription)
        || ((string)($nextCategory ?? '') !== $currentCategory)
        || ((string)($nextSourceRef ?? '') !== $currentSourceRef)
    );

    if (!$changed) {
        continue;
    }

    $toUpdate[] = [
        'id' => $id,
        'title' => $nextTitle,
        'description' => $nextDescription,
        'purchase_category' => $nextCategory,
        'source_ref' => $nextSourceRef,
    ];

    if (count($samples) < 30) {
        $samples[] = [
            'id' => $id,
            'before' => [
                'title' => $row['title'] ?? null,
                'description' => $row['description'] ?? null,
                'purchase_category' => $row['purchase_category'] ?? null,
                'source_ref' => $row['source_ref'] ?? null,
            ],
            'after' => [
                'title' => $nextTitle,
                'description' => $nextDescription,
                'purchase_category' => $nextCategory,
                'source_ref' => $nextSourceRef,
            ],
        ];
    }
}

$updatedRows = 0;
if ($apply && $toUpdate) {
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare(
            'UPDATE build_wizard_steps
             SET title = ?, description = ?, purchase_category = ?, source_ref = ?
             WHERE id = ?'
        );
        foreach ($toUpdate as $entry) {
            $stmt->execute([
                $entry['title'],
                $entry['description'],
                $entry['purchase_category'],
                $entry['source_ref'],
                $entry['id'],
            ]);
            $updatedRows += $stmt->rowCount();
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

$result = [
    'success' => true,
    'mode' => $apply ? 'apply' : 'dry-run',
    'db_env' => $dbEnv,
    'database' => $dbName,
    'candidate_rows_scanned' => count($rows),
    'rows_needing_update' => count($toUpdate),
    'rows_updated' => $updatedRows,
    'sample' => $samples,
];

echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . PHP_EOL;
