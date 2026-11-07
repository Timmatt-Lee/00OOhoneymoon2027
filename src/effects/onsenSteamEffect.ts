interface SteamWisp {
  xRatio: number;
  yOffset: number;
  radius: number;
  vy: number;
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
  private readonly rand = createPrng(20270307);

  constructor(count = 18) {
    this.sprite = createSteamPuffSprite();
    this.wisps = Array.from({ length: count }, (_, idx) => ({
      // Concentrate 75% of steam directly over the outdoor rock rotenburo (xRatio 0.68..0.94), plus gentle ambient mist
      xRatio: idx < 14 ? 0.68 + this.rand() * 0.25 : 0.22 + this.rand() * 0.42,
      yOffset: (idx / count) * 125 + this.rand() * 18,
      radius: 16 + this.rand() * 22,
      vy: 0.28 + this.rand() * 0.3,
      alpha: idx < 14 ? 0.34 + this.rand() * 0.22 : 0.16 + this.rand() * 0.12,
      phase: this.rand() * Math.PI * 2
    }));
  }

  public render(ctx: CanvasRenderingContext2D, w: number, h: number, dayFloat: number, advance = true): void {
    const dist = Math.min(Math.abs(dayFloat - 5), Math.abs(dayFloat - 6));
    if (dist >= 1.15) return;

    const strength = 1 - dist / 1.15;
    const baseY = h - 36;

    for (let i = 0; i < this.wisps.length; i++) {
      const s = this.wisps[i];
      if (advance) {
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
