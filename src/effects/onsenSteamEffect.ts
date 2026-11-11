import { createPrng } from '../utils/prng';

interface SteamWisp {
  xRatio: number;
  yOffset: number;
  radius: number;
  vy: number;
  alpha: number;
  phase: number;
}

function createSteamPuffSprite(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const gCtx = c.getContext('2d');
  if (gCtx) {
    const grad = gCtx.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, 'rgba(248, 250, 252, 1)');
    grad.addColorStop(0.55, 'rgba(241, 245, 249, 0.55)');
    grad.addColorStop(1, 'rgba(241, 245, 249, 0)');
    gCtx.fillStyle = grad;
    gCtx.fillRect(0, 0, 64, 64);
  }
  return c;
}

export class OnsenSteamEffect {
  private readonly wisps: SteamWisp[];
  private readonly sprite: HTMLCanvasElement;
  private readonly activeDayIndices: readonly number[];
  private readonly rand = createPrng(20270307);

  constructor(wispCount = 18, activeDayIndices: readonly number[] = [5, 6]) {
    this.sprite = createSteamPuffSprite();
    this.activeDayIndices = activeDayIndices;
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

  public render(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dayFloat: number,
    isAdvancing = true
  ): void {
    if (this.activeDayIndices.length === 0) return;

    let minDist = Infinity;
    for (const idx of this.activeDayIndices) {
      const d = Math.abs(dayFloat - idx);
      if (d < minDist) minDist = d;
    }
    if (minDist >= 1.15) return;

    const strength = 1 - minDist / 1.15;
    const baseY = h - 36;

    for (const s of this.wisps) {
      if (isAdvancing) {
        s.phase += 0.02;
        s.yOffset += s.vy;
        if (s.yOffset > 135) {
          s.yOffset = 0;
        }
      }
      const lifeRatio = s.yOffset / 135;
      const x = s.xRatio * w + Math.sin(s.phase) * 7;
      const y = baseY - s.yOffset;
      const r = s.radius * (0.75 + lifeRatio * 0.85);

      ctx.globalAlpha = s.alpha * Math.sin(lifeRatio * Math.PI) * strength;
      ctx.drawImage(this.sprite, x - r, y - r, r * 2, r * 2);
    }
  }
}
