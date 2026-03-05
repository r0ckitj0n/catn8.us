<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/emailer.php';

catn8_session_start();
catn8_groups_seed_core();
$viewerId = catn8_require_group_or_admin('accumul8-users');

function accumul8_normalize_text($value, int $maxLen = 191): string
{
    $v = trim((string)$value);
    if ($v === '') return '';
    $v = preg_replace('/\s+/', ' ', $v);
    if (!is_string($v)) return '';
    if ($maxLen > 0 && strlen($v) > $maxLen) {
        $v = substr($v, 0, $maxLen);
    }
    return trim($v);
}

function accumul8_normalize_amount($value): float
{
    if (is_string($value)) {
        $value = str_replace([',', '$'], '', $value);
    }
    $n = (float)$value;
    if (!is_finite($n)) return 0.0;
    return round($n, 2);
}

function accumul8_normalize_bool($value): int
{
    if ($value === true || $value === 1 || $value === '1' || $value === 'true' || $value === 'yes' || $value === 'on') {
        return 1;
    }
    return 0;
}

function accumul8_normalize_date($value): ?string
{
    $raw = trim((string)$value);
    if ($raw === '') return null;
    $ts = strtotime($raw);
    if ($ts === false) return null;
    return date('Y-m-d', $ts);
}

function accumul8_require_valid_date(string $fieldName, $value): string
{
    $d = accumul8_normalize_date($value);
    if ($d === null) {
        catn8_json_response(['success' => false, 'error' => 'Invalid ' . $fieldName], 400);
    }
    return $d;
}

function accumul8_validate_enum(string $fieldName, $value, array $allowed, string $fallback): string
{
    $v = strtolower(accumul8_normalize_text($value, 64));
    if ($v === '') $v = $fallback;
    if (!in_array($v, $allowed, true)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid ' . $fieldName], 400);
    }
    return $v;
}

function accumul8_table_has_column(string $tableName, string $columnName): bool
{
    $rows = Database::queryAll('SHOW COLUMNS FROM `' . $tableName . '` LIKE ?', [$columnName]);
    return !empty($rows);
}

function accumul8_table_has_index(string $tableName, string $indexName): bool
{
    $rows = Database::queryAll('SHOW INDEX FROM `' . $tableName . '` WHERE Key_name = ?', [$indexName]);
    return !empty($rows);
}

function accumul8_table_has_foreign_key(string $tableName, string $constraintName): bool
{
    $rows = Database::queryAll('SHOW CREATE TABLE `' . $tableName . '`');
    if (!$rows) {
        return false;
    }
    $first = (array)$rows[0];
    $createSql = (string)($first['Create Table'] ?? $first['Create View'] ?? '');
    if ($createSql === '') {
        return false;
    }
    return stripos($createSql, 'CONSTRAINT `' . $constraintName . '`') !== false;
}

function accumul8_owned_id_or_null(string $entityType, int $viewerId, int $id): ?int
{
    if ($id <= 0) {
        return null;
    }
    $tableByType = [
        'contacts' => 'accumul8_contacts',
        'accounts' => 'accumul8_accounts',
        'debtors' => 'accumul8_debtors',
    ];
    $tableName = $tableByType[$entityType] ?? '';
    if ($tableName === '') {
        return null;
    }
    $row = Database::queryOne(
        'SELECT id FROM `' . $tableName . '` WHERE id = ? AND owner_user_id = ? LIMIT 1',
        [$id, $viewerId]
    );
    return $row ? $id : null;
}

