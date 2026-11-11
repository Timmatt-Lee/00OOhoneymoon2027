import { describe, it, expect, vi } from 'vitest';
import { NightGlowEffect } from './nightGlowEffect';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    globalAlpha: 1,
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn()
  } as unknown as CanvasRenderingContext2D;
}

describe('NightGlowEffect', () => {
  it('draws warm bokeh orbs near night-glow days and skips distant or empty day sets', () => {
    const ctx = createMockCtx();
    const effect = new NightGlowEffect();

    // Distant day (Day 1 -> index 0) -> skipped
    effect.render(ctx, 400, 844, 0);
    expect(ctx.arc).not.toHaveBeenCalled();

    // Night-glow day (Day 10 -> index 9) -> renders advancing & non-advancing frames
    effect.render(ctx, 400, 844, 9, true);
    effect.render(ctx, 400, 844, 9, false);
    expect(ctx.fillStyle).toBe('#FDE047');
    expect(ctx.arc).toHaveBeenCalled();

    // Empty activeDayIndices short-circuits cleanly
    const emptyGlow = new NightGlowEffect(6, []);
    const ctx2 = createMockCtx();
    emptyGlow.render(ctx2, 400, 844, 9, true);
    expect(ctx2.arc).not.toHaveBeenCalled();
  });
});
