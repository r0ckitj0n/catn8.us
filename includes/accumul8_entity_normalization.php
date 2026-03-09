<?php

declare(strict_types=1);

if (!function_exists('accumul8_entity_normalize_text')) {
    function accumul8_entity_normalize_text($value, int $maxLen = 191): string
    {
        $v = trim((string)$value);
        if ($v === '') {
            return '';
        }
        $v = preg_replace('/\s+/', ' ', $v);
        if (!is_string($v)) {
            return '';
        }
        if ($maxLen > 0 && strlen($v) > $maxLen) {
            $v = substr($v, 0, $maxLen);
        }
        return trim($v);
    }
}

if (!function_exists('accumul8_canonical_entity_name')) {
    function accumul8_canonical_entity_name(string $value): string
    {
        $name = accumul8_entity_normalize_text($value, 191);
        if ($name === '') {
            return '';
        }

        $replacements = [
            '/\bamzn\.?\s*com\/?(?:bill|bil)\b/i',
            '/\(\s*[$-]?\d[\d,]*(?:\.\d{2})?\s*\)/i',
            '/\b(?:debit|credit)\s*-\s*[$-]?\d[\d,]*(?:\.\d{2})?\s*$/i',
            '/\b(?:debit|credit)\b/i',
            '/\b[$-]?\d[\d,]*(?:\.\d{2})?\s*$/i',
            '/\b(?:x{3,}|\*{3,})[a-z0-9-]*\b/i',
            '/\b(?:acct|account|checking|savings|card)\s+(?:ending\s+in\s+)?(?:x{2,}|\*{2,})?[a-z0-9-]{2,}\b/i',
            '/\b(?:pl\s*[a-z0-9]{1,6}\s+payment|payment)\b/i',
            '/\b(?:cumming(?:\s+ga)?|dawsonville(?:\s+ga)?|alpharetta(?:\s+ga)?|atlanta(?:\s+ga)?|suwanee(?:\s+ga)?|buford(?:\s+ga)?)\b/i',
            '/\b(?:wa|ga|al|fl|nc|sc|tn|va|md)\b$/i',
        ];
        foreach ($replacements as $pattern) {
            $next = preg_replace($pattern, ' ', $name);
            if (is_string($next)) {
                $name = $next;
            }
        }

        $prefixPatterns = [
            '/^(?:debit card purchase|digital card purchase|card purchase|purchase)\s*-\s*/i',
            '/^(?:withdrawal|deposit|payment|transfer)\s+(?:to|from)\s+/i',
            '/^(?:direct\s+(?:from|to)|online transfer\s+(?:from|to)|ach\s+(?:credit|debit|payment|transfer))\s*[-:]?\s*/i',
        ];
        foreach ($prefixPatterns as $pattern) {
            $next = preg_replace($pattern, '', $name, 1);
            if (is_string($next)) {
                $name = $next;
            }
        }

        $cleanupPatterns = [
            '/\b(?:debit|credit)\b\s*$/i',
            '/^[\s\-:;,]+/u',
            '/[\s\-:;,]+$/u',
            '/\s+/u',
        ];
        foreach ($cleanupPatterns as $pattern) {
            $next = preg_replace($pattern, $pattern === '/\s+/u' ? ' ' : '', $name);
            if (is_string($next)) {
                $name = $next;
            }
        }

        $name = trim($name);
        $joinedInitials = preg_replace('/\b([a-z])[\.\s]+([a-z])\b/i', '$1$2', $name);
        if (is_string($joinedInitials) && trim($joinedInitials) !== '') {
            $name = trim($joinedInitials);
        }
        if ($name === '') {
            return accumul8_entity_normalize_text($value, 191);
        }
        return accumul8_entity_normalize_text($name, 191);
    }
}

if (!function_exists('accumul8_entity_match_key')) {
    function accumul8_entity_match_key(string $value): string
    {
        $canonical = accumul8_canonical_entity_name($value);
        if ($canonical === '') {
            return '';
        }
        $key = preg_replace('/[^a-z0-9]+/i', '', strtolower($canonical));
        return is_string($key) ? $key : '';
    }
}

