<?php

declare(strict_types=1);

const ACCUMUL8_PLAID_WEBHOOK_URL = 'https://catn8.us/api/accumul8_plaid_webhook.php';
const ACCUMUL8_PLAID_HEALTH_ADMIN_EMAIL = 'jon@catn8.us';
const ACCUMUL8_PLAID_HEALTH_STALE_SECONDS = 129600;
const ACCUMUL8_PLAID_SYNC_URL = 'https://catn8.us/accumul8/';

function accumul8_plaid_webhook_text(string $value, int $maxLen): string
{
    if (function_exists('accumul8_normalize_text')) {
        return accumul8_normalize_text($value, $maxLen);
    }
    $value = trim((string)preg_replace('/\s+/', ' ', $value));
    if ($maxLen > 0 && strlen($value) > $maxLen) {
        $value = substr($value, 0, $maxLen);
    }
    return trim($value);
}

function accumul8_plaid_base64url_decode(string $data): string
{
    $data = strtr($data, '-_', '+/');
    $pad = strlen($data) % 4;
    if ($pad > 0) {
        $data .= str_repeat('=', 4 - $pad);
    }
    $decoded = base64_decode($data, true);
    if (!is_string($decoded)) {
        throw new RuntimeException('Invalid base64url');
    }
    return $decoded;
}

function accumul8_plaid_base64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function accumul8_plaid_ecdsa_raw_to_der(string $raw): string
{
    if (strlen($raw) !== 64) {
        throw new RuntimeException('Plaid ES256 signature must be 64 bytes');
    }
    $encodeInt = static function (string $bytes): string {
        $bytes = ltrim($bytes, "\x00");
        if ($bytes === '') {
            $bytes = "\x00";
        }
        if ((ord($bytes[0]) & 0x80) === 0x80) {
            $bytes = "\x00" . $bytes;
        }
        if (strlen($bytes) > 127) {
            throw new RuntimeException('Plaid ES256 integer is too long');
        }
        return "\x02" . chr(strlen($bytes)) . $bytes;
    };
    $body = $encodeInt(substr($raw, 0, 32)) . $encodeInt(substr($raw, 32, 32));
    if (strlen($body) > 127) {
        throw new RuntimeException('Plaid ES256 signature sequence is too long');
    }
    return "\x30" . chr(strlen($body)) . $body;
}

function accumul8_plaid_jwk_to_pem(array $jwk): string
{
    $x = accumul8_plaid_base64url_decode((string)($jwk['x'] ?? ''));
    $y = accumul8_plaid_base64url_decode((string)($jwk['y'] ?? ''));
    if (strlen($x) !== 32 || strlen($y) !== 32) {
        throw new RuntimeException('Plaid verification key is not P-256');
    }
    $prefix = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200');
    if (!is_string($prefix)) {
        throw new RuntimeException('Plaid verification key prefix is invalid');
    }
    $pemBody = chunk_split(base64_encode($prefix . "\x04" . $x . $y), 64, "\n");
    return "-----BEGIN PUBLIC KEY-----\n" . $pemBody . "-----END PUBLIC KEY-----\n";
}

