<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/rel8ed_model.php';

Rel8edModel::ensureSchema();

$actorUserId = catn8_require_group_or_admin(Rel8edModel::GROUP_SLUG);
$action = trim((string)($_GET['action'] ?? ''));

$readActions = [
    'bootstrap', 'dashboard',
    'list_people', 'get_person', 'search', 'surname_index',
    'pedigree', 'family_group', 'descendants',
    'relationship', 'quality_flags', 'on_this_day',
    'map_places', 'dna', 'list_media', 'list_stories', 'list_audit',
    'export_gedcom', 'list_notes',
];
$writeActions = [
    'upsert_person', 'add_note', 'add_source',
    'import_preview', 'import_apply', 'upload_media',
    'save_dna', 'geocode_places', 'set_root', 'rebuild_quality',
];
$allowed = array_merge($readActions, $writeActions);

if ($action === '' || !in_array($action, $allowed, true)) {
    catn8_json_response(['success' => false, 'error' => 'Unknown or missing action'], 400);
}

if (in_array($action, $writeActions, true)) {
    catn8_require_method('POST');
} else {
    catn8_require_method('GET');
}

try {
    if ($action === 'bootstrap') {
        catn8_json_response(['success' => true] + Rel8edModel::bootstrap($actorUserId));
    }

    if ($action === 'dashboard') {
        Rel8edModel::audit($actorUserId, 'view_dashboard', 'rel8ed', null, null, null, null);
        catn8_json_response(['success' => true, 'dashboard' => Rel8edModel::dashboard($actorUserId)]);
    }

    if ($action === 'list_people' || $action === 'search') {
        $page = Rel8edModel::listPeople(
            $actorUserId,
            (int)($_GET['limit'] ?? 100),
            (int)($_GET['offset'] ?? $_GET['cursor'] ?? 0),
            isset($_GET['q']) ? (string)$_GET['q'] : null,
            isset($_GET['surname']) ? (string)$_GET['surname'] : null
        );
        catn8_json_response(['success' => true] + $page);
    }

    if ($action === 'get_person') {
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) {
            catn8_json_response(['success' => false, 'error' => 'id required'], 400);
        }
        $record = Rel8edModel::getPerson($actorUserId, $id);
        if (!$record) {
            catn8_json_response(['success' => false, 'error' => 'Not found'], 404);
        }
        Rel8edModel::audit($actorUserId, 'view_person', 'rel8ed_people', $id, $id, null, null);
        catn8_json_response(['success' => true, 'record' => $record]);
    }

    if ($action === 'surname_index') {
        catn8_json_response(['success' => true, 'records' => Rel8edModel::surnameIndex($actorUserId)]);
    }

    if ($action === 'pedigree') {
        $id = (int)($_GET['id'] ?? $_GET['person_id'] ?? 0);
        if ($id <= 0) {
            $id = (int)(Rel8edModel::findRootCandidate($actorUserId) ?? 0);
        }
        if ($id <= 0) {
            catn8_json_response(['success' => false, 'error' => 'No root person'], 404);
        }
        $tree = Rel8edModel::pedigree($actorUserId, $id, (int)($_GET['generations'] ?? 5));
        catn8_json_response(['success' => true, 'pedigree' => $tree, 'root_id' => $id]);
    }

    if ($action === 'family_group') {
        $id = (int)($_GET['family_id'] ?? $_GET['id'] ?? 0);
        if ($id <= 0) {
            catn8_json_response(['success' => false, 'error' => 'family_id required'], 400);
        }
        $sheet = Rel8edModel::familyGroup($actorUserId, $id);
        if (!$sheet) {
            catn8_json_response(['success' => false, 'error' => 'Not found'], 404);
        }
        catn8_json_response(['success' => true, 'family_group' => $sheet]);
    }

    if ($action === 'descendants') {
        $id = (int)($_GET['id'] ?? $_GET['person_id'] ?? 0);
        if ($id <= 0) {
            catn8_json_response(['success' => false, 'error' => 'id required'], 400);
        }
        $tree = Rel8edModel::descendants($actorUserId, $id, (int)($_GET['generations'] ?? 4));
        if (!$tree) {
            catn8_json_response(['success' => false, 'error' => 'Not found'], 404);
        }
        catn8_json_response(['success' => true, 'descendants' => $tree]);
    }

    if ($action === 'relationship') {
        $from = (int)($_GET['from_id'] ?? $_GET['from'] ?? 0);
        $to = (int)($_GET['to_id'] ?? $_GET['to'] ?? 0);
        if ($from <= 0 || $to <= 0) {
            catn8_json_response(['success' => false, 'error' => 'from_id and to_id required'], 400);
        }
        catn8_json_response(['success' => true] + Rel8edModel::relationship($actorUserId, $from, $to));
    }

    if ($action === 'quality_flags') {
        catn8_json_response(['success' => true, 'records' => Rel8edModel::listQualityFlags($actorUserId)]);
    }

    if ($action === 'on_this_day') {
        $month = (int)($_GET['month'] ?? date('n'));
        $day = (int)($_GET['day'] ?? date('j'));
        catn8_json_response(['success' => true, 'records' => Rel8edModel::onThisDay($actorUserId, $month, $day)]);
    }

    if ($action === 'map_places') {
        catn8_json_response(['success' => true] + Rel8edModel::mapPlaces($actorUserId));
    }

    if ($action === 'dna') {
        catn8_json_response(['success' => true] + Rel8edModel::getDna($actorUserId));
    }

    if ($action === 'list_media') {
        catn8_json_response(['success' => true] + Rel8edModel::listMedia(
            $actorUserId,
            (int)($_GET['limit'] ?? 100),
            (int)($_GET['offset'] ?? 0)
        ));
    }

    if ($action === 'list_stories' || $action === 'list_notes') {
        catn8_json_response(['success' => true, 'records' => Rel8edModel::listStories($actorUserId)]);
    }

    if ($action === 'list_audit') {
        if (!Rel8edModel::isSiteAdmin($actorUserId)) {
            catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
        }
        catn8_json_response(['success' => true, 'records' => Rel8edModel::listAudit((int)($_GET['limit'] ?? 100))]);
    }

    if ($action === 'export_gedcom') {
        $ged = Rel8edModel::exportGedcom();
        header('Content-Type: text/plain; charset=UTF-8');
        header('Content-Disposition: attachment; filename="rel8ed-export.ged"');
        header('X-Robots-Tag: noindex, nofollow');
        header('Cache-Control: private, no-store');
        echo $ged;
        exit;
    }

    if ($action === 'upsert_person') {
        $body = catn8_read_json_body();
        $record = $body['record'] ?? $body;
        if (!is_array($record)) {
            catn8_json_response(['success' => false, 'error' => 'record object required'], 400);
        }
        $dry = !empty($body['dry_run']);
        $result = Rel8edModel::upsertPerson($record, $actorUserId, $dry);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'add_note') {
        $body = catn8_read_json_body();
        $result = Rel8edModel::addNote($body, $actorUserId, !empty($body['dry_run']));
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'add_source') {
        $body = catn8_read_json_body();
        $result = Rel8edModel::addSource($body, $actorUserId, !empty($body['dry_run']));
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'import_preview') {
        catn8_rate_limit_require('rel8ed_import_' . $actorUserId, 10, 3600);
        $text = '';
        $fileName = null;
        if (!empty($_FILES['file']['tmp_name'])) {
            $fileName = (string)($_FILES['file']['name'] ?? 'upload.ged');
            $text = (string)file_get_contents((string)$_FILES['file']['tmp_name']);
        } else {
            $body = catn8_read_json_body();
            $text = (string)($body['gedcom'] ?? $body['text'] ?? '');
            $fileName = isset($body['file_name']) ? (string)$body['file_name'] : null;
        }
        if (trim($text) === '') {
            catn8_json_response(['success' => false, 'error' => 'GEDCOM content required'], 400);
        }
        $result = Rel8edModel::previewImport($text, $fileName);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'import_apply') {
        catn8_rate_limit_require('rel8ed_import_apply_' . $actorUserId, 5, 3600);
        $body = catn8_read_json_body();
        $importId = (int)($body['import_id'] ?? 0);
        if ($importId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'import_id required'], 400);
        }
        $result = Rel8edModel::applyImport($importId, $actorUserId);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'upload_media') {
        catn8_rate_limit_require('rel8ed_upload_' . $actorUserId, 30, 3600);
        $meta = [
            'title' => (string)($_POST['title'] ?? ''),
            'person_id' => (int)($_POST['person_id'] ?? 0),
            'media_type' => (string)($_POST['media_type'] ?? ''),
            'external_source_id' => (string)($_POST['external_source_id'] ?? ''),
        ];
        $file = $_FILES['file'] ?? $_FILES['media'] ?? null;
        if (!is_array($file)) {
            catn8_json_response(['success' => false, 'error' => 'multipart file field required'], 400);
        }
        $result = Rel8edModel::storeUploadedMedia($file, $meta, $actorUserId);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'save_dna') {
        $body = catn8_read_json_body();
        $result = Rel8edModel::saveDna($body, $actorUserId);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'geocode_places') {
        if (!Rel8edModel::isSiteAdmin($actorUserId)) {
            catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
        }
        $body = catn8_read_json_body();
        $limit = (int)($body['limit'] ?? 10);
        catn8_json_response(['success' => true] + Rel8edModel::geocodePending($limit));
    }

    if ($action === 'set_root') {
        $body = catn8_read_json_body();
        $personId = (int)($body['person_id'] ?? 0);
        if ($personId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'person_id required'], 400);
        }
        Rel8edModel::setRootPerson($personId, $actorUserId);
        catn8_json_response(['success' => true, 'root_person_id' => $personId]);
    }

    if ($action === 'rebuild_quality') {
        if (!Rel8edModel::isSiteAdmin($actorUserId)) {
            catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
        }
        $n = Rel8edModel::rebuildQualityFlags(Rel8edModel::defaultTreeId());
        catn8_json_response(['success' => true, 'flags' => $n]);
    }
} catch (InvalidArgumentException $e) {
    catn8_json_response(['success' => false, 'error' => $e->getMessage()], 400);
} catch (RuntimeException $e) {
    $msg = $e->getMessage();
    $code = $msg === 'Not authorized' ? 403 : 400;
    catn8_json_response(['success' => false, 'error' => $msg], $code);
} catch (Throwable $e) {
    catn8_log_error('rel8ed api error', ['action' => $action, 'error' => $e->getMessage()]);
    catn8_json_response(['success' => false, 'error' => 'Server error'], 500);
}
