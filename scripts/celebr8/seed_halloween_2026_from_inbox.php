<?php

declare(strict_types=1);

/**
 * Seed Annual Halloween Bash 2026 from local inbox CSVs.
 *
 * Reads personal guest data from CELEBR8_INBOX_DIR (default ~/celebr8-inbox).
 * Does NOT commit or print phone numbers.
 *
 * Usage:
 *   php scripts/celebr8/seed_halloween_2026_from_inbox.php
 *   php scripts/celebr8/seed_halloween_2026_from_inbox.php --via-api
 *   CELEBR8_INBOX_DIR=/path php scripts/celebr8/seed_halloween_2026_from_inbox.php --via-api
 *
 * --via-api uses the live agent API + local agent token file (no CSV data in git).
 */

require_once dirname(__DIR__, 2) . '/api/bootstrap.php';
require_once dirname(__DIR__, 2) . '/includes/celebr8_model.php';

function celebr8_seed_inbox_dir(): string
{
    $env = trim((string)(getenv('CELEBR8_INBOX_DIR') ?: ''));
    if ($env !== '') {
        return rtrim($env, '/');
    }
    return rtrim((string)getenv('HOME'), '/') . '/celebr8-inbox';
}

function celebr8_seed_read_csv(string $path): array
{
    if (!is_file($path)) {
        throw new RuntimeException('Missing CSV: ' . $path);
    }
    $fh = fopen($path, 'r');
    if ($fh === false) {
        throw new RuntimeException('Cannot open CSV: ' . $path);
    }
    $header = fgetcsv($fh, 0, ',', '"', '\\');
    if (!is_array($header) || $header === []) {
        fclose($fh);
        throw new RuntimeException('Empty CSV header: ' . $path);
    }
    $header = array_map(static fn($h) => trim((string)$h), $header);
    $rows = [];
    while (($row = fgetcsv($fh, 0, ',', '"', '\\')) !== false) {
        if ($row === [null] || $row === false) {
            continue;
        }
        if (count($row) < count($header)) {
            $row = array_pad($row, count($header), '');
        }
        $assoc = [];
        foreach ($header as $i => $key) {
            $assoc[$key] = trim((string)($row[$i] ?? ''));
        }
        if (implode('', $assoc) === '') {
            continue;
        }
        $rows[] = $assoc;
    }
    fclose($fh);
    return $rows;
}

function celebr8_seed_append_note(string $existing, string $piece): string
{
    $piece = trim($piece);
    if ($piece === '') {
        return $existing;
    }
    if ($existing === '') {
        return $piece;
    }
    if (str_contains($existing, $piece)) {
        return $existing;
    }
    return rtrim($existing) . "\n" . $piece;
}

function celebr8_seed_normalize_invite_name(string $name): string
{
    $name = trim($name);
    if ($name === 'Grandma (Mom contact)') {
        return 'Lavonne Disharoon';
    }
    return $name;
}

function celebr8_seed_family_name_aliases(): array
{
    return [
        'Mom (Lavonne Ingram Disharoon)' => 'Lavonne Disharoon',
        'Marisa Graves (Ramic)' => 'Marisa Graves',
    ];
}

/**
 * @return array{guest_count:int, invite_recorded:int, blocked:int, event_id:int}
 */
