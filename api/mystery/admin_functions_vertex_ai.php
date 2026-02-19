<?php
/**
 * admin_functions_vertex_ai.php - Google Vertex AI helper functions for Mystery Admin
 * VERSION: 2025-12-31-0945
 */
declare(strict_types=1);

require_once __DIR__ . '/../../includes/google_oauth_service_account.php';

/**
 * Generates an image edit (noir style) using a raw reference image via Google Vertex AI Imagen.
 */
function catn8_mystery_vertex_imagen_edit_with_raw_reference_b64(string $serviceAccountJson, string $projectId, string $region, string $model, string $prompt, string $rawImageB64, array $params = []): string {
    if (trim($serviceAccountJson) === '') throw new RuntimeException('Missing Google Vertex AI service account JSON');
    if (trim($projectId) === '') throw new RuntimeException('Missing Project ID (Google Vertex AI)');
    if (trim($region) === '') throw new RuntimeException('Missing Region (Google Vertex AI)');
    if (trim($model) === '') throw new RuntimeException('Missing required Vertex AI Imagen edit model');
    if (trim($prompt) === '') throw new RuntimeException('Missing image prompt');
    if (trim($rawImageB64) === '') throw new RuntimeException('Missing raw reference image');

    $sampleCount = (int)($params['n'] ?? 1);
    if ($sampleCount < 1) $sampleCount = 1;
    if ($sampleCount > 4) $sampleCount = 4;

    $bearer = catn8_google_service_account_access_token($serviceAccountJson, 'https://www.googleapis.com/auth/cloud-platform');
    $url = 'https://' . $region . '-aiplatform.googleapis.com/v1/projects/' . rawurlencode($projectId) . '/locations/' . rawurlencode($region) . '/publishers/google/models/' . rawurlencode($model) . ':predict';

    $payloadParameters = [
        'sampleCount' => $sampleCount,
        'outputOptions' => ['mimeType' => 'image/png'],
    ];
    if (!empty($params['negative_prompt'])) {
        $payloadParameters['negativePrompt'] = trim((string)$params['negative_prompt']);
    }

    $payload = [
        'instances' => [
            [
                'prompt' => $prompt,
                'referenceImages' => [
                    [
                        'referenceType' => 'REFERENCE_TYPE_RAW',
                        'referenceId' => 1,
                        'referenceImage' => [
                            'bytesBase64Encoded' => $rawImageB64,
                        ],
                    ],
                ],
            ],
        ],
        'parameters' => $payloadParameters,
    ];

    $resp = catn8_http_json_with_status('POST', $url, ['Authorization' => 'Bearer ' . $bearer], $payload);
    
    if ($resp['status'] < 200 || $resp['status'] >= 300) {
        $msg = $resp['json']['error']['message'] ?? 'HTTP ' . $resp['status'];
        throw new RuntimeException('Vertex AI image edit failed: ' . $msg);
    }

    $predictions = $resp['json']['predictions'] ?? null;
    if (!is_array($predictions) || !count($predictions)) {
        throw new RuntimeException('Vertex AI image response missing predictions');
    }

    $b64 = (string)($predictions[0]['bytesBase64Encoded'] ?? '');
    if ($b64 === '') {
        throw new RuntimeException('Vertex AI image response missing bytesBase64Encoded');
    }

    return $b64;
}

/**
 * Generates an image from a prompt using Google Vertex AI Imagen.
 */
function catn8_mystery_vertex_imagen_generate(string $serviceAccountJson, string $projectId, string $region, string $model, string $prompt, array $params = []): string {
    if (trim($serviceAccountJson) === '') throw new RuntimeException('Missing Google Vertex AI service account JSON');
    if (trim($projectId) === '') throw new RuntimeException('Missing Project ID (Google Vertex AI)');
    if (trim($region) === '') throw new RuntimeException('Missing Region (Google Vertex AI)');
    if (trim($model) === '') throw new RuntimeException('Missing required Vertex AI Imagen model');
    if (trim($prompt) === '') throw new RuntimeException('Missing image prompt');

    $sampleCount = (int)($params['n'] ?? 1);
    if ($sampleCount < 1) $sampleCount = 1;
    if ($sampleCount > 4) $sampleCount = 4;

    $bearer = catn8_google_service_account_access_token($serviceAccountJson, 'https://www.googleapis.com/auth/cloud-platform');
    $url = 'https://' . $region . '-aiplatform.googleapis.com/v1/projects/' . rawurlencode($projectId) . '/locations/' . rawurlencode($region) . '/publishers/google/models/' . rawurlencode($model) . ':predict';

    $payloadParameters = [
        'sampleCount' => $sampleCount,
        'outputOptions' => ['mimeType' => 'image/png'],
    ];
    if (!empty($params['negative_prompt'])) {
        $payloadParameters['negativePrompt'] = trim((string)$params['negative_prompt']);
    }
    if (!empty($params['aspectRatio'])) {
        $payloadParameters['aspectRatio'] = trim((string)$params['aspectRatio']);
    }

    $payload = [
        'instances' => [
            [
                'prompt' => $prompt,
            ],
        ],
        'parameters' => $payloadParameters,
    ];

    $resp = catn8_http_json_with_status('POST', $url, ['Authorization' => 'Bearer ' . $bearer], $payload);
    
    if ($resp['status'] < 200 || $resp['status'] >= 300) {
        $msg = $resp['json']['error']['message'] ?? 'HTTP ' . $resp['status'];
        throw new RuntimeException('Vertex AI image generation failed: ' . $msg);
    }

    $predictions = $resp['json']['predictions'] ?? null;
    if (!is_array($predictions) || !count($predictions)) {
        throw new RuntimeException('Vertex AI image response missing predictions');
    }

    $b64 = (string)($predictions[0]['bytesBase64Encoded'] ?? '');
    if ($b64 === '') {
        throw new RuntimeException('Vertex AI image response missing bytesBase64Encoded');
    }

    return $b64;
}
