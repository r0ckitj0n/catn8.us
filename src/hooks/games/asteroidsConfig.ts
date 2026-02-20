export const SHIP_SIZE = 20;
export const SHIP_THRUST = 5;
export const TURN_SPEED = 360;
export const FRICTION = 0.7;
export const LASER_MAX = 10;
export const LASER_SPEED = 500;
export const LASER_DISTANCE = 0.6;
export const ASTEROID_NUM = 3;
export const ASTEROID_SIZE = 100;
export const ASTEROID_SPEED = 50;
export const ASTEROID_VERT = 10;
export const ASTEROID_JAG = 0.4;
export const SHIP_INV_DUR = 3;
export const SHIP_BLINK_DUR = 0.1;
export const SHIELD_DUR = 3;
export const SHIELD_COOLDOWN = 8;
export const GAME_LIVES = 3;

export function distBetweenPoints(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}
