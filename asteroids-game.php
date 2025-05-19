<?php
// You can add PHP functionality here if needed
// For example, server-side session handling, user scores, etc.
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Asteroids - catn8.us</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
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

        body {
            font-family: 'Comic Neue', cursive;
            line-height: 1.6;
            color: var(--dark-color);
            background: linear-gradient(135deg, #4158D0, #C850C0);
            overflow-x: hidden;
            position: relative;
        }

        body::before {
            display: none;
        }

        .navbar {
            background: linear-gradient(135deg, #4158D0, #C850C0);
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

        .nav-link.active {
            background: rgba(255, 255, 255, 0.2);
            font-weight: 600;
        }

        .navbar-toggler {
            border: none;
            padding: 0.5rem;
        }

        .navbar-toggler:focus {
            box-shadow: none;
        }

        .navbar-toggler-icon {
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba(255, 255, 255, 1)' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e");
        }

        .container {
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
        }

        h1 {
            color: white;
            font-size: 2.5rem;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }

        p {
            font-size: 1.1rem;
            margin-bottom: 15px;
            color: white;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
        }

        .game-area {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 20px;
            margin-top: 20px;
            flex-wrap: nowrap;
        }

        .game-board {
            border: 5px solid #4158D0;
            border-radius: 10px;
            background-color: rgba(0, 0, 0, 0.8);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
            backdrop-filter: blur(10px);
            flex: 0 0 auto;
        }

        .game-sidebar {
            display: flex;
            flex-direction: column;
            gap: 20px;
            width: 250px;
            flex: 0 0 auto;
        }

        .controls, .game-stats {
            padding: 15px;
            background: rgba(255, 255, 255, 0.15);
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            border: 2px solid rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
            color: white;
        }

        .controls p, .game-stats p {
            font-weight: bold;
            margin-bottom: 10px;
            color: white;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
        }

        .stat {
            text-align: left;
            margin-bottom: 10px;
        }

        .stat span {
            font-weight: bold;
            color: var(--accent-color);
        }

        button {
            background: linear-gradient(135deg, #4158D0, #C850C0);
            color: white;
            border: none;
            padding: 10px 20px;
            margin: 5px 0;
            border-radius: 50px;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            font-family: inherit;
            display: block;
            width: 100%;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }

        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        }

        .joyful-message {
            padding: 15px;
            background: rgba(255, 255, 255, 0.15);
            border-radius: 10px;
            margin: 20px 0;
            border: 2px dashed var(--accent-color);
            color: white;
            backdrop-filter: blur(10px);
        }

        .how-to-play {
            margin-top: 15px;
            text-align: left;
        }

        .how-to-play ul {
            padding-left: 20px;
            margin-top: 10px;
            color: white;
        }

        .how-to-play li {
            margin-bottom: 5px;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
        }

        #lives-display {
            display: flex;
            justify-content: flex-start;
            gap: 5px;
            margin-top: 5px;
        }

        .life-icon {
            width: 20px;
            height: 20px;
            background-color: var(--accent-color);
            clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
        }

        @media (max-width: 1200px) {
            .game-area {
                flex-wrap: wrap;
                justify-content: center;
            }

            .game-sidebar {
                width: 100%;
                max-width: 300px;
                order: 3;
            }

            .game-sidebar:first-child {
                order: 1;
            }

            .game-board {
                order: 2;
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
                        <a class="nav-link" href="arcade.php">Arcade</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="activities.php">Activities</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <div class="container">
        <h1>Asteroids Adventure!</h1>
        
        <div class="game-area">
            <div class="game-sidebar">
                <div class="joyful-message">
                    <p>Welcome to our space adventure! Here at catn8.us, we believe exploring the stars brings friends together for exciting discoveries.</p>
                    <p>Every asteroid you blast is like overcoming a challenge - piece by piece, creating cosmic courage!</p>
                </div>
                
                <div class="joyful-message">
                    <p>Did you know? Asteroids helps improve hand-eye coordination and quick thinking skills!</p>
                </div>
            </div>

            <canvas id="asteroids" class="game-board" width="500" height="500"></canvas>
            
            <div class="game-sidebar">
                <div class="game-stats">
                    <div class="stat">
                        <p>Score: <span id="score">0</span></p>
                    </div>
                    <div class="stat">
                        <p>Level: <span id="level">1</span></p>
                    </div>
                    <div class="stat">
                        <p>Lives: </p>
                        <div id="lives-display"></div>
                    </div>
                </div>
                
                <div class="controls">
                    <p>Game Controls</p>
                    <button id="start-button">Start Game</button>
                    <button id="pause-button">Pause</button>
                    
                    <div class="how-to-play">
                        <p>How to play:</p>
                        <ul>
                            <li>← / → : Rotate ship</li>
                            <li>↑ : Thrust forward</li>
                            <li>Space : Fire lasers</li>
                            <li>Z : Shields (temporary)</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        // Get the canvas element and its context
        const canvas = document.getElementById('asteroids');
        const ctx = canvas.getContext('2d');
        const scoreElement = document.getElementById('score');
        const levelElement = document.getElementById('level');
        const livesDisplay = document.getElementById('lives-display');
        const startButton = document.getElementById('start-button');
        const pauseButton = document.getElementById('pause-button');
        
        // Game settings
        const FPS = 60;
        const FRICTION = 0.7; // friction coefficient (0 = no friction, 1 = lots of friction)
        const SHIP_SIZE = 20; // ship height in pixels
        const SHIP_THRUST = 5; // acceleration of the ship in pixels per second
        const TURN_SPEED = 360; // turn speed in degrees per second
        const LASER_MAX = 10; // maximum number of lasers on screen
        const LASER_SPEED = 500; // speed of lasers in pixels per second
        const LASER_DISTANCE = 0.6; // max distance laser can travel as a fraction of screen width
        const LASER_EXPLODE_DUR = 0.1; // duration of the laser's explosion in seconds
        const ASTEROID_NUM = 3; // starting number of asteroids
        const ASTEROID_SIZE = 100; // starting size of asteroids in pixels
        const ASTEROID_SPEED = 50; // max starting speed of asteroids in pixels per second
        const ASTEROID_VERT = 10; // average number of vertices on each asteroid
        const ASTEROID_JAG = 0.4; // jaggedness of the asteroids (0 = none, 1 = lots)
        const SHIP_EXPLODE_DUR = 1.5; // duration of the ship's explosion in seconds
        const SHIP_BLINK_DUR = 0.1; // duration of the ship's blink during invisibility
        const SHIP_INV_DUR = 3; // duration of the ship's invisibility in seconds
        const SHIELD_DUR = 3; // duration of shield power in seconds
        const SHIELD_COOLDOWN = 8; // cooldown time between shield uses in seconds
        const TEXT_FADE_TIME = 2.5; // text fade time in seconds
        const TEXT_SIZE = 40; // text font height in pixels
        const GAME_LIVES = 3; // starting number of lives
        const SOUND_ON = true; // whether sound effects are turned on or not
        
        // Game variables
        let ship;
        let asteroids = [];
        let lasers = [];
        let level;
        let lives;
        let score;
        let gameOver;
        let paused;
        let gameStarted = false;
        let lastTime = 0;
        let shieldActive = false;
        let shieldTimer = 0;
        let shieldCooldown = 0;
        let textAlpha = 0; // for fade in and out of text
        let animationId;
        
        // Set up the initial game state
        function setupGame() {
            score = 0;
            level = 1;
            lives = GAME_LIVES;
            gameOver = false;
            paused = false;
            
            updateLivesDisplay();
            createShip();
            createAsteroidBelt();
        }
        
        // Create a new ship
        function createShip() {
            ship = {
                x: canvas.width / 2,
                y: canvas.height / 2,
                radius: SHIP_SIZE / 2,
                angle: 90 / 180 * Math.PI, // Convert to radians
                rotation: 0,
                thrusting: false,
                thrust: {
                    x: 0,
                    y: 0
                },
                explodeTime: 0,
                blinkTime: Math.ceil(SHIP_BLINK_DUR * FPS),
                blinkNum: Math.ceil(SHIP_INV_DUR / SHIP_BLINK_DUR),
                canShoot: true,
                lasers: [],
                dead: false
            };
        }
        
        // Create the asteroid belt
        function createAsteroidBelt() {
            asteroids = [];
            let x, y;
            
            for (let i = 0; i < ASTEROID_NUM + level; i++) {
                // Ensure asteroids don't spawn too close to the ship
                do {
                    x = Math.random() * canvas.width;
                    y = Math.random() * canvas.height;
                } while (distBetweenPoints(ship.x, ship.y, x, y) < ASTEROID_SIZE * 2 + ship.radius);
                
                asteroids.push(newAsteroid(x, y, Math.ceil(ASTEROID_SIZE / 2)));
            }
        }
        
        // Create a new asteroid
        function newAsteroid(x, y, r) {
            let asteroid = {
                x: x,
                y: y,
                xv: Math.random() * ASTEROID_SPEED / FPS * (Math.random() < 0.5 ? 1 : -1),
                yv: Math.random() * ASTEROID_SPEED / FPS * (Math.random() < 0.5 ? 1 : -1),
                radius: r,
                angle: Math.random() * Math.PI * 2, // Random angle in radians
                vert: Math.floor(Math.random() * (ASTEROID_VERT + 1) + ASTEROID_VERT / 2),
                offs: []
            };
            
            // Create the vertex offsets array
            for (let i = 0; i < asteroid.vert; i++) {
                asteroid.offs.push(Math.random() * ASTEROID_JAG * 2 + 1 - ASTEROID_JAG);
            }
            
            return asteroid;
        }
        
        // Calculate the distance between two points
        function distBetweenPoints(x1, y1, x2, y2) {
            return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        }
        
        // Update the ship's position
        function updateShip(dt) {
            // Check for ship explosion
            if (ship.explodeTime > 0) {
                ship.explodeTime -= dt;
                
                if (ship.explodeTime <= 0) {
                    lives--;
                    updateLivesDisplay();
                    
                    if (lives === 0) {
                        gameOver = true;
                    } else {
                        ship.dead = false;
                        ship.x = canvas.width / 2;
                        ship.y = canvas.height / 2;
                        ship.thrust.x = 0;
                        ship.thrust.y = 0;
                        ship.angle = 90 / 180 * Math.PI;
                        ship.blinkNum = Math.ceil(SHIP_INV_DUR / SHIP_BLINK_DUR);
                        ship.blinkTime = Math.ceil(SHIP_BLINK_DUR * FPS);
                    }
                }
                
                return;
            }
            
            // Handle blinking during ship invulnerability
            if (ship.blinkNum > 0) {
                ship.blinkTime--;
                
                if (ship.blinkTime <= 0) {
                    ship.blinkTime = Math.ceil(SHIP_BLINK_DUR * FPS);
                    ship.blinkNum--;
                }
            }
            
            // Update the ship's position based on its velocity
            if (ship.thrusting && !ship.dead) {
                ship.thrust.x += SHIP_THRUST * Math.cos(ship.angle) / FPS;
                ship.thrust.y -= SHIP_THRUST * Math.sin(ship.angle) / FPS;
                
                // Draw thruster
                if (!paused) {
                    ctx.fillStyle = "orange";
                    ctx.strokeStyle = "yellow";
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo( // rear left
                        ship.x - ship.radius * (2 / 3) * Math.cos(ship.angle) + ship.radius * 0.5 * Math.sin(ship.angle),
                        ship.y + ship.radius * (2 / 3) * Math.sin(ship.angle) + ship.radius * 0.5 * Math.cos(ship.angle)
                    );
                    ctx.lineTo( // rear center (behind the ship)
                        ship.x - ship.radius * (5 / 3) * Math.cos(ship.angle),
                        ship.y + ship.radius * (5 / 3) * Math.sin(ship.angle)
                    );
                    ctx.lineTo( // rear right
                        ship.x - ship.radius * (2 / 3) * Math.cos(ship.angle) - ship.radius * 0.5 * Math.sin(ship.angle),
                        ship.y + ship.radius * (2 / 3) * Math.sin(ship.angle) - ship.radius * 0.5 * Math.cos(ship.angle)
                    );
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                }
            } else {
                // Apply friction to slow the ship down when not thrusting
                ship.thrust.x -= FRICTION * ship.thrust.x / FPS;
                ship.thrust.y -= FRICTION * ship.thrust.y / FPS;
            }
            
            // Update ship's position
            ship.x += ship.thrust.x;
            ship.y += ship.thrust.y;
            
            // Handle edge of screen wrapping
            if (ship.x < 0 - ship.radius) {
                ship.x = canvas.width + ship.radius;
            } else if (ship.x > canvas.width + ship.radius) {
                ship.x = 0 - ship.radius;
            }
            if (ship.y < 0 - ship.radius) {
                ship.y = canvas.height + ship.radius;
            } else if (ship.y > canvas.height + ship.radius) {
                ship.y = 0 - ship.radius;
            }
            
            // Update shield
            if (shieldActive) {
                shieldTimer -= dt;
                if (shieldTimer <= 0) {
                    shieldActive = false;
                    shieldCooldown = SHIELD_COOLDOWN;
                }
            } else if (shieldCooldown > 0) {
                shieldCooldown -= dt;
            }
            
            // Update ship rotation
            ship.angle += ship.rotation;
        }
        
        // Draw the ship
        function drawShip() {
            if (ship.dead) return;
            
            if (ship.blinkNum % 2 === 0 || ship.blinkNum === 0) {
                ctx.strokeStyle = "white";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo( // nose of the ship
                    ship.x + 4/3 * ship.radius * Math.cos(ship.angle),
                    ship.y - 4/3 * ship.radius * Math.sin(ship.angle)
                );
                ctx.lineTo( // rear left
                    ship.x - ship.radius * (2/3) * Math.cos(ship.angle) + ship.radius * Math.sin(ship.angle),
                    ship.y + ship.radius * (2/3) * Math.sin(ship.angle) + ship.radius * Math.cos(ship.angle)
                );
                ctx.lineTo( // rear right
                    ship.x - ship.radius * (2/3) * Math.cos(ship.angle) - ship.radius * Math.sin(ship.angle),
                    ship.y + ship.radius * (2/3) * Math.sin(ship.angle) - ship.radius * Math.cos(ship.angle)
                );
                ctx.closePath();
                ctx.stroke();
                
                // Draw shield if active
                if (shieldActive) {
                    ctx.strokeStyle = "#4ECDC4";
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(ship.x, ship.y, ship.radius * 1.5, 0, Math.PI * 2, false);
                    ctx.stroke();
                }
            }
        }
        
        // Shoot a laser from the ship
        function shootLaser() {
            if (ship.dead || !ship.canShoot) return;
            
            // Add a laser
            lasers.push({
                x: ship.x + 4/3 * ship.radius * Math.cos(ship.angle),
                y: ship.y - 4/3 * ship.radius * Math.sin(ship.angle),
                xv: LASER_SPEED * Math.cos(ship.angle) / FPS,
                yv: -LASER_SPEED * Math.sin(ship.angle) / FPS,
                dist: 0,
                explodeTime: 0
            });
            
            // Prevent rapid fire
            ship.canShoot = false;
            setTimeout(() => {
                ship.canShoot = true;
            }, 300);
        }
        
        // Update the lasers
        function updateLasers(dt) {
            for (let i = lasers.length - 1; i >= 0; i--) {
                // Check for laser explosion
                if (lasers[i].explodeTime > 0) {
                    lasers[i].explodeTime -= dt;
                    
                    if (lasers[i].explodeTime <= 0) {
                        lasers.splice(i, 1);
                        continue;
                    }
                } else {
                    // Move the laser
                    lasers[i].x += lasers[i].xv;
                    lasers[i].y += lasers[i].yv;
                    
                    // Calculate the distance traveled
                    lasers[i].dist += Math.sqrt(Math.pow(lasers[i].xv, 2) + Math.pow(lasers[i].yv, 2));
                    
                    // Remove the laser if it goes too far
                    if (lasers[i].dist > LASER_DISTANCE * canvas.width) {
                        lasers.splice(i, 1);
                        continue;
                    }
                    
                    // Handle edge of screen wrapping
                    if (lasers[i].x < 0) {
                        lasers[i].x = canvas.width;
                    } else if (lasers[i].x > canvas.width) {
                        lasers[i].x = 0;
                    }
                    if (lasers[i].y < 0) {
                        lasers[i].y = canvas.height;
                    } else if (lasers[i].y > canvas.height) {
                        lasers[i].y = 0;
                    }
                }
            }
        }
        
        // Draw the lasers
        function drawLasers() {
            for (let i = 0; i < lasers.length; i++) {
                if (lasers[i].explodeTime === 0) {
                    ctx.fillStyle = "#FF6B6B";
                    ctx.beginPath();
                    ctx.arc(lasers[i].x, lasers[i].y, SHIP_SIZE / 15, 0, Math.PI * 2, false);
                    ctx.fill();
                } else {
                    // Draw the explosion
                    ctx.fillStyle = "orangered";
                    ctx.beginPath();
                    ctx.arc(lasers[i].x, lasers[i].y, ship.radius * 0.75, 0, Math.PI * 2, false);
                    ctx.fill();
                    ctx.fillStyle = "salmon";
                    ctx.beginPath();
                    ctx.arc(lasers[i].x, lasers[i].y, ship.radius * 0.5, 0, Math.PI * 2, false);
                    ctx.fill();
                    ctx.fillStyle = "pink";
                    ctx.beginPath();
                    ctx.arc(lasers[i].x, lasers[i].y, ship.radius * 0.25, 0, Math.PI * 2, false);
                    ctx.fill();
                }
            }
        }
        
        // Draw the asteroids
        function drawAsteroids() {
            for (let i = 0; i < asteroids.length; i++) {
                ctx.strokeStyle = "white";
                ctx.lineWidth = 2;
                
                // Draw a path for the asteroid
                ctx.beginPath();
                ctx.moveTo(
                    asteroids[i].x + asteroids[i].radius * asteroids[i].offs[0] * Math.cos(asteroids[i].angle),
                    asteroids[i].y + asteroids[i].radius * asteroids[i].offs[0] * Math.sin(asteroids[i].angle)
                );
                
                // Draw the rest of the vertices
                for (let j = 1; j < asteroids[i].vert; j++) {
                    ctx.lineTo(
                        asteroids[i].x + asteroids[i].radius * asteroids[i].offs[j] * Math.cos(asteroids[i].angle + j * Math.PI * 2 / asteroids[i].vert),
                        asteroids[i].y + asteroids[i].radius * asteroids[i].offs[j] * Math.sin(asteroids[i].angle + j * Math.PI * 2 / asteroids[i].vert)
                    );
                }
                
                ctx.closePath();
                ctx.stroke();
            }
        }
        
        // Update the asteroids
        function updateAsteroids() {
            for (let i = 0; i < asteroids.length; i++) {
                // Move the asteroid
                asteroids[i].x += asteroids[i].xv;
                asteroids[i].y += asteroids[i].yv;
                
                // Handle edge of screen wrapping
                if (asteroids[i].x < 0 - asteroids[i].radius) {
                    asteroids[i].x = canvas.width + asteroids[i].radius;
                } else if (asteroids[i].x > canvas.width + asteroids[i].radius) {
                    asteroids[i].x = 0 - asteroids[i].radius;
                }
                if (asteroids[i].y < 0 - asteroids[i].radius) {
                    asteroids[i].y = canvas.height + asteroids[i].radius;
                } else if (asteroids[i].y > canvas.height + asteroids[i].radius) {
                    asteroids[i].y = 0 - asteroids[i].radius;
                }
            }
        }
        
        // Check for collisions
        function checkCollisions() {
            // Check for asteroid collisions (with lasers and with ship)
            for (let i = asteroids.length - 1; i >= 0; i--) {
                // Check for collisions with lasers
                for (let j = lasers.length - 1; j >= 0; j--) {
                    if (lasers[j].explodeTime === 0 && 
                        distBetweenPoints(asteroids[i].x, asteroids[i].y, lasers[j].x, lasers[j].y) < asteroids[i].radius) {
                        
                        // Destroy the asteroid and remove the laser
                        destroyAsteroid(i);
                        lasers[j].explodeTime = LASER_EXPLODE_DUR;
                        
                        break;
                    }
                }
                
                // Check for collisions with ship
                if (!ship.dead && ship.blinkNum === 0 && !shieldActive &&
                    distBetweenPoints(asteroids[i].x, asteroids[i].y, ship.x, ship.y) < ship.radius + asteroids[i].radius) {
                    
                    // Destroy the asteroid and explode the ship
                    destroyAsteroid(i);
                    explodeShip();
                    
                    break;
                }
            }
            
            // Check if all asteroids are gone
            if (asteroids.length === 0) {
                level++;
                textAlpha = 1.0;
                levelElement.textContent = level;
                createAsteroidBelt();
            }
        }
        
        // Destroy an asteroid and create new ones if it's large enough
        function destroyAsteroid(index) {
            const x = asteroids[index].x;
            const y = asteroids[index].y;
            const r = asteroids[index].radius;
            
            // Score is based on asteroid size
            if (r === Math.ceil(ASTEROID_SIZE / 2)) {
                score += 20;  // Large asteroid
            } else if (r === Math.ceil(ASTEROID_SIZE / 4)) {
                score += 50;  // Medium asteroid
            } else {
                score += 100; // Small asteroid
            }
            
            scoreElement.textContent = score;
            
            // Break the asteroid into smaller pieces if it's not the smallest size
            if (r > Math.ceil(ASTEROID_SIZE / 8)) {
                let num = 2;
                if (r === Math.ceil(ASTEROID_SIZE / 2)) {
                    num = 3;  // More fragments for large asteroids
                }
                
                for (let i = 0; i < num; i++) {
                    asteroids.push(newAsteroid(x, y, r / 2));
                }
            }
            
            // Remove the asteroid
            asteroids.splice(index, 1);
        }
        
        // Explode the ship
        function explodeShip() {
            ship.dead = true;
            ship.explodeTime = SHIP_EXPLODE_DUR;
        }
        
        // Draw game text
        function drawText() {
            if (textAlpha >= 0) {
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
                ctx.font = `${TEXT_SIZE}px Comic Neue`;
                
                if (gameOver) {
                    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
                    ctx.font = `${TEXT_SIZE * 0.6}px Comic Neue`;
                    ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2 + TEXT_SIZE);
                    ctx.fillText("Press 'Start Game' to play again!", canvas.width / 2, canvas.height / 2 + TEXT_SIZE * 2);
                } else if (level > 1 && textAlpha > 0) {
                    ctx.fillText(`Level ${level}`, canvas.width / 2, canvas.height * 0.25);
                }
                
                textAlpha -= (1.0 / TEXT_FADE_TIME / FPS);
            } else if (gameOver) {
                textAlpha = 1.0;
            }
        }
        
        // Draw level info and other details
        function drawHUD() {
            // Draw the score
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "white";
            ctx.font = "20px Comic Neue";
            ctx.fillText(`Score: ${score}`, canvas.width - 10, 25);
            
            // Draw the level
            ctx.textAlign = "left";
            ctx.fillText(`Level: ${level}`, 10, 25);
            
            // Draw shield cooldown indicator
            if (shieldActive) {
                ctx.textAlign = "center";
                ctx.fillStyle = "#4ECDC4";
                ctx.fillText(`Shield: ${Math.ceil(shieldTimer)}s`, canvas.width / 2, 25);
            } else if (shieldCooldown > 0) {
                ctx.textAlign = "center";
                ctx.fillStyle = "yellow";
                ctx.fillText(`Shield Recharging: ${Math.ceil(shieldCooldown)}s`, canvas.width / 2, 25);
            } else {
                ctx.textAlign = "center";
                ctx.fillStyle = "#4ECDC4";
                ctx.fillText(`Shield Ready (Press Z)`, canvas.width / 2, 25);
            }
        }
        
        // Update the lives display
        function updateLivesDisplay() {
            livesDisplay.innerHTML = '';
            for (let i = 0; i < lives; i++) {
                const lifeIcon = document.createElement('div');
                lifeIcon.className = 'life-icon';
                livesDisplay.appendChild(lifeIcon);
            }
        }
        
        // Start the game
        function startGame() {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
            
            // Reset the game state
            setupGame();
            gameStarted = true;
            gameOver = false;
            textAlpha = 1.0;
            lastTime = performance.now();
            
            // Update button text
            startButton.textContent = 'Restart Game';
            pauseButton.textContent = 'Pause';
            paused = false;
            
            // Start the game loop
            animationId = requestAnimationFrame(gameLoop);
        }

        // Draw explosions
        function drawExplosions() {
            // This can be left empty or implement explosion effects later
            // For now, we just need the function to exist so the game doesn't crash
        }
        
        // Main game loop
        function gameLoop(time) {
            // Calculate delta time
            const dt = (time - lastTime) / 1000;
            lastTime = time;
            
            // Clear the canvas
            ctx.fillStyle = "black";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            if (!gameStarted) {
                drawText();
                animationId = requestAnimationFrame(gameLoop);
                return;
            }
            
            // If game is paused, just redraw everything and return
            if (paused) {
                // Draw everything
                drawShip();
                drawLasers();
                drawAsteroids();
                drawExplosions();
                drawHUD();
                drawText();
                
                animationId = requestAnimationFrame(gameLoop);
                return;
            }
            
            if (gameOver) {
                drawText();
                animationId = requestAnimationFrame(gameLoop);
                return;
            }
            
            // Update the ship
            updateShip(dt);
            
            // Update the lasers
            updateLasers(dt);
            
            // Update the asteroids
            updateAsteroids();
            
            // Check for collisions
            checkCollisions();
            
            // Draw everything
            drawShip();
            drawLasers();
            drawAsteroids();
            drawExplosions();
            drawHUD();
            drawText();
            
            // Continue the game loop
            animationId = requestAnimationFrame(gameLoop);
        }
        
        // Pause the game
        function togglePause() {
            if (!gameStarted || gameOver) return;
            
            paused = !paused;
            pauseButton.textContent = paused ? 'Resume' : 'Pause';
        }
        
        // Handle keyboard controls
        function handleKeyDown(event) {
            if (gameOver) return;
            
            const key = event.key.toLowerCase();
            
            // Prevent default for arrow keys and space to avoid page scrolling
            if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
                event.preventDefault();
            }
            
            if (key === 'arrowleft' || key === 'a') {
                ship.rotation = TURN_SPEED / 180 * Math.PI / FPS;
            } else if (key === 'arrowright' || key === 'd') {
                ship.rotation = -TURN_SPEED / 180 * Math.PI / FPS;
            } else if (key === 'arrowup' || key === 'w') {
                ship.thrusting = true;
            } else if (key === ' ') {
                shootLaser();
            } else if (key === 'z' && !shieldActive && shieldCooldown <= 0 && !ship.dead) {
                shieldActive = true;
                shieldTimer = SHIELD_DUR;
            } else if (key === 'p') {
                togglePause();
            }
        }
        
        function handleKeyUp(event) {
            const key = event.key.toLowerCase();
            
            if (key === 'arrowleft' || key === 'arrowright' || key === 'a' || key === 'd') {
                ship.rotation = 0;
            } else if (key === 'arrowup' || key === 'w') {
                ship.thrusting = false;
            }
        }
        
        // Event listeners
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        startButton.addEventListener('click', startGame);
        pauseButton.addEventListener('click', togglePause);
        
        // Draw initial text
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "white";
        ctx.font = `${TEXT_SIZE}px Comic Neue`;
        ctx.fillText("ASTEROIDS", canvas.width / 2, canvas.height / 2 - TEXT_SIZE);
        ctx.font = `${TEXT_SIZE * 0.6}px Comic Neue`;
        ctx.fillText("Press 'Start Game' to begin your space adventure!", canvas.width / 2, canvas.height / 2);
        
        // Draw a sample ship
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        
        const sampleShipX = canvas.width / 2;
        const sampleShipY = canvas.height / 2 + TEXT_SIZE * 2;
        const sampleShipSize = SHIP_SIZE;
        const sampleShipAngle = 90 / 180 * Math.PI;
        
        ctx.beginPath();
        ctx.moveTo( // nose of the ship
            sampleShipX + 4/3 * sampleShipSize / 2 * Math.cos(sampleShipAngle),
            sampleShipY - 4/3 * sampleShipSize / 2 * Math.sin(sampleShipAngle)
        );
        ctx.lineTo( // rear left
            sampleShipX - sampleShipSize / 2 * (2/3) * Math.cos(sampleShipAngle) + sampleShipSize / 2 * Math.sin(sampleShipAngle),
            sampleShipY + sampleShipSize / 2 * (2/3) * Math.sin(sampleShipAngle) + sampleShipSize / 2 * Math.cos(sampleShipAngle)
        );
        ctx.lineTo( // rear right
            sampleShipX - sampleShipSize / 2 * (2/3) * Math.cos(sampleShipAngle) - sampleShipSize / 2 * Math.sin(sampleShipAngle),
            sampleShipY + sampleShipSize / 2 * (2/3) * Math.sin(sampleShipAngle) - sampleShipSize / 2 * Math.cos(sampleShipAngle)
        );
        ctx.closePath();
        ctx.stroke();

        <?php
        // You can add PHP-generated JavaScript here if needed
        // For example, loading saved scores from a database
        ?>
    </script>
</body>
</html>