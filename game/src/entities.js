// Everything that moves: cars (traffic, police, parked), pedestrians, foot cops, bullets,
// particles and skid marks. Cars use a simple arcade model — a speed along a heading with
// grip — and traffic follows the road grid, turning at intersections.
import { CARS, COP, PED, WORLD } from './config.js';
import { angleDiff, clamp, dist, TAU } from './random.js';

export function createEntities(city, rng) {
  return {
    cars: [], peds: [], bullets: [], parts: [], skids: [],
    trafficTimer: 0, pedTimer: 0, sirenTimer: 0,
  };
}

export function makeCar(kind, x, y, heading) {
  const spec = CARS[kind];
  return {
    kind, x, y, heading, speed: 0, health: spec.health, spec,
    driver: null, color: kind === 'taxi' ? '#f2c200' : spec.color,
    steer: 0, throttle: 0, brake: false, handbrake: false,
    wheelSpin: 0, dead: false, burnTimer: 0, id: Math.floor(Math.random() * 1e9),
  };
}

export function spawnTrafficCar(state, city, rng, near) {
  const p = city.randomRoadPoint();
  const kind = rng.pick(['sedan', 'sedan', 'taxi', 'sport', 'van']);
  const car = makeCar(kind, p.x, p.y, p.heading);
  car.driver = 'traffic';
  car.speed = rng.range(120, 220);
  car.cruise = rng.range(150, 240);
  state.cars.push(car);
  return car;
}

export function spawnParkedCar(state, city, rng) {
  const p = city.randomRoadPoint();
  const kind = rng.pick(['sedan', 'sedan', 'taxi', 'sport', 'van']);
  const car = makeCar(kind, p.x, p.y, p.heading);
  car.driver = 'parked';
  car.speed = 0;
  state.cars.push(car);
  return car;
}

export function spawnPoliceCar(state, city, rng, x, y) {
  const p = city.nearestRoadPoint(x, y, 550);
  const car = makeCar('police', p.x, p.y, p.heading);
  car.driver = 'police';
  car.speed = 200;
  car.chaseOffset = 0; // lateral offset from the player's path while chasing
  state.cars.push(car);
  return car;
}

export function spawnPed(state, city, rng, isCop = false) {
  const p = city.randomSidewalkPoint();
  const ped = {
    x: p.x, y: p.y, heading: rng.range(0, TAU), speed: 0,
    health: isCop ? COP.health : PED.health, isCop,
    state: 'walk', tx: p.x, ty: p.y, wait: 0, fleeTimer: 0, downTimer: 0,
    color: isCop ? '#2b3a55' : rng.pick(['#c96f4a', '#5a8a72', '#8a6a9e', '#b8a05a', '#6a8a9e', '#a05a6a']),
    shootTimer: rng.range(0.5, 1.5),
  };
  state.peds.push(ped);
  return ped;
}

export function addParticle(state, x, y, vx, vy, life, size, color) {
  if (state.parts.length > 320) state.parts.shift();
  state.parts.push({ x, y, vx, vy, life, maxLife: life, size, color });
}
export function explode(state, x, y) {
  for (let i = 0; i < 34; i += 1) {
    const a = Math.random() * TAU, s = 60 + Math.random() * 320;
    addParticle(state, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.4 + Math.random() * 0.7, 3 + Math.random() * 6, Math.random() < 0.5 ? '#ff8a2a' : '#ffd23f');
  }
  for (let i = 0; i < 14; i += 1) {
    const a = Math.random() * TAU, s = 20 + Math.random() * 70;
    addParticle(state, x, y, Math.cos(a) * s, Math.sin(a) * s - 30, 1.2 + Math.random() * 1.2, 8 + Math.random() * 10, '#5a5a5a');
  }
}
export function spark(state, x, y, color = '#ffe9a8') {
  for (let i = 0; i < 6; i += 1) {
    const a = Math.random() * TAU, s = 80 + Math.random() * 160;
    addParticle(state, x, y, Math.cos(a) * s, Math.sin(a) * s, 0.15 + Math.random() * 0.2, 2, color);
  }
}
export function addSkid(state, x, y, heading) {
  if (state.skids.length > 400) state.skids.shift();
  state.skids.push({ x, y, heading, life: 6 });
}

