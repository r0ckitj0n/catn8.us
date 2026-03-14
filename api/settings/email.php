<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../emailer.php';

catn8_session_start();
catn8_require_admin();

function catn8_email_settings_payload(): array
{
    $cfg = catn8_get_smtp_config_safe();
    $passwordPresent = trim((string)(secret_get(catn8_secret_key('smtp.pass')) ?? '')) !== '';

    return [
        'success' => true,
        'config' => $cfg,
        'meta' => [
            'password_present' => $passwordPresent ? 1 : 0,
            'smtp_ready' => ($cfg['configured'] ?? false) && $passwordPresent ? 1 : 0,
        ],
    ];
}

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

if ($method === 'GET') {
    catn8_json_response(catn8_email_settings_payload());
}

if ($method !== 'POST') {
    catn8_json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

$body = catn8_read_json_body();
$action = trim((string)($body['action'] ?? 'save'));

if (!in_array($action, ['save', 'test_send'], true)) {
    catn8_json_response(['success' => false, 'error' => 'Unsupported action'], 400);
}

if ($action === 'test_send') {
    $payload = catn8_email_settings_payload();
    $cfg = $payload['config'] ?? [];
    $toEmail = trim((string)($body['to_email'] ?? ''));
    $toName = trim((string)($cfg['from_name'] ?? 'catn8.us'));

    if ($toEmail === '') {
        catn8_json_response(['success' => false, 'error' => 'Enter a test recipient email address before sending a test email'], 400);
    }

    if (filter_var($toEmail, FILTER_VALIDATE_EMAIL) === false) {
        catn8_json_response(['success' => false, 'error' => 'Enter a valid test recipient email address'], 400);
    }

    if (($payload['meta']['smtp_ready'] ?? 0) !== 1) {
        catn8_json_response(['success' => false, 'error' => 'SMTP settings are not ready yet. Save a full configuration first.'], 400);
    }

    $subject = 'catn8.us test email';
    $html = '<p>This is a test email from your catn8.us SMTP settings.</p>'
        . '<p><strong>Sent at:</strong> ' . htmlspecialchars((new DateTimeImmutable('now'))->format('Y-m-d H:i:s T'), ENT_QUOTES, 'UTF-8') . '</p>'
        . '<p><strong>Mailbox:</strong> ' . htmlspecialchars($toEmail, ENT_QUOTES, 'UTF-8') . '</p>';

    try {
        catn8_send_email($toEmail, $toName, $subject, $html);
    } catch (Throwable $e) {
        catn8_log_error('[settings/email test_send] failed', [
            'to_email' => $toEmail,
            'smtp_host' => (string)($cfg['host'] ?? ''),
            'smtp_user' => (string)($cfg['user'] ?? ''),
            'error' => $e->getMessage(),
        ]);
        catn8_json_response([
            'success' => false,
            'error' => 'Failed to send test email: ' . $e->getMessage(),
        ], 500);
    }

    $payload['message'] = 'Test email sent to ' . $toEmail . '.';
    $payload['sent_to'] = $toEmail;
    catn8_json_response($payload);
}

$host = trim((string)($body['host'] ?? ''));
$port = (int)($body['port'] ?? 587);
$secure = trim((string)($body['secure'] ?? 'tls'));
$user = trim((string)($body['user'] ?? ''));
$pass = (string)($body['pass'] ?? '');
$fromEmail = trim((string)($body['from_email'] ?? ''));
$fromName = trim((string)($body['from_name'] ?? 'catn8.us'));

if ($host === '' || $fromEmail === '') {
    catn8_json_response(['success' => false, 'error' => 'SMTP host and from email are required'], 400);
}

secret_set(catn8_secret_key('smtp.host'), $host);
secret_set(catn8_secret_key('smtp.port'), (string)$port);
secret_set(catn8_secret_key('smtp.secure'), $secure);
secret_set(catn8_secret_key('smtp.user'), $user);
if ($pass !== '') {
    secret_set(catn8_secret_key('smtp.pass'), $pass);
}
secret_set(catn8_secret_key('smtp.from_email'), $fromEmail);
secret_set(catn8_secret_key('smtp.from_name'), $fromName);

catn8_json_response(catn8_email_settings_payload());