function celebr8_seed_apply_local(string $inboxDir): array
{
    Celebr8Model::ensureSchema();
    $defaults = Celebr8Model::halloweenEventDefaults();
    $event = Celebr8Model::getEventBySlug($defaults['slug']);
    if (!$event) {
        throw new RuntimeException('Halloween event missing after ensureSchema');
    }
    $event = Celebr8Model::updateEvent((int)$event['id'], $defaults);
    if (!$event) {
        throw new RuntimeException('Failed to update event details');
    }
    $eventId = (int)$event['id'];

    $invites = celebr8_seed_read_csv($inboxDir . '/invites-2026.csv');
    $sends = celebr8_seed_read_csv($inboxDir . '/send-log-2026.csv');
    $family = celebr8_seed_read_csv($inboxDir . '/family-additions-2026.csv');

    $sendByName = [];
    foreach ($sends as $row) {
        $sendByName[trim($row['name'] ?? '')] = $row;
    }

    $familyByCanonical = [];
    $aliases = celebr8_seed_family_name_aliases();
    foreach ($family as $row) {
        $raw = trim($row['name'] ?? '');
        $canonical = $aliases[$raw] ?? $raw;
        $familyByCanonical[$canonical] = $row;
        $familyByCanonical[$raw] = $row;
    }

    $blocked = 0;
    $guestCount = 0;
    $inviteRecorded = 0;
    $inviteBody = (string)$defaults['invite_text'];

    foreach ($invites as $row) {
        $rawName = trim($row['name'] ?? '');
        $name = celebr8_seed_normalize_invite_name($rawName);
        if ($name === '') {
            continue;
        }
        if (Celebr8Model::isBlockedGuestName($name) || Celebr8Model::isBlockedGuestName($rawName)) {
            $blocked++;
            fwrite(STDERR, "blocked guest skipped\n");
            continue;
        }

        $notes = '';
        $invitedVia = trim($row['invite_status'] ?? '');
        if ($invitedVia !== '') {
            $notes = celebr8_seed_append_note($notes, 'Invited via: ' . $invitedVia);
        }
        $source = trim($row['source_entry'] ?? '');
        if ($source !== '' && $source !== $rawName && $source !== $name) {
            $notes = celebr8_seed_append_note($notes, 'Source entry: ' . $source);
        }
        if ($rawName === 'Grandma (Mom contact)') {
            $notes = celebr8_seed_append_note($notes, "Jon's mom (listed on invite sheet as Grandma / Mom contact).");
        }

        $familyRow = $familyByCanonical[$name] ?? $familyByCanonical[$rawName] ?? null;
        $relation = '';
        if (is_array($familyRow)) {
            $relation = trim((string)($familyRow['relation'] ?? ''));
            if ($relation !== '') {
                $notes = celebr8_seed_append_note($notes, 'Family: ' . $relation);
            }
        }

        if (in_array($name, ['Vernon Ingram', 'Linda Ingram'], true)) {
            $notes = celebr8_seed_append_note($notes, 'Lives in South Georgia; probably will not attend.');
        }

        $phoneUnverified = 0;
        if ($name === 'Hannah Pruett') {
            $phoneUnverified = 1;
            $notes = celebr8_seed_append_note($notes, 'Phone unverified.');
        }

        $send = $sendByName[$rawName] ?? $sendByName[$name] ?? null;
        $inviteStatus = 'none';
        $inviteError = '';
        if (is_array($send)) {
            $st = strtolower(trim((string)($send['status'] ?? '')));
            if ($st === 'sent') {
                $inviteStatus = 'sent';
            } elseif ($st === 'failed') {
                $inviteStatus = 'failed';
                $inviteError = trim((string)($send['error'] ?? 'invite send failed'));
                $notes = celebr8_seed_append_note($notes, 'Invite delivery failed: ' . $inviteError);
            }
        }

        $guest = Celebr8Model::upsertGuest($eventId, [
            'name' => $name,
            'phone' => (string)($row['phone'] ?? ''),
            'email' => (string)($row['email'] ?? ''),
            'rsvp_status' => 'no_reply',
            'party_size' => 1,
            'kids_count' => 0,
            'invited_via' => $invitedVia,
            'relation_label' => $relation,
            'bringing_chili' => 0,
            'bringing' => '',
            'phone_unverified' => $phoneUnverified,
            'invite_send_status' => $inviteStatus,
            'invite_send_error' => $inviteError,
            'notes' => $notes,
        ], 'seed:inbox-2026', true);
        $guestCount++;

        if ($inviteStatus === 'sent' || $inviteStatus === 'failed') {
            $to = (string)$guest['phone'];
            if ($to === '' && is_array($send)) {
                $to = Celebr8Model::normalizePhone((string)($send['phone'] ?? ''));
            }
            if ($to === '') {
                $to = 'unknown';
            }
            Celebr8Model::recordHistoricalInvite(
                $eventId,
                (int)$guest['id'],
                $to,
                $inviteBody,
                $inviteStatus,
                $inviteError
            );
            $inviteRecorded++;
        }
    }

    return [
        'guest_count' => $guestCount,
        'invite_recorded' => $inviteRecorded,
        'blocked' => $blocked,
        'event_id' => $eventId,
    ];
}

