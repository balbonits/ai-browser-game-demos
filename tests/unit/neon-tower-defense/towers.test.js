// Unit tests for towers.js — pure tower logic.
//
// Drawing functions are imported but never called — tower.js passes ctx to
// drawTowers() which we never invoke here. The pure logic (build, sell,
// upgrade, stats, targeting math) is exercised directly.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  towers, buildTower, sellTower, upgradeTower,
  nextUpgradeCost, towerStats, resetTowers,
} from '../../../public/games/neon-tower-defense/towers.js';
import { TOWERS, TILE, FIELD_TOP } from '../../../public/games/neon-tower-defense/config.js';
import { buildable } from '../../../public/games/neon-tower-defense/map.js';
import { resetEnemies } from '../../../public/games/neon-tower-defense/enemies.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Find a buildable tile to place a tower on.
function firstBuildable() {
  for (let r = 0; r < buildable.length; r++) {
    for (let c = 0; c < buildable[r].length; c++) {
      if (buildable[r][c]) return { col: c, row: r };
    }
  }
  throw new Error('No buildable tile found');
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetTowers();
  resetEnemies();
});

// ---------------------------------------------------------------------------
// buildTower
// ---------------------------------------------------------------------------

describe('towers — buildTower', () => {
  it('returns a tower object and appends it to towers[]', () => {
    const { col, row } = firstBuildable();
    const t = buildTower('bolt', col, row);
    expect(t).not.toBeNull();
    expect(towers).toContain(t);
  });

  it('placed tower has the correct kind key and level 1', () => {
    const { col, row } = firstBuildable();
    const t = buildTower('bolt', col, row);
    expect(t.key).toBe('bolt');
    expect(t.level).toBe(1);
  });

  it('placed tower invested equals the L1 build cost', () => {
    const { col, row } = firstBuildable();
    const t = buildTower('bolt', col, row);
    expect(t.invested).toBe(TOWERS.bolt.levels[0].cost);
  });

  it('placed tower position equals tileCenter(col, row)', () => {
    const { col, row } = firstBuildable();
    const t = buildTower('bolt', col, row);
    expect(t.x).toBe(col * TILE + TILE / 2);
    expect(t.y).toBe(FIELD_TOP + row * TILE + TILE / 2);
  });

  it('marks the tile as non-buildable after placement', () => {
    const { col, row } = firstBuildable();
    buildTower('bolt', col, row);
    expect(buildable[row][col]).toBe(false);
  });

  it('returns null when placing on an already-occupied tile', () => {
    const { col, row } = firstBuildable();
    buildTower('bolt', col, row);
    const second = buildTower('pulse', col, row);
    expect(second).toBeNull();
  });

  it('returns null for an unknown tower key', () => {
    const { col, row } = firstBuildable();
    const t = buildTower('unknown_key', col, row);
    expect(t).toBeNull();
  });

  it('builds each tower type correctly', () => {
    const tiles = [];
    for (let r = 0; r < buildable.length && tiles.length < 3; r++) {
      for (let c = 0; c < buildable[r].length && tiles.length < 3; c++) {
        if (buildable[r][c]) tiles.push({ col: c, row: r });
      }
    }
    const keys = ['bolt', 'pulse', 'spike'];
    for (let i = 0; i < keys.length; i++) {
      const t = buildTower(keys[i], tiles[i].col, tiles[i].row);
      expect(t).not.toBeNull();
      expect(t.key).toBe(keys[i]);
    }
  });
});

// ---------------------------------------------------------------------------
// sellTower
// ---------------------------------------------------------------------------

