<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_session_start();
catn8_require_admin();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

$defaults = [
    'brand_primary' => '#9b59b6',
    'brand_secondary' => '#2ecc71',
    'action_fg' => '#ffffff',
    'button_radius_px' => 12,
    'panel_radius_px' => 16,
    'hover_lift_px' => 2,
    'hover_scale_pct' => 102,
    'surface_alpha_pct' => 96,
    'surface_blur_px' => 5,
    'transition_ms' => 170,
    'focus_ring_color' => '#2f75d8',
    'icon_button_size_px' => 32,
    'content_max_width_px' => 1680,
    'base_font_size_px' => 16,
];

$key = catn8_secret_key('appearance.tokens');

function catn8_parse_color($value, string $fallback): string
{
    $raw = strtolower(trim((string)$value));
    if (!preg_match('/^#[0-9a-f]{6}$/', $raw)) return $fallback;
    return $raw;
}

function catn8_parse_int($value, int $fallback, int $min, int $max): int
{
    if (!is_numeric($value)) return $fallback;
    $n = (int)round((float)$value);
    if ($n < $min) return $min;
    if ($n > $max) return $max;
    return $n;
}

if ($method === 'GET') {
    $raw = secret_get($key);
    $tokens = [];
    if (is_string($raw) && $raw !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) $tokens = $decoded;
    }

    $out = [
        'brand_primary' => catn8_parse_color($tokens['brand_primary'] ?? '', $defaults['brand_primary']),
        'brand_secondary' => catn8_parse_color($tokens['brand_secondary'] ?? '', $defaults['brand_secondary']),
        'action_fg' => catn8_parse_color($tokens['action_fg'] ?? '', $defaults['action_fg']),
        'button_radius_px' => catn8_parse_int($tokens['button_radius_px'] ?? null, $defaults['button_radius_px'], 6, 24),
        'panel_radius_px' => catn8_parse_int($tokens['panel_radius_px'] ?? null, $defaults['panel_radius_px'], 8, 28),
        'hover_lift_px' => catn8_parse_int($tokens['hover_lift_px'] ?? null, $defaults['hover_lift_px'], 0, 10),
        'hover_scale_pct' => catn8_parse_int($tokens['hover_scale_pct'] ?? null, $defaults['hover_scale_pct'], 100, 106),
        'surface_alpha_pct' => catn8_parse_int($tokens['surface_alpha_pct'] ?? null, $defaults['surface_alpha_pct'], 86, 100),
        'surface_blur_px' => catn8_parse_int($tokens['surface_blur_px'] ?? null, $defaults['surface_blur_px'], 0, 18),
        'transition_ms' => catn8_parse_int($tokens['transition_ms'] ?? null, $defaults['transition_ms'], 100, 360),
        'focus_ring_color' => catn8_parse_color($tokens['focus_ring_color'] ?? '', $defaults['focus_ring_color']),
        'icon_button_size_px' => catn8_parse_int($tokens['icon_button_size_px'] ?? null, $defaults['icon_button_size_px'], 28, 44),
        'content_max_width_px' => catn8_parse_int($tokens['content_max_width_px'] ?? null, $defaults['content_max_width_px'], 960, 1920),
        'base_font_size_px' => catn8_parse_int($tokens['base_font_size_px'] ?? null, $defaults['base_font_size_px'], 14, 20),
    ];

    catn8_json_response(['success' => true, 'tokens' => $out]);
}

if ($method !== 'POST') {
    catn8_json_response(['success' => false, 'error' => 'Method not allowed'], 405);
}

$body = catn8_read_json_body();

$tokens = [
    'brand_primary' => catn8_parse_color($body['brand_primary'] ?? '', $defaults['brand_primary']),
    'brand_secondary' => catn8_parse_color($body['brand_secondary'] ?? '', $defaults['brand_secondary']),
    'action_fg' => catn8_parse_color($body['action_fg'] ?? '', $defaults['action_fg']),
    'button_radius_px' => catn8_parse_int($body['button_radius_px'] ?? null, $defaults['button_radius_px'], 6, 24),
    'panel_radius_px' => catn8_parse_int($body['panel_radius_px'] ?? null, $defaults['panel_radius_px'], 8, 28),
    'hover_lift_px' => catn8_parse_int($body['hover_lift_px'] ?? null, $defaults['hover_lift_px'], 0, 10),
    'hover_scale_pct' => catn8_parse_int($body['hover_scale_pct'] ?? null, $defaults['hover_scale_pct'], 100, 106),
    'surface_alpha_pct' => catn8_parse_int($body['surface_alpha_pct'] ?? null, $defaults['surface_alpha_pct'], 86, 100),
    'surface_blur_px' => catn8_parse_int($body['surface_blur_px'] ?? null, $defaults['surface_blur_px'], 0, 18),
    'transition_ms' => catn8_parse_int($body['transition_ms'] ?? null, $defaults['transition_ms'], 100, 360),
    'focus_ring_color' => catn8_parse_color($body['focus_ring_color'] ?? '', $defaults['focus_ring_color']),
    'icon_button_size_px' => catn8_parse_int($body['icon_button_size_px'] ?? null, $defaults['icon_button_size_px'], 28, 44),
    'content_max_width_px' => catn8_parse_int($body['content_max_width_px'] ?? null, $defaults['content_max_width_px'], 960, 1920),
    'base_font_size_px' => catn8_parse_int($body['base_font_size_px'] ?? null, $defaults['base_font_size_px'], 14, 20),
];

secret_set($key, json_encode($tokens));

catn8_json_response(['success' => true, 'tokens' => $tokens]);
