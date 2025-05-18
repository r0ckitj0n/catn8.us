<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Games - catn8.us</title>
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
            background: url('images/homepage_growth.jpg') center/cover no-repeat fixed;
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

        /* Game Cards */
        .game-card {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
            border: 2px solid rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
            margin-bottom: 2rem;
        }

        .game-card:hover {
            transform: translateY(-5px);
            background: rgba(255, 255, 255, 0.25);
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        }

        .game-card img {
            width: 100%;
            height: 200px;
            object-fit: cover;
        }

        .game-card-content {
            padding: 1.5rem;
            color: white;
        }

        .game-card-content h3 {
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
                        <a class="nav-link active" href="games.php">Games</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="activities.php">Activities</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <!-- Hero Section -->
    <section class="section">
        <div class="container">
            <h1 class="section-title">Fun Games for Everyone!</h1>
            <p class="lead text-center mb-5">Play and learn with our collection of exciting games!</p>
            
            <div class="row">
                <!-- Educational Games -->
                <div class="col-md-6">
                    <div class="game-card">
                        <img src="images/pbs-kids-learning-adventure.jpg" alt="PBS Kids Learning Adventure">
                        <div class="game-card-content">
                            <h3>PBS Kids Learning Adventure</h3>
                            <p>Join your favorite PBS Kids characters in fun learning games!</p>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-6">
                    <div class="game-card">
                        <img src="images/nick-jr-character-playground.jpg" alt="Nick Jr. Character Playground">
                        <div class="game-card-content">
                            <h3>Nick Jr. Character Playground</h3>
                            <p>Play with your favorite Nick Jr. characters in this fun playground!</p>
                        </div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="game-card">
                        <img src="images/starfall-reading-adventure.jpg" alt="Starfall Reading Adventure">
                        <div class="game-card-content">
                            <h3>Starfall Reading Adventure</h3>
                            <p>Learn to read with fun interactive stories and games!</p>
                        </div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="game-card">
                        <img src="images/cool-math-puzzle-challenge.jpg" alt="Cool Math Puzzle Challenge">
                        <div class="game-card-content">
                            <h3>Cool Math Puzzle Challenge</h3>
                            <p>Solve fun math puzzles and improve your skills!</p>
                        </div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="game-card">
                        <img src="images/abcya-elementary-learning.jpg" alt="ABCya Elementary Learning">
                        <div class="game-card-content">
                            <h3>ABCya Elementary Learning</h3>
                            <p>Fun educational games for elementary school students!</p>
                        </div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="game-card">
                        <img src="images/prodigy-math-rpg-adventure.jpg" alt="Prodigy Math RPG Adventure">
                        <div class="game-card-content">
                            <h3>Prodigy Math RPG Adventure</h3>
                            <p>Embark on an epic math adventure in this RPG game!</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Family Games Section -->
    <section class="section bg-light">
        <div class="container">
            <h2 class="section-title">Family Fun Games</h2>
            <p class="lead text-center mb-5">Play together with these family-friendly games!</p>
            
            <div class="row">
                <div class="col-md-6">
                    <div class="game-card">
                        <img src="images/animal-crossing-island-life.jpg" alt="Animal Crossing: Island Life">
                        <div class="game-card-content">
                            <h3>Animal Crossing: Island Life</h3>
                            <p>Create your own island paradise and make new friends!</p>
                        </div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="game-card">
                        <img src="images/stardew-valley-farm-life.jpg" alt="Stardew Valley: Farm Life">
                        <div class="game-card-content">
                            <h3>Stardew Valley: Farm Life</h3>
                            <p>Build your dream farm and live a peaceful life!</p>
                        </div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="game-card">
                        <img src="images/overcooked-kitchen-chaos.jpg" alt="Overcooked: Kitchen Chaos">
                        <div class="game-card-content">
                            <h3>Overcooked: Kitchen Chaos</h3>
                            <p>Work together to create delicious meals in this fun cooking game!</p>
                        </div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="game-card">
                        <img src="images/minecraft-blocky-world.jpg" alt="Minecraft: Blocky World">
                        <div class="game-card-content">
                            <h3>Minecraft: Blocky World</h3>
                            <p>Build, explore, and create in this amazing blocky world!</p>
                        </div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="game-card">
                        <img src="images/roblox-social-gaming.jpg" alt="Roblox: Social Gaming">
                        <div class="game-card-content">
                            <h3>Roblox: Social Gaming</h3>
                            <p>Play with friends in this creative social gaming platform!</p>
                        </div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="game-card">
                        <img src="images/lego-fun-adventures.jpg" alt="LEGO Fun Adventures">
                        <div class="game-card-content">
                            <h3>LEGO Fun Adventures</h3>
                            <p>Build and play with LEGO in exciting virtual worlds!</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Strategy Games Section -->
    <section class="section">
        <div class="container">
            <h2 class="section-title">Strategy Games</h2>
            <p class="lead text-center mb-5">Challenge your mind with these strategic games!</p>
            
            <div class="row">
                <div class="col-md-6">
                    <div class="game-card">
                        <img src="images/civilization-ancient-times.jpg" alt="Civilization: Ancient Times">
                        <div class="game-card-content">
                            <h3>Civilization: Ancient Times</h3>
                            <p>Build your own civilization and lead it to greatness!</p>
                        </div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="game-card">
                        <img src="images/the-sims-life-simulation.jpg" alt="The Sims: Life Simulation">
                        <div class="game-card-content">
                            <h3>The Sims: Life Simulation</h3>
                            <p>Create and control your own virtual family!</p>
                        </div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="game-card">
                        <img src="images/grand-theft-auto-v-open-world.jpg" alt="Grand Theft Auto V: Open World">
                        <div class="game-card-content">
                            <h3>Grand Theft Auto V: Open World</h3>
                            <p>Explore a vast open world in this action-packed game!</p>
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