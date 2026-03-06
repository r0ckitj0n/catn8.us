<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../includes/icon_button_settings.php';

catn8_session_start();
catn8_require_admin();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

if ($method === 'GET') {
    catn8_json_response([
        'success' => true,
        'settings' => catn8_load_icon_button_settings(),
        'emoji_catalog' => catn8_icon_button_emoji_catalog(),
    ]);
}

if ($method !== 'POST') {
    catn8_json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

$body = catn8_read_json_body();
$settings = $body['settings'] ?? null;

if (!is_array($settings)) {
    catn8_json_response(['success' => false, 'error' => 'settings array is required'], 400);
}

$saved = catn8_save_icon_button_settings($settings);

catn8_json_response([
    'success' => true,
    'settings' => $saved,
    'emoji_catalog' => catn8_icon_button_emoji_catalog(),
]);
