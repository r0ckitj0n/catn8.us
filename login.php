<?php
require_once 'config.php';

// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    // Debug information
    error_log("Login attempt - Username/Email: " . $email);

    if (empty($email) || empty($password)) {
        $_SESSION['error'] = "Please fill in all fields";
        header("Location: /index.php");
        exit();
    }

    $users = readJsonFile(USERS_FILE);
    
    // Debug information
    error_log("Users file contents: " . print_r($users, true));
    
    $user = null;
    
    // First try to find user by username (key)
    if (isset($users[$email])) {
        $user = $users[$email];
        $user['id'] = $email;
        error_log("User found by username");
    } else {
        // If not found by username, try to find by email
        foreach ($users as $id => $u) {
            if ($u['email'] === $email) {
                $user = $u;
                $user['id'] = $id;
                error_log("User found by email");
                break;
            }
        }
    }

    if ($user) {
        error_log("Password verification attempt");
        if (password_verify($password, $user['password'])) {
            error_log("Password verified successfully");
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['user_name'] = $user['name'];
            $_SESSION['is_admin'] = $user['is_admin'] ?? false;
            header("Location: /feed.php");
            exit();
        } else {
            error_log("Password verification failed");
        }
    } else {
        error_log("User not found");
    }

    $_SESSION['error'] = "Invalid username/email or password";
    header("Location: /index.php");
    exit();
} else {
    header("Location: /index.php");
    exit();
}
?> 