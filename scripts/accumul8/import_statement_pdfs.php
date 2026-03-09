<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/config.php';

const ACCUMUL8_STATEMENT_SOURCE_KIND = 'statement_pdf';

function accumul8_import_usage(): void
{
    fwrite(STDERR, "Usage: php scripts/accumul8/import_statement_pdfs.php --owner-user-id=1 --dir=/absolute/path [--apply]\n");
}

function accumul8_import_arg(string $name, ?string $default = null): ?string
{
    global $argv;
    foreach ($argv as $arg) {
        if (strpos($arg, '--' . $name . '=') === 0) {
            return substr($arg, strlen($name) + 3);
        }
    }
    return $default;
}

function accumul8_import_has_flag(string $name): bool
{
    global $argv;
    return in_array('--' . $name, $argv, true);
}

function accumul8_import_money(string $value): float
{
    $clean = str_replace([',', '$', ' '], '', trim($value));
    if ($clean === '') {
        return 0.0;
    }
    return round((float)$clean, 2);
}

function accumul8_import_parse_money_line(string $line): ?float
{
    $line = trim($line);
    if (!preg_match('/^([+-])?\s*\$?([0-9,]+\.\d{2})(\s*-)?$/', $line, $matches)) {
        return null;
    }
    $amount = accumul8_import_money($matches[2]);
    $negative = ($matches[1] ?? '') === '-' || trim((string)($matches[3] ?? '')) === '-';
    return $negative ? -$amount : $amount;
}

function accumul8_import_is_money_line(string $line): bool
{
    return accumul8_import_parse_money_line($line) !== null;
}

function accumul8_import_clean_lines(string $text): array
{
    $text = str_replace("\f", "\n", $text);
    $raw = preg_split('/\R/u', $text) ?: [];
    $lines = [];
    foreach ($raw as $line) {
        $line = trim(preg_replace('/\s+/', ' ', trim($line)) ?? '');
        if ($line === '') {
            continue;
        }
        $lines[] = $line;
    }
    return $lines;
}

function accumul8_import_pdf_text(string $path): string
{
    $cmd = '/opt/homebrew/bin/pdftotext ' . escapeshellarg($path) . ' -';
    $output = shell_exec($cmd);
    if (!is_string($output) || $output === '') {
        throw new RuntimeException('Failed to extract PDF text for ' . $path);
    }
    return $output;
}

function accumul8_import_pdf_text_layout(string $path): string
{
    $cmd = '/opt/homebrew/bin/pdftotext -layout ' . escapeshellarg($path) . ' -';
    $output = shell_exec($cmd);
    if (!is_string($output) || $output === '') {
        throw new RuntimeException('Failed to extract layout PDF text for ' . $path);
    }
    return $output;
}

function accumul8_import_capital_one_account_name(string $raw): string
{
    $raw = trim($raw);
    $raw = preg_replace('/^\-\s*/', '', $raw) ?? $raw;
    return $raw === '' ? 'Unnamed Account' : $raw;
}

function accumul8_import_capital_one_account_type(string $line): string
{
    $upper = strtoupper($line);
    if (strpos($upper, 'SAVINGS') !== false) {
        return 'savings';
    }
    return 'checking';
}

function accumul8_import_capital_one_noise(string $line): bool
{
    static $noise = [
        'DATE', 'DESCRIPTION', 'CATEGORY', 'AMOUNT', 'BALANCE',
        'STATEMENT PERIOD', 'Page 1 of 10', 'Page 2 of 10', 'Page 3 of 10', 'Page 4 of 10',
        'Page 5 of 10', 'Page 6 of 10', 'Page 7 of 10', 'Page 8 of 10', 'Page 9 of 10', 'Page 10 of 10',
        'capitalone.com', '1-888-464-0727', 'P.O. Box 85123, Richmond, VA 23285',
        'Jonathan D Graves', 'Thanks for saving with Capital One 360®', 'BALANCE',
    ];
    if (in_array($line, $noise, true)) {
        return true;
    }
    if (preg_match('/^Page \d+ of \d+$/', $line)) {
        return true;
    }
    if (preg_match('/^[A-Z][a-z]{2} \d{1,2} - [A-Z][a-z]{2} \d{1,2}, \d{4}$/', $line)) {
        return true;
    }
    return false;
}

