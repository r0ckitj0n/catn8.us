<?php
declare(strict_types=1);

require_once __DIR__ . '/api/bootstrap.php';
require_once __DIR__ . '/includes/valid8_vault_entry_model.php';

catn8_session_start();
$uid = catn8_auth_user_id();
$isAllowed = false;
if ($uid !== null) {
    $isAllowed = catn8_user_is_admin($uid) || catn8_user_in_group($uid, 'valid8-users');
}

if ($uid !== null && !$isAllowed) {
    // Keep a normal response code so shared-host 403 overrides cannot replace this page with parking HTML.
    header('Content-Type: text/html; charset=UTF-8');
    echo '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>VALID8 Access</title></head><body style="font-family:Arial,sans-serif;padding:2rem;background:#f5f7fb;color:#1f2a44;">';
    echo '<h1 style="margin-top:0;">VALID8 Access Restricted</h1>';
    echo '<p>This page is only available to users in <strong>VALID8 Users</strong> or administrators.</p>';
    echo '<p><a href="/login">Log in</a> or contact an administrator to request access.</p>';
    echo '</body></html>';
    exit;
}

if ($isAllowed) {
    Valid8VaultEntryModel::ensureSchema();
}

header('Content-Type: text/html; charset=UTF-8');
readfile(__DIR__ . '/index.html');
