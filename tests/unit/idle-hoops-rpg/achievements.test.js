import { describe, it, expect } from 'vitest';
import {
  ACHIEVEMENTS,
  evaluate,
  achievementMultipliers,
} from '../../../public/games/idle-hoops-rpg/achievements.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshState(overrides = {}) {
  return {
    team: { name: 'Test', money: 500_000, fans: 5_000, rings: 0, seasonsPlayed: 0 },
    roster: [],
    season: { day: 0, wins: 0, losses: 0, schedule: [], phase: 'regular', playoff: null },
    career: { totalWins: 0, totalLosses: 0 },
    achievements: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ACHIEVEMENTS array
// ---------------------------------------------------------------------------

describe('ACHIEVEMENTS array', () => {
  const EXPECTED_IDS = [
    'first_win', 'first_ring', 'dynasty_5', 'wins_10', 'wins_100', 'wins_500',
    'playoff_bound', 'filthy_rich', 'sellout_crowd', 'veteran_squad', 'hall_of_fame', 'long_career',
  ];

  it('contains exactly 12 entries', () => {
    expect(ACHIEVEMENTS).toHaveLength(12);
  });

  it('contains all expected IDs', () => {
    const ids = ACHIEVEMENTS.map(a => a.id);
    for (const id of EXPECTED_IDS) {
      expect(ids).toContain(id);
    }
  });

  it('every achievement has id, name, description, condition, reward', () => {
    for (const ach of ACHIEVEMENTS) {
      expect(typeof ach.id).toBe('string');
      expect(typeof ach.name).toBe('string');
      expect(typeof ach.description).toBe('string');
      expect(typeof ach.condition).toBe('function');
      expect(typeof ach.reward).toBe('object');
    }
  });
});

// ---------------------------------------------------------------------------
// evaluate
// ---------------------------------------------------------------------------

describe('evaluate(state)', () => {
  it('returns empty array for a fresh state (no unlocks)', () => {
    const state = freshState();
    const unlocked = evaluate(state);
    expect(unlocked).toHaveLength(0);
    expect(state.achievements).toHaveLength(0);
  });

  it('unlocks first_win when career.totalWins >= 1', () => {
    const state = freshState({ career: { totalWins: 1, totalLosses: 0 } });
    const unlocked = evaluate(state);
    expect(unlocked).toContain('first_win');
    expect(state.achievements).toContain('first_win');
  });

  it('calling evaluate twice produces empty array the second time (no double-fire)', () => {
    const state = freshState({ career: { totalWins: 1, totalLosses: 0 } });
    evaluate(state); // first call — unlocks first_win
    const second = evaluate(state);
    expect(second).toHaveLength(0);
  });

  it('unlocks both first_ring and dynasty_5 in one call when rings=5', () => {
    const state = freshState({ team: { name: 'T', money: 0, fans: 0, rings: 5, seasonsPlayed: 0 } });
    const unlocked = evaluate(state);
    expect(unlocked).toContain('first_ring');
    expect(unlocked).toContain('dynasty_5');
  });

  it('mutates state.achievements in place', () => {
    const state = freshState({ career: { totalWins: 10, totalLosses: 5 } });
    evaluate(state);
    expect(state.achievements).toContain('first_win');
    expect(state.achievements).toContain('wins_10');
  });

  it('unlocks wins_10 when career.totalWins >= 10', () => {
    const state = freshState({ career: { totalWins: 10, totalLosses: 0 } });
    const unlocked = evaluate(state);
    expect(unlocked).toContain('wins_10');
  });

  it('unlocks filthy_rich when money >= 5_000_000', () => {
    const state = freshState({ team: { name: 'T', money: 5_000_000, fans: 0, rings: 0, seasonsPlayed: 0 } });
    const unlocked = evaluate(state);
    expect(unlocked).toContain('filthy_rich');
  });

  it('unlocks playoff_bound when season.phase is playoffs', () => {
    const state = freshState({
      season: { day: 82, wins: 42, losses: 40, schedule: [], phase: 'playoffs', playoff: null },
    });
    const unlocked = evaluate(state);
    expect(unlocked).toContain('playoff_bound');
  });

  it('unlocks sellout_crowd when fans >= 500_000', () => {
    const state = freshState({
      team: { name: 'T', money: 0, fans: 500_000, rings: 0, seasonsPlayed: 0 },
    });
    const unlocked = evaluate(state);
    expect(unlocked).toContain('sellout_crowd');
  });

  it('unlocks long_career when seasonsPlayed >= 5', () => {
    const state = freshState({
      team: { name: 'T', money: 0, fans: 0, rings: 0, seasonsPlayed: 5 },
    });
    const unlocked = evaluate(state);
    expect(unlocked).toContain('long_career');
  });

  it('unlocks veteran_squad when avg roster level >= 10', () => {
    const state = freshState({
      roster: [
        { level: 10, stats: {} }, { level: 10, stats: {} }, { level: 10, stats: {} },
        { level: 10, stats: {} }, { level: 10, stats: {} }, { level: 10, stats: {} },
        { level: 10, stats: {} }, { level: 10, stats: {} },
      ],
    });
    const unlocked = evaluate(state);
    expect(unlocked).toContain('veteran_squad');
  });

  it('unlocks hall_of_fame when any player reaches level >= 30', () => {
    const state = freshState({
      roster: [
        { level: 30, stats: {} }, { level: 5, stats: {} },
      ],
    });
    const unlocked = evaluate(state);
    expect(unlocked).toContain('hall_of_fame');
  });

  it('initializes state.achievements if it is missing', () => {
    const state = freshState();
    delete state.achievements;
    evaluate(state);
    expect(Array.isArray(state.achievements)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// achievementMultipliers
// ---------------------------------------------------------------------------

describe('achievementMultipliers(state)', () => {
  it('returns { money: 0, xp: 0 } for no unlocked achievements', () => {
    const state = freshState();
    const m = achievementMultipliers(state);
    expect(m.money).toBe(0);
    expect(m.xp).toBe(0);
  });

  it('returns { money: 0.05, xp: 0 } when only first_win is unlocked', () => {
    const state = freshState({ achievements: ['first_win'] });
    const m = achievementMultipliers(state);
    expect(m.money).toBeCloseTo(0.05);
    expect(m.xp).toBe(0);
  });

  it('stacks additively: first_win + wins_10 -> { money: 0.05, xp: 0.05 }', () => {
    const state = freshState({ achievements: ['first_win', 'wins_10'] });
    const m = achievementMultipliers(state);
    expect(m.money).toBeCloseTo(0.05);
    expect(m.xp).toBeCloseTo(0.05);
  });

  it('first_ring gives { money: 0.10, xp: 0.10 }', () => {
    const state = freshState({ achievements: ['first_ring'] });
    const m = achievementMultipliers(state);
    expect(m.money).toBeCloseTo(0.10);
    expect(m.xp).toBeCloseTo(0.10);
  });

  it('dynasty_5 gives { money: 0.25, xp: 0.25 }', () => {
    const state = freshState({ achievements: ['dynasty_5'] });
    const m = achievementMultipliers(state);
    expect(m.money).toBeCloseTo(0.25);
    expect(m.xp).toBeCloseTo(0.25);
  });

  it('all achievements combined sum correctly', () => {
    const allIds = ACHIEVEMENTS.map(a => a.id);
    const state = freshState({ achievements: allIds });
    const m = achievementMultipliers(state);
    // money: first_win(0.05) + first_ring(0.10) + dynasty_5(0.25) +
    //        playoff_bound(0.10) + filthy_rich(0.05) + sellout_crowd(0.10) + long_career(0.05)
    const expectedMoney = 0.05 + 0.10 + 0.25 + 0.10 + 0.05 + 0.10 + 0.05;
    // xp: first_ring(0.10) + dynasty_5(0.25) + wins_10(0.05) + wins_100(0.10) +
    //     wins_500(0.20) + veteran_squad(0.05) + hall_of_fame(0.05) + long_career(0.05)
    const expectedXp = 0.10 + 0.25 + 0.05 + 0.10 + 0.20 + 0.05 + 0.05 + 0.05;
    expect(m.money).toBeCloseTo(expectedMoney, 5);
    expect(m.xp).toBeCloseTo(expectedXp, 5);
  });

  it('handles missing state.achievements gracefully (treats as empty)', () => {
    const state = freshState();
    delete state.achievements;
    const m = achievementMultipliers(state);
    expect(m.money).toBe(0);
    expect(m.xp).toBe(0);
  });
});
