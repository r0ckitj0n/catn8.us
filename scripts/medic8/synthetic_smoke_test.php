<?php

declare(strict_types=1);

/**
 * Synthetic-only Medic8 smoke test. No real PHI.
 * Uses a dedicated synthetic person (not the admin self row).
 * Does not rotate the live agent token.
 * Usage: php scripts/medic8/synthetic_smoke_test.php
 */

require_once dirname(__DIR__, 2) . '/api/bootstrap.php';
require_once dirname(__DIR__, 2) . '/includes/medic8_model.php';

function assert_true(bool $cond, string $msg): void
{
    if (!$cond) {
        throw new RuntimeException('ASSERT FAIL: ' . $msg);
    }
}

Medic8Model::ensureSchema();

$admin = Database::queryOne('SELECT id FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1');
assert_true((bool)$admin, 'admin user exists');
$adminUid = (int)$admin['id'];

// Create a person with no external_source_id, then attach one by id (the Medic8r bug case).
$personBare = Medic8Model::upsertEntity('people', [
    'owner_user_id' => $adminUid,
    'display_name' => 'Synthetic Smoke Patient Bare',
    'relation_to_admin' => 'synthetic-test',
    'is_opted_in' => 1,
], $adminUid, false, 'agent:medic8-test');
$bareId = (int)($personBare['id'] ?? 0);
assert_true($bareId > 0, 'bare person id');
assert_true(!empty($personBare['created']), 'bare person created');

$attachExt = Medic8Model::upsertEntity('people', [
    'id' => $bareId,
    'external_source_id' => 'synthetic:person:smoke-attach',
    'source' => [
        'source_type' => 'manual',
        'record_type' => 'people',
        'record_id' => 'smoke-attach',
    ],
], $adminUid, false, 'agent:medic8-test');
assert_true(!empty($attachExt['updated']) && empty($attachExt['created']), 'attach ext by id updates');
assert_true((int)$attachExt['id'] === $bareId, 'attach keeps same person id');
$attachedRow = Medic8Model::getEntity('people', $bareId, $adminUid, false);
assert_true(($attachedRow['external_source_id'] ?? '') === 'synthetic:person:smoke-attach', 'external_source_id set on person');

$personResult = Medic8Model::upsertEntity('people', [
    'owner_user_id' => $adminUid,
    'display_name' => 'Synthetic Smoke Patient',
    'relation_to_admin' => 'synthetic-test',
    'is_opted_in' => 1,
    'external_source_id' => 'synthetic:person:smoke',
    'source' => [
        'source_type' => 'manual',
        'record_type' => 'people',
        'record_id' => 'smoke',
    ],
], $adminUid, false, 'agent:medic8-test');
$personId = (int)($personResult['id'] ?? 0);
assert_true($personId > 0, 'synthetic person id');

$sourcesBefore = (int)(Database::queryOne('SELECT COUNT(*) AS c FROM medic8_sources')['c'] ?? 0);

$dry = Medic8Model::importBatch('allergies', [[
    'external_source_id' => 'synthetic:allergy:peanut-dry',
    'person_id' => $personId,
    'allergen' => 'Peanut (synthetic dry)',
    'reaction' => 'hives',
    'source' => [
        'source_type' => 'manual',
        'record_type' => 'allergies',
        'record_id' => 'peanut-dry-' . bin2hex(random_bytes(4)),
    ],
]], $adminUid, true, 'agent:medic8-test');
assert_true($dry['dry_run'] === true && $dry['created'] === 1, 'dry_run create preview');
$sourcesAfterDry = (int)(Database::queryOne('SELECT COUNT(*) AS c FROM medic8_sources')['c'] ?? 0);
assert_true($sourcesAfterDry === $sourcesBefore, 'dry_run wrote no sources');
$dryRow = Database::queryOne(
    "SELECT id FROM medic8_allergies WHERE external_source_id = 'synthetic:allergy:peanut-dry'"
);
assert_true(!$dryRow, 'dry_run wrote no allergy row');

$import = Medic8Model::importBatch('medications', [[
    'external_source_id' => 'synthetic:med:examplecillin',
    'person_id' => $personId,
    'name' => 'Examplecillin',
    'strength' => '10 mg',
    'dose_per_admin' => '10 mg',
    'frequency' => 'daily',
    'status' => 'current',
    'last_fill_date' => '2026-09-01',
    'days_supply' => 30,
    'rx_number' => 'RX-SYN-0001',
    'source' => [
        'source_type' => 'manual',
        'record_type' => 'medications',
        'record_id' => 'examplecillin',
        'message_date' => '2026-09-01',
    ],
]], $adminUid, false, 'agent:medic8-test');
assert_true($import['error_count'] === 0, 'med import errors');
assert_true(($import['created'] + $import['updated']) === 1, 'med upsert count');

$again = Medic8Model::importBatch('medications', [[
    'external_source_id' => 'synthetic:med:examplecillin',
    'person_id' => $personId,
    'name' => 'Examplecillin',
    'strength' => '10 mg',
    'status' => 'current',
    'days_supply' => 28,
]], $adminUid, false, 'agent:medic8-test');
assert_true($again['updated'] === 1 && $again['created'] === 0, 'idempotent update');

Medic8Model::importBatch('allergies', [[
    'external_source_id' => 'synthetic:allergy:peanut',
    'person_id' => $personId,
    'allergen' => 'Peanut (synthetic)',
    'reaction' => 'hives',
]], $adminUid, false, 'agent:medic8-test');

$lab = Medic8Model::upsertEntity('labs', [
    'external_source_id' => 'synthetic:lab:cbc',
    'person_id' => $personId,
    'test' => 'Synthetic CBC',
    'value' => '5',
    'unit' => 'k',
], $adminUid, false, 'agent:medic8-test');
$labId = (int)($lab['id'] ?? 0);

