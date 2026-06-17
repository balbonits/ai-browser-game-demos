// Unit tests for running-man/config.js
//
// Sanity-checks the physics constants, obstacle type tables, and pattern
// definitions. These values are the contract between the design spec and the
// game code — if they drift, the game becomes un-jumpable or broken.

import { describe, it, expect } from 'vitest';
import {
  GRAVITY, JUMP_VY,
  HERO_GROUND_Y, HERO_H,
  HITBOX,
  OBSTACLE_TYPES, OBSTACLE_PATTERNS,
  STATE, STORAGE,
} from '../../../public/games/running-man/config.js';

describe('Running Man config — physics constants', () => {
  it('GRAVITY is positive (pulls hero down)', () => {
    expect(GRAVITY).toBeGreaterThan(0);
  });

  it('JUMP_VY is negative (propels hero upward)', () => {
    expect(JUMP_VY).toBeLessThan(0);
  });

  it('GRAVITY matches design spec (1500 px/s²)', () => {
    expect(GRAVITY).toBe(1500);
  });

  it('JUMP_VY matches design spec (-520 px/s)', () => {
    expect(JUMP_VY).toBe(-520);
  });

  it('hero ground position is above zero (not off-screen)', () => {
    // HERO_GROUND_Y - HERO_H is the hero's y when on ground; must be >= 0.
    expect(HERO_GROUND_Y - HERO_H).toBeGreaterThanOrEqual(0);
  });
});

describe('Running Man config — hero hitbox', () => {
  it('HITBOX has positive width and height', () => {
    expect(HITBOX.w).toBeGreaterThan(0);
    expect(HITBOX.h).toBeGreaterThan(0);
  });

  it('HITBOX x offset is non-negative', () => {
    expect(HITBOX.x).toBeGreaterThanOrEqual(0);
  });

  it('HITBOX y offset is non-negative', () => {
    expect(HITBOX.y).toBeGreaterThanOrEqual(0);
  });
});

describe('Running Man config — OBSTACLE_TYPES', () => {
  it('has exactly 3 obstacle types', () => {
    expect(OBSTACLE_TYPES).toHaveLength(3);
  });

  it('includes rock, log, and crack types', () => {
    const names = OBSTACLE_TYPES.map((t) => t.name);
    expect(names).toContain('rock');
    expect(names).toContain('log');
    expect(names).toContain('crack');
  });

  // For each obstacle type, verify the hit rect stays within the sprite.
  for (const type of [
    { idx: 0, name: 'rock',  sprite: 'obstacles/rock.png',  spriteW: 48, spriteH: 48, hit: { ox: 7,  oy: 11, w: 35, h: 28 } },
    { idx: 1, name: 'log',   sprite: 'obstacles/log.png',   spriteW: 64, spriteH: 48, hit: { ox: 3,  oy: 10, w: 56, h: 30 } },
    { idx: 2, name: 'crack', sprite: 'obstacles/crack.png', spriteW: 64, spriteH: 32, hit: { ox: 11, oy:  7, w: 42, h: 24 } },
  ]) {
    it(`${type.name}: hit rect fits within sprite width (ox + w <= spriteW)`, () => {
      const t = OBSTACLE_TYPES.find((o) => o.name === type.name);
      expect(t.hit.ox + t.hit.w).toBeLessThanOrEqual(t.spriteW);
    });

    it(`${type.name}: hit rect fits within sprite height (oy + h <= spriteH)`, () => {
      const t = OBSTACLE_TYPES.find((o) => o.name === type.name);
      expect(t.hit.oy + t.hit.h).toBeLessThanOrEqual(t.spriteH);
    });

    it(`${type.name}: hit rect offsets are non-negative`, () => {
      const t = OBSTACLE_TYPES.find((o) => o.name === type.name);
      expect(t.hit.ox).toBeGreaterThanOrEqual(0);
      expect(t.hit.oy).toBeGreaterThanOrEqual(0);
    });

    it(`${type.name}: hit rect dimensions are positive`, () => {
      const t = OBSTACLE_TYPES.find((o) => o.name === type.name);
      expect(t.hit.w).toBeGreaterThan(0);
      expect(t.hit.h).toBeGreaterThan(0);
    });

    it(`${type.name}: idx matches array position`, () => {
      const t = OBSTACLE_TYPES.find((o) => o.name === type.name);
      expect(t.idx).toBe(OBSTACLE_TYPES.indexOf(t));
    });
  }
});

describe('Running Man config — OBSTACLE_PATTERNS', () => {
  it('has at least one pattern', () => {
    expect(OBSTACLE_PATTERNS.length).toBeGreaterThan(0);
  });

  it('every pattern is a non-empty array', () => {
    for (const pattern of OBSTACLE_PATTERNS) {
      expect(Array.isArray(pattern)).toBe(true);
      expect(pattern.length).toBeGreaterThan(0);
    }
  });

  it('every piece in every pattern has a valid name (rock | log | crack)', () => {
    const valid = new Set(['rock', 'log', 'crack']);
    for (const pattern of OBSTACLE_PATTERNS) {
      for (const piece of pattern) {
        expect(valid.has(piece.name)).toBe(true);
      }
    }
  });

  it('every scale value in patterns is positive (when present)', () => {
    for (const pattern of OBSTACLE_PATTERNS) {
      for (const piece of pattern) {
        if (piece.scale !== undefined) {
          expect(piece.scale).toBeGreaterThan(0);
        }
      }
    }
  });

  it('no crack or log piece is marked as stack:true', () => {
    // Per config comments: cracks are flat road hazards — never stack onto them.
    // Logs are wide and low, so we don't stack on those either.
    for (const pattern of OBSTACLE_PATTERNS) {
      for (const piece of pattern) {
        if (piece.stack === true) {
          expect(piece.name).toBe('rock');
        }
      }
    }
  });
});

describe('Running Man config — STATE enum', () => {
  it('STATE has all five states', () => {
    expect(STATE.INTRO).toBe('intro');
    expect(STATE.RUNNING).toBe('running');
    expect(STATE.PAUSED).toBe('paused');
    expect(STATE.DYING).toBe('dying');
    expect(STATE.DEAD).toBe('dead');
  });

  it('STATE is frozen (no mutation)', () => {
    expect(Object.isFrozen(STATE)).toBe(true);
  });
});

describe('Running Man config — STORAGE keys', () => {
  it('STORAGE.BEST is the correct localStorage key', () => {
    expect(STORAGE.BEST).toBe('running-man:best');
  });

  it('STORAGE is frozen (no mutation)', () => {
    expect(Object.isFrozen(STORAGE)).toBe(true);
  });
});
