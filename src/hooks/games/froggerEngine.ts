import { BASE_SPEEDS, FROG_START_X, FROG_START_Y, GAME_HEIGHT, GAME_WIDTH, GRID_SIZE, LEVEL_TIME, VEHICLE_TYPES } from './froggerConfig';

export type FroggerRuntimeState = {
  frog: { x: number; y: number; width: number; height: number; speed: number };
  cars: Array<{ x: number; y: number; width: number; height: number; speed: number; color: string; type: string }>;
  logs: Array<{ x: number; y: number; width: number; height: number; speed: number; logType: string }>;
  turtles: any[];
  lilyPads: Array<{ x: number; y: number; width: number; height: number; reached: boolean }>;
  showCongratulations: boolean;
  congratulationsTimer: number;
  levelTimer: number;
  lastTime: number;
};

export function createInitialFroggerState(): FroggerRuntimeState {
  return {
    frog: createFrog(),
    cars: [],
    logs: [],
    turtles: [],
    lilyPads: [],
    showCongratulations: false,
    congratulationsTimer: 0,
    levelTimer: LEVEL_TIME,
    lastTime: 0,
  };
}

export function createFrog() {
  return { x: FROG_START_X, y: FROG_START_Y, width: GRID_SIZE - 10, height: GRID_SIZE - 10, speed: GRID_SIZE };
}

export function setupFroggerLevel(state: FroggerRuntimeState, level: number): void {
  state.lilyPads = [];
  for (let i = 0; i < 9; i += 1) {
    state.lilyPads.push({ x: i * (GAME_WIDTH / 9) + (GAME_WIDTH / 18), y: 40, width: 40, height: 40, reached: false });
  }

  const carCount = Math.min(4, Math.floor(1 + Math.floor(level / 2)));
  const logCount = Math.max(4, Math.floor(12 - (level * 2)));

  state.cars = [];
  state.logs = [];
  state.turtles = [];

  createCarRow(state, GAME_HEIGHT - 2 * GRID_SIZE, carCount, 'smallCar', true);
  createCarRow(state, GAME_HEIGHT - 3 * GRID_SIZE, carCount, 'mediumCar', false);
  createCarRow(state, GAME_HEIGHT - 4 * GRID_SIZE, carCount, 'largeCar', true);
  createCarRow(state, GAME_HEIGHT - 5 * GRID_SIZE, carCount, 'truck', false);

  createLogRow(state, GAME_HEIGHT - 7 * GRID_SIZE, logCount, 'log1', true);
  createLogRow(state, GAME_HEIGHT - 9 * GRID_SIZE, logCount, 'log2', true);
  createLogRow(state, GAME_HEIGHT - 11 * GRID_SIZE, logCount, 'log1', true);
}

function createCarRow(state: FroggerRuntimeState, y: number, count: number, carType: string, reverse: boolean): void {
  const vehicleType = VEHICLE_TYPES[carType];
  const spacing = GAME_WIDTH / count;
  for (let i = 0; i < count; i += 1) {
    const x = i * spacing + (Math.random() - 0.5) * (spacing * 0.3);
    state.cars.push({
      x,
      y,
      width: vehicleType.width,
      height: vehicleType.height,
      speed: reverse ? -BASE_SPEEDS[vehicleType.speed] : BASE_SPEEDS[vehicleType.speed],
      color: vehicleType.color,
      type: carType,
    });
  }
}

function createLogRow(state: FroggerRuntimeState, y: number, count: number, logType: string, reverse: boolean): void {
  const spacing = GAME_WIDTH / count;
  for (let i = 0; i < count; i += 1) {
    const x = i * spacing + (Math.random() - 0.5) * (spacing * 0.3);
    state.logs.push({
      x,
      y,
      width: GRID_SIZE,
      height: GRID_SIZE - 10,
      speed: reverse ? -BASE_SPEEDS[logType] : BASE_SPEEDS[logType],
      logType,
    });
  }
}
