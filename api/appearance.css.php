<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

catn8_session_start();

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

$raw = secret_get(catn8_secret_key('appearance.tokens'));
$tokens = [];
if (is_string($raw) && $raw !== '') {
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
        $tokens = $decoded;
    }
}

function catn8_parse_color($value, string $fallback): string
{
    $rawColor = strtolower(trim((string)$value));
    if (!preg_match('/^#[0-9a-f]{6}$/', $rawColor)) return $fallback;
    return $rawColor;
}

function catn8_parse_int($value, int $fallback, int $min, int $max): int
{
    if (!is_numeric($value)) return $fallback;
    $n = (int)round((float)$value);
    if ($n < $min) return $min;
    if ($n > $max) return $max;
    return $n;
}

$brandPrimary = catn8_parse_color($tokens['brand_primary'] ?? '', $defaults['brand_primary']);
$brandSecondary = catn8_parse_color($tokens['brand_secondary'] ?? '', $defaults['brand_secondary']);
$actionFg = catn8_parse_color($tokens['action_fg'] ?? '', $defaults['action_fg']);
$buttonRadiusPx = catn8_parse_int($tokens['button_radius_px'] ?? null, $defaults['button_radius_px'], 6, 24);
$panelRadiusPx = catn8_parse_int($tokens['panel_radius_px'] ?? null, $defaults['panel_radius_px'], 8, 28);
$hoverLiftPx = catn8_parse_int($tokens['hover_lift_px'] ?? null, $defaults['hover_lift_px'], 0, 10);
$hoverScalePct = catn8_parse_int($tokens['hover_scale_pct'] ?? null, $defaults['hover_scale_pct'], 100, 106);
$surfaceAlphaPct = catn8_parse_int($tokens['surface_alpha_pct'] ?? null, $defaults['surface_alpha_pct'], 86, 100);
$surfaceBlurPx = catn8_parse_int($tokens['surface_blur_px'] ?? null, $defaults['surface_blur_px'], 0, 18);
$transitionMs = catn8_parse_int($tokens['transition_ms'] ?? null, $defaults['transition_ms'], 100, 360);
$focusRingColor = catn8_parse_color($tokens['focus_ring_color'] ?? '', $defaults['focus_ring_color']);
$iconButtonSizePx = catn8_parse_int($tokens['icon_button_size_px'] ?? null, $defaults['icon_button_size_px'], 28, 44);
$contentMaxWidthPx = catn8_parse_int($tokens['content_max_width_px'] ?? null, $defaults['content_max_width_px'], 960, 1920);
$baseFontSizePx = catn8_parse_int($tokens['base_font_size_px'] ?? null, $defaults['base_font_size_px'], 14, 20);
$hoverScale = number_format($hoverScalePct / 100, 2, '.', '');
$surfaceAlpha = number_format($surfaceAlphaPct / 100, 2, '.', '');

header('Content-Type: text/css; charset=UTF-8');

echo ":root{\n";

echo "  --catn8-brand-primary: {$brandPrimary};\n";
echo "  --catn8-brand-secondary: {$brandSecondary};\n";
echo "  --catn8-action-bg: var(--catn8-brand-primary);\n";
echo "  --catn8-action-border: var(--catn8-brand-primary);\n";
echo "  --catn8-action-bg-active: var(--catn8-brand-secondary);\n";
echo "  --catn8-action-border-active: var(--catn8-brand-secondary);\n";
echo "  --catn8-action-fg: {$actionFg};\n";
echo "  --catn8-global-button-radius: {$buttonRadiusPx}px;\n";
echo "  --catn8-global-panel-radius: {$panelRadiusPx}px;\n";
echo "  --catn8-global-hover-lift: {$hoverLiftPx}px;\n";
echo "  --catn8-global-hover-scale: {$hoverScale};\n";
echo "  --catn8-global-surface-alpha: {$surfaceAlpha};\n";
echo "  --catn8-global-surface-blur: {$surfaceBlurPx}px;\n";
echo "  --catn8-global-transition-ms: {$transitionMs}ms;\n";
echo "  --catn8-global-focus-ring: {$focusRingColor};\n";
echo "  --catn8-global-icon-button-size: {$iconButtonSizePx}px;\n";
echo "  --catn8-global-content-max-width: {$contentMaxWidthPx}px;\n";
echo "  --catn8-global-base-font-size: {$baseFontSizePx}px;\n";

echo "  --bs-primary: var(--catn8-brand-primary);\n";
echo "  --bs-secondary: var(--catn8-brand-secondary);\n";

echo "}\n";

echo ".btn-primary{\n";
echo "  --bs-btn-bg: var(--catn8-brand-primary);\n";
echo "  --bs-btn-border-color: var(--catn8-brand-primary);\n";
echo "  --bs-btn-hover-bg: var(--catn8-brand-secondary);\n";
echo "  --bs-btn-hover-border-color: var(--catn8-brand-secondary);\n";
echo "  --bs-btn-active-bg: var(--catn8-brand-secondary);\n";
echo "  --bs-btn-active-border-color: var(--catn8-brand-secondary);\n";
echo "  --bs-btn-color: var(--catn8-action-fg);\n";
echo "  --bs-btn-hover-color: var(--catn8-action-fg);\n";
echo "  --bs-btn-active-color: var(--catn8-action-fg);\n";
echo "}\n";

echo ".btn-secondary{\n";
echo "  --bs-btn-bg: var(--catn8-brand-secondary);\n";
echo "  --bs-btn-border-color: var(--catn8-brand-secondary);\n";
echo "  --bs-btn-hover-bg: var(--catn8-brand-primary);\n";
echo "  --bs-btn-hover-border-color: var(--catn8-brand-primary);\n";
echo "  --bs-btn-active-bg: var(--catn8-brand-primary);\n";
echo "  --bs-btn-active-border-color: var(--catn8-brand-primary);\n";
echo "  --bs-btn-color: var(--catn8-action-fg);\n";
echo "  --bs-btn-hover-color: var(--catn8-action-fg);\n";
echo "  --bs-btn-active-color: var(--catn8-action-fg);\n";
echo "}\n";
