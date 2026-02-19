<?php

declare(strict_types=1);

function catn8_google_base64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function catn8_google_service_account_access_token(string $serviceAccountJson, string $scope): string
{
    static $cache = [];

    $key = hash('sha256', $serviceAccountJson . "\n" . $scope);
    $now = time();

    if (isset($cache[$key]) && is_array($cache[$key])) {
        $exp = (int)($cache[$key]['exp'] ?? 0);
        $token = (string)($cache[$key]['token'] ?? '');
        if ($token !== '' && $exp > ($now + 30)) {
            return $token;
        }
    }

    $sa = json_decode($serviceAccountJson, true);
    if (!is_array($sa)) {
        throw new RuntimeException('Invalid service account JSON');
    }

    $clientEmail = trim((string)($sa['client_email'] ?? ''));
    $privateKey = (string)($sa['private_key'] ?? '');
    $tokenUri = trim((string)($sa['token_uri'] ?? ''));

    if ($clientEmail === '' || $privateKey === '' || $tokenUri === '') {
        throw new RuntimeException('Service account JSON missing client_email/private_key/token_uri');
    }

    $header = ['alg' => 'RS256', 'typ' => 'JWT'];
    $claims = [
        'iss' => $clientEmail,
        'scope' => $scope,
        'aud' => $tokenUri,
        'iat' => $now,
        'exp' => $now + 3600,
    ];

    $encodedHeader = catn8_google_base64url_encode(json_encode($header, JSON_UNESCAPED_SLASHES));
    $encodedClaims = catn8_google_base64url_encode(json_encode($claims, JSON_UNESCAPED_SLASHES));
    $unsigned = $encodedHeader . '.' . $encodedClaims;

    $signature = '';
    $ok = openssl_sign($unsigned, $signature, $privateKey, OPENSSL_ALGO_SHA256);
    if (!$ok) {
        throw new RuntimeException('Failed to sign JWT with service account private key');
    }

    $jwt = $unsigned . '.' . catn8_google_base64url_encode($signature);

    $postFields = http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $jwt,
    ]);

    $resp = false;
    $status = 0;
    $details = '';

    if (function_exists('curl_init')) {
        $ch = curl_init();
        if ($ch === false) {
            throw new RuntimeException('Failed to fetch Google OAuth token: failed to init curl');
        }

        $flatHeaders = [
            'Content-Type: application/x-www-form-urlencoded',
            'Accept: application/json',
        ];

        curl_setopt($ch, CURLOPT_URL, $tokenUri);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'POST');
        curl_setopt($ch, CURLOPT_HTTPHEADER, $flatHeaders);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);

        $forceIpv4 = strtolower(trim((string)getenv('CATN8_FORCE_IPV4')));
        if ($forceIpv4 === '1' || $forceIpv4 === 'true' || $forceIpv4 === 'yes') {
            curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
        }

        $raw = curl_exec($ch);
        $err = curl_error($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if (is_string($raw)) {
            $resp = $raw;
        } else {
            $details = $err !== '' ? $err : 'unknown curl error';
        }
    } else {
        $opts = [
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/x-www-form-urlencoded\r\n" .
                    "Accept: application/json\r\n",
                'content' => $postFields,
                'timeout' => 15,
                'ignore_errors' => true,
            ],
        ];

        $context = stream_context_create($opts);
        $resp = @file_get_contents($tokenUri, false, $context);

        if (isset($http_response_header) && is_array($http_response_header)) {
            foreach ($http_response_header as $h) {
                if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) {
                    $status = (int)$m[1];
                    break;
                }
            }
        }

        if (!is_string($resp) || $resp === '') {
            $last = error_get_last();
            $details = is_array($last) ? (string)($last['message'] ?? '') : '';
        }
    }

    if (!is_string($resp) || $resp === '') {
        if ($details !== '') {
            throw new RuntimeException('Failed to fetch Google OAuth token: ' . $details);
        }
        throw new RuntimeException('Failed to fetch Google OAuth token (HTTP ' . $status . ')');
    }

    $data = json_decode($resp, true);
    if (!is_array($data)) {
        throw new RuntimeException('Google OAuth token response was not valid JSON');
    }

    $accessToken = trim((string)($data['access_token'] ?? ''));
    $expiresIn = (int)($data['expires_in'] ?? 0);

    if ($accessToken === '') {
        $details = (string)($data['error_description'] ?? $data['error'] ?? 'Unknown error');
        $snippet = substr($resp, 0, 800);
        $snippet = str_replace(["\r\n", "\r"], "\n", $snippet);
        throw new RuntimeException('Google OAuth token fetch failed (HTTP ' . $status . '): ' . $details . "\n" . $snippet);
    }

    $cache[$key] = [
        'token' => $accessToken,
        'exp' => $now + ($expiresIn > 0 ? $expiresIn : 3600),
    ];

    return $accessToken;
}