function accumul8_tables_ensure(): void
{
    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        account_name VARCHAR(191) NOT NULL,
        account_type VARCHAR(40) NOT NULL DEFAULT 'checking',
        institution_name VARCHAR(191) NOT NULL DEFAULT '',
        mask_last4 VARCHAR(8) NOT NULL DEFAULT '',
        current_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        available_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_accumul8_accounts_owner (owner_user_id),
        CONSTRAINT fk_accumul8_accounts_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_contacts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        contact_name VARCHAR(191) NOT NULL,
        contact_type VARCHAR(16) NOT NULL DEFAULT 'both',
        default_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        email VARCHAR(191) NULL,
        notes TEXT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_accumul8_contacts_owner (owner_user_id),
        KEY idx_accumul8_contacts_name (contact_name),
        CONSTRAINT fk_accumul8_contacts_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_debtors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        contact_id INT NULL,
        debtor_name VARCHAR(191) NOT NULL,
        notes TEXT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_accumul8_debtors_owner (owner_user_id),
        KEY idx_accumul8_debtors_contact (contact_id),
        KEY idx_accumul8_debtors_name (debtor_name),
        CONSTRAINT fk_accumul8_debtors_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_accumul8_debtors_contact FOREIGN KEY (contact_id) REFERENCES accumul8_contacts(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_budget_rows (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        row_order INT NOT NULL DEFAULT 0,
        category_name VARCHAR(191) NOT NULL,
        monthly_budget DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        match_pattern VARCHAR(191) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_accumul8_budget_owner (owner_user_id, row_order, id),
        CONSTRAINT fk_accumul8_budget_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_recurring_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        contact_id INT NULL,
        account_id INT NULL,
        title VARCHAR(191) NOT NULL,
        direction VARCHAR(16) NOT NULL DEFAULT 'outflow',
        amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        frequency VARCHAR(16) NOT NULL DEFAULT 'monthly',
        interval_count INT NOT NULL DEFAULT 1,
        day_of_month INT NULL,
        day_of_week INT NULL,
        next_due_date DATE NOT NULL,
        notes TEXT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_accumul8_recurring_owner (owner_user_id),
        KEY idx_accumul8_recurring_next_due (next_due_date),
        CONSTRAINT fk_accumul8_recurring_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_accumul8_recurring_contact FOREIGN KEY (contact_id) REFERENCES accumul8_contacts(id) ON DELETE SET NULL,
        CONSTRAINT fk_accumul8_recurring_account FOREIGN KEY (account_id) REFERENCES accumul8_accounts(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_transactions (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        account_id INT NULL,
        contact_id INT NULL,
        transaction_date DATE NOT NULL,
        due_date DATE NULL,
        entry_type VARCHAR(24) NOT NULL DEFAULT 'manual',
        description VARCHAR(255) NOT NULL,
        memo TEXT NULL,
        amount DECIMAL(10,2) NOT NULL,
        rta_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        running_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        is_paid TINYINT(1) NOT NULL DEFAULT 0,
        is_reconciled TINYINT(1) NOT NULL DEFAULT 0,
        is_recurring_instance TINYINT(1) NOT NULL DEFAULT 0,
        recurring_payment_id INT NULL,
        source_kind VARCHAR(24) NOT NULL DEFAULT 'manual',
        source_ref VARCHAR(191) NULL,
        external_id VARCHAR(191) NULL,
        pending_status TINYINT(1) NOT NULL DEFAULT 0,
        created_by_user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_accumul8_tx_owner_date (owner_user_id, transaction_date),
        KEY idx_accumul8_tx_due (due_date),
        KEY idx_accumul8_tx_paid (is_paid),
        UNIQUE KEY uniq_accumul8_external (owner_user_id, source_kind, external_id),
        CONSTRAINT fk_accumul8_tx_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_accumul8_tx_contact FOREIGN KEY (contact_id) REFERENCES accumul8_contacts(id) ON DELETE SET NULL,
        CONSTRAINT fk_accumul8_tx_account FOREIGN KEY (account_id) REFERENCES accumul8_accounts(id) ON DELETE SET NULL,
        CONSTRAINT fk_accumul8_tx_recurring FOREIGN KEY (recurring_payment_id) REFERENCES accumul8_recurring_payments(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_notification_rules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        rule_name VARCHAR(191) NOT NULL,
        trigger_type VARCHAR(32) NOT NULL DEFAULT 'upcoming_due',
        days_before_due INT NOT NULL DEFAULT 3,
        target_scope VARCHAR(16) NOT NULL DEFAULT 'group',
        custom_user_ids_json LONGTEXT NULL,
        email_subject_template VARCHAR(255) NOT NULL,
        email_body_template TEXT NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        last_triggered_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_accumul8_notif_owner (owner_user_id),
        CONSTRAINT fk_accumul8_notif_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_notification_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        rule_id INT NULL,
        subject VARCHAR(255) NOT NULL,
        body_excerpt VARCHAR(500) NOT NULL,
        recipients_json LONGTEXT NOT NULL,
        sent_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_accumul8_notif_logs_owner (owner_user_id),
        CONSTRAINT fk_accumul8_notif_logs_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_accumul8_notif_logs_rule FOREIGN KEY (rule_id) REFERENCES accumul8_notification_rules(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_bank_connections (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        provider_name VARCHAR(32) NOT NULL DEFAULT 'plaid',
        institution_id VARCHAR(64) NULL,
        institution_name VARCHAR(191) NULL,
        plaid_item_id VARCHAR(191) NULL,
        plaid_access_token_secret_key VARCHAR(191) NULL,
        plaid_cursor VARCHAR(191) NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'setup_pending',
        last_sync_at DATETIME NULL,
        last_error TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_accumul8_bank_owner (owner_user_id),
        UNIQUE KEY uniq_accumul8_bank_item (owner_user_id, provider_name, plaid_item_id),
        CONSTRAINT fk_accumul8_bank_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    try {
        if (!accumul8_table_has_column('accumul8_transactions', 'debtor_id')) {
            Database::execute('ALTER TABLE accumul8_transactions ADD COLUMN debtor_id INT NULL AFTER contact_id');
        }
        if (!accumul8_table_has_index('accumul8_transactions', 'idx_accumul8_tx_debtor')) {
            Database::execute('ALTER TABLE accumul8_transactions ADD INDEX idx_accumul8_tx_debtor (debtor_id)');
        }
        if (!accumul8_table_has_foreign_key('accumul8_transactions', 'fk_accumul8_tx_debtor')) {
            Database::execute('ALTER TABLE accumul8_transactions ADD CONSTRAINT fk_accumul8_tx_debtor FOREIGN KEY (debtor_id) REFERENCES accumul8_debtors(id) ON DELETE SET NULL');
        }
    } catch (Throwable $e) {
        error_log('accumul8 schema ensure warning: ' . $e->getMessage());
    }
}

function accumul8_get_or_create_default_account(int $viewerId): int
{
    $row = Database::queryOne('SELECT id FROM accumul8_accounts WHERE owner_user_id = ? ORDER BY id ASC LIMIT 1', [$viewerId]);
    if ($row) {
        return (int)($row['id'] ?? 0);
    }

    Database::execute(
        'INSERT INTO accumul8_accounts (owner_user_id, account_name, account_type, institution_name, current_balance, available_balance) VALUES (?, ?, ?, ?, ?, ?)',
        [$viewerId, 'Primary Checking', 'checking', 'Manual', 0.00, 0.00]
    );

    return (int)Database::lastInsertId();
}

function accumul8_list_contacts(int $viewerId): array
{
    $rows = Database::queryAll(
        'SELECT id, contact_name, contact_type, default_amount, email, notes, is_active, created_at, updated_at
         FROM accumul8_contacts
         WHERE owner_user_id = ?
         ORDER BY contact_name ASC, id ASC',
        [$viewerId]
    );

    return array_map(static function (array $r): array {
        return [
            'id' => (int)($r['id'] ?? 0),
            'contact_name' => (string)($r['contact_name'] ?? ''),
            'contact_type' => (string)($r['contact_type'] ?? 'both'),
            'default_amount' => (float)($r['default_amount'] ?? 0),
            'email' => (string)($r['email'] ?? ''),
            'notes' => (string)($r['notes'] ?? ''),
            'is_active' => (int)($r['is_active'] ?? 0),
            'created_at' => (string)($r['created_at'] ?? ''),
            'updated_at' => (string)($r['updated_at'] ?? ''),
        ];
    }, $rows);
}

function accumul8_list_recurring(int $viewerId): array
{
    $rows = Database::queryAll(
        'SELECT rp.id, rp.contact_id, rp.account_id, rp.title, rp.direction, rp.amount, rp.frequency, rp.interval_count,
                rp.day_of_month, rp.day_of_week, rp.next_due_date, rp.notes, rp.is_active,
                c.contact_name, a.account_name
         FROM accumul8_recurring_payments rp
         LEFT JOIN accumul8_contacts c ON c.id = rp.contact_id
         LEFT JOIN accumul8_accounts a ON a.id = rp.account_id
         WHERE rp.owner_user_id = ?
         ORDER BY rp.next_due_date ASC, rp.id ASC',
        [$viewerId]
    );

    return array_map(static function (array $r): array {
        return [
            'id' => (int)($r['id'] ?? 0),
            'contact_id' => isset($r['contact_id']) ? (int)$r['contact_id'] : null,
            'account_id' => isset($r['account_id']) ? (int)$r['account_id'] : null,
            'title' => (string)($r['title'] ?? ''),
            'direction' => (string)($r['direction'] ?? 'outflow'),
            'amount' => (float)($r['amount'] ?? 0),
            'frequency' => (string)($r['frequency'] ?? 'monthly'),
            'interval_count' => (int)($r['interval_count'] ?? 1),
            'day_of_month' => isset($r['day_of_month']) ? (int)$r['day_of_month'] : null,
            'day_of_week' => isset($r['day_of_week']) ? (int)$r['day_of_week'] : null,
            'next_due_date' => (string)($r['next_due_date'] ?? ''),
            'notes' => (string)($r['notes'] ?? ''),
            'is_active' => (int)($r['is_active'] ?? 0),
            'contact_name' => (string)($r['contact_name'] ?? ''),
            'account_name' => (string)($r['account_name'] ?? ''),
        ];
    }, $rows);
}

function accumul8_list_accounts(int $viewerId): array
{
    $rows = Database::queryAll(
        'SELECT id, account_name, account_type, institution_name, mask_last4, current_balance, available_balance, is_active
         FROM accumul8_accounts
         WHERE owner_user_id = ?
         ORDER BY account_name ASC, id ASC',
        [$viewerId]
    );

    return array_map(static function (array $r): array {
        return [
            'id' => (int)($r['id'] ?? 0),
            'account_name' => (string)($r['account_name'] ?? ''),
            'account_type' => (string)($r['account_type'] ?? 'checking'),
            'institution_name' => (string)($r['institution_name'] ?? ''),
            'mask_last4' => (string)($r['mask_last4'] ?? ''),
            'current_balance' => (float)($r['current_balance'] ?? 0),
            'available_balance' => (float)($r['available_balance'] ?? 0),
            'is_active' => (int)($r['is_active'] ?? 0),
        ];
    }, $rows);
}

function accumul8_list_debtors(int $viewerId): array
{
    $rows = Database::queryAll(
        'SELECT d.id, d.contact_id, d.debtor_name, d.notes, d.is_active, d.created_at, d.updated_at,
                c.contact_name,
                COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) AS total_loaned,
                COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) AS total_repaid,
                COALESCE(COUNT(t.id), 0) AS transaction_count,
                MAX(t.transaction_date) AS last_activity_date
         FROM accumul8_debtors d
         LEFT JOIN accumul8_contacts c
           ON c.id = d.contact_id
         LEFT JOIN accumul8_transactions t
           ON t.debtor_id = d.id
          AND t.owner_user_id = d.owner_user_id
         WHERE d.owner_user_id = ?
         GROUP BY d.id, d.contact_id, d.debtor_name, d.notes, d.is_active, d.created_at, d.updated_at, c.contact_name
         ORDER BY d.debtor_name ASC, d.id ASC',
        [$viewerId]
    );

    return array_map(static function (array $r): array {
        $totalLoaned = (float)($r['total_loaned'] ?? 0);
        $totalRepaid = (float)($r['total_repaid'] ?? 0);
        return [
            'id' => (int)($r['id'] ?? 0),
            'contact_id' => isset($r['contact_id']) ? (int)$r['contact_id'] : null,
            'debtor_name' => (string)($r['debtor_name'] ?? ''),
            'notes' => (string)($r['notes'] ?? ''),
            'is_active' => (int)($r['is_active'] ?? 0),
            'total_loaned' => $totalLoaned,
            'total_repaid' => $totalRepaid,
            'outstanding_balance' => round($totalLoaned - $totalRepaid, 2),
            'transaction_count' => (int)($r['transaction_count'] ?? 0),
            'last_activity_date' => (string)($r['last_activity_date'] ?? ''),
            'contact_name' => (string)($r['contact_name'] ?? ''),
        ];
    }, $rows);
}

function accumul8_list_budget_rows(int $viewerId): array
{
    $rows = Database::queryAll(
        'SELECT id, row_order, category_name, monthly_budget, match_pattern, is_active
         FROM accumul8_budget_rows
         WHERE owner_user_id = ?
         ORDER BY row_order ASC, id ASC',
        [$viewerId]
    );

    return array_map(static function (array $r): array {
        return [
            'id' => (int)($r['id'] ?? 0),
            'row_order' => (int)($r['row_order'] ?? 0),
            'category_name' => (string)($r['category_name'] ?? ''),
            'monthly_budget' => (float)($r['monthly_budget'] ?? 0),
            'match_pattern' => (string)($r['match_pattern'] ?? ''),
            'is_active' => (int)($r['is_active'] ?? 0),
        ];
    }, $rows);
}

function accumul8_recompute_running_balance(int $viewerId): void
{
    $rows = Database::queryAll(
        'SELECT id, amount, rta_amount
         FROM accumul8_transactions
         WHERE owner_user_id = ?
         ORDER BY transaction_date ASC, id ASC',
        [$viewerId]
    );

    $balance = 0.0;
    foreach ($rows as $row) {
        $balance += (float)($row['amount'] ?? 0) + (float)($row['rta_amount'] ?? 0);
        Database::execute(
            'UPDATE accumul8_transactions SET running_balance = ? WHERE id = ? AND owner_user_id = ?',
            [round($balance, 2), (int)($row['id'] ?? 0), $viewerId]
        );
    }

    Database::execute(
        'UPDATE accumul8_accounts SET current_balance = ? WHERE owner_user_id = ? AND id = (SELECT t.account_id FROM (SELECT account_id FROM accumul8_transactions WHERE owner_user_id = ? ORDER BY transaction_date DESC, id DESC LIMIT 1) t)',
        [round($balance, 2), $viewerId, $viewerId]
    );
}

function accumul8_list_transactions(int $viewerId, int $limit = 400): array
{
    $limit = max(1, min(1000, $limit));
    $rows = Database::queryAll(
        'SELECT t.id, t.account_id, t.contact_id, t.debtor_id, t.transaction_date, t.due_date, t.entry_type, t.description, t.memo,
                t.amount, t.rta_amount, t.running_balance, t.is_paid, t.is_reconciled, t.source_kind, t.pending_status,
                c.contact_name, a.account_name, d.debtor_name
         FROM accumul8_transactions t
         LEFT JOIN accumul8_contacts c ON c.id = t.contact_id AND c.owner_user_id = t.owner_user_id
         LEFT JOIN accumul8_accounts a ON a.id = t.account_id AND a.owner_user_id = t.owner_user_id
         LEFT JOIN accumul8_debtors d ON d.id = t.debtor_id AND d.owner_user_id = t.owner_user_id
         WHERE t.owner_user_id = ?
         ORDER BY t.transaction_date DESC, t.id DESC
         LIMIT ' . (int)$limit,
        [$viewerId]
    );

    return array_map(static function (array $r): array {
        return [
            'id' => (int)($r['id'] ?? 0),
            'account_id' => isset($r['account_id']) ? (int)$r['account_id'] : null,
            'contact_id' => isset($r['contact_id']) ? (int)$r['contact_id'] : null,
            'debtor_id' => isset($r['debtor_id']) ? (int)$r['debtor_id'] : null,
            'transaction_date' => (string)($r['transaction_date'] ?? ''),
            'due_date' => (string)($r['due_date'] ?? ''),
            'entry_type' => (string)($r['entry_type'] ?? ''),
            'description' => (string)($r['description'] ?? ''),
            'memo' => (string)($r['memo'] ?? ''),
            'amount' => (float)($r['amount'] ?? 0),
            'rta_amount' => (float)($r['rta_amount'] ?? 0),
            'running_balance' => (float)($r['running_balance'] ?? 0),
            'is_paid' => (int)($r['is_paid'] ?? 0),
            'is_reconciled' => (int)($r['is_reconciled'] ?? 0),
            'source_kind' => (string)($r['source_kind'] ?? ''),
            'pending_status' => (int)($r['pending_status'] ?? 0),
            'contact_name' => (string)($r['contact_name'] ?? ''),
            'account_name' => (string)($r['account_name'] ?? ''),
            'debtor_name' => (string)($r['debtor_name'] ?? ''),
        ];
    }, $rows);
}

function accumul8_list_notification_rules(int $viewerId): array
{
    $rows = Database::queryAll(
        'SELECT id, rule_name, trigger_type, days_before_due, target_scope, custom_user_ids_json,
                email_subject_template, email_body_template, is_active, last_triggered_at
         FROM accumul8_notification_rules
         WHERE owner_user_id = ?
         ORDER BY is_active DESC, rule_name ASC, id ASC',
        [$viewerId]
    );

    return array_map(static function (array $r): array {
        $json = json_decode((string)($r['custom_user_ids_json'] ?? '[]'), true);
        return [
            'id' => (int)($r['id'] ?? 0),
            'rule_name' => (string)($r['rule_name'] ?? ''),
            'trigger_type' => (string)($r['trigger_type'] ?? 'upcoming_due'),
            'days_before_due' => (int)($r['days_before_due'] ?? 0),
            'target_scope' => (string)($r['target_scope'] ?? 'group'),
            'custom_user_ids' => is_array($json) ? array_values(array_unique(array_map('intval', $json))) : [],
            'email_subject_template' => (string)($r['email_subject_template'] ?? ''),
            'email_body_template' => (string)($r['email_body_template'] ?? ''),
            'is_active' => (int)($r['is_active'] ?? 0),
            'last_triggered_at' => (string)($r['last_triggered_at'] ?? ''),
        ];
    }, $rows);
}

function accumul8_list_bank_connections(int $viewerId): array
{
    $rows = Database::queryAll(
        'SELECT id, provider_name, institution_id, institution_name, plaid_item_id, status, last_sync_at, last_error
         FROM accumul8_bank_connections
         WHERE owner_user_id = ?
         ORDER BY id DESC',
        [$viewerId]
    );

    return array_map(static function (array $r): array {
        return [
            'id' => (int)($r['id'] ?? 0),
            'provider_name' => (string)($r['provider_name'] ?? 'plaid'),
            'institution_id' => (string)($r['institution_id'] ?? ''),
            'institution_name' => (string)($r['institution_name'] ?? ''),
            'plaid_item_id' => (string)($r['plaid_item_id'] ?? ''),
            'status' => (string)($r['status'] ?? 'setup_pending'),
            'last_sync_at' => (string)($r['last_sync_at'] ?? ''),
            'last_error' => (string)($r['last_error'] ?? ''),
        ];
    }, $rows);
}

function accumul8_due_bills(int $viewerId): array
{
    $rows = Database::queryAll(
        "SELECT id, transaction_date, due_date, description, amount, is_paid, source_kind
         FROM accumul8_transactions
         WHERE owner_user_id = ?
           AND amount < 0
           AND (
             source_kind IN ('recurring', 'manual', 'plaid')
             OR entry_type IN ('bill', 'auto', 'manual')
           )
         ORDER BY COALESCE(due_date, transaction_date) ASC, id ASC",
        [$viewerId]
    );

    return array_map(static function (array $r): array {
        return [
            'id' => (int)($r['id'] ?? 0),
            'transaction_date' => (string)($r['transaction_date'] ?? ''),
            'due_date' => (string)($r['due_date'] ?? ''),
            'description' => (string)($r['description'] ?? ''),
            'amount' => (float)($r['amount'] ?? 0),
            'is_paid' => (int)($r['is_paid'] ?? 0),
            'source_kind' => (string)($r['source_kind'] ?? ''),
        ];
    }, $rows);
}

function accumul8_notification_recipients_from_rule(int $viewerId, array $rule): array
{
    $scope = (string)($rule['target_scope'] ?? 'group');
    if ($scope === 'custom') {
        $ids = $rule['custom_user_ids'] ?? [];
        if (!is_array($ids) || !$ids) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $params = array_map('intval', $ids);
        $rows = Database::queryAll(
            'SELECT id, username, email FROM users WHERE email IS NOT NULL AND email <> "" AND is_active = 1 AND id IN (' . $placeholders . ') ORDER BY username ASC',
            $params
        );
        return $rows;
    }

    $rows = Database::queryAll(
        "SELECT DISTINCT u.id, u.username, u.email
         FROM users u
         LEFT JOIN group_memberships gm ON gm.user_id = u.id
         LEFT JOIN catn8_groups g ON g.id = gm.group_id
         WHERE u.is_active = 1
           AND u.email IS NOT NULL
           AND u.email <> ''
           AND (
             u.is_admin = 1
             OR g.slug = 'administrators'
             OR g.slug = 'accumul8-users'
           )
         ORDER BY u.username ASC, u.id ASC"
    );

    return $rows;
}

function accumul8_next_due_date(string $currentDate, string $frequency, int $intervalCount): string
{
    $base = strtotime($currentDate);
    if ($base === false) {
        $base = time();
    }
    $intervalCount = max(1, min(365, $intervalCount));

    if ($frequency === 'weekly') {
        return date('Y-m-d', strtotime('+' . $intervalCount . ' week', $base));
    }
    if ($frequency === 'biweekly') {
        return date('Y-m-d', strtotime('+' . ($intervalCount * 2) . ' week', $base));
    }
    if ($frequency === 'monthly') {
        return date('Y-m-d', strtotime('+' . $intervalCount . ' month', $base));
    }
    return date('Y-m-d', strtotime('+' . $intervalCount . ' day', $base));
}

function accumul8_plaid_env(): string
{
    $env = strtolower(accumul8_normalize_text((string)(secret_get(catn8_secret_key('accumul8.plaid.env')) ?? getenv('PLAID_ENV') ?? 'sandbox'), 16));
    if (!in_array($env, ['sandbox', 'development', 'production'], true)) {
        $env = 'sandbox';
    }
    return $env;
}

function accumul8_plaid_base_url(): string
{
    $env = accumul8_plaid_env();
    if ($env === 'production') {
        return 'https://production.plaid.com';
    }
    if ($env === 'development') {
        return 'https://development.plaid.com';
    }
    return 'https://sandbox.plaid.com';
}

function accumul8_plaid_credentials(): array
{
    $clientId = (string)(secret_get(catn8_secret_key('accumul8.plaid.client_id')) ?? getenv('PLAID_CLIENT_ID') ?? '');
    $secret = (string)(secret_get(catn8_secret_key('accumul8.plaid.secret')) ?? getenv('PLAID_SECRET') ?? '');
    return [
        'client_id' => trim($clientId),
        'secret' => trim($secret),
        'env' => accumul8_plaid_env(),
    ];
}

function accumul8_plaid_is_configured(): bool
{
    $c = accumul8_plaid_credentials();
    return ($c['client_id'] ?? '') !== '' && ($c['secret'] ?? '') !== '';
}

function accumul8_plaid_request(string $path, array $payload): array
{
    $creds = accumul8_plaid_credentials();
    if (($creds['client_id'] ?? '') === '' || ($creds['secret'] ?? '') === '') {
        throw new RuntimeException('Plaid credentials are not configured. Set accumul8.plaid.client_id and accumul8.plaid.secret.');
    }

    $base = accumul8_plaid_base_url();
    $url = rtrim($base, '/') . '/' . ltrim($path, '/');

    $payload['client_id'] = $creds['client_id'];
    $payload['secret'] = $creds['secret'];

    $resp = catn8_http_json_with_status('POST', $url, [], $payload, 10, 45);
    $status = (int)($resp['status'] ?? 0);
    $json = $resp['json'] ?? null;

    if ($status < 200 || $status >= 300) {
        $err = is_array($json) ? ((string)($json['error_message'] ?? $json['display_message'] ?? 'Plaid request failed')) : 'Plaid request failed';
        throw new RuntimeException($err . ' (HTTP ' . $status . ')');
    }
    if (!is_array($json)) {
        throw new RuntimeException('Plaid returned non-JSON response');
    }

    return $json;
}

accumul8_tables_ensure();
accumul8_get_or_create_default_account($viewerId);

$action = accumul8_normalize_text((string)($_GET['action'] ?? ''), 80);
if ($action === '') {
    $action = 'bootstrap';
}

if ($action === 'bootstrap') {
    catn8_require_method('GET');

    $transactions = accumul8_list_transactions($viewerId, 500);
    $contacts = accumul8_list_contacts($viewerId);
    $recurring = accumul8_list_recurring($viewerId);
    $accounts = accumul8_list_accounts($viewerId);
    $debtors = accumul8_list_debtors($viewerId);
    $budgetRows = accumul8_list_budget_rows($viewerId);
    $rules = accumul8_list_notification_rules($viewerId);
    $connections = accumul8_list_bank_connections($viewerId);
    $payBills = accumul8_due_bills($viewerId);

    $summary = Database::queryOne(
        'SELECT
            COALESCE(SUM(amount), 0) AS net_amount,
            COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS inflow_total,
            COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END), 0) AS outflow_total,
            COALESCE(SUM(CASE WHEN is_paid = 0 AND amount < 0 THEN amount ELSE 0 END), 0) AS unpaid_outflow_total
         FROM accumul8_transactions
         WHERE owner_user_id = ?',
        [$viewerId]
    ) ?: [];

    catn8_json_response([
        'success' => true,
        'contacts' => $contacts,
        'recurring_payments' => $recurring,
        'transactions' => $transactions,
        'debtor_ledger' => array_values(array_filter($transactions, static function (array $tx): bool {
            return isset($tx['debtor_id']) && (int)$tx['debtor_id'] > 0;
        })),
        'accounts' => $accounts,
        'debtors' => $debtors,
        'budget_rows' => $budgetRows,
        'notification_rules' => $rules,
        'pay_bills' => $payBills,
        'bank_connections' => $connections,
        'sync_provider' => [
            'provider' => 'plaid',
            'env' => accumul8_plaid_env(),
            'configured' => accumul8_plaid_is_configured() ? 1 : 0,
        ],
        'summary' => [
            'net_amount' => (float)($summary['net_amount'] ?? 0),
            'inflow_total' => (float)($summary['inflow_total'] ?? 0),
            'outflow_total' => (float)($summary['outflow_total'] ?? 0),
            'unpaid_outflow_total' => (float)($summary['unpaid_outflow_total'] ?? 0),
        ],
    ]);
}

if ($action === 'create_contact') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $name = accumul8_normalize_text($body['contact_name'] ?? '', 191);
    $type = accumul8_validate_enum('contact_type', $body['contact_type'] ?? 'both', ['payee', 'payer', 'both'], 'both');
    $amount = accumul8_normalize_amount($body['default_amount'] ?? 0);
    $email = accumul8_normalize_text($body['email'] ?? '', 191);
    $notes = accumul8_normalize_text($body['notes'] ?? '', 1500);

    if ($name === '') {
        catn8_json_response(['success' => false, 'error' => 'contact_name is required'], 400);
    }

    Database::execute(
        'INSERT INTO accumul8_contacts (owner_user_id, contact_name, contact_type, default_amount, email, notes, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)',
        [$viewerId, $name, $type, $amount, ($email === '' ? null : $email), ($notes === '' ? null : $notes)]
    );

    catn8_json_response(['success' => true, 'id' => (int)Database::lastInsertId()]);
}

if ($action === 'update_contact') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $name = accumul8_normalize_text($body['contact_name'] ?? '', 191);
    $type = accumul8_validate_enum('contact_type', $body['contact_type'] ?? 'both', ['payee', 'payer', 'both'], 'both');
    $amount = accumul8_normalize_amount($body['default_amount'] ?? 0);
    $email = accumul8_normalize_text($body['email'] ?? '', 191);
    $notes = accumul8_normalize_text($body['notes'] ?? '', 1500);

    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    if ($name === '') {
        catn8_json_response(['success' => false, 'error' => 'contact_name is required'], 400);
    }

    Database::execute(
        'UPDATE accumul8_contacts
         SET contact_name = ?, contact_type = ?, default_amount = ?, email = ?, notes = ?
         WHERE id = ? AND owner_user_id = ?',
        [$name, $type, $amount, ($email === '' ? null : $email), ($notes === '' ? null : $notes), $id, $viewerId]
    );

    catn8_json_response(['success' => true]);
}

if ($action === 'delete_contact') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    Database::execute('DELETE FROM accumul8_contacts WHERE id = ? AND owner_user_id = ?', [$id, $viewerId]);
    catn8_json_response(['success' => true]);
}