function accumul8_plaid_verify_webhook_jwt(string $jwt, string $rawBody, callable $keyResolver, int $now): array
{
    $fail = static function (string $error): array {
        return ['ok' => false, 'error' => $error, 'claims' => []];
    };
    $parts = explode('.', trim($jwt));
    if (count($parts) !== 3 || $parts[0] === '' || $parts[1] === '') {
        return $fail('Malformed Plaid verification token');
    }
    try {
        $header = json_decode(accumul8_plaid_base64url_decode($parts[0]), true);
    } catch (Throwable $exception) {
        return $fail('Malformed Plaid verification header');
    }
    if (!is_array($header)) {
        return $fail('Malformed Plaid verification header');
    }
    if ((string)($header['alg'] ?? '') !== 'ES256') {
        return $fail('Unsupported Plaid verification algorithm');
    }
    if ($parts[2] === '') {
        return $fail('Plaid verification signature is invalid');
    }
    $kid = trim((string)($header['kid'] ?? ''));
    if ($kid === '' || strlen($kid) > 128 || !preg_match('/^[A-Za-z0-9._-]+$/', $kid)) {
        return $fail('Missing Plaid verification key id');
    }
    try {
        $jwk = $keyResolver($kid);
    } catch (Throwable $exception) {
        return $fail('Plaid verification key lookup failed');
    }
    if (!is_array($jwk)) {
        return $fail('Plaid verification key lookup failed');
    }
    $expiredAt = (int)($jwk['expired_at'] ?? 0);
    if ($expiredAt > 0 && $expiredAt <= $now) {
        return $fail('Plaid verification key is expired');
    }
    try {
        $pem = accumul8_plaid_jwk_to_pem($jwk);
        $derSig = accumul8_plaid_ecdsa_raw_to_der(accumul8_plaid_base64url_decode($parts[2]));
    } catch (Throwable $exception) {
        return $fail('Plaid verification signature is invalid');
    }
    $verified = openssl_verify($parts[0] . '.' . $parts[1], $derSig, $pem, OPENSSL_ALGO_SHA256);
    if ($verified !== 1) {
        return $fail('Plaid verification signature did not match');
    }
    try {
        $claims = json_decode(accumul8_plaid_base64url_decode($parts[1]), true);
    } catch (Throwable $exception) {
        return $fail('Malformed Plaid verification claims');
    }
    if (!is_array($claims)) {
        return $fail('Malformed Plaid verification claims');
    }
    $iat = (int)($claims['iat'] ?? 0);
    if ($iat <= 0 || ($now - $iat) > 300 || $iat > ($now + 60)) {
        return $fail('Plaid verification token is expired');
    }
    $expectedHash = hash('sha256', $rawBody);
    $claimedHash = strtolower(trim((string)($claims['request_body_sha256'] ?? '')));
    if ($claimedHash === '' || !hash_equals($expectedHash, $claimedHash)) {
        return $fail('Plaid verification body hash did not match');
    }
    return ['ok' => true, 'error' => '', 'claims' => $claims];
}

function accumul8_plaid_webhook_key_cache_path(): string
{
    return rtrim(sys_get_temp_dir(), '/') . '/catn8-plaid-webhook-keys.json';
}

function accumul8_plaid_read_webhook_key_cache(): array
{
    $path = accumul8_plaid_webhook_key_cache_path();
    if (!is_file($path)) {
        return [];
    }
    $decoded = json_decode((string)file_get_contents($path), true);
    return is_array($decoded) ? $decoded : [];
}

function accumul8_plaid_write_webhook_key_cache(array $cache): void
{
    $json = json_encode($cache);
    if (!is_string($json)) {
        return;
    }
    @file_put_contents(accumul8_plaid_webhook_key_cache_path(), $json, LOCK_EX);
}

function accumul8_plaid_fetch_webhook_jwk(string $kid, bool $forceRefresh = false): array
{
    $cache = accumul8_plaid_read_webhook_key_cache();
    if (!$forceRefresh && isset($cache[$kid]) && is_array($cache[$kid])) {
        $expiredAt = (int)($cache[$kid]['expired_at'] ?? 0);
        if ($expiredAt === 0 || $expiredAt > time()) {
            return $cache[$kid];
        }
    }
    $res = accumul8_plaid_request('/webhook_verification_key/get', ['key_id' => $kid]);
    $key = is_array($res['key'] ?? null) ? $res['key'] : null;
    if (!is_array($key)) {
        throw new RuntimeException('Plaid did not return a verification key');
    }
    $stored = [
        'kty' => (string)($key['kty'] ?? ''),
        'crv' => (string)($key['crv'] ?? ''),
        'x' => (string)($key['x'] ?? ''),
        'y' => (string)($key['y'] ?? ''),
        'kid' => (string)($key['kid'] ?? $kid),
        'expired_at' => isset($key['expired_at']) ? (int)$key['expired_at'] : 0,
    ];
    $cache[$kid] = $stored;
    accumul8_plaid_write_webhook_key_cache($cache);
    return $stored;
}

