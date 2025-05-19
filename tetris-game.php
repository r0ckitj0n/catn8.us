<?php
// You can add PHP functionality here if needed
// For example, server-side session handling, user scores, etc.
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tetris - catn8.us</title>
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
            background: linear-gradient(135deg, var(--fun-purple), var(--fun-green));
            overflow-x: hidden;
            position: relative;
        }

        body::before {
            display: none;
        }

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
            justify-content: center;
            align-items: flex-start;
            gap: 20px;
            margin-top: 20px;
            flex-wrap: wrap;
        }

        .game-board {
            border: 5px solid var(--fun-purple);
            border-radius: 10px;
            background-color: rgba(255, 255, 255, 0.15);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
            backdrop-filter: blur(10px);
        }

        .game-sidebar {
            display: flex;
            flex-direction: column;
            gap: 20px;
            width: 250px;
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
            background: linear-gradient(135deg, var(--fun-purple), var(--fun-green));
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

        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #777;
            font-size: 0.9rem;
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

        @media (max-width: 768px) {
            .game-area {
                flex-direction: column;
                align-items: center;
            }

            .game-sidebar {
                width: 100%;
                max-width: 300px;
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
        <h1>Tetris Adventure!</h1>
        
        <div class="game-area">
            <div class="game-sidebar">
                <div class="joyful-message">
                    <p>Welcome to our Tetris playground! Here at catn8.us, we believe games bring friends together for fun and learning.</p>
                    <p>Every block you place is like building a friendship - piece by piece, creating something wonderful!</p>
                </div>
                
                <div class="joyful-message">
                    <p>Did you know? Tetris helps our brains grow stronger! It improves problem-solving and thinking skills.</p>
                </div>
            </div>

            <canvas id="tetris" class="game-board" width="300" height="600"></canvas>
            
            <div class="game-sidebar">
                <div class="game-stats">
                    <div class="stat">
                        <p>Score: <span id="score">0</span></p>
                    </div>
                    <div class="stat">
                        <p>Level: <span id="level">1</span></p>
                    </div>
                    <div class="stat">
                        <p>Lines: <span id="lines">0</span></p>
                    </div>
                </div>
                
                <div class="controls">
                    <p>Game Controls</p>
                    <button id="start-button">Start Game</button>
                    <button id="pause-button">Pause</button>
                    
                    <div class="how-to-play">
                        <p>How to play:</p>
                        <ul>
                            <li>← / → : Move left/right</li>
                            <li>↑ : Rotate piece</li>
                            <li>↓ : Move down</li>
                            <li>Space : Hard drop</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        // Get the canvas element and its context
        const canvas = document.getElementById('tetris');
        const context = canvas.getContext('2d');
        const scoreElement = document.getElementById('score');
        const levelElement = document.getElementById('level');
        const linesElement = document.getElementById('lines');
        const startButton = document.getElementById('start-button');
        const pauseButton = document.getElementById('pause-button');
        
        // Set the scale of each block
        const blockSize = 30;
        const rows = 20;
        const columns = 10;
        
        // Colors for the Tetris pieces
        const colors = [
            null,
            '#FF6B6B', // Red - I piece
            '#4ECDC4', // Teal - J piece
            '#FFD166', // Yellow - L piece
            '#06D6A0', // Green - O piece
            '#118AB2', // Blue - S piece
            '#EF476F', // Pink - T piece
            '#73D2DE'  // Light blue - Z piece
        ];
        
        // Tetris pieces and their shapes
        const pieces = [
            // I piece
            [
                [0, 1, 0, 0],
                [0, 1, 0, 0],
                [0, 1, 0, 0],
                [0, 1, 0, 0]
            ],
            // J piece
            [
                [0, 2, 0],
                [0, 2, 0],
                [2, 2, 0]
            ],
            // L piece
            [
                [0, 3, 0],
                [0, 3, 0],
                [0, 3, 3]
            ],
            // O piece
            [
                [4, 4],
                [4, 4]
            ],
            // S piece
            [
                [0, 5, 5],
                [5, 5, 0],
                [0, 0, 0]
            ],
            // T piece
            [
                [0, 0, 0],
                [6, 6, 6],
                [0, 6, 0]
            ],
            // Z piece
            [
                [7, 7, 0],
                [0, 7, 7],
                [0, 0, 0]
            ]
        ];
        
        // Game state
        let board = createBoard();
        let gameOver = false;
        let paused = false;
        let gameStarted = false;
        let animationId;
        let dropCounter = 0;
        let dropInterval = 1000;
        let lastTime = 0;
        let score = 0;
        let level = 1;
        let lines = 0;
        let player = {
            position: { x: 0, y: 0 },
            piece: null
        };

        // Create an empty game board
        function createBoard() {
            return Array.from({ length: rows }, () => Array(columns).fill(0));
        }
        
        // Draw the game board with all placed pieces
        function drawBoard() {
            board.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        context.fillStyle = colors[value];
                        context.fillRect(x * blockSize, y * blockSize, blockSize, blockSize);
                        context.strokeStyle = '#fff';
                        context.strokeRect(x * blockSize, y * blockSize, blockSize, blockSize);
                    }
                });
            });
        }
        
        // Draw the current active piece
        function drawPiece() {
            player.piece.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        context.fillStyle = colors[value];
                        context.fillRect(
                            (player.position.x + x) * blockSize,
                            (player.position.y + y) * blockSize,
                            blockSize,
                            blockSize
                        );
                        context.strokeStyle = '#fff';
                        context.strokeRect(
                            (player.position.x + x) * blockSize,
                            (player.position.y + y) * blockSize,
                            blockSize,
                            blockSize
                        );
                    }
                });
            });
        }
        
        // Clear the canvas
        function clearCanvas() {
            context.fillStyle = '#f0f0f0';
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw grid
            context.strokeStyle = '#ddd';
            for (let i = 0; i < rows; i++) {
                context.beginPath();
                context.moveTo(0, i * blockSize);
                context.lineTo(canvas.width, i * blockSize);
                context.stroke();
            }
            
            for (let i = 0; i < columns; i++) {
                context.beginPath();
                context.moveTo(i * blockSize, 0);
                context.lineTo(i * blockSize, canvas.height);
                context.stroke();
            }
        }
        
        // Main draw function
        function draw() {
            clearCanvas();
            drawBoard();
            if (player.piece) {
                drawPiece();
            }
        }
        
        // Get a random Tetris piece
        function getRandomPiece() {
            const index = Math.floor(Math.random() * pieces.length);
            return JSON.parse(JSON.stringify(pieces[index])); // Deep copy
        }
        
        // Check for collisions with walls, floor, or other pieces
        function checkCollision() {
            for (let y = 0; y < player.piece.length; y++) {
                for (let x = 0; x < player.piece[y].length; x++) {
                    if (player.piece[y][x] !== 0) {
                        // Get coordinates on the board
                        const boardY = y + player.position.y;
                        const boardX = x + player.position.x;
                        
                        // Check boundaries
                        if (
                            boardX < 0 || 
                            boardX >= columns || 
                            boardY >= rows ||
                            (boardY >= 0 && board[boardY] && board[boardY][boardX] !== 0)
                        ) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }
        
        // Reset the player with a new piece
        function resetPlayer() {
            player.piece = getRandomPiece();
            player.position.y = 0;
            player.position.x = Math.floor((columns - player.piece[0].length) / 2);
            
            // Check if the game is over (no space for new piece)
            if (checkCollision()) {
                gameOver = true;
                cancelAnimationFrame(animationId);
                console.log("GAME OVER DETECTED");
                displayGameOver();
                return false;
            }
            return true;
        }
        
        // Move the piece left or right
        function moveHorizontal(direction) {
            if (paused || gameOver || !gameStarted) return;
            
            player.position.x += direction;
            if (checkCollision()) {
                player.position.x -= direction;
            }
            draw();
        }
        
        // Rotate the piece
        function rotate() {
            if (paused || gameOver || !gameStarted) return;
            
            const originalPiece = player.piece;
            
            // Create a rotated piece
            const rotated = [];
            for (let i = 0; i < player.piece[0].length; i++) {
                rotated.push([]);
                for (let j = player.piece.length - 1; j >= 0; j--) {
                    rotated[i].push(player.piece[j][i]);
                }
            }
            
            player.piece = rotated;
            
            // If the rotation causes a collision, revert back
            if (checkCollision()) {
                player.piece = originalPiece;
            }
            
            draw();
        }
        
        // Move the piece down
        function moveDown() {
            if (paused || gameOver || !gameStarted) return;
            
            player.position.y++;
            
            if (checkCollision()) {
                player.position.y--;
                mergePiece();
                if (!resetPlayer()) {
                    return; // Game over
                }
                clearRows();
            }
            
            draw();
        }
        
        // Hard drop the piece
        function hardDrop() {
            if (paused || gameOver || !gameStarted) return;
            
            let dropDistance = 0;
            while (true) {
                player.position.y++;
                dropDistance++;
                
                if (checkCollision()) {
                    player.position.y--;
                    break;
                }
            }
            
            // Add bonus points for hard drop
            score += dropDistance;
            scoreElement.textContent = score;
            
            mergePiece();
            if (!resetPlayer()) {
                return; // Game over
            }
            clearRows();
            draw();
        }
        
        // Merge the piece with the board
        function mergePiece() {
            player.piece.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        const boardY = y + player.position.y;
                        const boardX = x + player.position.x;
                        
                        // Only merge if within board boundaries
                        if (boardY >= 0 && boardY < rows && boardX >= 0 && boardX < columns) {
                            board[boardY][boardX] = value;
                        }
                    }
                });
            });
        }
        
        // Clear completed rows
        function clearRows() {
            let rowsCleared = 0;
            
            outer: for (let y = rows - 1; y >= 0; y--) {
                for (let x = 0; x < columns; x++) {
                    if (board[y][x] === 0) {
                        continue outer;
                    }
                }
                
                // Row is full, remove it
                const row = board.splice(y, 1)[0].fill(0);
                board.unshift(row);
                y++;
                rowsCleared++;
            }
            
            if (rowsCleared > 0) {
                // Update score
                const points = [0, 40, 100, 300, 1200]; // Points for 0, 1, 2, 3, 4 rows
                score += points[rowsCleared] * level;
                lines += rowsCleared;
                
                // Update level
                level = Math.floor(lines / 10) + 1;
                
                // Update drop speed
                dropInterval = Math.max(100, 1000 - (level - 1) * 100);
                
                // Update display
                scoreElement.textContent = score;
                levelElement.textContent = level;
                linesElement.textContent = lines;
            }
        }
        
        // Display game over message
        function displayGameOver() {
            context.fillStyle = 'rgba(0, 0, 0, 0.7)';
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            context.font = '30px "Comic Sans MS", sans-serif';
            context.fillStyle = '#fff';
            context.textAlign = 'center';
            context.fillText('Game Over!', canvas.width / 2, canvas.height / 2 - 30);
            
            context.font = '20px "Comic Sans MS", sans-serif';
            context.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 10);
            context.fillText('Press "Start Game" to play again!', canvas.width / 2, canvas.height / 2 + 50);
            
            // Update button text
            startButton.textContent = 'Start New Game';
        }
        
        // Game loop
        function update(time = 0) {
            if (!gameStarted || paused) {
                animationId = requestAnimationFrame(update);
                return;
            }
            
            if (gameOver) {
                cancelAnimationFrame(animationId);
                return;
            }
            
            const deltaTime = time - lastTime;
            lastTime = time;
            
            dropCounter += deltaTime;
            if (dropCounter > dropInterval) {
                moveDown();
                dropCounter = 0;
            }
            
            draw();
            animationId = requestAnimationFrame(update);
        }
        
        // Start the game
        function startGame() {
            // Cancel any existing animation frame
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
            
            // Reset game state
            board = createBoard();
            gameOver = false;
            paused = false;
            gameStarted = true;
            dropCounter = 0;
            score = 0;
            level = 1;
            lines = 0;
            
            // Reset display
            scoreElement.textContent = score;
            levelElement.textContent = level;
            linesElement.textContent = lines;
            
            // Reset player
            resetPlayer();
            
            // Start the game loop
            lastTime = 0;
            update();
            
            // Update buttons
            startButton.textContent = 'Restart Game';
            pauseButton.textContent = 'Pause';
            
            // Focus on the canvas to ensure keyboard controls work
            canvas.focus();
        }
        
        // Pause the game
        function togglePause() {
            if (!gameStarted || gameOver) return;
            
            paused = !paused;
            pauseButton.textContent = paused ? 'Resume' : 'Pause';
        }
        
        // Event listeners
        document.addEventListener('keydown', event => {
            // Prevent default for arrow keys and space to avoid page scrolling
            if ([32, 37, 38, 39, 40].includes(event.keyCode)) {
                event.preventDefault();
            }
            
            switch (event.keyCode) {
                case 37: // Left arrow
                    moveHorizontal(-1);
                    break;
                case 39: // Right arrow
                    moveHorizontal(1);
                    break;
                case 40: // Down arrow
                    moveDown();
                    break;
                case 38: // Up arrow
                    rotate();
                    break;
                case 32: // Space
                    hardDrop();
                    break;
                case 80: // P key
                    togglePause();
                    break;
            }
        });
        
        startButton.addEventListener('click', startGame);
        pauseButton.addEventListener('click', togglePause);
        
        // Initial draw
        draw();

        <?php
        // You can add PHP-generated JavaScript here if needed
        // For example, loading saved scores from a database
        ?>
    </script>
</body>
</html>