<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

catn8_require_method('POST');
catn8_require_admin();

function bw_stage_normalize_uploads(string $field): array
{
    if (!isset($_FILES[$field]) || !is_array($_FILES[$field])) {
        return [];
    }
    $raw = $_FILES[$field];
    $names = $raw['name'] ?? null;
    if (!is_array($names)) {
        return [$raw];
    }

    $tmpNames = $raw['tmp_name'] ?? [];
    $sizes = $raw['size'] ?? [];
    $types = $raw['type'] ?? [];
    $errors = $raw['error'] ?? [];

    $out = [];
    $count = count($names);
    for ($i = 0; $i < $count; $i++) {
        $out[] = [
            'name' => (string)($names[$i] ?? ''),
            'tmp_name' => (string)($tmpNames[$i] ?? ''),
            'size' => (int)($sizes[$i] ?? 0),
            'type' => (string)($types[$i] ?? ''),
            'error' => (int)($errors[$i] ?? UPLOAD_ERR_NO_FILE),
        ];
    }
    return $out;
}

function bw_stage_ini_bytes(string $value): int
{
    $raw = trim($value);
    if ($raw === '') {
        return 0;
    }
    $last = strtolower($raw[strlen($raw) - 1]);
    $num = (float)$raw;
    return match ($last) {
        'g' => (int)round($num * 1024 * 1024 * 1024),
        'm' => (int)round($num * 1024 * 1024),
        'k' => (int)round($num * 1024),
        default => (int)round($num),
    };
}

function bw_stage_token(string $raw): string
{
    $v = strtolower(trim($raw));
    if ($v !== '' && preg_match('/^[a-z0-9_-]{6,64}$/', $v)) {
        return $v;
    }
    return bin2hex(random_bytes(8));
}

function bw_stage_is_allowed_extension(string $name): bool
{
    $ext = strtolower((string)pathinfo($name, PATHINFO_EXTENSION));
    $allowed = [
        'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp',
        'xlsx', 'xlsm', 'xls', 'csv', 'numbers',
        'plan', 'dwg', 'doc', 'docx', 'txt',
        'skp', 'sh3d',
    ];
    return in_array($ext, $allowed, true);
}

function bw_stage_safe_basename(string $name): string
{
    $base = basename($name);
    $safe = preg_replace('/[^A-Za-z0-9._-]+/', '_', $base);
    if (!is_string($safe) || $safe === '') {
        $safe = 'upload.bin';
    }
    if (strlen($safe) > 180) {
        $safe = substr($safe, 0, 180);
    }
    return $safe;
}

$files = bw_stage_normalize_uploads('files');
if (!$files) {
    $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    $postMax = (string)ini_get('post_max_size');
    $uploadMax = (string)ini_get('upload_max_filesize');
    $postMaxBytes = bw_stage_ini_bytes($postMax);
    $likelyTooLarge = ($contentLength > 0 && $postMaxBytes > 0 && $contentLength > $postMaxBytes);
    $hint = $likelyTooLarge
        ? 'Upload payload exceeded server post_max_size. Try smaller batches.'
        : 'No files uploaded. Select files and retry.';
    catn8_json_response([
        'success' => false,
        'error' => $hint,
        'content_length' => $contentLength,
        'post_max_size' => $postMax,
        'upload_max_filesize' => $uploadMax,
    ], 400);
}

$token = bw_stage_token((string)($_POST['upload_token'] ?? ''));
$projectRoot = dirname(__DIR__);
$stageRoot = $projectRoot . '/.local/state/build_wizard_import/stage_docs/singletree_live_import';
$targetDir = $stageRoot . '/' . $token;

if (!is_dir($targetDir) && !mkdir($targetDir, 0755, true) && !is_dir($targetDir)) {
    catn8_json_response(['success' => false, 'error' => 'Failed to create staging directory'], 500);
}

$saved = 0;
$skipped = 0;
$total = 0;
$savedFiles = [];

foreach ($files as $file) {
    $total++;
    $err = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($err !== UPLOAD_ERR_OK) {
        $skipped++;
        continue;
    }
    $tmp = (string)($file['tmp_name'] ?? '');
    $name = (string)($file['name'] ?? '');
    $size = (int)($file['size'] ?? 0);
    if ($tmp === '' || !is_uploaded_file($tmp) || $name === '' || $size <= 0) {
        $skipped++;
        continue;
    }
    if ($size > 50 * 1024 * 1024) {
        $skipped++;
        continue;
    }
    if (!bw_stage_is_allowed_extension($name)) {
        $skipped++;
        continue;
    }

    $safeName = bw_stage_safe_basename($name);
    $dest = $targetDir . '/' . $safeName;
    if (is_file($dest)) {
        $ext = (string)pathinfo($safeName, PATHINFO_EXTENSION);
        $stem = (string)pathinfo($safeName, PATHINFO_FILENAME);
        $dest = $targetDir . '/' . $stem . '_' . bin2hex(random_bytes(3)) . ($ext !== '' ? '.' . $ext : '');
    }

    if (!move_uploaded_file($tmp, $dest)) {
        $skipped++;
        continue;
    }
    $saved++;
    if (count($savedFiles) < 50) {
        $savedFiles[] = basename($dest);
    }
}

catn8_json_response([
    'success' => true,
    'upload_token' => $token,
    'staged_root' => $targetDir,
    'files_total' => $total,
    'files_saved' => $saved,
    'files_skipped' => $skipped,
    'saved_files' => $savedFiles,
]);
