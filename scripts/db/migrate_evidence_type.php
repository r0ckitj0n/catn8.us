<?php
require_once __DIR__ . '/../../api/config.php';
require_once __DIR__ . '/../../includes/database.php';

try {
    // Check if 'type' column exists and 'evidence_type' does not
    $columns = Database::queryAll('DESCRIBE mystery_evidence');
    $hasType = false;
    $hasEvidenceType = false;
    foreach ($columns as $col) {
        if ($col['Field'] === 'type') $hasType = true;
        if ($col['Field'] === 'evidence_type') $hasEvidenceType = true;
    }

    if ($hasType && !$hasEvidenceType) {
        echo "Renaming 'type' to 'evidence_type' in mystery_evidence table...\n";
        Database::execute('ALTER TABLE mystery_evidence CHANGE `type` `evidence_type` VARCHAR(64) NOT NULL DEFAULT "physical"');
        echo "Done.\n";
    } else if ($hasEvidenceType) {
        echo "Column 'evidence_type' already exists.\n";
    } else {
        echo "Could not find 'type' column to rename.\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
