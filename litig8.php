<?php
declare(strict_types=1);

require_once __DIR__ . '/api/bootstrap.php';
require_once __DIR__ . '/includes/litig8_model.php';

$uid = catn8_auth_user_id();
if ($uid === null) {
    header('Location: ' . catn8_login_redirect_url('/litig8/'));
    exit;
}

catn8_groups_seed_core();
if (!catn8_user_is_admin($uid) && !catn8_user_in_group($uid, 'litig8-users')) {
    header('Location: /');
    exit;
}

Litig8Model::ensureSchema();

header('Content-Type: text/html; charset=UTF-8');
readfile(__DIR__ . '/index.html');
