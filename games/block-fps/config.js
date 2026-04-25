// Block Arena — design constants. Importing this module has no side effects.

import * as THREE from 'three';

// --- World ---

export const ARENA_HALF = 24;            // arena spans ±ARENA_HALF on X and Z
export const FLOOR_Y = 0;
export const WALL_HEIGHT = 6;
export const PLAYER_EYE = 1.65;
export const FOG_NEAR = 18;
export const FOG_FAR = 60;

// --- Palette (THREE.Color hex literals) ---

export const COLORS = {
  bg:        0x02030a,
  fog:       0x040814,
  floorDark: 0x080d18,
  floorLine: 0x123040,
  walls:     0x06080f,
  wallEdge:  0x00f0ff,
  accent:    0x00f0ff,
  magenta:   0xff3df0,
  lime:      0xb6ff00,
  red:       0xff3344,
  warn:      0xff8c00,

  // Gun
  gunBody:   0x232b3a,
  gunAccent: 0x00f0ff,
  gunGrip:   0x1a1f2a,
  gunSight:  0xff3344,

  // Enemies
  grunt:     0xff3344,
  charger:   0xffee00,
  heavy:     0xd27aff,
};

// --- Player ---

export const PLAYER_HP = 100;
export const PLAYER_SPEED = 7.0;          // walk speed (units/sec)
export const PLAYER_RADIUS = 0.35;        // collision radius vs walls / enemies
export const PLAYER_ACCEL = 50;           // ground acceleration
export const PLAYER_FRICTION = 12;        // ground friction
export const HIT_INVULN = 0.45;           // seconds of i-frames after taking damage

// --- Gun ---

export const GUN_DAMAGE = 28;             // damage per hit
export const GUN_RATE = 0.13;             // seconds between shots (≈7.7 RPS)
export const GUN_SPREAD = 0.005;          // radians of cone spread

// --- Enemies ---

export const ENEMIES = {
  grunt:   { hp: 32,  speed: 2.6, dmg: 8,  size: 0.85, score: 10, contactRate: 0.7, color: COLORS.grunt },
  charger: { hp: 18,  speed: 5.4, dmg: 6,  size: 0.55, score: 14, contactRate: 0.45, color: COLORS.charger },
  heavy:   { hp: 110, speed: 1.8, dmg: 16, size: 1.30, score: 35, contactRate: 1.0,  color: COLORS.heavy },
};

// --- Waves ---
//
// Each wave is { duration, spawnEvery, kinds, max } —
//   spawnEvery — seconds between spawns
//   kinds      — pool of enemy keys to randomly pick from per spawn
//   max        — max simultaneously alive (capped to keep waves fair)
// Wave clears when spawn budget exhausted AND no enemies left.

export const WAVES = [
  // Wave 1 — easy intro
  { count: 6,  spawnEvery: 1.6, kinds: ['grunt'],                       max: 4 },
  // Wave 2
  { count: 9,  spawnEvery: 1.2, kinds: ['grunt', 'grunt', 'charger'],   max: 5 },
  // Wave 3 — chargers ramp
  { count: 12, spawnEvery: 1.0, kinds: ['grunt', 'charger', 'charger'], max: 6 },
  // Wave 4 — first heavy
  { count: 14, spawnEvery: 0.9, kinds: ['grunt', 'charger', 'heavy'],   max: 7 },
  // Wave 5
  { count: 16, spawnEvery: 0.8, kinds: ['grunt', 'charger', 'charger'], max: 8 },
  // Wave 6
  { count: 18, spawnEvery: 0.7, kinds: ['grunt', 'charger', 'heavy'],   max: 9 },
  // Wave 7
  { count: 22, spawnEvery: 0.65,kinds: ['grunt', 'charger', 'heavy', 'charger'], max: 10 },
  // Wave 8 — endless seed; further waves derive from this.
  { count: 26, spawnEvery: 0.55,kinds: ['grunt', 'charger', 'heavy', 'charger'], max: 12 },
];

export const TOTAL_WAVES = WAVES.length;

// Endless mode multipliers — applied to enemy hp / spawn count once
// the player has cleared all named waves.
export function endlessMultipliers(idx) {
  if (idx <= TOTAL_WAVES) return { hp: 1, count: 1 };
  const over = idx - TOTAL_WAVES;
  return {
    hp: 1 + over * 0.20,
    count: 1 + over * 0.10,
  };
}

export const WAVE_COOLDOWN = 4.0;

// --- State machine ---

export const STATE = Object.freeze({
  INTRO: 'intro',
  PLAYING: 'playing',
  PAUSED: 'paused',
  DEAD: 'dead',
});

export const STORAGE = Object.freeze({
  BEST_WAVE:  'block-fps:best-wave',
  BEST_SCORE: 'block-fps:best-score',
  MUTED:      'block-fps:muted',
});

// Three.js Vector3 helpers used by player + enemies (kept here to avoid
// re-instantiating per frame).
export const TMP_VEC = new THREE.Vector3();
export const TMP_VEC2 = new THREE.Vector3();
