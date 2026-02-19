<?php

/**
 * Finds a duplicate location ID by name, region, and city, excluding a specific ID.
 */
if (!function_exists('catn8_mystery_location_find_duplicate_id')) {
    function catn8_mystery_location_find_duplicate_id(string $name, string $region = '', string $city = '', int $excludeId = 0): int {
        $row = Database::queryOne(
            'SELECT id FROM mystery_locations 
             WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) 
             AND LOWER(TRIM(region)) = LOWER(TRIM(?)) 
             AND LOWER(TRIM(city)) = LOWER(TRIM(?)) 
             AND id <> ? LIMIT 1',
            [$name, $region, $city, $excludeId]
        );
        return (int)($row['id'] ?? 0);
    }
}

/**
 * Builds an AI image prompt for a location.
 */
if (!function_exists('catn8_mystery_location_build_image_prompt')) {
    function catn8_mystery_location_build_image_prompt(array $location): string {
    $name = trim((string)($location['name'] ?? ''));
    $desc = trim((string)($location['description'] ?? ''));
    $city = trim((string)($location['city'] ?? ''));
    $region = trim((string)($location['region'] ?? ''));
    
    $prompt = 'A realistic wide-angle photo of ' . $name;
    if ($city || $region) {
        $prompt .= ' in ' . trim($city . ' ' . $region);
    }
    $prompt .= ' for a detective mystery game.';
    
    if ($desc !== '') {
        $prompt .= ' Description: ' . $desc;
    }
    $prompt .= ' Cinematic lighting, architectural detail, high resolution, no people.';
    return $prompt;
    }
}
