<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

function bw_recover_jobs_dir(): string
{
    return dirname(__DIR__) . '/.local/state/build_wizard_recovery_jobs';
}

function bw_recover_ensure_jobs_dir(): string
{
    $dir = bw_recover_jobs_dir();
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        throw new RuntimeException('Failed to prepare recovery jobs directory');
    }
    return $dir;
}

function bw_recover_safe_job_id(string $raw): string
{
    $id = strtolower(trim($raw));
    if (!preg_match('/^[a-f0-9]{16,40}$/', $id)) {
        return '';
    }
    return $id;
}

function bw_recover_job_paths(string $jobId): array
{
    $dir = bw_recover_jobs_dir();
    return [
        'dir' => $dir,
        'meta' => $dir . '/' . $jobId . '.meta.json',
        'stdout' => $dir . '/' . $jobId . '.stdout.json',
        'stderr' => $dir . '/' . $jobId . '.stderr.txt',
        'exit' => $dir . '/' . $jobId . '.exit.txt',
    ];
}

function bw_recover_read_status(string $jobId): array
{
    $paths = bw_recover_job_paths($jobId);
    $meta = null;
    if (is_file($paths['meta'])) {
        $metaText = @file_get_contents($paths['meta']);
        $metaDecoded = is_string($metaText) ? json_decode($metaText, true) : null;
        if (is_array($metaDecoded)) {
            $meta = $metaDecoded;
        }
    }

    $stdoutText = is_file($paths['stdout']) ? trim((string)@file_get_contents($paths['stdout'])) : '';
    $stderrText = is_file($paths['stderr']) ? trim((string)@file_get_contents($paths['stderr'])) : '';
    $exitText = is_file($paths['exit']) ? trim((string)@file_get_contents($paths['exit'])) : '';
    $hasExit = ($exitText !== '' && preg_match('/^-?\d+$/', $exitText));
    $exitCode = $hasExit ? (int)$exitText : null;

    $decoded = null;
    if ($stdoutText !== '') {
        $parsed = json_decode($stdoutText, true);
        if (is_array($parsed)) {
            $decoded = $parsed;
        } else {
            $firstBrace = strpos($stdoutText, '{');
            $lastBrace = strrpos($stdoutText, '}');
            if ($firstBrace !== false && $lastBrace !== false && $lastBrace > $firstBrace) {
                $jsonSlice = substr($stdoutText, $firstBrace, $lastBrace - $firstBrace + 1);
                $parsedSlice = json_decode($jsonSlice, true);
                if (is_array($parsedSlice)) {
                    $decoded = $parsedSlice;
                }
            }
        }
    }

    if (!$hasExit) {
        return [
            'success' => true,
            'completed' => 0,
            'status' => 'running',
            'job_id' => $jobId,
            'meta' => $meta,
        ];
    }

    if ($exitCode !== 0) {
        return [
            'success' => false,
            'completed' => 1,
            'status' => 'failed',
            'job_id' => $jobId,
            'exit_code' => $exitCode,
            'stderr' => $stderrText,
            'result' => $decoded ?? $stdoutText,
            'meta' => $meta,
            'error' => 'Recovery script failed',
        ];
    }

    $nestedJobId = '';
    if (is_array($decoded)) {
        $candidate = trim((string)($decoded['job_id'] ?? ''));
        $nestedJobId = bw_recover_safe_job_id($candidate);
    }
    if (
        $nestedJobId !== ''
        && $nestedJobId !== $jobId
        && is_array($decoded)
        && (int)($decoded['queued'] ?? 0) === 1
        && (int)($decoded['completed'] ?? 0) === 0
    ) {
        $nested = bw_recover_read_status($nestedJobId);
        $nested['proxied_from_job_id'] = $jobId;
        return $nested;
    }

    return [
        'success' => true,
        'completed' => 1,
        'status' => 'completed',
        'job_id' => $jobId,
        'exit_code' => $exitCode,
        'result' => $decoded ?? $stdoutText,
        'stderr' => $stderrText,
        'meta' => $meta,
    ];
}

catn8_require_admin();

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($method === 'GET') {
    $jobId = bw_recover_safe_job_id((string)($_GET['job_id'] ?? ''));
    if ($jobId === '') {
        catn8_json_response(['success' => false, 'error' => 'Missing or invalid job_id'], 400);
    }
    $paths = bw_recover_job_paths($jobId);
    if (!is_file($paths['meta']) && !is_file($paths['exit']) && !is_file($paths['stdout']) && !is_file($paths['stderr'])) {
        catn8_json_response([
            'success' => false,
            'completed' => 0,
            'status' => 'unknown',
            'job_id' => $jobId,
            'error' => 'Job not found',
        ], 404);
    }
    catn8_json_response(bw_recover_read_status($jobId));
}

catn8_require_method('POST');
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

try {
    $jobsDir = bw_recover_ensure_jobs_dir();
} catch (Throwable $e) {
    catn8_json_response(['success' => false, 'error' => $e->getMessage()], 500);
}

$jobId = bin2hex(random_bytes(12));
$paths = bw_recover_job_paths($jobId);

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

$meta = [
    'job_id' => $jobId,
    'started_at' => gmdate('c'),
    'apply' => $apply ? 1 : 0,
    'db_env' => $dbEnv,
    'project_title' => $projectTitle,
    'source_root' => $sourceRoot,
    'owner_user_id' => $ownerUserId > 0 ? $ownerUserId : null,
    'include_archives' => $includeArchives ? 1 : 0,
    'command' => $command,
];
@file_put_contents($paths['meta'], json_encode($meta, JSON_UNESCAPED_SLASHES));

$jobScript = 'cd ' . escapeshellarg(dirname(__DIR__))
    . ' && ' . $command
    . ' > ' . escapeshellarg($paths['stdout'])
    . ' 2> ' . escapeshellarg($paths['stderr'])
    . '; echo $? > ' . escapeshellarg($paths['exit']);

$launch = 'nohup sh -lc ' . escapeshellarg($jobScript) . ' >/dev/null 2>&1 &';
@exec($launch);

catn8_json_response([
    'success' => true,
    'queued' => 1,
    'completed' => 0,
    'status' => 'queued',
    'job_id' => $jobId,
    'meta' => $meta,
    'jobs_dir' => $jobsDir,
]);
