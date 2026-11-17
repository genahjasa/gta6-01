// SOLMAR HEAT — boot and the one loop. Input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. Screens: title, play, paused,
// wasted/busted. ?seed=N fixes the city. ?shot=chase|street|mission|title (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();
// Debug handle for automated playtests (and curious players): the live world.
window.__solmar = world;

function runShot(name) {
  const scene = stageShot(name, world);
  const save = world.readSave();
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, save, world.state.time);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = world.readSave();
  let accumulator = 0;
  let last = performance.now();
  let overKind = 'wasted';

  function announce(message) { status.textContent = message; }

  function startGame(fresh) {
    if (fresh) {
      world.reset(true);
      save = null;
    } else if (save) {
      world.loadSave(save);
    } else {
      world.reset(true);
    }
    screen = SCREEN_PLAY;
    accumulator = 0;
    announce('Playing. Steal a car — Vera needs wheels.');
  }

  function endGame(kind) {
    overKind = kind;
    screen = SCREEN_OVER;
    save = world.readSave();
    audio.fail();
    announce(kind === 'busted' ? 'Busted. Vera posted bail.' : 'Wasted. The hospital patched you up.');
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) { audio.unlock(); audio.click(); startGame(true); }
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        world.respawn(overKind);
        screen = SCREEN_PLAY;
        accumulator = 0;
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
      else if (screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_CONFIRM) audio.unlock();
    }
  }

  // 'C' continues a saved game from the title screen.
  window.addEventListener('keydown', (event) => {
    if (screen === SCREEN_TITLE && event.code === 'KeyC' && save) {
      audio.unlock(); audio.click(); startGame(false);
    }
  });

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_PLAY) {
      // One-shot actions (E to enter/exit a car, R to reload) must fire exactly once:
      // pass them to the first sub-step only, or a laggy frame with two sub-steps
      // would enter AND exit the car in the same frame.
      let firstStep = true;
      while (accumulator >= STEP) {
        const events = world.step(STEP, input, firstStep ? actions : 0);
        firstStep = false;
        accumulator -= STEP;
        if (events.shot) audio.shoot();
        if (events.enemyShot) audio.enemyShoot();
        if (events.siren) audio.siren();
        if (events.reload) audio.reload();
        if (events.enterCar || events.exitCar) audio.door();
        if (events.pickup) audio.pickup();
        if (events.missionDone) { audio.mission(); save = world.readSave(); }
        if (events.crash) audio.crash(Math.min(1, events.crash / 400));
        const p = world.state.player;
        audio.setEngine(p.inCar ? Math.abs(p.inCar.speed) / p.inCar.spec.maxSpeed : 0, !!p.inCar);
        if (world.state.over) { endGame(world.state.over); break; }
      }
    } else if (screen === SCREEN_TITLE) {
      // The title screen lives over a slow ambient city.
      while (accumulator >= STEP) {
        world.step(STEP, { moveX: () => 0, moveY: () => 0, up: () => false, down: () => false, left: () => false, right: () => false, sprint: () => false, mouse: () => ({ x: 640, y: 360, down: false }), takeActions: () => 0 }, 0);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, save, world.state.time);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar Heat. Press Space or click for a new game, C to continue.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
