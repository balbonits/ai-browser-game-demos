import { describe, it, expect } from 'vitest';
import { Piece } from '../../../public/games/neon-blocks/piece.js';
import { Board } from '../../../public/games/neon-blocks/board.js';
import { PIECES, P_T, P_I, P_S, COLS, SPAWN_ROWS } from '../../../public/games/neon-blocks/config.js';

// ---------------------------------------------------------------------------
// Spawn position
// ---------------------------------------------------------------------------

describe('Piece — spawn position', () => {
  it('fresh P_T piece has rot=0, col=3, row=0', () => {
    const p = new Piece(P_T);
    expect(p.rot).toBe(0);
    expect(p.col).toBe(3);
    expect(p.row).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// minos()
// ---------------------------------------------------------------------------

describe('Piece — minos()', () => {
  it('T piece rot=0 minos match PIECES[P_T][0] offsets from spawn', () => {
    const p = new Piece(P_T);
    const expected = PIECES[P_T][0].map(([c, r]) => [p.col + c, p.row + r]);
    expect(p.minos()).toEqual(expected);
  });

  it('S piece rot=1 minos match PIECES[P_S][1] offsets', () => {
    const p = new Piece(P_S);
    p.rot = 1;
    p.col = 4;
    p.row = 5;
    const expected = PIECES[P_S][1].map(([c, r]) => [4 + c, 5 + r]);
    expect(p.minos()).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// moveH
// ---------------------------------------------------------------------------

describe('Piece — moveH', () => {
  it('moveH(-1) from spawn moves col by -1 in clear space', () => {
    const board = new Board();
    const p = new Piece(P_T);
    const startCol = p.col;
    const moved = p.moveH(-1, board);
    expect(moved).toBe(true);
    expect(p.col).toBe(startCol - 1);
  });

  it('moveH(-1) against the left wall returns false and does not change col', () => {
    const board = new Board();
    const p = new Piece(P_T);
    // T rot=0 minos include offset col+0 (leftmost), so col=0 is the left wall.
    p.col = 0;
    const moved = p.moveH(-1, board);
    expect(moved).toBe(false);
    expect(p.col).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// moveDown
// ---------------------------------------------------------------------------

describe('Piece — moveDown', () => {
  it('moveDown succeeds in clear space', () => {
    const board = new Board();
    const p = new Piece(P_T);
    p.row = 5;
    const moved = p.moveDown(board);
    expect(moved).toBe(true);
    expect(p.row).toBe(6);
  });

  it('moveDown fails when grounded (piece at floor)', () => {
    const board = new Board();
    const p = new Piece(P_T);
    // T rot=0 lowest minos are at row+1. Place piece so row+1+1 >= TOTAL_ROWS.
    // TOTAL_ROWS = 22. T rot0 max r offset = 1. So piece.row + 1 + 1 = 22 → piece.row = 20.
    p.row = 20;
    const moved = p.moveDown(board);
    expect(moved).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// rotate
// ---------------------------------------------------------------------------

describe('Piece — rotate', () => {
  it('rotate(1) from rot=0 advances to rot=1 in clear space', () => {
    const board = new Board();
    const p = new Piece(P_T);
    p.row = 5;
    const ok = p.rotate(1, board);
    expect(ok).toBe(true);
    expect(p.rot).toBe(1);
  });

  it('rotate(1) sets wasLastActionRotation to true', () => {
    const board = new Board();
    const p = new Piece(P_T);
    p.row = 5;
    p.rotate(1, board);
    expect(p.wasLastActionRotation).toBe(true);
  });

  it('moveH clears wasLastActionRotation', () => {
    const board = new Board();
    const p = new Piece(P_T);
    p.row = 5;
    p.rotate(1, board);
    p.moveH(1, board);
    expect(p.wasLastActionRotation).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Wall-kick scenario (I-piece against right wall)
// ---------------------------------------------------------------------------

describe('Piece — wall kick', () => {
  it('I-piece at col=8 rot=0 rotates CW via a kick (lastKickIndex > 0)', () => {
    const board = new Board();
    const p = new Piece(P_I);
    // Directly set col=8: the I at rot=0 extends to col 11 which is OOB.
    // The piece is "logically" overhanging; rotate() tries kicks to find a valid spot.
    p.col = 8;
    p.row = 5;
    const ok = p.rotate(1, board);
    expect(ok).toBe(true);
    expect(p.lastKickIndex).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// ghostRow
// ---------------------------------------------------------------------------

describe('Piece — ghostRow', () => {
  it('ghostRow returns the bottom-most row that fits on an empty board', () => {
    const board = new Board();
    const p = new Piece(P_T);
    p.col = 4;
    p.row = 5;
    const ghost = p.ghostRow(board);
    // T rot=0 lowest mino offset is row+1. Bottom of board is TOTAL_ROWS-1=21.
    // piece.row + 1 <= 21 → piece.row <= 20 → ghost = 20.
    expect(ghost).toBe(20);
  });

  it('ghostRow is blocked by a locked cell', () => {
    const board = new Board();
    const p = new Piece(P_T);
    p.col = 4;
    p.row = 5;
    // T rot=0, col=4: minos at (5,row),(4,row+1),(5,row+1),(6,row+1).
    // Without obstruction, ghost row = 20.
    // Place a cell at (4,16). The ghost tries row g; it collides when checking g+1:
    // at g+1=16, mino at col=4 → (4,16) occupied → collision → ghost = 14.
    board.set(4, 16, 1);
    const ghost = p.ghostRow(board);
    expect(ghost).toBe(14);
  });
});

// ---------------------------------------------------------------------------
// tspinType
// ---------------------------------------------------------------------------

describe('Piece — tspinType', () => {
  it('returns null for non-T pieces', () => {
    const board = new Board();
    const p = new Piece(P_I);
    p.wasLastActionRotation = true;
    expect(p.tspinType(board)).toBeNull();
  });

  it('returns null when last action was movement (not rotation)', () => {
    const board = new Board();
    const p = new Piece(P_T);
    p.wasLastActionRotation = false;
    expect(p.tspinType(board)).toBeNull();
  });

  it('full T-spin: both front corners filled (rot=0) + at least one back corner filled', () => {
    // T piece at col=4, row=10, rot=0.
    // Center cx=5, cy=11. Corners: TL=(4,10), TR=(6,10), BL=(4,12), BR=(6,12).
    // Front for rot=0: TL(0), TR(1). Fill TL, TR, BL → 3 corners, both front → tspin.
    const board = new Board();
    board.set(4, 10, 1); // TL
    board.set(6, 10, 1); // TR
    board.set(4, 12, 1); // BL
    const p = new Piece(P_T);
    p.col = 4;
    p.row = 10;
    p.rot = 0;
    p.wasLastActionRotation = true;
    expect(p.tspinType(board)).toBe('tspin');
  });

  it('mini T-spin: only one front corner filled (rot=0), 3 corners total', () => {
    // Front for rot=0: TL(0), TR(1). Fill only TR + BL + BR → 3 corners, only one front → mini.
    const board = new Board();
    board.set(6, 10, 1); // TR (front)
    board.set(4, 12, 1); // BL (back)
    board.set(6, 12, 1); // BR (back)
    const p = new Piece(P_T);
    p.col = 4;
    p.row = 10;
    p.rot = 0;
    p.wasLastActionRotation = true;
    expect(p.tspinType(board)).toBe('mini');
  });

  it('no T-spin when fewer than 3 corners are filled', () => {
    // Only 2 corners filled — below the 3-corner threshold.
    const board = new Board();
    board.set(4, 10, 1); // TL
    board.set(6, 10, 1); // TR
    const p = new Piece(P_T);
    p.col = 4;
    p.row = 10;
    p.rot = 0;
    p.wasLastActionRotation = true;
    expect(p.tspinType(board)).toBeNull();
  });
});
