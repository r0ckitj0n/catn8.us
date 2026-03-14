<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This script must be run from the command line.\n");
    exit(1);
}

$options = getopt('', [
    'owner-user-id:',
    'send-email::',
    'create-notification-rule::',
    'email-on-attention-only::',
    'run-entity-maintenance::',
]);

$ownerUserId = isset($options['owner-user-id']) ? (int)$options['owner-user-id'] : 0;
if ($ownerUserId <= 0) {
    fwrite(STDERR, "Usage: php scripts/accumul8/run_aicountant_housekeeping.php --owner-user-id=<id> [--send-email=1] [--create-notification-rule=1] [--email-on-attention-only=1]\n");
    exit(1);
}

$rootDir = dirname(__DIR__, 2);
require_once $rootDir . '/api/bootstrap.php';

define('CATN8_ACCUMUL8_LIBRARY_ONLY', true);
require_once $rootDir . '/api/accumul8.php';

try {
    accumul8_get_or_create_default_account($ownerUserId);
    $result = accumul8_run_aicountant_housekeeping($ownerUserId, $ownerUserId, [
        'send_email' => $options['send-email'] ?? 1,
        'create_notification_rule' => $options['create-notification-rule'] ?? 1,
        'email_on_attention_only' => $options['email-on-attention-only'] ?? 1,
        'run_entity_maintenance' => $options['run-entity-maintenance'] ?? 0,
    ]);
    fwrite(STDOUT, json_encode([
        'success' => true,
        'owner_user_id' => $ownerUserId,
        'attention_needed' => (int)($result['attention_needed'] ?? 0),
        'balance_books' => $result['balance_books'] ?? [],
        'opening_balance_reconciliation' => $result['opening_balance_reconciliation'] ?? [],
        'watchlist' => $result['watchlist'] ?? [],
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(0);
} catch (Throwable $exception) {
    fwrite(STDERR, 'AIcountant housekeeping failed: ' . $exception->getMessage() . PHP_EOL);
    exit(1);
}
