// Drawing only: the camera, the world (ground, skids, cars, people, bullets, particles,
// the player) and the HUD and panels for the screen the game is on. The world is drawn in
// world coordinates under one transform; the HUD is drawn in screen space.
import { COLORS, PLAYER } from './config.js';
import { drawGround } from './city.js';
import { drawHud, drawOver, drawPaused, drawTitle } from './hud.js';
import { TAU, clamp } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCar(ctx, car, time) {
  const spec = car.spec;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.heading);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRectPath(ctx, -spec.len / 2 + 3, -spec.wid / 2 + 4, spec.len, spec.wid, 7);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#1a1a1a';
  const wl = spec.len * 0.28, ww = 5;
  ctx.fillRect(-wl, -spec.wid / 2 - 2, 12, ww);
  ctx.fillRect(wl - 4, -spec.wid / 2 - 2, 12, ww);
  ctx.fillRect(-wl, spec.wid / 2 - 3, 12, ww);
  ctx.fillRect(wl - 4, spec.wid / 2 - 3, 12, ww);
  // Body.
  ctx.fillStyle = car.color;
  roundRectPath(ctx, -spec.len / 2, -spec.wid / 2, spec.len, spec.wid, 7);
  ctx.fill();
  // Roof + windshield.
  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  roundRectPath(ctx, -spec.len * 0.12, -spec.wid / 2 + 4, spec.len * 0.30, spec.wid - 8, 5);
  ctx.fill();
  ctx.fillStyle = '#20242c';
  ctx.fillRect(spec.len * 0.22, -spec.wid / 2 + 4, 7, spec.wid - 8);
  ctx.fillRect(-spec.len * 0.30, -spec.wid / 2 + 4, 5, spec.wid - 8);
  // Headlights and taillights.
  ctx.fillStyle = '#fff6c8';
  ctx.fillRect(spec.len / 2 - 2, -spec.wid / 2 + 3, 3, 5);
  ctx.fillRect(spec.len / 2 - 2, spec.wid / 2 - 8, 3, 5);
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(-spec.len / 2 - 1, -spec.wid / 2 + 3, 3, 5);
  ctx.fillRect(-spec.len / 2 - 1, spec.wid / 2 - 8, 3, 5);
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.fillRect(-6, -spec.wid / 2 + 2, 12, 6);
    ctx.fillStyle = '#f2c200';
    ctx.font = 'bold 5px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, -spec.wid / 2 + 7);
  }
  if (car.kind === 'police') {
    const phase = Math.floor((car.sirenPhase || 0) * 4) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2a2a' : '#2a6bff';
    ctx.fillRect(-4, -spec.wid / 2 - 1, 8, 5);
    ctx.fillStyle = phase ? '#2a6bff' : '#ff2a2a';
    ctx.fillRect(-4, spec.wid / 2 - 4, 8, 5);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 6px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 2);
  }
  // Damage smoke.
  if (car.health < 45) {
    ctx.fillStyle = 'rgba(90,90,90,0.5)';
    ctx.beginPath();
    ctx.arc(-spec.len * 0.2 + Math.sin(time * 9) * 3, 0, 6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // Burnt-out husk.
  if (car.dead) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.heading);
    ctx.fillStyle = 'rgba(20,16,14,0.85)';
    roundRectPath(ctx, -spec.len / 2, -spec.wid / 2, spec.len, spec.wid, 7);
    ctx.fill();
    ctx.restore();
  }
}

function drawPed(ctx, ped, time) {
  if (ped.state === 'down') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(ped.x + 3, ped.y + 4, 12, 6, ped.heading, 0, TAU); ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.ellipse(ped.x, ped.y, 12, 6, ped.heading, 0, TAU); ctx.fill();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.arc(ped.x + 2, ped.y + 3, 9, 0, TAU); ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath(); ctx.arc(ped.x, ped.y, 9, 0, TAU); ctx.fill();
  ctx.fillStyle = ped.isCop ? '#1a2a44' : '#e8c39a';
  ctx.beginPath(); ctx.arc(ped.x, ped.y - 2, 5, 0, TAU); ctx.fill();
  if (ped.isCop) {
    ctx.fillStyle = '#dfe8ff';
    ctx.fillRect(ped.x - 5, ped.y - 6, 10, 3);
  }
  // Facing tick.
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ped.x + Math.cos(ped.heading) * 8, ped.y + Math.sin(ped.heading) * 8);
  ctx.lineTo(ped.x + Math.cos(ped.heading) * 13, ped.y + Math.sin(ped.heading) * 13);
  ctx.stroke();
}

