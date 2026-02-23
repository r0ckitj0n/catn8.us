<?php

declare(strict_types=1);
error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);

function usage(): void
{
    echo "Usage:\n";
    echo "  php scripts/maintenance/import_build_wizard_docs_via_admin_api.php [--apply]\n";
    echo "    [--project-title=\"Cabin - 91 Singletree Ln\"]\n";
    echo "    [--list-file=\".local/state/doc_scan/construction_documents_index.tsv\"]\n";
    echo "    [--base-url=\"https://catn8.us\"]\n";
    echo "    [--categories=\"utility_power,permit_or_inspection,plans_and_blueprints,costs_and_receipts\"]\n";
    echo "    [--max-batch-bytes=12000000]\n";
    echo "    [--admin-token=\"...\" (or env CATN8_ADMIN_TOKEN)]\n";
    echo "\n";
    echo "Notes:\n";
    echo "  - Dry-run is default; use --apply to upload SQL batches to live maintenance endpoint.\n";
    echo "  - Stores document files in build_wizard_document_blobs for secured API access.\n";
}

function parse_args(array $argv): array
{
    $opts = [
        'apply' => false,
        'project_title' => 'Cabin - 91 Singletree Ln',
        'list_file' => '.local/state/doc_scan/construction_documents_index.tsv',
        'base_url' => 'https://catn8.us',
        'categories' => ['utility_power', 'permit_or_inspection', 'plans_and_blueprints', 'costs_and_receipts'],
        'max_batch_bytes' => 12_000_000,
        'admin_token' => (string)(getenv('CATN8_ADMIN_TOKEN') ?: ''),
    ];

    foreach ($argv as $arg) {
        if ($arg === '--help' || $arg === '-h') {
            usage();
            exit(0);
        }
        if ($arg === '--apply') {
            $opts['apply'] = true;
            continue;
        }
        if (str_starts_with($arg, '--project-title=')) {
            $opts['project_title'] = trim((string)substr($arg, 16));
            continue;
        }
        if (str_starts_with($arg, '--list-file=')) {
            $opts['list_file'] = trim((string)substr($arg, 12));
            continue;
        }
        if (str_starts_with($arg, '--base-url=')) {
            $opts['base_url'] = rtrim(trim((string)substr($arg, 11)), '/');
            continue;
        }
        if (str_starts_with($arg, '--categories=')) {
            $raw = trim((string)substr($arg, 13));
            $parts = array_values(array_filter(array_map(
                static fn(string $v): string => trim($v),
                explode(',', $raw)
            )));
            if ($parts) {
                $opts['categories'] = $parts;
            }
            continue;
        }
        if (str_starts_with($arg, '--max-batch-bytes=')) {
            $n = (int)trim((string)substr($arg, 18));
            if ($n > 0) {
                $opts['max_batch_bytes'] = $n;
            }
            continue;
        }
        if (str_starts_with($arg, '--admin-token=')) {
            $opts['admin_token'] = trim((string)substr($arg, 14));
            continue;
        }
    }

    return $opts;
}

function sql_quote(string $value): string
{
    return "'" . str_replace(
        ["\\", "\0", "\n", "\r", "'", '"', "\x1a"],
        ["\\\\", "\\0", "\\n", "\\r", "\\'", '\\"', "\\Z"],
        $value
    ) . "'";
}

function guess_kind(string $path): string
{
    $name = strtolower(basename($path));
    $dir = strtolower(dirname($path));
    $ext = strtolower((string)pathinfo($name, PATHINFO_EXTENSION));
    $ctx = $name . ' ' . $dir;

    if (str_contains($ctx, 'plat') || str_contains($ctx, 'survey')) return 'survey';
    if (str_contains($ctx, 'permit') || str_contains($ctx, 'septic') || str_contains($ctx, 'siteplan') || str_contains($ctx, 'setback')) return 'permit';
    if (str_contains($ctx, 'elevation') || str_contains($ctx, 'foundation') || str_contains($ctx, 'framing') || str_contains($ctx, 'dimension') || $ext === 'plan' || $ext === 'dwg' || str_contains($ctx, 'cabin-')) return 'blueprint';
    if (str_contains($ctx, 'receipt') || str_contains($ctx, 'invoice') || str_contains($ctx, 'expense') || str_contains($ctx, 'shopping') || str_contains($ctx, 'materials') || str_contains($ctx, 'coupon')) return 'receipt';
    if (str_contains($ctx, 'manual') || str_contains($ctx, 'catalog') || str_contains($ctx, 'submittal') || str_contains($ctx, 'engineering') || str_contains($ctx, 'load calculation') || in_array($ext, ['xlsx', 'xlsm', 'xls', 'csv', 'numbers'], true)) return 'spec_sheet';
    if (in_array($ext, ['png', 'jpg', 'jpeg', 'gif', 'webp'], true)) {
        if (str_contains($ctx, 'site') || str_contains($ctx, 'satellite') || str_contains($ctx, 'outside')) return 'site_photo';
        if (str_contains($ctx, 'progress')) return 'progress_photo';
        return 'home_photo';
    }
    return 'other';
}

