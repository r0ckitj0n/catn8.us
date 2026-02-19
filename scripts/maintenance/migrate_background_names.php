<?php
// Migration: Rename legacy background filenames and update DB references.
// Also seed Shop (S) and Settings (SET) backgrounds if files exist.

require_once dirname(__DIR__, 2) . '/api/config.php';

function path_join(...$parts){ return preg_replace('#/+#','/',join('/', $parts)); }

try {
    Database::getInstance();
} catch (Throwable $e) {
    fwrite(STDERR, "DB connection failed: " . $e->getMessage() . "\n");
    exit(1);
}

$imagesRoot = realpath(dirname(__DIR__, 2) . '/images');
if ($imagesRoot === false) {
    $imagesRoot = dirname(__DIR__, 2) . '/images';
}
$bgDir = path_join($imagesRoot, 'backgrounds');

$mappings = [
    // old => new
    'background-home.png' => 'background-roomA.png',
    'background-home.webp' => 'background-roomA.webp',
    'background-room-main.png' => 'background-room0.png',
    'background-room-main.webp' => 'background-room0.webp',
    // Normalize legacy shop/settings filenames to new schema
    'background-shop.png' => 'background-roomS.png',
    'background-shop.webp' => 'background-roomS.webp',
    'background-settings.png' => 'background-roomX.png',
    'background-settings.webp' => 'background-roomX.webp',
];

$renamed = [];
foreach ($mappings as $old => $new) {
    $oldAbs = path_join($bgDir, $old);
    $newAbs = path_join($bgDir, $new);
    if (is_file($oldAbs)) {
        if (!is_file($newAbs)) {
            if (@rename($oldAbs, $newAbs)) {
                $renamed[] = "$old -> $new";
            } else {
                // Fallback: copy + unlink
                if (@copy($oldAbs, $newAbs)) { @unlink($oldAbs); $renamed[] = "$old -> $new (copied)"; }
            }
        }
    }
}

// Update DB references in backgrounds table
foreach ($mappings as $old => $new) {
    $oldRel1 = 'backgrounds/' . $old;                   // e.g., backgrounds/background-home.png
    $oldRel2 = 'images/backgrounds/' . $old;            // e.g., images/backgrounds/background-home.png
    $newRel = 'backgrounds/' . $new;
    // image_filename
    Database::execute("UPDATE backgrounds SET image_filename = REPLACE(image_filename, ?, ?)", [$oldRel1, $newRel]);
    Database::execute("UPDATE backgrounds SET image_filename = REPLACE(image_filename, ?, ?)", [$oldRel2, $newRel]);
    // png_filename
    Database::execute("UPDATE backgrounds SET png_filename = REPLACE(png_filename, ?, ?)", [$oldRel1, $newRel]);
    Database::execute("UPDATE backgrounds SET png_filename = REPLACE(png_filename, ?, ?)", [$oldRel2, $newRel]);
    // webp_filename
    Database::execute("UPDATE backgrounds SET webp_filename = REPLACE(webp_filename, ?, ?)", [$oldRel1, $newRel]);
    Database::execute("UPDATE backgrounds SET webp_filename = REPLACE(webp_filename, ?, ?)", [$oldRel2, $newRel]);
}

// Move legacy Landing rows stored under room 0 to room 'A' if filenames indicate background-roomA
Database::execute(
    "UPDATE backgrounds SET room_number = 'A' WHERE room_number = '0' AND (
        LOWER(COALESCE(image_filename,'')) LIKE ? OR LOWER(COALESCE(png_filename,'')) LIKE ? OR LOWER(COALESCE(webp_filename,'')) LIKE ?
    )",
    ['%background-roomA%', '%background-roomA%', '%background-roomA%']
);

// Seed Landing (A) from files if no row exists
$aPng = 'backgrounds/background-roomA.png';
$aWebp = 'backgrounds/background-roomA.webp';
$hasA = is_file(path_join($imagesRoot, $aPng)) || is_file(path_join($imagesRoot, $aWebp));
if ($hasA) {
    $r = Database::queryOne("SELECT id FROM backgrounds WHERE room_number = 'A' LIMIT 1");
    if (!$r) {
        $img = is_file(path_join($imagesRoot, $aPng)) ? $aPng : ($aWebp ?: '');
        Database::execute(
            "INSERT INTO backgrounds (room_number, background_name, image_filename, png_filename, webp_filename, is_active) VALUES ('A', ?, ?, ?, ?, 1)",
            ['Landing Default', $img, is_file(path_join($imagesRoot, $aPng)) ? $aPng : '', is_file(path_join($imagesRoot, $aWebp)) ? $aWebp : '']
        );
    }
}

