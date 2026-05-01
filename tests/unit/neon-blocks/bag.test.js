import { describe, it, expect } from 'vitest';
import { Bag, djb2 } from '../../../public/games/neon-blocks/bag.js';
import { P_I, P_O, P_T, P_S, P_Z, P_J, P_L } from '../../../public/games/neon-blocks/config.js';

const ALL_TYPES = new Set([P_I, P_O, P_T, P_S, P_Z, P_J, P_L]);

describe('Bag — 7-bag distribution', () => {
  it('a pull of 7 from a fresh seeded bag contains exactly the 7 piece types', () => {
    const bag = new Bag('test-seed');
    const pulled = Array.from({ length: 7 }, () => bag.next());
    expect(new Set(pulled)).toEqual(ALL_TYPES);
  });

  it('a second pull of 7 also contains exactly the 7 piece types', () => {
    const bag = new Bag('test-seed-2');
    // consume first bag
    for (let i = 0; i < 7; i++) bag.next();
    const pulled = Array.from({ length: 7 }, () => bag.next());
    expect(new Set(pulled)).toEqual(ALL_TYPES);
  });
});

describe('Bag — determinism', () => {
  it('same seed produces identical first-7 sequence', () => {
    const bagA = new Bag('alpha');
    const bagB = new Bag('alpha');
    const seqA = Array.from({ length: 7 }, () => bagA.next());
    const seqB = Array.from({ length: 7 }, () => bagB.next());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds produce different first-7 sequences with high probability', () => {
    // 'alpha' and 'omega' hash to very different values — astronomically unlikely to collide.
    const bagA = new Bag('alpha');
    const bagB = new Bag('omega');
    const seqA = Array.from({ length: 7 }, () => bagA.next());
    const seqB = Array.from({ length: 7 }, () => bagB.next());
    expect(seqA).not.toEqual(seqB);
  });
});

describe('Bag — peek', () => {
  it('peek(5) does not consume — subsequent next() returns the peeked first piece', () => {
    const bag = new Bag('peek-test');
    const peeked = bag.peek(5);
    const first = bag.next();
    expect(first).toBe(peeked[0]);
  });

  it('peek(n) for n > current queue length lazily extends the queue', () => {
    const bag = new Bag('extend-test');
    // Drain initial queue (14 pre-filled pieces) to near empty.
    for (let i = 0; i < 13; i++) bag.next();
    // Queue now has 1 left. peek(10) must extend it.
    const peeked = bag.peek(10);
    expect(peeked).toHaveLength(10);
    // All peeked values are valid piece types.
    for (const p of peeked) {
      expect(ALL_TYPES.has(p)).toBe(true);
    }
  });
});

describe('djb2', () => {
  it('djb2("") returns 5381 (the initial hash constant)', () => {
    expect(djb2('')).toBe(5381);
  });

  it('djb2("a") is a stable deterministic value', () => {
    // This value is the result of one djb2 iteration on char code 97.
    // If it ever changes, the seeded Bag behavior has changed.
    expect(djb2('a')).toBe(177604);
  });
});
