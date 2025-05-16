<?php
// Prevent any output before headers
ob_start();

// File paths
define('DATA_DIR', __DIR__ . '/data');
define('USERS_FILE', DATA_DIR . '/users/users.json');
define('POSTS_FILE', DATA_DIR . '/posts/posts.json');
define('COMMENTS_FILE', DATA_DIR . '/comments/comments.json');

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Helper function to read JSON file
function readJsonFile($file) {
    if (!file_exists($file)) {
        return [];
    }
    $content = file_get_contents($file);
    return $content ? json_decode($content, true) : [];
}

// Helper function to write JSON file
function writeJsonFile($file, $data) {
    $dir = dirname($file);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    return file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
}

// Helper function to check if user is logged in
function isLoggedIn() {
    return isset($_SESSION['user_id']);
}

// Helper function to check if user is admin
function isAdmin() {
    return isset($_SESSION['is_admin']) && $_SESSION['is_admin'] === true;
}

// Helper function to redirect
function redirect($url) {
    header("Location: $url");
    exit();
}

// Helper function to get current user
function getCurrentUser() {
    if (!isLoggedIn()) {
        return null;
    }
    $users = readJsonFile(USERS_FILE);
    return isset($users[$_SESSION['user_id']]) ? $users[$_SESSION['user_id']] : null;
}

// Helper function to sanitize input
function sanitizeInput($input) {
    return htmlspecialchars(trim($input), ENT_QUOTES, 'UTF-8');
}

// Helper function to generate unique ID
function generateId() {
    return uniqid() . bin2hex(random_bytes(8));
}
?> 