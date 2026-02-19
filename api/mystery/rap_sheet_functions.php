<?php
declare(strict_types=1);

function catn8_rap_sheet_get_flavor(string $seed): array {
    $pick = static function (string $key, array $options) use ($seed): string {
        $n = count($options);
        if ($n <= 0) return '';
        $h = sha1($seed . '|' . $key);
        $idx = hexdec(substr($h, 0, 8)) % $n;
        return (string)($options[$idx] ?? '');
    };

    $signatureAdj = ['brass', 'copper', 'silver', 'weathered', 'polished', 'tiny', 'bright', 'faded', 'striped', 'checkered', 'plain', 'floral', 'ink-stained', 'threadbare', 'neatly-folded', 'scuffed', 'minty', 'cinnamon', 'smoky', 'soapy', 'pine', 'lemon', 'vanilla', 'coffee', 'lucky', 'odd', 'stubborn', 'quiet', 'careful', 'bold', 'jumpy', 'patient', 'pocket', 'worn', 'smooth', 'rough', 'warm', 'cool', 'heavy', 'light'];
    $signatureNoun = ['keychain', 'ring', 'coin', 'button', 'pen', 'notebook', 'handkerchief', 'comb', 'matchbook', 'ticket stub', 'little photo', 'bracelet', 'watch', 'lighter', 'thimble', 'bookmark', 'stone', 'charm', 'pin', 'patch', 'paperclip', 'rubber band', 'string bracelet', 'postcard', 'pocketknife', 'seashell', 'bead', 'medallion', 'dice', 'origami crane', 'tiny flashlight', 'map'];

    return [
        'snack' => $pick('snack', ['pretzels', 'apple slices', 'chocolate chip cookies', 'popcorn', 'cheese crackers', 'trail mix', 'banana bread', 'peanut butter toast', 'strawberries', 'chips and salsa']),
        'drink' => $pick('drink', ['sweet tea', 'lemonade', 'coffee', 'sparkling water', 'hot cocoa', 'iced water with lemon', 'cola', 'ginger ale']),
        'color' => $pick('color', ['blue', 'green', 'purple', 'red', 'black', 'yellow', 'orange', 'pink']),
        'hobby' => $pick('hobby', ['gardening', 'fixing old radios', 'baking', 'running', 'painting', 'woodworking', 'birdwatching', 'reading mysteries', 'playing cards', 'collecting antiques', 'knitting', 'photography']),
        'music' => $pick('music', ['jazz records', 'old country songs', 'pop songs', 'classical music', 'rock', 'blues', 'show tunes', 'folk music']),
        'pet' => $pick('pet', ['a cat', 'a dog', 'a fish', 'a turtle', 'no pets right now', 'a very grumpy parrot', 'a rabbit']),
        'morning' => $pick('morning', ['a quick shower', 'a quiet cup of coffee', 'checking my phone', 'making breakfast', 'feeding the pet', 'looking out the window for a minute']),
        'scent' => $pick('scent', ['fresh laundry', 'cinnamon', 'peppermint', 'rain', 'coffee', 'woodsmoke', 'lavender']),
        'school' => $pick('school', ['I liked science the best.', 'I was always better at reading than math.', 'Math was my strong subject.', 'I loved art class.', 'History was my favorite.', 'I liked gym because it cleared my head.']),
        'fear' => $pick('fear', ['tight spaces', 'big storms', 'getting lost', 'heights', 'being accused of something I did not do', 'spiders', 'total silence']),
        'signature' => (function() use ($pick, $signatureAdj, $signatureNoun) {
            $adj = $pick('signature_adj', $signatureAdj);
            $noun = $pick('signature_noun|' . $adj, $signatureNoun);
            return trim($adj . ' ' . $noun);
        })()
    ];
}

