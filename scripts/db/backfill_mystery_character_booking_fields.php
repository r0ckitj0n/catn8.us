<?php

declare(strict_types=1);

require_once __DIR__ . '/../../api/bootstrap.php';

if (PHP_SAPI !== 'cli') {
    catn8_require_admin();
}

function catn8_booking_clean_list($v): array {
    if (is_string($v)) {
        $parts = preg_split('/\s*,\s*/', $v) ?: [];
        return array_values(array_filter(array_map('trim', array_map('strval', $parts)), static function (string $x): bool {
            return $x !== '';
        }));
    }
    if (is_array($v)) {
        return array_values(array_filter(array_map('trim', array_map('strval', $v)), static function (string $x): bool {
            return $x !== '';
        }));
    }
    return [];
}

function catn8_booking_seed(string $s): int {
    $h = crc32($s);
    if (!is_int($h)) {
        $h = 0;
    }
    return (int)($h & 0x7fffffff);
}

function catn8_booking_pick(array $list, int $seed, int $salt = 0): string {
    if (!count($list)) return '';
    $idx = ($seed + ($salt * 7919)) % count($list);
    $val = $list[$idx] ?? '';
    return trim((string)$val);
}

function catn8_booking_height_inches(string $height): int {
    $height = trim($height);
    if ($height === '') return 0;

    if (preg_match('/^(\d)\s*\'\s*(\d{1,2})\s*(?:\"|in)?$/', $height, $m)) {
        $feet = (int)($m[1] ?? 0);
        $in = (int)($m[2] ?? 0);
        $total = ($feet * 12) + $in;
        return $total > 0 ? $total : 0;
    }

    if (preg_match('/^(\d{2,3})\s*(?:in|\")$/i', $height, $m)) {
        $in = (int)($m[1] ?? 0);
        return $in > 0 ? $in : 0;
    }

    return 0;
}

function catn8_booking_weight(int $heightIn, int $seed): string {
    $base = 160;
    if ($heightIn > 0) {
        $base = 110 + (int)round(($heightIn - 60) * 4.5);
    }
    $delta = (($seed % 41) - 20); // -20..+20
    $w = max(95, $base + $delta);
    return (string)$w . ' lb';
}

function catn8_booking_address(string $hometown, int $seed): string {
    $cityState = trim($hometown);
    if ($cityState === '') {
        $cityState = 'Unknown';
    }

    $streetNames = [
        'Magnolia',
        'Peachtree',
        'Oak',
        'Maple',
        'Pine',
        'River',
        'Cedar',
        'Church',
        'Main',
        'Broad',
    ];
    $streetTypes = ['St', 'Ave', 'Rd', 'Ln', 'Dr'];

    $num = 100 + ($seed % 9000);
    $street = catn8_booking_pick($streetNames, $seed, 1);
    $type = catn8_booking_pick($streetTypes, $seed, 2);

    if ($street === '' || $type === '') {
        return $cityState;
    }

    return (string)$num . ' ' . $street . ' ' . $type . ', ' . $cityState;
}

function catn8_booking_aliases(string $name, int $seed): array {
    $name = trim($name);
    $first = '';
    if ($name !== '') {
        $parts = preg_split('/\s+/', $name) ?: [];
        $first = trim((string)($parts[0] ?? ''));
    }

    $nicknames = ['Buddy', 'Red', 'Lucky', 'Ace', 'Sunshine', 'Boss', 'Doc', 'Scout', 'Sparky', 'Smiles'];

    $count = 1;
    if (($seed % 7) === 0) {
        $count = 2;
    }

    $out = [];
    for ($i = 0; $i < $count; $i++) {
        $n = catn8_booking_pick($nicknames, $seed, 10 + $i);
        if ($n === '') continue;
        if ($first !== '' && ($seed % 3) !== 0) {
            $n = $first . ' "' . $n . '"';
        }
        $out[] = $n;
    }

    $out = array_values(array_unique(array_filter(array_map('trim', $out), static function (string $x): bool {
        return $x !== '';
    })));

    return $out;
}

