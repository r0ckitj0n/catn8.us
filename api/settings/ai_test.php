<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../includes/diagnostics_log.php';
require_once __DIR__ . '/ai_test_functions.php';

catn8_session_start();
catn8_require_admin();
catn8_require_method('GET');

$cfg = catn8_settings_ai_get_config();
$provider = strtolower(trim((string)$cfg['provider']));
$model = trim((string)$cfg['model']);
$baseUrl = trim((string)$cfg['base_url']);
$location = trim((string)$cfg['location']);
$providerConfig = $cfg['provider_config'] ?? [];

$aiMeta = [
    'provider' => $provider,
    'model' => $model,
];

$fail = static function (int $status, string $error, array $meta = []) use ($aiMeta): void {
    catn8_diagnostics_log_event('settings.ai.test', false, $status, $error, $meta + $aiMeta);
    catn8_json_response(['success' => false, 'error' => $error], $status);
};

try {
    $systemPrompt = 'You are a connectivity test.';
    $userPrompt = 'Reply with exactly: OK';

    if ($provider === 'google_vertex_ai') {
        require __DIR__ . '/ai_test_vertex.php';
    } elseif ($provider === 'openai') {
        require __DIR__ . '/ai_test_openai.php';
    } elseif (in_array($provider, ['together_ai', 'fireworks_ai', 'huggingface'])) {
        require __DIR__ . '/ai_test_together.php';
    } elseif ($provider === 'anthropic') {
        require __DIR__ . '/ai_test_anthropic.php';
    } elseif ($provider === 'google_ai_studio') {
        require __DIR__ . '/ai_test_google.php';
    } elseif ($provider === 'azure_openai') {
        require __DIR__ . '/ai_test_azure.php';
    } else {
        $fail(400, 'Unsupported AI provider: ' . $provider);
    }
} catch (Throwable $e) {
    $fail(500, 'AI provider test failed: ' . $e->getMessage());
}
