<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/../includes/celebr8_model.php';

Celebr8Model::ensureSchema();

function celebr8_relay_extract_token(): string
{
    $header = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    if (preg_match('/^\s*Bearer\s+(\S+)\s*$/i', $header, $m)) {
        return trim($m[1]);
    }
    $alt = trim((string)($_SERVER['HTTP_X_CELEBR8_RELAY_TOKEN'] ?? ''));
    if ($alt !== '') {
        return $alt;
    }
    return trim((string)($_GET['token'] ?? ''));
}

$token = celebr8_relay_extract_token();
if (!Celebr8Model::verifyApiToken($token, Celebr8Model::RELAY_TOKEN_SECRET_KEY)) {
    catn8_log_error('celebr8 relay auth failure', ['ip' => (string)($_SERVER['REMOTE_ADDR'] ?? '')]);
    catn8_json_response(['success' => false, 'error' => 'Not authenticated'], 401);
}

$action = trim((string)($_GET['action'] ?? ''));
$allowed = ['fetch_queued', 'claim', 'mark_sent', 'mark_failed'];
if ($action === '' || !in_array($action, $allowed, true)) {
    catn8_json_response(['success' => false, 'error' => 'Unknown or missing action'], 400);
}

try {
    if ($action === 'fetch_queued') {
        catn8_require_method('GET', false);
        $limit = (int)($_GET['limit'] ?? 20);
        catn8_json_response([
            'success' => true,
            'messages' => Celebr8Model::fetchQueuedForRelay($limit),
        ]);
    }

    // Bearer token auth replaces browser CSRF for the Mac relay.
    catn8_require_method('POST', false);
    $body = catn8_read_json_body(false);

    if ($action === 'claim') {
        $ids = $body['message_ids'] ?? $body['ids'] ?? [];
        if (!is_array($ids) || $ids === []) {
            catn8_json_response(['success' => false, 'error' => 'message_ids required'], 400);
        }
        $claimedBy = trim((string)($body['claimed_by'] ?? 'relay'));
        $claimed = Celebr8Model::claimMessages($ids, $claimedBy);
        catn8_json_response([
            'success' => true,
            'claimed' => $claimed,
            'claimed_count' => count($claimed),
        ]);
    }

    if ($action === 'mark_sent') {
        $id = (int)($body['message_id'] ?? $body['id'] ?? 0);
        if ($id <= 0) {
            catn8_json_response(['success' => false, 'error' => 'message_id required'], 400);
        }
        $msg = Celebr8Model::markMessageSent($id);
        if (!$msg) {
            catn8_json_response(['success' => false, 'error' => 'Message not found'], 404);
        }
        catn8_json_response(['success' => true, 'message' => $msg]);
    }

    if ($action === 'mark_failed') {
        $id = (int)($body['message_id'] ?? $body['id'] ?? 0);
        if ($id <= 0) {
            catn8_json_response(['success' => false, 'error' => 'message_id required'], 400);
        }
        $error = (string)($body['error'] ?? $body['error_text'] ?? 'send failed');
        $msg = Celebr8Model::markMessageFailed($id, $error);
        if (!$msg) {
            catn8_json_response(['success' => false, 'error' => 'Message not found'], 404);
        }
        catn8_json_response(['success' => true, 'message' => $msg]);
    }

    catn8_json_response(['success' => false, 'error' => 'Unhandled action'], 500);
} catch (InvalidArgumentException $e) {
    catn8_json_response(['success' => false, 'error' => $e->getMessage()], 400);
} catch (Throwable $e) {
    catn8_log_error('celebr8 relay API error', ['action' => $action, 'error' => $e->getMessage()]);
    catn8_json_response(['success' => false, 'error' => 'Server error'], 500);
}
