<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>catn8.us - A Fun Place for Families!</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/aos/2.3.4/aos.css">
    <link href="https://fonts.googleapis.com/css2?family=Comic+Neue:wght@400;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary-color: #FF6B6B;
            --secondary-color: #4ECDC4;
            --accent-color: #FFE66D;
            --dark-color: #2C3E50;
            --light-color: #F7F9FC;
            --fun-purple: #9B59B6;
            --fun-green: #2ECC71;
            --fun-orange: #E67E22;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Comic Neue', cursive;
            line-height: 1.6;
            color: var(--dark-color);
            background: url('images/pattern.svg') repeat;
            overflow-x: hidden;
            position: relative;
        }

        body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: url('images/homepage_friends.jpg') center/cover no-repeat fixed;
            opacity: 0.1;
            z-index: -1;
        }

        /* PBS Kids-inspired Navigation */
        .navbar {
            background: linear-gradient(135deg, var(--fun-purple), var(--fun-green));
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            padding: 1rem 0;
        }

        .navbar-brand img {
            height: 60px;
            transition: transform 0.3s ease;
        }

        .navbar-brand img:hover {
            transform: scale(1.1);
        }

        .nav-link {
            font-size: 1.2rem;
            color: white !important;
            padding: 0.5rem 1rem;
            margin: 0 0.5rem;
            border-radius: 25px;
            transition: all 0.3s ease;
            background: rgba(255, 255, 255, 0.1);
        }

        .nav-link:hover {
            background: rgba(255, 255, 255, 0.2);
            color: white !important;
            transform: translateY(-2px);
        }

        /* Hero Section */
        .hero {
            background: linear-gradient(135deg, var(--fun-purple), var(--fun-green));
            padding: 2rem 0;
            position: relative;
            overflow: hidden;
        }

        .hero-content {
            position: relative;
            z-index: 1;
        }

        .welcome-message {
            background: rgba(255, 255, 255, 0.15);
            padding: 2rem;
            border-radius: 20px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            margin-bottom: 2rem;
            backdrop-filter: blur(10px);
            border: 2px solid rgba(255, 255, 255, 0.2);
        }

        .welcome-message h1 {
            color: white;
            font-size: 3.5rem;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .welcome-message p {
            color: white;
        }

        /* Quick Access Buttons */
        .quick-access {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin: 2rem 0;
        }

        .quick-access-btn {
            background: rgba(255, 255, 255, 0.15);
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 15px;
            padding: 1.5rem;
            text-align: center;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            color: white;
            backdrop-filter: blur(10px);
        }

        .quick-access-btn:hover {
            transform: translateY(-5px);
            background: rgba(255, 255, 255, 0.25);
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        }

        .quick-access-btn img {
            width: 80px;
            height: 80px;
            margin-bottom: 1rem;
            border-radius: 50%;
            border: 3px solid rgba(255, 255, 255, 0.3);
        }

        /* Featured Content Grid */
        .featured-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            padding: 2rem 0;
        }

        .featured-card {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
            border: 2px solid rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
        }

        .featured-card:hover {
            transform: translateY(-5px);
            background: rgba(255, 255, 255, 0.25);
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        }

        .featured-card img {
            width: 100%;
            height: 200px;
            object-fit: cover;
        }

        .featured-card-content {
            padding: 1.5rem;
            color: white;
        }

        .featured-card-content h3 {
            color: white;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
        }

        /* Section Styles */
        .section {
            padding: 4rem 0;
            position: relative;
        }

        .section::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: inherit;
            filter: blur(10px);
            z-index: -1;
        }

        .section:nth-child(odd) {
            background: linear-gradient(135deg, var(--fun-purple), var(--fun-green));
            color: white;
        }

        .section:nth-child(even) {
            background: linear-gradient(135deg, var(--fun-orange), var(--fun-purple));
            color: white;
        }

        .section.bg-light {
            background: linear-gradient(135deg, var(--fun-green), var(--secondary-color)) !important;
            color: white;
        }

        .section-title {
            font-size: 2.5rem;
            color: white;
            margin-bottom: 2rem;
            text-align: center;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        .lead {
            color: white;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
        }

        /* Responsive Design */
        @media (max-width: 768px) {
            .welcome-message h1 {
                font-size: 2.5rem;
            }
            .quick-access {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    </style>
</head>
<body>
    <!-- Navigation -->
    <nav class="navbar navbar-expand-lg navbar-light sticky-top">
        <div class="container">
            <a class="navbar-brand" href="/">
                <img src="images/catn8_logo.jpeg" alt="catn8.us Logo">
            </a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item">
                        <a class="nav-link active" href="/">Home</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="about.php">About</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="stories.php">Stories</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="games.php">Games</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="arcade.php">Arcade</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="activities.php">Activities</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <!-- Hero Section -->
    <section class="hero">
        <div class="container">
            <div class="row align-items-center">
                <div class="col-lg-6">
                    <div class="welcome-message">
                        <h1>Welcome to catn8.us!</h1>
                        <p class="lead">Where Fun Meets Family!</p>
                        <p>Welcome to our magical corner of the internet! This is a special place where families come together to share stories, play games, and create wonderful memories.</p>
                        <div class="dictionary-entry mt-3">
                            <h3>catenate</h3>
                            <p style="font-style: italic;">/ˈkatnˌāt/</p>
                            <p><strong>verb</strong> (used with object)</p>
                            <p>1. to link together; form into a chain</p>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6">
                    <img src="images/catfamily.jpeg" alt="The Graves Family" class="img-fluid rounded shadow">
                </div>
            </div>
        </div>
    </section>

    <!-- Quick Access Section -->
    <section class="section bg-light">
        <div class="container">
            <div class="quick-access">
                <a href="stories.php" class="quick-access-btn">
                    <img src="images/homepage_friends.jpg" alt="Stories" class="rounded-circle">
                    <h3>Stories</h3>
                    <p>Read our fun adventures!</p>
                </a>
                <a href="games.php" class="quick-access-btn">
                    <img src="images/homepage_growth.jpg" alt="Games" class="rounded-circle">
                    <h3>Games</h3>
                    <p>Play and learn together!</p>
                </a>
                <a href="activities.php" class="quick-access-btn">
                    <img src="images/homepage_kindness.jpg" alt="Activities" class="rounded-circle">
                    <h3>Activities</h3>
                    <p>Fun things to do!</p>
                </a>
            </div>
        </div>
    </section>

    <!-- Featured Content -->
    <section class="section">
        <div class="container">
            <h2 class="section-title">What Makes Us Special</h2>
            <div class="featured-grid">
                <div class="featured-card">
                    <img src="images/homepage_friends.jpg" alt="Making Friends">
                    <div class="featured-card-content">
                        <h3>Making Friends</h3>
                        <p>We love making new friends and being kind to everyone! Here, we learn how to be good friends by sharing, listening, and helping each other.</p>
                    </div>
                </div>
                <div class="featured-card">
                    <img src="images/homepage_kindness.jpg" alt="Spreading Joy">
                    <div class="featured-card-content">
                        <h3>Spreading Joy</h3>
                        <p>Did you know that being kind is like spreading magic? Every time we do something nice, it makes someone else happy, and that happiness grows and grows!</p>
                    </div>
                </div>
                <div class="featured-card">
                    <img src="images/homepage_growth.jpg" alt="Growing Together">
                    <div class="featured-card-content">
                        <h3>Growing Together</h3>
                        <p>Just like plants need water and sunshine to grow, we need love and friendship to grow into our best selves!</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Adventure Section -->
    <section class="section bg-light">
        <div class="container">
            <div class="row align-items-center">
                <div class="col-lg-6">
                    <h2 class="section-title">Ready for Adventure?</h2>
                    <p class="lead">Every day is a new adventure waiting to happen! Whether we're exploring new stories, playing exciting games, or learning something new, we make sure it's always fun and full of surprises.</p>
                    <p>Join us on this amazing journey where every moment is a chance to discover something wonderful!</p>
                </div>
                <div class="col-lg-6">
                    <img src="images/homepage_adventure.jpg" alt="Adventure" class="img-fluid rounded shadow">
                </div>
            </div>
        </div>
    </section>

    <!-- Join Our Family Section -->
    <section class="section" style="background: linear-gradient(135deg, var(--fun-green), var(--fun-purple));">
        <div class="container">
            <div class="row justify-content-center">
                <div class="col-lg-8 text-center text-white">
                    <h2 class="section-title text-white">Join Our Family!</h2>
                    <p class="lead mb-4">Welcome to our special family circle! We're like a big, friendly tree where everyone can find a branch to sit on.</p>
                    <p class="mb-4">Here at catn8.us, we believe that every family is unique and special. We're not just a website - we're a community of friends who love to learn, play, and grow together. Our family tree keeps growing with new friends who bring their own special magic to our circle.</p>
                    <p class="mb-4">What makes our family special? It's the way we care for each other, share our stories, and create memories that last a lifetime. Whether you're reading our fun stories, playing our exciting games, or trying out our creative activities, you're part of something wonderful.</p>
                    <p class="mb-4">New friends join us through invitations from our current members, making sure our tree grows with love and care. It's like having a secret handshake that only special friends know about!</p>
                    <p class="mb-4">So, are you ready to be part of our growing family? We can't wait to share adventures, create memories, and make new friends together. Remember, in our family, everyone is welcome, everyone is special, and everyone belongs!</p>
                    <img src="images/homepage_family.jpg" alt="Family fun" class="img-fluid rounded shadow mt-4" style="max-width: 400px;">
                </div>
            </div>
        </div>
    </section>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/aos/2.3.4/aos.js"></script>
    <script>
        AOS.init({
            duration: 1000,
            once: true
        });
    </script>
</body>
</html>