<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/medic8_model.php';

Medic8Model::ensureSchema();

function medic8_agent_extract_token(): string
{
    $header = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (preg_match('/^\s*Bearer\s+(\S+)\s*$/i', $header, $m)) {
        return trim($m[1]);
    }
    $alt = trim((string)($_SERVER['HTTP_X_MEDIC8_AGENT_TOKEN'] ?? ''));
    if ($alt !== '') {
        return $alt;
    }
    return trim((string)($_GET['token'] ?? ''));
}

function medic8_agent_uid(): int
{
    $uid = Medic8Model::privilegedUserId();
    if ($uid <= 0) {
        catn8_json_response(['success' => false, 'error' => 'No admin user for agent context'], 500);
    }
    return $uid;
}

function medic8_agent_decode_links($raw): array
{
    if (is_array($raw)) {
        return $raw;
    }
    if (!is_string($raw) || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

$token = medic8_agent_extract_token();
if (!Medic8Model::verifyApiToken($token)) {
    catn8_log_error('medic8 agent auth failure', ['ip' => (string)($_SERVER['REMOTE_ADDR'] ?? '')]);
    catn8_json_response(['success' => false, 'error' => 'Not authenticated'], 401);
}

$action = trim((string)($_GET['action'] ?? ''));
$readActions = [
    'list', 'get', 'list_people', 'dashboard',
];
$writeActions = [
    'import', 'upsert', 'upload_document',
    'delete', 'link_document', 'unlink_document', 'cleanup_duplicates',
];
$allowed = array_merge($readActions, $writeActions);

if ($action === '' || !in_array($action, $allowed, true)) {
    catn8_json_response(['success' => false, 'error' => 'Unknown or missing action'], 400);
}

if (in_array($action, $writeActions, true)) {
    catn8_require_method('POST', false);
} else {
    catn8_require_method('GET', false);
}

$actorLabel = 'agent:medic8';
$actorUid = 0;

try {
    if ($action === 'list_people') {
        $uid = medic8_agent_uid();
        $page = Medic8Model::listEntityPage('people', $uid, null, (int)($_GET['limit'] ?? 200), (int)($_GET['offset'] ?? $_GET['cursor'] ?? 0));
        catn8_json_response(['success' => true, 'people' => $page['records']] + $page);
    }

    if ($action === 'dashboard') {
        $personId = (int)($_GET['person_id'] ?? 0);
        if ($personId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'person_id required'], 400);
        }
        $uid = medic8_agent_uid();
        Medic8Model::audit(null, 'agent_view_dashboard', 'medic8_people', $personId, $personId, null, null, $actorLabel);
        catn8_json_response(['success' => true, 'dashboard' => Medic8Model::dashboard($uid, $personId)]);
    }

    if ($action === 'list') {
        $entity = trim((string)($_GET['entity'] ?? ''));
        $personId = isset($_GET['person_id']) ? (int)$_GET['person_id'] : null;
        $limit = (int)($_GET['limit'] ?? 200);
        $offset = (int)($_GET['offset'] ?? $_GET['cursor'] ?? 0);
        $uid = medic8_agent_uid();
        $page = Medic8Model::listEntityPage($entity, $uid, $personId, $limit, $offset);
        catn8_json_response(['success' => true, 'entity' => $entity] + $page);
    }

    if ($action === 'get') {
        $entity = trim((string)($_GET['entity'] ?? ''));
        $id = (int)($_GET['id'] ?? 0);
        $ext = trim((string)($_GET['external_source_id'] ?? $_GET['source_id'] ?? ''));
        $uid = medic8_agent_uid();
        $row = null;
        if ($id > 0) {
            $row = Medic8Model::getEntity($entity, $id, $uid, false);
        } elseif ($ext !== '') {
            $found = Medic8Model::findEntityRow($entity, null, $ext);
            if ($found) {
                $row = Medic8Model::getEntity($entity, (int)$found['id'], $uid, false);
            }
        }
        if (!$row) {
            catn8_json_response(['success' => false, 'error' => 'Not found'], 404);
        }
        catn8_json_response(['success' => true, 'record' => $row]);
    }

    if ($action === 'upsert') {
        $body = catn8_read_json_body(false);
        $entity = trim((string)($body['entity'] ?? ''));
        $record = $body['record'] ?? null;
        $dryRun = !empty($body['dry_run']);
        if (!is_array($record)) {
            catn8_json_response(['success' => false, 'error' => 'record object required'], 400);
        }
        $result = Medic8Model::upsertEntity($entity, $record, $actorUid, $dryRun, $actorLabel);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'import') {
        $body = catn8_read_json_body(false);
        $entity = trim((string)($body['entity'] ?? ''));
        $rows = $body['records'] ?? $body['items'] ?? null;
        $dryRun = !empty($body['dry_run']);
        if ($entity === '' || !isset(Medic8Model::ENTITY_TABLES[$entity])) {
            catn8_json_response(['success' => false, 'error' => 'entity required'], 400);
        }
        if (!is_array($rows)) {
            catn8_json_response(['success' => false, 'error' => 'records array required'], 400);
        }
        $result = Medic8Model::importBatch($entity, $rows, $actorUid, $dryRun, $actorLabel);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'delete') {
        $body = catn8_read_json_body(false);
        $entity = trim((string)($body['entity'] ?? ''));
        $id = isset($body['id']) ? (int)$body['id'] : 0;
        $ext = trim((string)($body['external_source_id'] ?? $body['source_id'] ?? ''));
        $hard = array_key_exists('hard', $body) ? !empty($body['hard']) : true;
        if ($entity === '' || ($id <= 0 && $ext === '')) {
            catn8_json_response(['success' => false, 'error' => 'entity and id or external_source_id required'], 400);
        }
        $result = Medic8Model::deleteEntityByKey(
            $entity,
            $id > 0 ? $id : null,
            $ext !== '' ? $ext : null,
            $actorUid,
            $actorLabel,
            $hard
        );
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'link_document') {
        $body = catn8_read_json_body(false);
        $documentId = (int)($body['document_id'] ?? 0);
        $dryRun = !empty($body['dry_run']);
        if ($documentId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'document_id required'], 400);
        }
        $result = Medic8Model::linkFromSpec($documentId, $body, $actorUid, $actorLabel, $dryRun);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'unlink_document') {
        $body = catn8_read_json_body(false);
        $documentId = (int)($body['document_id'] ?? 0);
        $entity = trim((string)($body['entity'] ?? ''));
        $dryRun = !empty($body['dry_run']);
        $recordId = Medic8Model::resolveRecordId(
            $entity,
            $body['record_id'] ?? null,
            $body['external_source_id'] ?? $body['source_id'] ?? null
        );
        $result = Medic8Model::unlinkDocument($documentId, $entity, $recordId, $actorUid, $actorLabel, $dryRun);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'cleanup_duplicates') {
        $uid = medic8_agent_uid();
        $synthetics = Medic8Model::deleteSyntheticTestRows($uid, $actorLabel);
        $documents = Medic8Model::cleanupDuplicateDocuments($uid, $actorLabel);
        $people = Medic8Model::cleanupDuplicatePeople($uid, $actorLabel);
        catn8_json_response([
            'success' => true,
            'synthetics' => $synthetics,
            'documents' => $documents,
            'people' => $people,
        ]);
    }

    if ($action === 'upload_document') {
        $meta = [
            'person_id' => (int)($_POST['person_id'] ?? 0),
            'title' => (string)($_POST['title'] ?? ''),
            'doc_type' => (string)($_POST['doc_type'] ?? ''),
            'external_source_id' => (string)($_POST['external_source_id'] ?? $_POST['source_id'] ?? ''),
            'source_ref_id' => (int)($_POST['source_ref_id'] ?? 0),
            'links' => medic8_agent_decode_links($_POST['links'] ?? $_POST['links_json'] ?? []),
        ];
        if (!empty($_POST['source_json'])) {
            $decoded = json_decode((string)$_POST['source_json'], true);
            if (is_array($decoded)) {
                $meta['source'] = $decoded;
            }
        }
        $file = $_FILES['file'] ?? $_FILES['document'] ?? null;
        if (!is_array($file)) {
            catn8_json_response(['success' => false, 'error' => 'multipart file field required (file|document)'], 400);
        }
        $result = Medic8Model::storeUploadedDocument($file, $meta, $actorUid, $actorLabel);
        catn8_json_response(['success' => true] + $result);
    }
} catch (InvalidArgumentException $e) {
    catn8_json_response(['success' => false, 'error' => $e->getMessage()], 400);
} catch (RuntimeException $e) {
    catn8_json_response(['success' => false, 'error' => $e->getMessage()], 400);
} catch (Throwable $e) {
    catn8_log_error('medic8 agent error', [
        'action' => $action,
        'error' => $e->getMessage(),
        'type' => get_class($e),
        'file' => basename($e->getFile()),
        'line' => $e->getLine(),
    ]);
    catn8_json_response(['success' => false, 'error' => 'Server error'], 500);
}
