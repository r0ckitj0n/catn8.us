<?php
declare(strict_types=1);

require_once __DIR__ . '/api/bootstrap.php';
require_once __DIR__ . '/includes/valid8_vault_entry_model.php';

$uid = catn8_auth_user_id();
if ($uid === null) {
    header('Location: ' . catn8_login_redirect_url('/valid8'));
    exit;
}

catn8_groups_seed_core();
if (!catn8_user_is_admin($uid) && !catn8_user_in_group($uid, 'valid8-users')) {
    header('Location: /');
    exit;
}

Valid8VaultEntryModel::ensureSchema();

header('Content-Type: text/html; charset=UTF-8');
readfile(__DIR__ . '/index.html');
