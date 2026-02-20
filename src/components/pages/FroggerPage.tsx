import React, { useRef } from 'react';
import { PageLayout } from '../layout/PageLayout';
import { useFrogger } from '../../hooks/useFrogger';
import './ArcadeGamePages.css';

export function FroggerPage(props: any) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    level, lives, score, timeLeft, gameStarted, paused, gameOver, startGame, togglePause
  } = useFrogger(canvasRef);

  return (
    <PageLayout {...props}>
      <div className="container py-4 catn8-arcade-shell">
        <h1 className="text-center mb-4 catn8-arcade-title">
          Frogger Adventure!
        </h1>
        
        <div className="row g-4">
          <div className="col-lg-3">
            <div className="catn8-card p-3 mb-3 catn8-arcade-card">
              <p>Welcome to our Frogger adventure! Every hop takes us closer to new friends!</p>
            </div>
            <div className="catn8-card p-3 catn8-arcade-card">
              <p>Did you know? Frogger helps improve focus and timing skills!</p>
            </div>
          </div>

          <div className="col-lg-6 d-flex justify-content-center">
            <canvas 
              ref={canvasRef} 
              width={480} 
              height={520} 
              className="bg-dark rounded shadow-lg border border-primary border-4"
            />
          </div>

          <div className="col-lg-3">
            <div className="catn8-card p-3 mb-3 catn8-arcade-card">
              <div className="mb-2">Score: <span className="fw-bold catn8-arcade-stat-score">{score}</span></div>
              <div className="mb-2">Level: <span className="fw-bold catn8-arcade-stat-level">{level}</span></div>
              <div className="mb-2">Lives: <span className="fw-bold catn8-arcade-stat-lives">{lives}</span></div>
              <div className="mb-2">Time: <span className="fw-bold">{timeLeft}</span></div>
            </div>

            <div className="catn8-card p-3 catn8-arcade-card">
              <button 
                className="btn btn-primary w-100 mb-2 rounded-pill" 
                onClick={startGame}
              >
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
                  <li>Get to lily pads!</li>
                  <li>Avoid cars & water</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
