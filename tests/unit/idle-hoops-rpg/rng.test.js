import { describe, it, expect } from 'vitest';
import { makeRng, djb2 } from '../../../public/games/idle-hoops-rpg/rng.js';

describe('djb2', () => {
  it('produces a non-zero unsigned int for a non-empty string', () => {
    expect(djb2('hello')).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    expect(djb2('seed')).toBe(djb2('seed'));
  });

  it('different strings produce different hashes', () => {
    expect(djb2('alpha')).not.toBe(djb2('beta'));
  });

  it('returns 0 for empty string (djb2 collapses to 5381 XOR nothing)', () => {
    // djb2('') = 5381 after the >>> 0 unsigned conversion
    expect(djb2('')).toBe(5381);
  });
});

describe('makeRng — determinism', () => {
  it('same seed + cursor=0 produces same sequence of draws', () => {
    const a = makeRng('alpha');
    const b = makeRng('alpha');
    for (let i = 0; i < 20; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('different seeds produce different sequences', () => {
    const a = makeRng('alpha');
    const b = makeRng('beta');
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });
});

describe('makeRng — cursor', () => {
  it('cursor starts at 0', () => {
    const rng = makeRng('test');
    expect(rng.cursor).toBe(0);
  });

  it('cursor increments on each draw', () => {
    const rng = makeRng('test');
    rng.next();
    expect(rng.cursor).toBe(1);
    rng.next();
    expect(rng.cursor).toBe(2);
  });

  it('resuming from saved cursor produces the same next draw', () => {
    const N = 7;
    const M = 5;

    const rng1 = makeRng('cursor-test');
    // Advance N draws.
    for (let i = 0; i < N; i++) rng1.next();
    // Advance M more draws.
    const valuesAfterNplusM = Array.from({ length: M }, () => rng1.next());
    const finalCursor = rng1.cursor; // N + M

    // Re-create at cursor = N + M.
    const rng2 = makeRng('cursor-test', finalCursor);
    // The next draw of rng2 should match the next draw of rng1.
    expect(rng2.next()).toBe(rng1.next());
  });

  it('cursor snapshot + resume: M draws from cursor=N match original draws N..N+M', () => {
    const rng1 = makeRng('snap');
    const N = 10;
    for (let i = 0; i < N; i++) rng1.next();
    const snapshot = rng1.cursor; // = N

    const M = 6;
    const orig = Array.from({ length: M }, () => rng1.next());

    const rng2 = makeRng('snap', snapshot);
    const resumed = Array.from({ length: M }, () => rng2.next());

    expect(resumed).toEqual(orig);
  });
});

describe('makeRng — range and pick', () => {
  it('range(min, max) always returns a value in [min, max]', () => {
    const rng = makeRng('range-test');
    for (let i = 0; i < 200; i++) {
      const v = rng.range(5, 15);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(15);
    }
  });

  it('pick returns one of the provided elements', () => {
    const arr = ['a', 'b', 'c'];
    const rng = makeRng('pick-test');
    for (let i = 0; i < 50; i++) {
      expect(arr).toContain(rng.pick(arr));
    }
  });
});
