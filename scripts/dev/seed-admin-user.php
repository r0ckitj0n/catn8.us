<?php

declare(strict_types=1);

require_once __DIR__ . '/../../api/bootstrap.php';

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This script must be run via CLI.\n");
    exit(1);
}

$username = (string)(getenv('CATN8_SEED_ADMIN_USER') ?: 'admin');
$password = (string)(getenv('CATN8_SEED_ADMIN_PASS') ?: '');
$email = (string)(getenv('CATN8_SEED_ADMIN_EMAIL') ?: 'admin@local.test');

if ($password === '') {
    fwrite(STDERR, "Missing CATN8_SEED_ADMIN_PASS.\n");
    exit(1);
}

catn8_users_table_ensure();

$existing = Database::queryOne('SELECT id FROM users WHERE username = ?', [$username]);
if ($existing) {
    fwrite(STDOUT, "Admin user already exists: {$username}\n");
    exit(0);
}

$hash = password_hash($password, PASSWORD_DEFAULT);
Database::execute(
    'INSERT INTO users (username, email, password_hash, is_admin, is_active, email_verified) VALUES (?, ?, ?, 1, 1, 1)',
    [$username, $email, $hash]
);

fwrite(STDOUT, "Created admin user: {$username}\n");
exit(0);