function drawPlayer(ctx, p, time) {
  if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) return; // blink while hurt
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.arc(p.x + 2, p.y + 3, 11, 0, TAU); ctx.fill();
  ctx.fillStyle = COLORS.player;
  ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = COLORS.playerDark;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, TAU); ctx.stroke();
  // Head + gun direction.
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath(); ctx.arc(p.x, p.y - 2, 5, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(p.aim) * 10, p.y + Math.sin(p.aim) * 10);
  ctx.lineTo(p.x + Math.cos(p.aim) * 20, p.y + Math.sin(p.aim) * 20);
  ctx.stroke();
  // Muzzle flash.
  if (p.muzzle > 0) {
    ctx.fillStyle = COLORS.muzzle;
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.aim) * 24, p.y + Math.sin(p.aim) * 24, 7, 0, TAU);
    ctx.fill();
  }
  // Crosshair at the aim point (screen-space, drawn by caller).
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let vw = 1280, vh = 720, dpr = 1;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    vw = window.innerWidth;
    vh = window.innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  function draw(state, screen, save, time) {
    const cam = state.cam;
    // Keep the camera's scale honest for mouse aiming.
    cam.scale = vw / cam.w;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#11141b';
    ctx.fillRect(0, 0, vw, vh);
    // World transform.
    const scale = vw / cam.w;
    const shX = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shY = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (-cam.x * scale + shX), dpr * (-cam.y * scale + shY));
    const view = { x: cam.x - 40, y: cam.y - 40, w: cam.w + 80, h: cam.h + 80 };
    drawGround(ctx, state.city, view, time);
    // Skid marks.
    for (const s of state.entities.skids) {
      ctx.save();
      ctx.globalAlpha = clamp(s.life / 6, 0, 0.5);
      ctx.strokeStyle = '#1c1a18';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.heading) * 8, s.y - Math.sin(s.heading) * 8);
      ctx.lineTo(s.x + Math.cos(s.heading) * 8, s.y + Math.sin(s.heading) * 8);
      ctx.stroke();
      ctx.restore();
    }
    // Cash pickups.
    for (const pk of state.missions.pickups) {
      if (pk.taken) continue;
      const bob = Math.sin(time * 3 + pk.x) * 2;
      ctx.fillStyle = '#7ee081';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1d5a2a';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + bob + 4);
    }
    // Cars.
    for (const car of state.entities.cars) drawCar(ctx, car, time);
    // People.
    for (const ped of state.entities.peds) drawPed(ctx, ped, time);
    // Bullets.
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 2;
    for (const b of state.entities.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.stroke();
    }
    // Particles.
    for (const pt of state.entities.parts) {
      ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // The player (on foot only — in a car she is inside it).
    if (state.player.onFoot) drawPlayer(ctx, state.player, time);
    // Back to screen space for the HUD and panels.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (screen === SCREEN_TITLE) {
      drawTitle(ctx, state, save, vw, vh, time);
      return;
    }
    drawHud(ctx, state, cam, vw, vh, time);
    if (screen === SCREEN_PAUSED) drawPaused(ctx, vw, vh);
    else if (screen === SCREEN_OVER) drawOver(ctx, state, vw, vh, state.over || 'wasted');
    if (state.storyTimer >= 0 && state.storyTimer < 6) {
      ctx.globalAlpha = clamp(1 - state.storyTimer / 6, 0, 1);
      ctx.font = '900 26px system-ui, sans-serif';
      ctx.fillStyle = '#ffd23f';
      ctx.textAlign = 'center';
      ctx.fillText('STORY COMPLETE — Solmar Bay is yours.', vw / 2, 110);
      ctx.globalAlpha = 1;
    }
  }

  return { draw, view: () => ({ w: vw, h: vh }) };
}
