<?php
require_once __DIR__ . '/admin_functions.php';
require_once __DIR__ . '/admin_functions_weapons.php';

if ($action === 'list_weapons') {
    require __DIR__ . '/admin_actions_weapons_list.php';
}
if ($action === 'import_master_weapons_to_global') {
    require __DIR__ . '/admin_actions_weapons_import.php';
}
if ($action === 'save_weapon') {
    require __DIR__ . '/admin_actions_weapons_save.php';
}
if (in_array($action, ['upload_weapon_image', 'delete_weapon_image'])) {
    require __DIR__ . '/admin_actions_weapons_images.php';
}
if ($action === 'generate_weapon') {
    require __DIR__ . '/admin_actions_weapons_generate.php';
}
if ($action === 'delete_weapon') {
    require __DIR__ . '/admin_actions_weapons_delete.php';
}

