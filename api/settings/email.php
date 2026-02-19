<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../emailer.php';

catn8_session_start();
catn8_require_admin();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

if ($method === 'GET') {
    $cfg = catn8_get_smtp_config_safe();
    catn8_json_response(['success' => true, 'config' => $cfg]);
}

if ($method !== 'POST') {
    catn8_json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

$body = catn8_read_json_body();

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

$cfg = catn8_get_smtp_config_safe();
catn8_json_response(['success' => true, 'config' => $cfg]);
