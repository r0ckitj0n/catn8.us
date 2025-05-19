<?php
// You can add PHP functionality here if needed
// For example, server-side session handling, user scores, etc.
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Frogger - catn8.us</title>
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
            --fun-blue: #3498DB;
        }

        body {
            font-family: 'Comic Neue', cursive;
            line-height: 1.6;
            color: var(--dark-color);
            background: linear-gradient(135deg, var(--fun-blue), var(--fun-green));
            overflow-x: hidden;
            position: relative;
        }

        body::before {
            display: none;
        }

        .navbar {
            background: linear-gradient(135deg, var(--fun-blue), var(--fun-green));
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
            border: 5px solid var(--fun-blue);
            border-radius: 10px;
            background-color: rgba(0, 0, 0, 0.1);
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
            background: linear-gradient(135deg, var(--fun-blue), var(--fun-green));
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
            border-radius: 50%;
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
        <h1>Frogger Adventure!</h1>
        
        <div class="game-area">
            <div class="game-sidebar">
                <div class="joyful-message">
                    <p>Welcome to our Frogger adventure! Here at catn8.us, we believe every hop and leap takes us closer to new friends and exciting places.</p>
                    <p>Just like our frog friend, sometimes we need courage to navigate life's busy roads and tricky waters!</p>
                </div>
                
                <div class="joyful-message">
                    <p>Did you know? Frogger helps improve focus, timing skills, and teaches us about planning ahead!</p>
                </div>
            </div>

            <canvas id="frogger" class="game-board" width="480" height="520"></canvas>
            
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
                    <div class="stat">
                        <p>Time: <span id="time">30</span></p>
                    </div>
                </div>
                
                <div class="controls">
                    <p>Game Controls</p>
                    <button id="start-button">Start Game</button>
                    <button id="pause-button">Pause</button>
                    
                    <div class="how-to-play">
                        <p>How to play:</p>
                        <ul>
                            <li>↑↓←→ : Move frog</li>
                            <li>Get to the lily pads!</li>
                            <li>Avoid cars and water</li>
                            <li>Ride logs and turtles</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        // Get the canvas element and its context
        const canvas = document.getElementById('frogger');
        const ctx = canvas.getContext('2d');
        const scoreElement = document.getElementById('score');
        const levelElement = document.getElementById('level');
        const livesDisplay = document.getElementById('lives-display');
        const timeElement = document.getElementById('time');
        const startButton = document.getElementById('start-button');
        const pauseButton = document.getElementById('pause-button');
        
        // Game settings
        const GRID_SIZE = 40;
        const GAME_WIDTH = 480;
        const GAME_HEIGHT = 520;
        const STARTING_LIVES = 3;
        const LEVEL_TIME = 600; // 10 minutes in seconds
        const FROG_START_X = Math.floor(GAME_WIDTH / 2) - GRID_SIZE / 2;
        const FROG_START_Y = GAME_HEIGHT - GRID_SIZE;
        
        // Base speeds for game elements (reduced from original values)
        const BASE_SPEEDS = {
            car1: 0.4,    // Slow cars
            car2: 0.6,    // Medium cars
            car3: 0.8,    // Fast cars
            car4: 0.3,    // Very slow trucks
            log1: 0.5,    // Short logs
            log2: 0.4,    // Long logs
            turtle1: 0.4, // First turtle group
            turtle2: 0.5  // Second turtle group
        };
        
        // Speed increase per level (reduced from original)
        const SPEED_INCREASE_PER_LEVEL = 0.05;
        
        // Colors for the game
        const COLORS = {
            water: '#3498DB',
            road: '#34495E',
            grass: '#2ECC71',
            median: '#F1C40F',
            car1: '#E74C3C',
            car2: '#9B59B6',
            car3: '#E67E22',
            car4: '#1ABC9C',
            log: '#795548',
            turtle: '#27AE60',
            frog: '#4ECDC4',
            lilyPad: '#2ECC71',
            text: '#ffffff'
        };
        
        // Game state
        let frog = {};
        let cars = [];
        let logs = [];
        let turtles = [];
        let lilyPads = [];
        let level = 1;
        let lives = STARTING_LIVES;
        let score = 0;
        let timeLeft = LEVEL_TIME;
        let gameStarted = false;
        let paused = false;
        let gameOver = false;
        let animationId;
        let lastTime = 0;
        let timer;
        
        // Initialize the game
        function setupGame() {
            // Reset game state
            level = 1;
            lives = STARTING_LIVES;
            score = 0;
            timeLeft = LEVEL_TIME;
            gameOver = false;
            paused = false;
            
            // Update display
            scoreElement.textContent = score;
            levelElement.textContent = level;
            updateLivesDisplay();
            timeElement.textContent = timeLeft;
            
            // Create the frog
            resetFrog();
            
            // Setup obstacles and safe areas
            setupLevel();
            
            // Start the timer
            if (timer) clearInterval(timer);
            timer = setInterval(() => {
                if (gameStarted && !paused && !gameOver) {
                    timeLeft--;
                    timeElement.textContent = timeLeft;
                    
                    if (timeLeft <= 0) {
                        loseLife();
                        timeLeft = LEVEL_TIME;
                        timeElement.textContent = timeLeft;
                    }
                }
            }, 1000);
        }
        
        // Reset frog to starting position
        function resetFrog() {
            frog = {
                x: FROG_START_X,
                y: FROG_START_Y,
                width: GRID_SIZE - 10,
                height: GRID_SIZE - 10,
                speed: GRID_SIZE,
                onLog: false,
                logSpeed: 0
            };
        }
        
        // Setup level obstacles and safe areas
        function setupLevel() {
            // Clear existing obstacles
            cars = [];
            logs = [];
            turtles = [];
            lilyPads = [];
            
            // Create lily pads (goals) - always 9 lily pads
            for (let i = 0; i < 9; i++) {
                const segmentWidth = GAME_WIDTH / 9;
                lilyPads.push({
                    x: (i * segmentWidth) + (segmentWidth / 2) - 20, // Center in each segment
                    y: 40,
                    width: 40,
                    height: 40,
                    reached: false
                });
            }
            
            // Calculate speed multiplier based on level
            const speedMultiplier = 1 + (level - 1) * SPEED_INCREASE_PER_LEVEL;
            
            // Calculate number of vehicles and logs based on level
            const carCount = Math.min(4, Math.floor(3 + level / 2)); // Start with 3 cars, max 4
            const logCount = Math.max(4, Math.floor(9 - level)); // Start with 9 logs, minimum 4
            
            // Setup cars (rows 6-9 from bottom)
            // Row 1 (closest to frog) - slow cars moving right
            if (level >= 1) createCarRow(GAME_HEIGHT - 2 * GRID_SIZE, 1, 1, COLORS.car1, 1, carCount);
            
            // Row 2 - medium cars moving left
            if (level >= 2) createCarRow(GAME_HEIGHT - 3 * GRID_SIZE, -1, 1.2, COLORS.car2, 0.7, carCount);
            
            // Row 3 - fast cars moving right
            if (level >= 3) createCarRow(GAME_HEIGHT - 4 * GRID_SIZE, 1, 1.5, COLORS.car3, 1.3, carCount);
            
            // Row 4 - very slow trucks moving left
            if (level >= 4) createCarRow(GAME_HEIGHT - 5 * GRID_SIZE, -1, 0.8, COLORS.car4, 2, carCount);
            
            // Setup logs and turtles (rows 2-5 from bottom)
            // Row 1 (just above median) - short logs moving right
            createLogRow(GAME_HEIGHT - 7 * GRID_SIZE, 1, 1, 2, logCount);
            
            // Row 2 - turtles moving left
            if (level >= 2) createTurtleRow(GAME_HEIGHT - 8 * GRID_SIZE, -1, 1, 3);
            
            // Row 3 - long logs moving right
            createLogRow(GAME_HEIGHT - 9 * GRID_SIZE, 1, 0.8, 3, logCount);
            
            // Row 4 - turtles moving left
            if (level >= 3) createTurtleRow(GAME_HEIGHT - 10 * GRID_SIZE, -1, 1, 2);
            
            // Apply level-based speed increase
            cars.forEach(car => {
                car.speed *= speedMultiplier;
            });
            
            logs.forEach(log => {
                log.speed *= speedMultiplier;
            });
            
            turtles.forEach(turtle => {
                turtle.speed *= speedMultiplier;
            });
        }
        
        // Create a row of cars
        function createCarRow(y, direction, speed, color, length, count) {
            const carLength = length * GRID_SIZE;
            const totalWidth = GAME_WIDTH;
            const spacing = totalWidth / count;
            
            for (let i = 0; i < count; i++) {
                // Calculate exact position with no randomization
                const x = i * spacing;
                
                cars.push({
                    x: x,
                    y: y,
                    width: carLength,
                    height: GRID_SIZE - 10,
                    speed: direction * speed * BASE_SPEEDS.car1,
                    color: color
                });
            }
        }
        
        // Create a row of logs
        function createLogRow(y, direction, speed, length, count) {
            const logLength = length * GRID_SIZE;
            const totalWidth = GAME_WIDTH;
            const spacing = totalWidth / count;
            
            for (let i = 0; i < count; i++) {
                // Calculate exact position with no randomization
                const x = i * spacing;
                
                logs.push({
                    x: x,
                    y: y,
                    width: logLength,
                    height: GRID_SIZE - 10,
                    speed: direction * speed * (length === 2 ? BASE_SPEEDS.log1 : BASE_SPEEDS.log2)
                });
            }
        }
        
        // Create a row of turtles
        function createTurtleRow(y, direction, speed, count) {
            const turtleGroups = 2;
            const groupSpacing = GAME_WIDTH / turtleGroups;
            
            for (let i = 0; i < turtleGroups; i++) {
                // Calculate exact position for each group with no randomization
                const x = i * groupSpacing;
                
                for (let j = 0; j < count; j++) {
                    turtles.push({
                        x: x + (j * GRID_SIZE),
                        y: y,
                        width: GRID_SIZE - 5,
                        height: GRID_SIZE - 10,
                        speed: direction * speed * (i === 0 ? BASE_SPEEDS.turtle1 : BASE_SPEEDS.turtle2),
                        diving: false,
                        diveTimer: Math.random() * 200,
                        diveState: 0
                    });
                }
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
        
        // Draw the game background
        function drawBackground() {
            // Water area (top section)
            ctx.fillStyle = COLORS.water;
            ctx.fillRect(0, GRID_SIZE, GAME_WIDTH, GRID_SIZE * 5);
            
            // Safe middle row (median)
            ctx.fillStyle = COLORS.median;
            ctx.fillRect(0, GAME_HEIGHT - 6 * GRID_SIZE, GAME_WIDTH, GRID_SIZE);
            
            // Road area (bottom section)
            ctx.fillStyle = COLORS.road;
            ctx.fillRect(0, GAME_HEIGHT - 5 * GRID_SIZE, GAME_WIDTH, GRID_SIZE * 4);
            
            // Start area (grass)
            ctx.fillStyle = COLORS.grass;
            ctx.fillRect(0, GAME_HEIGHT - GRID_SIZE, GAME_WIDTH, GRID_SIZE);
            
            // End area (top grass)
            ctx.fillStyle = COLORS.grass;
            ctx.fillRect(0, 0, GAME_WIDTH, GRID_SIZE);
            
            // Draw lane separators on the road
            ctx.strokeStyle = 'white';
            ctx.setLineDash([20, 15]);
            ctx.lineWidth = 2;
            
            for (let i = 1; i < 4; i++) {
                ctx.beginPath();
                const y = GAME_HEIGHT - (5 * GRID_SIZE) + (i * GRID_SIZE);
                ctx.moveTo(0, y);
                ctx.lineTo(GAME_WIDTH, y);
                ctx.stroke();
            }
            
            ctx.setLineDash([]);
        }
        
        // Draw lily pads (goals)
        function drawLilyPads() {
            lilyPads.forEach(pad => {
                ctx.fillStyle = pad.reached ? COLORS.frog : COLORS.lilyPad;
                ctx.beginPath();
                ctx.arc(pad.x + 20, pad.y + 20, 18, 0, Math.PI * 2);
                ctx.fill();
            });
        }
        
        // Draw cars
        function drawCars() {
            cars.forEach(car => {
                ctx.fillStyle = car.color;
                ctx.fillRect(car.x, car.y, car.width, car.height);
                
                // Add simple details to cars
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                
                // Windows
                if (car.width > GRID_SIZE) { // Longer cars get windows
                    ctx.fillRect(car.x + 8, car.y + 5, 10, 8);
                    if (car.width > GRID_SIZE * 1.5) {
                        ctx.fillRect(car.x + car.width - 18, car.y + 5, 10, 8);
                    }
                }
                
                // Wheels
                ctx.fillStyle = 'black';
                ctx.fillRect(car.x + 5, car.y - 3, 8, 3);
                ctx.fillRect(car.x + 5, car.y + car.height, 8, 3);
                ctx.fillRect(car.x + car.width - 13, car.y - 3, 8, 3);
                ctx.fillRect(car.x + car.width - 13, car.y + car.height, 8, 3);
            });
        }
        
        // Draw logs
        function drawLogs() {
            logs.forEach(log => {
                ctx.fillStyle = COLORS.log;
                ctx.fillRect(log.x, log.y, log.width, log.height);
                
                // Add wood texture
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = 2;
                
                for (let i = 1; i < log.width / 15; i++) {
                    ctx.beginPath();
                    ctx.moveTo(log.x + i * 15, log.y);
                    ctx.lineTo(log.x + i * 15, log.y + log.height);
                    ctx.stroke();
                }
            });
        }
        
        // Draw turtles
        function drawTurtles() {
            turtles.forEach(turtle => {
                if (turtle.diveState < 2) { // Only draw if not fully submerged
                    const alpha = turtle.diveState === 0 ? 1 : 0.5; // Semi-transparent if semi-submerged
                    
                    // Turtle shell
                    ctx.fillStyle = `rgba(83, 119, 38, ${alpha})`;
                    ctx.beginPath();
                    ctx.ellipse(turtle.x + turtle.width/2, turtle.y + turtle.height/2, 
                                turtle.width/2, turtle.height/2, 0, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Shell pattern
                    ctx.fillStyle = `rgba(60, 86, 27, ${alpha})`;
                    ctx.beginPath();
                    ctx.ellipse(turtle.x + turtle.width/2, turtle.y + turtle.height/2, 
                                turtle.width/3, turtle.height/3, 0, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Head
                    ctx.fillStyle = `rgba(83, 119, 38, ${alpha})`;
                    const headDirection = turtle.speed > 0 ? 1 : -1;
                    ctx.beginPath();
                    ctx.ellipse(turtle.x + turtle.width/2 + (headDirection * turtle.width/3), 
                                turtle.y + turtle.height/2, turtle.width/6, turtle.height/6, 
                                0, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        }
        
        // Draw the frog
        function drawFrog() {
            ctx.fillStyle = COLORS.frog;
            
            // Body
            ctx.beginPath();
            ctx.ellipse(frog.x + frog.width/2, frog.y + frog.height/2, 
                        frog.width/2, frog.height/2, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Eyes
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(frog.x + frog.width/3, frog.y + frog.height/3, 4, 0, Math.PI * 2);
            ctx.arc(frog.x + 2*frog.width/3, frog.y + frog.height/3, 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Pupils
            ctx.fillStyle = 'black';
            ctx.beginPath();
            ctx.arc(frog.x + frog.width/3, frog.y + frog.height/3, 2, 0, Math.PI * 2);
            ctx.arc(frog.x + 2*frog.width/3, frog.y + frog.height/3, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw text messages
        function drawText() {
            if (gameOver) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
                
                ctx.font = '30px "Comic Neue", cursive';
                ctx.fillStyle = 'white';
                ctx.textAlign = 'center';
                ctx.fillText('Game Over!', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30);
                
                ctx.font = '20px "Comic Neue", cursive';
                ctx.fillText(`Final Score: ${score}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10);
                ctx.fillText('Press "Start Game" to play again!', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50);
            } else if (!gameStarted) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
                
                ctx.font = '30px "Comic Neue", cursive';
                ctx.fillStyle = 'white';
                ctx.textAlign = 'center';
                ctx.fillText('FROGGER', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50);
                
                ctx.font = '20px "Comic Neue", cursive';
                ctx.fillText('Help your frog friend get home!', GAME_WIDTH / 2, GAME_HEIGHT / 2);
                ctx.fillText('Use arrow keys to move.', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30);
                ctx.fillText('Press "Start Game" to play!', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60);
                
                // Draw a sample frog
                const sampleFrog = {
                    x: GAME_WIDTH / 2 - 15,
                    y: GAME_HEIGHT / 2 - 100,
                    width: 30,
                    height: 30
                };
                
                ctx.fillStyle = COLORS.frog;
                ctx.beginPath();
                ctx.ellipse(sampleFrog.x + sampleFrog.width/2, sampleFrog.y + sampleFrog.height/2, 
                            sampleFrog.width/2, sampleFrog.height/2, 0, 0, Math.PI * 2);
                ctx.fill();
                
                // Eyes for sample frog
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.arc(sampleFrog.x + sampleFrog.width/3, sampleFrog.y + sampleFrog.height/3, 4, 0, Math.PI * 2);
                ctx.arc(sampleFrog.x + 2*sampleFrog.width/3, sampleFrog.y + sampleFrog.height/3, 4, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = 'black';
                ctx.beginPath();
                ctx.arc(sampleFrog.x + sampleFrog.width/3, sampleFrog.y + sampleFrog.height/3, 2, 0, Math.PI * 2);
                ctx.arc(sampleFrog.x + 2*sampleFrog.width/3, sampleFrog.y + sampleFrog.height/3, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Game loop
        function gameLoop(timestamp) {
            if (!lastTime) lastTime = timestamp;
            const deltaTime = timestamp - lastTime;
            lastTime = timestamp;

            if (!paused && gameStarted && !gameOver) {
                // Clear the canvas
                ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

                // Draw background
                drawBackground();

                // Update and draw game elements
                updateAndDrawGameElements();

                // Draw the frog
                drawFrog();

                // Draw text overlays
                drawText();
            }

            // Continue the game loop
            animationId = requestAnimationFrame(gameLoop);
        }

        // Update and draw all game elements
        function updateAndDrawGameElements() {
            // Update and draw cars
            cars.forEach(car => {
                car.x += car.speed;
                if (car.speed > 0 && car.x > GAME_WIDTH) {
                    car.x = -car.width;
                } else if (car.speed < 0 && car.x + car.width < 0) {
                    car.x = GAME_WIDTH;
                }
            });
            drawCars();

            // Update and draw logs
            logs.forEach(log => {
                log.x += log.speed;
                if (log.speed > 0 && log.x > GAME_WIDTH) {
                    log.x = -log.width;
                } else if (log.speed < 0 && log.x + log.width < 0) {
                    log.x = GAME_WIDTH;
                }
            });
            drawLogs();

            // Update and draw turtles
            turtles.forEach(turtle => {
                turtle.x += turtle.speed;
                if (turtle.speed > 0 && turtle.x > GAME_WIDTH) {
                    turtle.x = -turtle.width;
                } else if (turtle.speed < 0 && turtle.x + turtle.width < 0) {
                    turtle.x = GAME_WIDTH;
                }

                // Update diving state
                turtle.diveTimer--;
                if (turtle.diveTimer <= 0) {
                    turtle.diveState = (turtle.diveState + 1) % 3;
                    turtle.diveTimer = 200;
                }
            });
            drawTurtles();

            // Draw lily pads
            drawLilyPads();

            // Check collisions
            checkCollisions();
        }

        // Check for collisions
        function checkCollisions() {
            // Check if frog is on a log or turtle
            let onSafePlatform = false;
            let platformSpeed = 0;

            // Check logs
            logs.forEach(log => {
                if (isColliding(frog, log)) {
                    onSafePlatform = true;
                    platformSpeed = log.speed;
                }
            });

            // Check turtles
            turtles.forEach(turtle => {
                if (turtle.diveState < 2 && isColliding(frog, turtle)) {
                    onSafePlatform = true;
                    platformSpeed = turtle.speed;
                }
            });

            // Update frog's position based on platform
            if (onSafePlatform) {
                frog.x += platformSpeed;
                if (frog.x < 0) frog.x = 0;
                if (frog.x + frog.width > GAME_WIDTH) frog.x = GAME_WIDTH - frog.width;
            } else if (frog.y < GAME_HEIGHT - 5 * GRID_SIZE && frog.y > GRID_SIZE) {
                // Only check for water if not in the median (yellow area)
                const isInMedian = frog.y >= GAME_HEIGHT - 6 * GRID_SIZE && 
                                  frog.y <= GAME_HEIGHT - 5 * GRID_SIZE;
                if (!isInMedian) {
                    loseLife();
                }
            }

            // Check car collisions
            cars.forEach(car => {
                if (isColliding(frog, car)) {
                    loseLife();
                }
            });

            // Check lily pad collisions
            lilyPads.forEach(pad => {
                if (!pad.reached && isColliding(frog, pad)) {
                    pad.reached = true;
                    score += 100;
                    scoreElement.textContent = score;
                    resetFrog();
                }
            });

            // Check if all lily pads are reached
            if (lilyPads.every(pad => pad.reached)) {
                level++;
                levelElement.textContent = level;
                setupLevel();
                resetFrog();
            }
        }

        // Collision detection helper
        function isColliding(obj1, obj2) {
            // Add a collision margin to make the game more forgiving
            const collisionMargin = 8; // Pixels of margin for more forgiving collisions
            
            // For the frog, use a smaller collision area
            if (obj1 === frog) {
                return obj1.x + collisionMargin < obj2.x + obj2.width - collisionMargin &&
                       obj1.x + obj1.width - collisionMargin > obj2.x + collisionMargin &&
                       obj1.y + collisionMargin < obj2.y + obj2.height - collisionMargin &&
                       obj1.y + obj1.height - collisionMargin > obj2.y + collisionMargin;
            }
            
            // For other objects (logs, turtles), use normal collision detection
            return obj1.x < obj2.x + obj2.width &&
                   obj1.x + obj1.width > obj2.x &&
                   obj1.y < obj2.y + obj2.height &&
                   obj1.y + obj1.height > obj2.y;
        }

        // Handle losing a life
        function loseLife() {
            lives--;
            updateLivesDisplay();
            
            if (lives <= 0) {
                gameOver = true;
                gameStarted = false;
                startButton.textContent = 'Start Game';
            } else {
                resetFrog();
            }
        }

        // Event Listeners
        startButton.addEventListener('click', () => {
            if (gameOver) {
                setupGame();
            }
            gameStarted = !gameStarted;
            startButton.textContent = gameStarted ? 'Restart Game' : 'Start Game';
            if (gameStarted) {
                lastTime = 0;
                gameLoop(0);
            }
        });

        pauseButton.addEventListener('click', () => {
            if (gameStarted) {
                paused = !paused;
                pauseButton.textContent = paused ? 'Resume' : 'Pause';
            }
        });

        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (!gameStarted || paused || gameOver) return;

            const oldX = frog.x;
            const oldY = frog.y;

            switch (e.key) {
                case 'ArrowUp':
                    frog.y -= frog.speed;
                    break;
                case 'ArrowDown':
                    frog.y += frog.speed;
                    break;
                case 'ArrowLeft':
                    frog.x -= frog.speed;
                    break;
                case 'ArrowRight':
                    frog.x += frog.speed;
                    break;
            }

            // Keep frog within bounds
            if (frog.x < 0) frog.x = 0;
            if (frog.x + frog.width > GAME_WIDTH) frog.x = GAME_WIDTH - frog.width;
            if (frog.y < 0) frog.y = 0;
            if (frog.y + frog.height > GAME_HEIGHT) frog.y = GAME_HEIGHT - frog.height;
        });

        // Initialize the game
        setupGame();
        drawText(); // Draw initial welcome screen
    </script>
</body>
</html>