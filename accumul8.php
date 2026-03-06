<?php
declare(strict_types=1);

require_once __DIR__ . '/api/bootstrap.php';

catn8_session_start();
$uid = catn8_auth_user_id();
$isAllowed = false;
if ($uid !== null) {
    $isAllowed = catn8_user_is_admin($uid) || catn8_user_in_group($uid, 'accumul8-users');
}

if (!$isAllowed) {
    // Keep a normal response code so shared-host 403 overrides cannot replace this page with parking HTML.
    header('Content-Type: text/html; charset=UTF-8');
    echo '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Accumul8 Access</title></head><body style="font-family:Arial,sans-serif;padding:2rem;background:#f5f7fb;color:#1f2a44;">';
    echo '<h1 style="margin-top:0;">Accumul8 Access Restricted</h1>';
    echo '<p>This page is only available to users in <strong>Accumul8 Users</strong> or administrators.</p>';
    echo '<p><a href="/login.php">Log in</a> or contact an administrator to request access.</p>';
    echo '</body></html>';
    exit;
}

header('Content-Type: text/html; charset=UTF-8');
readfile(__DIR__ . '/index.html');
