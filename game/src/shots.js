// The screenshot scenes behind ?shot=chase|street|mission|title. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what real play looks like and the same seed gives the same
// frame. The first screenshot by name is the cover.
import { STEP } from './config.js';
import { createScriptedInput } from './input.js';
import { angleDiff, clamp } from './random.js';
import { makeCar, spawnPoliceCar } from './entities.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SAMPLE = STEP;

function simulate(world, input, seconds) {
  for (let t = 0; t < seconds; t += SAMPLE) world.step(SAMPLE, input, 0);
}

function driveNorth(input, world, laneX) {
  const car = world.state.player.inCar;
  if (!car) return;
  const desired = -Math.PI / 2 + clamp((laneX - car.x) * 0.002, -0.3, 0.3);
  const diff = angleDiff(car.heading, desired);
  input.set({ up: true, down: false, left: diff < -0.05, right: diff > 0.05, sprint: false });
}

function walkToward(input, world, tx, ty) {
  const p = world.state.player;
  const dx = tx - p.x, dy = ty - p.y;
  input.set({
    up: dy < -20, down: dy > 20, left: dx < -20, right: dx > 20,
    sprint: true,
    mx: 640 + clamp(dx, -300, 300), my: 360 + clamp(dy, -200, 200),
  });
}

function putPlayerInCar(world, kind, x, y, heading) {
  const car = makeCar(kind, x, y, heading);
  car.driver = 'player';
  car.speed = 200;
  world.state.entities.cars.push(car);
  const p = world.state.player;
  p.inCar = car; p.onFoot = false; p.x = x; p.y = y;
  return car;
}

function setHeat(world, stars) {
  const w = world.state.wanted;
  w.stars = stars;
  w.maxStars = Math.max(w.maxStars, stars);
  w.lastCrime = world.state.now;
}

/** Set `world` to the named scene and return the screen to draw over it. */
export function stageShot(name, world) {
  const input = createScriptedInput();
  world.reset(true);
  const s = world.state;

  if (name === 'chase') {
    // Cover: Dana in a sport car fleeing north up Solmar Avenue at 3 stars, two
    // cruisers closing in behind her, traffic ahead. Short run so she stays in the city.
    s.missions.index = 3;
    s.missions.stage = 1;
    s.missions.objective = 'Lose the cops — stay out of sight until the stars clear.';
    putPlayerInCar(world, 'sport', 1522, 3000, -Math.PI / 2);
    setHeat(world, 3);
    // Two cruisers right on her tail (spawned, then placed just behind the player).
    const cop1 = spawnPoliceCar(s.entities, s.city, s.rng, 1522, 3300);
    cop1.x = 1522; cop1.y = 3120; cop1.heading = -Math.PI / 2; cop1.speed = 420;
    const cop2 = spawnPoliceCar(s.entities, s.city, s.rng, 1478, 3360);
    cop2.x = 1566; cop2.y = 3260; cop2.heading = -Math.PI / 2; cop2.speed = 400;
    cop2.chaseOffset = -90; // fans out to the player's left so both cruisers read
    for (let t = 0; t < 3; t += SAMPLE) {
      driveNorth(input, world, 1522);
      world.step(SAMPLE, input, 0);
    }
    return { screen: SCREEN_PLAY };
  }

  if (name === 'street') {
    // On foot by Vera's garage, a parked car beside her, traffic and pedestrians passing.
    s.player.x = 560; s.player.y = 690;
    const parked = makeCar('sedan', 640, 700, Math.PI / 2);
    parked.driver = 'parked';
    s.entities.cars.push(parked);
    for (let t = 0; t < 4; t += SAMPLE) {
      walkToward(input, world, 700, 700);
      world.step(SAMPLE, input, 0);
    }
    return { screen: SCREEN_PLAY };
  }

  if (name === 'mission') {
    // The Big Score mid-escape: cash grabbed at the bank, 3 stars, a cruiser closing in
    // from the west, the safehouse marker pointing south-east.
    s.missions.index = 4;
    s.missions.stage = 2;
    s.missions.objective = 'Escape to the safehouse with the cash.';
    s.missions.marker = { x: 2900, y: 2900, label: 'Safehouse' };
    s.player.x = 1700; s.player.y = 1900;
    s.player.health = 100;
    setHeat(world, 3);
    const cop1 = spawnPoliceCar(s.entities, s.city, s.rng, 1500, 1900);
    cop1.x = 1300; cop1.y = 1900; cop1.heading = 0; cop1.speed = 380;
    const cop2 = spawnPoliceCar(s.entities, s.city, s.rng, 1900, 2100);
    cop2.x = 1900; cop2.y = 2150; cop2.heading = -Math.PI / 2; cop2.speed = 320;
    for (let t = 0; t < 2.5; t += SAMPLE) {
      walkToward(input, world, 2300, 2400);
      world.step(SAMPLE, input, 0);
    }
    return { screen: SCREEN_PLAY };
  }

  // Title: the city alive behind the menu, Dana standing by the beach at golden hour.
  s.player.x = 1700; s.player.y = 3200;
  for (let t = 0; t < 10; t += SAMPLE) world.step(SAMPLE, input, 0);
  return { screen: SCREEN_TITLE };
}
