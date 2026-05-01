// Unit tests for maze.js — pure logic, no DOM, no canvas, no audio.
//
// Tests: generateMaze, bfsPath, pickGems, and the direction constants.
// maze.js has no side-effects on import (no document calls, no window refs),
// so it is safe to import directly in Vitest.

import { describe, it, expect } from 'vitest';
import {
  generateMaze,
  pickGems,
  bfsPath,
  N, E, S, W,
} from '../../../public/games/maze-runner/maze.js';

// ---------------------------------------------------------------------------
// Direction constants
// ---------------------------------------------------------------------------

describe('Direction bit constants', () => {
  it('N is 1', () => expect(N).toBe(1));
  it('E is 2', () => expect(E).toBe(2));
  it('S is 4', () => expect(S).toBe(4));
  it('W is 8', () => expect(W).toBe(8));

  it('all four constants are distinct powers of two', () => {
    const bits = [N, E, S, W];
    const unique = new Set(bits);
    expect(unique.size).toBe(4);
    for (const b of bits) {
      expect(b & (b - 1)).toBe(0); // exactly one bit set
    }
  });
});

// ---------------------------------------------------------------------------
// generateMaze — determinism
// ---------------------------------------------------------------------------

describe('generateMaze — determinism', () => {
  it('same seed + same dimensions produces identical cells array', () => {
    const m1 = generateMaze(11, 9, 'alpha');
    const m2 = generateMaze(11, 9, 'alpha');
    expect(Array.from(m1.cells)).toEqual(Array.from(m2.cells));
  });

  it('different string seeds produce different cells arrays', () => {
    const m1 = generateMaze(11, 9, 'seed-aaa');
    const m2 = generateMaze(11, 9, 'seed-zzz');
    // At least one byte must differ — pick two seeds known to diverge.
    const differ = Array.from(m1.cells).some((v, i) => v !== m2.cells[i]);
    expect(differ).toBe(true);
  });

  it('different numeric seeds produce different cells arrays', () => {
    const m1 = generateMaze(11, 9, 1);
    const m2 = generateMaze(11, 9, 999999);
    const differ = Array.from(m1.cells).some((v, i) => v !== m2.cells[i]);
    expect(differ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateMaze — spanning tree properties
// ---------------------------------------------------------------------------

describe('generateMaze — spanning tree', () => {
  it('number of carved passages equals cols*rows - 1 (perfect maze)', () => {
    // In a perfect maze, the carved passages form a spanning tree:
    // exactly (cols*rows - 1) undirected edges. Each undirected edge is
    // recorded on both endpoints, so counting one-directional open walls
    // and dividing by 2 gives the edge count.
    const cols = 11, rows = 9;
    const { cells } = generateMaze(cols, rows, 'spanning-tree-check');
    let openBits = 0;
    for (let i = 0; i < cells.length; i++) {
      // popcount of 4-bit value.
      const v = cells[i];
      openBits += ((v >> 3) & 1) + ((v >> 2) & 1) + ((v >> 1) & 1) + (v & 1);
    }
    const edges = openBits / 2;
    expect(edges).toBe(cols * rows - 1);
  });

  it('every cell is reachable from (0,0) following open walls — small maze', () => {
    const cols = 7, rows = 5;
    const maze = generateMaze(cols, rows, 'reach-check');
    const visited = new Uint8Array(cols * rows);
    const queue = [0];
    visited[0] = 1;
    const DC = { [N]: 0, [E]: 1, [S]: 0, [W]: -1 };
    const DR = { [N]: -1, [E]: 0, [S]: 1, [W]: 0 };
    while (queue.length > 0) {
      const idx = queue.shift();
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      for (const dir of [N, E, S, W]) {
        if (!(maze.cells[idx] & dir)) continue;
        const nc = c + DC[dir];
        const nr = r + DR[dir];
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        const nidx = nr * cols + nc;
        if (!visited[nidx]) {
          visited[nidx] = 1;
          queue.push(nidx);
        }
      }
    }
    const reachable = visited.reduce((s, v) => s + v, 0);
    expect(reachable).toBe(cols * rows);
  });

  it('every cell is reachable from (0,0) — medium maze', () => {
    const cols = 19, rows = 13;
    const maze = generateMaze(cols, rows, 'medium-reach');
    const visited = new Uint8Array(cols * rows);
    const queue = [0];
    visited[0] = 1;
    const DC = { [N]: 0, [E]: 1, [S]: 0, [W]: -1 };
    const DR = { [N]: -1, [E]: 0, [S]: 1, [W]: 0 };
    while (queue.length > 0) {
      const idx = queue.shift();
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      for (const dir of [N, E, S, W]) {
        if (!(maze.cells[idx] & dir)) continue;
        const nc = c + DC[dir];
        const nr = r + DR[dir];
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        const nidx = nr * cols + nc;
        if (!visited[nidx]) {
          visited[nidx] = 1;
          queue.push(nidx);
        }
      }
    }
    expect(visited.reduce((s, v) => s + v, 0)).toBe(cols * rows);
  });
});

// ---------------------------------------------------------------------------
// generateMaze — return shape
// ---------------------------------------------------------------------------

describe('generateMaze — return shape', () => {
  it('returns the correct cols and rows values', () => {
    const maze = generateMaze(11, 9, 'shape-test');
    expect(maze.cols).toBe(11);
    expect(maze.rows).toBe(9);
  });

  it('cells array length equals cols * rows', () => {
    const maze = generateMaze(11, 9, 'cells-len');
    expect(maze.cells.length).toBe(11 * 9);
  });

  it('numericSeed is a non-negative 32-bit integer', () => {
    const maze = generateMaze(11, 9, 'seed-shape');
    expect(Number.isInteger(maze.numericSeed)).toBe(true);
    expect(maze.numericSeed).toBeGreaterThanOrEqual(0);
    expect(maze.numericSeed).toBeLessThanOrEqual(0xFFFFFFFF);
  });

  it('seed property echoes back the string seed that was passed in', () => {
    const maze = generateMaze(11, 9, 'my-seed');
    expect(maze.seed).toBe('my-seed');
  });
});

// ---------------------------------------------------------------------------
// bfsPath
// ---------------------------------------------------------------------------

describe('bfsPath', () => {
  it('returns a non-null path from top-left to bottom-right', () => {
    const cols = 11, rows = 9;
    const maze = generateMaze(cols, rows, 'bfs-basic');
    const path = bfsPath(maze, 0, 0, cols - 1, rows - 1);
    expect(path).not.toBeNull();
  });

  it('path is contiguous: each consecutive pair differs by exactly one cell', () => {
    const cols = 11, rows = 9;
    const maze = generateMaze(cols, rows, 'bfs-contiguous');
    const path = bfsPath(maze, 0, 0, cols - 1, rows - 1);
    for (let i = 1; i < path.length; i++) {
      const dc = Math.abs(path[i].col - path[i - 1].col);
      const dr = Math.abs(path[i].row - path[i - 1].row);
      expect(dc + dr).toBe(1); // exactly one step
    }
  });

  it('each transition in the path has the corresponding wall bit set on both cells', () => {
    const cols = 11, rows = 9;
    const maze = generateMaze(cols, rows, 'bfs-walls');
    const path = bfsPath(maze, 0, 0, cols - 1, rows - 1);
    for (let i = 1; i < path.length; i++) {
      const from = path[i - 1];
      const to   = path[i];
      const dc = to.col - from.col;
      const dr = to.row - from.row;
      // Determine the wall bit for this direction.
      let wallFromTo, wallToFrom;
      if (dr === -1) { wallFromTo = N; wallToFrom = S; }
      else if (dr === 1) { wallFromTo = S; wallToFrom = N; }
      else if (dc === 1) { wallFromTo = E; wallToFrom = W; }
      else { wallFromTo = W; wallToFrom = E; }

      const fromIdx = from.row * cols + from.col;
      const toIdx   = to.row   * cols + to.col;
      expect(maze.cells[fromIdx] & wallFromTo).toBeTruthy();
      expect(maze.cells[toIdx]   & wallToFrom).toBeTruthy();
    }
  });

  it('path starts at the start cell and ends at the exit cell', () => {
    const cols = 11, rows = 9;
    const maze = generateMaze(cols, rows, 'bfs-endpoints');
    const path = bfsPath(maze, 0, 0, cols - 1, rows - 1);
    expect(path[0]).toEqual({ col: 0, row: 0 });
    expect(path[path.length - 1]).toEqual({ col: cols - 1, row: rows - 1 });
  });

  it('bfsPath(maze, 0, 0, 0, 0) returns a single-element path at the origin', () => {
    const maze = generateMaze(11, 9, 'trivial-path');
    const path = bfsPath(maze, 0, 0, 0, 0);
    expect(path).toEqual([{ col: 0, row: 0 }]);
  });

  it('returns null when no passage connects start to an isolated destination', () => {
    // Construct a maze with all walls closed — no passages at all.
    // In this case bfsPath cannot traverse anywhere beyond the start.
    const cols = 5, rows = 5;
    const fakeMaze = {
      cols,
      rows,
      // All cells = 0 means all walls closed. The only reachable cell is (0,0)
      // itself. Destination (4,4) is unreachable.
      cells: new Uint8Array(cols * rows),
    };
    const path = bfsPath(fakeMaze, 0, 0, cols - 1, rows - 1);
    expect(path).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// pickGems
// ---------------------------------------------------------------------------

// Mulberry32 RNG inline (mirrors maze.js internals — used for a reproducible rng).
function makeMulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('pickGems', () => {
  it('count=0 returns an empty array', () => {
    const maze = generateMaze(11, 9, 'gems-zero');
    const rng  = makeMulberry32(42);
    const gems = pickGems(maze, 0, 0, 10, 8, 0, rng);
    expect(gems).toEqual([]);
  });

  it('returns at most count items', () => {
    const maze = generateMaze(11, 9, 'gems-count');
    const rng  = makeMulberry32(7);
    const gems = pickGems(maze, 0, 0, 10, 8, 5, rng);
    expect(gems.length).toBeLessThanOrEqual(5);
  });

  it('never returns the start cell', () => {
    const maze = generateMaze(11, 9, 'gems-no-start');
    const rng  = makeMulberry32(13);
    const gems = pickGems(maze, 0, 0, 10, 8, 10, rng);
    for (const g of gems) {
      expect(g.col === 0 && g.row === 0).toBe(false);
    }
  });

  it('never returns the exit cell', () => {
    const maze = generateMaze(11, 9, 'gems-no-exit');
    const rng  = makeMulberry32(99);
    const gems = pickGems(maze, 0, 0, 10, 8, 10, rng);
    for (const g of gems) {
      expect(g.col === 10 && g.row === 8).toBe(false);
    }
  });

  it('every returned cell is a dead-end (exactly one open wall)', () => {
    const cols = 11, rows = 9;
    const maze = generateMaze(cols, rows, 'gems-dead-ends');
    const rng  = makeMulberry32(55);
    const gems = pickGems(maze, 0, 0, cols - 1, rows - 1, 10, rng);
    for (const g of gems) {
      const idx = g.row * cols + g.col;
      const wallBits = maze.cells[idx];
      const openCount = [N, E, S, W].filter(d => wallBits & d).length;
      expect(openCount).toBe(1);
    }
  });

  it('pickGems with large count still works when fewer dead ends exist', () => {
    // 3×3 maze has a small number of dead ends — requesting 999 should
    // just return however many dead ends are available (excluding start/exit).
    const cols = 3, rows = 3;
    const maze = generateMaze(cols, rows, 'gems-few-deadends');
    const rng  = makeMulberry32(77);
    const gems = pickGems(maze, 0, 0, cols - 1, rows - 1, 999, rng);
    // No gem should be start or exit.
    for (const g of gems) {
      expect(g.col === 0 && g.row === 0).toBe(false);
      expect(g.col === cols - 1 && g.row === rows - 1).toBe(false);
    }
  });
});