if ($action === 'create_debtor') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $debtorName = accumul8_normalize_text($body['debtor_name'] ?? '', 191);
    $notes = accumul8_normalize_text($body['notes'] ?? '', 1500);
    $contactId = isset($body['contact_id']) ? (int)$body['contact_id'] : 0;
    $contactIdOrNull = accumul8_owned_id_or_null('contacts', $viewerId, $contactId);
    $isActive = accumul8_normalize_bool($body['is_active'] ?? 1);

    if ($debtorName === '') {
        catn8_json_response(['success' => false, 'error' => 'debtor_name is required'], 400);
    }

    Database::execute(
        'INSERT INTO accumul8_debtors (owner_user_id, contact_id, debtor_name, notes, is_active)
         VALUES (?, ?, ?, ?, ?)',
        [$viewerId, $contactIdOrNull, $debtorName, $notes === '' ? null : $notes, $isActive]
    );

    catn8_json_response(['success' => true, 'id' => (int)Database::lastInsertId()]);
}

if ($action === 'update_debtor') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $debtorName = accumul8_normalize_text($body['debtor_name'] ?? '', 191);
    $notes = accumul8_normalize_text($body['notes'] ?? '', 1500);
    $contactId = isset($body['contact_id']) ? (int)$body['contact_id'] : 0;
    $contactIdOrNull = accumul8_owned_id_or_null('contacts', $viewerId, $contactId);
    $isActive = accumul8_normalize_bool($body['is_active'] ?? 1);

    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    if ($debtorName === '') {
        catn8_json_response(['success' => false, 'error' => 'debtor_name is required'], 400);
    }

    Database::execute(
        'UPDATE accumul8_debtors
         SET contact_id = ?, debtor_name = ?, notes = ?, is_active = ?
         WHERE id = ? AND owner_user_id = ?',
        [$contactIdOrNull, $debtorName, $notes === '' ? null : $notes, $isActive, $id, $viewerId]
    );

    catn8_json_response(['success' => true]);
}

