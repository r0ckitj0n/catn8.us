<?php

declare(strict_types=1);

/**
 * Canonical FABRIC8 phase keys after the 10-phase → 6-tab collapse.
 *
 * Dated steps are the timeline "events"; receipt documents are "tasks".
 * Older rows may still store land_due_diligence, dawson_county_permits,
 * foundation, move_in, or leftover event labels. Every compare/write path
 * should go through these helpers so those aliases stay visible.
 */

function catn8_build_wizard_slug_phase_key($value): string
{
    $raw = strtolower(trim((string)$value));
    if ($raw === '') {
        return '';
    }
    $raw = preg_replace('/[^a-z0-9_ -]+/', '', $raw);
    if (!is_string($raw)) {
        return '';
    }
    $raw = str_replace(' ', '_', trim($raw));
    if ($raw === '') {
        return '';
    }
    if (strlen($raw) > 64) {
        $raw = substr($raw, 0, 64);
    }
    return $raw;
}

/**
 * @return array<string, string>
 */
function catn8_build_wizard_phase_key_alias_map(): array
{
    return [
        'land_due_diligence' => 'design_preconstruction',
        'design_preconstruction' => 'design_preconstruction',
        'dawson_county_permits' => 'design_preconstruction',
        'permits' => 'design_preconstruction',
        'land' => 'design_preconstruction',
        'planning' => 'design_preconstruction',
        'preconstruction' => 'design_preconstruction',
        'site_preparation' => 'site_preparation',
        'sitework' => 'site_preparation',
        'foundation' => 'site_preparation',
        'site_prep' => 'site_preparation',
        'framing_shell' => 'framing_shell',
        'framing' => 'framing_shell',
        'enclosure' => 'framing_shell',
        'roofing' => 'framing_shell',
        'site' => 'framing_shell',
        'mep_rough_in' => 'mep_rough_in',
        'plumbing' => 'mep_rough_in',
        'electrical' => 'mep_rough_in',
        'hvac' => 'mep_rough_in',
        'interior_finishes' => 'interior_finishes',
        'interior' => 'interior_finishes',
        'move_in' => 'interior_finishes',
        'mep' => 'interior_finishes',
        'inspections_closeout' => 'inspections_closeout',
        'closeout' => 'inspections_closeout',
        'finishes' => 'inspections_closeout',
        'general' => 'general',
        'desk' => 'general',
    ];
}

function catn8_build_wizard_canonical_phase_key($value): string
{
    $slug = catn8_build_wizard_slug_phase_key($value);
    if ($slug === '') {
        return 'general';
    }
    $map = catn8_build_wizard_phase_key_alias_map();
    return $map[$slug] ?? $slug;
}

/**
 * @return list<string>
 */
function catn8_build_wizard_phase_key_aliases(string $phaseKey): array
{
    $canonical = catn8_build_wizard_canonical_phase_key($phaseKey);
    $aliases = [$canonical];
    foreach (catn8_build_wizard_phase_key_alias_map() as $alias => $mapped) {
        if ($mapped === $canonical) {
            $aliases[] = $alias;
        }
    }
    return array_values(array_unique($aliases));
}

function catn8_build_wizard_phase_keys_match($left, $right): bool
{
    return catn8_build_wizard_canonical_phase_key($left) === catn8_build_wizard_canonical_phase_key($right);
}

/**
 * @return array<string, string>
 */
function catn8_build_wizard_legacy_phase_key_rewrites(): array
{
    $rewrites = [];
    foreach (catn8_build_wizard_phase_key_alias_map() as $alias => $canonical) {
        if ($alias !== $canonical) {
            $rewrites[$alias] = $canonical;
        }
    }
    return $rewrites;
}

function catn8_build_wizard_is_task_document_kind(string $kind): bool
{
    $normalized = strtolower(trim($kind));
    return in_array($normalized, ['receipt', 'event', 'events'], true);
}

function catn8_build_wizard_canonicalize_persisted_phase_vocab(): void
{
    foreach (catn8_build_wizard_legacy_phase_key_rewrites() as $from => $to) {
        Database::execute('UPDATE build_wizard_steps SET phase_key = ? WHERE phase_key = ?', [$to, $from]);
        Database::execute('UPDATE build_wizard_contact_assignments SET phase_key = ? WHERE phase_key = ?', [$to, $from]);
    }
    Database::execute("UPDATE build_wizard_steps SET step_type = 'milestone' WHERE step_type IN ('event', 'events')");
    Database::execute("UPDATE build_wizard_documents SET kind = 'receipt' WHERE kind IN ('event', 'events')");
}
