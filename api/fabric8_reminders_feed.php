<?php

declare(strict_types=1);

/**
 * Fabric8 ICS / Reminders feed endpoint.
 * Default: disabled (410). Enable only with FABRIC8_REMINDERS_SYNC_ENABLED=1.
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/fabric8_reminders_sync.php';

if (!fabric8_reminders_sync_enabled()) {
    fabric8_reminders_sync_reject_disabled('fabric8_reminders_feed');
}

// Intentionally no active publisher: even when the flag is on, refuse until a
// deliberate feed implementation is restored. This prevents accidental re-enable.
http_response_code(501);
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
header('X-Fabric8-Reminders-Sync: enabled-but-unpublished');
echo json_encode([
    'success' => false,
    'error' => 'Fabric8 Reminders/ICS publisher is not implemented; sync stays off',
    'enabled' => true,
], JSON_UNESCAPED_SLASHES);
