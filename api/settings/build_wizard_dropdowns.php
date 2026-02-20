<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_session_start();
catn8_require_admin();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$key = catn8_secret_key('build_wizard.dropdowns');

$defaults = [
    'document_kinds' => ['blueprint', 'document', 'home_photo', 'other', 'permit', 'photo', 'plat', 'receipt', 'site_photo', 'spec_sheet', 'survey'],
    'permit_statuses' => ['', 'approved', 'closed', 'drafting', 'not_started', 'rejected', 'submitted'],
    'purchase_units' => ['', 'box', 'bundle', 'cuft', 'ea', 'ft', 'gal', 'lb', 'roll', 'set', 'sqft'],
];

$normalizeValue = static function ($raw): string {
    $value = strtolower(trim((string)$raw));
    if ($value === '') {
        return '';
    }
    $value = str_replace(['-', ' '], '_', $value);
    $value = preg_replace('/[^a-z0-9_]/', '', $value);
    if (!is_string($value)) {
        return '';
    }
    $value = trim($value, '_');
    return $value;
};

$normalizeList = static function ($rawList, array $fallback, bool $allowLeadingBlank = false) use ($normalizeValue): array {
    if (!is_array($rawList)) {
        $rawList = $fallback;
    }

    $seen = [];
    $out = [];

    foreach ($rawList as $rawValue) {
        $value = $normalizeValue($rawValue);
        if ($value === '') {
            continue;
        }
        if (isset($seen[$value])) {
            continue;
        }
        $seen[$value] = true;
        $out[] = $value;
        if (count($out) >= 50) {
            break;
        }
    }

    if (!$out) {
        foreach ($fallback as $fallbackValue) {
            $value = $normalizeValue($fallbackValue);
            if ($value === '' || isset($seen[$value])) {
                continue;
            }
            $seen[$value] = true;
            $out[] = $value;
        }
    }

    // Keep "plat" available even for older saved settings.
    if (!isset($seen['plat'])) {
        $out[] = 'plat';
        $seen['plat'] = true;
    }

    if ($allowLeadingBlank) {
        array_unshift($out, '');
    }

    return $out;
};

$readSettings = static function () use ($defaults, $key, $normalizeList): array {
    $stored = secret_get($key);
    $decoded = [];
    if (is_string($stored) && trim($stored) !== '') {
        $json = json_decode($stored, true);
        if (is_array($json)) {
            $decoded = $json;
        }
    }

    return [
        'document_kinds' => $normalizeList($decoded['document_kinds'] ?? null, $defaults['document_kinds'], false),
        'permit_statuses' => $normalizeList($decoded['permit_statuses'] ?? null, $defaults['permit_statuses'], true),
        'purchase_units' => $normalizeList($decoded['purchase_units'] ?? null, $defaults['purchase_units'], true),
    ];
};

if ($method === 'GET') {
    catn8_json_response([
        'success' => true,
        'settings' => $readSettings(),
    ]);
}

if ($method !== 'POST') {
    catn8_json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

$body = catn8_read_json_body();
$settings = $body['settings'] ?? null;

if (!is_array($settings)) {
    catn8_json_response(['success' => false, 'error' => 'settings object is required'], 400);
}

$normalized = [
    'document_kinds' => $normalizeList($settings['document_kinds'] ?? null, $defaults['document_kinds'], false),
    'permit_statuses' => $normalizeList($settings['permit_statuses'] ?? null, $defaults['permit_statuses'], true),
    'purchase_units' => $normalizeList($settings['purchase_units'] ?? null, $defaults['purchase_units'], true),
];

secret_set($key, json_encode($normalized));

catn8_json_response([
    'success' => true,
    'settings' => $normalized,
]);