function accumul8_plaid_verify_incoming_webhook(string $jwt, string $rawBody): array
{
    $result = accumul8_plaid_verify_webhook_jwt(
        $jwt,
        $rawBody,
        static function (string $kid): array {
            return accumul8_plaid_fetch_webhook_jwk($kid, false);
        },
        time()
    );
    if ($result['ok'] || (string)($result['error'] ?? '') !== 'Plaid verification signature did not match') {
        return $result;
    }
    return accumul8_plaid_verify_webhook_jwt(
        $jwt,
        $rawBody,
        static function (string $kid): array {
            return accumul8_plaid_fetch_webhook_jwk($kid, true);
        },
        time()
    );
}

function accumul8_plaid_code_needs_reauth(string $code): bool
{
    return in_array(strtoupper(trim($code)), [
        'ITEM_LOGIN_REQUIRED',
        'PENDING_EXPIRATION',
        'PENDING_DISCONNECT',
        'USER_PERMISSION_REVOKED',
        'ERROR',
    ], true);
}

function accumul8_plaid_message_needs_reauth(string $message): bool
{
    $upper = strtoupper($message);
    foreach (['ITEM_LOGIN_REQUIRED', 'PENDING_EXPIRATION', 'PENDING_DISCONNECT', 'USER_PERMISSION_REVOKED'] as $code) {
        if (str_contains($upper, $code)) {
            return true;
        }
    }
    return false;
}

function accumul8_plaid_classify_webhook(array $payload): array
{
    $code = strtoupper(trim((string)($payload['webhook_code'] ?? '')));
    $itemId = accumul8_plaid_webhook_text((string)($payload['item_id'] ?? ''), 191);
    $error = is_array($payload['error'] ?? null) ? $payload['error'] : [];
    $errorCode = strtoupper(trim((string)($error['error_code'] ?? '')));
    $reason = accumul8_plaid_webhook_text((string)($error['error_message'] ?? $error['display_message'] ?? ''), 500);
    if ($reason === '') {
        $reason = $errorCode !== '' ? $errorCode : $code;
    }
    if ($code === 'SYNC_UPDATES_AVAILABLE' || $code === 'NEW_ACCOUNTS_AVAILABLE') {
        return ['action' => 'sync', 'item_id' => $itemId, 'reason' => $code === 'NEW_ACCOUNTS_AVAILABLE' ? 'NEW_ACCOUNTS_AVAILABLE' : ''];
    }
    if (accumul8_plaid_code_needs_reauth($code) || $errorCode === 'ITEM_LOGIN_REQUIRED') {
        return ['action' => 'needs_reauth', 'item_id' => $itemId, 'reason' => $reason];
    }
    return ['action' => 'ignore', 'item_id' => $itemId, 'reason' => $code];
}

function accumul8_plaid_connection_is_stale(?int $lastSyncUnix, ?int $createdUnix, int $now, int $staleSeconds = ACCUMUL8_PLAID_HEALTH_STALE_SECONDS): bool
{
    if ($lastSyncUnix !== null && $lastSyncUnix > 0) {
        return ($now - $lastSyncUnix) > $staleSeconds;
    }
    if ($createdUnix !== null && $createdUnix > 0 && ($now - $createdUnix) <= $staleSeconds) {
        return false;
    }
    return true;
}

function accumul8_plaid_parse_flag_list(string $raw): array
{
    $allowed = ['stale_sync', 'needs_reauth', 'repeated_errors', 'missing_webhook', 'credential_failure'];
    $flags = [];
    foreach (explode(',', $raw) as $flag) {
        $flag = strtolower(trim($flag));
        if (in_array($flag, $allowed, true)) {
            $flags[$flag] = true;
        }
    }
    $flags = array_keys($flags);
    sort($flags);
    return $flags;
}

function accumul8_plaid_health_flags(array $input): array
{
    $flags = [];
    if (!empty($input['needs_reauth'])) {
        $flags[] = 'needs_reauth';
    }
    if (!empty($input['stale'])) {
        $flags[] = 'stale_sync';
    }
    if ((int)($input['consecutive_errors'] ?? 0) >= 2) {
        $flags[] = 'repeated_errors';
    }
    if (!empty($input['missing_webhook'])) {
        $flags[] = 'missing_webhook';
    }
    if (!empty($input['credential_failure'])) {
        $flags[] = 'credential_failure';
    }
    sort($flags);
    return $flags;
}

