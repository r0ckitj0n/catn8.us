<?php
/**
 * Shared functions for auditing and fixing scenario facts.
 */

/**
 * Validates annotations and returns findings.
 */
function catn8_mystery_audit_annotations(array $annotations, array $scenarioEntityIdSet, array $lieIdSet, array $noteIdSet, array $winning): array {
    $errors = [];
    $warnings = [];
    $fixes = [];
    $covered = [
        'weapon' => false,
        'motive' => false,
        'location' => false,
        'killer' => false,
        'witness' => false,
    ];
    $typeCounts = [];

    $validTypes = [
        'weapon' => true,
        'motive' => true,
        'location' => true,
        'character' => true,
        'killer' => true,
        'witness' => true,
        'lie' => true,
        'case_note' => true,
        'weather' => true,
        'other' => true,
    ];

    foreach ($annotations as $idx => $a) {
        if (!is_array($a)) {
            $errors[] = 'Annotation #' . (string)$idx . ' is not an object.';
            continue;
        }

        $paragraph = (int)($a['paragraph'] ?? 0);
        if ($paragraph <= 0) {
            $errors[] = 'Annotation #' . (string)$idx . ' missing/invalid paragraph.';
        }

        $type = trim((string)($a['type'] ?? ''));
        if ($type === '') {
            $errors[] = 'Annotation #' . (string)$idx . ' missing type.';
            continue;
        }
        if (!isset($validTypes[$type])) {
            $warnings[] = 'Annotation #' . (string)$idx . ' has unknown type: ' . $type;
        }
        $typeCounts[$type] = (int)($typeCounts[$type] ?? 0) + 1;

        if ($type === 'character' || $type === 'killer' || $type === 'witness') {
            $eid = (int)($a['entity_id'] ?? 0);
            if ($eid <= 0) {
                $errors[] = 'Annotation #' . (string)$idx . ' type ' . $type . ' missing entity_id.';
            } elseif (!isset($scenarioEntityIdSet[$eid])) {
                $warnings[] = 'Annotation #' . (string)$idx . ' references entity_id ' . (string)$eid . ' not attached to scenario.';
                $role = 'suspect';
                if ($type === 'killer') $role = 'killer';
                if ($type === 'witness') $role = 'witness';
                $fixes[] = [
                    'id' => 'attach_entity_' . (string)$eid,
                    'label' => 'Attach entity #' . (string)$eid . ' to scenario as ' . $role,
                    'action' => 'attach_entity',
                    'payload' => [
                        'entity_id' => $eid,
                        'role' => $role,
                    ],
                ];
            } else {
                if ($type === 'killer') $covered['killer'] = true;
                if ($type === 'witness') $covered['witness'] = true;
            }
        }

        if ($type === 'lie') {
            $lid = (int)($a['lie_id'] ?? 0);
            if ($lid <= 0) {
                $errors[] = 'Annotation #' . (string)$idx . ' type lie missing lie_id.';
            } elseif (!isset($lieIdSet[$lid])) {
                $warnings[] = 'Annotation #' . (string)$idx . ' references lie_id ' . (string)$lid . ' not found in scenario.';
            }
        }

        if ($type === 'case_note') {
            $nid = (int)($a['case_note_id'] ?? 0);
            if ($nid <= 0) {
                $errors[] = 'Annotation #' . (string)$idx . ' type case_note missing case_note_id.';
            } elseif (!isset($noteIdSet[$nid])) {
                $warnings[] = 'Annotation #' . (string)$idx . ' references case_note_id ' . (string)$nid . ' not found in scenario.';
            }
        }

        if ($type === 'weapon') {
            $covered['weapon'] = true;
            $v = trim((string)($a['weapon'] ?? $a['value'] ?? ''));
            if ($v === '') {
                $warnings[] = 'Annotation #' . (string)$idx . ' weapon missing weapon/value.';
            }
            $expected = trim((string)($winning['weapon'] ?? ''));
            if ($expected !== '' && $v !== '' && strcasecmp($expected, $v) !== 0) {
                $warnings[] = 'Annotation #' . (string)$idx . ' weapon mismatch (crime_scene_weapon=' . $expected . ', annotation=' . $v . ')';
                $fixes[] = [
                    'id' => 'fix_weapon_' . (string)$idx,
                    'label' => 'Set annotation #' . (string)$idx . ' weapon to crime_scene_weapon',
                    'action' => 'update_annotation',
                    'payload' => [
                        'index' => (int)$idx,
                        'patch' => ['weapon' => $expected, 'value' => null],
                    ],
                ];
            }
        }

        if ($type === 'motive') {
            $covered['motive'] = true;
            $v = trim((string)($a['motive'] ?? $a['value'] ?? ''));
            if ($v === '') {
                $warnings[] = 'Annotation #' . (string)$idx . ' motive missing motive/value.';
            }
            $expected = trim((string)($winning['motive'] ?? ''));
            if ($expected !== '' && $v !== '' && strcasecmp($expected, $v) !== 0) {
                $warnings[] = 'Annotation #' . (string)$idx . ' motive mismatch (crime_scene_motive=' . $expected . ', annotation=' . $v . ')';
                $fixes[] = [
                    'id' => 'fix_motive_' . (string)$idx,
                    'label' => 'Set annotation #' . (string)$idx . ' motive to crime_scene_motive',
                    'action' => 'update_annotation',
                    'payload' => [
                        'index' => (int)$idx,
                        'patch' => ['motive' => $expected, 'value' => null],
                    ],
                ];
            }
        }

        if ($type === 'location') {
            $covered['location'] = true;
            $v = trim((string)($a['location'] ?? $a['value'] ?? ''));
            if ($v === '') {
                $warnings[] = 'Annotation #' . (string)$idx . ' location missing location/value.';
            }
            $expected = trim((string)($winning['location'] ?? ''));
            if ($expected !== '' && $v !== '' && strcasecmp($expected, $v) !== 0) {
                $warnings[] = 'Annotation #' . (string)$idx . ' location mismatch (crime_scene_location=' . $expected . ', annotation=' . $v . ')';
                $fixes[] = [
                    'id' => 'fix_location_' . (string)$idx,
                    'label' => 'Set annotation #' . (string)$idx . ' location to crime_scene_location',
                    'action' => 'update_annotation',
                    'payload' => [
                        'index' => (int)$idx,
                        'patch' => ['location' => $expected, 'value' => null],
                    ],
                ];
            }
        }
    }

    return [
        'errors' => $errors,
        'warnings' => $warnings,
        'fixes' => $fixes,
        'covered' => $covered,
        'type_counts' => $typeCounts,
    ];
}
