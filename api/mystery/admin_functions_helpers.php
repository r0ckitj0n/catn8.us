<?php
declare(strict_types=1);

function catn8_mystery_extract_json_from_text(string $text): string {
    $t = trim($text);
    if ($t === '') return '';
    if ($t[0] === '{' || $t[0] === '[') return $t;
    $startObj = strpos($t, '{');
    $startArr = strpos($t, '[');
    $start = null;
    if ($startObj !== false && $startArr !== false) $start = min($startObj, $startArr);
    elseif ($startObj !== false) $start = $startObj;
    elseif ($startArr !== false) $start = $startArr;
    if ($start === null) return '';
    $candidate = substr($t, $start);
    $endObj = strrpos($candidate, '}');
    $endArr = strrpos($candidate, ']');
    $end = null;
    if ($endObj !== false && $endArr !== false) $end = max($endObj, $endArr);
    elseif ($endObj !== false) $end = $endObj;
    elseif ($endArr !== false) $end = $endArr;
    if ($end === null) return '';
    return substr($candidate, 0, $end + 1);
}

function catn8_mystery_repair_jsonish_text(string $text): string {
    $t = trim($text);
    if ($t === '') return '';
    $t = preg_replace('/^```(?:json)?\s*/i', '', $t);
    $t = preg_replace('/\s*```$/', '', $t);
    return trim($t);
}

/**
 * Slug logic moved to shared_functions.php
 */

function catn8_mystery_normalize_enum(string $v, array $allowed): string {
    $v = strtolower(trim($v));
    foreach ($allowed as $a) {
        if (strtolower(trim((string)$a)) === $v) return (string)$a;
    }
    return (string)($allowed[0] ?? '');
}

function catn8_mystery_json_get(array $obj, array $path) {
    $curr = $obj;
    foreach ($path as $key) {
        if (!is_array($curr) || !isset($curr[$key])) return null;
        $curr = $curr[$key];
    }
    return $curr;
}

/**
 * Unique slug logic moved to shared_functions.php
 */

