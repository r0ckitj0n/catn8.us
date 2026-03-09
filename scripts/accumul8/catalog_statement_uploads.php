<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/api/config.php';

function catalog_usage(): void
{
    fwrite(STDERR, "Usage: php scripts/accumul8/catalog_statement_uploads.php --owner-user-id=1 --dir=/absolute/path [--apply]\n");
}

function catalog_arg(string $name, ?string $default = null): ?string
{
    global $argv;
    foreach ($argv as $arg) {
        if (strpos($arg, '--' . $name . '=') === 0) {
            return substr($arg, strlen($name) + 3);
        }
    }
    return $default;
}

function catalog_has_flag(string $name): bool
{
    global $argv;
    return in_array('--' . $name, $argv, true);
}

function catalog_money(string $value): float
{
    $clean = str_replace([',', '$', ' '], '', trim($value));
    if ($clean === '') {
        return 0.0;
    }
    return round((float)$clean, 2);
}

function catalog_parse_money_line(string $line): ?float
{
    $line = trim($line);
    if (!preg_match('/^([+-])?\s*\$?([0-9,]+\.\d{2})(\s*-)?$/', $line, $matches)) {
        return null;
    }
    $amount = catalog_money($matches[2]);
    $negative = ($matches[1] ?? '') === '-' || trim((string)($matches[3] ?? '')) === '-';
    return $negative ? -$amount : $amount;
}

function catalog_is_money_line(string $line): bool
{
    return catalog_parse_money_line($line) !== null;
}

function catalog_clean_lines(string $text): array
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

function catalog_pdf_pages_text(string $path, bool $layout = false): array
{
    $cmd = $layout
        ? '/opt/homebrew/bin/pdftotext -layout ' . escapeshellarg($path) . ' -'
        : '/opt/homebrew/bin/pdftotext ' . escapeshellarg($path) . ' -';
    $output = shell_exec($cmd);
    if (!is_string($output) || $output === '') {
        throw new RuntimeException('Failed to extract PDF text for ' . $path);
    }
    $pages = preg_split("/\f/u", $output) ?: [];
    return array_values(array_filter(array_map(static fn(string $page): string => trim($page), $pages), static fn(string $page): bool => $page !== ''));
}

function catalog_capital_one_noise(string $line): bool
{
    static $noise = [
        'DATE', 'DESCRIPTION', 'CATEGORY', 'AMOUNT', 'BALANCE', 'capitalone.com',
        '1-888-464-0727', 'P.O. Box 85123, Richmond, VA 23285', 'Jonathan D Graves',
        'Thanks for saving with Capital One 360®', 'BALANCE', 'Debit', 'Credit', 'Interest Payment',
    ];
    if (in_array($line, $noise, true)) {
        return true;
    }
    if (preg_match('/^Page \d+ of \d+$/', $line)) {
        return true;
    }
    return false;
}

