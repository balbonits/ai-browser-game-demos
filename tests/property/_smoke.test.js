import { describe, it } from 'vitest';
import fc from 'fast-check';

describe('smoke (property tier)', () => {
  it('fast-check is wired up — addition is commutative', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => a + b === b + a),
      { numRuns: 50 },
    );
  });
});
