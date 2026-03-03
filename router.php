<?php

declare(strict_types=1);

$root = __DIR__;
$requestUri = (string)($_SERVER['REQUEST_URI'] ?? '/');
$path = (string)(parse_url($requestUri, PHP_URL_PATH) ?? '/');
if ($path === '') {
    $path = '/';
}

function catn8_router_is_local_vite_enabled(string $root): bool
{
    if (is_file($root . '/.disable-vite-dev')) {
        return false;
    }
    $env = strtolower(trim((string)(getenv('CATN8_VITE_DISABLE_DEV') ?: '')));
    return !in_array($env, ['1', 'true', 'yes', 'on'], true);
}

function catn8_router_vite_origin(string $root): string
{
    $hotPath = $root . '/hot';
    if (is_file($hotPath)) {
        $hot = trim((string)file_get_contents($hotPath));
        if ($hot !== '') {
            return rtrim($hot, '/');
        }
    }
    $envOrigin = trim((string)(getenv('CATN8_VITE_ORIGIN') ?: ''));
    if ($envOrigin !== '') {
        return rtrim($envOrigin, '/');
    }
    return 'http://localhost:5178';
}

function catn8_router_respond_file(string $file): void
{
    if (!is_file($file)) {
        http_response_code(404);
        header('Content-Type: text/plain; charset=UTF-8');
        echo 'Not found';
        exit;
    }
    $mime = function_exists('mime_content_type') ? (string)(mime_content_type($file) ?: '') : '';
    if ($mime === '') {
        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        $mimeMap = [
            'html' => 'text/html; charset=UTF-8',
            'css' => 'text/css; charset=UTF-8',
            'js' => 'application/javascript; charset=UTF-8',
            'json' => 'application/json; charset=UTF-8',
            'svg' => 'image/svg+xml',
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'woff' => 'font/woff',
            'woff2' => 'font/woff2',
        ];
        $mime = $mimeMap[$ext] ?? 'application/octet-stream';
    }
    header('Content-Type: ' . $mime);
    readfile($file);
    exit;
}

$isApiRoute = strncmp($path, '/api/', 5) === 0;
$isPhpRoute = $isApiRoute || substr($path, -4) === '.php';

if ($isPhpRoute) {
    $candidate = $path === '/' ? '/index.php' : $path;
    $target = $root . '/' . ltrim($candidate, '/');
    if (!is_file($target)) {
        http_response_code(404);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(['success' => false, 'error' => 'Not found']);
        exit;
    }
    require $target;
    exit;
}

$requestMethod = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$viteEnabled = catn8_router_is_local_vite_enabled($root);

if ($viteEnabled) {
    $origin = catn8_router_vite_origin($root);
    $target = $origin . $requestUri;
    header('Location: ' . $target, true, ($requestMethod === 'GET' ? 302 : 307));
    exit;
}

$directPath = $root . '/' . ltrim($path, '/');
if (is_file($directPath)) {
    catn8_router_respond_file($directPath);
}

$distIndex = $root . '/dist/index.html';
if (is_file($distIndex)) {
    catn8_router_respond_file($distIndex);
}

catn8_router_respond_file($root . '/index.html');
