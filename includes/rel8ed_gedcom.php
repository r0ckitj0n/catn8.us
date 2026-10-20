<?php

declare(strict_types=1);

/**
 * Full GEDCOM 5.5.1 parser that preserves every tag in a nested raw tree.
 * Never logs personal names/dates from real imports in caller code.
 */
final class Rel8edGedcom
{
    /** Individual/family event and attribute tags commonly used in Ancestry exports. */
    public const EVENT_TAGS = [
        'BIRT', 'CHR', 'DEAT', 'BURI', 'CREM', 'ADOP', 'BAPM', 'BARM', 'BASM', 'BLES',
        'CHRA', 'CONF', 'FCOM', 'ORDN', 'NATU', 'EMIG', 'IMMI', 'CENS', 'PROB', 'WILL',
        'GRAD', 'RETI', 'EVEN', 'MARR', 'MARB', 'MARC', 'MARL', 'MARS', 'ENGA', 'DIV',
        'ANUL', 'DIVF',
    ];

    public const ATTR_TAGS = [
        'CAST', 'DSCR', 'EDUC', 'IDNO', 'NATI', 'NCHI', 'NMR', 'OCCU', 'PROP', 'RELI',
        'RESI', 'SSN', 'TITL', 'FACT', 'MILI', '_MILT',
    ];

    /**
     * @return array{
     *   header: array,
     *   trailer: ?array,
     *   records: array<string, array>,
     *   order: list<string>,
     *   counts: array<string, int>
     * }
     */
    public static function parse(string $gedcomText): array
    {
        $gedcomText = preg_replace("/^\xEF\xBB\xBF/", '', $gedcomText) ?? $gedcomText;
        $lines = preg_split("/\r\n|\n|\r/", $gedcomText) ?: [];

        // Flat nodes with parent indices, then assemble trees.
        $flat = [];
        $levelToIndex = [];

        foreach ($lines as $lineNum => $rawLine) {
            $line = rtrim((string)$rawLine, "\r\n");
            if ($line === '') {
                continue;
            }
            if (!preg_match('/^(\d+)\s+(?:(@[^@]+@)\s+)?([A-Za-z0-9_@]+)(?:\s(.*))?$/u', $line, $m)) {
                $parentIdx = null;
                for ($l = 1; $l >= 0; $l--) {
                    if (isset($levelToIndex[$l])) {
                        $parentIdx = $levelToIndex[$l];
                        break;
                    }
                }
                $idx = count($flat);
                $flat[] = [
                    'level' => $parentIdx === null ? 0 : ((int)$flat[$parentIdx]['level'] + 1),
                    'tag' => '_UNPARSED',
                    'xref' => null,
                    'value' => $line,
                    'children' => [],
                    'line' => $lineNum + 1,
                    'parent' => $parentIdx,
                ];
                continue;
            }

            $level = (int)$m[1];
            $xref = isset($m[2]) && $m[2] !== '' ? (string)$m[2] : null;
            $tag = strtoupper((string)$m[3]);
            $value = array_key_exists(4, $m) ? (string)$m[4] : '';

            $parentIdx = null;
            if ($level > 0) {
                for ($l = $level - 1; $l >= 0; $l--) {
                    if (isset($levelToIndex[$l])) {
                        $parentIdx = $levelToIndex[$l];
                        break;
                    }
                }
            }

            $idx = count($flat);
            $flat[] = [
                'level' => $level,
                'tag' => $tag,
                'xref' => $xref,
                'value' => $value,
                'children' => [],
                'line' => $lineNum + 1,
                'parent' => $parentIdx,
            ];

            $levelToIndex[$level] = $idx;
            foreach (array_keys($levelToIndex) as $existingLevel) {
                if ((int)$existingLevel > $level) {
                    unset($levelToIndex[$existingLevel]);
                }
            }
        }

        $childrenMap = [];
        foreach ($flat as $idx => $node) {
            $p = $node['parent'] ?? null;
            if ($p !== null) {
                $childrenMap[(int)$p][] = $idx;
            }
        }

        $build = static function (int $idx) use (&$build, $flat, $childrenMap): array {
            $node = $flat[$idx];
            unset($node['parent']);
            $node['children'] = [];
            foreach ($childrenMap[$idx] ?? [] as $childIdx) {
                $node['children'][] = $build((int)$childIdx);
            }
            return $node;
        };

        $records = [];
        $order = [];
        $header = [];
        $trailer = null;
        foreach ($flat as $idx => $node) {
            if ((int)($node['level'] ?? -1) !== 0) {
                continue;
            }
            $built = $build($idx);
            $tag = (string)($built['tag'] ?? '');
            if ($tag === 'HEAD') {
                $header = $built;
                continue;
            }
            if ($tag === 'TRLR') {
                $trailer = $built;
                continue;
            }
            $xref = $built['xref'] ?? null;
            $key = is_string($xref) && $xref !== '' ? $xref : ('_anon_' . count($order) . '_' . $tag);
            $records[$key] = $built;
            $order[] = $key;
        }

        $counts = [
            'INDI' => 0,
            'FAM' => 0,
            'SOUR' => 0,
            'NOTE' => 0,
            'OBJE' => 0,
            'REPO' => 0,
            'SUBM' => 0,
            'other' => 0,
        ];
        foreach ($records as $rec) {
            $t = (string)($rec['tag'] ?? 'other');
            if (isset($counts[$t])) {
                $counts[$t]++;
            } else {
                $counts['other']++;
            }
        }

        return [
            'header' => $header,
            'trailer' => $trailer,
            'records' => $records,
            'order' => $order,
            'counts' => $counts,
        ];
    }

