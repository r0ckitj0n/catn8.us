<?php
if ($action === 'upload_weapon_image') {
    catn8_mystery_require_admin($isAdmin);
    catn8_require_method('POST');

    $id = (int)($_POST['weapon_id'] ?? 0);
    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'weapon_id is required'], 400);
    $row = Database::queryOne('SELECT id FROM mystery_weapons WHERE id = ? LIMIT 1', [$id]);
    if (!$row) catn8_json_response(['success' => false, 'error' => 'Weapon not found'], 404);
    if (!isset($_FILES['file'])) catn8_json_response(['success' => false, 'error' => 'file is required'], 400);

    $f = $_FILES['file'];
    $tmp = (string)($f['tmp_name'] ?? '');
    $orig = (string)($f['name'] ?? '');
    $err = (int)($f['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($err !== UPLOAD_ERR_OK) catn8_json_response(['success' => false, 'error' => 'Upload failed'], 400);
    if ($tmp === '' || !is_uploaded_file($tmp)) catn8_json_response(['success' => false, 'error' => 'Invalid upload'], 400);

    $ext = strtolower(pathinfo($orig, PATHINFO_EXTENSION));
    if ($ext === 'jpeg') $ext = 'jpg';
    $allowed = ['png', 'jpg', 'webp'];
    if (!in_array($ext, $allowed, true)) catn8_json_response(['success' => false, 'error' => 'Unsupported file type'], 400);

    $dir = dirname(__DIR__, 2) . '/images/mystery';
    if (!is_dir($dir)) catn8_json_response(['success' => false, 'error' => 'Image directory missing'], 500);

    $fileName = 'weapon_' . (string)$id . '.' . $ext;
    $dest = $dir . '/' . $fileName;
    if (!move_uploaded_file($tmp, $dest)) catn8_json_response(['success' => false, 'error' => 'Failed to store upload'], 500);

    $url = '/images/mystery/' . $fileName;
    Database::execute(
        'INSERT INTO mystery_weapon_images (weapon_id, title, url, alt_text, prompt_text, negative_prompt_text, provider, model)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE url = VALUES(url)',
        [$id, '', $url, '', '', '', '', '']
    );
    $img = catn8_mystery_weapon_image_load($id);
    catn8_json_response(['success' => true, 'weapon_id' => $id, 'url' => $url, 'image' => $img]);
}

if ($action === 'delete_weapon_image') {
    catn8_mystery_require_admin($isAdmin);
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['weapon_id'] ?? 0);
    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'weapon_id is required'], 400);
    $row = Database::queryOne('SELECT id FROM mystery_weapons WHERE id = ? LIMIT 1', [$id]);
    if (!$row) catn8_json_response(['success' => false, 'error' => 'Weapon not found'], 404);

    $root = dirname(__DIR__, 2);
    $dir = $root . '/images/mystery';
    if (!is_dir($dir)) catn8_json_response(['success' => false, 'error' => 'Image directory missing'], 500);

    $prefix = 'weapon_' . (string)$id;
    $candidates = [$prefix . '.png', $prefix . '.jpg', $prefix . '.jpeg', $prefix . '.webp'];
    $deleted = [];
    foreach ($candidates as $fn) {
        $p = $dir . '/' . $fn;
        if (!is_file($p)) continue;
        if (@unlink($p)) {
            $deleted[] = $fn;
        } else {
            catn8_json_response(['success' => false, 'error' => 'Failed to delete image file'], 500);
        }
    }

    Database::execute(
        'UPDATE mystery_weapon_images SET url = ? WHERE weapon_id = ? LIMIT 1',
        ['', $id]
    );
    $img = catn8_mystery_weapon_image_load($id);
    catn8_json_response(['success' => true, 'weapon_id' => $id, 'deleted' => $deleted, 'image' => $img]);
}
