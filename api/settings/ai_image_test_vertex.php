<?php
if ($provider === 'google_vertex_ai') {
    require_once __DIR__ . '/../../includes/google_oauth_service_account.php';

    $saJson = secret_get(catn8_settings_ai_image_secret_key($provider, 'service_account_json'));
    if (!is_string($saJson) || trim($saJson) === '') {
        $fail(500, 'Missing AI image service account JSON (google_vertex_ai)');
    }
    $sa = json_decode((string)$saJson, true);
    if (!is_array($sa)) {
        $fail(500, 'AI image Vertex service account JSON is not valid JSON');
    }

    $projectId = trim((string)($providerConfig['gcp_project_id'] ?? ''));
    if ($projectId === '') {
        $projectId = trim((string)($sa['project_id'] ?? ''));
    }
    if ($projectId === '') {
        $fail(500, 'Missing GCP project id for Vertex AI image provider');
    }

    $location = trim((string)($providerConfig['gcp_region'] ?? ''));
    if ($location === '') {
        $fail(500, 'Missing GCP region for Vertex AI image provider');
    }

    if ($model === '') {
        $fail(500, 'Missing Vertex AI image model');
    }

    $token = catn8_google_service_account_access_token((string)$saJson, 'https://www.googleapis.com/auth/cloud-platform');

    $host = $location . '-aiplatform.googleapis.com';
    if (strtolower($location) === 'global') {
        $host = 'aiplatform.googleapis.com';
    }

    $modelPath = $model;
    if (strpos($modelPath, 'publishers/') === 0) {
        // ok
    } elseif (strpos($modelPath, '/') !== false) {
        // assume caller provided a full-ish path already
    } else {
        $modelPath = 'publishers/google/models/' . $modelPath;
    }

    $url = 'https://' . $host . '/v1/projects/' . rawurlencode($projectId) . '/locations/' . rawurlencode($location) . '/' . $modelPath . ':predict';

    $aspectRatio = trim((string)($params['aspect_ratio'] ?? ''));
    $quality = strtolower(trim((string)($params['quality'] ?? '')));
    $payload = [
        'instances' => [
            [
                'prompt' => $prompt,
            ],
        ],
        'parameters' => [
            'sampleCount' => 1,
        ],
    ];
    if ($aspectRatio !== '') {
        $payload['parameters']['aspectRatio'] = $aspectRatio;
    }
    if ($quality === 'high' || $quality === 'hq') {
        $payload['parameters']['sampleImageSize'] = '2K';
    }

    $res = catn8_http_json_with_status('POST', $url, [
        'Authorization' => 'Bearer ' . $token,
    ], $payload, 10, 60);

    $status = (int)($res['status'] ?? 0);
    $json = $res['json'] ?? null;
    $raw = (string)($res['raw'] ?? '');

    if (!is_array($json)) {
        throw new RuntimeException('Vertex AI image response was not valid JSON (HTTP ' . $status . ', url=' . $url . '): ' . substr($raw, 0, 800));
    }
    if ($status < 200 || $status >= 300 || isset($json['error'])) {
        $msg = '';
        if (isset($json['error'])) {
            if (is_string($json['error'])) {
                $msg = $json['error'];
            } elseif (is_array($json['error']) && isset($json['error']['message'])) {
                $msg = (string)$json['error']['message'];
            }
        }
        $fail(500, 'Vertex AI image error: HTTP ' . $status . ($msg !== '' ? ' - ' . $msg : ''), ['http_status' => $status]);
    }

    $preds = $json['predictions'] ?? null;
    if (!is_array($preds) || !isset($preds[0]) || !is_array($preds[0])) {
        $fail(500, 'Vertex AI image response missing predictions', ['http_status' => $status]);
    }

    $b64 = '';
    $p0 = $preds[0];
    if (isset($p0['bytesBase64Encoded'])) {
        $b64 = trim((string)$p0['bytesBase64Encoded']);
    } elseif (isset($p0['image']) && is_array($p0['image']) && isset($p0['image']['bytesBase64Encoded'])) {
        $b64 = trim((string)$p0['image']['bytesBase64Encoded']);
    } else {
        $stack = [$p0];
        while ($stack) {
            $cur = array_pop($stack);
            if (!is_array($cur)) continue;
            foreach ($cur as $k => $v) {
                if ($k === 'bytesBase64Encoded' && is_string($v) && trim($v) !== '') {
                    $b64 = trim($v);
                    break 2;
                }
                if (is_array($v)) $stack[] = $v;
            }
        }
    }

    if ($b64 === '') {
        $fail(500, 'Vertex AI image response did not include bytesBase64Encoded', ['http_status' => $status]);
    }

    catn8_json_response([
        'success' => true,
        'ai_image' => $meta,
        'http_status' => $status,
        'sample' => 'OK',
    ]);
}