    public static function childValues(array $node, string $tag): array
    {
        $out = [];
        foreach ($node['children'] ?? [] as $child) {
            if (strcasecmp((string)($child['tag'] ?? ''), $tag) === 0) {
                $out[] = $child;
            }
        }
        return $out;
    }

    public static function firstChild(array $node, string $tag): ?array
    {
        foreach ($node['children'] ?? [] as $child) {
            if (strcasecmp((string)($child['tag'] ?? ''), $tag) === 0) {
                return $child;
            }
        }
        return null;
    }

    public static function firstChildValue(array $node, string $tag): string
    {
        $child = self::firstChild($node, $tag);
        return $child ? trim((string)($child['value'] ?? '')) : '';
    }

    public static function concatContConc(array $node): string
    {
        $text = (string)($node['value'] ?? '');
        foreach ($node['children'] ?? [] as $child) {
            $tag = strtoupper((string)($child['tag'] ?? ''));
            if ($tag === 'CONC') {
                $text .= (string)($child['value'] ?? '');
            } elseif ($tag === 'CONT') {
                $text .= "\n" . (string)($child['value'] ?? '');
            }
        }
        return $text;
    }

    /**
     * @return array{display:string,given:?string,surname:?string,prefix:?string,suffix:?string}
     */
    public static function parseName(string $raw): array
    {
        $raw = trim($raw);
        $given = null;
        $surname = null;
        if (preg_match('/^(.*?)\s*\/([^\/]*)\/\s*(.*)$/u', $raw, $m)) {
            $given = trim($m[1]) !== '' ? trim($m[1]) : null;
            $surname = trim($m[2]) !== '' ? trim($m[2]) : null;
            $suffix = trim($m[3]) !== '' ? trim($m[3]) : null;
            $display = trim(preg_replace('/\s+/', ' ', ($given ?? '') . ' ' . ($surname ?? '') . ' ' . ($suffix ?? '')) ?? '');
            return [
                'display' => $display !== '' ? $display : $raw,
                'given' => $given,
                'surname' => $surname,
                'prefix' => null,
                'suffix' => $suffix,
            ];
        }
        $display = trim(str_replace('/', '', $raw));
        return [
            'display' => $display !== '' ? $display : 'Unknown',
            'given' => null,
            'surname' => null,
            'prefix' => null,
            'suffix' => null,
        ];
    }

