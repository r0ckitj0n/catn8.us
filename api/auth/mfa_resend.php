<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../emailer.php';
require_once __DIR__ . '/../../includes/auth_mfa.php';

catn8_require_method('POST');
catn8_session_start();
catn8_rate_limit_ip_require('auth.mfa.resend', 10, 3600);

$result = catn8_mfa_resend_for_session();
catn8_json_response($result['body'], $result['status']);
