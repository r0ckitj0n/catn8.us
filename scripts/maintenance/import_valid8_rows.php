<?php

declare(strict_types=1);

require_once __DIR__ . '/../../api/bootstrap.php';
require_once __DIR__ . '/../../includes/valid8_vault_entry_model.php';

$options = [
    'input' => '',
    'user_id' => 0,
    'user_uuid' => '',
    'db_profile' => 'local',
];

foreach (array_slice($argv, 1) as $arg) {
    if (strpos($arg, '--input=') === 0) {
        $options['input'] = trim(substr($arg, 8));
    } elseif (strpos($arg, '--user-id=') === 0) {
        $options['user_id'] = (int)trim(substr($arg, 10));
    } elseif (strpos($arg, '--user-uuid=') === 0) {
        $options['user_uuid'] = trim(substr($arg, 12));
    } elseif (strpos($arg, '--db-profile=') === 0) {
        $options['db_profile'] = strtolower(trim(substr($arg, 13)));
    }
}

if ($options['input'] === '') {
    fwrite(STDERR, "Missing --input=/path/to/import_rows.json\n");
    exit(1);
}

if ($options['db_profile'] === 'live') {
    $map = [
        'CATN8_DB_LOCAL_HOST' => 'CATN8_DB_LIVE_HOST',
        'CATN8_DB_LOCAL_NAME' => 'CATN8_DB_LIVE_NAME',
        'CATN8_DB_LOCAL_USER' => 'CATN8_DB_LIVE_USER',
        'CATN8_DB_LOCAL_PASS' => 'CATN8_DB_LIVE_PASS',
        'CATN8_DB_LOCAL_PORT' => 'CATN8_DB_LIVE_PORT',
        'CATN8_DB_LOCAL_SOCKET' => 'CATN8_DB_LIVE_SOCKET',
    ];
    foreach ($map as $local => $live) {
        $value = getenv($live);
        if ($value !== false) {
            putenv($local . '=' . $value);
            $_ENV[$local] = $value;
            $_SERVER[$local] = $value;
        }
    }
}

$inputPath = $options['input'];
if (!is_file($inputPath)) {
    fwrite(STDERR, "Input file not found: {$inputPath}\n");
    exit(1);
}

$raw = file_get_contents($inputPath);
if (!is_string($raw) || trim($raw) === '') {
    fwrite(STDERR, "Input file is empty: {$inputPath}\n");
    exit(1);
}

$rows = json_decode($raw, true);
if (!is_array($rows)) {
    fwrite(STDERR, "Input file is not valid JSON array: {$inputPath}\n");
    exit(1);
}

Valid8VaultEntryModel::ensureSchema();

$userUuid = trim((string)$options['user_uuid']);
if ($userUuid === '') {
    $userId = (int)$options['user_id'];
    if ($userId <= 0) {
        fwrite(STDERR, "Provide --user-id=<int> or --user-uuid=<uuid>\n");
        exit(1);
    }
    $userUuid = Valid8VaultEntryModel::userUuidForUserId($userId);
}

$counts = [
    'inserted' => 0,
    'duplicate' => 0,
    'errors' => 0,
    'active' => 0,
    'inactive' => 0,
];

foreach ($rows as $idx => $row) {
    if (!is_array($row)) {
        $counts['errors']++;
        fwrite(STDERR, "Row {$idx}: not an object\n");
        continue;
    }

    try {
        $payload = [
            'user_id' => $userUuid,
            'title' => (string)($row['title'] ?? ''),
            'url' => isset($row['url']) ? (string)$row['url'] : null,
            'username' => (string)($row['username'] ?? ''),
            'password' => (string)($row['password'] ?? ''),
            'notes' => isset($row['notes']) ? (string)$row['notes'] : null,
            'category' => (string)($row['category'] ?? ''),
            'is_favorite' => (int)($row['is_favorite'] ?? 0),
            'password_strength' => (int)($row['password_strength'] ?? 1),
            'is_active' => (int)($row['is_active'] ?? 1),
            'source_tab' => isset($row['source_tab']) ? (string)$row['source_tab'] : null,
            'source_document' => isset($row['source_document']) ? (string)$row['source_document'] : null,
            'last_changed_at' => (string)($row['last_changed_at'] ?? ''),
        ];

        $result = Valid8VaultEntryModel::createEntry($payload);
        $status = (string)($result['_import_status'] ?? 'inserted');
        if ($status === 'duplicate') {
            $counts['duplicate']++;
        } else {
            $counts['inserted']++;
            if ((int)($result['is_active'] ?? 1) === 1) {
                $counts['active']++;
            } else {
                $counts['inactive']++;
            }
        }
    } catch (Throwable $error) {
        $counts['errors']++;
        $title = trim((string)($row['title'] ?? ''));
        $tab = trim((string)($row['source_tab'] ?? ''));
        fwrite(STDERR, "Row {$idx} failed (tab={$tab}, title={$title}): " . $error->getMessage() . "\n");
    }
}

fwrite(STDOUT, json_encode([
    'success' => true,
    'db_profile' => $options['db_profile'],
    'user_uuid' => $userUuid,
    'totals' => $counts,
], JSON_PRETTY_PRINT) . "\n");
