import { describe, it, expect, vi } from 'vitest';
import { SnowfallEffect } from './snowfallEffect';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    globalAlpha: 1,
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn()
  } as unknown as CanvasRenderingContext2D;
}

describe('SnowfallEffect', () => {
  it('batches snowflakes into 3 alpha buckets, blends Biei snow tint smoothly, wraps bounds, and resizes proportionally', () => {
    const ctx = createMockCtx();
    const effect = new SnowfallEffect(44, 100, 50);

    // Static render on Biei Day 5 (dayFloat = 4) initializes at full tint
    effect.render(ctx, 100, 50, 4, false);
    expect(ctx.fillStyle).toBe('rgba(255, 245, 250, 0.92)');
    expect(ctx.beginPath).toHaveBeenCalledTimes(3);
    expect(ctx.fill).toHaveBeenCalledTimes(3);
    expect(ctx.moveTo).toHaveBeenCalledTimes(44);
    expect(ctx.arc).toHaveBeenCalledTimes(44);

    // Jumping from Day 5 (4) -> Day 1 (0) in live mode smoothly fades tint toward pure white
    effect.render(ctx, 100, 50, 0, true, 1);
    expect(ctx.fillStyle).toMatch(/^rgba\(255, 24\d, 25\d, 0\.9\d+\)$/);

    // Advance many frames in a compact box with both default and custom dtScale to cover wrap-around branches and converge to pure white
    for (let stepIdx = 0; stepIdx < 240; stepIdx++) {
      effect.render(ctx, 12, 12, 0);
    }
    effect.render(ctx, 12, 12, 0, true, 0.5);
    expect(ctx.fillStyle).toBe('rgb(255, 255, 255)');

    // Jumping back into Day 5 (4) fades tint smoothly back up to 1.0
    effect.render(ctx, 100, 50, 4, true, 1);
    expect(ctx.fillStyle).toMatch(/^rgba\(255, 25\d, 25\d, 0\.99\d*\)$/);
    for (let stepIdx = 0; stepIdx < 90; stepIdx++) {
      effect.render(ctx, 100, 50, 4, true, 1);
    }
    expect(ctx.fillStyle).toBe('rgba(255, 245, 250, 0.92)');

    // Resize proportionally scales particle positions (including zero-dimension guard)
    effect.resize(0, 0);
    effect.resize(800, 600);
    effect.render(ctx, 800, 600, 0, false);
    expect(ctx.fillStyle).toBe('rgb(255, 255, 255)');
  });
});
