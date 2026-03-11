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

try {
    if ($uploadId > 0) {
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
