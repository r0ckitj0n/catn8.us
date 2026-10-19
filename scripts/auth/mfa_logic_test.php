<?php

declare(strict_types=1);

require_once __DIR__ . '/../../includes/auth_mfa_logic.php';

$failures = 0;

function mfa_test_assert(bool $ok, string $message): void
{
    global $failures;
    if ($ok) {
        echo "PASS {$message}\n";
        return;
    }
    $failures++;
    echo "FAIL {$message}\n";
}

mfa_test_assert(catn8_mfa_mask_email('jon@catn8.us') === 'j***@catn8.us', 'masks jon@catn8.us');
mfa_test_assert(catn8_mfa_mask_email('A@catn8.us') === 'a***@catn8.us', 'masks a single-character local part');
mfa_test_assert(catn8_mfa_mask_email('not-an-email') === 'your email', 'rejects an address without a domain');
mfa_test_assert(catn8_mfa_code_is_well_formed('012345'), 'accepts a 6-digit code');
mfa_test_assert(!catn8_mfa_code_is_well_formed('12345'), 'rejects a short code');
mfa_test_assert(!catn8_mfa_code_is_well_formed('1234567'), 'rejects a long code');

$code = catn8_mfa_generate_code();
$hash = catn8_mfa_hash_code($code);
mfa_test_assert(catn8_mfa_code_is_well_formed($code), 'generated code is 6 digits');
mfa_test_assert($hash !== $code && !str_contains($hash, $code), 'stored hash does not contain the code');
mfa_test_assert(catn8_mfa_code_matches($code, $hash), 'matching code verifies');
mfa_test_assert(!catn8_mfa_code_matches('000000' === $code ? '000001' : '000000', $hash), 'other code does not verify');

mfa_test_assert(catn8_mfa_attempt_allowed(0) && catn8_mfa_attempt_allowed(4) && !catn8_mfa_attempt_allowed(5), 'fifth attempt is the last allowed');
$now = 1_700_000_000;
mfa_test_assert(!catn8_mfa_is_expired($now + 600, $now), 'code inside 10 minutes is live');
mfa_test_assert(catn8_mfa_is_expired($now, $now), 'code at expiry is spent');
mfa_test_assert(catn8_mfa_verified_at_is_fresh($now - 60, $now), 'step-up is fresh inside 12 hours');
mfa_test_assert(!catn8_mfa_verified_at_is_fresh($now - CATN8_MFA_STEP_UP_SECONDS, $now), 'step-up expires at 12 hours');
mfa_test_assert(!catn8_mfa_verified_at_is_fresh(0, $now), 'missing verification is not fresh');
mfa_test_assert(catn8_mfa_api_token_skips_step_up(true) && !catn8_mfa_api_token_skips_step_up(false), 'API tokens skip browser step-up');

$selector = catn8_mfa_base64url_encode(random_bytes(18));
$verifier = catn8_mfa_base64url_encode(random_bytes(32));
$expires = $now + CATN8_MFA_TRUST_SECONDS;
$key = 'test-signing-key-not-a-secret';
$cookie = catn8_mfa_device_cookie_value($selector, $verifier, $expires, $key);
$parsed = catn8_mfa_parse_device_cookie($cookie);
mfa_test_assert(is_array($parsed), 'trusted device cookie parses');
mfa_test_assert($parsed !== null && catn8_mfa_device_cookie_signature_ok($parsed, $key, $now), 'trusted device signature matches');
mfa_test_assert($parsed !== null && !catn8_mfa_device_cookie_signature_ok($parsed, 'other-key', $now), 'trusted device signature rejects another key');
mfa_test_assert($parsed !== null && !catn8_mfa_device_cookie_signature_ok($parsed, $key, $expires), 'expired trusted device cookie is rejected');
mfa_test_assert(catn8_mfa_parse_device_cookie($cookie . '.extra') === null, 'malformed cookie is rejected');

$html = catn8_mfa_email_html('246810', 'jon', 'login');
mfa_test_assert(str_contains($html, '246810') && str_contains($html, 'catn8.us') && str_contains($html, 'Two-factor verification'), 'email contains the code and brand');
mfa_test_assert(!str_contains($html, 'password'), 'email does not mention a password');

$login = file_get_contents(__DIR__ . '/../../api/auth/login.php');
$plaid = file_get_contents(__DIR__ . '/../../api/accumul8.php');
mfa_test_assert(is_string($login) && str_contains($login, 'catn8_mfa_after_password') && !str_contains($login, "\$_SESSION['catn8_user_id']"), 'password login hands off to MFA');
mfa_test_assert(is_string($plaid) && str_contains($plaid, 'catn8_mfa_plaid_step_up_gate'), 'Plaid link token checks the MFA step-up gate');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} failed\n");
    exit(1);
}
echo "All MFA logic checks passed\n";
