<?php

declare(strict_types=1);

require_once __DIR__ . '/api/bootstrap.php';

@set_time_limit(0);

$expectedToken = (string)catn8_env('CATN8_ADMIN_TOKEN', '');
$providedToken = (string)($_GET['admin_token'] ?? $_POST['admin_token'] ?? '');

function bwm_session_admin(): bool
{
    catn8_session_start();
    $uid = catn8_auth_user_id();
    if ($uid === null || $uid <= 0) {
        return false;
    }
    return catn8_user_is_admin($uid);
}

$tokenAuthorized = $expectedToken !== '' && $providedToken !== '' && hash_equals($expectedToken, $providedToken);
$sessionAuthorized = bwm_session_admin();
$authorized = $tokenAuthorized || $sessionAuthorized;
$effectiveToken = $tokenAuthorized ? $providedToken : $expectedToken;

$status = 'idle';
$message = '';
$details = [];

function bwm_open_input_stream(string $path): array
{
    if (!is_file($path) || !is_readable($path)) {
        return ['type' => 'none', 'handle' => null];
    }
    if (str_ends_with($path, '.gz')) {
        $h = gzopen($path, 'rb');
        return ['type' => 'gz', 'handle' => $h];
    }
    $h = fopen($path, 'rb');
    return ['type' => 'plain', 'handle' => $h];
}

function bwm_read_chunk(array $stream, int $len): string
{
    $h = $stream['handle'] ?? null;
    if (!$h) {
        return '';
    }
    if (($stream['type'] ?? '') === 'gz') {
        $s = gzread($h, $len);
        return is_string($s) ? $s : '';
    }
    $s = fread($h, $len);
    return is_string($s) ? $s : '';
}

function bwm_close_stream(array $stream): void
{
    $h = $stream['handle'] ?? null;
    if (!$h) {
        return;
    }
    if (($stream['type'] ?? '') === 'gz') {
        @gzclose($h);
        return;
    }
    @fclose($h);
}

function bwm_stream_sql_into_pdo(PDO $pdo, array $stream): int
{
    $stmt = '';
    $executed = 0;

    $inSingle = false;
    $inDouble = false;
    $inBacktick = false;
    $inLineComment = false;
    $inBlockComment = false;

    $execStmt = static function (PDO $pdo, string $sql) use (&$executed): void {
        $sql = trim($sql);
        if ($sql === '') {
            return;
        }
        $pdo->exec($sql);
        $executed++;
    };

    while (true) {
        $chunk = bwm_read_chunk($stream, 1024 * 1024);
        if ($chunk === '') {
            break;
        }

        $len = strlen($chunk);
        for ($i = 0; $i < $len; $i++) {
            $c = $chunk[$i];
            $n = $i + 1 < $len ? $chunk[$i + 1] : '';

            if ($inLineComment) {
                if ($c === "\n") {
                    $inLineComment = false;
                }
                $stmt .= $c;
                continue;
            }

            if ($inBlockComment) {
                if ($c === '*' && $n === '/') {
                    $inBlockComment = false;
                    $stmt .= '*/';
                    $i++;
                    continue;
                }
                $stmt .= $c;
                continue;
            }

            if (!$inSingle && !$inDouble && !$inBacktick) {
                if ($c === '-' && $n === '-') {
                    $inLineComment = true;
                    $stmt .= $c;
                    continue;
                }
                if ($c === '#') {
                    $inLineComment = true;
                    $stmt .= $c;
                    continue;
                }
                if ($c === '/' && $n === '*') {
                    $inBlockComment = true;
                    $stmt .= '/*';
                    $i++;
                    continue;
                }
            }

            if ($c === "'" && !$inDouble && !$inBacktick) {
                $prev = $i > 0 ? $chunk[$i - 1] : '';
                if ($prev !== '\\') {
                    $inSingle = !$inSingle;
                }
                $stmt .= $c;
                continue;
            }
            if ($c === '"' && !$inSingle && !$inBacktick) {
                $prev = $i > 0 ? $chunk[$i - 1] : '';
                if ($prev !== '\\') {
                    $inDouble = !$inDouble;
                }
                $stmt .= $c;
                continue;
            }
            if ($c === '`' && !$inSingle && !$inDouble) {
                $inBacktick = !$inBacktick;
                $stmt .= $c;
                continue;
            }

            if ($c === ';' && !$inSingle && !$inDouble && !$inBacktick) {
                $stmt .= $c;
                $execStmt($pdo, $stmt);
                $stmt = '';
                continue;
            }

            $stmt .= $c;
        }
    }

    if (trim($stmt) !== '') {
        $execStmt($pdo, $stmt);
    }

    return $executed;
}

