<?php

declare(strict_types=1);

/**
 * Common settings functions for AI testing.
 */

function catn8_settings_ai_get_config(): array {
    $defaults = [
        'provider' => 'openai',
        'model' => 'gpt-4o-mini',
        'base_url' => '',
        'location' => '',
        'temperature' => 0.2,
        'provider_config' => [],
    ];
    $rawCfg = secret_get(catn8_secret_key('ai.config'));
    $cfg = [];
    if (is_string($rawCfg) && trim($rawCfg) !== '') {
        $decoded = json_decode($rawCfg, true);
        if (is_array($decoded)) {
            $cfg = $decoded;
        }
    }
    return array_merge($defaults, $cfg);
}

function catn8_settings_ai_image_get_config(): array {
    $defaults = [
        'provider' => 'openai',
        'model' => 'gpt-image-1',
        'base_url' => '',
        'provider_config' => [],
        'params' => [
            'size' => '1024x1024',
            'quality' => 'auto',
            'style' => 'natural',
        ],
    ];
    $rawCfg = secret_get(catn8_secret_key('ai_image.config'));
    $cfg = [];
    if (is_string($rawCfg) && trim($rawCfg) !== '') {
        $decoded = json_decode($rawCfg, true);
        if (is_array($decoded)) {
            $cfg = $decoded;
        }
    }
    return array_merge($defaults, $cfg);
}

function catn8_settings_ai_secret_key(string $p, string $n): string {
    $pp = strtolower(trim($p));
    $nn = strtolower(trim($n));
    if ($pp === '' || $nn === '') {
        throw new RuntimeException('Invalid secret key request');
    }
    return catn8_secret_key('ai.secret.' . $pp . '.' . $nn);
}

function catn8_settings_ai_image_secret_key(string $p, string $n): string {
    $pp = strtolower(trim($p));
    $nn = strtolower(trim($n));
    if ($pp === '' || $nn === '') {
        throw new RuntimeException('Invalid secret key request');
    }
    return catn8_secret_key('ai_image.secret.' . $pp . '.' . $nn);
}