function guess_phase_key(string $kind, string $path): string
{
    $ctx = strtolower($path);
    if ($kind === 'survey') return 'land_due_diligence';
    if ($kind === 'permit') return 'dawson_county_permits';
    if ($kind === 'blueprint' || $kind === 'spec_sheet') {
        if (str_contains($ctx, 'foundation')) return 'foundation';
        if (str_contains($ctx, 'framing') || str_contains($ctx, 'gable') || str_contains($ctx, 'dimension')) return 'framing_shell';
        if (str_contains($ctx, 'electric') || str_contains($ctx, 'breaker') || str_contains($ctx, 'hvac') || str_contains($ctx, 'septic')) return 'mep_rough_in';
        return 'design_preconstruction';
    }
    if ($kind === 'site_photo' || $kind === 'home_photo' || $kind === 'progress_photo') return 'site_preparation';
    if ($kind === 'receipt') return 'interior_finishes';
    return 'general';
}

function detect_mime(string $path): string
{
    $mime = '';
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo) {
            $detected = finfo_file($finfo, $path);
            if (is_string($detected)) $mime = trim($detected);
        }
    }
    return $mime !== '' ? $mime : 'application/octet-stream';
}

function load_rows(string $listFile, array $categories): array
{
    if (!is_file($listFile)) {
        throw new RuntimeException('List file not found: ' . $listFile);
    }
    $lines = file($listFile, FILE_IGNORE_NEW_LINES);
    if (!is_array($lines)) {
        throw new RuntimeException('Failed to read list file');
    }

    $wanted = array_fill_keys($categories, true);
    $rows = [];
    foreach ($lines as $idx => $lineRaw) {
        $line = trim((string)$lineRaw);
        if ($line === '') continue;
        if ($idx === 0 && str_contains(strtolower($line), 'path')) continue;
        $parts = explode("\t", $line);
        $path = trim((string)($parts[0] ?? ''));
        $category = trim((string)($parts[4] ?? ''));
        if ($path === '' || !is_file($path)) continue;
        if (!isset($wanted[$category])) continue;
        $rows[] = [
            'path' => $path,
            'category' => $category,
            'size' => (int)($parts[2] ?? filesize($path) ?: 0),
        ];
    }
    $uniq = [];
    $out = [];
    foreach ($rows as $row) {
        $key = $row['path'];
        if (isset($uniq[$key])) continue;
        $uniq[$key] = true;
        $out[] = $row;
    }
    return $out;
}

