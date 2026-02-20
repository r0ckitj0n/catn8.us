import React from 'react';
import {
  ASTEROID_SIZE,
  LASER_DISTANCE,
  SHIELD_COOLDOWN,
  SHIP_THRUST,
  FRICTION,
  SHIP_BLINK_DUR,
  distBetweenPoints,
} from './asteroidsConfig';
import { drawAsteroidsScene } from './asteroidsRenderer';
import { createAsteroidsControls } from './asteroidsControls';

type AsteroidsLoopOptions = {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  gameState: React.MutableRefObject<any>;
  gameOver: boolean;
  createShip: () => void;
  createAsteroidBelt: (targetLevel?: number) => void;
  newAsteroid: (x: number, y: number, r: number) => any;
  setShieldReady: React.Dispatch<React.SetStateAction<boolean>>;
  setShieldTimeLeft: React.Dispatch<React.SetStateAction<number>>;
  setShieldCooldownLeft: React.Dispatch<React.SetStateAction<number>>;
  setLives: React.Dispatch<React.SetStateAction<number>>;
  setGameOver: React.Dispatch<React.SetStateAction<boolean>>;
  setScore: React.Dispatch<React.SetStateAction<number>>;
  setLevel: React.Dispatch<React.SetStateAction<number>>;
};

export function runAsteroidsLoop({
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
}: AsteroidsLoopOptions): (() => void) | null {
  const canvas = canvasRef.current;
  const ctx = canvas?.getContext('2d');
  if (!ctx || !canvas) {
    return null;
  }

  const { handleKeyDown, handleKeyUp } = createAsteroidsControls({ gameState, setShieldReady });

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  gameState.current.lastTime = 0;

  let animationId = 0;
  const loop = (time: number) => {
    const gs = gameState.current;
    if (gs.lastTime === 0) {
      gs.lastTime = time;
    }
    const dt = (time - gs.lastTime) / 1000;
    gs.lastTime = time;

    if (gs.shieldActive) {
      gs.shieldTimer -= dt;
      setShieldTimeLeft(Math.max(0, gs.shieldTimer));
      if (gs.shieldTimer <= 0) {
        gs.shieldActive = false;
        gs.shieldCooldown = SHIELD_COOLDOWN;
      }
    } else if (gs.shieldCooldown > 0) {
      gs.shieldCooldown -= dt;
      setShieldCooldownLeft(Math.max(0, gs.shieldCooldown));
      if (gs.shieldCooldown <= 0) {
        setShieldReady(true);
      }
    }

    if (gs.ship && !gs.ship.dead) {
      if (gs.ship.thrusting) {
        gs.ship.thrust.x += SHIP_THRUST * Math.cos(gs.ship.angle) / 60;
        gs.ship.thrust.y -= SHIP_THRUST * Math.sin(gs.ship.angle) / 60;
      } else {
        gs.ship.thrust.x -= FRICTION * gs.ship.thrust.x / 60;
        gs.ship.thrust.y -= FRICTION * gs.ship.thrust.y / 60;
      }

      gs.ship.x += gs.ship.thrust.x;
      gs.ship.y += gs.ship.thrust.y;
      gs.ship.angle += gs.ship.rotation;

      if (gs.ship.x < -gs.ship.radius) gs.ship.x = canvas.width + gs.ship.radius;
      else if (gs.ship.x > canvas.width + gs.ship.radius) gs.ship.x = -gs.ship.radius;
      if (gs.ship.y < -gs.ship.radius) gs.ship.y = canvas.height + gs.ship.radius;
      else if (gs.ship.y > canvas.height + gs.ship.radius) gs.ship.y = -gs.ship.radius;

      if (gs.ship.blinkNum > 0) {
        gs.ship.blinkTime -= 1;
        if (gs.ship.blinkTime <= 0) {
          gs.ship.blinkTime = Math.ceil(SHIP_BLINK_DUR * 60);
          gs.ship.blinkNum -= 1;
        }
      }
    }

    gs.asteroids.forEach((asteroid: any) => {
      asteroid.x += asteroid.xv;
      asteroid.y += asteroid.yv;
      if (asteroid.x < -asteroid.radius) asteroid.x = canvas.width + asteroid.radius;
      else if (asteroid.x > canvas.width + asteroid.radius) asteroid.x = -asteroid.radius;
      if (asteroid.y < -asteroid.radius) asteroid.y = canvas.height + asteroid.radius;
      else if (asteroid.y > canvas.height + asteroid.radius) asteroid.y = -asteroid.radius;
    });

    for (let i = gs.lasers.length - 1; i >= 0; i -= 1) {
      const laser = gs.lasers[i];
      laser.x += laser.xv;
      laser.y += laser.yv;
      laser.dist += Math.sqrt(laser.xv * laser.xv + laser.yv * laser.yv);
      if (laser.dist > LASER_DISTANCE * canvas.width) {
        gs.lasers.splice(i, 1);
      }
    }

    for (let i = gs.asteroids.length - 1; i >= 0; i -= 1) {
      const asteroid = gs.asteroids[i];

      if (gs.ship && !gs.ship.dead && gs.ship.blinkNum === 0 && !gs.shieldActive) {
        if (distBetweenPoints(gs.ship.x, gs.ship.y, asteroid.x, asteroid.y) < gs.ship.radius + asteroid.radius) {
          gs.ship.dead = true;
          setLives((current) => {
            if (current <= 1) {
              setGameOver(true);
            } else {
              if (gs.respawnTimeoutId !== null) {
                clearTimeout(gs.respawnTimeoutId);
              }
              gs.respawnTimeoutId = window.setTimeout(() => {
                createShip();
                gs.respawnTimeoutId = null;
              }, 1500);
            }
            return current - 1;
          });
        }
      }

      for (let j = gs.lasers.length - 1; j >= 0; j -= 1) {
        const laser = gs.lasers[j];
        if (distBetweenPoints(asteroid.x, asteroid.y, laser.x, laser.y) < asteroid.radius) {
          setScore((current) => current + (asteroid.radius > 40 ? 20 : asteroid.radius > 20 ? 50 : 100));
          if (asteroid.radius > 20) {
            gs.asteroids.push(newAsteroid(asteroid.x, asteroid.y, asteroid.radius / 2));
            gs.asteroids.push(newAsteroid(asteroid.x, asteroid.y, asteroid.radius / 2));
          }
          gs.asteroids.splice(i, 1);
          gs.lasers.splice(j, 1);
          break;
        }
      }
    }

    if (gs.asteroids.length === 0 && !gameOver) {
      setLevel((current) => {
        const nextLevel = current + 1;
        createAsteroidBelt(nextLevel);
        return nextLevel;
      });
    }

    drawAsteroidsScene(ctx, canvas, gs, gameOver);

    animationId = requestAnimationFrame(loop);
  };

  animationId = requestAnimationFrame(loop);

  return () => {
    if (gameState.current.respawnTimeoutId !== null) {
      clearTimeout(gameState.current.respawnTimeoutId);
      gameState.current.respawnTimeoutId = null;
    }
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    cancelAnimationFrame(animationId);
  };
}
