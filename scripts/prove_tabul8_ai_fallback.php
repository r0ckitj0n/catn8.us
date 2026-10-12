<?php

declare(strict_types=1);

/**
 * Prove Tabul8 OpenAI labeling falls back with no API key.
 * Does not print secrets. Safe to run with empty key (default).
 *
 * Usage: php scripts/prove_tabul8_ai_fallback.php
 */

require_once __DIR__ . '/../api/bootstrap.php';
require_once __DIR__ . '/../includes/tabul8_ai_label.php';
require_once __DIR__ . '/../includes/tabul8_model.php';
require_once __DIR__ . '/../includes/celebr8_agent_model.php';

$failures = 0;
$ok = static function (string $label, bool $pass, string $detail = '') use (&$failures): void {
    if ($pass) {
        echo "PASS  {$label}" . ($detail !== '' ? " — {$detail}" : '') . "\n";
        return;
    }
    $failures++;
    echo "FAIL  {$label}" . ($detail !== '' ? " — {$detail}" : '') . "\n";
};

$key = Tabul8AiLabel::getApiKey();
$ok('API key empty (Jon pastes later)', $key === '', $key === '' ? 'empty' : 'UNEXPECTED KEY PRESENT');

$pub = Tabul8AiLabel::getPublicSettings();
$encoded = json_encode($pub, JSON_UNESCAPED_SLASHES);
$ok('Public settings has_api_key=0', (int)($pub['has_api_key'] ?? 1) === 0);
$ok('Public settings never includes full key', is_string($encoded) && !preg_match('/sk-[A-Za-z0-9]/', $encoded));
$ok('Default model is gpt-4o-mini', ($pub['default_model'] ?? '') === 'gpt-4o-mini', (string)($pub['default_model'] ?? ''));
$ok('Default fallback is celebr8r', ($pub['fallback'] ?? '') === 'celebr8r');

$test = Tabul8AiLabel::testConnection();
$ok(
    'Test connection fails cleanly with no key',
    empty($test['ok']) && str_contains((string)($test['message'] ?? ''), 'No OpenAI API key'),
    (string)($test['message'] ?? '')
);
$ok('Test connection does not echo a key', !preg_match('/sk-[A-Za-z0-9]/', json_encode($test) ?: ''));

