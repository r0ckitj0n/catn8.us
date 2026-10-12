<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/config.php';
require_once dirname(__DIR__, 2) . '/includes/build_wizard_cabin_relink.php';

function usage(): void
{
    echo "Usage:\n";
    echo "  php scripts/maintenance/repair_papas_cabin_references.php [--db-env=live|local] [--project-id=ID] [--owner-user-id=ID] [--dry-run]\n";
}

$opts = [
    'db_env' => 'live',
    'project_id' => 0,
    'owner_user_id' => 0,
    'dry_run' => false,
];

foreach (array_slice($argv, 1) as $arg) {
    if ($arg === '--help' || $arg === '-h') {
        usage();
        exit(0);
    }
    if ($arg === '--dry-run') {
        $opts['dry_run'] = true;
        continue;
    }
    if (str_starts_with($arg, '--db-env=')) {
        $v = strtolower(trim((string)substr($arg, 9)));
        if (in_array($v, ['live', 'local'], true)) {
            $opts['db_env'] = $v;
        }
        continue;
    }
    if (str_starts_with($arg, '--project-id=')) {
        $opts['project_id'] = (int)substr($arg, 13);
        continue;
    }
    if (str_starts_with($arg, '--owner-user-id=')) {
        $opts['owner_user_id'] = (int)substr($arg, 16);
    }
}

$cfg = catn8_get_db_config((string)$opts['db_env']);
$pdo = Database::createConnection(
    (string)($cfg['host'] ?? ''),
    (string)($cfg['db'] ?? ''),
    (string)($cfg['user'] ?? ''),
    (string)($cfg['pass'] ?? ''),
    (int)($cfg['port'] ?? 3306),
    (string)($cfg['socket'] ?? '')
);

$ownerId = (int)$opts['owner_user_id'];
if ($ownerId <= 0) {
    $row = $pdo->query(
        "SELECT owner_user_id FROM build_wizard_projects
         WHERE title LIKE '%Papa%' OR title LIKE '%Cabin%' OR title LIKE '%Singletree%' OR lot_address LIKE '%Singletree%'
         ORDER BY updated_at DESC, id DESC LIMIT 1"
    )->fetch(PDO::FETCH_ASSOC);
    $ownerId = (int)($row['owner_user_id'] ?? 0);
}
if ($ownerId <= 0) {
    fwrite(STDERR, "Could not resolve cabin project owner.\n");
    exit(1);
}

// Use the live Database singleton only when env matches; otherwise run SQL through $pdo
// by temporarily scoring with the same helper after swapping the singleton is not possible.
// So this CLI talks through Database when --db-env matches current, else prints the intended target.

$chosen = null;
$requestedId = (int)$opts['project_id'] > 0 ? (int)$opts['project_id'] : null;

$scoreSql = 'SELECT p.*,
        (SELECT COUNT(*) FROM build_wizard_documents d WHERE d.project_id = p.id) AS document_count,
        (SELECT COUNT(*) FROM build_wizard_steps s WHERE s.project_id = p.id) AS step_count
     FROM build_wizard_projects p
     WHERE p.owner_user_id = ?
     ORDER BY p.id ASC';
$stmt = $pdo->prepare($scoreSql);
$stmt->execute([$ownerId]);
$projects = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

echo json_encode([
    'db_env' => $opts['db_env'],
    'owner_user_id' => $ownerId,
    'requested_project_id' => $requestedId,
    'dry_run' => $opts['dry_run'] ? 1 : 0,
    'projects' => array_map(static function (array $p): array {
        return [
            'id' => (int)$p['id'],
            'title' => (string)$p['title'],
            'lot_address' => (string)($p['lot_address'] ?? ''),
            'document_count' => (int)($p['document_count'] ?? 0),
            'step_count' => (int)($p['step_count'] ?? 0),
            'cabin_like' => (int)(preg_match('/papa|cabin|singletree/i', (string)$p['title'] . ' ' . (string)($p['lot_address'] ?? '')) > 0),
        ];
    }, $projects),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";

if ($opts['dry_run']) {
    exit(0);
}

if ((string)$opts['db_env'] !== 'local' && !catn8_is_local_request()) {
    fwrite(STDERR, "Refusing to write live DB from this CLI unless Database current env is already live.\n");
    fwrite(STDERR, "Open FABRIC8 or POST /api/build_wizard.php?action=repair_cabin_references instead.\n");
    exit(2);
}

$canonical = catn8_build_wizard_choose_cabin_project($ownerId, $requestedId);
$canonicalId = (int)($canonical['id'] ?? $requestedId ?? 0);
if ($canonicalId <= 0) {
    fwrite(STDERR, "No cabin project to repair.\n");
    exit(1);
}

$repair = catn8_build_wizard_repair_cabin_references($ownerId, $canonicalId);
echo json_encode(['repair' => $repair], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
