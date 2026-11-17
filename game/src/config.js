// SOLMAR HEAT — a sun-soaked open-world crime game. All tuning lives here.
export const WORLD = { w: 3600, h: 3600 };
export const ROAD_W = 90;            // road width in world px
export const BLOCK = 400;             // road centreline spacing
export const ROADS = [300, 700, 1100, 1500, 1900, 2300, 2700, 3100];
export const BEACH_Y = 3300;          // sand starts here
export const SEA_Y = 3480;            // water starts here
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmar-heat-save-v1';

export const COLORS = {
  grass: '#7fae5a', grass2: '#8fbc68', sand: '#e8d29a', sea: '#2e8fa8', seaDeep: '#1f6f8b',
  road: '#3d3a38', roadEdge: '#2c2927', lane: '#d8c96a', sidewalk: '#b9b2a4',
  crosswalk: '#e8e4da', park: '#6da34f', tree: '#3f7a3a', tree2: '#5a9e4b',
  palm: '#4c8a44', plaza: '#c9c2b2',
  buildingRoof: ['#c96f4a', '#d9a05b', '#8fa3b8', '#b8574e', '#6f9e7a', '#a98bc0', '#d17f8e', '#5b8a72'],
  player: '#ffd23f', playerDark: '#c89b1e', cop: '#2b5fd9',
  taxi: '#f2c200', sport: '#d93b3b', sedan: '#7a8a99', van: '#8a7a5a',
  muzzle: '#ffe9a8',
  hudBg: '#101014cc', hudLine: '#ffffff22', text: '#f5f0e6', dim: '#cfc8b8',
  star: '#ffd23f', starEmpty: '#ffffff33', cash: '#7ee081', health: '#e84c4c',
  marker: '#ffd23f', mission: '#ffcf3f',
};

export const PLAYER = {
  radius: 13, walkSpeed: 250, sprintSpeed: 350, accel: 1400,
  health: 100, pistolDamage: 34, pistolRange: 520, pistolRate: 0.16,
  magSize: 12, reloadTime: 1.1, bulletSpeed: 950,
};

export const CARS = {
  sedan: { len: 46, wid: 24, accel: 380, maxSpeed: 540, reverse: 200, grip: 6.5, turn: 2.5, health: 100, color: '#7a8a99', name: 'Sedan' },
  taxi: { len: 46, wid: 24, accel: 400, maxSpeed: 560, reverse: 210, grip: 6.5, turn: 2.6, health: 100, color: '#f2c200', name: 'Taxi' },
  sport: { len: 48, wid: 24, accel: 560, maxSpeed: 760, reverse: 240, grip: 7.5, turn: 3.0, health: 80, color: '#d93b3b', name: 'Sport' },
  van: { len: 56, wid: 26, accel: 300, maxSpeed: 430, reverse: 180, grip: 5.5, turn: 2.0, health: 160, color: '#8a7a5a', name: 'Van' },
  police: { len: 48, wid: 24, accel: 520, maxSpeed: 680, reverse: 240, grip: 7.0, turn: 2.9, health: 140, color: '#2b5fd9', name: 'Cruiser' },
};

export const PED = { radius: 9, walkSpeed: 55, runSpeed: 170, health: 50 };
export const COP = { radius: 10, walkSpeed: 150, runSpeed: 230, health: 80, shootRange: 340, shootRate: 0.9, damage: 9 };

export const WANTED = {
  maxStars: 5,
  decayCalm: 15,          // seconds of calm to drop one star (low heat)
  decayCalmHigh: 26,      // seconds of calm to drop one star at 3+ stars
  maxPoliceCars: [0, 1, 2, 3, 4, 5],
  maxFootCops: [0, 0, 2, 3, 4, 5],
};

export const MISSIONS = [
  { id: 0, name: 'Wheels', brief: 'Vera: Welcome to Solmar Bay, Dana. You need wheels. Take any car — parked ones are free, occupied ones draw eyes.', reward: 100 },
  { id: 1, name: 'The Pickup', brief: 'Vera: A package is waiting at the docks, south end. Drive down, grab it on foot, bring it to my garage.', reward: 300 },
  { id: 2, name: 'First Fare', brief: 'Vera: A client needs a ride. Pick them up in a car and drop them where they point. Quick and clean pays.', reward: 250 },
  { id: 3, name: 'Heat', brief: 'Vera: The cops are sniffing around us. Get to 2 stars, then shake them. Lose the tail and come back clean.', reward: 400 },
  { id: 4, name: 'The Big Score', brief: 'Vera: Solmar Bank. Walk in, take the cash, get out. Cops will come hard — lose them at the safehouse.', reward: 1500 },
];

export const PLACES = {
  garage: { x: 500, y: 690, label: "Vera's Garage" },
  docks: { x: 500, y: 3150, label: 'The Docks' },
  bank: { x: 1700, y: 1900, label: 'Solmar Bank' },
  hospital: { x: 2500, y: 690, label: 'Solmar General' },
  station: { x: 500, y: 2300, label: 'Police Station' },
  safehouse: { x: 2900, y: 3060, label: 'Safehouse' },
};

export const KEYS = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'], enter: ['KeyE'], reload: ['KeyR'],
  pause: ['KeyP', 'Escape'], mute: ['KeyM'], confirm: ['Space', 'Enter'],
};
