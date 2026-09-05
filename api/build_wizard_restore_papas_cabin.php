<?php
declare(strict_types=1);

/**
 * Admin-token restore for Papa's Cabin FABRIC8 access.
 *
 * The live cabin data can end up under a generic "Build Wizard Project" title
 * with a blank lot address, while an empty "Papa's Cabin*" shell remains visible.
 * This endpoint inspects that split and restores the data-rich project title/address.
 *
 * Inspect (read-only):
 *   GET /api/build_wizard_restore_papas_cabin.php?action=inspect&admin_token=TOKEN
 *
 * Restore (writes):
 *   GET /api/build_wizard_restore_papas_cabin.php?action=restore&admin_token=TOKEN
 */

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/diagnostics_log.php';

@set_time_limit(0);
@ini_set('display_errors', '0');

$fail = static function (int $status, string $error, array $meta = []): void {
    if (function_exists('catn8_diagnostics_log_event')) {
        catn8_diagnostics_log_event('build_wizard_restore_papas_cabin', false, $status, $error, $meta);
    }
    catn8_json_response(['success' => false, 'error' => $error] + $meta, $status);
};

try {
    $expected = (string)catn8_env('CATN8_ADMIN_TOKEN', '');
    $got = (string)($_GET['admin_token'] ?? $_POST['admin_token'] ?? '');
    if ($expected === '' || $got === '' || !hash_equals($expected, $got)) {
        $fail(403, 'Invalid admin token');
    }

    $action = trim((string)($_GET['action'] ?? 'inspect'));
    if (!in_array($action, ['inspect', 'restore'], true)) {
        $fail(404, 'Unknown action');
    }

    $cabinRelinkPath = __DIR__ . '/../includes/build_wizard_cabin_relink.php';
    $cabinRelinkLoaded = false;
    if (is_file($cabinRelinkPath)) {
        require_once $cabinRelinkPath;
        $cabinRelinkLoaded = true;
    }

    $isCabinLike = static function (array $project) use ($cabinRelinkLoaded): bool {
        if ($cabinRelinkLoaded && function_exists('catn8_build_wizard_project_is_cabin_like')) {
            return catn8_build_wizard_project_is_cabin_like($project);
        }
        $hay = strtolower(trim(implode(' ', [
            (string)($project['title'] ?? ''),
            (string)($project['lot_address'] ?? ''),
            (string)($project['home_style'] ?? ''),
        ])));
        return (bool)preg_match('/papa|cabin|singletree|91\\s*singletree/', $hay);
    };

    $snapshot = static function (int $projectId) use ($isCabinLike): ?array {
        $p = Database::queryOne('SELECT * FROM build_wizard_projects WHERE id = ? LIMIT 1', [$projectId]);
        if (!$p) {
            return null;
        }
        return [
            'id' => (int)$p['id'],
            'owner_user_id' => (int)($p['owner_user_id'] ?? 0),
            'title' => (string)($p['title'] ?? ''),
            'lot_address' => (string)($p['lot_address'] ?? ''),
            'home_style' => (string)($p['home_style'] ?? ''),
            'status' => (string)($p['status'] ?? ''),
            'is_template' => (int)($p['is_template'] ?? 0),
            'updated_at' => (string)($p['updated_at'] ?? ''),
            'step_count' => (int)(Database::queryOne('SELECT COUNT(*) AS c FROM build_wizard_steps WHERE project_id = ?', [$projectId])['c'] ?? 0),
            'document_count' => (int)(Database::queryOne('SELECT COUNT(*) AS c FROM build_wizard_documents WHERE project_id = ?', [$projectId])['c'] ?? 0),
            'phase_range_count' => (int)(Database::queryOne('SELECT COUNT(*) AS c FROM build_wizard_phase_date_ranges WHERE project_id = ?', [$projectId])['c'] ?? 0),
            'is_cabin_like' => $isCabinLike($p),
        ];
    };

    $allProjects = Database::queryAll(
        'SELECT p.id, p.owner_user_id, p.title, p.lot_address, p.home_style, p.status, p.is_template, p.updated_at,
                (SELECT COUNT(*) FROM build_wizard_steps s WHERE s.project_id = p.id) AS step_count,
                (SELECT COUNT(*) FROM build_wizard_documents d WHERE d.project_id = p.id) AS document_count,
                (SELECT COUNT(*) FROM build_wizard_phase_date_ranges r WHERE r.project_id = p.id) AS phase_range_count
         FROM build_wizard_projects p
         ORDER BY p.id ASC'
    );
    foreach ($allProjects as &$row) {
        $row['is_cabin_like'] = $isCabinLike($row);
    }
    unset($row);

    $step4387 = Database::queryOne('SELECT id, project_id, title, phase_key FROM build_wizard_steps WHERE id = 4387 LIMIT 1', []);

    $docSamples = Database::queryAll(
        "SELECT id, project_id, LEFT(COALESCE(original_name, caption, ''), 120) AS name
         FROM build_wizard_documents
         WHERE project_id = 14
         ORDER BY id DESC
         LIMIT 15"
    );

    $docCabinHints = Database::queryAll(
        "SELECT id, project_id, LEFT(COALESCE(original_name, caption, ''), 120) AS name
         FROM build_wizard_documents
         WHERE original_name LIKE '%Singletree%'
            OR original_name LIKE '%Cabin%'
            OR original_name LIKE '%Papa%'
            OR caption LIKE '%Singletree%'
            OR caption LIKE '%Cabin%'
            OR caption LIKE '%Papa%'
         ORDER BY project_id ASC, id DESC
         LIMIT 40"
    );

    $orphans = Database::queryAll(
        'SELECT s.project_id, COUNT(*) AS step_count
         FROM build_wizard_steps s
         LEFT JOIN build_wizard_projects p ON p.id = s.project_id
         WHERE p.id IS NULL
         GROUP BY s.project_id
         ORDER BY step_count DESC'
    );

    if ($action === 'inspect') {
        catn8_json_response([
            'success' => true,
            'action' => 'inspect',
            'cabin_relink_loaded' => $cabinRelinkLoaded,
            'projects' => $allProjects,
            'step_4387' => $step4387,
            'project_14_doc_samples' => $docSamples,
            'cabin_named_documents' => $docCabinHints,
            'orphaned_step_groups' => $orphans,
        ]);
    }

    $ownerId = 1;
    $candidates = array_values(array_filter($allProjects, static fn($p) => (int)($p['owner_user_id'] ?? 0) === $ownerId));
    usort($candidates, static function ($a, $b) {
        $cmp = ((int)($b['document_count'] ?? 0)) <=> ((int)($a['document_count'] ?? 0));
        if ($cmp !== 0) {
            return $cmp;
        }
        return ((int)($b['step_count'] ?? 0)) <=> ((int)($a['step_count'] ?? 0));
    });
    if (!$candidates) {
        $fail(404, 'No projects for owner 1');
    }

    $canonicalId = (int)($candidates[0]['id'] ?? 0);
    $before = $snapshot($canonicalId);
    if (!$before) {
        $fail(404, 'Canonical project missing');
    }

    $reattachedOrphans = 0;
    // Skip orphan reattachment: live orphan groups are large template clones (65/260 steps)
    // and would pollute Papa's Cabin. Title/address restore + cabin repair is sufficient.
    $orphans = [];
    Database::beginTransaction();
    try {
        Database::execute(
            "UPDATE build_wizard_projects
             SET title = ?, lot_address = ?, is_template = 0, updated_at = NOW()
             WHERE id = ? AND owner_user_id = ?",
            ["Papa's Cabin", '91 Singletree Ln, Dawsonville, GA 30534', $canonicalId, $ownerId]
        );

        $enhancement = Database::queryOne(
            "SELECT id FROM build_wizard_projects WHERE owner_user_id = ? AND title LIKE '%Papa%Cabin%' AND id <> ? LIMIT 1",
            [$ownerId, $canonicalId]
        );
        if ($enhancement) {
            Database::execute(
                "UPDATE build_wizard_projects
                 SET lot_address = ?, updated_at = NOW()
                 WHERE id = ?",
                ['91 Singletree Ln, Dawsonville, GA 30534', (int)$enhancement['id']]
            );
        }

        foreach ($orphans as $orphanRow) {
            $orphanProjectId = (int)($orphanRow['project_id'] ?? 0);
            if ($orphanProjectId <= 0) {
                continue;
            }
            $hint = Database::queryOne(
                "SELECT COUNT(*) AS c FROM build_wizard_step_audit_logs
                 WHERE project_id = ?
                   AND (changes_json LIKE '%Papa%' OR changes_json LIKE '%Cabin%' OR changes_json LIKE '%Singletree%')",
                [$orphanProjectId]
            );
            $titleHint = Database::queryOne(
                "SELECT COUNT(*) AS c FROM build_wizard_steps
                 WHERE project_id = ?
                   AND (title LIKE '%Cabin%' OR caption LIKE '%Papa%' OR caption LIKE '%Singletree%'
                        OR description LIKE '%Singletree%' OR description LIKE '%Papa%')",
                [$orphanProjectId]
            );
            if ((int)($hint['c'] ?? 0) <= 0 && (int)($titleHint['c'] ?? 0) <= 0) {
                continue;
            }
            $reattachedOrphans += Database::execute(
                'UPDATE build_wizard_steps SET project_id = ? WHERE project_id = ?',
                [$canonicalId, $orphanProjectId]
            );
            Database::execute(
                'UPDATE build_wizard_documents SET project_id = ? WHERE project_id = ?',
                [$canonicalId, $orphanProjectId]
            );
            Database::execute(
                'UPDATE build_wizard_phase_date_ranges SET project_id = ? WHERE project_id = ?',
                [$canonicalId, $orphanProjectId]
            );
            Database::execute(
                'UPDATE build_wizard_step_audit_logs SET project_id = ? WHERE project_id = ?',
                [$canonicalId, $orphanProjectId]
            );
        }

        Database::commit();
    } catch (Throwable $e) {
        Database::rollBack();
        $fail(500, 'Restore transaction failed: ' . $e->getMessage());
    }

    $repair = null;
    if ($cabinRelinkLoaded && function_exists('catn8_build_wizard_repair_cabin_references')) {
        $repair = catn8_build_wizard_repair_cabin_references($ownerId, $canonicalId);
    }

    $after = $snapshot($canonicalId);
    catn8_diagnostics_log_event('build_wizard_restore_papas_cabin', true, 200, '', [
        'canonical_id' => $canonicalId,
        'reattached_orphans' => $reattachedOrphans,
    ]);

    catn8_json_response([
        'success' => true,
        'action' => 'restore',
        'canonical_project_id' => $canonicalId,
        'before' => $before,
        'after' => $after,
        'repair' => $repair,
        'reattached_orphan_steps' => $reattachedOrphans,
    ]);
} catch (Throwable $e) {
    $fail(500, 'Unhandled: ' . $e->getMessage(), [
        'file' => $e->getFile(),
        'line' => $e->getLine(),
    ]);
}
