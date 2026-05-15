import { describe, it, expect } from 'vitest';
import {
  UPGRADES,
  MAX_UPGRADE_LEVEL,
  costFor,
  canAfford,
  applyPurchase,
  defaultUpgrades,
} from '../../../public/games/idle-hoops-rpg/upgrades.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stateWithMoney(money, upgradesOverrides = {}) {
  return {
    team: { name: 'Test', money, fans: 0, rings: 0, seasonsPlayed: 0 },
    upgrades: { ...defaultUpgrades(), ...upgradesOverrides },
  };
}

// ---------------------------------------------------------------------------
// UPGRADES array
// ---------------------------------------------------------------------------

describe('UPGRADES array', () => {
  it('contains exactly 5 entries', () => {
    expect(UPGRADES).toHaveLength(5);
  });

  it('contains the expected IDs', () => {
    const ids = UPGRADES.map(u => u.id);
    expect(ids).toContain('trainingFacility');
    expect(ids).toContain('scouting');
    expect(ids).toContain('gymEquipment');
    expect(ids).toContain('medicalStaff');
    expect(ids).toContain('marketing');
  });

  it('every upgrade has baseCost, name, description, effectText', () => {
    for (const u of UPGRADES) {
      expect(typeof u.id).toBe('string');
      expect(typeof u.baseCost).toBe('number');
      expect(u.baseCost).toBeGreaterThan(0);
      expect(typeof u.name).toBe('string');
      expect(typeof u.description).toBe('string');
      expect(typeof u.effectText).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------
// defaultUpgrades
// ---------------------------------------------------------------------------

describe('defaultUpgrades()', () => {
  it('returns an object with all 5 upgrade IDs at level 0', () => {
    const d = defaultUpgrades();
    expect(d.trainingFacility).toBe(0);
    expect(d.scouting).toBe(0);
    expect(d.gymEquipment).toBe(0);
    expect(d.medicalStaff).toBe(0);
    expect(d.marketing).toBe(0);
  });

  it('returns a new object each call (not a singleton)', () => {
    const a = defaultUpgrades();
    const b = defaultUpgrades();
    a.marketing = 5;
    expect(b.marketing).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// costFor
// ---------------------------------------------------------------------------

describe('costFor(id, level)', () => {
  it('costFor(trainingFacility, 0) equals the baseCost formula for level 0', () => {
    // formula: Math.round(baseCost * (0+1)^1.5) = baseCost * 1 = 100_000
    expect(costFor('trainingFacility', 0)).toBe(100_000);
  });

  it('costFor(marketing, 0) equals marketing baseCost (100_000)', () => {
    expect(costFor('marketing', 0)).toBe(100_000);
  });

  it('costFor(scouting, 0) equals scouting baseCost (80_000)', () => {
    expect(costFor('scouting', 0)).toBe(80_000);
  });

  it('costFor(gymEquipment, 0) equals gymEquipment baseCost (120_000)', () => {
    expect(costFor('gymEquipment', 0)).toBe(120_000);
  });

  it('costFor(medicalStaff, 0) equals medicalStaff baseCost (90_000)', () => {
    expect(costFor('medicalStaff', 0)).toBe(90_000);
  });

  it('costFor is strictly increasing in level for levels 0..9', () => {
    const id = 'trainingFacility';
    for (let lvl = 0; lvl < 9; lvl++) {
      expect(costFor(id, lvl + 1)).toBeGreaterThan(costFor(id, lvl));
    }
  });

  it('costFor(id, MAX_UPGRADE_LEVEL) returns Infinity', () => {
    expect(costFor('trainingFacility', MAX_UPGRADE_LEVEL)).toBe(Infinity);
    expect(costFor('marketing', MAX_UPGRADE_LEVEL)).toBe(Infinity);
  });

  it('costFor for an unknown id returns Infinity', () => {
    expect(costFor('nonexistent', 0)).toBe(Infinity);
  });
});

// ---------------------------------------------------------------------------
// canAfford
// ---------------------------------------------------------------------------

describe('canAfford(state, id)', () => {
  it('returns true when money >= cost', () => {
    const cost = costFor('trainingFacility', 0); // 100_000
    const state = stateWithMoney(cost);
    expect(canAfford(state, 'trainingFacility')).toBe(true);
  });

  it('returns true when money is exactly equal to cost', () => {
    const cost = costFor('marketing', 0);
    const state = stateWithMoney(cost);
    expect(canAfford(state, 'marketing')).toBe(true);
  });

  it('returns false when money < cost', () => {
    const cost = costFor('trainingFacility', 0);
    const state = stateWithMoney(cost - 1);
    expect(canAfford(state, 'trainingFacility')).toBe(false);
  });

  it('returns false when money is 0', () => {
    const state = stateWithMoney(0);
    expect(canAfford(state, 'scouting')).toBe(false);
  });

  it('accounts for current level when checking affordability', () => {
    // marketing level 5: cost = Math.round(100_000 * 6^1.5)
    const lvl5Cost = costFor('marketing', 5);
    const stateAffordable = stateWithMoney(lvl5Cost, { marketing: 5 });
    const stateNot = stateWithMoney(lvl5Cost - 1, { marketing: 5 });
    expect(canAfford(stateAffordable, 'marketing')).toBe(true);
    expect(canAfford(stateNot, 'marketing')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyPurchase
// ---------------------------------------------------------------------------

describe('applyPurchase(state, id)', () => {
  it('returns true and decrements money by exact cost when affordable', () => {
    const cost = costFor('trainingFacility', 0);
    const state = stateWithMoney(1_000_000);
    const result = applyPurchase(state, 'trainingFacility');
    expect(result).toBe(true);
    expect(state.team.money).toBe(1_000_000 - cost);
  });

  it('increments upgrade level by 1 on purchase', () => {
    const state = stateWithMoney(1_000_000);
    applyPurchase(state, 'trainingFacility');
    expect(state.upgrades.trainingFacility).toBe(1);
  });

  it('returns false and mutates nothing when money < cost', () => {
    const state = stateWithMoney(1);
    const moneyBefore = state.team.money;
    const levelBefore = state.upgrades.trainingFacility;
    const result = applyPurchase(state, 'trainingFacility');
    expect(result).toBe(false);
    expect(state.team.money).toBe(moneyBefore);
    expect(state.upgrades.trainingFacility).toBe(levelBefore);
  });

  it('returns false and mutates nothing when already at MAX_UPGRADE_LEVEL', () => {
    const state = stateWithMoney(999_999_999, { marketing: MAX_UPGRADE_LEVEL });
    const moneyBefore = state.team.money;
    const result = applyPurchase(state, 'marketing');
    expect(result).toBe(false);
    expect(state.team.money).toBe(moneyBefore);
    expect(state.upgrades.marketing).toBe(MAX_UPGRADE_LEVEL);
  });

  it('sequential purchases correctly increment level and deduct money', () => {
    const state = stateWithMoney(999_999_999);
    const cost0 = costFor('scouting', 0);
    const cost1 = costFor('scouting', 1);
    applyPurchase(state, 'scouting');
    applyPurchase(state, 'scouting');
    expect(state.upgrades.scouting).toBe(2);
    expect(state.team.money).toBe(999_999_999 - cost0 - cost1);
  });

  it('handles missing state.upgrades field gracefully (initializes it)', () => {
    const state = {
      team: { money: 999_999_999, fans: 0, rings: 0, seasonsPlayed: 0, name: 'X' },
      // no upgrades field
    };
    const result = applyPurchase(state, 'marketing');
    expect(result).toBe(true);
    expect(state.upgrades.marketing).toBe(1);
  });
});
