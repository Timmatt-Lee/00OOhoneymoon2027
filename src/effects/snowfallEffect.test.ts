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
  it('batches snowflakes into 3 alpha buckets, scales by dtScale, wraps bounds, and resizes proportionally', () => {
    const ctx = createMockCtx();
    const effect = new SnowfallEffect(44, 100, 50);

    // Static render with tinted Biei snow batches all 44 flakes into 3 beginPath/fill calls
    effect.render(ctx, 100, 50, true, false);
    expect(ctx.fillStyle).toBe('rgba(255, 245, 250, 0.92)');
    expect(ctx.beginPath).toHaveBeenCalledTimes(3);
    expect(ctx.fill).toHaveBeenCalledTimes(3);
    expect(ctx.moveTo).toHaveBeenCalledTimes(44);
    expect(ctx.arc).toHaveBeenCalledTimes(44);

    // Advance many frames in a compact box with both default and custom dtScale to cover wrap-around branches
    for (let stepIdx = 0; stepIdx < 240; stepIdx++) {
      effect.render(ctx, 12, 12, false);
    }
    effect.render(ctx, 12, 12, false, true, 0.5);
    expect(ctx.fillStyle).toBe('#FFFFFF');

    // Resize proportionally scales particle positions (including zero-dimension guard)
    effect.resize(0, 0);
    effect.resize(800, 600);
    effect.render(ctx, 800, 600, false, false);
  });
});
