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
        $rows = Database::queryAll('SELECT * FROM medic8_people ORDER BY display_name ASC');
        catn8_json_response(['success' => true, 'people' => $rows]);
    }

    if ($action === 'dashboard') {
        $personId = (int)($_GET['person_id'] ?? 0);
        if ($personId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'person_id required'], 400);
        }
        // Agent token is privileged for import tooling; still audit access.
        Medic8Model::audit(null, 'agent_view_dashboard', 'medic8_people', $personId, $personId, null, null, $actorLabel);
        // Use admin-style access via direct queries through listEntity by temporarily
        // listing as site owner is not available; build a privileged dashboard.
        $adminUsers = Database::queryAll('SELECT id FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1');
        $uid = (int)($adminUsers[0]['id'] ?? 0);
        if ($uid <= 0) {
            catn8_json_response(['success' => false, 'error' => 'No admin user for dashboard context'], 500);
        }
        catn8_json_response(['success' => true, 'dashboard' => Medic8Model::dashboard($uid, $personId)]);
    }

    if ($action === 'list') {
        $entity = trim((string)($_GET['entity'] ?? ''));
        $personId = isset($_GET['person_id']) ? (int)$_GET['person_id'] : null;
        $limit = (int)($_GET['limit'] ?? 200);
        $adminUsers = Database::queryAll('SELECT id FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1');
        $uid = (int)($adminUsers[0]['id'] ?? 0);
        catn8_json_response([
            'success' => true,
            'entity' => $entity,
            'records' => Medic8Model::listEntity($entity, $uid, $personId, $limit),
        ]);
    }

    if ($action === 'get') {
        $entity = trim((string)($_GET['entity'] ?? ''));
        $id = (int)($_GET['id'] ?? 0);
        $adminUsers = Database::queryAll('SELECT id FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1');
        $uid = (int)($adminUsers[0]['id'] ?? 0);
        $record = Medic8Model::getEntity($entity, $id, $uid, false);
        if (!$record) {
            catn8_json_response(['success' => false, 'error' => 'Not found'], 404);
        }
        catn8_json_response(['success' => true, 'record' => $record]);
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

    if ($action === 'upload_document') {
        $meta = [
            'person_id' => (int)($_POST['person_id'] ?? 0),
            'title' => (string)($_POST['title'] ?? ''),
            'doc_type' => (string)($_POST['doc_type'] ?? ''),
            'external_source_id' => (string)($_POST['external_source_id'] ?? $_POST['source_id'] ?? ''),
            'source_ref_id' => (int)($_POST['source_ref_id'] ?? 0),
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
