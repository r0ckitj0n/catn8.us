<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/celebr8_model.php';
require_once __DIR__ . '/../includes/celebr8_catalog_model.php';

Celebr8Model::ensureSchema();
Celebr8CatalogModel::ensureSchema();

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
$readActions = [
    'list_events', 'get_event', 'list_guests',
    'list_templates', 'get_template', 'list_activities', 'get_activity', 'list_event_activities',
];
$writeActions = [
    'update_event', 'create_event', 'delete_event', 'duplicate_event',
    'upsert_guest', 'set_rsvp', 'record_historical_invite',
    'upsert_template', 'delete_template', 'create_event_from_template', 'link_event_template',
    'upsert_activity', 'delete_activity', 'copy_activity', 'copy_event_activity',
    'attach_event_activity', 'update_event_activity', 'detach_event_activity',
];
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
            'activities' => Celebr8CatalogModel::listEventActivities((int)$event['id']),
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

    if ($action === 'create_event') {
        catn8_json_response(['success' => true, 'event' => Celebr8Model::createEvent($body)]);
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
        catn8_json_response(['success' => true, 'event' => $dup['event'], 'activities' => $dup['activities']]);
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

    if ($action === 'record_historical_invite') {
        $eventId = (int)($body['event_id'] ?? 0);
        $guestId = (int)($body['guest_id'] ?? 0);
        if ($eventId <= 0 || $guestId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'event_id and guest_id required'], 400);
        }
        Celebr8Model::recordHistoricalInvite(
            $eventId,
            $guestId,
            (string)($body['to_address'] ?? ''),
            (string)($body['body'] ?? ''),
            (string)($body['status'] ?? ''),
            (string)($body['error'] ?? $body['error_text'] ?? '')
        );
        catn8_json_response(['success' => true]);
    }

    if ($action === 'upsert_template') {
        catn8_json_response(['success' => true, 'template' => Celebr8CatalogModel::upsertTemplate($body)]);
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
        $event = Celebr8CatalogModel::linkEventToTemplate(
            (int)($body['event_id'] ?? 0),
            (int)($body['template_id'] ?? 0)
        );
        if (!$event) {
            catn8_json_response(['success' => false, 'error' => 'Event or template not found'], 404);
        }
        catn8_json_response(['success' => true, 'event' => $event]);
    }

    if ($action === 'upsert_activity') {
        catn8_json_response(['success' => true, 'activity' => Celebr8CatalogModel::upsertActivity($body)]);
    }

    if ($action === 'copy_activity') {
        $id = (int)($body['activity_id'] ?? $body['id'] ?? 0);
        if ($id <= 0) {
            catn8_json_response(['success' => false, 'error' => 'activity_id required'], 400);
        }
        catn8_json_response([
            'success' => true,
            'activity' => Celebr8CatalogModel::copyActivity($id, isset($body['name']) ? (string)$body['name'] : null),
        ]);
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
        catn8_json_response([
            'success' => true,
            'event_activity' => Celebr8CatalogModel::attachActivityToEvent($eventId, $activityId, $body),
        ]);
    }

    if ($action === 'update_event_activity') {
        $eventId = (int)($body['event_id'] ?? 0);
        $eaId = (int)($body['event_activity_id'] ?? $body['id'] ?? 0);
        if ($eventId <= 0 || $eaId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'event_id and event_activity_id required'], 400);
        }
        catn8_json_response([
            'success' => true,
            'event_activity' => Celebr8CatalogModel::updateEventActivity($eventId, $eaId, $body),
        ]);
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
    catn8_log_error('celebr8 agent API error', ['action' => $action, 'error' => $e->getMessage()]);
    catn8_json_response(['success' => false, 'error' => 'Server error'], 500);
}
