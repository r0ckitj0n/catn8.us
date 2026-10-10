<?php

declare(strict_types=1);

require_once __DIR__ . '/api/bootstrap.php';
require_once __DIR__ . '/includes/tabul8_model.php';

$requestPath = (string)(parse_url((string)($_SERVER['REQUEST_URI'] ?? '/tabul8'), PHP_URL_PATH) ?: '/tabul8');
$isPhoneVotePath = (bool)preg_match('#^/tabul8/vote/#', $requestPath);

/**
 * Every Tabul8 page requires login except the optional phone/QR vote path.
 * Phone voting is gated in the API (phone_voting_open + short-lived signed token).
 */
if (!$isPhoneVotePath) {
    $uid = catn8_auth_user_id();
    if ($uid === null) {
        $redirect = str_starts_with($requestPath, '/tabul8') ? $requestPath : '/tabul8';
        header('Location: ' . catn8_login_redirect_url($redirect));
        exit;
    }
}

Tabul8Model::ensureSchema();

header('Content-Type: text/html; charset=UTF-8');
readfile(__DIR__ . '/index.html');
