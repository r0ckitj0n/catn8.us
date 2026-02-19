<?php
/**
 * api/mystery/diag.php - Comprehensive diagnostic for AI function availability
 * VERSION: 2025-12-31-0540-FINAL
 */
declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '1');

$diag = [
    'time' => date('Y-m-d H:i:s'),
    'php_version' => PHP_VERSION,
    'php_sapi' => PHP_SAPI,
    'script' => $_SERVER['SCRIPT_FILENAME'] ?? 'unknown',
    'cwd' => getcwd(),
    'opcache_enabled' => function_exists('opcache_get_status') ? (opcache_get_status(false) !== false) : false,
    'opcache_reset_success' => function_exists('opcache_reset') ? opcache_reset() : 'not available',
];

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/admin_functions.php';

$funcs = [
    'catn8_mystery_get_ai_config',
    'catn8_mystery_ai_secret_key',
    'catn8_mystery_ai_generate_text',
    'catn8_ai_chat_json',
    'catn8_mystery_extract_json_from_text',
    'catn8_mystery_unique_slug'
];

$status = [];
foreach ($funcs as $f) {
    $status[$f] = function_exists($f) ? 'EXISTS' : 'MISSING';
}
$diag['functions'] = $status;

$diag['classes'] = [
    'OpenAI' => class_exists('OpenAI') ? 'EXISTS' : 'MISSING',
    'Database' => class_exists('Database') ? 'EXISTS' : 'MISSING',
];

$file_info = [];
$check_files = [
    'admin_functions.php',
    'admin_functions_ai.php',
    'admin_functions_master_assets_gen.php',
    'admin_actions_locations_gen_details.php',
    'admin_actions_motives_generate.php',
    'admin_actions_weapons_generate.php',
    'admin_actions_backstories.php',
    'admin_actions_master_assets_generate.php'
];

foreach ($check_files as $f) {
    $path = __DIR__ . '/' . $f;
    if (file_exists($path)) {
        $content = file_get_contents($path);
        preg_match('/VERSION:\s*([^\n\*\/]+)/i', $content, $m);
        $file_info[$f] = [
            'exists' => true,
            'version' => isset($m[1]) ? trim($m[1]) : 'UNKNOWN',
            'mtime' => date('Y-m-d H:i:s', filemtime($path)),
            'size' => filesize($path)
        ];
    } else {
        $file_info[$f] = ['exists' => false];
    }
}
$diag['file_versions'] = $file_info;
$diag['included_files_count'] = count(get_included_files());
$diag['included_files'] = array_values(array_unique(get_included_files()));

header('Content-Type: application/json');
echo json_encode($diag, JSON_PRETTY_PRINT);
