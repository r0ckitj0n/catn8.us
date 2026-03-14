<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/valid8_vault_entry_model.php';

catn8_session_start();
catn8_groups_seed_core();
$actorUserId = catn8_require_group_or_admin('valid8-users');

$action = trim((string)($_GET['action'] ?? ''));
if ($action === 'attachment_download') {
    catn8_require_method('GET');
    $attachmentId = trim((string)($_GET['attachment_id'] ?? ''));
    if ($attachmentId === '') {
        catn8_json_response(['success' => false, 'error' => 'attachment_id is required'], 400);
    }

    $userUuid = Valid8VaultEntryModel::userUuidForUserId($actorUserId);
    try {
        $payload = Valid8VaultEntryModel::getAttachmentContent($userUuid, $attachmentId);
    } catch (Throwable $error) {
        catn8_json_response(['success' => false, 'error' => $error->getMessage()], 404);
    }

    $mimeType = (string)($payload['mime_type'] ?? 'application/octet-stream');
    $filename = (string)($payload['filename'] ?? 'attachment');
    $bytes = (string)($payload['bytes'] ?? '');

    if (!headers_sent()) {
        header('Content-Type: ' . $mimeType);
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: private, max-age=60');
        $safeName = preg_replace('/[^a-zA-Z0-9._-]+/', '_', $filename) ?: 'attachment';
        header('Content-Disposition: inline; filename="' . $safeName . '"');
    }
    echo $bytes;
    exit;
}

if ($action === 'list') {
    catn8_require_method('GET');

    $includeInactiveRaw = trim((string)($_GET['include_inactive'] ?? '0'));
    if ($includeInactiveRaw !== '0' && $includeInactiveRaw !== '1') {
        catn8_json_response(['success' => false, 'error' => 'include_inactive must be 0 or 1'], 400);
    }
    $includeInactive = $includeInactiveRaw === '1';

    $userUuid = Valid8VaultEntryModel::userUuidForUserId($actorUserId);
    $rows = Valid8VaultEntryModel::listEntries($userUuid, $includeInactive);
    $entries = array_map(static function (array $row): array {
        $entry = Valid8VaultEntryModel::toEntryModel($row);
        $secret = Valid8VaultEntryModel::decryptEntry($row);
        return array_merge($entry, $secret);
    }, $rows);

    catn8_json_response([
        'success' => true,
        'entries' => $entries,
        'include_inactive' => $includeInactive ? 1 : 0,
    ]);
}

if ($action === 'list_attachments') {
    catn8_require_method('GET');
    $entryId = trim((string)($_GET['entry_id'] ?? ''));
    $userUuid = Valid8VaultEntryModel::userUuidForUserId($actorUserId);
    try {
        $rows = Valid8VaultEntryModel::listAttachments($userUuid, $entryId === '' ? null : $entryId);
    } catch (Throwable $error) {
        catn8_json_response(['success' => false, 'error' => $error->getMessage()], 400);
    }
    $attachments = array_map(static fn(array $row): array => Valid8VaultEntryModel::toAttachmentModel($row), $rows);
    $attachments = array_map(static function (array $row): array {
        $row['download_url'] = '/api/valid8.php?action=attachment_download&attachment_id=' . rawurlencode((string)($row['id'] ?? ''));
        return $row;
    }, $attachments);
    catn8_json_response([
        'success' => true,
        'attachments' => $attachments,
    ]);
}

