<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/celebr8_model.php';
require_once __DIR__ . '/../includes/celebr8_album_model.php';
require_once __DIR__ . '/../includes/celebr8_agent_model.php';
require_once __DIR__ . '/../includes/tabul8_model.php';
require_once __DIR__ . '/../includes/tabul8_ai_label.php';
require_once __DIR__ . '/../includes/tabul8_identity_model.php';

catn8_session_start();
Celebr8Model::ensureSchema();
Celebr8AlbumModel::ensureSchema();
Celebr8AgentModel::ensureSchema();
Tabul8Model::ensureSchema();
Tabul8IdentityModel::ensureSchema();

$action = trim((string)($_GET['action'] ?? ''));
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));

/**
 * Phone-only (short-lived signed token; no login). Off unless phone_voting_open.
 * Kiosk voting uses session login + board_id.
 */
$phoneRead = ['public_state', 'public_tallies'];
$phoneWrite = ['cast_vote']; // only when vote_token (+exp/sig) present

/** Authenticated read (any logged-in user — kiosk tablet). */
$authRead = [
    'ensure_board', 'get_board', 'list_categories', 'list_entries', 'get_entry',
    'get_tallies', 'list_votes', 'list_vote_audit', 'kiosk_state',
    'list_identities', 'get_identity', 'party_identity_pack',
];
/** Admin writes. */
$authAdminWrite = [
    'update_board', 'rotate_vote_token',
    'upsert_category', 'delete_category', 'set_category_voting',
    'upsert_entry', 'delete_entry', 'merge_entries', 'move_entry',
    'request_entry_label',
    'void_vote', 'purge_face_data', 'save_results',
    'upload_entry_photo',
    'name_identity', 'merge_identities', 'purge_identity', 'purge_all_identities',
    'confirm_pending_guest', 'unlink_identity_guest', 'link_identity_guest',
];
/** Logged-in station writes (any user — kiosk tablet / display QR mint / check-in). */
$authKioskWrite = [
    'cast_kiosk_vote', 'mint_phone_vote_link',
    'match_embedding', 'checkin_enroll',
    'kiosk_voter_state', 'match_guest_name', 'register_voter',
    'set_costume_name', 'suggest_costume_name',
];

$isPhone = in_array($action, array_merge($phoneRead, $phoneWrite), true);
$isAuthRead = in_array($action, $authRead, true);
$isAuthAdmin = in_array($action, $authAdminWrite, true);
$isAuthKiosk = in_array($action, $authKioskWrite, true);

if ($action === '' || (!$isPhone && !$isAuthRead && !$isAuthAdmin && !$isAuthKiosk)) {
    catn8_json_response(['success' => false, 'error' => 'Unknown or missing action'], 400);
}

$uid = catn8_auth_user_id();

if ($isAuthRead || $isAuthAdmin || $isAuthKiosk) {
    if ($uid === null) {
        catn8_json_response(['success' => false, 'error' => 'Not authenticated'], 401);
    }
    if ($isAuthAdmin || $isAuthKiosk) {
        catn8_require_method('POST');
        catn8_require_csrf();
        if ($isAuthAdmin && !catn8_user_is_admin($uid)) {
            catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
        }
    } else {
        catn8_require_method('GET');
    }
} else {
    // Phone paths: cast_vote may be POST without CSRF; reads are GET.
    if (in_array($action, $phoneWrite, true)) {
        catn8_require_method('POST', false);
    } else {
        catn8_require_method('GET', false);
    }
}

$body = [];
if ($method === 'POST' && $action !== 'upload_entry_photo') {
    $raw = file_get_contents('php://input');
    if (is_string($raw) && $raw !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $body = $decoded;
        }
    }
    if ($body === [] && !empty($_POST)) {
        $body = $_POST;
    }
}

