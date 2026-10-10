<?php

declare(strict_types=1);

/**
 * Tabul8 contestant labeling via OpenAI vision (server-side).
 * Falls back to Celebr8r tabul8_label request or manual labeling.
 */
final class Tabul8AiLabel
{
    public const API_KEY_SECRET = 'tabul8.openai.api_key';
    public const SETTINGS_SECRET = 'tabul8.ai.settings';

    public const DEFAULT_MODEL = 'gpt-4o-mini';
    public const TIMEOUT_SECONDS = 8;
    public const CONNECT_TIMEOUT = 3;

    /** Rough USD estimate per vision label call (gpt-4o-mini ballpark). */
    public const EST_COST_PER_CALL_USD = 0.002;

    public const FALLBACK_CELEBR8R = 'celebr8r';
    public const FALLBACK_MANUAL = 'manual';

    public const ALLOWED_MODELS = [
        'gpt-4o-mini',
        'gpt-4o',
        'gpt-4.1-mini',
        'gpt-4.1-nano',
    ];

    /**
     * Public settings for admin UI (never includes full API key).
     *
     * @return array<string,mixed>
     */
    public static function getPublicSettings(): array
    {
        $s = self::loadSettings();
        $key = self::getApiKey();
        $hasKey = $key !== '';
        $last4 = '';
        if ($hasKey) {
            $last4 = substr($key, -4);
        }
        return [
            'enabled' => !empty($s['enabled']) ? 1 : 0,
            'model' => (string)$s['model'],
            'fallback' => (string)$s['fallback'],
            'auto_label_on_snap' => !empty($s['auto_label_on_snap']) ? 1 : 0,
            'monthly_cap_usd' => (float)$s['monthly_cap_usd'],
            'per_party_limit' => (int)$s['per_party_limit'],
            'has_api_key' => $hasKey ? 1 : 0,
            'api_key_last4' => $last4,
            'api_key_masked' => $hasKey ? ('••••••••••••' . $last4) : '',
            'usage' => [
                'month' => (string)$s['usage_month'],
                'request_count' => (int)$s['usage_request_count'],
                'estimated_spend_usd' => round((float)$s['usage_estimated_spend_usd'], 4),
                'by_party' => is_array($s['usage_by_party'] ?? null) ? $s['usage_by_party'] : [],
            ],
            'default_model' => self::DEFAULT_MODEL,
            'allowed_models' => self::ALLOWED_MODELS,
            'timeout_seconds' => self::TIMEOUT_SECONDS,
        ];
    }

    public static function getApiKey(): string
    {
        require_once __DIR__ . '/secret_store.php';
        $raw = secret_get(catn8_secret_key(self::API_KEY_SECRET));
        return is_string($raw) ? trim($raw) : '';
    }

    public static function setApiKey(string $key): bool
    {
        require_once __DIR__ . '/secret_store.php';
        $key = trim($key);
        if ($key === '') {
            return false;
        }
        return secret_set(catn8_secret_key(self::API_KEY_SECRET), $key);
    }

    public static function clearApiKey(): bool
    {
        require_once __DIR__ . '/secret_store.php';
        return secret_delete(catn8_secret_key(self::API_KEY_SECRET));
    }

    /**
     * @param array<string,mixed> $fields
     * @return array<string,mixed>
     */
    public static function saveSettings(array $fields): array
    {
        $s = self::loadSettings();
        if (array_key_exists('enabled', $fields)) {
            $s['enabled'] = !empty($fields['enabled']) ? 1 : 0;
        }
        if (array_key_exists('auto_label_on_snap', $fields)) {
            $s['auto_label_on_snap'] = !empty($fields['auto_label_on_snap']) ? 1 : 0;
        }
        if (array_key_exists('model', $fields)) {
            $model = trim((string)$fields['model']);
            if ($model !== '' && in_array($model, self::ALLOWED_MODELS, true)) {
                $s['model'] = $model;
            } elseif ($model !== '') {
                // Allow custom model name Jon pastes (vision-capable).
                if (preg_match('/^[a-zA-Z0-9._:-]{3,64}$/', $model)) {
                    $s['model'] = $model;
                }
            }
        }
        if (array_key_exists('fallback', $fields)) {
            $fb = strtolower(trim((string)$fields['fallback']));
            $s['fallback'] = $fb === self::FALLBACK_MANUAL
                ? self::FALLBACK_MANUAL
                : self::FALLBACK_CELEBR8R;
        }
        if (array_key_exists('monthly_cap_usd', $fields)) {
            $s['monthly_cap_usd'] = max(0.0, (float)$fields['monthly_cap_usd']);
        }
        if (array_key_exists('per_party_limit', $fields)) {
            $s['per_party_limit'] = max(0, (int)$fields['per_party_limit']);
        }
        self::storeSettings($s);
        return self::getPublicSettings();
    }

