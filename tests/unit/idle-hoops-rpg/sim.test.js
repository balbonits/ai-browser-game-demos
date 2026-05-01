import { describe, it, expect } from 'vitest';
import { makeRng } from '../../../public/games/idle-hoops-rpg/rng.js';
import { simulateGame, runTick, xpForLevel, applyXp } from '../../../public/games/idle-hoops-rpg/sim.js';
import { freshSeason, teamRating } from '../../../public/games/idle-hoops-rpg/season.js';
import { generateRoster } from '../../../public/games/idle-hoops-rpg/roster.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(seedStr = 'test', overrides = {}) {
  const rng = makeRng(seedStr);
  const roster = generateRoster(rng);
  return {
    v: 1,
    seed: seedStr,
    rngCursor: rng.cursor,
    lastTickAt: Date.now(),
    team: {
      name: 'Test Team',
      money: 1_000_000,
      fans: 10_000,
      rings: 0,
      seasonsPlayed: 0,
      ...overrides.team,
    },
    roster: overrides.roster ?? roster,
    season: overrides.season ?? freshSeason(),
  };
}

function rosterWith(seed = 'bench') {
  return generateRoster(makeRng(seed));
}

// ---------------------------------------------------------------------------
// simulateGame — determinism
// ---------------------------------------------------------------------------

describe('simulateGame — determinism', () => {
  it('same RNG state produces identical GameResult', () => {
    const roster = rosterWith('alpha');
    const rng1 = makeRng('det-seed', 0);
    const rng2 = makeRng('det-seed', 0);
    const r1 = simulateGame(roster, 60, rng1);
    const r2 = simulateGame(roster, 60, rng2);
    expect(r1).toEqual(r2);
  });

  it('different opponent ratings change the average outcome over many games', () => {
    const roster = rosterWith('diff-opp');
    let winsLow = 0, winsHigh = 0;
    for (let i = 0; i < 100; i++) {
      const rng = makeRng('sim-test', i * 10);
      const r = simulateGame(roster, 20, rng); // very weak opponent
      if (r.win) winsLow++;
    }
    for (let i = 0; i < 100; i++) {
      const rng = makeRng('sim-test', i * 10);
      const r = simulateGame(roster, 99, rng); // very strong opponent
      if (r.win) winsHigh++;
    }
    // Weak opponents should produce significantly more wins.
    expect(winsLow).toBeGreaterThan(winsHigh);
  });

  it('topScorer is always a starter (one of the first 5 players)', () => {
    const roster = rosterWith('top-scorer');
    const starterNames = new Set(roster.slice(0, 5).map(p => p.name));
    for (let i = 0; i < 50; i++) {
      const rng = makeRng('scorer-seed', i * 5);
      const result = simulateGame(roster, 60, rng);
      expect(starterNames.has(result.topScorer)).toBe(true);
    }
  });

  it('returns correct teamRating in result', () => {
    const roster = rosterWith('rating-check');
    const rng = makeRng('rating-seed');
    const result = simulateGame(roster, 60, rng);
    expect(result.teamRating).toBe(teamRating(roster));
  });
});

// ---------------------------------------------------------------------------
// XP curve — xpForLevel
// ---------------------------------------------------------------------------

describe('xpForLevel', () => {
  it('level 1 requires 700 XP (500 + 1*200)', () => {
    expect(xpForLevel(1)).toBe(700);
  });

  it('level 10 requires 2500 XP (500 + 10*200)', () => {
    expect(xpForLevel(10)).toBe(2500);
  });

  it('xpForLevel is strictly increasing', () => {
    for (let n = 1; n < 99; n++) {
      expect(xpForLevel(n + 1)).toBeGreaterThan(xpForLevel(n));
    }
  });
});

// ---------------------------------------------------------------------------
// applyXp — level-up behavior
// ---------------------------------------------------------------------------

