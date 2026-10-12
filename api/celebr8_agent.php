<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/celebr8_model.php';
require_once __DIR__ . '/../includes/celebr8_catalog_model.php';
require_once __DIR__ . '/../includes/celebr8_agent_model.php';
require_once __DIR__ . '/../includes/celebr8_album_model.php';
require_once __DIR__ . '/../includes/celebr8_flyer_model.php';
require_once __DIR__ . '/../includes/tabul8_model.php';
require_once __DIR__ . '/../includes/tabul8_identity_model.php';

Celebr8Model::ensureSchema();
Celebr8CatalogModel::ensureSchema();
Celebr8AgentModel::ensureSchema();
Celebr8AlbumModel::ensureSchema();
Celebr8FlyerModel::ensureSchema();
Tabul8Model::ensureSchema();
Tabul8IdentityModel::ensureSchema();

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
    'list_requests', 'get_request',
    'list_guest_groups', 'get_guest_group',
    'get_album', 'list_photos',
    'get_flyer', 'list_flyer_versions',
    'list_rsvp_history',
    'list_tabul8_categories', 'list_tabul8_entries', 'get_tabul8_entry', 'get_tabul8_board',
    'list_tabul8_identities', 'get_tabul8_identity',
];
$writeActions = [
    'update_event', 'create_event', 'delete_event', 'duplicate_event',
    'upsert_guest', 'set_rsvp', 'set_rsvp_note', 'record_historical_invite',
    'upsert_template', 'delete_template', 'create_event_from_template', 'link_event_template',
    'upsert_activity', 'delete_activity', 'copy_activity', 'copy_event_activity',
    'attach_event_activity', 'update_event_activity', 'detach_event_activity',
    'claim_request', 'reply_request', 'set_request_status', 'queue_outbound_texts',
    'delete_request',
    'upsert_guest_group', 'delete_guest_group',
    'ensure_album', 'upload_photo', 'delete_photo', 'update_photo',
    'set_cover_photo', 'clear_cover_photo', 'reorder_photos', 'move_photo',
    'upload_flyer', 'request_flyer', 'update_flyer_brief',
    'delete_flyer', 'restore_flyer_version',
    'set_tabul8_label', 'upsert_tabul8_entry', 'delete_tabul8_entry',
    'update_tabul8_board', 'set_tabul8_category_voting', 'purge_tabul8_face_data',
    'tabul8_upsert_identity_embeddings',
    'name_tabul8_identity', 'merge_tabul8_identities',
    'purge_tabul8_identity', 'purge_tabul8_identities',
    'set_tabul8_costume_name',
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

// Multipart uploads must be handled before JSON body parsing.
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
            'agent:celebr8'
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
        catn8_log_error('celebr8 agent upload_photo error', ['error' => $e->getMessage()]);
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
        $result = Celebr8FlyerModel::uploadFlyer($partyId, $file, 'agent:celebr8');
        catn8_json_response(['success' => true] + $result);
    } catch (InvalidArgumentException $e) {
        catn8_json_response(['success' => false, 'error' => $e->getMessage()], 400);
    } catch (Throwable $e) {
        catn8_log_error('celebr8 agent upload_flyer error', ['error' => $e->getMessage()]);
        catn8_json_response(['success' => false, 'error' => 'Server error'], 500);
    }
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
        $statusRaw = trim((string)($_GET['status'] ?? 'pending,notified'));
        $statuses = $statusRaw === '' ? null : array_map('trim', explode(',', $statusRaw));
        $limit = (int)($_GET['limit'] ?? 50);
        $type = trim((string)($_GET['request_type'] ?? $_GET['type'] ?? '')) ?: null;
        catn8_json_response([
            'success' => true,
            'requests' => Celebr8AgentModel::listRequests($partyId, $statuses, $limit, $type),
            'queue_cap_per_request' => Celebr8AgentModel::queueCapPerRequest(),
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
        $create = trim((string)($_GET['create'] ?? '')) !== '';
        $album = null;
        if ($albumId > 0) {
            $album = Celebr8AlbumModel::getAlbum($albumId);
        } elseif ($partyId > 0) {
            $album = $create
                ? Celebr8AlbumModel::getOrCreateAlbumForParty($partyId)
                : Celebr8AlbumModel::getAlbumByParty($partyId);
            if (!$album && !$create) {
                // On-demand create when missing so agent can always resolve an album.
                $album = Celebr8AlbumModel::getOrCreateAlbumForParty($partyId);
            }
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

    if ($action === 'set_rsvp_note') {
        $eventId = (int)($body['party_id'] ?? $body['event_id'] ?? 0);
        if ($eventId <= 0 && !empty($body['slug'])) {
            $found = Celebr8Model::getEventBySlug((string)$body['slug']);
            $eventId = $found ? (int)$found['id'] : 0;
        }
        if ($eventId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'party_id or event_id required'], 400);
        }
        $result = Celebr8Model::setRsvpNote(
            $eventId,
            [
                'guest_id' => (int)($body['guest_id'] ?? 0),
                'phone' => (string)($body['phone'] ?? ''),
            ],
            $body,
            $actorLabel
        );
        catn8_json_response([
            'success' => true,
            'guest' => $result['guest'],
            'note' => $result['note'],
            'deduped' => $result['deduped'],
            'status_updated' => !empty($result['status_updated']),
            'totals' => $result['totals'],
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

    if ($action === 'claim_request') {
        $requestId = (int)($body['request_id'] ?? $body['id'] ?? 0);
        if ($requestId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'request_id required'], 400);
        }
        $claimedBy = trim((string)($body['claimed_by'] ?? 'celebr8r'));
        $req = Celebr8AgentModel::claimRequest($requestId, $claimedBy);
        if (!$req) {
            catn8_json_response(['success' => false, 'error' => 'Request not found'], 404);
        }
        catn8_json_response([
            'success' => true,
            'request' => $req,
            'thread' => Celebr8AgentModel::listThread($requestId),
        ]);
    }

    if ($action === 'reply_request') {
        $requestId = (int)($body['request_id'] ?? $body['id'] ?? 0);
        if ($requestId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'request_id required'], 400);
        }
        $role = strtolower(trim((string)($body['author_role'] ?? $body['role'] ?? 'celebr8r')));
        if ($role === 'jon') {
            // Agent should not impersonate Jon; use needs_jon / set_request_status instead.
            catn8_json_response(['success' => false, 'error' => 'Agent cannot post as jon'], 400);
        }
        if (!in_array($role, ['celebr8r', 'system'], true)) {
            $role = 'celebr8r';
        }
        $msg = Celebr8AgentModel::addThreadMessage(
            $requestId,
            $role,
            (string)($body['body'] ?? $body['text'] ?? ''),
            null
        );
        $status = trim((string)($body['status'] ?? ''));
        $req = null;
        if ($status !== '') {
            $req = Celebr8AgentModel::setRequestStatus($requestId, $status);
        } else {
            $req = Celebr8AgentModel::getRequest($requestId);
        }
        catn8_json_response([
            'success' => true,
            'message' => $msg,
            'request' => $req,
            'thread' => Celebr8AgentModel::listThread($requestId),
        ]);
    }

    if ($action === 'set_request_status') {
        $requestId = (int)($body['request_id'] ?? $body['id'] ?? 0);
        if ($requestId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'request_id required'], 400);
        }
        $req = Celebr8AgentModel::setRequestStatus($requestId, (string)($body['status'] ?? ''));
        catn8_json_response(['success' => true, 'request' => $req]);
    }

    if ($action === 'delete_request') {
        $requestId = (int)($body['request_id'] ?? $body['id'] ?? 0);
        if ($requestId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'request_id required'], 400);
        }
        if (!Celebr8AgentModel::deleteRequest($requestId)) {
            catn8_json_response(['success' => false, 'error' => 'Request not found'], 404);
        }
        catn8_json_response(['success' => true, 'deleted' => true, 'request_id' => $requestId]);
    }

    if ($action === 'queue_outbound_texts') {
        $requestId = (int)($body['request_id'] ?? $body['id'] ?? 0);
        if ($requestId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'request_id required'], 400);
        }
        $messages = $body['messages'] ?? $body['texts'] ?? null;
        if (!is_array($messages)) {
            catn8_json_response(['success' => false, 'error' => 'messages array required'], 400);
        }
        $result = Celebr8AgentModel::queueOutboundForRequest($requestId, $messages);
        catn8_json_response([
            'success' => true,
            'queued' => $result['queued'],
            'skipped' => $result['skipped'],
            'queued_count' => count($result['queued']),
            'queue_cap' => $result['queue_cap'],
            'queued_for_request' => $result['queued_for_request'],
            'request' => Celebr8AgentModel::getRequest($requestId),
        ]);
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
        $result = Celebr8AgentModel::requestFlyer($partyId, null, $extraNotes, $regenerate);
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

    if ($action === 'get_tabul8_board') {
        $partyId = (int)($_GET['party_id'] ?? $_GET['event_id'] ?? 0);
        $boardId = (int)($_GET['board_id'] ?? 0);
        if ($boardId <= 0 && $partyId > 0) {
            $ensured = Tabul8Model::ensureBoard($partyId);
            catn8_json_response(['success' => true, 'board' => $ensured['board'], 'categories' => $ensured['categories']]);
        }
        $board = Tabul8Model::getBoard($boardId);
        if (!$board) {
            catn8_json_response(['success' => false, 'error' => 'Board not found'], 404);
        }
        catn8_json_response([
            'success' => true,
            'board' => $board,
            'categories' => Tabul8Model::listCategories((int)$board['id']),
        ]);
    }

    if ($action === 'list_tabul8_categories') {
        $partyId = (int)($_GET['party_id'] ?? $_GET['event_id'] ?? 0);
        $boardId = (int)($_GET['board_id'] ?? 0);
        if ($boardId <= 0 && $partyId > 0) {
            $ensured = Tabul8Model::ensureBoard($partyId);
            $boardId = (int)$ensured['board']['id'];
        }
        catn8_json_response([
            'success' => true,
            'categories' => Tabul8Model::listCategories($boardId),
        ]);
    }

    if ($action === 'list_tabul8_entries') {
        $partyId = (int)($_GET['party_id'] ?? $_GET['event_id'] ?? 0);
        $boardId = (int)($_GET['board_id'] ?? 0);
        $categoryId = isset($_GET['category_id']) ? (int)$_GET['category_id'] : null;
        if ($boardId <= 0 && $partyId > 0) {
            $board = Tabul8Model::getBoardByParty($partyId);
            $boardId = $board ? (int)$board['id'] : 0;
        }
        if ($boardId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'board_id or party_id required'], 400);
        }
        catn8_json_response([
            'success' => true,
            'entries' => Tabul8Model::listEntries($boardId, $categoryId),
        ]);
    }

    if ($action === 'get_tabul8_entry') {
        $id = (int)($_GET['entry_id'] ?? $_GET['id'] ?? 0);
        $entry = Tabul8Model::getEntry($id);
        if (!$entry) {
            catn8_json_response(['success' => false, 'error' => 'Entry not found'], 404);
        }
        catn8_json_response(['success' => true, 'entry' => $entry]);
    }

    if ($action === 'set_tabul8_label') {
        $entryId = (int)($body['entry_id'] ?? $body['id'] ?? 0);
        $label = trim((string)($body['label'] ?? ''));
        $description = array_key_exists('description', $body)
            ? (string)$body['description']
            : null;
        $entry = Tabul8Model::setEntryLabel($entryId, $label, $description);
        $requestId = (int)($body['request_id'] ?? 0);
        if ($requestId > 0) {
            Celebr8AgentModel::addThreadMessage(
                $requestId,
                'celebr8r',
                'Labeled entry #' . $entryId . ': ' . $label,
                null
            );
            Celebr8AgentModel::setRequestStatus($requestId, 'done');
        }
        catn8_json_response(['success' => true, 'entry' => $entry]);
    }

    if ($action === 'upsert_tabul8_entry') {
        $requestLabel = !empty($body['request_label']);
        $entry = Tabul8Model::upsertEntry($body, null, $requestLabel);
        catn8_json_response(['success' => true, 'entry' => $entry]);
    }

    if ($action === 'delete_tabul8_entry') {
        $id = (int)($body['entry_id'] ?? $body['id'] ?? 0);
        if (!Tabul8Model::deleteEntry($id)) {
            catn8_json_response(['success' => false, 'error' => 'Entry not found'], 404);
        }
        catn8_json_response(['success' => true]);
    }

    if ($action === 'update_tabul8_board') {
        $boardId = (int)($body['board_id'] ?? $body['id'] ?? 0);
        catn8_json_response([
            'success' => true,
            'board' => Tabul8Model::updateBoard($boardId, $body),
        ]);
    }

    if ($action === 'set_tabul8_category_voting') {
        $id = (int)($body['category_id'] ?? $body['id'] ?? 0);
        $cat = Tabul8Model::getCategory($id);
        if (!$cat) {
            catn8_json_response(['success' => false, 'error' => 'Category not found'], 404);
        }
        catn8_json_response([
            'success' => true,
            'category' => Tabul8Model::upsertCategory([
                'id' => $id,
                'name' => $cat['name'],
                'voting_open' => !empty($body['voting_open']) ? 1 : 0,
            ]),
        ]);
    }

    if ($action === 'purge_tabul8_face_data') {
        $partyId = (int)($body['party_id'] ?? $body['event_id'] ?? 0);
        catn8_json_response([
            'success' => true,
            'purged' => Tabul8Model::purgeFaceDataForParty($partyId),
            'note' => 'Legacy party-scoped embeddings only; persistent identities untouched',
        ]);
    }

    if ($action === 'list_tabul8_identities') {
        $guestId = isset($_GET['guest_id']) ? (int)$_GET['guest_id'] : null;
        $q = isset($_GET['q']) ? (string)$_GET['q'] : null;
        catn8_json_response([
            'success' => true,
            'identities' => Tabul8IdentityModel::listIdentities($guestId, $q),
        ]);
    }

    if ($action === 'get_tabul8_identity') {
        $id = (int)($_GET['identity_id'] ?? $_GET['id'] ?? 0);
        $ident = Tabul8IdentityModel::getIdentity($id);
        if (!$ident) {
            catn8_json_response(['success' => false, 'error' => 'Identity not found'], 404);
        }
        catn8_json_response(['success' => true, 'identity' => $ident]);
    }

    if ($action === 'tabul8_upsert_identity_embeddings') {
        catn8_json_response([
            'success' => true,
        ] + Tabul8IdentityModel::upsertIdentityEmbeddings($body));
    }

    if ($action === 'name_tabul8_identity') {
        $id = (int)($body['identity_id'] ?? $body['id'] ?? 0);
        catn8_json_response([
            'success' => true,
            'identity' => Tabul8IdentityModel::updateIdentity($id, $body),
        ]);
    }

    if ($action === 'merge_tabul8_identities') {
        $keep = (int)($body['keep_id'] ?? $body['identity_id'] ?? 0);
        $absorb = (int)($body['absorb_id'] ?? $body['merge_id'] ?? 0);
        catn8_json_response([
            'success' => true,
            'identity' => Tabul8IdentityModel::mergeIdentities($keep, $absorb),
        ]);
    }

    if ($action === 'purge_tabul8_identity') {
        $id = (int)($body['identity_id'] ?? $body['id'] ?? 0);
        if (!Tabul8IdentityModel::purgeIdentity($id)) {
            catn8_json_response(['success' => false, 'error' => 'Identity not found'], 404);
        }
        catn8_json_response(['success' => true]);
    }

    if ($action === 'purge_tabul8_identities') {
        if (empty($body['confirm'])) {
            catn8_json_response(['success' => false, 'error' => 'confirm=1 required'], 400);
        }
        catn8_json_response([
            'success' => true,
            'purged' => Tabul8IdentityModel::purgeAllIdentities(),
        ]);
    }

    if ($action === 'set_tabul8_costume_name') {
        $guestId = (int)($body['guest_id'] ?? 0);
        $costume = trim((string)($body['costume_name'] ?? $body['name'] ?? ''));
        if ($guestId <= 0 || $costume === '') {
            catn8_json_response(['success' => false, 'error' => 'guest_id and costume_name required'], 400);
        }
        $guest = Celebr8Model::setGuestCostume($guestId, $costume);
        if ($guest) {
            require_once __DIR__ . '/../includes/tabul8_model.php';
            Tabul8Model::syncGuestCostumeLabels((int)$guest['event_id'], $guestId, $costume);
        }
        $requestId = (int)($body['request_id'] ?? 0);
        if ($requestId > 0) {
            Celebr8AgentModel::addThreadMessage(
                $requestId,
                'celebr8r',
                'Costume name for guest #' . $guestId . ': ' . $costume,
                null
            );
            Celebr8AgentModel::setRequestStatus($requestId, 'done');
        }
        catn8_json_response(['success' => true, 'guest' => $guest]);
    }

    catn8_json_response(['success' => false, 'error' => 'Unhandled action'], 500);
} catch (InvalidArgumentException $e) {
    catn8_json_response(['success' => false, 'error' => $e->getMessage()], 400);
} catch (Throwable $e) {
    catn8_log_error('celebr8 agent API error', ['action' => $action, 'error' => $e->getMessage()]);
    catn8_json_response(['success' => false, 'error' => 'Server error'], 500);
}