    /**
     * Cheap connection test — never echoes the key.
     *
     * @return array{ok:bool,message:string,model?:string,sample?:string}
     */
    public static function testConnection(): array
    {
        $key = self::getApiKey();
        if ($key === '') {
            return ['ok' => false, 'message' => 'No OpenAI API key saved yet'];
        }
        $s = self::loadSettings();
        $model = (string)$s['model'];
        self::ensureHttpHelper();
        try {
            $res = catn8_http_json_with_status(
                'POST',
                'https://api.openai.com/v1/chat/completions',
                ['Authorization' => 'Bearer ' . $key],
                [
                    'model' => $model,
                    'messages' => [
                        ['role' => 'user', 'content' => 'Reply with exactly the word OK'],
                    ],
                    'max_tokens' => 5,
                    'temperature' => 0,
                ],
                self::CONNECT_TIMEOUT,
                self::TIMEOUT_SECONDS
            );
            $status = (int)($res['status'] ?? 0);
            $json = is_array($res['json'] ?? null) ? $res['json'] : [];
            if ($status < 200 || $status >= 300) {
                $err = '';
                if (isset($json['error']['message'])) {
                    $err = trim((string)$json['error']['message']);
                }
                // Never include request headers / key material.
                return [
                    'ok' => false,
                    'message' => 'OpenAI HTTP ' . $status . ($err !== '' ? ': ' . $err : ''),
                    'model' => $model,
                ];
            }
            $sample = trim((string)($json['choices'][0]['message']['content'] ?? ''));
            return [
                'ok' => true,
                'message' => 'Connection OK',
                'model' => $model,
                'sample' => mb_substr($sample, 0, 40),
            ];
        } catch (Throwable $e) {
            return [
                'ok' => false,
                'message' => 'Connection failed (timeout or network)',
                'model' => $model,
            ];
        }
    }

    /**
     * Attempt OpenAI label, then fallback. Never throws to callers for soft failures.
     *
     * @return array{source:string,label:?string,description:?string,entry:array,error:?string}
     */
    public static function labelEntry(int $entryId, ?int $userId = null): array
    {
        require_once __DIR__ . '/tabul8_model.php';
        $entry = Tabul8Model::getEntry($entryId);
        if (!$entry) {
            return [
                'source' => 'error',
                'label' => null,
                'description' => null,
                'entry' => [],
                'error' => 'Entry not found',
            ];
        }

        // Respect an explicit label already typed by the host.
        if (trim((string)($entry['label'] ?? '')) !== '') {
            return [
                'source' => 'provided',
                'label' => (string)$entry['label'],
                'description' => (string)($entry['description'] ?? ''),
                'entry' => $entry,
                'error' => null,
            ];
        }

        $s = self::loadSettings();
        $aiAttempted = false;
        $aiError = null;

        if (!empty($s['enabled'])) {
            $cap = self::checkCaps((int)$entry['party_id'], $s);
            if ($cap !== null) {
                $aiError = $cap;
            } elseif (self::getApiKey() === '') {
                $aiError = 'no_api_key';
            } else {
                $aiAttempted = true;
                $result = self::callOpenAiVision($entry, $s);
                if (!empty($result['ok'])) {
                    self::recordUsage((int)$entry['party_id'], $s);
                    $updated = Tabul8Model::setEntryLabel(
                        $entryId,
                        (string)$result['label'],
                        (string)($result['description'] ?? '')
                    );
                    return [
                        'source' => 'openai',
                        'label' => (string)$result['label'],
                        'description' => (string)($result['description'] ?? ''),
                        'entry' => $updated,
                        'error' => null,
                    ];
                }
                $aiError = (string)($result['error'] ?? 'openai_failed');
            }
        } else {
            $aiError = 'ai_disabled';
        }

        $fallback = (string)$s['fallback'];
        if ($fallback === self::FALLBACK_CELEBR8R) {
            $updated = Tabul8Model::queueLabelRequest($entry, $userId);
            return [
                'source' => 'celebr8r',
                'label' => null,
                'description' => null,
                'entry' => $updated,
                'error' => $aiError,
                'ai_attempted' => $aiAttempted ? 1 : 0,
            ];
        }

        // Manual — leave blank for host to edit.
        return [
            'source' => 'manual',
            'label' => null,
            'description' => null,
            'entry' => Tabul8Model::getEntry($entryId) ?: $entry,
            'error' => $aiError,
            'ai_attempted' => $aiAttempted ? 1 : 0,
        ];
    }

