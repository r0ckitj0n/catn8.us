<?php
/**
 * admin_actions_locations_gen_details.php - AI detail generation for locations
 * VERSION: 2025-12-31-0510-FINAL
 */
declare(strict_types=1);

require_once __DIR__ . '/admin_functions.php';

if ($action === 'generate_location') {
    catn8_mystery_require_admin($isAdmin);
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $fillOnly = (int)($body['fill_missing_only'] ?? 1) ? 1 : 0;
    $withImage = (int)($body['with_image'] ?? 1) ? 1 : 0;
    $seedRegion = trim((string)($body['region'] ?? '')) ?: 'GA';

    $cur = [
        'name' => trim((string)($body['name'] ?? '')),
        'description' => (string)($body['description'] ?? ''),
        'location_id' => trim((string)($body['location_id'] ?? '')),
        'address_line1' => trim((string)($body['address_line1'] ?? '')),
        'address_line2' => trim((string)($body['address_line2'] ?? '')),
        'city' => trim((string)($body['city'] ?? '')),
        'region' => $seedRegion,
        'postal_code' => trim((string)($body['postal_code'] ?? '')),
        'country' => trim((string)($body['country'] ?? '')),
    ];

    if ($id > 0) {
        $row = Database::queryOne('SELECT * FROM mystery_locations WHERE id = ? LIMIT 1', [$id]);
        if (!$row) {
            catn8_json_response(['success' => false, 'error' => 'Not found'], 404);
        }
        foreach ($cur as $k => $v) {
            if ($v === '') {
                $cur[$k] = trim((string)($row[$k] ?? ''));
            }
        }
    }

    $aiCfg = catn8_mystery_get_ai_config();
    $systemPrompt = "You generate missing fields for a mystery game location. Return ONLY valid JSON: {\"fields_patch\":{...}}";
    $userPrompt = "Current location fields: " . json_encode($cur) . "\nFill in missing fields based on region: $seedRegion";

    try {
        $res = catn8_ai_chat_json([
            'provider' => $aiCfg['provider'] ?? 'openai',
            'model' => $aiCfg['model'] ?? 'gpt-4o-mini',
            'system_prompt' => $systemPrompt,
            'user_prompt' => $userPrompt,
            'temperature' => (float)($aiCfg['temperature'] ?? 0.2)
        ]);

        $patch = $res['json']['fields_patch'] ?? [];
        foreach (['name','description','city','country','address_line1','address_line2','postal_code','location_id'] as $k) {
            if (isset($patch[$k]) && (!$fillOnly || trim((string)$cur[$k]) === '')) {
                $cur[$k] = trim((string)$patch[$k]);
            }
        }
        $cur['region'] = $seedRegion;

        if ($id > 0) {
            Database::execute(
                'UPDATE mystery_locations SET name = ?, description = ?, location_id = ?, address_line1 = ?, address_line2 = ?, city = ?, region = ?, postal_code = ?, country = ? WHERE id = ? LIMIT 1',
                [$cur['name'], $cur['description'], $cur['location_id'], $cur['address_line1'], $cur['address_line2'], $cur['city'], $cur['region'], $cur['postal_code'], $cur['country'], $id]
            );
        }

        if ($withImage && $id > 0) {
            $aiImgCfg = catn8_mystery_ai_image_config_load();
            $imgProvider = strtolower(trim((string)($aiImgCfg['provider'] ?? 'openai')));
            $imgProviderConfig = $aiImgCfg['provider_config'] ?? [];
            if (!is_array($imgProviderConfig)) $imgProviderConfig = [];

            if ($imgProvider === 'google_vertex_ai') {
                $key = catn8_mystery_ai_secret_key($imgProvider, 'service_account_json');
                $saJson = secret_get($key);
                if (!$saJson) {
                    $saJson = secret_get(catn8_secret_key('ai_image.secret.' . $imgProvider . '.service_account_json'));
                }

                if ($saJson) {
                    $vertexProjectId = trim((string)($imgProviderConfig['gcp_project_id'] ?? ''));
                    if ($vertexProjectId === '' && is_string($saJson)) {
                        $sa = json_decode((string)$saJson, true);
                        if (is_array($sa)) $vertexProjectId = trim((string)($sa['project_id'] ?? ''));
                    }
                    $vertexRegion = trim((string)($imgProviderConfig['gcp_region'] ?? 'us-central1'));
                    $imgModel = trim((string)($aiImgCfg['model'] ?? 'imagen-3.0-generate-001'));

                    $prompt = catn8_mystery_location_build_image_prompt($cur);
                    $b64 = catn8_mystery_vertex_imagen_generate((string)$saJson, $vertexProjectId, $vertexRegion, $imgModel, $prompt, $aiImgCfg['params'] ?? []);
                    
                    $dir = dirname(__DIR__, 2) . '/images/mystery';
                    if (!is_dir($dir)) mkdir($dir, 0777, true);
                    
                    $fileName = 'location_' . $id . '.png';
                    $dest = $dir . '/' . $fileName;
                    file_put_contents($dest, base64_decode($b64));
                    
                    $url = '/images/mystery/' . $fileName;
                    Database::execute(
                        'INSERT INTO mystery_location_images (location_id, url, title, prompt_text, provider, model) 
                         VALUES (?, ?, ?, ?, ?, ?) 
                         ON DUPLICATE KEY UPDATE url = VALUES(url), title = VALUES(title), prompt_text = VALUES(prompt_text), provider = VALUES(provider), model = VALUES(model)',
                        [$id, $url, $cur['name'], $prompt, $imgProvider, $imgModel]
                    );
                }
            }
        }

        $img = catn8_mystery_location_image_load($id);
        
        catn8_json_response(['success' => true, 'location' => array_merge($cur, ['id' => $id, 'image' => $img])]);
    } catch (Throwable $e) {
        catn8_json_response(['success' => false, 'error' => $e->getMessage()], 500);
    }
}
