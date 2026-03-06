<?php

declare(strict_types=1);

function catn8_icon_button_emoji_catalog(): array
{
    return [
        ['id' => 'heavy-plus', 'emoji' => '➕', 'codepoint' => '2795', 'asset_path' => '/emojis/twemoji/2795.png', 'label' => 'Heavy Plus'],
        ['id' => 'card-index-dividers', 'emoji' => '🗂', 'codepoint' => '1f5c2', 'asset_path' => '/emojis/twemoji/1f5c2.png', 'label' => 'Card Index Dividers'],
        ['id' => 'card-file-box', 'emoji' => '🗃', 'codepoint' => '1f5c3', 'asset_path' => '/emojis/twemoji/1f5c3.png', 'label' => 'Card File Box'],
        ['id' => 'file-cabinet', 'emoji' => '🗄', 'codepoint' => '1f5c4', 'asset_path' => '/emojis/twemoji/1f5c4.png', 'label' => 'File Cabinet'],
        ['id' => 'wastebasket', 'emoji' => '🗑', 'codepoint' => '1f5d1', 'asset_path' => '/emojis/twemoji/1f5d1.png', 'label' => 'Wastebasket'],
        ['id' => 'printer', 'emoji' => '🖨', 'codepoint' => '1f5a8', 'asset_path' => '/emojis/twemoji/1f5a8.png', 'label' => 'Printer'],
        ['id' => 'cross-mark', 'emoji' => '❌', 'codepoint' => '274c', 'asset_path' => '/emojis/twemoji/274c.png', 'label' => 'Cross Mark'],
        ['id' => 'question-mark', 'emoji' => '❓', 'codepoint' => '2753', 'asset_path' => '/emojis/twemoji/2753.png', 'label' => 'Question Mark'],
        ['id' => 'pencil', 'emoji' => '✏️', 'codepoint' => '270f', 'asset_path' => '/emojis/twemoji/270f.png', 'label' => 'Pencil'],
        ['id' => 'gear', 'emoji' => '⚙️', 'codepoint' => '2699', 'asset_path' => '/emojis/twemoji/2699.png', 'label' => 'Gear'],
        ['id' => 'information', 'emoji' => 'ℹ️', 'codepoint' => '2139', 'asset_path' => '/emojis/twemoji/2139.png', 'label' => 'Information'],
        ['id' => 'house', 'emoji' => '🏠', 'codepoint' => '1f3e0', 'asset_path' => '/emojis/twemoji/1f3e0.png', 'label' => 'House'],
        ['id' => 'bust', 'emoji' => '👤', 'codepoint' => '1f464', 'asset_path' => '/emojis/twemoji/1f464.png', 'label' => 'Bust In Silhouette'],
        ['id' => 'paperclip', 'emoji' => '📎', 'codepoint' => '1f4ce', 'asset_path' => '/emojis/twemoji/1f4ce.png', 'label' => 'Paperclip'],
        ['id' => 'outbox', 'emoji' => '📤', 'codepoint' => '1f4e4', 'asset_path' => '/emojis/twemoji/1f4e4.png', 'label' => 'Outbox Tray'],
        ['id' => 'inbox', 'emoji' => '📥', 'codepoint' => '1f4e5', 'asset_path' => '/emojis/twemoji/1f4e5.png', 'label' => 'Inbox Tray'],
        ['id' => 'email', 'emoji' => '📧', 'codepoint' => '1f4e7', 'asset_path' => '/emojis/twemoji/1f4e7.png', 'label' => 'Email'],
        ['id' => 'floppy-disk', 'emoji' => '💾', 'codepoint' => '1f4be', 'asset_path' => '/emojis/twemoji/1f4be.png', 'label' => 'Floppy Disk'],
        ['id' => 'clipboard', 'emoji' => '📋', 'codepoint' => '1f4cb', 'asset_path' => '/emojis/twemoji/1f4cb.png', 'label' => 'Clipboard'],
        ['id' => 'magnifier-left', 'emoji' => '🔍', 'codepoint' => '1f50d', 'asset_path' => '/emojis/twemoji/1f50d.png', 'label' => 'Magnifying Glass Left'],
        ['id' => 'link', 'emoji' => '🔗', 'codepoint' => '1f517', 'asset_path' => '/emojis/twemoji/1f517.png', 'label' => 'Link'],
        ['id' => 'repeat', 'emoji' => '🔄', 'codepoint' => '1f504', 'asset_path' => '/emojis/twemoji/1f504.png', 'label' => 'Repeat'],
        ['id' => 'broom', 'emoji' => '🧹', 'codepoint' => '1f9f9', 'asset_path' => '/emojis/twemoji/1f9f9.png', 'label' => 'Broom'],
        ['id' => 'eye', 'emoji' => '👁', 'codepoint' => '1f441', 'asset_path' => '/emojis/twemoji/1f441.png', 'label' => 'Eye'],
    ];
}

