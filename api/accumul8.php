<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/emailer.php';
require_once __DIR__ . '/settings/ai_test_functions.php';
require_once __DIR__ . '/../includes/accumul8_entity_normalization.php';
require_once __DIR__ . '/../includes/vertex_ai_gemini.php';

catn8_session_start();
catn8_groups_seed_core();
$actorUserId = catn8_require_group_or_admin('accumul8-users');

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
    return 20000;
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
                    'transactions',
                    'reconciliation_notes',
                    'account_match_hints',
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
                            ],
                        ],
                    ],
                    'reconciliation_notes' => [
                        'type' => 'array',
                        'items' => ['type' => 'string'],
                    ],
                    'account_match_hints' => [
                        'type' => 'array',
                        'items' => ['type' => 'string'],
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

function accumul8_statement_ai_result_is_suspicious(array $parsed, string $sourceText, string $filename): bool
{
    $sourceTextLower = strtolower($sourceText);
    $statementKind = strtolower(trim((string)($parsed['statement_kind'] ?? '')));
    $institutionName = strtolower(trim((string)($parsed['institution_name'] ?? '')));
    $accountNameHint = strtolower(trim((string)($parsed['account_name_hint'] ?? '')));
    $transactionCount = is_array($parsed['transactions'] ?? null) ? count($parsed['transactions']) : 0;

    $fileMonthHint = accumul8_statement_filename_month_hint($filename);
    $periodStart = accumul8_normalize_date((string)($parsed['period_start'] ?? ''));
    if ($fileMonthHint !== '' && $periodStart !== null && substr($periodStart, 0, 7) !== $fileMonthHint) {
        return true;
    }

    if ($transactionCount > 0 && strlen($sourceText) >= 8000 && $transactionCount < 10) {
        return true;
    }

    if ($statementKind === 'credit_card' && (str_contains($sourceTextLower, 'checking') || str_contains($sourceTextLower, 'savings'))) {
        return true;
    }

    if (($institutionName === '' || $institutionName === 'credit card') && str_contains($sourceTextLower, 'capital one 360')) {
        return true;
    }

    if (($accountNameHint === '' || $accountNameHint === 'unknown') && str_contains($sourceTextLower, 'checking')) {
        return true;
    }

    if ($transactionCount === 0 && accumul8_statement_text_looks_garbled($sourceText)) {
        return true;
    }

    return false;
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

function accumul8_statement_excerpt_text(string $text, int $maxLen = 4000): string
{
    return accumul8_statement_text_from_bytes($text, $maxLen);
}

function accumul8_statement_pdf_page_count(string $pdfPath): int
{
    if ($pdfPath === '' || !is_file($pdfPath) || !function_exists('shell_exec')) {
        return 0;
    }
    $bin = accumul8_statement_find_binary('pdfinfo', [
        '/usr/bin/pdfinfo',
        '/usr/local/bin/pdfinfo',
        '/opt/homebrew/bin/pdfinfo',
    ]);
    if ($bin === null) {
        return 0;
    }
    $cmd = escapeshellarg($bin) . ' ' . escapeshellarg($pdfPath) . ' 2>/dev/null';
    $out = (string)shell_exec($cmd);
    if (preg_match('/^Pages:\s+(\d+)/mi', $out, $matches)) {
        return max(0, (int)($matches[1] ?? 0));
    }
    return 0;
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
        $pageText = accumul8_statement_excerpt_text($pageText, 6000);
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
                $normalized = accumul8_statement_text_from_bytes($txt);
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

    return accumul8_statement_text_from_bytes(implode("\n", $chunks));
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
    return accumul8_statement_text_from_bytes($txt);
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
                'text_excerpt' => accumul8_statement_excerpt_text($chunk, 6000),
            ];
        }
        @unlink($pngPath);
        if (strlen(implode("\n", $chunks)) > 90000) {
            break;
        }
        $pageNumber++;
    }
    return [
        'text' => accumul8_statement_text_from_bytes(implode("\n\n", $chunks)),
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
        $pageCatalog = accumul8_statement_extract_pdf_page_catalog($tmpPath);
        $text = accumul8_statement_extract_pdf_text_from_path($tmpPath);
        $method = 'pdftotext';
        if ($text === '' || accumul8_statement_text_looks_garbled($text)) {
            $ocr = accumul8_statement_extract_pdf_text_with_ocr_fallback($tmpPath);
            $text = (string)($ocr['text'] ?? '');
            $pageCatalog = is_array($ocr['page_catalog'] ?? null) ? $ocr['page_catalog'] : $pageCatalog;
            $method = 'pdf_ocr';
        }
        return ['text' => $text, 'method' => $method, 'page_catalog' => $pageCatalog];
    }
    $text = accumul8_statement_extract_image_text_with_tesseract($tmpPath);
    return [
        'text' => $text,
        'method' => 'image_ocr',
        'page_catalog' => $text !== '' ? [['page_number' => 1, 'text_excerpt' => accumul8_statement_excerpt_text($text, 6000)]] : [],
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
        $text = accumul8_statement_excerpt_text((string)($page['text_excerpt'] ?? ''), 6000);
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

function accumul8_statement_ai_json_schema_prompt(string $mode): string
{
    $sourcePhrase = $mode === 'pdf'
        ? 'from the attached bank statement PDF'
        : 'from statement page images';
    return <<<TXT
You extract financial statement data into strict JSON {$sourcePhrase}.
Amounts must be signed exactly how they affect the account balance.
Return one JSON object only.
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
  "transactions": [
    {
      "transaction_date": "YYYY-MM-DD",
      "posted_date": "YYYY-MM-DD or empty",
      "description": "",
      "memo": "",
      "amount": number,
      "running_balance": number|null,
      "page_number": number|null
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

function accumul8_ai_generate_statement_json(string $text, array $accountCatalog, array $pageCatalog = []): array
{
    $cfg = catn8_settings_ai_get_config();
    $provider = strtolower(trim((string)($cfg['provider'] ?? 'openai')));
    $model = trim((string)($cfg['model'] ?? ''));
    $baseUrl = trim((string)($cfg['base_url'] ?? ''));
    $location = trim((string)($cfg['location'] ?? 'us-central1'));
    $temperature = (float)($cfg['temperature'] ?? 0.1);
    $accountsJson = json_encode($accountCatalog, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $truncatedText = accumul8_statement_text_from_bytes($text, 65000);

    $systemPrompt = <<<TXT
You extract financial statement data into strict JSON.
Amounts must be signed exactly how they affect the account balance.
Return one JSON object only.
Use the provided page catalog to set each transaction's page_number when the page can be identified with reasonable confidence.
If the page cannot be determined, return page_number as null.
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
  "transactions": [
    {
      "transaction_date": "YYYY-MM-DD",
      "posted_date": "YYYY-MM-DD or empty",
      "description": "",
      "memo": "",
      "amount": number,
      "running_balance": number|null,
      "page_number": number|null
    }
  ],
  "reconciliation_notes": [""],
  "account_match_hints": [""]
}
TXT;

    $pageCatalogPrompt = accumul8_statement_page_catalog_prompt($pageCatalog, 50000);
    $userPrompt = "Known accounts JSON:\n" . $accountsJson;
    if ($pageCatalogPrompt !== '') {
        $userPrompt .= "\n\nStatement page catalog:\n" . $pageCatalogPrompt;
    }
    $userPrompt .= "\n\nStatement OCR text:\n" . $truncatedText;

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
            'max_output_tokens' => 4096,
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

function accumul8_assign_entity_alias(int $viewerId, int $entityId, string $aliasName, bool $skipConflict = false): array
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

function accumul8_statement_pick_account_id(int $viewerId, array $statementJson, ?int $selectedAccountId = null): ?int
{
    if ($selectedAccountId !== null && $selectedAccountId > 0) {
        return accumul8_owned_id_or_null('accounts', $viewerId, $selectedAccountId);
    }
    $catalog = accumul8_statement_account_catalog($viewerId);
    $last4 = preg_replace('/\D+/', '', (string)($statementJson['account_last4'] ?? ''));
    $nameHint = strtolower(accumul8_normalize_text((string)($statementJson['account_name_hint'] ?? ''), 191));
    $institution = strtolower(accumul8_normalize_text((string)($statementJson['institution_name'] ?? ''), 191));
    $bestId = null;
    $bestScore = 0;
    foreach ($catalog as $account) {
        $score = 0;
        $accountName = strtolower((string)($account['account_name'] ?? ''));
        $orgName = strtolower((string)($account['banking_organization_name'] ?? ''));
        $instName = strtolower((string)($account['institution_name'] ?? ''));
        $maskLast4 = preg_replace('/\D+/', '', (string)($account['mask_last4'] ?? ''));
        if ($last4 !== '' && $maskLast4 !== '' && $last4 === $maskLast4) {
            $score += 5;
        }
        if ($nameHint !== '' && ($accountName !== '' && (str_contains($accountName, $nameHint) || str_contains($nameHint, $accountName)))) {
            $score += 3;
        }
        if ($institution !== '' && (($orgName !== '' && str_contains($orgName, $institution)) || ($instName !== '' && str_contains($instName, $institution)))) {
            $score += 2;
        }
        if ($score > $bestScore) {
            $bestScore = $score;
            $bestId = (int)($account['id'] ?? 0);
        }
    }
    return $bestScore >= 3 && $bestId > 0 ? $bestId : null;
}

function accumul8_statement_match_account(int $viewerId, array $statementJson, ?int $selectedAccountId = null): array
{
    if ($selectedAccountId !== null && $selectedAccountId > 0) {
        $forcedId = accumul8_owned_id_or_null('accounts', $viewerId, $selectedAccountId);
        return [
            'account_id' => $forcedId,
            'score' => $forcedId !== null ? 100 : 0,
            'reason' => $forcedId !== null ? 'User selected the import account.' : 'Selected account is unavailable.',
        ];
    }

    $catalog = accumul8_statement_account_catalog($viewerId);
    $last4 = preg_replace('/\D+/', '', (string)($statementJson['account_last4'] ?? ''));
    $nameHint = strtolower(accumul8_normalize_text((string)($statementJson['account_name_hint'] ?? ''), 191));
    $institution = strtolower(accumul8_normalize_text((string)($statementJson['institution_name'] ?? ''), 191));
    $bestId = null;
    $bestScore = 0;
    $reasonBits = [];

    foreach ($catalog as $account) {
        $score = 0;
        $bits = [];
        $accountName = strtolower((string)($account['account_name'] ?? ''));
        $orgName = strtolower((string)($account['banking_organization_name'] ?? ''));
        $instName = strtolower((string)($account['institution_name'] ?? ''));
        $maskLast4 = preg_replace('/\D+/', '', (string)($account['mask_last4'] ?? ''));
        if ($last4 !== '' && $maskLast4 !== '' && $last4 === $maskLast4) {
            $score += 5;
            $bits[] = 'last 4 matched';
        }
        if ($nameHint !== '' && ($accountName !== '' && (str_contains($accountName, $nameHint) || str_contains($nameHint, $accountName)))) {
            $score += 3;
            $bits[] = 'account name matched';
        }
        if ($institution !== '' && (($orgName !== '' && str_contains($orgName, $institution)) || ($instName !== '' && str_contains($instName, $institution)))) {
            $score += 2;
            $bits[] = 'institution matched';
        }
        if ($score > $bestScore) {
            $bestScore = $score;
            $bestId = (int)($account['id'] ?? 0);
            $reasonBits = $bits;
        }
    }

    return [
        'account_id' => $bestScore >= 3 && $bestId > 0 ? $bestId : null,
        'score' => $bestScore,
        'reason' => $bestScore > 0 ? implode(', ', $reasonBits) : 'No confident account match was detected.',
    ];
}

function accumul8_statement_catalog_payload(array $parsed, string $text): array
{
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
    foreach ((array)($parsed['transactions'] ?? []) as $tx) {
        if (!is_array($tx)) {
            continue;
        }
        $description = accumul8_normalize_text((string)($tx['description'] ?? ''), 80);
        if ($description !== '') {
            $keywords[] = $description;
        }
        if (count($keywords) >= 30) {
            break;
        }
    }

    $txCount = is_array($parsed['transactions'] ?? null) ? count((array)$parsed['transactions']) : 0;
    $summaryParts = [];
    if (accumul8_normalize_text((string)($parsed['institution_name'] ?? ''), 191) !== '') {
        $summaryParts[] = accumul8_normalize_text((string)($parsed['institution_name'] ?? ''), 191);
    }
    if (accumul8_normalize_text((string)($parsed['account_name_hint'] ?? ''), 191) !== '') {
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

function accumul8_statement_estimate_duplicates(int $viewerId, array $parsed, ?int $accountId): int
{
    if ($accountId === null || $accountId <= 0) {
        return 0;
    }
    $count = 0;
    foreach ((array)($parsed['transactions'] ?? []) as $tx) {
        if (!is_array($tx)) {
            continue;
        }
        $txDate = accumul8_normalize_date($tx['transaction_date'] ?? $tx['posted_date'] ?? '');
        $description = accumul8_normalize_text((string)($tx['description'] ?? ''), 255);
        if ($txDate === null || $description === '' || !is_numeric($tx['amount'] ?? null)) {
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
            [$viewerId, $accountId, $txDate, $amount, $description]
        );
        if ($duplicate) {
            $count++;
        }
    }
    return $count;
}

function accumul8_statement_build_plan(int $viewerId, array $upload, array $parsed): array
{
    $selectedAccountId = isset($upload['account_id']) ? (int)$upload['account_id'] : null;
    $match = accumul8_statement_match_account($viewerId, $parsed, $selectedAccountId);
    $accountId = isset($match['account_id']) ? (int)$match['account_id'] : 0;
    $accountRow = null;
    if ($accountId > 0) {
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
    foreach ((array)($parsed['transactions'] ?? []) as $tx) {
        $txCount++;
        if (!is_array($tx)) {
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

    $suggestedNewAccount = [
        'account_name' => accumul8_normalize_text((string)($parsed['account_name_hint'] ?? 'Imported statement account'), 191),
        'account_type' => accumul8_validate_account_type((string)($upload['statement_kind'] ?? 'checking')),
        'institution_name' => accumul8_normalize_text((string)($parsed['institution_name'] ?? ''), 191),
        'mask_last4' => accumul8_normalize_text((string)($parsed['account_last4'] ?? ''), 8),
    ];

    return [
        'suggested_account_id' => $accountId > 0 ? $accountId : null,
        'suggested_account_label' => $accountRow
            ? implode(' · ', array_values(array_filter([
                (string)($accountRow['banking_organization_name'] ?? ''),
                (string)($accountRow['account_name'] ?? ''),
                (string)($accountRow['mask_last4'] ?? '') !== '' ? '••' . (string)$accountRow['mask_last4'] : '',
            ])))
            : '',
        'account_match_score' => (int)($match['score'] ?? 0),
        'account_match_reason' => accumul8_normalize_text((string)($match['reason'] ?? ''), 255),
        'requires_account_confirmation' => $accountId <= 0 ? 1 : 0,
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
        notes TEXT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        is_budget_planner TINYINT(1) NOT NULL DEFAULT 0,
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
        import_result_json LONGTEXT NULL,
        last_error TEXT NULL,
        last_scanned_at DATETIME NULL,
        processed_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_accumul8_statement_owner (owner_user_id),
        KEY idx_accumul8_statement_account (account_id),
        KEY idx_accumul8_statement_status (status),
        CONSTRAINT fk_accumul8_statement_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_accumul8_statement_account FOREIGN KEY (account_id) REFERENCES accumul8_accounts(id) ON DELETE SET NULL
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
        accumul8_table_add_column_if_missing('accumul8_accounts', 'account_nickname', "VARCHAR(191) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_accounts', 'account_type', "VARCHAR(40) NOT NULL DEFAULT 'checking'");
        accumul8_table_add_column_if_missing('accumul8_accounts', 'account_subtype', "VARCHAR(64) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_accounts', 'institution_name', "VARCHAR(191) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_accounts', 'account_number_mask', "VARCHAR(32) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_accounts', 'mask_last4', "VARCHAR(8) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_accounts', 'routing_number', "VARCHAR(32) NOT NULL DEFAULT ''");
        accumul8_table_add_column_if_missing('accumul8_accounts', 'currency_code', "VARCHAR(3) NOT NULL DEFAULT 'USD'");
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
        if (!accumul8_table_has_foreign_key('accumul8_accounts', 'fk_accumul8_accounts_group')) {
            Database::execute('ALTER TABLE accumul8_accounts ADD CONSTRAINT fk_accumul8_accounts_group FOREIGN KEY (account_group_id) REFERENCES accumul8_account_groups(id) ON DELETE SET NULL');
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
        accumul8_table_add_column_if_missing('accumul8_recurring_payments', 'notes', 'TEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_recurring_payments', 'is_active', 'TINYINT(1) NOT NULL DEFAULT 1');
        accumul8_table_add_column_if_missing('accumul8_recurring_payments', 'is_budget_planner', 'TINYINT(1) NOT NULL DEFAULT 0');

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
                   AND source_kind IN ('plaid', 'statement_upload')"
            );
        }
        accumul8_table_add_column_if_missing('accumul8_transactions', 'external_id', 'VARCHAR(191) NULL');
        accumul8_table_add_column_if_missing('accumul8_transactions', 'pending_status', 'TINYINT(1) NOT NULL DEFAULT 0');
        accumul8_table_add_column_if_missing('accumul8_transactions', 'created_by_user_id', 'INT NOT NULL DEFAULT 0');

        accumul8_table_add_column_if_missing('accumul8_notification_rules', 'custom_user_ids_json', 'LONGTEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_notification_rules', 'last_triggered_at', 'DATETIME NULL');

        accumul8_table_add_column_if_missing('accumul8_bank_connections', 'institution_id', 'VARCHAR(64) NULL');
        accumul8_table_add_column_if_missing('accumul8_bank_connections', 'institution_name', 'VARCHAR(191) NULL');
        accumul8_table_add_column_if_missing('accumul8_bank_connections', 'status', "VARCHAR(32) NOT NULL DEFAULT 'setup_pending'");
        accumul8_table_add_column_if_missing('accumul8_bank_connections', 'last_sync_at', 'DATETIME NULL');
        accumul8_table_add_column_if_missing('accumul8_bank_connections', 'last_error', 'TEXT NULL');

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
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'import_result_json', 'LONGTEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'last_error', 'TEXT NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'last_scanned_at', 'DATETIME NULL');
        accumul8_table_add_column_if_missing('accumul8_statement_uploads', 'processed_at', 'DATETIME NULL');
        if (!accumul8_table_has_index('accumul8_statement_uploads', 'idx_accumul8_statement_account')) {
            Database::execute('ALTER TABLE accumul8_statement_uploads ADD INDEX idx_accumul8_statement_account (account_id)');
        }
        if (!accumul8_table_has_foreign_key('accumul8_statement_uploads', 'fk_accumul8_statement_account')) {
            Database::execute('ALTER TABLE accumul8_statement_uploads ADD CONSTRAINT fk_accumul8_statement_account FOREIGN KEY (account_id) REFERENCES accumul8_accounts(id) ON DELETE SET NULL');
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
                    WHEN ' . $sourceKindExpr . " = 'plaid' THEN 0
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
                ' . $dayOfMonthSelect . ', ' . $dayOfWeekSelect . ', rp.next_due_date, ' . $notesSelect . ', ' . $isActiveSelect . ', ' . $isBudgetPlannerSelect . ',
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
    $accountNicknameSelect = accumul8_optional_select('accumul8_accounts', 'account_nickname', 'a.account_nickname', "'' AS account_nickname");
    $accountTypeSelect = accumul8_optional_select('accumul8_accounts', 'account_type', 'a.account_type', "'checking' AS account_type");
    $accountSubtypeSelect = accumul8_optional_select('accumul8_accounts', 'account_subtype', 'a.account_subtype', "'' AS account_subtype");
    $institutionNameSelect = accumul8_optional_select('accumul8_accounts', 'institution_name', 'a.institution_name', "'' AS institution_name");
    $accountNumberMaskSelect = accumul8_optional_select('accumul8_accounts', 'account_number_mask', 'a.account_number_mask', "'' AS account_number_mask");
    $maskLast4Select = accumul8_optional_select('accumul8_accounts', 'mask_last4', 'a.mask_last4', "'' AS mask_last4");
    $routingNumberSelect = accumul8_optional_select('accumul8_accounts', 'routing_number', 'a.routing_number', "'' AS routing_number");
    $currencyCodeSelect = accumul8_optional_select('accumul8_accounts', 'currency_code', 'a.currency_code', "'USD' AS currency_code");
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
        'SELECT a.id, ' . $bankingOrganizationIdSelect . ', a.account_name, ' . $accountNicknameSelect . ', ' . $accountTypeSelect . ', ' . $accountSubtypeSelect . ', ' . $institutionNameSelect . ', ' . $accountNumberMaskSelect . ', ' . $maskLast4Select . ', ' . $routingNumberSelect . ', ' . $currencyCodeSelect . ', ' . $statementDaySelect . ', ' . $paymentDueDaySelect . ', ' . $autopayEnabledSelect . ', ' . $creditLimitSelect . ', ' . $interestRateSelect . ', ' . $minimumPaymentSelect . ', ' . $openedOnSelect . ', ' . $closedOnSelect . ', ' . $notesSelect . ',
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
        'SELECT t.id, t.account_id, ' . $bankingOrganizationIdSelect . ', ' . $entityIdSelect . ', COALESCE(e.display_name, "") AS entity_name, ' . $balanceEntityIdSelect . ', COALESCE(be.display_name, "") AS balance_entity_name, t.contact_id, ' . $debtorSelect . ', t.transaction_date, ' . $dueDateSelect . ', ' . $paidDateSelect . ', ' . $entryTypeSelect . ', t.description, ' . $memoSelect . ',
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
        return [
            'id' => (int)($r['id'] ?? 0),
            'account_id' => isset($r['account_id']) ? (int)$r['account_id'] : null,
            'banking_organization_id' => isset($r['account_group_id']) ? (int)$r['account_group_id'] : null,
            'entity_id' => isset($r['entity_id']) ? (int)$r['entity_id'] : null,
            'entity_name' => (string)($r['entity_name'] ?? ''),
            'balance_entity_id' => isset($r['balance_entity_id']) ? (int)$r['balance_entity_id'] : null,
            'balance_entity_name' => (string)($r['balance_entity_name'] ?? ''),
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
    $rows = Database::queryAll(
        'SELECT id, provider_name, ' . $institutionIdSelect . ', ' . $institutionNameSelect . ', plaid_item_id, ' . $statusSelect . ', ' . $lastSyncAtSelect . ', ' . $lastErrorSelect . '
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

function accumul8_statement_upload_view_model(int $viewerId, array $row): array
{
    $suspicious = json_decode((string)($row['suspicious_items_json'] ?? '[]'), true);
    $notes = json_decode((string)($row['processing_notes_json'] ?? '[]'), true);
    $locators = json_decode((string)($row['transaction_locator_json'] ?? '[]'), true);
    $pageCatalog = json_decode((string)($row['page_catalog_json'] ?? '[]'), true);
    $parsedPayload = json_decode((string)($row['parsed_payload_json'] ?? '{}'), true);
    $catalogKeywords = json_decode((string)($row['catalog_keywords_json'] ?? '[]'), true);
    $importResult = json_decode((string)($row['import_result_json'] ?? '{}'), true);
    if (!is_array($locators) || $locators === []) {
        $locators = is_array($parsedPayload) ? accumul8_statement_transaction_locators($parsedPayload) : [];
    }
    if (!is_array($pageCatalog)) {
        $pageCatalog = [];
    }
    $plan = is_array($parsedPayload) && $parsedPayload !== []
        ? accumul8_statement_build_plan($viewerId, $row, $parsedPayload)
        : null;

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
        'page_catalog' => $pageCatalog,
        'catalog_summary' => (string)($row['catalog_summary'] ?? ''),
        'catalog_keywords' => is_array($catalogKeywords) ? $catalogKeywords : [],
        'plan' => $plan,
        'import_result' => is_array($importResult) ? $importResult : null,
        'last_error' => (string)($row['last_error'] ?? ''),
        'last_scanned_at' => (string)($row['last_scanned_at'] ?? ''),
        'processed_at' => (string)($row['processed_at'] ?? ''),
        'created_at' => (string)($row['created_at'] ?? ''),
    ];
}

function accumul8_list_statement_uploads(int $viewerId): array
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
                COALESCE(su.import_result_json, "{}") AS import_result_json,
                COALESCE(su.last_error, "") AS last_error, su.last_scanned_at, su.processed_at, su.created_at,
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
         ORDER BY su.created_at DESC, su.id DESC
         LIMIT 200',
        [$viewerId]
    );

    return array_map(static fn(array $row): array => accumul8_statement_upload_view_model($viewerId, $row), $rows);
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
    if ($sourceKind === 'plaid') {
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
    $isImported = in_array($sourceKind, ['statement_upload', 'statement_pdf', 'plaid'], true);

    if ($isImported) {
        return [
            'source_kind' => $sourceKind,
            'source_label' => accumul8_transaction_source_label($sourceKind),
            'can_edit_core_fields' => false,
            'can_edit_paid_state' => false,
            'can_edit_budget_planner' => false,
            'can_delete' => false,
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

function accumul8_statement_transaction_locators(array $parsed): array
{
    $locators = [];
    foreach ((array)($parsed['transactions'] ?? []) as $tx) {
        if (!is_array($tx)) {
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
            'transaction_date' => $txDate,
            'description' => $description,
            'amount' => accumul8_normalize_amount($tx['amount']),
            'running_balance' => isset($tx['running_balance']) && is_numeric($tx['running_balance'])
                ? accumul8_normalize_amount($tx['running_balance'])
                : null,
            'page_number' => $pageNumber !== null && $pageNumber > 0 ? $pageNumber : null,
        ];
    }
    return $locators;
}

function accumul8_statement_reload_view(int $viewerId, int $uploadId): array
{
    foreach (accumul8_list_statement_uploads($viewerId) as $row) {
        if ((int)($row['id'] ?? 0) === $uploadId) {
            return $row;
        }
    }
    throw new RuntimeException('Statement upload could not be reloaded');
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

        if (str_contains($mimeType, 'pdf')) {
            $extract = accumul8_statement_extract_text_from_file($tmpPath, (string)($upload['mime_type'] ?? 'application/pdf'));
            $text = accumul8_statement_text_from_bytes((string)($extract['text'] ?? ''), 120000);
            $pageCatalog = is_array($extract['page_catalog'] ?? null) ? $extract['page_catalog'] : [];
            $scanErrors = [];

            if ($text !== '') {
                try {
                    $ai = accumul8_ai_generate_statement_json($text, $accountCatalog, $pageCatalog);
                    $parsedCandidate = is_array($ai['json'] ?? null) ? $ai['json'] : [];
                    if ($parsedCandidate !== [] && accumul8_statement_ai_result_is_suspicious($parsedCandidate, $text, (string)($upload['original_filename'] ?? ''))) {
                        $scanErrors[] = 'Text extraction path produced a suspicious statement parse';
                        $ai = null;
                    }
                } catch (Throwable $textAiError) {
                    $scanErrors[] = 'Text extraction path failed: ' . accumul8_normalize_text($textAiError->getMessage(), 250);
                }
            }

            if ($ai === null) {
                $renderedPages = accumul8_statement_render_pdf_pages_to_png($tmpPath);
                try {
                    if ($renderedPages !== []) {
                        $ai = accumul8_ai_generate_statement_json_from_images($renderedPages, $accountCatalog);
                        $text = accumul8_statement_text_from_bytes(json_encode($ai['json'] ?? [], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: 'AI image scan completed', 120000);
                        $extract['method'] = 'ai_pdf_images';
                        $pageCatalog = [];
                    }
                } catch (Throwable $imageAiError) {
                    $scanErrors[] = 'Rendered page AI scanning failed: ' . accumul8_normalize_text($imageAiError->getMessage(), 250);
                } finally {
                    accumul8_statement_cleanup_rendered_pages($renderedPages);
                }
            }

            if ($ai === null) {
                try {
                    $ai = accumul8_ai_generate_statement_json_from_pdf($tmpPath, $accountCatalog);
                    $text = accumul8_statement_text_from_bytes(json_encode($ai['json'] ?? [], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: 'AI PDF scan completed', 120000);
                    $extract['method'] = 'ai_pdf';
                    $pageCatalog = [];
                } catch (Throwable $pdfAiError) {
                    $scanErrors[] = 'Direct PDF AI scanning failed: ' . accumul8_normalize_text($pdfAiError->getMessage(), 250);
                }
            }

            if ($ai === null) {
                if ($text !== '') {
                    throw new RuntimeException('Could not generate a valid statement scan from the extracted PDF text or direct PDF AI scan: ' . implode(' | ', $scanErrors));
                }
                throw new RuntimeException('Could not extract readable text from the statement, and direct PDF AI scanning failed: ' . implode(' | ', $scanErrors));
            }
        } elseif (str_starts_with($mimeType, 'image/')) {
            try {
                $ai = accumul8_ai_generate_statement_json_from_images([['page_number' => 1, 'path' => $tmpPath]], $accountCatalog);
                $text = accumul8_statement_text_from_bytes(json_encode($ai['json'] ?? [], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: 'AI image scan completed', 120000);
                $extract['method'] = 'ai_image';
            } catch (Throwable $imageAiError) {
                $extract = accumul8_statement_extract_text_from_file($tmpPath, (string)($upload['mime_type'] ?? 'application/pdf'));
                $text = accumul8_statement_text_from_bytes((string)($extract['text'] ?? ''), 120000);
                $pageCatalog = is_array($extract['page_catalog'] ?? null) ? $extract['page_catalog'] : [];
                if ($text !== '') {
                    $ai = accumul8_ai_generate_statement_json($text, $accountCatalog, $pageCatalog);
                } else {
                    throw new RuntimeException('Could not extract readable text from the statement, and direct image AI scanning failed: ' . accumul8_normalize_text($imageAiError->getMessage(), 400));
                }
            }
        } else {
            $extract = accumul8_statement_extract_text_from_file($tmpPath, (string)($upload['mime_type'] ?? 'application/pdf'));
            $text = accumul8_statement_text_from_bytes((string)($extract['text'] ?? ''), 120000);
            $pageCatalog = is_array($extract['page_catalog'] ?? null) ? $extract['page_catalog'] : [];
            if ($text === '') {
                throw new RuntimeException('Could not extract readable text from the statement, and direct AI scanning is unavailable for this file type');
            }
            $ai = accumul8_ai_generate_statement_json($text, $accountCatalog, $pageCatalog);
        }
        $parsed = is_array($ai['json'] ?? null) ? $ai['json'] : [];
        $match = accumul8_statement_match_account($viewerId, $parsed, $selectedAccountId);
        $accountId = isset($match['account_id']) && (int)$match['account_id'] > 0 ? (int)$match['account_id'] : null;
        $transactionLocators = accumul8_statement_transaction_locators($parsed);
        $notes = [];
        foreach ((array)($parsed['account_match_hints'] ?? []) as $hint) {
            $hint = accumul8_normalize_text((string)$hint, 255);
            if ($hint !== '') {
                $notes[] = $hint;
            }
        }
        if ($accountId === null) {
            $notes[] = 'No confident account match was detected. Review the import plan before approving.';
        }
        $catalog = accumul8_statement_catalog_payload($parsed, $text);

        Database::execute(
            'UPDATE accumul8_statement_uploads
             SET account_id = ?, statement_kind = ?, status = ?, extracted_text = ?, extracted_method = ?, ai_provider = ?, ai_model = ?,
                 institution_name = ?, account_name_hint = ?, account_mask_last4 = ?,
                 period_start = ?, period_end = ?, opening_balance = ?, closing_balance = ?,
                 imported_transaction_count = ?, duplicate_transaction_count = ?, suspicious_item_count = ?,
                 reconciliation_status = ?, reconciliation_note = ?, suspicious_items_json = ?, processing_notes_json = ?, transaction_locator_json = ?, page_catalog_json = ?, parsed_payload_json = ?,
                 catalog_summary = ?, catalog_keywords_json = ?, import_result_json = NULL, last_error = NULL, last_scanned_at = NOW()
             WHERE id = ? AND owner_user_id = ?',
            [
                $accountId,
                accumul8_statement_normalize_kind($parsed['statement_kind'] ?? $upload['statement_kind'] ?? 'bank_account'),
                $markForReview ? 'needs_review' : 'scanned',
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
                'Scan complete. Review the proposed import plan before importing.',
                json_encode([], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                json_encode(array_values(array_unique($notes)), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                json_encode($transactionLocators, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                json_encode($pageCatalog, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                json_encode($parsed, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                (string)($catalog['summary'] ?? ''),
                json_encode($catalog['keywords'] ?? [], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
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
        accumul8_statement_scan_upload($viewerId, $uploadId, isset($options['account_id']) ? (int)$options['account_id'] : null, true);
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

    if (isset($options['create_account']) && is_array($options['create_account'])) {
        $accountId = accumul8_statement_create_account_from_plan($viewerId, (array)$options['create_account']);
    } elseif (isset($options['account_id']) && (int)$options['account_id'] > 0) {
        $accountId = accumul8_require_owned_id('accounts', $viewerId, (int)$options['account_id']);
    } else {
        $match = accumul8_statement_match_account($viewerId, $parsed, isset($upload['account_id']) ? (int)$upload['account_id'] : null);
        $accountId = isset($match['account_id']) ? (int)$match['account_id'] : null;
    }
    if ($accountId === null || $accountId <= 0) {
        throw new RuntimeException('Select an existing bank account or create a new one before importing');
    }

    $txRows = [];
    $duplicateRows = [];
    $failedRows = [];
    foreach ((array)($parsed['transactions'] ?? []) as $index => $tx) {
        if (!is_array($tx)) {
            $failedRows[] = ['index' => $index, 'reason' => 'Transaction entry was not valid JSON'];
            continue;
        }
        $txDate = accumul8_normalize_date($tx['transaction_date'] ?? $tx['posted_date'] ?? '');
        $description = accumul8_normalize_text((string)($tx['description'] ?? ''), 255);
        if ($txDate === null || $description === '' || !is_numeric($tx['amount'] ?? null)) {
            $failedRows[] = ['index' => $index, 'transaction_date' => accumul8_normalize_text((string)($tx['transaction_date'] ?? ''), 32), 'description' => $description, 'reason' => 'Missing date, description, or amount'];
            continue;
        }
        $amount = accumul8_normalize_amount($tx['amount']);
        $memo = accumul8_normalize_text((string)($tx['memo'] ?? ''), 2000);
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
            $duplicateRows[] = ['transaction_date' => $txDate, 'description' => $description, 'amount' => $amount, 'existing_transaction_id' => (int)($duplicate['id'] ?? 0)];
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
                'transaction_date' => $txDate,
                'description' => $description,
                'amount' => $amount,
                'entity_id' => $entityId,
                'running_balance' => isset($tx['running_balance']) && is_numeric($tx['running_balance']) ? accumul8_normalize_amount($tx['running_balance']) : null,
            ];
        } catch (Throwable $error) {
            $failedRows[] = ['index' => $index, 'transaction_date' => $txDate, 'description' => $description, 'amount' => $amount, 'reason' => accumul8_normalize_text($error->getMessage(), 255)];
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
            $accountId,
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
        foreach ((array)($parsed['transactions'] ?? []) as $tx) {
            if (!is_array($tx)) {
                continue;
            }
            $txText = strtolower(implode(' ', [(string)($tx['description'] ?? ''), (string)($tx['memo'] ?? ''), (string)($tx['transaction_date'] ?? '')]));
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
        $filters[] = "source_kind IN ('recurring', 'manual', 'plaid')";
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

try {
    accumul8_tables_ensure();
} catch (Throwable $e) {
    error_log('accumul8 schema ensure failed: ' . $e->getMessage());
}
$scopeOwnerUserId = accumul8_resolve_scope_owner_user_id($actorUserId);
try {
    accumul8_get_or_create_default_account($scopeOwnerUserId);
} catch (Throwable $e) {
    error_log('accumul8 default account ensure failed: ' . $e->getMessage());
}
$viewerId = $scopeOwnerUserId;

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
    $statementUploads = accumul8_bootstrap_section('statement_uploads', static fn() => accumul8_list_statement_uploads($viewerId), [], $warnings);
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
        'entity_endex_guides' => accumul8_entity_endex_guides(),
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
        'statement_uploads' => $statementUploads,
        'sync_provider' => [
            'provider' => 'plaid',
            'env' => accumul8_plaid_env(),
            'configured' => accumul8_plaid_is_configured() ? 1 : 0,
        ],
        'summary' => $summary,
        'warnings' => $warnings,
    ]);
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

    $result = accumul8_assign_entity_alias($viewerId, $entityId, $aliasName, false);
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

    Database::execute(
        'DELETE FROM accumul8_entity_aliases
         WHERE id = ? AND owner_user_id = ?',
        [$id, $viewerId]
    );
    catn8_json_response(['success' => true]);
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
    if ($id <= 0) {
        catn8_json_response(['success' => false, 'error' => 'Invalid id'], 400);
    }

    accumul8_require_owned_id('accounts', $viewerId, $id);

    if (accumul8_account_has_associations($viewerId, $id)) {
        catn8_json_response(['success' => false, 'error' => 'Cannot delete a bank account that has ledger or recurring records associated with it'], 409);
    }

    Database::execute('DELETE FROM accumul8_accounts WHERE id = ? AND owner_user_id = ?', [$id, $viewerId]);
    catn8_json_response(['success' => true]);
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
    accumul8_debtor_entity_id_or_create($viewerId, $debtorId);

    catn8_json_response(['success' => true, 'id' => $debtorId]);
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

    accumul8_debtor_entity_id_or_create($viewerId, $id);

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
    $notes = accumul8_normalize_text($body['notes'] ?? '', 1500);
    $isBudgetPlanner = accumul8_normalize_bool($body['is_budget_planner'] ?? 0);
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
            (owner_user_id, entity_id, contact_id, account_id, title, direction, amount, frequency, payment_method, interval_count, day_of_month, day_of_week, next_due_date, notes, is_active, is_budget_planner)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)',
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
    $notes = accumul8_normalize_text($body['notes'] ?? '', 1500);
    $isBudgetPlanner = accumul8_normalize_bool($body['is_budget_planner'] ?? 0);
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

    Database::execute(
        'UPDATE accumul8_recurring_payments
         SET entity_id = ?, contact_id = ?, account_id = ?, title = ?, direction = ?, amount = ?, frequency = ?, payment_method = ?, interval_count = ?,
             day_of_month = ?, day_of_week = ?, next_due_date = ?, notes = ?, is_budget_planner = ?
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
            $notes === '' ? null : $notes,
            $isBudgetPlanner,
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
    $created = accumul8_materialize_due_recurring_for_owner($viewerId, $actorUserId);
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
        : ($debtorIdOrNull !== null ? accumul8_debtor_entity_id_or_create($viewerId, (int)$debtorIdOrNull) : null);
    if ($requestedBalanceEntityIdOrNull !== null && $hasDebtor) {
        $debtorIdOrNull = accumul8_entity_debtor_id_or_null($viewerId, $requestedBalanceEntityIdOrNull);
    }
    if ($debtorIdOrNull !== null) {
        $isBudgetPlanner = 0;
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
        : ($debtorIdOrNull !== null ? accumul8_debtor_entity_id_or_create($viewerId, (int)$debtorIdOrNull) : null);
    if ($requestedBalanceEntityIdOrNull !== null && $hasDebtor) {
        $debtorIdOrNull = accumul8_entity_debtor_id_or_null($viewerId, $requestedBalanceEntityIdOrNull);
    }
    if ($debtorIdOrNull !== null) {
        $isBudgetPlanner = 0;
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
            WHEN COALESCE(debtor_id, 0) > 0 OR COALESCE(source_kind, "") = "plaid" THEN 0
            WHEN is_budget_planner = 1 THEN 0
            ELSE 1
         END
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

    $selectedAccountId = isset($_POST['account_id']) && $_POST['account_id'] !== ''
        ? accumul8_owned_id_or_null('accounts', $viewerId, (int)$_POST['account_id'])
        : null;
    $statementKind = accumul8_statement_normalize_kind((string)($_POST['statement_kind'] ?? 'bank_account'));

    Database::execute(
        'INSERT INTO accumul8_statement_uploads
         (owner_user_id, account_id, statement_kind, status, original_filename, mime_type, file_size_bytes, file_sha256, file_blob)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            $viewerId,
            $selectedAccountId,
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
        $row = accumul8_statement_scan_upload($viewerId, $uploadId, $selectedAccountId, false);
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
    $accountId = isset($body['account_id']) && (int)$body['account_id'] > 0
        ? accumul8_require_owned_id('accounts', $viewerId, (int)$body['account_id'])
        : null;
    try {
        $row = accumul8_statement_scan_upload($viewerId, $id, $accountId, true);
        catn8_json_response(['success' => true, 'upload' => $row]);
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

if ($action === 'search_statement_uploads') {
    catn8_require_method('GET');
    $query = accumul8_normalize_text((string)($_GET['q'] ?? ''), 120);
    catn8_json_response([
        'success' => true,
        'results' => accumul8_statement_search_uploads($viewerId, $query),
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
                     is_paid, is_reconciled, is_budget_planner, source_kind, source_ref, external_id, pending_status, paid_date, created_by_user_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
                    0,
                    'plaid',
                    (string)($connection['plaid_item_id'] ?? ''),
                    $externalId,
                    $pending,
                    $date,
                    $actorUserId,
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
