<?php
/**
 * admin_actions_master_assets.php - Conductor for Master Asset Admin Actions
 * VERSION: 2025-12-31-0510-FINAL
 */
declare(strict_types=1);

require_once __DIR__ . '/admin_functions.php';

if ($action === 'list_master_characters' || $action === 'list_master_locations' || $action === 'list_master_weapons' || $action === 'list_master_motives') {
    require __DIR__ . '/admin_actions_master_assets_list.php';
    exit;
}

if ($action === 'generate_master_asset_content') {
    require __DIR__ . '/admin_actions_master_assets_generate.php';
    exit;
}

if ($action === 'clear_master_asset_fields') {
    require __DIR__ . '/admin_actions_master_assets_clear.php';
    exit;
}

if (str_starts_with($action, 'upsert_master_')) {
    require __DIR__ . '/admin_actions_master_assets_upsert.php';
    exit;
}

if (str_ends_with($action, '_profile_json')) {
    require __DIR__ . '/admin_actions_master_assets_profiles.php';
    exit;
}

if (str_contains($action, '_master_character_image') || str_contains($action, '_master_asset_image') || $action === 'generate_master_character_images') {
    require __DIR__ . '/admin_actions_master_assets_images.php';
    exit;
}

if (str_contains($action, '_master_only_fields') || str_contains($action, 'link_and_import') || str_starts_with($action, 'archive_master_')) {
    require __DIR__ . '/admin_actions_master_assets_maintenance.php';
    exit;
}

if ($action === 'check_master_assets_maintenance_needed') {
    require __DIR__ . '/admin_actions_master_assets_check.php';
    exit;
}
