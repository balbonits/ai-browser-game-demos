// Tetromino model: SRS rotation with wall kicks, T-spin detection.
//
// A Piece tracks its type, current rotation state, and board position (col, row)
// of the piece's bounding-box top-left corner. The board position is in playfield
// coordinates (0,0 = top-left of the 10×22 logical grid including spawn buffer).

import {
  PIECES, KICKS_JLSTZ, KICKS_I,
  P_I, P_T,
  COLS,
} from './config.js';

export class Piece {
  constructor(type) {
    this.type = type;
    this.rot = 0;
    // Spawn position: centered horizontally, above the visible field.
    this.col = Math.floor((COLS - 4) / 2); // 3
    this.row = 0; // top of spawn buffer
    this.wasLastActionRotation = false;
    this.lastKickIndex = 0; // which kick offset was used (0 = no kick)
  }

  // Return the 4 mino [col, row] positions for the current rotation.
  minos() {
    return minosFor(this.type, this.rot, this.col, this.row);
  }

  // Try to rotate CW (+1) or CCW (-1). Returns true on success, false if all kicks failed.
  rotate(dir, board) {
    const fromRot = this.rot;
    const toRot = (this.rot + (dir > 0 ? 1 : 3)) % 4;
    const key = `${fromRot}->${toRot}`;
    const kicks = this.type === P_I ? KICKS_I[key] : KICKS_JLSTZ[key];

    for (let i = 0; i < kicks.length; i++) {
      const [dx, dy] = kicks[i];
      const nc = this.col + dx;
      const nr = this.row + dy;
      if (!board.collides(this.type, toRot, nc, nr)) {
        this.col = nc;
        this.row = nr;
        this.rot = toRot;
        this.wasLastActionRotation = true;
        this.lastKickIndex = i;
        return true;
      }
    }
    return false; // rotation aborted
  }

  // Move left (-1) or right (+1). Returns true if moved.
  moveH(dir, board) {
    if (!board.collides(this.type, this.rot, this.col + dir, this.row)) {
      this.col += dir;
      this.wasLastActionRotation = false;
      return true;
    }
    return false;
  }

  // Move down by 1. Returns true if moved.
  moveDown(board) {
    if (!board.collides(this.type, this.rot, this.col, this.row + 1)) {
      this.row += 1;
      this.wasLastActionRotation = false;
      return true;
    }
    return false;
  }

  // Return true if the piece is touching the floor/stack below.
  isGrounded(board) {
    return board.collides(this.type, this.rot, this.col, this.row + 1);
  }

  // Compute the ghost piece row — lowest valid position.
  ghostRow(board) {
    let r = this.row;
    while (!board.collides(this.type, this.rot, this.col, r + 1)) r++;
    return r;
  }

  // T-spin detection (3-corner rule, call after locking).
  // Returns 'tspin' | 'mini' | null. Only meaningful for P_T pieces.
  tspinType(board) {
    if (this.type !== P_T) return null;
    if (!this.wasLastActionRotation) return null;

    // Center of the T piece depends on rotation.
    // The T's center mino is always the [1,1] cell of the 3x3 bounding box.
    const cx = this.col + 1;
    const cy = this.row + 1;

    // Four diagonal corners: TL, TR, BL, BR
    const corners = [
      [cx - 1, cy - 1], // TL
      [cx + 1, cy - 1], // TR
      [cx - 1, cy + 1], // BL
      [cx + 1, cy + 1], // BR
    ];

    // A corner is "filled" if it's out-of-bounds or a locked board cell.
    const filled = corners.map(([c, r]) => board.isOccupied(c, r));
    const filledCount = filled.filter(Boolean).length;

    if (filledCount < 3) return null;

    // "Front" corners depend on rotation direction (which side the T points).
    // rot 0: T points up   → front = TL(0), TR(1)
    // rot 1: T points right → front = TR(1), BR(3)
    // rot 2: T points down  → front = BL(2), BR(3)
    // rot 3: T points left  → front = TL(0), BL(2)
    const frontCorners = {
      0: [0, 1], // TL, TR
      1: [1, 3], // TR, BR
      2: [2, 3], // BL, BR
      3: [0, 2], // TL, BL
    };
    const [f0, f1] = frontCorners[this.rot];
    const frontFilled = filled[f0] && filled[f1];

    // Full T-spin: both front corners filled (and at least one back).
    if (frontFilled) return 'tspin';

    // Mini: at least one front corner filled but not both.
    return 'mini';
  }
}

// --- Utility: compute mino positions without a Piece instance ---

export function minosFor(type, rot, col, row) {
  return PIECES[type][rot].map(([c, r]) => [col + c, row + r]);
}
