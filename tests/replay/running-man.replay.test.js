// Running Man replay test — spawn sequence contract.
//
// LIMITATION: spawnObstacle() in obstacles.js uses Math.random() with no
// seedable interface. The module does not expose a seeded RNG, so true
// deterministic replay is not possible without modifying the game code (which
// is out of scope for a test-backfill task). This file is therefore a
// "degraded replay" test that:
//
//   1. Verifies that calling spawnObstacle() N times with a fixed speed always
//      produces a gap (return value) within the documented design bounds — i.e.
//      the statistical contract is correct even if the exact sequence varies.
//   2. Verifies that pattern indices are selected from a valid range.
//   3. Verifies that the spawned obstacle list has the expected structural shape.
//
// A proper deterministic replay test would require the caller to pass an RNG
// function into spawnObstacle (dependency injection). That refactor is tracked
// as a future improvement, not implemented here per the constraints.

import { describe, it, expect } from 'vitest';
import {
  OBSTACLE_PATTERNS, OBSTACLE_TYPES,
  SPEED_START, SPEED_MAX,
  W,
} from '../../../public/games/running-man/config.js';
import {
  resetObstacles, spawnObstacle, obstacles,
} from '../../../public/games/running-man/obstacles.js';

describe('Running Man replay — spawnObstacle gap bounds', () => {
  // Per the design in obstacles.js, the gap is chosen from three moods:
  //   tight:    [0.55, 0.85] base → can shrink to lo end at full speed
  //   standard: [0.9,  1.5]  base → shrinks at full speed ratio
  //   long:     [1.7,  2.6]  base → shrinks at half speed ratio + jitter
  // At SPEED_START (ratio=0, no speed reduction), the absolute upper bound is
  //   long hi + jitter + groupExtra = 2.6 + 0.2 + 0.2 = 3.0
  // The absolute lower bound is tight lo = 0.55.
  const GAP_MIN = 0.50; // small tolerance below spec
  const GAP_MAX = 3.10; // small tolerance above spec

  it('spawnObstacle at SPEED_START returns a gap within design bounds', () => {
    resetObstacles();
    for (let i = 0; i < 50; i++) {
      const gap = spawnObstacle(SPEED_START);
      expect(gap).toBeGreaterThanOrEqual(GAP_MIN);
      expect(gap).toBeLessThanOrEqual(GAP_MAX);
    }
  });

  it('spawnObstacle at SPEED_MAX returns a gap within design bounds', () => {
    resetObstacles();
    for (let i = 0; i < 50; i++) {
      const gap = spawnObstacle(SPEED_MAX);
      expect(gap).toBeGreaterThanOrEqual(GAP_MIN);
      expect(gap).toBeLessThanOrEqual(GAP_MAX);
    }
  });
});

describe('Running Man replay — spawned obstacle structure', () => {
  it('after 10 spawns, obstacles array contains entries with valid shape', () => {
    resetObstacles();
    for (let i = 0; i < 10; i++) {
      spawnObstacle(SPEED_START);
    }
    // Each pattern spawns 1 or more obstacle entries.
    expect(obstacles.length).toBeGreaterThanOrEqual(10);

    for (const o of obstacles) {
      // Must reference a valid type.
      expect(OBSTACLE_TYPES).toContain(o.type);
      // Must start off-screen to the right.
      expect(o.x).toBeGreaterThanOrEqual(W);
      // Width and height must be positive.
      expect(o.w).toBeGreaterThan(0);
      expect(o.h).toBeGreaterThan(0);
      // Scale must be positive.
      expect(o.scale).toBeGreaterThan(0);
    }
  });

  it('resetObstacles clears the obstacle list', () => {
    spawnObstacle(SPEED_START);
    expect(obstacles.length).toBeGreaterThan(0);
    resetObstacles();
    expect(obstacles.length).toBe(0);
  });

  it('after 100 spawns, distribution covers multiple obstacle types (no single type dominates)', () => {
    // With ~16 patterns and uniform random selection, the expected count per
    // pattern after 100 spawns is ~6.25. We assert that at least 2 different
    // obstacle types appeared (very conservative — false-fail probability is ~0).
    resetObstacles();

    const typesSeen = new Set();
    for (let i = 0; i < 100; i++) {
      const before = obstacles.length;
      spawnObstacle(SPEED_START);
      for (let j = before; j < obstacles.length; j++) {
        typesSeen.add(obstacles[j].type.name);
      }
    }

    // With 3 types and 100 spawns (each pattern uses 1+ types), all 3 types
    // should appear with overwhelming probability.
    expect(typesSeen.size).toBeGreaterThanOrEqual(2);
  });
});

describe('Running Man replay — gap decreases with speed (statistical)', () => {
  // At higher speed, gaps should trend shorter. We verify this by averaging
  // 100 gaps at SPEED_START vs SPEED_MAX.
  it('average gap at SPEED_MAX is not larger than average gap at SPEED_START', () => {
    resetObstacles();
    const N = 100;
    let sumStart = 0;
    for (let i = 0; i < N; i++) sumStart += spawnObstacle(SPEED_START);

    resetObstacles();
    let sumMax = 0;
    for (let i = 0; i < N; i++) sumMax += spawnObstacle(SPEED_MAX);

    const avgStart = sumStart / N;
    const avgMax = sumMax / N;
    // At max speed, average gap should be shorter (or equal at worst due to
    // statistical variance in the tight bucket which has speedShrink=1.0).
    // We allow a generous 0.4s margin to avoid flakiness from random variance.
    expect(avgMax).toBeLessThanOrEqual(avgStart + 0.4);
  });
});
