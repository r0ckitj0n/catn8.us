import React, { useRef } from 'react';
import { PageLayout } from '../layout/PageLayout';
import { useTetris } from '../../hooks/useTetris';

export function TetrisPage(props: any) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    score, level, lines, gameStarted, paused, gameOver, startGame, togglePause
  } = useTetris(canvasRef);

  return (
    <PageLayout {...props}>
      <div className="container py-4 text-white">
        <h1 className="text-center mb-4" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
          Tetris Adventure!
        </h1>
        
        <div className="row g-4 justify-content-center">
          <div className="col-lg-3">
            <div className="catn8-card p-3 mb-3 bg-opacity-25 bg-white">
              <p>Welcome to our Tetris playground! Build something wonderful piece by piece!</p>
            </div>
            <div className="catn8-card p-3 bg-opacity-25 bg-white">
              <p>Did you know? Tetris helps our brains grow stronger!</p>
            </div>
          </div>

          <div className="col-lg-4 d-flex justify-content-center">
            <canvas 
              ref={canvasRef} 
              width={300} 
              height={600} 
              className="bg-white rounded shadow-lg border border-primary border-4"
            />
          </div>

          <div className="col-lg-3">
            <div className="catn8-card p-3 mb-3 bg-opacity-25 bg-white">
              <div className="mb-2">Score: <span className="fw-bold text-warning">{score}</span></div>
              <div className="mb-2">Level: <span className="fw-bold text-info">{level}</span></div>
              <div className="mb-2">Lines: <span className="fw-bold text-success">{lines}</span></div>
            </div>

            <div className="catn8-card p-3 bg-opacity-25 bg-white">
              <button 
                className="btn btn-primary w-100 mb-2 rounded-pill" 
                onClick={startGame}
              >
                {gameOver || !gameStarted ? 'Start Game' : 'Restart'}
              </button>
              <button 
                className="btn btn-outline-light w-100 mb-3 rounded-pill" 
                onClick={togglePause}
                disabled={!gameStarted || gameOver}
              >
                {paused ? 'Resume' : 'Pause'}
              </button>
              
              <div className="small opacity-75">
                <strong>How to play:</strong>
                <ul className="ps-3 mb-0">
                  <li>← / → : Move</li>
                  <li>↑ : Rotate</li>
                  <li>↓ : Faster</li>
                  <li>Space : Drop</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
