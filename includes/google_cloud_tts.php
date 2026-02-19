<?php

declare(strict_types=1);

require_once __DIR__ . '/google_oauth_service_account.php';

function catn8_google_cloud_tts_list_voices(array $opts): array
{
    $apiKey = trim((string)($opts['api_key'] ?? ''));
    $serviceAccountJson = (string)($opts['service_account_json'] ?? '');
    $languageCode = trim((string)($opts['language_code'] ?? 'en'));

    $authMode = '';
    $bearer = '';

    if (trim($serviceAccountJson) !== '') {
        $bearer = catn8_google_service_account_access_token($serviceAccountJson, 'https://www.googleapis.com/auth/cloud-platform');
        $authMode = 'oauth';
    } elseif ($apiKey !== '') {
        $authMode = 'api_key';
    } else {
        throw new RuntimeException('Missing credentials: provide service_account_json or api_key');
    }

    $url = 'https://texttospeech.googleapis.com/v1/voices';
    $qs = [];
    if ($languageCode !== '') {
        $qs[] = 'languageCode=' . rawurlencode($languageCode);
    }
    if ($authMode === 'api_key') {
        $qs[] = 'key=' . rawurlencode($apiKey);
    }
    if (count($qs) > 0) {
        $url .= '?' . implode('&', $qs);
    }

    $ch = curl_init();
    if ($ch === false) {
        throw new RuntimeException('Google Cloud TTS request failed: failed to init curl');
    }

    $flatHeaders = ['Accept: application/json'];
    if ($authMode === 'oauth') {
        $flatHeaders[] = 'Authorization: Bearer ' . $bearer;
    }

    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'GET');
    curl_setopt($ch, CURLOPT_HTTPHEADER, $flatHeaders);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);

    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if (!is_string($raw)) {
        throw new RuntimeException('Google Cloud TTS voices request failed: ' . ($err !== '' ? $err : 'unknown error'));
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        if ($status < 200 || $status >= 300) {
            throw new RuntimeException('Google Cloud TTS error: HTTP ' . $status . ' returned non-JSON response');
        }
        throw new RuntimeException('Google Cloud TTS voices response was not valid JSON');
    }

    if ($status < 200 || $status >= 300 || isset($data['error'])) {
        $msg = '';
        if (isset($data['error'])) {
            if (is_string($data['error'])) {
                $msg = $data['error'];
            } elseif (is_array($data['error']) && isset($data['error']['message']) && is_string($data['error']['message'])) {
                $msg = (string)$data['error']['message'];
            }
        }
        if ($msg === '' && isset($data['message']) && is_string($data['message'])) {
            $msg = (string)$data['message'];
        }
        throw new RuntimeException('Google Cloud TTS error: HTTP ' . $status . ($msg !== '' ? ' - ' . $msg : ''));
    }

    $voices = $data['voices'] ?? [];
    if (!is_array($voices)) $voices = [];

    return [
        'voices' => $voices,
        'auth_mode' => $authMode,
        'http_status' => $status,
    ];
}