function accumul8_plaid_health_alert_key(array $problems): string
{
    if ($problems === []) {
        return 'ok';
    }
    $parts = [];
    foreach ($problems as $problem) {
        if (!is_array($problem)) {
            continue;
        }
        $flags = accumul8_plaid_parse_flag_list(implode(',', is_array($problem['flags'] ?? null) ? $problem['flags'] : []));
        if ($flags === []) {
            continue;
        }
        $parts[] = (int)($problem['connection_id'] ?? 0) . ':' . implode(',', $flags);
    }
    if ($parts === []) {
        return 'ok';
    }
    sort($parts);
    return implode('|', $parts);
}

function accumul8_plaid_health_email_decision(string $previousKey, string $nextKey): string
{
    $previous = trim($previousKey) === '' ? 'ok' : trim($previousKey);
    $next = trim($nextKey) === '' ? 'ok' : trim($nextKey);
    if ($next === 'ok' && $previous === 'ok') {
        return 'none';
    }
    if ($next === 'ok') {
        return 'cleared';
    }
    if ($next === $previous) {
        return 'none';
    }
    return 'problem';
}

function accumul8_plaid_health_flag_label(string $flag): string
{
    switch ($flag) {
        case 'needs_reauth':
            return 'needs reconnect';
        case 'stale_sync':
            return 'last successful sync is older than 36 hours';
        case 'repeated_errors':
            return 'repeated sync errors';
        case 'missing_webhook':
            return 'Plaid webhook is missing';
        case 'credential_failure':
            return 'Plaid API or credential failure';
        default:
            return 'needs attention';
    }
}

function accumul8_plaid_health_email_content(string $kind, array $problems): array
{
    $syncUrl = ACCUMUL8_PLAID_SYNC_URL;
    if ($kind === 'cleared') {
        $html = '<p>Accumul8 Plaid sync is healthy again. No reconnect is needed.</p>'
            . '<p>Sync tab: <a href="' . htmlspecialchars($syncUrl, ENT_QUOTES, 'UTF-8') . '">'
            . htmlspecialchars($syncUrl, ENT_QUOTES, 'UTF-8') . '</a></p>';
        return [
            'subject' => 'Accumul8: Plaid sync is healthy again',
            'html' => $html,
        ];
    }
    $items = '';
    foreach ($problems as $problem) {
        if (!is_array($problem)) {
            continue;
        }
        $name = trim((string)($problem['institution_name'] ?? ''));
        if ($name === '') {
            $name = 'Connected bank';
        }
        $labels = [];
        foreach ((is_array($problem['flags'] ?? null) ? $problem['flags'] : []) as $flag) {
            $labels[] = accumul8_plaid_health_flag_label((string)$flag);
        }
        $sentence = $labels === [] ? 'needs attention' : implode('; ', $labels);
        $items .= '<li>' . htmlspecialchars($name, ENT_QUOTES, 'UTF-8') . ': '
            . htmlspecialchars($sentence, ENT_QUOTES, 'UTF-8')
            . '. Click <strong>Reconnect via Plaid</strong> on the Sync tab.</li>';
    }
    if ($items === '') {
        $items = '<li>A Plaid connection needs attention. Click <strong>Reconnect via Plaid</strong> on the Sync tab.</li>';
    }
    $html = '<p>Accumul8 found a Plaid sync problem. Open the Sync tab and click <strong>Reconnect via Plaid</strong> for the bank named below.</p>'
        . '<p><a href="' . htmlspecialchars($syncUrl, ENT_QUOTES, 'UTF-8') . '">'
        . htmlspecialchars($syncUrl, ENT_QUOTES, 'UTF-8') . '</a></p><ul>' . $items . '</ul>';
    return [
        'subject' => 'Accumul8: Plaid sync needs attention',
        'html' => $html,
    ];
}

