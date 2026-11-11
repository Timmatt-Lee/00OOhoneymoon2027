import { createPrng } from '../utils/prng';

interface GlowOrb {
  xRatio: number;
  yOffset: number;
  r: number;
  phase: number;
  speed: number;
}

export class NightGlowEffect {
  private readonly orbs: GlowOrb[];
  private readonly activeDayIndices: readonly number[];

  constructor(orbCount = 12, activeDayIndices: readonly number[] = [8, 9, 10]) {
    const rand = createPrng(20270310);
    this.activeDayIndices = activeDayIndices;
    this.orbs = Array.from({ length: orbCount }, () => ({
      xRatio: 0.08 + rand() * 0.84,
      yOffset: 28 + rand() * 110,
      r: 2.2 + rand() * 3.2,
      phase: rand() * Math.PI * 2,
      speed: 0.025 + rand() * 0.03
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
    if (minDist >= 1.1) return;

    const strength = (1 - minDist / 1.1) * 0.65;
    ctx.fillStyle = '#FDE047';

    for (const o of this.orbs) {
      if (isAdvancing) o.phase += o.speed;
      const x = o.xRatio * w;
      const y = h - o.yOffset + Math.cos(o.phase * 0.7) * 4;
      ctx.globalAlpha = (0.45 + 0.55 * Math.sin(o.phase)) * strength;
      ctx.beginPath();
      ctx.arc(x, y, o.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
