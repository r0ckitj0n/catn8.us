<?php
require_once __DIR__ . '/admin_functions.php';
require_once __DIR__ . '/admin_functions_motives.php';

if ($action === 'list_motives') {
    require __DIR__ . '/admin_actions_motives_list.php';
}
if ($action === 'import_master_motives_to_global') {
    require __DIR__ . '/admin_actions_motives_import.php';
}
if ($action === 'save_motive') {
    require __DIR__ . '/admin_actions_motives_save.php';
}
if (in_array($action, ['upload_motive_image', 'delete_motive_image'])) {
    require __DIR__ . '/admin_actions_motives_images.php';
}
if ($action === 'generate_motive') {
    require __DIR__ . '/admin_actions_motives_generate.php';
}
if ($action === 'delete_motive') {
    require __DIR__ . '/admin_actions_motives_delete.php';
}
