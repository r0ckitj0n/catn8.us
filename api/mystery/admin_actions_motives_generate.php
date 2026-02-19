<?php
/**
 * admin_actions_motives_generate.php - AI motive generation
 * VERSION: 2025-12-31-0510-FINAL
 */
declare(strict_types=1);

require_once __DIR__ . '/admin_functions.php';

if ($action === 'generate_motive') {
    catn8_mystery_require_admin($isAdmin);
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    $fillOnly = (int)($body['fill_missing_only'] ?? 1) ? 1 : 0;
    $withImage = (int)($body['with_image'] ?? 1) ? 1 : 0;

    $cur = [
        'name' => trim((string)($body['name'] ?? '')),
        'description' => (string)($body['description'] ?? ''),
    ];

    if ($id > 0) {
        $row = Database::queryOne('SELECT id, name, description FROM mystery_motives WHERE id = ? LIMIT 1', [$id]);
        if (!$row) catn8_json_response(['success' => false, 'error' => 'Motive not found'], 404);
        if ($cur['name'] === '') $cur['name'] = trim((string)($row['name'] ?? ''));
        if ($cur['description'] === '') $cur['description'] = (string)($row['description'] ?? '');
    }

    $aiCfg = catn8_mystery_get_ai_config();
    $curJson = json_encode($cur, JSON_UNESCAPED_SLASHES);

    $systemPrompt = trim(
        'You generate missing fields for a murder motive record for a detective mystery game.' . "\n" .
        'Return ONLY valid JSON with this exact shape: {"fields_patch":{"description":"..."}}' . "\n" .
        'Do not include any extra keys. Do not include markdown. Use the input fields as constraints.' . "\n" .
        ($fillOnly ? 'Only include fields that are currently blank. Do not overwrite existing fields.' : 'Return a full fields_patch.')
    );
    $userPrompt = trim('Current motive fields JSON:' . "\n" . $curJson);

    try {
        $res = catn8_ai_chat_json([
            'provider' => $aiCfg['provider'] ?? 'openai',
            'model' => $aiCfg['model'] ?? 'gpt-4o-mini',
            'system_prompt' => $systemPrompt,
            'user_prompt' => $userPrompt,
            'temperature' => (float)($aiCfg['temperature'] ?? 0.2)
        ]);

        $patch = $res['json']['fields_patch'] ?? [];
        if (isset($patch['description']) && (!$fillOnly || $cur['description'] === '')) {
            $cur['description'] = trim((string)$patch['description']);
        }

        if ($id > 0) {
            Database::execute(
                'UPDATE mystery_motives SET description = ? WHERE id = ? LIMIT 1',
                [$cur['description'], $id]
            );
        }

        $img = null;
        if ($withImage) {
            $aiImgCfg = catn8_mystery_ai_image_config_load();
            $imgProvider = strtolower(trim((string)($aiImgCfg['provider'] ?? 'openai')));
            $imgProviderConfig = $aiImgCfg['provider_config'] ?? [];
            if (!is_array($imgProviderConfig)) $imgProviderConfig = [];

            if ($imgProvider === 'google_vertex_ai') {
                $key = catn8_mystery_ai_secret_key($imgProvider, 'service_account_json');
                $saJson = secret_get($key);
                
                // Fallback to image-specific secret if generic one is missing
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

                    $prompt = catn8_mystery_motive_build_image_prompt($cur);
                    $b64 = catn8_mystery_vertex_imagen_generate((string)$saJson, $vertexProjectId, $vertexRegion, $imgModel, $prompt, $aiImgCfg['params'] ?? []);
                    
                    $dir = dirname(__DIR__, 2) . '/images/mystery';
                    if (!is_dir($dir)) mkdir($dir, 0777, true);
                    
                    $fileName = 'motive_' . $id . '.png';
                    $dest = $dir . '/' . $fileName;
                    file_put_contents($dest, base64_decode($b64));
                    
                    $url = '/images/mystery/' . $fileName;
                    Database::execute(
                        'INSERT INTO mystery_motive_images (motive_id, url, title, prompt_text, provider, model) 
                         VALUES (?, ?, ?, ?, ?, ?) 
                         ON DUPLICATE KEY UPDATE url = VALUES(url), title = VALUES(title), prompt_text = VALUES(prompt_text), provider = VALUES(provider), model = VALUES(model)',
                        [$id, $url, $cur['name'], $prompt, $imgProvider, $imgModel]
                    );
                }
            }
        }

        $img = catn8_mystery_motive_image_load($id);
        
        $rowOut = $id > 0
            ? Database::queryOne('SELECT id, slug, name, description, is_archived, created_at, updated_at FROM mystery_motives WHERE id = ? LIMIT 1', [$id])
            : null;
        
        $lockedIds = [];
        foreach (catn8_mystery_collect_locked_motive_ids() as $mid) {
            $lockedIds[(int)$mid] = true;
        }
        $isLocked = ($id > 0 && isset($lockedIds[$id])) ? 1 : 0;

        catn8_json_response([
            'success' => true,
            'id' => $id,
            'motive' => $rowOut ? [
                'id' => (int)($rowOut['id'] ?? 0),
                'slug' => (string)($rowOut['slug'] ?? ''),
                'name' => (string)($rowOut['name'] ?? ''),
                'description' => (string)($rowOut['description'] ?? ''),
                'is_archived' => (int)($rowOut['is_archived'] ?? 0) ? 1 : 0,
                'is_locked' => $isLocked,
                'image' => $img,
                'created_at' => (string)($rowOut['created_at'] ?? ''),
                'updated_at' => (string)($rowOut['updated_at'] ?? ''),
            ] : null,
        ]);
    } catch (Throwable $e) {
        catn8_json_response(['success' => false, 'error' => $e->getMessage()], 500);
    }
}