function accumul8_plaid_health_alert_secret_key(int $viewerId): string
{
    return 'accumul8.plaid.health_alert_key.' . $viewerId;
}

function accumul8_plaid_connections_for_item(string $itemId): array
{
    $itemId = accumul8_plaid_webhook_text($itemId, 191);
    if ($itemId === '') {
        return [];
    }
    $rows = Database::queryAll(
        'SELECT id, owner_user_id, institution_name, status
         FROM accumul8_bank_connections
         WHERE plaid_item_id = ?',
        [$itemId]
    );
    return is_array($rows) ? $rows : [];
}

function accumul8_plaid_mark_needs_reauth(int $viewerId, int $connectionId, string $reason): void
{
    $reason = accumul8_plaid_webhook_text($reason, 500);
    if ($reason === '') {
        $reason = 'Plaid asked for reconnect';
    }
    Database::execute(
        'UPDATE accumul8_bank_connections
         SET status = ?, last_error = ?, updated_at = NOW()
         WHERE id = ? AND owner_user_id = ?',
        ['needs_reauth', $reason, $connectionId, $viewerId]
    );
}

function accumul8_plaid_record_sync_failure(int $viewerId, int $connectionId, string $message): void
{
    $message = accumul8_plaid_webhook_text($message, 1000);
    if ($message === '') {
        $message = 'Plaid sync failed';
    }
    $reauth = accumul8_plaid_message_needs_reauth($message);
    $count = 1;
    $status = $reauth ? 'needs_reauth' : 'sync_error';
    try {
        $row = Database::queryOne(
            'SELECT status, plaid_consecutive_error_count
             FROM accumul8_bank_connections
             WHERE id = ? AND owner_user_id = ?
             LIMIT 1',
            [$connectionId, $viewerId]
        );
        if (is_array($row)) {
            $count = (int)($row['plaid_consecutive_error_count'] ?? 0) + 1;
            if (!$reauth && strtolower((string)($row['status'] ?? '')) === 'needs_reauth') {
                $status = 'needs_reauth';
            }
        }
        Database::execute(
            'UPDATE accumul8_bank_connections
             SET status = ?, last_error = ?, plaid_consecutive_error_count = ?, updated_at = NOW()
             WHERE id = ? AND owner_user_id = ?',
            [$status, $message, $count, $connectionId, $viewerId]
        );
        return;
    } catch (Throwable $exception) {
        error_log('accumul8 plaid error counter update failed: ' . accumul8_plaid_webhook_text($exception->getMessage(), 300));
    }
    Database::execute(
        'UPDATE accumul8_bank_connections
         SET status = ?, last_error = ?, updated_at = NOW()
         WHERE id = ? AND owner_user_id = ?',
        [$status, $message, $connectionId, $viewerId]
    );
}

function accumul8_plaid_list_monitored_connections(int $viewerId): array
{
    $rows = Database::queryAll(
        'SELECT id, institution_name, provider_name, status, plaid_item_id, plaid_access_token_secret_key,
                last_sync_at, last_error, created_at, plaid_consecutive_error_count, plaid_health_flags,
                CASE
                    WHEN last_sync_at IS NOT NULL AND last_sync_at < DATE_SUB(NOW(), INTERVAL 36 HOUR) THEN 1
                    WHEN last_sync_at IS NULL AND (created_at IS NULL OR created_at < DATE_SUB(NOW(), INTERVAL 36 HOUR)) THEN 1
                    ELSE 0
                END AS sync_is_stale
         FROM accumul8_bank_connections
         WHERE owner_user_id = ?
           AND provider_name = ?
           AND status <> ?
         ORDER BY id ASC',
        [$viewerId, 'plaid', 'retired_teller']
    );
    return is_array($rows) ? $rows : [];
}

