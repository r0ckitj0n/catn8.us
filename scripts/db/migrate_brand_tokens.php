<?php
declare(strict_types=1);

// Migration script: seed wf_brand_tokens from existing business_settings values.
// Usage (dry-run default):   /scripts/db/migrate_brand_tokens.php
// Execute for real:          /scripts/db/migrate_brand_tokens.php?confirm=1&dry_run=0

error_reporting(E_ALL);
ini_set('display_errors', '1');
header('Content-Type: text/plain');

require_once __DIR__ . '/../../api/config.php';
require_once __DIR__ . '/../../api/business_settings_helper.php';
require_once __DIR__ . '/../../includes/branding_tokens_helper.php';

try {
    Database::getInstance();
} catch (Throwable $e) {
    http_response_code(500);
    echo "DB connect failed: {$e->getMessage()}\n";
    exit;
}

$confirm = isset($_GET['confirm']) ? (int) $_GET['confirm'] : 0;
$dryRun  = isset($_GET['dry_run']) ? (int) $_GET['dry_run'] : 1; // default dry run

$existingTokens = BrandingTokens::getTokens();

function gatherLegacyTokens(array $existing): array
{
    $tokens = [];
    foreach (array_keys($existing) as $key) {
        $tokens[$key] = BusinessSettings::get($key, $existing[$key] ?? null);
    }
    $paletteRaw = $tokens['business_brand_palette'] ?? '[]';
    $decoded = json_decode((string) $paletteRaw, true);
    if (is_array($decoded)) {
        $tokens['business_brand_palette'] = $decoded;
    }
    return $tokens;
}

$legacy = gatherLegacyTokens($existingTokens);

echo "Brand Tokens Migration (dry_run=" . ($dryRun ? '1' : '0') . ", confirm={$confirm})\n";
foreach ($legacy as $key => $value) {
    if ($key === 'business_brand_palette' && is_array($value)) {
        echo str_pad($key, 32) . ' => ' . json_encode($value) . "\n";
        continue;
    }
    echo str_pad($key, 32) . ' => ' . var_export($value, true) . "\n";
}

echo "\n";

if ($dryRun) {
    echo "-- DRY RUN -- No changes applied. Pass ?confirm=1&dry_run=0 to commit.\n";
    exit;
}

if (!$confirm) {
    echo "Refusing to run without &confirm=1 when dry_run=0.\n";
    exit;
}

$tokensToSave = $legacy;
if (isset($tokensToSave['business_brand_palette']) && is_array($tokensToSave['business_brand_palette'])) {
    $tokensToSave['business_brand_palette'] = BrandingTokens::encodePaletteArray($tokensToSave['business_brand_palette']);
}

try {
    BrandingTokens::saveTokens($tokensToSave, 'brand-migration');
    echo "Saved tokens to wf_brand_tokens.\n";
} catch (Throwable $e) {
    echo "Error saving tokens: {$e->getMessage()}\n";
    exit(1);
}

echo "Done.\n";
