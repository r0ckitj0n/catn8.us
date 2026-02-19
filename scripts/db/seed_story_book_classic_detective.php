<?php

declare(strict_types=1);

header('Content-Type: application/json');

require_once __DIR__ . '/../../api/config.php';

function respond(bool $ok, array $data = []): void {
    echo json_encode(($ok ? ['success' => true] : ['success' => false]) + $data);
    exit;
}

$catn8_story_book_theme_catalog = static function (): array {
    return [
        ['key' => 'murder', 'label' => 'Murder'],
        ['key' => 'missing_person', 'label' => 'Missing Person'],
        ['key' => 'kidnapping', 'label' => 'Kidnapping'],
        ['key' => 'stolen_object', 'label' => 'Stolen Object'],
        ['key' => 'fraud_scam', 'label' => 'Fraud / Scam'],
        ['key' => 'blackmail_extortion', 'label' => 'Blackmail / Extortion'],
        ['key' => 'found_phone', 'label' => 'Found Phone'],
        ['key' => 'amnesia_identity', 'label' => 'Amnesia / Identity'],
        ['key' => 'cold_case', 'label' => 'Cold Case'],
        ['key' => 'art_heist', 'label' => 'Art / Heist'],
        ['key' => 'serial_crime', 'label' => 'Serial Crime'],
        ['key' => 'conspiracy_coverup', 'label' => 'Conspiracy / Cover-up'],
        ['key' => 'paranormal', 'label' => 'Paranormal'],
        ['key' => 'extra_terrestrial', 'label' => 'Extra-terrestrial'],
        ['key' => 'sci_fi_tech', 'label' => 'Sci‑Fi / Tech'],
        ['key' => 'other', 'label' => 'Other'],
    ];
};

$catn8_story_book_theme_key_set = static function () use ($catn8_story_book_theme_catalog): array {
    $set = [];
    foreach ($catn8_story_book_theme_catalog() as $t) {
        $k = trim((string)($t['key'] ?? ''));
        if ($k !== '') $set[$k] = true;
    }
    return $set;
};

