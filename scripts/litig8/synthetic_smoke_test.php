<?php

declare(strict_types=1);

/**
 * Synthetic-only Litig8 smoke test. No real case data.
 * Does not rotate the live agent token.
 * Usage: php scripts/litig8/synthetic_smoke_test.php
 */

require_once dirname(__DIR__, 2) . '/api/bootstrap.php';
require_once dirname(__DIR__, 2) . '/includes/litig8_model.php';

function assert_true(bool $cond, string $msg): void
{
    if (!$cond) {
        throw new RuntimeException('ASSERT FAIL: ' . $msg);
    }
}

Litig8Model::ensureSchema();

$admin = Database::queryOne('SELECT id FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1');
assert_true((bool)$admin, 'admin user exists');
$adminUid = (int)$admin['id'];

$sourcesBefore = (int)(Database::queryOne('SELECT COUNT(*) AS c FROM litig8_sources')['c'] ?? 0);

$dry = Litig8Model::importBatch('matters', [[
    'external_source_id' => 'synthetic:matter:dry-run',
    'title' => 'Dry run matter (synthetic)',
    'category' => 'disputes',
    'status' => 'open',
    'source' => [
        'source_type' => 'manual',
        'record_type' => 'matters',
        'record_id' => 'dry-run-' . bin2hex(random_bytes(4)),
    ],
]], $adminUid, true, 'agent:litig8-test');
assert_true($dry['dry_run'] === true && $dry['created'] === 1, 'dry_run create preview');
$sourcesAfterDry = (int)(Database::queryOne('SELECT COUNT(*) AS c FROM litig8_sources')['c'] ?? 0);
assert_true($sourcesAfterDry === $sourcesBefore, 'dry_run wrote no sources');
$dryRow = Database::queryOne("SELECT id FROM litig8_matters WHERE external_source_id = 'synthetic:matter:dry-run'");
assert_true(!$dryRow, 'dry_run wrote no matter row');

$import = Litig8Model::importBatch('matters', [[
    'external_source_id' => 'synthetic:matter:cabin-1',
    'title' => 'Cabin shed permit (synthetic)',
    'category' => 'cabin permits/zoning',
    'status' => 'open',
    'case_number' => 'CASE-SYN-001',
    'claim_number' => 'CLM-SYN-001',
    'summary' => 'Synthetic zoning matter.',
    'key_dates' => [
        ['date' => '2026-08-01', 'title' => 'Application filed (synthetic)'],
    ],
    'deadlines' => [
        ['due_at' => '2026-11-01T17:00:00', 'title' => 'Hearing response due (synthetic)', 'status' => 'open'],
        ['due_at' => '2026-01-01T09:00:00', 'title' => 'Overdue filing (synthetic)', 'status' => 'open'],
    ],
    'parties' => [
        ['name' => 'Synthetic Opposing LLC', 'role' => 'opposing', 'contact_type' => 'opposing'],
    ],
    'attorneys' => [
        ['name' => 'Ada Counsel (synthetic)', 'role' => 'counsel', 'organization' => 'Counsel & Co'],
    ],
    'source' => [
        'source_type' => 'manual',
        'record_type' => 'matters',
        'record_id' => 'cabin-1',
        'message_date' => '2026-08-01',
    ],
]], $adminUid, false, 'agent:litig8-test');
assert_true($import['error_count'] === 0, 'matter import errors');
assert_true(($import['created'] + $import['updated']) === 1, 'matter upsert count');
$matterId = (int)($import['results'][0]['id'] ?? 0);
assert_true($matterId > 0, 'matter id');

$again = Litig8Model::importBatch('matters', [[
    'external_source_id' => 'synthetic:matter:cabin-1',
    'title' => 'Cabin shed permit (synthetic)',
    'category' => 'cabin-permits-zoning',
    'status' => 'open',
    'summary' => 'Synthetic zoning matter updated.',
]], $adminUid, false, 'agent:litig8-test');
assert_true($again['updated'] === 1 && $again['created'] === 0, 'idempotent matter update');

$events = Litig8Model::listEntityPage('events', $adminUid, $matterId, 50, 0);
assert_true($events['total'] >= 1, 'nested events created');
$deadlines = Litig8Model::listEntityPage('deadlines', $adminUid, $matterId, 50, 0);
assert_true($deadlines['total'] >= 2, 'nested deadlines created');

$tmp = tempnam(sys_get_temp_dir(), 'l8doc');
file_put_contents($tmp, 'synthetic litig8 document body');
$upload = Litig8Model::storeUploadedDocument([
    'tmp_name' => $tmp,
    'name' => 'synthetic-pleading.txt',
    'type' => 'text/plain',
], [
    'owner_user_id' => $adminUid,
    'title' => 'Synthetic pleading',
    'doc_type' => 'pleading',
    'external_source_id' => 'synthetic:doc:pleading-1',
    'source' => ['source_type' => 'manual', 'record_type' => 'documents', 'record_id' => 'pleading-1'],
    'links' => [['entity' => 'matters', 'record_id' => $matterId, 'role' => 'pleading']],
], $adminUid, 'agent:litig8-test');
assert_true(!empty($upload['id']), 'document upload id');
$docId = (int)$upload['id'];

$linkDry = Litig8Model::linkDocument($docId, 'events', (int)$events['records'][0]['id'], 'exhibit', null, $adminUid, 'agent:litig8-test', true);
assert_true(!empty($linkDry['dry_run']), 'link dry_run');

$matterGet = Litig8Model::getEntity('matters', $matterId, $adminUid, false);
assert_true(is_array($matterGet), 'get matter');
assert_true(!empty($matterGet['case_number_masked']) || !empty($matterGet['case_number_present']), 'case number masked');
assert_true(empty($matterGet['case_number']) || str_contains((string)$matterGet['case_number'], '*') || isset($matterGet['case_number_masked']), 'no full case in publicize default');

$dash = Litig8Model::dashboard($adminUid);
assert_true($dash['matters_total'] >= 1, 'dashboard matters_total');
assert_true($dash['deadlines_total'] >= 2, 'dashboard deadlines_total');
assert_true(is_array($dash['upcoming_deadlines']), 'upcoming deadlines list');
assert_true(is_array($dash['open_matters_by_category']), 'open by category');

$cleanup = Litig8Model::deleteSyntheticTestRows($adminUid, 'agent:litig8-test');
assert_true(($cleanup['deleted_count'] ?? 0) >= 1, 'synthetic cleanup');

echo "Litig8 synthetic smoke test OK\n";
echo "cleaned_synthetics=" . (int)($cleanup['deleted_count'] ?? 0) . "\n";
