interface GlowOrb {
  xRatio: number;
  yOffset: number;
  r: number;
  phase: number;
  speed: number;
}

export class NightGlowEffect {
  private orbs: GlowOrb[] = [];

  constructor(count = 14) {
    for (let i = 0; i < count; i++) {
      this.orbs.push({
        xRatio: 0.08 + Math.random() * 0.84,
        yOffset: 28 + Math.random() * 110,
        r: 2.2 + Math.random() * 3.2,
        phase: Math.random() * Math.PI * 2,
        speed: 0.025 + Math.random() * 0.03
      });
    }
  }

  public render(ctx: CanvasRenderingContext2D, w: number, h: number, dayFloat: number): void {
    // Active on Otaru & Sapporo evening days (Days 9-11 => indices 8, 9, 10)
    const dist = Math.min(
      Math.abs(dayFloat - 8),
      Math.abs(dayFloat - 9),
      Math.abs(dayFloat - 10)
    );
    if (dist >= 1.1) return;

    const strength = Math.max(0, 1 - dist / 1.1);
    for (let i = 0; i < this.orbs.length; i++) {
      const o = this.orbs[i];
      o.phase += o.speed;
      const pulse = 0.45 + 0.55 * Math.sin(o.phase);
      const x = o.xRatio * w;
      const y = h - o.yOffset + Math.cos(o.phase * 0.7) * 4;

      ctx.globalAlpha = pulse * strength * 0.65;
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.arc(x, y, o.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
