export const GRID_SIZE = 40;
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 520;
export const STARTING_LIVES = 3;
export const LEVEL_TIME = 600;
export const FROG_START_X = Math.floor(GAME_WIDTH / 2) - GRID_SIZE / 2;
export const FROG_START_Y = GAME_HEIGHT - GRID_SIZE;

export const BASE_SPEEDS: Record<string, number> = {
  car1: 0.4,
  car2: 0.6,
  car3: 0.8,
  car4: 0.3,
  log1: 0.5,
  log2: 0.4,
  turtle1: 0.4,
  turtle2: 0.5,
};

export const VEHICLE_TYPES: Record<string, { width: number; height: number; color: string; speed: string }> = {
  smallCar: { width: GRID_SIZE - 10, height: GRID_SIZE - 10, color: '#E74C3C', speed: 'car1' },
  mediumCar: { width: GRID_SIZE * 1.2, height: GRID_SIZE - 10, color: '#9B59B6', speed: 'car2' },
  largeCar: { width: GRID_SIZE * 1.5, height: GRID_SIZE - 10, color: '#E67E22', speed: 'car3' },
  truck: { width: GRID_SIZE * 2, height: GRID_SIZE - 10, color: '#1ABC9C', speed: 'car4' },
};

export const COLORS = {
  water: '#3498DB',
  road: '#34495E',
  grass: '#2ECC71',
  median: '#F1C40F',
  log: '#795548',
  frog: '#4ECDC4',
  lilyPad: '#2ECC71',
};

export function isColliding(obj1: any, obj2: any) {
  const margin = 8;
  return obj1.x + margin < obj2.x + obj2.width - margin
    && obj1.x + obj1.width - margin > obj2.x + margin
    && obj1.y + margin < obj2.y + obj2.height - margin
    && obj1.y + obj1.height - margin > obj2.y + margin;
}
