<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Games - catn8.us</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/aos/2.3.4/aos.css">
    <style>
        :root {
            --primary-color: #FF6B6B;
            --secondary-color: #4ECDC4;
            --accent-color: #FFE66D;
            --dark-color: #2C3E50;
            --light-color: #F7F9FC;
        }

        body {
            font-family: 'Comic Sans MS', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: var(--dark-color);
            background-color: var(--light-color);
            background-image: url('images/pattern.svg');
            background-size: 200px;
            background-repeat: repeat;
        }

        .navbar {
            background: rgba(255, 255, 255, 0.95);
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }

        .navbar-brand img {
            height: 40px;
        }

        .navbar-dark .navbar-nav .nav-link {
            color: var(--dark-color) !important;
            font-weight: 700;
            font-size: 20px;
            padding: 0.5rem 1rem;
            transition: color 0.3s ease;
        }

        .navbar-dark .navbar-nav .nav-link:hover {
            color: var(--primary-color) !important;
        }

        .navbar-dark .navbar-nav .nav-link.active {
            color: var(--primary-color) !important;
            font-weight: 600;
        }

        .navbar-toggler {
            border-color: var(--dark-color);
        }

        .navbar-toggler-icon {
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba(44, 62, 80, 1)' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e");
        }

        .hero {
            background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
            color: white;
            padding: 8rem 0 4rem;
            position: relative;
            overflow: hidden;
        }

        .hero h1 {
            font-size: 3.5rem;
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }

        .hero p {
            font-size: 1.5rem;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
        }

        .games-section {
            padding: 5rem 0;
            background: var(--light-color);
        }

        .game-card {
            background: white;
            border-radius: 20px;
            padding: 1.5rem;
            margin-bottom: 2rem;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            transition: all 0.5s ease;
            cursor: pointer;
            border: 3px solid transparent;
            position: relative;
            overflow: hidden;
            height: auto;
            min-height: 429px;
            display: flex;
            flex-direction: column;
            width: 100%;
        }

        .game-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            width: 100%;
        }

        .game-image {
            width: 100%;
            height: 214px;
            object-fit: cover;
            border-radius: 15px;
            margin-bottom: 1rem;
            border: 3px solid var(--accent-color);
        }

        .game-card h3 {
            font-size: 1.2rem;
            margin-bottom: 0.5rem;
            color: #5DBCB3;
            font-weight: bold;
        }

        .game-card p {
            font-size: 0.9rem;
            color: var(--dark-color);
            margin-bottom: 0.5rem;
            flex-grow: 1;
            overflow: visible;
            display: block;
        }

        .game-platforms {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin-top: 0.5rem;
        }

        .platform {
            background: var(--accent-color);
            color: var(--primary-color);
            padding: 0.25rem 0.75rem;
            border-radius: 15px;
            font-size: 0.8rem;
        }

        .game-category {
            color: var(--primary-color);
            font-size: 0.9rem;
            margin-bottom: 0.5rem;
        }

        .game-tag {
            display: inline-block;
            padding: 0.5rem 1rem;
            background: var(--accent-color);
            color: var(--dark-color);
            border-radius: 20px;
            font-size: 1rem;
            margin-right: 0.5rem;
            margin-bottom: 0.5rem;
            font-weight: bold;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }

        .game-platform {
            font-size: 0.9rem;
            color: var(--primary-color);
            margin-top: 0.5rem;
        }

        .age-badge {
            position: absolute;
            top: 10px;
            right: 10px;
            background: var(--primary-color);
            color: white;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 0.8rem;
            font-weight: bold;
            z-index: 1;
        }

        @keyframes float {
            0% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
            100% { transform: translateY(0); }
        }

        .floating {
            animation: float 3s ease-in-out infinite;
        }

        .filter-menu {
            position: fixed;
            right: 20px;
            top: 100px;
            z-index: 1000;
            background: white;
            padding: 20px;
            border-radius: 20px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            border: 3px solid var(--accent-color);
        }

        .filter-menu button {
            margin: 15px 0;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 1.2rem;
            padding: 10px;
            border-radius: 15px;
            text-align: center;
            width: 100%;
            border: none;
            background: transparent;
            color: var(--dark-color);
        }

        .filter-menu button:hover {
            background: var(--accent-color);
            transform: scale(1.1);
            color: white;
        }

        .filter-menu button.active {
            background: var(--primary-color);
            color: white;
            transform: scale(1.1);
        }

        .game-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            border-color: var(--accent-color);
        }
    </style>
