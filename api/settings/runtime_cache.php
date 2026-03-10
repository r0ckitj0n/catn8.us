<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_session_start();
catn8_require_admin();

$action = strtolower(trim((string)($_GET['action'] ?? 'status')));

if ($action === 'status') {
    catn8_json_response([
        'success' => true,
        'opcache_available' => function_exists('opcache_get_status'),
        'apcu_available' => function_exists('apcu_enabled') && apcu_enabled(),
    ]);
}

if ($action === 'reset') {
    catn8_require_method('POST');
    catn8_require_csrf();

    $opcacheReset = function_exists('opcache_reset') ? (bool)opcache_reset() : false;
    $apcuCleared = false;
    if (function_exists('apcu_enabled') && apcu_enabled() && function_exists('apcu_clear_cache')) {
        $apcuCleared = (bool)apcu_clear_cache();
    }

    catn8_json_response([
        'success' => true,
        'opcache_reset' => $opcacheReset,
        'apcu_cleared' => $apcuCleared,
    ]);
}

catn8_json_response(['success' => false, 'error' => 'Unknown action'], 400);
