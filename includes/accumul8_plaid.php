<?php

declare(strict_types=1);

function accumul8_plaid_env(): string
{
    $env = strtolower(accumul8_normalize_text((string)(secret_get(catn8_secret_key('accumul8.plaid.env')) ?? getenv('PLAID_ENV') ?? 'sandbox'), 16));
    if (!in_array($env, ['sandbox', 'production'], true)) {
        $env = 'sandbox';
    }
    return $env;
}

function accumul8_plaid_credentials(): array
{
    $productsRaw = (string)(secret_get(catn8_secret_key('accumul8.plaid.products')) ?? getenv('PLAID_PRODUCTS') ?? 'transactions');
    $countriesRaw = (string)(secret_get(catn8_secret_key('accumul8.plaid.country_codes')) ?? getenv('PLAID_COUNTRY_CODES') ?? 'US');
    $products = array_values(array_filter(array_map(static function ($value): string {
        return strtolower(accumul8_normalize_text($value, 32));
    }, explode(',', $productsRaw))));
    $countries = array_values(array_filter(array_map(static function ($value): string {
        return strtoupper(accumul8_normalize_text($value, 8));
    }, explode(',', $countriesRaw))));
    if ($products === []) {
        $products = ['transactions'];
    }
    if ($countries === []) {
        $countries = ['US'];
    }

    return [
        'client_id' => trim((string)(secret_get(catn8_secret_key('accumul8.plaid.client_id')) ?? getenv('PLAID_CLIENT_ID') ?? '')),
        'secret' => trim((string)(secret_get(catn8_secret_key('accumul8.plaid.secret')) ?? getenv('PLAID_SECRET') ?? '')),
        'env' => accumul8_plaid_env(),
        'products' => $products,
        'country_codes' => $countries,
        'redirect_uri' => trim((string)(secret_get(catn8_secret_key('accumul8.plaid.redirect_uri')) ?? getenv('PLAID_REDIRECT_URI') ?? '')),
    ];
}

function accumul8_plaid_is_configured(): bool
{
    $c = accumul8_plaid_credentials();
    return ($c['client_id'] ?? '') !== '' && ($c['secret'] ?? '') !== '';
}

function accumul8_plaid_host(string $env = ''): string
{
    $env = $env !== '' ? $env : accumul8_plaid_env();
    return $env === 'production' ? 'https://production.plaid.com' : 'https://sandbox.plaid.com';
}

function accumul8_plaid_access_token_secret_key(int $viewerId, string $itemId): string
{
    $safeItem = preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $itemId);
    if (!is_string($safeItem) || $safeItem === '') {
        throw new RuntimeException('Plaid item_id is required for the access token secret key');
    }
    return 'accumul8.plaid.access_token.' . $viewerId . '.' . $safeItem;
}

function accumul8_plaid_request(string $path, array $body = []): array
{
    $creds = accumul8_plaid_credentials();
    if (($creds['client_id'] ?? '') === '' || ($creds['secret'] ?? '') === '') {
        throw new RuntimeException('Plaid is not configured. Set accumul8.plaid.client_id and accumul8.plaid.secret.');
    }

    $payload = array_merge([
        'client_id' => $creds['client_id'],
        'secret' => $creds['secret'],
    ], $body);
    $json = json_encode($payload, JSON_UNESCAPED_SLASHES);
    if (!is_string($json)) {
        throw new RuntimeException('Failed to encode Plaid request JSON');
    }

    $url = rtrim(accumul8_plaid_host((string)$creds['env']), '/') . '/' . ltrim($path, '/');
    $ch = curl_init($url);
    if ($ch === false) {
        throw new RuntimeException('Failed to init curl for Plaid request');
    }

    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    curl_setopt($ch, CURLOPT_TIMEOUT, 45);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Accept: application/json',
        'Plaid-Version: 2020-09-14',
    ]);

    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false) {
        throw new RuntimeException('Plaid request failed: ' . ($err !== '' ? $err : 'unknown error'));
    }

    $decoded = json_decode((string)$raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Plaid returned invalid JSON (HTTP ' . $status . ')');
    }
    if ($status < 200 || $status >= 300) {
        $errorMessage = accumul8_normalize_text((string)($decoded['error_message'] ?? $decoded['error_code'] ?? 'Plaid request failed'), 500);
        throw new RuntimeException($errorMessage !== '' ? $errorMessage : ('Plaid request failed with HTTP ' . $status));
    }
    return $decoded;
}

