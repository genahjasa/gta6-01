// Solmar Bay itself: a road grid, blocks of buildings, a park, the docks, a beach and the
// sea. Generated once from a seed, then fixed. Holds the collision boxes and the road and
// sidewalk queries the cars and pedestrians drive on, and draws the ground layer.
import { BEACH_Y, BLOCK, COLORS, ROADS, SEA_Y, WORLD } from './config.js';
import { clamp } from './random.js';

const ROOFS = COLORS.buildingRoof;

function blockRect(col, row) {
  const x0 = ROADS[col] + 45, x1 = ROADS[col + 1] - 45;
  const y0 = ROADS[row] + 45, y1 = row === 7 ? BEACH_Y - 45 : ROADS[row + 1] - 45;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function createCity(seed) {
  const rnd = seed;
  const buildings = [];   // {x,y,w,h,color,seed}
  const trees = [];       // {x,y,r,shade}
  const palms = [];       // {x,y}
  const grassTufts = [];  // {x,y,r,shade} — texture on the lawns
  for (let i = 0; i < 260; i += 1) {
    grassTufts.push({ x: 40 + rnd.next() * (WORLD.w - 80), y: 40 + rnd.next() * (BEACH_Y - 120), r: 6 + rnd.next() * 14, shade: rnd.next() });
  }
  const park = { ...blockRect(5, 2), pond: { x: 0, y: 0, r: 60 } };
  park.pond.x = park.x + park.w * 0.6; park.pond.y = park.y + park.h * 0.55;
  const docks = blockRect(0, 7);
  const special = new Set(['0,0', '3,3', '5,0', '0,4', '6,6', '0,7', '5,2']);

  for (let col = 0; col < 7; col += 1) {
    for (let row = 0; row < 8; row += 1) {
      const key = `${col},${row}`;
      const rect = blockRect(col, row);
      if (key === '5,2') {
        // The park: grass, a pond and trees, no buildings.
        for (let i = 0; i < 14; i += 1) trees.push({ x: rect.x + 20 + rnd.next() * (rect.w - 40), y: rect.y + 20 + rnd.next() * (rect.h - 40), r: 10 + rnd.next() * 8, shade: rnd.next() });
        continue;
      }
      if (key === '0,7') {
        // The docks: warehouses and stacked containers.
        buildings.push({ x: rect.x + 20, y: rect.y + 20, w: 120, h: 90, color: '#7a6a58', seed: rnd.next() });
        buildings.push({ x: rect.x + 170, y: rect.y + 140, w: 110, h: 80, color: '#6a7a8a', seed: rnd.next() });
        for (let i = 0; i < 8; i += 1) buildings.push({ x: rect.x + 10 + (i % 4) * 72, y: rect.y + 240 + Math.floor(i / 4) * 34, w: 60, h: 26, color: rnd.pick(['#b8574e', '#3f7a8a', '#c98a3f', '#5a7a4a']), seed: rnd.next() });
        continue;
      }
      if (key === '0,0' || key === '3,3' || key === '5,0' || key === '0,4' || key === '6,6') {
        // Landmark blocks: one big building (garage, bank, hospital, station, safehouse).
        buildings.push({ x: rect.x + 30, y: rect.y + 30, w: rect.w - 60, h: rect.h - 60, color: key === '3,3' ? '#c9b48a' : key === '0,0' ? '#8a7a6a' : ROOFS[Math.floor(rnd.next() * ROOFS.length)], seed: rnd.next(), landmark: key });
        continue;
      }
      // Ordinary block: 1-4 buildings with alleys between them.
      const n = 1 + Math.floor(rnd.next() * 3);
      for (let i = 0; i < n; i += 1) {
        const bw = 70 + rnd.next() * 120, bh = 60 + rnd.next() * 110;
        const bx = rect.x + 14 + rnd.next() * Math.max(1, rect.w - bw - 28);
        const by = rect.y + 14 + rnd.next() * Math.max(1, rect.h - bh - 28);
        let ok = true;
        for (const b of buildings) if (bx < b.x + b.w + 16 && bx + bw + 16 > b.x && by < b.y + b.h + 16 && by + bh + 16 > b.y) { ok = false; break; }
        if (ok) buildings.push({ x: bx, y: by, w: bw, h: bh, color: ROOFS[Math.floor(rnd.next() * ROOFS.length)], seed: rnd.next() });
      }
      if (rnd.chance(0.5)) {
        for (let i = 0; i < 3; i += 1) trees.push({ x: rect.x + 16 + rnd.next() * (rect.w - 32), y: rect.y + 16 + rnd.next() * (rect.h - 32), r: 8 + rnd.next() * 6, shade: rnd.next() });
      }
    }
  }
  // Palms along the shoreline drive and the main avenue.
  for (let x = 200; x < WORLD.w - 100; x += 130) palms.push({ x, y: BEACH_Y - 70 });
  for (let y = 200; y < BEACH_Y - 100; y += 160) palms.push({ x: 1500 + 62, y });

  function onRoad(x, y) {
    if (y >= BEACH_Y - 45) return true; // shoreline drive
    for (const r of ROADS) if (Math.abs(x - r) <= 45 || Math.abs(y - r) <= 45) return true;
    return false;
  }
  function inBuilding(x, y) {
    for (const b of buildings) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    return null;
  }
  // Push a circle out of every building it overlaps; returns true when it touched one.
  function collideCircle(px, py, r) {
    for (const b of buildings) {
      const nx = clamp(px, b.x, b.x + b.w), ny = clamp(py, b.y, b.y + b.h);
      const dx = px - nx, dy = py - ny, d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 === 0) return { x: px, y: b.y - r, hit: b };
        const d = Math.sqrt(d2);
        return { x: nx + (dx / d) * r, y: ny + (dy / d) * r, hit: b };
      }
    }
    return null;
  }
  function randomRoadPoint() {
    const vertical = rnd.chance(0.5);
    const road = ROADS[Math.floor(rnd.next() * ROADS.length)];
    const along = 120 + rnd.next() * (WORLD.w - 240);
    return vertical ? { x: road + (rnd.chance(0.5) ? -22 : 22), y: along, heading: rnd.chance(0.5) ? Math.PI / 2 : -Math.PI / 2 } : { x: along, y: road + (rnd.chance(0.5) ? -22 : 22), heading: rnd.chance(0.5) ? 0 : Math.PI };
  }
  function randomSidewalkPoint() {
    const road = ROADS[Math.floor(rnd.next() * ROADS.length)];
    const along = 120 + rnd.next() * (WORLD.w - 240);
    return rnd.chance(0.5) ? { x: road + (rnd.chance(0.5) ? -58 : 58), y: along } : { x: along, y: road + (rnd.chance(0.5) ? -58 : 58) };
  }
  function nearestRoadPoint(x, y, awayFrom) {
    // A point on a road, at least `awayFrom` from (x, y) when possible.
    for (let tries = 0; tries < 12; tries += 1) {
      const p = randomRoadPoint();
      if (Math.hypot(p.x - x, p.y - y) >= awayFrom) return p;
    }
    const p = randomRoadPoint();
    return p;
  }

  return { buildings, trees, palms, grassTufts, park, docks, special, onRoad, inBuilding, collideCircle, randomRoadPoint, randomSidewalkPoint, nearestRoadPoint };
}

