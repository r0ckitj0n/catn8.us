<?php

declare(strict_types=1);

/**
 * Fabric8 → Apple Reminders / ICS / CalDAV sync kill-switch.
 *
 * Historical note (2026-07-28 ~23:18 ET): 89 Apple Reminders were created in
 * "Cabin Build Tasks" within ~30s, each with note "catn8-event-<step_id>"
 * matching build_wizard_steps.id. No VTODO/CalDAV/ICS publisher remains in the
 * live catn8.us tree; Compil8r m8rix still referenced fabric8r scheduler_sync /
 * helper-reminder jobs. This module keeps any feed/push gated OFF by default.
 */

function fabric8_reminders_sync_enabled(): bool
{
    $raw = trim((string)catn8_env('FABRIC8_REMINDERS_SYNC_ENABLED', '0'));
    if ($raw === '') {
        return false;
    }
    return in_array(strtolower($raw), ['1', 'true', 'yes', 'on'], true);
}

function fabric8_reminders_sync_event_note(int $stepId): string
{
    return 'catn8-event-' . max(0, $stepId);
}

/**
 * Reject sync/feed requests when the kill-switch is off.
 * @return never
 */
function fabric8_reminders_sync_reject_disabled(string $via = 'feed'): void
{
    $payload = [
        'success' => false,
        'error' => 'Fabric8 Reminders/ICS sync is disabled',
        'enabled' => false,
        'flag' => 'FABRIC8_REMINDERS_SYNC_ENABLED',
        'via' => $via,
    ];
    if (!headers_sent()) {
        http_response_code(410);
        header('Content-Type: application/json; charset=UTF-8');
        header('Cache-Control: no-store');
        header('X-Fabric8-Reminders-Sync: disabled');
    }
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}
