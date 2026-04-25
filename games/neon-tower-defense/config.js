// Neon Tower Defense — design constants and content tables.
// Importing this module must have no side effects.

// --- Canvas ---

export const W = 480;
export const H = 270;

// HUD strip at the very top of the canvas (drawn into the canvas itself,
// not the surrounding HTML — so the canvas owns its own visual frame).
export const HUD_H = 22;
// Game-area extents (where the path + towers live).
export const FIELD_TOP = HUD_H;       // 22
export const FIELD_BOT = H;           // 270
export const FIELD_H = FIELD_BOT - FIELD_TOP; // 248

// --- Palette ---

// Neon palette. Hex codes used for shape fills/strokes; rgb tuples used
// where canvas needs alpha blending (shadowColor / glow halos).
export const COLORS = {
  bg0: '#03050a',
  bg1: '#0a0e18',
  grid: 'rgba(0, 240, 255, 0.05)',

  path: '#00f0ff',          // cyan path
  pathGlow: 'rgba(0, 240, 255, 0.55)',
  pathFill: 'rgba(0, 240, 255, 0.08)',

  // Towers
  bolt: '#00f0ff',          // cyan triangle
  pulse: '#ff3df0',         // magenta square
  spike: '#b6ff00',         // lime diamond

  // Enemies
  squareEnemy: '#ff3344',   // red
  hexEnemy: '#ff8c00',      // orange
  triEnemy: '#ffee00',      // yellow
  bossEnemy: '#d27aff',     // purple

  // UI
  hud: '#e6e9f5',
  hudDim: '#8d92a6',
  ok: '#b6ff00',
  warn: '#ff3df0',
  bad: '#ff3344',
  buildOk: 'rgba(182, 255, 0, 0.30)',
  buildBad: 'rgba(255, 51, 68, 0.32)',
};

// --- Grid ---

// Towers snap to a 16-px grid in the game-field. Placing a tower locks
// the tile beneath it. Path tiles are also locked.
export const TILE = 16;
export const COLS = Math.floor(W / TILE);                  // 30
export const ROWS = Math.floor(FIELD_H / TILE);            // 15

// --- Path ---
//
// Path is a polyline from one waypoint to the next. Enemies walk along it.
// Coordinates are canvas pixels. Y values stay strictly inside the field
// (>= FIELD_TOP + 16 and <= H - 16) so the path never clips the HUD or
// the canvas edge. Enemies enter from the left edge (x=-20) and exit
// past the right edge (x=W+20).
export const PATH = [
  { x: -20, y: 70 },
  { x: 90, y: 70 },
  { x: 90, y: 170 },
  { x: 220, y: 170 },
  { x: 220, y: 80 },
  { x: 360, y: 80 },
  { x: 360, y: 200 },
  { x: 500, y: 200 },
];

// Half-width of the visible path drawing (also used as the no-build
// radius — tiles whose center is within this distance of the path
// centerline are blocked).
export const PATH_W = 14;
export const NO_BUILD_RADIUS = 18;

// --- Economy ---

export const STARTING_MONEY = 120;
export const STARTING_LIVES = 20;

// Inter-wave cooldown (the player can press SPACE to skip).
export const WAVE_COOLDOWN = 6.0;

// --- Towers ---
//
// Each tower has 3 levels. Each level supplies its own stats and a cost
// to UPGRADE INTO that level (level 1 = build cost). Sell refunds 70%
// of total invested.
//
// stats:
//   dmg     — damage per projectile/hit
//   range   — pixel range from tower center (tower won't fire beyond)
//   rate    — seconds between shots
//   speed   — projectile speed (px/s); ignored for instant-hit towers
//   aoe     — area-of-effect radius for splash damage (0 = single target)
//   slow    — fraction speed reduction applied to hit enemies (0 = none)
//   slowDur — slow effect duration (s)
//   pierce  — how many enemies a single shot can hit (1 = single target)
//   color   — main neon color
//   shape   — geometric form drawn for the tower body

export const TOWERS = {
  bolt: {
    name: 'Bolt',
    shape: 'triangle',
    color: COLORS.bolt,
    desc: 'Fast cyan triangle. Cheap, reliable single-target.',
    levels: [
      { cost: 40,  dmg: 12, range: 84,  rate: 0.55, speed: 360, aoe: 0,  slow: 0,    slowDur: 0,  pierce: 1 },
      { cost: 50,  dmg: 22, range: 92,  rate: 0.50, speed: 380, aoe: 0,  slow: 0,    slowDur: 0,  pierce: 1 },
      { cost: 70,  dmg: 38, range: 100, rate: 0.42, speed: 420, aoe: 0,  slow: 0.25, slowDur: 0.6, pierce: 1 },
    ],
  },
  pulse: {
    name: 'Pulse',
    shape: 'square',
    color: COLORS.pulse,
    desc: 'Magenta square. Slow rate, splash damage on impact.',
    levels: [
      { cost: 80,  dmg: 18, range: 64, rate: 1.50, speed: 260, aoe: 30, slow: 0,    slowDur: 0,  pierce: 1 },
      { cost: 100, dmg: 28, range: 72, rate: 1.30, speed: 280, aoe: 36, slow: 0,    slowDur: 0,  pierce: 1 },
      { cost: 140, dmg: 46, range: 84, rate: 1.10, speed: 300, aoe: 44, slow: 0.20, slowDur: 0.8, pierce: 1 },
    ],
  },
  spike: {
    name: 'Spike',
    shape: 'diamond',
    color: COLORS.spike,
    desc: 'Lime diamond. Long range, slow rate, brutal damage.',
    levels: [
      { cost: 100, dmg: 50,  range: 144, rate: 2.00, speed: 520, aoe: 0, slow: 0, slowDur: 0, pierce: 1 },
      { cost: 130, dmg: 92,  range: 156, rate: 1.80, speed: 560, aoe: 0, slow: 0, slowDur: 0, pierce: 2 },
      { cost: 180, dmg: 180, range: 172, rate: 1.60, speed: 600, aoe: 0, slow: 0, slowDur: 0, pierce: 4 },
    ],
  },
};

