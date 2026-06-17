// Neon Tower Defense — deterministic replay test.
//
// Scenario: one Bolt L1 at col=3, row=1 (pixel center 56,46); 3 square
// enemies spawned at progress offsets [0, 20, 40] along the path. The
// simulation is stepped with a fixed dt=1/60 for 360 frames (6 seconds).
//
// Snapshot values (locked 2026-05-01):
//   kills=2, moneyEarned=12, enemiesLeft=1, totalHpLeft=30
//
// What happens:
//   - Enemy at progress=40 enters range first (highest progress → targeted
//     first by findFirstInRange "first along path" policy).
//   - Bolt fires every 0.55s (rate), homing projectile at speed=360 px/s.
//   - Enemy hp=30, dmg=12/shot → 3 shots to kill.
//   - After enemy #3 dies, tower shifts to enemy #2, kills it too.
//   - Enemy #1 starts at progress=0 (x=-20, y=70) and walks forward. By
//     the time it's the only target its position has drifted down the path
//     past y=130 (distance to tower >84px, out of range). It passes out of
//     range before accumulating enough shots, so it survives the scenario.
//
// Why this is deterministic:
//   - No Math.random() in the core combat path (damage, homing, range check).
//   - spawnBurst/spawnSpark use Math.random() for particle positions, but
//     particles only affect visuals and are not asserted here.
//   - Tower angle update uses atan2 — purely geometric.
//   - Fixed dt (1/60) eliminates frame-rate variance.
//
// Update the snapshot only when the spec intentionally changes a combat
// constant (dmg, range, rate, enemy HP, speed, or path shape).

import { describe, it, expect, beforeEach } from 'vitest';
import {
  towers, buildTower, resetTowers, updateTowers,
} from '../../public/games/neon-tower-defense/towers.js';
import {
  enemies, spawnEnemy, resetEnemies, updateEnemies,
} from '../../public/games/neon-tower-defense/enemies.js';
import {
  projectiles, resetProjectiles, updateProjectiles,
} from '../../public/games/neon-tower-defense/projectiles.js';
import { ENEMIES } from '../../public/games/neon-tower-defense/config.js';

// ---------------------------------------------------------------------------
// Simulation driver
// ---------------------------------------------------------------------------

/**
 * Run the fixed mini-scenario:
 *   - 1 Bolt L1 at col=3, row=1
 *   - enemyCount square enemies at progress offsets [0, 20, 40, ...]
 *   - frames ticks at dt seconds each
 *
 * Returns game-state quantities, not visual state.
 */
function runScenario({ enemyCount, frames, dt, baseProgress = 0 }) {
  resetTowers();
  resetEnemies();
  resetProjectiles();

  buildTower('bolt', 3, 1);

  for (let i = 0; i < enemyCount; i++) {
    const e = spawnEnemy('square');
    e.progress = baseProgress + i * 20;
  }
  // Sync x/y positions from progress values (dt=0 advances no time).
  updateEnemies(0, null, null);

  let kills = 0;
  let moneyEarned = 0;
  let leaked = 0;

  const onKill = (e) => {
    kills++;
    moneyEarned += e.value ?? e.def.value;
  };
  const onLeak = () => { leaked++; };

  for (let f = 0; f < frames; f++) {
    updateTowers(dt, null);
    updateProjectiles(dt, onKill);
    updateEnemies(dt, onLeak, null);
  }

  const totalHpLeft = enemies.reduce((acc, e) => acc + Math.max(0, e.hp), 0);

  return { kills, moneyEarned, enemiesLeft: enemies.length, totalHpLeft, leaked };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetTowers();
  resetEnemies();
  resetProjectiles();
});

// ---------------------------------------------------------------------------
// Replay tests — literal snapshot
// ---------------------------------------------------------------------------

describe('Neon Tower Defense replay', () => {
  it('1 Bolt L1 vs 3 squares, 360 frames (6s) — snapshot matches', () => {
    const result = runScenario({ enemyCount: 3, frames: 360, dt: 1 / 60 });

    // Locked snapshot (2026-05-01).
    // Change only when a combat constant in config.js intentionally changes.
    expect(result.kills).toBe(2);
    expect(result.moneyEarned).toBe(12);
    expect(result.enemiesLeft).toBe(1);
    expect(result.totalHpLeft).toBe(30);
    expect(result.leaked).toBe(0);
  });

  it('replay is deterministic — same inputs produce same result twice', () => {
    const opts = { enemyCount: 3, frames: 360, dt: 1 / 60 };
    const r1 = runScenario(opts);
    const r2 = runScenario(opts);
    expect(r1.kills).toBe(r2.kills);
    expect(r1.moneyEarned).toBe(r2.moneyEarned);
    expect(r1.enemiesLeft).toBe(r2.enemiesLeft);
    expect(r1.totalHpLeft).toBe(r2.totalHpLeft);
  });

  it('economic invariant: moneyEarned === kills × square value', () => {
    const result = runScenario({ enemyCount: 3, frames: 360, dt: 1 / 60 });
    expect(result.moneyEarned).toBe(result.kills * ENEMIES.square.value);
  });

  it('no enemies survive with more HP than they started with', () => {
    // A surviving enemy can only have less HP or the same HP as it started
    // (towers can only deal damage, never heal).
    const result = runScenario({ enemyCount: 3, frames: 360, dt: 1 / 60 });
    expect(result.totalHpLeft).toBeLessThanOrEqual(3 * ENEMIES.square.hp);
  });

  it('zero enemies → zero kills, zero money', () => {
    const result = runScenario({ enemyCount: 0, frames: 180, dt: 1 / 60 });
    expect(result.kills).toBe(0);
    expect(result.moneyEarned).toBe(0);
    expect(result.enemiesLeft).toBe(0);
  });
});
