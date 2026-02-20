export type Direction = 'up' | 'down' | 'left' | 'right';
export type Tile = '#' | '.' | 'o' | ' ';

export interface Position {
  row: number;
  col: number;
}

export interface Ghost extends Position {
  dir: Direction;
  color: string;
}

export const TILE_SIZE = 24;
export const BASE_SPEED_MS = 150;
export const MIN_SPEED_MS = 85;
export const SPEED_STEP_MS = 10;
export const STARTING_LIVES = 3;

export const MAZE_TEMPLATE = [
  '###################',
  '#o.......#.......o#',
  '#.###.##.#.##.###.#',
  '#.#.............#.#',
  '#.#.##.#####.##.#.#',
  '#.....#.....#.....#',
  '#####.#.###.#.#####',
  '#.......#.#.......#',
  '#.###.#.#.#.#.###.#',
  '#o#...#.....#...#o#',
  '#.#.###.###.###.#.#',
  '#.................#',
  '#.###.##.#.##.###.#',
  '#...#....#....#...#',
  '###.#.#######.#.###',
  '#.....#.....#.....#',
  '#.###.#.###.#.###.#',
  '#o....#.. ..#....o#',
  '#.###.##.#.##.###.#',
  '#........#........#',
  '###################',
] as const;

export const DIR_DELTA: Record<Direction, { row: number; col: number }> = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
};

export const OPPOSITE_DIR: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export const PACMAN_START: Position = { row: 11, col: 9 };

export const GHOST_STARTS: Ghost[] = [
  { row: 9, col: 8, dir: 'right', color: '#ff4d4d' },
  { row: 9, col: 10, dir: 'left', color: '#66e0ff' },
  { row: 10, col: 9, dir: 'up', color: '#ff9f43' },
];

export function parseMaze(): Tile[][] {
  return MAZE_TEMPLATE.map((row) => row.split('') as Tile[]);
}

export function canMove(maze: Tile[][], pos: Position, dir: Direction): boolean {
  const next = DIR_DELTA[dir];
  const nextRow = pos.row + next.row;
  const nextCol = pos.col + next.col;
  const tile = maze[nextRow]?.[nextCol];
  return tile !== undefined && tile !== '#';
}

export function move(pos: Position, dir: Direction): Position {
  const delta = DIR_DELTA[dir];
  return { row: pos.row + delta.row, col: pos.col + delta.col };
}

export function countPellets(maze: Tile[][]): number {
  let total = 0;
  maze.forEach((row) => {
    row.forEach((tile) => {
      if (tile === '.' || tile === 'o') total += 1;
    });
  });
  return total;
}

export function cloneGhostStarts(): Ghost[] {
  return GHOST_STARTS.map((ghost) => ({ ...ghost }));
}
