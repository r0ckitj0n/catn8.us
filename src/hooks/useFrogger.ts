import React from 'react';

const GRID_SIZE = 40;
const GAME_WIDTH = 480;
const GAME_HEIGHT = 520;
const STARTING_LIVES = 3;
const LEVEL_TIME = 600;
const FROG_START_X = Math.floor(GAME_WIDTH / 2) - GRID_SIZE / 2;
const FROG_START_Y = GAME_HEIGHT - GRID_SIZE;

const BASE_SPEEDS: any = {
  car1: 0.4, car2: 0.6, car3: 0.8, car4: 0.3,
  log1: 0.5, log2: 0.4, turtle1: 0.4, turtle2: 0.5
};

const VEHICLE_TYPES: any = {
  smallCar: { width: GRID_SIZE - 10, height: GRID_SIZE - 10, color: '#E74C3C', speed: 'car1' },
  mediumCar: { width: GRID_SIZE * 1.2, height: GRID_SIZE - 10, color: '#9B59B6', speed: 'car2' },
  largeCar: { width: GRID_SIZE * 1.5, height: GRID_SIZE - 10, color: '#E67E22', speed: 'car3' },
  truck: { width: GRID_SIZE * 2, height: GRID_SIZE - 10, color: '#1ABC9C', speed: 'car4' }
};

const COLORS = {
  water: '#3498DB', road: '#34495E', grass: '#2ECC71', median: '#F1C40F',
  car1: '#E74C3C', car2: '#9B59B6', car3: '#E67E22', car4: '#1ABC9C',
  log: '#795548', turtle: '#27AE60', frog: '#4ECDC4', lilyPad: '#2ECC71', text: '#ffffff'
};

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
    resetFrog();
    setupLevel(1);
    setGameStarted(true);
  }, [resetFrog, setupLevel]);

  const togglePause = React.useCallback(() => {
    setPaused(p => !p);
  }, []);

  const isColliding = (obj1: any, obj2: any) => {
    const margin = 8;
    return obj1.x + margin < obj2.x + obj2.width - margin &&
           obj1.x + obj1.width - margin > obj2.x + margin &&
           obj1.y + margin < obj2.y + obj2.height - margin &&
           obj1.y + obj1.height - margin > obj2.y + margin;
  };

  React.useEffect(() => {
    if (!gameStarted || paused || gameOver) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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

      // Update cars
      gs.cars.forEach(car => {
        car.x += car.speed * speedMultiplier;
        if (car.speed > 0 && car.x > GAME_WIDTH) car.x = -car.width;
        else if (car.speed < 0 && car.x + car.width < 0) car.x = GAME_WIDTH;
        if (isColliding(gs.frog, car)) {
          setLives(l => {
            if (l <= 1) setGameOver(true);
            resetFrog();
            return l - 1;
          });
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
        }
      });

      // Water check
      if (!onLog && gs.frog.y < GAME_HEIGHT - 5 * GRID_SIZE && gs.frog.y > GRID_SIZE) {
        const isInMedian = gs.frog.y >= GAME_HEIGHT - 6 * GRID_SIZE && gs.frog.y <= GAME_HEIGHT - 5 * GRID_SIZE;
        if (!isInMedian) {
          setLives(l => {
            if (l <= 1) setGameOver(true);
            resetFrog();
            return l - 1;
          });
        }
      }

      // Win check
      if (gs.frog.y <= GRID_SIZE && !gs.showCongratulations) {
        setScore(s => s + 100);
        gs.showCongratulations = true;
        gs.congratulationsTimer = 0;
      }

      if (gs.showCongratulations) {
        gs.congratulationsTimer += dt;
        if (gs.congratulationsTimer >= 2000) {
          gs.showCongratulations = false;
          setLevel(l => l + 1);
          setupLevel(level + 1);
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