// Move one car one step. `ctrl` is {throttle, steer, brake, handbrake} in -1..1.
export function driveCar(car, ctrl, dt, city) {
  const spec = car.spec;
  const target = ctrl.throttle * spec.maxSpeed;
  if (ctrl.brake) {
    car.speed -= Math.sign(car.speed) * 700 * dt;
    if (Math.abs(car.speed) < 20 && ctrl.throttle < 0) car.speed = Math.max(car.speed - spec.accel * 0.6 * dt, -spec.reverse);
  } else if (ctrl.throttle !== 0) {
    const accel = ctrl.throttle > 0 ? spec.accel : spec.accel * 0.7;
    car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), accel * dt) * Math.sign(ctrl.throttle);
    if (ctrl.throttle > 0) car.speed = Math.min(car.speed, spec.maxSpeed);
    else car.speed = Math.max(car.speed, -spec.reverse);
  } else {
    car.speed -= car.speed * 1.6 * dt;
    if (Math.abs(car.speed) < 5) car.speed = 0;
  }
  const speed01 = clamp(Math.abs(car.speed) / spec.maxSpeed, 0, 1);
  const steerRate = spec.turn * (1.15 - speed01 * 0.55) * (car.handbrake ? 1.7 : 1);
  car.heading += ctrl.steer * steerRate * dt * (car.speed >= 0 ? 1 : -1) * clamp(Math.abs(car.speed) / 60, 0.25, 1);
  const dx = Math.cos(car.heading), dy = Math.sin(car.heading);
  car.x += dx * car.speed * dt;
  car.y += dy * car.speed * dt;
  car.x = clamp(car.x, 30, WORLD.w - 30);
  car.y = clamp(car.y, 30, WORLD.h - 30);
  // Buildings: push the front and rear circles out, kill speed into the wall.
  for (const [ox, oy] of [[dx * spec.len * 0.32, dy * spec.len * 0.32], [-dx * spec.len * 0.32, -dy * spec.len * 0.32]]) {
    const hit = city.collideCircle(car.x + ox, car.y + oy, 13);
    if (hit) {
      car.x += hit.x - (car.x + ox);
      car.y += hit.y - (car.y + oy);
      const into = dx * (hit.x - (car.x + ox)) + dy * (hit.y - (car.y + oy));
      if (Math.abs(car.speed) > 240) { /* wall slam: handled by caller via speed drop */ }
      car.speed *= 0.55;
      car.crashSpeed = Math.abs(car.speed);
    }
  }
  car.wheelSpin += Math.abs(car.speed) * dt * 0.05;
}

// Traffic AI: follow the road, turn at intersections, slow for the car ahead.
export function stepTrafficCar(car, state, city, dt, playerPos) {
  const spec = car.spec;
  const ahead = carAhead(state, car, 78);
  let throttle = 1, steer = 0, brake = false;
  if (ahead) {
    const gap = ahead.dist;
    if (gap < 42) { brake = true; throttle = 0; }
    else throttle = 0.4;
  }
  // At an intersection, sometimes turn.
  const nearX = ROADS_NEAR(car.x), nearY = ROADS_NEAR(car.y);
  if (car.turnCooldown > 0) car.turnCooldown -= dt;
  if ((nearX || nearY) && car.turnCooldown <= 0) {
    const r = Math.random();
    if (r < 0.22) { car.heading += Math.PI / 2; car.turnCooldown = 1.2; }
    else if (r < 0.44) { car.heading -= Math.PI / 2; car.turnCooldown = 1.2; }
    else car.turnCooldown = 0.8;
    car.heading = snapHeading(car.heading);
  }
  // Stay on the road: if off-road, steer toward the nearest road centreline.
  if (!city.onRoad(car.x, car.y)) {
    const target = nearestRoadHeading(car, city);
    const diff = angleDiff(car.heading, target);
    steer = clamp(diff * 2, -1, 1);
    throttle = 0.5;
  }
  car.speed = Math.min(car.speed, car.cruise || 220);
  driveCar(car, { throttle, steer, brake, handbrake: false }, dt, city);
}

