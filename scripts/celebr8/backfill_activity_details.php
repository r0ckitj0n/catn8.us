#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Idempotent Celebr8 activity details backfill.
 *
 * Only fills empty detail fields (summary empty / details_filled_at null).
 * Never overwrites non-empty detail fields Jon already edited.
 *
 * Usage:
 *   php scripts/celebr8/backfill_activity_details.php --via-agent [--apply] [--limit=N] [--id=N]
 *   php scripts/celebr8/backfill_activity_details.php --local [--apply]
 *
 * --via-agent talks to https://catn8.us with the agent bearer token (fills live library).
 * Dry-run is default; pass --apply to write.
 */

$root = dirname(__DIR__, 2);
require_once $root . '/api/bootstrap.php';
require_once $root . '/includes/celebr8_catalog_model.php';

$args = [
    'apply' => false,
    'via_agent' => false,
    'local' => false,
    'limit' => 0,
    'id' => 0,
    'base' => 'https://catn8.us',
];
foreach (array_slice($argv, 1) as $arg) {
    if ($arg === '--apply') {
        $args['apply'] = true;
    } elseif ($arg === '--via-agent') {
        $args['via_agent'] = true;
    } elseif ($arg === '--local') {
        $args['local'] = true;
    } elseif (str_starts_with($arg, '--limit=')) {
        $args['limit'] = max(0, (int)substr($arg, 8));
    } elseif (str_starts_with($arg, '--id=')) {
        $args['id'] = max(0, (int)substr($arg, 5));
    } elseif (str_starts_with($arg, '--base=')) {
        $args['base'] = rtrim(substr($arg, 7), '/');
    }
}

if (!$args['via_agent'] && !$args['local']) {
    fwrite(STDERR, "Pass --via-agent or --local\n");
    exit(1);
}

function load_agent_token(string $root): string
{
    $candidates = [
        $root . '/.local/state/celebr8/agent-api-token',
        getenv('HOME') . '/.local/state/catn8/celebr8/agent-api-token',
        (string)getenv('CELEBR8_AGENT_TOKEN'),
    ];
    foreach ($candidates as $path) {
        if ($path !== '' && is_file($path)) {
            return trim((string)file_get_contents($path));
        }
    }
    $env = trim((string)getenv('CELEBR8_AGENT_TOKEN'));
    if ($env !== '') {
        return $env;
    }
    throw new RuntimeException('Missing agent token file/env');
}

