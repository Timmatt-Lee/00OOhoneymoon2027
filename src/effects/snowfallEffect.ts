interface Snowflake {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  alpha: number;
  phase: number;
}

export class SnowfallEffect {
  private flakes: Snowflake[] = [];

  constructor(count: number, w: number, h: number) {
    for (let i = 0; i < count; i++) {
      this.flakes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 2.1 + 0.9,
        vy: Math.random() * 0.52 + 0.24,
        vx: (Math.random() - 0.5) * 0.3,
        alpha: Math.random() * 0.55 + 0.35,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  public render(ctx: CanvasRenderingContext2D, w: number, h: number, dayFloat: number): void {
    const isBieiWeddingDay = Math.abs(dayFloat - 4) < 0.7;
    ctx.fillStyle = isBieiWeddingDay ? 'rgba(255, 245, 250, 0.92)' : '#FFFFFF';
    for (let i = 0; i < this.flakes.length; i++) {
      const f = this.flakes[i];
      f.phase += 0.015;
      f.y += f.vy;
      f.x += f.vx + Math.sin(f.phase) * 0.18;
      if (f.y > h + 6) {
        f.y = -6;
        f.x = Math.random() * w;
      }
      if (f.x > w + 6) f.x = -6;
      if (f.x < -6) f.x = w + 6;
      ctx.globalAlpha = f.alpha;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
