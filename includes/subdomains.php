<?php

declare(strict_types=1);

/**
 * Product sub-site host routing for *.catn8.us.
 *
 * DNS labels map onto the existing path slugs. Path URLs on the apex host
 * remain canonical until CATN8_FORCE_SUBDOMAIN_REDIRECTS is enabled.
 */

/** Apex cookie / Origin parent domain (no leading dot). */
const CATN8_PARENT_DOMAIN = 'catn8.us';

/**
 * DNS subdomain label => path slug used by .htaccess / PHP entries.
 * Labels use hyphens only (DNS-safe); path slugs may use underscores.
 *
 * @return array<string, string>
 */
function catn8_subsite_dns_map(): array
{
    return [
        'elucid8' => 'elucid8',
        'activ8' => 'activ8',
        'recre8' => 'recre8',
        'illumin8' => 'illumin8',
        'stimul8' => 'stimul8',
        'narr8' => 'narr8',
        'loc8' => 'loc8',
        'investig8' => 'investig8',
        'sheriff-station' => 'sheriff_station',
        'fabric8' => 'fabric8',
        'photo-m8' => 'photo-m8',
        'accumul8' => 'accumul8',
        'valid8' => 'valid8',
        'celebr8' => 'celebr8',
        'tabul8' => 'tabul8',
        'medic8' => 'medic8',
        'litig8' => 'litig8',
    ];
}

/**
 * @return list<string>
 */
function catn8_subsite_path_slugs(): array
{
    return array_values(array_unique(array_values(catn8_subsite_dns_map())));
}

function catn8_request_host(): string
{
    $host = strtolower(trim((string)($_SERVER['HTTP_HOST'] ?? '')));
    if ($host === '') {
        return CATN8_PARENT_DOMAIN;
    }
    // Strip port for allowlist / cookie decisions.
    if (str_contains($host, ':')) {
        $host = explode(':', $host, 2)[0];
    }
    return $host;
}

function catn8_is_catn8_parent_host(string $host): bool
{
    $host = strtolower(trim($host));
    return $host === CATN8_PARENT_DOMAIN || $host === 'www.' . CATN8_PARENT_DOMAIN;
}

function catn8_is_trusted_catn8_host(string $host): bool
{
    $host = strtolower(trim($host));
    if ($host === '') {
        return false;
    }
    if (str_contains($host, ':')) {
        $host = explode(':', $host, 2)[0];
    }
    if (catn8_is_catn8_parent_host($host)) {
        return true;
    }
    $suffix = '.' . CATN8_PARENT_DOMAIN;
    if (!str_ends_with($host, $suffix)) {
        return false;
    }
    $label = substr($host, 0, -strlen($suffix));
    if ($label === '' || str_contains($label, '.')) {
        // Only single-label product hosts (no nested multi-tenant hosts).
        return false;
    }
    $map = catn8_subsite_dns_map();
    return isset($map[$label]);
}

function catn8_request_subsite_dns_label(): ?string
{
    $host = catn8_request_host();
    $suffix = '.' . CATN8_PARENT_DOMAIN;
    if (!str_ends_with($host, $suffix)) {
        return null;
    }
    $label = substr($host, 0, -strlen($suffix));
    if ($label === '' || $label === 'www' || str_contains($label, '.')) {
        return null;
    }
    $map = catn8_subsite_dns_map();
    return isset($map[$label]) ? $label : null;
}

function catn8_request_subsite_slug(): ?string
{
    $label = catn8_request_subsite_dns_label();
    if ($label === null) {
        return null;
    }
    return catn8_subsite_dns_map()[$label] ?? null;
}

function catn8_force_subdomain_redirects_enabled(): bool
{
    $raw = '';
    if (function_exists('catn8_env')) {
        $raw = strtolower(trim((string)catn8_env('CATN8_FORCE_SUBDOMAIN_REDIRECTS', '0')));
    } else {
        $raw = strtolower(trim((string)(getenv('CATN8_FORCE_SUBDOMAIN_REDIRECTS') ?: '0')));
    }
    return in_array($raw, ['1', 'true', 'yes', 'on'], true);
}

