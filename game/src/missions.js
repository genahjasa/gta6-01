// Missions and side work: Vera's five-job story chain, repeatable taxi fares after the
// story, and cash pickups scattered around the city. Each mission is a small state machine;
// the world owns the cash and the events, this module owns the stages and the marker.
import { MISSIONS, PLACES } from './config.js';
import { dist } from './random.js';
import { addHeat } from './wanted.js';
import { spawnPed } from './entities.js';

export function createMissions(rng, city) {
  const pickups = [];
  for (let i = 0; i < 6; i += 1) {
    const p = city.randomSidewalkPoint();
    pickups.push({ x: p.x, y: p.y, amount: 25 + rng.int(0, 4) * 10, taken: false, respawn: 0 });
  }
  return {
    index: 0, stage: 0, marker: null, objective: '',
    fare: null, fareTimer: 0, pickups, package: null, channel: 0,
    storyDone: false, faresDone: 0, earned: 0,
  };
}

function setMarker(m, x, y, label) { m.marker = { x, y, label }; }
function complete(m, world, events, reward) {
  world.cash += reward;
  m.earned += reward;
  events.missionDone = { name: MISSIONS[m.index].name, reward };
  m.index += 1;
  m.stage = 0;
  m.marker = null;
  if (m.index >= MISSIONS.length) m.storyDone = true;
}

function farRoadPoint(world, minD) {
  for (let i = 0; i < 10; i += 1) {
    const p = world.city.randomRoadPoint();
    if (dist(p.x, p.y, world.player.x, world.player.y) > minD) return p;
  }
  return world.city.randomRoadPoint();
}

// A sidewalk point a good distance from the player, for fare clients (they wait on
// the pavement where traffic cannot run them over).
function farSidewalkPoint(world, minD) {
  for (let i = 0; i < 10; i += 1) {
    const p = world.city.randomSidewalkPoint();
    if (dist(p.x, p.y, world.player.x, world.player.y) > minD) return p;
  }
  return world.city.randomSidewalkPoint();
}

