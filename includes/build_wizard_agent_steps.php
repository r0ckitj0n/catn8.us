<?php

declare(strict_types=1);

/**
 * Fabric8r agent helpers for build-wizard steps (list/update/create/notes/docs).
 * Self-contained so api/fabric8_agent.php does not include build_wizard.php
 * (that file is a side-effect request router).
 */

function fabric8_agent_parse_date_or_null($value): ?string
{
    if ($value === null) {
        return null;
    }
    if (!is_string($value) && !is_numeric($value)) {
        return null;
    }
    $v = trim((string)$value);
    if ($v === '') {
        return null;
    }
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) {
        return $v;
    }
    if (preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/', $v, $m)) {
        return sprintf('%04d-%02d-%02d', (int)$m[3], (int)$m[1], (int)$m[2]);
    }
    return null;
}

function fabric8_agent_normalize_phase_key($value): string
{
    $raw = strtolower(trim((string)$value));
    if ($raw === '') {
        return 'general';
    }
    $raw = preg_replace('/[^a-z0-9_ -]+/', '', $raw);
    if (!is_string($raw)) {
        return 'general';
    }
    $raw = str_replace(' ', '_', trim($raw));
    if ($raw === '') {
        return 'general';
    }
    return substr($raw, 0, 64);
}

function fabric8_agent_step_type(string $value): string
{
    $t = strtolower(trim($value));
    if ($t === 'receipt') {
        return 'purchase';
    }
    return match ($t) {
        'permit', 'purchase', 'inspection', 'documentation', 'construction', 'photos',
        'blueprints', 'utility', 'delivery', 'milestone', 'closeout', 'other' => $t,
        default => 'construction',
    };
}

function fabric8_agent_infer_step_type(string $title, string $phaseKey = ''): string
{
    $t = strtolower(trim($title . ' ' . $phaseKey));
    if (str_contains($t, 'inspect')) {
        return 'inspection';
    }
    if (str_contains($t, 'material') || str_contains($t, 'purchase') || str_contains($t, 'buy')) {
        return 'purchase';
    }
    if (str_contains($t, 'permit')) {
        return 'permit';
    }
    if (str_contains($t, 'deliver')) {
        return 'delivery';
    }
    if (
        str_contains($t, 'install') || str_contains($t, 'build') || str_contains($t, 'labor')
        || str_contains($t, 'frame') || str_contains($t, 'drywall')
    ) {
        return 'construction';
    }
    return 'other';
}

function fabric8_agent_document_kind($value): string
{
    $raw = strtolower(trim((string)$value));
    return match ($raw) {
        'blueprint', 'document', 'home_photo', 'other', 'permit', 'photo', 'progress_photo',
        'receipt', 'receipt_attachment', 'site_photo', 'spec_sheet', 'survey' => $raw,
        default => 'document',
    };
}

function fabric8_agent_truthy($value): bool
{
    if (is_bool($value)) {
        return $value;
    }
    if (is_int($value) || is_float($value)) {
        return (int)$value === 1;
    }
    $s = strtolower(trim((string)$value));
    return in_array($s, ['1', 'true', 'yes', 'on'], true);
}

function fabric8_agent_to_decimal_or_null($value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }
    if (is_string($value)) {
        $value = str_replace([',', '$', ' '], '', trim($value));
    }
    if (!is_numeric($value)) {
        throw new InvalidArgumentException('cost must be numeric');
    }
    return number_format((float)$value, 2, '.', '');
}

/**
 * @return array{id:int,step_id:int,note_text:string,created_at:string,updated_at:string}
 */
