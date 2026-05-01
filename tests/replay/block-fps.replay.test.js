// block-fps replay test — deterministic damage model.
//
// block-fps uses Math.random() (unseeded) for enemy spawn positions, wave
// kind selection, and bullet spread. Full deterministic replay of the 3D
// game loop would require seeding Math.random and constructing a real THREE
// scene — too invasive for the replay tier.
//
// Instead, this file drives the ONE deterministic layer: the damage
// accumulation model (damageEnemy). Given fixed enemy records and a fixed
// sequence of shots, the resulting state is fully deterministic and can be
// snapshotted.
//
// Why this is still useful: if damageEnemy's contract changes (e.g., someone
// adds pierce damage or a defense multiplier), this snapshot breaks and the
// break is visible in review.

import { describe, it, expect } from 'vitest';
import { damageEnemy } from '../../public/games/block-fps/enemies.js';
import { ENEMIES, GUN_DAMAGE } from '../../public/games/block-fps/config.js';

// Helper: run N shots of `damage` against the given enemy record in sequence.
// Returns { hpRemaining, killShot } — the HP after all shots and the shot
// index (1-based) on which the kill occurred, or null if still alive.
function runShotsUntilDead(enemy, damage, maxShots) {
  let killShot = null;
  for (let i = 1; i <= maxShots; i++) {
    const killed = damageEnemy(enemy, damage);
    if (killed && killShot === null) killShot = i;
  }
  return { hpRemaining: enemy.hp, killShot };
}

function makeEnemy(kind) {
  const def = ENEMIES[kind];
  return { kind, def, hp: def.hp, maxHp: def.hp, dead: false };
}

describe('block-fps replay — deterministic damage sequences', () => {
  // Snapshot: grunt with 32 HP, GUN_DAMAGE=28.
  // Shot 1: hp = 32-28 = 4  (alive)
  // Shot 2: hp = 4-28  = -24 → clamped 0, dead=true (killShot=2)
  it('seed=grunt-alpha: grunt dies on shot 2, hp=0', () => {
    const e = makeEnemy('grunt');
    const result = runShotsUntilDead(e, GUN_DAMAGE, 5);
    expect(result.hpRemaining).toBe(0);
    expect(result.killShot).toBe(2);
  });

  // Snapshot: charger with 18 HP, GUN_DAMAGE=28.
  // Shot 1: hp = 18-28 = -10 → clamped 0, dead=true (killShot=1)
  it('seed=charger-alpha: charger dies in a single shot, hp=0', () => {
    const e = makeEnemy('charger');
    const result = runShotsUntilDead(e, GUN_DAMAGE, 5);
    expect(result.hpRemaining).toBe(0);
    expect(result.killShot).toBe(1);
  });

  // Snapshot: heavy with 110 HP, GUN_DAMAGE=28.
  // ceil(110/28) = ceil(3.93) = 4 shots.
  // Shot 1: 110-28 = 82
  // Shot 2: 82-28  = 54
  // Shot 3: 54-28  = 26
  // Shot 4: 26-28  = -2 → clamped 0 (killShot=4)
  it('seed=heavy-alpha: heavy dies on shot 4, hp=0', () => {
    const e = makeEnemy('heavy');
    const result = runShotsUntilDead(e, GUN_DAMAGE, 10);
    expect(result.hpRemaining).toBe(0);
    expect(result.killShot).toBe(4);
  });

  // Mixed wave simulation: 3 enemies (1 grunt, 1 charger, 1 heavy).
  // Player shoots each sequentially until dead, tallying total shots.
  // Expected: grunt=2, charger=1, heavy=4 → total=7 shots.
  it('mixed wave: 1 grunt + 1 charger + 1 heavy dies in 7 total shots', () => {
    const wave = [makeEnemy('grunt'), makeEnemy('charger'), makeEnemy('heavy')];
    let totalShots = 0;
    for (const e of wave) {
      let shots = 0;
      while (!e.dead) {
        damageEnemy(e, GUN_DAMAGE);
        shots++;
        if (shots > 100) throw new Error('infinite loop guard');
      }
      totalShots += shots;
    }
    // Snapshot: grunt(2) + charger(1) + heavy(4) = 7
    expect(totalShots).toBe(7);
  });
});