function agent_request(string $base, string $token, string $method, string $action, ?array $body = null): array
{
    $url = $base . '/api/celebr8_agent.php?action=' . rawurlencode($action);
    $headers = [
        'Accept: application/json',
        'Authorization: Bearer ' . $token,
    ];
    $opts = [
        'http' => [
            'method' => $method,
            'header' => implode("\r\n", $headers),
            'timeout' => 60,
            'ignore_errors' => true,
        ],
    ];
    if ($body !== null) {
        $opts['http']['header'] .= "\r\nContent-Type: application/json";
        $opts['http']['content'] = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    $raw = file_get_contents($url, false, stream_context_create($opts));
    if ($raw === false) {
        throw new RuntimeException('HTTP failure for ' . $action);
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Invalid JSON for ' . $action . ': ' . substr($raw, 0, 200));
    }
    if (empty($decoded['success'])) {
        throw new RuntimeException($action . ' failed: ' . (string)($decoded['error'] ?? $raw));
    }
    return $decoded;
}

function needs_details(array $a): bool
{
    return trim((string)($a['summary'] ?? '')) === ''
        && empty($a['details_filled_at'])
        && empty($a['has_details']);
}

function money(float $n): float
{
    return round($n, 2);
}

function supply_rows(array $legacy, array $priced): array
{
    $out = [];
    $seen = [];
    foreach ($priced as $row) {
        $item = trim((string)($row['item'] ?? ''));
        if ($item === '' || isset($seen[strtolower($item)])) {
            continue;
        }
        $seen[strtolower($item)] = true;
        $out[] = [
            'item' => $item,
            'qty' => (string)($row['qty'] ?? '1'),
            'unit_cost_est' => isset($row['unit_cost_est']) ? money((float)$row['unit_cost_est']) : null,
            'notes' => (string)($row['notes'] ?? ''),
            'have' => 0,
        ];
    }
    foreach ($legacy as $label) {
        $item = trim((string)$label);
        if ($item === '' || isset($seen[strtolower($item)])) {
            continue;
        }
        $seen[strtolower($item)] = true;
        $out[] = [
            'item' => $item,
            'qty' => '1',
            'unit_cost_est' => null,
            'notes' => 'From library supply list',
            'have' => 0,
        ];
    }
    return $out;
}

function estimate_range(array $supplies): array
{
    $sum = 0.0;
    $has = false;
    foreach ($supplies as $s) {
        if ($s['unit_cost_est'] === null) {
            continue;
        }
        $qty = max(1.0, (float)preg_replace('/[^0-9.]/', '', (string)$s['qty']) ?: 1);
        $sum += ((float)$s['unit_cost_est']) * $qty;
        $has = true;
    }
    if (!$has) {
        return [15.0, 40.0];
    }
    $low = money(max(0, $sum * 0.85));
    $high = money($sum * 1.25 + 8);
    return [$low, $high];
}

function holiday_variations(string $holiday, string $name): array
{
    $base = [
        'Halloween: add fog, orange/black tablecloths, and spooky labels.',
        "New Year's Eve: swap prizes for midnight favor bags; run near countdown.",
        'Labor Day: outdoor-friendly version with shade, coolers, and sunscreen nearby.',
        'Birthday: personalize signs/ballots with the honoree’s name.',
        'Game Night: shorter rounds so more people rotate through.',
    ];
    if ($holiday === 'Halloween') {
        array_unshift($base, 'Lean into costumes: bonus points for themed participation.');
    }
    if (stripos($name, 'bingo') !== false) {
        $base[] = 'Print extra cards; expect late arrivals to join mid-round.';
    }
    return array_slice($base, 0, 5);
}

function printable_ballot(string $title, array $categories): array
{
    $lines = [$title, str_repeat('=', min(48, strlen($title))), '', 'Guest name: ____________________  Table/crew: ______', ''];
    foreach ($categories as $cat) {
        $lines[] = $cat . ':';
        $lines[] = '1) ____________________';
        $lines[] = '2) ____________________';
        $lines[] = '';
    }
    $lines[] = 'Notes: ____________________________________________';
    $lines[] = 'Signature (optional): ______________________________';
    return [
        'title' => $title,
        'kind' => 'ballot',
        'content' => implode("\n", $lines),
    ];
}

function printable_scorecard(string $title, int $rounds = 5): array
{
    $lines = [$title, str_repeat('=', 40), '', 'Team / Player: ____________________', ''];
    $lines[] = sprintf('%-8s %-12s %-12s', 'Round', 'Score', 'Notes');
    $lines[] = str_repeat('-', 40);
    for ($i = 1; $i <= $rounds; $i++) {
        $lines[] = sprintf('%-8s %-12s %-12s', (string)$i, '______', '__________');
    }
    $lines[] = '';
    $lines[] = 'TOTAL: ________     Initials: ______';
    return [
        'title' => $title,
        'kind' => 'scorecard',
        'content' => implode("\n", $lines),
    ];
}

function printable_sign(string $title, string $body): array
{
    return [
        'title' => $title,
        'kind' => 'sign',
        'content' => $title . "\n" . str_repeat('=', 42) . "\n\n" . $body,
    ];
}

function printable_rules_card(string $name, array $bullets): array
{
    $lines = [strtoupper($name) . ' — STATION RULES', str_repeat('-', 42), ''];
    foreach ($bullets as $i => $b) {
        $lines[] = ($i + 1) . '. ' . $b;
    }
    $lines[] = '';
    $lines[] = 'Ask the host if you are unsure. Have fun!';
    return [
        'title' => $name . ' Rules Card',
        'kind' => 'rules',
        'content' => implode("\n", $lines),
    ];
}

/**
 * Hand-tuned packs for the Annual Halloween Bash headliners.
 *
 * @param array<string,mixed> $a
 * @return array<string,mixed>|null
 */
function special_pack(array $a): ?array
{
    $name = (string)$a['name'];
    $legacySupplies = is_array($a['supplies'] ?? null) ? $a['supplies'] : [];

    if (strcasecmp($name, 'Chili Cook-Off') === 0) {
        $supplies = supply_rows($legacySupplies, [
            ['item' => 'Tasting spoons (box)', 'qty' => '2', 'unit_cost_est' => 8.5, 'notes' => 'Disposable; ~100 spoons/box'],
            ['item' => 'Sample cups (2–3 oz)', 'qty' => '150', 'unit_cost_est' => 0.08, 'notes' => ''],
            ['item' => 'Ballot pads / pencils', 'qty' => '60', 'unit_cost_est' => 0.25, 'notes' => 'One per tasting guest'],
            ['item' => 'Crockpot labels + numbers', 'qty' => '12', 'unit_cost_est' => 0.4, 'notes' => 'Blind tasting numbers'],
            ['item' => 'Extension cords / power strips', 'qty' => '3', 'unit_cost_est' => 12, 'notes' => 'Borrow if possible'],
            ['item' => 'Napkins + wet wipes', 'qty' => '2', 'unit_cost_est' => 4, 'notes' => ''],
            ['item' => 'Water / palate cleansers', 'qty' => '2', 'unit_cost_est' => 5, 'notes' => 'Crackers or bread cubes'],
            ['item' => 'Champion prize', 'qty' => '1', 'unit_cost_est' => 15, 'notes' => 'Trophy, ladle, or gift card'],
        ]);
        [$low, $high] = estimate_range($supplies);
        return [
            'summary' => 'Guests bring crockpots of homemade chili for a blind tasting. Everyone samples numbered pots and votes for a champion — the centerpiece food contest of the Annual Halloween Bash (~50–70 guests).',
            'objective' => 'Crown one chili champion while feeding the room and keeping the tasting line moving without spoilers about who cooked what.',
            'how_to_play' => [
                'Chefs arrive with chili already hot in a crockpot or pot that can stay warm on-site.',
                'Host assigns each pot a tasting number and covers names until results are announced.',
                'Guests take a tasting spoon/cup, sample as many pots as they like, and mark ballots for favorite overall (optional: hottest, most creative).',
                'Collect ballots by the deadline announced on the station sign (usually mid-party).',
                'Tally votes, announce the champion, and reveal cook names.',
            ],
            'setup_instructions' => [
                'Place a long tasting table near power outlets; protect surfaces with foil or a vinyl cloth.',
                'Set numbered placards 1–N; leave a blank chef sheet for the host only.',
                'Stage spoons, cups, napkins, water, and ballot pencils at the start of the line.',
                'Tape extension cords flat and keep crockpot cords from crossing the walkway.',
                'Post the rules sign and ballot deadline where the line forms.',
            ],
            'teardown' => [
                'Unplug crockpots and let them cool before lids go in wash bins.',
                'Bag leftover chili into labeled take-home containers only if cooks agree.',
                'Trash tasting cups/spoons; wipe table; coil cords.',
                'Save ballots until the winner photo is done, then recycle.',
            ],
            'rules_scoring' => "Blind tasting only — do not label pots with cook names until after voting.\nOne ballot per guest.\nPoints: 3 for 1st choice, 2 for 2nd, 1 for 3rd (or single favorite if using a simpler ballot).\nTies: host run-off tasting among tied pots with three neutral judges.\nFood safety: chili must stay hot; discard any pot that sat unheated over 2 hours.",
            'winning_notes' => 'Champion gets a silly trophy or prize and bragging rights until next Halloween. Optional side awards: Hottest Kick, Best Vegetarian, Most Creative Name.',
            'supplies_detail' => $supplies,
            'estimated_cost_low' => $low,
            'estimated_cost_high' => $high,
            'setup_minutes' => 35,
            'play_minutes' => 90,
            'cleanup_minutes' => 25,
            'min_players' => 8,
            'max_players' => 70,
            'age_range' => '5+ tasting with adult help; voting 10+',
            'kid_friendly' => 1,
            'location_type' => 'indoor',
            'space_needed' => '8–12 ft tasting table + power',
            'energy_level' => 'low',
            'mess_level' => 'medium',
            'tech_needs' => 'Multiple outlets for crockpots; optional playlist nearby (not required).',
            'volunteers_needed' => '1 tasting-line host + 1 ballot counter',
            'safety_notes' => 'Hot surfaces and cords. Keep kids from touching crockpot sides. Have a labeled allergen note (dairy, beans, spice level) on each numbered card if cooks provide it.',
            'variations' => holiday_variations('Halloween', $name),
            'tips' => "Ask cooks to bring their own ladle.\nStart tasting after most guests arrive so early pots are not emptied by the same ten people.\nKeep a 'Not a Chili Chef?' pointer toward Monster Munchies.",
            'printables' => [
                printable_ballot('Chili Cook-Off Ballot', ['Overall favorite', 'Hottest (optional)', 'Most creative (optional)']),
                printable_sign('Chili Cook-Off Station', "Take a spoon + cup.\nTaste the numbered pots.\nMark your ballot before the deadline.\nNo peeking at cook names!"),
                printable_scorecard('Chili Cook-Off Tally Sheet', 12),
            ],
        ];
    }

    if (strcasecmp($name, 'Costume Contest') === 0) {
        $supplies = supply_rows($legacySupplies, [
            ['item' => 'Category signs (scariest / funniest / creative)', 'qty' => '3', 'unit_cost_est' => 2, 'notes' => 'Print or hand-letter'],
            ['item' => 'Ballots + pencils', 'qty' => '60', 'unit_cost_est' => 0.2, 'notes' => ''],
            ['item' => 'Number stickers for contestants', 'qty' => '40', 'unit_cost_est' => 0.15, 'notes' => ''],
            ['item' => 'Small prizes (3)', 'qty' => '3', 'unit_cost_est' => 8, 'notes' => 'Candy, trophy cups, gift cards'],
            ['item' => 'Backdrop sheet / lights (optional)', 'qty' => '1', 'unit_cost_est' => 12, 'notes' => 'Photo spot'],
        ]);
        [$low, $high] = estimate_range($supplies);
        return [
            'summary' => 'Guests parade costumes and the room votes for scariest, funniest, and most creative. Works for kids and adults; pair with a quick photo backdrop.',
            'objective' => 'Celebrate costumes with clear categories, fair voting, and quick awards without stopping the whole party for too long.',
            'how_to_play' => [
                'Contestants check in and get a number sticker.',
                'Host announces categories (scariest, funniest, most creative — adjust yearly).',
                'Optional: 30–60 second runway walk or group photo line.',
                'Guests mark ballots; kids can get help from an adult.',
                'Tally and award prizes; group photo of winners.',
            ],
            'setup_instructions' => [
                'Clear a 6×10 ft runway or open floor zone.',
                'Hang category signs and set a ballot box on a side table.',
                'Prep number stickers and a check-in list.',
                'Optional backdrop and phone tripod for photos.',
            ],
            'teardown' => [
                'Collect leftover ballots and recycle.',
                'Remove number stickers from floors/furniture.',
                'Pack prizes not claimed.',
            ],
            'rules_scoring' => "One ballot per guest.\nVote once per category.\nCouple/group costumes count as one entry unless they request separate numbers.\nHost may add a Kids-only ribbon so adults do not sweep every category.",
            'winning_notes' => 'Announce all three category winners. Honorable mentions keep energy high for kids.',
            'supplies_detail' => $supplies,
            'estimated_cost_low' => $low,
            'estimated_cost_high' => $high,
            'setup_minutes' => 20,
            'play_minutes' => 25,
            'cleanup_minutes' => 10,
            'min_players' => 4,
            'max_players' => 70,
            'age_range' => 'All ages',
            'kid_friendly' => 1,
            'location_type' => 'indoor',
            'space_needed' => 'Small runway + ballot table',
            'energy_level' => 'medium',
            'mess_level' => 'low',
            'tech_needs' => 'Optional spotlight or phone flash; music cue helpful.',
            'volunteers_needed' => '1 emcee + 1 ballot helper',
            'safety_notes' => 'Watch masks and long trains on stairs. No fake weapons that look real.',
            'variations' => holiday_variations('Halloween', $name),
            'tips' => 'Do the contest after most costumes have arrived, not at the exact start.\nKeep the runway short — energy drops fast if speeches run long.',
            'printables' => [
                printable_ballot('Costume Contest Ballot', ['Scariest', 'Funniest', 'Most creative']),
                printable_sign('Costume Contest', "Check in for a number.\nWalk the runway if you want.\nVote once per category."),
            ],
        ];
    }

    if (stripos($name, 'Karaoke') !== false) {
        $supplies = supply_rows($legacySupplies, [
            ['item' => 'Karaoke machine / smart TV app + mics', 'qty' => '1', 'unit_cost_est' => 0, 'notes' => 'Borrow if possible; rental ~$40–80'],
            ['item' => 'Mic covers / spare cables', 'qty' => '2', 'unit_cost_est' => 6, 'notes' => ''],
            ['item' => 'Song request slips', 'qty' => '80', 'unit_cost_est' => 0.05, 'notes' => ''],
            ['item' => 'Speaker stand / clear floor marks', 'qty' => '1', 'unit_cost_est' => 0, 'notes' => ''],
        ]);
        return [
            'summary' => 'Open-mic karaoke with a running queue. Keep volume party-friendly and rotate singers so the same three friends do not dominate all night.',
            'objective' => 'Give willing guests a spotlight while protecting conversation elsewhere in the house.',
            'how_to_play' => [
                'Writers fill a request slip (name + song + artist).',
                'Host runs a FIFO queue; duets welcome.',
                'Singer gets one song unless the queue is empty.',
                'Audience cheers; optional silly awards at the end (best duet, bravest attempt).',
            ],
            'setup_instructions' => [
                'Place screen opposite singers; keep cables taped.',
                'Test mics and a known track before guests arrive.',
                'Put request slips + jar at the station.',
                'Agree on a volume ceiling with the host.',
            ],
            'teardown' => [
                'Power down machine; coil cables.',
                'Wipe mics; pack stands.',
            ],
            'rules_scoring' => "Keep it kind — no booing.\nExplicit tracks: host discretion based on kids present.\nMax one song until everyone in queue has gone once.",
            'winning_notes' => 'Optional prizes for bravest singer and best duet.',
            'supplies_detail' => $supplies,
            'estimated_cost_low' => 10,
            'estimated_cost_high' => 90,
            'setup_minutes' => 25,
            'play_minutes' => 120,
            'cleanup_minutes' => 15,
            'min_players' => 2,
            'max_players' => 40,
            'age_range' => '8+ with supervision; adults primary',
            'kid_friendly' => 1,
            'location_type' => 'indoor',
            'space_needed' => 'Corner with TV/speakers + 6 ft singer space',
            'energy_level' => 'medium',
            'mess_level' => 'low',
            'tech_needs' => 'Power, HDMI or app login, Bluetooth/speaker, optional Wi‑Fi.',
            'volunteers_needed' => '1 queue host',
            'safety_notes' => 'Mic cords are trip hazards. Keep drinks away from electronics.',
            'variations' => holiday_variations('Halloween', $name),
            'tips' => 'Seed the queue with two willing singers so the first slot is not awkward silence.\nKeep a kids playlist folder ready.',
            'printables' => [
                printable_sign('Karaoke Queue', "Write name + song.\nOne song until the queue clears.\nCheer loudly."),
                [
                    'title' => 'Song Request Slips',
                    'kind' => 'form',
                    'content' => "KARAOKE REQUEST\nName: ____________________\nSong: _____________________\nArtist: ___________________\nDuet with: ________________\n\n(cut apart; print multiple per page)",
                ],
            ],
        ];
    }

    if (stripos($name, 'Monster Munchies') !== false || stripos($name, 'Not a Chili Chef') !== false) {
        $supplies = supply_rows($legacySupplies, [
            ['item' => 'Folding table + dark tablecloth', 'qty' => '1', 'unit_cost_est' => 8, 'notes' => 'Cloth reusable'],
            ['item' => 'Tent cards / food labels', 'qty' => '20', 'unit_cost_est' => 0.25, 'notes' => ''],
            ['item' => 'Serving utensils', 'qty' => '12', 'unit_cost_est' => 1, 'notes' => 'Ask guests to bring with dish'],
            ['item' => 'Plates + napkins', 'qty' => '70', 'unit_cost_est' => 0.12, 'notes' => ''],
            ['item' => 'Allergy markers (GF/nut/dairy)', 'qty' => '1', 'unit_cost_est' => 3, 'notes' => 'Sticker sheet'],
        ]);
        [$low, $high] = estimate_range($supplies);
        return [
            'summary' => 'Appetizer and dessert potluck table for guests who skip chili. Spooky labels turn ordinary snacks into Monster Munchies.',
            'objective' => 'Feed non-chili eaters and kids while adding visual Halloween fun to the food area.',
            'how_to_play' => [
                'Guests drop off labeled dishes as they arrive.',
                'Host places dishes with tent cards (spooky rename encouraged).',
                'Self-serve throughout the party; refresh utensils as needed.',
            ],
            'setup_instructions' => [
                'Set table beside or across from chili tasting.',
                'Leave a landing zone for hot vs cold dishes.',
                'Pre-print blank tent cards and allergy stickers.',
                'Keep trash/recycling within two steps of the table.',
            ],
            'teardown' => [
                'Return leftover containers to owners.',
                'Wipe table; bag trash.',
            ],
            'rules_scoring' => 'No scoring — hospitality station. Encourage cooks to note major allergens on tent cards.',
            'winning_notes' => 'Optional People’s Choice sticker for favorite munchie.',
            'supplies_detail' => $supplies,
            'estimated_cost_low' => $low,
            'estimated_cost_high' => $high,
            'setup_minutes' => 20,
            'play_minutes' => 180,
            'cleanup_minutes' => 20,
            'min_players' => 1,
            'max_players' => 70,
            'age_range' => 'All ages',
            'kid_friendly' => 1,
            'location_type' => 'indoor',
            'space_needed' => '6–8 ft buffet table',
            'energy_level' => 'low',
            'mess_level' => 'medium',
            'tech_needs' => 'None (optional crockpot outlet for hot dips).',
            'volunteers_needed' => '1 food-table watcher during peak arrival',
            'safety_notes' => 'Label nuts/dairy. Keep raw items separate from ready-to-eat. Watch candle centerpieces near napkins.',
            'variations' => holiday_variations('Halloween', $name),
            'tips' => 'Rename classics: “Mummy Dogs”, “Witch Finger Pretzels”, “Graveyard Dip”.\nHave a kids-height snack plate at the near edge.',
            'printables' => [
                printable_sign('Monster Munchies', "Not bringing chili? Drop apps & desserts here.\nLabel your dish (and allergens!).\nSpooky names encouraged."),
                [
                    'title' => 'Food Tent Card Template',
                    'kind' => 'label',
                    'content' => "MONSTER MUNCHIES\nDish: _____________________\nCook: _____________________\nContains: _________________\n(cut; fold in half)",
                ],
            ],
        ];
    }

    return null;
}

/**
 * @param array<string,mixed> $a
 * @return array<string,mixed>
 */
function generate_details(array $a): array
{
    $special = special_pack($a);
    if ($special !== null) {
        $special['details_source'] = 'seed:activity-details-2026';
        $special['details_filled_at'] = 'now';
        return $special;
    }

    $name = (string)$a['name'];
    $cat = (string)($a['category'] ?? 'other');
    $ages = (string)($a['ages'] ?? 'all');
    $holiday = (string)($a['preferred_holiday'] ?? 'Any');
    $desc = trim((string)($a['description'] ?? ''));
    $setupNotes = trim((string)($a['setup_notes'] ?? ''));
    $prizes = $a['prizes'] !== null ? trim((string)$a['prizes']) : '';
    $legacySupplies = is_array($a['supplies'] ?? null) ? $a['supplies'] : [];

    $kid = ($ages === 'kids' || $ages === 'all') ? 1 : 0;
    $location = 'both';
    $energy = 'medium';
    $mess = 'low';
    $setupMin = 20;
    $playMin = 30;
    $cleanupMin = 10;
    $minP = 4;
    $maxP = 40;
    $space = 'Open floor or table station';
    $volunteers = '1 host';
    $tech = 'None required.';
    $priced = [];

    foreach ($legacySupplies as $s) {
        $label = strtolower((string)$s);
        if (str_contains($label, 'speaker') || str_contains($label, 'mic') || str_contains($label, 'tv') || str_contains($label, 'projector')) {
            $tech = 'Power + A/V as listed in supplies; test before doors.';
        }
        if (str_contains($label, 'paint') || str_contains($label, 'slime') || str_contains($label, 'water')) {
            $mess = 'high';
        } elseif (str_contains($label, 'food') || str_contains($label, 'frosting') || str_contains($label, 'flour')) {
            $mess = 'medium';
        }
    }

    switch ($cat) {
        case 'contest':
            $energy = 'medium';
            $playMin = 25;
            $setupMin = 20;
            $maxP = 70;
            $volunteers = '1 emcee + 1 vote counter';
            $priced = [
                ['item' => 'Ballots + pencils', 'qty' => '60', 'unit_cost_est' => 0.2, 'notes' => ''],
                ['item' => 'Category / station signs', 'qty' => '2', 'unit_cost_est' => 2, 'notes' => ''],
                ['item' => 'Prizes', 'qty' => '3', 'unit_cost_est' => 8, 'notes' => $prizes !== '' ? $prizes : 'Small trophies or candy'],
            ];
            $how = [
                'Explain categories and timing to the room.',
                'Contestants show work or perform as appropriate for “' . $name . '”.',
                'Guests vote with ballots (or judges score if the activity is judged).',
                'Tally quickly and announce winners with prizes.',
            ];
            $setup = [
                'Clear a presentation area and set a ballot table.',
                'Post category signs and a visible end-time for voting.',
                'Stage prizes out of reach until awards.',
            ];
            $rules = "One ballot per guest unless noted.\nBe kind in commentary.\nHost breaks ties with a coin flip or micro-runoff.";
            $printables = [
                printable_ballot($name . ' Ballot', ['Favorite', 'Runner-up (optional)']),
                printable_sign($name, $desc !== '' ? $desc : 'Enter, vote, cheer.'),
                printable_rules_card($name, $how),
            ];
            $objective = 'Pick clear winners while keeping judging fair and fast for a mixed-age party.';
            break;
        case 'music':
            $energy = 'medium';
            $playMin = 90;
            $setupMin = 25;
            $location = 'indoor';
            $tech = 'Power, speakers/playlist device, optional mics; test volume early.';
            $volunteers = '1 DJ / queue host';
            $priced = [
                ['item' => 'Speaker or karaoke unit', 'qty' => '1', 'unit_cost_est' => 0, 'notes' => 'Borrow/rent'],
                ['item' => 'Aux/HDMI cable + power strip', 'qty' => '1', 'unit_cost_est' => 10, 'notes' => ''],
                ['item' => 'Request slips', 'qty' => '60', 'unit_cost_est' => 0.05, 'notes' => ''],
            ];
            $how = [
                'Host starts a playlist or queue.',
                'Guests join in (sing, dance, freeze, shout-backs) per the activity rules.',
                'Rotate so kids and adults both get turns when relevant.',
            ];
            $setup = [
                'Place speakers safely; tape cords.',
                'Load playlist offline if Wi‑Fi is unreliable.',
                'Mark a dance/performance spot away from food.',
            ];
            $rules = "Keep volume conversation-friendly in other rooms.\nExplicit tracks only if the guest mix allows.\nHost can skip a song that stalls energy.";
            $printables = [
                printable_sign($name, $desc !== '' ? $desc : 'Join in — requests welcome.'),
                printable_rules_card($name, $how),
            ];
            $objective = 'Use music to lift energy without trapping the whole party in one loud corner.';
            break;
        case 'food':
            $energy = 'low';
            $mess = 'medium';
            $playMin = 120;
            $setupMin = 25;
            $cleanupMin = 25;
            $location = 'indoor';
            $maxP = 70;
            $volunteers = '1 food-table host during peak arrivals';
            $priced = [
                ['item' => 'Serving table + cloth', 'qty' => '1', 'unit_cost_est' => 8, 'notes' => ''],
                ['item' => 'Plates / napkins / utensils', 'qty' => '70', 'unit_cost_est' => 0.2, 'notes' => ''],
                ['item' => 'Tent cards + allergen stickers', 'qty' => '20', 'unit_cost_est' => 0.25, 'notes' => ''],
            ];
            $how = [
                'Guests bring or build the food item as described for “' . $name . '”.',
                'Label dishes and note major allergens.',
                'Self-serve; refresh utensils and trash.',
            ];
            $setup = [
                'Set hot/cold zones.',
                'Put hand sanitizer and trash nearby.',
                'Print blank labels before guests arrive.',
            ];
            $rules = "Label allergens.\nKeep hot food hot and cold food cold.\nNo double-dipping serving spoons into personal plates.";
            $printables = [
                printable_sign($name, $desc !== '' ? $desc : 'Serve yourself — label your dish!'),
                [
                    'title' => 'Food Label Cards',
                    'kind' => 'label',
                    'content' => "Dish: ____________________\nCook: ____________________\nContains: ________________\n",
                ],
            ];
            $objective = 'Feed a crowd of ~50–70 with clear labels and low host stress.';
            break;
        case 'kids':
            $kid = 1;
            $energy = 'high';
            $playMin = 20;
            $setupMin = 15;
            $minP = 3;
            $maxP = 20;
            $volunteers = '1 adult host (plus helper if >10 kids)';
            $priced = [
                ['item' => 'Activity supplies kit', 'qty' => '1', 'unit_cost_est' => 18, 'notes' => 'Based on listed supplies'],
                ['item' => 'Prize stickers / candy', 'qty' => '20', 'unit_cost_est' => 0.35, 'notes' => ''],
                ['item' => 'Wipes + trash bags', 'qty' => '1', 'unit_cost_est' => 4, 'notes' => ''],
            ];
            $how = [
                'Explain rules in one short sentence kids can repeat.',
                'Demonstrate once.',
                'Play 1–3 quick rounds; cheer everyone.',
                'Hand small prizes or high-fives at the end.',
            ];
            $setup = [
                'Kid-height station away from stairs and hot food.',
                'Pre-open packages; stage wipes.',
                'Post a simple rules card.',
            ];
            $rules = "Take turns.\nWalking feet.\nAdults help with scissors/hot glue if used.\nStop if someone is upset — reset kindly.";
            $printables = [
                printable_rules_card($name, $how),
                printable_sign($name, 'Kids station — adults welcome to help!'),
                printable_scorecard($name . ' Stars', 4),
            ];
            $objective = 'Keep kids engaged for a short burst so parents can mingle.';
            break;
        case 'game':
            $energy = 'high';
            $playMin = 25;
            $setupMin = 20;
            $minP = 4;
            $maxP = 30;
            $volunteers = '1 rules host';
            $priced = [
                ['item' => 'Game kit / printed materials', 'qty' => '1', 'unit_cost_est' => 15, 'notes' => ''],
                ['item' => 'Scorecards + pencils', 'qty' => '20', 'unit_cost_est' => 0.2, 'notes' => ''],
                ['item' => 'Prize', 'qty' => '1', 'unit_cost_est' => 8, 'notes' => $prizes !== '' ? $prizes : ''],
            ];
            $how = [
                'Host explains objective and winning condition for “' . $name . '”.',
                'Form teams or solo players as the game requires.',
                'Play timed rounds; keep a visible scorecard.',
                'Award winner(s) and reset for a second wave if people are waiting.',
            ];
            $setup = [
                'Mark boundaries with tape or cones if movement is involved.',
                'Stage scorecards and a sample demo.',
                'Keep spare supplies in a labeled bin.',
            ];
            $rules = "Host rulings are final.\nNo play near the food table if the game is active/messy.\nRotate waiting players every round when possible.";
            $printables = [
                printable_scorecard($name . ' Scorecard', 6),
                printable_rules_card($name, $how),
                printable_sign($name, $desc !== '' ? $desc : 'Ask the host for a quick demo.'),
            ];
            if (stripos($name, 'bingo') !== false) {
                $printables[] = [
                    'title' => $name . ' Bingo Card Pack',
                    'kind' => 'cards',
                    'content' => "BINGO CARD (print many)\nFree space center.\nFill with party-themed prompts:\ncostume, chili, karaoke, candy, fog machine,\nblack cat, skeleton, pumpkin, witch hat, cider,\nplaylist, photo booth, neighbor, kids table, dessert.\nMark 5 in a row to win.",
                ];
            }
            if (stripos($name, 'trivia') !== false || stripos($name, 'quiz') !== false) {
                $printables[] = [
                    'title' => $name . ' Question Sheet',
                    'kind' => 'cards',
                    'content' => "TRIVIA ROUND (host copy)\n1) ____________________________\n2) ____________________________\n3) ____________________________\n4) ____________________________\n5) ____________________________\nAnswers: ______________________\nScoring: +1 each; +2 bonus for sweep.",
                ];
            }
            if (stripos($name, 'scavenger') !== false || stripos($name, 'clue') !== false || stripos($name, 'murder') !== false) {
                $printables[] = [
                    'title' => $name . ' Clue Cards',
                    'kind' => 'cards',
                    'content' => "CLUE CARD SET\nCard A: Start at the food table — look for the orange sticker.\nCard B: The next hint is near the playlist speaker.\nCard C: Check the photo backdrop for a taped envelope.\nCard D: Ask the costume emcee for the final riddle.\nCard E: Finish line = host with the prize jar.\n(Print, cut, hide before guests arrive.)",
                ];
            }
            $objective = 'Create a clear, fair game loop people can join after arriving late.';
            break;
        default:
            $energy = 'low';
            $playMin = 40;
            $setupMin = 15;
            $priced = [
                ['item' => 'Station supplies', 'qty' => '1', 'unit_cost_est' => 12, 'notes' => 'See supply list'],
                ['item' => 'Signage / pens', 'qty' => '1', 'unit_cost_est' => 4, 'notes' => ''],
            ];
            $how = [
                'Guests visit the station and follow the posted prompt for “' . $name . '”.',
                'Host helps with the first example.',
                'Display finished results if it is a board/photo/keepsake activity.',
            ];
            $setup = [
                'Set a welcoming table with an example finished piece.',
                'Lay out supplies in order of use.',
                'Post a short how-to card.',
            ];
            $rules = 'Be respectful of keepsakes and other guests’ writing/art. Soft voices if near conversation areas.';
            $printables = [
                printable_sign($name, $desc !== '' ? $desc : 'Stop by and take part.'),
                printable_rules_card($name, $how),
            ];
            $objective = 'Offer a low-pressure station that adds memory-making without requiring a full room audience.';
            break;
    }

    if (stripos($name, 'outdoor') !== false || stripos($setupNotes, 'yard') !== false || stripos($setupNotes, 'outside') !== false) {
        $location = 'outdoor';
        $space = 'Yard / driveway with level ground';
    }
    if (stripos($name, 'indoor') !== false) {
        $location = 'indoor';
    }

    $supplies = supply_rows($legacySupplies, $priced);
    [$low, $high] = estimate_range($supplies);

    $summary = $desc !== ''
        ? $desc
        : ($name . ' — a ' . $cat . ' activity sized for Jon’s mixed-age parties (~50–70 guests).');
    if (strlen($summary) > 400) {
        $summary = substr($summary, 0, 397) . '…';
    }

    $teardown = [
        'Collect leftover supplies into a labeled bin.',
        'Trash obvious waste; recycle paper ballots/cards.',
        'Reset furniture so the room works for mingling again.',
    ];
    if ($mess !== 'low') {
        $teardown[] = 'Wipe surfaces and check floors for spills or craft debris.';
    }

    $tips = [];
    if ($setupNotes !== '') {
        $tips[] = 'From prior notes: ' . $setupNotes;
    }
    $tips[] = 'Assume mixed adults and kids unless ages say otherwise; keep a short demo ready for late arrivals.';
    $tips[] = 'Costs are 2026 USD estimates for one station serving a ~50–70 guest Graves party — buy once, reuse signs when you can.';

    $safety = 'Keep walkways clear; announce any trip/heat/allergen risks at the start.';
    if ($mess === 'high') {
        $safety .= ' Protect floors and have wipes ready.';
    }
    if ($cat === 'food') {
        $safety .= ' Track major allergens on labels.';
    }

    $ageRange = match ($ages) {
        'kids' => '4–12 (adult helper nearby)',
        'adults' => '21+ (or 18+ if the party allows)',
        default => 'All ages (adapt difficulty for kids)',
    };

    return [
        'summary' => $summary,
        'objective' => $objective,
        'how_to_play' => $how,
        'setup_instructions' => $setup,
        'teardown' => $teardown,
        'rules_scoring' => $rules,
        'winning_notes' => $prizes !== '' ? $prizes : 'Optional small prize or bragging rights; celebrate participation.',
        'supplies_detail' => $supplies,
        'estimated_cost_low' => $low,
        'estimated_cost_high' => $high,
        'setup_minutes' => $setupMin,
        'play_minutes' => $playMin,
        'cleanup_minutes' => $cleanupMin,
        'min_players' => $minP,
        'max_players' => $maxP,
        'age_range' => $ageRange,
        'kid_friendly' => $kid,
        'location_type' => $location,
        'space_needed' => $space,
        'energy_level' => $energy,
        'mess_level' => $mess,
        'tech_needs' => $tech,
        'volunteers_needed' => $volunteers,
        'safety_notes' => $safety,
        'variations' => holiday_variations($holiday, $name),
        'tips' => implode("\n", $tips),
        'printables' => $printables,
        'details_source' => 'seed:activity-details-2026',
        'details_filled_at' => 'now',
    ];
}

// --- main ---
$updated = 0;
$skipped = 0;
$examined = 0;

if ($args['via_agent']) {
    $token = load_agent_token($root);
    $list = agent_request($args['base'], $token, 'GET', 'list_activities');
    $activities = $list['activities'] ?? [];
    if ($args['id'] > 0) {
        $activities = array_values(array_filter($activities, static fn ($a) => (int)($a['id'] ?? 0) === $args['id']));
    }
    if ($args['limit'] > 0) {
        $activities = array_slice($activities, 0, $args['limit']);
    }
    echo 'via-agent activities=' . count($activities) . ' apply=' . ($args['apply'] ? 'yes' : 'no') . PHP_EOL;
    foreach ($activities as $a) {
        $examined++;
        $id = (int)$a['id'];
        if (!needs_details($a)) {
            $skipped++;
            echo "skip #{$id} {$a['name']} (already has details)\n";
            continue;
        }
        $details = generate_details($a);
        $payload = array_merge([
            'id' => $id,
            'name' => $a['name'],
            'preferred_holiday' => $a['preferred_holiday'] ?? 'Any',
            'party_types' => $a['party_types'] ?? [],
            'category' => $a['category'] ?? 'other',
            'description' => $a['description'] ?? '',
            'ages' => $a['ages'] ?? 'all',
            'supplies' => $a['supplies'] ?? [],
            'prizes' => $a['prizes'] ?? null,
            'setup_notes' => $a['setup_notes'] ?? '',
            'source' => $a['source'] ?? '',
            'is_suggested' => $a['is_suggested'] ?? 0,
        ], $details);
        echo ($args['apply'] ? 'update' : 'dry-run') . " #{$id} {$a['name']} cost={$details['estimated_cost_low']}-{$details['estimated_cost_high']}\n";
        if ($args['apply']) {
            agent_request($args['base'], $token, 'POST', 'upsert_activity', $payload);
            // gentle pacing for live API
            usleep(120000);
        }
        $updated++;
    }
} else {
    Celebr8CatalogModel::ensureSchema();
    $activities = Celebr8CatalogModel::listActivities();
    if ($args['id'] > 0) {
        $activities = array_values(array_filter($activities, static fn ($a) => (int)$a['id'] === $args['id']));
    }
    if ($args['limit'] > 0) {
        $activities = array_slice($activities, 0, $args['limit']);
    }
    echo 'local activities=' . count($activities) . ' apply=' . ($args['apply'] ? 'yes' : 'no') . PHP_EOL;
    foreach ($activities as $a) {
        $examined++;
        if (!needs_details($a)) {
            $skipped++;
            continue;
        }
        $details = generate_details($a);
        $payload = array_merge($a, $details, ['id' => $a['id']]);
        echo ($args['apply'] ? 'update' : 'dry-run') . " #{$a['id']} {$a['name']}\n";
        if ($args['apply']) {
            Celebr8CatalogModel::upsertActivity($payload);
        }
        $updated++;
    }
}

echo "examined={$examined} would_update_or_updated={$updated} skipped_existing={$skipped}\n";
exit(0);