function doc_block_sql(string $projectTitle, string $path): string
{
    $name = basename($path);
    $kind = guess_kind($path);
    $phase = guess_phase_key($kind, $path);
    $mime = detect_mime($path);
    $bytes = file_get_contents($path);
    if (!is_string($bytes) || $bytes === '') {
        return '';
    }
    $size = strlen($bytes);
    $hex = bin2hex($bytes);
    $storagePath = 'images/build-wizard/imported/' . preg_replace('/[^A-Za-z0-9._-]+/', '_', $name);
    if (!is_string($storagePath) || $storagePath === '') {
        $storagePath = 'images/build-wizard/imported/document.bin';
    }

    $stepIdSql = $phase === 'general'
        ? 'SELECT id FROM build_wizard_steps WHERE project_id = @bw_project_id ORDER BY is_completed ASC, step_order ASC, id ASC LIMIT 1'
        : 'SELECT id FROM build_wizard_steps WHERE project_id = @bw_project_id AND BINARY phase_key = BINARY ' . sql_quote($phase) . ' ORDER BY is_completed ASC, step_order ASC, id ASC LIMIT 1';

    return implode("\n", [
        '-- source: ' . str_replace("\n", ' ', $path),
        'SET @bw_doc_name := ' . sql_quote($name) . ';',
        'SET @bw_doc_kind := ' . sql_quote($kind) . ';',
        'SET @bw_doc_mime := ' . sql_quote($mime) . ';',
        'SET @bw_doc_storage := ' . sql_quote($storagePath) . ';',
        'SET @bw_doc_size := ' . $size . ';',
        'SET @bw_step_id := (' . $stepIdSql . ');',
        'SET @bw_doc_id := (SELECT id FROM build_wizard_documents WHERE project_id = @bw_project_id AND BINARY original_name = BINARY @bw_doc_name ORDER BY id ASC LIMIT 1);',
        'INSERT INTO build_wizard_documents (project_id, step_id, kind, original_name, mime_type, storage_path, file_size_bytes, caption)',
        'SELECT @bw_project_id, @bw_step_id, @bw_doc_kind, @bw_doc_name, @bw_doc_mime, @bw_doc_storage, @bw_doc_size, NULL',
        'WHERE @bw_project_id IS NOT NULL AND @bw_doc_id IS NULL;',
        'SET @bw_doc_id := COALESCE(@bw_doc_id, LAST_INSERT_ID());',
        'UPDATE build_wizard_documents',
        'SET kind = @bw_doc_kind,',
        '    step_id = COALESCE(@bw_step_id, step_id),',
        '    mime_type = @bw_doc_mime,',
        '    file_size_bytes = @bw_doc_size',
        'WHERE id = @bw_doc_id;',
        'INSERT INTO build_wizard_document_blobs (document_id, mime_type, file_blob, file_size_bytes)',
        'VALUES (@bw_doc_id, @bw_doc_mime, 0x' . $hex . ', @bw_doc_size)',
        'ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), file_blob = VALUES(file_blob), file_size_bytes = VALUES(file_size_bytes);',
        '',
    ]);
}

function batch_header_sql(string $projectTitle): string
{
    return implode("\n", [
        'SET NAMES utf8mb4;',
        'SET @bw_project_title := ' . sql_quote($projectTitle) . ';',
        'SET @bw_project_id := (SELECT id FROM build_wizard_projects WHERE BINARY title = BINARY @bw_project_title ORDER BY id DESC LIMIT 1);',
        'CREATE TABLE IF NOT EXISTS build_wizard_document_blobs (',
        '  id INT AUTO_INCREMENT PRIMARY KEY,',
        '  document_id INT NOT NULL,',
        "  mime_type VARCHAR(120) NOT NULL DEFAULT 'application/octet-stream',",
        '  file_blob LONGBLOB NOT NULL,',
        '  file_size_bytes INT NOT NULL DEFAULT 0,',
        '  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,',
        '  UNIQUE KEY uniq_document_id (document_id),',
        '  CONSTRAINT fk_build_wizard_document_blobs_document FOREIGN KEY (document_id) REFERENCES build_wizard_documents(id) ON DELETE CASCADE',
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
        '',
    ]);
}

function batch_footer_sql(): string
{
    return implode("\n", [
        'UPDATE build_wizard_projects p',
        'SET p.blueprint_document_id = (',
        '  SELECT d.id FROM build_wizard_documents d',
        "  WHERE d.project_id = p.id AND d.kind = 'blueprint'",
        "  ORDER BY CASE WHEN LOWER(d.original_name) LIKE '%main%' THEN 0 ELSE 1 END,",
        "           CASE WHEN LOWER(d.original_name) LIKE '%cabin%' THEN 0 ELSE 1 END,",
        '           d.id ASC',
        '  LIMIT 1',
        ')',
        'WHERE p.id = @bw_project_id;',
        '',
    ]);
}

