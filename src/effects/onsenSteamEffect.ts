import { createPrng } from '../utils/prng';
import { StrengthEnvelope } from './strengthEnvelope';

interface SteamWisp {
  xRatio: number;
  yOffset: number;
  radius: number;
  vy: number;
  alpha: number;
  phase: number;
}

function createSteamPuffSprite(dpr: number): HTMLCanvasElement {
  const sizePx = Math.max(64, Math.round(112 * dpr));
  const halfPx = sizePx / 2;
  const innerRadiusPx = Math.max(2, sizePx * 0.03);
  const c = document.createElement('canvas');
  c.width = sizePx;
  c.height = sizePx;
  const gCtx = c.getContext('2d');
  if (gCtx) {
    const grad = gCtx.createRadialGradient(halfPx, halfPx, innerRadiusPx, halfPx, halfPx, halfPx);
    grad.addColorStop(0, 'rgba(248, 250, 252, 1)');
    grad.addColorStop(0.55, 'rgba(241, 245, 249, 0.55)');
    grad.addColorStop(1, 'rgba(241, 245, 249, 0)');
    gCtx.fillStyle = grad;
    gCtx.fillRect(0, 0, sizePx, sizePx);
  }
  return c;
}

export class OnsenSteamEffect {
  private readonly wisps: SteamWisp[];
  private sprite: HTMLCanvasElement;
  private spriteDpr: number;
  private readonly envelope: StrengthEnvelope;
  private readonly rand = createPrng(20270307);

  constructor(wispCount = 18, activeDayIndices: readonly number[] = [5, 6], initialDpr = 1) {
    this.spriteDpr = initialDpr;
    this.sprite = createSteamPuffSprite(initialDpr);
    this.envelope = new StrengthEnvelope(activeDayIndices);
    const primaryCount = Math.round(wispCount * 0.78);
    this.wisps = Array.from({ length: wispCount }, (_, idx) => ({
      xRatio: idx < primaryCount ? 0.68 + this.rand() * 0.25 : 0.22 + this.rand() * 0.42,
      yOffset: (idx / Math.max(1, wispCount)) * 125 + this.rand() * 18,
      radius: 16 + this.rand() * 22,
      vy: 0.28 + this.rand() * 0.3,
      alpha: idx < primaryCount ? 0.34 + this.rand() * 0.22 : 0.16 + this.rand() * 0.12,
      phase: this.rand() * Math.PI * 2
    }));
  }

  public setDpr(nextDpr: number): void {
    if (nextDpr === this.spriteDpr) return;
    this.spriteDpr = nextDpr;
    this.sprite = createSteamPuffSprite(nextDpr);
  }

  public render(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dayFloat: number,
    isAdvancing = true,
    dtScale = 1
  ): void {
    const currentStrength = this.envelope.step(dayFloat, isAdvancing, dtScale);
    if (currentStrength <= 0) return;

    const baseY = h - 36;

    for (const s of this.wisps) {
      if (isAdvancing) {
        s.phase += 0.02 * dtScale;
        s.yOffset += s.vy * dtScale;
        if (s.yOffset > 135) {
          s.yOffset = 0;
        }
      }
      const lifeRatio = s.yOffset / 135;
      const x = s.xRatio * w + Math.sin(s.phase) * 7;
      const y = baseY - s.yOffset;
      const r = s.radius * (0.75 + lifeRatio * 0.85);

      ctx.globalAlpha = Math.max(0, s.alpha * Math.sin(lifeRatio * Math.PI)) * currentStrength;
      ctx.drawImage(this.sprite, x - r, y - r, r * 2, r * 2);
    }
  }
}
