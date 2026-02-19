<?php
require_once __DIR__ . '/../../api/config.php';

$pdo = Database::getInstance();

echo "Creating coupons table...\n";

try {
    $sql = "CREATE TABLE IF NOT EXISTS coupons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'fixed',
        value DECIMAL(10, 2) NOT NULL,
        min_order_amount DECIMAL(10, 2) DEFAULT 0.00,
        expires_at DATETIME NULL,
        usage_limit INT DEFAULT NULL,
        usage_count INT DEFAULT 0,
        active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
    
    $pdo->exec($sql);
    echo "Coupons table created successfully.\n";

    // Add coupon fields to orders table if they don't exist
    $columns = $pdo->query("SHOW COLUMNS FROM orders")->fetchAll(PDO::FETCH_COLUMN);
    
    if (!in_array('coupon_code', $columns)) {
        echo "Adding coupon_code to orders table...\n";
        $pdo->exec("ALTER TABLE orders ADD COLUMN coupon_code VARCHAR(50) NULL AFTER total");
    }
    
    if (!in_array('discount_amount', $columns)) {
        echo "Adding discount_amount to orders table...\n";
        $pdo->exec("ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(10, 2) DEFAULT 0.00 AFTER coupon_code");
    }

    echo "Database migration completed.\n";

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
