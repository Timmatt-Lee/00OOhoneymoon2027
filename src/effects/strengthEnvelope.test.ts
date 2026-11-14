import { describe, it, expect } from 'vitest';
import { FADE_TAU_MS, StrengthEnvelope, computeSpanTarget } from './strengthEnvelope';

describe('strengthEnvelope', () => {
  it('computes contiguous multi-day spatial targets with zero midpoint dip and clean boundary ramps', () => {
    expect(FADE_TAU_MS).toBe(220);

    const onsenSet = new Set([5, 6]);
    expect(computeSpanTarget(-0.2, onsenSet)).toBe(0);
    expect(computeSpanTarget(4, onsenSet)).toBe(0);
    expect(computeSpanTarget(4.25, onsenSet)).toBeCloseTo(0.25, 6);
    expect(computeSpanTarget(5, onsenSet)).toBe(1);
    expect(computeSpanTarget(5.5, onsenSet)).toBe(1);
    expect(computeSpanTarget(6, onsenSet)).toBe(1);
    expect(computeSpanTarget(6.4, onsenSet)).toBeCloseTo(0.6, 6);
    expect(computeSpanTarget(7, onsenSet)).toBe(0);
    expect(computeSpanTarget(11.2, onsenSet)).toBe(0);

    const glowSet = new Set([8, 9, 10]);
    expect(computeSpanTarget(7, glowSet)).toBe(0);
    expect(computeSpanTarget(7.5, glowSet)).toBeCloseTo(0.5, 6);
    expect(computeSpanTarget(8, glowSet)).toBe(1);
    expect(computeSpanTarget(8.5, glowSet)).toBe(1);
    expect(computeSpanTarget(9, glowSet)).toBe(1);
    expect(computeSpanTarget(9.5, glowSet)).toBe(1);
    expect(computeSpanTarget(10, glowSet)).toBe(1);
    expect(computeSpanTarget(10.5, glowSet)).toBeCloseTo(0.5, 6);
    expect(computeSpanTarget(11, glowSet)).toBe(0);
  });

  it('smoothly fades in from 0 -> 1, preserves mid-fade state on dtScale=0, fades out 1 -> 0, and snaps in static mode', () => {
    const env = new StrengthEnvelope([8, 9, 10]);

    // First call initializes immediately to spatialTarget (0 on Day 8 -> dayFloat 7)
    expect(env.step(7, true, 1)).toBe(0);

    // Instant jump to Day 9 (dayFloat 8) in live mode starts smooth exponential fade-in from 0
    const frame1 = env.step(8, true, 1);
    expect(frame1).toBeGreaterThan(0.05);
    expect(frame1).toBeLessThan(0.12);

    // dtScale = 0 preserves exact mid-fade strength during live resize repaints
    expect(env.step(8, true, 0)).toBe(frame1);

    // Advancing ~80 frames converges and snaps cleanly to exact 1
    let cur = frame1;
    for (let stepIdx = 0; stepIdx < 85; stepIdx++) {
      const next = env.step(8, true, 1);
      expect(next).toBeGreaterThanOrEqual(cur);
      cur = next;
    }
    expect(cur).toBe(1);

    // Moving across contiguous active span (8 -> 8.5 -> 9.5 -> 10) stays locked at 1
    expect(env.step(8.5, true, 1)).toBe(1);
    expect(env.step(9.5, true, 1)).toBe(1);
    expect(env.step(10, true, 1)).toBe(1);

    // Fractional spatialTarget (e.g. held drag at 7.5 -> target 0.5) converges smoothly without snapping to 0 or 1
    const midDrag = env.step(7.5, true, 1);
    expect(midDrag).toBeGreaterThan(0.9);
    expect(midDrag).toBeLessThan(1);

    // Static / reduced-motion frame (!isAdvancing) snaps immediately to spatialTarget
    expect(env.step(9, false, 1)).toBe(1);

    // Instant jump away to Day 1 (dayFloat 0) fades out smoothly to 0 and snaps cleanly at < 0.004
    const fadeOutFrame1 = env.step(0, true, 1);
    expect(fadeOutFrame1).toBeGreaterThan(0.88);
    expect(fadeOutFrame1).toBeLessThan(0.96);

    let outCur = fadeOutFrame1;
    for (let stepIdx = 0; stepIdx < 85; stepIdx++) {
      const next = env.step(0, true, 1);
      expect(next).toBeLessThanOrEqual(outCur);
      outCur = next;
    }
    expect(outCur).toBe(0);
  });
});