function accumul8_plaid_flags_from_row(array $row): array
{
    $stored = accumul8_plaid_parse_flag_list((string)($row['plaid_health_flags'] ?? ''));
    if (array_key_exists('sync_is_stale', $row)) {
        $stale = (int)$row['sync_is_stale'] === 1;
    } else {
        $lastSync = strtotime((string)($row['last_sync_at'] ?? ''));
        $created = strtotime((string)($row['created_at'] ?? ''));
        $stale = accumul8_plaid_connection_is_stale(
            $lastSync === false ? null : $lastSync,
            $created === false ? null : $created,
            time()
        );
    }
    return accumul8_plaid_health_flags([
        'needs_reauth' => strtolower((string)($row['status'] ?? '')) === 'needs_reauth',
        'stale' => $stale,
        'consecutive_errors' => (int)($row['plaid_consecutive_error_count'] ?? 0),
        'missing_webhook' => in_array('missing_webhook', $stored, true),
        'credential_failure' => in_array('credential_failure', $stored, true),
    ]);
}

function accumul8_plaid_probe_connection(int $viewerId, array $row): array
{
    $result = [
        'missing_webhook' => false,
        'credential_failure' => false,
        'needs_reauth' => false,
        'reauth_reason' => '',
        'probe_error' => '',
    ];
    if (!accumul8_plaid_is_configured()) {
        $result['credential_failure'] = true;
        $result['probe_error'] = 'Plaid not configured';
        return $result;
    }
    $itemId = accumul8_plaid_webhook_text((string)($row['plaid_item_id'] ?? ''), 191);
    $secretKey = accumul8_plaid_webhook_text((string)($row['plaid_access_token_secret_key'] ?? ''), 191);
    if ($secretKey === '' && $itemId !== '') {
        $secretKey = accumul8_plaid_access_token_secret_key($viewerId, $itemId);
    }
    $accessToken = $secretKey === '' ? '' : trim((string)(secret_get($secretKey) ?? ''));
    if ($accessToken === '') {
        $result['credential_failure'] = true;
        $result['probe_error'] = 'Stored Plaid access token was not found';
        return $result;
    }
    try {
        $itemRes = accumul8_plaid_request('/item/get', ['access_token' => $accessToken]);
    } catch (Throwable $exception) {
        $message = accumul8_plaid_webhook_text($exception->getMessage(), 300);
        if (accumul8_plaid_message_needs_reauth($message)) {
            $result['needs_reauth'] = true;
            $result['reauth_reason'] = $message;
            return $result;
        }
        $result['credential_failure'] = true;
        $result['probe_error'] = $message;
        return $result;
    }
    $item = is_array($itemRes['item'] ?? null) ? $itemRes['item'] : [];
    $itemError = is_array($item['error'] ?? null) ? $item['error'] : [];
    $errorCode = strtoupper(accumul8_plaid_webhook_text((string)($itemError['error_code'] ?? ''), 64));
    if ($errorCode !== '' && accumul8_plaid_message_needs_reauth($errorCode)) {
        $result['needs_reauth'] = true;
        $result['reauth_reason'] = accumul8_plaid_webhook_text((string)($itemError['error_message'] ?? $errorCode), 300);
    }
    $webhook = trim((string)($item['webhook'] ?? ''));
    if ($webhook !== ACCUMUL8_PLAID_WEBHOOK_URL) {
        try {
            accumul8_plaid_request('/item/webhook/update', [
                'access_token' => $accessToken,
                'webhook' => ACCUMUL8_PLAID_WEBHOOK_URL,
            ]);
        } catch (Throwable $exception) {
            $result['missing_webhook'] = true;
            $result['probe_error'] = accumul8_plaid_webhook_text($exception->getMessage(), 300);
        }
    }
    return $result;
}

function accumul8_plaid_store_probe_flags(int $viewerId, int $connectionId, array $probeFlags): void
{
    $flags = accumul8_plaid_parse_flag_list(implode(',', $probeFlags));
    $probeOnly = array_values(array_intersect($flags, ['missing_webhook', 'credential_failure']));
    Database::execute(
        'UPDATE accumul8_bank_connections
         SET plaid_health_flags = ?, updated_at = NOW()
         WHERE id = ? AND owner_user_id = ?',
        [$probeOnly === [] ? null : implode(',', $probeOnly), $connectionId, $viewerId]
    );
}

