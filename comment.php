<?php
require_once 'config.php';

if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$postId = $data['post_id'] ?? null;
$content = $data['content'] ?? null;

if (!$postId || !$content) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid post ID or content']);
    exit;
}

$posts = readJsonFile(POSTS_FILE);
if (!isset($posts[$postId])) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Post not found']);
    exit;
}

if (!isset($posts[$postId]['comments'])) {
    $posts[$postId]['comments'] = [];
}

$comment = [
    'id' => generateId(),
    'user_id' => $_SESSION['user_id'],
    'content' => sanitizeInput($content),
    'created_at' => date('Y-m-d H:i:s')
];

$posts[$postId]['comments'][] = $comment;
writeJsonFile(POSTS_FILE, $posts);

$users = readJsonFile(USERS_FILE);
$user = $users[$_SESSION['user_id']];

echo json_encode([
    'success' => true,
    'comment' => $comment,
    'user' => [
        'name' => $user['name'],
        'profile_photo' => $user['profile_photo'] ?? null
    ]
]);
?> 