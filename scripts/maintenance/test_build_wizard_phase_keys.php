<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/includes/build_wizard_phase_keys.php';

function assert_true(bool $cond, string $message): void
{
    if (!$cond) {
        throw new RuntimeException('ASSERT FAIL: ' . $message);
    }
}

$cases = [
    ['land_due_diligence', 'design_preconstruction'],
    ['dawson_county_permits', 'design_preconstruction'],
    ['permits', 'design_preconstruction'],
    ['foundation', 'site_preparation'],
    ['move_in', 'interior_finishes'],
    ['land', 'design_preconstruction'],
    ['site', 'framing_shell'],
    ['mep', 'interior_finishes'],
    ['finishes', 'inspections_closeout'],
    ['desk', 'general'],
    ['site_prep_foundation', 'site_preparation'],
    ['framing_exterior', 'framing_shell'],
    ['exterior_finish', 'framing_shell'],
    ['interior_finish', 'interior_finishes'],
    ['construction', 'general'],
    ['design_preconstruction', 'design_preconstruction'],
    ['', 'general'],
];

foreach ($cases as [$input, $expected]) {
    $actual = catn8_build_wizard_canonical_phase_key($input);
    assert_true($actual === $expected, "canonical({$input}) should be {$expected}, got {$actual}");
}

assert_true(catn8_build_wizard_phase_keys_match('land_due_diligence', 'design_preconstruction'), 'old land key should match planning');
assert_true(catn8_build_wizard_phase_keys_match('foundation', 'site_preparation'), 'old foundation key should match site prep');
assert_true(catn8_build_wizard_phase_keys_match('move_in', 'interior_finishes'), 'old move_in key should match finishes');
assert_true(!catn8_build_wizard_phase_keys_match('framing_shell', 'mep_rough_in'), 'distinct canonical keys should not match');
assert_true(in_array('land_due_diligence', catn8_build_wizard_phase_key_aliases('design_preconstruction'), true), 'aliases should include leftover land_due_diligence');
assert_true(catn8_build_wizard_is_task_document_kind('event'), 'leftover event documents are tasks');
assert_true(catn8_build_wizard_is_task_document_kind('receipt'), 'receipt documents are tasks');
assert_true(!catn8_build_wizard_is_task_document_kind('blueprint'), 'blueprints are not tasks');

$tabForPhase = static function (string $phaseKey): string {
    $canonical = catn8_build_wizard_canonical_phase_key($phaseKey);
    return match ($canonical) {
        'design_preconstruction' => 'land',
        'site_preparation' => 'permits',
        'framing_shell' => 'site',
        'mep_rough_in' => 'framing',
        'interior_finishes' => 'mep',
        'inspections_closeout' => 'finishes',
        default => 'desk',
    };
};

$tabCases = [
    ['land_due_diligence', 'land'],
    ['dawson_county_permits', 'land'],
    ['foundation', 'permits'],
    ['move_in', 'mep'],
    ['framing_shell', 'site'],
    ['event', 'desk'],
];
foreach ($tabCases as [$input, $expectedTab]) {
    $actualTab = $tabForPhase($input);
    assert_true($actualTab === $expectedTab, "tab({$input}) should be {$expectedTab}, got {$actualTab}");
}

echo json_encode([
    'success' => true,
    'cases' => count($cases),
    'tab_cases' => count($tabCases),
], JSON_UNESCAPED_SLASHES) . "\n";
