import React from 'react';
import {
  BASE_SPEED_MS,
  canMove,
  cloneGhostStarts,
  countPellets,
  Direction,
  MIN_SPEED_MS,
  move,
  OPPOSITE_DIR,
  PACMAN_START,
  parseMaze,
  SPEED_STEP_MS,
  STARTING_LIVES,
  TILE_SIZE,
} from './games/pacmanConfig';
import { drawPacmanScene } from './games/pacmanRenderer';

export function usePacman(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const initialMaze = React.useMemo(() => parseMaze(), []);
  const [level, setLevel] = React.useState(1);
  const [lives, setLives] = React.useState(STARTING_LIVES);
  const [score, setScore] = React.useState(0);
  const [pelletsLeft, setPelletsLeft] = React.useState(() => countPellets(initialMaze));
  const [gameStarted, setGameStarted] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const [gameOver, setGameOver] = React.useState(false);

  const gameRef = React.useRef({
    maze: initialMaze,
    pacman: { ...PACMAN_START },
    direction: 'left' as Direction,
    pendingDirection: 'left' as Direction,
    ghosts: cloneGhostStarts(),
  });

  const resetPositions = React.useCallback(() => {
    gameRef.current.pacman = { ...PACMAN_START };
    gameRef.current.direction = 'left';
    gameRef.current.pendingDirection = 'left';
    gameRef.current.ghosts = cloneGhostStarts();
  }, []);

  const resetBoard = React.useCallback((keepScore: boolean) => {
    gameRef.current.maze = parseMaze();
    resetPositions();
    setPelletsLeft(countPellets(gameRef.current.maze));

    if (!keepScore) {
      setScore(0);
      setLevel(1);
      setLives(STARTING_LIVES);
    }
  }, [resetPositions]);

  const startGame = React.useCallback(() => {
    setPaused(false);
    setGameOver(false);
    setGameStarted(true);
    resetBoard(false);
  }, [resetBoard]);

  const togglePause = React.useCallback(() => {
    setPaused((value) => !value);
  }, []);

  React.useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!gameStarted || gameOver) return;
      const keyToDir: Record<string, Direction> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
      };
      const next = keyToDir[event.key];
      if (!next) return;
      event.preventDefault();
      gameRef.current.pendingDirection = next;
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameOver, gameStarted]);

  React.useEffect(() => {
    if (!gameStarted || paused || gameOver) return;

    const tick = window.setInterval(() => {
      const state = gameRef.current;

      if (canMove(state.maze, state.pacman, state.pendingDirection)) {
        state.direction = state.pendingDirection;
      }
      if (canMove(state.maze, state.pacman, state.direction)) {
        state.pacman = move(state.pacman, state.direction);
      }

      const pacTile = state.maze[state.pacman.row][state.pacman.col];
      if (pacTile === '.' || pacTile === 'o') {
        state.maze[state.pacman.row][state.pacman.col] = ' ';
        setScore((value) => value + (pacTile === 'o' ? 50 : 10));
        setPelletsLeft((value) => Math.max(0, value - 1));
      }

      state.ghosts = state.ghosts.map((ghost) => {
        const valid = (['up', 'down', 'left', 'right'] as Direction[]).filter((dir) => canMove(state.maze, ghost, dir));
        const withoutReverse = valid.filter((dir) => dir !== OPPOSITE_DIR[ghost.dir]);
        const options = withoutReverse.length > 0 ? withoutReverse : valid;

        let nextDir = ghost.dir;
        if (!options.includes(nextDir) || Math.random() < 0.25) {
          nextDir = options[Math.floor(Math.random() * options.length)] ?? ghost.dir;
        }

        return {
          ...move(ghost, nextDir),
          dir: nextDir,
          color: ghost.color,
        };
      });

      const caught = state.ghosts.some((ghost) => ghost.row === state.pacman.row && ghost.col === state.pacman.col);
      if (caught) {
        setLives((value) => {
          const nextLives = value - 1;
          if (nextLives <= 0) {
            setGameOver(true);
            return 0;
          }
          resetPositions();
          return nextLives;
        });
      }

      if (state.maze.every((row) => row.every((tile) => tile !== '.' && tile !== 'o'))) {
        setLevel((value) => value + 1);
        resetBoard(true);
      }
    }, Math.max(MIN_SPEED_MS, BASE_SPEED_MS - (level - 1) * SPEED_STEP_MS));

    return () => window.clearInterval(tick);
  }, [gameOver, gameStarted, level, paused, resetBoard, resetPositions]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    canvas.width = gameRef.current.maze[0].length * TILE_SIZE;
    canvas.height = gameRef.current.maze.length * TILE_SIZE;

    drawPacmanScene({
      ctx,
      maze: gameRef.current.maze,
      pacman: gameRef.current.pacman,
      ghosts: gameRef.current.ghosts,
      gameStarted,
      gameOver,
    });
  }, [canvasRef, gameOver, gameStarted, level, lives, paused, pelletsLeft, score]);

  return {
    level,
    lives,
    score,
    pelletsLeft,
    gameStarted,
    paused,
    gameOver,
    startGame,
    togglePause,
  };
}
