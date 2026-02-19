<?php

declare(strict_types=1);

if (catn8_is_local_request()) {
    ini_set('display_errors', '1');
    ini_set('display_startup_errors', '1');
    error_reporting(E_ALL);

    set_error_handler(static function ($severity, $message, $file, $line) {
        throw new ErrorException($message, 0, $severity, $file, $line);
    });

    set_exception_handler(static function (Throwable $e) {
        if (!headers_sent()) {
            catn8_json_response([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    });

    register_shutdown_function(static function () {
        $err = error_get_last();
        if (!$err || headers_sent()) return;
        $type = (int)($err['type'] ?? 0);
        if (!in_array($type, [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) return;
        catn8_json_response([
            'success' => false,
            'error' => (string)($err['message'] ?? 'Fatal error'),
        ], 500);
    });
} elseif (PHP_SAPI !== 'cli') {
    set_exception_handler(static function (Throwable $e) {
        $msg = 'Unhandled exception: ' . $e->getMessage();
        $trace = $e->getTraceAsString();
        error_log($msg . "\n" . $trace);
        if (!headers_sent()) {
            catn8_json_response([
                'success' => false,
                'error' => 'Internal server error',
            ], 500);
        }
    });

    register_shutdown_function(static function () {
        $err = error_get_last();
        if (!$err || headers_sent()) return;
        $type = (int)($err['type'] ?? 0);
        if (!in_array($type, [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) return;
        $msg = (string)($err['message'] ?? 'Fatal error');
        $file = (string)($err['file'] ?? '');
        $line = (int)($err['line'] ?? 0);
        error_log('Fatal error: ' . $msg . ' in ' . $file . ':' . $line);
        catn8_json_response([
            'success' => false,
            'error' => 'Internal server error',
        ], 500);
    });
}

function catn8_log_error(string $message, array $context = []): void
{
    $message = trim($message);
    if ($message === '') {
        $message = 'Error';
    }
    if ($context) {
        $ctx = json_encode($context, JSON_UNESCAPED_SLASHES);
        if (is_string($ctx) && $ctx !== '') {
            error_log($message . ' ' . $ctx);
            return;
        }
    }
    error_log($message);
}