function catalog_capital_one_parse(string $path): array
{
    $pages = catalog_pdf_pages_text($path, false);
    $fullText = implode("\f", $pages);
    $layoutPages = catalog_pdf_pages_text($path, true);
    if (!preg_match('/STATEMENT PERIOD\s+([A-Z][a-z]{2}) (\d{1,2}) - ([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/u', $fullText, $periodMatches)) {
        throw new RuntimeException('Could not determine Capital One statement period for ' . basename($path));
    }
    $monthMap = [
        'Jan' => 1, 'Feb' => 2, 'Mar' => 3, 'Apr' => 4, 'May' => 5, 'Jun' => 6,
        'Jul' => 7, 'Aug' => 8, 'Sep' => 9, 'Oct' => 10, 'Nov' => 11, 'Dec' => 12,
    ];
    $startMonth = $monthMap[$periodMatches[1]] ?? 1;
    $startDay = (int)$periodMatches[2];
    $endMonth = $monthMap[$periodMatches[3]] ?? 1;
    $endDay = (int)$periodMatches[4];
    $year = (int)$periodMatches[5];
    $periodStart = sprintf('%04d-%02d-%02d', $year, $startMonth, $startDay);
    $periodEnd = sprintf('%04d-%02d-%02d', $year, $endMonth, $endDay);
    $summaryByName = [];
    foreach (catalog_clean_lines((string)($layoutPages[0] ?? '')) as $line) {
        if (!preg_match('/^(.*?)\s+\$([0-9,]+\.\d{2})\s+\$([0-9,]+\.\d{2})(?:\s+.*)?$/', $line, $summaryMatches)) {
            continue;
        }
        $name = trim(preg_replace('/^\-\s*/', '', $summaryMatches[1]) ?? $summaryMatches[1]);
        if ($name === '' || $name === 'ACCOUNT NAME' || $name === 'All Accounts') {
            continue;
        }
        $summaryByName[$name] = [
            'opening_balance' => catalog_money($summaryMatches[2]),
            'closing_balance' => catalog_money($summaryMatches[3]),
        ];
    }

    $records = [];
    foreach ($pages as $pageIndex => $pageText) {
        $lines = catalog_clean_lines($pageText);
        $currentAccountNumber = null;
        for ($i = 0, $count = count($lines); $i < $count; $i++) {
            $line = $lines[$i];
            if (preg_match('/^(.*?) - (\d{11})$/', $line, $matches)) {
                $accountName = trim(preg_replace('/^\-\s*/', '', $matches[1]) ?? $matches[1]);
                $accountNumber = $matches[2];
                $typeLine = strtoupper((string)($lines[$i + 1] ?? ''));
                $accountType = strpos($typeLine, 'SAVINGS') !== false ? 'savings' : 'checking';
                $currentAccountNumber = $accountNumber;
                if (!isset($records[$accountNumber])) {
                    $records[$accountNumber] = [
                        'institution_name' => 'Capital One 360',
                        'account_name_hint' => $accountName !== '' ? $accountName : 'Unnamed Account',
                        'account_mask_last4' => substr($accountNumber, -4),
                        'statement_kind' => 'bank_account',
                        'account_type' => $accountType,
                        'period_start' => $periodStart,
                        'period_end' => $periodEnd,
                        'opening_balance' => $summaryByName[$accountName]['opening_balance'] ?? null,
                        'closing_balance' => $summaryByName[$accountName]['closing_balance'] ?? null,
                        'transaction_locators' => [],
                    ];
                }
                continue;
            }
            if ($currentAccountNumber === null || !preg_match('/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})$/', $line, $matches)) {
                continue;
            }

            $month = $monthMap[$matches[1]] ?? 1;
            $day = (int)$matches[2];
            $txDate = sprintf('%04d-%02d-%02d', $year, $month, $day);
            $j = $i + 1;
            $descriptionParts = [];
            while ($j < $count) {
                $candidate = $lines[$j];
                if (catalog_capital_one_noise($candidate)) {
                    $j++;
                    continue;
                }
                if (preg_match('/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}$/', $candidate)) {
                    break;
                }
                if (preg_match('/^(.*?) - (\d{11})$/', $candidate)) {
                    break;
                }
                if (catalog_is_money_line($candidate)) {
                    break;
                }
                $descriptionParts[] = $candidate;
                $j++;
            }

            $description = trim(implode(' ', $descriptionParts));
            while ($j < $count && catalog_capital_one_noise($lines[$j])) {
                $j++;
            }
            $amount = $j < $count ? catalog_parse_money_line($lines[$j]) : null;
            if ($amount !== null) {
                $j++;
            }
            while ($j < $count && catalog_capital_one_noise($lines[$j])) {
                $j++;
            }
            $balance = ($j < $count && catalog_is_money_line($lines[$j])) ? catalog_money($lines[$j]) : null;

            if ($description === 'Opening Balance') {
                if ($amount !== null) {
                    $records[$currentAccountNumber]['opening_balance'] = round(abs($amount), 2);
                } elseif ($balance !== null) {
                    $records[$currentAccountNumber]['opening_balance'] = $balance;
                }
                $i = max($i, $j);
                continue;
            }
            if ($description === 'Ending Balance' || $description === 'Closing Balance') {
                if ($balance !== null) {
                    $records[$currentAccountNumber]['closing_balance'] = $balance;
                } elseif ($amount !== null) {
                    $records[$currentAccountNumber]['closing_balance'] = round(abs($amount), 2);
                }
                $i = max($i, $j);
                continue;
            }
            if ($description === '' || $amount === null) {
                continue;
            }

            $records[$currentAccountNumber]['transaction_locators'][] = [
                'transaction_date' => $txDate,
                'description' => $description,
                'amount' => round($amount, 2),
                'running_balance' => $balance !== null ? round($balance, 2) : null,
                'page_number' => $pageIndex + 1,
            ];
            if ($balance !== null) {
                $records[$currentAccountNumber]['closing_balance'] = round($balance, 2);
            }
            if ($records[$currentAccountNumber]['opening_balance'] === null && $balance !== null) {
                $records[$currentAccountNumber]['opening_balance'] = round($balance - $amount, 2);
            }
            $i = max($i, $j - 1);
        }
    }

    foreach ($records as $accountNumber => $record) {
        $accountName = (string)($record['account_name_hint'] ?? '');
        if (isset($summaryByName[$accountName]['opening_balance'])) {
            $records[$accountNumber]['opening_balance'] = $summaryByName[$accountName]['opening_balance'];
        }
        if (isset($summaryByName[$accountName]['closing_balance'])) {
            $records[$accountNumber]['closing_balance'] = $summaryByName[$accountName]['closing_balance'];
        }
    }

    return array_values($records);
}

