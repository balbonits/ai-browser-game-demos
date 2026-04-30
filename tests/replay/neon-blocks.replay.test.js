// Neon Blocks replay test — board state contract.
//
// The driver is implemented inline here (not in tests/shared/replay-runner.js —
// that stub stays generalization-ready for when a second game's replay test lands).
//
// What this tests: given a fixed seed and fixed input sequence, the resulting
// board state (as a deterministic hash) matches a known snapshot. A broken
// snapshot means game behavior changed — intentionally or not.
//
// What this does NOT test: scoring, levels, or lock-delay timing. Those live
// in main.js's mutable closure state and aren't accessible from pure module
// simulation. Board state is the contract here.

import { describe, it, expect } from 'vitest';
import { Bag } from '../../public/games/neon-blocks/bag.js';
import { Board } from '../../public/games/neon-blocks/board.js';
import { Piece } from '../../public/games/neon-blocks/piece.js';

// djb2 over a Uint8Array — same algorithm as in bag.js, applied to board cells.
function djb2Cells(cells) {
  let h = 5381;
  for (let i = 0; i < cells.length; i++) {
    h = ((h << 5) + h) ^ cells[i];
    h |= 0;
  }
  return (h >>> 0).toString(16);
}

/**
 * Drive a sequence of actions through pure Board/Piece/Bag.
 *
 * Actions: 'left' | 'right' | 'rotateCW' | 'rotateCCW' | 'softDrop' | 'hardDrop' | 'hold'
 * (hold is a no-op here — hold state lives in main.js and is out of scope for this tier)
 *
 * On 'hardDrop': snap to ghost row, lock, spawn next piece from bag.
 *
 * Returns { boardHash, pieceTypeSequence }.
 */
function runReplay({ seed, actions }) {
  const bag = new Bag(seed);
  const board = new Board();
  let piece = new Piece(bag.next());
  const pieceTypeSequence = [piece.type];

  for (const action of actions) {
    switch (action) {
      case 'left':
        piece.moveH(-1, board);
        break;
      case 'right':
        piece.moveH(1, board);
        break;
      case 'rotateCW':
        piece.rotate(1, board);
        break;
      case 'rotateCCW':
        piece.rotate(-1, board);
        break;
      case 'softDrop':
        piece.moveDown(board);
        break;
      case 'hardDrop': {
        const ghostR = piece.ghostRow(board);
        piece.row = ghostR;
        board.lock(piece);
        const nextType = bag.next();
        piece = new Piece(nextType);
        pieceTypeSequence.push(nextType);
        break;
      }
      // 'hold' is a no-op — hold state lives in main.js and is out of scope here.
    }
  }

  return {
    boardHash: djb2Cells(board.cells),
    pieceTypeSequence,
  };
}

describe('Neon Blocks replay', () => {
  // If this snapshot changes intentionally (e.g., you changed piece definitions
  // or the Bag RNG), recompute by running the driver and updating the hash.
  // Never update this reflexively — investigate first.
  it('seed=alpha + 4 hard drops produces a stable board hash', () => {
    const result = runReplay({
      seed: 'alpha',
      actions: ['hardDrop', 'hardDrop', 'hardDrop', 'hardDrop'],
    });
    expect(result.boardHash).toBe('4c6dcee5');
  });

  it('seed=alpha + 4 hard drops is deterministic across two runs', () => {
    const r1 = runReplay({
      seed: 'alpha',
      actions: ['hardDrop', 'hardDrop', 'hardDrop', 'hardDrop'],
    });
    const r2 = runReplay({
      seed: 'alpha',
      actions: ['hardDrop', 'hardDrop', 'hardDrop', 'hardDrop'],
    });
    expect(r1.boardHash).toBe(r2.boardHash);
  });

  it('seed=alpha vs seed=beta with identical actions produces different board hashes', () => {
    const alpha = runReplay({
      seed: 'alpha',
      actions: ['hardDrop', 'hardDrop', 'hardDrop', 'hardDrop'],
    });
    const beta = runReplay({
      seed: 'beta',
      actions: ['hardDrop', 'hardDrop', 'hardDrop', 'hardDrop'],
    });
    expect(alpha.boardHash).not.toBe(beta.boardHash);
  });
});
