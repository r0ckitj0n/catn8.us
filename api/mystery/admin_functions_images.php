<?php
declare(strict_types=1);

/**
 * Loads image data for a global weapon.
 */
if (!function_exists('catn8_mystery_weapon_image_load')) {
    function catn8_mystery_weapon_image_load(int $weaponId): array {
        $row = Database::queryOne(
            'SELECT title, url, alt_text, prompt_text, negative_prompt_text, provider, model FROM mystery_weapon_images WHERE weapon_id = ? LIMIT 1',
            [$weaponId]
        );
        if (!$row) {
            return [
                'title' => '',
                'url' => '',
                'alt_text' => '',
                'prompt_text' => '',
                'negative_prompt_text' => '',
                'provider' => '',
                'model' => '',
            ];
        }
        return [
            'title' => (string)($row['title'] ?? ''),
            'url' => (string)($row['url'] ?? ''),
            'alt_text' => (string)($row['alt_text'] ?? ''),
            'prompt_text' => (string)($row['prompt_text'] ?? ''),
            'negative_prompt_text' => (string)($row['negative_prompt_text'] ?? ''),
            'provider' => (string)($row['provider'] ?? ''),
            'model' => (string)($row['model'] ?? ''),
        ];
    }
}

/**
 * Loads image data for a global motive.
 */
if (!function_exists('catn8_mystery_motive_image_load')) {
    function catn8_mystery_motive_image_load(int $motiveId): array {
        $id = (int)$motiveId;
        if ($id <= 0) return ['title' => '', 'url' => '', 'alt_text' => '', 'prompt_text' => '', 'negative_prompt_text' => '', 'provider' => '', 'model' => ''];
        $row = Database::queryOne('SELECT title, url, alt_text, prompt_text, negative_prompt_text, provider, model FROM mystery_motive_images WHERE motive_id = ? LIMIT 1', [$id]);
        if (!$row) return ['title' => '', 'url' => '', 'alt_text' => '', 'prompt_text' => '', 'negative_prompt_text' => '', 'provider' => '', 'model' => ''];
        return [
            'title' => (string)($row['title'] ?? ''),
            'url' => (string)($row['url'] ?? ''),
            'alt_text' => (string)($row['alt_text'] ?? ''),
            'prompt_text' => (string)($row['prompt_text'] ?? ''),
            'negative_prompt_text' => (string)($row['negative_prompt_text'] ?? ''),
            'provider' => (string)($row['provider'] ?? ''),
            'model' => (string)($row['model'] ?? ''),
        ];
    }
}

/**
 * Loads image data for a global location.
 */
if (!function_exists('catn8_mystery_location_image_load')) {
    function catn8_mystery_location_image_load(int $locationId): array {
        $id = (int)$locationId;
        if ($id <= 0) return ['title' => '', 'url' => '', 'alt_text' => '', 'prompt_text' => '', 'negative_prompt_text' => '', 'provider' => '', 'model' => ''];
        $row = Database::queryOne('SELECT title, url, alt_text, prompt_text, negative_prompt_text, provider, model FROM mystery_location_images WHERE location_id = ? LIMIT 1', [$id]);
        if (!$row) return ['title' => '', 'url' => '', 'alt_text' => '', 'prompt_text' => '', 'negative_prompt_text' => '', 'provider' => '', 'model' => ''];
        return [
            'title' => (string)($row['title'] ?? ''),
            'url' => (string)($row['url'] ?? ''),
            'alt_text' => (string)($row['alt_text'] ?? ''),
            'prompt_text' => (string)($row['prompt_text'] ?? ''),
            'negative_prompt_text' => (string)($row['negative_prompt_text'] ?? ''),
            'provider' => (string)($row['provider'] ?? ''),
            'model' => (string)($row['model'] ?? ''),
        ];
    }
}

function catn8_mystery_location_build_image_prompt(array $fields): string {
    $name = trim((string)($fields['name'] ?? ''));
    $city = trim((string)($fields['city'] ?? ''));
    $region = trim((string)($fields['region'] ?? ''));
    $country = trim((string)($fields['country'] ?? ''));
    $desc = trim((string)($fields['description'] ?? ''));
    $place = $name !== '' ? $name : 'a famous place';
    $where = trim(implode(', ', array_values(array_filter([$city, $region, $country], static fn($x) => trim((string)$x) !== ''))));
    if ($where !== '') {
        $place .= ' in ' . $where;
    } elseif ($region !== '') {
        $place .= ' in ' . $region;
    }
    $style = 'Cinematic noir photography, wide angle, moody lighting, dramatic shadows, high contrast, realistic, no text, no watermark.';
    $details = $desc !== '' ? ('\n\nDetails: ' . $desc) : '';
    return trim($style . "\n\nSubject: " . $place . $details);
}