function fabric8_agent_replace_step_note(int $stepId, string $noteText, ?int $noteId = null): array
{
    $noteText = trim($noteText);
    if ($noteText === '') {
        throw new InvalidArgumentException('note_text required');
    }
    if ($noteId !== null && $noteId > 0) {
        $existing = Database::queryOne(
            'SELECT id FROM build_wizard_step_notes WHERE id = ? AND step_id = ? LIMIT 1',
            [$noteId, $stepId]
        );
        if (!$existing) {
            throw new InvalidArgumentException('note_id does not belong to step_id');
        }
        Database::execute(
            'UPDATE build_wizard_step_notes SET note_text = ? WHERE id = ?',
            [$noteText, $noteId]
        );
        $row = Database::queryOne(
            'SELECT id, step_id, note_text, created_at, updated_at FROM build_wizard_step_notes WHERE id = ? LIMIT 1',
            [$noteId]
        );
    } else {
        $existing = Database::queryOne(
            'SELECT id FROM build_wizard_step_notes WHERE step_id = ? ORDER BY id ASC LIMIT 1',
            [$stepId]
        );
        if ($existing) {
            $noteId = (int)$existing['id'];
            Database::execute(
                'UPDATE build_wizard_step_notes SET note_text = ? WHERE id = ?',
                [$noteText, $noteId]
            );
            $row = Database::queryOne(
                'SELECT id, step_id, note_text, created_at, updated_at FROM build_wizard_step_notes WHERE id = ? LIMIT 1',
                [$noteId]
            );
        } else {
            return fabric8_agent_add_step_note($stepId, $noteText);
        }
    }
    if (!$row) {
        throw new RuntimeException('Note not found after replace');
    }
    return [
        'id' => (int)$row['id'],
        'step_id' => (int)$row['step_id'],
        'note_text' => (string)$row['note_text'],
        'created_at' => (string)($row['created_at'] ?? ''),
        'updated_at' => (string)($row['updated_at'] ?? ''),
    ];
}

/**
 * @return array<string,mixed>|null
 */
function fabric8_agent_require_project(int $projectId): ?array
{
    if ($projectId <= 0) {
        return null;
    }
    return Database::queryOne(
        'SELECT id, title, status, lot_address, updated_at
         FROM build_wizard_projects WHERE id = ? LIMIT 1',
        [$projectId]
    );
}

/**
 * @return array<string,mixed>|null
 */
function fabric8_agent_step_row(int $stepId, ?int $projectId = null): ?array
{
    if ($stepId <= 0) {
        return null;
    }
    $sql = 'SELECT s.id, s.project_id, s.step_order, s.phase_key, s.step_type, s.title, s.description,
                   s.expected_start_date, s.expected_end_date, s.expected_duration_days,
                   s.estimated_cost, s.actual_cost, s.is_completed, s.completed_at, s.source_ref,
                   s.parent_step_id, s.created_at, s.updated_at
            FROM build_wizard_steps s WHERE s.id = ?';
    $params = [$stepId];
    if ($projectId !== null && $projectId > 0) {
        $sql .= ' AND s.project_id = ?';
        $params[] = $projectId;
    }
    $sql .= ' LIMIT 1';
    $row = Database::queryOne($sql, $params);
    return $row ?: null;
}

/**
 * @return list<array<string,mixed>>
 */
function fabric8_agent_step_notes(int $stepId): array
{
    $rows = Database::queryAll(
        'SELECT id, step_id, note_text, created_at, updated_at
         FROM build_wizard_step_notes
         WHERE step_id = ?
         ORDER BY id ASC',
        [$stepId]
    );
    $out = [];
    foreach ($rows as $r) {
        $out[] = [
            'id' => (int)$r['id'],
            'step_id' => (int)$r['step_id'],
            'note_text' => (string)$r['note_text'],
            'created_at' => (string)($r['created_at'] ?? ''),
            'updated_at' => (string)($r['updated_at'] ?? ''),
        ];
    }
    return $out;
}

/**
 * @return list<array<string,mixed>>
 */
