// Unit tests for block-fps/waves.js — wave scheduler state machine.
//
// updateWaves() calls spawnEnemy() which needs a THREE scene, so we skip it.
// What we DO test: startWave/resetWaves/markWaveCleared and all the boolean
// accessor contracts — these are pure state-machine transitions.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  startWave, resetWaves, markWaveCleared,
  isWaveActive, isWaveSpawningDone, isWaveCleared,
  currentWaveIndex,
} from '../../../public/games/block-fps/waves.js';
import { TOTAL_WAVES } from '../../../public/games/block-fps/config.js';

// Reset wave state before each test so tests are isolated.
beforeEach(() => {
  resetWaves();
});

// ---------------------------------------------------------------------------
// resetWaves
// ---------------------------------------------------------------------------

describe('waves — resetWaves', () => {
  it('after reset, wave is not active', () => {
    startWave(1);
    resetWaves();
    expect(isWaveActive()).toBe(false);
  });

  it('after reset, currentWaveIndex is 0', () => {
    startWave(3);
    resetWaves();
    expect(currentWaveIndex()).toBe(0);
  });

  it('after reset, isWaveCleared is false', () => {
    startWave(1);
    markWaveCleared();
    resetWaves();
    expect(isWaveCleared()).toBe(false);
  });

  it('after reset, isWaveSpawningDone is false', () => {
    resetWaves();
    expect(isWaveSpawningDone()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// startWave
// ---------------------------------------------------------------------------

describe('waves — startWave', () => {
  it('startWave(1) returns true and sets wave active', () => {
    const ok = startWave(1);
    expect(ok).toBe(true);
    expect(isWaveActive()).toBe(true);
  });

  it('currentWaveIndex returns the started wave index', () => {
    startWave(3);
    expect(currentWaveIndex()).toBe(3);
  });

  it('startWave(0) returns false (index < 1 is invalid)', () => {
    const ok = startWave(0);
    expect(ok).toBe(false);
    expect(isWaveActive()).toBe(false);
  });

  it('startWave with index <= TOTAL_WAVES uses a named wave template', () => {
    // Should succeed for all named waves.
    for (let i = 1; i <= TOTAL_WAVES; i++) {
      resetWaves();
      expect(startWave(i), `startWave(${i})`).toBe(true);
    }
  });

  it('startWave with index > TOTAL_WAVES succeeds (endless mode)', () => {
    const ok = startWave(TOTAL_WAVES + 5);
    expect(ok).toBe(true);
    expect(isWaveActive()).toBe(true);
  });

  it('isWaveCleared is false immediately after startWave', () => {
    startWave(1);
    expect(isWaveCleared()).toBe(false);
  });

  it('isWaveSpawningDone is false immediately after startWave', () => {
    startWave(1);
    expect(isWaveSpawningDone()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// markWaveCleared
// ---------------------------------------------------------------------------

describe('waves — markWaveCleared', () => {
  it('isWaveCleared returns true after markWaveCleared', () => {
    startWave(1);
    markWaveCleared();
    expect(isWaveCleared()).toBe(true);
  });

  it('markWaveCleared is idempotent — calling twice keeps isWaveCleared true', () => {
    startWave(1);
    markWaveCleared();
    markWaveCleared();
    expect(isWaveCleared()).toBe(true);
  });
});
