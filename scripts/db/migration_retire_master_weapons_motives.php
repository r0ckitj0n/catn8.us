<?php
// scripts/db/migration_retire_master_weapons_motives.php

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../includes/database.php';

echo "Starting migration: Retire legacy master weapons/motives tables (rename to *_legacy_*)...\n";

try {
    $exists = static function (string $table): bool {
        $row = Database::queryOne('SHOW TABLES LIKE ?', [$table]);
        return $row !== null;
    };

    $rename = static function (string $from, string $to) use ($exists): void {
        if (!$exists($from)) {
            echo " - SKIP: $from does not exist\n";
            return;
        }
        if ($exists($to)) {
            echo " - SKIP: $to already exists (not renaming $from)\n";
            return;
        }
        echo " - Renaming $from -> $to\n";
        Database::execute('RENAME TABLE ' . $from . ' TO ' . $to);
    };

    // Note: order doesn't matter for RENAME TABLE, but keep it readable.
    $rename('mystery_master_weapons', 'mystery_legacy_master_weapons');
    $rename('mystery_master_motives', 'mystery_legacy_master_motives');
    $rename('mystery_master_weapon_fingerprints', 'mystery_legacy_master_weapon_fingerprints');

    echo "Migration complete. (Reversible by renaming tables back.)\n";
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