/**
 * Seed via HTTPS agent API (for live). Still reads CSVs only from local disk.
 *
 * @return array{guest_count:int, invite_recorded:int, blocked:int, event_id:int}
 */
function celebr8_seed_apply_via_api(string $inboxDir, string $baseUrl, string $token): array
{
    $defaults = Celebr8Model::halloweenEventDefaults();

    $request = static function (string $method, string $action, ?array $payload = null) use ($baseUrl, $token): array {
        $url = rtrim($baseUrl, '/') . '/api/celebr8_agent.php?action=' . rawurlencode($action);
        $headers = [
            'Accept: application/json',
            'Authorization: Bearer ' . $token,
        ];
        $body = null;
        if ($payload !== null) {
            $headers[] = 'Content-Type: application/json';
            $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_POSTFIELDS => $body,
        ]);
        $raw = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        unset($ch);
        if ($raw === false) {
            throw new RuntimeException('API request failed: ' . $err);
        }
        $json = json_decode($raw, true);
        if ($code >= 400 || !is_array($json) || empty($json['success'])) {
            $msg = is_array($json) ? (string)($json['error'] ?? $raw) : $raw;
            throw new RuntimeException("API {$action} HTTP {$code}: {$msg}");
        }
        return $json;
    };

    // Warm schema on live
    $request('GET', 'list_events');

    $payload = $defaults;
    $payload['slug'] = $defaults['slug'];
    $eventRes = $request('POST', 'update_event', $payload);
    $eventId = (int)($eventRes['event']['id'] ?? 0);
    if ($eventId <= 0) {
        throw new RuntimeException('Live event id missing after update_event');
    }

    $invites = celebr8_seed_read_csv($inboxDir . '/invites-2026.csv');
    $sends = celebr8_seed_read_csv($inboxDir . '/send-log-2026.csv');
    $family = celebr8_seed_read_csv($inboxDir . '/family-additions-2026.csv');
    $sendByName = [];
    foreach ($sends as $row) {
        $sendByName[trim($row['name'] ?? '')] = $row;
    }
    $aliases = celebr8_seed_family_name_aliases();
    $familyByCanonical = [];
    foreach ($family as $row) {
        $raw = trim($row['name'] ?? '');
        $canonical = $aliases[$raw] ?? $raw;
        $familyByCanonical[$canonical] = $row;
        $familyByCanonical[$raw] = $row;
    }

    $blocked = 0;
    $guestCount = 0;
    $inviteRecorded = 0;
    foreach ($invites as $row) {
        $rawName = trim($row['name'] ?? '');
        $name = celebr8_seed_normalize_invite_name($rawName);
        if ($name === '') {
            continue;
        }
        if (Celebr8Model::isBlockedGuestName($name) || Celebr8Model::isBlockedGuestName($rawName)) {
            $blocked++;
            continue;
        }
        $notes = '';
        $invitedVia = trim($row['invite_status'] ?? '');
        if ($invitedVia !== '') {
            $notes = celebr8_seed_append_note($notes, 'Invited via: ' . $invitedVia);
        }
        $source = trim($row['source_entry'] ?? '');
        if ($source !== '' && $source !== $rawName && $source !== $name) {
            $notes = celebr8_seed_append_note($notes, 'Source entry: ' . $source);
        }
        if ($rawName === 'Grandma (Mom contact)') {
            $notes = celebr8_seed_append_note($notes, "Jon's mom (listed on invite sheet as Grandma / Mom contact).");
        }
        $familyRow = $familyByCanonical[$name] ?? $familyByCanonical[$rawName] ?? null;
        $relation = is_array($familyRow) ? trim((string)($familyRow['relation'] ?? '')) : '';
        if ($relation !== '') {
            $notes = celebr8_seed_append_note($notes, 'Family: ' . $relation);
        }
        if (in_array($name, ['Vernon Ingram', 'Linda Ingram'], true)) {
            $notes = celebr8_seed_append_note($notes, 'Lives in South Georgia; probably will not attend.');
        }
        $phoneUnverified = $name === 'Hannah Pruett' ? 1 : 0;
        if ($phoneUnverified) {
            $notes = celebr8_seed_append_note($notes, 'Phone unverified.');
        }
        $send = $sendByName[$rawName] ?? $sendByName[$name] ?? null;
        $inviteStatus = 'none';
        $inviteError = '';
        if (is_array($send)) {
            $st = strtolower(trim((string)($send['status'] ?? '')));
            if ($st === 'sent') {
                $inviteStatus = 'sent';
            } elseif ($st === 'failed') {
                $inviteStatus = 'failed';
                $inviteError = trim((string)($send['error'] ?? 'invite send failed'));
                $notes = celebr8_seed_append_note($notes, 'Invite delivery failed: ' . $inviteError);
            }
        }

        $upsert = $request('POST', 'upsert_guest', [
            'event_id' => $eventId,
            'name' => $name,
            'phone' => (string)($row['phone'] ?? ''),
            'email' => (string)($row['email'] ?? ''),
            'rsvp_status' => 'no_reply',
            'party_size' => 1,
            'kids_count' => 0,
            'invited_via' => $invitedVia,
            'relation_label' => $relation,
            'bringing_chili' => 0,
            'bringing' => '',
            'phone_unverified' => $phoneUnverified,
            'invite_send_status' => $inviteStatus,
            'invite_send_error' => $inviteError,
            'notes' => $notes,
        ]);
        $guestCount++;
        if ($inviteStatus === 'sent' || $inviteStatus === 'failed') {
            $guestId = (int)($upsert['guest']['id'] ?? 0);
            $to = (string)($upsert['guest']['phone'] ?? '');
            if ($to === '' && is_array($send)) {
                $to = Celebr8Model::normalizePhone((string)($send['phone'] ?? ''));
            }
            if ($guestId > 0) {
                $request('POST', 'record_historical_invite', [
                    'event_id' => $eventId,
                    'guest_id' => $guestId,
                    'to_address' => $to !== '' ? $to : 'unknown',
                    'body' => (string)$defaults['invite_text'],
                    'status' => $inviteStatus,
                    'error' => $inviteError,
                ]);
                $inviteRecorded++;
            }
        }
    }

    return [
        'guest_count' => $guestCount,
        'invite_recorded' => $inviteRecorded,
        'blocked' => $blocked,
        'event_id' => $eventId,
    ];
}

