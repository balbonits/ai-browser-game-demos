// Replay test: fixed seed + N ticks = fixed final state.
//
// Snapshot values were captured on first green run (2026-05-01) from seed 'alpha', 200 ticks:
//   wins=13, losses=15, money=4941263, roster[0].xp=1150, saveHash=4cbe8af0
//
// When a replay test breaks unexpectedly, it means game behavior changed.
// Update the snapshot only when the spec intentionally changes.

import { describe, it, expect } from 'vitest';
import { makeRng } from '../../public/games/idle-hoops-rpg/rng.js';
import { generateRoster } from '../../public/games/idle-hoops-rpg/roster.js';
import { freshSeason } from '../../public/games/idle-hoops-rpg/season.js';
import { runTick } from '../../public/games/idle-hoops-rpg/sim.js';
import { encodeSave } from '../../public/games/idle-hoops-rpg/save.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  it("seed='alpha' + 200 ticks produces the expected snapshot", () => {
    const state = runReplay('alpha', 200);

    // Snapshot from first green run — locked in.
    expect(state.season.wins).toBe(13);
    expect(state.season.losses).toBe(15);
    expect(state.team.money).toBe(4941263);
    expect(state.roster[0].xp).toBe(1150);
    expect(saveHash(state)).toBe('4cbe8af0');
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
});