function accumul8_import_parse_capital_one(string $path, string $text): array
{
    $lines = accumul8_import_clean_lines($text);
    if (!preg_match('/STATEMENT PERIOD\s+([A-Z][a-z]{2}) \d{1,2} - ([A-Z][a-z]{2}) \d{1,2}, (\d{4})/u', $text, $matches)) {
        if (!preg_match('/(\d{4})(\d{2})01-Bank statement\.pdf$/', basename($path), $matches)) {
            throw new RuntimeException('Could not determine Capital One statement year for ' . basename($path));
        }
        $year = (int)$matches[1];
    } else {
        $year = (int)$matches[3];
    }

    $accounts = [];
    $transactions = [];
    $current = null;
    $lastBalanceByAccount = [];
    $monthMap = [
        'Jan' => 1, 'Feb' => 2, 'Mar' => 3, 'Apr' => 4, 'May' => 5, 'Jun' => 6,
        'Jul' => 7, 'Aug' => 8, 'Sep' => 9, 'Oct' => 10, 'Nov' => 11, 'Dec' => 12,
    ];

    for ($i = 0, $count = count($lines); $i < $count; $i++) {
        $line = $lines[$i];
        if (preg_match('/^(.*?) - (\d{11})$/', $line, $matches)) {
            $accountName = accumul8_import_capital_one_account_name($matches[1]);
            $accountNumber = $matches[2];
            $typeLine = $lines[$i + 1] ?? '';
            $accountType = accumul8_import_capital_one_account_type($typeLine);
            $current = [
                'institution' => 'Capital One 360',
                'group_name' => 'Capital One 360',
                'account_name' => $accountName,
                'account_number' => $accountNumber,
                'mask_last4' => substr($accountNumber, -4),
                'account_type' => $accountType,
            ];
            $accounts[$accountNumber] = $current;
            continue;
        }

        if ($current === null || !preg_match('/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})$/', $line, $matches)) {
            continue;
        }

        $month = $monthMap[$matches[1]] ?? 1;
        $day = (int)$matches[2];
        $date = sprintf('%04d-%02d-%02d', $year, $month, $day);
        $j = $i + 1;
        $descriptionParts = [];
        while ($j < $count) {
            $candidate = $lines[$j];
            if (accumul8_import_capital_one_noise($candidate)) {
                $j++;
                continue;
            }
            if (preg_match('/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}$/', $candidate)) {
                break;
            }
            if (preg_match('/^(.*?) - (\d{11})$/', $candidate)) {
                break;
            }
            if (in_array($candidate, ['Debit', 'Credit', 'Interest Payment'], true)) {
                $j++;
                break;
            }
            if (accumul8_import_is_money_line($candidate)) {
                break;
            }
            $descriptionParts[] = $candidate;
            $j++;
        }

        $description = trim(implode(' ', $descriptionParts));
        if (
            $description === ''
            || str_starts_with($description, 'Opening Balance')
            || str_starts_with($description, 'Ending Balance')
            || str_starts_with($description, 'Closing Balance')
        ) {
            while ($j < $count && accumul8_import_capital_one_noise($lines[$j])) {
                $j++;
            }
            if ($description === 'Opening Balance' && $j < $count && accumul8_import_is_money_line($lines[$j])) {
                $lastBalanceByAccount[$current['account_number']] = accumul8_import_money($lines[$j]);
                $i = $j;
            }
            continue;
        }

        while ($j < $count && accumul8_import_capital_one_noise($lines[$j])) {
            $j++;
        }
        $amount = null;
        if ($j < $count) {
            $amount = accumul8_import_parse_money_line($lines[$j]);
            if ($amount !== null) {
                $j++;
            }
        }
        while ($j < $count && accumul8_import_capital_one_noise($lines[$j])) {
            $j++;
        }
        $balance = null;
        if ($j < $count && accumul8_import_is_money_line($lines[$j])) {
            $balance = accumul8_import_money($lines[$j]);
            $j++;
        }
        if ($amount === null) {
            continue;
        }
        if ($balance !== null) {
            $lastBalanceByAccount[$current['account_number']] = $balance;
        }

        $transactions[] = [
            'date' => $date,
            'description' => $description,
            'amount' => $amount,
            'balance' => $balance,
            'account_number' => $current['account_number'],
            'account_name' => $current['account_name'],
            'account_type' => $current['account_type'],
            'institution' => $current['institution'],
            'group_name' => $current['group_name'],
            'source_file' => basename($path),
        ];
        $i = max($i, $j - 1);
    }

    return ['accounts' => array_values($accounts), 'transactions' => $transactions];
}

