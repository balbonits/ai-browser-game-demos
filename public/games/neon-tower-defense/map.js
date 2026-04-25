// Path geometry + buildable-tile lookup.
//
// The path is a polyline (PATH in config.js). At module load we precompute
// segment lengths and a flat total length so we can map a single "progress"
// scalar (0..totalLen) to an (x, y) point and a heading angle. Enemies use
// this to walk the path; the renderer uses it to draw the road.

import { PATH, PATH_W, TILE, COLS, ROWS, FIELD_TOP, NO_BUILD_RADIUS } from './config.js';

// --- Path math ---

const segments = [];
let totalLen = 0;
{
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i];
    const b = PATH[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    segments.push({ a, b, dx, dy, len, ux: dx / len, uy: dy / len });
    totalLen += len;
  }
}

export const PATH_LEN = totalLen;
export const PATH_SEGMENTS = segments;

// Map a progress scalar [0, totalLen] to canvas (x, y) plus a heading
// angle (radians, 0 = pointing right).
export function pointAt(progress) {
  let p = Math.max(0, progress);
  for (const seg of segments) {
    if (p <= seg.len) {
      return {
        x: seg.a.x + seg.ux * p,
        y: seg.a.y + seg.uy * p,
        a: Math.atan2(seg.uy, seg.ux),
      };
    }
    p -= seg.len;
  }
  // Past the end — clamp to the last point.
  const last = segments[segments.length - 1];
  return {
    x: last.b.x,
    y: last.b.y,
    a: Math.atan2(last.uy, last.ux),
  };
}

// Distance from point (px, py) to the closest point on the path. Used
// once at startup to compute the buildable mask (cheap; runs O(cols*rows)
// times O(segments)).
function distToPath(px, py) {
  let best = Infinity;
  for (const s of segments) {
    // Project point onto segment; clamp to [0, len].
    const t = ((px - s.a.x) * s.ux + (py - s.a.y) * s.uy);
    const tc = Math.max(0, Math.min(s.len, t));
    const cx = s.a.x + s.ux * tc;
    const cy = s.a.y + s.uy * tc;
    const d = Math.hypot(px - cx, py - cy);
    if (d < best) best = d;
  }
  return best;
}

// --- Build grid ---
//
// `buildable[r][c]` is true if the tile is buildable (clear of path,
// inside the field, no tower yet). Tower placement flips the cell to
// false when a tower is built.

export const buildable = [];
{
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const cx = c * TILE + TILE / 2;
      const cy = FIELD_TOP + r * TILE + TILE / 2;
      const d = distToPath(cx, cy);
      // Outside the field margin, or too close to the path → not buildable.
      const okPath = d >= NO_BUILD_RADIUS;
      row.push(okPath);
    }
    buildable.push(row);
  }
}

export function tileCenter(c, r) {
  return {
    x: c * TILE + TILE / 2,
    y: FIELD_TOP + r * TILE + TILE / 2,
  };
}

// Convert canvas (x, y) → grid (col, row). Returns null if outside.
export function pickTile(x, y) {
  const c = Math.floor(x / TILE);
  const r = Math.floor((y - FIELD_TOP) / TILE);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
  return { c, r };
}

// Re-export for convenience.
export { PATH };