$tmp = tempnam(sys_get_temp_dir(), 'm8doc');
file_put_contents($tmp, 'synthetic medic8 document body');
$upload = Medic8Model::storeUploadedDocument([
    'tmp_name' => $tmp,
    'name' => 'synthetic-note.txt',
    'type' => 'text/plain',
], [
    'person_id' => $personId,
    'title' => 'Synthetic note',
    'doc_type' => 'note',
    'external_source_id' => 'synthetic:doc:note-1',
    'source' => ['source_type' => 'manual', 'record_type' => 'documents', 'record_id' => 'note-1'],
    'links' => [['entity' => 'labs', 'record_id' => $labId, 'role' => 'result']],
], $adminUid, 'agent:medic8-test');
assert_true(!empty($upload['id']), 'document upload id');
$docId = (int)$upload['id'];
assert_true(!empty($upload['links'][0]['created']) || !empty($upload['links'][0]['updated']), 'link created');

$tmp2 = tempnam(sys_get_temp_dir(), 'm8doc');
file_put_contents($tmp2, 'synthetic medic8 document body');
$againUpload = Medic8Model::storeUploadedDocument([
    'tmp_name' => $tmp2,
    'name' => 'synthetic-note.txt',
    'type' => 'text/plain',
], [
    'person_id' => $personId,
    'title' => 'Synthetic note updated title',
    'doc_type' => 'note',
    'external_source_id' => 'synthetic:doc:note-1',
], $adminUid, 'agent:medic8-test');
assert_true((int)$againUpload['id'] === $docId, 'document upsert same id');
assert_true(empty($againUpload['file_replaced']), 'same hash did not replace file');

$tmp3 = tempnam(sys_get_temp_dir(), 'm8doc');
file_put_contents($tmp3, 'synthetic medic8 document body CHANGED');
$replaced = Medic8Model::storeUploadedDocument([
    'tmp_name' => $tmp3,
    'name' => 'synthetic-note.txt',
    'type' => 'text/plain',
], [
    'person_id' => $personId,
    'title' => 'Synthetic note replaced',
    'doc_type' => 'note',
    'external_source_id' => 'synthetic:doc:note-1',
], $adminUid, 'agent:medic8-test');
assert_true((int)$replaced['id'] === $docId, 'hash-change upsert same id');
assert_true(!empty($replaced['file_replaced']), 'different hash replaced file');

$linkDry = Medic8Model::linkDocument($docId, 'medications', (int)($import['results'][0]['id'] ?? 0), 'attachment', null, $adminUid, 'agent:medic8-test', true);
assert_true(!empty($linkDry['dry_run']) && !empty($linkDry['created']), 'link dry_run preview create');
$medIdForLink = (int)($import['results'][0]['id'] ?? 0);
$linksBefore = (int)(Database::queryOne(
    'SELECT COUNT(*) AS c FROM medic8_record_documents WHERE document_id = ? AND entity = ? AND record_id = ?',
    [$docId, 'medications', $medIdForLink]
)['c'] ?? 0);
assert_true($linksBefore === 0, 'link dry_run wrote nothing');

$labGot = Medic8Model::getEntity('labs', $labId, $adminUid, false);
assert_true(is_array($labGot) && !empty($labGot['documents']), 'lab get includes documents');

$docGot = Medic8Model::getEntity('documents', $docId, $adminUid, false);
assert_true(is_array($docGot) && !empty($docGot['links']), 'document get includes links');

$page = Medic8Model::listEntityPage('documents', $adminUid, $personId, 1, 0);
assert_true($page['total'] >= 1, 'paging total');
assert_true(count($page['records']) === 1, 'paging limit');
assert_true($page['next'] === 1 || $page['total'] === 1, 'paging next');

$dash = Medic8Model::dashboard($adminUid, $personId);
assert_true(count($dash['medications_current']) >= 1, 'dashboard meds');
assert_true(count($dash['allergies']) >= 1, 'dashboard allergies');
assert_true(($dash['documents_total'] ?? 0) >= 1, 'dashboard documents_total');
assert_true(($dash['labs_total'] ?? 0) >= 1, 'dashboard labs_total');

$meds = Medic8Model::listEntity('medications', $adminUid, $personId, 20);
$hasMasked = false;
foreach ($meds as $med) {
    if (!empty($med['rx_number_present']) || !empty($med['rx_number_masked'])) {
        $hasMasked = true;
        assert_true(!isset($med['rx_number_enc']), 'enc field not leaked');
    }
}
assert_true($hasMasked, 'rx masked present');

$soft = Medic8Model::deleteEntityByKey('allergies', null, 'synthetic:allergy:peanut', $adminUid, 'agent:medic8-test', false);
assert_true(!empty($soft['deleted']) && empty($soft['hard']), 'soft delete');
assert_true(Medic8Model::findEntityRow('allergies', null, 'synthetic:allergy:peanut') === null, 'soft-deleted hidden');

try {
    Medic8Model::deleteEntityByKey('conditions', null, 'synthetic:condition:missing', $adminUid, 'agent:medic8-test', true);
    assert_true(false, 'missing delete should throw');
} catch (InvalidArgumentException $e) {
    assert_true(true, 'missing delete throws');
}

$cleanup = Medic8Model::deleteSyntheticTestRows($adminUid, 'agent:medic8-test');
assert_true(($cleanup['deleted_count'] ?? 0) >= 1, 'synthetic cleanup');

echo "Medic8 synthetic smoke test OK\n";
echo "cleaned_synthetic_rows=" . (int)$cleanup['deleted_count'] . "\n";
