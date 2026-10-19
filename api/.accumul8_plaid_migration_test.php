<?php

declare(strict_types=1);

/**
 * Pure-function coverage for the Plaid migration router, Teller fail-fast,
 * account remap dry-run planning, and the removed Plaid-to-Teller rewrite.
 *
 * Run: php api/.accumul8_plaid_migration_test.php
 */

function accumul8_normalize_text($value, int $maxLen = 191): string
{
    $v = trim((string)$value);
    if ($v === '') {
        return '';
    }
    $v = preg_replace('/\s+/', ' ', $v);
    if (!is_string($v)) {
        return '';
    }
    if ($maxLen > 0 && strlen($v) > $maxLen) {
        $v = substr($v, 0, $maxLen);
    }
    return trim($v);
}

function accumul8_normalize_date($value): ?string
{
    $raw = trim((string)$value);
    if ($raw === '') {
        return null;
    }
    $ts = strtotime($raw);
    if ($ts === false) {
        return null;
    }
    return date('Y-m-d', $ts);
}

require_once __DIR__ . '/../includes/accumul8_plaid.php';

$failures = 0;

function accumul8_plaid_test_assert(bool $condition, string $message): void
{
    global $failures;
    if ($condition) {
        echo "PASS {$message}\n";
        return;
    }
    $failures++;
    echo "FAIL {$message}\n";
}

accumul8_plaid_test_assert(
    accumul8_connection_sync_route(['provider_name' => 'teller', 'status' => 'connected']) === 'teller_retired',
    'router sends teller connections to the retired path'
);
accumul8_plaid_test_assert(
    accumul8_connection_sync_route(['provider_name' => 'teller', 'status' => 'retired_teller']) === 'teller_retired',
    'router sends retired_teller status to the retired path'
);
accumul8_plaid_test_assert(
    accumul8_connection_sync_route(['provider_name' => 'plaid', 'status' => 'connected', 'plaid_item_id' => 'item-1']) === 'plaid',
    'router sends plaid connections to Plaid sync'
);
accumul8_plaid_test_assert(
    accumul8_connection_sync_route(['provider_name' => 'plaid', 'status' => 'retired_teller', 'plaid_item_id' => 'item-1']) === 'teller_retired',
    'router fail-fasts when status is retired_teller'
);

$shutdown = new Accumul8ClientException(ACCUMUL8_TELLER_SHUTDOWN_ERROR, 409);
accumul8_plaid_test_assert(
    $shutdown->getMessage() === 'Teller has shut down; reconnect this bank via Plaid on the Sync tab',
    'Teller shutdown error text is the client message'
);
accumul8_plaid_test_assert(accumul8_exception_http_status($shutdown) === 409, 'Teller shutdown maps to HTTP 409');
accumul8_plaid_test_assert(
    accumul8_exception_http_status(new RuntimeException('Connection not found')) === 404,
    'missing connection maps to HTTP 404'
);
accumul8_plaid_test_assert(
    accumul8_exception_http_status(new RuntimeException('boom')) === 500,
    'unexpected failures stay HTTP 500'
);

$api = file_get_contents(__DIR__ . '/accumul8.php');
$libTest = file_get_contents(__DIR__ . '/.accumul8_lib_test.php');
accumul8_plaid_test_assert(is_string($api) && is_string($libTest), 'source files are readable');
foreach ([$api, $libTest] as $source) {
    accumul8_plaid_test_assert(
        is_string($source) && !str_contains($source, "source_kind = 'teller' WHERE source_kind = 'plaid'"),
        'transaction Plaid-to-Teller rewrite is absent'
    );
    accumul8_plaid_test_assert(
        is_string($source) && !str_contains($source, "provider_name = 'teller' WHERE provider_name = 'plaid'"),
        'connection Plaid-to-Teller rewrite is absent'
    );
}
accumul8_plaid_test_assert(str_contains((string)$api, "plaid_item_id', 'VARCHAR(191) NULL'"), 'migration adds plaid_item_id');
accumul8_plaid_test_assert(str_contains((string)$api, "plaid_access_token_secret_key', 'VARCHAR(191) NULL'"), 'migration adds plaid_access_token_secret_key');
accumul8_plaid_test_assert(str_contains((string)$api, "plaid_transactions_cursor', 'TEXT NULL'"), 'migration adds plaid_transactions_cursor');
accumul8_plaid_test_assert(str_contains((string)$api, "accumul8_accounts', 'plaid_account_id'"), 'migration adds plaid_account_id');
accumul8_plaid_test_assert(str_contains((string)$api, 'uniq_accumul8_bank_plaid_item'), 'migration adds the Plaid item unique key');
accumul8_plaid_test_assert(str_contains((string)$api, "status = 'retired_teller'"), 'migration retires Teller connections');
accumul8_plaid_test_assert(str_contains((string)$api, "['teller', 'plaid']"), 'provider allowlist includes plaid');

