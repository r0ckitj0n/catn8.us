#!/usr/bin/env php
<?php

declare(strict_types=1);

$root = dirname(__DIR__, 2);

require_once $root . '/api/config.php';
require_once $root . '/includes/secret_store.php';

$cmd = $argv[1] ?? '';
$key = $argv[2] ?? '';

if ($cmd === 'get') {
    if ($key === '') {
        fwrite(STDERR, "Usage: php scripts/secrets/secret_store_cli.php get <key>\n");
        exit(2);
    }
    $val = secret_get($key);
    if ($val === null) {
        exit(1);
    }
    echo $val;
    exit(0);
}

if ($cmd === 'set') {
    if ($key === '') {
        fwrite(STDERR, "Usage: php scripts/secrets/secret_store_cli.php set <key> <value>\n");
        exit(2);
    }
    $value = $argv[3] ?? '';
    if ($value === '') {
        fwrite(STDERR, "Refusing to set empty secret value.\n");
        exit(2);
    }
    if (!secret_set($key, $value)) {
        fwrite(STDERR, "Failed to set secret.\n");
        exit(1);
    }
    echo "OK\n";
    exit(0);
}

if ($cmd === 'delete') {
    if ($key === '') {
        fwrite(STDERR, "Usage: php scripts/secrets/secret_store_cli.php delete <key>\n");
        exit(2);
    }
    if (!secret_delete($key)) {
        fwrite(STDERR, "Failed to delete secret (or it did not exist).\n");
        exit(1);
    }
    echo "OK\n";
    exit(0);
}

fwrite(STDERR, "Usage:\n  php scripts/secrets/secret_store_cli.php get <key>\n  php scripts/secrets/secret_store_cli.php set <key> <value>\n  php scripts/secrets/secret_store_cli.php delete <key>\n");
exit(2);
