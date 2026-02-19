<?php

/**
 * Finds a duplicate weapon ID by name, excluding a specific ID.
 */
function catn8_mystery_weapon_find_duplicate_id(string $name, int $excludeId = 0): int {
    $row = Database::queryOne(
        'SELECT id FROM mystery_weapons WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id <> ? LIMIT 1',
        [$name, $excludeId]
    );
    return (int)($row['id'] ?? 0);
}

/**
 * Builds an AI image prompt for a weapon.
 */
function catn8_mystery_weapon_build_image_prompt(array $weapon): string {
    $name = trim((string)($weapon['name'] ?? ''));
    $desc = trim((string)($weapon['description'] ?? ''));
    $prompt = 'A detailed professional photo of a ' . $name . ' detective mystery weapon.';
    if ($desc !== '') {
        $prompt .= ' Description: ' . $desc;
    }
    $prompt .= ' Neutral background, cinematic lighting, high quality.';
    return $prompt;
}
