<?php
/**
 * admin_actions_cleanup.php - Conductor for Mystery Cleanup Admin Actions
 * COMPLIANCE: File size < 300 lines
 */

declare(strict_types=1);

require_once __DIR__ . '/admin_functions.php';

if ($action === 'cleanup_case_character_master_only_fields') {
    require_once __DIR__ . '/admin_actions_cleanup_case.php';
    exit;
}

if ($action === 'cleanup_master_only_fields_for_mystery') {
    require_once __DIR__ . '/admin_actions_cleanup_mystery.php';
    exit;
}

if ($action === 'link_case_characters_to_master') {
    require_once __DIR__ . '/admin_actions_cleanup_link.php';
    exit;
}

if ($action === 'import_case_character_details_to_master') {
    require_once __DIR__ . '/admin_actions_cleanup_import.php';
    exit;
}

if ($action === 'link_and_import_case_character_details_for_mystery') {
    // This was another large block, let's move it to its own file too
    require_once __DIR__ . '/admin_actions_cleanup_mystery_link_import.php';
    exit;
}
