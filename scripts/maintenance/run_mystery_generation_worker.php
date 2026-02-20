<?php

declare(strict_types=1);

require_once __DIR__ . '/../../api/bootstrap.php';
require_once __DIR__ . '/../../includes/google_oauth_service_account.php';

function catn8_mystery_worker_out(array $payload): void
{
    fwrite(STDOUT, json_encode($payload, JSON_UNESCAPED_SLASHES) . "\n");
}

function catn8_mystery_worker_location_reference_cache_path(int $mysteryId, string $locationId): string
{
    $safe = preg_replace('#[^a-zA-Z0-9_\-]+#', '_', $locationId);
    if (!is_string($safe) || $safe === '') $safe = 'loc';
    $rootDir = dirname(__DIR__, 2);
    $outDir = $rootDir . '/images/mystery';
    catn8_mystery_worker_ensure_dir($outDir);
    return $outDir . '/location_ref_m' . $mysteryId . '_' . $safe . '.jpg';
}

function catn8_mystery_worker_google_places_find_best_photo_reference(string $apiKey, string $query): string
{
    $apiKey = catn8_mystery_worker_require_string(trim($apiKey) !== '' ? $apiKey : null, 'Google Places API key');
    $query = trim($query);
    if ($query === '') {
        return '';
    }

    $url = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json' .
        '?input=' . rawurlencode($query) .
        '&inputtype=textquery' .
        '&fields=place_id,photos' .
        '&key=' . rawurlencode($apiKey);

    $resp = catn8_mystery_worker_http_json('GET', $url, [], []);
    $status = trim((string)($resp['status'] ?? ''));
    if ($status !== '' && $status !== 'OK' && $status !== 'ZERO_RESULTS') {
        $msg = trim((string)($resp['error_message'] ?? ''));
        throw new RuntimeException('Google Places findplacefromtext error: ' . $status . ($msg !== '' ? (': ' . $msg) : ''));
    }

    $candidates = $resp['candidates'] ?? null;
    if (!is_array($candidates) || !count($candidates) || !is_array($candidates[0] ?? null)) {
        return '';
    }

    $photos = $candidates[0]['photos'] ?? null;
    if (!is_array($photos) || !count($photos)) {
        return '';
    }
    $p0 = $photos[0] ?? null;
    if (!is_array($p0)) return '';
    return trim((string)($p0['photo_reference'] ?? ''));
}

function catn8_mystery_worker_google_places_photo_download(string $apiKey, string $photoReference, int $maxWidth = 1600): string
{
    $apiKey = catn8_mystery_worker_require_string(trim($apiKey) !== '' ? $apiKey : null, 'Google Places API key');
    $photoReference = trim($photoReference);
    if ($photoReference === '') {
        throw new RuntimeException('Missing Places photo_reference');
    }
    if ($maxWidth < 200) $maxWidth = 200;
    if ($maxWidth > 4096) $maxWidth = 4096;

    $url = 'https://maps.googleapis.com/maps/api/place/photo' .
        '?maxwidth=' . $maxWidth .
        '&photoreference=' . rawurlencode($photoReference) .
        '&key=' . rawurlencode($apiKey);

    return catn8_mystery_worker_http_get_binary_follow_redirects($url, 5);
}

function catn8_mystery_worker_google_street_view_download(string $apiKey, string $locationQuery, int $w = 1024, int $h = 1024): string
{
    $apiKey = catn8_mystery_worker_require_string(trim($apiKey) !== '' ? $apiKey : null, 'Google Street View API key');
    $locationQuery = trim($locationQuery);
    if ($locationQuery === '') {
        throw new RuntimeException('Street View location query is empty');
    }
    if ($w < 256) $w = 256;
    if ($h < 256) $h = 256;
    if ($w > 2048) $w = 2048;
    if ($h > 2048) $h = 2048;

    $url = 'https://maps.googleapis.com/maps/api/streetview' .
        '?size=' . $w . 'x' . $h .
        '&location=' . rawurlencode($locationQuery) .
        '&fov=80' .
        '&pitch=0' .
        '&source=outdoor' .
        '&key=' . rawurlencode($apiKey);

    return catn8_mystery_worker_http_get_binary_follow_redirects($url, 2);
}

function catn8_mystery_worker_get_or_fetch_location_reference_image(int $mysteryId, string $locationId, string $addressQuery, array $secrets): string
{
    $locationId = trim($locationId);
    if ($mysteryId <= 0 || $locationId === '') {
        return '';
    }

    $path = catn8_mystery_worker_location_reference_cache_path($mysteryId, $locationId);
    if (is_file($path) && filesize($path) > 0) {
        $bin = @file_get_contents($path);
        if (is_string($bin) && $bin !== '') return $bin;
    }

    $placesKey = is_string($secrets['google_places_api_key'] ?? null) ? (string)$secrets['google_places_api_key'] : '';
    $streetKey = is_string($secrets['google_street_view_api_key'] ?? null) ? (string)$secrets['google_street_view_api_key'] : '';

    $addressQuery = trim($addressQuery);
    if ($addressQuery === '') {
        return '';
    }

    $bin = '';
    if (trim($placesKey) !== '') {
        $photoRef = catn8_mystery_worker_google_places_find_best_photo_reference($placesKey, $addressQuery);
        if ($photoRef !== '') {
            $bin = catn8_mystery_worker_google_places_photo_download($placesKey, $photoRef, 1600);
        }
    }

    if ($bin === '' && trim($streetKey) !== '') {
        $bin = catn8_mystery_worker_google_street_view_download($streetKey, $addressQuery, 1024, 1024);
    }

    if ($bin === '') {
        $missing = [];
        if (trim($placesKey) === '') $missing[] = 'Google Places API key';
        if (trim($streetKey) === '') $missing[] = 'Google Street View API key';
        $suffix = count($missing) ? (' (missing: ' . implode(', ', $missing) . ')') : '';
        throw new RuntimeException('No location reference image could be retrieved' . $suffix);
    }

    @file_put_contents($path, $bin);
    return $bin;
}

function catn8_mystery_worker_google_vertex_ai_image_edit_with_raw_reference_generate(string $serviceAccountJson, array $providerConfig, string $model, string $prompt, string $negativePrompt, array $merged, string $rawImageB64): string
{
    $serviceAccountJson = catn8_mystery_worker_require_string(trim($serviceAccountJson) !== '' ? $serviceAccountJson : null, 'Google Vertex AI service account JSON');
    $projectId = catn8_mystery_worker_require_string(
        is_string($providerConfig['gcp_project_id'] ?? null) ? (string)$providerConfig['gcp_project_id'] : null,
        'Project ID (Google Vertex AI)'
    );
    $region = catn8_mystery_worker_require_string(
        is_string($providerConfig['gcp_region'] ?? null) ? (string)$providerConfig['gcp_region'] : null,
        'Region (Google Vertex AI)'
    );

    $model = trim($model);
    if ($model === '') {
        throw new RuntimeException('Missing required Vertex AI Imagen edit model');
    }
    $prompt = trim($prompt);
    if ($prompt === '') {
        throw new RuntimeException('Missing image prompt');
    }
    $rawImageB64 = trim($rawImageB64);
    if ($rawImageB64 === '') {
        throw new RuntimeException('Missing raw reference image');
    }

    $sampleCount = (int)($merged['n'] ?? 1);
    if ($sampleCount < 1) $sampleCount = 1;
    if ($sampleCount > 4) $sampleCount = 4;

    $bearer = catn8_google_service_account_access_token($serviceAccountJson, 'https://www.googleapis.com/auth/cloud-platform');
    $url = 'https://' . $region . '-aiplatform.googleapis.com/v1/projects/' . rawurlencode($projectId) . '/locations/' . rawurlencode($region) . '/publishers/google/models/' . rawurlencode($model) . ':predict';

    $parameters = [
        'sampleCount' => $sampleCount,
        'outputOptions' => ['mimeType' => 'image/png'],
    ];
    if (trim($negativePrompt) !== '') {
        $parameters['negativePrompt'] = trim($negativePrompt);
    }
    if (isset($merged['seed'])) {
        $seed = (int)$merged['seed'];
        if ($seed > 0) {
            $parameters['seed'] = $seed;
        }
    }

    $resp = catn8_mystery_worker_http_json(
        'POST',
        $url,
        ['Authorization' => 'Bearer ' . $bearer],
        [
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
            'parameters' => $parameters,
        ]
    );

    $predictions = $resp['predictions'] ?? null;
    if (!is_array($predictions) || !count($predictions)) {
        throw new RuntimeException('Vertex AI image response missing predictions');
    }
    $first = $predictions[0] ?? null;
    if (!is_array($first)) {
        throw new RuntimeException('Vertex AI predictions[0] invalid');
    }
    $b64 = '';
    if (isset($first['bytesBase64Encoded']) && is_string($first['bytesBase64Encoded'])) {
        $b64 = (string)$first['bytesBase64Encoded'];
    }
    $bin = $b64 !== '' ? base64_decode($b64, true) : false;
    if (is_string($bin) && $bin !== '') {
        return $bin;
    }
    throw new RuntimeException('Vertex AI image response missing bytesBase64Encoded');
}

function catn8_mystery_worker_http_get_binary_follow_redirects(string $url, int $maxRedirects = 5): string
{
    $url = trim($url);
    if ($url === '') {
        throw new RuntimeException('HTTP URL is empty');
    }
    if ($maxRedirects < 0) $maxRedirects = 0;
    if ($maxRedirects > 10) $maxRedirects = 10;

    $lastErr = '';
    $lastCode = 0;
    for ($attempt = 0; $attempt < 3; $attempt++) {
        $ch = curl_init();
        if ($ch === false) {
            throw new RuntimeException('Failed to init curl');
        }
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);
        curl_setopt($ch, CURLOPT_TIMEOUT, 120);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_MAXREDIRS, $maxRedirects);

        $raw = curl_exec($ch);
        $err = curl_error($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $lastErr = (string)$err;
        $lastCode = $code;

        if (!is_string($raw)) {
            if ($attempt < 2) {
                catn8_mystery_worker_backoff_sleep($attempt);
                continue;
            }
            throw new RuntimeException('HTTP download failed: ' . ($lastErr !== '' ? $lastErr : 'unknown error'));
        }
        if ($code < 200 || $code >= 300) {
            if (catn8_mystery_worker_is_transient_http_status($code) && $attempt < 2) {
                catn8_mystery_worker_backoff_sleep($attempt);
                continue;
            }
            throw new RuntimeException('HTTP download failed with status ' . $code);
        }
        return $raw;
    }

    throw new RuntimeException('HTTP download failed' . ($lastCode ? (' with status ' . $lastCode) : '') . ($lastErr !== '' ? (': ' . $lastErr) : ''));
}

function catn8_mystery_worker_format_location_address(array $row): string
{
    $parts = [];
    $line1 = trim((string)($row['address_line1'] ?? ''));
    $line2 = trim((string)($row['address_line2'] ?? ''));
    $city = trim((string)($row['city'] ?? ''));
    $region = trim((string)($row['region'] ?? ''));
    $postal = trim((string)($row['postal_code'] ?? ''));
    $country = trim((string)($row['country'] ?? ''));

    if ($line1 !== '') $parts[] = $line1;
    if ($line2 !== '') $parts[] = $line2;
    $cityLine = trim(implode(', ', array_values(array_filter([$city, $region], static fn(string $v): bool => $v !== ''))));
    if ($cityLine !== '') {
        if ($postal !== '') {
            $cityLine = $cityLine . ' ' . $postal;
        }
        $parts[] = $cityLine;
    } elseif ($postal !== '') {
        $parts[] = $postal;
    }
    if ($country !== '') $parts[] = $country;
    return trim(implode(', ', $parts));
}

function catn8_mystery_worker_stability_ai_image_generate(string $apiKey, string $model, string $prompt, string $negativePrompt, array $merged): string
{
    $apiKey = catn8_mystery_worker_require_string(trim($apiKey) !== '' ? $apiKey : null, 'Stability API key');

    $variant = strtolower(trim($model));
    $endpoint = 'core';
    if ($variant === 'stable-image-ultra') $endpoint = 'ultra';
    if ($variant === 'stable-image-core') $endpoint = 'core';

    $url = 'https://api.stability.ai/v2beta/stable-image/generate/' . $endpoint;

    $aspect = trim((string)($merged['aspect_ratio'] ?? ''));
    if ($aspect === '') {
        $size = trim((string)($merged['size'] ?? ''));
        if (preg_match('#^(\d+)x(\d+)$#', $size, $m)) {
            $w = (int)$m[1];
            $h = (int)$m[2];
            if ($w > $h) $aspect = '16:9';
            elseif ($h > $w) $aspect = '9:16';
            else $aspect = '1:1';
        } else {
            $aspect = '1:1';
        }
    }

    $fields = [
        'prompt' => $prompt,
        'output_format' => 'png',
        'aspect_ratio' => $aspect,
    ];
    if ($negativePrompt !== '') {
        $fields['negative_prompt'] = $negativePrompt;
    }

    return catn8_mystery_worker_http_post_multipart_binary($url, ['Authorization' => 'Bearer ' . $apiKey], $fields);
}

function catn8_mystery_worker_huggingface_image_generate(string $apiKey, string $model, string $prompt): string
{
    $apiKey = catn8_mystery_worker_require_string(trim($apiKey) !== '' ? $apiKey : null, 'Hugging Face API token');
    $model = trim($model);
    if ($model === '') {
        throw new RuntimeException('Missing required Hugging Face model');
    }

    $url = 'https://api-inference.huggingface.co/models/' . rawurlencode($model);
    return catn8_mystery_worker_http_post_json_binary($url, ['Authorization' => 'Bearer ' . $apiKey], ['inputs' => $prompt]);
}

function catn8_mystery_worker_replicate_image_generate(string $apiKey, string $model, string $prompt, string $negativePrompt, array $merged): string
{
    $apiKey = catn8_mystery_worker_require_string(trim($apiKey) !== '' ? $apiKey : null, 'Replicate API token');
    $model = trim($model);
    if ($model === '') {
        throw new RuntimeException('Missing required Replicate model/version');
    }

    $input = $merged;
    $input['prompt'] = $prompt;
    if ($negativePrompt !== '') {
        $input['negative_prompt'] = $negativePrompt;
    }

    $created = catn8_mystery_worker_http_json(
        'POST',
        'https://api.replicate.com/v1/predictions',
        [
            'Authorization' => 'Bearer ' . $apiKey,
            'Prefer' => 'wait=60',
        ],
        [
            'version' => $model,
            'input' => $input,
        ]
    );

    $id = trim((string)($created['id'] ?? ''));
    if ($id === '') {
        throw new RuntimeException('Replicate did not return prediction id');
    }

    $prediction = $created;
    $status = (string)($prediction['status'] ?? '');
    $deadline = time() + 180;
    while ($status !== 'succeeded') {
        if ($status === 'failed' || $status === 'canceled') {
            $err = $prediction['error'] ?? null;
            $msg = is_string($err) ? $err : '';
            throw new RuntimeException('Replicate prediction ' . $status . ($msg !== '' ? ': ' . $msg : ''));
        }
        if (time() > $deadline) {
            throw new RuntimeException('Replicate prediction timed out');
        }
        usleep(1500000);
        $prediction = catn8_mystery_worker_http_json(
            'GET',
            'https://api.replicate.com/v1/predictions/' . rawurlencode($id),
            ['Authorization' => 'Bearer ' . $apiKey],
            []
        );
        $status = (string)($prediction['status'] ?? '');
    }

    $output = $prediction['output'] ?? null;
    $url = '';
    if (is_string($output)) {
        $url = $output;
    } elseif (is_array($output) && isset($output[0]) && is_string($output[0])) {
        $url = (string)$output[0];
    }

    $url = trim($url);
    if ($url === '') {
        throw new RuntimeException('Replicate prediction succeeded but output URL missing');
    }

    return catn8_mystery_worker_http_get_binary_headers($url, ['Authorization' => 'Bearer ' . $apiKey]);
}

function catn8_mystery_worker_google_vertex_ai_image_generate(string $serviceAccountJson, array $providerConfig, string $model, string $prompt, string $negativePrompt, array $merged): string
{
    $serviceAccountJson = catn8_mystery_worker_require_string(trim($serviceAccountJson) !== '' ? $serviceAccountJson : null, 'Google Vertex AI service account JSON');
    $projectId = catn8_mystery_worker_require_string(
        is_string($providerConfig['gcp_project_id'] ?? null) ? (string)$providerConfig['gcp_project_id'] : null,
        'Project ID (Google Vertex AI)'
    );
    $region = catn8_mystery_worker_require_string(
        is_string($providerConfig['gcp_region'] ?? null) ? (string)$providerConfig['gcp_region'] : null,
        'Region (Google Vertex AI)'
    );

    $model = trim($model);
    if ($model === '') {
        throw new RuntimeException('Missing required Vertex AI Imagen model');
    }

    $aspect = trim((string)($merged['aspect_ratio'] ?? ''));
    if ($aspect === '') {
        $size = trim((string)($merged['size'] ?? ''));
        if (preg_match('#^(\d+)x(\d+)$#', $size, $m)) {
            $w = (int)$m[1];
            $h = (int)$m[2];
            if ($w > $h) $aspect = '16:9';
            elseif ($h > $w) $aspect = '9:16';
            else $aspect = '1:1';
        } else {
            $aspect = '1:1';
        }
    }

    $sampleCount = (int)($merged['n'] ?? 1);
    if ($sampleCount < 1) $sampleCount = 1;
    if ($sampleCount > 4) $sampleCount = 4;

    $bearer = catn8_google_service_account_access_token($serviceAccountJson, 'https://www.googleapis.com/auth/cloud-platform');
    $url = 'https://' . $region . '-aiplatform.googleapis.com/v1/projects/' . rawurlencode($projectId) . '/locations/' . rawurlencode($region) . '/publishers/google/models/' . rawurlencode($model) . ':predict';

    $parameters = [
        'sampleCount' => $sampleCount,
        'aspectRatio' => $aspect,
        'outputOptions' => ['mimeType' => 'image/png'],
    ];
    if ($negativePrompt !== '') {
        $parameters['negativePrompt'] = $negativePrompt;
    }

    $resp = catn8_mystery_worker_http_json(
        'POST',
        $url,
        ['Authorization' => 'Bearer ' . $bearer],
        [
            'instances' => [['prompt' => $prompt]],
            'parameters' => $parameters,
        ]
    );

    $predictions = $resp['predictions'] ?? null;
    if (!is_array($predictions) || !count($predictions)) {
        throw new RuntimeException('Vertex AI image response missing predictions');
    }
    $first = $predictions[0] ?? null;
    if (!is_array($first)) {
        throw new RuntimeException('Vertex AI predictions[0] invalid');
    }
    $b64 = '';
    if (isset($first['bytesBase64Encoded']) && is_string($first['bytesBase64Encoded'])) {
        $b64 = (string)$first['bytesBase64Encoded'];
    }
    $bin = $b64 !== '' ? base64_decode($b64, true) : false;
    if (is_string($bin) && $bin !== '') {
        return $bin;
    }
    throw new RuntimeException('Vertex AI image response missing bytesBase64Encoded');
}

function catn8_mystery_worker_aws_hash(string $data): string
{
    return hash('sha256', $data);
}

function catn8_mystery_worker_aws_hmac(string $key, string $data, bool $raw = true): string
{
    return hash_hmac('sha256', $data, $key, $raw);
}

function catn8_mystery_worker_aws_signing_key(string $secret, string $date, string $region, string $service): string
{
    $kDate = catn8_mystery_worker_aws_hmac('AWS4' . $secret, $date);
    $kRegion = catn8_mystery_worker_aws_hmac($kDate, $region);
    $kService = catn8_mystery_worker_aws_hmac($kRegion, $service);
    return catn8_mystery_worker_aws_hmac($kService, 'aws4_request');
}

