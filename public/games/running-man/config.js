// Tunable constants and type tables for Running Man.
// Importing this module must have no side effects.

export const W = 480;
export const H = 270;
// GROUND_Y is the horizon line — where mountains' bases sit and where the
// dark road region starts. The road extends from GROUND_Y down to H.
// Set so the road is exactly 1/4 of the canvas height: H - H/4 = 270 - 68.
export const GROUND_Y = 202;
// Hero feet land here — ~20 px from the bottom edge of the 270-tall canvas.
export const HERO_GROUND_Y = 250;
// Obstacle visible bases land here — ~28 px from the bottom edge.
export const OBSTACLE_GROUND_Y = 242;

// Hero sprite is 80×80 on a low-top-down canvas; the visible character is
// smaller than the sprite frame, so HITBOX shrinks the collider to the
// actual body.
export const HERO_X = 80;
export const HERO_W = 80;
export const HERO_H = 80;
// The 80×80 hero sprite has ~20 px of transparent padding below the feet
// (measured from alpha channel). Shift draw position down by this amount
// so the feet land on GROUND_Y. Physics still uses sprite-top convention.
export const HERO_FOOT_PAD = 20;
// HITBOX is in CANVAS-pixel offsets relative to (HERO_X, hero.y) — i.e. it
// already accounts for the rendering scale (80→85) and the 14 px lift
// applied in drawHero. Values were derived from the union of run-frame
// alpha bbox: source (30,23)-(49,59) → canvas-x [+32..+52], canvas-y
// [+30..+69] when drawn at 85×85 starting at hero.y + 6.
export const HITBOX = { x: 32, y: 30, w: 20, h: 39 };

// Physics
export const GRAVITY = 1500;
export const JUMP_VY = -520;

// World scroll
export const SPEED_START = 170;
export const SPEED_MAX = 380;
export const SPEED_RAMP = 5;

// Animation framerates
export const RUN_FPS = 12;
export const JUMP_FPS = 10;
export const DEATH_FPS = 10;

// Obstacle sprite metadata.
// `sprite` is the PNG path relative to the game folder.
// `spriteW/H` are the full image dimensions (with transparent padding).
// `hit` is the source-pixel bounding box of the VISIBLE ART inside the
// sprite (measured from the PNG alpha channel). It's used both as the
// collider AND as the render anchor — `ox/oy` say where the art starts
// inside the sprite, and `w/h` give the art's actual size in pixels.
// The hitbox is drawn 1:1 against the visible art so collisions only
// register when the player's body actually overlaps the drawing.
export const OBSTACLE_TYPES = [
  { idx: 0, name: 'rock',  sprite: 'obstacles/rock.png',  spriteW: 48, spriteH: 48, hit: { ox: 7,  oy: 11, w: 35, h: 28 } },
  { idx: 1, name: 'log',   sprite: 'obstacles/log.png',   spriteW: 64, spriteH: 48, hit: { ox: 3,  oy: 10, w: 56, h: 30 } },
  { idx: 2, name: 'crack', sprite: 'obstacles/crack.png', spriteW: 64, spriteH: 32, hit: { ox: 11, oy:  7, w: 42, h: 24 } },
];

export const OBSTACLE_BY_NAME = Object.fromEntries(OBSTACLE_TYPES.map((t) => [t.name, t]));

// Obstacle patterns: each pattern is one logical "group" that spawns as a
// unit. A group can be a single obstacle, multiple obstacles side-by-side,
// or a vertical stack. Each piece has:
//   - name:  obstacle type name ('rock' | 'log' | 'crack')
//   - scale: optional sprite + hitbox multiplier (default 1)
//   - dx:    optional horizontal offset from the group's spawn x (default 0)
//   - stack: if true, sit on top of the previous piece in the group
//
// Cracks are flat road hazards — never stack onto them. Logs are wide and
// low, so we don't stack on those either. Stacking is reserved for rocks
// (small rock pile makes visual sense). Keep group total height ≤ ~95 px
// so a max jump still clears it.
export const OBSTACLE_PATTERNS = [
  // Solo, varied scales
  [{ name: 'rock' }],
  [{ name: 'rock', scale: 0.75 }],
  [{ name: 'rock', scale: 1.3 }],
  [{ name: 'log' }],
  [{ name: 'log', scale: 0.85 }],
  [{ name: 'log', scale: 1.15 }],
  [{ name: 'crack' }],
  [{ name: 'crack', scale: 0.85 }],
  [{ name: 'crack', scale: 1.25 }],

  // Rocky patches
  [
    { name: 'rock' },
    { name: 'rock', dx: 22, scale: 0.7 },
  ],
  [
    { name: 'rock', scale: 0.9 },
    { name: 'rock', dx: 20, scale: 0.6 },
    { name: 'rock', dx: 36, scale: 1 },
  ],

  // Log debris with a rock pile at one end
  [
    { name: 'log' },
    { name: 'rock', dx: 50, scale: 0.7 },
  ],
  [
    { name: 'rock', scale: 0.7 },
    { name: 'log', dx: 16 },
  ],

  // Crack + rock — pothole with a chunk of road next to it
  [
    { name: 'crack' },
    { name: 'rock', dx: 40, scale: 0.65 },
  ],

  // Long stretch of damaged road — two cracks back-to-back
  [
    { name: 'crack' },
    { name: 'crack', dx: 38, scale: 0.85 },
  ],

  // Mini rock cairn — small pile to leap over
  [
    { name: 'rock', scale: 0.9 },
    { name: 'rock', scale: 0.7, stack: true, dx: 4 },
  ],
];

// Game state machine
export const STATE = Object.freeze({
  INTRO: 'intro',
  RUNNING: 'running',
  PAUSED: 'paused',
  DYING: 'dying',
  DEAD: 'dead',
});

// localStorage keys
export const STORAGE = Object.freeze({
  BEST: 'running-man:best',
  HISTORY: 'running-man:history',
});

// How many recent runs to keep in localStorage and how many to render on
// the death screen. Storage is the cap; render is the visible window.
export const HISTORY_STORE_MAX = 20;
export const HISTORY_RENDER_MAX = 5;
