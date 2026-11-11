import { describe, it, expect, vi } from 'vitest';
import { OnsenSteamEffect } from './onsenSteamEffect';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    globalAlpha: 1,
    drawImage: vi.fn()
  } as unknown as CanvasRenderingContext2D;
}

describe('OnsenSteamEffect', () => {
  it('builds radial gradient puff sprite when 2d context exists and skips/draws based on active day distance', () => {
    const gradMock = { addColorStop: vi.fn() };
    const spriteCtxMock = {
      createRadialGradient: vi.fn().mockReturnValue(gradMock),
      fillStyle: '',
      fillRect: vi.fn()
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      spriteCtxMock as unknown as CanvasRenderingContext2D
    );

    const effect = new OnsenSteamEffect(18, [5, 6]);
    expect(spriteCtxMock.createRadialGradient).toHaveBeenCalled();
    expect(gradMock.addColorStop).toHaveBeenCalledTimes(3);

    vi.restoreAllMocks();

    const ctx = createMockCtx();

    // Far away day (Day 1 -> index 0) -> no drawImage calls
    effect.render(ctx, 400, 844, 0, true);
    expect(ctx.drawImage).not.toHaveBeenCalled();

    // Active onsen day (Day 6 -> index 5) -> draws wisps & recycles yOffset > 135
    for (let step = 0; step < 60; step++) {
      effect.render(ctx, 400, 844, 5, true);
    }
    expect(ctx.drawImage).toHaveBeenCalled();

    // Static frame (isAdvancing = false)
    effect.render(ctx, 400, 844, 5.5, false);

    // Empty activeDayIndices short-circuits cleanly
    const emptyEffect = new OnsenSteamEffect();
    const zeroDaysEffect = new OnsenSteamEffect(4, []);
    const ctx2 = createMockCtx();
    zeroDaysEffect.render(ctx2, 400, 844, 5, true);
    expect(ctx2.drawImage).not.toHaveBeenCalled();
    emptyEffect.render(ctx2, 400, 844, 5);
    expect(ctx2.drawImage).toHaveBeenCalled();
  });
});
