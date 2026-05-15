import { describe, it, expect } from 'vitest';
import { computeMultipliers } from '../../../public/games/idle-hoops-rpg/multipliers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshState(overrides = {}) {
  return {
    team: { name: 'Test', money: 500_000, fans: 5_000, rings: 0, seasonsPlayed: 0 },
    roster: [],
    season: { day: 0, wins: 0, losses: 0, schedule: [], phase: 'regular', playoff: null },
    career: { totalWins: 0, totalLosses: 0 },
    upgrades: { trainingFacility: 0, scouting: 0, gymEquipment: 0, medicalStaff: 0, marketing: 0 },
    achievements: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeMultipliers
// ---------------------------------------------------------------------------

describe('computeMultipliers(state)', () => {
  it('returns { money: 1, xp: 1 } for a fresh state with no upgrades or achievements', () => {
    const state = freshState();
    const m = computeMultipliers(state);
    expect(m.money).toBe(1);
    expect(m.xp).toBe(1);
  });

  it('marketing: 5 -> money = 1.5, xp unchanged', () => {
    const state = freshState({ upgrades: { trainingFacility: 0, scouting: 0, gymEquipment: 0, medicalStaff: 0, marketing: 5 } });
    const m = computeMultipliers(state);
    expect(m.money).toBeCloseTo(1.5);
    expect(m.xp).toBe(1);
  });

  it('trainingFacility: 10 -> xp = 2, money unchanged', () => {
    const state = freshState({ upgrades: { trainingFacility: 10, scouting: 0, gymEquipment: 0, medicalStaff: 0, marketing: 0 } });
    const m = computeMultipliers(state);
    expect(m.money).toBe(1);
    expect(m.xp).toBeCloseTo(2);
  });

  it('defensive defaults: computeMultipliers({}) returns { money: 1, xp: 1 }', () => {
    const m = computeMultipliers({});
    expect(m.money).toBe(1);
    expect(m.xp).toBe(1);
  });

  it('upgrades + achievements stack additively: marketing:1 + first_win -> money = 1.15', () => {
    // marketing:1 contributes +0.10 money; first_win contributes +0.05 money
    const state = freshState({
      upgrades: { trainingFacility: 0, scouting: 0, gymEquipment: 0, medicalStaff: 0, marketing: 1 },
      achievements: ['first_win'],
    });
    const m = computeMultipliers(state);
    expect(m.money).toBeCloseTo(1.15);
    expect(m.xp).toBe(1);
  });

  it('trainingFacility:1 + wins_10 -> xp = 1.15', () => {
    // trainingFacility:1 = +0.10 xp; wins_10 = +0.05 xp
    const state = freshState({
      upgrades: { trainingFacility: 1, scouting: 0, gymEquipment: 0, medicalStaff: 0, marketing: 0 },
      achievements: ['wins_10'],
    });
    const m = computeMultipliers(state);
    expect(m.xp).toBeCloseTo(1.15);
    expect(m.money).toBe(1);
  });

  it('all upgrades at max + all achievements produce multipliers > 1 for both', () => {
    const allIds = [
      'first_win', 'first_ring', 'dynasty_5', 'wins_10', 'wins_100', 'wins_500',
      'playoff_bound', 'filthy_rich', 'sellout_crowd', 'veteran_squad', 'hall_of_fame', 'long_career',
    ];
    const state = freshState({
      upgrades: { trainingFacility: 10, scouting: 10, gymEquipment: 10, medicalStaff: 10, marketing: 10 },
      achievements: allIds,
    });
    const m = computeMultipliers(state);
    expect(m.money).toBeGreaterThan(1);
    expect(m.xp).toBeGreaterThan(1);
  });

  it('scouting and gymEquipment upgrades do not affect money or xp multipliers', () => {
    // Only marketing affects money, only trainingFacility affects xp in multipliers.
    const state = freshState({
      upgrades: { trainingFacility: 0, scouting: 10, gymEquipment: 10, medicalStaff: 10, marketing: 0 },
    });
    const m = computeMultipliers(state);
    expect(m.money).toBe(1);
    expect(m.xp).toBe(1);
  });
});
