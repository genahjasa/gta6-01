// Keyboard and pointer input. Held keys give a steering vector; one-shot presses (enter
// car, reload, pause, confirm) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice. The mouse aims and shoots.
import { KEYS } from './config.js';

export const ACTION_ENTER = 1;
export const ACTION_RELOAD = 2;
export const ACTION_PAUSE = 4;
export const ACTION_CONFIRM = 8;
export const ACTION_MUTE = 16;

function codeSet(list) { return new Set(list); }
const UP = codeSet(KEYS.up), DOWN = codeSet(KEYS.down), LEFT = codeSet(KEYS.left), RIGHT = codeSet(KEYS.right);
const SPRINT = codeSet(KEYS.sprint), ENTER = codeSet(KEYS.enter), RELOAD = codeSet(KEYS.reload);
const PAUSE = codeSet(KEYS.pause), MUTE = codeSet(KEYS.mute), CONFIRM = codeSet(KEYS.confirm);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0, mouseY = 0, mouseDown = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (ENTER.has(event.code)) actions |= ACTION_ENTER;
    else if (RELOAD.has(event.code)) actions |= ACTION_RELOAD;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    else if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || event.code === 'Space') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => { keys.delete(event.code); });
  window.addEventListener('blur', () => { keys.clear(); mouseDown = false; });
  canvas.addEventListener('pointermove', (event) => {
    const r = canvas.getBoundingClientRect();
    mouseX = event.clientX - r.left; mouseY = event.clientY - r.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const r = canvas.getBoundingClientRect();
    mouseX = event.clientX - r.left; mouseY = event.clientY - r.top;
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => { mouseDown = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function held(set) { for (const c of set) if (keys.has(c)) return true; return false; }
  return {
    moveX() { return (held(RIGHT) ? 1 : 0) - (held(LEFT) ? 1 : 0); },
    moveY() { return (held(DOWN) ? 1 : 0) - (held(UP) ? 1 : 0); },
    up() { return held(UP); },
    down() { return held(DOWN); },
    left() { return held(LEFT); },
    right() { return held(RIGHT); },
    sprint() { return held(SPRINT); },
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    takeActions() { const t = actions; actions = 0; return t; },
  };
}

// A scripted stand-in with the same interface, for the screenshot autopilot: the shot
// stager drives it instead of a keyboard.
export function createScriptedInput() {
  const state = { x: 0, y: 0, up: false, down: false, left: false, right: false, sprint: false, mx: 640, my: 300, mdown: false };
  return {
    set(s) { Object.assign(state, s); },
    moveX() { return (state.right ? 1 : 0) - (state.left ? 1 : 0); },
    moveY() { return (state.down ? 1 : 0) - (state.up ? 1 : 0); },
    up() { return state.up; }, down() { return state.down; },
    left() { return state.left; }, right() { return state.right; },
    sprint() { return state.sprint; },
    mouse() { return { x: state.mx, y: state.my, down: state.mdown }; },
    takeActions() { return 0; },
  };
}