function accumul8_plaid_account_local_type(array $account): string
{
    $type = strtolower(accumul8_normalize_text((string)($account['type'] ?? ''), 40));
    $subtype = strtolower(accumul8_normalize_text((string)($account['subtype'] ?? ''), 64));
    if ($type === 'credit' || $subtype === 'credit card') {
        return 'credit';
    }
    if ($type === 'loan' || in_array($subtype, ['mortgage', 'student', 'auto'], true)) {
        return 'loan';
    }
    if ($subtype === 'savings' || $subtype === 'money market') {
        return 'savings';
    }
    if ($type === 'investment' || $subtype === 'brokerage') {
        return 'investment';
    }
    return 'checking';
}

function accumul8_plaid_normalize_transaction_amount(array $tx): float
{
    // Plaid: positive amount leaves the account. Accumul8: outflow is negative.
    $amount = round(-1 * accumul8_normalize_amount($tx['amount'] ?? 0), 2);
    $name = strtolower(trim((string)($tx['merchant_name'] ?? $tx['name'] ?? '')));
    $category = strtolower(implode(' ', is_array($tx['category'] ?? null) ? $tx['category'] : []));
    $haystack = $name . ' ' . $category;
    $positiveHint = preg_match('/\b(deposit|payroll|paycheck|direct dep|adc|trs|interest paid|refund|credit)\b/i', $haystack) === 1;
    $negativeHint = preg_match('/\b(withdrawal|purchase|payment|debit|fee|pos)\b/i', $haystack) === 1;
    if ($positiveHint && $amount < 0) {
        return round(abs($amount), 2);
    }
    if ($negativeHint && !$positiveHint && $amount > 0) {
        return round(-abs($amount), 2);
    }
    return $amount;
}


function accumul8_plaid_normalize_institution_key(string $value): string
{
    $value = strtolower(accumul8_normalize_text($value, 191));
    $value = preg_replace('/[^a-z0-9]+/', '', $value) ?? $value;
    return $value;
}

function accumul8_plaid_institutions_match(string $leftId, string $leftName, string $rightId, string $rightName): bool
{
    $leftId = strtolower(accumul8_normalize_text($leftId, 64));
    $rightId = strtolower(accumul8_normalize_text($rightId, 64));
    if ($leftId !== '' && $rightId !== '' && $leftId === $rightId) {
        return true;
    }
    $leftKey = accumul8_plaid_normalize_institution_key($leftName);
    $rightKey = accumul8_plaid_normalize_institution_key($rightName);
    if ($leftKey === '' || $rightKey === '') {
        return false;
    }
    if ($leftKey === $rightKey) {
        return true;
    }
    if (strlen($leftKey) >= 8 && strlen($rightKey) >= 8 && (str_contains($leftKey, $rightKey) || str_contains($rightKey, $leftKey))) {
        return true;
    }
    return false;
}


function accumul8_persist_account_current_balance(int $viewerId, int $accountId, float $currentBalance, float $availableBalance): void
{
    if ($viewerId <= 0 || $accountId <= 0) {
        return;
    }
    Database::execute(
        'UPDATE accumul8_accounts
         SET current_balance = ?, available_balance = ?, updated_at = NOW()
         WHERE id = ? AND owner_user_id = ?',
        [round($currentBalance, 2), round($availableBalance, 2), $accountId, $viewerId]
    );
}

