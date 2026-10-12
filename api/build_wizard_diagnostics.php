<?php

declare(strict_types=1);

/**
 * Read-only Build Wizard (fabric8) diagnostics.
 *
 * Purpose: because the live database is only reachable from the hosting server
 * (IONOS blocks remote DB access), this endpoint is uploaded to the server and
 * run there so it can inspect the live data locally. It reports where a Build
 * Wizard project's steps ("tasks") and dated steps / phase ranges ("events")
 * actually live, plus recent audit history, so data loss can be diagnosed
 * before anything is changed.
 *
 * It is strictly read-only: it issues SELECT statements only and never writes.
 *
 * Usage (run on the live server):
 *   https://catn8.us/api/build_wizard_diagnostics.php?action=report&admin_token=YOUR_TOKEN&q=Papa
 *
 * The admin token is read from the server environment (CATN8_ADMIN_TOKEN); it is
 * never hard-coded here.
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/diagnostics_log.php';

@set_time_limit(0);

$fail = static function (int $status, string $error, array $meta = []): void {
    catn8_diagnostics_log_event('build_wizard_diagnostics', false, $status, $error, $meta);
    catn8_json_response(['success' => false, 'error' => $error], $status);
};

// Read-only endpoint, but still require the admin token (constant-time compare).
$expected = (string)catn8_env('CATN8_ADMIN_TOKEN', '');
$got = (string)($_GET['admin_token'] ?? '');
if ($expected === '' || $got === '' || !hash_equals($expected, $got)) {
    $fail(403, 'Invalid admin token');
}

// GET only: this endpoint performs no mutations.
if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'GET') {
    $fail(405, 'Method not allowed (read-only endpoint)');
}

// Explicit action allowlist.
$action = trim((string)($_GET['action'] ?? 'report'));
if ($action !== 'report') {
    $fail(404, 'Unknown action');
}

// Search term (project title contains). Clamp length; used only as a bound parameter.
$q = trim((string)($_GET['q'] ?? 'Papa'));
if ($q === '') {
    $q = 'Papa';
}
if (strlen($q) > 100) {
    $q = substr($q, 0, 100);
}
$like = '%' . $q . '%';

$tableExists = static function (string $table): bool {
    $row = Database::queryOne(
        'SELECT 1 AS present
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
         LIMIT 1',
        [$table]
    );
    return (bool)$row;
};

try {
    $dbRow = Database::queryOne('SELECT DATABASE() AS db', []);
    $report = [
        'success' => true,
        'generated_at' => gmdate('c'),
        'connected_db' => (string)($dbRow['db'] ?? ''),
        'is_local_request' => catn8_is_local_request(),
        'query' => $q,
    ];

    $haveProjects = $tableExists('build_wizard_projects');
    $haveSteps = $tableExists('build_wizard_steps');
    $haveDocuments = $tableExists('build_wizard_documents');
    $havePhaseRanges = $tableExists('build_wizard_phase_date_ranges');
    $haveAudit = $tableExists('build_wizard_step_audit_logs');

    $report['tables_present'] = [
        'build_wizard_projects' => $haveProjects,
        'build_wizard_steps' => $haveSteps,
        'build_wizard_documents' => $haveDocuments,
        'build_wizard_phase_date_ranges' => $havePhaseRanges,
        'build_wizard_step_audit_logs' => $haveAudit,
    ];

    if (!$haveProjects) {
        catn8_diagnostics_log_event('build_wizard_diagnostics', true, 200, '', ['note' => 'projects table missing']);
        catn8_json_response($report);
    }

    // 1) Projects whose title matches the search term, with child counts.
    $matchSql = 'SELECT p.id, p.owner_user_id, p.title, p.status, p.is_template, p.created_at, p.updated_at';
    if ($haveSteps) {
        $matchSql .= ', (SELECT COUNT(*) FROM build_wizard_steps s WHERE s.project_id = p.id) AS step_count';
        $matchSql .= ', (SELECT COUNT(*) FROM build_wizard_steps s WHERE s.project_id = p.id AND (s.expected_start_date IS NOT NULL OR s.expected_end_date IS NOT NULL)) AS dated_step_count';
    }
    if ($haveDocuments) {
        $matchSql .= ', (SELECT COUNT(*) FROM build_wizard_documents d WHERE d.project_id = p.id) AS document_count';
    }
    if ($havePhaseRanges) {
        $matchSql .= ', (SELECT COUNT(*) FROM build_wizard_phase_date_ranges r WHERE r.project_id = p.id) AS phase_range_count';
    }
    $matchSql .= ' FROM build_wizard_projects p WHERE p.title LIKE ? ORDER BY p.id ASC';
    $report['matching_projects'] = Database::queryAll($matchSql, [$like]);

    // 2) Global summary + top projects by step count (helps spot a duplicate/renamed
    //    project that actually holds the data under a different id/owner).
    $report['totals'] = [
        'projects' => (int)(Database::queryOne('SELECT COUNT(*) AS c FROM build_wizard_projects', [])['c'] ?? 0),
        'steps' => $haveSteps ? (int)(Database::queryOne('SELECT COUNT(*) AS c FROM build_wizard_steps', [])['c'] ?? 0) : null,
        'documents' => $haveDocuments ? (int)(Database::queryOne('SELECT COUNT(*) AS c FROM build_wizard_documents', [])['c'] ?? 0) : null,
    ];

    if ($haveSteps) {
        $report['top_projects_by_step_count'] = Database::queryAll(
            'SELECT p.id, p.owner_user_id, p.title, p.status, p.updated_at,
                    (SELECT COUNT(*) FROM build_wizard_steps s WHERE s.project_id = p.id) AS step_count
             FROM build_wizard_projects p
             ORDER BY step_count DESC, p.updated_at DESC
             LIMIT 15',
            []
        );

        // 2b) Orphaned steps (project_id no longer points to a project row). Should be
        //     impossible with the FK intact, but reveals a dropped/broken constraint.
        $report['orphaned_step_groups'] = Database::queryAll(
            'SELECT s.project_id, COUNT(*) AS step_count, MIN(s.created_at) AS first_created, MAX(s.updated_at) AS last_updated
             FROM build_wizard_steps s
             LEFT JOIN build_wizard_projects p ON p.id = s.project_id
             WHERE p.id IS NULL
             GROUP BY s.project_id
             ORDER BY step_count DESC
             LIMIT 25',
            []
        );
    }

    // 3) Resolve owner usernames for referenced projects (id + username only; no PII).
    $ownerIds = [];
    foreach (array_merge($report['matching_projects'], $report['top_projects_by_step_count'] ?? []) as $p) {
        $oid = (int)($p['owner_user_id'] ?? 0);
        if ($oid > 0) {
            $ownerIds[$oid] = true;
        }
    }
    if ($ownerIds && $tableExists('users')) {
        $ids = array_keys($ownerIds);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $report['owners'] = Database::queryAll(
            'SELECT id, username, is_admin FROM users WHERE id IN (' . $placeholders . ') ORDER BY id ASC',
            $ids
        );
    }

    // 4) Per-matched-project deep dive: phase breakdown, date span, phase ranges,
    //    and recent audit history (the forensic trail for edits/deletes).
    $details = [];
    foreach ($report['matching_projects'] as $p) {
        $pid = (int)($p['id'] ?? 0);
        if ($pid <= 0) {
            continue;
        }
        $entry = ['project_id' => $pid, 'title' => (string)($p['title'] ?? '')];

        if ($haveSteps) {
            $entry['phase_breakdown'] = Database::queryAll(
                'SELECT phase_key,
                        COUNT(*) AS step_count,
                        SUM(CASE WHEN expected_start_date IS NOT NULL OR expected_end_date IS NOT NULL THEN 1 ELSE 0 END) AS dated_steps
                 FROM build_wizard_steps
                 WHERE project_id = ?
                 GROUP BY phase_key
                 ORDER BY phase_key ASC',
                [$pid]
            );
            $entry['date_span'] = Database::queryOne(
                'SELECT MIN(expected_start_date) AS earliest_start, MAX(expected_end_date) AS latest_end
                 FROM build_wizard_steps
                 WHERE project_id = ?',
                [$pid]
            );
        }
        if ($havePhaseRanges) {
            $entry['phase_date_ranges'] = Database::queryAll(
                'SELECT id, phase_tab, start_date, end_date, created_at, updated_at
                 FROM build_wizard_phase_date_ranges
                 WHERE project_id = ?
                 ORDER BY id ASC',
                [$pid]
            );
        }
        if ($haveAudit) {
            $entry['recent_audit_logs'] = Database::queryAll(
                'SELECT id, step_id, actor_user_id, action_key, created_at, LEFT(COALESCE(changes_json, ""), 300) AS changes_preview
                 FROM build_wizard_step_audit_logs
                 WHERE project_id = ?
                 ORDER BY created_at DESC, id DESC
                 LIMIT 200',
                [$pid]
            );
            $entry['audit_action_counts'] = Database::queryAll(
                'SELECT action_key, COUNT(*) AS c
                 FROM build_wizard_step_audit_logs
                 WHERE project_id = ?
                 GROUP BY action_key
                 ORDER BY c DESC',
                [$pid]
            );
        }
        $details[] = $entry;
    }
    $report['matching_project_details'] = $details;

    catn8_diagnostics_log_event('build_wizard_diagnostics', true, 200, '', [
        'query' => $q,
        'matches' => count($report['matching_projects']),
    ]);

    if (function_exists('header') && !headers_sent()) {
        header('Content-Type: application/json; charset=UTF-8');
    }
    echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
} catch (Throwable $e) {
    $fail(500, 'Diagnostics failed: ' . $e->getMessage());
}
