<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../emailer.php';
require_once __DIR__ . '/../../includes/auth_mfa.php';

catn8_require_method('POST');
catn8_session_start();
catn8_rate_limit_ip_require('auth.mfa.verify', 30, 600);

$body = catn8_read_json_body();
$code = (string)($body['code'] ?? '');
$trustDevice = ($body['trust_device'] ?? false) === true || ($body['trust_device'] ?? false) === 1 || ($body['trust_device'] ?? false) === '1';
$result = catn8_mfa_verify_for_session($code, $trustDevice);
catn8_json_response($result['body'], $result['status']);