if ($action === 'upload_attachment') {
    catn8_require_method('POST');
    $entryId = trim((string)($_POST['entry_id'] ?? ''));
    if ($entryId === '') {
        catn8_json_response(['success' => false, 'error' => 'entry_id is required'], 400);
    }

    $upload = $_FILES['image'] ?? null;
    if (!is_array($upload)) {
        catn8_json_response(['success' => false, 'error' => 'image upload is required'], 400);
    }
    $errorCode = (int)($upload['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($errorCode !== UPLOAD_ERR_OK) {
        catn8_json_response(['success' => false, 'error' => 'Upload failed'], 400);
    }

    $tmpPath = (string)($upload['tmp_name'] ?? '');
    if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid uploaded file'], 400);
    }

    $sizeBytes = (int)($upload['size'] ?? 0);
    if ($sizeBytes <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Uploaded file is empty'], 400);
    }
    if ($sizeBytes > 10 * 1024 * 1024) {
        catn8_json_response(['success' => false, 'error' => 'Image must be 10MB or smaller'], 413);
    }

    $finfo = function_exists('finfo_open') ? finfo_open(FILEINFO_MIME_TYPE) : false;
    $detectedMime = $finfo ? (string)finfo_file($finfo, $tmpPath) : '';
    if ($finfo) {
        finfo_close($finfo);
    }
    $allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!in_array($detectedMime, $allowedMimes, true)) {
        catn8_json_response(['success' => false, 'error' => 'Only JPG, PNG, WEBP, or GIF images are allowed'], 415);
    }

    $bytes = file_get_contents($tmpPath);
    if (!is_string($bytes) || $bytes === '') {
        catn8_json_response(['success' => false, 'error' => 'Failed to read uploaded image'], 500);
    }

    $userUuid = Valid8VaultEntryModel::userUuidForUserId($actorUserId);
    try {
        $attachment = Valid8VaultEntryModel::addAttachment(
            $userUuid,
            $entryId,
            (string)($upload['name'] ?? 'attachment'),
            $detectedMime,
            $bytes
        );
    } catch (Throwable $error) {
        catn8_json_response(['success' => false, 'error' => $error->getMessage()], 400);
    }

    $attachment['download_url'] = '/api/valid8.php?action=attachment_download&attachment_id=' . rawurlencode((string)($attachment['id'] ?? ''));
    catn8_json_response([
        'success' => true,
        'attachment' => $attachment,
    ]);
}

if ($action === 'delete_attachment') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $attachmentId = trim((string)($body['attachment_id'] ?? ''));
    if ($attachmentId === '') {
        catn8_json_response(['success' => false, 'error' => 'attachment_id is required'], 400);
    }
    $userUuid = Valid8VaultEntryModel::userUuidForUserId($actorUserId);
    try {
        $deleted = Valid8VaultEntryModel::deleteAttachment($userUuid, $attachmentId);
    } catch (Throwable $error) {
        catn8_json_response(['success' => false, 'error' => $error->getMessage()], 400);
    }
    catn8_json_response([
        'success' => true,
        'deleted' => $deleted ? 1 : 0,
    ]);
}

if ($action === 'create_entry') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $userUuid = Valid8VaultEntryModel::userUuidForUserId($actorUserId);
    try {
        $entry = Valid8VaultEntryModel::createEntry(array_merge($body, [
            'user_id' => $userUuid,
        ]));
    } catch (Throwable $error) {
        catn8_json_response(['success' => false, 'error' => $error->getMessage()], 400);
    }
    catn8_json_response([
        'success' => true,
        'entry' => $entry,
    ]);
}

if ($action === 'update_entry') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $entryId = trim((string)($body['entry_id'] ?? ''));
    if ($entryId === '') {
        catn8_json_response(['success' => false, 'error' => 'entry_id is required'], 400);
    }
    $userUuid = Valid8VaultEntryModel::userUuidForUserId($actorUserId);
    try {
        $row = Valid8VaultEntryModel::updateEntry($userUuid, $entryId, $body);
        $entry = array_merge(Valid8VaultEntryModel::toEntryModel($row), Valid8VaultEntryModel::decryptEntry($row));
    } catch (Throwable $error) {
        catn8_json_response(['success' => false, 'error' => $error->getMessage()], 400);
    }
    catn8_json_response([
        'success' => true,
        'entry' => $entry,
    ]);
}

if ($action === 'archive_entry') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $entryId = trim((string)($body['entry_id'] ?? ''));
    if ($entryId === '') {
        catn8_json_response(['success' => false, 'error' => 'entry_id is required'], 400);
    }
    $userUuid = Valid8VaultEntryModel::userUuidForUserId($actorUserId);
    try {
        $archived = Valid8VaultEntryModel::archiveEntry($userUuid, $entryId);
    } catch (Throwable $error) {
        catn8_json_response(['success' => false, 'error' => $error->getMessage()], 400);
    }
    catn8_json_response([
        'success' => true,
        'archived' => $archived ? 1 : 0,
    ]);
}

if ($action === 'delete_entry') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $entryId = trim((string)($body['entry_id'] ?? ''));
    if ($entryId === '') {
        catn8_json_response(['success' => false, 'error' => 'entry_id is required'], 400);
    }
    $userUuid = Valid8VaultEntryModel::userUuidForUserId($actorUserId);
    try {
        $deleted = Valid8VaultEntryModel::deleteEntry($userUuid, $entryId);
    } catch (Throwable $error) {
        catn8_json_response(['success' => false, 'error' => $error->getMessage()], 400);
    }
    catn8_json_response([
        'success' => true,
        'deleted' => $deleted ? 1 : 0,
    ]);
}

