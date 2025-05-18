<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Activities - catn8.us</title>
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
            background: url('images/homepage_kindness.jpg') center/cover no-repeat fixed;
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

        /* Activity Cards */
        .activity-card {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
            border: 2px solid rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
            margin-bottom: 2rem;
        }

        .activity-card:hover {
            transform: translateY(-5px);
            background: rgba(255, 255, 255, 0.25);
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        }

        .activity-card img {
            width: 100%;
            height: 200px;
            object-fit: cover;
        }

        .activity-card-content {
            padding: 1.5rem;
            color: white;
        }

        .activity-card-content h3 {
            color: white;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
        }

        .lead {
            color: white;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
        }

        /* Responsive Design */
        @media (max-width: 768px) {
            .section-title {
                font-size: 2rem;
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
                        <a class="nav-link" href="/">Home</a>
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
                        <a class="nav-link active" href="activities.php">Activities</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <!-- Hero Section -->
    <section class="section">
        <div class="container">
            <h1 class="section-title">Fun Activities for Everyone!</h1>
            <p class="lead text-center mb-5">Discover exciting activities to do together!</p>
            
            <div class="row">
                <!-- Reading Activities -->
                <div class="col-md-6">
                    <div class="activity-card">
                        <img src="images/starfall-reading-fun.jpg" alt="Starfall Reading Fun">
                        <div class="activity-card-content">
                            <h3>Starfall Reading Fun</h3>
                            <p>Learn to read with fun interactive stories and activities!</p>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-6">
                    <div class="activity-card">
                        <img src="images/coloring-ws-art-adventure.jpg" alt="Coloring Art Adventure">
                        <div class="activity-card-content">
                            <h3>Coloring Art Adventure</h3>
                            <p>Express your creativity with fun coloring activities!</p>
                        </div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="activity-card">
                        <img src="images/pbs-kids-educational-play.jpg" alt="PBS Kids Educational Play">
                        <div class="activity-card-content">
                            <h3>PBS Kids Educational Play</h3>
                            <p>Learn and play with your favorite PBS Kids characters!</p>
                        </div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="activity-card">
                        <img src="images/color-by-numbers-art.jpg" alt="Color by Numbers Art">
                        <div class="activity-card-content">
                            <h3>Color by Numbers Art</h3>
                            <p>Create beautiful art while learning numbers!</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Creative Activities Section -->
    <section class="section bg-light">
        <div class="container">
            <h2 class="section-title">Creative Activities</h2>
            <p class="lead text-center mb-5">Let your imagination run wild!</p>
            
            <div class="row">
                <div class="col-md-6">
                    <div class="activity-card">
                        <img src="images/puzzle-maker-learning.jpg" alt="Puzzle Maker Learning">
                        <div class="activity-card-content">
                            <h3>Puzzle Maker Learning</h3>
                            <p>Create and solve your own puzzles!</p>
                        </div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="activity-card">
                        <img src="images/crayola-crafts-creative.jpg" alt="Crayola Crafts Creative">
                        <div class="activity-card-content">
                            <h3>Crayola Crafts Creative</h3>
                            <p>Make amazing crafts with Crayola!</p>
                        </div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="activity-card">
                        <img src="images/khan-academy-interactive.jpg" alt="Khan Academy Interactive">
                        <div class="activity-card-content">
                            <h3>Khan Academy Interactive</h3>
                            <p>Learn through fun interactive activities!</p>
                        </div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="activity-card">
                        <img src="images/music-theory-learning.jpg" alt="Music Theory Learning">
                        <div class="activity-card-content">
                            <h3>Music Theory Learning</h3>
                            <p>Discover the joy of music through fun activities!</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Educational Activities Section -->
    <section class="section">
        <div class="container">
            <h2 class="section-title">Educational Activities</h2>
            <p class="lead text-center mb-5">Learn while having fun!</p>
            
            <div class="row">
                <div class="col-md-6">
                    <div class="activity-card">
                        <img src="images/abcya-educational-games.jpg" alt="ABCya Educational Games">
                        <div class="activity-card-content">
                            <h3>ABCya Educational Games</h3>
                            <p>Play and learn with fun educational games!</p>
                        </div>
                    </div>
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