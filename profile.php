<?php
require_once 'config.php';

if (!isLoggedIn()) {
    redirect('/index.php');
}

$currentUser = getCurrentUser();
$users = readJsonFile(USERS_FILE);

// Handle profile update
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = sanitizeInput($_POST['name']);
    $description = sanitizeInput($_POST['description']);
    $currentPassword = $_POST['current_password'];
    $newPassword = $_POST['new_password'];
    
    $errors = [];
    
    // Validate name
    if (empty($name)) {
        $errors[] = "Name is required";
    }
    
    // Handle password change if requested
    if (!empty($currentPassword) || !empty($newPassword)) {
        if (empty($currentPassword)) {
            $errors[] = "Current password is required to change password";
        } elseif (empty($newPassword)) {
            $errors[] = "New password is required";
        } elseif (!password_verify($currentPassword, $currentUser['password'])) {
            $errors[] = "Current password is incorrect";
        } else {
            $users[$_SESSION['user_id']]['password'] = password_hash($newPassword, PASSWORD_DEFAULT);
        }
    }
    
    // Handle profile photo upload
    if (isset($_FILES['profile_photo']) && $_FILES['profile_photo']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = 'uploads/profiles/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
        
        $fileName = uniqid() . '_' . basename($_FILES['profile_photo']['name']);
        $uploadFile = $uploadDir . $fileName;
        
        if (move_uploaded_file($_FILES['profile_photo']['tmp_name'], $uploadFile)) {
            $users[$_SESSION['user_id']]['profile_photo'] = $uploadFile;
        }
    }
    
    if (empty($errors)) {
        $users[$_SESSION['user_id']]['name'] = $name;
        $users[$_SESSION['user_id']]['description'] = $description;
        writeJsonFile(USERS_FILE, $users);
        $_SESSION['success'] = "Profile updated successfully";
        redirect('/profile.php');
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Profile - catn8.us</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.7.2/font/bootstrap-icons.css">
    <style>
        .profile-header {
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            padding: 2rem;
            margin-bottom: 2rem;
        }
        .profile-photo {
            width: 150px;
            height: 150px;
            border-radius: 50%;
            object-fit: cover;
            margin-bottom: 1rem;
        }
        .profile-form {
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            padding: 2rem;
        }
    </style>
</head>
<body class="bg-light">
    <nav class="navbar navbar-expand-lg navbar-dark fixed-top">
        <div class="container">
            <a class="navbar-brand" href="/">
                <img src="images/catn8_logo.jpeg" alt="catn8.us Logo" height="40">
            </a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item">
                        <a class="nav-link" href="/">Home</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="stories.php">Stories</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="about.php">About</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/#guiding-lights">Our Lights</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/#invitation">Our Circle</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <div class="container py-4">
        <div class="row">
            <div class="col-md-8 mx-auto">
                <?php if (isset($_SESSION['success'])): ?>
                <div class="alert alert-success">
                    <?php 
                    echo $_SESSION['success'];
                    unset($_SESSION['success']);
                    ?>
                </div>
                <?php endif; ?>

                <?php if (!empty($errors)): ?>
                <div class="alert alert-danger">
                    <ul class="mb-0">
                        <?php foreach ($errors as $error): ?>
                        <li><?php echo $error; ?></li>
                        <?php endforeach; ?>
                    </ul>
                </div>
                <?php endif; ?>

                <div class="profile-header text-center">
                    <img src="<?php echo $currentUser['profile_photo'] ?? 'images/default-profile.jpg'; ?>" 
                         alt="Profile Photo" class="profile-photo">
                    <h2><?php echo sanitizeInput($currentUser['name']); ?></h2>
                    <p class="text-muted"><?php echo sanitizeInput($currentUser['description'] ?? ''); ?></p>
                </div>

                <div class="profile-form">
                    <h3 class="mb-4">Edit Profile</h3>
                    <form action="profile.php" method="POST" enctype="multipart/form-data">
                        <div class="mb-3">
                            <label for="name" class="form-label">Name</label>
                            <input type="text" class="form-control" id="name" name="name" 
                                   value="<?php echo sanitizeInput($currentUser['name']); ?>" required>
                        </div>
                        
                        <div class="mb-3">
                            <label for="description" class="form-label">About Me</label>
                            <textarea class="form-control" id="description" name="description" rows="3"><?php 
                                echo sanitizeInput($currentUser['description'] ?? ''); 
                            ?></textarea>
                        </div>
                        
                        <div class="mb-3">
                            <label for="profile_photo" class="form-label">Profile Photo</label>
                            <input type="file" class="form-control" id="profile_photo" name="profile_photo" accept="image/*">
                        </div>
                        
                        <hr class="my-4">
                        
                        <h4 class="mb-3">Change Password</h4>
                        <div class="mb-3">
                            <label for="current_password" class="form-label">Current Password</label>
                            <input type="password" class="form-control" id="current_password" name="current_password">
                        </div>
                        
                        <div class="mb-3">
                            <label for="new_password" class="form-label">New Password</label>
                            <input type="password" class="form-control" id="new_password" name="new_password">
                        </div>
                        
                        <button type="submit" class="btn btn-primary">Save Changes</button>
                    </form>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html> 