<?php
// Utility to inspect and dedupe room_settings without direct SQL console access.
// Usage: /scripts/maintenance/room_settings_cleanup.php?action=report
//        /scripts/maintenance/room_settings_cleanup.php?action=dedupe&dry=1
//        /scripts/maintenance/room_settings_cleanup.php?action=dedupe&dry=0&keep=max
// NOTE: Requires admin authentication. Always test with dry=1 first.

require_once __DIR__ . '/../../api/config.php';
require_once __DIR__ . '/../../includes/functions.php';
require_once __DIR__ . '/../../includes/auth.php';

// Strict admin requirement; no token or bypass
if (class_exists('Auth')) {
    Auth::requireAdmin(true); // return JSON 401/403 instead of redirect
} elseif (function_exists('requireAdmin')) {
    requireAdmin(true);
}

header('Content-Type: application/json');

function out($payload, int $status = 200) {
    http_response_code($status);
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

$action = $_GET['action'] ?? 'report';
$dry    = !isset($_GET['dry']) || $_GET['dry'] !== '0'; // default dry-run on
$keep   = strtolower($_GET['keep'] ?? 'max'); // which id to keep in dedupe: max (newest) or min (oldest)

try {
    Database::getInstance();
} catch (Exception $e) {
    out(['success' => false, 'error' => 'DB connect failed', 'details' => $e->getMessage()], 500);
}

if ($action === 'report') {
    try {
        $rooms = Database::queryAll("SELECT * FROM room_settings ORDER BY display_order, room_number");
        $dupes = Database::queryAll("SELECT room_number, COUNT(*) c FROM room_settings GROUP BY room_number HAVING c > 1");
        out([
            'success' => true,
            'mode'    => 'report',
            'duplicates' => $dupes,
            'total_rooms' => count($rooms),
            'rooms' => $rooms,
        ]);
    } catch (Exception $e) {
        out(['success' => false, 'error' => 'Query failed', 'details' => $e->getMessage()], 500);
    }
}

if ($action === 'dedupe') {
    if (!in_array($keep, ['min', 'max'], true)) {
        out(['success' => false, 'error' => "Invalid keep value; use 'min' or 'max'"] , 400);
    }

    $aggFn = $keep === 'min' ? 'MIN' : 'MAX';
    try {
        $candidates = Database::queryAll(
            "SELECT room_number, {$aggFn}(id) AS keep_id, GROUP_CONCAT(id ORDER BY id) AS all_ids, COUNT(*) AS c
             FROM room_settings
             GROUP BY room_number
             HAVING c > 1"
        );

        if (empty($candidates)) {
            out(['success' => true, 'mode' => 'dedupe', 'message' => 'No duplicates found', 'dry_run' => $dry]);
        }

        // Build delete list
        $deleteIds = [];
        foreach ($candidates as $row) {
            $allIds = array_filter(array_map('intval', explode(',', $row['all_ids'] ?? '')));
            foreach ($allIds as $id) {
                if ($id !== (int)$row['keep_id']) {
                    $deleteIds[] = $id;
                }
            }
        }

        if ($dry) {
            out([
                'success' => true,
                'mode' => 'dedupe',
                'dry_run' => true,
                'keep_strategy' => $keep,
                'candidates' => $candidates,
                'delete_ids' => $deleteIds,
            ]);
        }

        if (!empty($deleteIds)) {
            $placeholders = implode(',', array_fill(0, count($deleteIds), '?'));
            Database::execute("DELETE FROM room_settings WHERE id IN ({$placeholders})", $deleteIds);
        }

        $remaining = Database::queryAll("SELECT room_number, id FROM room_settings ORDER BY room_number, id");

        out([
            'success' => true,
            'mode' => 'dedupe',
            'dry_run' => false,
            'keep_strategy' => $keep,
            'deleted_ids' => $deleteIds,
            'remaining' => $remaining,
        ]);
    } catch (Exception $e) {
        out(['success' => false, 'error' => 'Dedupe failed', 'details' => $e->getMessage()], 500);
    }
}

out(['success' => false, 'error' => 'Invalid action'], 400);