function fabric8_agent_step_documents(int $stepId): array
{
    $rows = Database::queryAll(
        'SELECT id, project_id, step_id, kind, original_name, mime_type, file_size_bytes,
                caption, receipt_amount, receipt_title, receipt_vendor, receipt_date, uploaded_at
         FROM build_wizard_documents
         WHERE step_id = ?
         ORDER BY id ASC',
        [$stepId]
    );
    $out = [];
    foreach ($rows as $r) {
        $docId = (int)$r['id'];
        $out[] = [
            'id' => $docId,
            'project_id' => (int)$r['project_id'],
            'step_id' => (int)$r['step_id'],
            'kind' => (string)$r['kind'],
            'original_name' => (string)$r['original_name'],
            'mime_type' => (string)($r['mime_type'] ?? ''),
            'file_size_bytes' => (int)($r['file_size_bytes'] ?? 0),
            'caption' => $r['caption'] !== null ? (string)$r['caption'] : null,
            'receipt_amount' => $r['receipt_amount'] !== null ? (float)$r['receipt_amount'] : null,
            'receipt_title' => $r['receipt_title'] !== null ? (string)$r['receipt_title'] : null,
            'receipt_vendor' => $r['receipt_vendor'] !== null ? (string)$r['receipt_vendor'] : null,
            'receipt_date' => $r['receipt_date'] !== null ? (string)$r['receipt_date'] : null,
            'uploaded_at' => (string)($r['uploaded_at'] ?? ''),
            'public_url' => '/api/build_wizard.php?action=get_document&document_id=' . $docId,
        ];
    }
    return $out;
}

/**
 * @param array<string,mixed> $row
 * @return array<string,mixed>
 */
function fabric8_agent_format_step(array $row, bool $includeNotes = true, bool $includeDocs = true): array
{
    $stepId = (int)$row['id'];
    $payload = [
        'id' => $stepId,
        'project_id' => (int)$row['project_id'],
        'step_order' => (int)($row['step_order'] ?? 0),
        'phase_key' => (string)($row['phase_key'] ?? 'general'),
        'step_type' => (string)($row['step_type'] ?? 'other'),
        'title' => (string)($row['title'] ?? ''),
        'description' => (string)($row['description'] ?? ''),
        'expected_start_date' => $row['expected_start_date'] !== null ? (string)$row['expected_start_date'] : null,
        'expected_end_date' => $row['expected_end_date'] !== null ? (string)$row['expected_end_date'] : null,
        'expected_duration_days' => $row['expected_duration_days'] !== null ? (int)$row['expected_duration_days'] : null,
        'estimated_cost' => $row['estimated_cost'] !== null ? (float)$row['estimated_cost'] : null,
        'actual_cost' => $row['actual_cost'] !== null ? (float)$row['actual_cost'] : null,
        'is_completed' => (int)($row['is_completed'] ?? 0),
        'completed_at' => $row['completed_at'] !== null ? (string)$row['completed_at'] : null,
        'source_ref' => $row['source_ref'] !== null ? (string)$row['source_ref'] : null,
        'parent_step_id' => $row['parent_step_id'] !== null ? (int)$row['parent_step_id'] : null,
        'created_at' => (string)($row['created_at'] ?? ''),
        'updated_at' => (string)($row['updated_at'] ?? ''),
    ];
    if ($includeNotes) {
        $payload['notes'] = fabric8_agent_step_notes($stepId);
    }
    if ($includeDocs) {
        $payload['documents'] = fabric8_agent_step_documents($stepId);
    }
    return $payload;
}

/**
 * @return list<array<string,mixed>>
 */
function fabric8_agent_list_steps(int $projectId, ?string $q = null, ?int $stepId = null): array
{
    $sql = 'SELECT s.id, s.project_id, s.step_order, s.phase_key, s.step_type, s.title, s.description,
                   s.expected_start_date, s.expected_end_date, s.expected_duration_days,
                   s.estimated_cost, s.actual_cost, s.is_completed, s.completed_at, s.source_ref,
                   s.parent_step_id, s.created_at, s.updated_at
            FROM build_wizard_steps s
            WHERE s.project_id = ?';
    $params = [$projectId];
    if ($stepId !== null && $stepId > 0) {
        $sql .= ' AND s.id = ?';
        $params[] = $stepId;
    }
    if ($q !== null && trim($q) !== '') {
        $sql .= ' AND (s.title LIKE ? OR s.description LIKE ?)';
        $like = '%' . trim($q) . '%';
        $params[] = $like;
        $params[] = $like;
    }
    $sql .= ' ORDER BY s.step_order ASC, s.id ASC';
    $rows = Database::queryAll($sql, $params);
    $out = [];
    foreach ($rows as $row) {
        $out[] = fabric8_agent_format_step($row, true, true);
    }
    return $out;
}

