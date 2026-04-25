// Obstacle spawning, physics, rendering, and AABB collision.
//
// An obstacle entry is a single hit-rect. A "pattern" can spawn multiple
// entries at once — side-by-side, stacked, or scaled — to create variety
// from the 3 base sprites (rock / cactus / crate).

import {
  W, OBSTACLE_GROUND_Y, OBSTACLE_TYPES, OBSTACLE_BY_NAME, OBSTACLE_PATTERNS,
  SPEED_START, SPEED_MAX,
} from './config.js';
import { loadImage } from './assets.js';

export const obstacles = [];
let images = [];

export async function loadObstacleAssets() {
  images = await Promise.all(OBSTACLE_TYPES.map((t) => loadImage(t.sprite)));
}

export function resetObstacles() {
  obstacles.length = 0;
}

// Spawn one pattern (1-N pieces) off-screen right and return the seconds
// until the next spawn. Gap shrinks as speed ramps; multi-piece groups
// add a small extra delay so they don't crowd the screen.
export function spawnObstacle(speed) {
  const pattern = OBSTACLE_PATTERNS[Math.floor(Math.random() * OBSTACLE_PATTERNS.length)];
  const groupX = W + 8;
  let stackY = 0; // accumulated hitbox height for `stack: true` pieces

  for (const piece of pattern) {
    const type = OBSTACLE_BY_NAME[piece.name];
    const scale = piece.scale ?? 1;
    const w = Math.round(type.hit.w * scale);
    const h = Math.round(type.hit.h * scale);

    let y;
    if (piece.stack) {
      // Sit on top of the accumulated stack.
      y = OBSTACLE_GROUND_Y - stackY - h;
      stackY += h;
    } else {
      y = OBSTACLE_GROUND_Y - h;
      stackY = h; // reset; subsequent stacked pieces stack on this one
    }

    obstacles.push({
      type,
      scale,
      x: groupX + (piece.dx ?? 0),
      y,
      w,
      h,
    });
  }

  // Spacing rhythm — mix three gap "moods" so the run feels like waves of
  // pressure and breathing room instead of a metronome:
  //   tight    (~15%): punchy back-to-back obstacles
  //   standard (~60%): the default cadence
  //   long     (~25%): an open beat to recover and read the next pattern
  // The speed ratio still tightens each bucket toward its lower bound so
  // the late game stays demanding — long breathers shrink modestly so
  // they remain long-ish even at SPEED_MAX.
  const ratio = Math.min(1, (speed - SPEED_START) / (SPEED_MAX - SPEED_START));
  const r = Math.random();
  let lo, hi, speedShrink;
  if (r < 0.15) {
    lo = 0.55; hi = 0.85; speedShrink = 1.0;   // tight
  } else if (r < 0.40) {
    lo = 1.7;  hi = 2.6;  speedShrink = 0.5;   // long breather
  } else {
    lo = 0.9;  hi = 1.5;  speedShrink = 1.0;   // standard
  }
  const gap = hi - (hi - lo) * ratio * speedShrink;
  const jitter = Math.random() * 0.2;
  const groupExtra = pattern.length > 1 ? 0.2 : 0;
  return gap + jitter + groupExtra;
}

export function updateObstacles(dt, speed) {
  for (const o of obstacles) o.x -= speed * dt;
  // In-place filter so we keep the exported array reference stable.
  let w = 0;
  for (let r = 0; r < obstacles.length; r++) {
    if (obstacles[r].x + obstacles[r].w > -8) obstacles[w++] = obstacles[r];
  }
  obstacles.length = w;
}

export function drawObstacles(ctx) {
  for (const o of obstacles) {
    const img = images[o.type.idx];
    if (!img) continue;
    const t = o.type;
    const s = o.scale;
    // The hit box's source-pixel offset (hit.ox, hit.oy) is exactly where
    // the visible art begins inside the sprite. Anchoring the sprite so
    // those pixels land at (o.x, o.y) makes the visible drawing match the
    // hit box 1:1 — no `padBottom` slop, no off-by-padding-row drift.
    const sx = o.x - t.hit.ox * s;
    const sy = o.y - t.hit.oy * s;
    ctx.drawImage(
      img,
      Math.round(sx),
      Math.round(sy),
      Math.round(t.spriteW * s),
      Math.round(t.spriteH * s),
    );
  }
}

export function aabb(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}
