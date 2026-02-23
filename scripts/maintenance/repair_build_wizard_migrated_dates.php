<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/config.php';

function usage(): void
{
    echo "Usage:\n";
    echo "  php scripts/maintenance/repair_build_wizard_migrated_dates.php [--source-project-id=ID | --source-title=TITLE] [--target-project-id=ID | --target-title=TITLE] [--owner-user-id=ID]\n";
}

function qAll(PDO $pdo, string $sql, array $params = []): array
{
    $st = $pdo->prepare($sql);
    $st->execute($params);
    return $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

function qOne(PDO $pdo, string $sql, array $params = []): ?array
{
    $st = $pdo->prepare($sql);
    $st->execute($params);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    return $row === false ? null : $row;
}

function execSql(PDO $pdo, string $sql, array $params = []): int
{
    $st = $pdo->prepare($sql);
    $st->execute($params);
    return $st->rowCount();
}

function table_exists(PDO $pdo, string $tableName): bool
{
    return qOne(
        $pdo,
        'SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1',
        [$tableName]
    ) !== null;
}

$args = $argv;
array_shift($args);

$sourceProjectId = 0;
$targetProjectId = 0;
$sourceTitle = 'Cabin - 91 Singletree Ln';
$targetTitle = 'Cabin - 91 Singletree Ln (Template Migrated v3)';
$ownerUserId = 0;

foreach ($args as $arg) {
    if ($arg === '--help' || $arg === '-h') {
        usage();
        exit(0);
    }
    if (str_starts_with($arg, '--source-project-id=')) {
        $sourceProjectId = (int)substr($arg, 20);
        continue;
    }
    if (str_starts_with($arg, '--target-project-id=')) {
        $targetProjectId = (int)substr($arg, 20);
        continue;
    }
    if (str_starts_with($arg, '--source-title=')) {
        $sourceTitle = trim((string)substr($arg, 15));
        continue;
    }
    if (str_starts_with($arg, '--target-title=')) {
        $targetTitle = trim((string)substr($arg, 15));
        continue;
    }
    if (str_starts_with($arg, '--owner-user-id=')) {
        $ownerUserId = (int)substr($arg, 16);
        continue;
    }
}

$cfg = catn8_get_db_config('local');
$pdo = Database::createConnection(
    (string)($cfg['host'] ?? ''),
    (string)($cfg['db'] ?? ''),
    (string)($cfg['user'] ?? ''),
    (string)($cfg['pass'] ?? ''),
    (int)($cfg['port'] ?? 3306),
    (string)($cfg['socket'] ?? '')
);

if ($sourceProjectId <= 0) {
    $sql = 'SELECT * FROM build_wizard_projects WHERE title = ?';
    $params = [$sourceTitle];
    if ($ownerUserId > 0) {
        $sql .= ' AND owner_user_id = ?';
        $params[] = $ownerUserId;
    }
    $sql .= ' ORDER BY id DESC LIMIT 1';
    $src = qOne($pdo, $sql, $params);
    if (!$src) {
        throw new RuntimeException('Source project not found.');
    }
    $sourceProjectId = (int)($src['id'] ?? 0);
}

if ($targetProjectId <= 0) {
    $sql = 'SELECT * FROM build_wizard_projects WHERE title = ?';
    $params = [$targetTitle];
    if ($ownerUserId > 0) {
        $sql .= ' AND owner_user_id = ?';
        $params[] = $ownerUserId;
    }
    $sql .= ' ORDER BY id DESC LIMIT 1';
    $dst = qOne($pdo, $sql, $params);
    if (!$dst) {
        throw new RuntimeException('Target project not found.');
    }
    $targetProjectId = (int)($dst['id'] ?? 0);
}

if ($sourceProjectId <= 0 || $targetProjectId <= 0) {
    throw new RuntimeException('Invalid source/target project ids.');
}
if ($sourceProjectId === $targetProjectId) {
    throw new RuntimeException('Source and target project ids must differ.');
}

$pdo->beginTransaction();
try {
    $changes = [
        'project_dates_updated' => 0,
        'steps_dates_exact_title_updated' => 0,
        'documents_receipt_date_updated' => 0,
        'phase_ranges_upserted' => 0,
    ];

    $changes['project_dates_updated'] = execSql(
        $pdo,
        'UPDATE build_wizard_projects t
         JOIN build_wizard_projects s ON s.id = ?
         SET
           t.target_start_date = COALESCE(t.target_start_date, s.target_start_date),
           t.target_completion_date = COALESCE(t.target_completion_date, s.target_completion_date)
         WHERE t.id = ?
           AND (
             (t.target_start_date IS NULL AND s.target_start_date IS NOT NULL)
             OR (t.target_completion_date IS NULL AND s.target_completion_date IS NOT NULL)
           )',
        [$sourceProjectId, $targetProjectId]
    );

    $changes['steps_dates_exact_title_updated'] = execSql(
        $pdo,
        'UPDATE build_wizard_steps t
         JOIN build_wizard_steps s
           ON s.project_id = ?
          AND BINARY TRIM(s.title) = BINARY TRIM(t.title)
         SET
           t.expected_start_date = COALESCE(t.expected_start_date, s.expected_start_date),
           t.expected_end_date = COALESCE(t.expected_end_date, s.expected_end_date)
         WHERE t.project_id = ?
           AND (
             (t.expected_start_date IS NULL AND s.expected_start_date IS NOT NULL)
             OR (t.expected_end_date IS NULL AND s.expected_end_date IS NOT NULL)
           )',
        [$sourceProjectId, $targetProjectId]
    );

    $hasReceiptDate = qOne(
        $pdo,
        'SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
        ['build_wizard_documents', 'receipt_date']
    ) !== null;

    if ($hasReceiptDate) {
        $changes['documents_receipt_date_updated'] = execSql(
            $pdo,
            'UPDATE build_wizard_documents t
             JOIN build_wizard_documents s
               ON s.project_id = ?
              AND BINARY TRIM(s.original_name) = BINARY TRIM(t.original_name)
              AND BINARY TRIM(COALESCE(s.kind, \'\')) = BINARY TRIM(COALESCE(t.kind, \'\'))
             SET t.receipt_date = COALESCE(t.receipt_date, s.receipt_date)
             WHERE t.project_id = ?
               AND t.receipt_date IS NULL
               AND s.receipt_date IS NOT NULL',
            [$sourceProjectId, $targetProjectId]
        );
    }

    if (table_exists($pdo, 'build_wizard_phase_date_ranges')) {
        $ranges = qAll(
            $pdo,
            'SELECT phase_tab, start_date, end_date FROM build_wizard_phase_date_ranges WHERE project_id = ?',
            [$sourceProjectId]
        );
        foreach ($ranges as $range) {
            $phaseTab = trim((string)($range['phase_tab'] ?? ''));
            if ($phaseTab === '') {
                continue;
            }
            execSql(
                $pdo,
                'INSERT INTO build_wizard_phase_date_ranges (project_id, phase_tab, start_date, end_date)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   start_date = COALESCE(build_wizard_phase_date_ranges.start_date, VALUES(start_date)),
                   end_date = COALESCE(build_wizard_phase_date_ranges.end_date, VALUES(end_date))',
                [
                    $targetProjectId,
                    $phaseTab,
                    $range['start_date'] ?? null,
                    $range['end_date'] ?? null,
                ]
            );
            $changes['phase_ranges_upserted']++;
        }
    }

    $pdo->commit();

    $summary = [
        'success' => true,
        'source_project_id' => $sourceProjectId,
        'target_project_id' => $targetProjectId,
        'changes' => $changes,
    ];
    echo json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, '[error] ' . $e->getMessage() . PHP_EOL);
    exit(1);
}

