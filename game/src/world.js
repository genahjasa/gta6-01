// The World: one Solmar Bay — city, entities, player, wanted level and missions —
// stepped in fixed 1/60 s steps. It owns the cash, the camera, collisions between cars,
// people and bullets, explosions, the message feed and saving. Drawing lives in render.js.
import { CARS, PLACES, PLAYER, SAVE_KEY, STEP, WORLD } from './config.js';
import { clamp, createRandom, dist, lerp } from './random.js';
import { createCity } from './city.js';
import {
  addParticle, addSkid, createEntities, driveCar, explode, makeCar, spark,
  spawnParkedCar, spawnPed, spawnTrafficCar, stepBullets, stepParticles,
  stepPed, stepPoliceCar, stepTrafficCar,
} from './entities.js';
import { createPlayer, nearestCar, stepPlayer } from './player.js';
import { addHeat, createWanted, stepWanted } from './wanted.js';
import { createMissions, stepMissions } from './missions.js';

export const EVENT_NONE = 0;

export function createWorld(seed) {
  const rng = createRandom(seed);
  const city = createCity(rng);
  const entities = createEntities(city, rng);
  const player = createPlayer(PLACES.garage.x, PLACES.garage.y);
  const wanted = createWanted();
  const missions = createMissions(rng, city);
  const state = {
    rng, city, entities, player, wanted, missions,
    cash: 0, now: 0, time: 0,
    messages: [], danger: null, shake: 0,
    cam: { x: 0, y: 0, w: 1280, h: 720, zoom: 1 },
    saveTimer: 0, over: null, storyTimer: -1,
  };

  function say(text, color) {
    state.messages.push({ text, t: state.time, color });
    if (state.messages.length > 5) state.messages.shift();
  }

  function seedWorld() {
    for (let i = 0; i < 14; i += 1) spawnTrafficCar(entities, city, rng);
    for (let i = 0; i < 7; i += 1) spawnParkedCar(entities, city, rng);
    for (let i = 0; i < 22; i += 1) spawnPed(entities, city, rng);
  }

  function reset(newGame) {
    entities.cars.length = 0;
    entities.peds.length = 0;
    entities.bullets.length = 0;
    entities.parts.length = 0;
    entities.skids.length = 0;
    player.x = PLACES.garage.x; player.y = PLACES.garage.y;
    player.health = PLAYER.health; player.ammo = PLAYER.magSize;
    player.inCar = null; player.onFoot = true; player.invuln = 0;
    wanted.stars = 0; wanted.calm = 0; wanted.maxStars = 0; wanted.crimes = 0;
    missions.index = 0; missions.stage = 0; missions.marker = null;
    missions.fare = null; missions.storyDone = false; missions.faresDone = 0; missions.earned = 0;
    state.cash = 0; state.now = 0; state.messages.length = 0; state.over = null; state.storyTimer = -1;
    seedWorld();
    if (!newGame) state.cash = 0;
  }

  function loadSave(save) {
    reset(true);
    state.cash = save.cash || 0;
    missions.index = Math.min(save.mission || 0, 5);
    missions.storyDone = missions.index >= 5;
    missions.faresDone = save.faresDone || 0;
    wanted.maxStars = save.bestWanted || 0;
  }

  function save() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: Math.floor(state.cash), mission: missions.index,
        bestWanted: wanted.maxStars, faresDone: missions.faresDone,
      }));
    } catch { /* storage off: the session keeps going */ }
  }

  function readSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function handleEvents(events) {
    if (events.shot) { state.danger = { x: player.x, y: player.y, t: state.time }; }
    if (events.enemyShot) { /* cops firing: no extra feed */ }
    if (events.siren) { /* audio cue handled by caller */ }
    if (events.enterCar) {
      const { occupied } = events.enterCar;
      if (occupied) {
        addHeat(wanted, 1, state.now);
        say('Carjacked! The driver ran — someone saw that.', '#ffb04a');
        const ped = spawnPed(entities, city, rng);
        ped.x = player.x + 30; ped.y = player.y + 10;
        ped.state = 'flee'; ped.fleeTimer = 5;
      } else {
        say('Nice wheels. Now go.', '#cfc8b8');
      }
    }
    if (events.pickup) {
      const pk = events.pickup;
      if (pk.amount > 0) say(`+$${pk.amount}`, '#7ee081');
      if (pk.text) say(pk.text, '#ffd23f');
    }
    if (events.missionDone) {
      say(`${events.missionDone.name} complete — +$${events.missionDone.reward}`, '#7ee081');
      if (missions.storyDone) state.storyTimer = 0;
      save();
    }
    if (events.wantedDown) say('Heat dying down…', '#cfc8b8');
    if (events.crash) { state.danger = { x: player.x, y: player.y, t: state.time }; }
  }

  function bulletHit(b) {
    if (b.from === 'player') {
      // Peds and foot cops.
      for (const ped of entities.peds) {
        if (ped.state === 'down') continue;
        if (dist(b.x, b.y, ped.x, ped.y) < 12) {
          ped.health -= b.damage;
          spark(entities, b.x, b.y, '#c0392b');
          b.dead = true;
          if (ped.health <= 0) {
            ped.state = 'down'; ped.downTimer = 6;
            addHeat(wanted, ped.isCop ? 2 : 1, state.now);
            say(ped.isCop ? 'You shot a cop. That brings heat.' : 'Pedestrian down. Witnesses called it in.', '#ffb04a');
          }
          return;
        }
      }
      // Cars (two circles, front and rear).
      for (const car of entities.cars) {
        if (car.dead) continue;
        const dx = Math.cos(car.heading), dy = Math.sin(car.heading);
        const hitF = dist(b.x, b.y, car.x + dx * 14, car.y + dy * 14) < 16;
        const hitR = dist(b.x, b.y, car.x - dx * 14, car.y - dy * 14) < 16;
        if (hitF || hitR) {
          car.health -= b.damage;
          spark(entities, b.x, b.y);
          b.dead = true;
          if (car.driver === 'police') addHeat(wanted, 1, state.now);
          if (car.health <= 0) blowUpCar(car);
          return;
        }
      }
    } else {
      // Cop bullets hit the player on foot.
      if (player.onFoot && player.invuln <= 0 && dist(b.x, b.y, player.x, player.y) < 13) {
        player.health -= b.damage;
        player.invuln = 0.3;
        spark(entities, b.x, b.y, '#e84c4c');
        b.dead = true;
        if (player.health <= 0) { player.health = 0; state.over = 'wasted'; }
      }
    }
  }

  function blowUpCar(car) {
    if (car.dead) return;
    car.dead = true;
    explode(entities, car.x, car.y);
    state.shake = Math.max(state.shake, 12);
    state.danger = { x: car.x, y: car.y, t: state.time };
    // Splash damage.
    for (const ped of entities.peds) {
      if (ped.state !== 'down' && dist(ped.x, ped.y, car.x, car.y) < 130) {
        ped.health -= 70;
        if (ped.health <= 0) { ped.state = 'down'; ped.downTimer = 6; }
      }
    }
    if (player.onFoot && dist(player.x, player.y, car.x, car.y) < 120) {
      player.health -= 45;
      player.invuln = 0.5;
      if (player.health <= 0) { player.health = 0; state.over = 'wasted'; }
    }
    for (const other of entities.cars) {
      if (other !== car && !other.dead && dist(other.x, other.y, car.x, car.y) < 110) {
        other.health -= 50;
        if (other.health <= 0) blowUpCar(other);
      }
    }
    if (car.driver === 'player') {
      player.inCar = null; player.onFoot = true;
      player.x = car.x + 40; player.y = car.y;
      player.health = Math.max(1, player.health - 20);
      say('Your car blew up!', '#e84c4c');
    }
    const copNear = entities.cars.some((c) => c.driver === 'police' && !c.dead && dist(c.x, c.y, car.x, car.y) < 500);
    if (copNear) addHeat(wanted, 1, state.now);
  }

  function collideCars(dt) {
    const cars = entities.cars;
    for (let i = 0; i < cars.length; i += 1) {
      const a = cars[i];
      if (a.dead) continue;
      for (let j = i + 1; j < cars.length; j += 1) {
        const b = cars[j];
        if (b.dead) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = 34;
        if (d >= min || d === 0) continue;
        const push = (min - d) / 2;
        const nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const rel = Math.abs(a.speed - b.speed);
        if (rel > 140) {
          a.health -= rel * 0.03; b.health -= rel * 0.03;
          spark(entities, (a.x + b.x) / 2, (a.y + b.y) / 2);
          state.shake = Math.max(state.shake, 4);
          if (a.driver === 'player' || b.driver === 'player') state.crashNow = rel;
          if (a.health <= 0) blowUpCar(a);
          if (b.health <= 0) blowUpCar(b);
        }
        const avg = (a.speed + b.speed) / 2;
        a.speed = avg; b.speed = avg;
      }
    }
  }

  function collideCarPed(dt) {
    for (const car of entities.cars) {
      if (car.dead || Math.abs(car.speed) < 120) continue;
      for (const ped of entities.peds) {
        if (ped.state === 'down') continue;
        if (ped.waiting) continue; // fare client waiting at the kerb cannot be run over
        if (dist(car.x, car.y, ped.x, ped.y) < 26) {
          ped.health = 0;
          ped.state = 'down'; ped.downTimer = 6;
          addParticle(entities, ped.x, ped.y, 0, 0, 0.4, 6, '#a02828');
          if (car.driver === 'player') {
            addHeat(wanted, 1, state.now);
            say('You ran someone over!', '#ffb04a');
          }
          car.speed *= 0.85;
        }
      }
      // Running the player over on foot.
      if (player.onFoot && player.invuln <= 0 && car.driver !== 'player' && dist(car.x, car.y, player.x, player.y) < 26) {
        player.health -= 25;
        player.invuln = 0.8;
        player.vx = (player.x - car.x) * 4; player.vy = (player.y - car.y) * 4;
        state.shake = Math.max(state.shake, 7);
        if (player.health <= 0) { player.health = 0; state.over = 'wasted'; }
      }
    }
  }

  function step(dt, input, actions) {
    state.now += dt;
    state.time += dt;
    if (state.storyTimer >= 0) state.storyTimer += dt;
    const events = { cam: state.cam, shake: 0 };
    stepPlayer(player, input, actions, state, city, dt, events);
    if (events.skidRear) addSkid(entities, events.skidRear.x, events.skidRear.y, events.skidRear.heading);
    if (events.shake) state.shake = Math.max(state.shake, events.shake);

    // Traffic: keep the streets busy.
    const traffic = entities.cars.filter((c) => c.driver === 'traffic' && !c.dead);
    if (traffic.length < 14 && Math.random() < 0.1) {
      const p = city.randomRoadPoint();
      if (dist(p.x, p.y, player.x, player.y) > 700) spawnTrafficCar(entities, city, rng);
    }
    for (const car of entities.cars) {
      if (car.dead) continue;
      if (car.driver === 'traffic') stepTrafficCar(car, entities, city, dt, player);
      else if (car.driver === 'police') stepPoliceCar(car, entities, city, dt, player, player.inCar ? { x: Math.cos(player.inCar.heading) * player.inCar.speed, y: Math.sin(player.inCar.heading) * player.inCar.speed } : { x: player.vx, y: player.vy });
    }
    // Parked cars stay parked.
    entities.cars = entities.cars.filter((c) => {
      if (c.dead && c.driver === 'police') return false;
      if (c.dead) return Math.random() > 0.02;
      return true;
    });

    // Pedestrians.
    const walkers = entities.peds.filter((p) => !p.isCop && p.state !== 'down');
    if (walkers.length < 20 && Math.random() < 0.05) spawnPed(entities, city, rng);
    for (const ped of entities.peds) {
      if (ped.isCop) continue; // cops are driven by the wanted module
      stepPed(ped, entities, city, dt, state.danger && state.time - state.danger.t < 1.5 ? state.danger : null);
    }
    entities.peds = entities.peds.filter((p) => !(p.state === 'down' && p.downTimer <= 0));

    stepWanted(wanted, state, city, rng, dt, state.now, player, events);
    stepMissions(missions, state, events, dt);
    stepBullets(entities, city, dt, bulletHit);
    collideCars(dt);
    collideCarPed(dt);
    if (state.crashNow) { events.crash = state.crashNow; state.crashNow = 0; }
    stepParticles(entities, dt);

    // Death outcomes.
    if (state.over === 'wasted' || events.busted) {
      const kind = state.over === 'wasted' ? 'wasted' : 'busted';
      const lost = Math.max(50, Math.floor(state.cash * 0.1));
      state.cash = Math.max(0, state.cash - lost);
      state.over = kind;
      save();
    }
    handleEvents(events);

    // Camera: follow the player with a little look-ahead, zoom out when driving.
    const zoom = player.inCar ? 0.85 : 1;
    state.cam.zoom = lerp(state.cam.zoom, zoom, Math.min(1, 2 * dt));
    const vw = 1280 / state.cam.zoom, vh = 720 / state.cam.zoom;
    state.cam.w = vw; state.cam.h = vh;
    const lookX = player.inCar ? Math.cos(player.inCar.heading) * player.inCar.speed * 0.15 : player.vx * 0.15;
    const lookY = player.inCar ? Math.sin(player.inCar.heading) * player.inCar.speed * 0.15 : player.vy * 0.15;
    const tx = clamp(player.x + lookX - vw / 2, 0, WORLD.w - vw);
    const ty = clamp(player.y + lookY - vh / 2, 0, WORLD.h - vh);
    state.cam.x = lerp(state.cam.x, tx, Math.min(1, 6 * dt));
    state.cam.y = lerp(state.cam.y, ty, Math.min(1, 6 * dt));
    state.shake = Math.max(0, state.shake - 30 * dt);

    state.saveTimer -= dt;
    if (state.saveTimer <= 0) { save(); state.saveTimer = 5; }
    return events;
  }

  function respawn(kind) {
    const spot = kind === 'busted' ? PLACES.station : PLACES.hospital;
    player.x = spot.x; player.y = spot.y;
    player.health = PLAYER.health;
    player.ammo = PLAYER.magSize;
    player.inCar = null; player.onFoot = true;
    player.invuln = 2;
    wanted.stars = 0; wanted.calm = 0;
    missions.stage = 0; missions.marker = null; missions.fare = null;
    state.over = null;
    state.cam.x = clamp(player.x - state.cam.w / 2, 0, WORLD.w - state.cam.w);
    state.cam.y = clamp(player.y - state.cam.h / 2, 0, WORLD.h - state.cam.h);
    say(kind === 'busted' ? 'Released. Vera paid your bail.' : 'Patched up. Back on the street.', '#cfc8b8');
  }

  reset(true);
  return { state, reset, loadSave, save, readSave, step, respawn };
}
