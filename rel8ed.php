<?php
declare(strict_types=1);

require_once __DIR__ . '/api/bootstrap.php';
require_once __DIR__ . '/includes/rel8ed_model.php';

$uid = catn8_auth_user_id();
if ($uid === null) {
    header('Location: ' . catn8_login_redirect_url('/rel8ed/'));
    exit;
}

catn8_groups_seed_core();
if (!catn8_user_is_admin($uid) && !catn8_user_in_group($uid, 'rel8ed-users')) {
    header('Location: /');
    exit;
}

Rel8edModel::ensureSchema();

header('Content-Type: text/html; charset=UTF-8');
header('X-Robots-Tag: noindex, nofollow, noarchive');
header('Cache-Control: private, no-store');
readfile(__DIR__ . '/index.html');
