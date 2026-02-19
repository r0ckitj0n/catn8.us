<?php
// Hard purge legacy/invalid Main (room 0) backgrounds, even if named 'Original'.
// Criteria for deletion:
//  - room_number = '0'
//  - AND (all referenced files are missing OR filename contains background-home/background-room-main)
//  - AND id != the canonical keeper (active mapping to background-room0.* if present)

require_once dirname(__DIR__, 2) . '/api/config.php';

function jp(...$parts){ return preg_replace('#/+#','/', join('/', $parts)); }

try { Database::getInstance(); } catch (Throwable $e) { fwrite(STDERR, "DB connect failed: ".$e->getMessage()."\n"); exit(1);} 

$imagesRoot = realpath(dirname(__DIR__, 2) . '/images');
if ($imagesRoot === false) { $imagesRoot = dirname(__DIR__, 2) . '/images'; }

// Identify canonical keeper: active row in room 0 that points to background-room0.*
$keeper = Database::queryOne("SELECT id FROM backgrounds WHERE room_number='0' AND is_active=1 AND (
  LOWER(COALESCE(image_filename,'')) LIKE '%background-room0.%' OR
  LOWER(COALESCE(png_filename,'')) LIKE '%background-room0.%' OR
  LOWER(COALESCE(webp_filename,'')) LIKE '%background-room0.%'
) ORDER BY id DESC LIMIT 1");
$keeperId = $keeper ? (int)$keeper['id'] : 0;

$rows = Database::queryAll("SELECT id, background_name, image_filename, png_filename, webp_filename, is_active FROM backgrounds WHERE room_number = '0'");
$delIds = [];
foreach ($rows as $r) {
  $id = (int)$r['id'];
  if ($keeperId && $id === $keeperId) continue; // never delete keeper
  $f1 = strtolower((string)($r['image_filename'] ?? ''));
  $f2 = strtolower((string)($r['png_filename'] ?? ''));
  $f3 = strtolower((string)($r['webp_filename'] ?? ''));
  $flagLegacyName = (strpos($f1, 'background-home') !== false) || (strpos($f2, 'background-home') !== false) || (strpos($f3, 'background-home') !== false)
                 || (strpos($f1, 'background-room-main') !== false) || (strpos($f2, 'background-room-main') !== false) || (strpos($f3, 'background-room-main') !== false);
  // File existence check
  $paths = [];
  foreach ([$f1, $f2, $f3] as $rel) {
    if ($rel === '') continue;
    $rel = ltrim($rel, '/');
    $abs = (strpos($rel, 'images/') === 0) ? jp(dirname(__DIR__, 2), $rel) : jp($imagesRoot, $rel);
    $paths[] = $abs;
  }
  $existsAny = false;
  foreach ($paths as $p) { if (is_file($p)) { $existsAny = true; break; } }
  // Delete if legacy name OR all missing
  if ($flagLegacyName || !$existsAny) {
    $delIds[] = $id;
  }
}

if (empty($delIds)) { echo "Nothing to delete.\n"; exit(0); }

try {
  Database::beginTransaction();
  $in = implode(',', array_fill(0, count($delIds), '?'));
  Database::execute("DELETE FROM backgrounds WHERE id IN ($in)", $delIds);
  Database::commit();
  echo "Deleted IDs [".implode(',', $delIds)."].\n";
} catch (Throwable $e) {
  Database::rollBack();
  fwrite(STDERR, "Hard purge failed: ".$e->getMessage()."\n");
  exit(1);
}
