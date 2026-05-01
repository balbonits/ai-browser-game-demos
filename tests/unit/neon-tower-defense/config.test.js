// Unit tests for config.js — pure constants, no side effects.
//
// Assertions encode the game's design spec so that any accidental edit
// to the content tables is caught mechanically.

import { describe, it, expect } from 'vitest';
import {
  WAVES, TOTAL_WAVES, TOWERS, TOWER_KEYS,
  ENEMIES, STATE, STORAGE,
  STARTING_MONEY, STARTING_LIVES, WAVE_COOLDOWN,
  W, H, HUD_H, TILE, COLS, ROWS,
} from '../../../public/games/neon-tower-defense/config.js';

// ---------------------------------------------------------------------------
// Waves
// ---------------------------------------------------------------------------

describe('Config — WAVES', () => {
  it('TOTAL_WAVES equals WAVES.length', () => {
    expect(TOTAL_WAVES).toBe(WAVES.length);
  });

  it('there are exactly 12 waves', () => {
    expect(WAVES.length).toBe(12);
  });

  it('every wave is a non-empty array of segments', () => {
    for (let i = 0; i < WAVES.length; i++) {
      const wave = WAVES[i];
      expect(Array.isArray(wave), `wave ${i + 1} is not an array`).toBe(true);
      expect(wave.length, `wave ${i + 1} has no segments`).toBeGreaterThan(0);
    }
  });

  it('every segment has required fields: kind, count, gap', () => {
    for (let wIdx = 0; wIdx < WAVES.length; wIdx++) {
      for (const seg of WAVES[wIdx]) {
        expect(seg.kind, `wave ${wIdx + 1} segment missing kind`).toBeDefined();
        expect(typeof seg.count, `wave ${wIdx + 1} segment count not a number`).toBe('number');
        expect(typeof seg.gap, `wave ${wIdx + 1} segment gap not a number`).toBe('number');
      }
    }
  });

  it('every segment count >= 1', () => {
    for (const wave of WAVES) {
      for (const seg of wave) {
        expect(seg.count).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('every segment gap > 0', () => {
    for (const wave of WAVES) {
      for (const seg of wave) {
        expect(seg.gap).toBeGreaterThan(0);
      }
    }
  });

  it('every segment kind is a valid enemy kind', () => {
    const validKinds = new Set(Object.keys(ENEMIES));
    for (let wIdx = 0; wIdx < WAVES.length; wIdx++) {
      for (const seg of WAVES[wIdx]) {
        expect(validKinds.has(seg.kind), `wave ${wIdx + 1}: unknown kind "${seg.kind}"`).toBe(true);
      }
    }
  });

  it('boss waves (4, 8, 12) contain a boss segment', () => {
    for (const bossWaveIdx of [3, 7, 11]) { // 0-indexed
      const hasBoss = WAVES[bossWaveIdx].some(seg => seg.kind === 'boss');
      expect(hasBoss, `wave ${bossWaveIdx + 1} should have a boss segment`).toBe(true);
    }
  });

  it('non-boss waves do not contain boss segments', () => {
    const bossWaveIdxes = new Set([3, 7, 11]);
    for (let i = 0; i < WAVES.length; i++) {
      if (bossWaveIdxes.has(i)) continue;
      const hasBoss = WAVES[i].some(seg => seg.kind === 'boss');
      expect(hasBoss, `wave ${i + 1} should not have boss`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Towers
// ---------------------------------------------------------------------------

describe('Config — TOWERS', () => {
  it('TOWER_KEYS matches Object.keys(TOWERS)', () => {
    expect(TOWER_KEYS).toEqual(Object.keys(TOWERS));
  });

  it('there are exactly 3 tower types', () => {
    expect(TOWER_KEYS.length).toBe(3);
  });

  it('tower types are bolt, pulse, spike', () => {
    expect(TOWER_KEYS).toContain('bolt');
    expect(TOWER_KEYS).toContain('pulse');
    expect(TOWER_KEYS).toContain('spike');
  });

  it('every tower has exactly 3 levels', () => {
    for (const key of TOWER_KEYS) {
      expect(TOWERS[key].levels.length, `${key} should have 3 levels`).toBe(3);
    }
  });

  it('every tower level has cost > 0', () => {
    for (const key of TOWER_KEYS) {
      for (let i = 0; i < TOWERS[key].levels.length; i++) {
        expect(TOWERS[key].levels[i].cost, `${key} L${i + 1} cost`).toBeGreaterThan(0);
      }
    }
  });

  it('every tower level has dmg > 0', () => {
    for (const key of TOWER_KEYS) {
      for (let i = 0; i < TOWERS[key].levels.length; i++) {
        expect(TOWERS[key].levels[i].dmg, `${key} L${i + 1} dmg`).toBeGreaterThan(0);
      }
    }
  });

  it('every tower level has range > 0', () => {
    for (const key of TOWER_KEYS) {
      for (let i = 0; i < TOWERS[key].levels.length; i++) {
        expect(TOWERS[key].levels[i].range, `${key} L${i + 1} range`).toBeGreaterThan(0);
      }
    }
  });

  it('every tower level has rate > 0', () => {
    for (const key of TOWER_KEYS) {
      for (let i = 0; i < TOWERS[key].levels.length; i++) {
        expect(TOWERS[key].levels[i].rate, `${key} L${i + 1} rate`).toBeGreaterThan(0);
      }
    }
  });

  it('bolt L1 build cost is 40', () => {
    expect(TOWERS.bolt.levels[0].cost).toBe(40);
  });

  it('pulse L1 build cost is 80', () => {
    expect(TOWERS.pulse.levels[0].cost).toBe(80);
  });

  it('spike L1 build cost is 100', () => {
    expect(TOWERS.spike.levels[0].cost).toBe(100);
  });

  it('spike L3 pierce is 4', () => {
    expect(TOWERS.spike.levels[2].pierce).toBe(4);
  });

  it('pulse L1 has AoE radius 30', () => {
    expect(TOWERS.pulse.levels[0].aoe).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------

describe('Config — ENEMIES', () => {
  const ENEMY_KINDS = ['square', 'hex', 'tri', 'boss'];

  it('there are exactly 4 enemy types', () => {
    expect(Object.keys(ENEMIES).length).toBe(4);
  });

  it('every enemy has hp > 0', () => {
    for (const kind of ENEMY_KINDS) {
      expect(ENEMIES[kind].hp, `${kind} hp`).toBeGreaterThan(0);
    }
  });

  it('every enemy has speed > 0', () => {
    for (const kind of ENEMY_KINDS) {
      expect(ENEMIES[kind].speed, `${kind} speed`).toBeGreaterThan(0);
    }
  });

  it('every enemy has value >= 0', () => {
    for (const kind of ENEMY_KINDS) {
      expect(ENEMIES[kind].value, `${kind} value`).toBeGreaterThanOrEqual(0);
    }
  });

  it('every enemy has damage >= 1', () => {
    for (const kind of ENEMY_KINDS) {
      expect(ENEMIES[kind].damage, `${kind} damage`).toBeGreaterThanOrEqual(1);
    }
  });

  it('boss has significantly more hp than other enemies', () => {
    const bossHp = ENEMIES.boss.hp;
    for (const kind of ['square', 'hex', 'tri']) {
      expect(bossHp).toBeGreaterThan(ENEMIES[kind].hp);
    }
  });

  it('boss damage is 5 (loses 5 lives on leak)', () => {
    expect(ENEMIES.boss.damage).toBe(5);
  });

  it('non-boss enemies deal 1 damage on leak', () => {
    for (const kind of ['square', 'hex', 'tri']) {
      expect(ENEMIES[kind].damage).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Economy constants
// ---------------------------------------------------------------------------

describe('Config — Economy', () => {
  it('STARTING_MONEY is 120', () => {
    expect(STARTING_MONEY).toBe(120);
  });

  it('STARTING_LIVES is 20', () => {
    expect(STARTING_LIVES).toBe(20);
  });

  it('WAVE_COOLDOWN is 6 seconds', () => {
    expect(WAVE_COOLDOWN).toBe(6.0);
  });
});

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

describe('Config — STATE', () => {
  it('STATE has the six expected states', () => {
    expect(STATE.INTRO).toBe('intro');
    expect(STATE.READY).toBe('ready');
    expect(STATE.RUNNING).toBe('running');
    expect(STATE.PAUSED).toBe('paused');
    expect(STATE.WON).toBe('won');
    expect(STATE.LOST).toBe('lost');
  });

  it('STATE is frozen (read-only)', () => {
    expect(Object.isFrozen(STATE)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

describe('Config — STORAGE', () => {
  it('STORAGE.BEST is neon-td:best', () => {
    expect(STORAGE.BEST).toBe('neon-td:best');
  });

  it('STORAGE.MUTED is neon-td:muted', () => {
    expect(STORAGE.MUTED).toBe('neon-td:muted');
  });

  it('STORAGE is frozen', () => {
    expect(Object.isFrozen(STORAGE)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Grid constants
// ---------------------------------------------------------------------------

describe('Config — Grid', () => {
  it('TILE is 16 pixels', () => {
    expect(TILE).toBe(16);
  });

  it('COLS is W / TILE = 30', () => {
    expect(COLS).toBe(Math.floor(W / TILE));
    expect(COLS).toBe(30);
  });

  it('ROWS is FIELD_H / TILE = 15', () => {
    const FIELD_H = H - HUD_H;
    expect(ROWS).toBe(Math.floor(FIELD_H / TILE));
    expect(ROWS).toBe(15);
  });
});