if ($action === 'delete_debtor') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    Database::execute('DELETE FROM accumul8_debtors WHERE id = ? AND owner_user_id = ?', [$id, $viewerId]);
    catn8_json_response(['success' => true]);
}

if ($action === 'create_budget_row') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $categoryName = accumul8_normalize_text($body['category_name'] ?? '', 191);
    $monthlyBudget = accumul8_normalize_amount($body['monthly_budget'] ?? 0);
    $matchPattern = accumul8_normalize_text($body['match_pattern'] ?? '', 191);
    $isActive = accumul8_normalize_bool($body['is_active'] ?? 1);
    $rowOrder = isset($body['row_order']) ? (int)$body['row_order'] : 0;

    if ($categoryName === '') {
        catn8_json_response(['success' => false, 'error' => 'category_name is required'], 400);
    }
    if ($rowOrder <= 0) {
        $orderRow = Database::queryOne('SELECT COALESCE(MAX(row_order), 0) AS max_order FROM accumul8_budget_rows WHERE owner_user_id = ?', [$viewerId]);
        $rowOrder = ((int)($orderRow['max_order'] ?? 0)) + 1;
    }

    Database::execute(
        'INSERT INTO accumul8_budget_rows (owner_user_id, row_order, category_name, monthly_budget, match_pattern, is_active)
         VALUES (?, ?, ?, ?, ?, ?)',
        [$viewerId, $rowOrder, $categoryName, $monthlyBudget, $matchPattern === '' ? null : $matchPattern, $isActive]
    );

    catn8_json_response(['success' => true, 'id' => (int)Database::lastInsertId()]);
}