function catn8_google_cloud_tts_synthesize(array $opts): array
{
    $projectId = trim((string)($opts['project_id'] ?? ''));
    $apiKey = trim((string)($opts['api_key'] ?? ''));
    $serviceAccountJson = (string)($opts['service_account_json'] ?? '');

    $text = (string)($opts['text'] ?? '');
    $languageCode = trim((string)($opts['language_code'] ?? 'en-US'));
    $voiceName = trim((string)($opts['voice_name'] ?? ''));
    $ssml = (string)($opts['ssml'] ?? '');

    $speakingRate = $opts['speaking_rate'] ?? 1.0;
    if (!is_numeric($speakingRate)) $speakingRate = 1.0;
    $speakingRate = (float)$speakingRate;

    $pitch = $opts['pitch'] ?? 0.0;
    if (!is_numeric($pitch)) $pitch = 0.0;
    $pitch = (float)$pitch;

    $audioEncoding = strtoupper(trim((string)($opts['audio_encoding'] ?? 'MP3')));
    $sampleRateHertz = $opts['sample_rate_hertz'] ?? null;
    if ($sampleRateHertz !== null && !is_numeric($sampleRateHertz)) $sampleRateHertz = null;

    if ($projectId === '') {
        throw new RuntimeException('Missing required project_id');
    }
    if (trim($text) === '' && trim($ssml) === '') {
        throw new RuntimeException('Missing required text or ssml');
    }

    $authMode = '';
    $bearer = '';

    if (trim($serviceAccountJson) !== '') {
        $bearer = catn8_google_service_account_access_token($serviceAccountJson, 'https://www.googleapis.com/auth/cloud-platform');
        $authMode = 'oauth';
    } elseif ($apiKey !== '') {
        $authMode = 'api_key';
    } else {
        throw new RuntimeException('Missing credentials: provide service_account_json or api_key');
    }

    $voice = [
        'languageCode' => $languageCode !== '' ? $languageCode : 'en-US',
    ];
    if ($voiceName !== '') {
        $voice['name'] = $voiceName;
    }

    $input = [];
    if (trim($ssml) !== '') {
        $input['ssml'] = $ssml;
    } else {
        $input['text'] = $text;
    }

    $audioConfig = [
        'audioEncoding' => $audioEncoding !== '' ? $audioEncoding : 'MP3',
        'speakingRate' => $speakingRate,
        'pitch' => $pitch,
    ];
    if ($sampleRateHertz !== null) {
        $audioConfig['sampleRateHertz'] = (int)$sampleRateHertz;
    }

    $payload = [
        'input' => $input,
        'voice' => $voice,
        'audioConfig' => $audioConfig,
    ];

    $url = 'https://texttospeech.googleapis.com/v1/text:synthesize';
    if ($authMode === 'api_key') {
        $url .= '?key=' . rawurlencode($apiKey);
    }

    $headers = "Content-Type: application/json\r\nAccept: application/json\r\n";
    if ($authMode === 'oauth') {
        $headers .= 'Authorization: Bearer ' . $bearer . "\r\n";
    }

    $optsHttp = [
        'http' => [
            'method' => 'POST',
            'header' => $headers,
            'content' => json_encode($payload, JSON_UNESCAPED_SLASHES),
            'timeout' => 20,
        ],
    ];

    $context = stream_context_create($optsHttp);
    $resp = @file_get_contents($url, false, $context);

    $status = 0;
    if (isset($http_response_header) && is_array($http_response_header)) {
        foreach ($http_response_header as $h) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) {
                $status = (int)$m[1];
                break;
            }
        }
    }

    if (!is_string($resp) || $resp === '') {
        throw new RuntimeException('Google Cloud TTS request failed');
    }

    $data = json_decode($resp, true);
    if (!is_array($data)) {
        throw new RuntimeException('Google Cloud TTS response was not valid JSON');
    }

    if ($status >= 400 || isset($data['error'])) {
        $msg = '';
        if (isset($data['error']['message'])) {
            $msg = (string)$data['error']['message'];
        }
        if ($msg === '') {
            $msg = 'HTTP ' . $status;
        }
        throw new RuntimeException('Google Cloud TTS error: ' . $msg);
    }

    $audioContentB64 = (string)($data['audioContent'] ?? '');
    if ($audioContentB64 === '') {
        throw new RuntimeException('Google Cloud TTS response missing audioContent');
    }

    $bin = base64_decode($audioContentB64, true);
    if (!is_string($bin) || $bin === '') {
        throw new RuntimeException('Failed to decode audioContent');
    }

    return [
        'audio_bytes' => $bin,
        'audio_encoding' => $audioEncoding,
        'auth_mode' => $authMode,
        'http_status' => $status,
    ];
}
