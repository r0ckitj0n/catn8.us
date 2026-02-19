<?php
if ($action === 'delete_weapon') {
    catn8_mystery_require_admin($isAdmin);
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);

    $lockedIds = [];
    foreach (catn8_mystery_collect_locked_weapon_ids() as $wid) {
        $lockedIds[(int)$wid] = true;
    }
    if (isset($lockedIds[$id])) {
        catn8_json_response(['success' => false, 'error' => 'Weapon is locked (active crime scene)'], 409);
    }

    $row = Database::queryOne('SELECT id, is_archived FROM mystery_weapons WHERE id = ? LIMIT 1', [$id]);
    if (!$row) catn8_json_response(['success' => false, 'error' => 'Not found'], 404);
    if ((int)($row['is_archived'] ?? 0) !== 1) {
        catn8_json_response(['success' => false, 'error' => 'Only archived weapons can be deleted'], 400);
    }

    Database::execute('DELETE FROM mystery_weapons WHERE id = ? AND is_archived = 1', [$id]);
    catn8_json_response(['success' => true]);
}