/**
 * Backup rows for given step ids (steps + notes + documents metadata).
 *
 * @param list<int> $stepIds
 * @return array{steps:list<array<string,mixed>>,notes:list<array<string,mixed>>,documents:list<array<string,mixed>>,backed_up_at:string}
 */
function fabric8_agent_backup_steps(array $stepIds): array
{
    $ids = array_values(array_unique(array_filter(array_map('intval', $stepIds), static fn(int $id): bool => $id > 0)));
    if (!$ids) {
        return [
            'steps' => [],
            'notes' => [],
            'documents' => [],
            'backed_up_at' => gmdate('c'),
        ];
    }
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $steps = Database::queryAll(
        "SELECT * FROM build_wizard_steps WHERE id IN ({$placeholders}) ORDER BY id ASC",
        $ids
    );
    $notes = Database::queryAll(
        "SELECT * FROM build_wizard_step_notes WHERE step_id IN ({$placeholders}) ORDER BY id ASC",
        $ids
    );
    $documents = Database::queryAll(
        "SELECT id, project_id, step_id, photo_section_id, receipt_parent_document_id, kind, original_name,
                mime_type, storage_path, file_size_bytes, caption, content_hash, meta_json,
                receipt_amount, receipt_title, receipt_vendor, receipt_date, receipt_notes, uploaded_at
         FROM build_wizard_documents
         WHERE step_id IN ({$placeholders})
         ORDER BY id ASC",
        $ids
    );
    return [
        'steps' => $steps,
        'notes' => $notes,
        'documents' => $documents,
        'backed_up_at' => gmdate('c'),
    ];
}

/**
 * @return array{id:int,step_id:int,note_text:string,created_at:string,updated_at:string}
 */
function fabric8_agent_add_step_note(int $stepId, string $noteText): array
{
    $noteText = trim($noteText);
    if ($noteText === '') {
        throw new InvalidArgumentException('note_text required');
    }
    Database::execute(
        'INSERT INTO build_wizard_step_notes (step_id, note_text) VALUES (?, ?)',
        [$stepId, $noteText]
    );
    $noteId = (int)Database::lastInsertId();
    $row = Database::queryOne(
        'SELECT id, step_id, note_text, created_at, updated_at FROM build_wizard_step_notes WHERE id = ? LIMIT 1',
        [$noteId]
    );
    if (!$row) {
        throw new RuntimeException('Note not found after insert');
    }
    return [
        'id' => (int)$row['id'],
        'step_id' => (int)$row['step_id'],
        'note_text' => (string)$row['note_text'],
        'created_at' => (string)($row['created_at'] ?? ''),
        'updated_at' => (string)($row['updated_at'] ?? ''),
    ];
}

/**
 * @param array<string,mixed> $body
 * @return array{step:array<string,mixed>,changes:array<string,mixed>,note:?array<string,mixed>}
 */
