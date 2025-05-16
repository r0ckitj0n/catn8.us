<?php
require_once 'config.php';

if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not logged in']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$postId = $data['post_id'] ?? null;

if (!$postId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid post ID']);
    exit;
}

$posts = readJsonFile(POSTS_FILE);
if (!isset($posts[$postId])) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Post not found']);
    exit;
}

$userId = $_SESSION['user_id'];
$liked = false;

if (!isset($posts[$postId]['likes'])) {
    $posts[$postId]['likes'] = [];
}

if (in_array($userId, $posts[$postId]['likes'])) {
    $posts[$postId]['likes'] = array_diff($posts[$postId]['likes'], [$userId]);
} else {
    $posts[$postId]['likes'][] = $userId;
    $liked = true;
}

writeJsonFile(POSTS_FILE, $posts);

echo json_encode([
    'success' => true,
    'liked' => $liked
]);
?> 