function catn8_mystery_worker_bedrock_invoke_model(string $region, string $modelId, string $accessKeyId, string $secretAccessKey, string $sessionToken, array $body): array
{
    $region = trim($region);
    if ($region === '') {
        throw new RuntimeException('Missing required Region (AWS Bedrock)');
    }
    $modelId = trim($modelId);
    if ($modelId === '') {
        throw new RuntimeException('Missing required Bedrock model');
    }

    $accessKeyId = catn8_mystery_worker_require_string(trim($accessKeyId) !== '' ? $accessKeyId : null, 'AWS Access Key ID');
    $secretAccessKey = catn8_mystery_worker_require_string(trim($secretAccessKey) !== '' ? $secretAccessKey : null, 'AWS Secret Access Key');

    $host = 'bedrock-runtime.' . $region . '.amazonaws.com';
    $uri = '/model/' . rawurlencode($modelId) . '/invoke';
    $url = 'https://' . $host . $uri;

    $payload = json_encode($body, JSON_UNESCAPED_SLASHES);
    if (!is_string($payload)) {
        throw new RuntimeException('Failed to encode Bedrock payload');
    }

    $amzDate = gmdate('Ymd\THis\Z');
    $dateStamp = gmdate('Ymd');
    $service = 'bedrock';
    $contentType = 'application/json';
    $payloadHash = catn8_mystery_worker_aws_hash($payload);

    $canonicalHeaders = 'content-type:' . $contentType . "\n" .
        'host:' . $host . "\n" .
        'x-amz-content-sha256:' . $payloadHash . "\n" .
        'x-amz-date:' . $amzDate . "\n";
    $signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

    $extra = '';
    if (trim($sessionToken) !== '') {
        $canonicalHeaders .= 'x-amz-security-token:' . trim($sessionToken) . "\n";
        $signedHeaders .= ';x-amz-security-token';
        $extra = trim($sessionToken);
    }

    $canonicalRequest = "POST\n" . $uri . "\n\n" . $canonicalHeaders . "\n" . $signedHeaders . "\n" . $payloadHash;
    $credentialScope = $dateStamp . '/' . $region . '/' . $service . '/aws4_request';
    $stringToSign = 'AWS4-HMAC-SHA256' . "\n" . $amzDate . "\n" . $credentialScope . "\n" . catn8_mystery_worker_aws_hash($canonicalRequest);
    $signingKey = catn8_mystery_worker_aws_signing_key($secretAccessKey, $dateStamp, $region, $service);
    $signature = hash_hmac('sha256', $stringToSign, $signingKey);

    $authorization = 'AWS4-HMAC-SHA256 Credential=' . $accessKeyId . '/' . $credentialScope . ', SignedHeaders=' . $signedHeaders . ', Signature=' . $signature;

    $headers = [
        'Content-Type: ' . $contentType,
        'Accept: application/json',
        'Host: ' . $host,
        'X-Amz-Date: ' . $amzDate,
        'X-Amz-Content-Sha256: ' . $payloadHash,
        'Authorization: ' . $authorization,
    ];
    if ($extra !== '') {
        $headers[] = 'X-Amz-Security-Token: ' . $extra;
    }

    $lastErr = '';
    $lastCode = 0;
    for ($attempt = 0; $attempt < 3; $attempt++) {
        $ch = curl_init();
        if ($ch === false) {
            throw new RuntimeException('Failed to init curl');
        }
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);
        curl_setopt($ch, CURLOPT_TIMEOUT, 120);
        $raw = curl_exec($ch);
        $err = curl_error($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $lastErr = (string)$err;
        $lastCode = $code;

        if (!is_string($raw)) {
            if ($attempt < 2) {
                catn8_mystery_worker_backoff_sleep($attempt);
                continue;
            }
            throw new RuntimeException('Bedrock HTTP request failed: ' . ($lastErr !== '' ? $lastErr : 'unknown error'));
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            if (catn8_mystery_worker_is_transient_http_status($code) && $attempt < 2) {
                catn8_mystery_worker_backoff_sleep($attempt);
                continue;
            }
            throw new RuntimeException('Bedrock returned non-JSON response (HTTP ' . $code . ')');
        }
        if ($code < 200 || $code >= 300) {
            if (catn8_mystery_worker_is_transient_http_status($code) && $attempt < 2) {
                catn8_mystery_worker_backoff_sleep($attempt);
                continue;
            }
            $msg = '';
            if (isset($decoded['message']) && is_string($decoded['message'])) $msg = $decoded['message'];
            if ($msg === '' && isset($decoded['error']) && is_string($decoded['error'])) $msg = $decoded['error'];
            throw new RuntimeException('Bedrock error (HTTP ' . $code . ')' . ($msg !== '' ? ': ' . $msg : ''));
        }
        return $decoded;
    }

    throw new RuntimeException('Bedrock HTTP request failed' . ($lastCode ? (' with status ' . $lastCode) : '') . ($lastErr !== '' ? (': ' . $lastErr) : ''));
}

function catn8_mystery_worker_aws_bedrock_image_generate(array $secrets, array $providerConfig, string $model, string $prompt, string $negativePrompt, array $merged): string
{
    $region = is_string($providerConfig['aws_region'] ?? null) ? (string)$providerConfig['aws_region'] : '';
    $ak = is_string($secrets['aws_access_key_id'] ?? null) ? (string)$secrets['aws_access_key_id'] : '';
    $sk = is_string($secrets['aws_secret_access_key'] ?? null) ? (string)$secrets['aws_secret_access_key'] : '';
    $st = is_string($secrets['aws_session_token'] ?? null) ? (string)$secrets['aws_session_token'] : '';

    $w = 1024;
    $h = 1024;
    $size = trim((string)($merged['size'] ?? ''));
    if (preg_match('#^(\d+)x(\d+)$#', $size, $m)) {
        $w = (int)$m[1];
        $h = (int)$m[2];
    }

    $n = (int)($merged['n'] ?? 1);
    if ($n < 1) $n = 1;
    if ($n > 4) $n = 4;

    $body = [
        'taskType' => 'TEXT_IMAGE',
        'textToImageParams' => [
            'text' => $prompt,
        ],
        'imageGenerationConfig' => [
            'numberOfImages' => $n,
            'height' => $h,
            'width' => $w,
            'cfgScale' => 8.0,
        ],
    ];
    if ($negativePrompt !== '') {
        $body['textToImageParams']['negativeText'] = $negativePrompt;
    }

    $resp = catn8_mystery_worker_bedrock_invoke_model($region, $model, $ak, $sk, $st, $body);
    $images = $resp['images'] ?? null;
    if (!is_array($images) || !count($images) || !is_string($images[0] ?? null)) {
        $err = $resp['error'] ?? null;
        $msg = is_string($err) ? $err : '';
        throw new RuntimeException('Bedrock response missing images' . ($msg !== '' ? ': ' . $msg : ''));
    }
    $bin = base64_decode((string)$images[0], true);
    if (!is_string($bin) || $bin === '') {
        throw new RuntimeException('Failed to decode Bedrock image');
    }
    return $bin;
}

function catn8_mystery_worker_is_transient_http_status(int $code): bool
{
    if ($code === 408) return true;
    if ($code === 429) return true;
    return ($code >= 500 && $code <= 599);
}

function catn8_mystery_worker_backoff_sleep(int $attempt): void
{
    if ($attempt < 0) $attempt = 0;
    if ($attempt > 10) $attempt = 10;
    $baseMs = 250;
    $maxMs = 4000;
    $ms = $baseMs * (2 ** $attempt);
    if ($ms > $maxMs) $ms = $maxMs;
    $jitter = random_int(0, 150);
    usleep((int)(($ms + $jitter) * 1000));
}

function catn8_mystery_worker_http_get_binary_headers(string $url, array $headers): string
{
    $url = trim($url);
    if ($url === '') {
        throw new RuntimeException('HTTP URL is empty');
    }

    $flatHeaders = [];
    foreach ($headers as $k => $v) {
        $key = trim((string)$k);
        $val = trim((string)$v);
        if ($key === '') continue;
        $flatHeaders[] = $key . ': ' . $val;
    }

    $lastErr = '';
    $lastCode = 0;
    for ($attempt = 0; $attempt < 3; $attempt++) {
        $ch = curl_init();
        if ($ch === false) {
            throw new RuntimeException('Failed to init curl');
        }
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $flatHeaders);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);
        curl_setopt($ch, CURLOPT_TIMEOUT, 120);
        $raw = curl_exec($ch);
        $err = curl_error($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $lastErr = (string)$err;
        $lastCode = $code;

        if (!is_string($raw)) {
            if ($attempt < 2) {
                catn8_mystery_worker_backoff_sleep($attempt);
                continue;
            }
            throw new RuntimeException('HTTP download failed: ' . ($lastErr !== '' ? $lastErr : 'unknown error'));
        }
        if ($code < 200 || $code >= 300) {
            if (catn8_mystery_worker_is_transient_http_status($code) && $attempt < 2) {
                catn8_mystery_worker_backoff_sleep($attempt);
                continue;
            }
            throw new RuntimeException('HTTP download failed with status ' . $code);
        }
        if ($raw === '') {
            if ($attempt < 2) {
                catn8_mystery_worker_backoff_sleep($attempt);
                continue;
            }
            throw new RuntimeException('HTTP download returned empty body');
        }
        return $raw;
    }

    throw new RuntimeException('HTTP download failed' . ($lastCode ? (' with status ' . $lastCode) : '') . ($lastErr !== '' ? (': ' . $lastErr) : ''));
}

function catn8_mystery_worker_http_post_json_binary(string $url, array $headers, array $body): string
{
    $url = trim($url);
    if ($url === '') {
        throw new RuntimeException('HTTP URL is empty');
    }

    $payload = json_encode($body, JSON_UNESCAPED_SLASHES);
    if (!is_string($payload)) {
        throw new RuntimeException('Failed to encode JSON payload');
    }

    $flatHeaders = [];
    foreach ($headers as $k => $v) {
        $key = trim((string)$k);
        $val = trim((string)$v);
        if ($key === '') continue;
        $flatHeaders[] = $key . ': ' . $val;
    }
    $flatHeaders[] = 'Content-Type: application/json';
    $flatHeaders[] = 'Accept: image/*, application/json';

    $lastErr = '';
    $lastCode = 0;
    for ($attempt = 0; $attempt < 3; $attempt++) {
        $ch = curl_init();
        if ($ch === false) {
            throw new RuntimeException('Failed to init curl');
        }

        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $flatHeaders);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);
        curl_setopt($ch, CURLOPT_TIMEOUT, 120);
        $raw = curl_exec($ch);
        $err = curl_error($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $lastErr = (string)$err;
        $lastCode = $code;

        if (!is_string($raw)) {
            if ($attempt < 2) {
                catn8_mystery_worker_backoff_sleep($attempt);
                continue;
            }
            throw new RuntimeException('HTTP request failed: ' . ($lastErr !== '' ? $lastErr : 'unknown error'));
        }

        if ($code < 200 || $code >= 300) {
            if (catn8_mystery_worker_is_transient_http_status($code) && $attempt < 2) {
                catn8_mystery_worker_backoff_sleep($attempt);
                continue;
            }
            $decoded = json_decode($raw, true);
            $msg = '';
            if (is_array($decoded) && isset($decoded['error'])) {
                if (is_string($decoded['error'])) $msg = $decoded['error'];
                if (is_array($decoded['error']) && isset($decoded['error']['message']) && is_string($decoded['error']['message'])) {
                    $msg = $decoded['error']['message'];
                }
            }
            throw new RuntimeException('HTTP ' . $code . ' error' . ($msg !== '' ? ': ' . $msg : ''));
        }

        if ($raw === '') {
            if ($attempt < 2) {
                catn8_mystery_worker_backoff_sleep($attempt);
                continue;
            }
            throw new RuntimeException('HTTP response was empty');
        }

        return $raw;
    }

    throw new RuntimeException('HTTP request failed' . ($lastCode ? (' with status ' . $lastCode) : '') . ($lastErr !== '' ? (': ' . $lastErr) : ''));
}

function catn8_mystery_worker_http_post_multipart_binary(string $url, array $headers, array $fields): string
{
    $url = trim($url);
    if ($url === '') {
        throw new RuntimeException('HTTP URL is empty');
    }

    $flatHeaders = [];
    foreach ($headers as $k => $v) {
        $key = trim((string)$k);
        $val = trim((string)$v);
        if ($key === '') continue;
        $flatHeaders[] = $key . ': ' . $val;
    }
    $flatHeaders[] = 'Accept: image/*, application/json';

    $lastErr = '';
    $lastCode = 0;
    for ($attempt = 0; $attempt < 3; $attempt++) {
        $ch = curl_init();
        if ($ch === false) {
            throw new RuntimeException('Failed to init curl');
        }

        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $flatHeaders);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $fields);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);
        curl_setopt($ch, CURLOPT_TIMEOUT, 120);
        $raw = curl_exec($ch);
        $err = curl_error($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $lastErr = (string)$err;
        $lastCode = $code;

        if (!is_string($raw)) {
            if ($attempt < 2) {
                catn8_mystery_worker_backoff_sleep($attempt);
                continue;
            }
            throw new RuntimeException('HTTP request failed: ' . ($lastErr !== '' ? $lastErr : 'unknown error'));
        }
        if ($code < 200 || $code >= 300) {
            if (catn8_mystery_worker_is_transient_http_status($code) && $attempt < 2) {
                catn8_mystery_worker_backoff_sleep($attempt);
                continue;
            }
            $decoded = json_decode($raw, true);
            $msg = '';
            if (is_array($decoded) && isset($decoded['message']) && is_string($decoded['message'])) {
                $msg = $decoded['message'];
            }
            if ($msg === '' && is_array($decoded) && isset($decoded['error'])) {
                if (is_string($decoded['error'])) $msg = $decoded['error'];
                if (is_array($decoded['error']) && isset($decoded['error']['message']) && is_string($decoded['error']['message'])) {
                    $msg = $decoded['error']['message'];
                }
            }
            throw new RuntimeException('HTTP ' . $code . ' error' . ($msg !== '' ? ': ' . $msg : ''));
        }
        if ($raw === '') {
            if ($attempt < 2) {
                catn8_mystery_worker_backoff_sleep($attempt);
                continue;
            }
            throw new RuntimeException('HTTP response was empty');
        }
        return $raw;
    }

    throw new RuntimeException('HTTP request failed' . ($lastCode ? (' with status ' . $lastCode) : '') . ($lastErr !== '' ? (': ' . $lastErr) : ''));
}

function catn8_mystery_worker_err(array $payload): void
{
    fwrite(STDERR, json_encode($payload, JSON_UNESCAPED_SLASHES) . "\n");
}

function catn8_mystery_worker_require_string(?string $value, string $label): string
{
    $v = trim((string)$value);
    if ($v === '') {
        throw new RuntimeException('Missing required ' . $label);
    }
    return $v;
}

function catn8_mystery_worker_extract_json_from_text(string $text): string
{
    $t = trim($text);
    if ($t === '') return '';

    if (preg_match('#```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```#si', $t, $m)) {
        return trim((string)$m[1]);
    }

    $firstObj = strpos($t, '{');
    $lastObj = strrpos($t, '}');
    if ($firstObj !== false && $lastObj !== false && $lastObj > $firstObj) {
        return trim(substr($t, $firstObj, ($lastObj - $firstObj) + 1));
    }

    $firstArr = strpos($t, '[');
    $lastArr = strrpos($t, ']');
    if ($firstArr !== false && $lastArr !== false && $lastArr > $firstArr) {
        return trim(substr($t, $firstArr, ($lastArr - $firstArr) + 1));
    }

    return $t;
}

function catn8_mystery_worker_read_ai_config(): array
{
    $defaults = [
        'provider' => 'openai',
        'model' => 'gpt-4o-mini',
        'base_url' => '',
        'location' => '',
        'temperature' => 0.2,
        'system_prompt' => '',
        'provider_config' => [],
    ];

    $raw = secret_get(catn8_secret_key('ai.config'));
    $cfg = [];
    if (is_string($raw) && $raw !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $cfg = $decoded;
        }
    }

    $temperature = $cfg['temperature'] ?? $defaults['temperature'];
    if (!is_numeric($temperature)) {
        $temperature = $defaults['temperature'];
    }

    $providerConfig = $cfg['provider_config'] ?? $defaults['provider_config'];
    if (!is_array($providerConfig)) {
        $providerConfig = $defaults['provider_config'];
    }

    return [
        'provider' => (string)($cfg['provider'] ?? $defaults['provider']),
        'model' => (string)($cfg['model'] ?? $defaults['model']),
        'base_url' => (string)($cfg['base_url'] ?? $defaults['base_url']),
        'location' => (string)($cfg['location'] ?? $defaults['location']),
        'temperature' => (float)$temperature,
        'system_prompt' => (string)($cfg['system_prompt'] ?? $defaults['system_prompt']),
        'provider_config' => $providerConfig,
    ];
}

function catn8_mystery_worker_ai_secret_key(string $provider, string $name): string
{
    $p = strtolower(trim($provider));
    $n = strtolower(trim($name));
    if ($p === '' || $n === '') {
        throw new RuntimeException('Invalid AI secret key request');
    }
    return catn8_secret_key('ai.secret.' . $p . '.' . $n);
}

function catn8_mystery_worker_read_ai_secrets(string $provider): array
{
    $p = strtolower(trim($provider));
    if ($p === '') {
        throw new RuntimeException('AI provider is empty');
    }

    $get = static function (string $name) use ($p): string {
        $raw = secret_get(catn8_mystery_worker_ai_secret_key($p, $name));
        return is_string($raw) ? (string)$raw : '';
    };

    if ($p === 'google_vertex_ai') {
        return [
            'service_account_json' => $get('service_account_json'),
            'google_places_api_key' => $get('google_places_api_key'),
            'google_street_view_api_key' => $get('google_street_view_api_key'),
        ];
    }

    if ($p === 'aws_bedrock') {
        return [
            'aws_access_key_id' => $get('aws_access_key_id'),
            'aws_secret_access_key' => $get('aws_secret_access_key'),
            'aws_session_token' => $get('aws_session_token'),
        ];
    }

    return [
        'api_key' => $get('api_key'),
    ];
}

function catn8_mystery_worker_read_ai_api_key(): string
{
    throw new RuntimeException('Do not call catn8_mystery_worker_read_ai_api_key; use per-provider secrets');
}

function catn8_mystery_worker_read_mystery_gcp_service_account_json(): string
{
    $raw = secret_get('CATN8_MYSTERY_GCP_SERVICE_ACCOUNT_JSON');
    return catn8_mystery_worker_require_string(is_string($raw) ? $raw : null, 'Mystery GCP service account JSON');
}

function catn8_mystery_worker_read_ai_image_config(): array
{
    $defaults = [
        'provider' => 'openai',
        'model' => 'gpt-image-1',
        'base_url' => '',
        'provider_config' => [],
        'params' => [
            'size' => '1024x1024',
            'quality' => 'auto',
            'style' => 'natural',
        ],
    ];

    $raw = secret_get(catn8_secret_key('ai_image.config'));
    $cfg = [];
    if (is_string($raw) && $raw !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $cfg = $decoded;
        }
    }

    $params = $cfg['params'] ?? $defaults['params'];
    if (!is_array($params)) {
        $params = $defaults['params'];
    }

    $providerConfig = $cfg['provider_config'] ?? $defaults['provider_config'];
    if (!is_array($providerConfig)) {
        $providerConfig = $defaults['provider_config'];
    }

    return [
        'provider' => (string)($cfg['provider'] ?? $defaults['provider']),
        'model' => (string)($cfg['model'] ?? $defaults['model']),
        'base_url' => (string)($cfg['base_url'] ?? $defaults['base_url']),
        'provider_config' => $providerConfig,
        'params' => $params,
    ];
}

function catn8_mystery_worker_http_json(string $method, string $url, array $headers, array $body): array
{
    $method = strtoupper(trim($method));
    if ($method === '') {
        throw new RuntimeException('HTTP method is empty');
    }
    $url = trim($url);
    if ($url === '') {
        throw new RuntimeException('HTTP URL is empty');
    }

    $isGet = $method === 'GET';

    $payload = '';
    if (!$isGet) {
        $payload = json_encode($body, JSON_UNESCAPED_SLASHES);
        if (!is_string($payload)) {
            throw new RuntimeException('Failed to encode JSON payload');
        }
    }

    $flatHeaders = [];
    foreach ($headers as $k => $v) {
        $key = trim((string)$k);
        $val = trim((string)$v);
        if ($key === '') continue;
        $flatHeaders[] = $key . ': ' . $val;
    }
    if (!$isGet) {
        $flatHeaders[] = 'Content-Type: application/json';
    }
    $flatHeaders[] = 'Accept: application/json';

    $lastErr = '';
    $lastCode = 0;
    for ($attempt = 0; $attempt < 3; $attempt++) {
        $ch = curl_init();
        if ($ch === false) {
            throw new RuntimeException('Failed to init curl');
        }

        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $flatHeaders);
        if (!$isGet) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        }
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);
        curl_setopt($ch, CURLOPT_TIMEOUT, 120);

        $raw = curl_exec($ch);
        $err = curl_error($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $lastErr = (string)$err;
        $lastCode = $code;

        if (!is_string($raw)) {
            if ($attempt < 2) {
                catn8_mystery_worker_backoff_sleep($attempt);
                continue;
            }
            throw new RuntimeException('HTTP request failed: ' . ($lastErr !== '' ? $lastErr : 'unknown error'));
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            if (catn8_mystery_worker_is_transient_http_status($code) && $attempt < 2) {
                catn8_mystery_worker_backoff_sleep($attempt);
                continue;
            }
            throw new RuntimeException('HTTP ' . $code . ' returned non-JSON response');
        }
        if ($code < 200 || $code >= 300) {
            if (catn8_mystery_worker_is_transient_http_status($code) && $attempt < 2) {
                catn8_mystery_worker_backoff_sleep($attempt);
                continue;
            }
            $msg = '';
            if (isset($decoded['error'])) {
                if (is_string($decoded['error'])) $msg = $decoded['error'];
                if (is_array($decoded['error']) && isset($decoded['error']['message']) && is_string($decoded['error']['message'])) {
                    $msg = $decoded['error']['message'];
                }
            }
            throw new RuntimeException('HTTP ' . $code . ' error' . ($msg !== '' ? ': ' . $msg : ''));
        }
        return $decoded;
    }

    throw new RuntimeException('HTTP request failed' . ($lastCode ? (' with status ' . $lastCode) : '') . ($lastErr !== '' ? (': ' . $lastErr) : ''));
}

