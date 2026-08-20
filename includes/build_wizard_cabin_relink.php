<?php

declare(strict_types=1);

/**
 * Reattach Papa's Cabin / Singletree rows that still exist in MySQL
 * but point at the wrong project or at leftover step ids from the
 * template-migration ("new 65") work.
 */

function catn8_build_wizard_cabin_filename_canonical(string $name): string
{
    $base = strtolower(trim($name));
    $base = preg_replace('/^\d{8}_\d{6}_[0-9a-f]{8}_/', '', $base) ?? $base;
    $base = preg_replace('/[^a-z0-9]+/', '', $base);
    return is_string($base) ? $base : '';
}

function catn8_build_wizard_cabin_haystack(array $project): string
{
    return strtolower(trim(implode(' ', [
        (string)($project['title'] ?? ''),
        (string)($project['lot_address'] ?? ''),
        (string)($project['home_style'] ?? ''),
        (string)($project['wizard_notes'] ?? ''),
    ])));
}

function catn8_build_wizard_project_is_cabin_like(array $project): bool
{
    $hay = catn8_build_wizard_cabin_haystack($project);
    if ($hay === '') {
        return false;
    }
    return (bool)preg_match('/papa|cabin|singletree|91\\s*singletree/', $hay);
}

function catn8_build_wizard_cabin_guess_phase_key(string $kind, string $name): string
{
    $ctx = strtolower($kind . ' ' . $name);
    if (str_contains($ctx, 'plat') || str_contains($ctx, 'survey') || str_contains($ctx, 'legal') || str_contains($ctx, 'buy_offer') || str_contains($ctx, 'buy offer')) {
        return 'land_due_diligence';
    }
    if (str_contains($ctx, 'permit') || str_contains($ctx, 'setback') || str_contains($ctx, 'siteplan') || str_contains($ctx, 'site plan')) {
        return 'dawson_county_permits';
    }
    if (str_contains($ctx, 'foundation')) {
        return 'foundation';
    }
    if (str_contains($ctx, 'framing') || str_contains($ctx, 'gable') || str_contains($ctx, 'dimension') || str_contains($ctx, 'porch')) {
        return 'framing_shell';
    }
    if (str_contains($ctx, 'electric') || str_contains($ctx, 'breaker') || str_contains($ctx, 'hvac') || str_contains($ctx, 'septic') || str_contains($ctx, 'mitsubishi')) {
        return 'mep_rough_in';
    }
    if (str_contains($ctx, 'expense') || str_contains($ctx, 'shopping') || str_contains($ctx, 'receipt') || str_contains($ctx, 'coupon') || str_contains($ctx, 'materials') || str_contains($ctx, 'timeline') || str_contains($ctx, 'task')) {
        return 'design_preconstruction';
    }
    if (in_array($kind, ['survey'], true)) {
        return 'land_due_diligence';
    }
    if (in_array($kind, ['permit'], true)) {
        return 'dawson_county_permits';
    }
    if (in_array($kind, ['site_photo', 'home_photo', 'progress_photo', 'photo'], true)) {
        return 'site_preparation';
    }
    if (in_array($kind, ['blueprint', 'spec_sheet'], true)) {
        return 'design_preconstruction';
    }
    return 'design_preconstruction';
}

