<?php

declare(strict_types=1);

require_once __DIR__ . '/api/bootstrap.php';
require_once __DIR__ . '/includes/celebr8_model.php';

$uid = catn8_auth_user_id();
$requestPath = (string)(parse_url((string)($_SERVER['REQUEST_URI'] ?? '/celebr8'), PHP_URL_PATH) ?: '/celebr8');
if ($uid === null) {
    $redirect = str_starts_with($requestPath, '/celebr8') ? $requestPath : '/celebr8';
    header('Location: ' . catn8_login_redirect_url($redirect));
    exit;
}

Celebr8Model::ensureSchema();

header('Content-Type: text/html; charset=UTF-8');
readfile(__DIR__ . '/index.html');