function accumul8_plaid_collect_health(int $viewerId, bool $probe): array
{
    $rows = accumul8_plaid_list_monitored_connections($viewerId);
    $connections = [];
    $problems = [];
    foreach ($rows as $row) {
        if (!is_array($row)) {
            continue;
        }
        $connectionId = (int)($row['id'] ?? 0);
        if ($connectionId <= 0) {
            continue;
        }
        $institutionName = accumul8_plaid_webhook_text((string)($row['institution_name'] ?? ''), 191);
        if ($institutionName === '') {
            $institutionName = 'Connected bank';
        }
        if ($probe) {
            try {
                $probeResult = accumul8_plaid_probe_connection($viewerId, $row);
                if (!empty($probeResult['needs_reauth'])) {
                    accumul8_plaid_mark_needs_reauth($viewerId, $connectionId, (string)$probeResult['reauth_reason']);
                    $row['status'] = 'needs_reauth';
                    $row['last_error'] = (string)$probeResult['reauth_reason'];
                }
                $probeFlags = [];
                if (!empty($probeResult['missing_webhook'])) {
                    $probeFlags[] = 'missing_webhook';
                }
                if (!empty($probeResult['credential_failure'])) {
                    $probeFlags[] = 'credential_failure';
                }
                accumul8_plaid_store_probe_flags($viewerId, $connectionId, $probeFlags);
                $row['plaid_health_flags'] = implode(',', $probeFlags);
            } catch (Throwable $exception) {
                error_log('accumul8 plaid health probe failed for connection ' . $connectionId . ': ' . accumul8_plaid_webhook_text($exception->getMessage(), 300));
                $row['plaid_health_flags'] = 'credential_failure';
            }
        }
        $flags = accumul8_plaid_flags_from_row($row);
        $public = [
            'connection_id' => $connectionId,
            'institution_name' => $institutionName,
            'status' => (string)($row['status'] ?? ''),
            'last_sync_at' => (string)($row['last_sync_at'] ?? ''),
            'flags' => $flags,
            'action' => $flags === [] ? '' : 'Reconnect via Plaid',
        ];
        $connections[] = $public;
        if ($flags !== []) {
            $problems[] = $public;
        }
    }
    return [
        'connections' => $connections,
        'problems' => $problems,
        'alert_key' => accumul8_plaid_health_alert_key($problems),
    ];
}

function accumul8_plaid_public_health(array $collected): array
{
    return [
        'healthy' => ($collected['alert_key'] ?? '') === 'ok' ? 1 : 0,
        'problem_count' => count(is_array($collected['problems'] ?? null) ? $collected['problems'] : []),
        'webhook_url' => ACCUMUL8_PLAID_WEBHOOK_URL,
        'connections' => is_array($collected['connections'] ?? null) ? $collected['connections'] : [],
    ];
}

function accumul8_plaid_run_health(int $viewerId, bool $probe): array
{
    $collected = accumul8_plaid_collect_health($viewerId, $probe);
    $secretKey = accumul8_plaid_health_alert_secret_key($viewerId);
    $previous = trim((string)(secret_get($secretKey) ?? ''));
    $decision = accumul8_plaid_health_email_decision($previous, (string)$collected['alert_key']);
    $emailSent = 0;
    $emailError = '';
    if ($decision !== 'none') {
        try {
            if (!function_exists('catn8_send_email')) {
                throw new RuntimeException('Email sender is not loaded');
            }
            $content = accumul8_plaid_health_email_content($decision, $collected['problems']);
            catn8_send_email(ACCUMUL8_PLAID_HEALTH_ADMIN_EMAIL, 'Jon', $content['subject'], $content['html']);
            if (!secret_set($secretKey, (string)$collected['alert_key'])) {
                $emailError = 'Alert email sent but the dedupe key was not saved';
                error_log('accumul8 plaid health alert key was not saved for owner ' . $viewerId);
            } else {
                $emailSent = 1;
            }
        } catch (Throwable $exception) {
            $emailError = accumul8_plaid_webhook_text($exception->getMessage(), 300);
            error_log('accumul8 plaid health email failed: ' . $emailError);
        }
    }
    return array_merge(accumul8_plaid_public_health($collected), [
        'email_decision' => $decision,
        'email_sent' => $emailSent,
        'email_error' => $emailError,
    ]);
}