function fabric8_agent_update_step(int $stepId, array $body, bool $dryRun = false): array
{
    $before = fabric8_agent_step_row($stepId);
    if (!$before) {
        throw new InvalidArgumentException('Step not found');
    }

    $updates = [];
    $params = [];
    $changes = [];

    if (array_key_exists('title', $body)) {
        $title = trim((string)$body['title']);
        if ($title === '') {
            throw new InvalidArgumentException('title cannot be empty');
        }
        $updates[] = 'title = ?';
        $params[] = $title;
        $changes['title'] = $title;
    }
    if (array_key_exists('description', $body)) {
        $description = trim((string)$body['description']);
        $updates[] = 'description = ?';
        $params[] = $description;
        $changes['description'] = $description;
    }
    if (array_key_exists('phase_key', $body)) {
        $phase = fabric8_agent_normalize_phase_key($body['phase_key']);
        $updates[] = 'phase_key = ?';
        $params[] = $phase;
        $changes['phase_key'] = $phase;
    }
    if (array_key_exists('step_type', $body)) {
        $stepType = fabric8_agent_step_type((string)$body['step_type']);
        $updates[] = 'step_type = ?';
        $params[] = $stepType;
        $changes['step_type'] = $stepType;
    }

    $dateAliases = [
        'expected_start_date' => ['expected_start_date', 'date', 'start_date'],
        'expected_end_date' => ['expected_end_date', 'end_date'],
    ];
    foreach ($dateAliases as $column => $keys) {
        foreach ($keys as $key) {
            if (array_key_exists($key, $body)) {
                $parsed = fabric8_agent_parse_date_or_null($body[$key]);
                $updates[] = "{$column} = ?";
                $params[] = $parsed;
                $changes[$column] = $parsed;
                break;
            }
        }
    }

    $statusRaw = null;
    if (array_key_exists('status', $body)) {
        $statusRaw = $body['status'];
    } elseif (array_key_exists('is_completed', $body)) {
        $statusRaw = $body['is_completed'];
    }
    if ($statusRaw !== null) {
        $completed = false;
        if (is_string($statusRaw)) {
            $s = strtolower(trim($statusRaw));
            $completed = in_array($s, ['complete', 'completed', 'done', '1', 'true', 'yes'], true);
        } else {
            $completed = fabric8_agent_truthy($statusRaw);
        }
        $updates[] = 'is_completed = ?';
        $params[] = $completed ? 1 : 0;
        $changes['is_completed'] = $completed ? 1 : 0;
        if ($completed) {
            $completedDate = null;
            foreach (['completed_date', 'completed_at', 'completion_date'] as $ck) {
                if (array_key_exists($ck, $body)) {
                    $completedDate = fabric8_agent_parse_date_or_null($body[$ck]);
                    break;
                }
            }
            if ($completedDate !== null) {
                $updates[] = 'completed_at = ?';
                $params[] = $completedDate . ' 12:00:00';
                $changes['completed_at'] = $completedDate . ' 12:00:00';
            } else {
                $updates[] = 'completed_at = NOW()';
                $changes['completed_at'] = 'NOW()';
            }
        } else {
            $updates[] = 'completed_at = NULL';
            $changes['completed_at'] = null;
        }
    } elseif (
        array_key_exists('completed_date', $body)
        || array_key_exists('completed_at', $body)
        || array_key_exists('completion_date', $body)
    ) {
        $completedDate = fabric8_agent_parse_date_or_null(
            $body['completed_date'] ?? $body['completed_at'] ?? $body['completion_date'] ?? null
        );
        if ($completedDate !== null) {
            $updates[] = 'is_completed = 1';
            $updates[] = 'completed_at = ?';
            $params[] = $completedDate . ' 12:00:00';
            $changes['is_completed'] = 1;
            $changes['completed_at'] = $completedDate . ' 12:00:00';
        }
    }

    $costAliases = [
        'actual_cost' => ['actual_cost', 'cost', 'amount'],
        'estimated_cost' => ['estimated_cost', 'estimate'],
    ];
    foreach ($costAliases as $column => $keys) {
        foreach ($keys as $key) {
            if (array_key_exists($key, $body)) {
                $parsed = fabric8_agent_to_decimal_or_null($body[$key]);
                $updates[] = "{$column} = ?";
                $params[] = $parsed;
                $changes[$column] = $parsed;
                break;
            }
        }
    }

    $noteText = null;
    if (array_key_exists('notes', $body) && is_string($body['notes'])) {
        $noteText = trim($body['notes']);
    } elseif (array_key_exists('note', $body) && is_string($body['note'])) {
        $noteText = trim($body['note']);
    } elseif (array_key_exists('note_text', $body) && is_string($body['note_text'])) {
        $noteText = trim($body['note_text']);
    }
    if ($noteText === '') {
        $noteText = null;
    }
    $replaceNote = fabric8_agent_truthy($body['replace_note'] ?? $body['replace_notes'] ?? false)
        || (isset($body['note_id']) && (int)$body['note_id'] > 0);
    $noteId = isset($body['note_id']) ? (int)$body['note_id'] : null;

    if (!$updates && $noteText === null) {
        throw new InvalidArgumentException('No step updates provided');
    }

    if ($dryRun) {
        return [
            'step' => fabric8_agent_format_step($before),
            'changes' => $changes,
            'note' => $noteText !== null ? [
                'note_text' => $noteText,
                'replace' => $replaceNote,
                'note_id' => $noteId,
                'dry_run' => true,
            ] : null,
            'dry_run' => true,
        ];
    }

    if ($updates) {
        $params[] = $stepId;
        Database::execute(
            'UPDATE build_wizard_steps SET ' . implode(', ', $updates) . ' WHERE id = ?',
            $params
        );
    }

    $note = null;
    if ($noteText !== null) {
        if ($replaceNote) {
            $note = fabric8_agent_replace_step_note($stepId, $noteText, $noteId);
            $changes['note_replaced'] = $note['id'];
        } else {
            $note = fabric8_agent_add_step_note($stepId, $noteText);
            $changes['note_added'] = $note['id'];
        }
    }

    $after = fabric8_agent_step_row($stepId);
    if (!$after) {
        throw new RuntimeException('Step missing after update');
    }

    return [
        'step' => fabric8_agent_format_step($after),
        'changes' => $changes,
        'note' => $note,
        'dry_run' => false,
    ];
}

