import { describe, it, expect } from 'vitest';
import { createPrng } from './prng';

describe('createPrng (Mulberry32)', () => {
  it('produces deterministic sequences in [0, 1) for identical seeds', () => {
    const randA = createPrng(20270302);
    const randB = createPrng(20270302);
    const randC = createPrng(20270307);

    const seqA = Array.from({ length: 20 }, () => randA());
    const seqB = Array.from({ length: 20 }, () => randB());
    const seqC = Array.from({ length: 20 }, () => randC());

    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    for (const val of seqA) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });
});
