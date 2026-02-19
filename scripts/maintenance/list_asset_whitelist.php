<?php
// scripts/maintenance/list_asset_whitelist.php
// Outputs JSON { patterns: [ ... ] } from DB asset_whitelist table.
header('Content-Type: application/json');
$ROOT = dirname(__DIR__, 2);
try {
    require_once $ROOT . '/api/config.php';
    if (!class_exists('Database')) throw new Exception('Database class missing');
    $db = Database::getInstance();
    $db->execute('CREATE TABLE IF NOT EXISTS `asset_whitelist` (
      `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
      `pattern` VARCHAR(255) NOT NULL,
      `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      UNIQUE KEY `uniq_pattern` (`pattern`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    $rows = $db->query('SELECT pattern FROM asset_whitelist ORDER BY id ASC');
    $patterns = array_values(array_map(fn($r) => (string)$r['pattern'], $rows ?: []));
    echo json_encode([ 'patterns' => $patterns ]);
} catch (Throwable $e) {
    http_response_code(200);
    echo json_encode([ 'patterns' => [] ]);
}
