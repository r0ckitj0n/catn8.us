<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$expected = (string)catn8_env('CATN8_ADMIN_TOKEN', '');
$got = (string)($_GET['admin_token'] ?? '');
if ($expected === '' || $got === '' || !hash_equals($expected, $got)) {
    catn8_json_response(['success' => false, 'error' => 'Invalid admin token'], 403);
}

define('CATN8_ACCUMUL8_LIBRARY_ONLY', true);
require_once __DIR__ . '/accumul8.php';

$uploadId = isset($_GET['upload_id']) ? (int)$_GET['upload_id'] : 0;
$forceOcr = isset($_GET['force_ocr']) && (int)$_GET['force_ocr'] === 1;
$action = trim((string)($_GET['action'] ?? 'diagnostics'));

try {
    if ($action === 'rescan') {
        if ($uploadId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'upload_id is required'], 400);
        }
        $row = Database::queryOne(
            'SELECT id, owner_user_id
             FROM accumul8_statement_uploads
             WHERE id = ?
             LIMIT 1',
            [$uploadId]
        );
        if (!$row) {
            catn8_json_response(['success' => false, 'error' => 'Statement upload not found'], 404);
        }
        $viewerId = (int)($row['owner_user_id'] ?? 0);
        if ($viewerId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'Statement owner is invalid'], 400);
        }
        $result = accumul8_statement_scan_upload($viewerId, $uploadId, null, true);
    } elseif ($action === 'parse_probe') {
        if ($uploadId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'upload_id is required'], 400);
        }
        $upload = Database::queryOne(
            'SELECT *
             FROM accumul8_statement_uploads
             WHERE id = ?
             LIMIT 1',
            [$uploadId]
        );
        if (!$upload) {
            catn8_json_response(['success' => false, 'error' => 'Statement upload not found'], 404);
        }
        $viewerId = (int)($upload['owner_user_id'] ?? 0);
        if ($viewerId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'Statement owner is invalid'], 400);
        }
        $tmpPath = tempnam(sys_get_temp_dir(), 'accumul8_probe_');
        if (!is_string($tmpPath) || $tmpPath === '') {
            catn8_json_response(['success' => false, 'error' => 'Could not create temporary file'], 500);
        }
        file_put_contents($tmpPath, (string)($upload['file_blob'] ?? ''));
        try {
            $extract = accumul8_statement_extract_text_from_file($tmpPath, (string)($upload['mime_type'] ?? 'application/pdf'));
            $text = accumul8_statement_structured_text_from_bytes((string)($extract['text'] ?? ''), 120000);
            $pageCatalog = is_array($extract['page_catalog'] ?? null) ? $extract['page_catalog'] : [];
            if ($text === '') {
                catn8_json_response(['success' => false, 'error' => 'OCR produced no text', 'stage' => 'ocr'], 500);
            }
            $accountCatalog = accumul8_statement_account_catalog($viewerId);
            $ai = accumul8_statement_parse_from_ocr_text($text, (string)($upload['original_filename'] ?? ''), $accountCatalog, $pageCatalog, true);
            $parsed = is_array($ai['json'] ?? null) ? accumul8_statement_normalize_parsed_payload($ai['json']) : [];
            $result = [
                'stage' => 'parse_complete',
                'extract_method' => (string)($extract['method'] ?? ''),
                'text_length' => strlen($text),
                'page_catalog_count' => count($pageCatalog),
                'provider' => (string)($ai['provider'] ?? ''),
                'model' => (string)($ai['model'] ?? ''),
                'profile' => (string)($ai['profile']['slug'] ?? ''),
                'analysis' => $ai['analysis'] ?? null,
                'notes' => $ai['notes'] ?? [],
                'transaction_count' => count(accumul8_statement_transaction_rows($parsed)),
                'account_section_count' => count((array)($parsed['account_sections'] ?? [])),
                'account_name_hint' => (string)($parsed['account_name_hint'] ?? ''),
                'account_last4' => (string)($parsed['account_last4'] ?? ''),
                'text_excerpt' => accumul8_statement_structured_text_excerpt($text, 1200),
            ];
        } finally {
            @unlink($tmpPath);
        }
    } elseif ($uploadId > 0) {
        $row = Database::queryOne(
            'SELECT id, owner_user_id
             FROM accumul8_statement_uploads
             WHERE id = ?
             LIMIT 1',
            [$uploadId]
        );
        if (!$row) {
            catn8_json_response(['success' => false, 'error' => 'Statement upload not found'], 404);
        }
        $viewerId = (int)($row['owner_user_id'] ?? 0);
        if ($viewerId <= 0) {
            catn8_json_response(['success' => false, 'error' => 'Statement owner is invalid'], 400);
        }
        $result = accumul8_statement_ocr_diagnostics($viewerId, $uploadId, $forceOcr);
    } else {
        $result = accumul8_statement_ocr_diagnostics(0, null, $forceOcr);
    }

    catn8_json_response([
        'success' => true,
        'result' => $result,
    ]);
} catch (Throwable $e) {
    catn8_json_response([
        'success' => false,
        'error' => $e->getMessage(),
    ], 500);
}
