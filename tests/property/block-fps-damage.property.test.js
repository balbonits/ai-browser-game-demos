// Property test: damage accumulation invariant.
//
// Invariant: for any sequence of positive damage values applied to an enemy
// starting at hp=X, the final hp equals max(0, X - sum(damages)).
//
// This ensures damageEnemy never over-subtracts, never under-subtracts,
// and always clamps to 0 (not negative).

import { describe, it } from 'vitest';
import fc from 'fast-check';
import { damageEnemy } from '../../public/games/block-fps/enemies.js';

describe('block-fps — damage accumulation invariant', () => {
  it('final hp === max(0, startHp - sum(damages)) for any sequence of damage events', () => {
    fc.assert(
      fc.property(
        // Starting HP: any positive integer up to 1000.
        fc.integer({ min: 1, max: 1000 }),
        // Sequence of positive damage amounts (1–200 each, up to 20 hits).
        fc.array(fc.integer({ min: 1, max: 200 }), { minLength: 1, maxLength: 20 }),
        (startHp, damages) => {
          const e = { hp: startHp, dead: false };
          for (const dmg of damages) {
            if (e.dead) break;  // dead enemies take no more damage
            damageEnemy(e, dmg);
          }
          const expectedHp = Math.max(0, startHp - damages.reduce((a, d) => a + d, 0));
          // hp must be clamped to 0 (never negative).
          if (e.hp < 0) return false;
          // hp must match the expected value (no under-subtracting).
          if (e.hp !== expectedHp) return false;
          // dead flag must agree with hp === 0.
          if (e.hp === 0 && !e.dead) return false;
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('hp is never negative regardless of damage magnitude', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }),
        fc.integer({ min: 1, max: 10_000 }),
        (startHp, damage) => {
          const e = { hp: startHp, dead: false };
          damageEnemy(e, damage);
          return e.hp >= 0;
        },
      ),
      { numRuns: 200 },
    );
  });
});