function catn8_mystery_worker_http_get_binary(string $url): string
{
    $url = trim($url);
    if ($url === '') {
        throw new RuntimeException('HTTP URL is empty');
    }

    $lastErr = '';
    $lastCode = 0;
    for ($attempt = 0; $attempt < 3; $attempt++) {
        $ch = curl_init();
        if ($ch === false) {
            throw new RuntimeException('Failed to init curl');
        }
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);
        curl_setopt($ch, CURLOPT_TIMEOUT, 120);
        $raw = curl_exec($ch);
        $err = curl_error($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $lastErr = (string)$err;
        $lastCode = $code;

        if (!is_string($raw)) {
            if ($attempt < 2) {
                catn8_mystery_worker_backoff_sleep($attempt);
                continue;
            }
            throw new RuntimeException('HTTP download failed: ' . ($lastErr !== '' ? $lastErr : 'unknown error'));
        }
        if ($code < 200 || $code >= 300) {
            if (catn8_mystery_worker_is_transient_http_status($code) && $attempt < 2) {
                catn8_mystery_worker_backoff_sleep($attempt);
                continue;
            }
            throw new RuntimeException('HTTP download failed with status ' . $code);
        }
        if ($raw === '') {
            if ($attempt < 2) {
                catn8_mystery_worker_backoff_sleep($attempt);
                continue;
            }
            throw new RuntimeException('HTTP download returned empty body');
        }
        return $raw;
    }

    throw new RuntimeException('HTTP download failed' . ($lastCode ? (' with status ' . $lastCode) : '') . ($lastErr !== '' ? (': ' . $lastErr) : ''));
}

function catn8_mystery_worker_openai_compatible_image_generate(array $aiImgCfg, string $apiKey, array $payload): string
{
    $baseUrl = trim((string)($aiImgCfg['base_url'] ?? ''));
    if ($baseUrl === '' && strtolower(trim((string)($aiImgCfg['provider'] ?? 'openai'))) !== 'openai') {
        throw new RuntimeException('Missing required base_url for provider: ' . (string)($aiImgCfg['provider'] ?? ''));
    }

    $client = catn8_mystery_worker_openai_client($apiKey, $baseUrl);
    $resp = $client->images()->create($payload);

    $b64 = '';
    if (isset($resp->data[0]->b64_json)) {
        $b64 = (string)$resp->data[0]->b64_json;
    }
    $bin = $b64 !== '' ? base64_decode($b64, true) : false;
    if (is_string($bin) && $bin !== '') {
        return $bin;
    }
    throw new RuntimeException('Image generation did not return b64 image data');
}

function catn8_mystery_worker_azure_openai_image_generate(array $aiImgCfg, string $apiKey, array $payload, string $prompt, string $negativePrompt): string
{
    $pc = $aiImgCfg['provider_config'] ?? [];
    if (!is_array($pc)) {
        $pc = [];
    }

    $endpoint = catn8_mystery_worker_require_string(is_string($pc['azure_endpoint'] ?? null) ? (string)$pc['azure_endpoint'] : null, 'Endpoint (Azure OpenAI)');
    $deployment = catn8_mystery_worker_require_string(is_string($pc['azure_deployment'] ?? null) ? (string)$pc['azure_deployment'] : null, 'Deployment (Azure OpenAI)');
    $apiVersion = catn8_mystery_worker_require_string(is_string($pc['azure_api_version'] ?? null) ? (string)$pc['azure_api_version'] : null, 'API Version (Azure OpenAI)');

    $endpoint = rtrim($endpoint, '/');
    $url = $endpoint . '/openai/deployments/' . rawurlencode($deployment) . '/images/generations?api-version=' . rawurlencode($apiVersion);

    $body = $payload;
    unset($body['model']);
    $body['prompt'] = $prompt;
    $body['response_format'] = 'b64_json';
    if ($negativePrompt !== '') {
        $body['negative_prompt'] = $negativePrompt;
    }

    $decoded = catn8_mystery_worker_http_json('POST', $url, ['api-key' => $apiKey], $body);
    $data = $decoded['data'] ?? null;
    if (!is_array($data) || !count($data)) {
        throw new RuntimeException('Azure OpenAI image response missing data');
    }

    $first = $data[0] ?? null;
    if (!is_array($first)) {
        throw new RuntimeException('Azure OpenAI image response data[0] invalid');
    }

    if (isset($first['b64_json']) && is_string($first['b64_json']) && trim($first['b64_json']) !== '') {
        $bin = base64_decode((string)$first['b64_json'], true);
        if (is_string($bin) && $bin !== '') {
            return $bin;
        }
    }

    if (isset($first['url']) && is_string($first['url']) && trim($first['url']) !== '') {
        return catn8_mystery_worker_http_get_binary((string)$first['url']);
    }

    throw new RuntimeException('Azure OpenAI image response missing b64_json/url');
}

function catn8_mystery_worker_read_ai_image_api_key(): string
{
    throw new RuntimeException('Do not call catn8_mystery_worker_read_ai_image_api_key; use per-provider secrets');
}

function catn8_mystery_worker_ai_image_secret_key(string $provider, string $name): string
{
    $p = strtolower(trim($provider));
    $n = strtolower(trim($name));
    if ($p === '' || $n === '') {
        throw new RuntimeException('Invalid image secret key request');
    }
    return catn8_secret_key('ai_image.secret.' . $p . '.' . $n);
}

function catn8_mystery_worker_read_ai_image_secrets(string $provider): array
{
    $p = strtolower(trim($provider));
    if ($p === '') {
        throw new RuntimeException('Image provider is empty');
    }

    $get = static function (string $name) use ($p): string {
        $raw = secret_get(catn8_mystery_worker_ai_image_secret_key($p, $name));
        return is_string($raw) ? (string)$raw : '';
    };

    if ($p === 'google_vertex_ai') {
        return [
            'service_account_json' => $get('service_account_json'),
            'google_places_api_key' => $get('google_places_api_key'),
            'google_street_view_api_key' => $get('google_street_view_api_key'),
        ];
    }

    if ($p === 'aws_bedrock') {
        return [
            'aws_access_key_id' => $get('aws_access_key_id'),
            'aws_secret_access_key' => $get('aws_secret_access_key'),
            'aws_session_token' => $get('aws_session_token'),
        ];
    }

    return [
        'api_key' => $get('api_key'),
    ];
}

function catn8_mystery_worker_openai_client(string $apiKey, string $baseUrl = '')
{
    $factory = OpenAI::factory()->withApiKey($apiKey);
    if (trim($baseUrl) !== '') {
        $factory = $factory->withBaseUri($baseUrl);
    }
    return $factory->make();
}

function catn8_mystery_worker_lock_on(array $locks, string $key): bool
{
    return (int)($locks[$key] ?? 0) === 1;
}

function catn8_mystery_worker_unique_slug(string $baseSlug, callable $exists): string
{
    $baseSlug = strtolower(trim($baseSlug));
    $baseSlug = preg_replace('#[^a-z0-9]+#', '-', $baseSlug);
    $baseSlug = trim((string)$baseSlug, '-');
    if ($baseSlug === '') {
        throw new RuntimeException('Base slug is empty');
    }

    $candidate = $baseSlug;
    for ($i = 0; $i < 2000; $i++) {
        $isTaken = (bool)call_user_func($exists, $candidate);
        if (!$isTaken) {
            return $candidate;
        }
        $candidate = $baseSlug . '-' . ($i + 2);
    }

    throw new RuntimeException('Failed to generate unique slug for base: ' . $baseSlug);
}

function catn8_mystery_worker_pick(array $items)
{
    if (!count($items)) return null;
    return $items[array_rand($items)];
}

function catn8_mystery_worker_int_ids(mixed $value): array
{
    if (!is_array($value)) return [];
    $out = [];
    foreach ($value as $v) {
        $n = (int)$v;
        if ($n > 0) $out[] = $n;
    }
    $out = array_values(array_unique($out));
    sort($out);
    return $out;
}

function catn8_mystery_worker_merge_deep(array $base, array $patch): array
{
    foreach ($patch as $k => $v) {
        if (is_int($k)) {
            $base[] = $v;
            continue;
        }

        if (array_key_exists($k, $base) && is_array($base[$k]) && is_array($v)) {
            $base[$k] = catn8_mystery_worker_merge_deep($base[$k], $v);
            continue;
        }

        $base[$k] = $v;
    }
    return $base;
}

function catn8_mystery_worker_fetch_master_names(string $table, array $ids): array
{
    if (!count($ids)) return [];
    $ph = implode(',', array_fill(0, count($ids), '?'));
    $sql = "SELECT id, name FROM {$table} WHERE is_archived = 0 AND id IN ({$ph})";
    $rows = Database::queryAll($sql, $ids);
    $names = [];
    foreach ($rows as $r) {
        $name = trim((string)($r['name'] ?? ''));
        if ($name !== '') $names[] = $name;
    }
    return $names;
}

function catn8_mystery_worker_fetch_master_names_for_mystery(string $table, int $mysteryId, array $ids): array
{
    if ($mysteryId <= 0) {
        throw new RuntimeException('Invalid mystery_id for master lookup');
    }

    if (count($ids)) {
        return catn8_mystery_worker_fetch_master_names($table, $ids);
    }

    $rows = Database::queryAll(
        "SELECT name FROM {$table} WHERE mystery_id = ? AND is_archived = 0 ORDER BY id ASC",
        [$mysteryId]
    );
    $names = [];
    foreach ($rows as $r) {
        $name = trim((string)($r['name'] ?? ''));
        if ($name !== '') $names[] = $name;
    }
    return $names;
}

function catn8_mystery_worker_ai_chat_generate(array $aiCfg, array $messages): string
{
    $provider = strtolower(trim((string)($aiCfg['provider'] ?? '')));
    if ($provider === '') {
        throw new RuntimeException('AI provider is empty');
    }

    $systemPrompt = '';
    $userPrompt = '';
    foreach ($messages as $m) {
        if ($m['role'] === 'system') $systemPrompt = $m['content'];
        if ($m['role'] === 'user') $userPrompt = $m['content'];
    }

    if ($provider === 'google_vertex_ai') {
        require_once __DIR__ . '/../../includes/vertex_ai_gemini.php';
        $secrets = catn8_mystery_worker_read_ai_secrets($provider);
        $saJson = catn8_mystery_worker_require_string($secrets['service_account_json'] ?? null, 'AI service account JSON (google_vertex_ai)');
        $sa = json_decode($saJson, true);
        $projectId = trim((string)($sa['project_id'] ?? ''));
        $location = trim((string)($aiCfg['location'] ?? ''));
        return catn8_vertex_ai_gemini_generate_text([
            'service_account_json' => $saJson,
            'project_id' => $projectId,
            'location' => $location,
            'model' => trim((string)($aiCfg['model'] ?? '')),
            'system_prompt' => $systemPrompt,
            'user_prompt' => $userPrompt,
            'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
            'max_output_tokens' => 2048,
        ]);
    }

    if ($provider === 'anthropic') {
        $secrets = catn8_mystery_worker_read_ai_secrets($provider);
        $apiKey = catn8_mystery_worker_require_string($secrets['api_key'] ?? null, 'AI API key (anthropic)');
        $body = [
            'model' => catn8_mystery_worker_require_string(trim((string)($aiCfg['model'] ?? '')) !== '' ? (string)$aiCfg['model'] : null, 'Anthropic model'),
            'max_tokens' => 2048,
            'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
            'messages' => [['role' => 'user', 'content' => $userPrompt]],
        ];
        if ($systemPrompt !== '') $body['system'] = $systemPrompt;
        $decoded = catn8_mystery_worker_http_json('POST', 'https://api.anthropic.com/v1/messages', ['x-api-key' => $apiKey, 'anthropic-version' => '2023-06-01'], $body);
        $parts = $decoded['content'] ?? null;
        if (is_array($parts) && isset($parts[0]['text'])) return (string)$parts[0]['text'];
        return '';
    }

    if ($provider === 'google_ai_studio') {
        $secrets = catn8_mystery_worker_read_ai_secrets($provider);
        $apiKey = catn8_mystery_worker_require_string($secrets['api_key'] ?? null, 'AI API key (google_ai_studio)');
        $model = catn8_mystery_worker_require_string(trim((string)($aiCfg['model'] ?? '')) !== '' ? (string)$aiCfg['model'] : null, 'Google AI Studio model');
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent?key=' . rawurlencode($apiKey);
        $body = ['contents' => [['role' => 'user', 'parts' => [['text' => $userPrompt]]]], 'generationConfig' => ['temperature' => (float)($aiCfg['temperature'] ?? 0.2)]];
        if ($systemPrompt !== '') $body['systemInstruction'] = ['parts' => [['text' => $systemPrompt]]];
        $decoded = catn8_mystery_worker_http_json('POST', $url, [], $body);
        $candidates = $decoded['candidates'] ?? null;
        if (is_array($candidates) && isset($candidates[0]['content']['parts'][0]['text'])) return (string)$candidates[0]['content']['parts'][0]['text'];
        return '';
    }

    if ($provider === 'azure_openai') {
        $secrets = catn8_mystery_worker_read_ai_secrets($provider);
        $apiKey = catn8_mystery_worker_require_string($secrets['api_key'] ?? null, 'AI API key (azure_openai)');
        $pc = $aiCfg['provider_config'] ?? [];
        $endpoint = rtrim(catn8_validate_external_base_url($pc['azure_endpoint'] ?? ''), '/');
        $deployment = (string)($pc['azure_deployment'] ?? '');
        $apiVersion = (string)($pc['azure_api_version'] ?? '');
        $url = $endpoint . '/openai/deployments/' . rawurlencode($deployment) . '/chat/completions?api-version=' . rawurlencode($apiVersion);
        $decoded = catn8_mystery_worker_http_json('POST', $url, ['api-key' => $apiKey], ['messages' => $messages, 'temperature' => (float)($aiCfg['temperature'] ?? 0.2), 'max_tokens' => 2048]);
        if (isset($decoded['choices'][0]['message']['content'])) return (string)$decoded['choices'][0]['message']['content'];
        return '';
    }

    // OpenAI compatible
    $secrets = catn8_mystery_worker_read_ai_secrets($provider);
    $apiKey = catn8_mystery_worker_require_string($secrets['api_key'] ?? null, 'AI API key (' . $provider . ')');
    $baseUrl = trim((string)($aiCfg['base_url'] ?? ''));
    if ($provider === 'openai') {
        $client = catn8_mystery_worker_openai_client($apiKey, $baseUrl);
        $resp = $client->chat()->create(['model' => (string)($aiCfg['model'] ?? 'gpt-4o-mini'), 'messages' => $messages, 'temperature' => (float)($aiCfg['temperature'] ?? 0.2)]);
        return (string)($resp->choices[0]->message->content ?? '');
    } else {
        $root = rtrim(catn8_validate_external_base_url($baseUrl), '/');
        $url = preg_match('#/v1$#', $root) ? ($root . '/chat/completions') : ($root . '/v1/chat/completions');
        $decoded = catn8_mystery_worker_http_json('POST', $url, ['Authorization' => 'Bearer ' . $apiKey], ['model' => (string)($aiCfg['model'] ?? ''), 'messages' => $messages, 'temperature' => (float)($aiCfg['temperature'] ?? 0.2), 'max_tokens' => 2048]);
        if (isset($decoded['choices'][0]['message']['content'])) return (string)$decoded['choices'][0]['message']['content'];
        return '';
    }
}

function catn8_mystery_worker_ensure_dir(string $path): void
{
    if (is_dir($path)) {
        return;
    }
    if (!@mkdir($path, 0775, true) && !is_dir($path)) {
        throw new RuntimeException('Failed to create directory: ' . $path);
    }
}

try {
    Database::getInstance();
} catch (Throwable $e) {
    catn8_mystery_worker_err(['success' => false, 'error' => 'DB connection failed', 'details' => $e->getMessage()]);
    exit(2);
}

$job = null;

try {
    Database::beginTransaction();

    $staleMinutes = 60;
    Database::execute(
        "UPDATE mystery_generation_jobs " .
        "SET status = 'queued', error_text = ?, result_json = ? " .
        "WHERE status = 'running' AND updated_at < (NOW() - INTERVAL {$staleMinutes} MINUTE)",
        ['Requeued stale running job', json_encode(new stdClass(), JSON_UNESCAPED_SLASHES)]
    );

    $job = Database::queryOne(
        "SELECT id, game_id, scenario_id, entity_id, action, spec_json, status\n" .
        "FROM mystery_generation_jobs\n" .
        "WHERE status = 'queued'\n" .
        "ORDER BY id ASC\n" .
        "LIMIT 1\n" .
        "FOR UPDATE SKIP LOCKED"
    );

    if (!$job) {
        Database::commit();
        catn8_mystery_worker_out(['success' => true, 'claimed' => false, 'message' => 'No queued jobs']);
        exit(0);
    }

    Database::execute(
        "UPDATE mystery_generation_jobs SET status = 'running', error_text = '', result_json = ? WHERE id = ?",
        [json_encode(new stdClass(), JSON_UNESCAPED_SLASHES), (int)$job['id']]
    );

    Database::commit();
} catch (Throwable $e) {
    if (Database::inTransaction()) {
        Database::rollBack();
    }
    catn8_mystery_worker_err(['success' => false, 'error' => 'Failed to claim job', 'details' => $e->getMessage()]);
    exit(2);
}

$jobId = (int)($job['id'] ?? 0);
$gameId = (int)($job['game_id'] ?? 0);
$scenarioId = (int)($job['scenario_id'] ?? 0);
$entityId = (int)($job['entity_id'] ?? 0);
$action = (string)($job['action'] ?? '');

$jobSpec = json_decode((string)($job['spec_json'] ?? '{}'), true);
if (!is_array($jobSpec)) $jobSpec = [];

