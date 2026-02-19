import React, { useRef } from 'react';
import { PageLayout } from '../layout/PageLayout';
import { useFrogger } from '../../hooks/useFrogger';

export function FroggerPage(props: any) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    level, lives, score, timeLeft, gameStarted, paused, gameOver, startGame, togglePause
  } = useFrogger(canvasRef);

  return (
    <PageLayout {...props}>
      <div className="container py-4">
        <h1 className="text-center mb-4 text-white" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
          Frogger Adventure!
        </h1>
        
        <div className="row g-4">
          <div className="col-lg-3">
            <div className="catn8-card p-3 mb-3 bg-opacity-25 bg-white text-white">
              <p>Welcome to our Frogger adventure! Every hop takes us closer to new friends!</p>
            </div>
            <div className="catn8-card p-3 bg-opacity-25 bg-white text-white">
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
            <div className="catn8-card p-3 mb-3 bg-opacity-25 bg-white text-white">
              <div className="mb-2">Score: <span className="fw-bold text-warning">{score}</span></div>
              <div className="mb-2">Level: <span className="fw-bold text-info">{level}</span></div>
              <div className="mb-2">Lives: <span className="fw-bold text-danger">{lives}</span></div>
              <div className="mb-2">Time: <span className="fw-bold">{timeLeft}</span></div>
            </div>

            <div className="catn8-card p-3 bg-opacity-25 bg-white text-white">
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
