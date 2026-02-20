import React from 'react';

const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = 30;

const COLORS = [
  null,
  '#FF6B6B', // I
  '#4ECDC4', // J
  '#FFD166', // L
  '#06D6A0', // O
  '#118AB2', // S
  '#EF476F', // T
  '#73D2DE'  // Z
];

const PIECES = [
  [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]],
  [[0, 2, 0], [0, 2, 0], [2, 2, 0]],
  [[0, 3, 0], [0, 3, 0], [0, 3, 3]],
  [[4, 4], [4, 4]],
  [[0, 5, 5], [5, 5, 0], [0, 0, 0]],
  [[0, 0, 0], [6, 6, 6], [0, 6, 0]],
  [[7, 7, 0], [0, 7, 7], [0, 0, 0]]
];

export function useTetris(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const [score, setScore] = React.useState(0);
  const [level, setLevel] = React.useState(1);
  const [lines, setLines] = React.useState(0);
  const [gameStarted, setGameStarted] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const [gameOver, setGameOver] = React.useState(false);

  const gameState = React.useRef({
    board: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
    player: { pos: { x: 0, y: 0 }, piece: null as any },
    dropCounter: 0,
    lastTime: 0
  });

  const checkCollision = React.useCallback((pos: { x: number, y: number }, piece: number[][]) => {
    for (let y = 0; y < piece.length; y++) {
      for (let x = 0; x < piece[y].length; x++) {
        if (piece[y][x] !== 0) {
          const by = y + pos.y;
          const bx = x + pos.x;
          if (bx < 0 || bx >= COLS || by >= ROWS || (by >= 0 && gameState.current.board[by][bx] !== 0)) {
            return true;
          }
        }
      }
    }
    return false;
  }, []);

  const resetPlayer = React.useCallback(() => {
    const p = PIECES[Math.floor(Math.random() * PIECES.length)];
    gameState.current.player.piece = JSON.parse(JSON.stringify(p));
    gameState.current.player.pos = { x: Math.floor((COLS - p[0].length) / 2), y: 0 };
    if (checkCollision(gameState.current.player.pos, gameState.current.player.piece)) {
      setGameOver(true);
    }
  }, [checkCollision]);

  const merge = React.useCallback(() => {
    const gs = gameState.current;
    gs.player.piece.forEach((row: number[], y: number) => {
      row.forEach((val: number, x: number) => {
        if (val !== 0) {
          const by = y + gs.player.pos.y;
          const bx = x + gs.player.pos.x;
          if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
            gs.board[by][bx] = val;
          }
        }
      });
    });
  }, []);

  const clearRows = React.useCallback(() => {
    let count = 0;
    const gs = gameState.current;
    outer: for (let y = ROWS - 1; y >= 0; y--) {
      for (let x = 0; x < COLS; x++) {
        if (gs.board[y][x] === 0) continue outer;
      }
      const row = gs.board.splice(y, 1)[0].fill(0);
      gs.board.unshift(row);
      y++;
      count++;
    }
    if (count > 0) {
      setLines((currentLines) => {
        const nextLines = currentLines + count;
        setLevel(Math.floor(nextLines / 10) + 1);
        return nextLines;
      });
      setScore(s => s + [0, 40, 100, 300, 1200][count] * level);
    }
  }, [level]);

  const drop = React.useCallback(() => {
    const gs = gameState.current;
    gs.player.pos.y++;
    if (checkCollision(gs.player.pos, gs.player.piece)) {
      gs.player.pos.y--;
      merge();
      resetPlayer();
      clearRows();
    }
    gs.dropCounter = 0;
  }, [checkCollision, merge, resetPlayer, clearRows]);

  const move = React.useCallback((dir: number) => {
    const gs = gameState.current;
    gs.player.pos.x += dir;
    if (checkCollision(gs.player.pos, gs.player.piece)) {
      gs.player.pos.x -= dir;
    }
  }, [checkCollision]);

  const rotate = React.useCallback(() => {
    const gs = gameState.current;
    const p = gs.player.piece;
    const rotated = p[0].map((_, i) => p.map(row => row[i]).reverse());
    const oldX = gs.player.pos.x;
    let offset = 1;
    gs.player.piece = rotated;
    while (checkCollision(gs.player.pos, gs.player.piece)) {
      gs.player.pos.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (offset > p[0].length) {
        gs.player.piece = p;
        gs.player.pos.x = oldX;
        return;
      }
    }
  }, [checkCollision]);

  const startGame = React.useCallback(() => {
    gameState.current.board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    gameState.current.dropCounter = 0;
    gameState.current.lastTime = 0;
    setScore(0); setLevel(1); setLines(0); setGameOver(false); setPaused(false);
    resetPlayer();
    setGameStarted(true);
  }, [resetPlayer]);

  React.useEffect(() => {
    if (!gameStarted || paused || gameOver) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    gameState.current.lastTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === 'ArrowLeft') move(-1);
      if (e.key === 'ArrowRight') move(1);
      if (e.key === 'ArrowDown') drop();
      if (e.key === 'ArrowUp') rotate();
      if (e.key === ' ') { while(!checkCollision({x: gameState.current.player.pos.x, y: gameState.current.player.pos.y + 1}, gameState.current.player.piece)) gameState.current.player.pos.y++; drop(); }
    };
    window.addEventListener('keydown', handleKeyDown);

    let aniId: number;
    const loop = (time: number) => {
      const gs = gameState.current;
      if (!gs.lastTime) gs.lastTime = time;
      const dt = time - gs.lastTime;
      gs.lastTime = time;
      gs.dropCounter += dt;
      if (gs.dropCounter > Math.max(100, 1000 - (level - 1) * 100)) drop();

      ctx.fillStyle = '#f0f0f0'; ctx.fillRect(0, 0, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);
      ctx.strokeStyle = '#ddd';
      for (let i = 0; i <= ROWS; i++) { ctx.beginPath(); ctx.moveTo(0, i * BLOCK_SIZE); ctx.lineTo(COLS * BLOCK_SIZE, i * BLOCK_SIZE); ctx.stroke(); }
      for (let i = 0; i <= COLS; i++) { ctx.beginPath(); ctx.moveTo(i * BLOCK_SIZE, 0); ctx.lineTo(i * BLOCK_SIZE, ROWS * BLOCK_SIZE); ctx.stroke(); }

      gs.board.forEach((row, y) => row.forEach((val, x) => {
        if (val !== 0) { ctx.fillStyle = COLORS[val]!; ctx.fillRect(x*BLOCK_SIZE, y*BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE); ctx.strokeStyle = '#fff'; ctx.strokeRect(x*BLOCK_SIZE, y*BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE); }
      }));
      if (gs.player.piece) {
        gs.player.piece.forEach((row: number[], y: number) => row.forEach((val: number, x: number) => {
          if (val !== 0) { ctx.fillStyle = COLORS[val]!; ctx.fillRect((gs.player.pos.x+x)*BLOCK_SIZE, (gs.player.pos.y+y)*BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE); ctx.strokeStyle = '#fff'; ctx.strokeRect((gs.player.pos.x+x)*BLOCK_SIZE, (gs.player.pos.y+y)*BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE); }
        }));
      }
      if (gameOver) { ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, COLS*BLOCK_SIZE, ROWS*BLOCK_SIZE); ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.font = '30px Comic Neue'; ctx.fillText('Game Over!', (COLS*BLOCK_SIZE)/2, (ROWS*BLOCK_SIZE)/2); }
      aniId = requestAnimationFrame(loop);
    };
    aniId = requestAnimationFrame(loop);
    return () => { window.removeEventListener('keydown', handleKeyDown); cancelAnimationFrame(aniId); };
  }, [gameStarted, paused, gameOver, canvasRef, move, drop, rotate, level, checkCollision]);

  return { score, level, lines, gameStarted, paused, gameOver, startGame, togglePause: () => setPaused(p => !p) };
}
