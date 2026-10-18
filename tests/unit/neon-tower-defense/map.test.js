// Unit tests for map.js — path geometry and buildable grid.
//
// map.js is pure math: no DOM, no canvas, no audio. The module computes
// path geometry at load time using only the PATH constants in config.js.

import { describe, it, expect } from 'vitest';
import {
  PATH_LEN, PATH_SEGMENTS, pointAt,
  buildable, tileCenter, pickTile,
} from '../../../public/games/neon-tower-defense/map.js';
import {
  PATH, TILE, COLS, ROWS, FIELD_TOP, NO_BUILD_RADIUS,
} from '../../../public/games/neon-tower-defense/config.js';

// ---------------------------------------------------------------------------
// PATH_SEGMENTS
// ---------------------------------------------------------------------------

describe('map — PATH_SEGMENTS', () => {
  it('has one fewer segment than PATH waypoints', () => {
    expect(PATH_SEGMENTS.length).toBe(PATH.length - 1);
  });

  it('every segment has a positive length', () => {
    for (const seg of PATH_SEGMENTS) {
      expect(seg.len).toBeGreaterThan(0);
    }
  });

  it('every segment unit vector has magnitude ~1', () => {
    for (const seg of PATH_SEGMENTS) {
      const mag = Math.hypot(seg.ux, seg.uy);
      expect(mag).toBeCloseTo(1.0, 10);
    }
  });

  it('PATH_LEN equals the sum of all segment lengths', () => {
    const sum = PATH_SEGMENTS.reduce((acc, s) => acc + s.len, 0);
    expect(PATH_LEN).toBeCloseTo(sum, 8);
  });

  it('PATH_LEN is positive', () => {
    expect(PATH_LEN).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// pointAt
// ---------------------------------------------------------------------------

describe('map — pointAt', () => {
  it('returns the first PATH waypoint at progress=0', () => {
    const p = pointAt(0);
    expect(p.x).toBeCloseTo(PATH[0].x, 8);
    expect(p.y).toBeCloseTo(PATH[0].y, 8);
  });

  it('returns the last PATH waypoint at progress=PATH_LEN', () => {
    const last = PATH[PATH.length - 1];
    const p = pointAt(PATH_LEN);
    expect(p.x).toBeCloseTo(last.x, 8);
    expect(p.y).toBeCloseTo(last.y, 8);
  });

  it('clamps negative progress to progress=0', () => {
    const p0 = pointAt(0);
    const pNeg = pointAt(-100);
    expect(pNeg.x).toBeCloseTo(p0.x, 8);
    expect(pNeg.y).toBeCloseTo(p0.y, 8);
  });

  it('clamps past-end progress to the last point', () => {
    const pEnd = pointAt(PATH_LEN);
    const pOver = pointAt(PATH_LEN + 9999);
    expect(pOver.x).toBeCloseTo(pEnd.x, 8);
    expect(pOver.y).toBeCloseTo(pEnd.y, 8);
  });

  it('is deterministic — same progress gives same result', () => {
    const d = PATH_LEN / 3;
    const p1 = pointAt(d);
    const p2 = pointAt(d);
    expect(p1.x).toBe(p2.x);
    expect(p1.y).toBe(p2.y);
  });

  it('returns an angle in radians', () => {
    const p = pointAt(PATH_LEN / 2);
    // Angle must be a finite number (NaN would indicate a degenerate segment).
    expect(Number.isFinite(p.a)).toBe(true);
  });

  it('midpoint of the first segment lies between first two PATH waypoints', () => {
    const seg = PATH_SEGMENTS[0];
    const mid = pointAt(seg.len / 2);
    const ax = PATH[0].x;
    const bx = PATH[1].x;
    expect(mid.x).toBeGreaterThanOrEqual(Math.min(ax, bx) - 0.001);
    expect(mid.x).toBeLessThanOrEqual(Math.max(ax, bx) + 0.001);
  });
});

// ---------------------------------------------------------------------------
// buildable grid
// ---------------------------------------------------------------------------

describe('map — buildable grid', () => {
  it('buildable has ROWS rows', () => {
    expect(buildable.length).toBe(ROWS);
  });

  it('each row has COLS columns', () => {
    for (let r = 0; r < ROWS; r++) {
      expect(buildable[r].length).toBe(COLS);
    }
  });

  it('every cell is a boolean', () => {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        expect(typeof buildable[r][c]).toBe('boolean');
      }
    }
  });

  it('tiles close to the path center are not buildable', () => {
    // The path's first horizontal run is at y=70. Find a tile whose center
    // falls within NO_BUILD_RADIUS of that y=70 line and x between 0..90.
    // x=48 (col 3, cx=56), y=70 is on the path.
    // Tile at col=3: cx=3*16+8=56, cy=FIELD_TOP + r*16+8. Find r where cy≈70.
    // cy = 22 + r*16 + 8 = 30 + r*16. For cy=70: r=(70-30)/16 = 2.5 → r=2 (cy=62) or r=3 (cy=78).
    // r=2: cy=62, dist to y=70 is 8 < NO_BUILD_RADIUS=18 → should be non-buildable.
    expect(buildable[2][3]).toBe(false);
  });

  it('tiles far from the path are buildable', () => {
    // Bottom-right corner tiles are far from the path (which doesn't reach there).
    // Check the last row, first few columns — should be clear of the path.
    // The path ends at y=200 (last segment) near x=360..500. So corner at
    // col=0, row=ROWS-1 should be buildable.
    // cy = FIELD_TOP + (ROWS-1)*TILE + TILE/2 = 22 + 14*16 + 8 = 254.
    // No path segment is near (0, 254) — buildable.
    expect(buildable[ROWS - 1][0]).toBe(true);
  });

  it('at least some tiles are buildable', () => {
    const anyBuildable = buildable.some(row => row.some(cell => cell === true));
    expect(anyBuildable).toBe(true);
  });

  it('at least some tiles are non-buildable (path blocks)', () => {
    const anyBlocked = buildable.some(row => row.some(cell => cell === false));
    expect(anyBlocked).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// tileCenter
// ---------------------------------------------------------------------------

describe('map — tileCenter', () => {
  it('returns the pixel center of tile (0, 0)', () => {
    const c = tileCenter(0, 0);
    expect(c.x).toBe(TILE / 2);
    expect(c.y).toBe(FIELD_TOP + TILE / 2);
  });

  it('returns the pixel center of tile (col, row)', () => {
    const col = 5;
    const row = 3;
    const c = tileCenter(col, row);
    expect(c.x).toBe(col * TILE + TILE / 2);
    expect(c.y).toBe(FIELD_TOP + row * TILE + TILE / 2);
  });
});

// ---------------------------------------------------------------------------
// pickTile
// ---------------------------------------------------------------------------

describe('map — pickTile', () => {
  it('returns null for x < 0', () => {
    expect(pickTile(-1, FIELD_TOP + 10)).toBeNull();
  });

  it('returns null for x >= W (30 * TILE = 480)', () => {
    expect(pickTile(COLS * TILE, FIELD_TOP + 10)).toBeNull();
  });

  it('returns null for y < FIELD_TOP', () => {
    expect(pickTile(10, FIELD_TOP - 1)).toBeNull();
  });

  it('returns null for y >= FIELD_TOP + ROWS * TILE', () => {
    expect(pickTile(10, FIELD_TOP + ROWS * TILE)).toBeNull();
  });

  it('maps a pixel inside a tile to the correct (c, r)', () => {
    // Pixel (16, FIELD_TOP + 0) → col 1, row 0.
    const t = pickTile(16, FIELD_TOP);
    expect(t).not.toBeNull();
    expect(t.c).toBe(1);
    expect(t.r).toBe(0);
  });

  it('tileCenter round-trips through pickTile for a valid tile', () => {
    const col = 10;
    const row = 7;
    const center = tileCenter(col, row);
    const back = pickTile(center.x, center.y);
    expect(back).not.toBeNull();
    expect(back.c).toBe(col);
    expect(back.r).toBe(row);
  });
});