function accumul8_import_parse_navy_summary(array $lines): array
{
    $start = array_search('Summary of your deposit accounts', $lines, true);
    $dividends = array_search('Dividends', $lines, true);
    if ($start === false || $dividends === false || $dividends <= $start) {
        return [];
    }

    $moneyLines = [];
    for ($i = $start; $i < $dividends; $i++) {
        if (preg_match('/^\$[0-9,]+\.\d{2}$/', $lines[$i])) {
            $moneyLines[] = accumul8_import_money($lines[$i]);
        }
    }
    if (count($moneyLines) < 10) {
        return [];
    }

    $numbers = [];
    for ($i = $start; $i < $dividends; $i++) {
        if (preg_match('/^\d{10}$/', $lines[$i])) {
            $numbers[] = $lines[$i];
        }
    }
    if (count($numbers) < 2) {
        return [];
    }

    return [
        $numbers[0] => [
            'previous_balance' => $moneyLines[0],
            'credits' => $moneyLines[1],
            'debits' => $moneyLines[2],
            'ending_balance' => $moneyLines[3],
        ],
        $numbers[1] => [
            'previous_balance' => $moneyLines[5],
            'credits' => $moneyLines[6],
            'debits' => $moneyLines[7],
            'ending_balance' => $moneyLines[8],
        ],
    ];
}

function accumul8_import_parse_navy(string $path, string $text): array
{
    $layoutText = accumul8_import_pdf_text_layout($path);
    $lines = preg_split('/\R/u', str_replace("\f", "\n", $layoutText)) ?: [];
    if (!preg_match('/Statement Period\s+(\d{2})\/(\d{2})\/(\d{2}) - (\d{2})\/(\d{2})\/(\d{2})/u', $layoutText, $matches)) {
        throw new RuntimeException('Could not determine Navy Federal statement period for ' . basename($path));
    }
    $startYear = 2000 + (int)$matches[3];
    $endMonth = (int)$matches[4];
    $endYear = 2000 + (int)$matches[6];
    $accounts = [];
    $transactions = [];
    $current = null;
    $inItemsPaid = false;

    for ($i = 0, $count = count($lines); $i < $count; $i++) {
        $line = trim((string)$lines[$i]);
        if ($line === '') {
            continue;
        }
        if ($line === 'Items Paid') {
            $inItemsPaid = true;
            continue;
        }
        if (preg_match('/^(EveryDay Checking|Membership Savings) - (\d{10})$/', $line, $matches)) {
            $inItemsPaid = false;
            $rawName = $matches[1];
            $accountNumber = $matches[2];
            $accountType = stripos($rawName, 'savings') !== false ? 'savings' : 'checking';
            $current = [
                'institution' => 'Navy Federal Credit Union',
                'group_name' => 'Navy Federal Credit Union',
                'account_name' => $rawName,
                'account_number' => $accountNumber,
                'mask_last4' => substr($accountNumber, -4),
                'account_type' => $accountType,
            ];
            $accounts[$accountNumber] = $current;
            continue;
        }
        if ($inItemsPaid) {
            continue;
        }
        if (
            str_starts_with($line, 'Disclosure Information')
            || preg_match('/^\d{4} Year to Date Federal Income Tax Information$/', $line)
        ) {
            $current = null;
            continue;
        }
        if ($current === null) {
            continue;
        }
        if (
            strpos($line, 'Date') === 0
            || strpos($line, 'Transaction Detail') === 0
            || strpos($line, 'Amount($)') === 0
            || strpos($line, 'Balance($)') === 0
            || $line === 'Joint Owner(s):'
            || $line === 'SARAH L GRAVES'
            || $line === 'Checking'
            || $line === 'Savings'
        ) {
            continue;
        }
        if (!preg_match('/^(\d{2}-\d{2})\s+(.+?)\s+([0-9,]+\.\d{2}(?:\s+-)?)?\s*([0-9,]+\.\d{2})\s*$/', $line, $matches)) {
            continue;
        }
        [$month, $day] = array_map('intval', explode('-', $matches[1], 2));
        $year = $month > $endMonth ? $startYear : $endYear;
        $date = sprintf('%04d-%02d-%02d', $year, $month, $day);
        $description = trim($matches[2]);
        $amountText = trim((string)($matches[3] ?? ''));
        $balance = accumul8_import_money($matches[4]);
        if (
            $description === ''
            || str_starts_with($description, 'Beginning Balance')
            || str_starts_with($description, 'Ending Balance')
            || $description === 'No Transactions This Period'
        ) {
            continue;
        }
        $amount = accumul8_import_money($amountText);
        if (str_ends_with($amountText, '-')) {
            $amount *= -1;
        }

        $transactions[] = [
            'date' => $date,
            'description' => $description,
            'amount' => $amount,
            'balance' => $balance,
            'account_number' => $current['account_number'],
            'account_name' => $current['account_name'],
            'account_type' => $current['account_type'],
            'institution' => $current['institution'],
            'group_name' => $current['group_name'],
            'source_file' => basename($path),
        ];
    }

    return ['accounts' => array_values($accounts), 'transactions' => $transactions];
}

