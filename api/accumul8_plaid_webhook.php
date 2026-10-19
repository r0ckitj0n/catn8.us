<?php

declare(strict_types=1);

if (strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

define('CATN8_ACCUMUL8_LIBRARY_ONLY', true);
require_once __DIR__ . '/accumul8.php';

$rawBody = file_get_contents('php://input');
if (!is_string($rawBody)) {
    $rawBody = '';
}
$jwt = trim((string)($_SERVER['HTTP_PLAID_VERIFICATION'] ?? ''));
$result = accumul8_plaid_handle_webhook($jwt, $rawBody);
catn8_json_response(
    is_array($result['body'] ?? null) ? $result['body'] : ['success' => false, 'error' => 'Plaid webhook failed'],
    (int)($result['status'] ?? 500)
);
