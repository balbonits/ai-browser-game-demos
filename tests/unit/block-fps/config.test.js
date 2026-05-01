// Unit tests for block-fps/config.js — pure data sanity checks.
//
// config.js does `import * as THREE from 'three'`. THREE must be installed as
// a devDependency so Vitest can resolve the bare specifier in Node. The game
// still loads three from the CDN import-map at runtime — this devDep is
// test-only scaffolding.
//
// All tests here are data-only. No DOM, no canvas, no scene.

import { describe, it, expect } from 'vitest';
import {
  ENEMIES, WAVES, TOTAL_WAVES, endlessMultipliers,
  STATE, STORAGE, PLAYER_HP, GUN_DAMAGE, GUN_RATE,
} from '../../../public/games/block-fps/config.js';

// ---------------------------------------------------------------------------
// ENEMIES table
// ---------------------------------------------------------------------------

describe('config — ENEMIES table', () => {
  it('has grunt, charger, and heavy entries', () => {
    expect(ENEMIES).toHaveProperty('grunt');
    expect(ENEMIES).toHaveProperty('charger');
    expect(ENEMIES).toHaveProperty('heavy');
  });

  it('each enemy kind has a positive hp stat', () => {
    for (const [kind, def] of Object.entries(ENEMIES)) {
      expect(def.hp, `${kind}.hp`).toBeGreaterThan(0);
    }
  });

  it('each enemy kind has a positive speed stat', () => {
    for (const [kind, def] of Object.entries(ENEMIES)) {
      expect(def.speed, `${kind}.speed`).toBeGreaterThan(0);
    }
  });

  it('each enemy kind has a positive score value', () => {
    for (const [kind, def] of Object.entries(ENEMIES)) {
      expect(def.score, `${kind}.score`).toBeGreaterThan(0);
    }
  });

  it('heavy has more hp than grunt and charger', () => {
    expect(ENEMIES.heavy.hp).toBeGreaterThan(ENEMIES.grunt.hp);
    expect(ENEMIES.heavy.hp).toBeGreaterThan(ENEMIES.charger.hp);
  });

  it('charger is faster than grunt and heavy', () => {
    expect(ENEMIES.charger.speed).toBeGreaterThan(ENEMIES.grunt.speed);
    expect(ENEMIES.charger.speed).toBeGreaterThan(ENEMIES.heavy.speed);
  });
});

// ---------------------------------------------------------------------------
// WAVES table
// ---------------------------------------------------------------------------

describe('config — WAVES table', () => {
  it('WAVES.length equals TOTAL_WAVES', () => {
    expect(WAVES.length).toBe(TOTAL_WAVES);
  });

  it('TOTAL_WAVES is 8', () => {
    expect(TOTAL_WAVES).toBe(8);
  });

  it('every wave has count > 0', () => {
    for (let i = 0; i < WAVES.length; i++) {
      expect(WAVES[i].count, `WAVES[${i}].count`).toBeGreaterThan(0);
    }
  });

  it('every wave has spawnEvery > 0', () => {
    for (let i = 0; i < WAVES.length; i++) {
      expect(WAVES[i].spawnEvery, `WAVES[${i}].spawnEvery`).toBeGreaterThan(0);
    }
  });

  it('every wave has a non-empty kinds array with known enemy types', () => {
    const knownKinds = new Set(Object.keys(ENEMIES));
    for (let i = 0; i < WAVES.length; i++) {
      const { kinds } = WAVES[i];
      expect(kinds.length, `WAVES[${i}].kinds non-empty`).toBeGreaterThan(0);
      for (const k of kinds) {
        expect(knownKinds.has(k), `WAVES[${i}] kind "${k}" is a known enemy`).toBe(true);
      }
    }
  });

  it('every wave has a positive max concurrent cap', () => {
    for (let i = 0; i < WAVES.length; i++) {
      expect(WAVES[i].max, `WAVES[${i}].max`).toBeGreaterThan(0);
    }
  });

  it('waves become harder: count does not strictly decrease wave-over-wave', () => {
    // Allow ties; just verify no wave is far easier than the one before it.
    // (Spec: waves ramp difficulty.)
    for (let i = 1; i < WAVES.length; i++) {
      expect(WAVES[i].count, `wave ${i + 1} count >= wave ${i} count`).toBeGreaterThanOrEqual(WAVES[i - 1].count);
    }
  });
});

// ---------------------------------------------------------------------------
// endlessMultipliers
// ---------------------------------------------------------------------------

describe('config — endlessMultipliers', () => {
  it('returns hp === 1 for index === 0 (before any waves)', () => {
    expect(endlessMultipliers(0).hp).toBe(1);
  });

  it('returns count === 1 for index === 0', () => {
    expect(endlessMultipliers(0).count).toBe(1);
  });

  it('returns hp === 1 for index === TOTAL_WAVES (last named wave)', () => {
    expect(endlessMultipliers(TOTAL_WAVES).hp).toBe(1);
  });

  it('returns hp > 1 for index > TOTAL_WAVES (endless territory)', () => {
    expect(endlessMultipliers(TOTAL_WAVES + 1).hp).toBeGreaterThan(1);
    expect(endlessMultipliers(TOTAL_WAVES + 5).hp).toBeGreaterThan(1);
  });

  it('hp scales up as index increases past TOTAL_WAVES', () => {
    const a = endlessMultipliers(TOTAL_WAVES + 1).hp;
    const b = endlessMultipliers(TOTAL_WAVES + 5).hp;
    expect(b).toBeGreaterThan(a);
  });

  it('count scales up as index increases past TOTAL_WAVES', () => {
    const a = endlessMultipliers(TOTAL_WAVES + 1).count;
    const b = endlessMultipliers(TOTAL_WAVES + 5).count;
    expect(b).toBeGreaterThan(a);
  });
});

// ---------------------------------------------------------------------------
// Game constants
// ---------------------------------------------------------------------------

describe('config — game constants', () => {
  it('PLAYER_HP is 100', () => {
    expect(PLAYER_HP).toBe(100);
  });

  it('GUN_DAMAGE is positive', () => {
    expect(GUN_DAMAGE).toBeGreaterThan(0);
  });

  it('GUN_RATE is positive', () => {
    expect(GUN_RATE).toBeGreaterThan(0);
  });

  it('STATE has the four expected values', () => {
    expect(STATE.INTRO).toBe('intro');
    expect(STATE.PLAYING).toBe('playing');
    expect(STATE.PAUSED).toBe('paused');
    expect(STATE.DEAD).toBe('dead');
  });

  it('STORAGE keys are all block-fps namespaced', () => {
    for (const val of Object.values(STORAGE)) {
      expect(val).toMatch(/^block-fps:/);
    }
  });
});
