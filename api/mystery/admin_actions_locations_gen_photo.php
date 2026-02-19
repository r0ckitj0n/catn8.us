<?php
/**
 * admin_actions_locations_gen_photo.php - AI location photo generation
 * VERSION: 2025-12-31-0510-FINAL
 */
declare(strict_types=1);

require_once __DIR__ . '/admin_functions.php';

if ($action === 'generate_location_photo' || $action === 'generate_location_photo_from_address') {
    catn8_mystery_require_admin($isAdmin);
    catn8_require_method('POST');
    $body = catn8_read_json_body();

    $id = (int)($body['id'] ?? 0);
    if ($id <= 0) catn8_json_response(['success' => false, 'error' => 'id is required'], 400);

    $row = Database::queryOne('SELECT id, name, description, location_id, address_line1, address_line2, city, region, postal_code, country FROM mystery_locations WHERE id = ? LIMIT 1', [$id]);
    if (!$row) catn8_json_response(['success' => false, 'error' => 'Location not found'], 404);

    $addr1 = trim((string)($row['address_line1'] ?? ''));
    $city = trim((string)($row['city'] ?? ''));
    $region = trim((string)($row['region'] ?? ''));
    if ($addr1 === '' || $city === '' || $region === '') {
        catn8_json_response(['success' => false, 'error' => 'Address line 1, city, and region are required to generate a photo'], 400);
    }

    $addr2 = trim((string)($row['address_line2'] ?? ''));
    $postal = trim((string)($row['postal_code'] ?? ''));
    $country = trim((string)($row['country'] ?? ''));
    $q = trim($addr1 . ( $addr2 !== '' ? (', ' . $addr2) : '' ) . ', ' . $city . ', ' . $region . ( $postal !== '' ? (' ' . $postal) : '' ) . ( $country !== '' ? (', ' . $country) : '' ));

    $aiImgCfg = catn8_mystery_ai_image_config_load();
    $imgProvider = strtolower(trim((string)($aiImgCfg['provider'] ?? 'openai')));
    $imgProviderConfig = $aiImgCfg['provider_config'] ?? [];
    if (!is_array($imgProviderConfig)) $imgProviderConfig = [];

    if ($imgProvider !== 'google_vertex_ai') {
        catn8_json_response(['success' => false, 'error' => 'Generate Photo from address requires AI Image provider google_vertex_ai'], 400);
    }

    $placesKey = secret_get(catn8_mystery_ai_secret_key($imgProvider, 'google_places_api_key'));
    if (!$placesKey) $placesKey = secret_get(catn8_secret_key('ai_image.secret.' . $imgProvider . '.google_places_api_key'));

    $streetKey = secret_get(catn8_mystery_ai_secret_key($imgProvider, 'google_street_view_api_key'));
    if (!$streetKey) $streetKey = secret_get(catn8_secret_key('ai_image.secret.' . $imgProvider . '.google_street_view_api_key'));

    $saJson = secret_get(catn8_mystery_ai_secret_key($imgProvider, 'service_account_json'));
    if (!$saJson) $saJson = secret_get(catn8_secret_key('ai_image.secret.' . $imgProvider . '.service_account_json'));

    $vertexProjectId = trim((string)($imgProviderConfig['gcp_project_id'] ?? ''));
    if ($vertexProjectId === '' && is_string($saJson)) {
        $sa = json_decode((string)$saJson, true);
        if (is_array($sa)) $vertexProjectId = trim((string)($sa['project_id'] ?? ''));
    }
    $vertexRegion = trim((string)($imgProviderConfig['gcp_region'] ?? ''));

    $rawBin = null;
    $referenceMethod = '';

    if (is_string($placesKey) && trim($placesKey) !== '') {
        $findUrl = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json?inputtype=textquery&fields=photos&input=' . rawurlencode($q) . '&key=' . rawurlencode($placesKey);
        $findResp = catn8_http_json_with_status('GET', $findUrl, [], null, 10, 30);
        if (($findResp['json']['status'] ?? '') === 'OK') {
            $photoRef = $findResp['json']['candidates'][0]['photos'][0]['photo_reference'] ?? '';
            if ($photoRef !== '') {
                $photoUrl = 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=1024&photoreference=' . rawurlencode($photoRef) . '&key=' . rawurlencode($placesKey);
                $bin = catn8_http_get_binary($photoUrl, 40);
                if (strlen($bin) > 2000) { $rawBin = $bin; $referenceMethod = 'google_places_photo'; }
            }
        }
    }

    if (!$rawBin && is_string($streetKey) && trim($streetKey) !== '') {
        $svUrl = 'https://maps.googleapis.com/maps/api/streetview?size=1024x768&location=' . rawurlencode($q) . '&key=' . rawurlencode($streetKey);
        $bin = catn8_http_get_binary($svUrl, 40);
        if (strlen($bin) > 2000) { $rawBin = $bin; $referenceMethod = 'google_street_view'; }
    }

    if (!$rawBin) catn8_json_response(['success' => false, 'error' => 'No reference photo found'], 404);

    $refB64 = base64_encode($rawBin);
    $prompt = catn8_mystery_location_build_image_prompt($row);
    $fullPrompt = trim($prompt . "\n\nUse the reference image as the real-world basis for the setting while applying the noir crime scene style.");
    $editModel = 'imagen-3.0-capability-001';

    try {
        $b64 = catn8_mystery_vertex_imagen_edit_with_raw_reference_b64((string)$saJson, $vertexProjectId, $vertexRegion, $editModel, $fullPrompt, $refB64, $aiImgCfg['params'] ?? []);
        $dest = dirname(__DIR__, 2) . '/images/mystery/location_' . $id . '.png';
        file_put_contents($dest, base64_decode($b64));
        $url = '/images/mystery/location_' . $id . '.png';
        Database::execute('INSERT INTO mystery_location_images (location_id, url, prompt_text, provider, model) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE url = VALUES(url), prompt_text = VALUES(prompt_text), provider = VALUES(provider), model = VALUES(model)', [$id, $url, $fullPrompt, $imgProvider, $editModel]);
        catn8_json_response(['success' => true, 'location_id' => $id, 'reference_method' => $referenceMethod, 'image' => catn8_mystery_location_image_load($id)]);
    } catch (Throwable $e) {
        catn8_json_response(['success' => false, 'error' => $e->getMessage()], 500);
    }
}
