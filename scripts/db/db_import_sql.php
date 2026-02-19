<?php

// db_import_sql.php - server-side SQL importer used by api/sync_db.php
// Security: This script is intended to be required by api/sync_db.php which performs token validation.
// Do not expose this script directly without a guard.

if (php_sapi_name() !== 'cli') {
    // When included via sync endpoint, continue. If accessed directly, block.
    if (!defined('CATN8_IMPORT_ALLOWED')) {
        http_response_code(403);
        echo 'Forbidden';
        exit;
    }
}

require_once dirname(__DIR__) . '/api/config.php'; // provides $dsn, $user, $pass, $options

try {
    // Use centralized singleton connection
    $pdo = Database::getInstance();
} catch (Exception $e) {
    http_response_code(500);
    echo 'DB connect failed: ' . $e->getMessage();
    exit;
}

$filename = $_GET['file'] ?? 'catn8_sync.sql';
// Optional filter: only execute statements that reference a specific table (by backticked name)
$filterTable = isset($_GET['filter_table']) ? trim($_GET['filter_table']) : '';
$filterMode = isset($_GET['filter_mode']) ? trim($_GET['filter_mode']) : 'any'; // 'any' or 'own'
$filterNeedle = '';
if ($filterTable !== '') {
    $filterNeedle = '`' . str_replace('`', '``', $filterTable) . '`';
}
$path = dirname(__DIR__) . DIRECTORY_SEPARATOR . $filename;
if (!is_file($path) || !is_readable($path)) {
    http_response_code(404);
    echo 'SQL file not found: ' . htmlspecialchars($filename);
    exit;
}

// Stream the SQL file and execute in batches
$handle = fopen($path, 'r');
if (!$handle) {
    http_response_code(500);
    echo 'Unable to open SQL file';
    exit;
}

$pdo->exec('SET FOREIGN_KEY_CHECKS=0');
$buffer = '';
$executed = 0;
$errors = 0;
$errorSamples = [];

function shouldExecute($sql)
{
    $trim = trim($sql);
    if ($trim === '') {
        return false;
    }
    if (str_starts_with($trim, '--') || str_starts_with($trim, '/*')) {
        return false;
    }
    return substr($trim, -1) === ';';
}

while (!feof($handle)) {
    $line = fgets($handle);
    if ($line === false) {
        break;
    }

    // Skip comments quickly
    $t = ltrim($line);
    if ($t === '' || str_starts_with($t, '--') || str_starts_with($t, '/*')) {
        continue;
    }

    $buffer .= $line;
    if (shouldExecute($buffer)) {
        $stmt = trim($buffer);
        // Remove trailing semicolon for exec
        if (substr($stmt, -1) === ';') {
            $stmt = substr($stmt, 0, -1);
        }
        // Apply optional table filter
        if ($filterNeedle !== '') {
            if ($filterMode === 'own') {
                $startsOwn = false;
                $trimStmt = ltrim($stmt);
                if (preg_match('/^DROP\s+TABLE\s+IF\s+EXISTS\s+`' . preg_quote($filterTable, '/') . '`/i', $trimStmt)) {
                    $startsOwn = true;
                }
                if (preg_match('/^CREATE\s+TABLE\s+`' . preg_quote($filterTable, '/') . '`\s*\(/i', $trimStmt)) {
                    $startsOwn = true;
                }
                if (preg_match('/^INSERT\s+INTO\s+`' . preg_quote($filterTable, '/') . '`/i', $trimStmt)) {
                    $startsOwn = true;
                }
                if (!$startsOwn) {
                    $buffer = '';
                    continue;
                }
            } else {
                if (stripos($stmt, $filterNeedle) === false) {
                    $buffer = '';
                    continue;
                }
            }
        }
        try {
            $pdo->exec($stmt);
            $executed++;
        } catch (Exception $e) {
            $errors++;
            if (count($errorSamples) < 5) {
                $errorSamples[] = [
                  'error' => $e->getMessage(),
                  'stmt_preview' => substr($stmt, 0, 240),
                ];
            }
            // For safety, continue importing remaining statements
        }
        $buffer = '';
    }
}

fclose($handle);
$pdo->exec('SET FOREIGN_KEY_CHECKS=1');

// When included from an API endpoint, optionally output JSON diagnostics
if (defined('CATN8_IMPORT_ALLOWED') && ($_GET['as_json'] ?? '') === '1') {
    header('Content-Type: application/json');
    echo json_encode([
      'ok' => true,
      'executed' => $executed,
      'errors' => $errors,
      'error_samples' => $errorSamples,
    ], JSON_UNESCAPED_SLASHES);
} else {
    echo 'Import complete.';
    if ($errors > 0) {
        echo " Errors: $errors";
    }
}
