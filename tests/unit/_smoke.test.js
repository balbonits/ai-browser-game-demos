import { describe, it, expect } from 'vitest';

describe('smoke (unit tier)', () => {
  it('runs vitest and resolves ES modules', () => {
    expect(1 + 1).toBe(2);
  });
});
