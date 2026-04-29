// Playfield grid: 10×22 (10 visible cols, 20 visible rows + 2 spawn-buffer rows above).
//
// Cells are stored as ints: 0 = empty, 1–7 = piece color index.
// Row 0 and 1 are the invisible spawn buffer; row 2 is the top of the visible field.

import { COLS, ROWS, SPAWN_ROWS, PIECES } from './config.js';

export const TOTAL_ROWS = ROWS + SPAWN_ROWS; // 22

export class Board {
  constructor() {
    // Flat array, row-major. Index: row * COLS + col.
    this.cells = new Uint8Array(TOTAL_ROWS * COLS);
  }

  reset() {
    this.cells.fill(0);
  }

  // Get cell value (0 = empty).
  get(col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= TOTAL_ROWS) return 255; // out-of-bounds = solid
    return this.cells[row * COLS + col];
  }

  // Set cell value.
  set(col, row, val) {
    if (col < 0 || col >= COLS || row < 0 || row >= TOTAL_ROWS) return;
    this.cells[row * COLS + col] = val;
  }

  // Is a cell occupied (non-zero) or out-of-bounds?
  isOccupied(col, row) {
    return this.get(col, row) !== 0;
  }

  // Does placing `type` at rotation `rot` at (col, row) collide?
  collides(type, rot, col, row) {
    const minos = PIECES[type][rot];
    for (const [mc, mr] of minos) {
      const c = col + mc;
      const r = row + mr;
      // Out of bounds check.
      if (c < 0 || c >= COLS) return true;
      if (r >= TOTAL_ROWS) return true;
      // Above the buffer top is fine during spawn.
      if (r < 0) continue;
      if (this.cells[r * COLS + c] !== 0) return true;
    }
    return false;
  }

  // Lock a piece onto the board. Returns the piece type for coloring.
  lock(piece) {
    const minos = PIECES[piece.type][piece.rot];
    for (const [mc, mr] of minos) {
      const c = piece.col + mc;
      const r = piece.row + mr;
      if (r < 0 || r >= TOTAL_ROWS) continue;
      this.cells[r * COLS + c] = piece.type;
    }
  }

  // Find all full rows (all COLS cells non-zero). Returns row indices (in TOTAL_ROWS space).
  fullRows() {
    const full = [];
    for (let r = 0; r < TOTAL_ROWS; r++) {
      let filled = true;
      for (let c = 0; c < COLS; c++) {
        if (this.cells[r * COLS + c] === 0) { filled = false; break; }
      }
      if (filled) full.push(r);
    }
    return full;
  }

  // Clear specific rows and collapse the board downward.
  clearRows(rows) {
    // Sort descending so we remove from bottom upward.
    const sorted = [...rows].sort((a, b) => b - a);
    for (const r of sorted) {
      // Shift rows above down.
      for (let y = r; y > 0; y--) {
        for (let c = 0; c < COLS; c++) {
          this.cells[y * COLS + c] = this.cells[(y - 1) * COLS + c];
        }
      }
      // Clear topmost row.
      for (let c = 0; c < COLS; c++) {
        this.cells[c] = 0;
      }
    }
  }

  // Check if any mino of a piece is above the visible field (topping out).
  isAboveField(piece) {
    const minos = PIECES[piece.type][piece.rot];
    for (const [mc, mr] of minos) {
      const r = piece.row + mr;
      if (r < SPAWN_ROWS) return true;
    }
    return false;
  }
}
