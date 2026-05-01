// Unit tests for block-fps/enemies.js — pure helper: damageEnemy.
//
// damageEnemy(e, amount) is a pure reducer over an enemy record: it mutates
// e.hp and e.dead in place and returns a boolean indicating whether the hit
// was fatal. The function does not reference the scene or THREE — it only
// needs the enemy record, so it's fully testable in Node.
//
// We do NOT test spawnEnemy, resetEnemies, or updateEnemies here — they all
// require a THREE scene. Those are covered by E2E tests.

import { describe, it, expect } from 'vitest';
import { damageEnemy } from '../../../public/games/block-fps/enemies.js';
import { ENEMIES, GUN_DAMAGE } from '../../../public/games/block-fps/config.js';

// Helper: make a minimal enemy record that damageEnemy can operate on.
// (damageEnemy only reads/writes e.dead and e.hp — no mesh, no scene.)
function makeEnemy(kind) {
  const def = ENEMIES[kind];
  return { kind, def, hp: def.hp, maxHp: def.hp, dead: false };
}

// ---------------------------------------------------------------------------
// damageEnemy — basic contract
// ---------------------------------------------------------------------------

describe('damageEnemy — basic contract', () => {
  it('reduces hp by the damage amount when enemy is alive', () => {
    const e = makeEnemy('grunt');
    const startHp = e.hp;
    damageEnemy(e, 10);
    expect(e.hp).toBe(startHp - 10);
  });

  it('returns false when the hit is non-fatal', () => {
    const e = makeEnemy('heavy');   // hp=110; one shot (28) is not fatal
    const killed = damageEnemy(e, GUN_DAMAGE);
    expect(killed).toBe(false);
    expect(e.dead).toBe(false);
  });

  it('returns true when the hit reduces hp to exactly 0', () => {
    const e = makeEnemy('grunt');
    e.hp = GUN_DAMAGE; // set hp equal to one shot
    const killed = damageEnemy(e, GUN_DAMAGE);
    expect(killed).toBe(true);
    expect(e.dead).toBe(true);
    expect(e.hp).toBe(0);
  });

  it('returns true when the hit reduces hp below 0 (overkill)', () => {
    const e = makeEnemy('charger');
    e.hp = 1; // almost dead
    const killed = damageEnemy(e, GUN_DAMAGE);
    expect(killed).toBe(true);
    expect(e.dead).toBe(true);
    expect(e.hp).toBe(0); // clamped to 0, not negative
  });

  it('hp is clamped to 0 on a killing blow — never goes negative', () => {
    const e = makeEnemy('grunt');
    e.hp = 5;
    damageEnemy(e, 100); // massive overkill
    expect(e.hp).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// damageEnemy — already dead guard
// ---------------------------------------------------------------------------

describe('damageEnemy — dead guard', () => {
  it('returns false and leaves hp unchanged when the enemy is already dead', () => {
    const e = makeEnemy('grunt');
    e.hp = 0;
    e.dead = true;
    const killed = damageEnemy(e, GUN_DAMAGE);
    expect(killed).toBe(false);
    expect(e.hp).toBe(0);
    expect(e.dead).toBe(true);
  });

  it('a second call after a fatal hit is a no-op', () => {
    const e = makeEnemy('charger');
    damageEnemy(e, 1000); // kill
    expect(e.dead).toBe(true);
    const killed2 = damageEnemy(e, GUN_DAMAGE);
    expect(killed2).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// damageEnemy — per-enemy-kind behavior
// ---------------------------------------------------------------------------

describe('damageEnemy — per-kind HP thresholds', () => {
  it('grunt dies in ceil(grunt.hp / GUN_DAMAGE) shots', () => {
    const def = ENEMIES.grunt;
    const shotsNeeded = Math.ceil(def.hp / GUN_DAMAGE);
    const e = makeEnemy('grunt');
    let kills = 0;
    for (let i = 0; i < shotsNeeded; i++) {
      if (damageEnemy(e, GUN_DAMAGE)) kills++;
    }
    expect(kills).toBe(1); // exactly one kill per enemy
    expect(e.dead).toBe(true);
  });

  it('heavy requires more shots than grunt to kill', () => {
    const shotsGrunt = Math.ceil(ENEMIES.grunt.hp / GUN_DAMAGE);
    const shotsHeavy = Math.ceil(ENEMIES.heavy.hp / GUN_DAMAGE);
    expect(shotsHeavy).toBeGreaterThan(shotsGrunt);
  });

  it('charger dies in fewer shots than heavy', () => {
    const shotsCharger = Math.ceil(ENEMIES.charger.hp / GUN_DAMAGE);
    const shotsHeavy   = Math.ceil(ENEMIES.heavy.hp   / GUN_DAMAGE);
    expect(shotsCharger).toBeLessThan(shotsHeavy);
  });
});
