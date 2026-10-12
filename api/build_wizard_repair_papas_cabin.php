<?php

declare(strict_types=1);

/**
 * Admin-token repair for Papa's Cabin / FABRIC8 split-project data.
 *
 * Diagnose (read-only):
 *   GET /api/build_wizard_repair_papas_cabin.php?action=diagnose&admin_token=TOKEN&q=Papa
 *
 * Repair (writes):
 *   GET /api/build_wizard_repair_papas_cabin.php?action=repair&admin_token=TOKEN&project_id=65
 *   GET /api/build_wizard_repair_papas_cabin.php?action=repair_all&admin_token=TOKEN
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/build_wizard_cabin_relink.php';
require_once __DIR__ . '/../includes/diagnostics_log.php';

@set_time_limit(0);

const CATN8_CABIN_REPAIR_API_VERSION = '2026-08-27-full-repair-v1';

$fail = static function (int $status, string $error, array $meta = []): void {
    catn8_diagnostics_log_event('build_wizard_repair_papas_cabin', false, $status, $error, $meta);
    catn8_json_response(['success' => false, 'error' => $error, 'repair_api_version' => CATN8_CABIN_REPAIR_API_VERSION], $status);
};

$expected = (string)catn8_env('CATN8_ADMIN_TOKEN', '');
$got = (string)($_GET['admin_token'] ?? $_POST['admin_token'] ?? '');
if ($expected === '' || $got === '' || !hash_equals($expected, $got)) {
    $fail(403, 'Invalid admin token');
}

if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'GET') {
    $fail(405, 'Method not allowed (use GET)');
}

$action = trim((string)($_GET['action'] ?? 'diagnose'));
$allowed = ['diagnose', 'repair', 'repair_all', 'version'];
if (!in_array($action, $allowed, true)) {
    $fail(404, 'Unknown action');
}

if ($action === 'version') {
    catn8_json_response([
        'success' => true,
        'repair_api_version' => CATN8_CABIN_REPAIR_API_VERSION,
        'cabin_relink_present' => function_exists('catn8_build_wizard_repair_cabin_references'),
    ]);
}

$q = trim((string)($_GET['q'] ?? 'Papa'));
if ($q === '') {
    $q = 'Papa';
}
if (strlen($q) > 100) {
    $q = substr($q, 0, 100);
}
$like = '%' . $q . '%';

$projectSnapshot = static function (int $projectId): ?array {
    if ($projectId <= 0) {
        return null;
    }
    $project = Database::queryOne('SELECT * FROM build_wizard_projects WHERE id = ? LIMIT 1', [$projectId]);
    if (!$project) {
        return null;
    }
    return [
        'id' => (int)($project['id'] ?? 0),
        'owner_user_id' => (int)($project['owner_user_id'] ?? 0),
        'title' => (string)($project['title'] ?? ''),
        'lot_address' => (string)($project['lot_address'] ?? ''),
        'status' => (string)($project['status'] ?? ''),
        'step_count' => (int)(Database::queryOne('SELECT COUNT(*) AS c FROM build_wizard_steps WHERE project_id = ?', [$projectId])['c'] ?? 0),
        'document_count' => (int)(Database::queryOne('SELECT COUNT(*) AS c FROM build_wizard_documents WHERE project_id = ?', [$projectId])['c'] ?? 0),
        'phase_range_count' => (int)(Database::queryOne('SELECT COUNT(*) AS c FROM build_wizard_phase_date_ranges WHERE project_id = ?', [$projectId])['c'] ?? 0),
        'dated_step_count' => (int)(Database::queryOne(
            'SELECT COUNT(*) AS c FROM build_wizard_steps WHERE project_id = ? AND (expected_start_date IS NOT NULL OR expected_end_date IS NOT NULL)',
            [$projectId]
        )['c'] ?? 0),
    ];
};

$listCabinProjects = static function (string $likePattern): array {
    return Database::queryAll(
        'SELECT p.id, p.owner_user_id, p.title, p.lot_address, p.status, p.updated_at,
                (SELECT COUNT(*) FROM build_wizard_steps s WHERE s.project_id = p.id) AS step_count,
                (SELECT COUNT(*) FROM build_wizard_documents d WHERE d.project_id = p.id) AS document_count,
                (SELECT COUNT(*) FROM build_wizard_phase_date_ranges r WHERE r.project_id = p.id) AS phase_range_count
         FROM build_wizard_projects p
         WHERE p.title LIKE ?
            OR p.lot_address LIKE ?
            OR p.title LIKE \'%Singletree%\'
            OR p.lot_address LIKE \'%Singletree%\'
         ORDER BY p.id ASC',
        [$likePattern, $likePattern]
    );
};

try {
    if ($action === 'diagnose') {
        $matches = $listCabinProjects($like);
        $top = Database::queryAll(
            'SELECT p.id, p.owner_user_id, p.title,
                    (SELECT COUNT(*) FROM build_wizard_steps s WHERE s.project_id = p.id) AS step_count,
                    (SELECT COUNT(*) FROM build_wizard_documents d WHERE d.project_id = p.id) AS document_count
             FROM build_wizard_projects p
             ORDER BY step_count DESC, document_count DESC, p.updated_at DESC
             LIMIT 20',
            []
        );
        catn8_json_response([
            'success' => true,
            'repair_api_version' => CATN8_CABIN_REPAIR_API_VERSION,
            'query' => $q,
            'matching_projects' => $matches,
            'top_projects_by_data' => $top,
        ]);
    }

    $repairs = [];
    $targets = [];

    if ($action === 'repair') {
        $projectId = (int)($_GET['project_id'] ?? 0);
        if ($projectId <= 0) {
            $fail(400, 'Missing project_id for repair');
        }
        $project = Database::queryOne('SELECT * FROM build_wizard_projects WHERE id = ? LIMIT 1', [$projectId]);
        if (!$project) {
            $fail(404, 'Project not found');
        }
        $targets[] = $project;
    } else {
        $targets = Database::queryAll(
            'SELECT * FROM build_wizard_projects
             WHERE title LIKE ?
                OR lot_address LIKE ?
                OR title LIKE \'%Singletree%\'
                OR lot_address LIKE \'%Singletree%\'
                OR title LIKE \'%Papa%\'
             ORDER BY id ASC',
            [$like, $like]
        );
    }

    foreach ($targets as $project) {
        $projectId = (int)($project['id'] ?? 0);
        $ownerId = (int)($project['owner_user_id'] ?? 0);
        if ($projectId <= 0 || $ownerId <= 0) {
            continue;
        }
        if (!catn8_build_wizard_project_is_cabin_like($project)) {
            continue;
        }
        $before = $projectSnapshot($projectId);
        $repair = catn8_build_wizard_repair_cabin_references($ownerId, $projectId);
        $after = $projectSnapshot($projectId);
        $repairs[] = [
            'project_id' => $projectId,
            'title' => (string)($project['title'] ?? ''),
            'before' => $before,
            'after' => $after,
            'repair' => $repair,
        ];
    }

    catn8_diagnostics_log_event('build_wizard_repair_papas_cabin', true, 200, '', [
        'action' => $action,
        'repair_count' => count($repairs),
    ]);

    catn8_json_response([
        'success' => true,
        'repair_api_version' => CATN8_CABIN_REPAIR_API_VERSION,
        'action' => $action,
        'repairs' => $repairs,
    ]);
} catch (Throwable $e) {
    $fail(500, 'Repair failed: ' . $e->getMessage());
}
