import { describe, it, expect, vi } from 'vitest';
import { NightGlowEffect } from './nightGlowEffect';

interface RecordedOrbDraw {
  y: number;
  alpha: number;
}

function createTrackingCtx(): { ctx: CanvasRenderingContext2D; draws: RecordedOrbDraw[] } {
  const draws: RecordedOrbDraw[] = [];
  const ctx = {
    globalAlpha: 1,
    drawImage: vi.fn((_img: CanvasImageSource, _x: number, y: number) => {
      expect(ctx.globalAlpha).toBeGreaterThanOrEqual(0);
      expect(ctx.globalAlpha).toBeLessThanOrEqual(1);
      draws.push({ y, alpha: ctx.globalAlpha });
    })
  } as unknown as CanvasRenderingContext2D;
  return { ctx, draws };
}

describe('NightGlowEffect', () => {
  it('renders HiDPI bokeh sprites, stays 100% steady across Day 9-11 (8.5 & 9.5), clamps non-negative alpha, and smoothly fades in/out', () => {
    const gradMock = { addColorStop: vi.fn() };
    const spriteCtxMock = {
      createRadialGradient: vi.fn().mockReturnValue(gradMock),
      fillStyle: '',
      fillRect: vi.fn()
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      spriteCtxMock as unknown as CanvasRenderingContext2D
    );

    const effect = new NightGlowEffect(12, [8, 9, 10], 1);
    expect(spriteCtxMock.fillRect).toHaveBeenLastCalledWith(0, 0, 32, 32);

    // Unchanged DPR is a no-op; 2x DPR rebuilds offscreen bokeh sprite at 64x64
    effect.setDpr(1);
    expect(spriteCtxMock.createRadialGradient).toHaveBeenCalledTimes(1);
    effect.setDpr(2);
    expect(spriteCtxMock.createRadialGradient).toHaveBeenCalledTimes(2);
    expect(spriteCtxMock.fillRect).toHaveBeenLastCalledWith(0, 0, 64, 64);

    vi.restoreAllMocks();

    const { ctx, draws } = createTrackingCtx();

    // Settled Day 8 (dayFloat 7) & Day 12 (dayFloat 11) -> strict zero bleed!
    effect.render(ctx, 400, 844, 7);
    effect.render(ctx, 400, 844, 11);
    expect(ctx.drawImage).not.toHaveBeenCalled();

    // Instant jump Day 8 (7) -> Day 9 (8) blooms smoothly from 0 -> steady state
    effect.render(ctx, 400, 844, 8, true, 1);
    expect(draws).toHaveLength(12);
    const frame1AlphaSum = draws.reduce((sum, d) => sum + d.alpha, 0);

    for (let stepIdx = 0; stepIdx < 85; stepIdx++) {
      draws.length = 0;
      effect.render(ctx, 400, 844, 9, true, 1.25);
    }
    const steadyAlphaSum = draws.reduce((sum, d) => sum + d.alpha, 0);
    expect(frame1AlphaSum).toBeGreaterThan(0);
    expect(frame1AlphaSum).toBeLessThan(steadyAlphaSum * 0.25);

    // Static comparison across contiguous span 8.0 -> 8.5 -> 9.0 -> 9.5 -> 10.0 proves exact steadiness (zero midpoint dip!)
    draws.length = 0;
    effect.render(ctx, 400, 844, 8, false);
    const staticAt8 = draws.reduce((sum, d) => sum + d.alpha, 0);
    draws.length = 0;
    effect.render(ctx, 400, 844, 8.5, false);
    const staticAt8Half = draws.reduce((sum, d) => sum + d.alpha, 0);
    draws.length = 0;
    effect.render(ctx, 400, 844, 9.5, false);
    const staticAt9Half = draws.reduce((sum, d) => sum + d.alpha, 0);
    draws.length = 0;
    effect.render(ctx, 400, 844, 10, false);
    const staticAt10 = draws.reduce((sum, d) => sum + d.alpha, 0);
    expect(staticAt8Half).toBeCloseTo(staticAt8, 10);
    expect(staticAt9Half).toBeCloseTo(staticAt8, 10);
    expect(staticAt10).toBeCloseTo(staticAt8, 10);

    // Jumping away Day 11 (10) -> Day 1 (0): orbs keep floating & pulsing while smoothly dissolving to 0!
    draws.length = 0;
    effect.render(ctx, 400, 844, 0, true, 1);
    expect(draws).toHaveLength(12);
    const fadeOutY0 = draws[0].y;
    const fadeOutAlpha1 = draws.reduce((sum, d) => sum + d.alpha, 0);
    expect(fadeOutAlpha1).toBeGreaterThan(0);
    expect(fadeOutAlpha1).toBeLessThan(staticAt10);

    draws.length = 0;
    effect.render(ctx, 400, 844, 0, true, 1);
    expect(draws[0].y).not.toBe(fadeOutY0);

    for (let stepIdx = 0; stepIdx < 90; stepIdx++) {
      effect.render(ctx, 400, 844, 0);
    }
    vi.mocked(ctx.drawImage).mockClear();
    effect.render(ctx, 400, 844, 0);
    expect(ctx.drawImage).not.toHaveBeenCalled();

    // Default constructor & empty activeDayIndices guard
    const defaultGlow = new NightGlowEffect();
    const emptyGlow = new NightGlowEffect(6, []);
    const { ctx: ctx2 } = createTrackingCtx();
    emptyGlow.render(ctx2, 400, 844, 9, true);
    expect(ctx2.drawImage).not.toHaveBeenCalled();
    defaultGlow.render(ctx2, 400, 844, 8);
    expect(ctx2.drawImage).toHaveBeenCalled();
  });
});