$catn8_story_book_classify_theme = static function (string $title, string $sourceText, array $meta) use ($catn8_story_book_theme_key_set): string {
    $txt = strtolower(trim($title . "\n" . $sourceText));
    if ($txt === '') return 'other';

    $scores = [
        'murder' => 0,
        'missing_person' => 0,
        'kidnapping' => 0,
        'stolen_object' => 0,
        'fraud_scam' => 0,
        'blackmail_extortion' => 0,
        'found_phone' => 0,
        'amnesia_identity' => 0,
        'cold_case' => 0,
        'art_heist' => 0,
        'serial_crime' => 0,
        'conspiracy_coverup' => 0,
        'paranormal' => 0,
        'extra_terrestrial' => 0,
        'sci_fi_tech' => 0,
    ];

    $bump = static function (string $key, int $n = 1) use (&$scores): void {
        if (isset($scores[$key])) $scores[$key] += $n;
    };

    if (str_contains($txt, 'murder') || str_contains($txt, 'homicide') || str_contains($txt, 'killed') || str_contains($txt, 'dead body') || str_contains($txt, 'corpse')) $bump('murder', 3);
    if (str_contains($txt, 'missing person') || str_contains($txt, 'missing') || str_contains($txt, 'vanished') || str_contains($txt, 'disappeared')) $bump('missing_person', 2);
    if (str_contains($txt, 'kidnap') || str_contains($txt, 'abduct') || str_contains($txt, 'ransom')) $bump('kidnapping', 3);
    if (str_contains($txt, 'stolen') || str_contains($txt, 'stole') || str_contains($txt, 'theft') || str_contains($txt, 'robbery')) $bump('stolen_object', 2);
    if (str_contains($txt, 'scam') || str_contains($txt, 'fraud') || str_contains($txt, 'embezzle') || str_contains($txt, 'forgery') || str_contains($txt, 'ponzi')) $bump('fraud_scam', 3);
    if (str_contains($txt, 'blackmail') || str_contains($txt, 'extort') || str_contains($txt, 'leverage') || str_contains($txt, 'demanded payment')) $bump('blackmail_extortion', 3);
    if (str_contains($txt, 'found phone') || str_contains($txt, 'lost phone') || str_contains($txt, 'burner phone') || str_contains($txt, 'voicemail') || str_contains($txt, 'text message')) $bump('found_phone', 2);
    if (str_contains($txt, 'amnesia') || str_contains($txt, 'no memory') || str_contains($txt, 'identity') || str_contains($txt, 'imposter') || str_contains($txt, 'unknown man') || str_contains($txt, 'unknown woman')) $bump('amnesia_identity', 2);
    if (str_contains($txt, 'cold case') || str_contains($txt, 'years ago') || str_contains($txt, 'unsolved') || str_contains($txt, 're-open')) $bump('cold_case', 2);
    if (str_contains($txt, 'heist') || str_contains($txt, 'museum') || str_contains($txt, 'painting') || str_contains($txt, 'artifact') || str_contains($txt, 'priceless')) $bump('art_heist', 2);
    if (str_contains($txt, 'serial killer') || str_contains($txt, 'pattern') || str_contains($txt, 'multiple victims') || str_contains($txt, 'signature')) $bump('serial_crime', 3);
    if (str_contains($txt, 'conspiracy') || str_contains($txt, 'cover-up') || str_contains($txt, 'cover up') || str_contains($txt, 'corrupt') || str_contains($txt, 'secret society')) $bump('conspiracy_coverup', 2);
    if (str_contains($txt, 'haunted') || str_contains($txt, 'ghost') || str_contains($txt, 'curse') || str_contains($txt, 'occult') || str_contains($txt, 'seance')) $bump('paranormal', 3);
    if (str_contains($txt, 'ufo') || str_contains($txt, 'alien') || str_contains($txt, 'abduction') || str_contains($txt, 'extraterrestrial')) $bump('extra_terrestrial', 3);
    if (str_contains($txt, 'ai') || str_contains($txt, 'robot') || str_contains($txt, 'android') || str_contains($txt, 'hacked') || str_contains($txt, 'cyber') || str_contains($txt, 'deepfake')) $bump('sci_fi_tech', 2);

    $metaTheme = strtolower(trim((string)($meta['theme'] ?? $meta['theme_key'] ?? '')));
    if ($metaTheme !== '') {
        $set = $catn8_story_book_theme_key_set();
        if (isset($set[$metaTheme])) return $metaTheme;
    }

    $best = 'other';
    $bestScore = 0;
    foreach ($scores as $k => $v) {
        if ($v > $bestScore) {
            $best = $k;
            $bestScore = $v;
        }
    }
    return $bestScore > 0 ? $best : 'other';
};

try {
    Database::getInstance();
} catch (Throwable $e) {
    respond(false, ['message' => 'DB connection failed', 'error' => $e->getMessage()]);
}

$ownerUserId = 0;

