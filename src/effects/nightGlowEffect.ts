import { createPrng } from '../utils/prng';
import { StrengthEnvelope } from './strengthEnvelope';

interface GlowOrb {
  xRatio: number;
  yOffset: number;
  r: number;
  phase: number;
  speed: number;
}

function createBokehOrbSprite(dpr: number): HTMLCanvasElement {
  const sizePx = Math.max(32, Math.round(32 * dpr));
  const halfPx = sizePx / 2;
  const c = document.createElement('canvas');
  c.width = sizePx;
  c.height = sizePx;
  const gCtx = c.getContext('2d');
  if (gCtx) {
    const grad = gCtx.createRadialGradient(halfPx, halfPx, 0, halfPx, halfPx, halfPx);
    grad.addColorStop(0, 'rgba(254, 249, 195, 1)');
    grad.addColorStop(0.38, 'rgba(253, 224, 71, 0.78)');
    grad.addColorStop(0.72, 'rgba(251, 191, 36, 0.28)');
    grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
    gCtx.fillStyle = grad;
    gCtx.fillRect(0, 0, sizePx, sizePx);
  }
  return c;
}

export class NightGlowEffect {
  private readonly orbs: GlowOrb[];
  private sprite: HTMLCanvasElement;
  private spriteDpr: number;
  private readonly envelope: StrengthEnvelope;

  constructor(orbCount = 12, activeDayIndices: readonly number[] = [8, 9, 10], initialDpr = 1) {
    const rand = createPrng(20270310);
    this.spriteDpr = initialDpr;
    this.sprite = createBokehOrbSprite(initialDpr);
    this.envelope = new StrengthEnvelope(activeDayIndices);
    this.orbs = Array.from({ length: orbCount }, () => ({
      xRatio: 0.08 + rand() * 0.84,
      yOffset: 28 + rand() * 110,
      r: 5 + rand() * 6,
      phase: rand() * Math.PI * 2,
      speed: 0.025 + rand() * 0.03
    }));
  }

  public setDpr(nextDpr: number): void {
    if (nextDpr === this.spriteDpr) return;
    this.spriteDpr = nextDpr;
    this.sprite = createBokehOrbSprite(nextDpr);
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

    const scaledStrength = currentStrength * 0.72;

    for (const o of this.orbs) {
      if (isAdvancing) {
        o.phase += o.speed * dtScale;
      }
      const x = o.xRatio * w;
      const y = h - o.yOffset + Math.cos(o.phase * 0.7) * 4;
      ctx.globalAlpha = Math.max(0, 0.45 + 0.55 * Math.sin(o.phase)) * scaledStrength;
      ctx.drawImage(this.sprite, x - o.r, y - o.r, o.r * 2, o.r * 2);
    }
  }
}
