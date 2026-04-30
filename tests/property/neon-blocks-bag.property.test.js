// Property tests: 7-bag distribution invariants.
//
// Invariant 1: any 7 consecutive pieces from a fresh bag is a permutation of
//   [I, O, T, S, Z, J, L] — each piece type appears exactly once.
//
// Invariant 2: pulling 14 pieces from a fresh bag gives exactly 2 of each type.

import { describe, it } from 'vitest';
import fc from 'fast-check';
import { Bag } from '../../public/games/neon-blocks/bag.js';
import { P_I, P_O, P_T, P_S, P_Z, P_J, P_L } from '../../public/games/neon-blocks/config.js';

const ALL_TYPES = [P_I, P_O, P_T, P_S, P_Z, P_J, P_L];

describe('Neon Blocks — bag distribution invariants', () => {
  it('for any seed, pulling 7 pieces yields a permutation of the 7 piece types', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 16 }),
        (seed) => {
          const bag = new Bag(seed);
          const pulled = Array.from({ length: 7 }, () => bag.next());
          // Every type appears exactly once.
          for (const type of ALL_TYPES) {
            if (pulled.filter(p => p === type).length !== 1) return false;
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('for any seed, pulling 14 pieces yields exactly 2 of each piece type', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 16 }),
        (seed) => {
          const bag = new Bag(seed);
          const pulled = Array.from({ length: 14 }, () => bag.next());
          for (const type of ALL_TYPES) {
            if (pulled.filter(p => p === type).length !== 2) return false;
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });
});