// NOTE: These are ORIGINAL seed stories inspired by classic detective tropes.
// They are not retellings and contain no copyrighted text.
$stories = [
    [
        'slug' => 'classic-locked-room-snowbound-manor',
        'title' => 'The Snowbound Locked Room',
        'source_text' => "A blizzard seals a remote manor. The host is found dead in a study bolted from the inside, windows iced shut, and fresh snow outside shows no footprints. The household insists the victim never opened the door after dinner.\n\nThe detective focuses on timing, routines, and the physics of the room: a missing candlestick nub, a damp patch under the rug, and a servant’s unusual insistence on stoking the fire. A bitter inheritance dispute hides in polite conversation, while a frightened guest plants a confession letter meant to steer suspicion.\n\nThe truth hinges on a mundane mechanism disguised as impossibility: an innocent-seeming household convenience is re-purposed to lock the room after the killer leaves, and the victim’s own habits provide the necessary misdirection. The culprit’s motive is protection of a secret lineage and fear of scandal, not greed.",
        'meta' => [
            'genre' => 'classic_detective',
            'tropes' => ['locked_room', 'snowbound', 'country_house', 'mechanical_trick', 'inheritance'],
            'notes' => 'Use a physical trick explainable with everyday objects; keep culprit among the household staff or close family.',
        ],
    ],
    [
        'slug' => 'classic-tea-service-poison-and-alibi',
        'title' => 'The Poisoned Tea Service',
        'source_text' => "At a genteel afternoon gathering, a respected philanthropist collapses after taking the first sip of tea. The teapot, cups, and sugar bowl were in view, and the victim refused any drink except from their favorite cup.\n\nSuspects include: a jealous understudy whose career was ruined by a whispered letter, a spouse exhausted by public virtue and private cruelty, and a quietly furious cousin who discovered forged signatures on charity documents.\n\nThe detective reconstructs the service: who handled which utensil, who offered the sugar tongs, who insisted on rearranging the tray ‘for aesthetics,’ and who hovered near the warming plate. The solution reveals a dose delivered via an overlooked step in etiquette (something that can be touched briefly without drawing attention), paired with a staged panic that creates an alibi window.\n\nTheme: in the most polite rooms, rules become weapons.",
        'meta' => [
            'genre' => 'classic_detective',
            'tropes' => ['poison', 'social_etiquette', 'false_alibi', 'financial_fraud'],
            'notes' => 'Clues should be tiny and procedural: tray placement, order of pouring, etc.',
        ],
    ],
    [
        'slug' => 'classic-train-compartment-misdirection',
        'title' => 'Murder in the Quiet Compartment',
        'source_text' => "Overnight on a long-distance train, a passenger is found stabbed in a private compartment during a brief tunnel blackout. The corridor was crowded, yet no one saw anyone enter or leave. The victim was traveling under an assumed name and carried a cheap suitcase that appears swapped.\n\nThe detective interviews passengers who heard footsteps, smelled cologne, or noticed a missing uniform button. A conductor’s log contradicts a wealthy traveler’s timeline by exactly one station.\n\nThe case resolves around identity and movement: a perpetrator uses the blackout to exchange roles (and clothing) with a confederate, exploiting assumptions about class and authority. The murder is not spontaneous; it’s the endpoint of a long grudge tied to a past legal case and a witness silenced years too late.",
        'meta' => [
            'genre' => 'classic_detective',
            'tropes' => ['train', 'blackout', 'identity_swap', 'conspiracy'],
            'notes' => 'Great for a tight cast; use timetable precision as a core mechanic.',
        ],
    ],
    [
        'slug' => 'classic-village-fete-missing-priceless-relic',
        'title' => 'The Summer Fete Relic',
        'source_text' => "A small town hosts its annual summer fete. A priceless historical relic is displayed in the church hall—then vanishes. Hours later, the curator is found dead behind the stage curtains. The town insists on blaming an outsider.\n\nThe detective looks past gossip and into mundane details: mud types on shoes, ribbon fibers, a broken costume clasp, and the order children lined up for games. Several townspeople have motives: a council member hiding embezzlement, a teacher shielding a sibling, and a vicar worried about a scandal that could close the church.\n\nThe solution reveals the relic theft and murder were linked only by coincidence. The murderer acted to silence an accusation unrelated to the relic, while the relic was stolen opportunistically and hidden in plain sight among festival decorations.",
        'meta' => [
            'genre' => 'classic_detective',
            'tropes' => ['small_town', 'festival', 'outsider_scapegoat', 'two_cases_intertwined'],
            'notes' => 'Good template for double-mystery structure: theft + murder with different culprits.',
        ],
    ],
    [
        'slug' => 'classic-study-of-ash-and-footprints',
        'title' => 'The Ashes on the Sill',
        'source_text' => "A controversial inventor is discovered dead in a rented townhouse. The window is open, and ash marks line the sill, as if someone climbed in—but the alley below is empty and the soot pattern doesn’t match local chimneys.\n\nThe inventor’s rivals argue over patents, while the landlord claims no one entered. A neighbor reports hearing violin music at an impossible hour.\n\nThe detective concludes the ash is staged, imported from a different source to point to a particular suspect known for working with coal and furnaces. The real entry was through a perfectly legal route: a scheduled service appointment used as cover. The murderer’s motive is to prevent a demonstration that would expose a dangerous flaw in a product already sold to the public.",
        'meta' => [
            'genre' => 'classic_detective',
            'tropes' => ['forensic_detail', 'staged_clue', 'patent_war', 'public_danger'],
            'notes' => 'Lean into observation and material science clues without modern tech.',
        ],
    ],
    [
        'slug' => 'classic-dinner-party-reversed-motive',
        'title' => 'The Dinner Where Everyone Benefited',
        'source_text' => "A celebrated host gathers close friends for a lavish dinner. By midnight the host is dead, and every guest can name a reason the victim ‘had it coming.’ The obvious motive is inheritance—but the will reveals the opposite: the victim’s death harms nearly everyone.\n\nThe detective uncovers that the real motive is reputational: the victim held letters that could ruin careers and marriages. The killer doesn’t want money; they want silence. The red herrings are deliberate confessions made to protect others, and the true clue is a small, overlooked inconsistency in the after-dinner routine (who cleared the dessert plates, who moved the decanter, who left first).\n\nThe resolution frames the murder as a desperate attempt to prevent a scandal from becoming public, with a final twist: the victim had already mailed copies of the letters.",
        'meta' => [
            'genre' => 'classic_detective',
            'tropes' => ['country_house', 'everyone_has_motive', 'blackmail', 'twist_ending'],
            'notes' => 'The will twist is key: murder harms the obvious beneficiaries.',
        ],
    ],
    [
        'slug' => 'classic-coastal-cliffside-time-of-death',
        'title' => 'The Cliffside Timepiece',
        'source_text' => "A body is found at the base of coastal cliffs below a lighthouse. Locals insist it was a suicide—until the detective notices the victim’s pocket watch stopped at a time that doesn’t match the tide line or the weather.\n\nSuspects include a lighthouse keeper with debts, a visiting academic researching shipwrecks, and a relative who arrived ‘just in time’ with urgent news.\n\nThe solution turns on time-of-death and environment: the body was moved after death to exploit tide schedules and plausible accident narratives. A seemingly helpful witness is exposed by an incorrect description of the lighthouse’s light pattern—a detail only someone present at a certain hour would know.",
        'meta' => [
            'genre' => 'classic_detective',
            'tropes' => ['coastal', 'staged_suicide', 'time_of_death', 'tide_alibi'],
            'notes' => 'Use environmental constraints (tide, wind, light schedule) as logic gates.',
        ],
    ],
    [
        'slug' => 'classic-art-studio-silent-model',
        'title' => 'The Silent Model',
        'source_text' => "An artist is murdered in a studio during a session with multiple observers: a patron, a rival painter, a shy model, and a critic. No one heard a struggle; the gramophone played loudly throughout. The murder weapon is missing, but a smear of unusual paint is found on the victim’s cuff.\n\nThe detective interrogates motive in the art world: stolen technique, hidden parentage, and a forged authenticity certificate. The key is understanding what everyone could and couldn’t see while posed, and how the gramophone both masks sound and enforces a timeline.\n\nThe murderer used the studio’s routine—posing breaks, repainting, washing brushes—to approach without suspicion. The final reveal shows the ‘shy’ model has a hidden connection to the victim, and the real motive is to reclaim an identity the victim stole.",
        'meta' => [
            'genre' => 'classic_detective',
            'tropes' => ['closed_circle', 'art_world', 'music_timeline', 'forgery'],
            'notes' => 'Good for clueing through sightlines and routine (breaks, washing).',
        ],
    ],
    [
        'slug' => 'classic-library-card-catalog-blackmail',
        'title' => 'The Card Catalog Cipher',
        'source_text' => "A librarian discovers coded notes hidden in a card catalog drawer—then is found dead in the stacks. The notes look like book references, but they point to a pattern of secret meetings.\n\nSuspects include a local politician researching ‘family history,’ a volunteer with a mysterious past, and a wealthy donor whose philanthropy masks cruelty.\n\nThe detective cracks the code as a simple indexing trick: titles and call numbers correspond to times and locations. The killer’s mistake is assuming the detective wouldn’t understand the library’s internal systems. The motive is classic blackmail, but the leverage isn’t money—it’s proof of a past crime the suspect reinvented themselves to escape.",
        'meta' => [
            'genre' => 'classic_detective',
            'tropes' => ['cipher', 'library', 'blackmail', 'reinvented_identity'],
            'notes' => 'Lets you build puzzles into the narrative: indexes, call numbers, referencing.',
        ],
    ],
    [
        'slug' => 'classic-garden-maze-confession',
        'title' => 'Confession in the Garden Maze',
        'source_text' => "At an estate garden party, the host’s estranged sibling is found dead in the hedge maze. Multiple guests claim they got lost and ‘couldn’t possibly’ have reached the center at the right time.\n\nThe detective maps the maze from overheard directions, shoe scuffs, and a misplaced boutonnière. The estate gardener knows hidden shortcuts, and a guest’s false confession is meant to protect a lover.\n\nThe culprit exploited the maze’s maintenance gates and scheduled watering, leaving misleading wet footprints. The motive is not inheritance but the fear of a decades-old secret being revealed at the party—one that would ruin the estate’s public image.",
        'meta' => [
            'genre' => 'classic_detective',
            'tropes' => ['maze', 'party', 'false_confession', 'mapping_puzzle'],
            'notes' => 'Make the maze itself a logic puzzle (paths, gates, watering schedule).',
        ],
    ],
    [
        'slug' => 'classic-boarding-house-alibi-board',
        'title' => 'The Boarding House Alibi Board',
        'source_text' => "In a crowded boarding house, the landlord is killed, and every tenant has a neat alibi—because the house runs on a strict sign-in board for meals and chores. The board looks airtight until the detective notices two entries written with the same pressure despite different handwriting.\n\nSuspects include a tenant hiding from the law, a lovestruck clerk, and a long-suffering cook.\n\nThe solution reveals the board itself was manipulated: someone learned to mimic timing and used a simple physical trick to pre-fill or alter entries. The murder ties back to a missing ledger and a tenant’s secret identity.",
        'meta' => [
            'genre' => 'classic_detective',
            'tropes' => ['boarding_house', 'alibi_system', 'forgery', 'hidden_ledger'],
            'notes' => 'Great for procedural clueing: handwriting, pressure, ink, timing.',
        ],
    ],
];

