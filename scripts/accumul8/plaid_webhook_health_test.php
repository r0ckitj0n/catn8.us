<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This script must be run from the command line.\n");
    exit(1);
}

require_once dirname(__DIR__, 2) . '/includes/accumul8_plaid_webhook.php';

$failures = 0;

function plaid_test_assert(bool $condition, string $message): void
{
    global $failures;
    if ($condition) {
        fwrite(STDOUT, "PASS {$message}\n");
        return;
    }
    $failures++;
    fwrite(STDOUT, "FAIL {$message}\n");
}

function plaid_test_der_to_raw(string $der): string
{
    $offset = 0;
    if (($der[$offset] ?? '') !== "\x30") {
        throw new RuntimeException('Expected DER sequence');
    }
    $offset += 2;
    $readInt = static function (string $der, int &$offset): string {
        if (($der[$offset] ?? '') !== "\x02") {
            throw new RuntimeException('Expected DER integer');
        }
        $offset++;
        $length = ord($der[$offset]);
        $offset++;
        $bytes = substr($der, $offset, $length);
        $offset += $length;
        if ($bytes !== '' && $bytes[0] === "\x00") {
            $bytes = substr($bytes, 1);
        }
        return str_pad($bytes, 32, "\x00", STR_PAD_LEFT);
    };
    return $readInt($der, $offset) . $readInt($der, $offset);
}

function plaid_test_signed_jwt(string $body, int $iat, string $alg = 'ES256'): array
{
    $key = openssl_pkey_new([
        'private_key_type' => OPENSSL_KEYTYPE_EC,
        'curve_name' => 'prime256v1',
    ]);
    if ($key === false) {
        throw new RuntimeException('openssl_pkey_new failed');
    }
    $details = openssl_pkey_get_details($key);
    if (!is_array($details) || !isset($details['ec']['x'], $details['ec']['y'])) {
        throw new RuntimeException('EC key details missing');
    }
    $privatePem = '';
    if (!openssl_pkey_export($key, $privatePem)) {
        throw new RuntimeException('openssl_pkey_export failed');
    }
    $header = accumul8_plaid_base64url_encode(json_encode(['alg' => $alg, 'kid' => 'test-key', 'typ' => 'JWT'], JSON_UNESCAPED_SLASHES));
    $payload = accumul8_plaid_base64url_encode(json_encode([
        'iat' => $iat,
        'request_body_sha256' => hash('sha256', $body),
    ], JSON_UNESCAPED_SLASHES));
    $input = $header . '.' . $payload;
    $der = '';
    if (!openssl_sign($input, $der, $privatePem, OPENSSL_ALGO_SHA256)) {
        throw new RuntimeException('openssl_sign failed');
    }
    $jwt = $input . '.' . accumul8_plaid_base64url_encode(plaid_test_der_to_raw($der));
    return [
        'jwt' => $jwt,
        'jwk' => [
            'kty' => 'EC',
            'crv' => 'P-256',
            'kid' => 'test-key',
            'x' => accumul8_plaid_base64url_encode($details['ec']['x']),
            'y' => accumul8_plaid_base64url_encode($details['ec']['y']),
        ],
    ];
}

$now = 1_800_000_000;
$body = '{"webhook_type":"TRANSACTIONS","webhook_code":"SYNC_UPDATES_AVAILABLE","item_id":"item-1"}';
$signed = plaid_test_signed_jwt($body, $now);
$verified = accumul8_plaid_verify_webhook_jwt($signed['jwt'], $body, static fn(string $kid): array => $signed['jwk'], $now);
plaid_test_assert($verified['ok'] === true, 'valid ES256 webhook JWT verifies');

$badHash = accumul8_plaid_verify_webhook_jwt($signed['jwt'], $body . ' ', static fn(string $kid): array => $signed['jwk'], $now);
plaid_test_assert($badHash['ok'] === false && $badHash['error'] === 'Plaid verification body hash did not match', 'body hash mismatch is rejected');

$old = plaid_test_signed_jwt($body, $now - 301);
$oldResult = accumul8_plaid_verify_webhook_jwt($old['jwt'], $body, static fn(string $kid): array => $old['jwk'], $now);
plaid_test_assert($oldResult['ok'] === false && $oldResult['error'] === 'Plaid verification token is expired', 'iat older than 5 minutes is rejected');

$noneHeader = accumul8_plaid_base64url_encode('{"alg":"none","kid":"test-key"}');
$nonePayload = accumul8_plaid_base64url_encode(json_encode(['iat' => $now, 'request_body_sha256' => hash('sha256', $body)]));
$none = accumul8_plaid_verify_webhook_jwt($noneHeader . '.' . $nonePayload . '.', $body, static fn(): array => $signed['jwk'], $now);
plaid_test_assert($none['ok'] === false && $none['error'] === 'Unsupported Plaid verification algorithm', 'alg none is rejected');