try {
    $result = null;
    $locks = [];
    if ($gameId > 0 && $scenarioId > 0) {
        $rows = Database::queryAll(
            'SELECT lock_key, is_locked FROM mystery_locks WHERE game_id = ? AND scope_type = ? AND scope_id = ? ORDER BY lock_key ASC',
            [$gameId, 'scenario', $scenarioId]
        );
        foreach ($rows as $r) {
            $locks[(string)($r['lock_key'] ?? '')] = (int)($r['is_locked'] ?? 0) ? 1 : 0;
        }
    }

    $spec = json_decode((string)($job['spec_json'] ?? '{}'), true);
    if (!is_array($spec)) {
        $spec = [];
    }

    $result = [
        'action' => $action,
        'game_id' => $gameId,
        'scenario_id' => $scenarioId,
        'entity_id' => $entityId,
        'locks' => $locks,
        'spec' => $spec,
        'processed_at' => gmdate('c'),
    ];

    if ($action === 'generate_crime_details') {
        if ($scenarioId <= 0) {
            throw new RuntimeException('generate_crime_details requires scenario_id');
        }
        if (catn8_mystery_worker_lock_on($locks, 'crime_scene') || catn8_mystery_worker_lock_on($locks, 'constraints')) {
            $result['skipped'] = 1;
            $result['skip_reason'] = 'Locked: crime_scene';
        } else {
            $scenarioRow = Database::queryOne(
                'SELECT id, game_id, slug, title, specs_json, constraints_json, crime_scene_weapon, crime_scene_location, crime_scene_motive FROM mystery_scenarios WHERE id = ?',
                [$scenarioId]
            );
            if (!$scenarioRow) {
                throw new RuntimeException('Scenario not found');
            }
            if ((int)($scenarioRow['game_id'] ?? 0) !== $gameId) {
                throw new RuntimeException('Scenario does not belong to job game');
            }

            $gameRow = Database::queryOne('SELECT mystery_id FROM mystery_games WHERE id = ? LIMIT 1', [$gameId]);
            $mysteryId = (int)($gameRow['mystery_id'] ?? 0);
            if ($mysteryId <= 0) {
                throw new RuntimeException('Case is missing mystery_id');
            }

            $specs = json_decode((string)($scenarioRow['specs_json'] ?? '{}'), true);
            if (!is_array($specs)) $specs = [];
            $constraints = json_decode((string)($scenarioRow['constraints_json'] ?? '{}'), true);
            if (!is_array($constraints)) $constraints = [];

            $caseSetup = $specs['case_setup'] ?? null;
            if (!is_array($caseSetup)) $caseSetup = [];

            $allowedLocationIds = catn8_mystery_worker_int_ids($caseSetup['available_master_location_ids'] ?? []);
            $allowedWeaponIds = catn8_mystery_worker_int_ids($caseSetup['available_master_weapon_ids'] ?? []);
            $allowedMotiveIds = catn8_mystery_worker_int_ids($caseSetup['available_master_motive_ids'] ?? []);

            $castRows = Database::queryAll(
                'SELECT se.role, e.id AS entity_id, e.name, e.data_json
                 FROM mystery_scenario_entities se
                 INNER JOIN mystery_entities e ON e.id = se.entity_id
                 WHERE se.scenario_id = ?
                 ORDER BY se.id ASC',
                [$scenarioId]
            );

            $suspects = [];
            foreach ($castRows as $r) {
                $role = (string)($r['role'] ?? '');
                if ($role !== 'suspect') continue;
                $suspects[] = [
                    'entity_id' => (int)($r['entity_id'] ?? 0),
                    'name' => (string)($r['name'] ?? ''),
                ];
            }
            if (!count($suspects)) {
                throw new RuntimeException('No suspects attached to scenario');
            }

            $killer = catn8_mystery_worker_pick($suspects);
            if (!is_array($killer)) {
                throw new RuntimeException('Failed to pick killer');
            }

            $weapon = '';
            $allowedWeapons = catn8_mystery_worker_fetch_master_names_for_mystery('mystery_master_weapons', $mysteryId, $allowedWeaponIds);
            if (count($allowedWeapons)) {
                $weapon = (string)(catn8_mystery_worker_pick($allowedWeapons) ?? '');
            }
            if ($weapon === '') {
                $evidence = $specs['evidence_database'] ?? null;
                if (is_array($evidence) && isset($evidence['weapon']) && is_array($evidence['weapon'])) {
                    $weapon = trim((string)($evidence['weapon']['name'] ?? ''));
                }
            }
            if ($weapon === '') $weapon = 'Unknown Weapon';

            $location = '';
            $allowedLocations = catn8_mystery_worker_fetch_master_names_for_mystery('mystery_master_locations', $mysteryId, $allowedLocationIds);
            if (count($allowedLocations)) {
                $location = (string)(catn8_mystery_worker_pick($allowedLocations) ?? '');
            }
            if ($location === '') {
                $locations = $specs['locations'] ?? [];
                if (!is_array($locations)) $locations = [];
                $location = (string)(catn8_mystery_worker_pick($locations) ?? 'Unknown Location');
            }

            $motive = '';
            $allowedMotives = catn8_mystery_worker_fetch_master_names_for_mystery('mystery_master_motives', $mysteryId, $allowedMotiveIds);
            if (count($allowedMotives)) {
                $motive = (string)(catn8_mystery_worker_pick($allowedMotives) ?? '');
            }
            if ($motive === '') {
                $difficulty = $constraints['difficulty_configs']['easy']['difficulty_level'] ?? null;
                if (is_string($difficulty) && strtoupper($difficulty) === 'HARD') {
                    $motive = 'Financial Greed / Inheritance';
                } else {
                    $motive = 'Revenge for Intellectual Property Theft';
                }
            }

            // Canonical crime scene fields are stored in dedicated DB columns + join table.
            Database::execute(
                'UPDATE mystery_scenarios SET crime_scene_weapon = ?, crime_scene_location = ?, crime_scene_motive = ? WHERE id = ?',
                [trim($weapon), trim($location), trim($motive), $scenarioId]
            );
            Database::execute('DELETE FROM mystery_scenario_murderers WHERE scenario_id = ?', [$scenarioId]);
            Database::execute(
                'INSERT IGNORE INTO mystery_scenario_murderers (scenario_id, entity_id) VALUES (?, ?)',
                [$scenarioId, (int)$killer['entity_id']]
            );

            $result['crime_scene'] = [
                'murderer_ids' => [(int)$killer['entity_id']],
                'weapon' => trim($weapon),
                'location' => trim($location),
                'motive' => trim($motive),
            ];
            $result['case_setup'] = [
                'available_master_location_ids' => $allowedLocationIds,
                'available_master_weapon_ids' => $allowedWeaponIds,
                'available_master_motive_ids' => $allowedMotiveIds,
            ];
        }
    } elseif ($action === 'generate_lies') {
        if ($scenarioId <= 0) {
            throw new RuntimeException('generate_lies requires scenario_id');
        }
        if (catn8_mystery_worker_lock_on($locks, 'lies')) {
            $result['skipped'] = 1;
            $result['skip_reason'] = 'Locked: lies';
        } else {
            $scenarioRow = Database::queryOne('SELECT id, game_id FROM mystery_scenarios WHERE id = ?', [$scenarioId]);
            if (!$scenarioRow) {
                throw new RuntimeException('Scenario not found');
            }
            if ((int)($scenarioRow['game_id'] ?? 0) !== $gameId) {
                throw new RuntimeException('Scenario does not belong to job game');
            }

            Database::execute('DELETE FROM mystery_scenario_lies WHERE scenario_id = ?', [$scenarioId]);

            $castRows = Database::queryAll(
                'SELECT se.role, e.id AS entity_id, e.name, e.data_json
                 FROM mystery_scenario_entities se
                 INNER JOIN mystery_entities e ON e.id = se.entity_id
                 WHERE se.scenario_id = ?
                 ORDER BY se.id ASC',
                [$scenarioId]
            );

            $created = 0;
            foreach ($castRows as $r) {
                if ((string)($r['role'] ?? '') !== 'suspect') continue;
                $eid = (int)($r['entity_id'] ?? 0);
                if ($eid <= 0) continue;
                $name = (string)($r['name'] ?? '');

                $topicKey = 'timeline.alibi';
                $lieText = $name . ' claims they never left the Great Room after midnight.';
                $truthText = $name . ' stepped out briefly, but insists it was unrelated.';

                $triggers = [
                    'Where were you between midnight and 1:30?',
                    'Who can confirm your alibi?',
                ];

                Database::execute(
                    'INSERT INTO mystery_scenario_lies (scenario_id, entity_id, lie_type, topic_key, lie_text, truth_text, trigger_questions_json, relevance, notes)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        $scenarioId,
                        $eid,
                        'omission',
                        $topicKey,
                        $lieText,
                        $truthText,
                        json_encode($triggers, JSON_UNESCAPED_SLASHES),
                        'medium',
                        'Seeded lie/truth pack (non-AI). Refine later with AI generation.',
                    ]
                );
                $created++;
            }

            $result['lies_created'] = $created;
        }
    } elseif ($action === 'generate_story_narrative') {
        if ($scenarioId <= 0) {
            throw new RuntimeException('generate_story_narrative requires scenario_id');
        }
        if (catn8_mystery_worker_lock_on($locks, 'constraints') || catn8_mystery_worker_lock_on($locks, 'story')) {
            $result['skipped'] = 1;
            $result['skip_reason'] = 'Locked: story/constraints';
        } else {
            $aiCfg = catn8_mystery_worker_read_ai_config();

            $provider = strtolower(trim((string)($aiCfg['provider'] ?? '')));

            $scenarioRow = Database::queryOne(
                'SELECT id, game_id, slug, title, specs_json, constraints_json FROM mystery_scenarios WHERE id = ?',
                [$scenarioId]
            );
            if (!$scenarioRow) {
                throw new RuntimeException('Scenario not found');
            }
            if ((int)($scenarioRow['game_id'] ?? 0) !== $gameId) {
                throw new RuntimeException('Scenario does not belong to job game');
            }

            $specs = json_decode((string)($scenarioRow['specs_json'] ?? '{}'), true);
            if (!is_array($specs)) $specs = [];
            $constraints = json_decode((string)($scenarioRow['constraints_json'] ?? '{}'), true);
            if (!is_array($constraints)) $constraints = [];

            $weapon = trim((string)($scenarioRow['crime_scene_weapon'] ?? ''));
            $location = trim((string)($scenarioRow['crime_scene_location'] ?? ''));
            $motive = trim((string)($scenarioRow['crime_scene_motive'] ?? ''));

            $gameRow = Database::queryOne('SELECT mystery_id FROM mystery_games WHERE id = ? LIMIT 1', [$gameId]);
            $mysteryId = (int)($gameRow['mystery_id'] ?? 0);
            if ($mysteryId <= 0) {
                throw new RuntimeException('Case is missing mystery_id');
            }

            $mysteryOwnerRow = Database::queryOne('SELECT owner_user_id FROM mystery_mysteries WHERE id = ? LIMIT 1', [$mysteryId]);
            $mysteryOwnerUserId = (int)($mysteryOwnerRow['owner_user_id'] ?? 0);

            $storyBookEntryId = (int)($jobSpec['story_book_entry_id'] ?? 0);
            if ($storyBookEntryId < 0) $storyBookEntryId = 0;
            $storyBook = null;
            if ($storyBookEntryId > 0) {
                $sbRow = Database::queryOne(
                    'SELECT id, owner_user_id, slug, title, source_text, meta_json FROM mystery_story_book_entries WHERE id = ? LIMIT 1',
                    [$storyBookEntryId]
                );
                if (!$sbRow) {
                    throw new RuntimeException('Story Book entry not found');
                }
                $sbOwner = (int)($sbRow['owner_user_id'] ?? 0);
                if ($sbOwner !== 0 && $mysteryOwnerUserId > 0 && $sbOwner !== $mysteryOwnerUserId) {
                    throw new RuntimeException('Story Book entry is not accessible for this mystery owner');
                }
                $meta = json_decode((string)($sbRow['meta_json'] ?? '{}'), true);
                if (!is_array($meta)) $meta = [];
                $storyBook = [
                    'id' => (int)($sbRow['id'] ?? 0),
                    'slug' => (string)($sbRow['slug'] ?? ''),
                    'title' => (string)($sbRow['title'] ?? ''),
                    'source_text' => (string)($sbRow['source_text'] ?? ''),
                    'meta' => $meta,
                ];
            }

            $murdererRows = Database::queryAll('SELECT entity_id FROM mystery_scenario_murderers WHERE scenario_id = ? ORDER BY id ASC', [$scenarioId]);
            $killerIds = [];
            foreach ($murdererRows as $mr) {
                $eid = (int)($mr['entity_id'] ?? 0);
                if ($eid > 0) $killerIds[] = $eid;
            }

            $caseSetup = $specs['case_setup'] ?? null;
            if (!is_array($caseSetup)) $caseSetup = [];

            $allowedLocationIds = catn8_mystery_worker_int_ids($caseSetup['available_master_location_ids'] ?? []);
            $allowedWeaponIds = catn8_mystery_worker_int_ids($caseSetup['available_master_weapon_ids'] ?? []);
            $allowedMotiveIds = catn8_mystery_worker_int_ids($caseSetup['available_master_motive_ids'] ?? []);

            $allowedWeapons = catn8_mystery_worker_fetch_master_names_for_mystery('mystery_master_weapons', $mysteryId, $allowedWeaponIds);
            $allowedMotives = catn8_mystery_worker_fetch_master_names_for_mystery('mystery_master_motives', $mysteryId, $allowedMotiveIds);
            $allowedLocations = catn8_mystery_worker_fetch_master_names_for_mystery('mystery_master_locations', $mysteryId, $allowedLocationIds);

            if ($weapon === '' || $location === '' || $motive === '' || !count($killerIds)) {
                $caseSetup = $specs['case_setup'] ?? null;
                if (!is_array($caseSetup)) $caseSetup = [];

                if ($weapon === '') {
                    if (count($allowedWeapons)) {
                        $weapon = (string)(catn8_mystery_worker_pick($allowedWeapons) ?? '');
                    }
                    if ($weapon === '') {
                        $evidence = $specs['evidence_database'] ?? null;
                        if (is_array($evidence) && isset($evidence['weapon']) && is_array($evidence['weapon'])) {
                            $weapon = trim((string)($evidence['weapon']['name'] ?? ''));
                        }
                    }
                    if ($weapon === '') $weapon = 'Unknown Weapon';
                }

                if ($location === '') {
                    if (count($allowedLocations)) {
                        $location = (string)(catn8_mystery_worker_pick($allowedLocations) ?? '');
                    }
                    if ($location === '') {
                        $locations = $specs['locations'] ?? [];
                        if (!is_array($locations)) $locations = [];
                        $location = (string)(catn8_mystery_worker_pick($locations) ?? 'Unknown Location');
                    }
                }

                if ($motive === '') {
                    if (count($allowedMotives)) {
                        $motive = (string)(catn8_mystery_worker_pick($allowedMotives) ?? '');
                    }
                    if ($motive === '') {
                        $difficulty = $constraints['difficulty_configs']['easy']['difficulty_level'] ?? null;
                        if (is_string($difficulty) && strtoupper($difficulty) === 'HARD') {
                            $motive = 'Financial Greed / Inheritance';
                        } else {
                            $motive = 'Revenge for Intellectual Property Theft';
                        }
                    }
                }

                if (!count($killerIds)) {
                    $suspects = [];
                    $castRowsForKiller = Database::queryAll(
                        'SELECT se.role, e.id AS entity_id, e.name
                         FROM mystery_scenario_entities se
                         INNER JOIN mystery_entities e ON e.id = se.entity_id
                         WHERE se.scenario_id = ?
                         ORDER BY se.id ASC',
                        [$scenarioId]
                    );
                    foreach ($castRowsForKiller as $r) {
                        if ((string)($r['role'] ?? '') !== 'suspect') continue;
                        $suspects[] = ['entity_id' => (int)($r['entity_id'] ?? 0), 'name' => (string)($r['name'] ?? '')];
                    }
                    if (count($suspects)) {
                        $killer = catn8_mystery_worker_pick($suspects);
                        if (is_array($killer) && (int)($killer['entity_id'] ?? 0) > 0) {
                            $killerIds = [(int)$killer['entity_id']];
                        }
                    }
                }

                Database::execute(
                    'UPDATE mystery_scenarios SET crime_scene_weapon = ?, crime_scene_location = ?, crime_scene_motive = ? WHERE id = ?',
                    [trim($weapon), trim($location), trim($motive), $scenarioId]
                );
                if (count($killerIds)) {
                    Database::execute('DELETE FROM mystery_scenario_murderers WHERE scenario_id = ?', [$scenarioId]);
                    foreach ($killerIds as $eid) {
                        Database::execute('INSERT IGNORE INTO mystery_scenario_murderers (scenario_id, entity_id) VALUES (?, ?)', [$scenarioId, (int)$eid]);
                    }
                }
            }
            $killerId = (int)($killerIds[0] ?? 0);

            $castRows = Database::queryAll(
                'SELECT se.id AS se_id, se.role, se.override_json, e.id AS entity_id, e.slug, e.name, e.data_json
                 FROM mystery_scenario_entities se
                 INNER JOIN mystery_entities e ON e.id = se.entity_id
                 WHERE se.scenario_id = ?
                 ORDER BY se.id ASC',
                [$scenarioId]
            );

            $cast = [];
            foreach ($castRows as $r) {
                $data = json_decode((string)($r['data_json'] ?? '{}'), true);
                if (!is_array($data)) $data = [];
                $override = json_decode((string)($r['override_json'] ?? '{}'), true);
                if (!is_array($override)) $override = [];
                $cast[] = [
                    'entity_id' => (int)($r['entity_id'] ?? 0),
                    'slug' => (string)($r['slug'] ?? ''),
                    'name' => (string)($r['name'] ?? ''),
                    'role' => (string)($r['role'] ?? ''),
                    'data' => $data,
                    'override' => $override,
                ];
            }

            $systemPrompt = trim((string)($aiCfg['system_prompt'] ?? ''));
            $userPrompt = json_encode([
                'task' => 'Generate a Murder-She-Wrote-style murder mystery narrative with a script-like structure, plus per-character knowledge packets and lies.',
                'requirements' => [
                    'Return JSON only. Output must match schema exactly.',
                    'Ensure there is at least 1 witness role in the story, chosen from the existing cast list (use an existing cast entity_id). Do not invent or create new characters.',
                    'Story should be detailed but not overly verbose.',
                    'Write story like a movie script so it is clear who knows what.',
                    'Each character should know only their part of the story.',
                    'Provide per-character interrogation guidance: truths, evasions, and lies with why.',
                    'If a Story Book entry is provided, treat it as a reference mystery to adapt. Do not keep its original character/location names: replace them with this case\'s cast and locations.',
                    'Map reference characters/locations to existing case entities/locations as best you can. Do not introduce any new named characters; any witness must be an existing cast member.',
                    'Weapons and motives are different: you may use an existing allowed weapon/motive if it matches; otherwise propose a NEW weapon/motive name that fits the story. The system may add it to the master roster.',
                ],
                'schema' => [
                    'story' => [
                        'title' => 'string',
                        'logline' => 'string',
                        'briefing' => 'string',
                        'weapon' => 'string',
                        'motive' => 'string',
                        'timeline' => [
                            ['time' => 'string', 'beat' => 'string', 'public_summary' => 'string'],
                        ],
                        'scenes' => [
                            [
                                'scene_id' => 'string',
                                'setting' => 'string',
                                'summary' => 'string',
                                'dialogue_snippets' => [
                                    ['speaker' => 'string', 'line' => 'string'],
                                ],
                            ],
                        ],
                    ],
                    'per_entity' => [
                        [
                            'entity_id' => 'int',
                            'role' => 'string',
                            'public_context' => [
                                'why_here' => 'string',
                                'relationship_to_victim' => 'string',
                                'what_others_think' => 'string',
                            ],
                            'private_knowledge' => [
                                'what_i_did' => 'string',
                                'what_i_saw' => 'string',
                                'secrets' => ['string'],
                                'who_i_suspect' => 'string',
                            ],
                            'interrogation' => [
                                'truths' => ['string'],
                                'evasions' => ['string'],
                            ],
                            'lies' => [
                                [
                                    'topic_key' => 'string',
                                    'lie_type' => 'omission|white_lie|direct',
                                    'lie_text' => 'string',
                                    'truth_text' => 'string',
                                    'why_lie' => 'string',
                                    'trigger_questions' => ['string'],
                                    'relevance' => 'low|medium|high',
                                ],
                            ],
                            'profile_patch' => [
                                'static_profile' => 'object',
                            ],
                        ],
                    ],
                ],
                'context' => [
                    'scenario' => [
                        'id' => (int)($scenarioRow['id'] ?? 0),
                        'title' => (string)($scenarioRow['title'] ?? ''),
                        'specs' => $specs,
                        'constraints' => $constraints,
                    ],
                    'crime_scene' => [
                        'killer_entity_id' => $killerId,
                        'weapon' => (string)$weapon,
                        'location' => (string)$location,
                        'motive' => (string)$motive,
                    ],
                    'allowed' => [
                        'weapons' => $allowedWeapons,
                        'motives' => $allowedMotives,
                        'locations' => $allowedLocations,
                    ],
                    'story_book' => $storyBook,
                    'cast' => $cast,
                ],
            ], JSON_UNESCAPED_SLASHES);

            $messages = [];
            if ($systemPrompt !== '') {
                $messages[] = ['role' => 'system', 'content' => $systemPrompt];
            }
            $messages[] = ['role' => 'user', 'content' => $userPrompt];

            $content = '';

            if ($provider === 'google_vertex_ai') {
                require_once __DIR__ . '/../../includes/vertex_ai_gemini.php';

                $secrets = catn8_mystery_worker_read_ai_secrets($provider);
                $saJson = catn8_mystery_worker_require_string(
                    is_string($secrets['service_account_json'] ?? null) ? (string)$secrets['service_account_json'] : null,
                    'AI service account JSON (google_vertex_ai)'
                );

                $sa = json_decode($saJson, true);
                if (!is_array($sa)) {
                    throw new RuntimeException('AI Vertex service account JSON is not valid JSON');
                }

                $projectId = trim((string)($sa['project_id'] ?? ''));
                if ($projectId === '') {
                    throw new RuntimeException('AI Vertex service account JSON missing project_id');
                }

                $location = trim((string)($aiCfg['location'] ?? ''));
                if ($location === '') {
                    throw new RuntimeException('Missing Vertex AI location in AI config');
                }

                $model = catn8_mystery_worker_require_string(trim((string)($aiCfg['model'] ?? '')) !== '' ? (string)$aiCfg['model'] : null, 'Vertex model');

                $content = catn8_vertex_ai_gemini_generate_text([
                    'service_account_json' => $saJson,
                    'project_id' => $projectId,
                    'location' => $location,
                    'model' => $model,
                    'system_prompt' => $systemPrompt,
                    'user_prompt' => $userPrompt,
                    'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
                    'max_output_tokens' => 4096,
                ]);
            } elseif ($provider === 'anthropic') {
                $secrets = catn8_mystery_worker_read_ai_secrets($provider);
                $apiKey = catn8_mystery_worker_require_string(
                    is_string($secrets['api_key'] ?? null) ? (string)$secrets['api_key'] : null,
                    'AI API key (anthropic)'
                );

                $body = [
                    'model' => catn8_mystery_worker_require_string(trim((string)($aiCfg['model'] ?? '')) !== '' ? (string)$aiCfg['model'] : null, 'Anthropic model'),
                    'max_tokens' => 4096,
                    'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
                    'messages' => [
                        ['role' => 'user', 'content' => $userPrompt],
                    ],
                ];
                if ($systemPrompt !== '') {
                    $body['system'] = $systemPrompt;
                }

                $decoded = catn8_mystery_worker_http_json(
                    'POST',
                    'https://api.anthropic.com/v1/messages',
                    [
                        'x-api-key' => $apiKey,
                        'anthropic-version' => '2023-06-01',
                    ],
                    $body
                );

                $parts = $decoded['content'] ?? null;
                if (is_array($parts) && isset($parts[0]) && is_array($parts[0]) && isset($parts[0]['text']) && is_string($parts[0]['text'])) {
                    $content = (string)$parts[0]['text'];
                }
            } elseif ($provider === 'google_ai_studio') {
                $secrets = catn8_mystery_worker_read_ai_secrets($provider);
                $apiKey = catn8_mystery_worker_require_string(
                    is_string($secrets['api_key'] ?? null) ? (string)$secrets['api_key'] : null,
                    'AI API key (google_ai_studio)'
                );

                $model = catn8_mystery_worker_require_string(trim((string)($aiCfg['model'] ?? '')) !== '' ? (string)$aiCfg['model'] : null, 'Google AI Studio model');
                $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent?key=' . rawurlencode($apiKey);

                $body = [
                    'contents' => [
                        ['role' => 'user', 'parts' => [['text' => $userPrompt]]],
                    ],
                    'generationConfig' => [
                        'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
                    ],
                ];
                if ($systemPrompt !== '') {
                    $body['systemInstruction'] = ['parts' => [['text' => $systemPrompt]]];
                }

                $decoded = catn8_mystery_worker_http_json('POST', $url, [], $body);
                $candidates = $decoded['candidates'] ?? null;
                if (is_array($candidates) && isset($candidates[0]) && is_array($candidates[0])) {
                    $candContent = $candidates[0]['content'] ?? null;
                    $candParts = is_array($candContent) ? ($candContent['parts'] ?? null) : null;
                    if (is_array($candParts) && isset($candParts[0]) && is_array($candParts[0]) && isset($candParts[0]['text']) && is_string($candParts[0]['text'])) {
                        $content = (string)$candParts[0]['text'];
                    }
                }
            } elseif ($provider === 'azure_openai') {
                $secrets = catn8_mystery_worker_read_ai_secrets($provider);
                $apiKey = catn8_mystery_worker_require_string(
                    is_string($secrets['api_key'] ?? null) ? (string)$secrets['api_key'] : null,
                    'AI API key (azure_openai)'
                );

                $pc = $aiCfg['provider_config'] ?? [];
                if (!is_array($pc)) {
                    $pc = [];
                }

                $endpoint = catn8_mystery_worker_require_string(is_string($pc['azure_endpoint'] ?? null) ? (string)$pc['azure_endpoint'] : null, 'Endpoint (Azure OpenAI)');
                $deployment = catn8_mystery_worker_require_string(is_string($pc['azure_deployment'] ?? null) ? (string)$pc['azure_deployment'] : null, 'Deployment (Azure OpenAI)');
                $apiVersion = catn8_mystery_worker_require_string(is_string($pc['azure_api_version'] ?? null) ? (string)$pc['azure_api_version'] : null, 'API Version (Azure OpenAI)');

                $endpoint = rtrim(catn8_validate_external_base_url($endpoint), '/');
                $url = $endpoint . '/openai/deployments/' . rawurlencode($deployment) . '/chat/completions?api-version=' . rawurlencode($apiVersion);

                $decoded = catn8_mystery_worker_http_json(
                    'POST',
                    $url,
                    ['api-key' => $apiKey],
                    [
                        'messages' => $messages,
                        'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
                        'max_tokens' => 4096,
                    ]
                );

                $choices = $decoded['choices'] ?? null;
                if (is_array($choices) && isset($choices[0]) && is_array($choices[0])) {
                    $msg = $choices[0]['message'] ?? null;
                    if (is_array($msg) && isset($msg['content']) && is_string($msg['content'])) {
                        $content = (string)$msg['content'];
                    }
                }
            } elseif ($provider === 'openai' || $provider === 'together_ai' || $provider === 'fireworks_ai' || $provider === 'huggingface') {
                $secrets = catn8_mystery_worker_read_ai_secrets($provider);
                $apiKey = catn8_mystery_worker_require_string(
                    is_string($secrets['api_key'] ?? null) ? (string)$secrets['api_key'] : null,
                    'AI API key (' . $provider . ')'
                );

                $baseUrl = trim((string)($aiCfg['base_url'] ?? ''));
                if ($provider !== 'openai' && $baseUrl === '') {
                    throw new RuntimeException('Missing base_url in AI config for provider ' . $provider);
                }

                if ($baseUrl !== '') {
                    $baseUrl = catn8_validate_external_base_url($baseUrl);
                }

                if ($provider === 'openai') {
                    $client = catn8_mystery_worker_openai_client($apiKey, $baseUrl);
                    $resp = $client->chat()->create([
                        'model' => (string)($aiCfg['model'] ?? 'gpt-4o-mini'),
                        'messages' => $messages,
                        'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
                    ]);
                    if (isset($resp->choices[0]->message->content)) {
                        $content = (string)$resp->choices[0]->message->content;
                    }
                } else {
                    $root = rtrim($baseUrl, '/');
                    $url = preg_match('#/v1$#', $root) ? ($root . '/chat/completions') : ($root . '/v1/chat/completions');
                    $decoded = catn8_mystery_worker_http_json(
                        'POST',
                        $url,
                        ['Authorization' => 'Bearer ' . $apiKey],
                        [
                            'model' => (string)($aiCfg['model'] ?? ''),
                            'messages' => $messages,
                            'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
                            'max_tokens' => 4096,
                        ]
                    );
                    $choices = $decoded['choices'] ?? null;
                    if (is_array($choices) && isset($choices[0]) && is_array($choices[0])) {
                        $msg = $choices[0]['message'] ?? null;
                        if (is_array($msg) && isset($msg['content']) && is_string($msg['content'])) {
                            $content = (string)$msg['content'];
                        }
                    }
                }
            } else {
                throw new RuntimeException('Unsupported AI provider: ' . (string)($aiCfg['provider'] ?? ''));
            }

            if (trim($content) === '') {
                throw new RuntimeException('AI response was empty');
            }

            $jsonText = catn8_mystery_worker_extract_json_from_text($content);
            $parsed = json_decode($jsonText, true);
            if (!is_array($parsed) || !isset($parsed['story']) || !is_array($parsed['story']) || !isset($parsed['per_entity']) || !is_array($parsed['per_entity'])) {
                $result['ai_raw_preview'] = substr($content, 0, 20000);
                $result['ai_json_preview'] = substr($jsonText, 0, 20000);
                throw new RuntimeException('AI response was not valid JSON matching schema');
            }

            $proposedWeapon = '';
            $proposedMotive = '';
            if (isset($parsed['story']) && is_array($parsed['story'])) {
                $proposedWeapon = trim((string)($parsed['story']['weapon'] ?? ''));
                $proposedMotive = trim((string)($parsed['story']['motive'] ?? ''));
            }

            $proposedWeaponUsed = '';
            if ($proposedWeapon !== '') {
                $ok = false;
                foreach ($allowedWeapons as $n) {
                    if (strcasecmp(trim((string)$n), $proposedWeapon) === 0) {
                        $ok = true;
                        $proposedWeaponUsed = (string)$n;
                        break;
                    }
                }
                if (!$ok) {
                    $slug = catn8_mystery_worker_unique_slug($proposedWeapon, static function (string $candidate) use ($mysteryId): bool {
                        return Database::queryOne('SELECT id FROM mystery_master_weapons WHERE mystery_id = ? AND slug = ? LIMIT 1', [$mysteryId, $candidate]) !== null;
                    });
                    Database::execute(
                        'INSERT INTO mystery_master_weapons (mystery_id, slug, name, description, is_archived) VALUES (?, ?, ?, ?, 0) ON DUPLICATE KEY UPDATE name = VALUES(name)',
                        [$mysteryId, $slug, $proposedWeapon, null]
                    );
                    $allowedWeapons[] = $proposedWeapon;
                    $proposedWeaponUsed = $proposedWeapon;
                }
            }

            $proposedMotiveUsed = '';
            if ($proposedMotive !== '') {
                $ok = false;
                foreach ($allowedMotives as $n) {
                    if (strcasecmp(trim((string)$n), $proposedMotive) === 0) {
                        $ok = true;
                        $proposedMotiveUsed = (string)$n;
                        break;
                    }
                }
                if (!$ok) {
                    $slug = catn8_mystery_worker_unique_slug($proposedMotive, static function (string $candidate) use ($mysteryId): bool {
                        return Database::queryOne('SELECT id FROM mystery_master_motives WHERE mystery_id = ? AND slug = ? LIMIT 1', [$mysteryId, $candidate]) !== null;
                    });
                    Database::execute(
                        'INSERT INTO mystery_master_motives (mystery_id, slug, name, description, is_archived) VALUES (?, ?, ?, ?, 0) ON DUPLICATE KEY UPDATE name = VALUES(name)',
                        [$mysteryId, $slug, $proposedMotive, null]
                    );
                    $allowedMotives[] = $proposedMotive;
                    $proposedMotiveUsed = $proposedMotive;
                }
            }

            if ($proposedWeaponUsed !== '') {
                $weapon = $proposedWeaponUsed;
            }
            if ($proposedMotiveUsed !== '') {
                $motive = $proposedMotiveUsed;
            }
            if ($weapon !== '' || $motive !== '') {
                Database::execute(
                    'UPDATE mystery_scenarios SET crime_scene_weapon = ?, crime_scene_motive = ? WHERE id = ?',
                    [trim((string)$weapon), trim((string)$motive), $scenarioId]
                );
            }

            $coldHardFactsText = "";
            if (isset($parsed['story']) && is_array($parsed['story'])) {
                $st = $parsed['story'];
                $parts = [];

                $title = trim((string)($st['title'] ?? ''));
                if ($title !== '') $parts[] = "TITLE: " . $title;

                $logline = trim((string)($st['logline'] ?? ''));
                if ($logline !== '') $parts[] = "LOGLINE: " . $logline;

                $brief = trim((string)($st['briefing'] ?? ''));
                if ($brief !== '') $parts[] = "BRIEFING: " . $brief;

                $timeline = $st['timeline'] ?? null;
                if (is_array($timeline) && count($timeline)) {
                    $parts[] = "";
                    $parts[] = "TIMELINE:";
                    foreach ($timeline as $t) {
                        if (!is_array($t)) continue;
                        $time = trim((string)($t['time'] ?? ''));
                        $beat = trim((string)($t['beat'] ?? ''));
                        $public = trim((string)($t['public_summary'] ?? ''));
                        $line = '';
                        if ($time !== '') $line .= $time . ' — ';
                        $line .= ($beat !== '' ? $beat : 'Beat');
                        if ($public !== '') $line .= " (" . $public . ")";
                        $line = trim($line);
                        if ($line !== '') $parts[] = $line;
                    }
                }

                $scenes = $st['scenes'] ?? null;
                if (is_array($scenes) && count($scenes)) {
                    $parts[] = "";
                    $parts[] = "SCENES:";
                    foreach ($scenes as $s) {
                        if (!is_array($s)) continue;
                        $sceneId = trim((string)($s['scene_id'] ?? ''));
                        $setting = trim((string)($s['setting'] ?? ''));
                        $summary = trim((string)($s['summary'] ?? ''));

                        $header = 'Scene';
                        if ($sceneId !== '') $header .= ' ' . $sceneId;
                        if ($setting !== '') $header .= ' — ' . $setting;
                        $parts[] = $header;
                        if ($summary !== '') $parts[] = $summary;

                        $snips = $s['dialogue_snippets'] ?? null;
                        if (is_array($snips) && count($snips)) {
                            foreach ($snips as $d) {
                                if (!is_array($d)) continue;
                                $speaker = trim((string)($d['speaker'] ?? ''));
                                $line = trim((string)($d['line'] ?? ''));
                                if ($line === '') continue;
                                if ($speaker !== '') $parts[] = $speaker . ': ' . $line;
                                else $parts[] = $line;
                            }
                        }

                        $parts[] = "";
                    }
                }

                $coldHardFactsText = trim(implode("\n", $parts));
            }

            if ($coldHardFactsText !== '') {
                Database::execute(
                    'INSERT IGNORE INTO mystery_scenario_cold_hard_facts (scenario_id, cold_hard_facts_text, annotations_json) VALUES (?, ?, ?)',
                    [$scenarioId, '', json_encode([])]
                );
                Database::execute(
                    'UPDATE mystery_scenario_cold_hard_facts SET cold_hard_facts_text = ? WHERE scenario_id = ?',
                    [$coldHardFactsText, $scenarioId]
                );
                $result['cold_hard_facts_updated'] = 1;
            }

            $constraints['briefing'] = isset($constraints['briefing']) && is_array($constraints['briefing']) ? $constraints['briefing'] : [];
            $briefing = '';
            if (isset($parsed['story']) && is_array($parsed['story'])) {
                if (!array_key_exists('briefing', $parsed['story'])) {
                    throw new RuntimeException('AI response story is missing required field: briefing');
                }
                $briefing = (string)($parsed['story']['briefing'] ?? '');
            }
            $constraints['briefing']['narrative_text'] = $briefing;
            $constraints['briefing']['script'] = $parsed['story'];

            Database::execute(
                'UPDATE mystery_scenarios SET constraints_json = ? WHERE id = ?',
                [json_encode($constraints, JSON_UNESCAPED_SLASHES), $scenarioId]
            );

            Database::execute('DELETE FROM mystery_scenario_lies WHERE scenario_id = ?', [$scenarioId]);

            $updatedEntities = 0;
            $insertedLies = 0;

            foreach ($parsed['per_entity'] as $pe) {
                if (!is_array($pe)) continue;
                $eid = (int)($pe['entity_id'] ?? 0);
                if ($eid <= 0) continue;

                $row = Database::queryOne(
                    'SELECT override_json FROM mystery_scenario_entities WHERE scenario_id = ? AND entity_id = ? LIMIT 1',
                    [$scenarioId, $eid]
                );
                if (!$row) continue;
                $override = json_decode((string)($row['override_json'] ?? '{}'), true);
                if (!is_array($override)) $override = [];

                $patch = $pe['profile_patch'] ?? null;
                if (!is_array($patch)) $patch = [];

                $override['mystery_context'] = [
                    'public_context' => (isset($pe['public_context']) && is_array($pe['public_context'])) ? $pe['public_context'] : new stdClass(),
                    'private_knowledge' => (isset($pe['private_knowledge']) && is_array($pe['private_knowledge'])) ? $pe['private_knowledge'] : new stdClass(),
                    'interrogation' => (isset($pe['interrogation']) && is_array($pe['interrogation'])) ? $pe['interrogation'] : new stdClass(),
                ];

                $override = catn8_mystery_worker_merge_deep($override, $patch);

                Database::execute(
                    'UPDATE mystery_scenario_entities SET override_json = ? WHERE scenario_id = ? AND entity_id = ?',
                    [json_encode($override, JSON_UNESCAPED_SLASHES), $scenarioId, $eid]
                );
                $updatedEntities++;

                $lies = $pe['lies'] ?? null;
                if (is_array($lies)) {
                    foreach ($lies as $l) {
                        if (!is_array($l)) continue;
                        $topicKey = trim((string)($l['topic_key'] ?? ''));
                        $lieType = trim((string)($l['lie_type'] ?? ''));
                        $lieText = (string)($l['lie_text'] ?? '');
                        $truthText = (string)($l['truth_text'] ?? '');
                        $why = (string)($l['why_lie'] ?? '');
                        $triggers = $l['trigger_questions'] ?? [];
                        if (!is_array($triggers)) $triggers = [];
                        $relevance = trim((string)($l['relevance'] ?? 'low'));
                        if ($topicKey === '' || $lieType === '' || trim($lieText) === '' || trim($truthText) === '') continue;

                        Database::execute(
                            'INSERT INTO mystery_scenario_lies (scenario_id, entity_id, lie_type, topic_key, lie_text, truth_text, trigger_questions_json, relevance, notes)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                            [
                                $scenarioId,
                                $eid,
                                $lieType,
                                $topicKey,
                                $lieText,
                                $truthText,
                                json_encode($triggers, JSON_UNESCAPED_SLASHES),
                                ($relevance !== '' ? $relevance : 'low'),
                                $why,
                            ]
                        );
                        $insertedLies++;
                    }
                }
            }

            $result['entities_updated'] = $updatedEntities;
            $result['lies_inserted'] = $insertedLies;
        }
    } elseif ($action === 'generate_briefing') {
        if ($scenarioId <= 0) {
            throw new RuntimeException('generate_briefing requires scenario_id');
        }
        if (catn8_mystery_worker_lock_on($locks, 'constraints')) {
            $result['skipped'] = 1;
            $result['skip_reason'] = 'Locked: constraints';
        } else {
            $aiCfg = catn8_mystery_worker_read_ai_config();
            $provider = strtolower(trim((string)($aiCfg['provider'] ?? '')));

            $scenarioRow = Database::queryOne(
                'SELECT id, game_id, slug, title, specs_json, constraints_json, crime_scene_weapon, crime_scene_location, crime_scene_motive FROM mystery_scenarios WHERE id = ?',
                [$scenarioId]
            );
            if (!$scenarioRow) {
                throw new RuntimeException('Scenario not found');
            }
            if ((int)($scenarioRow['game_id'] ?? 0) !== $gameId) {
                throw new RuntimeException('Scenario does not belong to job game');
            }

            $specs = json_decode((string)($scenarioRow['specs_json'] ?? '{}'), true);
            if (!is_array($specs)) $specs = [];
            $constraints = json_decode((string)($scenarioRow['constraints_json'] ?? '{}'), true);
            if (!is_array($constraints)) $constraints = [];

            $weapon = trim((string)($scenarioRow['crime_scene_weapon'] ?? ''));
            $location = trim((string)($scenarioRow['crime_scene_location'] ?? ''));
            $motive = trim((string)($scenarioRow['crime_scene_motive'] ?? ''));
            if ($weapon === '' || $location === '' || $motive === '') {
                throw new RuntimeException('generate_briefing requires crime scene fields (weapon, location, motive)');
            }

            $murdererRows = Database::queryAll('SELECT entity_id FROM mystery_scenario_murderers WHERE scenario_id = ? ORDER BY id ASC', [$scenarioId]);
            $killerIds = [];
            foreach ($murdererRows as $mr) {
                $eid = (int)($mr['entity_id'] ?? 0);
                if ($eid > 0) $killerIds[] = $eid;
            }
            $killerId = (int)($killerIds[0] ?? 0);

            $castRows = Database::queryAll(
                'SELECT se.role, se.override_json, e.id AS entity_id, e.slug, e.name, e.data_json
                 FROM mystery_scenario_entities se
                 INNER JOIN mystery_entities e ON e.id = se.entity_id
                 WHERE se.scenario_id = ?
                 ORDER BY se.id ASC',
                [$scenarioId]
            );
            $cast = [];
            foreach ($castRows as $r) {
                $data = json_decode((string)($r['data_json'] ?? '{}'), true);
                if (!is_array($data)) $data = [];
                $override = json_decode((string)($r['override_json'] ?? '{}'), true);
                if (!is_array($override)) $override = [];
                $cast[] = [
                    'entity_id' => (int)($r['entity_id'] ?? 0),
                    'slug' => (string)($r['slug'] ?? ''),
                    'name' => (string)($r['name'] ?? ''),
                    'role' => (string)($r['role'] ?? ''),
                    'data' => $data,
                    'override' => $override,
                ];
            }

            $systemPrompt = trim((string)($aiCfg['system_prompt'] ?? ''));
            $userPrompt = json_encode([
                'task' => 'Write a short detective briefing for the scenario. This is a concise, readable summary presented to investigators.',
                'requirements' => [
                    'Return JSON only. Output must match schema exactly.',
                    'Briefing should be short (1-3 paragraphs) and should not include a full screenplay or long timeline.',
                    'Do not contradict the crime scene fields (weapon, motive, location) and do not contradict the known killer entity_id if provided.',
                    'Do not introduce new named characters; only refer to characters from cast.',
                ],
                'schema' => [
                    'briefing' => 'string',
                ],
                'context' => [
                    'scenario' => [
                        'id' => (int)($scenarioRow['id'] ?? 0),
                        'title' => (string)($scenarioRow['title'] ?? ''),
                        'specs' => $specs,
                        'constraints' => $constraints,
                    ],
                    'crime_scene' => [
                        'killer_entity_id' => $killerId,
                        'weapon' => $weapon,
                        'location' => $location,
                        'motive' => $motive,
                    ],
                    'cast' => $cast,
                ],
            ], JSON_UNESCAPED_SLASHES);
            if (!is_string($userPrompt)) {
                throw new RuntimeException('Failed to encode user prompt');
            }

            $content = '';
            if ($provider === 'google_vertex_ai') {
                require_once __DIR__ . '/../../includes/vertex_ai_gemini.php';

                $secrets = catn8_mystery_worker_read_ai_secrets($provider);
                $saJson = catn8_mystery_worker_require_string(
                    is_string($secrets['service_account_json'] ?? null) ? (string)$secrets['service_account_json'] : null,
                    'AI service account JSON (google_vertex_ai)'
                );

                $sa = json_decode($saJson, true);
                if (!is_array($sa)) {
                    throw new RuntimeException('AI Vertex service account JSON is not valid JSON');
                }

                $projectId = trim((string)($sa['project_id'] ?? ''));
                if ($projectId === '') {
                    throw new RuntimeException('AI Vertex service account JSON missing project_id');
                }

                $locationCfg = trim((string)($aiCfg['location'] ?? ''));
                if ($locationCfg === '') {
                    throw new RuntimeException('Missing Vertex AI location in AI config');
                }

                $model = catn8_mystery_worker_require_string(trim((string)($aiCfg['model'] ?? '')) !== '' ? (string)$aiCfg['model'] : null, 'Vertex model');

                $content = catn8_vertex_ai_gemini_generate_text([
                    'service_account_json' => $saJson,
                    'project_id' => $projectId,
                    'location' => $locationCfg,
                    'model' => $model,
                    'system_prompt' => $systemPrompt,
                    'user_prompt' => $userPrompt,
                    'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
                    'max_output_tokens' => 1024,
                ]);
            } else {
                $messages = [];
                if ($systemPrompt !== '') {
                    $messages[] = ['role' => 'system', 'content' => $systemPrompt];
                }
                $messages[] = ['role' => 'user', 'content' => $userPrompt];
                $content = catn8_mystery_worker_ai_chat_generate($aiCfg, $messages);
            }

            $decoded = json_decode(trim((string)$content), true);
            if (!is_array($decoded)) {
                throw new RuntimeException('AI response was not valid JSON');
            }

            if (!array_key_exists('briefing', $decoded)) {
                throw new RuntimeException('AI response is missing required field: briefing');
            }
            $briefing = (string)($decoded['briefing'] ?? '');

            $constraints['briefing'] = isset($constraints['briefing']) && is_array($constraints['briefing']) ? $constraints['briefing'] : [];
            $constraints['briefing']['narrative_text'] = $briefing;
            $constraints['briefing']['script'] = ['briefing' => $briefing];

            Database::execute(
                'UPDATE mystery_scenarios SET constraints_json = ? WHERE id = ?',
                [json_encode($constraints, JSON_UNESCAPED_SLASHES), $scenarioId]
            );
            $result['briefing_updated'] = 1;
        }
    } elseif ($action === 'generate_case_notes') {
        if ($scenarioId <= 0) {
            throw new RuntimeException('generate_case_notes requires scenario_id');
        }
        if (catn8_mystery_worker_lock_on($locks, 'case_notes')) {
            $result['skipped'] = 1;
            $result['skip_reason'] = 'Locked: case_notes';
        } else {
            $aiCfg = catn8_mystery_worker_read_ai_config();

            $provider = strtolower(trim((string)($aiCfg['provider'] ?? '')));

            $scenarioRow = Database::queryOne(
                'SELECT id, game_id, slug, title, specs_json, constraints_json FROM mystery_scenarios WHERE id = ?',
                [$scenarioId]
            );
            if (!$scenarioRow) {
                throw new RuntimeException('Scenario not found');
            }
            if ((int)($scenarioRow['game_id'] ?? 0) !== $gameId) {
                throw new RuntimeException('Scenario does not belong to job game');
            }

            $castRows = Database::queryAll(
                'SELECT se.role, se.override_json, e.id AS entity_id, e.slug, e.name, e.data_json
                 FROM mystery_scenario_entities se
                 INNER JOIN mystery_entities e ON e.id = se.entity_id
                 WHERE se.scenario_id = ?
                 ORDER BY se.id ASC',
                [$scenarioId]
            );

            $cast = [];
            foreach ($castRows as $r) {
                $data = json_decode((string)($r['data_json'] ?? '{}'), true);
                if (!is_array($data)) $data = [];
                $override = json_decode((string)($r['override_json'] ?? '{}'), true);
                if (!is_array($override)) $override = [];
                $cast[] = [
                    'entity_id' => (int)($r['entity_id'] ?? 0),
                    'slug' => (string)($r['slug'] ?? ''),
                    'name' => (string)($r['name'] ?? ''),
                    'role' => (string)($r['role'] ?? ''),
                    'data' => $data,
                    'override' => $override,
                ];
            }

            $liesRows = Database::queryAll(
                'SELECT id, entity_id, lie_type, topic_key, lie_text, truth_text, trigger_questions_json, relevance
                 FROM mystery_scenario_lies
                 WHERE scenario_id = ?
                 ORDER BY id ASC',
                [$scenarioId]
            );
            $lies = [];
            foreach ($liesRows as $r) {
                $trigger = json_decode((string)($r['trigger_questions_json'] ?? '[]'), true);
                if (!is_array($trigger)) $trigger = [];
                $lies[] = [
                    'id' => (int)($r['id'] ?? 0),
                    'entity_id' => (int)($r['entity_id'] ?? 0),
                    'lie_type' => (string)($r['lie_type'] ?? ''),
                    'topic_key' => (string)($r['topic_key'] ?? ''),
                    'lie_text' => (string)($r['lie_text'] ?? ''),
                    'truth_text' => (string)($r['truth_text'] ?? ''),
                    'trigger_questions' => $trigger,
                    'relevance' => (string)($r['relevance'] ?? ''),
                ];
            }

            $systemPrompt = trim((string)($aiCfg['system_prompt'] ?? ''));
            $userPrompt = json_encode([
                'task' => 'Generate 1-2 noir case notes for a murder mystery scenario.',
                'requirements' => [
                    'Only 2-3 total clues across the whole output.',
                    'Clues must be subtle/obscure.',
                    'Some notes should hint someone may be lying.',
                    'Return JSON only.',
                    'Output must match the schema exactly.',
                ],
                'schema' => [
                    'notes' => [
                        [
                            'title' => 'string',
                            'note_type' => 'case_file|forensics_report|witness_statement|detective_note',
                            'clue_count' => 'int',
                            'content_rich' => [
                                'blocks' => [['style' => 'typed|handwritten|strike|scribble', 'text' => 'string']],
                                'tags' => ['string'],
                                'annotations' => [['type' => 'margin_note|stamp|label', 'text' => 'string']],
                            ],
                        ],
                    ],
                ],
                'context' => [
                    'scenario' => [
                        'id' => (int)($scenarioRow['id'] ?? 0),
                        'slug' => (string)($scenarioRow['slug'] ?? ''),
                        'title' => (string)($scenarioRow['title'] ?? ''),
                        'specs_json' => (string)($scenarioRow['specs_json'] ?? '{}'),
                        'constraints_json' => (string)($scenarioRow['constraints_json'] ?? '{}'),
                    ],
                    'cast' => $cast,
                    'lies' => $lies,
                    'locks' => $locks,
                ],
            ], JSON_UNESCAPED_SLASHES);

            $messages = [];
            if ($systemPrompt !== '') {
                $messages[] = ['role' => 'system', 'content' => $systemPrompt];
            }
            $messages[] = ['role' => 'user', 'content' => $userPrompt];

            $content = '';

            if ($provider === 'google_vertex_ai') {
                require_once __DIR__ . '/../../includes/vertex_ai_gemini.php';

                $secrets = catn8_mystery_worker_read_ai_secrets($provider);
                $saJson = catn8_mystery_worker_require_string(
                    is_string($secrets['service_account_json'] ?? null) ? (string)$secrets['service_account_json'] : null,
                    'AI service account JSON (google_vertex_ai)'
                );

                $sa = json_decode($saJson, true);
                if (!is_array($sa)) {
                    throw new RuntimeException('AI Vertex service account JSON is not valid JSON');
                }

                $projectId = trim((string)($sa['project_id'] ?? ''));
                if ($projectId === '') {
                    throw new RuntimeException('AI Vertex service account JSON missing project_id');
                }

                $location = trim((string)($aiCfg['location'] ?? ''));
                if ($location === '') {
                    throw new RuntimeException('Missing Vertex AI location in AI config');
                }

                $content = catn8_vertex_ai_gemini_generate_text([
                    'service_account_json' => $saJson,
                    'project_id' => $projectId,
                    'location' => $location,
                    'model' => trim((string)($aiCfg['model'] ?? '')),
                    'system_prompt' => $systemPrompt,
                    'user_prompt' => $userPrompt,
                    'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
                ]);
            } elseif ($provider === 'anthropic') {
                $secrets = catn8_mystery_worker_read_ai_secrets($provider);
                $apiKey = catn8_mystery_worker_require_string(
                    is_string($secrets['api_key'] ?? null) ? (string)$secrets['api_key'] : null,
                    'AI API key (anthropic)'
                );

                $body = [
                    'model' => catn8_mystery_worker_require_string(trim((string)($aiCfg['model'] ?? '')) !== '' ? (string)$aiCfg['model'] : null, 'Anthropic model'),
                    'max_tokens' => 2048,
                    'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
                    'messages' => [
                        ['role' => 'user', 'content' => $userPrompt],
                    ],
                ];
                if ($systemPrompt !== '') {
                    $body['system'] = $systemPrompt;
                }

                $decoded = catn8_mystery_worker_http_json(
                    'POST',
                    'https://api.anthropic.com/v1/messages',
                    [
                        'x-api-key' => $apiKey,
                        'anthropic-version' => '2023-06-01',
                    ],
                    $body
                );

                $parts = $decoded['content'] ?? null;
                if (is_array($parts) && isset($parts[0]) && is_array($parts[0]) && isset($parts[0]['text']) && is_string($parts[0]['text'])) {
                    $content = (string)$parts[0]['text'];
                }
            } elseif ($provider === 'google_ai_studio') {
                $secrets = catn8_mystery_worker_read_ai_secrets($provider);
                $apiKey = catn8_mystery_worker_require_string(
                    is_string($secrets['api_key'] ?? null) ? (string)$secrets['api_key'] : null,
                    'AI API key (google_ai_studio)'
                );

                $model = catn8_mystery_worker_require_string(trim((string)($aiCfg['model'] ?? '')) !== '' ? (string)$aiCfg['model'] : null, 'Google AI Studio model');
                $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent?key=' . rawurlencode($apiKey);

                $body = [
                    'contents' => [
                        ['role' => 'user', 'parts' => [['text' => $userPrompt]]],
                    ],
                    'generationConfig' => [
                        'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
                    ],
                ];
                if ($systemPrompt !== '') {
                    $body['systemInstruction'] = ['parts' => [['text' => $systemPrompt]]];
                }

                $decoded = catn8_mystery_worker_http_json('POST', $url, [], $body);
                $candidates = $decoded['candidates'] ?? null;
                if (is_array($candidates) && isset($candidates[0]) && is_array($candidates[0])) {
                    $candContent = $candidates[0]['content'] ?? null;
                    $candParts = is_array($candContent) ? ($candContent['parts'] ?? null) : null;
                    if (is_array($candParts) && isset($candParts[0]) && is_array($candParts[0]) && isset($candParts[0]['text']) && is_string($candParts[0]['text'])) {
                        $content = (string)$candParts[0]['text'];
                    }
                }
            } elseif ($provider === 'azure_openai') {
                $secrets = catn8_mystery_worker_read_ai_secrets($provider);
                $apiKey = catn8_mystery_worker_require_string(
                    is_string($secrets['api_key'] ?? null) ? (string)$secrets['api_key'] : null,
                    'AI API key (azure_openai)'
                );

                $pc = $aiCfg['provider_config'] ?? [];
                if (!is_array($pc)) {
                    $pc = [];
                }

                $endpoint = catn8_mystery_worker_require_string(is_string($pc['azure_endpoint'] ?? null) ? (string)$pc['azure_endpoint'] : null, 'Endpoint (Azure OpenAI)');
                $deployment = catn8_mystery_worker_require_string(is_string($pc['azure_deployment'] ?? null) ? (string)$pc['azure_deployment'] : null, 'Deployment (Azure OpenAI)');
                $apiVersion = catn8_mystery_worker_require_string(is_string($pc['azure_api_version'] ?? null) ? (string)$pc['azure_api_version'] : null, 'API Version (Azure OpenAI)');

                $endpoint = rtrim(catn8_validate_external_base_url($endpoint), '/');
                $url = $endpoint . '/openai/deployments/' . rawurlencode($deployment) . '/chat/completions?api-version=' . rawurlencode($apiVersion);

                $decoded = catn8_mystery_worker_http_json(
                    'POST',
                    $url,
                    ['api-key' => $apiKey],
                    [
                        'messages' => $messages,
                        'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
                        'max_tokens' => 2048,
                    ]
                );

                $choices = $decoded['choices'] ?? null;
                if (is_array($choices) && isset($choices[0]) && is_array($choices[0])) {
                    $msg = $choices[0]['message'] ?? null;
                    if (is_array($msg) && isset($msg['content']) && is_string($msg['content'])) {
                        $content = (string)$msg['content'];
                    }
                }
            } elseif ($provider === 'openai' || $provider === 'together_ai' || $provider === 'fireworks_ai' || $provider === 'huggingface') {
                $secrets = catn8_mystery_worker_read_ai_secrets($provider);
                $apiKey = catn8_mystery_worker_require_string(
                    is_string($secrets['api_key'] ?? null) ? (string)$secrets['api_key'] : null,
                    'AI API key (' . $provider . ')'
                );

                $baseUrl = trim((string)($aiCfg['base_url'] ?? ''));
                if ($provider !== 'openai' && $baseUrl === '') {
                    throw new RuntimeException('Missing base_url in AI config for provider ' . $provider);
                }

                if ($baseUrl !== '') {
                    $baseUrl = catn8_validate_external_base_url($baseUrl);
                }

                if ($provider === 'openai') {
                    $client = catn8_mystery_worker_openai_client($apiKey, $baseUrl);
                    $resp = $client->chat()->create([
                        'model' => (string)($aiCfg['model'] ?? 'gpt-4o-mini'),
                        'messages' => $messages,
                        'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
                    ]);
                    if (isset($resp->choices[0]->message->content)) {
                        $content = (string)$resp->choices[0]->message->content;
                    }
                } else {
                    $root = rtrim($baseUrl, '/');
                    $url = preg_match('#/v1$#', $root) ? ($root . '/chat/completions') : ($root . '/v1/chat/completions');
                    $decoded = catn8_mystery_worker_http_json(
                        'POST',
                        $url,
                        ['Authorization' => 'Bearer ' . $apiKey],
                        [
                            'model' => (string)($aiCfg['model'] ?? ''),
                            'messages' => $messages,
                            'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
                            'max_tokens' => 2048,
                        ]
                    );
                    $choices = $decoded['choices'] ?? null;
                    if (is_array($choices) && isset($choices[0]) && is_array($choices[0])) {
                        $msg = $choices[0]['message'] ?? null;
                        if (is_array($msg) && isset($msg['content']) && is_string($msg['content'])) {
                            $content = (string)$msg['content'];
                        }
                    }
                }
            } else {
                throw new RuntimeException('Unsupported AI provider: ' . (string)($aiCfg['provider'] ?? ''));
            }

            if (trim($content) === '') {
                throw new RuntimeException('AI response was empty');
            }
            $jsonText = catn8_mystery_worker_extract_json_from_text($content);
            $parsed = json_decode($jsonText, true);
            if (!is_array($parsed) || !isset($parsed['notes']) || !is_array($parsed['notes'])) {
                $result['ai_raw_preview'] = substr($content, 0, 20000);
                $result['ai_json_preview'] = substr($jsonText, 0, 20000);
                throw new RuntimeException('AI response was not valid JSON matching schema');
            }

            $createdIds = [];
            foreach ($parsed['notes'] as $n) {
                if (!is_array($n)) continue;
                $title = trim((string)($n['title'] ?? ''));
                $noteType = trim((string)($n['note_type'] ?? 'case_file'));
                $clueCount = (int)($n['clue_count'] ?? 0);
                $contentRich = $n['content_rich'] ?? null;
                if ($title === '' || $noteType === '' || !is_array($contentRich)) {
                    continue;
                }

                Database::execute(
                    'INSERT INTO mystery_case_notes (scenario_id, title, note_type, content_rich_json, clue_count, is_archived) VALUES (?, ?, ?, ?, ?, 0)',
                    [$scenarioId, $title, $noteType, json_encode($contentRich, JSON_UNESCAPED_SLASHES), $clueCount]
                );
                $row = Database::queryOne('SELECT id FROM mystery_case_notes WHERE scenario_id = ? ORDER BY id DESC LIMIT 1', [$scenarioId]);
                $createdIds[] = (int)($row['id'] ?? 0);
            }

            $result['created_case_note_ids'] = array_values(array_filter($createdIds));
            $result['note_count'] = count($result['created_case_note_ids']);
        }
    } elseif ($action === 'generate_missing_depositions') {
        if ($scenarioId <= 0) {
            throw new RuntimeException('generate_missing_depositions requires scenario_id');
        }
        if (catn8_mystery_worker_lock_on($locks, 'depositions')) {
            $result['skipped'] = 1;
            $result['skip_reason'] = 'Locked: depositions';
        } else {
            $scenarioRow = Database::queryOne('SELECT id, game_id FROM mystery_scenarios WHERE id = ?', [$scenarioId]);
            if (!$scenarioRow) {
                throw new RuntimeException('Scenario not found');
            }
            if ((int)($scenarioRow['game_id'] ?? 0) !== $gameId) {
                throw new RuntimeException('Scenario does not belong to job game');
            }

            $rows = Database::queryAll(
                "SELECT se.entity_id\n" .
                "FROM mystery_scenario_entities se\n" .
                "INNER JOIN mystery_entities e ON e.id = se.entity_id\n" .
                "LEFT JOIN mystery_scenario_depositions d ON d.case_id = ? AND d.scenario_id = se.scenario_id AND d.entity_id = se.entity_id\n" .
                "WHERE se.scenario_id = ?\n" .
                "  AND se.role IN ('suspect','killer','witness','bystander','victim','sheriff')\n" .
                "  AND e.entity_type = 'character'\n" .
                "  AND d.id IS NULL\n" .
                "ORDER BY se.id ASC",
                [$gameId, $scenarioId]
            );

            $queued = 0;
            foreach ($rows as $r) {
                $eid = (int)($r['entity_id'] ?? 0);
                if ($eid <= 0) continue;
                Database::execute(
                    'INSERT INTO mystery_generation_jobs (game_id, scenario_id, entity_id, action, spec_json, status, result_json, error_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [$gameId, $scenarioId, $eid, 'generate_deposition', json_encode(new stdClass(), JSON_UNESCAPED_SLASHES), 'queued', json_encode(new stdClass(), JSON_UNESCAPED_SLASHES), '']
                );
                $queued += 1;
            }

            $result['queued_deposition_jobs'] = $queued;
        }
    } elseif ($action === 'generate_deposition') {
        if ($scenarioId <= 0) {
            throw new RuntimeException('generate_deposition requires scenario_id');
        }
        if ($entityId <= 0) {
            throw new RuntimeException('generate_deposition requires entity_id');
        }
        if (catn8_mystery_worker_lock_on($locks, 'depositions')) {
            $result['skipped'] = 1;
            $result['skip_reason'] = 'Locked: depositions';
        } else {
            $aiCfg = catn8_mystery_worker_read_ai_config();
            $provider = strtolower(trim((string)($aiCfg['provider'] ?? '')));

            $scenarioRow = Database::queryOne(
                'SELECT id, game_id, slug, title, specs_json, constraints_json, crime_scene_weapon, crime_scene_location, crime_scene_motive FROM mystery_scenarios WHERE id = ?',
                [$scenarioId]
            );
            if (!$scenarioRow) {
                throw new RuntimeException('Scenario not found');
            }
            if ((int)($scenarioRow['game_id'] ?? 0) !== $gameId) {
                throw new RuntimeException('Scenario does not belong to job game');
            }

            $entityRow = Database::queryOne(
                'SELECT id, game_id, entity_type, slug, name, data_json FROM mystery_entities WHERE id = ?',
                [$entityId]
            );
            if (!$entityRow) {
                throw new RuntimeException('Entity not found');
            }
            if ((int)($entityRow['game_id'] ?? 0) !== $gameId) {
                throw new RuntimeException('Entity does not belong to job game');
            }

            $seRow = Database::queryOne(
                'SELECT role, override_json FROM mystery_scenario_entities WHERE scenario_id = ? AND entity_id = ? LIMIT 1',
                [$scenarioId, $entityId]
            );
            if (!$seRow) {
                throw new RuntimeException('Entity is not attached to this scenario');
            }

            $storyRow = Database::queryOne(
                'SELECT cold_hard_facts_text FROM mystery_scenario_cold_hard_facts WHERE scenario_id = ? LIMIT 1',
                [$scenarioId]
            );

            $specs = json_decode((string)($scenarioRow['specs_json'] ?? '{}'), true);
            if (!is_array($specs)) $specs = [];
            $constraints = json_decode((string)($scenarioRow['constraints_json'] ?? '{}'), true);
            if (!is_array($constraints)) $constraints = [];

            $briefing = '';
            if (isset($constraints['briefing']) && is_array($constraints['briefing'])) {
                $sb = $constraints['briefing'];
                $briefing = trim((string)($sb['narrative_text'] ?? $sb['story_text'] ?? $sb['story'] ?? ''));
            }
            $coldHardFacts = trim((string)($storyRow['cold_hard_facts_text'] ?? ''));

            $castRows = Database::queryAll(
                'SELECT se.role, se.override_json, e.id AS entity_id, e.slug, e.name, e.data_json
                 FROM mystery_scenario_entities se
                 INNER JOIN mystery_entities e ON e.id = se.entity_id
                 WHERE se.scenario_id = ?
                 ORDER BY se.id ASC',
                [$scenarioId]
            );

            $cast = [];
            foreach ($castRows as $r) {
                $data = json_decode((string)($r['data_json'] ?? '{}'), true);
                if (!is_array($data)) $data = [];
                $override = json_decode((string)($r['override_json'] ?? '{}'), true);
                if (!is_array($override)) $override = [];
                $cast[] = [
                    'entity_id' => (int)($r['entity_id'] ?? 0),
                    'slug' => (string)($r['slug'] ?? ''),
                    'name' => (string)($r['name'] ?? ''),
                    'role' => (string)($r['role'] ?? ''),
                    'data' => $data,
                    'override' => $override,
                ];
            }

            $systemPrompt = trim((string)($aiCfg['system_prompt'] ?? ''));
            $userPrompt = json_encode([
                'task' => 'Write a sworn deposition and supporting character constraints (alibi, objective, relevance) for the given character in the current murder mystery case.',
                'requirements' => [
                    'Return JSON only. Output must match schema exactly.',
                    'Deposition must stay consistent with the current case guardrails (crime scene fields, cast, briefing, cold hard facts).',
                    'Write as an official statement to investigators, in first person, with specific claims that can later be contradicted by lies/interrogation.',
                    'Do not invent a different killer, weapon, motive, or location than provided.',
                    'Every character must have a claimed alibi/location, a short objective, and a short relevance statement.',
                ],
                'schema' => [
                    'deposition_text' => 'string',
                    'claimed_alibi_text' => 'string',
                    'alibi_truth_text' => 'string',
                    'objective_text' => 'string',
                    'relevance_text' => 'string',
                ],
                'context' => [
                    'scenario' => [
                        'id' => (int)($scenarioRow['id'] ?? 0),
                        'slug' => (string)($scenarioRow['slug'] ?? ''),
                        'title' => (string)($scenarioRow['title'] ?? ''),
                        'specs' => $specs,
                        'constraints' => $constraints,
                    ],
                    'crime_scene' => [
                        'weapon' => (string)($scenarioRow['crime_scene_weapon'] ?? ''),
                        'location' => (string)($scenarioRow['crime_scene_location'] ?? ''),
                        'motive' => (string)($scenarioRow['crime_scene_motive'] ?? ''),
                    ],
                    'briefing' => $briefing,
                    'cold_hard_facts' => $coldHardFacts,
                    'cast' => $cast,
                    'entity' => [
                        'id' => (int)($entityRow['id'] ?? 0),
                        'slug' => (string)($entityRow['slug'] ?? ''),
                        'name' => (string)($entityRow['name'] ?? ''),
                        'role' => (string)($seRow['role'] ?? ''),
                        'data' => json_decode((string)($entityRow['data_json'] ?? '{}'), true) ?: new stdClass(),
                        'override' => json_decode((string)($seRow['override_json'] ?? '{}'), true) ?: new stdClass(),
                    ],
                    'locks' => $locks,
                ],
            ], JSON_UNESCAPED_SLASHES);

            $messages = [];
            if ($systemPrompt !== '') {
                $messages[] = ['role' => 'system', 'content' => $systemPrompt];
            }
            $messages[] = ['role' => 'user', 'content' => $userPrompt];

            $content = '';

            if ($provider === 'google_vertex_ai') {
                require_once __DIR__ . '/../../includes/vertex_ai_gemini.php';

                $secrets = catn8_mystery_worker_read_ai_secrets($provider);
                $saJson = catn8_mystery_worker_require_string(
                    is_string($secrets['service_account_json'] ?? null) ? (string)$secrets['service_account_json'] : null,
                    'AI service account JSON (google_vertex_ai)'
                );

                $sa = json_decode($saJson, true);
                if (!is_array($sa)) {
                    throw new RuntimeException('AI Vertex service account JSON is not valid JSON');
                }
                $projectId = trim((string)($sa['project_id'] ?? ''));
                if ($projectId === '') {
                    throw new RuntimeException('AI Vertex service account JSON missing project_id');
                }
                $location = trim((string)($aiCfg['location'] ?? ''));
                if ($location === '') {
                    throw new RuntimeException('Missing Vertex AI location in AI config');
                }

                $content = catn8_vertex_ai_gemini_generate_text([
                    'service_account_json' => $saJson,
                    'project_id' => $projectId,
                    'location' => $location,
                    'model' => trim((string)($aiCfg['model'] ?? '')),
                    'system_prompt' => $systemPrompt,
                    'user_prompt' => $userPrompt,
                    'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
                    'max_output_tokens' => 2048,
                ]);
            } elseif ($provider === 'anthropic') {
                $secrets = catn8_mystery_worker_read_ai_secrets($provider);
                $apiKey = catn8_mystery_worker_require_string(
                    is_string($secrets['api_key'] ?? null) ? (string)$secrets['api_key'] : null,
                    'AI API key (anthropic)'
                );

                $body = [
                    'model' => catn8_mystery_worker_require_string(trim((string)($aiCfg['model'] ?? '')) !== '' ? (string)$aiCfg['model'] : null, 'Anthropic model'),
                    'max_tokens' => 2048,
                    'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
                    'messages' => [
                        ['role' => 'user', 'content' => $userPrompt],
                    ],
                ];
                if ($systemPrompt !== '') {
                    $body['system'] = $systemPrompt;
                }

                $decoded = catn8_mystery_worker_http_json(
                    'POST',
                    'https://api.anthropic.com/v1/messages',
                    [
                        'x-api-key' => $apiKey,
                        'anthropic-version' => '2023-06-01',
                    ],
                    $body
                );

                $parts = $decoded['content'] ?? null;
                if (is_array($parts) && isset($parts[0]) && is_array($parts[0]) && isset($parts[0]['text']) && is_string($parts[0]['text'])) {
                    $content = (string)$parts[0]['text'];
                }
            } elseif ($provider === 'google_ai_studio') {
                $secrets = catn8_mystery_worker_read_ai_secrets($provider);
                $apiKey = catn8_mystery_worker_require_string(
                    is_string($secrets['api_key'] ?? null) ? (string)$secrets['api_key'] : null,
                    'AI API key (google_ai_studio)'
                );

                $model = catn8_mystery_worker_require_string(trim((string)($aiCfg['model'] ?? '')) !== '' ? (string)$aiCfg['model'] : null, 'Google AI Studio model');
                $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent?key=' . rawurlencode($apiKey);

                $body = [
                    'contents' => [
                        ['role' => 'user', 'parts' => [['text' => $userPrompt]]],
                    ],
                    'generationConfig' => [
                        'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
                    ],
                ];
                if ($systemPrompt !== '') {
                    $body['systemInstruction'] = ['parts' => [['text' => $systemPrompt]]];
                }

                $decoded = catn8_mystery_worker_http_json('POST', $url, [], $body);
                $candidates = $decoded['candidates'] ?? null;
                if (is_array($candidates) && isset($candidates[0]) && is_array($candidates[0])) {
                    $candContent = $candidates[0]['content'] ?? null;
                    $candParts = is_array($candContent) ? ($candContent['parts'] ?? null) : null;
                    if (is_array($candParts) && isset($candParts[0]) && is_array($candParts[0]) && isset($candParts[0]['text']) && is_string($candParts[0]['text'])) {
                        $content = (string)$candParts[0]['text'];
                    }
                }
            } elseif ($provider === 'azure_openai') {
                $secrets = catn8_mystery_worker_read_ai_secrets($provider);
                $apiKey = catn8_mystery_worker_require_string(
                    is_string($secrets['api_key'] ?? null) ? (string)$secrets['api_key'] : null,
                    'AI API key (azure_openai)'
                );

                $pc = $aiCfg['provider_config'] ?? [];
                if (!is_array($pc)) {
                    $pc = [];
                }

                $endpoint = catn8_mystery_worker_require_string(is_string($pc['azure_endpoint'] ?? null) ? (string)$pc['azure_endpoint'] : null, 'Endpoint (Azure OpenAI)');
                $deployment = catn8_mystery_worker_require_string(is_string($pc['azure_deployment'] ?? null) ? (string)$pc['azure_deployment'] : null, 'Deployment (Azure OpenAI)');
                $apiVersion = catn8_mystery_worker_require_string(is_string($pc['azure_api_version'] ?? null) ? (string)$pc['azure_api_version'] : null, 'API Version (Azure OpenAI)');

                $endpoint = rtrim(catn8_validate_external_base_url($endpoint), '/');
                $url = $endpoint . '/openai/deployments/' . rawurlencode($deployment) . '/chat/completions?api-version=' . rawurlencode($apiVersion);

                $decoded = catn8_mystery_worker_http_json(
                    'POST',
                    $url,
                    ['api-key' => $apiKey],
                    [
                        'messages' => $messages,
                        'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
                        'max_tokens' => 2048,
                    ]
                );

                $choices = $decoded['choices'] ?? null;
                if (is_array($choices) && isset($choices[0]) && is_array($choices[0])) {
                    $msg = $choices[0]['message'] ?? null;
                    if (is_array($msg) && isset($msg['content']) && is_string($msg['content'])) {
                        $content = (string)$msg['content'];
                    }
                }
            } elseif ($provider === 'openai' || $provider === 'together_ai' || $provider === 'fireworks_ai' || $provider === 'huggingface') {
                $secrets = catn8_mystery_worker_read_ai_secrets($provider);
                $apiKey = catn8_mystery_worker_require_string(
                    is_string($secrets['api_key'] ?? null) ? (string)$secrets['api_key'] : null,
                    'AI API key (' . $provider . ')'
                );

                $baseUrl = trim((string)($aiCfg['base_url'] ?? ''));
                if ($provider !== 'openai' && $baseUrl === '') {
                    throw new RuntimeException('Missing base_url in AI config for provider ' . $provider);
                }
                if ($baseUrl !== '') {
                    $baseUrl = catn8_validate_external_base_url($baseUrl);
                }

                if ($provider === 'openai') {
                    $client = catn8_mystery_worker_openai_client($apiKey, $baseUrl);
                    $resp = $client->chat()->create([
                        'model' => (string)($aiCfg['model'] ?? 'gpt-4o-mini'),
                        'messages' => $messages,
                        'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
                    ]);
                    if (isset($resp->choices[0]->message->content)) {
                        $content = (string)$resp->choices[0]->message->content;
                    }
                } else {
                    $root = rtrim($baseUrl, '/');
                    $url = preg_match('#/v1$#', $root) ? ($root . '/chat/completions') : ($root . '/v1/chat/completions');
                    $decoded = catn8_mystery_worker_http_json(
                        'POST',
                        $url,
                        ['Authorization' => 'Bearer ' . $apiKey],
                        [
                            'model' => (string)($aiCfg['model'] ?? ''),
                            'messages' => $messages,
                            'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
                            'max_tokens' => 2048,
                        ]
                    );
                    $choices = $decoded['choices'] ?? null;
                    if (is_array($choices) && isset($choices[0]) && is_array($choices[0])) {
                        $msg = $choices[0]['message'] ?? null;
                        if (is_array($msg) && isset($msg['content']) && is_string($msg['content'])) {
                            $content = (string)$msg['content'];
                        }
                    }
                }
            } else {
                throw new RuntimeException('Unsupported AI provider: ' . (string)($aiCfg['provider'] ?? ''));
            }

            if (trim($content) === '') {
                throw new RuntimeException('AI response was empty');
            }

            $jsonText = catn8_mystery_worker_extract_json_from_text($content);
            $parsed = json_decode($jsonText, true);
            if (!is_array($parsed)
                || !isset($parsed['deposition_text']) || !is_string($parsed['deposition_text'])
                || !isset($parsed['claimed_alibi_text']) || !is_string($parsed['claimed_alibi_text'])
                || !isset($parsed['objective_text']) || !is_string($parsed['objective_text'])
                || !isset($parsed['relevance_text']) || !is_string($parsed['relevance_text'])
            ) {
                $result['ai_raw_preview'] = substr($content, 0, 20000);
                $result['ai_json_preview'] = substr($jsonText, 0, 20000);
                throw new RuntimeException('AI response was not valid JSON matching schema');
            }

            $depText = (string)$parsed['deposition_text'];
            $claimedAlibi = (string)$parsed['claimed_alibi_text'];
            $alibiTruth = isset($parsed['alibi_truth_text']) && is_string($parsed['alibi_truth_text']) ? (string)$parsed['alibi_truth_text'] : '';
            $objectiveText = (string)$parsed['objective_text'];
            $relevanceText = (string)$parsed['relevance_text'];

            $depText = trim($depText);
            $claimedAlibi = trim($claimedAlibi);
            $alibiTruth = trim($alibiTruth);
            $objectiveText = trim($objectiveText);
            $relevanceText = trim($relevanceText);

            if ($depText === '') throw new RuntimeException('AI response deposition_text was empty');
            if ($claimedAlibi === '') throw new RuntimeException('AI response claimed_alibi_text was empty');
            if ($objectiveText === '') throw new RuntimeException('AI response objective_text was empty');
            if ($relevanceText === '') throw new RuntimeException('AI response relevance_text was empty');

            Database::execute(
                'INSERT INTO mystery_scenario_depositions (case_id, scenario_id, entity_id, deposition_text) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE deposition_text = VALUES(deposition_text)',
                [$gameId, $scenarioId, $entityId, $depText]
            );

            $override = json_decode((string)($seRow['override_json'] ?? '{}'), true);
            if (!is_array($override)) $override = [];
            if (!isset($override['mystery_context']) || !is_array($override['mystery_context'])) $override['mystery_context'] = [];
            if (!isset($override['mystery_context']['private_knowledge']) || !is_array($override['mystery_context']['private_knowledge'])) $override['mystery_context']['private_knowledge'] = [];
            if (!isset($override['mystery_context']['public_context']) || !is_array($override['mystery_context']['public_context'])) $override['mystery_context']['public_context'] = [];

            $override['mystery_context']['private_knowledge']['objective'] = $objectiveText;
            $override['mystery_context']['public_context']['why_here'] = $relevanceText;
            $overrideJson = json_encode($override, JSON_UNESCAPED_SLASHES);
            if (!is_string($overrideJson)) {
                $overrideJson = json_encode(new stdClass(), JSON_UNESCAPED_SLASHES);
            }
            Database::execute(
                'UPDATE mystery_scenario_entities SET override_json = ? WHERE scenario_id = ? AND entity_id = ? LIMIT 1',
                [$overrideJson, $scenarioId, $entityId]
            );

            $topicKey = 'timeline.alibi';
            $lieType = 'direct';
            $triggers = json_encode([
                'Where were you around the time of death?',
                'Can anyone confirm your whereabouts?',
                'Did you leave the scene at any point?',
            ], JSON_UNESCAPED_SLASHES);
            if (!is_string($triggers)) {
                $triggers = json_encode([]);
            }

            $existingLie = Database::queryOne(
                'SELECT id FROM mystery_scenario_lies WHERE scenario_id = ? AND entity_id = ? AND topic_key = ? ORDER BY id DESC LIMIT 1',
                [$scenarioId, $entityId, $topicKey]
            );
            if ($existingLie) {
                Database::execute(
                    'UPDATE mystery_scenario_lies SET lie_type = ?, lie_text = ?, truth_text = ?, trigger_questions_json = ?, relevance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [$lieType, $claimedAlibi, $alibiTruth, $triggers, 'Alibi', (int)($existingLie['id'] ?? 0)]
                );
            } else {
                Database::execute(
                    'INSERT INTO mystery_scenario_lies (scenario_id, entity_id, lie_type, topic_key, lie_text, truth_text, trigger_questions_json, relevance, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [$scenarioId, $entityId, $lieType, $topicKey, $claimedAlibi, $alibiTruth, $triggers, 'Alibi', '']
                );
            }

            $saved = Database::queryOne('SELECT id, updated_at FROM mystery_scenario_depositions WHERE case_id = ? AND scenario_id = ? AND entity_id = ? LIMIT 1', [$gameId, $scenarioId, $entityId]);
            $result['deposition'] = [
                'id' => (int)($saved['id'] ?? 0),
                'updated_at' => $saved['updated_at'] ?? null,
            ];
            $result['generated'] = [
                'alibi_topic_key' => $topicKey,
                'objective' => $objectiveText,
                'relevance' => $relevanceText,
            ];
        }
    } elseif ($action === 'generate_evidence') {
        if ($scenarioId <= 0) {
            throw new RuntimeException('generate_evidence requires scenario_id');
        }
        if (catn8_mystery_worker_lock_on($locks, 'evidence')) {
            $result['skipped'] = 1;
            $result['skip_reason'] = 'Locked: evidence';
        } else {
            $aiCfg = catn8_mystery_worker_read_ai_config();
            $provider = strtolower(trim((string)($aiCfg['provider'] ?? '')));

            $scenarioRow = Database::queryOne(
                'SELECT id, game_id, title, specs_json, constraints_json, crime_scene_weapon, crime_scene_location, crime_scene_motive FROM mystery_scenarios WHERE id = ?',
                [$scenarioId]
            );
            if (!$scenarioRow) {
                throw new RuntimeException('Scenario not found');
            }
            if ((int)($scenarioRow['game_id'] ?? 0) !== $gameId) {
                throw new RuntimeException('Scenario does not belong to job game');
            }

            $storyRow = Database::queryOne('SELECT cold_hard_facts_text FROM mystery_scenario_cold_hard_facts WHERE scenario_id = ? LIMIT 1', [$scenarioId]);
            
            $specs = json_decode((string)($scenarioRow['specs_json'] ?? '{}'), true);
            if (!is_array($specs)) $specs = [];
            $constraints = json_decode((string)($scenarioRow['constraints_json'] ?? '{}'), true);
            if (!is_array($constraints)) $constraints = [];

            $briefing = '';
            if (isset($constraints['briefing']) && is_array($constraints['briefing'])) {
                $sb = $constraints['briefing'];
                $briefing = trim((string)($sb['narrative_text'] ?? $sb['story_text'] ?? $sb['story'] ?? ''));
            }
            $coldHardFacts = trim((string)($storyRow['cold_hard_facts_text'] ?? ''));

            $systemPrompt = trim((string)($aiCfg['system_prompt'] ?? ''));
            $userPrompt = json_encode([
                'task' => 'Generate a list of physical and digital evidence items for the current murder mystery case.',
                'requirements' => [
                    'Return JSON only. Output must match schema exactly.',
                    'Evidence must be consistent with the briefing and cold hard facts.',
                    'Include at least 4-6 distinct items of evidence.',
                    'TONE: Use exhaustive, clinical, and highly technical language (e.g., "epithelial cells", "latent papillary ridges", "striation patterns").',
                    'DESCRIPTION: Provide a verbose (2-3 sentence) technical description for each item. Bury any specific clues within forensic jargon.',
                    'Provide a title, description, and type (physical, digital, forensic) for each item.',
                    'Propose an initial csi_note and detective_note for each item using the same clinical tone.',
                ],
                'schema' => [
                    'evidence' => [
                        [
                            'title' => 'string',
                            'description' => 'string',
                            'type' => 'physical|digital|forensic',
                            'csi_note' => 'string',
                            'detective_note' => 'string',
                        ]
                    ]
                ],
                'context' => [
                    'scenario' => [
                        'id' => (int)($scenarioRow['id'] ?? 0),
                        'title' => (string)($scenarioRow['title'] ?? ''),
                        'weapon' => (string)($scenarioRow['crime_scene_weapon'] ?? ''),
                        'location' => (string)($scenarioRow['crime_scene_location'] ?? ''),
                        'motive' => (string)($scenarioRow['crime_scene_motive'] ?? ''),
                    ],
                    'briefing' => $briefing,
                    'cold_hard_facts' => $coldHardFacts,
                ],
            ], JSON_UNESCAPED_SLASHES);

            $messages = [];
            if ($systemPrompt !== '') {
                $messages[] = ['role' => 'system', 'content' => $systemPrompt];
            }
            $messages[] = ['role' => 'user', 'content' => $userPrompt];

            $content = '';
            if ($provider === 'google_vertex_ai') {
                require_once __DIR__ . '/../../includes/vertex_ai_gemini.php';
                $secrets = catn8_mystery_worker_read_ai_secrets($provider);
                $saJson = catn8_mystery_worker_require_string($secrets['service_account_json'] ?? null, 'AI service account JSON (google_vertex_ai)');
                $sa = json_decode($saJson, true);
                $projectId = trim((string)($sa['project_id'] ?? ''));
                $location = trim((string)($aiCfg['location'] ?? ''));
                $content = catn8_vertex_ai_gemini_generate_text([
                    'service_account_json' => $saJson,
                    'project_id' => $projectId,
                    'location' => $location,
                    'model' => trim((string)($aiCfg['model'] ?? '')),
                    'system_prompt' => $systemPrompt,
                    'user_prompt' => $userPrompt,
                    'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
                    'max_output_tokens' => 2048,
                ]);
            } elseif ($provider === 'openai' || $provider === 'anthropic' || $provider === 'google_ai_studio' || $provider === 'azure_openai' || $provider === 'together_ai' || $provider === 'fireworks_ai') {
                // Generic handler for other providers (mirroring generate_deposition logic)
                // Since this is a large file and I want to be safe, I'll use the existing provider blocks if I can find them,
                // but the current structure of the file repeats these blocks.
                // I will replicate the provider logic from the deposition action for consistency.
                
                if ($provider === 'anthropic') {
                    $secrets = catn8_mystery_worker_read_ai_secrets($provider);
                    $apiKey = catn8_mystery_worker_require_string($secrets['api_key'] ?? null, 'AI API key (anthropic)');
                    $body = [
                        'model' => catn8_mystery_worker_require_string(trim((string)($aiCfg['model'] ?? '')) !== '' ? (string)$aiCfg['model'] : null, 'Anthropic model'),
                        'max_tokens' => 2048,
                        'temperature' => (float)($aiCfg['temperature'] ?? 0.2),
                        'messages' => [['role' => 'user', 'content' => $userPrompt]],
                    ];
                    if ($systemPrompt !== '') $body['system'] = $systemPrompt;
                    $decoded = catn8_mystery_worker_http_json('POST', 'https://api.anthropic.com/v1/messages', ['x-api-key' => $apiKey, 'anthropic-version' => '2023-06-01'], $body);
                    $parts = $decoded['content'] ?? null;
                    if (is_array($parts) && isset($parts[0]['text'])) $content = (string)$parts[0]['text'];
                } elseif ($provider === 'google_ai_studio') {
                    $secrets = catn8_mystery_worker_read_ai_secrets($provider);
                    $apiKey = catn8_mystery_worker_require_string($secrets['api_key'] ?? null, 'AI API key (google_ai_studio)');
                    $model = catn8_mystery_worker_require_string(trim((string)($aiCfg['model'] ?? '')) !== '' ? (string)$aiCfg['model'] : null, 'Google AI Studio model');
                    $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent?key=' . rawurlencode($apiKey);
                    $body = ['contents' => [['role' => 'user', 'parts' => [['text' => $userPrompt]]]], 'generationConfig' => ['temperature' => (float)($aiCfg['temperature'] ?? 0.2)]];
                    if ($systemPrompt !== '') $body['systemInstruction'] = ['parts' => [['text' => $systemPrompt]]];
                    $decoded = catn8_mystery_worker_http_json('POST', $url, [], $body);
                    $candidates = $decoded['candidates'] ?? null;
                    if (is_array($candidates) && isset($candidates[0]['content']['parts'][0]['text'])) $content = (string)$candidates[0]['content']['parts'][0]['text'];
                } elseif ($provider === 'azure_openai') {
                    $secrets = catn8_mystery_worker_read_ai_secrets($provider);
                    $apiKey = catn8_mystery_worker_require_string($secrets['api_key'] ?? null, 'AI API key (azure_openai)');
                    $pc = $aiCfg['provider_config'] ?? [];
                    $endpoint = rtrim(catn8_validate_external_base_url($pc['azure_endpoint'] ?? ''), '/');
                    $deployment = (string)($pc['azure_deployment'] ?? '');
                    $apiVersion = (string)($pc['azure_api_version'] ?? '');
                    $url = $endpoint . '/openai/deployments/' . rawurlencode($deployment) . '/chat/completions?api-version=' . rawurlencode($apiVersion);
                    $decoded = catn8_mystery_worker_http_json('POST', $url, ['api-key' => $apiKey], ['messages' => $messages, 'temperature' => (float)($aiCfg['temperature'] ?? 0.2), 'max_tokens' => 2048]);
                    if (isset($decoded['choices'][0]['message']['content'])) $content = (string)$decoded['choices'][0]['message']['content'];
                } else {
                    // OpenAI compatible
                    $secrets = catn8_mystery_worker_read_ai_secrets($provider);
                    $apiKey = catn8_mystery_worker_require_string($secrets['api_key'] ?? null, 'AI API key (' . $provider . ')');
                    $baseUrl = trim((string)($aiCfg['base_url'] ?? ''));
                    if ($provider === 'openai') {
                        $client = catn8_mystery_worker_openai_client($apiKey, $baseUrl);
                        $resp = $client->chat()->create(['model' => (string)($aiCfg['model'] ?? 'gpt-4o-mini'), 'messages' => $messages, 'temperature' => (float)($aiCfg['temperature'] ?? 0.2)]);
                        if (isset($resp->choices[0]->message->content)) $content = (string)$resp->choices[0]->message->content;
                    } else {
                        $root = rtrim(catn8_validate_external_base_url($baseUrl), '/');
                        $url = preg_match('#/v1$#', $root) ? ($root . '/chat/completions') : ($root . '/v1/chat/completions');
                        $decoded = catn8_mystery_worker_http_json('POST', $url, ['Authorization' => 'Bearer ' . $apiKey], ['model' => (string)($aiCfg['model'] ?? ''), 'messages' => $messages, 'temperature' => (float)($aiCfg['temperature'] ?? 0.2), 'max_tokens' => 2048]);
                        if (isset($decoded['choices'][0]['message']['content'])) $content = (string)$decoded['choices'][0]['message']['content'];
                    }
                }
            } else {
                throw new RuntimeException('Unsupported AI provider: ' . $provider);
            }

            if (trim($content) === '') throw new RuntimeException('AI response was empty');
            $jsonText = catn8_mystery_worker_extract_json_from_text($content);
            $parsed = json_decode($jsonText, true);
            if (!is_array($parsed) || !isset($parsed['evidence']) || !is_array($parsed['evidence'])) {
                $result['ai_raw_preview'] = substr($content, 0, 20000);
                $result['ai_json_preview'] = substr($jsonText, 0, 20000);
                throw new RuntimeException('AI response was not valid JSON matching schema');
            }

            // Clear existing evidence for this scenario before generating new ones (if desired, or just append)
            // The user said "it can be regenerated as needed", so we should probably clear old evidence.
            Database::execute('DELETE FROM mystery_evidence WHERE scenario_id = ?', [$scenarioId]);

            $createdIds = [];
            foreach ($parsed['evidence'] as $item) {
                if (!is_array($item)) continue;
                $title = trim((string)($item['title'] ?? ''));
                $desc = trim((string)($item['description'] ?? ''));
                $type = trim((string)($item['type'] ?? 'physical'));
                $csiNote = trim((string)($item['csi_note'] ?? ''));
                $detNote = trim((string)($item['detective_note'] ?? ''));

                if ($title === '') continue;

                // Generate a slug for the evidence
                $baseSlug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $title)));
                $slug = $baseSlug . '-' . $scenarioId;

                Database::execute(
                    'INSERT INTO mystery_evidence (case_id, scenario_id, slug, title, description, evidence_type) VALUES (?, ?, ?, ?, ?, ?)',
                    [(int)$scenarioRow['game_id'], $scenarioId, $slug, $title, $desc, $type]
                );
                $evidenceId = (int)Database::lastInsertId();
                if ($evidenceId > 0) {
                    $createdIds[] = $evidenceId;
                    if ($csiNote !== '') {
                        Database::execute(
                            'INSERT INTO mystery_evidence_notes (evidence_id, author_role, note_text) VALUES (?, ?, ?)',
                            [$evidenceId, 'CSI Detective', $csiNote]
                        );
                    }
                    if ($detNote !== '') {
                        Database::execute(
                            'INSERT INTO mystery_evidence_notes (evidence_id, author_role, note_text) VALUES (?, ?, ?)',
                            [$evidenceId, 'Detective', $detNote]
                        );
                    }
                }
            }

            $result['created_evidence_ids'] = $createdIds;
            $result['evidence_count'] = count($createdIds);
        }
    } elseif ($action === 'generate_master_asset_content') {
        $type = trim((string)($jobSpec['type'] ?? ''));
        $assetId = (int)($jobSpec['id'] ?? 0);
        $mysteryId = (int)($jobSpec['mystery_id'] ?? 0);

        if ($assetId <= 0 || $type === '' || $mysteryId <= 0) {
            throw new RuntimeException('generate_master_asset_content requires type, id, and mystery_id');
        }

        if ($type === 'character') {
            $row = Database::queryOne(
                'SELECT id, slug, name, dob, age, hometown, address, aliases_json, ethnicity, zodiac, mbti, height, weight, eye_color, hair_color, 
                        distinguishing_marks, education, employment_json, criminal_record, fav_color, fav_snack, fav_drink, fav_music, fav_hobby, fav_pet 
                 FROM mystery_master_characters 
                 WHERE id = ? AND mystery_id = ? LIMIT 1',
                [$assetId, $mysteryId]
            );
            if (!$row) throw new RuntimeException('Master character not found');

            // Load helpers since they are in the same directory as admin.php usually
            require_once __DIR__ . '/../../api/mystery/admin_actions_master_assets_generate_helpers.php';
            require_once __DIR__ . '/../../api/mystery/admin_functions_master_assets.php';
            require_once __DIR__ . '/../../api/mystery/admin_functions_master_assets_gen.php';
            require_once __DIR__ . '/../../api/mystery/admin_functions_helpers.php';

            $fieldLocks = catn8_mystery_master_character_field_locks_load($mysteryId, $assetId);
            $cur = catn8_mystery_master_gen_build_profile($row);
            $curRapport = catn8_mystery_master_character_rapport_load($mysteryId, $assetId);
            $curFavorites = [
                'color' => (string)($row['fav_color'] ?? ''),
                'snack' => (string)($row['fav_snack'] ?? ''),
                'drink' => (string)($row['fav_drink'] ?? ''),
                'music' => (string)($row['fav_music'] ?? ''),
                'hobby' => (string)($row['fav_hobby'] ?? ''),
                'pet' => (string)($row['fav_pet'] ?? ''),
            ];

            $prompts = catn8_mystery_master_gen_build_prompts(
                (string)$row['name'], 
                (string)$row['slug'], 
                json_encode($cur, JSON_UNESCAPED_SLASHES), 
                json_encode(['rapport' => $curRapport, 'favorites' => $curFavorites], JSON_UNESCAPED_SLASHES),
                json_encode($fieldLocks, JSON_UNESCAPED_SLASHES),
                (bool)($jobSpec['fill_missing_only'] ?? true)
            );

            $content = catn8_mystery_worker_ai_chat_generate($aiCfg, [
                ['role' => 'system', 'content' => $prompts['system']],
                ['role' => 'user', 'content' => $prompts['user']]
            ]);

            $jsonText = catn8_mystery_worker_extract_json_from_text($content);
            $decoded = json_decode($jsonText, true);
            if (!is_array($decoded)) {
                throw new RuntimeException("AI returned invalid JSON structure");
            }

            $fieldsPatch = catn8_mystery_master_gen_normalize_patch($decoded['fields_patch'] ?? [], $cur, $fieldLocks);
            $rapportPatch = $decoded['rapport_patch'] ?? [];
            $favoritesPatch = $decoded['favorites_patch'] ?? [];

            // Apply updates directly to DB
            if (!empty($fieldsPatch)) {
                $sqlParts = [];
                $params = [];
                foreach ($fieldsPatch as $k => $v) {
                    if ($k === 'aliases' || $k === 'employment') {
                        $sqlParts[] = "{$k}_json = ?";
                        $params[] = json_encode($v);
                    } else {
                        $sqlParts[] = "{$k} = ?";
                        $params[] = $v;
                    }
                }
                $params[] = $assetId;
                $params[] = $mysteryId;
                Database::execute("UPDATE mystery_master_characters SET " . implode(', ', $sqlParts) . " WHERE id = ? AND mystery_id = ?", $params);
            }

            if (!empty($rapportPatch)) {
                $curRapport = array_merge($curRapport, $rapportPatch);
                Database::execute("UPDATE mystery_master_characters SET rapport_json = ? WHERE id = ? AND mystery_id = ?", [json_encode($curRapport), $assetId, $mysteryId]);
            }

            if (!empty($favoritesPatch)) {
                $curFavorites = array_merge($curFavorites, $favoritesPatch);
                Database::execute("UPDATE mystery_master_characters SET 
                    fav_color = ?, fav_snack = ?, fav_drink = ?, fav_music = ?, fav_hobby = ?, fav_pet = ?
                    WHERE id = ? AND mystery_id = ?", 
                    [
                        $curFavorites['color'] ?? '', $curFavorites['snack'] ?? '', $curFavorites['drink'] ?? '',
                        $curFavorites['music'] ?? '', $curFavorites['hobby'] ?? '', $curFavorites['pet'] ?? '',
                        $assetId, $mysteryId
                    ]
                );
            }

            $result['success'] = true;
            $result['updated_fields'] = array_keys($fieldsPatch);
        } else {
            // Location or Weapon
            $table = ($type === 'location') ? 'mystery_master_locations' : 'mystery_master_weapons';
            $row = Database::queryOne(
                "SELECT id, slug, name, description, data_json FROM $table WHERE id = ? AND mystery_id = ? LIMIT 1",
                [$assetId, $mysteryId]
            );
            if (!$row) throw new RuntimeException("Master $type not found");

            $data = json_decode((string)($row['data_json'] ?? '{}'), true) ?: [];
            
            $system = "You are a creative writer for a detective mystery game. You generate missing details for master assets.";
            $user = "Generate a plausible description and list of items/details for a mystery game $type named '{$row['name']}'.
            Type: $type
            Slug: {$row['slug']}
            Current Description: " . ($row['description'] ?: '(empty)') . "
            Current Data: " . json_encode($data) . "

            Return ONLY JSON with:
            {
              \"description\": \"(A compelling 2-3 sentence description)\",
              \"items\": [\"(Item 1)\", \"(Item 2)\", ...]
            }";

            $content = catn8_mystery_worker_ai_chat_generate($aiCfg, [
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => $user]
            ]);

            $jsonText = catn8_mystery_worker_extract_json_from_text($content);
            $decoded = json_decode($jsonText, true);
            if (!is_array($decoded)) throw new RuntimeException("AI returned invalid JSON");

            $newDesc = $decoded['description'] ?? $row['description'];
            $newItems = $decoded['items'] ?? ($data['items'] ?? []);
            $data['items'] = $newItems;

            Database::execute("UPDATE $table SET description = ?, data_json = ? WHERE id = ? AND mystery_id = ?", [$newDesc, json_encode($data), $assetId, $mysteryId]);

            $result['success'] = true;
            $result['updated_fields'] = ['description', 'items'];
        }
    } elseif ($action === 'generate_crime_scene_image' || $action === 'generate_character_portrait') {
        $imageId = (int)($spec['image_id'] ?? 0);
        if ($imageId <= 0) {
            throw new RuntimeException('Image job requires spec.image_id');
        }
        $lockKey = 'images.' . $imageId;
        if (catn8_mystery_worker_lock_on($locks, 'images') || catn8_mystery_worker_lock_on($locks, $lockKey)) {
            $result['skipped'] = 1;
            $result['skip_reason'] = 'Locked: images';
        } else {
            $img = Database::queryOne(
                'SELECT id, game_id, scenario_id, entity_id, image_type, title, prompt_text, negative_prompt_text, provider, model, params_json
                 FROM mystery_images
                 WHERE id = ?',
                [$imageId]
            );
            if (!$img) {
                throw new RuntimeException('Image record not found');
            }
            if ((int)($img['game_id'] ?? 0) !== $gameId) {
                throw new RuntimeException('Image record does not belong to job game');
            }

            $aiImgCfg = catn8_mystery_worker_read_ai_image_config();
            $provider = trim((string)($img['provider'] ?? ''));
            if ($provider === '') {
                $provider = trim((string)($aiImgCfg['provider'] ?? 'openai'));
            }

            $providerNorm = strtolower(trim($provider));
            $aiImgCfg['provider'] = $providerNorm;
            $secrets = catn8_mystery_worker_read_ai_image_secrets($providerNorm);

            $params = json_decode((string)($img['params_json'] ?? '{}'), true);
            if (!is_array($params)) {
                $params = [];
            }
            $defaultParams = $aiImgCfg['params'] ?? [];
            if (!is_array($defaultParams)) {
                $defaultParams = [];
            }
            $merged = array_merge($defaultParams, $params);

            $model = trim((string)($img['model'] ?? ''));
            if ($model === '') {
                $model = trim((string)($aiImgCfg['model'] ?? 'gpt-image-1'));
            }

            $prompt = trim((string)($img['prompt_text'] ?? ''));
            if ($prompt === '') {
                throw new RuntimeException('Image prompt_text is empty');
            }

            if ($action === 'generate_crime_scene_image') {
                $locId = trim((string)($merged['location_id'] ?? ''));
                if ($locId !== '') {
                    $gameRow = Database::queryOne('SELECT mystery_id FROM mystery_games WHERE id = ? LIMIT 1', [$gameId]);
                    $mysteryId = (int)($gameRow['mystery_id'] ?? 0);
                    if ($mysteryId > 0) {
                        $locRow = Database::queryOne(
                            'SELECT address_line1, address_line2, city, region, postal_code, country FROM mystery_master_locations WHERE mystery_id = ? AND location_id = ? LIMIT 1',
                            [$mysteryId, $locId]
                        );
                        if (is_array($locRow)) {
                            $addr = catn8_mystery_worker_format_location_address($locRow);
                            if ($addr !== '') {
                                $prompt = trim($prompt . "\n\nLocation address: " . $addr);
                            }
                        }
                    }
                }
            }

            $neg = trim((string)($img['negative_prompt_text'] ?? ''));

            $payload = array_merge(
                [
                    'model' => $model,
                    'prompt' => $prompt,
                    'response_format' => 'b64_json',
                ],
                $merged
            );

            if ($neg !== '') {
                $payload['negative_prompt'] = $neg;
            }

            Database::execute('UPDATE mystery_images SET status = ? WHERE id = ?', ['queued', $imageId]);

            $bin = '';
            if ($providerNorm === 'openai' || $providerNorm === 'together_ai' || $providerNorm === 'fireworks_ai') {
                $apiKey = catn8_mystery_worker_require_string(trim((string)($secrets['api_key'] ?? '')) !== '' ? (string)$secrets['api_key'] : null, 'API key');
                $bin = catn8_mystery_worker_openai_compatible_image_generate($aiImgCfg, $apiKey, $payload);
            } elseif ($providerNorm === 'azure_openai') {
                $apiKey = catn8_mystery_worker_require_string(trim((string)($secrets['api_key'] ?? '')) !== '' ? (string)$secrets['api_key'] : null, 'API key');
                $bin = catn8_mystery_worker_azure_openai_image_generate($aiImgCfg, $apiKey, $payload, $prompt, $neg);
            } elseif ($providerNorm === 'stability_ai') {
                $apiKey = (string)($secrets['api_key'] ?? '');
                $bin = catn8_mystery_worker_stability_ai_image_generate($apiKey, $model, $prompt, $neg, $merged);
            } elseif ($providerNorm === 'huggingface') {
                $apiKey = (string)($secrets['api_key'] ?? '');
                $bin = catn8_mystery_worker_huggingface_image_generate($apiKey, $model, $prompt);
            } elseif ($providerNorm === 'replicate') {
                $apiKey = (string)($secrets['api_key'] ?? '');
                $bin = catn8_mystery_worker_replicate_image_generate($apiKey, $model, $prompt, $neg, $merged);
            } elseif ($providerNorm === 'google_vertex_ai') {
                $sa = (string)($secrets['service_account_json'] ?? '');

                if ($action === 'generate_crime_scene_image') {
                    $locId = trim((string)($merged['location_id'] ?? ''));
                    if ($locId === '') {
                        throw new RuntimeException('Crime scene image requires params.location_id to use a real reference image');
                    }

                    $gameRow = Database::queryOne('SELECT mystery_id FROM mystery_games WHERE id = ? LIMIT 1', [$gameId]);
                    $mysteryId = (int)($gameRow['mystery_id'] ?? 0);
                    if ($mysteryId <= 0) {
                        throw new RuntimeException('Could not determine mystery_id for game');
                    }

                    $locRow = Database::queryOne(
                        'SELECT address_line1, address_line2, city, region, postal_code, country FROM mystery_master_locations WHERE mystery_id = ? AND location_id = ? LIMIT 1',
                        [$mysteryId, $locId]
                    );
                    if (!is_array($locRow)) {
                        throw new RuntimeException('Master location not found for location_id ' . $locId);
                    }
                    $addr = catn8_mystery_worker_format_location_address($locRow);
                    if ($addr === '') {
                        throw new RuntimeException('Location address is empty; cannot retrieve a real reference image');
                    }

                    $refBin = catn8_mystery_worker_get_or_fetch_location_reference_image($mysteryId, $locId, $addr, $secrets);
                    $refB64 = base64_encode($refBin);
                    $refB64 = is_string($refB64) ? trim($refB64) : '';
                    if ($refB64 === '') {
                        throw new RuntimeException('Failed to encode location reference image');
                    }

                    $providerCfg = (array)($aiImgCfg['provider_config'] ?? []);
                    $editModel = trim((string)($providerCfg['location_reference_model'] ?? ''));
                    if ($editModel === '') {
                        $editModel = 'imagen-3.0-capability-001';
                    }

                    $prompt = trim($prompt . "\n\nUse the provided reference photo as the real-world base for this scene.");
                    $bin = catn8_mystery_worker_google_vertex_ai_image_edit_with_raw_reference_generate($sa, $providerCfg, $editModel, $prompt, $neg, $merged, $refB64);
                } else {
                    $bin = catn8_mystery_worker_google_vertex_ai_image_generate($sa, (array)($aiImgCfg['provider_config'] ?? []), $model, $prompt, $neg, $merged);
                }
            } elseif ($providerNorm === 'aws_bedrock') {
                $bin = catn8_mystery_worker_aws_bedrock_image_generate((array)$secrets, (array)($aiImgCfg['provider_config'] ?? []), $model, $prompt, $neg, $merged);
            } else {
                throw new RuntimeException('Unsupported image provider: ' . $providerNorm);
            }

            if (!is_string($bin) || $bin === '') {
                throw new RuntimeException('Image generation returned empty bytes');
            }

            $rootDir = dirname(__DIR__, 2);
            $outDir = $rootDir . '/images/mystery';
            catn8_mystery_worker_ensure_dir($outDir);
            $fileName = 'img_' . $imageId . '_' . gmdate('Ymd_His') . '.png';
            $absPath = $outDir . '/' . $fileName;
            if (file_put_contents($absPath, $bin) === false) {
                throw new RuntimeException('Failed to write image file');
            }
            $relUrl = '/images/mystery/' . $fileName;

            Database::execute(
                'UPDATE mystery_images SET status = ?, url = ?, error_text = ? WHERE id = ?',
                ['generated', $relUrl, '', $imageId]
            );

            $result['image_id'] = $imageId;
            $result['image_url'] = $relUrl;
            $result['image_status'] = 'generated';
        }
    } else {
        $result['note'] = 'No handler implemented for action';
    }

    Database::execute(
        "UPDATE mystery_generation_jobs SET status = 'done', result_json = ? WHERE id = ?",
        [json_encode($result, JSON_UNESCAPED_SLASHES), $jobId]
    );

    catn8_mystery_worker_out(['success' => true, 'claimed' => true, 'job_id' => $jobId, 'status' => 'done', 'action' => $action]);
    exit(0);
} catch (Throwable $e) {
    try {
        $errResult = [];
        if (isset($result) && is_array($result)) {
            $errResult = $result;
        }
        $errResult['error'] = $e->getMessage();
        Database::execute(
            "UPDATE mystery_generation_jobs SET status = 'error', error_text = ?, result_json = ? WHERE id = ?",
            [substr($e->getMessage(), 0, 10000), json_encode($errResult, JSON_UNESCAPED_SLASHES), $jobId]
        );
    } catch (Throwable $ignored) {
    }

    catn8_mystery_worker_err(['success' => false, 'claimed' => true, 'job_id' => $jobId, 'status' => 'error', 'details' => $e->getMessage()]);
    exit(2);
}