function accumul8_import_statement_data(string $path): array
{
    $text = accumul8_import_pdf_text($path);
    if (str_contains($text, 'Capital One 360')) {
        return accumul8_import_parse_capital_one($path, $text);
    }
    if (str_contains($text, 'Navy Federal') || str_contains($text, 'Statement of Account')) {
        return accumul8_import_parse_navy($path, $text);
    }
    throw new RuntimeException('Unsupported statement format: ' . basename($path));
}

function accumul8_import_description_to_contact_name(string $description): string
{
    $name = strtoupper(trim($description));
    $patterns = [
        '/^DIGITAL CARD PURCHASE - /',
        '/^DEBIT CARD PURCHASE - /',
        '/^POS DEBIT- DEBIT CARD \d+\s+\d{2}-\d{2}-\d{2}\s+/',
        '/^PAID TO - /',
        '/^DEPOSIT - ACH PAID FROM /',
        '/^DEPOSIT FROM /',
        '/^WITHDRAWAL TO /',
    ];
    $name = preg_replace($patterns, '', $name) ?? $name;
    $name = preg_replace('/\s+X{3,}\d+/', '', $name) ?? $name;
    $aliases = [
        '/^AMAZON\b/' => 'Amazon',
        '/^AMZN\b/' => 'Amazon',
        '/^APPLE\.COM\/BILL\b/' => 'Apple',
        '/^ATT\*/' => 'ATT',
        '/^WAL-?MART\b/' => 'Walmart',
        '/^WM SUPERCENTER\b/' => 'Walmart',
        '/^WALMART COM\b/' => 'Walmart',
        '/^PUBLIX\b/' => 'Publix',
        '/^SPOTIFY\b/' => 'Spotify',
        '/^NETFLIX\.COM\b/' => 'Netflix',
        '/^IONOS\b/' => 'Ionos',
        '/^AUDIBLE\b/' => 'Audible',
        '/^HERO APP SUBSCRIPT\b/' => 'Hero',
        '/^ABC\*2385-ANYTIME F\b/' => 'Anytime Fitness',
        '/^PRIME VIDEO\b/' => 'Prime Video',
        '/^TRS OF GEORGIA BENEFIT\b/' => "TRS of Georgia",
        '/^SSA TREAS 310 XXSOC SEC\b/' => "Jon's SSA",
        '/^STATE FARM\b/' => 'State Farm Insurance',
        '/^STATE OF GEORGIA INS PREM\b/' => 'Health insurance',
        '/^ADP STATE OF GA PREMIUMS\b/' => 'Health insurance',
        '/^FAMILY\b/' => 'Family',
        '/^SARAH\b/' => 'Sarah',
        '/^JON\b/' => 'Jon',
        '/^VERONICA\b/' => 'Veronica',
        '/^EZRA\b/' => 'Ezra',
        '/^EXTENSIS PAYROLL\b/' => 'Extensis Payroll',
        '/^AUTOMATIONDIRECT PAYROLL\b/' => 'AutomationDirect Payroll',
        '/^VENMO CASHOUT\b/' => 'Venmo Cashout',
        '/^RCB INDUSTRIES RECEIVABLE\b/' => 'RCB Industries Receivable',
        '/^DAWSONVILLE NEWS\b/' => 'Dawsonville News',
        '/^MONARCH MONEY APP\b/' => 'Monarch Money',
    ];
    foreach ($aliases as $pattern => $canonical) {
        if (preg_match($pattern, $name)) {
            return $canonical;
        }
    }
    $name = preg_replace('/\s+[A-Z]{2}$/', '', $name) ?? $name;
    $name = preg_replace('/\s+\d{3,}.*$/', '', $name) ?? $name;
    $name = ucwords(strtolower(trim($name)));
    $name = $name === '' ? 'Unknown' : $name;
    return substr($name, 0, 191);
}

