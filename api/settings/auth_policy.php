<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_session_start();
catn8_require_admin();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

$KEY_REQUIRE_VERIFY = 'auth.require_email_verification';
$KEY_ALLOW_PUBLIC_SIGNUP = 'auth.allow_public_signup';

if ($method === 'GET') {
    $requireVerify = catn8_setting_bool($KEY_REQUIRE_VERIFY, false);
    $allowPublic = catn8_setting_bool($KEY_ALLOW_PUBLIC_SIGNUP, true);

    catn8_json_response([
        'success' => true,
        'policy' => [
            'require_email_verification' => $requireVerify ? 1 : 0,
            'allow_public_signup' => $allowPublic ? 1 : 0,
        ],
    ]);
}

if ($method !== 'POST') {
    catn8_json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

$body = catn8_read_json_body();
$requireVerify = (int)($body['require_email_verification'] ?? 0) === 1;
$allowPublic = (int)($body['allow_public_signup'] ?? 1) === 1;

catn8_setting_set_bool($KEY_REQUIRE_VERIFY, $requireVerify);
catn8_setting_set_bool($KEY_ALLOW_PUBLIC_SIGNUP, $allowPublic);

catn8_json_response([
    'success' => true,
    'policy' => [
        'require_email_verification' => $requireVerify ? 1 : 0,
        'allow_public_signup' => $allowPublic ? 1 : 0,
    ],
]);