if ($action === 'list_owners') {
    catn8_require_method('GET');
    $includeArchivedRaw = trim((string)($_GET['include_archived'] ?? '0'));
    if ($includeArchivedRaw !== '0' && $includeArchivedRaw !== '1') {
        catn8_json_response(['success' => false, 'error' => 'include_archived must be 0 or 1'], 400);
    }
    $includeArchived = $includeArchivedRaw === '1';
    $userUuid = Valid8VaultEntryModel::userUuidForUserId($actorUserId);
    try {
        $owners = Valid8VaultEntryModel::listOwners($userUuid, $includeArchived);
    } catch (Throwable $error) {
        catn8_json_response(['success' => false, 'error' => $error->getMessage()], 400);
    }
    catn8_json_response([
        'success' => true,
        'owners' => $owners,
    ]);
}

if ($action === 'list_categories') {
    catn8_require_method('GET');
    $includeArchivedRaw = trim((string)($_GET['include_archived'] ?? '0'));
    if ($includeArchivedRaw !== '0' && $includeArchivedRaw !== '1') {
        catn8_json_response(['success' => false, 'error' => 'include_archived must be 0 or 1'], 400);
    }
    $includeArchived = $includeArchivedRaw === '1';
    $userUuid = Valid8VaultEntryModel::userUuidForUserId($actorUserId);
    try {
        $categories = Valid8VaultEntryModel::listCategories($userUuid, $includeArchived);
    } catch (Throwable $error) {
        catn8_json_response(['success' => false, 'error' => $error->getMessage()], 400);
    }
    catn8_json_response([
        'success' => true,
        'categories' => $categories,
    ]);
}

if ($action === 'create_owner') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $name = trim((string)($body['name'] ?? ''));
    if ($name === '') {
        catn8_json_response(['success' => false, 'error' => 'name is required'], 400);
    }
    $userUuid = Valid8VaultEntryModel::userUuidForUserId($actorUserId);
    try {
        $owner = Valid8VaultEntryModel::createOwner($userUuid, $name);
    } catch (Throwable $error) {
        catn8_json_response(['success' => false, 'error' => $error->getMessage()], 400);
    }
    catn8_json_response([
        'success' => true,
        'owner' => $owner,
    ]);
}

if ($action === 'create_category') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $name = trim((string)($body['name'] ?? ''));
    if ($name === '') {
        catn8_json_response(['success' => false, 'error' => 'name is required'], 400);
    }
    $userUuid = Valid8VaultEntryModel::userUuidForUserId($actorUserId);
    try {
        $category = Valid8VaultEntryModel::createCategory($userUuid, $name);
    } catch (Throwable $error) {
        catn8_json_response(['success' => false, 'error' => $error->getMessage()], 400);
    }
    catn8_json_response([
        'success' => true,
        'category' => $category,
    ]);
}

if ($action === 'update_owner') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $ownerId = trim((string)($body['owner_id'] ?? ''));
    $name = trim((string)($body['name'] ?? ''));
    if ($ownerId === '' || $name === '') {
        catn8_json_response(['success' => false, 'error' => 'owner_id and name are required'], 400);
    }
    $userUuid = Valid8VaultEntryModel::userUuidForUserId($actorUserId);
    try {
        $owner = Valid8VaultEntryModel::updateOwner($userUuid, $ownerId, $name);
    } catch (Throwable $error) {
        catn8_json_response(['success' => false, 'error' => $error->getMessage()], 400);
    }
    catn8_json_response([
        'success' => true,
        'owner' => $owner,
    ]);
}

if ($action === 'update_category') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $categoryId = trim((string)($body['category_id'] ?? ''));
    $name = trim((string)($body['name'] ?? ''));
    if ($categoryId === '' || $name === '') {
        catn8_json_response(['success' => false, 'error' => 'category_id and name are required'], 400);
    }
    $userUuid = Valid8VaultEntryModel::userUuidForUserId($actorUserId);
    try {
        $category = Valid8VaultEntryModel::updateCategory($userUuid, $categoryId, $name);
    } catch (Throwable $error) {
        catn8_json_response(['success' => false, 'error' => $error->getMessage()], 400);
    }
    catn8_json_response([
        'success' => true,
        'category' => $category,
    ]);
}

