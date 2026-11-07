interface Snowflake {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  alpha: number;
  phase: number;
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

export class SnowfallEffect {
  private readonly flakes: Snowflake[];
  private readonly rand = createPrng(20270302);

  constructor(count: number, w: number, h: number) {
    this.flakes = Array.from({ length: count }, () => ({
      x: this.rand() * w,
      y: this.rand() * h,
      r: this.rand() * 2.1 + 0.9,
      vy: this.rand() * 0.52 + 0.24,
      vx: (this.rand() - 0.5) * 0.3,
      alpha: this.rand() * 0.55 + 0.35,
      phase: this.rand() * Math.PI * 2
    }));
  }

  public render(ctx: CanvasRenderingContext2D, w: number, h: number, dayFloat: number, advance = true): void {
    ctx.fillStyle = Math.abs(dayFloat - 4) < 0.7 ? 'rgba(255, 245, 250, 0.92)' : '#FFFFFF';
    for (let i = 0; i < this.flakes.length; i++) {
      const f = this.flakes[i];
      if (advance) {
        f.phase += 0.015;
        f.y += f.vy;
        f.x += f.vx + Math.sin(f.phase) * 0.18;
        if (f.y > h + 6) {
          f.y = -6;
          f.x = this.rand() * w;
        }
        if (f.x > w + 6) f.x = -6;
        else if (f.x < -6) f.x = w + 6;
      }
      ctx.globalAlpha = f.alpha;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
