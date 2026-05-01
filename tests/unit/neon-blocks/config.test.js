import { describe, it, expect } from 'vitest';
import {
  gravityFrames,
  LINE_SCORES,
  TSPIN_SCORES,
  PC_SCORES,
  PIECES,
  P_O,
} from '../../../public/games/neon-blocks/config.js';

describe('gravityFrames', () => {
  it('level 1 is 60 frames per cell', () => {
    expect(gravityFrames(1)).toBe(60);
  });

  it('level 9 is 6 frames per cell', () => {
    expect(gravityFrames(9)).toBe(6);
  });

  it('level 19 is 1 frame per cell', () => {
    expect(gravityFrames(19)).toBe(1);
  });

  it('level 50 clamps to 1 frame per cell', () => {
    expect(gravityFrames(50)).toBe(1);
  });
});

describe('scoring tables', () => {
  it('LINE_SCORES has 5 entries (0-indexed: empty, single, double, triple, tetris)', () => {
    expect(LINE_SCORES).toHaveLength(5);
  });

  it('TSPIN_SCORES has 4 entries (0-indexed: no-line, single, double, triple)', () => {
    expect(TSPIN_SCORES).toHaveLength(4);
  });

  it('PC_SCORES has 5 entries (0-indexed: unused, single, double, triple, tetris)', () => {
    expect(PC_SCORES).toHaveLength(5);
  });
});

describe('PIECES — O piece', () => {
  it('all four rotations of P_O are identical (O does not rotate)', () => {
    const [r0, r1, r2, r3] = PIECES[P_O];
    expect(r1).toEqual(r0);
    expect(r2).toEqual(r0);
    expect(r3).toEqual(r0);
  });
});
