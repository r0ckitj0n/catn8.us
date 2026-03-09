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
            '/\b(?:store|shop|ticket|tickets|web|inst|xfer|bill|ebill|payment|pymt|online|effective)\b/i',
            '/\b(?:x{3,}|\*{3,})[a-z0-9-]*\b/i',
            '/\b(?:acct|account|checking|savings|card)\s+(?:ending\s+in\s+)?(?:x{2,}|\*{2,})?[a-z0-9-]{2,}\b/i',
            '/\b(?:pl\s*[a-z0-9]{1,6}\s+payment|payment)\b/i',
            '/\b(?:cumming(?:\s+ga)?|dawsonville(?:\s+ga)?|alpharetta(?:\s+ga)?|atlanta(?:\s+ga)?|suwanee(?:\s+ga)?|buford(?:\s+ga)?|gainesville(?:\s+ga)?|loganville(?:\s+ga)?|ball\s+ground(?:\s+ga)?|woodstock(?:\s+ga)?|sedona(?:\s+az)?|salem(?:\s+nh)?|missoula(?:\s+mt)?|concord(?:\s+nh)?|new\s+york(?:\s+ny)?|portsmouth(?:\s+nh)?|cleveland(?:\s+ga)?|hunt\s+valley(?:\s+md)?|kaysville(?:\s+ut)?|mountain\s+view(?:\s+ca)?|stone\s+mtn|st\s+mountain)\b/i',
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
            '/^(?:digital|pos)\s*-\s*(?:\d{2}-\d{2}-\d{2}\s*)?/i',
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
        $dedupedWords = preg_replace('/\b([a-z0-9&\'.-]+)\s+\1\b/i', '$1', $name);
        if (is_string($dedupedWords) && trim($dedupedWords) !== '') {
            $name = trim($dedupedWords);
        }
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
                'parent_name' => '360 Checking Card Adjustment',
                'match_rule' => 'Contains the 360 checking card adjustment import prefix',
                'examples' => [
                    '360 Checking Card Adjustment Signature (credit) Tractor Supply',
                    '360 Checking Card Adjustment Signature (credit) Marshalls',
                ],
                'match_fragments' => ['360adjustment', '360checkingcardadjustment'],
                'match_contains' => ['360 checking card adjustment', '360 checking card', '360 adjustment signature'],
            ],
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
                'match_rule' => 'Contains Amazon or Amzn billing text',
                'examples' => ['Chase / JPMCB (Amazon)', 'Amznpharma Amzn Com Bil', 'AMAZON COM ...'],
                'match_fragments' => ['amazon', 'amzn'],
                'match_contains' => ['amazon', 'amzn'],
            ],
            [
                'parent_name' => 'Apple',
                'match_rule' => 'Contains Apple billing or subscription text',
                'examples' => ['Apple Com Bill', 'Apple Photo Storage - 200GB (Apple Subscription)', 'Apple Tv+ (Apple Subscription)'],
                'match_fragments' => ['apple'],
                'match_contains' => ['apple com bill', 'apple subscription', 'apple tv', 'apple photo storage', 'apple'],
            ],
            [
                'parent_name' => 'Walmart',
                'match_rule' => 'Contains "walmart"',
                'examples' => ['360 Checking Card Adjustment Signature (credit) Walmart Sc'],
                'match_fragments' => ['walmart'],
            ],
            [
                'parent_name' => 'Prose',
                'match_rule' => 'Contains Prose subscription text',
                'examples' => ['Prose Prose R25124958 Brooklyn', 'Prose Prose R25711189 Brooklyn'],
                'match_fragments' => ['prose'],
                'match_contains' => ['prose prose', 'prose'],
            ],
            [
                'parent_name' => 'Dawsonville Car Wash',
                'match_rule' => 'Contains Dawsonville Car Wash transaction text',
                'examples' => ['190 Dawsonville Car Wa Dawsonville'],
                'match_fragments' => ['carwa'],
                'match_contains' => ['dawsonville car wa', 'dawsonville car wash'],
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
                'parent_name' => 'Barclay Bank',
                'match_rule' => 'Contains Barclay or Juniper credit card payment text',
                'examples' => ['Barclaycard Us Creditcard Chk', 'Withdrawal From Barclaycard Us Creditcard', 'Juniper (Barclays)'],
                'match_fragments' => ['barclay', 'barclays', 'barclaycard', 'juniper'],
                'match_contains' => ['barclay', 'barclays', 'barclaycard', 'juniper'],
            ],
            [
                'parent_name' => 'ChatGPT',
                'match_rule' => 'Contains "chatgpt" or "openai"',
                'examples' => ['Openai Chatgpt Credit'],
                'match_fragments' => ['chatgpt', 'openai'],
            ],
            [
                'parent_name' => 'Anthropic',
                'match_rule' => 'Contains Anthropic or Claude billing text',
                'examples' => ['Anthropic Anthropic.com', 'Anthropic San Francisc', 'Claude.ai Subscrip Anthropic.com'],
                'match_fragments' => ['anthropic', 'claudeai'],
                'match_contains' => ['anthropic', 'claude.ai'],
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
                'parent_name' => 'Ace Hardware Hammonds',
                'match_rule' => 'Contains Ace Hardware Hammonds',
                'examples' => ['Ace Hardware Hammonds Cumming'],
                'match_fragments' => ['acehardwarehammonds'],
                'match_contains' => ['ace hardware hammonds'],
            ],
            [
                'parent_name' => 'Abacus.ai',
                'match_rule' => 'Contains Abacus.ai billing text',
                'examples' => ['Abacus.ai Abacus.ai'],
                'match_fragments' => ['abacusai'],
                'match_contains' => ['abacus.ai', 'abacus ai'],
            ],
            [
                'parent_name' => 'Cursor',
                'match_rule' => 'Contains Cursor billing text',
                'examples' => ['Cursor Usage Jun Cursor.com', 'Cursor, Ai Powered Cursor.com'],
                'match_fragments' => ['cursor'],
                'match_contains' => ['cursor.com', 'cursor usage', 'cursor'],
            ],
            [
                'parent_name' => 'Food Lion',
                'match_rule' => 'Contains "food lion"',
                'examples' => ['Food Lion #2132 59 Mai Dawsonville, Ga U'],
                'match_fragments' => ['foodlion'],
            ],
            [
                'parent_name' => 'Burger Shake 8',
                'match_rule' => 'Contains Burger Shake 8',
                'examples' => ['Burger Shake 8 Dawsonville'],
                'match_fragments' => ['burgershake8'],
                'match_contains' => ['burger shake 8'],
            ],
            [
                'parent_name' => "Charlie's Tire Shop",
                'match_rule' => 'Contains Charlies Tire Shop',
                'examples' => ['Charlies Tire Shop Dawsonville'],
                'match_fragments' => ['charliestireshop'],
                'match_contains' => ['charlies tire shop'],
            ],
            [
                'parent_name' => "Chili's",
                'match_rule' => 'Contains Chilis transaction text',
                'examples' => ['Chili S Cumming Cumming'],
                'match_fragments' => ['chilis'],
                'match_contains' => ['chili s', 'chilis'],
            ],
            [
                'parent_name' => 'Chopsticks China Bistro',
                'match_rule' => 'Contains Chopsticks China Bistro',
                'examples' => ['Chopsticks China Bistr Cumming'],
                'match_fragments' => ['chopstickschinabistr'],
                'match_contains' => ['chopsticks china bistr', 'chopsticks china bistro'],
            ],
            [
                'parent_name' => 'Cloud 9 Smoke and Vape',
                'match_rule' => 'Contains Cloud 9 Smoke and Vape',
                'examples' => ['Cloud 9 Smoke And Vape Loganville'],
                'match_fragments' => ['cloud9smokeandvape'],
                'match_contains' => ['cloud 9 smoke and vape'],
            ],
            [
                'parent_name' => 'Cracker Barrel',
                'match_rule' => 'Contains Cracker Barrel',
                'examples' => ['Cracker Barrel #'],
                'match_fragments' => ['crackerbarrel'],
                'match_contains' => ['cracker barrel'],
            ],
            [
                'parent_name' => 'Cue Barbecue',
                'match_rule' => 'Contains Cue Barbecue',
                'examples' => ['Cue Barbecue Cumming'],
                'match_fragments' => ['cuebarbecue'],
                'match_contains' => ['cue barbecue'],
            ],
            [
                'parent_name' => 'Amoco Oil',
                'match_rule' => 'Contains Amoco gas station text',
                'examples' => ['Amoco#1642700ox Oxford, Ga'],
                'match_fragments' => ['amoco'],
                'match_contains' => ['amoco'],
            ],
            [
                'parent_name' => 'Causey Hall Orthodontics',
                'match_rule' => 'Contains Causey Hall Orthodontics',
                'examples' => ['Causey Hall Orthodont Cumming'],
                'match_fragments' => ['causeyhallorthodont'],
                'match_contains' => ['causey hall orthodont'],
            ],
            [
                'parent_name' => 'Coweta-Fayette EMC',
                'match_rule' => 'Contains Coweta-Fayette EMC payment text',
                'examples' => ['Withdrawal From Cowetafayetteemc Payment'],
                'match_fragments' => ['cowetafayetteemc'],
                'match_contains' => ['cowetafayetteemc'],
            ],
            [
                'parent_name' => 'ATM Withdrawal',
                'match_rule' => 'Contains ATM withdrawal text',
                'examples' => ['Atm Withdrawal - Walgreens #1-we1 Wwe10410 Cumming,', 'Atm Withdrawal - Event Coordi-722959 P722959 Edgefield,'],
                'match_fragments' => ['atmwithdrawal'],
                'match_contains' => ['atm withdrawal'],
            ],
            [
                'parent_name' => "Lowe's",
                'match_rule' => 'Contains Lowe\'s purchase text',
                'examples' => ["Lowe's #678 Cumming, Ga", '360 Checking Card Adjustment Signature (credit) Lowe S Of Cumming Ga Cumming'],
                'match_fragments' => ['lowes', 'lowesof'],
                'match_contains' => ["lowe's", 'lowe s', 'lowes'],
            ],
            [
                'parent_name' => 'Tractor Supply',
                'match_rule' => 'Contains Tractor Supply purchase text',
                'examples' => ['360 Checking Card Adjustment Signature (credit) Tractor Supply'],
                'match_fragments' => ['tractorsupply'],
                'match_contains' => ['tractor supply'],
            ],
            [
                'parent_name' => 'Walgreens',
                'match_rule' => 'Contains Walgreens purchase or ATM withdrawal text',
                'examples' => ['Atm Withdrawal - Walgreens #1-we1 Wwe10410 Cumming,'],
                'match_fragments' => ['walgreens'],
                'match_contains' => ['walgreens'],
            ],
            [
                'parent_name' => 'Costco',
                'match_rule' => 'Contains Costco gas or warehouse text',
                'examples' => ['Costco Gas #1175 Cumming, Ga', 'Costco Whse #1175 Cumming, Ga'],
                'match_fragments' => ['costco'],
                'match_contains' => ['costco'],
            ],
            [
                'parent_name' => 'CVS Pharmacy',
                'match_rule' => 'Contains CVS Pharmacy text',
                'examples' => ['Cvs/pharm', 'Cvs/pharmacy #05'],
                'match_fragments' => ['cvspharm', 'cvspharmacy'],
                'match_contains' => ['cvs/pharm', 'cvs/pharmacy', 'cvs pharmacy'],
            ],
            [
                'parent_name' => 'Dawsonville News',
                'match_rule' => 'Contains Dawsonville News text',
                'examples' => ['Dawsonville News', 'Dawsonville News (Mom)'],
                'match_fragments' => ['dawsonvillenews'],
                'match_contains' => ['dawsonville news'],
            ],
            [
                'parent_name' => 'Dawsonville Hardware',
                'match_rule' => 'Contains Dawsonville Hardware text',
                'examples' => ['Dawsonville Hardware C Dawsonville'],
                'match_fragments' => ['dawsonvillehardware'],
                'match_contains' => ['dawsonville hardware'],
            ],
            [
                'parent_name' => 'Fifth Third Bank',
                'match_rule' => 'Contains Fifth Third or 53 Bank text',
                'examples' => ['53 Bank', '5/3rd Card', 'Fifth Third Bank Web Pay Chk'],
                'match_fragments' => ['53bank', '53rdcard', 'fifththirdbank'],
                'match_contains' => ['53 bank', '5/3rd', 'fifth third'],
            ],
            [
                'parent_name' => 'Google One',
                'match_rule' => 'Contains Google One billing text',
                'examples' => ['Google One Google Com'],
                'match_fragments' => ['googleone'],
                'match_contains' => ['google one', 'google com'],
            ],
            [
                'parent_name' => 'QuikTrip',
                'match_rule' => 'Contains QuikTrip shorthand',
                'examples' => ['Qt'],
                'match_fragments' => ['qt'],
                'match_contains' => [' qt ', 'quiktrip'],
            ],
            [
                'parent_name' => 'Hall Hound Brewing',
                'match_rule' => 'Contains Hall Hound Brewing',
                'examples' => ['Hall Hound Brewing Cumming'],
                'match_fragments' => ['hallhoundbrewing'],
                'match_contains' => ['hall hound brewing'],
            ],
            [
                'parent_name' => "Guthrie's",
                'match_rule' => 'Contains Guthries transaction text',
                'examples' => ['Guthries Cumming Ga Cumming'],
                'match_fragments' => ['guthries'],
                'match_contains' => ['guthries'],
            ],
            [
                'parent_name' => 'Japanese Automotive Professionals',
                'match_rule' => 'Contains Japanese Automotive Professionals',
                'examples' => ['Japanese Automotive Pr Cumming'],
                'match_fragments' => ['japaneseautomotivepr'],
                'match_contains' => ['japanese automotive pr'],
            ],
            [
                'parent_name' => "Johnny's New York Style Pizza",
                'match_rule' => 'Contains Johnnys New York Style',
                'examples' => ['Johnnys New York Style Cumming'],
                'match_fragments' => ['johnnysnewyorkstyle'],
                'match_contains' => ['johnnys new york style'],
            ],
            [
                'parent_name' => 'La Hacienda Bar & Grill',
                'match_rule' => 'Contains La Hacienda Bar & Grill',
                'examples' => ['La Hacienda Bar Gril Cumming'],
                'match_fragments' => ['lahaciendabargril'],
                'match_contains' => ['la hacienda bar gril', 'la hacienda bar grill'],
            ],
            [
                'parent_name' => 'Lanier Dental Partners',
                'match_rule' => 'Contains Lanier Dental Partners',
                'examples' => ['Lanier Dental Partners Dawsonville'],
                'match_fragments' => ['lanierdentalpartners'],
                'match_contains' => ['lanier dental partners'],
            ],
            [
                'parent_name' => "O'Reilly Auto Parts",
                'match_rule' => 'Contains O\'Reilly auto parts text',
                'examples' => ["O'reilly"],
                'match_fragments' => ['oreilly'],
                'match_contains' => ["o'reilly", 'oreilly'],
            ],
            [
                'parent_name' => 'Planet Fitness',
                'match_rule' => 'Contains Planet Fitness billing text',
                'examples' => ['Planet Fitness D Iclub Fees Chk', 'Planet Fitness D Retry Pymt Chk'],
                'match_fragments' => ['planetfitness'],
                'match_contains' => ['planet fitness'],
            ],
            [
                'parent_name' => 'Patientco',
                'match_rule' => 'Contains Patientco payment text',
                'examples' => ['Withdrawal From Patientco Inc Web Pmts'],
                'match_fragments' => ['patientco'],
                'match_contains' => ['patientco'],
            ],
            [
                'parent_name' => "Papa's Place",
                'match_rule' => 'Contains Papa\'s Place text',
                'examples' => ['Papas Place Dawsonville'],
                'match_fragments' => ['papasplace'],
                'match_contains' => ['papas place', "papa's place"],
            ],
            [
                'parent_name' => 'Microsoft',
                'match_rule' => 'Contains Microsoft billing text',
                'examples' => ['Microsoft Store Redmond', 'Microsoft Azure & 365', 'Microsoft One Drive'],
                'match_fragments' => ['microsoft'],
                'match_contains' => ['microsoft'],
            ],
            [
                'parent_name' => 'Regal Cinemas',
                'match_rule' => 'Contains Regal movie theater text',
                'examples' => ['Regal Cinemas Inc', 'Regal Mall Of Ga'],
                'match_fragments' => ['regal'],
                'match_contains' => ['regal cinemas', 'regal mall'],
            ],
            [
                'parent_name' => 'Red Oak Sanitation',
                'match_rule' => 'Contains Red Oak Sanitation billing text',
                'examples' => ['Red Oak Sanitation', 'Withdrawal From Redoaksanita3168 Cons'],
                'match_fragments' => ['redoaksanita', 'redoaksanitation'],
                'match_contains' => ['red oak sanitation', 'redoaksanita'],
            ],
            [
                'parent_name' => 'Replit',
                'match_rule' => 'Contains Replit billing text',
                'examples' => ['Replit Inc', 'Replit, Inc. Replit.com'],
                'match_fragments' => ['replit'],
                'match_contains' => ['replit.com', 'replit'],
            ],
            [
                'parent_name' => 'Ross',
                'match_rule' => 'Contains Ross Stores transaction text',
                'examples' => ['Ross Stores #1846 Dawsonville, Ga'],
                'match_fragments' => ['rossstores'],
                'match_contains' => ['ross stores'],
            ],
            [
                'parent_name' => 'Shell',
                'match_rule' => 'Contains Shell station text',
                'examples' => ['Shell57544805609 Buford', 'Shell Service Station Hahira, Ga'],
                'match_fragments' => ['shell'],
                'match_contains' => ['shell service station', 'shell'],
            ],
            [
                'parent_name' => 'Smoothie King',
                'match_rule' => 'Contains Smoothie King text',
                'examples' => ['Par Smoothie King Sk13 Cumming'],
                'match_fragments' => ['smoothieking'],
                'match_contains' => ['smoothie king'],
            ],
            [
                'parent_name' => 'Target',
                'match_rule' => 'Contains Target purchase text',
                'examples' => ['Target T-1394 Cumming, Ga', '360 Checking Card Adjustment Signature (credit) Target Plus Brooklyn Par'],
                'match_fragments' => ['target'],
                'match_contains' => ['target plus', 'target t-', 'target'],
            ],
            [
                'parent_name' => 'Tropical Smoothie Cafe',
                'match_rule' => 'Contains Tropical Smoothie Cafe',
                'examples' => ['Tropical Smoothie Cafe Cumming'],
                'match_fragments' => ['tropicalsmoothiecafe'],
                'match_contains' => ['tropical smoothie cafe'],
            ],
            [
                'parent_name' => 'UPS Store',
                'match_rule' => 'Contains UPS Store transaction text',
                'examples' => ['The Ups Store'],
                'match_fragments' => ['theupsstore', 'upsstore'],
                'match_contains' => ['the ups store', 'ups store'],
            ],
            [
                'parent_name' => 'Venmo',
                'match_rule' => 'Contains Venmo transfer text',
                'examples' => ['Deposit - Rtp Paid From Venmo', 'Venmo Payment Chk', 'Withdrawal From Venmo Payment'],
                'match_fragments' => ['venmo'],
                'match_contains' => ['venmo'],
            ],
            [
                'parent_name' => "Wendy's",
                'match_rule' => 'Contains Wendys transaction text',
                'examples' => ['Wendys 82 Dawsonville'],
                'match_fragments' => ['wendys'],
                'match_contains' => ['wendys'],
            ],
            [
                'parent_name' => 'Wild Wing Cafe',
                'match_rule' => 'Contains Wild Wing Cafe text',
                'examples' => ['Wild Wing Cafe Daws Dawsonville'],
                'match_fragments' => ['wildwingcafe'],
                'match_contains' => ['wild wing cafe'],
            ],
            [
                'parent_name' => 'Windsurf',
                'match_rule' => 'Contains Windsurf billing text',
                'examples' => ['Windsurf Mountain View', 'Windsurf Windsurf.com'],
                'match_fragments' => ['windsurf'],
                'match_contains' => ['windsurf.com', 'windsurf mountain view', 'windsurf'],
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
        $normalizedText = strtolower(accumul8_entity_normalize_text($value, 191));
        $matchKey = accumul8_entity_match_key($value);
        if ($matchKey === '' && $normalizedText === '') {
            return null;
        }

        foreach (accumul8_entity_family_definitions() as $definition) {
            $contains = is_array($definition['match_contains'] ?? null) ? $definition['match_contains'] : [];
            foreach ($contains as $fragment) {
                $needle = strtolower(accumul8_entity_normalize_text((string)$fragment, 191));
                if ($needle !== '' && $normalizedText !== '' && strpos($normalizedText, $needle) !== false) {
                    return $definition;
                }
            }

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
