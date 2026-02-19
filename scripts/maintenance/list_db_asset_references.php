<?php
// scripts/maintenance/list_db_asset_references.php
// Outputs a JSON array of image/file basenames referenced in the database.
// Best-effort: scans tables/columns whose names suggest image paths.
// Safe to run when DB is unavailable: prints [] silently.

header('Content-Type: application/json');

$ROOT = dirname(__DIR__, 2);
$basenames = [];

function push_basename(&$set, $val) {
    if (!is_string($val) || $val === '') return;
    // Extract basename from URLs or paths
    $val = trim($val);
    // Ignore obvious non-paths
    if (strpos($val, '.') === false) return;
    $bn = basename(parse_url($val, PHP_URL_PATH) ?: $val);
    if ($bn && preg_match('/\.(png|jpe?g|webp|gif|svg|bmp|ico|css|js)$/i', $bn)) {
        $set[strtolower($bn)] = true;
    }
}

try {
    // Prefer centralized config / Database singleton
    $cfg = $ROOT . '/api/config.php';
    if (file_exists($cfg)) require_once $cfg;
    if (!class_exists('Database')) throw new Exception('No Database class');
    $db = Database::getInstance();
    if (!method_exists($db, 'query')) throw new Exception('DB missing query method');

    // Discover candidate tables/columns
    $candidates = [];
    $patterns = ['image', 'thumbnail', 'photo', 'picture', 'bg', 'background', 'logo', 'icon', 'filepath', 'filename'];

    // Determine current database/schema name
    $schemaName = '';
    try {
        $res = $db->query('SELECT DATABASE() AS dbname');
        if ($res && isset($res[0]['dbname'])) $schemaName = (string)$res[0]['dbname'];
    } catch (Throwable $e) {}

    if ($schemaName) {
        $cols = $db->query(
            'SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND DATA_TYPE IN ("varchar","text","mediumtext","longtext")',
            [$schemaName]
        );
        foreach ($cols as $row) {
            $col = strtolower((string)$row['COLUMN_NAME']);
            foreach ($patterns as $p) {
                if (strpos($col, $p) !== false) {
                    $candidates[] = [$row['TABLE_NAME'], $row['COLUMN_NAME']];
                    break;
                }
            }
        }
    }

    // Fallback heuristics if information schema failed
    if (!$candidates) {
        $fallback = [
            ['items', 'image'], ['items', 'thumbnail'], ['items', 'primaryImage'],
            ['item_images', 'filename'], ['item_images', 'path'],
            ['room_settings', 'background_image'], ['business_settings', 'logo_path']
        ];
        foreach ($fallback as $pair) $candidates[] = $pair;
    }

    // Query distinct values and collect basenames
    $seen = [];
    foreach ($candidates as [$table, $column]) {
        try {
            $rows = $db->query("SELECT DISTINCT `$column` AS val FROM `$table` WHERE `$column` IS NOT NULL AND `$column` <> '' LIMIT 20000");
            foreach ($rows as $r) push_basename($seen, (string)$r['val']);
        } catch (Throwable $e) {
            // Ignore missing tables/columns
        }
    }

    $basenames = array_keys($seen);
} catch (Throwable $e) {
    // Silent fallback: no DB or errors -> empty list
    $basenames = [];
}

echo json_encode(array_values($basenames));
