<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/ai_test_functions.php';

catn8_session_start();
catn8_require_admin();
catn8_require_method('POST');

$body = catn8_read_json_body();
$mode = strtolower(trim((string)($body['mode'] ?? 'chat')));
$provider = strtolower(trim((string)($body['provider'] ?? 'openai')));
$baseUrl = trim((string)($body['base_url'] ?? ''));
$secrets = $body['secrets'] ?? [];

if ($mode !== 'chat' && $mode !== 'image') {
    catn8_json_response(['success' => false, 'error' => 'Invalid mode'], 400);
}

if (!is_array($secrets)) {
    catn8_json_response(['success' => false, 'error' => 'Invalid secrets'], 400);
}

$catalog = [
    'chat' => [
        'openai' => [
            ['value' => 'gpt-4o-mini', 'label' => 'gpt-4o-mini'],
            ['value' => 'gpt-4o', 'label' => 'gpt-4o'],
            ['value' => 'gpt-5.2-low', 'label' => 'gpt-5.2-low (low reasoning)'],
        ],
        'anthropic' => [
            ['value' => 'claude-3-5-sonnet-latest', 'label' => 'claude-3-5-sonnet-latest'],
            ['value' => 'claude-3-5-haiku-latest', 'label' => 'claude-3-5-haiku-latest'],
        ],
        'google_ai_studio' => [
            ['value' => 'gemini-2.0-flash-001', 'label' => 'gemini-2.0-flash-001'],
            ['value' => 'gemini-2.5-flash', 'label' => 'gemini-2.5-flash'],
            ['value' => 'gemini-2.5-pro', 'label' => 'gemini-2.5-pro'],
        ],
        'google_vertex_ai' => [
            ['value' => 'publishers/google/models/gemini-2.0-flash-001', 'label' => 'publishers/google/models/gemini-2.0-flash-001'],
            ['value' => 'publishers/google/models/gemini-2.5-flash', 'label' => 'publishers/google/models/gemini-2.5-flash'],
            ['value' => 'publishers/google/models/gemini-2.5-pro', 'label' => 'publishers/google/models/gemini-2.5-pro'],
        ],
        'azure_openai' => [
            ['value' => 'gpt-4o-mini', 'label' => 'gpt-4o-mini (Azure deployment)'],
            ['value' => 'gpt-4o', 'label' => 'gpt-4o (Azure deployment)'],
            ['value' => 'gpt-5.2-low', 'label' => 'gpt-5.2-low (Azure deployment)'],
        ],
        'aws_bedrock' => [
            ['value' => 'anthropic.claude-3-5-sonnet-20240620-v1:0', 'label' => 'anthropic.claude-3-5-sonnet-20240620-v1:0'],
            ['value' => 'anthropic.claude-3-5-haiku-20241022-v1:0', 'label' => 'anthropic.claude-3-5-haiku-20241022-v1:0'],
        ],
        'together_ai' => [
            ['value' => 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', 'label' => 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'],
            ['value' => 'mistralai/Mixtral-8x7B-Instruct-v0.1', 'label' => 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
        ],
        'fireworks_ai' => [
            ['value' => 'accounts/fireworks/models/llama-v3p1-70b-instruct', 'label' => 'accounts/fireworks/models/llama-v3p1-70b-instruct'],
            ['value' => 'accounts/fireworks/models/qwen2p5-72b-instruct', 'label' => 'accounts/fireworks/models/qwen2p5-72b-instruct'],
        ],
        'huggingface' => [
            ['value' => 'meta-llama/Llama-3.1-70B-Instruct', 'label' => 'meta-llama/Llama-3.1-70B-Instruct'],
            ['value' => 'mistralai/Mistral-7B-Instruct-v0.3', 'label' => 'mistralai/Mistral-7B-Instruct-v0.3'],
        ],
    ],
    'image' => [
        'openai' => [
            ['value' => 'gpt-image-1', 'label' => 'gpt-image-1'],
            ['value' => 'dall-e-3', 'label' => 'dall-e-3'],
            ['value' => 'dall-e-2', 'label' => 'dall-e-2'],
        ],
        'azure_openai' => [
            ['value' => 'gpt-image-1', 'label' => 'gpt-image-1 (Azure deployment)'],
            ['value' => 'dall-e-3', 'label' => 'dall-e-3 (Azure deployment)'],
        ],
        'google_vertex_ai' => [
            ['value' => 'imagen-3.0-generate-001', 'label' => 'imagen-3.0-generate-001'],
            ['value' => 'imagen-3.0-fast-generate-001', 'label' => 'imagen-3.0-fast-generate-001'],
            ['value' => 'imagen-2.0-generate-001', 'label' => 'imagen-2.0-generate-001'],
        ],
        'aws_bedrock' => [
            ['value' => 'amazon.titan-image-generator-v2:0', 'label' => 'amazon.titan-image-generator-v2:0'],
            ['value' => 'amazon.titan-image-generator-v1', 'label' => 'amazon.titan-image-generator-v1'],
            ['value' => 'stability.stable-diffusion-xl-v1', 'label' => 'stability.stable-diffusion-xl-v1'],
        ],
        'stability_ai' => [
            ['value' => 'stable-image-ultra', 'label' => 'stable-image-ultra'],
            ['value' => 'stable-image-core', 'label' => 'stable-image-core'],
            ['value' => 'stable-diffusion-3-large', 'label' => 'stable-diffusion-3-large'],
        ],
        'replicate' => [
            ['value' => 'black-forest-labs/flux-1.1-pro', 'label' => 'black-forest-labs/flux-1.1-pro'],
            ['value' => 'black-forest-labs/flux-1.1-pro-ultra', 'label' => 'black-forest-labs/flux-1.1-pro-ultra'],
            ['value' => 'stability-ai/stable-diffusion-3', 'label' => 'stability-ai/stable-diffusion-3'],
        ],
        'together_ai' => [
            ['value' => 'black-forest-labs/FLUX.1-schnell', 'label' => 'black-forest-labs/FLUX.1-schnell'],
            ['value' => 'black-forest-labs/FLUX.1.1-pro', 'label' => 'black-forest-labs/FLUX.1.1-pro'],
        ],
        'fireworks_ai' => [
            ['value' => 'playground-v2.5-1024px-aesthetic', 'label' => 'playground-v2.5-1024px-aesthetic'],
            ['value' => 'stable-diffusion-xl-1024-v1-0', 'label' => 'stable-diffusion-xl-1024-v1-0'],
        ],
        'huggingface' => [
            ['value' => 'black-forest-labs/FLUX.1-schnell', 'label' => 'black-forest-labs/FLUX.1-schnell'],
            ['value' => 'stabilityai/stable-diffusion-3.5-large', 'label' => 'stabilityai/stable-diffusion-3.5-large'],
        ],
    ],
];

$fallback = $catalog[$mode][$provider] ?? [];

$resolveApiKey = static function () use ($mode, $provider, $secrets): string {
    $inlineKey = trim((string)($secrets['api_key'] ?? ''));
    if ($inlineKey !== '') {
        return $inlineKey;
    }

    if ($mode === 'chat') {
        $saved = secret_get(catn8_settings_ai_secret_key($provider, 'api_key'));
    } else {
        $saved = secret_get(catn8_settings_ai_image_secret_key($provider, 'api_key'));
    }

    return is_string($saved) ? trim($saved) : '';
};

if ($provider !== 'openai') {
    catn8_json_response([
        'success' => true,
        'source' => 'catalog',
        'models' => $fallback,
    ]);
}

$apiKey = $resolveApiKey();
if ($apiKey === '') {
    catn8_json_response([
        'success' => true,
        'source' => 'catalog',
        'models' => $fallback,
    ]);
}

$host = $baseUrl !== '' ? catn8_validate_external_base_url($baseUrl) : 'https://api.openai.com';
$url = rtrim($host, '/') . '/v1/models';

try {
    $res = catn8_http_json_with_status('GET', $url, ['Authorization' => 'Bearer ' . $apiKey], null, 10, 30);
    $status = (int)($res['status'] ?? 0);
    $json = is_array($res['json']) ? $res['json'] : [];

    if ($status < 200 || $status > 299 || !isset($json['data']) || !is_array($json['data'])) {
        catn8_json_response([
            'success' => true,
            'source' => 'catalog',
            'models' => $fallback,
        ]);
    }

    $models = [];
    foreach ($json['data'] as $item) {
        if (!is_array($item)) {
            continue;
        }
        $id = trim((string)($item['id'] ?? ''));
        if ($id === '') {
            continue;
        }

        $idLower = strtolower($id);
        if ($mode === 'image') {
            $isImageModel = strpos($idLower, 'image') !== false || strpos($idLower, 'dall-e') !== false;
            if (!$isImageModel) {
                continue;
            }
        } else {
            $isChatModel = strpos($idLower, 'gpt') === 0 || strpos($idLower, 'o1') === 0 || strpos($idLower, 'o3') === 0 || strpos($idLower, 'o4') === 0;
            if (!$isChatModel) {
                continue;
            }
        }

        $models[$id] = ['value' => $id, 'label' => $id];
    }

    if (!$models) {
        catn8_json_response([
            'success' => true,
            'source' => 'catalog',
            'models' => $fallback,
        ]);
    }

    ksort($models, SORT_NATURAL | SORT_FLAG_CASE);

    catn8_json_response([
        'success' => true,
        'source' => 'live',
        'models' => array_values($models),
    ]);
} catch (Throwable $e) {
    catn8_json_response([
        'success' => true,
        'source' => 'catalog',
        'models' => $fallback,
    ]);
}
