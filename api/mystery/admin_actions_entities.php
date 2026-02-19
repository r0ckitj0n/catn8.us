<?php
/**
 * admin_actions_entities.php - Conductor for Entity Admin Actions
 * VERSION: 2025-12-31-0510-FINAL
 */
declare(strict_types=1);

require_once __DIR__ . '/admin_functions.php';

if ($action === 'list_entities' || $action === 'list_scenario_entities') {
    require __DIR__ . '/admin_actions_entities_list.php';
}
if ($action === 'get_entity') {
    require __DIR__ . '/admin_actions_entities_get.php';
}
if (in_array($action, ['create_entity', 'update_entity', 'bulk_update_entity_accent_preference', 'delete_entity'])) {
    require __DIR__ . '/admin_actions_entities_save.php';
}
if (in_array($action, ['check_scenario_regen_needed', 'attach_entity_to_scenario', 'update_scenario_entity', 'detach_entity_from_scenario'])) {
    require __DIR__ . '/admin_actions_entities_scenario.php';
}
