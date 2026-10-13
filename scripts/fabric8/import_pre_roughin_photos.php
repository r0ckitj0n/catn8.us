<?php

declare(strict_types=1);

/**
 * Idempotent upload of labeled pre-rough-in photos into Fabric8 project photo section.
 *
 * Usage:
 *   php scripts/fabric8/import_pre_roughin_photos.php \
 *     --dir="/Users/jongraves/Documents/Home/91 Singletree Ln/Pre-Rough-In-Photos-Labeled-2026-10-13" \
 *     --project-id=14 \
 *     --base-url=https://catn8.us
 *
 * Auth: CATN8_ADMIN_TOKEN from env / .env.local (sent as X-Api-Key).
 */

$opts = getopt('', ['dir:', 'project-id:', 'base-url:', 'section-title:', 'dry-run']);
$dir = (string)($opts['dir'] ?? '');
$projectId = (int)($opts['project-id'] ?? 14);
$baseUrl = rtrim((string)($opts['base-url'] ?? 'https://catn8.us'), '/');
$sectionTitle = (string)($opts['section-title'] ?? 'Pre-rough-in (historical)');
$dryRun = array_key_exists('dry-run', $opts);

if ($dir === '' || !is_dir($dir)) {
    fwrite(STDERR, "Missing --dir path to labeled photos\n");
    exit(2);
}

$envLocal = dirname(__DIR__, 2) . '/.env.local';
if (is_file($envLocal)) {
    foreach (file($envLocal, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }
        [$k, $v] = explode('=', $line, 2);
        $k = trim($k);
        $v = trim($v, " \t\"'");
        if ($k !== '' && getenv($k) === false) {
            putenv("{$k}={$v}");
            $_ENV[$k] = $v;
        }
    }
}

$token = trim((string)(getenv('CATN8_ADMIN_TOKEN') ?: ''));
if ($token === '') {
    fwrite(STDERR, "CATN8_ADMIN_TOKEN not set\n");
    exit(2);
}

$manifestPath = rtrim($dir, '/') . '/manifest.csv';
if (!is_file($manifestPath)) {
    fwrite(STDERR, "manifest.csv not found in {$dir}\n");
    exit(2);
}

function fabric8_http_json(string $method, string $url, string $token, ?array $json = null): array
{
    $ch = curl_init($url);
    $headers = [
        'X-Api-Key: ' . $token,
        'Accept: application/json',
    ];
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 120,
    ];
    if ($json !== null) {
        $headers[] = 'Content-Type: application/json';
        $opts[CURLOPT_HTTPHEADER] = $headers;
        $opts[CURLOPT_POSTFIELDS] = json_encode($json, JSON_UNESCAPED_SLASHES);
    }
    curl_setopt_array($ch, $opts);
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    if (!is_string($body)) {
        throw new RuntimeException('HTTP failed: ' . $err);
    }
    $decoded = json_decode($body, true);
    if (!is_array($decoded)) {
        throw new RuntimeException("HTTP {$code} non-JSON: " . substr($body, 0, 200));
    }
    if ($code >= 400 || empty($decoded['success'])) {
        throw new RuntimeException("HTTP {$code}: " . (string)($decoded['error'] ?? $body));
    }
    return $decoded;
}

function fabric8_http_multipart(string $url, string $token, array $fields, string $filePath, string $fieldName = 'file'): array
{
    $ch = curl_init($url);
    $cfile = curl_file_create($filePath, mime_content_type($filePath) ?: 'application/octet-stream', basename($filePath));
    $post = $fields;
    $post[$fieldName] = $cfile;
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'X-Api-Key: ' . $token,
            'Accept: application/json',
        ],
        CURLOPT_POSTFIELDS => $post,
        CURLOPT_TIMEOUT => 180,
    ]);
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if (!is_string($body)) {
        throw new RuntimeException('Upload failed: ' . $err);
    }
    $decoded = json_decode($body, true);
    if (!is_array($decoded)) {
        throw new RuntimeException("Upload HTTP {$code} non-JSON: " . substr($body, 0, 200));
    }
    if ($code >= 400 || empty($decoded['success'])) {
        throw new RuntimeException("Upload HTTP {$code}: " . (string)($decoded['error'] ?? $body));
    }
    return $decoded;
}

$rows = [];
$fh = fopen($manifestPath, 'r');
if ($fh === false) {
    fwrite(STDERR, "Cannot read manifest\n");
    exit(2);
}
$header = fgetcsv($fh);
if (!is_array($header)) {
    fwrite(STDERR, "Empty manifest\n");
    exit(2);
}
$header = array_map(static fn($h) => strtolower(trim((string)$h)), $header);
while (($data = fgetcsv($fh)) !== false) {
    if (!is_array($data) || count(array_filter($data, static fn($v) => trim((string)$v) !== '')) === 0) {
        continue;
    }
    $row = [];
    foreach ($header as $i => $key) {
        $row[$key] = (string)($data[$i] ?? '');
    }
    $rows[] = $row;
}
fclose($fh);