$rows = Database::queryAll(
    'SELECT id, game_id, entity_type, slug, name, data_json FROM mystery_entities WHERE entity_type = ? AND is_archived = 0',
    ['character']
);

$updated = 0;
$skipped = 0;
$errors = [];

foreach ($rows as $r) {
    $entityId = (int)($r['id'] ?? 0);
    if ($entityId <= 0) continue;

    $data = json_decode((string)($r['data_json'] ?? ''), true);
    if (!is_array($data)) {
        $errors[] = ['entity_id' => $entityId, 'error' => 'Invalid data_json'];
        continue;
    }

    if (!isset($data['static_profile']) || !is_array($data['static_profile'])) {
        $data['static_profile'] = [];
    }
    if (!isset($data['static_profile']['demographics']) || !is_array($data['static_profile']['demographics'])) {
        $data['static_profile']['demographics'] = [];
    }
    if (!isset($data['static_profile']['appearance']) || !is_array($data['static_profile']['appearance'])) {
        $data['static_profile']['appearance'] = [];
    }
    if (!isset($data['static_profile']['background']) || !is_array($data['static_profile']['background'])) {
        $data['static_profile']['background'] = [];
    }

    $demo =& $data['static_profile']['demographics'];
    $app =& $data['static_profile']['appearance'];
    $bg =& $data['static_profile']['background'];

    if (!isset($data['static_profile']['rapport']) || !is_array($data['static_profile']['rapport'])) {
        $data['static_profile']['rapport'] = [];
    }
    $rp =& $data['static_profile']['rapport'];

    $slug = trim((string)($r['slug'] ?? ''));
    $name = trim((string)($r['name'] ?? ''));
    $seed = catn8_booking_seed($slug !== '' ? $slug : (string)$entityId);

    $changed = false;

    $likes = catn8_booking_clean_list($rp['likes'] ?? []);
    $dislikes = catn8_booking_clean_list($rp['dislikes'] ?? []);
    $quirks = catn8_booking_clean_list($rp['quirks'] ?? []);
    $facts = catn8_booking_clean_list($rp['fun_facts'] ?? []);
    $favorites = (isset($rp['favorites']) && is_array($rp['favorites'])) ? $rp['favorites'] : [];

    if (!count($likes)) {
        $likePool = [
            'mystery novels', 'strong coffee', 'quiet mornings', 'tidy rooms', 'old radios', 'jazz records',
            'birdwatching', 'baking something sweet', 'walking in cool air', 'polishing old coins',
            'playing cards', 'crossword puzzles', 'fresh laundry smell', 'peppermint candy',
            'watching the rain from inside', 'a good routine',
        ];
        $likes = [
            catn8_booking_pick($likePool, $seed, 301),
            catn8_booking_pick($likePool, $seed, 302),
            catn8_booking_pick($likePool, $seed, 303),
        ];
        $likes = array_values(array_unique(array_filter(array_map('trim', $likes))));
        $rp['likes'] = $likes;
        $changed = true;
    }

    if (!count($dislikes)) {
        $dislikePool = [
            'being rushed', 'loud chewing', 'bright overhead lights', 'people interrupting', 'sticky hands',
            'small talk', 'crowded rooms', 'messy desks', 'waiting in long lines', 'surprises',
            'cold soup', 'squeaky shoes', 'people borrowing things', 'unclear instructions',
        ];
        $dislikes = [
            catn8_booking_pick($dislikePool, $seed, 311),
            catn8_booking_pick($dislikePool, $seed, 312),
        ];
        $dislikes = array_values(array_unique(array_filter(array_map('trim', $dislikes))));
        $rp['dislikes'] = $dislikes;
        $changed = true;
    }

    if (!count($quirks)) {
        $quirkPool = [
            'taps a finger when thinking',
            'keeps receipts in a neat stack',
            'double-checks locks twice',
            'arranges items by color without noticing',
            'hums a tune under their breath',
            'cannot stand a crooked picture frame',
            'always carries a small notebook',
            'counts steps on stairs',
            'cleans glasses even when they are already clean',
            'speaks very softly when nervous',
        ];
        $quirks = [
            catn8_booking_pick($quirkPool, $seed, 321),
        ];
        $quirks = array_values(array_unique(array_filter(array_map('trim', $quirks))));
        $rp['quirks'] = $quirks;
        $changed = true;
    }

    if (!count($facts)) {
        $factsPool = [
            'I can tie a perfect bow on the first try.',
            'I once won a pie contest and never told anyone.',
            'I know exactly where every creaky board is in my house.',
            'I keep a spare key hidden in the least obvious place.',
            'I remember faces better than names.',
            'I can tell when someone has been in a room just by the smell.',
            'I have a habit of taking notes even when I do not mean to.',
        ];
        $facts = [
            catn8_booking_pick($factsPool, $seed, 331),
        ];
        $facts = array_values(array_unique(array_filter(array_map('trim', $facts))));
        $rp['fun_facts'] = $facts;
        $changed = true;
    }

    if (!isset($rp['favorites']) || !is_array($rp['favorites'])) {
        $rp['favorites'] = [];
        $favorites = $rp['favorites'];
        $changed = true;
    }

    if (!isset($favorites['color']) || trim((string)$favorites['color']) === '') {
        $colors = ['Blue', 'Green', 'Purple', 'Red', 'Black', 'Yellow', 'Orange', 'Pink'];
        $rp['favorites']['color'] = catn8_booking_pick($colors, $seed, 341);
        $changed = true;
    }
    if (!isset($favorites['snack']) || trim((string)$favorites['snack']) === '') {
        $snacks = ['pretzels', 'apple slices', 'chocolate chip cookies', 'popcorn', 'cheese crackers', 'trail mix', 'banana bread'];
        $rp['favorites']['snack'] = catn8_booking_pick($snacks, $seed, 342);
        $changed = true;
    }
    if (!isset($favorites['drink']) || trim((string)$favorites['drink']) === '') {
        $drinks = ['sweet tea', 'lemonade', 'coffee', 'sparkling water', 'hot cocoa', 'iced water with lemon', 'cola'];
        $rp['favorites']['drink'] = catn8_booking_pick($drinks, $seed, 343);
        $changed = true;
    }
    if (!isset($favorites['music']) || trim((string)$favorites['music']) === '') {
        $music = ['jazz records', 'old country songs', 'pop songs', 'classical music', 'rock', 'blues', 'show tunes', 'folk music'];
        $rp['favorites']['music'] = catn8_booking_pick($music, $seed, 344);
        $changed = true;
    }
    if (!isset($favorites['hobby']) || trim((string)$favorites['hobby']) === '') {
        $hobbies = ['gardening', 'fixing old radios', 'baking', 'running', 'painting', 'woodworking', 'birdwatching', 'reading mysteries', 'playing cards'];
        $rp['favorites']['hobby'] = catn8_booking_pick($hobbies, $seed, 345);
        $changed = true;
    }
    if (!isset($favorites['pet']) || trim((string)$favorites['pet']) === '') {
        $pets = ['a cat', 'a dog', 'a fish', 'a turtle', 'no pets right now', 'a grumpy parrot', 'a rabbit'];
        $rp['favorites']['pet'] = catn8_booking_pick($pets, $seed, 346);
        $changed = true;
    }

    if (!$changed) {
        $skipped++;
        continue;
    }

    $json = json_encode($data, JSON_UNESCAPED_SLASHES);
    if (!is_string($json)) {
        $errors[] = ['entity_id' => $entityId, 'error' => 'Failed to encode updated JSON'];
        continue;
    }

    Database::execute('UPDATE mystery_entities SET data_json = ? WHERE id = ?', [$json, $entityId]);
    $updated++;
}

catn8_json_response([
    'success' => count($errors) === 0,
    'updated' => $updated,
    'skipped' => $skipped,
    'errors' => $errors,
]);