$sync = accumul8_plaid_classify_webhook(['webhook_code' => 'SYNC_UPDATES_AVAILABLE', 'item_id' => 'item-1']);
plaid_test_assert($sync['action'] === 'sync' && $sync['item_id'] === 'item-1', 'SYNC_UPDATES_AVAILABLE syncs the item');

$accounts = accumul8_plaid_classify_webhook(['webhook_code' => 'NEW_ACCOUNTS_AVAILABLE', 'item_id' => 'item-2']);
plaid_test_assert($accounts['action'] === 'sync', 'NEW_ACCOUNTS_AVAILABLE syncs the item');

foreach (['ITEM_LOGIN_REQUIRED', 'PENDING_EXPIRATION', 'PENDING_DISCONNECT', 'ERROR', 'USER_PERMISSION_REVOKED'] as $code) {
    $effect = accumul8_plaid_classify_webhook([
        'webhook_code' => $code,
        'item_id' => 'item-3',
        'error' => ['error_code' => $code, 'error_message' => $code . ' detail'],
    ]);
    plaid_test_assert($effect['action'] === 'needs_reauth' && str_contains((string)$effect['reason'], $code), $code . ' marks needs_reauth');
}

plaid_test_assert(accumul8_plaid_connection_is_stale($now - 129601, $now - 999999, $now) === true, 'sync older than 36h is stale');
plaid_test_assert(accumul8_plaid_connection_is_stale($now - 129600, $now - 999999, $now) === false, 'sync at exactly 36h is not stale');
plaid_test_assert(accumul8_plaid_connection_is_stale(null, $now - 3600, $now) === false, 'new connection without a sync is not stale');
plaid_test_assert(accumul8_plaid_connection_is_stale(null, $now - 129601, $now) === true, 'old connection without a sync is stale');

$flags = accumul8_plaid_health_flags([
    'needs_reauth' => true,
    'stale' => true,
    'consecutive_errors' => 2,
    'missing_webhook' => true,
    'credential_failure' => true,
]);
plaid_test_assert($flags === ['credential_failure', 'missing_webhook', 'needs_reauth', 'repeated_errors', 'stale_sync'], 'health flags include every monitored problem');
plaid_test_assert(accumul8_plaid_health_flags(['consecutive_errors' => 1]) === [], 'one error is not repeated yet');

$problemKey = accumul8_plaid_health_alert_key([
    ['connection_id' => 4, 'flags' => ['needs_reauth']],
    ['connection_id' => 2, 'flags' => ['stale_sync', 'missing_webhook']],
]);
plaid_test_assert($problemKey === '2:missing_webhook,stale_sync|4:needs_reauth', 'alert key is stable and sorted');
plaid_test_assert(accumul8_plaid_health_email_decision('', 'ok') === 'none', 'healthy with no prior alert stays silent');
plaid_test_assert(accumul8_plaid_health_email_decision('ok', 'ok') === 'none', 'healthy repeat stays silent');
plaid_test_assert(accumul8_plaid_health_email_decision('ok', $problemKey) === 'problem', 'a new problem sends one email');
plaid_test_assert(accumul8_plaid_health_email_decision($problemKey, $problemKey) === 'none', 'the same problem does not repeat');
plaid_test_assert(accumul8_plaid_health_email_decision($problemKey, 'ok') === 'cleared', 'a cleared problem sends one email');

$problemMail = accumul8_plaid_health_email_content('problem', [
    ['connection_id' => 4, 'institution_name' => 'Navy Federal', 'flags' => ['needs_reauth']],
]);
plaid_test_assert(str_contains($problemMail['subject'], 'needs attention'), 'problem email names the attention');
plaid_test_assert(str_contains($problemMail['html'], 'Navy Federal') && str_contains($problemMail['html'], 'Reconnect via Plaid'), 'problem email names the bank and the reconnect click');
$clearMail = accumul8_plaid_health_email_content('cleared', []);
plaid_test_assert(str_contains($clearMail['subject'], 'healthy again'), 'cleared email says the sync recovered');
plaid_test_assert(str_contains($problemMail['html'], 'https://catn8.us/accumul8/'), 'email links to the Sync tab');

if ($failures > 0) {
    fwrite(STDOUT, "{$failures} failed\n");
    exit(1);
}
fwrite(STDOUT, "all passed\n");
exit(0);
