<?php

declare(strict_types=1);

/**
 * Seed Celebr8 party templates + activity library from local inbox.
 *
 * Reads ~/celebr8-inbox/parties/activities.json (and uses optimized images under private/celebr8/).
 * Does NOT commit inbox CSVs/raw folders.
 *
 * Usage:
 *   php scripts/celebr8/seed_party_catalog_from_inbox.php
 *   php scripts/celebr8/seed_party_catalog_from_inbox.php --via-api
 */

require_once dirname(__DIR__, 2) . '/api/bootstrap.php';
require_once dirname(__DIR__, 2) . '/includes/celebr8_model.php';
require_once dirname(__DIR__, 2) . '/includes/celebr8_catalog_model.php';

function celebr8_catalog_inbox_dir(): string
{
    $env = trim((string)(getenv('CELEBR8_INBOX_DIR') ?: ''));
    if ($env !== '') {
        return rtrim($env, '/') . '/parties';
    }
    return rtrim((string)getenv('HOME'), '/') . '/celebr8-inbox/parties';
}

/** @return list<array<string,mixed>> */
function celebr8_catalog_template_defs(): array
{
    return [
        [
            'slug' => 'halloween',
            'name' => "Halloween Graves'yard Party",
            'description' => 'Recurring yearly Graves family Halloween bash with graveyard theme, chili cook-off, costumes, and karaoke.',
            'theme' => "Spooky graveyard with tombstones, a zombie hand bursting from the ground, and fog. The 2014 name, \"Halloween Graves'yard Party\", is a pun on the Graves family name.",
            'taglines' => [
                'Come to this spooktastic party',
                'Bring a bowl of your very own famous chili for a cook-off',
                'Dress up in your favorite Halloween costume for a chance to win the costume contest',
                'Bring your singing voice for some Karaoke Kraziness!',
                'All are invited!',
                'It will be the party worth dying for',
                "Children are welcome...in case we run out of chili! Bahahaha!",
                "If you can't bring chili then just bring an appetizer or dessert",
                'A Graveyard Smash!',
            ],
            'usual_timing' => 'Late October — Saturday nearest Halloween (historically ~6:00 PM start). 2026: Fri Oct 30, little bats 6 PM / big monsters 7 PM.',
            'food_notes' => "Guests bring chili for the cook-off. Anyone not bringing chili brings an appetizer or dessert for Monster Munchies.\nToppings bar, cornbread and drinks are (suggested).",
            'byob_notes' => 'Neither historical flyer mentions BYOB; treat BYOB as (suggested) and editable.',
            'music_playlist' => [
                '1 Creepy-Haunted-House-Organ-Music',
                '1 Scary-Organ-Music-1',
                '2 Halloween-Themed-Stuff-Spooky-Music-Part-3',
                '2 Haunted-Mansion-Organ',
                '2 Origin-for-Pipe-Organ-Dark-Organ-Music-by-Frederik-Magle',
                '4 Sisters Reunited - Carnival-of-Souls-1962-Scary-Organ-Music',
                '5 Creepy-Organ-Music',
                '6 Psycho.-Murder-Music',
                '7 Hitchcocks-Music-Psycho',
                'Beautiful-Torment-Dark-Scary-Piano-Organ-Music',
                'HAUNTED-MANSION-ORGAN-MUSIC',
                'Halloween-Organ-Music-FREE-DOWNLOAD-LINK-INCLUDED',
                'halloween-music-creepy-organ',
                '~Archives/3 scary-original-organ-song',
            ],
            'hero_image_path' => 'halloween/hero.webp',
            'gallery' => [
                ['path' => 'halloween/flyer-2016.webp', 'label' => 'Flyer 2016'],
                ['path' => 'halloween/flyer-2014.webp', 'label' => 'Flyer 2014'],
                ['path' => 'halloween/graveyard5.webp', 'label' => 'Foggy cemetery (wide hero alternate)'],
                ['path' => 'halloween/graveyard2.webp', 'label' => 'Halloween Party card / thumbnail'],
                ['path' => 'halloween/graveyard.webp', 'label' => 'Friendly kids tombstones (suggested)'],
                ['path' => 'halloween/graveyard6.webp', 'label' => 'Graveyard art continuity'],
            ],
            'past_venue_notes' => "Past venues only — never auto-fill as a new event location:\n- The Big Red Barn, 199 Windy Hill Drive, Dawsonville, GA 30534 (Halloween 2016)\n- 2014 flyer listed no location.",
            'default_activity_names' => [
                'Chili Cook-Off',
                'Costume Contest',
                'Karaoke Kraziness',
                '"Not a Chili Chef?" Monster Munchies Table',
            ],
            'is_suggested' => 0,
            'notes' => 'Jon throws this every year. Keep graveyard/zombie-hand art for brand continuity. 2015 flyer was a Google Drawing (not readable).',
        ],
        [
            'slug' => 'new-years-eve',
            'name' => "New Year's Eve Pajamin' Party",
            'description' => 'Pajama party with onesies, footie pajamas and flannel. Treat as a reusable yearly template (suggested).',
            'theme' => 'Pajama party with onesies, footie pajamas and flannel.',
            'taglines' => [
                "New Year's Eve Pajamin' Party",
                "Let's Finish 2016 with a BANG!",
                'BYOB and an appetizer or dessert',
                'Drink too Much? We Will Find Out With a FUN Challenge',
                'If you need to bring your kids they will be quarantined to the basement',
            ],
            'usual_timing' => 'December 31 (flyer typo said January; Dec 31 2016 was a Saturday). Typical start ~6:00 PM.',
            'food_notes' => 'Each guest brings an appetizer or dessert. A midnight champagne toast and a cereal or breakfast-for-dinner bar fit the pajama theme (suggested).',
            'byob_notes' => 'BYOB.',
            'music_playlist' => [],
            'hero_image_path' => 'nye/hero.webp',
            'gallery' => [
                ['path' => 'nye/flyer-2017.webp', 'label' => 'Flyer 2017'],
                ['path' => 'nye/pj-party.webp', 'label' => 'Illustrated onesies alternate'],
            ],
            'past_venue_notes' => "Past venues only — never auto-fill as a new event location:\n- Jon & Sarah's House, 3109 Oakmont Dr., Monroe, GA 30656 (NYE 2016/17)",
            'default_activity_names' => [
                'Pajama Fashion Show',
                'Karaoke Contest',
                '"Drink too Much?" FUN Challenge',
            ],
            'is_suggested' => 1,
            'notes' => 'Reusable yearly template (suggested). Adult-focused; kids to the basement. Inspiration art in source Images/ is third-party, not Jon\'s events.',
        ],
        [
            'slug' => 'poker-ping-pong',
            'name' => 'Poker & Ping Pong Party',
            'description' => 'Casual game night with poker, ping pong, other games, and karaoke.',
            'theme' => 'Casual game night with poker and ping pong. Banner art is cards, poker chips and paddles.',
            'taglines' => [
                'We were just going to call it a PP party, but then our focus group said that would send the wrong message.',
                "Honestly though, some people don't really like Poker so we can just play any game that sounds fun :)",
                'Will there be karaoke? Seriously? Do you have to ask that question?',
                "Bring something yummy to eat. And bring your own alcohol too. I'm not rich - I can't afford to feed all of you inbreeds.",
            ],
            'usual_timing' => 'Not stated — works any time of year, indoors or in the garage (suggested). Flyer: start around 6:00 or maybe 7:00.',
            'food_notes' => 'Potluck — bring something yummy to eat.',
            'byob_notes' => 'BYOB.',
            'music_playlist' => [],
            'hero_image_path' => 'poker/hero.webp',
            'gallery' => [
                ['path' => 'poker/banner.webp', 'label' => 'Banner (card layout)'],
            ],
            'past_venue_notes' => "Past venues only — never auto-fill as a new event location:\n- Jon & Sarah's House, 3109 Oakmont Dr., Monroe, GA 30656",
            'default_activity_names' => [
                'Poker Tournament',
                'Ping Pong Tournament',
                'Any Game That Sounds Fun',
                'Karaoke (Obviously)',
            ],
            'is_suggested' => 1,
            'notes' => 'One historical flyer; could recur (suggested).',
        ],
        [
            'slug' => 'labor-day',
            'name' => 'Labor Day Party',
            'description' => 'End-of-summer backyard cookout. Whole template is inferred — label content as suggested.',
            'theme' => 'End-of-summer backyard cookout (suggested).',
            'taglines' => [
                'Work hard, party harder. (suggested)',
                "Summer's last hurrah. (suggested)",
            ],
            'usual_timing' => 'Labor Day weekend — first Monday of September; Saturday or Monday afternoon (suggested).',
            'food_notes' => 'Grill potluck: host provides burgers and dogs, guests bring sides and desserts (suggested).',
            'byob_notes' => 'BYOB (suggested).',
            'music_playlist' => [],
            'hero_image_path' => '',
            'gallery' => [],
            'past_venue_notes' => '',
            'default_activity_names' => [
                'Cornhole Tournament',
                'Water Balloon Toss',
                'Horseshoes',
            ],
            'is_suggested' => 1,
            'notes' => 'No source content — fully suggested / inferred. Upload a backyard BBQ hero when available (suggested).',
        ],
        [
            'slug' => 'milestone-birthday',
            'name' => 'Milestone 40th Birthday',
            'description' => 'Reusable 40th birthday template (Angela, Sarah, Jason Barrett instances existed as empty folders). Swap in the honoree\'s name.',
            'theme' => '"Over the Hill" / "Fabulous at 40", or themed on the decade the guest of honor grew up in (suggested).',
            'taglines' => [
                '40 and Fabulous (suggested)',
                'Aged to Perfection (suggested)',
                "Lordy, Lordy, look who's 40! (suggested)",
            ],
            'usual_timing' => "Weekend nearest the guest of honor's birthday (suggested).",
            'food_notes' => 'Birthday cake and dessert table, apps potluck, or a signature cocktail named for the honoree (suggested).',
            'byob_notes' => 'BYOB (suggested).',
            'music_playlist' => [],
            'hero_image_path' => '',
            'gallery' => [],
            'past_venue_notes' => '',
            'default_activity_names' => [
                'Roast and Toasts',
                'Guess the Year Trivia',
                'Photo Slideshow: 40 Years of the Honoree',
                '40 Reasons We Love You Board',
                'Birth-Year Karaoke',
            ],
            'is_suggested' => 1,
            'notes' => 'Fully suggested — empty source folders. Upload a photo of the honoree as hero (suggested).',
        ],
    ];
}

