<?php
if ($provider === 'openai') {
    $apiKey = secret_get(catn8_settings_ai_image_secret_key($provider, 'api_key'));
    if (!is_string($apiKey) || trim($apiKey) === '') {
        $fail(500, 'Missing AI image API key (openai)');
    }

    $factory = OpenAI::factory()->withApiKey(trim((string)$apiKey));
    if ($baseUrl !== '') {
        $factory = $factory->withBaseUri(catn8_validate_external_base_url($baseUrl));
    }
    $client = $factory->make();

    $payload = array_merge(['model' => ($model !== '' ? $model : 'dall-e-3'), 'prompt' => $prompt], $params);
    $payload['n'] = 1;
    if (!isset($payload['response_format'])) {
        $payload['response_format'] = 'b64_json';
    }

    $resp = $client->images()->create($payload);
    $b64 = '';
    if (isset($resp->data[0]->b64_json)) {
        $b64 = (string)$resp->data[0]->b64_json;
    } elseif (isset($resp->data[0]->url)) {
        $b64 = (string)$resp->data[0]->url;
    }

    $b64 = trim($b64);
    if ($b64 === '') {
        $fail(500, 'Image provider test did not return image data');
    }

    catn8_json_response([
        'success' => true,
        'ai_image' => $meta,
        'sample' => 'OK',
    ]);
}