function catn8_default_icon_button_settings(): array
{
    $catalog = [];
    foreach (catn8_icon_button_emoji_catalog() as $item) {
        $catalog[(string)$item['id']] = $item;
    }

    $make = static function (string $key, string $label, array $keywords, string $assetId) use ($catalog): array {
        $asset = $catalog[$assetId] ?? null;
        if (!is_array($asset)) {
            throw new RuntimeException('Unknown icon asset id: ' . $assetId);
        }
        return [
            'key' => $key,
            'label' => $label,
            'keywords' => array_values(array_map(static fn($keyword): string => trim((string)$keyword), $keywords)),
            'emoji' => (string)$asset['emoji'],
            'codepoint' => (string)$asset['codepoint'],
            'asset_path' => (string)$asset['asset_path'],
            'source_name' => 'Twemoji',
        ];
    };

    return [
        $make('close', 'Close', ['close', 'dismiss', 'cancel', 'exit'], 'cross-mark'),
        $make('save', 'Save', ['save', 'commit', 'apply'], 'floppy-disk'),
        $make('edit', 'Edit', ['edit', 'rename', 'modify'], 'pencil'),
        $make('delete', 'Delete', ['delete', 'remove', 'trash'], 'wastebasket'),
        $make('download', 'Download', ['download', 'export'], 'inbox'),
        $make('upload', 'Upload', ['upload', 'import', 'attach'], 'paperclip'),
        $make('search', 'Search', ['search', 'find', 'lookup'], 'magnifier-left'),
        $make('settings', 'Settings', ['settings', 'preferences', 'config'], 'gear'),
        $make('refresh', 'Refresh', ['refresh', 'reload', 'sync'], 'repeat'),
        $make('print', 'Print', ['print', 'hardcopy'], 'printer'),
        $make('copy', 'Copy', ['copy', 'duplicate'], 'clipboard'),
        $make('add', 'Add', ['add', 'create', 'new'], 'heavy-plus'),
        $make('filter', 'Filter', ['filter', 'narrow'], 'broom'),
        $make('share', 'Share', ['share', 'send'], 'outbox'),
        $make('link', 'Link', ['link', 'url'], 'link'),
        $make('view', 'View', ['view', 'preview', 'show'], 'eye'),
        $make('home', 'Home', ['home', 'dashboard'], 'house'),
        $make('archive', 'Archive', ['archive', 'store'], 'file-cabinet'),
        $make('email', 'Email', ['email', 'mail'], 'email'),
        $make('user', 'User', ['user', 'account', 'profile'], 'bust'),
        $make('info', 'Info', ['info', 'help text'], 'information'),
        $make('help', 'Help', ['help', 'support'], 'question-mark'),
    ];
}

function catn8_normalize_icon_button_settings($raw): array
{
    $defaults = catn8_default_icon_button_settings();
    $defaultByKey = [];
    foreach ($defaults as $item) {
        $defaultByKey[(string)$item['key']] = $item;
    }

    $catalog = [];
    foreach (catn8_icon_button_emoji_catalog() as $item) {
        $catalog[(string)$item['codepoint']] = $item;
    }

    $parsed = is_array($raw) ? $raw : [];
    $parsedByKey = [];
    foreach ($parsed as $item) {
        if (!is_array($item)) {
            continue;
        }
        $key = trim((string)($item['key'] ?? ''));
        if ($key === '' || !isset($defaultByKey[$key])) {
            continue;
        }
        $parsedByKey[$key] = $item;
    }

    $normalized = [];
    foreach ($defaultByKey as $key => $default) {
        $item = $parsedByKey[$key] ?? [];
        $codepoint = trim((string)($item['codepoint'] ?? $default['codepoint']));
        $asset = $catalog[$codepoint] ?? null;
        if (!is_array($asset)) {
            $asset = $catalog[(string)$default['codepoint']] ?? null;
        }
        if (!is_array($asset)) {
            throw new RuntimeException('Default icon asset is missing for key: ' . $key);
        }

        $keywords = [];
        $rawKeywords = $item['keywords'] ?? $default['keywords'];
        if (is_array($rawKeywords)) {
            foreach ($rawKeywords as $keyword) {
                $normalizedKeyword = trim((string)$keyword);
                if ($normalizedKeyword !== '') {
                    $keywords[] = $normalizedKeyword;
                }
            }
        }
        if (!$keywords) {
            $keywords = $default['keywords'];
        }

        $label = trim((string)($item['label'] ?? $default['label']));
        if ($label === '') {
            $label = (string)$default['label'];
        }

        $normalized[] = [
            'key' => $key,
            'label' => $label,
            'keywords' => $keywords,
            'emoji' => (string)$asset['emoji'],
            'codepoint' => (string)$asset['codepoint'],
            'asset_path' => (string)$asset['asset_path'],
            'source_name' => 'Twemoji',
        ];
    }

    return $normalized;
}

function catn8_load_icon_button_settings(): array
{
    $raw = secret_get(catn8_secret_key('icon_buttons.settings'));
    $decoded = [];
    if (is_string($raw) && trim($raw) !== '') {
        $json = json_decode($raw, true);
        if (is_array($json)) {
            $decoded = $json;
        }
    }
    return catn8_normalize_icon_button_settings($decoded);
}

function catn8_save_icon_button_settings(array $settings): array
{
    $normalized = catn8_normalize_icon_button_settings($settings);
    secret_set(catn8_secret_key('icon_buttons.settings'), json_encode($normalized));
    return $normalized;
}