try {
// Temporarily enable AI + Celebr8r fallback, keep key empty, exercise labelEntry.
$prev = Tabul8AiLabel::getPublicSettings();
Tabul8AiLabel::saveSettings([
    'enabled' => 1,
    'auto_label_on_snap' => 1,
    'fallback' => 'celebr8r',
    'model' => 'gpt-4o-mini',
]);

// Prefer an existing board; otherwise create a throwaway board on party 1 if present.
$partyId = 1;
$ensured = Tabul8Model::ensureBoard($partyId);
$board = is_array($ensured['board'] ?? null) ? $ensured['board'] : $ensured;
$cats = is_array($ensured['categories'] ?? null)
    ? $ensured['categories']
    : Tabul8Model::listCategories((int)($board['id'] ?? 0));
$catId = $cats ? (int)$cats[0]['id'] : 0;
$ok('Have a category for dry-run entry', $catId > 0, 'cat_id=' . $catId);

$entryId = 0;
$queuedRequestId = null;
if ($catId > 0) {
    $entry = Tabul8Model::upsertEntry([
        'category_id' => $catId,
        'label' => '',
        'description' => '',
        'photo_id' => null,
    ], null, false);
    $entryId = (int)($entry['id'] ?? 0);
    $ok('Created unlabeled dry-run entry', $entryId > 0, 'entry_id=' . $entryId);

    $result = Tabul8AiLabel::labelEntry($entryId, null);
    $ok('Fallback source is celebr8r', ($result['source'] ?? '') === 'celebr8r', (string)($result['source'] ?? ''));
    $ok('Fallback error is no_api_key', ($result['error'] ?? '') === 'no_api_key', (string)($result['error'] ?? ''));
    $ok('Entry still unlabeled after fallback', trim((string)(($result['entry']['label'] ?? ''))) === '');

    $reqId = (int)(($result['entry']['label_request_id'] ?? 0));
    if ($reqId <= 0) {
        // queueLabelRequest may store request id on the entry row or only create agent request.
        $row = Tabul8Model::getEntry($entryId);
        $reqId = (int)($row['label_request_id'] ?? 0);
    }
    if ($reqId > 0) {
        $queuedRequestId = $reqId;
        $req = Celebr8AgentModel::getRequest($reqId);
        $ok(
            'Celebr8r request_type=tabul8_label queued',
            is_array($req) && (($req['request_type'] ?? $req['type'] ?? '') === 'tabul8_label'),
            'request_id=' . $reqId
        );
    } else {
        // Look up latest pending tabul8_label for this party.
        Celebr8AgentModel::ensureSchema();
        $latest = Database::queryOne(
            "SELECT id, request_type, type, status FROM celebr8_requests
             WHERE party_id = ? AND (request_type = 'tabul8_label' OR type = 'tabul8_label')
             ORDER BY id DESC LIMIT 1",
            [$partyId]
        );
        $ok(
            'Celebr8r tabul8_label request exists',
            is_array($latest),
            $latest ? ('request_id=' . $latest['id']) : 'none found'
        );
        if (is_array($latest)) {
            $queuedRequestId = (int)$latest['id'];
        }
    }
}

// Manual fallback path — use a fresh unlabeled entry (setEntryLabel rejects empty).
Tabul8AiLabel::saveSettings(['fallback' => 'manual', 'enabled' => 1]);
if ($catId > 0) {
    $manualEntry = Tabul8Model::upsertEntry([
        'category_id' => $catId,
        'label' => '',
        'description' => '',
        'photo_id' => null,
    ], null, false);
    $manualId = (int)($manualEntry['id'] ?? 0);
    $manual = Tabul8AiLabel::labelEntry($manualId, null);
    $ok('Manual fallback source', ($manual['source'] ?? '') === 'manual', (string)($manual['source'] ?? ''));
    $ok('Manual fallback error no_api_key', ($manual['error'] ?? '') === 'no_api_key', (string)($manual['error'] ?? ''));
    if ($manualId > 0) {
        Tabul8Model::deleteEntry($manualId);
    }
}

// Restore prior settings (AI off by default; keep key empty)
Tabul8AiLabel::saveSettings([
    'enabled' => (int)($prev['enabled'] ?? 0),
    'auto_label_on_snap' => (int)($prev['auto_label_on_snap'] ?? 1),
    'fallback' => (string)($prev['fallback'] ?? 'celebr8r'),
    'model' => (string)($prev['model'] ?? 'gpt-4o-mini'),
    'monthly_cap_usd' => (float)($prev['monthly_cap_usd'] ?? 10),
    'per_party_limit' => (int)($prev['per_party_limit'] ?? 80),
]);

// Cleanup dry-run entry + optional request so we don't litter party 1
if ($entryId > 0) {
    try {
        Tabul8Model::deleteEntry($entryId);
        echo "INFO  cleaned dry-run entry #{$entryId}\n";
    } catch (Throwable $e) {
        echo "INFO  could not delete dry-run entry #{$entryId}: " . $e->getMessage() . "\n";
    }
}
if ($queuedRequestId) {
    try {
        Celebr8AgentModel::setRequestStatus($queuedRequestId, 'done');
        echo "INFO  cancelled dry-run request #{$queuedRequestId}\n";
    } catch (Throwable $e) {
        // ignore
    }
}

$final = Tabul8AiLabel::getPublicSettings();
$ok('Key still empty after proof', (int)($final['has_api_key'] ?? 1) === 0);

} catch (Throwable $e) {
    $failures++;
    echo "FAIL  exception — " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}

echo $failures === 0 ? "\nALL PASS\n" : "\n{$failures} FAILURE(S)\n";
exit($failures === 0 ? 0 : 1);