if ($action === 'update_budget_row') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $categoryName = accumul8_normalize_text($body['category_name'] ?? '', 191);
    $monthlyBudget = accumul8_normalize_amount($body['monthly_budget'] ?? 0);
    $matchPattern = accumul8_normalize_text($body['match_pattern'] ?? '', 191);
    $isActive = accumul8_normalize_bool($body['is_active'] ?? 1);
    $rowOrder = isset($body['row_order']) ? max(0, (int)$body['row_order']) : 0;

    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    if ($categoryName === '') {
        catn8_json_response(['success' => false, 'error' => 'category_name is required'], 400);
    }

    Database::execute(
        'UPDATE accumul8_budget_rows
         SET row_order = ?, category_name = ?, monthly_budget = ?, match_pattern = ?, is_active = ?
         WHERE id = ? AND owner_user_id = ?',
        [$rowOrder, $categoryName, $monthlyBudget, $matchPattern === '' ? null : $matchPattern, $isActive, $id, $viewerId]
    );

    catn8_json_response(['success' => true]);
}

if ($action === 'delete_budget_row') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    Database::execute('DELETE FROM accumul8_budget_rows WHERE id = ? AND owner_user_id = ?', [$id, $viewerId]);
    catn8_json_response(['success' => true]);
}

if ($action === 'create_recurring') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $title = accumul8_normalize_text($body['title'] ?? '', 191);
    $direction = accumul8_validate_enum('direction', $body['direction'] ?? 'outflow', ['outflow', 'inflow'], 'outflow');
    $frequency = accumul8_validate_enum('frequency', $body['frequency'] ?? 'monthly', ['daily', 'weekly', 'biweekly', 'monthly'], 'monthly');
    $amount = accumul8_normalize_amount($body['amount'] ?? 0);
    $intervalCount = (int)($body['interval_count'] ?? 1);
    $intervalCount = max(1, min(365, $intervalCount));
    $nextDue = accumul8_require_valid_date('next_due_date', $body['next_due_date'] ?? '');
    $notes = accumul8_normalize_text($body['notes'] ?? '', 1500);
    $contactId = isset($body['contact_id']) ? (int)$body['contact_id'] : 0;
    $accountId = isset($body['account_id']) ? (int)$body['account_id'] : 0;
    $dayOfMonth = isset($body['day_of_month']) && $body['day_of_month'] !== '' ? (int)$body['day_of_month'] : null;
    $dayOfWeek = isset($body['day_of_week']) && $body['day_of_week'] !== '' ? (int)$body['day_of_week'] : null;

    if ($title === '') {
        catn8_json_response(['success' => false, 'error' => 'title is required'], 400);
    }

    Database::execute(
        'INSERT INTO accumul8_recurring_payments
            (owner_user_id, contact_id, account_id, title, direction, amount, frequency, interval_count, day_of_month, day_of_week, next_due_date, notes, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
        [
            $viewerId,
            $contactId > 0 ? $contactId : null,
            $accountId > 0 ? $accountId : null,
            $title,
            $direction,
            $amount,
            $frequency,
            $intervalCount,
            $dayOfMonth,
            $dayOfWeek,
            $nextDue,
            $notes === '' ? null : $notes,
        ]
    );

    catn8_json_response(['success' => true, 'id' => (int)Database::lastInsertId()]);
}

if ($action === 'update_recurring') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $title = accumul8_normalize_text($body['title'] ?? '', 191);
    $direction = accumul8_validate_enum('direction', $body['direction'] ?? 'outflow', ['outflow', 'inflow'], 'outflow');
    $frequency = accumul8_validate_enum('frequency', $body['frequency'] ?? 'monthly', ['daily', 'weekly', 'biweekly', 'monthly'], 'monthly');
    $amount = accumul8_normalize_amount($body['amount'] ?? 0);
    $intervalCount = (int)($body['interval_count'] ?? 1);
    $intervalCount = max(1, min(365, $intervalCount));
    $nextDue = accumul8_require_valid_date('next_due_date', $body['next_due_date'] ?? '');
    $notes = accumul8_normalize_text($body['notes'] ?? '', 1500);
    $contactId = isset($body['contact_id']) ? (int)$body['contact_id'] : 0;
    $accountId = isset($body['account_id']) ? (int)$body['account_id'] : 0;
    $dayOfMonth = isset($body['day_of_month']) && $body['day_of_month'] !== '' ? (int)$body['day_of_month'] : null;
    $dayOfWeek = isset($body['day_of_week']) && $body['day_of_week'] !== '' ? (int)$body['day_of_week'] : null;

    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    if ($title === '') {
        catn8_json_response(['success' => false, 'error' => 'title is required'], 400);
    }

    Database::execute(
        'UPDATE accumul8_recurring_payments
         SET contact_id = ?, account_id = ?, title = ?, direction = ?, amount = ?, frequency = ?, interval_count = ?,
             day_of_month = ?, day_of_week = ?, next_due_date = ?, notes = ?
         WHERE id = ? AND owner_user_id = ?',
        [
            $contactId > 0 ? $contactId : null,
            $accountId > 0 ? $accountId : null,
            $title,
            $direction,
            $amount,
            $frequency,
            $intervalCount,
            $dayOfMonth,
            $dayOfWeek,
            $nextDue,
            $notes === '' ? null : $notes,
            $id,
            $viewerId,
        ]
    );

    catn8_json_response(['success' => true]);
}

if ($action === 'toggle_recurring') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    Database::execute(
        'UPDATE accumul8_recurring_payments
         SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END
         WHERE id = ? AND owner_user_id = ?',
        [$id, $viewerId]
    );

    catn8_json_response(['success' => true]);
}