function catn8_build_wizard_cabin_pick_step_id(int $projectId, string $phaseKey, string $preferKeyword = ''): ?int
{
    if ($projectId <= 0) {
        return null;
    }

    $rows = Database::queryAll(
        'SELECT id, phase_key, title, is_completed, step_order
         FROM build_wizard_steps
         WHERE project_id = ?
         ORDER BY step_order ASC, id ASC',
        [$projectId]
    );
    if (!$rows) {
        return null;
    }

    $phaseKey = function_exists('catn8_build_wizard_normalize_phase_key')
        ? catn8_build_wizard_normalize_phase_key($phaseKey)
        : strtolower(trim($phaseKey));
    $prefer = strtolower(trim($preferKeyword));
    $bestId = 0;
    $bestScore = -1;
    foreach ($rows as $row) {
        $sid = (int)($row['id'] ?? 0);
        if ($sid <= 0) {
            continue;
        }
        $rowPhase = function_exists('catn8_build_wizard_normalize_phase_key')
            ? catn8_build_wizard_normalize_phase_key((string)($row['phase_key'] ?? ''))
            : strtolower(trim((string)($row['phase_key'] ?? '')));
        $title = strtolower((string)($row['title'] ?? ''));
        $score = 0;
        if ($phaseKey !== '' && $phaseKey !== 'general' && $rowPhase === $phaseKey) {
            $score += 40;
        }
        if ($prefer !== '' && str_contains($title, $prefer)) {
            $score += 25;
        }
        if ((int)($row['is_completed'] ?? 0) === 0) {
            $score += 2;
        }
        $score -= min(10, (int)($row['step_order'] ?? 0) / 20);
        if ($score > $bestScore) {
            $bestScore = $score;
            $bestId = $sid;
        }
    }

    if ($bestId <= 0) {
        $bestId = (int)($rows[0]['id'] ?? 0);
    }
    return $bestId > 0 ? $bestId : null;
}

function catn8_build_wizard_cabin_project_scores(int $uid): array
{
    $projects = Database::queryAll(
        'SELECT p.*,
                (SELECT COUNT(*) FROM build_wizard_documents d WHERE d.project_id = p.id) AS document_count,
                (SELECT COUNT(*) FROM build_wizard_steps s WHERE s.project_id = p.id) AS step_count
         FROM build_wizard_projects p
         WHERE p.owner_user_id = ?
         ORDER BY p.id ASC',
        [$uid]
    );

    $scored = [];
    foreach ($projects as $project) {
        $title = strtolower(trim((string)($project['title'] ?? '')));
        $hay = catn8_build_wizard_cabin_haystack($project);
        $docs = (int)($project['document_count'] ?? 0);
        $steps = (int)($project['step_count'] ?? 0);
        $score = ($docs * 1000) + ($steps * 10);
        if (catn8_build_wizard_project_is_cabin_like($project)) {
            $score += 100;
        }
        if ($title === "papa's cabin" || $title === 'papas cabin') {
            $score += 25;
        }
        if (str_contains($hay, 'papa')) {
            $score += 15;
        }
        if (str_contains($hay, 'singletree')) {
            $score += 12;
        }
        if (str_contains($hay, 'cabin')) {
            $score += 8;
        }
        if ((int)($project['id'] ?? 0) === 65 && catn8_build_wizard_project_is_cabin_like($project)) {
            $score += 4;
        }
        $project['cabin_score'] = $score;
        $scored[] = $project;
    }

    usort($scored, static function (array $a, array $b): int {
        $scoreCmp = ((int)($b['cabin_score'] ?? 0)) <=> ((int)($a['cabin_score'] ?? 0));
        if ($scoreCmp !== 0) {
            return $scoreCmp;
        }
        return ((int)($b['id'] ?? 0)) <=> ((int)($a['id'] ?? 0));
    });

    return $scored;
}

function catn8_build_wizard_choose_cabin_project(int $uid, ?int $requestedProjectId = null): ?array
{
    $scored = catn8_build_wizard_cabin_project_scores($uid);
    if (!$scored) {
        return null;
    }

    if ($requestedProjectId !== null && $requestedProjectId > 0) {
        foreach ($scored as $project) {
            if ((int)($project['id'] ?? 0) === $requestedProjectId) {
                return $project;
            }
        }
    }

    $best = $scored[0];
    if ((int)($best['cabin_score'] ?? 0) <= 0) {
        return null;
    }
    return $best;
}

