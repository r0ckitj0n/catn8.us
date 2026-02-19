<?php

// Force local environment for this migration script to ensure we connect to the correct DB
$_SERVER['WHF_ENV'] = 'local';
putenv('WHF_ENV=local');

require_once __DIR__ . '/../../api/config.php';
if (!is_file(__DIR__ . '/../../includes/branding_tokens_helper.php')) {
    fwrite(STDERR, "Missing includes/branding_tokens_helper.php\n");
    exit(1);
}
require_once __DIR__ . '/../../includes/branding_tokens_helper.php';

// Use api/config.php + Database helpers for local DB connection

// Ensure we're running as admin/CLI
if (php_sapi_name() !== 'cli' && !isset($_GET['run'])) {
    die("This script must be run from CLI or with ?run=1 parameter.");
}

echo "Starting Branding Token Migration and Cleanup...\n";

try {
    // 1. Define the keys we want to migrate/clean
    $keysToMigrate = [
        'business_brand_primary',
        'business_brand_secondary',
        'business_brand_accent',
        'business_brand_background',
        'business_brand_text',
        'business_toast_text',
        'business_brand_font_primary',
        'business_brand_font_secondary',
        'business_public_header_bg',
        'business_public_header_text',
        'business_public_modal_bg',
        'business_public_modal_text',
        'business_public_page_bg',
        'business_public_page_text',
        'business_button_primary_bg',
        'business_button_primary_hover',
        'business_button_secondary_bg',
        'business_button_secondary_hover',
        'business_button_primary_text',
        'business_button_secondary_text',
        'business_admin_modal_radius',
        'business_admin_modal_body_padding',
        'business_admin_modal_shadow',
        'business_brand_palette',
        'business_css_vars',
        'brand_backup',
        'brand_backup_saved_at',
        // Also include some potential icon button keys if they ended up there
        'business_icon_button_bg',
        'business_icon_button_hover'
    ];

    // 2. Get current tokens from the new system (wf_brand_tokens)
    // We use getRawTokens/getTokens to get the current JSON state.
    // Note: getTokens() might fallback to defaults or legacy, so we should query the DB directly 
    // to see what is ACTUALLY saved in the tokens table to avoid false positives.
    
    $tokenRow = Database::queryOne("SELECT id, tokens FROM wf_brand_tokens ORDER BY id ASC LIMIT 1");
    $currentTokens = [];
    if ($tokenRow && isset($tokenRow['tokens'])) {
        $currentTokens = json_decode($tokenRow['tokens'], true) ?? [];
    }
    echo "Loaded " . count($currentTokens) . " existing tokens from wf_brand_tokens.\n";

    // 3. Fetch legacy values from business_settings
    $placeholders = implode(',', array_fill(0, count($keysToMigrate), '?'));
    $sql = "SELECT setting_key, setting_value FROM business_settings WHERE setting_key IN ($placeholders)";
    $rows = Database::queryAll($sql, $keysToMigrate);
    
    echo "Found " . count($rows) . " legacy branding rows in business_settings.\n";

    $updates = [];
    $keysToDelete = [];

    foreach ($rows as $row) {
        $key = $row['setting_key'];
        $val = $row['setting_value'];
        $keysToDelete[] = $key; // We will delete all found legacy rows

        // Check if we need to migrate this value to tokens
        // Rule: Only if the key is missing or empty in currentTokens
        if (!isset($currentTokens[$key]) || trim((string)$currentTokens[$key]) === '') {
            if (trim((string)$val) !== '') {
                $updates[$key] = $val;
                echo "Migrating: $key => " . substr($val, 0, 20) . "...\n";
            }
        }
    }

    // 4. Save updates to wf_brand_tokens
    if (!empty($updates)) {
        $merged = array_merge($currentTokens, $updates);
        BrandingTokens::saveTokens($merged, 'migration_script');
        echo "Saved " . count($updates) . " new keys to wf_brand_tokens.\n";
    } else {
        echo "No new data to migrate to tokens (token table was already up to date).\n";
    }

    // 5. Delete from business_settings
    if (!empty($keysToDelete)) {
        $deletePlaceholders = implode(',', array_fill(0, count($keysToDelete), '?'));
        $deleteSql = "DELETE FROM business_settings WHERE setting_key IN ($deletePlaceholders)";
        Database::execute($deleteSql, $keysToDelete);
        echo "Deleted " . count($keysToDelete) . " legacy rows from business_settings.\n";
    } else {
        echo "No legacy rows found to delete.\n";
    }

    echo "Migration and cleanup complete.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
