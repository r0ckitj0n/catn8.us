<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/celebr8_model.php';

Celebr8Model::ensureSchema();

function celebr8_agent_extract_token(): string
{
    $header = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (preg_match('/^\s*Bearer\s+(\S+)\s*$/i', $header, $m)) {
        return trim($m[1]);
    }
    $alt = trim((string)($_SERVER['HTTP_X_CELEBR8_AGENT_TOKEN'] ?? ''));
    if ($alt !== '') {
        return $alt;
    }
    return trim((string)($_GET['token'] ?? ''));
}

$token = celebr8_agent_extract_token();
if (!Celebr8Model::verifyApiToken($token, Celebr8Model::AGENT_TOKEN_SECRET_KEY)) {
    catn8_log_error('celebr8 agent auth failure', ['ip' => (string)($_SERVER['REMOTE_ADDR'] ?? '')]);
    catn8_json_response(['success' => false, 'error' => 'Not authenticated'], 401);
}

$action = trim((string)($_GET['action'] ?? ''));
$readActions = ['list_events', 'get_event', 'list_guests'];
$writeActions = ['update_event', 'upsert_guest', 'set_rsvp'];
$allowed = array_merge($readActions, $writeActions);

if ($action === '' || !in_array($action, $allowed, true)) {
    catn8_json_response(['success' => false, 'error' => 'Unknown or missing action'], 400);
}

if (in_array($action, $writeActions, true)) {
    // Bearer token auth replaces browser CSRF for agent callers.
    catn8_require_method('POST', false);
} else {
    catn8_require_method('GET', false);
}

$actorLabel = 'agent:celebr8';

try {
    if ($action === 'list_events') {
        catn8_json_response(['success' => true, 'events' => Celebr8Model::listEvents()]);
    }

    if ($action === 'get_event') {
        $eventId = (int)($_GET['event_id'] ?? 0);
        $slug = trim((string)($_GET['slug'] ?? ''));
        $event = $eventId > 0
            ? Celebr8Model::getEvent($eventId)
            : ($slug !== '' ? Celebr8Model::getEventBySlug($slug) : null);
        if (!$event) {
            catn8_json_response(['success' => false, 'error' => 'Event not found'], 404);
        }
        catn8_json_response([
            'success' => true,
            'event' => $event,
            'totals' => Celebr8Model::guestTotals((int)$event['id']),
        ]);
    }

    if ($action === 'list_guests') {
        $eventId = (int)($_GET['event_id'] ?? 0);
        if ($eventId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'event_id required'], 400);
        }
        $rsvp = trim((string)($_GET['rsvp_status'] ?? ''));
        catn8_json_response([
            'success' => true,
            'guests' => Celebr8Model::listGuests($eventId, $rsvp === '' ? null : $rsvp),
            'totals' => Celebr8Model::guestTotals($eventId),
        ]);
    }

    $body = catn8_read_json_body(false);

    if ($action === 'update_event') {
        $eventId = (int)($body['event_id'] ?? 0);
        if ($eventId <= 0 && !empty($body['slug'])) {
            $found = Celebr8Model::getEventBySlug((string)$body['slug']);
            $eventId = $found ? (int)$found['id'] : 0;
        }
        if ($eventId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'event_id or slug required'], 400);
        }
        $event = Celebr8Model::updateEvent($eventId, $body);
        if (!$event) {
            catn8_json_response(['success' => false, 'error' => 'Event not found'], 404);
        }
        catn8_json_response(['success' => true, 'event' => $event]);
    }

    if ($action === 'upsert_guest') {
        $eventId = (int)($body['event_id'] ?? 0);
        if ($eventId <= 0 && !empty($body['slug'])) {
            $found = Celebr8Model::getEventBySlug((string)$body['slug']);
            $eventId = $found ? (int)$found['id'] : 0;
        }
        if ($eventId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'event_id or slug required'], 400);
        }
        $guest = Celebr8Model::upsertGuest($eventId, $body, $actorLabel, isset($body['rsvp_status']));
        catn8_json_response([
            'success' => true,
            'guest' => $guest,
            'totals' => Celebr8Model::guestTotals($eventId),
        ]);
    }

    if ($action === 'set_rsvp') {
        $eventId = (int)($body['event_id'] ?? 0);
        if ($eventId <= 0 && !empty($body['slug'])) {
            $found = Celebr8Model::getEventBySlug((string)$body['slug']);
            $eventId = $found ? (int)$found['id'] : 0;
        }
        if ($eventId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'event_id or slug required'], 400);
        }
        $guest = Celebr8Model::setRsvp(
            $eventId,
            [
                'guest_id' => (int)($body['guest_id'] ?? 0),
                'phone' => (string)($body['phone'] ?? ''),
            ],
            (string)($body['rsvp_status'] ?? ''),
            $actorLabel,
            isset($body['party_size']) ? (int)$body['party_size'] : null,
            isset($body['kids_count']) ? (int)$body['kids_count'] : null
        );
        catn8_json_response([
            'success' => true,
            'guest' => $guest,
            'totals' => Celebr8Model::guestTotals($eventId),
        ]);
    }

    catn8_json_response(['success' => false, 'error' => 'Unhandled action'], 500);
} catch (InvalidArgumentException $e) {
    catn8_json_response(['success' => false, 'error' => $e->getMessage()], 400);
} catch (Throwable $e) {
    catn8_log_error('celebr8 agent API error', ['action' => $action, 'error' => $e->getMessage()]);
    catn8_json_response(['success' => false, 'error' => 'Server error'], 500);
}
