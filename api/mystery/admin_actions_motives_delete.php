<?php
if ($action === 'delete_motive') {
    catn8_mystery_require_admin($isAdmin);
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);

    $lockedIds = [];
    foreach (catn8_mystery_collect_locked_motive_ids() as $mid2) {
        $lockedIds[(int)$mid2] = true;
    }
    if (isset($lockedIds[$id])) {
        catn8_json_response(['success' => false, 'error' => 'Motive is locked (active crime scene)'], 409);
    }

    $row = Database::queryOne('SELECT id, is_archived FROM mystery_motives WHERE id = ? LIMIT 1', [$id]);
    if (!$row) catn8_json_response(['success' => false, 'error' => 'Not found'], 404);
    if ((int)($row['is_archived'] ?? 0) !== 1) {
        catn8_json_response(['success' => false, 'error' => 'Only archived motives can be deleted'], 400);
    }

    Database::execute('DELETE FROM mystery_motives WHERE id = ? AND is_archived = 1', [$id]);
    catn8_json_response(['success' => true]);
}