// Seed Main (0) from files if no row exists
$mPng = 'backgrounds/background-room0.png';
$mWebp = 'backgrounds/background-room0.webp';
$hasM = is_file(path_join($imagesRoot, $mPng)) || is_file(path_join($imagesRoot, $mWebp));
if ($hasM) {
    $r = Database::queryOne("SELECT id FROM backgrounds WHERE room_number = '0' LIMIT 1");
    if (!$r) {
        $img = is_file(path_join($imagesRoot, $mPng)) ? $mPng : ($mWebp ?: '');
        Database::execute(
            "INSERT INTO backgrounds (room_number, background_name, image_filename, png_filename, webp_filename, is_active) VALUES ('0', ?, ?, ?, ?, 1)",
            ['Main Default', $img, is_file(path_join($imagesRoot, $mPng)) ? $mPng : '', is_file(path_join($imagesRoot, $mWebp)) ? $mWebp : '']
        );
    }
}

// Seed Shop (S)
// Prefer new schema filenames background-roomS.*; fall back to legacy background-shop.*
$shopPngNew = 'backgrounds/background-roomS.png';
$shopWebpNew = 'backgrounds/background-roomS.webp';
$shopPngOld = 'backgrounds/background-shop.png';
$shopWebpOld = 'backgrounds/background-shop.webp';
$shopHas =
    is_file(path_join($imagesRoot, $shopPngNew)) ||
    is_file(path_join($imagesRoot, $shopWebpNew)) ||
    is_file(path_join($imagesRoot, $shopPngOld)) ||
    is_file(path_join($imagesRoot, $shopWebpOld));
if ($shopHas) {
    $r = Database::queryOne("SELECT id FROM backgrounds WHERE room_number = 'S' LIMIT 1");
    if (!$r) {
        // pick best available file with preference: new png > new webp > old png > old webp
        $img = is_file(path_join($imagesRoot, $shopPngNew)) ? $shopPngNew
             : (is_file(path_join($imagesRoot, $shopWebpNew)) ? $shopWebpNew
             : (is_file(path_join($imagesRoot, $shopPngOld)) ? $shopPngOld
             : (is_file(path_join($imagesRoot, $shopWebpOld)) ? $shopWebpOld : '')));
        $png = is_file(path_join($imagesRoot, $shopPngNew)) ? $shopPngNew
             : (is_file(path_join($imagesRoot, $shopPngOld)) ? $shopPngOld : '');
        $webp = is_file(path_join($imagesRoot, $shopWebpNew)) ? $shopWebpNew
              : (is_file(path_join($imagesRoot, $shopWebpOld)) ? $shopWebpOld : '');
        Database::execute(
            "INSERT INTO backgrounds (room_number, background_name, image_filename, png_filename, webp_filename, is_active) VALUES ('S', ?, ?, ?, ?, 1)",
            ['Shop Default', $img, $png, $webp]
        );
    }
}

// Migrate any existing Settings rows from SET -> X
Database::execute("UPDATE backgrounds SET room_number = 'X' WHERE room_number = 'SET'");

// Seed Settings (X) if files exist
// Prefer new schema filenames background-roomX.*; fall back to legacy background-settings.*
$setPngNew = 'backgrounds/background-roomX.png';
$setWebpNew = 'backgrounds/background-roomX.webp';
$setPngOld = 'backgrounds/background-settings.png';
$setWebpOld = 'backgrounds/background-settings.webp';
$setHas =
    is_file(path_join($imagesRoot, $setPngNew)) ||
    is_file(path_join($imagesRoot, $setWebpNew)) ||
    is_file(path_join($imagesRoot, $setPngOld)) ||
    is_file(path_join($imagesRoot, $setWebpOld));
if ($setHas) {
    $r = Database::queryOne("SELECT id FROM backgrounds WHERE room_number = 'X' LIMIT 1");
    if (!$r) {
        $img = is_file(path_join($imagesRoot, $setPngNew)) ? $setPngNew
             : (is_file(path_join($imagesRoot, $setWebpNew)) ? $setWebpNew
             : (is_file(path_join($imagesRoot, $setPngOld)) ? $setPngOld
             : (is_file(path_join($imagesRoot, $setWebpOld)) ? $setWebpOld : '')));
        $png = is_file(path_join($imagesRoot, $setPngNew)) ? $setPngNew
             : (is_file(path_join($imagesRoot, $setPngOld)) ? $setPngOld : '');
        $webp = is_file(path_join($imagesRoot, $setWebpNew)) ? $setWebpNew
              : (is_file(path_join($imagesRoot, $setWebpOld)) ? $setWebpOld : '');
        Database::execute(
            "INSERT INTO backgrounds (room_number, background_name, image_filename, png_filename, webp_filename, is_active) VALUES ('X', ?, ?, ?, ?, 1)",
            ['Settings Default', $img, $png, $webp]
        );
    }
}

echo "Migration complete.\n";
if (!empty($renamed)) {
    echo "Renamed files:\n" . implode("\n", $renamed) . "\n";
}
?>
