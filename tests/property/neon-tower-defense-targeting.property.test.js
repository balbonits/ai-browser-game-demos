// Property tests — targeting invariants for Neon Tower Defense.
//
// Invariant: for any tower position and any set of enemy positions,
//   findFirstInRange() returns null OR an enemy whose Euclidean distance
//   from the tower center is <= range.
//
// Also verifies: findInAoe() returns only enemies within the given radius.

import { describe, it } from 'vitest';
import fc from 'fast-check';
import {
  enemies, spawnEnemy, resetEnemies,
} from '../../public/games/neon-tower-defense/enemies.js';
import {
  findFirstInRange, findInAoe,
} from '../../public/games/neon-tower-defense/enemies.js';
import { resetTowers } from '../../public/games/neon-tower-defense/towers.js';
import { resetProjectiles } from '../../public/games/neon-tower-defense/projectiles.js';
import { TOWERS } from '../../public/games/neon-tower-defense/config.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetAll() {
  resetTowers();
  resetEnemies();
  resetProjectiles();
}

// Place N square enemies at explicit (x, y) positions by manipulating
// the enemy object directly (progress drives normal movement; we bypass
// that for a headless targeting test).
function placeEnemies(positions) {
  resetEnemies();
  const placed = [];
  for (const { x, y } of positions) {
    const e = spawnEnemy('square');
    e.x = x;
    e.y = y;
    placed.push(e);
  }
  return placed;
}

// ---------------------------------------------------------------------------
// Property 1: findFirstInRange returns null or an in-range enemy
// ---------------------------------------------------------------------------

describe('Neon TD — findFirstInRange invariant', () => {
  it('findFirstInRange returns null or an enemy within the given range', () => {
    fc.assert(
      fc.property(
        // Tower center position (anywhere in the canvas).
        fc.record({
          cx: fc.integer({ min: 0, max: 480 }),
          cy: fc.integer({ min: 0, max: 270 }),
        }),
        // Tower range: 40–200 (covers all real tower ranges).
        fc.integer({ min: 40, max: 200 }),
        // Enemy positions: 0–6 enemies at arbitrary canvas positions.
        fc.array(
          fc.record({
            x: fc.integer({ min: -30, max: 520 }),
            y: fc.integer({ min: 0, max: 280 }),
          }),
          { minLength: 0, maxLength: 6 },
        ),
        ({ cx, cy }, range, positions) => {
          resetAll();
          placeEnemies(positions);

          const result = findFirstInRange(cx, cy, range);

          if (result === null) return true; // null is always valid

          // Result must be an enemy within range.
          const dx = result.x - cx;
          const dy = result.y - cy;
          const dist = Math.hypot(dx, dy);
          return dist <= range + 0.001; // +0.001 for floating-point tolerance
        },
      ),
      { numRuns: 200, seed: 42 },
    );
  });

  it('findFirstInRange never returns a dead or leaked enemy', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 480 }),
        fc.integer({ min: 0, max: 270 }),
        fc.integer({ min: 40, max: 200 }),
        fc.array(
          fc.record({
            x: fc.integer({ min: 0, max: 480 }),
            y: fc.integer({ min: 0, max: 270 }),
            isDead: fc.boolean(),
            isLeaked: fc.boolean(),
          }),
          { minLength: 1, maxLength: 6 },
        ),
        (cx, cy, range, configs) => {
          resetAll();

          for (const { x, y, isDead, isLeaked } of configs) {
            const e = spawnEnemy('square');
            e.x = x;
            e.y = y;
            e.dead = isDead;
            e.leaked = isLeaked;
          }

          const result = findFirstInRange(cx, cy, range);

          if (result === null) return true;
          // The returned enemy must not be flagged dead or leaked.
          return !result.dead && !result.leaked;
        },
      ),
      { numRuns: 200, seed: 13 },
    );
  });

  it('findFirstInRange returns the highest-progress enemy when multiple are in range', () => {
    fc.assert(
      fc.property(
        // Generate 2–4 enemy progress values and positions within range.
        fc.array(
          fc.nat({ max: 500 }),
          { minLength: 2, maxLength: 4 },
        ),
        (progressValues) => {
          resetAll();

          // Place all enemies at the exact same canvas position (inside range).
          for (const prog of progressValues) {
            const e = spawnEnemy('square');
            e.x = 100;
            e.y = 100;
            e.progress = prog;
          }

          // Tower center and range that covers (100,100).
          const result = findFirstInRange(100, 100, 50);
          if (result === null) return true;

          const maxProg = Math.max(...progressValues);
          return result.progress === maxProg;
        },
      ),
      { numRuns: 200, seed: 55 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: findInAoe returns only enemies within radius
// ---------------------------------------------------------------------------

describe('Neon TD — findInAoe invariant', () => {
  it('findInAoe returns only enemies within the given radius', () => {
    fc.assert(
      fc.property(
        fc.record({
          cx: fc.integer({ min: 0, max: 480 }),
          cy: fc.integer({ min: 0, max: 270 }),
        }),
        fc.integer({ min: 10, max: 150 }),
        fc.array(
          fc.record({
            x: fc.integer({ min: -30, max: 520 }),
            y: fc.integer({ min: 0, max: 280 }),
          }),
          { minLength: 0, maxLength: 8 },
        ),
        ({ cx, cy }, radius, positions) => {
          resetAll();
          placeEnemies(positions);

          const result = findInAoe(cx, cy, radius);

          // Every returned enemy must be within the radius.
          for (const e of result) {
            const dist = Math.hypot(e.x - cx, e.y - cy);
            if (dist > radius + 0.001) return false;
          }

          // No returned enemy should be dead or leaked.
          for (const e of result) {
            if (e.dead || e.leaked) return false;
          }

          return true;
        },
      ),
      { numRuns: 200, seed: 88 },
    );
  });

  it('findInAoe never misses an enemy that is strictly within radius', () => {
    fc.assert(
      fc.property(
        fc.record({
          cx: fc.integer({ min: 50, max: 400 }),
          cy: fc.integer({ min: 50, max: 200 }),
        }),
        fc.integer({ min: 30, max: 100 }),
        fc.array(
          fc.record({
            // Enemies placed within radius/2 — definitely inside.
            dx: fc.integer({ min: -14, max: 14 }),
            dy: fc.integer({ min: -14, max: 14 }),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        ({ cx, cy }, radius, offsets) => {
          resetAll();
          for (const { dx, dy } of offsets) {
            const e = spawnEnemy('square');
            e.x = cx + dx;
            e.y = cy + dy;
          }

          const result = findInAoe(cx, cy, radius);

          // All enemies (none dead/leaked) must appear in the result
          // since they're all within radius.
          const inRange = enemies.filter(e => {
            const d = Math.hypot(e.x - cx, e.y - cy);
            return d <= radius && !e.dead && !e.leaked;
          });

          return result.length === inRange.length;
        },
      ),
      { numRuns: 200, seed: 77 },
    );
  });
});