function post_batch(string $baseUrl, string $adminToken, string $filePath): array
{
    if (!extension_loaded('curl')) {
        throw new RuntimeException('PHP curl extension is required');
    }
    $url = rtrim($baseUrl, '/') . '/api/database_maintenance.php?action=restore_database&admin_token=' . rawurlencode($adminToken);
    $ch = curl_init();
    if ($ch === false) {
        throw new RuntimeException('Failed to init curl');
    }
    $post = ['backup_file' => new CURLFile($filePath, 'application/gzip', basename($filePath))];
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $post,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 20,
        CURLOPT_TIMEOUT => 0,
    ]);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if (!is_string($raw)) $raw = '';
    return ['http_code' => $code, 'error' => $err, 'raw' => $raw];
}

$args = $argv;
array_shift($args);
$opt = parse_args($args);

$projectTitle = trim((string)$opt['project_title']);
$listFile = trim((string)$opt['list_file']);
$baseUrl = trim((string)$opt['base_url']);
$maxBatchBytes = (int)$opt['max_batch_bytes'];
$categories = is_array($opt['categories']) ? $opt['categories'] : [];
$apply = (bool)$opt['apply'];
$adminToken = trim((string)$opt['admin_token']);

if ($projectTitle === '' || $listFile === '' || $baseUrl === '' || !$categories || $maxBatchBytes <= 0) {
    usage();
    exit(2);
}
if ($apply && $adminToken === '') {
    fwrite(STDERR, "Missing admin token (set CATN8_ADMIN_TOKEN or pass --admin-token)\n");
    exit(2);
}

$rows = load_rows($listFile, $categories);
$totalBytes = array_sum(array_map(static fn(array $r): int => (int)$r['size'], $rows));

$outDir = dirname(__DIR__, 2) . '/.local/state/doc_scan/live_import_batches_' . gmdate('Ymd_His');
if (!is_dir($outDir) && !mkdir($outDir, 0755, true) && !is_dir($outDir)) {
    throw new RuntimeException('Failed to create output dir: ' . $outDir);
}

$batches = [];
$current = [];
$currentBytes = 0;
foreach ($rows as $row) {
    $size = (int)$row['size'];
    if ($current && ($currentBytes + $size) > $maxBatchBytes) {
        $batches[] = $current;
        $current = [];
        $currentBytes = 0;
    }
    $current[] = $row;
    $currentBytes += $size;
}
if ($current) {
    $batches[] = $current;
}

$results = [];
foreach ($batches as $i => $batchRows) {
    $sql = batch_header_sql($projectTitle);
    $batchRawBytes = 0;
    $docCount = 0;
    foreach ($batchRows as $row) {
        $block = doc_block_sql($projectTitle, (string)$row['path']);
        if ($block === '') {
            continue;
        }
        $sql .= $block;
        $batchRawBytes += (int)$row['size'];
        $docCount++;
    }
    $sql .= batch_footer_sql();
    $sqlPath = $outDir . '/batch_' . str_pad((string)($i + 1), 3, '0', STR_PAD_LEFT) . '.sql.gz';
    $gz = gzencode($sql, 6);
    if (!is_string($gz) || $gz === '') {
        throw new RuntimeException('Failed to gzip SQL batch');
    }
    file_put_contents($sqlPath, $gz);

    $entry = [
        'batch' => $i + 1,
        'docs' => $docCount,
        'raw_bytes' => $batchRawBytes,
        'sql_gz_path' => $sqlPath,
    ];

    if ($apply) {
        $resp = post_batch($baseUrl, $adminToken, $sqlPath);
        $entry['http_code'] = (int)$resp['http_code'];
        $entry['error'] = (string)$resp['error'];
        $entry['response_raw'] = (string)$resp['raw'];
        $decoded = json_decode((string)$resp['raw'], true);
        if (is_array($decoded)) {
            $entry['response_json'] = $decoded;
        }
        if ((int)$resp['http_code'] < 200 || (int)$resp['http_code'] >= 300) {
            $results[] = $entry;
            break;
        }
    }

    $results[] = $entry;
}

$report = [
    'success' => true,
    'apply' => $apply ? 1 : 0,
    'project_title' => $projectTitle,
    'base_url' => $baseUrl,
    'list_file' => $listFile,
    'categories' => $categories,
    'docs_selected' => count($rows),
    'total_source_bytes' => $totalBytes,
    'batch_count' => count($batches),
    'max_batch_bytes' => $maxBatchBytes,
    'output_dir' => $outDir,
    'batches' => $results,
];

echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