/**
 * Session / MFA cookie Domain attribute.
 * Empty on local hosts so cookies stay host-only during HTTP dev.
 */
function catn8_cookie_domain(): string
{
    if (function_exists('catn8_is_local_request') && catn8_is_local_request()) {
        return '';
    }
    $host = catn8_request_host();
    if (catn8_is_trusted_catn8_host($host) || catn8_is_catn8_parent_host($host)) {
        return '.' . CATN8_PARENT_DOMAIN;
    }
    return '';
}

function catn8_apex_origin(): string
{
    return 'https://' . CATN8_PARENT_DOMAIN;
}

/**
 * Parse an Origin or Referer URL and return host if it is a trusted catn8 host.
 */
function catn8_trusted_web_origin_host(string $url): ?string
{
    $url = trim($url);
    if ($url === '') {
        return null;
    }
    $parts = parse_url($url);
    if (!is_array($parts)) {
        return null;
    }
    $scheme = strtolower((string)($parts['scheme'] ?? ''));
    $host = strtolower((string)($parts['host'] ?? ''));
    if ($host === '') {
        return null;
    }
    if (function_exists('catn8_is_local_request') && catn8_is_local_request()) {
        if (!in_array($scheme, ['http', 'https'], true)) {
            return null;
        }
        $reqHost = catn8_request_host();
        // Dev allowlist: same request host or private LAN ranges only.
        if (
            $host === $reqHost
            || str_starts_with($host, '192.168.')
            || str_starts_with($host, '10.')
        ) {
            return $host;
        }
        return null;
    }
    if ($scheme !== 'https') {
        return null;
    }
    return catn8_is_trusted_catn8_host($host) ? $host : null;
}

function catn8_is_trusted_web_origin(string $url): bool
{
    return catn8_trusted_web_origin_host($url) !== null;
}

/**
 * Browser Origin/Referer gate for cookie-session mutations.
 * Missing both headers is allowed (non-browser / same-origin oddities);
 * a present but untrusted Origin/Referer is rejected.
 */
function catn8_request_has_trusted_browser_origin(): bool
{
    $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin !== '') {
        return catn8_is_trusted_web_origin($origin);
    }
    $referer = trim((string)($_SERVER['HTTP_REFERER'] ?? ''));
    if ($referer !== '') {
        return catn8_is_trusted_web_origin($referer);
    }
    return true;
}

/**
 * Explicit CORS allowlist helper. Only emit headers for trusted *.catn8.us Origins.
 * Callers should not use wildcard origins.
 *
 * @return array{origin: string, headers: array<string, string>}|null
 */
function catn8_cors_allowlist_headers(): ?array
{
    $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin === '' || !catn8_is_trusted_web_origin($origin)) {
        return null;
    }
    return [
        'origin' => $origin,
        'headers' => [
            'Access-Control-Allow-Origin' => $origin,
            'Access-Control-Allow-Credentials' => 'true',
            'Access-Control-Allow-Headers' => 'Content-Type, X-CATN8-CSRF, X-Api-Key, Authorization',
            'Access-Control-Allow-Methods' => 'GET, POST, PUT, DELETE, OPTIONS',
            'Vary' => 'Origin',
        ],
    ];
}

/**
 * Shared infrastructure paths that must not be prefixed with a subsite slug.
 */
function catn8_is_shared_site_path(string $path): bool
{
    $path = strtolower($path);
    if ($path === '/' || $path === '') {
        return false;
    }
    $sharedPrefixes = [
        '/api/',
        '/dist/',
        '/images/',
        '/css/',
        '/assets/',
        '/emojis/',
        '/vendor/',
        '/login',
        '/settings',
        '/verify',
        '/reset',
        '/favicon',
        '/android-chrome',
        '/apple-touch',
        '/robots.txt',
        '/sitemap',
        '/hot',
    ];
    foreach ($sharedPrefixes as $prefix) {
        if (str_starts_with($path, $prefix) || $path === rtrim($prefix, '/')) {
            return true;
        }
    }
    return false;
}

/**
 * Logical apex-style path for the current request.
 * On medic8.catn8.us/med-list → /medic8/med-list
 * On catn8.us/medic8/med-list → /medic8/med-list
 */
