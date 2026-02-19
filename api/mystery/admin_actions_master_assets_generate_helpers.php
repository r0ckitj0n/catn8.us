<?php

/**
 * Builds the initial character profile for generation.
 */
function catn8_mystery_master_gen_build_profile(array $row): array {
    $cur = [
        'dob' => (string)($row['dob'] ?? ''),
        'age' => (int)($row['age'] ?? 0),
        'hometown' => (string)($row['hometown'] ?? ''),
        'address' => (string)($row['address'] ?? ''),
        'aliases' => json_decode((string)($row['aliases_json'] ?? '[]'), true) ?: [],
        'ethnicity' => (string)($row['ethnicity'] ?? ''),
        'zodiac' => (string)($row['zodiac'] ?? ''),
        'mbti' => (string)($row['mbti'] ?? ''),
        'height' => (string)($row['height'] ?? ''),
        'weight' => (string)($row['weight'] ?? ''),
        'eye_color' => (string)($row['eye_color'] ?? ''),
        'hair_color' => (string)($row['hair_color'] ?? ''),
        'distinguishing_marks' => (string)($row['distinguishing_marks'] ?? ''),
        'education' => (string)($row['education'] ?? ''),
        'employment' => json_decode((string)($row['employment_json'] ?? '[]'), true) ?: [],
        'criminal_record' => (string)($row['criminal_record'] ?? ''),
    ];
    if (!is_array($cur['aliases'])) $cur['aliases'] = [];
    if (!is_array($cur['employment'])) $cur['employment'] = [];
    return $cur;
}

/**
 * Builds system and user prompts for master character generation.
 */
function catn8_mystery_master_gen_build_prompts(string $name, string $slug, string $curJson, string $curRapportJson, string $locksJson, bool $fillOnly): array {
    $system = trim(
        'You generate missing profile details for a master character in a detective mystery game.' . "\n" .
        'Return ONLY valid JSON with this exact shape:' . "\n" .
        '{"fields_patch":{...},"rapport_patch":{...},"favorites_patch":{...}}' . "\n" .
        'Do not include any extra keys.' . "\n" .
        'Do not include markdown fences.' . "\n" .
        'Only include fields that are currently blank AND not locked.' . "\n" .
        'For any field you include, do NOT leave it blank. Provide a plausible value.'
    );

    $user = trim(
        'Character name: ' . $name . "\n" .
        'Character slug: ' . $slug . "\n\n" .
        'Current master column fields JSON:' . "\n" . $curJson . "\n\n" .
        'Current rapport/favorites JSON:' . "\n" . $curRapportJson . "\n\n" .
        'Field locks JSON (locked keys must not be included in patch):' . "\n" . $locksJson . "\n\n" .
        'Target fields (generate plausible values):' . "\n" .
        '- dob (YYYY-MM-DD) OR leave blank if unknown\n' .
        '- age (integer)\n' .
        '- hometown (short)\n' .
        '- address (short)\n' .
        '- aliases (array of strings)\n' .
        '- ethnicity (one of: White, Black, Hispanic/Latino, Asian, Native American, Middle Eastern, Multiracial, Other, Unknown)\n' .
        '- zodiac (one of: Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius, Pisces)\n' .
        '- mbti (one of: INTJ, INTP, ENTJ, ENTP, INFJ, INFP, ENFJ, ENFP, ISTJ, ISFJ, ESTJ, ESFJ, ISTP, ISFP, ESTP, ESFP)\n' .
        '- height (e.g. 5\'10\")\n' .
        '- weight (e.g. 165 lb)\n' .
        '- eye_color (e.g. brown)\n' .
        '- hair_color (e.g. black)\n' .
        '- distinguishing_marks (short)\n' .
        '- education (short)\n' .
        '- employment (array of strings)\n' .
        '- criminal_record (short, plausible)\n\n' .
        'If a target field is blank and not locked, you MUST include it in fields_patch with a plausible non-empty value.' . "\n" .
        'Also update rapport_patch with: likes, dislikes, quirks, fun_facts (arrays of strings), and favorites_patch with: {color,snack,drink,music,hobby,pet} (strings). Keep concise. If rapport/favorites exist already, only fill blanks.'
    );

    return ['system' => $system, 'user' => $user];
}

/**
 * Normalizes and validates generated fields patch.
 */
function catn8_mystery_master_gen_normalize_patch(array $fieldsPatch, array $cur, array $fieldLocks): array {
    $isLocked = static fn(string $k) => (int)($fieldLocks[$k] ?? 0) === 1;
    $isEmpty = static function(string $k) use ($cur) {
        if (!isset($cur[$k])) return true;
        if ($k === 'age') return (int)$cur[$k] <= 0;
        if ($k === 'aliases' || $k === 'employment') return !is_array($cur[$k]) || !$cur[$k];
        return trim((string)$cur[$k]) === '';
    };

    $out = [];
    $allowed = ['dob', 'age', 'hometown', 'address', 'aliases', 'ethnicity', 'zodiac', 'mbti', 'height', 'weight', 'eye_color', 'hair_color', 'distinguishing_marks', 'education', 'employment', 'criminal_record'];
    
    foreach ($allowed as $k) {
        if (!isset($fieldsPatch[$k]) || $isLocked($k) || !$isEmpty($k)) continue;
        $val = $fieldsPatch[$k];
        
        if ($k === 'age') {
            $n = (int)$val;
            if ($n > 0) $out[$k] = $n;
        } elseif ($k === 'aliases' || $k === 'employment') {
            $out[$k] = is_array($val) ? array_values(array_filter(array_map('trim', array_map('strval', $val)))) : [];
        } elseif ($k === 'ethnicity') {
            $out[$k] = catn8_mystery_normalize_ethnicity_loose((string)$val);
        } elseif ($k === 'zodiac') {
            $z = (string)$val;
            $allowedZ = catn8_mystery_allowed_zodiacs();
            $norm = '';
            foreach ($allowedZ as $az) { if (strcasecmp($az, $z) === 0) { $norm = $az; break; } }
            if (!$norm) { foreach ($allowedZ as $az) { if (stripos($z, $az) !== false) { $norm = $az; break; } } }
            $out[$k] = $norm;
        } elseif ($k === 'mbti') {
            $out[$k] = catn8_mystery_extract_mbti((string)$val);
        } else {
            $out[$k] = trim((string)$val);
        }
    }

    if (!$isLocked('age') && $isEmpty('age') && !isset($out['age'])) {
        $dob = isset($out['dob']) ? $out['dob'] : ($cur['dob'] ?? '');
        if ($dob && ($dt = date_create($dob))) {
            $age = (int)(new DateTime())->diff($dt)->y;
            if ($age > 0) $out['age'] = $age;
        }
    }

    return $out;
}
