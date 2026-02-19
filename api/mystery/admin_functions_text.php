<?php
declare(strict_types=1);

function catn8_mystery_extract_briefing_text_from_constraints_json(?string $constraintsJson): string {
    if (!$constraintsJson) return '';
    $decoded = json_decode($constraintsJson, true);
    if (!is_array($decoded)) return '';
    return (string)($decoded['briefing'] ?? $decoded['description'] ?? $decoded['summary'] ?? '');
}

function catn8_mystery_backstory_excerpt(?string $text, int $maxLen = 240): string {
    $t = trim((string)$text);
    if (strlen($t) <= $maxLen) return $t;
    return substr($t, 0, $maxLen) . '...';
}

function catn8_mystery_allowed_zodiacs(): array {
    return ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
}

function catn8_mystery_allowed_mbtis(): array {
    return ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];
}

function catn8_mystery_allowed_ethnicities(): array {
    return ['White', 'Black or African American', 'American Indian or Alaska Native', 'Asian', 'Native Hawaiian or Other Pacific Islander', 'Hispanic or Latino'];
}

function catn8_mystery_extract_mbti(string $v): string {
    $v = strtoupper(trim($v));
    $mbtis = catn8_mystery_allowed_mbtis();
    foreach ($mbtis as $m) {
        if (strpos($v, $m) !== false) return $m;
    }
    return '';
}

function catn8_mystery_normalize_ethnicity_loose(string $v): string {
    $v = strtolower(trim($v));
    if ($v === '') return '';
    $allowed = catn8_mystery_allowed_ethnicities();
    foreach ($allowed as $a) {
        if (strpos($v, strtolower($a)) !== false) return $a;
    }
    return ucwords($v);
}