$uploadsDir = __DIR__ . '/api/uploads';
if (!is_dir($uploadsDir)) {
    @mkdir($uploadsDir, 0777, true);
}

$allowedExt = ['sql', 'txt', 'gz'];
$prefix = 'build_wizard_merge_';

$files = [];
if (is_dir($uploadsDir)) {
    $dh = opendir($uploadsDir);
    if ($dh !== false) {
        while (($entry = readdir($dh)) !== false) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            if (!str_starts_with($entry, $prefix)) {
                continue;
            }
            $ext = strtolower((string)pathinfo($entry, PATHINFO_EXTENSION));
            if (!in_array($ext, $allowedExt, true)) {
                continue;
            }
            $full = $uploadsDir . '/' . $entry;
            if (!is_file($full)) {
                continue;
            }
            $files[] = [
                'name' => $entry,
                'path' => $full,
                'size' => (int)filesize($full),
                'mtime' => (int)filemtime($full),
            ];
        }
        closedir($dh);
    }
}

usort($files, static fn(array $a, array $b): int => ($b['mtime'] <=> $a['mtime']));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!$authorized) {
        $status = 'error';
        $message = 'Invalid admin token.';
    } else {
        $confirmed = (string)($_POST['confirm_merge'] ?? '') === 'yes';
        if (!$confirmed) {
            $status = 'error';
            $message = 'You must confirm before running the merge import.';
        } else {
            $targetBasename = '';

            $uploaded = $_FILES['merge_file'] ?? null;
            if (is_array($uploaded) && (int)($uploaded['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
                $err = (int)($uploaded['error'] ?? UPLOAD_ERR_NO_FILE);
                if ($err !== UPLOAD_ERR_OK) {
                    $status = 'error';
                    $message = 'Upload failed with error code ' . $err . '.';
                } else {
                    $tmp = (string)($uploaded['tmp_name'] ?? '');
                    $orig = trim((string)($uploaded['name'] ?? ''));
                    if ($tmp === '' || !is_uploaded_file($tmp) || $orig === '') {
                        $status = 'error';
                        $message = 'Uploaded file was invalid.';
                    } else {
                        $safe = preg_replace('/[^A-Za-z0-9._-]+/', '_', $orig);
                        if (!is_string($safe) || $safe === '') {
                            $safe = 'merge.sql';
                        }
                        if (!str_starts_with($safe, $prefix)) {
                            $safe = $prefix . $safe;
                        }
                        $ext = strtolower((string)pathinfo($safe, PATHINFO_EXTENSION));
                        if (!in_array($ext, $allowedExt, true)) {
                            $status = 'error';
                            $message = 'Uploaded file extension must be .sql, .txt, or .gz';
                        } else {
                            $finalName = $prefix . gmdate('Ymd_His') . '_' . $safe;
                            $dest = $uploadsDir . '/' . $finalName;
                            if (!move_uploaded_file($tmp, $dest)) {
                                $status = 'error';
                                $message = 'Failed to move uploaded file into api/uploads.';
                            } else {
                                $targetBasename = $finalName;
                            }
                        }
                    }
                }
            }

            if ($status !== 'error' && $targetBasename === '') {
                $selected = trim((string)($_POST['existing_file'] ?? ''));
                $selectedBase = basename($selected);
                if ($selectedBase === '' || !str_starts_with($selectedBase, $prefix)) {
                    $status = 'error';
                    $message = 'Select an existing merge file or upload one.';
                } else {
                    $ext = strtolower((string)pathinfo($selectedBase, PATHINFO_EXTENSION));
                    $path = $uploadsDir . '/' . $selectedBase;
                    if (!in_array($ext, $allowedExt, true) || !is_file($path)) {
                        $status = 'error';
                        $message = 'Selected merge file is invalid or missing.';
                    } else {
                        $targetBasename = $selectedBase;
                    }
                }
            }

            if ($status !== 'error' && $targetBasename !== '') {
                $path = $uploadsDir . '/' . $targetBasename;
                if (!is_file($path) || !is_readable($path)) {
                    $status = 'error';
                    $message = 'Selected SQL file is missing or unreadable.';
                } else {
                    try {
                        $pdo = Database::getInstance();
                        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                        $pdo->beginTransaction();
                        $pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
                        $pdo->exec("SET collation_connection = 'utf8mb4_unicode_ci'");
                        $pdo->exec('SET FOREIGN_KEY_CHECKS=0');

                        $stream = bwm_open_input_stream($path);
                        if (!$stream['handle']) {
                            throw new RuntimeException('Failed to open SQL stream.');
                        }

                        $executed = bwm_stream_sql_into_pdo($pdo, $stream);
                        bwm_close_stream($stream);

                        $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
                        $pdo->commit();

                        $status = 'success';
                        $message = 'Merge import completed successfully.';
                        $details = [
                            'file' => 'api/uploads/' . $targetBasename,
                            'sql_statements_executed' => $executed,
                        ];
                    } catch (Throwable $e) {
                        if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
                            $pdo->rollBack();
                        }
                        $status = 'error';
                        $message = 'Merge import failed.';
                        $details = [
                            'file' => 'api/uploads/' . $targetBasename,
                            'error' => $e->getMessage(),
                        ];
                    }
                }
            }
        }
    }
}

