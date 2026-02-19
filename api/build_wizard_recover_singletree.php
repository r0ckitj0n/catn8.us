<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

catn8_require_method('POST');
catn8_require_admin();

$body = catn8_read_json_body();

$apply = ((int)($body['apply'] ?? 0) === 1);
$dbEnv = strtolower(trim((string)($body['db_env'] ?? 'live')));
if (!in_array($dbEnv, ['live', 'local'], true)) {
    $dbEnv = 'live';
}

$projectTitle = trim((string)($body['project_title'] ?? 'Cabin - 91 Singletree Ln'));
if ($projectTitle === '' || strlen($projectTitle) > 191) {
    catn8_json_response(['success' => false, 'error' => 'Invalid project_title'], 400);
}

$sourceRoot = trim((string)($body['source_root'] ?? '/Users/jongraves/Documents/Home/91 Singletree Ln'));
if ($sourceRoot === '' || strlen($sourceRoot) > 500) {
    catn8_json_response(['success' => false, 'error' => 'Invalid source_root'], 400);
}

$ownerUserId = isset($body['owner_user_id']) && is_numeric($body['owner_user_id'])
    ? (int)$body['owner_user_id']
    : 0;
if ($ownerUserId < 0) {
    $ownerUserId = 0;
}

$includeArchives = ((int)($body['include_archives'] ?? 0) === 1);

$scriptPath = dirname(__DIR__) . '/scripts/maintenance/recover_build_wizard_singletree_documents.php';
if (!is_file($scriptPath)) {
    catn8_json_response(['success' => false, 'error' => 'Recovery script not found'], 500);
}

$cmdParts = [
    'php',
    escapeshellarg($scriptPath),
    '--db-env=' . escapeshellarg($dbEnv),
    '--project-title=' . escapeshellarg($projectTitle),
    '--source-root=' . escapeshellarg($sourceRoot),
];

if ($apply) {
    $cmdParts[] = '--apply';
}
if ($ownerUserId > 0) {
    $cmdParts[] = '--owner-user-id=' . (string)$ownerUserId;
}
if ($includeArchives) {
    $cmdParts[] = '--include-archives';
}

$command = implode(' ', $cmdParts);

$descriptorSpec = [
    0 => ['pipe', 'r'],
    1 => ['pipe', 'w'],
    2 => ['pipe', 'w'],
];

$process = @proc_open($command, $descriptorSpec, $pipes, dirname(__DIR__));
if (!is_resource($process)) {
    catn8_json_response(['success' => false, 'error' => 'Failed to start recovery process'], 500);
}

fclose($pipes[0]);
$stdout = stream_get_contents($pipes[1]);
fclose($pipes[1]);
$stderr = stream_get_contents($pipes[2]);
fclose($pipes[2]);
$exitCode = proc_close($process);

$stdoutText = is_string($stdout) ? trim($stdout) : '';
$stderrText = is_string($stderr) ? trim($stderr) : '';

$decoded = null;
if ($stdoutText !== '') {
    $parsed = json_decode($stdoutText, true);
    if (is_array($parsed)) {
        $decoded = $parsed;
    }
}

if ($exitCode !== 0) {
    catn8_json_response([
        'success' => false,
        'error' => 'Recovery script failed',
        'exit_code' => $exitCode,
        'stderr' => $stderrText,
        'stdout' => $decoded ?? $stdoutText,
        'command' => $command,
    ], 500);
}

catn8_json_response([
    'success' => true,
    'exit_code' => $exitCode,
    'result' => $decoded ?? $stdoutText,
    'stderr' => $stderrText,
    'command' => $command,
]);

