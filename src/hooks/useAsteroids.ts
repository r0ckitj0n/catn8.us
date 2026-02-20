import React from 'react';
import {
  ASTEROID_JAG,
  ASTEROID_NUM,
  ASTEROID_SIZE,
  ASTEROID_SPEED,
  ASTEROID_VERT,
  distBetweenPoints,
  GAME_LIVES,
  SHIP_BLINK_DUR,
  SHIP_INV_DUR,
  SHIP_SIZE,
} from './games/asteroidsConfig';
import { runAsteroidsLoop } from './games/asteroidsEngine';

export function useAsteroids(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const [level, setLevel] = React.useState(1);
  const [lives, setLives] = React.useState(GAME_LIVES);
  const [score, setScore] = React.useState(0);
  const [gameStarted, setGameStarted] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const [gameOver, setGameOver] = React.useState(false);
  const [shieldReady, setShieldReady] = React.useState(true);
  const [shieldTimeLeft, setShieldTimeLeft] = React.useState(0);
  const [shieldCooldownLeft, setShieldCooldownLeft] = React.useState(0);

  const gameState = React.useRef({
    ship: null as any,
    asteroids: [] as any[],
    lasers: [] as any[],
    lastTime: 0,
    textAlpha: 0,
    shieldActive: false,
    shieldTimer: 0,
    shieldCooldown: 0
  });

  const newAsteroid = React.useCallback((x: number, y: number, r: number) => {
    const lvlMult = 1 + (level - 1) * 0.1;
    const asteroid = {
      x, y,
      xv: Math.random() * ASTEROID_SPEED * lvlMult / 60 * (Math.random() < 0.5 ? 1 : -1),
      yv: Math.random() * ASTEROID_SPEED * lvlMult / 60 * (Math.random() < 0.5 ? 1 : -1),
      radius: r,
      angle: Math.random() * Math.PI * 2,
      vert: Math.floor(Math.random() * (ASTEROID_VERT + 1) + ASTEROID_VERT / 2),
      offs: [] as number[]
    };
    for (let i = 0; i < asteroid.vert; i++) {
      asteroid.offs.push(Math.random() * ASTEROID_JAG * 2 + 1 - ASTEROID_JAG);
    }
    return asteroid;
  }, [level]);

  const createAsteroidBelt = React.useCallback(() => {
    const gs = gameState.current;
    gs.asteroids = [];
    const canvas = canvasRef.current;
    if (!canvas) return;

    for (let i = 0; i < ASTEROID_NUM + level; i++) {
      let x, y;
      do {
        x = Math.random() * canvas.width;
        y = Math.random() * canvas.height;
      } while (distBetweenPoints(gs.ship.x, gs.ship.y, x, y) < ASTEROID_SIZE * 2 + gs.ship.radius);
      gs.asteroids.push(newAsteroid(x, y, Math.ceil(ASTEROID_SIZE / 2)));
    }
  }, [level, canvasRef, newAsteroid]);

  const createShip = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    gameState.current.ship = {
      x: canvas.width / 2,
      y: canvas.height / 2,
      radius: SHIP_SIZE / 2,
      angle: 90 / 180 * Math.PI,
      rotation: 0,
      thrusting: false,
      thrust: { x: 0, y: 0 },
      explodeTime: 0,
      blinkTime: Math.ceil(SHIP_BLINK_DUR * 60),
      blinkNum: Math.ceil(SHIP_INV_DUR / SHIP_BLINK_DUR),
      canShoot: true,
      dead: false
    };
  }, [canvasRef]);

  const startGame = React.useCallback(() => {
    setScore(0);
    setLevel(1);
    setLives(GAME_LIVES);
    setGameOver(false);
    setPaused(false);
    gameState.current.textAlpha = 0;
    createShip();
    createAsteroidBelt();
    setGameStarted(true);
  }, [createShip, createAsteroidBelt]);

  const togglePause = React.useCallback(() => {
    setPaused(p => !p);
  }, []);

  React.useEffect(() => {
    if (!gameStarted || paused || gameOver) return;
    const cleanup = runAsteroidsLoop({
      canvasRef,
      gameState,
      gameOver,
      createShip,
      createAsteroidBelt,
      newAsteroid,
      setShieldReady,
      setShieldTimeLeft,
      setShieldCooldownLeft,
      setLives,
      setGameOver,
      setScore,
      setLevel,
    });

    return cleanup ?? undefined;
  }, [gameStarted, paused, gameOver, canvasRef, createShip, createAsteroidBelt, newAsteroid]);

  return { level, lives, score, gameStarted, paused, gameOver, shieldReady, shieldTimeLeft, shieldCooldownLeft, startGame, togglePause };
}
