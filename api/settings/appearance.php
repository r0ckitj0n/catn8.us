<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_session_start();
catn8_require_admin();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

$defaults = [
    'brand_primary' => '#9b59b6',
    'brand_secondary' => '#2ecc71',
    'action_fg' => '#ffffff',
];

$key = catn8_secret_key('appearance.tokens');

if ($method === 'GET') {
    $raw = secret_get($key);
    $tokens = [];
    if (is_string($raw) && $raw !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) $tokens = $decoded;
    }

    $out = [
        'brand_primary' => (string)($tokens['brand_primary'] ?? $defaults['brand_primary']),
        'brand_secondary' => (string)($tokens['brand_secondary'] ?? $defaults['brand_secondary']),
        'action_fg' => (string)($tokens['action_fg'] ?? $defaults['action_fg']),
    ];

    catn8_json_response(['success' => true, 'tokens' => $out]);
}

if ($method !== 'POST') {
    catn8_json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

$body = catn8_read_json_body();

$tokens = [
    'brand_primary' => (string)($body['brand_primary'] ?? $defaults['brand_primary']),
    'brand_secondary' => (string)($body['brand_secondary'] ?? $defaults['brand_secondary']),
    'action_fg' => (string)($body['action_fg'] ?? $defaults['action_fg']),
];

secret_set($key, json_encode($tokens));

catn8_json_response(['success' => true, 'tokens' => $tokens]);
