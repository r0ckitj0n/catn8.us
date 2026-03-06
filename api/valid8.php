<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/valid8_vault_entry_model.php';

catn8_session_start();
catn8_groups_seed_core();
$actorUserId = catn8_require_group_or_admin('valid8-users');

$action = trim((string)($_GET['action'] ?? ''));
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

catn8_json_response(['success' => false, 'error' => 'Unknown action'], 400);
