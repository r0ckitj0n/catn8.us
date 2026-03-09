<?php
declare(strict_types=1);

require_once __DIR__ . '/api/bootstrap.php';

$uid = catn8_auth_user_id();
if ($uid === null) {
    header('Location: /');
    exit;
}

catn8_groups_seed_core();
if (!catn8_user_is_admin($uid) && !catn8_user_in_group($uid, 'build-wizard-users')) {
    header('Location: /');
    exit;
}

header('Content-Type: text/html; charset=UTF-8');
readfile(__DIR__ . '/index.html');