if ($action === 'delete_recurring') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    Database::execute('DELETE FROM accumul8_recurring_payments WHERE id = ? AND owner_user_id = ?', [$id, $viewerId]);
    catn8_json_response(['success' => true]);
}

if ($action === 'materialize_due_recurring') {
    catn8_require_method('POST');

    $today = date('Y-m-d');
    $dueRows = Database::queryAll(
        'SELECT id, contact_id, account_id, title, direction, amount, frequency, interval_count, next_due_date
         FROM accumul8_recurring_payments
         WHERE owner_user_id = ?
           AND is_active = 1
           AND next_due_date <= ?
         ORDER BY next_due_date ASC, id ASC',
        [$viewerId, $today]
    );

    $created = 0;
    foreach ($dueRows as $row) {
        $rpId = (int)($row['id'] ?? 0);
        $nextDue = (string)($row['next_due_date'] ?? $today);
        $description = (string)($row['title'] ?? 'Recurring Payment');
        $direction = (string)($row['direction'] ?? 'outflow');
        $baseAmount = (float)($row['amount'] ?? 0);
        $amount = $direction === 'outflow' ? -abs($baseAmount) : abs($baseAmount);
        $frequency = (string)($row['frequency'] ?? 'monthly');
        $intervalCount = (int)($row['interval_count'] ?? 1);

        $existing = Database::queryOne(
            'SELECT id FROM accumul8_transactions
             WHERE owner_user_id = ?
               AND recurring_payment_id = ?
               AND due_date = ?
             LIMIT 1',
            [$viewerId, $rpId, $nextDue]
        );
        if (!$existing) {
            Database::execute(
                'INSERT INTO accumul8_transactions
                    (owner_user_id, account_id, contact_id, transaction_date, due_date, entry_type, description, amount, rta_amount,
                     is_paid, is_reconciled, is_recurring_instance, recurring_payment_id, source_kind, created_by_user_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 1, ?, ?, ?)',
                [
                    $viewerId,
                    isset($row['account_id']) ? (int)$row['account_id'] : null,
                    isset($row['contact_id']) ? (int)$row['contact_id'] : null,
                    $nextDue,
                    $nextDue,
                    'bill',
                    $description,
                    $amount,
                    $rpId,
                    'recurring',
                    $viewerId,
                ]
            );
            $created++;
        }

        $nextGenerated = accumul8_next_due_date($nextDue, $frequency, $intervalCount);
        Database::execute(
            'UPDATE accumul8_recurring_payments
             SET next_due_date = ?
             WHERE id = ? AND owner_user_id = ?',
            [$nextGenerated, $rpId, $viewerId]
        );
    }

    accumul8_recompute_running_balance($viewerId);

    catn8_json_response(['success' => true, 'created' => $created]);
}

if ($action === 'create_transaction') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $transactionDate = accumul8_require_valid_date('transaction_date', $body['transaction_date'] ?? date('Y-m-d'));
    $dueDate = accumul8_normalize_date($body['due_date'] ?? null);
    $entryType = accumul8_validate_enum('entry_type', $body['entry_type'] ?? 'manual', ['manual', 'auto', 'transfer', 'deposit', 'bill'], 'manual');
    $description = accumul8_normalize_text($body['description'] ?? '', 255);
    $memo = accumul8_normalize_text($body['memo'] ?? '', 5000);
    $amount = accumul8_normalize_amount($body['amount'] ?? 0);
    $rtaAmount = accumul8_normalize_amount($body['rta_amount'] ?? 0);
    $isPaid = accumul8_normalize_bool($body['is_paid'] ?? 0);
    $isReconciled = accumul8_normalize_bool($body['is_reconciled'] ?? 0);
    $contactId = isset($body['contact_id']) ? (int)$body['contact_id'] : 0;
    $accountId = isset($body['account_id']) ? (int)$body['account_id'] : 0;
    $debtorId = isset($body['debtor_id']) ? (int)$body['debtor_id'] : 0;
    $contactIdOrNull = accumul8_owned_id_or_null('contacts', $viewerId, $contactId);
    $accountIdOrNull = accumul8_owned_id_or_null('accounts', $viewerId, $accountId);
    $debtorIdOrNull = accumul8_owned_id_or_null('debtors', $viewerId, $debtorId);

    if ($description === '') {
        catn8_json_response(['success' => false, 'error' => 'description is required'], 400);
    }

    Database::execute(
        'INSERT INTO accumul8_transactions
            (owner_user_id, account_id, contact_id, debtor_id, transaction_date, due_date, entry_type, description, memo, amount, rta_amount,
             is_paid, is_reconciled, source_kind, created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $viewerId,
            $accountIdOrNull,
            $contactIdOrNull,
            $debtorIdOrNull,
            $transactionDate,
            $dueDate,
            $entryType,
            $description,
            $memo === '' ? null : $memo,
            $amount,
            $rtaAmount,
            $isPaid,
            $isReconciled,
            'manual',
            $viewerId,
        ]
    );

    accumul8_recompute_running_balance($viewerId);

    catn8_json_response(['success' => true, 'id' => (int)Database::lastInsertId()]);
}

if ($action === 'update_transaction') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $transactionDate = accumul8_require_valid_date('transaction_date', $body['transaction_date'] ?? date('Y-m-d'));
    $dueDate = accumul8_normalize_date($body['due_date'] ?? null);
    $entryType = accumul8_validate_enum('entry_type', $body['entry_type'] ?? 'manual', ['manual', 'auto', 'transfer', 'deposit', 'bill'], 'manual');
    $description = accumul8_normalize_text($body['description'] ?? '', 255);
    $memo = accumul8_normalize_text($body['memo'] ?? '', 5000);
    $amount = accumul8_normalize_amount($body['amount'] ?? 0);
    $rtaAmount = accumul8_normalize_amount($body['rta_amount'] ?? 0);
    $isPaid = accumul8_normalize_bool($body['is_paid'] ?? 0);
    $isReconciled = accumul8_normalize_bool($body['is_reconciled'] ?? 0);
    $contactId = isset($body['contact_id']) ? (int)$body['contact_id'] : 0;
    $accountId = isset($body['account_id']) ? (int)$body['account_id'] : 0;
    $debtorId = isset($body['debtor_id']) ? (int)$body['debtor_id'] : 0;
    $contactIdOrNull = accumul8_owned_id_or_null('contacts', $viewerId, $contactId);
    $accountIdOrNull = accumul8_owned_id_or_null('accounts', $viewerId, $accountId);
    $debtorIdOrNull = accumul8_owned_id_or_null('debtors', $viewerId, $debtorId);

    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    if ($description === '') {
        catn8_json_response(['success' => false, 'error' => 'description is required'], 400);
    }

    Database::execute(
        'UPDATE accumul8_transactions
         SET account_id = ?, contact_id = ?, debtor_id = ?, transaction_date = ?, due_date = ?, entry_type = ?, description = ?,
             memo = ?, amount = ?, rta_amount = ?, is_paid = ?, is_reconciled = ?
         WHERE id = ? AND owner_user_id = ?',
        [
            $accountIdOrNull,
            $contactIdOrNull,
            $debtorIdOrNull,
            $transactionDate,
            $dueDate,
            $entryType,
            $description,
            $memo === '' ? null : $memo,
            $amount,
            $rtaAmount,
            $isPaid,
            $isReconciled,
            $id,
            $viewerId,
        ]
    );

    accumul8_recompute_running_balance($viewerId);

    catn8_json_response(['success' => true]);
}

if ($action === 'toggle_transaction_paid') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);

    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    Database::execute(
        'UPDATE accumul8_transactions
         SET is_paid = CASE WHEN is_paid = 1 THEN 0 ELSE 1 END
         WHERE id = ? AND owner_user_id = ?',
        [$id, $viewerId]
    );

    catn8_json_response(['success' => true]);
}

if ($action === 'toggle_transaction_reconciled') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);

    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    Database::execute(
        'UPDATE accumul8_transactions
         SET is_reconciled = CASE WHEN is_reconciled = 1 THEN 0 ELSE 1 END
         WHERE id = ? AND owner_user_id = ?',
        [$id, $viewerId]
    );

    catn8_json_response(['success' => true]);
}

if ($action === 'delete_transaction') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    Database::execute('DELETE FROM accumul8_transactions WHERE id = ? AND owner_user_id = ?', [$id, $viewerId]);
    accumul8_recompute_running_balance($viewerId);
    catn8_json_response(['success' => true]);
}

