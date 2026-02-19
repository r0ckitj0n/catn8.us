<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_require_method('GET');
catn8_session_start();

catn8_json_response([
    'success' => true,
    'csrf' => catn8_csrf_token(),
]);
