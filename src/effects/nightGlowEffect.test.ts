import { describe, it, expect, vi } from 'vitest';
import { NightGlowEffect } from './nightGlowEffect';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    globalAlpha: 1,
    drawImage: vi.fn()
  } as unknown as CanvasRenderingContext2D;
}

describe('NightGlowEffect', () => {
  it('renders HiDPI soft radial bokeh sprites on nocturnal days with strict < 1.0 bleed guard', () => {
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

    const ctx = createMockCtx();

    // Settled Day 8 (dayFloat 7, minDist === 1.0) & Day 12 (dayFloat 11, minDist === 1.0) -> strict zero bleed!
    effect.render(ctx, 400, 844, 7);
    effect.render(ctx, 400, 844, 11);
    expect(ctx.drawImage).not.toHaveBeenCalled();

    // Nocturnal days (Days 9..11 -> indices 8..10) -> renders advancing & static frames
    effect.render(ctx, 400, 844, 9, true, 1.25);
    effect.render(ctx, 400, 844, 10);
    effect.render(ctx, 400, 844, 9, false);
    expect(ctx.drawImage).toHaveBeenCalled();

    // Default constructor (null 2d context in jsdom) & empty activeDayIndices guard
    const defaultGlow = new NightGlowEffect();
    const emptyGlow = new NightGlowEffect(6, []);
    const ctx2 = createMockCtx();
    emptyGlow.render(ctx2, 400, 844, 9, true);
    expect(ctx2.drawImage).not.toHaveBeenCalled();
    defaultGlow.render(ctx2, 400, 844, 8);
    expect(ctx2.drawImage).toHaveBeenCalled();
  });
});
