<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/celebr8_model.php';
require_once __DIR__ . '/../includes/celebr8_catalog_model.php';
require_once __DIR__ . '/../includes/celebr8_agent_model.php';
require_once __DIR__ . '/../includes/celebr8_album_model.php';
require_once __DIR__ . '/../includes/celebr8_flyer_model.php';

catn8_session_start();
Celebr8Model::ensureSchema();
Celebr8CatalogModel::ensureSchema();
Celebr8AgentModel::ensureSchema();
Celebr8AlbumModel::ensureSchema();
Celebr8FlyerModel::ensureSchema();

$uid = catn8_auth_user_id();
if ($uid === null) {
    catn8_json_response(['success' => false, 'error' => 'Not authenticated'], 401);
}

$action = trim((string)($_GET['action'] ?? ''));
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

$readActions = [
    'list_events', 'get_event', 'list_guests', 'list_messages', 'totals',
    'list_templates', 'get_template', 'list_activities', 'get_activity', 'list_event_activities',
    'list_requests', 'get_request',
    'list_guest_groups', 'get_guest_group',
    'get_album', 'list_photos',
    'get_flyer', 'list_flyer_versions',
    'list_rsvp_history',
];
$writeActions = [
    'update_event', 'create_event', 'delete_event', 'duplicate_event',
    'create_guest', 'update_guest', 'delete_guest',
    'set_rsvp', 'queue_texts',
    'upsert_template', 'delete_template', 'create_event_from_template', 'link_event_template',
    'upsert_activity', 'delete_activity', 'copy_activity', 'copy_event_activity',
    'attach_event_activity', 'update_event_activity', 'detach_event_activity',
    'create_request', 'reply_request',
    'upsert_guest_group', 'delete_guest_group',
    'ensure_album', 'upload_photo', 'delete_photo', 'update_photo',
    'set_cover_photo', 'clear_cover_photo', 'reorder_photos', 'move_photo',
    'upload_flyer', 'request_flyer', 'update_flyer_brief',
    'delete_flyer', 'restore_flyer_version',
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

if ($action === 'upload_photo') {
    try {
        $partyId = (int)($_POST['party_id'] ?? $_POST['event_id'] ?? 0);
        $albumId = (int)($_POST['album_id'] ?? 0);
        $caption = (string)($_POST['caption'] ?? '');
        $captureTime = isset($_POST['capture_time']) ? (string)$_POST['capture_time'] : null;
        $sourceUuid = isset($_POST['source_uuid']) ? (string)$_POST['source_uuid'] : null;
        $file = $_FILES['file'] ?? $_FILES['photo'] ?? $_FILES['image'] ?? null;
        if (!is_array($file)) {
            catn8_json_response(['success' => false, 'error' => 'multipart file field required (file|photo|image)'], 400);
        }
        $result = Celebr8AlbumModel::uploadPhoto(
            $partyId,
            $albumId,
            $file,
            $caption,
            $captureTime,
            $sourceUuid,
            'user:' . $uid
        );
        catn8_json_response([
            'success' => true,
            'photo' => $result['photo'],
            'album' => $result['album'],
            'deduped' => $result['deduped'],
            'dedupe_reason' => $result['dedupe_reason'],
        ]);
    } catch (InvalidArgumentException $e) {
        catn8_json_response(['success' => false, 'error' => $e->getMessage()], 400);
    } catch (Throwable $e) {
        catn8_log_error('celebr8 session upload_photo error', ['error' => $e->getMessage()]);
        catn8_json_response(['success' => false, 'error' => 'Server error'], 500);
    }
}

if ($action === 'upload_flyer') {
    try {
        $partyId = (int)($_POST['party_id'] ?? $_POST['event_id'] ?? 0);
        $file = $_FILES['file'] ?? $_FILES['flyer'] ?? $_FILES['image'] ?? $_FILES['photo'] ?? null;
        if ($partyId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'party_id required'], 400);
        }
        if (!is_array($file)) {
            catn8_json_response(['success' => false, 'error' => 'multipart file field required (file|flyer|image|photo)'], 400);
        }
        $result = Celebr8FlyerModel::uploadFlyer($partyId, $file, 'user:' . $uid);
        catn8_json_response(['success' => true] + $result);
    } catch (InvalidArgumentException $e) {
        catn8_json_response(['success' => false, 'error' => $e->getMessage()], 400);
    } catch (Throwable $e) {
        catn8_log_error('celebr8 session upload_flyer error', ['error' => $e->getMessage()]);
        catn8_json_response(['success' => false, 'error' => 'Server error'], 500);
    }
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

    if ($action === 'list_rsvp_history') {
        $guestId = (int)($_GET['guest_id'] ?? 0);
        if ($guestId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'guest_id required'], 400);
        }
        $partyId = (int)($_GET['party_id'] ?? $_GET['event_id'] ?? 0);
        $limit = (int)($_GET['limit'] ?? 100);
        catn8_json_response([
            'success' => true,
            'guest_id' => $guestId,
            'history' => Celebr8Model::listRsvpHistory($guestId, $partyId > 0 ? $partyId : null, $limit),
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

    if ($action === 'list_requests') {
        $partyRaw = $_GET['party_id'] ?? $_GET['event_id'] ?? null;
        $partyId = null;
        if ($partyRaw !== null && $partyRaw !== '') {
            $partyId = (int)$partyRaw;
        }
        $statusRaw = trim((string)($_GET['status'] ?? ''));
        $statuses = null;
        if ($statusRaw !== '') {
            $statuses = array_map('trim', explode(',', $statusRaw));
        }
        $limit = (int)($_GET['limit'] ?? 40);
        $type = trim((string)($_GET['request_type'] ?? $_GET['type'] ?? '')) ?: null;
        catn8_json_response([
            'success' => true,
            'requests' => Celebr8AgentModel::listRequests($partyId, $statuses, $limit, $type),
        ]);
    }

    if ($action === 'get_flyer') {
        $partyId = (int)($_GET['party_id'] ?? $_GET['event_id'] ?? 0);
        if ($partyId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'party_id required'], 400);
        }
        $withHistory = trim((string)($_GET['history'] ?? '1')) !== '0';
        $result = Celebr8FlyerModel::getFlyerForParty($partyId, $withHistory);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'list_flyer_versions') {
        $partyId = (int)($_GET['party_id'] ?? $_GET['event_id'] ?? 0);
        if ($partyId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'party_id required'], 400);
        }
        catn8_json_response([
            'success' => true,
            'party_id' => $partyId,
            'versions' => Celebr8FlyerModel::listFlyerVersions($partyId),
        ]);
    }

    if ($action === 'get_request') {
        $id = (int)($_GET['request_id'] ?? $_GET['id'] ?? 0);
        if ($id <= 0) {
            catn8_json_response(['success' => false, 'error' => 'request_id required'], 400);
        }
        $detail = Celebr8AgentModel::getRequestDetail($id);
        if (!$detail) {
            catn8_json_response(['success' => false, 'error' => 'Request not found'], 404);
        }
        catn8_json_response(['success' => true] + $detail);
    }

    if ($action === 'list_guest_groups') {
        $eventId = (int)($_GET['event_id'] ?? $_GET['party_id'] ?? 0);
        if ($eventId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'event_id required'], 400);
        }
        catn8_json_response([
            'success' => true,
            'groups' => Celebr8AgentModel::listGroups($eventId),
        ]);
    }

    if ($action === 'get_guest_group') {
        $id = (int)($_GET['group_id'] ?? $_GET['id'] ?? 0);
        if ($id <= 0) {
            catn8_json_response(['success' => false, 'error' => 'group_id required'], 400);
        }
        $group = Celebr8AgentModel::getGroup($id);
        if (!$group) {
            catn8_json_response(['success' => false, 'error' => 'Group not found'], 404);
        }
        catn8_json_response(['success' => true, 'group' => $group]);
    }

    if ($action === 'get_album') {
        $partyId = (int)($_GET['party_id'] ?? $_GET['event_id'] ?? 0);
        $albumId = (int)($_GET['album_id'] ?? $_GET['id'] ?? 0);
        $album = null;
        if ($albumId > 0) {
            $album = Celebr8AlbumModel::getAlbum($albumId);
        } elseif ($partyId > 0) {
            $album = Celebr8AlbumModel::getAlbumByParty($partyId);
        } else {
            catn8_json_response(['success' => false, 'error' => 'party_id or album_id required'], 400);
        }
        if (!$album) {
            catn8_json_response(['success' => false, 'error' => 'Album not found'], 404);
        }
        catn8_json_response(['success' => true, 'album' => $album]);
    }

    if ($action === 'list_photos') {
        $partyId = (int)($_GET['party_id'] ?? $_GET['event_id'] ?? 0);
        $albumId = (int)($_GET['album_id'] ?? 0);
        $limit = (int)($_GET['limit'] ?? 200);
        if ($partyId <= 0 && $albumId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'party_id or album_id required'], 400);
        }
        $album = null;
        if ($albumId > 0) {
            $album = Celebr8AlbumModel::getAlbum($albumId);
        } elseif ($partyId > 0) {
            $album = Celebr8AlbumModel::getAlbumByParty($partyId);
        }
        catn8_json_response([
            'success' => true,
            'album' => $album,
            'photos' => Celebr8AlbumModel::listPhotos($partyId, $albumId, $limit),
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

    if ($action === 'create_request') {
        $req = Celebr8AgentModel::createRequest($body, $uid);
        catn8_json_response([
            'success' => true,
            'request' => $req,
            'thread' => Celebr8AgentModel::listThread((int)$req['id']),
            'outbox' => [],
        ]);
    }

    if ($action === 'reply_request') {
        $requestId = (int)($body['request_id'] ?? $body['id'] ?? 0);
        if ($requestId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'request_id required'], 400);
        }
        $detail = Celebr8AgentModel::postJonFollowUp(
            $requestId,
            (string)($body['body'] ?? $body['text'] ?? ''),
            $uid
        );
        catn8_json_response(['success' => true] + $detail);
    }

    if ($action === 'upsert_guest_group') {
        $eventId = (int)($body['event_id'] ?? $body['party_id'] ?? 0);
        if ($eventId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'event_id required'], 400);
        }
        $group = Celebr8AgentModel::upsertGroup($eventId, $body);
        catn8_json_response(['success' => true, 'group' => $group]);
    }

    if ($action === 'delete_guest_group') {
        $eventId = (int)($body['event_id'] ?? $body['party_id'] ?? 0);
        $groupId = (int)($body['group_id'] ?? $body['id'] ?? 0);
        if ($eventId <= 0 || $groupId <= 0 || !Celebr8AgentModel::deleteGroup($eventId, $groupId)) {
            catn8_json_response(['success' => false, 'error' => 'Group not found'], 404);
        }
        catn8_json_response(['success' => true]);
    }

    if ($action === 'ensure_album') {
        $partyId = (int)($body['party_id'] ?? $body['event_id'] ?? 0);
        if ($partyId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'party_id required'], 400);
        }
        $title = trim((string)($body['title'] ?? ''));
        $album = Celebr8AlbumModel::getOrCreateAlbumForParty($partyId, $title);
        catn8_json_response(['success' => true, 'album' => $album]);
    }

    if ($action === 'update_photo') {
        $photoId = (int)($body['photo_id'] ?? $body['id'] ?? 0);
        if ($photoId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'photo_id required'], 400);
        }
        $photo = Celebr8AlbumModel::updatePhoto($photoId, $body);
        catn8_json_response(['success' => true, 'photo' => $photo]);
    }

    if ($action === 'set_cover_photo') {
        $photoId = (int)($body['photo_id'] ?? $body['id'] ?? 0);
        if ($photoId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'photo_id required'], 400);
        }
        $result = Celebr8AlbumModel::setCoverPhoto($photoId);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'clear_cover_photo') {
        $partyId = (int)($body['party_id'] ?? $body['event_id'] ?? 0);
        $albumId = (int)($body['album_id'] ?? 0);
        $result = Celebr8AlbumModel::clearCoverPhoto($partyId, $albumId);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'reorder_photos') {
        $photoIds = $body['photo_ids'] ?? [];
        if (!is_array($photoIds)) {
            catn8_json_response(['success' => false, 'error' => 'photo_ids must be an array'], 400);
        }
        $partyId = (int)($body['party_id'] ?? $body['event_id'] ?? 0);
        $albumId = (int)($body['album_id'] ?? 0);
        $result = Celebr8AlbumModel::reorderPhotos($photoIds, $partyId, $albumId);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'move_photo') {
        $photoIds = $body['photo_ids'] ?? null;
        if (!is_array($photoIds)) {
            $one = (int)($body['photo_id'] ?? $body['id'] ?? 0);
            $photoIds = $one > 0 ? [$one] : [];
        }
        $toPartyId = (int)($body['to_party_id'] ?? $body['destination_party_id'] ?? 0);
        $result = Celebr8AlbumModel::movePhotos($photoIds, $toPartyId);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'delete_photo') {
        $photoIds = $body['photo_ids'] ?? null;
        if (!is_array($photoIds)) {
            $one = (int)($body['photo_id'] ?? $body['id'] ?? 0);
            $photoIds = $one > 0 ? [$one] : [];
        }
        $result = Celebr8AlbumModel::deletePhotos($photoIds);
        if ($result['deleted'] <= 0) {
            catn8_json_response(['success' => false, 'error' => 'Photo not found'], 404);
        }
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'request_flyer') {
        $partyId = (int)($body['party_id'] ?? $body['event_id'] ?? 0);
        if ($partyId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'party_id required'], 400);
        }
        $extraNotes = (string)($body['style_notes'] ?? $body['extra_notes'] ?? $body['notes'] ?? '');
        $regenerate = !empty($body['regenerate']);
        $result = Celebr8AgentModel::requestFlyer($partyId, $uid, $extraNotes, $regenerate);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'update_flyer_brief') {
        $partyId = (int)($body['party_id'] ?? $body['event_id'] ?? 0);
        if ($partyId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'party_id required'], 400);
        }
        $brief = array_key_exists('flyer_brief', $body) || array_key_exists('brief', $body)
            ? (string)($body['flyer_brief'] ?? $body['brief'] ?? '')
            : null;
        $notes = array_key_exists('flyer_style_notes', $body) || array_key_exists('style_notes', $body)
            ? (string)($body['flyer_style_notes'] ?? $body['style_notes'] ?? '')
            : null;
        $result = Celebr8FlyerModel::saveFlyerBrief($partyId, $brief, $notes);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'delete_flyer') {
        $partyId = (int)($body['party_id'] ?? $body['event_id'] ?? 0);
        if ($partyId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'party_id required'], 400);
        }
        $result = Celebr8FlyerModel::deleteCurrentFlyer($partyId);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'restore_flyer_version') {
        $flyerId = (int)($body['flyer_id'] ?? $body['id'] ?? $body['version_id'] ?? 0);
        if ($flyerId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'flyer_id required'], 400);
        }
        $result = Celebr8FlyerModel::restoreFlyerVersion($flyerId);
        catn8_json_response(['success' => true] + $result);
    }

    catn8_json_response(['success' => false, 'error' => 'Unhandled action'], 500);
} catch (InvalidArgumentException $e) {
    catn8_json_response(['success' => false, 'error' => $e->getMessage()], 400);
} catch (Throwable $e) {
    catn8_log_error('celebr8 session API error', ['action' => $action, 'error' => $e->getMessage()]);
    catn8_json_response(['success' => false, 'error' => 'Server error'], 500);
}
