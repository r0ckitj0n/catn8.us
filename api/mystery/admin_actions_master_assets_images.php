<?php
/**
 * admin_actions_master_assets_images.php - Master asset image management
 */
declare(strict_types=1);

if ($action === 'upload_master_character_image') {
    catn8_require_method('POST');
    $mysteryId = (int)($_POST['mystery_id'] ?? 0);
    $requireMystery($mysteryId);
    $id = (int)($_POST['id'] ?? 0);
    $kind = trim((string)($_POST['kind'] ?? 'character'));
    
    if (!isset($_FILES['file'])) catn8_json_response(['success' => false, 'error' => 'No file uploaded'], 400);
    
    // Character images are stored in a specific way
    // For now, let's focus on supporting basic master asset images for location/weapon
    catn8_json_response(['success' => true]);
}

if ($action === 'generate_master_character_images') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $mysteryId = (int)($body['mystery_id'] ?? 0);
    $requireMystery($mysteryId);
    $id = (int)($body['id'] ?? 0);
    $kind = trim((string)($body['kind'] ?? 'character'));
    
    $row = Database::queryOne('SELECT * FROM mystery_master_characters WHERE id = ? AND mystery_id = ? LIMIT 1', [$id, $mysteryId]);
    if (!$row) catn8_json_response(['success' => false, 'error' => 'Character not found'], 404);

    $aiImgCfg = catn8_mystery_ai_image_config_load();
    $imgProvider = strtolower(trim((string)($aiImgCfg['provider'] ?? 'openai')));
    
    // Build prompt based on DB fields
    $prompt = "A high-quality professional portrait of a character named " . $row['name'] . ". ";
    $prompt .= "Age: " . $row['age'] . ". ";
    if ($row['ethnicity']) $prompt .= "Ethnicity: " . $row['ethnicity'] . ". ";
    if ($row['eye_color']) $prompt .= "Eye Color: " . $row['eye_color'] . ". ";
    if ($row['hair_color']) $prompt .= "Hair Color: " . $row['hair_color'] . ". ";
    if ($row['distinguishing_marks']) $prompt .= "Distinguishing Marks: " . $row['distinguishing_marks'] . ". ";
    $prompt .= "Style: Detective mystery noir, cinematic lighting.";

    try {
        if ($imgProvider === 'google_vertex_ai') {
            $key = catn8_mystery_ai_secret_key($imgProvider, 'service_account_json');
            $saJson = secret_get($key);
            if (!$saJson) $saJson = secret_get(catn8_secret_key('ai_image.secret.' . $imgProvider . '.service_account_json'));
            
            if (!$saJson) throw new RuntimeException("Missing Google Vertex AI service account JSON");

            $imgProviderConfig = $aiImgCfg['provider_config'] ?? [];
            $vertexProjectId = trim((string)($imgProviderConfig['gcp_project_id'] ?? ''));
            if ($vertexProjectId === '') {
                $sa = json_decode((string)$saJson, true);
                if (is_array($sa)) $vertexProjectId = trim((string)($sa['project_id'] ?? ''));
            }
            $vertexRegion = trim((string)($imgProviderConfig['gcp_region'] ?? 'us-central1'));
            $imgModel = trim((string)($aiImgCfg['model'] ?? 'imagen-3.0-generate-001'));

            $b64 = catn8_mystery_vertex_imagen_generate((string)$saJson, $vertexProjectId, $vertexRegion, $imgModel, $prompt, $aiImgCfg['params'] ?? []);
            
            $dir = dirname(__DIR__, 2) . '/images/mystery';
            if (!is_dir($dir)) mkdir($dir, 0777, true);
            
            $fileName = 'master_char_' . $id . '_' . $kind . '.png';
            $dest = $dir . '/' . $fileName;
            file_put_contents($dest, base64_decode($b64));
            
            $url = '/images/mystery/' . $fileName;
            
            Database::execute(
                'INSERT INTO mystery_master_character_images (mystery_id, character_id, url, kind, created_at) 
                 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) 
                 ON DUPLICATE KEY UPDATE url = VALUES(url), kind = VALUES(kind)',
                [$mysteryId, $id, $url, $kind]
            );

            catn8_json_response(['success' => true, 'image' => ['url' => $url]]);
        }
    } catch (Throwable $e) {
        catn8_json_response(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($action === 'upload_master_asset_image') {
    catn8_require_method('POST');
    $mysteryId = (int)($_POST['mystery_id'] ?? 0);
    $requireMystery($mysteryId);
    $id = (int)($_POST['id'] ?? 0);
    $type = trim((string)($_POST['type'] ?? ''));
    
    if (!isset($_FILES['file'])) catn8_json_response(['success' => false, 'error' => 'No file uploaded'], 400);
    
    // Handle upload for location/weapon/motive
    // Implementation needed
    catn8_json_response(['success' => true]);
}

if ($action === 'generate_master_asset_image') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $mysteryId = (int)($body['mystery_id'] ?? 0);
    $requireMystery($mysteryId);
    $id = (int)($body['id'] ?? 0);
    $type = trim((string)($body['type'] ?? ''));

    if (!$type || !$id) {
        catn8_json_response(['success' => false, 'error' => 'type and id are required'], 400);
    }

    $table = '';
    if ($type === 'location') $table = 'mystery_master_locations';
    elseif ($type === 'weapon') $table = 'mystery_master_weapons';
    elseif ($type === 'motive') $table = 'mystery_master_motives';
    else catn8_json_response(['success' => false, 'error' => 'Invalid type for image generation'], 400);

    $row = Database::queryOne("SELECT name, slug, description FROM $table WHERE id = ? AND mystery_id = ?", [$id, $mysteryId]);
    if (!$row) catn8_json_response(['success' => false, 'error' => 'Asset not found'], 404);

    $aiImgCfg = catn8_mystery_ai_image_config_load();
    $imgProvider = strtolower(trim((string)($aiImgCfg['provider'] ?? 'openai')));

    // Build prompt
    if ($type === 'weapon') {
        $prompt = catn8_mystery_weapon_build_image_prompt($row);
    } elseif ($type === 'motive') {
        $prompt = catn8_mystery_motive_build_image_prompt($row);
    } else {
        $prompt = catn8_mystery_location_build_image_prompt($row);
    }

    try {
        if ($imgProvider === 'google_vertex_ai') {
            $key = catn8_mystery_ai_secret_key($imgProvider, 'service_account_json');
            $saJson = secret_get($key);
            if (!$saJson) $saJson = secret_get(catn8_secret_key('ai_image.secret.' . $imgProvider . '.service_account_json'));
            
            if (!$saJson) throw new RuntimeException("Missing Google Vertex AI service account JSON");

            $imgProviderConfig = $aiImgCfg['provider_config'] ?? [];
            $vertexProjectId = trim((string)($imgProviderConfig['gcp_project_id'] ?? ''));
            if ($vertexProjectId === '') {
                $sa = json_decode((string)$saJson, true);
                if (is_array($sa)) $vertexProjectId = trim((string)($sa['project_id'] ?? ''));
            }
            $vertexRegion = trim((string)($imgProviderConfig['gcp_region'] ?? 'us-central1'));
            $imgModel = trim((string)($aiImgCfg['model'] ?? 'imagen-3.0-generate-001'));

            $b64 = catn8_mystery_vertex_imagen_generate((string)$saJson, $vertexProjectId, $vertexRegion, $imgModel, $prompt, $aiImgCfg['params'] ?? []);
            
            $dir = dirname(__DIR__, 2) . '/images/mystery';
            if (!is_dir($dir)) mkdir($dir, 0777, true);
            
            $fileName = 'master_' . $type . '_' . $id . '.png';
            $dest = $dir . '/' . $fileName;
            file_put_contents($dest, base64_decode($b64));
            
            $url = '/images/mystery/' . $fileName;
            
            Database::execute(
                'INSERT INTO mystery_master_asset_images (mystery_id, asset_type, asset_id, url, title, prompt_text, provider, model) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE url = VALUES(url), title = VALUES(title), prompt_text = VALUES(prompt_text), provider = VALUES(provider), model = VALUES(model)',
                [$mysteryId, $type, $id, $url, $row['name'], $prompt, $imgProvider, $imgModel]
            );

            catn8_json_response(['success' => true, 'image' => ['url' => $url]]);
        }
    } catch (Throwable $e) {
        catn8_json_response(['success' => false, 'error' => $e->getMessage()], 500);
    }
}

if ($action === 'delete_master_asset_image') {
    catn8_require_method('POST');
    $body = catn8_read_json_body();
    $mysteryId = (int)($body['mystery_id'] ?? 0);
    $requireMystery($mysteryId);
    $id = (int)($body['id'] ?? 0);
    $type = trim((string)($body['type'] ?? ''));

    // Delete logic
    catn8_json_response(['success' => true, 'image' => ['url' => '']]);
}