function accumul8_import_normalize_contact_key(string $name): string
{
    $name = strtolower(trim($name));
    $name = preg_replace('/[^a-z0-9]+/', '', $name) ?? $name;
    return $name;
}

function accumul8_import_ensure_schema(): void
{
    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_account_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        group_name VARCHAR(191) NOT NULL,
        institution_name VARCHAR(191) NOT NULL DEFAULT '',
        notes TEXT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_accumul8_account_group_owner_name (owner_user_id, group_name),
        KEY idx_accumul8_account_groups_owner (owner_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $column = Database::queryOne(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accumul8_accounts' AND COLUMN_NAME = 'account_group_id' LIMIT 1"
    );
    if (!$column) {
        Database::execute('ALTER TABLE accumul8_accounts ADD COLUMN account_group_id INT NULL');
    }
    $index = Database::queryOne(
        "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accumul8_accounts' AND INDEX_NAME = 'idx_accumul8_accounts_group' LIMIT 1"
    );
    if (!$index) {
        Database::execute('ALTER TABLE accumul8_accounts ADD INDEX idx_accumul8_accounts_group (account_group_id)');
    }
}

function accumul8_import_recompute_balances(int $ownerUserId): void
{
    $rows = Database::queryAll(
        'SELECT id, account_id, amount, COALESCE(rta_amount, 0.00) AS rta_amount, source_kind, running_balance
         FROM accumul8_transactions
         WHERE owner_user_id = ?
         ORDER BY account_id ASC, transaction_date ASC, id ASC',
        [$ownerUserId]
    );
    $balances = [];
    $statementAccounts = [];
    foreach ($rows as $row) {
        $accountId = isset($row['account_id']) ? (int)$row['account_id'] : 0;
        if (($row['source_kind'] ?? '') === ACCUMUL8_STATEMENT_SOURCE_KIND) {
            $statementAccounts[$accountId] = (float)($row['running_balance'] ?? 0);
            continue;
        }
        $balances[$accountId] = (float)($balances[$accountId] ?? 0);
        $balances[$accountId] += (float)($row['amount'] ?? 0) + (float)($row['rta_amount'] ?? 0);
        Database::execute(
            'UPDATE accumul8_transactions SET running_balance = ? WHERE id = ? AND owner_user_id = ?',
            [round($balances[$accountId], 2), (int)$row['id'], $ownerUserId]
        );
    }
    Database::execute('UPDATE accumul8_accounts SET current_balance = 0.00 WHERE owner_user_id = ?', [$ownerUserId]);
    foreach ($balances as $accountId => $balance) {
        if ($accountId <= 0) {
            continue;
        }
        Database::execute(
            'UPDATE accumul8_accounts SET current_balance = ?, available_balance = ? WHERE id = ? AND owner_user_id = ?',
            [round($balance, 2), round($balance, 2), $accountId, $ownerUserId]
        );
    }
    foreach ($statementAccounts as $accountId => $balance) {
        if ($accountId <= 0) {
            continue;
        }
        Database::execute(
            'UPDATE accumul8_accounts SET current_balance = ?, available_balance = ? WHERE id = ? AND owner_user_id = ?',
            [round($balance, 2), round($balance, 2), $accountId, $ownerUserId]
        );
    }
}

function accumul8_import_existing_contacts(int $ownerUserId): array
{
    $rows = Database::queryAll(
        'SELECT id, contact_name, contact_type FROM accumul8_contacts WHERE owner_user_id = ?',
        [$ownerUserId]
    );
    $contacts = [];
    foreach ($rows as $row) {
        $contacts[accumul8_import_normalize_contact_key((string)$row['contact_name'])] = [
            'id' => (int)$row['id'],
            'contact_name' => (string)$row['contact_name'],
            'contact_type' => (string)$row['contact_type'],
        ];
    }
    return $contacts;
}

function accumul8_import_ensure_contact(array &$contacts, int $ownerUserId, string $contactName, float $amount, bool $apply): ?int
{
    $key = accumul8_import_normalize_contact_key($contactName);
    if ($key === '') {
        return null;
    }
    $nextType = $amount >= 0 ? 'payer' : 'payee';
    if (isset($contacts[$key])) {
        $existing = $contacts[$key];
        $currentType = (string)$existing['contact_type'];
        if ($currentType !== 'both' && $currentType !== $nextType && $apply) {
            Database::execute(
                'UPDATE accumul8_contacts SET contact_type = ? WHERE id = ? AND owner_user_id = ?',
                ['both', (int)$existing['id'], $ownerUserId]
            );
            $contacts[$key]['contact_type'] = 'both';
        }
        return (int)$existing['id'];
    }
    if (!$apply) {
        return null;
    }
    Database::execute(
        'INSERT INTO accumul8_contacts (owner_user_id, contact_name, contact_type, default_amount, email, notes, is_active)
         VALUES (?, ?, ?, 0.00, NULL, NULL, 1)',
        [$ownerUserId, $contactName, $nextType]
    );
    $id = (int)Database::lastInsertId();
    $contacts[$key] = ['id' => $id, 'contact_name' => $contactName, 'contact_type' => $nextType];
    return $id;
}

function accumul8_import_ensure_group(int $ownerUserId, string $groupName, string $institutionName, bool $apply, array &$cache): ?int
{
    $key = $ownerUserId . ':' . strtolower($groupName);
    if (isset($cache[$key])) {
        return $cache[$key];
    }
    $existing = Database::queryOne(
        'SELECT id FROM accumul8_account_groups WHERE owner_user_id = ? AND group_name = ? LIMIT 1',
        [$ownerUserId, $groupName]
    );
    if ($existing) {
        $cache[$key] = (int)$existing['id'];
        return $cache[$key];
    }
    if (!$apply) {
        return null;
    }
    Database::execute(
        'INSERT INTO accumul8_account_groups (owner_user_id, group_name, institution_name, notes, is_active)
         VALUES (?, ?, ?, ?, 1)',
        [$ownerUserId, $groupName, $institutionName, null]
    );
    $cache[$key] = (int)Database::lastInsertId();
    return $cache[$key];
}

function accumul8_import_ensure_account(int $ownerUserId, array $account, ?int $groupId, bool $apply, array &$cache): ?int
{
    $key = $ownerUserId . ':' . $account['account_number'];
    if (isset($cache[$key])) {
        return $cache[$key];
    }
    $existing = Database::queryOne(
        'SELECT id FROM accumul8_accounts WHERE owner_user_id = ? AND mask_last4 = ? AND account_name = ? LIMIT 1',
        [$ownerUserId, $account['mask_last4'], $account['account_name']]
    );
    if ($existing) {
        if ($apply && $groupId !== null) {
            Database::execute(
                'UPDATE accumul8_accounts SET account_group_id = ?, institution_name = ?, account_type = ?, mask_last4 = ? WHERE id = ? AND owner_user_id = ?',
                [$groupId, $account['institution'], $account['account_type'], $account['mask_last4'], (int)$existing['id'], $ownerUserId]
            );
        }
        $cache[$key] = (int)$existing['id'];
        return $cache[$key];
    }
    if (!$apply) {
        return null;
    }
    Database::execute(
        'INSERT INTO accumul8_accounts
            (owner_user_id, account_group_id, account_name, account_type, institution_name, mask_last4, current_balance, available_balance, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 0.00, 0.00, 1)',
        [$ownerUserId, $groupId, $account['account_name'], $account['account_type'], $account['institution'], $account['mask_last4']]
    );
    $cache[$key] = (int)Database::lastInsertId();
    return $cache[$key];
}

function accumul8_import_external_id(array $tx): string
{
    return sha1(implode('|', [
        $tx['source_file'],
        $tx['account_number'],
        $tx['date'],
        number_format((float)$tx['amount'], 2, '.', ''),
        $tx['description'],
        number_format((float)($tx['balance'] ?? 0), 2, '.', ''),
    ]));
}

function accumul8_import_opening_external_id(array $account, string $date, float $openingBalance, string $sourceFile): string
{
    return sha1(implode('|', [
        'opening-balance',
        $sourceFile,
        (string)$account['account_number'],
        $date,
        number_format($openingBalance, 2, '.', ''),
    ]));
}

function accumul8_import_statement_files(string $dir): array
{
    $patterns = [
        $dir . '/*_STMSSCM.pdf',
        $dir . '/*-Bank statement.pdf',
    ];
    $files = [];
    foreach ($patterns as $pattern) {
        foreach (glob($pattern) ?: [] as $file) {
            $files[] = $file;
        }
    }
    sort($files, SORT_STRING);
    return array_values(array_unique($files));
}

$ownerUserId = (int)(accumul8_import_arg('owner-user-id', '1') ?? '1');
$dir = (string)(accumul8_import_arg('dir', '') ?? '');
$apply = accumul8_import_has_flag('apply');
if ($ownerUserId <= 0 || $dir === '' || !is_dir($dir)) {
    accumul8_import_usage();
    exit(1);
}

accumul8_import_ensure_schema();
$files = accumul8_import_statement_files($dir);
if (!$files) {
    throw new RuntimeException('No statement PDFs found in ' . $dir);
}

$groupCache = [];
$accountCache = [];
$contacts = accumul8_import_existing_contacts($ownerUserId);
$report = [
    'files' => count($files),
    'accounts_discovered' => 0,
    'transactions_discovered' => 0,
    'transactions_inserted' => 0,
    'transactions_skipped_existing' => 0,
    'contacts_created_or_matched' => 0,
    'opening_balances_discovered' => 0,
    'opening_balances_inserted' => 0,
    'opening_balances_skipped_existing' => 0,
];
$openingBalancesByAccountNumber = [];

foreach ($files as $file) {
    $parsed = accumul8_import_statement_data($file);
    foreach ($parsed['accounts'] as $account) {
        $groupId = accumul8_import_ensure_group($ownerUserId, (string)$account['group_name'], (string)$account['institution'], $apply, $groupCache);
        accumul8_import_ensure_account($ownerUserId, $account, $groupId, $apply, $accountCache);
        $report['accounts_discovered']++;
    }
    foreach ($parsed['accounts'] as $account) {
        $accountNumber = (string)($account['account_number'] ?? '');
        if ($accountNumber === '') {
            continue;
        }
        $accountTransactions = array_values(array_filter(
            $parsed['transactions'],
            static fn(array $tx): bool => (string)($tx['account_number'] ?? '') === $accountNumber
        ));
        if (!$accountTransactions) {
            continue;
        }
        usort($accountTransactions, static function (array $left, array $right): int {
            $dateCmp = strcmp((string)($left['date'] ?? ''), (string)($right['date'] ?? ''));
            if ($dateCmp !== 0) {
                return $dateCmp;
            }
            return strcmp((string)($left['description'] ?? ''), (string)($right['description'] ?? ''));
        });
        $firstTx = $accountTransactions[0];
        $openingDate = date('Y-m-d', strtotime(((string)$firstTx['date']) . ' -1 day'));
        $openingBalance = round((float)($firstTx['balance'] ?? 0) - (float)($firstTx['amount'] ?? 0), 2);
        if (
            !isset($openingBalancesByAccountNumber[$accountNumber])
            || strcmp($openingDate, (string)$openingBalancesByAccountNumber[$accountNumber]['date']) < 0
        ) {
            $openingBalancesByAccountNumber[$accountNumber] = [
                'account' => $account,
                'date' => $openingDate,
                'amount' => $openingBalance,
                'source_file' => basename($file),
            ];
        }
    }
    foreach ($parsed['transactions'] as $tx) {
        $report['transactions_discovered']++;
        $externalId = accumul8_import_external_id($tx);
        $existing = Database::queryOne(
            'SELECT id FROM accumul8_transactions WHERE owner_user_id = ? AND source_kind = ? AND external_id = ? LIMIT 1',
            [$ownerUserId, ACCUMUL8_STATEMENT_SOURCE_KIND, $externalId]
        );
        if ($existing) {
            $report['transactions_skipped_existing']++;
            continue;
        }
        $accountId = accumul8_import_ensure_account(
            $ownerUserId,
            [
                'account_number' => $tx['account_number'],
                'mask_last4' => substr((string)$tx['account_number'], -4),
                'account_name' => $tx['account_name'],
                'account_type' => $tx['account_type'],
                'institution' => $tx['institution'],
            ],
            accumul8_import_ensure_group($ownerUserId, (string)$tx['group_name'], (string)$tx['institution'], $apply, $groupCache),
            $apply,
            $accountCache
        );
        $contactName = accumul8_import_description_to_contact_name((string)$tx['description']);
        $contactId = accumul8_import_ensure_contact($contacts, $ownerUserId, $contactName, (float)$tx['amount'], $apply);
        $report['contacts_created_or_matched']++;
        if (!$apply) {
            continue;
        }
        Database::execute(
            'INSERT INTO accumul8_transactions
                (owner_user_id, account_id, contact_id, transaction_date, due_date, entry_type, description, memo, amount, rta_amount,
                 running_balance, is_paid, is_reconciled, is_recurring_instance, recurring_payment_id, source_kind, source_ref, external_id,
                 pending_status, created_by_user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, 1, 1, 0, NULL, ?, ?, ?, 0, ?)',
            [
                $ownerUserId,
                $accountId,
                $contactId,
                $tx['date'],
                $tx['date'],
                abs((float)$tx['amount']) < 0.00001 ? 'manual' : ((float)$tx['amount'] >= 0 ? 'deposit' : 'manual'),
                (string)$tx['description'],
                $contactName,
                round((float)$tx['amount'], 2),
                round((float)($tx['balance'] ?? 0), 2),
                ACCUMUL8_STATEMENT_SOURCE_KIND,
                (string)$tx['source_file'],
                $externalId,
                $ownerUserId,
            ]
        );
        $report['transactions_inserted']++;
    }
}

foreach ($openingBalancesByAccountNumber as $openingData) {
    $report['opening_balances_discovered']++;
    $account = (array)($openingData['account'] ?? []);
    $externalId = accumul8_import_opening_external_id(
        $account,
        (string)$openingData['date'],
        (float)$openingData['amount'],
        (string)$openingData['source_file']
    );
    $existing = Database::queryOne(
        'SELECT id FROM accumul8_transactions WHERE owner_user_id = ? AND source_kind = ? AND external_id = ? LIMIT 1',
        [$ownerUserId, ACCUMUL8_STATEMENT_SOURCE_KIND, $externalId]
    );
    if ($existing) {
        $report['opening_balances_skipped_existing']++;
        continue;
    }
    if (!$apply) {
        continue;
    }
    $accountId = accumul8_import_ensure_account(
        $ownerUserId,
        [
            'account_number' => $account['account_number'],
            'mask_last4' => substr((string)$account['account_number'], -4),
            'account_name' => $account['account_name'],
            'account_type' => $account['account_type'],
            'institution' => $account['institution'],
        ],
        accumul8_import_ensure_group($ownerUserId, (string)$account['group_name'], (string)$account['institution'], $apply, $groupCache),
        $apply,
        $accountCache
    );
    Database::execute(
        'INSERT INTO accumul8_transactions
            (owner_user_id, account_id, contact_id, transaction_date, due_date, entry_type, description, memo, amount, rta_amount,
             running_balance, is_paid, is_reconciled, is_recurring_instance, recurring_payment_id, source_kind, source_ref, external_id,
             pending_status, created_by_user_id)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 0.00, ?, 1, 1, 0, NULL, ?, ?, ?, 0, ?)',
        [
            $ownerUserId,
            $accountId,
            (string)$openingData['date'],
            (string)$openingData['date'],
            (float)$openingData['amount'] >= 0 ? 'deposit' : 'manual',
            'Opening Balance',
            null,
            round((float)$openingData['amount'], 2),
            round((float)$openingData['amount'], 2),
            ACCUMUL8_STATEMENT_SOURCE_KIND,
            (string)$openingData['source_file'],
            $externalId,
            $ownerUserId,
        ]
    );
    $report['opening_balances_inserted']++;
}

if ($apply) {
    accumul8_import_recompute_balances($ownerUserId);
}

echo json_encode([
    'apply' => $apply,
    'owner_user_id' => $ownerUserId,
    'directory' => $dir,
    'report' => $report,
], JSON_PRETTY_PRINT) . PHP_EOL;