/**
 * @param array<string,mixed> $body
 * @return array{step:array<string,mixed>,dry_run:bool}
 */
function fabric8_agent_create_step(int $projectId, array $body, bool $dryRun = false): array
{
    if (!fabric8_agent_require_project($projectId)) {
        throw new InvalidArgumentException('Project not found');
    }
    $title = trim((string)($body['title'] ?? ''));
    if ($title === '') {
        throw new InvalidArgumentException('title required');
    }
    $phaseKey = fabric8_agent_normalize_phase_key($body['phase_key'] ?? 'interior_finishes');
    $stepType = array_key_exists('step_type', $body)
        ? fabric8_agent_step_type((string)$body['step_type'])
        : fabric8_agent_infer_step_type($title, $phaseKey);
    $description = trim((string)($body['description'] ?? ''));
    $start = null;
    foreach (['expected_start_date', 'date', 'start_date'] as $k) {
        if (array_key_exists($k, $body)) {
            $start = fabric8_agent_parse_date_or_null($body[$k]);
            break;
        }
    }
    $end = null;
    foreach (['expected_end_date', 'end_date'] as $k) {
        if (array_key_exists($k, $body)) {
            $end = fabric8_agent_parse_date_or_null($body[$k]);
            break;
        }
    }
    if ($end === null && $start !== null) {
        $end = $start;
    }

    $preview = [
        'project_id' => $projectId,
        'phase_key' => $phaseKey,
        'step_type' => $stepType,
        'title' => $title,
        'description' => $description,
        'expected_start_date' => $start,
        'expected_end_date' => $end,
        'is_completed' => 0,
        'source_ref' => 'agent_fabric8_create_step',
    ];

    if ($dryRun) {
        return [
            'step' => $preview + ['id' => 0, 'notes' => [], 'documents' => []],
            'dry_run' => true,
        ];
    }

    $maxOrderRow = Database::queryOne(
        'SELECT MAX(step_order) AS max_order FROM build_wizard_steps WHERE project_id = ?',
        [$projectId]
    );
    $nextOrder = (int)($maxOrderRow['max_order'] ?? 0) + 1;

    Database::execute(
        'INSERT INTO build_wizard_steps
            (project_id, step_order, phase_key, step_type, title, description,
             expected_start_date, expected_end_date, is_completed, completed_at, ai_generated, source_ref)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, 0, ?)',
        [
            $projectId,
            $nextOrder,
            $phaseKey,
            $stepType,
            $title,
            $description,
            $start,
            $end,
            'agent_fabric8_create_step',
        ]
    );
    $stepId = (int)Database::lastInsertId();

    $noteText = null;
    if (array_key_exists('notes', $body) && is_string($body['notes'])) {
        $noteText = trim($body['notes']);
    } elseif (array_key_exists('note', $body) && is_string($body['note'])) {
        $noteText = trim($body['note']);
    } elseif (array_key_exists('note_text', $body) && is_string($body['note_text'])) {
        $noteText = trim($body['note_text']);
    }
    if ($noteText !== null && $noteText !== '') {
        fabric8_agent_add_step_note($stepId, $noteText);
    }

    $row = fabric8_agent_step_row($stepId);
    if (!$row) {
        throw new RuntimeException('Step not found after insert');
    }
    return [
        'step' => fabric8_agent_format_step($row),
        'dry_run' => false,
    ];
}

