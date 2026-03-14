<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/emailer.php';
require_once __DIR__ . '/settings/ai_test_functions.php';
require_once __DIR__ . '/../includes/accumul8_entity_normalization.php';
require_once __DIR__ . '/../includes/diagnostics_log.php';
require_once __DIR__ . '/../includes/vertex_ai_gemini.php';

const ACCUMUL8_ENTITY_ALIAS_REVIEW_VERSION = 2;
const ACCUMUL8_ENTITY_ALIAS_AI_BATCH_SIZE = 20;

if (!defined('CATN8_ACCUMUL8_LIBRARY_ONLY')) {
    catn8_session_start();
    catn8_groups_seed_core();
    $actorUserId = catn8_require_group_or_admin('accumul8-users');
} else {
    $actorUserId = 0;
}

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

function accumul8_teller_is_watched_institution(?string $institutionId, ?string $institutionName): bool
{
    $normalizedId = strtolower(accumul8_normalize_text((string)$institutionId, 64));
    if ($normalizedId !== '' && in_array($normalizedId, ['fifth_third', 'truist'], true)) {
        return true;
    }

    $normalizedName = accumul8_normalize_text((string)$institutionName, 191);
    if ($normalizedName === '') {
        return false;
    }

    return preg_match('/fifth\s*third|5\/3|truist/i', $normalizedName) === 1;
}

function accumul8_teller_log_diagnostic(string $eventKey, bool $ok, ?int $httpStatus, string $message, array $meta = []): void
{
    catn8_diagnostics_log_event($eventKey, $ok, $httpStatus, $message, $meta);
}

function accumul8_is_generic_import_artifact_text($value): bool
{
    $text = accumul8_normalize_text($value, 4000);
    if ($text === '') {
        return false;
    }

    $patterns = [
        '/^Imported from Budget\.xlsx(?:\b.*)?$/i',
        '/^Imported from monthly PDF statements$/i',
        '/^Imported from statement opening balance$/i',
        '/^Imported from .+ sheet(?:\b.*)?$/i',
        '/^Statement import parent(?:\..*)?$/i',
    ];

    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $text) === 1) {
            return true;
        }
    }

    return false;
}

function accumul8_filter_note_for_display($value, int $maxLen = 4000): string
{
    $text = accumul8_normalize_text($value, $maxLen);
    return accumul8_is_generic_import_artifact_text($text) ? '' : $text;
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

function accumul8_normalize_optional_url($value, int $maxLen = 2048): string
{
    $url = trim((string)$value);
    if ($url === '') {
        return '';
    }
    if (strlen($url) > $maxLen) {
        $url = substr($url, 0, $maxLen);
    }
    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid URL'], 400);
    }
    return $url;
}

function accumul8_normalize_optional_email($value, int $maxLen = 191): string
{
    $email = accumul8_normalize_text($value, $maxLen);
    if ($email === '') {
        return '';
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid email'], 400);
    }
    return $email;
}

function accumul8_normalize_optional_day_of_month($value, string $fieldName): ?int
{
    if ($value === null || $value === '') {
        return null;
    }
    $day = (int)$value;
    if ($day < 1 || $day > 31) {
        catn8_json_response(['success' => false, 'error' => 'Invalid ' . $fieldName], 400);
    }
    return $day;
}

function accumul8_normalize_decimal_value($value, string $fieldName): float
{
    $amount = accumul8_normalize_amount($value);
    if (!is_finite($amount)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid ' . $fieldName], 400);
    }
    return $amount;
}

function accumul8_extract_json_from_text(string $content): string
{
    $content = trim($content);
    if ($content === '') {
        return '';
    }
    if ($content[0] === '{' || $content[0] === '[') {
        return $content;
    }
    if (preg_match('/```(?:json)?\s*(\{.*\}|\[.*\])\s*```/si', $content, $matches)) {
        return trim((string)($matches[1] ?? ''));
    }
    $start = strpos($content, '{');
    $end = strrpos($content, '}');
    if ($start !== false && $end !== false && $end > $start) {
        return trim(substr($content, $start, $end - $start + 1));
    }
    return '';
}

function accumul8_openai_response_error_message(?array $json): string
{
    if (!is_array($json)) {
        return '';
    }
    $error = $json['error'] ?? null;
    if (is_string($error) && trim($error) !== '') {
        return trim($error);
    }
    if (is_array($error) && isset($error['message']) && is_string($error['message']) && trim($error['message']) !== '') {
        return trim((string)$error['message']);
    }
    return '';
}

function accumul8_openai_response_output_text(?array $json): string
{
    if (!is_array($json)) {
        return '';
    }
    $content = trim((string)($json['output_text'] ?? ''));
    if ($content !== '') {
        return $content;
    }
    foreach (($json['output'] ?? []) as $outputItem) {
        if (!is_array($outputItem)) {
            continue;
        }
        foreach (($outputItem['content'] ?? []) as $contentItem) {
            if (!is_array($contentItem)) {
                continue;
            }
            $text = trim((string)($contentItem['text'] ?? ''));
            if ($text !== '') {
                return $text;
            }
        }
    }
    return '';
}

function accumul8_openai_statement_pdf_model(string $configuredModel): string
{
    $configuredModel = strtolower(trim($configuredModel));
    if ($configuredModel !== '' && (str_starts_with($configuredModel, 'gpt-4o') || str_starts_with($configuredModel, 'o1'))) {
        return $configuredModel;
    }
    return 'gpt-4o-mini';
}

function accumul8_statement_openai_max_output_tokens(): int
{
    return 12000;
}

function accumul8_statement_cleanup_rendered_pages(array $pages): void
{
    foreach ($pages as $page) {
        if (!is_array($page)) {
            continue;
        }
        $path = (string)($page['path'] ?? '');
        if ($path !== '' && is_file($path)) {
            @unlink($path);
        }
    }
}

function accumul8_openai_responses_json(string $model, array $input, string $baseUrl = '', float $temperature = 0.0, int $maxOutputTokens = 4096, ?array $textConfig = null, int $timeoutSeconds = 90): array
{
    $apiKey = secret_get(catn8_settings_ai_secret_key('openai', 'api_key'));
    if (!is_string($apiKey) || trim($apiKey) === '') {
        throw new RuntimeException('Missing AI API key (openai)');
    }

    $root = $baseUrl !== '' ? rtrim(catn8_validate_external_base_url($baseUrl), '/') : 'https://api.openai.com';
    if (!preg_match('#/v\d+$#', $root)) {
        $root .= '/v1';
    }

    $payload = [
        'model' => $model !== '' ? $model : 'gpt-4o-mini',
        'input' => $input,
        'temperature' => $temperature,
        'max_output_tokens' => $maxOutputTokens,
        'text' => $textConfig ?: [
            'format' => [
                'type' => 'json_object',
            ],
        ],
    ];

    $resp = catn8_http_json_with_status(
        'POST',
        $root . '/responses',
        [
            'Authorization' => 'Bearer ' . trim((string)$apiKey),
            'Content-Type' => 'application/json',
        ],
        $payload,
        10,
        $timeoutSeconds
    );

    $status = (int)($resp['status'] ?? 0);
    $json = is_array($resp['json'] ?? null) ? $resp['json'] : null;
    if ($status < 200 || $status >= 300) {
        $error = accumul8_openai_response_error_message($json);
        throw new RuntimeException('HTTP ' . $status . ($error !== '' ? ': ' . $error : ''));
    }
    if (is_array($json) && isset($json['refusal']) && is_string($json['refusal']) && trim($json['refusal']) !== '') {
        throw new RuntimeException('OpenAI refused the statement extraction request');
    }

    $content = accumul8_openai_response_output_text($json);
    $jsonText = accumul8_extract_json_from_text($content);
    $decoded = json_decode($jsonText, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('OpenAI returned invalid statement JSON');
    }

    return [
        'content' => $content,
        'json' => $decoded,
    ];
}

function accumul8_openai_responses_text(string $model, array $input, string $baseUrl = '', float $temperature = 0.0, int $maxOutputTokens = 4096, int $timeoutSeconds = 90): array
{
    $apiKey = secret_get(catn8_settings_ai_secret_key('openai', 'api_key'));
    if (!is_string($apiKey) || trim($apiKey) === '') {
        throw new RuntimeException('Missing AI API key (openai)');
    }

    $root = $baseUrl !== '' ? rtrim(catn8_validate_external_base_url($baseUrl), '/') : 'https://api.openai.com';
    if (!preg_match('#/v\d+$#', $root)) {
        $root .= '/v1';
    }

    $payload = [
        'model' => $model !== '' ? $model : 'gpt-4o-mini',
        'input' => $input,
        'temperature' => $temperature,
        'max_output_tokens' => $maxOutputTokens,
        'text' => [
            'format' => [
                'type' => 'text',
            ],
        ],
    ];

    $resp = catn8_http_json_with_status(
        'POST',
        $root . '/responses',
        [
            'Authorization' => 'Bearer ' . trim((string)$apiKey),
            'Content-Type' => 'application/json',
        ],
        $payload,
        10,
        $timeoutSeconds
    );

    $status = (int)($resp['status'] ?? 0);
    $json = is_array($resp['json'] ?? null) ? $resp['json'] : null;
    if ($status < 200 || $status >= 300) {
        $error = accumul8_openai_response_error_message($json);
        throw new RuntimeException('HTTP ' . $status . ($error !== '' ? ': ' . $error : ''));
    }

    $content = accumul8_openai_response_output_text($json);
    if (trim($content) === '') {
        throw new RuntimeException('OpenAI returned an empty AIcountant response');
    }

    return [
        'content' => $content,
        'raw' => $json ?: [],
    ];
}

function accumul8_statement_openai_response_format(): array
{
    return [
        'format' => [
            'type' => 'json_schema',
            'name' => 'accumul8_statement_extract',
            'strict' => true,
            'schema' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => [
                    'statement_kind',
                    'institution_name',
                    'account_name_hint',
                    'account_last4',
                    'period_start',
                    'period_end',
                    'opening_balance',
                    'closing_balance',
                    'account_sections',
                    'transactions',
                ],
                'properties' => [
                    'statement_kind' => [
                        'type' => 'string',
                        'enum' => ['bank_account', 'credit_card', 'loan', 'mortgage', 'other'],
                    ],
                    'institution_name' => ['type' => 'string'],
                    'account_name_hint' => ['type' => 'string'],
                    'account_last4' => ['type' => 'string'],
                    'period_start' => ['type' => 'string'],
                    'period_end' => ['type' => 'string'],
                    'opening_balance' => [
                        'anyOf' => [
                            ['type' => 'number'],
                            ['type' => 'null'],
                        ],
                    ],
                    'closing_balance' => [
                        'anyOf' => [
                            ['type' => 'number'],
                            ['type' => 'null'],
                        ],
                    ],
                    'account_sections' => [
                        'type' => 'array',
                        'items' => [
                            'type' => 'object',
                            'additionalProperties' => false,
                            'required' => [
                                'account_name_hint',
                                'account_last4',
                                'transactions',
                            ],
                            'properties' => [
                                'account_name_hint' => ['type' => 'string'],
                                'account_last4' => ['type' => 'string'],
                                'transactions' => [
                                    'type' => 'array',
                                    'items' => [
                                        'type' => 'object',
                                        'additionalProperties' => false,
                                        'required' => [
                                            'transaction_date',
                                            'posted_date',
                                            'description',
                                            'memo',
                                            'amount',
                                            'running_balance',
                                            'page_number',
                                            'statement_account_name_hint',
                                            'statement_account_last4',
                                        ],
                                        'properties' => [
                                            'transaction_date' => ['type' => 'string'],
                                            'posted_date' => ['type' => 'string'],
                                            'description' => ['type' => 'string'],
                                            'memo' => ['type' => 'string'],
                                            'amount' => ['type' => 'number'],
                                            'running_balance' => [
                                                'anyOf' => [
                                                    ['type' => 'number'],
                                                    ['type' => 'null'],
                                                ],
                                            ],
                                            'page_number' => [
                                                'anyOf' => [
                                                    ['type' => 'integer'],
                                                    ['type' => 'null'],
                                                ],
                                            ],
                                            'statement_account_name_hint' => ['type' => 'string'],
                                            'statement_account_last4' => ['type' => 'string'],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                    ],
                    'transactions' => [
                        'type' => 'array',
                        'items' => [
                            'type' => 'object',
                            'additionalProperties' => false,
                            'required' => [
                                'transaction_date',
                                'posted_date',
                                'description',
                                'memo',
                                'amount',
                                'running_balance',
                                'page_number',
                                'statement_account_name_hint',
                                'statement_account_last4',
                            ],
                            'properties' => [
                                'transaction_date' => ['type' => 'string'],
                                'posted_date' => ['type' => 'string'],
                                'description' => ['type' => 'string'],
                                'memo' => ['type' => 'string'],
                                'amount' => ['type' => 'number'],
                                'running_balance' => [
                                    'anyOf' => [
                                        ['type' => 'number'],
                                        ['type' => 'null'],
                                    ],
                                ],
                                'page_number' => [
                                    'anyOf' => [
                                        ['type' => 'integer'],
                                        ['type' => 'null'],
                                    ],
                                ],
                                'statement_account_name_hint' => ['type' => 'string'],
                                'statement_account_last4' => ['type' => 'string'],
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ];
}

function accumul8_statement_normalize_kind($value): string
{
    return accumul8_validate_enum('statement_kind', $value, ['bank_account', 'credit_card', 'loan', 'mortgage', 'other'], 'bank_account');
}

function accumul8_statement_section_key(string $nameHint, string $last4): string
{
    return strtolower(trim($nameHint)) . '|' . preg_replace('/\D+/', '', $last4);
}

function accumul8_statement_build_account_tag_label(string $nameHint, string $last4): string
{
    $parts = array_values(array_filter([
        accumul8_normalize_text($nameHint, 191),
        $last4 !== '' ? '••' . $last4 : '',
    ], static fn($value): bool => trim((string)$value) !== ''));
    return implode(' ', $parts);
}

function accumul8_statement_normalize_parsed_payload(array $parsed): array
{
    $transactions = [];
    $topLevelName = accumul8_normalize_text((string)($parsed['account_name_hint'] ?? ''), 191);
    $topLevelLast4 = accumul8_normalize_text((string)($parsed['account_last4'] ?? $parsed['account_mask_last4'] ?? ''), 16);
    $normalizedSections = [];

    foreach ((array)($parsed['account_sections'] ?? []) as $section) {
        if (!is_array($section)) {
            continue;
        }
        $sectionName = accumul8_normalize_text((string)($section['account_name_hint'] ?? ''), 191);
        $sectionLast4 = accumul8_normalize_text((string)($section['account_last4'] ?? ''), 16);
        if ($topLevelName === '' && $sectionName !== '') {
            $topLevelName = $sectionName;
        }
        if ($topLevelLast4 === '' && $sectionLast4 !== '') {
            $topLevelLast4 = $sectionLast4;
        }
        $sectionTransactions = [];
        foreach ((array)($section['transactions'] ?? []) as $tx) {
            if (!is_array($tx)) {
                continue;
            }
            $rowName = accumul8_normalize_text((string)($tx['statement_account_name_hint'] ?? $sectionName ?: $topLevelName), 191);
            $rowLast4 = accumul8_normalize_text((string)($tx['statement_account_last4'] ?? $sectionLast4 ?: $topLevelLast4), 16);
            if ($topLevelName === '' && $rowName !== '') {
                $topLevelName = $rowName;
            }
            if ($topLevelLast4 === '' && $rowLast4 !== '') {
                $topLevelLast4 = $rowLast4;
            }
            $tx['statement_account_name_hint'] = $rowName;
            $tx['statement_account_last4'] = $rowLast4;
            $sectionTransactions[] = $tx;
            $transactions[] = $tx;
        }
        $normalizedOpening = isset($section['opening_balance']) && is_numeric($section['opening_balance'])
            ? accumul8_normalize_amount($section['opening_balance'])
            : null;
        $normalizedClosing = isset($section['closing_balance']) && is_numeric($section['closing_balance'])
            ? accumul8_normalize_amount($section['closing_balance'])
            : null;
        if ($sectionTransactions !== [] || $sectionName !== '' || $sectionLast4 !== '' || $normalizedOpening !== null || $normalizedClosing !== null) {
            $normalizedSections[] = [
                'account_name_hint' => $sectionName !== '' ? $sectionName : ($sectionTransactions[0]['statement_account_name_hint'] ?? ''),
                'account_last4' => $sectionLast4 !== '' ? $sectionLast4 : ($sectionTransactions[0]['statement_account_last4'] ?? ''),
                'opening_balance' => $normalizedOpening,
                'closing_balance' => $normalizedClosing,
                'transactions' => $sectionTransactions,
            ];
        }
    }

    foreach ((array)($parsed['transactions'] ?? []) as $tx) {
        if (!is_array($tx)) {
            if ($normalizedSections === []) {
                $transactions[] = $tx;
            }
            continue;
        }
        $rowName = accumul8_normalize_text((string)($tx['statement_account_name_hint'] ?? $topLevelName), 191);
        $rowLast4 = accumul8_normalize_text((string)($tx['statement_account_last4'] ?? $topLevelLast4), 16);
        if ($topLevelName === '' && $rowName !== '') {
            $topLevelName = $rowName;
        }
        if ($topLevelLast4 === '' && $rowLast4 !== '') {
            $topLevelLast4 = $rowLast4;
        }
        $tx['statement_account_name_hint'] = $rowName;
        $tx['statement_account_last4'] = $rowLast4;
        if ($normalizedSections === []) {
            $transactions[] = $tx;
        }
    }

    $parsed['transactions'] = $transactions;
    $parsed['account_sections'] = $normalizedSections;
    $parsed['account_name_hint'] = $topLevelName;
    $parsed['account_last4'] = $topLevelLast4;
    return $parsed;
}

function accumul8_statement_fallback_account_section(array $parsed): ?array
{
    $parsed = accumul8_statement_normalize_parsed_payload($parsed);
    $nameHint = accumul8_normalize_text((string)($parsed['account_name_hint'] ?? ''), 191);
    $last4 = accumul8_normalize_text((string)($parsed['account_last4'] ?? $parsed['account_mask_last4'] ?? ''), 16);
    $openingBalance = isset($parsed['opening_balance']) && is_numeric($parsed['opening_balance'])
        ? accumul8_normalize_amount($parsed['opening_balance'])
        : null;
    $closingBalance = isset($parsed['closing_balance']) && is_numeric($parsed['closing_balance'])
        ? accumul8_normalize_amount($parsed['closing_balance'])
        : null;
    if ($nameHint === '' && $last4 === '' && $openingBalance === null && $closingBalance === null) {
        return null;
    }

    return [
        'account_name_hint' => $nameHint,
        'account_last4' => $last4,
        'label' => accumul8_statement_build_account_tag_label($nameHint, $last4),
        'opening_balance' => $openingBalance,
        'closing_balance' => $closingBalance,
    ];
}

function accumul8_statement_transaction_rows(array $parsed): array
{
    $parsed = accumul8_statement_normalize_parsed_payload($parsed);
    $rows = [];
    $topLevelName = accumul8_normalize_text((string)($parsed['account_name_hint'] ?? ''), 191);
    $topLevelLast4 = accumul8_normalize_text((string)($parsed['account_last4'] ?? ''), 16);
    foreach ((array)($parsed['transactions'] ?? []) as $index => $tx) {
        $isValidJson = is_array($tx);
        $row = $isValidJson ? $tx : [];
        $rowName = accumul8_normalize_text((string)($row['statement_account_name_hint'] ?? $topLevelName), 191);
        $rowLast4 = accumul8_normalize_text((string)($row['statement_account_last4'] ?? $topLevelLast4), 16);
        $rows[] = [
            'row_index' => (int)$index,
            'is_valid_json' => $isValidJson ? 1 : 0,
            'transaction_date' => (string)($row['transaction_date'] ?? ''),
            'posted_date' => (string)($row['posted_date'] ?? ''),
            'description' => (string)($row['description'] ?? ''),
            'memo' => (string)($row['memo'] ?? ''),
            'amount' => $row['amount'] ?? null,
            'running_balance' => $row['running_balance'] ?? null,
            'page_number' => $row['page_number'] ?? null,
            'statement_account_name_hint' => $rowName,
            'statement_account_last4' => $rowLast4,
            'statement_account_label' => accumul8_statement_build_account_tag_label($rowName, $rowLast4),
        ];
    }
    return $rows;
}

function accumul8_statement_distinct_account_tags(array $parsed): array
{
    $labels = [];
    foreach (accumul8_statement_transaction_rows($parsed) as $row) {
        $key = strtolower(trim((string)($row['statement_account_name_hint'] ?? ''))) . '|' . preg_replace('/\D+/', '', (string)($row['statement_account_last4'] ?? ''));
        if ($key === '|') {
            continue;
        }
        $labels[$key] = (string)($row['statement_account_label'] ?? '');
    }
    return array_values(array_filter($labels, static fn($value): bool => trim((string)$value) !== ''));
}

function accumul8_statement_distinct_account_sections(array $parsed): array
{
    $sections = [];
    $parsed = accumul8_statement_normalize_parsed_payload($parsed);
    foreach ((array)($parsed['account_sections'] ?? []) as $section) {
        if (!is_array($section)) {
            continue;
        }
        $nameHint = accumul8_normalize_text((string)($section['account_name_hint'] ?? ''), 191);
        $last4 = accumul8_normalize_text((string)($section['account_last4'] ?? ''), 16);
        $key = accumul8_statement_section_key($nameHint, $last4);
        if ($key === '|') {
            continue;
        }
        $sections[$key] = [
            'account_name_hint' => $nameHint,
            'account_last4' => $last4,
            'label' => accumul8_statement_build_account_tag_label($nameHint, $last4),
            'opening_balance' => isset($section['opening_balance']) && is_numeric($section['opening_balance'])
                ? accumul8_normalize_amount($section['opening_balance'])
                : null,
            'closing_balance' => isset($section['closing_balance']) && is_numeric($section['closing_balance'])
                ? accumul8_normalize_amount($section['closing_balance'])
                : null,
        ];
    }
    foreach (accumul8_statement_transaction_rows($parsed) as $row) {
        $key = accumul8_statement_section_key((string)($row['statement_account_name_hint'] ?? ''), (string)($row['statement_account_last4'] ?? ''));
        if ($key === '|') {
            continue;
        }
        if (!isset($sections[$key])) {
            $sections[$key] = [
                'account_name_hint' => (string)($row['statement_account_name_hint'] ?? ''),
                'account_last4' => (string)($row['statement_account_last4'] ?? ''),
                'label' => (string)($row['statement_account_label'] ?? ''),
                'opening_balance' => null,
                'closing_balance' => null,
            ];
        }
    }
    if ($sections === []) {
        $fallbackSection = accumul8_statement_fallback_account_section($parsed);
        if ($fallbackSection !== null) {
            $fallbackKey = accumul8_statement_section_key((string)($fallbackSection['account_name_hint'] ?? ''), (string)($fallbackSection['account_last4'] ?? ''));
            $sections[$fallbackKey !== '|' ? $fallbackKey : '__fallback__'] = $fallbackSection;
        }
    }
    return array_values($sections);
}

function accumul8_statement_catalog_verification_payload(array $parsed, array $reviewRows = []): array
{
    $parsed = accumul8_statement_normalize_parsed_payload($parsed);
    if ($reviewRows === []) {
        $reviewRows = accumul8_statement_review_rows($parsed, accumul8_statement_transaction_locators($parsed));
    }

    $sectionDefinitions = accumul8_statement_distinct_account_sections($parsed);
    $sectionMap = [];
    foreach ($sectionDefinitions as $section) {
        $label = (string)($section['label'] ?? 'Unlabeled account section');
        $sectionMap[$label] = [
            'statement_account_label' => $label,
            'statement_account_name_hint' => (string)($section['account_name_hint'] ?? ''),
            'statement_account_last4' => (string)($section['account_last4'] ?? ''),
            'transaction_count' => 0,
            'invalid_row_count' => 0,
            'opening_balance' => isset($section['opening_balance']) && is_numeric($section['opening_balance']) ? accumul8_normalize_amount($section['opening_balance']) : null,
            'closing_balance' => isset($section['closing_balance']) && is_numeric($section['closing_balance']) ? accumul8_normalize_amount($section['closing_balance']) : null,
            'transaction_total' => 0.0,
            'expected_closing_balance' => null,
            'closing_delta' => null,
            'status' => 'warning',
            'note' => '',
        ];
    }

    foreach ($reviewRows as $row) {
        $label = accumul8_normalize_text((string)($row['statement_account_label'] ?? ''), 191);
        if ($label === '') {
            $label = 'Unlabeled account section';
        }
        if (!isset($sectionMap[$label])) {
            $sectionMap[$label] = [
                'statement_account_label' => $label,
                'statement_account_name_hint' => (string)($row['statement_account_name_hint'] ?? ''),
                'statement_account_last4' => (string)($row['statement_account_last4'] ?? ''),
                'transaction_count' => 0,
                'invalid_row_count' => 0,
                'opening_balance' => null,
                'closing_balance' => null,
                'transaction_total' => 0.0,
                'expected_closing_balance' => null,
                'closing_delta' => null,
                'status' => 'warning',
                'note' => '',
            ];
        }
        if (!empty($row['reason'])) {
            $sectionMap[$label]['invalid_row_count']++;
            continue;
        }
        $sectionMap[$label]['transaction_count']++;
        if (isset($row['amount']) && is_numeric($row['amount'])) {
            $sectionMap[$label]['transaction_total'] += accumul8_normalize_amount($row['amount']);
        }
    }

    if (count($sectionMap) === 1) {
        $onlyLabel = array_key_first($sectionMap);
        if ($onlyLabel !== null) {
            if ($sectionMap[$onlyLabel]['opening_balance'] === null && isset($parsed['opening_balance']) && is_numeric($parsed['opening_balance'])) {
                $sectionMap[$onlyLabel]['opening_balance'] = accumul8_normalize_amount($parsed['opening_balance']);
            }
            if ($sectionMap[$onlyLabel]['closing_balance'] === null && isset($parsed['closing_balance']) && is_numeric($parsed['closing_balance'])) {
                $sectionMap[$onlyLabel]['closing_balance'] = accumul8_normalize_amount($parsed['closing_balance']);
            }
        }
    }

    $verifiedCount = 0;
    $warningCount = 0;
    $failedCount = 0;
    foreach ($sectionMap as &$section) {
        $section['transaction_total'] = round((float)$section['transaction_total'], 2);
        $opening = $section['opening_balance'];
        $closing = $section['closing_balance'];
        if ($opening !== null) {
            $section['expected_closing_balance'] = round($opening + (float)$section['transaction_total'], 2);
        }
        if ($section['invalid_row_count'] > 0) {
            $section['status'] = 'failed';
            $section['note'] = $section['invalid_row_count'] . ' row(s) were invalid, so the catalog checksum is not authoritative.';
        } elseif ($opening !== null && $closing !== null && $section['expected_closing_balance'] !== null) {
            $section['closing_delta'] = round((float)$closing - (float)$section['expected_closing_balance'], 2);
            if (abs((float)$section['closing_delta']) <= 0.01) {
                $section['status'] = 'verified';
                $section['note'] = 'Opening balance plus cataloged activity matches the closing balance.';
            } else {
                $section['status'] = 'failed';
                $section['note'] = 'Cataloged activity does not reproduce the closing balance.';
            }
        } else {
            $section['status'] = 'warning';
            $section['note'] = 'Opening and closing balances were not both available for checksum verification.';
        }

        if ($section['status'] === 'verified') {
            $verifiedCount++;
        } elseif ($section['status'] === 'failed') {
            $failedCount++;
        } else {
            $warningCount++;
        }
    }
    unset($section);

    $status = 'verified';
    if ($sectionMap === []) {
        $status = 'warning';
    } elseif ($failedCount > 0) {
        $status = 'failed';
    } elseif ($warningCount > 0) {
        $status = 'warning';
    }

    $summaryParts = [];
    if ($verifiedCount > 0) {
        $summaryParts[] = $verifiedCount . ' account section(s) verified.';
    }
    if ($warningCount > 0) {
        $summaryParts[] = $warningCount . ' section(s) are missing enough balance data for a full checksum.';
    }
    if ($failedCount > 0) {
        $summaryParts[] = $failedCount . ' section(s) failed checksum verification.';
    }
    if ($summaryParts === []) {
        $summaryParts[] = 'No account sections were available for checksum verification.';
    }

    return [
        'status' => $status,
        'summary' => implode(' ', $summaryParts),
        'authoritative' => $status === 'verified' ? 1 : 0,
        'verified_section_count' => $verifiedCount,
        'warning_section_count' => $warningCount,
        'failed_section_count' => $failedCount,
        'sections' => array_values($sectionMap),
    ];
}

function accumul8_statement_ocr_document_payload(array $row, array $parsed, array $reviewRows = []): ?array
{
    $parsed = accumul8_statement_normalize_parsed_payload($parsed);
    if ($reviewRows === []) {
        $reviewRows = accumul8_statement_review_rows($parsed, accumul8_statement_transaction_locators($parsed));
    }

    $sections = accumul8_statement_distinct_account_sections($parsed);
    $sectionMap = [];
    foreach ($sections as $section) {
        $label = (string)($section['label'] ?? 'Unlabeled account section');
        $sectionMap[$label] = [
            'statement_account_label' => $label,
            'statement_account_name_hint' => (string)($section['account_name_hint'] ?? ''),
            'statement_account_last4' => (string)($section['account_last4'] ?? ''),
            'opening_balance' => isset($section['opening_balance']) && is_numeric($section['opening_balance']) ? accumul8_normalize_amount($section['opening_balance']) : null,
            'closing_balance' => isset($section['closing_balance']) && is_numeric($section['closing_balance']) ? accumul8_normalize_amount($section['closing_balance']) : null,
            'rows' => [],
        ];
    }

    foreach ($reviewRows as $rowEntry) {
        $label = accumul8_normalize_text((string)($rowEntry['statement_account_label'] ?? ''), 191);
        if ($label === '') {
            $label = 'Unlabeled account section';
        }
        if (!isset($sectionMap[$label])) {
            $sectionMap[$label] = [
                'statement_account_label' => $label,
                'statement_account_name_hint' => (string)($rowEntry['statement_account_name_hint'] ?? ''),
                'statement_account_last4' => (string)($rowEntry['statement_account_last4'] ?? ''),
                'opening_balance' => null,
                'closing_balance' => null,
                'rows' => [],
            ];
        }
        $sectionMap[$label]['rows'][] = [
            'row_index' => (int)($rowEntry['row_index'] ?? 0),
            'transaction_date' => isset($rowEntry['transaction_date']) ? (string)$rowEntry['transaction_date'] : null,
            'description' => (string)($rowEntry['description'] ?? ''),
            'memo' => (string)($rowEntry['memo'] ?? ''),
            'amount' => isset($rowEntry['amount']) && is_numeric($rowEntry['amount']) ? accumul8_normalize_amount($rowEntry['amount']) : null,
            'running_balance' => isset($rowEntry['running_balance']) && is_numeric($rowEntry['running_balance']) ? accumul8_normalize_amount($rowEntry['running_balance']) : null,
            'page_number' => isset($rowEntry['page_number']) && is_numeric($rowEntry['page_number']) ? (int)$rowEntry['page_number'] : null,
            'reason' => (string)($rowEntry['reason'] ?? ''),
        ];
    }

    if ($sectionMap === []) {
        return null;
    }

    if (count($sectionMap) === 1) {
        $onlyLabel = array_key_first($sectionMap);
        if ($onlyLabel !== null) {
            if ($sectionMap[$onlyLabel]['opening_balance'] === null && isset($parsed['opening_balance']) && is_numeric($parsed['opening_balance'])) {
                $sectionMap[$onlyLabel]['opening_balance'] = accumul8_normalize_amount($parsed['opening_balance']);
            }
            if ($sectionMap[$onlyLabel]['closing_balance'] === null && isset($parsed['closing_balance']) && is_numeric($parsed['closing_balance'])) {
                $sectionMap[$onlyLabel]['closing_balance'] = accumul8_normalize_amount($parsed['closing_balance']);
            }
        }
    }

    return [
        'original_filename' => (string)($row['original_filename'] ?? ''),
        'institution_name' => accumul8_normalize_text((string)($parsed['institution_name'] ?? $row['institution_name'] ?? ''), 191),
        'statement_kind' => accumul8_statement_normalize_kind($parsed['statement_kind'] ?? $row['statement_kind'] ?? 'bank_account'),
        'period_start' => accumul8_normalize_date($parsed['period_start'] ?? $row['period_start'] ?? ''),
        'period_end' => accumul8_normalize_date($parsed['period_end'] ?? $row['period_end'] ?? ''),
        'opening_balance' => isset($parsed['opening_balance']) && is_numeric($parsed['opening_balance']) ? accumul8_normalize_amount($parsed['opening_balance']) : (isset($row['opening_balance']) ? (float)$row['opening_balance'] : null),
        'closing_balance' => isset($parsed['closing_balance']) && is_numeric($parsed['closing_balance']) ? accumul8_normalize_amount($parsed['closing_balance']) : (isset($row['closing_balance']) ? (float)$row['closing_balance'] : null),
        'sections' => array_values($sectionMap),
    ];
}

function accumul8_statement_filename_month_hint(string $filename): string
{
    if (preg_match('/\b(20\d{2})(\d{2})\d{2}\b/', $filename, $matches)) {
        return ($matches[1] ?? '') . '-' . ($matches[2] ?? '');
    }
    if (preg_match('/\b(20\d{2})-(\d{2})-\d{2}\b/', $filename, $matches)) {
        return ($matches[1] ?? '') . '-' . ($matches[2] ?? '');
    }
    return '';
}

function accumul8_statement_parse_abnormality(array $parsed, string $sourceText, string $filename, array $profile = []): array
{
    $parsed = accumul8_statement_normalize_parsed_payload($parsed);
    $sourceText = accumul8_statement_structured_text_from_bytes($sourceText, 120000);
    $sourceTextLower = strtolower($sourceText);
    $statementKind = strtolower(trim((string)($parsed['statement_kind'] ?? '')));
    $institutionName = strtolower(trim((string)($parsed['institution_name'] ?? '')));
    $accountNameHint = strtolower(trim((string)($parsed['account_name_hint'] ?? '')));
    $transactionRows = accumul8_statement_transaction_rows($parsed);
    $transactionCount = count($transactionRows);
    $sectionCount = count((array)($parsed['account_sections'] ?? []));
    $score = 0;
    $reasons = [];

    $fileMonthHint = accumul8_statement_filename_month_hint($filename);
    $periodStart = accumul8_normalize_date((string)($parsed['period_start'] ?? ''));
    if ($fileMonthHint !== '' && $periodStart !== null && substr($periodStart, 0, 7) !== $fileMonthHint) {
        $score += 4;
        $reasons[] = 'file_month_mismatch';
    }

    if ($transactionCount > 0 && strlen($sourceText) >= 8000 && $transactionCount < 10) {
        $score += 3;
        $reasons[] = 'too_few_transactions_for_statement_size';
    }

    if ($transactionCount > 0 && !accumul8_statement_text_has_transaction_signals($sourceText)) {
        $score += 4;
        $reasons[] = 'transactions_without_text_signals';
    }

    if ($transactionCount > 0 && accumul8_statement_transaction_rows_anchor_poorly($parsed, $sourceText)) {
        $score += 3;
        $reasons[] = 'transaction_rows_anchor_poorly';
    }

    if ($statementKind === 'credit_card' && (str_contains($sourceTextLower, 'checking') || str_contains($sourceTextLower, 'savings'))) {
        $score += 2;
        $reasons[] = 'statement_kind_conflicts_with_source_text';
    }

    if (($institutionName === '' || $institutionName === 'credit card') && str_contains($sourceTextLower, 'capital one 360')) {
        $score += 2;
        $reasons[] = 'institution_missing_from_capital_one_text';
    }

    if (($accountNameHint === '' || $accountNameHint === 'unknown') && str_contains($sourceTextLower, 'checking')) {
        $score += 1;
        $reasons[] = 'missing_account_name_hint';
    }

    if ($transactionCount === 0 && accumul8_statement_text_looks_garbled($sourceText)) {
        $score += 5;
        $reasons[] = 'garbled_text_without_transactions';
    }

    if ($transactionCount === 0 && accumul8_statement_text_has_transaction_signals($sourceText)) {
        $score += 5;
        $reasons[] = 'no_transactions_detected_from_transaction_like_text';
    }

    if (accumul8_statement_has_multi_account_signal($sourceText, $profile) && $sectionCount < 2) {
        $score += 3;
        $reasons[] = 'expected_multi_account_sections_missing';
    }

    if (str_contains($sourceTextLower, 'opening balance') && !isset($parsed['opening_balance'])) {
        $score += 1;
        $reasons[] = 'opening_balance_missing';
    }
    if (str_contains($sourceTextLower, 'closing balance') && !isset($parsed['closing_balance'])) {
        $score += 1;
        $reasons[] = 'closing_balance_missing';
    }

    return [
        'score' => $score,
        'reasons' => array_values(array_unique($reasons)),
        'requires_ai_validation' => $score >= 3,
        'is_suspicious' => $score >= 7,
    ];
}

function accumul8_statement_ai_result_is_suspicious(array $parsed, string $sourceText, string $filename, array $profile = []): bool
{
    $analysis = accumul8_statement_parse_abnormality($parsed, $sourceText, $filename, $profile);
    return !empty($analysis['is_suspicious']);
}

function accumul8_statement_parse_from_ocr_text(
    string $text,
    string $filename,
    array $accountCatalog,
    array $pageCatalog = [],
    bool $allowAiFallback = true
): array {
    $profile = accumul8_statement_detect_profile($text, $filename);
    $deterministicParsed = accumul8_statement_parse_ocr_text_deterministically($text, $profile);
    $deterministicAnalysis = $deterministicParsed !== []
        ? accumul8_statement_parse_abnormality($deterministicParsed, $text, $filename, $profile)
        : ['score' => 999, 'reasons' => ['deterministic_parser_returned_empty'], 'requires_ai_validation' => true, 'is_suspicious' => true];

    $selected = [
        'provider' => 'deterministic_ocr',
        'model' => 'line_parser:' . (string)($profile['slug'] ?? 'generic'),
        'json' => $deterministicParsed,
        'profile' => $profile,
        'analysis' => $deterministicAnalysis,
        'notes' => [],
    ];

    if (!$allowAiFallback || empty($deterministicAnalysis['requires_ai_validation'])) {
        return $selected;
    }

    $ai = accumul8_ai_generate_statement_json($text, $accountCatalog, $pageCatalog, $profile);
    $aiParsed = is_array($ai['json'] ?? null) ? accumul8_statement_normalize_parsed_payload($ai['json']) : [];
    $aiAnalysis = $aiParsed !== []
        ? accumul8_statement_parse_abnormality($aiParsed, $text, $filename, $profile)
        : ['score' => 999, 'reasons' => ['ai_parser_returned_empty'], 'requires_ai_validation' => true, 'is_suspicious' => true];

    if (($aiAnalysis['score'] ?? 999) < ($deterministicAnalysis['score'] ?? 999)) {
        return [
            'provider' => (string)($ai['provider'] ?? 'ai_validation'),
            'model' => (string)($ai['model'] ?? ''),
            'json' => $aiParsed,
            'profile' => $profile,
            'analysis' => $aiAnalysis,
            'notes' => ['AI validation fallback replaced an abnormal deterministic parse.'],
        ];
    }

    $selected['notes'][] = 'AI validation fallback ran, but the deterministic parse remained the more reliable result.';
    return $selected;
}

function accumul8_statement_text_looks_garbled(string $text): bool
{
    $text = trim($text);
    if ($text === '') {
        return false;
    }

    $sample = function_exists('mb_substr') ? (string)mb_substr($text, 0, 4000, 'UTF-8') : substr($text, 0, 4000);
    $sampleLength = function_exists('mb_strlen') ? (int)mb_strlen($sample, 'UTF-8') : strlen($sample);
    if ($sampleLength < 200) {
        return false;
    }

    preg_match_all('/[A-Za-z0-9\s\.,:\;\-\+\(\)\/&$%]/u', $sample, $asciiMatches);
    preg_match_all('/[^\x00-\x7F]/u', $sample, $nonAsciiMatches);

    $asciiCount = is_array($asciiMatches[0] ?? null) ? count($asciiMatches[0]) : 0;
    $nonAsciiCount = is_array($nonAsciiMatches[0] ?? null) ? count($nonAsciiMatches[0]) : 0;
    $asciiRatio = $sampleLength > 0 ? ($asciiCount / $sampleLength) : 0.0;
    $nonAsciiRatio = $sampleLength > 0 ? ($nonAsciiCount / $sampleLength) : 0.0;

    $keywordHits = 0;
    foreach ([
        'statement',
        'account',
        'balance',
        'payment',
        'credit',
        'debit',
        'transaction',
        'date',
        'amount',
        'total',
    ] as $keyword) {
        if (stripos($sample, $keyword) !== false) {
            $keywordHits++;
        }
    }

    return $asciiRatio < 0.72 && $nonAsciiRatio > 0.12 && $keywordHits < 2;
}

function accumul8_statement_find_binary(string $name, array $candidates): ?string
{
    foreach ($candidates as $candidate) {
        if (is_string($candidate) && $candidate !== '' && is_file($candidate) && is_executable($candidate)) {
            return $candidate;
        }
    }
    $which = trim((string)@shell_exec('command -v ' . escapeshellarg($name) . ' 2>/dev/null'));
    if ($which !== '' && is_file($which) && is_executable($which)) {
        return $which;
    }
    return null;
}

function accumul8_statement_text_from_bytes(string $text, int $maxLen = 120000): string
{
    $text = str_replace("\0", ' ', $text);
    $text = preg_replace('/[^\P{C}\t\r\n]+/u', ' ', $text) ?? $text;
    $text = preg_replace('/\s+/u', ' ', trim($text)) ?? trim($text);
    if ($maxLen > 0 && strlen($text) > $maxLen) {
        $text = substr($text, 0, $maxLen);
    }
    return trim($text);
}

function accumul8_statement_structured_text_from_bytes(string $text, int $maxLen = 120000): string
{
    $text = str_replace("\0", ' ', $text);
    $text = str_replace(["\r\n", "\r"], "\n", $text);
    $text = preg_replace('/[^\P{C}\t\n]+/u', ' ', $text) ?? $text;
    $lines = preg_split('/\n/u', $text) ?: [];
    $normalizedLines = [];
    $blankRun = 0;
    foreach ($lines as $line) {
        $line = preg_replace('/[ \t]+/u', ' ', trim((string)$line)) ?? trim((string)$line);
        if ($line === '') {
            $blankRun++;
            if ($blankRun > 1) {
                continue;
            }
            $normalizedLines[] = '';
            continue;
        }
        $blankRun = 0;
        $normalizedLines[] = $line;
    }
    $normalized = trim(implode("\n", $normalizedLines));
    if ($maxLen > 0 && strlen($normalized) > $maxLen) {
        $normalized = substr($normalized, 0, $maxLen);
    }
    return trim($normalized);
}

function accumul8_statement_structured_text_excerpt(string $text, int $maxLen = 4000): string
{
    return accumul8_statement_structured_text_from_bytes($text, $maxLen);
}

function accumul8_statement_excerpt_text(string $text, int $maxLen = 4000): string
{
    return accumul8_statement_text_from_bytes($text, $maxLen);
}

function accumul8_statement_text_has_transaction_signals(string $text): bool
{
    $sample = accumul8_statement_structured_text_from_bytes($text, 30000);
    if ($sample === '') {
        return false;
    }

    $dateHits = preg_match_all('/\b(?:\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|20\d{2}[\/\-]\d{2}[\/\-]\d{2}|[A-Z][a-z]{2,8}\s+\d{1,2},?\s+20\d{2})\b/u', $sample, $matches);
    $amountHits = preg_match_all('/[-+]?\$?\d{1,3}(?:,\d{3})*\.\d{2}\b/u', $sample, $amountMatches);
    $balanceHits = preg_match_all('/\b(?:balance|payment|deposit|withdrawal|purchase|debit|credit)\b/i', $sample, $keywordMatches);

    return (int)$dateHits >= 4 && (int)$amountHits >= 4 && (int)$balanceHits >= 2;
}

function accumul8_statement_transaction_rows_anchor_poorly(array $parsed, string $sourceText): bool
{
    $sourceText = strtolower(accumul8_statement_structured_text_from_bytes($sourceText, 80000));
    if ($sourceText === '') {
        return true;
    }

    $rows = array_slice(accumul8_statement_transaction_rows($parsed), 0, 8);
    if ($rows === []) {
        return false;
    }

    $anchoredRows = 0;
    foreach ($rows as $row) {
        $desc = strtolower(trim((string)($row['description'] ?? '')));
        $amount = $row['amount'] ?? null;
        if ($desc === '' || !is_numeric($amount)) {
            continue;
        }
        $tokens = array_values(array_filter(
            preg_split('/[^a-z0-9]+/i', $desc) ?: [],
            static fn($token): bool => strlen((string)$token) >= 4
        ));
        $amountValue = accumul8_normalize_amount($amount);
        $amountVariants = array_values(array_unique(array_filter([
            number_format(abs($amountValue), 2, '.', ''),
            '$' . number_format(abs($amountValue), 2, '.', ''),
            number_format(abs($amountValue), 2, '.', ''),
        ])));
        $hasToken = false;
        foreach (array_slice($tokens, 0, 3) as $token) {
            if (str_contains($sourceText, strtolower($token))) {
                $hasToken = true;
                break;
            }
        }
        $hasAmount = false;
        foreach ($amountVariants as $variant) {
            if ($variant !== '' && str_contains($sourceText, strtolower($variant))) {
                $hasAmount = true;
                break;
            }
        }
        if ($hasToken && $hasAmount) {
            $anchoredRows++;
        }
    }

    return $anchoredRows === 0;
}

function accumul8_statement_empty_parsed_payload(array $seed = []): array
{
    return [
        'statement_kind' => accumul8_statement_normalize_kind($seed['statement_kind'] ?? 'bank_account'),
        'institution_name' => accumul8_normalize_text((string)($seed['institution_name'] ?? ''), 191),
        'account_name_hint' => accumul8_normalize_text((string)($seed['account_name_hint'] ?? ''), 191),
        'account_last4' => accumul8_normalize_text((string)($seed['account_last4'] ?? ''), 16),
        'period_start' => accumul8_normalize_date((string)($seed['period_start'] ?? '')) ?? '',
        'period_end' => accumul8_normalize_date((string)($seed['period_end'] ?? '')) ?? '',
        'opening_balance' => isset($seed['opening_balance']) && is_numeric($seed['opening_balance']) ? accumul8_normalize_amount($seed['opening_balance']) : null,
        'closing_balance' => isset($seed['closing_balance']) && is_numeric($seed['closing_balance']) ? accumul8_normalize_amount($seed['closing_balance']) : null,
        'account_sections' => [],
        'transactions' => [],
    ];
}

function accumul8_statement_pdf_page_count(string $pdfPath): int
{
    if ($pdfPath === '' || !is_file($pdfPath)) {
        return 0;
    }
    if (function_exists('shell_exec')) {
        $bin = accumul8_statement_find_binary('pdfinfo', [
            '/usr/bin/pdfinfo',
            '/usr/local/bin/pdfinfo',
            '/opt/homebrew/bin/pdfinfo',
        ]);
        if ($bin !== null) {
            $cmd = escapeshellarg($bin) . ' ' . escapeshellarg($pdfPath) . ' 2>/dev/null';
            $out = (string)shell_exec($cmd);
            if (preg_match('/^Pages:\s+(\d+)/mi', $out, $matches)) {
                return max(0, (int)($matches[1] ?? 0));
            }
        }
    }
    $bytes = (string)@file_get_contents($pdfPath);
    if ($bytes === '') {
        return 0;
    }
    if (preg_match_all('/\/Type\s*\/Page\b/', $bytes, $matches) > 0) {
        return count($matches[0]);
    }
    return 0;
}

function accumul8_statement_google_ocr_service_account_json(): string
{
    $dedicated = (string)secret_get(catn8_secret_key('accumul8.ocr.google.service_account_json'));
    if (trim($dedicated) !== '') {
        return $dedicated;
    }
    $primary = (string)secret_get(catn8_settings_ai_secret_key('google_vertex_ai', 'service_account_json'));
    if (trim($primary) !== '') {
        return $primary;
    }
    $secondary = (string)secret_get('CATN8_MYSTERY_GCP_SERVICE_ACCOUNT_JSON');
    return trim($secondary) !== '' ? $secondary : '';
}

function accumul8_statement_google_vision_request(string $endpoint, array $payload): array
{
    $serviceAccountJson = accumul8_statement_google_ocr_service_account_json();
    if ($serviceAccountJson === '') {
        throw new RuntimeException('Google Cloud OCR is not configured. Add a Google service account JSON first.');
    }

    $token = catn8_google_service_account_access_token($serviceAccountJson, 'https://www.googleapis.com/auth/cloud-platform');
    $resp = catn8_http_json_with_status(
        'POST',
        'https://vision.googleapis.com/v1/' . ltrim($endpoint, '/'),
        [
            'Authorization' => 'Bearer ' . $token,
            'Content-Type' => 'application/json',
        ],
        $payload,
        10,
        90
    );
    $status = (int)($resp['status'] ?? 0);
    $json = is_array($resp['json'] ?? null) ? $resp['json'] : [];
    if ($status < 200 || $status >= 300 || isset($json['error'])) {
        $message = (string)($json['error']['message'] ?? '');
        throw new RuntimeException('Google Cloud OCR error' . ($status > 0 ? ' (HTTP ' . $status . ')' : '') . ($message !== '' ? ': ' . $message : ''));
    }
    return $json;
}

function accumul8_statement_google_vision_extract_page_text(array $response): string
{
    $text = trim((string)($response['fullTextAnnotation']['text'] ?? ''));
    if ($text !== '') {
        return accumul8_statement_structured_text_from_bytes($text);
    }
    $text = trim((string)($response['textAnnotations'][0]['description'] ?? ''));
    return $text !== '' ? accumul8_statement_structured_text_from_bytes($text) : '';
}

function accumul8_statement_extract_image_text_with_google_cloud(string $imagePath): array
{
    if ($imagePath === '' || !is_file($imagePath)) {
        return ['text' => '', 'page_catalog' => []];
    }
    $bytes = (string)@file_get_contents($imagePath);
    if ($bytes === '') {
        return ['text' => '', 'page_catalog' => []];
    }

    $mimeType = mime_content_type($imagePath) ?: 'image/png';
    $json = accumul8_statement_google_vision_request('images:annotate', [
        'requests' => [[
            'image' => ['content' => base64_encode($bytes)],
            'features' => [['type' => 'DOCUMENT_TEXT_DETECTION']],
            'imageContext' => ['languageHints' => ['en']],
        ]],
    ]);
    $response = is_array($json['responses'][0] ?? null) ? $json['responses'][0] : [];
    $text = accumul8_statement_google_vision_extract_page_text($response);

    return [
        'text' => $text,
        'page_catalog' => $text !== '' ? [[
            'page_number' => 1,
            'text_excerpt' => accumul8_statement_structured_text_excerpt($text, 6000),
            'mime_type' => $mimeType,
        ]] : [],
    ];
}

function accumul8_statement_extract_pdf_text_with_google_cloud(string $pdfPath): array
{
    if ($pdfPath === '' || !is_file($pdfPath)) {
        return ['text' => '', 'page_catalog' => []];
    }
    $bytes = (string)@file_get_contents($pdfPath);
    if ($bytes === '') {
        return ['text' => '', 'page_catalog' => []];
    }

    $pageCount = max(1, accumul8_statement_pdf_page_count($pdfPath));
    $pages = range(1, $pageCount);
    $chunks = array_chunk($pages, 5);
    $textChunks = [];
    $pageCatalog = [];

    foreach ($chunks as $pageChunk) {
        $json = accumul8_statement_google_vision_request('files:annotate', [
            'requests' => [[
                'inputConfig' => [
                    'mimeType' => 'application/pdf',
                    'content' => base64_encode($bytes),
                ],
                'features' => [['type' => 'DOCUMENT_TEXT_DETECTION']],
                'pages' => array_values(array_map('intval', $pageChunk)),
            ]],
        ]);
        $fileResponse = is_array($json['responses'][0] ?? null) ? $json['responses'][0] : [];
        $pageResponses = is_array($fileResponse['responses'] ?? null) ? $fileResponse['responses'] : [];
        foreach ($pageChunk as $index => $pageNumber) {
            $pageResponse = is_array($pageResponses[$index] ?? null) ? $pageResponses[$index] : [];
            $pageText = accumul8_statement_google_vision_extract_page_text($pageResponse);
            if ($pageText === '') {
                continue;
            }
            $textChunks[] = $pageText;
            $pageCatalog[] = [
                'page_number' => (int)$pageNumber,
                'text_excerpt' => accumul8_statement_structured_text_excerpt($pageText, 6000),
            ];
        }
    }

    return [
        'text' => accumul8_statement_structured_text_from_bytes(implode("\n\n", $textChunks)),
        'page_catalog' => $pageCatalog,
    ];
}

function accumul8_statement_extract_pdf_page_catalog(string $pdfPath): array
{
    if ($pdfPath === '' || !is_file($pdfPath) || !function_exists('shell_exec')) {
        return [];
    }
    $bin = accumul8_statement_find_binary('pdftotext', [
        '/usr/bin/pdftotext',
        '/usr/local/bin/pdftotext',
        '/opt/homebrew/bin/pdftotext',
    ]);
    if ($bin === null) {
        return [];
    }

    $pageCount = accumul8_statement_pdf_page_count($pdfPath);
    if ($pageCount <= 0) {
        return [];
    }

    $catalog = [];
    for ($pageNumber = 1; $pageNumber <= $pageCount; $pageNumber++) {
        $tmpOut = tempnam(sys_get_temp_dir(), 'accumul8_pdf_page_');
        if (!is_string($tmpOut) || $tmpOut === '') {
            continue;
        }
        $cmd = escapeshellarg($bin)
            . ' -f ' . $pageNumber
            . ' -l ' . $pageNumber
            . ' -enc UTF-8 -layout -q '
            . escapeshellarg($pdfPath) . ' ' . escapeshellarg($tmpOut)
            . ' 2>/dev/null';
        shell_exec($cmd);
        $pageText = is_file($tmpOut) ? (string)file_get_contents($tmpOut) : '';
        if (is_file($tmpOut)) {
            @unlink($tmpOut);
        }
        $pageText = accumul8_statement_structured_text_excerpt($pageText, 6000);
        if ($pageText === '') {
            continue;
        }
        $catalog[] = [
            'page_number' => $pageNumber,
            'text_excerpt' => $pageText,
        ];
    }

    return $catalog;
}

function accumul8_statement_extract_pdf_text_from_path(string $pdfPath): string
{
    if ($pdfPath === '' || !is_file($pdfPath)) {
        return '';
    }
    if (function_exists('shell_exec')) {
        $bin = accumul8_statement_find_binary('pdftotext', [
            '/usr/bin/pdftotext',
            '/usr/local/bin/pdftotext',
            '/opt/homebrew/bin/pdftotext',
        ]);
        if ($bin !== null) {
            $tmpOut = tempnam(sys_get_temp_dir(), 'accumul8_pdf_txt_');
            if (is_string($tmpOut) && $tmpOut !== '') {
                $cmd = escapeshellarg($bin) . ' -enc UTF-8 -layout -q ' . escapeshellarg($pdfPath) . ' ' . escapeshellarg($tmpOut) . ' 2>/dev/null';
                shell_exec($cmd);
                $txt = is_file($tmpOut) ? (string)file_get_contents($tmpOut) : '';
                if (is_file($tmpOut)) {
                    @unlink($tmpOut);
                }
                $normalized = accumul8_statement_structured_text_from_bytes($txt);
                if ($normalized !== '') {
                    return $normalized;
                }
            }
        }
    }
    return accumul8_statement_extract_pdf_text_with_php_parser($pdfPath);
}

function accumul8_statement_pdf_decode_literal_string(string $value): string
{
    $length = strlen($value);
    $result = '';
    for ($i = 0; $i < $length; $i++) {
        $char = $value[$i];
        if ($char !== '\\') {
            $result .= $char;
            continue;
        }
        $i++;
        if ($i >= $length) {
            break;
        }
        $next = $value[$i];
        if ($next >= '0' && $next <= '7') {
            $octal = $next;
            for ($j = 0; $j < 2 && ($i + 1) < $length; $j++) {
                $peek = $value[$i + 1];
                if ($peek < '0' || $peek > '7') {
                    break;
                }
                $octal .= $peek;
                $i++;
            }
            $result .= chr(octdec($octal));
            continue;
        }
        if ($next === 'n') {
            $result .= "\n";
        } elseif ($next === 'r') {
            $result .= "\r";
        } elseif ($next === 't') {
            $result .= "\t";
        } elseif ($next === 'b') {
            $result .= "\x08";
        } elseif ($next === 'f') {
            $result .= "\x0C";
        } elseif ($next === '(' || $next === ')' || $next === '\\') {
            $result .= $next;
        } elseif ($next === "\n" || $next === "\r") {
            if ($next === "\r" && ($i + 1) < $length && $value[$i + 1] === "\n") {
                $i++;
            }
        } else {
            $result .= $next;
        }
    }
    return $result;
}

function accumul8_statement_pdf_decode_text_fragment(string $value): string
{
    if ($value === '') {
        return '';
    }
    if (substr_count($value, "\0") > 0 && function_exists('mb_convert_encoding')) {
        $decoded = @mb_convert_encoding($value, 'UTF-8', 'UTF-16BE');
        if (is_string($decoded) && trim($decoded) !== '') {
            return $decoded;
        }
    }
    if (!preg_match('//u', $value) && function_exists('mb_convert_encoding')) {
        $decoded = @mb_convert_encoding($value, 'UTF-8', 'Windows-1252');
        if (is_string($decoded) && $decoded !== '') {
            return $decoded;
        }
    }
    return $value;
}

function accumul8_statement_extract_pdf_text_with_php_parser(string $pdfPath): string
{
    $bytes = (string)file_get_contents($pdfPath);
    if ($bytes === '') {
        return '';
    }

    preg_match_all('/stream\r?\n(.*?)\r?\nendstream/s', $bytes, $streamMatches);
    $chunks = [];
    foreach (($streamMatches[1] ?? []) as $streamData) {
        if (!is_string($streamData) || $streamData === '') {
            continue;
        }

        $decodedStream = null;
        foreach ([
            static fn(string $s) => function_exists('zlib_decode') ? @zlib_decode($s) : false,
            static fn(string $s) => @gzuncompress($s),
            static fn(string $s) => @gzinflate($s),
        ] as $decoder) {
            $candidate = $decoder($streamData);
            if (is_string($candidate) && $candidate !== '') {
                $decodedStream = $candidate;
                break;
            }
        }
        if (!is_string($decodedStream) || $decodedStream === '') {
            continue;
        }
        if (strpos($decodedStream, 'BT') === false || (strpos($decodedStream, 'Tj') === false && strpos($decodedStream, 'TJ') === false && strpos($decodedStream, "'") === false && strpos($decodedStream, '"') === false)) {
            continue;
        }

        preg_match_all('/\[((?:\\\\.|[^\]])*)\]\s*TJ|\(((?:\\\\.|[^\\\\)])*)\)\s*Tj|\(((?:\\\\.|[^\\\\)])*)\)\s*\'|\(((?:\\\\.|[^\\\\)])*)\)\s*"/s', $decodedStream, $textMatches, PREG_SET_ORDER);
        foreach ($textMatches as $match) {
            if (!empty($match[1])) {
                preg_match_all('/\(((?:\\\\.|[^\\\\)])*)\)/s', (string)$match[1], $arrayParts);
                foreach (($arrayParts[1] ?? []) as $arrayPart) {
                    $decoded = accumul8_statement_pdf_decode_text_fragment(accumul8_statement_pdf_decode_literal_string((string)$arrayPart));
                    if ($decoded !== '') {
                        $chunks[] = $decoded;
                    }
                }
                continue;
            }
            $literal = (string)($match[2] ?? $match[3] ?? $match[4] ?? '');
            $decoded = accumul8_statement_pdf_decode_text_fragment(accumul8_statement_pdf_decode_literal_string($literal));
            if ($decoded !== '') {
                $chunks[] = $decoded;
            }
        }
    }

    return accumul8_statement_structured_text_from_bytes(implode("\n", $chunks));
}

function accumul8_statement_extract_image_text_with_tesseract(string $imagePath): string
{
    if ($imagePath === '' || !is_file($imagePath) || !function_exists('shell_exec')) {
        return '';
    }
    $bin = accumul8_statement_find_binary('tesseract', [
        '/usr/bin/tesseract',
        '/usr/local/bin/tesseract',
        '/opt/homebrew/bin/tesseract',
    ]);
    if ($bin === null) {
        return '';
    }
    $tmpOutBase = tempnam(sys_get_temp_dir(), 'accumul8_ocr_');
    if (!is_string($tmpOutBase) || $tmpOutBase === '') {
        return '';
    }
    @unlink($tmpOutBase);
    $cmd = escapeshellarg($bin) . ' ' . escapeshellarg($imagePath) . ' ' . escapeshellarg($tmpOutBase) . ' -l eng --psm 6 txt 2>/dev/null';
    shell_exec($cmd);
    $txtPath = $tmpOutBase . '.txt';
    $txt = is_file($txtPath) ? (string)file_get_contents($txtPath) : '';
    if (is_file($txtPath)) {
        @unlink($txtPath);
    }
    return accumul8_statement_structured_text_from_bytes($txt);
}

function accumul8_statement_extract_pdf_text_with_ocr_fallback(string $pdfPath): array
{
    if ($pdfPath === '' || !is_file($pdfPath) || !function_exists('shell_exec')) {
        return ['text' => '', 'page_catalog' => []];
    }
    $pdftoppm = accumul8_statement_find_binary('pdftoppm', [
        '/usr/bin/pdftoppm',
        '/usr/local/bin/pdftoppm',
        '/opt/homebrew/bin/pdftoppm',
    ]);
    if ($pdftoppm === null) {
        return ['text' => '', 'page_catalog' => []];
    }
    $base = tempnam(sys_get_temp_dir(), 'accumul8_pdf_ocr_');
    if (!is_string($base) || $base === '') {
        return ['text' => '', 'page_catalog' => []];
    }
    @unlink($base);
    $cmd = escapeshellarg($pdftoppm) . ' -png ' . escapeshellarg($pdfPath) . ' ' . escapeshellarg($base) . ' 2>/dev/null';
    shell_exec($cmd);
    $chunks = [];
    $pageCatalog = [];
    $pages = glob($base . '-*.png') ?: [];
    natsort($pages);
    $pageNumber = 1;
    foreach ($pages as $pngPath) {
        $chunk = accumul8_statement_extract_image_text_with_tesseract($pngPath);
        if ($chunk !== '') {
            $chunks[] = $chunk;
            $pageCatalog[] = [
                'page_number' => $pageNumber,
                'text_excerpt' => accumul8_statement_structured_text_excerpt($chunk, 6000),
            ];
        }
        @unlink($pngPath);
        if (strlen(implode("\n", $chunks)) > 90000) {
            break;
        }
        $pageNumber++;
    }
    return [
        'text' => accumul8_statement_structured_text_from_bytes(implode("\n\n", $chunks)),
        'page_catalog' => $pageCatalog,
    ];
}

function accumul8_statement_render_pdf_pages_to_png(string $pdfPath, int $maxPages = 6): array
{
    if ($pdfPath === '' || !is_file($pdfPath) || !function_exists('shell_exec')) {
        return [];
    }
    $pdftoppm = accumul8_statement_find_binary('pdftoppm', [
        '/usr/bin/pdftoppm',
        '/usr/local/bin/pdftoppm',
        '/opt/homebrew/bin/pdftoppm',
    ]);
    if ($pdftoppm === null) {
        return [];
    }
    $base = tempnam(sys_get_temp_dir(), 'accumul8_pdf_ai_');
    if (!is_string($base) || $base === '') {
        return [];
    }
    @unlink($base);
    $cmd = escapeshellarg($pdftoppm) . ' -png ' . escapeshellarg($pdfPath) . ' ' . escapeshellarg($base) . ' 2>/dev/null';
    shell_exec($cmd);
    $pages = glob($base . '-*.png') ?: [];
    natsort($pages);
    $result = [];
    $pageNumber = 1;
    foreach ($pages as $pngPath) {
        if ($pageNumber > $maxPages) {
            @unlink($pngPath);
            $pageNumber++;
            continue;
        }
        $result[] = [
            'page_number' => $pageNumber,
            'path' => $pngPath,
        ];
        $pageNumber++;
    }
    return $result;
}

function accumul8_statement_extract_text_from_file(string $tmpPath, string $mimeType): array
{
    $mime = strtolower($mimeType);
    if (str_contains($mime, 'pdf')) {
        $ocr = accumul8_statement_extract_pdf_text_with_google_cloud($tmpPath);
        return [
            'text' => (string)($ocr['text'] ?? ''),
            'method' => 'google_vision_pdf',
            'page_catalog' => is_array($ocr['page_catalog'] ?? null) ? $ocr['page_catalog'] : [],
        ];
    }
    $ocr = accumul8_statement_extract_image_text_with_google_cloud($tmpPath);
    return [
        'text' => (string)($ocr['text'] ?? ''),
        'method' => 'google_vision_image',
        'page_catalog' => is_array($ocr['page_catalog'] ?? null) ? $ocr['page_catalog'] : [],
    ];
}

function accumul8_statement_page_catalog_prompt(array $pageCatalog, int $maxLen = 65000): string
{
    $segments = [];
    $used = 0;
    foreach ($pageCatalog as $page) {
        if (!is_array($page)) {
            continue;
        }
        $pageNumber = (int)($page['page_number'] ?? 0);
        $text = accumul8_statement_structured_text_excerpt((string)($page['text_excerpt'] ?? ''), 6000);
        if ($pageNumber <= 0 || $text === '') {
            continue;
        }
        $segment = "Page {$pageNumber}:\n{$text}";
        $segmentLen = strlen($segment);
        if ($maxLen > 0 && $used + $segmentLen > $maxLen) {
            break;
        }
        $segments[] = $segment;
        $used += $segmentLen + 2;
    }
    return implode("\n\n", $segments);
}

function accumul8_statement_line_has_parse_signal(string $line): bool
{
    $line = trim($line);
    if ($line === '') {
        return false;
    }
    if (preg_match('/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i', $line) === 1) {
        return true;
    }
    if (preg_match('/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/', $line) === 1) {
        return true;
    }
    if (preg_match('/[-+]?\$?\d{1,3}(?:,\d{3})*\.\d{2}\b/', $line) === 1) {
        return true;
    }
    if (preg_match('/\b(?:opening balance|closing balance|ending balance|beginning balance|account summary|statement period|date|description|category|amount|balance|debit|credit|deposit|withdrawal|purchase|payment|interest|account)\b/i', $line) === 1) {
        return true;
    }
    if (preg_match('/\b\d{6,}\b/', $line) === 1) {
        return true;
    }
    return false;
}

function accumul8_statement_compact_ocr_text_for_parse(string $text, int $maxLen = 36000): string
{
    $normalized = accumul8_statement_structured_text_from_bytes($text, 120000);
    if ($normalized === '') {
        return '';
    }

    $lines = preg_split('/\n/u', $normalized) ?: [];
    $keep = [];
    $lineCount = count($lines);
    for ($i = 0; $i < $lineCount; $i++) {
        $line = trim((string)$lines[$i]);
        if ($line === '') {
            continue;
        }
        if (!accumul8_statement_line_has_parse_signal($line)) {
            continue;
        }
        for ($j = max(0, $i - 1); $j <= min($lineCount - 1, $i + 1); $j++) {
            $candidate = trim((string)$lines[$j]);
            if ($candidate === '') {
                continue;
            }
            $keep[$j] = $candidate;
        }
    }

    if ($keep === []) {
        return accumul8_statement_structured_text_from_bytes($normalized, $maxLen);
    }

    ksort($keep);
    $segments = [];
    $previousIndex = null;
    foreach ($keep as $index => $line) {
        if ($previousIndex !== null && ((int)$index - (int)$previousIndex) > 1) {
            $segments[] = '';
        }
        $segments[] = $line;
        $previousIndex = (int)$index;
    }

    return accumul8_statement_structured_text_from_bytes(implode("\n", $segments), $maxLen);
}

function accumul8_statement_detect_institution_name(string $text): string
{
    $profile = accumul8_statement_detect_profile($text);
    return (string)($profile['institution_name'] ?? '');
}

function accumul8_statement_profile_catalog(): array
{
    return [
        'capital_one' => [
            'slug' => 'capital_one',
            'institution_name' => 'Capital One',
            'aliases' => ['capital one', 'capital one 360'],
            'summary_markers' => ['account summary', 'all accounts'],
            'multi_account_markers' => ['account summary', 'all accounts'],
            'supports_deterministic' => true,
        ],
        'navy_federal' => [
            'slug' => 'navy_federal',
            'institution_name' => 'Navy Federal Credit Union',
            'aliases' => ['navy federal', 'navy federal credit union', 'navyfederal.org'],
            'summary_markers' => ['summary of your deposit accounts'],
            'multi_account_markers' => ['summary of your deposit accounts', 'summary of your loan accounts'],
            'supports_deterministic' => true,
        ],
        'generic' => [
            'slug' => 'generic',
            'institution_name' => '',
            'aliases' => [],
            'summary_markers' => ['account summary'],
            'multi_account_markers' => ['account summary'],
            'supports_deterministic' => true,
        ],
    ];
}

function accumul8_statement_detect_profile(string $text, string $filename = ''): array
{
    $haystack = strtolower(accumul8_statement_structured_text_from_bytes($text . "\n" . $filename, 40000));
    foreach (accumul8_statement_profile_catalog() as $profile) {
        foreach ((array)($profile['aliases'] ?? []) as $alias) {
            $alias = strtolower(trim((string)$alias));
            if ($alias !== '' && str_contains($haystack, $alias)) {
                return $profile;
            }
        }
    }
    return accumul8_statement_profile_catalog()['generic'];
}

function accumul8_statement_has_multi_account_signal(string $text, array $profile): bool
{
    $text = strtolower(accumul8_statement_structured_text_from_bytes($text, 40000));
    foreach ((array)($profile['multi_account_markers'] ?? []) as $marker) {
        $marker = strtolower(trim((string)$marker));
        if ($marker !== '' && str_contains($text, $marker)) {
            return true;
        }
    }
    return false;
}

function accumul8_statement_extract_period_bounds(string $text): array
{
    if (preg_match('/\b([A-Z][a-z]{2,8}\s+\d{1,2})\s*-\s*([A-Z][a-z]{2,8}\s+\d{1,2},?\s+20\d{2})\b/', $text, $matches) === 1) {
        $end = accumul8_normalize_date($matches[2] ?? '');
        $endYear = $end !== null ? substr($end, 0, 4) : '';
        $startRaw = trim((string)($matches[1] ?? ''));
        if ($startRaw !== '' && $endYear !== '') {
            $startRaw .= ', ' . $endYear;
        }
        $start = accumul8_normalize_date($startRaw);
        return [$start, $end];
    }
    if (preg_match('/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/', $text, $matches) === 1) {
        return [
            accumul8_normalize_date((string)($matches[1] ?? '')),
            accumul8_normalize_date((string)($matches[2] ?? '')),
        ];
    }
    return [null, null];
}

function accumul8_statement_normalize_section_name(string $value): string
{
    $value = trim((string)preg_replace('/^[^A-Za-z0-9]+/', '', trim($value)));
    $value = trim((string)preg_replace('/\s+/', ' ', $value));
    return accumul8_normalize_text($value, 191);
}

function accumul8_statement_month_number(string $abbr): ?int
{
    $map = [
        'jan' => 1, 'feb' => 2, 'mar' => 3, 'apr' => 4, 'may' => 5, 'jun' => 6,
        'jul' => 7, 'aug' => 8, 'sep' => 9, 'sept' => 9, 'oct' => 10, 'nov' => 11, 'dec' => 12,
    ];
    $key = strtolower(substr(trim($abbr), 0, 4));
    return $map[$key] ?? null;
}

function accumul8_statement_normalize_short_date(string $raw, ?string $periodEnd = null): ?string
{
    $raw = trim($raw);
    if ($raw === '') {
        return null;
    }
    if (preg_match('/^([A-Z][a-z]{2,8})\s+(\d{1,2})$/', $raw, $matches) === 1) {
        $month = accumul8_statement_month_number((string)($matches[1] ?? ''));
        $day = (int)($matches[2] ?? 0);
        $year = $periodEnd !== null ? (int)substr($periodEnd, 0, 4) : (int)date('Y');
        if ($month !== null && $day >= 1 && $day <= 31) {
            return sprintf('%04d-%02d-%02d', $year, $month, $day);
        }
    }
    if (preg_match('/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/', $raw, $matches) === 1) {
        $month = (int)($matches[1] ?? 0);
        $day = (int)($matches[2] ?? 0);
        $year = (string)($matches[3] ?? '');
        if ($year === '' && $periodEnd !== null) {
            $year = substr($periodEnd, 0, 4);
        }
        if (strlen($year) === 2) {
            $year = ((int)$year >= 70 ? '19' : '20') . $year;
        }
        $yearInt = (int)$year;
        if ($month >= 1 && $month <= 12 && $day >= 1 && $day <= 31 && $yearInt >= 1900) {
            return sprintf('%04d-%02d-%02d', $yearInt, $month, $day);
        }
    }
    return accumul8_normalize_date($raw);
}

function accumul8_statement_is_account_header_line(string $line): bool
{
    $line = trim(preg_replace('/^[^A-Za-z0-9]+/', '', trim($line)) ?? trim($line));
    return preg_match('/^[A-Za-z][A-Za-z0-9 &\/\.\'()-]{0,80}\s*-\s*(\d{6,}|X{2,}\d{2,4})$/', $line) === 1
        || preg_match('/^[A-Za-z][A-Za-z0-9 &\/\.\'()-]{0,80}\s+(\d{6,}|X{2,}\d{2,4})\s*-\s*$/', $line) === 1;
}

function accumul8_statement_is_account_header_stem_line(string $line): bool
{
    $line = trim(preg_replace('/^[^A-Za-z0-9]+/', '', trim($line)) ?? trim($line));
    return preg_match('/^[A-Za-z][A-Za-z0-9 &\/\.\'()-]{0,80}\s+(\d{6,}|X{2,}\d{2,4})$/', $line) === 1;
}

function accumul8_statement_parse_account_header_line(string $line): array
{
    $line = trim(preg_replace('/^[^A-Za-z0-9]+/', '', trim($line)) ?? trim($line));
    $matches = [];
    if (preg_match('/^(.+?)\s*-\s*(\d{6,}|X{2,}\d{2,4})$/', $line, $matches) !== 1
        && preg_match('/^(.+?)\s+(\d{6,}|X{2,}\d{2,4})\s*-\s*$/', $line, $matches) !== 1) {
        return ['account_name_hint' => '', 'account_last4' => ''];
    }
    $name = accumul8_statement_normalize_section_name((string)($matches[1] ?? ''));
    $rawNumber = preg_replace('/\D+/', '', (string)($matches[2] ?? ''));
    $last4 = $rawNumber !== '' ? substr($rawNumber, -4) : '';
    return ['account_name_hint' => $name, 'account_last4' => $last4];
}

function accumul8_statement_parse_amount_line(string $line): array
{
    preg_match_all('/\$?\d{1,3}(?:,\d{3})*\.\d{2}\b/', $line, $matches);
    $values = [];
    foreach ((array)($matches[0] ?? []) as $match) {
        $amount = accumul8_normalize_amount($match);
        $values[] = $amount;
    }
    return $values;
}

function accumul8_statement_balance_meta_type(string $description): ?string
{
    $description = strtolower(trim($description));
    if ($description === '') {
        return null;
    }
    if (preg_match('/\b(opening|beginning|previous)\s+balance\b/', $description) === 1) {
        return 'opening_balance';
    }
    if (preg_match('/\b(closing|ending)\s+balance\b/', $description) === 1) {
        return 'closing_balance';
    }
    return null;
}

function accumul8_statement_sum_section_balances(array $sections, string $field): ?float
{
    $sum = 0.0;
    $found = false;
    foreach ($sections as $section) {
        if (!is_array($section) || !isset($section[$field]) || !is_numeric($section[$field])) {
            continue;
        }
        $sum += (float)$section[$field];
        $found = true;
    }
    return $found ? accumul8_normalize_amount($sum) : null;
}

function accumul8_statement_parse_summary_account_balances_capital_one(string $text): array
{
    $normalized = accumul8_statement_structured_text_from_bytes($text, 20000);
    if ($normalized === '' || stripos($normalized, 'Account Summary') === false) {
        return [];
    }
    $lines = preg_split('/\n/u', $normalized) ?: [];
    $collect = false;
    $summaryLines = [];
    foreach ($lines as $line) {
        $trimmed = trim((string)$line);
        if ($trimmed === '') {
            continue;
        }
        if (!$collect) {
            if (stripos($trimmed, 'Account Summary') !== false) {
                $collect = true;
            }
            continue;
        }
        if (accumul8_statement_is_account_header_line($trimmed) || preg_match('/^Page\s+\d+\s+of\s+\d+$/i', $trimmed) === 1) {
            break;
        }
        $summaryLines[] = $trimmed;
    }
    if ($summaryLines === []) {
        return [];
    }

    $sections = [];
    for ($index = 0, $count = count($summaryLines); $index < $count - 2; $index++) {
        $name = accumul8_statement_normalize_section_name($summaryLines[$index] ?? '');
        if ($name === '') {
            continue;
        }
        if (
            preg_match('/^(account name|cashflow summary|interest earned|this period|member|fdic|lender)$/i', $name) === 1
            || preg_match('/^[A-Z][a-z]{2,8}\s+\d{1,2}$/', $name) === 1
        ) {
            continue;
        }
        $openingLine = trim((string)($summaryLines[$index + 1] ?? ''));
        $closingLine = trim((string)($summaryLines[$index + 2] ?? ''));
        if (preg_match('/^\$?\d{1,3}(?:,\d{3})*\.\d{2}$/', $openingLine) !== 1 || preg_match('/^\$?\d{1,3}(?:,\d{3})*\.\d{2}$/', $closingLine) !== 1) {
            continue;
        }
        $sections[] = [
            'account_name_hint' => $name,
            'opening_balance' => accumul8_normalize_amount($openingLine),
            'closing_balance' => accumul8_normalize_amount($closingLine),
        ];
        $index += 2;
    }
    return $sections;
}

function accumul8_statement_parse_summary_account_balances_navy_federal(string $text): array
{
    $normalized = accumul8_statement_structured_text_from_bytes($text, 30000);
    if ($normalized === '' || stripos($normalized, 'Summary of your deposit accounts') === false) {
        return [];
    }
    $lines = preg_split('/\n/u', $normalized) ?: [];
    $collect = false;
    $summaryLines = [];
    foreach ($lines as $line) {
        $trimmed = trim((string)$line);
        if ($trimmed === '') {
            continue;
        }
        if (!$collect) {
            if (stripos($trimmed, 'Summary of your deposit accounts') !== false) {
                $collect = true;
            }
            continue;
        }
        if (preg_match('/^Page\s+\d+\s+of\s+\d+$/i', $trimmed) === 1 || accumul8_statement_is_account_header_line($trimmed)) {
            break;
        }
        $summaryLines[] = $trimmed;
    }
    $sections = [];
    for ($index = 0, $count = count($summaryLines); $index < $count; $index++) {
        $name = accumul8_statement_normalize_section_name((string)($summaryLines[$index] ?? ''));
        if ($name === '' || preg_match('/^(previous|ending|totals|summary|page|balance|deposits|credits|withdrawals|debits|ytd dividends)$/i', $name) === 1) {
            continue;
        }
        $accountNumber = preg_replace('/\D+/', '', (string)($summaryLines[$index + 1] ?? ''));
        $openingLine = trim((string)($summaryLines[$index + 2] ?? ''));
        $closingLine = trim((string)($summaryLines[$index + 5] ?? ''));
        if ($accountNumber === '' || preg_match('/^\$?\d{1,3}(?:,\d{3})*\.\d{2}$/', $openingLine) !== 1 || preg_match('/^\$?\d{1,3}(?:,\d{3})*\.\d{2}$/', $closingLine) !== 1) {
            continue;
        }
        $sections[] = [
            'account_name_hint' => $name,
            'account_last4' => substr($accountNumber, -4),
            'opening_balance' => accumul8_normalize_amount($openingLine),
            'closing_balance' => accumul8_normalize_amount($closingLine),
        ];
        $index += 6;
    }
    return $sections;
}

function accumul8_statement_parse_summary_account_balances(string $text, array $profile = []): array
{
    $slug = strtolower(trim((string)($profile['slug'] ?? 'generic')));
    if ($slug === 'capital_one') {
        return accumul8_statement_parse_summary_account_balances_capital_one($text);
    }
    if ($slug === 'navy_federal') {
        return accumul8_statement_parse_summary_account_balances_navy_federal($text);
    }
    return [];
}

function accumul8_statement_is_transaction_noise_line(string $line): bool
{
    $line = trim($line);
    if ($line === '') {
        return true;
    }
    return preg_match('/^(capitalone\.com|navyfederal\.org|1-\d{3}-\d{3}-\d{4}|Page \d+ of \d+|MEMBER|FDIC|LENDER|STATEMENT PERIOD|STATEMENT OF ACCOUNT|DATE|DESCRIPTION|CATEGORY|AMOUNT|AMOUNT\(\$\)|BALANCE|BALANCE\(\$\)|DAYS IN STATEMENT|CYCLE|TRANSACTION DETAIL|QUESTIONS ABOUT THIS STATEMENT\?|ACCESS NO\..*|FOR JONATHAN D GRAVES|JOINT OWNER\(S\):.*)$/i', $line) === 1
        || preg_match('/^P\.O\.\s+Box\b/i', $line) === 1;
}

function accumul8_statement_is_transaction_date_line(string $line): bool
{
    $line = trim($line);
    return preg_match('/^[A-Z][a-z]{2,8}\s+\d{1,2}$/', $line) === 1
        || preg_match('/^\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?$/', $line) === 1;
}

function accumul8_statement_parse_transaction_block(array $block, string $accountNameHint, string $accountLast4, ?string $periodEnd, ?int $pageNumber): ?array
{
    if ($block === []) {
        return null;
    }
    $dateRaw = trim((string)array_shift($block));
    $txDate = accumul8_statement_normalize_short_date($dateRaw, $periodEnd);
    if ($txDate === null) {
        return null;
    }

    $negativeHint = false;
    $positiveHint = false;
    $descriptionParts = [];
    $amounts = [];
    foreach ($block as $line) {
        $trimmed = trim((string)$line);
        if ($trimmed === '') {
            continue;
        }
        if (preg_match('/^debit$/i', $trimmed) === 1 || preg_match('/\b(withdrawal|purchase|payment)\b/i', $trimmed) === 1 || $trimmed === '-') {
            $negativeHint = true;
        }
        if (
            preg_match('/^credit$/i', $trimmed) === 1
            || preg_match('/^\+\s*\$?\d/i', $trimmed) === 1
            || preg_match('/\bdeposit(?:\s+from)?\b/i', $trimmed) === 1
            || preg_match('/\binterest paid\b/i', $trimmed) === 1
        ) {
            $positiveHint = true;
        }
        $parsedAmounts = accumul8_statement_parse_amount_line($trimmed);
        if ($parsedAmounts !== []) {
            $amounts = array_merge($amounts, $parsedAmounts);
            continue;
        }
        if (!preg_match('/^(debit|credit|category|amount|balance)$/i', $trimmed)) {
            $descriptionParts[] = $trimmed;
        }
    }

    $description = accumul8_normalize_text((string)preg_replace('/\s+-$/', '', implode(' ', $descriptionParts)), 255);
    if ($description === '') {
        return null;
    }
    if (preg_match('/\b(cashflow summary|account summary|total ending balance|interest earned this period)\b/i', $description) === 1) {
        return null;
    }

    $balanceMetaType = accumul8_statement_balance_meta_type($description);
    if ($balanceMetaType !== null) {
        return [
            '_meta' => $balanceMetaType,
            'amount' => $amounts[count($amounts) - 1] ?? null,
        ];
    }
    if ($amounts === []) {
        return null;
    }

    $amount = (float)$amounts[0];
    if ($negativeHint && $amount > 0) {
        $amount *= -1;
    }
    if ($positiveHint && $amount < 0) {
        $amount = abs($amount);
    }

    return [
        'transaction_date' => $txDate,
        'posted_date' => '',
        'description' => $description,
        'memo' => '',
        'amount' => accumul8_normalize_amount($amount),
        'running_balance' => count($amounts) > 1 ? accumul8_normalize_amount($amounts[count($amounts) - 1]) : null,
        'page_number' => $pageNumber,
        'statement_account_name_hint' => $accountNameHint,
        'statement_account_last4' => $accountLast4,
    ];
}

function accumul8_statement_parse_ocr_text_deterministically(string $text, array $profile = []): array
{
    $normalized = accumul8_statement_structured_text_from_bytes($text, 120000);
    if ($normalized === '') {
        return [];
    }

    [$periodStart, $periodEnd] = accumul8_statement_extract_period_bounds($normalized);
    $summarySections = accumul8_statement_parse_summary_account_balances($normalized, $profile);
    $statementKind = stripos($normalized, 'credit card') !== false ? 'credit_card' : 'bank_account';
    $institutionName = accumul8_normalize_text((string)($profile['institution_name'] ?? ''), 191);
    if ($institutionName === '') {
        $institutionName = accumul8_statement_detect_institution_name($normalized);
    }

    $lines = preg_split('/\n/u', $normalized) ?: [];
    $currentAccountName = '';
    $currentAccountLast4 = '';
    $currentPage = null;
    $currentBlock = [];
    $transactions = [];
    $sections = [];
    $openingBalance = null;
    $closingBalance = null;

    $ensureSection = static function (string $accountNameHint, string $accountLast4) use (&$sections): string {
        $key = accumul8_statement_section_key($accountNameHint, $accountLast4);
        if ($key === '|') {
            return '';
        }
        if (!isset($sections[$key])) {
            $sections[$key] = [
                'account_name_hint' => $accountNameHint,
                'account_last4' => $accountLast4,
                'opening_balance' => null,
                'closing_balance' => null,
                'transactions' => [],
            ];
        }
        return $key;
    };

    $flushBlock = static function () use (&$currentBlock, &$transactions, &$openingBalance, &$closingBalance, &$currentAccountName, &$currentAccountLast4, &$periodEnd, &$currentPage, &$sections, $ensureSection): void {
        $parsed = accumul8_statement_parse_transaction_block($currentBlock, $currentAccountName, $currentAccountLast4, $periodEnd, $currentPage);
        $currentBlock = [];
        if (!is_array($parsed) || $parsed === []) {
            return;
        }
        $sectionKey = $ensureSection($currentAccountName, $currentAccountLast4);
        if (($parsed['_meta'] ?? '') === 'opening_balance') {
            if (isset($parsed['amount']) && is_numeric($parsed['amount'])) {
                $balance = accumul8_normalize_amount($parsed['amount']);
                if ($sectionKey !== '') {
                    $sections[$sectionKey]['opening_balance'] = $balance;
                }
                if ($openingBalance === null && $sectionKey !== '') {
                    $openingBalance = $balance;
                }
            }
            return;
        }
        if (($parsed['_meta'] ?? '') === 'closing_balance') {
            if (isset($parsed['amount']) && is_numeric($parsed['amount'])) {
                $balance = accumul8_normalize_amount($parsed['amount']);
                if ($sectionKey !== '') {
                    $sections[$sectionKey]['closing_balance'] = $balance;
                }
                $closingBalance = $balance;
            }
            return;
        }
        unset($parsed['_meta']);
        $transactions[] = $parsed;
        if ($sectionKey !== '') {
            $sections[$sectionKey]['transactions'][] = $parsed;
        }
    };

    for ($lineIndex = 0, $lineCount = count($lines); $lineIndex < $lineCount; $lineIndex++) {
        $trimmed = trim((string)($lines[$lineIndex] ?? ''));
        if ($trimmed === '') {
            continue;
        }
        if (preg_match('/\bPage\s+(\d+)\s+of\s+\d+\b/i', $trimmed, $matches) === 1) {
            $currentPage = (int)($matches[1] ?? 0) ?: $currentPage;
        }
        $headerCandidate = $trimmed;
        $nextTrimmed = trim((string)($lines[$lineIndex + 1] ?? ''));
        if (!accumul8_statement_is_account_header_line($headerCandidate)
            && accumul8_statement_is_account_header_stem_line($headerCandidate)
            && $nextTrimmed === '-') {
            $headerCandidate .= ' -';
            $lineIndex++;
        }
        if (accumul8_statement_is_account_header_line($headerCandidate)) {
            $flushBlock();
            $account = accumul8_statement_parse_account_header_line($headerCandidate);
            $currentAccountName = (string)($account['account_name_hint'] ?? '');
            $currentAccountLast4 = (string)($account['account_last4'] ?? '');
            $ensureSection($currentAccountName, $currentAccountLast4);
            continue;
        }
        if (accumul8_statement_is_transaction_date_line($trimmed)) {
            $flushBlock();
            $currentBlock = [$trimmed];
            continue;
        }
        if ($currentBlock !== [] && !accumul8_statement_is_transaction_noise_line($trimmed)) {
            $currentBlock[] = $trimmed;
        }
    }
    $flushBlock();

    if (count($transactions) < 5) {
        return [];
    }

    $normalizedSections = [];
    foreach ($sections as $key => $section) {
        if (!is_array($section)) {
            continue;
        }
        $normalizedSections[$key] = [
            'account_name_hint' => accumul8_statement_normalize_section_name((string)($section['account_name_hint'] ?? '')),
            'account_last4' => accumul8_normalize_text((string)($section['account_last4'] ?? ''), 16),
            'opening_balance' => isset($section['opening_balance']) && is_numeric($section['opening_balance'])
                ? accumul8_normalize_amount($section['opening_balance'])
                : null,
            'closing_balance' => isset($section['closing_balance']) && is_numeric($section['closing_balance'])
                ? accumul8_normalize_amount($section['closing_balance'])
                : null,
            'transactions' => array_values(array_filter((array)($section['transactions'] ?? []), static fn($tx): bool => is_array($tx))),
        ];
    }
    foreach ($summarySections as $summarySection) {
        if (!is_array($summarySection)) {
            continue;
        }
        $summaryName = accumul8_statement_normalize_section_name((string)($summarySection['account_name_hint'] ?? ''));
        if ($summaryName === '' || preg_match('/^all accounts$/i', $summaryName) === 1) {
            continue;
        }
        $matchedKey = '';
        foreach ($normalizedSections as $sectionKey => $existingSection) {
            $existingName = strtolower((string)($existingSection['account_name_hint'] ?? ''));
            $summaryNameLower = strtolower($summaryName);
            if ($existingName !== '' && ($existingName === $summaryNameLower || str_contains($existingName, $summaryNameLower) || str_contains($summaryNameLower, $existingName))) {
                $matchedKey = (string)$sectionKey;
                break;
            }
        }
        if ($matchedKey === '') {
            $summaryLast4 = accumul8_normalize_text((string)($summarySection['account_last4'] ?? ''), 16);
            $matchedKey = accumul8_statement_section_key($summaryName, $summaryLast4);
            $normalizedSections[$matchedKey] = [
                'account_name_hint' => $summaryName,
                'account_last4' => $summaryLast4,
                'opening_balance' => null,
                'closing_balance' => null,
                'transactions' => [],
            ];
        }
        if (($normalizedSections[$matchedKey]['account_last4'] ?? '') === '') {
            $normalizedSections[$matchedKey]['account_last4'] = accumul8_normalize_text((string)($summarySection['account_last4'] ?? ''), 16);
        }
        $sectionTxCount = count((array)($normalizedSections[$matchedKey]['transactions'] ?? []));
        if (isset($summarySection['opening_balance']) && is_numeric($summarySection['opening_balance']) && ($normalizedSections[$matchedKey]['opening_balance'] === null || $sectionTxCount === 0)) {
            $normalizedSections[$matchedKey]['opening_balance'] = accumul8_normalize_amount($summarySection['opening_balance']);
        }
        if (isset($summarySection['closing_balance']) && is_numeric($summarySection['closing_balance']) && ($normalizedSections[$matchedKey]['closing_balance'] === null || $sectionTxCount === 0)) {
            $normalizedSections[$matchedKey]['closing_balance'] = accumul8_normalize_amount($summarySection['closing_balance']);
        }
    }
    if (count($normalizedSections) > 1) {
        $openingBalance = accumul8_statement_sum_section_balances($normalizedSections, 'opening_balance') ?? $openingBalance;
        $closingBalance = accumul8_statement_sum_section_balances($normalizedSections, 'closing_balance') ?? $closingBalance;
    } elseif ($normalizedSections !== []) {
        $firstSection = array_values($normalizedSections)[0];
        if ($openingBalance === null && isset($firstSection['opening_balance']) && is_numeric($firstSection['opening_balance'])) {
            $openingBalance = accumul8_normalize_amount($firstSection['opening_balance']);
        }
        if ($closingBalance === null && isset($firstSection['closing_balance']) && is_numeric($firstSection['closing_balance'])) {
            $closingBalance = accumul8_normalize_amount($firstSection['closing_balance']);
        }
    }
    uasort($normalizedSections, static function (array $left, array $right): int {
        return count((array)($right['transactions'] ?? [])) <=> count((array)($left['transactions'] ?? []));
    });
    $leadSection = $normalizedSections !== [] ? array_values($normalizedSections)[0] : [];

    return accumul8_statement_normalize_parsed_payload([
        'statement_kind' => $statementKind,
        'institution_name' => $institutionName,
        'account_name_hint' => (string)($leadSection['account_name_hint'] ?? $transactions[0]['statement_account_name_hint'] ?? ''),
        'account_last4' => (string)($leadSection['account_last4'] ?? $transactions[0]['statement_account_last4'] ?? ''),
        'period_start' => $periodStart ?? '',
        'period_end' => $periodEnd ?? '',
        'opening_balance' => $openingBalance,
        'closing_balance' => $closingBalance,
        'account_sections' => array_values($normalizedSections),
        'transactions' => $transactions,
    ]);
}

function accumul8_statement_provider_has_api_key(string $provider): bool
{
    $provider = strtolower(trim($provider));
    if ($provider === '') {
        return false;
    }
    $apiKey = secret_get(catn8_settings_ai_secret_key($provider, 'api_key'));
    return is_string($apiKey) && trim($apiKey) !== '';
}

function accumul8_statement_effective_provider(string $preferredProvider, array $supportedProviders): string
{
    $preferredProvider = strtolower(trim($preferredProvider));
    $supportedProviders = array_values(array_unique(array_map(static fn($provider): string => strtolower(trim((string)$provider)), $supportedProviders)));
    if ($preferredProvider !== '' && in_array($preferredProvider, $supportedProviders, true) && accumul8_statement_provider_has_api_key($preferredProvider)) {
        return $preferredProvider;
    }
    foreach ($supportedProviders as $provider) {
        if ($provider !== '' && accumul8_statement_provider_has_api_key($provider)) {
            return $provider;
        }
    }
    return $preferredProvider;
}

function accumul8_statement_effective_parse_provider(): string
{
    foreach (['openai', 'google_ai_studio', 'google_vertex_ai'] as $provider) {
        if ($provider === 'google_vertex_ai') {
            $saJson = secret_get(catn8_settings_ai_secret_key($provider, 'service_account_json'));
            if (is_string($saJson) && trim($saJson) !== '') {
                return $provider;
            }
            continue;
        }
        if (accumul8_statement_provider_has_api_key($provider)) {
            return $provider;
        }
    }

    $cfg = catn8_settings_ai_get_config();
    return strtolower(trim((string)($cfg['provider'] ?? 'openai')));
}

function accumul8_statement_ai_json_schema_prompt(string $mode): string
{
    $sourcePhrase = $mode === 'pdf'
        ? 'from the attached bank statement PDF'
        : 'from statement page images';
    return <<<TXT
You extract financial statement data into strict JSON {$sourcePhrase}.
Amounts must be signed exactly how they affect the account balance.
Return one JSON object only.
If the document mentions multiple accounts, keep track of the active account section and tag every transaction row with the account section it belongs to.
Ignore summary-only account references that do not own the listed transactions.
Set account_name_hint and account_last4 to the first transaction-bearing account section in document order.
When multiple accounts appear, populate account_sections and include every transaction under the correct section.
Use this schema:
{
  "statement_kind": "bank_account|credit_card|loan|mortgage|other",
  "institution_name": "",
  "account_name_hint": "",
  "account_last4": "",
  "period_start": "YYYY-MM-DD or empty",
  "period_end": "YYYY-MM-DD or empty",
  "opening_balance": number|null,
  "closing_balance": number|null,
  "account_sections": [
    {
      "account_name_hint": "",
      "account_last4": "",
      "transactions": []
    }
  ],
  "transactions": [
    {
      "transaction_date": "YYYY-MM-DD",
      "posted_date": "YYYY-MM-DD or empty",
      "description": "",
      "memo": "",
      "amount": number,
      "running_balance": number|null,
      "page_number": number|null,
      "statement_account_name_hint": "",
      "statement_account_last4": ""
    }
  ],
  "reconciliation_notes": [""],
  "account_match_hints": [""]
}
TXT;
}

function accumul8_ai_generate_statement_json_from_images(array $images, array $accountCatalog): array
{
    $cfg = catn8_settings_ai_get_config();
    $provider = accumul8_statement_effective_provider((string)($cfg['provider'] ?? 'openai'), ['openai', 'google_ai_studio']);
    $model = trim((string)($cfg['model'] ?? ''));
    $baseUrl = trim((string)($cfg['base_url'] ?? ''));
    $temperature = (float)($cfg['temperature'] ?? 0.1);
    $accountsJson = json_encode($accountCatalog, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $systemPrompt = accumul8_statement_ai_json_schema_prompt('image');

    $imageParts = [];
    foreach ($images as $image) {
        if (!is_array($image)) {
            continue;
        }
        $path = (string)($image['path'] ?? '');
        $pageNumber = (int)($image['page_number'] ?? 0);
        if ($path === '' || !is_file($path)) {
            continue;
        }
        $bytes = (string)file_get_contents($path);
        if ($bytes === '') {
            continue;
        }
        $imageParts[] = [
            'page_number' => $pageNumber,
            'mime_type' => 'image/png',
            'base64' => base64_encode($bytes),
        ];
    }
    if ($imageParts === []) {
        throw new RuntimeException('No statement page images were available for AI scanning');
    }

    if ($provider === 'openai') {
        $visionModel = accumul8_openai_statement_pdf_model($model);
        $content = [[
            'type' => 'input_text',
            'text' => "Known accounts JSON:\n" . $accountsJson . "\n\nExtract the statement JSON from these page images. Preserve page numbers.",
        ]];
        foreach ($imageParts as $imagePart) {
            $content[] = [
                'type' => 'input_text',
                'text' => 'Statement page ' . (int)$imagePart['page_number'],
            ];
            $content[] = [
                'type' => 'input_image',
                'image_url' => 'data:' . (string)$imagePart['mime_type'] . ';base64,' . (string)$imagePart['base64'],
            ];
        }
        $result = accumul8_openai_responses_json(
            $visionModel,
            [[
                'role' => 'system',
                'content' => [
                    ['type' => 'input_text', 'text' => $systemPrompt],
                ],
            ], [
                'role' => 'user',
                'content' => $content,
            ]],
            $baseUrl,
            $temperature,
            accumul8_statement_openai_max_output_tokens(),
            accumul8_statement_openai_response_format(),
            120
        );
        return [
            'provider' => $provider,
            'model' => $visionModel,
            'json' => $result['json'],
        ];
    }

    if ($provider === 'google_ai_studio') {
        $apiKey = secret_get(catn8_settings_ai_secret_key($provider, 'api_key'));
        if (!is_string($apiKey) || trim($apiKey) === '') {
            throw new RuntimeException('Missing AI API key (google_ai_studio)');
        }
        $parts = [[
            'text' => "Known accounts JSON:\n" . $accountsJson . "\n\nExtract the statement JSON from these page images. Preserve page numbers.",
        ]];
        foreach ($imageParts as $imagePart) {
            $parts[] = ['text' => 'Statement page ' . (int)$imagePart['page_number']];
            $parts[] = [
                'inline_data' => [
                    'mime_type' => (string)$imagePart['mime_type'],
                    'data' => (string)$imagePart['base64'],
                ],
            ];
        }
        $resp = catn8_http_json_with_status(
            'POST',
            'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model !== '' ? $model : 'gemini-1.5-pro') . ':generateContent',
            ['x-goog-api-key' => trim((string)$apiKey)],
            [
                'contents' => [[
                    'role' => 'user',
                    'parts' => $parts,
                ]],
                'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
                'generationConfig' => ['temperature' => $temperature],
            ],
            10,
            60
        );
        $content = (string)($resp['json']['candidates'][0]['content']['parts'][0]['text'] ?? '');
        $jsonText = accumul8_extract_json_from_text($content);
        $decoded = json_decode($jsonText, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('AI image scan returned invalid statement JSON');
        }
        return [
            'provider' => $provider,
            'model' => $model,
            'json' => $decoded,
        ];
    }

    throw new RuntimeException('AI image scanning fallback is not configured for provider "' . $provider . '"');
}

function accumul8_ai_generate_statement_json_from_pdf(string $pdfPath, array $accountCatalog): array
{
    $cfg = catn8_settings_ai_get_config();
    $provider = accumul8_statement_effective_provider((string)($cfg['provider'] ?? 'openai'), ['openai', 'google_ai_studio']);
    $model = trim((string)($cfg['model'] ?? ''));
    $baseUrl = trim((string)($cfg['base_url'] ?? ''));
    $temperature = (float)($cfg['temperature'] ?? 0.1);
    $accountsJson = json_encode($accountCatalog, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $systemPrompt = accumul8_statement_ai_json_schema_prompt('pdf');

    if ($pdfPath === '' || !is_file($pdfPath)) {
        throw new RuntimeException('Statement PDF was not available for AI scanning');
    }
    $bytes = (string)file_get_contents($pdfPath);
    if ($bytes === '') {
        throw new RuntimeException('Statement PDF could not be read for AI scanning');
    }

    if ($provider === 'google_ai_studio') {
        $apiKey = secret_get(catn8_settings_ai_secret_key($provider, 'api_key'));
        if (!is_string($apiKey) || trim($apiKey) === '') {
            throw new RuntimeException('Missing AI API key (google_ai_studio)');
        }

        $parts = [[
            'text' => "Known accounts JSON:\n" . $accountsJson . "\n\nExtract the statement JSON from this PDF. Preserve page numbers when you can identify them.",
        ], [
            'inline_data' => [
                'mime_type' => 'application/pdf',
                'data' => base64_encode($bytes),
            ],
        ]];

        $resp = catn8_http_json_with_status(
            'POST',
            'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model !== '' ? $model : 'gemini-1.5-pro') . ':generateContent',
            ['x-goog-api-key' => trim((string)$apiKey)],
            [
                'contents' => [[
                    'role' => 'user',
                    'parts' => $parts,
                ]],
                'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
                'generationConfig' => ['temperature' => $temperature],
            ],
            10,
            60
        );
        $content = (string)($resp['json']['candidates'][0]['content']['parts'][0]['text'] ?? '');
        $jsonText = accumul8_extract_json_from_text($content);
        $decoded = json_decode($jsonText, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('AI PDF scan returned invalid statement JSON');
        }
        return [
            'provider' => $provider,
            'model' => $model,
            'json' => $decoded,
        ];
    }

    if ($provider === 'openai') {
        $pdfModel = accumul8_openai_statement_pdf_model($model);
        $result = accumul8_openai_responses_json(
            $pdfModel,
            [[
                'role' => 'system',
                'content' => [
                    ['type' => 'input_text', 'text' => $systemPrompt],
                ],
            ], [
                'role' => 'user',
                'content' => [
                    [
                        'type' => 'input_text',
                        'text' => "Known accounts JSON:\n" . $accountsJson . "\n\nExtract the statement JSON from this PDF. Preserve page numbers when you can identify them.",
                    ],
                    [
                        'type' => 'input_file',
                        'filename' => 'statement.pdf',
                        'file_data' => 'data:application/pdf;base64,' . base64_encode($bytes),
                    ],
                ],
            ]],
            $baseUrl,
            $temperature,
            accumul8_statement_openai_max_output_tokens(),
            accumul8_statement_openai_response_format(),
            180
        );
        return [
            'provider' => $provider,
            'model' => $pdfModel,
            'json' => $result['json'],
        ];
    }

    throw new RuntimeException('Direct PDF AI scanning is not configured for provider "' . $provider . '"');
}

function accumul8_ai_generate_statement_json(string $text, array $accountCatalog, array $pageCatalog = [], array $profile = []): array
{
    $cfg = catn8_settings_ai_get_config();
    $provider = accumul8_statement_effective_parse_provider();
    $model = trim((string)($cfg['model'] ?? ''));
    $baseUrl = trim((string)($cfg['base_url'] ?? ''));
    $location = trim((string)($cfg['location'] ?? 'us-central1'));
    $temperature = 0.0;
    $truncatedText = accumul8_statement_compact_ocr_text_for_parse($text, 36000);
    if ($truncatedText === '') {
        $truncatedText = accumul8_statement_structured_text_from_bytes($text, 36000);
    }

    $systemPrompt = <<<TXT
You extract financial statement data into strict JSON.
Use only the OCR text provided.
Do not invent transactions, dates, balances, amounts, or account numbers.
Amounts must be signed exactly how they affect the account balance.
Return one JSON object only.
Prefer omission over guessing. If a field cannot be read confidently, use an empty string or null.
Track the active account section and assign each transaction to that section.
Ignore account summary rows that are not transaction activity.
Set account_name_hint and account_last4 to the first transaction-bearing account section in document order.
Populate account_sections only for sections that actually contain transactions.
Set page_number only when it is explicitly shown or strongly implied by nearby OCR text.
Use this schema:
{
  "statement_kind": "bank_account|credit_card|loan|mortgage|other",
  "institution_name": "",
  "account_name_hint": "",
  "account_last4": "",
  "period_start": "YYYY-MM-DD or empty",
  "period_end": "YYYY-MM-DD or empty",
  "opening_balance": number|null,
  "closing_balance": number|null,
  "account_sections": [
    {
      "account_name_hint": "",
      "account_last4": "",
      "transactions": []
    }
  ],
  "transactions": [
    {
      "transaction_date": "YYYY-MM-DD",
      "posted_date": "YYYY-MM-DD or empty",
      "description": "",
      "memo": "",
      "amount": number,
      "running_balance": number|null,
      "page_number": number|null,
      "statement_account_name_hint": "",
      "statement_account_last4": ""
    }
  ]
}
TXT;

    $profilePrompt = '';
    if (accumul8_normalize_text((string)($profile['institution_name'] ?? ''), 191) !== '') {
        $profilePrompt = "Detected statement profile: " . accumul8_normalize_text((string)($profile['institution_name'] ?? ''), 191) . "\n";
    }

    $userPrompt = $profilePrompt . "Statement OCR text:\n" . $truncatedText;

    if ($provider === 'google_vertex_ai') {
        $saJson = secret_get(catn8_settings_ai_secret_key($provider, 'service_account_json'));
        if (!is_string($saJson) || trim($saJson) === '') {
            throw new RuntimeException('Missing AI service account JSON (google_vertex_ai)');
        }
        $sa = json_decode((string)$saJson, true);
        if (!is_array($sa)) {
            throw new RuntimeException('AI Vertex service account JSON is invalid');
        }
        $content = catn8_vertex_ai_gemini_generate_text([
            'service_account_json' => $saJson,
            'project_id' => trim((string)($sa['project_id'] ?? '')),
            'location' => $location !== '' ? $location : 'us-central1',
            'model' => $model !== '' ? $model : 'gemini-1.5-pro',
            'system_prompt' => $systemPrompt,
            'user_prompt' => $userPrompt,
            'temperature' => $temperature,
            'max_output_tokens' => 3072,
        ]);
    } elseif ($provider === 'google_ai_studio') {
        $apiKey = secret_get(catn8_settings_ai_secret_key($provider, 'api_key'));
        if (!is_string($apiKey) || trim($apiKey) === '') {
            throw new RuntimeException('Missing AI API key (google_ai_studio)');
        }
        $resp = catn8_http_json_with_status('POST', 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model !== '' ? $model : 'gemini-1.5-pro') . ':generateContent', ['x-goog-api-key' => trim($apiKey)], [
            'contents' => [['role' => 'user', 'parts' => [['text' => $userPrompt]]]],
            'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
            'generationConfig' => ['temperature' => $temperature],
        ], 10, 45);
        $content = (string)($resp['json']['candidates'][0]['content']['parts'][0]['text'] ?? '');
    } else {
        $statementModel = accumul8_openai_statement_pdf_model($model);
        $result = accumul8_openai_responses_json(
            $statementModel,
            [[
                'role' => 'system',
                'content' => [
                    ['type' => 'input_text', 'text' => $systemPrompt],
                ],
            ], [
                'role' => 'user',
                'content' => [
                    ['type' => 'input_text', 'text' => $userPrompt],
                ],
            ]],
            $baseUrl,
            $temperature,
            accumul8_statement_openai_max_output_tokens(),
            accumul8_statement_openai_response_format()
        );
        $content = (string)($result['content'] ?? '');
        $model = $statementModel;
    }

    $jsonText = accumul8_extract_json_from_text((string)$content);
    $decoded = json_decode($jsonText, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('AI returned invalid statement JSON');
    }
    return [
        'provider' => $provider,
        'model' => $model,
        'json' => $decoded,
    ];
}

function accumul8_table_has_column(string $tableName, string $columnName): bool
{
    $row = Database::queryOne(
        'SELECT 1
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
         LIMIT 1',
        [$tableName, $columnName]
    );
    return $row !== null;
}

function accumul8_table_exists(string $tableName): bool
{
    $row = Database::queryOne(
        'SELECT 1
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
         LIMIT 1',
        [$tableName]
    );
    return $row !== null;
}

function accumul8_table_has_index(string $tableName, string $indexName): bool
{
    $row = Database::queryOne(
        'SELECT 1
         FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND INDEX_NAME = ?
         LIMIT 1',
        [$tableName, $indexName]
    );
    return $row !== null;
}

function accumul8_table_has_foreign_key(string $tableName, string $constraintName): bool
{
    $row = Database::queryOne(
        'SELECT 1
         FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND CONSTRAINT_NAME = ?
           AND CONSTRAINT_TYPE = ?
         LIMIT 1',
        [$tableName, $constraintName, 'FOREIGN KEY']
    );
    return $row !== null;
}

function accumul8_table_add_column_if_missing(string $tableName, string $columnName, string $columnDefinition): void
{
    if (!accumul8_table_has_column($tableName, $columnName)) {
        Database::execute('ALTER TABLE `' . $tableName . '` ADD COLUMN `' . $columnName . '` ' . $columnDefinition);
    }
}

function accumul8_optional_select(string $tableName, string $columnName, string $presentExpression, string $missingExpression): string
{
    return accumul8_table_has_column($tableName, $columnName) ? $presentExpression : $missingExpression;
}

function accumul8_normalize_contact_type_value($value, string $default = 'payee'): string
{
    $normalized = strtolower(trim((string)$value));
    if ($normalized === 'repayment') {
        return 'repayment';
    }
    if ($normalized === 'payer') {
        return 'payer';
    }
    if ($normalized === 'payee' || $normalized === 'both' || $normalized === 'contact' || $normalized === '') {
        return $normalized === '' ? $default : 'payee';
    }
    return $default;
}

function accumul8_normalize_entity_kind_value($value, string $default = 'business'): string
{
    $normalized = strtolower(trim((string)$value));
    if ($normalized === 'business') {
        return 'business';
    }
    if ($normalized === 'contact' || $normalized === 'person' || $normalized === '') {
        return $normalized === '' ? $default : 'contact';
    }
    return $default;
}

function accumul8_entity_kind_from_vendor_state($entityKind, $isVendor): string
{
    return accumul8_normalize_bool($isVendor) === 1
        ? 'business'
        : accumul8_normalize_entity_kind_value($entityKind, 'contact');
}

function accumul8_contact_type_flags(string $contactType): array
{
    $normalized = accumul8_normalize_contact_type_value($contactType);
    if ($normalized === 'payee') {
        return ['is_payee' => 1, 'is_payer' => 0];
    }
    if ($normalized === 'payer') {
        return ['is_payee' => 0, 'is_payer' => 1];
    }
    return ['is_payee' => 0, 'is_payer' => 0];
}

function accumul8_find_matching_entity_id(int $viewerId, string $displayName): ?int
{
    $normalizedKey = accumul8_entity_match_key(accumul8_entity_alias_name($displayName));
    if ($normalizedKey === '') {
        return null;
    }

    if (accumul8_table_exists('accumul8_entity_aliases')) {
        $aliasRow = Database::queryOne(
            'SELECT entity_id
             FROM accumul8_entity_aliases
             WHERE owner_user_id = ?
               AND alias_key = ?
             LIMIT 1',
            [$viewerId, $normalizedKey]
        );
        if ($aliasRow && (int)($aliasRow['entity_id'] ?? 0) > 0) {
            return (int)$aliasRow['entity_id'];
        }
    }

    $rows = Database::queryAll(
        'SELECT id, display_name
         FROM accumul8_entities
         WHERE owner_user_id = ?
         ORDER BY
           CASE WHEN legacy_contact_id IS NOT NULL THEN 0 ELSE 1 END,
           CASE WHEN legacy_debtor_id IS NOT NULL THEN 0 ELSE 1 END,
           id ASC',
        [$viewerId]
    );

    foreach ($rows as $row) {
        if (accumul8_entity_match_key(accumul8_entity_alias_name((string)($row['display_name'] ?? ''))) === $normalizedKey) {
            return (int)($row['id'] ?? 0);
        }
    }

    return null;
}

function accumul8_assign_entity_alias(
    int $viewerId,
    int $entityId,
    string $aliasName,
    bool $skipConflict = false,
    bool $reassignConflict = false
): array
{
    if ($entityId <= 0 || !accumul8_table_exists('accumul8_entity_aliases')) {
        return ['id' => null, 'status' => 'invalid'];
    }

    $displayAlias = accumul8_entity_alias_display_name($aliasName);
    $aliasKey = accumul8_entity_match_key(accumul8_entity_alias_name($aliasName));
    if ($displayAlias === '' || $aliasKey === '') {
        return ['id' => null, 'status' => 'invalid'];
    }

    $entity = Database::queryOne(
        'SELECT display_name
         FROM accumul8_entities
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$entityId, $viewerId]
    );
    if (!$entity) {
        return ['id' => null, 'status' => 'missing_entity'];
    }

    if (accumul8_entity_match_key($displayAlias) === accumul8_entity_match_key((string)($entity['display_name'] ?? ''))) {
        return ['id' => null, 'status' => 'matches_display_name'];
    }

    $existing = Database::queryOne(
        'SELECT id, entity_id
         FROM accumul8_entity_aliases
         WHERE owner_user_id = ?
           AND alias_key = ?
         LIMIT 1',
        [$viewerId, $aliasKey]
    );
    if ($existing) {
        $existingId = (int)($existing['id'] ?? 0);
        $existingEntityId = (int)($existing['entity_id'] ?? 0);
        if ($existingEntityId !== $entityId) {
            if ($reassignConflict && $existingId > 0) {
                Database::execute(
                    'UPDATE accumul8_entity_aliases
                     SET entity_id = ?, alias_name = ?
                     WHERE id = ? AND owner_user_id = ?',
                    [$entityId, $displayAlias, $existingId, $viewerId]
                );
                return ['id' => $existingId, 'status' => 'reassigned', 'entity_id' => $entityId];
            }
            return [
                'id' => $existingId > 0 ? $existingId : null,
                'status' => $skipConflict ? 'conflict_skipped' : 'conflict',
                'entity_id' => $existingEntityId > 0 ? $existingEntityId : null,
            ];
        }
        Database::execute(
            'UPDATE accumul8_entity_aliases
             SET alias_name = ?
             WHERE id = ? AND owner_user_id = ?',
            [$displayAlias, $existingId, $viewerId]
        );
        return ['id' => $existingId, 'status' => 'updated', 'entity_id' => $entityId];
    }

    Database::execute(
        'INSERT INTO accumul8_entity_aliases (owner_user_id, entity_id, alias_name, alias_key)
         VALUES (?, ?, ?, ?)',
        [$viewerId, $entityId, $displayAlias, $aliasKey]
    );
    return ['id' => (int)Database::lastInsertId(), 'status' => 'created', 'entity_id' => $entityId];
}

function accumul8_upsert_entity_alias(int $viewerId, int $entityId, string $aliasName): ?int
{
    $result = accumul8_assign_entity_alias($viewerId, $entityId, $aliasName, false);
    if (($result['status'] ?? '') === 'conflict') {
        catn8_json_response(['success' => false, 'error' => 'Alias already belongs to another entity'], 409);
    }
    $aliasId = isset($result['id']) ? (int)$result['id'] : 0;
    return $aliasId > 0 ? $aliasId : null;
}

function accumul8_list_entity_endex_group_definitions(int $viewerId, bool $activeOnly = false): array
{
    if ($viewerId <= 0 || !accumul8_table_exists('accumul8_entity_endex_groups')) {
        return [];
    }

    $rows = Database::queryAll(
        'SELECT g.id,
                g.parent_entity_id,
                g.parent_name,
                g.match_rule,
                g.examples_json,
                g.match_fragments_json,
                g.match_contains_json,
                g.is_active
         FROM accumul8_entity_endex_groups g
         WHERE g.owner_user_id = ?
           AND (? = 0 OR g.is_active = 1)
         ORDER BY g.parent_name ASC, g.id ASC',
        [$viewerId, $activeOnly ? 1 : 0]
    );

    $definitions = [];
    foreach ($rows as $row) {
        $parentName = accumul8_normalize_text((string)($row['parent_name'] ?? ''), 191);
        if ($parentName === '') {
            continue;
        }
        $examples = json_decode((string)($row['examples_json'] ?? '[]'), true);
        $matchFragments = json_decode((string)($row['match_fragments_json'] ?? '[]'), true);
        $matchContains = json_decode((string)($row['match_contains_json'] ?? '[]'), true);
        $definitions[] = [
            'id' => (int)($row['id'] ?? 0),
            'parent_entity_id' => isset($row['parent_entity_id']) && (int)$row['parent_entity_id'] > 0 ? (int)$row['parent_entity_id'] : null,
            'parent_name' => $parentName,
            'match_rule' => accumul8_normalize_text((string)($row['match_rule'] ?? ''), 255),
            'examples' => array_values(array_filter(array_map(static fn($value): string => accumul8_normalize_text((string)$value, 191), is_array($examples) ? $examples : []), 'strlen')),
            'match_fragments' => array_values(array_filter(array_map(static fn($value): string => strtolower(accumul8_entity_match_key((string)$value)), is_array($matchFragments) ? $matchFragments : []), 'strlen')),
            'match_contains' => array_values(array_filter(array_map(static fn($value): string => strtolower(accumul8_normalize_text((string)$value, 191)), is_array($matchContains) ? $matchContains : []), 'strlen')),
            'is_active' => (int)($row['is_active'] ?? 1),
        ];
    }

    return $definitions;
}

function accumul8_ensure_default_entity_endex_groups(int $viewerId): void
{
    if ($viewerId <= 0 || !accumul8_table_exists('accumul8_entity_endex_groups')) {
        return;
    }

    $existingRows = Database::queryAll(
        'SELECT parent_key
         FROM accumul8_entity_endex_groups
         WHERE owner_user_id = ?',
        [$viewerId]
    );
    $existingKeys = [];
    foreach ($existingRows as $row) {
        $parentKey = trim((string)($row['parent_key'] ?? ''));
        if ($parentKey !== '') {
            $existingKeys[$parentKey] = true;
        }
    }

    foreach (accumul8_base_entity_family_definitions() as $definition) {
        $parentName = accumul8_normalize_text((string)($definition['parent_name'] ?? ''), 191);
        $parentKey = accumul8_entity_match_key($parentName);
        if ($parentKey === '' || isset($existingKeys[$parentKey])) {
            continue;
        }
        $linkedEntity = Database::queryOne(
            'SELECT id
             FROM accumul8_entities
             WHERE owner_user_id = ? AND display_name = ?
             LIMIT 1',
            [$viewerId, $parentName]
        );
        Database::execute(
            'INSERT INTO accumul8_entity_endex_groups (
                owner_user_id,
                parent_entity_id,
                parent_name,
                parent_key,
                match_rule,
                examples_json,
                match_fragments_json,
                match_contains_json,
                is_active
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
            [
                $viewerId,
                $linkedEntity ? (int)($linkedEntity['id'] ?? 0) : null,
                $parentName,
                $parentKey,
                accumul8_normalize_text((string)($definition['match_rule'] ?? ''), 255),
                json_encode(array_values(array_map('strval', is_array($definition['examples'] ?? null) ? $definition['examples'] : [])), JSON_UNESCAPED_SLASHES),
                json_encode(array_values(array_map('strval', is_array($definition['match_fragments'] ?? null) ? $definition['match_fragments'] : [])), JSON_UNESCAPED_SLASHES),
                json_encode(array_values(array_map('strval', is_array($definition['match_contains'] ?? null) ? $definition['match_contains'] : [])), JSON_UNESCAPED_SLASHES),
            ]
        );
        $existingKeys[$parentKey] = true;
    }
}

function accumul8_list_entity_endex_guides_for_viewer(int $viewerId): array
{
    accumul8_ensure_default_entity_endex_groups($viewerId);
    return array_values(array_map(static function (array $definition): array {
        return [
            'id' => (int)($definition['id'] ?? 0),
            'parent_entity_id' => isset($definition['parent_entity_id']) ? (int)$definition['parent_entity_id'] : null,
            'parent_name' => (string)($definition['parent_name'] ?? ''),
            'match_rule' => (string)($definition['match_rule'] ?? ''),
            'examples' => array_values(array_map('strval', is_array($definition['examples'] ?? null) ? $definition['examples'] : [])),
            'match_fragments' => array_values(array_map('strval', is_array($definition['match_fragments'] ?? null) ? $definition['match_fragments'] : [])),
            'match_contains' => array_values(array_map('strval', is_array($definition['match_contains'] ?? null) ? $definition['match_contains'] : [])),
            'is_active' => (int)($definition['is_active'] ?? 1),
        ];
    }, accumul8_list_entity_endex_group_definitions($viewerId, false)));
}

function accumul8_entity_family_definition_for_parent(string $parentName): ?array
{
    $parentKey = accumul8_entity_match_key($parentName);
    if ($parentKey === '') {
        return null;
    }

    foreach (accumul8_entity_family_definitions() as $definition) {
        if (accumul8_entity_match_key((string)($definition['parent_name'] ?? '')) === $parentKey) {
            return $definition;
        }
    }

    return null;
}

function accumul8_entity_alias_scan_tokens(string $value): array
{
    $normalized = strtolower(accumul8_entity_alias_display_name($value));
    if ($normalized === '') {
        return [];
    }

    $parts = preg_split('/[^a-z0-9]+/i', $normalized) ?: [];
    $stopWords = [
        'the', 'and', 'for', 'from', 'with', 'into', 'onto', 'llc', 'inc', 'co', 'corp', 'ltd',
        'debit', 'credit', 'payment', 'online', 'store', 'shop', 'purchase', 'bill', 'card',
        'web', 'transfer', 'withdrawal', 'deposit', 'signature', 'adjustment', 'service', 'services',
    ];
    $tokens = [];
    foreach ($parts as $part) {
        $token = trim((string)$part);
        if ($token === '' || strlen($token) < 3 || in_array($token, $stopWords, true)) {
            continue;
        }
        $tokens[$token] = true;
    }

    return array_keys($tokens);
}

function accumul8_entity_alias_review_provider_has_credentials(string $provider): bool
{
    $provider = strtolower(trim($provider));
    if ($provider === 'google_vertex_ai') {
        $saJson = secret_get(catn8_settings_ai_secret_key($provider, 'service_account_json'));
        return is_string($saJson) && trim($saJson) !== '';
    }

    return accumul8_statement_provider_has_api_key($provider);
}

function accumul8_entity_alias_review_effective_ai_config(): array
{
    $cfg = catn8_settings_ai_get_config();
    $preferredProvider = strtolower(trim((string)($cfg['provider'] ?? '')));
    $provider = '';
    foreach ([$preferredProvider, 'openai', 'google_ai_studio', 'google_vertex_ai'] as $candidateProvider) {
        $candidateProvider = strtolower(trim((string)$candidateProvider));
        if ($candidateProvider === '' || !in_array($candidateProvider, ['openai', 'google_ai_studio', 'google_vertex_ai'], true)) {
            continue;
        }
        if (accumul8_entity_alias_review_provider_has_credentials($candidateProvider)) {
            $provider = $candidateProvider;
            break;
        }
    }

    if ($provider === '') {
        throw new RuntimeException('Entity Endex AI review requires a configured OpenAI, Google AI Studio, or Vertex AI key.');
    }

    $configuredModel = trim((string)($cfg['model'] ?? ''));
    $model = $configuredModel;
    if ($model === '') {
        $model = $provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-pro';
    }

    return [
        'provider' => $provider,
        'model' => $model,
        'base_url' => trim((string)($cfg['base_url'] ?? '')),
        'location' => trim((string)($cfg['location'] ?? 'us-central1')),
    ];
}

function accumul8_entity_alias_review_map(int $viewerId, int $entityId): array
{
    if (!accumul8_table_exists('accumul8_entity_alias_reviews')) {
        return [];
    }

    $rows = Database::queryAll(
        'SELECT candidate_key,
                candidate_name,
                review_status,
                review_source,
                is_protected,
                scanner_version
         FROM accumul8_entity_alias_reviews
         WHERE owner_user_id = ? AND entity_id = ?',
        [$viewerId, $entityId]
    );

    $map = [];
    foreach ($rows as $row) {
        $candidateKey = trim((string)($row['candidate_key'] ?? ''));
        if ($candidateKey === '') {
            continue;
        }
        $map[$candidateKey] = [
            'candidate_name' => (string)($row['candidate_name'] ?? ''),
            'review_status' => strtolower(trim((string)($row['review_status'] ?? ''))),
            'review_source' => strtolower(trim((string)($row['review_source'] ?? ''))),
            'is_protected' => (int)($row['is_protected'] ?? 0),
            'scanner_version' => (int)($row['scanner_version'] ?? 0),
        ];
    }

    return $map;
}

function accumul8_upsert_entity_alias_review(
    int $viewerId,
    int $entityId,
    string $candidateName,
    string $reviewStatus,
    string $reviewSource,
    bool $isProtected,
    int $scannerVersion,
    string $provider = '',
    string $model = '',
    string $reason = ''
): void {
    if (!accumul8_table_exists('accumul8_entity_alias_reviews')) {
        return;
    }

    $candidateDisplay = accumul8_entity_alias_display_name($candidateName);
    $candidateKey = accumul8_entity_match_key($candidateDisplay);
    $reviewStatus = strtolower(trim($reviewStatus));
    $reviewSource = strtolower(trim($reviewSource));
    $provider = strtolower(trim($provider));
    $model = accumul8_normalize_text($model, 191);
    $reason = accumul8_normalize_text($reason, 1000);
    if ($entityId <= 0 || $candidateDisplay === '' || $candidateKey === '' || $reviewStatus === '') {
        return;
    }

    Database::execute(
        'INSERT INTO accumul8_entity_alias_reviews (
            owner_user_id,
            entity_id,
            candidate_name,
            candidate_key,
            review_status,
            review_source,
            is_protected,
            scanner_version,
            ai_provider,
            ai_model,
            review_reason
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            candidate_name = VALUES(candidate_name),
            review_status = VALUES(review_status),
            review_source = VALUES(review_source),
            is_protected = VALUES(is_protected),
            scanner_version = VALUES(scanner_version),
            ai_provider = VALUES(ai_provider),
            ai_model = VALUES(ai_model),
            review_reason = VALUES(review_reason)',
        [
            $viewerId,
            $entityId,
            $candidateDisplay,
            $candidateKey,
            $reviewStatus,
            $reviewSource,
            $isProtected ? 1 : 0,
            $scannerVersion,
            $provider,
            $model,
            $reason,
        ]
    );
}

function accumul8_delete_entity_alias_review(int $viewerId, int $entityId, string $candidateName): void
{
    if (!accumul8_table_exists('accumul8_entity_alias_reviews')) {
        return;
    }

    $candidateKey = accumul8_entity_match_key(accumul8_entity_alias_display_name($candidateName));
    if ($entityId <= 0 || $candidateKey === '') {
        return;
    }

    Database::execute(
        'DELETE FROM accumul8_entity_alias_reviews
         WHERE owner_user_id = ? AND entity_id = ? AND candidate_key = ?',
        [$viewerId, $entityId, $candidateKey]
    );
}

function accumul8_entity_alias_review_request_schema(): array
{
    return [
        'format' => [
            'type' => 'json_schema',
            'name' => 'accumul8_entity_alias_review',
            'strict' => true,
            'schema' => [
                'type' => 'object',
                'additionalProperties' => false,
                'required' => ['reviews'],
                'properties' => [
                    'reviews' => [
                        'type' => 'array',
                        'items' => [
                            'type' => 'object',
                            'additionalProperties' => false,
                            'required' => ['candidate_key', 'decision', 'reason'],
                            'properties' => [
                                'candidate_key' => ['type' => 'string'],
                                'decision' => ['type' => 'string', 'enum' => ['approve', 'reject']],
                                'reason' => ['type' => 'string'],
                            ],
                        ],
                    ],
                ],
            ],
        ],
    ];
}

function accumul8_entity_alias_ai_review_candidates(
    string $parentName,
    array $existingAliases,
    ?array $familyDefinition,
    array $candidates
): array {
    if ($candidates === []) {
        return [];
    }

    $aiConfig = accumul8_entity_alias_review_effective_ai_config();
    $provider = (string)($aiConfig['provider'] ?? '');
    $model = (string)($aiConfig['model'] ?? '');
    $baseUrl = (string)($aiConfig['base_url'] ?? '');
    $location = (string)($aiConfig['location'] ?? 'us-central1');

    $payload = [
        'parent_name' => $parentName,
        'existing_aliases' => array_values(array_map('strval', $existingAliases)),
        'family_examples' => array_values(array_map('strval', is_array($familyDefinition['examples'] ?? null) ? $familyDefinition['examples'] : [])),
        'family_match_contains' => array_values(array_map('strval', is_array($familyDefinition['match_contains'] ?? null) ? $familyDefinition['match_contains'] : [])),
        'candidates' => array_values(array_map(static function (array $candidate): array {
            return [
                'candidate_key' => (string)($candidate['candidate_key'] ?? ''),
                'candidate_name' => (string)($candidate['candidate_name'] ?? ''),
                'source_types' => array_values(array_map('strval', is_array($candidate['source_types'] ?? null) ? $candidate['source_types'] : [])),
            ];
        }, $candidates)),
    ];

    $systemPrompt = <<<TXT
You review possible alias names for a parent entity in a finance app.
Approve only when the candidate is clearly the same real-world entity as the parent.
Be conservative.
Reject broad or ambiguous overlaps, shared generic words, nearby categories, or names that merely contain one shared word.
Examples that should usually be rejected unless there is stronger evidence: names sharing only words like apple, express, store, market, club, gas, bank, food, or wireless.
Return JSON only.
TXT;

    $userPrompt = <<<TXT
Review these candidate aliases for the parent entity and decide whether each one should be approved or rejected.

Rules:
- Approve only clear spelling variants, abbreviations, OCR variants, punctuation variants, or known branded short forms for the exact same entity.
- Reject if the candidate could reasonably refer to a different business, brand, location, or category.
- Reject if the match depends only on one generic token.
- The response must include every candidate_key exactly once.

Input JSON:
TXT;
    $userPrompt .= "\n" . json_encode($payload, JSON_UNESCAPED_SLASHES);

    if ($provider === 'openai') {
        $result = accumul8_openai_responses_json(
            $model,
            [[
                'role' => 'system',
                'content' => [
                    ['type' => 'input_text', 'text' => $systemPrompt],
                ],
            ], [
                'role' => 'user',
                'content' => [
                    ['type' => 'input_text', 'text' => $userPrompt],
                ],
            ]],
            $baseUrl,
            0.0,
            2500,
            accumul8_entity_alias_review_request_schema(),
            90
        );
        $decoded = is_array($result['json'] ?? null) ? $result['json'] : [];
    } elseif ($provider === 'google_vertex_ai') {
        $saJson = secret_get(catn8_settings_ai_secret_key($provider, 'service_account_json'));
        if (!is_string($saJson) || trim($saJson) === '') {
            throw new RuntimeException('Missing AI service account JSON (google_vertex_ai)');
        }
        $sa = json_decode((string)$saJson, true);
        if (!is_array($sa)) {
            throw new RuntimeException('AI Vertex service account JSON is invalid');
        }
        $content = catn8_vertex_ai_gemini_generate_text([
            'service_account_json' => $saJson,
            'project_id' => trim((string)($sa['project_id'] ?? '')),
            'location' => $location !== '' ? $location : 'us-central1',
            'model' => $model !== '' ? $model : 'gemini-1.5-pro',
            'system_prompt' => $systemPrompt,
            'user_prompt' => $userPrompt,
            'temperature' => 0.0,
            'max_output_tokens' => 2500,
        ]);
        $decoded = json_decode(accumul8_extract_json_from_text($content), true);
    } else {
        $apiKey = secret_get(catn8_settings_ai_secret_key('google_ai_studio', 'api_key'));
        if (!is_string($apiKey) || trim($apiKey) === '') {
            throw new RuntimeException('Missing AI API key (google_ai_studio)');
        }
        $resp = catn8_http_json_with_status(
            'POST',
            'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model !== '' ? $model : 'gemini-1.5-pro') . ':generateContent',
            ['x-goog-api-key' => trim($apiKey)],
            [
                'contents' => [['role' => 'user', 'parts' => [['text' => $userPrompt]]]],
                'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
                'generationConfig' => [
                    'temperature' => 0.0,
                    'responseMimeType' => 'application/json',
                ],
            ],
            10,
            90
        );
        $content = (string)($resp['json']['candidates'][0]['content']['parts'][0]['text'] ?? '');
        $decoded = json_decode(accumul8_extract_json_from_text($content), true);
    }

    if (!is_array($decoded)) {
        throw new RuntimeException('Entity Endex AI review returned invalid JSON.');
    }

    $reviews = is_array($decoded['reviews'] ?? null) ? $decoded['reviews'] : [];
    $decisions = [];
    foreach ($reviews as $review) {
        if (!is_array($review)) {
            continue;
        }
        $candidateKey = trim((string)($review['candidate_key'] ?? ''));
        $decision = strtolower(trim((string)($review['decision'] ?? '')));
        if ($candidateKey === '' || !in_array($decision, ['approve', 'reject'], true)) {
            continue;
        }
        $decisions[$candidateKey] = [
            'decision' => $decision,
            'reason' => accumul8_normalize_text((string)($review['reason'] ?? ''), 1000),
            'provider' => $provider,
            'model' => $model,
        ];
    }

    $missingKeys = [];
    foreach ($candidates as $candidate) {
        $candidateKey = (string)($candidate['candidate_key'] ?? '');
        if ($candidateKey !== '' && !isset($decisions[$candidateKey])) {
            $missingKeys[] = $candidateKey;
        }
    }
    if ($missingKeys !== []) {
        throw new RuntimeException('Entity Endex AI review skipped candidate keys: ' . implode(', ', array_slice($missingKeys, 0, 8)));
    }

    return $decisions;
}

function accumul8_entity_alias_candidate_matches_parent(string $candidate, string $parentName, array $seedKeys, array $seedTokens, ?array $familyDefinition): bool
{
    $candidateDisplay = accumul8_entity_alias_display_name($candidate);
    $candidateKey = accumul8_entity_match_key($candidateDisplay);
    $parentKey = accumul8_entity_match_key($parentName);
    if ($candidateDisplay === '' || $candidateKey === '' || $parentKey === '') {
        return false;
    }

    if ($candidateKey === $parentKey) {
        return false;
    }

    $candidateAliasParentKey = accumul8_entity_match_key(accumul8_entity_alias_name($candidate));
    if ($candidateAliasParentKey !== '' && $candidateAliasParentKey === $parentKey) {
        return true;
    }

    if ($familyDefinition !== null) {
        $matchedFamily = accumul8_find_entity_family_definition($candidate);
        if (is_array($matchedFamily) && accumul8_entity_match_key((string)($matchedFamily['parent_name'] ?? '')) === $parentKey) {
            return true;
        }
    }

    foreach ($seedKeys as $seedKey) {
        $seedKey = (string)$seedKey;
        if ($seedKey === '' || strlen($seedKey) < 6) {
            continue;
        }
        if (strpos($candidateKey, $seedKey) !== false) {
            return true;
        }
    }

    $candidateTokens = accumul8_entity_alias_scan_tokens($candidateDisplay);
    if ($candidateTokens === [] || $seedTokens === []) {
        return false;
    }

    $overlapCount = 0;
    foreach ($candidateTokens as $token) {
        if (isset($seedTokens[$token])) {
            $overlapCount++;
        }
    }

    if ($overlapCount >= 2) {
        return true;
    }

    $candidateText = strtolower($candidateDisplay);
    $parentText = strtolower(accumul8_entity_alias_display_name($parentName));
    return $overlapCount >= 1
        && $parentText !== ''
        && (strpos($candidateText, $parentText) !== false || strpos($parentText, $candidateText) !== false);
}

function accumul8_scan_entity_aliases_from_candidates(int $viewerId, int $entityId, array $entityDisplayNames, array $transactionDescriptions): array
{
    if ($entityId <= 0 || !accumul8_table_exists('accumul8_entity_aliases')) {
        catn8_json_response(['success' => false, 'error' => 'Invalid entity_id'], 400);
    }

    $entity = Database::queryOne(
        'SELECT id, display_name
         FROM accumul8_entities
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$entityId, $viewerId]
    );
    if (!$entity) {
        catn8_json_response(['success' => false, 'error' => 'Entity not found'], 404);
    }

    $parentName = (string)($entity['display_name'] ?? '');
    $parentKey = accumul8_entity_match_key($parentName);
    if ($parentKey === '') {
        catn8_json_response(['success' => false, 'error' => 'Parent entity name is required'], 400);
    }

    $aliasRows = Database::queryAll(
        'SELECT id, alias_name
         FROM accumul8_entity_aliases
         WHERE owner_user_id = ? AND entity_id = ?
         ORDER BY id ASC',
        [$viewerId, $entityId]
    );

    $seedKeys = [$parentKey => true];
    $seedTokens = [];
    $seedTexts = [$parentName];
    $existingAliasNames = [];
    foreach ($aliasRows as $aliasRow) {
        $aliasName = (string)($aliasRow['alias_name'] ?? '');
        if ($aliasName !== '') {
            $seedTexts[] = $aliasName;
            $seedKeys[accumul8_entity_match_key($aliasName)] = true;
            $existingAliasNames[] = $aliasName;
        }
    }

    $familyDefinition = accumul8_entity_family_definition_for_parent($parentName);
    if (is_array($familyDefinition)) {
        foreach ((array)($familyDefinition['examples'] ?? []) as $example) {
            $seedTexts[] = (string)$example;
        }
        foreach ((array)($familyDefinition['match_contains'] ?? []) as $fragment) {
            $seedTexts[] = (string)$fragment;
        }
    }

    foreach ($seedTexts as $seedText) {
        foreach (accumul8_entity_alias_scan_tokens((string)$seedText) as $token) {
            $seedTokens[$token] = true;
        }
    }
    unset($seedKeys['']);

    $candidatesByKey = [];
    foreach ($entityDisplayNames as $displayName) {
        $candidate = accumul8_entity_alias_display_name((string)$displayName);
        $candidateKey = accumul8_entity_match_key($candidate);
        if ($candidateKey === '' || isset($seedKeys[$candidateKey])) {
            continue;
        }
        if (accumul8_entity_alias_candidate_matches_parent($candidate, $parentName, array_keys($seedKeys), $seedTokens, $familyDefinition)) {
            if (!isset($candidatesByKey[$candidateKey])) {
                $candidatesByKey[$candidateKey] = [
                    'candidate_name' => $candidate,
                    'candidate_key' => $candidateKey,
                    'source_types' => [],
                ];
            }
            $candidatesByKey[$candidateKey]['source_types']['entity'] = true;
        }
    }

    foreach ($transactionDescriptions as $description) {
        $candidate = accumul8_entity_alias_display_name((string)$description);
        $candidateKey = accumul8_entity_match_key($candidate);
        if ($candidateKey === '' || isset($seedKeys[$candidateKey])) {
            continue;
        }
        if (accumul8_entity_alias_candidate_matches_parent($candidate, $parentName, array_keys($seedKeys), $seedTokens, $familyDefinition)) {
            if (!isset($candidatesByKey[$candidateKey])) {
                $candidatesByKey[$candidateKey] = [
                    'candidate_name' => $candidate,
                    'candidate_key' => $candidateKey,
                    'source_types' => [],
                ];
            }
            $candidatesByKey[$candidateKey]['source_types']['transaction'] = true;
        }
    }

    ksort($candidatesByKey);

    $createdCount = 0;
    $updatedCount = 0;
    $skippedCount = 0;
    $conflictCount = 0;
    $reviewedCount = 0;
    $approvedCount = 0;
    $rejectedCount = 0;
    $protectedSkipCount = 0;
    $aliasNames = [];
    $items = [];
    $reviewMap = accumul8_entity_alias_review_map($viewerId, $entityId);
    $scannerVersion = ACCUMUL8_ENTITY_ALIAS_REVIEW_VERSION;
    $candidatesNeedingReview = [];
    foreach ($candidatesByKey as $candidateKey => $candidate) {
        $review = $reviewMap[$candidateKey] ?? null;
        $reviewStatus = strtolower(trim((string)($review['review_status'] ?? '')));
        $reviewVersion = (int)($review['scanner_version'] ?? 0);
        if ($reviewVersion === $scannerVersion && in_array($reviewStatus, ['approved', 'rejected'], true)) {
            $skippedCount++;
            if ((int)($review['is_protected'] ?? 0) === 1) {
                $protectedSkipCount++;
            }
            continue;
        }
        $candidate['source_types'] = array_keys(is_array($candidate['source_types'] ?? null) ? $candidate['source_types'] : []);
        $candidatesNeedingReview[$candidateKey] = $candidate;
    }

    if ($candidatesNeedingReview !== []) {
        foreach (array_chunk(array_values($candidatesNeedingReview), ACCUMUL8_ENTITY_ALIAS_AI_BATCH_SIZE) as $candidateBatch) {
            $batchDecisions = accumul8_entity_alias_ai_review_candidates(
                $parentName,
                $existingAliasNames,
                $familyDefinition,
                $candidateBatch
            );
            foreach ($candidateBatch as $candidate) {
                $candidateKey = (string)($candidate['candidate_key'] ?? '');
                if ($candidateKey === '') {
                    continue;
                }
                $decision = $batchDecisions[$candidateKey] ?? null;
                if (!is_array($decision)) {
                    continue;
                }
                $reviewedCount++;
                if (($decision['decision'] ?? '') === 'approve') {
                    $approvedCount++;
                } else {
                    $rejectedCount++;
                    accumul8_upsert_entity_alias_review(
                        $viewerId,
                        $entityId,
                        (string)($candidate['candidate_name'] ?? ''),
                        'rejected',
                        'ai',
                        true,
                        $scannerVersion,
                        (string)($decision['provider'] ?? ''),
                        (string)($decision['model'] ?? ''),
                        (string)($decision['reason'] ?? '')
                    );
                }
                $reviewMap[$candidateKey] = [
                    'review_status' => ($decision['decision'] ?? '') === 'approve' ? 'approved' : 'rejected',
                    'is_protected' => 1,
                    'scanner_version' => $scannerVersion,
                ];
            }
        }
    }

    foreach ($candidatesByKey as $candidateKey => $candidateMeta) {
        $review = $reviewMap[$candidateKey] ?? null;
        if (!is_array($review) || strtolower(trim((string)($review['review_status'] ?? ''))) !== 'approved' || (int)($review['scanner_version'] ?? 0) !== $scannerVersion) {
            continue;
        }

        $candidate = (string)($candidateMeta['candidate_name'] ?? '');
        $result = accumul8_assign_entity_alias($viewerId, $entityId, $candidate, false);
        $status = (string)($result['status'] ?? '');
        if ($status === 'created') {
            $createdCount++;
            $aliasNames[] = $candidate;
            accumul8_upsert_entity_alias_review($viewerId, $entityId, $candidate, 'approved', 'ai', true, $scannerVersion);
            $items[] = [
                'parent_entity_id' => $entityId,
                'parent_name' => $parentName,
                'alias_name' => $candidate,
                'status' => 'created',
            ];
            continue;
        }
        if ($status === 'updated') {
            $updatedCount++;
            $aliasNames[] = $candidate;
            accumul8_upsert_entity_alias_review($viewerId, $entityId, $candidate, 'approved', 'ai', true, $scannerVersion);
            $items[] = [
                'parent_entity_id' => $entityId,
                'parent_name' => $parentName,
                'alias_name' => $candidate,
                'status' => 'updated',
            ];
            continue;
        }
        if ($status === 'conflict') {
            $conflictCount++;
            continue;
        }
        $skippedCount++;
    }

    return [
        'entity_id' => $entityId,
        'created_count' => $createdCount,
        'updated_count' => $updatedCount,
        'skipped_count' => $skippedCount,
        'conflict_count' => $conflictCount,
        'reviewed_count' => $reviewedCount,
        'approved_count' => $approvedCount,
        'rejected_count' => $rejectedCount,
        'protected_skip_count' => $protectedSkipCount,
        'alias_names' => array_values($aliasNames),
        'items' => $items,
    ];
}

function accumul8_scan_entity_aliases(int $viewerId, int $entityId): array
{
    $entityDisplayNames = [];
    $entityRows = Database::queryAll(
        'SELECT display_name
         FROM accumul8_entities
         WHERE owner_user_id = ?
           AND id <> ?
         ORDER BY id ASC',
        [$viewerId, $entityId]
    );
    foreach ($entityRows as $row) {
        $displayName = (string)($row['display_name'] ?? '');
        if ($displayName !== '') {
            $entityDisplayNames[] = $displayName;
        }
    }

    $transactionDescriptions = [];
    if (accumul8_table_exists('accumul8_transactions')) {
        $transactionRows = Database::queryAll(
            'SELECT description
             FROM accumul8_transactions
             WHERE owner_user_id = ?
             GROUP BY description
             ORDER BY description ASC',
            [$viewerId]
        );
        foreach ($transactionRows as $row) {
            $description = (string)($row['description'] ?? '');
            if ($description !== '') {
                $transactionDescriptions[] = $description;
            }
        }
    }

    return accumul8_scan_entity_aliases_from_candidates($viewerId, $entityId, $entityDisplayNames, $transactionDescriptions);
}

function accumul8_scan_all_entity_aliases(int $viewerId): array
{
    $entityRows = Database::queryAll(
        'SELECT e.id,
                e.display_name,
                e.legacy_contact_id,
                e.legacy_debtor_id,
                COUNT(a.id) AS alias_count
         FROM accumul8_entities e
         LEFT JOIN accumul8_entity_aliases a
           ON a.entity_id = e.id
          AND a.owner_user_id = e.owner_user_id
         WHERE e.owner_user_id = ?
         GROUP BY e.id, e.display_name, e.legacy_contact_id, e.legacy_debtor_id
         ORDER BY e.display_name ASC, e.id ASC',
        [$viewerId]
    );

    $scannedEntityCount = 0;
    $touchedEntityCount = 0;
    $createdCount = 0;
    $updatedCount = 0;
    $skippedCount = 0;
    $conflictCount = 0;
    $reviewedCount = 0;
    $approvedCount = 0;
    $rejectedCount = 0;
    $protectedSkipCount = 0;
    $logItems = [];
    $entityDisplayNames = [];
    foreach ($entityRows as $row) {
        $entityId = (int)($row['id'] ?? 0);
        $displayName = (string)($row['display_name'] ?? '');
        if ($entityId > 0 && $displayName !== '') {
            $entityDisplayNames[$entityId] = $displayName;
        }
    }

    $transactionDescriptions = [];
    if (accumul8_table_exists('accumul8_transactions')) {
        $transactionRows = Database::queryAll(
            'SELECT description
             FROM accumul8_transactions
             WHERE owner_user_id = ?
             GROUP BY description
             ORDER BY description ASC',
            [$viewerId]
        );
        foreach ($transactionRows as $row) {
            $description = (string)($row['description'] ?? '');
            if ($description !== '') {
                $transactionDescriptions[] = $description;
            }
        }
    }

    foreach ($entityRows as $row) {
        $entityId = (int)($row['id'] ?? 0);
        if ($entityId <= 0) {
            continue;
        }

        $displayName = (string)($row['display_name'] ?? '');
        $hasGuide = accumul8_entity_family_definition_for_parent($displayName) !== null;
        $isImportedParent = (int)($row['legacy_contact_id'] ?? 0) > 0 || (int)($row['legacy_debtor_id'] ?? 0) > 0;
        $hasAliases = (int)($row['alias_count'] ?? 0) > 0;
        if (!$hasGuide && !$isImportedParent && !$hasAliases) {
            continue;
        }

        $scannedEntityCount++;
        $otherEntityDisplayNames = $entityDisplayNames;
        unset($otherEntityDisplayNames[$entityId]);
        $result = accumul8_scan_entity_aliases_from_candidates(
            $viewerId,
            $entityId,
            array_values($otherEntityDisplayNames),
            $transactionDescriptions,
        );
        $created = (int)($result['created_count'] ?? 0);
        $updated = (int)($result['updated_count'] ?? 0);
        $skipped = (int)($result['skipped_count'] ?? 0);
        $conflicts = (int)($result['conflict_count'] ?? 0);

        if (($created + $updated) > 0) {
            $touchedEntityCount++;
        }

        foreach ((array)($result['items'] ?? []) as $item) {
            if (is_array($item)) {
                $logItems[] = $item;
            }
        }

        $createdCount += $created;
        $updatedCount += $updated;
        $skippedCount += $skipped;
        $conflictCount += $conflicts;
        $reviewedCount += (int)($result['reviewed_count'] ?? 0);
        $approvedCount += (int)($result['approved_count'] ?? 0);
        $rejectedCount += (int)($result['rejected_count'] ?? 0);
        $protectedSkipCount += (int)($result['protected_skip_count'] ?? 0);
    }

    $summaryText = ($createdCount + $updatedCount) > 0
        ? 'Updated ' . $touchedEntityCount . ' parent' . ($touchedEntityCount === 1 ? '' : 's')
            . ' and added ' . ($createdCount + $updatedCount) . ' related name' . (($createdCount + $updatedCount) === 1 ? '' : 's') . '.'
        : 'No new related names were found across the Entity Endex.';

    accumul8_record_entity_endex_scan_log($viewerId, [
        'scanned_entity_count' => $scannedEntityCount,
        'touched_entity_count' => $touchedEntityCount,
        'created_count' => $createdCount,
        'updated_count' => $updatedCount,
        'skipped_count' => $skippedCount,
        'conflict_count' => $conflictCount,
        'reviewed_count' => $reviewedCount,
        'approved_count' => $approvedCount,
        'rejected_count' => $rejectedCount,
        'protected_skip_count' => $protectedSkipCount,
        'summary_text' => $summaryText,
        'items' => $logItems,
    ]);

    return [
        'scanned_entity_count' => $scannedEntityCount,
        'touched_entity_count' => $touchedEntityCount,
        'created_count' => $createdCount,
        'updated_count' => $updatedCount,
        'skipped_count' => $skippedCount,
        'conflict_count' => $conflictCount,
        'reviewed_count' => $reviewedCount,
        'approved_count' => $approvedCount,
        'rejected_count' => $rejectedCount,
        'protected_skip_count' => $protectedSkipCount,
        'summary_text' => $summaryText,
    ];
}

function accumul8_record_entity_endex_scan_log(int $viewerId, array $payload): void
{
    if (!accumul8_table_exists('accumul8_entity_endex_scan_logs')) {
        return;
    }

    $items = is_array($payload['items'] ?? null) ? $payload['items'] : [];
    $itemsJson = json_encode(array_values($items), JSON_UNESCAPED_SLASHES);
    if (!is_string($itemsJson)) {
        $itemsJson = '[]';
    }

    Database::execute(
        'INSERT INTO accumul8_entity_endex_scan_logs
         (owner_user_id, scanned_entity_count, touched_entity_count, created_count, updated_count, skipped_count, conflict_count, summary_text, items_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $viewerId,
            (int)($payload['scanned_entity_count'] ?? 0),
            (int)($payload['touched_entity_count'] ?? 0),
            (int)($payload['created_count'] ?? 0),
            (int)($payload['updated_count'] ?? 0),
            (int)($payload['skipped_count'] ?? 0),
            (int)($payload['conflict_count'] ?? 0),
            accumul8_normalize_text((string)($payload['summary_text'] ?? ''), 255),
            $itemsJson,
        ]
    );
}

function accumul8_entity_endex_guide_string_list($value, int $maxLen = 191, bool $normalizeKey = false): array
{
    $items = is_array($value) ? $value : [];
    $seen = [];
    $result = [];
    foreach ($items as $item) {
        $normalized = $normalizeKey
            ? strtolower(accumul8_entity_match_key((string)$item))
            : strtolower(accumul8_normalize_text((string)$item, $maxLen));
        $display = $normalizeKey ? $normalized : accumul8_normalize_text((string)$item, $maxLen);
        if ($display === '' || isset($seen[$normalized])) {
            continue;
        }
        $seen[$normalized] = true;
        $result[] = $display;
    }
    return $result;
}

function accumul8_validate_entity_endex_guide_payload(int $viewerId, array $body): array
{
    $parentName = accumul8_normalize_text((string)($body['parent_name'] ?? ''), 191);
    $parentEntityId = isset($body['parent_entity_id']) && $body['parent_entity_id'] !== null ? (int)$body['parent_entity_id'] : 0;
    if ($parentEntityId > 0) {
        $entity = Database::queryOne(
            'SELECT id, display_name
             FROM accumul8_entities
             WHERE id = ? AND owner_user_id = ?
             LIMIT 1',
            [$parentEntityId, $viewerId]
        );
        if (!$entity) {
            catn8_json_response(['success' => false, 'error' => 'Parent entity not found'], 404);
        }
        if ($parentName === '') {
            $parentName = accumul8_normalize_text((string)($entity['display_name'] ?? ''), 191);
        }
    }
    if ($parentName === '') {
        catn8_json_response(['success' => false, 'error' => 'Parent name is required'], 400);
    }

    $parentKey = accumul8_entity_match_key($parentName);
    if ($parentKey === '') {
        catn8_json_response(['success' => false, 'error' => 'Parent name is invalid'], 400);
    }

    return [
        'parent_entity_id' => $parentEntityId > 0 ? $parentEntityId : null,
        'parent_name' => $parentName,
        'parent_key' => $parentKey,
        'match_rule' => accumul8_normalize_text((string)($body['match_rule'] ?? ''), 255),
        'examples' => accumul8_entity_endex_guide_string_list($body['examples'] ?? [], 191, false),
        'match_fragments' => accumul8_entity_endex_guide_string_list($body['match_fragments'] ?? [], 191, true),
        'match_contains' => accumul8_entity_endex_guide_string_list($body['match_contains'] ?? [], 191, false),
        'is_active' => accumul8_normalize_bool($body['is_active'] ?? 1),
    ];
}

function accumul8_create_entity_endex_guide(int $viewerId, array $payload): int
{
    Database::execute(
        'INSERT INTO accumul8_entity_endex_groups (
            owner_user_id,
            parent_entity_id,
            parent_name,
            parent_key,
            match_rule,
            examples_json,
            match_fragments_json,
            match_contains_json,
            is_active
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $viewerId,
            $payload['parent_entity_id'],
            $payload['parent_name'],
            $payload['parent_key'],
            $payload['match_rule'],
            json_encode($payload['examples'], JSON_UNESCAPED_SLASHES),
            json_encode($payload['match_fragments'], JSON_UNESCAPED_SLASHES),
            json_encode($payload['match_contains'], JSON_UNESCAPED_SLASHES),
            $payload['is_active'],
        ]
    );
    return (int)Database::lastInsertId();
}

function accumul8_update_entity_endex_guide(int $viewerId, int $id, array $payload): void
{
    Database::execute(
        'UPDATE accumul8_entity_endex_groups
         SET parent_entity_id = ?,
             parent_name = ?,
             parent_key = ?,
             match_rule = ?,
             examples_json = ?,
             match_fragments_json = ?,
             match_contains_json = ?,
             is_active = ?
         WHERE id = ? AND owner_user_id = ?',
        [
            $payload['parent_entity_id'],
            $payload['parent_name'],
            $payload['parent_key'],
            $payload['match_rule'],
            json_encode($payload['examples'], JSON_UNESCAPED_SLASHES),
            json_encode($payload['match_fragments'], JSON_UNESCAPED_SLASHES),
            json_encode($payload['match_contains'], JSON_UNESCAPED_SLASHES),
            $payload['is_active'],
            $id,
            $viewerId,
        ]
    );
}

function accumul8_merge_entities(int $viewerId, int $targetEntityId, int $sourceEntityId): void
{
    if ($targetEntityId <= 0 || $sourceEntityId <= 0 || $targetEntityId === $sourceEntityId) {
        return;
    }

    $target = Database::queryOne(
        'SELECT id
         FROM accumul8_entities
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$targetEntityId, $viewerId]
    );
    $source = Database::queryOne(
        'SELECT id, display_name, legacy_contact_id, legacy_debtor_id
         FROM accumul8_entities
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$sourceEntityId, $viewerId]
    );
    if (!$target || !$source) {
        catn8_json_response(['success' => false, 'error' => 'Entity not found'], 404);
    }

    $sourceAliasRows = Database::queryAll(
        'SELECT alias_name
         FROM accumul8_entity_aliases
         WHERE owner_user_id = ? AND entity_id = ?
         ORDER BY id ASC',
        [$viewerId, $sourceEntityId]
    );

    Database::beginTransaction();
    try {
        accumul8_assign_entity_alias($viewerId, $targetEntityId, (string)($source['display_name'] ?? ''), true);
        foreach ($sourceAliasRows as $aliasRow) {
            accumul8_assign_entity_alias($viewerId, $targetEntityId, (string)($aliasRow['alias_name'] ?? ''), true);
        }

        if (accumul8_table_has_column('accumul8_contacts', 'entity_id')) {
            Database::execute(
                'UPDATE accumul8_contacts
                 SET entity_id = ?
                 WHERE owner_user_id = ? AND entity_id = ?',
                [$targetEntityId, $viewerId, $sourceEntityId]
            );
        }
        if (accumul8_table_has_column('accumul8_debtors', 'entity_id')) {
            Database::execute(
                'UPDATE accumul8_debtors
                 SET entity_id = ?
                 WHERE owner_user_id = ? AND entity_id = ?',
                [$targetEntityId, $viewerId, $sourceEntityId]
            );
        }
        if (accumul8_table_has_column('accumul8_recurring_payments', 'entity_id')) {
            Database::execute(
                'UPDATE accumul8_recurring_payments
                 SET entity_id = ?
                 WHERE owner_user_id = ? AND entity_id = ?',
                [$targetEntityId, $viewerId, $sourceEntityId]
            );
        }
        if (accumul8_table_has_column('accumul8_transactions', 'entity_id')) {
            Database::execute(
                'UPDATE accumul8_transactions
                 SET entity_id = ?
                 WHERE owner_user_id = ? AND entity_id = ?',
                [$targetEntityId, $viewerId, $sourceEntityId]
            );
        }
        if (accumul8_table_has_column('accumul8_transactions', 'balance_entity_id')) {
            Database::execute(
                'UPDATE accumul8_transactions
                 SET balance_entity_id = ?
                 WHERE owner_user_id = ? AND balance_entity_id = ?',
                [$targetEntityId, $viewerId, $sourceEntityId]
            );
        }

        Database::execute(
            'UPDATE accumul8_entities
             SET legacy_contact_id = COALESCE(legacy_contact_id, ?),
                 legacy_debtor_id = COALESCE(legacy_debtor_id, ?)
             WHERE id = ? AND owner_user_id = ?',
            [
                isset($source['legacy_contact_id']) ? (int)$source['legacy_contact_id'] : null,
                isset($source['legacy_debtor_id']) ? (int)$source['legacy_debtor_id'] : null,
                $targetEntityId,
                $viewerId,
            ]
        );

        Database::execute(
            'DELETE FROM accumul8_entity_aliases
             WHERE owner_user_id = ? AND entity_id = ?',
            [$viewerId, $sourceEntityId]
        );
        Database::execute(
            'DELETE FROM accumul8_entities
             WHERE id = ? AND owner_user_id = ?',
            [$sourceEntityId, $viewerId]
        );

        Database::commit();
    } catch (Throwable $error) {
        if (Database::inTransaction()) {
            Database::rollBack();
        }
        throw $error;
    }

    accumul8_sync_contact_from_entity($viewerId, $targetEntityId);
    accumul8_sync_debtor_from_entity($viewerId, $targetEntityId);
}

function accumul8_upsert_entity(int $viewerId, array $payload, ?int $existingEntityId = null): int
{
    $displayName = accumul8_entity_alias_name((string)($payload['display_name'] ?? ''));
    if ($displayName === '') {
        $displayName = 'Unnamed Entity';
    }
    $entityKind = accumul8_normalize_entity_kind_value($payload['entity_kind'] ?? 'business');
    $contactType = accumul8_normalize_contact_type_value($payload['contact_type'] ?? ($payload['is_balance_person'] ?? 0 ? 'repayment' : 'payee'));
    $defaultAmount = accumul8_normalize_amount($payload['default_amount'] ?? 0);
    $email = accumul8_normalize_text($payload['email'] ?? '', 191);
    $phoneNumber = accumul8_normalize_text($payload['phone_number'] ?? '', 32);
    $streetAddress = accumul8_normalize_text($payload['street_address'] ?? '', 191);
    $city = accumul8_normalize_text($payload['city'] ?? '', 120);
    $state = accumul8_normalize_text($payload['state'] ?? '', 64);
    $zip = accumul8_normalize_text($payload['zip'] ?? '', 20);
    $notes = accumul8_filter_note_for_display($payload['notes'] ?? '', 1500);
    $isActive = accumul8_normalize_bool($payload['is_active'] ?? 1);
    $flags = accumul8_contact_type_flags($contactType);
    $isPayee = accumul8_normalize_bool($payload['is_payee'] ?? $flags['is_payee']);
    $isPayer = accumul8_normalize_bool($payload['is_payer'] ?? $flags['is_payer']);
    $isVendor = accumul8_normalize_bool($payload['is_vendor'] ?? ($entityKind === 'business' ? 1 : 0));
    $entityKind = accumul8_entity_kind_from_vendor_state($entityKind, $isVendor);
    $isBalancePerson = accumul8_normalize_bool($payload['is_balance_person'] ?? ($contactType === 'repayment' ? 1 : 0));
    $legacyContactId = isset($payload['legacy_contact_id']) && (int)$payload['legacy_contact_id'] > 0 ? (int)$payload['legacy_contact_id'] : null;
    $legacyDebtorId = isset($payload['legacy_debtor_id']) && (int)$payload['legacy_debtor_id'] > 0 ? (int)$payload['legacy_debtor_id'] : null;
    if (($existingEntityId === null || $existingEntityId <= 0) && $legacyContactId === null && $legacyDebtorId === null) {
        $matchingEntityId = accumul8_find_matching_entity_id($viewerId, $displayName);
        if ($matchingEntityId !== null && $matchingEntityId > 0) {
            $existingEntityId = $matchingEntityId;
        }
    }

    if ($existingEntityId !== null && $existingEntityId > 0) {
        Database::execute(
            'UPDATE accumul8_entities
             SET display_name = ?, entity_kind = ?, contact_type = ?, is_payee = ?, is_payer = ?, is_vendor = ?, is_balance_person = ?,
                 default_amount = ?, email = ?, phone_number = ?, street_address = ?, city = ?, state = ?, zip = ?, notes = ?, is_active = ?,
                 legacy_contact_id = COALESCE(?, legacy_contact_id), legacy_debtor_id = COALESCE(?, legacy_debtor_id)
             WHERE id = ? AND owner_user_id = ?',
            [
                $displayName,
                $entityKind,
                $contactType,
                $isPayee,
                $isPayer,
                $isVendor,
                $isBalancePerson,
                $defaultAmount,
                $email === '' ? null : $email,
                $phoneNumber === '' ? null : $phoneNumber,
                $streetAddress === '' ? null : $streetAddress,
                $city === '' ? null : $city,
                $state === '' ? null : $state,
                $zip === '' ? null : $zip,
                $notes === '' ? null : $notes,
                $isActive,
                $legacyContactId,
                $legacyDebtorId,
                $existingEntityId,
                $viewerId,
            ]
        );
        return $existingEntityId;
    }

    Database::execute(
        'INSERT INTO accumul8_entities
            (owner_user_id, display_name, entity_kind, contact_type, is_payee, is_payer, is_vendor, is_balance_person,
             default_amount, email, phone_number, street_address, city, state, zip, notes, is_active, legacy_contact_id, legacy_debtor_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $viewerId,
            $displayName,
            $entityKind,
            $contactType,
            $isPayee,
            $isPayer,
            $isVendor,
            $isBalancePerson,
            $defaultAmount,
            $email === '' ? null : $email,
            $phoneNumber === '' ? null : $phoneNumber,
            $streetAddress === '' ? null : $streetAddress,
            $city === '' ? null : $city,
            $state === '' ? null : $state,
            $zip === '' ? null : $zip,
            $notes === '' ? null : $notes,
            $isActive,
            $legacyContactId,
            $legacyDebtorId,
        ]
    );

    return (int)Database::lastInsertId();
}

function accumul8_contact_entity_id_or_create(int $viewerId, int $contactId): ?int
{
    if ($contactId <= 0 || !accumul8_table_has_column('accumul8_contacts', 'entity_id')) {
        return null;
    }
    $row = Database::queryOne(
        'SELECT id, entity_id, contact_name, contact_type, default_amount, email, phone_number, street_address, city, state, zip, notes, is_active
         FROM accumul8_contacts
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$contactId, $viewerId]
    );
    if (!$row) {
        return null;
    }
    $existingEntityId = isset($row['entity_id']) ? (int)$row['entity_id'] : 0;
    $flags = accumul8_contact_type_flags((string)($row['contact_type'] ?? 'payee'));
    $entityId = accumul8_upsert_entity($viewerId, [
        'display_name' => (string)($row['contact_name'] ?? ''),
        'entity_kind' => 'business',
        'contact_type' => accumul8_normalize_contact_type_value((string)($row['contact_type'] ?? 'payee')),
        'is_payee' => $flags['is_payee'],
        'is_payer' => $flags['is_payer'],
        'is_vendor' => 0,
        'is_balance_person' => 0,
        'default_amount' => (float)($row['default_amount'] ?? 0),
        'email' => (string)($row['email'] ?? ''),
        'phone_number' => (string)($row['phone_number'] ?? ''),
        'street_address' => (string)($row['street_address'] ?? ''),
        'city' => (string)($row['city'] ?? ''),
        'state' => (string)($row['state'] ?? ''),
        'zip' => (string)($row['zip'] ?? ''),
        'notes' => (string)($row['notes'] ?? ''),
        'is_active' => (int)($row['is_active'] ?? 1),
        'legacy_contact_id' => (int)($row['id'] ?? 0),
    ], $existingEntityId > 0 ? $existingEntityId : null);
    Database::execute(
        'UPDATE accumul8_contacts SET entity_id = ? WHERE id = ? AND owner_user_id = ?',
        [$entityId, $contactId, $viewerId]
    );
    return $entityId;
}

function accumul8_debtor_entity_id_or_create(int $viewerId, int $debtorId): ?int
{
    if ($debtorId <= 0 || !accumul8_table_has_column('accumul8_debtors', 'entity_id')) {
        return null;
    }
    $row = Database::queryOne(
        'SELECT d.id, d.entity_id, d.contact_id, d.debtor_name, d.notes, d.is_active,
                c.entity_id AS contact_entity_id, c.contact_name, c.contact_type, c.default_amount, c.email, c.phone_number, c.street_address, c.city, c.state, c.zip
         FROM accumul8_debtors d
         LEFT JOIN accumul8_contacts c
           ON c.id = d.contact_id
          AND c.owner_user_id = d.owner_user_id
         WHERE d.id = ? AND d.owner_user_id = ?
         LIMIT 1',
        [$debtorId, $viewerId]
    );
    if (!$row) {
        return null;
    }
    $linkedContactEntityId = isset($row['contact_entity_id']) ? (int)$row['contact_entity_id'] : 0;
    if ($linkedContactEntityId <= 0 && isset($row['contact_id']) && (int)$row['contact_id'] > 0) {
        $linkedContactEntityId = (int)(accumul8_contact_entity_id_or_create($viewerId, (int)$row['contact_id']) ?? 0);
    }
    $existingEntityId = $linkedContactEntityId > 0
        ? $linkedContactEntityId
        : (isset($row['entity_id']) ? (int)$row['entity_id'] : 0);
    $contactType = $linkedContactEntityId > 0
        ? accumul8_normalize_contact_type_value((string)($row['contact_type'] ?? 'payee'))
        : 'repayment';
    $flags = accumul8_contact_type_flags($contactType);
    $entityId = accumul8_upsert_entity($viewerId, [
        'display_name' => $linkedContactEntityId > 0 ? (string)($row['contact_name'] ?? $row['debtor_name'] ?? '') : (string)($row['debtor_name'] ?? ''),
        'entity_kind' => 'contact',
        'contact_type' => $contactType,
        'is_payee' => $flags['is_payee'],
        'is_payer' => $flags['is_payer'],
        'is_vendor' => 0,
        'is_balance_person' => 1,
        'default_amount' => (float)($row['default_amount'] ?? 0),
        'email' => (string)($row['email'] ?? ''),
        'phone_number' => (string)($row['phone_number'] ?? ''),
        'street_address' => (string)($row['street_address'] ?? ''),
        'city' => (string)($row['city'] ?? ''),
        'state' => (string)($row['state'] ?? ''),
        'zip' => (string)($row['zip'] ?? ''),
        'notes' => (string)($row['notes'] ?? ''),
        'is_active' => (int)($row['is_active'] ?? 1),
        'legacy_contact_id' => isset($row['contact_id']) ? (int)$row['contact_id'] : null,
        'legacy_debtor_id' => (int)($row['id'] ?? 0),
    ], $existingEntityId > 0 ? $existingEntityId : null);
    Database::execute(
        'UPDATE accumul8_debtors SET entity_id = ? WHERE id = ? AND owner_user_id = ?',
        [$entityId, $debtorId, $viewerId]
    );
    return $entityId;
}

function accumul8_entity_contact_type_for_amount(float $amount): string
{
    if ($amount < 0) {
        return 'payee';
    }
    if ($amount > 0) {
        return 'payer';
    }
    return 'payee';
}

function accumul8_entity_id_from_name(int $viewerId, string $displayName, array $payload = []): ?int
{
    $normalizedName = accumul8_canonical_entity_name($displayName);
    if ($normalizedName === '') {
        return null;
    }

    $contactType = accumul8_normalize_contact_type_value($payload['contact_type'] ?? 'payee');
    $flags = accumul8_contact_type_flags($contactType);

    $entityId = accumul8_upsert_entity($viewerId, [
        'display_name' => $normalizedName,
        'entity_kind' => accumul8_normalize_entity_kind_value($payload['entity_kind'] ?? ($contactType === 'repayment' ? 'contact' : 'business')),
        'contact_type' => $contactType,
        'is_payee' => $payload['is_payee'] ?? $flags['is_payee'],
        'is_payer' => $payload['is_payer'] ?? $flags['is_payer'],
        'is_vendor' => $payload['is_vendor'] ?? ($contactType === 'payee' ? 1 : 0),
        'is_balance_person' => $payload['is_balance_person'] ?? ($contactType === 'repayment' ? 1 : 0),
        'default_amount' => $payload['default_amount'] ?? 0,
        'email' => $payload['email'] ?? '',
        'phone_number' => $payload['phone_number'] ?? '',
        'street_address' => $payload['street_address'] ?? '',
        'city' => $payload['city'] ?? '',
        'state' => $payload['state'] ?? '',
        'zip' => $payload['zip'] ?? '',
        'notes' => $payload['notes'] ?? '',
        'is_active' => $payload['is_active'] ?? 1,
    ]);
    accumul8_upsert_entity_alias($viewerId, $entityId, $displayName);
    return $entityId;
}

function accumul8_recurring_entity_id_or_create(int $viewerId, array $row): ?int
{
    $contactId = isset($row['contact_id']) ? (int)$row['contact_id'] : 0;
    if ($contactId > 0) {
        return accumul8_contact_entity_id_or_create($viewerId, $contactId);
    }

    $title = (string)($row['title'] ?? '');
    $direction = (string)($row['direction'] ?? 'outflow');
    $amount = (float)($row['amount'] ?? 0);
    $contactType = $direction === 'inflow'
        ? 'payer'
        : ($direction === 'outflow' ? 'payee' : accumul8_entity_contact_type_for_amount($amount));

    return accumul8_entity_id_from_name($viewerId, $title, [
        'entity_kind' => 'business',
        'contact_type' => $contactType,
        'default_amount' => abs($amount),
        'notes' => (string)($row['notes'] ?? ''),
        'is_vendor' => $direction === 'outflow' ? 1 : 0,
        'is_active' => (int)($row['is_active'] ?? 1),
    ]);
}

function accumul8_transaction_entity_id_or_create(int $viewerId, array $row): ?int
{
    $contactId = isset($row['contact_id']) ? (int)$row['contact_id'] : 0;
    if ($contactId > 0) {
        return accumul8_contact_entity_id_or_create($viewerId, $contactId);
    }

    $description = (string)($row['description'] ?? '');
    $amount = (float)($row['amount'] ?? 0);
    $contactType = accumul8_entity_contact_type_for_amount($amount);

    return accumul8_entity_id_from_name($viewerId, $description, [
        'entity_kind' => 'business',
        'contact_type' => $contactType,
        'default_amount' => abs($amount),
        'notes' => (string)($row['memo'] ?? ''),
        'is_vendor' => $amount < 0 ? 1 : 0,
        'is_active' => 1,
    ]);
}

function accumul8_contact_type_from_roles(int $isPayee, int $isPayer): string
{
    if ($isPayee === 1) {
        return 'payee';
    }
    if ($isPayer === 1) {
        return 'payer';
    }
    return 'payee';
}

function accumul8_sync_contact_from_entity(int $viewerId, int $entityId): ?int
{
    $entity = Database::queryOne(
        'SELECT *
         FROM accumul8_entities
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$entityId, $viewerId]
    );
    if (!$entity) {
        return null;
    }

    $contactId = isset($entity['legacy_contact_id']) && (int)$entity['legacy_contact_id'] > 0 ? (int)$entity['legacy_contact_id'] : null;
    $isPayee = (int)($entity['is_payee'] ?? 0) === 1 ? 1 : 0;
    $isPayer = (int)($entity['is_payer'] ?? 0) === 1 ? 1 : 0;
    $isVendor = (int)($entity['is_vendor'] ?? 0) === 1 ? 1 : 0;
    $shouldProject = $isPayee === 1 || $isPayer === 1 || $isVendor === 1;
    $contactType = (int)($entity['is_balance_person'] ?? 0) === 1
        ? 'repayment'
        : accumul8_contact_type_from_roles($isPayee, $isPayer);
    $isActive = $shouldProject ? ((int)($entity['is_active'] ?? 1) === 1 ? 1 : 0) : 0;

    if ($contactId !== null && $contactId > 0) {
        Database::execute(
            'UPDATE accumul8_contacts
             SET entity_id = ?, contact_name = ?, contact_type = ?, default_amount = ?, email = ?, phone_number = ?, street_address = ?, city = ?, state = ?, zip = ?, notes = ?, is_active = ?
             WHERE id = ? AND owner_user_id = ?',
            [
                $entityId,
                (string)($entity['display_name'] ?? ''),
                $contactType,
                (float)($entity['default_amount'] ?? 0),
                (string)($entity['email'] ?? '') === '' ? null : (string)$entity['email'],
                (string)($entity['phone_number'] ?? '') === '' ? null : (string)$entity['phone_number'],
                (string)($entity['street_address'] ?? '') === '' ? null : (string)$entity['street_address'],
                (string)($entity['city'] ?? '') === '' ? null : (string)$entity['city'],
                (string)($entity['state'] ?? '') === '' ? null : (string)$entity['state'],
                (string)($entity['zip'] ?? '') === '' ? null : (string)$entity['zip'],
                (string)($entity['notes'] ?? '') === '' ? null : (string)$entity['notes'],
                $isActive,
                $contactId,
                $viewerId,
            ]
        );
        return $contactId;
    }

    if (!$shouldProject) {
        return null;
    }

    Database::execute(
        'INSERT INTO accumul8_contacts (owner_user_id, entity_id, contact_name, contact_type, default_amount, email, phone_number, street_address, city, state, zip, notes, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $viewerId,
            $entityId,
            (string)($entity['display_name'] ?? ''),
            $contactType,
            (float)($entity['default_amount'] ?? 0),
            (string)($entity['email'] ?? '') === '' ? null : (string)$entity['email'],
            (string)($entity['phone_number'] ?? '') === '' ? null : (string)$entity['phone_number'],
            (string)($entity['street_address'] ?? '') === '' ? null : (string)$entity['street_address'],
            (string)($entity['city'] ?? '') === '' ? null : (string)$entity['city'],
            (string)($entity['state'] ?? '') === '' ? null : (string)$entity['state'],
            (string)($entity['zip'] ?? '') === '' ? null : (string)$entity['zip'],
            (string)($entity['notes'] ?? '') === '' ? null : (string)$entity['notes'],
            $isActive,
        ]
    );
    $contactId = (int)Database::lastInsertId();
    Database::execute(
        'UPDATE accumul8_entities
         SET legacy_contact_id = ?
         WHERE id = ? AND owner_user_id = ?',
        [$contactId, $entityId, $viewerId]
    );
    Database::execute(
        'UPDATE accumul8_recurring_payments
         SET contact_id = COALESCE(contact_id, ?)
         WHERE owner_user_id = ? AND entity_id = ?',
        [$contactId, $viewerId, $entityId]
    );
    Database::execute(
        'UPDATE accumul8_transactions
         SET contact_id = COALESCE(contact_id, ?)
         WHERE owner_user_id = ? AND entity_id = ?',
        [$contactId, $viewerId, $entityId]
    );

    return $contactId;
}

function accumul8_sync_debtor_from_entity(int $viewerId, int $entityId): ?int
{
    $entity = Database::queryOne(
        'SELECT *
         FROM accumul8_entities
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$entityId, $viewerId]
    );
    if (!$entity) {
        return null;
    }

    $debtorId = isset($entity['legacy_debtor_id']) && (int)$entity['legacy_debtor_id'] > 0 ? (int)$entity['legacy_debtor_id'] : null;
    $contactId = isset($entity['legacy_contact_id']) && (int)$entity['legacy_contact_id'] > 0 ? (int)$entity['legacy_contact_id'] : null;
    $shouldProject = (int)($entity['is_balance_person'] ?? 0) === 1;
    $isActive = $shouldProject ? ((int)($entity['is_active'] ?? 1) === 1 ? 1 : 0) : 0;

    if ($debtorId !== null && $debtorId > 0) {
        Database::execute(
            'UPDATE accumul8_debtors
             SET entity_id = ?, contact_id = ?, debtor_name = ?, notes = ?, is_active = ?
             WHERE id = ? AND owner_user_id = ?',
            [
                $entityId,
                $contactId,
                (string)($entity['display_name'] ?? ''),
                (string)($entity['notes'] ?? '') === '' ? null : (string)$entity['notes'],
                $isActive,
                $debtorId,
                $viewerId,
            ]
        );
        return $debtorId;
    }

    if (!$shouldProject) {
        return null;
    }

    Database::execute(
        'INSERT INTO accumul8_debtors (owner_user_id, entity_id, contact_id, debtor_name, notes, is_active)
         VALUES (?, ?, ?, ?, ?, ?)',
        [
            $viewerId,
            $entityId,
            $contactId,
            (string)($entity['display_name'] ?? ''),
            (string)($entity['notes'] ?? '') === '' ? null : (string)$entity['notes'],
            $isActive,
        ]
    );
    $debtorId = (int)Database::lastInsertId();
    Database::execute(
        'UPDATE accumul8_entities
         SET legacy_debtor_id = ?
         WHERE id = ? AND owner_user_id = ?',
        [$debtorId, $entityId, $viewerId]
    );
    Database::execute(
        'UPDATE accumul8_transactions
         SET debtor_id = COALESCE(debtor_id, ?), balance_entity_id = COALESCE(balance_entity_id, ?)
         WHERE owner_user_id = ? AND balance_entity_id = ?',
        [$debtorId, $entityId, $viewerId, $entityId]
    );

    return $debtorId;
}

function accumul8_list_accessible_owner_ids(int $actorUserId): array
{
    $rows = Database::queryAll(
        'SELECT DISTINCT owner_user_id
         FROM (
            SELECT ? AS owner_user_id
            UNION ALL
            SELECT g.owner_user_id
            FROM accumul8_user_access_grants g
            INNER JOIN users u ON u.id = g.owner_user_id
            WHERE g.grantee_user_id = ?
              AND g.is_active = 1
              AND u.is_active = 1
         ) access_rows
         ORDER BY owner_user_id ASC',
        [$actorUserId, $actorUserId]
    );
    $ids = [];
    foreach ($rows as $row) {
        $id = (int)($row['owner_user_id'] ?? 0);
        if ($id > 0) {
            $ids[] = $id;
        }
    }
    return array_values(array_unique($ids));
}

function accumul8_list_accessible_owners(int $actorUserId): array
{
    $rows = Database::queryAll(
        'SELECT DISTINCT u.id AS owner_user_id, u.username, u.email,
                CASE WHEN u.id = ? THEN 1 ELSE 0 END AS is_self
         FROM users u
         LEFT JOIN accumul8_user_access_grants g
           ON g.owner_user_id = u.id
          AND g.grantee_user_id = ?
          AND g.is_active = 1
         WHERE u.is_active = 1
           AND (u.id = ? OR g.id IS NOT NULL)
         ORDER BY is_self DESC, u.username ASC, u.id ASC',
        [$actorUserId, $actorUserId, $actorUserId]
    );

    return array_map(static function (array $row): array {
        return [
            'owner_user_id' => (int)($row['owner_user_id'] ?? 0),
            'username' => (string)($row['username'] ?? ''),
            'email' => (string)($row['email'] ?? ''),
            'is_self' => (int)($row['is_self'] ?? 0),
        ];
    }, $rows);
}

function accumul8_resolve_scope_owner_user_id(int $actorUserId): int
{
    $sessionKey = 'accumul8_scope_owner_user_id';
    $requested = (int)($_GET['owner_user_id'] ?? 0);
    if ($requested <= 0) {
        $requested = (int)($_SESSION[$sessionKey] ?? 0);
    }

    $accessibleOwnerIds = accumul8_list_accessible_owner_ids($actorUserId);
    if (!$accessibleOwnerIds) {
        catn8_json_response(['success' => false, 'error' => 'No Accumul8 account access grants found'], 403);
    }

    if ($requested > 0) {
        if (in_array($requested, $accessibleOwnerIds, true)) {
            $_SESSION[$sessionKey] = $requested;
            return $requested;
        }
        unset($_SESSION[$sessionKey]);
    }

    if (in_array($actorUserId, $accessibleOwnerIds, true)) {
        $_SESSION[$sessionKey] = $actorUserId;
        return $actorUserId;
    }

    $fallback = (int)($accessibleOwnerIds[0] ?? 0);
    if ($fallback <= 0) {
        catn8_json_response(['success' => false, 'error' => 'No Accumul8 account access grants found'], 403);
    }
    $_SESSION[$sessionKey] = $fallback;
    return $fallback;
}

function accumul8_owned_id_or_null(string $entityType, int $viewerId, int $id): ?int
{
    if ($id <= 0) {
        return null;
    }
    $tableByType = [
        'account_groups' => 'accumul8_account_groups',
        'contacts' => 'accumul8_contacts',
        'entities' => 'accumul8_entities',
        'accounts' => 'accumul8_accounts',
        'debtors' => 'accumul8_debtors',
        'bank_connections' => 'accumul8_bank_connections',
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

function accumul8_entity_contact_id_or_null(int $viewerId, ?int $entityId): ?int
{
    if ($entityId === null || $entityId <= 0) {
        return null;
    }
    accumul8_sync_contact_from_entity($viewerId, $entityId);
    $row = Database::queryOne(
        'SELECT legacy_contact_id
         FROM accumul8_entities
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$entityId, $viewerId]
    );
    $contactId = isset($row['legacy_contact_id']) ? (int)$row['legacy_contact_id'] : 0;
    return $contactId > 0 ? $contactId : null;
}

function accumul8_entity_debtor_id_or_null(int $viewerId, ?int $entityId): ?int
{
    if ($entityId === null || $entityId <= 0) {
        return null;
    }
    accumul8_sync_debtor_from_entity($viewerId, $entityId);
    $row = Database::queryOne(
        'SELECT legacy_debtor_id
         FROM accumul8_entities
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$entityId, $viewerId]
    );
    $debtorId = isset($row['legacy_debtor_id']) ? (int)$row['legacy_debtor_id'] : 0;
    return $debtorId > 0 ? $debtorId : null;
}

function accumul8_require_owned_id(string $entityType, int $viewerId, int $id): int
{
    $ownedId = accumul8_owned_id_or_null($entityType, $viewerId, $id);
    if ($ownedId === null) {
        catn8_json_response(['success' => false, 'error' => 'Record not found'], 404);
    }
    return $ownedId;
}

function accumul8_validate_account_type($value): string
{
    $type = strtolower(accumul8_normalize_text($value, 40));
    if ($type === '') {
        $type = 'checking';
    }
    if (!preg_match('/^[a-z0-9 _-]{2,40}$/', $type)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid account_type'], 400);
    }
    return $type;
}

function accumul8_validate_bank_connection_provider($value): string
{
    $provider = strtolower(accumul8_normalize_text($value, 32));
    if ($provider === '') {
        $provider = 'teller';
    }
    if (!in_array($provider, ['teller'], true)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid provider_name'], 400);
    }
    return $provider;
}

function accumul8_validate_bank_connection_status($value): string
{
    $status = strtolower(accumul8_normalize_text($value, 32));
    if ($status === '') {
        $status = 'setup_pending';
    }
    if (!preg_match('/^[a-z0-9_ -]{2,32}$/', $status)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid status'], 400);
    }
    return str_replace(' ', '_', $status);
}

function accumul8_count_rows(string $sql, array $params): int
{
    $row = Database::queryOne($sql, $params);
    return (int)($row['total_count'] ?? 0);
}

function accumul8_statement_account_catalog(int $viewerId): array
{
    $rows = Database::queryAll(
        'SELECT a.id, a.account_name, a.account_type, a.mask_last4, a.institution_name, COALESCE(ag.group_name, "") AS banking_organization_name
         FROM accumul8_accounts a
         LEFT JOIN accumul8_account_groups ag
           ON ag.id = a.account_group_id
          AND ag.owner_user_id = a.owner_user_id
         WHERE a.owner_user_id = ?
         ORDER BY a.account_name ASC, a.id ASC',
        [$viewerId]
    );
    return array_map(static function (array $row): array {
        return [
            'id' => (int)($row['id'] ?? 0),
            'account_name' => (string)($row['account_name'] ?? ''),
            'account_type' => (string)($row['account_type'] ?? ''),
            'mask_last4' => (string)($row['mask_last4'] ?? ''),
            'institution_name' => (string)($row['institution_name'] ?? ''),
            'banking_organization_name' => (string)($row['banking_organization_name'] ?? ''),
        ];
    }, $rows);
}

function accumul8_statement_match_account_from_catalog(array $catalog, array $statementJson, ?int $selectedAccountId = null): array
{
    if ($selectedAccountId !== null && $selectedAccountId > 0) {
        return [
            'account_id' => $selectedAccountId,
            'score' => 100,
            'reason' => '',
        ];
    }

    $candidates = [];
    $baseNameHint = accumul8_normalize_text((string)($statementJson['account_name_hint'] ?? ''), 191);
    $baseLast4 = accumul8_normalize_text((string)($statementJson['account_last4'] ?? ''), 16);
    $baseInstitution = accumul8_normalize_text((string)($statementJson['institution_name'] ?? ''), 191);
    $baseKey = accumul8_statement_section_key($baseNameHint, $baseLast4);
    if ($baseKey !== '|' || $baseInstitution !== '') {
        $candidates[$baseKey . '|' . strtolower($baseInstitution)] = [
            'account_name_hint' => strtolower($baseNameHint),
            'account_last4' => preg_replace('/\D+/', '', $baseLast4),
            'institution_name' => strtolower($baseInstitution),
            'weight' => 3,
        ];
    }
    foreach ((array)($statementJson['account_sections'] ?? []) as $section) {
        if (!is_array($section)) {
            continue;
        }
        $sectionName = accumul8_normalize_text((string)($section['account_name_hint'] ?? ''), 191);
        $sectionLast4 = accumul8_normalize_text((string)($section['account_last4'] ?? ''), 16);
        $sectionKey = accumul8_statement_section_key($sectionName, $sectionLast4);
        if ($sectionKey === '|') {
            continue;
        }
        $weight = max(1, count((array)($section['transactions'] ?? [])));
        $candidates[$sectionKey . '|' . strtolower($baseInstitution)] = [
            'account_name_hint' => strtolower($sectionName),
            'account_last4' => preg_replace('/\D+/', '', $sectionLast4),
            'institution_name' => strtolower($baseInstitution),
            'weight' => $weight,
        ];
    }
    if ($candidates === []) {
        $candidates['||'] = [
            'account_name_hint' => '',
            'account_last4' => '',
            'institution_name' => strtolower($baseInstitution),
            'weight' => 1,
        ];
    }
    $bestId = null;
    $bestScore = 0;
    $reasonBits = [];

    foreach ($catalog as $account) {
        $accountName = strtolower((string)($account['account_name'] ?? ''));
        $orgName = strtolower((string)($account['banking_organization_name'] ?? ''));
        $instName = strtolower((string)($account['institution_name'] ?? ''));
        $maskLast4 = preg_replace('/\D+/', '', (string)($account['mask_last4'] ?? ''));
        $score = 0;
        $bits = [];
        foreach ($candidates as $candidate) {
            $candidateScore = 0;
            $candidateBits = [];
            $last4 = (string)($candidate['account_last4'] ?? '');
            $nameHint = (string)($candidate['account_name_hint'] ?? '');
            $institution = (string)($candidate['institution_name'] ?? '');
            $weight = max(1, (int)($candidate['weight'] ?? 1));
            if ($last4 !== '' && $maskLast4 !== '' && $last4 === $maskLast4) {
                $candidateScore += 8;
                $candidateBits[] = 'last 4 matched';
            }
            if ($nameHint !== '' && $accountName !== '' && (str_contains($accountName, $nameHint) || str_contains($nameHint, $accountName))) {
                $candidateScore += 5;
                $candidateBits[] = 'account name matched';
            }
            if ($institution !== '' && (
                ($orgName !== '' && (str_contains($orgName, $institution) || str_contains($institution, $orgName))) ||
                ($instName !== '' && (str_contains($instName, $institution) || str_contains($institution, $instName)))
            )) {
                $candidateScore += 3;
                $candidateBits[] = 'institution matched';
            }
            $candidateScore *= $weight;
            if ($candidateScore > $score) {
                $score = $candidateScore;
                $bits = $candidateBits;
            }
        }
        if ($score > $bestScore) {
            $bestScore = $score;
            $bestId = (int)($account['id'] ?? 0);
            $reasonBits = $bits;
        }
    }

    return [
        'account_id' => $bestScore >= 8 && $bestId > 0 ? $bestId : null,
        'score' => $bestScore,
        'reason' => $bestScore > 0 ? implode(', ', $reasonBits) : 'No confident account match was detected.',
    ];
}

function accumul8_statement_pick_account_id(int $viewerId, array $statementJson, ?int $selectedAccountId = null): ?int
{
    if ($selectedAccountId !== null && $selectedAccountId > 0) {
        return accumul8_owned_id_or_null('accounts', $viewerId, $selectedAccountId);
    }
    $catalog = accumul8_statement_account_catalog($viewerId);
    $match = accumul8_statement_match_account_from_catalog($catalog, $statementJson, null);
    $accountId = isset($match['account_id']) ? (int)$match['account_id'] : 0;
    return $accountId > 0 ? $accountId : null;
}

function accumul8_statement_match_account(int $viewerId, array $statementJson, ?int $selectedAccountId = null): array
{
    if ($selectedAccountId !== null && $selectedAccountId > 0) {
        $forcedId = accumul8_owned_id_or_null('accounts', $viewerId, $selectedAccountId);
        return [
            'account_id' => $forcedId,
            'score' => $forcedId !== null ? 100 : 0,
            'reason' => $forcedId !== null ? '' : 'Selected account is unavailable.',
        ];
    }

    $catalog = accumul8_statement_account_catalog($viewerId);
    return accumul8_statement_match_account_from_catalog($catalog, $statementJson, null);
}

function accumul8_statement_suggested_new_account_payload(array $parsed, array $upload = []): array
{
    $institutionName = accumul8_normalize_text((string)($parsed['institution_name'] ?? $upload['institution_name'] ?? ''), 191);
    $accountName = accumul8_normalize_text((string)($parsed['account_name_hint'] ?? $upload['account_name_hint'] ?? 'Imported statement account'), 191);
    $statementKind = accumul8_statement_normalize_kind($parsed['statement_kind'] ?? $upload['statement_kind'] ?? 'bank_account');
    $last4 = accumul8_normalize_text((string)($parsed['account_last4'] ?? $upload['account_mask_last4'] ?? ''), 8);
    $organizationName = accumul8_normalize_text((string)($upload['banking_organization_name'] ?? ''), 191);
    if ($organizationName === '') {
        $organizationName = $institutionName;
    }

    return [
        'banking_organization_name' => $organizationName,
        'account_name' => $accountName !== '' ? $accountName : 'Imported statement account',
        'account_type' => accumul8_validate_account_type($statementKind),
        'institution_name' => $institutionName,
        'mask_last4' => $last4,
    ];
}

function accumul8_statement_catalog_payload(array $parsed, string $text): array
{
    $parsed = accumul8_statement_normalize_parsed_payload($parsed);
    $keywords = [];
    foreach ([
        (string)($parsed['institution_name'] ?? ''),
        (string)($parsed['account_name_hint'] ?? ''),
        (string)($parsed['account_last4'] ?? ''),
        (string)($parsed['period_start'] ?? ''),
        (string)($parsed['period_end'] ?? ''),
    ] as $value) {
        $value = accumul8_normalize_text($value, 80);
        if ($value !== '') {
            $keywords[] = $value;
        }
    }
    $accountLabels = accumul8_statement_distinct_account_tags($parsed);
    foreach ($accountLabels as $label) {
        $keywords[] = accumul8_normalize_text($label, 80);
    }
    foreach (accumul8_statement_transaction_rows($parsed) as $tx) {
        $description = accumul8_normalize_text((string)($tx['description'] ?? ''), 80);
        if ($description !== '') {
            $keywords[] = $description;
        }
        if (count($keywords) >= 30) {
            break;
        }
    }

    $txCount = count(accumul8_statement_transaction_rows($parsed));
    $summaryParts = [];
    if (accumul8_normalize_text((string)($parsed['institution_name'] ?? ''), 191) !== '') {
        $summaryParts[] = accumul8_normalize_text((string)($parsed['institution_name'] ?? ''), 191);
    }
    if ($accountLabels !== []) {
        $summaryParts[] = implode(', ', array_slice($accountLabels, 0, 4));
    } elseif (accumul8_normalize_text((string)($parsed['account_name_hint'] ?? ''), 191) !== '') {
        $summaryParts[] = accumul8_normalize_text((string)($parsed['account_name_hint'] ?? ''), 191);
    }
    if ($txCount > 0) {
        $summaryParts[] = $txCount . ' transactions';
    }
    $summary = implode(' | ', $summaryParts);
    if ($summary === '') {
        $summary = accumul8_normalize_text(substr($text, 0, 300), 300);
    }

    return [
        'summary' => $summary,
        'keywords' => array_values(array_unique(array_filter($keywords, static fn($value): bool => trim((string)$value) !== ''))),
    ];
}

function accumul8_statement_catalog_trace_payload(
    array $upload,
    array $extract,
    string $text,
    array $parseResult,
    array $parsed,
    array $transactionLocators,
    array $catalog,
    array $notes,
    ?array $catalogVerification = null
): array {
    return [
        'captured_at' => date('c'),
        'upload_id' => (int)($upload['id'] ?? 0),
        'original_filename' => (string)($upload['original_filename'] ?? ''),
        'mime_type' => (string)($upload['mime_type'] ?? ''),
        'extract_method' => (string)($extract['method'] ?? ''),
        'ai_provider' => (string)($parseResult['provider'] ?? ''),
        'ai_model' => (string)($parseResult['model'] ?? ''),
        'profile' => [
            'slug' => (string)($parseResult['profile']['slug'] ?? ''),
            'institution_name' => (string)($parseResult['profile']['institution_name'] ?? ''),
        ],
        'analysis' => is_array($parseResult['analysis'] ?? null) ? $parseResult['analysis'] : null,
        'notes' => array_values(array_unique(array_filter(array_map(static fn($value): string => accumul8_normalize_text((string)$value, 255), $notes), static fn(string $value): bool => $value !== ''))),
        'ocr_text' => $text,
        'page_catalog' => array_values(array_filter($extract['page_catalog'] ?? [], static fn($item): bool => is_array($item))),
        'parsed_payload' => $parsed,
        'transaction_locators' => $transactionLocators,
        'catalog' => [
            'summary' => (string)($catalog['summary'] ?? ''),
            'keywords' => array_values(array_filter((array)($catalog['keywords'] ?? []), static fn($value): bool => trim((string)$value) !== '')),
        ],
        'catalog_verification' => is_array($catalogVerification) ? $catalogVerification : null,
    ];
}

function accumul8_statement_estimate_duplicates(int $viewerId, array $parsed, ?int $accountId): int
{
    $catalog = accumul8_statement_account_catalog($viewerId);
    $accountIdsByKey = [];
    $count = 0;
    foreach (accumul8_statement_transaction_rows($parsed) as $tx) {
        if ((int)($tx['is_valid_json'] ?? 0) !== 1) {
            continue;
        }
        $txDate = accumul8_normalize_date($tx['transaction_date'] ?? $tx['posted_date'] ?? '');
        $description = accumul8_normalize_text((string)($tx['description'] ?? ''), 255);
        if ($txDate === null || $description === '' || !is_numeric($tx['amount'] ?? null)) {
            continue;
        }
        $statementJson = [
            'statement_kind' => $parsed['statement_kind'] ?? 'bank_account',
            'institution_name' => (string)($parsed['institution_name'] ?? ''),
            'account_name_hint' => (string)($tx['statement_account_name_hint'] ?? $parsed['account_name_hint'] ?? ''),
            'account_last4' => (string)($tx['statement_account_last4'] ?? $parsed['account_last4'] ?? ''),
        ];
        $cacheKey = strtolower(trim((string)$statementJson['account_name_hint'])) . '|' . preg_replace('/\D+/', '', (string)$statementJson['account_last4']);
        if (!array_key_exists($cacheKey, $accountIdsByKey)) {
            $match = accumul8_statement_match_account_from_catalog($catalog, $statementJson, $accountId);
            $accountIdsByKey[$cacheKey] = isset($match['account_id']) ? (int)$match['account_id'] : null;
        }
        $resolvedAccountId = isset($accountIdsByKey[$cacheKey]) ? (int)$accountIdsByKey[$cacheKey] : 0;
        if ($resolvedAccountId <= 0) {
            continue;
        }
        $amount = accumul8_normalize_amount($tx['amount']);
        $duplicate = Database::queryOne(
            'SELECT id
             FROM accumul8_transactions
             WHERE owner_user_id = ?
               AND COALESCE(account_id, 0) = ?
               AND transaction_date = ?
               AND ROUND(amount, 2) = ?
               AND description = ?
             LIMIT 1',
            [$viewerId, $resolvedAccountId, $txDate, $amount, $description]
        );
        if ($duplicate) {
            $count++;
        }
    }
    return $count;
}

function accumul8_statement_build_plan(int $viewerId, array $upload, array $parsed): array
{
    $parsed = accumul8_statement_normalize_parsed_payload($parsed);
    $selectedAccountId = isset($upload['account_id']) ? (int)$upload['account_id'] : null;
    $match = accumul8_statement_match_account($viewerId, $parsed, $selectedAccountId);
    $accountId = isset($match['account_id']) ? (int)$match['account_id'] : 0;
    $accountSections = accumul8_statement_distinct_account_sections($parsed);
    $accountLabels = accumul8_statement_distinct_account_tags($parsed);
    $hasMultipleAccounts = count($accountLabels) > 1;
    $accountRow = null;
    if ($accountId > 0 && !$hasMultipleAccounts) {
        $accountRow = Database::queryOne(
            'SELECT a.id, a.account_name, a.account_type, a.mask_last4, a.institution_name, COALESCE(ag.group_name, "") AS banking_organization_name
             FROM accumul8_accounts a
             LEFT JOIN accumul8_account_groups ag
               ON ag.id = a.account_group_id
              AND ag.owner_user_id = a.owner_user_id
             WHERE a.id = ? AND a.owner_user_id = ?
             LIMIT 1',
            [$accountId, $viewerId]
        );
    }

    $txCount = 0;
    $importableCount = 0;
    $invalidCount = 0;
    $inflowTotal = 0.0;
    $outflowTotal = 0.0;
    $firstDate = '';
    $lastDate = '';
    foreach (accumul8_statement_transaction_rows($parsed) as $tx) {
        $txCount++;
        if ((int)($tx['is_valid_json'] ?? 0) !== 1) {
            $invalidCount++;
            continue;
        }
        $txDate = accumul8_normalize_date($tx['transaction_date'] ?? $tx['posted_date'] ?? '');
        $description = accumul8_normalize_text((string)($tx['description'] ?? ''), 255);
        if ($txDate === null || $description === '' || !is_numeric($tx['amount'] ?? null)) {
            $invalidCount++;
            continue;
        }
        $amount = accumul8_normalize_amount($tx['amount']);
        $importableCount++;
        if ($amount >= 0) {
            $inflowTotal += $amount;
        } else {
            $outflowTotal += abs($amount);
        }
        if ($firstDate === '' || $txDate < $firstDate) {
            $firstDate = $txDate;
        }
        if ($lastDate === '' || $txDate > $lastDate) {
            $lastDate = $txDate;
        }
    }

    $suggestedNewAccount = accumul8_statement_suggested_new_account_payload($parsed, $upload);
    $accountMatchReason = accumul8_normalize_text((string)($match['reason'] ?? ''), 255);
    if ($hasMultipleAccounts) {
        $accountMatchReason = 'Multiple account sections were detected. Each transaction will be matched and imported against its tagged statement account.';
    } elseif ($accountId <= 0) {
        $accountMatchReason = trim($accountMatchReason . ' A new account will be created automatically from the detected statement metadata during import.');
    }

    return [
        'suggested_account_id' => $hasMultipleAccounts ? null : ($accountId > 0 ? $accountId : null),
        'suggested_account_label' => $hasMultipleAccounts
            ? implode(' | ', array_slice($accountLabels, 0, 4))
            : ($accountRow
            ? implode(' · ', array_values(array_filter([
                (string)($accountRow['banking_organization_name'] ?? ''),
                (string)($accountRow['account_name'] ?? ''),
                (string)($accountRow['mask_last4'] ?? '') !== '' ? '••' . (string)$accountRow['mask_last4'] : '',
            ])))
            : implode(' · ', array_values(array_filter([
                (string)($suggestedNewAccount['banking_organization_name'] ?? ''),
                (string)($suggestedNewAccount['account_name'] ?? ''),
                (string)($suggestedNewAccount['mask_last4'] ?? '') !== '' ? '••' . (string)$suggestedNewAccount['mask_last4'] : '',
            ])))),
        'account_match_score' => (int)($match['score'] ?? 0),
        'account_match_reason' => $accountMatchReason,
        'account_section_options' => array_map(static function (array $section): array {
            return [
                'account_name_hint' => (string)($section['account_name_hint'] ?? ''),
                'account_last4' => (string)($section['account_last4'] ?? ''),
                'label' => (string)($section['label'] ?? ''),
            ];
        }, $accountSections),
        'requires_account_confirmation' => 0,
        'statement_kind' => accumul8_statement_normalize_kind($parsed['statement_kind'] ?? $upload['statement_kind'] ?? 'bank_account'),
        'institution_name' => accumul8_normalize_text((string)($parsed['institution_name'] ?? ''), 191),
        'account_name_hint' => accumul8_normalize_text((string)($parsed['account_name_hint'] ?? ''), 191),
        'account_last4' => accumul8_normalize_text((string)($parsed['account_last4'] ?? ''), 16),
        'period_start' => accumul8_normalize_date($parsed['period_start'] ?? ''),
        'period_end' => accumul8_normalize_date($parsed['period_end'] ?? ''),
        'opening_balance' => isset($parsed['opening_balance']) && is_numeric($parsed['opening_balance']) ? accumul8_normalize_amount($parsed['opening_balance']) : null,
        'closing_balance' => isset($parsed['closing_balance']) && is_numeric($parsed['closing_balance']) ? accumul8_normalize_amount($parsed['closing_balance']) : null,
        'transaction_count' => $txCount,
        'importable_transaction_count' => $importableCount,
        'invalid_transaction_count' => $invalidCount,
        'estimated_duplicate_count' => $accountId > 0 ? accumul8_statement_estimate_duplicates($viewerId, $parsed, $accountId) : 0,
        'inflow_total' => round($inflowTotal, 2),
        'outflow_total' => round($outflowTotal, 2),
        'first_transaction_date' => $firstDate,
        'last_transaction_date' => $lastDate,
        'suggested_new_account' => $suggestedNewAccount,
    ];
}

function accumul8_statement_serialize_alert(array $alert): array
{
    return [
        'severity' => accumul8_normalize_text((string)($alert['severity'] ?? 'warning'), 24),
        'reason' => accumul8_normalize_text((string)($alert['reason'] ?? ''), 255),
        'transaction_description' => accumul8_normalize_text((string)($alert['transaction_description'] ?? ''), 255),
        'transaction_date' => accumul8_normalize_text((string)($alert['transaction_date'] ?? ''), 20),
        'amount' => accumul8_normalize_amount($alert['amount'] ?? 0),
        'baseline_mean' => isset($alert['baseline_mean']) ? accumul8_normalize_amount($alert['baseline_mean']) : null,
        'baseline_max' => isset($alert['baseline_max']) ? accumul8_normalize_amount($alert['baseline_max']) : null,
    ];
}

function accumul8_statement_detect_suspicious_items(int $viewerId, array $transactions): array
{
    $alerts = [];
    foreach ($transactions as $tx) {
        $entityId = (int)($tx['entity_id'] ?? 0);
        $amount = accumul8_normalize_amount($tx['amount'] ?? 0);
        $txDate = accumul8_normalize_date($tx['transaction_date'] ?? '') ?? '';
        if ($entityId <= 0 || $amount >= 0 || $txDate === '') {
            continue;
        }
        $row = Database::queryOne(
            'SELECT COUNT(*) AS sample_size,
                    AVG(ABS(amount)) AS mean_amount,
                    MAX(ABS(amount)) AS max_amount,
                    STDDEV_POP(ABS(amount)) AS stddev_amount
             FROM accumul8_transactions
             WHERE owner_user_id = ?
               AND entity_id = ?
               AND amount < 0
               AND transaction_date >= DATE_SUB(?, INTERVAL 2 YEAR)
               AND transaction_date < ?',
            [$viewerId, $entityId, $txDate, $txDate]
        );
        $sample = (int)($row['sample_size'] ?? 0);
        $absAmount = abs($amount);
        $mean = (float)($row['mean_amount'] ?? 0);
        $max = (float)($row['max_amount'] ?? 0);
        $stddev = (float)($row['stddev_amount'] ?? 0);
        if ($sample >= 4 && $absAmount > max($mean * 2.75, $mean + ($stddev * 3), $max * 1.4, 75)) {
            $alerts[] = accumul8_statement_serialize_alert([
                'severity' => 'warning',
                'reason' => 'Spending for this merchant is well above the prior two-year pattern.',
                'transaction_description' => (string)($tx['description'] ?? ''),
                'transaction_date' => $txDate,
                'amount' => $amount,
                'baseline_mean' => $mean,
                'baseline_max' => $max,
            ]);
            continue;
        }
        if ($sample === 0 && $absAmount >= 500) {
            $alerts[] = accumul8_statement_serialize_alert([
                'severity' => 'warning',
                'reason' => 'Large charge from a merchant with no prior two-year history.',
                'transaction_description' => (string)($tx['description'] ?? ''),
                'transaction_date' => $txDate,
                'amount' => $amount,
            ]);
        }
    }
    return $alerts;
}

function accumul8_statement_resolve_entity_id(int $viewerId, string $rawDescription): ?int
{
    $rawDescription = accumul8_normalize_text($rawDescription, 255);
    if ($rawDescription === '') {
        return null;
    }
    $existingId = accumul8_find_matching_entity_id($viewerId, $rawDescription);
    if ($existingId !== null && $existingId > 0) {
        return $existingId;
    }

    $parentName = accumul8_entity_alias_name($rawDescription);
    if ($parentName === '') {
        return null;
    }

    $entityRow = Database::queryOne(
        'SELECT id
         FROM accumul8_entities
         WHERE owner_user_id = ?
           AND display_name = ?
         LIMIT 1',
        [$viewerId, $parentName]
    );
    $entityId = $entityRow ? (int)($entityRow['id'] ?? 0) : 0;
    if ($entityId <= 0) {
        $family = accumul8_find_entity_family_definition($rawDescription);
        $contactFlags = accumul8_contact_type_flags('payee');
        Database::execute(
            'INSERT INTO accumul8_entities
             (owner_user_id, display_name, entity_kind, contact_type, is_payee, is_payer, is_vendor, is_balance_person, default_amount, notes, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0.00, ?, 1)',
            [$viewerId, $parentName, 'business', 'payee', $contactFlags['is_payee'], $contactFlags['is_payer'], 1, null]
        );
        $entityId = (int)Database::lastInsertId();
    }
    accumul8_assign_entity_alias($viewerId, $entityId, $rawDescription, true);
    return $entityId > 0 ? $entityId : null;
}

function accumul8_account_group_has_associations(int $viewerId, int $groupId): bool
{
    return accumul8_count_rows(
        'SELECT COUNT(*) AS total_count
         FROM accumul8_accounts
         WHERE owner_user_id = ?
           AND account_group_id = ?',
        [$viewerId, $groupId]
    ) > 0;
}

function accumul8_bank_connection_secret_key_for_row(array $row): string
{
    $secretKey = accumul8_normalize_text((string)($row['teller_access_token_secret_key'] ?? ''), 191);
    if ($secretKey !== '') {
        return $secretKey;
    }

    $enrollmentId = accumul8_normalize_text((string)($row['teller_enrollment_id'] ?? ''), 191);
    $viewerId = (int)($row['owner_user_id'] ?? 0);
    if ($viewerId <= 0 || $enrollmentId === '') {
        return '';
    }

    return 'accumul8.teller.access_token.' . $viewerId . '.' . preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $enrollmentId);
}

function accumul8_account_has_associations(int $viewerId, int $accountId): bool
{
    $transactionCount = accumul8_count_rows(
        'SELECT COUNT(*) AS total_count
         FROM accumul8_transactions
         WHERE owner_user_id = ?
           AND account_id = ?',
        [$viewerId, $accountId]
    );
    if ($transactionCount > 0) {
        return true;
    }

    $recurringCount = accumul8_count_rows(
        'SELECT COUNT(*) AS total_count
         FROM accumul8_recurring_payments
         WHERE owner_user_id = ?
           AND account_id = ?',
        [$viewerId, $accountId]
    );

    return $recurringCount > 0;
}

function accumul8_delete_account_and_associated_records(int $viewerId, int $accountId): array
{
    $deletedTransactionCount = 0;
    $deletedRecurringCount = 0;

    Database::beginTransaction();
    try {
        $deletedTransactionCount = Database::execute(
            'DELETE FROM accumul8_transactions
             WHERE owner_user_id = ?
               AND account_id = ?',
            [$viewerId, $accountId]
        );

        $deletedRecurringCount = Database::execute(
            'DELETE FROM accumul8_recurring_payments
             WHERE owner_user_id = ?
               AND account_id = ?',
            [$viewerId, $accountId]
        );

        $deletedAccountCount = Database::execute(
            'DELETE FROM accumul8_accounts
             WHERE id = ?
               AND owner_user_id = ?',
            [$accountId, $viewerId]
        );

        if ($deletedAccountCount !== 1) {
            throw new RuntimeException('Failed to delete bank account');
        }

        Database::commit();
    } catch (Throwable $exception) {
        if (Database::inTransaction()) {
            Database::rollBack();
        }
        throw $exception;
    }

    return [
        'deleted_transaction_count' => $deletedTransactionCount,
        'deleted_recurring_count' => $deletedRecurringCount,
    ];
}

function accumul8_transactions_has_debtor_column(): bool
{
    static $hasColumn = null;
    if ($hasColumn !== null) {
        return $hasColumn;
    }
    try {
        $hasColumn = accumul8_table_has_column('accumul8_transactions', 'debtor_id');
    } catch (Throwable $e) {
        $hasColumn = false;
    }
    return $hasColumn;
}

function accumul8_has_debtor_support(): bool
{
    return accumul8_transactions_has_debtor_column() && accumul8_table_exists('accumul8_debtors');
}

function accumul8_aicountant_normalize_title($value, int $maxLen = 191): string
{
    return accumul8_normalize_text($value, $maxLen);
}

function accumul8_aicountant_normalize_message($value, int $maxLen = 4000): string
{
    return catn8_ai_sanitize_user_text((string)$value, $maxLen);
}

function accumul8_aicountant_title_from_message(string $message): string
{
    $title = accumul8_aicountant_normalize_title($message, 80);
    if ($title === '') {
        return 'AIcountant Chat ' . date('M j, Y');
    }
    if (strlen($title) <= 80) {
        return $title;
    }
    return rtrim(substr($title, 0, 77)) . '...';
}

function accumul8_aicountant_default_system_prompt(): string
{
    return <<<PROMPT
You are AIcountant, my personal household accountant and bookkeeping assistant.

Your job is to help me keep my household books organized, accurate, current, and easy to understand. Use the Accumul8 financial data snapshot provided with each request as the authoritative source of truth for balances, transactions, recurring bills, budget rows, and account-level details.

When you respond:
- Prioritize bookkeeping accuracy over sounding confident.
- Explain spending patterns, cash-flow risks, overdue items, and budgeting opportunities in plain English.
- Help categorize transactions, identify likely duplicates or anomalies, and point out anything that appears miscoded, uncategorized, overdue, or financially risky.
- Look at recent spending trends to infer likely near-term cash needs, bill pressure, and areas the household should watch closely.
- Recommend practical next steps such as which bills to pay first, where spending appears off track, and what records should be reviewed manually.
- When the user asks for categorization or cleanup help, suggest the most reasonable category based on the available data and clearly say when confidence is low.
- Use dates, dollar amounts, and account names from the provided data whenever possible.
- If information is missing or ambiguous, say exactly what is missing instead of inventing details.
- You can apply supported bookkeeping changes when the user clearly asks for them and the action executor confirms they were applied.
- Do not claim that you changed ledger records, budgets, categories, balances, reminders, or notifications unless the user explicitly asked for an action and a real tool confirms it happened.

Communication style:
- Be concise, organized, and practical.
- Prefer short paragraphs and small bullet lists when helpful.
- End substantial answers with a short “Next best step” recommendation.
PROMPT;
}

function accumul8_aicountant_effective_conversation_system_prompt(array $conversation): string
{
    $defaultPrompt = accumul8_aicountant_default_system_prompt();
    $savedPrompt = trim((string)($conversation['system_prompt'] ?? ''));
    if ($savedPrompt === '' || $savedPrompt === $defaultPrompt) {
        return $defaultPrompt;
    }

    if (strpos($savedPrompt, 'You can apply supported bookkeeping changes when the user clearly asks for them and the action executor confirms they were applied.') !== false) {
        return $savedPrompt;
    }

    return $defaultPrompt
        . "\n\nAdditional conversation-specific instructions:\n"
        . $savedPrompt;
}

function accumul8_aicountant_suggested_starters(): array
{
    return [
        'Review the last 30 days of household spending and flag anything unusual.',
        'Categorize my recent uncategorized spending and tell me where I may be overspending.',
        'Look at my upcoming bills and tell me what I should prioritize this week.',
        'Run a watchlist and tell me what bills, cash-flow risks, or reminders I should watch.',
        'Reconcile my opening balances so Accumul8 matches my bank balances.',
        'Compare my recent spending against my budget rows and point out problem areas.',
        'Review my recurring payments and suggest any subscriptions or bills worth revisiting.',
    ];
}

function accumul8_aicountant_decode_json_object($value): array
{
    if (is_array($value)) {
        return $value;
    }
    $decoded = json_decode((string)$value, true);
    return is_array($decoded) ? $decoded : [];
}

function accumul8_aicountant_message_role($value): string
{
    $role = strtolower(accumul8_normalize_text((string)$value, 24));
    if (!in_array($role, ['user', 'assistant', 'system'], true)) {
        $role = 'user';
    }
    return $role;
}

function accumul8_aicountant_provider_has_credentials(string $provider): bool
{
    $provider = strtolower(trim($provider));
    if ($provider === 'google_vertex_ai') {
        $saJson = secret_get(catn8_settings_ai_secret_key($provider, 'service_account_json'));
        return is_string($saJson) && trim($saJson) !== '';
    }

    $apiKey = secret_get(catn8_settings_ai_secret_key($provider, 'api_key'));
    return is_string($apiKey) && trim($apiKey) !== '';
}

function accumul8_message_board_map_row(array $row): array
{
    return [
        'id' => (int)($row['id'] ?? 0),
        'owner_user_id' => (int)($row['owner_user_id'] ?? 0),
        'actor_user_id' => (int)($row['actor_user_id'] ?? 0),
        'source_kind' => (string)($row['source_kind'] ?? ''),
        'message_level' => (string)($row['message_level'] ?? 'info'),
        'title' => (string)($row['title'] ?? ''),
        'body_text' => (string)($row['body_text'] ?? ''),
        'meta' => accumul8_aicountant_decode_json_object($row['meta_json'] ?? '{}'),
        'is_acknowledged' => (int)($row['is_acknowledged'] ?? 0),
        'acknowledged_at' => (string)($row['acknowledged_at'] ?? ''),
        'created_at' => (string)($row['created_at'] ?? ''),
    ];
}

function accumul8_message_board_post(int $viewerId, int $actorUserId, string $sourceKind, string $level, string $title, string $bodyText, array $meta = []): int
{
    $normalizedSource = accumul8_normalize_text($sourceKind, 64);
    $normalizedLevel = strtolower(accumul8_normalize_text($level, 24));
    if (!in_array($normalizedLevel, ['info', 'success', 'warning', 'error'], true)) {
        $normalizedLevel = 'info';
    }
    $normalizedTitle = accumul8_normalize_text($title, 191);
    $normalizedBody = accumul8_normalize_text($bodyText, 2000);
    if ($normalizedTitle === '' && $normalizedBody === '') {
        return 0;
    }
    $metaJson = json_encode($meta, JSON_UNESCAPED_SLASHES);
    if (!is_string($metaJson)) {
        $metaJson = json_encode(new stdClass(), JSON_UNESCAPED_SLASHES);
    }

    Database::execute(
        'INSERT INTO accumul8_message_board_messages
            (owner_user_id, actor_user_id, source_kind, message_level, title, body_text, meta_json, is_acknowledged)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
        [$viewerId, $actorUserId, $normalizedSource, $normalizedLevel, $normalizedTitle, $normalizedBody, $metaJson]
    );

    return (int)Database::lastInsertId();
}

function accumul8_message_board_list(int $viewerId, int $limit = 150): array
{
    $limit = max(1, min(250, $limit));
    $rows = Database::queryAll(
        'SELECT id, owner_user_id, actor_user_id, source_kind, message_level, title, body_text, meta_json, is_acknowledged, acknowledged_at, created_at
         FROM accumul8_message_board_messages
         WHERE owner_user_id = ?
         ORDER BY is_acknowledged ASC, created_at DESC, id DESC
         LIMIT ' . $limit,
        [$viewerId]
    );
    return array_map('accumul8_message_board_map_row', $rows);
}

function accumul8_message_board_unacknowledged_count(int $viewerId): int
{
    $row = Database::queryOne(
        'SELECT COUNT(*) AS total
         FROM accumul8_message_board_messages
         WHERE owner_user_id = ? AND is_acknowledged = 0',
        [$viewerId]
    );
    return (int)($row['total'] ?? 0);
}

function accumul8_teller_sync_transactions_for_connection(int $viewerId, int $actorUserId, int $connectionId): array
{
    $connection = Database::queryOne(
        'SELECT id, institution_id, institution_name, teller_enrollment_id, teller_access_token_secret_key
         FROM accumul8_bank_connections
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$connectionId, $viewerId]
    );
    if (!$connection) {
        throw new RuntimeException('Connection not found');
    }

    $connectionInstitutionId = accumul8_normalize_text((string)($connection['institution_id'] ?? ''), 64);
    $connectionInstitutionName = accumul8_normalize_text((string)($connection['institution_name'] ?? ''), 191);
    $connectionEnrollmentId = accumul8_normalize_text((string)($connection['teller_enrollment_id'] ?? ''), 191);
    $watchedInstitution = accumul8_teller_is_watched_institution($connectionInstitutionId, $connectionInstitutionName);
    accumul8_teller_log_diagnostic(
        'accumul8.teller.sync',
        true,
        200,
        'Teller sync started',
        [
            'connection_id' => $connectionId,
            'institution_id' => $connectionInstitutionId !== '' ? $connectionInstitutionId : null,
            'institution_name' => $connectionInstitutionName !== '' ? $connectionInstitutionName : null,
            'enrollment_id' => $connectionEnrollmentId !== '' ? $connectionEnrollmentId : null,
            'watched_institution' => $watchedInstitution ? 1 : 0,
        ]
    );

    $secretKey = (string)($connection['teller_access_token_secret_key'] ?? '');
    $accessToken = (string)(secret_get($secretKey) ?? '');
    if ($secretKey === '' || $accessToken === '') {
        throw new RuntimeException('Stored Teller access token was not found');
    }

    $addedTotal = 0;
    $modifiedTotal = 0;
    $unchangedTotal = 0;
    $removedTotal = 0;
    $accountSummaries = [];
    $today = gmdate('Y-m-d');
    $recentWindowDays = 30;
    $recentOverlapDays = 10;
    $backfillPageSize = 500;
    $backfillPagesPerSync = accumul8_teller_backfill_pages_per_sync();

    try {
        $accounts = accumul8_teller_request('GET', '/accounts', $accessToken);
        foreach ($accounts as $account) {
            if (!is_array($account)) {
                continue;
            }

            $remoteAccountId = accumul8_normalize_text((string)($account['id'] ?? ''), 191);
            if ($remoteAccountId === '') {
                continue;
            }

            $supportsTransactions = accumul8_teller_account_supports_link($account, 'transactions');
            $supportsBalances = accumul8_teller_account_supports_link($account, 'balances');
            $supportsDetails = accumul8_teller_account_supports_link($account, 'details');
            $balances = [];
            $details = [];
            if ($supportsBalances) {
                try {
                    $balances = accumul8_teller_request('GET', '/accounts/' . rawurlencode($remoteAccountId) . '/balances', $accessToken);
                } catch (Throwable $e) {
                    $balances = [];
                }
            }
            if ($supportsDetails) {
                try {
                    $details = accumul8_teller_request('GET', '/accounts/' . rawurlencode($remoteAccountId) . '/details', $accessToken);
                } catch (Throwable $e) {
                    $details = [];
                }
            }

            $accountMapping = accumul8_upsert_teller_account(
                $viewerId,
                $connectionId,
                $connection,
                $account,
                is_array($balances) ? $balances : [],
                is_array($details) ? $details : []
            );
            $localAccountId = (int)($accountMapping['local_account_id'] ?? 0);
            if ($localAccountId <= 0) {
                throw new RuntimeException('Failed to map Teller account into a local Accumul8 account');
            }

            $accountAdded = 0;
            $accountModified = 0;
            $accountUnchanged = 0;
            $accountRemoved = 0;
            $accountStaleTellerRemoved = 0;
            $accountStatementImportsRemoved = 0;
            $syncSkippedReason = '';
            $historyStartDate = '';
            $historyEndDate = '';
            $fetchedHistoryStartDate = '';
            $fetchedHistoryEndDate = '';
            $remoteTransactionIds = [];
            $recentSyncAnchorDate = accumul8_normalize_text((string)($accountMapping['teller_sync_anchor_date'] ?? ''), 32);
            $storedBackfillCursorId = accumul8_normalize_text((string)($accountMapping['teller_backfill_cursor_id'] ?? ''), 191);
            $backfillComplete = (int)($accountMapping['teller_backfill_complete'] ?? 0) === 1;
            $recentWindowStartDate = $recentSyncAnchorDate !== ''
                ? accumul8_shift_date($recentSyncAnchorDate, -$recentOverlapDays)
                : accumul8_shift_date($today, -($recentWindowDays - 1));
            $recentWindowEndDate = $today;

            $oldestLocalRow = Database::queryOne(
                'SELECT external_id, transaction_date
                 FROM accumul8_transactions
                 WHERE owner_user_id = ?
                   AND account_id = ?
                   AND source_kind = ?
                   AND source_ref = ?
                   AND external_id IS NOT NULL
                   AND external_id <> ""
                 ORDER BY transaction_date ASC, id ASC
                 LIMIT 1',
                [$viewerId, $localAccountId, 'teller', $remoteAccountId]
            ) ?: [];

            $recentResult = [
                'transactions' => [],
                'oldest_id' => '',
                'has_more' => false,
                'pages_fetched' => 0,
            ];
            $recentTransactions = [];
            if ($supportsTransactions) {
                $recentResult = accumul8_teller_list_transactions(
                    $accessToken,
                    $remoteAccountId,
                    [
                        'start_date' => $recentWindowStartDate,
                        'end_date' => $recentWindowEndDate,
                    ],
                    500,
                    100
                );
                $recentTransactions = is_array($recentResult['transactions'] ?? null) ? $recentResult['transactions'] : [];
            } else {
                $syncSkippedReason = 'Teller did not expose transaction access for this account.';
            }

            $backfillSeedCursorId = $storedBackfillCursorId;
            if ($backfillSeedCursorId === '') {
                $backfillSeedCursorId = accumul8_normalize_text((string)($oldestLocalRow['external_id'] ?? ''), 191);
            }
            if ($backfillSeedCursorId === '' && $recentTransactions !== []) {
                $backfillSeedCursorId = accumul8_normalize_text((string)($recentResult['oldest_id'] ?? ''), 191);
            }

            $backfillResult = [
                'transactions' => [],
                'oldest_id' => '',
                'has_more' => false,
                'pages_fetched' => 0,
            ];
            if ($supportsTransactions && !$backfillComplete) {
                if ($backfillSeedCursorId !== '') {
                    $backfillResult = accumul8_teller_list_transactions(
                        $accessToken,
                        $remoteAccountId,
                        ['from_id' => $backfillSeedCursorId],
                        $backfillPageSize,
                        $backfillPagesPerSync
                    );
                } elseif ($recentTransactions === []) {
                    $backfillResult = accumul8_teller_list_transactions(
                        $accessToken,
                        $remoteAccountId,
                        [],
                        $backfillPageSize,
                        $backfillPagesPerSync
                    );
                }
            }

            $processedExternalIds = [];
            $syncBatches = [
                [
                    'transactions' => $recentTransactions,
                    'track_remote_ids' => true,
                ],
                [
                    'transactions' => is_array($backfillResult['transactions'] ?? null) ? $backfillResult['transactions'] : [],
                    'track_remote_ids' => false,
                ],
            ];

            foreach ($syncBatches as $batch) {
                foreach (($batch['transactions'] ?? []) as $tx) {
                    if (!is_array($tx)) {
                        continue;
                    }

                    $externalId = accumul8_normalize_text((string)($tx['id'] ?? ''), 191);
                    if ($externalId === '' || isset($processedExternalIds[$externalId])) {
                        continue;
                    }
                    $processedExternalIds[$externalId] = true;
                    if (!empty($batch['track_remote_ids'])) {
                        $remoteTransactionIds[$externalId] = true;
                    }

                    $description = accumul8_normalize_text(
                        (string)($tx['description'] ?? (($tx['counterparty']['name'] ?? 'Bank Transaction'))),
                        255
                    );
                    if ($description === '') {
                        $description = 'Bank Transaction';
                    }

                    $date = accumul8_require_valid_date('transaction_date', $tx['date'] ?? date('Y-m-d'));
                    $amount = round((float)($tx['amount'] ?? 0), 2);
                    $statusText = strtolower(accumul8_normalize_text((string)($tx['status'] ?? ''), 32));
                    $pending = $statusText === 'pending' ? 1 : 0;
                    if ($fetchedHistoryStartDate === '' || strcmp($date, $fetchedHistoryStartDate) < 0) {
                        $fetchedHistoryStartDate = $date;
                    }
                    if ($fetchedHistoryEndDate === '' || strcmp($date, $fetchedHistoryEndDate) > 0) {
                        $fetchedHistoryEndDate = $date;
                    }

                    $existingTx = Database::queryOne(
                        'SELECT id, account_id, transaction_date, due_date, paid_date, description, amount, pending_status, source_ref
                         FROM accumul8_transactions
                         WHERE owner_user_id = ? AND source_kind = ? AND external_id = ?
                         LIMIT 1',
                        [$viewerId, 'teller', $externalId]
                    );

                    if ($existingTx) {
                        $nextPaidDate = $pending ? null : $date;
                        $hasChanges =
                            (int)($existingTx['account_id'] ?? 0) !== $localAccountId
                            || (string)($existingTx['transaction_date'] ?? '') !== $date
                            || (string)($existingTx['due_date'] ?? '') !== $date
                            || (string)($existingTx['paid_date'] ?? '') !== (string)($nextPaidDate ?? '')
                            || (string)($existingTx['description'] ?? '') !== $description
                            || round((float)($existingTx['amount'] ?? 0), 2) !== $amount
                            || (int)($existingTx['pending_status'] ?? 0) !== $pending
                            || (string)($existingTx['source_ref'] ?? '') !== $remoteAccountId;

                        if ($hasChanges) {
                            Database::execute(
                                'UPDATE accumul8_transactions
                                 SET account_id = ?, transaction_date = ?, due_date = ?, paid_date = ?, description = ?, amount = ?, pending_status = ?, source_ref = ?, updated_at = NOW()
                                 WHERE id = ? AND owner_user_id = ?',
                                [
                                    $localAccountId,
                                    $date,
                                    $date,
                                    $nextPaidDate,
                                    $description,
                                    $amount,
                                    $pending,
                                    $remoteAccountId,
                                    (int)$existingTx['id'],
                                    $viewerId,
                                ]
                            );
                            $modifiedTotal++;
                            $accountModified++;
                        } else {
                            $unchangedTotal++;
                            $accountUnchanged++;
                        }
                        continue;
                    }

                    Database::execute(
                        'INSERT INTO accumul8_transactions
                            (owner_user_id, account_id, transaction_date, due_date, entry_type, description, amount,
                             is_paid, is_reconciled, is_budget_planner, source_kind, source_ref, external_id, pending_status, paid_date, created_by_user_id)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [
                            $viewerId,
                            $localAccountId,
                            $date,
                            $date,
                            'manual',
                            $description,
                            $amount,
                            1,
                            1,
                            0,
                            'teller',
                            $remoteAccountId,
                            $externalId,
                            $pending,
                            $pending ? null : $date,
                            $actorUserId,
                        ]
                    );
                    $addedTotal++;
                    $accountAdded++;
                }
            }

            if ($supportsTransactions && $recentWindowStartDate !== '' && $recentWindowEndDate !== '') {
                $localRecentTransactions = Database::queryAll(
                    'SELECT id, external_id
                     FROM accumul8_transactions
                     WHERE owner_user_id = ?
                       AND account_id = ?
                       AND source_kind = ?
                       AND source_ref = ?
                       AND transaction_date BETWEEN ? AND ?',
                    [$viewerId, $localAccountId, 'teller', $remoteAccountId, $recentWindowStartDate, $recentWindowEndDate]
                );
                $staleLocalTellerIds = [];
                foreach ($localRecentTransactions as $row) {
                    $localExternalId = accumul8_normalize_text((string)($row['external_id'] ?? ''), 191);
                    if ($localExternalId !== '' && isset($remoteTransactionIds[$localExternalId])) {
                        continue;
                    }
                    $staleLocalTellerIds[] = (int)($row['id'] ?? 0);
                }
                $accountStaleTellerRemoved = accumul8_delete_transactions_by_ids($viewerId, $staleLocalTellerIds);
            }

            if ($fetchedHistoryStartDate !== '' && $fetchedHistoryEndDate !== '') {
                $statementTransactionsToRemove = Database::queryAll(
                    'SELECT id
                     FROM accumul8_transactions
                     WHERE owner_user_id = ?
                       AND account_id = ?
                       AND source_kind IN (?, ?)
                       AND transaction_date BETWEEN ? AND ?',
                    [$viewerId, $localAccountId, 'statement_upload', 'statement_pdf', $fetchedHistoryStartDate, $fetchedHistoryEndDate]
                );
                $statementTransactionIds = array_map(
                    static fn(array $row): int => (int)($row['id'] ?? 0),
                    $statementTransactionsToRemove
                );
                $accountStatementImportsRemoved = accumul8_delete_transactions_by_ids($viewerId, $statementTransactionIds);
            }

            $nextBackfillCursorId = $storedBackfillCursorId;
            $nextBackfillComplete = $backfillComplete ? 1 : 0;
            $backfillTransactions = is_array($backfillResult['transactions'] ?? null) ? $backfillResult['transactions'] : [];
            if ($supportsTransactions && !$backfillComplete) {
                if ($backfillTransactions !== []) {
                    $nextBackfillCursorId = accumul8_normalize_text((string)($backfillResult['oldest_id'] ?? ''), 191);
                    $nextBackfillComplete = !empty($backfillResult['has_more']) ? 0 : 1;
                } elseif ($backfillSeedCursorId !== '' || $recentTransactions === []) {
                    $nextBackfillCursorId = $backfillSeedCursorId;
                    $nextBackfillComplete = 1;
                } elseif ($recentTransactions !== []) {
                    $nextBackfillCursorId = accumul8_normalize_text((string)($recentResult['oldest_id'] ?? ''), 191);
                    $nextBackfillComplete = 0;
                }
            }

            $historyCoverage = Database::queryOne(
                'SELECT MIN(transaction_date) AS min_date, MAX(transaction_date) AS max_date
                 FROM accumul8_transactions
                 WHERE owner_user_id = ?
                   AND account_id = ?
                   AND source_kind = ?
                   AND source_ref = ?',
                [$viewerId, $localAccountId, 'teller', $remoteAccountId]
            ) ?: [];
            $historyStartDate = isset($historyCoverage['min_date']) && $historyCoverage['min_date'] !== null ? (string)$historyCoverage['min_date'] : '';
            $historyEndDate = isset($historyCoverage['max_date']) && $historyCoverage['max_date'] !== null ? (string)$historyCoverage['max_date'] : '';

            Database::execute(
                'UPDATE accumul8_accounts
                 SET teller_sync_anchor_date = ?, teller_backfill_cursor_id = ?, teller_backfill_complete = ?, teller_history_start_date = ?, teller_history_end_date = ?, updated_at = NOW()
                 WHERE id = ? AND owner_user_id = ?',
                [
                    $today,
                    $nextBackfillCursorId !== '' ? $nextBackfillCursorId : null,
                    $nextBackfillComplete,
                    $historyStartDate !== '' ? $historyStartDate : null,
                    $historyEndDate !== '' ? $historyEndDate : null,
                    $localAccountId,
                    $viewerId,
                ]
            );
            $accountRemoved = $accountStaleTellerRemoved + $accountStatementImportsRemoved;
            $removedTotal += $accountRemoved;

            $accountSummaries[] = [
                'remote_account_id' => (string)($accountMapping['remote_account_id'] ?? $remoteAccountId),
                'remote_account_name' => (string)($accountMapping['remote_account_name'] ?? ($account['name'] ?? 'Teller Account')),
                'remote_account_type' => (string)($accountMapping['remote_account_type'] ?? ''),
                'remote_account_subtype' => (string)($accountMapping['remote_account_subtype'] ?? ''),
                'mask_last4' => (string)($accountMapping['mask_last4'] ?? ''),
                'local_account_id' => $localAccountId,
                'local_account_name' => (string)($accountMapping['local_account_name'] ?? ''),
                'institution_name' => (string)($accountMapping['institution_name'] ?? ($connection['institution_name'] ?? '')),
                'mapping_action' => (string)($accountMapping['mapping_action'] ?? 'updated'),
                'transactions_supported' => $supportsTransactions ? 1 : 0,
                'balances_supported' => $supportsBalances ? 1 : 0,
                'details_supported' => $supportsDetails ? 1 : 0,
                'sync_skipped_reason' => $syncSkippedReason,
                'history_start_date' => $historyStartDate,
                'history_end_date' => $historyEndDate,
                'recent_window_start_date' => $recentWindowStartDate,
                'recent_window_end_date' => $recentWindowEndDate,
                'backfill_cursor_id' => $nextBackfillCursorId,
                'backfill_complete' => $nextBackfillComplete,
                'backfill_pages_fetched' => (int)($backfillResult['pages_fetched'] ?? 0),
                'transactions_added' => $accountAdded,
                'transactions_modified' => $accountModified,
                'transactions_unchanged' => $accountUnchanged,
                'transactions_removed' => $accountRemoved,
                'stale_teller_removed' => $accountStaleTellerRemoved,
                'statement_imports_removed' => $accountStatementImportsRemoved,
            ];
        }

        Database::execute(
            'UPDATE accumul8_bank_connections
             SET last_sync_at = NOW(), status = ?, last_error = NULL
             WHERE id = ? AND owner_user_id = ?',
            ['connected', $connectionId, $viewerId]
        );

        accumul8_recompute_running_balance($viewerId);

        accumul8_teller_log_diagnostic(
            'accumul8.teller.sync',
            true,
            200,
            'Teller sync completed',
            [
                'connection_id' => $connectionId,
                'institution_id' => $connectionInstitutionId !== '' ? $connectionInstitutionId : null,
                'institution_name' => $connectionInstitutionName !== '' ? $connectionInstitutionName : null,
                'enrollment_id' => $connectionEnrollmentId !== '' ? $connectionEnrollmentId : null,
                'watched_institution' => $watchedInstitution ? 1 : 0,
                'added' => $addedTotal,
                'modified' => $modifiedTotal,
                'unchanged' => $unchangedTotal,
                'removed' => $removedTotal,
                'account_count' => count($accountSummaries),
                'accounts' => array_map(static function (array $summary): array {
                    return [
                        'remote_account_id' => (string)($summary['remote_account_id'] ?? ''),
                        'remote_account_name' => (string)($summary['remote_account_name'] ?? ''),
                        'remote_account_type' => (string)($summary['remote_account_type'] ?? ''),
                        'remote_account_subtype' => (string)($summary['remote_account_subtype'] ?? ''),
                        'transactions_supported' => (int)($summary['transactions_supported'] ?? 0),
                        'sync_skipped_reason' => (string)($summary['sync_skipped_reason'] ?? ''),
                        'history_start_date' => (string)($summary['history_start_date'] ?? ''),
                        'history_end_date' => (string)($summary['history_end_date'] ?? ''),
                        'transactions_added' => (int)($summary['transactions_added'] ?? 0),
                        'transactions_modified' => (int)($summary['transactions_modified'] ?? 0),
                        'transactions_removed' => (int)($summary['transactions_removed'] ?? 0),
                    ];
                }, $accountSummaries),
            ]
        );

        return [
            'added' => $addedTotal,
            'modified' => $modifiedTotal,
            'unchanged' => $unchangedTotal,
            'removed' => $removedTotal,
            'accounts' => $accountSummaries,
        ];
    } catch (Throwable $e) {
        Database::execute(
            'UPDATE accumul8_bank_connections
             SET status = ?, last_error = ?, updated_at = NOW()
             WHERE id = ? AND owner_user_id = ?',
            ['sync_error', accumul8_normalize_text($e->getMessage(), 2000), $connectionId, $viewerId]
        );
        accumul8_teller_log_diagnostic(
            'accumul8.teller.sync',
            false,
            500,
            accumul8_normalize_text($e->getMessage(), 500),
            [
                'connection_id' => $connectionId,
                'institution_id' => $connectionInstitutionId !== '' ? $connectionInstitutionId : null,
                'institution_name' => $connectionInstitutionName !== '' ? $connectionInstitutionName : null,
                'enrollment_id' => $connectionEnrollmentId !== '' ? $connectionEnrollmentId : null,
                'watched_institution' => $watchedInstitution ? 1 : 0,
            ]
        );
        throw $e;
    }
}

function accumul8_balance_books_sync(int $viewerId, int $actorUserId): array
{
    $connections = Database::queryAll(
        'SELECT id, institution_name, provider_name
         FROM accumul8_bank_connections
         WHERE owner_user_id = ?
         ORDER BY institution_name ASC, id ASC',
        [$viewerId]
    );
    $eligibleConnections = array_values(array_filter($connections, static function (array $connection): bool {
        return (int)($connection['id'] ?? 0) > 0
            && strtolower((string)($connection['provider_name'] ?? 'teller')) === 'teller';
    }));

    $beforeRows = Database::queryAll(
        'SELECT id, account_name, current_balance
         FROM accumul8_accounts
         WHERE owner_user_id = ?',
        [$viewerId]
    );
    $beforeBalanceByAccountId = [];
    foreach ($beforeRows as $row) {
        $beforeBalanceByAccountId[(int)($row['id'] ?? 0)] = [
            'account_name' => (string)($row['account_name'] ?? ''),
            'current_balance' => round((float)($row['current_balance'] ?? 0), 2),
        ];
    }

    accumul8_message_board_post(
        $viewerId,
        $actorUserId,
        'aicountant_balance_books',
        'info',
        'Balance the Books started',
        $eligibleConnections !== []
            ? 'AIcountant started a balance run across ' . count($eligibleConnections) . ' bank connection' . (count($eligibleConnections) === 1 ? '' : 's') . '.'
            : 'AIcountant started a balance run but found no Teller bank connections to sync.'
    );

    if ($eligibleConnections === []) {
        return [
            'synced_connection_count' => 0,
            'skipped_connection_count' => 0,
            'error_connection_count' => 0,
            'changed_accounts' => [],
        ];
    }

    $syncedCount = 0;
    $errorCount = 0;
    $skippedCount = 0;

    foreach ($eligibleConnections as $connection) {
        $connectionId = (int)($connection['id'] ?? 0);
        $institutionName = accumul8_normalize_text((string)($connection['institution_name'] ?? ''), 191);
        if ($institutionName === '') {
            $institutionName = 'Connected bank';
        }

        try {
            $result = accumul8_teller_sync_transactions_for_connection($viewerId, $actorUserId, $connectionId);
            $syncedCount++;
            $allAccountsSkipped = true;
            foreach (($result['accounts'] ?? []) as $accountSummary) {
                if (!is_array($accountSummary)) {
                    continue;
                }
                if ((int)($accountSummary['transactions_supported'] ?? 0) === 1 || (string)($accountSummary['sync_skipped_reason'] ?? '') === '') {
                    $allAccountsSkipped = false;
                    break;
                }
            }
            if ($allAccountsSkipped) {
                $skippedCount++;
            }
            accumul8_message_board_post(
                $viewerId,
                $actorUserId,
                'aicountant_balance_books',
                $allAccountsSkipped ? 'warning' : 'success',
                'Synced ' . $institutionName,
                'Added ' . (int)($result['added'] ?? 0)
                    . ', modified ' . (int)($result['modified'] ?? 0)
                    . ', removed ' . (int)($result['removed'] ?? 0)
                    . ', unchanged ' . (int)($result['unchanged'] ?? 0)
                    . ' transactions.',
                [
                    'connection_id' => $connectionId,
                    'institution_name' => $institutionName,
                    'result' => $result,
                ]
            );
        } catch (Throwable $exception) {
            $errorCount++;
            accumul8_message_board_post(
                $viewerId,
                $actorUserId,
                'aicountant_balance_books',
                'error',
                'Sync failed for ' . $institutionName,
                accumul8_normalize_text($exception->getMessage(), 2000),
                [
                    'connection_id' => $connectionId,
                    'institution_name' => $institutionName,
                ]
            );
        }
    }

    $afterRows = Database::queryAll(
        'SELECT id, account_name, current_balance
         FROM accumul8_accounts
         WHERE owner_user_id = ?',
        [$viewerId]
    );
    $changedAccounts = [];
    foreach ($afterRows as $row) {
        $accountId = (int)($row['id'] ?? 0);
        $afterBalance = round((float)($row['current_balance'] ?? 0), 2);
        $beforeInfo = $beforeBalanceByAccountId[$accountId] ?? ['account_name' => (string)($row['account_name'] ?? ''), 'current_balance' => 0.0];
        $beforeBalance = round((float)($beforeInfo['current_balance'] ?? 0), 2);
        if (abs($afterBalance - $beforeBalance) <= 0.009) {
            continue;
        }
        $changedAccounts[] = [
            'account_id' => $accountId,
            'account_name' => (string)($row['account_name'] ?? $beforeInfo['account_name'] ?? ''),
            'before_balance' => $beforeBalance,
            'after_balance' => $afterBalance,
        ];
    }

    return [
        'synced_connection_count' => $syncedCount,
        'skipped_connection_count' => $skippedCount,
        'error_connection_count' => $errorCount,
        'changed_accounts' => $changedAccounts,
    ];
}

function accumul8_balance_books(int $viewerId, int $actorUserId): array
{
    $balanceResult = accumul8_balance_books_sync($viewerId, $actorUserId);
    $openingBalanceResult = [
        'reconciled_count' => 0,
        'skipped_count' => 0,
        'review_needed_count' => 0,
        'review_needed_accounts' => [],
        'results' => [],
    ];

    if ((int)($balanceResult['synced_connection_count'] ?? 0) > 0) {
        $openingBalanceResult = accumul8_reconcile_opening_balances($viewerId, $actorUserId);
    }

    $changedAccounts = is_array($balanceResult['changed_accounts'] ?? null) ? $balanceResult['changed_accounts'] : [];
    $errorCount = (int)($balanceResult['error_connection_count'] ?? 0);
    $reviewNeededCount = (int)($openingBalanceResult['review_needed_count'] ?? 0);
    $reconciledCount = (int)($openingBalanceResult['reconciled_count'] ?? 0);

    $summaryParts = [
        'Synced ' . (int)($balanceResult['synced_connection_count'] ?? 0) . ' connection' . ((int)($balanceResult['synced_connection_count'] ?? 0) === 1 ? '' : 's') . '.',
        $errorCount > 0
            ? $errorCount . ' connection' . ($errorCount === 1 ? '' : 's') . ' failed.'
            : 'No connection failures were reported.',
        $changedAccounts !== []
            ? 'Updated balances were detected for ' . count($changedAccounts) . ' account' . (count($changedAccounts) === 1 ? '' : 's') . '.'
            : 'No account balance changes were detected after synchronization.',
        $reconciledCount > 0
            ? 'Opening balance review adjusted ' . $reconciledCount . ' account' . ($reconciledCount === 1 ? '' : 's') . '.'
            : 'Opening balance review did not make any automatic adjustments.',
    ];
    if ($reviewNeededCount > 0) {
        $summaryParts[] = $reviewNeededCount . ' account' . ($reviewNeededCount === 1 ? ' needs' : 's need') . ' manual review before any opening-balance change is safe.';
    }

    accumul8_message_board_post(
        $viewerId,
        $actorUserId,
        'aicountant_balance_books',
        ($errorCount > 0 || $reviewNeededCount > 0) ? 'warning' : 'success',
        'Balance the Books finished',
        implode(' ', $summaryParts),
        [
            'synced_count' => (int)($balanceResult['synced_connection_count'] ?? 0),
            'skipped_count' => (int)($balanceResult['skipped_connection_count'] ?? 0),
            'error_count' => $errorCount,
            'changed_accounts' => $changedAccounts,
            'opening_balance_reconciliation' => $openingBalanceResult,
        ]
    );

    return [
        'synced_connection_count' => (int)($balanceResult['synced_connection_count'] ?? 0),
        'skipped_connection_count' => (int)($balanceResult['skipped_connection_count'] ?? 0),
        'error_connection_count' => $errorCount,
        'opening_balance_reconciliation' => $openingBalanceResult,
        'messages' => accumul8_message_board_list($viewerId),
        'unacknowledged_count' => accumul8_message_board_unacknowledged_count($viewerId),
    ];
}

function accumul8_opening_balance_adjustment_anchor_date(int $viewerId, int $accountId): string
{
    $row = Database::queryOne(
        'SELECT MIN(transaction_date) AS first_transaction_date
         FROM accumul8_transactions
         WHERE owner_user_id = ?
           AND account_id = ?
           AND NOT (
               description = ?
               AND source_ref = ?
           )',
        [$viewerId, $accountId, 'Opening Balance', 'aicountant_opening_balance']
    );
    $firstDate = accumul8_normalize_date($row['first_transaction_date'] ?? null);
    if ($firstDate !== null) {
        return accumul8_shift_date($firstDate, -1);
    }
    return gmdate('Y-m-d');
}

function accumul8_reconcile_opening_balances(int $viewerId, int $actorUserId): array
{
    $rows = Database::queryAll(
        'SELECT id, account_name, provider_name, institution_name, current_balance, available_balance, bank_connection_id
         FROM accumul8_accounts
         WHERE owner_user_id = ?
           AND is_active = 1
         ORDER BY institution_name ASC, account_name ASC, id ASC',
        [$viewerId]
    );

    accumul8_message_board_post(
        $viewerId,
        $actorUserId,
        'aicountant_opening_balance',
        'info',
        'Opening balance reconciliation started',
        'AIcountant started reconciling opening balances against available bank balances.'
    );

    $results = [];
    $skippedCount = 0;
    $reviewNeeded = [];
    $hasDebtor = accumul8_has_debtor_support();
    foreach ($rows as $row) {
        $accountId = (int)($row['id'] ?? 0);
        if ($accountId <= 0) {
            continue;
        }

        $providerName = strtolower(accumul8_normalize_text((string)($row['provider_name'] ?? ''), 64));
        $bankConnectionId = (int)($row['bank_connection_id'] ?? 0);
        $bankBalance = round((float)($row['available_balance'] ?? 0), 2);
        $ledgerBalance = round((float)($row['current_balance'] ?? 0), 2);
        $accountName = accumul8_normalize_text((string)($row['account_name'] ?? ''), 191);
        if ($accountName === '') {
            $accountName = 'Account #' . $accountId;
        }

        if ($bankConnectionId <= 0 || $providerName !== 'teller') {
            $skippedCount++;
            continue;
        }

        $delta = round($bankBalance - $ledgerBalance, 2);
        if (abs($delta) <= 0.009) {
            $skippedCount++;
            continue;
        }

        $tellerHistory = Database::queryOne(
            'SELECT COUNT(*) AS teller_count
             FROM accumul8_transactions
             WHERE owner_user_id = ?
               AND account_id = ?
               AND source_kind = ?',
            [$viewerId, $accountId, 'teller']
        );
        if ((int)($tellerHistory['teller_count'] ?? 0) <= 0) {
            $reviewNeeded[] = [
                'account_id' => $accountId,
                'account_name' => $accountName,
                'reason' => 'No Teller transaction history has been synced yet, so AIcountant cannot infer a trustworthy opening balance.',
            ];
            continue;
        }

        $nonTellerActivity = Database::queryOne(
            'SELECT COUNT(*) AS total
             FROM accumul8_transactions
             WHERE owner_user_id = ?
               AND account_id = ?
               AND description <> ?
               AND COALESCE(source_kind, \'\') <> ?',
            [$viewerId, $accountId, 'Opening Balance', 'teller']
        );
        if ((int)($nonTellerActivity['total'] ?? 0) > 0) {
            $reviewNeeded[] = [
                'account_id' => $accountId,
                'account_name' => $accountName,
                'reason' => 'This ledger already contains non-Teller activity, so an automatic opening-balance change could overwrite real bookkeeping work.',
            ];
            continue;
        }

        $anchorDate = accumul8_opening_balance_adjustment_anchor_date($viewerId, $accountId);
        $existing = Database::queryOne(
            'SELECT id
             FROM accumul8_transactions
             WHERE owner_user_id = ?
               AND account_id = ?
               AND description = ?
               AND source_ref = ?
             ORDER BY id ASC
             LIMIT 1',
            [$viewerId, $accountId, 'Opening Balance', 'aicountant_opening_balance']
        );
        $userOpeningBalanceRow = Database::queryOne(
            'SELECT id
             FROM accumul8_transactions
             WHERE owner_user_id = ?
               AND account_id = ?
               AND description = ?
               AND (source_ref IS NULL OR source_ref = ? OR source_ref <> ?)
             ORDER BY id ASC
             LIMIT 1',
            [$viewerId, $accountId, 'Opening Balance', '', 'aicountant_opening_balance']
        );
        if ($userOpeningBalanceRow) {
            $reviewNeeded[] = [
                'account_id' => $accountId,
                'account_name' => $accountName,
                'reason' => 'A non-AI opening balance entry already exists for this account, so AIcountant left it alone for manual review.',
            ];
            continue;
        }

        $memo = 'AIcountant opening balance adjustment dated ' . $anchorDate
            . ' after comparing Teller balance ' . number_format($bankBalance, 2)
            . ' to ledger balance ' . number_format($ledgerBalance, 2)
            . ' on ' . gmdate('Y-m-d H:i:s') . ' UTC.';

        if ($existing) {
            Database::execute(
                'UPDATE accumul8_transactions
                 SET transaction_date = ?, due_date = ?, paid_date = ?, amount = ?, memo = ?, is_paid = 1, is_reconciled = 1, is_budget_planner = 0, updated_at = NOW()
                 WHERE id = ? AND owner_user_id = ?',
                [$anchorDate, $anchorDate, $anchorDate, $delta, $memo, (int)$existing['id'], $viewerId]
            );
            $transactionId = (int)$existing['id'];
            $action = 'updated';
        } else {
            if ($hasDebtor) {
                Database::execute(
                    'INSERT INTO accumul8_transactions
                        (owner_user_id, account_id, entity_id, balance_entity_id, contact_id, debtor_id, transaction_date, due_date, entry_type, description, memo, amount, rta_amount,
                         is_paid, is_reconciled, is_budget_planner, source_kind, source_ref, paid_date, created_by_user_id)
                     VALUES (?, ?, NULL, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, 0.00, 1, 1, 0, ?, ?, ?, ?)',
                    [$viewerId, $accountId, $anchorDate, $anchorDate, 'manual', 'Opening Balance', $memo, $delta, 'manual', 'aicountant_opening_balance', $anchorDate, $actorUserId]
                );
            } else {
                Database::execute(
                    'INSERT INTO accumul8_transactions
                        (owner_user_id, account_id, entity_id, contact_id, transaction_date, due_date, entry_type, description, memo, amount, rta_amount,
                         is_paid, is_reconciled, is_budget_planner, source_kind, source_ref, paid_date, created_by_user_id)
                     VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, 0.00, 1, 1, 0, ?, ?, ?, ?)',
                    [$viewerId, $accountId, $anchorDate, $anchorDate, 'manual', 'Opening Balance', $memo, $delta, 'manual', 'aicountant_opening_balance', $anchorDate, $actorUserId]
                );
            }
            $transactionId = (int)Database::lastInsertId();
            $action = 'created';
        }

        $results[] = [
            'account_id' => $accountId,
            'account_name' => $accountName,
            'prior_ledger_balance' => $ledgerBalance,
            'bank_balance' => $bankBalance,
            'adjustment_amount' => $delta,
            'transaction_id' => $transactionId,
            'transaction_date' => $anchorDate,
            'action' => $action,
        ];

        accumul8_message_board_post(
            $viewerId,
            $actorUserId,
            'aicountant_opening_balance',
            'warning',
            'Opening balance adjusted for ' . $accountName,
            'Applied a ' . ($delta >= 0 ? '+' : '') . number_format($delta, 2) . ' opening balance adjustment dated ' . $anchorDate . ' so the ledger can align with the Teller bank balance of ' . number_format($bankBalance, 2) . '.',
            end($results) ?: []
        );
    }

    if ($results !== []) {
        accumul8_recompute_running_balance($viewerId);
    }

    accumul8_message_board_post(
        $viewerId,
        $actorUserId,
        'aicountant_opening_balance',
        ($results !== [] || $reviewNeeded !== []) ? ($reviewNeeded !== [] ? 'warning' : 'success') : 'info',
        'Opening balance reconciliation finished',
        $results !== []
            ? 'Adjusted opening balances for ' . count($results) . ' account' . (count($results) === 1 ? '' : 's') . '.'
                . ($reviewNeeded !== []
                    ? ' Left ' . count($reviewNeeded) . ' account' . (count($reviewNeeded) === 1 ? '' : 's') . ' unchanged because manual review is safer.'
                    : '')
            : ($reviewNeeded !== []
                ? 'No automatic opening balance adjustments were made. ' . count($reviewNeeded) . ' account' . (count($reviewNeeded) === 1 ? ' needs' : 's need') . ' manual review first.'
                : 'No opening balance adjustments were needed.'),
        [
            'reconciled_count' => count($results),
            'skipped_count' => $skippedCount,
            'review_needed_count' => count($reviewNeeded),
            'review_needed_accounts' => $reviewNeeded,
            'results' => $results,
        ]
    );

    return [
        'reconciled_count' => count($results),
        'skipped_count' => $skippedCount,
        'review_needed_count' => count($reviewNeeded),
        'review_needed_accounts' => $reviewNeeded,
        'results' => $results,
        'messages' => accumul8_message_board_list($viewerId),
        'unacknowledged_count' => accumul8_message_board_unacknowledged_count($viewerId),
    ];
}

function accumul8_aicountant_debt_accounts(int $viewerId): array
{
    $rows = Database::queryAll(
        'SELECT account_name, institution_name, account_type, current_balance, credit_limit, interest_rate, minimum_payment
         FROM accumul8_accounts
         WHERE owner_user_id = ?
           AND is_active = 1
         ORDER BY institution_name ASC, account_name ASC',
        [$viewerId]
    );

    $debtAccounts = [];
    foreach ($rows as $row) {
        $accountType = strtolower(accumul8_normalize_text((string)($row['account_type'] ?? ''), 40));
        $balance = round((float)($row['current_balance'] ?? 0), 2);
        $creditLimit = round((float)($row['credit_limit'] ?? 0), 2);
        $isDebtType = in_array($accountType, ['credit_card', 'loan', 'line_of_credit', 'mortgage'], true)
            || ($creditLimit > 0 && $balance > 0);
        if (!$isDebtType || $balance <= 0.009) {
            continue;
        }

        $debtAccounts[] = [
            'account_name' => accumul8_normalize_text((string)($row['account_name'] ?? 'Debt Account'), 191),
            'institution_name' => accumul8_normalize_text((string)($row['institution_name'] ?? ''), 191),
            'account_type' => $accountType,
            'balance' => $balance,
            'interest_rate' => round((float)($row['interest_rate'] ?? 0), 4),
            'minimum_payment' => round((float)($row['minimum_payment'] ?? 0), 2),
        ];
    }

    usort($debtAccounts, static function (array $left, array $right): int {
        $interestCompare = ((float)($right['interest_rate'] ?? 0)) <=> ((float)($left['interest_rate'] ?? 0));
        if ($interestCompare !== 0) {
            return $interestCompare;
        }
        return ((float)($left['balance'] ?? 0)) <=> ((float)($right['balance'] ?? 0));
    });

    return $debtAccounts;
}

function accumul8_aicountant_average_monthly_cashflow(int $viewerId, string $startDate, string $endDate): array
{
    $row = Database::queryOne(
        "SELECT
            COALESCE(AVG(month_inflow), 0.00) AS avg_inflow,
            COALESCE(AVG(month_outflow), 0.00) AS avg_outflow,
            COALESCE(AVG(net_total), 0.00) AS avg_net
         FROM (
            SELECT DATE_FORMAT(transaction_date, '%Y-%m') AS month_key,
                   SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS month_inflow,
                   SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS month_outflow,
                   SUM(amount) AS net_total
            FROM accumul8_transactions
            WHERE owner_user_id = ?
              AND transaction_date BETWEEN ? AND ?
            GROUP BY DATE_FORMAT(transaction_date, '%Y-%m')
         ) monthly_rollup",
        [$viewerId, $startDate, $endDate]
    ) ?: [];

    return [
        'avg_inflow' => round((float)($row['avg_inflow'] ?? 0), 2),
        'avg_outflow' => round((float)($row['avg_outflow'] ?? 0), 2),
        'avg_net' => round((float)($row['avg_net'] ?? 0), 2),
    ];
}

function accumul8_aicountant_build_coaching_note(array $input): string
{
    $overdueCount = (int)($input['overdue_count'] ?? 0);
    $dueSoonCount = (int)($input['due_soon_count'] ?? 0);
    $recurringSoonCount = (int)($input['recurring_soon_count'] ?? 0);
    $cashTight = (int)($input['cash_tight'] ?? 0) === 1;
    $averageMonthlyNet = round((float)($input['average_monthly_net'] ?? 0), 2);
    $topSpendingLabels = is_array($input['top_spending_labels'] ?? null) ? array_values(array_map('strval', $input['top_spending_labels'])) : [];
    $debtAccounts = is_array($input['debt_accounts'] ?? null) ? $input['debt_accounts'] : [];
    $budgetRowCount = (int)($input['budget_row_count'] ?? 0);

    $lines = [];
    if ($overdueCount > 0 || $cashTight) {
        $lines[] = 'Right now, protect cash first: clear overdue bills and keep minimum debt payments current before making aggressive extra payments.';
    } elseif ($dueSoonCount > 0 || $recurringSoonCount > 0) {
        $lines[] = 'Keep the next two weeks funded first, then use any remaining margin for debt payoff.';
    }

    if ($debtAccounts !== []) {
        $totalDebt = 0.0;
        $totalMinimums = 0.0;
        $smallestBalanceAccount = null;
        $highestInterestAccount = null;
        foreach ($debtAccounts as $account) {
            $balance = round((float)($account['balance'] ?? 0), 2);
            $minimumPayment = round((float)($account['minimum_payment'] ?? 0), 2);
            $interestRate = round((float)($account['interest_rate'] ?? 0), 4);
            $totalDebt += $balance;
            $totalMinimums += $minimumPayment;
            if ($smallestBalanceAccount === null || $balance < (float)($smallestBalanceAccount['balance'] ?? INF)) {
                $smallestBalanceAccount = $account;
            }
            if ($highestInterestAccount === null || $interestRate > (float)($highestInterestAccount['interest_rate'] ?? 0)) {
                $highestInterestAccount = $account;
            }
        }

        $lines[] = 'Tracked debt totals ' . number_format($totalDebt, 2) . ' across ' . count($debtAccounts) . ' account'
            . (count($debtAccounts) === 1 ? '' : 's')
            . ' with minimum payments of ' . number_format($totalMinimums, 2) . ' per month.';

        if ($highestInterestAccount !== null && (float)($highestInterestAccount['interest_rate'] ?? 0) > 0) {
            $lines[] = 'Best payoff target for lowest long-term cost: '
                . (string)($highestInterestAccount['account_name'] ?? 'the highest-rate account')
                . ' at ' . number_format((float)($highestInterestAccount['interest_rate'] ?? 0), 2) . '% interest with a balance of '
                . number_format((float)($highestInterestAccount['balance'] ?? 0), 2) . '.';
        } elseif ($smallestBalanceAccount !== null) {
            $lines[] = 'Because interest-rate data is incomplete, the safest simple strategy is a snowball: wipe out '
                . (string)($smallestBalanceAccount['account_name'] ?? 'the smallest balance')
                . ' first at ' . number_format((float)($smallestBalanceAccount['balance'] ?? 0), 2) . ' while paying minimums on the rest.';
        }

        if ($averageMonthlyNet > 0) {
            $gentleExtra = max(25, min(250, (int)(round(($averageMonthlyNet * 0.15) / 25) * 25)));
            $lines[] = 'Low-friction move: redirect about ' . number_format((float)$gentleExtra, 2)
                . ' per month of your average cash surplus toward your payoff target so progress builds without hitting lifestyle too hard.';
        } elseif ($topSpendingLabels !== []) {
            $lines[] = 'To create extra payoff room without a sharp lifestyle cut, trim one of your biggest recent spending areas first: '
                . implode(', ', array_slice($topSpendingLabels, 0, 2)) . '.';
        }
    } elseif ($averageMonthlyNet > 0) {
        $lines[] = 'You appear to have a positive average monthly cash cushion of ' . number_format($averageMonthlyNet, 2)
            . '. Use part of that buffer to build an emergency reserve or prepare for future debt payoff.';
    }

    if ($budgetRowCount <= 0) {
        $lines[] = 'No active budget rows are set up yet. Add a few core spending categories so AIcountant can coach tradeoffs more precisely.';
    } elseif ($topSpendingLabels !== []) {
        $lines[] = 'Review these recent spending leaders for lighter-touch cuts before making bigger lifestyle changes: '
            . implode(', ', array_slice($topSpendingLabels, 0, 3)) . '.';
    }

    return implode("\n", array_slice($lines, 0, 5));
}

function accumul8_aicountant_generate_personalized_coach_note(int $viewerId, array $focusContext, string $fallback): string
{
    $fallback = trim($fallback);
    try {
        $aiConfig = accumul8_aicountant_effective_ai_config();
        $provider = (string)($aiConfig['provider'] ?? 'openai');
        $model = (string)($aiConfig['model'] ?? '');
        $temperature = min(0.4, max(0.0, (float)($aiConfig['temperature'] ?? 0.2)));
        $baseUrl = (string)($aiConfig['base_url'] ?? '');
        $location = (string)($aiConfig['location'] ?? '');

        $systemPrompt = <<<TXT
You are AIcountant, a practical household finance coach.
Write a short personalized coach note for an email.
Goals:
- Help the user make better money decisions without sounding judgmental.
- Emphasize cash protection, debt payoff, and low-friction budget changes.
- Keep the note concrete and specific to the provided numbers.
- Suggest only realistic steps that would not disrupt lifestyle too sharply.
- Do not claim anything was changed automatically.

Style:
- 1 short paragraph plus 2-4 short bullet points.
- Under 170 words total.
- No greeting or sign-off.
TXT;

        $userPrompt = "Financial snapshot for the coach note (JSON):\n"
            . json_encode($focusContext, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
            . "\n\nWrite the personalized coach note now.";

        if ($provider === 'google_vertex_ai') {
            $saJson = secret_get(catn8_settings_ai_secret_key($provider, 'service_account_json'));
            if (!is_string($saJson) || trim($saJson) === '') {
                throw new RuntimeException('Missing AI service account JSON (google_vertex_ai)');
            }
            $sa = json_decode((string)$saJson, true);
            if (!is_array($sa)) {
                throw new RuntimeException('AI Vertex service account JSON is invalid');
            }
            $content = catn8_vertex_ai_gemini_generate_text([
                'service_account_json' => $saJson,
                'project_id' => trim((string)($sa['project_id'] ?? '')),
                'location' => $location !== '' ? $location : 'us-central1',
                'model' => $model !== '' ? $model : 'gemini-1.5-pro',
                'system_prompt' => $systemPrompt,
                'user_prompt' => $userPrompt,
                'temperature' => $temperature,
                'max_output_tokens' => 700,
            ]);
            $note = trim((string)$content);
        } elseif ($provider === 'google_ai_studio') {
            $apiKey = secret_get(catn8_settings_ai_secret_key($provider, 'api_key'));
            if (!is_string($apiKey) || trim($apiKey) === '') {
                throw new RuntimeException('Missing AI API key (google_ai_studio)');
            }
            $resolvedModel = $model !== '' ? $model : 'gemini-1.5-pro';
            $resp = catn8_http_json_with_status(
                'POST',
                'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($resolvedModel) . ':generateContent',
                ['x-goog-api-key' => trim($apiKey)],
                [
                    'contents' => [['role' => 'user', 'parts' => [['text' => $userPrompt]]]],
                    'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
                    'generationConfig' => ['temperature' => $temperature],
                ],
                10,
                45
            );
            $note = trim((string)($resp['json']['candidates'][0]['content']['parts'][0]['text'] ?? ''));
        } else {
            $resolvedModel = $model !== '' ? $model : 'gpt-4o-mini';
            $result = accumul8_openai_responses_text(
                $resolvedModel,
                [[
                    'role' => 'system',
                    'content' => [
                        ['type' => 'input_text', 'text' => $systemPrompt],
                    ],
                ], [
                    'role' => 'user',
                    'content' => [
                        ['type' => 'input_text', 'text' => $userPrompt],
                    ],
                ]],
                $baseUrl,
                $temperature,
                700,
                45
            );
            $note = trim((string)($result['content'] ?? ''));
        }

        $note = trim((string)$note);
        if (strlen($note) > 2000) {
            $note = substr($note, 0, 2000);
        }
        return $note !== '' ? $note : $fallback;
    } catch (Throwable $exception) {
        return $fallback;
    }
}

function accumul8_aicountant_watchlist_payload(int $viewerId): array
{
    $today = gmdate('Y-m-d');
    $sevenDaysOut = accumul8_shift_date($today, 7);
    $fourteenDaysOut = accumul8_shift_date($today, 14);
    $ninetyDaysAgo = accumul8_shift_date($today, -89);

    $overdueRows = Database::queryAll(
        'SELECT id, description, due_date, amount
         FROM accumul8_transactions
         WHERE owner_user_id = ?
           AND amount < 0
           AND is_paid = 0
           AND due_date IS NOT NULL
           AND due_date < ?
         ORDER BY due_date ASC, id ASC
         LIMIT 8',
        [$viewerId, $today]
    );
    $dueSoonRows = Database::queryAll(
        'SELECT id, description, due_date, amount
         FROM accumul8_transactions
         WHERE owner_user_id = ?
           AND amount < 0
           AND is_paid = 0
           AND due_date IS NOT NULL
           AND due_date BETWEEN ? AND ?
         ORDER BY due_date ASC, id ASC
         LIMIT 10',
        [$viewerId, $today, $sevenDaysOut]
    );
    $recurringSoonRows = Database::queryAll(
        'SELECT id, title, next_due_date, amount
         FROM accumul8_recurring_payments
         WHERE owner_user_id = ?
           AND is_active = 1
           AND direction = ?
           AND next_due_date BETWEEN ? AND ?
         ORDER BY next_due_date ASC, id ASC
         LIMIT 10',
        [$viewerId, 'outflow', $today, $fourteenDaysOut]
    );
    $spendingRows = Database::queryAll(
        'SELECT COALESCE(e.display_name, t.description, "Spending") AS label, SUM(ABS(t.amount)) AS total_spend
         FROM accumul8_transactions t
         LEFT JOIN accumul8_entities e ON e.id = t.entity_id
         WHERE t.owner_user_id = ?
           AND t.transaction_date BETWEEN ? AND ?
           AND t.amount < 0
           AND t.is_paid = 1
         GROUP BY COALESCE(e.display_name, t.description, "Spending")
         ORDER BY total_spend DESC, label ASC
         LIMIT 5',
        [$viewerId, $ninetyDaysAgo, $today]
    );
    $accountTotals = Database::queryOne(
        'SELECT COALESCE(SUM(current_balance), 0.00) AS ledger_total,
                COALESCE(SUM(available_balance), 0.00) AS available_total
         FROM accumul8_accounts
         WHERE owner_user_id = ?
           AND is_active = 1',
        [$viewerId]
    ) ?: [];
    $budgetCountRow = Database::queryOne(
        'SELECT COUNT(*) AS total
         FROM accumul8_budget_rows
         WHERE owner_user_id = ?
           AND is_active = 1',
        [$viewerId]
    ) ?: [];
    $monthlyCashflow = accumul8_aicountant_average_monthly_cashflow($viewerId, $ninetyDaysAgo, $today);
    $debtAccounts = accumul8_aicountant_debt_accounts($viewerId);

    $dueSoonTotal = 0.0;
    foreach ($dueSoonRows as $row) {
        $dueSoonTotal += abs((float)($row['amount'] ?? 0));
    }
    $recurringSoonTotal = 0.0;
    foreach ($recurringSoonRows as $row) {
        $recurringSoonTotal += abs((float)($row['amount'] ?? 0));
    }
    $averageMonthlySpend = 0.0;
    foreach ($spendingRows as $row) {
        $averageMonthlySpend += (float)($row['total_spend'] ?? 0);
    }
    $averageMonthlySpend = round($averageMonthlySpend / 3, 2);

    $availableTotal = round((float)($accountTotals['available_total'] ?? 0), 2);
    $cashNeedSoon = round($dueSoonTotal + $recurringSoonTotal, 2);
    $cashTight = $cashNeedSoon > 0 && $availableTotal < $cashNeedSoon;

    $topSpendingLabels = [];
    foreach ($spendingRows as $row) {
        $label = accumul8_normalize_text((string)($row['label'] ?? ''), 120);
        if ($label === '') {
            continue;
        }
        $topSpendingLabels[] = $label . ' (' . number_format((float)($row['total_spend'] ?? 0), 2) . ')';
    }

    $summaryParts = [];
    if ($overdueRows !== []) {
        $summaryParts[] = count($overdueRows) . ' overdue bill' . (count($overdueRows) === 1 ? '' : 's');
    }
    if ($dueSoonRows !== []) {
        $summaryParts[] = count($dueSoonRows) . ' unpaid bill' . (count($dueSoonRows) === 1 ? '' : 's') . ' due within 7 days';
    }
    if ($recurringSoonRows !== []) {
        $summaryParts[] = count($recurringSoonRows) . ' recurring outflow' . (count($recurringSoonRows) === 1 ? '' : 's') . ' due within 14 days';
    }
    if ($summaryParts === []) {
        $summaryParts[] = 'no immediate due-date pressure was detected';
    }

    $summaryTitle = $cashTight ? 'AIcountant cash-flow watch' : 'AIcountant spending watch';
    $summaryBody = implode(', ', $summaryParts) . '. '
        . 'Available bank balance: ' . number_format($availableTotal, 2) . '. '
        . 'Expected cash need over the next two weeks: ' . number_format($cashNeedSoon, 2) . '. '
        . 'Estimated average monthly spend from the last 90 days: ' . number_format($averageMonthlySpend, 2) . '.';
    if ($topSpendingLabels !== []) {
        $summaryBody .= ' Top recent spending: ' . implode('; ', $topSpendingLabels) . '.';
    }
    $coachingText = accumul8_aicountant_build_coaching_note([
        'overdue_count' => count($overdueRows),
        'due_soon_count' => count($dueSoonRows),
        'recurring_soon_count' => count($recurringSoonRows),
        'cash_tight' => $cashTight ? 1 : 0,
        'average_monthly_net' => (float)($monthlyCashflow['avg_net'] ?? 0),
        'top_spending_labels' => $topSpendingLabels,
        'debt_accounts' => $debtAccounts,
        'budget_row_count' => (int)($budgetCountRow['total'] ?? 0),
    ]);
    $personalizedCoachingText = accumul8_aicountant_generate_personalized_coach_note($viewerId, [
        'today' => $today,
        'summary_title' => $summaryTitle,
        'overdue_count' => count($overdueRows),
        'due_soon_count' => count($dueSoonRows),
        'recurring_soon_count' => count($recurringSoonRows),
        'available_total' => $availableTotal,
        'cash_need_soon' => $cashNeedSoon,
        'average_monthly_spend' => $averageMonthlySpend,
        'average_monthly_net' => (float)($monthlyCashflow['avg_net'] ?? 0),
        'cash_tight' => $cashTight ? 1 : 0,
        'budget_row_count' => (int)($budgetCountRow['total'] ?? 0),
        'top_spending_labels' => $topSpendingLabels,
        'debt_accounts' => $debtAccounts,
    ], $coachingText);
    if ($personalizedCoachingText !== '') {
        $summaryBody .= "\n\nAIcountant coaching:\n" . $personalizedCoachingText;
    }

    return [
        'summary_title' => $summaryTitle,
        'summary_body' => $summaryBody,
        'overdue_count' => count($overdueRows),
        'due_soon_count' => count($dueSoonRows),
        'recurring_soon_count' => count($recurringSoonRows),
        'available_total' => $availableTotal,
        'cash_need_soon' => $cashNeedSoon,
        'average_monthly_spend' => $averageMonthlySpend,
        'average_monthly_net' => (float)($monthlyCashflow['avg_net'] ?? 0),
        'cash_tight' => $cashTight ? 1 : 0,
        'budget_row_count' => (int)($budgetCountRow['total'] ?? 0),
        'coaching_text' => $personalizedCoachingText,
    ];
}

function accumul8_notification_rule_find_by_name(int $viewerId, string $ruleName): ?array
{
    $row = Database::queryOne(
        'SELECT id, rule_name, trigger_type, days_before_due, target_scope, custom_user_ids_json,
                email_subject_template, email_body_template, is_active, last_triggered_at
         FROM accumul8_notification_rules
         WHERE owner_user_id = ?
           AND rule_name = ?
         LIMIT 1',
        [$viewerId, $ruleName]
    );
    if (!$row) {
        return null;
    }
    $json = json_decode((string)($row['custom_user_ids_json'] ?? '[]'), true);
    return [
        'id' => (int)($row['id'] ?? 0),
        'rule_name' => (string)($row['rule_name'] ?? ''),
        'trigger_type' => (string)($row['trigger_type'] ?? 'upcoming_due'),
        'days_before_due' => (int)($row['days_before_due'] ?? 0),
        'target_scope' => (string)($row['target_scope'] ?? 'group'),
        'custom_user_ids' => is_array($json) ? array_values(array_unique(array_map('intval', $json))) : [],
        'email_subject_template' => (string)($row['email_subject_template'] ?? ''),
        'email_body_template' => (string)($row['email_body_template'] ?? ''),
        'is_active' => (int)($row['is_active'] ?? 0),
        'last_triggered_at' => (string)($row['last_triggered_at'] ?? ''),
    ];
}

function accumul8_send_notification_message(int $viewerId, array $rule, string $subject, string $textBody): array
{
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
        throw new RuntimeException('No recipients available for this rule');
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

    return [
        'sent_count' => count($sent),
        'failed_count' => count($failed),
        'sent' => $sent,
        'failed' => $failed,
    ];
}

function accumul8_aicountant_upsert_bill_watch_rule(int $viewerId): array
{
    $ruleName = 'AIcountant Bill Watch';
    $subject = 'AIcountant bill watch';
    $body = 'Review due and overdue household bills, upcoming recurring payments, and any near-term cash-flow pressure.';
    $existing = accumul8_notification_rule_find_by_name($viewerId, $ruleName);
    if ($existing) {
        Database::execute(
            'UPDATE accumul8_notification_rules
             SET trigger_type = ?, days_before_due = ?, target_scope = ?, custom_user_ids_json = ?, email_subject_template = ?, email_body_template = ?, is_active = 1
             WHERE id = ? AND owner_user_id = ?',
            ['upcoming_due', 3, 'group', json_encode([]), $subject, $body, (int)$existing['id'], $viewerId]
        );
        return accumul8_notification_rule_find_by_name($viewerId, $ruleName) ?? $existing;
    }

    Database::execute(
        'INSERT INTO accumul8_notification_rules
            (owner_user_id, rule_name, trigger_type, days_before_due, target_scope, custom_user_ids_json, email_subject_template, email_body_template, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
        [$viewerId, $ruleName, 'upcoming_due', 3, 'group', json_encode([]), $subject, $body]
    );

    return accumul8_notification_rule_find_by_name($viewerId, $ruleName) ?? [
        'id' => (int)Database::lastInsertId(),
        'rule_name' => $ruleName,
        'target_scope' => 'group',
        'custom_user_ids' => [],
    ];
}

function accumul8_aicountant_run_watchlist(int $viewerId, int $actorUserId, bool $sendEmail = false, bool $createNotificationRule = false): array
{
    $payload = accumul8_aicountant_watchlist_payload($viewerId);
    accumul8_message_board_post(
        $viewerId,
        $actorUserId,
        'aicountant_watchlist',
        (int)($payload['cash_tight'] ?? 0) === 1 || (int)($payload['overdue_count'] ?? 0) > 0 ? 'warning' : 'info',
        (string)($payload['summary_title'] ?? 'AIcountant watchlist'),
        (string)($payload['summary_body'] ?? '')
    );

    $notificationRuleId = null;
    if ($createNotificationRule) {
        $rule = accumul8_aicountant_upsert_bill_watch_rule($viewerId);
        $notificationRuleId = (int)($rule['id'] ?? 0);
        accumul8_message_board_post(
            $viewerId,
            $actorUserId,
            'aicountant_watchlist',
            'success',
            'AIcountant reminder rule saved',
            'Saved the "' . (string)($rule['rule_name'] ?? 'AIcountant Bill Watch') . '" notification rule so reminders can be reused from Accumul8.',
            ['notification_rule_id' => $notificationRuleId]
        );
    }

    $emailResult = ['sent_count' => 0, 'failed_count' => 0];
    if ($sendEmail) {
        $emailRule = $notificationRuleId !== null
            ? (accumul8_notification_rule_find_by_name($viewerId, 'AIcountant Bill Watch') ?? ['id' => null, 'target_scope' => 'group', 'custom_user_ids' => []])
            : ['id' => null, 'target_scope' => 'group', 'custom_user_ids' => []];
        $emailResult = accumul8_send_notification_message(
            $viewerId,
            $emailRule,
            (string)($payload['summary_title'] ?? 'AIcountant watchlist'),
            (string)($payload['summary_body'] ?? '')
        );
        accumul8_message_board_post(
            $viewerId,
            $actorUserId,
            'aicountant_watchlist',
            (int)($emailResult['failed_count'] ?? 0) > 0 ? 'warning' : 'success',
            'AIcountant email notification sent',
            'Sent ' . (int)($emailResult['sent_count'] ?? 0) . ' email notification' . ((int)($emailResult['sent_count'] ?? 0) === 1 ? '' : 's')
                . ((int)($emailResult['failed_count'] ?? 0) > 0 ? ' with ' . (int)($emailResult['failed_count'] ?? 0) . ' failure' . ((int)($emailResult['failed_count'] ?? 0) === 1 ? '' : 's') . '.' : '.'),
            $emailResult
        );
    }

    return [
        'summary_title' => (string)($payload['summary_title'] ?? ''),
        'summary_body' => (string)($payload['summary_body'] ?? ''),
        'overdue_count' => (int)($payload['overdue_count'] ?? 0),
        'due_soon_count' => (int)($payload['due_soon_count'] ?? 0),
        'recurring_soon_count' => (int)($payload['recurring_soon_count'] ?? 0),
        'sent_email_count' => (int)($emailResult['sent_count'] ?? 0),
        'failed_email_count' => (int)($emailResult['failed_count'] ?? 0),
        'notification_rule_id' => $notificationRuleId,
        'messages' => accumul8_message_board_list($viewerId),
        'unacknowledged_count' => accumul8_message_board_unacknowledged_count($viewerId),
    ];
}

function accumul8_run_aicountant_housekeeping(int $viewerId, int $actorUserId, array $options = []): array
{
    $sendEmail = !array_key_exists('send_email', $options) || accumul8_normalize_bool($options['send_email']) === 1;
    $createNotificationRule = !array_key_exists('create_notification_rule', $options) || accumul8_normalize_bool($options['create_notification_rule']) === 1;
    $emailOnAttentionOnly = !array_key_exists('email_on_attention_only', $options) || accumul8_normalize_bool($options['email_on_attention_only']) === 1;
    $runEntityMaintenance = !array_key_exists('run_entity_maintenance', $options) || accumul8_normalize_bool($options['run_entity_maintenance']) === 1;

    accumul8_message_board_post(
        $viewerId,
        $actorUserId,
        'aicountant_housekeeping',
        'info',
        'AIcountant housekeeping started',
        'Starting scheduled AIcountant housekeeping: bank sync, opening-balance reconciliation, watchlist review, and reminder upkeep.'
    );

    $balanceResult = accumul8_balance_books($viewerId, $actorUserId);
    $openingBalanceResult = is_array($balanceResult['opening_balance_reconciliation'] ?? null)
        ? $balanceResult['opening_balance_reconciliation']
        : [
            'reconciled_count' => 0,
            'skipped_count' => 0,
            'review_needed_count' => 0,
            'review_needed_accounts' => [],
            'results' => [],
        ];

    $watchlistPreview = accumul8_aicountant_watchlist_payload($viewerId);
    $attentionNeeded = (int)($watchlistPreview['overdue_count'] ?? 0) > 0
        || (int)($watchlistPreview['due_soon_count'] ?? 0) > 0
        || (int)($watchlistPreview['recurring_soon_count'] ?? 0) > 0
        || (int)($watchlistPreview['cash_tight'] ?? 0) === 1;
    $shouldSendEmail = $sendEmail && (!$emailOnAttentionOnly || $attentionNeeded);

    $watchlistResult = accumul8_aicountant_run_watchlist(
        $viewerId,
        $actorUserId,
        $shouldSendEmail,
        $createNotificationRule
    );
    $entityMaintenanceResult = null;
    $canRunEntityMaintenanceAi = accumul8_aicountant_provider_has_credentials('openai')
        || accumul8_aicountant_provider_has_credentials('google_ai_studio')
        || accumul8_aicountant_provider_has_credentials('google_vertex_ai');
    if ($runEntityMaintenance && $canRunEntityMaintenanceAi && accumul8_table_exists('accumul8_entity_aliases')) {
        try {
            $entityMaintenanceResult = accumul8_scan_all_entity_aliases($viewerId);
            $entityMaintenanceTitle = (int)($entityMaintenanceResult['created_count'] ?? 0) + (int)($entityMaintenanceResult['updated_count'] ?? 0) > 0
                ? 'Entity name maintenance updated aliases'
                : 'Entity name maintenance checked aliases';
            accumul8_message_board_post(
                $viewerId,
                $actorUserId,
                'aicountant_entity_maintenance',
                (int)($entityMaintenanceResult['conflict_count'] ?? 0) > 0 ? 'warning' : 'info',
                $entityMaintenanceTitle,
                (string)($entityMaintenanceResult['summary_text'] ?? 'Entity alias scan completed.'),
                $entityMaintenanceResult
            );
        } catch (Throwable $entityMaintenanceError) {
            accumul8_message_board_post(
                $viewerId,
                $actorUserId,
                'aicountant_entity_maintenance',
                'warning',
                'Entity name maintenance skipped',
                accumul8_normalize_text($entityMaintenanceError->getMessage(), 240)
            );
        }
    }

    accumul8_message_board_post(
        $viewerId,
        $actorUserId,
        'aicountant_housekeeping',
        ((int)($balanceResult['error_connection_count'] ?? 0) > 0 || (int)($watchlistResult['overdue_count'] ?? 0) > 0 || (int)($watchlistPreview['cash_tight'] ?? 0) === 1)
            ? 'warning'
            : 'success',
        'AIcountant housekeeping finished',
        'Housekeeping finished with '
            . (int)($balanceResult['synced_connection_count'] ?? 0) . ' bank sync'
            . ((int)($balanceResult['synced_connection_count'] ?? 0) === 1 ? '' : 's')
            . ', ' . (int)($openingBalanceResult['reconciled_count'] ?? 0) . ' opening-balance adjustment'
            . ((int)($openingBalanceResult['reconciled_count'] ?? 0) === 1 ? '' : 's')
            . ', and ' . (int)($watchlistResult['sent_email_count'] ?? 0) . ' email alert'
            . ((int)($watchlistResult['sent_email_count'] ?? 0) === 1 ? '' : 's') . '.',
        [
            'balance_books' => $balanceResult,
            'opening_balance_reconciliation' => $openingBalanceResult,
            'watchlist' => $watchlistResult,
            'entity_maintenance' => $entityMaintenanceResult,
            'attention_needed' => $attentionNeeded ? 1 : 0,
        ]
    );

    return [
        'balance_books' => $balanceResult,
        'opening_balance_reconciliation' => $openingBalanceResult,
        'watchlist' => $watchlistResult,
        'entity_maintenance' => $entityMaintenanceResult,
        'attention_needed' => $attentionNeeded ? 1 : 0,
        'messages' => accumul8_message_board_list($viewerId),
        'unacknowledged_count' => accumul8_message_board_unacknowledged_count($viewerId),
    ];
}

function accumul8_aicountant_effective_ai_config(): array
{
    $cfg = catn8_settings_ai_get_config();
    $preferredProvider = strtolower(trim((string)($cfg['provider'] ?? '')));
    $provider = '';
    foreach ([$preferredProvider, 'openai', 'google_ai_studio', 'google_vertex_ai'] as $candidateProvider) {
        if ($candidateProvider === '' || !in_array($candidateProvider, ['openai', 'google_ai_studio', 'google_vertex_ai'], true)) {
            continue;
        }
        if (accumul8_aicountant_provider_has_credentials($candidateProvider)) {
            $provider = $candidateProvider;
            break;
        }
    }

    if ($provider === '') {
        throw new RuntimeException('No supported AI provider is configured for AIcountant');
    }

    $model = trim((string)($cfg['model'] ?? ''));
    if ($model === '') {
        $model = $provider === 'openai' ? 'gpt-4o-mini' : 'gemini-1.5-pro';
    }

    $temperature = (float)($cfg['temperature'] ?? 0.2);
    if (!is_finite($temperature)) {
        $temperature = 0.2;
    }
    if ($temperature < 0) {
        $temperature = 0;
    }
    if ($temperature > 1.2) {
        $temperature = 1.2;
    }

    return [
        'provider' => $provider,
        'model' => $model,
        'base_url' => trim((string)($cfg['base_url'] ?? '')),
        'location' => trim((string)($cfg['location'] ?? '')),
        'temperature' => $temperature,
    ];
}

function accumul8_aicountant_build_financial_context(int $viewerId): array
{
    $accounts = array_map(static function (array $row): array {
        return [
            'id' => (int)($row['id'] ?? 0),
            'account_name' => (string)($row['account_name'] ?? ''),
            'institution_name' => (string)($row['institution_name'] ?? ''),
            'account_type' => (string)($row['account_type'] ?? ''),
            'current_balance' => round((float)($row['current_balance'] ?? 0), 2),
            'available_balance' => round((float)($row['available_balance'] ?? 0), 2),
            'credit_limit' => round((float)($row['credit_limit'] ?? 0), 2),
            'interest_rate' => round((float)($row['interest_rate'] ?? 0), 4),
            'minimum_payment' => round((float)($row['minimum_payment'] ?? 0), 2),
            'payment_due_day_of_month' => isset($row['payment_due_day_of_month']) ? (int)$row['payment_due_day_of_month'] : null,
            'autopay_enabled' => (int)($row['autopay_enabled'] ?? 0),
        ];
    }, Database::queryAll(
        "SELECT id, account_name, institution_name, account_type, current_balance, available_balance,
                credit_limit, interest_rate, minimum_payment, payment_due_day_of_month, autopay_enabled
         FROM accumul8_accounts
         WHERE owner_user_id = ? AND is_active = 1
         ORDER BY institution_name ASC, account_name ASC",
        [$viewerId]
    ));

    $monthlySummary = array_map(static function (array $row): array {
        return [
            'month' => (string)($row['month_key'] ?? ''),
            'inflow_total' => round((float)($row['inflow_total'] ?? 0), 2),
            'outflow_total' => round((float)($row['outflow_total'] ?? 0), 2),
            'net_total' => round((float)($row['net_total'] ?? 0), 2),
        ];
    }, Database::queryAll(
        "SELECT DATE_FORMAT(transaction_date, '%Y-%m') AS month_key,
                SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS inflow_total,
                SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS outflow_total,
                SUM(amount) AS net_total
         FROM accumul8_transactions
         WHERE owner_user_id = ?
           AND transaction_date >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
         GROUP BY DATE_FORMAT(transaction_date, '%Y-%m')
         ORDER BY month_key DESC
         LIMIT 6",
        [$viewerId]
    ));

    $recentTransactions = array_map(static function (array $row): array {
        return [
            'id' => (int)($row['id'] ?? 0),
            'transaction_date' => (string)($row['transaction_date'] ?? ''),
            'due_date' => (string)($row['due_date'] ?? ''),
            'paid_date' => (string)($row['paid_date'] ?? ''),
            'description' => (string)($row['description'] ?? ''),
            'memo' => accumul8_filter_note_for_display((string)($row['memo'] ?? ''), 300),
            'amount' => round((float)($row['amount'] ?? 0), 2),
            'is_paid' => (int)($row['is_paid'] ?? 0),
            'is_reconciled' => (int)($row['is_reconciled'] ?? 0),
            'account_id' => isset($row['account_id']) ? (int)$row['account_id'] : null,
            'entity_id' => isset($row['entity_id']) ? (int)$row['entity_id'] : null,
            'account_name' => (string)($row['account_name'] ?? ''),
            'entity_name' => (string)($row['entity_name'] ?? ''),
            'source_kind' => (string)($row['source_kind'] ?? ''),
        ];
    }, Database::queryAll(
        "SELECT t.id, t.account_id, t.entity_id, t.transaction_date, t.due_date, t.paid_date, t.description, t.memo, t.amount, t.is_paid, t.is_reconciled,
                t.source_kind, COALESCE(a.account_name, '') AS account_name, COALESCE(e.display_name, '') AS entity_name
         FROM accumul8_transactions t
         LEFT JOIN accumul8_accounts a ON a.id = t.account_id
         LEFT JOIN accumul8_entities e ON e.id = t.entity_id
         WHERE t.owner_user_id = ?
         ORDER BY t.transaction_date DESC, t.id DESC
         LIMIT 120",
        [$viewerId]
    ));

    $upcomingBills = array_map(static function (array $row): array {
        return [
            'id' => (int)($row['id'] ?? 0),
            'title' => (string)($row['title'] ?? ''),
            'amount' => round((float)($row['amount'] ?? 0), 2),
            'next_due_date' => (string)($row['next_due_date'] ?? ''),
            'payment_method' => (string)($row['payment_method'] ?? ''),
            'frequency' => (string)($row['frequency'] ?? ''),
            'account_id' => isset($row['account_id']) ? (int)$row['account_id'] : null,
            'entity_id' => isset($row['entity_id']) ? (int)$row['entity_id'] : null,
            'is_active' => (int)($row['is_active'] ?? 0),
            'account_name' => (string)($row['account_name'] ?? ''),
        ];
    }, Database::queryAll(
        "SELECT rp.id, rp.title, rp.amount, rp.next_due_date, rp.payment_method, rp.frequency, rp.account_id, rp.entity_id, rp.is_active, COALESCE(a.account_name, '') AS account_name
         FROM accumul8_recurring_payments rp
         LEFT JOIN accumul8_accounts a ON a.id = rp.account_id
         WHERE rp.owner_user_id = ?
         ORDER BY rp.next_due_date ASC, rp.id ASC
         LIMIT 40",
        [$viewerId]
    ));

    $budgetRows = array_map(static function (array $row): array {
        return [
            'id' => (int)($row['id'] ?? 0),
            'category_name' => (string)($row['category_name'] ?? ''),
            'monthly_budget' => round((float)($row['monthly_budget'] ?? 0), 2),
            'match_pattern' => (string)($row['match_pattern'] ?? ''),
        ];
    }, Database::queryAll(
        "SELECT id, category_name, monthly_budget, match_pattern
         FROM accumul8_budget_rows
         WHERE owner_user_id = ?
           AND is_active = 1
         ORDER BY row_order ASC, id ASC",
        [$viewerId]
    ));

    $entities = array_map(static function (array $row): array {
        return [
            'id' => (int)($row['id'] ?? 0),
            'display_name' => (string)($row['display_name'] ?? ''),
            'entity_kind' => (string)($row['entity_kind'] ?? ''),
            'contact_type' => (string)($row['contact_type'] ?? ''),
            'is_active' => (int)($row['is_active'] ?? 0),
        ];
    }, Database::queryAll(
        "SELECT id, display_name, entity_kind, contact_type, is_active
         FROM accumul8_entities
         WHERE owner_user_id = ?
         ORDER BY is_active DESC, display_name ASC
         LIMIT 250",
        [$viewerId]
    ));

    $topOutflows = array_map(static function (array $row): array {
        return [
            'label' => (string)($row['label'] ?? ''),
            'transaction_count' => (int)($row['transaction_count'] ?? 0),
            'outflow_total' => round((float)($row['outflow_total'] ?? 0), 2),
        ];
    }, Database::queryAll(
        "SELECT COALESCE(NULLIF(TRIM(e.display_name), ''), NULLIF(TRIM(t.description), ''), 'Unlabeled') AS label,
                COUNT(*) AS transaction_count,
                SUM(ABS(t.amount)) AS outflow_total
         FROM accumul8_transactions t
         LEFT JOIN accumul8_entities e ON e.id = t.entity_id
         WHERE t.owner_user_id = ?
           AND t.amount < 0
           AND t.transaction_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
         GROUP BY label
         ORDER BY outflow_total DESC
         LIMIT 20",
        [$viewerId]
    ));

    $attentionItems = array_map(static function (array $row): array {
        return [
            'transaction_date' => (string)($row['transaction_date'] ?? ''),
            'due_date' => (string)($row['due_date'] ?? ''),
            'description' => (string)($row['description'] ?? ''),
            'amount' => round((float)($row['amount'] ?? 0), 2),
            'account_name' => (string)($row['account_name'] ?? ''),
            'is_paid' => (int)($row['is_paid'] ?? 0),
            'is_reconciled' => (int)($row['is_reconciled'] ?? 0),
        ];
    }, Database::queryAll(
        "SELECT t.transaction_date, t.due_date, t.description, t.amount, t.is_paid, t.is_reconciled,
                COALESCE(a.account_name, '') AS account_name
         FROM accumul8_transactions t
         LEFT JOIN accumul8_accounts a ON a.id = t.account_id
         WHERE t.owner_user_id = ?
           AND (
                (t.amount < 0 AND t.is_paid = 0 AND t.due_date IS NOT NULL AND t.due_date <= DATE_ADD(CURDATE(), INTERVAL 14 DAY))
                OR t.is_reconciled = 0
           )
         ORDER BY
           CASE
             WHEN t.amount < 0 AND t.is_paid = 0 AND t.due_date IS NOT NULL THEN 0
             ELSE 1
           END,
           t.due_date ASC,
           t.transaction_date DESC,
           t.id DESC
         LIMIT 40",
        [$viewerId]
    ));

    $summary = Database::queryOne(
        "SELECT
            COUNT(*) AS transaction_count,
            SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS inflow_total,
            SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS outflow_total,
            SUM(CASE WHEN amount < 0 AND is_paid = 0 THEN ABS(amount) ELSE 0 END) AS unpaid_outflow_total,
            SUM(CASE WHEN is_reconciled = 0 THEN 1 ELSE 0 END) AS unreconciled_count
         FROM accumul8_transactions
         WHERE owner_user_id = ?",
        [$viewerId]
    ) ?: [];

    return [
        'generated_at' => gmdate('c'),
        'summary' => [
            'transaction_count' => (int)($summary['transaction_count'] ?? 0),
            'inflow_total' => round((float)($summary['inflow_total'] ?? 0), 2),
            'outflow_total' => round((float)($summary['outflow_total'] ?? 0), 2),
            'unpaid_outflow_total' => round((float)($summary['unpaid_outflow_total'] ?? 0), 2),
            'unreconciled_count' => (int)($summary['unreconciled_count'] ?? 0),
            'account_count' => count($accounts),
            'active_recurring_count' => count(array_filter($upcomingBills, static fn(array $row): bool => (int)($row['is_active'] ?? 0) === 1)),
            'budget_row_count' => count($budgetRows),
        ],
        'accounts' => $accounts,
        'entities' => $entities,
        'monthly_summary' => $monthlySummary,
        'top_outflows_last_90_days' => $topOutflows,
        'upcoming_recurring_bills' => $upcomingBills,
        'budget_rows' => $budgetRows,
        'attention_items' => $attentionItems,
        'recent_transactions' => $recentTransactions,
    ];
}

function accumul8_aicountant_map_conversation_row(array $row): array
{
    return [
        'id' => (int)($row['id'] ?? 0),
        'owner_user_id' => (int)($row['owner_user_id'] ?? 0),
        'title' => (string)($row['title'] ?? ''),
        'system_prompt' => (string)($row['system_prompt'] ?? ''),
        'status' => (string)($row['status'] ?? 'active'),
        'conversation_summary' => (string)($row['conversation_summary'] ?? ''),
        'last_message_preview' => (string)($row['last_message_preview'] ?? ''),
        'message_count' => (int)($row['message_count'] ?? 0),
        'created_at' => (string)($row['created_at'] ?? ''),
        'updated_at' => (string)($row['updated_at'] ?? ''),
    ];
}

function accumul8_aicountant_map_message_row(array $row): array
{
    return [
        'id' => (int)($row['id'] ?? 0),
        'conversation_id' => (int)($row['conversation_id'] ?? 0),
        'owner_user_id' => (int)($row['owner_user_id'] ?? 0),
        'role' => accumul8_aicountant_message_role($row['role'] ?? 'user'),
        'content_text' => (string)($row['content_text'] ?? ''),
        'provider' => (string)($row['provider'] ?? ''),
        'model' => (string)($row['model'] ?? ''),
        'meta' => accumul8_aicountant_decode_json_object($row['meta_json'] ?? '{}'),
        'created_at' => (string)($row['created_at'] ?? ''),
    ];
}

function accumul8_aicountant_require_conversation(int $viewerId, int $conversationId): array
{
    $row = Database::queryOne(
        "SELECT c.*,
                (SELECT COUNT(*) FROM accumul8_ai_conversation_events e WHERE e.conversation_id = c.id) AS message_count
         FROM accumul8_ai_conversations c
         WHERE c.id = ? AND c.owner_user_id = ?
         LIMIT 1",
        [$conversationId, $viewerId]
    );
    if (!$row) {
        catn8_json_response(['success' => false, 'error' => 'Conversation not found'], 404);
    }
    return $row;
}

function accumul8_aicountant_list_conversations(int $viewerId): array
{
    $rows = Database::queryAll(
        "SELECT c.*,
                (SELECT COUNT(*) FROM accumul8_ai_conversation_events e WHERE e.conversation_id = c.id) AS message_count
         FROM accumul8_ai_conversations c
         WHERE c.owner_user_id = ?
           AND c.status <> 'deleted'
         ORDER BY c.updated_at DESC, c.id DESC",
        [$viewerId]
    );

    return array_map('accumul8_aicountant_map_conversation_row', $rows);
}

function accumul8_aicountant_list_messages(int $viewerId, int $conversationId, int $limit = 400): array
{
    $limit = max(1, min(400, $limit));
    $rows = Database::queryAll(
        "SELECT id, conversation_id, owner_user_id, role, content_text, provider, model, meta_json, created_at
         FROM accumul8_ai_conversation_events
         WHERE owner_user_id = ?
           AND conversation_id = ?
         ORDER BY id ASC
         LIMIT ?",
        [$viewerId, $conversationId, $limit]
    );

    return array_map('accumul8_aicountant_map_message_row', $rows);
}

function accumul8_aicountant_create_conversation(int $viewerId, string $title = '', string $systemPrompt = ''): int
{
    $normalizedTitle = accumul8_aicountant_normalize_title($title, 191);
    if ($normalizedTitle === '') {
        $normalizedTitle = 'AIcountant Chat ' . date('M j, Y');
    }
    $normalizedSystemPrompt = trim($systemPrompt) !== '' ? trim($systemPrompt) : accumul8_aicountant_default_system_prompt();

    Database::execute(
        "INSERT INTO accumul8_ai_conversations
            (owner_user_id, title, system_prompt, status, conversation_summary, last_message_preview)
         VALUES (?, ?, ?, 'active', '', '')",
        [$viewerId, $normalizedTitle, $normalizedSystemPrompt]
    );

    $row = Database::queryOne(
        "SELECT id
         FROM accumul8_ai_conversations
         WHERE owner_user_id = ?
         ORDER BY id DESC
         LIMIT 1",
        [$viewerId]
    );

    return (int)($row['id'] ?? 0);
}

function accumul8_aicountant_append_message(
    int $viewerId,
    int $conversationId,
    string $role,
    string $content,
    string $provider = '',
    string $model = '',
    array $meta = []
): int {
    $normalizedRole = accumul8_aicountant_message_role($role);
    $normalizedContent = trim((string)$content);
    if ($normalizedContent === '') {
        throw new RuntimeException('Cannot save an empty AIcountant message');
    }

    $metaJson = json_encode($meta, JSON_UNESCAPED_SLASHES);
    if (!is_string($metaJson)) {
        $metaJson = json_encode(new stdClass(), JSON_UNESCAPED_SLASHES);
    }

    Database::execute(
        "INSERT INTO accumul8_ai_conversation_events
            (conversation_id, owner_user_id, role, content_text, provider, model, meta_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        [$conversationId, $viewerId, $normalizedRole, $normalizedContent, $provider, $model, $metaJson]
    );

    $preview = accumul8_normalize_text($normalizedContent, 255);
    Database::execute(
        "UPDATE accumul8_ai_conversations
         SET last_message_preview = ?, updated_at = NOW()
         WHERE id = ? AND owner_user_id = ?",
        [$preview, $conversationId, $viewerId]
    );

    $row = Database::queryOne(
        "SELECT id
         FROM accumul8_ai_conversation_events
         WHERE conversation_id = ?
         ORDER BY id DESC
         LIMIT 1",
        [$conversationId]
    );

    return (int)($row['id'] ?? 0);
}

function accumul8_aicountant_recent_transcript(int $viewerId, int $conversationId, int $limit = 24): array
{
    $limit = max(1, min(60, $limit));
    $rows = Database::queryAll(
        "SELECT id, conversation_id, owner_user_id, role, content_text, provider, model, meta_json, created_at
         FROM (
            SELECT id, conversation_id, owner_user_id, role, content_text, provider, model, meta_json, created_at
            FROM accumul8_ai_conversation_events
            WHERE owner_user_id = ?
              AND conversation_id = ?
            ORDER BY id DESC
            LIMIT ?
         ) recent_events
         ORDER BY id ASC",
        [$viewerId, $conversationId, $limit]
    );

    return array_map('accumul8_aicountant_map_message_row', $rows);
}

function accumul8_aicountant_action_summary_lines(array $results): array
{
    $lines = [];
    foreach ($results as $result) {
        if (!is_array($result)) {
            continue;
        }
        $status = (string)($result['status'] ?? '');
        $type = (string)($result['type'] ?? 'action');
        $summary = accumul8_normalize_text((string)($result['summary'] ?? ''), 240);
        $lines[] = strtoupper($status !== '' ? $status : 'info') . ': ' . $type . ($summary !== '' ? ' - ' . $summary : '');
    }
    return $lines;
}

function accumul8_aicountant_extract_actions(int $viewerId, string $userMessage): array
{
    $trimmedMessage = trim($userMessage);
    if ($trimmedMessage === '') {
        return [];
    }

    if (!preg_match('/\b(rename|update|change|modify|edit|fix|correct|mark|set|balance|reconcile|recategorize|assign|match|delete|remove|clear|deactivate|activate|sync|synchronize|refresh|download)\b/i', $trimmedMessage)) {
        return [];
    }

    $aiConfig = accumul8_aicountant_effective_ai_config();
    $context = accumul8_aicountant_build_financial_context($viewerId);
    $systemPrompt = <<<PROMPT
You extract bookkeeping actions from a household-finance request.

Return JSON only in this shape:
{"actions":[
  {"type":"rename_entity","entity_id":123,"new_display_name":"..."},
  {"type":"update_recurring_rule","recurring_id":55,"title":"...","amount":100.00,"frequency":"monthly","payment_method":"autopay","next_due_date":"2026-03-20","is_active":1,"account_id":12,"entity_id":8,"notes":"..."},
  {"type":"delete_recurring_rule","recurring_id":55},
  {"type":"update_transaction","transaction_id":999,"transaction_date":"2026-03-13","due_date":"2026-03-20","paid_date":"2026-03-13","entry_type":"bill","description":"...","memo":"...","amount":-452.37,"rta_amount":0,"is_paid":1,"is_reconciled":1,"is_budget_planner":0,"entity_id":8,"account_id":12,"balance_entity_id":0,"debtor_id":0},
  {"type":"update_transaction_entity","transaction_id":999,"entity_id":8},
  {"type":"mark_transaction_paid","transaction_id":999,"is_paid":1,"paid_date":"2026-03-13"},
  {"type":"mark_transaction_reconciled","transaction_id":999,"is_reconciled":1},
  {"type":"delete_transaction","transaction_id":999},
  {"type":"update_account_balance","account_id":12,"current_balance":1234.56,"available_balance":1200.00},
  {"type":"balance_books"},
  {"type":"reconcile_opening_balances"},
  {"type":"run_watchlist","send_email":1,"create_notification_rule":1},
  {"type":"run_housekeeping","send_email":1,"create_notification_rule":1,"email_on_attention_only":1}
]}

Rules:
- Use only the supported action types shown above.
- Include an action only when the user clearly asked for a real data change.
- Use {"type":"delete_recurring_rule"} only when the user clearly asked to delete, remove, or stop a specific recurring payment and the target id is unambiguous.
- Use {"type":"update_transaction"} when the user clearly asks to fix or edit a specific ledger row and the needed target id/value is available in the snapshot.
- Use {"type":"delete_transaction"} only when the user clearly asked to delete, remove, or clear a specific ledger row and the target id is unambiguous.
- Use {"type":"balance_books"} when the user asks you to balance the books, sync connected banks, refresh downloaded bank records, or reconcile balances against the latest bank data.
- Use {"type":"reconcile_opening_balances"} when the user asks you to fix, infer, or correct opening balances so the ledger matches the bank.
- Use {"type":"run_watchlist"} when the user asks for proactive monitoring, future-spending watchouts, bill reminders, email alerts, or notification-rule setup. Set send_email to 1 only if the user asked for email. Set create_notification_rule to 1 only if the user asked to save or set up reminders.
- Use {"type":"run_housekeeping"} when the user asks for a full finance housekeeping pass that should sync accounts, reconcile balances, review bills, and send alerts if needed.
- Use IDs from the provided snapshot only. If the request is ambiguous, return no action for that item.
- Never invent IDs or values.
- If no changes should be applied, return {"actions":[]}.
PROMPT;
    $userPrompt = "Available finance snapshot (JSON):\n"
        . json_encode($context, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        . "\n\nUser request:\n"
        . $trimmedMessage;

    $provider = (string)($aiConfig['provider'] ?? 'openai');
    $model = (string)($aiConfig['model'] ?? '');
    $temperature = 0.0;
    $json = [];

    if ($provider === 'google_vertex_ai') {
        $saJson = secret_get(catn8_settings_ai_secret_key($provider, 'service_account_json'));
        if (!is_string($saJson) || trim($saJson) === '') {
            return [];
        }
        $sa = json_decode((string)$saJson, true);
        if (!is_array($sa)) {
            return [];
        }
        $content = catn8_vertex_ai_gemini_generate_text([
            'service_account_json' => $saJson,
            'project_id' => trim((string)($sa['project_id'] ?? '')),
            'location' => trim((string)($aiConfig['location'] ?? '')) !== '' ? (string)$aiConfig['location'] : 'us-central1',
            'model' => $model !== '' ? $model : 'gemini-1.5-pro',
            'system_prompt' => $systemPrompt,
            'user_prompt' => $userPrompt,
            'temperature' => $temperature,
            'max_output_tokens' => 2048,
        ]);
        $json = json_decode(accumul8_extract_json_from_text((string)$content), true);
    } elseif ($provider === 'google_ai_studio') {
        $apiKey = secret_get(catn8_settings_ai_secret_key($provider, 'api_key'));
        if (!is_string($apiKey) || trim($apiKey) === '') {
            return [];
        }
        $resolvedModel = $model !== '' ? $model : 'gemini-1.5-pro';
        $resp = catn8_http_json_with_status(
            'POST',
            'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($resolvedModel) . ':generateContent',
            ['x-goog-api-key' => trim($apiKey)],
            [
                'contents' => [['role' => 'user', 'parts' => [['text' => $userPrompt]]]],
                'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
                'generationConfig' => ['temperature' => $temperature],
            ],
            10,
            45
        );
        $content = (string)($resp['json']['candidates'][0]['content']['parts'][0]['text'] ?? '');
        $json = json_decode(accumul8_extract_json_from_text($content), true);
    } else {
        $resolvedModel = $model !== '' ? $model : 'gpt-4o-mini';
        $result = accumul8_openai_responses_json(
            $resolvedModel,
            [[
                'role' => 'system',
                'content' => [
                    ['type' => 'input_text', 'text' => $systemPrompt],
                ],
            ], [
                'role' => 'user',
                'content' => [
                    ['type' => 'input_text', 'text' => $userPrompt],
                ],
            ]],
            (string)($aiConfig['base_url'] ?? ''),
            $temperature,
            2048,
            [
                'format' => [
                    'type' => 'json_object',
                ],
            ]
        );
        $json = is_array($result['json'] ?? null) ? $result['json'] : [];
    }

    $actions = is_array($json['actions'] ?? null) ? $json['actions'] : [];
    return array_values(array_filter($actions, static fn($action): bool => is_array($action) && trim((string)($action['type'] ?? '')) !== ''));
}

function accumul8_aicountant_apply_actions(int $viewerId, int $actorUserId, array $actions): array
{
    $results = [];
    foreach (array_slice($actions, 0, 12) as $action) {
        $type = strtolower(accumul8_normalize_text((string)($action['type'] ?? ''), 64));
        if ($type === '') {
            continue;
        }

        try {
            if ($type === 'rename_entity') {
                $entityId = (int)($action['entity_id'] ?? 0);
                $newDisplayName = accumul8_normalize_text($action['new_display_name'] ?? '', 191);
                $existing = Database::queryOne('SELECT * FROM accumul8_entities WHERE id = ? AND owner_user_id = ? LIMIT 1', [$entityId, $viewerId]);
                if (!$existing || $newDisplayName === '') {
                    throw new RuntimeException('Entity rename request was missing a valid target or name');
                }
                accumul8_upsert_entity($viewerId, [
                    'display_name' => $newDisplayName,
                    'entity_kind' => (string)($existing['entity_kind'] ?? 'business'),
                    'contact_type' => (string)($existing['contact_type'] ?? 'payee'),
                    'is_payee' => (int)($existing['is_payee'] ?? 0),
                    'is_payer' => (int)($existing['is_payer'] ?? 0),
                    'is_vendor' => (int)($existing['is_vendor'] ?? 0),
                    'is_balance_person' => (int)($existing['is_balance_person'] ?? 0),
                    'default_amount' => accumul8_normalize_amount($existing['default_amount'] ?? 0),
                    'email' => (string)($existing['email'] ?? ''),
                    'phone_number' => (string)($existing['phone_number'] ?? ''),
                    'street_address' => (string)($existing['street_address'] ?? ''),
                    'city' => (string)($existing['city'] ?? ''),
                    'state' => (string)($existing['state'] ?? ''),
                    'zip' => (string)($existing['zip'] ?? ''),
                    'notes' => (string)($existing['notes'] ?? ''),
                    'is_active' => (int)($existing['is_active'] ?? 1),
                ], $entityId);
                accumul8_sync_contact_from_entity($viewerId, $entityId);
                accumul8_sync_debtor_from_entity($viewerId, $entityId);
                $results[] = ['type' => $type, 'status' => 'applied', 'summary' => 'Renamed entity #' . $entityId . ' to "' . $newDisplayName . '".'];
                continue;
            }

            if ($type === 'update_recurring_rule') {
                $recurringId = (int)($action['recurring_id'] ?? 0);
                $existing = Database::queryOne('SELECT * FROM accumul8_recurring_payments WHERE id = ? AND owner_user_id = ? LIMIT 1', [$recurringId, $viewerId]);
                if (!$existing) {
                    throw new RuntimeException('Recurring rule not found');
                }
                $title = accumul8_normalize_text($action['title'] ?? (string)($existing['title'] ?? ''), 191);
                if ($title === '') {
                    throw new RuntimeException('Recurring rule title is required');
                }
                $direction = accumul8_validate_enum('direction', $action['direction'] ?? ($existing['direction'] ?? 'outflow'), ['outflow', 'inflow'], 'outflow');
                $frequency = accumul8_validate_enum('frequency', $action['frequency'] ?? ($existing['frequency'] ?? 'monthly'), ['daily', 'weekly', 'biweekly', 'monthly'], 'monthly');
                $paymentMethod = accumul8_validate_enum('payment_method', $action['payment_method'] ?? ($existing['payment_method'] ?? 'unspecified'), ['unspecified', 'autopay', 'manual'], 'unspecified');
                $amount = array_key_exists('amount', $action) ? accumul8_normalize_amount($action['amount']) : accumul8_normalize_amount($existing['amount'] ?? 0);
                $intervalCount = array_key_exists('interval_count', $action) ? max(1, min(365, (int)$action['interval_count'])) : max(1, min(365, (int)($existing['interval_count'] ?? 1)));
                $nextDue = array_key_exists('next_due_date', $action)
                    ? accumul8_require_valid_date('next_due_date', $action['next_due_date'])
                    : accumul8_require_valid_date('next_due_date', $existing['next_due_date'] ?? '');
                $paidDate = array_key_exists('paid_date', $action) ? accumul8_normalize_date($action['paid_date'] ?? null) : accumul8_normalize_date($existing['paid_date'] ?? null);
                $notes = array_key_exists('notes', $action) ? accumul8_normalize_text($action['notes'] ?? '', 1500) : accumul8_normalize_text($existing['notes'] ?? '', 1500);
                $isBudgetPlanner = array_key_exists('is_budget_planner', $action) ? accumul8_normalize_bool($action['is_budget_planner']) : (int)($existing['is_budget_planner'] ?? 1);
                $isActive = array_key_exists('is_active', $action) ? accumul8_normalize_bool($action['is_active']) : (int)($existing['is_active'] ?? 1);
                $dayOfMonth = array_key_exists('day_of_month', $action) ? ((string)$action['day_of_month'] !== '' ? (int)$action['day_of_month'] : null) : (isset($existing['day_of_month']) ? (int)$existing['day_of_month'] : null);
                $dayOfWeek = array_key_exists('day_of_week', $action) ? ((string)$action['day_of_week'] !== '' ? (int)$action['day_of_week'] : null) : (isset($existing['day_of_week']) ? (int)$existing['day_of_week'] : null);
                $entityId = array_key_exists('entity_id', $action) ? accumul8_owned_id_or_null('entities', $viewerId, (int)($action['entity_id'] ?? 0)) : accumul8_owned_id_or_null('entities', $viewerId, (int)($existing['entity_id'] ?? 0));
                $accountId = array_key_exists('account_id', $action) ? accumul8_owned_id_or_null('accounts', $viewerId, (int)($action['account_id'] ?? 0)) : accumul8_owned_id_or_null('accounts', $viewerId, (int)($existing['account_id'] ?? 0));
                $contactId = $entityId !== null ? accumul8_entity_contact_id_or_null($viewerId, $entityId) : accumul8_owned_id_or_null('contacts', $viewerId, (int)($existing['contact_id'] ?? 0));

                Database::execute(
                    'UPDATE accumul8_recurring_payments
                     SET entity_id = ?, contact_id = ?, account_id = ?, title = ?, direction = ?, amount = ?, frequency = ?, payment_method = ?, interval_count = ?,
                         day_of_month = ?, day_of_week = ?, next_due_date = ?, paid_date = ?, notes = ?, is_active = ?, is_budget_planner = ?
                     WHERE id = ? AND owner_user_id = ?',
                    [
                        $entityId,
                        $contactId,
                        $accountId,
                        $title,
                        $direction,
                        $amount,
                        $frequency,
                        $paymentMethod,
                        $intervalCount,
                        $dayOfMonth,
                        $dayOfWeek,
                        $nextDue,
                        $paidDate,
                        $notes === '' ? null : $notes,
                        $isActive,
                        $isBudgetPlanner,
                        $recurringId,
                        $viewerId,
                    ]
                );
                $syncedLinkedRows = accumul8_sync_open_recurring_transactions_from_template($viewerId, $recurringId, $existing, [
                    'entity_id' => $entityId,
                    'contact_id' => $contactId,
                    'account_id' => $accountId,
                    'title' => $title,
                    'direction' => $direction,
                    'amount' => $amount,
                    'next_due_date' => $nextDue,
                    'paid_date' => $paidDate,
                    'notes' => $notes,
                    'is_budget_planner' => $isBudgetPlanner,
                ]);
                if ($syncedLinkedRows > 0) {
                    accumul8_recompute_running_balance($viewerId);
                }
                $results[] = ['type' => $type, 'status' => 'applied', 'summary' => 'Updated recurring rule #' . $recurringId . ' (' . $title . ').'];
                continue;
            }

            if ($type === 'delete_recurring_rule') {
                $recurringId = (int)($action['recurring_id'] ?? 0);
                $existing = Database::queryOne('SELECT id, title FROM accumul8_recurring_payments WHERE id = ? AND owner_user_id = ? LIMIT 1', [$recurringId, $viewerId]);
                if (!$existing) {
                    throw new RuntimeException('Recurring rule not found');
                }

                Database::execute('DELETE FROM accumul8_recurring_payments WHERE id = ? AND owner_user_id = ?', [$recurringId, $viewerId]);
                $results[] = [
                    'type' => $type,
                    'status' => 'applied',
                    'summary' => 'Deleted recurring rule #' . $recurringId . ' (' . accumul8_normalize_text($existing['title'] ?? 'Untitled recurring payment', 191) . ').',
                ];
                continue;
            }

            if ($type === 'update_transaction_entity') {
                $transactionId = (int)($action['transaction_id'] ?? 0);
                $entityId = accumul8_owned_id_or_null('entities', $viewerId, (int)($action['entity_id'] ?? 0));
                $existingTx = accumul8_get_transaction_row($viewerId, $transactionId);
                if (!$existingTx || $entityId === null) {
                    throw new RuntimeException('Transaction entity update was missing a valid transaction or entity');
                }
                $contactId = accumul8_entity_contact_id_or_null($viewerId, $entityId);
                Database::execute(
                    'UPDATE accumul8_transactions
                     SET entity_id = ?, contact_id = ?
                     WHERE id = ? AND owner_user_id = ?',
                    [$entityId, $contactId, $transactionId, $viewerId]
                );
                $results[] = ['type' => $type, 'status' => 'applied', 'summary' => 'Assigned entity #' . $entityId . ' to transaction #' . $transactionId . '.'];
                continue;
            }

            if ($type === 'update_transaction') {
                $transactionId = (int)($action['transaction_id'] ?? 0);
                $existingTx = accumul8_get_transaction_row($viewerId, $transactionId);
                if (!$existingTx) {
                    throw new RuntimeException('Transaction not found');
                }

                $editPolicy = accumul8_transaction_edit_policy($existingTx);
                $transactionDate = array_key_exists('transaction_date', $action)
                    ? accumul8_require_valid_date('transaction_date', $action['transaction_date'])
                    : accumul8_require_valid_date('transaction_date', $existingTx['transaction_date'] ?? '');
                $dueDate = array_key_exists('due_date', $action)
                    ? accumul8_normalize_date($action['due_date'] ?? null)
                    : accumul8_normalize_date($existingTx['due_date'] ?? null);
                $paidDate = array_key_exists('paid_date', $action)
                    ? accumul8_normalize_date($action['paid_date'] ?? null)
                    : accumul8_normalize_date($existingTx['paid_date'] ?? null);
                $entryType = array_key_exists('entry_type', $action)
                    ? accumul8_validate_enum('entry_type', $action['entry_type'] ?? 'manual', ['manual', 'auto', 'transfer', 'deposit', 'bill'], 'manual')
                    : accumul8_validate_enum('entry_type', $existingTx['entry_type'] ?? 'manual', ['manual', 'auto', 'transfer', 'deposit', 'bill'], 'manual');
                $description = array_key_exists('description', $action)
                    ? accumul8_normalize_text($action['description'] ?? '', 255)
                    : accumul8_normalize_text($existingTx['description'] ?? '', 255);
                $memo = array_key_exists('memo', $action)
                    ? accumul8_normalize_text($action['memo'] ?? '', 5000)
                    : accumul8_normalize_text($existingTx['memo'] ?? '', 5000);
                $amount = array_key_exists('amount', $action)
                    ? accumul8_normalize_amount($action['amount'] ?? 0)
                    : accumul8_normalize_amount($existingTx['amount'] ?? 0);
                $rtaAmount = array_key_exists('rta_amount', $action)
                    ? accumul8_normalize_amount($action['rta_amount'] ?? 0)
                    : accumul8_normalize_amount($existingTx['rta_amount'] ?? 0);
                $isPaid = array_key_exists('is_paid', $action)
                    ? accumul8_normalize_bool($action['is_paid'] ?? 0)
                    : accumul8_normalize_bool($existingTx['is_paid'] ?? 0);
                $isReconciled = array_key_exists('is_reconciled', $action)
                    ? accumul8_normalize_bool($action['is_reconciled'] ?? 0)
                    : accumul8_normalize_bool($existingTx['is_reconciled'] ?? 0);
                $isBudgetPlanner = array_key_exists('is_budget_planner', $action)
                    ? accumul8_normalize_bool($action['is_budget_planner'] ?? 0)
                    : accumul8_normalize_bool($existingTx['is_budget_planner'] ?? 0);
                $accountId = array_key_exists('account_id', $action)
                    ? accumul8_owned_id_or_null('accounts', $viewerId, (int)($action['account_id'] ?? 0))
                    : accumul8_owned_id_or_null('accounts', $viewerId, (int)($existingTx['account_id'] ?? 0));
                $entityId = array_key_exists('entity_id', $action)
                    ? accumul8_owned_id_or_null('entities', $viewerId, (int)($action['entity_id'] ?? 0))
                    : accumul8_owned_id_or_null('entities', $viewerId, (int)($existingTx['entity_id'] ?? 0));

                if ($description === '') {
                    throw new RuntimeException('Transaction description is required');
                }

                $existingTransactionDate = accumul8_normalize_date($existingTx['transaction_date'] ?? null);
                $existingDueDate = accumul8_normalize_date($existingTx['due_date'] ?? null);
                $existingEntryType = accumul8_validate_enum('entry_type', $existingTx['entry_type'] ?? 'manual', ['manual', 'auto', 'transfer', 'deposit', 'bill'], 'manual');
                $existingDescription = accumul8_normalize_text($existingTx['description'] ?? '', 255);
                $existingAmount = accumul8_normalize_amount($existingTx['amount'] ?? 0);
                $existingRtaAmount = accumul8_normalize_amount($existingTx['rta_amount'] ?? 0);
                $existingAccountId = accumul8_owned_id_or_null('accounts', $viewerId, (int)($existingTx['account_id'] ?? 0));
                $coreChanged = $transactionDate !== $existingTransactionDate
                    || $dueDate !== $existingDueDate
                    || $entryType !== $existingEntryType
                    || $description !== $existingDescription
                    || abs($amount - $existingAmount) > 0.01
                    || abs($rtaAmount - $existingRtaAmount) > 0.01
                    || (int)($accountId ?? 0) !== (int)($existingAccountId ?? 0);
                if ($coreChanged && !$editPolicy['can_edit_core_fields']) {
                    throw new RuntimeException('Core fields are read-only for this ' . $editPolicy['source_label'] . ' transaction');
                }

                $existingPaidDate = accumul8_normalize_date($existingTx['paid_date'] ?? null);
                $existingIsPaid = accumul8_normalize_bool($existingTx['is_paid'] ?? 0);
                if (($isPaid !== $existingIsPaid || $paidDate !== $existingPaidDate) && !$editPolicy['can_edit_paid_state']) {
                    throw new RuntimeException('Paid state is read-only for this ' . $editPolicy['source_label'] . ' transaction');
                }

                $existingIsBudgetPlanner = accumul8_normalize_bool($existingTx['is_budget_planner'] ?? 0);
                if ($isBudgetPlanner !== $existingIsBudgetPlanner && !$editPolicy['can_edit_budget_planner']) {
                    throw new RuntimeException('Budget planner state is read-only for this ' . $editPolicy['source_label'] . ' transaction');
                }

                $contactId = $entityId !== null
                    ? accumul8_entity_contact_id_or_null($viewerId, $entityId)
                    : accumul8_owned_id_or_null('contacts', $viewerId, (int)($existingTx['contact_id'] ?? 0));

                Database::execute(
                    'UPDATE accumul8_transactions
                     SET account_id = ?, entity_id = ?, contact_id = ?, transaction_date = ?, due_date = ?, entry_type = ?, description = ?,
                         memo = ?, amount = ?, rta_amount = ?, is_paid = ?, is_reconciled = ?, is_budget_planner = ?, paid_date = ?
                     WHERE id = ? AND owner_user_id = ?',
                    [
                        $accountId,
                        $entityId,
                        $contactId,
                        $transactionDate,
                        $dueDate,
                        $entryType,
                        $description,
                        $memo === '' ? null : $memo,
                        $amount,
                        $rtaAmount,
                        $isPaid,
                        $isReconciled,
                        $isBudgetPlanner,
                        $paidDate,
                        $transactionId,
                        $viewerId,
                    ]
                );

                $updatedTx = accumul8_get_transaction_row($viewerId, $transactionId);
                if ($updatedTx) {
                    accumul8_sync_recurring_template_from_transaction($viewerId, $existingTx, $updatedTx);
                }
                accumul8_recompute_running_balance($viewerId);
                $results[] = ['type' => $type, 'status' => 'applied', 'summary' => 'Updated transaction #' . $transactionId . ' (' . $description . ').'];
                continue;
            }

            if ($type === 'mark_transaction_paid') {
                $transactionId = (int)($action['transaction_id'] ?? 0);
                $isPaid = accumul8_normalize_bool($action['is_paid'] ?? 1);
                $existingTx = accumul8_get_transaction_row($viewerId, $transactionId);
                if (!$existingTx) {
                    throw new RuntimeException('Transaction not found');
                }
                $editPolicy = accumul8_transaction_edit_policy($existingTx);
                if (!$editPolicy['can_edit_paid_state']) {
                    throw new RuntimeException('Paid state is read-only for this transaction');
                }
                $paidDate = $isPaid === 1
                    ? accumul8_normalize_date($action['paid_date'] ?? ($existingTx['paid_date'] ?? $existingTx['due_date'] ?? $existingTx['transaction_date'])) ?: (string)$existingTx['transaction_date']
                    : null;
                Database::execute(
                    'UPDATE accumul8_transactions
                     SET is_paid = ?, paid_date = ?
                     WHERE id = ? AND owner_user_id = ?',
                    [$isPaid, $paidDate, $transactionId, $viewerId]
                );
                $updatedTx = accumul8_get_transaction_row($viewerId, $transactionId);
                if ($updatedTx) {
                    accumul8_sync_recurring_template_from_transaction($viewerId, $existingTx, $updatedTx);
                }
                $results[] = ['type' => $type, 'status' => 'applied', 'summary' => 'Marked transaction #' . $transactionId . ' as ' . ($isPaid === 1 ? 'paid' : 'unpaid') . '.'];
                continue;
            }

            if ($type === 'mark_transaction_reconciled') {
                $transactionId = (int)($action['transaction_id'] ?? 0);
                $isReconciled = accumul8_normalize_bool($action['is_reconciled'] ?? 1);
                $existingTx = accumul8_get_transaction_row($viewerId, $transactionId);
                if (!$existingTx) {
                    throw new RuntimeException('Transaction not found');
                }
                Database::execute(
                    'UPDATE accumul8_transactions
                     SET is_reconciled = ?
                     WHERE id = ? AND owner_user_id = ?',
                    [$isReconciled, $transactionId, $viewerId]
                );
                $results[] = ['type' => $type, 'status' => 'applied', 'summary' => 'Marked transaction #' . $transactionId . ' as ' . ($isReconciled === 1 ? 'reconciled' : 'unreconciled') . '.'];
                continue;
            }

            if ($type === 'delete_transaction') {
                $transactionId = (int)($action['transaction_id'] ?? 0);
                $existingTx = accumul8_get_transaction_row($viewerId, $transactionId);
                if (!$existingTx) {
                    throw new RuntimeException('Transaction not found');
                }
                $editPolicy = accumul8_transaction_edit_policy($existingTx);
                if (!$editPolicy['can_delete']) {
                    throw new RuntimeException(ucfirst($editPolicy['source_label']) . ' transactions cannot be deleted here');
                }
                Database::execute('DELETE FROM accumul8_transactions WHERE id = ? AND owner_user_id = ?', [$transactionId, $viewerId]);
                accumul8_recompute_running_balance($viewerId);
                $results[] = ['type' => $type, 'status' => 'applied', 'summary' => 'Deleted transaction #' . $transactionId . '.'];
                continue;
            }

            if ($type === 'update_account_balance') {
                $accountId = (int)($action['account_id'] ?? 0);
                $existing = Database::queryOne('SELECT id FROM accumul8_accounts WHERE id = ? AND owner_user_id = ? LIMIT 1', [$accountId, $viewerId]);
                if (!$existing) {
                    throw new RuntimeException('Account not found');
                }
                $currentBalance = array_key_exists('current_balance', $action) ? accumul8_normalize_amount($action['current_balance']) : null;
                $availableBalance = array_key_exists('available_balance', $action) ? accumul8_normalize_amount($action['available_balance']) : $currentBalance;
                if ($currentBalance === null && $availableBalance === null) {
                    throw new RuntimeException('Account balance update did not include any balance value');
                }
                Database::execute(
                    'UPDATE accumul8_accounts
                     SET current_balance = COALESCE(?, current_balance),
                         available_balance = COALESCE(?, available_balance),
                         updated_at = NOW()
                     WHERE id = ? AND owner_user_id = ?',
                    [$currentBalance, $availableBalance, $accountId, $viewerId]
                );
                $results[] = ['type' => $type, 'status' => 'applied', 'summary' => 'Updated balances for account #' . $accountId . '.'];
                continue;
            }

            if ($type === 'balance_books') {
                $balanceResult = accumul8_balance_books($viewerId, $actorUserId);
                $openingBalanceResult = is_array($balanceResult['opening_balance_reconciliation'] ?? null)
                    ? $balanceResult['opening_balance_reconciliation']
                    : ['reconciled_count' => 0, 'review_needed_count' => 0];
                $results[] = [
                    'type' => $type,
                    'status' => 'applied',
                    'summary' => 'Balanced the books across '
                        . (int)($balanceResult['synced_connection_count'] ?? 0)
                        . ' synced connection' . ((int)($balanceResult['synced_connection_count'] ?? 0) === 1 ? '' : 's')
                        . ' and adjusted ' . (int)($openingBalanceResult['reconciled_count'] ?? 0)
                        . ' opening balance' . ((int)($openingBalanceResult['reconciled_count'] ?? 0) === 1 ? '' : 's')
                        . ((int)($openingBalanceResult['review_needed_count'] ?? 0) > 0
                            ? ', leaving ' . (int)($openingBalanceResult['review_needed_count'] ?? 0) . ' account' . ((int)($openingBalanceResult['review_needed_count'] ?? 0) === 1 ? '' : 's') . ' for manual review'
                            : '')
                        . ((int)($balanceResult['error_connection_count'] ?? 0) > 0
                            ? ' with ' . (int)($balanceResult['error_connection_count'] ?? 0) . ' error' . ((int)($balanceResult['error_connection_count'] ?? 0) === 1 ? '' : 's')
                            : '.'),
                    'synced_connection_count' => (int)($balanceResult['synced_connection_count'] ?? 0),
                    'skipped_connection_count' => (int)($balanceResult['skipped_connection_count'] ?? 0),
                    'error_connection_count' => (int)($balanceResult['error_connection_count'] ?? 0),
                    'opening_balance_reconciliation' => $openingBalanceResult,
                ];
                continue;
            }

            if ($type === 'reconcile_opening_balances') {
                $reconcileResult = accumul8_reconcile_opening_balances($viewerId, $actorUserId);
                $results[] = [
                    'type' => $type,
                    'status' => 'applied',
                    'summary' => 'Reconciled opening balances for ' . (int)($reconcileResult['reconciled_count'] ?? 0) . ' account' . ((int)($reconcileResult['reconciled_count'] ?? 0) === 1 ? '' : 's') . '.',
                    'reconciled_count' => (int)($reconcileResult['reconciled_count'] ?? 0),
                    'skipped_count' => (int)($reconcileResult['skipped_count'] ?? 0),
                ];
                continue;
            }

            if ($type === 'run_watchlist') {
                $watchlistResult = accumul8_aicountant_run_watchlist(
                    $viewerId,
                    $actorUserId,
                    accumul8_normalize_bool($action['send_email'] ?? 0) === 1,
                    accumul8_normalize_bool($action['create_notification_rule'] ?? 0) === 1
                );
                $results[] = [
                    'type' => $type,
                    'status' => 'applied',
                    'summary' => (string)($watchlistResult['summary_body'] ?? 'Watchlist generated.'),
                    'sent_email_count' => (int)($watchlistResult['sent_email_count'] ?? 0),
                    'notification_rule_id' => isset($watchlistResult['notification_rule_id']) ? (int)$watchlistResult['notification_rule_id'] : null,
                ];
                continue;
            }

            if ($type === 'run_housekeeping') {
                $housekeepingResult = accumul8_run_aicountant_housekeeping($viewerId, $actorUserId, [
                    'send_email' => $action['send_email'] ?? 1,
                    'create_notification_rule' => $action['create_notification_rule'] ?? 1,
                    'email_on_attention_only' => $action['email_on_attention_only'] ?? 1,
                ]);
                $results[] = [
                    'type' => $type,
                    'status' => 'applied',
                    'summary' => 'Completed AIcountant housekeeping with '
                        . (int)($housekeepingResult['balance_books']['synced_connection_count'] ?? 0) . ' sync'
                        . ((int)($housekeepingResult['balance_books']['synced_connection_count'] ?? 0) === 1 ? '' : 's')
                        . ' and ' . (int)($housekeepingResult['watchlist']['sent_email_count'] ?? 0) . ' email alert'
                        . ((int)($housekeepingResult['watchlist']['sent_email_count'] ?? 0) === 1 ? '' : 's') . '.',
                    'attention_needed' => (int)($housekeepingResult['attention_needed'] ?? 0),
                ];
                continue;
            }

            $results[] = ['type' => $type, 'status' => 'ignored', 'summary' => 'Unsupported action type'];
        } catch (Throwable $exception) {
            $results[] = ['type' => $type, 'status' => 'error', 'summary' => accumul8_normalize_text($exception->getMessage(), 240)];
        }
    }

    return $results;
}

function accumul8_aicountant_generate_reply(int $viewerId, array $conversation, string $userMessage, array $actionResults = []): array
{
    $aiConfig = accumul8_aicountant_effective_ai_config();
    $systemPrompt = accumul8_aicountant_effective_conversation_system_prompt($conversation);

    $context = accumul8_aicountant_build_financial_context($viewerId);
    $history = accumul8_aicountant_recent_transcript($viewerId, (int)($conversation['id'] ?? 0), 24);
    $historyText = '';
    foreach ($history as $message) {
        $roleLabel = $message['role'] === 'assistant' ? 'Assistant' : ($message['role'] === 'system' ? 'System' : 'User');
        $historyText .= $roleLabel . ': ' . trim((string)($message['content_text'] ?? '')) . "\n\n";
    }

    $actionSummaryText = '';
    $actionSummaryLines = accumul8_aicountant_action_summary_lines($actionResults);
    if ($actionSummaryLines !== []) {
        $actionSummaryText = "\n\nBookkeeping actions executed for this request:\n" . implode("\n", $actionSummaryLines);
    }

    $userPrompt = "Authoritative Accumul8 household finance snapshot (JSON):\n"
        . json_encode($context, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        . "\n\nRecent conversation transcript:\n"
        . ($historyText !== '' ? $historyText : "No prior messages.\n")
        . "\nCurrent user request:\n"
        . $userMessage
        . $actionSummaryText
        . "\n\nAnswer as AIcountant. Be specific about dates, balances, and risks when the data supports it. If bookkeeping actions were executed, report them plainly instead of saying you lack write access. If the available data is not enough, say what to review next.";

    $provider = (string)($aiConfig['provider'] ?? 'openai');
    $model = (string)($aiConfig['model'] ?? '');
    $temperature = (float)($aiConfig['temperature'] ?? 0.2);
    $baseUrl = (string)($aiConfig['base_url'] ?? '');
    $location = (string)($aiConfig['location'] ?? '');

    if ($provider === 'google_vertex_ai') {
        $saJson = secret_get(catn8_settings_ai_secret_key($provider, 'service_account_json'));
        if (!is_string($saJson) || trim($saJson) === '') {
            throw new RuntimeException('Missing AI service account JSON (google_vertex_ai)');
        }
        $sa = json_decode((string)$saJson, true);
        if (!is_array($sa)) {
            throw new RuntimeException('AI Vertex service account JSON is invalid');
        }
        $content = catn8_vertex_ai_gemini_generate_text([
            'service_account_json' => $saJson,
            'project_id' => trim((string)($sa['project_id'] ?? '')),
            'location' => $location !== '' ? $location : 'us-central1',
            'model' => $model !== '' ? $model : 'gemini-1.5-pro',
            'system_prompt' => $systemPrompt,
            'user_prompt' => $userPrompt,
            'temperature' => $temperature,
            'max_output_tokens' => 3072,
        ]);
        return [
            'provider' => $provider,
            'model' => $model !== '' ? $model : 'gemini-1.5-pro',
            'content' => trim((string)$content),
            'context' => $context,
        ];
    }

    if ($provider === 'google_ai_studio') {
        $apiKey = secret_get(catn8_settings_ai_secret_key($provider, 'api_key'));
        if (!is_string($apiKey) || trim($apiKey) === '') {
            throw new RuntimeException('Missing AI API key (google_ai_studio)');
        }
        $resolvedModel = $model !== '' ? $model : 'gemini-1.5-pro';
        $resp = catn8_http_json_with_status(
            'POST',
            'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($resolvedModel) . ':generateContent',
            ['x-goog-api-key' => trim($apiKey)],
            [
                'contents' => [['role' => 'user', 'parts' => [['text' => $userPrompt]]]],
                'systemInstruction' => ['parts' => [['text' => $systemPrompt]]],
                'generationConfig' => ['temperature' => $temperature],
            ],
            10,
            60
        );
        $content = trim((string)($resp['json']['candidates'][0]['content']['parts'][0]['text'] ?? ''));
        if ($content === '') {
            throw new RuntimeException('Google AI Studio returned an empty AIcountant response');
        }
        return [
            'provider' => $provider,
            'model' => $resolvedModel,
            'content' => $content,
            'context' => $context,
        ];
    }

    $resolvedModel = $model !== '' ? $model : 'gpt-4o-mini';
    $result = accumul8_openai_responses_text(
        $resolvedModel,
        [[
            'role' => 'system',
            'content' => [
                ['type' => 'input_text', 'text' => $systemPrompt],
            ],
        ], [
            'role' => 'user',
            'content' => [
                ['type' => 'input_text', 'text' => $userPrompt],
            ],
        ]],
        $baseUrl,
        $temperature,
        3072,
        90
    );

    return [
        'provider' => 'openai',
        'model' => $resolvedModel,
        'content' => trim((string)($result['content'] ?? '')),
        'context' => $context,
    ];
}

function accumul8_tables_ensure(): void
{
    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_user_access_grants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        grantee_user_id INT NOT NULL,
        owner_user_id INT NOT NULL,
        granted_by_user_id INT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_accumul8_access_grantee_owner (grantee_user_id, owner_user_id),
        KEY idx_accumul8_access_owner (owner_user_id),
        CONSTRAINT fk_accumul8_access_grantee FOREIGN KEY (grantee_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_accumul8_access_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_accumul8_access_granted_by FOREIGN KEY (granted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_account_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        group_name VARCHAR(191) NOT NULL,
        institution_name VARCHAR(191) NOT NULL DEFAULT '',
        website_url VARCHAR(2048) NOT NULL DEFAULT '',
        login_url VARCHAR(2048) NOT NULL DEFAULT '',
        support_url VARCHAR(2048) NOT NULL DEFAULT '',
        support_phone VARCHAR(32) NOT NULL DEFAULT '',
        support_email VARCHAR(191) NOT NULL DEFAULT '',
        routing_number VARCHAR(32) NOT NULL DEFAULT '',
        mailing_address VARCHAR(255) NOT NULL DEFAULT '',
        icon_path VARCHAR(512) NOT NULL DEFAULT '',
        notes TEXT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_accumul8_account_group_owner_name (owner_user_id, group_name),
        KEY idx_accumul8_account_groups_owner (owner_user_id),
        CONSTRAINT fk_accumul8_account_groups_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_accounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        account_group_id INT NULL,
        bank_connection_id INT NULL,
        provider_name VARCHAR(32) NOT NULL DEFAULT '',
        teller_account_id VARCHAR(191) NULL,
        teller_enrollment_id VARCHAR(191) NULL,
        account_name VARCHAR(191) NOT NULL,
        account_nickname VARCHAR(191) NOT NULL DEFAULT '',
        account_type VARCHAR(40) NOT NULL DEFAULT 'checking',
        account_subtype VARCHAR(64) NOT NULL DEFAULT '',
        institution_name VARCHAR(191) NOT NULL DEFAULT '',
        account_number_mask VARCHAR(32) NOT NULL DEFAULT '',
        mask_last4 VARCHAR(8) NOT NULL DEFAULT '',
        routing_number VARCHAR(32) NOT NULL DEFAULT '',
        currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
        statement_day_of_month TINYINT UNSIGNED NULL,
        payment_due_day_of_month TINYINT UNSIGNED NULL,
        autopay_enabled TINYINT(1) NOT NULL DEFAULT 0,
        credit_limit DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        interest_rate DECIMAL(7,4) NOT NULL DEFAULT 0.0000,
        minimum_payment DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        opened_on DATE NULL,
        closed_on DATE NULL,
        notes TEXT NULL,
        current_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        available_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_accumul8_accounts_owner (owner_user_id),
        KEY idx_accumul8_accounts_group (account_group_id),
        KEY idx_accumul8_accounts_connection (bank_connection_id),
        UNIQUE KEY uniq_accumul8_accounts_teller (owner_user_id, provider_name, teller_account_id),
        CONSTRAINT fk_accumul8_accounts_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_contacts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        entity_id INT NULL,
        contact_name VARCHAR(191) NOT NULL,
        contact_type VARCHAR(16) NOT NULL DEFAULT 'payee',
        default_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        email VARCHAR(191) NULL,
        phone_number VARCHAR(32) NULL,
        street_address VARCHAR(191) NULL,
        city VARCHAR(120) NULL,
        state VARCHAR(64) NULL,
        zip VARCHAR(20) NULL,
        notes TEXT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_accumul8_contacts_owner (owner_user_id),
        KEY idx_accumul8_contacts_name (contact_name),
        CONSTRAINT fk_accumul8_contacts_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_entities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        display_name VARCHAR(191) NOT NULL,
        entity_kind VARCHAR(32) NOT NULL DEFAULT 'business',
        contact_type VARCHAR(16) NOT NULL DEFAULT 'payee',
        is_payee TINYINT(1) NOT NULL DEFAULT 0,
        is_payer TINYINT(1) NOT NULL DEFAULT 0,
        is_vendor TINYINT(1) NOT NULL DEFAULT 0,
        is_balance_person TINYINT(1) NOT NULL DEFAULT 0,
        default_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        email VARCHAR(191) NULL,
        phone_number VARCHAR(32) NULL,
        street_address VARCHAR(191) NULL,
        city VARCHAR(120) NULL,
        state VARCHAR(64) NULL,
        zip VARCHAR(20) NULL,
        notes TEXT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        legacy_contact_id INT NULL,
        legacy_debtor_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_accumul8_entities_owner_name (owner_user_id, display_name),
        KEY idx_accumul8_entities_owner_kind (owner_user_id, entity_kind),
        KEY idx_accumul8_entities_legacy_contact (legacy_contact_id),
        KEY idx_accumul8_entities_legacy_debtor (legacy_debtor_id),
        CONSTRAINT fk_accumul8_entities_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_entity_aliases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        entity_id INT NOT NULL,
        alias_name VARCHAR(191) NOT NULL,
        alias_key VARCHAR(191) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_accumul8_entity_alias_owner_key (owner_user_id, alias_key),
        KEY idx_accumul8_entity_aliases_entity (entity_id),
        CONSTRAINT fk_accumul8_entity_aliases_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_accumul8_entity_aliases_entity FOREIGN KEY (entity_id) REFERENCES accumul8_entities(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_entity_endex_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        parent_entity_id INT NULL,
        parent_name VARCHAR(191) NOT NULL,
        parent_key VARCHAR(191) NOT NULL,
        match_rule VARCHAR(255) NOT NULL DEFAULT '',
        examples_json LONGTEXT NULL,
        match_fragments_json LONGTEXT NULL,
        match_contains_json LONGTEXT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_accumul8_entity_endex_groups_owner_parent (owner_user_id, parent_key),
        KEY idx_accumul8_entity_endex_groups_owner_active (owner_user_id, is_active),
        KEY idx_accumul8_entity_endex_groups_parent_entity (parent_entity_id),
        CONSTRAINT fk_accumul8_entity_endex_groups_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_accumul8_entity_endex_groups_parent_entity FOREIGN KEY (parent_entity_id) REFERENCES accumul8_entities(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_entity_alias_reviews (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        entity_id INT NOT NULL,
        candidate_name VARCHAR(191) NOT NULL,
        candidate_key VARCHAR(191) NOT NULL,
        review_status VARCHAR(32) NOT NULL DEFAULT '',
        review_source VARCHAR(32) NOT NULL DEFAULT '',
        is_protected TINYINT(1) NOT NULL DEFAULT 0,
        scanner_version INT NOT NULL DEFAULT 1,
        ai_provider VARCHAR(64) NOT NULL DEFAULT '',
        ai_model VARCHAR(191) NOT NULL DEFAULT '',
        review_reason VARCHAR(1000) NOT NULL DEFAULT '',
        reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_accumul8_entity_alias_reviews_owner_entity_key (owner_user_id, entity_id, candidate_key),
        KEY idx_accumul8_entity_alias_reviews_owner_status (owner_user_id, entity_id, review_status),
        CONSTRAINT fk_accumul8_entity_alias_reviews_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_accumul8_entity_alias_reviews_entity FOREIGN KEY (entity_id) REFERENCES accumul8_entities(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_entity_endex_scan_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        scanned_entity_count INT NOT NULL DEFAULT 0,
        touched_entity_count INT NOT NULL DEFAULT 0,
        created_count INT NOT NULL DEFAULT 0,
        updated_count INT NOT NULL DEFAULT 0,
        skipped_count INT NOT NULL DEFAULT 0,
        conflict_count INT NOT NULL DEFAULT 0,
        summary_text VARCHAR(255) NOT NULL DEFAULT '',
        items_json LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_accumul8_entity_endex_scan_logs_owner_created (owner_user_id, created_at),
        CONSTRAINT fk_accumul8_entity_endex_scan_logs_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_debtors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        entity_id INT NULL,
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
        entity_id INT NULL,
        contact_id INT NULL,
        account_id INT NULL,
        title VARCHAR(191) NOT NULL,
        direction VARCHAR(16) NOT NULL DEFAULT 'outflow',
        amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        frequency VARCHAR(16) NOT NULL DEFAULT 'monthly',
        payment_method VARCHAR(24) NOT NULL DEFAULT 'unspecified',
        interval_count INT NOT NULL DEFAULT 1,
        day_of_month INT NULL,
        day_of_week INT NULL,
        next_due_date DATE NOT NULL,
        paid_date DATE NULL,
        notes TEXT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        is_budget_planner TINYINT(1) NOT NULL DEFAULT 1,
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
        entity_id INT NULL,
        balance_entity_id INT NULL,
        contact_id INT NULL,
        transaction_date DATE NOT NULL,
        due_date DATE NULL,
        paid_date DATE NULL,
        entry_type VARCHAR(24) NOT NULL DEFAULT 'manual',
        description VARCHAR(255) NOT NULL,
        memo TEXT NULL,
        amount DECIMAL(10,2) NOT NULL,
        rta_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        running_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        is_paid TINYINT(1) NOT NULL DEFAULT 0,
        is_reconciled TINYINT(1) NOT NULL DEFAULT 0,
        is_budget_planner TINYINT(1) NOT NULL DEFAULT 1,
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
        KEY idx_accumul8_tx_paid_date (paid_date),
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
        provider_name VARCHAR(32) NOT NULL DEFAULT 'teller',
        institution_id VARCHAR(64) NULL,
        institution_name VARCHAR(191) NULL,
        teller_enrollment_id VARCHAR(191) NULL,
        teller_user_id VARCHAR(191) NULL,
        teller_access_token_secret_key VARCHAR(191) NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'setup_pending',
        last_sync_at DATETIME NULL,
        last_error TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_accumul8_bank_owner (owner_user_id),
        UNIQUE KEY uniq_accumul8_bank_enrollment (owner_user_id, provider_name, teller_enrollment_id),
        CONSTRAINT fk_accumul8_bank_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

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
        page_catalog_json LONGTEXT NULL,
        parsed_payload_json LONGTEXT NULL,
        catalog_summary TEXT NULL,
        catalog_keywords_json LONGTEXT NULL,
        catalog_trace_json LONGTEXT NULL,
        import_result_json LONGTEXT NULL,
        last_error TEXT NULL,
        last_scanned_at DATETIME NULL,
        processed_at DATETIME NULL,
        is_archived TINYINT(1) NOT NULL DEFAULT 0,
        archived_at DATETIME NULL,
        archived_from_status VARCHAR(24) NOT NULL DEFAULT '',
        archived_from_section VARCHAR(24) NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_accumul8_statement_owner (owner_user_id),
        KEY idx_accumul8_statement_account (account_id),
        KEY idx_accumul8_statement_status (status),
        KEY idx_accumul8_statement_archived (is_archived),
        CONSTRAINT fk_accumul8_statement_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_accumul8_statement_account FOREIGN KEY (account_id) REFERENCES accumul8_accounts(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_statement_reconciliation_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        statement_upload_id BIGINT NOT NULL,
        actor_user_id INT NOT NULL DEFAULT 0,
        reconciliation_status VARCHAR(24) NOT NULL DEFAULT 'pending',
        transaction_count INT NOT NULL DEFAULT 0,
        already_reconciled_count INT NOT NULL DEFAULT 0,
        reconciled_now_count INT NOT NULL DEFAULT 0,
        linked_match_count INT NOT NULL DEFAULT 0,
        missing_match_count INT NOT NULL DEFAULT 0,
        invalid_row_count INT NOT NULL DEFAULT 0,
        summary_text TEXT NULL,
        details_json LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_accumul8_statement_recon_owner (owner_user_id),
        KEY idx_accumul8_statement_recon_upload (statement_upload_id),
        CONSTRAINT fk_accumul8_statement_recon_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_accumul8_statement_recon_upload FOREIGN KEY (statement_upload_id) REFERENCES accumul8_statement_uploads(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_statement_audit_runs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        actor_user_id INT NOT NULL DEFAULT 0,
        audit_start_date DATE NULL,
        audit_end_date DATE NULL,
        upload_count INT NOT NULL DEFAULT 0,
        passed_count INT NOT NULL DEFAULT 0,
        warning_count INT NOT NULL DEFAULT 0,
        failed_count INT NOT NULL DEFAULT 0,
        summary_text TEXT NULL,
        report_json LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_accumul8_statement_audit_owner (owner_user_id),
        CONSTRAINT fk_accumul8_statement_audit_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_ai_conversations (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        title VARCHAR(191) NOT NULL,
        system_prompt LONGTEXT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'active',
        conversation_summary TEXT NULL,
        last_message_preview VARCHAR(255) NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_accumul8_ai_conversations_owner_updated (owner_user_id, updated_at),
        CONSTRAINT fk_accumul8_ai_conversations_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_ai_conversation_events (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        conversation_id BIGINT NOT NULL,
        owner_user_id INT NOT NULL,
        role VARCHAR(24) NOT NULL DEFAULT 'user',
        content_text LONGTEXT NOT NULL,
        provider VARCHAR(64) NOT NULL DEFAULT '',
        model VARCHAR(191) NOT NULL DEFAULT '',
        meta_json LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_accumul8_ai_events_conversation (conversation_id, created_at),
        KEY idx_accumul8_ai_events_owner (owner_user_id, created_at),
        CONSTRAINT fk_accumul8_ai_events_conversation FOREIGN KEY (conversation_id) REFERENCES accumul8_ai_conversations(id) ON DELETE CASCADE,
        CONSTRAINT fk_accumul8_ai_events_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    Database::execute("CREATE TABLE IF NOT EXISTS accumul8_message_board_messages (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id INT NOT NULL,
        actor_user_id INT NOT NULL DEFAULT 0,
        source_kind VARCHAR(64) NOT NULL DEFAULT '',
        message_level VARCHAR(24) NOT NULL DEFAULT 'info',
        title VARCHAR(191) NOT NULL DEFAULT '',
        body_text TEXT NOT NULL,
        meta_json LONGTEXT NULL,
        is_acknowledged TINYINT(1) NOT NULL DEFAULT 0,
        acknowledged_at DATETIME NULL,
        acknowledged_by_user_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_accumul8_message_board_owner_ack (owner_user_id, is_acknowledged, created_at),
        CONSTRAINT fk_accumul8_message_board_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    try {
        // Legacy schema upgrades for installations that predate newer Accumul8 fields.
        $hadBudgetPlannerColumn = accumul8_table_has_column('accumul8_transactions', 'is_budget_planner');
        accumul8_table_add_column_if_missing('accumul8_account_groups', 'website_url', "VARCHAR(2048) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_account_groups', 'login_url', "VARCHAR(2048) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_account_groups', 'support_url', "VARCHAR(2048) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_account_groups', 'support_phone', "VARCHAR(32) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_account_groups', 'support_email', "VARCHAR(191) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_account_groups', 'routing_number', "VARCHAR(32) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_account_groups', 'mailing_address', "VARCHAR(255) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_account_groups', 'icon_path', "VARCHAR(512) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_accounts', 'account_group_id', 'INT NULL');
        accumul8_table_add_column_if_missing('accumul8_accounts', 'bank_connection_id', 'INT NULL');
        accumul8_table_add_column_if_missing('accumul8_accounts', 'provider_name', "VARCHAR(32) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_accounts', 'teller_account_id', 'VARCHAR(191) NULL');
        accumul8_table_add_column_if_missing('accumul8_accounts', 'teller_enrollment_id', 'VARCHAR(191) NULL');
        accumul8_table_add_column_if_missing('accumul8_accounts', 'account_nickname', "VARCHAR(191) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_accounts', 'account_type', "VARCHAR(40) NOT NULL DEFAULT 'checking'");
        accumul8_table_add_column_if_missing('accumul8_accounts', 'account_subtype', "VARCHAR(64) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_accounts', 'institution_name', "VARCHAR(191) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_accounts', 'account_number_mask', "VARCHAR(32) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_accounts', 'mask_last4', "VARCHAR(8) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_accounts', 'routing_number', "VARCHAR(32) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_accounts', 'currency_code', "VARCHAR(3) NOT NULL DEFAULT 'USD'");
        accumul8_table_add_column_if_missing('accumul8_accounts', 'teller_sync_anchor_date', 'DATE NULL');
        accumul8_table_add_column_if_missing('accumul8_accounts', 'teller_backfill_cursor_id', 'VARCHAR(191) NULL');
        accumul8_table_add_column_if_missing('accumul8_accounts', 'teller_backfill_complete', 'TINYINT(1) NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_accounts', 'teller_history_start_date', 'DATE NULL');
        accumul8_table_add_column_if_missing('accumul8_accounts', 'teller_history_end_date', 'DATE NULL');
        accumul8_table_add_column_if_missing('accumul8_accounts', 'statement_day_of_month', 'TINYINT UNSIGNED NULL');
        accumul8_table_add_column_if_missing('accumul8_accounts', 'payment_due_day_of_month', 'TINYINT UNSIGNED NULL');
        accumul8_table_add_column_if_missing('accumul8_accounts', 'autopay_enabled', 'TINYINT(1) NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_accounts', 'credit_limit', 'DECIMAL(10,2) NOT NULL DEFAULT 0.00');
        accumul8_table_add_column_if_missing('accumul8_accounts', 'interest_rate', 'DECIMAL(7,4) NOT NULL DEFAULT 0.0000');
        accumul8_table_add_column_if_missing('accumul8_accounts', 'minimum_payment', 'DECIMAL(10,2) NOT NULL DEFAULT 0.00');
        accumul8_table_add_column_if_missing('accumul8_accounts', 'opened_on', 'DATE NULL');
        accumul8_table_add_column_if_missing('accumul8_accounts', 'closed_on', 'DATE NULL');
        accumul8_table_add_column_if_missing('accumul8_accounts', 'notes', 'TEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_accounts', 'available_balance', "DECIMAL(10,2) NOT NULL DEFAULT 0.00");
        accumul8_table_add_column_if_missing('accumul8_accounts', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1');
        Database::execute(
            "UPDATE accumul8_account_groups
             SET website_url = CASE
                    WHEN group_name = 'Navy Federal Credit Union' AND COALESCE(website_url, '') = '' THEN 'https://www.navyfederal.org/'
                    WHEN group_name = 'Capital One 360' AND COALESCE(website_url, '') = '' THEN 'https://www.capitalone.com/bank/'
                    ELSE website_url
                 END,
                 login_url = CASE
                    WHEN group_name = 'Navy Federal Credit Union' THEN 'https://digitalomni.navyfederal.org/sign-in/?NFCUSIGNOFF=2'
                    WHEN group_name = 'Capital One 360' THEN 'https://verified.capitalone.com/auth/signin?Product=ENTERPRISE&goto_url=https:%2F%2Fmyaccounts.capitalone.com%2F%23%2Fwelcome#/welcome'
                    ELSE login_url
                 END,
                 support_url = CASE
                    WHEN group_name = 'Navy Federal Credit Union' AND COALESCE(support_url, '') = '' THEN 'https://www.navyfederal.org/contact-us/phone-numbers.html'
                    WHEN group_name = 'Capital One 360' AND COALESCE(support_url, '') = '' THEN 'https://www.capitalone.com/bank/customer-service/'
                    ELSE support_url
                 END,
                 support_phone = CASE
                    WHEN group_name = 'Navy Federal Credit Union' AND COALESCE(support_phone, '') = '' THEN '1-888-842-6328'
                    WHEN group_name = 'Capital One 360' AND COALESCE(support_phone, '') = '' THEN '800-655-2265'
                    ELSE support_phone
                 END,
                 routing_number = CASE
                    WHEN group_name = 'Navy Federal Credit Union' AND COALESCE(routing_number, '') = '' THEN '256074974'
                    ELSE routing_number
                 END,
                 mailing_address = CASE
                    WHEN group_name = 'Navy Federal Credit Union' AND COALESCE(mailing_address, '') = '' THEN '820 Follin Lane SE, Vienna, VA 22180'
                    WHEN group_name = 'Capital One 360' AND COALESCE(mailing_address, '') = '' THEN 'Capital One Bank, Attn: Bank by Mail, PO BOX 85123, Richmond VA 23285'
                    ELSE mailing_address
                 END,
                 icon_path = CASE
                    WHEN group_name = 'Navy Federal Credit Union' THEN '/images/bank-organizations/navy-federal-credit-union-1024.png'
                    WHEN group_name = 'Capital One 360' THEN '/images/bank-organizations/capital-one-360-1024.png'
                    ELSE icon_path
                 END
             WHERE group_name IN ('Navy Federal Credit Union', 'Capital One 360')"
        );
        if (!accumul8_table_has_index('accumul8_accounts', 'idx_accumul8_accounts_group')) {
            Database::execute('ALTER TABLE accumul8_accounts ADD INDEX idx_accumul8_accounts_group (account_group_id)');
        }
        if (!accumul8_table_has_index('accumul8_accounts', 'idx_accumul8_accounts_connection')) {
            Database::execute('ALTER TABLE accumul8_accounts ADD INDEX idx_accumul8_accounts_connection (bank_connection_id)');
        }
        if (!accumul8_table_has_foreign_key('accumul8_accounts', 'fk_accumul8_accounts_group')) {
            Database::execute('ALTER TABLE accumul8_accounts ADD CONSTRAINT fk_accumul8_accounts_group FOREIGN KEY (account_group_id) REFERENCES accumul8_account_groups(id) ON DELETE SET NULL');
        }
        if (!accumul8_table_has_foreign_key('accumul8_accounts', 'fk_accumul8_accounts_connection')) {
            Database::execute('ALTER TABLE accumul8_accounts ADD CONSTRAINT fk_accumul8_accounts_connection FOREIGN KEY (bank_connection_id) REFERENCES accumul8_bank_connections(id) ON DELETE SET NULL');
        }
        if (!accumul8_table_has_index('accumul8_accounts', 'uniq_accumul8_accounts_teller')) {
            Database::execute('ALTER TABLE accumul8_accounts ADD UNIQUE KEY uniq_accumul8_accounts_teller (owner_user_id, provider_name, teller_account_id)');
        }

        accumul8_table_add_column_if_missing('accumul8_contacts', 'phone_number', 'VARCHAR(32) NULL');
        accumul8_table_add_column_if_missing('accumul8_contacts', 'street_address', 'VARCHAR(191) NULL');
        accumul8_table_add_column_if_missing('accumul8_contacts', 'city', 'VARCHAR(120) NULL');
        accumul8_table_add_column_if_missing('accumul8_contacts', 'state', 'VARCHAR(64) NULL');
        accumul8_table_add_column_if_missing('accumul8_contacts', 'zip', 'VARCHAR(20) NULL');
        accumul8_table_add_column_if_missing('accumul8_contacts', 'entity_id', 'INT NULL');

        $entityKindColumn = Database::queryOne(
            "SELECT CHARACTER_MAXIMUM_LENGTH AS max_len
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'accumul8_entities'
               AND COLUMN_NAME = 'entity_kind'
             LIMIT 1"
        );
        if ((int)($entityKindColumn['max_len'] ?? 0) > 0 && (int)($entityKindColumn['max_len'] ?? 0) < 32) {
            Database::execute("ALTER TABLE accumul8_entities MODIFY COLUMN entity_kind VARCHAR(32) NOT NULL DEFAULT 'business'");
        }

        accumul8_table_add_column_if_missing('accumul8_debtors', 'entity_id', 'INT NULL');

        accumul8_table_add_column_if_missing('accumul8_recurring_payments', 'account_id', 'INT NULL');
        accumul8_table_add_column_if_missing('accumul8_recurring_payments', 'entity_id', 'INT NULL');
        accumul8_table_add_column_if_missing('accumul8_recurring_payments', 'interval_count', 'INT NOT NULL DEFAULT 1');
        accumul8_table_add_column_if_missing('accumul8_recurring_payments', 'payment_method', "VARCHAR(24) NOT NULL DEFAULT 'unspecified'");
        accumul8_table_add_column_if_missing('accumul8_recurring_payments', 'day_of_month', 'INT NULL');
        accumul8_table_add_column_if_missing('accumul8_recurring_payments', 'day_of_week', 'INT NULL');
        accumul8_table_add_column_if_missing('accumul8_recurring_payments', 'paid_date', 'DATE NULL');
        accumul8_table_add_column_if_missing('accumul8_recurring_payments', 'notes', 'TEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_recurring_payments', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1');
        accumul8_table_add_column_if_missing('accumul8_recurring_payments', 'is_budget_planner', 'TINYINT(1) NOT NULL DEFAULT 1');

        accumul8_table_add_column_if_missing('accumul8_transactions', 'due_date', 'DATE NULL');
        accumul8_table_add_column_if_missing('accumul8_transactions', 'paid_date', 'DATE NULL');
        accumul8_table_add_column_if_missing('accumul8_transactions', 'entry_type', "VARCHAR(24) NOT NULL DEFAULT 'manual'");
        accumul8_table_add_column_if_missing('accumul8_transactions', 'entity_id', 'INT NULL');
        accumul8_table_add_column_if_missing('accumul8_transactions', 'balance_entity_id', 'INT NULL');
        accumul8_table_add_column_if_missing('accumul8_transactions', 'memo', 'TEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_transactions', 'rta_amount', 'DECIMAL(10,2) NOT NULL DEFAULT 0.00');
        accumul8_table_add_column_if_missing('accumul8_transactions', 'is_reconciled', 'TINYINT(1) NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_transactions', 'is_budget_planner', 'TINYINT(1) NOT NULL DEFAULT 1');
        accumul8_table_add_column_if_missing('accumul8_transactions', 'is_recurring_instance', 'TINYINT(1) NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_transactions', 'recurring_payment_id', 'INT NULL');
        accumul8_table_add_column_if_missing('accumul8_transactions', 'source_kind', "VARCHAR(24) NOT NULL DEFAULT 'manual'");
        accumul8_table_add_column_if_missing('accumul8_transactions', 'source_ref', 'VARCHAR(191) NULL');
        if (!accumul8_table_has_index('accumul8_transactions', 'idx_accumul8_tx_paid_date')) {
            Database::execute('ALTER TABLE accumul8_transactions ADD INDEX idx_accumul8_tx_paid_date (paid_date)');
        }

        if (accumul8_table_has_column('accumul8_transactions', 'paid_date')
            && accumul8_table_has_column('accumul8_transactions', 'recurring_payment_id')
            && accumul8_table_has_column('accumul8_recurring_payments', 'payment_method')) {
            Database::execute(
                "UPDATE accumul8_transactions t
                 INNER JOIN accumul8_recurring_payments rp
                   ON rp.id = t.recurring_payment_id
                  AND rp.owner_user_id = t.owner_user_id
                 SET t.paid_date = COALESCE(t.due_date, t.transaction_date)
                 WHERE t.paid_date IS NULL
                   AND t.source_kind = 'recurring'
                   AND rp.payment_method = 'autopay'"
            );
        }

        if (accumul8_table_has_column('accumul8_transactions', 'paid_date')) {
            Database::execute(
                "UPDATE accumul8_transactions
                 SET paid_date = transaction_date
                 WHERE paid_date IS NULL
                   AND is_paid = 1
                   AND source_kind IN ('plaid', 'teller', 'statement_upload')"
            );
        }
        Database::execute("UPDATE accumul8_transactions SET source_kind = 'teller' WHERE source_kind = 'plaid'");
        accumul8_table_add_column_if_missing('accumul8_transactions', 'external_id', 'VARCHAR(191) NULL');
        accumul8_table_add_column_if_missing('accumul8_transactions', 'pending_status', 'TINYINT(1) NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_transactions', 'created_by_user_id', 'INT NOT NULL DEFAULT 0');

        accumul8_table_add_column_if_missing('accumul8_notification_rules', 'custom_user_ids_json', 'LONGTEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_notification_rules', 'last_triggered_at', 'DATETIME NULL');

        accumul8_table_add_column_if_missing('accumul8_bank_connections', 'institution_id', 'VARCHAR(64) NULL');
        accumul8_table_add_column_if_missing('accumul8_bank_connections', 'institution_name', 'VARCHAR(191) NULL');
        accumul8_table_add_column_if_missing('accumul8_bank_connections', 'teller_enrollment_id', 'VARCHAR(191) NULL');
        accumul8_table_add_column_if_missing('accumul8_bank_connections', 'teller_user_id', 'VARCHAR(191) NULL');
        accumul8_table_add_column_if_missing('accumul8_bank_connections', 'teller_access_token_secret_key', 'VARCHAR(191) NULL');
        accumul8_table_add_column_if_missing('accumul8_bank_connections', 'status', "VARCHAR(32) NOT NULL DEFAULT 'setup_pending'");
        accumul8_table_add_column_if_missing('accumul8_bank_connections', 'last_sync_at', 'DATETIME NULL');
        accumul8_table_add_column_if_missing('accumul8_bank_connections', 'last_error', 'TEXT NULL');
        Database::execute("UPDATE accumul8_bank_connections SET provider_name = 'teller' WHERE provider_name = 'plaid'");
        if (!accumul8_table_has_index('accumul8_bank_connections', 'uniq_accumul8_bank_enrollment')) {
            Database::execute('ALTER TABLE accumul8_bank_connections ADD UNIQUE KEY uniq_accumul8_bank_enrollment (owner_user_id, provider_name, teller_enrollment_id)');
        }

        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'account_id', 'INT NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'statement_kind', "VARCHAR(24) NOT NULL DEFAULT 'bank_account'");
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'status', "VARCHAR(24) NOT NULL DEFAULT 'uploaded'");
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'file_size_bytes', 'INT NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'file_sha256', "CHAR(64) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'extracted_text', 'LONGTEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'extracted_method', "VARCHAR(32) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'ai_provider', "VARCHAR(64) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'ai_model', "VARCHAR(191) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'institution_name', "VARCHAR(191) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'account_name_hint', "VARCHAR(191) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'account_mask_last4', "VARCHAR(16) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'period_start', 'DATE NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'period_end', 'DATE NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'opening_balance', 'DECIMAL(10,2) NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'closing_balance', 'DECIMAL(10,2) NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'imported_transaction_count', 'INT NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'duplicate_transaction_count', 'INT NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'suspicious_item_count', 'INT NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'reconciliation_status', "VARCHAR(24) NOT NULL DEFAULT 'pending'");
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'reconciliation_note', 'TEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'suspicious_items_json', 'LONGTEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'processing_notes_json', 'LONGTEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'transaction_locator_json', 'LONGTEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'page_catalog_json', 'LONGTEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'parsed_payload_json', 'LONGTEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'catalog_summary', 'TEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'catalog_keywords_json', 'LONGTEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'catalog_trace_json', 'LONGTEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'import_result_json', 'LONGTEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'last_error', 'TEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'last_scanned_at', 'DATETIME NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'processed_at', 'DATETIME NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'is_archived', 'TINYINT(1) NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'archived_at', 'DATETIME NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'archived_from_status', "VARCHAR(24) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'archived_from_section', "VARCHAR(24) NOT NULL DEFAULT ''");
        if (!accumul8_table_has_index('accumul8_statement_uploads', 'idx_accumul8_statement_account')) {
            Database::execute('ALTER TABLE accumul8_statement_uploads ADD INDEX idx_accumul8_statement_account (account_id)');
        }
        if (!accumul8_table_has_index('accumul8_statement_uploads', 'idx_accumul8_statement_archived')) {
            Database::execute('ALTER TABLE accumul8_statement_uploads ADD INDEX idx_accumul8_statement_archived (is_archived)');
        }
        if (!accumul8_table_has_foreign_key('accumul8_statement_uploads', 'fk_accumul8_statement_account')) {
            Database::execute('ALTER TABLE accumul8_statement_uploads ADD CONSTRAINT fk_accumul8_statement_account FOREIGN KEY (account_id) REFERENCES accumul8_accounts(id) ON DELETE SET NULL');
        }
        accumul8_table_add_column_if_missing('accumul8_statement_reconciliation_logs', 'actor_user_id', 'INT NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_statement_reconciliation_logs', 'reconciliation_status', "VARCHAR(24) NOT NULL DEFAULT 'pending'");
        accumul8_table_add_column_if_missing('accumul8_ai_conversations', 'system_prompt', 'LONGTEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_ai_conversations', 'status', "VARCHAR(24) NOT NULL DEFAULT 'active'");
        accumul8_table_add_column_if_missing('accumul8_ai_conversations', 'conversation_summary', 'TEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_ai_conversations', 'last_message_preview', "VARCHAR(255) NOT NULL DEFAULT ''");
        if (!accumul8_table_has_index('accumul8_ai_conversations', 'idx_accumul8_ai_conversations_owner_updated')) {
            Database::execute('ALTER TABLE accumul8_ai_conversations ADD INDEX idx_accumul8_ai_conversations_owner_updated (owner_user_id, updated_at)');
        }
        accumul8_table_add_column_if_missing('accumul8_ai_conversation_events', 'provider', "VARCHAR(64) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_ai_conversation_events', 'model', "VARCHAR(191) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_ai_conversation_events', 'meta_json', 'LONGTEXT NULL');
        if (!accumul8_table_has_index('accumul8_ai_conversation_events', 'idx_accumul8_ai_events_conversation')) {
            Database::execute('ALTER TABLE accumul8_ai_conversation_events ADD INDEX idx_accumul8_ai_events_conversation (conversation_id, created_at)');
        }
        if (!accumul8_table_has_index('accumul8_ai_conversation_events', 'idx_accumul8_ai_events_owner')) {
            Database::execute('ALTER TABLE accumul8_ai_conversation_events ADD INDEX idx_accumul8_ai_events_owner (owner_user_id, created_at)');
        }
        if (!accumul8_table_has_foreign_key('accumul8_ai_conversation_events', 'fk_accumul8_ai_events_conversation')) {
            Database::execute('ALTER TABLE accumul8_ai_conversation_events ADD CONSTRAINT fk_accumul8_ai_events_conversation FOREIGN KEY (conversation_id) REFERENCES accumul8_ai_conversations(id) ON DELETE CASCADE');
        }
        if (!accumul8_table_has_foreign_key('accumul8_ai_conversation_events', 'fk_accumul8_ai_events_owner')) {
            Database::execute('ALTER TABLE accumul8_ai_conversation_events ADD CONSTRAINT fk_accumul8_ai_events_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE');
        }
        accumul8_table_add_column_if_missing('accumul8_message_board_messages', 'actor_user_id', 'INT NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_message_board_messages', 'source_kind', "VARCHAR(64) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_message_board_messages', 'message_level', "VARCHAR(24) NOT NULL DEFAULT 'info'");
        accumul8_table_add_column_if_missing('accumul8_message_board_messages', 'title', "VARCHAR(191) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_message_board_messages', 'meta_json', 'LONGTEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_message_board_messages', 'is_acknowledged', 'TINYINT(1) NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_message_board_messages', 'acknowledged_at', 'DATETIME NULL');
        accumul8_table_add_column_if_missing('accumul8_message_board_messages', 'acknowledged_by_user_id', 'INT NULL');
        if (!accumul8_table_has_index('accumul8_message_board_messages', 'idx_accumul8_message_board_owner_ack')) {
            Database::execute('ALTER TABLE accumul8_message_board_messages ADD INDEX idx_accumul8_message_board_owner_ack (owner_user_id, is_acknowledged, created_at)');
        }
        if (!accumul8_table_has_foreign_key('accumul8_message_board_messages', 'fk_accumul8_message_board_owner')) {
            Database::execute('ALTER TABLE accumul8_message_board_messages ADD CONSTRAINT fk_accumul8_message_board_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE');
        }
        accumul8_table_add_column_if_missing('accumul8_statement_reconciliation_logs', 'transaction_count', 'INT NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_statement_reconciliation_logs', 'already_reconciled_count', 'INT NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_statement_reconciliation_logs', 'reconciled_now_count', 'INT NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_statement_reconciliation_logs', 'linked_match_count', 'INT NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_statement_reconciliation_logs', 'missing_match_count', 'INT NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_statement_reconciliation_logs', 'invalid_row_count', 'INT NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_statement_reconciliation_logs', 'summary_text', 'TEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_reconciliation_logs', 'details_json', 'LONGTEXT NULL');
        if (!accumul8_table_has_index('accumul8_statement_reconciliation_logs', 'idx_accumul8_statement_recon_owner')) {
            Database::execute('ALTER TABLE accumul8_statement_reconciliation_logs ADD INDEX idx_accumul8_statement_recon_owner (owner_user_id)');
        }
        if (!accumul8_table_has_index('accumul8_statement_reconciliation_logs', 'idx_accumul8_statement_recon_upload')) {
            Database::execute('ALTER TABLE accumul8_statement_reconciliation_logs ADD INDEX idx_accumul8_statement_recon_upload (statement_upload_id)');
        }
        if (!accumul8_table_has_foreign_key('accumul8_statement_reconciliation_logs', 'fk_accumul8_statement_recon_owner')) {
            Database::execute('ALTER TABLE accumul8_statement_reconciliation_logs ADD CONSTRAINT fk_accumul8_statement_recon_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE');
        }
        if (!accumul8_table_has_foreign_key('accumul8_statement_reconciliation_logs', 'fk_accumul8_statement_recon_upload')) {
            Database::execute('ALTER TABLE accumul8_statement_reconciliation_logs ADD CONSTRAINT fk_accumul8_statement_recon_upload FOREIGN KEY (statement_upload_id) REFERENCES accumul8_statement_uploads(id) ON DELETE CASCADE');
        }
        accumul8_table_add_column_if_missing('accumul8_statement_audit_runs', 'actor_user_id', 'INT NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_statement_audit_runs', 'audit_start_date', 'DATE NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_audit_runs', 'audit_end_date', 'DATE NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_audit_runs', 'upload_count', 'INT NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_statement_audit_runs', 'passed_count', 'INT NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_statement_audit_runs', 'warning_count', 'INT NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_statement_audit_runs', 'failed_count', 'INT NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_statement_audit_runs', 'summary_text', 'TEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_audit_runs', 'report_json', 'LONGTEXT NULL');
        if (!accumul8_table_has_index('accumul8_statement_audit_runs', 'idx_accumul8_statement_audit_owner')) {
            Database::execute('ALTER TABLE accumul8_statement_audit_runs ADD INDEX idx_accumul8_statement_audit_owner (owner_user_id)');
        }
        if (!accumul8_table_has_foreign_key('accumul8_statement_audit_runs', 'fk_accumul8_statement_audit_owner')) {
            Database::execute('ALTER TABLE accumul8_statement_audit_runs ADD CONSTRAINT fk_accumul8_statement_audit_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE');
        }

        if (!accumul8_table_has_column('accumul8_transactions', 'debtor_id')) {
            Database::execute('ALTER TABLE accumul8_transactions ADD COLUMN debtor_id INT NULL AFTER contact_id');
        }
        if (!accumul8_table_has_index('accumul8_contacts', 'idx_accumul8_contacts_entity')) {
            Database::execute('ALTER TABLE accumul8_contacts ADD INDEX idx_accumul8_contacts_entity (entity_id)');
        }
        if (!accumul8_table_has_foreign_key('accumul8_contacts', 'fk_accumul8_contacts_entity')) {
            Database::execute('ALTER TABLE accumul8_contacts ADD CONSTRAINT fk_accumul8_contacts_entity FOREIGN KEY (entity_id) REFERENCES accumul8_entities(id) ON DELETE SET NULL');
        }
        if (!accumul8_table_has_index('accumul8_debtors', 'idx_accumul8_debtors_entity')) {
            Database::execute('ALTER TABLE accumul8_debtors ADD INDEX idx_accumul8_debtors_entity (entity_id)');
        }
        if (!accumul8_table_has_foreign_key('accumul8_debtors', 'fk_accumul8_debtors_entity')) {
            Database::execute('ALTER TABLE accumul8_debtors ADD CONSTRAINT fk_accumul8_debtors_entity FOREIGN KEY (entity_id) REFERENCES accumul8_entities(id) ON DELETE SET NULL');
        }
        if (!accumul8_table_has_index('accumul8_recurring_payments', 'idx_accumul8_recurring_entity')) {
            Database::execute('ALTER TABLE accumul8_recurring_payments ADD INDEX idx_accumul8_recurring_entity (entity_id)');
        }
        if (!accumul8_table_has_foreign_key('accumul8_recurring_payments', 'fk_accumul8_recurring_entity')) {
            Database::execute('ALTER TABLE accumul8_recurring_payments ADD CONSTRAINT fk_accumul8_recurring_entity FOREIGN KEY (entity_id) REFERENCES accumul8_entities(id) ON DELETE SET NULL');
        }
        if (!accumul8_table_has_index('accumul8_transactions', 'idx_accumul8_tx_entity')) {
            Database::execute('ALTER TABLE accumul8_transactions ADD INDEX idx_accumul8_tx_entity (entity_id)');
        }
        if (!accumul8_table_has_index('accumul8_transactions', 'idx_accumul8_tx_balance_entity')) {
            Database::execute('ALTER TABLE accumul8_transactions ADD INDEX idx_accumul8_tx_balance_entity (balance_entity_id)');
        }
        if (!accumul8_table_has_foreign_key('accumul8_transactions', 'fk_accumul8_tx_entity')) {
            Database::execute('ALTER TABLE accumul8_transactions ADD CONSTRAINT fk_accumul8_tx_entity FOREIGN KEY (entity_id) REFERENCES accumul8_entities(id) ON DELETE SET NULL');
        }
        if (!accumul8_table_has_foreign_key('accumul8_transactions', 'fk_accumul8_tx_balance_entity')) {
            Database::execute('ALTER TABLE accumul8_transactions ADD CONSTRAINT fk_accumul8_tx_balance_entity FOREIGN KEY (balance_entity_id) REFERENCES accumul8_entities(id) ON DELETE SET NULL');
        }
        if (!accumul8_table_has_index('accumul8_transactions', 'idx_accumul8_tx_debtor')) {
            Database::execute('ALTER TABLE accumul8_transactions ADD INDEX idx_accumul8_tx_debtor (debtor_id)');
        }
        if (!accumul8_table_has_foreign_key('accumul8_transactions', 'fk_accumul8_tx_debtor')) {
            Database::execute('ALTER TABLE accumul8_transactions ADD CONSTRAINT fk_accumul8_tx_debtor FOREIGN KEY (debtor_id) REFERENCES accumul8_debtors(id) ON DELETE SET NULL');
        }
        if (!$hadBudgetPlannerColumn) {
            $sourceKindExpr = accumul8_table_has_column('accumul8_transactions', 'source_kind') ? "COALESCE(source_kind, 'manual')" : "'manual'";
            $debtorExpr = accumul8_table_has_column('accumul8_transactions', 'debtor_id') ? 'COALESCE(debtor_id, 0) > 0' : '0 = 1';
            Database::execute(
                'UPDATE accumul8_transactions
                 SET is_budget_planner = CASE
                    WHEN ' . $sourceKindExpr . " = 'teller' THEN 0
                    WHEN " . $debtorExpr . ' THEN 0
                    ELSE 1
                 END'
            );
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

    $columns = ['owner_user_id', 'account_name', 'current_balance'];
    $placeholders = ['?', '?', '?'];
    $params = [$viewerId, 'Primary Checking', 0.00];

    if (accumul8_table_has_column('accumul8_accounts', 'account_type')) {
        $columns[] = 'account_type';
        $placeholders[] = '?';
        $params[] = 'checking';
    }
    if (accumul8_table_has_column('accumul8_accounts', 'institution_name')) {
        $columns[] = 'institution_name';
        $placeholders[] = '?';
        $params[] = 'Manual';
    }
    if (accumul8_table_has_column('accumul8_accounts', 'available_balance')) {
        $columns[] = 'available_balance';
        $placeholders[] = '?';
        $params[] = 0.00;
    }

    Database::execute(
        'INSERT INTO accumul8_accounts (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $placeholders) . ')',
        $params
    );

    return (int)Database::lastInsertId();
}

function accumul8_list_banking_organizations(int $viewerId): array
{
    if (!accumul8_table_exists('accumul8_account_groups')) {
        return [];
    }

    $websiteUrlSelect = accumul8_optional_select('accumul8_account_groups', 'website_url', 'website_url', "'' AS website_url");
    $loginUrlSelect = accumul8_optional_select('accumul8_account_groups', 'login_url', 'login_url', "'' AS login_url");
    $supportUrlSelect = accumul8_optional_select('accumul8_account_groups', 'support_url', 'support_url', "'' AS support_url");
    $supportPhoneSelect = accumul8_optional_select('accumul8_account_groups', 'support_phone', 'support_phone', "'' AS support_phone");
    $supportEmailSelect = accumul8_optional_select('accumul8_account_groups', 'support_email', 'support_email', "'' AS support_email");
    $routingNumberSelect = accumul8_optional_select('accumul8_account_groups', 'routing_number', 'routing_number', "'' AS routing_number");
    $mailingAddressSelect = accumul8_optional_select('accumul8_account_groups', 'mailing_address', 'mailing_address', "'' AS mailing_address");
    $iconPathSelect = accumul8_optional_select('accumul8_account_groups', 'icon_path', 'icon_path', "'' AS icon_path");
    $rows = Database::queryAll(
        'SELECT id, group_name, institution_name, ' . $websiteUrlSelect . ', ' . $loginUrlSelect . ', ' . $supportUrlSelect . ', ' . $supportPhoneSelect . ', ' . $supportEmailSelect . ', ' . $routingNumberSelect . ', ' . $mailingAddressSelect . ', ' . $iconPathSelect . ', COALESCE(notes, "") AS notes, is_active
         FROM accumul8_account_groups
         WHERE owner_user_id = ?
         ORDER BY is_active DESC, group_name ASC, id ASC',
        [$viewerId]
    );

    return array_map(static function (array $r): array {
        return [
            'id' => (int)($r['id'] ?? 0),
            'banking_organization_name' => (string)($r['group_name'] ?? ''),
            'institution_name' => (string)($r['institution_name'] ?? ''),
            'website_url' => (string)($r['website_url'] ?? ''),
            'login_url' => (string)($r['login_url'] ?? ''),
            'support_url' => (string)($r['support_url'] ?? ''),
            'support_phone' => (string)($r['support_phone'] ?? ''),
            'support_email' => (string)($r['support_email'] ?? ''),
            'routing_number' => (string)($r['routing_number'] ?? ''),
            'mailing_address' => (string)($r['mailing_address'] ?? ''),
            'icon_path' => (string)($r['icon_path'] ?? ''),
            'notes' => accumul8_filter_note_for_display($r['notes'] ?? '', 1500),
            'is_active' => (int)($r['is_active'] ?? 0),
        ];
    }, $rows);
}

function accumul8_list_contacts(int $viewerId): array
{
    $rows = Database::queryAll(
        'SELECT id, ' . accumul8_optional_select('accumul8_contacts', 'entity_id', 'entity_id', 'NULL AS entity_id') . ', contact_name, contact_type, default_amount, email, phone_number, street_address, city, state, zip, notes, is_active, created_at, updated_at
         FROM accumul8_contacts
         WHERE owner_user_id = ?
         ORDER BY contact_name ASC, id ASC',
        [$viewerId]
    );

    return array_map(static function (array $r): array {
        return [
            'id' => (int)($r['id'] ?? 0),
            'entity_id' => isset($r['entity_id']) ? (int)$r['entity_id'] : null,
            'contact_name' => (string)($r['contact_name'] ?? ''),
            'contact_type' => accumul8_normalize_contact_type_value((string)($r['contact_type'] ?? 'payee')),
            'default_amount' => (float)($r['default_amount'] ?? 0),
            'email' => (string)($r['email'] ?? ''),
            'phone_number' => (string)($r['phone_number'] ?? ''),
            'street_address' => (string)($r['street_address'] ?? ''),
            'city' => (string)($r['city'] ?? ''),
            'state' => (string)($r['state'] ?? ''),
            'zip' => (string)($r['zip'] ?? ''),
            'notes' => accumul8_filter_note_for_display($r['notes'] ?? '', 1500),
            'is_active' => (int)($r['is_active'] ?? 0),
            'created_at' => (string)($r['created_at'] ?? ''),
            'updated_at' => (string)($r['updated_at'] ?? ''),
        ];
    }, $rows);
}

function accumul8_list_entity_aliases(int $viewerId): array
{
    if (!accumul8_table_exists('accumul8_entity_aliases')) {
        return [];
    }

    $rows = Database::queryAll(
        'SELECT id, entity_id, alias_name
         FROM accumul8_entity_aliases
         WHERE owner_user_id = ?
         ORDER BY alias_name ASC, id ASC',
        [$viewerId]
    );

    return array_map(static function (array $row): array {
        return [
            'id' => (int)($row['id'] ?? 0),
            'entity_id' => (int)($row['entity_id'] ?? 0),
            'alias_name' => (string)($row['alias_name'] ?? ''),
        ];
    }, $rows);
}

function accumul8_list_entity_endex_scan_logs(int $viewerId, int $limit = 12): array
{
    if (!accumul8_table_exists('accumul8_entity_endex_scan_logs')) {
        return [];
    }

    $limit = max(1, min(50, $limit));
    $rows = Database::queryAll(
        'SELECT id, scanned_entity_count, touched_entity_count, created_count, updated_count, skipped_count, conflict_count, summary_text, items_json, created_at
         FROM accumul8_entity_endex_scan_logs
         WHERE owner_user_id = ?
         ORDER BY id DESC
         LIMIT ' . $limit,
        [$viewerId]
    );

    return array_map(static function (array $row): array {
        $decodedItems = json_decode((string)($row['items_json'] ?? '[]'), true);
        $items = [];
        foreach (is_array($decodedItems) ? $decodedItems : [] as $item) {
            if (!is_array($item)) {
                continue;
            }
            $status = (string)($item['status'] ?? '');
            if (!in_array($status, ['created', 'updated'], true)) {
                $status = 'created';
            }
            $items[] = [
                'parent_entity_id' => (int)($item['parent_entity_id'] ?? 0),
                'parent_name' => (string)($item['parent_name'] ?? ''),
                'alias_name' => (string)($item['alias_name'] ?? ''),
                'status' => $status,
            ];
        }

        return [
            'id' => (int)($row['id'] ?? 0),
            'scanned_entity_count' => (int)($row['scanned_entity_count'] ?? 0),
            'touched_entity_count' => (int)($row['touched_entity_count'] ?? 0),
            'created_count' => (int)($row['created_count'] ?? 0),
            'updated_count' => (int)($row['updated_count'] ?? 0),
            'skipped_count' => (int)($row['skipped_count'] ?? 0),
            'conflict_count' => (int)($row['conflict_count'] ?? 0),
            'summary_text' => (string)($row['summary_text'] ?? ''),
            'items' => $items,
            'created_at' => (string)($row['created_at'] ?? ''),
        ];
    }, $rows);
}

function accumul8_list_entities(int $viewerId): array
{
    if (!accumul8_table_exists('accumul8_entities')) {
        return [];
    }

    $aliasesByEntityId = [];
    foreach (accumul8_list_entity_aliases($viewerId) as $alias) {
        $entityId = (int)($alias['entity_id'] ?? 0);
        if ($entityId <= 0) {
            continue;
        }
        if (!isset($aliasesByEntityId[$entityId])) {
            $aliasesByEntityId[$entityId] = [];
        }
        $aliasesByEntityId[$entityId][] = $alias;
    }

    $rows = Database::queryAll(
        'SELECT e.id, e.owner_user_id, e.display_name, e.entity_kind, e.contact_type, e.is_payee, e.is_payer, e.is_vendor, e.is_balance_person,
                e.default_amount, e.email, e.phone_number, e.street_address, e.city, e.state, e.zip, e.notes, e.is_active,
                e.legacy_contact_id, e.legacy_debtor_id,
                c.id AS contact_id, c.contact_name,
                d.id AS debtor_id, d.debtor_name
         FROM accumul8_entities e
         LEFT JOIN accumul8_contacts c
           ON c.id = e.legacy_contact_id
          AND c.owner_user_id = e.owner_user_id
         LEFT JOIN accumul8_debtors d
           ON d.id = e.legacy_debtor_id
          AND d.owner_user_id = e.owner_user_id
         WHERE e.owner_user_id = ?
         ORDER BY e.display_name ASC, e.id ASC',
        [$viewerId]
    );

    return array_map(static function (array $r): array {
        return [
            'id' => (int)($r['id'] ?? 0),
            'owner_user_id' => (int)($r['owner_user_id'] ?? 0),
            'display_name' => (string)($r['display_name'] ?? ''),
            'entity_kind' => accumul8_entity_kind_from_vendor_state((string)($r['entity_kind'] ?? 'business'), (int)($r['is_vendor'] ?? 0)),
            'contact_type' => accumul8_normalize_contact_type_value(
                (int)($r['is_balance_person'] ?? 0) === 1 ? 'repayment' : (string)($r['contact_type'] ?? 'payee')
            ),
            'is_payee' => (int)($r['is_payee'] ?? 0),
            'is_payer' => (int)($r['is_payer'] ?? 0),
            'is_vendor' => (int)($r['is_vendor'] ?? 0),
            'is_balance_person' => (int)($r['is_balance_person'] ?? 0),
            'default_amount' => (float)($r['default_amount'] ?? 0),
            'email' => (string)($r['email'] ?? ''),
            'phone_number' => (string)($r['phone_number'] ?? ''),
            'street_address' => (string)($r['street_address'] ?? ''),
            'city' => (string)($r['city'] ?? ''),
            'state' => (string)($r['state'] ?? ''),
            'zip' => (string)($r['zip'] ?? ''),
            'notes' => accumul8_filter_note_for_display($r['notes'] ?? '', 1500),
            'is_active' => (int)($r['is_active'] ?? 0),
            'legacy_contact_id' => isset($r['legacy_contact_id']) ? (int)$r['legacy_contact_id'] : null,
            'legacy_debtor_id' => isset($r['legacy_debtor_id']) ? (int)$r['legacy_debtor_id'] : null,
            'contact_id' => isset($r['contact_id']) ? (int)$r['contact_id'] : null,
            'debtor_id' => isset($r['debtor_id']) ? (int)$r['debtor_id'] : null,
            'contact_name' => (string)($r['contact_name'] ?? ''),
            'debtor_name' => (string)($r['debtor_name'] ?? ''),
            'aliases' => $aliasesByEntityId[(int)($r['id'] ?? 0)] ?? [],
        ];
    }, $rows);
}

function accumul8_list_recurring(int $viewerId): array
{
    $entityIdSelect = accumul8_optional_select('accumul8_recurring_payments', 'entity_id', 'rp.entity_id', 'NULL AS entity_id');
    $accountIdSelect = accumul8_optional_select('accumul8_recurring_payments', 'account_id', 'rp.account_id', 'NULL AS account_id');
    $intervalCountSelect = accumul8_optional_select('accumul8_recurring_payments', 'interval_count', 'rp.interval_count', '1 AS interval_count');
    $paymentMethodSelect = accumul8_optional_select('accumul8_recurring_payments', 'payment_method', 'rp.payment_method', "'unspecified' AS payment_method");
    $dayOfMonthSelect = accumul8_optional_select('accumul8_recurring_payments', 'day_of_month', 'rp.day_of_month', 'NULL AS day_of_month');
    $dayOfWeekSelect = accumul8_optional_select('accumul8_recurring_payments', 'day_of_week', 'rp.day_of_week', 'NULL AS day_of_week');
    $paidDateSelect = accumul8_optional_select('accumul8_recurring_payments', 'paid_date', 'rp.paid_date', "'' AS paid_date");
    $notesSelect = accumul8_optional_select('accumul8_recurring_payments', 'notes', 'rp.notes', "'' AS notes");
    $isActiveSelect = accumul8_optional_select('accumul8_recurring_payments', 'is_active', 'rp.is_active', '1 AS is_active');
    $isBudgetPlannerSelect = accumul8_optional_select('accumul8_recurring_payments', 'is_budget_planner', 'rp.is_budget_planner', '0 AS is_budget_planner');
    $accountJoin = accumul8_table_has_column('accumul8_recurring_payments', 'account_id')
        ? 'LEFT JOIN accumul8_accounts a ON a.id = rp.account_id'
        : '';
    $bankingOrganizationJoin = accumul8_table_has_column('accumul8_accounts', 'account_group_id')
        ? 'LEFT JOIN accumul8_account_groups ag ON ag.id = a.account_group_id AND ag.owner_user_id = rp.owner_user_id'
        : '';
    $accountNameSelect = accumul8_table_has_column('accumul8_recurring_payments', 'account_id')
        ? 'a.account_name, a.account_group_id, COALESCE(ag.group_name, "") AS banking_organization_name'
        : "'' AS account_name, NULL AS account_group_id, '' AS banking_organization_name";

    $rows = Database::queryAll(
        'SELECT rp.id, ' . $entityIdSelect . ', COALESCE(e.display_name, "") AS entity_name, rp.contact_id, ' . $accountIdSelect . ', rp.title, rp.direction, rp.amount, rp.frequency, ' . $paymentMethodSelect . ', ' . $intervalCountSelect . ',
                ' . $dayOfMonthSelect . ', ' . $dayOfWeekSelect . ', rp.next_due_date, ' . $paidDateSelect . ', ' . $notesSelect . ', ' . $isActiveSelect . ', ' . $isBudgetPlannerSelect . ',
                c.contact_name, ' . $accountNameSelect . '
         FROM accumul8_recurring_payments rp
         LEFT JOIN accumul8_contacts c ON c.id = rp.contact_id
         LEFT JOIN accumul8_entities e ON e.id = rp.entity_id
         ' . $accountJoin . '
         ' . $bankingOrganizationJoin . '
         WHERE rp.owner_user_id = ?
         ORDER BY rp.next_due_date ASC, rp.id ASC',
        [$viewerId]
    );

    return array_map(static function (array $r): array {
        return [
            'id' => (int)($r['id'] ?? 0),
            'entity_id' => isset($r['entity_id']) ? (int)$r['entity_id'] : null,
            'entity_name' => (string)($r['entity_name'] ?? ''),
            'contact_id' => isset($r['contact_id']) ? (int)$r['contact_id'] : null,
            'account_id' => isset($r['account_id']) ? (int)$r['account_id'] : null,
            'banking_organization_id' => isset($r['account_group_id']) ? (int)$r['account_group_id'] : null,
            'title' => (string)($r['title'] ?? ''),
            'direction' => (string)($r['direction'] ?? 'outflow'),
            'amount' => (float)($r['amount'] ?? 0),
            'frequency' => (string)($r['frequency'] ?? 'monthly'),
            'payment_method' => (string)($r['payment_method'] ?? 'unspecified'),
            'interval_count' => (int)($r['interval_count'] ?? 1),
            'day_of_month' => isset($r['day_of_month']) ? (int)$r['day_of_month'] : null,
            'day_of_week' => isset($r['day_of_week']) ? (int)$r['day_of_week'] : null,
            'next_due_date' => (string)($r['next_due_date'] ?? ''),
            'paid_date' => (string)($r['paid_date'] ?? ''),
            'notes' => accumul8_filter_note_for_display($r['notes'] ?? '', 1500),
            'is_active' => (int)($r['is_active'] ?? 0),
            'is_budget_planner' => (int)($r['is_budget_planner'] ?? 0),
            'contact_name' => (string)($r['contact_name'] ?? ''),
            'account_name' => (string)($r['account_name'] ?? ''),
            'banking_organization_name' => (string)($r['banking_organization_name'] ?? ''),
        ];
    }, $rows);
}

function accumul8_list_accounts(int $viewerId): array
{
    $bankingOrganizationIdSelect = accumul8_optional_select('accumul8_accounts', 'account_group_id', 'a.account_group_id', 'NULL AS account_group_id');
    $bankConnectionIdSelect = accumul8_optional_select('accumul8_accounts', 'bank_connection_id', 'a.bank_connection_id', 'NULL AS bank_connection_id');
    $providerNameSelect = accumul8_optional_select('accumul8_accounts', 'provider_name', 'a.provider_name', "'' AS provider_name");
    $tellerAccountIdSelect = accumul8_optional_select('accumul8_accounts', 'teller_account_id', 'a.teller_account_id', "'' AS teller_account_id");
    $tellerEnrollmentIdSelect = accumul8_optional_select('accumul8_accounts', 'teller_enrollment_id', 'a.teller_enrollment_id', "'' AS teller_enrollment_id");
    $accountNicknameSelect = accumul8_optional_select('accumul8_accounts', 'account_nickname', 'a.account_nickname', "'' AS account_nickname");
    $accountTypeSelect = accumul8_optional_select('accumul8_accounts', 'account_type', 'a.account_type', "'checking' AS account_type");
    $accountSubtypeSelect = accumul8_optional_select('accumul8_accounts', 'account_subtype', 'a.account_subtype', "'' AS account_subtype");
    $institutionNameSelect = accumul8_optional_select('accumul8_accounts', 'institution_name', 'a.institution_name', "'' AS institution_name");
    $accountNumberMaskSelect = accumul8_optional_select('accumul8_accounts', 'account_number_mask', 'a.account_number_mask', "'' AS account_number_mask");
    $maskLast4Select = accumul8_optional_select('accumul8_accounts', 'mask_last4', 'a.mask_last4', "'' AS mask_last4");
    $routingNumberSelect = accumul8_optional_select('accumul8_accounts', 'routing_number', 'a.routing_number', "'' AS routing_number");
    $currencyCodeSelect = accumul8_optional_select('accumul8_accounts', 'currency_code', 'a.currency_code', "'USD' AS currency_code");
    $tellerSyncAnchorDateSelect = accumul8_optional_select('accumul8_accounts', 'teller_sync_anchor_date', 'a.teller_sync_anchor_date', 'NULL AS teller_sync_anchor_date');
    $tellerBackfillCursorIdSelect = accumul8_optional_select('accumul8_accounts', 'teller_backfill_cursor_id', 'a.teller_backfill_cursor_id', "'' AS teller_backfill_cursor_id");
    $tellerBackfillCompleteSelect = accumul8_optional_select('accumul8_accounts', 'teller_backfill_complete', 'a.teller_backfill_complete', '0 AS teller_backfill_complete');
    $tellerHistoryStartDateSelect = accumul8_optional_select('accumul8_accounts', 'teller_history_start_date', 'a.teller_history_start_date', 'NULL AS teller_history_start_date');
    $tellerHistoryEndDateSelect = accumul8_optional_select('accumul8_accounts', 'teller_history_end_date', 'a.teller_history_end_date', 'NULL AS teller_history_end_date');
    $statementDaySelect = accumul8_optional_select('accumul8_accounts', 'statement_day_of_month', 'a.statement_day_of_month', 'NULL AS statement_day_of_month');
    $paymentDueDaySelect = accumul8_optional_select('accumul8_accounts', 'payment_due_day_of_month', 'a.payment_due_day_of_month', 'NULL AS payment_due_day_of_month');
    $autopayEnabledSelect = accumul8_optional_select('accumul8_accounts', 'autopay_enabled', 'a.autopay_enabled', '0 AS autopay_enabled');
    $creditLimitSelect = accumul8_optional_select('accumul8_accounts', 'credit_limit', 'a.credit_limit', '0.00 AS credit_limit');
    $interestRateSelect = accumul8_optional_select('accumul8_accounts', 'interest_rate', 'a.interest_rate', '0.0000 AS interest_rate');
    $minimumPaymentSelect = accumul8_optional_select('accumul8_accounts', 'minimum_payment', 'a.minimum_payment', '0.00 AS minimum_payment');
    $openedOnSelect = accumul8_optional_select('accumul8_accounts', 'opened_on', 'a.opened_on', 'NULL AS opened_on');
    $closedOnSelect = accumul8_optional_select('accumul8_accounts', 'closed_on', 'a.closed_on', 'NULL AS closed_on');
    $notesSelect = accumul8_optional_select('accumul8_accounts', 'notes', 'a.notes', "'' AS notes");
    $availableBalanceSelect = accumul8_optional_select('accumul8_accounts', 'available_balance', 'a.available_balance', 'a.current_balance AS available_balance');
    $isActiveSelect = accumul8_optional_select('accumul8_accounts', 'is_active', 'a.is_active', '1 AS is_active');

    $rows = Database::queryAll(
        'SELECT a.id, ' . $bankingOrganizationIdSelect . ', ' . $bankConnectionIdSelect . ', ' . $providerNameSelect . ', ' . $tellerAccountIdSelect . ', ' . $tellerEnrollmentIdSelect . ', a.account_name, ' . $accountNicknameSelect . ', ' . $accountTypeSelect . ', ' . $accountSubtypeSelect . ', ' . $institutionNameSelect . ', ' . $accountNumberMaskSelect . ', ' . $maskLast4Select . ', ' . $routingNumberSelect . ', ' . $currencyCodeSelect . ', ' . $tellerSyncAnchorDateSelect . ', ' . $tellerBackfillCursorIdSelect . ', ' . $tellerBackfillCompleteSelect . ', ' . $tellerHistoryStartDateSelect . ', ' . $tellerHistoryEndDateSelect . ', ' . $statementDaySelect . ', ' . $paymentDueDaySelect . ', ' . $autopayEnabledSelect . ', ' . $creditLimitSelect . ', ' . $interestRateSelect . ', ' . $minimumPaymentSelect . ', ' . $openedOnSelect . ', ' . $closedOnSelect . ', ' . $notesSelect . ',
                a.current_balance, ' . $availableBalanceSelect . ', ' . $isActiveSelect . ', COALESCE(ag.group_name, "") AS banking_organization_name
         FROM accumul8_accounts a
         LEFT JOIN accumul8_account_groups ag ON ag.id = a.account_group_id AND ag.owner_user_id = a.owner_user_id
        WHERE a.owner_user_id = ?
         ORDER BY COALESCE(ag.group_name, ""), a.account_name ASC, a.id ASC',
        [$viewerId]
    );

    return array_map(static function (array $r): array {
        return [
            'id' => (int)($r['id'] ?? 0),
            'banking_organization_id' => isset($r['account_group_id']) ? (int)$r['account_group_id'] : null,
            'bank_connection_id' => isset($r['bank_connection_id']) ? (int)$r['bank_connection_id'] : null,
            'provider_name' => (string)($r['provider_name'] ?? ''),
            'teller_account_id' => (string)($r['teller_account_id'] ?? ''),
            'teller_enrollment_id' => (string)($r['teller_enrollment_id'] ?? ''),
            'account_name' => (string)($r['account_name'] ?? ''),
            'account_nickname' => (string)($r['account_nickname'] ?? ''),
            'banking_organization_name' => (string)($r['banking_organization_name'] ?? ''),
            'account_type' => (string)($r['account_type'] ?? 'checking'),
            'account_subtype' => (string)($r['account_subtype'] ?? ''),
            'institution_name' => (string)($r['institution_name'] ?? ''),
            'account_number_mask' => (string)($r['account_number_mask'] ?? ''),
            'mask_last4' => (string)($r['mask_last4'] ?? ''),
            'routing_number' => (string)($r['routing_number'] ?? ''),
            'currency_code' => (string)($r['currency_code'] ?? 'USD'),
            'teller_sync_anchor_date' => isset($r['teller_sync_anchor_date']) && $r['teller_sync_anchor_date'] !== null ? (string)$r['teller_sync_anchor_date'] : '',
            'teller_backfill_cursor_id' => (string)($r['teller_backfill_cursor_id'] ?? ''),
            'teller_backfill_complete' => (int)($r['teller_backfill_complete'] ?? 0),
            'teller_history_start_date' => isset($r['teller_history_start_date']) && $r['teller_history_start_date'] !== null ? (string)$r['teller_history_start_date'] : '',
            'teller_history_end_date' => isset($r['teller_history_end_date']) && $r['teller_history_end_date'] !== null ? (string)$r['teller_history_end_date'] : '',
            'statement_day_of_month' => isset($r['statement_day_of_month']) ? (int)$r['statement_day_of_month'] : null,
            'payment_due_day_of_month' => isset($r['payment_due_day_of_month']) ? (int)$r['payment_due_day_of_month'] : null,
            'autopay_enabled' => (int)($r['autopay_enabled'] ?? 0),
            'credit_limit' => (float)($r['credit_limit'] ?? 0),
            'interest_rate' => (float)($r['interest_rate'] ?? 0),
            'minimum_payment' => (float)($r['minimum_payment'] ?? 0),
            'opened_on' => isset($r['opened_on']) && $r['opened_on'] !== null ? (string)$r['opened_on'] : '',
            'closed_on' => isset($r['closed_on']) && $r['closed_on'] !== null ? (string)$r['closed_on'] : '',
            'notes' => accumul8_filter_note_for_display($r['notes'] ?? '', 1500),
            'current_balance' => (float)($r['current_balance'] ?? 0),
            'available_balance' => (float)($r['available_balance'] ?? 0),
            'is_active' => (int)($r['is_active'] ?? 0),
        ];
    }, $rows);
}

function accumul8_list_debtors(int $viewerId): array
{
    if (!accumul8_has_debtor_support()) {
        return [];
    }

    $rows = Database::queryAll(
        'SELECT d.id, ' . accumul8_optional_select('accumul8_debtors', 'entity_id', 'd.entity_id', 'NULL AS entity_id') . ', COALESCE(e.display_name, "") AS entity_name, d.contact_id, d.debtor_name, d.notes, d.is_active, d.created_at, d.updated_at,
                c.contact_name,
                COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) AS total_loaned,
                COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) AS total_repaid,
                COALESCE(COUNT(t.id), 0) AS transaction_count,
                MAX(t.transaction_date) AS last_activity_date
         FROM accumul8_debtors d
         LEFT JOIN accumul8_contacts c
           ON c.id = d.contact_id
         LEFT JOIN accumul8_entities e
           ON e.id = d.entity_id
         LEFT JOIN accumul8_transactions t
           ON t.debtor_id = d.id
          AND t.owner_user_id = d.owner_user_id
         WHERE d.owner_user_id = ?
         GROUP BY d.id, d.entity_id, e.display_name, d.contact_id, d.debtor_name, d.notes, d.is_active, d.created_at, d.updated_at, c.contact_name
         ORDER BY d.debtor_name ASC, d.id ASC',
        [$viewerId]
    );

    return array_map(static function (array $r): array {
        $totalLoaned = (float)($r['total_loaned'] ?? 0);
        $totalRepaid = (float)($r['total_repaid'] ?? 0);
        return [
            'id' => (int)($r['id'] ?? 0),
            'entity_id' => isset($r['entity_id']) ? (int)$r['entity_id'] : null,
            'entity_name' => (string)($r['entity_name'] ?? ''),
            'contact_id' => isset($r['contact_id']) ? (int)$r['contact_id'] : null,
            'debtor_name' => (string)($r['debtor_name'] ?? ''),
            'notes' => accumul8_filter_note_for_display($r['notes'] ?? '', 1500),
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
    if (!accumul8_table_exists('accumul8_budget_rows')) {
        return [];
    }

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
    $rtaSelect = accumul8_optional_select('accumul8_transactions', 'rta_amount', 'rta_amount', '0.00 AS rta_amount');
    $sourceKindSelect = accumul8_optional_select('accumul8_transactions', 'source_kind', 'source_kind', "'manual' AS source_kind");
    $rows = Database::queryAll(
        'SELECT id, account_id, amount, running_balance, ' . $rtaSelect . ', ' . $sourceKindSelect . '
         FROM accumul8_transactions
         WHERE owner_user_id = ?
         ORDER BY account_id ASC, transaction_date ASC, id ASC',
        [$viewerId]
    );

    $balances = [];
    $statementBalances = [];
    foreach ($rows as $row) {
        $accountId = isset($row['account_id']) ? (int)$row['account_id'] : 0;
        if (($row['source_kind'] ?? '') === 'statement_pdf') {
            $statementBalances[$accountId] = (float)($row['running_balance'] ?? 0);
            continue;
        }
        $balances[$accountId] = (float)($balances[$accountId] ?? 0);
        $balances[$accountId] += (float)($row['amount'] ?? 0) + (float)($row['rta_amount'] ?? 0);
        Database::execute(
            'UPDATE accumul8_transactions SET running_balance = ? WHERE id = ? AND owner_user_id = ?',
            [round($balances[$accountId], 2), (int)($row['id'] ?? 0), $viewerId]
        );
    }

    Database::execute(
        'UPDATE accumul8_accounts SET current_balance = 0.00 WHERE owner_user_id = ?',
        [$viewerId]
    );
    foreach ($balances as $accountId => $balance) {
        if ($accountId <= 0) {
            continue;
        }
        Database::execute(
            'UPDATE accumul8_accounts SET current_balance = ? WHERE id = ? AND owner_user_id = ?',
            [round($balance, 2), $accountId, $viewerId]
        );
    }
    foreach ($statementBalances as $accountId => $balance) {
        if ($accountId <= 0) {
            continue;
        }
        Database::execute(
            'UPDATE accumul8_accounts SET current_balance = ?, available_balance = ? WHERE id = ? AND owner_user_id = ?',
            [round($balance, 2), round($balance, 2), $accountId, $viewerId]
        );
    }
}

function accumul8_statement_upload_lookup(int $viewerId, array $uploadIds): array
{
    $uploadIds = array_values(array_unique(array_map('intval', $uploadIds)));
    $uploadIds = array_values(array_filter($uploadIds, static fn(int $id): bool => $id > 0));
    if ($uploadIds === []) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($uploadIds), '?'));
    $params = array_merge([$viewerId], $uploadIds);
    $rows = Database::queryAll(
        'SELECT su.id, su.account_id,
                COALESCE(su.transaction_locator_json, "[]") AS transaction_locator_json,
                COALESCE(su.page_catalog_json, "[]") AS page_catalog_json,
                COALESCE(su.parsed_payload_json, "{}") AS parsed_payload_json
         FROM accumul8_statement_uploads su
         WHERE su.owner_user_id = ?
           AND su.id IN (' . $placeholders . ')',
        $params
    );

    $lookup = [];
    foreach ($rows as $row) {
        $locators = json_decode((string)($row['transaction_locator_json'] ?? '[]'), true);
        $pageCatalog = json_decode((string)($row['page_catalog_json'] ?? '[]'), true);
        $parsedPayload = json_decode((string)($row['parsed_payload_json'] ?? '{}'), true);
        if (!is_array($locators) || $locators === []) {
            $locators = is_array($parsedPayload) ? accumul8_statement_transaction_locators($parsedPayload) : [];
        }
        if (!is_array($pageCatalog)) {
            $pageCatalog = [];
        }
        $lookup[(int)($row['id'] ?? 0)] = [
            'id' => (int)($row['id'] ?? 0),
            'account_id' => isset($row['account_id']) ? (int)$row['account_id'] : null,
            'transaction_locators' => $locators,
            'page_catalog' => $pageCatalog,
        ];
    }

    return $lookup;
}

function accumul8_list_transactions(int $viewerId, int $limit = 400): array
{
    $limit = max(1, min(10000, $limit));
    $hasDebtor = accumul8_has_debtor_support();
    $recurringPaymentIdSelect = accumul8_optional_select('accumul8_transactions', 'recurring_payment_id', 't.recurring_payment_id', 'NULL AS recurring_payment_id');
    $dueDateSelect = accumul8_optional_select('accumul8_transactions', 'due_date', 't.due_date', 'NULL AS due_date');
    $paidDateSelect = accumul8_optional_select('accumul8_transactions', 'paid_date', 't.paid_date', 'NULL AS paid_date');
    $entryTypeSelect = accumul8_optional_select('accumul8_transactions', 'entry_type', 't.entry_type', "'manual' AS entry_type");
    $memoSelect = accumul8_optional_select('accumul8_transactions', 'memo', 't.memo', "'' AS memo");
    $rtaSelect = accumul8_optional_select('accumul8_transactions', 'rta_amount', 't.rta_amount', '0.00 AS rta_amount');
    $isReconciledSelect = accumul8_optional_select('accumul8_transactions', 'is_reconciled', 't.is_reconciled', '0 AS is_reconciled');
    $isBudgetPlannerSelect = accumul8_optional_select('accumul8_transactions', 'is_budget_planner', 't.is_budget_planner', '1 AS is_budget_planner');
    $sourceKindSelect = accumul8_optional_select('accumul8_transactions', 'source_kind', 't.source_kind', "'manual' AS source_kind");
    $sourceRefSelect = accumul8_optional_select('accumul8_transactions', 'source_ref', 't.source_ref', "'' AS source_ref");
    $pendingStatusSelect = accumul8_optional_select('accumul8_transactions', 'pending_status', 't.pending_status', '0 AS pending_status');
    $entityIdSelect = accumul8_optional_select('accumul8_transactions', 'entity_id', 't.entity_id', 'NULL AS entity_id');
    $balanceEntityIdSelect = accumul8_optional_select('accumul8_transactions', 'balance_entity_id', 't.balance_entity_id', 'NULL AS balance_entity_id');
    $debtorSelect = $hasDebtor ? 't.debtor_id' : 'NULL AS debtor_id';
    $debtorNameSelect = $hasDebtor ? ', d.debtor_name' : ", '' AS debtor_name";
    $debtorJoin = $hasDebtor ? 'LEFT JOIN accumul8_debtors d ON d.id = t.debtor_id AND d.owner_user_id = t.owner_user_id' : '';
    $bankingOrganizationIdSelect = accumul8_optional_select('accumul8_accounts', 'account_group_id', 'a.account_group_id', 'NULL AS account_group_id');
    $rows = Database::queryAll(
        'SELECT t.id, t.account_id, ' . $bankingOrganizationIdSelect . ', ' . $recurringPaymentIdSelect . ', ' . $entityIdSelect . ', COALESCE(e.display_name, "") AS entity_name, ' . $balanceEntityIdSelect . ', COALESCE(be.display_name, "") AS balance_entity_name, t.contact_id, ' . $debtorSelect . ', t.transaction_date, ' . $dueDateSelect . ', ' . $paidDateSelect . ', ' . $entryTypeSelect . ', t.description, ' . $memoSelect . ',
                t.amount, ' . $rtaSelect . ', t.running_balance, t.is_paid, ' . $isReconciledSelect . ', ' . $isBudgetPlannerSelect . ', ' . $sourceKindSelect . ', ' . $sourceRefSelect . ', ' . $pendingStatusSelect . ',
                c.contact_name, a.account_name, COALESCE(ag.group_name, "") AS banking_organization_name' . $debtorNameSelect . '
         FROM accumul8_transactions t
         LEFT JOIN accumul8_contacts c ON c.id = t.contact_id AND c.owner_user_id = t.owner_user_id
         LEFT JOIN accumul8_entities e ON e.id = t.entity_id
         LEFT JOIN accumul8_entities be ON be.id = t.balance_entity_id
         LEFT JOIN accumul8_accounts a ON a.id = t.account_id AND a.owner_user_id = t.owner_user_id
         LEFT JOIN accumul8_account_groups ag ON ag.id = a.account_group_id AND ag.owner_user_id = t.owner_user_id
         ' . $debtorJoin . '
         WHERE t.owner_user_id = ?
         ORDER BY t.transaction_date DESC, t.id DESC
         LIMIT ' . (int)$limit,
        [$viewerId]
    );

    $uploadIds = [];
    foreach ($rows as $row) {
        $sourceKind = (string)($row['source_kind'] ?? '');
        if ($sourceKind !== 'statement_upload' && $sourceKind !== 'statement_pdf') {
            continue;
        }
        $uploadId = accumul8_parse_statement_upload_id_from_source_ref((string)($row['source_ref'] ?? ''));
        if ($uploadId !== null) {
            $uploadIds[] = $uploadId;
        }
    }
    $statementUploadLookup = accumul8_statement_upload_lookup($viewerId, $uploadIds);

    return array_map(static function (array $r) use ($statementUploadLookup): array {
        $statementUploadId = accumul8_parse_statement_upload_id_from_source_ref((string)($r['source_ref'] ?? ''));
        $statementUpload = $statementUploadId !== null ? ($statementUploadLookup[$statementUploadId] ?? null) : null;
        $statementPageNumber = accumul8_statement_guess_page_number($r, $statementUpload);
        $resolvedEntityName = accumul8_entity_alias_name((string)($r['entity_name'] ?? ''));
        if ($resolvedEntityName === '') {
            $resolvedEntityName = accumul8_entity_alias_name((string)($r['description'] ?? ''));
        }
        $resolvedBalanceEntityName = accumul8_entity_alias_name((string)($r['balance_entity_name'] ?? ''));
        return [
            'id' => (int)($r['id'] ?? 0),
            'account_id' => isset($r['account_id']) ? (int)$r['account_id'] : null,
            'banking_organization_id' => isset($r['account_group_id']) ? (int)$r['account_group_id'] : null,
            'recurring_payment_id' => isset($r['recurring_payment_id']) ? (int)$r['recurring_payment_id'] : null,
            'entity_id' => isset($r['entity_id']) ? (int)$r['entity_id'] : null,
            'entity_name' => $resolvedEntityName,
            'balance_entity_id' => isset($r['balance_entity_id']) ? (int)$r['balance_entity_id'] : null,
            'balance_entity_name' => $resolvedBalanceEntityName,
            'contact_id' => isset($r['contact_id']) ? (int)$r['contact_id'] : null,
            'debtor_id' => isset($r['debtor_id']) ? (int)$r['debtor_id'] : null,
            'transaction_date' => (string)($r['transaction_date'] ?? ''),
            'due_date' => (string)($r['due_date'] ?? ''),
            'paid_date' => (string)($r['paid_date'] ?? ''),
            'entry_type' => (string)($r['entry_type'] ?? ''),
            'description' => (string)($r['description'] ?? ''),
            'memo' => accumul8_filter_note_for_display($r['memo'] ?? '', 2000),
            'amount' => (float)($r['amount'] ?? 0),
            'rta_amount' => (float)($r['rta_amount'] ?? 0),
            'running_balance' => (float)($r['running_balance'] ?? 0),
            'is_paid' => (int)($r['is_paid'] ?? 0),
            'is_reconciled' => (int)($r['is_reconciled'] ?? 0),
            'is_budget_planner' => (int)($r['is_budget_planner'] ?? 0),
            'source_kind' => (string)($r['source_kind'] ?? ''),
            'source_ref' => (string)($r['source_ref'] ?? ''),
            'statement_upload_id' => $statementUploadId,
            'statement_page_number' => $statementPageNumber,
            'pending_status' => (int)($r['pending_status'] ?? 0),
            'contact_name' => (string)($r['contact_name'] ?? ''),
            'account_name' => (string)($r['account_name'] ?? ''),
            'banking_organization_name' => (string)($r['banking_organization_name'] ?? ''),
            'debtor_name' => (string)($r['debtor_name'] ?? ''),
        ];
    }, $rows);
}

function accumul8_list_notification_rules(int $viewerId): array
{
    if (!accumul8_table_exists('accumul8_notification_rules')) {
        return [];
    }

    $customUserIdsSelect = accumul8_optional_select('accumul8_notification_rules', 'custom_user_ids_json', 'custom_user_ids_json', "'[]' AS custom_user_ids_json");
    $lastTriggeredAtSelect = accumul8_optional_select('accumul8_notification_rules', 'last_triggered_at', 'last_triggered_at', 'NULL AS last_triggered_at');
    $rows = Database::queryAll(
        'SELECT id, rule_name, trigger_type, days_before_due, target_scope, ' . $customUserIdsSelect . ',
                email_subject_template, email_body_template, is_active, ' . $lastTriggeredAtSelect . '
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

function accumul8_teller_account_local_type(array $account): string
{
    $type = strtolower(accumul8_normalize_text((string)($account['type'] ?? ''), 40));
    $subtype = strtolower(accumul8_normalize_text((string)($account['subtype'] ?? ''), 64));
    if ($type === 'credit') {
        return 'credit_card';
    }
    if ($type === 'depository') {
        return $subtype !== '' ? $subtype : 'checking';
    }
    if ($type === 'loan') {
        return 'loan';
    }
    return $type !== '' ? $type : ($subtype !== '' ? $subtype : 'checking');
}

function accumul8_find_or_create_account_group_by_institution(int $viewerId, string $institutionName): ?int
{
    $institutionName = accumul8_normalize_text($institutionName, 191);
    if ($institutionName === '') {
        return null;
    }

    $existing = Database::queryOne(
        'SELECT id
         FROM accumul8_account_groups
         WHERE owner_user_id = ?
           AND (group_name = ? OR institution_name = ?)
         ORDER BY id ASC
         LIMIT 1',
        [$viewerId, $institutionName, $institutionName]
    );
    if ($existing) {
        return (int)($existing['id'] ?? 0);
    }

    Database::execute(
        'INSERT INTO accumul8_account_groups (owner_user_id, group_name, institution_name, notes, is_active)
         VALUES (?, ?, ?, ?, 1)',
        [$viewerId, $institutionName, $institutionName, 'Created automatically from Teller sync']
    );

    return (int)Database::lastInsertId();
}

function accumul8_upsert_teller_account(int $viewerId, int $connectionId, array $connection, array $account, array $balances = [], array $details = []): array
{
    $tellerAccountId = accumul8_normalize_text((string)($account['id'] ?? ''), 191);
    if ($tellerAccountId === '') {
        throw new RuntimeException('Teller account response is missing id');
    }

    $institutionName = accumul8_normalize_text((string)($connection['institution_name'] ?? ''), 191);
    if ($institutionName === '' && is_array($account['institution'] ?? null)) {
        $institutionName = accumul8_normalize_text((string)(($account['institution']['name'] ?? '')), 191);
    }

    $accountName = accumul8_normalize_text((string)($account['name'] ?? ''), 191);
    if ($accountName === '') {
        $accountName = 'Teller Account';
    }

    $accountType = accumul8_teller_account_local_type($account);
    $accountSubtype = accumul8_normalize_text((string)($account['subtype'] ?? ''), 64);
    $maskLast4 = accumul8_normalize_text((string)($account['last_four'] ?? $details['account_number_last_four'] ?? ''), 8);
    $accountNumberMask = $maskLast4 !== '' ? ('****' . $maskLast4) : '';
    $routingNumber = '';
    if (isset($details['routing_numbers']) && is_array($details['routing_numbers']) && isset($details['routing_numbers'][0])) {
        $routingNumber = accumul8_normalize_text((string)$details['routing_numbers'][0], 32);
    } elseif (isset($details['routing_number'])) {
        $routingNumber = accumul8_normalize_text((string)$details['routing_number'], 32);
    }
    $currencyCode = strtoupper(accumul8_normalize_text((string)($account['currency'] ?? 'USD'), 3));
    if ($currencyCode === '' || !preg_match('/^[A-Z]{3}$/', $currencyCode)) {
        $currencyCode = 'USD';
    }

    $ledgerBalance = isset($balances['ledger']) ? (float)$balances['ledger'] : 0.0;
    $availableBalance = isset($balances['available']) ? (float)$balances['available'] : $ledgerBalance;
    $accountGroupId = accumul8_find_or_create_account_group_by_institution($viewerId, $institutionName);
    $enrollmentId = accumul8_normalize_text((string)($connection['teller_enrollment_id'] ?? ''), 191);

    $existing = Database::queryOne(
        'SELECT id,
                ' . accumul8_optional_select('accumul8_accounts', 'teller_sync_anchor_date', 'teller_sync_anchor_date', 'NULL AS teller_sync_anchor_date') . ',
                ' . accumul8_optional_select('accumul8_accounts', 'teller_backfill_cursor_id', 'teller_backfill_cursor_id', 'NULL AS teller_backfill_cursor_id') . ',
                ' . accumul8_optional_select('accumul8_accounts', 'teller_backfill_complete', 'teller_backfill_complete', '0 AS teller_backfill_complete') . ',
                ' . accumul8_optional_select('accumul8_accounts', 'teller_history_start_date', 'teller_history_start_date', 'NULL AS teller_history_start_date') . ',
                ' . accumul8_optional_select('accumul8_accounts', 'teller_history_end_date', 'teller_history_end_date', 'NULL AS teller_history_end_date') . '
         FROM accumul8_accounts
         WHERE owner_user_id = ?
           AND provider_name = ?
           AND teller_account_id = ?
         LIMIT 1',
        [$viewerId, 'teller', $tellerAccountId]
    );

    if ($existing) {
        Database::execute(
            'UPDATE accumul8_accounts
             SET account_group_id = ?, bank_connection_id = ?, provider_name = ?, teller_account_id = ?, teller_enrollment_id = ?,
                 account_type = ?, account_subtype = ?, institution_name = ?, account_number_mask = ?,
                 mask_last4 = ?, routing_number = ?, currency_code = ?, current_balance = ?, available_balance = ?, is_active = 1
             WHERE id = ? AND owner_user_id = ?',
            [
                $accountGroupId,
                $connectionId,
                'teller',
                $tellerAccountId,
                $enrollmentId === '' ? null : $enrollmentId,
                $accountType,
                $accountSubtype,
                $institutionName,
                $accountNumberMask,
                $maskLast4,
                $routingNumber,
                $currencyCode,
                $ledgerBalance,
                $availableBalance,
                (int)$existing['id'],
                $viewerId,
            ]
        );
        return [
            'local_account_id' => (int)$existing['id'],
            'local_account_name' => $accountName,
            'remote_account_id' => $tellerAccountId,
            'remote_account_name' => $accountName,
            'remote_account_type' => $accountType,
            'remote_account_subtype' => $accountSubtype,
            'mask_last4' => $maskLast4,
            'institution_name' => $institutionName,
            'mapping_action' => 'updated',
            'teller_sync_anchor_date' => isset($existing['teller_sync_anchor_date']) && $existing['teller_sync_anchor_date'] !== null ? (string)$existing['teller_sync_anchor_date'] : '',
            'teller_backfill_cursor_id' => (string)($existing['teller_backfill_cursor_id'] ?? ''),
            'teller_backfill_complete' => (int)($existing['teller_backfill_complete'] ?? 0),
            'teller_history_start_date' => isset($existing['teller_history_start_date']) && $existing['teller_history_start_date'] !== null ? (string)$existing['teller_history_start_date'] : '',
            'teller_history_end_date' => isset($existing['teller_history_end_date']) && $existing['teller_history_end_date'] !== null ? (string)$existing['teller_history_end_date'] : '',
        ];
    }

    Database::execute(
        'INSERT INTO accumul8_accounts
            (owner_user_id, account_group_id, bank_connection_id, provider_name, teller_account_id, teller_enrollment_id, account_name, account_type, account_subtype, institution_name, account_number_mask, mask_last4, routing_number, currency_code, current_balance, available_balance, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
        [
            $viewerId,
            $accountGroupId,
            $connectionId,
            'teller',
            $tellerAccountId,
            $enrollmentId === '' ? null : $enrollmentId,
            $accountName,
            $accountType,
            $accountSubtype,
            $institutionName,
            $accountNumberMask,
            $maskLast4,
            $routingNumber,
            $currencyCode,
            $ledgerBalance,
            $availableBalance,
        ]
    );

    return [
        'local_account_id' => (int)Database::lastInsertId(),
        'local_account_name' => $accountName,
        'remote_account_id' => $tellerAccountId,
        'remote_account_name' => $accountName,
        'remote_account_type' => $accountType,
        'remote_account_subtype' => $accountSubtype,
        'mask_last4' => $maskLast4,
        'institution_name' => $institutionName,
        'mapping_action' => 'created',
        'teller_sync_anchor_date' => '',
        'teller_backfill_cursor_id' => '',
        'teller_backfill_complete' => 0,
        'teller_history_start_date' => '',
        'teller_history_end_date' => '',
    ];
}

function accumul8_list_bank_connections(int $viewerId): array
{
    if (!accumul8_table_exists('accumul8_bank_connections')) {
        return [];
    }

    $institutionIdSelect = accumul8_optional_select('accumul8_bank_connections', 'institution_id', 'institution_id', "'' AS institution_id");
    $institutionNameSelect = accumul8_optional_select('accumul8_bank_connections', 'institution_name', 'institution_name', "'' AS institution_name");
    $statusSelect = accumul8_optional_select('accumul8_bank_connections', 'status', 'status', "'setup_pending' AS status");
    $lastSyncAtSelect = accumul8_optional_select('accumul8_bank_connections', 'last_sync_at', 'last_sync_at', 'NULL AS last_sync_at');
    $lastErrorSelect = accumul8_optional_select('accumul8_bank_connections', 'last_error', 'last_error', 'NULL AS last_error');
    $tellerEnrollmentIdSelect = accumul8_optional_select('accumul8_bank_connections', 'teller_enrollment_id', 'teller_enrollment_id', "'' AS teller_enrollment_id");
    $tellerUserIdSelect = accumul8_optional_select('accumul8_bank_connections', 'teller_user_id', 'teller_user_id', "'' AS teller_user_id");
    $rows = Database::queryAll(
        'SELECT id, provider_name, ' . $institutionIdSelect . ', ' . $institutionNameSelect . ', ' . $tellerEnrollmentIdSelect . ', ' . $tellerUserIdSelect . ', ' . $statusSelect . ', ' . $lastSyncAtSelect . ', ' . $lastErrorSelect . '
         FROM accumul8_bank_connections
         WHERE owner_user_id = ?
         ORDER BY id DESC',
        [$viewerId]
    );

    return array_map(static function (array $r): array {
        return [
            'id' => (int)($r['id'] ?? 0),
            'provider_name' => (string)($r['provider_name'] ?? 'teller'),
            'institution_id' => (string)($r['institution_id'] ?? ''),
            'institution_name' => (string)($r['institution_name'] ?? ''),
            'teller_enrollment_id' => (string)($r['teller_enrollment_id'] ?? ''),
            'teller_user_id' => (string)($r['teller_user_id'] ?? ''),
            'status' => (string)($r['status'] ?? 'setup_pending'),
            'last_sync_at' => (string)($r['last_sync_at'] ?? ''),
            'last_error' => (string)($r['last_error'] ?? ''),
        ];
    }, $rows);
}

function accumul8_statement_upload_view_model(int $viewerId, array $row): array
{
    $suspicious = json_decode((string)($row['suspicious_items_json'] ?? '[]'), true);
    $notes = json_decode((string)($row['processing_notes_json'] ?? '[]'), true);
    $locators = json_decode((string)($row['transaction_locator_json'] ?? '[]'), true);
    $pageCatalog = json_decode((string)($row['page_catalog_json'] ?? '[]'), true);
    $parsedPayload = json_decode((string)($row['parsed_payload_json'] ?? '{}'), true);
    $catalogKeywords = json_decode((string)($row['catalog_keywords_json'] ?? '[]'), true);
    $catalogTrace = json_decode((string)($row['catalog_trace_json'] ?? '{}'), true);
    $importResult = json_decode((string)($row['import_result_json'] ?? '{}'), true);
    if (!is_array($locators) || $locators === []) {
        $locators = is_array($parsedPayload) ? accumul8_statement_transaction_locators($parsedPayload) : [];
    }
    if (!is_array($pageCatalog)) {
        $pageCatalog = [];
    }
    $accountCatalog = accumul8_statement_account_catalog($viewerId);
    $reviewRows = is_array($parsedPayload) ? accumul8_statement_review_rows($parsedPayload, is_array($locators) ? $locators : [], $accountCatalog) : [];
    $catalogVerification = is_array($parsedPayload) && $parsedPayload !== []
        ? accumul8_statement_catalog_verification_payload($parsedPayload, $reviewRows)
        : null;
    if ((!is_array($catalogTrace) || !isset($catalogTrace['catalog_verification'])) && $catalogVerification !== null) {
        $catalogTrace = is_array($catalogTrace) ? $catalogTrace : [];
        $catalogTrace['catalog_verification'] = $catalogVerification;
    }
    $ocrStatement = is_array($parsedPayload) && $parsedPayload !== []
        ? accumul8_statement_ocr_document_payload($row, $parsedPayload, $reviewRows)
        : null;
    $plan = is_array($parsedPayload) && $parsedPayload !== []
        ? accumul8_statement_build_plan($viewerId, $row, $parsedPayload)
        : null;
    $reconciliationRuns = isset($row['reconciliation_runs']) && is_array($row['reconciliation_runs'])
        ? $row['reconciliation_runs']
        : [];

    return [
        'id' => (int)($row['id'] ?? 0),
        'account_id' => isset($row['account_id']) ? (int)$row['account_id'] : null,
        'account_name' => (string)($row['account_name'] ?? ''),
        'banking_organization_name' => (string)($row['banking_organization_name'] ?? ''),
        'institution_name' => (string)($row['institution_name'] ?? ''),
        'account_name_hint' => (string)($row['account_name_hint'] ?? ''),
        'account_mask_last4' => (string)($row['account_mask_last4'] ?? ''),
        'statement_kind' => (string)($row['statement_kind'] ?? 'bank_account'),
        'status' => (string)($row['status'] ?? 'uploaded'),
        'original_filename' => (string)($row['original_filename'] ?? ''),
        'mime_type' => (string)($row['mime_type'] ?? ''),
        'file_size_bytes' => (int)($row['file_size_bytes'] ?? 0),
        'extracted_method' => (string)($row['extracted_method'] ?? ''),
        'ai_provider' => (string)($row['ai_provider'] ?? ''),
        'ai_model' => (string)($row['ai_model'] ?? ''),
        'period_start' => (string)($row['period_start'] ?? ''),
        'period_end' => (string)($row['period_end'] ?? ''),
        'opening_balance' => isset($row['opening_balance']) ? (float)$row['opening_balance'] : null,
        'closing_balance' => isset($row['closing_balance']) ? (float)$row['closing_balance'] : null,
        'imported_transaction_count' => (int)($row['imported_transaction_count'] ?? 0),
        'duplicate_transaction_count' => (int)($row['duplicate_transaction_count'] ?? 0),
        'suspicious_item_count' => (int)($row['suspicious_item_count'] ?? 0),
        'reconciliation_status' => (string)($row['reconciliation_status'] ?? 'pending'),
        'reconciliation_note' => (string)($row['reconciliation_note'] ?? ''),
        'suspicious_items' => is_array($suspicious) ? $suspicious : [],
        'processing_notes' => is_array($notes) ? $notes : [],
        'transaction_locators' => is_array($locators) ? $locators : [],
        'review_rows' => $reviewRows,
        'page_catalog' => $pageCatalog,
        'catalog_summary' => (string)($row['catalog_summary'] ?? ''),
        'catalog_keywords' => is_array($catalogKeywords) ? $catalogKeywords : [],
        'catalog_trace' => is_array($catalogTrace) ? $catalogTrace : null,
        'catalog_verification' => $catalogVerification,
        'ocr_statement' => $ocrStatement,
        'plan' => $plan,
        'import_result' => is_array($importResult) ? $importResult : null,
        'reconciliation_runs' => $reconciliationRuns,
        'last_error' => (string)($row['last_error'] ?? ''),
        'last_scanned_at' => (string)($row['last_scanned_at'] ?? ''),
        'processed_at' => (string)($row['processed_at'] ?? ''),
        'is_archived' => (int)($row['is_archived'] ?? 0),
        'archived_at' => (string)($row['archived_at'] ?? ''),
        'archived_from_status' => (string)($row['archived_from_status'] ?? ''),
        'archived_from_section' => (string)($row['archived_from_section'] ?? ''),
        'created_at' => (string)($row['created_at'] ?? ''),
    ];
}

function accumul8_statement_serialize_reconciliation_log(array $row): array
{
    $details = json_decode((string)($row['details_json'] ?? '[]'), true);
    return [
        'id' => (int)($row['id'] ?? 0),
        'reconciliation_status' => (string)($row['reconciliation_status'] ?? 'pending'),
        'transaction_count' => (int)($row['transaction_count'] ?? 0),
        'already_reconciled_count' => (int)($row['already_reconciled_count'] ?? 0),
        'reconciled_now_count' => (int)($row['reconciled_now_count'] ?? 0),
        'linked_match_count' => (int)($row['linked_match_count'] ?? 0),
        'missing_match_count' => (int)($row['missing_match_count'] ?? 0),
        'invalid_row_count' => (int)($row['invalid_row_count'] ?? 0),
        'summary_text' => (string)($row['summary_text'] ?? ''),
        'details' => is_array($details) ? $details : [],
        'created_at' => (string)($row['created_at'] ?? ''),
    ];
}

function accumul8_statement_reconciliation_logs_lookup(int $viewerId, array $uploadIds, int $limitPerUpload = 5): array
{
    if ($uploadIds === [] || !accumul8_table_exists('accumul8_statement_reconciliation_logs')) {
        return [];
    }

    $uploadIds = array_values(array_unique(array_filter(array_map('intval', $uploadIds), static fn($id): bool => $id > 0)));
    if ($uploadIds === []) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($uploadIds), '?'));
    $rows = Database::queryAll(
        'SELECT id, statement_upload_id, reconciliation_status, transaction_count, already_reconciled_count, reconciled_now_count,
                linked_match_count, missing_match_count, invalid_row_count, summary_text, details_json, created_at
         FROM accumul8_statement_reconciliation_logs
         WHERE owner_user_id = ?
           AND statement_upload_id IN (' . $placeholders . ')
         ORDER BY created_at DESC, id DESC',
        array_merge([$viewerId], $uploadIds)
    );

    $grouped = [];
    foreach ($rows as $row) {
        $uploadId = (int)($row['statement_upload_id'] ?? 0);
        if ($uploadId <= 0) {
            continue;
        }
        if (!isset($grouped[$uploadId])) {
            $grouped[$uploadId] = [];
        }
        if (count($grouped[$uploadId]) >= $limitPerUpload) {
            continue;
        }
        $grouped[$uploadId][] = accumul8_statement_serialize_reconciliation_log($row);
    }

    return $grouped;
}

function accumul8_statement_serialize_audit_run(array $row): array
{
    $report = json_decode((string)($row['report_json'] ?? '[]'), true);
    return [
        'id' => (int)($row['id'] ?? 0),
        'audit_start_date' => (string)($row['audit_start_date'] ?? ''),
        'audit_end_date' => (string)($row['audit_end_date'] ?? ''),
        'upload_count' => (int)($row['upload_count'] ?? 0),
        'passed_count' => (int)($row['passed_count'] ?? 0),
        'warning_count' => (int)($row['warning_count'] ?? 0),
        'failed_count' => (int)($row['failed_count'] ?? 0),
        'summary_text' => (string)($row['summary_text'] ?? ''),
        'report' => is_array($report) ? $report : [],
        'created_at' => (string)($row['created_at'] ?? ''),
    ];
}

function accumul8_list_statement_audit_runs(int $viewerId, int $limit = 10): array
{
    if (!accumul8_table_exists('accumul8_statement_audit_runs')) {
        return [];
    }
    $limit = max(1, min(50, $limit));
    $rows = Database::queryAll(
        'SELECT id, audit_start_date, audit_end_date, upload_count, passed_count, warning_count, failed_count,
                COALESCE(summary_text, "") AS summary_text, COALESCE(report_json, "[]") AS report_json, created_at
         FROM accumul8_statement_audit_runs
         WHERE owner_user_id = ?
         ORDER BY id DESC
         LIMIT ' . (int)$limit,
        [$viewerId]
    );
    return array_map('accumul8_statement_serialize_audit_run', $rows);
}

function accumul8_statement_load_audit_upload_record(int $viewerId, int $uploadId): ?array
{
    return Database::queryOne(
        'SELECT id, owner_user_id, account_id, statement_kind, status, original_filename, mime_type, created_at, last_scanned_at,
                period_start, period_end, COALESCE(last_error, "") AS last_error,
                COALESCE(parsed_payload_json, "{}") AS parsed_payload_json,
                COALESCE(transaction_locator_json, "[]") AS transaction_locator_json,
                COALESCE(page_catalog_json, "[]") AS page_catalog_json,
                COALESCE(catalog_summary, "") AS catalog_summary,
                COALESCE(catalog_keywords_json, "[]") AS catalog_keywords_json
         FROM accumul8_statement_uploads
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$uploadId, $viewerId]
    ) ?: null;
}

function accumul8_statement_exact_match_candidates(int $viewerId, array $row): array
{
    $transactionDate = accumul8_normalize_date((string)($row['transaction_date'] ?? ''));
    $description = accumul8_normalize_text((string)($row['description'] ?? ''), 255);
    $amount = isset($row['amount']) && is_numeric($row['amount']) ? accumul8_normalize_amount($row['amount']) : null;
    if ($transactionDate === null || $description === '' || $amount === null) {
        return [];
    }

    return Database::queryAll(
        'SELECT id, account_id, is_reconciled, COALESCE(source_kind, "") AS source_kind, COALESCE(source_ref, "") AS source_ref
         FROM accumul8_transactions
         WHERE owner_user_id = ?
           AND transaction_date = ?
           AND ROUND(amount, 2) = ?
           AND description = ?
         ORDER BY
           CASE WHEN COALESCE(is_reconciled, 0) = 1 THEN 0 ELSE 1 END,
           id ASC
         LIMIT 20',
        [$viewerId, $transactionDate, $amount, $description]
    );
}

function accumul8_statement_select_preferred_match(array $matches, int $expectedAccountId, int $uploadId): ?array
{
    if ($matches === []) {
        return null;
    }

    usort($matches, static function (array $left, array $right) use ($expectedAccountId, $uploadId): int {
        $leftSameUpload = ((string)($left['source_ref'] ?? '') === 'statement_upload:' . $uploadId) ? 0 : 1;
        $rightSameUpload = ((string)($right['source_ref'] ?? '') === 'statement_upload:' . $uploadId) ? 0 : 1;
        if ($leftSameUpload !== $rightSameUpload) {
            return $leftSameUpload <=> $rightSameUpload;
        }

        $leftExpected = ((int)($left['account_id'] ?? 0) === $expectedAccountId) ? 0 : 1;
        $rightExpected = ((int)($right['account_id'] ?? 0) === $expectedAccountId) ? 0 : 1;
        if ($leftExpected !== $rightExpected) {
            return $leftExpected <=> $rightExpected;
        }

        $leftReconciled = ((int)($left['is_reconciled'] ?? 0) === 1) ? 0 : 1;
        $rightReconciled = ((int)($right['is_reconciled'] ?? 0) === 1) ? 0 : 1;
        if ($leftReconciled !== $rightReconciled) {
            return $leftReconciled <=> $rightReconciled;
        }

        return ((int)($left['id'] ?? 0)) <=> ((int)($right['id'] ?? 0));
    });

    return $matches[0] ?? null;
}

function accumul8_statement_link_and_reconcile_transaction(
    int $viewerId,
    int $uploadId,
    int $transactionId,
    ?int $expectedAccountId,
    array $match,
    array &$counts,
    array &$mutations,
    array &$detailParts
): array {
    $updates = [];
    $params = [];
    $fromAccountId = isset($match['account_id']) ? (int)$match['account_id'] : 0;
    $movedAccount = false;

    if ($expectedAccountId !== null && $expectedAccountId > 0 && $fromAccountId > 0 && $fromAccountId !== $expectedAccountId) {
        $updates[] = 'account_id = ?';
        $params[] = $expectedAccountId;
        $movedAccount = true;
        $counts['fixed_wrong_account_rows']++;
        $detailParts[] = 'moved to expected account';
    }

    if ((string)($match['source_kind'] ?? '') !== 'statement_upload' || (string)($match['source_ref'] ?? '') !== 'statement_upload:' . $uploadId) {
        $updates[] = 'source_kind = ?';
        $updates[] = 'source_ref = ?';
        $params[] = 'statement_upload';
        $params[] = 'statement_upload:' . $uploadId;
        $counts['linked_rows']++;
        $detailParts[] = 'linked to statement upload';
    }

    if ((int)($match['is_reconciled'] ?? 0) === 1) {
        $counts['already_reconciled_count']++;
        $detailParts[] = 'already reconciled';
    } else {
        $updates[] = 'is_reconciled = 1';
        $counts['reconciled_rows']++;
        $detailParts[] = 'marked reconciled';
    }

    if ($updates !== []) {
        $params[] = $transactionId;
        $params[] = $viewerId;
        Database::execute(
            'UPDATE accumul8_transactions
             SET ' . implode(', ', $updates) . '
             WHERE id = ? AND owner_user_id = ?',
            $params
        );
        $mutations['ledger_changed'] = true;
    }

    return [
        'transaction_id' => $transactionId,
        'from_account_id' => $fromAccountId > 0 ? $fromAccountId : null,
        'to_account_id' => $movedAccount ? $expectedAccountId : ($fromAccountId > 0 ? $fromAccountId : $expectedAccountId),
        'moved_account' => $movedAccount,
    ];
}

function accumul8_statement_prepare_audit_upload(int $viewerId, array $upload, array $options = []): array
{
    $uploadId = (int)($upload['id'] ?? 0);
    if ($uploadId <= 0) {
        throw new RuntimeException('Statement upload not found');
    }

    $rawUpload = array_key_exists('parsed_payload_json', $upload)
        ? $upload
        : accumul8_statement_load_audit_upload_record($viewerId, $uploadId);
    if (!is_array($rawUpload)) {
        throw new RuntimeException('Statement upload not found');
    }

    $autoCatalogMissing = array_key_exists('auto_catalog_missing', $options) ? !empty($options['auto_catalog_missing']) : true;
    $forceRescan = !empty($options['force_rescan']);
    $needsCatalogRefresh = !accumul8_statement_scan_is_successful($rawUpload) || accumul8_statement_upload_needs_catalog_refresh($rawUpload);
    $didCatalogRefresh = false;

    if ($forceRescan || ($autoCatalogMissing && $needsCatalogRefresh)) {
        accumul8_statement_scan_upload(
            $viewerId,
            $uploadId,
            isset($rawUpload['account_id']) && (int)$rawUpload['account_id'] > 0 ? (int)$rawUpload['account_id'] : null,
            true
        );
        $refreshed = accumul8_statement_load_audit_upload_record($viewerId, $uploadId);
        if (!is_array($refreshed)) {
            throw new RuntimeException('Statement upload could not be reloaded after catalog refresh');
        }
        $rawUpload = $refreshed;
        $didCatalogRefresh = true;
    }

    return [
        'upload' => $rawUpload,
        'catalog_refresh_performed' => $didCatalogRefresh ? 1 : 0,
        'needs_catalog_refresh' => $needsCatalogRefresh ? 1 : 0,
    ];
}

function accumul8_statement_audit_single_upload(int $viewerId, array $upload, array $options = []): array
{
    $prepared = accumul8_statement_prepare_audit_upload($viewerId, $upload, $options);
    $upload = $prepared['upload'];
    $catalogRefreshPerformed = (int)($prepared['catalog_refresh_performed'] ?? 0);

    $parsed = json_decode((string)($upload['parsed_payload_json'] ?? '{}'), true);
    if (!is_array($parsed) || $parsed === []) {
        return [
            'upload_id' => (int)($upload['id'] ?? 0),
            'original_filename' => (string)($upload['original_filename'] ?? ''),
            'status' => 'failed',
            'summary' => 'Statement has no parsed payload to audit.',
            'counts' => ['valid_rows' => 0, 'matched_rows' => 0, 'wrong_account_rows' => 0, 'missing_rows' => 0, 'invalid_rows' => 0],
            'account_sections' => [],
            'catalog_refresh_performed' => $catalogRefreshPerformed,
        ];
    }

    $reviewRows = accumul8_statement_review_rows($parsed, accumul8_statement_transaction_locators($parsed));
    $catalogVerification = accumul8_statement_catalog_verification_payload($parsed, $reviewRows);
    $autoFixLedger = array_key_exists('auto_fix_ledger', $options) ? !empty($options['auto_fix_ledger']) : true;
    $actorUserId = isset($options['actor_user_id']) ? (int)$options['actor_user_id'] : 0;
    $rowAccountIds = [];
    $sectionSummaries = [];
    $counts = [
        'valid_rows' => 0,
        'matched_rows' => 0,
        'wrong_account_rows' => 0,
        'missing_rows' => 0,
        'invalid_rows' => 0,
        'fixed_wrong_account_rows' => 0,
        'imported_missing_rows' => 0,
        'linked_rows' => 0,
        'reconciled_rows' => 0,
        'already_reconciled_count' => 0,
    ];
    $issues = [];
    $actions = [];
    $matchedRows = [];
    $mutations = ['ledger_changed' => false];

    foreach ($reviewRows as $row) {
        $sectionLabel = (string)($row['statement_account_label'] ?? '');
        if (!isset($sectionSummaries[$sectionLabel])) {
            $sectionSummaries[$sectionLabel] = [
                'statement_account_label' => $sectionLabel !== '' ? $sectionLabel : 'Unlabeled account section',
                'statement_account_name_hint' => (string)($row['statement_account_name_hint'] ?? ''),
                'statement_account_last4' => (string)($row['statement_account_last4'] ?? ''),
                'expected_account_id' => null,
                'statement_total' => 0.0,
                'matched_total' => 0.0,
                'row_count' => 0,
                'matched_count' => 0,
            ];
        }
        if (!empty($row['reason'])) {
            $counts['invalid_rows']++;
            $issues[] = [
                'row_index' => (int)($row['row_index'] ?? -1),
                'result' => 'invalid',
                'details' => (string)$row['reason'],
                'statement_account_label' => $sectionSummaries[$sectionLabel]['statement_account_label'],
                'description' => (string)($row['description'] ?? ''),
                'transaction_date' => (string)($row['transaction_date'] ?? ''),
                'amount' => isset($row['amount']) && is_numeric($row['amount']) ? accumul8_normalize_amount($row['amount']) : null,
            ];
            continue;
        }

        $counts['valid_rows']++;
        $amount = accumul8_normalize_amount($row['amount'] ?? 0);
        $sectionSummaries[$sectionLabel]['statement_total'] += $amount;
        $sectionSummaries[$sectionLabel]['row_count']++;
        $expectedAccountId = accumul8_statement_resolve_row_account_id($viewerId, $upload, $parsed, $row, [], $rowAccountIds);
        $sectionSummaries[$sectionLabel]['expected_account_id'] = $expectedAccountId;

        $matches = accumul8_statement_exact_match_candidates($viewerId, $row);
        $expectedMatches = array_values(array_filter($matches, static fn(array $candidate): bool => (int)($candidate['account_id'] ?? 0) === $expectedAccountId));
        if ($expectedMatches !== []) {
            $chosen = accumul8_statement_select_preferred_match($expectedMatches, $expectedAccountId, (int)($upload['id'] ?? 0));
            $detailParts = [];
            if (is_array($chosen) && (int)($chosen['id'] ?? 0) > 0) {
                $linkResult = accumul8_statement_link_and_reconcile_transaction(
                    $viewerId,
                    (int)($upload['id'] ?? 0),
                    (int)$chosen['id'],
                    $expectedAccountId,
                    $chosen,
                    $counts,
                    $mutations,
                    $detailParts
                );
                $actions[] = [
                    'row_index' => (int)($row['row_index'] ?? -1),
                    'result' => 'matched',
                    'details' => implode('; ', $detailParts),
                    'statement_account_label' => $sectionSummaries[$sectionLabel]['statement_account_label'],
                    'description' => (string)($row['description'] ?? ''),
                    'transaction_date' => (string)($row['transaction_date'] ?? ''),
                    'amount' => $amount,
                    'transaction_id' => (int)($linkResult['transaction_id'] ?? 0) ?: null,
                    'from_account_id' => $linkResult['from_account_id'] ?? null,
                    'to_account_id' => $linkResult['to_account_id'] ?? null,
                ];
            }
            $counts['matched_rows']++;
            $sectionSummaries[$sectionLabel]['matched_total'] += $amount;
            $sectionSummaries[$sectionLabel]['matched_count']++;
            $matchedRows[] = ['amount' => $amount];
            continue;
        }

        if ($matches !== []) {
            if ($autoFixLedger && count($matches) === 1) {
                $chosen = accumul8_statement_select_preferred_match($matches, $expectedAccountId, (int)($upload['id'] ?? 0));
                $detailParts = [];
                if (is_array($chosen) && (int)($chosen['id'] ?? 0) > 0) {
                    $linkResult = accumul8_statement_link_and_reconcile_transaction(
                        $viewerId,
                        (int)($upload['id'] ?? 0),
                        (int)$chosen['id'],
                        $expectedAccountId,
                        $chosen,
                        $counts,
                        $mutations,
                        $detailParts
                    );
                    $actions[] = [
                        'row_index' => (int)($row['row_index'] ?? -1),
                        'result' => 'fixed_wrong_account',
                        'details' => implode('; ', $detailParts),
                        'statement_account_label' => $sectionSummaries[$sectionLabel]['statement_account_label'],
                        'description' => (string)($row['description'] ?? ''),
                        'transaction_date' => (string)($row['transaction_date'] ?? ''),
                        'amount' => $amount,
                        'transaction_id' => (int)($linkResult['transaction_id'] ?? 0) ?: null,
                        'from_account_id' => $linkResult['from_account_id'] ?? null,
                        'to_account_id' => $linkResult['to_account_id'] ?? null,
                    ];
                    $counts['matched_rows']++;
                    $sectionSummaries[$sectionLabel]['matched_total'] += $amount;
                    $sectionSummaries[$sectionLabel]['matched_count']++;
                    $matchedRows[] = ['amount' => $amount];
                    continue;
                }
            }

            $counts['wrong_account_rows']++;
            $issues[] = [
                'row_index' => (int)($row['row_index'] ?? -1),
                'result' => 'wrong_account',
                'details' => 'Matching amount/date/description exists, but only in a different account.',
                'statement_account_label' => $sectionSummaries[$sectionLabel]['statement_account_label'],
                'description' => (string)($row['description'] ?? ''),
                'transaction_date' => (string)($row['transaction_date'] ?? ''),
                'amount' => $amount,
                'matched_transaction_ids' => array_map(static fn(array $candidate): int => (int)($candidate['id'] ?? 0), $matches),
                'matched_account_ids' => array_values(array_unique(array_map(static fn(array $candidate): int => (int)($candidate['account_id'] ?? 0), $matches))),
            ];
            continue;
        }

        if ($autoFixLedger) {
            $transactionId = accumul8_statement_insert_transaction_row($viewerId, $actorUserId, (int)($upload['id'] ?? 0), $expectedAccountId, [
                'transaction_date' => (string)($row['transaction_date'] ?? ''),
                'description' => (string)($row['description'] ?? ''),
                'memo' => (string)($row['memo'] ?? ''),
                'amount' => $amount,
                'running_balance' => $row['running_balance'] ?? null,
            ]);
            $mutations['ledger_changed'] = true;
            $counts['imported_missing_rows']++;
            $counts['matched_rows']++;
            $sectionSummaries[$sectionLabel]['matched_total'] += $amount;
            $sectionSummaries[$sectionLabel]['matched_count']++;
            $matchedRows[] = ['amount' => $amount];
            $actions[] = [
                'row_index' => (int)($row['row_index'] ?? -1),
                'result' => 'imported_missing',
                'details' => 'Imported missing ledger row from the statement catalog.',
                'statement_account_label' => $sectionSummaries[$sectionLabel]['statement_account_label'],
                'description' => (string)($row['description'] ?? ''),
                'transaction_date' => (string)($row['transaction_date'] ?? ''),
                'amount' => $amount,
                'transaction_id' => $transactionId,
                'to_account_id' => $expectedAccountId,
            ];
            continue;
        }

        $counts['missing_rows']++;
        $issues[] = [
            'row_index' => (int)($row['row_index'] ?? -1),
            'result' => 'missing',
            'details' => 'No exact ledger transaction matches this statement row.',
            'statement_account_label' => $sectionSummaries[$sectionLabel]['statement_account_label'],
            'description' => (string)($row['description'] ?? ''),
            'transaction_date' => (string)($row['transaction_date'] ?? ''),
            'amount' => $amount,
        ];
    }

    if ($mutations['ledger_changed']) {
        accumul8_recompute_running_balance($viewerId);
    }

    $sectionSummaries = array_values(array_map(static function (array $section): array {
        $section['statement_total'] = round((float)$section['statement_total'], 2);
        $section['matched_total'] = round((float)$section['matched_total'], 2);
        $section['amount_delta'] = round($section['matched_total'] - $section['statement_total'], 2);
        return $section;
    }, $sectionSummaries));

    $balanceSummary = accumul8_statement_reconciliation_payload($parsed, $matchedRows, 0);

    $status = 'passed';
    if (
        $counts['wrong_account_rows'] > 0
        || $counts['missing_rows'] > 0
        || $counts['invalid_rows'] > 0
        || abs(array_sum(array_map(static fn(array $section): float => (float)($section['amount_delta'] ?? 0), $sectionSummaries))) > 0.01
        || (($catalogVerification['status'] ?? '') === 'failed')
    ) {
        $status = 'failed';
    } elseif ($balanceSummary['status'] !== 'balanced' || (($catalogVerification['status'] ?? '') === 'warning')) {
        $status = 'warning';
    }

    $summaryParts = [
        'Checked ' . $counts['valid_rows'] . ' valid row(s).',
        $counts['matched_rows'] . ' matched the expected account.',
    ];
    if ($catalogRefreshPerformed === 1) {
        $summaryParts[] = 'Catalog refresh ran before auditing.';
    }
    if ($counts['fixed_wrong_account_rows'] > 0) {
        $summaryParts[] = 'Moved ' . $counts['fixed_wrong_account_rows'] . ' wrong-account ledger row(s) into the expected account.';
    }
    if ($counts['imported_missing_rows'] > 0) {
        $summaryParts[] = 'Imported ' . $counts['imported_missing_rows'] . ' missing ledger row(s) from the statement catalog.';
    }
    if (!empty($catalogVerification['summary'])) {
        $summaryParts[] = (string)$catalogVerification['summary'];
    }
    if ($counts['wrong_account_rows'] > 0) {
        $summaryParts[] = $counts['wrong_account_rows'] . ' appear to be in the wrong account.';
    }
    if ($counts['missing_rows'] > 0) {
        $summaryParts[] = $counts['missing_rows'] . ' are missing from the ledger.';
    }
    if ($counts['invalid_rows'] > 0) {
        $summaryParts[] = $counts['invalid_rows'] . ' were invalid.';
    }
    $balanceNote = accumul8_normalize_text((string)($balanceSummary['note'] ?? ''), 500);
    if ($balanceNote !== '') {
        $summaryParts[] = $balanceNote;
    }

    return [
        'upload_id' => (int)($upload['id'] ?? 0),
        'original_filename' => (string)($upload['original_filename'] ?? ''),
        'status' => $status,
        'summary' => implode(' ', $summaryParts),
        'counts' => $counts,
        'account_sections' => $sectionSummaries,
        'catalog_refresh_performed' => $catalogRefreshPerformed,
        'issues' => array_slice($issues, 0, 200),
        'actions' => array_slice($actions, 0, 200),
    ];
}

function accumul8_statement_audit_uploads(int $viewerId, int $actorUserId, ?string $startDate = null, ?string $endDate = null, array $options = []): array
{
    $normalizedStart = $startDate !== null ? accumul8_normalize_date($startDate) : null;
    $normalizedEnd = $endDate !== null ? accumul8_normalize_date($endDate) : null;
    $uploads = Database::queryAll(
        'SELECT id, owner_user_id, account_id, statement_kind, status, original_filename, mime_type, created_at, last_scanned_at,
                period_start, period_end, COALESCE(last_error, "") AS last_error,
                COALESCE(parsed_payload_json, "{}") AS parsed_payload_json,
                COALESCE(transaction_locator_json, "[]") AS transaction_locator_json,
                COALESCE(page_catalog_json, "[]") AS page_catalog_json,
                COALESCE(catalog_summary, "") AS catalog_summary,
                COALESCE(catalog_keywords_json, "[]") AS catalog_keywords_json
         FROM accumul8_statement_uploads
         WHERE owner_user_id = ?
           AND COALESCE(is_archived, 0) = 0
         ORDER BY created_at DESC, id DESC
         LIMIT 200',
        [$viewerId]
    );
    $filteredUploads = array_values(array_filter($uploads, static function (array $upload) use ($normalizedStart, $normalizedEnd): bool {
        $periodStart = accumul8_normalize_date((string)($upload['period_start'] ?? ''));
        $periodEnd = accumul8_normalize_date((string)($upload['period_end'] ?? ''));
        $compareStart = $periodStart ?? $periodEnd ?? accumul8_normalize_date(substr((string)($upload['created_at'] ?? ''), 0, 10));
        $compareEnd = $periodEnd ?? $periodStart ?? $compareStart;
        if ($normalizedStart !== null && $compareEnd !== null && $compareEnd < $normalizedStart) {
            return false;
        }
        if ($normalizedEnd !== null && $compareStart !== null && $compareStart > $normalizedEnd) {
            return false;
        }
        return true;
    }));

    $report = [];
    $passedCount = 0;
    $warningCount = 0;
    $failedCount = 0;
    $catalogRefreshCount = 0;
    $fixedWrongAccountCount = 0;
    $importedMissingCount = 0;
    foreach ($filteredUploads as $upload) {
        try {
            $item = accumul8_statement_audit_single_upload($viewerId, $upload, $options);
        } catch (Throwable $scanError) {
            $item = [
                'upload_id' => (int)($upload['id'] ?? 0),
                'original_filename' => (string)($upload['original_filename'] ?? ''),
                'status' => 'failed',
                'summary' => 'Pre-audit re-scan failed: ' . accumul8_normalize_text($scanError->getMessage(), 500),
                'counts' => [
                    'valid_rows' => 0,
                    'matched_rows' => 0,
                    'wrong_account_rows' => 0,
                    'missing_rows' => 0,
                    'invalid_rows' => 0,
                ],
                'account_sections' => [],
                'catalog_refresh_performed' => 0,
                'issues' => [[
                    'severity' => 'error',
                    'reason' => 'Rescan failed before audit',
                    'details' => accumul8_normalize_text($scanError->getMessage(), 500),
                ]],
            ];
            $report[] = $item;
            $failedCount++;
            continue;
        }
        $report[] = $item;
        $catalogRefreshCount += (int)($item['catalog_refresh_performed'] ?? 0);
        $fixedWrongAccountCount += (int)($item['counts']['fixed_wrong_account_rows'] ?? 0);
        $importedMissingCount += (int)($item['counts']['imported_missing_rows'] ?? 0);
        if (($item['status'] ?? '') === 'passed') {
            $passedCount++;
        } elseif (($item['status'] ?? '') === 'warning') {
            $warningCount++;
        } else {
            $failedCount++;
        }
    }

    $summary = 'Audited ' . count($report) . ' statement(s). '
        . $passedCount . ' passed, '
        . $warningCount . ' warning, '
        . $failedCount . ' failed.';
    if ($catalogRefreshCount > 0) {
        $summary .= ' Refreshed the catalog for ' . $catalogRefreshCount . ' statement(s).';
    }
    if ($fixedWrongAccountCount > 0) {
        $summary .= ' Fixed ' . $fixedWrongAccountCount . ' wrong-account ledger row(s).';
    }
    if ($importedMissingCount > 0) {
        $summary .= ' Imported ' . $importedMissingCount . ' missing ledger row(s).';
    }

    Database::execute(
        'INSERT INTO accumul8_statement_audit_runs
         (owner_user_id, actor_user_id, audit_start_date, audit_end_date, upload_count, passed_count, warning_count, failed_count, summary_text, report_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $viewerId,
            $actorUserId,
            $normalizedStart,
            $normalizedEnd,
            count($report),
            $passedCount,
            $warningCount,
            $failedCount,
            $summary,
            json_encode($report, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        ]
    );

    $run = Database::queryOne(
        'SELECT id, audit_start_date, audit_end_date, upload_count, passed_count, warning_count, failed_count,
                COALESCE(summary_text, "") AS summary_text, COALESCE(report_json, "[]") AS report_json, created_at
         FROM accumul8_statement_audit_runs
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [(int)Database::lastInsertId(), $viewerId]
    );
    return accumul8_statement_serialize_audit_run(is_array($run) ? $run : []);
}

function accumul8_list_statement_uploads(int $viewerId, bool $archived = false): array
{
    if (!accumul8_table_exists('accumul8_statement_uploads')) {
        return [];
    }

    $rows = Database::queryAll(
        'SELECT su.id, su.account_id, su.statement_kind, su.status, su.original_filename, su.mime_type, su.file_size_bytes, su.extracted_method,
                su.ai_provider, su.ai_model, su.institution_name, su.account_name_hint, su.account_mask_last4,
                su.period_start, su.period_end, su.opening_balance, su.closing_balance,
                su.imported_transaction_count, su.duplicate_transaction_count, su.suspicious_item_count,
                su.reconciliation_status, COALESCE(su.reconciliation_note, "") AS reconciliation_note,
                COALESCE(su.suspicious_items_json, "[]") AS suspicious_items_json,
                COALESCE(su.processing_notes_json, "[]") AS processing_notes_json,
                COALESCE(su.transaction_locator_json, "[]") AS transaction_locator_json,
                COALESCE(su.page_catalog_json, "[]") AS page_catalog_json,
                COALESCE(su.parsed_payload_json, "{}") AS parsed_payload_json,
                COALESCE(su.catalog_summary, "") AS catalog_summary,
                COALESCE(su.catalog_keywords_json, "[]") AS catalog_keywords_json,
                COALESCE(su.catalog_trace_json, "{}") AS catalog_trace_json,
                COALESCE(su.import_result_json, "{}") AS import_result_json,
                COALESCE(su.last_error, "") AS last_error, su.last_scanned_at, su.processed_at, su.created_at,
                COALESCE(su.is_archived, 0) AS is_archived, su.archived_at,
                COALESCE(su.archived_from_status, "") AS archived_from_status,
                COALESCE(su.archived_from_section, "") AS archived_from_section,
                COALESCE(a.account_name, "") AS account_name,
                COALESCE(ag.group_name, "") AS banking_organization_name
         FROM accumul8_statement_uploads su
         LEFT JOIN accumul8_accounts a
           ON a.id = su.account_id
          AND a.owner_user_id = su.owner_user_id
         LEFT JOIN accumul8_account_groups ag
           ON ag.id = a.account_group_id
          AND ag.owner_user_id = a.owner_user_id
         WHERE su.owner_user_id = ?
           AND COALESCE(su.is_archived, 0) = ?
         ORDER BY su.created_at DESC, su.id DESC
         LIMIT 200',
        [$viewerId, $archived ? 1 : 0]
    );

    $logLookup = accumul8_statement_reconciliation_logs_lookup(
        $viewerId,
        array_map(static fn(array $row): int => (int)($row['id'] ?? 0), $rows)
    );

    return array_map(
        static function (array $row) use ($viewerId, $logLookup): array {
            $row['reconciliation_runs'] = $logLookup[(int)($row['id'] ?? 0)] ?? [];
            return accumul8_statement_upload_view_model($viewerId, $row);
        },
        $rows
    );
}

function accumul8_get_transaction_row(int $viewerId, int $id): ?array
{
    return Database::queryOne(
        'SELECT *
         FROM accumul8_transactions
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$id, $viewerId]
    ) ?: null;
}

function accumul8_transaction_source_kind($value): string
{
    $normalized = strtolower(trim((string)$value));
    return $normalized !== '' ? $normalized : 'manual';
}

function accumul8_parse_statement_upload_id_from_source_ref(string $sourceRef): ?int
{
    if (preg_match('/^statement_upload:(\d+)$/i', trim($sourceRef), $matches)) {
        $id = (int)($matches[1] ?? 0);
        return $id > 0 ? $id : null;
    }
    return null;
}

function accumul8_normalize_locator_text(string $value): string
{
    $value = strtolower(trim($value));
    $value = preg_replace('/[^a-z0-9]+/', ' ', $value) ?? $value;
    return trim($value);
}

function accumul8_statement_locator_match_score(array $transaction, array $locator): int
{
    $transactionDate = (string)($transaction['transaction_date'] ?? '');
    $locatorDate = (string)($locator['transaction_date'] ?? '');
    $transactionAmount = isset($transaction['amount']) ? (float)$transaction['amount'] : 0.0;
    $locatorAmount = isset($locator['amount']) ? (float)$locator['amount'] : 0.0;
    $transactionDescription = accumul8_normalize_locator_text((string)($transaction['description'] ?? ''));
    $locatorDescription = accumul8_normalize_locator_text((string)($locator['description'] ?? ''));

    $score = 0;
    if ($transactionDate !== '' && $transactionDate === $locatorDate) {
        $score += 6;
    }
    if (abs($transactionAmount - $locatorAmount) <= 0.01) {
        $score += 6;
    }
    if ($transactionDescription !== '' && $transactionDescription === $locatorDescription) {
        $score += 8;
    } elseif (
        $transactionDescription !== ''
        && $locatorDescription !== ''
        && (str_contains($transactionDescription, $locatorDescription) || str_contains($locatorDescription, $transactionDescription))
    ) {
        $score += 4;
    }

    return $score;
}

function accumul8_statement_amount_variants(float $amount): array
{
    $absolute = abs($amount);
    $plain = number_format($absolute, 2, '.', '');
    $comma = number_format($absolute, 2, '.', ',');
    return array_values(array_unique([
        $plain,
        $comma,
        '$' . $plain,
        '$' . $comma,
        '(' . $plain . ')',
        '(' . $comma . ')',
        '-' . $plain,
        '-' . $comma,
    ]));
}

function accumul8_statement_date_variants(string $date): array
{
    if ($date === '') {
        return [];
    }
    $ts = strtotime($date);
    if ($ts === false) {
        return [];
    }
    return array_values(array_unique([
        gmdate('Y-m-d', $ts),
        gmdate('m/d/Y', $ts),
        gmdate('n/j/Y', $ts),
        gmdate('m/d/y', $ts),
        gmdate('n/j/y', $ts),
        gmdate('M j', $ts),
        gmdate('M j, Y', $ts),
    ]));
}

function accumul8_statement_page_catalog_match_score(array $transaction, array $page): int
{
    $pageText = accumul8_normalize_locator_text((string)($page['text_excerpt'] ?? ''));
    if ($pageText === '') {
        return 0;
    }

    $score = 0;
    $description = accumul8_normalize_locator_text((string)($transaction['description'] ?? ''));
    if ($description !== '' && str_contains($pageText, $description)) {
        $score += 12;
    } elseif ($description !== '') {
        $tokens = array_values(array_filter(explode(' ', $description), static fn(string $token): bool => strlen($token) >= 4));
        $matched = 0;
        foreach ($tokens as $token) {
            if (str_contains($pageText, $token)) {
                $matched++;
            }
        }
        $score += min(8, $matched * 2);
    }

    foreach (accumul8_statement_amount_variants((float)($transaction['amount'] ?? 0)) as $amountVariant) {
        if ($amountVariant !== '' && str_contains((string)($page['text_excerpt'] ?? ''), $amountVariant)) {
            $score += 4;
            break;
        }
    }

    foreach (accumul8_statement_date_variants((string)($transaction['transaction_date'] ?? '')) as $dateVariant) {
        if ($dateVariant !== '' && stripos((string)($page['text_excerpt'] ?? ''), $dateVariant) !== false) {
            $score += 3;
            break;
        }
    }

    return $score;
}

function accumul8_statement_guess_page_number(array $transaction, ?array $upload): ?int
{
    if (!$upload) {
        return null;
    }

    $bestPageNumber = null;
    $bestScore = 0;
    foreach ((array)($upload['transaction_locators'] ?? []) as $locator) {
        if (!is_array($locator)) {
            continue;
        }
        $pageNumber = isset($locator['page_number']) ? (int)$locator['page_number'] : 0;
        if ($pageNumber <= 0) {
            continue;
        }
        $score = accumul8_statement_locator_match_score($transaction, $locator);
        if ($score > $bestScore) {
            $bestScore = $score;
            $bestPageNumber = $pageNumber;
        }
    }
    if ($bestScore >= 12 && $bestPageNumber !== null) {
        return $bestPageNumber;
    }

    $bestCatalogPage = null;
    $bestCatalogScore = 0;
    foreach ((array)($upload['page_catalog'] ?? []) as $page) {
        if (!is_array($page)) {
            continue;
        }
        $pageNumber = isset($page['page_number']) ? (int)$page['page_number'] : 0;
        if ($pageNumber <= 0) {
            continue;
        }
        $score = accumul8_statement_page_catalog_match_score($transaction, $page);
        if ($score > $bestCatalogScore) {
            $bestCatalogScore = $score;
            $bestCatalogPage = $pageNumber;
        }
    }

    return $bestCatalogScore >= 10 ? $bestCatalogPage : null;
}

function accumul8_transaction_source_label(string $sourceKind): string
{
    if ($sourceKind === 'statement_upload' || $sourceKind === 'statement_pdf') {
        return 'bank statement';
    }
    if ($sourceKind === 'plaid' || $sourceKind === 'teller') {
        return 'bank sync';
    }
    if ($sourceKind === 'recurring') {
        return 'scheduled payment';
    }
    return 'manual entry';
}

function accumul8_transaction_edit_policy(array $transaction): array
{
    $sourceKind = accumul8_transaction_source_kind($transaction['source_kind'] ?? '');
    $isImported = in_array($sourceKind, ['statement_upload', 'statement_pdf', 'plaid', 'teller'], true);

    if ($isImported) {
        return [
            'source_kind' => $sourceKind,
            'source_label' => accumul8_transaction_source_label($sourceKind),
            'can_edit_core_fields' => false,
            'can_edit_paid_state' => false,
            'can_edit_budget_planner' => false,
            'can_delete' => in_array($sourceKind, ['statement_upload', 'statement_pdf'], true),
        ];
    }

    return [
        'source_kind' => $sourceKind,
        'source_label' => accumul8_transaction_source_label($sourceKind),
        'can_edit_core_fields' => true,
        'can_edit_paid_state' => true,
        'can_edit_budget_planner' => true,
        'can_delete' => true,
    ];
}

function accumul8_find_duplicate_statement_upload(int $viewerId, string $fileSha256): ?array
{
    if ($fileSha256 === '' || !accumul8_table_exists('accumul8_statement_uploads')) {
        return null;
    }

    $row = Database::queryOne(
        'SELECT id, original_filename, created_at, period_start, period_end
         FROM accumul8_statement_uploads
         WHERE owner_user_id = ?
           AND file_sha256 = ?
         ORDER BY id DESC
         LIMIT 1',
        [$viewerId, $fileSha256]
    );

    if (!$row) {
        return null;
    }

    return [
        'id' => (int)($row['id'] ?? 0),
        'original_filename' => (string)($row['original_filename'] ?? ''),
        'created_at' => (string)($row['created_at'] ?? ''),
        'period_start' => isset($row['period_start']) ? (string)$row['period_start'] : '',
        'period_end' => isset($row['period_end']) ? (string)$row['period_end'] : '',
    ];
}

function accumul8_statement_reconciliation_payload(array $parsed, array $importedRows, int $duplicateCount): array
{
    $accountLabels = accumul8_statement_distinct_account_tags($parsed);
    if (count($accountLabels) > 1) {
        $noteParts = ['Statement packet contains multiple account sections, so packet-level opening/closing balance validation was skipped.'];
        if ($duplicateCount > 0) {
            $noteParts[] = $duplicateCount . ' probable duplicate transaction(s) were skipped.';
        }
        if (!empty($parsed['reconciliation_notes']) && is_array($parsed['reconciliation_notes'])) {
            foreach ($parsed['reconciliation_notes'] as $note) {
                $note = accumul8_normalize_text((string)$note, 255);
                if ($note !== '') {
                    $noteParts[] = $note;
                }
            }
        }
        return [
            'status' => 'balanced',
            'note' => implode(' ', array_values(array_unique($noteParts))),
            'opening_balance' => null,
            'closing_balance' => null,
        ];
    }

    $opening = isset($parsed['opening_balance']) && is_numeric($parsed['opening_balance']) ? accumul8_normalize_amount($parsed['opening_balance']) : null;
    $closing = isset($parsed['closing_balance']) && is_numeric($parsed['closing_balance']) ? accumul8_normalize_amount($parsed['closing_balance']) : null;
    $sum = 0.0;
    foreach ($importedRows as $row) {
        $sum += accumul8_normalize_amount($row['amount'] ?? 0);
    }
    $expectedClosing = $opening !== null ? round($opening + $sum, 2) : null;
    $status = 'pending';
    $noteParts = [];
    if ($opening !== null && $closing !== null) {
        $delta = round(abs($expectedClosing - $closing), 2);
        if ($delta <= 0.01) {
            $status = 'balanced';
            $noteParts[] = 'Opening balance plus imported activity matches the closing balance.';
        } else {
            $status = 'needs_review';
            $noteParts[] = 'Imported activity does not fully reconcile to the closing balance.';
            $noteParts[] = 'Expected closing ' . number_format($expectedClosing, 2) . ', statement closing ' . number_format($closing, 2) . '.';
        }
    } else {
        $noteParts[] = 'Statement did not provide both opening and closing balances.';
    }
    if ($duplicateCount > 0) {
        $noteParts[] = $duplicateCount . ' probable duplicate transaction(s) were skipped.';
    }
    if (!empty($parsed['reconciliation_notes']) && is_array($parsed['reconciliation_notes'])) {
        foreach ($parsed['reconciliation_notes'] as $note) {
            $note = accumul8_normalize_text((string)$note, 255);
            if ($note !== '') {
                $noteParts[] = $note;
            }
        }
    }
    return [
        'status' => $status,
        'note' => implode(' ', array_values(array_unique($noteParts))),
        'opening_balance' => $opening,
        'closing_balance' => $closing,
    ];
}

function accumul8_statement_find_best_transaction_match(int $viewerId, int $accountId, int $uploadId, array $row): ?array
{
    $matches = Database::queryAll(
        'SELECT id, account_id, is_reconciled, COALESCE(source_kind, "") AS source_kind, COALESCE(source_ref, "") AS source_ref
         FROM accumul8_transactions
         WHERE owner_user_id = ?
           AND COALESCE(account_id, 0) = ?
           AND transaction_date = ?
           AND ROUND(amount, 2) = ?
           AND description = ?
         ORDER BY
           CASE WHEN COALESCE(source_ref, "") = ? THEN 0 ELSE 1 END,
           CASE WHEN COALESCE(is_reconciled, 0) = 1 THEN 0 ELSE 1 END,
           id ASC
         LIMIT 5',
        [
            $viewerId,
            $accountId,
            $row['transaction_date'],
            accumul8_normalize_amount($row['amount']),
            $row['description'],
            'statement_upload:' . $uploadId,
        ]
    );

    return $matches[0] ?? null;
}

function accumul8_statement_build_reconciliation_summary(array $counts, array $baseReconciliation): string
{
    $parts = [];
    $parts[] = 'Checked ' . (int)($counts['transaction_count'] ?? 0) . ' valid statement transaction(s).';
    if (($counts['already_reconciled_count'] ?? 0) > 0) {
        $parts[] = (int)$counts['already_reconciled_count'] . ' were already reconciled.';
    }
    if (($counts['reconciled_now_count'] ?? 0) > 0) {
        $parts[] = 'Marked ' . (int)$counts['reconciled_now_count'] . ' unreconciled ledger match(es) as reconciled.';
    }
    if (($counts['linked_match_count'] ?? 0) > 0) {
        $parts[] = 'Linked ' . (int)$counts['linked_match_count'] . ' existing ledger match(es) back to this statement.';
    }
    if (($counts['missing_match_count'] ?? 0) > 0) {
        $parts[] = (int)$counts['missing_match_count'] . ' statement row(s) still have no exact ledger match.';
    }
    if (($counts['invalid_row_count'] ?? 0) > 0) {
        $parts[] = (int)$counts['invalid_row_count'] . ' row(s) were invalid and could not be auto-reconciled.';
    }
    $note = accumul8_normalize_text((string)($baseReconciliation['note'] ?? ''), 1000);
    if ($note !== '') {
        $parts[] = $note;
    }
    return implode(' ', $parts);
}

function accumul8_statement_reconcile_upload(int $viewerId, int $actorUserId, int $uploadId, array $options = []): array
{
    $upload = Database::queryOne(
        'SELECT *
         FROM accumul8_statement_uploads
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$uploadId, $viewerId]
    );
    if (!$upload) {
        throw new RuntimeException('Statement upload not found');
    }

    $parsed = json_decode((string)($upload['parsed_payload_json'] ?? '{}'), true);
    if (!is_array($parsed) || $parsed === []) {
        accumul8_statement_scan_upload(
            $viewerId,
            $uploadId,
            isset($options['account_id']) ? (int)$options['account_id'] : null,
            true
        );
        $upload = Database::queryOne(
            'SELECT *
             FROM accumul8_statement_uploads
             WHERE id = ? AND owner_user_id = ?
             LIMIT 1',
            [$uploadId, $viewerId]
        );
        $parsed = is_array($upload) ? json_decode((string)($upload['parsed_payload_json'] ?? '{}'), true) : [];
    }
    if (!is_array($parsed) || $parsed === []) {
        throw new RuntimeException('Statement scan did not produce a reconciliation plan');
    }

    $reviewRows = accumul8_statement_review_rows($parsed, accumul8_statement_transaction_locators($parsed));
    $matchedRows = [];
    $actions = [];
    $primaryAccountId = null;
    $rowAccountIds = [];
    $counts = [
        'transaction_count' => 0,
        'already_reconciled_count' => 0,
        'reconciled_now_count' => 0,
        'linked_match_count' => 0,
        'missing_match_count' => 0,
        'invalid_row_count' => 0,
    ];

    foreach ($reviewRows as $row) {
        $action = [
            'row_index' => (int)($row['row_index'] ?? -1),
            'transaction_date' => (string)($row['transaction_date'] ?? ''),
            'description' => (string)($row['description'] ?? ''),
            'amount' => isset($row['amount']) && is_numeric($row['amount']) ? accumul8_normalize_amount($row['amount']) : null,
            'transaction_id' => null,
            'result' => '',
            'details' => '',
        ];

        if (!empty($row['reason'])) {
            $counts['invalid_row_count']++;
            $action['result'] = 'invalid';
            $action['details'] = accumul8_normalize_text((string)$row['reason'], 255);
            $actions[] = $action;
            continue;
        }

        $counts['transaction_count']++;
        $action['statement_account_name_hint'] = (string)($row['statement_account_name_hint'] ?? '');
        $action['statement_account_last4'] = (string)($row['statement_account_last4'] ?? '');
        $action['statement_account_label'] = (string)($row['statement_account_label'] ?? '');
        $accountId = accumul8_statement_resolve_row_account_id($viewerId, $upload, $parsed, $row, $options, $rowAccountIds);
        if ($primaryAccountId === null && $accountId > 0) {
            $primaryAccountId = $accountId;
        }
        $action['resolved_account_id'] = $accountId > 0 ? $accountId : null;
        $match = accumul8_statement_find_best_transaction_match($viewerId, $accountId, $uploadId, $row);
        if (!$match) {
            $counts['missing_match_count']++;
            $action['result'] = 'missing_match';
            $action['details'] = 'No exact ledger match was found for this statement row.';
            $actions[] = $action;
            continue;
        }

        $transactionId = (int)($match['id'] ?? 0);
        $action['transaction_id'] = $transactionId > 0 ? $transactionId : null;
        $updates = [];
        $params = [];
        $details = [];
        if ((string)($match['source_kind'] ?? '') !== 'statement_upload' || (string)($match['source_ref'] ?? '') !== 'statement_upload:' . $uploadId) {
            $updates[] = 'source_kind = ?';
            $updates[] = 'source_ref = ?';
            $params[] = 'statement_upload';
            $params[] = 'statement_upload:' . $uploadId;
            $counts['linked_match_count']++;
            $details[] = 'linked to statement upload';
        }
        if ((int)($match['is_reconciled'] ?? 0) === 1) {
            $counts['already_reconciled_count']++;
            $details[] = 'already reconciled';
        } else {
            $updates[] = 'is_reconciled = 1';
            $counts['reconciled_now_count']++;
            $details[] = 'marked reconciled';
        }
        if ($updates !== []) {
            $params[] = $transactionId;
            $params[] = $viewerId;
            Database::execute(
                'UPDATE accumul8_transactions
                 SET ' . implode(', ', $updates) . '
                 WHERE id = ? AND owner_user_id = ?',
                $params
            );
        }

        $matchedRows[] = [
            'id' => $transactionId,
            'transaction_date' => $row['transaction_date'],
            'description' => $row['description'],
            'amount' => $row['amount'],
            'running_balance' => $row['running_balance'] ?? null,
        ];
        $action['result'] = ((int)($match['is_reconciled'] ?? 0) === 1 && $updates === []) ? 'already_reconciled' : 'reconciled';
        $action['details'] = implode('; ', $details);
        $actions[] = $action;
    }

    $baseReconciliation = accumul8_statement_reconciliation_payload($parsed, $matchedRows, 0);
    $finalStatus = (
        $counts['missing_match_count'] === 0
        && $counts['invalid_row_count'] === 0
        && $baseReconciliation['status'] === 'balanced'
    ) ? 'balanced' : 'needs_review';
    $summary = accumul8_statement_build_reconciliation_summary($counts, $baseReconciliation);

    Database::execute(
        'INSERT INTO accumul8_statement_reconciliation_logs
         (owner_user_id, statement_upload_id, actor_user_id, reconciliation_status, transaction_count, already_reconciled_count,
          reconciled_now_count, linked_match_count, missing_match_count, invalid_row_count, summary_text, details_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $viewerId,
            $uploadId,
            $actorUserId,
            $finalStatus,
            $counts['transaction_count'],
            $counts['already_reconciled_count'],
            $counts['reconciled_now_count'],
            $counts['linked_match_count'],
            $counts['missing_match_count'],
            $counts['invalid_row_count'],
            $summary,
            json_encode($actions, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        ]
    );

    Database::execute(
        'UPDATE accumul8_statement_uploads
         SET account_id = ?, status = ?, reconciliation_status = ?, reconciliation_note = ?, last_error = NULL
         WHERE id = ? AND owner_user_id = ?',
        [
            $primaryAccountId,
            $finalStatus === 'balanced' ? 'processed' : 'needs_review',
            $finalStatus,
            $summary,
            $uploadId,
            $viewerId,
        ]
    );

    return accumul8_statement_reload_view($viewerId, $uploadId);
}

function accumul8_statement_transaction_locators(array $parsed): array
{
    $locators = [];
    foreach (accumul8_statement_transaction_rows($parsed) as $tx) {
        if ((int)($tx['is_valid_json'] ?? 0) !== 1) {
            continue;
        }
        $txDate = accumul8_normalize_date($tx['transaction_date'] ?? $tx['posted_date'] ?? '');
        $description = accumul8_normalize_text((string)($tx['description'] ?? ''), 255);
        if ($txDate === null || $description === '' || !is_numeric($tx['amount'] ?? null)) {
            continue;
        }
        $pageNumber = isset($tx['page_number']) && is_numeric($tx['page_number'])
            ? (int)$tx['page_number']
            : null;
        $locators[] = [
            'row_index' => (int)($tx['row_index'] ?? 0),
            'transaction_date' => $txDate,
            'description' => $description,
            'amount' => accumul8_normalize_amount($tx['amount']),
            'running_balance' => isset($tx['running_balance']) && is_numeric($tx['running_balance'])
                ? accumul8_normalize_amount($tx['running_balance'])
                : null,
            'page_number' => $pageNumber !== null && $pageNumber > 0 ? $pageNumber : null,
            'statement_account_name_hint' => (string)($tx['statement_account_name_hint'] ?? ''),
            'statement_account_last4' => (string)($tx['statement_account_last4'] ?? ''),
            'statement_account_label' => (string)($tx['statement_account_label'] ?? ''),
        ];
    }
    return $locators;
}

function accumul8_statement_review_rows(array $parsed, array $transactionLocators = [], array $accountCatalog = []): array
{
    $rows = [];
    foreach (accumul8_statement_transaction_rows($parsed) as $tx) {
        $index = (int)($tx['row_index'] ?? 0);
        if ((int)($tx['is_valid_json'] ?? 0) !== 1) {
            $rows[] = [
                'row_index' => (int)$index,
                'reason' => 'Transaction entry was not valid JSON',
                'statement_account_name_hint' => (string)($tx['statement_account_name_hint'] ?? ''),
                'statement_account_last4' => (string)($tx['statement_account_last4'] ?? ''),
                'statement_account_label' => (string)($tx['statement_account_label'] ?? ''),
            ];
            continue;
        }

        $txDate = accumul8_normalize_date($tx['transaction_date'] ?? $tx['posted_date'] ?? '');
        $description = accumul8_normalize_text((string)($tx['description'] ?? ''), 255);
        $memo = accumul8_normalize_text((string)($tx['memo'] ?? ''), 2000);
        $amount = isset($tx['amount']) && is_numeric($tx['amount']) ? accumul8_normalize_amount($tx['amount']) : null;
        $runningBalance = isset($tx['running_balance']) && is_numeric($tx['running_balance'])
            ? accumul8_normalize_amount($tx['running_balance'])
            : null;
        $pageNumber = isset($tx['page_number']) && is_numeric($tx['page_number']) ? (int)$tx['page_number'] : null;
        $reason = null;
        if ($txDate === null || $description === '' || $amount === null) {
            $reason = 'Missing date, description, or amount';
        }

        if ($pageNumber === null && $transactionLocators !== []) {
            foreach ($transactionLocators as $locator) {
                if (!is_array($locator)) {
                    continue;
                }
                if ((int)($locator['row_index'] ?? -1) !== $index) {
                    continue;
                }
                if ((string)($locator['transaction_date'] ?? '') !== (string)$txDate) {
                    continue;
                }
                if (accumul8_normalize_text((string)($locator['description'] ?? ''), 255) !== $description) {
                    continue;
                }
                if (!isset($locator['amount']) || abs(accumul8_normalize_amount($locator['amount']) - (float)($amount ?? 0)) > 0.01) {
                    continue;
                }
                $pageNumber = isset($locator['page_number']) && is_numeric($locator['page_number']) ? (int)$locator['page_number'] : null;
                if ($runningBalance === null && isset($locator['running_balance']) && is_numeric($locator['running_balance'])) {
                    $runningBalance = accumul8_normalize_amount($locator['running_balance']);
                }
                break;
            }
        }

        $statementJson = [
            'statement_kind' => $parsed['statement_kind'] ?? 'bank_account',
            'institution_name' => (string)($parsed['institution_name'] ?? ''),
            'account_name_hint' => (string)($tx['statement_account_name_hint'] ?? ''),
            'account_last4' => (string)($tx['statement_account_last4'] ?? ''),
        ];
        $match = $accountCatalog !== []
            ? accumul8_statement_match_account_from_catalog($accountCatalog, $statementJson, null)
            : ['account_id' => null];

        $rows[] = [
            'row_index' => (int)$index,
            'transaction_date' => $txDate,
            'description' => $description,
            'memo' => $memo,
            'amount' => $amount,
            'running_balance' => $runningBalance,
            'page_number' => $pageNumber !== null && $pageNumber > 0 ? $pageNumber : null,
            'reason' => $reason,
            'statement_account_name_hint' => (string)($tx['statement_account_name_hint'] ?? ''),
            'statement_account_last4' => (string)($tx['statement_account_last4'] ?? ''),
            'statement_account_label' => (string)($tx['statement_account_label'] ?? ''),
            'suggested_account_id' => isset($match['account_id']) && (int)$match['account_id'] > 0 ? (int)$match['account_id'] : null,
        ];
    }

    return $rows;
}

function accumul8_statement_resolve_review_row(int $viewerId, int $uploadId, int $rowIndex, array $options = []): array
{
    $upload = Database::queryOne(
        'SELECT *
         FROM accumul8_statement_uploads
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$uploadId, $viewerId]
    );
    if (!$upload) {
        throw new RuntimeException('Statement upload not found');
    }

    $parsed = json_decode((string)($upload['parsed_payload_json'] ?? '{}'), true);
    if (!is_array($parsed) || $parsed === []) {
        throw new RuntimeException('Statement scan did not produce a reviewable payload');
    }

    $locators = accumul8_statement_transaction_locators($parsed);
    $reviewRows = accumul8_statement_review_rows($parsed, $locators);
    $row = null;
    foreach ($reviewRows as $candidate) {
        if ((int)($candidate['row_index'] ?? -1) === $rowIndex) {
            $row = $candidate;
            break;
        }
    }
    if (!is_array($row)) {
        throw new RuntimeException('Statement row not found');
    }

    $transactionDate = isset($options['transaction_date']) && $options['transaction_date'] !== ''
        ? accumul8_normalize_date((string)$options['transaction_date'])
        : (isset($row['transaction_date']) ? accumul8_normalize_date((string)$row['transaction_date']) : null);
    $description = isset($options['description'])
        ? accumul8_normalize_text((string)$options['description'], 255)
        : accumul8_normalize_text((string)($row['description'] ?? ''), 255);
    $memo = isset($options['memo'])
        ? accumul8_normalize_text((string)$options['memo'], 2000)
        : accumul8_normalize_text((string)($row['memo'] ?? ''), 2000);
    $amount = array_key_exists('amount', $options) && $options['amount'] !== null && $options['amount'] !== ''
        ? (is_numeric($options['amount']) ? accumul8_normalize_amount($options['amount']) : null)
        : (isset($row['amount']) && is_numeric($row['amount']) ? accumul8_normalize_amount($row['amount']) : null);

    if ($transactionDate === null || $description === '' || $amount === null) {
        throw new RuntimeException('Missing date, description, or amount');
    }

    return [
        'upload' => $upload,
        'parsed' => $parsed,
        'row' => $row,
        'transaction_date' => $transactionDate,
        'description' => $description,
        'memo' => $memo,
        'amount' => $amount,
        'running_balance' => isset($row['running_balance']) && is_numeric($row['running_balance']) ? accumul8_normalize_amount($row['running_balance']) : null,
    ];
}

function accumul8_statement_resolve_target_account_id(int $viewerId, array $upload, array $parsed, array $options = []): int
{
    if (isset($options['create_account']) && is_array($options['create_account'])) {
        return accumul8_statement_create_account_from_plan($viewerId, (array)$options['create_account']);
    }
    if (isset($options['account_id']) && (int)$options['account_id'] > 0) {
        return accumul8_require_owned_id('accounts', $viewerId, (int)$options['account_id']);
    }

    $match = accumul8_statement_match_account($viewerId, $parsed, isset($upload['account_id']) ? (int)$upload['account_id'] : null);
    $accountId = isset($match['account_id']) ? (int)$match['account_id'] : null;
    if ($accountId !== null && $accountId > 0) {
        return $accountId;
    }
    return accumul8_statement_create_account_from_plan(
        $viewerId,
        accumul8_statement_suggested_new_account_payload($parsed, $upload)
    );
}

function accumul8_statement_row_statement_json(array $upload, array $parsed, array $row): array
{
    return [
        'statement_kind' => $parsed['statement_kind'] ?? $upload['statement_kind'] ?? 'bank_account',
        'institution_name' => (string)($parsed['institution_name'] ?? $upload['institution_name'] ?? ''),
        'account_name_hint' => (string)($row['statement_account_name_hint'] ?? $parsed['account_name_hint'] ?? $upload['account_name_hint'] ?? ''),
        'account_last4' => (string)($row['statement_account_last4'] ?? $parsed['account_last4'] ?? $upload['account_mask_last4'] ?? ''),
    ];
}

function accumul8_statement_resolve_row_account_id(int $viewerId, array $upload, array $parsed, array $row, array $options = [], array &$cache = []): int
{
    if (isset($options['create_account']) && is_array($options['create_account'])) {
        return accumul8_statement_create_account_from_plan($viewerId, (array)$options['create_account']);
    }
    if (isset($options['account_id']) && (int)$options['account_id'] > 0) {
        return accumul8_require_owned_id('accounts', $viewerId, (int)$options['account_id']);
    }

    $statementJson = accumul8_statement_row_statement_json($upload, $parsed, $row);
    $cacheKey = strtolower(trim((string)$statementJson['institution_name'])) . '|' . strtolower(trim((string)$statementJson['account_name_hint'])) . '|' . preg_replace('/\D+/', '', (string)$statementJson['account_last4']);
    if (isset($cache[$cacheKey]) && (int)$cache[$cacheKey] > 0) {
        return (int)$cache[$cacheKey];
    }

    $match = accumul8_statement_match_account($viewerId, $statementJson, null);
    $accountId = isset($match['account_id']) ? (int)$match['account_id'] : 0;
    if ($accountId <= 0) {
        $accountId = accumul8_statement_create_account_from_plan(
            $viewerId,
            accumul8_statement_suggested_new_account_payload($statementJson, $upload)
        );
    }

    $cache[$cacheKey] = $accountId;
    return $accountId;
}

function accumul8_statement_update_metadata(int $viewerId, int $uploadId, array $payload): array
{
    $upload = Database::queryOne(
        'SELECT * FROM accumul8_statement_uploads WHERE id = ? AND owner_user_id = ? LIMIT 1',
        [$uploadId, $viewerId]
    );
    if (!$upload) {
        throw new RuntimeException('Statement upload not found');
    }

    $parsed = json_decode((string)($upload['parsed_payload_json'] ?? '{}'), true);
    $parsed = is_array($parsed) ? accumul8_statement_normalize_parsed_payload($parsed) : [];
    $statementKind = array_key_exists('statement_kind', $payload)
        ? accumul8_statement_normalize_kind((string)$payload['statement_kind'])
        : accumul8_statement_normalize_kind((string)($upload['statement_kind'] ?? 'bank_account'));

    $accountNameHint = array_key_exists('account_name_hint', $payload)
        ? accumul8_normalize_text((string)$payload['account_name_hint'], 191)
        : accumul8_normalize_text((string)($upload['account_name_hint'] ?? ''), 191);
    $accountLast4 = array_key_exists('account_last4', $payload)
        ? accumul8_normalize_text((string)$payload['account_last4'], 16)
        : accumul8_normalize_text((string)($upload['account_mask_last4'] ?? ''), 16);

    if ($parsed !== []) {
        if ($accountNameHint !== '') {
            $parsed['account_name_hint'] = $accountNameHint;
        }
        if ($accountLast4 !== '') {
            $parsed['account_last4'] = $accountLast4;
        }
        $parsed['statement_kind'] = $statementKind;
        $parsed = accumul8_statement_normalize_parsed_payload($parsed);
        $accountNameHint = accumul8_normalize_text((string)($parsed['account_name_hint'] ?? $accountNameHint), 191);
        $accountLast4 = accumul8_normalize_text((string)($parsed['account_last4'] ?? $accountLast4), 16);
    }

    Database::execute(
        'UPDATE accumul8_statement_uploads
         SET statement_kind = ?, account_name_hint = ?, account_mask_last4 = ?, parsed_payload_json = ?
         WHERE id = ? AND owner_user_id = ?',
        [
            $statementKind,
            $accountNameHint,
            $accountLast4,
            $parsed !== [] ? json_encode($parsed, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : (string)($upload['parsed_payload_json'] ?? '{}'),
            $uploadId,
            $viewerId,
        ]
    );

    return accumul8_statement_reload_view($viewerId, $uploadId);
}

function accumul8_statement_insert_transaction_row(int $viewerId, int $actorUserId, int $uploadId, int $accountId, array $resolvedRow): int
{
    $duplicate = Database::queryOne(
        'SELECT id
         FROM accumul8_transactions
         WHERE owner_user_id = ?
           AND COALESCE(account_id, 0) = ?
           AND transaction_date = ?
           AND ROUND(amount, 2) = ?
           AND description = ?
         LIMIT 1',
        [$viewerId, $accountId, $resolvedRow['transaction_date'], $resolvedRow['amount'], $resolvedRow['description']]
    );
    if ($duplicate) {
        throw new RuntimeException('A matching ledger transaction already exists');
    }

    $entityId = accumul8_statement_resolve_entity_id($viewerId, $resolvedRow['description']);
    $externalKey = hash('sha256', implode('|', [
        $viewerId,
        $uploadId,
        $accountId,
        $resolvedRow['transaction_date'],
        $resolvedRow['description'],
        number_format((float)$resolvedRow['amount'], 2, '.', ''),
    ]));

    Database::execute(
        'INSERT INTO accumul8_transactions
         (owner_user_id, account_id, entity_id, balance_entity_id, contact_id, debtor_id, transaction_date, due_date, entry_type, description, memo, amount, rta_amount, running_balance, is_paid, is_reconciled, is_budget_planner, is_recurring_instance, recurring_payment_id, source_kind, source_ref, external_id, pending_status, created_by_user_id)
         VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, 0.00, ?, 1, 1, 0, 0, NULL, ?, ?, ?, 0, ?)',
        [
            $viewerId,
            $accountId,
            $entityId,
            $resolvedRow['transaction_date'],
            $resolvedRow['transaction_date'],
            (float)$resolvedRow['amount'] < 0 ? 'bill' : 'deposit',
            $resolvedRow['description'],
            $resolvedRow['memo'] !== '' ? $resolvedRow['memo'] : null,
            $resolvedRow['amount'],
            $resolvedRow['running_balance'] !== null ? $resolvedRow['running_balance'] : 0.00,
            'statement_upload',
            'statement_upload:' . $uploadId,
            $externalKey,
            $actorUserId,
        ]
    );
    $insertedId = (int)Database::lastInsertId();
    Database::execute(
        'UPDATE accumul8_transactions
         SET paid_date = transaction_date
         WHERE id = ? AND owner_user_id = ?',
        [$insertedId, $viewerId]
    );
    return $insertedId;
}

function accumul8_statement_reload_view(int $viewerId, int $uploadId): array
{
    if (!accumul8_table_exists('accumul8_statement_uploads')) {
        throw new RuntimeException('Statement upload could not be reloaded');
    }
    $row = Database::queryOne(
        'SELECT su.id, su.account_id, su.statement_kind, su.status, su.original_filename, su.mime_type, su.file_size_bytes, su.extracted_method,
                su.ai_provider, su.ai_model, su.institution_name, su.account_name_hint, su.account_mask_last4,
                su.period_start, su.period_end, su.opening_balance, su.closing_balance,
                su.imported_transaction_count, su.duplicate_transaction_count, su.suspicious_item_count,
                su.reconciliation_status, COALESCE(su.reconciliation_note, "") AS reconciliation_note,
                COALESCE(su.suspicious_items_json, "[]") AS suspicious_items_json,
                COALESCE(su.processing_notes_json, "[]") AS processing_notes_json,
                COALESCE(su.transaction_locator_json, "[]") AS transaction_locator_json,
                COALESCE(su.page_catalog_json, "[]") AS page_catalog_json,
                COALESCE(su.parsed_payload_json, "{}") AS parsed_payload_json,
                COALESCE(su.catalog_summary, "") AS catalog_summary,
                COALESCE(su.catalog_keywords_json, "[]") AS catalog_keywords_json,
                COALESCE(su.catalog_trace_json, "{}") AS catalog_trace_json,
                COALESCE(su.import_result_json, "{}") AS import_result_json,
                COALESCE(su.last_error, "") AS last_error, su.last_scanned_at, su.processed_at, su.created_at,
                COALESCE(su.is_archived, 0) AS is_archived, su.archived_at,
                COALESCE(su.archived_from_status, "") AS archived_from_status,
                COALESCE(su.archived_from_section, "") AS archived_from_section,
                COALESCE(a.account_name, "") AS account_name,
                COALESCE(ag.group_name, "") AS banking_organization_name
         FROM accumul8_statement_uploads su
         LEFT JOIN accumul8_accounts a
           ON a.id = su.account_id
          AND a.owner_user_id = su.owner_user_id
         LEFT JOIN accumul8_account_groups ag
           ON ag.id = a.account_group_id
          AND ag.owner_user_id = a.owner_user_id
         WHERE su.id = ?
           AND su.owner_user_id = ?
         LIMIT 1',
        [$uploadId, $viewerId]
    );
    if (!$row) {
        throw new RuntimeException('Statement upload could not be reloaded');
    }
    $row['reconciliation_runs'] = accumul8_statement_reconciliation_logs_lookup($viewerId, [$uploadId])[$uploadId] ?? [];
    return accumul8_statement_upload_view_model($viewerId, $row);
}

function accumul8_statement_archive_section($value): string
{
    $normalized = strtolower(trim((string)$value));
    if (in_array($normalized, ['inbox', 'library', 'signals'], true)) {
        return $normalized;
    }
    return 'library';
}

function accumul8_statement_archive_upload(int $viewerId, int $uploadId, string $archivedFromSection = 'inbox'): array
{
    $row = Database::queryOne(
        'SELECT id, status, COALESCE(is_archived, 0) AS is_archived
         FROM accumul8_statement_uploads
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$uploadId, $viewerId]
    );
    if (!$row) {
        throw new RuntimeException('Statement upload not found');
    }
    if ((int)($row['is_archived'] ?? 0) === 1) {
        throw new RuntimeException('Statement is already archived');
    }

    Database::execute(
        'UPDATE accumul8_statement_uploads
         SET is_archived = 1,
             archived_at = NOW(),
             archived_from_status = ?,
             archived_from_section = ?
         WHERE id = ? AND owner_user_id = ?',
        [
            accumul8_normalize_text((string)($row['status'] ?? ''), 24),
            accumul8_statement_archive_section($archivedFromSection),
            $uploadId,
            $viewerId,
        ]
    );

    return accumul8_statement_reload_view($viewerId, $uploadId);
}

function accumul8_statement_restore_upload(int $viewerId, int $uploadId): array
{
    $row = Database::queryOne(
        'SELECT id, status, COALESCE(is_archived, 0) AS is_archived,
                COALESCE(archived_from_status, "") AS archived_from_status,
                COALESCE(archived_from_section, "") AS archived_from_section
         FROM accumul8_statement_uploads
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$uploadId, $viewerId]
    );
    if (!$row) {
        throw new RuntimeException('Statement upload not found');
    }
    if ((int)($row['is_archived'] ?? 0) !== 1) {
        throw new RuntimeException('Statement is not archived');
    }

    $restoredStatus = accumul8_normalize_text((string)($row['archived_from_status'] ?? ''), 24);
    if ($restoredStatus === '') {
        $restoredStatus = accumul8_normalize_text((string)($row['status'] ?? ''), 24);
    }
    if ($restoredStatus === '') {
        $restoredStatus = 'scanned';
    }

    Database::execute(
        'UPDATE accumul8_statement_uploads
         SET is_archived = 0,
             archived_at = NULL,
             status = ?,
             archived_from_status = "",
             archived_from_section = ""
         WHERE id = ? AND owner_user_id = ?',
        [$restoredStatus, $uploadId, $viewerId]
    );

    return accumul8_statement_reload_view($viewerId, $uploadId);
}

function accumul8_statement_delete_archived_upload(int $viewerId, int $uploadId): void
{
    $row = Database::queryOne(
        'SELECT id, COALESCE(is_archived, 0) AS is_archived
         FROM accumul8_statement_uploads
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$uploadId, $viewerId]
    );
    if (!$row) {
        throw new RuntimeException('Statement upload not found');
    }
    if ((int)($row['is_archived'] ?? 0) !== 1) {
        throw new RuntimeException('Only archived statements can be deleted permanently');
    }

    $linkedRow = Database::queryOne(
        'SELECT COUNT(*) AS linked_count
         FROM accumul8_transactions
         WHERE owner_user_id = ?
           AND source_ref = ?',
        [$viewerId, 'statement_upload:' . $uploadId]
    );
    $linkedCount = (int)($linkedRow['linked_count'] ?? 0);
    if ($linkedCount > 0) {
        throw new RuntimeException('Restore or unlink imported ledger rows before permanently deleting this statement');
    }

    Database::execute(
        'DELETE FROM accumul8_statement_uploads
         WHERE id = ? AND owner_user_id = ?',
        [$uploadId, $viewerId]
    );
}

function accumul8_statement_decode_json_field($value, array $fallback)
{
    $decoded = json_decode((string)$value, true);
    return is_array($decoded) ? $decoded : $fallback;
}

function accumul8_statement_upload_has_parsed_payload(array $upload): bool
{
    $parsed = accumul8_statement_decode_json_field($upload['parsed_payload_json'] ?? '{}', []);
    if ($parsed === []) {
        return false;
    }
    if (accumul8_statement_transaction_rows($parsed) !== []) {
        return true;
    }
    foreach (['institution_name', 'account_name_hint', 'account_last4', 'period_start', 'period_end'] as $field) {
        if (accumul8_normalize_text((string)($parsed[$field] ?? ''), 191) !== '') {
            return true;
        }
    }
    foreach (['opening_balance', 'closing_balance'] as $field) {
        if (isset($parsed[$field]) && is_numeric($parsed[$field])) {
            return true;
        }
    }
    return false;
}

function accumul8_statement_upload_has_page_catalog(array $upload): bool
{
    $catalog = accumul8_statement_decode_json_field($upload['page_catalog_json'] ?? '[]', []);
    return $catalog !== [];
}

function accumul8_statement_upload_has_transaction_locators(array $upload): bool
{
    $locators = accumul8_statement_decode_json_field($upload['transaction_locator_json'] ?? '[]', []);
    return $locators !== [];
}

function accumul8_statement_upload_has_catalog_keywords(array $upload): bool
{
    $keywords = accumul8_statement_decode_json_field($upload['catalog_keywords_json'] ?? '[]', []);
    return $keywords !== [];
}

function accumul8_statement_scan_is_successful(array $upload): bool
{
    $status = accumul8_normalize_text((string)($upload['status'] ?? ''), 24);
    if (!in_array($status, ['scanned', 'needs_review', 'processed'], true)) {
        return false;
    }
    if (trim((string)($upload['last_scanned_at'] ?? '')) === '') {
        return false;
    }
    if (accumul8_normalize_text((string)($upload['last_error'] ?? ''), 1000) !== '') {
        return false;
    }
    return accumul8_statement_upload_has_parsed_payload($upload);
}

function accumul8_statement_upload_needs_catalog_refresh(array $upload): bool
{
    if (!accumul8_statement_upload_has_page_catalog($upload)) {
        return true;
    }
    if (!accumul8_statement_upload_has_transaction_locators($upload)) {
        return true;
    }
    if (accumul8_normalize_text((string)($upload['catalog_summary'] ?? ''), 255) === '') {
        return true;
    }
    return !accumul8_statement_upload_has_catalog_keywords($upload);
}

function accumul8_statement_upload_rescan_reasons(array $upload, bool $onlyMissingSuccessfulScan, bool $includeMissingCatalog, bool $force): array
{
    if ($force) {
        return ['forced'];
    }

    $reasons = [];
    if ($onlyMissingSuccessfulScan && !accumul8_statement_scan_is_successful($upload)) {
        $reasons[] = 'missing_successful_scan';
    }
    if ($includeMissingCatalog && accumul8_statement_upload_needs_catalog_refresh($upload)) {
        $reasons[] = 'missing_catalog_data';
    }

    return array_values(array_unique($reasons));
}

function accumul8_statement_list_rescan_candidates(?int $ownerUserId = null, array $options = []): array
{
    if (!accumul8_table_exists('accumul8_statement_uploads')) {
        return [];
    }

    $limit = isset($options['limit']) ? (int)$options['limit'] : 25;
    if ($limit <= 0) {
        $limit = 25;
    }
    $limit = max(1, min($limit, 500));
    $onlyMissingSuccessfulScan = array_key_exists('only_missing_successful_scan', $options) ? (bool)$options['only_missing_successful_scan'] : true;
    $includeMissingCatalog = array_key_exists('include_missing_catalog', $options) ? (bool)$options['include_missing_catalog'] : true;
    $force = !empty($options['force']);
    $excludeIds = array_values(array_unique(array_filter(
        array_map(static fn($id): int => (int)$id, is_array($options['exclude_ids'] ?? null) ? $options['exclude_ids'] : []),
        static fn(int $id): bool => $id > 0
    )));

    $sql = 'SELECT id, owner_user_id, account_id, status, original_filename, mime_type, created_at, last_scanned_at, processed_at,
                   COALESCE(last_error, "") AS last_error,
                   COALESCE(parsed_payload_json, "{}") AS parsed_payload_json,
                   COALESCE(transaction_locator_json, "[]") AS transaction_locator_json,
                   COALESCE(page_catalog_json, "[]") AS page_catalog_json,
                   COALESCE(catalog_summary, "") AS catalog_summary,
                   COALESCE(catalog_keywords_json, "[]") AS catalog_keywords_json
            FROM accumul8_statement_uploads';
    $params = [];
    if ($ownerUserId !== null && $ownerUserId > 0) {
        $sql .= ' WHERE owner_user_id = ?';
        $params[] = $ownerUserId;
    }
    $sql .= $params === [] ? ' WHERE' : ' AND';
    $sql .= ' COALESCE(is_archived, 0) = 0';
    if ($excludeIds !== []) {
        $placeholders = implode(', ', array_fill(0, count($excludeIds), '?'));
        $sql .= ' AND';
        $sql .= ' id NOT IN (' . $placeholders . ')';
        array_push($params, ...$excludeIds);
    }
    $sql .= ' ORDER BY
                CASE WHEN last_scanned_at IS NULL THEN 0 ELSE 1 END ASC,
                COALESCE(last_scanned_at, created_at) ASC,
                id ASC';

    $rows = Database::queryAll($sql, $params);
    $candidates = [];
    foreach ($rows as $row) {
        $reasons = accumul8_statement_upload_rescan_reasons($row, $onlyMissingSuccessfulScan, $includeMissingCatalog, $force);
        if ($reasons === []) {
            continue;
        }
        $candidates[] = [
            'id' => (int)($row['id'] ?? 0),
            'owner_user_id' => (int)($row['owner_user_id'] ?? 0),
            'account_id' => isset($row['account_id']) ? (int)$row['account_id'] : null,
            'status' => (string)($row['status'] ?? 'uploaded'),
            'original_filename' => (string)($row['original_filename'] ?? ''),
            'mime_type' => (string)($row['mime_type'] ?? ''),
            'created_at' => (string)($row['created_at'] ?? ''),
            'last_scanned_at' => (string)($row['last_scanned_at'] ?? ''),
            'processed_at' => (string)($row['processed_at'] ?? ''),
            'last_error' => (string)($row['last_error'] ?? ''),
            'needs_catalog_refresh' => accumul8_statement_upload_needs_catalog_refresh($row),
            'has_successful_scan' => accumul8_statement_scan_is_successful($row),
            'reasons' => $reasons,
        ];
        if (count($candidates) >= $limit) {
            break;
        }
    }

    return $candidates;
}

function accumul8_statement_batch_rescan(?int $ownerUserId = null, array $options = []): array
{
    $limit = isset($options['limit']) ? (int)$options['limit'] : 25;
    if ($limit <= 0) {
        $limit = 25;
    }
    $limit = max(1, min($limit, 500));
    $dryRun = !empty($options['dry_run']);
    $onlyMissingSuccessfulScan = array_key_exists('only_missing_successful_scan', $options) ? (bool)$options['only_missing_successful_scan'] : true;
    $includeMissingCatalog = array_key_exists('include_missing_catalog', $options) ? (bool)$options['include_missing_catalog'] : true;
    $force = !empty($options['force']);
    $excludeIds = array_values(array_unique(array_filter(
        array_map(static fn($id): int => (int)$id, is_array($options['exclude_ids'] ?? null) ? $options['exclude_ids'] : []),
        static fn(int $id): bool => $id > 0
    )));

    $candidates = accumul8_statement_list_rescan_candidates($ownerUserId, [
        'limit' => $limit,
        'only_missing_successful_scan' => $onlyMissingSuccessfulScan,
        'include_missing_catalog' => $includeMissingCatalog,
        'force' => $force,
        'exclude_ids' => $excludeIds,
    ]);

    $result = [
        'owner_user_id' => $ownerUserId,
        'dry_run' => $dryRun,
        'limit' => $limit,
        'only_missing_successful_scan' => $onlyMissingSuccessfulScan,
        'include_missing_catalog' => $includeMissingCatalog,
        'force' => $force,
        'exclude_ids' => $excludeIds,
        'candidate_count' => count($candidates),
        'scanned_count' => 0,
        'success_count' => 0,
        'failure_count' => 0,
        'skipped_count' => 0,
        'results' => [],
    ];

    if ($dryRun) {
        foreach ($candidates as $candidate) {
            $result['results'][] = [
                'id' => $candidate['id'],
                'owner_user_id' => $candidate['owner_user_id'],
                'status' => $candidate['status'],
                'original_filename' => $candidate['original_filename'],
                'reasons' => $candidate['reasons'],
                'needs_catalog_refresh' => $candidate['needs_catalog_refresh'],
                'has_successful_scan' => $candidate['has_successful_scan'],
                'last_error' => $candidate['last_error'],
                'last_scanned_at' => $candidate['last_scanned_at'],
            ];
        }
        $result['skipped_count'] = count($candidates);
        return $result;
    }

    foreach ($candidates as $candidate) {
        $result['scanned_count']++;
        try {
            $upload = accumul8_statement_scan_upload(
                (int)$candidate['owner_user_id'],
                (int)$candidate['id'],
                isset($candidate['account_id']) && (int)$candidate['account_id'] > 0 ? (int)$candidate['account_id'] : null,
                true
            );
            $result['success_count']++;
            $result['results'][] = [
                'id' => (int)$candidate['id'],
                'owner_user_id' => (int)$candidate['owner_user_id'],
                'status' => (string)($upload['status'] ?? ''),
                'original_filename' => (string)($candidate['original_filename'] ?? ''),
                'reasons' => $candidate['reasons'],
                'last_scanned_at' => (string)($upload['last_scanned_at'] ?? ''),
                'catalog_page_count' => is_array($upload['page_catalog'] ?? null) ? count($upload['page_catalog']) : 0,
                'locator_count' => is_array($upload['transaction_locators'] ?? null) ? count($upload['transaction_locators']) : 0,
            ];
        } catch (Throwable $e) {
            $result['failure_count']++;
            $result['results'][] = [
                'id' => (int)$candidate['id'],
                'owner_user_id' => (int)$candidate['owner_user_id'],
                'status' => 'failed',
                'original_filename' => (string)($candidate['original_filename'] ?? ''),
                'reasons' => $candidate['reasons'],
                'error' => accumul8_normalize_text($e->getMessage(), 1000),
            ];
        }
    }

    return $result;
}

function accumul8_statement_scan_upload(int $viewerId, int $uploadId, ?int $selectedAccountId = null, bool $markForReview = false): array
{
    $upload = Database::queryOne(
        'SELECT *
         FROM accumul8_statement_uploads
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$uploadId, $viewerId]
    );
    if (!$upload) {
        throw new RuntimeException('Statement upload not found');
    }

    $tmpPath = tempnam(sys_get_temp_dir(), 'accumul8_stmt_');
    if (!is_string($tmpPath) || $tmpPath === '') {
        throw new RuntimeException('Could not create temporary statement file');
    }
    file_put_contents($tmpPath, (string)($upload['file_blob'] ?? ''));
    try {
        $accountCatalog = accumul8_statement_account_catalog($viewerId);
        $mimeType = strtolower((string)($upload['mime_type'] ?? 'application/pdf'));
        $extract = ['text' => '', 'method' => '', 'page_catalog' => []];
        $text = '';
        $pageCatalog = [];
        $ai = null;
        $notes = [];
        $suspiciousParse = false;

        if (str_contains($mimeType, 'pdf')) {
            $extract = accumul8_statement_extract_text_from_file($tmpPath, (string)($upload['mime_type'] ?? 'application/pdf'));
            $text = accumul8_statement_structured_text_from_bytes((string)($extract['text'] ?? ''), 120000);
            $pageCatalog = is_array($extract['page_catalog'] ?? null) ? $extract['page_catalog'] : [];
            if ($text === '') {
                throw new RuntimeException('Could not extract readable text from the statement PDF. The backend OCR provider did not produce usable text.');
            }
            try {
                $ai = accumul8_statement_parse_from_ocr_text($text, (string)($upload['original_filename'] ?? ''), $accountCatalog, $pageCatalog, true);
                foreach ((array)($ai['notes'] ?? []) as $pipelineNote) {
                    $pipelineNote = accumul8_normalize_text((string)$pipelineNote, 255);
                    if ($pipelineNote !== '') {
                        $notes[] = $pipelineNote;
                    }
                }
                $parsedCandidate = is_array($ai['json'] ?? null) ? $ai['json'] : [];
                if ($parsedCandidate !== [] && accumul8_statement_ai_result_is_suspicious($parsedCandidate, $text, (string)($upload['original_filename'] ?? ''), (array)($ai['profile'] ?? []))) {
                    $suspiciousParse = true;
                    $reasons = array_values(array_filter(array_map(static fn($value): string => accumul8_normalize_text((string)$value, 80), (array)($ai['analysis']['reasons'] ?? []))));
                    $reasonText = $reasons !== [] ? ' Reasons: ' . implode(', ', array_slice($reasons, 0, 4)) . '.' : '';
                    $notes[] = 'The OCR-based statement parse looked suspicious. Importable rows were withheld to avoid posting hallucinated transactions.' . $reasonText;
                }
            } catch (Throwable $textAiError) {
                throw new RuntimeException('Could not generate a valid statement scan from backend extracted text: ' . accumul8_normalize_text($textAiError->getMessage(), 400));
            }
        } elseif (str_starts_with($mimeType, 'image/')) {
            $extract = accumul8_statement_extract_text_from_file($tmpPath, (string)($upload['mime_type'] ?? 'application/pdf'));
            $text = accumul8_statement_structured_text_from_bytes((string)($extract['text'] ?? ''), 120000);
            $pageCatalog = is_array($extract['page_catalog'] ?? null) ? $extract['page_catalog'] : [];
            if ($text === '') {
                throw new RuntimeException('Could not extract readable text from the statement image. The backend OCR provider did not produce usable text.');
            }
            try {
                $ai = accumul8_statement_parse_from_ocr_text($text, (string)($upload['original_filename'] ?? ''), $accountCatalog, $pageCatalog, true);
                foreach ((array)($ai['notes'] ?? []) as $pipelineNote) {
                    $pipelineNote = accumul8_normalize_text((string)$pipelineNote, 255);
                    if ($pipelineNote !== '') {
                        $notes[] = $pipelineNote;
                    }
                }
                $parsedCandidate = is_array($ai['json'] ?? null) ? $ai['json'] : [];
                if ($parsedCandidate !== [] && accumul8_statement_ai_result_is_suspicious($parsedCandidate, $text, (string)($upload['original_filename'] ?? ''), (array)($ai['profile'] ?? []))) {
                    $suspiciousParse = true;
                    $reasons = array_values(array_filter(array_map(static fn($value): string => accumul8_normalize_text((string)$value, 80), (array)($ai['analysis']['reasons'] ?? []))));
                    $reasonText = $reasons !== [] ? ' Reasons: ' . implode(', ', array_slice($reasons, 0, 4)) . '.' : '';
                    $notes[] = 'The OCR-based image parse looked suspicious. Importable rows were withheld to avoid posting hallucinated transactions.' . $reasonText;
                }
            } catch (Throwable $imageAiError) {
                throw new RuntimeException('Could not generate a valid statement scan from backend OCR text: ' . accumul8_normalize_text($imageAiError->getMessage(), 400));
            }
        } else {
            $extract = accumul8_statement_extract_text_from_file($tmpPath, (string)($upload['mime_type'] ?? 'application/pdf'));
            $text = accumul8_statement_structured_text_from_bytes((string)($extract['text'] ?? ''), 120000);
            $pageCatalog = is_array($extract['page_catalog'] ?? null) ? $extract['page_catalog'] : [];
            if ($text === '') {
                throw new RuntimeException('Could not extract readable text from the statement file.');
            }
            $ai = accumul8_ai_generate_statement_json($text, $accountCatalog, $pageCatalog);
        }
        $parsed = is_array($ai['json'] ?? null) ? accumul8_statement_normalize_parsed_payload($ai['json']) : [];
        $profileSlug = strtolower(trim((string)($ai['profile']['slug'] ?? '')));
        $profileInstitution = accumul8_normalize_text((string)($ai['profile']['institution_name'] ?? ''), 191);
        if ($profileSlug !== '' && $profileSlug !== 'generic') {
            $notes[] = 'Statement parser profile: ' . ($profileInstitution !== '' ? $profileInstitution : $profileSlug) . '.';
        }
        if ($suspiciousParse) {
            $parsed = accumul8_statement_empty_parsed_payload([
                'statement_kind' => $parsed['statement_kind'] ?? $upload['statement_kind'] ?? 'bank_account',
                'institution_name' => $parsed['institution_name'] ?? $upload['institution_name'] ?? '',
                'account_name_hint' => $parsed['account_name_hint'] ?? $upload['account_name_hint'] ?? '',
                'account_last4' => $parsed['account_last4'] ?? $upload['account_mask_last4'] ?? '',
                'period_start' => $parsed['period_start'] ?? '',
                'period_end' => $parsed['period_end'] ?? '',
                'opening_balance' => $parsed['opening_balance'] ?? null,
                'closing_balance' => $parsed['closing_balance'] ?? null,
            ]);
        }
        $match = accumul8_statement_match_account($viewerId, $parsed, $selectedAccountId);
        $accountId = isset($match['account_id']) && (int)$match['account_id'] > 0 ? (int)$match['account_id'] : null;
        $distinctAccountTags = accumul8_statement_distinct_account_tags($parsed);
        if (count($distinctAccountTags) > 1) {
            $accountId = null;
        }
        $transactionLocators = accumul8_statement_transaction_locators($parsed);
        foreach ((array)($parsed['account_match_hints'] ?? []) as $hint) {
            $hint = accumul8_normalize_text((string)$hint, 255);
            if ($hint !== '') {
                $notes[] = $hint;
            }
        }
        if (count($distinctAccountTags) > 1) {
            $notes[] = 'Multiple account sections were detected. Transactions will be matched and imported against their tagged statement accounts.';
        } elseif ($accountId === null) {
            $notes[] = 'No confident account match was detected. Review the import plan before approving.';
        }
        $catalog = accumul8_statement_catalog_payload($parsed, $text);
        $reviewRows = accumul8_statement_review_rows($parsed, $transactionLocators, $accountCatalog);
        $catalogVerification = accumul8_statement_catalog_verification_payload($parsed, $reviewRows);
        if (!empty($catalogVerification['summary'])) {
            $notes[] = (string)$catalogVerification['summary'];
        }
        $catalogTrace = accumul8_statement_catalog_trace_payload($upload, $extract, $text, $ai, $parsed, $transactionLocators, $catalog, $notes, $catalogVerification);
        $scanStatus = ($markForReview || (($catalogVerification['status'] ?? '') !== 'verified')) ? 'needs_review' : 'scanned';
        $reconciliationNote = (($catalogVerification['summary'] ?? '') !== '')
            ? 'Scan complete. ' . (string)$catalogVerification['summary'] . ' Review the proposed import plan before importing.'
            : 'Scan complete. Review the proposed import plan before importing.';

        Database::execute(
            'UPDATE accumul8_statement_uploads
             SET account_id = ?, statement_kind = ?, status = ?, extracted_text = ?, extracted_method = ?, ai_provider = ?, ai_model = ?,
                 institution_name = ?, account_name_hint = ?, account_mask_last4 = ?,
                 period_start = ?, period_end = ?, opening_balance = ?, closing_balance = ?,
                 imported_transaction_count = ?, duplicate_transaction_count = ?, suspicious_item_count = ?,
                 reconciliation_status = ?, reconciliation_note = ?, suspicious_items_json = ?, processing_notes_json = ?, transaction_locator_json = ?, page_catalog_json = ?, parsed_payload_json = ?,
                 catalog_summary = ?, catalog_keywords_json = ?, catalog_trace_json = ?, import_result_json = NULL, last_error = NULL, processed_at = NULL, last_scanned_at = NOW()
             WHERE id = ? AND owner_user_id = ?',
            [
                $accountId,
                accumul8_statement_normalize_kind($parsed['statement_kind'] ?? $upload['statement_kind'] ?? 'bank_account'),
                $scanStatus,
                $text,
                (string)($extract['method'] ?? ''),
                (string)($ai['provider'] ?? ''),
                (string)($ai['model'] ?? ''),
                accumul8_normalize_text((string)($parsed['institution_name'] ?? ''), 191),
                accumul8_normalize_text((string)($parsed['account_name_hint'] ?? ''), 191),
                accumul8_normalize_text((string)($parsed['account_last4'] ?? ''), 16),
                accumul8_normalize_date($parsed['period_start'] ?? ''),
                accumul8_normalize_date($parsed['period_end'] ?? ''),
                isset($parsed['opening_balance']) && is_numeric($parsed['opening_balance']) ? accumul8_normalize_amount($parsed['opening_balance']) : null,
                isset($parsed['closing_balance']) && is_numeric($parsed['closing_balance']) ? accumul8_normalize_amount($parsed['closing_balance']) : null,
                (int)($upload['imported_transaction_count'] ?? 0),
                (int)($upload['duplicate_transaction_count'] ?? 0),
                (int)($upload['suspicious_item_count'] ?? 0),
                'pending',
                $reconciliationNote,
                json_encode([], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                json_encode(array_values(array_unique($notes)), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                json_encode($transactionLocators, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                json_encode($pageCatalog, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                json_encode($parsed, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                (string)($catalog['summary'] ?? ''),
                json_encode($catalog['keywords'] ?? [], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                json_encode($catalogTrace, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                $uploadId,
                $viewerId,
            ]
        );
    } catch (Throwable $e) {
        Database::execute(
            'UPDATE accumul8_statement_uploads
             SET status = ?, reconciliation_status = ?, last_error = ?, last_scanned_at = NOW()
             WHERE id = ? AND owner_user_id = ?',
            ['failed', 'needs_review', accumul8_normalize_text($e->getMessage(), 1000), $uploadId, $viewerId]
        );
        throw $e;
    } finally {
        @unlink($tmpPath);
    }

    return accumul8_statement_reload_view($viewerId, $uploadId);
}

function accumul8_statement_find_or_create_account_group(int $viewerId, string $groupName, string $institutionName): ?int
{
    $groupName = accumul8_normalize_text($groupName, 191);
    $institutionName = accumul8_normalize_text($institutionName, 191);
    if ($groupName === '') {
        return null;
    }
    $existing = Database::queryOne(
        'SELECT id
         FROM accumul8_account_groups
         WHERE owner_user_id = ?
           AND group_name = ?
         LIMIT 1',
        [$viewerId, $groupName]
    );
    if ($existing) {
        return (int)($existing['id'] ?? 0);
    }
    Database::execute(
        'INSERT INTO accumul8_account_groups (owner_user_id, group_name, institution_name, notes, is_active)
         VALUES (?, ?, ?, NULL, 1)',
        [$viewerId, $groupName, $institutionName]
    );
    return (int)Database::lastInsertId();
}

function accumul8_statement_ocr_diagnostics(int $viewerId, ?int $uploadId = null, bool $forceOcr = false): array
{
    $imagickFormats = [];
    if (class_exists('Imagick')) {
        try {
            $imagickFormats = array_values(array_filter(array_map(
                static fn($format): string => strtoupper(trim((string)$format)),
                Imagick::queryFormats()
            )));
        } catch (Throwable $e) {
            $imagickFormats = [];
        }
    }
    $dedicatedServiceAccount = (string)secret_get(catn8_secret_key('accumul8.ocr.google.service_account_json'));
    $vertexServiceAccount = (string)secret_get(catn8_settings_ai_secret_key('google_vertex_ai', 'service_account_json'));
    $mysteryServiceAccount = (string)secret_get('CATN8_MYSTERY_GCP_SERVICE_ACCOUNT_JSON');
    $diagnostics = [
        'shell_exec_available' => function_exists('shell_exec'),
        'binaries' => [
            'pdfinfo' => accumul8_statement_find_binary('pdfinfo', ['/usr/bin/pdfinfo', '/usr/local/bin/pdfinfo', '/opt/homebrew/bin/pdfinfo']),
            'pdftotext' => accumul8_statement_find_binary('pdftotext', ['/usr/bin/pdftotext', '/usr/local/bin/pdftotext', '/opt/homebrew/bin/pdftotext']),
            'pdftoppm' => accumul8_statement_find_binary('pdftoppm', ['/usr/bin/pdftoppm', '/usr/local/bin/pdftoppm', '/opt/homebrew/bin/pdftoppm']),
            'tesseract' => accumul8_statement_find_binary('tesseract', ['/usr/bin/tesseract', '/usr/local/bin/tesseract', '/opt/homebrew/bin/tesseract']),
        ],
        'imagick' => [
            'available' => class_exists('Imagick'),
            'supports_pdf' => in_array('PDF', $imagickFormats, true),
            'supports_png' => in_array('PNG', $imagickFormats, true),
        ],
        'dedicated_accumul8_service_account_available' => trim($dedicatedServiceAccount) !== '',
        'google_vertex_service_account_available' => trim($vertexServiceAccount) !== '',
        'mystery_gcp_service_account_available' => trim($mysteryServiceAccount) !== '',
        'test' => null,
    ];

    if ($uploadId === null || $uploadId <= 0) {
        return $diagnostics;
    }

    $upload = Database::queryOne(
        'SELECT id, owner_user_id, original_filename, mime_type, file_blob
         FROM accumul8_statement_uploads
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$uploadId, $viewerId]
    );
    if (!$upload) {
        throw new RuntimeException('Statement upload not found');
    }

    $tmpPath = tempnam(sys_get_temp_dir(), 'accumul8_stmt_diag_');
    if (!is_string($tmpPath) || $tmpPath === '') {
        throw new RuntimeException('Could not create temporary statement file');
    }
    file_put_contents($tmpPath, (string)($upload['file_blob'] ?? ''));

    try {
        $mimeType = strtolower((string)($upload['mime_type'] ?? 'application/pdf'));
        $method = '';
        $text = '';
        $pageCatalog = [];

        if ($forceOcr && str_contains($mimeType, 'pdf')) {
            $extract = accumul8_statement_extract_pdf_text_with_ocr_fallback($tmpPath);
            $method = 'pdf_ocr_forced';
            $text = accumul8_statement_text_from_bytes((string)($extract['text'] ?? ''), 120000);
            $pageCatalog = is_array($extract['page_catalog'] ?? null) ? $extract['page_catalog'] : [];
        } elseif ($forceOcr && str_starts_with($mimeType, 'image/')) {
            $method = 'image_ocr_forced';
            $text = accumul8_statement_extract_image_text_with_tesseract($tmpPath);
            $pageCatalog = $text !== '' ? [['page_number' => 1, 'text_excerpt' => accumul8_statement_structured_text_excerpt($text, 6000)]] : [];
        } else {
            $extract = accumul8_statement_extract_text_from_file($tmpPath, (string)($upload['mime_type'] ?? 'application/pdf'));
            $method = (string)($extract['method'] ?? '');
            $text = accumul8_statement_structured_text_from_bytes((string)($extract['text'] ?? ''), 120000);
            $pageCatalog = is_array($extract['page_catalog'] ?? null) ? (array)$extract['page_catalog'] : [];
        }

        $diagnostics['test'] = [
            'upload_id' => (int)($upload['id'] ?? 0),
            'original_filename' => (string)($upload['original_filename'] ?? ''),
            'mime_type' => (string)($upload['mime_type'] ?? ''),
            'force_ocr' => $forceOcr ? 1 : 0,
            'method' => $method,
            'text_length' => strlen($text),
            'page_catalog_count' => count($pageCatalog),
            'text_excerpt' => accumul8_statement_structured_text_excerpt($text, 1200),
        ];
    } finally {
        @unlink($tmpPath);
    }

    return $diagnostics;
}

function accumul8_statement_create_account_from_plan(int $viewerId, array $payload): int
{
    $accountName = accumul8_normalize_text($payload['account_name'] ?? '', 191);
    if ($accountName === '') {
        throw new RuntimeException('New account name is required');
    }
    $accountType = accumul8_validate_account_type($payload['account_type'] ?? 'checking');
    $institutionName = accumul8_normalize_text($payload['institution_name'] ?? '', 191);
    $maskLast4 = accumul8_normalize_text($payload['mask_last4'] ?? '', 8);
    $groupName = accumul8_normalize_text($payload['banking_organization_name'] ?? '', 191);
    $existing = Database::queryOne(
        'SELECT a.id
         FROM accumul8_accounts a
         LEFT JOIN accumul8_account_groups ag
           ON ag.id = a.account_group_id
          AND ag.owner_user_id = a.owner_user_id
         WHERE a.owner_user_id = ?
           AND a.account_name = ?
           AND a.account_type = ?
           AND COALESCE(a.institution_name, "") = ?
           AND COALESCE(a.mask_last4, "") = ?
           AND COALESCE(ag.group_name, "") = ?
         LIMIT 1',
        [$viewerId, $accountName, $accountType, $institutionName, $maskLast4, $groupName]
    );
    if ($existing) {
        return (int)($existing['id'] ?? 0);
    }
    $groupId = $groupName !== '' ? accumul8_statement_find_or_create_account_group($viewerId, $groupName, $institutionName) : null;

    Database::execute(
        'INSERT INTO accumul8_accounts
            (owner_user_id, account_group_id, account_name, account_type, institution_name, mask_last4, current_balance, available_balance, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 0.00, 0.00, 1)',
        [$viewerId, $groupId, $accountName, $accountType, $institutionName, $maskLast4]
    );
    return (int)Database::lastInsertId();
}

function accumul8_statement_import_upload(int $viewerId, int $actorUserId, int $uploadId, array $options = []): array
{
    $upload = Database::queryOne(
        'SELECT *
         FROM accumul8_statement_uploads
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$uploadId, $viewerId]
    );
    if (!$upload) {
        throw new RuntimeException('Statement upload not found');
    }

    $parsed = json_decode((string)($upload['parsed_payload_json'] ?? '{}'), true);
    if (!is_array($parsed) || $parsed === []) {
        accumul8_statement_scan_upload($viewerId, $uploadId, null, true);
        $upload = Database::queryOne(
            'SELECT *
             FROM accumul8_statement_uploads
             WHERE id = ? AND owner_user_id = ?
             LIMIT 1',
            [$uploadId, $viewerId]
        );
        $parsed = is_array($upload) ? json_decode((string)($upload['parsed_payload_json'] ?? '{}'), true) : [];
    }
    if (!is_array($parsed) || $parsed === []) {
        throw new RuntimeException('Statement scan did not produce an importable plan');
    }

    $txRows = [];
    $duplicateRows = [];
    $failedRows = [];
    $primaryAccountId = null;
    $rowAccountIds = [];
    foreach (accumul8_statement_transaction_rows($parsed) as $tx) {
        $index = (int)($tx['row_index'] ?? 0);
        $statementAccountNameHint = accumul8_normalize_text((string)($tx['statement_account_name_hint'] ?? ''), 191);
        $statementAccountLast4 = accumul8_normalize_text((string)($tx['statement_account_last4'] ?? ''), 16);
        $statementAccountLabel = accumul8_statement_build_account_tag_label($statementAccountNameHint, $statementAccountLast4);
        if ((int)($tx['is_valid_json'] ?? 0) !== 1) {
            $failedRows[] = ['index' => $index, 'reason' => 'Transaction entry was not valid JSON'];
            continue;
        }
        $txDate = accumul8_normalize_date($tx['transaction_date'] ?? $tx['posted_date'] ?? '');
        $description = accumul8_normalize_text((string)($tx['description'] ?? ''), 255);
        if ($txDate === null || $description === '' || !is_numeric($tx['amount'] ?? null)) {
            $failedRows[] = ['index' => $index, 'transaction_date' => accumul8_normalize_text((string)($tx['transaction_date'] ?? ''), 32), 'description' => $description, 'reason' => 'Missing date, description, or amount', 'statement_account_name_hint' => $statementAccountNameHint, 'statement_account_last4' => $statementAccountLast4, 'statement_account_label' => $statementAccountLabel];
            continue;
        }
        $amount = accumul8_normalize_amount($tx['amount']);
        $memo = accumul8_normalize_text((string)($tx['memo'] ?? ''), 2000);
        try {
            $accountId = accumul8_statement_resolve_row_account_id($viewerId, $upload, $parsed, $tx, $options, $rowAccountIds);
        } catch (Throwable $accountError) {
            $failedRows[] = ['index' => $index, 'transaction_date' => $txDate, 'description' => $description, 'amount' => $amount, 'reason' => accumul8_normalize_text($accountError->getMessage(), 255), 'statement_account_name_hint' => $statementAccountNameHint, 'statement_account_last4' => $statementAccountLast4, 'statement_account_label' => $statementAccountLabel];
            continue;
        }
        if ($primaryAccountId === null && $accountId > 0) {
            $primaryAccountId = $accountId;
        }
        $entityId = accumul8_statement_resolve_entity_id($viewerId, $description);
        $duplicate = Database::queryOne(
            'SELECT id
             FROM accumul8_transactions
             WHERE owner_user_id = ?
               AND COALESCE(account_id, 0) = ?
               AND transaction_date = ?
               AND ROUND(amount, 2) = ?
               AND description = ?
            LIMIT 1',
            [$viewerId, $accountId, $txDate, $amount, $description]
        );
        if ($duplicate) {
            $duplicateRows[] = ['transaction_date' => $txDate, 'description' => $description, 'amount' => $amount, 'existing_transaction_id' => (int)($duplicate['id'] ?? 0), 'statement_account_name_hint' => $statementAccountNameHint, 'statement_account_last4' => $statementAccountLast4, 'statement_account_label' => $statementAccountLabel, 'suggested_account_id' => $accountId];
            continue;
        }
        try {
            $externalKey = hash('sha256', implode('|', [$viewerId, $uploadId, $accountId, $txDate, $description, number_format($amount, 2, '.', '')]));
            Database::execute(
                'INSERT INTO accumul8_transactions
                 (owner_user_id, account_id, entity_id, balance_entity_id, contact_id, debtor_id, transaction_date, due_date, entry_type, description, memo, amount, rta_amount, running_balance, is_paid, is_reconciled, is_budget_planner, is_recurring_instance, recurring_payment_id, source_kind, source_ref, external_id, pending_status, created_by_user_id)
                 VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, 0.00, ?, 1, 1, 0, 0, NULL, ?, ?, ?, 0, ?)',
                [
                    $viewerId,
                    $accountId,
                    $entityId,
                    $txDate,
                    $txDate,
                    $amount < 0 ? 'bill' : 'deposit',
                    $description,
                    $memo,
                    $amount,
                    isset($tx['running_balance']) && is_numeric($tx['running_balance']) ? accumul8_normalize_amount($tx['running_balance']) : 0.00,
                    'statement_upload',
                    'statement_upload:' . $uploadId,
                    $externalKey,
                    $actorUserId,
                ]
            );
            $insertedId = (int)Database::lastInsertId();
            Database::execute(
                'UPDATE accumul8_transactions
                 SET paid_date = transaction_date
                 WHERE id = ? AND owner_user_id = ?',
                [$insertedId, $viewerId]
            );
            $txRows[] = [
                'id' => $insertedId,
                'account_id' => $accountId,
                'transaction_date' => $txDate,
                'description' => $description,
                'amount' => $amount,
                'entity_id' => $entityId,
                'running_balance' => isset($tx['running_balance']) && is_numeric($tx['running_balance']) ? accumul8_normalize_amount($tx['running_balance']) : null,
                'statement_account_name_hint' => $statementAccountNameHint,
                'statement_account_last4' => $statementAccountLast4,
                'statement_account_label' => $statementAccountLabel,
            ];
        } catch (Throwable $error) {
            $failedRows[] = ['index' => $index, 'transaction_date' => $txDate, 'description' => $description, 'amount' => $amount, 'reason' => accumul8_normalize_text($error->getMessage(), 255), 'statement_account_name_hint' => $statementAccountNameHint, 'statement_account_last4' => $statementAccountLast4, 'statement_account_label' => $statementAccountLabel, 'suggested_account_id' => $accountId];
        }
    }

    $alerts = accumul8_statement_detect_suspicious_items($viewerId, $txRows);
    $reconciliation = accumul8_statement_reconciliation_payload($parsed, $txRows, count($duplicateRows));
    $notes = [];
    foreach ((array)($parsed['account_match_hints'] ?? []) as $hint) {
        $hint = accumul8_normalize_text((string)$hint, 255);
        if ($hint !== '') {
            $notes[] = $hint;
        }
    }
    if ($failedRows !== []) {
        $notes[] = count($failedRows) . ' row(s) could not be imported and require review.';
    }
    $status = $failedRows === [] && $reconciliation['status'] === 'balanced' ? 'processed' : 'needs_review';
    $importResult = [
        'imported_count' => count($txRows),
        'duplicate_count' => count($duplicateRows),
        'failed_count' => count($failedRows),
        'successful_rows' => array_slice($txRows, 0, 20),
        'duplicate_rows' => array_slice($duplicateRows, 0, 20),
        'failed_rows' => array_slice($failedRows, 0, 20),
    ];

    Database::execute(
        'UPDATE accumul8_statement_uploads
         SET account_id = ?, status = ?, imported_transaction_count = ?, duplicate_transaction_count = ?, suspicious_item_count = ?,
             reconciliation_status = ?, reconciliation_note = ?, suspicious_items_json = ?, processing_notes_json = ?, import_result_json = ?,
             last_error = NULL, processed_at = NOW()
         WHERE id = ? AND owner_user_id = ?',
        [
            $primaryAccountId,
            $status,
            count($txRows),
            count($duplicateRows),
            count($alerts),
            $reconciliation['status'],
            trim($reconciliation['note'] . ' ' . implode(' ', array_values(array_unique($notes)))),
            json_encode($alerts, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            json_encode(array_values(array_unique($notes)), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            json_encode($importResult, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            $uploadId,
            $viewerId,
        ]
    );

    return accumul8_statement_reload_view($viewerId, $uploadId);
}

function accumul8_statement_search_uploads(int $viewerId, string $query): array
{
    $query = trim($query);
    if ($query === '') {
        return [];
    }
    $terms = array_values(array_unique(array_filter(preg_split('/\s+/', strtolower($query)) ?: [], static fn($term): bool => strlen($term) >= 2)));
    if ($terms === []) {
        return [];
    }

    $rows = Database::queryAll(
        'SELECT su.id, su.original_filename, su.status, COALESCE(su.catalog_summary, "") AS catalog_summary, COALESCE(su.extracted_text, "") AS extracted_text,
                COALESCE(su.parsed_payload_json, "{}") AS parsed_payload_json, su.account_name_hint, su.institution_name, su.account_mask_last4, su.created_at, su.period_start, su.period_end,
                COALESCE(a.account_name, "") AS account_name
         FROM accumul8_statement_uploads su
         LEFT JOIN accumul8_accounts a
           ON a.id = su.account_id
          AND a.owner_user_id = su.owner_user_id
         WHERE su.owner_user_id = ?
          AND COALESCE(su.is_archived, 0) = 0
        ORDER BY su.created_at DESC, su.id DESC
        LIMIT 200',
        [$viewerId]
    );

    $results = [];
    foreach ($rows as $row) {
        $haystack = strtolower(implode("\n", array_filter([
            (string)($row['original_filename'] ?? ''),
            (string)($row['catalog_summary'] ?? ''),
            (string)($row['account_name_hint'] ?? ''),
            (string)($row['institution_name'] ?? ''),
            (string)($row['account_name'] ?? ''),
            (string)($row['extracted_text'] ?? ''),
        ])));
        $score = 0;
        foreach ($terms as $term) {
            if (str_contains($haystack, $term)) {
                $score++;
            }
        }
        if ($score === 0) {
            continue;
        }

        $snippet = accumul8_normalize_text((string)($row['catalog_summary'] ?? ''), 220);
        $extractedText = (string)($row['extracted_text'] ?? '');
        $lowerExtracted = strtolower($extractedText);
        foreach ($terms as $term) {
            $pos = strpos($lowerExtracted, $term);
            if ($pos !== false) {
                $snippet = trim(substr($extractedText, max(0, $pos - 70), 180));
                break;
            }
        }

        $matchedPage = null;
        $parsed = json_decode((string)($row['parsed_payload_json'] ?? '{}'), true);
        foreach (accumul8_statement_transaction_rows(is_array($parsed) ? $parsed : []) as $tx) {
            $txText = strtolower(implode(' ', [
                (string)($tx['description'] ?? ''),
                (string)($tx['memo'] ?? ''),
                (string)($tx['transaction_date'] ?? ''),
                (string)($tx['statement_account_name_hint'] ?? ''),
                (string)($tx['statement_account_last4'] ?? ''),
            ]));
            $allMatched = true;
            foreach ($terms as $term) {
                if (!str_contains($txText, $term)) {
                    $allMatched = false;
                    break;
                }
            }
            if ($allMatched) {
                $matchedPage = isset($tx['page_number']) && is_numeric($tx['page_number']) ? (int)$tx['page_number'] : null;
                break;
            }
        }

        $results[] = [
            'upload_id' => (int)($row['id'] ?? 0),
            'original_filename' => (string)($row['original_filename'] ?? ''),
            'status' => (string)($row['status'] ?? ''),
            'account_name' => (string)($row['account_name'] ?? ''),
            'institution_name' => (string)($row['institution_name'] ?? ''),
            'period_start' => (string)($row['period_start'] ?? ''),
            'period_end' => (string)($row['period_end'] ?? ''),
            'matched_page_number' => $matchedPage,
            'snippet' => $snippet,
            'score' => $score,
        ];
    }

    usort($results, static function (array $a, array $b): int {
        $scoreCompare = (int)($b['score'] ?? 0) <=> (int)($a['score'] ?? 0);
        if ($scoreCompare !== 0) {
            return $scoreCompare;
        }
        return (int)($b['upload_id'] ?? 0) <=> (int)($a['upload_id'] ?? 0);
    });

    return array_slice($results, 0, 20);
}

function accumul8_due_bills(int $viewerId): array
{
    $hasSourceKind = accumul8_table_has_column('accumul8_transactions', 'source_kind');
    $hasEntryType = accumul8_table_has_column('accumul8_transactions', 'entry_type');
    $sourceKindSelect = $hasSourceKind ? 'source_kind' : "'manual' AS source_kind";
    $filters = [];
    if ($hasSourceKind) {
        $filters[] = "source_kind IN ('recurring', 'manual', 'teller')";
    }
    if ($hasEntryType) {
        $filters[] = "entry_type IN ('bill', 'auto', 'manual')";
    }
    $kindClause = $filters ? 'AND (' . implode(' OR ', $filters) . ')' : '';
    $rows = Database::queryAll(
        "SELECT id, transaction_date, " . accumul8_optional_select('accumul8_transactions', 'due_date', 'due_date', 'NULL AS due_date') . ", description, amount, is_paid, " . $sourceKindSelect . "
         FROM accumul8_transactions
         WHERE owner_user_id = ?
           AND amount < 0
           AND is_paid = 0
           " . $kindClause . "
         ORDER BY CASE WHEN COALESCE(due_date, transaction_date) < CURDATE() THEN 0 ELSE 1 END ASC,
                  COALESCE(due_date, transaction_date) ASC,
                  id ASC",
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

function accumul8_summary(int $viewerId): array
{
    if (!accumul8_table_exists('accumul8_transactions')) {
        return [
            'net_amount' => 0.0,
            'inflow_total' => 0.0,
            'outflow_total' => 0.0,
            'unpaid_outflow_total' => 0.0,
        ];
    }

    $isPaidExpr = accumul8_table_has_column('accumul8_transactions', 'is_paid')
        ? 'CASE WHEN is_paid = 0 AND amount < 0 THEN amount ELSE 0 END'
        : '0';

    $row = Database::queryOne(
        'SELECT
            COALESCE(SUM(amount), 0) AS net_amount,
            COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS inflow_total,
            COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END), 0) AS outflow_total,
            COALESCE(SUM(' . $isPaidExpr . '), 0) AS unpaid_outflow_total
         FROM accumul8_transactions
         WHERE owner_user_id = ?',
        [$viewerId]
    ) ?: [];

    return [
        'net_amount' => (float)($row['net_amount'] ?? 0),
        'inflow_total' => (float)($row['inflow_total'] ?? 0),
        'outflow_total' => (float)($row['outflow_total'] ?? 0),
        'unpaid_outflow_total' => (float)($row['unpaid_outflow_total'] ?? 0),
    ];
}

function accumul8_bootstrap_section(string $label, callable $loader, $fallback, array &$warnings)
{
    try {
        return $loader();
    } catch (Throwable $e) {
        $warnings[] = [
            'section' => $label,
            'error' => $e->getMessage(),
        ];
        error_log('accumul8 bootstrap section failed [' . $label . ']: ' . $e->getMessage());
        return $fallback;
    }
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

function accumul8_normalize_month_value(?string $monthValue): ?string
{
    $normalized = trim((string)$monthValue);
    if (!preg_match('/^\d{4}-\d{2}$/', $normalized)) {
        return null;
    }

    [$year, $month] = array_map('intval', explode('-', $normalized));
    if ($year < 2000 || $year > 2100 || $month < 1 || $month > 12) {
        return null;
    }

    return sprintf('%04d-%02d', $year, $month);
}

function accumul8_month_start(string $monthValue): ?DateTimeImmutable
{
    $normalized = accumul8_normalize_month_value($monthValue);
    if ($normalized === null) {
        return null;
    }

    return DateTimeImmutable::createFromFormat('!Y-m-d', $normalized . '-01', new DateTimeZone('UTC')) ?: null;
}

function accumul8_month_end(string $monthValue): ?DateTimeImmutable
{
    $monthStart = accumul8_month_start($monthValue);
    if (!$monthStart) {
        return null;
    }

    return $monthStart->modify('last day of this month');
}

function accumul8_month_range(string $startMonth, string $endMonth): array
{
    $start = accumul8_month_start($startMonth);
    $end = accumul8_month_start($endMonth);
    if (!$start || !$end) {
        return [];
    }

    if ($start > $end) {
        [$start, $end] = [$end, $start];
    }

    $months = [];
    $cursor = $start;
    $guard = 0;
    while ($cursor <= $end && $guard < 240) {
        $months[] = $cursor->format('Y-m');
        $cursor = $cursor->modify('+1 month');
        $guard++;
    }

    return $months;
}

function accumul8_shift_occurrence_date(DateTimeImmutable $base, string $frequency, int $intervalCount, int $direction): DateTimeImmutable
{
    $safeInterval = max(1, min(365, $intervalCount));
    $multiplier = $direction >= 0 ? 1 : -1;
    return match ($frequency) {
        'daily' => $base->modify(($safeInterval * $multiplier) . ' day'),
        'weekly' => $base->modify(($safeInterval * 7 * $multiplier) . ' day'),
        'biweekly' => $base->modify(($safeInterval * 14 * $multiplier) . ' day'),
        default => $base->modify(($safeInterval * $multiplier) . ' month'),
    };
}

function accumul8_recurring_occurrences_for_month(array $recurring, string $monthValue): array
{
    $anchor = DateTimeImmutable::createFromFormat('!Y-m-d', (string)($recurring['next_due_date'] ?? ''), new DateTimeZone('UTC'));
    $monthStart = accumul8_month_start($monthValue);
    $monthEnd = accumul8_month_end($monthValue);
    if (!$anchor || !$monthStart || !$monthEnd) {
        return [];
    }

    $frequency = (string)($recurring['frequency'] ?? 'monthly');
    $intervalCount = (int)($recurring['interval_count'] ?? 1);
    $dates = [];
    $cursor = $anchor;
    $guard = 0;

    while ($cursor > $monthEnd && $guard < 240) {
        $cursor = accumul8_shift_occurrence_date($cursor, $frequency, $intervalCount, -1);
        $guard++;
    }
    while (accumul8_shift_occurrence_date($cursor, $frequency, $intervalCount, 1) <= $monthEnd && $guard < 480) {
        $cursor = accumul8_shift_occurrence_date($cursor, $frequency, $intervalCount, 1);
        $guard++;
    }

    $guard = 0;
    while ($cursor >= $monthStart && $cursor <= $monthEnd && $guard < 240) {
        $dates[] = $cursor->format('Y-m-d');
        $cursor = accumul8_shift_occurrence_date($cursor, $frequency, $intervalCount, -1);
        $guard++;
    }

    return array_reverse($dates);
}

function accumul8_ensure_budget_month_transactions(int $viewerId, int $actorUserId, string $selectedMonth): int
{
    $normalizedMonth = accumul8_normalize_month_value($selectedMonth);
    if ($normalizedMonth === null) {
        throw new RuntimeException('Invalid month_value');
    }

    $currentMonth = gmdate('Y-m');
    $monthsToEnsure = accumul8_month_range($currentMonth, $normalizedMonth);
    if ($monthsToEnsure === []) {
        $monthsToEnsure = [$normalizedMonth];
    }
    if (strcmp($normalizedMonth, $currentMonth) < 0) {
        $monthsToEnsure = [$normalizedMonth];
    }

    $dueRows = Database::queryAll(
        'SELECT id, ' . accumul8_optional_select('accumul8_recurring_payments', 'entity_id', 'entity_id', 'NULL AS entity_id') . ', contact_id, account_id, title, direction, amount, frequency, interval_count, next_due_date, paid_date, notes, is_budget_planner, ' . accumul8_optional_select('accumul8_recurring_payments', 'payment_method', 'payment_method', "'unspecified' AS payment_method") . '
         FROM accumul8_recurring_payments
         WHERE owner_user_id = ?
           AND is_active = 1
           AND is_budget_planner = 1
         ORDER BY id ASC',
        [$viewerId]
    );

    $created = 0;
    foreach ($dueRows as $row) {
        $rpId = (int)($row['id'] ?? 0);
        if ($rpId <= 0) {
            continue;
        }

        $entityId = isset($row['entity_id']) ? (int)$row['entity_id'] : 0;
        if ($entityId <= 0) {
            $entityId = (int)(accumul8_recurring_entity_id_or_create($viewerId, $row) ?? 0);
        }
        if ($entityId > 0 && accumul8_table_has_column('accumul8_recurring_payments', 'entity_id')) {
            Database::execute(
                'UPDATE accumul8_recurring_payments SET entity_id = ? WHERE id = ? AND owner_user_id = ?',
                [$entityId, $rpId, $viewerId]
            );
        }

        foreach ($monthsToEnsure as $monthValue) {
            foreach (accumul8_recurring_occurrences_for_month($row, $monthValue) as $occurrenceDate) {
                $existing = Database::queryOne(
                    'SELECT id
                     FROM accumul8_transactions
                     WHERE owner_user_id = ?
                       AND recurring_payment_id = ?
                       AND due_date = ?
                     LIMIT 1',
                    [$viewerId, $rpId, $occurrenceDate]
                );
                if ($existing) {
                    continue;
                }

                $direction = (string)($row['direction'] ?? 'outflow');
                $baseAmount = (float)($row['amount'] ?? 0);
                $amount = $direction === 'inflow' ? abs($baseAmount) : -abs($baseAmount);
                $paidDate = accumul8_normalize_date($row['paid_date'] ?? null);
                $isPaid = $paidDate === $occurrenceDate ? 1 : 0;

                Database::execute(
                    'INSERT INTO accumul8_transactions
                        (owner_user_id, account_id, entity_id, contact_id, transaction_date, due_date, entry_type, description, memo, amount, rta_amount,
                         is_paid, is_reconciled, is_budget_planner, is_recurring_instance, recurring_payment_id, source_kind, paid_date, created_by_user_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, 0, 1, 1, ?, ?, ?, ?)',
                    [
                        $viewerId,
                        isset($row['account_id']) ? (int)$row['account_id'] : null,
                        $entityId > 0 ? $entityId : null,
                        isset($row['contact_id']) ? (int)$row['contact_id'] : null,
                        $occurrenceDate,
                        $occurrenceDate,
                        $direction === 'inflow' ? 'deposit' : 'bill',
                        (string)($row['title'] ?? 'Recurring Payment'),
                        ($row['notes'] ?? '') === '' ? null : (string)$row['notes'],
                        $amount,
                        $isPaid,
                        $rpId,
                        'recurring',
                        $isPaid === 1 ? $occurrenceDate : null,
                        $actorUserId,
                    ]
                );
                $created++;
            }
        }
    }

    if ($created > 0) {
        accumul8_recompute_running_balance($viewerId);
    }

    return $created;
}

function accumul8_materialize_due_recurring_for_owner(int $viewerId, int $actorUserId, ?string $today = null): int
{
    $effectiveToday = $today ?: date('Y-m-d');
    $dueRows = Database::queryAll(
        'SELECT id, ' . accumul8_optional_select('accumul8_recurring_payments', 'entity_id', 'entity_id', 'NULL AS entity_id') . ', contact_id, account_id, title, direction, amount, frequency, interval_count, next_due_date, is_budget_planner, ' . accumul8_optional_select('accumul8_recurring_payments', 'payment_method', 'payment_method', "'unspecified' AS payment_method") . '
         FROM accumul8_recurring_payments
         WHERE owner_user_id = ?
           AND is_active = 1
           AND next_due_date <= ?
         ORDER BY next_due_date ASC, id ASC',
        [$viewerId, $effectiveToday]
    );

    $created = 0;
    foreach ($dueRows as $row) {
        $rpId = (int)($row['id'] ?? 0);
        $nextDue = (string)($row['next_due_date'] ?? $effectiveToday);
        $description = (string)($row['title'] ?? 'Recurring Payment');
        $direction = (string)($row['direction'] ?? 'outflow');
        $baseAmount = (float)($row['amount'] ?? 0);
        $amount = $direction === 'outflow' ? -abs($baseAmount) : abs($baseAmount);
        $frequency = (string)($row['frequency'] ?? 'monthly');
        $paymentMethod = (string)($row['payment_method'] ?? 'unspecified');
        $intervalCount = (int)($row['interval_count'] ?? 1);
        $isBudgetPlanner = (int)($row['is_budget_planner'] ?? 1) === 1 ? 1 : 0;
        $entityId = isset($row['entity_id']) ? (int)$row['entity_id'] : 0;
        if ($entityId <= 0) {
            $entityId = (int)(accumul8_recurring_entity_id_or_create($viewerId, $row) ?? 0);
        }
        if ($entityId > 0 && accumul8_table_has_column('accumul8_recurring_payments', 'entity_id')) {
            Database::execute(
                'UPDATE accumul8_recurring_payments SET entity_id = ? WHERE id = ? AND owner_user_id = ?',
                [$entityId, $rpId, $viewerId]
            );
        }

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
                    (owner_user_id, account_id, entity_id, contact_id, transaction_date, due_date, entry_type, description, amount, rta_amount,
                     is_paid, is_reconciled, is_budget_planner, is_recurring_instance, recurring_payment_id, source_kind, paid_date, created_by_user_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, 0, 0, ?, 1, ?, ?, ?, ?)',
                [
                    $viewerId,
                    isset($row['account_id']) ? (int)$row['account_id'] : null,
                    $entityId > 0 ? $entityId : null,
                    isset($row['contact_id']) ? (int)$row['contact_id'] : null,
                    $nextDue,
                    $nextDue,
                    'bill',
                    $description,
                    $amount,
                    $isBudgetPlanner,
                    $rpId,
                    'recurring',
                    $paymentMethod === 'autopay' ? $nextDue : null,
                    $actorUserId,
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

    if ($created > 0) {
        accumul8_recompute_running_balance($viewerId);
    }

    return $created;
}

function accumul8_shift_date_by_days(?string $dateValue, int $dayDelta): ?string
{
    $normalized = accumul8_normalize_date($dateValue);
    if ($normalized === null || $dayDelta === 0) {
        return $normalized;
    }

    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $normalized, new DateTimeZone('UTC'));
    if (!$date) {
        return $normalized;
    }

    $modifier = ($dayDelta >= 0 ? '+' : '') . $dayDelta . ' day';
    return $date->modify($modifier)->format('Y-m-d');
}

function accumul8_date_delta_days(?string $fromDate, ?string $toDate): int
{
    $from = accumul8_normalize_date($fromDate);
    $to = accumul8_normalize_date($toDate);
    if ($from === null || $to === null) {
        return 0;
    }

    $fromDateTime = DateTimeImmutable::createFromFormat('!Y-m-d', $from, new DateTimeZone('UTC'));
    $toDateTime = DateTimeImmutable::createFromFormat('!Y-m-d', $to, new DateTimeZone('UTC'));
    if (!$fromDateTime || !$toDateTime) {
        return 0;
    }

    return (int)$fromDateTime->diff($toDateTime)->format('%r%a');
}

function accumul8_sync_open_recurring_transactions_from_template(int $viewerId, int $recurringId, array $existingRecurring, array $template): int
{
    if ($recurringId <= 0) {
        return 0;
    }

    $oldNextDue = accumul8_normalize_date($existingRecurring['next_due_date'] ?? null);
    $newNextDue = accumul8_normalize_date($template['next_due_date'] ?? null);
    $dayDelta = accumul8_date_delta_days($oldNextDue, $newNextDue);
    $paidDate = accumul8_normalize_date($template['paid_date'] ?? null);
    $oldPaidDate = accumul8_normalize_date($existingRecurring['paid_date'] ?? null);
    $signedAmount = (($template['direction'] ?? 'outflow') === 'inflow')
        ? abs((float)($template['amount'] ?? 0))
        : -abs((float)($template['amount'] ?? 0));

    $linkedRows = Database::queryAll(
        'SELECT id,
                transaction_date,
                due_date,
                paid_date,
                is_paid
         FROM accumul8_transactions
         WHERE owner_user_id = ?
           AND recurring_payment_id = ?
           AND COALESCE(source_kind, "") = "recurring"
           AND (
                is_paid = 0
                OR COALESCE(paid_date, "") = ?
                OR (? <> "" AND COALESCE(paid_date, "") = ?)
           )',
        [$viewerId, $recurringId, $oldPaidDate ?? '', $paidDate ?? '', $paidDate ?? '']
    );

    foreach ($linkedRows as $row) {
        $dueDate = accumul8_normalize_date($row['due_date'] ?? null) ?? accumul8_normalize_date($row['transaction_date'] ?? null);
        $nextDueDate = accumul8_shift_date_by_days($dueDate, $dayDelta);
        $nextTransactionDate = accumul8_shift_date_by_days(accumul8_normalize_date($row['transaction_date'] ?? null) ?? $dueDate, $dayDelta);
        Database::execute(
            'UPDATE accumul8_transactions
             SET account_id = ?,
                 entity_id = ?,
                 contact_id = ?,
                 transaction_date = ?,
                 due_date = ?,
                 description = ?,
                 memo = ?,
                 amount = ?,
                 is_paid = ?,
                 is_budget_planner = ?,
                 paid_date = ?
             WHERE id = ?
               AND owner_user_id = ?',
            [
                $template['account_id'] ?? null,
                $template['entity_id'] ?? null,
                $template['contact_id'] ?? null,
                $nextTransactionDate,
                $nextDueDate,
                (string)($template['title'] ?? 'Recurring Payment'),
                ($template['notes'] ?? '') === '' ? null : (string)$template['notes'],
                $signedAmount,
                $paidDate !== null ? 1 : 0,
                (int)($template['is_budget_planner'] ?? 0) === 1 ? 1 : 0,
                $paidDate,
                (int)($row['id'] ?? 0),
                $viewerId,
            ]
        );
    }

    return count($linkedRows);
}

function accumul8_sync_recurring_template_from_transaction(int $viewerId, array $existingTx, array $updatedTx): void
{
    $sourceKind = accumul8_transaction_source_kind($existingTx['source_kind'] ?? $updatedTx['source_kind'] ?? '');
    $recurringPaymentId = (int)($existingTx['recurring_payment_id'] ?? $updatedTx['recurring_payment_id'] ?? 0);
    if ($sourceKind !== 'recurring' || $recurringPaymentId <= 0) {
        return;
    }

    $recurring = Database::queryOne(
        'SELECT id,
                entity_id,
                contact_id,
                account_id,
                title,
                direction,
                amount,
                next_due_date,
                paid_date,
                notes,
                is_budget_planner
         FROM accumul8_recurring_payments
         WHERE id = ?
           AND owner_user_id = ?
         LIMIT 1',
        [$recurringPaymentId, $viewerId]
    );
    if (!$recurring) {
        return;
    }

    $amount = (float)($updatedTx['amount'] ?? 0);
    $direction = $amount > 0 ? 'inflow' : 'outflow';
    if (abs($amount) < 0.01) {
        $direction = accumul8_validate_enum('direction', $recurring['direction'] ?? 'outflow', ['outflow', 'inflow'], 'outflow');
    }

    $oldDueDate = accumul8_normalize_date($existingTx['due_date'] ?? null) ?? accumul8_normalize_date($existingTx['transaction_date'] ?? null);
    $newDueDate = accumul8_normalize_date($updatedTx['due_date'] ?? null) ?? accumul8_normalize_date($updatedTx['transaction_date'] ?? null);
    $nextDueDate = accumul8_shift_date_by_days(
        accumul8_normalize_date($recurring['next_due_date'] ?? null) ?? $newDueDate,
        accumul8_date_delta_days($oldDueDate, $newDueDate)
    );
    $paidDate = (int)($updatedTx['is_paid'] ?? 0) === 1
        ? (accumul8_normalize_date($updatedTx['paid_date'] ?? null) ?? $newDueDate)
        : null;

    Database::execute(
        'UPDATE accumul8_recurring_payments
         SET entity_id = ?,
             contact_id = ?,
             account_id = ?,
             title = ?,
             direction = ?,
             amount = ?,
             next_due_date = ?,
             paid_date = ?,
             notes = ?,
             is_budget_planner = ?
         WHERE id = ?
           AND owner_user_id = ?',
        [
            $updatedTx['entity_id'] ?? null,
            $updatedTx['contact_id'] ?? null,
            $updatedTx['account_id'] ?? null,
            accumul8_normalize_text($updatedTx['description'] ?? $recurring['title'] ?? '', 191),
            $direction,
            abs($amount),
            $nextDueDate,
            $paidDate,
            accumul8_normalize_text($updatedTx['memo'] ?? $recurring['notes'] ?? '', 1500) ?: null,
            (int)($updatedTx['is_budget_planner'] ?? 0) === 1 ? 1 : 0,
            $recurringPaymentId,
            $viewerId,
        ]
    );
}

function accumul8_backfill_entities_for_owner(int $viewerId): array
{
    $stats = [
        'contacts_processed' => 0,
        'debtors_processed' => 0,
        'recurring_linked' => 0,
        'transactions_linked' => 0,
        'balance_transactions_linked' => 0,
    ];

    if (accumul8_table_has_column('accumul8_contacts', 'entity_id')) {
        $contactRows = Database::queryAll(
            'SELECT id
             FROM accumul8_contacts
             WHERE owner_user_id = ?
             ORDER BY id ASC',
            [$viewerId]
        );
        foreach ($contactRows as $row) {
            $contactId = (int)($row['id'] ?? 0);
            if ($contactId > 0 && accumul8_contact_entity_id_or_create($viewerId, $contactId) !== null) {
                $stats['contacts_processed']++;
            }
        }
    }

    if (accumul8_has_debtor_support() && accumul8_table_has_column('accumul8_debtors', 'entity_id')) {
        $debtorRows = Database::queryAll(
            'SELECT id
             FROM accumul8_debtors
             WHERE owner_user_id = ?
             ORDER BY id ASC',
            [$viewerId]
        );
        foreach ($debtorRows as $row) {
            $debtorId = (int)($row['id'] ?? 0);
            if ($debtorId > 0 && accumul8_debtor_entity_id_or_create($viewerId, $debtorId) !== null) {
                $stats['debtors_processed']++;
            }
        }
    }

    if (accumul8_table_has_column('accumul8_recurring_payments', 'entity_id')) {
        $recurringRows = Database::queryAll(
            'SELECT id, contact_id, title, direction, amount, notes, is_active
             FROM accumul8_recurring_payments
             WHERE owner_user_id = ?
             ORDER BY id ASC',
            [$viewerId]
        );
        foreach ($recurringRows as $row) {
            $recurringId = (int)($row['id'] ?? 0);
            if ($recurringId <= 0) {
                continue;
            }
            $entityId = accumul8_recurring_entity_id_or_create($viewerId, $row);
            if ($entityId === null || $entityId <= 0) {
                continue;
            }
            $updated = Database::execute(
                'UPDATE accumul8_recurring_payments
                 SET entity_id = ?
                 WHERE id = ? AND owner_user_id = ? AND (entity_id IS NULL OR entity_id <> ?)',
                [$entityId, $recurringId, $viewerId, $entityId]
            );
            if ($updated > 0) {
                $stats['recurring_linked']++;
            }
        }
    }

    if (accumul8_table_has_column('accumul8_transactions', 'entity_id')) {
        $transactionRows = Database::queryAll(
            'SELECT id, contact_id, description, amount, memo
             FROM accumul8_transactions
             WHERE owner_user_id = ?
             ORDER BY id ASC',
            [$viewerId]
        );
        foreach ($transactionRows as $row) {
            $transactionId = (int)($row['id'] ?? 0);
            if ($transactionId <= 0) {
                continue;
            }
            $entityId = accumul8_transaction_entity_id_or_create($viewerId, $row);
            if ($entityId === null || $entityId <= 0) {
                continue;
            }
            $updated = Database::execute(
                'UPDATE accumul8_transactions
                 SET entity_id = ?
                 WHERE id = ? AND owner_user_id = ? AND (entity_id IS NULL OR entity_id <> ?)',
                [$entityId, $transactionId, $viewerId, $entityId]
            );
            if ($updated > 0) {
                $stats['transactions_linked']++;
            }
        }
    }

    if (accumul8_has_debtor_support() && accumul8_table_has_column('accumul8_transactions', 'balance_entity_id')) {
        $row = Database::queryOne(
            'SELECT COUNT(*) AS total
             FROM accumul8_transactions t
             INNER JOIN accumul8_debtors d
                ON d.id = t.debtor_id
               AND d.owner_user_id = t.owner_user_id
             WHERE t.owner_user_id = ?
               AND d.entity_id IS NOT NULL
               AND (t.balance_entity_id IS NULL OR t.balance_entity_id <> d.entity_id)',
            [$viewerId]
        );
        $stats['balance_transactions_linked'] = (int)($row['total'] ?? 0);
        Database::execute(
            'UPDATE accumul8_transactions t
             INNER JOIN accumul8_debtors d
                ON d.id = t.debtor_id
               AND d.owner_user_id = t.owner_user_id
             SET t.balance_entity_id = d.entity_id
             WHERE t.owner_user_id = ?
               AND d.entity_id IS NOT NULL
               AND (t.balance_entity_id IS NULL OR t.balance_entity_id <> d.entity_id)',
            [$viewerId]
        );
    }

    return $stats;
}

function accumul8_teller_env(): string
{
    $env = strtolower(accumul8_normalize_text((string)(secret_get(catn8_secret_key('accumul8.teller.env')) ?? getenv('TELLER_ENV') ?? 'sandbox'), 16));
    if (!in_array($env, ['sandbox', 'development', 'production'], true)) {
        $env = 'sandbox';
    }
    return $env;
}

function accumul8_teller_credentials(): array
{
    $applicationId = (string)(secret_get(catn8_secret_key('accumul8.teller.application_id')) ?? getenv('TELLER_APPLICATION_ID') ?? '');
    $certificate = (string)(secret_get(catn8_secret_key('accumul8.teller.certificate')) ?? getenv('TELLER_CERTIFICATE_PEM') ?? '');
    $privateKey = (string)(secret_get(catn8_secret_key('accumul8.teller.private_key')) ?? getenv('TELLER_PRIVATE_KEY_PEM') ?? '');
    return [
        'application_id' => trim($applicationId),
        'certificate' => str_replace(["\r\n", "\r"], "\n", trim($certificate)),
        'private_key' => str_replace(["\r\n", "\r"], "\n", trim($privateKey)),
        'env' => accumul8_teller_env(),
    ];
}

function accumul8_teller_is_configured(): bool
{
    $c = accumul8_teller_credentials();
    return ($c['application_id'] ?? '') !== ''
        && ($c['certificate'] ?? '') !== ''
        && ($c['private_key'] ?? '') !== '';
}

function accumul8_teller_request(string $method, string $path, ?string $accessToken = null, ?array $query = null, $body = null)
{
    $creds = accumul8_teller_credentials();
    if (($creds['application_id'] ?? '') === '') {
        throw new RuntimeException('Teller application id is not configured. Set accumul8.teller.application_id.');
    }
    if (($creds['certificate'] ?? '') === '' || ($creds['private_key'] ?? '') === '') {
        throw new RuntimeException('Teller certificate and private key are not configured.');
    }

    $url = 'https://api.teller.io/' . ltrim($path, '/');
    if (is_array($query) && $query) {
        $query = array_filter($query, static fn($value): bool => $value !== null && $value !== '');
        if ($query) {
            $url .= '?' . http_build_query($query);
        }
    }

    $certFile = tempnam(sys_get_temp_dir(), 'catn8_teller_cert_');
    $keyFile = tempnam(sys_get_temp_dir(), 'catn8_teller_key_');
    if ($certFile === false || $keyFile === false) {
        throw new RuntimeException('Failed to create temporary files for Teller request');
    }

    try {
        file_put_contents($certFile, (string)$creds['certificate']);
        file_put_contents($keyFile, (string)$creds['private_key']);

        $payload = null;
        if ($body !== null) {
            $payload = json_encode($body, JSON_UNESCAPED_SLASHES);
            if (!is_string($payload)) {
                throw new RuntimeException('Failed to encode Teller request JSON payload');
            }
        }

        $maxAttempts = 5;
        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            $ch = curl_init();
            if ($ch === false) {
                throw new RuntimeException('Failed to init curl');
            }

            $headers = ['Accept: application/json'];
            if ($payload !== null) {
                $headers[] = 'Content-Type: application/json';
            }

            $responseHeaders = [];
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, strtoupper(trim($method)));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
            curl_setopt($ch, CURLOPT_TIMEOUT, 45);
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
            curl_setopt($ch, CURLOPT_USERPWD, ($accessToken !== null ? $accessToken : '') . ':');
            curl_setopt($ch, CURLOPT_SSLCERT, $certFile);
            curl_setopt($ch, CURLOPT_SSLKEY, $keyFile);
            curl_setopt($ch, CURLOPT_HEADERFUNCTION, static function ($curl, string $headerLine) use (&$responseHeaders): int {
                $length = strlen($headerLine);
                $parts = explode(':', $headerLine, 2);
                if (count($parts) === 2) {
                    $responseHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
                }
                return $length;
            });
            if ($payload !== null) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
            }

            $raw = curl_exec($ch);
            $err = curl_error($ch);
            $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if (!is_string($raw)) {
                if ($attempt < $maxAttempts) {
                    usleep(250000 * $attempt);
                    continue;
                }
                throw new RuntimeException('Teller request failed: ' . ($err !== '' ? $err : 'unknown error'));
            }

            $decoded = json_decode($raw, true);
            if ($status >= 200 && $status < 300) {
                if (!is_array($decoded)) {
                    throw new RuntimeException('Teller returned non-JSON response');
                }
                return $decoded;
            }

            if (in_array($status, [408, 429, 500, 502, 503, 504], true) && $attempt < $maxAttempts) {
                $retryAfterSeconds = (int)($responseHeaders['retry-after'] ?? 0);
                if ($retryAfterSeconds <= 0) {
                    $retryAfterSeconds = min(10, $attempt * 2);
                }
                usleep($retryAfterSeconds * 1000000);
                continue;
            }

            $errorValue = is_array($decoded)
                ? ($decoded['error'] ?? $decoded['message'] ?? $decoded['detail'] ?? null)
                : null;
            if (is_array($errorValue)) {
                $errorText = json_encode($errorValue, JSON_UNESCAPED_SLASHES);
            } elseif (is_scalar($errorValue)) {
                $errorText = (string)$errorValue;
            } else {
                $errorText = 'Teller request failed';
            }
            throw new RuntimeException($errorText . ' (HTTP ' . $status . ')');
        }

        throw new RuntimeException('Teller request failed after retries');
    } finally {
        @unlink($certFile);
        @unlink($keyFile);
    }
}

function accumul8_shift_date(string $date, int $days): string
{
    $timestamp = strtotime($date . ' UTC');
    if ($timestamp === false) {
        $timestamp = strtotime($date);
    }
    if ($timestamp === false) {
        $timestamp = time();
    }

    return gmdate('Y-m-d', strtotime(($days >= 0 ? '+' : '') . $days . ' day', $timestamp));
}

function accumul8_teller_account_supports_link(array $account, string $linkKey): bool
{
    $links = $account['links'] ?? null;
    if (!is_array($links)) {
        return true;
    }

    $value = $links[$linkKey] ?? null;
    if (is_string($value)) {
        return trim($value) !== '';
    }
    if (is_array($value)) {
        return $value !== [];
    }

    return (bool)$value;
}

function accumul8_teller_backfill_pages_per_sync(): int
{
    $raw = getenv('ACCUMUL8_TELLER_BACKFILL_PAGES_PER_SYNC');
    if (!is_string($raw) || trim($raw) === '') {
        return 10;
    }

    return max(1, min(100, (int)$raw));
}

function accumul8_teller_list_transactions(string $accessToken, string $remoteAccountId, array $baseQuery = [], int $pageSize = 500, int $maxPages = 100): array
{
    $all = [];
    $seenIds = [];
    $cursor = accumul8_normalize_text((string)($baseQuery['from_id'] ?? ''), 191);
    unset($baseQuery['from_id']);
    $pageSize = max(1, min(500, $pageSize));
    $maxPages = max(1, min(100, $maxPages));
    $newestId = '';
    $oldestId = '';
    $hasMore = false;
    $pagesFetched = 0;

    for ($page = 0; $page < $maxPages; $page++) {
        $query = $baseQuery;
        $query['count'] = $pageSize;
        if ($cursor !== null && $cursor !== '') {
            $query['from_id'] = $cursor;
        }

        $pageTransactions = accumul8_teller_request(
            'GET',
            '/accounts/' . rawurlencode($remoteAccountId) . '/transactions',
            $accessToken,
            $query
        );
        if (!is_array($pageTransactions) || $pageTransactions === []) {
            break;
        }

        $pagesFetched++;
        $lastIdOnPage = null;
        $pageAdded = 0;
        foreach ($pageTransactions as $tx) {
            if (!is_array($tx)) {
                continue;
            }
            $txId = accumul8_normalize_text((string)($tx['id'] ?? ''), 191);
            if ($txId === '') {
                continue;
            }
            if (isset($seenIds[$txId])) {
                continue;
            }
            $seenIds[$txId] = true;
            if ($newestId === '') {
                $newestId = $txId;
            }
            $oldestId = $txId;
            $all[] = $tx;
            $lastIdOnPage = $txId;
            $pageAdded++;
        }

        if ($pageAdded <= 0 || count($pageTransactions) < $pageSize || $lastIdOnPage === null) {
            break;
        }

        $cursor = $lastIdOnPage;
        $hasMore = true;
    }

    return [
        'transactions' => $all,
        'newest_id' => $newestId,
        'oldest_id' => $oldestId,
        'has_more' => $hasMore,
        'pages_fetched' => $pagesFetched,
    ];
}

function accumul8_delete_transactions_by_ids(int $viewerId, array $transactionIds): int
{
    $ids = array_values(array_unique(array_map(static fn($value): int => (int)$value, $transactionIds)));
    $ids = array_values(array_filter($ids, static fn(int $value): bool => $value > 0));
    if ($ids === []) {
        return 0;
    }

    $deleted = 0;
    foreach (array_chunk($ids, 500) as $chunk) {
        $placeholders = implode(',', array_fill(0, count($chunk), '?'));
        Database::execute(
            'DELETE FROM accumul8_transactions
             WHERE owner_user_id = ?
               AND id IN (' . $placeholders . ')',
            array_merge([$viewerId], $chunk)
        );
        $deleted += count($chunk);
    }

    return $deleted;
}

function accumul8_import_cleanup_description_key(string $value): string
{
    $normalized = strtolower(trim($value));
    $normalized = preg_replace('/[^a-z0-9]+/', ' ', $normalized);
    return trim((string)$normalized);
}

function accumul8_refresh_statement_upload_import_counts(int $viewerId, array $uploadIds): void
{
    $ids = array_values(array_unique(array_map(static fn($value): int => (int)$value, $uploadIds)));
    $ids = array_values(array_filter($ids, static fn(int $value): bool => $value > 0));
    foreach ($ids as $uploadId) {
        $row = Database::queryOne(
            'SELECT
                SUM(CASE WHEN source_kind IN (?, ?) AND source_ref = ? THEN 1 ELSE 0 END) AS imported_count
             FROM accumul8_transactions
             WHERE owner_user_id = ?',
            ['statement_upload', 'statement_pdf', 'statement_upload:' . $uploadId, $viewerId]
        );
        Database::execute(
            'UPDATE accumul8_statement_uploads
             SET imported_transaction_count = ?, updated_at = NOW()
             WHERE id = ? AND owner_user_id = ?',
            [(int)($row['imported_count'] ?? 0), $uploadId, $viewerId]
        );
    }
}

function accumul8_audit_imported_transaction_cleanup(int $viewerId, ?string $startDate = null, ?string $endDate = null, int $limit = 500): array
{
    $limit = max(1, min(2000, $limit));
    $where = [
        't.owner_user_id = ?',
        "t.source_kind IN ('statement_upload', 'statement_pdf')",
    ];
    $params = [$viewerId];
    if ($startDate !== null && $startDate !== '') {
        $where[] = 't.transaction_date >= ?';
        $params[] = $startDate;
    }
    if ($endDate !== null && $endDate !== '') {
        $where[] = 't.transaction_date <= ?';
        $params[] = $endDate;
    }

    $rows = Database::queryAll(
        'SELECT
            t.id,
            t.account_id,
            t.transaction_date,
            t.description,
            t.amount,
            t.source_kind,
            t.source_ref,
            a.account_name,
            ag.group_name AS banking_organization_name,
            a.bank_connection_id,
            a.provider_name,
            a.teller_account_id
         FROM accumul8_transactions t
         LEFT JOIN accumul8_accounts a
           ON a.id = t.account_id
          AND a.owner_user_id = t.owner_user_id
         LEFT JOIN accumul8_account_groups ag
           ON ag.id = a.account_group_id
          AND ag.owner_user_id = t.owner_user_id
         WHERE ' . implode(' AND ', $where) . '
         ORDER BY t.transaction_date DESC, t.id DESC
         LIMIT ' . $limit,
        $params
    );

    if ($rows === []) {
        return [
            'generated_at' => gmdate('c'),
            'total_candidates' => 0,
            'safe_candidate_count' => 0,
            'summary_text' => 'No imported statement transactions need cleanup review.',
            'category_counts' => [],
            'candidates' => [],
        ];
    }

    $accountIds = [];
    foreach ($rows as $row) {
        $accountId = (int)($row['account_id'] ?? 0);
        if ($accountId > 0) {
            $accountIds[$accountId] = true;
        }
    }

    $tellerCoverageByAccount = [];
    $tellerMatchesByAccount = [];
    if ($accountIds !== []) {
        $placeholders = implode(',', array_fill(0, count($accountIds), '?'));
        $accountParams = array_merge([$viewerId], array_keys($accountIds));
        $coverageRows = Database::queryAll(
            'SELECT account_id, MIN(transaction_date) AS min_date, MAX(transaction_date) AS max_date
             FROM accumul8_transactions
             WHERE owner_user_id = ?
               AND source_kind = ?
               AND account_id IN (' . $placeholders . ')
             GROUP BY account_id',
            array_merge([$viewerId, 'teller'], array_keys($accountIds))
        );
        foreach ($coverageRows as $row) {
            $tellerCoverageByAccount[(int)($row['account_id'] ?? 0)] = [
                'min_date' => (string)($row['min_date'] ?? ''),
                'max_date' => (string)($row['max_date'] ?? ''),
            ];
        }

        $tellerRows = Database::queryAll(
            'SELECT id, account_id, transaction_date, description, amount
             FROM accumul8_transactions
             WHERE owner_user_id = ?
               AND source_kind = ?
               AND account_id IN (' . $placeholders . ')',
            array_merge([$viewerId, 'teller'], array_keys($accountIds))
        );
        foreach ($tellerRows as $row) {
            $accountId = (int)($row['account_id'] ?? 0);
            if ($accountId <= 0) {
                continue;
            }
            if (!isset($tellerMatchesByAccount[$accountId])) {
                $tellerMatchesByAccount[$accountId] = [];
            }
            $signature = implode('|', [
                (string)($row['transaction_date'] ?? ''),
                number_format((float)($row['amount'] ?? 0), 2, '.', ''),
                accumul8_import_cleanup_description_key((string)($row['description'] ?? '')),
            ]);
            $tellerMatchesByAccount[$accountId][$signature] = (int)($row['id'] ?? 0);
        }
    }

    $categoryMeta = [
        'orphaned_account' => ['label' => 'Missing Account', 'safe' => 0],
        'unsynced_account' => ['label' => 'Unsynced Account', 'safe' => 0],
        'teller_history_missing' => ['label' => 'No Teller History Yet', 'safe' => 0],
        'outside_teller_history' => ['label' => 'Outside Teller History', 'safe' => 0],
        'duplicate_of_teller' => ['label' => 'Duplicate Of Teller', 'safe' => 1],
        'no_matching_teller_transaction' => ['label' => 'No Teller Match In Covered Range', 'safe' => 1],
    ];

    $categoryCounts = [];
    $safeCandidateCount = 0;
    $candidates = [];
    foreach ($rows as $row) {
        $accountId = isset($row['account_id']) ? (int)$row['account_id'] : null;
        $accountCoverage = $accountId !== null && $accountId > 0 ? ($tellerCoverageByAccount[$accountId] ?? null) : null;
        $historyStart = (string)($accountCoverage['min_date'] ?? '');
        $historyEnd = (string)($accountCoverage['max_date'] ?? '');
        $signature = implode('|', [
            (string)($row['transaction_date'] ?? ''),
            number_format((float)($row['amount'] ?? 0), 2, '.', ''),
            accumul8_import_cleanup_description_key((string)($row['description'] ?? '')),
        ]);
        $matchedTellerTransactionId = ($accountId !== null && $accountId > 0)
            ? (int)($tellerMatchesByAccount[$accountId][$signature] ?? 0)
            : 0;

        if ($accountId === null || $accountId <= 0 || trim((string)($row['account_name'] ?? '')) === '') {
            $category = 'orphaned_account';
            $reason = 'The imported transaction points to an account record that no longer exists locally.';
        } elseif ((int)($row['bank_connection_id'] ?? 0) <= 0 || (string)($row['provider_name'] ?? '') !== 'teller' || trim((string)($row['teller_account_id'] ?? '')) === '') {
            $category = 'unsynced_account';
            $reason = 'This imported transaction belongs to an account that is not currently mapped to a Teller feed.';
        } elseif ($historyStart === '' || $historyEnd === '') {
            $category = 'teller_history_missing';
            $reason = 'This account is Teller-mapped, but no Teller transactions have been synced into the ledger for it yet.';
        } elseif ((string)($row['transaction_date'] ?? '') < $historyStart || (string)($row['transaction_date'] ?? '') > $historyEnd) {
            $category = 'outside_teller_history';
            $reason = 'This imported transaction is outside the history window currently returned by Teller for the mapped account.';
        } elseif ($matchedTellerTransactionId > 0) {
            $category = 'duplicate_of_teller';
            $reason = 'A Teller transaction already matches this imported row on account, date, amount, and normalized description.';
        } else {
            $category = 'no_matching_teller_transaction';
            $reason = 'This imported transaction falls inside Teller coverage for the account, but no matching Teller transaction exists.';
        }

        $meta = $categoryMeta[$category] ?? ['label' => 'Cleanup Candidate', 'safe' => 0];
        if (!isset($categoryCounts[$category])) {
            $categoryCounts[$category] = [
                'category' => $category,
                'category_label' => $meta['label'],
                'count' => 0,
                'safe_to_purge' => (int)$meta['safe'],
            ];
        }
        $categoryCounts[$category]['count']++;
        if ((int)$meta['safe'] === 1) {
            $safeCandidateCount++;
        }

        $sourceRef = (string)($row['source_ref'] ?? '');
        $statementUploadId = accumul8_parse_statement_upload_id_from_source_ref($sourceRef);
        $candidates[] = [
            'transaction_id' => (int)($row['id'] ?? 0),
            'account_id' => $accountId,
            'account_name' => (string)($row['account_name'] ?? ''),
            'banking_organization_name' => (string)($row['banking_organization_name'] ?? ''),
            'transaction_date' => (string)($row['transaction_date'] ?? ''),
            'description' => (string)($row['description'] ?? ''),
            'amount' => round((float)($row['amount'] ?? 0), 2),
            'source_kind' => (string)($row['source_kind'] ?? ''),
            'source_ref' => $sourceRef,
            'statement_upload_id' => $statementUploadId,
            'category' => $category,
            'category_label' => $meta['label'],
            'reason' => $reason,
            'safe_to_purge' => (int)$meta['safe'],
            'teller_history_start' => $historyStart,
            'teller_history_end' => $historyEnd,
            'matched_teller_transaction_id' => $matchedTellerTransactionId > 0 ? $matchedTellerTransactionId : null,
        ];
    }

    return [
        'generated_at' => gmdate('c'),
        'total_candidates' => count($candidates),
        'safe_candidate_count' => $safeCandidateCount,
        'summary_text' => count($candidates) > 0
            ? 'Found ' . count($candidates) . ' imported transaction cleanup candidate(s); ' . $safeCandidateCount . ' are recommended for purge.'
            : 'No imported statement transactions need cleanup review.',
        'category_counts' => array_values($categoryCounts),
        'candidates' => $candidates,
    ];
}

try {
    accumul8_tables_ensure();
} catch (Throwable $e) {
    error_log('accumul8 schema ensure failed: ' . $e->getMessage());
}
if (defined('CATN8_ACCUMUL8_LIBRARY_ONLY')) {
    return;
}
$scopeOwnerUserId = accumul8_resolve_scope_owner_user_id($actorUserId);
try {
    accumul8_get_or_create_default_account($scopeOwnerUserId);
} catch (Throwable $e) {
    error_log('accumul8 default account ensure failed: ' . $e->getMessage());
}
$viewerId = $scopeOwnerUserId;
$GLOBALS['accumul8_dynamic_entity_family_definitions_provider'] = static function () use (&$viewerId): array {
    accumul8_ensure_default_entity_endex_groups((int)$viewerId);
    return accumul8_list_entity_endex_group_definitions((int)$viewerId, true);
};

$action = accumul8_normalize_text((string)($_GET['action'] ?? ''), 80);
if ($action === '') {
    $action = 'bootstrap';
}

if ($action === 'bootstrap') {
    catn8_require_method('GET');

    $warnings = [];
    accumul8_bootstrap_section('materialize_due_recurring', static fn() => accumul8_materialize_due_recurring_for_owner($viewerId, $actorUserId), 0, $warnings);
    $transactions = accumul8_bootstrap_section('transactions', static fn() => accumul8_list_transactions($viewerId, 5000), [], $warnings);
    $entities = accumul8_bootstrap_section('entities', static fn() => accumul8_list_entities($viewerId), [], $warnings);
    $entityAliases = accumul8_bootstrap_section('entity_aliases', static fn() => accumul8_list_entity_aliases($viewerId), [], $warnings);
    $contacts = accumul8_bootstrap_section('contacts', static fn() => accumul8_list_contacts($viewerId), [], $warnings);
    $recurring = accumul8_bootstrap_section('recurring_payments', static fn() => accumul8_list_recurring($viewerId), [], $warnings);
    $bankingOrganizations = accumul8_bootstrap_section('banking_organizations', static fn() => accumul8_list_banking_organizations($viewerId), [], $warnings);
    $accounts = accumul8_bootstrap_section('accounts', static fn() => accumul8_list_accounts($viewerId), [], $warnings);
    $debtors = accumul8_bootstrap_section('debtors', static fn() => accumul8_list_debtors($viewerId), [], $warnings);
    $budgetRows = accumul8_bootstrap_section('budget_rows', static fn() => accumul8_list_budget_rows($viewerId), [], $warnings);
    $rules = accumul8_bootstrap_section('notification_rules', static fn() => accumul8_list_notification_rules($viewerId), [], $warnings);
    $connections = accumul8_bootstrap_section('bank_connections', static fn() => accumul8_list_bank_connections($viewerId), [], $warnings);
    $entityEndexScanLogs = accumul8_bootstrap_section('entity_endex_scan_logs', static fn() => accumul8_list_entity_endex_scan_logs($viewerId, 12), [], $warnings);
    $payBills = accumul8_bootstrap_section('pay_bills', static fn() => accumul8_due_bills($viewerId), [], $warnings);
    $summary = accumul8_bootstrap_section('summary', static fn() => accumul8_summary($viewerId), [
        'net_amount' => 0.0,
        'inflow_total' => 0.0,
        'outflow_total' => 0.0,
        'unpaid_outflow_total' => 0.0,
    ], $warnings);
    $accessibleOwners = accumul8_bootstrap_section('accessible_account_owners', static fn() => accumul8_list_accessible_owners($actorUserId), [], $warnings);

    catn8_json_response([
        'success' => true,
        'selected_owner_user_id' => $viewerId,
        'accessible_account_owners' => $accessibleOwners,
        'entities' => $entities,
        'entity_aliases' => $entityAliases,
        'entity_endex_guides' => accumul8_list_entity_endex_guides_for_viewer($viewerId),
        'entity_endex_scan_logs' => $entityEndexScanLogs,
        'contacts' => $contacts,
        'recurring_payments' => $recurring,
        'transactions' => $transactions,
        'debtor_ledger' => array_values(array_filter($transactions, static function (array $tx): bool {
            return isset($tx['debtor_id']) && (int)$tx['debtor_id'] > 0;
        })),
        'banking_organizations' => $bankingOrganizations,
        'accounts' => $accounts,
        'debtors' => $debtors,
        'budget_rows' => $budgetRows,
        'notification_rules' => $rules,
        'pay_bills' => $payBills,
        'bank_connections' => $connections,
        'sync_provider' => [
            'provider' => 'teller',
            'env' => accumul8_teller_env(),
            'configured' => accumul8_teller_is_configured() ? 1 : 0,
        ],
        'summary' => $summary,
        'warnings' => $warnings,
    ]);
}

if ($action === 'list_statement_workspace') {
    catn8_require_method('GET');
    catn8_json_response([
        'success' => true,
        'statement_uploads' => accumul8_list_statement_uploads($viewerId, false),
        'archived_statement_uploads' => accumul8_list_statement_uploads($viewerId, true),
        'statement_audit_runs' => accumul8_list_statement_audit_runs($viewerId, 10),
    ]);
}

if ($action === 'list_aicountant_conversations') {
    catn8_require_method('GET');
    catn8_json_response([
        'success' => true,
        'conversations' => accumul8_aicountant_list_conversations($viewerId),
        'default_system_prompt' => accumul8_aicountant_default_system_prompt(),
        'suggested_starters' => accumul8_aicountant_suggested_starters(),
    ]);
}

if ($action === 'get_aicountant_conversation') {
    catn8_require_method('GET');
    $conversationId = (int)($_GET['id'] ?? 0);
    if ($conversationId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    $conversation = accumul8_aicountant_map_conversation_row(accumul8_aicountant_require_conversation($viewerId, $conversationId));
    catn8_json_response([
        'success' => true,
        'conversation' => $conversation,
        'messages' => accumul8_aicountant_list_messages($viewerId, $conversationId),
    ]);
}

if ($action === 'create_aicountant_conversation') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $title = accumul8_aicountant_normalize_title($body['title'] ?? '', 191);
    $systemPrompt = trim((string)($body['system_prompt'] ?? ''));
    $conversationId = accumul8_aicountant_create_conversation($viewerId, $title, $systemPrompt);
    $conversation = accumul8_aicountant_map_conversation_row(accumul8_aicountant_require_conversation($viewerId, $conversationId));
    catn8_json_response([
        'success' => true,
        'conversation' => $conversation,
        'messages' => [],
    ]);
}

if ($action === 'rename_aicountant_conversation') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $conversationId = (int)($body['id'] ?? 0);
    $title = accumul8_aicountant_normalize_title($body['title'] ?? '', 191);
    if ($conversationId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    if ($title === '') {
        catn8_json_response(['success' => false, 'error' => 'Title is required'], 400);
    }
    accumul8_aicountant_require_conversation($viewerId, $conversationId);
    Database::execute(
        "UPDATE accumul8_ai_conversations
         SET title = ?, updated_at = NOW()
         WHERE id = ? AND owner_user_id = ?",
        [$title, $conversationId, $viewerId]
    );
    $conversation = accumul8_aicountant_map_conversation_row(accumul8_aicountant_require_conversation($viewerId, $conversationId));
    catn8_json_response([
        'success' => true,
        'conversation' => $conversation,
        'messages' => accumul8_aicountant_list_messages($viewerId, $conversationId),
    ]);
}

if ($action === 'delete_aicountant_conversation') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $conversationId = (int)($body['id'] ?? 0);
    if ($conversationId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    accumul8_aicountant_require_conversation($viewerId, $conversationId);
    Database::execute(
        'DELETE FROM accumul8_ai_conversations WHERE id = ? AND owner_user_id = ?',
        [$conversationId, $viewerId]
    );
    catn8_json_response(['success' => true]);
}

if ($action === 'send_aicountant_message') {
    catn8_require_method('POST');
    catn8_rate_limit_require('accumul8.aicountant.send.' . $actorUserId . '.' . $viewerId, 60, 600);

    $body = catn8_read_json_body();
    $conversationId = (int)($body['conversation_id'] ?? 0);
    $message = accumul8_aicountant_normalize_message($body['message'] ?? '', 4000);
    $title = accumul8_aicountant_normalize_title($body['title'] ?? '', 191);
    if ($message === '') {
        catn8_json_response(['success' => false, 'error' => 'Message is required'], 400);
    }

    if ($conversationId <= 0) {
        $conversationId = accumul8_aicountant_create_conversation($viewerId, $title !== '' ? $title : accumul8_aicountant_title_from_message($message));
    }

    $conversationRow = accumul8_aicountant_require_conversation($viewerId, $conversationId);
    if (trim((string)($conversationRow['title'] ?? '')) === '') {
        Database::execute(
            "UPDATE accumul8_ai_conversations
             SET title = ?, updated_at = NOW()
             WHERE id = ? AND owner_user_id = ?",
            [accumul8_aicountant_title_from_message($message), $conversationId, $viewerId]
        );
        $conversationRow = accumul8_aicountant_require_conversation($viewerId, $conversationId);
    }

    accumul8_aicountant_append_message($viewerId, $conversationId, 'user', $message, '', '', [
        'actor_user_id' => $actorUserId,
    ]);

    $actionResults = [];
    try {
        $requestedActions = accumul8_aicountant_extract_actions($viewerId, $message);
        $actionResults = accumul8_aicountant_apply_actions($viewerId, $actorUserId, $requestedActions);
        $reply = accumul8_aicountant_generate_reply($viewerId, $conversationRow, $message, $actionResults);
    } catch (Throwable $exception) {
        Database::execute(
            "UPDATE accumul8_ai_conversations
             SET updated_at = NOW()
             WHERE id = ? AND owner_user_id = ?",
            [$conversationId, $viewerId]
        );
        throw $exception;
    }

    $assistantText = trim((string)($reply['content'] ?? ''));
    if ($assistantText === '') {
        throw new RuntimeException('AIcountant returned an empty response');
    }

    Database::execute(
        "UPDATE accumul8_ai_conversations
         SET conversation_summary = ?, updated_at = NOW()
         WHERE id = ? AND owner_user_id = ?",
        [accumul8_normalize_text($assistantText, 1000), $conversationId, $viewerId]
    );

    accumul8_aicountant_append_message(
        $viewerId,
        $conversationId,
        'assistant',
        $assistantText,
        (string)($reply['provider'] ?? ''),
        (string)($reply['model'] ?? ''),
        [
            'action_results' => $actionResults,
            'context_generated_at' => (string)($reply['context']['generated_at'] ?? ''),
            'account_count' => (int)($reply['context']['summary']['account_count'] ?? 0),
            'transaction_count' => (int)($reply['context']['summary']['transaction_count'] ?? 0),
        ]
    );
    foreach ($actionResults as $actionResult) {
        if (!is_array($actionResult)) {
            continue;
        }
        $status = strtolower((string)($actionResult['status'] ?? ''));
        $level = $status === 'error' ? 'error' : ($status === 'ignored' ? 'warning' : 'success');
        $summary = accumul8_normalize_text((string)($actionResult['summary'] ?? ''), 240);
        if ($summary === '') {
            continue;
        }
        accumul8_message_board_post(
            $viewerId,
            $actorUserId,
            'aicountant',
            $level,
            'AIcountant action update',
            $summary,
            $actionResult
        );
    }

    $conversation = accumul8_aicountant_map_conversation_row(accumul8_aicountant_require_conversation($viewerId, $conversationId));
    catn8_json_response([
        'success' => true,
        'conversation' => $conversation,
        'messages' => accumul8_aicountant_list_messages($viewerId, $conversationId),
    ]);
}

if ($action === 'list_message_board_messages') {
    catn8_require_method('GET');
    catn8_json_response([
        'success' => true,
        'messages' => accumul8_message_board_list($viewerId),
        'unacknowledged_count' => accumul8_message_board_unacknowledged_count($viewerId),
    ]);
}

if ($action === 'create_message_board_message') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $title = accumul8_normalize_text($body['title'] ?? '', 191);
    $bodyText = accumul8_normalize_text($body['body_text'] ?? '', 2000);
    $sourceKind = accumul8_normalize_text($body['source_kind'] ?? 'manual', 64);
    $messageLevel = accumul8_normalize_text($body['message_level'] ?? 'info', 24);
    $meta = is_array($body['meta'] ?? null) ? $body['meta'] : [];
    if ($title === '' && $bodyText === '') {
        catn8_json_response(['success' => false, 'error' => 'title or body_text is required'], 400);
    }
    accumul8_message_board_post($viewerId, $actorUserId, $sourceKind, $messageLevel, $title, $bodyText, $meta);
    catn8_json_response([
        'success' => true,
        'messages' => accumul8_message_board_list($viewerId),
        'unacknowledged_count' => accumul8_message_board_unacknowledged_count($viewerId),
    ]);
}

if ($action === 'acknowledge_message_board_messages') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $ids = array_values(array_unique(array_filter(array_map('intval', is_array($body['ids'] ?? null) ? $body['ids'] : []), static fn(int $id): bool => $id > 0)));
    if ($ids === []) {
        catn8_json_response(['success' => false, 'error' => 'ids are required'], 400);
    }
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    Database::execute(
        'UPDATE accumul8_message_board_messages
         SET is_acknowledged = 1, acknowledged_at = NOW(), acknowledged_by_user_id = ?
         WHERE owner_user_id = ?
           AND id IN (' . $placeholders . ')',
        array_merge([$actorUserId, $viewerId], $ids)
    );
    catn8_json_response([
        'success' => true,
        'messages' => accumul8_message_board_list($viewerId),
        'unacknowledged_count' => accumul8_message_board_unacknowledged_count($viewerId),
    ]);
}

if ($action === 'balance_books') {
    catn8_require_method('POST');
    try {
        $result = accumul8_balance_books($viewerId, $actorUserId);
        catn8_json_response(array_merge(['success' => true], $result));
    } catch (Throwable $exception) {
        catn8_json_response(['success' => false, 'error' => $exception->getMessage()], 500);
    }
}

if ($action === 'reconcile_opening_balances') {
    catn8_require_method('POST');
    try {
        $result = accumul8_reconcile_opening_balances($viewerId, $actorUserId);
        catn8_json_response(array_merge(['success' => true], $result));
    } catch (Throwable $exception) {
        catn8_json_response(['success' => false, 'error' => $exception->getMessage()], 500);
    }
}

if ($action === 'run_aicountant_watchlist') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    try {
        $result = accumul8_aicountant_run_watchlist(
            $viewerId,
            $actorUserId,
            accumul8_normalize_bool($body['send_email'] ?? 0) === 1,
            accumul8_normalize_bool($body['create_notification_rule'] ?? 0) === 1
        );
        catn8_json_response(array_merge(['success' => true], $result));
    } catch (Throwable $exception) {
        catn8_json_response(['success' => false, 'error' => $exception->getMessage()], 500);
    }
}

if ($action === 'run_aicountant_housekeeping') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    try {
        $result = accumul8_run_aicountant_housekeeping($viewerId, $actorUserId, [
            'send_email' => $body['send_email'] ?? 1,
            'create_notification_rule' => $body['create_notification_rule'] ?? 1,
            'email_on_attention_only' => $body['email_on_attention_only'] ?? 1,
            'run_entity_maintenance' => $body['run_entity_maintenance'] ?? 0,
        ]);
        catn8_json_response(array_merge(['success' => true], $result));
    } catch (Throwable $exception) {
        catn8_json_response(['success' => false, 'error' => $exception->getMessage()], 500);
    }
}

if ($action === 'create_entity') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $displayName = accumul8_normalize_text($body['display_name'] ?? '', 191);
    $contactType = accumul8_normalize_contact_type_value($body['contact_type'] ?? 'payee');
    $isPayee = accumul8_normalize_bool($body['is_payee'] ?? ($contactType === 'payee' ? 1 : 0));
    $isPayer = accumul8_normalize_bool($body['is_payer'] ?? ($contactType === 'payer' ? 1 : 0));
    $isBalancePerson = accumul8_normalize_bool($body['is_balance_person'] ?? ($contactType === 'repayment' ? 1 : 0));
    $normalizedEntityKind = accumul8_normalize_entity_kind_value($body['entity_kind'] ?? ($isBalancePerson ? 'contact' : 'business'));
    $isVendor = accumul8_normalize_bool($body['is_vendor'] ?? ($normalizedEntityKind === 'business' ? 1 : 0));
    $normalizedEntityKind = accumul8_entity_kind_from_vendor_state($normalizedEntityKind, $isVendor);

    if ($displayName === '') {
        catn8_json_response(['success' => false, 'error' => 'display_name is required'], 400);
    }

    $entityId = accumul8_upsert_entity($viewerId, [
        'display_name' => $displayName,
        'entity_kind' => $normalizedEntityKind,
        'contact_type' => $contactType,
        'is_payee' => $isPayee,
        'is_payer' => $isPayer,
        'is_vendor' => $isVendor,
        'is_balance_person' => $isBalancePerson,
        'default_amount' => accumul8_normalize_amount($body['default_amount'] ?? 0),
        'email' => accumul8_normalize_text($body['email'] ?? '', 191),
        'phone_number' => accumul8_normalize_text($body['phone_number'] ?? '', 32),
        'street_address' => accumul8_normalize_text($body['street_address'] ?? '', 191),
        'city' => accumul8_normalize_text($body['city'] ?? '', 120),
        'state' => accumul8_normalize_text($body['state'] ?? '', 64),
        'zip' => accumul8_normalize_text($body['zip'] ?? '', 20),
        'notes' => accumul8_normalize_text($body['notes'] ?? '', 1500),
        'is_active' => accumul8_normalize_bool($body['is_active'] ?? 1),
    ]);

    accumul8_sync_contact_from_entity($viewerId, $entityId);
    accumul8_sync_debtor_from_entity($viewerId, $entityId);

    catn8_json_response(['success' => true, 'id' => $entityId]);
}

if ($action === 'create_entity_alias') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $entityId = (int)($body['entity_id'] ?? 0);
    $aliasName = (string)($body['alias_name'] ?? '');
    $mergeEntityId = (int)($body['merge_entity_id'] ?? 0);
    $reassignIfConflict = !empty($body['reassign_if_conflict']);
    if ($entityId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid entity_id'], 400);
    }

    $entity = Database::queryOne(
        'SELECT id
         FROM accumul8_entities
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$entityId, $viewerId]
    );
    if (!$entity) {
        catn8_json_response(['success' => false, 'error' => 'Entity not found'], 404);
    }

    if ($mergeEntityId > 0) {
        if ($mergeEntityId === $entityId) {
            catn8_json_response(['success' => false, 'error' => 'Cannot merge an entity into itself'], 400);
        }
        $mergeEntity = Database::queryOne(
            'SELECT id, display_name
             FROM accumul8_entities
             WHERE id = ? AND owner_user_id = ?
             LIMIT 1',
            [$mergeEntityId, $viewerId]
        );
        if (!$mergeEntity) {
            catn8_json_response(['success' => false, 'error' => 'Merge source not found'], 404);
        }
        if (trim($aliasName) === '') {
            $aliasName = (string)($mergeEntity['display_name'] ?? '');
        }
        accumul8_merge_entities($viewerId, $entityId, $mergeEntityId);
    }

    $result = accumul8_assign_entity_alias($viewerId, $entityId, $aliasName, false, $reassignIfConflict);
    $status = (string)($result['status'] ?? '');
    if ($status === 'conflict') {
        catn8_json_response(['success' => false, 'error' => 'Alias already belongs to another entity'], 409);
    }
    if ($status === 'matches_display_name') {
        catn8_json_response(['success' => false, 'error' => 'Alias matches the entity name after normalization'], 409);
    }
    if ($status === 'invalid') {
        catn8_json_response(['success' => false, 'error' => 'Alias name is required'], 400);
    }
    if ($status === 'missing_entity') {
        catn8_json_response(['success' => false, 'error' => 'Entity not found'], 404);
    }

    $aliasId = isset($result['id']) ? (int)$result['id'] : 0;
    if (in_array($status, ['created', 'updated', 'reassigned'], true)) {
        accumul8_upsert_entity_alias_review(
            $viewerId,
            $entityId,
            $aliasName,
            'approved',
            'manual',
            true,
            ACCUMUL8_ENTITY_ALIAS_REVIEW_VERSION
        );
    }
    catn8_json_response([
        'success' => true,
        'id' => $aliasId > 0 ? $aliasId : null,
        'status' => $status,
        'merged_entity_id' => $mergeEntityId > 0 ? $mergeEntityId : null,
    ]);
}

if ($action === 'delete_entity_alias') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    $aliasRow = Database::queryOne(
        'SELECT entity_id, alias_name
         FROM accumul8_entity_aliases
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$id, $viewerId]
    );

    Database::execute(
        'DELETE FROM accumul8_entity_aliases
         WHERE id = ? AND owner_user_id = ?',
        [$id, $viewerId]
    );
    if ($aliasRow) {
        accumul8_delete_entity_alias_review(
            $viewerId,
            (int)($aliasRow['entity_id'] ?? 0),
            (string)($aliasRow['alias_name'] ?? '')
        );
    }
    catn8_json_response(['success' => true]);
}

if ($action === 'create_entity_endex_guide') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $payload = accumul8_validate_entity_endex_guide_payload($viewerId, $body);
    $existing = Database::queryOne(
        'SELECT id
         FROM accumul8_entity_endex_groups
         WHERE owner_user_id = ? AND parent_key = ?
         LIMIT 1',
        [$viewerId, (string)$payload['parent_key']]
    );
    if ($existing) {
        catn8_json_response(['success' => false, 'error' => 'A grouping guide for that parent already exists'], 409);
    }
    $id = accumul8_create_entity_endex_guide($viewerId, $payload);
    catn8_json_response(['success' => true, 'id' => $id]);
}

if ($action === 'update_entity_endex_guide') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    $payload = accumul8_validate_entity_endex_guide_payload($viewerId, $body);
    $existing = Database::queryOne(
        'SELECT id
         FROM accumul8_entity_endex_groups
         WHERE owner_user_id = ? AND parent_key = ? AND id <> ?
         LIMIT 1',
        [$viewerId, (string)$payload['parent_key'], $id]
    );
    if ($existing) {
        catn8_json_response(['success' => false, 'error' => 'Another grouping guide already uses that parent name'], 409);
    }
    accumul8_update_entity_endex_guide($viewerId, $id, $payload);
    catn8_json_response(['success' => true]);
}

if ($action === 'delete_entity_endex_guide') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    Database::execute(
        'DELETE FROM accumul8_entity_endex_groups
         WHERE id = ? AND owner_user_id = ?',
        [$id, $viewerId]
    );
    catn8_json_response(['success' => true]);
}

if ($action === 'scan_entity_aliases') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $entityId = (int)($body['entity_id'] ?? 0);
    $result = accumul8_scan_entity_aliases($viewerId, $entityId);
    catn8_json_response([
        'success' => true,
        'entity_id' => (int)($result['entity_id'] ?? 0),
        'created_count' => (int)($result['created_count'] ?? 0),
        'updated_count' => (int)($result['updated_count'] ?? 0),
        'skipped_count' => (int)($result['skipped_count'] ?? 0),
        'conflict_count' => (int)($result['conflict_count'] ?? 0),
        'reviewed_count' => (int)($result['reviewed_count'] ?? 0),
        'approved_count' => (int)($result['approved_count'] ?? 0),
        'rejected_count' => (int)($result['rejected_count'] ?? 0),
        'protected_skip_count' => (int)($result['protected_skip_count'] ?? 0),
        'alias_names' => array_values(array_map('strval', is_array($result['alias_names'] ?? null) ? $result['alias_names'] : [])),
    ]);
}

if ($action === 'scan_all_entity_aliases') {
    catn8_require_method('POST');

    $result = accumul8_scan_all_entity_aliases($viewerId);
    catn8_json_response([
        'success' => true,
        'scanned_entity_count' => (int)($result['scanned_entity_count'] ?? 0),
        'touched_entity_count' => (int)($result['touched_entity_count'] ?? 0),
        'created_count' => (int)($result['created_count'] ?? 0),
        'updated_count' => (int)($result['updated_count'] ?? 0),
        'skipped_count' => (int)($result['skipped_count'] ?? 0),
        'conflict_count' => (int)($result['conflict_count'] ?? 0),
        'reviewed_count' => (int)($result['reviewed_count'] ?? 0),
        'approved_count' => (int)($result['approved_count'] ?? 0),
        'rejected_count' => (int)($result['rejected_count'] ?? 0),
        'protected_skip_count' => (int)($result['protected_skip_count'] ?? 0),
    ]);
}

if ($action === 'update_entity') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $displayName = accumul8_normalize_text($body['display_name'] ?? '', 191);
    $contactType = accumul8_normalize_contact_type_value($body['contact_type'] ?? 'payee');
    $isPayee = accumul8_normalize_bool($body['is_payee'] ?? ($contactType === 'payee' ? 1 : 0));
    $isPayer = accumul8_normalize_bool($body['is_payer'] ?? ($contactType === 'payer' ? 1 : 0));
    $isBalancePerson = accumul8_normalize_bool($body['is_balance_person'] ?? ($contactType === 'repayment' ? 1 : 0));
    $normalizedEntityKind = accumul8_normalize_entity_kind_value($body['entity_kind'] ?? ($isBalancePerson ? 'contact' : 'business'));
    $isVendor = accumul8_normalize_bool($body['is_vendor'] ?? ($normalizedEntityKind === 'business' ? 1 : 0));
    $normalizedEntityKind = accumul8_entity_kind_from_vendor_state($normalizedEntityKind, $isVendor);

    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    if ($displayName === '') {
        catn8_json_response(['success' => false, 'error' => 'display_name is required'], 400);
    }

    $existing = Database::queryOne(
        'SELECT id
         FROM accumul8_entities
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$id, $viewerId]
    );
    if (!$existing) {
        catn8_json_response(['success' => false, 'error' => 'Entity not found'], 404);
    }

    $entityId = accumul8_upsert_entity($viewerId, [
        'display_name' => $displayName,
        'entity_kind' => $normalizedEntityKind,
        'contact_type' => $contactType,
        'is_payee' => $isPayee,
        'is_payer' => $isPayer,
        'is_vendor' => $isVendor,
        'is_balance_person' => $isBalancePerson,
        'default_amount' => accumul8_normalize_amount($body['default_amount'] ?? 0),
        'email' => accumul8_normalize_text($body['email'] ?? '', 191),
        'phone_number' => accumul8_normalize_text($body['phone_number'] ?? '', 32),
        'street_address' => accumul8_normalize_text($body['street_address'] ?? '', 191),
        'city' => accumul8_normalize_text($body['city'] ?? '', 120),
        'state' => accumul8_normalize_text($body['state'] ?? '', 64),
        'zip' => accumul8_normalize_text($body['zip'] ?? '', 20),
        'notes' => accumul8_normalize_text($body['notes'] ?? '', 1500),
        'is_active' => accumul8_normalize_bool($body['is_active'] ?? 1),
    ], $id);

    accumul8_sync_contact_from_entity($viewerId, $entityId);
    accumul8_sync_debtor_from_entity($viewerId, $entityId);

    catn8_json_response(['success' => true, 'id' => $entityId]);
}

if ($action === 'create_contact') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $name = accumul8_normalize_text($body['contact_name'] ?? '', 191);
    $type = accumul8_normalize_contact_type_value($body['contact_type'] ?? 'payee');
    $amount = accumul8_normalize_amount($body['default_amount'] ?? 0);
    $email = accumul8_normalize_text($body['email'] ?? '', 191);
    $phoneNumber = accumul8_normalize_text($body['phone_number'] ?? '', 32);
    $streetAddress = accumul8_normalize_text($body['street_address'] ?? '', 191);
    $city = accumul8_normalize_text($body['city'] ?? '', 120);
    $state = accumul8_normalize_text($body['state'] ?? '', 64);
    $zip = accumul8_normalize_text($body['zip'] ?? '', 20);
    $notes = accumul8_normalize_text($body['notes'] ?? '', 1500);

    if ($name === '') {
        catn8_json_response(['success' => false, 'error' => 'contact_name is required'], 400);
    }

    Database::execute(
        'INSERT INTO accumul8_contacts (owner_user_id, contact_name, contact_type, default_amount, email, phone_number, street_address, city, state, zip, notes, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
        [$viewerId, $name, $type, $amount, ($email === '' ? null : $email), ($phoneNumber === '' ? null : $phoneNumber), ($streetAddress === '' ? null : $streetAddress), ($city === '' ? null : $city), ($state === '' ? null : $state), ($zip === '' ? null : $zip), ($notes === '' ? null : $notes)]
    );

    $contactId = (int)Database::lastInsertId();
    accumul8_contact_entity_id_or_create($viewerId, $contactId);

    catn8_json_response(['success' => true, 'id' => $contactId]);
}

if ($action === 'create_banking_organization') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $groupName = accumul8_normalize_text($body['banking_organization_name'] ?? '', 191);
    $institutionName = accumul8_normalize_text($body['institution_name'] ?? '', 191);
    $websiteUrl = accumul8_normalize_optional_url($body['website_url'] ?? '', 2048);
    $loginUrl = accumul8_normalize_optional_url($body['login_url'] ?? '', 2048);
    $supportUrl = accumul8_normalize_optional_url($body['support_url'] ?? '', 2048);
    $supportPhone = accumul8_normalize_text($body['support_phone'] ?? '', 32);
    $supportEmail = accumul8_normalize_optional_email($body['support_email'] ?? '', 191);
    $routingNumber = accumul8_normalize_text($body['routing_number'] ?? '', 32);
    $mailingAddress = accumul8_normalize_text($body['mailing_address'] ?? '', 255);
    $iconPath = accumul8_normalize_text($body['icon_path'] ?? '', 512);
    $notes = accumul8_normalize_text($body['notes'] ?? '', 1500);
    $isActive = accumul8_normalize_bool($body['is_active'] ?? 1);

    if ($groupName === '') {
        catn8_json_response(['success' => false, 'error' => 'banking_organization_name is required'], 400);
    }
    if ($iconPath !== '' && !preg_match('#^/(?:[A-Za-z0-9._/-]+)$#', $iconPath)) {
        catn8_json_response(['success' => false, 'error' => 'icon_path must be a site-relative asset path'], 400);
    }

    Database::execute(
        'INSERT INTO accumul8_account_groups (owner_user_id, group_name, institution_name, website_url, login_url, support_url, support_phone, support_email, routing_number, mailing_address, icon_path, notes, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [$viewerId, $groupName, $institutionName, $websiteUrl, $loginUrl, $supportUrl, $supportPhone, $supportEmail, $routingNumber, $mailingAddress, $iconPath, $notes === '' ? null : $notes, $isActive]
    );

    catn8_json_response(['success' => true, 'id' => (int)Database::lastInsertId()]);
}

if ($action === 'update_banking_organization') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $groupName = accumul8_normalize_text($body['banking_organization_name'] ?? '', 191);
    $institutionName = accumul8_normalize_text($body['institution_name'] ?? '', 191);
    $websiteUrl = accumul8_normalize_optional_url($body['website_url'] ?? '', 2048);
    $loginUrl = accumul8_normalize_optional_url($body['login_url'] ?? '', 2048);
    $supportUrl = accumul8_normalize_optional_url($body['support_url'] ?? '', 2048);
    $supportPhone = accumul8_normalize_text($body['support_phone'] ?? '', 32);
    $supportEmail = accumul8_normalize_optional_email($body['support_email'] ?? '', 191);
    $routingNumber = accumul8_normalize_text($body['routing_number'] ?? '', 32);
    $mailingAddress = accumul8_normalize_text($body['mailing_address'] ?? '', 255);
    $iconPath = accumul8_normalize_text($body['icon_path'] ?? '', 512);
    $notes = accumul8_normalize_text($body['notes'] ?? '', 1500);
    $isActive = accumul8_normalize_bool($body['is_active'] ?? 1);

    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    if ($groupName === '') {
        catn8_json_response(['success' => false, 'error' => 'banking_organization_name is required'], 400);
    }
    if ($iconPath !== '' && !preg_match('#^/(?:[A-Za-z0-9._/-]+)$#', $iconPath)) {
        catn8_json_response(['success' => false, 'error' => 'icon_path must be a site-relative asset path'], 400);
    }

    accumul8_require_owned_id('account_groups', $viewerId, $id);

    Database::execute(
        'UPDATE accumul8_account_groups
         SET group_name = ?, institution_name = ?, website_url = ?, login_url = ?, support_url = ?, support_phone = ?, support_email = ?, routing_number = ?, mailing_address = ?, icon_path = ?, notes = ?, is_active = ?
         WHERE id = ? AND owner_user_id = ?',
        [$groupName, $institutionName, $websiteUrl, $loginUrl, $supportUrl, $supportPhone, $supportEmail, $routingNumber, $mailingAddress, $iconPath, $notes === '' ? null : $notes, $isActive, $id, $viewerId]
    );

    catn8_json_response(['success' => true]);
}

if ($action === 'delete_banking_organization') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    accumul8_require_owned_id('account_groups', $viewerId, $id);

    if (accumul8_account_group_has_associations($viewerId, $id)) {
        catn8_json_response(['success' => false, 'error' => 'Cannot delete a banking organization that still has bank accounts associated with it'], 409);
    }

    Database::execute('DELETE FROM accumul8_account_groups WHERE id = ? AND owner_user_id = ?', [$id, $viewerId]);
    catn8_json_response(['success' => true]);
}

if ($action === 'create_bank_connection') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $providerName = accumul8_validate_bank_connection_provider($body['provider_name'] ?? 'teller');
    $institutionId = accumul8_normalize_text($body['institution_id'] ?? '', 64);
    $institutionName = accumul8_normalize_text($body['institution_name'] ?? '', 191);
    $tellerEnrollmentId = accumul8_normalize_text($body['teller_enrollment_id'] ?? '', 191);
    $tellerUserId = accumul8_normalize_text($body['teller_user_id'] ?? '', 191);
    $status = accumul8_validate_bank_connection_status($body['status'] ?? 'setup_pending');

    if ($institutionId === '' && $institutionName === '') {
        catn8_json_response(['success' => false, 'error' => 'institution_name or institution_id is required'], 400);
    }

    if ($tellerEnrollmentId !== '') {
        $existing = Database::queryOne(
            'SELECT id
             FROM accumul8_bank_connections
             WHERE owner_user_id = ?
               AND provider_name = ?
               AND teller_enrollment_id = ?
             LIMIT 1',
            [$viewerId, $providerName, $tellerEnrollmentId]
        );
        if ($existing) {
            catn8_json_response(['success' => false, 'error' => 'A bank connection for that enrollment already exists'], 409);
        }
    }

    Database::execute(
        'INSERT INTO accumul8_bank_connections
            (owner_user_id, provider_name, institution_id, institution_name, teller_enrollment_id, teller_user_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
            $viewerId,
            $providerName,
            $institutionId === '' ? null : $institutionId,
            $institutionName === '' ? null : $institutionName,
            $tellerEnrollmentId === '' ? null : $tellerEnrollmentId,
            $tellerUserId === '' ? null : $tellerUserId,
            $status,
        ]
    );

    catn8_json_response(['success' => true, 'id' => (int)Database::lastInsertId()]);
}

if ($action === 'update_bank_connection') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $providerName = accumul8_validate_bank_connection_provider($body['provider_name'] ?? 'teller');
    $institutionId = accumul8_normalize_text($body['institution_id'] ?? '', 64);
    $institutionName = accumul8_normalize_text($body['institution_name'] ?? '', 191);
    $tellerEnrollmentId = accumul8_normalize_text($body['teller_enrollment_id'] ?? '', 191);
    $tellerUserId = accumul8_normalize_text($body['teller_user_id'] ?? '', 191);
    $status = accumul8_validate_bank_connection_status($body['status'] ?? 'setup_pending');

    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    if ($institutionId === '' && $institutionName === '') {
        catn8_json_response(['success' => false, 'error' => 'institution_name or institution_id is required'], 400);
    }

    accumul8_require_owned_id('bank_connections', $viewerId, $id);

    if ($tellerEnrollmentId !== '') {
        $existing = Database::queryOne(
            'SELECT id
             FROM accumul8_bank_connections
             WHERE owner_user_id = ?
               AND provider_name = ?
               AND teller_enrollment_id = ?
               AND id <> ?
             LIMIT 1',
            [$viewerId, $providerName, $tellerEnrollmentId, $id]
        );
        if ($existing) {
            catn8_json_response(['success' => false, 'error' => 'A bank connection for that enrollment already exists'], 409);
        }
    }

    Database::execute(
        'UPDATE accumul8_bank_connections
         SET provider_name = ?, institution_id = ?, institution_name = ?, teller_enrollment_id = ?, teller_user_id = ?, status = ?, updated_at = NOW()
         WHERE id = ? AND owner_user_id = ?',
        [
            $providerName,
            $institutionId === '' ? null : $institutionId,
            $institutionName === '' ? null : $institutionName,
            $tellerEnrollmentId === '' ? null : $tellerEnrollmentId,
            $tellerUserId === '' ? null : $tellerUserId,
            $status,
            $id,
            $viewerId,
        ]
    );

    catn8_json_response(['success' => true]);
}

if ($action === 'delete_bank_connection') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    accumul8_require_owned_id('bank_connections', $viewerId, $id);
    $row = Database::queryOne(
        'SELECT id, owner_user_id, teller_enrollment_id, teller_access_token_secret_key
         FROM accumul8_bank_connections
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$id, $viewerId]
    );
    if (!$row) {
        catn8_json_response(['success' => false, 'error' => 'Record not found'], 404);
    }

    $secretKey = accumul8_bank_connection_secret_key_for_row($row);

    Database::beginTransaction();
    try {
        Database::execute(
            'UPDATE accumul8_accounts
             SET bank_connection_id = NULL
             WHERE owner_user_id = ?
               AND bank_connection_id = ?',
            [$viewerId, $id]
        );
        Database::execute(
            'DELETE FROM accumul8_bank_connections
             WHERE id = ? AND owner_user_id = ?',
            [$id, $viewerId]
        );
        Database::commit();
    } catch (Throwable $e) {
        Database::rollBack();
        throw $e;
    }

    if ($secretKey !== '' && !secret_delete($secretKey)) {
        error_log('accumul8 delete_bank_connection warning: failed to delete Teller secret for connection ' . $id);
    }

    catn8_json_response(['success' => true]);
}

if ($action === 'create_account') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $accountName = accumul8_normalize_text($body['account_name'] ?? '', 191);
    $accountGroupId = isset($body['banking_organization_id']) ? (int)$body['banking_organization_id'] : 0;
    $accountGroupIdOrNull = $accountGroupId > 0 ? accumul8_require_owned_id('account_groups', $viewerId, $accountGroupId) : null;
    $accountNickname = accumul8_normalize_text($body['account_nickname'] ?? '', 191);
    $accountType = accumul8_validate_account_type($body['account_type'] ?? 'checking');
    $accountSubtype = accumul8_normalize_text($body['account_subtype'] ?? '', 64);
    $institutionName = accumul8_normalize_text($body['institution_name'] ?? '', 191);
    $accountNumberMask = accumul8_normalize_text($body['account_number_mask'] ?? '', 32);
    $maskLast4 = accumul8_normalize_text($body['mask_last4'] ?? '', 8);
    $routingNumber = accumul8_normalize_text($body['routing_number'] ?? '', 32);
    $currencyCode = strtoupper(accumul8_normalize_text($body['currency_code'] ?? 'USD', 3));
    $statementDayOfMonth = accumul8_normalize_optional_day_of_month($body['statement_day_of_month'] ?? null, 'statement_day_of_month');
    $paymentDueDayOfMonth = accumul8_normalize_optional_day_of_month($body['payment_due_day_of_month'] ?? null, 'payment_due_day_of_month');
    $autopayEnabled = accumul8_normalize_bool($body['autopay_enabled'] ?? 0);
    $creditLimit = accumul8_normalize_decimal_value($body['credit_limit'] ?? 0, 'credit_limit');
    $interestRate = accumul8_normalize_decimal_value($body['interest_rate'] ?? 0, 'interest_rate');
    $minimumPayment = accumul8_normalize_decimal_value($body['minimum_payment'] ?? 0, 'minimum_payment');
    $openedOn = accumul8_normalize_date($body['opened_on'] ?? null);
    $closedOn = accumul8_normalize_date($body['closed_on'] ?? null);
    $notes = accumul8_normalize_text($body['notes'] ?? '', 1500);
    $isActive = accumul8_normalize_bool($body['is_active'] ?? 1);

    if ($accountName === '') {
        catn8_json_response(['success' => false, 'error' => 'account_name is required'], 400);
    }
    if ($currencyCode === '' || !preg_match('/^[A-Z]{3}$/', $currencyCode)) {
        catn8_json_response(['success' => false, 'error' => 'currency_code must be a 3-letter code'], 400);
    }

    Database::execute(
        'INSERT INTO accumul8_accounts
            (owner_user_id, account_group_id, account_name, account_nickname, account_type, account_subtype, institution_name, account_number_mask, mask_last4, routing_number, currency_code, statement_day_of_month, payment_due_day_of_month, autopay_enabled, credit_limit, interest_rate, minimum_payment, opened_on, closed_on, notes, current_balance, available_balance, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, 0.00, ?)',
        [$viewerId, $accountGroupIdOrNull, $accountName, $accountNickname, $accountType, $accountSubtype, $institutionName, $accountNumberMask, $maskLast4, $routingNumber, $currencyCode, $statementDayOfMonth, $paymentDueDayOfMonth, $autopayEnabled, $creditLimit, $interestRate, $minimumPayment, $openedOn, $closedOn, $notes === '' ? null : $notes, $isActive]
    );

    catn8_json_response(['success' => true, 'id' => (int)Database::lastInsertId()]);
}

if ($action === 'update_account') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $accountName = accumul8_normalize_text($body['account_name'] ?? '', 191);
    $accountGroupId = isset($body['banking_organization_id']) ? (int)$body['banking_organization_id'] : 0;
    $accountGroupIdOrNull = $accountGroupId > 0 ? accumul8_require_owned_id('account_groups', $viewerId, $accountGroupId) : null;
    $accountNickname = accumul8_normalize_text($body['account_nickname'] ?? '', 191);
    $accountType = accumul8_validate_account_type($body['account_type'] ?? 'checking');
    $accountSubtype = accumul8_normalize_text($body['account_subtype'] ?? '', 64);
    $institutionName = accumul8_normalize_text($body['institution_name'] ?? '', 191);
    $accountNumberMask = accumul8_normalize_text($body['account_number_mask'] ?? '', 32);
    $maskLast4 = accumul8_normalize_text($body['mask_last4'] ?? '', 8);
    $routingNumber = accumul8_normalize_text($body['routing_number'] ?? '', 32);
    $currencyCode = strtoupper(accumul8_normalize_text($body['currency_code'] ?? 'USD', 3));
    $statementDayOfMonth = accumul8_normalize_optional_day_of_month($body['statement_day_of_month'] ?? null, 'statement_day_of_month');
    $paymentDueDayOfMonth = accumul8_normalize_optional_day_of_month($body['payment_due_day_of_month'] ?? null, 'payment_due_day_of_month');
    $autopayEnabled = accumul8_normalize_bool($body['autopay_enabled'] ?? 0);
    $creditLimit = accumul8_normalize_decimal_value($body['credit_limit'] ?? 0, 'credit_limit');
    $interestRate = accumul8_normalize_decimal_value($body['interest_rate'] ?? 0, 'interest_rate');
    $minimumPayment = accumul8_normalize_decimal_value($body['minimum_payment'] ?? 0, 'minimum_payment');
    $openedOn = accumul8_normalize_date($body['opened_on'] ?? null);
    $closedOn = accumul8_normalize_date($body['closed_on'] ?? null);
    $notes = accumul8_normalize_text($body['notes'] ?? '', 1500);
    $isActive = accumul8_normalize_bool($body['is_active'] ?? 1);

    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    if ($accountName === '') {
        catn8_json_response(['success' => false, 'error' => 'account_name is required'], 400);
    }
    if ($currencyCode === '' || !preg_match('/^[A-Z]{3}$/', $currencyCode)) {
        catn8_json_response(['success' => false, 'error' => 'currency_code must be a 3-letter code'], 400);
    }

    accumul8_require_owned_id('accounts', $viewerId, $id);

    Database::execute(
        'UPDATE accumul8_accounts
         SET account_group_id = ?, account_name = ?, account_nickname = ?, account_type = ?, account_subtype = ?, institution_name = ?, account_number_mask = ?, mask_last4 = ?, routing_number = ?, currency_code = ?, statement_day_of_month = ?, payment_due_day_of_month = ?, autopay_enabled = ?, credit_limit = ?, interest_rate = ?, minimum_payment = ?, opened_on = ?, closed_on = ?, notes = ?, is_active = ?
         WHERE id = ? AND owner_user_id = ?',
        [$accountGroupIdOrNull, $accountName, $accountNickname, $accountType, $accountSubtype, $institutionName, $accountNumberMask, $maskLast4, $routingNumber, $currencyCode, $statementDayOfMonth, $paymentDueDayOfMonth, $autopayEnabled, $creditLimit, $interestRate, $minimumPayment, $openedOn, $closedOn, $notes === '' ? null : $notes, $isActive, $id, $viewerId]
    );

    catn8_json_response(['success' => true]);
}

if ($action === 'delete_account') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    $deleteAssociatedRecords = !empty($body['delete_associated_records']);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    accumul8_require_owned_id('accounts', $viewerId, $id);

    if (!$deleteAssociatedRecords && accumul8_account_has_associations($viewerId, $id)) {
        catn8_json_response(['success' => false, 'error' => 'Cannot delete a bank account that has ledger or recurring records associated with it'], 409);
    }

    if ($deleteAssociatedRecords) {
        $result = accumul8_delete_account_and_associated_records($viewerId, $id);
        catn8_json_response(['success' => true] + $result);
    }

    Database::execute('DELETE FROM accumul8_accounts WHERE id = ? AND owner_user_id = ?', [$id, $viewerId]);
    catn8_json_response(['success' => true, 'deleted_transaction_count' => 0, 'deleted_recurring_count' => 0]);
}

if ($action === 'update_contact') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $name = accumul8_normalize_text($body['contact_name'] ?? '', 191);
    $type = accumul8_normalize_contact_type_value($body['contact_type'] ?? 'payee');
    $amount = accumul8_normalize_amount($body['default_amount'] ?? 0);
    $email = accumul8_normalize_text($body['email'] ?? '', 191);
    $phoneNumber = accumul8_normalize_text($body['phone_number'] ?? '', 32);
    $streetAddress = accumul8_normalize_text($body['street_address'] ?? '', 191);
    $city = accumul8_normalize_text($body['city'] ?? '', 120);
    $state = accumul8_normalize_text($body['state'] ?? '', 64);
    $zip = accumul8_normalize_text($body['zip'] ?? '', 20);
    $notes = accumul8_normalize_text($body['notes'] ?? '', 1500);

    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    if ($name === '') {
        catn8_json_response(['success' => false, 'error' => 'contact_name is required'], 400);
    }

    Database::execute(
        'UPDATE accumul8_contacts
         SET contact_name = ?, contact_type = ?, default_amount = ?, email = ?, phone_number = ?, street_address = ?, city = ?, state = ?, zip = ?, notes = ?
         WHERE id = ? AND owner_user_id = ?',
        [$name, $type, $amount, ($email === '' ? null : $email), ($phoneNumber === '' ? null : $phoneNumber), ($streetAddress === '' ? null : $streetAddress), ($city === '' ? null : $city), ($state === '' ? null : $state), ($zip === '' ? null : $zip), ($notes === '' ? null : $notes), $id, $viewerId]
    );

    accumul8_contact_entity_id_or_create($viewerId, $id);

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

    $debtorId = (int)Database::lastInsertId();
    catn8_json_response(['success' => true, 'id' => $debtorId]);
}

if ($action === 'update_debtor') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $debtorName = accumul8_normalize_text($body['debtor_name'] ?? '', 191);
    $notes = accumul8_normalize_text($body['notes'] ?? '', 1500);
    $existingDebtor = Database::queryOne(
        'SELECT contact_id FROM accumul8_debtors WHERE id = ? AND owner_user_id = ? LIMIT 1',
        [$id, $viewerId]
    );
    if (!$existingDebtor) {
        catn8_json_response(['success' => false, 'error' => 'Debtor not found'], 404);
    }
    $contactIdOrNull = array_key_exists('contact_id', $body)
        ? accumul8_owned_id_or_null('contacts', $viewerId, (int)($body['contact_id'] ?? 0))
        : (isset($existingDebtor['contact_id']) ? (int)$existingDebtor['contact_id'] : null);
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
    $paymentMethod = accumul8_validate_enum('payment_method', $body['payment_method'] ?? 'unspecified', ['unspecified', 'autopay', 'manual'], 'unspecified');
    $amount = accumul8_normalize_amount($body['amount'] ?? 0);
    $intervalCount = (int)($body['interval_count'] ?? 1);
    $intervalCount = max(1, min(365, $intervalCount));
    $nextDue = accumul8_require_valid_date('next_due_date', $body['next_due_date'] ?? '');
    $paidDate = accumul8_normalize_date($body['paid_date'] ?? null);
    $notes = accumul8_normalize_text($body['notes'] ?? '', 1500);
    $isBudgetPlanner = accumul8_normalize_bool($body['is_budget_planner'] ?? 1);
    $contactId = isset($body['contact_id']) ? (int)$body['contact_id'] : 0;
    $entityId = isset($body['entity_id']) ? (int)$body['entity_id'] : 0;
    $accountId = isset($body['account_id']) ? (int)$body['account_id'] : 0;
    $dayOfMonth = isset($body['day_of_month']) && $body['day_of_month'] !== '' ? (int)$body['day_of_month'] : null;
    $dayOfWeek = isset($body['day_of_week']) && $body['day_of_week'] !== '' ? (int)$body['day_of_week'] : null;
    $contactIdOrNull = accumul8_owned_id_or_null('contacts', $viewerId, $contactId);
    $requestedEntityIdOrNull = accumul8_owned_id_or_null('entities', $viewerId, $entityId);
    $accountIdOrNull = accumul8_owned_id_or_null('accounts', $viewerId, $accountId);
    $entityIdOrNull = $requestedEntityIdOrNull !== null
        ? $requestedEntityIdOrNull
        : ($contactIdOrNull !== null
        ? accumul8_contact_entity_id_or_create($viewerId, (int)$contactIdOrNull)
        : accumul8_recurring_entity_id_or_create($viewerId, [
            'title' => $title,
            'direction' => $direction,
            'amount' => $amount,
            'notes' => $notes,
            'is_active' => 1,
        ]));
    if ($requestedEntityIdOrNull !== null) {
        $contactIdOrNull = accumul8_entity_contact_id_or_null($viewerId, $requestedEntityIdOrNull);
    }

    if ($title === '') {
        catn8_json_response(['success' => false, 'error' => 'title is required'], 400);
    }

    Database::execute(
        'INSERT INTO accumul8_recurring_payments
            (owner_user_id, entity_id, contact_id, account_id, title, direction, amount, frequency, payment_method, interval_count, day_of_month, day_of_week, next_due_date, paid_date, notes, is_active, is_budget_planner)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)',
        [
            $viewerId,
            $entityIdOrNull,
            $contactIdOrNull,
            $accountIdOrNull,
            $title,
            $direction,
            $amount,
            $frequency,
            $paymentMethod,
            $intervalCount,
            $dayOfMonth,
            $dayOfWeek,
            $nextDue,
            $paidDate,
            $notes === '' ? null : $notes,
            $isBudgetPlanner,
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
    $paymentMethod = accumul8_validate_enum('payment_method', $body['payment_method'] ?? 'unspecified', ['unspecified', 'autopay', 'manual'], 'unspecified');
    $amount = accumul8_normalize_amount($body['amount'] ?? 0);
    $intervalCount = (int)($body['interval_count'] ?? 1);
    $intervalCount = max(1, min(365, $intervalCount));
    $nextDue = accumul8_require_valid_date('next_due_date', $body['next_due_date'] ?? '');
    $paidDate = accumul8_normalize_date($body['paid_date'] ?? null);
    $notes = accumul8_normalize_text($body['notes'] ?? '', 1500);
    $isBudgetPlanner = accumul8_normalize_bool($body['is_budget_planner'] ?? 1);
    $contactId = isset($body['contact_id']) ? (int)$body['contact_id'] : 0;
    $entityId = isset($body['entity_id']) ? (int)$body['entity_id'] : 0;
    $accountId = isset($body['account_id']) ? (int)$body['account_id'] : 0;
    $dayOfMonth = isset($body['day_of_month']) && $body['day_of_month'] !== '' ? (int)$body['day_of_month'] : null;
    $dayOfWeek = isset($body['day_of_week']) && $body['day_of_week'] !== '' ? (int)$body['day_of_week'] : null;
    $contactIdOrNull = accumul8_owned_id_or_null('contacts', $viewerId, $contactId);
    $requestedEntityIdOrNull = accumul8_owned_id_or_null('entities', $viewerId, $entityId);
    $accountIdOrNull = accumul8_owned_id_or_null('accounts', $viewerId, $accountId);
    $entityIdOrNull = $requestedEntityIdOrNull !== null
        ? $requestedEntityIdOrNull
        : ($contactIdOrNull !== null
        ? accumul8_contact_entity_id_or_create($viewerId, (int)$contactIdOrNull)
        : accumul8_recurring_entity_id_or_create($viewerId, [
            'title' => $title,
            'direction' => $direction,
            'amount' => $amount,
            'notes' => $notes,
            'is_active' => 1,
        ]));
    if ($requestedEntityIdOrNull !== null) {
        $contactIdOrNull = accumul8_entity_contact_id_or_null($viewerId, $requestedEntityIdOrNull);
    }

    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    if ($title === '') {
        catn8_json_response(['success' => false, 'error' => 'title is required'], 400);
    }

    $existingRecurring = Database::queryOne(
        'SELECT id, entity_id, contact_id, account_id, title, direction, amount, next_due_date, paid_date, notes, is_budget_planner
         FROM accumul8_recurring_payments
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$id, $viewerId]
    );
    if (!$existingRecurring) {
        catn8_json_response(['success' => false, 'error' => 'Recurring payment not found'], 404);
    }

    Database::execute(
        'UPDATE accumul8_recurring_payments
         SET entity_id = ?, contact_id = ?, account_id = ?, title = ?, direction = ?, amount = ?, frequency = ?, payment_method = ?, interval_count = ?,
             day_of_month = ?, day_of_week = ?, next_due_date = ?, paid_date = ?, notes = ?, is_budget_planner = ?
         WHERE id = ? AND owner_user_id = ?',
        [
            $entityIdOrNull,
            $contactIdOrNull,
            $accountIdOrNull,
            $title,
            $direction,
            $amount,
            $frequency,
            $paymentMethod,
            $intervalCount,
            $dayOfMonth,
            $dayOfWeek,
            $nextDue,
            $paidDate,
            $notes === '' ? null : $notes,
            $isBudgetPlanner,
            $id,
            $viewerId,
        ]
    );

    $syncedLinkedRows = accumul8_sync_open_recurring_transactions_from_template($viewerId, $id, $existingRecurring, [
        'entity_id' => $entityIdOrNull,
        'contact_id' => $contactIdOrNull,
        'account_id' => $accountIdOrNull,
        'title' => $title,
        'direction' => $direction,
        'amount' => $amount,
        'next_due_date' => $nextDue,
        'paid_date' => $paidDate,
        'notes' => $notes,
        'is_budget_planner' => $isBudgetPlanner,
    ]);
    if ($syncedLinkedRows > 0) {
        accumul8_recompute_running_balance($viewerId);
    }

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
    $created = accumul8_materialize_due_recurring_for_owner($viewerId, $actorUserId);
    catn8_json_response(['success' => true, 'created' => $created]);
}

if ($action === 'ensure_budget_month') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $monthValue = accumul8_normalize_month_value($body['month_value'] ?? null);
    if ($monthValue === null) {
        catn8_json_response(['success' => false, 'error' => 'Invalid month_value'], 400);
    }

    $created = accumul8_ensure_budget_month_transactions($viewerId, $actorUserId, $monthValue);
    catn8_json_response(['success' => true, 'created' => $created]);
}

if ($action === 'backfill_entities_phase1') {
    catn8_require_method('POST');
    $stats = accumul8_backfill_entities_for_owner($viewerId);
    catn8_json_response(['success' => true, 'stats' => $stats]);
}

if ($action === 'backfill_entities_phase2') {
    catn8_require_method('POST');
    $stats = accumul8_backfill_entities_for_owner($viewerId);
    catn8_json_response(['success' => true, 'stats' => $stats]);
}

if ($action === 'create_transaction') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $transactionDate = accumul8_require_valid_date('transaction_date', $body['transaction_date'] ?? date('Y-m-d'));
    $dueDate = accumul8_normalize_date($body['due_date'] ?? null);
    $paidDate = accumul8_normalize_date($body['paid_date'] ?? null);
    $entryType = accumul8_validate_enum('entry_type', $body['entry_type'] ?? 'manual', ['manual', 'auto', 'transfer', 'deposit', 'bill'], 'manual');
    $description = accumul8_normalize_text($body['description'] ?? '', 255);
    $memo = accumul8_normalize_text($body['memo'] ?? '', 5000);
    $amount = accumul8_normalize_amount($body['amount'] ?? 0);
    $rtaAmount = accumul8_normalize_amount($body['rta_amount'] ?? 0);
    $isPaid = accumul8_normalize_bool($body['is_paid'] ?? 0);
    $isReconciled = accumul8_normalize_bool($body['is_reconciled'] ?? 0);
    $isBudgetPlanner = accumul8_normalize_bool($body['is_budget_planner'] ?? 1);
    $contactId = isset($body['contact_id']) ? (int)$body['contact_id'] : 0;
    $entityId = isset($body['entity_id']) ? (int)$body['entity_id'] : 0;
    $accountId = isset($body['account_id']) ? (int)$body['account_id'] : 0;
    $debtorId = isset($body['debtor_id']) ? (int)$body['debtor_id'] : 0;
    $balanceEntityId = isset($body['balance_entity_id']) ? (int)$body['balance_entity_id'] : 0;
    $contactIdOrNull = accumul8_owned_id_or_null('contacts', $viewerId, $contactId);
    $requestedEntityIdOrNull = accumul8_owned_id_or_null('entities', $viewerId, $entityId);
    $accountIdOrNull = accumul8_owned_id_or_null('accounts', $viewerId, $accountId);
    $hasDebtor = accumul8_has_debtor_support();
    $debtorIdOrNull = $hasDebtor ? accumul8_owned_id_or_null('debtors', $viewerId, $debtorId) : null;
    $requestedBalanceEntityIdOrNull = $hasDebtor ? accumul8_owned_id_or_null('entities', $viewerId, $balanceEntityId) : null;
    $isIouTransaction = $debtorIdOrNull !== null;
    if ($isIouTransaction) {
        $contactIdOrNull = null;
        $entityIdOrNull = null;
        $balanceEntityIdOrNull = null;
        $rtaAmount = 0.0;
        $isReconciled = 0;
        $isBudgetPlanner = 0;
    } else {
        $entityIdOrNull = $requestedEntityIdOrNull !== null
            ? $requestedEntityIdOrNull
            : ($contactIdOrNull !== null
            ? accumul8_contact_entity_id_or_create($viewerId, (int)$contactIdOrNull)
            : accumul8_transaction_entity_id_or_create($viewerId, [
                'description' => $description,
                'amount' => $amount,
                'memo' => $memo,
            ]));
        if ($requestedEntityIdOrNull !== null) {
            $contactIdOrNull = accumul8_entity_contact_id_or_null($viewerId, $requestedEntityIdOrNull);
        }
        $balanceEntityIdOrNull = $requestedBalanceEntityIdOrNull !== null
            ? $requestedBalanceEntityIdOrNull
            : null;
        if ($requestedBalanceEntityIdOrNull !== null && $hasDebtor) {
            $debtorIdOrNull = accumul8_entity_debtor_id_or_null($viewerId, $requestedBalanceEntityIdOrNull);
        }
        if ($debtorIdOrNull !== null) {
            $isBudgetPlanner = 0;
        }
    }

    if ($description === '') {
        catn8_json_response(['success' => false, 'error' => 'description is required'], 400);
    }

    if ($hasDebtor) {
        Database::execute(
            'INSERT INTO accumul8_transactions
                (owner_user_id, account_id, entity_id, balance_entity_id, contact_id, debtor_id, transaction_date, due_date, entry_type, description, memo, amount, rta_amount,
                 is_paid, is_reconciled, is_budget_planner, source_kind, paid_date, created_by_user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $viewerId,
                $accountIdOrNull,
                $entityIdOrNull,
                $balanceEntityIdOrNull,
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
                $isBudgetPlanner,
                'manual',
                $paidDate,
                $actorUserId,
            ]
        );
    } else {
        Database::execute(
            'INSERT INTO accumul8_transactions
                (owner_user_id, account_id, entity_id, contact_id, transaction_date, due_date, entry_type, description, memo, amount, rta_amount,
                 is_paid, is_reconciled, is_budget_planner, source_kind, paid_date, created_by_user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $viewerId,
                $accountIdOrNull,
                $entityIdOrNull,
                $contactIdOrNull,
                $transactionDate,
                $dueDate,
                $entryType,
                $description,
                $memo === '' ? null : $memo,
                $amount,
                $rtaAmount,
                $isPaid,
                $isReconciled,
                $isBudgetPlanner,
                'manual',
                $paidDate,
                $actorUserId,
            ]
        );
    }

    accumul8_recompute_running_balance($viewerId);

    catn8_json_response(['success' => true, 'id' => (int)Database::lastInsertId()]);
}

if ($action === 'update_transaction') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    $existingTx = accumul8_get_transaction_row($viewerId, $id);
    if (!$existingTx) {
        catn8_json_response(['success' => false, 'error' => 'Transaction not found'], 404);
    }
    $editPolicy = accumul8_transaction_edit_policy($existingTx);
    $transactionDate = accumul8_require_valid_date('transaction_date', $body['transaction_date'] ?? date('Y-m-d'));
    $dueDate = accumul8_normalize_date($body['due_date'] ?? null);
    $paidDate = accumul8_normalize_date($body['paid_date'] ?? null);
    $entryType = accumul8_validate_enum('entry_type', $body['entry_type'] ?? 'manual', ['manual', 'auto', 'transfer', 'deposit', 'bill'], 'manual');
    $description = accumul8_normalize_text($body['description'] ?? '', 255);
    $memo = accumul8_normalize_text($body['memo'] ?? '', 5000);
    $amount = accumul8_normalize_amount($body['amount'] ?? 0);
    $rtaAmount = accumul8_normalize_amount($body['rta_amount'] ?? 0);
    $isPaid = accumul8_normalize_bool($body['is_paid'] ?? 0);
    $isReconciled = accumul8_normalize_bool($body['is_reconciled'] ?? 0);
    $isBudgetPlanner = accumul8_normalize_bool($body['is_budget_planner'] ?? 1);
    $contactId = isset($body['contact_id']) ? (int)$body['contact_id'] : 0;
    $entityId = isset($body['entity_id']) ? (int)$body['entity_id'] : 0;
    $accountId = isset($body['account_id']) ? (int)$body['account_id'] : 0;
    $debtorId = isset($body['debtor_id']) ? (int)$body['debtor_id'] : 0;
    $balanceEntityId = isset($body['balance_entity_id']) ? (int)$body['balance_entity_id'] : 0;
    $contactIdOrNull = accumul8_owned_id_or_null('contacts', $viewerId, $contactId);
    $requestedEntityIdOrNull = accumul8_owned_id_or_null('entities', $viewerId, $entityId);
    $accountIdOrNull = accumul8_owned_id_or_null('accounts', $viewerId, $accountId);
    $hasDebtor = accumul8_has_debtor_support();
    $debtorIdOrNull = $hasDebtor ? accumul8_owned_id_or_null('debtors', $viewerId, $debtorId) : null;
    $requestedBalanceEntityIdOrNull = $hasDebtor ? accumul8_owned_id_or_null('entities', $viewerId, $balanceEntityId) : null;
    $isIouTransaction = $debtorIdOrNull !== null;
    if ($isIouTransaction) {
        $contactIdOrNull = null;
        $entityIdOrNull = null;
        $balanceEntityIdOrNull = null;
        $rtaAmount = 0.0;
        $isReconciled = 0;
        $isBudgetPlanner = 0;
    } else {
        $entityIdOrNull = $requestedEntityIdOrNull !== null
            ? $requestedEntityIdOrNull
            : ($contactIdOrNull !== null
            ? accumul8_contact_entity_id_or_create($viewerId, (int)$contactIdOrNull)
            : accumul8_transaction_entity_id_or_create($viewerId, [
                'description' => $description,
                'amount' => $amount,
                'memo' => $memo,
            ]));
        if ($requestedEntityIdOrNull !== null) {
            $contactIdOrNull = accumul8_entity_contact_id_or_null($viewerId, $requestedEntityIdOrNull);
        }
        $balanceEntityIdOrNull = $requestedBalanceEntityIdOrNull !== null
            ? $requestedBalanceEntityIdOrNull
            : null;
        if ($requestedBalanceEntityIdOrNull !== null && $hasDebtor) {
            $debtorIdOrNull = accumul8_entity_debtor_id_or_null($viewerId, $requestedBalanceEntityIdOrNull);
        }
        if ($debtorIdOrNull !== null) {
            $isBudgetPlanner = 0;
        }
    }

    if ($description === '') {
        catn8_json_response(['success' => false, 'error' => 'description is required'], 400);
    }

    $existingTransactionDate = accumul8_normalize_date($existingTx['transaction_date'] ?? null);
    $existingDueDate = accumul8_normalize_date($existingTx['due_date'] ?? null);
    $existingPaidDate = accumul8_normalize_date($existingTx['paid_date'] ?? null);
    $existingEntryType = accumul8_validate_enum('entry_type', $existingTx['entry_type'] ?? 'manual', ['manual', 'auto', 'transfer', 'deposit', 'bill'], 'manual');
    $existingDescription = accumul8_normalize_text($existingTx['description'] ?? '', 255);
    $existingAmount = accumul8_normalize_amount($existingTx['amount'] ?? 0);
    $existingRtaAmount = accumul8_normalize_amount($existingTx['rta_amount'] ?? 0);
    $existingAccountId = isset($existingTx['account_id']) ? (int)$existingTx['account_id'] : 0;
    $existingIsPaid = accumul8_normalize_bool($existingTx['is_paid'] ?? 0);
    $existingIsBudgetPlanner = accumul8_normalize_bool($existingTx['is_budget_planner'] ?? 0);
    $skipRecurringTemplateSync = accumul8_normalize_bool($body['skip_recurring_template_sync'] ?? 0);

    if (!$editPolicy['can_edit_core_fields']) {
        $coreChanged = $transactionDate !== $existingTransactionDate
            || $dueDate !== $existingDueDate
            || $entryType !== $existingEntryType
            || $description !== $existingDescription
            || abs($amount - $existingAmount) > 0.01
            || abs($rtaAmount - $existingRtaAmount) > 0.01
            || (int)($accountIdOrNull ?? 0) !== $existingAccountId;
        if ($coreChanged) {
            catn8_json_response(['success' => false, 'error' => 'Core fields for this ' . $editPolicy['source_label'] . ' transaction are read-only'], 403);
        }
    }

    if (!$editPolicy['can_edit_paid_state']) {
        $paidStateChanged = $isPaid !== $existingIsPaid || $paidDate !== $existingPaidDate;
        if ($paidStateChanged) {
            catn8_json_response(['success' => false, 'error' => 'Paid state for this ' . $editPolicy['source_label'] . ' transaction is read-only'], 403);
        }
    }

    if (!$editPolicy['can_edit_budget_planner'] && $isBudgetPlanner !== $existingIsBudgetPlanner) {
        catn8_json_response(['success' => false, 'error' => 'Budget planner state for this ' . $editPolicy['source_label'] . ' transaction is read-only'], 403);
    }

    if ($hasDebtor) {
        Database::execute(
            'UPDATE accumul8_transactions
             SET account_id = ?, entity_id = ?, balance_entity_id = ?, contact_id = ?, debtor_id = ?, transaction_date = ?, due_date = ?, entry_type = ?, description = ?,
                 memo = ?, amount = ?, rta_amount = ?, is_paid = ?, is_reconciled = ?, is_budget_planner = ?, paid_date = ?
             WHERE id = ? AND owner_user_id = ?',
            [
                $accountIdOrNull,
                $entityIdOrNull,
                $balanceEntityIdOrNull,
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
                $isBudgetPlanner,
                $paidDate,
                $id,
                $viewerId,
            ]
        );
    } else {
        Database::execute(
            'UPDATE accumul8_transactions
             SET account_id = ?, entity_id = ?, contact_id = ?, transaction_date = ?, due_date = ?, entry_type = ?, description = ?,
                 memo = ?, amount = ?, rta_amount = ?, is_paid = ?, is_reconciled = ?, is_budget_planner = ?, paid_date = ?
             WHERE id = ? AND owner_user_id = ?',
            [
                $accountIdOrNull,
                $entityIdOrNull,
                $contactIdOrNull,
                $transactionDate,
                $dueDate,
                $entryType,
                $description,
                $memo === '' ? null : $memo,
                $amount,
                $rtaAmount,
                $isPaid,
                $isReconciled,
                $isBudgetPlanner,
                $paidDate,
                $id,
                $viewerId,
            ]
        );
    }

    if (!$skipRecurringTemplateSync) {
        accumul8_sync_recurring_template_from_transaction($viewerId, $existingTx, [
            'recurring_payment_id' => isset($existingTx['recurring_payment_id']) ? (int)$existingTx['recurring_payment_id'] : 0,
            'source_kind' => $existingTx['source_kind'] ?? 'manual',
            'entity_id' => $entityIdOrNull,
            'contact_id' => $contactIdOrNull,
            'account_id' => $accountIdOrNull,
            'transaction_date' => $transactionDate,
            'due_date' => $dueDate,
            'paid_date' => $paidDate,
            'description' => $description,
            'memo' => $memo,
            'amount' => $amount,
            'is_paid' => $isPaid,
            'is_budget_planner' => $isBudgetPlanner,
        ]);
    }
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
    $existingTx = accumul8_get_transaction_row($viewerId, $id);
    if (!$existingTx) {
        catn8_json_response(['success' => false, 'error' => 'Transaction not found'], 404);
    }
    $editPolicy = accumul8_transaction_edit_policy($existingTx);
    if (!$editPolicy['can_edit_paid_state']) {
        catn8_json_response(['success' => false, 'error' => 'Paid state for this ' . $editPolicy['source_label'] . ' transaction is read-only'], 403);
    }

    Database::execute(
        'UPDATE accumul8_transactions
         SET is_paid = CASE WHEN is_paid = 1 THEN 0 ELSE 1 END,
             paid_date = CASE
                 WHEN is_paid = 1 THEN NULL
                 ELSE COALESCE(paid_date, due_date, transaction_date)
             END
         WHERE id = ? AND owner_user_id = ?',
        [$id, $viewerId]
    );

    $updatedTx = accumul8_get_transaction_row($viewerId, $id);
    if ($updatedTx) {
        accumul8_sync_recurring_template_from_transaction($viewerId, $existingTx, $updatedTx);
    }

    catn8_json_response(['success' => true]);
}

if ($action === 'toggle_transaction_reconciled') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);

    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    $existingTx = accumul8_get_transaction_row($viewerId, $id);
    if (!$existingTx) {
        catn8_json_response(['success' => false, 'error' => 'Transaction not found'], 404);
    }

    Database::execute(
        'UPDATE accumul8_transactions
         SET is_reconciled = CASE WHEN is_reconciled = 1 THEN 0 ELSE 1 END
         WHERE id = ? AND owner_user_id = ?',
        [$id, $viewerId]
    );

    catn8_json_response(['success' => true]);
}

if ($action === 'toggle_transaction_budget_planner') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    $existingTx = accumul8_get_transaction_row($viewerId, $id);
    if (!$existingTx) {
        catn8_json_response(['success' => false, 'error' => 'Transaction not found'], 404);
    }
    $editPolicy = accumul8_transaction_edit_policy($existingTx);
    if (!$editPolicy['can_edit_budget_planner']) {
        catn8_json_response(['success' => false, 'error' => 'Budget planner state for this ' . $editPolicy['source_label'] . ' transaction is read-only'], 403);
    }

    Database::execute(
        'UPDATE accumul8_transactions
         SET is_budget_planner = CASE
            WHEN COALESCE(debtor_id, 0) > 0 OR COALESCE(source_kind, "") = "teller" THEN 0
            WHEN is_budget_planner = 1 THEN 0
            ELSE 1
         END
         WHERE id = ? AND owner_user_id = ?',
        [$id, $viewerId]
    );

    $updatedTx = accumul8_get_transaction_row($viewerId, $id);
    if ($updatedTx) {
        accumul8_sync_recurring_template_from_transaction($viewerId, $existingTx, $updatedTx);
    }

    catn8_json_response(['success' => true]);
}

if ($action === 'delete_transaction') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    $existingTx = accumul8_get_transaction_row($viewerId, $id);
    if (!$existingTx) {
        catn8_json_response(['success' => false, 'error' => 'Transaction not found'], 404);
    }
    $editPolicy = accumul8_transaction_edit_policy($existingTx);
    if (!$editPolicy['can_delete']) {
        catn8_json_response(['success' => false, 'error' => ucfirst($editPolicy['source_label']) . ' transactions cannot be deleted here'], 403);
    }

    Database::execute('DELETE FROM accumul8_transactions WHERE id = ? AND owner_user_id = ?', [$id, $viewerId]);
    accumul8_recompute_running_balance($viewerId);
    catn8_json_response(['success' => true]);
}

if ($action === 'move_transactions_to_account') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $destinationAccountId = isset($body['account_id']) ? (int)$body['account_id'] : 0;
    if ($destinationAccountId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'A destination account is required'], 400);
    }
    $destinationAccountId = accumul8_require_owned_id('accounts', $viewerId, $destinationAccountId);

    $transactionIdsRaw = $body['transaction_ids'] ?? null;
    if (!is_array($transactionIdsRaw)) {
        catn8_json_response(['success' => false, 'error' => 'transaction_ids must be an array'], 400);
    }

    $transactionIds = [];
    foreach ($transactionIdsRaw as $value) {
        $id = (int)$value;
        if ($id > 0) {
            $transactionIds[] = $id;
        }
    }
    $transactionIds = array_values(array_unique($transactionIds));
    if ($transactionIds === []) {
        catn8_json_response(['success' => false, 'error' => 'Select at least one ledger row to move'], 400);
    }

    $placeholders = implode(',', array_fill(0, count($transactionIds), '?'));
    $rows = Database::queryAll(
        'SELECT id, account_id
         FROM accumul8_transactions
         WHERE owner_user_id = ?
           AND id IN (' . $placeholders . ')',
        array_merge([$viewerId], $transactionIds)
    );

    if (count($rows) !== count($transactionIds)) {
        catn8_json_response(['success' => false, 'error' => 'One or more selected transactions were not found'], 404);
    }

    $movedCount = 0;
    foreach ($rows as $row) {
        $transactionId = (int)($row['id'] ?? 0);
        $currentAccountId = isset($row['account_id']) ? (int)$row['account_id'] : 0;
        if ($transactionId <= 0 || $currentAccountId === $destinationAccountId) {
            continue;
        }
        Database::execute(
            'UPDATE accumul8_transactions
             SET account_id = ?
             WHERE id = ? AND owner_user_id = ?',
            [$destinationAccountId, $transactionId, $viewerId]
        );
        $movedCount++;
    }

    if ($movedCount > 0) {
        accumul8_recompute_running_balance($viewerId);
    }

    catn8_json_response([
        'success' => true,
        'moved_count' => $movedCount,
        'account_id' => $destinationAccountId,
    ]);
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

    try {
        $notificationResult = accumul8_send_notification_message($viewerId, $rule, $subject, $textBody);
    } catch (Throwable $exception) {
        $statusCode = $exception->getMessage() === 'No recipients available for this rule' ? 400 : 500;
        catn8_json_response(['success' => false, 'error' => $exception->getMessage()], $statusCode);
    }

    catn8_json_response([
        'success' => true,
        'sent_count' => (int)($notificationResult['sent_count'] ?? 0),
        'failed_count' => (int)($notificationResult['failed_count'] ?? 0),
        'sent' => $notificationResult['sent'] ?? [],
        'failed' => $notificationResult['failed'] ?? [],
    ]);
}

if ($action === 'upload_statement') {
    catn8_require_method('POST');

    if (!isset($_FILES['statement_file']) || !is_array($_FILES['statement_file'])) {
        catn8_json_response(['success' => false, 'error' => 'statement_file is required'], 400);
    }

    $file = $_FILES['statement_file'];
    $tmpName = (string)($file['tmp_name'] ?? '');
    $originalName = accumul8_normalize_text((string)($file['name'] ?? ''), 255);
    $mimeType = accumul8_normalize_text((string)($file['type'] ?? 'application/octet-stream'), 191);
    $sizeBytes = (int)($file['size'] ?? 0);
    $errorCode = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($errorCode !== UPLOAD_ERR_OK || $tmpName === '' || !is_uploaded_file($tmpName)) {
        catn8_json_response(['success' => false, 'error' => 'Upload failed'], 400);
    }
    if ($sizeBytes <= 0 || $sizeBytes > 15 * 1024 * 1024) {
        catn8_json_response(['success' => false, 'error' => 'Statement upload must be between 1 byte and 15 MB'], 400);
    }

    $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    if (!in_array($extension, ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif'], true)) {
        catn8_json_response(['success' => false, 'error' => 'Unsupported statement file type'], 400);
    }

    $bytes = @file_get_contents($tmpName);
    if (!is_string($bytes) || $bytes === '') {
        catn8_json_response(['success' => false, 'error' => 'Failed to read uploaded statement'], 500);
    }
    $fileSha256 = hash('sha256', $bytes);

    $duplicateUpload = accumul8_find_duplicate_statement_upload($viewerId, $fileSha256);
    if ($duplicateUpload !== null) {
        catn8_json_response([
            'success' => false,
            'error' => 'Upload canceled because this statement was already uploaded.',
            'duplicate' => true,
            'existing_upload' => $duplicateUpload,
        ], 409);
    }

    $statementKind = accumul8_statement_normalize_kind((string)($_POST['statement_kind'] ?? 'bank_account'));

    Database::execute(
        'INSERT INTO accumul8_statement_uploads
         (owner_user_id, account_id, statement_kind, status, original_filename, mime_type, file_size_bytes, file_sha256, file_blob)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $viewerId,
            null,
            $statementKind,
            'processing',
            $originalName !== '' ? $originalName : ('statement.' . $extension),
            $mimeType !== '' ? $mimeType : 'application/octet-stream',
            $sizeBytes,
            $fileSha256,
            $bytes,
        ]
    );
    $uploadId = (int)Database::lastInsertId();

    try {
        $row = accumul8_statement_scan_upload($viewerId, $uploadId, null, false);
        catn8_json_response(['success' => true, 'upload' => $row]);
    } catch (Throwable $e) {
        catn8_json_response([
            'success' => false,
            'error' => $e->getMessage(),
            'upload' => ['id' => $uploadId],
        ], 500);
    }
}

if ($action === 'rescan_statement_upload') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    try {
        if (isset($body['statement_kind']) || isset($body['account_name_hint']) || isset($body['account_last4'])) {
            accumul8_statement_update_metadata($viewerId, $id, [
                'statement_kind' => $body['statement_kind'] ?? null,
                'account_name_hint' => $body['account_name_hint'] ?? null,
                'account_last4' => $body['account_last4'] ?? null,
            ]);
        }
        $row = accumul8_statement_scan_upload($viewerId, $id, null, true);
        catn8_json_response(['success' => true, 'upload' => $row]);
    } catch (Throwable $e) {
        catn8_json_response(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($action === 'update_statement_upload_metadata') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    try {
        $row = accumul8_statement_update_metadata($viewerId, $id, [
            'statement_kind' => $body['statement_kind'] ?? null,
            'account_name_hint' => $body['account_name_hint'] ?? null,
            'account_last4' => $body['account_last4'] ?? null,
        ]);
        catn8_json_response(['success' => true, 'upload' => $row]);
    } catch (Throwable $e) {
        catn8_json_response(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($action === 'statement_ocr_diagnostics') {
    $uploadId = isset($_REQUEST['id']) ? (int)$_REQUEST['id'] : 0;
    $forceOcr = isset($_REQUEST['force_ocr']) && (int)$_REQUEST['force_ocr'] === 1;
    try {
        $result = accumul8_statement_ocr_diagnostics($viewerId, $uploadId > 0 ? $uploadId : null, $forceOcr);
        catn8_json_response(['success' => true] + $result);
    } catch (Throwable $e) {
        catn8_json_response(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($action === 'archive_statement_upload') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    try {
        $row = accumul8_statement_archive_upload($viewerId, $id, accumul8_statement_archive_section($body['archived_from_section'] ?? 'inbox'));
        catn8_json_response(['success' => true, 'upload' => $row]);
    } catch (Throwable $e) {
        catn8_json_response(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($action === 'restore_statement_upload') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    $archivedRow = Database::queryOne(
        'SELECT COALESCE(archived_from_section, "") AS archived_from_section
         FROM accumul8_statement_uploads
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$id, $viewerId]
    );
    try {
        $row = accumul8_statement_restore_upload($viewerId, $id);
        catn8_json_response([
            'success' => true,
            'upload' => $row,
            'restored_to_section' => accumul8_statement_archive_section($archivedRow['archived_from_section'] ?? 'library'),
        ]);
    } catch (Throwable $e) {
        catn8_json_response(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($action === 'delete_archived_statement_upload') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    try {
        accumul8_statement_delete_archived_upload($viewerId, $id);
        catn8_json_response(['success' => true, 'id' => $id]);
    } catch (Throwable $e) {
        catn8_json_response(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($action === 'confirm_statement_import') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    $options = [];
    if (isset($body['account_id']) && (int)$body['account_id'] > 0) {
        $options['account_id'] = accumul8_require_owned_id('accounts', $viewerId, (int)$body['account_id']);
    }
    if (isset($body['create_account']) && is_array($body['create_account'])) {
        $options['create_account'] = $body['create_account'];
    }
    try {
        $row = accumul8_statement_import_upload($viewerId, $actorUserId, $id, $options);
        catn8_json_response(['success' => true, 'upload' => $row, 'import_result' => $row['import_result'] ?? null]);
    } catch (Throwable $e) {
        catn8_json_response(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($action === 'reconcile_statement_upload') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    $options = [];
    if (isset($body['account_id']) && (int)$body['account_id'] > 0) {
        $options['account_id'] = accumul8_require_owned_id('accounts', $viewerId, (int)$body['account_id']);
    }
    if (isset($body['create_account']) && is_array($body['create_account'])) {
        $options['create_account'] = $body['create_account'];
    }
    try {
        $row = accumul8_statement_reconcile_upload($viewerId, $actorUserId, $id, $options);
        catn8_json_response(['success' => true, 'upload' => $row, 'reconciliation_runs' => $row['reconciliation_runs'] ?? []]);
    } catch (Throwable $e) {
        catn8_json_response(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($action === 'import_statement_review_row') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $uploadId = (int)($body['id'] ?? 0);
    $rowIndex = (int)($body['row_index'] ?? -1);
    if ($uploadId <= 0 || $rowIndex < 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid statement row'], 400);
    }
    $resolved = accumul8_statement_resolve_review_row($viewerId, $uploadId, $rowIndex, [
        'transaction_date' => $body['transaction_date'] ?? null,
        'description' => $body['description'] ?? null,
        'memo' => $body['memo'] ?? null,
        'amount' => $body['amount'] ?? null,
    ]);
    try {
        $accountId = accumul8_statement_resolve_target_account_id($viewerId, $resolved['upload'], $resolved['parsed'], [
            'account_id' => isset($body['account_id']) ? (int)$body['account_id'] : null,
            'create_account' => isset($body['create_account']) && is_array($body['create_account']) ? $body['create_account'] : null,
        ]);
        $transactionId = accumul8_statement_insert_transaction_row($viewerId, $actorUserId, $uploadId, $accountId, $resolved);
        accumul8_recompute_running_balance($viewerId);
        $upload = accumul8_statement_reload_view($viewerId, $uploadId);
        catn8_json_response([
            'success' => true,
            'transaction_id' => $transactionId,
            'upload' => $upload,
        ]);
    } catch (Throwable $e) {
        catn8_json_response(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($action === 'link_statement_review_row') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $uploadId = (int)($body['id'] ?? 0);
    $rowIndex = (int)($body['row_index'] ?? -1);
    $transactionId = (int)($body['transaction_id'] ?? 0);
    if ($uploadId <= 0 || $rowIndex < 0 || $transactionId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid statement row link'], 400);
    }
    $resolved = accumul8_statement_resolve_review_row($viewerId, $uploadId, $rowIndex);
    $existingTx = accumul8_get_transaction_row($viewerId, $transactionId);
    if (!$existingTx) {
        catn8_json_response(['success' => false, 'error' => 'Transaction not found'], 404);
    }
    try {
        Database::execute(
            'UPDATE accumul8_transactions
             SET source_kind = ?, source_ref = ?
             WHERE id = ? AND owner_user_id = ?',
            ['statement_upload', 'statement_upload:' . $uploadId, $transactionId, $viewerId]
        );
        accumul8_recompute_running_balance($viewerId);
        $upload = accumul8_statement_reload_view($viewerId, $uploadId);
        catn8_json_response([
            'success' => true,
            'upload' => $upload,
            'linked_transaction_id' => $transactionId,
            'row' => [
                'row_index' => $rowIndex,
                'transaction_date' => $resolved['transaction_date'],
                'description' => $resolved['description'],
                'amount' => $resolved['amount'],
            ],
        ]);
    } catch (Throwable $e) {
        catn8_json_response(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($action === 'search_statement_uploads') {
    catn8_require_method('GET');
    $query = accumul8_normalize_text((string)($_GET['q'] ?? ''), 120);
    catn8_json_response([
        'success' => true,
        'results' => accumul8_statement_search_uploads($viewerId, $query),
    ]);
}

if ($action === 'list_statement_audit_runs') {
    catn8_require_method('GET');
    $limit = max(1, min(50, (int)($_GET['limit'] ?? 10)));
    catn8_json_response([
        'success' => true,
        'runs' => accumul8_list_statement_audit_runs($viewerId, $limit),
    ]);
}

if ($action === 'audit_statement_uploads') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    try {
        $run = accumul8_statement_audit_uploads(
            $viewerId,
            $actorUserId,
            isset($body['start_date']) ? (string)$body['start_date'] : null,
            isset($body['end_date']) ? (string)$body['end_date'] : null,
            [
                'actor_user_id' => $actorUserId,
                'auto_catalog_missing' => !array_key_exists('auto_catalog_missing', $body) || !empty($body['auto_catalog_missing']),
                'auto_fix_ledger' => !array_key_exists('auto_fix_ledger', $body) || !empty($body['auto_fix_ledger']),
                'force_rescan' => !empty($body['force_rescan']),
            ]
        );
        catn8_json_response(['success' => true, 'run' => $run, 'runs' => accumul8_list_statement_audit_runs($viewerId, 10)]);
    } catch (Throwable $e) {
        catn8_json_response(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($action === 'audit_imported_transaction_cleanup') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $startDate = accumul8_normalize_text((string)($body['start_date'] ?? ''), 10);
    $endDate = accumul8_normalize_text((string)($body['end_date'] ?? ''), 10);
    $limit = (int)($body['limit'] ?? 500);
    try {
        catn8_json_response([
            'success' => true,
            'report' => accumul8_audit_imported_transaction_cleanup(
                $viewerId,
                $startDate !== '' ? accumul8_require_valid_date('start_date', $startDate) : null,
                $endDate !== '' ? accumul8_require_valid_date('end_date', $endDate) : null,
                $limit
            ),
        ]);
    } catch (Throwable $e) {
        catn8_json_response(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($action === 'purge_imported_transaction_cleanup') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $transactionIds = $body['transaction_ids'] ?? [];
    if (!is_array($transactionIds) || $transactionIds === []) {
        catn8_json_response(['success' => false, 'error' => 'transaction_ids is required'], 400);
    }
    $ids = array_values(array_unique(array_map(static fn($value): int => (int)$value, $transactionIds)));
    $ids = array_values(array_filter($ids, static fn(int $value): bool => $value > 0));
    if ($ids === []) {
        catn8_json_response(['success' => false, 'error' => 'No valid transaction ids were provided'], 400);
    }
    if (count($ids) > 2000) {
        catn8_json_response(['success' => false, 'error' => 'Too many transactions requested for purge'], 400);
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $rows = Database::queryAll(
        'SELECT id, source_kind, source_ref
         FROM accumul8_transactions
         WHERE owner_user_id = ?
           AND id IN (' . $placeholders . ')
           AND source_kind IN (?, ?)',
        array_merge([$viewerId], $ids, ['statement_upload', 'statement_pdf'])
    );
    if ($rows === []) {
        catn8_json_response(['success' => false, 'error' => 'No purgeable imported transactions were found'], 404);
    }

    $purgeIds = array_map(static fn(array $row): int => (int)($row['id'] ?? 0), $rows);
    $affectedUploadIds = [];
    foreach ($rows as $row) {
        $uploadId = accumul8_parse_statement_upload_id_from_source_ref((string)($row['source_ref'] ?? ''));
        if ($uploadId !== null && $uploadId > 0) {
            $affectedUploadIds[] = $uploadId;
        }
    }

    $deletedCount = accumul8_delete_transactions_by_ids($viewerId, $purgeIds);
    accumul8_refresh_statement_upload_import_counts($viewerId, $affectedUploadIds);
    accumul8_recompute_running_balance($viewerId);

    catn8_json_response([
        'success' => true,
        'deleted_count' => $deletedCount,
        'affected_upload_ids' => array_values(array_unique($affectedUploadIds)),
    ]);
}

if ($action === 'purge_all_imported_statement_transactions') {
    catn8_require_method('POST');
    $rows = Database::queryAll(
        'SELECT id, source_ref
         FROM accumul8_transactions
         WHERE owner_user_id = ?
           AND source_kind IN (?, ?)',
        [$viewerId, 'statement_upload', 'statement_pdf']
    );
    if ($rows === []) {
        catn8_json_response([
            'success' => true,
            'deleted_count' => 0,
            'affected_upload_ids' => [],
        ]);
    }

    $transactionIds = array_map(static fn(array $row): int => (int)($row['id'] ?? 0), $rows);
    $affectedUploadIds = [];
    foreach ($rows as $row) {
        $uploadId = accumul8_parse_statement_upload_id_from_source_ref((string)($row['source_ref'] ?? ''));
        if ($uploadId !== null && $uploadId > 0) {
            $affectedUploadIds[] = $uploadId;
        }
    }

    $deletedCount = accumul8_delete_transactions_by_ids($viewerId, $transactionIds);
    accumul8_refresh_statement_upload_import_counts($viewerId, $affectedUploadIds);
    accumul8_recompute_running_balance($viewerId);

    catn8_json_response([
        'success' => true,
        'deleted_count' => $deletedCount,
        'affected_upload_ids' => array_values(array_unique($affectedUploadIds)),
    ]);
}

if ($action === 'purge_all_statement_uploads') {
    catn8_require_method('POST');
    $linkedRow = Database::queryOne(
        'SELECT COUNT(*) AS linked_count
         FROM accumul8_transactions
         WHERE owner_user_id = ?
           AND source_kind IN (?, ?)',
        [$viewerId, 'statement_upload', 'statement_pdf']
    );
    if ((int)($linkedRow['linked_count'] ?? 0) > 0) {
        catn8_json_response(['success' => false, 'error' => 'Purge imported ledger rows before deleting statement files'], 409);
    }

    $rows = Database::queryAll(
        'SELECT id
         FROM accumul8_statement_uploads
         WHERE owner_user_id = ?',
        [$viewerId]
    );
    if ($rows === []) {
        catn8_json_response([
            'success' => true,
            'deleted_count' => 0,
        ]);
    }

    $uploadIds = array_map(static fn(array $row): int => (int)($row['id'] ?? 0), $rows);
    foreach ($uploadIds as $uploadId) {
        Database::execute(
            'DELETE FROM accumul8_statement_uploads
             WHERE id = ? AND owner_user_id = ?',
            [$uploadId, $viewerId]
        );
    }

    catn8_json_response([
        'success' => true,
        'deleted_count' => count($uploadIds),
    ]);
}

if ($action === 'download_statement_upload') {
    catn8_require_method('GET');
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }
    $row = Database::queryOne(
        'SELECT original_filename, mime_type, file_blob
         FROM accumul8_statement_uploads
         WHERE id = ? AND owner_user_id = ?
         LIMIT 1',
        [$id, $viewerId]
    );
    if (!$row) {
        catn8_json_response(['success' => false, 'error' => 'Statement upload not found'], 404);
    }
    header('Content-Type: ' . (string)($row['mime_type'] ?? 'application/octet-stream'));
    header('Content-Length: ' . strlen((string)($row['file_blob'] ?? '')));
    header('Content-Disposition: inline; filename="' . str_replace('"', '', (string)($row['original_filename'] ?? ('statement-' . $id))) . '"');
    header('Cache-Control: private, no-store, max-age=0');
    header('Pragma: no-cache');
    header('X-Content-Type-Options: nosniff');
    header("Content-Security-Policy: default-src 'none'; frame-ancestors 'self'; sandbox");
    echo (string)($row['file_blob'] ?? '');
    exit;
}

if ($action === 'teller_connect_token') {
    catn8_require_method('POST');
    $creds = accumul8_teller_credentials();
    if (($creds['application_id'] ?? '') === '') {
        catn8_json_response(['success' => false, 'error' => 'Teller application id is not configured'], 500);
    }

    catn8_json_response([
        'success' => true,
        'application_id' => (string)$creds['application_id'],
        'environment' => (string)$creds['env'],
    ]);
}

if ($action === 'teller_connect_diagnostic') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $source = accumul8_normalize_text($body['source'] ?? '', 64);
    $eventName = accumul8_normalize_text($body['event_name'] ?? '', 64);
    $institutionId = accumul8_normalize_text($body['institution_id'] ?? '', 64);
    $institutionName = accumul8_normalize_text($body['institution_name'] ?? '', 191);
    $enrollmentId = accumul8_normalize_text($body['enrollment_id'] ?? '', 191);
    $connectionId = (int)($body['connection_id'] ?? 0);
    $message = accumul8_normalize_text($body['message'] ?? '', 500);
    $meta = is_array($body['meta'] ?? null) ? $body['meta'] : [];

    $allowedEvents = [
        'open_requested',
        'init',
        'iframe_detected',
        'message',
        'success',
        'exit',
        'failure',
        'error',
        'enroll_success',
        'sync_success',
        'sync_error',
    ];
    if (!in_array($eventName, $allowedEvents, true)) {
        catn8_json_response(['success' => false, 'error' => 'Invalid event_name'], 400);
    }

    $watchedInstitution = accumul8_teller_is_watched_institution($institutionId, $institutionName);
    $ok = !in_array($eventName, ['exit', 'failure', 'error', 'sync_error'], true);
    accumul8_teller_log_diagnostic(
        'accumul8.teller.connect.' . $eventName,
        $ok,
        200,
        $message !== '' ? $message : 'Teller Connect diagnostic event',
        [
            'source' => $source,
            'institution_id' => $institutionId !== '' ? $institutionId : null,
            'institution_name' => $institutionName !== '' ? $institutionName : null,
            'enrollment_id' => $enrollmentId !== '' ? $enrollmentId : null,
            'connection_id' => $connectionId > 0 ? $connectionId : null,
            'watched_institution' => $watchedInstitution ? 1 : 0,
            'meta' => $meta,
        ]
    );

    catn8_json_response(['success' => true]);
}

if ($action === 'teller_enroll') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $accessToken = accumul8_normalize_text($body['access_token'] ?? '', 512);
    $enrollmentId = accumul8_normalize_text($body['enrollment_id'] ?? '', 191);
    $institutionId = accumul8_normalize_text($body['institution_id'] ?? '', 64);
    $institutionName = accumul8_normalize_text($body['institution_name'] ?? '', 191);
    $userId = accumul8_normalize_text($body['user_id'] ?? '', 191);

    if ($accessToken === '') {
        catn8_json_response(['success' => false, 'error' => 'access_token is required'], 400);
    }
    if ($enrollmentId === '') {
        catn8_json_response(['success' => false, 'error' => 'enrollment_id is required'], 400);
    }

    $watchedInstitution = accumul8_teller_is_watched_institution($institutionId, $institutionName);

    $secretKey = 'accumul8.teller.access_token.' . $viewerId . '.' . preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $enrollmentId);
    if (!secret_set($secretKey, $accessToken)) {
        accumul8_teller_log_diagnostic(
            'accumul8.teller.enroll',
            false,
            500,
            'Failed to persist Teller access token',
            [
                'institution_id' => $institutionId !== '' ? $institutionId : null,
                'institution_name' => $institutionName !== '' ? $institutionName : null,
                'enrollment_id' => $enrollmentId,
                'watched_institution' => $watchedInstitution ? 1 : 0,
            ]
        );
        catn8_json_response(['success' => false, 'error' => 'Failed to persist Teller access token'], 500);
    }

    $existing = Database::queryOne(
        'SELECT id
         FROM accumul8_bank_connections
         WHERE owner_user_id = ?
           AND provider_name = ?
           AND teller_enrollment_id = ?
         LIMIT 1',
        [$viewerId, 'teller', $enrollmentId]
    );

    if ($existing) {
        Database::execute(
            'UPDATE accumul8_bank_connections
             SET institution_id = ?, institution_name = ?, teller_enrollment_id = ?, teller_user_id = ?, teller_access_token_secret_key = ?, status = ?, updated_at = NOW()
             WHERE id = ? AND owner_user_id = ?',
            [$institutionId === '' ? null : $institutionId, $institutionName === '' ? null : $institutionName, $enrollmentId, $userId === '' ? null : $userId, $secretKey, 'connected', (int)$existing['id'], $viewerId]
        );
        $connectionId = (int)$existing['id'];
    } else {
        Database::execute(
            'INSERT INTO accumul8_bank_connections
                (owner_user_id, provider_name, institution_id, institution_name, teller_enrollment_id, teller_user_id, teller_access_token_secret_key, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [$viewerId, 'teller', $institutionId === '' ? null : $institutionId, $institutionName === '' ? null : $institutionName, $enrollmentId, $userId === '' ? null : $userId, $secretKey, 'connected']
        );
        $connectionId = (int)Database::lastInsertId();
    }

    accumul8_teller_log_diagnostic(
        'accumul8.teller.enroll',
        true,
        200,
        'Teller enrollment stored',
        [
            'connection_id' => $connectionId,
            'institution_id' => $institutionId !== '' ? $institutionId : null,
            'institution_name' => $institutionName !== '' ? $institutionName : null,
            'enrollment_id' => $enrollmentId,
            'watched_institution' => $watchedInstitution ? 1 : 0,
        ]
    );

    catn8_json_response([
        'success' => true,
        'connection_id' => $connectionId,
        'enrollment_id' => $enrollmentId,
    ]);
}

if ($action === 'teller_sync_transactions') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $connectionId = (int)($body['connection_id'] ?? 0);
    if ($connectionId <= 0) {
        catn8_json_response(['success' => false, 'error' => 'connection_id is required'], 400);
    }

    try {
        $result = accumul8_teller_sync_transactions_for_connection($viewerId, $actorUserId, $connectionId);
        catn8_json_response(array_merge(['success' => true], $result));
    } catch (Throwable $exception) {
        $statusCode = $exception->getMessage() === 'Connection not found' ? 404 : 500;
        catn8_json_response(['success' => false, 'error' => $exception->getMessage()], $statusCode);
    }
}

catn8_json_response(['success' => false, 'error' => 'Unknown action'], 400);