function catalog_navy_summary(array $lines): array
{
    $summary = [];
    for ($i = 0, $count = count($lines); $i < $count - 1; $i++) {
        $name = trim($lines[$i]);
        $number = trim($lines[$i + 1] ?? '');
        if (!preg_match('/^\d{10}$/', $number)) {
            continue;
        }
        $money = [];
        for ($j = $i + 2; $j < min($count, $i + 8); $j++) {
            if (preg_match('/^\$[0-9,]+\.\d{2}$/', $lines[$j])) {
                $money[] = catalog_money($lines[$j]);
            }
        }
        if (count($money) < 4) {
            continue;
        }
        $summary[$number] = [
            'opening_balance' => $money[0],
            'closing_balance' => $money[3],
            'account_name_hint' => $name,
        ];
    }
    return $summary;
}

function catalog_navy_parse(string $path): array
{
    $pages = catalog_pdf_pages_text($path, true);
    $fullText = implode("\f", $pages);
    if (!preg_match('/Statement Period\s+(\d{2})\/(\d{2})\/(\d{2}) - (\d{2})\/(\d{2})\/(\d{2})/u', $fullText, $matches)) {
        throw new RuntimeException('Could not determine Navy Federal statement period for ' . basename($path));
    }
    $periodStart = sprintf('%04d-%02d-%02d', 2000 + (int)$matches[3], (int)$matches[1], (int)$matches[2]);
    $periodEnd = sprintf('%04d-%02d-%02d', 2000 + (int)$matches[6], (int)$matches[4], (int)$matches[5]);
    $startYear = 2000 + (int)$matches[3];
    $endMonth = (int)$matches[4];
    $endYear = 2000 + (int)$matches[6];
    $summary = catalog_navy_summary(catalog_clean_lines((string)($pages[0] ?? '')));
    $records = [];

    foreach ($pages as $pageIndex => $pageText) {
        $lines = preg_split('/\R/u', str_replace("\f", "\n", $pageText)) ?: [];
        $currentAccountNumber = null;
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
            if (preg_match('/^(EveryDay Checking|Membership Savings) - (\d{10})$/', $line, $headerMatches)) {
                $inItemsPaid = false;
                $currentAccountNumber = $headerMatches[2];
                $accountType = stripos($headerMatches[1], 'savings') !== false ? 'savings' : 'checking';
                if (!isset($records[$currentAccountNumber])) {
                    $records[$currentAccountNumber] = [
                        'institution_name' => 'Navy Federal Credit Union',
                        'account_name_hint' => $headerMatches[1],
                        'account_mask_last4' => substr($currentAccountNumber, -4),
                        'statement_kind' => 'bank_account',
                        'account_type' => $accountType,
                        'period_start' => $periodStart,
                        'period_end' => $periodEnd,
                        'opening_balance' => $summary[$currentAccountNumber]['opening_balance'] ?? null,
                        'closing_balance' => $summary[$currentAccountNumber]['closing_balance'] ?? null,
                        'transaction_locators' => [],
                    ];
                }
                continue;
            }
            if ($inItemsPaid || $currentAccountNumber === null) {
                continue;
            }
            if (preg_match('/^(\d{2})-(\d{2})\s+Beginning Balance\s+([0-9,]+\.\d{2})\s*$/', $line, $beginMatches)) {
                $records[$currentAccountNumber]['opening_balance'] = catalog_money($beginMatches[3]);
                continue;
            }
            if (!preg_match('/^(\d{2})-(\d{2})\s+(.+?)\s+([0-9,]+\.\d{2}(?:\s+-)?)?\s*([0-9,]+\.\d{2})\s*$/', $line, $txMatches)) {
                continue;
            }
            $month = (int)$txMatches[1];
            $day = (int)$txMatches[2];
            $year = $month > $endMonth ? $startYear : $endYear;
            $txDate = sprintf('%04d-%02d-%02d', $year, $month, $day);
            $description = trim($txMatches[3]);
            if (
                $description === ''
                || str_starts_with($description, 'Beginning Balance')
                || str_starts_with($description, 'Ending Balance')
                || $description === 'No Transactions This Period'
            ) {
                continue;
            }
            $amountText = trim((string)($txMatches[4] ?? ''));
            $amount = catalog_money($amountText);
            if (str_ends_with($amountText, '-')) {
                $amount *= -1;
            }
            $balance = catalog_money($txMatches[5]);
            $records[$currentAccountNumber]['transaction_locators'][] = [
                'transaction_date' => $txDate,
                'description' => $description,
                'amount' => round($amount, 2),
                'running_balance' => round($balance, 2),
                'page_number' => $pageIndex + 1,
            ];
            $records[$currentAccountNumber]['closing_balance'] = round($balance, 2);
        }
    }

    return array_values($records);
}

