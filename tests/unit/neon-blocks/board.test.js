import { describe, it, expect } from 'vitest';
import { Board, TOTAL_ROWS } from '../../../public/games/neon-blocks/board.js';
import { COLS, ROWS, SPAWN_ROWS, P_T, P_I, P_O } from '../../../public/games/neon-blocks/config.js';
import { Piece } from '../../../public/games/neon-blocks/piece.js';

describe('Board — initial state', () => {
  it('fresh board has all cells zero', () => {
    const board = new Board();
    expect(board.cells.every(c => c === 0)).toBe(true);
  });
});

describe('Board — get', () => {
  it('get returns 255 for negative col (out of bounds)', () => {
    const board = new Board();
    expect(board.get(-1, 0)).toBe(255);
  });

  it('get returns 255 for col >= COLS (out of bounds)', () => {
    const board = new Board();
    expect(board.get(COLS, 0)).toBe(255);
  });

  it('get returns 255 for negative row (out of bounds)', () => {
    const board = new Board();
    expect(board.get(0, -1)).toBe(255);
  });

  it('get returns 255 for row >= TOTAL_ROWS (out of bounds)', () => {
    const board = new Board();
    expect(board.get(0, TOTAL_ROWS)).toBe(255);
  });

  it('get returns 0 for a valid empty cell', () => {
    const board = new Board();
    expect(board.get(0, 0)).toBe(0);
  });
});

describe('Board — collides', () => {
  it('collides returns true when piece would clip the left wall', () => {
    const board = new Board();
    // T-piece at col=-1, rot=0 — some minos land at col -1
    expect(board.collides(P_T, 0, -1, 5)).toBe(true);
  });

  it('collides returns true when piece overlaps a locked cell', () => {
    const board = new Board();
    board.set(5, 10, P_T);
    // T rot 0 at col=4, row=9: minos at [5,9],[4,10],[5,10],[6,10] — overlaps (5,10)
    expect(board.collides(P_T, 0, 4, 9)).toBe(true);
  });

  it('collides returns false in clear space', () => {
    const board = new Board();
    // T-piece in the middle of an empty board
    expect(board.collides(P_T, 0, 4, 5)).toBe(false);
  });

  it('collides returns true when piece clips the bottom boundary', () => {
    const board = new Board();
    // I-piece rot 1 at row TOTAL_ROWS-2: minos reach row TOTAL_ROWS-2+3 = TOTAL_ROWS+1
    expect(board.collides(P_I, 1, 2, TOTAL_ROWS - 1)).toBe(true);
  });
});

describe('Board — lock', () => {
  it('lock writes piece.type into the 4 mino cells', () => {
    const board = new Board();
    const piece = new Piece(P_T);
    piece.row = 10;
    piece.col = 4;
    board.lock(piece);
    // T rot 0 minos: [1,0],[0,1],[1,1],[2,1] relative to col=4, row=10
    // => (5,10), (4,11), (5,11), (6,11)
    expect(board.get(5, 10)).toBe(P_T);
    expect(board.get(4, 11)).toBe(P_T);
    expect(board.get(5, 11)).toBe(P_T);
    expect(board.get(6, 11)).toBe(P_T);
  });

  it('lock leaves other cells unchanged', () => {
    const board = new Board();
    const piece = new Piece(P_T);
    piece.row = 10;
    piece.col = 4;
    board.lock(piece);
    // Cell adjacent to the piece should be 0
    expect(board.get(3, 11)).toBe(0);
  });
});

describe('Board — fullRows', () => {
  it('returns empty array when no rows are full', () => {
    const board = new Board();
    expect(board.fullRows()).toEqual([]);
  });

  it('returns a single full row index when one row is completely filled', () => {
    const board = new Board();
    const r = TOTAL_ROWS - 1; // bottom row
    for (let c = 0; c < COLS; c++) board.set(c, r, 1);
    expect(board.fullRows()).toContain(r);
  });

  it('does not include a partially-filled row', () => {
    const board = new Board();
    const r = TOTAL_ROWS - 1;
    for (let c = 0; c < COLS - 1; c++) board.set(c, r, 1); // leave one empty
    expect(board.fullRows()).not.toContain(r);
  });

  it('returns indices in ascending order when multiple rows are full', () => {
    const board = new Board();
    const r1 = TOTAL_ROWS - 2;
    const r2 = TOTAL_ROWS - 1;
    for (let c = 0; c < COLS; c++) {
      board.set(c, r1, 1);
      board.set(c, r2, 1);
    }
    const full = board.fullRows();
    expect(full).toContain(r1);
    expect(full).toContain(r2);
    expect(full.indexOf(r1)).toBeLessThan(full.indexOf(r2));
  });
});

