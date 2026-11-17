// The player: Dana Reyes, on foot or behind the wheel. On foot she walks, sprints, aims
// with the mouse and shoots; in a car she drives it and can shoot from the window. E steps
// into the nearest car (or out of it); stealing an occupied car is a crime.
import { CARS, PLAYER } from './config.js';
import { angleDiff, clamp, dist, TAU } from './random.js';
import { ACTION_ENTER, ACTION_RELOAD } from './input.js';
import { driveCar, spark } from './entities.js';

export function createPlayer(x, y) {
  return {
    x, y, heading: -Math.PI / 2, aim: -Math.PI / 2, vx: 0, vy: 0,
    health: PLAYER.health, inCar: null, onFoot: true,
    ammo: PLAYER.magSize, reloadTimer: 0, fireTimer: 0, invuln: 0,
    sprinting: false, moving: false, muzzle: 0, driveBy: false,
  };
}

export function nearestCar(cars, x, y, maxD) {
  let best = null, bestD = maxD;
  for (const c of cars) {
    if (c.dead) continue;
    const d = dist(x, y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function stepPlayer(p, input, actions, state, city, dt, events) {
  const mouse = input.mouse();
  p.fireTimer = Math.max(0, p.fireTimer - dt);
  p.muzzle = Math.max(0, p.muzzle - dt);
  if (p.invuln > 0) p.invuln -= dt;
  if (p.reloadTimer > 0) {
    p.reloadTimer -= dt;
    if (p.reloadTimer <= 0) p.ammo = PLAYER.magSize;
  }

  if (p.inCar) {
    const car = p.inCar;
    p.x = car.x; p.y = car.y;
    // Aim from the car toward the mouse (screen coords -> world via camera, passed in).
    if (events.cam) {
      const sc = events.cam.scale || events.cam.zoom;
      const wx = events.cam.x + mouse.x / sc;
      const wy = events.cam.y + mouse.y / sc;
      p.aim = Math.atan2(wy - p.y, wx - p.x);
    }
    const ctrl = {
      throttle: input.up() ? 1 : input.down() ? -1 : 0,
      steer: input.right() ? 1 : input.left() ? -1 : 0,
      brake: false,
      handbrake: input.sprint(),
    };
    if (input.down() && car.speed > 30) ctrl.brake = true;
    const before = car.speed;
    driveCar(car, ctrl, dt, city);
    const slammed = Math.abs(before - car.speed) > 200 && Math.abs(before) > 260;
    if (slammed) {
      events.shake = Math.max(events.shake || 0, 6);
      events.crash = Math.abs(before);
      car.health -= 8;
    }
    if (car.speed > 60 && (input.sprint() || Math.abs(ctrl.steer) > 0.7)) {
      const dx = Math.cos(car.heading), dy = Math.sin(car.heading);
      events.skidRear = { x: car.x - dx * car.spec.len * 0.36, y: car.y - dy * car.spec.len * 0.36, heading: car.heading };
    }
    // Drive-by shooting.
    if (mouse.down && p.fireTimer <= 0 && p.reloadTimer <= 0) {
      if (p.ammo > 0) {
        p.ammo -= 1; p.fireTimer = PLAYER.pistolRate; p.muzzle = 0.06;
        fireBullet(p, state, events);
        if (p.ammo === 0) { p.reloadTimer = PLAYER.reloadTime; events.reload = true; }
      }
    }
    if (actions & ACTION_ENTER) {
      exitCar(p, car, city, events);
    }
    if (actions & ACTION_RELOAD && p.reloadTimer <= 0 && p.ammo < PLAYER.magSize) {
      p.reloadTimer = PLAYER.reloadTime;
      events.reload = true;
    }
    p.moving = Math.abs(car.speed) > 20;
    return;
  }

  // On foot.
  if (events.cam) {
    const sc = events.cam.scale || events.cam.zoom;
    const wx = events.cam.x + mouse.x / sc;
    const wy = events.cam.y + mouse.y / sc;
    p.aim = Math.atan2(wy - p.y, wx - p.x);
  }
  const mx = input.moveX(), my = input.moveY();
  const mag = Math.hypot(mx, my) || 1;
  const sprint = input.sprint();
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  const tx = (mx / mag) * speed, ty = (my / mag) * speed;
  p.vx += (tx - p.vx) * Math.min(1, 12 * dt);
  p.vy += (ty - p.vy) * Math.min(1, 12 * dt);
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.x = clamp(p.x, 20, 3600 - 20);
  p.y = clamp(p.y, 20, 3600 - 20);
  const hit = city.collideCircle(p.x, p.y, PLAYER.radius);
  if (hit) { p.x = hit.x; p.y = hit.y; }
  p.moving = Math.hypot(p.vx, p.vy) > 30;
  p.sprinting = sprint && p.moving;
  if (p.moving) p.heading = Math.atan2(p.vy, p.vx);

  if (mouse.down && p.fireTimer <= 0 && p.reloadTimer <= 0) {
    if (p.ammo > 0) {
      p.ammo -= 1; p.fireTimer = PLAYER.pistolRate; p.muzzle = 0.06;
      fireBullet(p, state, events);
      if (p.ammo === 0) { p.reloadTimer = PLAYER.reloadTime; events.reload = true; }
    }
  }
  if (actions & ACTION_RELOAD && p.reloadTimer <= 0 && p.ammo < PLAYER.magSize) {
    p.reloadTimer = PLAYER.reloadTime;
    events.reload = true;
  }
  if (actions & ACTION_ENTER) {
    const car = nearestCar(state.entities.cars, p.x, p.y, 64);
    if (car) enterCar(p, car, state, events);
  }
}

function fireBullet(p, state, events) {
  const spread = (Math.random() - 0.5) * 0.06;
  const a = p.aim + spread;
  const gx = p.x + Math.cos(a) * 20, gy = p.y + Math.sin(a) * 20;
  state.entities.bullets.push({
    x: gx, y: gy, vx: Math.cos(a) * PLAYER.bulletSpeed, vy: Math.sin(a) * PLAYER.bulletSpeed,
    life: PLAYER.pistolRange / PLAYER.bulletSpeed, damage: PLAYER.pistolDamage, from: 'player', dead: false,
  });
  events.shot = true;
}

function enterCar(p, car, state, events) {
  const occupied = car.driver === 'traffic';
  const hadDriver = car.driver;
  car.driver = 'player';
  p.inCar = car;
  p.onFoot = false;
  p.x = car.x; p.y = car.y;
  events.enterCar = { car, occupied, hadDriver };
  if (occupied) {
    // The driver is yanked out onto the sidewalk and runs.
    const ped = state.entities.peds.find((q) => q.car === car);
    if (ped) { ped.car = null; ped.state = 'flee'; ped.fleeTimer = 4; }
  }
}

function exitCar(p, car, city, events) {
  // Step out to the side of the car.
  const side = Math.PI / 2;
  const dx = Math.cos(car.heading + side), dy = Math.sin(car.heading + side);
  let px = car.x + dx * 34, py = car.y + dy * 34;
  if (city.inBuilding(px, py)) { px = car.x - dx * 34; py = car.y - dy * 34; }
  car.driver = 'parked';
  car.speed *= 0.4;
  p.inCar = null;
  p.onFoot = true;
  p.x = px; p.y = py;
  p.vx = 0; p.vy = 0;
  events.exitCar = { car };
}
