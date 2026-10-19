<?php

declare(strict_types=1);

require_once __DIR__ . '/auth_mfa_logic.php';
require_once __DIR__ . '/diagnostics_log.php';

function catn8_mfa_tables_ensure(): void
{
    static $ready = false;
    if ($ready) {
        return;
    }
    Database::execute("CREATE TABLE IF NOT EXISTS auth_mfa_challenges (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        purpose VARCHAR(16) NOT NULL,
        code_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        attempt_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_auth_mfa_challenges_user_purpose (user_id, purpose, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    Database::execute("CREATE TABLE IF NOT EXISTS auth_trusted_devices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        selector VARCHAR(64) NOT NULL,
        token_hash VARBINARY(32) NOT NULL,
        expires_at DATETIME NOT NULL,
        revoked_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME NULL,
        user_agent VARCHAR(255) NULL,
        UNIQUE KEY uniq_auth_trusted_devices_selector (selector),
        KEY idx_auth_trusted_devices_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $ready = true;
}
function catn8_mfa_audit(string $eventKey, bool $ok, int $httpStatus, string $message, array $meta = []): void
{
    unset($meta['code'], $meta['password'], $meta['code_hash']);
    catn8_diagnostics_log_event('auth.mfa.' . $eventKey, $ok, $httpStatus, $message, $meta);
}
function catn8_mfa_cookie_secure(): bool
{
    if (function_exists('catn8_request_is_https') && catn8_request_is_https()) {
        return true;
    }
    if (function_exists('catn8_is_local_request') && !catn8_is_local_request()) {
        return true;
    }
    return false;
}
function catn8_mfa_clear_pending(): void
{
    unset(
        $_SESSION['catn8_mfa_pending_user_id'],
        $_SESSION['catn8_mfa_purpose']
    );
}
function catn8_mfa_load_user(int $userId): ?array
{
    if ($userId <= 0) {
        return null;
    }
    $row = Database::queryOne(
        'SELECT id, username, email, is_admin, is_active FROM users WHERE id = ?',
        [$userId]
    );
    return $row ?: null;
}
function catn8_mfa_remember_purpose(int $userId, string $purpose): void
{
    catn8_session_start();
    $_SESSION['catn8_mfa_purpose'] = $purpose;
    if ($purpose === 'login') {
        $_SESSION['catn8_mfa_pending_user_id'] = $userId;
        unset($_SESSION['catn8_user_id']);
    }
}
function catn8_mfa_session_subject(): array
{
    catn8_session_start();
    $purpose = catn8_mfa_allowlisted_purpose((string)($_SESSION['catn8_mfa_purpose'] ?? ''));
    if ($purpose === 'login') {
        return ['purpose' => 'login', 'user_id' => (int)($_SESSION['catn8_mfa_pending_user_id'] ?? 0)];
    }
    if ($purpose === 'step_up') {
        return ['purpose' => 'step_up', 'user_id' => (int)(catn8_auth_user_id() ?? 0)];
    }
    return ['purpose' => null, 'user_id' => 0];
}
function catn8_mfa_complete_login(int $userId): void
{
    catn8_session_start();
    session_regenerate_id(true);
    $_SESSION['catn8_user_id'] = $userId;
    catn8_mfa_clear_pending();
}
function catn8_mfa_mark_verified(): void
{
    catn8_session_start();
    $_SESSION['catn8_mfa_verified_at'] = time();
}

require_once __DIR__ . '/auth_mfa_device.php';
require_once __DIR__ . '/auth_mfa_challenge.php';
require_once __DIR__ . '/auth_mfa_flow.php';
