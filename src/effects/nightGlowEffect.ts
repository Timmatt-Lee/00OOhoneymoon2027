interface GlowOrb {
  xRatio: number;
  yOffset: number;
  r: number;
  phase: number;
  speed: number;
}

function createPrng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class NightGlowEffect {
  private readonly orbs: GlowOrb[];

  constructor(count = 12) {
    const rand = createPrng(20270310);
    this.orbs = Array.from({ length: count }, () => ({
      xRatio: 0.08 + rand() * 0.84,
      yOffset: 28 + rand() * 110,
      r: 2.2 + rand() * 3.2,
      phase: rand() * Math.PI * 2,
      speed: 0.025 + rand() * 0.03
    }));
  }

  public render(ctx: CanvasRenderingContext2D, w: number, h: number, dayFloat: number, advance = true): void {
    const dist = Math.min(Math.abs(dayFloat - 8), Math.abs(dayFloat - 9), Math.abs(dayFloat - 10));
    if (dist >= 1.1) return;

    const strength = (1 - dist / 1.1) * 0.65;
    ctx.fillStyle = '#FDE047';

    for (let i = 0; i < this.orbs.length; i++) {
      const o = this.orbs[i];
      if (advance) o.phase += o.speed;
      const x = o.xRatio * w;
      const y = h - o.yOffset + Math.cos(o.phase * 0.7) * 4;
      ctx.globalAlpha = (0.45 + 0.55 * Math.sin(o.phase)) * strength;
      ctx.beginPath();
      ctx.arc(x, y, o.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
