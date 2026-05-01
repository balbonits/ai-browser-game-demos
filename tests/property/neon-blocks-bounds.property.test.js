// Property test: no mino ever goes out of horizontal bounds or below the bottom.
//
// Invariant: after any sequence of legal moves, every mino satisfies
//   c >= 0, c < COLS, r < TOTAL_ROWS.
// (r < 0 is allowed — minos may be in the spawn buffer above the field.)

import { describe, it } from 'vitest';
import fc from 'fast-check';
import { Piece } from '../../public/games/neon-blocks/piece.js';
import { Board } from '../../public/games/neon-blocks/board.js';
import { Bag } from '../../public/games/neon-blocks/bag.js';
import { COLS } from '../../public/games/neon-blocks/config.js';
import { TOTAL_ROWS } from '../../public/games/neon-blocks/board.js';

describe('Neon Blocks — bounds invariant', () => {
  it('after any move sequence, no mino is out of horizontal or bottom bounds', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom('left', 'right', 'rotateCW', 'rotateCCW', 'softDrop'),
          { maxLength: 60 },
        ),
        (moves) => {
          // Use a constant seed so counterexamples are reproducible.
          const bag = new Bag('property-bounds-seed');
          const board = new Board();
          let piece = new Piece(bag.next());

          for (const m of moves) {
            switch (m) {
              case 'left':       piece.moveH(-1, board); break;
              case 'right':      piece.moveH(1, board);  break;
              case 'rotateCW':   piece.rotate(1, board); break;
              case 'rotateCCW':  piece.rotate(-1, board); break;
              case 'softDrop':   piece.moveDown(board);  break;
            }
          }

          for (const [c, r] of piece.minos()) {
            if (c < 0 || c >= COLS) return false;
            if (r >= TOTAL_ROWS) return false;
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });
});
