import React from 'react';
import { LASER_SPEED, SHIELD_DUR, TURN_SPEED } from './asteroidsConfig';

type ControlsOptions = {
  gameState: React.MutableRefObject<any>;
  setShieldReady: React.Dispatch<React.SetStateAction<boolean>>;
};

export function createAsteroidsControls({ gameState, setShieldReady }: ControlsOptions) {
  const handleKeyDown = (event: KeyboardEvent) => {
    const gs = gameState.current;
    if (!gs.ship || gs.ship.dead) {
      return;
    }

    switch (event.key) {
      case 'ArrowLeft':
        gs.ship.rotation = (TURN_SPEED / 180) * Math.PI / 60;
        break;
      case 'ArrowRight':
        gs.ship.rotation = (-TURN_SPEED / 180) * Math.PI / 60;
        break;
      case 'ArrowUp':
        gs.ship.thrusting = true;
        break;
      case ' ': {
        if (!gs.ship.canShoot) {
          break;
        }
        gs.lasers.push({
          x: gs.ship.x + (4 / 3) * gs.ship.radius * Math.cos(gs.ship.angle),
          y: gs.ship.y - (4 / 3) * gs.ship.radius * Math.sin(gs.ship.angle),
          xv: LASER_SPEED * Math.cos(gs.ship.angle) / 60,
          yv: -LASER_SPEED * Math.sin(gs.ship.angle) / 60,
          dist: 0,
          explodeTime: 0,
        });
        gs.ship.canShoot = false;
        setTimeout(() => {
          if (gs.ship) {
            gs.ship.canShoot = true;
          }
        }, 300);
        break;
      }
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

  const handleKeyUp = (event: KeyboardEvent) => {
    const gs = gameState.current;
    if (!gs.ship) {
      return;
    }
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowRight':
        gs.ship.rotation = 0;
        break;
      case 'ArrowUp':
        gs.ship.thrusting = false;
        break;
    }
  };

  return { handleKeyDown, handleKeyUp };
}
