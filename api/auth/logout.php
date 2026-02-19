<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_require_method('POST');
catn8_session_start();

unset($_SESSION['catn8_user_id']);

catn8_json_response(['success' => true]);
