<?php

declare(strict_types=1);

function catn8_mfa_after_password(int $userId): array
{
    catn8_mfa_tables_ensure();
    $trustedId = 0;
    try {
        $trustedId = catn8_mfa_trusted_user_id();
    } catch (Throwable $e) {
        catn8_log_error('MFA trusted device check failed', ['error' => $e->getMessage()]);
    }
    if ($trustedId === $userId && $userId > 0) {
        catn8_mfa_complete_login($userId);
        catn8_mfa_audit('trusted_device_login', true, 200, 'Login completed with trusted device', ['user_id' => $userId]);
        return ['status' => 200, 'body' => ['success' => true, 'mfa_required' => false, 'trusted_device' => true]];
    }

    catn8_mfa_remember_purpose($userId, 'login');
    $issued = catn8_mfa_issue_code($userId, 'login', false);
    $body = [
        'success' => (bool)($issued['ok'] ?? false),
        'mfa_required' => true,
        'email_masked' => (string)($issued['email_masked'] ?? ''),
        'email_sent' => (bool)($issued['email_sent'] ?? false),
        'expires_in_seconds' => CATN8_MFA_CODE_TTL_SECONDS,
    ];
    if (!$issued['ok']) {
        $body['success'] = false;
        $body['error'] = (string)($issued['error'] ?? 'Could not send a verification code');
        if (isset($issued['retry_after_seconds'])) {
            $body['retry_after_seconds'] = (int)$issued['retry_after_seconds'];
        }
    }
    return ['status' => (int)($issued['status'] ?? 500), 'body' => $body];
}
function catn8_mfa_resend_for_session(): array
{
    $subject = catn8_mfa_session_subject();
    if ($subject['purpose'] === null || (int)$subject['user_id'] <= 0) {
        return ['status' => 400, 'body' => ['success' => false, 'error' => 'Start sign-in again before requesting a code']];
    }
    $issued = catn8_mfa_issue_code((int)$subject['user_id'], (string)$subject['purpose'], true);
    $body = [
        'success' => (bool)$issued['ok'],
        'email_masked' => (string)($issued['email_masked'] ?? ''),
        'email_sent' => (bool)($issued['email_sent'] ?? false),
    ];
    if (!$issued['ok']) {
        $body['error'] = (string)($issued['error'] ?? 'Could not resend the code');
        if (isset($issued['retry_after_seconds'])) {
            $body['retry_after_seconds'] = (int)$issued['retry_after_seconds'];
        }
    }
    return ['status' => (int)$issued['status'], 'body' => $body];
}
function catn8_mfa_verify_for_session(string $code, bool $trustDevice): array
{
    $code = catn8_mfa_normalize_code($code);
    if (!catn8_mfa_code_is_well_formed($code)) {
        return ['status' => 400, 'body' => ['success' => false, 'error' => 'Enter the 6-digit code from your email']];
    }
    $subject = catn8_mfa_session_subject();
    $userId = (int)$subject['user_id'];
    $purpose = $subject['purpose'];
    if ($purpose === null || $userId <= 0) {
        return ['status' => 400, 'body' => ['success' => false, 'error' => 'Start sign-in again before entering a code']];
    }
    catn8_mfa_tables_ensure();

    Database::beginTransaction();
    try {
        $row = Database::queryOne(
            'SELECT id, code_hash, attempt_count, expires_at, used_at FROM auth_mfa_challenges
             WHERE user_id = ? AND purpose = ? AND used_at IS NULL
             ORDER BY id DESC LIMIT 1 FOR UPDATE',
            [$userId, $purpose]
        );
        if (!$row) {
            Database::commit();
            catn8_mfa_audit('verify_failed', false, 400, 'MFA challenge missing', ['user_id' => $userId, 'purpose' => $purpose]);
            return ['status' => 400, 'body' => ['success' => false, 'error' => 'Request a new code and try again']];
        }
        $expires = strtotime((string)$row['expires_at']);
        if ($row['used_at'] !== null || $expires === false || catn8_mfa_is_expired($expires, time())) {
            Database::commit();
            catn8_mfa_audit('verify_failed', false, 400, 'MFA code expired', ['user_id' => $userId, 'purpose' => $purpose]);
            return ['status' => 400, 'body' => ['success' => false, 'error' => 'That code has expired. Request a new one.']];
        }
        $attempts = (int)$row['attempt_count'];
        if (!catn8_mfa_attempt_allowed($attempts)) {
            Database::commit();
            catn8_mfa_audit('locked', false, 429, 'MFA attempt limit reached', ['user_id' => $userId, 'purpose' => $purpose]);
            return ['status' => 429, 'body' => ['success' => false, 'error' => 'Too many attempts. Request a new code.']];
        }
        $attempts++;
        Database::execute('UPDATE auth_mfa_challenges SET attempt_count = ? WHERE id = ?', [$attempts, (int)$row['id']]);
        $matches = catn8_mfa_code_matches($code, (string)$row['code_hash']);
        if (!$matches) {
            Database::commit();
            $locked = $attempts >= CATN8_MFA_MAX_ATTEMPTS;
            catn8_mfa_audit($locked ? 'locked' : 'verify_failed', false, $locked ? 429 : 401, 'MFA code rejected', [
                'user_id' => $userId,
                'purpose' => $purpose,
                'attempt_count' => $attempts,
            ]);
            return [
                'status' => $locked ? 429 : 401,
                'body' => ['success' => false, 'error' => $locked ? 'Too many attempts. Request a new code.' : 'That code is incorrect.'],
            ];
        }
        Database::execute('UPDATE auth_mfa_challenges SET used_at = NOW() WHERE id = ? AND used_at IS NULL', [(int)$row['id']]);
        Database::commit();
    } catch (Throwable $e) {
        if (Database::inTransaction()) {
            Database::rollBack();
        }
        catn8_log_error('MFA verify failed', ['error' => $e->getMessage()]);
        return ['status' => 500, 'body' => ['success' => false, 'error' => 'Could not verify that code']];
    }

    $trusted = false;
    if ($trustDevice) {
        try {
            $trusted = catn8_mfa_issue_trusted_device($userId);
        } catch (Throwable $e) {
            catn8_log_error('MFA trusted device issue failed', ['error' => $e->getMessage()]);
        }
    }
    if ($purpose === 'login') {
        catn8_mfa_complete_login($userId);
    } else {
        catn8_mfa_clear_pending();
    }
    catn8_mfa_mark_verified();
    catn8_mfa_audit('verify_success', true, 200, 'MFA code accepted', ['user_id' => $userId, 'purpose' => $purpose]);
    return [
        'status' => 200,
        'body' => [
            'success' => true,
            'purpose' => $purpose,
            'trusted_device' => $trusted,
        ],
    ];
}
function catn8_mfa_browser_step_up_fresh(): bool
{
    catn8_session_start();
    $verifiedAt = (int)($_SESSION['catn8_mfa_verified_at'] ?? 0);
    return catn8_mfa_verified_at_is_fresh($verifiedAt, time(), CATN8_MFA_STEP_UP_SECONDS);
}

