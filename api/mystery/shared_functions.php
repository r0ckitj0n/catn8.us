<?php
declare(strict_types=1);

/**
 * shared_functions.php - Common utilities for Mystery Admin and Play APIs
 */

/**
 * Loads AI configuration from secrets.
 */
function catn8_mystery_get_ai_config(): array {
    $defaults = [
        'provider' => 'openai',
        'model' => 'gpt-4o-mini',
        'base_url' => '',
        'location' => '',
        'temperature' => 0.2,
        'provider_config' => [],
    ];
    $raw = secret_get(catn8_secret_key('ai.config'));
    $aiCfg = [];
    if (is_string($raw) && trim($raw) !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $aiCfg = $decoded;
        }
    }
    return array_merge($defaults, $aiCfg);
}

/**
 * Returns the secret key for a given provider and name.
 */
function catn8_mystery_ai_secret_key(string $provider, string $name): string {
    $pp = strtolower(trim($provider));
    $nn = strtolower(trim($name));
    if ($pp === '' || $nn === '') {
        throw new RuntimeException('Invalid secret key request');
    }
    return catn8_secret_key('ai.secret.' . $pp . '.' . $nn);
}

function catn8_http_get_binary(string $url, int $timeout = 30): string {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
    $raw = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if (!is_string($raw) || $status >= 400) return '';
    return $raw;
}

if (!function_exists('catn8_mystery_slugify')) {
    /**
     * Converts a string into a URL-friendly slug.
     * Uses a robust implementation for both admin and player needs.
     */
    function catn8_mystery_slugify(string $s): string {
        $s = preg_replace('~[^\pL\d]+~u', '-', $s);
        // Fallback for iconv if not available, but usually it is.
        if (function_exists('iconv')) {
            $s = iconv('utf-8', 'us-ascii//TRANSLIT', $s);
        }
        $s = preg_replace('~[^-\w]+~', '', $s);
        $s = trim($s, '-');
        $s = preg_replace('~-+~', '-', $s);
        $s = strtolower($s);
        
        if (empty($s)) return 'item';
        
        // Truncate to reasonable length
        if (strlen($s) > 96) {
            $s = rtrim(substr($s, 0, 96), '-');
            if ($s === '') return 'item';
        }
        
        return $s;
    }
}

if (!function_exists('catn8_mystery_unique_slug')) {
    /**
     * Generates a unique slug by appending a numeric suffix if needed.
     */
    function catn8_mystery_unique_slug(string $base, callable $exists): string {
        $baseSlug = catn8_mystery_slugify($base);
        $slug = $baseSlug;
        if (!$exists($slug)) return $slug;
        
        $n = 2;
        while (true) {
            $suffix = '-' . (string)$n;
            $maxStem = 96 - strlen($suffix);
            $stem = $baseSlug;
            if (strlen($stem) > $maxStem) {
                $stem = rtrim(substr($stem, 0, $maxStem), '-');
                if ($stem === '') $stem = 'item';
            }
            $candidate = $stem . $suffix;
            if (!$exists($candidate)) return $candidate;
            $n += 1;
            if ($n > 9999) throw new RuntimeException('Unable to generate unique slug');
        }
    }
}
