// Property test: game invariants hold over any seed and tick count up to 200.
//
// Invariants:
//   - money >= 0
//   - wins + losses <= day (during regular season)
//   - roster.length === 8
//   - no player level > 99

import { describe, it } from 'vitest';
import fc from 'fast-check';
import { makeRng } from '../../public/games/idle-hoops-rpg/rng.js';
import { generateRoster } from '../../public/games/idle-hoops-rpg/roster.js';
import { freshSeason } from '../../public/games/idle-hoops-rpg/season.js';
import { runTick } from '../../public/games/idle-hoops-rpg/sim.js';

function makeState(seedStr) {
  const rng = makeRng(seedStr, 0);
  const roster = generateRoster(rng);
  return {
    v: 1,
    seed: seedStr,
    rngCursor: rng.cursor,
    lastTickAt: 0,
    team: { name: 'Test Team', money: 1_000_000, fans: 10_000, rings: 0, seasonsPlayed: 0 },
    roster,
    season: freshSeason(),
  };
}

function runTicks(state, n) {
  for (let i = 0; i < n; i++) {
    const rng = makeRng(state.seed, state.rngCursor);
    runTick(state, rng);
    state.rngCursor = rng.cursor;
  }
}

describe('Idle Hoops RPG bounds — property', () => {
  it('money is never negative after any number of ticks', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 16 }),
        fc.integer({ min: 1, max: 200 }),
        (seed, ticks) => {
          const state = makeState(seed);
          runTicks(state, ticks);
          return state.team.money >= 0;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('roster always has exactly 8 players', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 16 }),
        fc.integer({ min: 1, max: 200 }),
        (seed, ticks) => {
          const state = makeState(seed);
          runTicks(state, ticks);
          return state.roster.length === 8;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('no player ever reaches level > 99', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 16 }),
        fc.integer({ min: 1, max: 200 }),
        (seed, ticks) => {
          const state = makeState(seed);
          runTicks(state, ticks);
          return state.roster.every(p => p.level <= 99);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('wins + losses never exceeds 82 during a single regular season', () => {
    // Only check while phase is 'regular' (within season bounds).
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 16 }),
        fc.integer({ min: 1, max: 81 }), // keep within regular season
        (seed, ticks) => {
          const state = makeState(seed);
          runTicks(state, ticks);
          // Only assert if we're still in the first regular season.
          if (state.team.seasonsPlayed === 0 && state.season.phase === 'regular') {
            return state.season.wins + state.season.losses <= 82;
          }
          return true; // skip check if season ended
        },
      ),
      { numRuns: 100 },
    );
  });

  it('all player stats stay in [1, 99]', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 16 }),
        fc.integer({ min: 1, max: 200 }),
        (seed, ticks) => {
          const state = makeState(seed);
          runTicks(state, ticks);
          return state.roster.every(p =>
            Object.values(p.stats).every(v => v >= 1 && v <= 99),
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