describe('towers — sellTower', () => {
  it('returns 70% of invested cost (rounded) on sell', () => {
    const { col, row } = firstBuildable();
    const t = buildTower('bolt', col, row);
    const invested = t.invested;
    const refund = sellTower(t);
    expect(refund).toBe(Math.round(invested * 0.7));
  });

  it('removes the tower from towers[] after sell', () => {
    const { col, row } = firstBuildable();
    const t = buildTower('bolt', col, row);
    sellTower(t);
    expect(towers).not.toContain(t);
  });

  it('marks the tile as buildable again after sell', () => {
    const { col, row } = firstBuildable();
    buildTower('bolt', col, row);
    expect(buildable[row][col]).toBe(false);
    const t = towers[0];
    sellTower(t);
    expect(buildable[row][col]).toBe(true);
  });

  it('returns 0 when selling a tower not in the array', () => {
    const { col, row } = firstBuildable();
    const t = buildTower('bolt', col, row);
    sellTower(t);
    // Selling the same tower again should return 0.
    const refund = sellTower(t);
    expect(refund).toBe(0);
  });

  it('refund for upgraded bolt L1→L2 includes upgrade cost', () => {
    const { col, row } = firstBuildable();
    const t = buildTower('bolt', col, row);
    upgradeTower(t);
    // invested = L1 cost (40) + L2 upgrade cost (50) = 90
    const expected = Math.round(90 * 0.7);
    const refund = sellTower(t);
    expect(refund).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// upgradeTower
// ---------------------------------------------------------------------------

describe('towers — upgradeTower', () => {
  it('advances level from 1 to 2', () => {
    const { col, row } = firstBuildable();
    const t = buildTower('bolt', col, row);
    upgradeTower(t);
    expect(t.level).toBe(2);
  });

  it('advances level from 2 to 3 (max)', () => {
    const { col, row } = firstBuildable();
    const t = buildTower('bolt', col, row);
    upgradeTower(t);
    upgradeTower(t);
    expect(t.level).toBe(3);
  });

  it('adds the upgrade cost to invested', () => {
    const { col, row } = firstBuildable();
    const t = buildTower('bolt', col, row);
    const beforeInvested = t.invested;
    const upgradeCost = TOWERS.bolt.levels[1].cost; // L2 cost
    upgradeTower(t);
    expect(t.invested).toBe(beforeInvested + upgradeCost);
  });

  it('returns false when tower is already at max level', () => {
    const { col, row } = firstBuildable();
    const t = buildTower('bolt', col, row);
    upgradeTower(t);
    upgradeTower(t);
    const result = upgradeTower(t);
    expect(result).toBe(false);
    expect(t.level).toBe(3); // stays at max
  });

  it('level remains at 3 after trying to upgrade at max', () => {
    const { col, row } = firstBuildable();
    const t = buildTower('spike', col, row);
    upgradeTower(t);
    upgradeTower(t);
    upgradeTower(t); // should not advance
    expect(t.level).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// nextUpgradeCost
// ---------------------------------------------------------------------------

describe('towers — nextUpgradeCost', () => {
  it('returns L2 cost for a L1 tower', () => {
    const { col, row } = firstBuildable();
    const t = buildTower('bolt', col, row);
    expect(nextUpgradeCost(t)).toBe(TOWERS.bolt.levels[1].cost);
  });

  it('returns L3 cost for a L2 tower', () => {
    const { col, row } = firstBuildable();
    const t = buildTower('bolt', col, row);
    upgradeTower(t);
    expect(nextUpgradeCost(t)).toBe(TOWERS.bolt.levels[2].cost);
  });

  it('returns null for a max-level tower', () => {
    const { col, row } = firstBuildable();
    const t = buildTower('bolt', col, row);
    upgradeTower(t);
    upgradeTower(t);
    expect(nextUpgradeCost(t)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// towerStats
// ---------------------------------------------------------------------------

describe('towers — towerStats', () => {
  it('returns L1 stats for a newly-built tower', () => {
    const { col, row } = firstBuildable();
    const t = buildTower('bolt', col, row);
    const stats = towerStats(t);
    expect(stats).toEqual(TOWERS.bolt.levels[0]);
  });

  it('returns L2 stats after one upgrade', () => {
    const { col, row } = firstBuildable();
    const t = buildTower('bolt', col, row);
    upgradeTower(t);
    const stats = towerStats(t);
    expect(stats).toEqual(TOWERS.bolt.levels[1]);
  });

  it('stats update immediately after upgrade (no caching)', () => {
    const { col, row } = firstBuildable();
    const t = buildTower('spike', col, row);
    const l1Pierce = towerStats(t).pierce;
    upgradeTower(t);
    const l2Pierce = towerStats(t).pierce;
    // Spike L1 pierce=1, L2 pierce=2
    expect(l1Pierce).toBe(1);
    expect(l2Pierce).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// resetTowers
// ---------------------------------------------------------------------------

describe('towers — resetTowers', () => {
  it('clears the towers array', () => {
    const { col, row } = firstBuildable();
    buildTower('bolt', col, row);
    expect(towers.length).toBeGreaterThan(0);
    resetTowers();
    expect(towers.length).toBe(0);
  });

  it('restores previously-occupied tiles to buildable after reset', () => {
    const { col, row } = firstBuildable();
    buildTower('bolt', col, row);
    expect(buildable[row][col]).toBe(false);
    resetTowers();
    expect(buildable[row][col]).toBe(true);
  });
});