fwrite(STDOUT, "Ensuring section on project {$projectId}: {$sectionTitle}\n");
if ($dryRun) {
    fwrite(STDOUT, "DRY RUN — would upload " . count($rows) . " photos + contact_sheet.pdf\n");
    exit(0);
}

$ensure = fabric8_http_json('POST', $baseUrl . '/api/fabric8_agent.php?action=ensure_photo_section', $token, [
    'project_id' => $projectId,
    'title' => $sectionTitle,
    'notes' => 'Labeled Compil8r import ' . date('Y-m-d') . ' from Pre-Rough-In-Photos-Labeled',
]);
$sectionId = (int)($ensure['section']['id'] ?? 0);
if ($sectionId <= 0) {
    fwrite(STDERR, "Failed to ensure section\n");
    exit(1);
}
fwrite(STDOUT, "section_id={$sectionId}\n");

$created = 0;
$deduped = 0;
$failed = 0;

foreach ($rows as $row) {
    $newName = trim((string)($row['new'] ?? ''));
    $room = trim((string)($row['room'] ?? ''));
    $wall = trim((string)($row['wall'] ?? ''));
    $confidence = trim((string)($row['confidence'] ?? ''));
    $notes = trim((string)($row['notes'] ?? ''));
    $orig = trim((string)($row['orig'] ?? ''));
    if ($newName === '') {
        continue;
    }
    $path = rtrim($dir, '/') . '/' . $newName;
    if (!is_file($path)) {
        fwrite(STDERR, "MISSING {$newName}\n");
        $failed++;
        continue;
    }
    $caption = $room !== '' || $wall !== ''
        ? trim($room . ($room !== '' && $wall !== '' ? ' – ' : '') . $wall)
        : $newName;
    $meta = [
        'orig' => $orig,
        'new' => $newName,
        'room' => $room,
        'wall' => $wall,
        'confidence' => $confidence,
        'notes' => $notes,
        'source' => 'Pre-Rough-In-Photos-Labeled-2026-10-13',
    ];
    try {
        $res = fabric8_http_multipart(
            $baseUrl . '/api/fabric8_agent.php?action=upload_section_photo',
            $token,
            [
                'project_id' => (string)$projectId,
                'section_id' => (string)$sectionId,
                'caption' => $caption,
                'kind' => 'progress_photo',
                'meta_json' => json_encode($meta, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ],
            $path
        );
        if (!empty($res['deduped'])) {
            $deduped++;
            fwrite(STDOUT, "DEDUPED {$newName}\n");
        } else {
            $created++;
            fwrite(STDOUT, "CREATED {$newName} -> doc " . (int)($res['document']['id'] ?? 0) . "\n");
        }
    } catch (Throwable $e) {
        $failed++;
        fwrite(STDERR, "FAIL {$newName}: " . $e->getMessage() . "\n");
    }
}

$pdf = rtrim($dir, '/') . '/contact_sheet.pdf';
if (is_file($pdf)) {
    try {
        $res = fabric8_http_multipart(
            $baseUrl . '/api/fabric8_agent.php?action=upload_section_photo',
            $token,
            [
                'project_id' => (string)$projectId,
                'section_id' => (string)$sectionId,
                'caption' => 'Pre-rough-in contact sheet',
                'kind' => 'document',
                'meta_json' => json_encode([
                    'type' => 'contact_sheet',
                    'source' => 'Pre-Rough-In-Photos-Labeled-2026-10-13',
                ], JSON_UNESCAPED_SLASHES),
            ],
            $pdf
        );
        if (!empty($res['deduped'])) {
            $deduped++;
            fwrite(STDOUT, "DEDUPED contact_sheet.pdf\n");
        } else {
            $created++;
            fwrite(STDOUT, "CREATED contact_sheet.pdf -> doc " . (int)($res['document']['id'] ?? 0) . "\n");
        }
    } catch (Throwable $e) {
        $failed++;
        fwrite(STDERR, "FAIL contact_sheet.pdf: " . $e->getMessage() . "\n");
    }
} else {
    fwrite(STDERR, "WARN contact_sheet.pdf missing\n");
}

$list = fabric8_http_json(
    'GET',
    $baseUrl . '/api/fabric8_agent.php?action=list_section_photos&project_id=' . $projectId . '&section_id=' . $sectionId,
    $token
);

fwrite(STDOUT, json_encode([
    'section_id' => $sectionId,
    'created' => $created,
    'deduped' => $deduped,
    'failed' => $failed,
    'section_count' => (int)($list['count'] ?? 0),
    'url' => $baseUrl . '/fabric8?project_id=' . $projectId,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");

exit($failed > 0 ? 1 : 0);
