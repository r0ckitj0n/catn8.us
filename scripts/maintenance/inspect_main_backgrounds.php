<?php
// Inspect Main (room 0) backgrounds and report file existence and basic fields
require_once dirname(__DIR__, 2) . '/api/config.php';

function jp(...$parts){ return preg_replace('#/+#','/', join('/', $parts)); }

try { Database::getInstance(); } catch (Throwable $e) { fwrite(STDERR, "DB connect failed: ".$e->getMessage()."\n"); exit(1);} 

$imagesRoot = realpath(dirname(__DIR__, 2) . '/images');
if ($imagesRoot === false) { $imagesRoot = dirname(__DIR__, 2) . '/images'; }

$rows = Database::queryAll("SELECT id, room_number, background_name, is_active, image_filename, png_filename, webp_filename, created_at FROM backgrounds WHERE room_number = '0' ORDER BY id DESC");
if (!$rows) { echo "No rows for room 0.\n"; exit(0);} 

foreach ($rows as $r) {
    $id = (int)$r['id'];
    $name = (string)($r['background_name'] ?? '');
    $active = (int)($r['is_active'] ?? 0);
    $files = [
        'image_filename' => $r['image_filename'] ?? '',
        'png_filename'   => $r['png_filename'] ?? '',
        'webp_filename'  => $r['webp_filename'] ?? ''
    ];
    $status = [];
    foreach ($files as $k => $rel) {
        $rel = ltrim((string)$rel, '/');
        if ($rel === '') { $status[$k] = 'EMPTY'; continue; }
        $abs = (strpos($rel, 'images/') === 0) ? jp(dirname(__DIR__, 2), $rel) : jp($imagesRoot, $rel);
        $status[$k] = is_file($abs) ? 'OK' : 'MISSING';
    }
    echo "ID=$id name='".($name)."' active=$active room='".($r['room_number'])."'" . "\n";
    echo "  image= " . ($r['image_filename'] ?? '') . " [".$status['image_filename']."]\n";
    echo "  png=   " . ($r['png_filename'] ?? '') . " [".$status['png_filename']."]\n";
    echo "  webp=  " . ($r['webp_filename'] ?? '') . " [".$status['webp_filename']."]\n";
}
