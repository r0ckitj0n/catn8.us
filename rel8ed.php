<?php
declare(strict_types=1);

// Legacy path: Rel8ed → Rel8d
$target = '/rel8d';
$uri = (string)($_SERVER['REQUEST_URI'] ?? '/rel8ed');
$path = parse_url($uri, PHP_URL_PATH);
$path = is_string($path) ? $path : '/rel8ed';
$suffix = '';
if (preg_match('#^/rel8ed(/.*)?$#i', $path, $m) === 1) {
    $suffix = isset($m[1]) ? (string)$m[1] : '';
}
$query = parse_url($uri, PHP_URL_QUERY);
$qs = is_string($query) && $query !== '' ? ('?' . $query) : '';

header('Location: ' . $target . $suffix . $qs, true, 301);
exit;
