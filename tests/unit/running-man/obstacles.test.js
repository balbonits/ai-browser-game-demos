// Unit tests for obstacles.js — AABB collision and pattern structure.
//
// aabb() is a pure function with no dependencies on DOM or assets, so it can
// be imported and tested directly.
//
// spawnObstacle() uses Math.random() internally, so we cannot test its output
// deterministically. We instead test structural invariants on OBSTACLE_PATTERNS
// (already covered in config.test.js) and test the AABB geometry logic here.

import { describe, it, expect } from 'vitest';
import { aabb } from '../../../public/games/running-man/obstacles.js';
import {
  HITBOX, HERO_X, HERO_GROUND_Y, HERO_H,
  OBSTACLE_TYPES, OBSTACLE_PATTERNS,
} from '../../../public/games/running-man/config.js';

// ---------------------------------------------------------------------------
// AABB collision
// ---------------------------------------------------------------------------

describe('AABB collision — clear separation', () => {
  it('returns false when rect A is entirely to the left of rect B', () => {
    const a = { x: 0,   y: 0, w: 10, h: 10 };
    const b = { x: 20,  y: 0, w: 10, h: 10 };
    expect(aabb(a, b)).toBe(false);
  });

  it('returns false when rect A is entirely to the right of rect B', () => {
    const a = { x: 30, y: 0, w: 10, h: 10 };
    const b = { x: 0,  y: 0, w: 10, h: 10 };
    expect(aabb(a, b)).toBe(false);
  });

  it('returns false when rect A is entirely above rect B', () => {
    const a = { x: 0, y: 0,  w: 10, h: 10 };
    const b = { x: 0, y: 20, w: 10, h: 10 };
    expect(aabb(a, b)).toBe(false);
  });

  it('returns false when rect A is entirely below rect B', () => {
    const a = { x: 0, y: 30, w: 10, h: 10 };
    const b = { x: 0, y: 0,  w: 10, h: 10 };
    expect(aabb(a, b)).toBe(false);
  });
});

describe('AABB collision — touching edges (not overlapping)', () => {
  it('returns false when right edge of A exactly meets left edge of B', () => {
    // a.x + a.w === b.x → a.x + a.w > b.x is false → no overlap
    const a = { x: 0,  y: 0, w: 10, h: 10 };
    const b = { x: 10, y: 0, w: 10, h: 10 };
    expect(aabb(a, b)).toBe(false);
  });

  it('returns false when bottom edge of A exactly meets top edge of B', () => {
    const a = { x: 0, y: 0,  w: 10, h: 10 };
    const b = { x: 0, y: 10, w: 10, h: 10 };
    expect(aabb(a, b)).toBe(false);
  });
});

describe('AABB collision — overlap', () => {
  it('returns true for identical rects', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    expect(aabb(a, a)).toBe(true);
  });

  it('returns true for rects that overlap by 1 px horizontally', () => {
    const a = { x: 0, y: 0, w: 11, h: 10 };
    const b = { x: 10, y: 0, w: 10, h: 10 };
    expect(aabb(a, b)).toBe(true);
  });

  it('returns true for rects that overlap by 1 px vertically', () => {
    const a = { x: 0, y: 0, w: 10, h: 11 };
    const b = { x: 0, y: 10, w: 10, h: 10 };
    expect(aabb(a, b)).toBe(true);
  });

  it('returns true for rects with full overlap', () => {
    const a = { x: 5, y: 5, w: 10, h: 10 };
    const b = { x: 0, y: 0, w: 20, h: 20 };
    expect(aabb(a, b)).toBe(true);
  });

  it('returns true for rects that partially overlap diagonally', () => {
    const a = { x: 0,  y: 0,  w: 15, h: 15 };
    const b = { x: 10, y: 10, w: 15, h: 15 };
    expect(aabb(a, b)).toBe(true);
  });
});

describe('AABB collision — hero hitbox vs obstacle at known positions', () => {
  // Hero hitbox when standing on the ground:
  //   x = HERO_X + HITBOX.x
  //   y = (HERO_GROUND_Y - HERO_H) + HITBOX.y
  const heroGroundY = HERO_GROUND_Y - HERO_H;

  function heroHitbox(heroY = heroGroundY) {
    return {
      x: HERO_X + HITBOX.x,
      y: heroY + HITBOX.y,
      w: HITBOX.w,
      h: HITBOX.h,
    };
  }

  it('hero does not collide with an obstacle placed far to the right (off-screen)', () => {
    const hb = heroHitbox();
    const obstacle = { x: 500, y: hb.y, w: 30, h: 30 };
    expect(aabb(hb, obstacle)).toBe(false);
  });

  it('hero does not collide with an obstacle placed far to the left', () => {
    const hb = heroHitbox();
    const obstacle = { x: -60, y: hb.y, w: 30, h: 30 };
    expect(aabb(hb, obstacle)).toBe(false);
  });

  it('hero collides with an obstacle placed exactly at the hero hitbox position', () => {
    const hb = heroHitbox();
    // Place an obstacle coincident with the hero's hitbox.
    const obstacle = { x: hb.x, y: hb.y, w: hb.w, h: hb.h };
    expect(aabb(hb, obstacle)).toBe(true);
  });

  it('hero collides with a rock-sized obstacle placed at hero x, same y band', () => {
    // Simulate a rock obstacle sitting at the hero's position.
    const rock = OBSTACLE_TYPES.find((t) => t.name === 'rock');
    const hb = heroHitbox();
    // Obstacle hits rect coincident with hero:
    const obstacle = { x: hb.x, y: hb.y, w: rock.hit.w, h: rock.hit.h };
    expect(aabb(hb, obstacle)).toBe(true);
  });

  it('hero does not collide with an obstacle that just cleared the hero (1 px above hitbox)', () => {
    const hb = heroHitbox();
    // Obstacle base is exactly at hb.y — height, so it ends at hb.y.
    const obstacle = { x: hb.x, y: hb.y - 10, w: hb.w, h: 10 };
    // obstacle bottom = hb.y - 10 + 10 = hb.y; hb top = hb.y. No overlap (touching, not overlapping).
    expect(aabb(hb, obstacle)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// OBSTACLE_PATTERNS structural check (supplementary — config.test.js covers
// this in more detail; these are collision-oriented checks)
// ---------------------------------------------------------------------------

describe('OBSTACLE_PATTERNS — piece dx values', () => {
  it('every dx is a finite number (when present)', () => {
    for (const pattern of OBSTACLE_PATTERNS) {
      for (const piece of pattern) {
        if (piece.dx !== undefined) {
          expect(Number.isFinite(piece.dx)).toBe(true);
        }
      }
    }
  });

  it('no single pattern has a total horizontal spread > 200 px at scale 1', () => {
    // A spread > 200 px at default scale would mean the pattern extends
    // nearly half the canvas width — unreasonable for a single spawn group.
    for (const pattern of OBSTACLE_PATTERNS) {
      const dxValues = pattern.map((p) => p.dx ?? 0);
      const spread = Math.max(...dxValues) - Math.min(...dxValues);
      expect(spread).toBeLessThanOrEqual(200);
    }
  });
});
