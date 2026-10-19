<?php

declare(strict_types=1);

/**
 * Server-side recovery for email MFA. Web access is denied by scripts/.htaccess.
 *
 * Examples (run on the server, from the site root):
 *   php scripts/auth/mfa_admin_recovery.php --username=jon --issue-code
 *   php scripts/auth/mfa_admin_recovery.php --username=jon --clear-lockout
 *   php scripts/auth/mfa_admin_recovery.php --username=jon --revoke-devices
 *
 * --issue-code prints a single-use 6-digit code and emails it when mail is up.
 * Enter that code on the Two-factor verification screen after the password step.
 * The code expires in 10 minutes. This does not turn MFA off.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit(1);
}

require_once __DIR__ . '/../../api/bootstrap.php';
require_once __DIR__ . '/../../api/emailer.php';
require_once __DIR__ . '/../../includes/auth_mfa.php';

$username = '';
$email = '';
$issue = false;
$clear = false;
$revoke = false;

foreach (array_slice($argv, 1) as $arg) {
    if (str_starts_with($arg, '--username=')) {
        $username = trim(substr($arg, 11));
    } elseif (str_starts_with($arg, '--email=')) {
        $email = trim(substr($arg, 8));
    } elseif ($arg === '--issue-code') {
        $issue = true;
    } elseif ($arg === '--clear-lockout') {
        $clear = true;
    } elseif ($arg === '--revoke-devices') {
        $revoke = true;
    } else {
        fwrite(STDERR, "Unknown argument.\n");
        exit(2);
    }
}

if ($username === '' && $email === '') {
    fwrite(STDERR, "Pass --username or --email, plus at least one action.\n");
    exit(2);
}
if (!$issue && !$clear && !$revoke) {
    fwrite(STDERR, "Pass --issue-code, --clear-lockout, and/or --revoke-devices.\n");
    exit(2);
}

if ($username !== '') {
    $user = Database::queryOne('SELECT id, username, is_admin FROM users WHERE username = ?', [$username]);
} else {
    $user = Database::queryOne('SELECT id, username, is_admin FROM users WHERE email = ?', [$email]);
}
if (!$user) {
    fwrite(STDERR, "User not found.\n");
    exit(1);
}

$userId = (int)$user['id'];
fwrite(STDOUT, "User id {$userId} (" . (string)$user['username'] . ")\n");

if ($clear) {
    catn8_mfa_tables_ensure();
    $cleared = Database::execute(
        'UPDATE auth_mfa_challenges SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
        [$userId]
    );
    fwrite(STDOUT, "Cleared {$cleared} open challenge(s).\n");
}

if ($revoke) {
    $revoked = catn8_mfa_revoke_devices_for_user($userId);
    fwrite(STDOUT, "Revoked {$revoked} trusted device(s).\n");
}

if ($issue) {
    $issued = catn8_mfa_issue_code($userId, 'login', true, true);
    if (!$issued['ok'] || empty($issued['code'])) {
        fwrite(STDERR, (string)($issued['error'] ?? 'Could not issue a recovery code') . "\n");
        exit(1);
    }
    fwrite(STDOUT, "Recovery code (single use, 10 minutes): {$issued['code']}\n");
    fwrite(STDOUT, $issued['email_sent'] ? "A copy was emailed.\n" : "Email was not sent. Use the code printed above.\n");
}
