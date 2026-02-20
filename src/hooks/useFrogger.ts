import React from 'react';
import {
  BASE_SPEEDS,
  COLORS,
  FROG_START_X,
  FROG_START_Y,
  GAME_HEIGHT,
  GAME_WIDTH,
  GRID_SIZE,
  LEVEL_TIME,
  STARTING_LIVES,
  VEHICLE_TYPES,
  isColliding,
} from './games/froggerConfig';

export function useFrogger(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const [level, setLevel] = React.useState(1);
  const [lives, setLives] = React.useState(STARTING_LIVES);
  const [score, setScore] = React.useState(0);
  const [timeLeft, setTimeLeft] = React.useState(LEVEL_TIME);
  const [gameStarted, setGameStarted] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const [gameOver, setGameOver] = React.useState(false);

  const gameState = React.useRef({
    frog: { x: FROG_START_X, y: FROG_START_Y, width: GRID_SIZE - 10, height: GRID_SIZE - 10, speed: GRID_SIZE },
    cars: [] as any[],
    logs: [] as any[],
    turtles: [] as any[],
    lilyPads: [] as any[],
    showCongratulations: false,
    congratulationsTimer: 0,
    levelTimer: LEVEL_TIME,
    lastTime: 0
  });

  const resetFrog = React.useCallback(() => {
    gameState.current.frog = { x: FROG_START_X, y: FROG_START_Y, width: GRID_SIZE - 10, height: GRID_SIZE - 10, speed: GRID_SIZE };
  }, []);

  const setupLevel = React.useCallback((lvl: number) => {
    const gs = gameState.current;
    gs.lilyPads = [];
    for (let i = 0; i < 9; i++) {
      gs.lilyPads.push({ x: i * (GAME_WIDTH / 9) + (GAME_WIDTH / 18), y: 40, width: 40, height: 40, reached: false });
    }

    const carCount = Math.min(4, Math.floor(1 + Math.floor(lvl / 2)));
    const logCount = Math.max(4, Math.floor(12 - (lvl * 2)));

    gs.cars = [];
    gs.logs = [];
    gs.turtles = [];

    const createCarRow = (y: number, count: number, carType: string, direction: boolean) => {
      const vt = VEHICLE_TYPES[carType];
      const spacing = GAME_WIDTH / count;
      for (let i = 0; i < count; i++) {
        const x = i * spacing + (Math.random() - 0.5) * (spacing * 0.3);
        gs.cars.push({ x, y, width: vt.width, height: vt.height, speed: direction ? -BASE_SPEEDS[vt.speed] : BASE_SPEEDS[vt.speed], color: vt.color, type: carType });
      }
    };

    const createLogRow = (y: number, count: number, logType: string, direction: boolean) => {
      const spacing = GAME_WIDTH / count;
      for (let i = 0; i < count; i++) {
        const x = i * spacing + (Math.random() - 0.5) * (spacing * 0.3);
        gs.logs.push({ x, y, width: GRID_SIZE, height: GRID_SIZE - 10, speed: direction ? -BASE_SPEEDS[logType] : BASE_SPEEDS[logType], logType });
      }
    };

    createCarRow(GAME_HEIGHT - 2 * GRID_SIZE, carCount, 'smallCar', true);
    createCarRow(GAME_HEIGHT - 3 * GRID_SIZE, carCount, 'mediumCar', false);
    createCarRow(GAME_HEIGHT - 4 * GRID_SIZE, carCount, 'largeCar', true);
    createCarRow(GAME_HEIGHT - 5 * GRID_SIZE, carCount, 'truck', false);

    createLogRow(GAME_HEIGHT - 7 * GRID_SIZE, logCount, 'log1', true);
    createLogRow(GAME_HEIGHT - 9 * GRID_SIZE, logCount, 'log2', true);
    createLogRow(GAME_HEIGHT - 11 * GRID_SIZE, logCount, 'log1', true);
  }, []);

  const startGame = React.useCallback(() => {
    setLevel(1);
    setLives(STARTING_LIVES);
    setScore(0);
    setTimeLeft(LEVEL_TIME);
    setGameOver(false);
    setPaused(false);
    gameState.current.lastTime = 0;
    gameState.current.levelTimer = LEVEL_TIME;
    gameState.current.showCongratulations = false;
    gameState.current.congratulationsTimer = 0;
    resetFrog();
    setupLevel(1);
    setGameStarted(true);
  }, [resetFrog, setupLevel]);

  const togglePause = React.useCallback(() => {
    setPaused(p => !p);
  }, []);

  React.useEffect(() => {
    if (!gameStarted || paused || gameOver) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
      const frog = gameState.current.frog;
      if (e.key === 'ArrowUp') frog.y -= frog.speed;
      if (e.key === 'ArrowDown') frog.y += frog.speed;
      if (e.key === 'ArrowLeft') frog.x -= frog.speed;
      if (e.key === 'ArrowRight') frog.x += frog.speed;

      frog.x = Math.max(0, Math.min(GAME_WIDTH - frog.width, frog.x));
      frog.y = Math.max(0, Math.min(GAME_HEIGHT - frog.height, frog.y));
    };

    window.addEventListener('keydown', handleKeyDown);
    
    let animationId: number;
    const loop = (time: number) => {
      if (gameState.current.lastTime === 0) gameState.current.lastTime = time;
      const dt = time - gameState.current.lastTime;
      gameState.current.lastTime = time;

      const gs = gameState.current;
      const speedMultiplier = 1 + (level - 1) * 0.05;
      let lifeLost = false;

      // Update cars
      gs.cars.forEach(car => {
        car.x += car.speed * speedMultiplier;
        if (car.speed > 0 && car.x > GAME_WIDTH) car.x = -car.width;
        else if (car.speed < 0 && car.x + car.width < 0) car.x = GAME_WIDTH;
        if (!lifeLost && isColliding(gs.frog, car)) {
          lifeLost = true;
        }
      });

      // Update logs
      let onLog = false;
      gs.logs.forEach(log => {
        log.x += log.speed * speedMultiplier;
        if (log.speed > 0 && log.x > GAME_WIDTH) log.x = -log.width;
        else if (log.speed < 0 && log.x + log.width < 0) log.x = GAME_WIDTH;
        if (isColliding(gs.frog, log)) {
          onLog = true;
          gs.frog.x += log.speed * speedMultiplier;
          gs.frog.x = Math.max(0, Math.min(GAME_WIDTH - gs.frog.width, gs.frog.x));
        }
      });

      // Water check
      if (!lifeLost && !onLog && gs.frog.y < GAME_HEIGHT - 5 * GRID_SIZE && gs.frog.y > GRID_SIZE) {
        const isInMedian = gs.frog.y >= GAME_HEIGHT - 6 * GRID_SIZE && gs.frog.y <= GAME_HEIGHT - 5 * GRID_SIZE;
        if (!isInMedian) {
          lifeLost = true;
        }
      }

      gs.levelTimer = Math.max(0, gs.levelTimer - dt / 1000);
      setTimeLeft(Math.ceil(gs.levelTimer));

      if (!lifeLost && gs.levelTimer <= 0) {
        lifeLost = true;
      }

      if (lifeLost) {
        gs.levelTimer = LEVEL_TIME;
        setTimeLeft(LEVEL_TIME);
        setLives((current) => {
          const nextLives = current - 1;
          if (nextLives <= 0) {
            setGameOver(true);
            return 0;
          }
          resetFrog();
          return nextLives;
        });
      }

      // Win check
      if (!lifeLost && gs.frog.y <= GRID_SIZE && !gs.showCongratulations) {
        setScore(s => s + 100);
        gs.showCongratulations = true;
        gs.congratulationsTimer = 0;
      }

      if (gs.showCongratulations) {
        gs.congratulationsTimer += dt;
        if (gs.congratulationsTimer >= 2000) {
          gs.showCongratulations = false;
          setLevel((currentLevel) => {
            const nextLevel = currentLevel + 1;
            setupLevel(nextLevel);
            return nextLevel;
          });
          gs.levelTimer = LEVEL_TIME;
          setTimeLeft(LEVEL_TIME);
          resetFrog();
        }
      }

      // DRAW
      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      ctx.fillStyle = COLORS.water; ctx.fillRect(0, GRID_SIZE, GAME_WIDTH, GRID_SIZE * 5);
      ctx.fillStyle = COLORS.median; ctx.fillRect(0, GAME_HEIGHT - 6 * GRID_SIZE, GAME_WIDTH, GRID_SIZE);
      ctx.fillStyle = COLORS.road; ctx.fillRect(0, GAME_HEIGHT - 5 * GRID_SIZE, GAME_WIDTH, GRID_SIZE * 4);
      ctx.fillStyle = COLORS.grass; ctx.fillRect(0, GAME_HEIGHT - GRID_SIZE, GAME_WIDTH, GRID_SIZE);
      ctx.fillRect(0, 0, GAME_WIDTH, GRID_SIZE);

      gs.cars.forEach(car => { ctx.fillStyle = car.color; ctx.fillRect(car.x, car.y, car.width, car.height); });
      gs.logs.forEach(log => { ctx.fillStyle = COLORS.log; ctx.fillRect(log.x, log.y, log.width, log.height); });
      gs.lilyPads.forEach(pad => { ctx.fillStyle = pad.reached ? COLORS.frog : COLORS.lilyPad; ctx.beginPath(); ctx.arc(pad.x + 20, pad.y + 20, 18, 0, Math.PI * 2); ctx.fill(); });

      ctx.fillStyle = COLORS.frog; ctx.fillRect(gs.frog.x, gs.frog.y, gs.frog.width, gs.frog.height);

      if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.font = '30px Comic Neue'; ctx.fillText('Game Over!', GAME_WIDTH/2, GAME_HEIGHT/2);
      }

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(animationId);
    };
  }, [gameStarted, paused, gameOver, canvasRef, level, resetFrog, setupLevel]);

  return { level, lives, score, timeLeft, gameStarted, paused, gameOver, startGame, togglePause };
}
