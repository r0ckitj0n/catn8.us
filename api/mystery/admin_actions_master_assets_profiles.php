<?php
/**
 * admin_actions_master_assets_profiles.php - Generating profile JSON for master assets
 */
declare(strict_types=1);

if (str_ends_with($action, '_profile_json')) {
    $mysteryId = (int)($_GET['mystery_id'] ?? 0);
    $requireMystery($mysteryId);
    $id = (int)($_GET['id'] ?? 0);
    
    $profile = [];
    if ($action === 'get_master_character_profile_json') {
        $profile = catn8_mystery_master_character_build_derived_json($mysteryId, $id, true);
    } elseif ($action === 'get_master_location_profile_json') {
        $profile = catn8_mystery_master_location_build_derived_json($mysteryId, $id, true);
    } elseif ($action === 'get_master_weapon_profile_json') {
        $profile = catn8_mystery_master_weapon_build_derived_json($mysteryId, $id, true);
    } elseif ($action === 'get_master_motive_profile_json') {
        $profile = catn8_mystery_master_motive_build_derived_json($mysteryId, $id, true);
    }
    
    if (empty($profile)) {
        catn8_json_response(['success' => false, 'error' => 'Asset not found or empty profile'], 404);
    }
    
    catn8_json_response(['success' => true, 'profile_json' => $profile]);
}
