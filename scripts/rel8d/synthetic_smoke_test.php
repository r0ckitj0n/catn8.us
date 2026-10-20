<?php

declare(strict_types=1);

/**
 * Synthetic-only Rel8d smoke test. No real genealogy data.
 * Usage: php scripts/rel8d/synthetic_smoke_test.php
 */

require_once dirname(__DIR__, 2) . '/api/bootstrap.php';
require_once dirname(__DIR__, 2) . '/includes/rel8d_model.php';

function assert_true(bool $cond, string $msg): void
{
    if (!$cond) {
        throw new RuntimeException('ASSERT FAIL: ' . $msg);
    }
}

Rel8dModel::ensureSchema();

$admin = Database::queryOne('SELECT id FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1');
assert_true((bool)$admin, 'admin user exists');
$adminUid = (int)$admin['id'];

$fixture = dirname(__DIR__, 2) . '/tests/fixtures/rel8d/synthetic.ged';
assert_true(is_file($fixture), 'synthetic fixture exists');
$text = (string)file_get_contents($fixture);

$parsed = Rel8dGedcom::parse($text);
assert_true(($parsed['counts']['INDI'] ?? 0) === 5, 'fixture indi count');
assert_true(($parsed['counts']['FAM'] ?? 0) === 2, 'fixture fam count');
assert_true(($parsed['counts']['SOUR'] ?? 0) === 1, 'fixture sour count');

$preview = Rel8dModel::previewImport($text, 'synthetic.ged');
assert_true(($preview['import_id'] ?? 0) > 0, 'preview import id');
assert_true(($preview['counts']['INDI'] ?? 0) === 5, 'preview counts');

$applied = Rel8dModel::applyImport((int)$preview['import_id'], $adminUid, 'agent:rel8d-test');
assert_true(($applied['counts']['people'] ?? 0) === 5, 'applied people');
assert_true(($applied['counts']['families'] ?? 0) === 2, 'applied families');

$people = Rel8dModel::listPeople($adminUid, 50, 0, 'Example');
assert_true(($people['total'] ?? 0) >= 3, 'search example');

$alex = Database::queryOne("SELECT id FROM rel8d_people WHERE name_display LIKE 'Alex Example%' LIMIT 1");
assert_true((bool)$alex, 'alex row');
$person = Rel8dModel::getPerson($adminUid, (int)$alex['id']);
assert_true(is_array($person), 'get person');
assert_true(($person['sourced_badge'] ?? '') === 'sourced', 'sourced badge');
assert_true(count($person['events'] ?? []) >= 2, 'events present');

$ped = Rel8dModel::pedigree($adminUid, (int)$alex['id'], 3);
assert_true(is_array($ped), 'pedigree');
assert_true(!empty($ped['father']) || !empty($ped['mother']), 'has parent');

$casey = Database::queryOne("SELECT id FROM rel8d_people WHERE name_display LIKE 'Casey Example%' LIMIT 1");
$rel = Rel8dModel::relationship($adminUid, (int)$alex['id'], (int)$casey['id']);
assert_true(str_contains((string)$rel['relation'], 'child') || str_contains((string)$rel['relation'], 'parent'), 'parent/child relation');

$dry = Rel8dModel::upsertPerson([
    'name_display' => 'Dry Run Person (synthetic)',
    'external_source_id' => 'synthetic:person:dry-run',
    'birth_date_raw' => '1 JAN 1850',
    'death_date_raw' => '1 JAN 1900',
], $adminUid, true, 'agent:rel8d-test');
assert_true(!empty($dry['dry_run']), 'dry_run flag');
$dryRow = Database::queryOne("SELECT id FROM rel8d_people WHERE external_source_id = 'synthetic:person:dry-run'");
assert_true(!$dryRow, 'dry_run wrote no row');

$note = Rel8dModel::addNote([
    'person_id' => (int)$alex['id'],
    'title' => 'Synthetic story',
    'body' => 'A safe synthetic note with no real people.',
    'is_story' => 1,
], $adminUid, false, 'agent:rel8d-test');
assert_true(($note['id'] ?? 0) > 0, 'note id');

$src = Rel8dModel::addSource([
    'title' => 'Synthetic Land Record',
    'person_id' => (int)$alex['id'],
    'page' => 'vol 1 p 2',
    'quality' => '2',
    'external_source_id' => 'synthetic:source:land-1',
], $adminUid, false, 'agent:rel8d-test');
assert_true(($src['id'] ?? 0) > 0, 'source id');

$dna = Rel8dModel::getDna($adminUid);
assert_true(count($dna['regions'] ?? []) >= 4, 'dna regions seeded');
assert_true(count($dna['communities'] ?? []) >= 2, 'dna communities seeded');

$map = Rel8dModel::mapPlaces($adminUid);
assert_true(count($map['places'] ?? []) >= 1, 'places synced');

$flags = Rel8dModel::listQualityFlags($adminUid);
assert_true(is_array($flags), 'quality flags listable');

$ged = Rel8dModel::exportGedcom();
assert_true(str_contains($ged, '0 HEAD') && str_contains($ged, '0 TRLR'), 'export gedcom');

$token = Rel8dModel::rotateApiToken();
assert_true(Rel8dModel::verifyApiToken($token), 'token verifies');
assert_true(!Rel8dModel::verifyApiToken($token . 'x'), 'bad token rejected');
Rel8dModel::writeLocalTokenFile($token);

echo "Rel8d synthetic smoke test OK\n";
echo "counts people=" . (int)$applied['counts']['people']
    . " families=" . (int)$applied['counts']['families']
    . " sources=" . (int)$applied['counts']['sources']
    . " quality_flags=" . (int)$applied['counts']['quality_flags']
    . "\n";