function ROADS_NEAR(v) {
  for (const r of [300, 700, 1100, 1500, 1900, 2300, 2700, 3100]) if (Math.abs(v - r) < 26) return r;
  return 0;
}
function snapHeading(h) {
  const q = Math.round(h / (Math.PI / 2)) * (Math.PI / 2);
  return q;
}
function nearestRoadHeading(car, city) {
  let best = null, bestD = Infinity;
  for (const r of [300, 700, 1100, 1500, 1900, 2300, 2700, 3100]) {
    const d = Math.min(Math.abs(car.x - r), Math.abs(car.y - r));
    if (d < bestD) { bestD = d; best = Math.abs(car.x - r) < Math.abs(car.y - r) ? (car.y > r ? Math.PI / 2 : -Math.PI / 2) : (car.x > r ? Math.PI : 0); }
  }
  return best ?? 0;
}
function carAhead(state, car, range) {
  const dx = Math.cos(car.heading), dy = Math.sin(car.heading);
  let best = null;
  for (const other of state.cars) {
    if (other === car || other.dead) continue;
    const rx = other.x - car.x, ry = other.y - car.y;
    const along = rx * dx + ry * dy;
    if (along < 0 || along > range) continue;
    const side = Math.abs(rx * -dy + ry * dx);
    if (side > 26) continue;
    if (!best || along < best.dist) best = { car: other, dist: along };
  }
  return best;
}

// Police chase AI: steer toward the player's predicted position and ram. Each cruiser
// aims at a point offset sideways from the player's path (chaseOffset), so several
// cruisers fan out around the player instead of stacking on one spot.
export function stepPoliceCar(car, state, city, dt, target, targetVel) {
  const heading = target.inCar ? target.inCar.heading : Math.atan2(target.vy || 0, target.vx || 1);
  const off = car.chaseOffset || 0;
  const px = target.x + (targetVel ? targetVel.x * 0.35 : 0) - Math.sin(heading) * off;
  const py = target.y + (targetVel ? targetVel.y * 0.35 : 0) + Math.cos(heading) * off;
  const want = Math.atan2(py - car.y, px - car.x);
  const diff = angleDiff(car.heading, want);
  const steer = clamp(diff * 2.2, -1, 1);
  const d = dist(car.x, car.y, target.x, target.y);
  const throttle = d > 46 ? 1 : 0.3;
  driveCar(car, { throttle, steer, brake: false, handbrake: Math.abs(diff) > 1.9 && car.speed > 200 }, dt, city);
  // Siren flash timer lives on the car.
  car.sirenPhase = (car.sirenPhase || 0) + dt;
}

// Pedestrians: stroll between sidewalk points, flee from danger, fall when killed.
export function stepPed(ped, state, city, dt, danger) {
  if (ped.state === 'down') { ped.downTimer -= dt; return; }
  if (ped.health <= 0) { ped.state = 'down'; ped.downTimer = 4; return; }
  if (ped.waiting) return; // fare client: stands at the pickup spot until collected
  const speed = ped.isCop ? COP.walkSpeed : PED.walkSpeed;
  if (danger) {
    const d = dist(ped.x, ped.y, danger.x, danger.y);
    if (d < 320 && !ped.isCop) { ped.state = 'flee'; ped.fleeTimer = 3; }
  }
  if (ped.state === 'flee') {
    ped.fleeTimer -= dt;
    const a = Math.atan2(ped.y - (danger ? danger.y : ped.y), ped.x - (danger ? danger.x : ped.x));
    ped.heading = a;
    ped.x += Math.cos(a) * PED.runSpeed * dt;
    ped.y += Math.sin(a) * PED.runSpeed * dt;
    if (ped.fleeTimer <= 0) ped.state = 'walk';
  } else {
    const d = dist(ped.x, ped.y, ped.tx, ped.ty);
    if (d < 24) {
      ped.wait -= dt;
      if (ped.wait <= 0) {
        const p = city.randomSidewalkPoint();
        ped.tx = p.x; ped.ty = p.y; ped.wait = 1 + Math.random() * 3;
      }
    } else {
      ped.heading = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
      ped.x += Math.cos(ped.heading) * speed * dt;
      ped.y += Math.sin(ped.heading) * speed * dt;
    }
  }
  const hit = city.collideCircle(ped.x, ped.y, PED.radius);
  if (hit) { ped.x = hit.x; ped.y = hit.y; }
  ped.x = clamp(ped.x, 20, WORLD.w - 20);
  ped.y = clamp(ped.y, 20, WORLD.h - 20);
}

export function stepBullets(state, city, dt, onHit) {
  for (const b of state.bullets) {
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.w || b.y > WORLD.h) { b.dead = true; continue; }
    if (city.inBuilding(b.x, b.y)) { spark(state, b.x, b.y); b.dead = true; continue; }
    onHit(b);
  }
  state.bullets = state.bullets.filter((b) => !b.dead);
}

export function stepParticles(state, dt) {
  for (const p of state.parts) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96; p.vy *= 0.96;
  }
  state.parts = state.parts.filter((p) => p.life > 0);
  for (const s of state.skids) s.life -= dt;
  state.skids = state.skids.filter((s) => s.life > 0);
}
