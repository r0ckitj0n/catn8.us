<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_require_method('POST');
catn8_session_start();

unset($_SESSION['catn8_user_id'], $_SESSION['catn8_mfa_pending_user_id'], $_SESSION['catn8_mfa_purpose'], $_SESSION['catn8_mfa_verified_at']);

catn8_json_response(['success' => true]);
