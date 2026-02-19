<?php
// Purge invalid/unused Main (room 0) backgrounds that cannot be deleted via UI
// Criteria: room_number = '0', is_active = 0, background_name != 'Original', and
// all referenced files (image_filename/png_filename/webp_filename) are missing or empty.

require_once dirname(__DIR__, 2) . '/api/config.php';

function join_path(...$parts){ return preg_replace('#/+#','/', join('/', $parts)); }

try { Database::getInstance(); } catch (Throwable $e) { fwrite(STDERR, "DB connect failed: ".$e->getMessage()."\n"); exit(1);} 

$imagesRoot = realpath(dirname(__DIR__, 2) . '/images');
if ($imagesRoot === false) { $imagesRoot = dirname(__DIR__, 2) . '/images'; }

$rows = Database::queryAll("SELECT id, background_name, image_filename, png_filename, webp_filename, is_active FROM backgrounds WHERE room_number = '0'");
if (!$rows) { echo "No Main (room 0) backgrounds found.\n"; exit(0); }

$toDelete = [];
foreach ($rows as $r) {
    $id = (int)$r['id'];
    $name = (string)($r['background_name'] ?? '');
    $active = (int)($r['is_active'] ?? 0);
    if ($active === 1) continue; // Never purge active
    if (strcasecmp($name, 'Original') === 0) continue; // Never purge Original

    $files = [];
    foreach (['image_filename','png_filename','webp_filename'] as $k) {
        $rel = trim((string)($r[$k] ?? ''));
        if ($rel === '') continue;
        $rel = ltrim($rel, '/');
        $abs = (strpos($rel, 'images/') === 0) ? join_path(dirname(__DIR__, 2), $rel) : join_path($imagesRoot, $rel);
        $files[] = $abs;
    }
    $existsAny = false;
    foreach ($files as $p) { if (is_file($p)) { $existsAny = true; break; } }
    if (!$existsAny) { $toDelete[] = $id; }
}

if (empty($toDelete)) { echo "No invalid/unused Main backgrounds matched purge criteria.\n"; exit(0); }

try {
    Database::beginTransaction();
    $in = implode(',', array_fill(0, count($toDelete), '?'));
    Database::execute("DELETE FROM backgrounds WHERE id IN ($in)", $toDelete);
    Database::commit();
    echo "Purged ".count($toDelete)." invalid Main background(s): IDs [".implode(',', $toDelete)."].\n";
} catch (Throwable $e) {
    Database::rollBack();
    fwrite(STDERR, "Purge failed: ".$e->getMessage()."\n");
    exit(1);
}