/**
 * Attach a document/receipt to a step (private storage + blob).
 *
 * @param array<string,mixed>|string $file multipart file array or local path
 * @param array<string,mixed> $options
 * @return array{document:array<string,mixed>,deduped:bool,created:bool,dry_run:bool}
 */
function fabric8_agent_attach_step_document(
    int $projectId,
    int $stepId,
    $file,
    array $options = [],
    bool $dryRun = false
): array {
    $step = fabric8_agent_step_row($stepId, $projectId);
    if (!$step) {
        throw new InvalidArgumentException('Step not found for project');
    }

    if (is_string($file)) {
        $srcPath = $file;
        if ($srcPath === '' || !is_file($srcPath)) {
            throw new InvalidArgumentException('File not found');
        }
        $origName = basename($srcPath);
        $size = (int)filesize($srcPath);
        $bytes = file_get_contents($srcPath);
    } else {
        if (!is_array($file)) {
            throw new InvalidArgumentException('Invalid file');
        }
        $tmp = (string)($file['tmp_name'] ?? '');
        if ($tmp === '' || !(is_uploaded_file($tmp) || is_file($tmp))) {
            throw new InvalidArgumentException('Invalid upload');
        }
        $srcPath = $tmp;
        $origName = trim((string)($file['name'] ?? 'document'));
        $size = (int)($file['size'] ?? filesize($tmp));
        $bytes = file_get_contents($tmp);
    }

    if (!is_string($bytes) || $bytes === '') {
        throw new InvalidArgumentException('Uploaded file is empty');
    }
    if ($size <= 0) {
        $size = strlen($bytes);
    }
    if ($size > 40 * 1024 * 1024) {
        throw new InvalidArgumentException('Uploaded file exceeds 40MB');
    }

    $kind = fabric8_agent_document_kind($options['kind'] ?? 'receipt');
    $caption = trim((string)($options['caption'] ?? ''));
    if ($caption === '') {
        $caption = null;
    }
    $contentHash = hash('sha256', $bytes);

    $existing = Database::queryOne(
        'SELECT id, step_id FROM build_wizard_documents WHERE project_id = ? AND content_hash = ? LIMIT 1',
        [$projectId, $contentHash]
    );

    $receiptAmount = null;
    $receiptTitle = null;
    $receiptVendor = null;
    $receiptDate = null;
    $receiptNotes = null;
    if ($kind === 'receipt') {
        if (isset($options['receipt_amount']) && is_numeric($options['receipt_amount'])) {
            $receiptAmount = number_format((float)$options['receipt_amount'], 2, '.', '');
        }
        $receiptTitle = trim((string)($options['receipt_title'] ?? '')) ?: null;
        $receiptVendor = trim((string)($options['receipt_vendor'] ?? '')) ?: null;
        $receiptDate = fabric8_agent_parse_date_or_null($options['receipt_date'] ?? null);
        $receiptNotes = trim((string)($options['receipt_notes'] ?? '')) ?: null;
    }

    if ($dryRun) {
        return [
            'document' => [
                'id' => $existing ? (int)$existing['id'] : 0,
                'project_id' => $projectId,
                'step_id' => $stepId,
                'kind' => $kind,
                'original_name' => $origName,
                'file_size_bytes' => $size,
                'caption' => $caption,
            ],
            'deduped' => (bool)$existing,
            'created' => !$existing,
            'dry_run' => true,
        ];
    }

    if ($existing) {
        $docId = (int)$existing['id'];
        Database::execute(
            'UPDATE build_wizard_documents
             SET step_id = ?,
                 kind = ?,
                 caption = COALESCE(?, caption),
                 receipt_amount = COALESCE(?, receipt_amount),
                 receipt_title = COALESCE(?, receipt_title),
                 receipt_vendor = COALESCE(?, receipt_vendor),
                 receipt_date = COALESCE(?, receipt_date),
                 receipt_notes = COALESCE(?, receipt_notes)
             WHERE id = ?',
            [
                $stepId,
                $kind,
                $caption,
                $receiptAmount,
                $receiptTitle,
                $receiptVendor,
                $receiptDate,
                $receiptNotes,
                $docId,
            ]
        );
        $docs = fabric8_agent_step_documents($stepId);
        $doc = null;
        foreach ($docs as $d) {
            if ((int)$d['id'] === $docId) {
                $doc = $d;
                break;
            }
        }
        return [
            'document' => $doc ?: ['id' => $docId, 'step_id' => $stepId],
            'deduped' => true,
            'created' => false,
            'dry_run' => false,
        ];
    }

    $finfo = function_exists('finfo_open') ? finfo_open(FILEINFO_MIME_TYPE) : false;
    $detectedMime = $finfo ? finfo_buffer($finfo, $bytes) : false;
    if ($finfo) {
        finfo_close($finfo);
    }
    $mime = trim((string)($detectedMime ?: (is_array($file) ? ($file['type'] ?? '') : '') ?: 'application/pdf'));
    if ($mime === '') {
        $mime = 'application/pdf';
    }

    $safeName = preg_replace('/[^A-Za-z0-9._-]+/', '_', $origName);
    if (!is_string($safeName) || $safeName === '') {
        $safeName = 'document.pdf';
    }

    $uploadDir = dirname(__DIR__) . '/private/build-wizard/' . $projectId;
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0750, true) && !is_dir($uploadDir)) {
        throw new RuntimeException('Failed to prepare private upload directory');
    }
    $storedName = date('Ymd_His') . '_' . substr($contentHash, 0, 12) . '_' . $safeName;
    $destPath = $uploadDir . '/' . $storedName;
    if (file_put_contents($destPath, $bytes) === false) {
        throw new RuntimeException('Failed to store uploaded file');
    }
    @chmod($destPath, 0640);

    Database::execute(
        'INSERT INTO build_wizard_documents (
            project_id, step_id, photo_section_id, receipt_parent_document_id, kind, original_name, mime_type,
            storage_path, file_size_bytes, caption, content_hash, meta_json,
            receipt_amount, receipt_title, receipt_vendor, receipt_date, receipt_notes
         ) VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)',
        [
            $projectId,
            $stepId,
            $kind,
            $origName,
            $mime,
            $destPath,
            $size,
            $caption,
            $contentHash,
            $receiptAmount,
            $receiptTitle,
            $receiptVendor,
            $receiptDate,
            $receiptNotes,
        ]
    );
    $docId = (int)Database::lastInsertId();

    Database::execute(
        'INSERT INTO build_wizard_document_blobs (document_id, mime_type, file_blob, file_size_bytes)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), file_blob = VALUES(file_blob), file_size_bytes = VALUES(file_size_bytes)',
        [$docId, $mime, $bytes, strlen($bytes)]
    );

    $docs = fabric8_agent_step_documents($stepId);
    $doc = null;
    foreach ($docs as $d) {
        if ((int)$d['id'] === $docId) {
            $doc = $d;
            break;
        }
    }

    return [
        'document' => $doc ?: ['id' => $docId, 'step_id' => $stepId, 'original_name' => $origName],
        'deduped' => false,
        'created' => true,
        'dry_run' => false,
    ];
}