    /**
     * Whether snap should trigger labeling (AI and/or Celebr8r fallback).
     */
    public static function shouldLabelOnSnap(bool $requestLabelFlag): bool
    {
        if ($requestLabelFlag) {
            return true;
        }
        $s = self::loadSettings();
        return !empty($s['enabled']) && !empty($s['auto_label_on_snap']);
    }

    /**
     * Suggest a costume name from a kiosk camera JPEG (base64 / data URL / raw bytes).
     * Names must reflect visible costume/props; funny only as last resort.
     * Soft-fails fast; may queue tabul8_costume_name to Celebr8r with a signed frame photo.
     * Never blocks the voter.
     *
     * @return array{source:string,suggestion:?string,error:?string,request_id:?int,photo_id:?int}
     */
    public static function suggestCostumeName(
        int $partyId,
        string $imageBytesOrDataUrl,
        ?int $guestId = null,
        ?int $userId = null,
        ?int $identityId = null
    ): array {
        $s = self::loadSettings();
        $error = null;

        $decoded = self::decodeImagePayload($imageBytesOrDataUrl);
        $dataUrl = $decoded['data_url'];
        $bytes = $decoded['bytes'];

        if (!empty($s['enabled']) && self::getApiKey() !== '') {
            $cap = self::checkCaps($partyId, $s);
            if ($cap !== null) {
                $error = $cap;
            } else {
                $ai = self::callOpenAiCostumeSuggest($dataUrl, $s);
                if (!empty($ai['ok'])) {
                    self::recordUsage($partyId, $s);
                    return [
                        'source' => 'openai',
                        'suggestion' => (string)$ai['suggestion'],
                        'error' => null,
                        'request_id' => null,
                        'photo_id' => null,
                    ];
                }
                $error = (string)($ai['error'] ?? 'openai_failed');
            }
        } else {
            $error = self::getApiKey() === '' ? 'no_api_key' : 'ai_disabled';
        }

        $requestId = null;
        $photoId = null;
        $fallback = (string)$s['fallback'];
        if ($fallback === self::FALLBACK_CELEBR8R) {
            require_once __DIR__ . '/celebr8_agent_model.php';
            require_once __DIR__ . '/celebr8_album_model.php';
            Celebr8AgentModel::ensureSchema();
            Celebr8AlbumModel::ensureSchema();

            $photoUrl = null;
            // Store kiosk frame in party album so Celebr8r can see the costume.
            if ($bytes !== '' && $partyId > 0) {
                try {
                    $album = Celebr8AlbumModel::getOrCreateAlbumForParty($partyId, 'Party album');
                    $uploaded = Celebr8AlbumModel::uploadPhotoFromBytes(
                        $partyId,
                        (int)$album['id'],
                        $bytes,
                        'Tabul8 kiosk costume frame',
                        'tabul8:costume_suggest' . ($userId ? (':' . $userId) : ''),
                        null,
                        'kiosk-costume-frame.jpg'
                    );
                    $photoId = (int)($uploaded['photo']['id'] ?? 0);
                    if ($photoId > 0) {
                        Celebr8AlbumModel::tagPhoto(
                            $photoId,
                            $guestId && $guestId > 0 ? $guestId : null,
                            $identityId && $identityId > 0 ? $identityId : null,
                            null
                        );
                        // Short-lived signed URL (same pattern as tabul8_label).
                        $photoUrl = Celebr8AlbumModel::signedPhotoUrl($photoId, 'web', 1800);
                    }
                } catch (Throwable $e) {
                    // Soft-fail: still queue Celebr8r without photo rather than block.
                    catn8_log_error('tabul8 costume frame store soft-fail', ['error' => $e->getMessage()]);
                }
            }

            $req = Celebr8AgentModel::createRequest([
                'party_id' => $partyId,
                'request_type' => 'tabul8_costume_name',
                'type' => 'tabul8_costume_name',
                'request_text' => 'Tabul8 costume-name suggestion needed for party #' . $partyId
                    . ($guestId ? (' guest #' . $guestId) : '')
                    . '. Look at the kiosk photo (photo_url in payload). Name the costume from what they are'
                    . ' visibly wearing, carrying, holding, makeup, or props (2–6 words). Only invent something'
                    . ' funny if there is no good visual cue. Do not comment on body, age, or appearance beyond'
                    . ' the costume. Reply with set_tabul8_costume_name.',
                'show_before_sending' => 0,
                'audience_type' => 'none',
                'payload' => [
                    'party_id' => $partyId,
                    'guest_id' => $guestId,
                    'identity_id' => $identityId,
                    'photo_id' => $photoId,
                    'photo_url' => $photoUrl,
                    'subtype' => 'costume_name',
                ],
            ], $userId);
            $requestId = (int)($req['id'] ?? 0);
            return [
                'source' => 'celebr8r',
                'suggestion' => null,
                'error' => $error,
                'request_id' => $requestId > 0 ? $requestId : null,
                'photo_id' => $photoId && $photoId > 0 ? $photoId : null,
            ];
        }

        return [
            'source' => 'manual',
            'suggestion' => null,
            'error' => $error,
            'request_id' => null,
            'photo_id' => null,
        ];
    }

