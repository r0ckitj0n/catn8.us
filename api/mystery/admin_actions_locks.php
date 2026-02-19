<?php
if ($action === 'list_locks') {
    $caseId = (int)($_GET['case_id'] ?? 0);
    $scopeType = trim((string)($_GET['scope_type'] ?? ''));
    $scopeId = (int)($_GET['scope_id'] ?? 0);
    $requireCase($caseId);

    if ($scopeType === '' || $scopeId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'scope_type and scope_id are required'], 400);
    }

    $rows = Database::queryAll(
        'SELECT id, game_id, scope_type, scope_id, lock_key, is_locked, created_at, updated_at
         FROM mystery_locks
         WHERE game_id = ? AND scope_type = ? AND scope_id = ?
         ORDER BY lock_key ASC',
        [$caseId, $scopeType, $scopeId]
    );

    $locks = array_map(static function (array $r): array {
        return [
            'id' => (int)($r['id'] ?? 0),
            'case_id' => (int)($r['game_id'] ?? 0),
            'scope_type' => (string)($r['scope_type'] ?? ''),
            'scope_id' => (int)($r['scope_id'] ?? 0),
            'lock_key' => (string)($r['lock_key'] ?? ''),
            'is_locked' => (int)($r['is_locked'] ?? 0),
        ];
    }, $rows);

    catn8_json_response(['success' => true, 'locks' => $locks]);
}

if ($action === 'set_lock') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $caseId = (int)($body['case_id'] ?? 0);
    $scopeType = trim((string)($body['scope_type'] ?? ''));
    $scopeId = (int)($body['scope_id'] ?? 0);
    $lockKey = trim((string)($body['lock_key'] ?? ''));
    $isLocked = (int)($body['is_locked'] ?? 1) ? 1 : 0;

    $requireCase($caseId);
    if ($scopeType === '' || $scopeId <= 0 || $lockKey === '') {
        catn8_json_response(['success' => false, 'error' => 'scope_type, scope_id, and lock_key are required'], 400);
    }

    $existing = Database::queryOne(
        'SELECT id FROM mystery_locks WHERE game_id = ? AND scope_type = ? AND scope_id = ? AND lock_key = ?',
        [$caseId, $scopeType, $scopeId, $lockKey]
    );
    if ($existing) {
        Database::execute('UPDATE mystery_locks SET is_locked = ? WHERE id = ?', [$isLocked, (int)($existing['id'] ?? 0)]);
        catn8_json_response(['success' => true, 'updated' => 1]);
    }

    Database::execute(
        'INSERT INTO mystery_locks (game_id, scope_type, scope_id, lock_key, is_locked) VALUES (?, ?, ?, ?, ?)',
        [$caseId, $scopeType, $scopeId, $lockKey, $isLocked]
    );
    catn8_json_response(['success' => true, 'created' => 1]);
}

if ($action === 'clear_scope_locks') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $caseId = (int)($body['case_id'] ?? 0);
    $scopeType = trim((string)($body['scope_type'] ?? ''));
    $scopeId = (int)($body['scope_id'] ?? 0);

    $requireCase($caseId);
    if ($scopeType === '' || $scopeId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'scope_type and scope_id are required'], 400);
    }

    Database::execute('DELETE FROM mystery_locks WHERE game_id = ? AND scope_type = ? AND scope_id = ?', [$caseId, $scopeType, $scopeId]);
    catn8_json_response(['success' => true]);
}

