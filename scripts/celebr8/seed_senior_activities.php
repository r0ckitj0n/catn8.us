#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Seed Celebr8 senior / seated activities + fill empty senior_role on existing games.
 *
 * Idempotent:
 * - New activities upsert by name (no force_insert) — re-running refreshes details.
 * - senior_role on existing activities is set only when currently empty.
 * - senior_friendly / seated_play are set to 1 only when currently 0 (never forced to 0).
 * - Does not change party picks (e.g. Annual Halloween Bash).
 *
 * Usage:
 *   php scripts/celebr8/seed_senior_activities.php --via-agent [--apply]
 *   php scripts/celebr8/seed_senior_activities.php --local [--apply]
 */

$root = dirname(__DIR__, 2);
require_once $root . '/api/bootstrap.php';
require_once $root . '/includes/celebr8_catalog_model.php';

$args = [
    'apply' => false,
    'via_agent' => false,
    'local' => false,
    'base' => 'https://catn8.us',
];
foreach (array_slice($argv, 1) as $arg) {
    if ($arg === '--apply') {
        $args['apply'] = true;
    } elseif ($arg === '--via-agent') {
        $args['via_agent'] = true;
    } elseif ($arg === '--local') {
        $args['local'] = true;
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
            'timeout' => 90,
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

function money(float $n): float
{
    return round($n, 2);
}

/** @param list<array{item:string,qty?:string,unit_cost_est?:float|null,notes?:string}> $rows */
function supplies(array $rows): array
{
    $out = [];
    foreach ($rows as $row) {
        $out[] = [
            'item' => (string)$row['item'],
            'qty' => (string)($row['qty'] ?? '1'),
            'unit_cost_est' => isset($row['unit_cost_est']) && $row['unit_cost_est'] !== null
                ? money((float)$row['unit_cost_est']) : null,
            'notes' => (string)($row['notes'] ?? ''),
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
        return [12.0, 35.0];
    }
    return [money(max(0, $sum * 0.85)), money($sum * 1.25 + 8)];
}

function lp_sign(string $title, string $body): array
{
    return [
        'title' => $title . ' (LARGE PRINT)',
        'kind' => 'large_print',
        'content' => strtoupper($title) . "\n" . str_repeat('=', 36) . "\n\n" . $body,
    ];
}

function lp_ballot(string $title, array $categories): array
{
    $lines = [strtoupper($title), str_repeat('=', 36), '', 'Judge / guest name: ____________________', ''];
    foreach ($categories as $c) {
        $lines[] = $c;
        $lines[] = 'Score (1–10): ______   Notes: ________________';
        $lines[] = '';
    }
    $lines[] = 'Signature: ____________________';
    return [
        'title' => $title . ' (LARGE PRINT)',
        'kind' => 'ballot',
        'content' => implode("\n", $lines),
    ];
}

function lp_scorecard(string $title, int $rows = 8): array
{
    $lines = [strtoupper($title), str_repeat('=', 36), '', 'Name / team: ____________________', ''];
    $lines[] = sprintf('%-6s  %-14s  %-14s', '#', 'Score', 'Notes');
    $lines[] = str_repeat('-', 36);
    for ($i = 1; $i <= $rows; $i++) {
        $lines[] = sprintf('%-6s  %-14s  %-14s', (string)$i, '________', '____________');
    }
    $lines[] = '';
    $lines[] = 'TOTAL: ________';
    return [
        'title' => $title . ' (LARGE PRINT)',
        'kind' => 'scorecard',
        'content' => implode("\n", $lines),
    ];
}

function lp_bingo_card(): array
{
    $words = [
        'Pumpkin', 'Ghost', 'Candy', 'Witch', 'Spider', 'Bat', 'Moon',
        'Costume', 'Broom', 'Treat', 'Black Cat', 'Haunted', 'Skeleton',
        'Owl', 'Cobweb', 'Lantern', 'Vampire', 'Zombie', 'Mummy', 'Cauldron',
        'Scarecrow', 'Werewolf', 'Potion', 'Full Moon',
    ];
    shuffle($words);
    $grid = array_slice($words, 0, 24);
    array_splice($grid, 12, 0, ['FREE']);
    $lines = ['HALLOWEEN BINGO — LARGE PRINT', str_repeat('=', 40), '', 'Name: ____________________', ''];
    for ($r = 0; $r < 5; $r++) {
        $row = [];
        for ($c = 0; $c < 5; $c++) {
            $row[] = str_pad($grid[$r * 5 + $c], 12);
        }
        $lines[] = implode(' | ', $row);
        $lines[] = '';
    }
    $lines[] = 'Mark five in a row. Yell BINGO loudly and clearly!';
    return [
        'title' => 'Large-Print Halloween Bingo Card',
        'kind' => 'large_print',
        'content' => implode("\n", $lines),
    ];
}

function lp_word_search(): array
{
    return [
        'title' => 'Spooky Word Search (LARGE PRINT)',
        'kind' => 'large_print',
        'content' => implode("\n", [
            'SPOOKY WORD SEARCH — LARGE PRINT',
            str_repeat('=', 40),
            '',
            'Find: GHOST  CANDY  PUMPKIN  WITCH  BAT  MOON  COSTUME  SPIDER',
            '',
            'G H O S T X C A N D Y',
            'P U M P K I N Q W I T',
            'W I T C H B A T M O O',
            'C O S T U M E S P I D',
            'S P I D E R M O O N X',
            'B A T C A N D Y G H O',
            'P U M P K I N W I T C',
            '',
            'Circle each word. Take your time — no rush.',
        ]),
    ];
}

function lp_trivia_sheet(): array
{
    return [
        'title' => 'Decade Trivia Answer Sheet (LARGE PRINT)',
        'kind' => 'large_print',
        'content' => implode("\n", [
            'DECADE TRIVIA — ANSWER SHEET',
            str_repeat('=', 40),
            '',
            'Team / player: ____________________',
            '',
            '1. ______________________________',
            '2. ______________________________',
            '3. ______________________________',
            '4. ______________________________',
            '5. ______________________________',
            '6. ______________________________',
            '7. ______________________________',
            '8. ______________________________',
            '9. ______________________________',
            '10. _____________________________',
            '',
            'Bonus: __________________________',
        ]),
    ];
}

function holiday_vars(string $baseHoliday, string $name): array
{
    return [
        "Halloween: keep the spooky tone for {$name}; orange/black printables and candy prizes.",
        "Christmas / winter: swap pumpkins for ornaments, candy canes, and carol clues.",
        "Birthday / Game Night: drop holiday words; use family photos, decades, and music the guests grew up with.",
        'Labor Day / outdoor: move the table under shade; use clipboards and a cooler for drinks.',
    ];
}

function senior_defaults(array $extra): array
{
    $supplies = $extra['supplies_detail'] ?? supplies([]);
    [$low, $high] = estimate_range($supplies);
    return array_merge([
        'category' => 'game',
        'ages' => 'all',
        'preferred_holiday' => 'Halloween',
        'party_types' => ['halloween'],
        'source' => 'senior_seated_pack_2026',
        'is_suggested' => 1,
        'senior_friendly' => 1,
        'seated_play' => 1,
        'mobility_level' => 'none',
        'kid_friendly' => 1,
        'location_type' => 'indoor',
        'energy_level' => 'low',
        'mess_level' => 'low',
        'details_filled_at' => 'now',
        'details_source' => 'senior_seated_pack_2026',
        'estimated_cost_low' => $low,
        'estimated_cost_high' => $high,
        'setup_minutes' => 15,
        'play_minutes' => 30,
        'cleanup_minutes' => 10,
        'min_players' => 2,
        'max_players' => 24,
        'age_range' => 'All ages; designed for seated older guests',
        'hearing_vision_notes' => 'Use large-print (18pt+) sheets, good table lighting, and a host who speaks loudly and clearly. Keep the station away from loud speakers when possible.',
        'senior_role' => 'Primary players — older guests play from their own seats while younger guests do physical games.',
        'tech_needs' => 'None required.',
        'volunteers_needed' => '1 seated-station host',
        'safety_notes' => 'Clear trip hazards around chairs and walkers. Offer table heights that work for wheelchairs. No standing required.',
    ], $extra, [
        'supplies_detail' => $supplies,
    ]);
}

/** @return list<array<string,mixed>> */
function new_senior_activities(): array
{
    $out = [];

    // ——— a) Seated side games ———
    $s = supplies([
        ['item' => 'Large-print bingo cards (pack)', 'qty' => '24', 'unit_cost_est' => 0.35, 'notes' => 'Print duplex; 18pt+'],
        ['item' => 'Bingo daubers or markers', 'qty' => '24', 'unit_cost_est' => 0.75, 'notes' => ''],
        ['item' => 'Caller cards + bowl', 'qty' => '1', 'unit_cost_est' => 6, 'notes' => 'Or print call list'],
        ['item' => 'Small candy prizes', 'qty' => '12', 'unit_cost_est' => 1.5, 'notes' => ''],
        ['item' => 'Table lamps / clip lights', 'qty' => '2', 'unit_cost_est' => 8, 'notes' => 'Borrow if possible'],
    ]);
    $out[] = senior_defaults([
        'name' => 'Large-Print Seated Bingo',
        'description' => 'Quiet large-print themed bingo older guests play from their seats for ~30 minutes while kids do physical games.',
        'summary' => 'A calm, large-print bingo station for older guests. They stay seated, mark cards at their own pace, and a host calls loudly and clearly — perfect while young people run relays and races.',
        'objective' => 'Give elderly guests a complete ~30-minute game they can win from their own chairs without competing against high-energy kids.',
        'supplies_detail' => $s,
        'setup_instructions' => [
            'Set a quiet table or chair cluster away from speakers and race lanes.',
            'Place large-print cards, markers, and good lighting at each seat.',
            'Brief the caller: speak slowly, repeat each item twice, hold the card up if possible.',
            'Post a LARGE PRINT “Bingo Station” sign so guests know where to sit.',
        ],
        'how_to_play' => [
            'Each player gets one large-print card and a marker.',
            'Host calls themes (Halloween words, decades, holiday icons) one at a time, repeating twice.',
            'Players mark matching squares; first to complete a line calls BINGO.',
            'Verify the card, award a small prize, optionally start a second round.',
        ],
        'teardown' => [
            'Collect markers and unused cards for next party.',
            'Recycle used cards or save winners’ cards for photos.',
            'Return lamps and pack prizes.',
        ],
        'rules_scoring' => "Standard bingo lines (row, column, or diagonal).\nTies: first verified card wins; others get a runner-up candy.\nNo standing or rushing required.",
        'winning_notes' => 'Small candy or trinket prizes; optional “most cards played” ribbon for endurance.',
        'variations' => holiday_vars('Halloween', 'Large-Print Seated Bingo'),
        'tips' => "Seat guests with hearing aids nearest the caller.\nOffer a second quieter round if the first fills up.",
        'printables' => [
            lp_bingo_card(),
            lp_sign('Bingo Station', "Sit anywhere at this table.\nWe call slowly and repeat.\nYell BINGO when you win!"),
        ],
        'senior_role' => 'Primary players — this station is built for seated older guests.',
        'type_tag' => 'side',
    ]);

    $s = supplies([
        ['item' => 'Decade trivia question packs (print)', 'qty' => '3', 'unit_cost_est' => 2, 'notes' => '1950s–2000s'],
        ['item' => 'Large-print answer sheets', 'qty' => '20', 'unit_cost_est' => 0.2, 'notes' => ''],
        ['item' => 'Pencils', 'qty' => '20', 'unit_cost_est' => 0.15, 'notes' => ''],
        ['item' => 'Host answer key', 'qty' => '1', 'unit_cost_est' => 0, 'notes' => 'Print once'],
        ['item' => 'Prize for winning team', 'qty' => '1', 'unit_cost_est' => 10, 'notes' => ''],
    ]);
    $out[] = senior_defaults([
        'name' => 'Decade Trivia (By the Years)',
        'description' => 'Seated trivia by decade — history, music, TV, and holidays older guests know well.',
        'summary' => 'Teams stay seated and answer large-print trivia by decade (1950s–2000s). Great Halloween or holiday filler while kids do physical stations.',
        'objective' => 'Celebrate lived experience with fair, loud-and-clear questions and no standing.',
        'supplies_detail' => $s,
        'category' => 'game',
        'setup_instructions' => [
            'Arrange chairs in small teams of 2–4 at tables.',
            'Hand out large-print answer sheets and pencils.',
            'Host uses a printed answer key and a clear voice (mic optional).',
        ],
        'how_to_play' => [
            'Host announces the decade for each round.',
            'Read each question twice; teams confer quietly and write answers.',
            'After 8–10 questions, swap sheets with another team to grade.',
            'Tally scores and announce winners.',
        ],
        'teardown' => ['Collect pencils', 'Save answer keys for reuse', 'Recycle sheets'],
        'rules_scoring' => "1 point per correct answer.\nBonus +2 for the hardest question.\nNo phones.",
        'winning_notes' => 'Winning team gets a small prize; everyone gets applause.',
        'variations' => array_merge(holiday_vars('Halloween', 'Decade Trivia'), [
            'Halloween: add monster-movie and candy history questions.',
        ]),
        'tips' => 'Mix easy warm-ups with harder deep cuts so every decade shines.',
        'printables' => [lp_trivia_sheet(), lp_sign('Decade Trivia', "Sit with a partner.\nWrite answers in large print.\nNo phones — use your memory!")],
        'play_minutes' => 30,
        'tech_needs' => 'Optional mic for the host in a noisy room.',
        'type_tag' => 'side',
    ]);

    $s = supplies([
        ['item' => 'Phone/tablet with oldies playlist', 'qty' => '1', 'unit_cost_est' => 0, 'notes' => 'Borrow'],
        ['item' => 'Bluetooth speaker (moderate volume)', 'qty' => '1', 'unit_cost_est' => 25, 'notes' => 'Or borrow'],
        ['item' => 'Large-print answer pads', 'qty' => '16', 'unit_cost_est' => 0.25, 'notes' => ''],
        ['item' => 'Pencils', 'qty' => '16', 'unit_cost_est' => 0.15, 'notes' => ''],
    ]);
    $out[] = senior_defaults([
        'name' => 'Name That Tune — Oldies Round',
        'description' => 'Seated Name That Tune using classic oldies; pairs with Karaoke night.',
        'summary' => 'Play short clips of oldies and classic hits while seated guests write the title/artist on large-print pads. Ties beautifully to Karaoke Kraziness.',
        'objective' => 'A quiet-but-fun music game older guests win from their chairs.',
        'supplies_detail' => $s,
        'category' => 'music',
        'preferred_holiday' => 'Any',
        'party_types' => [],
        'setup_instructions' => [
            'Cue a playlist of 10–12 clips (5–10 seconds each) from decades guests grew up with.',
            'Seat players facing the speaker; keep volume clear, not blasting.',
            'Hand out large-print pads.',
        ],
        'how_to_play' => [
            'Host plays a clip once, then optionally again.',
            'Players write song title (bonus for artist).',
            'Reveal answers after each clip or at the end.',
            'Highest score wins; optional karaoke sing-along of winners’ songs.',
        ],
        'teardown' => ['Stop playlist', 'Collect pads', 'Coil speaker cable'],
        'rules_scoring' => "2 points title, 1 point artist.\nNo shouting answers before time is called.",
        'winning_notes' => 'Winner picks the next Karaoke song or gets a small music-themed prize.',
        'variations' => holiday_vars('Any', 'Name That Tune'),
        'tips' => 'Avoid ultra-obscure deep cuts; include Motown, Beatles-era, country classics, and 70s/80s.',
        'hearing_vision_notes' => 'Face the speaker toward seated guests; offer a printed setlist of possible titles in large print for those who prefer recognition over recall.',
        'printables' => [
            lp_scorecard('Name That Tune Scores', 12),
            lp_sign('Name That Tune', "Stay seated.\nWrite the song title.\nBonus points for the artist!"),
        ],
        'senior_role' => 'Primary players; optional guest co-DJ to help pick decades.',
        'type_tag' => 'side',
    ]);

    $s = supplies([
        ['item' => 'Large-print word search / crossword packets', 'qty' => '20', 'unit_cost_est' => 0.4, 'notes' => 'Print 18pt+'],
        ['item' => 'Clipboards', 'qty' => '12', 'unit_cost_est' => 1.5, 'notes' => ''],
        ['item' => 'Pencils with erasers', 'qty' => '20', 'unit_cost_est' => 0.2, 'notes' => ''],
        ['item' => 'Table lamp', 'qty' => '1', 'unit_cost_est' => 10, 'notes' => ''],
    ]);
    $out[] = senior_defaults([
        'name' => 'Spooky Word Search & Crossword Packet',
        'description' => 'Quiet large-print puzzle packets older guests work from their seats anytime during the party.',
        'summary' => 'A grab-and-go puzzle station: large-print word searches and easy crosswords with Halloween or holiday themes. No timer pressure — drip in and out.',
        'objective' => 'Provide a low-stimulation activity for guests who want to sit quietly amid louder games.',
        'supplies_detail' => $s,
        'setup_instructions' => [
            'Place packets, clipboards, pencils, and a lamp on a side table.',
            'Add a “Take one — no rush” large-print sign.',
            'Set 4–6 chairs nearby.',
        ],
        'how_to_play' => [
            'Guests take a packet and sit.',
            'Work at their own pace; optional: turn in completed puzzles for a sticker prize.',
        ],
        'teardown' => ['Collect unused packets', 'Sharpen pencils', 'Recycle scraps'],
        'rules_scoring' => 'Optional: first three completed packets get a candy. Completing is the win.',
        'winning_notes' => 'Sticker or candy for finished packets; display a few on a “Solved!” board.',
        'variations' => holiday_vars('Halloween', 'Word Search Packet'),
        'printables' => [lp_word_search(), lp_sign('Puzzle Table', "Large print puzzles.\nSit, relax, and take your time.")],
        'play_minutes' => 30,
        'volunteers_needed' => '0–1 (self-serve)',
        'type_tag' => 'side',
    ]);

    $s = supplies([
        ['item' => 'Clear jar + lid', 'qty' => '1', 'unit_cost_est' => 4, 'notes' => ''],
        ['item' => 'Candy fill (lbs)', 'qty' => '2', 'unit_cost_est' => 6, 'notes' => 'Count secretly'],
        ['item' => 'Large-print guess slips', 'qty' => '40', 'unit_cost_est' => 0.05, 'notes' => ''],
        ['item' => 'Ballot bowl + pencils', 'qty' => '1', 'unit_cost_est' => 3, 'notes' => ''],
    ]);
    $out[] = senior_defaults([
        'name' => 'Guess the Candy Jar (Seated)',
        'description' => 'Classic candy-count guessing from a seated table station.',
        'summary' => 'A clear jar of candy sits on a well-lit table. Seated guests write large-print guesses anytime during the first half of the party; closest without going over wins the jar.',
        'objective' => 'A zero-mobility contest that still feels like a party game.',
        'supplies_detail' => $s,
        'category' => 'contest',
        'setup_instructions' => [
            'Fill and count candy privately; write the true count on a sealed host card.',
            'Place jar on a stable table at seated eye level with good light.',
            'Put slips, pencils, and ballot bowl beside it.',
        ],
        'how_to_play' => [
            'Guest looks at the jar (no lifting required).',
            'Writes name + guess on a large-print slip.',
            'Host announces closest guess later and awards the jar.',
        ],
        'teardown' => ['Award jar', 'Recycle slips', 'Wipe table'],
        'rules_scoring' => "Closest without going over wins.\nOne guess per guest.\nTies: share candy or quick coin flip.",
        'winning_notes' => 'Winner takes the jar home (or shares with the table).',
        'variations' => holiday_vars('Halloween', 'Guess the Candy Jar'),
        'printables' => [
            [
                'title' => 'Candy Jar Guess Slip (LARGE PRINT)',
                'kind' => 'large_print',
                'content' => "GUESS THE CANDY JAR\n====================\n\nName: ____________________\n\nMy guess: ________ pieces\n\nDrop in the bowl. One guess only!",
            ],
            lp_sign('Candy Jar', "Look — don't lift.\nWrite your guess.\nClosest without going over wins!"),
        ],
        'setup_minutes' => 10,
        'play_minutes' => 45,
        'type_tag' => 'side',
    ]);

    $s = supplies([
        ['item' => 'Mini pumpkins or craft ornaments', 'qty' => '12', 'unit_cost_est' => 2.5, 'notes' => 'Seasonal'],
        ['item' => 'Paint pens / markers', 'qty' => '12', 'unit_cost_est' => 1.2, 'notes' => ''],
        ['item' => 'Table covers', 'qty' => '2', 'unit_cost_est' => 3, 'notes' => ''],
        ['item' => 'Wipes + paper towels', 'qty' => '1', 'unit_cost_est' => 4, 'notes' => ''],
        ['item' => 'Aprons or old shirts (optional)', 'qty' => '6', 'unit_cost_est' => 0, 'notes' => 'Borrow'],
    ]);
    $out[] = senior_defaults([
        'name' => 'Tabletop Pumpkin / Ornament Decorating',
        'description' => 'Seated decorating station — paint mini pumpkins or ornaments at the table.',
        'summary' => 'Older guests decorate mini pumpkins (Halloween) or ornaments (winter) while seated. Low mess with paint pens; display finished pieces as party décor.',
        'objective' => 'Creative seated craft that produces take-home keepsakes.',
        'supplies_detail' => $s,
        'category' => 'other',
        'mess_level' => 'medium',
        'setup_instructions' => [
            'Cover a sturdy table; set chairs with knee clearance for wheelchairs.',
            'Pre-stage pumpkins/ornaments, pens, and wipes.',
            'Put a drying tray at the end of the table.',
        ],
        'how_to_play' => [
            'Guest sits, picks a blank piece, and decorates for 15–30 minutes.',
            'Optional friendly vote for “Most Festive” later.',
            'Take home or display on the mantel.',
        ],
        'teardown' => ['Cap pens', 'Wipe table', 'Move dry pieces to display'],
        'rules_scoring' => 'Optional crowd vote with large-print ballots; otherwise participation is the win.',
        'winning_notes' => 'Optional ribbon for Most Festive / Funniest Face.',
        'variations' => holiday_vars('Halloween', 'Tabletop Decorating'),
        'safety_notes' => 'Paint pens only (no carving knives at this station). Wipe spills quickly.',
        'printables' => [lp_ballot('Decorating Contest Ballot', ['Most festive', 'Funniest', 'Best use of color']), lp_sign('Decorating Table', "Sit and create.\nPaint pens only.\nTake your masterpiece home!")],
        'play_minutes' => 30,
        'type_tag' => 'side',
    ]);

    $s = supplies([
        ['item' => 'Rummikub set', 'qty' => '1', 'unit_cost_est' => 18, 'notes' => 'Or borrow'],
        ['item' => 'Playing cards (large-print deck)', 'qty' => '2', 'unit_cost_est' => 8, 'notes' => 'Spades/Euchre'],
        ['item' => 'Dominoes set', 'qty' => '1', 'unit_cost_est' => 12, 'notes' => ''],
        ['item' => 'Score pads (large print)', 'qty' => '4', 'unit_cost_est' => 1, 'notes' => ''],
        ['item' => 'Table + good lighting', 'qty' => '1', 'unit_cost_est' => 0, 'notes' => 'Furniture on site'],
    ]);
    $out[] = senior_defaults([
        'name' => 'Dominoes & Cards Station',
        'description' => 'Ongoing seated station for Rummikub, Spades, Euchre, or dominoes.',
        'summary' => 'A dedicated card/dominoes table with large-print decks and score pads. Guests rotate in for ~30-minute hands while physical games happen elsewhere.',
        'objective' => 'Familiar social games that older guests already love, without competing for floor space.',
        'supplies_detail' => $s,
        'preferred_holiday' => 'Any',
        'party_types' => [],
        'setup_instructions' => [
            'Claim a quiet corner table with four sturdy chairs.',
            'Lay out Rummikub, dominoes, and large-print cards with rule cards.',
            'Post which games are available tonight.',
        ],
        'how_to_play' => [
            'Guests sit and pick a game (host helps form a table of 2–4).',
            'Play one hand or fixed 25–30 minutes, then optionally rotate.',
            'Keep scores on large-print pads if competitive.',
        ],
        'teardown' => ['Box games', 'Wipe table', 'Save score pads if series continues'],
        'rules_scoring' => 'Use house rules posted on the table. Be kind to newcomers — explain Spades/Euchre briefly.',
        'winning_notes' => 'Optional evening champion sticker; mostly social.',
        'variations' => ['Game Night: make this the main event.', 'Halloween: use orange poker chips as spooky currency.'],
        'printables' => [
            lp_scorecard('Cards / Dominoes Score Pad', 10),
            lp_sign('Cards & Dominoes', "Pull up a chair.\nRummikub · Spades · Euchre · Dominoes\nLarge-print decks available."),
        ],
        'play_minutes' => 30,
        'max_players' => 8,
        'type_tag' => 'side',
    ]);

    $s = supplies([
        ['item' => 'Printed family / party photos (large)', 'qty' => '12', 'unit_cost_est' => 0.5, 'notes' => 'Or tablets'],
        ['item' => 'Numbered photo stands', 'qty' => '12', 'unit_cost_est' => 0.4, 'notes' => ''],
        ['item' => 'Guess sheets (large print)', 'qty' => '20', 'unit_cost_est' => 0.15, 'notes' => ''],
        ['item' => 'Answer key (host only)', 'qty' => '1', 'unit_cost_est' => 0, 'notes' => ''],
    ]);
    $out[] = senior_defaults([
        'name' => 'Memory Lane Photo Guessing',
        'description' => 'Guess the year or person from old family/party photos — seated.',
        'summary' => 'Display numbered old photos. Seated guests guess the year, event, or who’s who on large-print sheets. Warm, personal, and perfect for mixed-age parties.',
        'objective' => 'Spark stories and laughter without anyone leaving their chair.',
        'supplies_detail' => $s,
        'category' => 'other',
        'preferred_holiday' => 'Birthday',
        'party_types' => ['birthday'],
        'setup_instructions' => [
            'Print 8–12 photos large; number them; keep an answer key private.',
            'Place along a table at seated viewing height with good light.',
            'Provide guess sheets and pencils.',
        ],
        'how_to_play' => [
            'Guests walk slowly or stay seated while photos are passed/shown.',
            'Write guesses for year / people / event.',
            'Host reveals answers and invites short stories.',
        ],
        'teardown' => ['Pack photos carefully', 'Recycle sheets', 'Save favorites for next year'],
        'rules_scoring' => '1 point per correct year (±2 years OK) or correct person ID. Stories welcome either way.',
        'winning_notes' => 'Best score gets a copy of a favorite photo; everyone gets nostalgia.',
        'variations' => holiday_vars('Birthday', 'Memory Lane'),
        'hearing_vision_notes' => 'Use large photo prints (not tiny phone screens). Describe each photo aloud for low-vision guests.',
        'printables' => [
            [
                'title' => 'Photo Guess Sheet (LARGE PRINT)',
                'kind' => 'large_print',
                'content' => "MEMORY LANE\n============\nName: __________\n\n#1 Year/Person: __________\n#2 Year/Person: __________\n#3 Year/Person: __________\n#4 Year/Person: __________\n#5 Year/Person: __________\n#6 Year/Person: __________\n#7 Year/Person: __________\n#8 Year/Person: __________",
            ],
            lp_sign('Memory Lane', "Guess the year or who's who.\nThen tell us a story!"),
        ],
        'type_tag' => 'side',
    ]);

    $s = supplies([
        ['item' => 'Opaque boxes or bags', 'qty' => '6', 'unit_cost_est' => 2, 'notes' => ''],
        ['item' => 'Safe scent / texture items', 'qty' => '6', 'unit_cost_est' => 1.5, 'notes' => 'Spices, fabric, candy'],
        ['item' => 'Guess sheets', 'qty' => '20', 'unit_cost_est' => 0.1, 'notes' => ''],
        ['item' => 'Hand wipes', 'qty' => '1', 'unit_cost_est' => 3, 'notes' => ''],
    ]);
    $out[] = senior_defaults([
        'name' => 'Smell & Touch Mystery Boxes',
        'description' => 'Seated sensory guessing game with safe scent and texture boxes.',
        'summary' => 'Guests stay seated while boxes are brought to them. Guess spices, candy, fabrics, or Halloween “mystery” textures — gentle, funny, and accessible.',
        'objective' => 'A fully seated sensory game with no vision strain required.',
        'supplies_detail' => $s,
        'setup_instructions' => [
            'Prep 5–6 sealed boxes with safe, non-allergenic items (avoid nuts if unsure).',
            'Label boxes 1–6 on the outside only.',
            'Bring boxes to seated guests on a tray.',
        ],
        'how_to_play' => [
            'Guest smells or touches (as allowed) without peeking.',
            'Writes guess on large-print sheet.',
            'Reveal all items with comedy flair.',
        ],
        'teardown' => ['Discard perishables', 'Wipe boxes', 'Note allergen feedback'],
        'rules_scoring' => '1 point per correct guess. Optional team play.',
        'winning_notes' => 'Small prize for top score; everyone samples a known-safe candy afterward.',
        'safety_notes' => 'No sharp objects, no strong chemical smells, no nut items if allergies are unknown. Offer wipe after each box.',
        'variations' => holiday_vars('Halloween', 'Mystery Boxes'),
        'printables' => [
            [
                'title' => 'Mystery Box Guess Sheet (LARGE PRINT)',
                'kind' => 'large_print',
                'content' => "MYSTERY BOXES\n==============\nName: __________\n\n1: __________\n2: __________\n3: __________\n4: __________\n5: __________\n6: __________",
            ],
            lp_sign('Mystery Boxes', "We'll bring the boxes to you.\nSmell or touch — no peeking!"),
        ],
        'type_tag' => 'side',
    ]);

    $s = supplies([
        ['item' => 'Proverb prompt cards (large print)', 'qty' => '40', 'unit_cost_est' => 0.1, 'notes' => ''],
        ['item' => 'Answer sheets', 'qty' => '20', 'unit_cost_est' => 0.1, 'notes' => ''],
        ['item' => 'Pencils', 'qty' => '20', 'unit_cost_est' => 0.15, 'notes' => ''],
    ]);
    $out[] = senior_defaults([
        'name' => 'Finish the Saying (Proverbs)',
        'description' => 'Seated proverb / idiom completion game with large-print prompts.',
        'summary' => 'Host reads the start of a classic saying; seated guests finish it on large-print sheets or call it out. Fast, funny, and memory-friendly.',
        'objective' => 'A 20–30 minute brain-teaser that rewards life experience.',
        'supplies_detail' => $s,
        'setup_instructions' => [
            'Print proverb starters in large type; keep full answers on a host key.',
            'Seat guests in a semicircle so everyone hears.',
        ],
        'how_to_play' => [
            'Host reads: “You can’t judge a book by…”',
            'Guests write or shout the ending.',
            'Score correct finishes; laugh at creative wrong answers.',
        ],
        'teardown' => ['Save cards', 'Recycle sheets'],
        'rules_scoring' => '1 point exact finish; ½ point for close paraphrase. Host is final judge.',
        'winning_notes' => 'Top scorer gets bragging rights and a small prize.',
        'variations' => holiday_vars('Any', 'Finish the Saying'),
        'preferred_holiday' => 'Any',
        'party_types' => [],
        'printables' => [
            [
                'title' => 'Finish the Saying Prompts (LARGE PRINT)',
                'kind' => 'large_print',
                'content' => "FINISH THE SAYING\n=================\n1. A penny saved is…\n2. Don't count your chickens…\n3. The early bird…\n4. When it rains…\n5. You can't teach an old dog…\n6. Every cloud…\n7. Better late…\n8. Actions speak…\n9. Look before…\n10. Two wrongs…",
            ],
            lp_sign('Finish the Saying', "Listen for the start.\nWrite or say the ending."),
        ],
        'type_tag' => 'side',
    ]);

    $s = supplies([
        ['item' => 'Wrapped pass-the-prize (soft)', 'qty' => '1', 'unit_cost_est' => 8, 'notes' => 'No sharp edges'],
        ['item' => 'Story prompt cards', 'qty' => '20', 'unit_cost_est' => 0.1, 'notes' => ''],
        ['item' => 'Soft music playlist (optional)', 'qty' => '1', 'unit_cost_est' => 0, 'notes' => ''],
    ]);
    $out[] = senior_defaults([
        'name' => 'Pass-the-Prize Story Chain',
        'description' => 'Seated story chain: add a sentence, pass a wrapped prize; music-stop wins.',
        'summary' => 'Guests sit in a circle (or chair arc). Soft music plays while a wrapped prize is passed; when music stops, that guest adds a sentence to a spooky/funny story. Last prize holder keeps it.',
        'objective' => 'Gentle group storytelling with a prize — fully seated.',
        'supplies_detail' => $s,
        'setup_instructions' => [
            'Arrange chairs in an arc with aisle space for walkers.',
            'Prep a soft wrapped prize and a starter sentence.',
            'Cue soft music the host can pause easily.',
        ],
        'how_to_play' => [
            'Start a story with one sentence.',
            'Pass the prize while music plays; pause music at random.',
            'Holder adds one sentence, then music resumes.',
            'After ~15–20 turns, final holder keeps the prize.',
        ],
        'teardown' => ['Award prize', 'Note favorite story lines for next year'],
        'rules_scoring' => 'No scoring — prize goes to the final holder. Keep stories kind and PG.',
        'winning_notes' => 'Final holder keeps the prize; optional “best line” candy for a funny contribution.',
        'variations' => holiday_vars('Halloween', 'Pass-the-Prize'),
        'safety_notes' => 'Pass gently; never throw. Soft prize only.',
        'printables' => [
            lp_sign('Story Chain', "Stay seated.\nAdd one sentence when the music stops.\nBe kind — PG stories only."),
            [
                'title' => 'Story Starters (LARGE PRINT)',
                'kind' => 'large_print',
                'content' => "STORY STARTERS\n==============\n1. On a dark Halloween night, Grandma opened the door and…\n2. The candy bowl was empty except for…\n3. We thought the costume contest was over until…\n4. The funniest thing that ever happened at a party was…",
            ],
        ],
        'type_tag' => 'side',
    ]);

    // ——— c) Spotlight games for seniors ———
    $s = supplies([
        ['item' => 'Runway markers / tape', 'qty' => '1', 'unit_cost_est' => 4, 'notes' => ''],
        ['item' => 'Mic or voice amplifier', 'qty' => '1', 'unit_cost_est' => 0, 'notes' => 'Borrow'],
        ['item' => 'Large-print judge ballots', 'qty' => '6', 'unit_cost_est' => 0.2, 'notes' => ''],
        ['item' => 'Sashes or ribbons', 'qty' => '3', 'unit_cost_est' => 3, 'notes' => ''],
        ['item' => 'Chair at end of runway (pose option)', 'qty' => '1', 'unit_cost_est' => 0, 'notes' => 'On site'],
    ]);
    $out[] = senior_defaults([
        'name' => 'Grandparent Costume Parade',
        'description' => 'Spotlight runway for grandparents — walk, wheelchair roll, or seated pose.',
        'summary' => 'Older guests show costumes on a short runway. Walking, rolling, or a dramatic seated pose all count. The crowd cheers; celebrity judges use large-print ballots.',
        'objective' => 'Put elders in the spotlight with accessible participation modes.',
        'supplies_detail' => $s,
        'category' => 'contest',
        'seated_play' => 0,
        'mobility_level' => 'low',
        'energy_level' => 'medium',
        'setup_instructions' => [
            'Clear a short, flat runway with room for wheelchairs; mark edges.',
            'Place a “pose chair” at the end for guests who prefer not to walk far.',
            'Seat judges with large-print ballots and good sight lines.',
            'Cue upbeat oldies for entrances.',
        ],
        'how_to_play' => [
            'Announce each grandparent by name and costume.',
            'They walk, roll, or take a seated pose; crowd cheers.',
            'Judges score presence, creativity, and crowd delight.',
            'Award sashes: Grand Marshal, Funniest, Most Dashing.',
        ],
        'teardown' => ['Remove tape', 'Collect ballots', 'Group photo of sash winners'],
        'rules_scoring' => "Categories: Presence, Creativity, Crowd cheer (1–10 each).\nSeated poses are fully valid — do not dock for mobility aids.",
        'winning_notes' => 'Sashes and applause; optional candy for all parade participants.',
        'hearing_vision_notes' => 'Announce names loudly; describe costumes for guests who cannot see the runway well.',
        'variations' => holiday_vars('Halloween', 'Grandparent Costume Parade'),
        'senior_role' => 'Stars of the show — walking, rolling, or seated posing.',
        'printables' => [
            lp_ballot('Grandparent Parade Judges', ['Presence', 'Creativity', 'Crowd cheer']),
            lp_sign('Grandparent Parade', "Walk, roll, or strike a seated pose.\nEveryone is a star."),
        ],
        'setup_minutes' => 20,
        'play_minutes' => 20,
        'type_tag' => 'spotlight',
    ]);

    $s = supplies([
        ['item' => 'Small foam pumpkins or soft balls', 'qty' => '6', 'unit_cost_est' => 3, 'notes' => ''],
        ['item' => 'Plastic bowling pins or bottles', 'qty' => '10', 'unit_cost_est' => 1.2, 'notes' => ''],
        ['item' => 'Ring toss rings + target', 'qty' => '1', 'unit_cost_est' => 12, 'notes' => 'Optional second game'],
        ['item' => 'Score sheet (large print)', 'qty' => '1', 'unit_cost_est' => 0.2, 'notes' => ''],
        ['item' => 'Floor tape for foul line', 'qty' => '1', 'unit_cost_est' => 3, 'notes' => ''],
    ]);
    $out[] = senior_defaults([
        'name' => 'Seated Pumpkin Bowling & Ring Toss',
        'description' => 'Soft pumpkin bowling and ring toss played from chairs; crowd watches.',
        'summary' => 'Spotlight station: older guests bowl soft pumpkins at pins or toss rings from a stable chair. Short turns, big cheers, zero running.',
        'objective' => 'A visible “elder athletic event” that stays fully seated.',
        'supplies_detail' => $s,
        'category' => 'game',
        'mobility_level' => 'none',
        'energy_level' => 'low',
        'setup_instructions' => [
            'Set pins 6–8 ft from a sturdy chair; mark a seated foul line.',
            'Clear a spectator arc so the crowd can cheer safely.',
            'Optional ring-toss stand beside the bowling lane.',
        ],
        'how_to_play' => [
            'Player sits; takes two soft-pumpkin rolls per frame (or three ring tosses).',
            'Scorekeeper announces scores loudly.',
            'After everyone bowls, crown the Pumpkin Champion.',
        ],
        'teardown' => ['Collect pins/rings', 'Remove tape', 'Pack soft pumpkins'],
        'rules_scoring' => "Bowling: 1 point per pin; spare +2; strike +3 on a 6-pin set.\nRing toss: 1 per ringer.\nFeet stay planted — seated only.",
        'winning_notes' => 'Champion ribbon; participation stickers for all.',
        'safety_notes' => 'Soft projectiles only. Spotters keep kids from running into the lane.',
        'variations' => holiday_vars('Halloween', 'Seated Pumpkin Bowling'),
        'senior_role' => 'Athletes — primary players in the spotlight.',
        'printables' => [lp_scorecard('Pumpkin Bowling Scores', 10), lp_sign('Seated Bowling', "Stay in your chair.\nTwo rolls per turn.\nCheer loud!")],
        'type_tag' => 'spotlight',
    ]);

    $s = supplies([
        ['item' => 'Trivia question packs (kids vs elders)', 'qty' => '2', 'unit_cost_est' => 2, 'notes' => ''],
        ['item' => 'Team buzzers or bells', 'qty' => '2', 'unit_cost_est' => 6, 'notes' => ''],
        ['item' => 'Large-print scoreboard', 'qty' => '1', 'unit_cost_est' => 1, 'notes' => ''],
        ['item' => 'Prize for winning side', 'qty' => '1', 'unit_cost_est' => 12, 'notes' => 'Shared candy bag OK'],
    ]);
    $out[] = senior_defaults([
        'name' => 'Seniors vs Kids Trivia Showdown',
        'description' => 'Spotlight trivia: elders vs kids teams; crowd cheers.',
        'summary' => 'Two teams — Seniors and Kids — face off on mixed trivia (then vs now). Elders stay seated; kids may stand at a buzzer table. The room watches like a game show.',
        'objective' => 'A fun intergenerational showdown that flatters both sides.',
        'supplies_detail' => $s,
        'category' => 'game',
        'seated_play' => 1,
        'mobility_level' => 'none',
        'energy_level' => 'medium',
        'setup_instructions' => [
            'Set two team zones with a host in the middle.',
            'Seniors seated with bells; kids at a standing or seated buzzer.',
            'Prep rounds: Then (pre-1985), Now (kids culture), Halloween/holiday mix.',
        ],
        'how_to_play' => [
            'Host asks; first bell answers.',
            'Correct: +1; wrong: other team may steal.',
            'Best of 12–15 questions; trophy or candy bag to winners.',
        ],
        'teardown' => ['Pack buzzers', 'Save questions', 'Group photo of both teams'],
        'rules_scoring' => "Buzz in after the full question.\nBe kind — no teasing wrong answers.\nHost may read kids' questions slower.",
        'winning_notes' => 'Winning team shares a prize; losing team gets a consolation cheer and candy.',
        'variations' => holiday_vars('Halloween', 'Seniors vs Kids Trivia'),
        'senior_role' => 'Team Seniors — primary competitors.',
        'printables' => [lp_scorecard('Trivia Showdown Scoreboard', 15), lp_sign('Seniors vs Kids', "Buzz in.\nBe kind.\nBoth teams are champions.")],
        'play_minutes' => 25,
        'type_tag' => 'spotlight',
    ]);

    $s = supplies([
        ['item' => 'Karaoke / speaker system', 'qty' => '1', 'unit_cost_est' => 0, 'notes' => 'Share with Karaoke'],
        ['item' => 'Printed oldies lyric sheets (large)', 'qty' => '10', 'unit_cost_est' => 0.3, 'notes' => ''],
        ['item' => 'Prop mic + fun hats (optional)', 'qty' => '3', 'unit_cost_est' => 4, 'notes' => ''],
        ['item' => 'Judge ballots', 'qty' => '5', 'unit_cost_est' => 0.2, 'notes' => ''],
    ]);
    $out[] = senior_defaults([
        'name' => 'Oldies Lip-Sync Showcase',
        'description' => 'Spotlight lip-sync to classic hits; seated or standing; crowd cheers.',
        'summary' => 'Older guests lip-sync (or softly sing) to beloved oldies. Perform from a chair or standing — drama and comedy welcome. Ties to Karaoke night.',
        'objective' => 'A theatrical spotlight moment that does not require dancing.',
        'supplies_detail' => $s,
        'category' => 'music',
        'seated_play' => 1,
        'mobility_level' => 'low',
        'energy_level' => 'medium',
        'setup_instructions' => [
            'Load 6–8 classic tracks with clear lyrics.',
            'Provide large-print lyric sheets and a chair “stage”.',
            'Seat judges / crowd in front.',
        ],
        'how_to_play' => [
            'Performer picks a song (or host assigns gently).',
            'Lip-sync with flair for 60–90 seconds.',
            'Judges score showmanship; crowd applause counts.',
        ],
        'teardown' => ['Return mics', 'Save lyric sheets', 'Photo with winners'],
        'rules_scoring' => 'Showmanship 1–10, Crowd reaction 1–10. Seated performances fully allowed.',
        'winning_notes' => 'Lip-Sync Legend ribbon; optional duet encore.',
        'variations' => holiday_vars('Any', 'Oldies Lip-Sync'),
        'senior_role' => 'Performers in the spotlight.',
        'printables' => [lp_ballot('Lip-Sync Judges', ['Showmanship', 'Crowd reaction']), lp_sign('Oldies Lip-Sync', "Chair or stand.\nBring the drama.\nHave fun!")],
        'type_tag' => 'spotlight',
    ]);

    $s = supplies([
        ['item' => 'Plastic spoons', 'qty' => '12', 'unit_cost_est' => 0.15, 'notes' => ''],
        ['item' => 'Plastic eggs (or soft balls)', 'qty' => '6', 'unit_cost_est' => 0.5, 'notes' => ''],
        ['item' => 'Two chair rows facing each other', 'qty' => '1', 'unit_cost_est' => 0, 'notes' => 'Furniture'],
        ['item' => 'Stopwatch / phone timer', 'qty' => '1', 'unit_cost_est' => 0, 'notes' => ''],
    ]);
    $out[] = senior_defaults([
        'name' => 'Spoon-and-Egg Seated Pass Relay',
        'description' => 'Relay where elders pass a spoon-and-egg down a row of chairs — no running.',
        'summary' => 'Two teams of seated older guests pass a plastic egg on a spoon down the row. Crowd cheers. Kids may run a parallel standing relay if desired.',
        'objective' => 'Relay thrills without standing or sprinting.',
        'supplies_detail' => $s,
        'mobility_level' => 'none',
        'energy_level' => 'medium',
        'setup_instructions' => [
            'Line two rows of chairs with space for elbows.',
            'Give each team a spoon + plastic egg.',
            'Appoint a seated timekeeper with a large-print sheet.',
        ],
        'how_to_play' => [
            'On go, pass egg+spoon person to person without hands touching the egg (house rule: fingers OK to steady once).',
            'Dropped egg returns to the start of that pass.',
            'First team to finish the row wins.',
        ],
        'teardown' => ['Collect spoons/eggs', 'Straighten chairs'],
        'rules_scoring' => 'Fastest clean pass wins. Kindness > speed if someone has limited grip strength — allow two hands.',
        'winning_notes' => 'Team prize candy; sportsmanship cheer for both rows.',
        'safety_notes' => 'Plastic eggs only. No standing mid-pass.',
        'variations' => holiday_vars('Any', 'Seated Pass Relay'),
        'senior_role' => 'Relay athletes — fully seated.',
        'printables' => [lp_scorecard('Seated Relay Times', 6), lp_sign('Seated Egg Pass', "Stay seated.\nPass carefully.\nCheer your row!")],
        'play_minutes' => 15,
        'type_tag' => 'spotlight',
    ]);

    $s = supplies([
        ['item' => 'Comfortable storytelling chairs / sofa', 'qty' => '1', 'unit_cost_est' => 0, 'notes' => 'On site'],
        ['item' => 'Soft lamp / good lighting', 'qty' => '1', 'unit_cost_est' => 10, 'notes' => ''],
        ['item' => 'Prompt cards (large print)', 'qty' => '12', 'unit_cost_est' => 0.15, 'notes' => ''],
        ['item' => 'Optional recorder / phone for keepsake', 'qty' => '1', 'unit_cost_est' => 0, 'notes' => 'Permission first'],
        ['item' => 'Water pitcher + cups', 'qty' => '1', 'unit_cost_est' => 3, 'notes' => ''],
    ]);
    $out[] = senior_defaults([
        'name' => "Elders' Storytelling Hour",
        'description' => 'Spotlight storytelling: scariest/funniest party memories; crowd listens.',
        'summary' => 'Older guests take turns telling 2–3 minute stories (scariest, funniest, or sweetest party memory) while the room listens. Soft lighting, prompts, and applause.',
        'objective' => 'Honor elders as entertainers and keepers of family lore.',
        'supplies_detail' => $s,
        'category' => 'other',
        'energy_level' => 'low',
        'setup_instructions' => [
            'Create a cozy “stage” chair with good light and a water cup.',
            'Seat the audience quietly; lower background music.',
            'Offer large-print prompt cards for anyone who wants a starter.',
        ],
        'how_to_play' => [
            'Host invites 4–8 storytellers (volunteer order).',
            'Each gets 2–3 minutes; gentle bell at time.',
            'Audience may ask one kind question after.',
            'Optional: vote for Funniest / Most Spine-Tingling.',
        ],
        'teardown' => ['Thank every storyteller', 'Save prompts', 'Optional: share recordings only with consent'],
        'rules_scoring' => 'Optional audience applause vote. Keep stories PG and kind — no roasting anyone who is not in on the joke.',
        'winning_notes' => 'Storyteller ribbons; printed “Family Lore” certificate optional.',
        'hearing_vision_notes' => 'Mic recommended. Face storytellers toward the crowd; repeat punchlines if needed.',
        'variations' => holiday_vars('Halloween', "Elders' Storytelling Hour"),
        'senior_role' => 'Featured storytellers — the whole show.',
        'printables' => [
            [
                'title' => 'Story Prompts (LARGE PRINT)',
                'kind' => 'large_print',
                'content' => "STORY PROMPTS\n=============\n• Scariest thing that happened at a party\n• Funniest costume fail\n• Best surprise guest\n• A dish that became legendary\n• When the kids thought they fooled the adults…\n• A holiday tradition we should never drop",
            ],
            lp_ballot('Storytelling Crowd Vote', ['Funniest', 'Most spine-tingling', 'Warmest heart']),
            lp_sign("Elders' Story Hour", "2–3 minutes.\nSpeak up — we want to hear you.\nApplause welcome!"),
        ],
        'play_minutes' => 30,
        'tech_needs' => 'Optional mic + quiet room.',
        'type_tag' => 'spotlight',
    ]);

    $s = supplies([
        ['item' => 'Toilet paper rolls', 'qty' => '12', 'unit_cost_est' => 1.2, 'notes' => ''],
        ['item' => 'Director chairs / seated coach seats', 'qty' => '4', 'unit_cost_est' => 0, 'notes' => ''],
        ['item' => 'Stopwatch', 'qty' => '1', 'unit_cost_est' => 0, 'notes' => ''],
        ['item' => 'Large-print director scorecards', 'qty' => '4', 'unit_cost_est' => 0.2, 'notes' => ''],
        ['item' => 'Prize for best director + wrap team', 'qty' => '2', 'unit_cost_est' => 6, 'notes' => ''],
    ]);
    $out[] = senior_defaults([
        'name' => 'Mummy Wrap — Elders Direct',
        'description' => 'Spotlight: seniors direct young wrappers from chairs; crowd watches.',
        'summary' => 'Young people race to wrap a “mummy,” but older guests are the directors — calling strategy from seats (“more around the legs!”, “leave the eyes!”). Combines Mummy Wrap energy with elder leadership.',
        'objective' => 'Give elders a powerful role inside a physical favorite.',
        'supplies_detail' => $s,
        'category' => 'contest',
        'seated_play' => 1,
        'mobility_level' => 'none',
        'energy_level' => 'high',
        'mess_level' => 'medium',
        'setup_instructions' => [
            'Mark wrap zones; seat directors with clear views and megaphone voices.',
            'Assign each elder a youth wrap team.',
            'Stage toilet-paper rolls and a timer.',
        ],
        'how_to_play' => [
            'On go, youth wrap the mummy while the elder director coaches aloud.',
            'Stop at 60–90 seconds.',
            'Judges score wrap quality + director creativity.',
        ],
        'teardown' => ['Collect TP scraps', 'Photo mummies with directors', 'Recycle paper'],
        'rules_scoring' => "Coverage 1–10, Face window (eyes clear) 1–5, Director flair 1–10.\nDirectors may not leave their chairs.",
        'winning_notes' => 'Best Director + Best Mummy prizes.',
        'variations' => [
            'Halloween classic with spooky music.',
            'Birthday: wrap the birthday kid (gently) while grandparents direct.',
        ],
        'senior_role' => 'Directors / coaches — primary spotlight role while youth do the wrapping.',
        'printables' => [
            lp_scorecard('Mummy Wrap Director Scores', 6),
            lp_sign('Mummy Wrap — Elders Direct', "Directors sit and coach.\nWrappers hustle.\nEyes must stay clear!"),
        ],
        'play_minutes' => 20,
        'type_tag' => 'spotlight',
    ]);

    return $out;
}

/**
 * Suggest senior_role (+ optional flags / printable) for an existing activity by name.
 *
 * @return array{senior_role:string,senior_friendly?:int,seated_play?:int,mobility_level?:string,hearing_vision_notes?:string,printable?:array}|null
 */
function role_for_existing(string $name): ?array
{
    $judgeBallot = static function (string $title, array $cats) {
        return lp_ballot($title, $cats);
    };
    $timekeeper = static function () {
        return lp_scorecard('Timekeeper / Scorekeeper Sheet', 12);
    };

    // Exact / strong headliners first
    $exact = [
        'Chili Cook-Off' => [
            'senior_role' => 'Seated tasting judges at a reserved table with large-print score cards. Sample slowly, discuss spice levels, and help tally ballots — no standing in the tasting line required.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
            'hearing_vision_notes' => 'Large-print judge cards; host repeats cook numbers aloud.',
            'printable' => $judgeBallot('Chili Cook-Off Judges (Elders)', ['Flavor', 'Heat', 'Creativity']),
        ],
        'Costume Contest' => [
            'senior_role' => 'Celebrity judges panel: sit front-row with large-print ballots for Scariest / Funniest / Most Creative. May also present prizes.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
            'printable' => $judgeBallot('Costume Contest Judges (Elders)', ['Scariest', 'Funniest', 'Most creative']),
        ],
        '"Not a Chili Chef?" Monster Munchies Table' => [
            'senior_role' => 'Seated tasting judges / snack critics with score cards for presentation and creativity. Help keep the munchies table tidy between rounds.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
            'printable' => $judgeBallot('Monster Munchies Judges', ['Taste', 'Presentation', 'Creativity']),
        ],
        'Karaoke Kraziness' => [
            'senior_role' => 'Judges for showmanship rounds and/or hosts of a Name-That-Year oldies mini-round from seats. May request dedications.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
            'printable' => $judgeBallot('Karaoke Judges (Elders)', ['Vocals', 'Showmanship', 'Crowd energy']),
        ],
        'Karaoke (Obviously)' => [
            'senior_role' => 'Seated judges or featured oldies performers; help pick the next song from a large-print list.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
        ],
        'Karaoke Contest' => [
            'senior_role' => 'Contest judges with large-print scorecards; optional “Elders’ Choice” award.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
            'printable' => $judgeBallot('Karaoke Contest Judges', ['Pitch', 'Stage presence', 'Song choice']),
        ],
        'Birth-Year Karaoke' => [
            'senior_role' => 'Honorees and elders request songs from their birth year and judge authenticity from seats.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
        ],
        'Halloween Scavenger Hunt' => [
            'senior_role' => '“Wise ones” / clue givers stationed in chairs along the route; hand out the next clue when kids answer a simple question. Also excellent timekeepers.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
            'printable' => $timekeeper(),
        ],
        'Halloween Bingo' => [
            'senior_role' => 'Primary players — use large-print cards; elders can also take turns as loud-and-clear callers.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
        ],
        'Pumpkin Carving or Decorating Contest' => [
            'senior_role' => 'Decorating judges and/or seated decorating participants using paint pens (no knives). Present awards.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
            'printable' => $judgeBallot('Pumpkin Contest Judges', ['Creativity', 'Craftsmanship', 'Theme']),
        ],
        'Mummy Wrap Race' => [
            'senior_role' => 'Seated directors / coaches calling strategy to youth wrappers; or timekeepers with large-print sheets.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
            'printable' => $timekeeper(),
        ],
        'Mummy Wrap Fashion Show' => [
            'senior_role' => 'Runway judges with large-print ballots; may announce winners.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
            'printable' => $judgeBallot('Mummy Fashion Judges', ['Wrap quality', 'Style', 'Comedy']),
        ],
        'Guess How Many Eyeballs' => [
            'senior_role' => 'Primary guessers from seats; one elder can be the ceremonial jar revealer.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
        ],
        'Spooky Story Circle' => [
            'senior_role' => 'Featured storytellers and circle hosts — the best material often comes from elders.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
        ],
        'Poker Tournament' => [
            'senior_role' => 'Primary players at a quiet table; large-print decks preferred.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
        ],
        'Roast and Toasts' => [
            'senior_role' => 'Honored speakers and toast-givers from seats; keep a mic handy.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
        ],
        'Photo Slideshow: 40 Years of the Honoree' => [
            'senior_role' => 'Narrators who identify people/years as slides play; seated with a mic.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
        ],
        'Guess the Year Trivia' => [
            'senior_role' => 'Primary players — decades trivia plays to lived experience.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
        ],
        'Witch Hat Ring Toss' => [
            'senior_role' => 'Seated tossers at a shorter foul line, or scorekeepers / prize presenters.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
            'printable' => $timekeeper(),
        ],
        'Ghost Bowling' => [
            'senior_role' => 'Seated bowlers with soft balls at a shorter lane, or official scorekeepers.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
            'printable' => $timekeeper(),
        ],
        'Cornhole Tournament' => [
            'senior_role' => 'Seated or standing-at-leisure tossers with a shorter board distance; also excellent scorekeepers and prize presenters.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
            'printable' => $timekeeper(),
        ],
        'Witches\' Brew Punch Station' => [
            'senior_role' => 'Seated punch hosts who ladle and chat — social role with a stool behind the table.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
        ],
        'Graveyard Photo Booth' => [
            'senior_role' => 'Seated photo subjects and prop judges; help kids pose.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
        ],
        'Costume Charades' => [
            'senior_role' => 'Seated guessers on the team bench; optional seated acting for easy prompts.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
        ],
        'Halloween Movie Trivia' => [
            'senior_role' => 'Primary seated players; host reads questions loudly twice.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
        ],
        'Creepy Organ Music Playlist' => [
            'senior_role' => 'Playlist curators / DJs from a chair — pick the spooky vibes.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
        ],
        'Murder Mystery Wink Murder' => [
            'senior_role' => 'Seated townspeople / detectives who observe and accuse without chasing.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
        ],
        'Pajama Fashion Show' => [
            'senior_role' => 'Judges with large-print ballots; seated runway poses allowed.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
            'printable' => $judgeBallot('Pajama Fashion Judges', ['Cozy', 'Comedy', 'Style']),
        ],
        'Resolution Guessing Game' => [
            'senior_role' => 'Primary seated guessers and story sharers.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
        ],
        'Midnight Champagne Toast and Countdown' => [
            'senior_role' => 'Honored toast leaders from seats; host brings glasses to them.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
        ],
        'Childhood Cartoons on TV' => [
            'senior_role' => 'Co-hosts who introduce cartoons they grew up with; seated viewing.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
        ],
        '40 Reasons We Love You Board' => [
            'senior_role' => 'Honorees seated beside the board; guests bring notes to them.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
        ],
        'Over-the-Hill Cake and Candle Moment' => [
            'senior_role' => 'Honorees and elder family blow candles / lead the cheer from seats.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
        ],
        'Bring Something Yummy + BYOB' => [
            'senior_role' => 'Seated tasting commentators; help label dishes.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
        ],
        'BYOB + Appetizer/Dessert Potluck' => [
            'senior_role' => 'Seated hosts at the dessert end — plate and chat.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
        ],
        'Breakfast-for-Dinner Cereal Bar' => [
            'senior_role' => 'Seated cereal bar greeters; help kids find bowls.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
        ],
        'Caramel Apple and Cupcake Decorating Bar' => [
            'senior_role' => 'Seated decorators and presentation judges.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
            'printable' => $judgeBallot('Treat Decorating Judges', ['Looks', 'Creativity']),
        ],
        'Backyard Grill Potluck' => [
            'senior_role' => 'Seated tasting judges for “best side dish”; shade seating near the grill social zone.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
        ],
        'Horseshoes' => [
            'senior_role' => 'Scorekeepers and shorter-distance tossers; shade chairs by the pits.',
            'senior_friendly' => 1,
            'seated_play' => 0,
            'mobility_level' => 'low',
            'printable' => $timekeeper(),
        ],
        'Ping Pong Tournament' => [
            'senior_role' => 'Seated referees / scorekeepers; optional doubles partner who covers more court.',
            'senior_friendly' => 1,
            'seated_play' => 0,
            'mobility_level' => 'moderate',
            'printable' => $timekeeper(),
        ],
        'Around the World Ping Pong' => [
            'senior_role' => 'Scorekeepers or “home base” seated players who take easier turns.',
            'senior_friendly' => 1,
            'mobility_level' => 'moderate',
            'printable' => $timekeeper(),
        ],
        'Any Game That Sounds Fun' => [
            'senior_role' => 'Help pick a seated option from the library and run it as table captains.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
        ],
    ];

    if (isset($exact[$name])) {
        return $exact[$name];
    }

    // Pattern fallbacks for the larger live catalog
    if (preg_match('/scavenger|egg hunt|clue-chain|missions/i', $name)) {
        return [
            'senior_role' => 'Seated “wise one” clue stations and/or timekeepers. Hand the next clue when kids answer a simple question; no hunting required.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
            'printable' => $timekeeper(),
        ];
    }
    if (preg_match('/relay|race|dash|sack|balloon toss|tag|freeze dance|water balloon/i', $name)) {
        return [
            'senior_role' => 'Seated starters (say “Go!”), timekeepers, scorekeepers, and prize presenters. Optional: coach a youth team from the sideline chairs.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
            'printable' => $timekeeper(),
        ];
    }
    if (preg_match('/bingo/i', $name)) {
        return [
            'senior_role' => 'Primary seated players with large-print cards; elders may also call numbers loudly and clearly.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
        ];
    }
    if (preg_match('/trivia/i', $name)) {
        return [
            'senior_role' => 'Primary seated players / team captains; host repeats each question twice.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
        ];
    }
    if (preg_match('/karaoke|lip-?sync|sing/i', $name)) {
        return [
            'senior_role' => 'Judges, dedications, and/or featured oldies performers from seats.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
            'printable' => $judgeBallot('Music Judges (Elders)', ['Performance', 'Crowd energy']),
        ];
    }
    if (preg_match('/cook-?off|chili|bake|potluck|tasting|munch|grill|bbq|punch|cereal|dessert|cake/i', $name)) {
        return [
            'senior_role' => 'Seated tasting judges or hospitality hosts with large-print score cards.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
            'printable' => $judgeBallot('Tasting Judges (Elders)', ['Taste', 'Presentation']),
        ];
    }
    if (preg_match('/costume|fashion|pageant|parade|runway/i', $name)) {
        return [
            'senior_role' => 'Celebrity judges panel with large-print ballots; seated poses welcome if they also enter.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
            'printable' => $judgeBallot('Style Judges (Elders)', ['Creativity', 'Presence', 'Comedy']),
        ];
    }
    if (preg_match('/ring toss|cornhole|bowling|horseshoe|ping pong|bean bag/i', $name)) {
        return [
            'senior_role' => 'Scorekeepers / prize presenters, or seated tossers at a shorter distance.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
            'printable' => $timekeeper(),
        ];
    }
    if (preg_match('/photo|slideshow|booth|album/i', $name)) {
        return [
            'senior_role' => 'Seated subjects, narrators who identify people/years, or prop helpers.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
        ];
    }
    if (preg_match('/story|toast|roast|speech|board|love you/i', $name)) {
        return [
            'senior_role' => 'Featured speakers / storytellers from seats with a mic.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
        ];
    }
    if (preg_match('/poker|cards|rummikub|domino|charades|guess|mystery|wink/i', $name)) {
        return [
            'senior_role' => 'Primary seated players at the table or circle.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
        ];
    }
    if (preg_match('/pumpkin|decorating|craft|ornament/i', $name)) {
        return [
            'senior_role' => 'Seated crafters and/or contest judges with large-print ballots.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
        ];
    }
    if (preg_match('/pin the|donut|bobbing|apple/i', $name)) {
        return [
            'senior_role' => 'Timekeepers, blindfold helpers, and prize presenters from seats.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'none',
            'printable' => $timekeeper(),
        ];
    }

    if (preg_match('/haunted walk|mini haunted|trunk-or-treat|glow-in-the-dark/i', $name)) {
        return [
            'senior_role' => 'Entrance greeters / ticket-takers on stools; scare-free zone hosts for little kids.',
            'senior_friendly' => 1,
            'seated_play' => 1,
            'mobility_level' => 'low',
        ];
    }

    return null;
}

function list_activities_ctx(array $args, string $root): array
{
    if ($args['local']) {
        Celebr8CatalogModel::ensureSchema();
        return Celebr8CatalogModel::listActivities();
    }
    $token = load_agent_token($root);
    $res = agent_request($args['base'], $token, 'GET', 'list_activities');
    return $res['activities'] ?? [];
}

function upsert_ctx(array $args, string $root, array $payload): array
{
    if ($args['local']) {
        return Celebr8CatalogModel::upsertActivity($payload);
    }
    $token = load_agent_token($root);
    $res = agent_request($args['base'], $token, 'POST', 'upsert_activity', $payload);
    return $res['activity'] ?? [];
}

// ——— main ———
$mode = $args['apply'] ? 'APPLY' : 'DRY-RUN';
$where = $args['local'] ? 'local' : ('agent:' . $args['base']);
fwrite(STDOUT, "Celebr8 senior seed [{$mode}] via {$where}\n");

$existing = list_activities_ctx($args, $root);
$byName = [];
foreach ($existing as $a) {
    $byName[strtolower((string)$a['name'])] = $a;
}
fwrite(STDOUT, 'Library size: ' . count($existing) . "\n");

$created = 0;
$updatedNew = 0;
$rolesFilled = 0;
$flagsSet = 0;
$printablesAdded = 0;
$skippedRole = 0;

$newActs = new_senior_activities();
fwrite(STDOUT, 'New activity definitions: ' . count($newActs) . "\n");

foreach ($newActs as $def) {
    $typeTag = (string)($def['type_tag'] ?? 'side');
    unset($def['type_tag']);
    $name = (string)$def['name'];
    $prior = $byName[strtolower($name)] ?? null;
    $action = $prior ? 'refresh' : 'create';
    fwrite(STDOUT, "  [{$typeTag}] {$action}: {$name}\n");
    if (!$args['apply']) {
        if ($prior) {
            $updatedNew++;
        } else {
            $created++;
        }
        continue;
    }
    $saved = upsert_ctx($args, $root, $def);
    if ($prior) {
        $updatedNew++;
    } else {
        $created++;
    }
    $byName[strtolower($name)] = $saved;
}

// Fill senior_role / flags on existing (including ones we did not just create)
$existing = list_activities_ctx($args, $root);
foreach ($existing as $a) {
    $name = (string)$a['name'];
    $pack = role_for_existing($name);
    if ($pack === null) {
        continue;
    }

    $payload = ['id' => (int)$a['id'], 'name' => $name];
    $changed = false;

    $roleEmpty = trim((string)($a['senior_role'] ?? '')) === '';
    if ($roleEmpty && trim((string)$pack['senior_role']) !== '') {
        $payload['senior_role'] = $pack['senior_role'];
        $changed = true;
        $rolesFilled++;
    } else {
        $skippedRole++;
    }

    if (!empty($pack['senior_friendly']) && (int)($a['senior_friendly'] ?? 0) === 0) {
        $payload['senior_friendly'] = 1;
        $changed = true;
        $flagsSet++;
    }
    if (array_key_exists('seated_play', $pack) && (int)$pack['seated_play'] === 1 && (int)($a['seated_play'] ?? 0) === 0) {
        $payload['seated_play'] = 1;
        $changed = true;
        $flagsSet++;
    }
    // Set mobility when first marking senior-friendly, or when mobility was never customized.
    if (!empty($pack['mobility_level']) && !empty($payload['senior_friendly'])) {
        $payload['mobility_level'] = $pack['mobility_level'];
        $changed = true;
    }
    if (!empty($pack['hearing_vision_notes']) && trim((string)($a['hearing_vision_notes'] ?? '')) === '') {
        $payload['hearing_vision_notes'] = $pack['hearing_vision_notes'];
        $changed = true;
    }

    if (!empty($pack['printable']) && $roleEmpty) {
        $prints = is_array($a['printables'] ?? null) ? $a['printables'] : [];
        $title = (string)($pack['printable']['title'] ?? '');
        $have = false;
        foreach ($prints as $p) {
            if (strcasecmp((string)($p['title'] ?? ''), $title) === 0) {
                $have = true;
                break;
            }
        }
        if (!$have && $title !== '') {
            $prints[] = $pack['printable'];
            $payload['printables'] = $prints;
            $changed = true;
            $printablesAdded++;
        }
    }

    if (!$changed) {
        continue;
    }

    fwrite(STDOUT, '  role/flags: ' . $name . ($roleEmpty ? ' (+role)' : '') . "\n");
    if ($args['apply']) {
        upsert_ctx($args, $root, $payload);
    }
}

fwrite(STDOUT, "\nSummary [{$mode}]\n");
fwrite(STDOUT, "  new activities created: {$created}\n");
fwrite(STDOUT, "  new activity defs refreshed: {$updatedNew}\n");
fwrite(STDOUT, "  existing senior_role filled: {$rolesFilled}\n");
fwrite(STDOUT, "  flag updates (senior/seated): {$flagsSet}\n");
fwrite(STDOUT, "  role printables appended: {$printablesAdded}\n");
fwrite(STDOUT, "  activities with role already set (skipped fill): {$skippedRole}\n");
if (!$args['apply']) {
    fwrite(STDOUT, "Re-run with --apply to write.\n");
}
