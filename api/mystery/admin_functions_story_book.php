<?php
declare(strict_types=1);

function catn8_story_book_theme_catalog(): array {
    return [
        'classic_noir' => 'Classic Noir',
        'sci_fi' => 'Science Fiction',
        'fantasy' => 'Fantasy',
        'historical' => 'Historical',
        'modern_thriller' => 'Modern Thriller',
        'cozy_mystery' => 'Cozy Mystery'
    ];
}

function catn8_story_book_theme_key_set(): array {
    return array_keys(catn8_story_book_theme_catalog());
}

function catn8_story_book_classify_theme(string $title, string $sourceText, array $meta): string {
    $t = strtolower($title . ' ' . $sourceText);
    if (strpos($t, 'space') !== false || strpos($t, 'future') !== false) return 'sci_fi';
    if (strpos($t, 'magic') !== false || strpos($t, 'dragon') !== false) return 'fantasy';
    if (strpos($t, '1920') !== false || strpos($t, 'detective') !== false) return 'classic_noir';
    return 'modern_thriller';
}
