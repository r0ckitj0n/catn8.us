<?php

/**
 * Finds a duplicate motive ID by name, excluding a specific ID.
 */
function catn8_mystery_motive_find_duplicate_id(string $name, int $excludeId = 0): int {
    $row = Database::queryOne(
        'SELECT id FROM mystery_motives WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id <> ? LIMIT 1',
        [$name, $excludeId]
    );
    return (int)($row['id'] ?? 0);
}

/**
 * Builds an AI image prompt for a motive.
 */
function catn8_mystery_motive_build_image_prompt(array $motive): string {
    $name = trim((string)($motive['name'] ?? ''));
    $desc = trim((string)($motive['description'] ?? ''));
    $prompt = 'A conceptual noir photo representing the motive: ' . $name . '.';
    if ($desc !== '') {
        $prompt .= ' Context: ' . $desc;
    }
    $prompt .= ' Moody lighting, symbolic imagery, high quality, no text.';
    return $prompt;
}
