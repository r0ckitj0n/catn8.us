<?php
require_once 'config.php';

if (!isAdmin()) {
    redirect('/index.php');
}

$users = readJsonFile(USERS_FILE);
$errors = [];
$success = '';

// Handle user creation
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    if ($_POST['action'] === 'create') {
        $email = filter_input(INPUT_POST, 'email', FILTER_SANITIZE_EMAIL);
        $name = sanitizeInput($_POST['name']);
        $password = $_POST['password'];
        $isAdmin = isset($_POST['is_admin']);
        
        if (empty($email) || empty($name) || empty($password)) {
            $errors[] = "All fields are required";
        } else {
            // Check if email already exists
            foreach ($users as $user) {
                if ($user['email'] === $email) {
                    $errors[] = "Email already exists";
                    break;
                }
            }
            
            if (empty($errors)) {
                $userId = generateId();
                $users[$userId] = [
                    'email' => $email,
                    'name' => $name,
                    'password' => password_hash($password, PASSWORD_DEFAULT),
                    'is_admin' => $isAdmin,
                    'created_at' => date('Y-m-d H:i:s')
                ];
                writeJsonFile(USERS_FILE, $users);
                $success = "User created successfully";
            }
        }
    } elseif ($_POST['action'] === 'delete' && isset($_POST['user_id'])) {
        $userId = $_POST['user_id'];
        if (isset($users[$userId])) {
            unset($users[$userId]);
            writeJsonFile(USERS_FILE, $users);
            $success = "User deleted successfully";
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Panel - catn8.us</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.7.2/font/bootstrap-icons.css">
    <style>
        .admin-card {
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            padding: 2rem;
            margin-bottom: 2rem;
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
                <?php if ($success): ?>
                <div class="alert alert-success">
                    <?php echo $success; ?>
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

                <div class="admin-card">
                    <h3 class="mb-4">Create New User</h3>
                    <form action="admin.php" method="POST">
                        <input type="hidden" name="action" value="create">
                        <div class="mb-3">
                            <label for="email" class="form-label">Email</label>
                            <input type="email" class="form-control" id="email" name="email" required>
                        </div>
                        <div class="mb-3">
                            <label for="name" class="form-label">Name</label>
                            <input type="text" class="form-control" id="name" name="name" required>
                        </div>
                        <div class="mb-3">
                            <label for="password" class="form-label">Password</label>
                            <input type="password" class="form-control" id="password" name="password" required>
                        </div>
                        <div class="mb-3 form-check">
                            <input type="checkbox" class="form-check-input" id="is_admin" name="is_admin">
                            <label class="form-check-label" for="is_admin">Is Admin</label>
                        </div>
                        <button type="submit" class="btn btn-primary">Create User</button>
                    </form>
                </div>

                <div class="admin-card">
                    <h3 class="mb-4">Manage Users</h3>
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($users as $userId => $user): ?>
                                <tr>
                                    <td><?php echo sanitizeInput($user['name']); ?></td>
                                    <td><?php echo sanitizeInput($user['email']); ?></td>
                                    <td>
                                        <?php if ($user['is_admin'] ?? false): ?>
                                        <span class="badge bg-danger">Admin</span>
                                        <?php else: ?>
                                        <span class="badge bg-secondary">User</span>
                                        <?php endif; ?>
                                    </td>
                                    <td><?php echo date('M d, Y', strtotime($user['created_at'])); ?></td>
                                    <td>
                                        <form action="admin.php" method="POST" class="d-inline" 
                                              onsubmit="return confirm('Are you sure you want to delete this user?');">
                                            <input type="hidden" name="action" value="delete">
                                            <input type="hidden" name="user_id" value="<?php echo $userId; ?>">
                                            <button type="submit" class="btn btn-sm btn-danger">
                                                <i class="bi bi-trash"></i>
                                            </button>
                                        </form>
                                    </td>
                                </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html> 