$tellerFn = '';
if (preg_match('/function accumul8_teller_sync_transactions_for_connection\(.*?^}/ms', (string)$api, $matches) === 1) {
    $tellerFn = $matches[0];
}
$throwPos = strpos($tellerFn, 'ACCUMUL8_TELLER_SHUTDOWN_ERROR');
$requestPos = strpos($tellerFn, 'accumul8_teller_request(');
accumul8_plaid_test_assert($throwPos !== false && ($requestPos === false || $throwPos < $requestPos), 'Teller sync throws the shutdown error before any Teller request');
accumul8_plaid_test_assert(str_contains($tellerFn, '409'), 'Teller sync fail-fast uses a 4xx status');
accumul8_plaid_test_assert(str_contains((string)$api, "accumul8_sync_transactions_for_connection(\$viewerId, \$actorUserId, \$connectionId);"), 'balance books syncs through the router');
accumul8_plaid_test_assert(
    str_contains((string)$api, "\$action === 'teller_sync_transactions' || \$action === 'sync_transactions' || \$action === 'plaid_sync_transactions'"),
    'sync actions share the router'
);
accumul8_plaid_test_assert(str_contains((string)$api, "\$action === 'plaid_link_token'"), 'plaid_link_token action is registered');
accumul8_plaid_test_assert(str_contains((string)$api, "\$action === 'plaid_exchange_public_token'"), 'plaid_exchange_public_token action is registered');
accumul8_plaid_test_assert(str_contains((string)$api, "\$action === 'remap_accounts_to_plaid'"), 'remap_accounts_to_plaid action is registered');
accumul8_plaid_test_assert(!str_contains((string)file_get_contents(__DIR__ . '/../includes/accumul8_plaid.php'), 'api.teller.io'), 'Plaid library does not call api.teller.io');

accumul8_plaid_test_assert(
    accumul8_plaid_institutions_match('', 'Juniper Bank', '', 'Barclays Bank Delaware'),
    'Juniper matches Barclays'
);
accumul8_plaid_test_assert(
    accumul8_plaid_institution_family('Navy Federal Credit Union') === 'nfcu'
        && accumul8_plaid_institution_family('NFCU') === 'nfcu',
    'NFCU names share one institution family'
);