function accumul8_upsert_plaid_account(int $viewerId, int $connectionId, array $connection, array $account): array
{
    $remoteAccountId = accumul8_normalize_text((string)($account['account_id'] ?? ''), 191);
    if ($remoteAccountId === '') {
        throw new RuntimeException('Plaid account response is missing account_id');
    }

    $institutionName = accumul8_normalize_text((string)($connection['institution_name'] ?? ''), 191);
    $accountName = accumul8_normalize_text((string)($account['official_name'] ?? $account['name'] ?? ''), 191);
    if ($accountName === '') {
        $accountName = 'Plaid Account';
    }
    $accountType = accumul8_plaid_account_local_type($account);
    $accountSubtype = accumul8_normalize_text((string)($account['subtype'] ?? ''), 64);
    $maskLast4 = accumul8_normalize_text((string)($account['mask'] ?? ''), 8);
    $accountNumberMask = $maskLast4 !== '' ? ('****' . $maskLast4) : '';
    $balances = is_array($account['balances'] ?? null) ? $account['balances'] : [];
    $hasCurrent = array_key_exists('current', $balances) && $balances['current'] !== null && $balances['current'] !== '';
    $hasAvailable = array_key_exists('available', $balances) && $balances['available'] !== null && $balances['available'] !== '';
    $currentBalance = $hasCurrent ? (float)$balances['current'] : 0.0;
    $availableBalance = $hasAvailable ? (float)$balances['available'] : ($hasCurrent ? $currentBalance : 0.0);
    $currencyCode = strtoupper(accumul8_normalize_text((string)($balances['iso_currency_code'] ?? 'USD'), 3));
    if ($currencyCode === '' || !preg_match('/^[A-Z]{3}$/', $currencyCode)) {
        $currencyCode = 'USD';
    }
    $accountGroupId = accumul8_find_or_create_account_group_by_institution($viewerId, $institutionName);
    $itemId = accumul8_normalize_text((string)($connection['plaid_item_id'] ?? ''), 191);

    $existing = Database::queryOne(
        'SELECT id
         FROM accumul8_accounts
         WHERE owner_user_id = ?
           AND provider_name = ?
           AND teller_account_id = ?
         LIMIT 1',
        [$viewerId, 'plaid', $remoteAccountId]
    );

    if (!$existing && $connectionId > 0) {
        $fallbackParams = [$viewerId, $connectionId, $accountName, $accountType];
        $fallbackWhere = '
         WHERE owner_user_id = ?
           AND bank_connection_id = ?
           AND account_name = ?
           AND account_type = ?';
        if ($maskLast4 !== '') {
            $fallbackWhere .= '
           AND COALESCE(mask_last4, "") = ?';
            $fallbackParams[] = $maskLast4;
        }
        $existing = Database::queryOne(
            'SELECT id FROM accumul8_accounts' . $fallbackWhere . ' ORDER BY id ASC LIMIT 1',
            $fallbackParams
        );
    }

    // Same-institution mask match only. Never attach another institution\'s account to this item.
    if (!$existing && $maskLast4 !== '') {
        $institutionId = accumul8_normalize_text((string)($connection['institution_id'] ?? ''), 64);
        $candidate = Database::queryOne(
            'SELECT a.id, a.institution_name, a.bank_connection_id,
                    c.institution_id AS connection_institution_id,
                    c.institution_name AS connection_institution_name
             FROM accumul8_accounts a
             LEFT JOIN accumul8_bank_connections c ON c.id = a.bank_connection_id
             WHERE a.owner_user_id = ?
               AND COALESCE(a.mask_last4, "") = ?
             ORDER BY a.id ASC
             LIMIT 1',
            [$viewerId, $maskLast4]
        );
        if ($candidate) {
            $candidateName = (string)($candidate['institution_name'] ?? '');
            $connectionName = (string)($candidate['connection_institution_name'] ?? '');
            $connectionInstId = (string)($candidate['connection_institution_id'] ?? '');
            $nameToCompare = $connectionName !== '' ? $connectionName : $candidateName;
            $sameInstitution = accumul8_plaid_institutions_match($connectionInstId, $nameToCompare, $institutionId, $institutionName)
                || accumul8_plaid_institutions_match('', $candidateName, $institutionId, $institutionName);
            if ($sameInstitution) {
                $existing = $candidate;
            }
        }
    }

    if ($existing) {
        $applyRemoteBalances = $hasCurrent || $hasAvailable;
        $balanceSql = $applyRemoteBalances ? ', current_balance = ?, available_balance = ?' : '';
        $balanceParams = $applyRemoteBalances ? [$currentBalance, $availableBalance] : [];
        Database::execute(
            'UPDATE accumul8_accounts
             SET account_group_id = ?, bank_connection_id = ?, provider_name = ?, teller_account_id = ?, teller_enrollment_id = ?,
                 account_name = ?, account_type = ?, account_subtype = ?, institution_name = ?, account_number_mask = ?,
                 mask_last4 = ?, currency_code = ?' . $balanceSql . ', is_active = 1, updated_at = NOW()
             WHERE id = ? AND owner_user_id = ?',
            array_merge(
                [
                    $accountGroupId,
                    $connectionId,
                    'plaid',
                    $remoteAccountId,
                    $itemId === '' ? null : $itemId,
                    $accountName,
                    $accountType,
                    $accountSubtype,
                    $institutionName,
                    $accountNumberMask,
                    $maskLast4,
                    $currencyCode,
                ],
                $balanceParams,
                [(int)$existing['id'], $viewerId]
            )
        );
        if ($applyRemoteBalances) {
            accumul8_persist_account_current_balance($viewerId, (int)$existing['id'], $currentBalance, $availableBalance);
        }
        return [
            'local_account_id' => (int)$existing['id'],
            'local_account_name' => $accountName,
            'remote_account_id' => $remoteAccountId,
            'remote_account_name' => $accountName,
            'remote_account_type' => $accountType,
            'remote_account_subtype' => $accountSubtype,
            'mask_last4' => $maskLast4,
            'institution_name' => $institutionName,
            'mapping_action' => 'updated',
            'current_balance' => $currentBalance,
            'available_balance' => $availableBalance,
        ];
    }

    Database::execute(
        'INSERT INTO accumul8_accounts
            (owner_user_id, account_group_id, bank_connection_id, provider_name, teller_account_id, teller_enrollment_id, account_name, account_type, account_subtype, institution_name, account_number_mask, mask_last4, currency_code, current_balance, available_balance, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
        [
            $viewerId,
            $accountGroupId,
            $connectionId,
            'plaid',
            $remoteAccountId,
            $itemId === '' ? null : $itemId,
            $accountName,
            $accountType,
            $accountSubtype,
            $institutionName,
            $accountNumberMask,
            $maskLast4,
            $currencyCode,
            $currentBalance,
            $availableBalance,
        ]
    );

    $localAccountId = (int)Database::lastInsertId();
    return [
        'local_account_id' => $localAccountId,
        'local_account_name' => $accountName,
        'remote_account_id' => $remoteAccountId,
        'remote_account_name' => $accountName,
        'remote_account_type' => $accountType,
        'remote_account_subtype' => $accountSubtype,
        'mask_last4' => $maskLast4,
        'institution_name' => $institutionName,
        'mapping_action' => 'created',
        'current_balance' => $currentBalance,
        'available_balance' => $availableBalance,
    ];
}

function accumul8_plaid_create_link_token(int $viewerId, ?string $existingItemId = null): array
{
    if (!accumul8_plaid_is_configured()) {
        throw new RuntimeException('Plaid is not configured. Save Client ID and Secret in Settings first.');
    }
    $creds = accumul8_plaid_credentials();
    $body = [
        'client_name' => 'Accumul8',
        'language' => 'en',
        'country_codes' => $creds['country_codes'],
        'user' => [
            'client_user_id' => 'accumul8-' . $viewerId,
        ],
    ];
    if ($existingItemId) {
        $secretKey = accumul8_plaid_access_token_secret_key($viewerId, $existingItemId);
        $accessToken = trim((string)(secret_get($secretKey) ?? ''));
        if ($accessToken === '') {
            throw new RuntimeException('Stored Plaid access token was not found for reconnect');
        }
        $body['access_token'] = $accessToken;
    } else {
        $body['products'] = $creds['products'];
    }
    if (($creds['redirect_uri'] ?? '') !== '') {
        $body['redirect_uri'] = $creds['redirect_uri'];
    }
    $res = accumul8_plaid_request('/link/token/create', $body);
    $linkToken = accumul8_normalize_text((string)($res['link_token'] ?? ''), 512);
    if ($linkToken === '') {
        throw new RuntimeException('Plaid did not return a link_token');
    }
    return [
        'link_token' => $linkToken,
        'expiration' => (string)($res['expiration'] ?? ''),
        'environment' => (string)$creds['env'],
        'request_id' => (string)($res['request_id'] ?? ''),
        'redirect_uri' => (string)($creds['redirect_uri'] ?? ''),
    ];
}

function accumul8_plaid_exchange_public_token(int $viewerId, string $publicToken, array $metadata = []): array
{
    $publicToken = accumul8_normalize_text($publicToken, 512);
    if ($publicToken === '') {
        throw new RuntimeException('public_token is required');
    }
    $exchange = accumul8_plaid_request('/item/public_token/exchange', [
        'public_token' => $publicToken,
    ]);
    $accessToken = trim((string)($exchange['access_token'] ?? ''));
    $itemId = accumul8_normalize_text((string)($exchange['item_id'] ?? ''), 191);
    if ($accessToken === '' || $itemId === '') {
        throw new RuntimeException('Plaid exchange did not return access_token and item_id');
    }

    $institution = is_array($metadata['institution'] ?? null) ? $metadata['institution'] : [];
    $institutionId = accumul8_normalize_text((string)($institution['institution_id'] ?? $metadata['institution_id'] ?? ''), 64);
    $institutionName = accumul8_normalize_text((string)($institution['name'] ?? $metadata['institution_name'] ?? ''), 191);
    $existingConnectionId = (int)($metadata['existing_connection_id'] ?? 0);

    if ($institutionId !== '' && $institutionName === '') {
        try {
            $inst = accumul8_plaid_request('/institutions/get_by_id', [
                'institution_id' => $institutionId,
                'country_codes' => accumul8_plaid_credentials()['country_codes'],
            ]);
            $institutionName = accumul8_normalize_text((string)(($inst['institution']['name'] ?? '')), 191);
        } catch (Throwable $e) {
            // Institution name is optional; keep the connection even if lookup fails.
        }
    }

    $secretKey = accumul8_plaid_access_token_secret_key($viewerId, $itemId);
    if (!secret_set($secretKey, $accessToken)) {
        throw new RuntimeException('Failed to persist Plaid access token');
    }

    $existing = null;
    if ($existingConnectionId > 0) {
        $candidate = Database::queryOne(
            'SELECT id, plaid_access_token_secret_key, plaid_item_id, institution_id, institution_name
             FROM accumul8_bank_connections
             WHERE id = ? AND owner_user_id = ?
             LIMIT 1',
            [$existingConnectionId, $viewerId]
        );
        if ($candidate) {
            $candidateItemId = accumul8_normalize_text((string)($candidate['plaid_item_id'] ?? ''), 191);
            $sameItem = $candidateItemId !== '' && $candidateItemId === $itemId;
            $sameInstitution = accumul8_plaid_institutions_match(
                (string)($candidate['institution_id'] ?? ''),
                (string)($candidate['institution_name'] ?? ''),
                $institutionId,
                $institutionName
            );
            // Reuse only for the same Plaid item or the same institution (Teller -> Plaid upgrade).
            // A Reconnect click must not overwrite Navy Federal with a Barclays item.
            if ($sameItem || $sameInstitution) {
                $existing = $candidate;
            }
        }
    }
    if (!$existing) {
        $existing = Database::queryOne(
            'SELECT id, plaid_access_token_secret_key
             FROM accumul8_bank_connections
             WHERE owner_user_id = ?
               AND provider_name = ?
               AND plaid_item_id = ?
             LIMIT 1',
            [$viewerId, 'plaid', $itemId]
        );
    }

    if ($existing) {
        $previousSecretKey = accumul8_normalize_text((string)($existing['plaid_access_token_secret_key'] ?? ''), 191);
        Database::execute(
            'UPDATE accumul8_bank_connections
             SET provider_name = ?, institution_id = ?, institution_name = ?, plaid_item_id = ?, plaid_access_token_secret_key = ?, status = ?, last_error = NULL, updated_at = NOW()
             WHERE id = ? AND owner_user_id = ?',
            [
                'plaid',
                $institutionId === '' ? null : $institutionId,
                $institutionName === '' ? null : $institutionName,
                $itemId,
                $secretKey,
                'connected',
                (int)$existing['id'],
                $viewerId,
            ]
        );
        $connectionId = (int)$existing['id'];
        if ($previousSecretKey !== '' && $previousSecretKey !== $secretKey) {
            secret_delete($previousSecretKey);
        }
    } else {
        Database::execute(
            'INSERT INTO accumul8_bank_connections
                (owner_user_id, provider_name, institution_id, institution_name, plaid_item_id, plaid_access_token_secret_key, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                $viewerId,
                'plaid',
                $institutionId === '' ? null : $institutionId,
                $institutionName === '' ? null : $institutionName,
                $itemId,
                $secretKey,
                'connected',
            ]
        );
        $connectionId = (int)Database::lastInsertId();
    }

    return [
        'connection_id' => $connectionId,
        'item_id' => $itemId,
        'institution_id' => $institutionId,
        'institution_name' => $institutionName,
    ];
}

function accumul8_plaid_upsert_transaction(
    int $viewerId,
    int $actorUserId,
    int $localAccountId,
    string $remoteAccountId,
    array $tx
): string {
    $externalId = accumul8_normalize_text((string)($tx['transaction_id'] ?? ''), 191);
    if ($externalId === '') {
        return 'unchanged';
    }
    $date = accumul8_normalize_date($tx['date'] ?? $tx['authorized_date'] ?? null);
    if ($date === null) {
        return 'unchanged';
    }
    $description = accumul8_normalize_text((string)($tx['merchant_name'] ?? $tx['name'] ?? 'Plaid transaction'), 255);
    if ($description === '') {
        $description = 'Plaid transaction';
    }
    $amount = accumul8_plaid_normalize_transaction_amount($tx);
    $pending = !empty($tx['pending']) ? 1 : 0;
    $entityId = accumul8_find_matching_entity_id($viewerId, $description);

    $existing = Database::queryOne(
        'SELECT id FROM accumul8_transactions
         WHERE owner_user_id = ? AND source_kind = ? AND external_id = ?
         LIMIT 1',
        [$viewerId, 'plaid', $externalId]
    );

    if ($existing) {
        Database::execute(
            'UPDATE accumul8_transactions
             SET account_id = ?, entity_id = ?, transaction_date = ?, due_date = ?, description = ?, amount = ?,
                 is_paid = 1, is_reconciled = 1, source_kind = ?, source_ref = ?, pending_status = ?, paid_date = ?, updated_at = NOW()
             WHERE id = ? AND owner_user_id = ?',
            [
                $localAccountId,
                $entityId,
                $date,
                $date,
                $description,
                $amount,
                'plaid',
                $remoteAccountId,
                $pending,
                $pending ? null : $date,
                (int)$existing['id'],
                $viewerId,
            ]
        );
        return 'modified';
    }

    Database::execute(
        'INSERT INTO accumul8_transactions
            (owner_user_id, account_id, entity_id, transaction_date, due_date, entry_type, description, amount,
             is_paid, is_reconciled, is_budget_planner, source_kind, source_ref, external_id, pending_status, paid_date, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $viewerId,
            $localAccountId,
            $entityId,
            $date,
            $date,
            'manual',
            $description,
            $amount,
            1,
            1,
            0,
            'plaid',
            $remoteAccountId,
            $externalId,
            $pending,
            $pending ? null : $date,
            $actorUserId,
        ]
    );
    return 'added';
}

function accumul8_plaid_sync_transactions_for_connection(int $viewerId, int $actorUserId, int $connectionId): array
{
    $itemIdSelect = accumul8_optional_select('accumul8_bank_connections', 'plaid_item_id', 'plaid_item_id', 'NULL AS plaid_item_id');
    $cursorSelect = accumul8_optional_select('accumul8_bank_connections', 'plaid_transactions_cursor', 'plaid_transactions_cursor', 'NULL AS plaid_transactions_cursor');
    $secretSelect = accumul8_optional_select('accumul8_bank_connections', 'plaid_access_token_secret_key', 'plaid_access_token_secret_key', 'NULL AS plaid_access_token_secret_key');
    $connection = Database::queryOne(
        'SELECT id, institution_id, institution_name, ' . $itemIdSelect . ', ' . $cursorSelect . ', ' . $secretSelect . '
         FROM accumul8_bank_connections
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$connectionId, $viewerId]
    );
    if (!$connection) {
        throw new RuntimeException('Connection not found');
    }

    $itemId = accumul8_normalize_text((string)($connection['plaid_item_id'] ?? ''), 191);
    $secretKey = accumul8_normalize_text((string)($connection['plaid_access_token_secret_key'] ?? ''), 191);
    if ($secretKey === '' && $itemId !== '') {
        $secretKey = accumul8_plaid_access_token_secret_key($viewerId, $itemId);
    }
    $accessToken = trim((string)(secret_get($secretKey) ?? ''));
    if ($accessToken === '') {
        throw new RuntimeException('Stored Plaid access token was not found');
    }

    $balanceRes = accumul8_plaid_request('/accounts/balance/get', [
        'access_token' => $accessToken,
    ]);
    $remoteAccounts = is_array($balanceRes['accounts'] ?? null) ? $balanceRes['accounts'] : [];
    $item = is_array($balanceRes['item'] ?? null) ? $balanceRes['item'] : [];
    if ($itemId === '') {
        $itemId = accumul8_normalize_text((string)($item['item_id'] ?? ''), 191);
    }
    $institutionId = accumul8_normalize_text((string)($connection['institution_id'] ?? $item['institution_id'] ?? ''), 64);
    $institutionName = accumul8_normalize_text((string)($connection['institution_name'] ?? ''), 191);
    if ($institutionName === '' && $institutionId !== '') {
        try {
            $inst = accumul8_plaid_request('/institutions/get_by_id', [
                'institution_id' => $institutionId,
                'country_codes' => accumul8_plaid_credentials()['country_codes'],
            ]);
            $institutionName = accumul8_normalize_text((string)(($inst['institution']['name'] ?? '')), 191);
        } catch (Throwable $e) {
            $institutionName = $institutionId;
        }
    }
    $connection['plaid_item_id'] = $itemId;
    $connection['institution_name'] = $institutionName;

    $accountMap = [];
    $accountSummaries = [];
    foreach ($remoteAccounts as $account) {
        if (!is_array($account)) {
            continue;
        }
        $mapped = accumul8_upsert_plaid_account($viewerId, $connectionId, $connection, $account);
        $accountMap[(string)$mapped['remote_account_id']] = $mapped;
        $accountSummaries[] = array_merge($mapped, [
            'transactions_supported' => 1,
            'balances_supported' => 1,
            'details_supported' => 1,
            'sync_skipped_reason' => '',
            'history_start_date' => '',
            'history_end_date' => '',
            'transactions_added' => 0,
            'transactions_modified' => 0,
            'transactions_unchanged' => 0,
            'transactions_removed' => 0,
            'stale_teller_removed' => 0,
            'statement_imports_removed' => 0,
            'backfill_complete' => 1,
            'backfill_pages_fetched' => 0,
            'backfill_cursor_id' => '',
            'recent_window_start_date' => '',
            'recent_window_end_date' => '',
        ]);
    }

    $added = 0;
    $modified = 0;
    $unchanged = 0;
    $removed = 0;
    $cursor = (string)($connection['plaid_transactions_cursor'] ?? '');
    $hasMore = true;
    $pages = 0;
    while ($hasMore && $pages < 20) {
        $pages++;
        $syncBody = [
            'access_token' => $accessToken,
            'count' => 500,
        ];
        if ($cursor !== '') {
            $syncBody['cursor'] = $cursor;
        }
        $sync = accumul8_plaid_request('/transactions/sync', $syncBody);
        foreach ((is_array($sync['added'] ?? null) ? $sync['added'] : []) as $tx) {
            if (!is_array($tx)) {
                continue;
            }
            $remoteAccountId = accumul8_normalize_text((string)($tx['account_id'] ?? ''), 191);
            $mapped = $accountMap[$remoteAccountId] ?? null;
            if (!$mapped) {
                $unchanged++;
                continue;
            }
            $result = accumul8_plaid_upsert_transaction($viewerId, $actorUserId, (int)$mapped['local_account_id'], $remoteAccountId, $tx);
            if ($result === 'added') {
                $added++;
                $accountSummaries = accumul8_plaid_bump_account_stat($accountSummaries, $remoteAccountId, 'transactions_added');
            } elseif ($result === 'modified') {
                $modified++;
                $accountSummaries = accumul8_plaid_bump_account_stat($accountSummaries, $remoteAccountId, 'transactions_modified');
            } else {
                $unchanged++;
                $accountSummaries = accumul8_plaid_bump_account_stat($accountSummaries, $remoteAccountId, 'transactions_unchanged');
            }
        }
        foreach ((is_array($sync['modified'] ?? null) ? $sync['modified'] : []) as $tx) {
            if (!is_array($tx)) {
                continue;
            }
            $remoteAccountId = accumul8_normalize_text((string)($tx['account_id'] ?? ''), 191);
            $mapped = $accountMap[$remoteAccountId] ?? null;
            if (!$mapped) {
                $unchanged++;
                continue;
            }
            $result = accumul8_plaid_upsert_transaction($viewerId, $actorUserId, (int)$mapped['local_account_id'], $remoteAccountId, $tx);
            if ($result === 'added') {
                $added++;
                $accountSummaries = accumul8_plaid_bump_account_stat($accountSummaries, $remoteAccountId, 'transactions_added');
            } elseif ($result === 'modified') {
                $modified++;
                $accountSummaries = accumul8_plaid_bump_account_stat($accountSummaries, $remoteAccountId, 'transactions_modified');
            } else {
                $unchanged++;
            }
        }
        foreach ((is_array($sync['removed'] ?? null) ? $sync['removed'] : []) as $tx) {
            $externalId = accumul8_normalize_text((string)($tx['transaction_id'] ?? ''), 191);
            if ($externalId === '') {
                continue;
            }
            $row = Database::queryOne(
                'SELECT id FROM accumul8_transactions
                 WHERE owner_user_id = ? AND source_kind = ? AND external_id = ?
                 LIMIT 1',
                [$viewerId, 'plaid', $externalId]
            );
            if ($row) {
                $removed += accumul8_delete_transactions_by_ids($viewerId, [(int)$row['id']]);
            }
        }
        $cursor = (string)($sync['next_cursor'] ?? $cursor);
        $hasMore = !empty($sync['has_more']);
    }

    Database::execute(
        'UPDATE accumul8_bank_connections
         SET institution_id = ?, institution_name = ?, plaid_item_id = ?, plaid_transactions_cursor = ?, plaid_access_token_secret_key = ?, status = ?, last_sync_at = NOW(), last_error = NULL, updated_at = NOW()
         WHERE id = ? AND owner_user_id = ?',
        [
            $institutionId === '' ? null : $institutionId,
            $institutionName === '' ? null : $institutionName,
            $itemId === '' ? null : $itemId,
            $cursor === '' ? null : $cursor,
            $secretKey === '' ? null : $secretKey,
            'connected',
            $connectionId,
            $viewerId,
        ]
    );

    return [
        'added' => $added,
        'modified' => $modified,
        'unchanged' => $unchanged,
        'removed' => $removed,
        'accounts' => $accountSummaries,
    ];
}

