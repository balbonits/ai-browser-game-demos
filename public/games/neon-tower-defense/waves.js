// Waves — sequencer that spawns enemies according to WAVES[].
//
// Each wave is a list of segments. A segment has { kind, count, gap, delay }
// where `count` enemies of `kind` are spawned `gap` seconds apart, and
// each segment starts `delay` seconds (default 1.0) after the previous
// segment finished its last spawn.
//
// Endless mode: when the player clears wave TOTAL_WAVES (12), wave indices
// keep going. Templates are cycled (idx → WAVES[(idx-1) % len]) and a per-
// wave multiplier scales HP / speed / spawn count / kill rewards. The
// difficulty ramp eventually outpaces any tower setup — score-attack mode.

import { WAVES, TOTAL_WAVES } from './config.js';
import { spawnEnemy, enemies } from './enemies.js';

const wave = {
  active: false,
  index: 0,           // wave number (1-based for display)
  templateIdx: 0,     // which entry in WAVES we're cycling through
  segIndex: 0,        // which segment of the current template
  spawned: 0,         // enemies spawned within the current segment
  segCount: 0,        // current segment's effective count (after count multiplier)
  timer: 0,           // countdown to next spawn
  segDelay: 0,        // countdown until segment begins
  finishedSpawning: false,
  mul: { hp: 1, speed: 1, count: 1, valueMul: 1 },
};

// Multiplier curve for endless mode. Tuned so by wave ~25 each scalar
// has roughly tripled, after which the run becomes a death-spiral —
// exactly the intended "how far can you push" loop.
function multipliers(idx) {
  if (idx <= TOTAL_WAVES) {
    return { hp: 1, speed: 1, count: 1, valueMul: 1 };
  }
  const over = idx - TOTAL_WAVES;
  return {
    hp: 1 + over * 0.30,
    speed: Math.min(1.4, 1 + over * 0.04),
    count: 1 + over * 0.08,
    valueMul: 1 + over * 0.25,
  };
}

function effectiveCount(seg) {
  return Math.max(1, Math.round(seg.count * wave.mul.count));
}

export function startWave(idx) {
  if (idx < 1) return false;
  wave.active = true;
  wave.index = idx;
  wave.templateIdx = (idx - 1) % WAVES.length;
  wave.segIndex = 0;
  wave.spawned = 0;
  wave.timer = 0;
  wave.segDelay = 0;
  wave.finishedSpawning = false;
  wave.mul = multipliers(idx);
  const segments = WAVES[wave.templateIdx];
  wave.segCount = segments[0] ? effectiveCount(segments[0]) : 0;
  return true;
}

export function resetWaves() {
  wave.active = false;
  wave.index = 0;
  wave.templateIdx = 0;
  wave.segIndex = 0;
  wave.spawned = 0;
  wave.segCount = 0;
  wave.timer = 0;
  wave.segDelay = 0;
  wave.finishedSpawning = false;
  wave.mul = { hp: 1, speed: 1, count: 1, valueMul: 1 };
}

export function isWaveActive() {
  return wave.active;
}

export function isWaveSpawningDone() {
  return wave.finishedSpawning;
}

export function currentWaveIndex() {
  return wave.index;
}

export function isEndless(idx = wave.index) {
  return idx > TOTAL_WAVES;
}

export function updateWaves(dt) {
  if (!wave.active) return;
  const segments = WAVES[wave.templateIdx];
  if (!segments || wave.segIndex >= segments.length) {
    wave.finishedSpawning = true;
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

  spawnEnemy(seg.kind, wave.mul);
  wave.spawned++;

  if (wave.spawned >= wave.segCount) {
    wave.segIndex++;
    wave.spawned = 0;
    if (wave.segIndex < segments.length) {
      const next = segments[wave.segIndex];
      wave.segDelay = next.delay ?? 1.0;
      wave.segCount = effectiveCount(next);
    } else {
      wave.finishedSpawning = true;
    }
    wave.timer = 0;
  } else {
    wave.timer = seg.gap;
  }
}