export function stepMissions(m, world, events, dt) {
  const p = world.player, w = world.wanted;
  // Cash pickups.
  for (const pk of m.pickups) {
    if (pk.taken) {
      pk.respawn -= dt;
      if (pk.respawn <= 0) {
        const pt = world.city.randomSidewalkPoint();
        pk.x = pt.x; pk.y = pt.y; pk.taken = false;
      }
      continue;
    }
    if (p.onFoot && dist(p.x, p.y, pk.x, pk.y) < 28) {
      pk.taken = true; pk.respawn = 45;
      world.cash += pk.amount;
      events.pickup = { amount: pk.amount };
    }
  }

  if (m.storyDone) {
    // Repeatable fares keep the city paying.
    m.fareTimer -= dt;
    if (!m.fare && m.fareTimer <= 0) {
      const spot = farSidewalkPoint(world, 400);
      const ped = spawnPed(world.entities, world.city, world.rng);
      ped.x = spot.x; ped.y = spot.y; ped.tx = spot.x; ped.ty = spot.y;
      ped.waiting = true;
      m.fare = { ped, dest: farRoadPoint(world, 700), state: 'pickup' };
      setMarker(m, spot.x, spot.y, 'Passenger');
      m.objective = 'Fare waiting — pick them up in a car.';
      m.fareTimer = 30;
    }
    if (m.fare) stepFare(m, world, events, dt);
    return;
  }

  const mission = MISSIONS[m.index];
  if (m.index === 0) {
    m.objective = 'Steal a car — any car. Parked ones are free.';
    setMarker(m, p.x + 400, p.y, 'Find a car');
    if (events.enterCar) { m.marker = null; complete(m, world, events, mission.reward); }
    return;
  }
  if (m.index === 1) {
    if (m.stage === 0) {
      m.objective = 'Drive to the docks and grab the package on foot.';
      setMarker(m, PLACES.docks.x, PLACES.docks.y, 'The Docks');
      if (p.onFoot && dist(p.x, p.y, PLACES.docks.x, PLACES.docks.y) < 46) {
        m.stage = 1;
        events.pickup = { amount: 0, text: 'Package secured.' };
      }
    } else {
      m.objective = 'Bring the package to Vera’s garage.';
      setMarker(m, PLACES.garage.x, PLACES.garage.y, "Vera's Garage");
      if (dist(p.x, p.y, PLACES.garage.x, PLACES.garage.y) < 70) complete(m, world, events, mission.reward);
    }
    return;
  }
  if (m.index === 2) {
    if (m.stage === 0) {
      if (!m.fare) {
        const spot = farSidewalkPoint(world, 350);
        const ped = spawnPed(world.entities, world.city, world.rng);
        ped.x = spot.x; ped.y = spot.y; ped.tx = spot.x; ped.ty = spot.y; ped.waiting = true;
        m.fare = { ped, dest: farRoadPoint(world, 700), state: 'pickup' };
        setMarker(m, spot.x, spot.y, 'Passenger');
        m.objective = 'Pick up the client — in a car.';
      }
      if (m.fare.state === 'pickup' && !p.onFoot && dist(p.x, p.y, m.fare.ped.x, m.fare.ped.y) < 80) {
        m.fare.ped.state = 'down'; m.fare.ped.downTimer = 9999; // riding along, hidden in the car
        m.fare.state = 'drop';
        m.stage = 1; // now the drop-off branch can run
        setMarker(m, m.fare.dest.x, m.fare.dest.y, 'Destination');
        m.objective = 'Drop the client at the marker. No cops, no crashes.';
        events.pickup = { amount: 0, text: 'Client aboard.' };
      }
    } else if (m.fare.state === 'drop') {
      if (!p.onFoot && dist(p.x, p.y, m.fare.dest.x, m.fare.dest.y) < 80) {
        m.faresDone += 1;
        m.fare = null;
        complete(m, world, events, mission.reward);
      }
    }
    return;
  }
  if (m.index === 3) {
    if (m.stage === 0) {
      m.objective = 'Get the heat to 2 stars — steal, shoot, make noise.';
      setMarker(m, p.x + 300, p.y - 200, 'Make heat');
      if (w.stars >= 2) { m.stage = 1; events.pickup = { amount: 0, text: 'Two stars! Now lose them.' }; }
    } else {
      m.objective = 'Lose the cops — stay out of sight until the stars clear.';
      setMarker(m, PLACES.safehouse.x, PLACES.safehouse.y, 'Safehouse');
      if (w.stars === 0) complete(m, world, events, mission.reward);
    }
    return;
  }
  if (m.index === 4) {
    if (m.stage === 0) {
      m.objective = 'Get to Solmar Bank on foot and walk into the vault.';
      setMarker(m, PLACES.bank.x, PLACES.bank.y, 'Solmar Bank');
      if (p.onFoot && dist(p.x, p.y, PLACES.bank.x, PLACES.bank.y) < 60) {
        m.stage = 1; m.channel = 3;
        events.pickup = { amount: 0, text: 'Grabbing the cash — hold still!' };
      }
    } else if (m.stage === 1) {
      m.objective = 'Grabbing the cash… don’t move!';
      setMarker(m, PLACES.bank.x, PLACES.bank.y, 'Solmar Bank');
      m.channel -= dt;
      if (!p.onFoot || dist(p.x, p.y, PLACES.bank.x, PLACES.bank.y) > 90) {
        m.stage = 0; // walked away — start the grab again
      } else if (m.channel <= 0) {
        m.stage = 2;
        addHeat(w, 3, world.now);
        events.pickup = { amount: 0, text: 'Cash grabbed! 3 stars — run!' };
      }
    } else {
      m.objective = 'Escape to the safehouse with the cash.';
      setMarker(m, PLACES.safehouse.x, PLACES.safehouse.y, 'Safehouse');
      if (dist(p.x, p.y, PLACES.safehouse.x, PLACES.safehouse.y) < 90) {
        complete(m, world, events, mission.reward);
        events.pickup = { amount: 0, text: 'The Big Score — story complete!' };
      }
    }
  }
}

function stepFare(m, world, events, dt) {
  const p = world.player, f = m.fare;
  if (!f) return;
  if (f.state === 'pickup') {
    if (!p.onFoot && dist(p.x, p.y, f.ped.x, f.ped.y) < 80) {
      f.ped.state = 'down'; f.ped.downTimer = 9999;
      f.state = 'drop';
      setMarker(m, f.dest.x, f.dest.y, 'Destination');
      m.objective = 'Drop the client at the marker.';
      events.pickup = { amount: 0, text: 'Client aboard.' };
    }
  } else if (f.state === 'drop') {
    if (!p.onFoot && dist(p.x, p.y, f.dest.x, f.dest.y) < 80) {
      const tip = 60 + world.rng.int(0, 8) * 10;
      world.cash += tip;
      m.faresDone += 1;
      events.pickup = { amount: tip, text: 'Fare paid.' };
      m.fare = null;
      m.marker = null;
      m.objective = 'Free roam — fares and pickups keep paying.';
      m.fareTimer = 18;
    }
  }
}