// Draw the ground: grass, beach, sea, roads with lane marks, sidewalks, crosswalks, park,
// buildings with long sunset shadows, trees and palms. Only what the camera sees is drawn.
export function drawGround(ctx, city, cam, time) {
  const { x: vx, y: vy, w: vw, h: vh } = cam;
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(vx, vy, vw, vh);
  // Lawn texture: darker grass tufts scattered over the blocks.
  for (const g of city.grassTufts) {
    if (g.x < vx - 20 || g.x > vx + vw + 20 || g.y < vy - 20 || g.y > vy + vh + 20) continue;
    ctx.fillStyle = g.shade > 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.ellipse(g.x, g.y, g.r, g.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Sea and sand.
  if (vy + vh > BEACH_Y) {
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(vx, Math.max(vy, BEACH_Y), vw, Math.max(0, Math.min(vy + vh, SEA_Y) - Math.max(vy, BEACH_Y)));
    if (vy + vh > SEA_Y) {
      ctx.fillStyle = COLORS.sea;
      ctx.fillRect(vx, Math.max(vy, SEA_Y), vw, vy + vh - Math.max(vy, SEA_Y));
      ctx.fillStyle = COLORS.seaDeep;
      for (let i = 0; i < 5; i += 1) {
        const wy = SEA_Y + 30 + i * 46 + Math.sin(time * 0.7 + i * 2.1) * 4;
        if (wy < vy || wy > vy + vh) continue;
        ctx.fillRect(vx, wy, vw, 3);
      }
    }
  }
  // Roads: asphalt bands with lighter edges and dashed centre lines.
  ctx.fillStyle = COLORS.road;
  for (const r of ROADS) {
    if (r > vx - 60 && r < vx + vw + 60) ctx.fillRect(r - 45, vy, 90, vh);
    if (r > vy - 60 && r < vy + vh + 60) ctx.fillRect(vx, r - 45, vw, 90);
  }
  ctx.fillStyle = COLORS.road;
  ctx.fillRect(vx, BEACH_Y - 45, vw, 90); // shoreline drive
  ctx.strokeStyle = COLORS.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  ctx.beginPath();
  for (const r of ROADS) {
    if (r > vx - 60 && r < vx + vw + 60) { ctx.moveTo(r, vy); ctx.lineTo(r, vy + vh); }
    if (r > vy - 60 && r < vy + vh + 60) { ctx.moveTo(vx, r); ctx.lineTo(vx + vw, r); }
  }
  ctx.moveTo(vx, BEACH_Y); ctx.lineTo(vx + vw, BEACH_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  // Sidewalks: pale borders around each block.
  ctx.fillStyle = COLORS.sidewalk;
  for (let col = 0; col < 7; col += 1) {
    for (let row = 0; row < 8; row += 1) {
      const rect = blockRect(col, row);
      if (rect.x + rect.w < vx || rect.x > vx + vw || rect.y + rect.h < vy || rect.y > vy + vh) continue;
      ctx.fillRect(rect.x - 14, rect.y - 14, rect.w + 28, 14);
      ctx.fillRect(rect.x - 14, rect.y + rect.h, rect.w + 28, 14);
      ctx.fillRect(rect.x - 14, rect.y, 14, rect.h);
      ctx.fillRect(rect.x + rect.w, rect.y, 14, rect.h);
    }
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = COLORS.crosswalk;
  for (const rx of ROADS) {
    for (const ry of ROADS) {
      if (rx < vx - 60 || rx > vx + vw + 60 || ry < vy - 60 || ry > vy + vh + 60) continue;
      for (let i = -3; i <= 3; i += 1) {
        ctx.fillRect(rx + i * 12 - 4, ry - 52, 8, 14);
        ctx.fillRect(rx + i * 12 - 4, ry + 38, 8, 14);
      }
    }
  }
  // Park.
  const pk = city.park;
  ctx.fillStyle = COLORS.park;
  ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
  ctx.fillStyle = COLORS.sea;
  ctx.beginPath(); ctx.arc(pk.pond.x, pk.pond.y, pk.pond.r, 0, Math.PI * 2); ctx.fill();
  // Buildings: long sunset shadow, roof, edge, rooftop detail.
  for (const b of city.buildings) {
    if (b.x + b.w < vx || b.x > vx + vw || b.y + b.h < vy || b.y > vy + vh) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 14, b.y + 18, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
    // Inset roof line and rooftop props (vents, skylights) from the building's seed.
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 12, b.y + 12, b.w - 24, b.h - 24);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    const s1 = b.seed || 0.5;
    ctx.fillRect(b.x + b.w * (0.2 + s1 * 0.3), b.y + b.h * 0.3, 16, 12);
    ctx.fillRect(b.x + b.w * (0.55 + s1 * 0.2), b.y + b.h * 0.6, 12, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    ctx.fillRect(b.x + b.w * 0.3, b.y + b.h * 0.55, 20, 14);
  }
  // Trees and palms.
  for (const t of city.trees) {
    if (t.x < vx - 30 || t.x > vx + vw + 30 || t.y < vy - 30 || t.y > vy + vh + 30) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.arc(t.x + 5, t.y + 6, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.shade > 0.5 ? COLORS.tree : COLORS.tree2;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
  }
  for (const p of city.palms) {
    if (p.x < vx - 30 || p.x > vx + vw + 30 || p.y < vy - 30 || p.y > vy + vh + 30) continue;
    ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 3, p.y - 16); ctx.stroke();
    ctx.fillStyle = COLORS.palm;
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.ellipse(p.x + 3 + Math.cos(a) * 10, p.y - 16 + Math.sin(a) * 6, 11, 4, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