/** @return array{templates:int, activities:int, halloween_linked:int, halloween_activities:int} */
function celebr8_catalog_seed_local(string $partiesDir): array
{
    Celebr8Model::ensureSchema();
    Celebr8CatalogModel::ensureSchema();

    $activitiesPath = $partiesDir . '/activities.json';
    if (!is_file($activitiesPath)) {
        throw new RuntimeException('Missing activities.json at ' . $activitiesPath);
    }
    $raw = file_get_contents($activitiesPath);
    $list = json_decode((string)$raw, true);
    if (!is_array($list)) {
        throw new RuntimeException('Invalid activities.json');
    }

    $activityCount = 0;
    foreach ($list as $row) {
        if (!is_array($row)) {
            continue;
        }
        $source = (string)($row['source'] ?? '');
        Celebr8CatalogModel::upsertActivity([
            'name' => (string)($row['name'] ?? ''),
            'party_types' => $row['party_types'] ?? [],
            'category' => (string)($row['category'] ?? 'other'),
            'description' => (string)($row['description'] ?? ''),
            'ages' => (string)($row['ages'] ?? 'all'),
            'supplies' => $row['supplies'] ?? [],
            'prizes' => $row['prizes'] ?? null,
            'setup_notes' => (string)($row['setup_notes'] ?? ''),
            'source' => $source,
            'is_suggested' => strtolower(trim($source)) === 'suggested' ? 1 : 0,
        ]);
        $activityCount++;
    }

    $templateCount = 0;
    foreach (celebr8_catalog_template_defs() as $def) {
        Celebr8CatalogModel::upsertTemplate($def);
        $templateCount++;
    }

    $halloweenTpl = Celebr8CatalogModel::getTemplateBySlug('halloween');
    $event = Celebr8Model::getEventBySlug('halloween-party-2026');
    $linked = 0;
    $attached = 0;
    if ($halloweenTpl && $event) {
        Celebr8CatalogModel::linkEventToTemplate((int)$event['id'], (int)$halloweenTpl['id']);
        $linked = 1;
        $attachSpecs = [
            ['name' => 'Chili Cook-Off', 'time_slot' => '7 PM big monsters', 'sort_order' => 0],
            ['name' => 'Costume Contest', 'time_slot' => '6 PM little bats / 7 PM big monsters', 'sort_order' => 1],
            ['name' => 'Karaoke Kraziness', 'time_slot' => 'All evening', 'sort_order' => 2],
            ['name' => '"Not a Chili Chef?" Monster Munchies Table', 'time_slot' => '6 PM onward', 'sort_order' => 3],
        ];
        foreach ($attachSpecs as $spec) {
            $act = Celebr8CatalogModel::getActivityByName($spec['name']);
            if (!$act) {
                continue;
            }
            Celebr8CatalogModel::attachActivityToEvent((int)$event['id'], (int)$act['id'], [
                'time_slot' => $spec['time_slot'],
                'sort_order' => $spec['sort_order'],
            ]);
            $attached++;
        }
    }

    return [
        'templates' => $templateCount,
        'activities' => $activityCount,
        'halloween_linked' => $linked,
        'halloween_activities' => $attached,
    ];
}