if ($action === 'create_notification_rule') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $ruleName = accumul8_normalize_text($body['rule_name'] ?? '', 191);
    $triggerType = accumul8_validate_enum('trigger_type', $body['trigger_type'] ?? 'upcoming_due', ['upcoming_due', 'overdue', 'manual'], 'upcoming_due');
    $daysBeforeDue = (int)($body['days_before_due'] ?? 3);
    $daysBeforeDue = max(0, min(90, $daysBeforeDue));
    $targetScope = accumul8_validate_enum('target_scope', $body['target_scope'] ?? 'group', ['group', 'custom'], 'group');
    $subject = accumul8_normalize_text($body['email_subject_template'] ?? '', 255);
    $message = accumul8_normalize_text($body['email_body_template'] ?? '', 8000);
    $customIdsRaw = $body['custom_user_ids'] ?? [];
    $customIds = [];
    if (is_array($customIdsRaw)) {
        foreach ($customIdsRaw as $id) {
            $n = (int)$id;
            if ($n > 0) {
                $customIds[] = $n;
            }
        }
        $customIds = array_values(array_unique($customIds));
    }

    if ($ruleName === '' || $subject === '' || $message === '') {
        catn8_json_response(['success' => false, 'error' => 'rule_name, email_subject_template, and email_body_template are required'], 400);
    }

    Database::execute(
        'INSERT INTO accumul8_notification_rules
            (owner_user_id, rule_name, trigger_type, days_before_due, target_scope, custom_user_ids_json,
             email_subject_template, email_body_template, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
        [
            $viewerId,
            $ruleName,
            $triggerType,
            $daysBeforeDue,
            $targetScope,
            json_encode($customIds),
            $subject,
            $message,
        ]
    );

    catn8_json_response(['success' => true, 'id' => (int)Database::lastInsertId()]);
}

if ($action === 'update_notification_rule') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $ruleName = accumul8_normalize_text($body['rule_name'] ?? '', 191);
    $triggerType = accumul8_validate_enum('trigger_type', $body['trigger_type'] ?? 'upcoming_due', ['upcoming_due', 'overdue', 'manual'], 'upcoming_due');
    $daysBeforeDue = (int)($body['days_before_due'] ?? 3);
    $daysBeforeDue = max(0, min(90, $daysBeforeDue));
    $targetScope = accumul8_validate_enum('target_scope', $body['target_scope'] ?? 'group', ['group', 'custom'], 'group');
    $subject = accumul8_normalize_text($body['email_subject_template'] ?? '', 255);
    $message = accumul8_normalize_text($body['email_body_template'] ?? '', 8000);
    $customIdsRaw = $body['custom_user_ids'] ?? [];
    $customIds = [];
    if (is_array($customIdsRaw)) {
        foreach ($customIdsRaw as $customId) {
            $n = (int)$customId;
            if ($n > 0) {
                $customIds[] = $n;
            }
        }
        $customIds = array_values(array_unique($customIds));
    }

    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    if ($ruleName === '' || $subject === '' || $message === '') {
        catn8_json_response(['success' => false, 'error' => 'rule_name, email_subject_template, and email_body_template are required'], 400);
    }

    Database::execute(
        'UPDATE accumul8_notification_rules
         SET rule_name = ?, trigger_type = ?, days_before_due = ?, target_scope = ?, custom_user_ids_json = ?,
             email_subject_template = ?, email_body_template = ?
         WHERE id = ? AND owner_user_id = ?',
        [
            $ruleName,
            $triggerType,
            $daysBeforeDue,
            $targetScope,
            json_encode($customIds),
            $subject,
            $message,
            $id,
            $viewerId,
        ]
    );

    catn8_json_response(['success' => true]);
}

if ($action === 'toggle_notification_rule') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    Database::execute(
        'UPDATE accumul8_notification_rules
         SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END
         WHERE id = ? AND owner_user_id = ?',
        [$id, $viewerId]
    );

    catn8_json_response(['success' => true]);
}

if ($action === 'delete_notification_rule') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    Database::execute('DELETE FROM accumul8_notification_rules WHERE id = ? AND owner_user_id = ?', [$id, $viewerId]);
    catn8_json_response(['success' => true]);
}

if ($action === 'send_notification') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $ruleId = (int)($body['rule_id'] ?? 0);
    $overrideSubject = accumul8_normalize_text($body['subject'] ?? '', 255);
    $overrideBody = accumul8_normalize_text($body['body'] ?? '', 8000);

    $rule = null;
    if ($ruleId > 0) {
        $row = Database::queryOne(
            'SELECT id, rule_name, trigger_type, days_before_due, target_scope, custom_user_ids_json,
                    email_subject_template, email_body_template
             FROM accumul8_notification_rules
             WHERE id = ? AND owner_user_id = ?',
            [$ruleId, $viewerId]
        );
        if (!$row) {
            catn8_json_response(['success' => false, 'error' => 'Rule not found'], 404);
        }
        $rule = [
            'id' => (int)$row['id'],
            'rule_name' => (string)$row['rule_name'],
            'target_scope' => (string)$row['target_scope'],
            'custom_user_ids' => json_decode((string)($row['custom_user_ids_json'] ?? '[]'), true),
            'email_subject_template' => (string)$row['email_subject_template'],
            'email_body_template' => (string)$row['email_body_template'],
        ];
    } else {
        $rule = [
            'id' => null,
            'rule_name' => 'Ad-hoc Notification',
            'target_scope' => accumul8_validate_enum('target_scope', $body['target_scope'] ?? 'group', ['group', 'custom'], 'group'),
            'custom_user_ids' => is_array($body['custom_user_ids'] ?? null) ? $body['custom_user_ids'] : [],
            'email_subject_template' => $overrideSubject,
            'email_body_template' => $overrideBody,
        ];
    }

    $subject = $overrideSubject !== '' ? $overrideSubject : (string)($rule['email_subject_template'] ?? 'Accumul8 Notification');
    $textBody = $overrideBody !== '' ? $overrideBody : (string)($rule['email_body_template'] ?? '');
    if ($subject === '' || $textBody === '') {
        catn8_json_response(['success' => false, 'error' => 'Notification subject and body are required'], 400);
    }

    $dueSoonRows = Database::queryAll(
        'SELECT description, due_date, amount
         FROM accumul8_transactions
         WHERE owner_user_id = ?
           AND amount < 0
           AND is_paid = 0
           AND due_date IS NOT NULL
         ORDER BY due_date ASC, id ASC
         LIMIT 10',
        [$viewerId]
    );

    $dueLines = [];
    foreach ($dueSoonRows as $due) {
        $dueLines[] = '- ' . (string)($due['description'] ?? 'Bill') . ' | due ' . (string)($due['due_date'] ?? '') . ' | ' . number_format((float)($due['amount'] ?? 0), 2);
    }

    $appendix = "\n\nUpcoming Unpaid Bills:\n" . ($dueLines ? implode("\n", $dueLines) : '- None');

    $safeText = nl2br(htmlspecialchars($textBody . $appendix, ENT_QUOTES, 'UTF-8'));
    $html = '<div style="font-family:Arial,sans-serif;line-height:1.5">'
        . '<h2 style="margin-bottom:8px">Accumul8 Notification</h2>'
        . '<div>' . $safeText . '</div>'
        . '</div>';

    $recipients = accumul8_notification_recipients_from_rule($viewerId, $rule);
    if (!$recipients) {
        catn8_json_response(['success' => false, 'error' => 'No recipients available for this rule'], 400);
    }

    $sent = [];
    $failed = [];
    foreach ($recipients as $recipient) {
        $email = accumul8_normalize_text($recipient['email'] ?? '', 191);
        if ($email === '') {
            continue;
        }
        try {
            catn8_send_email($email, (string)($recipient['username'] ?? ''), $subject, $html);
            $sent[] = [
                'id' => (int)($recipient['id'] ?? 0),
                'username' => (string)($recipient['username'] ?? ''),
                'email' => $email,
            ];
        } catch (Throwable $e) {
            $failed[] = [
                'id' => (int)($recipient['id'] ?? 0),
                'username' => (string)($recipient['username'] ?? ''),
                'email' => $email,
                'error' => $e->getMessage(),
            ];
        }
    }

    Database::execute(
        'INSERT INTO accumul8_notification_logs (owner_user_id, rule_id, subject, body_excerpt, recipients_json, sent_at)
         VALUES (?, ?, ?, ?, ?, NOW())',
        [
            $viewerId,
            $rule['id'] ?? null,
            $subject,
            substr(strip_tags($textBody), 0, 500),
            json_encode(['sent' => $sent, 'failed' => $failed]),
        ]
    );

    if (($rule['id'] ?? null) !== null) {
        Database::execute(
            'UPDATE accumul8_notification_rules SET last_triggered_at = NOW() WHERE id = ? AND owner_user_id = ?',
            [(int)$rule['id'], $viewerId]
        );
    }

    catn8_json_response([
        'success' => true,
        'sent_count' => count($sent),
        'failed_count' => count($failed),
        'sent' => $sent,
        'failed' => $failed,
    ]);
}

