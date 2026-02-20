export function drawAsteroidsScene(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, gs: any, gameOver: boolean) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (gs.ship && !gs.ship.dead && gs.ship.blinkNum % 2 === 0) {
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gs.ship.x + (4 / 3) * gs.ship.radius * Math.cos(gs.ship.angle), gs.ship.y - (4 / 3) * gs.ship.radius * Math.sin(gs.ship.angle));
    ctx.lineTo(
      gs.ship.x - gs.ship.radius * (2 / 3) * Math.cos(gs.ship.angle) + gs.ship.radius * Math.sin(gs.ship.angle),
      gs.ship.y + gs.ship.radius * (2 / 3) * Math.sin(gs.ship.angle) + gs.ship.radius * Math.cos(gs.ship.angle),
    );
    ctx.lineTo(
      gs.ship.x - gs.ship.radius * (2 / 3) * Math.cos(gs.ship.angle) - gs.ship.radius * Math.sin(gs.ship.angle),
      gs.ship.y + gs.ship.radius * (2 / 3) * Math.sin(gs.ship.angle) - gs.ship.radius * Math.cos(gs.ship.angle),
    );
    ctx.closePath();
    ctx.stroke();

    if (gs.shieldActive) {
      ctx.strokeStyle = '#4ECDC4';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(gs.ship.x, gs.ship.y, gs.ship.radius * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  gs.asteroids.forEach((asteroid: any) => {
    ctx.beginPath();
    ctx.moveTo(
      asteroid.x + asteroid.radius * asteroid.offs[0] * Math.cos(asteroid.angle),
      asteroid.y + asteroid.radius * asteroid.offs[0] * Math.sin(asteroid.angle),
    );
    for (let j = 1; j < asteroid.vert; j += 1) {
      ctx.lineTo(
        asteroid.x + asteroid.radius * asteroid.offs[j] * Math.cos(asteroid.angle + j * Math.PI * 2 / asteroid.vert),
        asteroid.y + asteroid.radius * asteroid.offs[j] * Math.sin(asteroid.angle + j * Math.PI * 2 / asteroid.vert),
      );
    }
    ctx.closePath();
    ctx.stroke();
  });

  ctx.fillStyle = '#FF6B6B';
  gs.lasers.forEach((laser: any) => {
    ctx.beginPath();
    ctx.arc(laser.x, laser.y, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  if (gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.font = '30px Comic Neue';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
  }
}