$connections = [
    ['id' => 11, 'provider_name' => 'teller', 'status' => 'retired_teller', 'institution_name' => 'Navy Federal Credit Union', 'institution_id' => '', 'plaid_item_id' => ''],
    ['id' => 21, 'provider_name' => 'plaid', 'status' => 'connected', 'institution_name' => 'Navy Federal Credit Union', 'institution_id' => 'ins_nfcu', 'plaid_item_id' => 'item-nfcu'],
    ['id' => 22, 'provider_name' => 'plaid', 'status' => 'connected', 'institution_name' => 'Barclays Bank Delaware', 'institution_id' => 'ins_barclays', 'plaid_item_id' => 'item-barclays'],
];
$accounts = [
    ['id' => 4581, 'bank_connection_id' => 11, 'provider_name' => 'teller', 'institution_name' => 'NFCU', 'mask_last4' => '4581', 'account_number_mask' => '****4581', 'plaid_account_id' => '', 'teller_account_id' => 'teller-4581'],
    ['id' => 4607, 'bank_connection_id' => 11, 'provider_name' => 'teller', 'institution_name' => 'Navy Federal', 'mask_last4' => '4607', 'account_number_mask' => '', 'plaid_account_id' => '', 'teller_account_id' => 'teller-4607'],
    ['id' => 9001, 'bank_connection_id' => 21, 'provider_name' => 'plaid', 'institution_name' => 'Navy Federal Credit Union', 'mask_last4' => '4581', 'account_number_mask' => '', 'plaid_account_id' => 'plaid-acc-4581', 'teller_account_id' => ''],
    ['id' => 9002, 'bank_connection_id' => 21, 'provider_name' => 'plaid', 'institution_name' => 'Navy Federal Credit Union', 'mask_last4' => '4607', 'account_number_mask' => '', 'plaid_account_id' => 'plaid-acc-4607', 'teller_account_id' => ''],
    ['id' => 7001, 'bank_connection_id' => 11, 'provider_name' => 'teller', 'institution_name' => 'Juniper', 'mask_last4' => '4242', 'account_number_mask' => '************4242', 'plaid_account_id' => '', 'teller_account_id' => 'teller-juniper'],
    ['id' => 7002, 'bank_connection_id' => 22, 'provider_name' => 'plaid', 'institution_name' => 'Barclays', 'mask_last4' => '4242', 'account_number_mask' => '', 'plaid_account_id' => 'plaid-acc-barclays', 'teller_account_id' => ''],
];
$plans = accumul8_plan_remap_accounts_to_plaid($accounts, $connections);
$byId = [];
foreach ($plans as $plan) {
    $byId[(int)$plan['account_id']] = $plan;
}
accumul8_plaid_test_assert(isset($byId[4581]) && $byId[4581]['mask'] === '4581' && (int)$byId[4581]['bank_connection_id'] === 21 && $byId[4581]['plaid_account_id'] === 'plaid-acc-4581', 'dry-run remap plans NFCU 4581');
accumul8_plaid_test_assert(isset($byId[4607]) && $byId[4607]['mask'] === '4607' && $byId[4607]['plaid_account_id'] === 'plaid-acc-4607', 'dry-run remap plans NFCU 4607 separately');
accumul8_plaid_test_assert(isset($byId[7001]) && $byId[7001]['institution_family'] === 'barclays' && (int)$byId[7001]['bank_connection_id'] === 22, 'dry-run remap plans Juniper onto Barclays');
accumul8_plaid_test_assert(!isset($byId[9001]) && !isset($byId[7002]), 'accounts already on the Plaid connection are unchanged');
$public = accumul8_public_remap_matches($plans);
$encoded = json_encode($public);
accumul8_plaid_test_assert(is_string($encoded) && !str_contains($encoded, 'plaid_account_id') && !str_contains($encoded, 'account_number') && !str_contains($encoded, 'teller-'), 'remap output is masks and ids only');
accumul8_plaid_test_assert(
    isset($public[0]['mask']) && !array_key_exists('plaid_account_id', $public[0]),
    'public remap rows omit the remote Plaid account id'
);

$duplicate = accumul8_plaid_pick_duplicate_row([
    [
        'id' => 55,
        'source_kind' => 'teller',
        'external_id' => 'teller-tx-1',
        'description' => 'POS NFCU GROCERY',
        'transaction_date' => '2026-01-02',
        'amount' => -12.34,
    ],
    [
        'id' => 56,
        'source_kind' => 'teller',
        'external_id' => 'teller-tx-2',
        'description' => 'SOMETHING ELSE',
        'transaction_date' => '2026-01-02',
        'amount' => -40.00,
    ],
], [
    'date' => '2026-01-02',
    'amount' => -12.34,
    'description' => 'NFCU GROCERY',
]);
accumul8_plaid_test_assert(is_array($duplicate) && (int)$duplicate['id'] === 55 && (string)$duplicate['source_kind'] === 'teller', 'dedup matches the existing Teller transaction');
accumul8_plaid_test_assert(
    accumul8_plaid_pick_duplicate_row([[
        'id' => 77,
        'source_kind' => 'plaid',
        'description' => 'NFCU GROCERY',
        'transaction_date' => '2026-01-02',
        'amount' => -12.34,
    ]], [
        'date' => '2026-01-02',
        'amount' => -12.34,
        'description' => 'NFCU GROCERY',
    ]) === null,
    'dedup does not treat an existing Plaid row as a Teller duplicate'
);

if ($failures > 0) {
    fwrite(STDERR, "{$failures} assertion(s) failed\n");
    exit(1);
}

echo "All Plaid migration assertions passed\n";
exit(0);