if ($action === 'plaid_create_link_token') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $clientName = accumul8_normalize_text($body['client_name'] ?? 'Accumul8', 64);
    if ($clientName === '') {
        $clientName = 'Accumul8';
    }

    $products = ['transactions'];
    $countryCodes = ['US'];

    $linkToken = accumul8_plaid_request('/link/token/create', [
        'client_name' => $clientName,
        'language' => 'en',
        'country_codes' => $countryCodes,
        'products' => $products,
        'user' => [
            'client_user_id' => 'accumul8-user-' . (string)$viewerId,
        ],
    ]);

    catn8_json_response([
        'success' => true,
        'link_token' => (string)($linkToken['link_token'] ?? ''),
        'expiration' => (string)($linkToken['expiration'] ?? ''),
    ]);
}

if ($action === 'plaid_exchange_public_token') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $publicToken = accumul8_normalize_text($body['public_token'] ?? '', 300);
    $institutionId = accumul8_normalize_text($body['institution_id'] ?? '', 64);
    $institutionName = accumul8_normalize_text($body['institution_name'] ?? '', 191);

    if ($publicToken === '') {
        catn8_json_response(['success' => false, 'error' => 'public_token is required'], 400);
    }

    $tokenResp = accumul8_plaid_request('/item/public_token/exchange', [
        'public_token' => $publicToken,
    ]);

    $accessToken = (string)($tokenResp['access_token'] ?? '');
    $itemId = (string)($tokenResp['item_id'] ?? '');
    if ($accessToken === '' || $itemId === '') {
        catn8_json_response(['success' => false, 'error' => 'Plaid token exchange response was incomplete'], 500);
    }

    $secretKey = 'accumul8.plaid.access_token.' . $viewerId . '.' . preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $itemId);
    if (!secret_set($secretKey, $accessToken)) {
        catn8_json_response(['success' => false, 'error' => 'Failed to persist Plaid access token'], 500);
    }

    $existing = Database::queryOne(
        'SELECT id FROM accumul8_bank_connections WHERE owner_user_id = ? AND provider_name = ? AND plaid_item_id = ? LIMIT 1',
        [$viewerId, 'plaid', $itemId]
    );

    if ($existing) {
        Database::execute(
            'UPDATE accumul8_bank_connections
             SET institution_id = ?, institution_name = ?, plaid_access_token_secret_key = ?, status = ?, updated_at = NOW()
             WHERE id = ? AND owner_user_id = ?',
            [$institutionId === '' ? null : $institutionId, $institutionName === '' ? null : $institutionName, $secretKey, 'connected', (int)$existing['id'], $viewerId]
        );
        $connectionId = (int)$existing['id'];
    } else {
        Database::execute(
            'INSERT INTO accumul8_bank_connections
                (owner_user_id, provider_name, institution_id, institution_name, plaid_item_id, plaid_access_token_secret_key, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)',
            [$viewerId, 'plaid', $institutionId === '' ? null : $institutionId, $institutionName === '' ? null : $institutionName, $itemId, $secretKey, 'connected']
        );
        $connectionId = (int)Database::lastInsertId();
    }

    catn8_json_response([
        'success' => true,
        'connection_id' => $connectionId,
        'item_id' => $itemId,
    ]);
}

if ($action === 'plaid_sync_transactions') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $connectionId = (int)($body['connection_id'] ?? 0);
    if ($connectionId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'connection_id is required'], 400);
    }

    $connection = Database::queryOne(
        'SELECT id, plaid_item_id, plaid_access_token_secret_key, plaid_cursor
         FROM accumul8_bank_connections
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$connectionId, $viewerId]
    );
    if (!$connection) {
        catn8_json_response(['success' => false, 'error' => 'Connection not found'], 404);
    }

    $secretKey = (string)($connection['plaid_access_token_secret_key'] ?? '');
    $accessToken = (string)(secret_get($secretKey) ?? '');
    if ($secretKey === '' || $accessToken === '') {
        catn8_json_response(['success' => false, 'error' => 'Stored Plaid access token was not found'], 500);
    }

    $cursor = accumul8_normalize_text($connection['plaid_cursor'] ?? '', 191);
    $addedTotal = 0;
    $modifiedTotal = 0;
    $removedTotal = 0;

    do {
        $resp = accumul8_plaid_request('/transactions/sync', [
            'access_token' => $accessToken,
            'cursor' => $cursor === '' ? null : $cursor,
            'count' => 200,
        ]);

        $nextCursor = (string)($resp['next_cursor'] ?? '');
        $hasMore = (bool)($resp['has_more'] ?? false);
        $added = is_array($resp['added'] ?? null) ? $resp['added'] : [];
        $modified = is_array($resp['modified'] ?? null) ? $resp['modified'] : [];
        $removed = is_array($resp['removed'] ?? null) ? $resp['removed'] : [];

        foreach ($added as $tx) {
            if (!is_array($tx)) continue;
            $externalId = accumul8_normalize_text($tx['transaction_id'] ?? '', 191);
            if ($externalId === '') continue;

            $description = accumul8_normalize_text($tx['merchant_name'] ?? $tx['name'] ?? 'Bank Transaction', 255);
            $amountRaw = (float)($tx['amount'] ?? 0);
            $pending = accumul8_normalize_bool($tx['pending'] ?? 0);
            $date = accumul8_require_valid_date('transaction_date', $tx['date'] ?? date('Y-m-d'));

            $signedAmount = round(-1 * $amountRaw, 2);

            $exists = Database::queryOne(
                'SELECT id FROM accumul8_transactions
                 WHERE owner_user_id = ? AND source_kind = ? AND external_id = ?
                 LIMIT 1',
                [$viewerId, 'plaid', $externalId]
            );
            if ($exists) {
                continue;
            }

            Database::execute(
                'INSERT INTO accumul8_transactions
                    (owner_user_id, account_id, transaction_date, due_date, entry_type, description, amount,
                     is_paid, is_reconciled, source_kind, source_ref, external_id, pending_status, created_by_user_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    $viewerId,
                    null,
                    $date,
                    $date,
                    'manual',
                    $description,
                    $signedAmount,
                    1,
                    1,
                    'plaid',
                    (string)($connection['plaid_item_id'] ?? ''),
                    $externalId,
                    $pending,
                    $viewerId,
                ]
            );
            $addedTotal++;
        }

        foreach ($modified as $tx) {
            if (!is_array($tx)) continue;
            $externalId = accumul8_normalize_text($tx['transaction_id'] ?? '', 191);
            if ($externalId === '') continue;
            $pending = accumul8_normalize_bool($tx['pending'] ?? 0);
            Database::execute(
                'UPDATE accumul8_transactions
                 SET pending_status = ?, updated_at = NOW()
                 WHERE owner_user_id = ? AND source_kind = ? AND external_id = ?',
                [$pending, $viewerId, 'plaid', $externalId]
            );
            $modifiedTotal++;
        }

        foreach ($removed as $tx) {
            if (!is_array($tx)) continue;
            $externalId = accumul8_normalize_text($tx['transaction_id'] ?? '', 191);
            if ($externalId === '') continue;
            Database::execute(
                'DELETE FROM accumul8_transactions
                 WHERE owner_user_id = ? AND source_kind = ? AND external_id = ?',
                [$viewerId, 'plaid', $externalId]
            );
            $removedTotal++;
        }

        if ($nextCursor !== '') {
            $cursor = $nextCursor;
        }

        Database::execute(
            'UPDATE accumul8_bank_connections
             SET plaid_cursor = ?, last_sync_at = NOW(), status = ?, last_error = NULL
             WHERE id = ? AND owner_user_id = ?',
            [$cursor, 'connected', $connectionId, $viewerId]
        );
    } while (!empty($hasMore));

    accumul8_recompute_running_balance($viewerId);

    catn8_json_response([
        'success' => true,
        'added' => $addedTotal,
        'modified' => $modifiedTotal,
        'removed' => $removedTotal,
    ]);
}

catn8_json_response(['success' => false, 'error' => 'Unknown action'], 400);
