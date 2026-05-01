// Maze Runner replay test — cells-array hash snapshot.
//
// The contract: given a fixed seed and fixed maze dimensions, the cells array
// hashes to a stable value. A broken snapshot means maze generation behavior
// changed — intentionally or not.
//
// Why hash, not compare raw cells? The cells array (99–551 bytes) is too large
// to paste as a literal, and a hash is just as deterministic. Same algorithm
// (djb2) as used elsewhere in the repo.

import { describe, it, expect } from 'vitest';
import { generateMaze } from '../../public/games/maze-runner/maze.js';

// djb2 over a Uint8Array — portable, same as the neon-blocks replay test.
function djb2Cells(cells) {
  let h = 5381;
  for (let i = 0; i < cells.length; i++) {
    h = ((h << 5) + h) ^ cells[i];
    h |= 0;
  }
  return (h >>> 0).toString(16);
}

// Seed 'alpha', 11×9 (Small difficulty preset).
// This snapshot was recorded from the first green run and must not be changed
// without a corresponding change to generateMaze (algorithm, RNG, or constants).
const ALPHA_HASH = 'd165bee5';

describe('Maze Runner replay', () => {
  it("seed='alpha' 11×9 cells array matches the locked snapshot", () => {
    const maze = generateMaze(11, 9, 'alpha');
    expect(djb2Cells(maze.cells)).toBe(ALPHA_HASH);
  });

  it("seed='alpha' 11×9 is deterministic across two runs", () => {
    const m1 = generateMaze(11, 9, 'alpha');
    const m2 = generateMaze(11, 9, 'alpha');
    expect(djb2Cells(m1.cells)).toBe(djb2Cells(m2.cells));
  });

  it("seed='beta' 11×9 produces a different hash than seed='alpha'", () => {
    const alpha = djb2Cells(generateMaze(11, 9, 'alpha').cells);
    const beta  = djb2Cells(generateMaze(11, 9, 'beta').cells);
    expect(alpha).not.toBe(beta);
  });
});
