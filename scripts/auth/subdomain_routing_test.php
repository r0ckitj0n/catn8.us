<?php

declare(strict_types=1);

/**
 * Unit-style checks for product subdomain helpers (no DB / no network).
 *
 * Usage: php scripts/auth/subdomain_routing_test.php
 */

$root = dirname(__DIR__, 2);
require_once $root . '/includes/subdomains.php';

$failures = 0;

function subdomain_test_assert(bool $cond, string $message): void
{
    global $failures;
    if ($cond) {
        echo "PASS  {$message}\n";
        return;
    }
    $failures++;
    echo "FAIL  {$message}\n";
}

// Isolate request globals per case.
function with_request(array $server, callable $fn): void
{
    $backup = $_SERVER;
    $_SERVER = array_merge($_SERVER, $server);
    try {
        $fn();
    } finally {
        $_SERVER = $backup;
    }
}

with_request(['HTTP_HOST' => 'medic8.catn8.us', 'REQUEST_URI' => '/med-list', 'HTTPS' => 'on'], static function (): void {
    subdomain_test_assert(catn8_request_subsite_slug() === 'medic8', 'medic8 host maps to medic8 slug');
    subdomain_test_assert(catn8_logical_request_path() === '/medic8/med-list', 'medic8 /med-list becomes logical /medic8/med-list');
    subdomain_test_assert(catn8_subsite_login_redirect_path('medic8', '/') === '/', 'login redirect on medic8 host is /');
    subdomain_test_assert(catn8_cookie_domain() === '.catn8.us', 'cookie domain is .catn8.us on live host');
    subdomain_test_assert(catn8_is_trusted_web_origin('https://medic8.catn8.us') === true, 'medic8 origin trusted');
    subdomain_test_assert(catn8_is_trusted_web_origin('https://evil.example') === false, 'foreign origin rejected');
    subdomain_test_assert(catn8_is_trusted_web_origin('https://evil.catn8.us') === false, 'unknown catn8 label rejected');
});

with_request(['HTTP_HOST' => 'catn8.us', 'REQUEST_URI' => '/accumul8/', 'HTTPS' => 'on'], static function (): void {
    subdomain_test_assert(catn8_request_subsite_slug() === null, 'apex has no subsite slug');
    subdomain_test_assert(catn8_logical_request_path() === '/accumul8/', 'apex path unchanged');
    subdomain_test_assert(catn8_subsite_login_redirect_path('accumul8', '/') === '/accumul8/', 'apex login redirect keeps path');
    subdomain_test_assert(catn8_force_subdomain_redirects_enabled() === false, 'force redirects default off');
    subdomain_test_assert(catn8_maybe_force_subdomain_redirect_url() === null, 'no force redirect when flag off');
});

with_request(['HTTP_HOST' => 'sheriff-station.catn8.us', 'REQUEST_URI' => '/', 'HTTPS' => 'on'], static function (): void {
    subdomain_test_assert(catn8_request_subsite_slug() === 'sheriff_station', 'sheriff-station DNS maps to sheriff_station path');
    subdomain_test_assert(catn8_logical_request_path() === '/sheriff_station/', 'sheriff-station root logical path');
});

with_request(['HTTP_HOST' => 'photo-m8.catn8.us', 'REQUEST_URI' => '/api/auth/csrf.php', 'HTTPS' => 'on'], static function (): void {
    subdomain_test_assert(catn8_logical_request_path() === '/api/auth/csrf.php', 'shared /api path not prefixed on product host');
});

with_request(['HTTP_HOST' => 'celebr8.catn8.us', 'REQUEST_URI' => '/party/12', 'HTTPS' => 'on'], static function (): void {
    subdomain_test_assert(catn8_logical_request_path() === '/celebr8/party/12', 'celebr8 deep path prefixed');
});

putenv('CATN8_FORCE_SUBDOMAIN_REDIRECTS=1');
$_ENV['CATN8_FORCE_SUBDOMAIN_REDIRECTS'] = '1';
$_SERVER['CATN8_FORCE_SUBDOMAIN_REDIRECTS'] = '1';
with_request(['HTTP_HOST' => 'catn8.us', 'REQUEST_URI' => '/medic8/med-list?person_id=3', 'HTTPS' => 'on'], static function (): void {
    subdomain_test_assert(catn8_force_subdomain_redirects_enabled() === true, 'force redirects enabled via env');
    $url = catn8_maybe_force_subdomain_redirect_url();
    subdomain_test_assert($url === 'https://medic8.catn8.us/med-list?person_id=3', 'force redirect strips slug onto product host: ' . (string)$url);
});
putenv('CATN8_FORCE_SUBDOMAIN_REDIRECTS=0');
$_ENV['CATN8_FORCE_SUBDOMAIN_REDIRECTS'] = '0';

$expectedSlugs = [
    'elucid8', 'activ8', 'recre8', 'illumin8', 'stimul8', 'narr8', 'loc8',
    'investig8', 'sheriff_station', 'fabric8', 'photo-m8', 'accumul8', 'valid8',
    'celebr8', 'tabul8', 'medic8', 'litig8',
];
subdomain_test_assert(catn8_subsite_path_slugs() === $expectedSlugs, 'subsite slug inventory matches routes');

if ($failures > 0) {
    fwrite(STDERR, "\n{$failures} subdomain routing assertion(s) failed\n");
    exit(1);
}

echo "\nAll subdomain routing checks passed\n";
exit(0);