describe('Board — clearRows', () => {
  it('shifts rows above the cleared row down by 1', () => {
    const board = new Board();
    const bottom = TOTAL_ROWS - 1;
    const above = TOTAL_ROWS - 2;
    // Fill the bottom row completely (to qualify as full).
    for (let c = 0; c < COLS; c++) board.set(c, bottom, 1);
    // Put a distinctive marker in the row above.
    board.set(0, above, 7);
    board.clearRows([bottom]);
    // The marker from `above` should now be in `bottom` (shifted down by 1).
    expect(board.get(0, bottom)).toBe(7);
  });

  it('top row becomes empty after clear', () => {
    const board = new Board();
    const bottom = TOTAL_ROWS - 1;
    for (let c = 0; c < COLS; c++) board.set(c, bottom, 1);
    // Put something in row 0.
    board.set(3, 0, 5);
    board.clearRows([bottom]);
    expect(board.get(3, 0)).toBe(0);
  });

  it('clearing two adjacent rows shifts content above down by 2 and leaves no full rows', () => {
    const board = new Board();
    const r1 = TOTAL_ROWS - 2;
    const r2 = TOTAL_ROWS - 1;
    for (let c = 0; c < COLS; c++) {
      board.set(c, r1, 1);
      board.set(c, r2, 1);
    }
    board.set(0, r1 - 1, 7); // marker one row above the upper cleared row
    board.clearRows([r1, r2]);
    // Marker shifts down by exactly 2 (one for each cleared row below it).
    expect(board.get(0, r2)).toBe(7);
    // No phantom full rows — the cleared content must be gone.
    expect(board.fullRows()).toEqual([]);
  });

  it('clearing four adjacent rows (Tetris) shifts content above down by 4', () => {
    const board = new Board();
    const top = TOTAL_ROWS - 4;
    for (let r = top; r < TOTAL_ROWS; r++) {
      for (let c = 0; c < COLS; c++) board.set(c, r, 1);
    }
    board.set(0, top - 1, 7); // marker just above the cleared region
    board.clearRows([top, top + 1, top + 2, top + 3]);
    expect(board.get(0, TOTAL_ROWS - 1)).toBe(7);
    expect(board.fullRows()).toEqual([]);
  });

  it('clearing non-adjacent rows preserves and shifts the in-between content', () => {
    const board = new Board();
    const upper = TOTAL_ROWS - 4; // 18
    const lower = TOTAL_ROWS - 2; // 20 — gap at 19, untouched 21
    for (let c = 0; c < COLS; c++) {
      board.set(c, upper, 1);
      board.set(c, lower, 1);
    }
    board.set(0, upper - 1, 7); // row 17 col 0
    board.set(0, upper + 1, 8); // row 19 col 0 (between the cleared rows)
    board.set(0, lower + 1, 9); // row 21 col 0 (below the cleared rows)
    board.clearRows([upper, lower]);
    // Row 21 (below both clears) is unchanged.
    expect(board.get(0, TOTAL_ROWS - 1)).toBe(9);
    // Row 19 marker shifts down by 1 (one cleared row below it: row 20).
    expect(board.get(0, TOTAL_ROWS - 2)).toBe(8);
    // Row 17 marker shifts down by 2 (two cleared rows below it).
    expect(board.get(0, TOTAL_ROWS - 3)).toBe(7);
    expect(board.fullRows()).toEqual([]);
  });
});

describe('Board — isAboveField', () => {
  it('returns true when a mino is in spawn-buffer row (r < SPAWN_ROWS)', () => {
    const board = new Board();
    // T-piece at row=0, rot=0: mino [1,0] → row=0, which is < SPAWN_ROWS(2).
    const piece = new Piece(P_T);
    piece.row = 0;
    expect(board.isAboveField(piece)).toBe(true);
  });

  it('returns false when all minos are in the visible field', () => {
    const board = new Board();
    const piece = new Piece(P_T);
    // T rot 0: minos at row+0 and row+1. Set row=2 so min mino row = 2 = SPAWN_ROWS.
    piece.row = SPAWN_ROWS;
    expect(board.isAboveField(piece)).toBe(false);
  });
});
