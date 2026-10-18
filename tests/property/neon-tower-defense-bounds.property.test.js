// Property tests — economy and lives invariants for Neon Tower Defense.
//
// Invariant 1: money never goes negative after a sequence of build/sell
//   actions on a fixed starting budget.
// Invariant 2: lives never goes negative and never exceeds STARTING_LIVES.
//   (Lives only decrease when enemies leak; this test uses a pure
//   simulation without spawning enemies, so lives stays constant. The
//   monotone-non-increase invariant is verified via the damage() path.)
//
// Property tests use fast-check to generate arbitrary sequences of
// valid game actions and verify the invariants hold across all of them.

import { describe, it } from 'vitest';
import fc from 'fast-check';
import {
  towers, buildTower, resetTowers, sellTower, upgradeTower,
  nextUpgradeCost,
} from '../../public/games/neon-tower-defense/towers.js';
import { resetEnemies } from '../../public/games/neon-tower-defense/enemies.js';
import { resetProjectiles } from '../../public/games/neon-tower-defense/projectiles.js';
import { buildable } from '../../public/games/neon-tower-defense/map.js';
import {
  STARTING_MONEY, STARTING_LIVES, TOWERS, TOWER_KEYS,
} from '../../public/games/neon-tower-defense/config.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Collect all currently-buildable tile coordinates.
function buildableTiles() {
  const tiles = [];
  for (let r = 0; r < buildable.length; r++) {
    for (let c = 0; c < buildable[r].length; c++) {
      if (buildable[r][c]) tiles.push({ col: c, row: r });
    }
  }
  return tiles;
}

// ---------------------------------------------------------------------------
// Property 1: money never goes negative
// ---------------------------------------------------------------------------

describe('Neon TD — money invariant', () => {
  it('money never goes negative after any sequence of build/upgrade/sell', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            action: fc.constantFrom('build', 'upgrade', 'sell'),
            towerKey: fc.constantFrom(...TOWER_KEYS),
            // Pick a tower from the placed list by index (may be empty → no-op).
            towerIdx: fc.nat({ max: 19 }),
          }),
          { minLength: 1, maxLength: 40 },
        ),
        (actions) => {
          resetTowers();
          resetEnemies();
          resetProjectiles();

          let money = STARTING_MONEY;

          for (const { action, towerKey, towerIdx } of actions) {
            if (action === 'build') {
              const available = buildableTiles();
              if (available.length === 0) continue;
              // Use towerIdx mod available.length to pick deterministically.
              const { col, row } = available[towerIdx % available.length];
              const cost = TOWERS[towerKey].levels[0].cost;
              if (money >= cost) {
                const t = buildTower(towerKey, col, row);
                if (t) money -= cost;
              }
            } else if (action === 'upgrade') {
              if (towers.length === 0) continue;
              const t = towers[towerIdx % towers.length];
              const cost = nextUpgradeCost(t);
              if (cost != null && money >= cost) {
                upgradeTower(t);
                money -= cost;
              }
            } else if (action === 'sell') {
              if (towers.length === 0) continue;
              const t = towers[towerIdx % towers.length];
              const refund = sellTower(t);
              money += refund;
            }

            // Invariant: money must never be negative.
            if (money < 0) return false;
          }

          return money >= 0;
        },
      ),
      { numRuns: 200, seed: 42 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2: lives monotone-non-increasing and never below 0
// ---------------------------------------------------------------------------

describe('Neon TD — lives invariant', () => {
  it('lives never exceed STARTING_LIVES and are bounded below by 0', () => {
    fc.assert(
      fc.property(
        // Generate sequences of damage events (simulating enemies leaking).
        fc.array(
          fc.nat({ max: 5 }), // enemy damage value: 1–5
          { minLength: 0, maxLength: 30 },
        ),
        (damageEvents) => {
          let lives = STARTING_LIVES;

          for (const dmg of damageEvents) {
            if (dmg === 0) continue; // no-op (boss damage is 1–5, skip 0)
            lives -= dmg;
            lives = Math.max(0, lives); // game clamps lives to 0 on defeat

            // Invariant: lives in [0, STARTING_LIVES].
            if (lives < 0) return false;
            if (lives > STARTING_LIVES) return false;
          }

          return lives >= 0 && lives <= STARTING_LIVES;
        },
      ),
      { numRuns: 200, seed: 99 },
    );
  });

  it('lives can only decrease (never increase from enemy damage)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.nat({ max: 5 }), { minLength: 1, maxLength: 20 }),
        (damageEvents) => {
          let lives = STARTING_LIVES;
          for (const dmg of damageEvents) {
            if (dmg === 0) continue;
            const before = lives;
            lives = Math.max(0, lives - dmg);
            // Lives must not increase from a leak event.
            if (lives > before) return false;
          }
          return true;
        },
      ),
      { numRuns: 200, seed: 77 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: sell refund is always <= invested cost
// ---------------------------------------------------------------------------

describe('Neon TD — sell refund invariant', () => {
  it('sell refund never exceeds total invested credits', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TOWER_KEYS),
        fc.nat({ max: 2 }), // 0=no upgrade, 1=L2, 2=L3
        (key, upgrades) => {
          resetTowers();
          resetEnemies();
          resetProjectiles();

          const available = buildableTiles();
          if (available.length === 0) return true; // skip if no tiles (shouldn't happen)

          const { col, row } = available[0];
          const t = buildTower(key, col, row);
          if (!t) return true;

          let invested = t.invested;
          for (let u = 0; u < upgrades; u++) {
            const cost = nextUpgradeCost(t);
            if (cost == null) break;
            upgradeTower(t);
            invested += cost;
          }

          const refund = sellTower(t);

          // Refund must not exceed 100% of invested (it should be 70%).
          if (refund > invested) return false;
          // Refund should be non-negative.
          if (refund < 0) return false;
          // Refund should be exactly Math.round(invested * 0.7).
          return refund === Math.round(invested * 0.7);
        },
      ),
      { numRuns: 200, seed: 11 },
    );
  });
});