function accumul8_plaid_bump_account_stat(array $summaries, string $remoteAccountId, string $key): array
{
    foreach ($summaries as $index => $summary) {
        if ((string)($summary['remote_account_id'] ?? '') === $remoteAccountId) {
            $summaries[$index][$key] = (int)($summaries[$index][$key] ?? 0) + 1;
            break;
        }
    }
    return $summaries;
}

function accumul8_sync_transactions_for_connection(int $viewerId, int $actorUserId, int $connectionId): array
{
    $itemIdSelect = accumul8_optional_select('accumul8_bank_connections', 'plaid_item_id', 'plaid_item_id', 'NULL AS plaid_item_id');
    $sourceKindSelect = accumul8_optional_select('accumul8_bank_connections', 'source_kind', 'source_kind', 'NULL AS source_kind');
    $row = Database::queryOne(
        'SELECT provider_name, ' . $itemIdSelect . ', ' . $sourceKindSelect . '
         FROM accumul8_bank_connections
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$connectionId, $viewerId]
    );
    if (!$row) {
        throw new RuntimeException('Connection not found');
    }
    $provider = strtolower(accumul8_normalize_text((string)($row['provider_name'] ?? ''), 32));
    $itemId = accumul8_normalize_text((string)($row['plaid_item_id'] ?? ''), 191);
    $sourceKind = strtolower(accumul8_normalize_text((string)($row['source_kind'] ?? ''), 32));
    $isPlaid = ($provider === 'plaid' || $itemId !== '' || $sourceKind === 'plaid');
    if (!$isPlaid) {
        $plaidAccount = Database::queryOne(
            'SELECT id
             FROM accumul8_accounts
             WHERE owner_user_id = ?
               AND bank_connection_id = ?
               AND provider_name = ?
             LIMIT 1',
            [$viewerId, $connectionId, 'plaid']
        );
        if ($plaidAccount) {
            $isPlaid = true;
        }
    }
    if ($isPlaid) {
        return accumul8_plaid_sync_transactions_for_connection($viewerId, $actorUserId, $connectionId);
    }
    return accumul8_teller_sync_transactions_for_connection($viewerId, $actorUserId, $connectionId);
}