    /**
     * Best-effort GEDCOM date → Y-m-d for sorting (nullable).
     */
    public static function parseDateSort(?string $raw): ?string
    {
        if ($raw === null) {
            return null;
        }
        $raw = trim($raw);
        if ($raw === '') {
            return null;
        }
        $clean = preg_replace('/^(ABT|ABOUT|EST|CAL|BEF|AFT|FROM|TO|BET|AND|CIRCA|CIRC|C\.?)\s+/i', '', $raw) ?? $raw;
        $clean = preg_replace('/\s+(AND|TO|BEF|AFT).*$/i', '', $clean) ?? $clean;
        $clean = trim($clean);
        if (preg_match('/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{3,4})$/', $clean, $m)) {
            $ts = strtotime($m[1] . ' ' . $m[2] . ' ' . $m[3]);
            return $ts ? date('Y-m-d', $ts) : null;
        }
        if (preg_match('/^([A-Za-z]{3,})\s+(\d{3,4})$/', $clean, $m)) {
            $ts = strtotime('1 ' . $m[1] . ' ' . $m[2]);
            return $ts ? date('Y-m-d', $ts) : null;
        }
        if (preg_match('/^(\d{3,4})$/', $clean, $m)) {
            return sprintf('%04d-01-01', (int)$m[1]);
        }
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $clean)) {
            return $clean;
        }
        return null;
    }

    public static function isEventTag(string $tag): bool
    {
        $tag = strtoupper($tag);
        return in_array($tag, self::EVENT_TAGS, true) || str_starts_with($tag, '_');
    }

    public static function isAttrTag(string $tag): bool
    {
        return in_array(strtoupper($tag), self::ATTR_TAGS, true);
    }

    /**
     * Encode a nested record tree back to GEDCOM lines.
     */
    public static function encodeRecord(array $node): string
    {
        $lines = [];
        self::encodeNode($node, $lines);
        return implode("\n", $lines);
    }

    private static function encodeNode(array $node, array &$lines): void
    {
        $level = (int)($node['level'] ?? 0);
        $xref = $node['xref'] ?? null;
        $tag = (string)($node['tag'] ?? '');
        $value = (string)($node['value'] ?? '');
        $parts = [(string)$level];
        if (is_string($xref) && $xref !== '') {
            $parts[] = $xref;
        }
        $parts[] = $tag;
        $line = implode(' ', $parts);
        if ($value !== '') {
            $line .= ' ' . $value;
        }
        $lines[] = $line;
        foreach ($node['children'] ?? [] as $child) {
            if (is_array($child)) {
                self::encodeNode($child, $lines);
            }
        }
    }

    /**
     * Build a complete GEDCOM document from parsed pieces / DB-exported records.
     *
     * @param list<array> $records level-0 records
     */
    public static function buildDocument(array $records, ?array $header = null): string
    {
        $out = [];
        if ($header) {
            $out[] = self::encodeRecord($header);
        } else {
            $out[] = "0 HEAD\n1 SOUR REL8ED\n1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n1 CHAR UTF-8";
        }
        foreach ($records as $rec) {
            $out[] = self::encodeRecord($rec);
        }
        $out[] = '0 TRLR';
        return implode("\n", $out) . "\n";
    }

    /**
     * Diff two parse results by xref counts and field-level person changes (no PII in summary).
     *
     * @return array{summary: array, people_added:int, people_removed:int, people_changed:int, families_added:int, families_removed:int, detail: array}
     */
    public static function diff(array $oldParsed, array $newParsed): array
    {
        $oldIndi = [];
        $newIndi = [];
        $oldFam = [];
        $newFam = [];
        foreach ($oldParsed['records'] as $xref => $rec) {
            if (($rec['tag'] ?? '') === 'INDI') {
                $oldIndi[$xref] = $rec;
            } elseif (($rec['tag'] ?? '') === 'FAM') {
                $oldFam[$xref] = $rec;
            }
        }
        foreach ($newParsed['records'] as $xref => $rec) {
            if (($rec['tag'] ?? '') === 'INDI') {
                $newIndi[$xref] = $rec;
            } elseif (($rec['tag'] ?? '') === 'FAM') {
                $newFam[$xref] = $rec;
            }
        }

        $addedPeople = array_values(array_diff(array_keys($newIndi), array_keys($oldIndi)));
        $removedPeople = array_values(array_diff(array_keys($oldIndi), array_keys($newIndi)));
        $changedPeople = [];
        foreach (array_intersect(array_keys($oldIndi), array_keys($newIndi)) as $xref) {
            $a = json_encode($oldIndi[$xref]);
            $b = json_encode($newIndi[$xref]);
            if ($a !== $b) {
                $changedPeople[] = $xref;
            }
        }
        $addedFam = array_values(array_diff(array_keys($newFam), array_keys($oldFam)));
        $removedFam = array_values(array_diff(array_keys($oldFam), array_keys($newFam)));

        return [
            'summary' => [
                'old_counts' => $oldParsed['counts'],
                'new_counts' => $newParsed['counts'],
            ],
            'people_added' => count($addedPeople),
            'people_removed' => count($removedPeople),
            'people_changed' => count($changedPeople),
            'families_added' => count($addedFam),
            'families_removed' => count($removedFam),
            'detail' => [
                'people_added_xrefs' => $addedPeople,
                'people_removed_xrefs' => $removedPeople,
                'people_changed_xrefs' => array_slice($changedPeople, 0, 200),
                'families_added_xrefs' => $addedFam,
                'families_removed_xrefs' => $removedFam,
            ],
        ];
    }
}
