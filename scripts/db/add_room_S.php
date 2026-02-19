<?php
// Dev utility: Seed room 'S' (Shop) into DB and ensure a default map
// Safe to run multiple times (idempotent)

header('Content-Type: application/json');

require_once __DIR__ . '/../../api/config.php';

function respond($ok, $data = []) {
    echo json_encode($ok ? (['success' => true] + $data) : (['success' => false] + $data));
    exit;
}

try {
    Database::getInstance();
} catch (Exception $e) {
    respond(false, ['message' => 'DB connection failed', 'error' => $e->getMessage()]);
}

try {
    // 0) Normalize schemas to support alphanumeric room numbers
    try {
        $col = Database::queryOne("SHOW COLUMNS FROM room_settings LIKE 'room_number'");
        if ($col && isset($col['Type']) && stripos($col['Type'], 'varchar') === false) {
            Database::execute("ALTER TABLE room_settings MODIFY room_number VARCHAR(10) NOT NULL");
        }
        // Ensure unique index exists (ignore if already present)
        try { Database::execute("ALTER TABLE room_settings ADD UNIQUE KEY uniq_room_number (room_number)"); } catch (Exception $e) { /* ignore */ }
    } catch (Exception $e) { /* ignore */ }

    try {
        // Ensure room_maps exists before inspecting
        $createMaps = "
          CREATE TABLE IF NOT EXISTS room_maps (
            id INT AUTO_INCREMENT PRIMARY KEY,
            room_number VARCHAR(50) NOT NULL,
            map_name VARCHAR(255) NOT NULL,
            coordinates TEXT,
            is_active BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_room_number (room_number),
            INDEX idx_active (is_active)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        Database::execute($createMaps);
        $col2 = Database::queryOne("SHOW COLUMNS FROM room_maps LIKE 'room_number'");
        if ($col2 && isset($col2['Type']) && stripos($col2['Type'], 'varchar') === false) {
            Database::execute("ALTER TABLE room_maps MODIFY room_number VARCHAR(50) NOT NULL");
        }
        // Ensure index exists (ignore if already present)
        try { Database::execute("CREATE INDEX idx_room_number ON room_maps (room_number)"); } catch (Exception $e) { /* ignore */ }
    } catch (Exception $e) { /* ignore */ }

    // 1) Ensure room_settings row for S
    $existing = Database::queryOne("SELECT id, room_number FROM room_settings WHERE room_number = 'S' LIMIT 1");
    if ($existing) {
        // Update friendly defaults if missing
        Database::execute(
            "UPDATE room_settings 
             SET room_name = COALESCE(NULLIF(room_name,''), 'Shop'),
                 door_label = COALESCE(NULLIF(door_label,''), 'Shop'),
                 description = COALESCE(description, ''),
                 is_active = 1
             WHERE room_number = 'S'"
        );
    } else {
        // Insert with sane defaults
        Database::execute(
            "INSERT INTO room_settings (room_number, room_name, door_label, description, display_order, is_active) 
             VALUES ('S', 'Shop', 'Shop', 'Shop landing page.', 90, 1)"
        );
    }

    // Ensure optional columns exist (best-effort)
    try { Database::execute("ALTER TABLE room_settings ADD COLUMN background_display_type ENUM('fullscreen','modal') NOT NULL DEFAULT 'fullscreen'"); } catch (Exception $e) { /* ignore */ }
    try { Database::execute("ALTER TABLE room_settings ADD COLUMN icons_white_background TINYINT(1) NOT NULL DEFAULT 1"); } catch (Exception $e) { /* ignore */ }

    // 2) Ensure map exists and seed an 'Original' active map for S
    $orig = Database::queryOne("SELECT id FROM room_maps WHERE room_number = 'S' AND map_name = 'Original' LIMIT 1");
    if ($orig) {
        // Ensure it's active
        Database::execute("UPDATE room_maps SET is_active = TRUE WHERE id = ?", [$orig['id']]);
        Database::execute("UPDATE room_maps SET is_active = FALSE WHERE room_number = 'S' AND id <> ?", [$orig['id']]);
    } else {
        Database::execute(
            "INSERT INTO room_maps (room_number, map_name, coordinates, is_active) VALUES ('S', 'Original', ?, TRUE)",
            [json_encode([])]
        );
        $newId = Database::lastInsertId();
        Database::execute("UPDATE room_maps SET is_active = FALSE WHERE room_number = 'S' AND id <> ?", [$newId]);
    }

    respond(true, ['message' => "Room 'S' ensured in room_settings and room_maps"]);
} catch (Exception $e) {
    respond(false, ['message' => 'Setup failed', 'error' => $e->getMessage()]);
}