/**
 * Browser Plaid Link must follow a code check from the last 12 hours.
 * Bearer and X-Api-Key admin tokens skip this gate.
 *
 * @return array{status:int,body:array<string,mixed>}|null
 */
function catn8_mfa_plaid_step_up_gate(int $actorUserId): ?array
{
    if (function_exists('catn8_request_has_valid_admin_api_token') && catn8_request_has_valid_admin_api_token()) {
        return null;
    }
    if (catn8_mfa_browser_step_up_fresh()) {
        return null;
    }
    if ($actorUserId <= 0) {
        return ['status' => 401, 'body' => ['success' => false, 'error' => 'Not authenticated']];
    }
    catn8_mfa_remember_purpose($actorUserId, 'step_up');
    $issued = catn8_mfa_issue_code($actorUserId, 'step_up', false);
    catn8_mfa_audit('step_up_required', (bool)$issued['ok'], (int)$issued['status'], 'Plaid link requires a fresh MFA code', [
        'user_id' => $actorUserId,
        'email_masked' => (string)($issued['email_masked'] ?? ''),
    ]);
    return [
        'status' => (int)$issued['status'] === 200 ? 403 : (int)$issued['status'],
        'body' => [
            'success' => false,
            'error' => (string)($issued['error'] ?? 'Two-factor verification required before connecting a bank.'),
            'mfa_step_up_required' => true,
            'email_masked' => (string)($issued['email_masked'] ?? ''),
            'email_sent' => (bool)($issued['email_sent'] ?? false),
        ],
    ];
}
