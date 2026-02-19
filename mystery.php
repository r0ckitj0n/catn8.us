<?php

require_once __DIR__ . '/api/bootstrap.php';

$uid = catn8_auth_user_id();
if ($uid === null) {
    header('Location: /');
    exit;
}

catn8_groups_seed_core();
if (!catn8_user_is_admin($uid) && !catn8_user_in_group($uid, 'mystery-game-users')) {
    header('Location: /');
    exit;
}

require_once __DIR__ . '/includes/react_shell.php';
catn8_render_react_shell('mystery', 'Mystery Game - catn8.us');
exit;