function catn8_rap_sheet_get_bank(callable $kidNamed): array {
    return [
        ['id' => 'full_name', 'question' => 'What is your full name?', 'answer_fn' => fn($c) => $kidNamed((string)($c['name'] ?? ''))],
        ['id' => 'age', 'question' => 'How old are you?', 'answer_fn' => fn($c) => $kidNamed(trim((string)($c['age'] ?? '')) ?: 'I would rather not say.')],
        ['id' => 'live', 'question' => 'Where do you live?', 'answer_fn' => fn($c) => $kidNamed(trim((string)($c['address'] ?? '')) ?: 'Around here.')],
        ['id' => 'nicknames', 'question' => 'Do you have any nicknames?', 'answer_fn' => fn($c) => $kidNamed(trim((string)($c['aliases'] ?? '')) ?: 'Not really.')],
        ['id' => 'eyes', 'question' => 'What color are your eyes?', 'answer_fn' => fn($c) => $kidNamed(trim((string)($c['eye_color'] ?? '')) ?: 'I do not know how to describe them.')],
        ['id' => 'height', 'question' => 'How tall are you?', 'answer_fn' => fn($c) => $kidNamed(trim((string)($c['height'] ?? '')) ?: 'Tall enough.')],
        ['id' => 'weight', 'question' => 'How much do you weigh?', 'answer_fn' => fn($c) => $kidNamed(trim((string)($c['weight'] ?? '')) ?: 'I do not share that.')],
        ['id' => 'work', 'question' => 'What do you do for work?', 'answer_fn' => fn($c) => $kidNamed(trim((string)($c['employment'] ?? '')) ?: 'I have done a few different jobs.')],
        ['id' => 'education', 'question' => 'Where did you go to school?', 'answer_fn' => fn($c) => $kidNamed(trim((string)($c['education'] ?? '')) ?: (string)($c['flavor']['school'] ?? 'I learned by doing.'))],
        ['id' => 'distinguishing_marks', 'question' => 'Do you have any scars or tattoos?', 'answer_fn' => fn($c) => $kidNamed(trim((string)($c['marks'] ?? '')) ?: 'Nothing special.')],
        ['id' => 'rapport_favorite_color', 'question' => 'Favorite color?', 'answer_fn' => fn($c) => $kidNamed('Probably ' . ($c['flavor']['color'] ?? 'blue'))],
        ['id' => 'rapport_favorite_snack', 'question' => 'Favorite snack?', 'answer_fn' => fn($c) => $kidNamed('I would go with ' . ($c['flavor']['snack'] ?? 'pretzels'))],
        ['id' => 'rapport_favorite_drink', 'question' => 'Favorite drink?', 'answer_fn' => fn($c) => $kidNamed(($c['flavor']['drink'] ?? 'water') . '. If I am nervous, it helps.')],
        ['id' => 'rapport_hobby', 'question' => 'Free time activities?', 'answer_fn' => fn($c) => $kidNamed(($c['flavor']['hobby'] ?? 'reading') . '. It helps me calm down.')],
        ['id' => 'rapport_music', 'question' => 'Music preference?', 'answer_fn' => fn($c) => $kidNamed('I enjoy listening to ' . ($c['flavor']['music'] ?? 'jazz records') . '.')],
        ['id' => 'rapport_morning', 'question' => 'Morning routine?', 'answer_fn' => fn($c) => $kidNamed('Usually ' . ($c['flavor']['morning'] ?? 'a quiet cup of coffee') . '.')],
        ['id' => 'rapport_fear', 'question' => 'Biggest fear?', 'answer_fn' => fn($c) => $kidNamed('I am not fond of ' . ($c['flavor']['fear'] ?? 'total silence') . '.')],
        ['id' => 'rapport_scent', 'question' => 'Favorite smell?', 'answer_fn' => fn($c) => $kidNamed('The smell of ' . ($c['flavor']['scent'] ?? 'fresh laundry') . '.')],
        ['id' => 'rapport_pet', 'question' => 'Do you have pets?', 'answer_fn' => fn($c) => $kidNamed('I have ' . ($c['flavor']['pet'] ?? 'a cat') . '.')],
        ['id' => 'signature_item', 'question' => 'What is in your pocket?', 'answer_fn' => fn($c) => $kidNamed('Just my ' . ($c['flavor']['signature'] ?? 'lucky coin') . '.')]
    ];
}
