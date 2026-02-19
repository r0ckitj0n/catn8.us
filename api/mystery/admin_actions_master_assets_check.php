<?php
/**
 * admin_actions_master_assets_check.php - Check if maintenance is needed for master assets
 */
declare(strict_types=1);

if ($action === 'check_master_assets_maintenance_needed') {
    catn8_require_method('GET');
    $mysteryId = (int)($_GET['mystery_id'] ?? 0);
    $requireMystery($mysteryId);

    $needsCleanup = false;
    $needsLinkImport = false;

    $masterOnlyFields = ['dob', 'age', 'hometown', 'address', 'ethnicity', 'zodiac', 'mbti', 'height', 'weight', 'eye_color', 'hair_color', 'distinguishing_marks', 'education', 'employment', 'aliases', 'criminal_record'];

    // 1. Check for Cleanup needed
    // Look for any character entity in this mystery that has any of the master-only fields
    // Align filters with actual maintenance actions (active cases only, active entities only)
    $cases = Database::queryAll('SELECT id FROM mystery_games WHERE mystery_id = ? AND is_archived = 0 AND is_template = 0', [$mysteryId]);
    if ($cases) {
        $caseIds = array_column($cases, 'id');
        $placeholders = implode(',', array_fill(0, count($caseIds), '?'));
        
        $entities = Database::queryAll("SELECT data_json FROM mystery_entities WHERE game_id IN ($placeholders) AND entity_type = 'character' AND is_archived = 0", $caseIds);
        
        foreach ($entities as $entity) {
            $data = json_decode((string)$entity['data_json'], true) ?: [];
            foreach ($masterOnlyFields as $f) {
                if (isset($data[$f])) {
                    $needsCleanup = true;
                    break 2;
                }
            }
        }
    }

    // 2. Check for Link + Import needed
    // Only flag if we actually find something we CAN link or CAN import
    if ($cases) {
        foreach ($entities as $entity) {
            $data = json_decode((string)$entity['data_json'], true) ?: [];
            $mid = (int)($data['master_id'] ?? 0);
            
            if ($mid <= 0) {
                // Check if a master exists that we could link to
                $slug = (string)($data['slug'] ?? '');
                $name = (string)($data['name'] ?? '');
                
                $match = false;
                if ($slug) {
                    $match = Database::queryOne('SELECT id FROM mystery_master_characters WHERE mystery_id = ? AND slug = ? AND is_archived = 0 LIMIT 1', [$mysteryId, $slug]);
                }
                if (!$match && $name) {
                    $match = Database::queryOne('SELECT id FROM mystery_master_characters WHERE mystery_id = ? AND name = ? AND is_archived = 0 LIMIT 1', [$mysteryId, $name]);
                }
                
                if ($match) {
                    $needsLinkImport = true;
                    break;
                }
            } else {
                // Already linked, check if there's data to import into empty master fields
                $master = Database::queryOne('SELECT * FROM mystery_master_characters WHERE id = ?', [$mid]);
                if ($master) {
                    $sp = $data['static_profile'] ?? [];
                    $fields = ['dob' => 'dob', 'age' => 'age', 'hometown' => 'hometown', 'height' => 'height', 'marks' => 'distinguishing_marks', 'education' => 'education'];
                    foreach ($fields as $srcK => $dstK) {
                        $v = $sp['demographics'][$srcK] ?? $sp['appearance'][$srcK] ?? $sp['background'][$srcK] ?? '';
                        if ($v && empty($master[$dstK])) {
                            $needsLinkImport = true;
                            break 2;
                        }
                    }
                }
            }
        }
    }

    catn8_json_response([
        'success' => true,
        'needs_cleanup' => $needsCleanup,
        'needs_link_import' => $needsLinkImport
    ]);
}
