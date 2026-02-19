<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_session_start();
$viewerId = catn8_require_group_or_admin('wordsearch-users');

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

$defaults = [
    'grid_size' => 12,
    'difficulty' => 'easy',
    'quick_facts_enabled' => 1,
    'quick_facts_sentences' => 2,
    'quick_facts_style' => 'gentle',
];

$keyDefaults = catn8_secret_key('wordsearch.defaults');

$loadGlobalDefaults = static function () use ($keyDefaults, $defaults): array {
    $raw = secret_get($keyDefaults);
    $cfg = [];
    if (is_string($raw) && $raw !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) $cfg = $decoded;
    }

    $grid = (int)($cfg['grid_size'] ?? $defaults['grid_size']);
    if ($grid < 8) $grid = 8;
    if ($grid > 30) $grid = 30;

    $diff = strtolower(trim((string)($cfg['difficulty'] ?? $defaults['difficulty'])));
    if ($diff !== 'easy' && $diff !== 'medium' && $diff !== 'hard') $diff = $defaults['difficulty'];

    $qEnabled = (int)($cfg['quick_facts_enabled'] ?? $defaults['quick_facts_enabled']);
    $qEnabled = ($qEnabled === 0) ? 0 : 1;

    $qSent = (int)($cfg['quick_facts_sentences'] ?? $defaults['quick_facts_sentences']);
    if ($qSent < 1) $qSent = 1;
    if ($qSent > 6) $qSent = 6;

    $qStyle = strtolower(trim((string)($cfg['quick_facts_style'] ?? $defaults['quick_facts_style'])));
    if ($qStyle === '') $qStyle = (string)$defaults['quick_facts_style'];

    return [
        'grid_size' => $grid,
        'difficulty' => $diff,
        'quick_facts_enabled' => $qEnabled,
        'quick_facts_sentences' => $qSent,
        'quick_facts_style' => $qStyle,
    ];
};

$loadUserOverrides = static function (): array {
    $cfg = $_SESSION['catn8_wordsearch_settings'] ?? [];
    return is_array($cfg) ? $cfg : [];
};

$mergeSettings = static function (array $global, array $user, array $defaults): array {
    $grid = (int)($user['grid_size'] ?? $global['grid_size'] ?? $defaults['grid_size']);
    if ($grid < 8) $grid = 8;
    if ($grid > 30) $grid = 30;

    $diff = strtolower(trim((string)($user['difficulty'] ?? $global['difficulty'] ?? $defaults['difficulty'])));
    if ($diff !== 'easy' && $diff !== 'medium' && $diff !== 'hard') $diff = $defaults['difficulty'];

    $qEnabled = (int)($user['quick_facts_enabled'] ?? $global['quick_facts_enabled'] ?? $defaults['quick_facts_enabled']);
    $qEnabled = ($qEnabled === 0) ? 0 : 1;

    $qSent = (int)($user['quick_facts_sentences'] ?? $global['quick_facts_sentences'] ?? $defaults['quick_facts_sentences']);
    if ($qSent < 1) $qSent = 1;
    if ($qSent > 6) $qSent = 6;

    $qStyle = strtolower(trim((string)($user['quick_facts_style'] ?? $global['quick_facts_style'] ?? $defaults['quick_facts_style'])));
    if ($qStyle === '') $qStyle = (string)$defaults['quick_facts_style'];

    return [
        'grid_size' => $grid,
        'difficulty' => $diff,
        'quick_facts_enabled' => $qEnabled,
        'quick_facts_sentences' => $qSent,
        'quick_facts_style' => $qStyle,
    ];
};

if ($method === 'GET') {
    $global = $loadGlobalDefaults();
    $user = $loadUserOverrides();
    $settings = $mergeSettings($global, $user, $defaults);

    $uid = catn8_auth_user_id();
    $isAdmin = 0;
    if ($uid !== null) {
        catn8_users_table_ensure();
        $row = Database::queryOne('SELECT is_admin FROM users WHERE id = ?', [$uid]);
        $isAdmin = ($row && (int)($row['is_admin'] ?? 0) === 1) ? 1 : 0;
    }

    catn8_json_response([
        'success' => true,
        'settings' => $settings,
        'global_defaults' => $global,
        'is_admin' => $isAdmin,
    ]);
}

if ($method !== 'POST') {
    catn8_json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

$body = catn8_read_json_body();
$grid = (int)($body['grid_size'] ?? $defaults['grid_size']);
$diff = strtolower(trim((string)($body['difficulty'] ?? $defaults['difficulty'])));

$qEnabled = (int)($body['quick_facts_enabled'] ?? $defaults['quick_facts_enabled']);
$qEnabled = ($qEnabled === 0) ? 0 : 1;

$qSent = (int)($body['quick_facts_sentences'] ?? $defaults['quick_facts_sentences']);
if ($qSent < 1) $qSent = 1;
if ($qSent > 6) $qSent = 6;

$qStyle = strtolower(trim((string)($body['quick_facts_style'] ?? $defaults['quick_facts_style'])));
if ($qStyle === '') $qStyle = (string)$defaults['quick_facts_style'];

if ($grid < 8) $grid = 8;
if ($grid > 30) $grid = 30;
if ($diff !== 'easy' && $diff !== 'medium' && $diff !== 'hard') $diff = $defaults['difficulty'];

$saveGlobal = (int)($body['save_global'] ?? 0) === 1;

if ($saveGlobal) {
    catn8_require_admin();
    $global = [
        'grid_size' => $grid,
        'difficulty' => $diff,
        'quick_facts_enabled' => $qEnabled,
        'quick_facts_sentences' => $qSent,
        'quick_facts_style' => $qStyle,
    ];
    secret_set($keyDefaults, json_encode($global));
    catn8_json_response(['success' => true, 'settings' => $global, 'saved' => 'global']);
}

$_SESSION['catn8_wordsearch_settings'] = [
    'grid_size' => $grid,
    'difficulty' => $diff,
    'quick_facts_enabled' => $qEnabled,
    'quick_facts_sentences' => $qSent,
    'quick_facts_style' => $qStyle,
];
$global = $loadGlobalDefaults();
$settings = $mergeSettings($global, $_SESSION['catn8_wordsearch_settings'], $defaults);
catn8_json_response(['success' => true, 'settings' => $settings, 'saved' => 'session']);
