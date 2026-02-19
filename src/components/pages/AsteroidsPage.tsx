import React, { useRef } from 'react';
import { PageLayout } from '../layout/PageLayout';
import { useAsteroids } from '../../hooks/useAsteroids';

export function AsteroidsPage(props: any) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    level, lives, score, gameStarted, paused, gameOver,
    shieldReady, shieldTimeLeft, shieldCooldownLeft,
    startGame, togglePause
  } = useAsteroids(canvasRef);

  const shieldActive = shieldTimeLeft > 0;

  return (
    <PageLayout {...props}>
      <div className="container py-4">
        <h1 className="text-center mb-4 text-white" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
          Asteroids Adventure!
        </h1>
        
        <div className="row g-4">
          <div className="col-lg-3">
            <div className="catn8-card p-3 mb-3 bg-opacity-25 bg-white text-white">
              <p>Welcome to our space adventure! Exploring the stars brings friends together!</p>
            </div>
            <div className="catn8-card p-3 bg-opacity-25 bg-white text-white">
              <p>Did you know? Asteroids helps improve hand-eye coordination!</p>
            </div>
          </div>

          <div className="col-lg-6 d-flex justify-content-center">
            <canvas 
              ref={canvasRef} 
              width={500} 
              height={500} 
              className="bg-black rounded shadow-lg border border-primary border-4"
            />
          </div>

          <div className="col-lg-3">
            <div className="catn8-card p-3 mb-3 bg-opacity-25 bg-white text-white">
              <div className="mb-2">Score: <span className="fw-bold text-warning">{score}</span></div>
              <div className="mb-2">Level: <span className="fw-bold text-info">{level}</span></div>
              <div className="mb-2">Lives: <span className="fw-bold text-danger">{lives}</span></div>
              <div className="mb-2">
                Shield: {shieldActive ? (
                  <span className="text-info">Active ({Math.ceil(shieldTimeLeft)}s)</span>
                ) : shieldReady ? (
                  <span className="text-success">Ready (Z)</span>
                ) : (
                  <span className="text-warning">Recharging ({Math.ceil(shieldCooldownLeft)}s)</span>
                )}
              </div>
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
                  <li>← / → : Rotate</li>
                  <li>↑ : Thrust</li>
                  <li>Space : Fire</li>
                  <li>Z : Shields</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