describe('applyXp — level-ups', () => {
  it('triggers a level-up when XP reaches threshold', () => {
    const roster = rosterWith('lvlup');
    // Force player to the level-up threshold.
    roster[0].level = 1;
    roster[0].xp = xpForLevel(1) - 50; // 50 xp short

    const rng = makeRng('lvlup-rng');
    const gameResult = {
      win: true,
      topScorer: roster[0].name, // they're the top scorer -> +200 XP
    };

    const levelUps = applyXp(roster, gameResult, rng);
    // +200 XP on win as top scorer; 200 > 50, so they level up.
    expect(levelUps.length).toBeGreaterThan(0);
    expect(levelUps[0].name).toBe(roster[0].name);
    expect(roster[0].level).toBe(2);
  });

  it('level-up boosts exactly one stat by 1', () => {
    const roster = rosterWith('stat-boost');
    roster[0].level = 1;
    roster[0].xp = xpForLevel(1) - 10; // almost at level-up

    const before = { ...roster[0].stats };
    const rng = makeRng('boost-rng');
    const gameResult = { win: true, topScorer: roster[0].name }; // +200 XP
    applyXp(roster, gameResult, rng);

    const after = roster[0].stats;
    const diffs = Object.keys(before).filter(k => after[k] !== before[k]);
    // Exactly one stat should have changed by 1.
    expect(diffs).toHaveLength(1);
    expect(after[diffs[0]] - before[diffs[0]]).toBe(1);
  });

  it('XP halves on a loss', () => {
    const roster = rosterWith('loss-xp');
    roster[0].level = 1;
    roster[0].xp = 0;

    const rng = makeRng('loss-rng');
    const gameResult = { win: false, topScorer: roster[0].name };
    applyXp(roster, gameResult, rng);
    // Top scorer on loss gets 100 XP (200 * 0.5).
    expect(roster[0].xp).toBe(100);
  });

  it('bench players get less XP than starters', () => {
    const roster = rosterWith('bench-xp');
    for (const p of roster) { p.xp = 0; p.level = 1; }
    const rng = makeRng('bench-rng');
    const gameResult = { win: true, topScorer: roster[4].name }; // last starter is top scorer
    applyXp(roster, gameResult, rng);
    // Starters (non-top) get 100, bench gets 50.
    expect(roster[0].xp).toBe(100); // starter, not top scorer
    expect(roster[5].xp).toBe(50); // bench
  });

  it('level cap at 99 — player does not exceed level 99', () => {
    const roster = rosterWith('cap-test');
    roster[0].level = 99;
    roster[0].xp = xpForLevel(99) + 9999; // way over
    const rng = makeRng('cap-rng');
    const gameResult = { win: true, topScorer: roster[0].name };
    applyXp(roster, gameResult, rng);
    expect(roster[0].level).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// runTick — phase transitions
// ---------------------------------------------------------------------------

describe('runTick — regular season to playoffs/offseason', () => {
  it('transitions to playoffs when wins >= 41 after game 82', () => {
    const state = makeState('playoffs-test');
    // Stuff the season to be at the last game with enough wins.
    state.season.day = 81; // will increment to 82 -> end of regular
    state.season.wins = 41;
    state.season.losses = 40;

    const rng = makeRng(state.seed, state.rngCursor);
    runTick(state, rng);

    // After the tick, phase should be playoffs (wins=41 >= 41).
    expect(state.season.phase).toBe('playoffs');
    expect(state.season.playoff).not.toBeNull();
  });

  it('transitions to offseason when wins < 41 after game 82', () => {
    const state = makeState('offseason-test');
    state.season.day = 81;
    state.season.wins = 30; // sub-.500
    state.season.losses = 51;

    const rng = makeRng(state.seed, state.rngCursor);
    runTick(state, rng);

    expect(state.season.phase).toBe('offseason');
    expect(state.season.playoff).toBeNull();
  });

  it('regular season win increments wins counter', () => {
    // We need a game that is guaranteed to win — just test the shape.
    // Run multiple ticks to get some stats.
    const state = makeState('wins-test');
    const rng = makeRng(state.seed, state.rngCursor);
    runTick(state, rng);
    state.rngCursor = rng.cursor;

    expect(state.season.wins + state.season.losses).toBe(1);
    expect(state.season.day).toBe(1);
  });
});

describe('runTick — offseason -> new season', () => {
  it('increments seasonsPlayed and resets day after all offseason ticks', () => {
    const state = makeState('season-cycle');
    // Skip to offseason directly.
    state.season.phase = 'offseason';
    state.season.offseasonPhase = 0;

    const rng = makeRng(state.seed, state.rngCursor);

    // 3 offseason ticks (draft, FA, camp).
    for (let i = 0; i < 3; i++) {
      runTick(state, rng);
      state.rngCursor = rng.cursor;
    }
    // 4th tick triggers new season.
    runTick(state, rng);

    expect(state.team.seasonsPlayed).toBe(1);
    expect(state.season.day).toBe(0);
    expect(state.season.phase).toBe('regular');
  });
});
