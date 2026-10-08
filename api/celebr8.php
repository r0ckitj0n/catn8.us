<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/celebr8_model.php';
require_once __DIR__ . '/../includes/celebr8_catalog_model.php';

catn8_session_start();
Celebr8Model::ensureSchema();
Celebr8CatalogModel::ensureSchema();

$uid = catn8_auth_user_id();
if ($uid === null) {
    catn8_json_response(['success' => false, 'error' => 'Not authenticated'], 401);
}

$action = trim((string)($_GET['action'] ?? ''));
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

$readActions = [
    'list_events', 'get_event', 'list_guests', 'list_messages', 'totals',
    'list_templates', 'get_template', 'list_activities', 'get_activity', 'list_event_activities',
];
$writeActions = [
    'update_event', 'create_event', 'delete_event', 'duplicate_event',
    'create_guest', 'update_guest', 'delete_guest',
    'set_rsvp', 'queue_texts',
    'upsert_template', 'delete_template', 'create_event_from_template', 'link_event_template',
    'upsert_activity', 'delete_activity', 'copy_activity', 'copy_event_activity',
    'attach_event_activity', 'update_event_activity', 'detach_event_activity',
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
            'activities' => Celebr8CatalogModel::listEventActivities((int)$event['id']),
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

    if ($action === 'list_templates') {
        catn8_json_response(['success' => true, 'templates' => Celebr8CatalogModel::listTemplates()]);
    }

    if ($action === 'get_template') {
        $id = (int)($_GET['template_id'] ?? $_GET['id'] ?? 0);
        $slug = trim((string)($_GET['slug'] ?? ''));
        $tpl = $id > 0
            ? Celebr8CatalogModel::getTemplate($id)
            : ($slug !== '' ? Celebr8CatalogModel::getTemplateBySlug($slug) : null);
        if (!$tpl) {
            catn8_json_response(['success' => false, 'error' => 'Template not found'], 404);
        }
        catn8_json_response(['success' => true, 'template' => $tpl]);
    }

    if ($action === 'list_activities') {
        catn8_json_response([
            'success' => true,
            'activities' => Celebr8CatalogModel::listActivities(
                trim((string)($_GET['preferred_holiday'] ?? $_GET['holiday'] ?? '')) ?: null,
                trim((string)($_GET['category'] ?? '')) ?: null,
                trim((string)($_GET['ages'] ?? '')) ?: null,
                trim((string)($_GET['party_type'] ?? '')) ?: null
            ),
            'holidays' => Celebr8CatalogModel::HOLIDAYS,
        ]);
    }

    if ($action === 'get_activity') {
        $id = (int)($_GET['activity_id'] ?? $_GET['id'] ?? 0);
        $act = $id > 0 ? Celebr8CatalogModel::getActivity($id) : null;
        if (!$act) {
            catn8_json_response(['success' => false, 'error' => 'Activity not found'], 404);
        }
        catn8_json_response(['success' => true, 'activity' => $act]);
    }

    if ($action === 'list_event_activities') {
        $eventId = (int)($_GET['event_id'] ?? 0);
        if ($eventId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'event_id required'], 400);
        }
        catn8_json_response([
            'success' => true,
            'activities' => Celebr8CatalogModel::listEventActivities($eventId),
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

    if ($action === 'create_event') {
        $event = Celebr8Model::createEvent($body);
        catn8_json_response(['success' => true, 'event' => $event]);
    }

    if ($action === 'delete_event') {
        $eventId = (int)($body['event_id'] ?? $body['id'] ?? 0);
        if ($eventId <= 0 || !Celebr8Model::deleteEvent($eventId)) {
            catn8_json_response(['success' => false, 'error' => 'Event not found'], 404);
        }
        catn8_json_response(['success' => true]);
    }

    if ($action === 'duplicate_event') {
        $eventId = (int)($body['event_id'] ?? $body['id'] ?? 0);
        if ($eventId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'event_id required'], 400);
        }
        $dup = Celebr8Model::duplicateEvent($eventId);
        catn8_json_response([
            'success' => true,
            'event' => $dup['event'],
            'activities' => $dup['activities'],
        ]);
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

    if ($action === 'upsert_template') {
        $tpl = Celebr8CatalogModel::upsertTemplate($body);
        catn8_json_response(['success' => true, 'template' => $tpl]);
    }

    if ($action === 'delete_template') {
        $id = (int)($body['template_id'] ?? $body['id'] ?? 0);
        if ($id <= 0 || !Celebr8CatalogModel::deleteTemplate($id)) {
            catn8_json_response(['success' => false, 'error' => 'Template not found'], 404);
        }
        catn8_json_response(['success' => true]);
    }

    if ($action === 'create_event_from_template') {
        $templateId = (int)($body['template_id'] ?? 0);
        if ($templateId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'template_id required'], 400);
        }
        $created = Celebr8CatalogModel::createEventFromTemplate($templateId, $body);
        catn8_json_response([
            'success' => true,
            'event' => $created['event'],
            'activities' => $created['activities'],
        ]);
    }

    if ($action === 'link_event_template') {
        $eventId = (int)($body['event_id'] ?? 0);
        $templateId = (int)($body['template_id'] ?? 0);
        $event = Celebr8CatalogModel::linkEventToTemplate($eventId, $templateId);
        if (!$event) {
            catn8_json_response(['success' => false, 'error' => 'Event or template not found'], 404);
        }
        catn8_json_response(['success' => true, 'event' => $event]);
    }

    if ($action === 'upsert_activity') {
        $act = Celebr8CatalogModel::upsertActivity($body);
        catn8_json_response(['success' => true, 'activity' => $act]);
    }

    if ($action === 'copy_activity') {
        $id = (int)($body['activity_id'] ?? $body['id'] ?? 0);
        if ($id <= 0) {
            catn8_json_response(['success' => false, 'error' => 'activity_id required'], 400);
        }
        $copy = Celebr8CatalogModel::copyActivity($id, isset($body['name']) ? (string)$body['name'] : null);
        catn8_json_response(['success' => true, 'activity' => $copy]);
    }

    if ($action === 'copy_event_activity') {
        $eventId = (int)($body['event_id'] ?? 0);
        $eaId = (int)($body['event_activity_id'] ?? $body['id'] ?? 0);
        if ($eventId <= 0 || $eaId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'event_id and event_activity_id required'], 400);
        }
        $copied = Celebr8CatalogModel::copyEventActivityInPlace($eventId, $eaId);
        catn8_json_response([
            'success' => true,
            'activity' => $copied['activity'],
            'event_activity' => $copied['event_activity'],
        ]);
    }

    if ($action === 'delete_activity') {
        $id = (int)($body['activity_id'] ?? $body['id'] ?? 0);
        if ($id <= 0 || !Celebr8CatalogModel::deleteActivity($id)) {
            catn8_json_response(['success' => false, 'error' => 'Activity not found'], 404);
        }
        catn8_json_response(['success' => true]);
    }

    if ($action === 'attach_event_activity') {
        $eventId = (int)($body['event_id'] ?? 0);
        $activityId = (int)($body['activity_id'] ?? 0);
        if ($eventId <= 0 || $activityId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'event_id and activity_id required'], 400);
        }
        $ea = Celebr8CatalogModel::attachActivityToEvent($eventId, $activityId, $body);
        catn8_json_response(['success' => true, 'event_activity' => $ea]);
    }

    if ($action === 'update_event_activity') {
        $eventId = (int)($body['event_id'] ?? 0);
        $eaId = (int)($body['event_activity_id'] ?? $body['id'] ?? 0);
        if ($eventId <= 0 || $eaId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'event_id and event_activity_id required'], 400);
        }
        $ea = Celebr8CatalogModel::updateEventActivity($eventId, $eaId, $body);
        catn8_json_response(['success' => true, 'event_activity' => $ea]);
    }

    if ($action === 'detach_event_activity') {
        $eventId = (int)($body['event_id'] ?? 0);
        $eaId = (int)($body['event_activity_id'] ?? $body['id'] ?? 0);
        if ($eventId <= 0 || $eaId <= 0 || !Celebr8CatalogModel::detachEventActivity($eventId, $eaId)) {
            catn8_json_response(['success' => false, 'error' => 'Event activity not found'], 404);
        }
        catn8_json_response(['success' => true]);
    }

    catn8_json_response(['success' => false, 'error' => 'Unhandled action'], 500);
} catch (InvalidArgumentException $e) {
    catn8_json_response(['success' => false, 'error' => $e->getMessage()], 400);
} catch (Throwable $e) {
    catn8_log_error('celebr8 session API error', ['action' => $action, 'error' => $e->getMessage()]);
    catn8_json_response(['success' => false, 'error' => 'Server error'], 500);
}
