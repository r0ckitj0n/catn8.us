<?php

declare(strict_types=1);

function vite_entry(string $entry): void
{
    $root = dirname(__DIR__);
    $hotFile = $root . '/hot';

    if (is_file($hotFile)) {
        $origin = trim((string)file_get_contents($hotFile));
        if ($origin !== '') {
            $origin = rtrim($origin, '/');
            echo '<script type="module">' . "\n";
            echo 'import RefreshRuntime from "' . htmlspecialchars($origin . '/@react-refresh') . '";' . "\n";
            echo 'RefreshRuntime.injectIntoGlobalHook(window);' . "\n";
            echo 'window.$RefreshReg$ = () => {};' . "\n";
            echo 'window.$RefreshSig$ = () => (type) => type;' . "\n";
            echo 'window.__vite_plugin_react_preamble_installed__ = true;' . "\n";
            echo '</script>' . "\n";
            echo '<script type="module" src="' . htmlspecialchars($origin . '/@vite/client') . '"></script>' . "\n";
            echo '<script type="module" src="' . htmlspecialchars($origin . '/' . ltrim($entry, '/')) . '"></script>' . "\n";
            return;
        }
    }

    $manifestPath = $root . '/dist/.vite/manifest.json';
    if (!is_file($manifestPath)) {
        $manifestPath = $root . '/dist/manifest.json';
    }

    if (!is_file($manifestPath)) {
        return;
    }

    $raw = (string)file_get_contents($manifestPath);
    $manifest = json_decode($raw, true);
    if (!is_array($manifest) || !isset($manifest[$entry])) {
        return;
    }

    $item = $manifest[$entry];

    $css = $item['css'] ?? [];
    if (is_array($css)) {
        foreach ($css as $href) {
            $href = '/dist/' . ltrim((string)$href, '/');
            echo '<link rel="stylesheet" href="' . htmlspecialchars($href) . '">' . "\n";
        }
    }

    $file = $item['file'] ?? '';
    if (is_string($file) && $file !== '') {
        $src = '/dist/' . ltrim($file, '/');
        echo '<script type="module" src="' . htmlspecialchars($src) . '"></script>' . "\n";
    }
}
