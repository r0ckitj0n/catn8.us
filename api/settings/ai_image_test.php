<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../includes/diagnostics_log.php';
require_once __DIR__ . '/ai_test_functions.php';

catn8_session_start();
catn8_require_admin();

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($method !== 'GET' && $method !== 'POST') {
    catn8_json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}
if ($method === 'POST') {
    catn8_require_csrf();
}

$body = $method === 'POST' ? catn8_read_json_body() : [];
$cfg = $method === 'GET' ? catn8_settings_ai_image_get_config() : [];

$provider = strtolower(trim((string)($body['provider'] ?? $cfg['provider'] ?? 'openai')));
$model = trim((string)($body['model'] ?? $cfg['model'] ?? 'gpt-image-1'));
$baseUrl = trim((string)($body['base_url'] ?? $cfg['base_url'] ?? ''));
$providerConfig = $body['provider_config'] ?? ($cfg['provider_config'] ?? []);
$params = $body['params'] ?? ($cfg['params'] ?? []);
$secrets = $body['secrets'] ?? [];

if (!is_array($providerConfig)) {
    catn8_json_response(['success' => false, 'error' => 'Invalid provider_config'], 400);
}
if (!is_array($params)) {
    catn8_json_response(['success' => false, 'error' => 'Invalid params'], 400);
}
if (!is_array($secrets)) {
    catn8_json_response(['success' => false, 'error' => 'Invalid secrets'], 400);
}

$meta = [
    'provider' => $provider,
    'model' => $model,
];

$fail = static function (int $status, string $error, array $moreMeta = []) use ($meta): void {
    catn8_diagnostics_log_event('settings.ai_image.test', false, $status, $error, $moreMeta + $meta);
    catn8_json_response(['success' => false, 'error' => $error], $status);
};

$prompt = 'Connectivity test image. Return a simple result.';

if ($method === 'POST' && $provider === 'openai') {
    try {
        $draftApiKey = trim((string)($secrets['api_key'] ?? ''));
        if ($draftApiKey === '') {
            $saved = secret_get(catn8_settings_ai_image_secret_key($provider, 'api_key'));
            $draftApiKey = is_string($saved) ? trim($saved) : '';
        }

        if ($draftApiKey === '') {
            $fail(400, 'Missing API key');
        }

        $factory = OpenAI::factory()->withApiKey($draftApiKey);
        if ($baseUrl !== '') {
            $factory = $factory->withBaseUri(catn8_validate_external_base_url($baseUrl));
        }
        $client = $factory->make();

        $payload = array_merge(['model' => ($model !== '' ? $model : 'gpt-image-1'), 'prompt' => $prompt], $params);
        $payload['n'] = 1;
        if (!isset($payload['response_format'])) {
            $payload['response_format'] = 'b64_json';
        }

        $resp = $client->images()->create($payload);
        $sample = '';
        if (isset($resp->data[0]->b64_json)) {
            $sample = (string)$resp->data[0]->b64_json;
        } elseif (isset($resp->data[0]->url)) {
            $sample = (string)$resp->data[0]->url;
        }
        if (trim($sample) === '') {
            $fail(500, 'Image provider test did not return image data');
        }

        catn8_json_response([
            'success' => true,
            'ai_image' => $meta,
            'sample' => 'OK',
        ]);
    } catch (Throwable $e) {
        $fail(500, 'AI image provider test failed: ' . $e->getMessage());
    }
}

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
