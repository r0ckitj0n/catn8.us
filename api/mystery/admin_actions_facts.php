<?php
/**
 * admin_actions_facts.php - Conductor for Cold Hard Facts Admin Actions
 * VERSION: 2025-12-31-0510-FINAL
 */
declare(strict_types=1);

require_once __DIR__ . '/admin_functions.php';

if ($action === 'get_scenario_cold_hard_facts') {
    require __DIR__ . '/admin_actions_facts_get.php';
}
if ($action === 'update_scenario_cold_hard_facts') {
    require __DIR__ . '/admin_actions_facts_update.php';
}
if ($action === 'audit_scenario_cold_hard_facts') {
    require __DIR__ . '/admin_actions_facts_audit.php';
}