try {
    if ($action === 'public_state' || $action === 'public_tallies') {
        $token = trim((string)($_GET['vote_token'] ?? $_GET['token'] ?? ''));
        $exp = (int)($_GET['exp'] ?? 0);
        $sig = trim((string)($_GET['sig'] ?? ''));
        catn8_json_response(['success' => true] + Tabul8Model::publicBoardState($token, $exp, $sig));
    }

    if ($action === 'kiosk_state') {
        $partyId = (int)($_GET['party_id'] ?? $_GET['event_id'] ?? 0);
        $boardId = (int)($_GET['board_id'] ?? 0);
        $board = $boardId > 0
            ? Tabul8Model::getBoard($boardId)
            : Tabul8Model::getBoardByParty($partyId);
        if (!$board) {
            catn8_json_response(['success' => false, 'error' => 'Board not found'], 404);
        }
        catn8_json_response(['success' => true] + Tabul8Model::voteBoardState((int)$board['id']));
    }

    if ($action === 'cast_vote') {
        // Phone path only (token + short-lived signature).
        if (trim((string)($body['vote_token'] ?? '')) === '') {
            catn8_json_response(['success' => false, 'error' => 'Phone vote requires vote_token'], 400);
        }
        $result = Tabul8Model::castVote($body, false);
        catn8_json_response([
            'success' => empty($result['blocked']),
            'blocked' => !empty($result['blocked']),
        ] + $result);
    }

    if ($action === 'cast_kiosk_vote') {
        $result = Tabul8Model::castVote($body, true);
        catn8_json_response([
            'success' => empty($result['blocked']),
            'blocked' => !empty($result['blocked']),
        ] + $result);
    }

    if ($action === 'ensure_board') {
        $partyId = (int)($_GET['party_id'] ?? $_GET['event_id'] ?? $body['party_id'] ?? $body['event_id'] ?? 0);
        if ($method === 'GET') {
            // allow GET ensure for convenience
        }
        $out = Tabul8Model::ensureBoard($partyId);
        $party = Celebr8Model::getEvent($partyId);
        catn8_json_response(['success' => true] + $out + ['party' => $party]);
    }

    if ($action === 'get_board') {
        $partyId = (int)($_GET['party_id'] ?? $_GET['event_id'] ?? 0);
        $boardId = (int)($_GET['board_id'] ?? 0);
        $board = $boardId > 0
            ? Tabul8Model::getBoard($boardId)
            : Tabul8Model::getBoardByParty($partyId);
        if (!$board) {
            catn8_json_response(['success' => false, 'error' => 'Board not found'], 404);
        }
        catn8_json_response([
            'success' => true,
            'board' => $board,
            'categories' => Tabul8Model::listCategories((int)$board['id']),
        ]);
    }

    if ($action === 'list_categories') {
        $boardId = (int)($_GET['board_id'] ?? 0);
        catn8_json_response(['success' => true, 'categories' => Tabul8Model::listCategories($boardId)]);
    }

    if ($action === 'list_entries') {
        $boardId = (int)($_GET['board_id'] ?? 0);
        $categoryId = isset($_GET['category_id']) ? (int)$_GET['category_id'] : null;
        catn8_json_response([
            'success' => true,
            'entries' => Tabul8Model::listEntries($boardId, $categoryId),
        ]);
    }

    if ($action === 'get_entry') {
        $id = (int)($_GET['entry_id'] ?? $_GET['id'] ?? 0);
        $entry = Tabul8Model::getEntry($id);
        if (!$entry) {
            catn8_json_response(['success' => false, 'error' => 'Entry not found'], 404);
        }
        catn8_json_response(['success' => true, 'entry' => $entry]);
    }

    if ($action === 'get_tallies') {
        $boardId = (int)($_GET['board_id'] ?? 0);
        catn8_json_response(['success' => true] + Tabul8Model::getTallies($boardId));
    }

    if ($action === 'list_votes') {
        $boardId = (int)($_GET['board_id'] ?? 0);
        $categoryId = isset($_GET['category_id']) ? (int)$_GET['category_id'] : null;
        $includeVoid = !empty($_GET['include_void']);
        catn8_json_response([
            'success' => true,
            'votes' => Tabul8Model::listVotes($boardId, $categoryId, $includeVoid),
        ]);
    }

    if ($action === 'list_vote_audit') {
        $boardId = (int)($_GET['board_id'] ?? 0);
        $categoryId = isset($_GET['category_id']) ? (int)$_GET['category_id'] : null;
        catn8_json_response([
            'success' => true,
            'votes' => Tabul8Model::listVoteAudit($boardId, $categoryId),
            'thresholds' => [
                'greet' => Tabul8IdentityModel::GREET_THRESHOLD,
                'match' => Tabul8IdentityModel::MATCH_THRESHOLD,
                'model' => Tabul8IdentityModel::MODEL_NAME,
                'model_version' => Tabul8IdentityModel::MODEL_VERSION,
            ],
        ]);
    }

    if ($action === 'list_identities') {
        $guestId = isset($_GET['guest_id']) ? (int)$_GET['guest_id'] : null;
        $q = isset($_GET['q']) ? (string)$_GET['q'] : null;
        catn8_json_response([
            'success' => true,
            'identities' => Tabul8IdentityModel::listIdentities($guestId, $q),
        ]);
    }

    if ($action === 'get_identity') {
        $id = (int)($_GET['identity_id'] ?? $_GET['id'] ?? 0);
        $ident = Tabul8IdentityModel::getIdentity($id);
        if (!$ident) {
            catn8_json_response(['success' => false, 'error' => 'Identity not found'], 404);
        }
        catn8_json_response(['success' => true, 'identity' => $ident]);
    }

    if ($action === 'party_identity_pack') {
        $partyId = (int)($_GET['party_id'] ?? $_GET['event_id'] ?? 0);
        catn8_json_response([
            'success' => true,
            'pack' => Tabul8IdentityModel::partyIdentityPack($partyId),
        ]);
    }

    if ($action === 'update_board') {
        $boardId = (int)($body['board_id'] ?? $body['id'] ?? 0);
        catn8_json_response([
            'success' => true,
            'board' => Tabul8Model::updateBoard($boardId, $body),
        ]);
    }

    if ($action === 'rotate_vote_token') {
        $boardId = (int)($body['board_id'] ?? $body['id'] ?? 0);
        catn8_json_response([
            'success' => true,
            'board' => Tabul8Model::rotateVoteToken($boardId),
        ]);
    }

    if ($action === 'mint_phone_vote_link') {
        $boardId = (int)($body['board_id'] ?? $body['id'] ?? 0);
        $ttl = isset($body['ttl_seconds']) ? (int)$body['ttl_seconds'] : null;
        $link = Tabul8Model::mintPhoneVoteLink($boardId, $ttl);
        catn8_json_response([
            'success' => true,
            'link' => $link,
            'board' => Tabul8Model::getBoard($boardId),
        ]);
    }

    if ($action === 'upsert_category') {
        catn8_json_response([
            'success' => true,
            'category' => Tabul8Model::upsertCategory($body),
        ]);
    }

    if ($action === 'delete_category') {
        $id = (int)($body['category_id'] ?? $body['id'] ?? 0);
        if (!Tabul8Model::deleteCategory($id)) {
            catn8_json_response(['success' => false, 'error' => 'Category not found'], 404);
        }
        catn8_json_response(['success' => true]);
    }

    if ($action === 'set_category_voting') {
        $id = (int)($body['category_id'] ?? $body['id'] ?? 0);
        $open = !empty($body['voting_open']);
        $cat = Tabul8Model::getCategory($id);
        if (!$cat) {
            catn8_json_response(['success' => false, 'error' => 'Category not found'], 404);
        }
        catn8_json_response([
            'success' => true,
            'category' => Tabul8Model::upsertCategory([
                'id' => $id,
                'name' => $cat['name'],
                'voting_open' => $open ? 1 : 0,
            ]),
        ]);
    }

    if ($action === 'upsert_entry') {
        $requestLabel = !empty($body['request_label']);
        catn8_json_response([
            'success' => true,
            'entry' => Tabul8Model::upsertEntry($body, $uid, $requestLabel),
        ]);
    }

    if ($action === 'request_entry_label') {
        $id = (int)($body['entry_id'] ?? $body['id'] ?? 0);
        $entry = Tabul8Model::getEntry($id);
        if (!$entry) {
            catn8_json_response(['success' => false, 'error' => 'Entry not found'], 404);
        }
        catn8_json_response([
            'success' => true,
            'entry' => Tabul8Model::queueLabelRequest($entry, $uid),
        ]);
    }

    if ($action === 'delete_entry') {
        $id = (int)($body['entry_id'] ?? $body['id'] ?? 0);
        if (!Tabul8Model::deleteEntry($id)) {
            catn8_json_response(['success' => false, 'error' => 'Entry not found'], 404);
        }
        catn8_json_response(['success' => true]);
    }

    if ($action === 'merge_entries') {
        $target = (int)($body['target_id'] ?? 0);
        $source = (int)($body['source_id'] ?? 0);
        catn8_json_response([
            'success' => true,
            'entry' => Tabul8Model::mergeEntries($target, $source),
        ]);
    }

    if ($action === 'move_entry') {
        $id = (int)($body['entry_id'] ?? $body['id'] ?? 0);
        $categoryId = (int)($body['category_id'] ?? 0);
        catn8_json_response([
            'success' => true,
            'entry' => Tabul8Model::upsertEntry([
                'id' => $id,
                'category_id' => $categoryId,
            ], $uid, false),
        ]);
    }

    if ($action === 'void_vote') {
        $id = (int)($body['vote_id'] ?? $body['id'] ?? 0);
        if (!Tabul8Model::voidVote($id)) {
            catn8_json_response(['success' => false, 'error' => 'Vote not found'], 404);
        }
        $boardId = (int)($body['board_id'] ?? 0);
        $tallies = $boardId > 0 ? Tabul8Model::getTallies($boardId) : null;
        catn8_json_response(['success' => true, 'tallies' => $tallies]);
    }

    if ($action === 'purge_face_data') {
        $partyId = (int)($body['party_id'] ?? $body['event_id'] ?? 0);
        $count = Tabul8Model::purgeFaceDataForParty($partyId);
        catn8_json_response([
            'success' => true,
            'purged' => $count,
            'note' => 'Cleared legacy party-scoped embeddings only; persistent identities are untouched',
        ]);
    }

    if ($action === 'name_identity') {
        $id = (int)($body['identity_id'] ?? $body['id'] ?? 0);
        $fields = $body;
        $fields['admin_named'] = 1;
        catn8_json_response([
            'success' => true,
            'identity' => Tabul8IdentityModel::updateIdentity($id, $fields),
        ]);
    }

    if ($action === 'confirm_pending_guest') {
        $id = (int)($body['identity_id'] ?? $body['id'] ?? 0);
        $guestId = isset($body['guest_id']) && $body['guest_id'] !== '' ? (int)$body['guest_id'] : null;
        catn8_json_response([
            'success' => true,
            'identity' => Tabul8IdentityModel::confirmPendingGuestLink($id, $guestId),
        ]);
    }

    if ($action === 'link_identity_guest') {
        $id = (int)($body['identity_id'] ?? $body['id'] ?? 0);
        $guestId = (int)($body['guest_id'] ?? 0);
        catn8_json_response([
            'success' => true,
            'identity' => Tabul8IdentityModel::updateIdentity($id, [
                'guest_id' => $guestId,
                'admin_named' => 1,
                'pending_guest_id' => null,
            ]),
        ]);
    }

    if ($action === 'unlink_identity_guest') {
        $id = (int)($body['identity_id'] ?? $body['id'] ?? 0);
        catn8_json_response([
            'success' => true,
            'identity' => Tabul8IdentityModel::unlinkGuest($id),
        ]);
    }

    if ($action === 'merge_identities') {
        $keep = (int)($body['keep_id'] ?? $body['identity_id'] ?? 0);
        $absorb = (int)($body['absorb_id'] ?? $body['merge_id'] ?? 0);
        catn8_json_response([
            'success' => true,
            'identity' => Tabul8IdentityModel::mergeIdentities($keep, $absorb),
        ]);
    }

    if ($action === 'purge_identity') {
        $id = (int)($body['identity_id'] ?? $body['id'] ?? 0);
        if (!Tabul8IdentityModel::purgeIdentity($id)) {
            catn8_json_response(['success' => false, 'error' => 'Identity not found'], 404);
        }
        catn8_json_response(['success' => true]);
    }

    if ($action === 'purge_all_identities') {
        if (empty($body['confirm'])) {
            catn8_json_response(['success' => false, 'error' => 'confirm=1 required'], 400);
        }
        catn8_json_response([
            'success' => true,
            'purged' => Tabul8IdentityModel::purgeAllIdentities(),
        ]);
    }

    if ($action === 'match_embedding') {
        $vector = $body['embedding'] ?? $body['vector'] ?? null;
        if (!is_array($vector)) {
            catn8_json_response(['success' => false, 'error' => 'embedding required'], 400);
        }
        $threshold = isset($body['threshold']) ? (float)$body['threshold'] : null;
        catn8_json_response([
            'success' => true,
            'match' => Tabul8IdentityModel::matchEmbedding($vector, $threshold),
        ]);
    }

    if ($action === 'checkin_enroll') {
        $partyId = (int)($body['party_id'] ?? $body['event_id'] ?? 0);
        $vector = $body['embedding'] ?? $body['vector'] ?? null;
        if (!is_array($vector)) {
            catn8_json_response(['success' => false, 'error' => 'embedding required'], 400);
        }
        $guestId = isset($body['guest_id']) && $body['guest_id'] !== '' ? (int)$body['guest_id'] : null;
        $name = isset($body['display_name']) ? (string)$body['display_name'] : null;
        catn8_json_response([
            'success' => true,
        ] + Tabul8IdentityModel::checkInEnroll($partyId, $vector, $guestId, $name));
    }

    if ($action === 'kiosk_voter_state') {
        $partyId = (int)($body['party_id'] ?? $body['event_id'] ?? 0);
        $identityId = isset($body['identity_id']) && $body['identity_id'] !== ''
            ? (int)$body['identity_id'] : null;
        catn8_json_response([
            'success' => true,
        ] + Tabul8Model::kioskVoterState($partyId, $identityId));
    }

    if ($action === 'match_guest_name') {
        $partyId = (int)($body['party_id'] ?? $body['event_id'] ?? 0);
        $name = trim((string)($body['name'] ?? ''));
        catn8_json_response([
            'success' => true,
            'match' => Celebr8Model::matchGuestName($partyId, $name),
        ]);
    }

    if ($action === 'register_voter') {
        // Unrecognized kiosk voter: create/link guest, enroll face, optional costume.
        $partyId = (int)($body['party_id'] ?? $body['event_id'] ?? 0);
        $name = trim((string)($body['name'] ?? ''));
        $costume = trim((string)($body['costume_name'] ?? ''));
        $vector = $body['embedding'] ?? $body['vector'] ?? null;
        $confirmGuestId = isset($body['confirm_guest_id']) && $body['confirm_guest_id'] !== ''
            ? (int)$body['confirm_guest_id'] : null;
        if ($partyId <= 0 || $name === '') {
            catn8_json_response(['success' => false, 'error' => 'party_id and name required'], 400);
        }
        if (Celebr8Model::isBlockedGuestName($name)) {
            catn8_json_response(['success' => false, 'error' => 'That name cannot be used'], 400);
        }
        if (!is_array($vector)) {
            catn8_json_response(['success' => false, 'error' => 'embedding required'], 400);
        }

        $guestId = $confirmGuestId;
        $match = null;
        if (!$guestId) {
            $match = Celebr8Model::matchGuestName($partyId, $name);
            if (($match['status'] ?? '') === 'ambiguous') {
                catn8_json_response([
                    'success' => false,
                    'error' => 'ambiguous_guest',
                    'match' => $match,
                ], 409);
            }
            if (($match['status'] ?? '') === 'exact' || ($match['status'] ?? '') === 'fuzzy') {
                // Fuzzy still requires client confirm unless they already sent confirm_guest_id.
                if (($match['status'] ?? '') === 'fuzzy') {
                    catn8_json_response([
                        'success' => false,
                        'error' => 'confirm_fuzzy',
                        'match' => $match,
                    ], 409);
                }
                $guestId = (int)($match['guest']['id'] ?? 0);
            }
        }
        if (!$guestId) {
            $guest = Celebr8Model::upsertGuest($partyId, [
                'name' => $name,
                'costume_name' => $costume,
                'rsvp_status' => 'going',
            ], 'tabul8:kiosk', true);
            $guestId = (int)$guest['id'];
        }

        $enroll = Tabul8IdentityModel::checkInEnroll($partyId, $vector, $guestId, $name);
        $identityId = (int)($enroll['identity']['id'] ?? 0);
        Celebr8Model::markGuestCheckedIn($guestId, $identityId > 0 ? $identityId : null);
        if ($costume !== '') {
            Celebr8Model::setGuestCostume($guestId, $costume, $identityId > 0 ? $identityId : null);
            // Sync label onto existing costume-contest entries only (photos stay party-album owned).
            Tabul8Model::syncGuestCostumeLabels($partyId, $guestId, $costume);
        }

        catn8_json_response([
            'success' => true,
            'guest' => Celebr8Model::getGuest($guestId),
            'identity' => $enroll['identity'] ?? null,
            'enroll' => $enroll,
            'voter_state' => Tabul8Model::kioskVoterState($partyId, $identityId > 0 ? $identityId : null),
        ]);
    }

    if ($action === 'set_costume_name') {
        $guestId = (int)($body['guest_id'] ?? 0);
        $costume = trim((string)($body['costume_name'] ?? ''));
        $identityId = isset($body['identity_id']) && $body['identity_id'] !== ''
            ? (int)$body['identity_id'] : null;
        $guest = Celebr8Model::setGuestCostume($guestId, $costume, $identityId);
        if ($costume !== '' && $guest) {
            Tabul8Model::syncGuestCostumeLabels((int)$guest['event_id'], $guestId, $costume);
        }
        catn8_json_response(['success' => true, 'guest' => $guest]);
    }

    if ($action === 'suggest_costume_name') {
        $partyId = (int)($body['party_id'] ?? $body['event_id'] ?? 0);
        $guestId = isset($body['guest_id']) && $body['guest_id'] !== '' ? (int)$body['guest_id'] : null;
        $identityId = isset($body['identity_id']) && $body['identity_id'] !== ''
            ? (int)$body['identity_id'] : null;
        $image = (string)($body['image_data_url'] ?? $body['image_base64'] ?? '');
        if ($partyId <= 0 || $image === '') {
            catn8_json_response(['success' => false, 'error' => 'party_id and image_data_url required'], 400);
        }
        // Soft-fail wrapper — never throw to kiosk.
        try {
            $result = Tabul8AiLabel::suggestCostumeName($partyId, $image, $guestId, $uid, $identityId);
            catn8_json_response(['success' => true] + $result);
        } catch (Throwable $e) {
            catn8_json_response([
                'success' => true,
                'source' => 'manual',
                'suggestion' => null,
                'error' => 'soft_fail',
                'request_id' => null,
                'photo_id' => null,
            ]);
        }
    }

    if ($action === 'save_results') {
        $boardId = (int)($body['board_id'] ?? $body['id'] ?? 0);
        catn8_json_response(['success' => true] + Tabul8Model::saveResults($boardId));
    }

    if ($action === 'upload_entry_photo') {
        $partyId = (int)($_POST['party_id'] ?? $_POST['event_id'] ?? 0);
        $categoryId = (int)($_POST['category_id'] ?? 0);
        $label = trim((string)($_POST['label'] ?? ''));
        $description = trim((string)($_POST['description'] ?? ''));
        $guestId = isset($_POST['guest_id']) && $_POST['guest_id'] !== '' ? (int)$_POST['guest_id'] : null;
        $requestLabel = !empty($_POST['request_label']);
        $file = $_FILES['file'] ?? $_FILES['photo'] ?? $_FILES['image'] ?? null;
        if (!is_array($file)) {
            catn8_json_response(['success' => false, 'error' => 'multipart file required'], 400);
        }
        $ownerGuestId = isset($_POST['owner_guest_id']) && $_POST['owner_guest_id'] !== ''
            ? (int)$_POST['owner_guest_id'] : null;
        $entryKind = isset($_POST['entry_kind']) ? trim((string)$_POST['entry_kind']) : '';
        $identityId = isset($_POST['identity_id']) && $_POST['identity_id'] !== ''
            ? (int)$_POST['identity_id'] : null;
        $album = Celebr8AlbumModel::getOrCreateAlbumForParty($partyId, 'Party album');
        $uploaded = Celebr8AlbumModel::uploadPhoto(
            $partyId,
            (int)$album['id'],
            $file,
            $label !== '' ? ('Tabul8: ' . $label) : 'Tabul8 contestant',
            null,
            isset($_POST['source_uuid']) ? (string)$_POST['source_uuid'] : null,
            'tabul8:' . $uid
        );
        $photoId = (int)$uploaded['photo']['id'];
        // Party album owns the photo; person + contest are tags only.
        Celebr8AlbumModel::tagPhoto(
            $photoId,
            $guestId,
            $identityId,
            $categoryId > 0 ? $categoryId : null
        );
        // Create entry first (never fail the snap if labeling fails).
        $entryFields = [
            'category_id' => $categoryId,
            'label' => $label,
            'description' => $description,
            'photo_id' => $photoId,
            'guest_id' => $guestId,
        ];
        if ($ownerGuestId) {
            $entryFields['owner_guest_id'] = $ownerGuestId;
        }
        if ($entryKind !== '') {
            $entryFields['entry_kind'] = $entryKind;
        }
        $entry = Tabul8Model::upsertEntry($entryFields, $uid, false);
        $labelMeta = null;
        if (Tabul8AiLabel::shouldLabelOnSnap($requestLabel)) {
            try {
                $labelMeta = Tabul8AiLabel::labelEntry((int)$entry['id'], $uid);
                if (is_array($labelMeta['entry'] ?? null) && $labelMeta['entry'] !== []) {
                    $entry = $labelMeta['entry'];
                }
                $entry['label_source'] = (string)($labelMeta['source'] ?? '');
            } catch (Throwable $e) {
                // Soft-fail: snap already saved.
                catn8_log_error('tabul8 label pipeline soft-fail', ['error' => $e->getMessage()]);
                $entry['label_source'] = 'error';
            }
        }
        catn8_json_response([
            'success' => true,
            'entry' => $entry,
            'photo' => Celebr8AlbumModel::getPhoto($photoId) ?: $uploaded['photo'],
            'album' => $uploaded['album'],
            'deduped' => $uploaded['deduped'],
            'label_result' => $labelMeta ? [
                'source' => $labelMeta['source'] ?? null,
                'error' => $labelMeta['error'] ?? null,
            ] : null,
        ]);
    }

    catn8_json_response(['success' => false, 'error' => 'Unhandled action'], 400);
} catch (InvalidArgumentException $e) {
    catn8_json_response(['success' => false, 'error' => $e->getMessage()], 400);
} catch (Throwable $e) {
    catn8_log_error('tabul8 api error', ['action' => $action, 'error' => $e->getMessage()]);
    catn8_json_response(['success' => false, 'error' => 'Server error'], 500);
}
