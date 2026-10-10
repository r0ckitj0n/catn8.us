<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/medic8_model.php';

Medic8Model::ensureSchema();

$actorUserId = catn8_require_group_or_admin(Medic8Model::GROUP_SLUG);
$action = trim((string)($_GET['action'] ?? ''));

$readActions = [
    'bootstrap', 'dashboard', 'emergency_summary',
    'list', 'get', 'lab_trends', 'list_audit',
];
$writeActions = [
    'upsert', 'delete', 'reveal_sensitive',
    'upload_document', 'ensure_admin_person',
    'link_document', 'unlink_document',
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
        if (Medic8Model::isSiteAdmin($actorUserId)) {
            Medic8Model::ensureAdminPerson($actorUserId, 'Jon Graves');
        }
        catn8_json_response([
            'success' => true,
            'people' => Medic8Model::listAccessiblePeople($actorUserId),
            'is_admin' => Medic8Model::isSiteAdmin($actorUserId) ? 1 : 0,
            'entities' => array_keys(Medic8Model::ENTITY_TABLES),
        ]);
    }

    if ($action === 'ensure_admin_person') {
        if (!Medic8Model::isSiteAdmin($actorUserId)) {
            catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
        }
        $body = catn8_read_json_body();
        $name = trim((string)($body['display_name'] ?? 'Jon Graves'));
        $person = Medic8Model::ensureAdminPerson($actorUserId, $name !== '' ? $name : 'Jon Graves');
        catn8_json_response(['success' => true, 'person' => $person]);
    }

    if ($action === 'dashboard') {
        $personId = (int)($_GET['person_id'] ?? 0);
        if ($personId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'person_id required'], 400);
        }
        Medic8Model::audit($actorUserId, 'view_dashboard', 'medic8_people', $personId, $personId, null, null);
        catn8_json_response(['success' => true, 'dashboard' => Medic8Model::dashboard($actorUserId, $personId)]);
    }

    if ($action === 'emergency_summary') {
        $personId = (int)($_GET['person_id'] ?? 0);
        if ($personId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'person_id required'], 400);
        }
        Medic8Model::audit($actorUserId, 'view_emergency_summary', 'medic8_people', $personId, $personId, null, null);
        catn8_json_response(['success' => true, 'summary' => Medic8Model::emergencySummary($actorUserId, $personId)]);
    }

    if ($action === 'lab_trends') {
        $personId = (int)($_GET['person_id'] ?? 0);
        if ($personId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'person_id required'], 400);
        }
        catn8_json_response(['success' => true, 'trends' => Medic8Model::labTrends($actorUserId, $personId)]);
    }

    if ($action === 'list') {
        $entity = trim((string)($_GET['entity'] ?? ''));
        $personId = isset($_GET['person_id']) ? (int)$_GET['person_id'] : null;
        $limit = (int)($_GET['limit'] ?? 200);
        $offset = (int)($_GET['offset'] ?? $_GET['cursor'] ?? 0);
        $page = Medic8Model::listEntityPage($entity, $actorUserId, $personId, $limit, $offset);
        catn8_json_response([
            'success' => true,
            'entity' => $entity,
        ] + $page);
    }

    if ($action === 'get') {
        $entity = trim((string)($_GET['entity'] ?? ''));
        $id = (int)($_GET['id'] ?? 0);
        $reveal = (int)($_GET['reveal'] ?? 0) === 1;
        if ($id <= 0) {
            catn8_json_response(['success' => false, 'error' => 'id required'], 400);
        }
        $record = Medic8Model::getEntity($entity, $id, $actorUserId, $reveal);
        if (!$record) {
            catn8_json_response(['success' => false, 'error' => 'Not found'], 404);
        }
        Medic8Model::audit($actorUserId, 'view', Medic8Model::ENTITY_TABLES[$entity] ?? $entity, $id, (int)($record['person_id'] ?? 0) ?: null, null, null);
        catn8_json_response(['success' => true, 'record' => $record]);
    }

    if ($action === 'list_audit') {
        if (!Medic8Model::isSiteAdmin($actorUserId)) {
            catn8_json_response(['success' => false, 'error' => 'Not authorized'], 403);
        }
        $personId = isset($_GET['person_id']) ? (int)$_GET['person_id'] : 0;
        $limit = max(1, min(500, (int)($_GET['limit'] ?? 100)));
        if ($personId > 0) {
            $rows = Database::queryAll(
                'SELECT * FROM medic8_audit_log WHERE person_id = ? ORDER BY id DESC LIMIT ' . $limit,
                [$personId]
            );
        } else {
            $rows = Database::queryAll('SELECT * FROM medic8_audit_log ORDER BY id DESC LIMIT ' . $limit);
        }
        catn8_json_response(['success' => true, 'records' => $rows]);
    }

    if ($action === 'upsert') {
        $body = catn8_read_json_body();
        $entity = trim((string)($body['entity'] ?? ''));
        $record = $body['record'] ?? null;
        if (!is_array($record)) {
            catn8_json_response(['success' => false, 'error' => 'record object required'], 400);
        }
        $result = Medic8Model::upsertEntity($entity, $record, $actorUserId, false, null);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'delete') {
        $body = catn8_read_json_body();
        $entity = trim((string)($body['entity'] ?? ''));
        $id = (int)($body['id'] ?? 0);
        $ext = trim((string)($body['external_source_id'] ?? $body['source_id'] ?? ''));
        $hard = array_key_exists('hard', $body) ? !empty($body['hard']) : true;
        if ($entity === '' || ($id <= 0 && $ext === '')) {
            catn8_json_response(['success' => false, 'error' => 'entity and id or external_source_id required'], 400);
        }
        $result = Medic8Model::deleteEntityByKey(
            $entity,
            $id > 0 ? $id : null,
            $ext !== '' ? $ext : null,
            $actorUserId,
            null,
            $hard
        );
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'link_document') {
        $body = catn8_read_json_body();
        $documentId = (int)($body['document_id'] ?? 0);
        if ($documentId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'document_id required'], 400);
        }
        $result = Medic8Model::linkFromSpec($documentId, $body, $actorUserId, null);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'unlink_document') {
        $body = catn8_read_json_body();
        $documentId = (int)($body['document_id'] ?? 0);
        $entity = trim((string)($body['entity'] ?? ''));
        $recordId = Medic8Model::resolveRecordId(
            $entity,
            $body['record_id'] ?? null,
            $body['external_source_id'] ?? $body['source_id'] ?? null
        );
        $result = Medic8Model::unlinkDocument($documentId, $entity, $recordId, $actorUserId, null);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'reveal_sensitive') {
        $body = catn8_read_json_body();
        $entity = trim((string)($body['entity'] ?? ''));
        $id = (int)($body['id'] ?? 0);
        if ($id <= 0) {
            catn8_json_response(['success' => false, 'error' => 'id required'], 400);
        }
        $record = Medic8Model::getEntity($entity, $id, $actorUserId, true);
        if (!$record) {
            catn8_json_response(['success' => false, 'error' => 'Not found'], 404);
        }
        catn8_json_response(['success' => true, 'record' => $record]);
    }

    if ($action === 'upload_document') {
        $meta = [
            'person_id' => (int)($_POST['person_id'] ?? 0),
            'title' => (string)($_POST['title'] ?? ''),
            'doc_type' => (string)($_POST['doc_type'] ?? ''),
            'external_source_id' => (string)($_POST['external_source_id'] ?? $_POST['source_id'] ?? ''),
            'source_ref_id' => (int)($_POST['source_ref_id'] ?? 0),
            'links' => $_POST['links'] ?? $_POST['links_json'] ?? [],
        ];
        if (!empty($_POST['source_json'])) {
            $decoded = json_decode((string)$_POST['source_json'], true);
            if (is_array($decoded)) {
                $meta['source'] = $decoded;
            }
        }
        $file = $_FILES['file'] ?? $_FILES['document'] ?? null;
        if (!is_array($file)) {
            catn8_json_response(['success' => false, 'error' => 'multipart file field required'], 400);
        }
        $result = Medic8Model::storeUploadedDocument($file, $meta, $actorUserId, null);
        catn8_json_response(['success' => true] + $result);
    }
} catch (InvalidArgumentException $e) {
    catn8_json_response(['success' => false, 'error' => $e->getMessage()], 400);
} catch (RuntimeException $e) {
    $msg = $e->getMessage();
    $code = $msg === 'Not authorized' ? 403 : 400;
    catn8_json_response(['success' => false, 'error' => $msg], $code);
} catch (Throwable $e) {
    catn8_log_error('medic8 api error', ['action' => $action, 'error' => $e->getMessage()]);
    catn8_json_response(['success' => false, 'error' => 'Server error'], 500);
}