    /**
     * @return array{data_url:string,bytes:string}
     */
    private static function decodeImagePayload(string $imageBytesOrDataUrl): array
    {
        if (str_starts_with($imageBytesOrDataUrl, 'data:image/')) {
            $comma = strpos($imageBytesOrDataUrl, ',');
            $bytes = '';
            if ($comma !== false) {
                $meta = substr($imageBytesOrDataUrl, 0, $comma);
                $payload = substr($imageBytesOrDataUrl, $comma + 1);
                if (stripos($meta, ';base64') !== false) {
                    $decoded = base64_decode($payload, true);
                    $bytes = is_string($decoded) ? $decoded : '';
                }
            }
            return ['data_url' => $imageBytesOrDataUrl, 'bytes' => $bytes];
        }
        return [
            'data_url' => 'data:image/jpeg;base64,' . base64_encode($imageBytesOrDataUrl),
            'bytes' => $imageBytesOrDataUrl,
        ];
    }

    /**
     * @param array<string,mixed> $settings
     * @return array{ok:bool,suggestion?:string,error?:string}
     */
    private static function callOpenAiCostumeSuggest(string $dataUrl, array $settings): array
    {
        $key = self::getApiKey();
        if ($key === '') {
            return ['ok' => false, 'error' => 'no_api_key'];
        }
        self::ensureHttpHelper();
        $model = (string)$settings['model'];
        $system = 'You name party costumes from a kiosk camera photo. '
            . 'First briefly list the visible costume elements (clothes, hat, mask, makeup, props, '
            . 'what they are carrying or holding). Then invent a short PG costume_name (2–6 words) '
            . 'based ONLY on those elements. If there is no good visual costume cue, then and only then '
            . 'suggest something funny/scary/fanciful. Do NOT comment on body, age, attractiveness, '
            . 'identity, or appearance beyond the costume/props. '
            . 'Respond ONLY with JSON: {"visible":"short phrase","costume_name":"2 to 6 words"}. No markdown.';
        try {
            $res = catn8_http_json_with_status(
                'POST',
                'https://api.openai.com/v1/chat/completions',
                ['Authorization' => 'Bearer ' . $key],
                [
                    'model' => $model,
                    'temperature' => 0.6,
                    'max_tokens' => 100,
                    'response_format' => ['type' => 'json_object'],
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => $system,
                        ],
                        [
                            'role' => 'user',
                            'content' => [
                                [
                                    'type' => 'text',
                                    'text' => 'Describe the visible costume elements, then name this costume.',
                                ],
                                ['type' => 'image_url', 'image_url' => ['url' => $dataUrl, 'detail' => 'low']],
                            ],
                        ],
                    ],
                ],
                self::CONNECT_TIMEOUT,
                self::TIMEOUT_SECONDS
            );
        } catch (Throwable $e) {
            return ['ok' => false, 'error' => 'timeout_or_network'];
        }
        $status = (int)($res['status'] ?? 0);
        $json = is_array($res['json'] ?? null) ? $res['json'] : [];
        if ($status < 200 || $status >= 300) {
            return ['ok' => false, 'error' => 'http_' . $status];
        }
        $content = trim((string)($json['choices'][0]['message']['content'] ?? ''));
        $parsed = json_decode($content, true);
        if (!is_array($parsed) && preg_match('/\{.*\}/s', $content, $m)) {
            $parsed = json_decode($m[0], true);
        }
        if (!is_array($parsed)) {
            return ['ok' => false, 'error' => 'bad_json'];
        }
        $name = trim((string)($parsed['costume_name'] ?? $parsed['suggestion'] ?? $parsed['label'] ?? ''));
        if ($name === '' || mb_strlen($name) > 80) {
            return ['ok' => false, 'error' => 'bad_name'];
        }
        return ['ok' => true, 'suggestion' => $name];
    }

    private static function ensureHttpHelper(): void
    {
        if (!function_exists('catn8_http_json_with_status')) {
            require_once dirname(__DIR__) . '/api/bootstrap_http.php';
        }
    }

    /** @return array<string,mixed> */
    private static function loadSettings(): array
    {
        require_once __DIR__ . '/secret_store.php';
        $defaults = [
            'enabled' => 0,
            'auto_label_on_snap' => 1,
            'model' => self::DEFAULT_MODEL,
            'fallback' => self::FALLBACK_CELEBR8R,
            'monthly_cap_usd' => 10.0,
            'per_party_limit' => 80,
            'usage_month' => date('Y-m'),
            'usage_request_count' => 0,
            'usage_estimated_spend_usd' => 0.0,
            'usage_by_party' => [],
        ];
        $raw = secret_get(catn8_secret_key(self::SETTINGS_SECRET));
        if (!is_string($raw) || trim($raw) === '') {
            return $defaults;
        }
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return $defaults;
        }
        $out = array_merge($defaults, $decoded);
        // Roll month counters.
        if ((string)$out['usage_month'] !== date('Y-m')) {
            $out['usage_month'] = date('Y-m');
            $out['usage_request_count'] = 0;
            $out['usage_estimated_spend_usd'] = 0.0;
            $out['usage_by_party'] = [];
        }
        if (!in_array((string)$out['fallback'], [self::FALLBACK_CELEBR8R, self::FALLBACK_MANUAL], true)) {
            $out['fallback'] = self::FALLBACK_CELEBR8R;
        }
        return $out;
    }

    /** @param array<string,mixed> $settings */
    private static function storeSettings(array $settings): void
    {
        require_once __DIR__ . '/secret_store.php';
        secret_set(
            catn8_secret_key(self::SETTINGS_SECRET),
            (string)json_encode($settings, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        );
    }

    /**
     * @param array<string,mixed> $settings
     */
    private static function checkCaps(int $partyId, array $settings): ?string
    {
        $cap = (float)$settings['monthly_cap_usd'];
        $spent = (float)$settings['usage_estimated_spend_usd'];
        if ($cap > 0 && $spent >= $cap) {
            return 'monthly_cap_reached';
        }
        $limit = (int)$settings['per_party_limit'];
        if ($limit > 0 && $partyId > 0) {
            $byParty = is_array($settings['usage_by_party'] ?? null) ? $settings['usage_by_party'] : [];
            $count = (int)($byParty[(string)$partyId] ?? 0);
            if ($count >= $limit) {
                return 'party_limit_reached';
            }
        }
        return null;
    }

    /** @param array<string,mixed> $settings */
    private static function recordUsage(int $partyId, array $settings): void
    {
        $s = self::loadSettings();
        $s['usage_request_count'] = (int)$s['usage_request_count'] + 1;
        $s['usage_estimated_spend_usd'] = (float)$s['usage_estimated_spend_usd'] + self::EST_COST_PER_CALL_USD;
        $by = is_array($s['usage_by_party'] ?? null) ? $s['usage_by_party'] : [];
        $key = (string)$partyId;
        $by[$key] = (int)($by[$key] ?? 0) + 1;
        $s['usage_by_party'] = $by;
        self::storeSettings($s);
    }

    /**
     * @param array<string,mixed> $entry
     * @param array<string,mixed> $settings
     * @return array{ok:bool,label?:string,description?:string,error?:string}
     */
    private static function callOpenAiVision(array $entry, array $settings): array
    {
        require_once __DIR__ . '/celebr8_album_model.php';
        $key = self::getApiKey();
        if ($key === '') {
            return ['ok' => false, 'error' => 'no_api_key'];
        }
        $photoId = (int)($entry['photo_id'] ?? 0);
        if ($photoId <= 0) {
            return ['ok' => false, 'error' => 'no_photo'];
        }
        $row = Celebr8AlbumModel::getPhoto($photoId);
        if (!$row) {
            return ['ok' => false, 'error' => 'photo_missing'];
        }
        $path = Celebr8AlbumModel::resolveVariantPath($row, 'web');
        if ($path === null || !is_file($path)) {
            $path = Celebr8AlbumModel::resolveVariantPath($row, 'thumb');
        }
        if ($path === null || !is_file($path)) {
            return ['ok' => false, 'error' => 'photo_file_missing'];
        }
        $bytes = @file_get_contents($path);
        if (!is_string($bytes) || $bytes === '') {
            return ['ok' => false, 'error' => 'photo_unreadable'];
        }
        // Keep payload modest for shared hosting.
        if (strlen($bytes) > 2_500_000) {
            return ['ok' => false, 'error' => 'photo_too_large'];
        }
        $mime = (string)($row['mime_type'] ?? 'image/jpeg');
        if ($mime === '' || !str_starts_with($mime, 'image/')) {
            $mime = 'image/jpeg';
        }
        $b64 = base64_encode($bytes);
        $dataUrl = 'data:' . $mime . ';base64,' . $b64;

        $cat = Tabul8Model::getCategory((int)$entry['category_id']);
        $catName = $cat ? (string)$cat['name'] : 'Contest';
        $isChili = (bool)preg_match('/chili|cook.?off|food|dish/i', $catName);

        $system = 'You invent short, fun, PG party-contest labels for Halloween/family parties. '
            . 'Respond with ONLY compact JSON: {"label":"...","description":"..."}. '
            . 'label = 2 to 5 words. description = one short sentence. No markdown.';
        $userText = $isChili
            ? "Category: {$catName}. This is a chili/food entry — invent a playful dish label (not a person name) and a one-line description."
            : "Category: {$catName}. Invent a playful contestant costume/character label (2-5 words) and a one-line description.";

        $model = (string)$settings['model'];
        self::ensureHttpHelper();
        try {
            $res = catn8_http_json_with_status(
                'POST',
                'https://api.openai.com/v1/chat/completions',
                ['Authorization' => 'Bearer ' . $key],
                [
                    'model' => $model,
                    'temperature' => 0.7,
                    'max_tokens' => 120,
                    'response_format' => ['type' => 'json_object'],
                    'messages' => [
                        ['role' => 'system', 'content' => $system],
                        [
                            'role' => 'user',
                            'content' => [
                                ['type' => 'text', 'text' => $userText],
                                ['type' => 'image_url', 'image_url' => ['url' => $dataUrl, 'detail' => 'low']],
                            ],
                        ],
                    ],
                ],
                self::CONNECT_TIMEOUT,
                self::TIMEOUT_SECONDS
            );
        } catch (Throwable $e) {
            return ['ok' => false, 'error' => 'timeout_or_network'];
        }

        $status = (int)($res['status'] ?? 0);
        $json = is_array($res['json'] ?? null) ? $res['json'] : [];
        if ($status < 200 || $status >= 300) {
            return ['ok' => false, 'error' => 'http_' . $status];
        }
        $content = trim((string)($json['choices'][0]['message']['content'] ?? ''));
        if ($content === '') {
            return ['ok' => false, 'error' => 'empty_response'];
        }
        $parsed = json_decode($content, true);
        if (!is_array($parsed)) {
            // Try to extract JSON object if model wrapped it.
            if (preg_match('/\{.*\}/s', $content, $m)) {
                $parsed = json_decode($m[0], true);
            }
        }
        if (!is_array($parsed)) {
            return ['ok' => false, 'error' => 'bad_json'];
        }
        $label = trim((string)($parsed['label'] ?? ''));
        $description = trim((string)($parsed['description'] ?? ''));
        if ($label === '' || mb_strlen($label) > 80) {
            return ['ok' => false, 'error' => 'bad_label'];
        }
        if (mb_strlen($description) > 240) {
            $description = mb_substr($description, 0, 237) . '...';
        }
        return [
            'ok' => true,
            'label' => $label,
            'description' => $description,
        ];
    }
}