/**
 * @return array{templates:int, activities:int, halloween_linked:int, halloween_activities:int}
 */
function celebr8_catalog_seed_via_api(string $partiesDir, string $baseUrl, string $token): array
{
    $request = static function (string $method, string $action, ?array $payload = null) use ($baseUrl, $token): array {
        $url = rtrim($baseUrl, '/') . '/api/celebr8_agent.php?action=' . rawurlencode($action);
        $headers = [
            'Accept: application/json',
            'Authorization: Bearer ' . $token,
        ];
        $body = null;
        if ($payload !== null) {
            $headers[] = 'Content-Type: application/json';
            $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_POSTFIELDS => $body,
        ]);
        $raw = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        unset($ch);
        if ($raw === false) {
            throw new RuntimeException('API request failed: ' . $err);
        }
        $json = json_decode($raw, true);
        if ($code >= 400 || !is_array($json) || empty($json['success'])) {
            $msg = is_array($json) ? (string)($json['error'] ?? $raw) : $raw;
            throw new RuntimeException("API {$action} HTTP {$code}: {$msg}");
        }
        return $json;
    };

    $request('GET', 'list_events');

    $activitiesPath = $partiesDir . '/activities.json';
    $list = json_decode((string)file_get_contents($activitiesPath), true);
    if (!is_array($list)) {
        throw new RuntimeException('Invalid activities.json');
    }
    $activityCount = 0;
    foreach ($list as $row) {
        if (!is_array($row)) {
            continue;
        }
        $source = (string)($row['source'] ?? '');
        $request('POST', 'upsert_activity', [
            'name' => (string)($row['name'] ?? ''),
            'party_types' => $row['party_types'] ?? [],
            'category' => (string)($row['category'] ?? 'other'),
            'description' => (string)($row['description'] ?? ''),
            'ages' => (string)($row['ages'] ?? 'all'),
            'supplies' => $row['supplies'] ?? [],
            'prizes' => $row['prizes'] ?? null,
            'setup_notes' => (string)($row['setup_notes'] ?? ''),
            'source' => $source,
            'is_suggested' => strtolower(trim($source)) === 'suggested' ? 1 : 0,
        ]);
        $activityCount++;
    }

    $templateCount = 0;
    $halloweenTplId = 0;
    foreach (celebr8_catalog_template_defs() as $def) {
        $res = $request('POST', 'upsert_template', $def);
        $templateCount++;
        if (($def['slug'] ?? '') === 'halloween') {
            $halloweenTplId = (int)($res['template']['id'] ?? 0);
        }
    }

    $events = $request('GET', 'list_events');
    $eventId = 0;
    foreach ($events['events'] ?? [] as $ev) {
        if (($ev['slug'] ?? '') === 'halloween-party-2026') {
            $eventId = (int)$ev['id'];
            break;
        }
    }
    $linked = 0;
    $attached = 0;
    if ($eventId > 0 && $halloweenTplId > 0) {
        $request('POST', 'link_event_template', [
            'event_id' => $eventId,
            'template_id' => $halloweenTplId,
        ]);
        $linked = 1;
        $acts = $request('GET', 'list_activities');
        $byName = [];
        foreach ($acts['activities'] ?? [] as $a) {
            $byName[(string)$a['name']] = (int)$a['id'];
        }
        $attachSpecs = [
            ['name' => 'Chili Cook-Off', 'time_slot' => '7 PM big monsters', 'sort_order' => 0],
            ['name' => 'Costume Contest', 'time_slot' => '6 PM little bats / 7 PM big monsters', 'sort_order' => 1],
            ['name' => 'Karaoke Kraziness', 'time_slot' => 'All evening', 'sort_order' => 2],
            ['name' => '"Not a Chili Chef?" Monster Munchies Table', 'time_slot' => '6 PM onward', 'sort_order' => 3],
        ];
        foreach ($attachSpecs as $spec) {
            $aid = $byName[$spec['name']] ?? 0;
            if ($aid <= 0) {
                continue;
            }
            $request('POST', 'attach_event_activity', [
                'event_id' => $eventId,
                'activity_id' => $aid,
                'time_slot' => $spec['time_slot'],
                'sort_order' => $spec['sort_order'],
            ]);
            $attached++;
        }
    }

    return [
        'templates' => $templateCount,
        'activities' => $activityCount,
        'halloween_linked' => $linked,
        'halloween_activities' => $attached,
    ];
}

