import React from 'react';

const SHIP_SIZE = 20;
const SHIP_THRUST = 5;
const TURN_SPEED = 360;
const FRICTION = 0.7;
const LASER_MAX = 10;
const LASER_SPEED = 500;
const LASER_DISTANCE = 0.6;
const ASTEROID_NUM = 3;
const ASTEROID_SIZE = 100;
const ASTEROID_SPEED = 50;
const ASTEROID_VERT = 10;
const ASTEROID_JAG = 0.4;
const SHIP_INV_DUR = 3;
const SHIP_BLINK_DUR = 0.1;
const SHIELD_DUR = 3;
const SHIELD_COOLDOWN = 8;
const GAME_LIVES = 3;

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

  const distBetweenPoints = (x1: number, y1: number, x2: number, y2: number) => {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  };

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

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const gs = gameState.current;
      if (!gs.ship || gs.ship.dead) return;
      switch (e.key) {
        case 'ArrowLeft': gs.ship.rotation = TURN_SPEED / 180 * Math.PI / 60; break;
        case 'ArrowRight': gs.ship.rotation = -TURN_SPEED / 180 * Math.PI / 60; break;
        case 'ArrowUp': gs.ship.thrusting = true; break;
        case ' ': 
          if (gs.ship.canShoot) {
            gs.lasers.push({
              x: gs.ship.x + 4/3 * gs.ship.radius * Math.cos(gs.ship.angle),
              y: gs.ship.y - 4/3 * gs.ship.radius * Math.sin(gs.ship.angle),
              xv: LASER_SPEED * Math.cos(gs.ship.angle) / 60,
              yv: -LASER_SPEED * Math.sin(gs.ship.angle) / 60,
              dist: 0, explodeTime: 0
            });
            gs.ship.canShoot = false;
            setTimeout(() => { if (gs.ship) gs.ship.canShoot = true; }, 300);
          }
          break;
        case 'z':
        case 'Z':
          if (!gs.shieldActive && gs.shieldCooldown <= 0) {
            gs.shieldActive = true;
            gs.shieldTimer = SHIELD_DUR;
            setShieldReady(false);
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const gs = gameState.current;
      if (!gs.ship) return;
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowRight': gs.ship.rotation = 0; break;
        case 'ArrowUp': gs.ship.thrusting = false; break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let animationId: number;
    const loop = (time: number) => {
      const gs = gameState.current;
      if (gs.lastTime === 0) gs.lastTime = time;
      const dt = (time - gs.lastTime) / 1000;
      gs.lastTime = time;

      // Update Shield
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
        if (gs.shieldCooldown <= 0) setShieldReady(true);
      }

      // Update Ship
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

        // Wrap
        if (gs.ship.x < -gs.ship.radius) gs.ship.x = canvas.width + gs.ship.radius;
        else if (gs.ship.x > canvas.width + gs.ship.radius) gs.ship.x = -gs.ship.radius;
        if (gs.ship.y < -gs.ship.radius) gs.ship.y = canvas.height + gs.ship.radius;
        else if (gs.ship.y > canvas.height + gs.ship.radius) gs.ship.y = -gs.ship.radius;

        // Blink
        if (gs.ship.blinkNum > 0) {
          gs.ship.blinkTime--;
          if (gs.ship.blinkTime <= 0) {
            gs.ship.blinkTime = Math.ceil(SHIP_BLINK_DUR * 60);
            gs.ship.blinkNum--;
          }
        }
      }

      // Update Asteroids
      gs.asteroids.forEach(a => {
        a.x += a.xv; a.y += a.yv;
        if (a.x < -a.radius) a.x = canvas.width + a.radius;
        else if (a.x > canvas.width + a.radius) a.x = -a.radius;
        if (a.y < -a.radius) a.y = canvas.height + a.radius;
        else if (a.y > canvas.height + a.radius) a.y = -a.radius;
      });

      // Update Lasers
      for (let i = gs.lasers.length - 1; i >= 0; i--) {
        const l = gs.lasers[i];
        l.x += l.xv; l.y += l.yv;
        l.dist += Math.sqrt(l.xv*l.xv + l.yv*l.yv);
        if (l.dist > LASER_DISTANCE * canvas.width) gs.lasers.splice(i, 1);
      }

      // Collisions
      for (let i = gs.asteroids.length - 1; i >= 0; i--) {
        const a = gs.asteroids[i];
        // Asteroid vs Ship
        if (gs.ship && !gs.ship.dead && gs.ship.blinkNum === 0 && !gs.shieldActive) {
          if (distBetweenPoints(gs.ship.x, gs.ship.y, a.x, a.y) < gs.ship.radius + a.radius) {
            gs.ship.dead = true;
            setLives(l => {
              if (l <= 1) setGameOver(true);
              else setTimeout(createShip, 1500);
              return l - 1;
            });
          }
        }
        // Asteroid vs Laser
        for (let j = gs.lasers.length - 1; j >= 0; j--) {
          const l = gs.lasers[j];
          if (distBetweenPoints(a.x, a.y, l.x, l.y) < a.radius) {
            setScore(s => s + (a.radius > 40 ? 20 : a.radius > 20 ? 50 : 100));
            if (a.radius > 20) {
              gs.asteroids.push(newAsteroid(a.x, a.y, a.radius / 2));
              gs.asteroids.push(newAsteroid(a.x, a.y, a.radius / 2));
            }
            gs.asteroids.splice(i, 1);
            gs.lasers.splice(j, 1);
            break;
          }
        }
      }

      if (gs.asteroids.length === 0 && !gameOver) {
        setLevel(l => l + 1);
        createAsteroidBelt();
      }

      // DRAW
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw Ship
      if (gs.ship && !gs.ship.dead && (gs.ship.blinkNum % 2 === 0)) {
        ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.beginPath();
        ctx.moveTo(gs.ship.x + 4/3 * gs.ship.radius * Math.cos(gs.ship.angle), gs.ship.y - 4/3 * gs.ship.radius * Math.sin(gs.ship.angle));
        ctx.lineTo(gs.ship.x - gs.ship.radius * (2/3) * Math.cos(gs.ship.angle) + gs.ship.radius * Math.sin(gs.ship.angle), gs.ship.y + gs.ship.radius * (2/3) * Math.sin(gs.ship.angle) + gs.ship.radius * Math.cos(gs.ship.angle));
        ctx.lineTo(gs.ship.x - gs.ship.radius * (2/3) * Math.cos(gs.ship.angle) - gs.ship.radius * Math.sin(gs.ship.angle), gs.ship.y + gs.ship.radius * (2/3) * Math.sin(gs.ship.angle) - gs.ship.radius * Math.cos(gs.ship.angle));
        ctx.closePath(); ctx.stroke();
        if (gs.shieldActive) {
          ctx.strokeStyle = "#4ECDC4"; ctx.lineWidth = 3; ctx.beginPath();
          ctx.arc(gs.ship.x, gs.ship.y, gs.ship.radius * 1.5, 0, Math.PI * 2); ctx.stroke();
        }
      }

      // Draw Asteroids
      ctx.strokeStyle = "white"; ctx.lineWidth = 2;
      gs.asteroids.forEach(a => {
        ctx.beginPath();
        ctx.moveTo(a.x + a.radius * a.offs[0] * Math.cos(a.angle), a.y + a.radius * a.offs[0] * Math.sin(a.angle));
        for (let j = 1; j < a.vert; j++) {
          ctx.lineTo(a.x + a.radius * a.offs[j] * Math.cos(a.angle + j * Math.PI * 2 / a.vert), a.y + a.radius * a.offs[j] * Math.sin(a.angle + j * Math.PI * 2 / a.vert));
        }
        ctx.closePath(); ctx.stroke();
      });

      // Draw Lasers
      ctx.fillStyle = "#FF6B6B";
      gs.lasers.forEach(l => { ctx.beginPath(); ctx.arc(l.x, l.y, 2, 0, Math.PI * 2); ctx.fill(); });

      if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.font = '30px Comic Neue';
        ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2);
      }

      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationId);
    };
  }, [gameStarted, paused, gameOver, canvasRef, createShip, createAsteroidBelt, newAsteroid]);

  return { level, lives, score, gameStarted, paused, gameOver, shieldReady, shieldTimeLeft, shieldCooldownLeft, startGame, togglePause };
}