function catn8_logical_request_path(?string $requestUri = null): string
{
    $uri = $requestUri ?? (string)($_SERVER['REQUEST_URI'] ?? '/');
    $path = (string)(parse_url($uri, PHP_URL_PATH) ?: '/');
    if ($path === '') {
        $path = '/';
    }

    $slug = catn8_request_subsite_slug();
    if ($slug === null || catn8_is_shared_site_path($path)) {
        return $path;
    }

    $prefix = '/' . $slug;
    if ($path === $prefix || str_starts_with($path, $prefix . '/')) {
        return $path;
    }
    if ($path === '/') {
        return $prefix . '/';
    }
    return $prefix . $path;
}

/**
 * Login redirect target that stays correct on both apex paths and product hosts.
 * On accumul8.catn8.us → / (site root is the product).
 * On catn8.us → /accumul8/ (path URL).
 */
function catn8_subsite_login_redirect_path(string $slug, string $suffix = '/'): string
{
    $slug = trim($slug, '/');
    $suffix = $suffix === '' ? '/' : $suffix;
    if ($suffix[0] !== '/') {
        $suffix = '/' . $suffix;
    }

    $current = catn8_request_subsite_slug();
    if ($current !== null && $current === $slug) {
        // Already on the product host: keep a relative deep path without re-prefixing.
        if ($suffix === '/' || $suffix === '') {
            return '/';
        }
        // suffix like /med-list or /party/1
        return $suffix;
    }

    if ($suffix === '/') {
        return '/' . $slug . '/';
    }
    return '/' . $slug . $suffix;
}

/**
 * Absolute public URL for a path, host-aware (current request host on live).
 */
function catn8_public_url(string $path = '/'): string
{
    $path = trim($path);
    if ($path === '' || $path[0] !== '/') {
        $path = '/' . ltrim($path, '/');
    }
    if (function_exists('catn8_safe_internal_redirect_target')) {
        $path = catn8_safe_internal_redirect_target($path, '/');
    }
    $origin = function_exists('catn8_public_origin') ? catn8_public_origin() : catn8_apex_origin();
    return rtrim($origin, '/') . $path;
}

/**
 * Optional apex-path → product-subdomain 301 when the config flag is on.
 * Returns the Location URL or null when no redirect should happen.
 */
function catn8_maybe_force_subdomain_redirect_url(?string $requestUri = null): ?string
{
    if (!catn8_force_subdomain_redirects_enabled()) {
        return null;
    }
    if (catn8_request_subsite_slug() !== null) {
        return null;
    }
    if (!catn8_is_catn8_parent_host(catn8_request_host()) && !(function_exists('catn8_is_local_request') && catn8_is_local_request())) {
        // Only redirect from the apex (or local simulation).
        if (catn8_request_host() !== CATN8_PARENT_DOMAIN && catn8_request_host() !== 'www.' . CATN8_PARENT_DOMAIN) {
            return null;
        }
    }

    $uri = $requestUri ?? (string)($_SERVER['REQUEST_URI'] ?? '/');
    $path = (string)(parse_url($uri, PHP_URL_PATH) ?: '/');
    $query = parse_url($uri, PHP_URL_QUERY);
    $querySuffix = is_string($query) && $query !== '' ? ('?' . $query) : '';

    $dnsMap = catn8_subsite_dns_map();
    $pathToDns = array_flip($dnsMap);

    foreach (catn8_subsite_path_slugs() as $slug) {
        $prefix = '/' . $slug;
        if ($path === $prefix || $path === $prefix . '/' || str_starts_with($path, $prefix . '/')) {
            $dnsLabel = $pathToDns[$slug] ?? $slug;
            $rest = substr($path, strlen($prefix));
            if ($rest === false || $rest === '') {
                $rest = '/';
            }
            $scheme = (function_exists('catn8_request_is_https') && catn8_request_is_https()) ? 'https' : 'http';
            if (!(function_exists('catn8_is_local_request') && catn8_is_local_request())) {
                $scheme = 'https';
            }
            return $scheme . '://' . $dnsLabel . '.' . CATN8_PARENT_DOMAIN . $rest . $querySuffix;
        }
    }
    return null;
}
