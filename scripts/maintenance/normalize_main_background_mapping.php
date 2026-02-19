<?php
// Normalize Main (room 0) background mapping so there is exactly one row
// pointing at background-room0.png/.webp, named 'Original', active, and in room_number '0'.

require_once dirname(__DIR__, 2) . '/api/config.php';

function pjoin(...$parts){ return preg_replace('#/+#','/', join('/', $parts)); }

try {
    Database::getInstance();
} catch (Throwable $e) {
    fwrite(STDERR, "DB connection failed: " . $e->getMessage() . "\n");
    exit(1);
}

$imagesRoot = realpath(dirname(__DIR__, 2) . '/images');
if ($imagesRoot === false) { $imagesRoot = dirname(__DIR__, 2) . '/images'; }

$pngRel = 'backgrounds/background-room0.png';
$webpRel = 'backgrounds/background-room0.webp';
$pngAbs = pjoin($imagesRoot, $pngRel);
$webpAbs = pjoin($imagesRoot, $webpRel);
$pngExists = is_file($pngAbs);
$webpExists = is_file($webpAbs);

// Load candidate rows: room 0 or legacy null/empty that reference background-room0.* in any field
$rows = Database::queryAll("SELECT id, room_number, background_name, image_filename, png_filename, webp_filename, is_active, created_at 
    FROM backgrounds WHERE (room_number = '0' OR room_number IS NULL OR room_number = '')");

$candidates = [];
foreach ($rows as $r) {
    $f1 = strtolower((string)($r['image_filename'] ?? ''));
    $f2 = strtolower((string)($r['png_filename'] ?? ''));
    $f3 = strtolower((string)($r['webp_filename'] ?? ''));
    if (strpos($f1, 'background-room0.png') !== false
        || strpos($f2, 'background-room0.png') !== false
        || strpos($f3, 'background-room0.webp') !== false) {
        $candidates[] = $r;
    }
}

// If no candidates and at least one file exists, optionally create a single mapping
if (count($candidates) === 0 && ($pngExists || $webpExists)) {
    Database::execute(
        "INSERT INTO backgrounds (room_number, background_name, image_filename, png_filename, webp_filename, is_active) VALUES ('0', 'Original', ?, ?, ?, 1)",
        [
            $pngExists ? $pngRel : '',
            $pngExists ? $pngRel : '',
            $webpExists ? $webpRel : ''
        ]
    );
    echo "Created Main (0) Original mapping -> background-room0.*\n";
    exit(0);
}

if (count($candidates) === 0) {
    echo "No candidates found and no background-room0.* files present. Nothing to do.\n";
    exit(0);
}

// Keep the newest by id
usort($candidates, function($a,$b){ return ($b['id'] ?? 0) <=> ($a['id'] ?? 0); });
$keep = $candidates[0];
$keepId = (int)$keep['id'];

try {
    Database::beginTransaction();

    // Update the keeper row to be canonical
    Database::execute(
        "UPDATE backgrounds SET room_number='0', background_name='Original', image_filename=?, png_filename=?, webp_filename=?, is_active=1, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        [
            $pngExists ? $pngRel : ($keep['image_filename'] ?? ''),
            $pngExists ? $pngRel : ($keep['png_filename'] ?? ''),
            $webpExists ? $webpRel : ($keep['webp_filename'] ?? ''),
            $keepId
        ]
    );

    // Delete other candidate rows
    $idsToDelete = array_map(function($r){ return (int)$r['id']; }, array_slice($candidates, 1));
    if (!empty($idsToDelete)) {
        $in = implode(',', array_fill(0, count($idsToDelete), '?'));
        Database::execute("DELETE FROM backgrounds WHERE id IN ($in)", $idsToDelete);
    }

    // Deactivate any other active rows in room 0 that aren't the keeper
    Database::execute("UPDATE backgrounds SET is_active = 0 WHERE room_number = '0' AND id <> ?", [$keepId]);

    Database::commit();
    echo "Normalized Main (0) mapping to a single 'Original' row (id=$keepId).\n";
} catch (Throwable $e) {
    Database::rollBack();
    fwrite(STDERR, "Normalization failed: " . $e->getMessage() . "\n");
    exit(1);
}
