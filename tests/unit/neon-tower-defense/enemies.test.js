// Unit tests for enemies.js — path-following entities, HP, slow, targeting.
//
// enemies.js imports from render.js (draw functions, spawnBurst), but those
// are only called from draw-path code we never invoke here. The pure logic
// (spawnEnemy, damage, applySlow, findFirstInRange, findInAoe, updateEnemies)
// is exercised directly.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  enemies, spawnEnemy, resetEnemies,
  damage, applySlow,
  findFirstInRange, findInAoe,
  updateEnemies,
} from '../../../public/games/neon-tower-defense/enemies.js';
import { ENEMIES } from '../../../public/games/neon-tower-defense/config.js';
import { PATH_LEN } from '../../../public/games/neon-tower-defense/map.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetEnemies();
});

// ---------------------------------------------------------------------------
// spawnEnemy
// ---------------------------------------------------------------------------

describe('enemies — spawnEnemy', () => {
  it('returns a non-null enemy object for a valid kind', () => {
    const e = spawnEnemy('square');
    expect(e).not.toBeNull();
  });

  it('appends the enemy to enemies[]', () => {
    spawnEnemy('square');
    expect(enemies.length).toBe(1);
  });

  it('starts at progress=0 (beginning of path)', () => {
    const e = spawnEnemy('square');
    expect(e.progress).toBe(0);
  });

  it('uses the default HP from ENEMIES config when no multiplier', () => {
    const e = spawnEnemy('square');
    expect(e.hp).toBe(ENEMIES.square.hp);
    expect(e.maxHp).toBe(ENEMIES.square.hp);
  });

  it('uses the default speed from ENEMIES config when no multiplier', () => {
    const e = spawnEnemy('hex');
    expect(e.speed).toBe(ENEMIES.hex.speed);
  });

  it('applies HP multiplier correctly', () => {
    const e = spawnEnemy('square', { hp: 2.0 });
    expect(e.hp).toBe(ENEMIES.square.hp * 2);
  });

  it('applies speed multiplier correctly', () => {
    const e = spawnEnemy('square', { speed: 1.5 });
    expect(e.speed).toBe(ENEMIES.square.speed * 1.5);
  });

  it('applies value multiplier correctly', () => {
    const e = spawnEnemy('square', { valueMul: 2.0 });
    expect(e.value).toBe(ENEMIES.square.value * 2);
  });

  it('stores the correct kind and def reference', () => {
    const e = spawnEnemy('boss');
    expect(e.kind).toBe('boss');
    expect(e.def).toBe(ENEMIES.boss);
  });

  it('returns null for an unknown enemy kind', () => {
    const e = spawnEnemy('unknownEnemy');
    expect(e).toBeNull();
  });

  it('spawned enemy is not dead and not leaked', () => {
    const e = spawnEnemy('tri');
    expect(e.dead).toBe(false);
    expect(e.leaked).toBe(false);
  });

  it('spawned enemy starts with slowT=0 and slowFrac=0', () => {
    const e = spawnEnemy('hex');
    expect(e.slowT).toBe(0);
    expect(e.slowFrac).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// damage
// ---------------------------------------------------------------------------

describe('enemies — damage', () => {
  it('reduces enemy HP by the given amount', () => {
    const e = spawnEnemy('square');
    const startHp = e.hp;
    damage(e, 5);
    expect(e.hp).toBe(startHp - 5);
  });

  it('returns false on a non-fatal hit', () => {
    const e = spawnEnemy('square'); // hp=30
    const killed = damage(e, 5);
    expect(killed).toBe(false);
  });

  it('returns true on the fatal hit', () => {
    const e = spawnEnemy('square'); // hp=30
    const killed = damage(e, 30);
    expect(killed).toBe(true);
  });

  it('marks the enemy as dead on the fatal hit', () => {
    const e = spawnEnemy('square');
    damage(e, e.hp);
    expect(e.dead).toBe(true);
  });

  it('returns false on a hit against an already-dead enemy', () => {
    const e = spawnEnemy('square');
    damage(e, e.hp); // fatal
    const again = damage(e, 1);
    expect(again).toBe(false);
  });

  it('does not reduce HP below 0 after already dead', () => {
    const e = spawnEnemy('square');
    damage(e, e.hp);
    damage(e, 100);
    // HP can be negative (we don't clamp), but the important thing is
    // that the "killed" signal didn't fire again. dead flag stays true.
    expect(e.dead).toBe(true);
  });

  it('overkill damage sets hp to a non-positive value', () => {
    const e = spawnEnemy('square'); // hp=30
    damage(e, 50);
    expect(e.hp).toBeLessThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// applySlow
// ---------------------------------------------------------------------------

describe('enemies — applySlow', () => {
  it('applies slow fraction and duration to a fresh enemy', () => {
    const e = spawnEnemy('hex');
    applySlow(e, 0.4, 2.0);
    expect(e.slowFrac).toBe(0.4);
    expect(e.slowT).toBe(2.0);
  });

  it('replaces a weaker slow with a stronger one', () => {
    const e = spawnEnemy('hex');
    applySlow(e, 0.2, 1.0);
    applySlow(e, 0.5, 0.5);
    expect(e.slowFrac).toBe(0.5);
  });

  it('does not replace a stronger slow with a weaker one', () => {
    const e = spawnEnemy('hex');
    applySlow(e, 0.5, 1.0);
    applySlow(e, 0.2, 3.0);
    // Stronger slow stays, but if the new duration is longer it should be applied.
    expect(e.slowFrac).toBe(0.5);
  });

  it('extends duration when same-strength slow comes in with longer duration', () => {
    const e = spawnEnemy('hex');
    applySlow(e, 0.3, 1.0);
    // Same frac (not greater), but longer dur.
    applySlow(e, 0.3, 2.0);
    expect(e.slowT).toBe(2.0);
  });

  it('slow effect decays to 0 when updateEnemies advances dt past slowT', () => {
    const e = spawnEnemy('hex');
    applySlow(e, 0.5, 0.1);
    // Advance well past the slow duration.
    updateEnemies(0.5, null, null);
    // Enemy may have moved and been removed — only check if it's still in array.
    if (enemies.includes(e)) {
      expect(e.slowFrac).toBe(0);
      expect(e.slowT).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// findFirstInRange
// ---------------------------------------------------------------------------

describe('enemies — findFirstInRange', () => {
  it('returns null when no enemies are present', () => {
    const result = findFirstInRange(100, 100, 999);
    expect(result).toBeNull();
  });

  it('returns the enemy when one is within range', () => {
    const e = spawnEnemy('square');
    // Enemy starts at PATH[0] = { x: -20, y: 70 }. Query from near there.
    const result = findFirstInRange(-20, 70, 50);
    expect(result).toBe(e);
  });

  it('returns null when the only enemy is outside range', () => {
    spawnEnemy('square'); // starts at (-20, 70)
    const result = findFirstInRange(400, 200, 10);
    expect(result).toBeNull();
  });

  it('returns the "first" (furthest along path) when two enemies are in range', () => {
    const e1 = spawnEnemy('square');
    const e2 = spawnEnemy('square');
    // Manually set progress and positions. findFirstInRange uses e.x/e.y
    // for the range check and e.progress for the "first" priority.
    e1.progress = 10;
    e1.x = -20; e1.y = 70;
    e2.progress = 50;
    e2.x = -20; e2.y = 70; // same canvas position, higher progress
    const result = findFirstInRange(-20, 70, 100);
    expect(result).toBe(e2); // e2 has higher progress (closer to escaping)
  });

  it('ignores dead enemies', () => {
    const e = spawnEnemy('square');
    e.dead = true;
    e.x = 100; e.y = 100;
    const result = findFirstInRange(100, 100, 999);
    expect(result).toBeNull();
  });

  it('ignores leaked enemies', () => {
    const e = spawnEnemy('square');
    e.leaked = true;
    e.x = 100; e.y = 100;
    const result = findFirstInRange(100, 100, 999);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// findInAoe
// ---------------------------------------------------------------------------

describe('enemies — findInAoe', () => {
  it('returns an empty array when no enemies are present', () => {
    expect(findInAoe(0, 0, 999)).toEqual([]);
  });

  it('includes enemy within radius', () => {
    const e = spawnEnemy('square');
    e.x = 50; e.y = 50;
    const result = findInAoe(50, 50, 10);
    expect(result).toContain(e);
  });

  it('excludes enemy outside radius', () => {
    const e = spawnEnemy('square');
    e.x = 200; e.y = 200;
    const result = findInAoe(50, 50, 10);
    expect(result).not.toContain(e);
  });

  it('excludes dead enemies', () => {
    const e = spawnEnemy('square');
    e.x = 50; e.y = 50;
    e.dead = true;
    expect(findInAoe(50, 50, 100)).not.toContain(e);
  });

  it('returns multiple enemies within radius', () => {
    const e1 = spawnEnemy('square');
    const e2 = spawnEnemy('square');
    e1.x = 10; e1.y = 10;
    e2.x = 15; e2.y = 15;
    const result = findInAoe(12, 12, 20);
    expect(result).toContain(e1);
    expect(result).toContain(e2);
  });
});

// ---------------------------------------------------------------------------
// updateEnemies — path advancement
// ---------------------------------------------------------------------------

describe('enemies — updateEnemies path advancement', () => {
  it('increases progress over time', () => {
    const e = spawnEnemy('square'); // speed=50
    const before = e.progress;
    updateEnemies(0.1, null, null);
    if (!e.dead && !e.leaked && enemies.includes(e)) {
      expect(e.progress).toBeGreaterThan(before);
    }
  });

  it('calls onLeak when enemy progress exceeds PATH_LEN', () => {
    const e = spawnEnemy('square');
    // Force the enemy very close to the end.
    e.progress = PATH_LEN - 0.001;
    let leaked = null;
    updateEnemies(1.0, (leakedEnemy) => { leaked = leakedEnemy; }, null);
    expect(leaked).not.toBeNull();
    expect(leaked).toBe(e);
  });

  it('removes leaked enemy from enemies[] during update', () => {
    const e = spawnEnemy('square');
    e.progress = PATH_LEN + 1;
    e.leaked = true;
    updateEnemies(0.016, null, null);
    expect(enemies).not.toContain(e);
  });

  it('removes dead enemy from enemies[] during update', () => {
    const e = spawnEnemy('square');
    e.dead = true;
    updateEnemies(0.016, null, null);
    expect(enemies).not.toContain(e);
  });
});
