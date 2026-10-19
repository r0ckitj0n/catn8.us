<?php

declare(strict_types=1);

function catn8_mfa_recent_send_count(int $userId): int
{
    $row = Database::queryOne(
        'SELECT COUNT(*) AS c FROM auth_mfa_challenges WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)',
        [$userId]
    );
    return (int)($row['c'] ?? 0);
}
function catn8_mfa_live_challenge(int $userId, string $purpose): ?array
{
    return Database::queryOne(
        'SELECT id, created_at, expires_at FROM auth_mfa_challenges
         WHERE user_id = ? AND purpose = ? AND used_at IS NULL AND expires_at > NOW() AND attempt_count < ?
         ORDER BY id DESC LIMIT 1',
        [$userId, $purpose, CATN8_MFA_MAX_ATTEMPTS]
    );
}
function catn8_mfa_issue_code(int $userId, string $purpose, bool $forceNew, bool $includeCode = false): array
{
    if ($includeCode && PHP_SAPI !== 'cli') {
        $includeCode = false;
    }
    $purpose = catn8_mfa_allowlisted_purpose($purpose);
    if ($purpose === null) {
        return ['ok' => false, 'status' => 400, 'error' => 'Unsupported verification purpose'];
    }
    catn8_mfa_tables_ensure();
    $user = catn8_mfa_load_user($userId);
    if (!$user) {
        return ['ok' => false, 'status' => 400, 'error' => 'Account not found'];
    }
    $email = trim((string)($user['email'] ?? ''));
    if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        catn8_mfa_audit('challenge_blocked', false, 409, 'MFA email missing', ['user_id' => $userId]);
        return ['ok' => false, 'status' => 409, 'error' => 'No email is on file for this account. An administrator can add one from the server recovery script.'];
    }
    $masked = catn8_mfa_mask_email($email);
    $live = catn8_mfa_live_challenge($userId, $purpose);
    if ($live && !$forceNew) {
        $created = strtotime((string)$live['created_at']);
        if ($created !== false && (time() - $created) < CATN8_MFA_RESEND_COOLDOWN_SECONDS) {
            return [
                'ok' => true,
                'status' => 200,
                'email_masked' => $masked,
                'email_sent' => true,
                'reused' => true,
            ];
        }
    }
    if (catn8_mfa_recent_send_count($userId) >= CATN8_MFA_RESEND_MAX_PER_HOUR) {
        catn8_mfa_audit('resend_limited', false, 429, 'MFA resend rate limit', ['user_id' => $userId, 'purpose' => $purpose]);
        return [
            'ok' => false,
            'status' => 429,
            'error' => 'Too many verification codes were requested. Please wait and try again.',
            'email_masked' => $masked,
            'retry_after_seconds' => 3600,
        ];
    }
    if ($live) {
        $created = strtotime((string)$live['created_at']);
        if ($created !== false && (time() - $created) < CATN8_MFA_RESEND_COOLDOWN_SECONDS) {
            return [
                'ok' => false,
                'status' => 429,
                'error' => 'Please wait before requesting another code.',
                'email_masked' => $masked,
                'retry_after_seconds' => CATN8_MFA_RESEND_COOLDOWN_SECONDS - (time() - $created),
            ];
        }
    }

    $code = catn8_mfa_generate_code();
    $hash = catn8_mfa_hash_code($code);
    Database::beginTransaction();
    try {
        Database::execute(
            'UPDATE auth_mfa_challenges SET used_at = NOW() WHERE user_id = ? AND purpose = ? AND used_at IS NULL',
            [$userId, $purpose]
        );
        Database::execute(
            'INSERT INTO auth_mfa_challenges (user_id, purpose, code_hash, expires_at, attempt_count) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), 0)',
            [$userId, $purpose, $hash]
        );
        Database::commit();
    } catch (Throwable $e) {
        if (Database::inTransaction()) {
            Database::rollBack();
        }
        catn8_mfa_audit('challenge_failed', false, 500, 'MFA challenge store failed', ['user_id' => $userId]);
        return ['ok' => false, 'status' => 500, 'error' => 'Could not start verification'];
    }

    try {
        if (!function_exists('catn8_smtp_is_configured') || !catn8_smtp_is_configured()) {
            throw new RuntimeException('SMTP is not configured');
        }
        catn8_send_email($email, (string)$user['username'], 'Your catn8.us verification code', catn8_mfa_email_html($code, (string)$user['username'], $purpose));
    } catch (Throwable $e) {
        catn8_log_error('MFA email send failed', ['user_id' => $userId, 'purpose' => $purpose, 'error' => $e->getMessage()]);
        catn8_mfa_audit('email_failed', false, 503, 'MFA email failed', ['user_id' => $userId, 'purpose' => $purpose]);
        return [
            'ok' => false,
            'status' => 503,
            'mfa_required' => true,
            'email_masked' => $masked,
            'email_sent' => false,
            'error' => 'We could not email a verification code. Try again in a minute, or use the server recovery script.',
        ];
    }

    catn8_mfa_audit($forceNew ? 'resend' : 'challenge_sent', true, 200, 'MFA code emailed', [
        'user_id' => $userId,
        'purpose' => $purpose,
        'email_masked' => $masked,
    ]);
    $result = [
        'ok' => true,
        'status' => 200,
        'email_masked' => $masked,
        'email_sent' => true,
        'reused' => false,
    ];
    if ($includeCode) {
        $result['code'] = $code;
    }
    return $result;
}
