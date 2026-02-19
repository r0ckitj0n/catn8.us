<?php

declare(strict_types=1);

require_once __DIR__ . '/../bootstrap.php';

catn8_require_method('GET');
catn8_session_start();

$uid = catn8_auth_user_id();
if ($uid === null) {
    catn8_json_response(['success' => true, 'user' => null]);
}

catn8_users_table_ensure();

$user = Database::queryOne('SELECT id, username, email, is_admin FROM users WHERE id = ?', [$uid]);
if (!$user) {
    catn8_json_response(['success' => true, 'user' => null]);
}

$isAdministrator = catn8_user_in_group($uid, 'administrators') ? 1 : 0;
$isMysteryGameUser = catn8_user_in_group($uid, 'mystery-game-users') ? 1 : 0;
$isWordsearchUser = catn8_user_in_group($uid, 'wordsearch-users') ? 1 : 0;

catn8_json_response(['success' => true, 'user' => [
    'id' => (int)$user['id'],
    'username' => (string)$user['username'],
    'email' => (string)$user['email'],
    'is_admin' => (int)$user['is_admin'],
    'is_administrator' => $isAdministrator,
    'is_mystery_game_user' => $isMysteryGameUser,
    'is_wordsearch_user' => $isWordsearchUser,
]]);
