<?php

declare(strict_types=1);

require_once __DIR__ . '/api/bootstrap.php';
require_once __DIR__ . '/includes/celebr8_model.php';

$uid = catn8_auth_user_id();
if ($uid === null) {
    header('Location: ' . catn8_login_redirect_url('/celebr8'));
    exit;
}

Celebr8Model::ensureSchema();

header('Content-Type: text/html; charset=UTF-8');
readfile(__DIR__ . '/index.html');
