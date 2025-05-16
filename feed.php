<?php
require_once 'config.php';

// Check if user is logged in
if (!isLoggedIn()) {
    redirect('/index.php');
}

$currentUser = getCurrentUser();
$posts = readJsonFile(POSTS_FILE);
$users = readJsonFile(USERS_FILE);

// Handle new post submission
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['content'])) {
    $content = sanitizeInput($_POST['content']);
    $imageUrl = '';
    
    // Handle image upload
    if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = 'uploads/posts/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }
        
        $fileName = uniqid() . '_' . basename($_FILES['image']['name']);
        $uploadFile = $uploadDir . $fileName;
        
        if (move_uploaded_file($_FILES['image']['tmp_name'], $uploadFile)) {
            $imageUrl = $uploadFile;
        }
    }
    
    $postId = generateId();
    $posts[$postId] = [
        'id' => $postId,
        'user_id' => $_SESSION['user_id'],
        'content' => $content,
        'image_url' => $imageUrl,
        'created_at' => date('Y-m-d H:i:s'),
        'likes' => [],
        'comments' => []
    ];
    
    writeJsonFile(POSTS_FILE, $posts);
    redirect('/feed.php');
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Feed - catn8.us</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.7.2/font/bootstrap-icons.css">
    <style>
        .post-card {
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .post-header {
            padding: 15px;
            border-bottom: 1px solid #eee;
        }
        .post-content {
            padding: 15px;
        }
        .post-image {
            max-width: 100%;
            height: auto;
        }
        .post-actions {
            padding: 10px 15px;
            border-top: 1px solid #eee;
        }
        .profile-pic {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            object-fit: cover;
        }
        .new-post {
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
            padding: 20px;
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
                <!-- New Post Form -->
                <div class="new-post">
                    <form action="feed.php" method="POST" enctype="multipart/form-data">
                        <div class="mb-3">
                            <textarea name="content" class="form-control" rows="3" placeholder="What's on your mind?" required></textarea>
                        </div>
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <input type="file" name="image" class="form-control" accept="image/*">
                            </div>
                            <button type="submit" class="btn btn-primary">Post</button>
                        </div>
                    </form>
                </div>

                <!-- Posts Feed -->
                <?php foreach (array_reverse($posts) as $post): ?>
                <div class="post-card">
                    <div class="post-header d-flex align-items-center">
                        <img src="<?php echo $users[$post['user_id']]['profile_photo'] ?? 'images/default-profile.jpg'; ?>" 
                             alt="Profile" class="profile-pic me-2">
                        <div>
                            <h6 class="mb-0"><?php echo sanitizeInput($users[$post['user_id']]['name']); ?></h6>
                            <small class="text-muted"><?php echo date('M d, Y H:i', strtotime($post['created_at'])); ?></small>
                        </div>
                    </div>
                    <div class="post-content">
                        <p><?php echo nl2br(sanitizeInput($post['content'])); ?></p>
                        <?php if (!empty($post['image_url'])): ?>
                        <img src="<?php echo $post['image_url']; ?>" alt="Post image" class="post-image">
                        <?php endif; ?>
                    </div>
                    <div class="post-actions">
                        <div class="d-flex justify-content-between">
                            <button class="btn btn-sm btn-outline-primary like-btn" data-post-id="<?php echo $post['id']; ?>">
                                <i class="bi bi-heart"></i> Like (<?php echo count($post['likes']); ?>)
                            </button>
                            <button class="btn btn-sm btn-outline-secondary comment-btn" data-post-id="<?php echo $post['id']; ?>">
                                <i class="bi bi-chat"></i> Comment (<?php echo count($post['comments']); ?>)
                            </button>
                        </div>
                        <div class="comments-section mt-3" id="comments-<?php echo $post['id']; ?>" style="display: none;">
                            <form class="comment-form mb-2" data-post-id="<?php echo $post['id']; ?>">
                                <div class="input-group">
                                    <input type="text" class="form-control" placeholder="Write a comment...">
                                    <button class="btn btn-primary" type="submit">Post</button>
                                </div>
                            </form>
                            <div class="comments-list">
                                <?php foreach ($post['comments'] as $comment): ?>
                                <div class="comment d-flex mt-2">
                                    <img src="<?php echo $users[$comment['user_id']]['profile_photo'] ?? 'images/default-profile.jpg'; ?>" 
                                         alt="Profile" class="profile-pic me-2" style="width: 30px; height: 30px;">
                                    <div>
                                        <strong><?php echo sanitizeInput($users[$comment['user_id']]['name']); ?></strong>
                                        <p class="mb-0"><?php echo sanitizeInput($comment['content']); ?></p>
                                    </div>
                                </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        // Like button functionality
        document.querySelectorAll('.like-btn').forEach(button => {
            button.addEventListener('click', function() {
                const postId = this.dataset.postId;
                fetch('like.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ post_id: postId })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        this.querySelector('i').classList.toggle('bi-heart-fill');
                        this.querySelector('i').classList.toggle('bi-heart');
                        const likeCount = this.textContent.match(/\((\d+)\)/)[1];
                        this.textContent = this.textContent.replace(/\(\d+\)/, `(${parseInt(likeCount) + (data.liked ? 1 : -1)})`);
                    }
                });
            });
        });

        // Comment button functionality
        document.querySelectorAll('.comment-btn').forEach(button => {
            button.addEventListener('click', function() {
                const postId = this.dataset.postId;
                const commentsSection = document.getElementById(`comments-${postId}`);
                commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
            });
        });

        // Comment form submission
        document.querySelectorAll('.comment-form').forEach(form => {
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                const postId = this.dataset.postId;
                const input = this.querySelector('input');
                const content = input.value.trim();
                
                if (content) {
                    fetch('comment.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            post_id: postId,
                            content: content
                        })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            const commentsList = this.nextElementSibling;
                            const newComment = document.createElement('div');
                            newComment.className = 'comment d-flex mt-2';
                            newComment.innerHTML = `
                                <img src="${data.user.profile_photo || 'images/default-profile.jpg'}" 
                                     alt="Profile" class="profile-pic me-2" style="width: 30px; height: 30px;">
                                <div>
                                    <strong>${data.user.name}</strong>
                                    <p class="mb-0">${content}</p>
                                </div>
                            `;
                            commentsList.appendChild(newComment);
                            input.value = '';
                            
                            // Update comment count
                            const commentBtn = document.querySelector(`.comment-btn[data-post-id="${postId}"]`);
                            const commentCount = commentBtn.textContent.match(/\((\d+)\)/)[1];
                            commentBtn.textContent = commentBtn.textContent.replace(/\(\d+\)/, `(${parseInt(commentCount) + 1})`);
                        }
                    });
                }
            });
        });
    </script>
</body>
</html> 