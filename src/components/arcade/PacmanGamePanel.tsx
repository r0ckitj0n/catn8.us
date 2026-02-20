import React, { useRef } from 'react';
import { usePacman } from '../../hooks/usePacman';
import '../pages/ArcadeGamePages.css';

export function PacmanGamePanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    level,
    lives,
    score,
    pelletsLeft,
    gameStarted,
    paused,
    gameOver,
    startGame,
    togglePause,
  } = usePacman(canvasRef);

  return (
    <div className="container py-4 catn8-arcade-shell">
      <h1 className="text-center mb-4 catn8-arcade-title">Pac-man Maze Run!</h1>

      <div className="row g-4">
        <div className="col-lg-3">
          <div className="catn8-card p-3 mb-3 catn8-arcade-card">
            <p>Zip through the maze, clear every pellet, and dodge colorful ghosts.</p>
          </div>
          <div className="catn8-card p-3 catn8-arcade-card">
            <p>Tip: set your next turn early with arrow keys to stay ahead of corners.</p>
          </div>
        </div>

        <div className="col-lg-6 d-flex justify-content-center">
          <canvas
            ref={canvasRef}
            width={456}
            height={504}
            className="catn8-arcade-canvas bg-black rounded shadow-lg border border-primary border-4"
          />
        </div>

        <div className="col-lg-3">
          <div className="catn8-card p-3 mb-3 catn8-arcade-card">
            <div className="mb-2">Score: <span className="fw-bold catn8-arcade-stat-score">{score}</span></div>
            <div className="mb-2">Level: <span className="fw-bold catn8-arcade-stat-level">{level}</span></div>
            <div className="mb-2">Lives: <span className="fw-bold catn8-arcade-stat-lives">{lives}</span></div>
            <div className="mb-2">Pellets Left: <span className="fw-bold">{pelletsLeft}</span></div>
          </div>

          <div className="catn8-card p-3 catn8-arcade-card">
            <button className="btn btn-primary w-100 mb-2 rounded-pill" onClick={startGame}>
              {gameOver || !gameStarted ? 'Start Game' : 'Restart'}
            </button>
            <button
              className="btn btn-outline-primary w-100 mb-3 rounded-pill"
              onClick={togglePause}
              disabled={!gameStarted || gameOver}
            >
              {paused ? 'Resume' : 'Pause'}
            </button>

            <div className="small catn8-arcade-note">
              <strong>How to play:</strong>
              <ul className="ps-3 mb-0">
                <li>Arrow keys to move</li>
                <li>Eat all pellets to level up</li>
                <li>Avoid the ghosts</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