</head>
<body>
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

    <section class="games-section">
        <div class="container">
            <div class="row">
                <div class="col-12">
                    <!-- Filter menu will be fixed on the right, outside the grid -->
                </div>
            </div>

            <!-- Fixed Filter Menu -->
            <div class="filter-menu" data-aos="fade-left">
                <div class="d-flex flex-column gap-2">
                    <button class="btn active" data-filter="all">All Games</button>
                    <button class="btn" data-filter="3-7">Ages 3-7</button>
                    <button class="btn" data-filter="8-12">Ages 8-12</button>
                    <button class="btn" data-filter="13">Ages 13+</button>
                    <button class="btn" data-filter="educational">Educational</button>
                    <button class="btn" data-filter="simulation">Simulation</button>
                    <button class="btn" data-filter="adventure">Adventure</button>
                    <button class="btn" data-filter="strategy">Strategy</button>
                </div>
            </div>

            <!-- Ages 3-7 Games -->
            <div class="row">
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="100" data-age="3-7" data-category="educational">
                    <div class="game-card">
                        <div class="game-content" onclick="window.open('https://pbskids.org/games', '_blank')">
                            <span class="age-badge">Ages 3-7</span>
                            <div class="game-image">
                                <svg width="100%" height="200" viewBox="0 0 400 200">
                                    <rect width="100%" height="100%" fill="#4ECDC4"/>
                                    <text x="50%" y="50%" font-family="Comic Sans MS" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">PBS Kids Games</text>
                                </svg>
                            </div>
                            <div class="game-category">Educational</div>
                            <h3>PBS Kids Games</h3>
                            <p>Educational games featuring beloved PBS Kids characters, perfect for early learning.</p>
                            <div class="game-platforms">
                                <span class="platform">Web</span>
                                <span class="platform">Mobile</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="200" data-age="3-7" data-category="educational">
                    <div class="game-card">
                        <div class="game-content" onclick="window.open('https://www.nickjr.com/games/', '_blank')">
                            <span class="age-badge">Ages 3-7</span>
                            <div class="game-image">
                                <svg width="100%" height="200" viewBox="0 0 400 200">
                                    <rect width="100%" height="100%" fill="#FF6B6B"/>
                                    <text x="50%" y="50%" font-family="Comic Sans MS" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">Nick Jr. Games</text>
                                </svg>
                            </div>
                            <div class="game-category">Educational</div>
                            <h3>Nick Jr. Games</h3>
                            <p>Fun and educational games featuring popular Nick Jr. characters.</p>
                            <div class="game-platforms">
                                <span class="platform">Web</span>
                                <span class="platform">Mobile</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="300" data-age="3-7" data-category="educational">
                    <div class="game-card">
                        <div class="game-content" onclick="window.open('https://www.starfall.com/', '_blank')">
                            <span class="age-badge">Ages 3-7</span>
                            <div class="game-image">
                                <svg width="100%" height="200" viewBox="0 0 400 200">
                                    <rect width="100%" height="100%" fill="#FFE66D"/>
                                    <text x="50%" y="50%" font-family="Comic Sans MS" font-size="24" fill="#2C3E50" text-anchor="middle" dominant-baseline="middle">Starfall</text>
                                </svg>
                            </div>
                            <div class="game-category">Educational</div>
                            <h3>Starfall</h3>
                            <p>Interactive reading and math games for early learners.</p>
                            <div class="game-platforms">
                                <span class="platform">Web</span>
                                <span class="platform">Mobile</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Ages 8-12 Games -->
            <div class="row">
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="100" data-age="8-12" data-category="educational">
                    <div class="game-card">
                        <div class="game-content" onclick="window.open('https://www.coolmathgames.com/', '_blank')">
                            <span class="age-badge">Ages 8-12</span>
                            <div class="game-image">
                                <svg width="100%" height="200" viewBox="0 0 400 200">
                                    <rect width="100%" height="100%" fill="#4ECDC4"/>
                                    <text x="50%" y="50%" font-family="Comic Sans MS" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">Cool Math Games</text>
                                </svg>
                            </div>
                            <div class="game-category">Educational</div>
                            <h3>Cool Math Games</h3>
                            <p>Fun math games and puzzles that make learning enjoyable.</p>
                            <div class="game-platforms">
                                <span class="platform">Web</span>
                                <span class="platform">Mobile</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="200" data-age="8-12" data-category="educational">
                    <div class="game-card">
                        <div class="game-content" onclick="window.open('https://www.abcya.com/', '_blank')">
                            <span class="age-badge">Ages 8-12</span>
                            <div class="game-image">
                                <svg width="100%" height="200" viewBox="0 0 400 200">
                                    <rect width="100%" height="100%" fill="#FF6B6B"/>
                                    <text x="50%" y="50%" font-family="Comic Sans MS" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">ABCya!</text>
                                </svg>
                            </div>
                            <div class="game-category">Educational</div>
                            <h3>ABCya!</h3>
                            <p>Educational games and activities for elementary school students.</p>
                            <div class="game-platforms">
                                <span class="platform">Web</span>
                                <span class="platform">Mobile</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="300" data-age="8-12" data-category="educational">
                    <div class="game-card">
                        <div class="game-content" onclick="window.open('https://www.prodigygame.com/', '_blank')">
                            <span class="age-badge">Ages 8-12</span>
                            <div class="game-image">
                                <svg width="100%" height="200" viewBox="0 0 400 200">
                                    <rect width="100%" height="100%" fill="#FFE66D"/>
                                    <text x="50%" y="50%" font-family="Comic Sans MS" font-size="24" fill="#2C3E50" text-anchor="middle" dominant-baseline="middle">Prodigy Math</text>
                                </svg>
                            </div>
                            <div class="game-category">Educational</div>
                            <h3>Prodigy Math</h3>
                            <p>RPG-style math game that adapts to your child's learning level.</p>
                            <div class="game-platforms">
                                <span class="platform">Web</span>
                                <span class="platform">Mobile</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="100" data-age="8-12" data-category="simulation">
                    <div class="game-card">
                        <span class="age-badge">Ages 8-12</span>
                        <div class="game-image">
                            <svg width="100%" height="200" viewBox="0 0 400 200">
                                <rect width="100%" height="100%" fill="#4ECDC4"/>
                                <text x="50%" y="50%" font-family="Comic Sans MS" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">Animal Crossing</text>
                            </svg>
                        </div>
                        <div class="game-category">Simulation</div>
                        <h3>Animal Crossing</h3>
                        <p>Create your own island paradise and make friends with adorable animal villagers.</p>
                        <div class="game-platforms">
                            <span class="platform">Nintendo Switch</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="200" data-age="8-12" data-category="simulation">
                    <div class="game-card">
                        <span class="age-badge">Ages 8-12</span>
                        <div class="game-image">
                            <svg width="100%" height="200" viewBox="0 0 400 200">
                                <rect width="100%" height="100%" fill="#FF6B6B"/>
                                <text x="50%" y="50%" font-family="Comic Sans MS" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">Stardew Valley</text>
                            </svg>
                        </div>
                        <div class="game-category">Simulation</div>
                        <h3>Stardew Valley</h3>
                        <p>Build your farm, make friends, and explore a charming rural world.</p>
                        <div class="game-platforms">
                            <span class="platform">PC</span>
                            <span class="platform">Console</span>
                            <span class="platform">Mobile</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="300" data-age="8-12" data-category="simulation">
                    <div class="game-card">
                        <span class="age-badge">Ages 8-12</span>
                        <div class="game-image">
                            <svg width="100%" height="200" viewBox="0 0 400 200">
                                <rect width="100%" height="100%" fill="#FFE66D"/>
                                <text x="50%" y="50%" font-family="Comic Sans MS" font-size="24" fill="#2C3E50" text-anchor="middle" dominant-baseline="middle">Overcooked</text>
                            </svg>
                        </div>
                        <div class="game-category">Co-op</div>
                        <h3>Overcooked</h3>
                        <p>Work together in chaotic kitchen scenarios to prepare meals against the clock.</p>
                        <div class="game-platforms">
                            <span class="platform">PC</span>
                            <span class="platform">Console</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Ages 13+ Games -->
            <div class="row">
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="100" data-age="13" data-category="adventure">
                    <div class="game-card">
                        <div class="game-content" onclick="window.open('https://www.minecraft.net/', '_blank')">
                            <span class="age-badge">Ages 13+</span>
                            <div class="game-image">
                                <svg width="100%" height="200" viewBox="0 0 400 200">
                                    <rect width="100%" height="100%" fill="#4ECDC4"/>
                                    <text x="50%" y="50%" font-family="Comic Sans MS" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">Minecraft</text>
                                </svg>
                            </div>
                            <div class="game-category">Adventure</div>
                            <h3>Minecraft</h3>
                            <p>Build, explore, and survive in a blocky world of endless possibilities.</p>
                            <div class="game-platforms">
                                <span class="platform">PC</span>
                                <span class="platform">Console</span>
                                <span class="platform">Mobile</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="200" data-age="13" data-category="adventure">
                    <div class="game-card">
                        <div class="game-content" onclick="window.open('https://www.roblox.com/', '_blank')">
                            <span class="age-badge">Ages 13+</span>
                            <div class="game-image">
                                <svg width="100%" height="200" viewBox="0 0 400 200">
                                    <rect width="100%" height="100%" fill="#FF6B6B"/>
                                    <text x="50%" y="50%" font-family="Comic Sans MS" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">Roblox</text>
                                </svg>
                            </div>
                            <div class="game-category">Adventure</div>
                            <h3>Roblox</h3>
                            <p>Create and play games with friends in a social gaming platform.</p>
                            <div class="game-platforms">
                                <span class="platform">PC</span>
                                <span class="platform">Console</span>
                                <span class="platform">Mobile</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="300" data-age="13" data-category="adventure">
                    <div class="game-card">
                        <div class="game-content" onclick="window.open('https://www.lego.com/en-us/games', '_blank')">
                            <span class="age-badge">Ages 13+</span>
                            <div class="game-image">
                                <svg width="100%" height="200" viewBox="0 0 400 200">
                                    <rect width="100%" height="100%" fill="#FFE66D"/>
                                    <text x="50%" y="50%" font-family="Comic Sans MS" font-size="24" fill="#2C3E50" text-anchor="middle" dominant-baseline="middle">LEGO Games</text>
                                </svg>
                            </div>
                            <div class="game-category">Adventure</div>
                            <h3>LEGO Games</h3>
                            <p>Fun adventures with your favorite LEGO themes and characters.</p>
                            <div class="game-platforms">
                                <span class="platform">PC</span>
                                <span class="platform">Console</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="100" data-age="13" data-category="strategy">
                    <div class="game-card">
                        <div class="game-content" onclick="window.open('https://www.civilization.com/', '_blank')">
                            <span class="age-badge">Ages 13+</span>
                            <div class="game-image">
                                <svg width="100%" height="200" viewBox="0 0 400 200">
                                    <rect width="100%" height="100%" fill="#4A90E2"/>
                                    <text x="50%" y="50%" font-family="Comic Sans MS" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">Civilization</text>
                                </svg>
                            </div>
                            <div class="game-category">Strategy</div>
                            <h3>Civilization</h3>
                            <p>Build and lead your civilization from ancient times to the modern era.</p>
                            <div class="game-platforms">
                                <span class="platform">PC</span>
                                <span class="platform">Console</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="200" data-age="13" data-category="strategy">
                    <div class="game-card">
                        <div class="game-content" onclick="window.open('https://www.ea.com/games/sims', '_blank')">
                            <span class="age-badge">Ages 13+</span>
                            <div class="game-image">
                                <svg width="100%" height="200" viewBox="0 0 400 200">
                                    <rect width="100%" height="100%" fill="#FF9F1C"/>
                                    <text x="50%" y="50%" font-family="Comic Sans MS" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">The Sims</text>
                                </svg>
                            </div>
                            <div class="game-category">Simulation</div>
                            <h3>The Sims</h3>
                            <p>Create and control virtual people in a life simulation game.</p>
                            <div class="game-platforms">
                                <span class="platform">PC</span>
                                <span class="platform">Console</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4 mb-4" data-aos="fade-up" data-aos-delay="300" data-age="13" data-category="strategy">
                    <div class="game-card">
                        <div class="game-content" onclick="window.open('https://www.rockstargames.com/gta-v', '_blank')">
                            <span class="age-badge">Ages 13+</span>
                            <div class="game-image">
                                <svg width="100%" height="200" viewBox="0 0 400 200">
                                    <rect width="100%" height="100%" fill="#2C3E50"/>
                                    <text x="50%" y="50%" font-family="Comic Sans MS" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">Grand Theft Auto V</text>
                                </svg>
                            </div>
                            <div class="game-category">Adventure</div>
                            <h3>Grand Theft Auto V</h3>
                            <p>Open-world action-adventure game set in the fictional city of Los Santos.</p>
                            <div class="game-platforms">
                                <span class="platform">PC</span>
                                <span class="platform">Console</span>
                            </div>
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

        // Filter functionality
        document.querySelectorAll('.filter-menu button').forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from all buttons
                document.querySelectorAll('.filter-menu button').forEach(btn => {
                    btn.classList.remove('active');
                });
                // Add active class to clicked button
                this.classList.add('active');

                const filter = this.getAttribute('data-filter');
                const items = document.querySelectorAll('[data-age], [data-category]');

                items.forEach(item => {
                    if (filter === 'all') {
                        item.style.display = 'block';
                    } else {
                        const age = item.getAttribute('data-age');
                        const category = item.getAttribute('data-category');
                        if (age === filter || category === filter) {
                            item.style.display = 'block';
                        } else {
                            item.style.display = 'none';
                        }
                    }
                });
            });
        });

        // Handle image loading errors
        document.querySelectorAll('.game-image').forEach(img => {
            img.onerror = function() {
                this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23FF6B6B"/><text x="50" y="50" font-family="Arial" font-size="12" fill="white" text-anchor="middle" dy=".3em">Image not available</text></svg>';
            };
        });
    </script>
</body>
</html> 