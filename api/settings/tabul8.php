<?php

declare(strict_types=1);

/**
 * Admin settings for Tabul8 OpenAI labeling.
 * Secrets stay in encrypted secret store; API never returns the full key.
 */
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../includes/tabul8_ai_label.php';

catn8_session_start();
catn8_require_admin();

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$action = trim((string)($_GET['action'] ?? 'get'));

if ($method === 'GET') {
    catn8_json_response([
        'success' => true,
        'settings' => Tabul8AiLabel::getPublicSettings(),
    ]);
}

if ($method !== 'POST') {
    catn8_json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

catn8_require_csrf();
$body = catn8_read_json_body();
$action = trim((string)($body['action'] ?? $action));

try {
    if ($action === 'test' || $action === 'test_connection') {
        $result = Tabul8AiLabel::testConnection();
        catn8_json_response([
            'success' => !empty($result['ok']),
            'test' => $result,
            'settings' => Tabul8AiLabel::getPublicSettings(),
        ], !empty($result['ok']) ? 200 : 400);
    }

    if ($action === 'clear_key') {
        if (!Tabul8AiLabel::clearApiKey()) {
            catn8_json_response(['success' => false, 'error' => 'Failed to clear API key'], 500);
        }
        catn8_json_response([
            'success' => true,
            'settings' => Tabul8AiLabel::getPublicSettings(),
        ]);
    }

    if ($action === 'save' || $action === '' || $action === 'get') {
        // Optional key rotation — only when a non-empty new key is posted.
        $apiKey = trim((string)($body['api_key'] ?? ''));
        if ($apiKey !== '') {
            // Reject obvious placeholders; never log the value.
            if (strlen($apiKey) < 20) {
                catn8_json_response(['success' => false, 'error' => 'API key looks too short'], 400);
            }
            if (!Tabul8AiLabel::setApiKey($apiKey)) {
                catn8_json_response(['success' => false, 'error' => 'Failed to store API key'], 500);
            }
        }

        $settings = Tabul8AiLabel::saveSettings($body);
        catn8_json_response([
            'success' => true,
            'settings' => $settings,
        ]);
    }

    catn8_json_response(['success' => false, 'error' => 'Unknown action'], 400);
} catch (Throwable $e) {
    catn8_log_error('tabul8 settings error', ['error' => $e->getMessage()]);
    catn8_json_response(['success' => false, 'error' => 'Server error'], 500);
}
