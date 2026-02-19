<?php
if ($action === 'upsert_master_weapon') {
    catn8_json_response(['success' => false, 'error' => 'Deprecated: weapons are global now. Use save_weapon/list_weapons.'], 410);
}

if ($action === 'archive_master_weapon') {
    catn8_json_response(['success' => false, 'error' => 'Deprecated: weapons are global now. Use save_weapon/list_weapons.'], 410);
}

if ($action === 'delete_master_weapon') {
    catn8_json_response(['success' => false, 'error' => 'Deprecated: weapons are global now. Use delete_weapon/list_weapons.'], 410);
}

if ($action === 'get_master_weapon_profile_json') {
    catn8_json_response(['success' => false, 'error' => 'Deprecated: weapons are global now.'], 410);
}

if ($action === 'get_master_motive_profile_json') {
    catn8_json_response(['success' => false, 'error' => 'Deprecated: motives are global now.'], 410);
}

if ($action === 'upsert_master_motive') {
    catn8_json_response(['success' => false, 'error' => 'Deprecated: motives are global now. Use save_motive/list_motives.'], 410);
}

if ($action === 'archive_master_motive') {
    catn8_json_response(['success' => false, 'error' => 'Deprecated: motives are global now. Use save_motive/list_motives.'], 410);
}

if ($action === 'delete_master_motive') {
    catn8_json_response(['success' => false, 'error' => 'Deprecated: motives are global now. Use delete_motive/list_motives.'], 410);
}

if ($action === 'list_master_weapons') {
    catn8_json_response(['success' => false, 'error' => 'Deprecated: weapons are global now. Use list_weapons.'], 410);
}

if ($action === 'list_master_motives') {
    catn8_json_response(['success' => false, 'error' => 'Deprecated: motives are global now. Use list_motives.'], 410);
}

