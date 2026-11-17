// The wanted system: stars 0-5, police cars and foot cops that scale with the heat, a
// calm timer that lets the heat die down when nobody can see the player, and the bust and
// waste outcomes. Crimes report in through addHeat(); the world calls step() each frame.
import { COP, WANTED } from './config.js';
import { dist } from './random.js';
import { spawnPed, spawnPoliceCar } from './entities.js';

export function createWanted() {
  return {
    stars: 0, calm: 0, lastCrime: -99, bustTimer: 0, sirenTimer: 0,
    crimes: 0, maxStars: 0,
  };
}

export function addHeat(w, amount, now) {
  w.stars = Math.min(WANTED.maxStars, w.stars + amount);
  w.maxStars = Math.max(w.maxStars, w.stars);
  w.calm = 0;
  w.lastCrime = now;
  w.crimes += 1;
}

export function stepWanted(w, state, city, rng, dt, now, player, events) {
  const policeCars = state.entities.cars.filter((c) => c.driver === 'police' && !c.dead);
  const footCops = state.entities.peds.filter((p) => p.isCop && p.state !== 'down');

  // Spawn police to match the heat.
  const wantCars = WANTED.maxPoliceCars[w.stars];
  if (policeCars.length < wantCars) {
    const car = spawnPoliceCar(state.entities, city, rng, player.x, player.y);
    // Fan the cruisers out: -80, 0, +80 sideways from the player's path.
    car.chaseOffset = ((policeCars.length % 3) - 1) * 80;
  }
  const wantCops = WANTED.maxFootCops[w.stars];
  if (footCops.length < wantCops && player.onFoot) {
    const cop = spawnPed(state.entities, city, rng, true);
    // Drop the cop on a road near the player instead of a random sidewalk.
    const p = city.nearestRoadPoint(player.x, player.y, 380);
    cop.x = p.x; cop.y = p.y;
  }
  // Despawn far police when the heat is gone.
  if (w.stars === 0) {
    for (const c of policeCars) {
      if (dist(c.x, c.y, player.x, player.y) > 1500) c.dead = true;
    }
    for (const p of footCops) {
      if (dist(p.x, p.y, player.x, player.y) > 1500) p.state = 'down';
    }
  }

  // Can any police see the player? (range only — the city is flat and open.)
  let seen = false;
  for (const c of policeCars) if (dist(c.x, c.y, player.x, player.y) < 620) { seen = true; break; }
  if (!seen) for (const p of footCops) if (dist(p.x, p.y, player.x, player.y) < 420) { seen = true; break; }

  // Heat decays only while calm and unseen.
  if (w.stars > 0 && !seen && now - w.lastCrime > 6) {
    w.calm += dt;
    const need = w.stars >= 3 ? WANTED.decayCalmHigh : WANTED.decayCalm;
    if (w.calm >= need) {
      w.stars -= 1;
      w.calm = 0;
      events.wantedDown = true;
    }
  } else {
    w.calm = 0;
  }

  // Siren wail every few seconds while wanted.
  if (w.stars > 0) {
    w.sirenTimer -= dt;
    if (w.sirenTimer <= 0) { events.siren = true; w.sirenTimer = 2.6; }
  }

  // Busted: a foot cop stands on the player while wanted and on foot.
  if (w.stars > 0 && player.onFoot) {
    let touching = false;
    for (const p of footCops) {
      if (dist(p.x, p.y, player.x, player.y) < 26) { touching = true; break; }
    }
    if (touching) {
      w.bustTimer += dt;
      if (w.bustTimer > 1.2) events.busted = true;
    } else w.bustTimer = 0;
  } else w.bustTimer = 0;

  // Foot cops chase and shoot.
  for (const cop of footCops) {
    const d = dist(cop.x, cop.y, player.x, player.y);
    if (d < 700) {
      cop.heading = Math.atan2(player.y - cop.y, player.x - cop.x);
      const speed = d > 60 ? COP.runSpeed : COP.walkSpeed * 0.5;
      cop.x += Math.cos(cop.heading) * speed * dt;
      cop.y += Math.sin(cop.heading) * speed * dt;
      const hit = city.collideCircle(cop.x, cop.y, 10);
      if (hit) { cop.x = hit.x; cop.y = hit.y; }
      cop.shootTimer -= dt;
      if (d < COP.shootRange && cop.shootTimer <= 0 && player.invuln <= 0) {
        cop.shootTimer = COP.shootRate * (0.8 + Math.random() * 0.5);
        const a = Math.atan2(player.y - cop.y, player.x - cop.x) + (Math.random() - 0.5) * 0.22;
        state.entities.bullets.push({
          x: cop.x + Math.cos(a) * 16, y: cop.y + Math.sin(a) * 16,
          vx: Math.cos(a) * 700, vy: Math.sin(a) * 700,
          life: COP.shootRange / 700, damage: COP.damage, from: 'cop', dead: false,
        });
        events.enemyShot = true;
      }
    }
  }
  return { policeCars, footCops, seen };
}
