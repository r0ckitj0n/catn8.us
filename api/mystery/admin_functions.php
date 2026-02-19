<?php
/**
 * admin_functions.php - Conductor for Mystery Admin Functions
 * VERSION: 2025-12-31-0510-FINAL
 */
declare(strict_types=1);

if (!defined('CATN8_ADMIN_FUNCTIONS_VERSION')) {
    define('CATN8_ADMIN_FUNCTIONS_VERSION', '2025-12-31-0510-FINAL');
}

error_log("TRACE: admin_functions.php starting load (v" . CATN8_ADMIN_FUNCTIONS_VERSION . ")");

$files = [
    'shared_functions.php',
    'admin_functions_helpers.php',
    'admin_functions_images.php',
    'admin_functions_master_assets.php',
    'admin_functions_schema.php',
    'admin_functions_validation.php',
    'admin_functions_text.php',
    'admin_functions_story_book.php',
    'admin_functions_collection.php',
    'admin_functions_facts.php',
    'admin_functions_master_assets_gen.php',
    'admin_functions_vertex_ai.php',
    'admin_functions_ai.php',
    'admin_functions_csi.php',
    'admin_functions_locations.php',
    'admin_functions_motives.php',
    'admin_functions_weapons.php'
];

foreach ($files as $f) {
    $path = __DIR__ . '/' . $f;
    if (!file_exists($path)) {
        error_log("TRACE ERROR: File not found: $path");
        continue;
    }
    require_once $path;
    error_log("TRACE: Loaded $f");
}

error_log("TRACE: admin_functions.php load complete. catn8_mystery_ai_generate_text=" . (function_exists('catn8_mystery_ai_generate_text') ? 'EXISTS' : 'MISSING'));
