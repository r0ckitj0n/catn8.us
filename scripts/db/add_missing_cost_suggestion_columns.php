<?php
// scripts/db/add_missing_cost_suggestion_columns.php
// Run once (CLI or browser while authenticated) to add missing columns to cost_suggestions.
// It is idempotent: only adds columns that do not already exist.

require_once __DIR__ . '/../../api/config.php';
require_once __DIR__ . '/../../includes/response.php';

// Basic guard: require admin if run via web
try {
    if (php_sapi_name() !== 'cli') {
        require_once __DIR__ . '/../../includes/auth_helper.php';
        AuthHelper::requireAdmin();
    }
} catch (Throwable $e) {
    // If auth helper not available in this context, continue (assume CLI)
}

$columns = [
    'breakdown' => 'TEXT',
    'detected_materials' => 'TEXT',
    'detected_features' => 'TEXT',
    'size_analysis' => 'TEXT',
    'complexity_score' => 'DECIMAL(10,4) DEFAULT 0',
    'production_time_estimate' => 'INT DEFAULT 0',
    'skill_level_required' => 'VARCHAR(191)',
    'market_positioning' => 'VARCHAR(191)',
    'eco_friendly_score' => 'DECIMAL(10,4) DEFAULT 0',
    'material_cost_factors' => 'TEXT',
    'labor_complexity_factors' => 'TEXT',
    'energy_usage_factors' => 'TEXT',
    'equipment_requirements' => 'TEXT',
    'material_confidence' => 'DECIMAL(10,4) DEFAULT 0',
    'labor_confidence' => 'DECIMAL(10,4) DEFAULT 0',
    'energy_confidence' => 'DECIMAL(10,4) DEFAULT 0',
    'equipment_confidence' => 'DECIMAL(10,4) DEFAULT 0',
    'materials_cost_amount' => 'DECIMAL(10,4) DEFAULT 0',
    'labor_cost_amount' => 'DECIMAL(10,4) DEFAULT 0',
    'energy_cost_amount' => 'DECIMAL(10,4) DEFAULT 0',
    'equipment_cost_amount' => 'DECIMAL(10,4) DEFAULT 0',
    'created_at' => 'DATETIME DEFAULT CURRENT_TIMESTAMP'
];

$added = [];
$skipped = [];
$errors = [];

try {
    $pdo = Database::getInstance();
    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);

    // Collect existing columns up front (avoid prepared SHOW ... LIKE ? which can fail)
    $existing = [];
    if ($driver === 'sqlite' || $driver === 'sqlite3') {
        $rows = $pdo->query("PRAGMA table_info(cost_suggestions)")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $r) {
            if (isset($r['name'])) $existing[] = $r['name'];
        }
    } else {
        $rows = $pdo->query("SHOW COLUMNS FROM cost_suggestions")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $r) {
            if (isset($r['Field'])) $existing[] = $r['Field'];
        }
    }

    $hasColumn = function(string $col) use ($existing) {
        return in_array($col, $existing, true);
    };

    // Use exec to avoid driver quirks with prepared ALTER statements
    foreach ($columns as $name => $definition) {
        try {
            if ($hasColumn($name)) { $skipped[] = $name; continue; }
            $sql = "ALTER TABLE cost_suggestions ADD COLUMN `$name` $definition";
            $pdo->exec($sql);
            $added[] = $name;
        } catch (Throwable $e) {
            $errors[$name] = $e->getMessage();
        }
    }
    $result = [
        'success' => empty($errors),
        'added' => $added,
        'skipped_existing' => $skipped,
        'errors' => $errors
    ];
    if (php_sapi_name() === 'cli') {
        echo json_encode($result, JSON_PRETTY_PRINT) . "\n";
    } else {
        Response::json($result);
    }
} catch (Throwable $e) {
    if (php_sapi_name() === 'cli') {
        fwrite(STDERR, "Failed: " . $e->getMessage() . "\n");
        exit(1);
    }
    Response::serverError('Migration failed: ' . $e->getMessage());
}