$viaApi = in_array('--via-api', $argv, true);
$partiesDir = celebr8_catalog_inbox_dir();
if (!is_dir($partiesDir)) {
    fwrite(STDERR, "Parties inbox not found: {$partiesDir}\n");
    exit(1);
}

try {
    if ($viaApi) {
        $tokenPath = dirname(__DIR__, 2) . '/.local/state/celebr8/agent-api-token';
        $token = is_file($tokenPath) ? trim((string)file_get_contents($tokenPath)) : '';
        if ($token === '') {
            throw new RuntimeException('Missing agent token at .local/state/celebr8/agent-api-token');
        }
        $base = trim((string)(getenv('CELEBR8_API_BASE') ?: 'https://catn8.us'));
        $result = celebr8_catalog_seed_via_api($partiesDir, $base, $token);
        fwrite(STDOUT, "catalog_seeded_via_api templates={$result['templates']} activities={$result['activities']} halloween_linked={$result['halloween_linked']} halloween_activities={$result['halloween_activities']}\n");
    } else {
        $result = celebr8_catalog_seed_local($partiesDir);
       fwrite(STDOUT, "catalog_seeded_local templates={$result['templates']} activities={$result['activities']} halloween_linked={$result['halloween_linked']} halloween_activities={$result['halloween_activities']}\n");
    }
} catch (Throwable $e) {
    fwrite(STDERR, 'Catalog seed failed: ' . $e->getMessage() . "\n");
    exit(1);
}
