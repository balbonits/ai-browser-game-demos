import { describe, it, expect } from 'vitest';
import { ticksDue } from '../../../public/games/idle-hoops-rpg/offline.js';

describe('ticksDue', () => {
  const TICK_MS = 30_000;
  const MAX = 86_400;

  it('returns 0 when elapsed is exactly 0', () => {
    const now = 1_000_000;
    expect(ticksDue(now, now, TICK_MS, MAX)).toBe(0);
  });

  it('returns 0 when elapsed is negative (clock skew)', () => {
    const now = 1_000_000;
    const future = now + 5_000; // lastTickAt is in the future
    expect(ticksDue(now, future, TICK_MS, MAX)).toBe(0);
  });

  it('returns 0 when elapsed is less than one tick', () => {
    const now = 1_000_000;
    expect(ticksDue(now, now - TICK_MS + 1, TICK_MS, MAX)).toBe(0);
  });

  it('returns 1 when elapsed equals exactly one tick', () => {
    const now = 1_000_000;
    expect(ticksDue(now, now - TICK_MS, TICK_MS, MAX)).toBe(1);
  });

  it('returns floor(elapsed / tickMs) when under cap', () => {
    const now = 1_000_000;
    const elapsed = TICK_MS * 7 + 5000; // 7 ticks + leftover
    expect(ticksDue(now, now - elapsed, TICK_MS, MAX)).toBe(7);
  });

  it('returns max when elapsed would exceed the cap', () => {
    const now = 1_000_000;
    const manyTicks = MAX + 999;
    const elapsed = TICK_MS * manyTicks;
    expect(ticksDue(now, now - elapsed, TICK_MS, MAX)).toBe(MAX);
  });

  it('returns max exactly when elapsed equals exactly max ticks', () => {
    const now = 1_000_000;
    expect(ticksDue(now, now - TICK_MS * MAX, TICK_MS, MAX)).toBe(MAX);
  });

  it('works correctly with test-mode TICK_MS=100', () => {
    const TICK_MS_TEST = 100;
    const MAX_TEST = 10_000;
    const now = 1_000_000;
    // 60_000ms / 100ms = 600 ticks
    expect(ticksDue(now, now - 60_000, TICK_MS_TEST, MAX_TEST)).toBe(600);
  });

  it('caps at maxTicks with test-mode values', () => {
    const TICK_MS_TEST = 100;
    const MAX_TEST = 500;
    const now = 1_000_000;
    // 1_000_000ms / 100ms = 10000 ticks > cap
    expect(ticksDue(now, now - 1_000_000, TICK_MS_TEST, MAX_TEST)).toBe(MAX_TEST);
  });
});
