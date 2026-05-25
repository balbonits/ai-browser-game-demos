// Property test: endlessMultipliers invariants.
//
// Invariants:
//   1. For any wave index, endlessMultipliers(idx).hp >= 1.
//   2. For any wave index, endlessMultipliers(idx).count >= 1.
//   3. Past TOTAL_WAVES, multipliers strictly increase with idx.

import { describe, it } from 'vitest';
import fc from 'fast-check';
import { endlessMultipliers, TOTAL_WAVES } from '../../public/games/block-fps/config.js';

describe('block-fps — endlessMultipliers invariants', () => {
  it('hp multiplier is always >= 1 for any wave index', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        (idx) => {
          return endlessMultipliers(idx).hp >= 1;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('count multiplier is always >= 1 for any wave index', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        (idx) => {
          return endlessMultipliers(idx).count >= 1;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('hp multiplier strictly increases for consecutive endless-wave indices', () => {
    fc.assert(
      fc.property(
        // Pick an index in endless territory (past TOTAL_WAVES).
        fc.integer({ min: TOTAL_WAVES + 1, max: 100 }),
        (idx) => {
          const a = endlessMultipliers(idx).hp;
          const b = endlessMultipliers(idx + 1).hp;
          return b > a;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('count multiplier strictly increases for consecutive endless-wave indices', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: TOTAL_WAVES + 1, max: 100 }),
        (idx) => {
          const a = endlessMultipliers(idx).count;
          const b = endlessMultipliers(idx + 1).count;
          return b > a;
        },
      ),
      { numRuns: 200 },
    );
  });
});
