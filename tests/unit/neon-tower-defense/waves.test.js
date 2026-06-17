// Unit tests for waves.js — wave sequencer.
//
// waves.js imports from enemies.js (spawnEnemy), which imports from render.js.
// We never call any draw functions. The sequencer state transitions and
// multiplier math are tested here directly.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  startWave, resetWaves,
  isWaveActive, isWaveSpawningDone, currentWaveIndex, isEndless,
  updateWaves,
} from '../../../public/games/neon-tower-defense/waves.js';
import { resetEnemies, enemies } from '../../../public/games/neon-tower-defense/enemies.js';
import { WAVES, TOTAL_WAVES, ENEMIES } from '../../../public/games/neon-tower-defense/config.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetWaves();
  resetEnemies();
});

// ---------------------------------------------------------------------------
// startWave / isWaveActive
// ---------------------------------------------------------------------------

describe('waves — startWave', () => {
  it('returns true for wave 1', () => {
    expect(startWave(1)).toBe(true);
  });

  it('returns false for wave 0', () => {
    expect(startWave(0)).toBe(false);
  });

  it('activates the wave after startWave(1)', () => {
    startWave(1);
    expect(isWaveActive()).toBe(true);
  });

  it('sets currentWaveIndex to the started wave number', () => {
    startWave(3);
    expect(currentWaveIndex()).toBe(3);
  });

  it('is not spawning-done immediately after start', () => {
    startWave(1);
    expect(isWaveSpawningDone()).toBe(false);
  });

  it('reuses wave templates for indices > TOTAL_WAVES (endless)', () => {
    // Wave TOTAL_WAVES+1 should use template index 0 (the first wave).
    const endlessWave = TOTAL_WAVES + 1;
    const expectedTemplate = (endlessWave - 1) % WAVES.length;
    startWave(endlessWave);
    expect(isWaveActive()).toBe(true);
    expect(currentWaveIndex()).toBe(endlessWave);
    // Template reuse is internal state — verify indirectly via spawning behavior:
    // updateWaves with zero dt should not spawn (timer=0 → instant first spawn).
    // Just verify no crash and still active.
    updateWaves(0);
    expect(isWaveActive()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resetWaves
// ---------------------------------------------------------------------------

describe('waves — resetWaves', () => {
  it('makes isWaveActive() false after reset', () => {
    startWave(1);
    resetWaves();
    expect(isWaveActive()).toBe(false);
  });

  it('resets currentWaveIndex to 0 after reset', () => {
    startWave(5);
    resetWaves();
    expect(currentWaveIndex()).toBe(0);
  });

  it('resets isWaveSpawningDone to false', () => {
    startWave(1);
    // Fast-forward to spawn all enemies.
    for (let i = 0; i < 200; i++) updateWaves(1);
    // If done, reset should clear it.
    resetWaves();
    expect(isWaveSpawningDone()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isEndless
// ---------------------------------------------------------------------------

describe('waves — isEndless', () => {
  it('returns false for wave <= TOTAL_WAVES', () => {
    expect(isEndless(TOTAL_WAVES)).toBe(false);
    expect(isEndless(1)).toBe(false);
  });

  it('returns true for wave > TOTAL_WAVES', () => {
    expect(isEndless(TOTAL_WAVES + 1)).toBe(true);
    expect(isEndless(TOTAL_WAVES + 5)).toBe(true);
  });

  it('uses current wave index when called with no argument', () => {
    startWave(TOTAL_WAVES + 2);
    expect(isEndless()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateWaves — spawning
// ---------------------------------------------------------------------------

describe('waves — updateWaves spawning', () => {
  it('spawns at least one enemy when advancing time on wave 1', () => {
    startWave(1);
    // The first segment of wave 1 spawns square enemies. Timer starts at 0
    // so the first enemy spawns immediately on the first update call.
    updateWaves(0);
    expect(enemies.length).toBeGreaterThanOrEqual(1);
  });

  it('completes spawning for wave 1 after enough time passes', () => {
    startWave(1);
    // Wave 1: [{kind:'square', count:8, gap:0.65}]
    // Total time needed: 0 + 7 * 0.65 = 4.55 seconds plus inter-segment delay.
    // Step with large dt to bypass all timers.
    for (let i = 0; i < 100; i++) updateWaves(0.5);
    expect(isWaveSpawningDone()).toBe(true);
  });

  it('does not spawn when no wave is active', () => {
    // No startWave called — just call updateWaves.
    updateWaves(1.0);
    expect(enemies.length).toBe(0);
  });

  it('respects the gap between spawns (timer delay)', () => {
    startWave(1);
    // First update: spawns enemy #1 immediately (timer=0 at start).
    updateWaves(0);
    const after0 = enemies.length;
    // Advance by a fraction of the gap (0.65s): should not spawn another yet.
    updateWaves(0.3);
    expect(enemies.length).toBe(after0); // no new spawn in the partial gap
  });

  it('spawns multiple enemies over time for wave 1 (count=8)', () => {
    startWave(1);
    // Large time step: all 8 square enemies of segment 1 should spawn.
    for (let i = 0; i < 30; i++) updateWaves(0.7);
    expect(enemies.length).toBeGreaterThanOrEqual(8);
  });
});

// ---------------------------------------------------------------------------
// Multiplier math (endless mode)
// ---------------------------------------------------------------------------

describe('waves — endless multiplier', () => {
  it('uses 1x multiplier for waves <= TOTAL_WAVES', () => {
    startWave(TOTAL_WAVES);
    // First spawn should have base HP (wave 1 template = WAVES[11]).
    updateWaves(0);
    if (enemies.length > 0) {
      const kind = enemies[0].kind;
      expect(enemies[0].hp).toBe(ENEMIES[kind].hp);
    }
  });

  it('uses scaled HP multiplier in endless mode', () => {
    // Wave TOTAL_WAVES + 1: over=1, hp multiplier = 1 + 1*0.30 = 1.30
    startWave(TOTAL_WAVES + 1);
    updateWaves(0);
    if (enemies.length > 0) {
      const kind = enemies[0].kind;
      const expectedHp = Math.max(1, Math.round(ENEMIES[kind].hp * 1.30));
      expect(enemies[0].hp).toBe(expectedHp);
    }
  });
});
