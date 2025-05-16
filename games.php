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
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
            cursor: pointer;
            border: 3px solid transparent;
            position: relative;
            overflow: hidden;
            text-decoration: none;
            color: var(--dark-color);
            display: block;
        }

        .game-card:hover {
            transform: translateY(-10px) scale(1.02);
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            border-color: var(--accent-color);
            color: var(--dark-color);
            text-decoration: none;
        }

        .game-image {
            width: 100%;
            height: 200px;
            object-fit: cover;
            border-radius: 15px;
            margin-bottom: 1rem;
            border: 3px solid var(--accent-color);
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

        .game-description {
            font-size: 1.1rem;
            margin-top: 1rem;
            color: var(--dark-color);
        }

        .game-platform {
            font-size: 0.9rem;
            color: var(--primary-color);
            margin-top: 0.5rem;
        }

        @keyframes float {
            0% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
            100% { transform: translateY(0); }
        }

        .floating {
            animation: float 3s ease-in-out infinite;
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
                        <a class="nav-link" href="stories.php">Stories</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="about.php">About</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link active" href="games.php">Games</a>
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

    <section class="hero">
        <div class="container">
            <div class="row justify-content-center">
                <div class="col-md-8 text-center" data-aos="fade-up">
                    <h1>Family Games</h1>
                    <p class="lead">Discover a collection of fun and engaging games that bring families together. From classic favorites to modern adventures, there's something for everyone to enjoy.</p>
                </div>
            </div>
        </div>
    </section>

    <section class="games-section">
        <div class="container">
            <!-- Ages 3-7 Section -->
            <div class="age-group mb-5" data-aos="fade-up">
                <h2 class="text-center mb-4">Ages 3-7</h2>
                <div class="row">
                    <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                        <a href="https://pbskids.org/games" target="_blank" class="game-card">
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
                        </a>
                    </div>
                    <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                        <a href="https://www.nickjr.com/games/" target="_blank" class="game-card">
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
                        </a>
                    </div>
                    <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                        <a href="https://www.starfall.com/" target="_blank" class="game-card">
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
                        </a>
                    </div>
                </div>
            </div>

            <!-- Ages 8-12 Section -->
            <div class="age-group mb-5" data-aos="fade-up">
                <h2 class="text-center mb-4">Ages 8-12</h2>
                <div class="row">
                    <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                        <a href="https://www.coolmathgames.com/" target="_blank" class="game-card">
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
                        </a>
                    </div>
                    <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                        <a href="https://www.abcya.com/" target="_blank" class="game-card">
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
                        </a>
                    </div>
                    <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                        <a href="https://www.prodigygame.com/" target="_blank" class="game-card">
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
                        </a>
                    </div>
                    <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                        <div class="game-card">
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
                    <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                        <div class="game-card">
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
                    <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                        <div class="game-card">
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
            </div>

            <!-- Ages 13+ Section -->
            <div class="age-group" data-aos="fade-up">
                <h2 class="text-center mb-4">Ages 13+</h2>
                <div class="row">
                    <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                        <a href="https://www.minecraft.net/" target="_blank" class="game-card">
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
                            </div>
                        </a>
                    </div>
                    <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                        <a href="https://www.roblox.com/" target="_blank" class="game-card">
                            <div class="game-image">
                                <svg width="100%" height="200" viewBox="0 0 400 200">
                                    <rect width="100%" height="100%" fill="#FF6B6B"/>
                                    <text x="50%" y="50%" font-family="Comic Sans MS" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">Roblox</text>
                                </svg>
                            </div>
                            <div class="game-category">Social</div>
                            <h3>Roblox</h3>
                            <p>Create, play, and share games with friends in this social gaming platform.</p>
                            <div class="game-platforms">
                                <span class="platform">PC</span>
                                <span class="platform">Console</span>
                            </div>
                        </a>
                    </div>
                    <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                        <a href="https://www.lego.com/en-us/games" target="_blank" class="game-card">
                            <div class="game-image">
                                <svg width="100%" height="200" viewBox="0 0 400 200">
                                    <rect width="100%" height="100%" fill="#FFE66D"/>
                                    <text x="50%" y="50%" font-family="Comic Sans MS" font-size="24" fill="#2C3E50" text-anchor="middle" dominant-baseline="middle">LEGO Games</text>
                                </svg>
                            </div>
                            <div class="game-category">Adventure</div>
                            <h3>LEGO Games</h3>
                            <p>Fun adventures featuring your favorite LEGO themes and characters.</p>
                            <div class="game-platforms">
                                <span class="platform">PC</span>
                                <span class="platform">Console</span>
                            </div>
                        </a>
                    </div>
                    <div class="col-md-4" data-aos="fade-up" data-aos-delay="100">
                        <div class="game-card">
                            <div class="game-image">
                                <svg width="100%" height="200" viewBox="0 0 400 200">
                                    <rect width="100%" height="100%" fill="#4ECDC4"/>
                                    <text x="50%" y="50%" font-family="Comic Sans MS" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">Factorio</text>
                                </svg>
                            </div>
                            <div class="game-category">Strategy</div>
                            <h3>Factorio</h3>
                            <p>Build and optimize automated factories in this complex strategy game.</p>
                            <div class="game-platforms">
                                <span class="platform">PC</span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4" data-aos="fade-up" data-aos-delay="200">
                        <div class="game-card">
                            <div class="game-image">
                                <svg width="100%" height="200" viewBox="0 0 400 200">
                                    <rect width="100%" height="100%" fill="#FF6B6B"/>
                                    <text x="50%" y="50%" font-family="Comic Sans MS" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle">Civilization VI</text>
                                </svg>
                            </div>
                            <div class="game-category">Strategy</div>
                            <h3>Civilization VI</h3>
                            <p>Lead your civilization from the Stone Age to the Information Age.</p>
                            <div class="game-platforms">
                                <span class="platform">PC</span>
                                <span class="platform">Console</span>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-4" data-aos="fade-up" data-aos-delay="300">
                        <div class="game-card">
                            <div class="game-image">
                                <svg width="100%" height="200" viewBox="0 0 400 200">
                                    <rect width="100%" height="100%" fill="#FFE66D"/>
                                    <text x="50%" y="50%" font-family="Comic Sans MS" font-size="24" fill="#2C3E50" text-anchor="middle" dominant-baseline="middle">Oxygen Not Included</text>
                                </svg>
                            </div>
                            <div class="game-category">Simulation</div>
                            <h3>Oxygen Not Included</h3>
                            <p>Manage a space colony and keep your duplicants alive in this survival game.</p>
                            <div class="game-platforms">
                                <span class="platform">PC</span>
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

        // Handle image loading errors
        document.querySelectorAll('.game-image').forEach(img => {
            img.onerror = function() {
                this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23FF6B6B"/><text x="50" y="50" font-family="Arial" font-size="12" fill="white" text-anchor="middle" dy=".3em">Image not available</text></svg>';
            };
        });
    </script>
</body>
</html> 