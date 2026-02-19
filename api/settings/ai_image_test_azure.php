<?php
if ($provider === 'azure_openai') {
    $apiKey = secret_get(catn8_settings_ai_image_secret_key($provider, 'api_key'));
    if (!is_string($apiKey) || trim($apiKey) === '') {
        $fail(500, 'Missing AI image API key (azure_openai)');
    }

    $endpoint = trim((string)($providerConfig['azure_endpoint'] ?? ''));
    $deployment = trim((string)($providerConfig['azure_deployment'] ?? ''));
    $apiVersion = trim((string)($providerConfig['azure_api_version'] ?? ''));
    if ($endpoint === '' || $deployment === '' || $apiVersion === '') {
        $fail(500, 'Azure OpenAI provider_config is incomplete');
    }

    $endpoint = rtrim(catn8_validate_external_base_url($endpoint), '/');
    $url = $endpoint . '/openai/deployments/' . rawurlencode($deployment) . '/images/generations?api-version=' . rawurlencode($apiVersion);

    $body = array_merge($params, [
        'prompt' => $prompt,
        'n' => 1,
        'response_format' => 'b64_json',
    ]);

    $res = catn8_http_json_with_status('POST', $url, ['api-key' => trim((string)$apiKey)], $body);
    $status = (int)($res['status'] ?? 0);
    $json = $res['json'] ?? null;

    if ($status < 200 || $status >= 300) {
        $msg = '';
        if (is_array($json) && isset($json['error'])) {
            if (is_string($json['error'])) {
                $msg = $json['error'];
            } elseif (is_array($json['error']) && isset($json['error']['message']) && is_string($json['error']['message'])) {
                $msg = (string)$json['error']['message'];
            }
        }
        $fail(500, 'HTTP ' . $status . ($msg !== '' ? ': ' . $msg : ''), ['http_status' => $status]);
    }

    $ok = false;
    if (is_array($json)) {
        $data = $json['data'] ?? null;
        if (is_array($data) && isset($data[0]) && is_array($data[0])) {
            $ok = (isset($data[0]['b64_json']) && is_string($data[0]['b64_json']) && trim($data[0]['b64_json']) !== '')
                || (isset($data[0]['url']) && is_string($data[0]['url']) && trim($data[0]['url']) !== '');
        }
    }
    if (!$ok) {
        $fail(500, 'Azure OpenAI image response missing image data', ['http_status' => $status]);
    }

    catn8_json_response([
        'success' => true,
        'ai_image' => $meta,
        'http_status' => $status,
        'sample' => 'OK',
    ]);
}
