import React from 'react';
import {
  COLORS,
  GAME_HEIGHT,
  GAME_WIDTH,
  GRID_SIZE,
  LEVEL_TIME,
  STARTING_LIVES,
  isColliding,
} from './games/froggerConfig';
import { createFrog, createInitialFroggerState, setupFroggerLevel } from './games/froggerEngine';

export function useFrogger(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const [level, setLevel] = React.useState(1);
  const [lives, setLives] = React.useState(STARTING_LIVES);
  const [score, setScore] = React.useState(0);
  const [timeLeft, setTimeLeft] = React.useState(LEVEL_TIME);
  const [gameStarted, setGameStarted] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const [gameOver, setGameOver] = React.useState(false);

  const gameState = React.useRef(createInitialFroggerState());

  const resetFrog = React.useCallback(() => {
    gameState.current.frog = createFrog();
  }, []);

  const setupLevel = React.useCallback((lvl: number) => {
    setupFroggerLevel(gameState.current, lvl);
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
