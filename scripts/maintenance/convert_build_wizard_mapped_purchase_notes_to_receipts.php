<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/config.php';

function bw_map_usage(): void
{
    echo "Usage:\n";
    echo "  php scripts/maintenance/convert_build_wizard_mapped_purchase_notes_to_receipts.php [--apply] [--db-env=live|local]\n";
    echo "      [--project-id=<id>] [--owner-user-id=<id>]\n";
    echo "\n";
    echo "Notes:\n";
    echo "  - Dry-run by default. Use --apply to write.\n";
    echo "  - Converts note lines like: Mapped source steps: #44 Purchase: Toilet; #80 Purchase: Septic tank\n";
    echo "  - Creates receipt rows on target steps and removes the mapping line when all entries resolve.\n";
}

function bw_map_parse_args(array $argv): array
{
    $opts = [
        'apply' => false,
        'db_env' => 'live',
        'project_id' => null,
        'owner_user_id' => null,
    ];

    foreach ($argv as $arg) {
        if ($arg === '--apply') {
            $opts['apply'] = true;
            continue;
        }
        if ($arg === '--help' || $arg === '-h') {
            bw_map_usage();
            exit(0);
        }
        if (str_starts_with($arg, '--db-env=')) {
            $v = strtolower(trim((string)substr($arg, 9)));
            if (in_array($v, ['live', 'local'], true)) {
                $opts['db_env'] = $v;
            }
            continue;
        }
        if (str_starts_with($arg, '--project-id=')) {
            $v = (int)trim((string)substr($arg, 13));
            $opts['project_id'] = $v > 0 ? $v : null;
            continue;
        }
        if (str_starts_with($arg, '--owner-user-id=')) {
            $v = (int)trim((string)substr($arg, 16));
            $opts['owner_user_id'] = $v > 0 ? $v : null;
            continue;
        }
    }

    return $opts;
}

function bw_map_connect(string $dbEnv): PDO
{
    $cfg = catn8_get_db_config($dbEnv);
    $host = trim((string)($cfg['host'] ?? ''));
    $db = trim((string)($cfg['db'] ?? ''));
    $user = trim((string)($cfg['user'] ?? ''));
    $pass = (string)($cfg['pass'] ?? '');
    $port = (int)($cfg['port'] ?? 3306);
    $socket = trim((string)($cfg['socket'] ?? ''));

    if ($db === '' || $user === '' || ($host === '' && $socket === '')) {
        throw new RuntimeException('DB config for --db-env=' . $dbEnv . ' is incomplete');
    }
    return Database::createConnection($host, $db, $user, $pass, $port, $socket);
}

function bw_map_query_all(PDO $pdo, string $sql, array $params = []): array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

function bw_map_query_one(PDO $pdo, string $sql, array $params = []): ?array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row === false ? null : $row;
}

function bw_map_exec(PDO $pdo, string $sql, array $params = []): int
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->rowCount();
}

function bw_map_table_exists(PDO $pdo, string $tableName): bool
{
    $row = bw_map_query_one(
        $pdo,
        'SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1',
        [$tableName]
    );
    return $row !== null;
}

function bw_map_parse_entries(string $noteText): array
{
    $lines = preg_split('/\R/u', $noteText) ?: [];
    $targetLine = null;

    foreach ($lines as $line) {
        if (stripos($line, 'Mapped source steps:') !== false) {
            $targetLine = $line;
            break;
        }
    }

    if ($targetLine === null) {
        return [
            'line_found' => false,
            'line_text' => '',
            'entries' => [],
        ];
    }

    $afterColon = $targetLine;
    $colonPos = strpos($targetLine, ':');
    if ($colonPos !== false) {
        $afterColon = trim(substr($targetLine, $colonPos + 1));
    }

    $entries = [];
    $parts = array_filter(array_map('trim', explode(';', $afterColon)), static fn(string $v): bool => $v !== '');
    foreach ($parts as $part) {
        if (!preg_match('/^#\s*(\d+)\s+Purchase\s*:\s*(.+)$/i', $part, $m)) {
            continue;
        }
        $stepNumber = (int)$m[1];
        $title = trim((string)$m[2]);
        if ($stepNumber <= 0 || $title === '') {
            continue;
        }
        $entries[] = [
            'step_number' => $stepNumber,
            'title' => mb_substr($title, 0, 255),
            'raw' => $part,
        ];
    }

    return [
        'line_found' => true,
        'line_text' => $targetLine,
        'entries' => $entries,
    ];
}

