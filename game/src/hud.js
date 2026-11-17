// Everything drawn over the world: the HUD (cash, health, ammo, wanted stars, objective,
// minimap, speed), the message feed, and the title / pause / wasted / busted panels.
// All canvas, all in screen space.
import { COLORS, MISSIONS, PLACES } from './config.js';
import { clamp, fmtCash } from './random.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function text(ctx, value, x, y, size, color, align = 'left', weight = '600') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function panel(ctx, x, y, w, h, alpha = 0.82) {
  ctx.fillStyle = `rgba(16,16,20,${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = COLORS.hudLine;
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawHud(ctx, world, cam, vw, vh, time) {
  const p = world.player, w = world.wanted, m = world.missions;
  // Top-left: cash, health, ammo.
  panel(ctx, 14, 14, 210, 86);
  text(ctx, fmtCash(world.cash), 28, 44, 26, COLORS.cash, 'left', '800');
  text(ctx, 'DANA REYES', 28, 66, 12, COLORS.dim);
  // Health bar.
  ctx.fillStyle = '#00000088';
  ctx.fillRect(28, 74, 120, 10);
  ctx.fillStyle = COLORS.health;
  ctx.fillRect(28, 74, 120 * clamp(p.health / 100, 0, 1), 10);
  text(ctx, p.onFoot ? `AMMO ${p.ammo}/${12}` : 'IN CAR', 160, 84, 12, COLORS.text);
  // Top-right: wanted stars.
  panel(ctx, vw - 224, 14, 210, 52);
  for (let i = 0; i < 5; i += 1) {
    const x = vw - 206 + i * 38, y = 46;
    ctx.font = '28px ' + FONT;
    ctx.fillStyle = i < w.stars ? COLORS.star : COLORS.starEmpty;
    ctx.textAlign = 'center';
    ctx.fillText('★', x, y);
  }
  // Objective banner, top centre.
  const obj = m.objective || (m.storyDone ? 'Free roam — fares and pickups keep paying.' : MISSIONS[m.index].brief);
  ctx.font = `600 15px ${FONT}`;
  const ow = Math.min(vw - 480, ctx.measureText(obj).width + 28);
  panel(ctx, (vw - ow) / 2, 14, ow, 40);
  text(ctx, obj, vw / 2, 40, 15, COLORS.text, 'center');
  // Mission marker: an arrow at the screen edge when off-screen, a beacon when on-screen.
  if (m.marker) drawMarker(ctx, cam, vw, vh, m.marker, time);
  // Message feed.
  let my = 66;
  for (const msg of world.messages) {
    const age = time - msg.t;
    if (age > 4) continue;
    ctx.globalAlpha = age > 3 ? 4 - age : 1;
    text(ctx, msg.text, vw / 2, my, 16, msg.color || COLORS.text, 'center', '700');
    ctx.globalAlpha = 1;
    my += 22;
  }
  // Minimap, bottom-right.
  drawMinimap(ctx, world, vw - 214, vh - 214, 200, 200);
  // Speed + car health when driving.
  if (!p.onFoot && p.inCar) {
    const car = p.inCar;
    const kmh = Math.round(Math.abs(car.speed) * 0.36);
    panel(ctx, vw - 214, vh - 286, 200, 56);
    text(ctx, `${kmh} km/h`, vw - 114, vh - 256, 20, COLORS.text, 'center', '800');
    ctx.fillStyle = '#00000088';
    ctx.fillRect(vw - 200, vh - 248, 172, 8);
    ctx.fillStyle = car.health > 40 ? COLORS.cash : COLORS.health;
    ctx.fillRect(vw - 200, vh - 248, 172 * clamp(car.health / car.spec.health, 0, 1), 8);
  }
  // Controls hint, bottom-left.
  text(ctx, 'WASD move/drive · Mouse aim · Click shoot · E car · Shift sprint · R reload · P pause · M mute', 16, vh - 14, 12, COLORS.dim);
}

function drawMarker(ctx, cam, vw, vh, marker, time) {
  const sc = cam.scale || cam.zoom;
  const sx = (marker.x - cam.x) * sc, sy = (marker.y - cam.y) * sc;
  const pulse = 1 + Math.sin(time * 5) * 0.15;
  if (sx > 40 && sx < vw - 40 && sy > 40 && sy < vh - 40) {
    // On screen: a pulsing diamond and a light column.
    ctx.save();
    ctx.globalAlpha = 0.25 + Math.sin(time * 5) * 0.08;
    ctx.fillStyle = COLORS.marker;
    ctx.fillRect(sx - 3, sy - 120, 6, 120);
    ctx.restore();
    ctx.save();
    ctx.translate(sx, sy - 46);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = COLORS.marker;
    ctx.fillRect(-9 * pulse, -9 * pulse, 18 * pulse, 18 * pulse);
    ctx.restore();
    text(ctx, marker.label, sx, sy - 62, 13, COLORS.marker, 'center', '700');
  } else {
    // Off screen: an arrow pinned to the edge.
    const cx = clamp(sx, 60, vw - 60), cy = clamp(sy, 90, vh - 90);
    const a = Math.atan2(sy - cy, sx - cx);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillStyle = COLORS.marker;
    ctx.beginPath();
    ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-4, 0); ctx.lineTo(-10, 11);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    const d = Math.round(Math.hypot(marker.x - (cam.x + vw / 2 / sc), marker.y - (cam.y + vh / 2 / sc)));
    text(ctx, `${marker.label} · ${d}m`, cx, cy - 18, 12, COLORS.marker, 'center', '700');
  }
}

function drawMinimap(ctx, world, x, y, w, h) {
  const s = w / 3600;
  panel(ctx, x - 6, y - 6, w + 12, h + 12, 0.75);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#5a8a4a';
  ctx.fillRect(x, y, w, h);
  // Sea band.
  ctx.fillStyle = COLORS.sea;
  ctx.fillRect(x, y + 3300 * s, w, h - 3300 * s);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(x, y + 3300 * s, w, 180 * s);
  // Roads.
  ctx.strokeStyle = '#3d3a38';
  ctx.lineWidth = Math.max(2, 90 * s);
  for (const r of [300, 700, 1100, 1500, 1900, 2300, 2700, 3100]) {
    ctx.beginPath(); ctx.moveTo(x + r * s, y); ctx.lineTo(x + r * s, y + h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + r * s); ctx.lineTo(x + w, y + r * s); ctx.stroke();
  }
  // Cash pickups.
  ctx.fillStyle = COLORS.cash;
  for (const pk of world.missions.pickups) {
    if (pk.taken) continue;
    ctx.beginPath(); ctx.arc(x + pk.x * s, y + pk.y * s, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Cars.
  for (const c of world.entities.cars) {
    if (c.dead) continue;
    ctx.fillStyle = c.driver === 'police' ? '#5aa2ff' : c.driver === 'player' ? '#ffd23f' : '#dddddd';
    ctx.fillRect(x + c.x * s - 2, y + c.y * s - 2, 4, 4);
  }
  // Mission marker.
  if (world.missions.marker) {
    ctx.fillStyle = COLORS.marker;
    ctx.beginPath(); ctx.arc(x + world.missions.marker.x * s, y + world.missions.marker.y * s, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COLORS.marker; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x + world.missions.marker.x * s, y + world.missions.marker.y * s, 8 + Math.sin(Date.now() / 200) * 2, 0, Math.PI * 2); ctx.stroke();
  }
  // Player arrow.
  const p = world.player;
  ctx.save();
  ctx.translate(x + p.x * s, y + p.y * s);
  ctx.rotate(p.inCar ? p.inCar.heading : p.heading);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = 'rgba(16,16,20,0.7)';
  ctx.fillRect(x, y + h - 18, 76, 18);
  text(ctx, 'SOLMAR BAY', x + 6, y + h - 5, 11, COLORS.dim, 'left');
}

export function drawTitle(ctx, world, save, vw, vh, time) {
  // A warm sunset wash over the live city behind the panel.
  ctx.fillStyle = 'rgba(20,12,8,0.45)';
  ctx.fillRect(0, 0, vw, vh);
  const cx = vw / 2;
  text(ctx, 'SOLMAR HEAT', cx, vh * 0.30, 84, '#ffd23f', 'center', '900');
  text(ctx, 'An open-world crime story in Solmar Bay', cx, vh * 0.30 + 44, 22, COLORS.text, 'center');
  text(ctx, 'Steal cars. Outrun the law. Run five jobs for Vera — then take the city for yourself.', cx, vh * 0.30 + 78, 16, COLORS.dim, 'center');
  const lines = [
    'WASD / Arrows — move and drive      Mouse — aim      Click — shoot',
    'E — enter / exit a car      Shift — sprint / handbrake      R — reload',
    'P — pause      M — mute      Your cash, jobs and best heat are saved.',
  ];
  lines.forEach((l, i) => text(ctx, l, cx, vh * 0.44 + i * 26, 16, COLORS.text, 'center'));
  const hasSave = save && save.cash > 0;
  panel(ctx, cx - 190, vh * 0.60, 380, hasSave ? 118 : 78, 0.9);
  text(ctx, '▶  NEW GAME  —  press Space or click', cx, vh * 0.60 + 34, 18, '#ffd23f', 'center', '800');
  if (hasSave) {
    text(ctx, `CONTINUE  —  ${fmtCash(save.cash)} · ${save.mission >= 5 ? 'story complete' : 'job ' + (save.mission + 1) + ' of 5'}  —  press C`, cx, vh * 0.60 + 66, 15, COLORS.text, 'center');
    text(ctx, `Best heat: ${'★'.repeat(save.bestWanted || 0)}${'☆'.repeat(5 - (save.bestWanted || 0))}   Fares done: ${save.faresDone || 0}`, cx, vh * 0.60 + 94, 13, COLORS.dim, 'center');
  }
  text(ctx, 'A fan-made open-world game. No Rockstar content — every name, place and face is original.', cx, vh - 24, 12, COLORS.dim, 'center');
}

export function drawPaused(ctx, vw, vh) {
  ctx.fillStyle = 'rgba(10,10,14,0.55)';
  ctx.fillRect(0, 0, vw, vh);
  panel(ctx, vw / 2 - 220, vh / 2 - 110, 440, 220, 0.92);
  text(ctx, 'PAUSED', vw / 2, vh / 2 - 52, 40, COLORS.text, 'center', '900');
  text(ctx, 'WASD move · Mouse aim · Click shoot · E car', vw / 2, vh / 2 - 6, 15, COLORS.dim, 'center');
  text(ctx, 'Shift sprint / handbrake · R reload · M mute', vw / 2, vh / 2 + 22, 15, COLORS.dim, 'center');
  text(ctx, 'Press P to resume', vw / 2, vh / 2 + 66, 18, '#ffd23f', 'center', '800');
}

export function drawOver(ctx, world, vw, vh, kind) {
  ctx.fillStyle = 'rgba(10,10,14,0.6)';
  ctx.fillRect(0, 0, vw, vh);
  const title = kind === 'busted' ? 'BUSTED' : 'WASTED';
  const sub = kind === 'busted'
    ? 'The Solmar Bay PD took you in. Vera posted bail — it cost you.'
    : 'You went down in Solmar Bay. The hospital patched you up — it cost you.';
  panel(ctx, vw / 2 - 240, vh / 2 - 110, 480, 220, 0.92);
  text(ctx, title, vw / 2, vh / 2 - 52, 48, kind === 'busted' ? '#5aa2ff' : '#e84c4c', 'center', '900');
  text(ctx, sub, vw / 2, vh / 2 - 4, 15, COLORS.text, 'center');
  text(ctx, `Cash now: ${fmtCash(world.cash)}`, vw / 2, vh / 2 + 28, 16, COLORS.cash, 'center');
  text(ctx, 'Press Space or click to get back out there', vw / 2, vh / 2 + 70, 18, '#ffd23f', 'center', '800');
}

export function drawStoryComplete(ctx, vw, vh, time) {
  const a = clamp(1 - (time % 6) / 6, 0, 1);
  if (time > 6) return;
  ctx.globalAlpha = a;
  text(ctx, 'STORY COMPLETE — Solmar Bay is yours.', vw / 2, 110, 26, '#ffd23f', 'center', '900');
  ctx.globalAlpha = 1;
}