if ($action === 'archive_owner') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $ownerId = trim((string)($body['owner_id'] ?? ''));
    if ($ownerId === '') {
        catn8_json_response(['success' => false, 'error' => 'owner_id is required'], 400);
    }
    $userUuid = Valid8VaultEntryModel::userUuidForUserId($actorUserId);
    try {
        $archived = Valid8VaultEntryModel::archiveOwner($userUuid, $ownerId);
    } catch (Throwable $error) {
        catn8_json_response(['success' => false, 'error' => $error->getMessage()], 400);
    }
    catn8_json_response([
        'success' => true,
        'archived' => $archived ? 1 : 0,
    ]);
}

if ($action === 'set_owner_archived') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $ownerId = trim((string)($body['owner_id'] ?? ''));
    $isArchivedRaw = $body['is_archived'] ?? null;
    if ($ownerId === '' || !in_array($isArchivedRaw, [0, 1, '0', '1'], true)) {
        catn8_json_response(['success' => false, 'error' => 'owner_id and is_archived are required'], 400);
    }
    $userUuid = Valid8VaultEntryModel::userUuidForUserId($actorUserId);
    try {
        $owner = Valid8VaultEntryModel::setOwnerArchived($userUuid, $ownerId, (string)$isArchivedRaw === '1' || (int)$isArchivedRaw === 1);
    } catch (Throwable $error) {
        catn8_json_response(['success' => false, 'error' => $error->getMessage()], 400);
    }
    catn8_json_response([
        'success' => true,
        'owner' => $owner,
    ]);
}

if ($action === 'archive_category') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $categoryId = trim((string)($body['category_id'] ?? ''));
    if ($categoryId === '') {
        catn8_json_response(['success' => false, 'error' => 'category_id is required'], 400);
    }
    $userUuid = Valid8VaultEntryModel::userUuidForUserId($actorUserId);
    try {
        $archived = Valid8VaultEntryModel::archiveCategory($userUuid, $categoryId);
    } catch (Throwable $error) {
        catn8_json_response(['success' => false, 'error' => $error->getMessage()], 400);
    }
    catn8_json_response([
        'success' => true,
        'archived' => $archived ? 1 : 0,
    ]);
}

if ($action === 'set_category_archived') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $categoryId = trim((string)($body['category_id'] ?? ''));
    $isArchivedRaw = $body['is_archived'] ?? null;
    if ($categoryId === '' || !in_array($isArchivedRaw, [0, 1, '0', '1'], true)) {
        catn8_json_response(['success' => false, 'error' => 'category_id and is_archived are required'], 400);
    }
    $userUuid = Valid8VaultEntryModel::userUuidForUserId($actorUserId);
    try {
        $category = Valid8VaultEntryModel::setCategoryArchived($userUuid, $categoryId, (string)$isArchivedRaw === '1' || (int)$isArchivedRaw === 1);
    } catch (Throwable $error) {
        catn8_json_response(['success' => false, 'error' => $error->getMessage()], 400);
    }
    catn8_json_response([
        'success' => true,
        'category' => $category,
    ]);
}

if ($action === 'delete_owner') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $ownerId = trim((string)($body['owner_id'] ?? ''));
    if ($ownerId === '') {
        catn8_json_response(['success' => false, 'error' => 'owner_id is required'], 400);
    }
    $userUuid = Valid8VaultEntryModel::userUuidForUserId($actorUserId);
    try {
        $deleted = Valid8VaultEntryModel::deleteOwner($userUuid, $ownerId);
    } catch (Throwable $error) {
        catn8_json_response(['success' => false, 'error' => $error->getMessage()], 400);
    }
    catn8_json_response([
        'success' => true,
        'deleted' => $deleted ? 1 : 0,
    ]);
}

if ($action === 'delete_category') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $categoryId = trim((string)($body['category_id'] ?? ''));
    if ($categoryId === '') {
        catn8_json_response(['success' => false, 'error' => 'category_id is required'], 400);
    }
    $userUuid = Valid8VaultEntryModel::userUuidForUserId($actorUserId);
    try {
        $deleted = Valid8VaultEntryModel::deleteCategory($userUuid, $categoryId);
    } catch (Throwable $error) {
        catn8_json_response(['success' => false, 'error' => $error->getMessage()], 400);
    }
    catn8_json_response([
        'success' => true,
        'deleted' => $deleted ? 1 : 0,
    ]);
}

catn8_json_response(['success' => false, 'error' => 'Unknown action'], 400);