function accumul8_plaid_handle_webhook(string $jwt, string $rawBody): array
{
    if (trim($jwt) === '') {
        return ['status' => 401, 'body' => ['success' => false, 'error' => 'Invalid Plaid verification']];
    }
    if (!accumul8_plaid_is_configured()) {
        error_log('accumul8 plaid webhook rejected because Plaid is not configured');
        return ['status' => 401, 'body' => ['success' => false, 'error' => 'Invalid Plaid verification']];
    }
    $verification = accumul8_plaid_verify_incoming_webhook($jwt, $rawBody);
    if (empty($verification['ok'])) {
        error_log('accumul8 plaid webhook rejected: ' . accumul8_plaid_webhook_text((string)($verification['error'] ?? ''), 180));
        return ['status' => 401, 'body' => ['success' => false, 'error' => 'Invalid Plaid verification']];
    }
    $payload = json_decode($rawBody, true);
    if (!is_array($payload)) {
        return ['status' => 400, 'body' => ['success' => false, 'error' => 'Invalid JSON body']];
    }
    $effect = accumul8_plaid_classify_webhook($payload);
    if ($effect['item_id'] === '' || $effect['action'] === 'ignore') {
        return ['status' => 200, 'body' => ['success' => true, 'handled' => 'ignored']];
    }
    $connections = accumul8_plaid_connections_for_item($effect['item_id']);
    if ($connections === []) {
        return ['status' => 200, 'body' => ['success' => true, 'handled' => 'unknown_item']];
    }
    $retry = false;
    foreach ($connections as $connection) {
        $viewerId = (int)($connection['owner_user_id'] ?? 0);
        $connectionId = (int)($connection['id'] ?? 0);
        if ($viewerId <= 0 || $connectionId <= 0) {
            continue;
        }
        if ($effect['action'] === 'needs_reauth') {
            accumul8_plaid_mark_needs_reauth($viewerId, $connectionId, (string)$effect['reason']);
            try {
                accumul8_plaid_run_health($viewerId, false);
            } catch (Throwable $exception) {
                error_log('accumul8 plaid health after webhook failed: ' . accumul8_plaid_webhook_text($exception->getMessage(), 300));
            }
            continue;
        }
        if ($effect['action'] !== 'sync') {
            continue;
        }
        try {
            accumul8_sync_transactions_for_connection($viewerId, $viewerId, $connectionId);
        } catch (Throwable $exception) {
            $message = $exception->getMessage();
            try {
                accumul8_plaid_record_sync_failure($viewerId, $connectionId, $message);
            } catch (Throwable $recordError) {
                error_log('accumul8 plaid webhook failure record failed: ' . accumul8_plaid_webhook_text($recordError->getMessage(), 300));
            }
            if (accumul8_plaid_message_needs_reauth($message)) {
                try {
                    accumul8_plaid_run_health($viewerId, false);
                } catch (Throwable $healthError) {
                    error_log('accumul8 plaid health after sync failure failed: ' . accumul8_plaid_webhook_text($healthError->getMessage(), 300));
                }
            } else {
                $retry = true;
            }
            error_log('accumul8 plaid webhook sync failed for connection ' . $connectionId . ': ' . accumul8_plaid_webhook_text($message, 300));
        }
    }
    if ($retry) {
        return ['status' => 500, 'body' => ['success' => false, 'error' => 'Plaid sync failed']];
    }
    return ['status' => 200, 'body' => ['success' => true, 'handled' => (string)$effect['action']]];
}

function accumul8_dispatch_plaid_health(int $viewerId): void
{
    catn8_require_method('GET');
    try {
        $collected = accumul8_plaid_collect_health($viewerId, false);
        catn8_json_response(array_merge(['success' => true], accumul8_plaid_public_health($collected)));
    } catch (Throwable $exception) {
        error_log('accumul8 plaid health read failed: ' . accumul8_plaid_webhook_text($exception->getMessage(), 300));
        catn8_json_response([
            'success' => false,
            'error' => 'Plaid health check failed',
        ], accumul8_exception_http_status($exception));
    }
}