function catn8_build_wizard_cabin_sibling_ids(int $uid, int $canonicalProjectId, array $canonicalProject): array
{
    $canonicalLot = strtolower(trim((string)($canonicalProject['lot_address'] ?? '')));
    $rows = Database::queryAll(
        'SELECT id, title, lot_address, home_style, wizard_notes
         FROM build_wizard_projects
         WHERE owner_user_id = ? AND id <> ?',
        [$uid, $canonicalProjectId]
    );

    $ids = [];
    foreach ($rows as $row) {
        $id = (int)($row['id'] ?? 0);
        if ($id <= 0) {
            continue;
        }
        $lot = strtolower(trim((string)($row['lot_address'] ?? '')));
        $sameLot = $canonicalLot !== '' && $lot !== '' && $lot === $canonicalLot;
        if ($sameLot || catn8_build_wizard_project_is_cabin_like($row)) {
            $ids[] = $id;
        }
    }
    return $ids;
}

/**
 * @return array{
 *   project_id:int,
 *   sibling_projects:int[],
 *   moved_documents:int,
 *   remapped_step_ids:int,
 *   moved_contacts:int,
 *   moved_assignments:int,
 *   search_index_updated:int
 * }
 */
function catn8_build_wizard_repair_cabin_references(int $uid, int $canonicalProjectId): array
{
    $canonical = Database::queryOne(
        'SELECT * FROM build_wizard_projects WHERE id = ? AND owner_user_id = ? LIMIT 1',
        [$canonicalProjectId, $uid]
    );
    if (!$canonical) {
        throw new RuntimeException('Canonical cabin project not found');
    }

    $stats = [
        'project_id' => $canonicalProjectId,
        'sibling_projects' => [],
        'moved_documents' => 0,
        'remapped_step_ids' => 0,
        'moved_contacts' => 0,
        'moved_assignments' => 0,
        'search_index_updated' => 0,
    ];

    if (!catn8_build_wizard_project_is_cabin_like($canonical)) {
        return $stats;
    }

    $siblingIds = catn8_build_wizard_cabin_sibling_ids($uid, $canonicalProjectId, $canonical);
    $stats['sibling_projects'] = $siblingIds;

    $owningIds = array_values(array_unique(array_merge([$canonicalProjectId], $siblingIds)));
    $placeholders = implode(',', array_fill(0, count($owningIds), '?'));

    $validStepIds = [];
    $stepRows = Database::queryAll(
        'SELECT id FROM build_wizard_steps WHERE project_id = ?',
        [$canonicalProjectId]
    );
    foreach ($stepRows as $row) {
        $sid = (int)($row['id'] ?? 0);
        if ($sid > 0) {
            $validStepIds[$sid] = true;
        }
    }

    Database::beginTransaction();
    try {
        if ($siblingIds) {
            $siblingPlaceholders = implode(',', array_fill(0, count($siblingIds), '?'));
            $stats['moved_documents'] = Database::execute(
                'UPDATE build_wizard_documents SET project_id = ? WHERE project_id IN (' . $siblingPlaceholders . ')',
                array_merge([$canonicalProjectId], $siblingIds)
            );
            $stats['search_index_updated'] = Database::execute(
                'UPDATE build_wizard_document_search_index SET project_id = ? WHERE project_id IN (' . $siblingPlaceholders . ')',
                array_merge([$canonicalProjectId], $siblingIds)
            );
            $stats['moved_contacts'] = Database::execute(
                'UPDATE build_wizard_contacts SET project_id = ? WHERE owner_user_id = ? AND project_id IN (' . $siblingPlaceholders . ')',
                array_merge([$canonicalProjectId, $uid], $siblingIds)
            );

            $assignments = Database::queryAll(
                'SELECT id, contact_id, step_id, phase_key
                 FROM build_wizard_contact_assignments
                 WHERE project_id IN (' . $siblingPlaceholders . ')',
                $siblingIds
            );
            foreach ($assignments as $assignment) {
                $assignmentId = (int)($assignment['id'] ?? 0);
                $contactId = (int)($assignment['contact_id'] ?? 0);
                $phaseKey = $assignment['phase_key'] !== null ? (string)$assignment['phase_key'] : null;
                $oldStepId = $assignment['step_id'] !== null ? (int)$assignment['step_id'] : 0;
                $nextStepId = ($oldStepId > 0 && isset($validStepIds[$oldStepId]))
                    ? $oldStepId
                    : catn8_build_wizard_cabin_pick_step_id($canonicalProjectId, (string)($phaseKey ?? 'general'));
                $exists = Database::queryOne(
                    'SELECT id FROM build_wizard_contact_assignments
                     WHERE project_id = ? AND contact_id = ?
                       AND ((step_id IS NULL AND ? IS NULL) OR step_id = ?)
                       AND ((phase_key IS NULL AND ? IS NULL) OR phase_key = ?)
                     LIMIT 1',
                    [$canonicalProjectId, $contactId, $nextStepId, $nextStepId, $phaseKey, $phaseKey]
                );
                if ($exists) {
                    Database::execute('DELETE FROM build_wizard_contact_assignments WHERE id = ?', [$assignmentId]);
                    continue;
                }
                Database::execute(
                    'UPDATE build_wizard_contact_assignments
                     SET project_id = ?, step_id = ?
                     WHERE id = ?',
                    [$canonicalProjectId, $nextStepId, $assignmentId]
                );
                $stats['moved_assignments']++;
            }
        }

        $documents = Database::queryAll(
            'SELECT id, step_id, kind, original_name, storage_path
             FROM build_wizard_documents
             WHERE project_id IN (' . $placeholders . ')
             ORDER BY id ASC',
            $owningIds
        );

        foreach ($documents as $doc) {
            $docId = (int)($doc['id'] ?? 0);
            if ($docId <= 0) {
                continue;
            }
            $currentStepId = $doc['step_id'] !== null ? (int)$doc['step_id'] : 0;
            if ($currentStepId > 0 && isset($validStepIds[$currentStepId])) {
                continue;
            }
            $name = trim((string)($doc['original_name'] ?? ''));
            if ($name === '') {
                $name = (string)($doc['storage_path'] ?? '');
            }
            $kind = trim((string)($doc['kind'] ?? 'other'));
            $phaseKey = catn8_build_wizard_cabin_guess_phase_key($kind, $name);
            $prefer = '';
            $lower = strtolower($name);
            foreach (['permit', 'plat', 'foundation', 'framing', 'electrical', 'site', 'design', 'survey'] as $keyword) {
                if (str_contains($lower, $keyword)) {
                    $prefer = $keyword;
                    break;
                }
            }
            $nextStepId = catn8_build_wizard_cabin_pick_step_id($canonicalProjectId, $phaseKey, $prefer);
            if ($nextStepId === null || $nextStepId === $currentStepId) {
                continue;
            }
            Database::execute(
                'UPDATE build_wizard_documents SET project_id = ?, step_id = ? WHERE id = ?',
                [$canonicalProjectId, $nextStepId, $docId]
            );
            $stats['remapped_step_ids']++;
            $validStepIds[$nextStepId] = true;
        }

        $blueprintId = (int)($canonical['blueprint_document_id'] ?? 0);
        if ($blueprintId <= 0) {
            $blueprint = Database::queryOne(
                "SELECT id FROM build_wizard_documents
                 WHERE project_id = ?
                   AND (kind = 'blueprint' OR LOWER(original_name) LIKE '%cabin%' OR LOWER(original_name) LIKE '%.plan')
                 ORDER BY
                   CASE WHEN LOWER(original_name) LIKE '%main%' THEN 0 ELSE 1 END,
                   CASE WHEN LOWER(original_name) LIKE '%cabin%' THEN 0 ELSE 1 END,
                   id ASC
                 LIMIT 1",
                [$canonicalProjectId]
            );
            if ($blueprint) {
                Database::execute(
                    'UPDATE build_wizard_projects SET blueprint_document_id = ? WHERE id = ?',
                    [(int)$blueprint['id'], $canonicalProjectId]
                );
            }
        }

        Database::commit();
    } catch (Throwable $e) {
        if (Database::inTransaction()) {
            Database::rollBack();
        }
        throw $e;
    }

    return $stats;
}
