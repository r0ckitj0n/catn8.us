<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/ai_test_functions.php';
require_once __DIR__ . '/../../includes/google_oauth_service_account.php';

catn8_session_start();
catn8_require_admin();
catn8_require_method('POST');

$body = catn8_read_json_body();
$mode = strtolower(trim((string)($body['mode'] ?? 'chat')));
$provider = strtolower(trim((string)($body['provider'] ?? 'openai')));
$baseUrl = trim((string)($body['base_url'] ?? ''));
$location = trim((string)($body['location'] ?? ''));
$providerConfig = is_array($body['provider_config'] ?? null) ? $body['provider_config'] : [];
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
            ['value' => 'gpt-5.2', 'label' => 'gpt-5.2'],
            ['value' => 'gpt-5.2-mini', 'label' => 'gpt-5.2-mini'],
            ['value' => 'gpt-5', 'label' => 'gpt-5'],
            ['value' => 'gpt-5-mini', 'label' => 'gpt-5-mini'],
            ['value' => 'gpt-4.1', 'label' => 'gpt-4.1'],
            ['value' => 'gpt-4.1-mini', 'label' => 'gpt-4.1-mini'],
            ['value' => 'gpt-4o', 'label' => 'gpt-4o'],
            ['value' => 'gpt-4o-mini', 'label' => 'gpt-4o-mini'],
            ['value' => 'o4-mini', 'label' => 'o4-mini'],
            ['value' => 'o3', 'label' => 'o3'],
        ],
        'anthropic' => [
            ['value' => 'claude-sonnet-4-5', 'label' => 'claude-sonnet-4-5'],
            ['value' => 'claude-opus-4-1', 'label' => 'claude-opus-4-1'],
            ['value' => 'claude-haiku-4-5', 'label' => 'claude-haiku-4-5'],
        ],
        'google_ai_studio' => [
            ['value' => 'gemini-2.5-flash', 'label' => 'gemini-2.5-flash'],
            ['value' => 'gemini-2.5-flash-lite', 'label' => 'gemini-2.5-flash-lite'],
            ['value' => 'gemini-2.5-pro', 'label' => 'gemini-2.5-pro'],
            ['value' => 'gemini-2.0-flash-001', 'label' => 'gemini-2.0-flash-001'],
        ],
        'google_vertex_ai' => [
            ['value' => 'publishers/google/models/gemini-2.5-flash', 'label' => 'publishers/google/models/gemini-2.5-flash'],
            ['value' => 'publishers/google/models/gemini-2.5-flash-lite', 'label' => 'publishers/google/models/gemini-2.5-flash-lite'],
            ['value' => 'publishers/google/models/gemini-2.5-pro', 'label' => 'publishers/google/models/gemini-2.5-pro'],
            ['value' => 'publishers/google/models/gemini-2.0-flash-001', 'label' => 'publishers/google/models/gemini-2.0-flash-001'],
        ],
        'azure_openai' => [
            ['value' => 'gpt-5.2', 'label' => 'gpt-5.2'],
            ['value' => 'gpt-5.2-mini', 'label' => 'gpt-5.2-mini'],
            ['value' => 'gpt-5', 'label' => 'gpt-5'],
            ['value' => 'gpt-4.1', 'label' => 'gpt-4.1'],
            ['value' => 'gpt-4.1-mini', 'label' => 'gpt-4.1-mini'],
            ['value' => 'gpt-4o', 'label' => 'gpt-4o'],
            ['value' => 'gpt-4o-mini', 'label' => 'gpt-4o-mini'],
            ['value' => 'o4-mini', 'label' => 'o4-mini'],
            ['value' => 'o3', 'label' => 'o3'],
        ],
        'aws_bedrock' => [
            ['value' => 'anthropic.claude-sonnet-4-5-20250929-v1:0', 'label' => 'anthropic.claude-sonnet-4-5-20250929-v1:0'],
            ['value' => 'anthropic.claude-haiku-4-5-20251001-v1:0', 'label' => 'anthropic.claude-haiku-4-5-20251001-v1:0'],
            ['value' => 'amazon.nova-pro-v1:0', 'label' => 'amazon.nova-pro-v1:0'],
        ],
        'together_ai' => [
            ['value' => 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', 'label' => 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'],
            ['value' => 'Qwen/Qwen2.5-72B-Instruct-Turbo', 'label' => 'Qwen/Qwen2.5-72B-Instruct-Turbo'],
            ['value' => 'deepseek-ai/DeepSeek-V3', 'label' => 'deepseek-ai/DeepSeek-V3'],
        ],
        'fireworks_ai' => [
            ['value' => 'accounts/fireworks/models/llama-v3p1-70b-instruct', 'label' => 'accounts/fireworks/models/llama-v3p1-70b-instruct'],
            ['value' => 'accounts/fireworks/models/qwen2p5-72b-instruct', 'label' => 'accounts/fireworks/models/qwen2p5-72b-instruct'],
            ['value' => 'accounts/fireworks/models/deepseek-v3', 'label' => 'accounts/fireworks/models/deepseek-v3'],
        ],
        'huggingface' => [
            ['value' => 'meta-llama/Llama-3.3-70B-Instruct', 'label' => 'meta-llama/Llama-3.3-70B-Instruct'],
            ['value' => 'Qwen/Qwen2.5-72B-Instruct', 'label' => 'Qwen/Qwen2.5-72B-Instruct'],
            ['value' => 'mistralai/Mistral-Small-3.1-24B-Instruct-2503', 'label' => 'mistralai/Mistral-Small-3.1-24B-Instruct-2503'],
        ],
    ],
    'image' => [
        'openai' => [
            ['value' => 'gpt-image-1', 'label' => 'gpt-image-1'],
            ['value' => 'dall-e-3', 'label' => 'dall-e-3'],
            ['value' => 'dall-e-2', 'label' => 'dall-e-2'],
        ],
        'azure_openai' => [
            ['value' => 'gpt-image-1', 'label' => 'gpt-image-1'],
            ['value' => 'dall-e-3', 'label' => 'dall-e-3'],
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

$catalogResponse = static function (array $models) {
    catn8_json_response([
        'success' => true,
        'source' => 'catalog',
        'models' => array_values($models),
    ]);
};

$apiKeyFromSecrets = static function (string $providerName) use ($mode, $secrets): string {
    $inlineKey = trim((string)($secrets['api_key'] ?? ''));
    if ($inlineKey !== '') {
        return $inlineKey;
    }
    $saved = $mode === 'chat'
        ? secret_get(catn8_settings_ai_secret_key($providerName, 'api_key'))
        : secret_get(catn8_settings_ai_image_secret_key($providerName, 'api_key'));
    return is_string($saved) ? trim($saved) : '';
};

$serviceAccountFromSecrets = static function (string $providerName) use ($mode, $secrets): string {
    $inline = trim((string)($secrets['service_account_json'] ?? ''));
    if ($inline !== '') {
        return $inline;
    }
    $saved = $mode === 'chat'
        ? secret_get(catn8_settings_ai_secret_key($providerName, 'service_account_json'))
        : secret_get(catn8_settings_ai_image_secret_key($providerName, 'service_account_json'));
    return is_string($saved) ? trim($saved) : '';
};

$providerDefaultBaseUrl = static function (string $providerName): string {
    if ($providerName === 'openai') {
        return 'https://api.openai.com';
    }
    if ($providerName === 'together_ai') {
        return 'https://api.together.xyz';
    }
    if ($providerName === 'fireworks_ai') {
        return 'https://api.fireworks.ai/inference';
    }
    return '';
};

$buildModelsUrl = static function (string $root): string {
    $normalized = rtrim(catn8_validate_external_base_url($root), '/');
    return preg_match('#/v1$#', $normalized) ? ($normalized . '/models') : ($normalized . '/v1/models');
};

$normalizeChoiceMap = static function (array $models): array {
    $normalized = [];
    foreach ($models as $item) {
        if (!is_array($item)) {
            continue;
        }
        $value = trim((string)($item['value'] ?? ''));
        if ($value === '') {
            continue;
        }
        $normalized[$value] = [
            'value' => $value,
            'label' => trim((string)($item['label'] ?? $value)) ?: $value,
        ];
    }
    ksort($normalized, SORT_NATURAL | SORT_FLAG_CASE);
    return array_values($normalized);
};

$openAiChatAllowed = static function (string $id): bool {
    $idLower = strtolower(trim($id));
    if ($idLower === '') {
        return false;
    }
    foreach ([
        'audio',
        'transcribe',
        'tts',
        'whisper',
        'embedding',
        'moderation',
        'image',
        'dall-e',
        'realtime',
        'search',
        'vision-preview',
        'omni-moderation',
    ] as $fragment) {
        if (strpos($idLower, $fragment) !== false) {
            return false;
        }
    }
    return preg_match('/^(gpt|o1|o3|o4)(-|$)/', $idLower) === 1;
};

$openAiCompatibleChatAllowed = static function (string $id) use ($provider): bool {
    $idLower = strtolower(trim($id));
    if ($idLower === '') {
        return false;
    }
    foreach ([
        'embedding',
        'rerank',
        'moderation',
        'image',
        'vision',
        'audio',
        'transcribe',
        'tts',
        'whisper',
    ] as $fragment) {
        if (strpos($idLower, $fragment) !== false) {
            return false;
        }
    }
    if ($provider === 'huggingface') {
        return true;
    }
    return str_contains($idLower, 'instruct') || str_contains($idLower, 'chat') || str_contains($idLower, 'turbo') || str_contains($idLower, 'llama') || str_contains($idLower, 'qwen') || str_contains($idLower, 'deepseek');
};

$parseOpenAiStyleModels = static function (array $json, callable $allowFn): array {
    $models = [];
    foreach (($json['data'] ?? []) as $item) {
        if (!is_array($item)) {
            continue;
        }
        $id = trim((string)($item['id'] ?? ''));
        if ($id === '' || !$allowFn($id)) {
            continue;
        }
        $models[] = ['value' => $id, 'label' => $id];
    }
    return $models;
};

$liveModels = [];

try {
    if ($provider === 'openai') {
        $apiKey = $apiKeyFromSecrets($provider);
        if ($apiKey === '') {
            $catalogResponse($fallback);
        }
        $root = $baseUrl !== '' ? $baseUrl : $providerDefaultBaseUrl($provider);
        $res = catn8_http_json_with_status('GET', $buildModelsUrl($root), ['Authorization' => 'Bearer ' . $apiKey], null, 10, 30);
        if ((int)($res['status'] ?? 0) >= 200 && (int)($res['status'] ?? 0) < 300 && is_array($res['json'])) {
            $liveModels = $parseOpenAiStyleModels($res['json'], $mode === 'image'
                ? static fn(string $id): bool => str_contains(strtolower($id), 'image') || str_contains(strtolower($id), 'dall-e')
                : $openAiChatAllowed);
        }
    } elseif ($provider === 'anthropic' && $mode === 'chat') {
        $apiKey = $apiKeyFromSecrets($provider);
        if ($apiKey === '') {
            $catalogResponse($fallback);
        }
        $res = catn8_http_json_with_status('GET', 'https://api.anthropic.com/v1/models', [
            'x-api-key' => $apiKey,
            'anthropic-version' => '2023-06-01',
        ], null, 10, 30);
        if ((int)($res['status'] ?? 0) >= 200 && (int)($res['status'] ?? 0) < 300 && is_array($res['json'])) {
            foreach (($res['json']['data'] ?? []) as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $id = trim((string)($item['id'] ?? ''));
                if ($id === '' || !str_starts_with(strtolower($id), 'claude')) {
                    continue;
                }
                $liveModels[] = [
                    'value' => $id,
                    'label' => trim((string)($item['display_name'] ?? $id)) ?: $id,
                ];
            }
        }
    } elseif ($provider === 'google_ai_studio' && $mode === 'chat') {
        $apiKey = $apiKeyFromSecrets($provider);
        if ($apiKey === '') {
            $catalogResponse($fallback);
        }
        $url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' . rawurlencode($apiKey);
        $res = catn8_http_json_with_status('GET', $url, [], null, 10, 30);
        if ((int)($res['status'] ?? 0) >= 200 && (int)($res['status'] ?? 0) < 300 && is_array($res['json'])) {
            foreach (($res['json']['models'] ?? []) as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $name = trim((string)($item['name'] ?? ''));
                if ($name === '') {
                    continue;
                }
                $value = preg_replace('#^models/#', '', $name) ?? $name;
                $methods = is_array($item['supportedGenerationMethods'] ?? null) ? $item['supportedGenerationMethods'] : [];
                if (!in_array('generateContent', $methods, true)) {
                    continue;
                }
                if (!str_contains(strtolower($value), 'gemini')) {
                    continue;
                }
                $liveModels[] = [
                    'value' => $value,
                    'label' => trim((string)($item['displayName'] ?? $value)) ?: $value,
                ];
            }
        }
    } elseif ($provider === 'google_vertex_ai' && $mode === 'chat') {
        $serviceAccountJson = $serviceAccountFromSecrets($provider);
        if ($serviceAccountJson === '' || $location === '') {
            $catalogResponse($fallback);
        }
        $serviceAccount = json_decode($serviceAccountJson, true);
        $projectId = is_array($serviceAccount) ? trim((string)($serviceAccount['project_id'] ?? '')) : '';
        if ($projectId === '') {
            $catalogResponse($fallback);
        }
        $token = catn8_google_service_account_access_token($serviceAccountJson, 'https://www.googleapis.com/auth/cloud-platform');
        $url = sprintf(
            'https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models',
            rawurlencode($location),
            rawurlencode($projectId),
            rawurlencode($location)
        );
        $res = catn8_http_json_with_status('GET', $url, ['Authorization' => 'Bearer ' . $token], null, 10, 30);
        if ((int)($res['status'] ?? 0) >= 200 && (int)($res['status'] ?? 0) < 300 && is_array($res['json'])) {
            $rows = [];
            if (is_array($res['json']['publisherModels'] ?? null)) {
                $rows = $res['json']['publisherModels'];
            } elseif (is_array($res['json']['models'] ?? null)) {
                $rows = $res['json']['models'];
            }
            foreach ($rows as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $name = trim((string)($item['name'] ?? ''));
                if ($name === '' || !str_contains(strtolower($name), 'gemini')) {
                    continue;
                }
                $liveModels[] = [
                    'value' => $name,
                    'label' => trim((string)($item['displayName'] ?? $name)) ?: $name,
                ];
            }
        }
    } elseif ($provider === 'azure_openai') {
        $apiKey = $apiKeyFromSecrets($provider);
        $endpoint = trim((string)($providerConfig['azure_endpoint'] ?? ''));
        $apiVersion = trim((string)($providerConfig['azure_api_version'] ?? ''));
        if ($apiKey === '' || $endpoint === '' || $apiVersion === '') {
            $catalogResponse($fallback);
        }
        $url = rtrim(catn8_validate_external_base_url($endpoint), '/') . '/openai/models?api-version=' . rawurlencode($apiVersion);
        $res = catn8_http_json_with_status('GET', $url, ['api-key' => $apiKey], null, 10, 30);
        if ((int)($res['status'] ?? 0) >= 200 && (int)($res['status'] ?? 0) < 300 && is_array($res['json'])) {
            foreach (($res['json']['data'] ?? []) as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $id = trim((string)($item['id'] ?? ''));
                if ($id === '') {
                    continue;
                }
                if ($mode === 'image') {
                    $allowed = str_contains(strtolower($id), 'image') || str_contains(strtolower($id), 'dall-e');
                } else {
                    $allowed = $openAiChatAllowed($id);
                }
                if (!$allowed) {
                    continue;
                }
                $liveModels[] = ['value' => $id, 'label' => $id];
            }
        }
    } elseif (in_array($provider, ['together_ai', 'fireworks_ai', 'huggingface'], true)) {
        $apiKey = $apiKeyFromSecrets($provider);
        if ($apiKey === '') {
            $catalogResponse($fallback);
        }
        $root = $baseUrl !== '' ? $baseUrl : $providerDefaultBaseUrl($provider);
        if ($root === '') {
            $catalogResponse($fallback);
        }
        $res = catn8_http_json_with_status('GET', $buildModelsUrl($root), ['Authorization' => 'Bearer ' . $apiKey], null, 10, 30);
        if ((int)($res['status'] ?? 0) >= 200 && (int)($res['status'] ?? 0) < 300 && is_array($res['json'])) {
            $liveModels = $parseOpenAiStyleModels($res['json'], $mode === 'image'
                ? static fn(string $id): bool => str_contains(strtolower($id), 'image') || str_contains(strtolower($id), 'flux') || str_contains(strtolower($id), 'diffusion')
                : $openAiCompatibleChatAllowed);
        }
    }
} catch (Throwable $e) {
    $liveModels = [];
}

$normalized = $normalizeChoiceMap($liveModels);
if (!$normalized) {
    $catalogResponse($fallback);
}

catn8_json_response([
    'success' => true,
    'source' => 'live',
    'models' => $normalized,
]);
