<?php
/**
 * admin_actions_locations.php - Conductor for Mystery Location Admin Actions
 * COMPLIANCE: File size < 300 lines
 */

declare(strict_types=1);

require_once __DIR__ . '/admin_functions.php';

if ($action === 'list_locations') {
    require_once __DIR__ . '/admin_actions_locations_list.php';
    exit;
}

if ($action === 'save_location' || $action === 'delete_location') {
    require_once __DIR__ . '/admin_actions_locations_save.php';
    exit;
}

if ($action === 'upload_location_image' || $action === 'delete_location_image') {
    require_once __DIR__ . '/admin_actions_locations_images.php';
    exit;
}

if ($action === 'generate_location_photo' || $action === 'generate_location_photo_from_address') {
    require_once __DIR__ . '/admin_actions_locations_gen_photo.php';
    exit;
}

if ($action === 'generate_location') {
    require_once __DIR__ . '/admin_actions_locations_gen_details.php';
    exit;
}

if ($action === 'import_master_locations_to_global') {
    // This was a large block, let's move it to its own file too
    require_once __DIR__ . '/admin_actions_locations_import.php';
    exit;
}
