<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_session_start();
catn8_require_admin();

catn8_require_method('GET');

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

$rawCfg = secret_get(catn8_secret_key('ai_image.config'));
$cfg = [];
if (is_string($rawCfg) && trim($rawCfg) !== '') {
    $decoded = json_decode($rawCfg, true);
    if (is_array($decoded)) {
        $cfg = $decoded;
    }
}

$provider = strtolower(trim((string)($cfg['provider'] ?? $defaults['provider'])));

if ($provider !== 'google_vertex_ai') {
    catn8_json_response([
        'success' => false,
        'error' => 'Location reference test is only supported for provider google_vertex_ai',
        'ai_image' => [
            'provider' => $provider,
        ],
    ], 400);
}

$secretKey = static function (string $p, string $n): string {
    $pp = strtolower(trim($p));
    $nn = strtolower(trim($n));
    if ($pp === '' || $nn === '') {
        throw new RuntimeException('Invalid secret key request');
    }
    return catn8_secret_key('ai_image.secret.' . $pp . '.' . $nn);
};

$placesKey = secret_get($secretKey($provider, 'google_places_api_key'));
$streetKey = secret_get($secretKey($provider, 'google_street_view_api_key'));

$placesKey = is_string($placesKey) ? trim($placesKey) : '';
$streetKey = is_string($streetKey) ? trim($streetKey) : '';

$q = trim((string)($_GET['q'] ?? ''));
if ($q === '') {
    $q = 'Times Square, New York';
}

$fetchBinary = static function (string $url, int $timeoutSeconds = 30): array {
    $ch = curl_init();
    if ($ch === false) {
        throw new RuntimeException('Failed to init curl');
    }

    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_TIMEOUT, $timeoutSeconds);

    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);

    $ct = (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);

    if (!is_string($raw)) {
        throw new RuntimeException('HTTP request failed: ' . ($err !== '' ? $err : 'unknown error'));
    }

    return [
        'status' => $status,
        'content_type' => $ct,
        'raw' => $raw,
    ];
};

try {
    $attempts = [];

    if ($placesKey !== '') {
        $url = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json?inputtype=textquery&fields=photos&input=' . rawurlencode($q) . '&key=' . rawurlencode($placesKey);
        $resp = catn8_http_json_with_status('GET', $url, [], null, 10, 30);
        $status = trim((string)($resp['json']['status'] ?? ''));
        $attempts[] = [
            'type' => 'google_places_findplacefromtext',
            'http_status' => (int)($resp['status'] ?? 0),
            'api_status' => $status,
        ];

        if ($status !== '' && $status !== 'OK' && $status !== 'ZERO_RESULTS') {
            $msg = trim((string)($resp['json']['error_message'] ?? ''));
            throw new RuntimeException('Google Places findplacefromtext error: ' . $status . ($msg !== '' ? (': ' . $msg) : ''));
        }

        $candidates = $resp['json']['candidates'] ?? null;
        if (is_array($candidates) && count($candidates)) {
            $photos = $candidates[0]['photos'] ?? null;
            if (is_array($photos) && count($photos)) {
                $photoReference = trim((string)($photos[0]['photo_reference'] ?? ''));
                if ($photoReference !== '') {
                    $photoUrl = 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photoreference=' . rawurlencode($photoReference) . '&key=' . rawurlencode($placesKey);
                    $bin = $fetchBinary($photoUrl, 30);
                    $attempts[] = [
                        'type' => 'google_places_photo',
                        'http_status' => (int)($bin['status'] ?? 0),
                        'content_type' => (string)($bin['content_type'] ?? ''),
                        'bytes' => is_string($bin['raw'] ?? null) ? strlen((string)$bin['raw']) : 0,
                    ];

                    if ((int)($bin['status'] ?? 0) >= 200 && (int)($bin['status'] ?? 0) < 300 && is_string($bin['raw']) && strlen($bin['raw']) > 2000) {
                        catn8_json_response([
                            'success' => true,
                            'method' => 'google_places_photo',
                            'q' => $q,
                            'bytes' => strlen($bin['raw']),
                            'content_type' => (string)($bin['content_type'] ?? ''),
                            'attempts' => $attempts,
                        ]);
                    }
                }
            }
        }
    }

    if ($streetKey !== '') {
        $svUrl = 'https://maps.googleapis.com/maps/api/streetview?size=600x400&location=' . rawurlencode($q) . '&key=' . rawurlencode($streetKey);
        $bin = $fetchBinary($svUrl, 30);
        $attempts[] = [
            'type' => 'google_street_view',
            'http_status' => (int)($bin['status'] ?? 0),
            'content_type' => (string)($bin['content_type'] ?? ''),
            'bytes' => is_string($bin['raw'] ?? null) ? strlen((string)$bin['raw']) : 0,
        ];

        if ((int)($bin['status'] ?? 0) >= 200 && (int)($bin['status'] ?? 0) < 300 && is_string($bin['raw']) && strlen($bin['raw']) > 2000) {
            catn8_json_response([
                'success' => true,
                'method' => 'google_street_view',
                'q' => $q,
                'bytes' => strlen($bin['raw']),
                'content_type' => (string)($bin['content_type'] ?? ''),
                'attempts' => $attempts,
            ]);
        }
    }

    $missing = [];
    if ($placesKey === '') $missing[] = 'Google Places API key';
    if ($streetKey === '') $missing[] = 'Google Street View API key';

    $suffix = count($missing) ? (' (missing: ' . implode(', ', $missing) . ')') : '';

    catn8_json_response([
        'success' => false,
        'error' => 'No location reference image could be retrieved' . $suffix,
        'q' => $q,
        'attempts' => $attempts,
    ], 500);
} catch (Throwable $e) {
    catn8_json_response([
        'success' => false,
        'error' => $e->getMessage(),
        'q' => $q,
    ], 500);
}
