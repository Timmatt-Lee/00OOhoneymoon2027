import { describe, it, expect, vi } from 'vitest';
import { SnowfallEffect } from './snowfallEffect';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    globalAlpha: 1,
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn()
  } as unknown as CanvasRenderingContext2D;
}

describe('SnowfallEffect', () => {
  it('renders tinted and pure-white snowflakes, wraps horizontal/vertical bounds, and resizes proportionally', () => {
    const ctx = createMockCtx();
    const effect = new SnowfallEffect(30, 100, 50);

    // Static render with tinted Biei snow
    effect.render(ctx, 100, 50, true, false);
    expect(ctx.fillStyle).toBe('rgba(255, 245, 250, 0.92)');

    // Advance many frames in a tiny box to exercise top/left/right wrap-around branches
    for (let step = 0; step < 300; step++) {
      effect.render(ctx, 12, 12, false);
    }
    expect(ctx.fillStyle).toBe('#FFFFFF');

    // Resize proportionally scales particle positions
    effect.resize(800, 600);
    effect.render(ctx, 800, 600, false, false);
    expect(ctx.arc).toHaveBeenCalled();
  });
});
