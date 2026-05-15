// Replay test: fixed seed + N ticks = fixed final state.
//
// Snapshot captured for v0.2 schema (date 2026-05-15).
// v0.1 baseline (wins=13, losses=15, money=4941263, roster[0].xp=1150, hash=4cbe8af0)
// is preserved in git history at commit fd6aaea.
//
// v0.2 snapshot (seed='alpha', 200 ticks, v2 state with career/upgrades/achievements):
//   wins=11, losses=17, money=5167769, roster[0].xp=1955, saveHash=32be850a
//
// When a replay test breaks unexpectedly, it means game behavior changed.
// Update the snapshot only when the spec intentionally changes.

import { describe, it, expect } from 'vitest';
import { makeRng } from '../../public/games/idle-hoops-rpg/rng.js';
import { generateRoster } from '../../public/games/idle-hoops-rpg/roster.js';
import { freshSeason } from '../../public/games/idle-hoops-rpg/season.js';
import { runTick } from '../../public/games/idle-hoops-rpg/sim.js';
import { encodeSave } from '../../public/games/idle-hoops-rpg/save.js';
import { defaultUpgrades } from '../../public/games/idle-hoops-rpg/upgrades.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function runReplay(seedStr, ticks) {
  const state = makeState(seedStr);
  for (let i = 0; i < ticks; i++) {
    const rng = makeRng(state.seed, state.rngCursor);
    runTick(state, rng);
    state.rngCursor = rng.cursor;
  }
  return state;
}

function saveHash(state) {
  const ss = encodeSave(state);
  return ss.slice(0, 8); // 8-char hex hash prefix
}

// ---------------------------------------------------------------------------
// Replay tests
// ---------------------------------------------------------------------------

describe('Idle Hoops RPG replay', () => {
  it("seed='alpha' + 200 ticks produces the expected v0.2 snapshot", () => {
    const state = runReplay('alpha', 200);

    // Snapshot captured for v0.2 schema — locked in.
    expect(state.season.wins).toBe(11);
    expect(state.season.losses).toBe(17);
    expect(state.team.money).toBe(5167769);
    expect(state.roster[0].xp).toBe(1955);
    expect(saveHash(state)).toBe('32be850a');
  });

  it("seed='alpha' + 200 ticks is deterministic (same result twice)", () => {
    const state1 = runReplay('alpha', 200);
    const state2 = runReplay('alpha', 200);
    expect(saveHash(state1)).toBe(saveHash(state2));
  });

  it("seed='beta' + 200 ticks produces a different state than 'alpha'", () => {
    const alpha = runReplay('alpha', 200);
    const beta  = runReplay('beta',  200);
    expect(saveHash(alpha)).not.toBe(saveHash(beta));
  });

  it('seasons progress correctly over 200 ticks (no negative money, sane record)', () => {
    const state = runReplay('alpha', 200);
    expect(state.team.money).toBeGreaterThanOrEqual(0);
    expect(state.season.wins + state.season.losses).toBeLessThanOrEqual(82);
    expect(state.roster).toHaveLength(8);
  });

  it("seed='alpha' + 200 ticks: state.achievements contains at least 'first_win'", () => {
    const state = runReplay('alpha', 200);
    expect(state.achievements).toContain('first_win');
  });

  it("seed='alpha' + 200 ticks: career.totalWins >= season.wins (career is a superset)", () => {
    const state = runReplay('alpha', 200);
    expect(state.career.totalWins).toBeGreaterThanOrEqual(state.season.wins);
  });
});
