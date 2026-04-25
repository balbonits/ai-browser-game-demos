// Waves — sequencer that spawns enemies according to WAVES[].
//
// Each wave is a list of segments. A segment has { kind, count, gap, delay }
// where `count` enemies of `kind` are spawned `gap` seconds apart, and
// each segment starts `delay` seconds (default 1.0) after the previous
// segment finished its last spawn.

import { WAVES } from './config.js';
import { spawnEnemy, enemies } from './enemies.js';

const wave = {
  active: false,
  index: 0,         // wave number (1-based for display)
  segIndex: 0,      // which segment of the current wave
  spawned: 0,       // enemies spawned within the current segment
  timer: 0,         // countdown to next spawn
  segDelay: 0,      // countdown until segment begins
  finishedSpawning: false,
};

export function startWave(idx) {
  if (idx < 1 || idx > WAVES.length) return false;
  wave.active = true;
  wave.index = idx;
  wave.segIndex = 0;
  wave.spawned = 0;
  wave.timer = 0;
  wave.segDelay = 0;
  wave.finishedSpawning = false;
  return true;
}

export function resetWaves() {
  wave.active = false;
  wave.index = 0;
  wave.segIndex = 0;
  wave.spawned = 0;
  wave.timer = 0;
  wave.segDelay = 0;
  wave.finishedSpawning = false;
}

export function isWaveActive() {
  // A wave is "active" while still spawning OR while enemies remain
  // alive on the field. Caller decides what to do when both spawning
  // is done AND the field is clear.
  return wave.active;
}

export function isWaveSpawningDone() {
  return wave.finishedSpawning;
}

export function currentWaveIndex() {
  return wave.index;
}

export function updateWaves(dt) {
  if (!wave.active) return;
  const segments = WAVES[wave.index - 1];
  if (!segments || wave.segIndex >= segments.length) {
    // All segments done → mark spawning done.
    wave.finishedSpawning = true;
    // Wave fully ends only when the field is clear of live enemies.
    if (enemies.length === 0) wave.active = false;
    return;
  }

  if (wave.segDelay > 0) {
    wave.segDelay -= dt;
    return;
  }

  const seg = segments[wave.segIndex];
  if (wave.timer > 0) {
    wave.timer -= dt;
    return;
  }

  // Spawn one enemy.
  spawnEnemy(seg.kind);
  wave.spawned++;

  if (wave.spawned >= seg.count) {
    // Segment complete — advance.
    wave.segIndex++;
    wave.spawned = 0;
    if (wave.segIndex < segments.length) {
      const next = segments[wave.segIndex];
      wave.segDelay = next.delay ?? 1.0;
    } else {
      wave.finishedSpawning = true;
    }
    wave.timer = 0;
  } else {
    wave.timer = seg.gap;
  }
}