$created = 0;
$updated = 0;
$skipped = 0;
$errors = [];
$results = [];

try {
    Database::beginTransaction();

    foreach ($stories as $s) {
        $slug = (string)($s['slug'] ?? '');
        $title = (string)($s['title'] ?? '');
        $source = (string)($s['source_text'] ?? '');
        $meta = $s['meta'] ?? [];
        if (!is_array($meta)) $meta = [];

        if ($slug === '' || $title === '' || $source === '') {
            $skipped++;
            $errors[] = ['slug' => $slug, 'error' => 'Missing slug/title/source_text'];
            continue;
        }

        $theme = $catn8_story_book_classify_theme($title, $source, $meta);

        $metaJson = json_encode($meta, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($metaJson === false) $metaJson = '{}';

        $existing = Database::queryOne(
            'SELECT id FROM mystery_story_book_entries WHERE owner_user_id = ? AND slug = ? LIMIT 1',
            [$ownerUserId, $slug]
        );

        if ($existing) {
            $id = (int)($existing['id'] ?? 0);
            Database::execute(
                'UPDATE mystery_story_book_entries SET title = ?, theme = ?, source_text = ?, meta_json = ?, is_archived = 0 WHERE id = ? AND owner_user_id = ?',
                [$title, $theme, $source, $metaJson, $id, $ownerUserId]
            );
            $updated++;
            $results[] = ['action' => 'updated', 'id' => $id, 'slug' => $slug, 'title' => $title];
        } else {
            Database::execute(
                'INSERT INTO mystery_story_book_entries (owner_user_id, slug, title, theme, source_text, meta_json, is_archived) VALUES (?, ?, ?, ?, ?, ?, 0)',
                [$ownerUserId, $slug, $title, $theme, $source, $metaJson]
            );
            $row = Database::queryOne(
                'SELECT id FROM mystery_story_book_entries WHERE owner_user_id = ? AND slug = ? LIMIT 1',
                [$ownerUserId, $slug]
            );
            $id = (int)($row['id'] ?? 0);
            $created++;
            $results[] = ['action' => 'created', 'id' => $id, 'slug' => $slug, 'title' => $title];
        }
    }

    Database::commit();
} catch (Throwable $e) {
    if (Database::inTransaction()) Database::rollBack();
    respond(false, ['message' => 'Seeding failed', 'error' => $e->getMessage()]);
}

respond(true, [
    'owner_user_id' => $ownerUserId,
    'created' => $created,
    'updated' => $updated,
    'skipped' => $skipped,
    'errors' => $errors,
    'results' => $results,
]);
