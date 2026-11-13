import { describe, it, expect, vi } from 'vitest';
import { OnsenSteamEffect } from './onsenSteamEffect';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    globalAlpha: 1,
    drawImage: vi.fn()
  } as unknown as CanvasRenderingContext2D;
}

describe('OnsenSteamEffect', () => {
  it('sizes HiDPI radial puff sprite by dpr, enforces strict < 1.0 bleed guard, and scales by dtScale', () => {
    const gradMock = { addColorStop: vi.fn() };
    const spriteCtxMock = {
      createRadialGradient: vi.fn().mockReturnValue(gradMock),
      fillStyle: '',
      fillRect: vi.fn()
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      spriteCtxMock as unknown as CanvasRenderingContext2D
    );

    const effect = new OnsenSteamEffect(18, [5, 6], 1);
    expect(spriteCtxMock.fillRect).toHaveBeenLastCalledWith(0, 0, 112, 112);

    // Unchanged DPR is a no-op; changed DPR rebuilds offscreen sprite at 2x (224x224)
    effect.setDpr(1);
    expect(spriteCtxMock.createRadialGradient).toHaveBeenCalledTimes(1);
    effect.setDpr(2);
    expect(spriteCtxMock.createRadialGradient).toHaveBeenCalledTimes(2);
    expect(spriteCtxMock.fillRect).toHaveBeenLastCalledWith(0, 0, 224, 224);

    vi.restoreAllMocks();

    const ctx = createMockCtx();

    // Settled adjacent day (Day 5 Biei -> dayFloat 4, minDist === 1.0) -> strict zero bleed!
    effect.render(ctx, 400, 844, 4, true);
    // Settled Day 8 Lake Toya (dayFloat 7, minDist === 1.0) -> strict zero bleed!
    effect.render(ctx, 400, 844, 7, true);
    expect(ctx.drawImage).not.toHaveBeenCalled();

    // Active onsen days (Day 6 -> 5, Day 7 -> 6) -> draws wisps & recycles yOffset > 135
    for (let stepIdx = 0; stepIdx < 60; stepIdx++) {
      effect.render(ctx, 400, 844, 5, true, 1.5);
    }
    effect.render(ctx, 400, 844, 6);
    expect(ctx.drawImage).toHaveBeenCalled();

    // Static frame (isAdvancing = false)
    effect.render(ctx, 400, 844, 5.5, false);

    // Default constructor (null 2d context in jsdom) & empty activeDayIndices guard
    const defaultEffect = new OnsenSteamEffect();
    const zeroDaysEffect = new OnsenSteamEffect(0, []);
    const ctx2 = createMockCtx();
    zeroDaysEffect.render(ctx2, 400, 844, 5, true);
    expect(ctx2.drawImage).not.toHaveBeenCalled();
    defaultEffect.render(ctx2, 400, 844, 5);
    expect(ctx2.drawImage).toHaveBeenCalled();
  });
});