function h(string $v): string
{
    return htmlspecialchars($v, ENT_QUOTES, 'UTF-8');
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Build Wizard Live Merge</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 2rem auto; max-width: 980px; padding: 0 1rem; }
    .card { border: 1px solid #ddd; border-radius: 10px; padding: 1rem; margin-bottom: 1rem; }
    .ok { border-color: #2f855a; background: #f0fff4; }
    .err { border-color: #c53030; background: #fff5f5; }
    .muted { color: #666; }
    code, pre { background: #f6f8fa; border-radius: 6px; }
    pre { padding: 0.75rem; overflow: auto; }
    label { display: block; margin-top: 0.75rem; font-weight: 600; }
    input[type="text"], select, input[type="file"] { width: 100%; margin-top: 0.35rem; }
    button { margin-top: 1rem; padding: 0.6rem 1rem; cursor: pointer; }
  </style>
</head>
<body>
  <h1>Build Wizard Live Merge</h1>
  <p class="muted">Uploads/uses a <code>build_wizard_merge_*.sql|.txt|.gz</code> file and runs a merge-only import into the live DB.</p>

  <?php if (!$authorized): ?>
    <div class="card err">
      <strong>Unauthorized</strong>
      <p>Either log in as an admin user, or open this page with a valid admin token:</p>
      <pre>?admin_token=YOUR_ADMIN_TOKEN</pre>
    </div>
  <?php else: ?>
    <?php if ($status === 'success'): ?>
      <div class="card ok">
        <strong><?= h($message) ?></strong>
      </div>
    <?php elseif ($status === 'error'): ?>
      <div class="card err">
        <strong><?= h($message) ?></strong>
      </div>
    <?php endif; ?>

    <?php if (!empty($details)): ?>
      <div class="card">
        <h2>Run Details</h2>
        <pre><?= h((string)json_encode($details, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)) ?></pre>
      </div>
    <?php endif; ?>

    <div class="card">
      <h2>Run Merge Import</h2>
      <form method="post" enctype="multipart/form-data">
        <input type="hidden" name="admin_token" value="<?= h($providedToken) ?>">

        <label for="existing_file">Existing merge file on server (optional if uploading)</label>
        <select id="existing_file" name="existing_file">
          <option value="">-- Select existing file --</option>
          <?php foreach ($files as $f): ?>
            <option value="<?= h((string)$f['name']) ?>">
              <?= h((string)$f['name']) ?> (<?= h(number_format((int)$f['size'])) ?> bytes, <?= h(gmdate('Y-m-d H:i:s', (int)$f['mtime'])) ?> UTC)
            </option>
          <?php endforeach; ?>
        </select>

        <label for="merge_file">Or upload merge SQL file</label>
        <input id="merge_file" name="merge_file" type="file" accept=".sql,.txt,.gz">

        <label>
          <input type="checkbox" name="confirm_merge" value="yes"> I confirm this should run a live merge import now.
        </label>

        <button type="submit">Run Merge Import</button>
      </form>
    </div>
  <?php endif; ?>
</body>
</html>
