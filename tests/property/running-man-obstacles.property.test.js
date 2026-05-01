// Property tests: obstacle pattern invariants.
//
// Invariants under test:
//   1. Every pattern's pieces have dx values that keep the group spread
//      within reasonable horizontal bounds (the group finishes scrolling
//      within one canvas width of its spawn point).
//   2. Every OBSTACLE_TYPES entry has hit rect dimensions that are always
//      positive after scaling — even at the extreme scale values seen in
//      OBSTACLE_PATTERNS (min ~0.6, max ~1.3).
//   3. AABB collision is commutative: aabb(a, b) === aabb(b, a).
//   4. AABB collision is reflexive: aabb(a, a) is always true for non-zero rects.

import { describe, it } from 'vitest';
import fc from 'fast-check';
import { aabb } from '../../../public/games/running-man/obstacles.js';
import {
  OBSTACLE_TYPES, OBSTACLE_PATTERNS, W,
} from '../../../public/games/running-man/config.js';

// ---------------------------------------------------------------------------
// Pattern structural invariants
// ---------------------------------------------------------------------------

describe('Running Man obstacles — pattern dx bounds', () => {
  it('every pattern piece has a dx that keeps the group within 1 canvas width of spawn', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...OBSTACLE_PATTERNS),
        (pattern) => {
          const groupX = W + 8; // mirrors spawnObstacle's groupX
          for (const piece of pattern) {
            const pieceX = groupX + (piece.dx ?? 0);
            // The piece must not start more than 2 canvas widths off screen
            // — that would mean it takes 2 full traversals to appear, which
            // is never the intent for any current pattern.
            if (pieceX > groupX + W) return false;
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Running Man obstacles — scaled hit rect dimensions', () => {
  // Collect all scale values that appear in OBSTACLE_PATTERNS.
  const scaleValues = [];
  for (const pattern of OBSTACLE_PATTERNS) {
    for (const piece of pattern) {
      scaleValues.push(piece.scale ?? 1);
    }
  }
  const minScale = Math.min(...scaleValues);
  const maxScale = Math.max(...scaleValues);

  it('scaled hit rect width is always positive for any type at any observed scale', () => {
    // fc.float requires 32-bit float boundaries (Math.fround).
    fc.assert(
      fc.property(
        fc.constantFrom(...OBSTACLE_TYPES),
        fc.float({ min: Math.fround(minScale - 0.05), max: Math.fround(maxScale + 0.05), noNaN: true }),
        (type, scale) => {
          const w = Math.round(type.hit.w * scale);
          // Rounding may occasionally give 0 at very small scales, but no
          // pattern uses scale < 0.6, so at minScale 0.6 the smallest hit.w
          // (24px for crack) gives Math.round(24*0.6) = Math.round(14.4) = 14.
          return w > 0;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('scaled hit rect height is always positive for any type at any observed scale', () => {
    // fc.float requires 32-bit float boundaries (Math.fround).
    fc.assert(
      fc.property(
        fc.constantFrom(...OBSTACLE_TYPES),
        fc.float({ min: Math.fround(minScale - 0.05), max: Math.fround(maxScale + 0.05), noNaN: true }),
        (type, scale) => {
          const h = Math.round(type.hit.h * scale);
          return h > 0;
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// AABB algebraic properties
// ---------------------------------------------------------------------------

// Arbitrary for a rect with positive width and height.
const rectArb = fc.record({
  x: fc.integer({ min: -500, max: 1000 }),
  y: fc.integer({ min: -200, max: 500 }),
  w: fc.integer({ min: 1, max: 200 }),
  h: fc.integer({ min: 1, max: 200 }),
});

describe('Running Man AABB — commutativity', () => {
  it('aabb(a, b) === aabb(b, a) for any two rects', () => {
    fc.assert(
      fc.property(rectArb, rectArb, (a, b) => {
        return aabb(a, b) === aabb(b, a);
      }),
      { numRuns: 200 },
    );
  });
});

describe('Running Man AABB — reflexivity', () => {
  it('aabb(a, a) is always true for any non-zero rect', () => {
    fc.assert(
      fc.property(rectArb, (a) => {
        return aabb(a, a) === true;
      }),
      { numRuns: 200 },
    );
  });
});

describe('Running Man AABB — separation invariant', () => {
  it('rects separated by more than their combined widths never overlap', () => {
    fc.assert(
      fc.property(
        rectArb,
        rectArb,
        fc.integer({ min: 1, max: 500 }),
        (a, b, gap) => {
          // Place b entirely to the right of a with a gap.
          const bShifted = { ...b, x: a.x + a.w + gap };
          return aabb(a, bShifted) === false;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('rects separated by more than their combined heights never overlap', () => {
    fc.assert(
      fc.property(
        rectArb,
        rectArb,
        fc.integer({ min: 1, max: 500 }),
        (a, b, gap) => {
          // Place b entirely below a with a gap.
          const bShifted = { ...b, y: a.y + a.h + gap };
          return aabb(a, bShifted) === false;
        },
      ),
      { numRuns: 200 },
    );
  });
});
