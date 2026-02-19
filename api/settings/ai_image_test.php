<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../includes/diagnostics_log.php';
require_once __DIR__ . '/ai_test_functions.php';

catn8_session_start();
catn8_require_admin();
catn8_require_method('GET');

$cfg = catn8_settings_ai_image_get_config();
$provider = strtolower(trim((string)$cfg['provider']));
$model = trim((string)$cfg['model']);
$baseUrl = trim((string)$cfg['base_url']);
$providerConfig = $cfg['provider_config'] ?? [];
$params = $cfg['params'] ?? [];

$meta = [
    'provider' => $provider,
    'model' => $model,
];

$fail = static function (int $status, string $error, array $moreMeta = []) use ($meta): void {
    catn8_diagnostics_log_event('settings.ai_image.test', false, $status, $error, $moreMeta + $meta);
    catn8_json_response(['success' => false, 'error' => $error], $status);
};

$prompt = 'Connectivity test image. Return a simple result.';

try {
    if ($provider === 'google_vertex_ai') {
        require __DIR__ . '/ai_image_test_vertex.php';
    } elseif ($provider === 'openai') {
        require __DIR__ . '/ai_image_test_openai.php';
    } elseif ($provider === 'azure_openai') {
        require __DIR__ . '/ai_image_test_azure.php';
    } elseif ($provider === 'together_ai' || $provider === 'fireworks_ai') {
        require __DIR__ . '/ai_image_test_together.php';
    } elseif ($provider === 'stability_ai') {
        require __DIR__ . '/ai_image_test_stability.php';
    } elseif ($provider === 'huggingface') {
        require __DIR__ . '/ai_image_test_huggingface.php';
    } else {
        $fail(400, 'Unsupported AI image provider: ' . $provider);
    }
} catch (Throwable $e) {
    $fail(500, 'AI image provider test failed: ' . $e->getMessage());
}
