// Waves — sequencer for block-fps. Each wave has a `count` budget,
// a `spawnEvery` interval, a pool of enemy `kinds`, and a `max`
// concurrent-alive cap. Wave clears when budget is exhausted AND the
// alive-count is zero. Endless mode loops the last entry with multipliers.

import { WAVES, TOTAL_WAVES, endlessMultipliers } from './config.js';
import { spawnEnemy, aliveCount } from './enemies.js';

const wave = {
  active: false,
  index: 0,
  spawned: 0,
  budget: 0,
  spawnTimer: 0,
  template: null,
  mul: { hp: 1, count: 1 },
  finishedSpawning: false,
};

export function startWave(idx) {
  if (idx < 1) return false;
  // Pick template: clamp into the WAVES list, then loop the last for
  // endless waves so mid-late game patterns keep recurring.
  const templateIdx = idx <= TOTAL_WAVES ? idx - 1 : TOTAL_WAVES - 1;
  const tpl = WAVES[templateIdx];
  if (!tpl) return false;
  const mul = endlessMultipliers(idx);
  const budget = Math.max(1, Math.round(tpl.count * mul.count));

  wave.active = true;
  wave.index = idx;
  wave.template = tpl;
  wave.mul = mul;
  wave.spawned = 0;
  wave.budget = budget;
  wave.spawnTimer = 0.5; // brief delay before first spawn
  wave.finishedSpawning = false;
  return true;
}

export function resetWaves() {
  wave.active = false;
  wave.index = 0;
  wave.template = null;
  wave.spawned = 0;
  wave.budget = 0;
  wave.spawnTimer = 0;
  wave.finishedSpawning = false;
  wave.mul = { hp: 1, count: 1 };
}

export function isWaveActive() { return wave.active; }
export function isWaveSpawningDone() { return wave.finishedSpawning; }
export function currentWaveIndex() { return wave.index; }

export function updateWaves(dt) {
  if (!wave.active) return;
  if (wave.spawned >= wave.budget) {
    wave.finishedSpawning = true;
    if (aliveCount() === 0) wave.active = false;
    return;
  }

  wave.spawnTimer -= dt;
  if (wave.spawnTimer > 0) return;

  // Respect the concurrency cap so the screen doesn't pile up.
  if (aliveCount() >= wave.template.max) {
    wave.spawnTimer = 0.25;
    return;
  }

  const pool = wave.template.kinds;
  const kind = pool[(Math.random() * pool.length) | 0];
  spawnEnemy(kind, wave.mul);
  wave.spawned++;
  wave.spawnTimer = wave.template.spawnEvery;
}