$viaApi = in_array('--via-api', $argv, true);
$inbox = celebr8_seed_inbox_dir();
if (!is_dir($inbox)) {
    fwrite(STDERR, "Inbox directory not found: {$inbox}\n");
    exit(1);
}

try {
    if ($viaApi) {
        $tokenPath = dirname(__DIR__, 2) . '/.local/state/celebr8/agent-api-token';
        $token = is_file($tokenPath) ? trim((string)file_get_contents($tokenPath)) : '';
        if ($token === '') {
            throw new RuntimeException('Missing agent token at .local/state/celebr8/agent-api-token');
        }
        $base = trim((string)(getenv('CELEBR8_API_BASE') ?: 'https://catn8.us'));
        $result = celebr8_seed_apply_via_api($inbox, $base, $token);
        fwrite(STDOUT, "seeded_via_api event_id={$result['event_id']} guests={$result['guest_count']} invites_marked={$result['invite_recorded']} blocked={$result['blocked']}\n");
    } else {
        $result = celebr8_seed_apply_local($inbox);
        fwrite(STDOUT, "seeded_local event_id={$result['event_id']} guests={$result['guest_count']} invites_marked={$result['invite_recorded']} blocked={$result['blocked']}\n");
    }
} catch (Throwable $e) {
    fwrite(STDERR, 'Seed failed: ' . $e->getMessage() . "\n");
    exit(1);
}