function catalog_statement_records(string $path): array
{
    $pages = catalog_pdf_pages_text($path, false);
    $firstPage = (string)($pages[0] ?? '');
    if (str_contains($firstPage, 'Capital One 360')) {
        return catalog_capital_one_parse($path);
    }
    $layoutPages = catalog_pdf_pages_text($path, true);
    $layoutFirstPage = (string)($layoutPages[0] ?? '');
    if (str_contains($layoutFirstPage, 'Navy Federal') || str_contains($layoutFirstPage, 'Statement of Account')) {
        return catalog_navy_parse($path);
    }
    throw new RuntimeException('Unsupported statement format: ' . basename($path));
}

function catalog_ensure_statement_schema(): void
{
    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_statement_uploads (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        account_id INT NULL,
        statement_kind VARCHAR(24) NOT NULL DEFAULT 'bank_account',
        status VARCHAR(24) NOT NULL DEFAULT 'uploaded',
        original_filename VARCHAR(255) NOT NULL,
        mime_type VARCHAR(191) NOT NULL,
        file_size_bytes INT NOT NULL DEFAULT 0,
        file_sha256 CHAR(64) NOT NULL,
        file_blob LONGBLOB NOT NULL,
        extracted_text LONGTEXT NULL,
        extracted_method VARCHAR(32) NOT NULL DEFAULT '',
        ai_provider VARCHAR(64) NOT NULL DEFAULT '',
        ai_model VARCHAR(191) NOT NULL DEFAULT '',
        institution_name VARCHAR(191) NOT NULL DEFAULT '',
        account_name_hint VARCHAR(191) NOT NULL DEFAULT '',
        account_mask_last4 VARCHAR(16) NOT NULL DEFAULT '',
        period_start DATE NULL,
        period_end DATE NULL,
        opening_balance DECIMAL(10,2) NULL,
        closing_balance DECIMAL(10,2) NULL,
        imported_transaction_count INT NOT NULL DEFAULT 0,
        duplicate_transaction_count INT NOT NULL DEFAULT 0,
        suspicious_item_count INT NOT NULL DEFAULT 0,
        reconciliation_status VARCHAR(24) NOT NULL DEFAULT 'pending',
        reconciliation_note TEXT NULL,
        suspicious_items_json LONGTEXT NULL,
        processing_notes_json LONGTEXT NULL,
        transaction_locator_json LONGTEXT NULL,
        parsed_payload_json LONGTEXT NULL,
        last_error TEXT NULL,
        processed_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_accumul8_statement_owner (owner_user_id),
        KEY idx_accumul8_statement_account (account_id),
        KEY idx_accumul8_statement_status (status),
        CONSTRAINT fk_accumul8_statement_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_accumul8_statement_account FOREIGN KEY (account_id) REFERENCES accumul8_accounts(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function catalog_find_account_id(int $ownerUserId, array $record): ?int
{
    $last4 = trim((string)($record['account_mask_last4'] ?? ''));
    $accountName = trim((string)($record['account_name_hint'] ?? ''));
    $institution = trim((string)($record['institution_name'] ?? ''));

    if ($last4 !== '') {
        $row = Database::queryOne(
            'SELECT id
             FROM accumul8_accounts
             WHERE owner_user_id = ?
               AND mask_last4 = ?
               AND (? = "" OR account_name = ? OR institution_name = ?)
             ORDER BY id ASC
             LIMIT 1',
            [$ownerUserId, $last4, $accountName, $accountName, $institution]
        );
        if ($row) {
            return (int)$row['id'];
        }
    }

    if ($accountName !== '') {
        $row = Database::queryOne(
            'SELECT id
             FROM accumul8_accounts
             WHERE owner_user_id = ?
               AND account_name = ?
             ORDER BY id ASC
             LIMIT 1',
            [$ownerUserId, $accountName]
        );
        if ($row) {
            return (int)$row['id'];
        }
    }

    return null;
}

function catalog_upsert_statement_row(int $ownerUserId, string $path, string $bytes, array $record, bool $apply): array
{
    $sha = hash('sha256', $bytes);
    $accountId = catalog_find_account_id($ownerUserId, $record);
    $existing = Database::queryOne(
        'SELECT id
         FROM accumul8_statement_uploads
         WHERE owner_user_id = ?
           AND file_sha256 = ?
           AND COALESCE(account_id, 0) = ?
           AND account_name_hint = ?
           AND period_start <=> ?
           AND period_end <=> ?
         LIMIT 1',
        [
            $ownerUserId,
            $sha,
            $accountId ?: 0,
            (string)($record['account_name_hint'] ?? ''),
            $record['period_start'] ?? null,
            $record['period_end'] ?? null,
        ]
    );

    $payloadJson = json_encode($record, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $locatorJson = json_encode($record['transaction_locators'] ?? [], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $notesJson = json_encode([
        'Cataloged for safe record keeping only.',
        'Transactions were already imported separately and were not re-imported by this script.',
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    if (!$apply) {
        return [
            'action' => $existing ? 'would_update' : 'would_insert',
            'existing_id' => isset($existing['id']) ? (int)$existing['id'] : null,
            'account_id' => $accountId,
        ];
    }

    if ($existing) {
        Database::execute(
            'UPDATE accumul8_statement_uploads
             SET account_id = ?, statement_kind = ?, status = ?, original_filename = ?, mime_type = ?, file_size_bytes = ?, file_sha256 = ?, file_blob = ?,
                 extracted_text = NULL, extracted_method = ?, ai_provider = "", ai_model = "", institution_name = ?, account_name_hint = ?, account_mask_last4 = ?,
                 period_start = ?, period_end = ?, opening_balance = ?, closing_balance = ?, imported_transaction_count = 0, duplicate_transaction_count = 0,
                 suspicious_item_count = 0, reconciliation_status = ?, reconciliation_note = ?, suspicious_items_json = "[]", processing_notes_json = ?, transaction_locator_json = ?,
                 parsed_payload_json = ?, last_error = NULL, processed_at = NOW()
             WHERE id = ? AND owner_user_id = ?',
            [
                $accountId,
                (string)($record['statement_kind'] ?? 'bank_account'),
                'cataloged',
                basename($path),
                'application/pdf',
                strlen($bytes),
                $sha,
                $bytes,
                'pdftotext',
                (string)($record['institution_name'] ?? ''),
                (string)($record['account_name_hint'] ?? ''),
                (string)($record['account_mask_last4'] ?? ''),
                $record['period_start'] ?? null,
                $record['period_end'] ?? null,
                $record['opening_balance'] ?? null,
                $record['closing_balance'] ?? null,
                'reference_only',
                'Cataloged for record keeping; no transactions were imported from this save operation.',
                $notesJson,
                $locatorJson,
                $payloadJson,
                (int)$existing['id'],
                $ownerUserId,
            ]
        );
        return ['action' => 'updated', 'existing_id' => (int)$existing['id'], 'account_id' => $accountId];
    }

    Database::execute(
        'INSERT INTO accumul8_statement_uploads
         (owner_user_id, account_id, statement_kind, status, original_filename, mime_type, file_size_bytes, file_sha256, file_blob,
          extracted_text, extracted_method, ai_provider, ai_model, institution_name, account_name_hint, account_mask_last4,
          period_start, period_end, opening_balance, closing_balance, imported_transaction_count, duplicate_transaction_count,
          suspicious_item_count, reconciliation_status, reconciliation_note, suspicious_items_json, processing_notes_json,
          transaction_locator_json, parsed_payload_json, last_error, processed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, "", "", ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, "[]", ?, ?, ?, NULL, NOW())',
        [
            $ownerUserId,
            $accountId,
            (string)($record['statement_kind'] ?? 'bank_account'),
            'cataloged',
            basename($path),
            'application/pdf',
            strlen($bytes),
            $sha,
            $bytes,
            'pdftotext',
            (string)($record['institution_name'] ?? ''),
            (string)($record['account_name_hint'] ?? ''),
            (string)($record['account_mask_last4'] ?? ''),
            $record['period_start'] ?? null,
            $record['period_end'] ?? null,
            $record['opening_balance'] ?? null,
            $record['closing_balance'] ?? null,
            'reference_only',
            'Cataloged for record keeping; no transactions were imported from this save operation.',
            $notesJson,
            $locatorJson,
            $payloadJson,
        ]
    );

    return ['action' => 'inserted', 'existing_id' => (int)Database::lastInsertId(), 'account_id' => $accountId];
}

$ownerUserId = (int)(catalog_arg('owner-user-id', '1') ?? '1');
$dir = (string)(catalog_arg('dir', '') ?? '');
$apply = catalog_has_flag('apply');
if ($ownerUserId <= 0 || $dir === '' || !is_dir($dir)) {
    catalog_usage();
    exit(1);
}

catalog_ensure_statement_schema();
$files = array_values(array_filter(glob(rtrim($dir, '/') . '/*.pdf') ?: [], static fn(string $file): bool => is_file($file)));
sort($files, SORT_STRING);
if (!$files) {
    throw new RuntimeException('No PDF statements found in ' . $dir);
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$report = [
    'apply' => $apply,
    'owner_user_id' => $ownerUserId,
    'directory' => $dir,
    'files' => count($files),
    'statement_rows' => 0,
    'inserted' => 0,
    'updated' => 0,
    'matched_accounts' => 0,
    'unmatched_accounts' => 0,
    'records' => [],
];

foreach ($files as $file) {
    $bytes = file_get_contents($file);
    if (!is_string($bytes) || $bytes === '') {
        throw new RuntimeException('Could not read ' . $file);
    }
    $mime = $finfo->buffer($bytes) ?: '';
    if ($mime !== 'application/pdf') {
        throw new RuntimeException('Unsupported MIME type for ' . basename($file) . ': ' . $mime);
    }

    $records = catalog_statement_records($file);
    foreach ($records as $record) {
        $result = catalog_upsert_statement_row($ownerUserId, $file, $bytes, $record, $apply);
        $report['statement_rows']++;
        if (in_array($result['action'], ['inserted', 'would_insert'], true)) {
            $report['inserted']++;
        }
        if (in_array($result['action'], ['updated', 'would_update'], true)) {
            $report['updated']++;
        }
        if (isset($result['account_id']) && (int)$result['account_id'] > 0) {
            $report['matched_accounts']++;
        } else {
            $report['unmatched_accounts']++;
        }
        $report['records'][] = [
            'file' => basename($file),
            'account_name_hint' => (string)($record['account_name_hint'] ?? ''),
            'account_mask_last4' => (string)($record['account_mask_last4'] ?? ''),
            'institution_name' => (string)($record['institution_name'] ?? ''),
            'period_start' => $record['period_start'] ?? null,
            'period_end' => $record['period_end'] ?? null,
            'opening_balance' => $record['opening_balance'] ?? null,
            'closing_balance' => $record['closing_balance'] ?? null,
            'transaction_locator_count' => count($record['transaction_locators'] ?? []),
            'action' => $result['action'],
            'statement_upload_id' => $result['existing_id'] ?? null,
            'account_id' => $result['account_id'] ?? null,
        ];
    }
}

echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
