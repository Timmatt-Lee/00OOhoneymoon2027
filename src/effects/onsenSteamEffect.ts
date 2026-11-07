interface SteamWisp {
  xRatio: number;
  yOffset: number;
  radius: number;
  vy: number;
  alpha: number;
  phase: number;
}

export class OnsenSteamEffect {
  private wisps: SteamWisp[] = [];

  constructor(count = 16) {
    for (let i = 0; i < count; i++) {
      this.wisps.push({
        xRatio: 0.14 + Math.random() * 0.72,
        yOffset: Math.random() * 140,
        radius: 14 + Math.random() * 20,
        vy: 0.25 + Math.random() * 0.32,
        alpha: 0.12 + Math.random() * 0.14,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  public render(ctx: CanvasRenderingContext2D, w: number, h: number, dayFloat: number): void {
    // Active around Day 6 (index 5: Lake Shikotsu) and Day 7 (index 6: Noboribetsu Onsen)
    const distToOnsen = Math.min(Math.abs(dayFloat - 5), Math.abs(dayFloat - 6));
    if (distToOnsen >= 1.15) return;

    const strength = Math.max(0, 1 - distToOnsen / 1.15);
    const baseY = h - 42;

    for (let i = 0; i < this.wisps.length; i++) {
      const s = this.wisps[i];
      s.phase += 0.02;
      s.yOffset += s.vy;
      if (s.yOffset > 155) {
        s.yOffset = 0;
        s.xRatio = 0.14 + Math.random() * 0.72;
      }
      const lifeRatio = s.yOffset / 155;
      const fade = Math.sin(lifeRatio * Math.PI);
      const x = s.xRatio * w + Math.sin(s.phase) * 9;
      const y = baseY - s.yOffset;
      const r = s.radius * (0.8 + lifeRatio * 0.75);

      const grad = ctx.createRadialGradient(x, y, 1, x, y, r);
      grad.addColorStop(0, `rgba(241, 245, 249, ${(s.alpha * fade * strength).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(241, 245, 249, 0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
