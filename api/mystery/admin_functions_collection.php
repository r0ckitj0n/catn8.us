<?php
declare(strict_types=1);

function catn8_mystery_collect_referenced_master_ids(int $mysteryId): array {
    $mid = (int)$mysteryId;
    $res = [
        'characters' => [],
        'locations' => [],
        'weapons' => [],
        'motives' => []
    ];
    
    $rows = Database::queryAll('SELECT master_character_id FROM mystery_entities WHERE mystery_id = ? AND master_character_id IS NOT NULL', [$mid]);
    $res['characters'] = array_unique(array_column($rows, 'master_character_id'));
    
    $rows = Database::queryAll('SELECT master_location_id FROM mystery_scenarios WHERE mystery_id = ? AND master_location_id IS NOT NULL', [$mid]);
    $res['locations'] = array_unique(array_column($rows, 'master_location_id'));
    
    return $res;
}

function catn8_mystery_collect_locked_weapon_ids(): array {
    $rows = Database::queryAll('SELECT DISTINCT crime_scene_weapon_id FROM mystery_scenarios WHERE crime_scene_weapon_id IS NOT NULL');
    return array_column($rows, 'crime_scene_weapon_id');
}

function catn8_mystery_collect_locked_motive_ids(): array {
    $rows = Database::queryAll('SELECT DISTINCT crime_scene_motive_id FROM mystery_scenarios WHERE crime_scene_motive_id IS NOT NULL');
    return array_column($rows, 'crime_scene_motive_id');
}

function catn8_mystery_collect_locked_location_ids(): array {
    $rows = Database::queryAll('SELECT DISTINCT crime_scene_location_id FROM mystery_scenarios WHERE crime_scene_location_id IS NOT NULL');
    return array_column($rows, 'crime_scene_location_id');
}

function catn8_mystery_collect_ongoing_master_ids(int $mysteryId): array {
    return catn8_mystery_collect_referenced_master_ids($mysteryId);
}
