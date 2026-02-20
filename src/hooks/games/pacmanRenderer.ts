import { Ghost, Tile, TILE_SIZE } from './pacmanConfig';

interface DrawPacmanSceneArgs {
  ctx: CanvasRenderingContext2D;
  maze: Tile[][];
  pacman: { row: number; col: number };
  ghosts: Ghost[];
  gameStarted: boolean;
  gameOver: boolean;
}

export function drawPacmanScene({ ctx, maze, pacman, ghosts, gameStarted, gameOver }: DrawPacmanSceneArgs): void {
  const width = maze[0].length * TILE_SIZE;
  const height = maze.length * TILE_SIZE;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  maze.forEach((row, rowIndex) => {
    row.forEach((tile, colIndex) => {
      const x = colIndex * TILE_SIZE;
      const y = rowIndex * TILE_SIZE;

      if (tile === '#') {
        ctx.fillStyle = '#1e5fff';
        ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      }
      if (tile === '.') {
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (tile === 'o') {
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  });

  const pacX = pacman.col * TILE_SIZE + TILE_SIZE / 2;
  const pacY = pacman.row * TILE_SIZE + TILE_SIZE / 2;
  ctx.fillStyle = '#ffe600';
  ctx.beginPath();
  ctx.arc(pacX, pacY, TILE_SIZE / 2 - 2, 0.25 * Math.PI, 1.75 * Math.PI);
  ctx.lineTo(pacX, pacY);
  ctx.closePath();
  ctx.fill();

  ghosts.forEach((ghost) => {
    const x = ghost.col * TILE_SIZE + TILE_SIZE / 2;
    const y = ghost.row * TILE_SIZE + TILE_SIZE / 2;
    ctx.fillStyle = ghost.color;
    ctx.beginPath();
    ctx.arc(x, y - 3, TILE_SIZE / 2 - 3, Math.PI, 2 * Math.PI);
    ctx.lineTo(x + TILE_SIZE / 2 - 3, y + TILE_SIZE / 2 - 3);
    ctx.lineTo(x - TILE_SIZE / 2 + 3, y + TILE_SIZE / 2 - 3);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - 4, y - 4, 2.5, 0, Math.PI * 2);
    ctx.arc(x + 4, y - 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  if (!gameStarted) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press Start', width / 2, height / 2);
  }

  if (gameOver) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.font = '32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', width / 2, height / 2);
  }
}
