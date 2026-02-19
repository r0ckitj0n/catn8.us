<?php

declare(strict_types=1);

/**
 * Mystery Admin API Dispatcher
 * Refactored to comply with .windsurfrules (File Size < 300 lines)
 */

require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../../includes/google_cloud_tts.php';
require_once __DIR__ . '/../../includes/vertex_ai_gemini.php';
require_once __DIR__ . '/admin_functions.php';

catn8_session_start();

$action = trim((string)($_GET['action'] ?? ''));
$viewerId = catn8_auth_user_id();

// Some actions are allowed for mystery game users even if not full admins
$isMysteryUser = catn8_user_in_group($viewerId, 'mystery-game-users');
$isAdmin = catn8_user_is_admin($viewerId);

$safeActions = [
    'list_weapons',
    'list_motives',
    'list_locations',
    'list_master_assets',
    'list_master_characters',
    'list_master_locations',
    'list_master_weapons',
    'list_master_motives',
    'list_agent_images',
];

if (!$isAdmin && !($isMysteryUser && in_array($action, $safeActions))) {
    catn8_require_admin();
}

try {
    // Ensure tables/schema
    catn8_users_table_ensure();
    catn8_mystery_tables_ensure();

    // Closure helpers for actions
    $requireMystery = static function (int $mysteryId) use ($viewerId, $isAdmin): array {
        return catn8_mystery_require_mystery($mysteryId, $viewerId, $isAdmin);
    };
    $requireCase = static function (int $caseId) use ($viewerId, $isAdmin): array {
        return catn8_mystery_require_case($caseId, $viewerId, $isAdmin);
    };
    $requireScenario = static function (int $scenarioId) use ($viewerId, $isAdmin): array {
        return catn8_mystery_require_scenario($scenarioId, $viewerId, $isAdmin);
    };

    // Route actions to modular files
    $action_map = [
        'list_weapons' => 'weapons',
        'import_master_weapons_to_global' => 'weapons',
        'save_weapon' => 'weapons',
        'upload_weapon_image' => 'weapons',
        'delete_weapon_image' => 'weapons',
        'generate_weapon' => 'weapons',
        'delete_weapon' => 'weapons',
        
        'list_motives' => 'motives',
        'import_master_motives_to_global' => 'motives',
        'save_motive' => 'motives',
        'delete_motive' => 'motives',
        'generate_motive' => 'motives',
        'upload_motive_image' => 'motives',
        'delete_motive_image' => 'motives',
        
        'list_instructions' => 'instructions',
        'save_instruction' => 'instructions',
        'delete_instruction' => 'instructions',
        'get_instruction' => 'instructions',
        'list_mystery_instructions' => 'instructions',
        
        'get_scenario_cold_hard_facts' => 'facts',
        'save_scenario_cold_hard_facts' => 'facts',
        'fix_scenario_cold_hard_facts_annotations' => 'facts',
        
        'cleanup_case_character_master_only_fields' => 'cleanup',
        'cleanup_case_character_master_only_fields_dry_run' => 'cleanup',
        'cleanup_case_character_master_only_fields_execute' => 'cleanup',
        'cleanup_case_location_master_only_fields' => 'cleanup',
        'cleanup_case_weapon_master_only_fields' => 'cleanup',
        'cleanup_case_motive_master_only_fields' => 'cleanup',
        
        'list_scenarios' => 'scenarios',
        'save_scenario' => 'scenarios',
        'delete_scenario' => 'scenarios',
        'get_scenario' => 'scenarios',
        'generate_scenario_csi_report' => 'scenarios',
        'save_scenario_csi_report' => 'scenarios',
        
        'list_entities' => 'entities',
        'create_entity' => 'entities',
        'update_entity' => 'entities',
        'bulk_update_entity_accent_preference' => 'entities',
        'delete_entity' => 'entities',
        'get_entity' => 'entities',
        'list_scenario_entities' => 'entities',
        'check_scenario_regen_needed' => 'entities',
        'attach_entity_to_scenario' => 'entities',
        'update_scenario_entity' => 'entities',
        'detach_entity_from_scenario' => 'entities',
        
        'list_case_notes' => 'case_notes',
        'save_case_note' => 'case_notes',
        'delete_case_note' => 'case_notes',
        
        'list_lies' => 'lies',
        'save_lie' => 'lies',
        'delete_lie' => 'lies',
        
        'list_images' => 'images',
        'list_agent_images' => 'images',
        'upload_image' => 'images',
        'delete_image' => 'images',
        
        'list_locks' => 'locks',
        'save_lock' => 'locks',
        'delete_lock' => 'locks',
        
        'list_jobs' => 'jobs',
        'save_job' => 'jobs',
        'delete_job' => 'jobs',
        
        'list_master_assets' => 'master_assets',
        'list_master_characters' => 'master_assets',
        'list_master_locations' => 'master_assets',
        'list_master_weapons' => 'master_assets',
        'list_master_motives' => 'master_assets',
        'save_master_asset' => 'master_assets',
        'delete_master_asset' => 'master_assets',
        'generate_master_asset_content' => 'master_assets',
        'clear_master_asset_fields' => 'master_assets',
        'upsert_master_character' => 'master_assets',
        'upsert_master_location' => 'master_assets',
        'upsert_master_weapon' => 'master_assets',
        'upsert_master_motive' => 'master_assets',
        'get_master_character_profile_json' => 'master_assets',
        'get_master_location_profile_json' => 'master_assets',
        'get_master_weapon_profile_json' => 'master_assets',
        'get_master_motive_profile_json' => 'master_assets',
        'generate_master_character_images' => 'master_assets',
        'upload_master_character_image' => 'master_assets',
        'delete_master_character_image' => 'master_assets',
        'upload_master_asset_image' => 'master_assets',
        'generate_master_asset_image' => 'master_assets',
        'delete_master_asset_image' => 'master_assets',
        'set_master_regen_lock' => 'master_assets',
        'check_master_assets_maintenance_needed' => 'master_assets',
        'backfill_master_asset_columns_from_json' => 'master_assets',
        'cleanup_master_only_fields_for_mystery' => 'master_assets',
        'link_and_import_case_character_details_for_mystery' => 'master_assets',
        'archive_master_character' => 'master_assets',
        'archive_master_location' => 'master_assets',
        'archive_master_weapon' => 'master_assets',
        'archive_master_motive' => 'master_assets',
        'delete_master_character' => 'master_assets',
        'delete_master_location' => 'master_assets',
        'delete_master_weapon' => 'master_assets',
        'delete_master_motive' => 'master_assets',
        'get_master_character_image_prompt_json' => 'master_assets',
        
        'list_locations' => 'locations',
        'save_location' => 'locations',
        'delete_location' => 'locations',
        'generate_location' => 'locations',
        'generate_location_photo' => 'locations',
        'upload_location_image' => 'locations',
        'delete_location_image' => 'locations',
        'import_master_locations_to_global' => 'locations',
        
        'list_mysteries' => 'mysteries',
        'save_mystery' => 'mysteries',
        'delete_mystery' => 'mysteries',
        'get_mystery' => 'mysteries',
        
        'get_mystery_settings' => 'settings',
        'save_mystery_settings' => 'settings',
        'list_tts_voices' => 'settings',
        'list_agent_profiles' => 'settings',
        'save_case_details' => 'settings',
        'save_scenario_briefing' => 'settings',
        'save_csi_report' => 'settings',
        
        'save_backstory_details' => 'backstories',
        'save_backstory_full' => 'backstories',
        'spawn_case_from_backstory' => 'backstories',
        'generate_backstory' => 'backstories',
        'toggle_backstory_archived' => 'backstories'
    ];

    if (isset($action_map[$action])) {
        $file = __DIR__ . '/admin_actions_' . $action_map[$action] . '.php';
        if (file_exists($file)) {
            require_once $file;
            exit;
        }
    }

    // Default response if action not handled
    if ($action !== '') {
        catn8_json_response(['success' => false, 'error' => "Unknown action: $action"], 400);
    }

    catn8_json_response(['success' => false, 'error' => 'No action specified'], 400);

} catch (Throwable $e) {
    error_log(sprintf(
        "[%s] Admin API Error: %s in %s:%d\nStack trace:\n%s",
        date('Y-m-d H:i:s'),
        $e->getMessage(),
        $e->getFile(),
        $e->getLine(),
        $e->getTraceAsString()
    ), 3, __DIR__ . '/../../logs/admin_api_error.log');

    catn8_json_response([
        'success' => false, 
        'error' => 'Admin API Error: ' . $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ], 500);
}
