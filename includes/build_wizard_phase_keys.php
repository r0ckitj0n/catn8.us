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
        'site_prep_foundation' => 'site_preparation',
        'framing_shell' => 'framing_shell',
        'framing' => 'framing_shell',
        'enclosure' => 'framing_shell',
        'roofing' => 'framing_shell',
        'site' => 'framing_shell',
        'framing_exterior' => 'framing_shell',
        'exterior_finish' => 'framing_shell',
        'mep_rough_in' => 'mep_rough_in',
        'plumbing' => 'mep_rough_in',
        'electrical' => 'mep_rough_in',
        'hvac' => 'mep_rough_in',
        'interior_finishes' => 'interior_finishes',
        'interior' => 'interior_finishes',
        'move_in' => 'interior_finishes',
        'mep' => 'interior_finishes',
        'interior_finish' => 'interior_finishes',
        'inspections_closeout' => 'inspections_closeout',
        'closeout' => 'inspections_closeout',
        'finishes' => 'inspections_closeout',
        'general' => 'general',
        'desk' => 'general',
        'construction' => 'general',
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
    // Receipt documents are the task containers; leftover event labels still appear in old rows.
    return in_array($normalized, ['receipt', 'event', 'events'], true);
}

function catn8_build_wizard_table_exists(string $table): bool
{
    $table = trim($table);
    if ($table === '' || !preg_match('/^[a-z0-9_]+$/', $table)) {
        return false;
    }
    $row = Database::queryOne(
        'SELECT 1 AS ok
         FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name = ?
         LIMIT 1',
        [$table]
    );
    return (bool)$row;
}

/**
 * Live still has build_wizard_events; current code prefers build_wizard_steps.
 * Prefer steps when present so local/dev and migrated hosts keep working.
 */
function catn8_build_wizard_timeline_table_name(): string
{
    if (catn8_build_wizard_table_exists('build_wizard_steps')) {
        return 'build_wizard_steps';
    }
    if (catn8_build_wizard_table_exists('build_wizard_events')) {
        return 'build_wizard_events';
    }
    return 'build_wizard_steps';
}

function catn8_build_wizard_timeline_type_column(string $timelineTable): string
{
    return $timelineTable === 'build_wizard_events' ? 'event_type' : 'step_type';
}

function catn8_build_wizard_canonicalize_persisted_phase_vocab(): void
{
    $timelineTable = catn8_build_wizard_timeline_table_name();
    $typeColumn = catn8_build_wizard_timeline_type_column($timelineTable);

    foreach (catn8_build_wizard_legacy_phase_key_rewrites() as $from => $to) {
        Database::execute(
            "UPDATE {$timelineTable} SET phase_key = ? WHERE phase_key = ?",
            [$to, $from]
        );
        if (catn8_build_wizard_table_exists('build_wizard_contact_assignments')) {
            Database::execute(
                'UPDATE build_wizard_contact_assignments SET phase_key = ? WHERE phase_key = ?',
                [$to, $from]
            );
        }
    }

    Database::execute(
        "UPDATE {$timelineTable} SET {$typeColumn} = 'milestone' WHERE {$typeColumn} IN ('event', 'events')"
    );

    if (catn8_build_wizard_table_exists('build_wizard_documents')) {
        Database::execute(
            "UPDATE build_wizard_documents SET kind = 'receipt' WHERE kind IN ('event', 'events')"
        );
    }
}
