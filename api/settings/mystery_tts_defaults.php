<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_session_start();
catn8_require_admin();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

$defaults = [
    'voice_map_active' => 'google',
    'output_format' => 'mp3',
    'language_code' => 'en-US',
    'voice_name' => '',
    'speaking_rate' => 1.0,
    'pitch' => 0.0,
];

$key = catn8_secret_key('mystery.tts_defaults');

$normalize = static function (array $in) use ($defaults): array {
    $voiceMapActive = strtolower(trim((string)($in['voice_map_active'] ?? $defaults['voice_map_active'])));
    if ($voiceMapActive !== 'google' && $voiceMapActive !== 'live') {
        $voiceMapActive = $defaults['voice_map_active'];
    }

    $outputFormat = strtolower(trim((string)($in['output_format'] ?? $defaults['output_format'])));
    if ($outputFormat !== 'mp3' && $outputFormat !== 'wav') {
        $outputFormat = $defaults['output_format'];
    }

    $languageCode = trim((string)($in['language_code'] ?? $defaults['language_code']));
    if ($languageCode === '') {
        $languageCode = $defaults['language_code'];
    }

    $voiceName = trim((string)($in['voice_name'] ?? $defaults['voice_name']));

    $sr = $in['speaking_rate'] ?? $defaults['speaking_rate'];
    if (!is_numeric($sr)) $sr = $defaults['speaking_rate'];
    $sr = (float)$sr;
    if ($sr < 0.25) $sr = 0.25;
    if ($sr > 4.0) $sr = 4.0;

    $pitch = $in['pitch'] ?? $defaults['pitch'];
    if (!is_numeric($pitch)) $pitch = $defaults['pitch'];
    $pitch = (float)$pitch;
    if ($pitch < -20.0) $pitch = -20.0;
    if ($pitch > 20.0) $pitch = 20.0;

    return [
        'voice_map_active' => $voiceMapActive,
        'output_format' => $outputFormat,
        'language_code' => $languageCode,
        'voice_name' => $voiceName,
        'speaking_rate' => $sr,
        'pitch' => $pitch,
    ];
};

$read = static function () use ($key, $defaults, $normalize): array {
    $raw = secret_get($key);
    $cfg = [];
    if (is_string($raw) && $raw !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) $cfg = $decoded;
    }
    return $normalize($cfg + $defaults);
};

if ($method === 'GET') {
    catn8_json_response(['success' => true, 'tts_defaults' => $read()]);
}

if ($method !== 'POST') {
    catn8_json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

$body = catn8_read_json_body();

if (!is_array($body)) {
    catn8_json_response(['success' => false, 'error' => 'Invalid JSON body'], 400);
}

$next = $normalize($body);

secret_set($key, json_encode($next, JSON_UNESCAPED_SLASHES));

catn8_json_response(['success' => true, 'tts_defaults' => $read()]);
