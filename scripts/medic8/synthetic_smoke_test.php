<?php

declare(strict_types=1);

/**
 * Synthetic-only Medic8 smoke test. No real PHI.
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

$person = Medic8Model::ensureAdminPerson($adminUid, 'Synthetic Admin Patient');
$personId = (int)$person['id'];

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

$dry = Medic8Model::importBatch('allergies', [[
    'external_source_id' => 'synthetic:allergy:peanut',
    'person_id' => $personId,
    'allergen' => 'Peanut (synthetic)',
    'reaction' => 'hives',
]], $adminUid, true, 'agent:medic8-test');
assert_true($dry['dry_run'] === true && $dry['created'] === 1, 'dry_run create preview');

Medic8Model::importBatch('allergies', [[
    'external_source_id' => 'synthetic:allergy:peanut',
    'person_id' => $personId,
    'allergen' => 'Peanut (synthetic)',
    'reaction' => 'hives',
]], $adminUid, false, 'agent:medic8-test');

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
], $adminUid, 'agent:medic8-test');
assert_true(!empty($upload['id']), 'document upload id');

$dash = Medic8Model::dashboard($adminUid, $personId);
assert_true(count($dash['medications_current']) >= 1, 'dashboard meds');
assert_true(count($dash['allergies']) >= 1, 'dashboard allergies');
assert_true(count($dash['documents']) >= 1, 'dashboard documents');

$meds = Medic8Model::listEntity('medications', $adminUid, $personId, 20);
$hasMasked = false;
foreach ($meds as $med) {
    if (!empty($med['rx_number_present']) || !empty($med['rx_number_masked'])) {
        $hasMasked = true;
        assert_true(!isset($med['rx_number_enc']), 'enc field not leaked');
    }
}
assert_true($hasMasked, 'rx masked present');

$token = Medic8Model::rotateApiToken();
$path = Medic8Model::writeLocalTokenFile($token);
assert_true(is_file($path), 'token file exists');
assert_true(Medic8Model::verifyApiToken($token), 'token verifies');
assert_true(!Medic8Model::verifyApiToken('wrong-token'), 'bad token rejected');

echo "Medic8 synthetic smoke test OK\n";
echo "person_id={$personId}\n";
echo "token_file={$path}\n";