function bw_map_remove_mapping_line(string $noteText): string
{
    $clean = preg_replace('/^\h*Mapped source steps:.*(?:\R|$)/im', '', $noteText);
    if (!is_string($clean)) {
        return trim($noteText);
    }
    $clean = preg_replace('/\R{3,}/', "\n\n", $clean);
    return trim((string)$clean);
}

function bw_map_receipt_blob_text(string $title, int $sourceNoteId): string
{
    return "Receipt record\n"
        . 'Title: ' . $title . "\n"
        . 'Vendor: ' . "\n"
        . 'Date: ' . "\n"
        . 'Amount: ' . "\n"
        . 'Notes: Auto-migrated from step note #' . $sourceNoteId . "\n";
}

function bw_map_main(array $argv): int
{
    $opts = bw_map_parse_args($argv);
    $apply = (bool)$opts['apply'];

    $pdo = bw_map_connect((string)$opts['db_env']);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $params = [];
    $where = 'WHERE n.note_text LIKE ?';
    $params[] = '%Mapped source steps:%';

    if ((int)($opts['project_id'] ?? 0) > 0) {
        $where .= ' AND s.project_id = ?';
        $params[] = (int)$opts['project_id'];
    }
    if ((int)($opts['owner_user_id'] ?? 0) > 0) {
        $where .= ' AND p.owner_user_id = ?';
        $params[] = (int)$opts['owner_user_id'];
    }

    $notes = bw_map_query_all(
        $pdo,
        'SELECT n.id AS note_id, n.step_id, n.note_text,
                s.project_id, s.step_order, s.title AS source_step_title,
                p.owner_user_id, p.title AS project_title
         FROM build_wizard_step_notes n
         INNER JOIN build_wizard_steps s ON s.id = n.step_id
         INNER JOIN build_wizard_projects p ON p.id = s.project_id
         ' . $where . '
         ORDER BY s.project_id ASC, n.id ASC',
        $params
    );

    $hasDocBlobTable = bw_map_table_exists($pdo, 'build_wizard_document_blobs');
    $stepsByProject = [];

    $summary = [
        'db_env' => $opts['db_env'],
        'apply' => $apply ? 1 : 0,
        'notes_scanned' => count($notes),
        'notes_with_mapped_entries' => 0,
        'receipts_inserted' => 0,
        'receipts_already_present' => 0,
        'entries_unresolved' => 0,
        'notes_updated' => 0,
        'notes_deleted' => 0,
        'details' => [],
    ];

    foreach ($notes as $noteRow) {
        $noteId = (int)($noteRow['note_id'] ?? 0);
        $projectId = (int)($noteRow['project_id'] ?? 0);
        $noteText = (string)($noteRow['note_text'] ?? '');
        if ($noteId <= 0 || $projectId <= 0) {
            continue;
        }

        $parsed = bw_map_parse_entries($noteText);
        $entries = is_array($parsed['entries'] ?? null) ? $parsed['entries'] : [];
        if (!$entries) {
            continue;
        }

        $summary['notes_with_mapped_entries']++;

        if (!isset($stepsByProject[$projectId])) {
            $stepRows = bw_map_query_all(
                $pdo,
                'SELECT id, step_order, title FROM build_wizard_steps WHERE project_id = ?',
                [$projectId]
            );
            $map = [];
            foreach ($stepRows as $stepRow) {
                $stepOrder = (int)($stepRow['step_order'] ?? 0);
                if ($stepOrder <= 0) {
                    continue;
                }
                $map[$stepOrder] = [
                    'id' => (int)($stepRow['id'] ?? 0),
                    'title' => (string)($stepRow['title'] ?? ''),
                ];
            }
            $stepsByProject[$projectId] = $map;
        }

        $unresolved = [];
        $insertedForNote = 0;
        $alreadyForNote = 0;

        if ($apply) {
            $pdo->beginTransaction();
        }

        try {
            foreach ($entries as $entry) {
                $stepNumber = (int)($entry['step_number'] ?? 0);
                $title = (string)($entry['title'] ?? '');
                $raw = (string)($entry['raw'] ?? '');
                $targetStep = $stepsByProject[$projectId][$stepNumber] ?? null;

                if (!$targetStep || (int)($targetStep['id'] ?? 0) <= 0) {
                    $unresolved[] = [
                        'raw' => $raw,
                        'reason' => 'step_not_found_by_step_order',
                    ];
                    $summary['entries_unresolved']++;
                    continue;
                }

                $targetStepId = (int)$targetStep['id'];
                $receiptNotes = 'Auto-migrated from step note #' . $noteId . ' [' . $raw . ']';

                $existing = bw_map_query_one(
                    $pdo,
                    'SELECT id FROM build_wizard_documents
                     WHERE project_id = ?
                       AND step_id = ?
                       AND kind = ?
                       AND COALESCE(receipt_title, \'\') = ?
                       AND COALESCE(receipt_notes, \'\') = ?
                     LIMIT 1',
                    [$projectId, $targetStepId, 'receipt', $title, $receiptNotes]
                );
                if ($existing) {
                    $alreadyForNote++;
                    $summary['receipts_already_present']++;
                    continue;
                }

                if ($apply) {
                    bw_map_exec(
                        $pdo,
                        'INSERT INTO build_wizard_documents
                            (project_id, step_id, receipt_parent_document_id, kind, original_name, mime_type, storage_path, file_size_bytes, caption, receipt_amount, receipt_title, receipt_vendor, receipt_date, receipt_notes)
                         VALUES (?, ?, NULL, ?, ?, ?, ?, 0, ?, NULL, ?, NULL, NULL, ?)',
                        [
                            $projectId,
                            $targetStepId,
                            'receipt',
                            mb_substr($title . ' Receipt', 0, 255),
                            'text/plain',
                            '',
                            $title,
                            $title,
                            $receiptNotes,
                        ]
                    );
                    $documentId = (int)$pdo->lastInsertId();

                    if ($hasDocBlobTable && $documentId > 0) {
                        $blob = bw_map_receipt_blob_text($title, $noteId);
                        bw_map_exec(
                            $pdo,
                            'INSERT INTO build_wizard_document_blobs (document_id, mime_type, file_blob, file_size_bytes)
                             VALUES (?, ?, ?, ?)
                             ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), file_blob = VALUES(file_blob), file_size_bytes = VALUES(file_size_bytes)',
                            [$documentId, 'text/plain', $blob, strlen($blob)]
                        );
                    }
                }

                $insertedForNote++;
                $summary['receipts_inserted']++;
            }

            $nextNoteText = bw_map_remove_mapping_line($noteText);
            $allResolved = count($unresolved) === 0;

            if ($apply && $allResolved) {
                if ($nextNoteText === '') {
                    bw_map_exec($pdo, 'DELETE FROM build_wizard_step_notes WHERE id = ?', [$noteId]);
                    $summary['notes_deleted']++;
                } else if ($nextNoteText !== trim($noteText)) {
                    bw_map_exec($pdo, 'UPDATE build_wizard_step_notes SET note_text = ? WHERE id = ?', [$nextNoteText, $noteId]);
                    $summary['notes_updated']++;
                }
            }

            if ($apply) {
                $pdo->commit();
            }

            $summary['details'][] = [
                'note_id' => $noteId,
                'project_id' => $projectId,
                'project_title' => (string)($noteRow['project_title'] ?? ''),
                'source_step_id' => (int)($noteRow['step_id'] ?? 0),
                'source_step_order' => (int)($noteRow['step_order'] ?? 0),
                'inserted' => $insertedForNote,
                'already_present' => $alreadyForNote,
                'unresolved' => $unresolved,
                'mapping_line_removed' => (count($unresolved) === 0),
            ];
        } catch (Throwable $e) {
            if ($apply && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            $summary['details'][] = [
                'note_id' => $noteId,
                'project_id' => $projectId,
                'error' => $e->getMessage(),
            ];
        }
    }

    echo json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
    return 0;
}

try {
    exit(bw_map_main($argv));
} catch (Throwable $e) {
    fwrite(STDERR, 'Error: ' . $e->getMessage() . "\n");
    exit(1);
}
