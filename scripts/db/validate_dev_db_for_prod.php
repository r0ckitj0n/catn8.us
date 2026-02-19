#!/usr/bin/env php
<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This script must be run from the command line.\n");
    exit(1);
}

$root = dirname(__DIR__, 2);

require_once $root . '/api/config.php';
require_once $root . '/includes/database.php';
require_once $root . '/includes/functions.php';

try {
    require_once $root . '/api/business_settings_helper.php';
} catch (Throwable $e) {
}

function vout(string $msg): void
{
    echo $msg, "\n";
}

function verr(string $msg): void
{
    fwrite(STDERR, $msg . "\n");
}

$config = null;
if (function_exists('catn8_get_db_config')) {
    $config = catn8_get_db_config('local');
}

if (!$config || empty($config['host']) || empty($config['db']) || empty($config['user'])) {
    verr('Unable to resolve dev DB configuration from catn8_get_db_config.');
    exit(1);
}

$host = (string)($config['host'] ?? 'localhost');
$db   = (string)($config['db'] ?? '');
$user = (string)($config['user'] ?? '');
$pass = (string)($config['pass'] ?? '');
$port = (int)($config['port'] ?? 3306);
$socket = $config['socket'] ?? null;

try {
    $pdo = Database::createConnection($host, $db, $user, $pass, $port, $socket);
} catch (Throwable $e) {
    verr('Failed to connect to dev DB: ' . $e->getMessage());
    exit(1);
}

$errors = [];
$warnings = [];

// room_settings checks
try {
    $stmt = $pdo->query("SELECT room_number, room_name, door_label, is_active FROM room_settings");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $hasMain = false;
    $hasLanding = false;
    $activeNumeric = 0;
    foreach ($rows as $row) {
        $rn = (string)($row['room_number'] ?? '');
        $active = (int)($row['is_active'] ?? 0) === 1;
        if ($rn === '0' && $active) {
            $hasMain = true;
        }
        if ($rn === 'A' && $active) {
            $hasLanding = true;
        }
        if ($active && preg_match('/^[0-9]+$/', $rn) && (int)$rn >= 1) {
            $activeNumeric++;
        }
    }
    if (!$hasMain) {
        $errors[] = "room_settings: no active row for room_number '0' (main room).";
    }
    if (!$hasLanding) {
        $errors[] = "room_settings: no active row for room_number 'A' (landing).";
    }
    if ($activeNumeric === 0) {
        $errors[] = "room_settings: no active product rooms (numeric room_number >= 1).";
    }
} catch (Throwable $e) {
    $errors[] = 'room_settings check failed: ' . $e->getMessage();
}

// backgrounds checks
try {
    $checkBg = function (string $roomNumber) use ($pdo): bool {
        $stmt = $pdo->prepare("SELECT image_filename, png_filename, webp_filename FROM backgrounds WHERE room_number = ? AND is_active = 1 ORDER BY id DESC LIMIT 1");
        $stmt->execute([$roomNumber]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
        return (bool)$row;
    };

    if (!$checkBg('A')) {
        $errors[] = "backgrounds: no active background for room_number 'A' (landing).";
    }
    if (!$checkBg('0')) {
        $errors[] = "backgrounds: no active background for room_number '0' (main room).";
    }
} catch (Throwable $e) {
    $errors[] = 'backgrounds check failed: ' . $e->getMessage();
}

// room_maps check for landing coordinates (advisory, not fatal)
try {
    $stmt = $pdo->prepare("SELECT COUNT(*) AS c FROM room_maps WHERE room_number IN ('A','landing')");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
    $count = (int)($row['c'] ?? 0);
    if ($count === 0) {
        $warnings[] = "room_maps: no entries found for room_number 'A' or 'landing' (landing coordinates will fall back to defaults).";
    }
} catch (Throwable $e) {
    $warnings[] = 'room_maps check failed: ' . $e->getMessage();
}

// Business settings sanity (non-fatal)
if (class_exists('BusinessSettings')) {
    try {
        $biz = BusinessSettings::getByCategory('business_info');
        if (!is_array($biz) || empty($biz)) {
            $warnings[] = 'business_info settings are empty or unavailable.';
        }
    } catch (Throwable $e) {
        $warnings[] = 'business_info check failed: ' . $e->getMessage();
    }
}

if (!empty($warnings)) {
    vout('Warnings:');
    foreach ($warnings as $w) {
        vout('  - ' . $w);
    }
}

if (!empty($errors)) {
    verr('Dev DB validation FAILED.');
    foreach ($errors as $err) {
        verr('  - ' . $err);
    }
    exit(1);
}

vout('Dev DB validation PASSED: core rooms and backgrounds look production-safe.');
exit(0);
