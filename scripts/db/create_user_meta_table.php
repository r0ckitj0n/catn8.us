<?php
// scripts/db/create_user_meta_table.php
// CLI/HTTP script to create user_meta table if it doesn't exist

require_once dirname(__DIR__, 2) . '/api/config.php';
require_once dirname(__DIR__, 2) . '/includes/user_meta.php';

try {
    ensure_user_meta_table();
    echo "user_meta table ensured.\n";
} catch (Throwable $e) {
    fwrite(STDERR, 'Failed to ensure user_meta table: ' . $e->getMessage() . "\n");
    exit(1);
}