function catn8_mystery_list_agent_images(int $agentId): array {
    $aid = (int)$agentId;
    if ($aid <= 0) return ['character_url' => '', 'mugshot_url' => '', 'ir_urls' => []];
    
    $dir = dirname(__DIR__, 2) . '/images/mystery';
    $baseUrl = '/images/mystery/';
    
    // 1. Try to find custom images in mystery_master_character_images table
    $rows = Database::queryAll(
        'SELECT url, kind, emotion FROM mystery_master_character_images WHERE character_id = (SELECT id FROM mystery_master_characters WHERE agent_id = ? LIMIT 1)',
        [$aid]
    );
    
    $characterUrl = '';
    $mugshotUrl = '';
    $irUrls = [];
    
    foreach ($rows as $r) {
        $kind = trim((string)$r['kind']);
        $url = trim((string)$r['url']);
        if ($kind === 'character') $characterUrl = $url;
        elseif ($kind === 'mugshot') $mugshotUrl = $url;
        elseif ($kind === 'ir') $irUrls[] = $url;
    }
    
    // 2. Fallback to file system candidates if DB is empty for this agent
    if ($mugshotUrl === '') {
        $mugshotCandidates = ['agent' . $aid . '.png', 'agent' . $aid . '.jpg', 'agent' . $aid . '.jpeg', 'agent' . $aid . '.webp'];
        foreach ($mugshotCandidates as $fn) {
            if (is_file($dir . '/' . $fn)) {
                $mugshotUrl = $baseUrl . $fn;
                break;
            }
        }
    }
    
    if (empty($irUrls)) {
        // Prioritize _ir_angry as requested, but also match other emotions or general _ir
        $globs = [
            $dir . '/agent' . $aid . '_ir_angry.png',
            $dir . '/agent' . $aid . '_ir_angry.jpg',
            $dir . '/agent' . $aid . '_ir*.png',
            $dir . '/agent' . $aid . '_ir*.jpg',
            $dir . '/agent' . $aid . '_ir*.jpeg',
            $dir . '/agent' . $aid . '_ir*.webp'
        ];
        $matches = [];
        foreach ($globs as $g) {
            $files = glob($g);
            if (is_array($files)) $matches = array_merge($matches, $files);
        }
        $matches = array_values(array_unique($matches));
        // Sort to ensure consistency, _angry will likely come after _ir but before others
        sort($matches);
        foreach ($matches as $p) {
            $bn = basename($p);
            if ($bn === '') continue;
            $irUrls[] = $baseUrl . $bn;
        }
    }
    
    // 3. Last resort fallbacks for character if still empty
    if ($characterUrl === '') {
        $charCandidates = ['agent' . $aid . '_character.png', 'agent' . $aid . '_character.jpg'];
        foreach ($charCandidates as $fn) {
            if (is_file($dir . '/' . $fn)) {
                $characterUrl = $baseUrl . $fn;
                break;
            }
        }
    }
    
    return ['character_url' => $characterUrl, 'mugshot_url' => $mugshotUrl, 'ir_urls' => $irUrls];
}

function catn8_mystery_ai_image_config_load(): array {
    $defaults = ['provider' => 'openai', 'model' => 'gpt-image-1', 'base_url' => '', 'provider_config' => [], 'params' => ['size' => '1024x1024', 'quality' => 'auto', 'style' => 'natural']];
    $raw = secret_get(catn8_secret_key('ai_image.config'));
    if (!is_string($raw) || trim($raw) === '') return $defaults;
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) return $defaults;
    return ['provider' => (string)($decoded['provider'] ?? $defaults['provider']), 'model' => (string)($decoded['model'] ?? $defaults['model']), 'base_url' => (string)($decoded['base_url'] ?? $defaults['base_url']), 'provider_config' => $decoded['provider_config'] ?? $defaults['provider_config'], 'params' => $decoded['params'] ?? $defaults['params']];
}

function catn8_mystery_openai_image_download_b64(string $url): string {
    $u = trim($url);
    if ($u === '') throw new RuntimeException('Missing image URL');
    $parts = parse_url($u);
    if (!is_array($parts)) throw new RuntimeException('Invalid image URL');
    $scheme = strtolower((string)($parts['scheme'] ?? ''));
    if ($scheme !== 'https' && $scheme !== 'http') throw new RuntimeException('Invalid image URL scheme');
    $bin = @file_get_contents($u);
    if (!is_string($bin) || $bin === '') throw new RuntimeException('Failed to download generated image');
    $b64 = base64_encode($bin);
    if (!is_string($b64)) throw new RuntimeException('Failed to encode generated image');
    return trim($b64);
}
