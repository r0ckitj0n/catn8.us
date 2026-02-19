<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

catn8_session_start();

$defaults = [
    'brand_primary' => '#9b59b6',
    'brand_secondary' => '#2ecc71',
    'action_fg' => '#ffffff',
];

$raw = secret_get(catn8_secret_key('appearance.tokens'));
$tokens = [];
if (is_string($raw) && $raw !== '') {
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
        $tokens = $decoded;
    }
}

$brandPrimary = (string)($tokens['brand_primary'] ?? $defaults['brand_primary']);
$brandSecondary = (string)($tokens['brand_secondary'] ?? $defaults['brand_secondary']);
$actionFg = (string)($tokens['action_fg'] ?? $defaults['action_fg']);

header('Content-Type: text/css; charset=UTF-8');

echo ":root{\n";

echo "  --catn8-brand-primary: {$brandPrimary};\n";
echo "  --catn8-brand-secondary: {$brandSecondary};\n";
echo "  --catn8-action-bg: var(--catn8-brand-primary);\n";
echo "  --catn8-action-border: var(--catn8-brand-primary);\n";
echo "  --catn8-action-bg-active: var(--catn8-brand-secondary);\n";
echo "  --catn8-action-border-active: var(--catn8-brand-secondary);\n";
echo "  --catn8-action-fg: {$actionFg};\n";

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
