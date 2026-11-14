import { describe, it, expect, vi } from 'vitest';
import { OnsenSteamEffect } from './onsenSteamEffect';

interface RecordedDraw {
  y: number;
  alpha: number;
}

function createTrackingCtx(): { ctx: CanvasRenderingContext2D; draws: RecordedDraw[] } {
  const draws: RecordedDraw[] = [];
  const ctx = {
    globalAlpha: 1,
    drawImage: vi.fn((_img: CanvasImageSource, _x: number, y: number) => {
      draws.push({ y, alpha: ctx.globalAlpha });
    })
  } as unknown as CanvasRenderingContext2D;
  return { ctx, draws };
}

describe('OnsenSteamEffect', () => {
  it('sizes HiDPI radial puff sprite by dpr, stays 100% steady across Day 6 <-> Day 7 (5.5), and smoothly fades in/out', () => {
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

    const { ctx, draws } = createTrackingCtx();

    // Settled adjacent days (Day 5 -> dayFloat 4, Day 8 -> dayFloat 7) -> strict zero bleed!
    effect.render(ctx, 400, 844, 4, true);
    effect.render(ctx, 400, 844, 7, true);
    expect(ctx.drawImage).not.toHaveBeenCalled();

    // Instant jump to Day 6 (dayFloat 5) fades in smoothly from 0 (no instant pop-in!)
    effect.render(ctx, 400, 844, 5, true, 1);
    expect(draws).toHaveLength(18);
    const frame1AlphaSum = draws.reduce((sum, d) => sum + d.alpha, 0);

    draws.length = 0;
    for (let stepIdx = 0; stepIdx < 85; stepIdx++) {
      draws.length = 0;
      effect.render(ctx, 400, 844, 5, true, 1.2);
    }
    const steadyDay6AlphaSum = draws.reduce((sum, d) => sum + d.alpha, 0);
    expect(frame1AlphaSum).toBeGreaterThan(0);
    expect(frame1AlphaSum).toBeLessThan(steadyDay6AlphaSum * 0.2);

    // Static comparison across contiguous span 5.0 -> 5.5 -> 6.0 proves exact 1.0 steadiness (zero midpoint dip!)
    draws.length = 0;
    effect.render(ctx, 400, 844, 5, false);
    const staticAt5 = draws.reduce((sum, d) => sum + d.alpha, 0);
    draws.length = 0;
    effect.render(ctx, 400, 844, 5.5, false);
    const staticAt5Half = draws.reduce((sum, d) => sum + d.alpha, 0);
    draws.length = 0;
    effect.render(ctx, 400, 844, 6, false);
    const staticAt6 = draws.reduce((sum, d) => sum + d.alpha, 0);
    expect(staticAt5Half).toBeCloseTo(staticAt5, 10);
    expect(staticAt6).toBeCloseTo(staticAt5, 10);

    // Jumping away Day 7 (6) -> Day 8 (7): wisps keep advancing upward while smoothly dissolving to 0!
    draws.length = 0;
    effect.render(ctx, 400, 844, 7, true, 1);
    expect(draws).toHaveLength(18);
    const fadeOutY0 = draws[0].y;
    const fadeOutAlpha1 = draws.reduce((sum, d) => sum + d.alpha, 0);
    expect(fadeOutAlpha1).toBeGreaterThan(staticAt6 * 0.8);
    expect(fadeOutAlpha1).toBeLessThan(staticAt6);

    draws.length = 0;
    effect.render(ctx, 400, 844, 7, true, 1);
    expect(draws[0].y).not.toBe(fadeOutY0); // Wisps continue rising during fade-out!

    for (let stepIdx = 0; stepIdx < 90; stepIdx++) {
      effect.render(ctx, 400, 844, 7);
    }
    vi.mocked(ctx.drawImage).mockClear();
    effect.render(ctx, 400, 844, 7);
    expect(ctx.drawImage).not.toHaveBeenCalled();

    // Default constructor & empty activeDayIndices guard
    const defaultEffect = new OnsenSteamEffect();
    const zeroDaysEffect = new OnsenSteamEffect(0, []);
    const { ctx: ctx2 } = createTrackingCtx();
    zeroDaysEffect.render(ctx2, 400, 844, 5, true);
    expect(ctx2.drawImage).not.toHaveBeenCalled();
    defaultEffect.render(ctx2, 400, 844, 5);
    expect(ctx2.drawImage).toHaveBeenCalled();
  });
});
