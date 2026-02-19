<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/diagnostics_log.php';

$fail = static function (string $eventKey, int $status, string $error, array $meta = []): void {
    catn8_diagnostics_log_event($eventKey, false, $status, $error, $meta);
    catn8_json_response(['success' => false, 'error' => $error], $status);
};

$expected = (string)catn8_env('CATN8_ADMIN_TOKEN', '');
$got = (string)($_GET['admin_token'] ?? '');
if ($expected === '' || $got === '' || !hash_equals($expected, $got)) {
    $fail('backup_website', 403, 'Invalid admin token');
}

@set_time_limit(0);

$rootDir = dirname(__DIR__);
$backupDir = $rootDir . '/backups/website';
@mkdir($backupDir, 0777, true);

$ts = date('Y-m-d_H-i-s');
$outPath = $backupDir . '/site_' . $ts . '.zip';

if (!class_exists('ZipArchive')) {
    $fail('backup_website', 500, 'ZipArchive not available on this server');
}

$zip = new ZipArchive();
$ok = $zip->open($outPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);
if ($ok !== true) {
    $fail('backup_website', 500, 'Failed to create zip archive');
}

$excludes = [
    '.git',
    'node_modules',
    'backups',
    'logs',
    'config/secret.key',
];

$excludeExactFiles = [
    '.env',
    '.env.local',
    '.env.live',
];

$shouldExcludeRel = static function (string $rel) use ($excludes, $excludeExactFiles): bool {
    $rel = ltrim(str_replace('\\', '/', $rel), '/');
    if ($rel === '') return true;

    foreach ($excludeExactFiles as $f) {
        if ($rel === $f) return true;
    }

    if (str_starts_with($rel, '.env.')) return true;

    foreach ($excludes as $p) {
        $p = trim($p);
        if ($p === '') continue;
        if ($rel === $p) return true;
        if (str_starts_with($rel, rtrim($p, '/') . '/')) return true;
    }

    return false;
};

$it = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($rootDir, FilesystemIterator::SKIP_DOTS),
    RecursiveIteratorIterator::SELF_FIRST
);

$fileCount = 0;
foreach ($it as $path => $info) {
    $full = (string)$path;
    if (!is_file($full)) continue;

    $rel = ltrim(str_replace('\\', '/', substr($full, strlen($rootDir))), '/');
    if ($shouldExcludeRel($rel)) continue;

    if (!$zip->addFile($full, $rel)) {
        continue;
    }
    $fileCount++;
}

$zip->close();

catn8_diagnostics_log_event('backup_website', true, 200, 'Website backup created', [
    'path' => $outPath,
    'files' => $fileCount,
]);

catn8_json_response([
    'success' => true,
    'message' => 'Backup created',
    'backup_path' => basename($outPath),
    'files' => $fileCount,
]);