export const TOWER_KEYS = ['bolt', 'pulse', 'spike'];

// --- Enemies ---
//
// hp     — hit points
// speed  — base px/s along path
// value  — credits awarded on kill
// damage — lives lost when this enemy reaches the path end
// shape  — geometric form drawn
// color  — neon body color
// size   — outer radius for drawing + AABB bounds (also affects how fat
//          the AoE blast feels)

export const ENEMIES = {
  square: { name: 'Square',  hp: 30,  speed: 50, value: 6,  damage: 1, shape: 'square',  color: COLORS.squareEnemy, size: 7 },
  hex:    { name: 'Hex',     hp: 80,  speed: 40, value: 12, damage: 1, shape: 'hex',     color: COLORS.hexEnemy,    size: 9 },
  tri:    { name: 'Tri',     hp: 24,  speed: 95, value: 8,  damage: 1, shape: 'triangle',color: COLORS.triEnemy,    size: 7 },
  boss:   { name: 'Diamond', hp: 600, speed: 28, value: 80, damage: 5, shape: 'diamond', color: COLORS.bossEnemy,   size: 13 },
};

// --- Waves ---
//
// Each wave is an array of "segments". A segment spawns `count` enemies
// of `kind`, with `gap` seconds between each spawn. Segments run
// sequentially with `delay` seconds between segments (default 1.0).
//
// Twelve waves total. Boss waves: 4, 8, 12.

export const WAVES = [
  // 1
  [{ kind: 'square', count: 8,  gap: 0.65 }],
  // 2
  [
    { kind: 'square', count: 10, gap: 0.55 },
    { kind: 'tri',    count: 5,  gap: 0.40, delay: 1.0 },
  ],
  // 3
  [
    { kind: 'hex',    count: 6,  gap: 0.85 },
    { kind: 'tri',    count: 8,  gap: 0.35, delay: 1.0 },
    { kind: 'square', count: 6,  gap: 0.45, delay: 0.6 },
  ],
  // 4 — BOSS
  [
    { kind: 'square', count: 12, gap: 0.45 },
    { kind: 'boss',   count: 1,  gap: 1.0,  delay: 1.5 },
    { kind: 'tri',    count: 6,  gap: 0.30, delay: 0.6 },
  ],
  // 5
  [
    { kind: 'tri',    count: 10, gap: 0.30 },
    { kind: 'hex',    count: 6,  gap: 0.70, delay: 0.8 },
    { kind: 'square', count: 14, gap: 0.40, delay: 0.6 },
  ],
  // 6
  [
    { kind: 'hex',    count: 12, gap: 0.55 },
    { kind: 'tri',    count: 14, gap: 0.25, delay: 0.8 },
  ],
  // 7
  [
    { kind: 'hex',    count: 18, gap: 0.50 },
    { kind: 'square', count: 8,  gap: 0.30, delay: 0.6 },
  ],
  // 8 — BOSS
  [
    { kind: 'square', count: 18, gap: 0.32 },
    { kind: 'tri',    count: 10, gap: 0.28, delay: 0.6 },
    { kind: 'boss',   count: 1,  gap: 1.0,  delay: 1.0 },
    { kind: 'hex',    count: 8,  gap: 0.55, delay: 0.4 },
  ],
  // 9
  [
    { kind: 'tri',    count: 24, gap: 0.22 },
    { kind: 'hex',    count: 10, gap: 0.50, delay: 0.5 },
  ],
  // 10
  [
    { kind: 'square', count: 30, gap: 0.30 },
    { kind: 'hex',    count: 14, gap: 0.45, delay: 0.5 },
  ],
  // 11
  [
    { kind: 'hex',    count: 18, gap: 0.45 },
    { kind: 'tri',    count: 22, gap: 0.20, delay: 0.6 },
    { kind: 'square', count: 12, gap: 0.35, delay: 0.4 },
  ],
  // 12 — FINAL BOSS
  [
    { kind: 'tri',    count: 16, gap: 0.20 },
    { kind: 'boss',   count: 1,  gap: 1.0,  delay: 1.0 },
    { kind: 'hex',    count: 18, gap: 0.40, delay: 0.6 },
    { kind: 'boss',   count: 1,  gap: 1.0,  delay: 0.8 },
    { kind: 'square', count: 24, gap: 0.30, delay: 0.4 },
  ],
];

export const TOTAL_WAVES = WAVES.length;

// --- State machine ---

export const STATE = Object.freeze({
  INTRO: 'intro',
  READY: 'ready',         // between waves, waiting for cooldown / SPACE
  RUNNING: 'running',     // a wave is currently spawning/active
  PAUSED: 'paused',
  WON: 'won',
  LOST: 'lost',
});

// localStorage keys
export const STORAGE = Object.freeze({
  BEST: 'neon-td:best',         // highest wave reached
  MUTED: 'neon-td:muted',
});
