<?php

declare(strict_types=1);

require_once __DIR__ . '/../../api/bootstrap.php';

if (PHP_SAPI !== 'cli') {
    catn8_require_admin();
}

Database::execute("CREATE TABLE IF NOT EXISTS catn8_diagnostics_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INT NULL,
    endpoint VARCHAR(191) NOT NULL,
    event_key VARCHAR(191) NOT NULL,
    ok TINYINT(1) NOT NULL DEFAULT 0,
    http_status INT NULL,
    message VARCHAR(512) NOT NULL DEFAULT '',
    meta_json JSON NULL,
    ip VARCHAR(64) NOT NULL DEFAULT '',
    user_agent VARCHAR(255) NOT NULL DEFAULT '',
    KEY idx_created_at (created_at),
    KEY idx_event_key (event_key),
    KEY idx_user_id (user_id),
    KEY idx_ok (ok)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

catn8_json_response(['success' => true]);