if (!function_exists('accumul8_entity_family_definitions')) {
    function accumul8_entity_family_definitions(): array
    {
        static $definitions = null;
        if (is_array($definitions)) {
            return $definitions;
        }

        $definitions = [
            [
                'parent_name' => "McDonald's",
                'match_rule' => 'Contains "mcdonald"',
                'examples' => ['Mcdonald S F11591 Dawsonville', 'Mcdonald S F27153 Cumming'],
                'match_fragments' => ['mcdonald'],
            ],
            [
                'parent_name' => 'Home Depot',
                'match_rule' => 'Contains "home depot"',
                'examples' => ['The Home Depot', 'Withdrawal From Home Depot Online Pmt', 'Home Depot Card'],
                'match_fragments' => ['homedepot'],
            ],
            [
                'parent_name' => 'Amazon',
                'match_rule' => 'Contains "amazon"',
                'examples' => ['Chase / JPMCB (Amazon)', '360 Checking Card Adjustment Signature (credit) Amazon...'],
                'match_fragments' => ['amazon'],
            ],
            [
                'parent_name' => 'Walmart',
                'match_rule' => 'Contains "walmart"',
                'examples' => ['360 Checking Card Adjustment Signature (credit) Walmart Sc'],
                'match_fragments' => ['walmart'],
            ],
            [
                'parent_name' => 'ATT',
                'match_rule' => 'Contains "att"',
                'examples' => ['Withdrawal From Att Payment'],
                'match_fragments' => ['attpayment', 'att'],
            ],
            [
                'parent_name' => 'Achieve',
                'match_rule' => 'Contains "achieve"',
                'examples' => ['Withdrawal From Achieve Pl 13r Payment', 'Ach'],
                'match_fragments' => ['achieve'],
            ],
            [
                'parent_name' => 'Amicalola EMC',
                'match_rule' => 'Contains "amicalola"',
                'examples' => ['Withdrawal From Amicalola Emc Payment'],
                'match_fragments' => ['amicalola'],
            ],
            [
                'parent_name' => 'Juniper (Barclays)',
                'match_rule' => 'Contains "juniper"',
                'examples' => ['Juniper'],
                'match_fragments' => ['juniper'],
            ],
            [
                'parent_name' => 'ChatGPT',
                'match_rule' => 'Contains "chatgpt" or "openai"',
                'examples' => ['Openai Chatgpt Credit'],
                'match_fragments' => ['chatgpt', 'openai'],
            ],
            [
                'parent_name' => 'Ingles Markets',
                'match_rule' => 'Contains "ingles"',
                'examples' => ['Ingles Markets Dawsonville, Ga'],
                'match_fragments' => ['ingles'],
            ],
            [
                'parent_name' => 'Dollar General',
                'match_rule' => 'Contains "dollar general"',
                'examples' => ['Dollar General # Dg 06 Dawsonville, Ga U', 'Dollar General # Dg 22 Gainesville, Ga U'],
                'match_fragments' => ['dollargeneral'],
            ],
            [
                'parent_name' => 'LongHorn Steakhouse',
                'match_rule' => 'Contains "longhorn"',
                'examples' => ['Longhorn Steak', 'Longhorn Stk Ec'],
                'match_fragments' => ['longhorn'],
            ],
            [
                'parent_name' => 'Intl Transaction Fee',
                'match_rule' => 'Contains "intl transaction fee"',
                'examples' => ['Intl Transaction Fee 06-20-25 Maifeng9x7u'],
                'match_fragments' => ['intltransactionfee'],
            ],
            [
                'parent_name' => 'Factory.ai',
                'match_rule' => 'Contains "factory.ai" or "factory ai"',
                'examples' => ['Factory Ai Factory.ai', 'Factory Factory.ai'],
                'match_fragments' => ['factoryai'],
            ],
            [
                'parent_name' => 'Five Guys',
                'match_rule' => 'Contains "five guys"',
                'examples' => ['Five Guys Nc'],
                'match_fragments' => ['fiveguys'],
            ],
            [
                'parent_name' => 'Food Lion',
                'match_rule' => 'Contains "food lion"',
                'examples' => ['Food Lion #2132 59 Mai Dawsonville, Ga U'],
                'match_fragments' => ['foodlion'],
            ],
            [
                'parent_name' => 'GoDaddy',
                'match_rule' => 'Contains "godaddy"',
                'examples' => ['Dnh*godaddy#370838', 'Dnh*godaddy#401939'],
                'match_fragments' => ['godaddy'],
            ],
        ];

        return $definitions;
    }
}

if (!function_exists('accumul8_find_entity_family_definition')) {
    function accumul8_find_entity_family_definition(string $value): ?array
    {
        $matchKey = accumul8_entity_match_key($value);
        if ($matchKey === '') {
            return null;
        }

        foreach (accumul8_entity_family_definitions() as $definition) {
            $fragments = is_array($definition['match_fragments'] ?? null) ? $definition['match_fragments'] : [];
            foreach ($fragments as $fragment) {
                $needle = strtolower((string)$fragment);
                if ($needle !== '' && strpos($matchKey, $needle) !== false) {
                    return $definition;
                }
            }
        }

        return null;
    }
}

if (!function_exists('accumul8_entity_alias_name')) {
    function accumul8_entity_alias_name(string $value): string
    {
        $canonical = accumul8_canonical_entity_name($value);
        $matchKey = accumul8_entity_match_key($canonical);
        if ($matchKey === '') {
            return $canonical;
        }
        if (preg_match('/^a[ze]pharmacyllc/', $matchKey) === 1) {
            return 'AZ Pharmacy LLC';
        }
        if (preg_match('/^acehardwarehammonds/', $matchKey) === 1) {
            return 'Ace Hardware Hammonds';
        }
        if (preg_match('/^achieve/', $matchKey) === 1) {
            return 'Achieve';
        }

        $family = accumul8_find_entity_family_definition($canonical);
        if (is_array($family) && trim((string)($family['parent_name'] ?? '')) !== '') {
            return (string)$family['parent_name'];
        }

        return $canonical;
    }
}

if (!function_exists('accumul8_entity_alias_display_name')) {
    function accumul8_entity_alias_display_name(string $value): string
    {
        return accumul8_canonical_entity_name($value);
    }
}

if (!function_exists('accumul8_entity_endex_guides')) {
    function accumul8_entity_endex_guides(): array
    {
        return array_map(static function (array $definition): array {
            return [
                'parent_name' => (string)($definition['parent_name'] ?? ''),
                'match_rule' => (string)($definition['match_rule'] ?? ''),
                'examples' => array_values(array_map('strval', is_array($definition['examples'] ?? null) ? $definition['examples'] : [])),
            ];
        }, accumul8_entity_family_definitions());
    }
}
