#!/usr/bin/env php
<?php

declare(strict_types=1);

require_once __DIR__ . '/../../api/bootstrap.php';
require_once __DIR__ . '/../../includes/google_oauth_service_account.php';

$location = $argv[1] ?? 'us-central1';

$saJson = secret_get('CATN8_MYSTERY_GCP_SERVICE_ACCOUNT_JSON');
if (!is_string($saJson) || trim($saJson) === '') {
    fwrite(STDERR, "Missing secret CATN8_MYSTERY_GCP_SERVICE_ACCOUNT_JSON\n");
    exit(2);
}

$sa = json_decode($saJson, true);
if (!is_array($sa)) {
    fwrite(STDERR, "CATN8_MYSTERY_GCP_SERVICE_ACCOUNT_JSON is not valid JSON\n");
    exit(2);
}

$projectId = trim((string)($sa['project_id'] ?? ''));
if ($projectId === '') {
    fwrite(STDERR, "Service account JSON missing project_id\n");
    exit(2);
}

$token = catn8_google_service_account_access_token($saJson, 'https://www.googleapis.com/auth/cloud-platform');

$host = '';
$loc = strtolower(trim((string)$location));
if ($loc === 'global') {
    $host = 'aiplatform.googleapis.com';
} else {
    $host = $location . '-aiplatform.googleapis.com';
}

$baseUrl = 'https://' . $host . '/v1beta1/publishers/google/models';
$pageToken = '';

$headers = "Accept: application/json\r\nAuthorization: Bearer {$token}\r\n";

do {
    $url = $baseUrl . '?page_size=300';
    if ($pageToken !== '') {
        $url .= '&page_token=' . rawurlencode($pageToken);
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'header' => $headers,
            'ignore_errors' => true,
            'timeout' => 30,
        ],
    ]);

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

    if (!is_string($resp) || trim($resp) === '') {
        fwrite(STDERR, "Failed to list models (empty response)\n");
        exit(1);
    }

    $data = json_decode($resp, true);
    if (!is_array($data)) {
        $snippet = substr($resp, 0, 800);
        $snippet = str_replace(["\r\n", "\r"], "\n", $snippet);
        fwrite(STDERR, "Response was not valid JSON (HTTP {$status}). First 800 chars:\n" . $snippet . "\n");
        exit(1);
    }

    if ($status >= 400 || isset($data['error'])) {
        $msg = '';
        if (isset($data['error']['message'])) {
            $msg = (string)$data['error']['message'];
        }
        if ($msg === '') {
            $msg = 'HTTP ' . $status;
        }
        fwrite(STDERR, "ERROR: {$msg}\n");
        exit(1);
    }

    $publisherModels = $data['publisherModels'] ?? [];
    if (!is_array($publisherModels)) {
        $publisherModels = [];
    }

    foreach ($publisherModels as $m) {
        if (!is_array($m)) continue;
        $name = (string)($m['name'] ?? '');
        $display = (string)($m['displayName'] ?? '');
        if ($name === '') continue;
        fwrite(STDOUT, $name);
        if ($display !== '') {
            fwrite(STDOUT, "\t" . $display);
        }
        fwrite(STDOUT, "\n");
    }

    $pageToken = trim((string)($data['nextPageToken'] ?? ''));
} while ($pageToken !== '');
