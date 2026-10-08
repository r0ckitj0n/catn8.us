<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/celebr8_model.php';

catn8_session_start();
Celebr8Model::ensureSchema();

$uid = catn8_auth_user_id();
if ($uid === null) {
    catn8_json_response(['success' => false, 'error' => 'Not authenticated'], 401);
}

$action = trim((string)($_GET['action'] ?? ''));
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

$readActions = ['list_events', 'get_event', 'list_guests', 'list_messages', 'totals'];
$writeActions = [
    'update_event', 'create_guest', 'update_guest', 'delete_guest',
    'set_rsvp', 'queue_texts',
];

if ($action === '' || (!in_array($action, $readActions, true) && !in_array($action, $writeActions, true))) {
    catn8_json_response(['success' => false, 'error' => 'Unknown or missing action'], 400);
}

if (in_array($action, $writeActions, true)) {
    catn8_require_method('POST');
    catn8_require_csrf();
    if (!catn8_user_is_admin($uid)) {
        catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
    }
} else {
    catn8_require_method('GET');
}

$actorUser = Database::queryOne('SELECT username FROM users WHERE id = ?', [$uid]);
$actorLabel = 'user:' . (string)($actorUser['username'] ?? ('id' . $uid));

try {
    if ($action === 'list_events') {
        catn8_json_response(['success' => true, 'events' => Celebr8Model::listEvents()]);
    }

    if ($action === 'get_event') {
        $eventId = (int)($_GET['event_id'] ?? 0);
        $slug = trim((string)($_GET['slug'] ?? ''));
        $event = null;
        if ($eventId > 0) {
            $event = Celebr8Model::getEvent($eventId);
        } elseif ($slug !== '') {
            $event = Celebr8Model::getEventBySlug($slug);
        } else {
            catn8_json_response(['success' => false, 'error' => 'event_id or slug required'], 400);
        }
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
        $guests = Celebr8Model::listGuests($eventId, $rsvp === '' ? null : $rsvp);
        catn8_json_response([
            'success' => true,
            'guests' => $guests,
            'totals' => Celebr8Model::guestTotals($eventId),
        ]);
    }

    if ($action === 'totals') {
        $eventId = (int)($_GET['event_id'] ?? 0);
        if ($eventId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'event_id required'], 400);
        }
        catn8_json_response(['success' => true, 'totals' => Celebr8Model::guestTotals($eventId)]);
    }

    if ($action === 'list_messages') {
        $eventId = (int)($_GET['event_id'] ?? 0);
        if ($eventId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'event_id required'], 400);
        }
        $status = trim((string)($_GET['status'] ?? ''));
        catn8_json_response([
            'success' => true,
            'messages' => Celebr8Model::listMessages($eventId, $status === '' ? null : $status),
        ]);
    }

    $body = catn8_read_json_body();

    if ($action === 'update_event') {
        $eventId = (int)($body['event_id'] ?? 0);
        if ($eventId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'event_id required'], 400);
        }
        $event = Celebr8Model::updateEvent($eventId, $body);
        if (!$event) {
            catn8_json_response(['success' => false, 'error' => 'Event not found'], 404);
        }
        catn8_json_response(['success' => true, 'event' => $event]);
    }

    if ($action === 'create_guest' || $action === 'update_guest') {
        $eventId = (int)($body['event_id'] ?? 0);
        if ($eventId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'event_id required'], 400);
        }
        if ($action === 'update_guest' && (int)($body['id'] ?? 0) <= 0) {
            catn8_json_response(['success' => false, 'error' => 'id required'], 400);
        }
        $guest = Celebr8Model::upsertGuest($eventId, $body, $actorLabel, isset($body['rsvp_status']));
        catn8_json_response([
            'success' => true,
            'guest' => $guest,
            'totals' => Celebr8Model::guestTotals($eventId),
        ]);
    }

    if ($action === 'delete_guest') {
        $eventId = (int)($body['event_id'] ?? 0);
        $guestId = (int)($body['guest_id'] ?? $body['id'] ?? 0);
        if ($eventId <= 0 || $guestId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'event_id and guest_id required'], 400);
        }
        if (!Celebr8Model::deleteGuest($eventId, $guestId)) {
            catn8_json_response(['success' => false, 'error' => 'Guest not found'], 404);
        }
        catn8_json_response([
            'success' => true,
            'totals' => Celebr8Model::guestTotals($eventId),
        ]);
    }

    if ($action === 'set_rsvp') {
        $eventId = (int)($body['event_id'] ?? 0);
        $status = (string)($body['rsvp_status'] ?? '');
        if ($eventId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'event_id required'], 400);
        }
        $guest = Celebr8Model::setRsvp(
            $eventId,
            [
                'guest_id' => (int)($body['guest_id'] ?? 0),
                'phone' => (string)($body['phone'] ?? ''),
            ],
            $status,
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

    if ($action === 'queue_texts') {
        $eventId = (int)($body['event_id'] ?? 0);
        $text = (string)($body['body'] ?? $body['text'] ?? '');
        $guestIds = $body['guest_ids'] ?? [];
        if (!is_array($guestIds)) {
            catn8_json_response(['success' => false, 'error' => 'guest_ids must be an array'], 400);
        }
        $all = !empty($body['all_guests']);
        $rsvpFilter = trim((string)($body['rsvp_status'] ?? ''));
        $result = Celebr8Model::queueTexts(
            $eventId,
            $text,
            $guestIds,
            $rsvpFilter === '' ? null : $rsvpFilter,
            $all,
            $uid
        );
        catn8_json_response([
            'success' => true,
            'queued' => $result['queued'],
            'skipped' => $result['skipped'],
            'queued_count' => count($result['queued']),
        ]);
    }

    catn8_json_response(['success' => false, 'error' => 'Unhandled action'], 500);
} catch (InvalidArgumentException $e) {
    catn8_json_response(['success' => false, 'error' => $e->getMessage()], 400);
} catch (Throwable $e) {
    catn8_log_error('celebr8 session API error', ['action' => $action, 'error' => $e->getMessage()]);
    catn8_json_response(['success' => false, 'error' => 'Server error'], 500);
}
