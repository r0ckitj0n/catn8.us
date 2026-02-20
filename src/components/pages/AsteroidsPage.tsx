import React, { useRef } from 'react';
import { PageLayout } from '../layout/PageLayout';
import { useAsteroids } from '../../hooks/useAsteroids';
import './ArcadeGamePages.css';

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
      <div className="container py-4 catn8-arcade-shell">
        <h1 className="text-center mb-4 catn8-arcade-title">
          Asteroids Adventure!
        </h1>
        
        <div className="row g-4">
          <div className="col-lg-3">
            <div className="catn8-card p-3 mb-3 catn8-arcade-card">
              <p>Welcome to our space adventure! Exploring the stars brings friends together!</p>
            </div>
            <div className="catn8-card p-3 catn8-arcade-card">
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
            <div className="catn8-card p-3 mb-3 catn8-arcade-card">
              <div className="mb-2">Score: <span className="fw-bold catn8-arcade-stat-score">{score}</span></div>
              <div className="mb-2">Level: <span className="fw-bold catn8-arcade-stat-level">{level}</span></div>
              <div className="mb-2">Lives: <span className="fw-bold catn8-arcade-stat-lives">{lives}</span></div>
              <div className="mb-2">
                Shield: {shieldActive ? (
                  <span className="catn8-arcade-stat-active">Active ({Math.ceil(shieldTimeLeft)}s)</span>
                ) : shieldReady ? (
                  <span className="catn8-arcade-stat-ready">Ready (Z)</span>
                ) : (
                  <span className="catn8-arcade-stat-cooldown">Recharging ({Math.ceil(shieldCooldownLeft)}s)</span>
                )}
              </div>
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
