<?php

declare(strict_types=1);

/**
 * Fabric8r agent API for project photo sections, steps, and related write actions.
 *
 * Auth: CATN8_ADMIN_TOKEN via X-Api-Key / Bearer, or fabric8.agent.api_token_hash secret.
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/build_wizard_photo_sections.php';
require_once __DIR__ . '/../includes/build_wizard_agent_steps.php';

// Optional helpers from build_wizard.php (blob upsert / search index) without
// executing its request router: load only if functions already exist.

function fabric8_agent_extract_token(): string
{
    $header = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (preg_match('/^\s*Bearer\s+(\S+)\s*$/i', $header, $m)) {
        return trim($m[1]);
    }
    $alt = trim((string)($_SERVER['HTTP_X_FABRIC8_AGENT_TOKEN'] ?? ''));
    if ($alt !== '') {
        return $alt;
    }
    $apiKey = trim((string)($_SERVER['HTTP_X_API_KEY'] ?? ''));
    if ($apiKey !== '') {
        return $apiKey;
    }
    return trim((string)($_GET['token'] ?? ''));
}

function fabric8_agent_verify_token(string $token): bool
{
    $token = trim($token);
    if ($token === '') {
        return false;
    }
    $admin = trim((string)catn8_env('CATN8_ADMIN_TOKEN', ''));
    if ($admin !== '' && hash_equals($admin, $token)) {
        return true;
    }
    $stored = secret_get('fabric8.agent.api_token_hash');
    if (is_string($stored) && $stored !== '') {
        return hash_equals($stored, hash('sha256', $token));
    }
    return false;
}

function fabric8_agent_request_dry_run(array $body = []): bool
{
    if (isset($_GET['dry_run']) && fabric8_agent_truthy($_GET['dry_run'])) {
        return true;
    }
    if (isset($_POST['dry_run']) && fabric8_agent_truthy($_POST['dry_run'])) {
        return true;
    }
    if (array_key_exists('dry_run', $body) && fabric8_agent_truthy($body['dry_run'])) {
        return true;
    }
    return false;
}

$token = fabric8_agent_extract_token();
if (!fabric8_agent_verify_token($token)) {
    catn8_log_error('fabric8 agent auth failure', ['ip' => (string)($_SERVER['REMOTE_ADDR'] ?? '')]);
    catn8_json_response(['success' => false, 'error' => 'Not authenticated'], 401);
}

$actorLabel = 'agent:fabric8';
$action = trim((string)($_GET['action'] ?? ''));

$readActions = [
    'list_projects', 'get_project', 'list_photo_sections', 'list_section_photos',
    'list_steps', 'backup_steps',
];
$writeActions = [
    'ensure_photo_section', 'upload_section_photo', 'attach_labeled_photos',
    'update_step', 'create_step', 'attach_step_document',
    'delete_step', 'delete_note',
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

try {
    catn8_build_wizard_photo_sections_ensure();

    if ($action === 'list_projects') {
        $rows = Database::queryAll(
            'SELECT id, title, status, lot_address, updated_at,
                    (SELECT COUNT(*) FROM build_wizard_documents d WHERE d.project_id = p.id) AS document_count
             FROM build_wizard_projects p
             ORDER BY updated_at DESC, id DESC
             LIMIT 200'
        );
        catn8_json_response(['success' => true, 'projects' => $rows]);
    }

    if ($action === 'get_project') {
        $projectId = (int)($_GET['project_id'] ?? 0);
        if ($projectId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'project_id required'], 400);
        }
        $project = Database::queryOne(
            'SELECT id, title, status, lot_address, wizard_notes, primary_photo_document_id, created_at, updated_at
             FROM build_wizard_projects WHERE id = ? LIMIT 1',
            [$projectId]
        );
        if (!$project) {
            catn8_json_response(['success' => false, 'error' => 'Project not found'], 404);
        }
        catn8_json_response([
            'success' => true,
            'project' => $project,
            'photo_sections' => catn8_build_wizard_list_photo_sections($projectId),
        ]);
    }

    if ($action === 'list_photo_sections') {
        $projectId = (int)($_GET['project_id'] ?? 0);
        if ($projectId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'project_id required'], 400);
        }
        catn8_json_response([
            'success' => true,
            'sections' => catn8_build_wizard_list_photo_sections($projectId),
        ]);
    }

    if ($action === 'list_section_photos') {
        $projectId = (int)($_GET['project_id'] ?? 0);
        $sectionId = (int)($_GET['section_id'] ?? 0);
        if ($projectId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'project_id required'], 400);
        }
        $sql = 'SELECT d.id FROM build_wizard_documents d WHERE d.project_id = ?';
        $params = [$projectId];
        if ($sectionId > 0) {
            $sql .= ' AND d.photo_section_id = ?';
            $params[] = $sectionId;
        } else {
            $sql .= ' AND d.photo_section_id IS NOT NULL';
        }
        $sql .= ' ORDER BY d.id ASC';
        $ids = Database::queryAll($sql, $params);
        $docs = [];
        foreach ($ids as $row) {
            $docs[] = catn8_build_wizard_photo_section_document_payload((int)$row['id']);
        }
        catn8_json_response(['success' => true, 'photos' => $docs, 'count' => count($docs)]);
    }

    if ($action === 'list_steps') {
        $projectId = (int)($_GET['project_id'] ?? 0);
        $stepId = (int)($_GET['step_id'] ?? 0);
        $q = trim((string)($_GET['q'] ?? ''));
        if ($projectId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'project_id required'], 400);
        }
        if (!fabric8_agent_require_project($projectId)) {
            catn8_json_response(['success' => false, 'error' => 'Project not found'], 404);
        }
        $steps = fabric8_agent_list_steps(
            $projectId,
            $q !== '' ? $q : null,
            $stepId > 0 ? $stepId : null
        );
        catn8_json_response(['success' => true, 'steps' => $steps, 'count' => count($steps)]);
    }

    if ($action === 'backup_steps') {
        $projectId = (int)($_GET['project_id'] ?? 0);
        $idsRaw = (string)($_GET['step_ids'] ?? '');
        $stepIds = [];
        if ($idsRaw !== '') {
            foreach (preg_split('/[,\s]+/', $idsRaw) ?: [] as $part) {
                $id = (int)$part;
                if ($id > 0) {
                    $stepIds[] = $id;
                }
            }
        }
        $single = (int)($_GET['step_id'] ?? 0);
        if ($single > 0) {
            $stepIds[] = $single;
        }
        if ($projectId > 0 && !$stepIds) {
            $rows = Database::queryAll('SELECT id FROM build_wizard_steps WHERE project_id = ?', [$projectId]);
            foreach ($rows as $r) {
                $stepIds[] = (int)$r['id'];
            }
        }
        if (!$stepIds) {
            catn8_json_response(['success' => false, 'error' => 'step_ids or project_id required'], 400);
        }
        $backup = fabric8_agent_backup_steps($stepIds);
        catn8_json_response(['success' => true, 'backup' => $backup]);
    }

    if ($action === 'ensure_photo_section') {
        $body = catn8_read_json_body(false);
        $projectId = (int)($body['project_id'] ?? 0);
        $title = trim((string)($body['title'] ?? ''));
        $notes = array_key_exists('notes', $body) ? (string)$body['notes'] : null;
        $sortOrder = isset($body['sort_order']) ? (int)$body['sort_order'] : null;
        if ($projectId <= 0 || $title === '') {
            catn8_json_response(['success' => false, 'error' => 'project_id and title required'], 400);
        }
        $project = Database::queryOne('SELECT id FROM build_wizard_projects WHERE id = ? LIMIT 1', [$projectId]);
        if (!$project) {
            catn8_json_response(['success' => false, 'error' => 'Project not found'], 404);
        }
        if (fabric8_agent_request_dry_run($body)) {
            catn8_json_response([
                'success' => true,
                'dry_run' => true,
                'section' => ['project_id' => $projectId, 'title' => $title, 'notes' => $notes, 'sort_order' => $sortOrder],
            ]);
        }
        $section = catn8_build_wizard_ensure_photo_section($projectId, $title, $notes, $sortOrder);
        catn8_json_response(['success' => true, 'section' => $section]);
    }

    if ($action === 'upload_section_photo') {
        $projectId = (int)($_POST['project_id'] ?? 0);
        $sectionId = (int)($_POST['section_id'] ?? 0);
        $title = trim((string)($_POST['section_title'] ?? ''));
        $caption = trim((string)($_POST['caption'] ?? ''));
        $kind = trim((string)($_POST['kind'] ?? 'photo'));
        $metaRaw = (string)($_POST['meta_json'] ?? '');
        $meta = null;
        if ($metaRaw !== '') {
            $decoded = json_decode($metaRaw, true);
            if (!is_array($decoded)) {
                catn8_json_response(['success' => false, 'error' => 'meta_json must be JSON object'], 400);
            }
            $meta = $decoded;
        }
        if ($projectId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'project_id required'], 400);
        }
        if ($sectionId <= 0) {
            if ($title === '') {
                catn8_json_response(['success' => false, 'error' => 'section_id or section_title required'], 400);
            }
            $section = catn8_build_wizard_ensure_photo_section($projectId, $title);
            $sectionId = (int)$section['id'];
        }
        $file = $_FILES['file'] ?? $_FILES['photo'] ?? $_FILES['image'] ?? null;
        if (!is_array($file)) {
            catn8_json_response(['success' => false, 'error' => 'multipart file field required (file|photo|image)'], 400);
        }
        if (fabric8_agent_request_dry_run()) {
            catn8_json_response([
                'success' => true,
                'dry_run' => true,
                'project_id' => $projectId,
                'section_id' => $sectionId,
                'filename' => (string)($file['name'] ?? ''),
            ]);
        }
        $result = catn8_build_wizard_upload_to_photo_section(
            $projectId,
            $sectionId,
            $file,
            $kind !== '' ? $kind : 'photo',
            $caption !== '' ? $caption : null,
            $meta,
            $actorLabel
        );
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'attach_labeled_photos') {
        // Multipart batch: files[] + manifest_json (array of {filename, caption, meta})
        // or single-file loop from client. Prefer client-side loop via upload_section_photo.
        $body = [];
        $contentType = (string)($_SERVER['CONTENT_TYPE'] ?? '');
        if (str_contains(strtolower($contentType), 'application/json')) {
            $body = catn8_read_json_body(false);
        }
        $projectId = (int)($_POST['project_id'] ?? $body['project_id'] ?? 0);
        $sectionTitle = trim((string)($_POST['section_title'] ?? $body['section_title'] ?? 'Pre-rough-in (historical)'));
        if ($projectId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'project_id required'], 400);
        }
        if (fabric8_agent_request_dry_run($body)) {
            catn8_json_response([
                'success' => true,
                'dry_run' => true,
                'section' => ['project_id' => $projectId, 'title' => $sectionTitle],
                'hint' => 'Use upload_section_photo per file with section_id for idempotent attaches.',
            ]);
        }
        $section = catn8_build_wizard_ensure_photo_section($projectId, $sectionTitle);
        catn8_json_response([
            'success' => true,
            'section' => $section,
            'hint' => 'Use upload_section_photo per file with section_id for idempotent attaches.',
        ]);
    }

    if ($action === 'update_step') {
        $body = catn8_read_json_body(false);
        $stepId = (int)($body['step_id'] ?? $_GET['step_id'] ?? 0);
        if ($stepId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'step_id required'], 400);
        }
        $dryRun = fabric8_agent_request_dry_run($body);
        $result = fabric8_agent_update_step($stepId, $body, $dryRun);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'create_step') {
        $body = catn8_read_json_body(false);
        $projectId = (int)($body['project_id'] ?? 0);
        if ($projectId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'project_id required'], 400);
        }
        $dryRun = fabric8_agent_request_dry_run($body);
        $result = fabric8_agent_create_step($projectId, $body, $dryRun);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'attach_step_document') {
        $body = [];
        $contentType = (string)($_SERVER['CONTENT_TYPE'] ?? '');
        if (str_contains(strtolower($contentType), 'application/json')) {
            $body = catn8_read_json_body(false);
        }
        $projectId = (int)($_POST['project_id'] ?? $body['project_id'] ?? 0);
        $stepId = (int)($_POST['step_id'] ?? $body['step_id'] ?? 0);
        if ($projectId <= 0 || $stepId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'project_id and step_id required'], 400);
        }
        $options = [
            'kind' => $_POST['kind'] ?? $body['kind'] ?? 'receipt',
            'caption' => $_POST['caption'] ?? $body['caption'] ?? null,
            'receipt_amount' => $_POST['receipt_amount'] ?? $body['receipt_amount'] ?? null,
            'receipt_title' => $_POST['receipt_title'] ?? $body['receipt_title'] ?? null,
            'receipt_vendor' => $_POST['receipt_vendor'] ?? $body['receipt_vendor'] ?? null,
            'receipt_date' => $_POST['receipt_date'] ?? $body['receipt_date'] ?? null,
            'receipt_notes' => $_POST['receipt_notes'] ?? $body['receipt_notes'] ?? null,
        ];
        $dryRun = fabric8_agent_request_dry_run($body);
        $file = $_FILES['file'] ?? $_FILES['document'] ?? $_FILES['pdf'] ?? null;
        $localPath = trim((string)($_POST['local_path'] ?? $body['local_path'] ?? ''));
        if (!is_array($file) && $localPath === '') {
            catn8_json_response(['success' => false, 'error' => 'multipart file field or local_path required'], 400);
        }
        $source = is_array($file) ? $file : $localPath;
        $result = fabric8_agent_attach_step_document($projectId, $stepId, $source, $options, $dryRun);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'delete_step') {
        $body = catn8_read_json_body(false);
        $stepId = (int)($body['step_id'] ?? 0);
        if ($stepId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'step_id required'], 400);
        }
        $dryRun = fabric8_agent_request_dry_run($body);
        $cascade = fabric8_agent_truthy($body['cascade'] ?? false);
        $result = fabric8_agent_delete_step($stepId, $dryRun, $cascade);
        catn8_json_response(['success' => true] + $result);
    }

    if ($action === 'delete_note') {
        $body = catn8_read_json_body(false);
        $noteId = (int)($body['note_id'] ?? 0);
        $stepId = (int)($body['step_id'] ?? 0);
        if ($noteId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'note_id required'], 400);
        }
        $dryRun = fabric8_agent_request_dry_run($body);
        $result = fabric8_agent_delete_note($noteId, $dryRun, $stepId > 0 ? $stepId : null);
        catn8_json_response(['success' => true] + $result);
    }

    catn8_json_response(['success' => false, 'error' => 'Unhandled action'], 500);
} catch (Fabric8AgentConflictException $e) {
    catn8_log_error('fabric8 agent delete refused', [
        'action' => $action,
        'error' => $e->getMessage(),
        'child_step_ids' => $e->childStepIds,
    ]);
    catn8_json_response([
        'success' => false,
        'error' => $e->getMessage(),
        'child_step_ids' => $e->childStepIds,
    ], 409);
} catch (InvalidArgumentException $e) {
    catn8_json_response(['success' => false, 'error' => $e->getMessage()], 400);
} catch (Throwable $e) {
    catn8_log_error('fabric8 agent error', ['action' => $action, 'error' => $e->getMessage()]);
    catn8_json_response(['success' => false, 'error' => 'Server error'], 500);
}
