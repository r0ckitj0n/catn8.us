<?php

declare(strict_types=1);

require_once __DIR__ . '/api/bootstrap.php';
require_once __DIR__ . '/includes/celebr8_model.php';

$uid = catn8_auth_user_id();
$requestPath = catn8_logical_request_path();
if ($uid === null) {
    $redirect = str_starts_with($requestPath, '/celebr8')
        ? $requestPath
        : catn8_subsite_login_redirect_path('celebr8', '/');
    // When already on celebr8.catn8.us, keep deep paths relative to that host.
    if (catn8_request_subsite_slug() === 'celebr8' && str_starts_with($requestPath, '/celebr8')) {
        $rest = substr($requestPath, strlen('/celebr8'));
        $redirect = ($rest === '' || $rest === false) ? '/' : $rest;
    }
    header('Location: ' . catn8_login_redirect_url($redirect));
    exit;
}

Celebr8Model::ensureSchema();

header('Content-Type: text/html; charset=UTF-8');
readfile(__DIR__ . '/index.html');
