// Property tests for Maze Runner maze logic.
//
// These tests assert invariants that must hold for ALL legal inputs.
// Failures here indicate a regression in the core maze guarantee (connectivity,
// BFS reachability, gem placement), not just a specific edge case.

import { describe, it } from 'vitest';
import fc from 'fast-check';
import {
  generateMaze,
  pickGems,
  bfsPath,
  N, E, S, W,
} from '../../public/games/maze-runner/maze.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Mulberry32 RNG (mirrors maze.js internals — only used for pickGems property).
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// BFS reachability: returns number of cells reachable from (0,0).
function countReachable(maze) {
  const { cols, rows, cells } = maze;
  const DC = { [N]: 0, [E]: 1, [S]: 0, [W]: -1 };
  const DR = { [N]: -1, [E]: 0, [S]: 1, [W]: 0 };
  const visited = new Uint8Array(cols * rows);
  const queue = [0];
  visited[0] = 1;
  while (queue.length > 0) {
    const idx = queue.shift();
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    for (const dir of [N, E, S, W]) {
      if (!(cells[idx] & dir)) continue;
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
  return visited.reduce((s, v) => s + v, 0);
}

// ---------------------------------------------------------------------------
// Property 1 — full connectivity for any seed and maze size
// ---------------------------------------------------------------------------

describe('Maze Runner — connectivity invariant', () => {
  it('for any string seed and any (cols, rows) in [3, 30], all cells are reachable from (0,0)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 16 }),
        fc.integer({ min: 3, max: 30 }),
        fc.integer({ min: 3, max: 30 }),
        (seed, cols, rows) => {
          const maze = generateMaze(cols, rows, seed);
          return countReachable(maze) === cols * rows;
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2 — bfsPath always finds a route from top-left to bottom-right
// ---------------------------------------------------------------------------

describe('Maze Runner — bfsPath always succeeds on connected maze', () => {
  it('for any seed and size, bfsPath(maze, 0, 0, cols-1, rows-1) returns a non-null path', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 16 }),
        fc.integer({ min: 3, max: 25 }),
        fc.integer({ min: 3, max: 25 }),
        (seed, cols, rows) => {
          const maze = generateMaze(cols, rows, seed);
          const path = bfsPath(maze, 0, 0, cols - 1, rows - 1);
          return path !== null;
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3 — pickGems respects count and excludes start/exit
// ---------------------------------------------------------------------------

describe('Maze Runner — pickGems invariants', () => {
  it('for any seed and count in [0, 10], pickGems returns at most count items', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 16 }),
        fc.integer({ min: 0, max: 10 }),
        (seed, count) => {
          const maze = generateMaze(11, 9, seed);
          // Use a fixed numeric rng seed to keep the test deterministic.
          const rng = mulberry32(42);
          const gems = pickGems(maze, 0, 0, 10, 8, count, rng);
          return gems.length <= count;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('for any seed and count, pickGems never returns the start cell (0,0)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 16 }),
        fc.integer({ min: 0, max: 10 }),
        (seed, count) => {
          const maze = generateMaze(11, 9, seed);
          const rng = mulberry32(42);
          const gems = pickGems(maze, 0, 0, 10, 8, count, rng);
          return gems.every(g => !(g.col === 0 && g.row === 0));
        },
      ),
      { numRuns: 200 },
    );
  });

  it('for any seed and count, pickGems never returns the exit cell (cols-1, rows-1)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 16 }),
        fc.integer({ min: 0, max: 10 }),
        (seed, count) => {
          const maze = generateMaze(11, 9, seed);
          const rng = mulberry32(42);
          const gems = pickGems(maze, 0, 0, 10, 8, count, rng);
          return gems.every(g => !(g.col === 10 && g.row === 8));
        },
      ),
      { numRuns: 200 },
    );
  });
});
