// Property test: game invariants hold over any seed and tick count up to 200.
//
// Invariants:
//   - money >= 0
//   - wins + losses <= 82 (within a single regular season)
//   - roster.length === 8
//   - no player level > 99
//   - career.totalWins >= season.wins (career is superset of current season)
//   - upgrade levels stay in [0, MAX_UPGRADE_LEVEL]
//   - achievements only ever grow (monotonically)
//   - money never goes negative after applyPurchase attempts

import { describe, it } from 'vitest';
import fc from 'fast-check';
import { makeRng } from '../../public/games/idle-hoops-rpg/rng.js';
import { generateRoster } from '../../public/games/idle-hoops-rpg/roster.js';
import { freshSeason } from '../../public/games/idle-hoops-rpg/season.js';
import { runTick } from '../../public/games/idle-hoops-rpg/sim.js';
import { applyPurchase, defaultUpgrades, MAX_UPGRADE_LEVEL } from '../../public/games/idle-hoops-rpg/upgrades.js';

const UPGRADE_IDS = ['trainingFacility', 'scouting', 'gymEquipment', 'medicalStaff', 'marketing'];

function makeState(seedStr) {
  const rng = makeRng(seedStr, 0);
  const roster = generateRoster(rng);
  return {
    v: 2,
    seed: seedStr,
    rngCursor: rng.cursor,
    lastTickAt: 0,
    team: { name: 'Test Team', money: 1_000_000, fans: 10_000, rings: 0, seasonsPlayed: 0 },
    roster,
    season: freshSeason(),
    career: { totalWins: 0, totalLosses: 0 },
    upgrades: defaultUpgrades(),
    achievements: [],
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

  // ---------------------------------------------------------------------------
  // v0.2 invariants
  // ---------------------------------------------------------------------------

  it('career.totalWins >= season.wins after any number of ticks', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 16 }),
        fc.integer({ min: 1, max: 200 }),
        (seed, ticks) => {
          const state = makeState(seed);
          runTicks(state, ticks);
          return state.career.totalWins >= state.season.wins;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('upgrade levels stay in [0, MAX_UPGRADE_LEVEL] after any applyPurchase sequence', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 16 }),
        fc.array(
          fc.constantFrom(...UPGRADE_IDS),
          { minLength: 0, maxLength: 30 },
        ),
        fc.integer({ min: 0, max: 50_000_000 }),
        (seed, purchaseIds, money) => {
          const state = makeState(seed);
          state.team.money = money;
          for (const id of purchaseIds) {
            applyPurchase(state, id);
          }
          return UPGRADE_IDS.every(id => {
            const lvl = state.upgrades[id];
            return lvl >= 0 && lvl <= MAX_UPGRADE_LEVEL;
          });
        },
      ),
      { numRuns: 200 },
    );
  });

  it('team.money >= 0 after any sequence of applyPurchase attempts', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 16 }),
        fc.array(
          fc.constantFrom(...UPGRADE_IDS),
          { minLength: 0, maxLength: 30 },
        ),
        fc.integer({ min: 0, max: 50_000_000 }),
        (seed, purchaseIds, money) => {
          const state = makeState(seed);
          state.team.money = money;
          for (const id of purchaseIds) {
            applyPurchase(state, id);
          }
          return state.team.money >= 0;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('achievements are monotonically growing (once unlocked, stays unlocked)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 16 }),
        fc.integer({ min: 1, max: 200 }),
        (seed, ticks) => {
          const state = makeState(seed);
          const snapshots = [];

          // Record achievement set after each tick.
          for (let i = 0; i < ticks; i++) {
            const rng = makeRng(state.seed, state.rngCursor);
            runTick(state, rng);
            state.rngCursor = rng.cursor;
            snapshots.push(new Set(state.achievements));
          }

          // Each snapshot must be a superset of the previous.
          for (let i = 1; i < snapshots.length; i++) {
            for (const id of snapshots[i - 1]) {
              if (!snapshots[i].has(id)) return false;
            }
          }
          return true;
        },
      ),
      { numRuns: 50 }, // fewer runs because each run tracks all ticks
    );
  });
});
