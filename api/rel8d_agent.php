<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/rel8d_model.php';

Rel8dModel::ensureSchema();

function rel8d_agent_extract_token(): string
{
    $header = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (preg_match('/^\s*Bearer\s+(\S+)\s*$/i', $header, $m)) {
        return trim($m[1]);
    }
    $alt = trim((string)($_SERVER['HTTP_X_REL8D_AGENT_TOKEN'] ?? ''));
    if ($alt !== '') {
        return $alt;
    }
    $apiKey = trim((string)($_SERVER['HTTP_X_API_KEY'] ?? ''));
    if ($apiKey !== '') {
        return $apiKey;
    }
    return trim((string)($_GET['token'] ?? ''));
}

function rel8d_agent_uid(): int
{
    $uid = Rel8dModel::privilegedUserId();
    if ($uid <= 0) {
        catn8_json_response(['success' => false, 'error' => 'No admin user for agent context'], 500);
    }
    return $uid;
}

$token = rel8d_agent_extract_token();
if (!Rel8dModel::verifyApiToken($token)) {
    catn8_log_error('rel8d agent auth failure', ['ip' => (string)($_SERVER['REMOTE_ADDR'] ?? '')]);
    catn8_json_response(['success' => false, 'error' => 'Not authenticated'], 401);
}

$action = trim((string)($_GET['action'] ?? ''));
$readActions = ['list', 'get', 'search', 'dashboard', 'pedigree', 'relationship', 'quality_flags'];
$writeActions = ['upsert_person', 'add_note', 'add_source', 'import_preview', 'import_apply'];
$allowed = array_merge($readActions, $writeActions);

if ($action === '' || !in_array($action, $allowed, true)) {
    catn8_json_response(['success' => false, 'error' => 'Unknown or missing action'], 400);
}

if (in_array($action, $writeActions, true)) {
    catn8_require_method('POST', false);
} else {
    catn8_require_method('GET', false);
}

$actorLabel = 'agent:rel8d';
$actorUid = 0;

try {
    if ($action === 'list' || $action === 'search') {
        $uid = rel8d_agent_uid();
        $page = Rel8dModel::listPeople(
            $uid,
            (int)($_GET['limit'] ?? 200),
            (int)($_GET['offset'] ?? $_GET['cursor'] ?? 0),
            isset($_GET['q']) ? (string)$_GET['q'] : null,
            isset($_GET['surname']) ? (string)$_GET['surname'] : null
        );
        catn8_json_response(['success' => true] + $page);
    }

    if ($action === 'get') {
        $uid = rel8d_agent_uid();
        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) {
            catn8_json_response(['success' => false, 'error' => 'id required'], 400);
        }
        $record = Rel8dModel::getPerson($uid, $id);
        if (!$record) {
            catn8_json_response(['success' => false, 'error' => 'Not found'], 404);
        }
        catn8_json_response(['success' => true, 'record' => $record]);
    }

    if ($action === 'dashboard') {
        $uid = rel8d_agent_uid();
        Rel8dModel::audit(null, 'agent_view_dashboard', 'rel8d', null, null, null, null, $actorLabel);
        catn8_json_response(['success' => true, 'dashboard' => Rel8dModel::dashboard($uid)]);
    }

    if ($action === 'pedigree') {
        $uid = rel8d_agent_uid();
        $id = (int)($_GET['id'] ?? $_GET['person_id'] ?? 0);
        if ($id <= 0) {
            $id = (int)(Rel8dModel::findRootCandidate($uid) ?? 0);
        }
        catn8_json_response(['success' => true, 'pedigree' => Rel8dModel::pedigree($uid, $id, (int)($_GET['generations'] ?? 5))]);
    }

    if ($action === 'relationship') {
        $uid = rel8d_agent_uid();
        $from = (int)($_GET['from_id'] ?? 0);
        $to = (int)($_GET['to_id'] ?? 0);
        catn8_json_response(['success' => true] + Rel8dModel::relationship($uid, $from, $to));
    }

    if ($action === 'quality_flags') {
        $uid = rel8d_agent_uid();
        catn8_json_response(['success' => true, 'records' => Rel8dModel::listQualityFlags($uid)]);
    }

    if ($action === 'upsert_person') {
        $body = catn8_read_json_body();
        $record = $body['record'] ?? $body;
        if (!is_array($record)) {
            catn8_json_response(['success' => false, 'error' => 'record object required'], 400);
        }
        $dry = !empty($body['dry_run']);
        $result = Rel8dModel::upsertPerson($record, $actorUid, $dry, $actorLabel);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'add_note') {
        $body = catn8_read_json_body();
        $result = Rel8dModel::addNote($body, $actorUid, !empty($body['dry_run']), $actorLabel);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'add_source') {
        $body = catn8_read_json_body();
        $result = Rel8dModel::addSource($body, $actorUid, !empty($body['dry_run']), $actorLabel);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'import_preview') {
        $body = catn8_read_json_body();
        $text = (string)($body['gedcom'] ?? $body['text'] ?? '');
        if ($text === '' && !empty($_FILES['file']['tmp_name'])) {
            $text = (string)file_get_contents((string)$_FILES['file']['tmp_name']);
        }
        if (trim($text) === '') {
            catn8_json_response(['success' => false, 'error' => 'GEDCOM content required'], 400);
        }
        if (!empty($body['dry_run'])) {
            $parsed = Rel8dGedcom::parse($text);
            catn8_json_response(['success' => true, 'dry_run' => true, 'counts' => $parsed['counts']]);
        }
        $result = Rel8dModel::previewImport($text, isset($body['file_name']) ? (string)$body['file_name'] : null);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'import_apply') {
        $body = catn8_read_json_body();
        if (!empty($body['dry_run'])) {
            catn8_json_response(['success' => true, 'dry_run' => true, 'action' => 'import_apply']);
        }
        $importId = (int)($body['import_id'] ?? 0);
        if ($importId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'import_id required'], 400);
        }
        $result = Rel8dModel::applyImport($importId, $actorUid, $actorLabel);
        catn8_json_response(['success' => true] + $result);
    }
} catch (InvalidArgumentException $e) {
    catn8_json_response(['success' => false, 'error' => $e->getMessage()], 400);
} catch (RuntimeException $e) {
    $msg = $e->getMessage();
    $code = $msg === 'Not authorized' ? 403 : 400;
    catn8_json_response(['success' => false, 'error' => $msg], $code);
} catch (Throwable $e) {
    catn8_log_error('rel8d agent error', ['action' => $action, 'error' => $e->getMessage()]);
    catn8_json_response(['success' => false, 'error' => 'Server error'], 500);
}
